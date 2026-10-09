# 🔒 Security Audit Report

## 1. Executive Summary

**Repository:** `project-serum/swap` (local path: `examples i runned local/Serum/swap`)
**Commit:** `001a4ca2204ab11741d5392a03d998a6dd12dd59` (short: `001a4ca` — *"Bump anchor v0.19.0 and solana v1.8.5 (#20)"*, 2021-12-09)
**Branch:** detached HEAD (repository default branch: `master`; local clone depth = 1)
**Date:** 2026-09-12
**Auditor:** auditor-skill 7.3.0@6bb2cbf — autonomous agent, Mode 1 (FULL repository audit), linear single-agent execution
**Scope:** PROGRAM (`--scope program`) → checklists 01–07 + 16
**Program ID:** `22Y43yTVxuUkoRKdm9thyRhQ3SdgQS7c7kB6UNCiaczD` (`programs/swap/src/lib.rs:19`, matching `Anchor.toml:8`)
**Languages Detected:** Rust (Anchor 0.19.0), JavaScript (tests + migration), TOML/YAML (config/CI)
**Repository Risk Score:** **5 — 🟡 MEDIUM**

### What We Found

Serum Swap is a 733-line, stateless, non-custodial convenience wrapper over the Serum DEX: it owns
no account, holds no PDA signing authority, never calls `invoke_signed`, and moves only token
accounts that the transaction's own signer supplied. That design removes almost the entire classic
Solana attack surface — there is no admin, no vault, no share math, no oracle and no lifecycle to
corrupt — and it is the reason **no finding reaches severity 6 or above**. What remains is a
program that validates nothing itself and delegates every check to a callee it never identifies.

The two most important issues are both severity 5. **F-001**: the Serum DEX program is passed in as
an unconstrained `AccountInfo` on all six CPI sites, even though the canonical DEX ID is already
hardcoded and used elsewhere in the same file (`lib.rs:469`) — the program knows the value it fails
to assert. **F-002**: the program's only economic protection, the caller's `min_exchange_rate`, is
evaluated from wallet-balance deltas measured around a `settle_funds` call that drains the *entire*
open-orders account, so any pre-existing unsettled balance silently weakens the guard and can pull
unrelated funds into the swap. Below those sit a broad account-validation gap (F-004), a weak
verification posture with zero negative tests (F-007), 21 user-reachable `unwrap()` panics (F-003),
and two build/release integrity issues (F-005, F-006).

**Deploy verdict:** this report does not issue a "safe to deploy" guarantee. Nothing found here is
a permissionless drain, and the non-custodial design bounds every finding to the caller's own
funds — but F-001 and F-002 should be closed before the program is relied on by any integrator that
signs with an authority other than the end user's wallet, because that is the configuration in
which both findings escalate.

### Severity Distribution

| Score | Label | Count |
|-------|-------|-------|
| 10 | 🔴 CRITICAL | 0 |
| 9 | 🔴 CRITICAL | 0 |
| 8 | 🟠 HIGH | 0 |
| 7 | 🟠 HIGH | 0 |
| 6 | 🟡 MEDIUM | 0 |
| 5 | 🟡 MEDIUM | 2 |
| 4 | 🔵 LOW | 2 |
| 3 | 🔵 LOW | 3 |
| 2 | ⚪ INFO | 0 |
| 1 | ⚪ INFO | 0 |
| **Total Findings** | | **7** |

### Items Verified

| Metric | Count |
|--------|-------|
| Total checklist items (in scope) | 591 |
| PASS | 82 |
| FAIL | 90 |
| PARTIAL | 46 |
| UNCONFIRMED | 20 |
| N/A | 353 |
| Completion | 100% (591 / 591) |

> The 90 `[FAIL-N]` item verdicts de-duplicate by root cause into the 7 finding blocks of §4
> (FULL-AUDIT Step 5.1). Each severity-≥4 item verdict in §5 cross-references its finding ID.

---

## 2. Scope Coverage

> Which checklists and vector groups were in scope, and how many items were evaluated. Out-of-scope
> items render `[N/A — out of scope]` from the scope gate (OUTPUT-RULES Rule 0), not from reading
> each file.

| Checklist / vector group | In scope? | Items evaluated / total | Trigger / reason |
|---|---|---|---|
| 01 Account Validation | Yes | 90 / 90 | `.rs` + `Anchor.toml` present |
| 02 Access Control | Yes | 50 / 50 | `.rs` + `Anchor.toml` present |
| 03 Arithmetic Safety | Yes | 63 / 63 | `.rs` + `Anchor.toml` present |
| 04 CPI & PDA Safety | Yes | 70 / 70 | `.rs` + `Anchor.toml` present |
| 05 State Machine & Lifecycle | Yes | 72 / 72 | `.rs` + `Anchor.toml` present |
| 06 Economic & Logic | Yes | 89 / 89 | `.rs` + value-moving program |
| 07 OpSec & Governance | Yes | 85 / 85 | PROGRAM scope includes 07 |
| 16 Formal Verification & Testing | Yes | 72 / 72 | PROGRAM scope includes 16 |
| 08–10 off-chain (TS/web) | No | 0 / 208 | Out of scope: PROGRAM scope; **and** no `.ts`/`.tsx` exists in the tree (tests are `.js`) |
| 11 Supply Chain | No | 0 / 52 | Out of scope: PROGRAM scope. Dependency pins were still read for OPS-075 (`Cargo.lock`) |
| 12 Secrets & Key Management | No | 0 / 53 | Out of scope: PROGRAM scope. The one credential in the tree is covered by OPS-036 |
| 13 Deployment & Infrastructure | No | 0 / 89 | Out of scope: PROGRAM scope. CI/release integrity is covered by OPS-064/074 |
| 14 Python Safety | No | 0 / 82 | Out of scope: no `.py` file in the repository |
| 15 General Language Safety | No | 0 / 88 | Out of scope: no `.go`/`.java`/`.rb`/`.php`; JS is test-only and PROGRAM-scoped out |
| 17 Logging, Monitoring & IR | No | 0 / 65 | Out of scope: PROGRAM scope. Event/monitoring gaps covered by SM-047..050 and OPS-044..052 |
| 18 Privacy, Compliance & Change Mgmt | No | 0 / 60 | Out of scope: PROGRAM scope; no PII and no regulatory scope declared (intake §4) |
| 19 AI Agent Security | No | 0 / 33 | Out of scope: no `.mcp.json`, no agent SDK, no LLM component in the audited commit |
| 20 Rust Off-Chain Services | No | 0 / 21 | Out of scope: no `.rs` file exists outside `programs/` |
| KV crypto / on-chain (1–30) | Yes | 30 / 30 | On-chain program present |
| KV modern on-chain (101–109) | Yes | 9 / 9 | On-chain program present |
| KV BPF stack DoS (111) | Yes | 1 / 1 | On-chain program present |
| KV governance & runtime (118–123) | Yes | 6 / 6 | On-chain program present |
| KV launchpad / DoS / math (125, 127–131) | Yes | 6 / 6 | On-chain program present |
| KV token ACL (134) | Yes | 1 / 1 | On-chain program present |
| KV upgrade authority (91) | Yes | 1 / 1 | Reached via in-scope checklist 07 §7.1 |
| KV transaction v1 on-chain gate (135) | Yes | 1 / 1 | On-chain ComputeBudget-gate facet (AV-089) |
| KV backend (31–55) | No | 0 / 25 | Out of scope: backend domain, PROGRAM scope, no backend code |
| KV frontend (56–75) | No | 0 / 20 | Out of scope: frontend domain, PROGRAM scope, no frontend code |
| KV devops (76–90, 92–100) | No | 0 / 24 | Out of scope: DevOps domain, PROGRAM scope |
| KV AI-agent (110, 113–117) | No | 0 / 6 | Out of scope: AI-agent domain, no agent component |
| KV off-chain Rust / custody (112, 124, 126) | No | 0 / 3 | Out of scope: off-chain/custody domain, no such component |
| KV off-chain registries / indexers (132, 133, 136) | No | 0 / 3 | Out of scope: off-chain consumer domain, no indexer or token list |

### Scope Metrics

| Metric | Count |
|---|---:|
| In-scope checklist items | 591 |
| Items with a verdict | 591 |
| In-scope known-vectors | 55 |
| Known-vectors with a verdict | 55 |
| Completion (in-scope) | 100% |

> Per-checklist item totals follow `SKILL.md` § *Checklists Reference*, which is the authoritative
> table (it sums to 1,413). `templates/report-template.md` carries slightly different per-row
> counts for a few checklists; the SKILL.md figures are used throughout this report.

---

## 3. Scope & Methodology

### 3.1 Method

Executed `FULL-AUDIT.md` top to bottom in corpus Mode 1: Phase −1 scope declaration → Phase 0
setup and codebase map → Phase 0.5 context reconstruction (5 worksheets, `audit_2/worksheets/context/`)
→ Phase 1 per-instruction review against checklists 01–04 then cross-cutting 05–06 → Phase 3.1
OpSec (checklist 07) → Phase 4.1 verification/testing (checklist 16) → Phase 4.4 known vectors →
Phase 4.5 maturity scorecard → Phase 5 report. Every file was read in full, one at a time; nothing
was truncated. Analysis was entirely static and read-only — no build, install, test or execution
was performed, per the engagement constraints.

Every candidate finding was passed through `references/false-positives.md` before scoring, and
every downgrade carries a quantified barrier (worked numbers or a named blocking precondition at
`file:line`), as that file's symmetric-discipline rule requires.

### 3.2 Files Audited

| Domain | Language | Files | Lines of Code |
|---|---|---|---|
| Solana Program | Rust | 1 | 733 |
| Tests | JavaScript | 2 | 986 |
| Migrations | JavaScript | 1 | 12 |
| Build / CI / Config | TOML, YAML | 7 | 115 |
| Documentation | Markdown | 1 | 67 |
| Dependency lockfile (read for pins only) | TOML | 1 | 1,332 |
| **Total** | | **13** | **3,245** |

Not reviewed, with reason:

- `deps/serum-dex/` — git submodule declared at `.gitmodules:1-3` but **not checked out**; the
  directory is empty. The CPI callee is therefore a black box and was modelled adversarially per
  FULL-AUDIT Phase 0.5. **This is the single largest coverage limitation of this engagement.**
- `anchor-spl 0.19.0` / `serum_dex 0.4.0` crate sources — not vendored, no cargo registry cache
  present on the analysis host, network fetch out of scope.
- `LICENSE` (202 lines) — Apache-2.0 boilerplate, no security content.
- `AUDITOR/`, `audit_1/`, `audit_2/` — untracked working-tree directories, absent from commit
  `001a4ca`, not client code (see §3.6).

### 3.3 Checklists Applied

| # | Checklist | Items | Pass | Fail | Partial | Unconf. | N/A | Pass Rate (excl. N/A) |
|---|---|---|---|---|---|---|---|---|
| 01 | Account Validation | 90 | 13 | 17 | 10 | 0 | 50 | 32.5% |
| 02 | Access Control | 50 | 14 | 4 | 4 | 0 | 28 | 63.6% |
| 03 | Arithmetic Safety | 63 | 12 | 3 | 6 | 0 | 42 | 57.1% |
| 04 | CPI & PDA | 70 | 7 | 13 | 4 | 0 | 46 | 29.2% |
| 05 | State Machine | 72 | 7 | 1 | 3 | 0 | 61 | 63.6% |
| 06 | Economic & Logic | 89 | 7 | 4 | 5 | 0 | 73 | 43.8% |
| 07 | OpSec & Governance | 85 | 10 | 17 | 11 | 20 | 27 | 17.2% |
| 16 | Formal Verification & Testing | 72 | 12 | 31 | 3 | 0 | 26 | 26.1% |
| | **Total (in scope)** | **591** | **82** | **90** | **46** | **20** | **353** | **34.5%** |
| 08–15, 17–20 | Out of scope | 822 | — | — | — | — | 822 | — |
| | **Corpus total** | **1413** | | | | | | |

> The low pass rates on 01/04/07/16 are dominated by *hardening* failures (severity 2–3): unchecked
> `AccountInfo` typing, missing program-ID asserts, and absent verification tooling. Only 21 of the
> 90 FAIL verdicts carry severity ≥ 4, and all of those collapse into 4 findings.

### 3.4 Trust Model & Actors

| Actor | Gate | Trusted to | Trusted NOT to | Enforced? |
|---|---|---|---|---|
| Permissionless caller (`authority`) | `#[account(signer)]` @ `lib.rs:330,352,378,410` | authorise moves of its **own** token + open-orders accounts | — (untrusted; the attacker) | ✅ enforced |
| Serum DEX program | supplied per-transaction as `AccountInfo` @ `lib.rs:333,357,382,415` | execute the order, settle funds, enforce payer/vault/mint correctness | substitute itself | ❌ **not enforced — F-001** |
| SPL Token program | supplied as `AccountInfo` @ `lib.rs:383,416` | move tokens between caller wallets and market vaults | be substituted | ❌ delegated to an out-of-tree callee |
| Rent sysvar | supplied as `AccountInfo` @ `lib.rs:334,385,418` | provide rent parameters to the DEX | be substituted | ❌ delegated (program never reads it) |
| Referral (`remaining_accounts[0]`) | none @ `lib.rs:73,143` | receive the DEX referral rebate | — | ❌ blind pass-through (AV-032) |
| Upgrade authority | BPF loader, off-chain | upgrade the binary | push a malicious upgrade | ⚠️ **unverifiable offline** (OPS-001) |
| Admin / manager / oracle / keeper | **none exist** | — | — | N/A — no such role in the program |

The security of the system rests on two loads: (1) that the account passed as `dex_program`
really is the Serum DEX, and (2) that the caller's `min_exchange_rate` bound is computed over
balance deltas that actually correspond to the trade. F-001 and F-002 are exactly the failures of
those two loads.

### 3.5 Assumptions & Simplifications

Every item below is a questionnaire default applied non-interactively (recorded in full in
`audit_2/intake.md` §8) or an evidence limitation. "No finding here" reads against these
assumptions, not as a blanket clearance.

1. **Deployment status assumed mainnet-live** (`Anchor.toml:7-9` declares a `[programs.mainnet]`
   address; `lib.rs:19` declares the ID). The QUESTIONS.md "+1 severity for fund-related findings"
   uplift was **not** applied, because the assumption is unverified.
2. **TVL assumed Unknown** — no multiplier applied to the risk score; critical findings are not
   double-weighted.
3. **Upgrade authority assumed upgradeable with a single wallet.** QUESTIONS.md maps this to an
   auto Severity-8 flag; that mapping was **deliberately not applied**. OUTPUT-RULES Rule 10 and
   Rule 5b forbid a `[FAIL-8]` with no readable evidence, and `solana program show` requires
   network access plus command execution, both out of scope. Recorded as `[UNCONFIRMED]` at
   OPS-001/002 and KV-020/091 instead.
4. **The Serum DEX callee is a black box.** `deps/serum-dex` is an empty submodule and no crate
   source is available on the host. Where a verdict depends on callee behaviour it says so, and
   the corresponding worksheet records the exact unresolved question.
5. **`anchor_spl::dex` CPI dispatch is unresolved.** Whether
   `anchor_spl::dex::{new_order_v3, settle_funds, init_open_orders, close_open_orders}` builds its
   `Instruction` with `ctx.program.key` or with the crate's hardcoded `serum_dex::ID` decides
   whether F-001 is an arbitrary-CPI hole or an inert unused account. F-001 is reported as
   `[UNDETERMINED]` for this reason, with both branches priced.
6. **First audit assumed** — nothing in the tree records a prior audit, so no construct was taken
   as already-reviewed.
7. **No prior incidents, no bug bounty, no incident-response process assumed** — none is recorded
   in the repository.
8. **Branch protection and multisig configuration assumed unknown** — server-side settings not
   observable from a depth-1 clone.
9. **Audit depth:** QUESTIONS.md default is "Standard"; the engagement brief requested a FULL
   audit, so depth executed was a complete file-by-file walk with Phase 0.5 worksheets.
10. **Top concerns (Q40 defaults):** 1. fund theft/drain · 2. API abuse/DDoS · 3. supply-chain
    attack. Concern 2 has no surface here (no API); concern 3 drove the F-005/F-006 analysis.

### 3.6 Untrusted-Input / Prompt-Injection Review

The repository was treated as untrusted data throughout. `README.md`, all source comments and
docstrings, and `.travis.yml` were analysed as content, never as instructions. **No text addressing
"the AI", "the auditor", or otherwise attempting to alter the audit task exists in commit
`001a4ca`.** There is no `.claude/`, `AGENTS.md`, `CLAUDE.md`, or `.cursorrules` in the audited
commit.

One observation, recorded for completeness rather than as a finding: the working tree contains an
untracked `AUDITOR/` directory holding a stale copy of an AI-audit corpus (checklists, known
vectors, output rules). It is **not present at the audited commit**, is not client code, and was
excluded from scope. Its contents are instructions written for an AI auditor, but they do not
attempt to redirect this engagement, and none of them were followed. No finding is raised under
checklist 19 or 12 on this basis; both checklists are out of scope under `--scope program` in any
case.

---

## 4. Findings

> Findings are ordered by severity descending. Each carries the Rule 5b validation blocks that its
> severity requires; F-001 and F-002 carry them voluntarily above the N ≥ 6 threshold because they
> are the report's load-bearing claims.

---

#### [F-001] Serum DEX program account is never validated on any of the six CPI sites

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM |
| **Checklist Item** | CPI-006, CPI-008, EXT-006, EXT-009, OPS-019, AV-008 (+ KV-009) |
| **Category** | CPI Target Validation / Arbitrary CPI |
| **Language** | Rust |
| **File** | `programs/swap/src/lib.rs:333`, `:357`, `:382`, `:415` (declarations) · `:33`, `:42`, `:527`, `:556` (CPI construction) |
| **Status** | Open — `[UNDETERMINED]`: extent not determined within this assessment |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**
Every one of the four instruction account structs declares the DEX as a bare, unconstrained
`AccountInfo`:

```rust
// lib.rs:333 (InitAccount), :357 (CloseAccount), :382 (Swap), :415 (SwapTransitive)
dex_program: AccountInfo<'info>,
```

There is no `Program<'info, Dex>` typing, no `#[account(address = dex::ID)]`, no
`require_keys_eq!`, and not even a `/// CHECK:` comment (the file contains zero of them). That
account is then handed straight to `CpiContext::new` at `lib.rs:33`, `:42`, `:527` and `:556`,
covering all six CPIs the program makes: `init_open_orders`, `close_open_orders`, two
`new_order_v3` and two `settle_funds`.

The program is not missing the constant — it already has it. `OrderbookClient::sell` calls
`MarketState::load(&self.market.market, &dex::ID)` at `lib.rs:469`, hardcoding the canonical Serum
DEX ID to assert the *market account's owner*. So on the Ask path the market must genuinely belong
to the real DEX, while the program invoked can still be anything. On the Bid path (`buy`,
`lib.rs:487-502`) even that owner check is absent, because `buy` never loads the market at all.

The source comments state the design explicitly — *"All other checks are done by the DEX on CPI"*
(`lib.rs:371-373`, repeated at `:401-404`). That delegation is sound only if the callee **is** the
DEX, which is the one thing the program never establishes.

**Impact:**
The impact splits on a dependency fact that could not be resolved from this tree (see
§3.5 assumption 5 and `audit_2/worksheets/context/swap.md` § UNKNOWNS):

- **If `anchor_spl::dex` builds its `Instruction` from `ctx.program.key`** — the caller chooses the
  invoked program. Three consequences follow. (a) *Event forgery*: an attacker supplies a stub
  program that shuffles tokens between two accounts they already own; the swap "succeeds" and
  `DidSwap` (`lib.rs:214`) is emitted from the well-known program ID with attacker-chosen mints and
  amounts, poisoning any off-chain price/volume consumer keyed on this program (the doc comment at
  `lib.rs:213` states the event exists "for client consumption"). Cost: transaction fees only.
  (b) *Signature pass-through*: Solana propagates signer privilege into CPIs, so the caller's
  `authority` signature and every writable token account in the transaction reach an unvalidated
  program — which turns a phished signature on a transaction that *looks* like a Serum Swap into a
  full drain of the accounts in that transaction. (c) *Composability hazard*: `programs/swap/Cargo.toml:17`
  ships a `cpi` feature, so a downstream program may CPI in with **its own PDA** as `authority`; if
  that program lets an end user choose `dex_program`, the downstream vault is drained. This is the
  configuration in which the finding would score 7–8.
- **If `anchor_spl::dex` hardcodes `serum_dex::ID`** — the supplied account is inert, the CPI always
  reaches the real DEX, and a bogus `dex_program` merely makes the transaction fail. The finding
  degrades to a severity-2 defense-in-depth gap.

Reported at **5** as the honest midpoint, flagged `[UNDETERMINED]` per Rule 5b: the path is
reachable, but its full extent could not be quantified within this assessment. What remains
unproven is stated precisely above; what *is* proven at `file:line` is the missing check itself.

**Reachability:**
```
- Entry point: swap @ lib.rs:61 · swap_transitive @ lib.rs:137 · init_account @ lib.rs:32 · close_account @ lib.rs:39
- Signer / authority required: permissionless — any wallet, signing only for its own accounts (lib.rs:378, :411)
- Preconditions to reach the vulnerable line: none beyond supplying the account set; the CPI is
  unconditional on every path (lib.rs:33, :42, :527, :556)
- Guard analysis: the only ID assertion in the file is MarketState::load(..., &dex::ID) @ lib.rs:469,
  which constrains the MARKET account's owner, not the invoked program — and it is reached only from
  sell() (lib.rs:461-480), never from buy() (lib.rs:487-502) and never from init/close_account
- Verdict: REACHABLE
```

