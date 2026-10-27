# HRFlow Pro Quick Start

This quick start follows the current Bun monolith implementation branch.

## 1. Install

```bash
git clone <your-repo-url>
cd hr-workflow
bun install
```

## 2. Configure Environment

```bash
cp .env.example .env
```

Set `JWT_SECRET` in `.env` (32+ random characters, e.g. `openssl rand -base64 48`); compose will not start without it. Optionally set `HR_WORKFLOW_ADMIN_EMAIL` and `HR_WORKFLOW_ADMIN_PASSWORD` to seed the first admin. The defaults are set up for local development with PostgreSQL on Docker and the backend on `http://localhost:4001/graphql`.

Optional isolated test runs should use the NexOS project contract instead of
writing env-specific files into the repo:

```bash
nexos secrets exec --project /home/nova/projects/work/hr-workflow --env test -- bun run test:backend
```

## 3. Start PostgreSQL

```bash
docker compose up -d postgres
docker compose ps
```

Create the tables for a fresh local database (dev only; production uses versioned migrations):

```bash
bun run --cwd apps/backend schema:push
```

## 4. Start the Backend

```bash
bun run dev:backend
```

Backend endpoints:

- GraphQL: `http://localhost:4001/graphql`
- Health: `http://localhost:4001/health`

## 5. Start the Admin Portal

```bash
bun run dev:web-admin
```

Admin UI:

- `http://localhost:5173` (its dev server proxies `/graphql` to `http://localhost:4001`; override with `VITE_DEV_API_PROXY`)

## 6. Optional Mobile App

```bash
bun run dev:mobile
```

If you need a physical device or emulator, point mobile to the backend using `EXPO_PUBLIC_GRAPHQL_ENDPOINT` in `.env`.

## 7. Verify the Workspace

```bash
bun run build
```

This runs:

- backend build
- web admin build
- mobile TypeScript check

## Common Commands

```bash
# Start backend only
bun run dev:backend

# Start admin only
bun run dev:web-admin

# Start mobile
bun run dev:mobile

# Run backend tests
bun run test

# Build everything currently verified in the repo
bun run build

# Docker helpers
bun run docker:up
bun run docker:down
```

## Notes

- The active implementation is the modular monolith in `apps/backend`.
- Legacy `services/*` and `apps/api-gateway` have been removed from the active codebase.
- Schema changes: edit `schema.ts` -> `bun run db:generate` -> commit the SQL in `apps/backend/drizzle/` -> `bun run migrate:deploy`. `schema:push` is local-dev only.
- Backend startup verifies the connection and seed data.
- Shared test credentials are resolved through `.nexos/env.yaml` and NexOS.
