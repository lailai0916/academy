import type { FastifyInstance } from 'fastify';
import { explanationRequestSchema } from '@lailai/academy-shared';
import { parseBody } from '../lib/http.js';
import { generateTeachingResponse } from '../services/ai.js';
import { getContentForAi } from '../services/learning.js';

export async function aiRoutes(app: FastifyInstance) {
  app.post(
    '/ai/explain',
    {
      preHandler: app.requireAuth,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const body = parseBody(explanationRequestSchema, request.body, reply);
      if (!body) {
        return;
      }
      const learning = await getContentForAi(request.user!.id, body.contentId, body.sessionId);
      if (!learning) {
        return reply.status(404).send({ error: '学习内容不存在。' });
      }
      try {
        const response = await generateTeachingResponse({
          kind: learning.content.kind,
          payload: learning.content.payload,
          mastery: learning.card?.mastery ?? 0,
          previousAnswer: body.previousAnswer,
          prompt: body.prompt,
        });
        if (!response) {
          return reply.status(409).send({ error: '管理员尚未配置 AI 服务。' });
        }
        return { response };
      } catch (error) {
        request.log.error({ error }, 'AI explanation failed');
        return reply.status(502).send({ error: 'AI 服务暂时无法完成讲解，请稍后重试。' });
      }
    }
  );
}
