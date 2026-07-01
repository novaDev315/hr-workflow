# Prisma Migration Checkpoint

Status: superseded by Drizzle runtime migration
Date: 2026-07-01
Owner repo: `/home/nova/projects/work/rakss`

## Verdict

Do not start the optional Prisma ownership migration from this tree.

This checkpoint is now historical. The later Drizzle migration removed the
parked Prisma schema and unused Prisma backend packages. Drizzle is the backend
runtime query layer; raw SQL/Postgres remains the schema and seed owner until a
separate versioned-migration phase is approved.

The current runtime database owner is explicit raw SQL/Postgres through
`DatabaseService`, `schema.ts`, and `seeds.ts`. The former parked Prisma schema
was not ready to become runtime truth: it covered only auth and org-reference
tables, did not map the real snake_case column names, and did not model most of
the tables currently used by the backend.

Phase 12 is therefore closed as superseded, not executed. A future Prisma
attempt would need to reintroduce Prisma deliberately with a separate
domain-by-domain migration plan, backups, and proof after each domain.

## Sources Inspected

- `apps/backend/src/database/database.service.ts`
- `apps/backend/src/database/schema.ts`
- `apps/backend/src/database/seeds.ts`
- former `apps/backend/prisma/schema.prisma` checkpoint state
- Backend service modules under `apps/backend/src/**`
- `apps/backend/package.json`
- `package.json`

## Runtime Schema Truth

The runtime schema is created idempotently by
`DATABASE_SCHEMA_STATEMENTS` and seeded by `DATABASE_SEED_STATEMENTS` during
backend startup and by `bun run --cwd apps/backend migrate:deploy`.

| Raw SQL table | Domain | Prisma coverage |
| --- | --- | --- |
| `users` | auth/accounts | partial, incompatible column mapping |
| `roles` | auth/accounts | partial, incompatible column mapping |
| `user_role_assignments` | auth/accounts | partial, incompatible column mapping and missing `user_id` index |
| `company_settings` | org reference | partial, incompatible column mapping |
| `departments` | org reference | partial, incompatible column mapping |
| `designations` | org reference | partial, incompatible column mapping |
| `employees` | employee directory | missing |
| `locations` | attendance/location | missing |
| `employee_location_assignments` | attendance/location | missing |
| `attendance_records` | attendance | missing |
| `leave_types` | leave | missing |
| `leave_requests` | leave | missing |
| `employee_compensations` | payroll | missing |
| `payroll_periods` | payroll | missing |
| `payslips` | payroll | missing |
| `policy_documents` | policy | missing |
| `job_requisitions` | recruitment | missing |
| `recruitment_applications` | recruitment | missing |

Raw SQL also owns later `ALTER TABLE` statements for `policy_documents` file
metadata, `users.employee_id`, and the `users_employee_id_fkey` constraint. It
owns index creation for user roles, org reference, employees, location
assignments, attendance, leave, payroll, policy, and recruitment.

Seed data is not represented by Prisma migrations:

- Default leave types: `CASUAL`, `SICK`, `EARNED`.
- Published policy documents: handbook, leave policy, and IT security policy.

## Prisma Schema Coverage Gaps

The removed `apps/backend/prisma/schema.prisma` checkpoint state defined:

- `SystemRoleKey`
- `User`
- `Role`
- `UserRoleAssignment`
- `CompanySettings`
- `Department`
- `Designation`

Even those models are not safe for runtime use yet. The schema maps table names
with `@@map(...)`, but most fields do not map real snake_case columns with
`@map(...)`.

Examples:

- Prisma `User.passwordHash` would look for `passwordHash`, while Postgres has
  `password_hash`.
- Prisma `User.firstName` and `User.lastName` would look for camelCase columns,
  while Postgres has `first_name` and `last_name`.
- Prisma `CompanySettings.singletonKey` would look for `singletonKey`, while
  Postgres has `singleton_key`.
- Prisma `Designation.departmentId` would look for `departmentId`, while
  Postgres has `department_id`.
- Raw SQL has `users.employee_id`; Prisma `User` has no employee relation.

That parked schema could validate syntactically but was not a usable generated
client contract for the existing database.

## Service Rewrite Surface

The backend is built around a thin `pg` abstraction:

- `query`
- `one`
- `many`
- `transaction`

Direct `DatabaseService` call references by runtime file:

| File | References |
| --- | ---: |
| `apps/backend/src/auth/auth.service.ts` | 26 |
| `apps/backend/src/payroll/payroll.service.ts` | 27 |
| `apps/backend/src/location/location.service.ts` | 18 |
| `apps/backend/src/leave/leave.service.ts` | 17 |
| `apps/backend/src/recruitment/recruitment.service.ts` | 17 |
| `apps/backend/src/employee/employee.service.ts` | 17 |
| `apps/backend/src/policy/policy.service.ts` | 12 |
| `apps/backend/src/reports/reports.service.ts` | 11 |
| `apps/backend/src/org-reference/designation.service.ts` | 9 |
| `apps/backend/src/attendance/attendance.service.ts` | 8 |
| `apps/backend/src/org-reference/department.service.ts` | 7 |
| `apps/backend/src/org-reference/company-settings.service.ts` | 2 |
| `apps/backend/src/common/access-control.ts` | 1 |
| `apps/backend/src/health/health.controller.ts` | 1 |

This is not a dependency-injection rename. A real Prisma migration would need to
rewrite joins, aggregate reports, lateral subqueries, transactions, status
filters, generated payroll calculations, and policy/recruitment mutations.

## Migration Risk

Risk is high for the current tree because:

- `schema.prisma` is both incomplete and column-incompatible.
- There is no active Prisma module or Prisma client service in the Nest runtime.
- Runtime schema creation currently happens through startup SQL, not a Prisma
  migration ledger.
- Reports and payroll rely on SQL aggregations and joins that do not map cleanly
  to simple Prisma CRUD calls.
- Production deploy uses `migrate:deploy`, which currently means
  `schema:ensure`; replacing that must be treated as a deploy contract change.
- The central-DB integration test is the safety proof and must remain green
  after every domain migration.

## Phase 12 Decision

Phase 12 is not executed from this checkpoint and was superseded by the Drizzle
runtime query migration.

The safe closeout for the original phased plan became:

1. Keep raw SQL/Postgres ownership as schema and seed truth.
2. Use Drizzle for backend runtime service queries.
3. Remove the parked Prisma schema and unused Prisma backend packages.
4. Do not reintroduce Prisma without a new approval and migration plan.

## Future Prisma Start Gate

A future Prisma migration can start only after these are true:

- A new `schema.prisma` fully covers all raw SQL tables, indexes, constraints,
  and relations with correct `@map(...)` and `@@map(...)` annotations.
- Seed behavior has an explicit Prisma-compatible owner or remains clearly owned
  by raw SQL.
- A Prisma client service/module exists without changing existing runtime
  behavior.
- One backend domain is selected as the first slice; auth is still the likely
  first candidate, but only after the `users.employee_id` relation is modeled.
- `bun run build:backend` and `bun run test:backend` pass before and after the
  slice.
- Production data backups and rollback steps are documented before deploy.
- Prisma CLI validation works in the chosen execution environment. On this
  NixOS workstation, `apps/backend/node_modules/.bin/prisma validate --schema
  apps/backend/prisma/schema.prisma` could not fetch Prisma's `linux-nixos`
  query engine artifact; retrying with
  `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` still failed because the engine
  artifact returned `404 Not Found`.

## Proof Commands

Run after this checkpoint:

```bash
bun run build:backend
bun run test:backend
```

No database mutation or deploy is part of this checkpoint.
