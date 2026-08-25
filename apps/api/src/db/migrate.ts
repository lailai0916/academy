import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { closeDatabase, db } from './index.js';

export async function migrateDatabase() {
  await migrate(db, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await migrateDatabase();
  await closeDatabase();
}