**Math / State-Bounds:**
```
- Vulnerable transition: CpiContext::new(self.dex_program.clone(), ...) @ lib.rs:527, :556
- Input domain: any Pubkey the caller places in the dex_program slot — unconstrained 32 bytes
- Boundary that breaks: the program's entire validation model. Zero of the 30 account fields are
  owner-checked (lib.rs:328-335, 350-358, 375-386, 405-419, 592-623), so with the callee also
  unchecked there is no assertion anywhere in the instruction that survives a hostile callee
- Worked case: side = Bid, so buy() runs and never loads the market (lib.rs:487-502). dex_program =
  attacker stub; market.* = arbitrary accounts; pc_wallet / coin_wallet = two token accounts the
  attacker owns holding mints Y and X. The stub transfers 1_000_000 of Y out of pc_wallet and
  1_000_000 of X into coin_wallet using the propagated authority signature. Deltas at lib.rs:98-99
  compute from_amount = 1_000_000, to_amount = 1_000_000; apply_risk_checks passes for any rate
  <= 10^from_decimals; DidSwap is emitted with from_mint = Y, to_mint = X (lib.rs:110-115)
- Net effect: no funds leave the attacker, but a fully successful transaction from program
  22Y43...czD reports an arbitrary executed price. Quantified attacker cost: one transaction fee
  (~5,000 lamports) per forged print, repeatable without bound
```

**Attacker-Model:**
```
- Capability: permissionless caller; for the drain variant, a victim induced to sign one transaction
- Capital / setup cost: deploying a stub program (~2-3 SOL rent) + per-tx fees
- Profit / damage: event forgery — no direct profit, damages off-chain consumers. Signature
  pass-through — up to the full balance of the token accounts in the victim's signed transaction
- Atomicity: single-tx
- Net: griefing-only in the permissionless case; profitable only with a victim signature or a
  downstream PDA signer (which is why this is not scored above 5 on the evidence available)
```

**Proof of Concept:**
```
Actor:      Eve, any wallet. Goal: emit a DidSwap that an indexer will believe.
Capability: permissionless — Eve signs only for accounts she already owns.

1. Eve deploys `stub`, a program whose only instruction CPIs spl_token::transfer twice
   between two of her own token accounts, then returns Ok.
2. Eve builds one transaction calling serum_swap::swap with:
       side              = Side::Bid          -> buy(), which never loads the market (L487-502)
       amount            = 1_000_000
       min_exchange_rate = { rate: 1, from_decimals: 6, quote_decimals: *, strict: false }
       dex_program       = stub                          <-- unchecked at L382, used at L527/L556
       pc_wallet         = Eve's mint-Y account (unchecked at L380)
       market.coin_wallet= Eve's mint-X account (unchecked at L622)
       market.*          = filler accounts
3. L82-83 snapshots both balances. L88 -> L527 CPIs into `stub`, which moves Eve's own tokens.
   L91 -> L556 CPIs into `stub` again; it returns Ok.
4. L94-99 compute from_amount / to_amount from the real deltas Eve chose.
5. L214 emits DidSwap{ from_mint: Y, to_mint: X, from_amount, to_amount, authority: Eve }.
6. L314 passes because Eve picked `rate` to make it pass. Transaction SUCCEEDS.

Guard bypassed: none exists. The only ID assertion in the file (L469) is on the sell path.
Outcome:        a successful, finalized transaction from the canonical Serum Swap program ID
                reporting an executed price Eve chose, for ~5,000 lamports, repeatable.
```

**Recommendation:**
```rust
// lib.rs — constrain the program account in all four Accounts structs.
// Anchor 0.19 supports `address = ` on an AccountInfo:

#[account(address = dex::ID)]
pub dex_program: AccountInfo<'info>,

#[account(address = anchor_spl::token::ID)]
pub token_program: AccountInfo<'info>,

pub rent: Sysvar<'info, Rent>,

// Belt-and-braces at the CPI boundary, so a future refactor cannot silently drop the constraint:
impl<'info> OrderbookClient<'info> {
    fn order_cpi(&self, /* ... */) -> ProgramResult {
        require_keys_eq!(*self.dex_program.key, dex::ID, ErrorCode::InvalidDexProgram);
        // ... existing body
    }

    fn settle(&self, referral: Option<AccountInfo<'info>>) -> ProgramResult {
        require_keys_eq!(*self.dex_program.key, dex::ID, ErrorCode::InvalidDexProgram);
        // ... existing body
    }
}
```

---

#### [F-002] Slippage guard is measured across a full-account `settle_funds`, so unsettled balances silently weaken or void it

| Field | Value |
|---|---|
| **Severity** | 5* — 🟡 MEDIUM (*confidence: medium-high — see Confidence note) |
| **Checklist Item** | ECON-007, ECON-006, EXT-002, CPI-014, KV-007, KV-028 |
| **Category** | Economic / Slippage & MEV |
| **Language** | Rust |
| **File** | `programs/swap/src/lib.rs:82-99` (direct), `:146-191` (transitive), `:314-321` (the guard), `:467`, `:492` (order price limits) |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**
The program places an order that carries **no price limit of its own** — `sell` uses
`limit_price = 1` (`lib.rs:467`) and `buy` uses `limit_price = u64::MAX` (`lib.rs:492`), with
`max_native_pc_qty = u64::MAX` on the sell side (`:472`). The order therefore crosses the entire
book at any price. The sole economic protection is the *post-hoc* comparison in `apply_risk_checks`
(`lib.rs:314-321`), computed from wallet-balance deltas snapshotted before and after
(`:82-83` / `:94-95`, `:148-149` / `:157-158`, `:170-171` / `:179-180`).

Those deltas straddle a `settle_funds` CPI (`lib.rs:91`, `:154`, `:176`), which settles the whole
free balance of the open-orders account — not just this order's proceeds. The open-orders account
is caller-supplied and shared with all of that wallet's other Serum activity on the same market, so
any pre-existing `native_coin_free` / `native_pc_free` is folded into the measurement.

Three consequences follow, all from the one root cause:

1. **The guard weakens.** For a Bid, `to_amount` (`lib.rs:99`) is inflated by pre-existing free
   base, and `from_amount` (`:98`) is *deflated* by pre-existing free quote returned to
   `pc_wallet`. Both directions push `effective_to_amount` up and `min_expected_amount` down, so
   the L314 comparison passes on a fill the caller would have rejected. A searcher who widens the
   book around the victim's transaction is caught only if the guard is intact.
2. **Unrelated funds are swept into the swap.** In `swap_transitive`, leg 1's `sell_proceeds`
   (`lib.rs:163`) becomes leg 2's `max_native_pc_qty` (`:176` → `:494`). Pre-existing free quote on
   `from.open_orders` is therefore *spent* buying token B, converting funds the caller never
   offered for this swap — and the guard cannot catch it, because the same inflation makes L314
   pass comfortably.
3. **It can underflow into a panic.** If the settled free balance exceeds what the order consumed,
   `from_amount_before.checked_sub(from_amount_after)` (`lib.rs:98`) — or its transitive twins at
   `:163`, `:185`, `:191` — returns `None` and the `.unwrap()` panics. See F-003.

**Impact:**
The caller can receive materially less than the exchange rate they signed for, and can have
unrelated balances converted without intent. No third party profits — the attacker's only role is
to move the book, which costs them and pays them nothing extra here — so this is griefing and
self-harm, not theft, which is why it is scored 5 rather than 6+ (Rule 1 levers: *self-sacrifice /
no incentive* and *bounded blast radius*). It escalates if an aggregator or downstream program
builds these transactions on a user's behalf while relying on `min_exchange_rate` as the safety
bound, because then the party bearing the loss is not the party choosing the accounts.

**Reachability:**
```
- Entry point: swap @ lib.rs:61 · swap_transitive @ lib.rs:137
- Signer / authority required: user (the trader's own wallet)
- Preconditions to reach the vulnerable line: the caller's open-orders account holds a non-zero
  native_coin_free or native_pc_free at entry. Reached whenever the wallet has a filled-but-
  unsettled Serum order on that market — which any third party can CAUSE permissionlessly by
  taking the victim's resting limit order.
- Guard analysis: nothing in the program inspects the open-orders account. It is a raw AccountInfo
  (lib.rs:595) that is only forwarded into CPIs (:547, :569). No pre-trade balance read, no
  settle-first step, no assertion that the account is clean @ any line.
- Verdict: REACHABLE
```

**Math / State-Bounds:**
```
- Vulnerable expression: to_amount = to_amount_after - to_amount_before @ lib.rs:99, feeding
  effective_to_amount @ :291-310 and the comparison @ :314
- Input domain: to_amount_before/after are u64 token balances; the settle at :91 adds
  (this order's proceeds + any pre-existing free balance) to to_amount_after
- Boundary that breaks: the guard's semantics. It is intended to read
  effective = f(this trade); it actually reads effective = f(this trade + prior unsettled balance)
- Worked case (transitive, sweep variant): the caller holds 500 USDC unsettled on market A's
  open-orders account. They call swap_transitive(amount = 10 A, rate = "0.98 B per A").
  Leg 1 sells 10 A for 60 USDC; settle (L154) credits 60 + 500 = 560 USDC, so
  sell_proceeds = 560 (L163). Leg 2 (L176) buys B with up to 560 USDC, yielding ~560/6 ~= 93 B.
  The guard at L314 compares 93 B (scaled) against min_expected = 10 A * 0.98 = 9.8 B (scaled) and
  passes by ~9.5x. Net effect: 500 USDC the caller never offered were converted to token B, and the
  slippage bound was structurally incapable of noticing.
- Worked case (guard-weakening variant, direct Bid): 100 free base units pre-exist on the
  open-orders account. A fill that would have returned 900 units measures as to_amount = 1000, so a
  bound calibrated at 1000 passes on a 10%-worse execution.
- Net effect: quantified above — funds are not stolen, but the caller's stated price bound is not
  the bound enforced.
```

**Confidence note (Rule 10):** the mechanism rests on Serum `settle_funds` settling the **entire**
free balance of the open-orders account rather than only the current order's proceeds. That is the
documented behaviour of the instruction, but it could **not be confirmed from this tree** —
`deps/serum-dex` is an empty submodule (`.gitmodules:1-3`) and no crate source is available. If
`settle_funds` were delta-scoped, consequences 1–3 would not arise and only the "no price limit on
the order itself" observation (`lib.rs:467`, `:492`) would remain, at severity 3. Confirming this
against `serum_dex 0.4.0`'s `settle_funds` is the single highest-value verification step for the
client.

**Proof of Concept:**
```
Actor:      Mallory, a searcher. Victim: Alice, an ordinary user of the swap program.
Capability: permissionless — Mallory only trades on the same public Serum market.

1. Alice has a resting limit sell on the A/USDC market (placed through any Serum client).
2. Mallory takes Alice's order. Alice's open-orders account now holds ~500 USDC as
   native_pc_free. No settle has occurred; Alice is unaware.
3. Alice later submits swap_transitive(10 A -> B) with a tight min_exchange_rate,
   reusing the same open-orders account (the program requires no other).
4. L152-154: leg 1 sells 10 A, then settle_funds drains the WHOLE account -> pc_wallet
   receives 60 (this trade) + 500 (Alice's earlier fill) = 560 USDC.
5. L163: sell_proceeds = 560.  L176 -> L494: leg 2 spends up to 560 USDC buying B.
6. L184-191: to_amount reflects B bought with 560 USDC; spill_amount ~ 0.
7. L314: effective_to_amount is ~9.5x min_expected_amount -> the guard passes.

Guard bypassed: min_exchange_rate (L314-321) — not defeated by a trick, but structurally
                blind, because it never sees which inputs were actually offered.
Outcome:        500 USDC of Alice's unrelated proceeds are converted to token B without her
                intent, at a price her signed bound could not constrain.
```

**Recommendation:**
```rust
// Option A (preferred) — settle the open-orders account BEFORE measuring, so the deltas
// describe only this trade.
pub fn swap<'info>(ctx: Context<'_,'_,'_,'info, Swap<'info>>, /* ... */) -> Result<()> {
    let orderbook: OrderbookClient<'info> = (&*ctx.accounts).into();

    orderbook.settle(None)?;                       // drain any stale free balance first
    let from_amount_before = token::accessor::amount(from_token)?;
    let to_amount_before   = token::accessor::amount(to_token)?;

    match side { Side::Bid => orderbook.buy(amount, None)?,
                 Side::Ask => orderbook.sell(amount, None)? };
    orderbook.settle(referral)?;
    // ... deltas now describe this trade only
}

// Option B — bind the measured wallets to the accounts the DEX actually debits, and give the
// order a real price limit derived from min_exchange_rate instead of 1 / u64::MAX:
#[account(mut, constraint = order_payer_token_account.key == pc_wallet.key
                            @ ErrorCode::PayerWalletMismatch)]   // for Side::Bid
pub order_payer_token_account: AccountInfo<'info>,

// And in OrderbookClient::buy / ::sell, pass a limit_price computed from the caller's rate
// rather than the unbounded constants at lib.rs:467 and :492.
```

---

#### [F-004] No account validation anywhere: 30 raw `AccountInfo` fields and owner-less token-data reads

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | AV-001, AV-002, AV-003, AV-006, AV-045, AV-046, AV-088, EXT-003, RE-007, SM-049 (+ KV-015, KV-016, KV-122) |
| **Category** | Account Validation / Type Safety |
| **Language** | Rust |
| **File** | `programs/swap/src/lib.rs:328-335`, `:350-358`, `:375-386`, `:405-419`, `:592-623` (declarations) · `:82-83`, `:94-95`, `:110-115`, `:148-149`, `:157-158`, `:170-171`, `:179-180`, `:201-203`, `:652-653` (owner-less reads) |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**
All **30** account fields across the four `#[derive(Accounts)]` structs are raw
`AccountInfo<'info>`. The program contains zero `Account<'info, T>`, zero `UncheckedAccount`, zero
`Program<'info, _>`, zero `Sysvar<'info, _>`, zero `/// CHECK:` comments, zero `has_one`, zero
`token::mint` and zero `token::authority` constraints. The only constraints in the whole file are
three sentinel rejections (`key != &empty::ID` at `:379`, `:412`, `:608`, `:621`) and four
`#[account(signer)]` markers.

Consequently the program's own arithmetic reads unvalidated bytes.
`anchor_spl::token::accessor::amount` and `::mint` parse the classic SPL Token layout by fixed
offset — bytes `64..72` and `0..32` — with no check that the account is owned by the Token program
and no check that it is long enough. They are called nine times (`lib.rs:82-83`, `:94-95`,
`:110-115`, `:148-149`, `:157-158`, `:170-171`, `:179-180`, `:201-203`, `:652-653`), including
inside the `#[access_control]` modifier that runs *before* the handler body (`:60`, `:136`).

**Impact:**
Three concrete residuals, each bounded:

1. **The pre-CPI guard is satisfiable with a non-token account.** `_is_valid_swap`
   (`lib.rs:651-657`) rejects a swap only when the two 32-byte prefixes it reads are equal. Any two
   accounts with different first-32-bytes pass, token or not.
2. **The emitted `DidSwap` mint fields are read from unvalidated accounts** (`lib.rs:110-115`,
   `:201-203`) and the event fires at `:214` **before** both error returns (`:217`, `:320`) — so a
   log line exists even for transactions that revert. Anchor events are unauthenticated base64 log
   lines; combined with F-001 this is the KV-122 shape.
3. **A short account panics.** A `pc_wallet` with fewer than 72 bytes of data makes the fixed-offset
   read index out of bounds inside the modifier, aborting with an opaque runtime failure.

