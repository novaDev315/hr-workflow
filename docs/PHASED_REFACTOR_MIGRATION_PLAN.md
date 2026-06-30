# Rakss Phased Refactor And Migration Plan

Status: planned
Date: 2026-06-30
Owner repo: `/home/nova/projects/work/rakss`
Primary owner: Rakss product repository

## Summary

This plan removes the remaining demo source, formalizes the admin UI component
system around Tailwind and shadcn-style primitives, clarifies backend schema
ownership, reduces duplicated authorization rules, decomposes the largest admin
pages, and adds a fast backend test lane without losing the current central-DB
integration proof.

The work must run in proof-bearing phases. Each phase has a stop gate. Do not
start the next mutation phase until the current phase has passed proof, produced
a clear blocker, or has a saved handoff.

## Goal

Make the Rakss codebase easier to maintain and safer to extend without a big-bang
rewrite. The migration should:

- Remove unmounted demo code from the production app source tree.
- Adopt shadcn-compatible UI primitives while preserving the existing Talent
  Haven visual language.
- Make backend database ownership explicit and less misleading.
- Stop duplicating role/access rules between backend and web-admin.
- Split large admin pages into feature modules with local GraphQL operations,
  types, hooks, forms, and list/detail components.
- Add a fast backend unit lane while preserving the slow integration test.
- Delay full Prisma migration until raw SQL truth and integration behavior are
  documented and protected.

## Success Criteria

- `apps/web-admin/src/demo` is removed and production docs/scripts no longer
  reference demo routes as a live source concern.
- Web-admin has a formal component foundation for `Select`, `Textarea`, and
  `Field` that fits the current Tailwind tokens and local UI conventions.
- Raw SQL/Postgres ownership is explicit, or a later approved Prisma migration
  has a complete schema and module-by-module proof.
- Web-admin receives role/capability decisions from backend auth payloads instead
  of maintaining separate role arrays as the source of truth.
- `EmployeesPage`, `AttendancePage`, and `RecruitmentPage` are decomposed without
  changing product behavior.
- GraphQL operations are no longer buried inside large page components for the
  refactored features.
- A fast backend unit command exists and passes independently from the existing
  central-DB integration test.
- After each phase, relevant build, lint, typecheck, and test proof is captured.

## Audience

- Primary implementer: Codex or another agent working in this repo.
- Reviewer: Nova, or any engineer checking proof and phase boundaries.
- Future maintainer: someone deciding whether to continue the Prisma migration
  after the safe cleanup and decomposition phases.

## Current Evidence

- Current branch was clean before saving this plan.
- At plan creation, `apps/web-admin/src/demo` existed even though production
  routes were not mounted.
- `apps/web-admin` uses Tailwind v3 tokens, local shadcn-like primitives, and no
  committed `components.json`.
- Existing UI primitives include `button`, `card`, `form-drawer`, `input`,
  `label`, `metric-card`, `notice`, and `status-badge`.
- Backend package still exposes `prisma:*` scripts and has
  `apps/backend/prisma/schema.prisma`, but runtime behavior goes through
  `apps/backend/src/prisma/prisma.service.ts` with raw `pg` SQL and startup DDL.
- Prior proof showed web-admin build/lint, backend build, mobile typecheck, and
  backend integration tests can pass. Backend integration tests need access to
  the configured test Postgres host.
- `EmployeesPage.tsx`, `AttendancePage.tsx`, and `RecruitmentPage.tsx` are the
  highest-risk admin page size/refactor targets.

## Coding Agent Signals

Read-only planning context check returned:

- Project: `hrflow-pro`
- Tasks: `0 total`
- Runnable tasks: `0`
- Plans: `0 total`, `0 active`
- `git_status`: ok
- `project_status`: ok
- `done_check`: ok
- `knowledge_check`: ok
- `preflight`: ok

Persistence guardrail: import into Coding Agent plans/tasks only after explicit
user approval.

## In Scope

