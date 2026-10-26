# Audit fixes — safe pause (2026-10-26)

> **LIVE 2026-10-26 16:45 UTC: HRFlow Pro is deployed.** One step remains for
> Nova: merge `control/services-apply-20261026-164256` (commit `bd6f450`, in
> homelab-control's dotfiles checkout) into dotfiles main. It records the two
> routes in `services.yaml`; parsed as YAML it only adds `rakss-backend` and
> `rakss-web-admin`, and the rest of the diff is formatting churn.
>
> Ship 3 (after `5b5856c`: `test: {mode: external}`):
> - sync, build and migrations ran, then deploy (tests skipped as external).
> - Containers on 10.0.60.10: `rakss-backend-20261026-163746` (port 4001) and
>   `rakss-web-admin-20261026-163746` (port 8080).
> - DB: 2 migrations recorded (baseline adopted, then 0001); `session_version`
>   and `is_paid` added; UNPAID leave type seeded. The existing admin is
>   `nova@hrflow.com`, so the env admin seed was correctly skipped.
>
> Routes: both proposals applied with `ops traefik sync --plan` (Traefik
> backups `20261026-164106` and `20261026-164209`). DNS needed no change:
> both names already resolve to Traefik 10.0.10.2.
>
> Live checks, all passing:
> - Let's Encrypt certificates with matching SANs for
>   `api.hrflow.lab.novadev.tech` and `admin.hrflow.lab.novadev.tech`.
> - API: `/health` returns 200. CORS allows only the admin origin. An
>   unauthenticated query returns UNAUTHENTICATED. A wrong-password sign-in
>   returns "Invalid credentials" (one attempt). `bootstrapAdmin` returns
>   FORBIDDEN in production.
> - Admin: `/health` and the deep link `/employees` return 200. CSP, XFO,
>   nosniff and referrer-policy headers are present. `/graphql` through the
>   admin nginx returns 200 with upstream TLS verification on. The login page
>   renders with 0 console errors.
> - Not checked: a real sign-in, which needs Nova's password.
>
> Rollback:
> - Previous app state: nothing was deployed before.
> - DB: the pre-deploy dump is on 10.0.40.10 (see below).
> - Routes: `homelab ops traefik rollback <backup>`.
> - Containers: `homelab apps remove rakss --yes`.
>
> Earlier failures this session, each resolved: ship 1 hit a transient bcrypt
> prebuilt download; ship 2 hit the generic test stage running `npm test`.
>
> Follow-ups:
> - Replace bcrypt with bcryptjs so builds stop downloading a native binary.
> - Fix the homelab engine's `-U postgres` in its database tools
>   (`internal/apps/database_sql.go`; owner nexos-homelab).
> - Migrate `homelab.yaml` to schema_version 2 and set `deploy.host`.


> **Ship status 2026-10-26 ~16:35 UTC: STOPPED under Nova's failure rule (two
> failures). Nothing deployed, routed, or migrated. Waiting for Nova.**
>
> Option A was done first (Nova confirmed it in session):
> - nexos-dotfiles `47c8de0`: rakss production lists its own values
>   (`inherit_project_values: false`; project values override env values in
>   nexos-secrets). Its `DATABASE_URL` reads `rakss.production_database_url`.
>   Local and test still use `rakss.database_url` (the test DB).
> - The `rakss_backend` password is rotated. The new URL is stored
>   SOPS-encrypted, and a TCP sign-in check passed.
> - The production env renders 13 keys; its `DATABASE_URL` points at
>   `rakss_backend_production`.
>
> Ship attempt 1 failed in the backend image build: the `bcrypt` 5.1.1
> prebuilt download failed (node-pre-gyp). It was transient: the same
> unchanged step succeeded on the build server 3 minutes later.
> Fix attempt: warm the podman cache with that successful run, then ship again.
>
> Ship attempt 2: both images built and were pushed to Harbor
> (`rakss-backend`, `rakss-web-admin`), then the test stage failed. It ran
> `npm test` in the built backend image, which has no npm (exit 127). That
> stage comes before migrations and deploy.
>
> Rollback check: nothing to roll back.
> - 10.0.60.10 has no rakss containers and no new env file.
> - There is no deployment record and no hrflow entry in `services.yaml`.
> - The test runner has no leftover test container.
> - The DB is not migrated (no drizzle schema, no `session_version`; 18 tables).
> The pushed images remain in Harbor; they're harmless.
>
> Next fix, needing Nova's go:
> 1. Add `test: {mode: external}` to `homelab.yaml`: the runtime image is
>    production-only, and the suites already ran against a migrated Postgres.
> 2. Re-run `homelab apps ship rakss --yes`.
> 3. Make and merge the Traefik route proposal, then run the live checks.
>
> Follow-up: replace `bcrypt` with `bcryptjs` (hashes are compatible) so
> image builds stop downloading a native binary from GitHub.


