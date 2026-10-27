# HRFlow Pro

HRFlow Pro is a Bun-based HR platform with a NestJS modular monolith backend, a React admin portal, and an Expo mobile app.

## Current Stack

- `apps/backend` - NestJS GraphQL backend on Bun
- `apps/web-admin` - React admin portal
- `apps/mobile` - Expo mobile app
- `docker-compose.yml` - local PostgreSQL plus backend runtime
- `docker-compose.dev.yml` - local PostgreSQL plus backend watch mode

Legacy `services/*`, `apps/api-gateway`, and the root `web-admin/` directory have been removed. The Bun monolith is now the only supported runtime path in this repository.

## Quick Start

### Prerequisites

- Bun `1.3.9+`
- Docker with Compose
- Node.js `18+` for tool compatibility

### Local Setup

```bash
git clone <your-repo-url>
cd hr-workflow

bun install
cp .env.example .env   # then set JWT_SECRET

docker compose up -d postgres
bun run --cwd apps/backend schema:push   # local dev only
bun run dev:backend
```

In a second terminal:

```bash
bun run dev:web-admin
```

Optional mobile app:

```bash
bun run dev:mobile
```

## Useful Commands

```bash
# Backend
bun run dev:backend
bun run build:backend
bun run test:backend

# Admin portal
bun run dev:web-admin
bun run build:web-admin

# Mobile
bun run dev:mobile
bun run typecheck:mobile

# Full verification used in this repo
bun run build

# Docker helpers
bun run docker:up
bun run docker:down
```

## Environment

The main backend settings are:

- `BACKEND_PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRY`
- `ALLOWED_ORIGINS`
- `VITE_GRAPHQL_ENDPOINT`
- `EXPO_PUBLIC_GRAPHQL_ENDPOINT`
- `HR_WORKFLOW_ADMIN_EMAIL` / `HR_WORKFLOW_ADMIN_PASSWORD` (first admin seeding), `BOOTSTRAP_ALLOWED`, `TRUST_PROXY`

`JWT_SECRET` must be set (32+ random characters) and `ALLOWED_ORIGINS` is required in production. The web-admin dev server proxies `/graphql` to `http://localhost:4001` (override with `VITE_DEV_API_PROXY`).

See [.env.example](./.env.example) for a working local template.

Homelab runtime and test secrets are resolved through the project contract in
[.nexos/env.yaml](./.nexos/env.yaml). Do not commit or depend on `.env.*` files
for deploys or shared test runs; use NexOS to render the target environment:

```bash
nexos secrets exec --project /home/nova/projects/work/hr-workflow --env test -- bun run test:backend
```

## Database Migrations

Schema changes are versioned SQL migrations in `apps/backend/drizzle/`:

1. Edit `apps/backend/src/database/drizzle/schema.ts`.
2. `bun run db:generate` and review the generated SQL (never accept a destructive drop+add for a rename without a restore plan).
3. Commit the SQL and `meta/` files.
4. Deploy runs `bun run migrate:deploy` (`node dist/src/scripts/migrate.js && node dist/src/scripts/ensure-schema.js`): applies pending migrations under a Postgres advisory lock, then verifies seed data. Databases originally created by `drizzle-kit push` are adopted automatically (baseline recorded, not re-executed).

`bun run --cwd apps/backend schema:push` is **local development only**; never run it against a shared or production database.

## Implemented Modules

- Auth and account provisioning
- Company settings, departments, and designations
- Employee management
- Location assignment and geofenced attendance
- Leave balances, requests, and approvals
- Payroll setup, processing, and payslips
- Policy document management
- Live reporting dashboard

## Documentation

- [Product Requirements](./PRD.md)
- [Development Plan](./docs/DEVELOPMENT_PLAN.md)
- [Implementation Decisions](./docs/IMPLEMENTATION_DECISIONS.md)
- [Modular Monolith Rebuild Plan](./docs/MODULAR_MONOLITH_REBUILD_PLAN.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## Verification

The current monolith workflow has been repeatedly verified with:

```bash
bun run build:backend
bun run --cwd apps/web-admin build
bunx tsc --noEmit -p apps/mobile/tsconfig.json
bun run test:backend
```

## License

Copyright (C) 2026 Mohamed (NovaDev).

HR Workflow is free software under the GNU Affero General Public License v3.0 or later: see
[LICENSE](LICENSE). If you run a modified version as a network service, you must offer its users the
source of that version.
