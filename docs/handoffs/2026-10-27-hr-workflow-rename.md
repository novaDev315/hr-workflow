# HRFlow Pro — rakss renamed to hr-workflow (2026-10-27)

Resume in `/home/nova/projects/work/hr-workflow` with
"resume from docs/handoffs/2026-10-27-hr-workflow-rename.md".

## Baseline

- `main` = `github/main` = `origin/main` (this file's commit; parent `ff1457f`). Working tree clean, no worktrees.
- Remotes: `origin` = Gitea `nova/hr-workflow` (private), `github` = GitHub `novaDev315/hr-workflow` (**public**, full history).
- **Live** (10.0.60.10): `hr-workflow-backend` / `hr-workflow-web-admin`, images `20261027-103113` (main at `ff1457f`).
  Domains unchanged: https://admin.hrflow.lab.novadev.tech, https://api.hrflow.lab.novadev.tech.
- Database: `hr_workflow_backend_production` owned by role `hr_workflow_backend` (renamed in place, so the password,
  data and migrations 0000–0002 are unchanged). Test DBs: `hr_workflow_backend_test_20260620`, `hr_workflow_backend_test`.
- Dotfiles (`origin/main` `1bcade4`): `secrets/projects/hr-workflow/runtime.yaml`, catalog entry `hr-workflow`,
  `remote_development.hr_workflow`, services `hr-workflow-backend` / `hr-workflow-web-admin`. All rakss entries removed.

## What changed

| Area | Result |
|---|---|
| Code | `RAKSS_*` → `HR_WORKFLOW_*` (admin seed, e2e URLs, `HR_WORKFLOW_E2E_ALLOW_REMOTE`), `rakss-*`/`rakss_*` → `hr-workflow-*`/`hr_workflow_*`, homelab project `hr-workflow`, e2e scripts `scripts/e2e/run-hr-workflow-ui-lifecycle.mjs` + `hr-workflow-ui-lifecycle-sweep.js`. Dated handoffs keep the old name as history. `ff1457f` |
| Proof (code) | build, tsc, unit 99, integration 14 suites / 83, e2e 49/49 with 0 gaps on a fresh stack. |
| Cutover | Verified backup `rakss-backend-20261027T103025Z` (129 entries) → `apps remove` both rakss services → DB + role renames → `apps ship hr-workflow`. Downtime 10:30–10:34 UTC. Health 200, `authBootstrapStatus.accountCount` = 1 (existing admin kept). |
| Routes | services.yaml swap (control tx `tx_20261027-103551`), scoped `ops traefik sync` for both new services. The old route files were moved off the Traefik host to `/var/lib/traefik/backups/rakss-retire-20261027/`. `ops traefik diff`: 0 added/modified/removed (the adguard/traefik-dashboard conflicts were there before). |
| Secrets | New hr-workflow sops file (seed admin email domain moved to `hrflow.lab.novadev.tech`); rakss catalog entry and runtime file deleted (`1bcade4`). `nexos-secrets doctor` ok for production and local. |
| Homelab state | `database-state.json` entries are now `hr-workflow-backend` / `hr-workflow-backend-test`. The rakss backup records stay in `database-backups.json` as history. |
| Repos | Secret scan before going public: gitleaks over the full history found 5 hits, all placeholders; the tree scan and manual grep found no keys, tokens, credentialed URLs or personal emails. GitHub `novaDev315/hr-workflow` made public; `novaDev315/rakss` deleted (no issues, PRs, tags or releases; every branch was in main or superseded). No `nova/rakss` exists on Gitea. |
| Folder | `/home/nova/projects/work/rakss` → `/home/nova/projects/work/hr-workflow`; Claude memory copied to the new project folder. |

## Needs Nova

1. Sign in at https://admin.hrflow.lab.novadev.tech with the temp password from `~/hrflow-temp-password.txt`,
   change it (sidebar key icon), then delete that file and `~/.local/state/hrflow-password-rollback-20261027.txt`.
2. OpenBao: the broker sync for hr-workflow (and retiring rakss) is still pending — the laptop's AppRole login
   returned 400. Only remote-resolve on the Code Host needs it; local-sops deploys work.
3. `~/nexos-dotfiles` (the luna session's checkout) has uncommitted luna edits and is behind `origin/main`;
   pull after luna commits.
4. Optional: add a LICENSE to the public repo; remove old Harbor images `library/rakss-*`.

## Rollback (if ever needed)

Backups `rakss-backend-20261027T091931Z` and `…T103025Z` are kept. To return to rakss: `apps remove` both hr-workflow
services, rename the DBs/roles back, `git worktree add <dir> 7d5770b` and run
`homelab --project-root <dir> apps deploy rakss:20261027-092028`, restore the rakss route files from the Traefik
backup folder and the rakss secrets/services from dotfiles history (`1bcade4^`, `3227962^`).

## Shell notes

`cat`, `rm`, `cp`, `mv` and `ls` are aliased; use `command …`. Local test Postgres: see the
`local-postgres-for-tests` memory.
