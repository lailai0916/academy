import type { FastifyReply } from 'fastify';
import type { ZodType } from 'zod';

export function parseBody<T>(schema: ZodType<T>, body: unknown, reply: FastifyReply): T | null {
  const result = schema.safeParse(body);
  if (result.success) {
    return result.data;
  }
  const details: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'form';
    details[key] ??= [];
    details[key].push(issue.message);
  }
  reply.status(400).send({ error: '提交内容不符合要求。', details });
  return null;
}

export function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId) {
    throw new Error('Authenticated route is missing a user id.');
  }
}
