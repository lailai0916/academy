import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  challengeCreateSchema,
  friendRequestSchema,
  groupCreateSchema,
  postCreateSchema,
  reactionSchema,
  type Challenge,
  type SocialPost,
  type StudyGroup,
} from '@lailai/academy-shared';
import { db } from '../db/index.js';
import {
  challengeParticipants,
  challenges,
  friendships,
  groupMembers,
  postReactions,
  posts,
  profiles,
  studyGroups,
  users,
} from '../db/schema.js';
import { parseBody } from '../lib/http.js';

async function getFeed(userId: string): Promise<SocialPost[]> {
  const [friendRows, membershipRows] = await Promise.all([
    db
      .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId))
        )
      ),
    db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId)),
  ]);
  const friendIds = new Set(
    friendRows.map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId))
  );
  const groupIds = new Set(membershipRows.map((row) => row.groupId));
  const postRows = await db
    .select({
      id: posts.id,
      authorId: posts.authorId,
      username: users.username,
      displayName: profiles.displayName,
      body: posts.body,
      groupId: posts.groupId,
      groupName: studyGroups.name,
      visibility: posts.visibility,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(studyGroups, eq(studyGroups.id, posts.groupId))
    .orderBy(desc(posts.createdAt))
    .limit(100);
  const visible = postRows
    .filter(
      (post) =>
        post.authorId === userId ||
        post.visibility === 'platform' ||
        (post.visibility === 'friends' && friendIds.has(post.authorId)) ||
        (post.visibility === 'group' && post.groupId && groupIds.has(post.groupId))
    )
    .slice(0, 40);
  const reactions =
    visible.length === 0
      ? []
      : await db
          .select()
          .from(postReactions)
          .where(
            inArray(
              postReactions.postId,
              visible.map((post) => post.id)
            )
          );

  return visible.map((post) => {
    const postReactionRows = reactions.filter((reaction) => reaction.postId === post.id);
    return {
      id: post.id,
      author: { username: post.username, displayName: post.displayName },
      body: post.body,
      group: post.groupId && post.groupName ? { id: post.groupId, name: post.groupName } : null,
      visibility: post.visibility,
      reactions: {
        support: postReactionRows.filter((reaction) => reaction.kind === 'support').length,
        insight: postReactionRows.filter((reaction) => reaction.kind === 'insight').length,
        together: postReactionRows.filter((reaction) => reaction.kind === 'together').length,
      },
      reacted: postReactionRows
        .filter((reaction) => reaction.userId === userId)
        .map((reaction) => reaction.kind),
      createdAt: post.createdAt.toISOString(),
    };
  });
}

async function listGroups(userId: string): Promise<StudyGroup[]> {
  const [groups, memberships, counts] = await Promise.all([
    db
      .select({
        id: studyGroups.id,
        name: studyGroups.name,
        description: studyGroups.description,
        ownerUsername: users.username,
      })
      .from(studyGroups)
      .innerJoin(users, eq(users.id, studyGroups.ownerId))
      .orderBy(desc(studyGroups.createdAt)),
    db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId)),
    db
      .select({ groupId: groupMembers.groupId, value: count() })
      .from(groupMembers)
      .groupBy(groupMembers.groupId),
  ]);
  const joined = new Set(memberships.map((membership) => membership.groupId));
  const countByGroup = new Map(counts.map((item) => [item.groupId, Number(item.value)]));
  return groups.map((group) => ({
    ...group,
    memberCount: countByGroup.get(group.id) ?? 0,
    joined: joined.has(group.id),
  }));
}

