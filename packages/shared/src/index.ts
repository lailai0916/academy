import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .min(3, '用户名至少需要 3 个字符。')
  .max(24, '用户名最多 24 个字符。')
  .regex(/^[a-zA-Z0-9_]+$/, '用户名仅能包含字母、数字和下划线。');

export const passwordSchema = z
  .string()
  .min(8, '密码至少需要 8 个字符。')
  .max(128, '密码最多 128 个字符。');

export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  inviteCode: z.string().trim().min(8, '请输入有效的邀请码。').max(64),
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, '请输入密码。').max(128),
});

export const gradeSchema = z.enum(['高一', '高二', '高三']);
export const roleSchema = z.enum(['admin', 'user']);
export const contentKindSchema = z.enum(['word', 'poem']);

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(24),
  bio: z.string().trim().max(160),
  grade: gradeSchema,
  targetScore: z.number().int().min(0).max(750),
  dailyGoal: z.number().int().min(5).max(100),
  isPublic: z.boolean(),
});

export const inviteCreateSchema = z.object({
  label: z.string().trim().min(1).max(40),
  maxUses: z.number().int().min(1).max(100),
  expiresInDays: z.number().int().min(1).max(365),
});

export const aiSettingsUpdateSchema = z.object({
  provider: z.string().trim().min(1).max(40),
  baseUrl: z
    .url()
    .max(300)
    .refine(
      (value) => ['http:', 'https:'].includes(new URL(value).protocol),
      '仅支持 HTTP(S) 地址。'
    ),
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().max(500).optional(),
});

export const wordPayloadSchema = z.object({
  headword: z.string().trim().min(1).max(80),
  phonetic: z.string().trim().max(120).default(''),
  meanings: z.array(z.string().trim().min(1).max(160)).min(1).max(12),
  example: z.string().trim().max(400).default(''),
  exampleTranslation: z.string().trim().max(400).default(''),
  aliases: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
});

export const poemPayloadSchema = z.object({
  title: z.string().trim().min(1).max(100),
  author: z.string().trim().min(1).max(80),
  dynasty: z.string().trim().min(1).max(40),
  lines: z.array(z.string().trim().min(1).max(120)).min(2).max(80),
  translation: z.string().trim().max(2000).default(''),
  notes: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
  keyPoints: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
});

const contentImportBaseSchema = z.object({
  key: z.string().trim().min(1).max(120),
  grade: gradeSchema,
  textbook: z.string().trim().min(1).max(80),
  unit: z.string().trim().min(1).max(120),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export const contentImportItemSchema = z.discriminatedUnion('kind', [
  contentImportBaseSchema.extend({ kind: z.literal('word'), payload: wordPayloadSchema }),
  contentImportBaseSchema.extend({ kind: z.literal('poem'), payload: poemPayloadSchema }),
]);

export const contentImportSchema = z.object({
  items: z.array(contentImportItemSchema).min(1).max(500),
});

export const learningSessionCreateSchema = z.object({
  kind: contentKindSchema,
  mode: z.enum(['plan', 'review', 'diagnostic']).default('plan'),
});

export const learningAnswerSchema = z.object({
  contentId: z.uuid(),
  answer: z.string().trim().max(500),
  responseMs: z.number().int().min(0).max(3_600_000),
  revealed: z.boolean().default(false),
});

export const explanationRequestSchema = z.object({
  contentId: z.uuid(),
  prompt: z.string().trim().max(500).default(''),
  previousAnswer: z.string().trim().max(500).default(''),
});

export const postCreateSchema = z.object({
  body: z.string().trim().min(1).max(500),
  groupId: z.uuid().nullable().default(null),
  visibility: z.enum(['platform', 'friends', 'group']).default('platform'),
});

export const reactionSchema = z.object({
  kind: z.enum(['support', 'insight', 'together']),
});

export const friendRequestSchema = z.object({
  username: usernameSchema,
});

export const groupCreateSchema = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(200),
});

export const challengeCreateSchema = z.object({
  groupId: z.uuid(),
  title: z.string().trim().min(2).max(80),
  metric: z.enum(['review_count', 'mastery_gain', 'delayed_accuracy']),
  targetValue: z.number().int().min(1).max(10_000),
  days: z.number().int().min(1).max(60),
});

export type UserRole = z.infer<typeof roleSchema>;
export type ContentKind = z.infer<typeof contentKindSchema>;
export type Grade = z.infer<typeof gradeSchema>;
export type WordPayload = z.infer<typeof wordPayloadSchema>;
export type PoemPayload = z.infer<typeof poemPayloadSchema>;
export type ContentImportItem = z.infer<typeof contentImportItemSchema>;

export type SessionUser = {
  id: string;
  username: string;
  role: UserRole;
  displayName: string;
  grade: Grade;
};

export type Profile = SessionUser & {
  bio: string;
  targetScore: number;
  dailyGoal: number;
  isPublic: boolean;
  createdAt: string;
  mastery: number;
  delayedAccuracy: number;
  reviewCount: number;
};

export type DailyPlan = {
  date: string;
  wordsDue: number;
  wordsNew: number;
  poemsDue: number;
  poemsNew: number;
  completed: number;
  total: number;
  reason: string;
};

export type Dashboard = {
  user: SessionUser;
  plan: DailyPlan;
  metrics: {
    mastery: number;
    delayedAccuracy: number;
    longTermCards: number;
    streakDays: number;
  };
  recentActivity: ActivityItem[];
};

export type ActivityItem = {
  id: string;
  user: Pick<SessionUser, 'username' | 'displayName'>;
  kind: string;
  summary: string;
  createdAt: string;
};

export type LearningPrompt = {
  sessionId: string;
  contentId: string;
  kind: ContentKind;
  promptType: 'meaning_choice' | 'spelling' | 'context' | 'next_line' | 'fill_blank';
  title: string;
  prompt: string;
  context?: string;
  options?: string[];
  progress: {
    completed: number;
    total: number;
  };
};

export type LearningAnswerResult = {
  correct: boolean;
  expectedAnswer: string;
  acceptedAnswers: string[];
  explanation: string;
  mastery: number;
  nextDueAt: string;
  rating: 'again' | 'hard' | 'good' | 'easy';
  sessionComplete: boolean;
};

export type SocialPost = {
  id: string;
  author: Pick<SessionUser, 'username' | 'displayName'>;
  body: string;
  group: { id: string; name: string } | null;
  visibility: 'platform' | 'friends' | 'group';
  reactions: Record<'support' | 'insight' | 'together', number>;
  reacted: string[];
  createdAt: string;
};

export type StudyGroup = {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  joined: boolean;
  ownerUsername: string;
};

export type Challenge = {
  id: string;
  groupId: string;
  title: string;
  metric: 'review_count' | 'mastery_gain' | 'delayed_accuracy';
  targetValue: number;
  participantCount: number;
  joined: boolean;
  endsAt: string;
};

export type Invite = {
  id: string;
  label: string;
  code?: string;
  uses: number;
  maxUses: number;
  expiresAt: string;
  revoked: boolean;
};

export type AiSettings = {
  provider: string;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  updatedAt: string | null;
};

export type ApiError = {
  error: string;
  details?: Record<string, string[]>;
};