> **Release status 2026-10-26 (later): deploy STOPPED at a safe point. Waiting for Nova.**
>
> Done:
> - 10 local commits on `main` (`9fd4904`..`8f62736`), not pushed. The ship
>   flow syncs with rsync, so it doesn't need a push. `8f62736` accepts
>   `TRUST_PROXY=1`, sets `TRUST_PROXY` in production, and moves
>   `POLICY_STORAGE_DIR` to `/app/data/rakss/policies` (persistent mount).
> - `homelab apps ship rakss --dry-run`:
>   - backend → `api.hrflow` on port 4001, web-admin → `admin.hrflow` on port
>     8080, both on 10.0.60.10;
>   - both ports are free; rakss is not currently deployed; no hrflow
>     route or DNS record exists.
> - Production DB `rakss_backend_production` (Nova chose it over the test DB):
>   - Contents: 1 admin user (2026-04-04), 0 employees, 3 seed policies.
>   - Verified backup:
>     `root@10.0.40.10:/var/backups/homelab/rakss-backend/rakss_backend_production-pre-hrflow-20261026T161309Z.dump`
>     (sha256 `c3b02b8d…07cf840`; `pg_restore --list` shows 16 tables' data).
>   - Schema repair: the DB lacked `job_requisitions` and
>     `recruitment_applications`. I created them from `0000_baseline.sql`
>     (one transaction, `SET LOCAL ROLE rakss_backend`).
>   - Columns and index definitions now match the baseline exactly.
>     Constraint names still differ (`*_key`/`*_fkey` vs drizzle's names);
>     the app matches them by substring, so this is harmless.
>   - Undo: `DROP TABLE recruitment_applications, job_requisitions;` (both empty).
>
> Blocker (needs Nova):
> - In `nexos-dotfiles/secrets/catalog.yaml`, local, test and production all
>   read `DATABASE_URL` from one key, `rakss.database_url`. Today that key
>   points at the test DB `rakss_backend_test_20260620`.
> - Production needs its own value in `environments.production.values`
>   (e.g. `rakss.production_database_url`), plus a rotated `rakss_backend`
>   password. Repointing the shared key would aim local and test runs at
>   production.
> - The production env grants access to principal `device.novara-code`
>   only. Whether a deploy from this laptop can resolve it is unproven.
>
> Not touched: the app containers, Traefik routes, AdGuard DNS, TLS, and
> every secret.
>
> Homelab engine bug (owner nexos-homelab): `apps database
> backup|verify|rotate-password` log in with `-U postgres`
> (`internal/apps/database_sql.go:56-92`), but the central Postgres container's
> admin role is `admin`, so they fail with `role "postgres" does not exist`.
>
> Resume order once the blocker is settled:
> 1. Rotate the `rakss_backend` password and store the production URL.
> 2. `homelab apps ship rakss --yes`: migrate adopts the baseline and applies
>    0001; the env seeds the first admin.
> 3. `homelab ops traefik sync --plan …` for the route proposal; Nova merges
>    the `control/services-apply-*` branch into dotfiles main.
> 4. Verify: DNS, the hrflow TLS certificate SAN, `/health` on both,
>    `/graphql` through the admin nginx, and sign-in.
>
> The packet worktrees are kept: they differ from main where later commits
> changed files. Full diffs are archived in `.claude/handoff-assets/packet-patches/`.


> **Update 2026-10-26 (resumed session):** all 7 packets are merged into the
> main working tree (still uncommitted), plus a follow-up round that fixed the
> 11 defects found by the final visual pass. Remaining: Nova's go-ahead for
> commits, hrflow DNS/route/TLS, and deploy (step 5 below). Steps 1–4 are done.
>
> Proof on the final merged tree:
> - `bun install --frozen-lockfile`, `bun run build`, web-admin lint, and
>   `tsc --noEmit` for backend, web-admin and mobile: all pass.
> - Backend unit: 9 suites, 77/77 passed. Integration on a fresh migrated
>   Postgres 17: 12 suites, 68/68 passed. `drizzle-kit check`: clean.
> - Mobile `expo export` for android and web: pass. react-native-screens is
>   pinned to ~4.11.1 (Nova's choice); full Expo SDK 53 alignment is a follow-up.
> - Opus visual pass on the integrated stack: every admin page at 1440 and 390,
>   plus mobile web at 390. No horizontal scroll and no console errors. Payroll
>   preview, process and pay; readable errors; logout revocation; the
>   New-employee failure path; payslips hidden until PAID; `pendingDays`.
> - Follow-up fixes were checked by their own agents at 1440 and 390. Not seen:
>   the admin payroll table at 390 with payslips present.
>
> Lead cleanup done: dropped the reports chart workaround; folded W2's duplicate
> `readableError` and confirm dialog into `lib/graphql-errors` and
> `components/ui/confirm-dialog`; removed `@tanstack/react-query`,
> `@tanstack/react-table`, `zustand`, `date-fns`.
>
> Behaviour changes to note in commits:
> - GraphQL 409 conflicts now return code `CONFLICT` instead of `INTERNAL_SERVER_ERROR`.
> - The attendance report counts open (clocked-in) days.
> - `createEmployee` and `updateEmployee` reject a work email that belongs to
>   another sign-in account.
> - The mobile app uses `router.navigate`, which avoids the expo-router 4
>   `__EXPO_ROUTER_key` URL leak.
>
> Evidence: `/tmp/claude-1000/-home-nova-projects-work-rakss/389019ae-895e-4c51-9157-4c5f15184660/scratchpad/`
> (`final/ui/shots`, `w2/shots`, `mb/shots`, `web-fix/shots`, `mb-fix/shots`).


Status: **paused** — 5 of 7 fix packets merged into the main working tree
(uncommitted); 2 packets (web workflows, mobile) stopped mid-work by the
session usage limit and are saved in their own worktrees.

## Context

- Repo: `/home/nova/projects/work/rakss` (product **HRFlow Pro**), branch `main`,
  HEAD `dd344e0` — nothing committed during this work.
- Origin: full project review + design/workflow review on 2026-10-25, then
  Nova asked to "do all the fixes in parallel".
- Decisions from Nova:
  - Product name: **HRFlow Pro**.
  - Public domains: `api.hrflow.lab.novadev.tech` and `admin.hrflow.lab.novadev.tech`.
  - Internal ids stay `rakss`: homelab `project`, the DB `rakss_backend_production`,
    the NexOS project, and the `RAKSS_ADMIN_*` secret names.
  - Payroll pay basis: **full pay, deduct absences**. Pay is prorated only by
    join/exit dates and unpaid leave; clock-ins no longer affect pay.
  - Employees see payslips only for PAID periods (lead default).
- Authority given: local fixes and validation only. Commit, push, deploy,
  Homelab DNS/route/TLS, and production changes were **not** authorized.

## Packet state

| Packet | Worktree (`.claude/worktrees/…`) | State |
|---|---|---|
| D — deploy/migrations/config | agent-a30cfb15d02e74e1d | merged into main tree |
| A — backend auth/security | agent-ade73b6fa49a44e9d | merged |
| B2 — leave/employee/org/recruitment | agent-ae2cd637d387f596d | merged |
| B1 — payroll/attendance/location/reports | agent-a210e27bffc70f85c | merged |
| W1 — web pages, shared UI, design system | agent-a355fb3c3fb8db193 | merged |
| W2 — web nav, People/New-employee flow, Organisation page, attendance, recruitment | **agent-a0ee11377458ff74a** | **stopped mid-work, not merged** |
| MB — mobile redesign + fixes | **agent-a09a344bad7725112** | **stopped mid-work, not merged** |

The merged worktrees still exist; their `git add -A` index state only served
to export the patches. Remove them once the work is committed:
`git worktree remove <path>`.

### W2 last known point

- It was fixing `sr-only` labels leaking out of horizontal scrollers by
  making the scroll containers `relative`.
- 28 changed paths. They include new `features/organisation/`,
  `features/shared/`, `features/employees/{new-employee-sheet,step-forms,action-sheets,mutations}.tsx`
  and `pages/OrganisationPage.tsx`.
- It deleted `features/{employees,attendance}/{forms,hooks}.ts(x)`.
- No final report exists, so its lint, typecheck, build and visual proof are
  **not verified**.

### MB last known point

- It was fixing the geofence message: it says "clock in" during clock-out,
  and 1863 m needs a thousands separator.
- 32 changed paths. They include a new `src/theme.ts`, `src/components/`,
  `app/payslip/`, `app/policies/`, `app/request-leave.tsx`, `assets/`,
  changes to `package.json`, and a modified **`bun.lock`**.
- `apps/mobile/dist-review/` is export output. Do not merge it.
- No final report exists, so its proof is **not verified**.

## Proof accepted on the merged main tree (2026-10-25/26)

Run by the lead after merging D, A, B2 and B1, before W1 was merged:

- `bun run build:backend` → ok.
- `bunx tsc --noEmit -p apps/backend/tsconfig.json` → ok.
- `bun run test:backend:unit` → 7 suites, 70/70 passed.
- Integration on a throwaway Postgres 17 created by the new migrate script
  (`node dist/src/scripts/migrate.js` → "Applied 2 migration(s); 2/2 recorded",
  then `ensure-schema.js` seeded):
  `bunx jest --config jest.config.js --runInBand` → 12 suites, 63/63 passed.
- `bunx drizzle-kit check` → "Everything's fine".

Each packet agent also reported its own passing proof in its worktree.

**Not verified on the merged tree:**
- web-admin lint/typecheck/build after the W1 merge;
- the full app UI against the new backend (payroll preview dialog,
  `canViewPayroll`, `pendingDays`, logout revocation, readable errors);
- both Docker image builds (no Docker daemon on this host);
- nginx inside the real image;
- anything live.

## Lead integration edits (main tree, outside packets)

- `apps/web-admin/src/lib/format.ts`: shared formatters, also copied into
  W1/W2.
- `.nexos/env.yaml`: production URLs moved to the hrflow domains.
- `bun.lock` regenerated with `bun install` after D removed root devDependencies.
- `apps/backend/drizzle/0001_session_version_and_unpaid_leave.sql`, generated.
- `leave/leave.types.ts` and `leave.service.ts`: `isPaid` on LeaveTypeType and
  the create/update inputs.
- `database/seeds.ts`: `UNPAID` leave type with `isPaid=false`.
- `payroll/payroll-calculator.ts`: `countPayrollWorkingDays` now delegates to
  `leave/leave-days.ts countWorkingDays`.
- `__tests__/mobile-self-service.spec.ts`: marks the period paid before the
  employee reads payslips, and asserts payslips stay hidden until then.

## Resume order

1. Resume the two stopped agents, if their sessions still exist, with
   SendMessage. Otherwise start fresh implementers with the same scope; their
   briefs are in this conversation's history.
   - W2 continues inside `.claude/worktrees/agent-a0ee11377458ff74a`.
   - MB continues inside `.claude/worktrees/agent-a09a344bad7725112`.
   - Each finishes its validation and its final report.
2. Merge each one into the main tree. Pattern used for the other packets:

   ```bash
   W=<worktree>
   git -C $W add -A
   git -C $W diff --cached --binary dd344e0 -- . ':!bun.lock' ':!apps/web-admin/src/lib/format.ts' ':!apps/mobile/dist-review' > /tmp/<x>.patch
   git apply --check /tmp/<x>.patch && git apply /tmp/<x>.patch
   ```

   Then run `bun install` to regenerate `bun.lock`, which adds MB's dependencies.
3. Final proof on the merged tree:
   - `bun run build`
   - `bun run --cwd apps/web-admin lint`
   - backend unit tests
   - the integration suite on a migrated scratch Postgres (steps above)
   - a local-stack screenshot pass of every admin page at 1440 and 390,
     plus a mobile web export.
4. Lead cleanup decisions:
   - Drop W1's client-side "show department cost chart only when net pay > 0"
     workaround, now that B1 fixed the report join.
   - Remove now-unused web-admin dependencies after the W2 merge: check
     `@tanstack/react-query`, `@tanstack/react-table`, `zustand`, `date-fns`.
5. Gated, and each needs Nova's explicit go-ahead:
   - Commits: split atomically per concern, following git-ops.
   - Homelab hrflow DNS/route/TLS. As of 2026-10-25,
     `api.hrflow.lab.novadev.tech` serves a self-signed certificate. nginx now
     has `proxy_ssl_verify on`, so `/graphql` through the admin image returns
     502 until a valid certificate exists.
   - Deploy. `migrate:deploy` adopts the push-created production DB as the
     baseline, then applies `0001`. Every user must sign in again because old
     tokens carry no `ver`.

## Known limitations / follow-ups (not in scope)

- Arabic names in PDFs still need an embedded Unicode font with text shaping.
  Names now print as "see employee record (EMP…)".
- Money columns are still `doublePrecision`. Values are rounded to 2 decimals,
  but switching to `numeric` needs its own migration.
- No compensation history: reprocessing an old month uses current pay.
- No API to revoke a staff role.
- Expo SDK package alignment: see the MB report once it exists.
- The login rate limiter is in-memory, per instance.

## Ephemeral evidence (may not survive reboot)

Everything below is under
`/tmp/claude-1000/-home-nova-projects-work-rakss/7cf6f3ab-8132-42ed-b554-57a8400fed60/scratchpad/`.

- `shots/`: review screenshots of the original app.
- `w1/shots/`: W1 after-screenshots.
- `patches/`: the applied D/A/B2/B1/W1 patches.
- `seed-demo.mjs`: demo data seeding through the API. A durable copy is at `.claude/handoff-assets/seed-demo.mjs` (gitignored).