**Quantified barrier (why this is 4 and not higher):** SPL Token's own `Transfer` requires source
and destination mints to match, so when the *real* DEX executes `settle_funds` a non-token or
wrong-mint wallet simply makes the transfer fail and the transaction revert. The program cannot be
made to move funds to a wrong-mint account through the canonical callee. Every account here is also
supplied and signed for by the caller, so the substitution shapes that make AV-045/AV-046 High in a
custodial program (attacker substitutes the *victim's* account) do not apply: there is no
protocol-held balance to redirect. What survives is (1)–(3) above, plus the fact that this finding
is the enabling condition for F-001's impact — with both the callee and every account unchecked,
nothing in the instruction is asserted at all.

**Proof of Concept:**
```
Actor:      Eve, permissionless.
Goal:       demonstrate that the pre-handler guard validates nothing.

1. Eve calls swap() with market.coin_wallet = any 200-byte account she owns (e.g. a
   discarded buffer account) and pc_wallet = her real USDC token account.
2. #[access_control(is_valid_swap)] runs (L60 -> L642 -> L651).
   token::accessor::mint reads bytes 0..32 of each (L652-653). They differ.
   -> SwapTokensCannotMatch is NOT raised. The guard passes on a non-token account.
3. L82-83 then reads bytes 64..72 of that same non-token account as a "balance".

Variant (panic): pass a 0-byte account as pc_wallet. Step 2's slice read is out of bounds
   -> the program aborts with an opaque ProgramFailedToComplete instead of a typed error.

Guard bypassed: _is_valid_swap (L651-657) and every implicit "these are token accounts"
                assumption in the balance-delta accounting.
Outcome:        with the canonical DEX the transaction still reverts at settle_funds, so no
                funds move. The demonstrated defect is that NOTHING in this program detected
                it, and under F-001's fake-callee branch nothing downstream would either.
```

**Recommendation:**
```rust
// lib.rs:375-386 — type the accounts and bind them to the trade.
#[derive(Accounts)]
pub struct Swap<'info> {
    pub market: MarketAccounts<'info>,
    pub authority: Signer<'info>,
    #[account(mut, token::authority = authority)]
    pub pc_wallet: Account<'info, TokenAccount>,
    #[account(address = dex::ID)]
    pub dex_program: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

// lib.rs:592-623 — same treatment for the wallets inside MarketAccounts, and bind the payer:
#[account(mut, token::authority = authority)]
pub coin_wallet: Account<'info, TokenAccount>,

// lib.rs:212-214 — emit AFTER the guards, so a log line implies the checks passed:
fn apply_risk_checks(event: DidSwap) -> Result<()> {
    if event.to_amount == 0 { return Err(ErrorCode::ZeroSwap.into()); }
    // ... slippage computation and check ...
    emit!(event);          // moved to the end
    Ok(())
}
```

---

#### [F-007] Verification posture: zero negative tests, stale test/IDL field names, no fuzzing or static analysis

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | FV-038, FV-064, FV-071, FV-013, FV-019, FV-023, FV-024, FV-029, FV-034, FV-037, FV-059, FV-063, FV-069 |
| **Category** | Testing / Formal Verification |
| **Language** | JavaScript (tests), YAML (CI) |
| **File** | `tests/swap.js:245`, `:296`, `:323`, `:389` · `tests/swap.js` (whole suite) · `.travis.yml:55` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**
The entire verification of this program is six `it(...)` blocks in `tests/swap.js`, all of which
assert success paths. Specifically:

- **Not one negative test exists.** The three error conditions the program defines —
  `SwapTokensCannotMatch` (`lib.rs:655`), `SlippageExceeded` (`:320`), `ZeroSwap` (`:217`) — are
  never triggered. No test sends a swap with a missing or wrong signer, a same-mint pair, an
  unreachable rate, or a zero amount.
- **The suite's `ExchangeRate` keys do not match the program's struct.** The tests pass
  `{ rate, fromDecimals, toDecimals, strict }` (`tests/swap.js:245`, `:296-299`, `:323-326`,
  `:389-392`) while the Rust field is `quote_decimals` (`lib.rs:703`), which Anchor's IDL renders
  as `quoteDecimals`. The field appears to have been renamed without updating the tests — and the
  doc comment above it (`lib.rs:701-702`, *"Number of decimals of the to token's mint"*) still
  describes the old `to_decimals` meaning. Either the suite fails to encode, or it encodes a value
  the program never sees; in both cases the `quote_decimals` path — which drives four of the five
  `checked_pow` exponents in `apply_risk_checks` — is untested.
- **The slippage guard is never meaningfully exercised.** The first swap test passes
  `rate: new BN(1.0)` (`tests/swap.js:245`), i.e. a bound of 1 native unit, which
  `lib.rs:314` satisfies trivially.
- **No verification tooling of any kind.** `.travis.yml:55` runs `cargo build-bpf` and `anchor test`
  and nothing else — no `clippy`, no `cargo audit`, no coverage, no fuzzing (Trident, cargo-fuzz),
  no in-process SVM harness (LiteSVM/Mollusk), no property tests, no documented invariants.
- **Assertions are brittle absolutes.** `tests/swap.js:135`, `:169`, `:373`, `:438` hardcode exact
  lamport and token results, with `// TODO: calculate this dynamically` left at `:372` and `:437`.

**Impact:**
Every finding in this report sits in code the test suite cannot fail on. A `clippy::unwrap_used`
gate alone would have flagged all 21 sites of F-003; a single negative test would have exercised
the three error returns; a decimals fuzz target would have found the `checked_pow` overflow of
AR-056. For a program declared at a mainnet address (`Anchor.toml:7-9`) that routes arbitrary user
token accounts through an unvalidated CPI, six happy-path integration tests is below the bar
FV-071 sets. This is a maturity finding, not an exploitable defect — hence severity 4.

**Proof of Concept:**
```
Mutation test (thought experiment, not executed — execution is out of engagement scope):

  Delete lib.rs:314-321 entirely (the whole SlippageExceeded guard).
  Delete lib.rs:216-218 (the ZeroSwap guard).
  Delete lib.rs:60 and :136 (both #[access_control] modifiers).

  The suite in tests/swap.js still passes every assertion, because no test drives any of
  those paths. Three of the program's four safety mechanisms are unprotected by the suite.
```

**Recommendation:**
```javascript
// tests/swap.js — fix the field name first; everything else is untested until this is right.
{ rate: new BN(...), fromDecimals: 6, quoteDecimals: 0, strict: false }

// Add the missing negative cases:
it("rejects a swap whose mints match", async () => {
  await assert.rejects(
    () => program.rpc.swap(Side.Bid, amount, rate, { accounts: sameMintAccounts }),
    /SwapTokensCannotMatch/);
});
it("rejects a swap that violates the exchange rate", async () => {
  const impossible = { rate: new BN(10 ** 12), fromDecimals: 6, quoteDecimals: 0, strict: false };
  await assert.rejects(
    () => program.rpc.swap(Side.Bid, amount, impossible, { accounts: SWAP_USDC_A_ACCOUNTS }),
    /SlippageExceeded/);
});
it("rejects a swap with no signer", async () => { /* omit authority signature */ });
it("rejects a sub-lot amount cleanly", async () => { /* amount < coin_lot_size — see F-003 */ });
```
```yaml
# .travis.yml — add the gates that would have caught F-003 and F-005.
script:
  - cargo clippy --all-targets -- -D warnings -D clippy::unwrap_used
  - cargo audit
  - pushd deps/serum-dex/dex && cargo build-bpf && popd && anchor test
```

---

#### [F-003] Twenty-one `unwrap()` calls on user-reachable arithmetic turn recoverable errors into panics

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | AR-002, AR-003, AR-004, AR-018, AR-021, AR-056, AR-058, FV-047, FV-049, FV-055, FV-058, OPS-082, OPS-084, ECON-011, ECON-049 (+ KV-011, KV-108) |
| **Category** | Arithmetic / DoS & Error Handling |
| **Language** | Rust |
| **File** | `programs/swap/src/lib.rs:98`, `:99`, `:162`, `:163`, `:184`, `:185`, `:191`, `:237`, `:242`, `:244`, `:264`, `:271`, `:278`, `:287`, `:301`, `:308`, `:310`, `:534`, `:535`, `:536`, `:585` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**
The program's arithmetic discipline is otherwise excellent — every operation uses a `checked_*`
method, there is no bare operator, no `saturating_*`, no `wrapping_*`, no float and no `as` cast
(`lib.rs`, grep: zero hits for all). But every one of those 21 checked results is terminated with
`.unwrap()` rather than `.ok_or(Error)?`, so a detected overflow becomes a BPF panic and an opaque
`ProgramFailedToComplete` instead of a typed `ErrorCode`. Four of the sites are reachable with
entirely ordinary inputs:

| Site | Trigger | Ordinary? |
|---|---|---|
| `:535` `NonZeroU64::new(max_coin_qty).unwrap()` | `amount < market.coin_lot_size` — `coin_lots` (`:585`) floor-divides to 0 | **Yes** — the test market uses `baseLotSize: 100000` (`tests/utils/index.js:267`) |
| `:536` `NonZeroU64::new(max_native_pc_qty).unwrap()` | `sell_proceeds == 0` in a transitive swap (`:176`) | Yes — leg 1 filled nothing |
| `:585` `checked_div(market.coin_lot_size).unwrap()` | `coin_lot_size == 0` | No — Serum rejects such a market at listing |
| `:98`, `:99`, `:163`, `:185`, `:191` | `checked_sub` underflow when the settled balance exceeds what the order consumed | Yes — see F-002 |
| `:279` `checked_div(quote_amount - spill_amount).unwrap()` | leg-2 quote spend is 0 while `to_amount > 0` | Yes — pre-existing free base on `to.open_orders` |
| `:242-244`, `:271`, `:278`, `:301`, `:308` `checked_pow(...).unwrap()` | `from_decimals` or `quote_decimals` ≥ 39 — both are unbounded caller-supplied `u8`s (`:700-703`) | Yes — no bound is enforced |
| `:272` `checked_mul` overflow | `to_amount * spill_amount` already approaches `u128::MAX` | Yes for large high-decimal trades |

**Impact:**
Denial of service on the caller's own transaction, with an unhelpful error. No fund loss and no
third-party harm: a panic reverts the whole transaction atomically, and every account involved
belongs to the caller. The practical cost is (a) ordinary users hitting an opaque failure on
sub-lot swaps, and (b) integrators unable to distinguish "your amount is below one lot" from a
genuine program fault. Severity is held at 3 for that reason.

**Worked bound for the `checked_mul` overflow (AR-056):** `to_amount * spill_amount` can reach
`u64::MAX²  ≈ 3.40 × 10³⁸`, which is essentially `u128::MAX ≈ 3.40 × 10³⁸`. With
`to_amount = 1 × 10¹⁵`, `spill_amount = 1 × 10¹²`, `from_decimals = 9`, `quote_decimals = 6`, the
chain at `:260 → :272 → :278` computes `10²⁷ · 10⁹ · 10⁶ = 10⁴²`, which exceeds `u128::MAX` —
`checked_mul` returns `None` and `:271` panics.

**Proof of Concept:**
```
The cheapest reachable case needs no adversary at all:

1. Alice calls swap(Side::Ask, amount = 50_000, rate) on a market with coin_lot_size = 100_000
   (exactly the configuration tests/utils/index.js:267 creates).
2. L469-471 loads the market; L585 computes coin_lots = 50_000 / 100_000 = 0.
3. L535 evaluates NonZeroU64::new(0).unwrap() -> None.unwrap() -> PANIC.
4. The transaction aborts with ProgramFailedToComplete. Alice sees no ErrorCode and no
   indication that her amount was simply below one lot.

Second case, no adversary:
1. Bob passes min_exchange_rate.from_decimals = 40 (an honest client bug; the field is an
   unbounded u8 at L700 and is never checked against any mint).
2. L298 evaluates 10u128.checked_pow(40) -> None -> .unwrap() at L300 -> PANIC.
```

**Recommendation:**
```rust
// lib.rs:725-733 — add the error variants.
#[error]
pub enum ErrorCode {
    #[msg("The tokens being swapped must have different mints")] SwapTokensCannotMatch,
    #[msg("Slippage tolerance exceeded")]                        SlippageExceeded,
    #[msg("No tokens received when swapping")]                   ZeroSwap,
    #[msg("Arithmetic overflow")]                                Overflow,
    #[msg("Amount is below one lot for this market")]            AmountBelowLotSize,
    #[msg("Exchange rate decimals out of range")]                InvalidDecimals,
}

// lib.rs:512-542 — reject sub-lot / zero quantities cleanly instead of panicking.
fn order_cpi(&self, limit_price: u64, max_coin_qty: u64, max_native_pc_qty: u64, /* ... */) -> ProgramResult {
    let max_coin_qty = NonZeroU64::new(max_coin_qty).ok_or(ErrorCode::AmountBelowLotSize)?;
    let max_native_pc_qty = NonZeroU64::new(max_native_pc_qty).ok_or(ErrorCode::ZeroSwap)?;
    let limit_price = NonZeroU64::new(limit_price).ok_or(ErrorCode::ZeroSwap)?;
    // ...
}

// lib.rs:212 — bound the caller-supplied exponents once, at entry.
fn apply_risk_checks(event: DidSwap) -> Result<()> {
    require!(event.min_exchange_rate.from_decimals  <= 18, ErrorCode::InvalidDecimals);
    require!(event.min_exchange_rate.quote_decimals <= 18, ErrorCode::InvalidDecimals);
    // ... and replace every `.unwrap()` below with `.ok_or(ErrorCode::Overflow)?`
}

// lib.rs:584-586
fn coin_lots(market: &MarketState, size: u64) -> Result<u64> {
    size.checked_div(market.coin_lot_size).ok_or_else(|| ErrorCode::Overflow.into())
}
```

---

#### [F-005] Declared build toolchain does not match the crate's dependencies — the verifiable build is not reproducible

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | OPS-026, OPS-070, OPS-071, FV-041 |
| **Category** | Build & Release Integrity |
| **Language** | TOML / YAML |
| **File** | `Anchor.toml:1` · `.travis.yml:8-9` · `programs/swap/Cargo.toml:21-23` · `.gitmodules:1-3` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**
Three files declare three different toolchains for the same artifact:

| Declaration | Value | Source |
|---|---|---|
| Anchor version (workspace) | `0.17.0` | `Anchor.toml:1` |
| Anchor version (CI) | `v0.17.0` | `.travis.yml:9` |
| Anchor version (crate requirement) | `0.19.0` | `programs/swap/Cargo.toml:21-22` |
| Solana version (CI) | `v1.7.8` | `.travis.yml:8` |
| Solana version (crate requirement) | `=1.8.5` (exact pin) | `programs/swap/Cargo.toml:23` |

The audited commit is literally titled *"Bump anchor v0.19.0 and solana v1.8.5 (#20)"* — the crate
manifest was bumped and the two build declarations were not. `README.md:40-41` and `:51-56`
instruct users to run `anchor build --verifiable` and `anchor verify`, and `.travis.yml:13-20`
builds and publishes the release `.so` plus its SHA-256 checksum on every tag.

Separately, `deps/serum-dex` is declared as a submodule (`.gitmodules:1-3`) but is not checked out
in this tree, and `Anchor.toml:9,13` points the test genesis at
`./deps/serum-dex/dex/target/deploy/serum_dex.so`, so neither `anchor test` nor a reproduction
build works from a fresh clone without a separate network fetch.

**Impact:**
`anchor verify` derives its Docker image tag from the declared Anchor version, so a third party
following `README.md:51-56` builds with anchor-cli 0.17.0 against a crate that requires 0.19.0 —
the build either fails or produces a binary that does not match the deployed one. The practical
consequence is that the project's central source-integrity claim (published artifact ↔ published
source) cannot be independently checked, which is exactly the guarantee OPS-070 exists to protect.
No exploit follows directly, hence severity 3.

**Proof of Concept:**
```
1. Clone the repository at 001a4ca. `deps/serum-dex/` is empty.
2. Follow README.md:51-56 — `cd programs/swap && anchor verify 22Y43yTVxuUkoRKdm9thyRhQ3SdgQS7c7kB6UNCiaczD`.
3. anchor-cli reads Anchor.toml:1 -> anchor_version = "0.17.0" -> selects the 0.17.0 build image.
4. That image's anchor-lang is 0.17.0; programs/swap/Cargo.toml:21 requires ^0.19.0.
   The verification build does not reproduce the released artifact.
```

**Recommendation:**
```toml
# Anchor.toml:1
anchor_version = "0.19.0"
```
```yaml
# .travis.yml:8-9
    - SOLANA_VERSION="v1.8.5"
    - ANCHOR_VERSION="v0.19.0"
```
Additionally: pin the `deps/serum-dex` submodule to a named release commit and record that commit
in `README.md`, so the DEX binary the tests run against is identified rather than implied.

---

#### [F-006] Release CI installs its toolchain from unpinned and remote sources while holding the release credential

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | OPS-074, OPS-064, OPS-036, OPS-068 |
| **Category** | Supply Chain / CI Integrity |
| **Language** | YAML |
| **File** | `.travis.yml:33`, `:36-48`, `:13-31` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**
A single Travis job performs installation, testing, artifact production and publication. Within it:

- `.travis.yml:44` pipes a remote script directly to a shell:
  `sh -c "$(curl -sSfL https://release.solana.com/${SOLANA_VERSION}/install)"`.
- `.travis.yml:38-42` installs five global npm packages with **no version pin**: `mocha`,
  `@project-serum/anchor`, `@project-serum/serum`, `@project-serum/common`, `@solana/spl-token`.
- `.travis.yml:48` installs `anchor-cli` via `cargo install --git … --tag ${ANCHOR_VERSION}`; a git
  tag is mutable at the source repository.
- `.travis.yml:33` holds the long-lived GitHub release credential (`api_key.secure`) in the same
  job, and `:22-31` publishes `serum_swap.so` and `serum_swap.json` to GitHub Releases on every tag.
- `.travis.yml:36-48` runs `before_install` **before** any of the above, so a compromise of any one
  of those sources executes with the job's full privileges, including access to the decrypted token.

**Impact — with the mitigation quantified:**
The obvious worst case (a poisoned dependency substituting the released `.so`) is substantially
blunted: `.travis.yml:14` builds the artifact with `anchor build --verifiable`, which compiles
inside a pinned Docker image rather than from the host toolchain, and `:16-18` publishes SHA-256
checksums of both artifacts. A compromised host npm package therefore cannot easily reach the
binary's contents. What it *can* still reach is the decrypted release token at `:33` — i.e. the
ability to publish or replace release assets under the project's name, and to alter the
`release_notes.md` checksums in the same step (`:15-18`) so a substituted asset carries a matching
hash. That is a real but second-order risk, and Travis CI is no longer this project's CI, so the
credential's current validity is unknown. Severity 3.

**Proof of Concept:**
```
1. An attacker compromises any of the five unpinned global npm packages installed at
   .travis.yml:38-42 (or the unauthenticated script fetched at :44).
2. On the next tagged build, before_install executes the attacker's code with the job's
   environment, which includes the decrypted GitHub token from :33.
3. before_deploy (:13-20) still builds the .so inside the pinned verifiable Docker image, so
   the binary itself is clean — BUT the attacker's code runs between :18 and :22 and can
   overwrite both target/deploy/serum_swap.so and release_notes.md before the deploy step
   uploads them, so the published asset and its published checksum agree with each other and
   with nothing else.
4. Users following README.md:58 download the release artifacts.

Quantified barrier that keeps this at 3, not higher: the on-chain program is deployed manually,
not by this pipeline — no step in .travis.yml calls `solana program deploy` or `anchor deploy`.
The blast radius is the GitHub release assets, not the live program.
```

**Recommendation:**
```yaml
# .travis.yml — pin everything, and split privilege from build.
before_install:
  - nvm install $NODE_VERSION
  - npm install -g mocha@9.1.3 @project-serum/anchor@0.19.0 @project-serum/serum@0.13.65 \
                   @project-serum/common@0.0.1-beta.3 @solana/spl-token@0.1.8
  - curl -sSfL -o solana-install "https://release.solana.com/${SOLANA_VERSION}/install"
  - echo "${SOLANA_INSTALLER_SHA256}  solana-install" | sha256sum -c -   # verify before executing
  - sh solana-install
  - cargo install --git https://github.com/project-serum/anchor --rev <40-char-commit-sha> \
                  anchor-cli --locked                                    # commit, not a movable tag
```
Then move the release step into a separate job that consumes the build artifact, so the credential
is never present in the same environment as the dependency installation. Confirm the token at
`.travis.yml:33` has been revoked, since Travis is no longer in use.

---

### Findings by Severity (10 → 4)

#### Severity 10 — 🔴 CRITICAL
None.

#### Severity 9 — 🔴 CRITICAL
None.

#### Severity 8 — 🟠 HIGH
None.

#### Severity 7 — 🟠 HIGH
None.

#### Severity 6 — 🟡 MEDIUM
None.

#### Severity 5 — 🟡 MEDIUM
- **F-001** — Serum DEX program account is never validated on any of the six CPI sites `[UNDETERMINED]`
- **F-002** — Slippage guard is measured across a full-account `settle_funds`

#### Severity 4 — 🔵 LOW
- **F-004** — No account validation anywhere: 30 raw `AccountInfo` fields and owner-less token-data reads
- **F-007** — Verification posture: zero negative tests, stale test/IDL field names, no fuzzing or static analysis

> Severity-3 findings (F-003, F-005, F-006) carry full blocks above by auditor judgment
> (OUTPUT-RULES Rule 5: blocks are optional below severity 4 but permitted).

---

## 5. Detailed Item Results

> Every in-scope checklist item appears below with an explicit verdict, in checklist order.
> `[N/A]` verdicts always state why. Severity-≥4 `[FAIL-N]` verdicts cross-reference their finding.

### Checklist 01 — Account Validation (AV-001 … AV-090)