- Remove demo source and stale docs/proof references.
- Add/adapt shadcn-compatible UI primitives for forms.
- Rename or reframe backend database ownership toward explicit raw SQL/Postgres.
- Move role/capability truth toward backend auth payloads.
- Decompose the three largest admin pages one at a time.
- Extract feature-local GraphQL operations, types, and hooks while decomposing
  pages.
- Add a fast unit test lane for backend business logic.
- Add a later explicit Prisma migration checkpoint and optional follow-on phases.

## Out Of Scope

- Production deploy, public route changes, DNS/TLS changes, or Homelab runtime
  modifications.
- Notes-vault truth updates before implementation proof exists.
- Full shadcn visual redesign or preset overwrite.
- Big-bang Prisma migration across all backend services in the same phase as UI
  decomposition.
- Mobile app redesign.
- Replacing GraphQL with REST or changing product workflows.

## Constraints

- Keep phases atomic and proof-bearing.
- Do not start destructive database changes without a separate explicit approval.
- Do not update notes-vault project truth from this plan alone.
- Do not mix code changes and notes-vault updates in the same commit.
- Preserve existing Talent Haven theme tokens and page behavior.
- Treat `bun run test:backend` as integration proof that may require network or
  DB access approval.
- Prefer source proof over stale docs.

## Decisions

1. Initial database ownership decision:
   - Commit to explicit raw SQL/Postgres ownership first.
   - Rename misleading Prisma service/module naming and move DDL/seed SQL out of
     the service.
   - Do not attempt full Prisma migration until later checkpoint approval.

2. shadcn decision:
   - Use shadcn-compatible primitives and CLI where safe.
   - Preserve existing Tailwind v3 config and CSS variables.
   - Do not run a destructive preset reinstall.
   - Stop if `shadcn init` or add commands require overwriting local primitives.

3. Page decomposition decision:
   - Split one page at a time.
   - Employees first, then Attendance, then Recruitment.
   - Extract GraphQL operations as part of each page split.

4. Role/capability decision:
   - Backend remains the access-control authority.
   - Web-admin should consume capabilities in auth/current-user payloads rather
     than duplicating backend role arrays.

## Work Queue

- RAKSS-P0: Rakss repo | Baseline and plan confirmation | risk=low |
  parallel=no | actions=inspect only | proof=git status and script map |
  stop=tree dirty or script mismatch
- RAKSS-P1: Web-admin | Remove demo source | risk=low | parallel=no |
  actions=edit/test | proof=build:web-admin and lint |
  stop=proof fails
- RAKSS-P2: Web-admin | shadcn foundation and form primitives | risk=medium |
  parallel=no | actions=edit/test | proof=shadcn info when available, build,
  lint | stop=destructive overwrite needed
- RAKSS-P3: Backend | Database ownership clarification | risk=medium |
  parallel=no | actions=edit/test | proof=backend build and backend integration
  test | stop=runtime schema behavior changes unexpectedly
- RAKSS-P4: Backend + web-admin | Server-returned capabilities | risk=medium |
  parallel=no | actions=edit/test | proof=backend test, web build, web lint |
  stop=mobile auth contract impact appears
- RAKSS-P5: Web-admin | Employees decomposition | risk=medium |
  parallel=no | actions=edit/test | proof=web build/lint and smoke |
  stop=behavior or UI regressions
- RAKSS-P6: Web-admin | Attendance decomposition | risk=medium |
  parallel=no | actions=edit/test | proof=web build/lint and smoke |
  stop=behavior or UI regressions
- RAKSS-P7: Web-admin | Recruitment decomposition | risk=medium |
  parallel=no | actions=edit/test | proof=web build/lint and smoke |
  stop=behavior or UI regressions
- RAKSS-P8: Backend | Fast unit test lane | risk=low |
  parallel=no | actions=edit/test | proof=fast unit command and existing
  integration command | stop=unit setup conflicts with integration setup
- RAKSS-P9: Backend | Prisma migration checkpoint | risk=high |
  parallel=no | actions=inspect/plan first | proof=schema diff and migration
  risk review | stop=needs explicit approval
