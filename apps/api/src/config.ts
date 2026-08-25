import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4100),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().min(1).default('postgres://academy:academy@127.0.0.1:5432/academy'),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  SESSION_COOKIE_NAME: z.string().min(1).default('academy_session'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  AI_CONFIG_ENCRYPTION_KEY: z
    .string()
    .min(32)
    .default('development-only-key-change-before-production'),
  BOOTSTRAP_ADMIN_USERNAME: z.string().default('admin'),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().default(''),
  RUN_MIGRATIONS: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
});

export const config = configSchema.parse(process.env);