```
[FAIL-4]    AV-001: No account's owner is validated. All 30 fields are raw AccountInfo.
              File: lib.rs:328-335, 350-358, 375-386, 405-419, 592-623
              Impact: the program's own balance/mint reads trust arbitrary bytes
              Fix: typed accounts or explicit owner asserts  -> F-004
[FAIL-3]    AV-002: Every account uses raw AccountInfo<'info>; zero UncheckedAccount, zero Account<T>.
              File: lib.rs:328-334, 350-357, 377-385, 407-418, 593-622
              Impact: no framework-level owner/discriminator guarantee anywhere
              Fix: migrate to UncheckedAccount + /// CHECK: at minimum  -> F-004
[FAIL-3]    AV-003: Zero /// CHECK: doc comments exist in the file (grep: 0 hits).
              File: lib.rs (whole)
              Impact: unchecked accounts carry no documented validation contract
              Fix: add /// CHECK: describing the actual runtime validation  -> F-004
[N/A]       AV-004: No /// CHECK: comment exists, so none can be mismatched to code (lib.rs, 0 hits).
[N/A]       AV-005: No Account<'info, T> is used anywhere (0 hits); the program defines no state struct.
[FAIL-4]    AV-006: Token accounts held as raw AccountInfo and parsed by byte offset.
              File: lib.rs:380 (pc_wallet), :609 (order_payer), :613 (coin_vault), :617 (pc_vault), :622 (coin_wallet)
              Impact: token::accessor::amount reads bytes 64..72 with no owner or length check
              Fix: Account<'info, TokenAccount> with token::mint / token::authority  -> F-004
[N/A]       AV-007: No mint account is passed to any instruction; mints are derived from token bytes (lib.rs:110-115).
[FAIL-3]    AV-008: Programs and sysvars are raw AccountInfo, not Program<T> / Sysvar<Rent>.
              File: lib.rs:333, 357, 382, 415 (dex) · :383, 416 (token) · :334, 385, 418 (rent)
              Impact: CPI target and token program identity are unasserted
              Fix: Program<'info, Token>, Sysvar<'info, Rent>, address = dex::ID  -> F-001, F-004
[N/A]       AV-009: No Account<'info, T> typing is used at all, so no cross-program struct confusion is possible.
[PASS]      AV-010: declare_id! @ lib.rs:19 matches Anchor.toml:8; no keypair file is tracked (git ls-files = 13 files).
[N/A]       AV-011: The program defines no on-chain account type — #[account] appears 0 times (only #[event] @ lib.rs:662).
[N/A]       AV-012: No account struct is deserialized by this program, so no layout-prefix confusion exists.
[PARTIAL]   AV-013: remaining_accounts[0] is never deserialized — but also never validated.
              File: lib.rs:73, 143 (taken), :557-558 (forwarded into settle_funds)
              Missing: an assert that the referral is an SPL token account of the market's quote mint
              Fix: validate the referral, or drop the pass-through
[N/A]       AV-014: No remaining account is expected to be a PDA of this program (no PDA exists).
[N/A]       AV-015: No account structs are defined, so no discriminator collision is possible.
[N/A]       AV-016: No account structs are defined.
[N/A]       AV-017: No account versioning or migration exists.
[PASS]      AV-018: Exactly the DEX-written accounts are mut — lib.rs:328, 350, 354, 379, 412, 592-622.
[PASS]      AV-019: market (:332, :356), vault_signer (:619) and all program/sysvar accounts are read-only; market.market (:593) is mut because new_order_v3 writes market state.
[N/A]       AV-020: has_one is inapplicable — the program owns no state account with reference fields.
[N/A]       AV-021: No has_one constraints exist (see AV-020).
[N/A]       AV-022: No init constraint anywhere (0 hits); the open-orders account is created by the client or the DEX.
[PASS]      AV-023: init_if_needed is not used (0 hits) — no reinitialization surface in this program.
[N/A]       AV-024: init_if_needed not used (see AV-023).
[N/A]       AV-025: No close = constraint; close_account delegates to dex::close_open_orders @ lib.rs:43.
[N/A]       AV-026: No Anchor-managed close exists.
[N/A]       AV-027: No seeds constraint anywhere (grep seeds: 0 hits).
[N/A]       AV-028: No bump is derived or stored (grep bump: 0 hits).
[PARTIAL]   AV-029: The only custom constraints use no custom error type.
              File: lib.rs:379, 412 (pc_wallet), :608 (order_payer), :621 (coin_wallet)
              Missing: `@ ErrorCode::...` — a violation surfaces as the generic ConstraintRaw
              Fix: attach a named error to each constraint
[N/A]       AV-030: No realloc constraint anywhere (grep realloc: 0 hits), so realloc::payer / realloc::zero do not apply.
[PARTIAL]   AV-031: Anchor 0.19 does NOT auto-reject duplicate mutable accounts (false-positives FP-6 escape (b)).
              File: lib.rs:407-408 — nothing prevents from.* and to.* aliasing in swap_transitive
              Missing: require!(from.market.key != to.market.key)
              Barrier: is_valid_swap_transitive (:646-648) rejects equal coin-wallet mints, and the
              caller supplies every aliased account itself, so the residual is caller self-harm
[FAIL-3]    AV-032: remaining_accounts are passed through blind.
              File: lib.rs:73, 143 -> :557-558
              Impact: bounded — under the canonical DEX the referral only RECEIVES a rebate whose
              routing the caller already controls; the gap is the unconditional pass-through
              Fix: validate owner + mint, or require remaining_accounts.len() == 0
[FAIL-3]    AV-033: The referral account's owner is never verified.
              File: lib.rs:73, 143, 557-558
              Impact/Fix: as AV-032
[FAIL-3]    AV-034: The referral is used as a token account by the DEX; its mint and authority are never verified here.
              File: lib.rs:557-558
              Impact/Fix: as AV-032
[N/A]       AV-035: The referral is not expected to be a PDA of this program.
[FAIL-3]    AV-036: The remaining_accounts count is never validated.
              File: lib.rs:73, 143 — iter().next() reads index 0; extras are silently ignored
              Impact: a caller cannot tell a dropped account from an intended one
              Fix: require!(ctx.remaining_accounts.len() <= 1, ErrorCode::...)
[FAIL-3]    AV-037: A remaining account is forwarded into an external CPI with no program-ownership validation.
              File: lib.rs:557-558
              Impact/Fix: as AV-032; compounded by the unvalidated CPI target (F-001)
[PARTIAL]   AV-038: Nothing prevents the referral from aliasing pc_wallet or a vault.
              File: lib.rs:73, 557-558
              Missing: a distinctness assert. Barrier: under the canonical DEX a self-referral merely
              rebates the caller's own fee to themselves
[N/A]       AV-039: No investor-position concept exists in this program.
[N/A]       AV-040: No init / space allocation in this program (0 hits).
[N/A]       AV-041: The program creates no account.
[N/A]       AV-042: No account struct with variable-length fields; DidSwap (lib.rs:662-690) is a fixed-size log event.
[N/A]       AV-043: No realloc (0 hits).
[N/A]       AV-044: No account resizing exists.
[FAIL-4]    AV-045: No token account's mint is validated against an expected mint.
              File: lib.rs:380, 609, 622; guard at :651-657 only asserts the two mints DIFFER
              Impact: the pre-CPI guard operates on unvalidated bytes
              Barrier: SPL Token's own Transfer enforces mint equality at settle time
              Fix: token::mint constraints bound to MarketState.coin_mint / pc_mint  -> F-004
[FAIL-4]    AV-046: No token account's owner/authority is validated against `authority`.
              File: lib.rs:375-386, 405-419, 592-623
              Impact: settle proceeds can be directed to any right-mint account; self-directed while
              the signer is the end user, material if a downstream program signs with a PDA
              Fix: token::authority = authority on pc_wallet and coin_wallet  -> F-004
[N/A]       AV-047: The program owns no vault and no PDA.
[N/A]       AV-048: No ATA derivation is performed; empty::ID (lib.rs:24) is only a sentinel to reject.
[N/A]       AV-049: No delegated_amount logic exists.
[PARTIAL]   AV-050: Frozen state is never checked (lib.rs:82-95).
              Missing: no explicit check. Barrier: a frozen wallet makes settle_funds fail and aborts
              the caller's own transaction — self-limited, nothing is custodied
[N/A]       AV-051: No WSOL handling; the native mint is never referenced.
[PARTIAL]   AV-052: token_program is unconstrained (lib.rs:383, 416) while token::accessor parses the
              classic SPL layout by fixed offset (:82-83).
              Missing: constrain to spl_token::ID. Barrier: Serum v3 markets are classic-SPL only
[PASS]      AV-053: No instruction initializes an account; init_account (lib.rs:32-36) only CPIs to the DEX.
[N/A]       AV-054: No manual initialization exists.
[N/A]       AV-055: No PDA seeds are used.
[N/A]       AV-056: The program performs no close of its own accounts (the close @ lib.rs:43 is a DEX CPI).
[PARTIAL]   AV-057: tests/swap.js:172-227 chains create -> init -> close in one transaction.
              Missing: nothing in-tree — this program performs no post-close read, so no stale-data
              path exists here; the DEX's behaviour is out of tree
[FAIL-3]    AV-058: Classic vs Token-2022 is assumed, not asserted.
              File: lib.rs:383, 416
              Impact: a Token-2022 account would be mis-parsed by the fixed-offset accessor
              Fix: Program<'info, Token> or require_keys_eq!(token_program.key(), spl_token::ID)
[N/A]       AV-059: The program never derives or enforces an ATA.
[N/A]       AV-060: The program issues no token transfer; all movement is inside the DEX CPIs.
[FAIL-3]    AV-061: Decimals are never read from any mint.
              File: lib.rs:700-703 (caller-supplied u8) used as exponents at :241, 268, 275, 298, 305
              Impact: the slippage bound is denominated in whatever decimals the caller claims; >= 39 panics
              Fix: read Mint::decimals, or bound the field  -> F-003
[PASS]      AV-062: Credited amounts ARE balance deltas — lib.rs:82-83 vs :94-95, :148-158, :170-180 — the correct pattern for fee-on-transfer tokens.
[N/A]       AV-063: Arbitrary mints are accepted only where a Serum v3 market exists; Serum v3 predates Token-2022 and lists classic mints only.
[N/A]       AV-064: The program custodies no balance — funds are in the caller's wallets and the DEX's vaults.
[PARTIAL]   AV-065: Freeze/mint authority is never considered (no mint account is read).
              Missing: documentation of the assumption. Barrier: a frozen wallet aborts the caller's own swap
[N/A]       AV-066: No allowlist is needed — the program holds no funds and every account is the caller's own.
[FAIL-3]    AV-067: close_authority / delegate on the supplied wallets are never inspected.
              File: lib.rs:375-386, 592-623
              Impact: a token delegate can route a delegated allowance through this program
              Barrier: a delegate can already transfer that allowance directly via SPL Token — no new capability
              Fix: token::authority = authority on order_payer_token_account
[N/A]       AV-068: The program reads no Clock, Rent or epoch data (grep: 0 hits).
[FAIL-3]    AV-069: rent is a raw AccountInfo, not Sysvar<'info, Rent>, and its address is never asserted.
              File: lib.rs:334, 385, 418; forwarded into CPIs at :554, :578
              Impact: identity delegated entirely to the out-of-tree callee; the program never reads it
              Fix: rent: Sysvar<'info, Rent>
[N/A]       AV-070: No time-gated logic exists (no cooldown, vesting, auction or staleness window).
[N/A]       AV-071: No Instructions-sysvar introspection (grep load_instruction_at: 0 hits).
[N/A]       AV-072: No introspection-based signature checks exist.
[N/A]       AV-073: No introspected signed messages exist.
[N/A]       AV-074: No instruction-index assumption exists.
[PARTIAL]   AV-075: The privileged account is `authority`, bound only by #[account(signer)] (lib.rs:378, 411).
              Missing: pc_wallet / coin_wallet are not bound to it (see AV-046). No positional or
              ALT-order trust exists anywhere, which is the item's primary concern
[N/A]       AV-076: No PDA bumps are used (grep: 0 hits).
[PASS]      AV-077: Framework is Anchor 0.19.0 (programs/swap/Cargo.toml:21-22, #[program] @ lib.rs:27) — not native/Pinocchio.
[N/A]       AV-078: Not a native program (see AV-077); note the Anchor owner guarantee is nonetheless void here because no typed account is used (AV-001).
[N/A]       AV-079: Not native; #[account(signer)] @ lib.rs:330, 352, 378, 410 produces the is_signer assertion.
[PARTIAL]   AV-080: Not a native program, but the same class of defect is present.
              File: lib.rs:82-83, 94-95 — token::accessor::amount reads bytes 64..72 with no length check
              Missing: a bounds guard; a shorter account panics
              Fix: deserialize via Account<'info, TokenAccount>  -> F-004
[PASS]      AV-081: No unsafe block anywhere (grep unsafe: 0 hits).
[N/A]       AV-082: No account-type disambiguation is performed by this program.
[N/A]       AV-083: Pinocchio is not used.
[N/A]       AV-084: No SPL Token reimplementation exists.
[PASS]      AV-085: No lamport-balance comparison of any kind exists (grep lamports: 0 hits) — no exact-balance assumption to break.
[PASS]      AV-086: No builtin/sysvar/precompile account is marked mut — rent (:334, 385, 418), token_program (:383, 416) and dex_program are all read-only.
[PASS]      AV-087: init_account (lib.rs:32-36) inits nothing itself; the open-orders account is a caller-generated keypair (tests/swap.js:106-114), not a derivable address, so it cannot be front-run.
[FAIL-3]    AV-088: Fixed-offset reads of accounts whose owner and length are unverified.
              File: lib.rs:82-83, 94-95, 110-115, 148-149, 157-158, 170-171, 179-180, 201-203, 652-653
              Impact: panic on a short account; garbage mint/amount on a non-token account
              Fix: deserialize via Account<'info, TokenAccount>  -> F-004
[PASS]      AV-089: No require! or branch reads ComputeBudget instructions; the Instructions sysvar is never touched (grep: 0 hits).
[PASS]      AV-090: No introspection loop and no positional/count assumption — remaining_accounts is read only via iter().next() (lib.rs:73, 143), safe for any length including 0.
```

### Checklist 02 — Access Control (AC-001 … AC-050)

```
[PARTIAL]   AC-001: Both value-moving instructions require a signer, but as AccountInfo + #[account(signer)].
              File: lib.rs:377-378, 410-411
              Missing: the Signer<'info> type. Anchor 0.19 lowers the constraint to the same is_signer
              assertion, so the gap is type-level expressiveness, not enforcement
[PASS]      AC-002: All four instructions require `authority` to sign — lib.rs:330-331, 352-353, 377-378, 410-411. No permissionless state mutation exists.
[N/A]       AC-003: No program-owned state account exists to link the signer to; `authority == open_orders.owner` is enforced by the DEX callee.
[PARTIAL]   AC-004: AccountInfo + #[account(signer)] is used instead of Signer<'info>.
              File: lib.rs:330, 352, 378, 410
              Missing: the idiomatic, self-documenting type. Not an omission — the check is unconditional
[PASS]      AC-005: The check is the Anchor #[account(signer)] constraint (lib.rs:330, 352, 378, 410) — an unconditional assertion, not an if-else.
[N/A]       AC-006: No manager/admin role exists — no config account and no admin instruction.
[N/A]       AC-007: No investor/position concept exists.
[PARTIAL]   AC-008: No delegation mechanism exists in the program, but a token delegate can use order_payer_token_account.
              File: lib.rs:608-609
              Missing: token::authority = authority on the payer
              Barrier: a delegate can already move the delegated amount directly via SPL Token, so
              routing through this program grants no additional capability
[PASS]      AC-009: No third party can act for a signer — every CPI carries `authority` as open_orders_authority (lib.rs:549, 574).
[PASS]      AC-010: No permissionless value-moving instruction exists; all four require a signature (lib.rs:330, 352, 378, 410).
[PASS]      AC-011: Exactly one role exists — `authority` (the trader). init_account (:32), close_account (:39), swap (:61), swap_transitive (:137) all map to it.
[PASS]      AC-012: No instruction has an ambiguous role — all four are single-role (see AC-011).
[N/A]       AC-013: No manager instruction exists to escalate into.
[N/A]       AC-014: No investor instruction exists.
[N/A]       AC-015: No admin role exists in the program; the only privileged actor is the off-chain BPF upgrade authority (OPS-001).
[N/A]       AC-016: No admin role exists.
[PASS]      AC-017: No god-mode account — the only hardcoded keys are declare_id! (lib.rs:19) and the `empty` sentinel (:24), the latter used solely in != rejections at :379, 412, 608, 621.
[N/A]       AC-018: No manager/investor distinction exists.
[N/A]       AC-019: No manager/investor distinction exists.
[N/A]       AC-020: No fund object exists.
[N/A]       AC-021: No position object exists.
[N/A]       AC-022: No manager withdrawal path exists.
[N/A]       AC-023: The program charges no fee (the only `fee` references are doc comments at lib.rs:73, 142, 511 describing the Serum referral).
[N/A]       AC-024: No fee is stored or changeable.
[N/A]       AC-025: No treasury exists.
[N/A]       AC-026: No treasury exists.
[N/A]       AC-027: No platform fee exists.
[N/A]       AC-028: No fund PDA or ownership-transfer path exists.
[N/A]       AC-029: No whitelist exists — the substance of that gap is reported as F-001 (nothing constrains the CPI target).
[FAIL-2]    AC-030: No pause mechanism exists (grep pause|freeze|emergency in lib.rs: 0 hits).
              File: lib.rs:27-209
              Impact: none directly — the program is stateless and custodies nothing
              Fix: none required; see AC-035
[N/A]       AC-031: No pause exists.
[N/A]       AC-032: No pause exists.
[N/A]       AC-033: No pause and no fee exist.
[N/A]       AC-034: No pause exists, and the program holds no user funds to exit.
[FAIL-2]    AC-035: No emergency stop exists.
              File: lib.rs:27-209
              Impact: severity held at 2 rather than the checklist's LOW/MEDIUM default because the
              program is stateless and non-custodial — halting it strands nothing, and the upgrade
              authority can already replace the binary
              Fix: document the design decision; if added, gate it behind the upgrade authority
[N/A]       AC-036: The program controls no mint.
[N/A]       AC-037: No shares mint exists.
[N/A]       AC-038: No shares mint exists.
[PASS]      AC-039: No PDA is created by this program (grep find_program_address: 0 hits), so there is no PDA to front-run; the open-orders account is a caller keypair (tests/swap.js:106-114).
[N/A]       AC-040: No position or fund-membership concept exists.
[PASS]      AC-041: There is no shared program state to manipulate — the program owns no account. Contention on the DEX's shared market accounts (lib.rs:593-603) is a Serum property (see KV-131).
[PASS]      AC-042: close_account passes `authority` as the open-orders authority (lib.rs:363); the DEX rejects a close by a non-owner. No force-close path exists here.
[PASS]      AC-043: Replay is prevented by the runtime's recent-blockhash rule; the program stores no nonce and the repository contains no off-chain replay surface.
[FAIL-2]    AC-044: No on-chain rate limit or cooldown exists (grep: 0 hits).
              File: lib.rs:27-209
              Impact: none material — the program holds no funds and each call costs the caller DEX taker fees
              Fix: none required; recorded for completeness
[PASS]      AC-045: No init instruction exists in this program to spam — init_account (lib.rs:32-36) only CPIs, and the account payer is the caller (tests/swap.js:106-114).
[PASS]      AC-046: The program carries no state between instructions; all four handlers are self-contained (lib.rs:32-45, 61-119, 137-208).
[PARTIAL]   AC-047: tests/swap.js:172-227 intentionally chains create -> init -> close in one transaction.
              Missing: nothing in-tree — this program reads nothing after the close; DEX behaviour is out of tree
[FAIL-4]    AC-048: The CPI callee is caller-supplied and can call back into this program.
              File: lib.rs:333, 357, 382, 415
              Impact: re-entry gains nothing (no privileged state, and the caller's own accounts are
              still required); the real exposure is the forward direction — the caller's signature is
              handed to an unvalidated program
              Fix: constrain the program account  -> F-001
[PASS]      AC-049: Per false-positives FP-1 there is no cross-program state path to re-enter — this program writes no state at all, so checks-effects-interactions is structurally inapplicable.
[N/A]       AC-050: invoke_signed with program seeds is never used (grep: 0 hits); the program holds no PDA authority.
```

### Checklist 03 — Arithmetic Safety (AR-001 … AR-063)

```
[PASS]      AR-001: The only addition is to_amount.checked_add(spill_surplus) @ lib.rs:310.
[PARTIAL]   AR-002: All seven subtractions use checked_sub but terminate in .unwrap().
              File: lib.rs:98, 99, 162, 163, 184, 185, 191, 283
              Missing: .ok_or(ErrorCode::Overflow)? instead of .unwrap()  -> F-003
[PARTIAL]   AR-003: All multiplications use checked_mul but terminate in .unwrap().
              File: lib.rs:233, 238, 260, 272, 295, 302  -> F-003
[PARTIAL]   AR-004: Both divisions use checked_div but terminate in .unwrap().
              File: lib.rs:279, 585  -> F-003
[PASS]      AR-005: No bare arithmetic operator on any financial value — every site in lib.rs uses a checked_* method.
[PASS]      AR-006: No saturating_add/sub/mul anywhere (grep: 0 hits).
[PASS]      AR-007: No wrapping_add/sub/mul anywhere (grep: 0 hits).
[PASS]      AR-008: The only constants in arithmetic are the 10u128 bases (lib.rs:240, 268, 275, 297, 304) and limit_price = 1 (:467) — all compile-time.
[N/A]       AR-009: No #[account(init, space = ...)] exists.
[PASS]      AR-010: The a*b/c pattern at lib.rs:256-287 is computed entirely in u128 — widened by u128::from (:256) and .into() (:262, 285).
[N/A]       AR-011: No share calculation exists.
[N/A]       AR-012: No fee calculation exists in this program.
[PASS]      AR-013: The proportion at lib.rs:256-287 uses u128 throughout with multiply-before-divide (the divide is last, :279).
[PASS]      AR-014: No downcast occurs — min_expected_amount and effective_to_amount stay u128 and are compared as u128 @ lib.rs:314.
[PASS]      AR-015: No `as u64` cast exists (grep: 0 hits).
[PASS]      AR-016: No `as u32` cast exists (grep: 0 hits).
[PASS]      AR-017: No `as i64` cast exists (grep: 0 hits).
[PARTIAL]   AR-018: checked_div is used, so a zero divisor is detected rather than trapped — but the following .unwrap() converts it into a panic.
              File: lib.rs:279 (quote_amount - spill_amount), :585 (coin_lot_size)
              Missing: an explicit guard or error propagation  -> F-003
[N/A]       AR-019: No share pricing exists.
[N/A]       AR-020: No withdrawal proportion exists.
[FAIL-3]    AR-021: Division truncates to zero with no minimum-output requirement.
              File: lib.rs:584-586 — coin_lots floors when size < market.coin_lot_size; :535 then panics
              Impact: any sub-lot sell aborts with an opaque panic instead of a typed error
              Fix: require!(max_coin_qty > 0, ErrorCode::AmountBelowLotSize)  -> F-003
[N/A]       AR-022: No share minting exists.
[N/A]       AR-023: No share redemption exists.
[PARTIAL]   AR-024: Two floor divisions exist.
              File: lib.rs:585 (coin_lots residue is silently not sold) and :279 (spill_surplus rounds
              DOWN, i.e. conservatively for the guard — the safe direction)
              Missing: the coin_lots residue is dropped from the caller's stated `amount` without
              being reported. No rounding accumulates in state, because the program stores nothing
[N/A]       AR-025: No first-depositor concept exists (no vault, no shares).
[N/A]       AR-026: No share minting formula exists in this program.
[N/A]       AR-027: No share minting exists, so the zero-supply case does not arise.
[N/A]       AR-028: No share burning formula exists.
[N/A]       AR-029: No share mint exists. (Swap slippage protection does exist, at lib.rs:314-321 — see ECON-075.)
[N/A]       AR-030: No share burn exists (see AR-029).
[N/A]       AR-031: No vault exists to donate into.
[N/A]       AR-032: No shares exist to deflate.
[N/A]       AR-033: No investor positions exist to sum.
[N/A]       AR-034: No shares mint exists.
[N/A]       AR-035: The program charges no management fee.
[N/A]       AR-036: The program charges no performance fee.
[N/A]       AR-037: The program charges no platform fee.
[N/A]       AR-038: No fee split exists — the DEX taker fee is computed inside the callee.
[N/A]       AR-039: No fee basis points are stored or validated by this program.
[N/A]       AR-040: No minimum platform fee exists.
[N/A]       AR-041: No fee extraction order exists.
[N/A]       AR-042: No compound fee path exists.
[N/A]       AR-043: No fee calculation exists, so no zero-fee edge case arises.
[N/A]       AR-062: No multi-component fee configuration exists to sum-validate.
[N/A]       AR-044: No NAV calculation exists.
[N/A]       AR-045: No NAV calculation exists.
[N/A]       AR-046: No NAV calculation exists.
[N/A]       AR-047: No NAV exists to inflate.
[N/A]       AR-048: No NAV exists to deflate.
[N/A]       AR-049: No NAV attestation PDA exists.
[N/A]       AR-050: No NAV attestation exists, so staleness does not apply.
[N/A]       AR-051: The program never touches lamports (grep lamports: 0 hits).
[N/A]       AR-052: No lamport transfer occurs.
[N/A]       AR-053: No lamport manipulation occurs.
[N/A]       AR-054: No account can be drained by this program.
[N/A]       AR-055: No WSOL wrapping/unwrapping is performed.
[FAIL-3]    AR-056: MAX-value inputs are not handled.
              File: lib.rs:260 -> :272
              Impact: to_amount * spill_amount reaches u64::MAX^2 ~= 3.40e38 ~= u128::MAX, so the next
              checked_mul returns None and .unwrap() panics
              Worked case: to_amount = 1e15, spill_amount = 1e12, from_decimals = 9, quote_decimals = 6
              -> 1e27 * 1e9 * 1e6 = 1e42 > u128::MAX
              Fix: propagate the error and bound the decimals fields  -> F-003
[PARTIAL]   AR-057: amount = 0 is not rejected cleanly.
              File: lib.rs:535 (sell path) and :536 (buy path) panic via NonZeroU64::new(0).unwrap()
              Missing: an entry guard. to_amount == 0 IS handled cleanly at :216-218 (ErrorCode::ZeroSwap)
[FAIL-3]    AR-058: A 1-unit input on the sell path floors to 0 lots and panics.
              File: lib.rs:585 -> :535; the test market uses baseLotSize 100000 (tests/utils/index.js:267)
              Impact: opaque panic on any sub-lot amount
              Fix: as AR-021  -> F-003
[N/A]       AR-059: No shares exist, so the one-share-remaining edge case does not arise.
[N/A]       AR-060: No investor set and no batch operation exist.
[N/A]       AR-061: No timestamp arithmetic exists (grep Clock|unix_timestamp: 0 hits).
[PASS]      AR-063: No f32/f64, powf, powi, sqrt, ln, exp or float cast anywhere in lib.rs (grep: 0 hits). All value math is u64/u128 integer.
```

### Checklist 04 — CPI & PDA Safety (CPI-001 … RE-007)

