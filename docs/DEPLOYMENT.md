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

### Central Homelab Test Database

For isolated integration testing, provision a dedicated central Postgres database and write it into `.env.test`:

```bash
homelab apps database create rakss --service backend --db-type postgres --mode central --db-name rakss_backend_test --env-file .env.test
```

The backend test runner already prefers `.env.test` when `NODE_ENV=test`:

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
JWT_SECRET=<random-secret>
JWT_EXPIRY=3600s
ALLOWED_ORIGINS=https://admin.your-company.internal
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

### 3. Start the Backend

```bash
bun run build:backend
node apps/backend/dist/main.js
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

## Health Checks

### Backend

- Health endpoint: `GET /health`
- GraphQL endpoint: `POST /graphql`
- Policy files: `GET /policy-files/:storedFileName`

### Suggested Smoke Checks

```bash
curl -I http://localhost:4001/health
curl -I http://localhost:4001/graphql
```

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
