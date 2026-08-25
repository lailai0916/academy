import type { FastifyInstance } from 'fastify';
import { learningAnswerSchema, learningSessionCreateSchema } from '@lailai/academy-shared';
import { parseBody } from '../lib/http.js';
import { answerPrompt, createLearningSession, getNextPrompt } from '../services/learning.js';

export async function learningRoutes(app: FastifyInstance) {
  app.post('/learn/sessions', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = parseBody(learningSessionCreateSchema, request.body, reply);
    if (!body) {
      return;
    }
    const session = await createLearningSession(request.user!, body.kind, body.mode);
    if (!session) {
      return reply.status(409).send({ error: '当前没有可学习的内容。' });
    }
    return reply.status(201).send({ sessionId: session.id, total: session.plannedCount });
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
}
