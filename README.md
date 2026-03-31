# HRFlow Pro

HRFlow Pro is a Bun-based HR platform with a NestJS modular monolith backend, a React admin portal, and an Expo mobile app.

## Current Stack

- `apps/backend` - NestJS GraphQL backend on Bun
- `apps/web-admin` - React admin portal
- `apps/mobile` - Expo mobile app
- `docker-compose.yml` - local PostgreSQL plus backend runtime
- `docker-compose.dev.yml` - local PostgreSQL plus backend watch mode

Legacy `services/*`, `apps/api-gateway`, and the root `web-admin/` directory remain in the repository as reference material from the earlier architecture. They are not the primary runtime path for current development.

## Quick Start

### Prerequisites

- Bun `1.3.9+`
- Docker with Compose
- Node.js `18+` for tool compatibility

### Local Setup

```bash
git clone <your-repo-url>
cd rakss

bun install
cp .env.example .env

docker compose up -d postgres
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

See [.env.example](/home/nova/projects/work/rakss/.env.example) for a working local template.

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
```
