import { fsrs, type Card, type Grade } from 'ts-fsrs';
import type { ContentKind } from '@lailai/academy-shared';

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 3650,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
});

export type StoredMemoryState = {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
};

export type ForecastCard = Pick<StoredMemoryState, 'due' | 'reps'> & {
  kind: ContentKind;
};

function toFsrsCard(card: StoredMemoryState): Card {
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

function masteryOfCard(card: Card, now: Date) {
  const retrievability = scheduler.get_retrievability(card, now, false);
  const stabilityScore = 1 - Math.exp(-card.stability / 30);
  return Math.max(0, Math.min(1, stabilityScore * 0.65 + retrievability * 0.35));
}

export function currentMastery(card: StoredMemoryState, now = new Date()) {
  if (card.reps === 0) return 0;
  return masteryOfCard(toFsrsCard(card), now);
}

export function reviewMemory(card: StoredMemoryState, now: Date, rating: Grade) {
  const before = toFsrsCard(card);
  const result = scheduler.next(before, now, rating);
  return {
    card: result.card,
    masteryBefore: masteryOfCard(before, now),
    masteryAfter: masteryOfCard(result.card, now),
  };
}

const shanghaiDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function studyDate(date: Date) {
  return shanghaiDate.format(date);
}

export function buildReviewForecast(cards: ForecastCard[], days = 7, now = new Date()) {
  const length = Math.max(1, Math.floor(days));
  const forecast = Array.from({ length }, (_, index) => ({
    date: studyDate(new Date(now.getTime() + index * 86_400_000)),
    word: 0,
    poem: 0,
    total: 0,
  }));
  const indexByDate = new Map(forecast.map((day, index) => [day.date, index]));

  for (const card of cards) {
    if (card.reps === 0) continue;
    const dueDate = card.due <= now ? forecast[0]!.date : studyDate(card.due);
    const index = indexByDate.get(dueDate);
    if (index === undefined) continue;
    forecast[index]![card.kind] += 1;
    forecast[index]!.total += 1;
  }

  return forecast;
}
