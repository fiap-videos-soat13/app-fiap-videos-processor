import { getDb, resetDatabase, runMigrations, closeDb } from '@adapter/infra/database/client';
import * as schema from '@adapter/infra/database/schema';

const DEFAULT_TEST_DATABASE_URL =
  'postgresql://fiap:fiap@localhost:5433/fiap_videos_processor_test';

function assertTestDatabase(url: string): void {
  if (!url.includes('_test')) {
    throw new Error(
      `Refusing to run integration tests against a non-test database: ${url}`,
    );
  }
}

export async function setupTestDatabase(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim() || DEFAULT_TEST_DATABASE_URL;
  assertTestDatabase(url);
  await resetDatabase(url);
  await runMigrations();
}

export async function clearTables(): Promise<void> {
  const db = getDb();
  await db.delete(schema.outboxDeadLetters);
  await db.delete(schema.outbox);
  await db.delete(schema.processedEvents);
  await db.delete(schema.processingJobs);
}

export async function closeTestDatabase(): Promise<void> {
  await closeDb();
}