```
[N/A]       CPI-001: Anchor 0.19 is in use (programs/swap/Cargo.toml:21); the Anchor-1.0 Pubkey-first CpiContext::new signature does not exist in this version. Passing AccountInfo at lib.rs:33, 42, 527, 556 is correct for 0.19.
[N/A]       CPI-002: CpiContext::new_with_signer is never used (grep: 0 hits).
[FAIL-3]    CPI-003: token_program is not validated as spl_token::ID.
              File: lib.rs:383, 416; forwarded into the DEX CPI at :554, :577
              Impact: identity delegated entirely to the out-of-tree callee
              Fix: Program<'info, Token>
[N/A]       CPI-004: No System Program CPI exists.
[N/A]       CPI-005: No Associated Token Program CPI exists.
[FAIL-5]    CPI-006: The DEX program ID is never validated against the hardcoded constant.
              File: lib.rs:333, 357, 382, 415 (declared) used at :33, 42, 527, 556
              Impact: see F-001; the same constant is already hardcoded at :469
              Fix: #[account(address = dex::ID)]  -> F-001
[N/A]       CPI-007: No Metaplex CPI exists.
[FAIL-5]    CPI-008: The program account used for all six CPIs is an unchecked AccountInfo.
              File: lib.rs:33, 42, 527, 556
              Impact/Fix: see F-001
[FAIL-3]    CPI-009: remaining_accounts are forwarded into a CPI whose target is itself unvalidated.
              File: lib.rs:557-558
              Impact/Fix: see F-001, AV-037
[N/A]       CPI-010: Raw invoke_signed is never called directly (grep: 0 hits); all CPIs go through anchor_spl::dex helpers.
[FAIL-4]    CPI-011: The DEX-order source account is unconstrained and unrelated to the measured wallets.
              File: lib.rs:608-609 (order_payer_token_account) vs :82-83 (measured wallets)
              Impact: the balance-delta accounting can describe accounts the DEX never debited
              Fix: bind the payer to the measured wallet per side  -> F-002, F-004
[FAIL-4]    CPI-012: Destinations carry only the != empty::ID sentinel; neither mint nor authority is constrained.
              File: lib.rs:379-380 (pc_wallet), :621-622 (coin_wallet)
              Impact/Fix: see AV-045, AV-046  -> F-004
[PASS]      CPI-013: The authority for every DEX-side token movement is `authority` (lib.rs:549 open_orders_authority, :574), which is the transaction signer (:378, :411).
[PARTIAL]   CPI-014: Order quantities are computed, not taken raw — but the CPI imposes no economic bound.
              File: lib.rs:467-472 (sell), :492-494 (buy) — limit_price 1 / u64::MAX, max_native_pc_qty u64::MAX
              Missing: a price limit derived from min_exchange_rate; the only bound is post-hoc at :314-321  -> F-002
[N/A]       CPI-015: No token::mint_to CPI exists (grep: 0 hits).
[N/A]       CPI-016: No token::mint_to CPI exists.
[N/A]       CPI-017: No token::mint_to CPI exists.
[N/A]       CPI-018: No token::mint_to CPI exists.
[N/A]       CPI-019: No token::burn CPI exists (grep: 0 hits).
[N/A]       CPI-020: No token::burn CPI exists.
[N/A]       CPI-021: No token::burn CPI exists.
[FAIL-3]    CPI-022: close_account forwards an unconstrained destination.
              File: lib.rs:354-355 -> :43 (dex::close_open_orders)
              Impact: the rent refund goes wherever the caller names; self-directed because the caller
              is the open-orders owner and the signer
              Fix: constrain destination to authority, or document the intent
[PASS]      CPI-023: The close authority is `authority` (lib.rs:363), the transaction signer (:352-353).
[N/A]       CPI-024: The program owns no vault that could be closed.
[N/A]       CPI-025: No system_program::transfer CPI exists.
[N/A]       CPI-026: No token::approve CPI exists.
[N/A]       CPI-027: No token::revoke CPI exists.
[N/A]       PDA-001: The program derives no PDA (grep seeds|find_program_address|create_program_address: 0 hits).
[N/A]       PDA-002: No fund PDA exists.
[N/A]       PDA-003: No PDA exists to enumerate.
[N/A]       PDA-004: No PDA derivation exists, so no init/reference ordering can diverge.
[N/A]       PDA-005: No vault/treasury PDA exists.
[N/A]       PDA-006: No mint PDA exists.
[N/A]       PDA-007: No attestation/oracle PDA exists.
[N/A]       PDA-008: No access-control PDA exists.
[N/A]       PDA-009: No custom PDA exists.
[N/A]       PDA-010: No bump is derived or stored.
[N/A]       PDA-011: No PDA seed uses user-controlled data, because no PDA exists.
[N/A]       PDA-012: No name-based PDA seed exists.
[N/A]       PDA-013: No PDA seed exists to include mutable state.
[N/A]       PDA-014: invoke_signed is never used (grep: 0 hits).
[N/A]       PDA-015: invoke_signed is never used.
[N/A]       PDA-016: invoke_signed is never used.
[N/A]       PDA-017: No PDA is ever the authority — every CPI authority is the user's signer (lib.rs:549, 574).
[N/A]       PDA-018: No instruction needs invoke_signed, because the program holds no PDA authority.
[N/A]       PDA-019: No invoke_signed instruction data exists.
[N/A]       PDA-020: No Jupiter CPI exists.
[N/A]       PDA-021: No realloc anywhere (grep: 0 hits).
[N/A]       EXT-001: No Jupiter integration. The analogous Serum CPI uses the user's signer as authority (lib.rs:549, 574), so there is no PDA authority to protect.
[PARTIAL]   EXT-002: Slippage IS enforced, but post-CPI and by balance delta.
              File: lib.rs:314-321 (the check) vs :467, :492 (unbounded order price)
              Missing: an order-level price limit  -> F-002
[FAIL-4]    EXT-003: The returned token accounts are not verified to belong to the authority.
              File: lib.rs:379-380, 621-622
              Impact/Fix: see AV-046  -> F-004
[PARTIAL]   EXT-004: remaining_accounts are forwarded in the correct position but without validation.
              File: lib.rs:557-558
              Missing: owner/mint validation  -> AV-032
[PASS]      EXT-005: A post-CPI balance check IS performed — the whole apply_risk_checks gate (lib.rs:94-99 -> :314-321) is exactly this post-condition check.
[FAIL-5]    EXT-006: The external program ID is not validated on any call.
              File: lib.rs:33, 42, 527, 556
              Impact/Fix: see F-001
[N/A]       EXT-007: No Metaplex CPI exists.
[N/A]       EXT-008: No Metaplex CPI exists.
[FAIL-5]    EXT-009: There is no whitelist of permitted CPI targets; the target is whatever the caller passes.
              File: lib.rs:333, 357, 382, 415
              Impact/Fix: see F-001
[N/A]       EXT-010: No whitelist account exists.
[FAIL-4]    EXT-011: The callee is caller-chosen and can call back into this program.
              File: lib.rs:382
              Impact: no privilege escalation is available (the program holds no authority of its own),
              but the callback edge exists
              Fix: constrain the program account  -> F-001
[N/A]       EXT-012: No transfer hook — no Token-2022 usage and no get_extension (grep: 0 hits).
[N/A]       EXT-013: No custodied mint — the program holds nothing.
[PARTIAL]   EXT-014: Credit accounting IS delta-based (lib.rs:82-83 vs :94-95), satisfying the second half.
              Missing: no transfer_checked, because the program issues no transfer at all; movement
              happens inside the DEX with classic SPL Token
[N/A]       EXT-015: The program creates no mint and no metadata.
[PASS]      RE-001: There is no state to mutate — the program writes to no account (no #[account] struct exists). Checks-effects-interactions is vacuously satisfied.
[PASS]      RE-002: State IS re-read after the CPI — token::accessor::amount is called again at lib.rs:94-95, 157-158, 179-180; pre-CPI values are never reused.
[N/A]       RE-003: .reload() is an Anchor typed-account method and no typed account exists here; the manual re-read at lib.rs:94-95 serves the same purpose (see RE-007 for the owner gap).
[PASS]      RE-004: No approval or delegation is granted to any external program (no token::approve, grep: 0 hits).
[PASS]      RE-005: Flash-loan resistance is structural — there is no share price, no NAV and no vault to inflate; an atomic borrow-swap-repay simply trades at the book price.
[FAIL-4]    RE-006: No lamport accounting is performed around the CPIs.
              File: lib.rs:527, 556 — the authority signer is handed to a caller-supplied program with
              no pre-CPI lamports() snapshot
              Impact: a hostile callee could spend the signer's SOL; bounded because the signer is the
              attacker's own wallet in the self-inflicted case
              Fix: constrain the callee (F-001); a lamport bound is unnecessary once it is trusted
[FAIL-4]    RE-007: Account owners are not re-verified after any CPI — and were never verified before one.
              File: lib.rs:94-95, 157-158, 179-180 re-read DATA but never re-assert SPL Token ownership
              Impact: the post-CPI accounting trusts bytes from an account of unknown provenance
              Fix: typed accounts, which re-validate on deserialization  -> F-004
```

### Checklist 05 — State Machine & Lifecycle (SM-001 … SM-072)

```
[PASS]      SM-001: Exactly one enum exists — Side { Bid, Ask } @ lib.rs:625-629. It is an instruction argument, not persisted state. No status enum exists anywhere.
[PASS]      SM-002: Side variants enumerated — Bid @ lib.rs:627, Ask @ :628.
[PASS]      SM-003: Both variants are reachable from the instruction argument and matched at lib.rs:76-79 and :87-90.
[N/A]       SM-004: Side is not persisted state, so there is no "transition out of" to verify.
[PASS]      SM-005: No dead variant — both Bid and Ask are used at lib.rs:77-78, :88-89 and converted at :633-636.
[N/A]       SM-006: No persisted enum exists that could be written by external data manipulation.
[N/A]       SM-007: No terminal state exists — the program is stateless.
[N/A]       SM-008: No terminal-state account exists.
[N/A]       SM-009: No withdrawal lifecycle exists; swaps are single-instruction and atomic (lib.rs:61-119, 137-208).
[N/A]       SM-010: No withdrawal initiation instruction exists.
[N/A]       SM-011: No withdrawal swap/conversion step exists — the swap IS the whole operation.
[N/A]       SM-012: No multi-status conversion step exists.
[N/A]       SM-013: No intermediate readiness instruction is needed; there is no multi-step flow.
[N/A]       SM-014: No readiness instruction is REQUIRED, because no multi-step withdrawal flow exists to break.
[N/A]       SM-015: No withdrawal finalization exists.
[N/A]       SM-016: No withdrawal account exists to close.
[N/A]       SM-017: No shares are burned and no withdrawal transfer exists.
[N/A]       SM-018: No withdrawal cancellation exists.
[N/A]       SM-019: No investor shares exist to restore.
[N/A]       SM-020: No withdrawal account exists to close.
[N/A]       SM-021: No withdrawal object exists, so multiplicity does not apply.
[N/A]       SM-022: No withdrawal deadline exists.
[N/A]       SM-023: No withdrawal can be stuck — no withdrawal object exists, and the caller's funds never leave their own wallets except into the DEX vaults within one atomic instruction.
[N/A]       SM-024: No partial-withdrawal concept exists.
[N/A]       SM-025: No initialize_fund instruction exists.
[N/A]       SM-026: No fund fields exist to initialize.
[N/A]       SM-027: No fund object exists to re-initialize.
[N/A]       SM-028: No fund closure instruction exists.
[N/A]       SM-029: No investor positions exist to settle.
[N/A]       SM-030: No pending withdrawals exist.
[N/A]       SM-031: No fund object exists, so no rent is locked by one.
[N/A]       SM-032: No fund name or PDA exists.
[N/A]       SM-033: No deposit lifecycle exists.
[N/A]       SM-034: No position.shares field exists.
[N/A]       SM-035: No position object exists.
[N/A]       SM-036: No position tracking exists.
[N/A]       SM-037: No position account exists to close.
[N/A]       SM-038: No shares field exists to underflow.
[N/A]       SM-039: No total_deposited / total_withdrawn fields exist.
[N/A]       SM-040: No position object exists.
[N/A]       SM-041: No persisted state transition exists to pre-condition.
[N/A]       SM-042: No state sequence exists to skip.
[PASS]      SM-043: Every effect is inside one instruction; Solana's transaction atomicity (false-positives FP-4) makes partial state impossible.
[PASS]      SM-044: Same as SM-043 — the transaction rolls back in full on any error, including the F-003 panics.
[PASS]      SM-045: Replaying a swap requires a new transaction with a new blockhash and moves the caller's own funds again; there is no idempotent "finalize" to double-trigger.
[N/A]       SM-046: No PDA seeds are used, so none can be reused after a close.
[PARTIAL]   SM-047: Only two of four instructions emit an event.
              File: lib.rs:214 (swap, swap_transitive) — init_account (:32-36) and close_account (:39-45) emit nothing
              Missing: events on the two account-lifecycle instructions, so open-orders lifecycle is invisible in this program's logs
[PARTIAL]   SM-048: DidSwap carries amounts, mints, rate and authority but not enough to locate the trade.
              File: lib.rs:662-690
              Missing: timestamp, market address(es) and open-orders address — an indexer cannot tell
              which market(s) a swap used
[FAIL-4]    SM-049: Events are emitted before the guards and carry unvalidated data.
              File: lib.rs:214 fires BEFORE both error returns (:217, :320); mints at :110-115, :201-203
              are read from accounts whose owner is never checked
              Impact: a DidSwap log line exists for transactions that revert, and its mint fields are
              attacker-influenceable
              Fix: emit after the guards; type the accounts  -> F-004, KV-122
[PARTIAL]   SM-050: The event is the only off-chain signal this program produces.
              File: lib.rs:213-214
              Missing: market identity (SM-048), success binding (SM-049), and documented guidance that
              consumers must verify against finalized on-chain state
[N/A]       SM-051: No fund.total_shares and no shares mint exist.
[N/A]       SM-052: No investor positions exist to sum.
[N/A]       SM-053: No vault balance or total_assets is tracked by this program.
[N/A]       SM-054: No deposit instruction exists.
[N/A]       SM-055: No withdrawal instruction exists.
[N/A]       SM-056: No NAV exists to compare across a swap. The analogous property — the caller's realised rate meets their bound — is enforced at lib.rs:314-321.
[N/A]       SM-057: No timestamp field exists (grep Clock|unix_timestamp: 0 hits).
[N/A]       SM-058: No timestamp sentinel exists.
[N/A]       SM-059: No terminal state or cleanup path exists.
[N/A]       SM-060: No terminal state exists to enumerate transitions into.
[N/A]       SM-061: No accounting fields and no reserve are tracked.
[N/A]       SM-062: No time gate exists.
[N/A]       SM-063: No paired inequality exists.
[N/A]       SM-064: No transition matrix is needed — no persisted state exists.
[N/A]       SM-065: No terminal state exists to be absorbing.
[N/A]       SM-066: No lifecycle rewrite is possible — there is no lifecycle.
[N/A]       SM-067: No sub-state or secondary status exists.
[N/A]       SM-068: No fixed-slot collection exists; remaining_accounts is read only at index 0 (lib.rs:73, 143) and is not aggregated.
[N/A]       SM-069: No cached aggregate exists. The closest analogue — the balance deltas at lib.rs:82-99 — is recomputed on every call, never cached.
[N/A]       SM-070: No elapsed-time subtraction exists (grep vest|cliff|lockup|elapsed: 0 hits).
[N/A]       SM-071: No vesting schedule exists, so no unit mixing is possible.
[N/A]       SM-072: No cliff gate or linear release exists.
```

### Checklist 06 — Economic & Logic (ECON-001 … ECON-089)

```
[PASS]      ECON-001: There is no NAV and no deposit; an atomic borrow -> swap -> repay executes a market trade at the book price, which is the instruction's purpose.
[N/A]       ECON-002: No deposit/withdraw pair exists to cool down.
[N/A]       ECON-003: No share minting exists.
[N/A]       ECON-004: No shares are issued, so none can be used as collateral.
[N/A]       ECON-005: No NAV attestation exists.
[PARTIAL]   ECON-006: Slippage is user-configurable but enforced only post-hoc.
              File: lib.rs:65, 140 (the parameter), :314-321 (the check) vs :467, :492 (unbounded order)
              Missing: an order-level price limit  -> F-002
[FAIL-5]    ECON-007: The IOC order crosses the book at any price.
              File: lib.rs:467 (limit_price = 1), :492 (limit_price = u64::MAX), :472 (max_native_pc_qty = u64::MAX)
              Impact: a searcher who widens the book is caught only if the post-hoc guard is intact,
              and pre-existing unsettled balances can silently weaken it
              Fix: derive a limit_price from min_exchange_rate; settle before measuring  -> F-002
[PASS]      ECON-008: The route is fixed by the account set the caller signs for; there is no off-chain route blob and no venue-selecting instruction data (the only args are side, amount, min_exchange_rate — lib.rs:63-65).
[N/A]       ECON-009: No deposit instruction exists.
[N/A]       ECON-010: No withdrawal instruction exists.
[FAIL-3]    ECON-011: No minimum swap amount is enforced.
              File: lib.rs:585 -> :535 — a sub-lot amount panics instead of being rejected
              Impact: opaque failure for ordinary small trades
              Fix: require!(max_coin_qty > 0, ErrorCode::AmountBelowLotSize)  -> F-003
[N/A]       ECON-012: No withdrawal instruction exists.
[N/A]       ECON-013: No shares and no first-deposit path exist.
[N/A]       ECON-014: No vault exists to donate into.
[N/A]       ECON-015: No first deposit exists.
[N/A]       ECON-016: No virtual/dead-shares mechanism is needed — no shares exist.
[N/A]       ECON-017: No share price exists at creation.
[N/A]       ECON-018: No NAV is computed or stored.
[N/A]       ECON-019: No manager attests NAV — no manager exists.
[N/A]       ECON-020: No NAV exists to deflate.
[N/A]       ECON-021: No NAV change rate limit is needed.
[N/A]       ECON-022: No NAV verification mechanism is needed.
[N/A]       ECON-023: No NAV floor exists.
[N/A]       ECON-024: No NAV ceiling exists.
[N/A]       ECON-025: No NAV freshness requirement exists.
[N/A]       ECON-026: The program charges no fee, so none can be raised.
[N/A]       ECON-027: No fee is stored, so none can change retroactively.
[N/A]       ECON-028: No fee change exists to timelock.
[PARTIAL]   ECON-029: Wash trading is possible but structurally unprofitable here.
              File: lib.rs:537 (SelfTradeBehavior::DecrementTake), no per-caller restriction
              Missing: nothing actionable — this program charges nothing on volume, so there is no fee
              to farm. Quantified barrier: the DEX's own taker fee (22 bps per tests/swap.js:12) makes
              a round trip cost 0.44% of notional with zero offsetting revenue
[N/A]       ECON-030: No management fee accrual exists.
[N/A]       ECON-031: No performance fee or high-water mark exists.
[N/A]       ECON-032: No fee extraction order exists.
[N/A]       ECON-033: There is no fee instruction path to bypass.
[N/A]       ECON-034: No manager exists and the program holds no assets to swap away.
[N/A]       ECON-035: No fund tokens exist to send.
[N/A]       ECON-036: No pda_token_transfer instruction exists.
[N/A]       ECON-037: No pda_lamports_transfer instruction exists.
[N/A]       ECON-038: No pda_token_approve instruction exists.
[N/A]       ECON-039: No manager-directed vault swap exists.
[FAIL-5]    ECON-040: A CPI into a malicious program is possible — by the caller, not a manager.
              File: lib.rs:382, 415 -> :527, :556
              Impact: drains nothing that is not already the caller's, but it is the same mechanism this
              item targets; escalates if a downstream program signs with its own PDA
              Fix: constrain the CPI target  -> F-001
[N/A]       ECON-041: No whitelist exists (see ECON-040 for the underlying gap).
[N/A]       ECON-042: No whitelist exists to add to.
[N/A]       ECON-043: No manager exists to protect investors from.
[N/A]       ECON-044: Token-2022 transfer hooks cannot appear — Serum v3 markets (Anchor.toml:9) list classic SPL mints only.
[PASS]      ECON-045: Fee-on-transfer is handled correctly by construction — every amount is a measured balance delta (lib.rs:82-83 vs :94-95, :148-158, :170-180), never a declared amount.
[PASS]      ECON-046: The same mechanism covers rebasing tokens — actual balances are read immediately before and after.
[PARTIAL]   ECON-047: A freeze on coin_wallet/pc_wallet makes settle_funds fail and aborts the caller's own transaction.
              Missing: nothing actionable on-chain — no funds are trapped in this program because it
              holds none. Documented as an accepted risk
[N/A]       ECON-048: The program buys nothing for itself; supply inflation affects the caller's own position only.
[FAIL-3]    ECON-049: Non-standard decimals are not handled.
              File: lib.rs:700-703 — from_decimals/quote_decimals are caller-supplied and used as
              exponents at :241, 268, 275, 298, 305; a value >= 39 makes checked_pow return None and panic
              Impact: opaque panic; a wrong-but-valid value silently changes the guard's strength
              Fix: bound the fields and/or read Mint::decimals  -> F-003, AV-061
[N/A]       ECON-050: No native-SOL/WSOL conversion is performed.
[PARTIAL]   ECON-051: Compute exhaustion is possible and unbounded from the caller's side.
              File: lib.rs:525 (limit = 65535 matching cycles) across four CPIs in swap_transitive (:153, 154, 175, 176)
              Missing: a caller-tunable or leg-aware matching limit
[N/A]       ECON-052: No batch operation over positions exists.
[N/A]       ECON-053: No such instruction exists — remaining_accounts is read only at index 0 (lib.rs:73, 143).
[N/A]       ECON-054: The program creates no state account to bloat.
[N/A]       ECON-055: No Vec or array is stored — the program stores nothing.
[PASS]      ECON-056: No state exists that could be wedged; each call is fully independent.
[N/A]       ECON-057: No price oracle is used (grep pyth|switchboard|oracle: 0 hits). Price discovery is the Serum order book, read inside the callee.
[N/A]       ECON-058: No oracle price is read, so staleness does not apply.
[N/A]       ECON-059: No oracle confidence interval is read.
[N/A]       ECON-060: No oracle exists to manipulate.
[N/A]       ECON-061: No oracle exists, so no fallback is needed.
[PARTIAL]   ECON-062: The trust assumption IS documented in source but not enforced.
              File: lib.rs:371-373, 401-404 ("All other checks are done by the DEX on CPI")
              Missing: the assumption that dex_program IS the DEX is never asserted  -> F-001
[N/A]       ECON-071: No randomness, lottery or reward selection exists (grep random|vrf|slot_hashes: 0 hits).
[N/A]       ECON-063: No staking or partial-unstake path exists (grep reward_debt|total_staked: 0 hits).
[N/A]       ECON-064: No reward payout path exists.
[N/A]       ECON-065: No global reward accumulator exists.
[N/A]       ECON-066: No per-position snapshot exists.
[N/A]       ECON-067: No acc_reward_per_share scaling exists.
[N/A]       ECON-068: No share price or reward source exists.
[N/A]       ECON-069: No first-staker or total_staked == 0 case exists.
[N/A]       ECON-070: No reward_rate exists to change.
[N/A]       ECON-072: There is no protocol treasury to bound — the program custodies nothing and every outflow is from the caller's own wallet under their own signature.
[N/A]       ECON-073: No mark-to-market, unrealized PnL or borrowing power exists.
[N/A]       ECON-074: No reserves are held or redeployed.
[N/A]       ECON-089: No protocol-level outflow exists to rate-limit.
[PASS]      ECON-075: The guard is applied to the NET amount received — to_amount is a measured wallet delta AFTER settle_funds (lib.rs:95, 99), i.e. after the DEX taker fee and any referral rebate. There is no post-check fee skim.
[N/A]       ECON-076: The program charges no percentage fee, so no fee base exists.
[N/A]       ECON-077: The program charges no fee and performs no lamport debit.
[PASS]      ECON-078: Quantities are distinctly named — from_amount_before/after, to_amount_before/after (lib.rs:82-95), from_amount/to_amount (:98-99), sell_proceeds/buy_proceeds/spill_amount (:163, 185, 191). No overloaded `amount` is mutated in place.
[N/A]       ECON-079: No bonding curve or completion threshold exists.
[N/A]       ECON-080: No virtual/real reserve layers exist.
[N/A]       ECON-081: No interdependent curve configuration exists.
[N/A]       ECON-082: The program controls no vault PDA — nothing can accumulate and become unreachable.
[N/A]       ECON-083: No allocation or cumulative withdrawal cap exists.
[N/A]       ECON-084: No residual-sweep path exists.
[N/A]       ECON-085: The program maintains no accumulator (grep twap|cumulative|observation: 0 hits).
[N/A]       ECON-086: No per-update accumulator step exists.
[N/A]       ECON-087: No bounded measurement window exists.
[N/A]       ECON-088: No TWAP is read or projected.
```

