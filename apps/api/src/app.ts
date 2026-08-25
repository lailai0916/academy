import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { config } from './config.js';
import { sql } from './db/index.js';
import authPlugin from './plugins/auth.js';
import { adminRoutes } from './routes/admin.js';
import { aiRoutes } from './routes/ai.js';
import { authRoutes } from './routes/auth.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { learningRoutes } from './routes/learning.js';
import { profileRoutes } from './routes/profile.js';
import { socialRoutes } from './routes/social.js';
import { workspaceRoutes } from './routes/workspace.js';

export async function buildApp() {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 1_048_576,
  });

  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    global: true,
    max: 240,
    timeWindow: '1 minute',
  });

  app.addHook('onRequest', async (request, reply) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return;
    }
    const origin = request.headers.origin;
    if (origin && origin !== config.APP_ORIGIN) {
      await reply.status(403).send({ error: '请求来源不受信任。' });
    }
  });

  await app.register(authPlugin);
  await app.register(
    async (api) => {
      api.get('/health', async (_request, reply) => {
        try {
          await sql`select 1`;
          return { ok: true };
        } catch {
          return reply.status(503).send({ ok: false });
        }
      });
      await api.register(authRoutes);
      await api.register(dashboardRoutes);
      await api.register(profileRoutes);
      await api.register(learningRoutes);
      await api.register(aiRoutes);
      await api.register(socialRoutes);
      await api.register(adminRoutes);
      await api.register(workspaceRoutes);
    },
    { prefix: '/api' }
  );

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, 'Request failed');
    const requestError = error as Error & { code?: string; statusCode?: number };
    if (requestError.code === '23505') {
      return reply.status(409).send({ error: '该内容已经存在。' });
    }
    const statusCode =
      requestError.statusCode && requestError.statusCode < 500 ? requestError.statusCode : 500;
    return reply.status(statusCode).send({
      error: statusCode < 500 ? requestError.message : '服务器暂时无法处理请求。',
    });
  });

  return app;
}
