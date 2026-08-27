import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { PoemPayload, WordPayload } from '@lailai/academy-shared';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const userRole = pgEnum('user_role', ['admin', 'user']);
export const userStatus = pgEnum('user_status', ['active', 'disabled']);
export const grade = pgEnum('grade', ['高一', '高二', '高三']);
export const contentKind = pgEnum('content_kind', ['word', 'poem']);
export const contentStatus = pgEnum('content_status', ['draft', 'published', 'archived']);
export const contentChangeKind = pgEnum('content_change_kind', [
  'imported',
  'edited',
  'published',
  'archived',
  'restored',
  'seeded',
]);
export const sessionStatus = pgEnum('study_session_status', ['active', 'completed', 'abandoned']);
export const sessionMode = pgEnum('study_session_mode', ['plan', 'review', 'diagnostic']);
export const friendshipStatus = pgEnum('friendship_status', ['pending', 'accepted', 'declined']);
export const groupRole = pgEnum('group_role', ['owner', 'moderator', 'member']);
export const postVisibility = pgEnum('post_visibility', ['platform', 'friends', 'group']);
export const reactionKind = pgEnum('reaction_kind', ['support', 'insight', 'together']);
export const challengeMetric = pgEnum('challenge_metric', [
  'review_count',
  'mastery_gain',
  'delayed_accuracy',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', { length: 24 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull().default('user'),
    status: userStatus('status').notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex('users_username_unique').on(table.username)]
);

export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 24 }).notNull(),
  bio: varchar('bio', { length: 160 }).notNull().default(''),
  grade: grade('grade').notNull().default('高一'),
  targetScore: integer('target_score').notNull().default(600),
  dailyGoal: integer('daily_goal').notNull().default(20),
  isPublic: boolean('is_public').notNull().default(true),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  ...timestamps,
});

export const invites = pgTable(
  'invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    codeHash: varchar('code_hash', { length: 64 }).notNull(),
    label: varchar('label', { length: 40 }).notNull(),
    maxUses: integer('max_uses').notNull().default(1),
    uses: integer('uses').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('invites_code_hash_unique').on(table.codeHash)]
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').notNull().defaultRandom(),
    tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userAgent: varchar('user_agent', { length: 300 }).notNull().default(''),
    ipAddress: varchar('ip_address', { length: 64 }).notNull().default(''),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('auth_sessions_id_unique').on(table.id),
    index('auth_sessions_user_idx').on(table.userId),
  ]
);

export const aiSettings = pgTable('ai_settings', {
  id: smallint('id').primaryKey().default(1),
  provider: varchar('provider', { length: 40 }).notNull().default('OpenAI Compatible'),
  baseUrl: varchar('base_url', { length: 300 }).notNull().default('https://api.openai.com/v1'),
  model: varchar('model', { length: 120 }).notNull().default('gpt-5.6-sol'),
  encryptedApiKey: text('encrypted_api_key').notNull().default(''),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
});

export const contentImports = pgTable(
  'content_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    source: varchar('source', { length: 120 }).notNull(),
    sourceVersion: varchar('source_version', { length: 80 }).notNull().default(''),
    targetStatus: contentStatus('target_status').notNull(),
    fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
    itemCount: integer('item_count').notNull(),
    createdCount: integer('created_count').notNull(),
    updatedCount: integer('updated_count').notNull(),
    unchangedCount: integer('unchanged_count').notNull(),
    rolledBackAt: timestamp('rolled_back_at', { withTimezone: true }),
    rolledBackBy: uuid('rolled_back_by').references(() => users.id, { onDelete: 'set null' }),
    rollbackRevertedCount: integer('rollback_reverted_count').notNull().default(0),
    rollbackSkippedCount: integer('rollback_skipped_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('content_imports_fingerprint_unique').on(table.fingerprint),
    index('content_imports_created_idx').on(table.createdAt),
  ]
);

export const contentItems = pgTable(
  'content_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 120 }).notNull(),
    kind: contentKind('kind').notNull(),
    grade: grade('grade').notNull(),
    textbook: varchar('textbook', { length: 80 }).notNull(),
    unit: varchar('unit', { length: 120 }).notNull(),
    tags: text('tags').array().notNull().default([]),
    payload: jsonb('payload').$type<WordPayload | PoemPayload>().notNull(),
    status: contentStatus('status').notNull().default('published'),
    source: varchar('source', { length: 120 }).notNull().default('manual'),
    sourceVersion: varchar('source_version', { length: 80 }).notNull().default(''),
    importBatchId: uuid('import_batch_id').references(() => contentImports.id, {
      onDelete: 'set null',
    }),
    importedBy: uuid('imported_by').references(() => users.id, { onDelete: 'set null' }),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
    currentVersionId: uuid('current_version_id'),
    publishedVersionId: uuid('published_version_id'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('content_items_key_unique').on(table.key),
    index('content_items_kind_grade_idx').on(table.kind, table.grade),
  ]
);

export const contentVersions = pgTable(
  'content_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentId: uuid('content_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    kind: contentKind('kind').notNull(),
    grade: grade('grade').notNull(),
    textbook: varchar('textbook', { length: 80 }).notNull(),
    unit: varchar('unit', { length: 120 }).notNull(),
    tags: text('tags').array().notNull().default([]),
    payload: jsonb('payload').$type<WordPayload | PoemPayload>().notNull(),
    status: contentStatus('status').notNull(),
    source: varchar('source', { length: 120 }).notNull(),
    sourceVersion: varchar('source_version', { length: 80 }).notNull().default(''),
    semanticFingerprint: varchar('semantic_fingerprint', { length: 64 }).notNull(),
    semanticChange: boolean('semantic_change').notNull().default(false),
    changeKind: contentChangeKind('change_kind').notNull(),
    changeNote: varchar('change_note', { length: 300 }).notNull().default(''),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    importBatchId: uuid('import_batch_id').references(() => contentImports.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('content_versions_number_unique').on(table.contentId, table.versionNumber),
    index('content_versions_content_created_idx').on(table.contentId, table.createdAt),
  ]
);

