# HRFlow Pro Deployment Guide

## Overview

HRFlow Pro now deploys as a Bun-based modular monolith:

- `apps/backend` serves the GraphQL API and policy file storage endpoints
- `apps/web-admin` is the admin portal
- `apps/mobile` is the employee and staff mobile client
- PostgreSQL is the only required infrastructure dependency for the core system

The previous gateway and microservice topology has been retired from this repository.

## Supported Modes

### Local Development

Use Docker Compose for local PostgreSQL and run the backend directly with Bun:

```bash
cp .env.example .env
docker compose up -d postgres
bun run dev:backend
```

In separate terminals:

```bash
bun run dev:web-admin
bun run dev:mobile
```

### Central Homelab Test Environment

For isolated integration testing, keep the database URL and secrets in the NexOS
project contract. `.nexos/env.yaml` declares the required keys; NexOS supplies
the target values at runtime:

```bash
nexos secrets exec --project /home/nova/projects/work/rakss --env test -- bun run test:backend
```

If a dedicated central database needs to be created or rotated, use the Homelab
database workflow and write the resulting secret through the NexOS project
environment, not a checked-in or repo-local `.env.*` file.

The backend reads already-exported environment variables first and only falls
back to `.env` for local development:

```bash
bun run test:backend
```

## Runtime Requirements

### Minimum Requirements

- Bun `1.3.9+`
- Node.js `18+` for ecosystem tooling
- PostgreSQL `15+`
- Linux host with at least:
  - 4 CPU cores
  - 8 GB RAM
  - 50 GB SSD storage

### Recommended Production Requirements

- 8 CPU cores
- 16 GB RAM
- 200 GB SSD storage
- Reverse proxy or internal load balancer in front of the backend and admin portal
- Managed backup path for PostgreSQL and policy file storage

## Environment Variables

### Required Backend Variables

```bash
NODE_ENV=production
BACKEND_PORT=4001
BACKEND_PUBLIC_URL=https://hr.your-company.internal
DATABASE_URL=postgresql://hrflow_admin:<password>@postgres-host:5432/hrflow_production
JWT_SECRET=<32+ random characters>
JWT_EXPIRY=3600s
ALLOWED_ORIGINS=https://admin.your-company.internal   # required in production
TRUST_PROXY=1
RAKSS_ADMIN_EMAIL=<first admin email>        # optional first-admin seeding
RAKSS_ADMIN_PASSWORD=<first admin password>  # optional first-admin seeding
BOOTSTRAP_ALLOWED=false                      # optional; first-run UI bootstrap in production, default off
POLICY_STORAGE_DIR=/var/lib/hrflow/policies
```

### Frontend Variables

```bash
VITE_GRAPHQL_ENDPOINT=https://hr.your-company.internal/graphql
EXPO_PUBLIC_GRAPHQL_ENDPOINT=https://hr.your-company.internal/graphql
```

## Local Compose Deployment

The local compose files now model the supported monolith setup:

- `docker-compose.yml` for local backend plus PostgreSQL
- `docker-compose.dev.yml` for watch-mode backend plus PostgreSQL

Validate them with:

```bash
docker compose config
docker compose -f docker-compose.dev.yml config
```

## Production Deployment Pattern

### 1. Prepare the Host

```bash
git clone <your-repo-url>
cd rakss
bun install
cp .env.example .env
```

Update `.env` for production values, especially:

- `DATABASE_URL`
- `JWT_SECRET`
- `BACKEND_PUBLIC_URL`
- `ALLOWED_ORIGINS`
- `POLICY_STORAGE_DIR`

Create the policy storage path:

```bash
mkdir -p /var/lib/hrflow/policies
chmod 750 /var/lib/hrflow/policies
```

### 2. Start PostgreSQL

Use either:

- the local Compose PostgreSQL service for single-host installs
- a managed PostgreSQL instance
- the homelab central/shared Postgres path for internal deployments

