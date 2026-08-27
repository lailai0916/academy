import type { FastifyInstance } from 'fastify';
import {
  contentKindSchema,
  learningAnswerSchema,
  learningInsightsQuerySchema,
  learningSessionCreateSchema,
} from '@lailai/academy-shared';
import { parseBody } from '../lib/http.js';
import {
  answerPrompt,
  createLearningSession,
  getLearningInsights,
  getLearningOverview,
  getLearningSessionSummary,
  getNextPrompt,
} from '../services/learning.js';
import { abandonLearningSession } from '../services/study-sessions.js';

export async function learningRoutes(app: FastifyInstance) {
  app.post('/learn/sessions', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = parseBody(learningSessionCreateSchema, request.body, reply);
    if (!body) {
      return;
    }
    const result = await createLearningSession(request.user!, body.kind, {
      mode: body.mode,
      focus: body.focus,
      unit: body.unit,
      limit: body.limit,
    });
    if (!result) {
      return reply.status(409).send({ error: '当前没有可学习的内容。' });
    }
    return reply.status(result.resumed ? 200 : 201).send({
      sessionId: result.session.id,
      total: result.session.plannedCount,
      resumed: result.resumed,
    });
  });

  app.get<{ Params: { sessionId: string } }>(
    '/learn/sessions/:sessionId/next',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const prompt = await getNextPrompt(request.user!.id, request.params.sessionId);
      if (!prompt) {
        return reply.status(404).send({ error: '学习会话不存在或已经结束。' });
      }
      return { prompt };
    }
  );

  app.post<{ Params: { sessionId: string } }>(
    '/learn/sessions/:sessionId/answer',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const body = parseBody(learningAnswerSchema, request.body, reply);
      if (!body) {
        return;
      }
      const result = await answerPrompt(request.user!, request.params.sessionId, body);
      if (!result) {
        return reply.status(409).send({ error: '题目已变化，请重新加载当前学习任务。' });
      }
      return { result };
    }
  );

  app.post<{ Params: { sessionId: string } }>(
    '/learn/sessions/:sessionId/abandon',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const abandoned = await abandonLearningSession(request.user!.id, request.params.sessionId);
      if (!abandoned) {
        return reply.status(409).send({ error: '当前学习任务已经结束。' });
      }
      return reply.status(204).send();
    }
  );

  app.get<{ Params: { kind: string } }>(
    '/learn/overview/:kind',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const kind = contentKindSchema.safeParse(request.params.kind);
      if (!kind.success) {
        return reply.status(400).send({ error: '学习内容类型不受支持。' });
      }
      return { overview: await getLearningOverview(request.user!, kind.data) };
    }
  );

  app.get<{ Querystring: { days?: string } }>(
    '/learn/insights',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const query = learningInsightsQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({ error: '统计周期不受支持。' });
      }
      return { insights: await getLearningInsights(request.user!.id, query.data.days) };
    }
  );

  app.get<{ Params: { sessionId: string } }>(
    '/learn/sessions/:sessionId/summary',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const summary = await getLearningSessionSummary(request.user!.id, request.params.sessionId);
      if (!summary) {
        return reply.status(404).send({ error: '学习记录不存在。' });
      }
      return { summary };
    }
  );
}
