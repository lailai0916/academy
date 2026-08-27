import type { ActiveLearningSession, ContentKind } from '@lailai/academy-shared';

export const learningKindLabels: Record<ContentKind, string> = {
  word: '英语单词',
  poem: '古诗词',
};

export const sessionModeLabels: Record<ActiveLearningSession['mode'], string> = {
  plan: '计划学习',
  review: '复习巩固',
  diagnostic: '水平诊断',
};

export const sessionStatusLabels = {
  active: '进行中',
  completed: '已完成',
  abandoned: '已结束',
} as const;

export const promptTypeLabels = {
  meaning_choice: '释义选择',
  spelling: '单词拼写',
  context: '语境填空',
  next_line: '诗句接写',
  fill_blank: '诗句补空',
} as const;

export const ratingLabels = {
  again: '需要重学',
  hard: '较为困难',
  good: '掌握良好',
  easy: '回忆熟练',
} as const;

export function formatSessionTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNextReview(value: string) {
  const date = new Date(value);
  const difference = date.getTime() - Date.now();
  const minutes = Math.max(1, Math.round(difference / 60_000));
  if (minutes < 60) return `${minutes} 分钟后`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时后`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} 天后`;
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}
