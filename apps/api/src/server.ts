import { buildApp } from './app.js';
import { config } from './config.js';
import { closeDatabase } from './db/index.js';
import { migrateDatabase } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';

if (config.RUN_MIGRATIONS) {
  await migrateDatabase();
  await seedDatabase();
}

const app = await buildApp();

const shutdown = async () => {
  await app.close();
  await closeDatabase();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: config.HOST, port: config.PORT });
