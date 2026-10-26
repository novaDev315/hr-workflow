# HRFlow Pro — overnight handoff (2026-10-27)

Resume in `/home/nova/projects/work/rakss` with
"resume from docs/handoffs/2026-10-27-hrflow-overnight.md".

## Baseline

- `main` = `origin/main` at the commit that adds this file (parent `ff1835d`). Working tree clean.
- Review branch `feat/numeric-money` pushed (`5f56b91`, based on `c738d01`). Not merged, not deployed.
- No worktrees. The old packet worktrees and their `worktree-agent-*` branches were removed.
- **Live is unchanged.** Nothing was shipped tonight. Production still runs the
  2026-10-26 release (containers `rakss-*-20261026-163746`).

## Done tonight

| Item | Result | Commits |
|---|---|---|
| Handoffs committed, 11 commits pushed | done | `c738d01` |
| Old packet worktrees removed | 7 worktrees + branches; diffs stay archived in `.claude/handoff-assets/packet-patches/` | — |
| 1. Route record merged | tx `tx_20261026-164256` pushed via `homelab control tx push`, fast-forwarded dotfiles `main` to `bd6f450`, CT310 checkout pulled, `control sync from-repo` → tx **merged**. YAML diff = only `rakss-backend` + `rakss-web-admin`. Both hrflow `/health` 200 after. | dotfiles `bd6f450` |
| F3 homelab.yaml v2 | `schema_version: 2`, `deploy.host: 10.0.60.10`, v1 runtime pinned (bind 0.0.0.0, `/opt/app-data:/app/data`, apparmor unconfined) because Traefik is remote and policies persist under `/app/data`. `apps validate` clean; ship dry-run plans the same steps with that runtime. | `2f25b13` |
| F1 bcryptjs | native bcrypt removed; fixed native `$2b$` hash verifies in a unit test | `4a2f145` |
| F8 revoke staff roles | `revokeStaffAccess` (ADMIN only, bumps session version, last-ADMIN and self-lockout guards, row-locked); deactivation can't remove the last active ADMIN; web-admin "Remove" per role (confirm + toast, hidden on your own record) | `e0e8dc0` `1afb0ef` `61cb5ed` `33833ae` `c137dba` |
| F6 Arabic PDFs | Noto Naskh Arabic (OFL) subset, fontkit shaping, bidi-js with isolates; Latin stays Helvetica; hardened after review (wrap isolates, override controls stripped, long words, widths, subset tags) | `6df87a0` `cd59d67` |
| F4 e2e | sweep rewritten for the redesigned admin; now 49 checks incl. role removal, hire prefill, reject notes, over-balance approve | `7f749d8` `ff1835d` |
| F7 numeric money | **branch only**: 13 money columns → `numeric(14,2)`, migration `0002` (one rewrite per table), input bounds + overflow guard, head-independent migration test | branch `feat/numeric-money` |
| Web-admin UX | shared toast (errors persist) + list toolbar; reject needs a reason; over-balance/unknown-balance confirm; payroll register edit + run steps; policies status tabs; people cards on phones + inline validation; hire → employee prefill; payslip table fits | `2bfea76`…`06dd124`, `8c8ccd9`, `18607c3`…`5acbf5e` |
| Mobile UX | clock-in dead end removed, clock-out confirm, plain-language errors, inline leave validation with day count, request-sent confirmation, payslip download confirm, Arabic alignment | `cb4a39f`…`51e7cfb`, `e66855a` |

Every packet got an independent review (auth: changes_required → fixed; F7, PDF, frontend:
approved with findings → fixed).

## Proof (final tree)

- Backend: build, `tsc`, unit 11 suites / 92 tests, integration 13 suites / 81 tests
  (parallel workers and `--runInBand`) on throwaway Postgres 17. No migrations on `main` since the release.
- Web-admin: lint (0 warnings), `tsc`, build. E2E sweep on a local stack: **49 checks, 0 gaps**.
- Mobile: `tsc`, Expo web export; screens checked at 390×844 and 360×740 in headless Chrome.
- PDFs rendered with poppler (and mupdf by the reviewer); `qpdf --check` clean.
- F7 branch: build, `drizzle-kit check`, unit 85, integration 69, migration test on real data.

**Not verified:** Docker image builds (no daemon on the laptop — ship will build them), native
iOS/Android, Acrobat/PDFium rendering, a real sign-in on production.

## Needs Nova

1. **Sign in once** on `https://admin.hrflow.lab.novadev.tech` as `nova@hrflow.com`. Your password
   was **not** reset: Claude may not type a password into a production sign-in, so a temp password
   would not have helped. The local stack proves the sign-in path.
2. **Deploy approval** for current `main` (`homelab apps ship rakss --yes`). Image-only change, no DB
   migration. It is the first ship under `schema_version: 2`, so watch that both containers bind
   `0.0.0.0` and the `/app/data` mount exists, then re-run the live checks from the 2026-10-26 handoff.
   Rollback: redeploy the previous Harbor images (`rakss-backend` / `rakss-web-admin`, 2026-10-26 build);
   the 2026-10-26 release predates release history, so there is no one-command rollback for this first v2 ship.
3. **F7 decision.** `feat/numeric-money` is based on `c738d01`; rebasing onto `main` needs a force-push
   or a fresh branch (expect a small conflict in `payroll.service.ts`). Before deploying it: take a
   pg_dump and run a read-only `max()` over the 13 money columns (values ≥ 1e12 would abort the migration).

## Follow-ups (not done)

| Item | Owner | Notes |
|---|---|---|
| F5 Expo SDK 53 package alignment | rakss | untouched; keep `react-native-screens ~4.11.1` |
| F2 `-U postgres` in homelab db tools | nexos-homelab | own session |
| Cancel a pending leave request | rakss backend | no mutation exists; mobile can't withdraw |
| Uniform login error for malformed input | rakss backend | mobile maps it today |
| `canClockIn` / company time zone on the API | rakss backend | mobile hides clock-in by device date |
| `employeeId` on the session account | rakss backend | web hides Remove by email match |
| Bulk payslip export; paging on leave/attendance/employees | rakss backend | client-side filtering is fine at today's size |
| Toasts under an open modal are `aria-hidden` | rakss web-admin | Radix modal hides siblings |
| Local stack script | — | `/tmp/claude-1000/-home-nova-projects-work-rakss/3a8aee9d-3de8-452b-a406-3368dc067807/scratchpad/localstack.sh` (scratch, may not survive reboot) |

## Shell notes

`cat`, `rm`, `cp`, `mv` and `ls` are aliased; use `command …` and absolute paths.
The profile's `initdb` is broken (missing share files); a full Postgres 17 is in the Nix store.
