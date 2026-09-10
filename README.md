# Auditor Attest

## How I run it

```bash
cd ~/dev/auditor-site
pnpm dev                      # → http://localhost:3000
```

That one command does everything: installs dependencies, inits the corpus submodule,
creates `.env` with generated secrets if missing, starts Postgres, generates the Prisma
client, applies migrations, builds the shared packages, builds the sandbox images if they
are missing, then runs the worker and the web app together. Every step is a fast no-op
when nothing changed. `Ctrl+C` stops worker and web; `pnpm db:down` also stops Postgres
(data is kept).

Options: `pnpm dev -- --rebuild-images` (after changing `sandbox/`), `pnpm dev -- --setup-only`.
`bash scripts/dev-up.sh` = setup + full build + tests, without starting anything.

**Audits you ran by hand** go in `examples i runned local/<Org>/<repo>/` (a git clone with
the corpus's `audit_1/REPORT.md` inside; the folder is gitignored). Set `EXAMPLES_MODEL`
in `.env` to the model you used and `pnpm dev` publishes them all on the site (repo and
commit come from the clone). Dry run without a database:
`pnpm ingest:examples -- --dry-run`.

**Re-run one locally with your own Claude Code login** (no API key, single agent, current
corpus 7.3.0): `pnpm audit:local -- Kamino/klend`. It pulls the newest default branch of the
clone (hooks off, no submodules, detached checkout), runs `/auditor:audit --scope program`
through the corpus plugin with Task/Agent disallowed and Bash limited to read-only
inspection, writes `audit_N/REPORT.md` + `.attest.json`, and prints the counts. Add
`--ingest` to publish it right away, `--scope full`, `--model <alias-or-id>` (default
`fable`), `--no-pull`. Each run takes a while; run them one at a time.

**Re-run all of them through the platform** (spends on `ANTHROPIC_API_KEY`, no payment step):
`pnpm audit:batch -- --from-examples --model claude-opus-5 --scope program`; `--head` for
the default-branch HEAD, `--dry-run`, `--only kamino`. Both audits of a commit stay visible
on its report page.
Secrets live in `.env` (gitignored). To run a real audit you need `ANTHROPIC_API_KEY`
there; to enqueue without paying use the operator button on the job page with `ADMIN_TOKEN`.

---

Paste a public GitHub link, get a price quote, pay in USDC on Solana mainnet, and an AI
security audit runs against the repository using the open-source
[auditor-skill](https://github.com/solanabr/auditor-skill) corpus. The result is a
report (private, or public with disclosure rules enforced in code) plus an on-chain
attestation that binds repo, commit, corpus version, model, report hash, severity
counts and timestamp, signed by the service key.

The corpus is consumed as a pinned git submodule (`vendor/auditor-skill` @ `6bb2cbf`,
version string `7.3.0@6bb2cbf`). Nothing in it is edited or copied. This repository owns
only the web app, the job runner, pricing, payments, attestation, storage, and the prompt
layer that drives the auditor.

## Layout

```
apps/web                Next.js (App Router, server components, Tailwind)
apps/worker             job runner: quotes, sandbox orchestration, ingest
apps/worker/prompts     the prompt layer (system append + turn prompts)
programs/audit_attest   Anchor program (Phase 2)
packages/db             Prisma schema + client
packages/pricing        quote engine (tokei + COSTS.md formula + config/models.json)
packages/report         report parser → counts/findings, redaction, disclosure rules
packages/attest         client for the Anchor program + arg encoding
sandbox/Dockerfile      ephemeral job container image
sandbox/runner          runs inside the container (Claude Agent SDK + auditor plugin)
sandbox/egress-proxy    allowlist-only CONNECT proxy (api.anthropic.com only)
vendor/auditor-skill    git submodule, pinned, read-only
reports/                local report store (see reports/README.md)
config/models.json      model ids + prices (hand-maintained)
scripts/                ingest-report.ts, refund.ts, check-secrets.sh
docs/                   phase notes, roadmap, upstream wishlist, self-audit
```

## Requirements

- Linux filesystem (WSL2 is fine). Never run this from `/mnt/c`.
- node ≥ 20, pnpm 10, git, `tokei` (`cargo install tokei --locked`).
- Docker Engine with the compose plugin. On Ubuntu/WSL:
  ```bash
  sudo apt-get update && sudo apt-get install -y ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker $USER
  printf '[boot]\nsystemd=true\n' | sudo tee -a /etc/wsl.conf   # then: wsl --shutdown from Windows
  ```
- For Phase 2: rustc/cargo, solana-cli, anchor-cli.

## Quick start (local)

```bash
git clone --recurse-submodules <this repo> && cd auditor-site
pnpm hooks:install                 # pre-commit secret scan + submodule guard
cp .env.example .env               # fill in the values (see below)
bash scripts/dev-up.sh             # postgres, migrations, sandbox images, build, tests
pnpm dev:worker                    # terminal 1
pnpm dev:web                       # terminal 2 → http://localhost:3000
```

Zero-cost checks: `pnpm exec tsx scripts/smoke-local.ts <github url> --keep` (quote a
repo), `pnpm exec tsx scripts/sandbox-smoke.ts` (run the sandbox with a dummy key).

Minimum `.env` for a local end-to-end run: `DATABASE_URL`, `ANTHROPIC_API_KEY` (standard
tier), `ADMIN_TOKEN` (to enqueue without paying), `BYOK_KEK` (if you want the BYOK tier).
Payment and attestation need `RPC_URL`, `TREASURY_PUBKEY`, `ATTESTER_KEYPAIR_PATH`,
`AUDIT_ATTEST_PROGRAM_ID` (Phase 2). Every variable is documented in `.env.example`.

## How a job flows

1. `/` → paste URL → `Job{status: quoting}`.
2. Worker: resolve commit, shallow clone, `tokei`, detect scope, price for every enabled
   model, store `Quote`, `status: quoted`.
3. `/q/<id>` shows the free tier (stats + which checklists/vectors would load) and the
   estimate per model. Choose tier / model / disclosure.
4. Standard or BYOK → `awaiting_payment` with a `Payment{memo: jobId}`. Pay USDC on
   mainnet with the memo (Phase 2 automates the watch) or use the operator "Enqueue now".
5. Worker: shallow clone at the pinned commit, mount it read-only into an ephemeral
   container on an internal network whose only exit is the egress proxy
   (`api.anthropic.com:443`). The runner drives `/auditor:intake --auto` then
   `/auditor:audit-cycle` through the Claude Agent SDK with a hard USD budget.
6. Ingest: `report.md` byte-for-byte, `meta.json`, DB row, then attestation.
7. `/r/<owner>/<repo>/<sha>` renders the report with disclosure rules applied.

## Disclosure rules (enforced in `packages/report/src/visibility.ts`)

- `private`: reachable only with the access token in the link.
- `public` + verified maintainer: everything visible.
- `public` + unverified: Critical and High findings redacted until the maintainer
  acknowledges or 90 days pass. Severity counts always visible.
- On-chain: hashes and counts only, never finding text.

## Sandbox guarantees

Read-only target mount, read-only corpus mount, tmpfs workspace, `--read-only` root,
`--cap-drop ALL`, `no-new-privileges`, pids/memory/cpu limits, non-root user, no
compilers or package managers in the image, tool denials for build/network commands, and
an internal Docker network whose only route out is the allowlist proxy. The API key is
delivered over stdin as part of the job spec and never written to disk or logs.

## Manual ingest

```bash
pnpm ingest path/to/REPORT.md --repo https://github.com/owner/repo --commit <40-hex sha> \
  --model claude-opus-5 [--visibility public] [--verified] [--attest] [--run-json run.json]
```

## Security notes

- Secrets never enter git: `.env` is ignored; keypairs live outside the repo; the
  pre-commit hook scans staged content.
- The audited repository is untrusted input for the LLM too. The prompt layer says so
  explicitly and the sandbox makes it structurally true.
- Mainnet only. `CLUSTER` other than `mainnet-beta` makes the worker refuse to start.

See `docs/phase-*.md` for what each phase built and left out, `docs/roadmap.md` for what
is intentionally not built, and `docs/upstream-wishlist.md` for corpus requests.
