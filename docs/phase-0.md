# Phase 0 — Scaffold

## What was built

- **Environment check.** node 22.19, pnpm 10.30, rustc/cargo 1.89, solana-cli 3.1.10,
  anchor-cli 1.0.0, git 2.43 were present. `tokei` 15.0 was installed with cargo. Docker
  was missing and needs a sudo install (see README → Requirements); everything that does
  not need Docker was built and verified.
- **Monorepo** (pnpm workspaces): `apps/web`, `apps/worker`, `packages/{db,pricing,report,attest}`,
  `sandbox/{runner,egress-proxy}`, `programs/audit_attest` (Phase 2), `config/models.json`,
  `reports/`, `docs/`.
- **Submodule** `vendor/auditor-skill` pinned at `6bb2cbf` (7.3.0). Never modified; the
  pre-commit hook refuses commits that move the submodule pointer.
- **Postgres** via `docker-compose.yml`; **Prisma** schema with users, maintainer
  verifications, jobs, job events, quotes, payments, reports, attestations. Initial SQL
  migration generated from the schema (`packages/db/prisma/migrations/0001_init`).
- **`.env.example`** documents every variable in the monorepo.
- **Secrets guard:** `scripts/check-secrets.sh` + `.githooks/pre-commit`
  (`pnpm hooks:install`). Scans for API keys, tokens, keypair arrays, private key blocks.
- **README** with the run book.

## How to run

```bash
pnpm install
pnpm hooks:install
cp .env.example .env            # fill DATABASE_URL at minimum
pnpm db:up                      # needs Docker
pnpm db:deploy                  # applies migrations
pnpm build && pnpm test
```

## Left out (and why)

- Nothing from the Phase 0 list. Docker-dependent steps (`db:up`, migrations against a
  live database) were not executed in this session because Docker was not installed;
  the migration SQL was generated offline with `prisma migrate diff` so `db:deploy` works
  as soon as Postgres is up.
