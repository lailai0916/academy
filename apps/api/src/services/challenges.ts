export type ChallengeMetric = 'review_count' | 'mastery_gain' | 'delayed_accuracy';

export type ChallengeProgressEvent = {
  id: string;
  userId: string;
  cardId: string;
  sessionId: string | null;
  correct: boolean;
  delayed: boolean;
  masteryBefore: number;
  masteryAfter: number;
};

type ProgressValue = {
  value: number;
  eventCount: number;
};

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function metricValue(metric: ChallengeMetric, events: ChallengeProgressEvent[]): ProgressValue {
  if (metric === 'review_count') {
    const uniqueItems = new Set(
      events.map((event) =>
        event.sessionId
          ? `${event.userId}:${event.sessionId}:${event.cardId}`
          : `${event.userId}:${event.id}`
      )
    );
    return { value: uniqueItems.size, eventCount: uniqueItems.size };
  }

  if (metric === 'mastery_gain') {
    return {
      value: round(
        events.reduce(
          (total, event) => total + Math.max(0, event.masteryAfter - event.masteryBefore) * 100,
          0
        )
      ),
      eventCount: events.length,
    };
  }

  const delayedEvents = events.filter((event) => event.delayed);
  const correct = delayedEvents.filter((event) => event.correct).length;
  return {
    value: delayedEvents.length === 0 ? 0 : round((correct / delayedEvents.length) * 100),
    eventCount: delayedEvents.length,
  };
}

export function summarizeChallengeProgress(
  metric: ChallengeMetric,
  targetValue: number,
  minimumSamples: number,
  events: ChallengeProgressEvent[],
  viewerId: string,
  endsAt: Date,
  now = new Date()
) {
  const group = metricValue(metric, events);
  const personal = metricValue(
    metric,
    events.filter((event) => event.userId === viewerId)
  );
  const valueProgress = targetValue <= 0 ? 0 : group.value / targetValue;
  const sampleProgress =
    metric === 'delayed_accuracy' ? group.eventCount / Math.max(1, minimumSamples) : 1;
  const completed = valueProgress >= 1 && sampleProgress >= 1;

  return {
    progressValue: group.value,
    progressPercent: Math.round(Math.min(1, valueProgress, sampleProgress) * 100),
    qualifyingEventCount: group.eventCount,
    personalValue: personal.value,
    personalEventCount: personal.eventCount,
    status: completed
      ? ('completed' as const)
      : endsAt <= now
        ? ('ended' as const)
        : ('active' as const),
  };
}
