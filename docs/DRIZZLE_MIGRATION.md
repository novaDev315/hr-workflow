# Drizzle Migration

Status: first backend slice implemented
Date: 2026-07-01

## Decision

Rakss is moving toward Drizzle incrementally, not through a big-bang database
rewrite.

Raw SQL/Postgres remains the runtime schema owner for now:

- `apps/backend/src/database/schema.ts`
- `apps/backend/src/database/seeds.ts`
- `apps/backend/src/database/database.service.ts`

Drizzle is introduced as a sidecar query layer on the existing `pg` pool through
`DatabaseService.drizzle`. This keeps raw SQL available for complex domains while
allowing low-risk service methods to migrate one domain at a time.

## Implemented Slice

The first migrated domain is org-reference:

- `apps/backend/src/database/drizzle/schema.ts`
- `apps/backend/src/org-reference/company-settings.service.ts`
- `apps/backend/src/org-reference/department.service.ts`
- `apps/backend/src/org-reference/designation.service.ts`
- `apps/backend/src/__tests__/org-reference-drizzle.spec.ts`

This slice proves:

- snake_case database columns mapped to TypeScript-friendly Drizzle fields
- select/query filtering
- insert with returning
- update with `NOW()`
- upsert with conflict handling
- joins from designations to departments
- duplicate conflict checks
- real central-DB integration proof

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

The current Drizzle schema is intentionally partial. It should expand only when
a backend domain is actually migrated and proven.

`drizzle:check` currently validates that the sidecar schema can be exported as
Postgres DDL. `drizzle:migration-check` requires committed Drizzle migration
metadata under `apps/backend/drizzle/`, so it is reserved for the later
versioned-migration phase.

## Migration Rules

- Keep `DatabaseService.query`, `one`, `many`, and `transaction` until all
  domains that need them are migrated or consciously left as SQL.
- Keep runtime schema creation in `schema.ts` until versioned migrations are
  introduced as a separate phase.
- Migrate one domain per slice.
- Add or extend integration proof for each migrated domain.
- Do not migrate reports/payroll first; they rely heavily on aggregate SQL and
  should move only after simpler CRUD domains have established the pattern.

Suggested next order:

1. Auth role lookup helpers, excluding login/session mutation paths.
2. Employee read helpers.
3. Location assignment CRUD.
4. Leave type CRUD.
5. Recruitment read/query helpers.
6. Payroll/reporting only after the simpler domains are stable.

## Proof

Minimum proof for each slice:

```bash
bun run build:backend
bun run --cwd apps/backend test:unit
bun run test:backend
```

For deployable backend changes, run the live admin lifecycle sweep after deploy.
