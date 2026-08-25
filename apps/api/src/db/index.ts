import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.js';
import * as schema from './schema.js';

export const sql = postgres(config.DATABASE_URL, {
  max: config.NODE_ENV === 'test' ? 2 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(sql, { schema });

export async function closeDatabase() {
  await sql.end({ timeout: 5 });
}