- RAKSS-P10: Backend | Optional Prisma migration | risk=high |
  parallel=no | actions=edit/test only after approval | proof=module-by-module
  build/test/integration proof | stop=any service regression

## Phase Plan

### Phase 0: Baseline Snapshot

Purpose: freeze the starting truth before edits.

Files to inspect:

- `package.json`
- `apps/web-admin/package.json`
- `apps/backend/package.json`
- `apps/web-admin/src/App.tsx`
- `apps/web-admin/src/demo/**`
- `apps/backend/src/prisma/prisma.service.ts`
- `apps/backend/prisma/schema.prisma`
- `docs/IMPLEMENTATION_STATUS.md`
- `scripts/e2e/run-rakss-ui-lifecycle.mjs`
- `scripts/e2e/rakss-ui-lifecycle-sweep.js`

Commands:

```bash
git status --short
bun run build:web-admin
bun run --cwd apps/web-admin lint
bun run build:backend
bun run typecheck:mobile
```

Stop gate:

- Stop if repo is dirty with unrelated changes.
- Stop if baseline proof fails before edits.

### Phase 1: Remove Demo Source Completely

Purpose: remove `apps/web-admin/src/demo` from the production source tree and
clear stale references.

Expected edits:

- Delete `apps/web-admin/src/demo/**`.
- Remove docs language that implies demo source remains a product surface.
- Update E2E proof wording if it references `/demos` as a route assertion.
- Keep production route lazy loading unchanged.

Non-goals:

- Do not redesign live pages.
- Do not change admin routing except removing stale demo assumptions.

Proof:

```bash
bun run build:web-admin
bun run --cwd apps/web-admin lint
rg -n "src/demo|/demos|Rakss demo gallery|demoHref|DemoGallery|DemoWorkspace" apps docs scripts
```

Stop gate:

- Stop if build/lint fails.
- Stop if remaining `/demos` references are not intentionally documented as
  historical cleanup.

### Phase 2: shadcn Foundation Without Preset Overwrite

Purpose: formalize component-system metadata and add missing primitives safely.

Expected edits:

- Add `apps/web-admin/components.json` only if shadcn init can preserve current
  aliases, Tailwind file, and component paths.
- Add or adapt:
  - `apps/web-admin/src/components/ui/select.tsx`
  - `apps/web-admin/src/components/ui/textarea.tsx`
  - `apps/web-admin/src/components/ui/field.tsx`
- Keep existing `button`, `card`, `input`, and `label` styling unless a local
  compatibility change is needed.

CLI guidance:

```bash
bunx --bun shadcn@latest info
bunx --bun shadcn@latest init
bunx --bun shadcn@latest add select textarea field
```

Use dry-run/diff flows where available before accepting generated changes.

Stop gate:

- Stop if shadcn wants to overwrite current local primitives or theme files.
- Stop if dependency install requires network approval and approval is denied.

Proof:

```bash
bunx --bun shadcn@latest info
bun run build:web-admin
bun run --cwd apps/web-admin lint
```

### Phase 3: Adopt Form Primitives In One Page

Purpose: prove the new form pattern on one page before broad replacement.

Target first page:

- `apps/web-admin/src/pages/EmployeesPage.tsx`

Expected edits:

- Replace raw `select` and `textarea` markup in the touched page with local
  `Select`, `Textarea`, and `Field` primitives.
- Keep business behavior unchanged.
- Do not split the whole page yet unless it is a tiny helper extraction needed
  for the primitive conversion.

Proof:

```bash
bun run build:web-admin
bun run --cwd apps/web-admin lint
```

Optional browser smoke:

- Load employee page with mocked/session-seeded auth if local app is run.
- Check select focus, keyboard behavior, disabled state, and mobile drawer fit.

Stop gate:

- Stop and review the pattern before applying to Attendance or Recruitment.

### Phase 4: Backend Raw SQL Ownership Cleanup

Purpose: make the current database truth explicit before considering Prisma.

