# HRFlow Pro Implementation Status

**Date:** October 28, 2026
**Supported runtime:** Bun modular monolith
**Status:** Core product implemented and live on the homelab; operations hardening deferred

## Current Architecture

HRFlow Pro now has one supported runtime path:

- `apps/backend` - NestJS GraphQL backend on PostgreSQL through Drizzle (migrations in `apps/backend/drizzle`)
- `apps/web-admin` - React admin portal
- `apps/mobile` - Expo mobile employee portal
- `docker-compose.yml` and `docker-compose.dev.yml` - local PostgreSQL plus backend runtime

The old gateway and microservice topology is retired. Do not add new product
work under `apps/api-gateway`, `services/*`, or a root `web-admin/` tree.

## Implemented Product Surface

### Backend

- Auth, JWT sessions, role assignments, and account provisioning
- Company settings, departments, and designations
- Employee management
- Location assignments and geofenced attendance
- Leave types, balances, requests, approvals, and withdrawal of a pending request
- Attendance status for the company's calendar day (`attendanceStatus`)
- Payroll setup, period processing, payslips, single and per-period PDF export
- Policy document metadata and file-serving endpoints
- Recruitment requisitions and applications
- Reporting dashboard and report export
- Health endpoint

### Admin Portal

- Real login and role-gated admin shell
- Dashboard backed by GraphQL reports
- Employee, directory, attendance, leave, payroll, recruitment, reports, and policy screens
- Production route bundle is split by page; demo source has been removed from the admin app

### Mobile App

- Real login session storage
- Auth-gated tab shell
- Attendance, leave (including cancelling a pending request), payslip, and profile flows backed by GraphQL
- Clock-in state follows the company time zone from the API, falling back to the phone's date on an older backend

## Verified Commands

Use these commands as the current baseline:

```bash
bun run build
bun run test:backend:unit
bun run test:backend   # needs DATABASE_URL to a migrated test database and JWT_SECRET
```

Verification on 2026-10-28 (local, throwaway PostgreSQL 17):

- `bun run build:backend`, `bun run build:web-admin` and `bun run typecheck:mobile` passed.
- Unit tests: 12 suites, 101 tests passed.
- Integration tests: 14 suites, 96 tests passed.
- Admin UI lifecycle sweep (`scripts/e2e/run-hr-workflow-ui-lifecycle.mjs`) against a fresh local stack: 51 checks, 0 gaps.

## Production Proof

Done 2026-10-27, recorded in `docs/handoffs/2026-10-27-hrflow-release-and-rename.md` and
`docs/handoffs/2026-10-27-hr-workflow-rename.md`:

- Deployed through `homelab apps ship hr-workflow`; backend and admin health checks pass on
  https://api.hrflow.lab.novadev.tech and https://admin.hrflow.lab.novadev.tech.
- Migrations 0000–0002 applied in production; a verified backup was taken before the cutover.
- The UI lifecycle sweep passed 49/49 with 0 gaps on a fresh stack before release.

## Remaining Work

- **Restore drill:** backups are taken and verified, but a restore into a scratch database has not been rehearsed.
- **CI:** not planned for now (decided 2026-10-28); run the commands above before each release.
- **Monitoring, alerting, log aggregation, error tracking, load checks:** deferred (2026-10-28). These belong to the
  homelab monitoring stack (`nexos-homelab`), not this repo.
- **Server paging** for employees, leave and attendance, and server-side search: deferred; client-side filtering is
  fine at today's data size.

## Reference Docs

- [README](../README.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Modular Monolith Rebuild Plan](./MODULAR_MONOLITH_REBUILD_PLAN.md)
- [Product Requirements](../PRD.md)
