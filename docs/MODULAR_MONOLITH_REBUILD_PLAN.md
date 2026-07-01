# HRFlow Modular Monolith Rebuild Plan

## Summary

This document captures the approved recovery direction for the implementation branch `claude/implement-system-01HeGHJxwgz56FUxf6nAnzEr`.

The target is a **per-company deployable modular monolith** that keeps the current web and mobile apps, removes the incomplete gateway plus microservice runtime as the product target, and rebuilds the backend around one authoritative NestJS GraphQL application.

This is a **clean rebuild** plan, not an incremental merge of the current service graph. Existing `services/*` and `apps/api-gateway` code are reference sources for business logic, naming, workflows, and schema ideas, but they are not the supported runtime architecture going forward.

## Why This Plan

The current branch mixes:

- a partially wired microservice topology
- unreachable services and duplicate frontend trees
- mocked authentication and mocked business data in active apps
- dead feature slices that exist in source but are not registered, routed, or deployed
- broken developer workflows around migrations, tests, and deployment

For a product that will be delivered to companies as separate deployments, that architecture creates too much packaging, support, upgrade, and debugging overhead.

The modular monolith direction optimizes for:

- simpler customer deployment
- simpler upgrades and support
- one migration path
- one auth boundary
- one GraphQL contract
- fewer runtime moving parts
- easier validation of business-critical flows like attendance, leave, and payroll

## Final Decisions

- Delivery model: per-company deployment
- Backend target: modular monolith
- Migration style: clean rebuild
- API style: GraphQL
- Active clients: `apps/web-admin` and `apps/mobile`
- UI architecture: keep the current UI stacks and component libraries
- Database: PostgreSQL as the required backend dependency
- Cache and queue: not required for v1 runtime
- Eventing model: in-process domain events only where useful inside the monolith
- Existing microservices: reference-only during migration, not the target runtime

## Target Runtime Architecture

### Product Runtime

- `apps/backend`
  - Single NestJS backend
  - Single GraphQL endpoint
  - Single Drizzle runtime query layer over PostgreSQL
  - One auth model
  - Bounded modules inside one process
- `apps/web-admin`
  - Primary admin interface
  - Uses real GraphQL operations only
- `apps/mobile`
  - Employee self-service app
  - Uses real GraphQL operations only
- `postgres`
  - Primary persistence for all modules

### Optional Later Infrastructure

- Redis for caching or rate limiting only if needed after correctness is achieved
- MinIO only when document upload flows are implemented for real
- Prometheus and Grafana only after the product runtime is stable
- No RabbitMQ in the required path for the first production-ready rebuild

## Proposed Repo Shape

### New Primary Backend Package

Create:

- `apps/backend`

Recommended internal module layout:

- `src/auth`
- `src/common`
- `src/database`
- `src/org-reference`
- `src/employee`
- `src/location`
- `src/attendance`
- `src/leave`
- `src/payroll`
- `src/recruitment`
- `src/shift`
- `src/onboarding`
- `src/offboarding`
- `src/announcements`
- `src/documents`
- `src/analytics`
- `src/health`

### Legacy Code Status

Keep temporarily during migration:

- `apps/api-gateway`
- `services/*`
- root `web-admin/`

End state:

- `apps/api-gateway` removed from supported workflows
- `services/*` archived or removed after parity is reached
- root `web-admin/` removed after any useful screens are ported into `apps/web-admin`

## Module Boundaries

### `auth`

Responsibilities:

- login
- session and token issuance
- current-user lookup
- role and permission checks
- password hashing
- bootstrap admin user flow

Required models:

- `User`
- `Role`
- `UserRole`
- optional `RefreshToken` if long-lived sessions are needed

Required public operations:

- `login`
- `logout`
- `me`
- optional `refreshToken`

### `org-reference`

Responsibilities:

- departments
- designations
- leave types
- payroll configuration
- approval roles or approval policy definitions
- company-level settings

This module exists to eliminate the current hardcoded IDs and missing reference-data problem.

### `employee`

Responsibilities:

- employee CRUD
- employee search and pagination
- supervisor hierarchy
- employee documents metadata
- employee status changes
- policy document visibility rules

Source material:

- `services/employee`

Do not carry over:

- empty department or designation modules
- unregistered bulk import logic
- broken service-local event wiring

### `location`

Responsibilities:

- clients
- contracts if kept in v1
- work locations
- employee location assignments
- geofence calculation services

Server-side invariants:

- one primary location per employee at a time
- location assignment status must be explicit
- geofence validation is shared logic, not client-trusted data

### `attendance`

Responsibilities:

- clock in
- clock out
- attendance history
- approval workflow
- correction and override workflows

Required behavior:

- client submits coordinates and location intent
- server validates location assignment and geofence
- server computes distance
- server decides allowed or denied state
- approval state transitions are validated server-side
- audit history is persisted in the same transaction as approval actions where needed

### `leave`

Responsibilities:

- leave requests
- leave balances
- leave types
- approval workflow
- leave calendar views

Required behavior:

- no mocked balances
- approvals use real workflow states
- balance deduction and restore logic is transactional