Expected edits:

- Rename:
  - `apps/backend/src/prisma/prisma.service.ts` to a database-owned module path.
  - `PrismaService` to `DatabaseService`.
  - `PrismaModule` to `DatabaseModule`.
- Move startup SQL statements into explicit schema/seed files or modules, for
  example:
  - `apps/backend/src/database/schema.ts`
  - `apps/backend/src/database/seeds.ts`
- Update imports across backend services/tests.
- Update package scripts and docs so Prisma is not advertised as the active
  migration/runtime truth.
- Keep runtime SQL behavior unchanged.

Non-goals:

- Do not remove tables or change live schema semantics.
- Do not migrate services to Prisma client in this phase.

Proof:

```bash
bun run build:backend
bun run test:backend
```

Stop gate:

- Stop if integration test shows schema/seed drift.
- Stop if package/docs edits imply Prisma is removed before all references are
  reconciled.

### Phase 5: Server-Returned Capabilities

Purpose: remove role-rule duplication from web-admin.

Backend target:

- Extend auth/current-user payloads with capabilities, for example:
  - `canAccessAdminPanel`
  - `canManageAccounts`
  - `canManageRecruitment`
  - `canManagePolicies`
  - future-friendly module flags if needed.

Frontend target:

- Replace role-array checks in `apps/web-admin/src/lib/auth-session.ts` with
  capability reads from stored account/session.
- Keep roles visible for display/debug if useful, but not as the frontend access
  source of truth.

Compatibility:

- Preserve existing stored sessions where possible.
- If stored account lacks capabilities, force re-login or compute a temporary
  backwards-compatible fallback with a deprecation note.

Proof:

```bash
bun run build:backend
bun run test:backend
bun run build:web-admin
bun run --cwd apps/web-admin lint
bun run typecheck:mobile
```

Stop gate:

- Stop if mobile auth payload changes break mobile typecheck or behavior.

### Phase 6: Split Employees Feature

Purpose: decompose the largest live admin page first.

Suggested target structure:

```text
apps/web-admin/src/features/employees/
  graphql.ts
  types.ts
  hooks.ts
  employee-page.tsx
  department-form.tsx
  designation-form.tsx
  employee-form.tsx
  account-access-forms.tsx
  employee-table.tsx
  helpers.ts
```

Route file:

- Keep `apps/web-admin/src/pages/EmployeesPage.tsx` as a small route wrapper
  exporting `EmployeesPage`.

Extraction order:

1. Move GraphQL operations to `graphql.ts`.
2. Move page-specific types/defaults to `types.ts`.
3. Extract mutation/query wiring into `hooks.ts` only if it reduces complexity.
4. Extract forms.
5. Extract table/list rendering.
6. Keep behavior unchanged.

Proof:

```bash
bun run build:web-admin
bun run --cwd apps/web-admin lint
```

Optional browser smoke:

- Employee list renders.
- Create/edit forms open.
- Account access forms still gate on capabilities.
- Mobile drawer layout is usable.

Stop gate:

- Stop before Attendance until Employees is reviewed and proof passes.

### Phase 7: Split Attendance Feature

Suggested target structure:

```text
apps/web-admin/src/features/attendance/
  graphql.ts
  types.ts
  hooks.ts
  attendance-page.tsx
  attendance-action-form.tsx
  location-form.tsx
  assignment-form.tsx
  attendance-table.tsx
  location-list.tsx
  helpers.ts
```

Focus:

- Preserve attendance action behavior.
- Preserve location defaulting/geofence form behavior.
- Use shared form primitives from Phase 2/3.

Proof:

```bash
bun run build:web-admin
bun run --cwd apps/web-admin lint
```

Stop gate:

- Stop before Recruitment until Attendance is reviewed and proof passes.

### Phase 8: Split Recruitment Feature

Suggested target structure:

```text
apps/web-admin/src/features/recruitment/
  graphql.ts
  types.ts
  hooks.ts
  recruitment-page.tsx
  requisition-form.tsx
  application-form.tsx
  requisition-list.tsx
  application-workflow.tsx
  filters.tsx
  helpers.ts
```

