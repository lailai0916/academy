import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { config } from '../src/config.js';
import { closeDatabase } from '../src/db/index.js';

let app: FastifyInstance;
let adminCookie = '';
let userCookie = '';
let userId = '';
let sessionId = '';

const mutationHeaders = (cookie = '') => ({
  origin: config.APP_ORIGIN,
  ...(cookie ? { cookie } : {}),
});

function cookieFrom(response: { headers: { ['set-cookie']?: string | string[] | number } }) {
  const value = response.headers['set-cookie'];
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? (raw.split(';')[0] ?? '') : '';
}

const integrationDescribe =
  process.env.ACADEMY_INTEGRATION_TEST === 'true' ? describe.sequential : describe.skip;

integrationDescribe('Academy API integration', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closeDatabase();
  });

  it('reports database health', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('lets the bootstrap administrator create a one-time invite', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: mutationHeaders(),
      payload: { username: 'admin', password: 'LocalTestPassword-2026' },
    });
    expect(login.statusCode).toBe(200);
    adminCookie = cookieFrom(login);

    const aiSettings = await app.inject({
      method: 'GET',
      url: '/api/admin/ai',
      headers: { cookie: adminCookie },
    });
    expect(aiSettings.statusCode).toBe(200);
    expect(aiSettings.json().settings).toMatchObject({
      model: 'gpt-5.6-sol',
      hasApiKey: false,
    });

    const invite = await app.inject({
      method: 'POST',
      url: '/api/admin/invites',
      headers: mutationHeaders(adminCookie),
      payload: { label: '自动化测试', maxUses: 1, expiresInDays: 1 },
    });
    expect(invite.statusCode).toBe(201);
    const code = invite.json().invite.code as string;
    expect(code).toMatch(/^ACA-/);

    const username = `student_${Date.now()}`;
    const register = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: mutationHeaders(),
      payload: { username, password: 'StudentPassword-2026', inviteCode: code },
    });
    expect(register.statusCode).toBe(201);
    userCookie = cookieFrom(register);
    userId = register.json().user.id as string;
    expect(register.json().user.username).toBe(username);

    const reuse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: mutationHeaders(),
      payload: { username: `${username}_2`, password: 'StudentPassword-2026', inviteCode: code },
    });
    expect(reuse.statusCode).toBe(400);

    const mismatchedContent = await app.inject({
      method: 'POST',
      url: '/api/admin/content/import',
      headers: mutationHeaders(adminCookie),
      payload: {
        items: [
          {
            key: 'invalid-mismatched-content',
            kind: 'word',
            grade: '高一',
            textbook: '测试教材',
            unit: '测试单元',
            tags: [],
            payload: {
              title: '错误类型',
              author: '测试',
              dynasty: '测试',
              lines: ['第一句', '第二句'],
              translation: '',
              notes: [],
              keyPoints: [],
            },
          },
        ],
      },
    });
    expect(mismatchedContent.statusCode).toBe(400);
  });

  it('builds a personal plan and completes an adaptive review', async () => {
    const dashboard = await app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: { cookie: userCookie },
    });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json().dashboard.plan.total).toBeGreaterThan(0);

    const created = await app.inject({
      method: 'POST',
      url: '/api/learn/sessions',
      headers: mutationHeaders(userCookie),
      payload: { kind: 'word', mode: 'diagnostic' },
    });
    expect(created.statusCode).toBe(201);
    sessionId = created.json().sessionId as string;

    const next = await app.inject({
      method: 'GET',
      url: `/api/learn/sessions/${sessionId}/next`,
      headers: { cookie: userCookie },
    });
    expect(next.statusCode).toBe(200);
    const prompt = next.json().prompt;
    expect(prompt.kind).toBe('word');

    const answer = await app.inject({
      method: 'POST',
      url: `/api/learn/sessions/${sessionId}/answer`,
      headers: mutationHeaders(userCookie),
      payload: { contentId: prompt.contentId, answer: '', responseMs: 2500, revealed: true },
    });
    expect(answer.statusCode).toBe(200);
    expect(answer.json().result.rating).toBe('again');
    expect(answer.json().result.nextDueAt).toBeTypeOf('string');

    const secondPrompt = await app.inject({
      method: 'GET',
      url: `/api/learn/sessions/${sessionId}/next`,
      headers: { cookie: userCookie },
    });
    const secondContentId = secondPrompt.json().prompt.contentId as string;
    const duplicatePayload = {
      method: 'POST' as const,
      url: `/api/learn/sessions/${sessionId}/answer`,
      headers: mutationHeaders(userCookie),
      payload: { contentId: secondContentId, answer: '', responseMs: 2500, revealed: true },
    };
    const duplicateResults = await Promise.all([
      app.inject(duplicatePayload),
      app.inject(duplicatePayload),
    ]);
    expect(duplicateResults.map((result) => result.statusCode).sort()).toEqual([200, 409]);

    const afterDiagnostic = await app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: { cookie: userCookie },
    });
    expect(afterDiagnostic.json().dashboard.plan.completed).toBe(0);

    const overview = await app.inject({
      method: 'GET',
      url: '/api/learn/overview/word',
      headers: { cookie: userCookie },
    });
    expect(overview.statusCode).toBe(200);
    expect(overview.json().overview.units.length).toBeGreaterThan(0);

    const resumed = await app.inject({
      method: 'POST',
      url: '/api/learn/sessions',
      headers: mutationHeaders(userCookie),
      payload: { kind: 'poem', mode: 'plan' },
    });
    expect(resumed.statusCode).toBe(200);
    expect(resumed.json()).toMatchObject({ sessionId, resumed: true });

    const abandoned = await app.inject({
      method: 'POST',
      url: `/api/learn/sessions/${sessionId}/abandon`,
      headers: mutationHeaders(userCookie),
    });
    expect(abandoned.statusCode).toBe(204);

    const abandonedSummary = await app.inject({
      method: 'GET',
      url: `/api/learn/sessions/${sessionId}/summary`,
      headers: { cookie: userCookie },
    });
    expect(abandonedSummary.json().summary).toMatchObject({
      status: 'abandoned',
      completedCount: 2,
    });

    const focused = await app.inject({
      method: 'POST',
      url: '/api/learn/sessions',
      headers: mutationHeaders(userCookie),
      payload: { kind: 'word', mode: 'diagnostic', limit: 5 },
    });
    expect(focused.statusCode).toBe(201);
    const focusedSessionId = focused.json().sessionId as string;
    for (let index = 0; index < 5; index += 1) {
      const current = await app.inject({
        method: 'GET',
        url: `/api/learn/sessions/${focusedSessionId}/next`,
        headers: { cookie: userCookie },
      });
      expect(current.statusCode).toBe(200);
      const contentId = current.json().prompt.contentId as string;
      const answer = await app.inject({
        method: 'POST',
        url: `/api/learn/sessions/${focusedSessionId}/answer`,
        headers: mutationHeaders(userCookie),
        payload: { contentId, answer: '', responseMs: 1800, revealed: true },
      });
      expect(answer.statusCode).toBe(200);
    }
    const summary = await app.inject({
      method: 'GET',
      url: `/api/learn/sessions/${focusedSessionId}/summary`,
      headers: { cookie: userCookie },
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().summary.status).toBe('completed');
    expect(summary.json().summary.completedCount).toBe(5);
    expect(summary.json().summary.mistakes).toHaveLength(5);

    const insights = await app.inject({
      method: 'GET',
      url: '/api/learn/insights?days=14',
      headers: { cookie: userCookie },
    });
    expect(insights.statusCode).toBe(200);
    expect(insights.json().insights.daily).toHaveLength(14);
    expect(insights.json().insights.metrics.reviewCount).toBeGreaterThanOrEqual(7);
  });

  it('updates the learning profile and supports social collaboration', async () => {
    const update = await app.inject({
      method: 'PATCH',
      url: '/api/profile/me',
      headers: mutationHeaders(userCookie),
      payload: {
        displayName: '测试同学',
        bio: '正在建立长期记忆。',
        grade: '高一',
        targetScore: 650,
        dailyGoal: 20,
        isPublic: true,
      },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().profile.targetScore).toBe(650);

    const group = await app.inject({
      method: 'POST',
      url: '/api/social/groups',
      headers: mutationHeaders(userCookie),
      payload: { name: `测试学习组 ${Date.now()}`, description: '真实结果互相推动' },
    });
    expect(group.statusCode).toBe(201);

    const post = await app.inject({
      method: 'POST',
      url: '/api/social/posts',
      headers: mutationHeaders(userCookie),
      payload: { body: '完成了第一轮延迟复习。', groupId: null, visibility: 'platform' },
    });
    expect(post.statusCode).toBe(201);

    const social = await app.inject({
      method: 'GET',
      url: '/api/social',
      headers: { cookie: userCookie },
    });
    expect(social.statusCode).toBe(200);
    expect(social.json().feed[0].body).toBe('完成了第一轮延迟复习。');
    expect(social.json().groups.length).toBeGreaterThan(0);

    const friendRequest = await app.inject({
      method: 'POST',
      url: '/api/social/friends',
      headers: mutationHeaders(userCookie),
      payload: { username: 'admin' },
    });
    expect(friendRequest.statusCode).toBe(201);

    const adminNotifications = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { cookie: adminCookie },
    });
    expect(adminNotifications.statusCode).toBe(200);
    expect(adminNotifications.json().unreadCount).toBeGreaterThan(0);

    const accept = await app.inject({
      method: 'POST',
      url: `/api/social/friends/${userId}/accept`,
      headers: mutationHeaders(adminCookie),
    });
    expect(accept.statusCode).toBe(204);

    const search = await app.inject({
      method: 'GET',
      url: '/api/search?q=admin',
      headers: { cookie: userCookie },
    });
    expect(search.statusCode).toBe(200);
    expect(search.json().results.some((item: { type: string }) => item.type === 'user')).toBe(true);
  });

  it('protects administrator endpoints and rejects foreign origins', async () => {
    const forbiddenAdmin = await app.inject({
      method: 'GET',
      url: '/api/admin/summary',
      headers: { cookie: userCookie },
    });
    expect(forbiddenAdmin.statusCode).toBe(403);

    const foreignOrigin = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: userCookie, origin: 'https://example.com' },
    });
    expect(foreignOrigin.statusCode).toBe(403);
  });
});
