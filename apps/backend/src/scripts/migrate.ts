import { drizzle } from 'drizzle-orm/node-postgres';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import { Client } from 'pg';

// Compiled to dist/src/scripts/migrate.js; the migrations live in apps/backend/drizzle.
export const DEFAULT_MIGRATIONS_FOLDER = path.resolve(__dirname, '../../../drizzle');

// Arbitrary constant key for pg_advisory_lock so concurrent deploys serialize.
const ADVISORY_LOCK_KEY = 7261737373;

const MIGRATIONS_SCHEMA = 'drizzle';
const MIGRATIONS_TABLE = '__drizzle_migrations';
const HISTORY_TABLE = `"${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`;

export type Queryable = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
};

export type MigrationLogger = (message: string) => void;

async function countApplied(client: Queryable): Promise<number> {
  const table = await client.query(`select to_regclass('${HISTORY_TABLE}') as name`);
  if (!table.rows[0]?.name) {
    return 0;
  }
  const result = await client.query(`select count(*)::int as count from ${HISTORY_TABLE}`);
  return result.rows[0].count;
}

/**
 * Databases created by `drizzle-kit push` have the schema but no migration
 * history. If the history table is absent/empty and `users` already exists,
 * record the baseline (first journal entry) as applied exactly like drizzle's
 * migrator would (sha256 of the sql file, journal `when`) so its SQL is not
 * executed. Returns true when the baseline was adopted.
 */
export async function adoptBaselineIfNeeded(
  client: Queryable,
  migrationsFolder: string,
  log: MigrationLogger,
): Promise<boolean> {
  const migrations = readMigrationFiles({ migrationsFolder });
  if (migrations.length === 0 || (await countApplied(client)) > 0) {
    return false;
  }

  const users = await client.query(`select to_regclass('public.users') as name`);
  if (!users.rows[0]?.name) {
    return false;
  }

  const baseline = migrations[0];
  await client.query(`create schema if not exists "${MIGRATIONS_SCHEMA}"`);
  await client.query(
    `create table if not exists ${HISTORY_TABLE} (id serial primary key, hash text not null, created_at bigint)`,
  );
  await client.query(`insert into ${HISTORY_TABLE} ("hash", "created_at") values ($1, $2)`, [
    baseline.hash,
    baseline.folderMillis,
  ]);
  log(
    `Existing schema detected without migration history (created by drizzle-kit push); recorded baseline ${baseline.hash.slice(0, 12)} as applied without executing it.`,
  );
  return true;
}

export async function runMigrations(
  client: Client,
  migrationsFolder: string = DEFAULT_MIGRATIONS_FOLDER,
  log: MigrationLogger = console.log,
): Promise<{ adoptedBaseline: boolean; applied: number }> {
  const total = readMigrationFiles({ migrationsFolder }).length;
  log(`Acquiring migration advisory lock (${total} migration(s) in journal)...`);
  await client.query('select pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
  try {
    const adoptedBaseline = await adoptBaselineIfNeeded(client, migrationsFolder, log);
    const before = await countApplied(client);
    await migrate(drizzle(client), {
      migrationsFolder,
      migrationsSchema: MIGRATIONS_SCHEMA,
      migrationsTable: MIGRATIONS_TABLE,
    });
    const after = await countApplied(client);
    const applied = after - before;
    log(
      applied > 0
        ? `Applied ${applied} migration(s); ${after}/${total} recorded.`
        : `No pending migrations; ${after}/${total} recorded.`,
    );
    return { adoptedBaseline, applied };
  } finally {
    await client.query('select pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run migrations.');
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await runMigrations(client);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Database migration failed.');
    console.error(error);
    process.exit(1);
  });
}
