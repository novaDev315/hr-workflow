# Drizzle Migration

Status: runtime service migration complete
Date: 2026-07-01

## Decision

Rakss now uses Drizzle as the backend runtime query layer on top of the existing
`pg` pool exposed by `DatabaseService.drizzle`.

Raw SQL/Postgres remains the schema and seed owner until a separate versioned
migration phase is approved:

- `apps/backend/src/database/schema.ts`
- `apps/backend/src/database/seeds.ts`
- `apps/backend/src/database/database.service.ts`

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

## Remaining Raw SQL Boundary

The remaining raw SQL is intentional infrastructure/schema ownership, not
service query ownership:

- startup schema creation in `schema.ts`
- seed data in `seeds.ts`
- the low-level `pg` helper methods retained on `DatabaseService`
- integration-test fixture setup/cleanup where direct SQL is still used

Application runtime services should not call:

```text
database.query(...)
database.one(...)
database.many(...)
database.transaction(...)
```

Use this audit:

```bash
rg -n "database\.(query|one|many|transaction)\(" apps/backend/src \
  --glob '!database/database.service.ts' \
  --glob '!database/schema.ts' \
  --glob '!database/seeds.ts' \
  --glob '!**/__tests__/*.spec.ts'
```

Expected result: no matches.

## Tooling

Backend scripts:

```bash
bun run --cwd apps/backend drizzle:check
bun run --cwd apps/backend drizzle:generate
bun run --cwd apps/backend drizzle:migration-check
bun run --cwd apps/backend drizzle:pull
```

Config:

```text
apps/backend/drizzle.config.ts
```

`drizzle:check` validates that the mapped schema can be exported as Postgres
DDL. `drizzle:migration-check` is reserved for the later versioned-migration
phase.

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