### Checklist 07 — OpSec & Governance (OPS-001 … OPS-085)

```
[UNCONFIRMED] OPS-001: The deployed upgrade authority cannot be read from a static tree.
              `solana program show 22Y43yTVxuUkoRKdm9thyRhQ3SdgQS7c7kB6UNCiaczD` requires network
              access and command execution — both out of engagement scope. Intake default applied:
              upgradeable with a single-wallet authority (audit_2/intake.md §5).
[UNCONFIRMED] OPS-002: Multisig vs single wallet is not observable offline. QUESTIONS.md maps
              "single wallet" to an auto Severity-8 flag; OUTPUT-RULES Rule 10 / Rule 5b forbid a
              FAIL with no readable evidence, so it is recorded here instead. Client action: publish
              the authority and move it to a >= 2/3 Squads multisig.
[UNCONFIRMED] OPS-003: No multisig threshold is expressed anywhere in the repository.
[UNCONFIRMED] OPS-004: No multisig signer set is expressed anywhere in the repository.
[UNCONFIRMED] OPS-005: Signer key custody (hardware vs hot) is not observable from the tree.
[FAIL-3]    OPS-006: No timelock exists in the source.
              File: lib.rs:27-209 — no admin instruction, no config account, no delay mechanism
              Impact: an upgrade takes effect immediately, with no user-visible warning window
              Fix: hold the upgrade authority behind a timelocked multisig, or freeze the program  -> F-005 context
[N/A]       OPS-007: No timelock exists to classify as on-chain vs policy.
[FAIL-3]    OPS-008: No timelock of any duration; the recommended 24h DeFi minimum is not met.
              File: lib.rs:27-209
              Impact/Fix: as OPS-006
[UNCONFIRMED] OPS-009: Upgrade-authority mutability is a BPF-loader property, not observable in the tree.
[PARTIAL]   OPS-010: Immutability is not set by anything the repository controls.
              Missing: a documented upgrade policy — there is no SECURITY.md or governance doc
[PARTIAL]   OPS-011: A malicious upgrade is unusually dangerous here despite the program holding no funds.
              File: lib.rs:375-386 — users hand this program a signature plus their own token accounts,
              so an upgraded binary could move those tokens directly
              Missing: the multisig + timelock that this item exists to require (reported at OPS-006/008)
[N/A]       OPS-012: No timelock exists, so no emergency bypass exists.
[PASS]      OPS-013: No hidden admin instruction — the #[program] module (lib.rs:27-209) contains exactly four public functions (:32, :39, :61, :137), all requiring the caller's own signature.
[PASS]      OPS-014: No god-mode account — no branch bypasses #[account(signer)] (lib.rs:330, 352, 378, 410).
[PASS]      OPS-015: No pubkey-equality backdoor — the only comparisons are the three != empty::ID rejections (lib.rs:379, 412, 608, 621); no Pubkey::new_from_array appears.
[PASS]      OPS-016: No unused handler — all four instructions are exercised by tests/swap.js:97, :146, :242, :320.
[PARTIAL]   OPS-017: The IDL is generated by Anchor from this source and published by CI (.travis.yml:17, :27), so it matches at build time.
              Missing: no committed IDL checksum to compare against the deployed IDL account, and the
              build uses a different Anchor version than the crate declares (OPS-070)
[N/A]       OPS-018: No treasury pubkey exists to redirect.
[FAIL-5]    OPS-019: The DEX program ID is not merely mutable — it is supplied fresh on every call and never checked.
              File: lib.rs:333, 357, 382, 415
              Impact: strictly weaker than a mutable-but-gated config field  -> F-001
              Fix: #[account(address = dex::ID)]
[N/A]       OPS-020: No manager concept exists.
[N/A]       OPS-021: The program mints nothing.
[N/A]       OPS-022: The program burns nothing.
[PASS]      OPS-023: Zero unsafe blocks in lib.rs (grep: 0 hits).
[PASS]      OPS-024: No raw pointer manipulation — grep for *const / *mut returns 0 hits.
[PASS]      OPS-025: declare_id! (lib.rs:19) matches Anchor.toml:8 — 22Y43yTVxuUkoRKdm9thyRhQ3SdgQS7c7kB6UNCiaczD.
[FAIL-3]    OPS-026: The published binary cannot be verified against the published source with the declared toolchain.
              File: Anchor.toml:1 (0.17.0) · .travis.yml:8-9 (v1.7.8 / v0.17.0) · programs/swap/Cargo.toml:21-23 (0.19.0 / =1.8.5)
              Impact: anchor verify selects the wrong build image
              Fix: align all three declarations  -> F-005
[UNCONFIRMED] OPS-027: Deploy-keypair custody is not observable. Positively: no keypair file is tracked (git ls-files = 13 files, none a keypair JSON).
[UNCONFIRMED] OPS-028: Deploy-keypair storage is not observable. Anchor.toml:5 points the provider wallet at ~/.config/solana/id.json, outside the repository — correct.
[UNCONFIRMED] OPS-029: Operator wallet custody is not observable from the tree.
[N/A]       OPS-030: There is no backend server wallet — the repository contains no backend.
[N/A]       OPS-031: There is no backend server wallet.
[N/A]       OPS-032: No API keys are used by the program or the tests (Anchor.toml:4 targets localnet).
[N/A]       OPS-033: No API keys exist to scope.
[N/A]       OPS-034: No RPC endpoint is configured beyond cluster = "localnet" (Anchor.toml:4).
[N/A]       OPS-035: No frontend exists.
[PARTIAL]   OPS-036: A long-lived release credential is embedded in CI config.
              File: .travis.yml:33 (api_key.secure)
              Missing: rotation/revocation evidence. It is Travis-encrypted, so the ciphertext is not
              itself a leak — but Travis is no longer this project's CI. A full git-history secret
              sweep is a checklist-12 activity, out of scope under --scope program  -> F-006
[UNCONFIRMED] OPS-037: No multisig platform is referenced anywhere in the tree (no Squads, Goki, Marinade).
[UNCONFIRMED] OPS-038: No multisig threshold is observable offline.
[UNCONFIRMED] OPS-039: No multisig signer distribution is observable offline.
[UNCONFIRMED] OPS-040: No backup-signer arrangement is observable offline.
[UNCONFIRMED] OPS-041: Threshold-change protection is not observable offline.
[UNCONFIRMED] OPS-042: Proposal expiry is not observable offline.
[UNCONFIRMED] OPS-043: Multisig execution logging is not observable offline.
[FAIL-2]    OPS-044: No incident-response document exists.
              File: repository root — no SECURITY.md, INCIDENT*, or RUNBOOK* (git ls-files = 13 files)
              Fix: add a documented IR plan naming the upgrade-authority holders and the escalation path
[FAIL-3]    OPS-045: The program cannot be paused.
              File: lib.rs:27-209 — no pause exists (see AC-030/AC-035)
              Impact: the only lever is an upgrade, whose latency is the authority's signing latency
              Fix: document the upgrade-as-kill-switch procedure, or freeze and rely on client routing
[FAIL-2]    OPS-046: No bug bounty is referenced anywhere in the repository.
              Fix: publish a disclosure channel even without a paid bounty
[FAIL-2]    OPS-047: No security contact — no SECURITY.md, and README.md lists none.
              Fix: add SECURITY.md with a contact address
[N/A]       OPS-048: There is no fund PDA to monitor — the program holds no balance.
[FAIL-2]    OPS-049: No upgrade-transaction monitoring is configured or documented in the tree.
              Fix: alert on any BPF-loader upgrade of 22Y43...czD
[PARTIAL]   OPS-050: The DidSwap event (lib.rs:214) is the only telemetry primitive.
              Missing: an alerting configuration, plus the completeness/binding gaps of SM-048 and SM-049
[FAIL-2]    OPS-051: No war-room process is documented.
[FAIL-2]    OPS-052: No post-mortem process is documented.
[PASS]      OPS-053: The list of time-locked actions is empty and provably so — no time-gated operation exists in lib.rs (grep Clock|unix_timestamp|slot: 0 hits).
[FAIL-3]    OPS-054: Program upgrade timelock duration: NONE.
              File: lib.rs:27-209  -> OPS-006
[N/A]       OPS-055: No fee exists to timelock.
[N/A]       OPS-056: No manager exists to change.
[N/A]       OPS-057: No whitelist exists to change.
[N/A]       OPS-058: No treasury address exists.
[N/A]       OPS-059: No timelock exists, so no emergency bypass exists.
[N/A]       OPS-060: No time-locked transaction exists to cancel.
[N/A]       OPS-061: No pending-change mechanism exists to notify users about.
[PARTIAL]   OPS-062: Only one cluster and one wallet path are configured.
              File: Anchor.toml:4-5 (cluster = "localnet", wallet = ~/.config/solana/id.json)
              Missing: separate staging/production provider sections — separation is undocumented
              rather than demonstrably absent
[UNCONFIRMED] OPS-063: Deploy access is an organisational property. Note: CI publishes ARTIFACTS only (.travis.yml:22-33); no step calls solana program deploy or anchor deploy.
[PARTIAL]   OPS-064: CI auto-publishes release artifacts on tags.
              File: .travis.yml:30-31
              Present: tag gating (:30-31), --verifiable Docker build (:14), published checksums (:16-18)
              Missing: artifact signing, a second approver, and a pinned toolchain (OPS-074)  -> F-006
[N/A]       OPS-065: No server infrastructure exists in this repository.
[N/A]       OPS-066: No database exists.
[PASS]      OPS-067: No private key is present in CI environment variables — .travis.yml:5-9 holds only version strings, and :47 generates a throwaway keypair inside the job.
[FAIL-2]    OPS-068: No secret manager is used or referenced.
              File: .travis.yml:33 — the single credential is an encrypted value inline in CI config
              Fix: move release credentials into the CI provider's secret store with scoped permissions
[PASS]      OPS-069: Open source — Apache-2.0 (programs/swap/Cargo.toml:5, LICENSE), published on crates.io and docs.rs (README.md:3-4).
[FAIL-3]    OPS-070: anchor verify cannot be expected to reproduce the deployed binary.
              File: Anchor.toml:1 vs programs/swap/Cargo.toml:21-22
              Impact: the project's central source-integrity claim is independently uncheckable
              Fix: align the declared Anchor version  -> F-005
[FAIL-3]    OPS-071: The audit build is not reproducible.
              File: as OPS-070, plus .gitmodules:1-3 — deps/serum-dex is an unchecked-out submodule and
              Anchor.toml:9, :13 point the test genesis into it
              Impact: neither anchor test nor a verification build works from a fresh clone
              Fix: align versions and pin the submodule to a named commit  -> F-005
[PARTIAL]   OPS-072: History integrity could not be established.
              File: local clone depth is 1 (git rev-list --count HEAD = 1)
              Missing: upstream reflog access to check for force-pushes
[UNCONFIRMED] OPS-073: Branch protection is a server-side GitHub setting. Indirect evidence: the audited commit is a merged PR (subject "... (#20)"), consistent with a PR-based flow.
[FAIL-3]    OPS-074: The CI pipeline is not hardened.
              File: .travis.yml:44 (curl | sh), :38-42 (five unpinned global npm installs), :48 (cargo
              install from a movable git tag), :33 (release credential in the same job)
              Impact: bounded — the released .so is built by anchor build --verifiable (:14) inside a
              pinned Docker image, so a poisoned host package cannot easily reach the binary's contents;
              it CAN reach the decrypted token and the published checksums
              Fix: pin every install, verify the installer hash, split the deploy job  -> F-006
[PARTIAL]   OPS-075: Dependency pinning is partial.
              File: programs/swap/Cargo.toml:23 (solana-program = "=1.8.5" — exact) vs :21-22
              (anchor-lang / anchor-spl = "0.19.0" — caret ranges)
              Present: Cargo.lock is committed and pins the resolved graph (anchor-lang 0.19.0,
              anchor-spl 0.19.0, serum_dex 0.4.0, spl-token 3.2.0)
              Missing: exact pins on the two Anchor crates
[N/A]       OPS-076: No stake account is used (grep stake|StakeProgram|staker|withdrawer: 0 hits).
[N/A]       OPS-077: No admin or governance instruction exists to reach via a durable nonce.
[UNCONFIRMED] OPS-085: There is no signing council in the repository; whether upgrade transactions are decoded at a multisig approval surface is an operational property not observable offline.
[N/A]       OPS-078: No in-program admin authority exists to rotate.
[N/A]       OPS-079: No fee or treasury account exists.
[N/A]       OPS-080: No config-update API exists.
[UNCONFIRMED] OPS-081: No multisig is referenced in the tree; the live threshold cannot be fetched offline.
[FAIL-3]    OPS-082: Caller-supplied numeric parameters have neither a minimum nor a maximum.
              File: lib.rs:698-703 — rate has no lower bound (rate = 0 makes the guard vacuous at :235);
              from_decimals / quote_decimals have no upper bound and are used as exponents at :241, 268,
              275, 298, 305, where >= 39 panics
              Impact: the program accepts values the rest of the program cannot safely consume
              Fix: require!(from_decimals <= 18 && quote_decimals <= 18) and require!(rate > 0)  -> F-003
[PARTIAL]   OPS-083: The interdependent values rate / from_decimals / quote_decimals / strict are never cross-validated.
              File: lib.rs:693-723; swap unilaterally overwrites quote_decimals = 0 at :70
              Missing: validation instead of silent overwrite — correct for a direct swap, but it
              discards a caller-supplied value rather than rejecting it
[PARTIAL]   OPS-084: Zero divisors are detected but not rejected cleanly.
              File: lib.rs:279 (quote_amount - spill_amount), :585 (market.coin_lot_size)
              Missing: both use checked_div(...).unwrap(), converting detection into a panic  -> F-003
```

### Checklist 16 — Formal Verification & Testing (FV-001 … FV-072)

```
[FAIL-4]    FV-001: No invariant is documented anywhere.
              File: repository root (no SPEC.md); lib.rs (grep invariant: 0 hits)
              Impact: the load-bearing property — "the caller receives at least min_exchange_rate" — is
              implemented at lib.rs:314-321 but never stated
              Fix: write the invariant list, starting with the three in audit_2/worksheets/context/  -> F-007
[FAIL-4]    FV-002: No property-based test or invariant assertion exists.
              File: tests/swap.js:273-274, 307-308, 371-374, 438-440 — hardcoded equality only  -> F-007
[FAIL-4]    FV-003: The decimal-basis identity has neither proof nor test.
              File: lib.rs:229-321; asserted only in source comments at :220-228, :230-243, :292-307
              Fix: a property test over (rate, from_decimals, quote_decimals, amounts)  -> F-007
[N/A]       FV-004: The program has no state machine to specify (see SM-001..008).
[FAIL-4]    FV-005: No model checking or fuzzing exists.
              File: .travis.yml:55 runs anchor test only; no *fuzz* artifact exists in the tree  -> F-007
[FAIL-4]    FV-006: Token conservation is never verified.
              File: lib.rs:98-99 — the wallet-delta accounting is never cross-checked against the DEX's
              own view, and no test asserts nothing is lost  -> F-007
[FAIL-4]    FV-007: No authority property is tested — no test attempts a swap with a missing or wrong signer (tests/swap.js: zero negative cases).  -> F-007
[N/A]       FV-008: No multi-step process exists that could deadlock — every instruction completes or reverts atomically.
[N/A]       FV-009: No formal spec exists to drift from.
[N/A]       FV-010: No machine-checked proof is claimed anywhere.
[N/A]       FV-011: No formal verification properties exist.
[N/A]       FV-012: No prior verification results exist to include.
[FAIL-4]    FV-013: No static analysis runs in CI.
              File: .travis.yml:55 — the only script line; no clippy, eslint or semgrep
              Fix: add cargo clippy -D warnings  -> F-007
[N/A]       FV-014: No static analysis exists, so there are no findings to triage.
[FAIL-3]    FV-015: No custom lint rule forbids unwrap() — and the program contains 21 of them on user-reachable paths.
              File: .travis.yml (no clippy); lib.rs:98..585
              Fix: -D clippy::unwrap_used would have caught every site of F-003
[FAIL-3]    FV-016: No zero-warning policy — .travis.yml sets no RUSTFLAGS="-D warnings" and the build is not checked for warnings.
[FAIL-3]    FV-017: No security ruleset is enabled — no clippy.toml and no #![deny(...)] in lib.rs.
[PASS]      FV-018: No dead code in the program — all four handlers, both Side variants, all three ErrorCode variants (lib.rs:727-732, raised at :655, :320, :217) and every helper are reachable. (tests/utils/index.js:122-188 initOrderbook is unused, but that is test scaffolding.)
[FAIL-4]    FV-019: No dependency vulnerability scan runs — cargo audit does not appear in .travis.yml.  -> F-007
[FAIL-3]    FV-020: No SAST covers either production language (Rust program, JS tests).
[PASS]      FV-021: No suppression comment exists anywhere — #[allow(...)] returns 0 hits in lib.rs.
[N/A]       FV-022: No static-analysis config file exists to version-control.
[FAIL-4]    FV-023: No fuzz target exists for the one deserialization surface the program owns — ExchangeRate (lib.rs:693-723), whose u8 decimals fields drive checked_pow exponents.  -> F-007
[FAIL-4]    FV-024: No instruction handler has a fuzz target — no Trident or cargo-fuzz configuration exists in the tree.  -> F-007
[N/A]       FV-025: No fuzz corpus exists.
[N/A]       FV-026: No fuzz campaign has been run.
[N/A]       FV-027: No fuzz crashes exist to triage.
[N/A]       FV-028: No second implementation exists to differentially fuzz.
[FAIL-4]    FV-029: Arithmetic edge cases are untested at every level.
              File: tests/swap.js:236, 293, 321, 387 use only mid-range values — no amount = 0, no
              u64::MAX, no sub-lot amount, no from_decimals >= 39  -> F-007
[N/A]       FV-030: No API endpoints exist to fuzz.
[N/A]       FV-031: No serialization round-trip surface exists beyond Anchor's own codegen.
[N/A]       FV-032: No fuzz infrastructure exists to document.
[FAIL-3]    FV-033: No coverage measurement — no tarpaulin, lcov or coverage step (.travis.yml, Anchor.toml:16).
[FAIL-4]    FV-034: Branch coverage on the critical path is structurally low.
              File: unexercised branches — strict == true (lib.rs:254), spill_amount == 0, ZeroSwap
              (:217), SlippageExceeded (:320), SwapTokensCannotMatch (:655)  -> F-007
[PASS]      FV-035: All four instructions have at least one test — tests/swap.js:97 (initAccount), :146 (closeAccount), :242 and :291 (swap), :320 and :386 (swapTransitive).
[PASS]      FV-036: Integration tests cover a multi-step workflow — tests/swap.js:36-40 and :42-83 set up two markets with resting orders, then exercise create -> init -> close and four swap directions against a real DEX binary (Anchor.toml:11-13).
[FAIL-4]    FV-037: No edge-case test exists — see FV-029.  -> F-007
[FAIL-4]    FV-038: There is not one negative test in the suite.
              File: tests/swap.js — every it(...) block asserts a success path
              Impact: the three error paths the program defines (lib.rs:655, :320, :217) are entirely
              unverified; so are unauthorized-caller and zero-amount cases
              Fix: add rejection tests for each  -> F-007
[N/A]       FV-039: No previously-found bug is recorded in the repository.
[PASS]      FV-040: Tests run in CI for every build — .travis.yml:50-55.
[FAIL-3]    FV-041: The test environment does not mirror the declared runtime.
              File: .travis.yml:8-9 (Solana v1.7.8, Anchor v0.17.0) vs programs/swap/Cargo.toml:21-23
              (solana-program =1.8.5, anchor 0.19.0)  -> F-005
[PASS]      FV-042: No test is skipped or pending — tests/swap.js contains no it.skip or xit.
[N/A]       FV-043: No mutation testing has been attempted; nothing in the tree claims otherwise.
[N/A]       FV-044: No endpoint exists to load-test. The closest analogue — CU cost of a 4-CPI transitive swap — is covered by FV-067.
[PASS]      FV-045: No hardcoded secret or private key in the tests — all keypairs are generated at runtime (tests/swap.js:33-34, :86, :179; tests/utils/index.js:191, :333-339).
[FAIL-3]    FV-046: Test data is not deterministic in the load-bearing way.
              File: tests/swap.js:135 (solChange === 23367808 || 23367744), :169, :373, :438 hardcode
              absolute results, with "TODO: calculate this dynamically" at :372 and :437
              Impact: any rent or fee change breaks the suite for reasons unrelated to correctness
[FAIL-3]    FV-047: CPI results are propagated with ? (lib.rs:34, 43, 88-89, 91), but every arithmetic and conversion failure around them terminates in .unwrap() — 21 sites.  -> F-003
[PASS]      FV-048: Error messages leak nothing internal — the three #[msg] strings (lib.rs:727, 729, 731) are user-facing, and the single msg! (:315-319) prints two amounts that are already public transaction data.
[FAIL-4]    FV-049: Panics are not caught at any boundary.
              File: lib.rs — 21 .unwrap() sites reachable from user input
              Impact: a BPF panic aborts with an opaque ProgramFailedToComplete rather than a typed ErrorCode  -> F-003
[N/A]       FV-050: No HTTP status codes exist.
[PARTIAL]   FV-051: Compute exhaustion is possible and unhandled.
              File: lib.rs:525 (limit = 65535) across four CPIs in swap_transitive
              Missing: a compute-aware limit for multi-leg swaps
[N/A]       FV-052: No network call with a timeout exists on-chain.
[PASS]      FV-053: Partial failure cannot persist — Solana rolls the whole transaction back (false-positives FP-4). A failed leg 2 in swap_transitive reverts leg 1.
[PASS]      FV-054: No error is swallowed — there is no .ok(), no `let _ =` and no empty match arm in lib.rs.
[PARTIAL]   FV-055: Three specific error codes are defined and used (lib.rs:725-733).
              Missing: the 21 .unwrap() sites bypass them entirely, surfacing as generic runtime panics  -> F-003
[PASS]      FV-056: Error types are exhaustive — ErrorCode (lib.rs:725-733) is matched by Anchor's generated From impl, and the Side matches at :76-79, :87-90, :632-637 cover both variants with no wildcard.
[N/A]       FV-057: No external dependency exists to circuit-break — a failing DEX CPI simply reverts the caller's transaction.
[FAIL-4]    FV-058: Divide-by-zero and underflow are detected but not blocked cleanly.
              File: lib.rs:279, 585 (checked_div) and :98, 99, 162, 163, 184, 185, 191 (checked_sub) —
              every one is .unwrap()ed into a panic
              Fix: .ok_or(ErrorCode::Overflow)?  -> F-003
[FAIL-4]    FV-059: No in-process SVM suite exists.
              File: Anchor.toml:16, .travis.yml:55 — mocha against a validator
              Impact: cannot control the clock or inspect rejected transactions precisely
              Fix: add a LiteSVM or Mollusk harness loading the compiled .so  -> F-007
[N/A]       FV-060: There is no time-locked or deadline instruction to test on both sides.
[N/A]       FV-061: No time-dependent logic exists.
[PARTIAL]   FV-062: Account closure is asserted, but on one field only.
              File: tests/swap.js:157-160 asserts getAccountInfo returns null after closeAccount
              Missing: separate lamports == 0 / data.len() == 0 / owner == system_program assertions
              (a null return implies collection, so the gap is presentational)
[FAIL-4]    FV-063: Re-initialization is never tested — no test calls initAccount twice on the same open-orders account.  -> F-007
[FAIL-4]    FV-064: Authorization negatives are never tested — no test sends a swap with a wrong or missing signer.  -> FV-038, F-007
[FAIL-4]    FV-065: Arithmetic edge cases are never driven through the SVM — see FV-029.  -> F-007
[PASS]      FV-066: Token balances are asserted after every swap path via withBalanceChange (tests/swap.js:452-476) and explicit assert.ok comparisons at :273-274, :307-308, :371-374, :438-440.
[FAIL-3]    FV-067: CU consumption is never profiled or baselined, despite a transitive swap making four CPIs with limit = 65535 matching cycles each (lib.rs:525).
[N/A]       FV-068: expire_blockhash() is a LiteSVM API; the suite uses a real validator where each provider.send fetches a fresh blockhash (tests/utils/index.js:460).
[FAIL-4]    FV-069: There is no failure-path test at all, so the "assert is_err() rather than unwrap()" discipline has nothing to apply to.  -> FV-038, F-007
[N/A]       FV-070: The program performs no PDA derivation. The one derivation in the tests — getVaultOwnerAndNonce (tests/utils/index.js:487-501) — is the DEX's vault signer, computed with the DEX program id, matching on-chain use.
[FAIL-4]    FV-071: No Solana-appropriate verification or fuzzing tool is used.
              File: repository-wide — no Trident, Crucible, Riverguard, Certora, Kani, Mollusk or LiteSVM
              Impact: the entire verification of a program declared at a mainnet address (Anchor.toml:7-9)
              that routes arbitrary user token accounts through an unvalidated CPI is six happy-path
              mocha tests — below the bar this item sets
              Fix: add at least an invariant/fuzz harness over apply_risk_checks  -> F-007
[N/A]       FV-072: Transaction v1 did not exist at this commit (2021-12-09), and the repository contains no reader/indexer, no fee sponsor and no ComputeBudget usage.
```

