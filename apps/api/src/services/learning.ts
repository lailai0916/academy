import { and, asc, desc, eq, gte, inArray, lte, notExists, sql } from 'drizzle-orm';
import { fsrs, Rating, type Card, type Grade } from 'ts-fsrs';
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
  dailyPlans,
  learningCards,
  reviewEvents,
  studySessions,
} from '../db/schema.js';
import { currentStudyDate, getOrCreateDailyPlan } from './dashboard.js';
import { getActiveLearningSession, presentActiveLearningSession } from './study-sessions.js';

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 3650,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
});

type StoredCard = typeof learningCards.$inferSelect;
type StoredContent = typeof contentItems.$inferSelect;

type SessionOptions = {
  mode: 'plan' | 'review' | 'diagnostic';
  focus: 'all' | 'mistakes';
  unit?: string;
  limit?: number;
};

function toFsrsCard(card: StoredCard): Card {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.lastReview ?? undefined,
  } as Card;
}

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

function computeMastery(card: Card, now: Date) {
  const retrievability = scheduler.get_retrievability(card, now, false);
  const stabilityScore = 1 - Math.exp(-card.stability / 30);
  return Math.max(0, Math.min(1, stabilityScore * 0.65 + retrievability * 0.35));
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

function presentContent(content: StoredContent) {
  if (content.kind === 'word') {
    const payload = content.payload as WordPayload;
    return { title: payload.headword, detail: payload.meanings[0] ?? '' };
  }
  const payload = content.payload as PoemPayload;
  return { title: `《${payload.title}》`, detail: `${payload.dynasty} · ${payload.author}` };
}

function percentage(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
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
  content: StoredContent,
  card: StoredCard,
  progress: LearningPrompt['progress']
): Promise<LearningPrompt & { acceptedAnswers: string[]; explanation: string }> {
  if (content.kind === 'word') {
    const payload = content.payload as WordPayload;
    const promptType =
      card.reps === 0 ? 'meaning_choice' : card.mastery < 0.55 ? 'spelling' : 'context';
    if (promptType === 'meaning_choice') {
      const alternatives = await db
        .select({ payload: contentItems.payload })
        .from(contentItems)
        .where(
          and(
            eq(contentItems.kind, 'word'),
            eq(contentItems.grade, content.grade),
            eq(contentItems.status, 'published'),
            sql`${contentItems.id} <> ${content.id}`
          )
        )
        .orderBy(
          sql`case when ${contentItems.unit} = ${content.unit} then 0 else 1 end`,
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
  if (card.mastery >= 0.62) {
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
    const mistakes = await db
      .select({ id: contentItems.id })
      .from(reviewEvents)
      .innerJoin(learningCards, eq(learningCards.id, reviewEvents.cardId))
      .innerJoin(contentItems, eq(contentItems.id, learningCards.contentId))
      .where(
        and(
          eq(reviewEvents.userId, user.id),
          eq(reviewEvents.correct, false),
          eq(contentItems.kind, kind),
          eq(contentItems.grade, user.grade),
          eq(contentItems.status, 'published'),
          unit ? eq(contentItems.unit, unit) : undefined
        )
      )
      .groupBy(contentItems.id, learningCards.mastery, learningCards.due)
      .orderBy(asc(learningCards.mastery), desc(sql`max(${reviewEvents.createdAt})`))
      .limit(limit);
    if (mistakes.length === 0) {
      return null;
    }
    return persistLearningSession({
      userId: user.id,
      kind,
      mode: 'review',
      plannedCount: mistakes.length,
      contentQueue: mistakes.map((item) => item.id),
    });
  }

  if (mode === 'diagnostic') {
    const diagnosticPool = await db
      .select({
        id: contentItems.id,
        textbook: contentItems.textbook,
        unit: contentItems.unit,
      })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.kind, kind),
          eq(contentItems.grade, user.grade),
          eq(contentItems.status, 'published'),
          unit ? eq(contentItems.unit, unit) : undefined
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
    });
  }

  const due = await db
    .select({ id: contentItems.id })
    .from(learningCards)
    .innerJoin(contentItems, eq(contentItems.id, learningCards.contentId))
    .where(
      and(
        eq(learningCards.userId, user.id),
        eq(contentItems.kind, kind),
        eq(contentItems.grade, user.grade),
        eq(contentItems.status, 'published'),
        unit ? eq(contentItems.unit, unit) : undefined,
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
          .select({ id: contentItems.id })
          .from(contentItems)
          .where(
            and(
              eq(contentItems.kind, kind),
              eq(contentItems.grade, user.grade),
              eq(contentItems.status, 'published'),
              unit ? eq(contentItems.unit, unit) : undefined,
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
  const queue = [...due, ...fresh].map((item) => item.id);
  if (queue.length === 0) {
    return null;
  }
  return persistLearningSession({
    userId: user.id,
    kind,
    mode,
    plannedCount: queue.length,
    contentQueue: queue,
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
  if (!contentId) {
    return null;
  }
  const [content] = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, contentId))
    .limit(1);
  if (!content) {
    throw new Error('Session content is missing.');
  }
  const card = await ensureCard(userId, content.id);
  const prompt = await buildPrompt(session.id, content, card, {
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
    session.contentQueue[session.completedCount] !== input.contentId
  ) {
    return null;
  }
  const [content] = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, input.contentId))
    .limit(1);
  if (!content) {
    return null;
  }
  const card = await ensureCard(user.id, content.id);
  const prompt = await buildPrompt(session.id, content, card, {
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
  const result = scheduler.next(toFsrsCard(card), now, rating);
  const mastery = computeMastery(result.card, now);
  const delayed = Boolean(
    card.lastReview && now.getTime() - card.lastReview.getTime() >= 86_400_000
  );
  const completedCount = session.completedCount + 1;
  const sessionComplete = completedCount >= session.plannedCount;

  try {
    await db.transaction(async (transaction) => {
      const [claimedSession] = await transaction
        .update(studySessions)
        .set({
          completedCount,
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
      await transaction
        .update(learningCards)
        .set({
          due: result.card.due,
          stability: result.card.stability,
          difficulty: result.card.difficulty,
          elapsedDays: result.card.elapsed_days,
          scheduledDays: result.card.scheduled_days,
          learningSteps: result.card.learning_steps,
          reps: result.card.reps,
          lapses: result.card.lapses,
          state: result.card.state,
          lastReview: result.card.last_review ?? null,
          mastery,
          delayedAttempts: delayed ? card.delayedAttempts + 1 : card.delayedAttempts,
          delayedCorrect: delayed && correct ? card.delayedCorrect + 1 : card.delayedCorrect,
          updatedAt: now,
        })
        .where(eq(learningCards.id, card.id));
      await transaction.insert(reviewEvents).values({
        userId: user.id,
        cardId: card.id,
        sessionId: session.id,
        rating,
        correct,
        responseMs: input.responseMs,
        promptType: prompt.promptType,
        delayed,
        stabilityBefore: card.stability,
        stabilityAfter: result.card.stability,
        difficultyBefore: card.difficulty,
        difficultyAfter: result.card.difficulty,
      });
      if (session.mode === 'plan') {
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
          summary: `完成了 ${session.plannedCount} 项${session.kind === 'word' ? '单词' : '古诗词'}练习`,
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
    mastery: Math.round(mastery * 100),
    nextDueAt: result.card.due.toISOString(),
    rating: ratingName(rating),
    sessionComplete,
  };
}

export async function getContentForAi(userId: string, contentId: string) {
  const [content] = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, contentId))
    .limit(1);
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
      content: contentItems,
      cardId: learningCards.id,
      due: learningCards.due,
      mastery: learningCards.mastery,
      reps: learningCards.reps,
      stability: learningCards.stability,
      delayedCorrect: learningCards.delayedCorrect,
      delayedAttempts: learningCards.delayedAttempts,
    })
    .from(contentItems)
    .leftJoin(
      learningCards,
      and(eq(learningCards.contentId, contentItems.id), eq(learningCards.userId, user.id))
    )
    .where(
      and(
        eq(contentItems.kind, kind),
        eq(contentItems.grade, user.grade),
        eq(contentItems.status, 'published')
      )
    )
    .orderBy(asc(contentItems.textbook), asc(contentItems.unit), asc(contentItems.key));

  const mistakeRows = await db
    .select({
      cardId: reviewEvents.cardId,
      mistakeCount: sql<number>`count(*)`,
      lastMistakeAt: sql<Date>`max(${reviewEvents.createdAt})`,
    })
    .from(reviewEvents)
    .where(and(eq(reviewEvents.userId, user.id), eq(reviewEvents.correct, false)))
    .groupBy(reviewEvents.cardId);
  const mistakesByCard = new Map(mistakeRows.map((row) => [row.cardId, row]));
  const now = Date.now();
  const startedRows = rows.filter((row) => row.cardId && row.reps && row.reps > 0);
  const masteredRows = startedRows.filter(
    (row) => Number(row.mastery) >= 0.8 && Number(row.stability) >= 21
  );
  const dueRows = startedRows.filter((row) => row.due && row.due.getTime() <= now);
  const delayedCorrect = startedRows.reduce((sum, row) => sum + Number(row.delayedCorrect ?? 0), 0);
  const delayedAttempts = startedRows.reduce(
    (sum, row) => sum + Number(row.delayedAttempts ?? 0),
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
    if (row.cardId && Number(row.reps) > 0) {
      current.started += 1;
      current.mastery += Number(row.mastery ?? 0);
      if (row.due && row.due.getTime() <= now) current.due += 1;
      if (Number(row.mastery) >= 0.8 && Number(row.stability) >= 21) current.mastered += 1;
    }
    units.set(key, current);
  }

  const mistakes: LearningMistake[] = rows
    .flatMap((row) => {
      if (!row.cardId) return [];
      const mistake = mistakesByCard.get(row.cardId);
      if (!mistake || !row.due) return [];
      const content = presentContent(row.content);
      return [
        {
          contentId: row.content.id,
          kind: row.content.kind,
          title: content.title,
          detail: content.detail,
          textbook: row.content.textbook,
          unit: row.content.unit,
          mastery: Math.round(Number(row.mastery ?? 0) * 100),
          mistakeCount: Number(mistake.mistakeCount),
          lastMistakeAt: new Date(mistake.lastMistakeAt).toISOString(),
          dueAt: row.due.toISOString(),
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
              (startedRows.reduce((sum, row) => sum + Number(row.mastery ?? 0), 0) /
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
      cardMastery: learningCards.mastery,
      content: contentItems,
    })
    .from(reviewEvents)
    .innerJoin(learningCards, eq(learningCards.id, reviewEvents.cardId))
    .innerJoin(contentItems, eq(contentItems.id, learningCards.contentId))
    .where(and(eq(reviewEvents.userId, userId), eq(reviewEvents.sessionId, sessionId)))
    .orderBy(asc(reviewEvents.createdAt));
  const correctCount = events.filter((row) => row.event.correct).length;
  const delayedEvents = events.filter((row) => row.event.delayed);
  const mistakeMap = new Map<string, LearningSessionSummary['mistakes'][number]>();
  for (const row of events) {
    if (row.event.correct) continue;
    const content = presentContent(row.content);
    mistakeMap.set(row.content.id, {
      contentId: row.content.id,
      kind: row.content.kind,
      title: content.title,
      detail: content.detail,
      unit: row.content.unit,
    });
  }

  return {
    id: session.id,
    kind: session.kind,
    mode: session.mode,
    status: session.status,
    plannedCount: session.plannedCount,
    completedCount: session.completedCount,
    correctCount,
    accuracy: percentage(correctCount, events.length),
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
            (events.reduce((sum, row) => sum + Number(row.cardMastery), 0) / events.length) * 100
          ),
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    mistakes: [...mistakeMap.values()],
  };
}

export async function getLearningInsights(userId: string, days: number): Promise<LearningInsights> {
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

  const weakRows = await db
    .select({
      kind: contentItems.kind,
      unit: contentItems.unit,
      cardCount: sql<number>`count(*)`,
      due: sql<number>`count(*) filter (where ${learningCards.due} <= now())`,
      mastery: sql<number>`coalesce(avg(${learningCards.mastery}), 0)`,
      lapses: sql<number>`coalesce(sum(${learningCards.lapses}), 0)`,
    })
    .from(learningCards)
    .innerJoin(contentItems, eq(contentItems.id, learningCards.contentId))
    .where(eq(learningCards.userId, userId))
    .groupBy(contentItems.kind, contentItems.unit)
    .orderBy(asc(sql`avg(${learningCards.mastery})`), desc(sql`sum(${learningCards.lapses})`))
    .limit(6);

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
      averageMastery: sql<number>`coalesce(avg(${learningCards.mastery}), 0)`,
    })
    .from(studySessions)
    .leftJoin(reviewEvents, eq(reviewEvents.sessionId, studySessions.id))
    .leftJoin(learningCards, eq(learningCards.id, reviewEvents.cardId))
    .where(eq(studySessions.userId, userId))
    .groupBy(studySessions.id)
    .orderBy(desc(studySessions.startedAt))
    .limit(8);

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
    weakUnits: weakRows.map((row) => ({
      kind: row.kind,
      unit: row.unit,
      cardCount: Number(row.cardCount),
      due: Number(row.due),
      mastery: Math.round(Number(row.mastery) * 100),
      lapses: Number(row.lapses),
    })),
    recentSessions: sessionRows.map((session) => {
      const eventCount = Number(session.eventCount);
      const delayedCount = Number(session.delayedCount);
      return {
        id: session.id,
        kind: session.kind,
        mode: session.mode,
        status: session.status,
        plannedCount: session.plannedCount,
        completedCount: session.completedCount,
        correctCount: Number(session.correctCount),
        accuracy: percentage(Number(session.correctCount), eventCount),
        averageResponseMs: Math.round(Number(session.averageResponseMs)),
        delayedAccuracy:
          delayedCount === 0 ? null : percentage(Number(session.delayedCorrect), delayedCount),
        averageMastery: Math.round(Number(session.averageMastery) * 100),
        startedAt: session.startedAt.toISOString(),
        completedAt: session.completedAt?.toISOString() ?? null,
      };
    }),
  };
}
