# HRFlow Pro — next-session handoff (2026-10-26)

Start a fresh `claude` session in `/home/nova/projects/work/rakss` and say:
"resume from docs/handoffs/2026-10-26-hrflow-next-session.md".

## Baseline

- Owner repo: `rakss` (HRFlow Pro). Remote: `origin` = `git@github.com:novaDev315/rakss.git`.
- Branch `main` at `5b5856c`, **11 commits ahead of `origin/main`, not pushed**.
- Untracked: `docs/handoffs/` (this file and `2026-10-26-audit-fixes-safe-pause.md`).
- Stack: NestJS + Drizzle + GraphQL backend, React 19 + Vite web-admin, Expo SDK 53 mobile.
  Package manager: bun.
- Previous session's full record: `docs/handoffs/2026-10-26-audit-fixes-safe-pause.md`.
  The top block is the final live status.

## Live state (verified 2026-10-26 ~16:45 UTC)

- Admin site: `https://admin.hrflow.lab.novadev.tech`, container `rakss-web-admin-20261026-163746`
  on 10.0.60.10:8080.
- API: `https://api.hrflow.lab.novadev.tech`, container `rakss-backend-20261026-163746`
  on 10.0.60.10:4001.
- Database: `rakss_backend_production` on central Postgres (10.0.40.10).
  - Both migrations are applied.
  - The `rakss_backend` password was rotated.
  - Production `DATABASE_URL` comes from the production-only catalog key (nexos-dotfiles `47c8de0`).
  - Pre-deploy dump: `/var/backups/homelab/rakss-backend/rakss_backend_production-pre-hrflow-20261026T161309Z.dump`
    on 10.0.40.10.
- Let's Encrypt certificates are valid for both hostnames. Traefik doctor reported 0 missing routers.
- Live checks passed: health endpoints, CORS, authentication rejection, bootstrap disabled,
  security headers, deep links, and the login page with 0 console errors.
- **Not verified:** a real sign-in, which needs Nova's password. Use the existing account `nova@hrflow.com`.
- All earlier sessions were invalidated, so every user must sign in again.

## Rollback

- Routes: `homelab ops traefik rollback 20261026-164209` (the web-admin route sync), then
  `homelab ops traefik rollback 20261026-164106` (the backend route sync).
- Containers: `homelab apps remove rakss --yes`. Nothing was deployed before this release.
- Database: `pg_restore` the dump above. Use `docker exec postgres ... -U admin`; the homelab db tools
  wrongly use `-U postgres`.

## Open items — need Nova

1. **Merge the route record.** Merge `control/services-apply-20261026-164256` (commit `bd6f450`) into
   dotfiles main. It lives in homelab-control's `/home/nova/nexos-dotfiles` (CT310), and main is
   branch-protected. Parsed as YAML, the diff only adds `rakss-backend` and `rakss-web-admin`; the rest is
   formatting. Until it is merged, a full Traefik sync from `services.yaml` could drop the two routes.
2. **Sign in once** on the admin site with `nova@hrflow.com` to confirm.
3. **Push** the 11 commits to `origin/main`. This needs explicit approval.
4. **Commit `docs/handoffs/`** if wanted (e.g. `docs(handoffs): record audit-fix release`).
5. **Remove the old packet worktrees.** All 7 are under `.claude/worktrees/agent-*`, at base `dd344e0`.
   - Their work is merged into main, and their diffs are archived in
     `.claude/handoff-assets/packet-patches/*.patch`.
   - They aren't byte-identical to main, so the earlier "remove once identical" rule didn't clear them.
   - Removing them needs Nova's explicit go:
     `git worktree remove <path>`, then `git branch -D worktree-agent-*`.

## Follow-ups (separate tasks, none blocking)

| # | Item | Owner | Notes |
|---|------|-------|-------|
| F1 | Replace `bcrypt` with `bcryptjs` | rakss | Ship 1 failed on the bcrypt prebuilt download. |
| F2 | homelab `apps database backup/verify/rotate-password` hardcode `-U postgres` | nexos-homelab | The central Postgres admin role is `admin` (`internal/apps/database_sql.go`). |
| F3 | Move `homelab.yaml` to `schema_version: 2` and set `deploy.host` | rakss | Then use release-history rollbacks. |
| F4 | e2e selectors are likely stale after the web-admin redesign | rakss | Run the e2e suite. The sweep already refuses remote hosts. |
| F5 | Align mobile package versions with Expo SDK 53 | rakss | `react-native-screens` is pinned to `~4.11.1` on purpose (4.24 breaks RN 0.77). |
| F6 | Arabic font for generated PDFs | rakss | The current font is Latin-1 only. |
| F7 | Store money as numeric, not float | rakss | Needs a migration and careful review. |
| F8 | Staff role revocation | rakss | Granting roles bumps the session version; revoking roles has no path yet. |

Suggested order: items 1–2 first (Nova), then 3–5 on approval, then F1 and F4 as the cheapest
risk reducers. F2 goes to the nexos-homelab repo in its own session.

## Shell notes

`cat`, `rm`, `cp`, `mv` and `ls` are aliased. Use `command cat`/`command rm`/etc. and absolute paths.