### `payroll`

Responsibilities:

- payroll periods
- salary structures
- payroll records
- adjustments
- overrides
- payslip generation

Required behavior:

- payroll uses real employee and attendance records
- payroll processing is transactional or safely resumable and idempotent
- override history is audit-safe
- period status reflects actual processing state

### `recruitment`

Responsibilities:

- requisitions
- applications
- interviews
- offers

Status:

- phase 2 module

Reason:

- present in the branch but not part of the current deployable product

### `shift`

Responsibilities:

- shift definitions
- schedules
- rotations
- swap requests
- overrides

Status:

- phase 2 module

Reason:

- present in source, but not reachable in the current runtime

### `onboarding` and `offboarding`

Responsibilities:

- templates
- task generation
- progress tracking
- asset return and clearance support
- exit workflow tracking

Status:

- phase 2 module

Reason:

- partial service logic exists, but it is not wired into the current backend topology

### `announcements`

Responsibilities:

- create
- publish
- archive
- read tracking
- acknowledgment tracking

Required behavior:

- persisted storage only
- no in-memory maps in production code

### `analytics`

Responsibilities:

- dashboards
- reports
- exports

Status:

- phase 2 module

Required behavior:

- use real queries and aggregates
- no placeholder report payloads
- no fake CSV or XLSX responses

## Data Model Strategy

## Single Database Ownership

The rebuild uses one PostgreSQL schema owner and one Drizzle runtime query layer
for the entire backend.

Recommended approach:

- keep schema and seed ownership centralized in `apps/backend/src/database`
- keep service queries on Drizzle through `DatabaseService.drizzle`
- do not preserve the current multi-schema database split as a product requirement

### Migration Rules

- one migration command
- one seed path
- one Drizzle database mapping
- one test database setup flow

### Required Core Models

Phase 1 data model must include:

- auth models
- company settings or org settings
- department
- designation
- employee
- employee document metadata
- client
- client location
- employee location assignment
- attendance
- attendance approval history
- leave type
- leave balance
- leave request
- leave approval history
- salary structure
- payroll period
- payroll record
- payroll adjustment
- payroll override history
- policy document metadata

### Data Migration Policy

Assume no production data migration is required yet.

If data from this branch must be preserved later:

- build a one-time ETL or importer after the monolith schema stabilizes
- do not let legacy service schemas define the new domain model directly

## GraphQL Contract Strategy

The monolith owns one GraphQL schema.

### Contract Rules

- no federation
- no Apollo Gateway
- no subgraph composition
- one endpoint
- one auth model
- one consistent pagination and filtering style

### Required Phase 1 GraphQL Areas

- auth
- employees
- departments and designations
- locations and assignments
- attendance
- leave
- payroll
- policy documents
- current user and permissions

### Authentication Contract

Required operations:

- `login(email, password)`
- `logout`
- `me`
- optional `refreshToken`

Required client behavior:

- web and mobile stop writing fake tokens
- both clients use the real auth contract

### Attendance Contract

Inputs must include:

- employee identity from auth context where possible
- coordinates
- chosen location or assignment intent
- optional photo and notes

The server must compute:

- geofence validity
- distance
- attendance status

### Payroll Contract

Required operations:

- create payroll period
- process payroll period
- approve payroll period
- fetch payroll records
- fetch payslip metadata or download links

Required server guarantees:

- no mock attendance inputs
- idempotent batch behavior
- safe retry behavior

## Frontend Migration Strategy

## `apps/web-admin`

This remains the real admin application.

### Required work

- remove localStorage-only fake auth
- route only to screens backed by real backend capabilities
- replace hardcoded dashboard stats with queries
- replace placeholder pages with real attendance, leave, payroll, and employee flows

### Root `web-admin/` handling

Treat the root `web-admin/` tree as reference material only.

Allowed:

- port useful screen ideas into `apps/web-admin`
- reuse UX patterns or GraphQL query ideas after backend parity exists

Not allowed:

- promote the root `web-admin/` tree into the product target as-is

## `apps/mobile`

This remains the real employee application.

### Required work

- replace fake login
- replace local mock attendance actions
- replace static leave and payslip screens with real queries and mutations
- align current-user flows with backend auth and employee data

## Implementation Phases

## Phase 0: Freeze and Archive the Current Shape

Goals:

- protect the branch from further architectural drift
- define the new supported runtime path

Tasks:

- create `apps/backend`
- mark `apps/api-gateway` and `services/*` as legacy in docs
- stop adding new runtime features to the current service graph
- document root `web-admin/` as reference-only

Acceptance criteria:

- the repo has one clearly documented target architecture
- contributors can identify which code is product path versus reference-only

## Phase 1: Backend Foundation

Goals:

- get one backend app booting with shared infrastructure

Tasks:

- create Nest app shell
- add Prisma integration
- add config handling
- add GraphQL bootstrap
- add auth base module
- add health endpoint
- add company settings and reference-data modules

Acceptance criteria:

- backend starts locally
- database migrations run from one command
- health and GraphQL endpoints are live
- auth bootstrap path exists

## Phase 2: Core Domain Parity

