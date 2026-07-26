import path from 'node:path';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema';

let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

const MIGRATIONS_FOLDER = path.join(__dirname, 'migrations');

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      throw new Error('DATABASE_URL is required');
    }
    pool = new Pool({ connectionString: url });
    db = drizzle({ client: pool, schema, casing: 'snake_case' });
  }
  return db;
}

export async function runMigrations(): Promise<void> {
  await migrate(getDb(), { migrationsFolder: MIGRATIONS_FOLDER });
}

export async function checkDatabaseConnectivity(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    client.release();
    return true;
  } catch {
    return false;
  }
}

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      throw new Error('DATABASE_URL is required');
    }
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
  db = null;
}

export async function resetDatabase(url?: string): Promise<void> {
  await closeDb();
  if (url) {
    process.env.DATABASE_URL = url;
  }
}