async function listChallenges(userId: string): Promise<Challenge[]> {
  const [rows, participants, counts] = await Promise.all([
    db.select().from(challenges).orderBy(desc(challenges.startsAt)).limit(50),
    db
      .select({ challengeId: challengeParticipants.challengeId })
      .from(challengeParticipants)
      .where(eq(challengeParticipants.userId, userId)),
    db
      .select({ challengeId: challengeParticipants.challengeId, value: count() })
      .from(challengeParticipants)
      .groupBy(challengeParticipants.challengeId),
  ]);
  const joined = new Set(participants.map((participant) => participant.challengeId));
  const countByChallenge = new Map(counts.map((item) => [item.challengeId, Number(item.value)]));
  return rows.map((challenge) => ({
    id: challenge.id,
    groupId: challenge.groupId,
    title: challenge.title,
    metric: challenge.metric,
    targetValue: challenge.targetValue,
    participantCount: countByChallenge.get(challenge.id) ?? 0,
    joined: joined.has(challenge.id),
    endsAt: challenge.endsAt.toISOString(),
  }));
}

export async function socialRoutes(app: FastifyInstance) {
  app.get('/social', { preHandler: app.requireAuth }, async (request) => ({
    feed: await getFeed(request.user!.id),
    groups: await listGroups(request.user!.id),
    challenges: await listChallenges(request.user!.id),
  }));

  app.post('/social/posts', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = parseBody(postCreateSchema, request.body, reply);
    if (!body) {
      return;
    }
    if (body.groupId) {
      const [membership] = await db
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(
          and(eq(groupMembers.groupId, body.groupId), eq(groupMembers.userId, request.user!.id))
        )
        .limit(1);
      if (!membership) {
        return reply.status(403).send({ error: '加入学习小组后才能发布小组动态。' });
      }
    }
    await db.insert(posts).values({
      authorId: request.user!.id,
      body: body.body,
      groupId: body.groupId,
      visibility: body.groupId ? 'group' : body.visibility,
    });
    return reply.status(201).send({ feed: await getFeed(request.user!.id) });
  });

  app.post<{ Params: { postId: string } }>(
    '/social/posts/:postId/reactions',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const body = parseBody(reactionSchema, request.body, reply);
      if (!body) {
        return;
      }
      const condition = and(
        eq(postReactions.postId, request.params.postId),
        eq(postReactions.userId, request.user!.id),
        eq(postReactions.kind, body.kind)
      );
      const [existing] = await db.select().from(postReactions).where(condition).limit(1);
      if (existing) {
        await db.delete(postReactions).where(condition);
      } else {
        await db.insert(postReactions).values({
          postId: request.params.postId,
          userId: request.user!.id,
          kind: body.kind,
        });
      }
      return { feed: await getFeed(request.user!.id) };
    }
  );

  app.get<{ Querystring: { q?: string } }>(
    '/social/users',
    { preHandler: app.requireAuth },
    async (request) => {
      const query = request.query.q?.trim() ?? '';
      if (query.length < 2) {
        return { users: [] };
      }
      return {
        users: await db
          .select({
            id: users.id,
            username: users.username,
            displayName: profiles.displayName,
            grade: profiles.grade,
          })
          .from(users)
          .innerJoin(profiles, eq(profiles.userId, users.id))
          .where(
            and(
              or(ilike(users.username, `%${query}%`), ilike(profiles.displayName, `%${query}%`)),
              eq(users.status, 'active')
            )
          )
          .limit(12),
      };
    }
  );

  app.get('/social/friends', { preHandler: app.requireAuth }, async (request) => {
    const rows = await db
      .select()
      .from(friendships)
      .where(
        or(
          eq(friendships.requesterId, request.user!.id),
          eq(friendships.addresseeId, request.user!.id)
        )
      )
      .orderBy(desc(friendships.createdAt));
    const ids = [...new Set(rows.flatMap((row) => [row.requesterId, row.addresseeId]))].filter(
      (id) => id !== request.user!.id
    );
    const people =
      ids.length === 0
        ? []
        : await db
            .select({
              id: users.id,
              username: users.username,
              displayName: profiles.displayName,
              grade: profiles.grade,
            })
            .from(users)
            .innerJoin(profiles, eq(profiles.userId, users.id))
            .where(inArray(users.id, ids));
    const peopleById = new Map(people.map((person) => [person.id, person]));
    return {
      friendships: rows.map((row) => {
        const otherId = row.requesterId === request.user!.id ? row.addresseeId : row.requesterId;
        return {
          person: peopleById.get(otherId),
          status: row.status,
          direction: row.requesterId === request.user!.id ? 'outgoing' : 'incoming',
        };
      }),
    };
  });

  app.post('/social/friends', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = parseBody(friendRequestSchema, request.body, reply);
    if (!body) {
      return;
    }
    const [target] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, body.username.toLowerCase()))
      .limit(1);
    if (!target || target.id === request.user!.id) {
      return reply.status(404).send({ error: '没有找到可添加的用户。' });
    }
    const [existing] = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, request.user!.id),
            eq(friendships.addresseeId, target.id)
          ),
          and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, request.user!.id))
        )
      )
      .limit(1);
    if (existing) {
      return reply.status(409).send({ error: '好友关系或申请已经存在。' });
    }
    await db.insert(friendships).values({ requesterId: request.user!.id, addresseeId: target.id });
    return reply.status(201).send({ ok: true });
  });

  app.post<{ Params: { requesterId: string } }>(
    '/social/friends/:requesterId/accept',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      await db
        .update(friendships)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(
          and(
            eq(friendships.requesterId, request.params.requesterId),
            eq(friendships.addresseeId, request.user!.id),
            eq(friendships.status, 'pending')
          )
        );
      return reply.status(204).send();
    }
  );

  app.post('/social/groups', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = parseBody(groupCreateSchema, request.body, reply);
    if (!body) {
      return;
    }
    const [group] = await db
      .insert(studyGroups)
      .values({ ...body, ownerId: request.user!.id })
      .returning();
    await db
      .insert(groupMembers)
      .values({ groupId: group.id, userId: request.user!.id, role: 'owner' });
    return reply.status(201).send({ group });
  });

  app.post<{ Params: { groupId: string } }>(
    '/social/groups/:groupId/join',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      await db
        .insert(groupMembers)
        .values({ groupId: request.params.groupId, userId: request.user!.id })
        .onConflictDoNothing();
      return reply.status(204).send();
    }
  );

  app.post('/social/challenges', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = parseBody(challengeCreateSchema, request.body, reply);
    if (!body) {
      return;
    }
    const [membership] = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, body.groupId), eq(groupMembers.userId, request.user!.id)))
      .limit(1);
    if (!membership) {
      return reply.status(403).send({ error: '加入学习小组后才能创建挑战。' });
    }
    const [challenge] = await db
      .insert(challenges)
      .values({
        groupId: body.groupId,
        creatorId: request.user!.id,
        title: body.title,
        metric: body.metric,
        targetValue: body.targetValue,
        endsAt: new Date(Date.now() + body.days * 86_400_000),
      })
      .returning();
    await db.insert(challengeParticipants).values({
      challengeId: challenge.id,
      userId: request.user!.id,
    });
    return reply.status(201).send({ challenge });
  });

  app.post<{ Params: { challengeId: string } }>(
    '/social/challenges/:challengeId/join',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const [challenge] = await db
        .select({ groupId: challenges.groupId })
        .from(challenges)
        .where(eq(challenges.id, request.params.challengeId))
        .limit(1);
      if (!challenge) {
        return reply.status(404).send({ error: '挑战不存在。' });
      }
      const [membership] = await db
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, challenge.groupId),
            eq(groupMembers.userId, request.user!.id)
          )
        )
        .limit(1);
      if (!membership) {
        return reply.status(403).send({ error: '加入学习小组后才能参与挑战。' });
      }
      await db
        .insert(challengeParticipants)
        .values({ challengeId: request.params.challengeId, userId: request.user!.id })
        .onConflictDoNothing();
      return reply.status(204).send();
    }
  );
}