Goals:

- rebuild the minimum business-critical product

Scope:

- employee
- org reference
- location
- attendance
- leave
- payroll

Tasks:

- port and normalize employee logic
- rebuild geofence validation into attendance server flows
- rebuild leave approval workflows
- rebuild payroll on top of real employee and attendance data
- rebuild policy document access flows if needed for the admin app

Acceptance criteria:

- admin can log in
- admin can create and manage employees
- employee attendance is captured through real backend logic
- leave requests and approvals work
- payroll periods can be processed from real data

## Phase 3: Web Admin Real Data Migration

Goals:

- make `apps/web-admin` a real client of the monolith

Tasks:

- replace fake auth
- wire dashboard to real queries
- wire employee list and detail pages
- implement real attendance approval pages
- implement real leave approval pages
- implement real payroll pages

Acceptance criteria:

- no hardcoded production-facing business data remains in core admin flows
- no fake auth remains
- critical admin flows pass end-to-end checks

## Phase 4: Mobile Real Data Migration

Goals:

- make `apps/mobile` a real employee portal

Tasks:

- real login
- real clock in and clock out
- real leave request and history
- real payslip history
- real profile and current user views

Acceptance criteria:

- no fake auth remains in mobile
- no static attendance and leave history remains in primary mobile screens

## Phase 5: Phase 2 Modules

Goals:

- add the non-core modules after the core system is stable

Scope:

- recruitment
- shift
- onboarding
- offboarding
- announcements
- analytics
- bulk import and export

Acceptance criteria:

- each module is added only when backend, web UI, and data model are all real
- no module ships as dead code or unreachable source only

## Phase 6: Decommission Legacy Runtime

Goals:

- remove confusion and unsupported paths

Tasks:

- remove `apps/api-gateway` from supported flows
- archive or remove `services/*`
- remove root `web-admin/`
- align Docker, root scripts, docs, and tests to the monolith runtime

Acceptance criteria:

- one backend runtime path remains
- one admin UI path remains
- one mobile app path remains

## Testing Strategy

### Unit Tests

Required coverage areas:

- auth rules
- geofence calculations
- attendance state transitions
- leave balance rules
- payroll calculations
- payroll override history rules
- approval workflow transitions

### Integration Tests

Required:

- GraphQL integration tests against the monolith
- real test database
- seeded reference data

Required scenarios:

- login and current user
- create employee with valid reference data
- assign employee to location
- clock in within geofence
- reject clock in outside geofence
- request and approve leave
- process payroll period

### Web End-to-End Tests

Required scenarios:

- admin login
- employee create and list
- attendance approval
- leave approval
- payroll processing

### Mobile Verification

Required scenarios:

- employee login
- clock in and clock out
- leave request
- payslip retrieval

## Deployment Strategy

### Supported v1 Runtime

Required:

- PostgreSQL
- backend container
- admin web app

Optional:

- mobile app build artifacts
- object storage once documents are live
- monitoring stack after stabilization

### Packaging Goal

Each company deployment should be able to:

- bring up PostgreSQL
- run one migration command
- start one backend
- start one admin app
- connect one mobile app configuration

This is the core packaging reason for choosing the monolith.

## Developer Workflow Changes

Required repo changes after the backend path exists:

- root scripts point to the monolith
- one migration workflow
- one seed workflow
- tests target the monolith
- docs stop describing the legacy gateway plus service graph as the product runtime

## Success Criteria

The rebuild is complete when all of the following are true:

- one supported backend runtime exists
- one migration path exists
- web and mobile use real auth
- attendance geofence is enforced server-side
- leave and payroll use real persisted data
- no major product flow depends on mock data
- no major feature exists only as unreachable source code
- deployment docs match the actual runtime

## Risks And Controls

### Risk: Porting buggy logic from legacy services

Control:

- port behavior intentionally
- do not copy service wiring blindly
- back every core flow with tests

### Risk: Scope explosion

Control:

- phase 1 includes only the core production slice
- phase 2 modules ship only after the core is stable

### Risk: Frontend drift during rebuild

Control:

- keep `apps/web-admin` and `apps/mobile` as the only active clients
- treat root `web-admin/` as reference-only

### Risk: Hidden data dependencies

Control:

- add explicit reference-data modules early
- eliminate hardcoded IDs and mock assumptions

## Immediate Execution Order

The recommended implementation order is:

1. Create `apps/backend` and shared backend foundation
2. Build auth and org-reference modules
3. Rebuild employee and location modules
4. Rebuild attendance with server-side geofence enforcement
5. Rebuild leave
6. Rebuild payroll on real attendance plus employee data
7. Wire `apps/web-admin` to real auth and core admin flows
8. Wire `apps/mobile` to real auth and employee self-service flows
9. Add phase 2 modules
10. Remove legacy runtime paths from supported workflows

## Branch Context

This plan was written against:

- repository: `rakss`
- branch: `claude/implement-system-01HeGHJxwgz56FUxf6nAnzEr`
- status: implementation branch with architecture drift and partial feature slices

It should be treated as the source of truth for the rebuild unless a newer approved plan replaces it.