export const learningCards = pgTable(
  'learning_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contentId: uuid('content_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    due: timestamp('due', { withTimezone: true }).notNull().defaultNow(),
    stability: doublePrecision('stability').notNull().default(0),
    difficulty: doublePrecision('difficulty').notNull().default(0),
    elapsedDays: integer('elapsed_days').notNull().default(0),
    scheduledDays: integer('scheduled_days').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    learningSteps: integer('learning_steps').notNull().default(0),
    state: smallint('state').notNull().default(0),
    lastReview: timestamp('last_review', { withTimezone: true }),
    mastery: doublePrecision('mastery').notNull().default(0),
    delayedCorrect: integer('delayed_correct').notNull().default(0),
    delayedAttempts: integer('delayed_attempts').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('learning_cards_user_content_unique').on(table.userId, table.contentId),
    index('learning_cards_user_due_idx').on(table.userId, table.due),
  ]
);

export const studySessions = pgTable(
  'study_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: contentKind('kind').notNull(),
    mode: sessionMode('mode').notNull(),
    status: sessionStatus('status').notNull().default('active'),
    plannedCount: integer('planned_count').notNull(),
    completedCount: integer('completed_count').notNull().default(0),
    contentQueue: uuid('content_queue').array().notNull().default([]),
    contentVersionQueue: uuid('content_version_queue').array().notNull().default([]),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('study_sessions_user_idx').on(table.userId, table.startedAt),
    uniqueIndex('study_sessions_user_active_unique')
      .on(table.userId)
      .where(sql`${table.status} = 'active'`),
  ]
);

export const reviewEvents = pgTable(
  'review_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id')
      .notNull()
      .references(() => learningCards.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => studySessions.id, { onDelete: 'set null' }),
    contentVersionId: uuid('content_version_id')
      .notNull()
      .references(() => contentVersions.id, { onDelete: 'restrict' }),
    rating: smallint('rating').notNull(),
    correct: boolean('correct').notNull(),
    responseMs: integer('response_ms').notNull(),
    promptType: varchar('prompt_type', { length: 30 }).notNull(),
    delayed: boolean('delayed').notNull().default(false),
    countsForMastery: boolean('counts_for_mastery').notNull().default(true),
    masteryBefore: doublePrecision('mastery_before').notNull().default(0),
    masteryAfter: doublePrecision('mastery_after').notNull().default(0),
    stabilityBefore: doublePrecision('stability_before').notNull(),
    stabilityAfter: doublePrecision('stability_after').notNull(),
    difficultyBefore: doublePrecision('difficulty_before').notNull(),
    difficultyAfter: doublePrecision('difficulty_after').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('review_events_user_created_idx').on(table.userId, table.createdAt)]
);

export const dailyPlans = pgTable(
  'daily_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planDate: date('plan_date').notNull(),
    wordsDue: integer('words_due').notNull().default(0),
    wordsNew: integer('words_new').notNull().default(0),
    poemsDue: integer('poems_due').notNull().default(0),
    poemsNew: integer('poems_new').notNull().default(0),
    completed: integer('completed').notNull().default(0),
    reason: varchar('reason', { length: 300 }).notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('daily_plans_user_date_unique').on(table.userId, table.planDate)]
);

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 40 }).notNull(),
    summary: varchar('summary', { length: 240 }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('activities_created_idx').on(table.createdAt)]
);

export const friendships = pgTable(
  'friendships',
  {
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: friendshipStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.requesterId, table.addresseeId] })]
);

export const studyGroups = pgTable(
  'study_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 40 }).notNull(),
    description: varchar('description', { length: 200 }).notNull().default(''),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [uniqueIndex('study_groups_name_unique').on(table.name)]
);

export const groupMembers = pgTable(
  'group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => studyGroups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: groupRole('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.userId] })]
);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => studyGroups.id, { onDelete: 'cascade' }),
    body: varchar('body', { length: 500 }).notNull(),
    visibility: postVisibility('visibility').notNull().default('platform'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('posts_created_idx').on(table.createdAt)]
);

export const postReactions = pgTable(
  'post_reactions',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: reactionKind('kind').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.userId, table.kind] })]
);

export const challenges = pgTable(
  'challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => studyGroups.id, { onDelete: 'cascade' }),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 80 }).notNull(),
    metric: challengeMetric('metric').notNull(),
    targetValue: integer('target_value').notNull(),
    minimumSamples: integer('minimum_samples').notNull().default(1),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('challenges_group_idx').on(table.groupId, table.endsAt)]
);

export const challengeParticipants = pgTable(
  'challenge_participants',
  {
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startingValue: doublePrecision('starting_value').notNull().default(0),
    currentValue: doublePrecision('current_value').notNull().default(0),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.challengeId, table.userId] })]
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 40 }).notNull(),
    title: varchar('title', { length: 120 }).notNull(),
    body: varchar('body', { length: 300 }).notNull(),
    link: varchar('link', { length: 240 }).notNull().default(''),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('notifications_user_idx').on(table.userId, table.createdAt)]
);