For homelab-managed provisioning:

```bash
homelab apps database create rakss --service backend --db-type postgres --mode central --env-file .env
homelab apps database verify rakss --service backend
```

### 3. Migrate and Start the Backend

```bash
bun run build:backend
bun run --cwd apps/backend migrate:deploy
node apps/backend/dist/src/main.js
```

Or in a service manager:

```bash
NODE_ENV=production bun run --cwd apps/backend start:prod
```

### 4. Start the Admin Portal

```bash
bun run --cwd apps/web-admin build
```

Serve `apps/web-admin/dist` behind your reverse proxy or static web server.

### Web admin container

`apps/web-admin/Dockerfile` builds from the repository root (`docker build -f apps/web-admin/Dockerfile .`) using the root `bun.lock`. nginx proxies `/graphql` to `API_UPSTREAM_HOST` (default `api.hrflow.lab.novadev.tech`) with TLS verification on, sets security headers and a CSP, and serves `/assets/*` as immutable.

## Domain cutover

The public hostnames are `admin.hrflow.lab.novadev.tech` and `api.hrflow.lab.novadev.tech` (`base_domain: hrflow` in `homelab.yaml`; the internal project id and database stay `rakss`). The hrflow DNS, route, and TLS certificate must exist in Homelab before deploying this config, because the web-admin nginx verifies the API certificate. The old `rakss` hostnames are retired separately.

## Health Checks

### Backend

- Health endpoint: `GET /health`
- GraphQL endpoint: `POST /graphql`
- Policy files: `GET /policy-files/:storedFileName`

## Current Deployment Proof

Last checked: June 22, 2026 (before the hrflow domain cutover).

Local deployment contract:

```bash
docker compose config
docker compose -f docker-compose.dev.yml config
bun run build
```

Result:

- Production compose renders a PostgreSQL service and backend service on port `4001`.
- Development compose renders a PostgreSQL service and watch-mode backend service on port `4001`.
- Full repo build passes across backend, admin portal, and mobile typecheck.

Live route checks:

```bash
curl -I -L https://admin.hrflow.lab.novadev.tech
curl -I -L https://admin.hrflow.lab.novadev.tech/health
curl -I -L https://api.hrflow.lab.novadev.tech/health
curl -sS -X POST https://api.hrflow.lab.novadev.tech/graphql \
  -H 'content-type: application/json' \
  --data '{"query":"query { __typename }"}'
```

Result (recorded on the previous `rakss` hostnames, before the domain cutover):

- `https://admin.hrflow.lab.novadev.tech` returns HTTP `200`.
- `https://admin.hrflow.lab.novadev.tech/health` returns HTTP `200`.
- `https://api.hrflow.lab.novadev.tech/health` returns HTTP `200`.
- GraphQL returns `{"data":{"__typename":"Query"}}`.

Homelab caveat:

- `homelab --project-root /home/nova/projects/work/rakss --output json validate` passes global Homelab contract validation, with a warning that project config discovery for `homelab.yaml` is not yet enforced.
- `homelab --project-root /home/nova/projects/work/rakss --output json apps database verify rakss --service backend` failed with `ssh failed: remote command`; do not treat database provisioning verification as complete until that exact command passes or the remote-side failure is explained.

## Operations Hardening Status

Last checked: June 22, 2026.

Implemented in the current backend:

- Helmet is enabled in `apps/backend/src/main.ts`; production enables Helmet content security policy.
- Response compression is enabled.
- Global validation uses whitelist, transform, and `forbidNonWhitelisted`.
- CORS is controlled by `ALLOWED_ORIGINS`; production must set it explicitly.
- GraphQL playground and introspection are disabled when `NODE_ENV=production`.
- Backend and admin deployment health endpoints are configured in `homelab.yaml`.
- PostgreSQL backup and policy-storage backup commands are documented below.

Operator-required configuration:

