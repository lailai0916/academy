import { and, asc, desc, eq, gte, inArray, lte, notExists, sql } from 'drizzle-orm';
import { Rating, type Grade } from 'ts-fsrs';
import type {
  ActiveLearningSession,
  ContentKind,
  LearningAnswerResult,
  LearningInsights,
  LearningMistake,
  LearningOverview,
  LearningPrompt,
  LearningSessionSummary,
  PoemPayload,
  SessionUser,
  WordPayload,
} from '@lailai/academy-shared';
import { db } from '../db/index.js';
import {
  activities,
  contentItems,
  contentVersions,
  dailyPlans,
  learningCards,
  reviewEvents,
  studySessions,
} from '../db/schema.js';
import { currentStudyDate, getOrCreateDailyPlan } from './dashboard.js';
import {
  buildReviewForecast,
  currentMastery,
  reviewMemory,
  sessionMastery,
} from './memory-model.js';
import { getActiveLearningSession, presentActiveLearningSession } from './study-sessions.js';

type StoredCard = typeof learningCards.$inferSelect;
type StoredVersion = typeof contentVersions.$inferSelect;
type LearningContent = StoredVersion & {
  id: string;
  versionId: string;
  key: string;
  publishedVersionId: string | null;
};

type SessionOptions = {
  mode: 'plan' | 'review' | 'diagnostic';
  focus: 'all' | 'mistakes';
  unit?: string;
  limit?: number;
};

function normalizeAnswer(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s，。！？、；：,.!?;:'"“”‘’（）()《》]/g, '');
}

function answerMatches(answer: string, accepted: string[]) {
  const normalized = normalizeAnswer(answer);
  return accepted.some((item) => normalizeAnswer(item) === normalized);
}

const minimumReinforcementGap = 2;

export function shouldScheduleReinforcement(
  contentQueue: string[],
  completedCount: number,
  contentId: string,
  correct: boolean,
  contentUpdated = false
) {
  if (correct || contentUpdated) return false;
  const remainingItems = contentQueue.length - completedCount - 1;
  if (remainingItems < minimumReinforcementGap) return false;
  const occurrences = contentQueue.filter((queuedId) => queuedId === contentId).length;
  const alreadyQueued = contentQueue.slice(completedCount + 1).includes(contentId);
  return occurrences < 2 && !alreadyQueued;
}

const responseBenchmarks: Record<LearningPrompt['promptType'], { easy: number; hard: number }> = {
  meaning_choice: { easy: 4_000, hard: 14_000 },
  spelling: { easy: 7_000, hard: 25_000 },
  context: { easy: 9_000, hard: 30_000 },
  fill_blank: { easy: 8_000, hard: 28_000 },
  next_line: { easy: 10_000, hard: 35_000 },
};

function chooseRating(
  correct: boolean,
  revealed: boolean,
  responseMs: number,
  reps: number,
  promptType: LearningPrompt['promptType']
): Grade {
  if (!correct || revealed) {
    return Rating.Again;
  }
  const benchmark = responseBenchmarks[promptType];
  if (responseMs > benchmark.hard) {
    return Rating.Hard;
  }
  if (responseMs < benchmark.easy && reps > 1) {
    return Rating.Easy;
  }
  return Rating.Good;
}

function ratingName(rating: Grade): LearningAnswerResult['rating'] {
  return rating === Rating.Again
    ? 'again'
    : rating === Rating.Hard
      ? 'hard'
      : rating === Rating.Easy
        ? 'easy'
        : 'good';
}

function maskPoemLine(line: string, seed: number) {
  const phrases = line.split(/[，。！？；]/).filter((item) => item.length >= 2);
  const phrase = phrases[seed % phrases.length] ?? line;
  const length = Math.min(4, Math.max(2, Math.floor(phrase.length / 2)));
  const start = Math.max(0, phrase.length - length);
  const answer = phrase.slice(start);
  return {
    answer,
    masked: line.replace(answer, '＿'.repeat(Array.from(answer).length)),
  };
}

function presentContent(content: Pick<LearningContent, 'kind' | 'payload'>) {
  if (content.kind === 'word') {
    const payload = content.payload as WordPayload;
    return { title: payload.headword, detail: payload.meanings[0] ?? '' };
  }
  const payload = content.payload as PoemPayload;
  return { title: `《${payload.title}》`, detail: `${payload.dynasty} · ${payload.author}` };
}

function presentLearningContent(
  identity: Pick<typeof contentItems.$inferSelect, 'id' | 'key' | 'publishedVersionId'>,
  version: StoredVersion
): LearningContent {
  return {
    ...version,
    id: identity.id,
    versionId: version.id,
    key: identity.key,
    publishedVersionId: identity.publishedVersionId,
  };
}

