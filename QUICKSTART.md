# HRFlow Pro Quick Start

This quick start follows the current Bun monolith implementation branch.

## 1. Install

```bash
git clone <your-repo-url>
cd rakss
bun install
```

## 2. Configure Environment

```bash
cp .env.example .env
```

The defaults are set up for local development with PostgreSQL on Docker and the backend on `http://localhost:4001/graphql`.

Optional isolated test runs should use the NexOS project contract instead of
writing env-specific files into the repo:

```bash
nexos secrets exec --project /home/nova/projects/work/rakss --env test -- bun run test:backend
```

## 3. Start PostgreSQL

```bash
docker compose up -d postgres
docker compose ps
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

- `http://localhost:5173`

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
- Database schema sync runs through the Drizzle migration command; backend startup verifies the connection and seed data.
- Shared test credentials are resolved through `.nexos/env.yaml` and NexOS.