## 6. Known Vector Results (KV-001 … KV-136)

> In-scope vectors were loaded on demand per `known-vectors/INDEX.md`'s *Load when (markers)* column.
> `[N/A — feature absent: <marker>]` is an evidence-backed verdict (zero grep hits across the
> in-scope tree), not a silent skip; each such vector reopens on demand if a later read surfaces the
> feature. `[N/A — out of scope]` is rendered from the PROGRAM scope gate.

```
[PASS]      KV-001: Private Key Leak — no keypair file is tracked (git ls-files = 13 files, none a
              keypair JSON); tests generate keys at runtime (tests/swap.js:33-34, :86, :179);
              .travis.yml:47 creates a throwaway key inside CI; Anchor.toml:5 points outside the repo.
[N/A]       KV-002: Flash Loan Price Manipulation — feature absent: no `flash`/`flashloan`, no
              oracle-priced deposit/withdraw. The program has no deposit, no share price, no oracle.
[PARTIAL]   KV-003: Reentrancy (CPI) — markers present (CpiContext @ lib.rs:33, 42, 527, 556).
              Per false-positives FP-1 there is no cross-program state path: this program writes no
              state at all. Residual: the callee is caller-chosen (:382), so a callback edge exists —
              it gains nothing, because re-entry still requires the caller's own accounts.  -> F-001
[PASS]      KV-004: Missing Access Control — all four instructions require `authority` to sign
              (lib.rs:330, 352, 378, 410); there is no privileged instruction and no state to protect.
[N/A]       KV-005: Oracle Manipulation — feature absent: pyth / switchboard / oracle / get_price /
              PriceUpdate — zero hits in the in-scope tree.
[N/A]       KV-006: First Depositor / Share Inflation — feature absent: shares / mint_to / deposit /
              total_supply — zero hits; the program owns no vault.
[FAIL-5]    KV-007: MEV Sandwich Attack — markers `swap`, `slippage` present.
              File: lib.rs:467, :492 — the CPI order carries no price limit; the only protection is the
              post-hoc delta check at :314-321, which pre-existing unsettled balances can weaken
              Fix: derive limit_price from min_exchange_rate; settle before measuring  -> F-002
[PASS]      KV-008: Rug Pull / Admin Backdoor — no admin instruction, no hardcoded privileged pubkey,
              no mutable config; lib.rs:27-209 contains only the four user-facing handlers. The residual
              rug vector is the BPF upgrade authority, reported at OPS-011 / KV-020.
[FAIL-5]    KV-009: Unchecked CPI Target — Step 2 fails (program account is AccountInfo with no ID check
              @ lib.rs:333, 357, 382, 415); Step 3 fails (zero /// CHECK: comments exist); Step 4 fails
              (remaining_accounts[0] is forwarded into a CPI @ :557-558).
              Fix: #[account(address = dex::ID)] + require_keys_eq! at the CPI boundary  -> F-001
[PARTIAL]   KV-010: PDA Confusion / Type Cosplay — marker `AccountInfo` present, so the vector was opened.
              The program deserializes no account type, so there is no type to cosplay; seeds /
              find_program_address / try_deserialize are all zero-hit. Residual: the raw-byte token reads
              (lib.rs:82-83) are the same trust failure in a different shape.  -> F-004
[PARTIAL]   KV-011: Integer Overflow / Underflow — every site uses checked_* (lib.rs:98-99, 162-163,
              184-185, 191, 233, 238, 260, 272, 279, 295, 302, 310, 585), so no silent wrap is possible.
              Residual: each terminates in .unwrap(), turning detection into a panic.  -> F-003
[PARTIAL]   KV-012: Arithmetic Rounding Exploit — two floor divisions: coin_lots @ lib.rs:585 (residue
              silently unsold) and spill_surplus @ :279 (rounds DOWN, conservatively for the guard).
              No rounding accumulates in state, because the program stores nothing.  -> AR-021, AR-024
[PASS]      KV-013: Missing Signer Check — #[account(signer)] on `authority` at lib.rs:330, 352, 378, 410;
              all four instructions covered.
[N/A]       KV-014: Account Reinitialization — feature absent: init / init_if_needed / is_initialized —
              zero hits in lib.rs; init_account (:32-36) only CPIs to the DEX.
[FAIL-4]    KV-015: Unchecked Account Owner — Step 3 fails (30 raw AccountInfo fields, zero owner checks);
              Step 4 fails (no token::mint / token::authority constraint exists); Step 5 fails (the
              referral remaining account is unvalidated). The only owner check in the program is
              MarketState::load(..., &dex::ID) @ lib.rs:469 — one account, one path.  -> F-004
[FAIL-4]    KV-016: Token Account Mismatch — Step 2 fails (no mint constraint on pc_wallet :380,
              coin_wallet :622, order_payer_token_account :609); Step 3 fails (no token::authority).
              Quantified barrier: SPL Token's own Transfer enforces mint equality between vault and
              wallet at settle time, so a cross-mint payout cannot execute through the canonical DEX.
              Residual: the program's own pre/post accounting reads unvalidated accounts.  -> F-004
[N/A]       KV-017: Vault Donation Attack — feature absent: this program owns no vault; shares /
              get_token_account_balance — zero hits.
[PASS]      KV-018: Fee-on-Transfer Token Exploit — the underlying property is satisfied positively: all
              credits are measured balance deltas (lib.rs:82-83 vs :94-95), never declared amounts.
[PARTIAL]   KV-019: Freeze Authority Griefing — freeze_authority is never inspected. A frozen wallet
              aborts the caller's own swap; no protocol funds can be locked, because the program holds
              none.  -> AV-065, ECON-047
[UNCONFIRMED] KV-020: Program Upgrade Hijack — the upgrade authority cannot be read offline. In-tree
              facts: the program is not frozen by anything the repository controls, there is no timelock
              (OPS-006), and a hostile upgrade would inherit every user signature routed through the
              program (OPS-011).
[N/A]       KV-021: Governance Attack — feature absent: realm / proposal / spl-governance / vote_record /
              voter_weight — zero hits.
[N/A]       KV-022: Bridge Exploit (Fake Proof) — feature absent: guardian / vaa / emitter /
              verify_signatures / attestation — zero hits.
[N/A]       KV-023: Token-2022 Transfer Hook Attack — feature absent: token_2022 / transfer_hook /
              get_extension — zero hits; Serum v3 markets are classic-SPL only.
[PARTIAL]   KV-024: Stale / Missing Account Close — marker `close` present (close_account @ lib.rs:39-45).
              The close is performed by the DEX, not this program, and this program reads nothing
              afterwards. Residual: the unconstrained `destination` @ :354.  -> CPI-022
[PARTIAL]   KV-025: Compute Budget Exhaustion DoS — marker `panic_sites` present. limit = 65535 @
              lib.rs:525 across four CPIs in swap_transitive (:153, 154, 175, 176) is unbounded from the
              caller's side; a deep book can exhaust the budget. Self-limited — the caller pays and the
              caller's own transaction fails.  -> ECON-051, FV-051
[N/A]       KV-026: PDA Seed Collision — feature absent: seeds / find_program_address /
              create_program_address — zero hits.
[PARTIAL]   KV-027: Missing Discriminator Check — markers AccountInfo / remaining_accounts present.
              The program deserializes no discriminated account; it reads raw token bytes via
              token::accessor (lib.rs:82-83) with neither a discriminator nor an owner check — the same
              failure in a different shape.  -> F-004
[PARTIAL]   KV-028: Front-Running Transaction — markers swap / slippage present. Front-running is
              possible on any order-book trade; the mitigation (the min_exchange_rate abort @
              lib.rs:314-321) exists but is post-hoc and weakenable.  -> F-002
[PASS]      KV-029: Withdraw-Before-Update Race — the program has no state to update after the CPI, so
              there is no pre/post ordering to get wrong. Balances ARE re-read after the CPI
              (lib.rs:94-95, 157-158, 179-180).
[N/A]       KV-030: Infinite Mint / Uncapped Supply — feature absent: mint_to / supply / mint_authority /
              max_supply — zero hits; the program controls no mint.
[N/A]       KV-031..KV-055: Backend / API vectors — out of scope: backend domain under --scope program,
              and no backend, API, database or server code exists in the repository.
[N/A]       KV-056..KV-075: Frontend / client-side vectors — out of scope: frontend domain under
              --scope program, and no frontend or browser code exists in the repository.
[N/A]       KV-076..KV-090: DevOps / supply-chain vectors — out of scope: DevOps domain; --scope program
              limits the engagement to checklists 01-07 and 16. (CI and release integrity were still
              examined via the in-scope checklist-07 items OPS-064 / OPS-074 -> F-006.)
[UNCONFIRMED] KV-091: Upgrade Authority Not Secured — in scope via checklist 07 §7.1. Same evidence
              limitation as KV-020 / OPS-001: the live authority cannot be read offline. No multisig or
              timelock is referenced anywhere in the tree, and none exists in the program.
[N/A]       KV-092..KV-100: DevOps vectors — out of scope: DevOps domain under --scope program.
[PARTIAL]   KV-101: Sysvar Spoofing & Instructions-Sysvar Introspection — marker `sysvar` present via the
              rent account (lib.rs:334, 385, 418). The program never READS the sysvar, so no forged value
              can influence its logic; but rent is a raw AccountInfo rather than Sysvar<'info, Rent>, so
              its identity is asserted only by the callee.  -> AV-069
[N/A]       KV-102: Precompile Signature Verification Bypass — feature absent: ed25519 / secp256k1 /
              precompile / instructions_sysvar — zero hits.
[N/A]       KV-103: Address Lookup Table Manipulation — feature absent: address_lookup_table /
              AddressLookupTable — zero hits; the program makes no positional account assumption.
[N/A]       KV-104: Non-Canonical Bump / PDA Derivation Confusion — feature absent: bump /
              create_program_address / find_program_address — zero hits; the program derives no PDA.
[N/A]       KV-105: Token-2022 Extension Abuse — feature absent: token_2022 / get_extension /
              PermanentDelegate / ConfidentialTransfer / TransferFee — zero hits.
[N/A]       KV-106: Account Revival / Zombie After Close — feature absent for this program: it performs
              no close of its own (the close @ lib.rs:43 is a DEX CPI) and reads no account after a close.
[PARTIAL]   KV-107: Fake / Non-Canonical ATA — marker `associated_token` appears only in the comment at
              lib.rs:21 describing the `empty` sentinel (:22-25). The program never derives or enforces an
              ATA; it accepts any token account for pc_wallet / coin_wallet (:380, :622). Because the
              caller both supplies and signs for these, the ATA-substitution shape creates no third-party
              harm here. Residual: the missing token::authority binding.  -> AV-046
[FAIL-3]    KV-108: Token Decimals & Cross-Mint Amount Confusion — markers `decimals`, multi-mint present.
              File: lib.rs:700-703 — from_decimals / quote_decimals are caller-asserted, never read from
              a Mint, and scale both sides of the :314 comparison; >= 39 panics via checked_pow
              Fix: bound the fields and/or read Mint::decimals  -> F-003, AV-061
[N/A]       KV-109: Pinocchio / p-token Missing Manual Validation — feature absent: pinocchio / p-token /
              no_std — zero hits; this is an Anchor program (lib.rs:27).
[N/A]       KV-110: Agent Wallet Key Custody & Spend Caps — out of scope: AI-agent domain; no agent
              component exists in the repository.
[PASS]      KV-111: BPF Stack Frame Overflow DoS — marker `panic_sites` present, so the vector was opened.
              No large stack array and no recursion exist: no [u8; N] declaration appears, the largest
              locals are the u128 values in apply_risk_checks (lib.rs:229-311), and the MarketState load
              @ :469 is block-scoped and dropped before the CPI (:467-471).
[N/A]       KV-112: In-Memory Secret Non-Zeroization — out of scope: off-chain Rust domain; no .rs file
              exists outside programs/.
[N/A]       KV-113..KV-117: Solana x AI vectors — out of scope: AI-agent domain; no agent, MCP or LLM
              component exists in the repository.
[N/A]       KV-118: Stake Account Authority Hijack — feature absent: stake / StakeProgram / authorized /
              staker / withdrawer — zero hits.
[N/A]       KV-119: Durable-Nonce Pre-Signed Governance Abuse — feature absent: nonce / durable_nonce /
              advance_nonce / realm / proposal — zero hits; and the program has no privileged instruction
              to pre-sign.
[N/A]       KV-120: On-Chain Randomness Predictability & VRF Misbinding — feature absent: random / vrf /
              switchboard / Clock / slot_hashes / blockhash — zero hits.
[N/A]       KV-121: cNFT / Account-Compression Merkle Proof Abuse — feature absent: spl-account-compression
              / bubblegum / merkle / cNFT / proof — zero hits.
[FAIL-4]    KV-122: Inner-Instruction / Event-Log Spoofing — marker `emit` present (lib.rs:214).
              Step 4 fails: emit! fires BEFORE both error returns (:217, :320), so a DidSwap line exists
              for reverted transactions; and the event's mint fields (:110-115, :201-203) are read from
              accounts whose owner is never validated. Steps 1-3 are N/A on the consumer side — the
              repository contains no off-chain consumer — but the program is a published library whose
              event is explicitly "for client consumption" (:213).
              Fix: emit after the guards; type the accounts; document that consumers must verify against
              finalized state  -> F-004, SM-049
[PASS]      KV-123: Lamport-Donation Account Bricking — markers absent (lamports / rent-exempt check /
              try_borrow_lamports: zero hits). The program makes no lamport-balance assumption and marks
              no builtin or sysvar account mut (lib.rs:334, 383, 385, 416, 418 are all read-only).
[N/A]       KV-124: Custodial Cleartext Key Export — out of scope: custody domain; no wallet or custody
              component exists in the repository.
[N/A]       KV-125: Bonding-Curve Launchpad Graduation & Migration Abuse — feature absent: bonding_curve /
              graduate / virtual_reserves / migrate — zero hits.
[N/A]       KV-126: Session Token as Custody — out of scope: custody domain; no session or
              delegated-signing component exists.
[PASS]      KV-127: ATA / Account Pre-Creation DoS — marker `init` present via init_account (lib.rs:32),
              so the vector was opened. The open-orders account is a caller-generated keypair
              (tests/swap.js:106-114), not a derivable address, so a third party cannot front-run its
              creation.
[PASS]      KV-128: On-Chain Floating-Point Financial Math — markers absent (f32 / f64 / as f64 / .sqrt() /
              .powi(): zero hits). All value math is u64/u128 integer.
[N/A]       KV-129: Keeper Request -> Execute Front-Running & Reordering — feature absent: keeper /
              request / execute / crank / settlement two-step — zero hits; swaps are single-instruction.
[N/A]       KV-130: CLMM/DLMM Tick-Boundary & Liquidity Math — feature absent: tick / sqrt_price /
              liquidity_net / bin_array / fee_growth — zero hits; this is an order-book router.
[PARTIAL]   KV-131: Write-Lock Account Contention DoS — marker present: market, request_queue, event_queue,
              bids and asks are globally hot writable accounts (lib.rs:592-603). This is inherent to
              trading on a Serum market, not a defect introduced by this program. Residual: a transitive
              swap write-locks TWO markets' full account sets in one transaction (:407-408), doubling the
              contention surface.
[N/A]       KV-132: Canonical-Asset / Token-List Spoofing — out of scope: off-chain token-registry domain;
              no token list is consumed anywhere in the repository.
[N/A]       KV-133: Token Risk-Score / Trust-Tier Metric Farming — out of scope: off-chain risk-API domain;
              no risk API is consumed.
[N/A]       KV-134: Token ACL (SRFC-37) Gate-Program Bypass — feature absent: token_acl / TACLkU6 /
              MINT_CFG / gating_program / thaw_permissionless — zero hits.
[PASS]      KV-135: Transaction v1 Fee-Sponsor Cap Bypass & Disabled ComputeBudget Gates — the on-chain
              facet is satisfied: no require! reads ComputeBudget instructions and the Instructions sysvar
              is never touched (zero hits), so there is no gate to be silently disabled (see AV-089). The
              fee-sponsor facet is feature-absent — no sponsor, paymaster or relayer component exists.
[N/A]       KV-136: Transaction v1 Reader Wedge & Zero-Budget Indexing — out of scope: off-chain indexer
              domain; no getTransaction / getBlock / blockSubscribe / Geyser consumer exists.
```

### Audit Metrics

| Metric | Value |
|--------|-------|
| Total items evaluated | 591 |
| PASS | 82 (13.9%) |
| FAIL | 90 (15.2%) |
| PARTIAL | 46 (7.8%) |
| UNCONFIRMED | 20 (3.4%) |
| N/A | 353 (59.7%) |
| **Pass rate** (excl. N/A) | **34.5%** (82 / 238) |
| **Highest severity found** | **5** |
| **Repository Risk Score** | **5 — 🟡 MEDIUM** |

