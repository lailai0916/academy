import { and, count, desc, eq, gte, inArray, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  onboardingProfileSchema,
  profileUpdateSchema,
  type ProfileRelationship,
  type ProfileView,
  type SocialPost,
} from '@lailai/academy-shared';
import { db } from '../db/index.js';
import {
  activities,
  courseRuns,
  friendships,
  groupMembers,
  learningCards,
  postReactions,
  posts,
  profiles,
  reviewEvents,
  studyGroups,
  users,
} from '../db/schema.js';
import { parseBody } from '../lib/http.js';
import { currentStudyDate } from '../services/dashboard.js';
import { currentMastery } from '../services/memory-model.js';

function countStreak(dates: Date[]) {
  const activeDates = new Set(dates.map((date) => currentStudyDate(date)));
  let cursor = new Date();
  let streak = 0;
  while (activeDates.has(currentStudyDate(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}

async function buildProfile(userId: string) {
  const [profile] = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      displayName: profiles.displayName,
      bio: profiles.bio,
      grade: profiles.grade,
      targetScore: profiles.targetScore,
      dailyGoal: profiles.dailyGoal,
      isPublic: profiles.isPublic,
      onboardingCompletedAt: profiles.onboardingCompletedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!profile) return null;

  const [memoryRows, recentReviews, completedCourseRows] = await Promise.all([
    db.select({ card: learningCards }).from(learningCards).where(eq(learningCards.userId, userId)),
    db
      .select({ createdAt: reviewEvents.createdAt })
      .from(reviewEvents)
      .where(
        and(
          eq(reviewEvents.userId, userId),
          gte(reviewEvents.createdAt, new Date(Date.now() - 90 * 86_400_000))
        )
      )
      .orderBy(desc(reviewEvents.createdAt)),
    db
      .select({ courseSlug: courseRuns.courseSlug })
      .from(courseRuns)
      .where(
        and(
          eq(courseRuns.userId, userId),
          eq(courseRuns.mode, 'lesson'),
          eq(courseRuns.status, 'completed')
        )
      ),
  ]);
  const now = new Date();
  const cards = memoryRows.map((row) => row.card).filter((card) => card.reps > 0);
  const mastery =
    cards.length === 0
      ? 0
      : cards.reduce((sum, card) => sum + currentMastery(card, now), 0) / cards.length;
  const delayedCorrect = cards.reduce((sum, card) => sum + card.delayedCorrect, 0);
  const attempts = cards.reduce((sum, card) => sum + card.delayedAttempts, 0);
  const { onboardingCompletedAt, ...identity } = profile;
  return {
    ...identity,
    onboardingComplete: Boolean(onboardingCompletedAt),
    createdAt: profile.createdAt.toISOString(),
    mastery: Math.round(mastery * 100),
    delayedAccuracy: attempts === 0 ? 0 : Math.round((delayedCorrect / attempts) * 100),
    reviewCount: cards.reduce((sum, card) => sum + card.reps, 0),
    longTermCards: cards.filter((card) => card.stability >= 21).length,
    completedCourses: new Set(completedCourseRows.map((row) => row.courseSlug)).size,
    streakDays: countStreak(recentReviews.map((row) => row.createdAt)),
  };
}

type FriendshipRow = typeof friendships.$inferSelect;

function describeRelationship(
  viewerId: string,
  targetId: string,
  friendship: FriendshipRow | undefined
): ProfileRelationship {
  if (viewerId === targetId) return 'self';
  if (!friendship) return 'none';
  if (friendship.status === 'accepted') return 'friends';
  return friendship.requesterId === targetId ? 'pending-incoming' : 'pending-outgoing';
}

async function findFriendship(viewerId: string, targetId: string) {
  if (viewerId === targetId) return undefined;
  const [friendship] = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, viewerId), eq(friendships.addresseeId, targetId)),
        and(eq(friendships.requesterId, targetId), eq(friendships.addresseeId, viewerId))
      )
    )
    .limit(1);
  return friendship;
}

