# Drizzle Migration

Status: runtime migration complete; versioned SQL migrations enabled
Date: 2026-10-25

## Decision

HRFlow Pro uses Drizzle as the backend runtime query layer and schema
source of truth on top of the existing `pg` pool exposed by
`DatabaseService.drizzle`.

Drizzle owns:

- table/index/constraint mapping in `apps/backend/src/database/drizzle/schema.ts`
- versioned SQL migrations in `apps/backend/drizzle/` (`drizzle-kit generate`, applied by `src/scripts/migrate.ts`)
- idempotent seed data through `apps/backend/src/database/seeds.ts`
- runtime service queries through `DatabaseService.drizzle`

The old parked Prisma schema and unused Prisma backend packages were removed.
Prisma is no longer a backend runtime dependency.

## Migrated Runtime Domains

Runtime service reads, writes, joins, aggregates, and transactions now use
Drizzle for:

- org reference
- auth/accounts
- employee directory
- locations and employee location assignments
- attendance
- leave
- policy documents
- recruitment
- payroll
- reports
- health check

Drizzle table mappings live in:

```text
apps/backend/src/database/drizzle/schema.ts
```

## Remaining SQL Boundary

The old hand-written startup DDL file was removed. Application runtime services
should not call generic raw `pg` helpers, and `DatabaseService` no longer exposes
`query`, `one`, `many`, or `transaction`.

Remaining SQL text is limited to Drizzle-mediated SQL expressions where the
query builder needs Postgres expressions, for example `NOW()`, `LOWER(...)`,
`EXISTS`, date-range overlap, aggregate ordering, and health-check `SELECT 1`.
Drizzle also prints generated SQL in `drizzle:check` output.

Use these audits:

```bash
rg -n "database\.(query|one|many|transaction)\(" apps/backend/src
rg -n "DATABASE_SCHEMA_STATEMENTS|DATABASE_SEED_STATEMENTS|CREATE TABLE IF NOT EXISTS" apps/backend/src
```

Expected result: no matches.

The remaining Drizzle expression fragments can be inspected with:

```bash
rg -n 'sql`|\.execute\(sql' apps/backend/src
```

## Tooling

Backend scripts:

```bash
bun run --cwd apps/backend db:generate          # drizzle-kit generate -> new SQL migration
bun run --cwd apps/backend migrate:deploy       # apply migrations, then seed verification
bun run --cwd apps/backend drizzle:migration-check
bun run --cwd apps/backend schema:push          # LOCAL DEV ONLY
bun run --cwd apps/backend schema:seed
bun run --cwd apps/backend drizzle:check
```

Config: `apps/backend/drizzle.config.ts` (`strict: true`).

## Migration Flow

1. Edit `apps/backend/src/database/drizzle/schema.ts`.
2. `bun run db:generate` (optionally `-- --name <name>`), then review the SQL. A rename or type change is generated as drop + add unless you rewrite it; never accept that on live data without a backup and a data-preserving rewrite.
3. Commit the `.sql` file and the `meta/` snapshot and journal.
4. Deploy runs `migrate:deploy`:
   `node dist/src/scripts/migrate.js && node dist/src/scripts/ensure-schema.js`.

`migrate.js` (compiled from `src/scripts/migrate.ts`):

- takes a Postgres advisory lock so concurrent deploys serialize;
- resolves the migrations folder as `apps/backend/drizzle` relative to the compiled file (the backend Dockerfile copies it into the runtime image);
- applies pending migrations using drizzle's node-postgres migrator (history in `drizzle.__drizzle_migrations`);
- baseline adoption: if the history table is absent or empty and `public.users` already exists (databases created by `drizzle-kit push`), the first journal entry (`0000_baseline`) is recorded as applied with the same hash and timestamp drizzle uses, without executing its SQL; later migrations then run normally;
- logs what it did.

`schema:push` bypasses migration history and can drop data on renames; use it only on a disposable local database.

Rollback is forward-only: restore from backup or add a corrective migration.

## Proof

Proof used during the migration:

```bash
bun run build:backend
bun run --cwd apps/backend test:unit
bun run --cwd apps/backend drizzle:check
NODE_ENV=test bun run --cwd apps/backend test -- mobile-self-service.spec.ts --runInBand
NODE_ENV=test bun run --cwd apps/backend test -- recruitment-drizzle.spec.ts --runInBand
NODE_ENV=test bun run --cwd apps/backend test -- policy-drizzle.spec.ts --runInBand
NODE_ENV=test bun run --cwd apps/backend test -- reports-drizzle.spec.ts --runInBand
```

The full mobile suite is still the broadest central-DB proof, but it is
infrastructure-bound and can time out in `AppModule`/GraphQL setup when the
central database is slow. Focused service integration specs exist for narrower
Drizzle migration proof.
