import type { FastifyInstance } from 'fastify';
import {
  courseAssistanceRequestSchema,
  courseQuestionRequestSchema,
  courseStepAnswerSchema,
  courseStepCompleteSchema,
} from '@lailai/academy-shared';
import { parseBody } from '../lib/http.js';
import {
  answerCourseStep,
  askCourseQuestion,
  completeCourseStep,
  getCourseDetail,
  getCourseList,
  getCourseRun,
  requestCourseAssistance,
  startCourseRun,
} from '../services/courses.js';

export async function courseRoutes(app: FastifyInstance) {
  app.get('/courses', { preHandler: app.requireAuth }, async (request) => ({
    courses: await getCourseList(request.user!.id),
  }));

  app.get<{ Params: { slug: string } }>(
    '/courses/:slug',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const detail = await getCourseDetail(request.user!.id, request.params.slug);
      return detail ?? reply.status(404).send({ error: '课程不存在。' });
    }
  );

  app.post<{ Params: { slug: string } }>(
    '/courses/:slug/start',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const result = await startCourseRun(request.user!.id, request.params.slug);
      if (result.status === 'missing') {
        return reply.status(404).send({ error: '课程不存在。' });
      }
      if (result.status === 'scheduled') {
        const date = result.dueAt
          ? new Intl.DateTimeFormat('zh-CN', {
              timeZone: 'Asia/Shanghai',
              month: 'long',
              day: 'numeric',
            }).format(new Date(result.dueAt))
          : '稍后';
        return reply.status(409).send({ error: '延迟复测将在' + date + '开放。' });
      }
      return reply.status(result.resumed ? 200 : 201).send(result);
    }
  );

  app.get<{ Params: { runId: string } }>(
    '/course-runs/:runId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const run = await getCourseRun(request.user!.id, request.params.runId);
      return run ? { run } : reply.status(404).send({ error: '课程记录不存在。' });
    }
  );

  app.post<{ Params: { runId: string } }>(
    '/course-runs/:runId/complete',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const body = parseBody(courseStepCompleteSchema, request.body, reply);
      if (!body) return;
      const result = await completeCourseStep(request.user!.id, request.params.runId, body.stepId);
      return result
        ? { result }
        : reply.status(409).send({ error: '课程步骤已变化，请重新加载。' });
    }
  );

  app.post<{ Params: { runId: string } }>(
    '/course-runs/:runId/answer',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const body = parseBody(courseStepAnswerSchema, request.body, reply);
      if (!body) return;
      const result = await answerCourseStep(
        request.user!.id,
        request.params.runId,
        body.stepId,
        body.answer
      );
      return result
        ? { result }
        : reply.status(409).send({ error: '课程步骤已变化，请重新加载。' });
    }
  );

  app.post<{ Params: { runId: string } }>(
    '/course-runs/:runId/assistance',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const body = parseBody(courseAssistanceRequestSchema, request.body, reply);
      if (!body) return;
      const assistance = await requestCourseAssistance(
        request.user!.id,
        request.params.runId,
        body.stepId,
        body.kind
      );
      return assistance
        ? { assistance }
        : reply.status(409).send({ error: '当前步骤不提供这项帮助。' });
    }
  );

  app.post<{ Params: { runId: string } }>(
    '/course-runs/:runId/questions',
    {
      preHandler: app.requireAuth,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const body = parseBody(courseQuestionRequestSchema, request.body, reply);
      if (!body) return;
      try {
        const branch = await askCourseQuestion(
          request.user!.id,
          request.params.runId,
          body.stepId,
          body.question
        );
        if (branch === 'unconfigured') {
          return reply.status(409).send({ error: '管理员尚未配置 AI 服务。' });
        }
        return branch
          ? reply.status(201).send({ branch })
          : reply.status(409).send({ error: '当前步骤不能发起追问。' });
      } catch (error) {
        request.log.error({ error }, 'Course question failed');
        return reply.status(502).send({ error: 'AI 暂时无法回答，请稍后重试。' });
      }
    }
  );
}
