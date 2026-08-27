import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { config } from '../src/config.js';
import { closeDatabase } from '../src/db/index.js';

let app: FastifyInstance;
let adminCookie = '';
let userCookie = '';
let userId = '';
let userUsername = '';
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

    userUsername = `student_${Date.now()}`;
    const register = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: mutationHeaders(),
      payload: { username: userUsername, password: 'StudentPassword-2026', inviteCode: code },
    });
    expect(register.statusCode).toBe(201);
    userCookie = cookieFrom(register);
    userId = register.json().user.id as string;
    expect(register.json().user.username).toBe(userUsername);

    const reuse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: mutationHeaders(),
      payload: {
        username: `${userUsername}_2`,
        password: 'StudentPassword-2026',
        inviteCode: code,
      },
    });
    expect(reuse.statusCode).toBe(400);

    const importKey = `word-import-${Date.now()}`;
    const importPayload = {
      source: '自动化测试教材',
      version: '2026.1',
      status: 'draft',
      items: [
        {
          key: importKey,
          kind: 'word',
          grade: '高一',
          textbook: '测试教材',
          unit: '测试单元',
          tags: ['测试'],
          payload: {
            headword: 'verification',
            phonetic: '/ˌverɪfɪˈkeɪʃn/',
            meanings: ['验证'],
            example: 'Verification protects content quality.',
            exampleTranslation: '验证用于保障内容质量。',
            aliases: [],
          },
        },
      ],
    };
    const preview = await app.inject({
      method: 'POST',
      url: '/api/admin/content/import/preview',
      headers: mutationHeaders(adminCookie),
      payload: importPayload,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().preview).toMatchObject({
      total: 1,
      created: 1,
      updated: 0,
      unchanged: 0,
      issues: [],
    });
    const imported = await app.inject({
      method: 'POST',
      url: '/api/admin/content/import',
      headers: mutationHeaders(adminCookie),
      payload: { ...importPayload, fingerprint: preview.json().preview.fingerprint },
    });
    expect(imported.statusCode).toBe(201);
    expect(imported.json().batch).toMatchObject({
      source: importPayload.source,
      status: 'draft',
      createdCount: 1,
    });
    const unchangedPreview = await app.inject({
      method: 'POST',
      url: '/api/admin/content/import/preview',
      headers: mutationHeaders(adminCookie),
      payload: importPayload,
    });
    expect(unchangedPreview.json().preview).toMatchObject({ created: 0, unchanged: 1 });
    const contentSearch = await app.inject({
      method: 'GET',
      url: `/api/admin/content?q=${importKey}&status=draft`,
      headers: { cookie: adminCookie },
    });
    expect(contentSearch.statusCode).toBe(200);
    expect(contentSearch.json().content[0]).toMatchObject({
      key: importKey,
      source: importPayload.source,
      sourceVersion: importPayload.version,
    });
    const importedContentId = contentSearch.json().content[0].id as string;
    const importedDetail = await app.inject({
      method: 'GET',
      url: `/api/admin/content/${importedContentId}`,
      headers: { cookie: adminCookie },
    });
    expect(importedDetail.statusCode).toBe(200);
    expect(importedDetail.json().content).toMatchObject({
      versionNumber: 1,
      status: 'draft',
      issueCount: 0,
    });
    const rollback = await app.inject({
      method: 'POST',
      url: `/api/admin/content/imports/${imported.json().batch.id}/rollback`,
      headers: mutationHeaders(adminCookie),
      payload: { note: '集成测试回滚' },
    });
    expect(rollback.statusCode).toBe(200);
    expect(rollback.json().batch).toMatchObject({
      rollbackRevertedCount: 1,
      rollbackSkippedCount: 0,
    });
    const rolledBackDetail = await app.inject({
      method: 'GET',
      url: `/api/admin/content/${importedContentId}`,
      headers: { cookie: adminCookie },
    });
    expect(rolledBackDetail.json().content).toMatchObject({
      status: 'archived',
      versionNumber: 2,
    });
    const stalePreview = await app.inject({
      method: 'POST',
      url: '/api/admin/content/import/preview',
      headers: mutationHeaders(adminCookie),
      payload: importPayload,
    });
    const publishRolledBackContent = await app.inject({
      method: 'PATCH',
      url: `/api/admin/content/${importedContentId}/status`,
      headers: mutationHeaders(adminCookie),
      payload: {
        status: 'published',
        expectedUpdatedAt: rolledBackDetail.json().content.updatedAt,
        note: '制造预检基线变化',
      },
    });
    expect(publishRolledBackContent.statusCode).toBe(200);
    const staleApply = await app.inject({
      method: 'POST',
      url: '/api/admin/content/import',
      headers: mutationHeaders(adminCookie),
      payload: { ...importPayload, fingerprint: stalePreview.json().preview.fingerprint },
    });
    expect(staleApply.statusCode).toBe(409);
    const fieldNameSearch = await app.inject({
      method: 'GET',
      url: '/api/admin/content?q=example',
      headers: { cookie: adminCookie },
    });
    expect(fieldNameSearch.statusCode).toBe(200);
    expect(fieldNameSearch.json().total).toBe(0);

    const incompleteKey = `word-incomplete-${Date.now()}`;
    const incompleteDraft = {
      source: '自动化质量门禁',
      version: '2026.1',
      status: 'draft',
      items: [
        {
          key: incompleteKey,
          kind: 'word',
          grade: '高一',
          textbook: '测试教材',
          unit: '质量门禁',
          tags: [],
          payload: {
            headword: 'incomplete',
            phonetic: '',
            meanings: ['不完整的'],
            example: '',
            exampleTranslation: '',
            aliases: [],
          },
        },
      ],
    };
    const incompletePreview = await app.inject({
      method: 'POST',
      url: '/api/admin/content/import/preview',
      headers: mutationHeaders(adminCookie),
      payload: incompleteDraft,
    });
    expect(incompletePreview.statusCode).toBe(200);
    expect(incompletePreview.json().preview.issues).toHaveLength(2);
    const incompleteImport = await app.inject({
      method: 'POST',
      url: '/api/admin/content/import',
      headers: mutationHeaders(adminCookie),
      payload: {
        ...incompleteDraft,
        fingerprint: incompletePreview.json().preview.fingerprint,
      },
    });
    expect(incompleteImport.statusCode).toBe(201);
    const incompleteSearch = await app.inject({
      method: 'GET',
      url: `/api/admin/content?q=${incompleteKey}`,
      headers: { cookie: adminCookie },
    });
    const incompleteId = incompleteSearch.json().content[0].id as string;
    const incompleteUpdatedAt = incompleteSearch.json().content[0].updatedAt as string;
    const blockedPublication = await app.inject({
      method: 'PATCH',
      url: `/api/admin/content/${incompleteId}/status`,
      headers: mutationHeaders(adminCookie),
      payload: {
        status: 'published',
        expectedUpdatedAt: incompleteUpdatedAt,
        note: '验证质量门禁',
      },
    });
    expect(blockedPublication.statusCode).toBe(422);

    const incompleteDetail = await app.inject({
      method: 'GET',
      url: `/api/admin/content/${incompleteId}`,
      headers: { cookie: adminCookie },
    });
    const fixedPublication = await app.inject({
      method: 'PUT',
      url: `/api/admin/content/${incompleteId}`,
      headers: mutationHeaders(adminCookie),
      payload: {
        kind: 'word',
        grade: '高一',
        textbook: '测试教材',
        unit: '质量门禁',
        tags: [],
        source: '自动化质量门禁',
        version: '2026.2',
        status: 'published',
        expectedUpdatedAt: incompleteDetail.json().content.updatedAt,
        note: '补全音标和例句后发布',
        payload: {
          headword: 'incomplete',
          phonetic: '/ˌɪnkəmˈpliːt/',
          meanings: ['不完整的'],
          example: 'The record is incomplete.',
          exampleTranslation: '这份记录并不完整。',
          aliases: [],
        },
      },
    });
    expect(fixedPublication.statusCode).toBe(200);
    expect(fixedPublication.json().content).toMatchObject({
      status: 'published',
      issueCount: 0,
      versionNumber: 2,
    });
    expect(fixedPublication.json().content.revisions).toHaveLength(2);

    const directPublicationPreview = await app.inject({
      method: 'POST',
      url: '/api/admin/content/import/preview',
      headers: mutationHeaders(adminCookie),
      payload: { ...incompleteDraft, status: 'published' },
    });
    const blockedDirectPublication = await app.inject({
      method: 'POST',
      url: '/api/admin/content/import',
      headers: mutationHeaders(adminCookie),
      payload: {
        ...incompleteDraft,
        status: 'published',
        fingerprint: directPublicationPreview.json().preview.fingerprint,
      },
    });
    expect(blockedDirectPublication.statusCode).toBe(422);

    const mismatchedContent = await app.inject({
      method: 'POST',
      url: '/api/admin/content/import',
      headers: mutationHeaders(adminCookie),
      payload: {
        source: '自动化测试教材',
        version: '2026.1',
        status: 'draft',
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

  it('updates the password and revokes other login sessions', async () => {
    const secondaryLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { ...mutationHeaders(), 'user-agent': 'Mozilla/5.0 (iPhone) Safari/605.1.15' },
      payload: { username: userUsername, password: 'StudentPassword-2026' },
    });
    expect(secondaryLogin.statusCode).toBe(200);
    const secondaryCookie = cookieFrom(secondaryLogin);

    const listed = await app.inject({
      method: 'GET',
      url: '/api/auth/sessions',
      headers: { cookie: userCookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().sessions).toHaveLength(2);
    expect(
      listed.json().sessions.filter((item: { current: boolean }) => item.current)
    ).toHaveLength(1);
    const secondarySession = listed
      .json()
      .sessions.find((item: { current: boolean }) => !item.current) as { id: string };

    const revoked = await app.inject({
      method: 'DELETE',
      url: `/api/auth/sessions/${secondarySession.id}`,
      headers: mutationHeaders(userCookie),
    });
    expect(revoked.statusCode).toBe(204);
    const revokedMe = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: secondaryCookie },
    });
    expect(revokedMe.json()).toEqual({ user: null });

    const anotherLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { ...mutationHeaders(), 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/140' },
      payload: { username: userUsername, password: 'StudentPassword-2026' },
    });
    expect(anotherLogin.statusCode).toBe(200);
    const anotherCookie = cookieFrom(anotherLogin);

    const changed = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: mutationHeaders(userCookie),
      payload: {
        currentPassword: 'StudentPassword-2026',
        newPassword: 'UpdatedStudentPassword-2026',
      },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toEqual({ otherSessionsRevoked: 1 });

    const primaryMe = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userCookie },
    });
    expect(primaryMe.json().user.id).toBe(userId);
    const anotherMe = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: anotherCookie },
    });
    expect(anotherMe.json()).toEqual({ user: null });

    const oldPassword = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: mutationHeaders(),
      payload: { username: userUsername, password: 'StudentPassword-2026' },
    });
    expect(oldPassword.statusCode).toBe(401);
    const newPassword = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: mutationHeaders(),
      payload: { username: userUsername, password: 'UpdatedStudentPassword-2026' },
    });
    expect(newPassword.statusCode).toBe(200);
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

    const promptContent = await app.inject({
      method: 'GET',
      url: `/api/admin/content/${prompt.contentId}`,
      headers: { cookie: adminCookie },
    });
    const currentContent = promptContent.json().content;
    const contentUpdate = await app.inject({
      method: 'PUT',
      url: `/api/admin/content/${prompt.contentId}`,
      headers: mutationHeaders(adminCookie),
      payload: {
        kind: currentContent.kind,
        grade: currentContent.grade,
        textbook: currentContent.textbook,
        unit: currentContent.unit,
        tags: currentContent.tags,
        source: currentContent.source,
        version: `${currentContent.sourceVersion}-reviewed`,
        status: 'published',
        expectedUpdatedAt: currentContent.updatedAt,
        note: '验证学习会话固定内容版本',
        payload: currentContent.payload,
      },
    });
    expect(contentUpdate.statusCode).toBe(200);
    expect(contentUpdate.json().resetCards).toBe(0);

    const answer = await app.inject({
      method: 'POST',
      url: `/api/learn/sessions/${sessionId}/answer`,
      headers: mutationHeaders(userCookie),
      payload: { contentId: prompt.contentId, answer: '', responseMs: 2500, revealed: true },
    });
    expect(answer.statusCode).toBe(200);
    expect(answer.json().result.rating).toBe('again');
    expect(answer.json().result.nextDueAt).toBeTypeOf('string');
    expect(answer.json().result.contentUpdated).toBe(true);

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

    const secondContent = await app.inject({
      method: 'GET',
      url: `/api/admin/content/${secondContentId}`,
      headers: { cookie: adminCookie },
    });
    const secondCurrent = secondContent.json().content;
    const semanticUpdate = await app.inject({
      method: 'PUT',
      url: `/api/admin/content/${secondContentId}`,
      headers: mutationHeaders(adminCookie),
      payload: {
        kind: 'word',
        grade: secondCurrent.grade,
        textbook: secondCurrent.textbook,
        unit: secondCurrent.unit,
        tags: secondCurrent.tags,
        source: secondCurrent.source,
        version: secondCurrent.sourceVersion,
        status: 'published',
        expectedUpdatedAt: secondCurrent.updatedAt,
        note: '验证答案变化后重置学习卡',
        payload: {
          ...secondCurrent.payload,
          headword: `${secondCurrent.payload.headword}-updated`,
        },
      },
    });
    expect(semanticUpdate.statusCode).toBe(200);
    expect(semanticUpdate.json().resetCards).toBe(1);

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
    const expectedAnswers = new Map<string, string>();
    let reinforcementScheduled = 0;
    let focusedComplete = false;
    let finalSessionTotal = 0;
    for (let index = 0; index < 12 && !focusedComplete; index += 1) {
      const current = await app.inject({
        method: 'GET',
        url: `/api/learn/sessions/${focusedSessionId}/next`,
        headers: { cookie: userCookie },
      });
      expect(current.statusCode).toBe(200);
      const currentPrompt = current.json().prompt;
      const contentId = currentPrompt.contentId as string;
      const previousAnswer = expectedAnswers.get(contentId);
      let submittedAnswer = previousAnswer ?? '';
      if (previousAnswer) {
        const content = await app.inject({
          method: 'GET',
          url: `/api/admin/content/${contentId}`,
          headers: { cookie: adminCookie },
        });
        const payload = content.json().content.payload;
        submittedAnswer =
          currentPrompt.promptType === 'meaning_choice' ? payload.meanings[0] : payload.headword;
      }
      const answer = await app.inject({
        method: 'POST',
        url: `/api/learn/sessions/${focusedSessionId}/answer`,
        headers: mutationHeaders(userCookie),
        payload: {
          contentId,
          answer: submittedAnswer,
          responseMs: 1800,
          revealed: !previousAnswer,
        },
      });
      expect(answer.statusCode).toBe(200);
      const result = answer.json().result;
      if (!previousAnswer) expectedAnswers.set(contentId, result.expectedAnswer);
      if (result.reinforcementScheduled) reinforcementScheduled += 1;
      focusedComplete = result.sessionComplete;
      finalSessionTotal = result.sessionTotal;
    }
    expect(focusedComplete).toBe(true);
    expect(reinforcementScheduled).toBe(5);
    expect(finalSessionTotal).toBe(10);
    const summary = await app.inject({
      method: 'GET',
      url: `/api/learn/sessions/${focusedSessionId}/summary`,
      headers: { cookie: userCookie },
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().summary.status).toBe('completed');
    expect(summary.json().summary.completedCount).toBe(10);
    expect(summary.json().summary.firstPassAccuracy).toBe(0);
    expect(summary.json().summary.reinforcementCount).toBe(5);
    expect(summary.json().summary.recoveredCount).toBe(5);
    expect(summary.json().summary.mistakes).toHaveLength(5);

    const completedSession = await app.inject({
      method: 'GET',
      url: `/api/learn/sessions/${focusedSessionId}/next`,
      headers: { cookie: userCookie },
    });
    expect(completedSession.statusCode).toBe(200);
    expect(completedSession.json()).toMatchObject({
      prompt: null,
      summary: { id: focusedSessionId, status: 'completed', recoveredCount: 5 },
    });

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
