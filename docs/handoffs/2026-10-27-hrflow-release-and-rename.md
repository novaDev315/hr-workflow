# HRFlow Pro — release, F2/F5/F7, and the hr-workflow rename plan (2026-10-27)

Resume in `/home/nova/projects/work/rakss` with
"resume from docs/handoffs/2026-10-27-hrflow-release-and-rename.md".

## Baseline

- `main` = `origin/main` (this file's commit; parent `1806a93`). Working tree clean, no worktrees.
- **Live** (10.0.60.10): `rakss-backend` / `rakss-web-admin` images `20261027-092028`
  (main at `ac8ada7`, i.e. everything except the mobile-only F5 commit). Database has migrations 0000–0002.
- homelab CLI **0.1.105** installed on the laptop (rollback:
  `homelab publish package install @nova/homelab@0.1.104 --prefix /home/nova/.local/share/homelab-cli/0.1.104`).

## Done today

| Item | Result |
|---|---|
| Password reset | `nova@hrflow.com` reset by a script that never printed the password (hash guarded on the old one, session version bumped, stored hash verified). Temp password: `~/hrflow-temp-password.txt` (0600). Old hash for rollback: `~/.local/state/hrflow-password-rollback-20261027.txt` (0600). |
| Change password | New: `changePassword` mutation (current password checked and rate-limited, 8–72 bytes, old tokens revoked, fresh session returned) and a "Change password" sheet (key icon in the sidebar footer). The API client now ignores auth errors from requests sent with a replaced token. Reviewed (changes_required → fixed). `9d2601d` `a788cf6` `8f1b089` |
| Deploy 1 | `homelab apps ship rakss --yes` at `85934fd`. First try failed in the remote build (SSH to build server 10.0.30.20 timed out, nothing deployed); retry shipped `20261027-091510`. v2 runtime kept (0.0.0.0, `/opt/app-data:/app/data`, apparmor unconfined). |
| F2 | nexos-homelab `82aff0a`: central Postgres container fallbacks log in as the container's `POSTGRES_USER` (central is `admin`), old receipts restore as auto. Reviewed (approved). Released as `@nova/homelab@0.1.105` (`chore(release)` commit pushed, package published, installed). Live proof: verified backup `rakss-backend-20261027T091931Z` (129 entries, sha256 `f0cd46b3…`), restored into a scratch DB (19 tables, counts match prod), scratch DB dropped. |
| F7 | Rebased as `feat/numeric-money-v2` (no force-push; old `feat/numeric-money` left on origin, now superseded), re-proved on current main (unit 99, integration 14 suites / 83, e2e 49/49), merged, shipped `20261027-092028`. Prod money tables were empty (read-only check), so 0002 converted no rows. All 13 money columns are `numeric(14,2)`. |
| F5 | Mobile on the Expo SDK 53 set (RN 0.79.6, expo-router 5.1, splash 0.30, + expo-constants/expo-linking). `metro.config.js` turns package exports off (zustand 4's ESM `import.meta` crashed the web bundle — caught by a smoke test, fixed, re-smoked). `@types/react` stays 18 (excluded from the Expo check). Lockfile installs frozen with bun 1.3.9. `1806a93` — not deployed (mobile only). |
| e2e sweep | Made fresh-stack safe (`85934fd`): 49 checks, 0 gaps on a fresh stack. |

**Not verified:** native iOS/Android for F5; Nova's real sign-in with the temp password (Claude may not
type passwords into production sign-ins); the live Change password flow (proved locally only).

## Needs Nova

1. Sign in at https://admin.hrflow.lab.novadev.tech with the temp password from `~/hrflow-temp-password.txt`,
   change it (sidebar key icon), then delete that file and the rollback file.
2. Optionally delete the superseded remote branch `feat/numeric-money`.

## Next session: rename rakss → hr-workflow (decided 2026-10-27)

Nova chose **everything including live** and a **public GitHub repo with full history**. Plan it as its own
high-risk release (depth mid→enterprise: cross-owner rakss + nexos-homelab + nexos-dotfiles + Gitea/GitHub).

Surface found (read-only):
- Repo: GitHub `novaDev315/rakss` (private, origin). No `nova/rakss` reachable on Gitea with the laptop key —
  confirm in Gitea whether a rakss repo exists anywhere before planning the delete.
- Code: ~51 files mention rakss (`RAKSS_ADMIN_*` ×~120, `rakss-backend`/`rakss-web-admin`, `rakss_backend_production`,
  e2e script names, homelab.yaml `project: rakss`, docs).
- Dotfiles: `homelab/services.yaml` (routes), `homelab/lxc-inventory.yaml`, `secrets/catalog.yaml` (`rakss` entry:
  DATABASE_URL, JWT_SECRET, RAKSS_ADMIN_EMAIL/PASSWORD), `secrets/projects/rakss/runtime.yaml`,
  `secrets/projects/remote-development.yaml`.
- Live: homelab project/registry `rakss`, DB + role `rakss_backend_production`/`rakss_backend` (+ test DB
  `rakss_backend_test_20260620`), Harbor `library/rakss-*`, containers `rakss-*`, Traefik routes for `hrflow.*`
  (domains stay).
- Secret scan: gitleaks over 150 commits → 5 hits, all placeholders (`<random-secret>`, `YOUR_TOKEN`, truncated
  example JWTs). No env files ever committed. Re-scan the final tree + history right before going public.

Suggested order: (1) code rename on a branch (env var names with a compatibility read of the old names
during cutover), (2) new Gitea + GitHub repos (GitHub private first), push full history, (3) new homelab
project + DB copy from a verified backup + new vault keys + ship + route switch, verify, (4) retire the rakss
deployment (keep its backup), (5) final secret scan, flip GitHub public, (6) delete old repos last,
(7) rename the folder (Claude's per-folder memory moves with it — copy `~/.claude/projects/-home-nova-projects-work-rakss/memory/`).
Deleting repos and going public are irreversible/outward: do them only after the new ones are verified.

## Shell notes

`cat`, `rm`, `cp`, `mv` and `ls` are aliased; use `command …`. `pkill -f` patterns that appear in the
same command line kill the calling shell — use a `[h]ttp`-style pattern. Local test Postgres: see the
`local-postgres-for-tests` memory.
