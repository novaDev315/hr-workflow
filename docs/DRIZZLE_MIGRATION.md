# Drizzle Migration

Status: runtime service and schema bootstrap migration complete
Date: 2026-07-01

## Decision

Rakss now uses Drizzle as the backend runtime query layer and explicit schema
sync surface on top of the existing `pg` pool exposed by
`DatabaseService.drizzle`.

Drizzle owns:

- table/index/constraint mapping in `apps/backend/src/database/drizzle/schema.ts`
- schema synchronization through `drizzle-kit push`
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
bun run --cwd apps/backend schema:push
bun run --cwd apps/backend schema:seed
bun run --cwd apps/backend schema:ensure
bun run --cwd apps/backend migrate:deploy
bun run --cwd apps/backend drizzle:check
bun run --cwd apps/backend drizzle:generate
bun run --cwd apps/backend drizzle:migration-check
bun run --cwd apps/backend drizzle:pull
```

Config:

```text
apps/backend/drizzle.config.ts
```

`schema:ensure` runs Drizzle schema sync first, then the compiled backend script
calls `DatabaseService.verifyConnection()` and `DatabaseService.ensureSeedData()`
directly. Backend startup uses the same explicit methods during Nest module
initialization, but migration verification does not depend on calling the
lifecycle method as an API. `drizzle:check` validates that the mapped schema can
be exported as Postgres DDL.

Generated SQL migrations are not enabled yet. `drizzle:migration-check` remains
reserved for a later versioned-migration phase.

## Versioned Migration Lane

The current production lane is explicit Drizzle push-sync. It is acceptable for
the completed bootstrap migration, but future structural changes should move to
reviewed SQL migration files before they touch production.

Adopt the versioned lane in a separate phase with this gate:

1. Prove the current schema export is clean:
   `bun run --cwd apps/backend drizzle:check`.
2. Generate migration SQL from the Drizzle schema:
   `bun run --cwd apps/backend drizzle:generate`.
3. Review the generated files under `apps/backend/drizzle/`; do not accept
   destructive SQL without a named rollback or restore plan.
4. In that same phase, switch `migrate:deploy` from `schema:ensure` to a
   reviewed generated-migration command such as
   `drizzle-kit migrate --config drizzle.config.ts`, followed by seed
   verification.
5. Rehearse the switched command against the NexOS test environment:
   `nexos secrets exec --project /home/nova/projects/work/rakss --env test -- bun run --cwd apps/backend migrate:deploy`.
6. Back up production before live migration:
   `nexos secrets exec --project /home/nova/projects/work/rakss --env production -- <backup command>`.
7. Ship through Homelab so deploy and migration use the same NexOS-rendered
   production environment.

Do not replace the production migration command with generated migrations until
the test rehearsal and backup path are proven in the same phase.

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
