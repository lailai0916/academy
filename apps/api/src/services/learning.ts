import { and, asc, eq, inArray, lte, notExists, sql } from 'drizzle-orm';
import { fsrs, Rating, type Card, type Grade } from 'ts-fsrs';
import type {
  ContentKind,
  LearningAnswerResult,
  LearningPrompt,
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

function chooseRating(
  correct: boolean,
  revealed: boolean,
  responseMs: number,
  reps: number
): Grade {
  if (!correct || revealed) {
    return Rating.Again;
  }
  if (responseMs > 18_000) {
    return Rating.Hard;
  }
  if (responseMs < 5_000 && reps > 1) {
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
        .where(and(eq(contentItems.kind, 'word'), sql`${contentItems.id} <> ${content.id}`))
        .orderBy(sql`random()`)
        .limit(3);
      const options = [
        payload.meanings[0],
        ...alternatives.map((item) => (item.payload as WordPayload).meanings[0]),
      ].sort(() => Math.random() - 0.5);
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
  if (card.reps >= 2) {
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

export async function createLearningSession(
  user: SessionUser,
  kind: ContentKind,
  mode: 'plan' | 'review' | 'diagnostic'
) {
  const plan = await getOrCreateDailyPlan(user);
  const desired =
    mode === 'diagnostic'
      ? 10
      : kind === 'word'
        ? plan.wordsDue + (mode === 'plan' ? plan.wordsNew : 0)
        : plan.poemsDue + (mode === 'plan' ? plan.poemsNew : 0);
  const limit = Math.max(1, Math.min(desired || 10, 30));

  const due = await db
    .select({ id: contentItems.id })
    .from(learningCards)
    .innerJoin(contentItems, eq(contentItems.id, learningCards.contentId))
    .where(
      and(
        eq(learningCards.userId, user.id),
        eq(contentItems.kind, kind),
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
          .orderBy(mode === 'diagnostic' ? sql`random()` : asc(contentItems.key))
          .limit(remaining);
  const queue = [...due, ...fresh].map((item) => item.id);
  if (queue.length === 0) {
    return null;
  }
  const [session] = await db
    .insert(studySessions)
    .values({
      userId: user.id,
      kind,
      mode,
      plannedCount: queue.length,
      contentQueue: queue,
    })
    .returning();
  return session;
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
  const rating = chooseRating(correct, input.revealed, input.responseMs, card.reps);
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
