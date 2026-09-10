# Design review

What exists, how the pieces talk to each other, the trust boundaries, and what is
missing or thin. Written after Phases 0–3 were implemented and before the first real run.

## 1. Data flow

```
browser ──► apps/web (Next.js, server actions) ──► Postgres ◄── apps/worker
                │                                     ▲             │
                │ reads report.md/meta.json           │             ├─ git clone (host)
                ▼                                     │             ├─ tokei / estimate
            reports/<owner>/<repo>/<sha>/  ◄──────────┘             ├─ docker run sandbox ──► egress proxy ──► api.anthropic.com
                                                                    ├─ ingest (parse, hash, DB, files)
                                                                    ├─ attest (mainnet tx)                 [Phase 2, needs deploy]
                                                                    ├─ payment watcher (treasury ATA)      [Phase 2, needs RPC]
                                                                    └─ visibility sync (set_visibility)    [Phase 2, needs deploy]
```

Job state machine (Prisma enum `JobStatus`):

```
quoting → quote_running → quoted → awaiting_payment → queued → running → ingesting → done
                              │            │                      │
                              │            └── expired → cancelled└── failed / failed_budget
                              └── quick tier → done (no sandbox)
```

The web tier never shells out and never touches git, tokei, Docker or keys. Every
untrusted-input operation (clone, count, run) happens in the worker on a host you
control, and the LLM run itself happens inside a throwaway container.

## 2. Trust boundaries

| Boundary | Mechanism |
|---|---|
| Audited repo → worker host | shallow clone with hooks disabled, no submodules, size cap; only `git` and `tokei` read it |
| Audited repo → LLM | read-only bind mount; prompt layer declares it data, not instructions; no compilers/package managers in the image; tool denials for build/network commands |
| Container → internet | `--internal` Docker network; only route out is a CONNECT proxy allowing `api.anthropic.com:443`; DNS not needed (proxy resolves) |
| API key | delivered on the container's stdin inside the job spec; runner puts it only in the child process env; never on disk, never in logs (scrubber on the worker side too) |
| BYOK key | AES-256-GCM under `BYOK_KEK` while it sits in the jobs table; wiped when the worker claims the job |
| Report → browser | markdown sanitised (`rehype-sanitize`), no raw HTML, http(s) links only |
| Disclosure | `effectiveVisibility()` is the single decision point; the page redacts by finding block, table row and paragraph; counts are always shown |
| On-chain | attester-only writes gated by a config PDA; account holds hashes + counts only |

## 3. Where cost is controlled

- Quote: COSTS.md formula, corpus share derived from the corpus's own size table, per-model rates from `config/models.json`.
- Cap: `maxBudgetUsd` in the Agent SDK (client-side estimate) = estimate × `BUDGET_FACTOR`; hitting it ends the session with `error_max_budget_usd` → `failed_budget`.
- Model pinning: `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL` + `CLAUDE_CODE_SUBAGENT_MODEL` are all set to the job's model, so the corpus's `model: opus` subagents cannot run a pricier model than the one quoted.
- Wall clock: `MAX_JOB_MINUTES` abort inside the runner plus a hard `docker kill` five minutes later.
- Actuals: `run.json` (per call and per model) → `Report.costUsd`, `inputTokens`, … next to `Quote.estCostUsd` for calibration.

## 4. What is thin or missing

Ordered by how much it matters for a first real run.

1. **The estimate has never been calibrated.** `audit-cycle` spawns six subagents that
   re-read code and corpus. Expect the first run to land above the single-pass estimate;
   the cap will then abort a real job unless `BUDGET_FACTOR` is raised for the calibration
   run. Plan: run with a generous cap, set `PRICING_CALIBRATION` from actual/estimate.
2. **Budget granularity.** `maxBudgetUsd` stops the session but cannot stop the report
   from being lost mid-synthesis. A cheaper safeguard would be a "checkpoint report" turn
   before the expensive review phases; not implemented.
3. **Corpus adaptation.** The corpus README says `discovery/file-map.md` should be edited
   per repo. We cannot (pinned submodule), so the prompt layer tells the auditor the layout
   instead. Whether the corpus's discovery copes with arbitrary repo layouts is unproven
   until the first run; see `docs/upstream-wishlist.md`.
4. **Report parsing depends on the template being followed.** Counts come from
   `#### AUD-NN — title` blocks with a `| **Severity** |` row. The finalize turn asks the
   model to recount and fix mismatches, and the parser records warnings, but a report that
   drifts from the template will produce zero counts. Mitigation candidate: a structured
   output pass at the end (SDK `outputFormat`) that emits JSON counts, cross-checked
   against the markdown.
5. **Redaction is heuristic.** Finding blocks and table rows are exact; free-text
   mentions are redacted per paragraph by finding id. A sentence that describes a
   Critical finding without naming its id slips through. Acceptable for MVP, documented.
6. **Payments are watch-only.** No escrow (roadmap). The watcher needs a paid RPC that
   serves `getSignaturesForAddress` + `getParsedTransaction` at `finalized`; mismatched
   amounts are refunded manually with `scripts/refund.ts`.
7. **Single worker, single host.** The claim SQL is multi-worker safe, but reports live
   on local disk; the web tier must share that disk (or a future object store) with the
   worker. On Vercel the web tier cannot read `reports/` at all → object storage is the
   first production change.
8. **No auth for private reports beyond the link token.** Fine for MVP; a maintainer
   dashboard would need sessions (the OAuth flow deliberately has none).
9. **No rate limiting on `/` job creation.** A quoting job costs a shallow clone; abuse
   would fill `JOBS_DIR` and the DB. Add per-IP throttling and a max concurrent quotes
   setting before public exposure.
10. **Self-audit not run yet** (needs Docker + key). Expected findings from checklists
    08/09/10/12/13: the admin token compared in a server action, env handling, headers.
11. **Vercel deployment specifics** (not done): `outputFileTracingRoot` is set, but
    `serverExternalPackages` + a workspace Prisma client on Vercel needs a `postinstall`
    generate and the `reports/` store moved off disk.
12. **BYOK keys are not validated before launch.** The sandbox smoke test showed Claude
    Code retries a `401` for about three minutes before giving up, so a bad user key burns
    a container slot and a clone for nothing. Cheap fix: the web tier calls
    `GET /v1/models` with the supplied key at submission time and rejects invalid keys.
13. **Anchor program:** uses `init` + explicit `reattest` instead of `init_if_needed`
    (deliberate). No close instruction: attestations are permanent by design. Program
    upgrade authority stays with the deploy wallet; consider a multisig before public use.

## 5. Decisions worth knowing

- The corpus is loaded as a Claude Code plugin from the read-only submodule mount; its
  slash commands are invoked verbatim (`/auditor:intake --auto`, `/auditor:audit-cycle`).
- One SDK session with sequential user turns (streaming input) instead of separate
  `query()` calls, so intake context carries into the audit without session persistence.
- `Attestation` PDA seeds are `sha256(lowercased canonical repo url)` + raw commit bytes,
  so anyone can recompute the address from a GitHub URL and a sha without our database.
- Web pages are all `force-dynamic` server components; the only client components are
  the poll timer and the wallet button.