Focus:

- Preserve status transitions.
- Preserve requisition/application filters.
- Preserve management capability checks.
- Replace raw controls with shared primitives where touched.

Proof:

```bash
bun run build:web-admin
bun run --cwd apps/web-admin lint
```

Stop gate:

- Stop before GraphQL/codegen or Prisma work until Recruitment is reviewed.

### Phase 9: Feature-Local GraphQL Standard

Purpose: normalize the pattern created during page splits.

Expected edits:

- Ensure each refactored feature owns:
  - `graphql.ts` for operations.
  - `types.ts` for page-level data shapes until codegen exists.
  - `hooks.ts` only when it clarifies query/mutation orchestration.
- Avoid introducing codegen in the same phase unless separately approved.

Proof:

```bash
bun run build:web-admin
bun run --cwd apps/web-admin lint
bun run typecheck:mobile
```

Stop gate:

- Stop if operation extraction becomes a behavioral change.

### Phase 10: Fast Backend Unit Lane

Purpose: make backend feedback faster without weakening integration proof.

Expected edits:

- Add a unit Jest config, for example:
  - `apps/backend/jest.unit.config.js`
- Add package scripts:
  - `test:unit`
  - keep existing `test` as integration or rename explicitly.
- Add focused unit tests for pure/service-level logic that can run without the
  central database.
- Keep the current `mobile-self-service.spec.ts` integration path.

Candidate unit test targets:

- Access-control helpers.
- Geofence calculations.
- Status/tone/data helpers if backend-owned.
- Payroll date/workday helpers if they can be isolated safely.

Proof:

```bash
bun run --cwd apps/backend test:unit
bun run test:backend
bun run build:backend
```

Stop gate:

- Stop if unit config interferes with existing integration Jest config.

### Phase 11: Prisma Migration Checkpoint

Purpose: decide whether a real Prisma migration is worth starting.

Required artifact before mutation:

- A schema comparison showing:
  - current raw SQL tables/columns/indexes/constraints/seeds
  - current `schema.prisma` coverage
  - missing Prisma models/enums/relations
  - service modules that would need query rewrites
  - migration/deploy risk

Allowed work:

- Planning, schema diff, proof commands, no service rewrite.

Proof:

```bash
bun run build:backend
bun run test:backend
```

Stop gate:

- Explicit user approval required before Phase 12.

### Phase 12: Optional Prisma Migration

Purpose: migrate to true Prisma ownership only if Phase 11 is approved.

Execution rules:

- Migrate one backend domain at a time.
- Keep raw SQL fallback until the migrated domain passes tests.
- Do not combine Prisma migration with UI page splits.
- Commit each domain separately if commits are requested.

Suggested order:

1. Auth/users/roles, because schema.prisma already partially models this area.
2. Org reference: company settings, departments, designations.
3. Employee.
4. Location/attendance.
5. Leave.
6. Payroll.
7. Policy.
8. Recruitment.
9. Reports.

Proof after each domain:

```bash
bun run build:backend
bun run test:backend
```

Final proof:

```bash
bun run build
bun run test:backend
```

Stop gate:

- Stop on first domain regression.
- Stop if migration requires destructive DB action.

## Interfaces / Types / API Changes

Potential API changes:

- Auth account payload may gain a `capabilities` object.
- Stored admin account type in web-admin may gain optional capabilities.
- Existing role arrays should remain present unless a later migration explicitly
  removes them.

Potential filesystem/interface changes:

- Backend database service/module imports change from `prisma` naming to
  `database` naming.
- Web-admin route pages become wrappers around feature modules.
- Feature-local GraphQL files become the standard import source for operations.

## Data Flow

Current:

```text
Backend raw SQL service -> GraphQL resolvers -> web-admin pages with inline
GraphQL + local role checks
```

Target after safe phases:

```text
DatabaseService + explicit schema/seed modules -> GraphQL resolvers -> auth
payload capabilities -> feature modules with local GraphQL/types/hooks -> pages
as thin route wrappers
```

Optional later Prisma target:

```text
Prisma schema + generated client -> service domains -> GraphQL resolvers ->
feature modules
```

## Edge Cases And Failure Modes

- shadcn init overwrites local theme/components.
  - Mitigation: dry-run/diff first; stop before overwrite.
- Removing demo code breaks build because stale imports remain.
  - Mitigation: run `rg` for demo symbols and build immediately.
- Backend rename breaks dependency injection.
  - Mitigation: rename module/service and update imports in one focused phase.
- Backend startup schema extraction changes execution order.
  - Mitigation: preserve statement order and rerun integration test.
- Capabilities payload breaks existing stored sessions.
  - Mitigation: support missing capabilities with a short compatibility fallback
    or clear stale session.
- Page split accidentally changes mutation/refetch behavior.
  - Mitigation: move code first, then simplify after proof.
- Unit Jest config shadows integration config.
  - Mitigation: separate config and explicit scripts.
- Prisma migration creates schema drift against existing DB.
  - Mitigation: checkpoint plan, no mutation without approval.

## Test Scenarios

Web-admin:

- Build passes.
- Lint passes with `--max-warnings 0`.
- Login/session routing still works.
- Employees forms still create/edit/deactivate entities.
- Attendance actions still clock in/out and manage locations.
- Recruitment requisitions and applications still transition statuses.
- New select/textarea/field primitives handle focus, disabled, required, and
  validation states.

Backend:

- Build passes.
- Integration test passes against configured test DB.
- Fast unit tests pass without DB.
- Auth payload includes expected roles and capabilities.
- Database schema bootstrap remains idempotent.

Mobile:

- Typecheck passes after any auth payload changes.

## Rollout And Monitoring

Local rollout:

- Each phase lands only after proof.
- Use focused build/lint/test commands first.
- Use full `bun run build` and `bun run test:backend` after multi-phase batches.

Live rollout:

- Not part of this plan by default.
- If later deployed, prove:
  - backend health endpoint
  - GraphQL availability
  - admin static hosting
  - login/admin session behavior
  - absence of `/demos`

Notes-vault:

- Update only after implementation proof exists.
- Record exact phase, files changed, commit id if committed, proof commands, and
  remaining work.

## Rollback

Phase rollback strategy:

- Demo removal: restore deleted `src/demo` only if production build needs it,
  which should be treated as a bug.
- shadcn primitives: revert primitive files and `components.json` if generated
  changes conflict with local design system.
- Database rename: revert import/module rename if DI or integration tests fail.
- Capabilities: keep role arrays in payload and re-enable frontend fallback.
- Page splits: route wrappers make rollback simple by restoring the old page
  component.
- Unit lane: remove unit config/script if it conflicts with integration tests.
- Prisma migration: do not proceed without backups and phase-specific rollback;
  stop before destructive migration.

## Assumptions And Defaults

- Default commit boundary is one phase or one coherent sub-phase.
- Default proof for web-admin changes is build plus lint.
- Default proof for backend changes is backend build plus integration test.
- Default proof for mobile impact is mobile typecheck.
- Default shadcn mode is conservative integration, not theme replacement.
- Default database mode is raw SQL/Postgres truth until Phase 11 approves
  Prisma migration.

## Persistence

Saved plan artifact:

```text
docs/PHASED_REFACTOR_MIGRATION_PLAN.md
```

Coding Agent persistence:

- Not imported into `.coding-agent/tasks.db` yet.
- Import only after explicit approval, for example:

```bash
coding-agent plans import --file docs/PHASED_REFACTOR_MIGRATION_PLAN.md
```

## First Action When Approved

Start with Phase 0, then Phase 1:

```bash
git status --short
bun run build:web-admin
bun run --cwd apps/web-admin lint
```

If baseline is clean, remove `apps/web-admin/src/demo`, update stale references,
and rerun the Phase 1 proof.