- Set a real `JWT_SECRET` (32+ random characters); compose has no default and refuses to start without it.
- Set `ALLOWED_ORIGINS` to the deployed admin and mobile origins.
- Set and back up `POLICY_STORAGE_DIR` with the database because policy rows reference stored files.
- Run database migration verification before shipping through NexOS or Homelab so the target environment comes from `.nexos/env.yaml`: `nexos secrets exec --project /home/nova/projects/work/rakss --env production -- bun run --cwd apps/backend migrate:deploy` or the Homelab migration wrapper for the target deployment. This applies pending versioned migrations (baseline-adopting databases created by `push`) followed by seed verification.

Not yet proven or not implemented in this repo:

- No `.github/workflows` CI pipeline is checked in.
- No production alert rules are checked in.
- No log aggregation or error tracking pipeline is checked in.
- No load-test script or smoke-performance threshold is checked in.
- `config/prometheus.yml` still targets the retired gateway and microservice service names; do not treat it as current monolith monitoring proof until it is replaced with real backend/admin metrics or blackbox health checks.

### Suggested Smoke Checks

```bash
curl -I http://localhost:4001/health
curl -I http://localhost:4001/graphql
```

## Database Migrations

Schema changes are versioned SQL migrations in `apps/backend/drizzle/`:

1. Edit `apps/backend/src/database/drizzle/schema.ts`.
2. `bun run db:generate` and review the generated SQL (never accept a destructive drop+add for a rename without a restore plan).
3. Commit the SQL and `meta/` files.
4. Deploy runs `bun run migrate:deploy` (`node dist/src/scripts/migrate.js && node dist/src/scripts/ensure-schema.js`): applies pending migrations under a Postgres advisory lock, then verifies seed data. Databases originally created by `drizzle-kit push` are adopted automatically (baseline recorded, not re-executed).

`bun run --cwd apps/backend schema:push` is **local development only**; never run it against a shared or production database.

Back up the database before any migration that alters or drops data.

## Storage And Backups

### Database

Back up PostgreSQL regularly using your platform standard or the homelab helper:

```bash
homelab apps database backup rakss --service backend
```

### Policy File Storage

Back up `POLICY_STORAGE_DIR` together with the database because policy rows store metadata that references those files.

Minimum recommendation:

- daily filesystem snapshot or rsync backup
- retained alongside database backups
- restore-tested quarterly

## Verification Checklist

Run this before promoting changes:

```bash
bun run build:backend
bun run --cwd apps/web-admin build
bunx tsc --noEmit -p apps/mobile/tsconfig.json
bun run test:backend
```

Functional checks:

- bootstrap or sign in to an admin account
- create an employee
- provision an employee account
- clock in/out through the attendance flow
- submit a leave request
- process payroll and confirm payslips exist
- export a payslip PDF
- export a reports PDF
- upload and open a policy document file

## Troubleshooting

### Backend Cannot Reach Database

Check:

- `DATABASE_URL`
- host firewall rules
- PostgreSQL listen address
- `homelab apps database verify rakss --service backend` for central mode

### Policy Files Do Not Open

Check:

- `BACKEND_PUBLIC_URL`
- `POLICY_STORAGE_DIR`
- filesystem permissions on the storage directory
- reverse proxy rules for `/policy-files/*`

### Tests Fail In A Sandboxed Environment

If the repo is being verified from a sandboxed agent session, direct TCP access to the central database may require elevated execution permissions even when the database itself is healthy.

## Operational Notes

- `ADMIN` and `HR_ADMIN` have full cross-company administrative access in the current deployment model.
- `MANAGER` accounts are department-scoped for employee-facing operational modules.
- `SUPERVISOR` accounts are direct-report scoped for employee-facing operational modules.
- Payroll management remains restricted to `ADMIN` and `HR_ADMIN`.
- Employee self-service remains limited to the employee profile linked to the signed-in account.