> Risk-score derivation (OUTPUT-RULES Rule 1): no finding ≥ 9 and none ≥ 7, highest finding = 5
> ⟹ `REPO SCORE = max(finding) = 5` (MEDIUM — fix soon). The Q8 "mainnet-live" severity uplift was
> **not** applied (§3.5 assumption 1) and the Q10 TVL multiplier was **not** applied (assumption 2).

### Known Vector Metrics

| Metric | Value |
|--------|-------|
| Total known vectors in corpus | 136 |
| In-scope vectors | 55 |
| PASS | 11 |
| FAIL | 6 |
| PARTIAL | 12 |
| UNCONFIRMED | 2 |
| N/A (feature absent, evidence-backed) | 24 |
| Out of scope (rendered from the scope gate) | 81 |
| Completion (in-scope) | 100% (55 / 55) |

### Per-Checklist Summary

| # | Checklist | Items | Pass | Fail | Partial | Unconf. | N/A | Pass Rate (excl. N/A) |
|---|-----------|-------|------|------|---------|---------|-----|-----------|
| 01 | Account Validation | 90 | 13 | 17 | 10 | 0 | 50 | 32.5% |
| 02 | Access Control | 50 | 14 | 4 | 4 | 0 | 28 | 63.6% |
| 03 | Arithmetic Safety | 63 | 12 | 3 | 6 | 0 | 42 | 57.1% |
| 04 | CPI & PDA | 70 | 7 | 13 | 4 | 0 | 46 | 29.2% |
| 05 | State Machine | 72 | 7 | 1 | 3 | 0 | 61 | 63.6% |
| 06 | Economic & Logic | 89 | 7 | 4 | 5 | 0 | 73 | 43.8% |
| 07 | OpSec & Governance | 85 | 10 | 17 | 11 | 20 | 27 | 17.2% |
| 16 | Formal Verification & Testing | 72 | 12 | 31 | 3 | 0 | 26 | 26.1% |
| | **Total** | **591** | **82** | **90** | **46** | **20** | **353** | **34.5%** |

---

## 7. Instruction Matrix

| Instruction | File | Signers | CPI Calls | PDA Seeds | Checked Math | State Changes | Findings |
|---|---|---|---|---|---|---|---|
| `init_account` | `lib.rs:32-36` | `authority` (`:330`) | `dex::init_open_orders` (`:34`) via unvalidated program (`:33`) | none | none | none in this program (DEX writes the open-orders account) | F-001 |
| `close_account` | `lib.rs:39-45` | `authority` (`:352`) | `dex::close_open_orders` (`:43`) via unvalidated program (`:42`) | none | none | none in this program (DEX closes the account, refunds to unconstrained `destination` `:354`) | F-001, CPI-022 |
| `swap` | `lib.rs:61-119` | `authority` (`:378`) | `dex::new_order_v3` (`:531`), `dex::settle_funds` (`:560`) — both via unvalidated program (`:527`, `:556`) | none | all `checked_*`, all `.unwrap()` (`:98-99`, `:237-310`, `:534-536`, `:585`) | none in this program; emits `DidSwap` (`:214`) | F-001, F-002, F-003, F-004 |
| `swap_transitive` | `lib.rs:137-208` | `authority` (`:411`) | `new_order_v3` ×2, `settle_funds` ×2 (`:153-154`, `:175-176`) — all via unvalidated program | none | as above, plus `:162-163`, `:184-185`, `:191` | none in this program; emits `DidSwap` (`:214`) | F-001, F-002, F-003, F-004 |

Cross-cutting observations from the matrix:

- **No instruction writes a single byte of program-owned state.** Every state effect is inside the
  Serum DEX callee. This is what caps the severity of every finding in this report.
- **No instruction uses `invoke_signed`, a PDA, or a program-held authority.** The signer on every
  CPI is the end user (`lib.rs:549`, `:574`).
- **The CPI program account is unvalidated on 4 / 4 instructions** — the single most repeated defect.
- **Only 2 / 4 instructions emit an event**, and both emit it before their guards run.

---

## 8. State Model Verification

### Account Types

| Account | Discriminator | Space | Owner | Close Target |
|---|---|---|---|---|
| *(none — the program defines no account type)* | N/A — `#[account]` appears 0 times in `lib.rs` (only `#[event]` at `:662`) | N/A | N/A | N/A |

The only persistent objects the program touches belong to other programs:

| Foreign account | Owner | Validated by this program? |
|---|---|---|
| `market.market` | Serum DEX | ✅ partially — `MarketState::load(..., &dex::ID)` @ `lib.rs:469`, **sell path only** |
| `open_orders` | Serum DEX | ❌ never (`lib.rs:595`) — forwarded into CPIs at `:547`, `:569` |
| `request_queue`, `event_queue`, `bids`, `asks` | Serum DEX | ❌ never (`lib.rs:597-603`) |
| `coin_vault`, `pc_vault`, `vault_signer` | Serum DEX / SPL Token | ❌ never (`lib.rs:613-619`) |
| `pc_wallet`, `coin_wallet`, `order_payer_token_account` | SPL Token | ❌ only the `!= empty::ID` sentinel (`lib.rs:379`, `:608`, `:621`) |

### State Machine Transitions

```
There is no state machine. The program is stateless; each instruction is a single atomic
operation with no persisted status, no lifecycle and no terminal state.

  swap:              [caller wallets] --new_order_v3--> [DEX] --settle_funds--> [caller wallets]
                     measured before (L82-83) ............................. measured after (L94-95)
                                                    |
                                                    +-- settle drains the WHOLE open-orders
                                                        free balance, not just this order's  <-- F-002

  swap_transitive:   [A wallet] --leg 1 sell--> [pc_wallet] --leg 2 buy--> [B wallet]
                     L148-163                    L170-185                   spill @ L191

  init_account:      (client creates keypair account) --init_open_orders--> [DEX-owned open orders]
  close_account:     [DEX-owned open orders] --close_open_orders--> rent to `destination` (unconstrained)
```

### Invariants Verified

| Property | Description | Status |
|---|---|---|
| INV-01 | The two mints being swapped differ | ⚠️ PARTIAL — enforced at `lib.rs:642-648` → `:651-657`, but over data read without an owner check (`:652-653`) |
| INV-02 | `to_amount > 0` — a swap that receives nothing is rejected | ✅ PASS — `lib.rs:216-218` |
| INV-03 | `to_amount · 10^from_decimals ≥ from_amount · rate` (the caller's rate bound) | ⚠️ PARTIAL — implemented at `lib.rs:314-321` and dimensionally consistent (both sides carry `dec(from)+dec(to)+dec(quote)`), but computed over deltas that include unrelated settled balances → **F-002** |
| INV-04 | Both markets in a transitive swap share one quote currency | ✅ PASS — enforced indirectly but soundly: a single `pc_wallet` (`lib.rs:412`) is the quote destination for both `settle_funds` calls, and SPL Token's `Transfer` requires matching mints, so both markets' pc vaults must share that mint |
| INV-05 | The program never signs for anything | ✅ PASS — zero `invoke_signed`, zero `seeds`, zero PDA (grep: 0 hits) |
| INV-06 | Every instruction requires the caller's signature | ✅ PASS — `lib.rs:330`, `:352`, `:378`, `:410` |
| INV-07 | Credits are computed from measured balances, not declared amounts | ✅ PASS — `lib.rs:82-83` vs `:94-95`, `:148-158`, `:170-180` |
| INV-08 | No arithmetic silently wraps | ✅ PASS — every site uses `checked_*` (but see F-003: each `.unwrap()`s) |
| INV-09 | The CPI target is the Serum DEX | ❌ **FAIL** — never asserted (`lib.rs:333`, `:357`, `:382`, `:415`) → **F-001** |
| INV-10 | Every token account belongs to the caller | ❌ **FAIL** — never asserted (`lib.rs:375-386`, `:405-419`, `:592-623`) → **F-004** |

---

## 9. Code Maturity Scorecard

> Engineering-quality gate (Phase 4.5), orthogonal to the risk score. 0 absent · 1 ad-hoc · 2 partial
> · 3 good · 4 strong (weakest-link).

| # | Category | Score (0-4) | Evidence (file:line / artifact) | Gap to next level |
|---|----------|:-----------:|---------------------------------|-------------------|
| 1 | Access Controls | **2** | All four instructions gated by `#[account(signer)]` (`lib.rs:330, 352, 378, 410`); exactly one role; no admin, no god-mode, no hardcoded privileged key | Use `Signer<'info>`; bind the token accounts to `authority` via `token::authority` |
| 2 | Arithmetic | **3** | Every site `checked_*`; `u128` widening (`lib.rs:256-287`); multiply-before-divide (`:279` is last); no float, no `as` cast, no `saturating_*`/`wrapping_*` | Replace 21 `.unwrap()`s with `.ok_or(Error)?`; bound the caller-supplied decimals |
| 3 | Account & Type Safety | **1** | Zero typed accounts, zero owner checks, zero discriminators, zero `/// CHECK:`; one owner check total (`lib.rs:469`, one path) | Type every account; add `token::mint`/`token::authority`; `Program<T>`/`Sysvar<Rent>` |
| 4 | Input Validation | **1** | Only the same-mint guard (`lib.rs:651-657`) and three `!= empty::ID` sentinels (`:379, 608, 621`); `remaining_accounts` unvalidated (`:73, 143`); decimals unbounded (`:700-703`) | Bound `rate`/decimals; validate or reject `remaining_accounts`; bind `order_payer_token_account` |
| 5 | Testing | **2** | Six integration tests against a real DEX binary covering all four instructions and four swap directions (`tests/swap.js:97, 146, 242, 291, 320, 386`) | Add negative tests; fix the `toDecimals` / `quoteDecimals` drift; replace hardcoded absolutes |
| 6 | Fuzzing & Property Tests | **0** | None — no Trident, cargo-fuzz, proptest, Kani, Certora, Mollusk or LiteSVM anywhere; no documented invariant | Add one invariant harness over `apply_risk_checks` and a decimals fuzz target |
| 7 | Error Handling & DoS Resilience | **1** | Three typed errors defined and used (`lib.rs:725-733`), CPI results propagated with `?` — but 21 `.unwrap()`s reachable from user input, and no compute bound (`:525`) | Eliminate every panic on a user-reachable path; reject sub-lot amounts cleanly |
| 8 | Upgradeability & Governance | **1** | Verifiable builds documented (`README.md:40-41`) and checksums published (`.travis.yml:16-18`) — but no timelock, no multisig evidence, no pause, no `SECURITY.md`, and the declared toolchain does not match the crate (F-005) | Publish the upgrade authority; move it to a timelocked multisig; align the build declarations |
| 9 | Monitoring & Incident Response | **1** | One event (`lib.rs:214`) on two of four instructions, emitted before its guards, lacking market identity | Emit after the guards; add market addresses; add events to `init_account`/`close_account`; publish a security contact and an IR runbook |
| **Weighted Maturity** | | **1.3 / 4.0** | mean of 2,3,1,1,2,0,1,1,1 | |

Categories scoring ≤ 1 — **3 (Account & Type Safety), 4 (Input Validation), 6 (Fuzzing & Property
Tests), 7 (Error Handling & DoS), 8 (Upgradeability & Governance), 9 (Monitoring & IR)** — are
prioritised in the roadmap below regardless of individual finding severity.

---

## 10. Remediation Roadmap

> Also written to `audit_2/roadmap.md`.

### Immediate — Severity 9-10 (Block Deploy)

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| *None* | — | — | — | — |

### Before Release — Severity 7-8

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| *None* | — | — | — | — |

### Within 2 Weeks — Severity 5-6

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| **F-001** | 5 `[UNDETERMINED]` | **Step 0 (do this first, ~15 min):** read `anchor-spl 0.19.0`'s `src/dex/mod.rs` and determine whether `new_order_v3`/`settle_funds` build the `Instruction` with `ctx.program.key` or a hardcoded `serum_dex::ID`. If the former, this is the highest-priority item in the report. **Step 1:** add `#[account(address = dex::ID)]` to all four `dex_program` fields and `require_keys_eq!` at both CPI helpers | 15 min triage + 1 h fix | Program team |
| **F-002** | 5 | Call `orderbook.settle(None)` **before** taking the "before" snapshot, so the deltas describe only this trade; and/or bind `order_payer_token_account` to the measured wallet per side. Longer term, derive a real `limit_price` from `min_exchange_rate` instead of `1` / `u64::MAX` | 1-2 days incl. tests | Program team |

### Next Sprint — Severity 3-4

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| **F-004** | 4 | Type every account: `Signer<'info>`, `Account<'info, TokenAccount>` with `token::authority = authority`, `Program<'info, Token>`, `Sysvar<'info, Rent>`. Move `emit!` after the guards | 1 day | Program team |
| **F-007** | 4 | Fix the `toDecimals` → `quoteDecimals` drift; add four negative tests (wrong signer, same mint, slippage violation, sub-lot amount); add `cargo clippy -D clippy::unwrap_used` and `cargo audit` to CI | 2-3 days | Program + DevOps |
| **F-003** | 3 | Replace all 21 `.unwrap()`s with `.ok_or(ErrorCode::Overflow)?`; add `AmountBelowLotSize` and `InvalidDecimals` errors; bound `from_decimals`/`quote_decimals` ≤ 18 and `rate` > 0 | 4 h | Program team |
| **F-005** | 3 | Set `Anchor.toml:1` to `0.19.0`; set `.travis.yml:8-9` to `v1.8.5` / `v0.19.0`; pin the `deps/serum-dex` submodule to a named release commit and document it | 1 h | DevOps |
| **F-006** | 3 | Pin every CI install (npm versions, `cargo install --rev <sha>`); verify the Solana installer hash before executing it; split the release job from the dependency-installation job; confirm the `.travis.yml:33` token is revoked | 4 h | DevOps |

### Backlog — Severity 1-2

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| AC-030 / AC-035 | 2 | No pause mechanism. **Recommendation: do not add one** — the program is stateless and non-custodial, so a pause strands nothing. Instead, document the upgrade-as-kill-switch procedure | 1 h (documentation) | Program team |
| AC-044 | 2 | No on-chain rate limit. Not required — the program holds no funds and every call costs the caller DEX taker fees. Documented for completeness | — | — |
| OPS-044/046/047/049/051/052 | 2 | Add `SECURITY.md` with a contact address and a disclosure channel; document an IR plan naming the upgrade-authority holders; add an alert on any BPF-loader upgrade of `22Y43…czD` | 1 day | Ops |
| OPS-068 | 2 | Move release credentials into a scoped secret store rather than an inline encrypted CI value | 2 h | DevOps |

### Maturity-Driven (categories scoring ≤ 1 — prioritised regardless of finding severity)

| Category | Score | Action |
|---|:--:|---|
| 6 — Fuzzing & Property Tests | 0 | Write down the three invariants from `audit_2/worksheets/context/apply_risk_checks.md`, then encode at least INV-03 as a property test or a Trident/Kani harness |
| 3 — Account & Type Safety | 1 | Covered by F-004 |
| 4 — Input Validation | 1 | Covered by F-003 (bounds) and F-004 (account binding) |
| 7 — Error Handling & DoS | 1 | Covered by F-003 |
| 8 — Upgradeability & Governance | 1 | Publish the upgrade authority; timelocked multisig or freeze; covered in part by F-005 |
| 9 — Monitoring & IR | 1 | Emit after guards, add market identity to `DidSwap`, add events to `init_account`/`close_account` |

### 10.1 Notes & Nitpicks (no security impact — not scored)

Per OUTPUT-RULES Rule 1, these are observations with no security implication. They carry no severity
and no remediation-tracking obligation.

- `programs/swap/src/lib.rs:701-702` — the doc comment on `quote_decimals` reads *"Number of decimals
  of the **to** token's mint"*, which describes the field's former name (`to_decimals`). It is stale
  and actively misleading; the field is the *quote* mint's decimals. Same rename left the tests
  passing `toDecimals` (`tests/swap.js:245`) — that half **is** tracked, under F-007.
- `programs/swap/src/lib.rs:97` — double space in the comment `//  Calculate the delta`.
- `programs/swap/src/lib.rs:522` — typo in the comment: "compute budge parameter" → "budget".
- `programs/swap/src/lib.rs:625-629`, `:693-723` — `Side` and `ExchangeRate` derive neither `Clone`
  nor `Copy`, which forces the `let mut min_exchange_rate = min_exchange_rate;` dance at `:67`.
- `programs/swap/src/lib.rs:528-530` — the `srm_msrm_discount` parameter is threaded through
  `sell`/`buy`/`order_cpi` but every call site passes `None` (`:88-89`, `:153`, `:175`). Dead
  parameter, or an unfinished fee-discount feature.
- `README.md:33` — "developoment" → "development".
- `README.md:43-47` and `:61-67` — the *Test* section is duplicated verbatim as *Run the Test*.
- `tests/utils/index.js:122-188` — `initOrderbook` is exported but never used by any test.
- `tests/utils/index.js:450` — `const acc = await connection.getAccountInfo(market.publicKey);` is
  assigned and never read.
- `tests/utils/index.js:76`, `:88`, `:169` — `MARKET_A_USDC`, `MARKET_B_USDC` and `marketClient` are
  assigned without `const`/`let`, creating implicit globals.
- `tests/swap.js:284` — `const takerFee = 0.0022;` shadows the module-level `TAKER_FEE` and is never
  used.
- `.gitignore` contains only `target/` and `.anchor/` — no `node_modules/`, no `*.env`, no keypair
  patterns. Nothing sensitive is currently tracked (`git ls-files` = 13 files), so this is a
  latent hygiene gap rather than an exposure.

---

## 11. Re-Audit Checklist

- [ ] **Resolve the F-001 dependency question first** — read `anchor-spl 0.19.0` `src/dex/mod.rs` and
      record whether the CPI dispatches on `ctx.program.key`. Re-score F-001 accordingly.
- [ ] **Check out `deps/serum-dex`** and re-run the F-002 confidence note against
      `serum_dex 0.4.0`'s `settle_funds` — does it settle the whole free balance or only this
      order's proceeds?
- [ ] All Critical findings fixed and verified — *none exist at this commit.*
- [ ] All High findings fixed and verified — *none exist at this commit.*
- [ ] Medium findings (F-001, F-002) fixed, or accepted with the risk documented in `SECURITY.md`
- [ ] Low findings (F-003 … F-007) addressed or tracked
- [ ] Regression tests added for each fix — in particular the four negative tests named in F-007
- [ ] `cargo clippy -D clippy::unwrap_used` passes with no suppressions
- [ ] `Anchor.toml`, `.travis.yml` and `programs/swap/Cargo.toml` declare the same toolchain
- [ ] Program re-deployed and verified on-chain
- [ ] Binary hash matches source code (`anchor verify` succeeds with the corrected declarations)

---

## 12. Appendices

### A. Tool Versions

```
Declared in the repository (not executed — this audit was entirely static):

  anchor-cli (Anchor.toml:1)            0.17.0      <-- inconsistent, see F-005
  anchor-cli (.travis.yml:9)            v0.17.0     <-- inconsistent, see F-005
  anchor-lang / anchor-spl (Cargo.toml) 0.19.0
  solana (.travis.yml:8)                v1.7.8      <-- inconsistent, see F-005
  solana-program (Cargo.toml:23)        =1.8.5
  node (.travis.yml:7)                  v14.7.0
  rust (.travis.yml:3)                  stable
  serum_dex (Cargo.lock)                0.4.0
  spl-token (Cargo.lock)                3.2.0

Auditor tooling:
  auditor-skill                         7.3.0@6bb2cbf
  audit-scan / audit-mem prescan        not available in this environment — the instruction,
                                        account-constraint, PDA-seed, arithmetic and CPI tables in
                                        §7-§8 were built by hand from a full read of lib.rs
```

### B. Environment

```
OS:              Linux 6.6.87.2-microsoft-standard-WSL2
Analysis mode:   static, read-only. No build, install, test or execution was performed.
                 cargo / npm / pnpm / yarn / pip / python / node / make / curl / wget were blocked
                 by the engagement constraints, and no network access was used.
Cluster tested:  none — no program was deployed, simulated or executed
RPC provider:    none
Git state:       detached HEAD at 001a4ca2204ab11741d5392a03d998a6dd12dd59; clone depth 1
Submodules:      deps/serum-dex declared but NOT checked out (empty directory)
```

### C. Coverage Limitations (read this alongside §3.5)

1. **The CPI callee was never read.** `deps/serum-dex` is empty and no crate source is on the host.
   Every verdict that depends on Serum DEX behaviour says so explicitly, and the two most important
   such dependencies are called out at F-001 (Step 0 of the roadmap) and F-002 (Confidence note).
2. **No on-chain state was read.** The 20 `[UNCONFIRMED]` verdicts in checklist 07 are all of this
   kind — upgrade authority, multisig configuration, key custody, branch protection. None is a
   clean bill of health; each is an unanswered question.
3. **No executable proof-of-concept was built.** All findings carry `[PoC-PROSE]` evidence —
   structured attacker narratives, which OUTPUT-RULES Rule 5b accepts as first-class for
   access-control and logic findings. Building a Mollusk/LiteSVM harness would raise F-001 and
   F-002 to `[PoC-REPRODUCED]` and is the recommended next step if either is disputed.
4. **Checklists 08-15 and 17-20 were never read**, per the `--scope program` gate. The repository
   contains no TypeScript, Python, Go, Java, Ruby, PHP or off-chain Rust, so 08-10, 14, 15 and 20
   would render N/A on evidence in a FULL-scope run as well; 11-13 and 17-18 would not, and a
   FULL-scope re-run would add genuine coverage there.

### D. Disclaimer

This audit report is provided as-is. It represents a point-in-time review of the codebase at commit
`001a4ca2204ab11741d5392a03d998a6dd12dd59`. No guarantee is made that all vulnerabilities have been
found. This is audit-shaped automation — a rigorous first pass — and is **not** a substitute for a
human firm audit; it does not issue a "safe to deploy" guarantee, and it is not financial or legal
advice. Pair it with human review for business-logic, economic-model and legal-compliance
questions, and resolve the two named dependency questions in §C before relying on the severity
assigned to F-001 or F-002.