async function getPinnedLearningContent(contentId: string, versionId: string) {
  const [row] = await db
    .select({ identity: contentItems, version: contentVersions })
    .from(contentItems)
    .innerJoin(
      contentVersions,
      and(eq(contentVersions.id, versionId), eq(contentVersions.contentId, contentItems.id))
    )
    .where(eq(contentItems.id, contentId))
    .limit(1);
  return row ? presentLearningContent(row.identity, row.version) : null;
}

function percentage(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

export function summarizeAttemptSequences(events: { contentId: string; correct: boolean }[]) {
  const attemptsByContent = new Map<string, boolean[]>();
  for (const event of events) {
    const attempts = attemptsByContent.get(event.contentId) ?? [];
    attempts.push(event.correct);
    attemptsByContent.set(event.contentId, attempts);
  }
  const attempts = [...attemptsByContent.values()];
  const firstPassCorrect = attempts.filter((item) => item[0]).length;
  const reinforced = attempts.filter((item) => item.length > 1);
  const recovered = reinforced.filter((item) => !item[0] && item.slice(1).some(Boolean));
  return {
    firstPassAccuracy: percentage(firstPassCorrect, attempts.length),
    reinforcementCount: reinforced.length,
    recoveredCount: recovered.length,
  };
}

function hashString(value: string) {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function selectDiagnosticContent<T extends { id: string; textbook: string; unit: string }>(
  items: T[],
  limit: number,
  seed: string
) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = `${item.textbook}\u0000${item.unit}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const orderedGroups = [...groups.entries()]
    .sort(([left], [right]) => hashString(`${seed}:${left}`) - hashString(`${seed}:${right}`))
    .map(([, group]) =>
      group.sort(
        (left, right) => hashString(`${seed}:${left.id}`) - hashString(`${seed}:${right.id}`)
      )
    );
  const selected: T[] = [];
  for (let round = 0; selected.length < limit; round += 1) {
    let added = false;
    for (const group of orderedGroups) {
      const item = group[round];
      if (!item) continue;
      selected.push(item);
      added = true;
      if (selected.length === limit) break;
    }
    if (!added) break;
  }
  return selected;
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return shuffled;
}

async function buildPrompt(
  sessionId: string,
  content: LearningContent,
  card: StoredCard,
  sessionStartedAt: Date,
  progress: LearningPrompt['progress']
): Promise<LearningPrompt & { acceptedAnswers: string[]; explanation: string }> {
  const mastery = sessionMastery(card, sessionStartedAt);
  if (content.kind === 'word') {
    const payload = content.payload as WordPayload;
    const promptType = card.reps === 0 ? 'meaning_choice' : mastery < 0.55 ? 'spelling' : 'context';
    if (promptType === 'meaning_choice') {
      const alternatives = await db
        .select({ payload: contentVersions.payload })
        .from(contentItems)
        .innerJoin(contentVersions, eq(contentVersions.id, contentItems.publishedVersionId))
        .where(
          and(
            eq(contentVersions.kind, 'word'),
            eq(contentVersions.grade, content.grade),
            sql`${contentItems.id} <> ${content.id}`
          )
        )
        .orderBy(
          sql`case when ${contentVersions.unit} = ${content.unit} then 0 else 1 end`,
          sql`random()`
        )
        .limit(12);
      const correctMeaning = payload.meanings[0];
      const distractors = alternatives
        .map((item) => (item.payload as WordPayload).meanings[0])
        .filter(
          (meaning, index, all) => meaning !== correctMeaning && all.indexOf(meaning) === index
        )
        .slice(0, 3);
      const options = shuffle([correctMeaning, ...distractors]);
      return {
        sessionId,
        contentId: content.id,
        kind: 'word',
        promptType,
        title: payload.headword,
        prompt: '选择最准确的中文释义',
        context: payload.phonetic,
        options,
        progress,
        acceptedAnswers: payload.meanings,
        explanation: `${payload.headword}：${payload.meanings.join('；')}。${payload.exampleTranslation}`,
      };
    }
    return {
      sessionId,
      contentId: content.id,
      kind: 'word',
      promptType,
      title: promptType === 'spelling' ? payload.meanings[0] : '语境填空',
      prompt:
        promptType === 'spelling'
          ? '根据释义写出英文单词'
          : payload.example.replace(new RegExp(payload.headword, 'i'), '______'),
      context: promptType === 'spelling' ? payload.phonetic : payload.exampleTranslation,
      progress,
      acceptedAnswers: [payload.headword],
      explanation: `${payload.headword} ${payload.phonetic}：${payload.meanings.join('；')}。`,
    };
  }

  const payload = content.payload as PoemPayload;
  const lineIndex = card.reps % Math.max(1, payload.lines.length - 1);
  if (mastery >= 0.62) {
    return {
      sessionId,
      contentId: content.id,
      kind: 'poem',
      promptType: 'next_line',
      title: `《${payload.title}》`,
      prompt: payload.lines[lineIndex],
      context: '写出下一句',
      progress,
      acceptedAnswers: [payload.lines[lineIndex + 1]],
      explanation: `${payload.author}《${payload.title}》。${payload.keyPoints.join('；')}。`,
    };
  }
  const masked = maskPoemLine(payload.lines[lineIndex], card.reps);
  return {
    sessionId,
    contentId: content.id,
    kind: 'poem',
    promptType: 'fill_blank',
    title: `《${payload.title}》· ${payload.author}`,
    prompt: masked.masked,
    context: '补全空缺内容',
    progress,
    acceptedAnswers: [masked.answer],
    explanation: payload.translation,
  };
}

async function ensureCard(userId: string, contentId: string) {
  const [card] = await db
    .insert(learningCards)
    .values({ userId, contentId })
    .onConflictDoNothing({ target: [learningCards.userId, learningCards.contentId] })
    .returning();
  if (card) {
    return card;
  }
  const [existing] = await db
    .select()
    .from(learningCards)
    .where(and(eq(learningCards.userId, userId), eq(learningCards.contentId, contentId)))
    .limit(1);
  if (!existing) {
    throw new Error('Learning card could not be created.');
  }
  return existing;
}

type LearningSessionDraft = {
  userId: string;
  kind: ContentKind;
  mode: SessionOptions['mode'];
  plannedCount: number;
  contentQueue: string[];
  contentVersionQueue: string[];
};

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

async function persistLearningSession(
  draft: LearningSessionDraft
): Promise<{ session: ActiveLearningSession; resumed: boolean }> {
  try {
    const [session] = await db.insert(studySessions).values(draft).returning();
    return { session: presentActiveLearningSession(session), resumed: false };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const activeSession = await getActiveLearningSession(draft.userId);
    if (!activeSession) throw error;
    return { session: activeSession, resumed: true };
  }
}

export async function createLearningSession(
  user: SessionUser,
  kind: ContentKind,
  options: SessionOptions
) {
  const activeSession = await getActiveLearningSession(user.id);
  if (activeSession) {
    return { session: activeSession, resumed: true };
  }

  const { mode, focus, unit } = options;
  const plan = await getOrCreateDailyPlan(user);
  const desired =
    mode === 'diagnostic'
      ? 10
      : kind === 'word'
        ? plan.wordsDue + (mode === 'plan' ? plan.wordsNew : 0)
        : plan.poemsDue + (mode === 'plan' ? plan.poemsNew : 0);
  const limit = Math.max(1, Math.min(options.limit ?? (desired || 10), 30));

  if (focus === 'mistakes') {
    const mistakeRows = await db
      .select({
        id: contentItems.id,
        versionId: contentVersions.id,
        lastMistakeAt: sql<Date>`max(${reviewEvents.createdAt})`,
      })
      .from(reviewEvents)
      .innerJoin(learningCards, eq(learningCards.id, reviewEvents.cardId))
      .innerJoin(contentItems, eq(contentItems.id, learningCards.contentId))
      .innerJoin(contentVersions, eq(contentVersions.id, contentItems.publishedVersionId))
      .where(
        and(
          eq(reviewEvents.userId, user.id),
          eq(reviewEvents.correct, false),
          eq(reviewEvents.countsForMastery, true),
          eq(contentVersions.kind, kind),
          eq(contentVersions.grade, user.grade),
          unit ? eq(contentVersions.unit, unit) : undefined
        )
      )
      .groupBy(contentItems.id, contentVersions.id, learningCards.id);
    const cardRows =
      mistakeRows.length === 0
        ? []
        : await db
            .select({ card: learningCards })
            .from(learningCards)
            .where(
              and(
                eq(learningCards.userId, user.id),
                inArray(
                  learningCards.contentId,
                  mistakeRows.map((item) => item.id)
                )
              )
            );
    const cardsByContent = new Map(cardRows.map((row) => [row.card.contentId, row.card]));
    const now = new Date();
    const mistakes = mistakeRows
      .map((item) => ({ ...item, card: cardsByContent.get(item.id) }))
      .filter(
        (
          item
        ): item is {
          id: string;
          versionId: string;
          lastMistakeAt: Date;
          card: StoredCard;
        } => Boolean(item.card)
      )
      .sort(
        (left, right) =>
          currentMastery(left.card, now) - currentMastery(right.card, now) ||
          new Date(right.lastMistakeAt).getTime() - new Date(left.lastMistakeAt).getTime()
      )
      .slice(0, limit);
    if (mistakes.length === 0) {
      return null;
    }
    return persistLearningSession({
      userId: user.id,
      kind,
      mode: 'review',
      plannedCount: mistakes.length,
      contentQueue: mistakes.map((item) => item.id),
      contentVersionQueue: mistakes.map((item) => item.versionId),
    });
  }

  if (mode === 'diagnostic') {
    const diagnosticPool = await db
      .select({
        id: contentItems.id,
        versionId: contentVersions.id,
        textbook: contentVersions.textbook,
        unit: contentVersions.unit,
      })
      .from(contentItems)
      .innerJoin(contentVersions, eq(contentVersions.id, contentItems.publishedVersionId))
      .where(
        and(
          eq(contentVersions.kind, kind),
          eq(contentVersions.grade, user.grade),
          unit ? eq(contentVersions.unit, unit) : undefined
        )
      );
    const diagnostic = selectDiagnosticContent(
      diagnosticPool,
      limit,
      `${user.id}:${kind}:${unit ?? 'all'}`
    );
    if (diagnostic.length === 0) {
      return null;
    }
    return persistLearningSession({
      userId: user.id,
      kind,
      mode,
      plannedCount: diagnostic.length,
      contentQueue: diagnostic.map((item) => item.id),
      contentVersionQueue: diagnostic.map((item) => item.versionId),
    });
  }

  const due = await db
    .select({ id: contentItems.id, versionId: contentVersions.id })
    .from(learningCards)
    .innerJoin(contentItems, eq(contentItems.id, learningCards.contentId))
    .innerJoin(contentVersions, eq(contentVersions.id, contentItems.publishedVersionId))
    .where(
      and(
        eq(learningCards.userId, user.id),
        eq(contentVersions.kind, kind),
        eq(contentVersions.grade, user.grade),
        unit ? eq(contentVersions.unit, unit) : undefined,
        lte(learningCards.due, new Date())
      )
    )
    .orderBy(asc(learningCards.due))
    .limit(limit);
  const remaining = Math.max(0, limit - due.length);
  const fresh =
    mode === 'review' || remaining === 0
      ? []
      : await db
          .select({ id: contentItems.id, versionId: contentVersions.id })
          .from(contentItems)
          .innerJoin(contentVersions, eq(contentVersions.id, contentItems.publishedVersionId))
          .where(
            and(
              eq(contentVersions.kind, kind),
              eq(contentVersions.grade, user.grade),
              unit ? eq(contentVersions.unit, unit) : undefined,
              notExists(
                db
                  .select({ id: learningCards.id })
                  .from(learningCards)
                  .where(
                    and(
                      eq(learningCards.userId, user.id),
                      eq(learningCards.contentId, contentItems.id)
                    )
                  )
              )
            )
          )
          .orderBy(asc(contentItems.key))
          .limit(remaining);
  const selected = [...due, ...fresh];
  const queue = selected.map((item) => item.id);
  if (queue.length === 0) {
    return null;
  }
  return persistLearningSession({
    userId: user.id,
    kind,
    mode,
    plannedCount: queue.length,
    contentQueue: queue,
    contentVersionQueue: selected.map((item) => item.versionId),
  });
}

export async function getNextPrompt(userId: string, sessionId: string) {
  const [session] = await db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
    .limit(1);
  if (!session || session.status !== 'active') {
    return null;
  }
  const contentId = session.contentQueue[session.completedCount];
  const contentVersionId = session.contentVersionQueue[session.completedCount];
  if (!contentId || !contentVersionId) {
    return null;
  }
  const content = await getPinnedLearningContent(contentId, contentVersionId);
  if (!content) {
    throw new Error('Session content version is missing.');
  }
  const card = await ensureCard(userId, content.id);
  const prompt = await buildPrompt(session.id, content, card, session.startedAt, {
    completed: session.completedCount,
    total: session.plannedCount,
  });
  const { acceptedAnswers: _, explanation: __, ...publicPrompt } = prompt;
  return publicPrompt;
}

export async function answerPrompt(
  user: SessionUser,
  sessionId: string,
  input: { contentId: string; answer: string; responseMs: number; revealed: boolean }
): Promise<LearningAnswerResult | null> {
  const [session] = await db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, user.id)))
    .limit(1);
  if (
    !session ||
    session.status !== 'active' ||
    session.contentQueue[session.completedCount] !== input.contentId ||
    !session.contentVersionQueue[session.completedCount]
  ) {
    return null;
  }
  const contentVersionId = session.contentVersionQueue[session.completedCount]!;
  const content = await getPinnedLearningContent(input.contentId, contentVersionId);
  if (!content) {
    return null;
  }
  const contentUpdated = content.publishedVersionId !== content.versionId;
  const card = await ensureCard(user.id, content.id);
  const prompt = await buildPrompt(session.id, content, card, session.startedAt, {
    completed: session.completedCount,
    total: session.plannedCount,
  });
  const correct = answerMatches(input.answer, prompt.acceptedAnswers) && !input.revealed;
  const rating = chooseRating(
    correct,
    input.revealed,
    input.responseMs,
    card.reps,
    prompt.promptType
  );
  const now = new Date();
  const memoryResult = reviewMemory(card, now, rating);
  const masteryBefore = memoryResult.masteryBefore;
  const mastery = memoryResult.masteryAfter;
  const delayed = Boolean(
    card.lastReview && now.getTime() - card.lastReview.getTime() >= 86_400_000
  );
  const completedCount = session.completedCount + 1;
  const reinforcementScheduled = shouldScheduleReinforcement(
    session.contentQueue,
    session.completedCount,
    input.contentId,
    correct,
    contentUpdated
  );
  const plannedCount = session.plannedCount + (reinforcementScheduled ? 1 : 0);
  const contentQueue = reinforcementScheduled
    ? [...session.contentQueue, input.contentId]
    : session.contentQueue;
  const contentVersionQueue = reinforcementScheduled
    ? [...session.contentVersionQueue, contentVersionId]
    : session.contentVersionQueue;
  const reinforcementAttempt = session.contentQueue
    .slice(0, session.completedCount)
    .includes(input.contentId);
  const sessionComplete = completedCount >= plannedCount;

  try {
    await db.transaction(async (transaction) => {
      const [claimedSession] = await transaction
        .update(studySessions)
        .set({
          completedCount,
          plannedCount,
          contentQueue,
          contentVersionQueue,
          status: sessionComplete ? 'completed' : 'active',
          completedAt: sessionComplete ? now : null,
        })
        .where(
          and(
            eq(studySessions.id, session.id),
            eq(studySessions.status, 'active'),
            eq(studySessions.completedCount, session.completedCount)
          )
        )
        .returning({ id: studySessions.id });
      if (!claimedSession) {
        throw new Error('PROMPT_ALREADY_ANSWERED');
      }
      if (!contentUpdated) {
        await transaction
          .update(learningCards)
          .set({
            due: memoryResult.card.due,
            stability: memoryResult.card.stability,
            difficulty: memoryResult.card.difficulty,
            elapsedDays: memoryResult.card.elapsed_days,
            scheduledDays: memoryResult.card.scheduled_days,
            learningSteps: memoryResult.card.learning_steps,
            reps: memoryResult.card.reps,
            lapses: memoryResult.card.lapses,
            state: memoryResult.card.state,
            lastReview: memoryResult.card.last_review ?? null,
            mastery,
            delayedAttempts: delayed ? card.delayedAttempts + 1 : card.delayedAttempts,
            delayedCorrect: delayed && correct ? card.delayedCorrect + 1 : card.delayedCorrect,
            updatedAt: now,
          })
          .where(eq(learningCards.id, card.id));
      }
      await transaction.insert(reviewEvents).values({
        userId: user.id,
        cardId: card.id,
        sessionId: session.id,
        contentVersionId: content.versionId,
        rating,
        correct,
        responseMs: input.responseMs,
        promptType: prompt.promptType,
        delayed,
        countsForMastery: !contentUpdated,
        masteryBefore,
        masteryAfter: contentUpdated ? masteryBefore : mastery,
        stabilityBefore: card.stability,
        stabilityAfter: contentUpdated ? card.stability : memoryResult.card.stability,
        difficultyBefore: card.difficulty,
        difficultyAfter: contentUpdated ? card.difficulty : memoryResult.card.difficulty,
      });
      if (session.mode === 'plan' && !reinforcementAttempt) {
        await transaction
          .update(dailyPlans)
          .set({
            completed: sql`least(
            ${dailyPlans.completed} + 1,
            ${dailyPlans.wordsDue} + ${dailyPlans.wordsNew} + ${dailyPlans.poemsDue} + ${dailyPlans.poemsNew}
          )`,
          })
          .where(
            and(eq(dailyPlans.userId, user.id), eq(dailyPlans.planDate, currentStudyDate(now)))
          );
      }
      if (sessionComplete) {
        await transaction.insert(activities).values({
          userId: user.id,
          kind: `${session.kind}_session`,
          summary: `完成了 ${plannedCount} 项${session.kind === 'word' ? '单词' : '古诗词'}练习`,
          metadata: { sessionId: session.id, correct },
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'PROMPT_ALREADY_ANSWERED') {
      return null;
    }
    throw error;
  }

  return {
    correct,
    expectedAnswer: prompt.acceptedAnswers[0],
    acceptedAnswers: prompt.acceptedAnswers,
    explanation: prompt.explanation,
    mastery: Math.round((contentUpdated ? card.mastery : mastery) * 100),
    nextDueAt: (contentUpdated ? card.due : memoryResult.card.due).toISOString(),
    rating: ratingName(rating),
    sessionComplete,
    sessionTotal: plannedCount,
    reinforcementScheduled,
    contentUpdated,
  };
}

export async function getContentForAi(userId: string, contentId: string, sessionId?: string) {
  let content: LearningContent | null = null;
  if (sessionId) {
    const [session] = await db
      .select()
      .from(studySessions)
      .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
      .limit(1);
    const queueIndex = session?.contentQueue.indexOf(contentId) ?? -1;
    const versionId = queueIndex >= 0 ? session?.contentVersionQueue[queueIndex] : undefined;
    if (versionId) content = await getPinnedLearningContent(contentId, versionId);
  } else {
    const [identity] = await db
      .select({
        id: contentItems.id,
        key: contentItems.key,
        publishedVersionId: contentItems.publishedVersionId,
      })
      .from(contentItems)
      .where(eq(contentItems.id, contentId))
      .limit(1);
    if (identity?.publishedVersionId) {
      content = await getPinnedLearningContent(contentId, identity.publishedVersionId);
    }
  }
  if (!content) {
    return null;
  }
  const [card] = await db
    .select()
    .from(learningCards)
    .where(and(eq(learningCards.userId, userId), eq(learningCards.contentId, contentId)))
    .limit(1);
  return { content, card: card ?? null };
}

export async function getLearningOverview(
  user: SessionUser,
  kind: ContentKind
): Promise<LearningOverview> {
  const rows = await db
    .select({
      content: contentVersions,
      contentId: contentItems.id,
      card: learningCards,
    })
    .from(contentItems)
    .innerJoin(contentVersions, eq(contentVersions.id, contentItems.publishedVersionId))
    .leftJoin(
      learningCards,
      and(eq(learningCards.contentId, contentItems.id), eq(learningCards.userId, user.id))
    )
    .where(and(eq(contentVersions.kind, kind), eq(contentVersions.grade, user.grade)))
    .orderBy(asc(contentVersions.textbook), asc(contentVersions.unit), asc(contentItems.key));

  const mistakeRows = await db
    .select({
      cardId: reviewEvents.cardId,
      mistakeCount: sql<number>`count(*)`,
      lastMistakeAt: sql<Date>`max(${reviewEvents.createdAt})`,
    })
    .from(reviewEvents)
    .where(
      and(
        eq(reviewEvents.userId, user.id),
        eq(reviewEvents.correct, false),
        eq(reviewEvents.countsForMastery, true)
      )
    )
    .groupBy(reviewEvents.cardId);
  const mistakesByCard = new Map(mistakeRows.map((row) => [row.cardId, row]));
  const now = new Date();
  const masteryByCard = new Map(
    rows.flatMap((row) =>
      row.card ? ([[row.card.id, currentMastery(row.card, now)]] as const) : []
    )
  );
  const startedRows = rows.filter((row) => row.card && row.card.reps > 0);
  const masteredRows = startedRows.filter(
    (row) =>
      row.card !== null && (masteryByCard.get(row.card.id) ?? 0) >= 0.8 && row.card.stability >= 21
  );
  const dueRows = startedRows.filter((row) => row.card && row.card.due <= now);
  const delayedCorrect = startedRows.reduce(
    (sum, row) => sum + Number(row.card?.delayedCorrect ?? 0),
    0
  );
  const delayedAttempts = startedRows.reduce(
    (sum, row) => sum + Number(row.card?.delayedAttempts ?? 0),
    0
  );

  const units = new Map<string, LearningOverview['units'][number]>();
  for (const row of rows) {
    const key = `${row.content.textbook}\u0000${row.content.unit}`;
    const current = units.get(key) ?? {
      textbook: row.content.textbook,
      unit: row.content.unit,
      total: 0,
      started: 0,
      due: 0,
      mastered: 0,
      mastery: 0,
    };
    current.total += 1;
    if (row.card && row.card.reps > 0) {
      const mastery = masteryByCard.get(row.card.id) ?? 0;
      current.started += 1;
      current.mastery += mastery;
      if (row.card.due <= now) current.due += 1;
      if (mastery >= 0.8 && row.card.stability >= 21) current.mastered += 1;
    }
    units.set(key, current);
  }

  const mistakes: LearningMistake[] = rows
    .flatMap((row) => {
      if (!row.card) return [];
      const mistake = mistakesByCard.get(row.card.id);
      if (!mistake) return [];
      const content = presentContent(row.content);
      return [
        {
          contentId: row.contentId,
          kind: row.content.kind,
          title: content.title,
          detail: content.detail,
          textbook: row.content.textbook,
          unit: row.content.unit,
          mastery: Math.round((masteryByCard.get(row.card.id) ?? 0) * 100),
          mistakeCount: Number(mistake.mistakeCount),
          lastMistakeAt: new Date(mistake.lastMistakeAt).toISOString(),
          dueAt: row.card.due.toISOString(),
        },
      ];
    })
    .sort(
      (left, right) =>
        left.mastery - right.mastery ||
        new Date(right.lastMistakeAt).getTime() - new Date(left.lastMistakeAt).getTime()
    );

  return {
    kind,
    summary: {
      total: rows.length,
      newCount: rows.length - startedRows.length,
      learning: startedRows.length - masteredRows.length,
      due: dueRows.length,
      mastered: masteredRows.length,
      mastery:
        startedRows.length === 0
          ? 0
          : Math.round(
              (startedRows.reduce(
                (sum, row) => sum + (row.card ? (masteryByCard.get(row.card.id) ?? 0) : 0),
                0
              ) /
                startedRows.length) *
                100
            ),
      delayedAccuracy: percentage(delayedCorrect, delayedAttempts),
      mistakes: mistakes.length,
    },
    units: [...units.values()].map((unit) => ({
      ...unit,
      mastery: unit.started === 0 ? 0 : Math.round((unit.mastery / unit.started) * 100),
    })),
    mistakes,
  };
}

export async function getLearningSessionSummary(
  userId: string,
  sessionId: string
): Promise<LearningSessionSummary | null> {
  const [session] = await db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
    .limit(1);
  if (!session) return null;

  const events = await db
    .select({
      event: reviewEvents,
      card: learningCards,
      content: contentVersions,
      contentId: contentItems.id,
    })
    .from(reviewEvents)
    .innerJoin(learningCards, eq(learningCards.id, reviewEvents.cardId))
    .innerJoin(contentVersions, eq(contentVersions.id, reviewEvents.contentVersionId))
    .innerJoin(contentItems, eq(contentItems.id, contentVersions.contentId))
    .where(and(eq(reviewEvents.userId, userId), eq(reviewEvents.sessionId, sessionId)))
    .orderBy(asc(reviewEvents.createdAt));
  const correctCount = events.filter((row) => row.event.correct).length;
  const delayedEvents = events.filter((row) => row.event.delayed);
  const mistakeMap = new Map<string, LearningSessionSummary['mistakes'][number]>();
  for (const row of events) {
    if (row.event.correct) continue;
    const content = presentContent(row.content);
    mistakeMap.set(row.contentId, {
      contentId: row.contentId,
      kind: row.content.kind,
      title: content.title,
      detail: content.detail,
      unit: row.content.unit,
    });
  }
  const attemptSummary = summarizeAttemptSequences(
    events.map((row) => ({ contentId: row.contentId, correct: row.event.correct }))
  );

  return {
    id: session.id,
    kind: session.kind,
    mode: session.mode,
    status: session.status,
    plannedCount: session.plannedCount,
    completedCount: session.completedCount,
    correctCount,
    accuracy: percentage(correctCount, events.length),
    ...attemptSummary,
    averageResponseMs:
      events.length === 0
        ? 0
        : Math.round(events.reduce((sum, row) => sum + row.event.responseMs, 0) / events.length),
    delayedAccuracy:
      delayedEvents.length === 0
        ? null
        : percentage(delayedEvents.filter((row) => row.event.correct).length, delayedEvents.length),
    averageMastery:
      events.length === 0
        ? 0
        : Math.round(
            (events.reduce((sum, row) => sum + currentMastery(row.card), 0) / events.length) * 100
          ),
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    mistakes: [...mistakeMap.values()],
  };
}

export async function getLearningInsights(userId: string, days: number): Promise<LearningInsights> {
  const now = new Date();
  const since = new Date(Date.now() - (days - 1) * 86_400_000);
  since.setHours(0, 0, 0, 0);
  const events = await db
    .select({
      createdAt: reviewEvents.createdAt,
      correct: reviewEvents.correct,
      delayed: reviewEvents.delayed,
      responseMs: reviewEvents.responseMs,
    })
    .from(reviewEvents)
    .where(and(eq(reviewEvents.userId, userId), gte(reviewEvents.createdAt, since)))
    .orderBy(asc(reviewEvents.createdAt));
  const byDate = new Map<string, { reviews: number; correct: number }>();
  for (const event of events) {
    const date = currentStudyDate(event.createdAt);
    const current = byDate.get(date) ?? { reviews: 0, correct: 0 };
    current.reviews += 1;
    if (event.correct) current.correct += 1;
    byDate.set(date, current);
  }
  const daily = Array.from({ length: days }, (_, index) => {
    const date = currentStudyDate(new Date(Date.now() - (days - index - 1) * 86_400_000));
    const value = byDate.get(date) ?? { reviews: 0, correct: 0 };
    return { date, reviews: value.reviews, accuracy: percentage(value.correct, value.reviews) };
  });
  const delayedEvents = events.filter((event) => event.delayed);

  const memoryRows = await db
    .select({
      kind: contentVersions.kind,
      unit: contentVersions.unit,
      card: learningCards,
    })
    .from(learningCards)
    .innerJoin(contentItems, eq(contentItems.id, learningCards.contentId))
    .innerJoin(contentVersions, eq(contentVersions.id, contentItems.publishedVersionId))
    .where(eq(learningCards.userId, userId));
  const weakUnitMap = new Map<
    string,
    {
      kind: ContentKind;
      unit: string;
      cardCount: number;
      due: number;
      mastery: number;
      lapses: number;
    }
  >();
  for (const row of memoryRows) {
    if (row.card.reps === 0) continue;
    const key = `${row.kind}:${row.unit}`;
    const unit = weakUnitMap.get(key) ?? {
      kind: row.kind,
      unit: row.unit,
      cardCount: 0,
      due: 0,
      mastery: 0,
      lapses: 0,
    };
    unit.cardCount += 1;
    unit.due += row.card.due <= now ? 1 : 0;
    unit.mastery += currentMastery(row.card, now);
    unit.lapses += row.card.lapses;
    weakUnitMap.set(key, unit);
  }
  const weakUnits = [...weakUnitMap.values()]
    .map((unit) => ({
      ...unit,
      mastery: Math.round((unit.mastery / unit.cardCount) * 100),
    }))
    .sort((left, right) => left.mastery - right.mastery || right.lapses - left.lapses)
    .slice(0, 6);
  const forecast = buildReviewForecast(
    memoryRows.map((row) => ({ kind: row.kind, due: row.card.due, reps: row.card.reps })),
    7,
    now
  );

  const sessionRows = await db
    .select({
      id: studySessions.id,
      kind: studySessions.kind,
      mode: studySessions.mode,
      status: studySessions.status,
      plannedCount: studySessions.plannedCount,
      completedCount: studySessions.completedCount,
      startedAt: studySessions.startedAt,
      completedAt: studySessions.completedAt,
      eventCount: sql<number>`count(${reviewEvents.id})`,
      correctCount: sql<number>`count(${reviewEvents.id}) filter (where ${reviewEvents.correct} = true)`,
      delayedCount: sql<number>`count(${reviewEvents.id}) filter (where ${reviewEvents.delayed} = true)`,
      delayedCorrect: sql<number>`count(${reviewEvents.id}) filter (where ${reviewEvents.delayed} = true and ${reviewEvents.correct} = true)`,
      averageResponseMs: sql<number>`coalesce(avg(${reviewEvents.responseMs}), 0)`,
    })
    .from(studySessions)
    .leftJoin(reviewEvents, eq(reviewEvents.sessionId, studySessions.id))
    .where(eq(studySessions.userId, userId))
    .groupBy(studySessions.id)
    .orderBy(desc(studySessions.startedAt))
    .limit(8);
  const sessionIds = sessionRows.map((session) => session.id);
  const sessionEvents =
    sessionIds.length === 0
      ? []
      : await db
          .select({
            sessionId: reviewEvents.sessionId,
            contentId: contentVersions.contentId,
            correct: reviewEvents.correct,
            card: learningCards,
          })
          .from(reviewEvents)
          .innerJoin(contentVersions, eq(contentVersions.id, reviewEvents.contentVersionId))
          .innerJoin(learningCards, eq(learningCards.id, reviewEvents.cardId))
          .where(and(eq(reviewEvents.userId, userId), inArray(reviewEvents.sessionId, sessionIds)))
          .orderBy(asc(reviewEvents.createdAt));
  const attemptsBySession = new Map<string, { contentId: string; correct: boolean }[]>();
  const masteryBySession = new Map<string, number[]>();
  for (const event of sessionEvents) {
    if (!event.sessionId) continue;
    const attempts = attemptsBySession.get(event.sessionId) ?? [];
    attempts.push({ contentId: event.contentId, correct: event.correct });
    attemptsBySession.set(event.sessionId, attempts);
    const mastery = masteryBySession.get(event.sessionId) ?? [];
    mastery.push(currentMastery(event.card, now));
    masteryBySession.set(event.sessionId, mastery);
  }

  return {
    periodDays: days,
    metrics: {
      reviewCount: events.length,
      accuracy: percentage(events.filter((event) => event.correct).length, events.length),
      delayedAccuracy: percentage(
        delayedEvents.filter((event) => event.correct).length,
        delayedEvents.length
      ),
      averageResponseMs:
        events.length === 0
          ? 0
          : Math.round(events.reduce((sum, event) => sum + event.responseMs, 0) / events.length),
      activeDays: byDate.size,
    },
    daily,
    forecast,
    weakUnits,
    recentSessions: sessionRows.map((session) => {
      const eventCount = Number(session.eventCount);
      const delayedCount = Number(session.delayedCount);
      const sessionMastery = masteryBySession.get(session.id) ?? [];
      return {
        id: session.id,
        kind: session.kind,
        mode: session.mode,
        status: session.status,
        plannedCount: session.plannedCount,
        completedCount: session.completedCount,
        correctCount: Number(session.correctCount),
        accuracy: percentage(Number(session.correctCount), eventCount),
        ...summarizeAttemptSequences(attemptsBySession.get(session.id) ?? []),
        averageResponseMs: Math.round(Number(session.averageResponseMs)),
        delayedAccuracy:
          delayedCount === 0 ? null : percentage(Number(session.delayedCorrect), delayedCount),
        averageMastery:
          sessionMastery.length === 0
            ? 0
            : Math.round(
                (sessionMastery.reduce((sum, mastery) => sum + mastery, 0) /
                  sessionMastery.length) *
                  100
              ),
        startedAt: session.startedAt.toISOString(),
        completedAt: session.completedAt?.toISOString() ?? null,
      };
    }),
  };
}