async function buildProfileView(
  viewerId: string,
  targetId: string,
  friendship: FriendshipRow | undefined
): Promise<ProfileView | null> {
  const profile = await buildProfile(targetId);
  if (!profile) return null;
  const relationship = describeRelationship(viewerId, targetId, friendship);
  const [friendRows, targetMemberships, viewerMemberships, activityRows] = await Promise.all([
    db
      .select({ status: friendships.status })
      .from(friendships)
      .where(or(eq(friendships.requesterId, targetId), eq(friendships.addresseeId, targetId))),
    db
      .select({
        id: studyGroups.id,
        name: studyGroups.name,
        description: studyGroups.description,
        ownerUsername: users.username,
      })
      .from(groupMembers)
      .innerJoin(studyGroups, eq(studyGroups.id, groupMembers.groupId))
      .innerJoin(users, eq(users.id, studyGroups.ownerId))
      .where(eq(groupMembers.userId, targetId))
      .orderBy(desc(groupMembers.joinedAt)),
    db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, viewerId)),
    db
      .select({
        id: activities.id,
        kind: activities.kind,
        summary: activities.summary,
        createdAt: activities.createdAt,
      })
      .from(activities)
      .where(eq(activities.userId, targetId))
      .orderBy(desc(activities.createdAt))
      .limit(12),
  ]);
  const groupIds = targetMemberships.map((group) => group.id);
  const viewerGroupIds = viewerMemberships.map((membership) => membership.groupId);
  const visibility =
    relationship === 'self'
      ? undefined
      : or(
          eq(posts.visibility, 'platform'),
          relationship === 'friends' ? eq(posts.visibility, 'friends') : undefined,
          viewerGroupIds.length > 0
            ? and(eq(posts.visibility, 'group'), inArray(posts.groupId, viewerGroupIds))
            : undefined
        );
  const postCondition = and(eq(posts.authorId, targetId), visibility);
  const [postRows, postCountRows, groupCountRows] = await Promise.all([
    db
      .select({
        id: posts.id,
        body: posts.body,
        groupId: posts.groupId,
        groupName: studyGroups.name,
        visibility: posts.visibility,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .leftJoin(studyGroups, eq(studyGroups.id, posts.groupId))
      .where(postCondition)
      .orderBy(desc(posts.createdAt))
      .limit(24),
    db.select({ value: count() }).from(posts).where(postCondition),
    groupIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ groupId: groupMembers.groupId, value: count() })
          .from(groupMembers)
          .where(inArray(groupMembers.groupId, groupIds))
          .groupBy(groupMembers.groupId),
  ]);
  const reactions =
    postRows.length === 0
      ? []
      : await db
          .select()
          .from(postReactions)
          .where(
            inArray(
              postReactions.postId,
              postRows.map((post) => post.id)
            )
          );
  const profilePosts: SocialPost[] = postRows.map((post) => {
    const itemReactions = reactions.filter((reaction) => reaction.postId === post.id);
    return {
      id: post.id,
      author: { username: profile.username, displayName: profile.displayName },
      body: post.body,
      group: post.groupId && post.groupName ? { id: post.groupId, name: post.groupName } : null,
      visibility: post.visibility,
      reactions: {
        support: itemReactions.filter((reaction) => reaction.kind === 'support').length,
        insight: itemReactions.filter((reaction) => reaction.kind === 'insight').length,
        together: itemReactions.filter((reaction) => reaction.kind === 'together').length,
      },
      reacted: itemReactions
        .filter((reaction) => reaction.userId === viewerId)
        .map((reaction) => reaction.kind),
      createdAt: post.createdAt.toISOString(),
    };
  });
  const memberCounts = new Map(groupCountRows.map((row) => [row.groupId, Number(row.value)]));
  return {
    profile,
    relationship,
    stats: {
      friends: friendRows.filter((row) => row.status === 'accepted').length,
      posts: Number(postCountRows[0]?.value ?? 0),
      groups: targetMemberships.length,
    },
    posts: profilePosts,
    recentActivity: activityRows.map((activity) => ({
      ...activity,
      user: { username: profile.username, displayName: profile.displayName },
      createdAt: activity.createdAt.toISOString(),
    })),
    groups: targetMemberships.slice(0, 6).map((group) => ({
      ...group,
      memberCount: memberCounts.get(group.id) ?? 0,
    })),
  };
}

export async function profileRoutes(app: FastifyInstance) {
  app.get('/profile/me', { preHandler: app.requireAuth }, async (request, reply) => {
    const view = await buildProfileView(request.user!.id, request.user!.id, undefined);
    return view ?? reply.status(404).send({ error: '个人资料不存在。' });
  });

  app.patch('/profile/me', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = parseBody(profileUpdateSchema, request.body, reply);
    if (!body) return;
    await db
      .update(profiles)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(profiles.userId, request.user!.id));
    const view = await buildProfileView(request.user!.id, request.user!.id, undefined);
    return view ? { profile: view.profile } : reply.status(404).send({ error: '个人资料不存在。' });
  });

  app.post('/profile/onboarding', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = parseBody(onboardingProfileSchema, request.body, reply);
    if (!body) return;
    const [profile] = await db
      .update(profiles)
      .set({ ...body, onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(profiles.userId, request.user!.id))
      .returning({ userId: profiles.userId });
    if (!profile) return reply.status(404).send({ error: '个人资料不存在。' });
    const view = await buildProfileView(request.user!.id, request.user!.id, undefined);
    return view ? { profile: view.profile } : reply.status(404).send({ error: '个人资料不存在。' });
  });

  app.get<{ Params: { username: string } }>(
    '/profile/:username',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const [target] = await db
        .select({ id: users.id, isPublic: profiles.isPublic })
        .from(users)
        .innerJoin(profiles, eq(profiles.userId, users.id))
        .where(
          and(eq(users.username, request.params.username.toLowerCase()), eq(users.status, 'active'))
        )
        .limit(1);
      if (!target) return reply.status(404).send({ error: '无法查看该个人主页。' });
      const friendship = await findFriendship(request.user!.id, target.id);
      const relationship = describeRelationship(request.user!.id, target.id, friendship);
      if (!target.isPublic && relationship !== 'self' && relationship !== 'friends') {
        return reply.status(404).send({ error: '无法查看该个人主页。' });
      }
      const view = await buildProfileView(request.user!.id, target.id, friendship);
      return view ?? reply.status(404).send({ error: '无法查看该个人主页。' });
    }
  );
}
