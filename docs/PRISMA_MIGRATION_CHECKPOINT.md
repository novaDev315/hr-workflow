# Prisma Migration Checkpoint

Status: superseded by Drizzle runtime migration
Date: 2026-07-01
Owner repo: `/home/nova/projects/work/hr-workflow`

## Verdict

Do not start the optional Prisma ownership migration from this tree.

This checkpoint is now historical. The later Drizzle migration removed the
parked Prisma schema and unused Prisma backend packages. Drizzle is the backend
runtime query layer and explicit schema sync surface. Generated Drizzle
migrations can be added later as a separate versioned-migration phase.

The current runtime database owner is Drizzle through `DatabaseService`,
`drizzle/schema.ts`, and `seeds.ts`. The former parked Prisma schema was not
ready to become runtime truth: it covered only auth and org-reference tables,
did not map the real snake_case column names, and did not model most of the
tables currently used by the backend.

Phase 12 is therefore closed as superseded, not executed. A future Prisma
attempt would need to reintroduce Prisma deliberately with a separate
domain-by-domain migration plan, backups, and proof after each domain.

## Sources Inspected

- `apps/backend/src/database/database.service.ts`
- `apps/backend/src/database/drizzle/schema.ts`
- `apps/backend/src/database/seeds.ts`
- former `apps/backend/prisma/schema.prisma` checkpoint state
- Backend service modules under `apps/backend/src/**`
- `apps/backend/package.json`
- `package.json`

## Runtime Schema Truth

The runtime schema was historically created idempotently by
`DATABASE_SCHEMA_STATEMENTS` and seeded by `DATABASE_SEED_STATEMENTS`. That
hand-written bootstrap path has since been replaced by Drizzle schema sync plus
Drizzle seed inserts.

| Runtime table | Domain | Prisma coverage |
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

Drizzle schema now maps the later `policy_documents` file metadata columns,
`users.employee_id`, the user/employee foreign key, and the indexes for user
roles, org reference, employees, location assignments, attendance, leave,
payroll, policy, and recruitment.

Seed data is not represented by Prisma migrations. It is now represented by
Drizzle seed inserts:

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

At the time of the checkpoint, the backend was built around a thin `pg`
abstraction:

- `query`
- `one`
- `many`
- `transaction`

Historical direct `DatabaseService` call references by runtime file:

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
- Runtime schema sync currently happens through Drizzle, not a Prisma migration
  ledger.
- Reports and payroll rely on SQL aggregations and joins that do not map cleanly
  to simple Prisma CRUD calls.
- Production deploy uses `migrate:deploy`, which now means Drizzle schema sync
  followed by Drizzle seed verification.
- The central-DB integration test is the safety proof and must remain green
  after every domain migration.

## Phase 12 Decision

Phase 12 is not executed from this checkpoint and was superseded by the Drizzle
runtime query migration.

The safe closeout for the original phased plan became:

1. Use Drizzle for backend runtime service queries.
2. Use Drizzle schema sync and Drizzle seed inserts for database bootstrap.
3. Remove the parked Prisma schema and unused Prisma backend packages.
4. Do not reintroduce Prisma without a new approval and migration plan.

## Future Prisma Start Gate

A future Prisma migration can start only after these are true:

- A new `schema.prisma` fully covers all raw SQL tables, indexes, constraints,
  and relations with correct `@map(...)` and `@@map(...)` annotations.
- Seed behavior has an explicit Prisma-compatible owner or remains clearly owned
  by Drizzle.
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
