# Phase 1 — Quote, run, report

## What was built

- **`/`** URL input → `Job{status: quoting}` → **`/q/<id>`** quote page. The worker resolves
  the commit, shallow-clones, runs `tokei`, detects repo markers, computes the scope
  (which checklists / known-vector groups the corpus would load) and prices every enabled
  model. The page shows LOC, language mix, scope, the token breakdown and the price
  table, then lets the submitter pick tier (quick / standard / BYOK), model and disclosure.
- **Pricing** (`packages/pricing`): COSTS.md formula. Input = 15K fixed floor + in-scope
  corpus share + 10 tokens/LOC × 1.6; output interpolated from the COSTS.md size table.
  The corpus share is derived from the same table (mean of `input − 15K − 16×LOC` over
  the 2K–100K rows ≈ 96.6K for the reference monorepo) scaled by the repo's in-scope
  fraction, instead of the raw ~272K "full corpus" upper bounds. Price = cost × `MARGIN`,
  rounded up to cents. `PRICING_CALIBRATION` multiplies the estimate once real runs exist.
- **Worker** (`apps/worker`): claims jobs with `FOR UPDATE SKIP LOCKED`, clones at the
  pinned sha, mounts it read-only into the sandbox, streams runner events into
  `JobEvent`, ingests the report, stores actual usage next to the quote.
- **Sandbox** (`sandbox/`): Debian slim image with node, git, ripgrep and the Claude
  Agent SDK (bundled Claude Code binary, installed at image build time). No compilers,
  no package managers. `--read-only`, tmpfs workspace, `--cap-drop ALL`,
  `no-new-privileges`, pids/memory/cpu limits, non-root. Internal Docker network whose
  only exit is the allowlist CONNECT proxy (`api.anthropic.com:443`). The API key is
  passed on stdin inside the job spec and never touches disk or logs.
- **Runner** (`sandbox/runner`): one Agent SDK session, sequential turns
  `/auditor:intake /target --auto` → `/auditor:audit-cycle /target --scope full` →
  finalize. `permissionMode: bypassPermissions` with an explicit `disallowedTools` list
  (build/network commands, WebFetch/WebSearch, edits under /target and /corpus).
  `maxBudgetUsd` from the quote × `BUDGET_FACTOR`; `error_max_budget_usd` →
  `failed_budget`. All model aliases (opus/sonnet/haiku) are pinned to the job's model so
  the corpus's subagents cannot escalate. Writes `/out/report.md` byte-for-byte,
  `/out/run.json` (per-call usage, per-model totals, per-turn results), `/out/status.json`.
- **Prompt layer** (`apps/worker/prompts`): `system-append.md` (workspace layout, the
  untrusted-input rule from non-negotiable 3, hard limits, report requirements) and
  `turns.json`.
- **Report parser** (`packages/report`): handles both corpus layouts (client
  `audit-report.md` and internal `report-template.md`), derives counts from finding
  blocks, cross-checks the declared tables, extracts highest severity / risk score /
  metrics, and implements redaction + the disclosure rules. 16 tests against fixtures.
- **Report page** `/r/<owner>/<repo>/<sha>`: sanitised markdown, badges, metadata,
  attestation link, redaction notice. Private reports need `?t=<accessToken>`.
- **`scripts/ingest-report.ts`** for manually produced reports (same storage contract,
  optional `--attest`). **`scripts/quote-local.ts`** for offline pricing checks.

## How to run

```bash
pnpm db:up && pnpm db:deploy
pnpm sandbox:proxy:build && pnpm sandbox:build
pnpm dev:worker            # terminal 1
pnpm dev:web               # terminal 2
# paste https://github.com/deanmlittle/anchor-escrow-2024 on http://localhost:3000
# choose Standard + model, then "Operator: run without payment" with ADMIN_TOKEN
```

## The first real run

The operator picks the target repository (nothing is run against a repo they have not
chosen). For an offline sanity check of the pricing formula only, the quote tool was run
against **https://github.com/deanmlittle/anchor-escrow-2024** at
`35d08ffd38fc4844dfbfd5609658f7aa955cafa3` — 282 lines of Rust (Anchor escrow with
make/take/refund) + 138 lines of TypeScript tests, 500 code lines in total. No LLM run
happened.

Offline quote (`scripts/quote-local.ts`), corpus 7.3.0@6bb2cbf:

| Model | Est. input | Est. output | Raw cost | Cap (×1.5) | Price (×2.5) |
|---|---|---|---|---|---|
| claude-opus-5 | 97,893 | 80,000 | $2.49 | $3.74 | 6.23 USDC |
| claude-sonnet-5 | 97,893 | 80,000 | $1.00 | $1.50 | 2.49 USDC |
| claude-haiku-4-5 | 97,893 | 80,000 | $0.50 | $0.75 | 1.25 USDC |

**Actual cost: pending.** The run needs Docker (not installed on this machine yet) and
the operator's approval to spend on their API key. `audit-cycle` fans out to several
subagents (context-builder, threat-modeler, vuln-hunter, economic-analyst,
peer-reviewer, audit-reporter) that each re-read parts of the code and corpus, so the
first run is expected to land above the single-pass estimate; that gap is what
`PRICING_CALIBRATION` is for. Record here after the run: model, input/output/cache
tokens, SDK cost, our cost at config rates, wall-clock, and the calibration factor chosen.

## Left out (and why)

- The live run itself (Docker + spend approval).
- Quick-tier "which vectors would trigger" is at group granularity (INDEX.md sections),
  not per-vector marker matching: per-vector markers need a grep pass over the code,
  which the free tier deliberately does not do.
- References in the estimate scale with the checklist fraction because grep markers are
  unknown before the audit reads the code.
