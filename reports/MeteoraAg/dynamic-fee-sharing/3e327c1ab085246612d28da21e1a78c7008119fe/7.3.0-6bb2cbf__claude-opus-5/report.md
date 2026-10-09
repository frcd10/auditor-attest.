# 🔒 Security Audit Report

## 1. Executive Summary

**Repository:** MeteoraAg/dynamic-fee-sharing
**Commit:** `3e327c1ab085246612d28da21e1a78c7008119fe` (short: `3e327c1` — "Release 0.1.2 (#15)")
**Branch:** detached HEAD at the `main` tip
**Date:** 2026-09-11
**Auditor:** auditor-skill 7.3.0@6bb2cbf — autonomous agent, corpus Mode 1 (FULL repository audit, linear/solo)
**Scope:** PROGRAM (`--scope program`)
**Program ID:** `dfsdo2UqvwfN8DuUVrMRNfQe11VaiNoKcMqLHVvDPzh` (`lib.rs:15`, `Anchor.toml:11`, `README.md:5` — all three agree)
**Languages Detected:** Rust (Anchor 1.0.2 / Solana 3.1.10), TypeScript (LiteSVM test harness — read for intent and coverage, not audited under checklists 08–10), TOML / YAML / JSON (configuration)
**Repository Risk Score:** **7 — 🟠 HIGH (fix first)**

### What We Found

`dynamic-fee-sharing` is a small, disciplined Anchor program (≈720 lines of Rust across 15 files) that splits externally-claimed Meteora fees pro-rata among 2–5 addresses fixed at vault creation. Its core accounting is sound: all arithmetic is checked, the Q64.64 accumulator rounds toward the vault in both directions so the vault can never become insolvent, shares are immutable (which structurally eliminates the entire reward-debt-rescaling bug class), there is no `init_if_needed`, no `unsafe`, no floating point, and no `unwrap()` on any user-reachable path.

The one material issue is in `fund_by_claiming_fee`, the instruction that lets a share holder pull fees in by having the `fee_vault` PDA sign a CPI into DAMM v2 or Dynamic Bonding Curve. That CPI's instruction data and account list are supplied **entirely by the caller**; the program constrains only the target program ID, an 8-byte discriminator, and **one** account at a hardcoded index. For the four whitelisted actions that move two tokens, the *second* token's destination is therefore attacker-chosen — so any single share holder can route 100% of the non-vault-mint fee stream to their own token account, taking value that economically belongs to all holders (**F-001, severity 7**). The code documents this as "by design" (`constants.rs:14-17`), and the repository's own reference client does exactly this (`tests/common/dfs.ts:323-329` sends the base token to whoever signs) — but in a vault whose whole purpose is to let mutually-distrusting parties share a fee stream, it is a real and cheap value-diversion path.

Two medium issues follow from the same area and from mint handling: the whitelist's granularity leaves the PDA's signature bound only to `(program, discriminator)` rather than to a concrete instruction (**F-002**), and accepted mints are never checked for a live `freeze_authority`, so a third party can freeze `token_vault` and permanently deadlock every claim with no recovery instruction anywhere in the program (**F-003**). The remainder are low/informational: unpinned third-party GitHub Actions, a silent zero-delta return path that leaves a diverting call with no event trace, verification gaps (clippy installed but never run; no authorization-negative tests; two "Full flow" tests that pass when the transaction fails), no emergency stop, a dead `owner` field with no close or sweep path, unvalidated reserved padding, and an unresolved question left in the parameter validator.

**Deployment guidance:** this is not a "block deploy" finding set — nothing here permits a permissionless drain of the vault balance. But F-001 should be fixed before the program is relied upon for any fee stream whose non-quote-token side carries value, because it is exploitable in a single transaction by a legitimate participant with no capital.

### Severity Distribution

| Score | Label | Count |
|-------|-------|-------|
| 10 | 🔴 CRITICAL | 0 |
| 9 | 🔴 CRITICAL | 0 |
| 8 | 🟠 HIGH | 0 |
| 7 | 🟠 HIGH | 1 |
| 6 | 🟡 MEDIUM | 0 |
| 5 | 🟡 MEDIUM | 2 |
| 4 | 🔵 LOW | 1 |
| 3 | 🔵 LOW | 3 |
| 2 | ⚪ INFO | 2 |
| 1 | ⚪ INFO | 1 |
| **Total Findings** | | **10** |

### Items Verified

| Metric | Count |
|--------|-------|
| Total checklist items (in scope) | 591 |
| PASS | 209 |
| FAIL | 37 |
| PARTIAL | 68 |
| N/A | 245 |
| UNKNOWN (not observable offline) | 32 |
| Completion | 100% (591 / 591) |

> **How the two tables relate.** *Severity Distribution* counts **finding blocks** (§4) — 10 of them.
> *Items Verified* counts **checklist item verdicts** (§5); several items share a root cause and map to
> the same finding block (e.g. AV-032/AV-033/AV-034/AC-009/CPI-012/PDA-019/ECON-033/ECON-036/KV-016 all
> record F-001). The 37 item-level FAILs de-duplicate to the 10 findings above.

---

## 2. Scope Coverage

> `--scope program` was supplied explicitly on the engagement, so the corpus scope gate (OUTPUT-RULES Rule 0 / FULL-AUDIT "Scope Control") loads checklists **01–07 and 16**. Out-of-scope checklists were **never read**; their items render `[N/A — out of scope]` from the gate, not from file inspection.

| Checklist / vector group | In scope? | Items evaluated / total | Trigger / reason |
|---|---|---|---|
| 01 Account Validation | Yes | 90 / 90 | `.rs` + `Anchor.toml` |
| 02 Access Control | Yes | 50 / 50 | `.rs` + `Anchor.toml` |
| 03 Arithmetic Safety | Yes | 63 / 63 | `.rs` + `Anchor.toml` |
| 04 CPI & PDA Safety | Yes | 70 / 70 | `.rs` + `Anchor.toml` |
| 05 State Machine & Lifecycle | Yes | 72 / 72 | `.rs` + `Anchor.toml` |
| 06 Economic & Logic | Yes | 89 / 89 | `.rs` + `Anchor.toml`; protocol handles user funds (intake Q17) |
| 07 OpSec & Governance | Yes | 85 / 85 | PROGRAM scope includes operations |
| 16 Formal Verification & Testing | Yes | 72 / 72 | PROGRAM scope includes verification |
| 08–10 off-chain (TS / backend / web) | No | 0 / 279 | OUT-OF-SCOPE (`--scope program`). The only TypeScript in the repo is the LiteSVM test harness (`tests/**`); there is no backend and no frontend. |
| 11 Supply Chain | No | 0 / 52 | OUT-OF-SCOPE (`--scope program`). Partially compensated: checklist 07 §7.8 (OPS-069..075) covers dependency pinning and pipeline integrity, and KV-080 was pulled in (see below). |
| 12 Secrets & Key Management | No | 0 / 53 | OUT-OF-SCOPE (`--scope program`). Partially compensated by checklist 07 §7.3 (OPS-027..036). |
| 13 Deployment & Infrastructure | No | 0 / 89 | OUT-OF-SCOPE (`--scope program`). Partially compensated by checklist 07 §7.1/§7.7. |
| 14 Python Safety | No | 0 / 82 | OUT-OF-SCOPE — no `.py` file exists in the repository. |
| 15 General Language Safety | No | 0 / 88 | OUT-OF-SCOPE — no Go / Java / Ruby / PHP file exists. |
| 17 Logging, Monitoring & IR | No | 0 / 65 | OUT-OF-SCOPE (`--scope program`). Partially compensated by checklist 07 §7.5 (OPS-044..052) and checklist 05 §5.6 (SM-047..050). |
| 18 Privacy, Compliance & Change Mgmt | No | 0 / 60 | OUT-OF-SCOPE (`--scope program`). No PII is handled — Solana pubkeys only. |
| 19 AI Agent Security | No | 0 / 33 | OUT-OF-SCOPE — no `.mcp.json`, no agent SDK, no LLM dependency (grep: zero hits). No `CLAUDE.md` / `AGENTS.md` / `.cursorrules` exists in the tree (both are listed in `.gitignore:14` but absent). |
| 20 Rust Off-Chain Services | No | 0 / 21 | OUT-OF-SCOPE (`--scope program`). The only `.rs` outside `programs/` is `libs/damm-v2/src/lib.rs` and `libs/dynamic-bonding-curve/src/lib.rs` — 5 lines each, containing only `declare_program!` CPI shims with no logic. Nothing is lost by the exclusion. |
| **KV crypto / on-chain (1–30)** | Yes | 30 / 30 | Phase 1 + Phase 3.1, Rust/Anchor |
| **KV backend (31–55)** | No | 0 / 25 | OUT-OF-SCOPE — no backend |
| **KV frontend (56–75)** | No | 0 / 20 | OUT-OF-SCOPE — no frontend |
| **KV devops (76–100)** | Partial | 2 / 25 | OUT-OF-SCOPE as a group (checklists 11–13 not loaded), **except** KV-080 (CI/CD pipeline injection) and KV-091 (upgrade authority not secured), which are pulled in because checklist 07 §7.1 and §7.7–7.8 — in scope under PROGRAM — cover exactly those surfaces and the repository ships CI workflows. |
| **KV on-chain modern (101–109)** | Yes | 9 / 9 | Rust/Anchor, Token-2022, PDA |
| **KV AI + off-chain Rust (110–117)** | No | 0 / 8 | OUT-OF-SCOPE — checklists 19/20 not loaded; no agent, no off-chain Rust service |
| **KV governance & randomness (118–120)** | Yes | 3 / 3 | On-chain group |
| **KV modern on-chain / custody (121–126)** | Partial | 4 / 6 | 121, 122, 123, 125 in scope (on-chain). 124 (custodial key export) and 126 (session token as custody) are OUT-OF-SCOPE — custody/off-chain domain, no wallet or session component exists. |
| **KV DoS / float / keeper / CLMM (127–131)** | Yes | 5 / 5 | On-chain group |
| **KV token registry (132–134)** | Partial | 1 / 3 | 134 (Token ACL) in scope — Token-2022 surface. 132/133 OUT-OF-SCOPE — no token list / risk API is consumed anywhere (intake Q18/Q22). |
| **KV transaction v1 (135–136)** | Partial | 1 / 2 | 135 in scope for its on-chain half (ComputeBudget gating / `load_instruction_at`). 136 OUT-OF-SCOPE — reader/indexer domain; no `getTransaction` / `getBlock` / Geyser consumer exists. |

### Scope Metrics

| Metric | Count |
|---|---:|
| In-scope checklist items | 591 |
| Items with a verdict | 591 |
| Out-of-scope checklist items (rendered from the gate) | 822 |
| In-scope known-vectors | 55 |
| Known-vectors with a verdict | 55 |
| Out-of-scope known-vectors (rendered from the gate) | 81 |
| **Completion (in-scope)** | **100%** |

---

## 3. Scope & Methodology

### Method

Corpus Mode 1, executed linearly by a single agent with no subagents. Every file listed below was read in full before any verdict was recorded (OUTPUT-RULES Rule 3). Phase 0.5 context worksheets were produced for all five instruction handlers before any `[FAIL-N≥6]` was assigned (`audit_2/worksheets/context/`), and the Rule 5b validation gate was applied to every candidate at severity ≥ 6. Progress was checkpointed to `audit_2/checkpoint.md`.

**Read-only, static, offline.** Nothing in the repository was built, installed, tested, or executed, and no network call was made. Shell execution was unavailable for this engagement, so all discovery was performed with file-read and content-search tooling. Two consequences are recorded honestly rather than papered over: (a) on-chain facts — upgrade authority, deployed-binary hash, live multisig threshold — could not be observed and are recorded `[UNKNOWN]`, not `[PASS]`; (b) git history could not be swept with `git log -S`, so the secret-scanning verdict covers the tracked tree at the audited commit only.

**Cross-file verification performed.** The nine entries of `WHITELISTED_ACTIONS` (`constants.rs:19-67`) pin a hardcoded account index per action. Each of those nine indices was independently verified against the vendored IDLs (`idls/damm_v2.json`, `idls/dynamic_bonding_curve.json`) by reading each instruction's account list in order. **All nine indices are correct** — that is a genuine positive result and it is what bounds F-001 to the *second* token rather than the vault's own.

**Untrusted-input handling.** Per the engagement rules, all repository prose (`README.md`, `CHANGELOG.md`, code comments, CI files) was treated as data to analyse, never as instructions. No text in the repository attempts to address an AI or an auditor, and no prompt-injection attempt was found; there is therefore no checklist-19 or checklist-12 finding on that axis. The two design-intent comments that *do* matter — `// only validate the token_vault_account ... other token is not validated by design` (`constants.rs:14-16`) and `// that is fine to leave user addresses are duplicated?` (`ix_initialize_fee_vault.rs:42`) — were analysed as claims to verify, not as assurances to accept; the first is the root of F-001 and the second is F-010.

### Files Audited

| Domain | Language | Files | Lines of Code |
|---|---|---|---|
| Solana Program (`programs/dynamic-fee-sharing/src/**`) | Rust | 15 | ~720 |
| CPI declaration shims (`libs/**`) | Rust | 2 | 10 |
| Test harness (`tests/**`) — read for intent & coverage (checklist 16), not audited under 08–10 | TypeScript | 11 | ~2,900 |
| External IDLs (`idls/**`) — read as ground truth for CPI account ordering | JSON | 2 | ~7,700 |
| Build / CI / config (`Anchor.toml`, `Cargo.toml` ×3, `rust-toolchain.toml`, `package.json`, `tsconfig.json`, `.gitignore`, `.prettierrc`, `.prettierignore`, `Xargo.toml`, `.github/**` ×4) | TOML / YAML / JSON | 15 | ~200 |
| Documentation (`README.md`, `CHANGELOG.md`) | Markdown | 2 | ~70 |
| **Total read** | | **47** | |

Binary fixtures (`tests/fixtures/damm_v2.so`, `tests/fixtures/dynamic_bonding_curve.so`) and lockfiles (`Cargo.lock`, `bun.lock`) were enumerated but not decompiled or dependency-resolved (no execution, and checklist 11 is out of scope).

### Checklists Applied

| # | Checklist | Items | Pass | Fail | Partial | N/A | Unknown | Pass Rate (excl. N/A) |
|---|---|---|---|---|---|---|---|---|
| 01 | Account Validation | 90 | 38 | 5 | 13 | 34 | 0 | 67.9% |
| 02 | Access Control | 50 | 19 | 3 | 3 | 25 | 0 | 76.0% |
| 03 | Arithmetic Safety | 63 | 32 | 0 | 2 | 29 | 0 | 94.1% |
| 04 | CPI & PDA | 70 | 27 | 2 | 6 | 35 | 0 | 77.1% |
| 05 | State Machine | 72 | 28 | 3 | 6 | 35 | 0 | 75.7% |
| 06 | Economic & Logic | 89 | 24 | 5 | 6 | 54 | 0 | 68.6% |
| 07 | OpSec & Governance | 85 | 21 | 4 | 9 | 19 | 32 | 31.8% |
| 08 | TypeScript Safety | 64 | — | — | — | 64 | — | out of scope |
| 09 | Backend Security | 131 | — | — | — | 131 | — | out of scope |
| 10 | Frontend Security | 84 | — | — | — | 84 | — | out of scope |
| 11 | Supply Chain | 52 | — | — | — | 52 | — | out of scope |
| 12 | Secrets & OpSec | 53 | — | — | — | 53 | — | out of scope |
| 13 | Deployment & Infra | 89 | — | — | — | 89 | — | out of scope |
| 14 | Python Safety | 82 | — | — | — | 82 | — | out of scope |
| 15 | General Language | 88 | — | — | — | 88 | — | out of scope |
| 16 | Formal Verification & Testing | 72 | 20 | 15 | 23 | 14 | 0 | 34.5% |
| 17 | Logging, Monitoring & IR | 65 | — | — | — | 65 | — | out of scope |
| 18 | Privacy, Compliance & Change Mgmt | 60 | — | — | — | 60 | — | out of scope |
| 19 | AI Agent Security | 33 | — | — | — | 33 | — | out of scope |
| 20 | Rust Off-Chain Services | 21 | — | — | — | 21 | — | out of scope |
| | **In-scope total** | **591** | **209** | **37** | **68** | **245** | **32** | **60.4%** |
| | **Corpus total** | **1413** | | | | | | |

> Checklist 07's low pass rate is dominated by 32 `[UNKNOWN]` verdicts: upgrade-authority custody, multisig configuration, monitoring, and git-history integrity are operational facts that a read-only offline review of a source tree cannot observe. They are recorded as UNKNOWN rather than PASS per OUTPUT-RULES Rule 10, and all of them are rolled up into the nine client questions in §10.C.
> Checklist 16's profile is the opposite: it is genuinely weak. Fifteen FAILs and twenty-three PARTIALs reflect a test suite that covers the happy path well and the adversarial path barely — see F-006.

### Assumptions

Applied non-interactively from `QUESTIONS.md` defaults and persisted in full at `audit_2/intake.md` §8. The severity-bearing ones:

1. **Deployment status unconfirmed.** `README.md:5` publishes a program ID (implying a deployment) while `Anchor.toml:17` pins `cluster = "localnet"`. The QUESTIONS.md "mainnet-live ⇒ +1 severity on fund-related findings" uplift was **withheld**. If the program is live on mainnet, F-001 reads as severity 8 and F-002/F-003 as 6.
2. **TVL unknown.** No double-weighting of criticals; the risk score is a plain `max(severity)`.
3. **Upgradeability unverified.** Assumed upgradeable with an unknown authority. The "single wallet ⇒ auto-flag severity 8+" lever was **not** applied because the precondition is unconfirmed; it is recorded as `[UNKNOWN]` at OPS-001..012 and as maturity category #8 = 1 instead.
4. **First audit.** No prior-fix assumptions; every guard was verified from source.
5. **DAMM v2 and Dynamic Bonding Curve are out of scope.** Their source is not in this repository — only their IDLs are vendored. Every verdict that depends on those programs enforcing their own account relationships (pool ↔ config ↔ position ↔ signer) is stated as depending on that, and it is the substance of F-002.
6. **Severity is calibrated to a mutual-distrust trust model.** The intake records share holders as *untrusted peers* (`audit_2/intake.md` §6) — the premise of a fee-sharing vault. F-001's severity follows from that; under a trust model where all share holders are the same legal entity it would be an informational note instead.

---

## 4. Findings

> Full blocks for every finding. Rule 5b gate blocks (Reachability / Math-State-Bounds / Attacker-Model) are filled for F-001 (severity 7); F-002 and F-003 carry abbreviated reachability evidence although the gate does not require it below severity 6.

---

#### [F-001] Unvalidated second-token destination in `fund_by_claiming_fee` lets any single share holder divert the whole non-vault-mint fee stream

| Field | Value |
|---|---|
| **Severity** | 7 — 🟠 HIGH |
| **Checklist Item** | AV-034 (primary); also AV-032, AV-033, AC-009, CPI-012, PDA-019, ECON-033, ECON-036, KV-016 |
| **Category** | Access Control / CPI Parameter Validation |
| **Language** | Rust |
| **File** | `programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:25-41` (the gate) and `:93-126` (the CPI); `programs/dynamic-fee-sharing/src/constants.rs:14-67` (the whitelist table) |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` — structured attacker narrative; no executable harness was built (the engagement is read-only and non-executing). |

**Description:**

`fund_by_claiming_fee` makes the `fee_vault` PDA sign an arbitrary instruction against DAMM v2 or Dynamic Bonding Curve. The authorization gate is `is_support_action` (L25-41):

```rust
for &(program, disc, token_vault_index) in WHITELISTED_ACTIONS.iter() {
    if program.eq(source_program) && disc.eq(discriminator) {
        if let Some(token_vault_account) = remaining_accounts.get(token_vault_index) {
            return token_vault.eq(token_vault_account.key);   // L36 — ONE account checked
        }
    }
}
false
```

Exactly one account is validated: the slot at the action's hardcoded `token_vault_index` must be the vault's own token account. Every other entry of `ctx.remaining_accounts` is copied verbatim into the CPI (L93-110) and the instruction data is the caller's `payload` unchanged (L122). `validate_payload` (L43-56) constrains exactly one argument of exactly one action (`ClaimReward.skip_reward`).

Four of the nine whitelisted actions move **two** tokens, and only the vault-mint side is pinned. The unpinned side — verified against the vendored IDLs — is:

| Whitelisted action | Pinned index (correct) | **Unpinned** value-receiving index |
|---|---|---|
| damm_v2 `claim_position_fee` | 4 = `token_b_account` | **3 = `token_a_account`** (`idls/damm_v2.json:156-162`) |
| DBC `claim_creator_trading_fee` | 3 = `token_b_account` | **2 = `token_a_account`** (`idls/dynamic_bonding_curve.json:32-40`) |
| DBC `claim_creator_trading_fee2` | 3 = `token_b_account` | **2 = `token_a_account`** (`:132-138`) |
| DBC `claim_trading_fee` | 4 = `token_b_account` | **3 = `token_a_account`** (`:395-401`) |
| DBC `claim_trading_fee2` | 4 = `token_b_account` | **3 = `token_a_account`** (`:496-502`) |

The code labels this intentional: *"only validate the token_vault_account for the FeeVault.token_mint / for action with two tokens, other token is not validated by design"* (`constants.rs:14-16`). The repository's own reference client implements the diversion as the normal path — `claimDbcCreatorTradingFee` builds the token-A account as **the signer's own ATA** (`tests/common/dfs.ts:323-329`), and `claimDammV2Fee` sends token A to a caller-chosen `owner` (`tests/common/dfs.ts:115-120`).

The design decision is coherent only under a trust model where all share holders are the same party. The vault's stated purpose is the opposite: `initialize_fee_vault` takes 2–5 distinct addresses with distinct shares, and no instruction can ever change them. Under that model, a token stream that the vault's position earns but that no share holder can audit or claim proportionally is a value-diversion path available to whichever holder submits the transaction first.

**Impact:**

Any one of the ≤5 registered share holders can, in a single transaction and at no capital cost, capture 100% of the token-A / base-token fees accrued to every position the fee vault controls, instead of the `share_i / total_share` fraction they are entitled to. The caller additionally controls the corresponding `max_*` argument (`max_amount_a`, `max_base_amount`), so they can set the quote-side maximum to `0` and the base-side maximum to `u64::MAX` — extracting the base token while moving nothing into the vault. Because `claimed_amount` is then `0`, the program credits nothing, emits nothing, and returns `Ok(())` (L134-146, finding F-005), so the diversion leaves **no trace in this program's event stream**. The operation is repeatable every time fees accrue and can be used to front-run an honest share holder's funding call.

*Explicit uncertainty (Rule 5b):* the missing check is provable at `ix_fund_by_claiming_fee.rs:36` and the diversion path is fully proven from source and from the vendored IDLs. What is **not** determined within this assessment is the fiat magnitude — that equals the token-A/base-token fee accrual of whatever DAMM v2 / DBC positions Meteora actually assigns to a fee vault, which requires on-chain data this offline review did not have. For pool configurations whose fees accrue entirely on the quote side, the extractable amount is zero. **Extent not determined within this assessment.**

**Rule 5b — Reachability**

```
- Entry point: dynamic_fee_sharing::fund_by_claiming_fee @ lib.rs:38 -> ix_fund_by_claiming_fee.rs:58
- Signer / authority required: share holder — signer must appear in fee_vault.users[..].address
    @ ix_fund_by_claiming_fee.rs:80-83 -> state/fee_vault.rs:123-127
- Preconditions to reach the vulnerable line:
    * fee_vault.fee_vault_type == 1 (PDA-derived vault) @ ix_fund_by_claiming_fee.rs:86-89
    * the fee_vault PDA is the creator / fee_claimer / position-NFT owner of a DAMM v2 or DBC pool
      (the intended deployment — exercised at tests/claim_dbc_creator_trading_fee.test.ts:480-512
      and tests/claim_damm_v2.test.ts:91-103)
    * the pool has unclaimed token-A / base-token fees
- Guard analysis:
    * is_support_action @ L25-41 — validates program ID, discriminator, and remaining_accounts[idx]
      ONLY. Returns on the first program+disc match (L36); no loop continues to check other accounts.
    * validate_payload @ L43-56 — constrains only damm_v2 ClaimReward's skip_reward byte (L52).
      No argument of any other action is bounded.
    * has_one = token_vault @ L12 — pins the vault's own account, not the second token's.
    * No constraint anywhere requires remaining_accounts[i] for i != token_vault_index to be
      owned by, or associated with, the fee vault.
- Verdict: REACHABLE
```

**Rule 5b — Math / State-Bounds**

```
- Vulnerable transition: `return token_vault.eq(token_vault_account.key);` @ L36 authorises the
  whole instruction on the strength of a single account comparison; `invoke_signed(&Instruction{
  program_id, accounts, data: payload.clone() }, &account_infos, &[signer_seeds])` @ L118-126
  then executes with the caller's accounts and the caller's bytes.
- Input domain: remaining_accounts[i] for every i != token_vault_index is any account the caller
  can name; payload[8..] is any byte string (payload.len() >= 8 enforced @ L62).
- Boundary that breaks: for DBC claim_trading_fee, the pinned index is 4 (token_b_account) while
  index 3 (token_a_account) is free. Setting remaining_accounts[3] = attacker-owned ATA of the
  base mint and payload args to (max_amount_a = u64::MAX, max_amount_b = 0) yields a CPI that
  moves the entire base-token fee balance to the attacker and zero quote to the vault.
- Worked case: a vault with users = [(Eve, 100), (Alice, 900)], total_share = 1000, holding a DBC
  partner position with 1_000_000 base-token units and 500_000 quote-token units of accrued fees.
    Eve's entitlement: 100/1000 = 10% of both streams.
    Eve calls fund_by_claiming_fee(payload = disc || u64::MAX || 0u64) with
      remaining_accounts[3] = Eve's base-mint ATA, remaining_accounts[4] = token_vault.
    DBC transfers 1_000_000 base units to Eve and 0 quote units to token_vault.
    before_token_vault_balance == after_token_vault_balance  (L91, L130)
    claimed_amount = 0 (L132) -> the `if claimed_amount > 0` branch @ L134 is skipped
    -> fee_per_share unchanged, total_funded_fee unchanged, no EvtFundFee emitted, Ok(()) @ L146.
    Eve captured 1_000_000 base units where she was owed 100_000. Alice's 900_000 is gone.
- Net effect: 100% of the non-vault-mint fee accrual is transferred out of the shared pool to one
  holder; the vault's own accounting is untouched because it never observed the transfer.
  Quantified in vault-mint terms: 0. Quantified in base-token terms: the full accrued balance.
  Fiat magnitude: extent not determined within this assessment (see Impact).
```

**Rule 5b — Attacker-Model**

```
- Capability: one of <= 5 registered share holders — a legitimate, mutually-distrusting participant,
  not a privileged admin. No capital, no flash loan, no co-signer required.
- Capital / setup cost: one transaction (~5,000 lamports) plus an ATA for the base mint
  (~0.00204 SOL rent, reclaimable by closing the account).
- Profit / damage: the entire accrued token-A / base-token fee balance of every position the vault
  controls, minus the attacker's own pro-rata entitlement to it.
- Atomicity: single transaction. Repeatable on every accrual. Front-runnable against an honest
  share holder's funding call (the honest call and the hostile call differ only in one account
  and two argument words).
- Net: PROFITABLE. Severity derivation: impact 8 (partial drain of protocol-managed value with a
  specific precondition), capped to 7 by Rule 1's "privilege required" lever — the path is
  role-gated to the registered roster. The cap is deliberately small because that role is
  explicitly untrusted in the protocol's own trust model (audit_2/intake.md §6).
```

**Proof of Concept:**

```
Actor:      Eve — registered share holder, users[0] = (Eve, share = 100) of total_share = 1000.
Capability: signs one transaction. No capital.
Setup:      A DBC virtual pool whose config.fee_claimer is the fee_vault PDA (the intended
            deployment — see tests/claim_dbc_creator_trading_fee.test.ts:480-486). Trading has
            accrued partner fees on both sides: 1_000_000 base units, 500_000 quote units.
            The fee vault's token_mint is the QUOTE mint, so token_vault can only receive quote.

1. Eve creates (or reuses) an ATA for the pool's BASE mint, owned by herself.        [off-chain]

2. Eve builds the payload for DBC `claim_trading_fee`:
       payload = discriminator(claim_trading_fee)            // 8 bytes, whitelisted
               || max_amount_a = u64::MAX                    // take ALL base-token fees
               || max_amount_b = 0                           // take NO quote-token fees

3. Eve builds remaining_accounts in DBC's declared order
   (idls/dynamic_bonding_curve.json:383-457), substituting index 3:
       [0] dbc_pool_authority
       [1] config
       [2] pool
       [3] EVE'S OWN BASE-MINT ATA        <-- UNVALIDATED. The program never looks at this slot.
       [4] token_vault                    <-- validated @ ix_fund_by_claiming_fee.rs:36
       [5] base_vault   [6] quote_vault   [7] base_mint   [8] quote_mint
       [9] fee_vault                      <-- marked is_signer by the program @ L97
       [10] token_base_program  [11] token_quote_program  [12] event_authority  [13] dbc_program

4. Eve calls dynamic_fee_sharing::fund_by_claiming_fee(payload), signing as `signer`.

   Guards traversed:
     L62  payload.len() >= 8                                             -> passes
     L66  is_support_action(DBC, claim_trading_fee, token_vault, ra)     -> passes: ra[4] == token_vault
     L76  validate_payload(...)                                          -> passes: not damm_v2 ClaimReward
     L80  is_share_holder(Eve)                                           -> passes: Eve is users[0]
     L86  fee_vault_type == 1                                            -> passes
     L118 invoke_signed(..., &[fee_vault_seeds])                         -> DBC executes

5. DBC, seeing the fee_vault PDA signature as `fee_claimer`, transfers:
       base_vault  -> ra[3] (Eve's ATA):     1_000_000 units
       quote_vault -> ra[4] (token_vault):           0 units   (max_amount_b = 0)

6. Back in dynamic_fee_sharing:
       L128 token_vault.reload()
       L132 claimed_amount = after - before = 0
       L134 `if claimed_amount > 0` is FALSE -> no fund_fee(), no emit_cpi!
       L146 Ok(())

Outcome:    Eve holds 1_000_000 base units. Her entitlement was 100_000 (10%).
            Alice's 900_000 is unrecoverable — nothing in the program tracks it.
            dynamic_fee_sharing emitted no event; only DBC's own event records the transfer.
            Repeat on every accrual.
```

**Recommendation:**

Pin **every** value-receiving account of every whitelisted action, not just the vault-mint one. The table already carries a per-action index; widen it to a slice and add a second vault-controlled destination.

```rust
// constants.rs — carry every value-receiving index, not one.
pub struct WhitelistedAction {
    pub program: Pubkey,
    pub discriminator: &'static [u8],
    /// Index of the account that MUST equal FeeVault.token_vault.
    pub vault_token_index: usize,
    /// Indices of every OTHER account this instruction can move value to.
    /// Each must equal an account the fee vault controls.
    pub other_value_indices: &'static [usize],
}

pub static WHITELISTED_ACTIONS: [WhitelistedAction; 9] = [
    WhitelistedAction {
        program: damm_v2::ID,
        discriminator: damm_v2::client::args::ClaimPositionFee::DISCRIMINATOR,
        vault_token_index: 4,          // token_b_account
        other_value_indices: &[3],     // token_a_account — previously unconstrained
    },
    // ... DBC ClaimCreatorTradingFee{,2}: vault 3, other &[2]
    // ... DBC ClaimTradingFee{,2}:        vault 4, other &[3]
    // ... single-token actions:           other_value_indices: &[]
];
```

```rust
// ix_fund_by_claiming_fee.rs — add a second, vault-owned destination to the context and pin it.
#[account(
    mut,
    constraint = secondary_token_vault.owner == const_pda::fee_vault_authority::ID
        @ FeeVaultError::InvalidUserAddress,
)]
pub secondary_token_vault: Option<Box<InterfaceAccount<'info, TokenAccount>>>,

fn is_support_action(
    source_program: &Pubkey,
    discriminator: &[u8],
    token_vault: Pubkey,
    secondary_token_vault: Option<Pubkey>,
    remaining_accounts: &[AccountInfo],
) -> bool {
    for action in WHITELISTED_ACTIONS.iter() {
        if !action.program.eq(source_program) || !action.discriminator.eq(discriminator) {
            continue;
        }
        // 1. the vault-mint destination must be our own token_vault
        let Some(acc) = remaining_accounts.get(action.vault_token_index) else { return false };
        if !token_vault.eq(acc.key) { return false; }

        // 2. EVERY other value-receiving slot must also be vault-controlled
        for &i in action.other_value_indices {
            let Some(other) = remaining_accounts.get(i) else { return false };
            match secondary_token_vault {
                Some(expected) if expected.eq(other.key) => {}
                _ => return false,
            }
        }
        return true;
    }
    false
}
```

If holding the second token is genuinely out of scope for the protocol, the safe alternative is to **constrain the argument instead of the account**: extend `validate_payload` so that the four two-token actions must carry `max_amount_a == 0` (respectively `max_base_amount == 0`), which makes the unconstrained destination unreachable for value:

```rust
fn validate_payload(source_program: &Pubkey, discriminator: &[u8], payload: &[u8]) -> Result<()> {
    // ... existing ClaimReward skip_reward guard ...

    if source_program.eq(&dynamic_bonding_curve::ID)
        && discriminator == dynamic_bonding_curve::client::args::ClaimTradingFee::DISCRIMINATOR
    {
        let args = dynamic_bonding_curve::client::args::ClaimTradingFee::try_from_slice(&payload[8..])
            .map_err(|_| FeeVaultError::InvalidAction)?;
        // the base-token destination is not vault-controlled, so no base token may move
        require!(args.max_amount_a == 0, FeeVaultError::InvalidParameters);
    }
    // ... same for ClaimTradingFee2, ClaimCreatorTradingFee, ClaimCreatorTradingFee2,
    //     and damm_v2 ClaimPositionFee (which has no args — for it, pin index 3 to the
    //     vault instead, or reject the action outright).
    Ok(())
}
```

Either fix must be accompanied by a negative test per action proving that a hostile destination (or a non-zero second-token maximum) is rejected — see F-006.

---
#### [F-002] The `fee_vault` PDA signs a CPI whose instruction data and account count are entirely caller-supplied; the whitelist pins only `(program, discriminator)` and one positional index

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM |
| **Checklist Item** | PDA-019 (primary); also CPI-008, EXT-011, AV-037, AV-075, AC-048, ECON-040, FV-057, KV-003, KV-009 |
| **Category** | CPI Safety / Arbitrary Signed Program Invocation |
| **Language** | Rust |
| **File** | `programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:93-126`; `programs/dynamic-fee-sharing/src/constants.rs:13-19` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

This is the structural weakness behind F-001, reported separately because fixing F-001's five account indices does not close it. The program hands its PDA's signature to an external program under three constraints and no others:

1. `source_program.key` ∈ `{damm_v2::ID, dynamic_bonding_curve::ID}` (L31-32);
2. `payload[..8]` equals one of nine whitelisted discriminators (L32, L64);
3. `remaining_accounts[token_vault_index]` equals the vault's own token account (L35-36).

Everything else is forwarded verbatim: `data: payload.clone()` (L122) and the complete `remaining_accounts` list (L93-110), with no length check. The single argument-level guard in the program covers one byte of one action (`ClaimReward.skip_reward`, L52). The remaining caller-controlled arguments include `max_amount_a` / `max_amount_b` (DBC `claim_trading_fee`/`2`), `max_base_amount` / `max_quote_amount` (DBC `claim_creator_trading_fee`/`2`), `reward_index` (damm_v2 `claim_reward`), `flag` (DBC `withdraw_migration_fee`), and `transfer_hook_accounts_info` (both `*2` variants).

The positional index is the fragile part, and the code says so itself: `// TODO should find a way to avoid hardcoding index of token_vault_account` (`constants.rs:18`). The nine indices are correct **at this commit** against the vendored IDLs — that was verified account-by-account during this audit. But DAMM v2 and Dynamic Bonding Curve are independently upgradeable programs, and the whitelist contains no version pin, no account-count check, and no on-chain switch to disable the path. If a future release of either program keeps an instruction's name (hence its discriminator) but reorders its account list, one of two things happens: the pinned slot becomes mint-incompatible and `fund_by_claiming_fee` breaks outright for that action, or — if the reorder is mint-compatible — the slot that actually receives the **vault's own** token becomes unvalidated, which would promote F-001 from "second token" to "the whole fee stream". Neither outcome is detectable on-chain until it happens, and the only remediation lever is a program upgrade.

**Impact:**

Today: the caller's freedom over arguments is what makes F-001 silent (setting the quote maximum to 0 produces a zero delta and no event). Tomorrow: the program's safety depends on the *current* account layout and *current* semantics of nine instructions in two programs it does not control and cannot re-verify at runtime. The severity reflects that this is a defence-in-depth and forward-compatibility gap rather than a presently-exploitable drain of the vault's own balance — the vault's token account is still correctly pinned at this commit, and `token_vault`'s authority is the separate `fee_vault_authority` PDA, which is never exposed to caller-supplied instruction data (`utils/token.rs:148, 168`).

**Reachability (abbreviated — gate not required below severity 6):**

```
- Entry point: fund_by_claiming_fee @ ix_fund_by_claiming_fee.rs:58
- Signer required: share holder (L80-83) + fee_vault_type == 1 (L86-89)
- Guard analysis: the three constraints listed above are the complete set. No account-count check
  exists (only `remaining_accounts.get(idx)` presence, L35); no argument bound exists outside L52.
- Verdict: REACHABLE today for the argument-freedom half. The layout-drift half is CONDITIONAL on a
  future DAMM v2 / DBC release and is reported as a forward-looking defence-in-depth gap, not as a
  currently-exploitable path.
```

**Proof of Concept:**

```
Present-day demonstration of unbounded argument freedom (no external change required):

  A share holder calls fund_by_claiming_fee with
      payload = discriminator(withdraw_migration_fee) || flag = 1
  instead of flag = 0. The program never inspects `flag` (validate_payload @ L43-56 only
  branches on damm_v2 ClaimReward). DBC decides "partner" vs "creator" from that byte.
  The vault PDA therefore authorises whichever of the two withdrawal roles the caller picks,
  with no on-chain record of which was chosen beyond the echoed payload in EvtFundFee.

Forward-looking demonstration of layout drift:

  Suppose DBC v0.2 keeps `claim_trading_fee` (same name -> same discriminator) but inserts one
  account before `token_a_account`. WHITELISTED_ACTIONS still pins index 4. Index 4 now holds
  `token_a_account` and index 5 holds `token_b_account`.
    - If the vault's mint differs from the base mint: the CPI reverts (transfer_checked mint
      mismatch) and fund_by_claiming_fee is permanently broken for that action.
    - If a mint-compatible account lands on index 4: the check passes while `token_b_account`
      at index 5 — the destination for the vault's OWN token — is entirely caller-chosen.
  Nothing on-chain detects the transition; there is no version marker and no kill switch.
```

**Recommendation:**

```rust
// 1. Build the instruction data in-program from typed arguments rather than forwarding bytes.
//    Replace `payload: Vec<u8>` with a typed enum and serialise it here:
#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum FundAction {
    DammV2ClaimPositionFee,
    DammV2ClaimReward { reward_index: u8 },                 // skip_reward forced to 0 below
    DbcClaimTradingFee { max_amount_b: u64 },               // max_amount_a forced to 0
    DbcClaimCreatorTradingFee { max_quote_amount: u64 },    // max_base_amount forced to 0
    // ...
}

impl FundAction {
    fn to_instruction_data(&self) -> Vec<u8> { /* program-controlled serialisation */ }
}

// 2. Pin the callee's arity so an inserted account cannot shift the validated slot silently.
require!(
    ctx.remaining_accounts.len() == action.expected_account_count,
    FeeVaultError::InvalidAction
);

// 3. Add an on-chain kill switch, held by an authority distinct from the upgrade key, so this
//    path can be disabled within one transaction if a callee's layout or semantics change.
require!(!global_config.fund_by_claiming_paused, FeeVaultError::InvalidAction);
```

If forwarding raw bytes must be retained for flexibility, at minimum add the arity check (step 2) and extend `validate_payload` to deserialise and bound the arguments of **all nine** actions, not one.

---

#### [F-003] Accepted mints are never checked for a live `freeze_authority`, and no recovery path exists — a frozen `token_vault` permanently deadlocks every claim

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM |
| **Checklist Item** | AV-065 (primary); also AV-050, AV-063, AV-064, AV-066, AC-036, ECON-047, ECON-056, EXT-013, SM-023, KV-019, KV-105 |
| **Category** | Token Handling / Denial of Service |
| **Language** | Rust |
| **File** | `programs/dynamic-fee-sharing/src/utils/token.rs:37-55`; consequence at `programs/dynamic-fee-sharing/src/instructions/ix_claim_fee.rs:39-46` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

`is_supported_mint` is the program's only mint-vetting gate, called once per vault at creation (`ix_initialize_fee_vault.rs:134`):

```rust
pub fn is_supported_mint(mint_account: &InterfaceAccount<Mint>) -> Result<bool> {
    let mint_info = mint_account.to_account_info();
    if *mint_info.owner == Token::id() {
        return Ok(true);                                     // L39-41 — classic SPL: NO inspection
    }
    let mint_data = mint_info.try_borrow_data()?;
    let mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&mint_data)?;
    for e in mint.get_extension_types()? {
        if e != ExtensionType::TransferFeeConfig
            && e != ExtensionType::MetadataPointer
            && e != ExtensionType::TokenMetadata
        {
            return Ok(false);                                // L47-52 — T22: extension allowlist
        }
    }
    Ok(true)
}
```

The Token-2022 branch is good work: it rejects `PermanentDelegate`, `DefaultAccountState`, `MintCloseAuthority`, `TransferHook`, `ConfidentialTransfer`, and `InterestBearingConfig` — the whole dangerous-extension set. But `freeze_authority` is a field of the **base** `Mint` struct, not an extension, so it is invisible to that loop; and the classic-SPL branch returns `Ok(true)` at L39-41 without reading the mint at all. A mint with a live freeze authority is therefore accepted on both paths.

`token_vault` is created by this program (`ix_initialize_fee_vault.rs:67-78`) and is the sole source for every payout. If the mint's freeze authority calls `FreezeAccount` on it, `transfer_checked` from that account reverts forever (`utils/token.rs:150-168`), so `claim_fee` reverts for every holder. The program has no close instruction, no sweep instruction, no alternative payout path, and no pause — `grep` for `close =`, `pause`, `emergency`, `rescue`, `recover` over `programs/` returns zero hits. Every token already accrued in that vault is unreachable permanently.

This is not a purely theoretical mint: USDC — a natural quote mint for a Meteora fee vault — has a live freeze authority that its issuer exercises for sanctions compliance. The test suite never exercises it either: `createToken(svm, admin, admin.publicKey, null)` passes `null` for `freezeAuthority` in every call (`tests/common/index.ts:100-105` and all four test files), so no test ever sees a freezable mint.

**Impact:**

Permanent loss of access (not theft) to the entire accrued balance of an affected vault. The trigger is an action by a third party — the mint's freeze authority — who is outside the protocol's trust model entirely and is not accountable to the share holders. Severity 5 rather than 6: the mint is chosen at vault creation by the operator, a reputable quote mint's authority is unlikely to freeze a protocol vault absent a compliance event, and the affected value is bounded by one vault's accrual rather than the whole protocol. It is *not* downgraded further because the harm is irreversible — the "recoverable / self-healing" lever of Rule 1 explicitly does not apply here, since no instruction can undo it.

**Recommendation:**

```rust
// utils/token.rs — vet the base mint on BOTH token-program paths.
pub fn is_supported_mint(mint_account: &InterfaceAccount<Mint>) -> Result<bool> {
    // Applies to classic SPL and Token-2022 alike: InterfaceAccount<Mint> already exposes it.
    if mint_account.freeze_authority.is_some() {
        // A third party can freeze token_vault and permanently block every claim.
        // Reject, unless this specific mint is explicitly allowlisted by the protocol.
        return Ok(false);
    }

    let mint_info = mint_account.to_account_info();
    if *mint_info.owner == Token::id() {
        return Ok(true);
    }
    // ... existing Token-2022 extension allowlist, unchanged ...
}
```

If mints with a freeze authority must be supported (USDC being the obvious case), do **not** rely on vetting alone — add the recovery lever that is currently missing:

```rust
// A vault-owner-gated close/sweep path, so a frozen or exhausted vault is not permanently dead.
// This also gives FeeVault.owner (F-008) its first actual use.
#[derive(Accounts)]
pub struct CloseFeeVaultCtx<'info> {
    #[account(mut, has_one = owner, has_one = token_vault, close = owner)]
    pub fee_vault: AccountLoader<'info, FeeVault>,
    #[account(mut)]
    pub token_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub owner: Signer<'info>,
    // ... authority, destination, token_program ...
}
// Handler: require every users[i].fee_per_share_checkpoint == fee_per_share (all settled),
// sweep the residual balance, close token_vault, then close fee_vault.
```

At minimum, document the freeze exposure in `README.md` so operators choose vault mints knowingly, and add a LiteSVM test that creates a mint **with** a freeze authority, freezes `token_vault`, and asserts the resulting claim failure — making the exposure visible in CI.

---

#### [F-004] CI references five third-party GitHub Actions by mutable tag/branch, declares no `permissions:`, and installs the Solana toolchain by piping an unverified remote script to `sh`

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | OPS-074 (primary); also OPS-070, OPS-071, OPS-073, OPS-075, KV-080 |
| **Category** | Build / Supply-Chain Integrity |
| **Language** | YAML |
| **File** | `.github/workflows/ci.yml:20,25,35,36,41,50,55,57,62,64`; `.github/actions/setup-anchor/action.yml:6,8,14`; `.github/actions/setup-solana/action.yml:6,14` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

Every third-party action in the pipeline is referenced by a mutable ref rather than a commit SHA:

| Reference | Location | Ref type |
|---|---|---|
| `tj-actions/changed-files@v18.6` | `ci.yml:25` | mutable tag |
| `dtolnay/rust-toolchain@stable` | `ci.yml:36`, `ci.yml:57` | **mutable branch** |
| `Swatinem/rust-cache@v1` | `ci.yml:41`, `ci.yml:62` | mutable major tag |
| `oven-sh/setup-bun@v2` | `ci.yml:55`, `setup-anchor/action.yml:6` | mutable major tag |
| `actions/checkout@v4`, `actions/cache@v4` | `ci.yml:20,35,50,64`, `setup-*/action.yml` | mutable major tag (first-party) |

`tj-actions/changed-files` is specifically the action compromised in **CVE-2025-30066** (March 2025), where existing version tags were repointed to a malicious commit that dumped runner memory — including secrets — into the build log. A repository consuming it by tag would have picked the payload up automatically. `dtolnay/rust-toolchain@stable` is worse in kind than a tag: `stable` is a branch, so every run resolves to whatever its tip is at that moment, and that action selects the Rust toolchain used to compile the audited program in CI.

Two aggravating details: the workflow declares **no `permissions:` block** at any level (`ci.yml` has none), so jobs run with whatever the repository's default `GITHUB_TOKEN` scope is — write-capable unless the org has opted into the read-only default; and `setup-solana/action.yml:14` installs the Solana toolchain with `sh -c "$(curl -sSfL https://release.anza.xyz/v${SOLANA_CLI_VERSION}/install)"`, executing a remote script with no checksum or signature verification. `setup-anchor/action.yml:14` installs `anchor-cli` from a git **tag** (`--tag v${ANCHOR_CLI_VERSION}`), which is likewise movable.

**Impact:**

A tag/branch repoint on any of these five actions executes attacker code inside the CI runner on every PR build. From there the realistic outcomes are exfiltration of the `GITHUB_TOKEN` (repository write, if the default scope is permissive) and tampering with the compiled artifacts and test results — a green CI on a poisoned build. Severity is held at 4 rather than higher because the blast radius is genuinely bounded: the workflow has **no deploy job** (`ci.yml` contains only `program_changed_files`, `cargo_test`, and `program_test` — no `anchor deploy`, no `solana program deploy`), and `grep secrets.` over `.github/` returns zero hits, so there are no repository secrets for a payload to steal beyond the token itself. The trigger is `pull_request`, not `pull_request_target`, so fork PRs run without secrets and with a read-only token regardless. If a deploy job is ever added to this workflow, or if the repository holds org-level secrets, this rises to 6–7 immediately.

**Recommendation:**

```yaml
# .github/workflows/ci.yml — declare least privilege at the workflow level
permissions:
  contents: read

jobs:
  program_changed_files:
    steps:
      - uses: actions/checkout@<full-40-char-sha>        # v4.2.2
      - uses: tj-actions/changed-files@<full-40-char-sha> # v46.0.1 or later, SHA-pinned
  cargo_test:
    steps:
      - uses: dtolnay/rust-toolchain@<full-40-char-sha>   # never @stable — that is a branch
      - uses: Swatinem/rust-cache@<full-40-char-sha>
```

```yaml
# .github/actions/setup-solana/action.yml — verify before executing
- name: Install Solana CLI (checksum-verified)
  shell: bash
  run: |
    set -euo pipefail
    curl -sSfL "https://release.anza.xyz/v${SOLANA_CLI_VERSION}/install" -o install.sh
    echo "${SOLANA_INSTALLER_SHA256}  install.sh" | sha256sum --check --strict
    sh install.sh
```

Add Dependabot for the `github-actions` ecosystem so SHA pins are kept current automatically, and consider `actions/dependency-review-action` on PRs.

---

#### [F-005] `fund_by_claiming_fee` returns `Ok(())` with no state change and no event when the measured delta is zero, leaving a PDA-signed CPI with no trace

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | SM-047 (primary); also SM-049, SM-050, AR-043, KV-122 |
| **Category** | Monitoring / Event Completeness |
| **Language** | Rust |
| **File** | `programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:134-146` |
| **Status** | Open |

**Description:**

```rust
if claimed_amount > 0 {                       // L134
    let mut fee_vault = ctx.accounts.fee_vault.load_mut()?;
    fee_vault.fund_fee(claimed_amount)?;
    emit_cpi!(EvtFundFee { ... });             // L138 — only inside the branch
}
Ok(())                                         // L146 — silent success when the delta is 0
```

A call that traverses every guard, makes the vault PDA sign an external instruction, and moves value *outside* the vault produces no state change and no event. That is precisely the shape of the F-001 diversion, and it is also the shape of an operator mistake (claiming an already-empty position). `claim_fee` has the same pattern (`ix_claim_fee.rs:38-54`), but there it is benign — a zero-value claim moved nothing anywhere.

Compounding it slightly, the event that *is* emitted echoes the caller's `payload` verbatim (`event.rs:20`, `ix_fund_by_claiming_fee.rs:141`). Any indexer parsing `EvtFundFee.payload` is reading attacker-controlled bytes and must treat them as untrusted input (KV-122).

**Impact:**

An off-chain monitor built on this program's own events cannot see a diverting or failed funding attempt at all; reconstructing what happened requires correlating DAMM v2 / DBC events instead. This does not create the F-001 loss, but it removes the detection signal that would otherwise bound how long the loss goes unnoticed.

**Recommendation:**

```rust
// Option A (preferred): fail loudly — a funding call that funded nothing is a caller error.
require!(claimed_amount > 0, FeeVaultError::AmountIsZero);
let mut fee_vault = ctx.accounts.fee_vault.load_mut()?;
fee_vault.fund_fee(claimed_amount)?;
emit_cpi!(EvtFundFee { ... });

// Option B: always emit, so every PDA-signed CPI leaves a record.
let fee_per_share = if claimed_amount > 0 {
    let mut fee_vault = ctx.accounts.fee_vault.load_mut()?;
    fee_vault.fund_fee(claimed_amount)?;
    fee_vault.fee_per_share
} else {
    ctx.accounts.fee_vault.load()?.fee_per_share
};
emit_cpi!(EvtFundFee {
    source_program: ctx.accounts.source_program.key(),
    fee_vault: ctx.accounts.fee_vault.key(),
    payload,                       // document downstream that this field is UNTRUSTED input
    funded_amount: claimed_amount, // may legitimately be 0
    fee_per_share,
});
```

Pair with an alert on `EvtFundFee { funded_amount: 0 }` and on any DAMM v2 / DBC fee-claim whose signer is a known fee-vault PDA but which has no matching `EvtFundFee`.

---

#### [F-006] Verification gaps: clippy is installed but never run, no dependency scanning, no coverage, no authorization-negative tests, and two "Full flow" tests pass when their transactions fail

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | FV-069 and FV-064 (primary); also FV-013, FV-016, FV-017, FV-019, FV-020, FV-024, FV-025, FV-033, FV-038, FV-040, FV-043, FV-067 |
| **Category** | Testing & Static Analysis |
| **Language** | Rust / TypeScript / YAML |
| **File** | `.github/workflows/ci.yml:26-28,33,39,42,48,60,72`; `tests/fee_sharing.test.ts:188-206,232-242,266-277`; `tests/fee_sharing_pda.test.ts:194-212,238-248,272-283`; `.gitignore:11` |
| **Status** | Open |

**Description:**

Five distinct gaps, all citable:

1. **Success assertions are conditional.** Both `fullFlow` helpers wrap every assertion in a success check and fall through to logging otherwise:
   ```ts
   const sendRes = svm.sendTransaction(tx);
   if (sendRes instanceof TransactionMetadata) {
     expect(feeVaultState.owner.toString()).eq(vaultOwner.toString());   // ...assertions...
   } else {
     console.log(sendRes.meta().logs());   // <-- test PASSES on a failed transaction
   }
   ```
   (`tests/fee_sharing.test.ts:188-206`, and again at `:232-242` for funding and `:266-277` for claiming; identically at `tests/fee_sharing_pda.test.ts:194-212, 238-248, 272-283`.) A regression that breaks `initialize_fee_vault`, `fund_fee`, or `claim_fee` outright leaves both "Full flow" tests green. The helper used by the CPI tests does this correctly — `expect(result).instanceOf(TransactionMetadata)` at `tests/common/svm.ts:71` — so the pattern is known to the team and simply was not applied here.

2. **No authorization-negative test exists.** The suite's only negatives are `ExceededUser` twice (`fee_sharing.test.ts:59-127`, `fee_sharing_pda.test.ts:60-131`) and `InvalidParameters` for `skip_reward` (`claim_damm_v2.test.ts:222-282`). Nothing tests that a non-share-holder is rejected by `claim_fee` or `fund_by_claiming_fee`, that a wrong `index` is rejected, that a non-whitelisted `(source_program, discriminator)` is rejected, or that an unsupported mint is rejected. These are the program's core security properties and none of them is covered.

3. **Clippy is installed and never invoked.** `ci.yml:39` and `ci.yml:60` both add `components: clippy` to the toolchain; no step runs `cargo clippy`. The jobs run `cargo test` (`:42`) and `bun run test` (`:72`) only. There is no `cargo audit`, no `cargo deny`, no `bun audit`, no Semgrep, no Dependabot/Renovate config, and no coverage tooling anywhere in the repository.

4. **CI is gated on `programs/**` only.** Both jobs carry `if: needs.program_changed_files.outputs.program == 'true'` (`:33`, `:48`), where the detector watches `files: programs/dynamic-fee-sharing` (`:26-28`). A PR touching only `tests/`, `libs/`, `idls/`, `Anchor.toml`, `Cargo.toml`, or `.github/` runs **no tests at all** — including a PR that changes the workflow itself.

5. **Proptest regressions are discarded.** `.gitignore:11` ignores `proptest-regressions`, so a counter-example found by the 10,000-case property test (`programs/dynamic-fee-sharing/src/tests/fund_fee.rs:6-22`) is never committed and never becomes a regression test.

**Impact:**

The suite proves the happy path works — including, creditably, all nine whitelisted CPI actions end-to-end against real DAMM v2 / DBC binaries (`tests/common/svm.ts:29-37`). It proves very little about the adversarial path, and two of its tests cannot fail for the most important reason a test should. A fix for F-001 or F-003 landing without new negative tests would therefore be unverifiable by CI.

**Recommendation:**

```ts
// tests/fee_sharing.test.ts + fee_sharing_pda.test.ts — assert success, don't log it away.
const sendRes = svm.sendTransaction(tx);
expect(sendRes).instanceOf(TransactionMetadata);   // reuse the pattern from common/svm.ts:71
const feeVaultState = getFeeVault(svm, feeVault.publicKey);
expect(feeVaultState.owner.toString()).eq(vaultOwner.toString());
// ... assertions now unconditional ...
```

```yaml
# .github/workflows/ci.yml — run the linter that is already installed, add scanners,
# and stop skipping the suite when non-program files change.
  cargo_test:
    runs-on: ubuntu-latest
    # (remove the `needs`/`if` gate, or widen `files:` to include tests/, libs/, idls/, .github/)
    steps:
      - run: cargo clippy --all-targets -- -D warnings
      - run: cargo test --package dynamic-fee-sharing
      - uses: rustsec/audit-check@<sha>
```

Add negative tests for: non-holder `claim_fee`; `claim_fee` with a foreign `index`; non-holder `fund_by_claiming_fee`; `fund_by_claiming_fee` with a non-whitelisted discriminator; `fund_by_claiming_fee` against a `fee_vault_type == 0` vault; `initialize_fee_vault` with a `share == 0` entry and with an unsupported Token-2022 mint. Remove `proptest-regressions` from `.gitignore:11`. Record CU baselines for the three primary instructions (FV-067).

---

#### [F-007] No emergency stop, no aggregate-outflow breaker, and no incident-response artifacts

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | AC-035 and OPS-045 (primary); also ECON-072, ECON-089, OPS-044, OPS-047, FV-057 |
| **Category** | Governance / Operational Resilience |
| **Language** | Rust / repository structure |
| **File** | `programs/dynamic-fee-sharing/src/lib.rs:17-48` (the complete instruction set); repository root |
| **Status** | Open |

**Description:**

The program exposes exactly five instructions and none of them can halt anything: `grep -i "pause|freeze|emergency|circuit"` over `programs/` returns zero hits. There is no pausable flag, no guardian role, no rolling outflow accounting, and no rate limit. The repository contains no `SECURITY.md`, no security contact, no incident runbook, and no `CODEOWNERS` (verified by enumerating the tracked file list). The only lever available in an incident is a BPF program upgrade, whose authority and timelock are unverified (`[UNKNOWN]` at OPS-001..012).

Two mitigating facts hold the severity at 3. First, the outflow surface is structurally bounded: `claim_fee` can only pay what was funded, and the bound is enforced by the rounding direction rather than by a policy that could be misconfigured (see §7, INV-01). Second, the CPI whitelist is a compile-time `static` (`constants.rs:19`), so no on-chain role can widen it. What the missing breaker actually costs is response time on the paths that *do* have external dependencies — F-001's diversion and F-002's layout-drift scenario both continue until an upgrade ships.

**Impact:**

An in-flight exploit of `fund_by_claiming_fee`, or a breaking change in DAMM v2 / DBC, cannot be contained within a transaction; containment requires a program upgrade and therefore takes as long as the upgrade process takes. Absent `SECURITY.md`, a third-party reporter also has no documented channel to reach the team before going public.

**Recommendation:**

```rust
// A minimal, targeted breaker on the one path with an external dependency.
// Held by a guardian authority SEPARATE from the BPF upgrade authority (OPS-089 / ECON-089).
#[account]
pub struct GlobalConfig {
    pub guardian: Pubkey,
    pub fund_by_claiming_paused: bool,
    // ...
}

// in handle_fund_by_claiming_fee, before is_support_action:
require!(!ctx.accounts.global_config.fund_by_claiming_paused, FeeVaultError::InvalidAction);
```

Add `SECURITY.md` with a disclosure address and response-time commitment; add `CODEOWNERS` requiring review on `programs/**`; document an incident runbook covering "a callee changed its account layout" and "a vault mint was frozen" (F-003).

---

#### [F-008] `FeeVault.owner` is written once and never read; no close or sweep path exists, so rent, rounding residue, and any donated tokens are permanently locked

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | SM-031 (primary); also SM-008, SM-028, SM-053, ECON-082, AR-038, FV-018, OPS-079, KV-024 |
| **Category** | State Design / Fund Reachability |
| **Language** | Rust |
| **File** | `programs/dynamic-fee-sharing/src/state/fee_vault.rs:30,71`; `programs/dynamic-fee-sharing/src/lib.rs:17-48` |
| **Status** | Open |

**Description:**

`FeeVault.owner` is declared at `state/fee_vault.rs:30`, populated at `:71` from an `UncheckedAccount` supplied at creation (`ix_initialize_fee_vault.rs:86-87, 106`), included in `EvtInitializeFeeVault` (`event.rs:9`) — and read by no instruction. A grep for `owner` across `programs/` returns only the write site, the event, the account declarations, and unrelated `mint_info.owner` / `token_owner_account` matches. There is no owner-gated capability anywhere: the field carries the appearance of an authority that does not exist.

Relatedly, the program has no `close` constraint and no sweep instruction (`grep "close ="` over `programs/`: zero hits). Three pools of value are therefore permanently unreachable:

- **Rent.** Each vault locks rent for a 648-byte account plus a token account — approximately 0.0074 SOL — forever, even after every share holder has claimed everything.
- **Rounding residue.** Both `shl_div` (`math_utils.rs:11`) and `mul_shr` (`:20`) truncate toward zero, so `Σ claims < Σ funded` strictly. The shortfall is tiny (bounded by `total_share / 2^64` per funding call plus under one base unit per claim) but it accumulates and has no exit.
- **Donations.** Tokens transferred directly to `token_vault` never touch `fee_per_share`, so no one can ever claim them (this is also why the vault is immune to the donation/inflation attack — see KV-017, ECON-014 — the same property that makes it safe makes the tokens unreachable).

**Impact:**

No security loss to an attacker; a small, permanent, growing pool of value that no participant can recover. The dead `owner` field is a maintenance hazard: a reader (human or tool) reasonably infers a privilege that does not exist, and a future change that starts honouring it would silently grant it retroactively over every vault already created with an arbitrary `owner`.

**Recommendation:**

Decide the field's fate explicitly. Either give it the job F-003's recommendation needs anyway:

```rust
#[derive(Accounts)]
pub struct CloseFeeVaultCtx<'info> {
    #[account(mut, has_one = owner, has_one = token_vault, close = owner)]
    pub fee_vault: AccountLoader<'info, FeeVault>,
    #[account(mut)]
    pub token_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub owner: Signer<'info>,
    // ... fee_vault_authority, destination token account, token_program ...
}
// Handler: require!(all users[i].fee_per_share_checkpoint == fee_per_share) so nothing owed is
// stranded, sweep the residual token_vault balance to `destination`, close token_vault, close
// fee_vault. Emit EvtCloseFeeVault.
```

or delete it and fold the 32 bytes into `padding`, and state in `README.md` that vaults are permanent and unowned by design.

---

#### [F-009] Reserved `padding` fields are never required to be zero

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | OPS-082 (primary); also AV-042, AR-056 |
| **Category** | Forward Compatibility / Input Validation |
| **Language** | Rust |
| **File** | `programs/dynamic-fee-sharing/src/instructions/ix_initialize_fee_vault.rs:15,26-44`; `programs/dynamic-fee-sharing/src/state/fee_vault.rs:36,38,42,54` |
| **Status** | Open |

**Description:**

`InitializeFeeVaultParameters.padding: [u64; 8]` (`ix_initialize_fee_vault.rs:15`) is documented as "for future use" but `validate()` (`:26-44`) never inspects it — callers may set any 64 bytes. The value is not persisted to state (`FeeVault::initialize` ignores it), but it *is* echoed verbatim into `EvtInitializeFeeVault.params` (`:117`), so an indexer reading the event sees caller-controlled bytes in a field it may reasonably treat as reserved. The in-state reserves (`FeeVault.padding_0`, `padding_1`, `padding`, `UserFee.padding_0`, `UserFee.padding`) are correctly zeroed by `load_init` and by `Default::default()` (`state/fee_vault.rs:80`), so the on-chain side is clean today — the gap is on the instruction-argument side.

**Impact:**

No present security impact. The cost is future optionality: once the program ships, any attempt to reinterpret a `padding` word as a real field must cope with vaults created carrying arbitrary values in it, and with indexers that may have recorded those values. Enforcing zero now is the cheap way to keep the reserve usable.

**Recommendation:**

```rust
impl InitializeFeeVaultParameters {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.padding.iter().all(|v| *v == 0),
            FeeVaultError::InvalidFeeVaultParameters
        );
        // ... existing user-count / share / address checks ...
    }
}
```

---

#### [F-010] Duplicate share-holder addresses are permitted, and the validator carries an unresolved question rather than a decision

| Field | Value |
|---|---|
| **Severity** | 1 — ⚪ INFO |
| **Checklist Item** | AV-042 (primary); also AC-011, SM-040 |
| **Category** | Input Validation / Code Clarity |
| **Language** | Rust |
| **File** | `programs/dynamic-fee-sharing/src/instructions/ix_initialize_fee_vault.rs:32-43` |
| **Status** | Open |

**Description:**

`validate()` checks the roster size (2–5), rejects `share == 0`, and rejects `Pubkey::default()` addresses — then ends with a comment that is a question, not a statement:

```rust
        // that is fine to leave user addresses are duplicated?
        Ok(())
```
(`ix_initialize_fee_vault.rs:42-43`)

The behaviour it asks about is in fact sound. A duplicated address occupies two slots with independent `fee_per_share_checkpoint` values, both of its `share` values are counted in `total_share` (`state/fee_vault.rs:82`), and it claims each slot separately by index (`:104-118`). The arithmetic is identical to a single slot holding the summed share, so no over- or under-payment arises. The issue is that the code records an open question where a reviewer needs a decision — and a future contributor could "resolve" it in either direction without knowing which was intended.

**Impact:**

None to security. It is a clarity defect in the one function whose job is to establish the roster that every later authorization check depends on.

**Recommendation:**

Either reject duplicates:

```rust
for i in 0..number_of_user {
    for j in (i + 1)..number_of_user {
        require!(
            self.users[i].address.ne(&self.users[j].address),
            FeeVaultError::InvalidUserAddress
        );
    }
}
```

or keep the behaviour and replace the question with the reasoning:

```rust
// Duplicate addresses are permitted by design: each slot carries an independent
// fee_per_share_checkpoint and its own share, so N slots for one address pay exactly
// the same total as one slot holding the summed share. See claim_fee / validate_and_claim_fee.
```

---

### Notes & Nitpicks

> No security impact — not scored on the 1–10 scale (OUTPUT-RULES Rule 1). `file:line — observation`.

- `programs/dynamic-fee-sharing/src/math/safe_math.rs:23,35,47,59,71,83,95` — `Location::caller()` is used without `#[track_caller]` on the generated functions, so every math-error message reports a line inside `safe_math.rs` itself rather than the caller that overflowed. Adding `#[track_caller]` (alongside the existing `#[inline(always)]`) would make the message do what it is clearly intended to do.
- `programs/dynamic-fee-sharing/src/math/safe_math.rs:79-88` — `safe_shl` is implemented with `checked_shl`, which only detects a shift amount ≥ the bit width; it silently discards high bits on value overflow. It is currently unused in any value path (`shl_div` calls `checked_shl` directly on a widened `u128`, where the bound holds), but the name promises a safety property the implementation does not provide.
- `programs/dynamic-fee-sharing/src/math/math_utils.rs:20` — `let (quotient, _is_overflow) = prod.overflowing_shr(offset.into());` discards the overflow flag. Harmless while `PRECISION_SCALE` is 64 (`constants.rs:5`) because 64 < 256, but the discard would hide a real problem if the constant ever changed.
- `programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:87` — `fee_vault.fee_vault_type == 1` uses a magic number where `FeeVaultType::PdaAccount.into()` is available and self-documenting (the enum is already used at `ix_initialize_fee_vault_pda.rs:82`).
- `programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:21` — the doc comment is `/// CHECK:: source program` (double colon) and describes the account rather than the validation performed. Anchor accepts it; the validation it should name lives at `:31-32`.
- `programs/dynamic-fee-sharing/src/instructions/ix_initialize_fee_vault.rs:59-65` — `fee_vault_authority` is resolved with runtime `seeds`/`bump` (a `find_program_address` call, ~1,500 CU) while `ix_claim_fee.rs:16-19` pins the same account with `address = const_pda::fee_vault_authority::ID` at zero cost. The code's own note at `const_pda.rs:16` anticipates exactly this optimisation.
- `programs/dynamic-fee-sharing/src/instructions/ix_fund_fee.rs:20-21` and `ix_claim_fee.rs:26-27` — `fund_token_vault` and `user_token_vault` carry no `token::mint = token_mint` constraint. The binding is enforced by `transfer_checked`, so this is correct today; adding the constraint would move the failure earlier and make the intent explicit.
- `programs/dynamic-fee-sharing/src/state/fee_vault.rs:76-83` — `FeeVault::initialize` indexes `self.users[i]` without a local bound check, relying on the caller having run `params.validate()` first (`ix_initialize_fee_vault.rs:136` before `:139`). A `require!(users.len() <= MAX_USER)` inside the method would make it safe independent of call order.
- `tests/common/index.ts:53-65` — `createProgram()` constructs an `AnchorProvider` against `clusterApiUrl("devnet")` in a suite that runs entirely in LiteSVM. The connection is never used, but it makes the tests look network-dependent.
- `tests/common/index.ts:100-105` — `createToken` accepts a `freezeAuthority` parameter and every call site passes `null`. The parameter exists; the case it enables is never tested (see F-003).
- `CHANGELOG.md:8-22` — the `[Unreleased]` section carries six empty subsections. Harmless, but it makes the file's "notable changes" contract look unattended.
- `.gitignore:14` — `CLAUDE.md` is git-ignored. No such file exists in the working tree at this commit, so nothing was excluded from this review by it; noted only so a future reviewer knows the path is intentionally untracked.
- `programs/dynamic-fee-sharing/src/lib.rs:14` — `pub mod tests;` is declared unconditionally while `src/tests/mod.rs:1` gates its only child on `#[cfg(test)]`. The module compiles to nothing in release; declaring it `#[cfg(test)] pub mod tests;` would make that explicit.

---

### Findings by Severity (10 → 1)

#### Severity 10 — 🔴 CRITICAL
None.

#### Severity 9 — 🔴 CRITICAL
None.

#### Severity 8 — 🟠 HIGH
None.

#### Severity 7 — 🟠 HIGH
- **F-001** — Unvalidated second-token destination in `fund_by_claiming_fee` lets any single share holder divert the whole non-vault-mint fee stream.

#### Severity 6 — 🟡 MEDIUM
None.

#### Severity 5 — 🟡 MEDIUM
- **F-002** — The `fee_vault` PDA signs a CPI whose instruction data and account count are entirely caller-supplied.
- **F-003** — Accepted mints are never checked for a live `freeze_authority`, and no recovery path exists.

#### Severity 4 — 🔵 LOW
- **F-004** — CI references five third-party GitHub Actions by mutable tag/branch; no `permissions:`; unverified pipe-to-shell toolchain install.

#### Severity 3 — 🔵 LOW
- **F-005** — `fund_by_claiming_fee` returns `Ok(())` with no state change and no event on a zero delta.
- **F-006** — Verification gaps: clippy never run, no dependency scanning, no coverage, no authorization-negative tests, two "Full flow" tests pass on transaction failure.
- **F-007** — No emergency stop, no aggregate-outflow breaker, no incident-response artifacts.

#### Severity 2 — ⚪ INFO
- **F-008** — `FeeVault.owner` is dead; no close or sweep path; rent, residue, and donations permanently locked.
- **F-009** — Reserved `padding` fields are never required to be zero.

#### Severity 1 — ⚪ INFO
- **F-010** — Duplicate share-holder addresses permitted; the validator carries an unresolved question.

---
## 5. Detailed Item Results

> Every in-scope checklist item, in checklist order, with an explicit verdict (OUTPUT-RULES Rule 4).
> `[UNKNOWN]` is used only where the fact is genuinely not observable from a read-only, offline
> review of the source tree (Rule 10) — never as a substitute for reading the code.

### Checklist 01 — Account Validation (AV-001 … AV-090)

```
[PASS]      AV-001: Every deserialized account is Anchor-typed (owner-checked): AccountLoader<FeeVault>,
                    InterfaceAccount<TokenAccount/Mint>, Interface<TokenInterface>, Program<System>.
                    remaining_accounts are never deserialized — forwarded verbatim @ ix_fund_by_claiming_fee.rs:106-110.
[PASS]      AV-002: No raw AccountInfo<'info> in any #[derive(Accounts)]; UncheckedAccount used for the 4 exceptions.
[PARTIAL]   AV-003: All 4 UncheckedAccounts carry a /// CHECK: comment, but none describes the actual validation.
              File: ix_initialize_fee_vault.rs:58 ("pool authority" — real check is seeds+bump @ :59-64),
                    ix_initialize_fee_vault.rs:86 ("owner" — no validation, and none needed),
                    ix_fund_by_claiming_fee.rs:21 ("source program" — real check is @ :31-32)
              Impact: a reader cannot tell from the comment what protects the account.
              Fix: state the runtime guard in each comment, e.g. "CHECK: address-pinned to the canonical
                   fee_vault_authority PDA via seeds+bump below".
[PARTIAL]   AV-004: ix_initialize_fee_vault.rs:86-87 `owner` has a CHECK comment with no corresponding
                    validation anywhere. None is required (the field is never read — F-008), but that is not stated.
              Fix: "CHECK: unvalidated metadata; stored in FeeVault.owner and never read."
[PASS]      AV-005: Only one state struct exists; AccountLoader<'info, FeeVault> is used for all three consumers.
[PASS]      AV-006: Token accounts are Box<InterfaceAccount<'info, TokenAccount>> everywhere
                    (ix_fund_fee.rs:16,21; ix_claim_fee.rs:22,27; ix_fund_by_claiming_fee.rs:16).
[PASS]      AV-007: Mints are Box<InterfaceAccount<'info, Mint>> (ix_fund_fee.rs:18; ix_claim_fee.rs:24;
                    ix_initialize_fee_vault.rs:84).
[PASS]      AV-008: Program<'info, System> @ ix_initialize_fee_vault.rs:95; Interface<'info, TokenInterface>
                    @ :92. No Rent sysvar account is used (Anchor init handles rent).
[PASS]      AV-009: No foreign program's state struct is deserialized anywhere.
[PASS*]     AV-010: declare_id! @ lib.rs:15 == Anchor.toml:11 == README.md:5 (dfsdo2UqvwfN8DuUVrMRNfQe11VaiNoKcMqLHVvDPzh).
                    *confidence: medium — the deployed program ID could not be queried offline (see OPS-001).
                    No program keypair is tracked in the repository; `anchor build --ignore-keys` (package.json:5).
[PASS]      AV-011: #[account(zero_copy)] @ state/fee_vault.rs:27 gives the 8-byte discriminator; both init
                    paths allocate `space = 8 + FeeVault::INIT_SPACE`.
[PASS]      AV-012: Only one account struct exists. UserFee is #[zero_copy] inline (state/fee_vault.rs:47), never
                    a standalone account — no layout-prefix confusion is possible.
[N/A]       AV-013: remaining_accounts are never deserialized by this program (ix_fund_by_claiming_fee.rs:106-110
                    clones AccountInfos for the CPI) — there is no manual try_deserialize to check.
[N/A]       AV-014: Same as AV-013 — no manual deserialization of remaining_accounts. The related address-validation
                    concern is recorded at AV-032/AV-034/AV-035 (F-001), where it actually applies.
[PASS]      AV-015: Single account struct — no discriminator collision is possible.
[PASS]      AV-016: #[account(zero_copy)] / #[zero_copy] derive bytemuck Pod + the Anchor discriminator; no manual
                    Borsh impl exists.
[N/A]       AV-017: No versioned account migration exists — FeeVault has had one layout since 0.1.1.
[PASS]      AV-018: mut is present where required: fee_vault (ix_fund_fee.rs:12, ix_claim_fee.rs:12,
                    ix_fund_by_claiming_fee.rs:12), token_vault, fund_token_vault, user_token_vault, payer.
[PASS]      AV-019: No unnecessary mut. token_mint, token_program, system_program, fee_vault_authority, owner,
                    base and source_program are all read-only.
[PASS]      AV-020: has_one = token_vault + has_one = token_mint on FundFeeCtx (:12) and ClaimFeeCtx (:12);
                    has_one = token_vault on FundByClaimingFeeCtx (:12), which does not take a mint account.
[PARTIAL]   AV-021: No runtime require_keys_eq! backs the has_one constraints.
              File: ix_fund_fee.rs:12, ix_claim_fee.rs:12, ix_fund_by_claiming_fee.rs:12
              Impact: defense-in-depth gap only — Anchor's has_one is a hard constraint, not advisory.
              Fix: optional; add require_keys_eq! in the handler for critical bindings.
[PASS]      AV-022: init uses payer + space (+ seeds + bump for the PDA variants) — ix_initialize_fee_vault.rs:50-56,
                    67-78; ix_initialize_fee_vault_pda.rs:15-25, 37-48.
[PASS]      AV-023: init_if_needed is not used anywhere (grep over programs/: zero hits).
[N/A]       AV-024: init_if_needed is not used, so no reinitialization guard is required.
[N/A]       AV-025: No `close =` constraint exists anywhere (grep: zero hits). The absence of any close path is
                    reported separately as F-008.
[N/A]       AV-026: No close path exists, so there is nothing to zero.
[PASS]      AV-027: Seeds are complete for each PDA's purpose: ["fee_vault", base, token_mint] separates vaults
                    per (base, mint); ["token_vault", fee_vault] binds each token account to its vault;
                    ["fee_vault_authority"] is a deliberate program-wide singleton (constants.rs:7-11).
[PASS]      AV-028: fee_vault_bump is stored @ state/fee_vault.rs:86 and replayed @ ix_fund_by_claiming_fee.rs:114-115;
                    the authority bump is a compile-time constant @ const_pda.rs:13.
[N/A]       AV-029: No `constraint = <expr>` expressions are used. Validation is has_one / seeds / address plus
                    in-handler require! with typed FeeVaultError variants — so no generic ConstraintRaw can surface.
[N/A]       AV-030: No realloc anywhere (grep: zero hits).
[PASS]      AV-031: Anchor 1.0 rejects duplicate mutable accounts by default and no `dup` opt-in is used; the two
                    mut token accounts in FundFeeCtx and in ClaimFeeCtx cannot be aliased.
[FAIL-7]    AV-032: remaining_accounts are a blind pass-through — only index `token_vault_index` is inspected.
              File: programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:31-41, 93-110
              Impact: every non-pinned account of a PDA-signed CPI is caller-chosen — see F-001.
              Fix: validate every value-receiving index per action (F-001 recommendation).
              Rule 5b: REACHABLE by any share holder; worked case and attacker model in F-001.
[FAIL-7]    AV-033: No remaining account has its owner verified before being forwarded into the CPI.
              File: ix_fund_by_claiming_fee.rs:106-110
              Impact: see F-001.
              Fix: see F-001.
[FAIL-7]    AV-034: The second token's destination account — used as a token account by the callee — has neither
                    its mint nor its authority verified.
              File: ix_fund_by_claiming_fee.rs:35-36 (only remaining_accounts[token_vault_index] is compared);
                    unpinned indices enumerated in F-001's table
              Impact: 100% of the non-vault-mint fee stream is divertible by any single share holder.
              Fix: pin every value-receiving index to a vault-controlled account, or force the corresponding
                   max_* argument to 0 (F-001 recommendation).
              Rule 5b: REACHABLE / bounds worked / attacker model profitable — see F-001.
[PARTIAL]   AV-035: Exactly one remaining account is compared against a known address (ix_fund_by_claiming_fee.rs:36);
                    no PDA is re-derived for any of them.
              Impact: the pinned check is positional, not derivational — F-002.
              Fix: derive or constrain each expected account rather than trusting its index.
[PARTIAL]   AV-036: The count of remaining_accounts is never validated — only `get(token_vault_index)` presence
                    is required (ix_fund_by_claiming_fee.rs:35). Extra trailing accounts are forwarded.
              Impact: bounded today (each callee validates its own arity), but it removes the signal that would
                      detect a callee layout change — F-002.
              Fix: add `require!(ctx.remaining_accounts.len() == action.expected_account_count)`.
[PARTIAL]   AV-037: The CPI target program IS validated (ix_fund_by_claiming_fee.rs:31-32) but the forwarded
                    accounts are not program-ownership validated.
              Fix: see F-001 / F-002.
[PASS]      AV-038: token_vault and fee_vault appear both as named accounts and inside remaining_accounts by design
                    — the first so it can be pinned (:36), the second so it can be marked signer (:97). Both are
                    compared by key, and token_vault is reloaded after the CPI (:128), so no aliasing confusion arises.
[N/A]       AV-039: There are no separate investor-position accounts; positions are inline UserFee slots.
[PASS]      AV-040: space = 8 + FeeVault::INIT_SPACE, with const_assert_eq!(FeeVault::INIT_SPACE, 640)
                    @ state/fee_vault.rs:45 and const_assert_eq!(UserFee::INIT_SPACE, 80) @ :57 pinning the layout.
[PASS]      AV-041: Anchor `init` funds rent-exemption from `payer` (ix_initialize_fee_vault.rs:53, 76).
[PASS]      AV-042: params.users is bounded to 2..=MAX_USER(5) @ ix_initialize_fee_vault.rs:28-31 before any write;
                    state uses a fixed [UserFee; MAX_USER] array @ state/fee_vault.rs:43.
[N/A]       AV-043: No realloc exists.
[N/A]       AV-044: No instruction reduces an account's size.
[PARTIAL]   AV-045: token_vault's mint is pinned at creation (token::mint = token_mint @ ix_initialize_fee_vault.rs:73)
                    and by has_one thereafter; but fund_token_vault (ix_fund_fee.rs:20-21) and user_token_vault
                    (ix_claim_fee.rs:26-27) carry no token::mint constraint.
              Impact: defense-in-depth only — transfer_checked binds the mint at runtime (utils/token.rs:117-126, 150-159).
              Fix: add `token::mint = token_mint` to both.
[PARTIAL]   AV-046: The vault's authority is pinned (AV-047). fund_token_vault / user_token_vault authority is
                    deliberately caller-chosen (the signer is the counterparty), which is safe. The CPI-side
                    destinations in fund_by_claiming_fee are NOT — see F-001.
[PASS]      AV-047: token::authority = fee_vault_authority @ ix_initialize_fee_vault.rs:74 and
                    ix_initialize_fee_vault_pda.rs:44; pinned at payout time by
                    `address = const_pda::fee_vault_authority::ID` @ ix_claim_fee.rs:17.
[N/A]       AV-048: The program never derives or assumes an ATA. token_vault is a seeded PDA token account
                    (["token_vault", fee_vault]), created with init.
[N/A]       AV-049: No delegated_amount is ever used; the program neither reads nor sets a delegate.
[FAIL-5]    AV-050: Frozen state is never checked, and accepted mints are not vetted for a freeze authority.
              File: programs/dynamic-fee-sharing/src/utils/token.rs:37-55 (no freeze_authority read on either path)
              Impact: a frozen token_vault makes claim_fee revert permanently, with no recovery instruction — F-003.
              Fix: reject mints with a live freeze_authority, or add an owner-gated sweep/close path.
[N/A]       AV-051: No WSOL-specific handling exists; the native mint is treated as an ordinary SPL mint.
[PASS]      AV-052: token_flag records the mint's owning token program (utils/token.rs:25-35), and
                    `token::token_program = token_program` + `mint::token_program = token_program`
                    (ix_initialize_fee_vault.rs:75, 82) force the mint and the vault onto the same program.
[PASS]      AV-053: Both creation paths use `init` (never init_if_needed) — ix_initialize_fee_vault.rs:51,
                    ix_initialize_fee_vault_pda.rs:16 — so Anchor's discriminator check rejects reinitialization.
[N/A]       AV-054: No manual initialization path exists.
[N/A]       AV-055: No close instruction exists, so no PDA can be re-derived after closure.
[N/A]       AV-056: No close instruction — no revival surface.
[N/A]       AV-057: No close instruction — no stale-data-in-same-transaction surface.
[PASS]      AV-058: Interface<'info, TokenInterface> (ix_fund_fee.rs:25 et al.) plus the token_program constraints
                    at AV-052; the resolved program is persisted as token_flag (state/fee_vault.rs:33).
[N/A]       AV-059: No ATA is enforced or assumed anywhere — see AV-048.
[PASS]      AV-060: All token movement uses spl_token_2022::instruction::transfer_checked
                    (utils/token.rs:117 inbound, :150 outbound). No mint_to / burn / legacy transfer exists.
[PASS]      AV-061: decimals are read from the mint account at each transfer (utils/token.rs:125, 158); a vault
                    handles exactly one mint (has_one = token_mint), so no cross-mint normalization is needed.
[PARTIAL]   AV-062: fund_by_claiming_fee credits a true balance delta (ix_fund_by_claiming_fee.rs:91, 128-132) —
                    correct. fund_fee instead credits a *computed* net via calculate_transfer_fee_excluded_amount
                    (ix_fund_fee.rs:33-37) rather than a measured one.
              Impact: arithmetically equivalent under current Token-2022 semantics (the same TransferFee::calculate_fee
                      and the same epoch, utils/token.rs:67-73, 100), so no present discrepancy; but it is an
                      assumption about the token program rather than an observation of the ledger.
              Fix: snapshot token_vault.amount, transfer, reload, and credit the difference — as fund_by_claiming_fee does.
[PARTIAL]   AV-063: Token-2022 extensions ARE inspected and allowlisted to {TransferFeeConfig, MetadataPointer,
                    TokenMetadata} @ utils/token.rs:47-51 — PermanentDelegate, DefaultAccountState, MintCloseAuthority,
                    TransferHook, ConfidentialTransfer and InterestBearing are all rejected. The classic-SPL path
                    returns Ok(true) with no inspection @ :39-41, and neither path reads freeze_authority.
              Fix: see F-003.
[PARTIAL]   AV-064: Clawback via PermanentDelegate is excluded by the allowlist above; freeze exposure is not — F-003.
[FAIL-5]    AV-065: freeze_authority / mint_authority status is never considered for an accepted mint.
              File: programs/dynamic-fee-sharing/src/utils/token.rs:37-55
              Impact: a third-party freeze authority can deadlock every claim from an affected vault permanently — F-003.
              Fix: read InterfaceAccount<Mint>.freeze_authority and reject Some(_) unless allowlisted; add a recovery path.
[PARTIAL]   AV-066: An extension allowlist exists for Token-2022 (utils/token.rs:47-51) but there is no *mint*
                    allowlist, and any classic SPL mint is accepted unconditionally (:39-41).
[PASS]      AV-067: token_vault is created by this program with Anchor `init` (ix_initialize_fee_vault.rs:67-78), so it
                    has neither a delegate nor a close authority at creation, and the program never calls approve or
                    set_authority (grep: zero hits) — the vault cannot acquire either. Counterparty accounts'
                    delegates are the counterparty's own business.
[PASS]      AV-068: Clock is obtained via the syscall `Clock::get()?` @ utils/token.rs:100, not from a passed account.
[N/A]       AV-069: No sysvar account appears in any Accounts struct.
[N/A]       AV-070: No time-gated logic exists — no cooldown, vesting, auction, or staleness window. The single
                    Clock read selects the current transfer-fee epoch (utils/token.rs:100).
[N/A]       AV-071: No instruction-sysvar introspection and no precompile signature verification.
                    `const_crypto::ed25519` @ const_pda.rs:2 is a compile-time PDA-derivation helper, not the precompile.
[N/A]       AV-072: No introspection-based signature checks exist.
[N/A]       AV-073: No introspected signed messages exist.
[N/A]       AV-074: No instruction-index introspection exists.
[PARTIAL]   AV-075: Privileged accounts are bound properly — fee_vault_authority by `address =` (ix_claim_fee.rs:17),
                    everything else by has_one / seeds. However, the whitelist gate trusts an account by its
                    *position* in remaining_accounts (ix_fund_by_claiming_fee.rs:35), and the code itself flags the
                    hazard: "TODO should find a way to avoid hardcoding index" (constants.rs:18).
              Impact: correct at this commit (all 9 indices independently verified against the IDLs) but brittle
                      against a callee reordering its accounts — F-002.
              Fix: pin the callee's arity and add a version marker or kill switch.
[PASS]      AV-076: Bumps are canonical throughout — `ctx.bumps.fee_vault` @ ix_initialize_fee_vault_pda.rs:81 stored
                    and replayed @ ix_fund_by_claiming_fee.rs:114; const_pda's bump is asserted equal to
                    find_program_address by unit test @ const_pda.rs:22-30. No user-supplied bump reaches
                    create_program_address (grep: zero hits).
[N/A]       AV-077: Anchor 1.0 program — no entrypoint! / no_std / pinocchio markers (grep: zero hits). Framework
                    guarantees (owner, discriminator, signer, mut) are supplied by Anchor.
[N/A]       AV-078: Native-program item — owner checks are Anchor's (AV-001).
[N/A]       AV-079: Native-program item — signer/writable checks are Anchor's (AC-001, AV-018).
[N/A]       AV-080: Native-program item. For reference, the one index into a fixed array is bounds-checked:
                    `self.users.get_mut(index as usize).ok_or_else(...)` @ state/fee_vault.rs:104-107.
[N/A]       AV-081: No `unsafe` block exists in programs/ (grep: zero hits).
[N/A]       AV-082: Anchor's 8-byte discriminator plus a single account type — no tag ambiguity.
[N/A]       AV-083: No Pinocchio, hence no unsafe-account-resize feature.
[N/A]       AV-084: No SPL Token logic is reimplemented; the program CPIs to the real token program.
[PASS]      AV-085: No instruction reads, compares, or asserts a lamport balance — `lamports` does not appear
                    anywhere in programs/ (grep: zero hits). Rent-exemption is handled entirely by Anchor init.
[PASS]      AV-086: No builtin, sysvar, or precompile account is marked mut; system_program and token_program are
                    read-only in every context.
[PASS]      AV-087: Neither init path is front-runnable. The PDA variant's seeds include a caller-signed `base`
                    (ix_initialize_fee_vault_pda.rs:59), and the keypair variant requires that keypair to sign
                    (ix_initialize_fee_vault.rs:52) — an attacker cannot predict either address. No ATA is created.
[PASS]      AV-088: No unsafe deserialization. Zero-copy goes through bytemuck Pod derives with explicit padding
                    fields (state/fee_vault.rs:36, 38, 42, 54) and compile-time size assertions (:45, :57); every
                    u128 stays 16-byte aligned on both the SBF and host targets.
[N/A]       AV-089: No ComputeBudget instruction is read from the Instructions sysvar (grep: zero hits) — no
                    priority-fee or CU-limit gate exists to be silently disabled under transaction v1.
[PASS]      AV-090: The only positional assumption is an index into a callee's fixed account list, bounded by 5
                    (constants.rs:19-67) — far below the v1 64-account cap. No instruction-introspection loop,
                    no "exactly N instructions" assumption, and no address-lookup-table dependency exists.
```

---
### Checklist 02 — Access Control (AC-001 … AC-050)

```
[PASS]      AC-001: Every value-moving instruction has a Signer — funder (ix_fund_fee.rs:23), user
                    (ix_claim_fee.rs:29), signer (ix_fund_by_claiming_fee.rs:19), payer/base (init paths).
[PASS]      AC-002: All 5 instructions in lib.rs:17-48 require at least one signer; there is no permissionless
                    state mutation.
[PASS]      AC-003: The signer is linked to state where it matters — claim_fee binds signer to users[index].address
                    (state/fee_vault.rs:108); fund_by_claiming_fee binds signer to the roster (ix_fund_by_claiming_fee.rs:80-83).
[PASS]      AC-004: Anchor's Signer<'info> type is used throughout; no account is checked for is_signer manually.
[N/A]       AC-005: No manual is_signer check exists (grep: zero hits).
[N/A]       AC-006: No admin/manager role exists in the program. FeeVault.owner is written but never read (F-008).
[PASS]      AC-007: The investor analogue is exact — claim_fee requires `user: Signer` plus
                    require!(user.address.eq(signer)) @ state/fee_vault.rs:108.
[N/A]       AC-008: No delegation mechanism exists.
[FAIL-7]    AC-009: fund_by_claiming_fee lets one share holder act on behalf of all of them, and the value routed
                    by that action is only partly constrained.
              File: programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:80-83 (the gate),
                    :25-41 (what it fails to constrain)
              Impact: a single holder captures value owed to every holder — F-001.
              Fix: constrain every value-receiving destination (F-001 recommendation).
              Rule 5b: REACHABLE by any registered share holder; attacker model profitable — see F-001.
[PASS]      AC-010: One permissionless value-moving instruction exists and is documented here: fund_fee
                    (ix_fund_fee.rs:23) moves tokens only FROM the caller's own account INTO the vault, crediting
                    all holders pro-rata (state/fee_vault.rs:92-101). Donating is self-harming, never extractive.
[PASS]      AC-011: Roles enumerated: payer/base (vault creation, permissionless), funder (permissionless donation),
                    share holder (claim own slot; trigger CPI funding). Each instruction maps to exactly one.
[PARTIAL]   AC-012: fund_by_claiming_fee's role is ambiguous in effect: any share holder acts for the whole vault,
                    and chooses the unconstrained second-token destination. The only documentation is the
                    "by design" comment @ constants.rs:14-16.
              Fix: document the intended trust assumption in README, or remove the ambiguity via F-001's fix.
[N/A]       AC-013: No manager instruction exists to escalate into.
[PASS]      AC-014: A non-share-holder cannot reach claim_fee (state/fee_vault.rs:108) or fund_by_claiming_fee
                    (ix_fund_by_claiming_fee.rs:80-83); spoofing the fee_vault account is blocked by AccountLoader's
                    owner+discriminator checks plus has_one = token_vault.
[N/A]       AC-015: No admin role exists on-chain. The only privileged actor is the BPF upgrade authority — OPS-001.
[N/A]       AC-016: No admin role exists.
[PASS]      AC-017: No god-mode path. The only hardcoded keys in the program are const_pda::fee_vault_authority::ID
                    (a PDA with no private key) and the two whitelisted program IDs (constants.rs:19-67); there is
                    no `Pubkey::new_from_array([...])` literal anywhere (grep: zero hits).
[N/A]       AC-018: No manager role exists.
[N/A]       AC-019: No manager role exists.
[PASS]      AC-020: has_one = token_vault plus the PDA seeds confine every operation to a single vault; there is no
                    instruction that can reach across vaults.
[PASS]      AC-021: A holder can only claim their own slot — require!(user.address.eq(signer)) @ state/fee_vault.rs:108.
[N/A]       AC-022: No manager exists to withdraw holder funds.
[N/A]       AC-023: The program charges no fee of its own — it splits fees claimed elsewhere.
[N/A]       AC-024: No fee parameter exists to change.
[N/A]       AC-025: No treasury address exists.
[N/A]       AC-026: No treasury address exists.
[N/A]       AC-027: No platform fee exists.
[PASS]      AC-028: Nothing can transfer vault ownership: `owner` is write-once at init (state/fee_vault.rs:71) and
                    never read, and the shares roster is immutable after init.
[PASS]      AC-029: The CPI whitelist is a compile-time `static WHITELISTED_ACTIONS` (constants.rs:19) — no on-chain
                    role can add to it; only a program upgrade can.
[N/A]       AC-030: No pause flag exists in FeeVault or anywhere else (grep for pause/freeze/emergency: zero hits).
[N/A]       AC-031: No pause mechanism exists.
[N/A]       AC-032: No pause mechanism exists.
[N/A]       AC-033: No pause mechanism exists.
[N/A]       AC-034: No pause mechanism exists.
[FAIL-3]    AC-035: No emergency stop exists — this item's own "flag as LOW/MEDIUM" case.
              File: programs/dynamic-fee-sharing/src/lib.rs:17-48 (the complete instruction set)
              Impact: an in-flight exploit or a breaking change in DAMM v2 / DBC cannot be contained without a
                      program upgrade — F-007.
              Fix: add a guardian-held pause gating fund_by_claiming_fee.
[FAIL-5]    AC-036: Yes — the accepted mint's freeze authority can freeze token_vault.
              File: programs/dynamic-fee-sharing/src/utils/token.rs:37-55 (freeze_authority never read)
              Impact: every claim from that vault reverts permanently, with no recovery path — F-003.
              Fix: vet freeze_authority at vault creation and/or add an owner-gated sweep.
[N/A]       AC-037: There is no shares mint — shares are plain u32 fields in state (state/fee_vault.rs:51), never tokens.
[N/A]       AC-038: There is no shares mint, hence no freeze authority over shares.
[PASS]      AC-039: PDA creation cannot be front-run: the seeds include a caller-signed `base`
                    (ix_initialize_fee_vault_pda.rs:59), and the keypair variant requires that keypair.
[N/A]       AC-040: Positions are fixed at init; no one can create a position in an existing vault.
[PARTIAL]   AC-041: No in-program state manipulation can block withdrawals — fee_per_share only rises
                    (state/fee_vault.rs:98) and per-slot checkpoints are independent. Two external levers can:
                    a peer share holder starving the second-token stream (F-001), and a mint freeze authority
                    blocking all claims (F-003).
[N/A]       AC-042: No close instruction exists, so no account can be force-closed.
[PASS]      AC-043: Solana's recent_blockhash / nonce machinery prevents transaction replay, and there is no
                    off-chain component in this repository that could replay a signed payload.
[N/A]       AC-044: No on-chain rate limit exists, and none is required — claims are deterministic settlements
                    against a monotone accumulator, not a contended resource.
[PASS]      AC-045: Anyone can spam initialize_fee_vault, but every creation is self-funded (payer pays ~0.0074 SOL
                    of rent for a 648-byte account plus a token account, ix_initialize_fee_vault.rs:53, 76) and
                    touches no shared state. No other participant's cost rises.
[PASS]      AC-046: No authority context carries across instructions; each of the 5 handlers re-derives authority
                    from its own account constraints.
[N/A]       AC-047: No close instruction exists, so no stale closed-account data can be read later in a transaction.
[PARTIAL]   AC-048: fund_by_claiming_fee hands the fee_vault PDA's signature to an external program
                    (ix_fund_by_claiming_fee.rs:97, 118-126). Those programs cannot call back into this one with
                    elevated privilege — Solana's runtime forbids reentrancy and neither callee declares a CPI to
                    this program — but the caller chooses both the arguments and the non-pinned accounts.
              Fix: see F-002.
[PASS]      AC-049: Reentrancy is prevented at two levels: the Solana runtime forbids re-invoking a program already
                    on the call stack, and all state writes precede their CPIs in the two instructions where that
                    ordering is possible (state/fee_vault.rs:117-118 before ix_claim_fee.rs:39; ix_fund_fee.rs:37
                    before :39). fund_by_claiming_fee writes after its CPI by necessity — see RE-001.
[PASS]      AC-050: The invoke_signed seeds are ["fee_vault", base, token_mint, bump] (macros.rs:10-19) and
                    ["fee_vault_authority", bump] (macros.rs:1-8), both PDAs of this program's own ID — no other
                    program can produce them.
```

### Checklist 03 — Arithmetic Safety (AR-001 … AR-063)

```
[PASS]      AR-001: Every addition goes through safe_add — state/fee_vault.rs:82 (share accumulation), :93
                    (total_funded_fee), :98 (fee_per_share), :118 (fee_claimed).
[PASS]      AR-002: Every subtraction is checked — safe_sub @ state/fee_vault.rs:110 and
                    ix_fund_by_claiming_fee.rs:132; checked_sub @ utils/token.rs:71.
[PASS]      AR-003: The only multiplication is U256::checked_mul @ math/math_utils.rs:19.
[PASS]      AR-004: The only division is checked_div @ math/math_utils.rs:11, preceded by an explicit zero guard @ :6-7.
[PASS]      AR-005: No bare arithmetic operator is applied to a financial value anywhere in programs/ — verified by
                    reading all five handlers, state/fee_vault.rs, math/, and utils/token.rs in full.
[PASS]      AR-006: No saturating_* operation exists (grep: zero hits).
[PASS]      AR-007: No wrapping_* operation exists (grep: zero hits). `overflow-checks = true` is also set for the
                    release profile (Cargo.toml:8).
[PASS]      AR-008: The only constant arithmetic is `8 + FeeVault::INIT_SPACE`, pinned by const_assert_eq!
                    (state/fee_vault.rs:45).
[PASS]      AR-009: Same as AR-008 — the space expression is compile-time.
[PASS]      AR-010: Multiply-then-divide widens first: mul_shr lifts both operands to U256 before multiplying
                    (math/math_utils.rs:17-19); shl_div lifts u64 to u128 before shifting (:9-10).
[N/A]       AR-011: No share-minting formula exists — shares are static.
[N/A]       AR-012: No basis-point fee calculation exists.
[PASS]      AR-013: The proportion `share x delta >> 64` is computed in U256 (math/math_utils.rs:17-20).
[PASS]      AR-014: Downcasts are fallible: mul_shr returns Option via `quotient.try_into().ok()` (:21), and the
                    caller narrows u128 -> u64 with `.try_into().map_err(|_| MathOverflow)` (state/fee_vault.rs:114-115).
[PASS]      AR-015: No `as u64` cast on a u128 value exists (grep: zero hits).
[PASS]      AR-016: No `as u32` cast on a u64 value exists (grep: zero hits).
[PASS]      AR-017: No `as i64` cast exists; there is no signed arithmetic in any value path.
[PASS]      AR-018: Division is guarded twice — an explicit `if y == 0 { return None }` @ math/math_utils.rs:6-7
                    and checked_div @ :11.
[PASS]      AR-019: The pricing denominator is total_share, guaranteed >= 2 at init
                    (ix_initialize_fee_vault.rs:28-31 requires >= 2 users; :33-36 requires each share > 0).
[PASS]      AR-020: Same denominator, same guard, plus the None path at math/math_utils.rs:6-7.
[PASS]      AR-021: Truncation to zero is bounded away: fee_per_share is scaled by 2^64, and since
                    total_share <= u32::MAX < 2^64, any amount >= 1 produces an increment >= 1. Proven empirically
                    by the 10,000-case property test at programs/dynamic-fee-sharing/src/tests/fund_fee.rs:12-21,
                    which asserts fee_per_share > 0 for amounts 1..=10000 at total_share = u32::MAX.
[PASS]      AR-022: Funding rounds DOWN (checked_div @ math/math_utils.rs:11) — in favour of the vault.
[PARTIAL]   AR-023: Redemption also rounds DOWN (overflowing_shr @ math/math_utils.rs:20) — in favour of the vault,
                    which is the opposite of this item's stated preference.
              Impact: bounded by < 1 base unit per claim per holder; the residue is permanently stranded (F-008).
              Note: for a fee splitter this direction is the solvency-preserving choice (see INV-01 in section 7),
                    so it is recorded as a deviation with rationale rather than a defect.
              Fix: none required; if the residue matters, add the sweep path proposed in F-008.
[PASS]      AR-024: Dust cannot be farmed. Every truncation rounds against the claimer, and a repeated claim yields
                    delta = 0 (state/fee_vault.rs:110) hence a zero payout. There is no path in which rounding
                    produces value for a caller.
[N/A]       AR-025: There is no first-depositor dynamic — shares are fixed at init and cannot be acquired.
[N/A]       AR-026: No share-minting formula exists.
[N/A]       AR-027: No share minting exists.
[N/A]       AR-028: No share-burning formula exists.
[N/A]       AR-029: No mint slippage surface exists.
[N/A]       AR-030: No burn slippage surface exists. claim_fee has no min_out because the amount is fully
                    determined by state (state/fee_vault.rs:110-115) — there is nothing to slip against.
[PASS]      AR-031: Donation cannot dilute anyone. Entitlement is computed from fee_per_share, never from the raw
                    vault balance (state/fee_vault.rs:110-115); a direct transfer into token_vault changes no
                    holder's claim (it is simply stranded — F-008).
[PASS]      AR-032: A claim reduces only the claimer's own entitlement — it advances users[index].fee_per_share_checkpoint
                    (state/fee_vault.rs:117) and touches no other slot.
[PASS]      AR-033: total_share == sum(users[i].share) holds by construction (state/fee_vault.rs:76-84) and is never
                    mutated afterwards — no instruction writes total_share or users[i].share after init.
[N/A]       AR-034: There is no shares mint whose supply could diverge.
[N/A]       AR-035: No management fee exists.
[N/A]       AR-036: No performance fee exists.
[N/A]       AR-037: No platform/treasury fee exists.
[PARTIAL]   AR-038: Conservation holds as an inequality, not an equality: sum(claims) <= sum(funded) is guaranteed
                    (INV-01, section 7), but the strict shortfall — truncation residue plus any direct donation —
                    accumulates in token_vault with no path out.
              File: math/math_utils.rs:11, :20; absence of any close/sweep instruction in lib.rs:17-48
              Fix: add the owner-gated sweep proposed in F-008.
[N/A]       AR-039: No basis-point fee exists to bound.
[N/A]       AR-040: No minimum platform fee exists.
[PASS]      AR-041: Fee ordering is consistent for transfer-fee mints: the fee is excluded before crediting on the
                    way in (ix_fund_fee.rs:33-37) and borne by the claimer on the way out (ix_claim_fee.rs:45,
                    where the vault is debited the gross amount) — so the ledger and the balance stay aligned.
[PASS]      AR-042: No fee compounds on a fee. users[i].fee_claimed (state/fee_vault.rs:118) is bookkeeping only
                    and is never read back into any computation.
[PASS]      AR-043: Zero-value edges are handled on every path: fund_fee rejects amount == 0
                    (ix_fund_fee.rs:30); claim_fee skips the transfer when the computed fee is 0 (ix_claim_fee.rs:38);
                    fund_by_claiming_fee skips crediting when the delta is 0 (ix_fund_by_claiming_fee.rs:134) —
                    the silent-return consequence of that last one is reported as F-005.
[N/A]       AR-062: No operation applies multiple simultaneous fee/rate components — the program has no fee
                    configuration at all.
[N/A]       AR-044: No NAV concept exists — a vault holds exactly one mint and never prices it.
[N/A]       AR-045: No NAV concept exists.
[N/A]       AR-046: No NAV concept exists.
[N/A]       AR-047: No NAV concept exists; there is no attestation to inflate.
[N/A]       AR-048: No NAV concept exists.
[N/A]       AR-049: No NAV attestation PDA exists.
[N/A]       AR-050: No NAV staleness window exists.
[N/A]       AR-051: The program never manipulates lamports directly (grep for `lamports` over programs/: zero hits).
[N/A]       AR-052: No lamport transfer exists.
[N/A]       AR-053: No lamport manipulation exists; rent-exemption is established by Anchor init and never reduced.
[N/A]       AR-054: No instruction can drain an account's lamports — there is no close and no lamport transfer.
[N/A]       AR-055: No WSOL wrap/unwrap logic exists in the program.
[PASS]      AR-056: MAX inputs are bounded on every path. max_amount = u64::MAX is clamped to the funder's balance
                    (ix_fund_fee.rs:29); total_funded_fee uses safe_add (state/fee_vault.rs:93); and fee_per_share
                    cannot overflow u128 because sum(amount) <= u64::MAX and total_share >= 2 give
                    fee_per_share <= 2^64 * 2^64 / 2 = 2^127 (see INV-03, section 7).
[PASS]      AR-057: Zero is handled everywhere — see AR-043.
[PASS]      AR-058: amount = 1 credits floor(2^64 / total_share) >= 1 (AR-021). A holder with a small share then
                    claims floor(share * delta / 2^64), which may be 0 — the unit stays in the vault and is never
                    over-paid.
[N/A]       AR-059: The roster never shrinks; there is no "1 share remaining" edge.
[PASS]      AR-060: All five holders claiming at once is safe and cheap: each claim touches only its own slot
                    (state/fee_vault.rs:104-118), there is no batch path, and the only loops in the program are
                    bounded by 5 (:76, :124) and 9 (ix_fund_by_claiming_fee.rs:31).
[N/A]       AR-061: No timestamp arithmetic exists. Clock is read once, for the transfer-fee epoch
                    (utils/token.rs:100), and that value is passed to the token program's own fee lookup.
[PASS]      AR-063: No floating point anywhere — no f32, f64, `as f64`, powf, powi, sqrt, ln, or exp appears in
                    programs/ (grep: zero hits). All value math is Q64.64 fixed point over checked integers
                    (constants.rs:5, math/math_utils.rs).
```

---
### Checklist 04 — CPI & PDA Safety (CPI-001 … RE-007)

```
[N/A]       CPI-001: CpiContext is not used anywhere — all CPIs go through raw invoke_signed
                     (utils/token.rs:135, :168; ix_fund_by_claiming_fee.rs:118).
[N/A]       CPI-002: CpiContext::new_with_signer is not used — see CPI-001.
[PASS]      CPI-003: The token program is constrained by Interface<'info, TokenInterface> (ix_fund_fee.rs:25,
                     ix_claim_fee.rs:31, ix_initialize_fee_vault.rs:92), which admits only SPL Token or Token-2022;
                     `token::token_program` and `mint::token_program` (:75, :82) bind mint and vault to the same one.
[PASS]      CPI-004: Program<'info, System> @ ix_initialize_fee_vault.rs:95 and ix_initialize_fee_vault_pda.rs:67.
[N/A]       CPI-005: The Associated Token Program is never invoked; token_vault is a seeded PDA token account.
[N/A]       CPI-006: No DEX-aggregator CPI exists (no Jupiter, no router).
[N/A]       CPI-007: No Metaplex CPI exists.
[PARTIAL]   CPI-008: The CPI target IS an UncheckedAccount (ix_fund_by_claiming_fee.rs:22), but it is validated at
                     runtime against the two hardcoded program IDs inside is_support_action (:31-32) before
                     invoke_signed (:118-120). The program is constrained; the instruction it executes is
                     constrained only to an 8-byte discriminator.
              Fix: see F-002 — build the instruction data in-program, or bound every action's arguments.
[PASS]      CPI-009: Even though remaining_accounts pass through, the target program ID is validated first
                     (ix_fund_by_claiming_fee.rs:31-32, 66-74) and re-used verbatim at :120.
[PASS]      CPI-010: The raw-CPI program_id is validated before invocation — see CPI-009.
[PASS]      CPI-011: Sources are correct: fund_fee draws from fund_token_vault with the funder as authority
                     (utils/token.rs:117-126); claim_fee draws from token_vault, pinned by has_one (ix_claim_fee.rs:12).
[FAIL-7]    CPI-012: A CPI destination is attacker-controlled.
              File: programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:35-36
              Impact: the second token's destination in four whitelisted actions is caller-chosen — F-001.
                      (claim_fee's user_token_vault is also caller-chosen, but the caller is the beneficiary,
                      so that instance is self-harm only.)
              Fix: pin every value-receiving index, or force the corresponding max_* argument to 0 — see F-001.
              Rule 5b: REACHABLE / worked case / profitable attacker model — see F-001.
[PASS]      CPI-013: Authorities are correct: the const fee_vault_authority PDA signs outbound transfers
                     (utils/token.rs:148, 168) and the funder signs inbound ones (:132, :135 with empty seeds).
[PASS]      CPI-014: Amounts are derived, not asserted: fee_being_claimed comes from state
                     (state/fee_vault.rs:112-115) and the funded credit is the post-fee or measured amount
                     (ix_fund_fee.rs:33-37; ix_fund_by_claiming_fee.rs:132).
[N/A]       CPI-015: No mint_to CPI exists (grep: zero hits).
[N/A]       CPI-016: No mint_to CPI exists.
[N/A]       CPI-017: No mint_to CPI exists.
[N/A]       CPI-018: No mint_to CPI exists.
[N/A]       CPI-019: No burn CPI exists (grep: zero hits).
[N/A]       CPI-020: No burn CPI exists.
[N/A]       CPI-021: No burn CPI exists.
[N/A]       CPI-022: No close_account CPI exists.
[N/A]       CPI-023: No close_account CPI exists.
[N/A]       CPI-024: No close_account CPI exists — the vault cannot be closed at all (F-008).
[N/A]       CPI-025: No system_program::transfer CPI exists; the only System interaction is Anchor's init.
[N/A]       CPI-026: No approve CPI exists — no delegate is ever granted over the vault.
[N/A]       CPI-027: No revoke CPI exists.
[PASS]      PDA-001: Three PDAs, each with complete seeds: ["fee_vault", base, token_mint]
                     (ix_initialize_fee_vault_pda.rs:17-21), ["token_vault", fee_vault]
                     (ix_initialize_fee_vault.rs:69-71), ["fee_vault_authority"] (constants.rs:9).
[N/A]       PDA-002: There is no "fund" PDA in this program; its analogue is enumerated in PDA-001/PDA-003.
[PASS]      PDA-003: All three PDAs are enumerated above with their seeds; the prefixes are centralised in
                     constants.rs:7-11 and the signing seeds in macros.rs.
[PASS]      PDA-004: Seed order matches between init and signing: ix_initialize_fee_vault_pda.rs:17-21 uses
                     [FEE_VAULT_PREFIX, base, token_mint], and macros.rs:10-19 replays exactly that plus the bump.
[PASS]      PDA-005: The token vault's seeds include its parent's key — fee_vault.key() @ ix_initialize_fee_vault.rs:70
                     and ix_initialize_fee_vault_pda.rs:40.
[N/A]       PDA-006: The program creates no mint.
[N/A]       PDA-007: No attestation or oracle PDA exists.
[N/A]       PDA-008: The whitelist is a compile-time static (constants.rs:19), not an account, so it has no seeds.
[PASS]      PDA-009: Verified by reading both the init constraints and the signing macro — no mismatch exists
                     between derivation and usage for any of the three PDAs.
[PASS]      PDA-010: Bumps are stored and reused — fee_vault_bump @ state/fee_vault.rs:86, read back @
                     ix_fund_by_claiming_fee.rs:114; the authority bump is a compile-time const @ const_pda.rs:13.
[PASS]      PDA-011: Every seed component is fixed length — byte-string literals plus 32-byte pubkeys. No
                     variable-length user data is used as a seed.
[N/A]       PDA-012: There is no name field or other truncatable seed input.
[PASS]      PDA-013: The seed components (base, token_mint) are immutable after init — no instruction writes them —
                     so a PDA can never be orphaned by a state change.
[PASS]      PDA-014: Both invoke_signed sites use the matching seeds: fee_vault_authority_seeds!() for vault->user
                     transfers (utils/token.rs:148, 168) and fee_vault_seeds! for the external CPI
                     (ix_fund_by_claiming_fee.rs:115, 125).
[PASS]      PDA-015: The signer seeds reproduce the init derivation exactly, in the same order — see PDA-004.
[PASS]      PDA-016: The bump used for signing is the stored one (ix_fund_by_claiming_fee.rs:114) / the
                     compile-time-derived one (const_pda.rs:13), never a re-derived or caller-supplied value.
[PASS]      PDA-017: invoke_signed is used wherever a PDA is the authority (utils/token.rs:168;
                     ix_fund_by_claiming_fee.rs:118).
[PASS]      PDA-018: No site uses invoke where invoke_signed is required. utils/token.rs:135 calls invoke_signed with
                     an empty seed array, which is semantically identical to invoke and correct there because the
                     authority is a real transaction signer.
[FAIL-7]    PDA-019: The instruction data passed to invoke_signed is supplied by the caller.
              File: programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:122
                    (`data: payload.clone()`); only payload[..8] is constrained (:64, :31-32), and only one
                    argument of one action is validated (:43-56).
              Impact: the operation the vault PDA authorises is chosen by the caller within the whitelisted
                      instruction — this is the root of F-001 and the substance of F-002.
              Fix: construct the instruction data in-program from typed arguments, or bound every action's
                   arguments in validate_payload — see F-002.
              Rule 5b: REACHABLE by any share holder; concrete argument abuse worked in F-001 step 2.
[N/A]       PDA-020: No Jupiter CPI exists.
[N/A]       PDA-021: No realloc exists anywhere (grep: zero hits), so neither the zero-init nor the rent-payer
                     sub-check applies.
[N/A]       EXT-001: No Jupiter integration exists.
[N/A]       EXT-002: No Jupiter integration exists.
[N/A]       EXT-003: No Jupiter integration exists.
[N/A]       EXT-004: No Jupiter integration exists.
[N/A]       EXT-005: No Jupiter integration exists. (The post-CPI balance-delta check that this item describes IS
                     implemented for the DAMM v2 / DBC CPI — see RE-002.)
[N/A]       EXT-006: No Jupiter program ID to validate.
[N/A]       EXT-007: No Metaplex CPI exists.
[N/A]       EXT-008: No Metaplex CPI exists.
[PASS]      EXT-009: The (program_id, discriminator) pair is checked against WHITELISTED_ACTIONS before invocation
                     (ix_fund_by_claiming_fee.rs:31-32, 66-74).
[PASS]      EXT-010: The whitelist lives in the program binary as a `static` (constants.rs:19) — it is not an
                     account, so it cannot be mutated on-chain by any role.
[PARTIAL]   EXT-011: The callee receives the fee_vault PDA's signature. It cannot re-enter this program (the Solana
                     runtime forbids it, and neither callee declares such a CPI), but the scope of what it may do
                     with that signature is bounded only by its own internal checks and by the single pinned account.
              Fix: see F-002.
[N/A]       EXT-012: Transfer-hook mints cannot become a vault mint — is_supported_mint allows only
                     {TransferFeeConfig, MetadataPointer, TokenMetadata} (utils/token.rs:47-51), so no custodied
                     mint carries a TransferHook and no hook accounts need resolving.
[PARTIAL]   EXT-013: PermanentDelegate and MintCloseAuthority ARE rejected by that same allowlist. FreezeAuthority
                     is a base-Mint field, not an extension, and is never read on either the Token-2022 path or the
                     classic-SPL path (utils/token.rs:39-41).
              Fix: see F-003.
[PARTIAL]   EXT-014: transfer_checked is used for all token movement (utils/token.rs:117, :150) and
                     fund_by_claiming_fee credits a true balance delta (ix_fund_by_claiming_fee.rs:91, 128-132).
                     fund_fee instead credits a computed net (ix_fund_fee.rs:33-37) rather than a measured one.
              Fix: snapshot / reload / checked_sub in fund_fee as well — see AV-062.
[N/A]       EXT-015: The program never creates a mint, so there is no metadata to claim.
[PARTIAL]   RE-001: Checks-effects-interactions holds in two of three CPI-bearing handlers — claim_fee writes state
                    (state/fee_vault.rs:117-118) before its transfer (ix_claim_fee.rs:39) and fund_fee writes
                    (ix_fund_fee.rs:37) before its transfer (:39). fund_by_claiming_fee necessarily writes AFTER
                    its CPI (:136) because the credited amount IS the measured delta.
              Impact: none in practice — the callee cannot re-enter this program, and the whole instruction is
                      atomic. Recorded as a deviation with rationale, not a defect.
              Fix: none required; if the pattern is ever generalised to untrusted callees, add an explicit
                   reentrancy guard.
[PASS]      RE-002: State read after the CPI is re-loaded — ctx.accounts.token_vault.reload()
                    @ ix_fund_by_claiming_fee.rs:128 before .amount is read @ :130, and fee_vault is re-loaded
                    with load_mut() @ :135 after being dropped @ :116.
[PASS]      RE-003: Anchor's InterfaceAccount::reload() re-runs deserialization and the owner check
                    (ix_fund_by_claiming_fee.rs:128).
[PASS]      RE-004: No approval is ever granted to an external program — there is no approve CPI (CPI-026).
[PASS]      RE-005: There is no flash-loan surface. Shares are fixed at init and cannot be acquired, and every
                    claim is a settlement against a monotone accumulator, so no atomic borrow-inflate-withdraw
                    sequence can exist.
[PARTIAL]   RE-006: The fee_vault PDA is handed to an external CPI as a signer (ix_fund_by_claiming_fee.rs:97,
                    118-126) with no pre-CPI lamport snapshot and no post-CPI drain bound.
              Impact: not exploitable as written — a program may only debit an account it owns, and fee_vault is
                      owned by dynamic_fee_sharing, not by damm_v2 / DBC. The defense-in-depth check the item
                      names is nonetheless absent.
              Fix: snapshot fee_vault.lamports() before invoke_signed and assert the post-call drain is zero.
[PASS]      RE-007: Every account relied upon after the CPI has its owner re-verified: token_vault via Anchor's
                    reload() (:128) and fee_vault via load_mut() (:135), which re-checks owner and discriminator.
                    The raw remaining_accounts are never read after the call.
```

---
### Checklist 05 — State Machine & Lifecycle (SM-001 … SM-072)

```
[PASS]      SM-001: One state enum exists: FeeVaultType @ state/fee_vault.rs:22-25, persisted as the u8 field
                    fee_vault_type @ :34.
[PASS]      SM-002: Both variants enumerated — NonPdaAccount (0), PdaAccount (1).
[PASS]      SM-003: Every variant has a producer: NonPdaAccount @ ix_initialize_fee_vault.rs:110;
                    PdaAccount @ ix_initialize_fee_vault_pda.rs:82.
[PASS]      SM-004: Both variants are terminal by design — fee_vault_type is write-once at init and no instruction
                    mutates it (verified by grep across programs/).
[PASS]      SM-005: No dead variants. Both are reachable and both are consumed — the `fee_vault_type == 1` gate
                    @ ix_fund_by_claiming_fee.rs:86-89 is the discriminating consumer.
[PASS]      SM-006: External writes are impossible — the account is owned by this program and read through
                    AccountLoader, which enforces the 8-byte discriminator.
[PASS]      SM-007: There is no lifecycle beyond "created"; every vault is permanently live, which is stated
                    explicitly here rather than left implicit.
[FAIL-2]    SM-008: There is no terminal state and no close path, so no account is ever freed.
              File: programs/dynamic-fee-sharing/src/lib.rs:17-48 (complete instruction set — no close)
              Impact: rent for a 648-byte account plus a token account is locked per vault, forever — F-008.
              Fix: add an owner-gated close that requires every slot fully settled.
[N/A]       SM-009: There is no multi-step withdrawal — claim_fee is atomic (ix_claim_fee.rs:34-57).
[PASS]      SM-010: The initiation analogue is correct: claim_fee requires `user: Signer` (ix_claim_fee.rs:29) and
                    a matching users[index].address (state/fee_vault.rs:108), and pays only the checkpoint delta.
[N/A]       SM-011: No swap or conversion step exists in the withdrawal path.
[N/A]       SM-012: No multi-status swap step exists.
[N/A]       SM-013: No intermediate readiness state exists — the design is single-step.
[N/A]       SM-014: No readiness instruction is required; its absence is by design, not a broken flow.
[N/A]       SM-015: Single-step claim — there is no prior status to require.
[N/A]       SM-016: There is no withdrawal account to close; positions are inline array slots.
[PASS]      SM-017: The finalization analogue is atomic and correct: the checkpoint advances and fee_claimed
                    accumulates (state/fee_vault.rs:117-118), then tokens move (ix_claim_fee.rs:39-46), all in
                    one instruction.
[N/A]       SM-018: There is no cancellation step.
[N/A]       SM-019: There is no cancellation step.
[N/A]       SM-020: There is no cancellation step.
[N/A]       SM-021: There are no withdrawal accounts; concurrency is handled by independent per-slot checkpoints.
[N/A]       SM-022: There is no withdrawal deadline or expiry.
[PARTIAL]   SM-023: No participant's inaction can strand a claim — nobody has to advance anything, and the
                    accumulator is monotone. A claim CAN be stuck permanently by a third party: the mint's freeze
                    authority freezing token_vault (F-003), with no recovery instruction.
              Fix: see F-003.
[N/A]       SM-024: There is no partial-claim concept — each call settles the full accrued delta
                    (state/fee_vault.rs:110-118). That is the design, not an omission.
[PASS]      SM-025: create_fee_vault initializes every FeeVault field (state/fee_vault.rs:71-87), invoked from both
                    paths (ix_initialize_fee_vault.rs:102-111; ix_initialize_fee_vault_pda.rs:74-83).
[PASS]      SM-026: owner, token_flag, token_mint, token_vault, users[], total_share, base, fee_vault_bump and
                    fee_vault_type are all set — state/fee_vault.rs:71-87.
[PASS]      SM-027: Reinitialization is impossible — both paths use Anchor `init` (SM-027 = AV-053).
[FAIL-2]    SM-028: There is no fund-closure instruction and therefore no preconditions to examine.
              File: programs/dynamic-fee-sharing/src/lib.rs:17-48
              Impact: see F-008.
              Fix: see F-008.
[N/A]       SM-029: No closure instruction exists, so there is no settlement precondition to enforce.
[N/A]       SM-030: No closure instruction exists.
[FAIL-2]    SM-031: This item's own INFO case applies exactly — no closure instruction exists, so vaults live
                    forever and their rent is locked.
              File: programs/dynamic-fee-sharing/src/lib.rs:17-48
              Impact: ~0.0074 SOL locked per vault permanently, plus stranded residue and donations — F-008.
              Fix: see F-008.
[PASS]      SM-032: PDA uniqueness is per (base, token_mint) and `base` must sign
                    (ix_initialize_fee_vault_pda.rs:59), so a collision requires the base keypair. The keypair
                    variant is unique by construction.
[N/A]       SM-033: There is no deposit -> position -> share-mint flow; funding credits an accumulator instead.
[N/A]       SM-034: Shares never change after init.
[PASS]      SM-035: Positions are created exactly once, at vault init — state/fee_vault.rs:76-83.
[PASS]      SM-036: Position tracking is complete for this model: `share` is static, `fee_claimed` accumulates
                    (state/fee_vault.rs:118), and `fee_per_share_checkpoint` records settlement (:117). There is no
                    total_deposited because holders do not deposit.
[N/A]       SM-037: Positions are inline slots in a fixed array — there is nothing to close.
[PASS]      SM-038: A position cannot go negative: `share` is never decremented, and the checkpoint delta uses
                    safe_sub against a monotone accumulator (state/fee_vault.rs:110, :117).
[PASS]      SM-039: The checkpoint and fee_claimed are updated in the same block, before any CPI —
                    state/fee_vault.rs:117-118.
[PASS]      SM-040: A live slot cannot have 0 shares — init rejects share == 0 (ix_initialize_fee_vault.rs:33-36).
                    The zeroed tail slots hold share == 0 and address == Pubkey::default(), which no transaction
                    signer can match (Pubkey::default() is the System Program address), so state/fee_vault.rs:108
                    rejects them.
[PASS]      SM-041: The one guarded transition checks its precondition before acting —
                    require!(fee_vault_type == 1) @ ix_fund_by_claiming_fee.rs:86-89, before the CPI at :118.
[N/A]       SM-042: There is no multi-state sequence that could be skipped.
[PASS]      SM-043: All state writes occur inside a single load_mut scope per instruction, and a failure anywhere
                    reverts the whole account (Solana transaction atomicity).
[PASS]      SM-044: Same — a mid-execution failure leaves no partial state.
[PASS]      SM-045: A repeated transition is a no-op: calling claim_fee twice in a row yields delta = 0
                    (state/fee_vault.rs:110) and hence a zero transfer (ix_claim_fee.rs:38).
[N/A]       SM-046: There is no close, so PDA seeds are never reused.
[PARTIAL]   SM-047: All three financial transitions emit — EvtInitializeFeeVault (ix_initialize_fee_vault.rs:113,
                    ix_initialize_fee_vault_pda.rs:85), EvtFundFee (ix_fund_fee.rs:48,
                    ix_fund_by_claiming_fee.rs:138), EvtClaimFee (ix_claim_fee.rs:48). But fund_by_claiming_fee
                    suppresses its event when the measured delta is zero (:134-145).
              Impact: a PDA-signed CPI that moved value outside the vault leaves no record — F-005.
              Fix: emit unconditionally, or reject a zero delta — see F-005.
[PASS]      SM-048: Events carry the relevant data — vault key, amount, resulting fee_per_share, user and index,
                    and for CPI funding the source program and payload (event.rs:5-29). Slot and timestamp come
                    from the transaction metadata.
[PARTIAL]   SM-049: Events cannot be forged by an outside party — they are emitted via emit_cpi! by this program.
                    However EvtFundFee.payload (event.rs:20, ix_fund_by_claiming_fee.rs:141) echoes caller-supplied
                    bytes verbatim.
              Impact: any indexer parsing that field is reading untrusted input — KV-122.
              Fix: document the field as untrusted, or replace it with the program's own typed action identifier.
[PARTIAL]   SM-050: An indexer reconstructing vault state from events alone would miss two things: zero-delta
                    fund_by_claiming_fee calls entirely (F-005), and tokens donated directly to token_vault
                    (which never produce an event because they never touch the program).
              Fix: emit on every fund_by_claiming_fee call; document that raw balance != tracked liability.
[N/A]       SM-051: There is no shares mint whose supply could be compared.
[PASS]      SM-052: total_share == sum(users[i].share) is established at state/fee_vault.rs:76-84 and never mutated
                    — no instruction writes either side afterwards. See INV-02 in section 7.
[PARTIAL]   SM-053: Vault balance is consistent in the safe direction: token_vault.amount >= sum(unclaimed)
                    always holds (INV-01). The converse does not — the balance exceeds the tracked liability by
                    the truncation residue plus any donation, and that excess is unreachable.
              Fix: see F-008.
[PASS]      SM-054: Every funding path raises total_funded_fee and fee_per_share together, in one call —
                    state/fee_vault.rs:93-98, reached from ix_fund_fee.rs:37 and ix_fund_by_claiming_fee.rs:136.
[PASS]      SM-055: Every claim raises users[i].fee_claimed and advances the checkpoint together
                    (state/fee_vault.rs:117-118) and debits the vault by exactly that amount (ix_claim_fee.rs:45).
[N/A]       SM-056: There is no swap instruction.
[N/A]       SM-057: There is no timestamp field in FeeVault or UserFee (state/fee_vault.rs:29-56).
[N/A]       SM-058: There is no timestamp sentinel.
[N/A]       SM-059: There is no terminal state and no cleanup path to centralise.
[N/A]       SM-060: There are no terminal states to enumerate.
[PARTIAL]   SM-061: There is no post-drain backing-invariant assertion anywhere — nothing asserts
                    token_vault.amount == expected after a payout. Solvency is guaranteed structurally, by the
                    rounding direction (INV-01), rather than checked.
              Impact: defense-in-depth only; a future change to the rounding direction would not be caught.
              Fix: optionally assert token_vault.amount >= tracked_unclaimed after each claim.
[N/A]       SM-062: There are no paired time-gates.
[N/A]       SM-063: There are no paired inequalities.
[N/A]       SM-064: No transition matrix is needed — fee_vault_type is write-once and there is no other status.
[N/A]       SM-065: There are no terminal states to make absorbing.
[N/A]       SM-066: There is no privileged actor who could perform a lifecycle rewrite — the program has no admin
                    role at all (AC-015).
[N/A]       SM-067: There is no secondary status or lifecycle-lock field.
[PASS]      SM-068: Fixed-slot iteration is correct — is_share_holder uses `.iter().any(...)` over all five slots
                    (state/fee_vault.rs:123-127) and never breaks at the first empty one; validate_and_claim_fee
                    indexes directly (:104-107). Slots are never freed, so no compaction gap can arise.
[PASS]      SM-069: The only cached aggregate, total_share, is immutable after init, so it can never go stale.
                    fee_per_share is recomputed on every funding path (state/fee_vault.rs:95-98) and has no other
                    mutator.
[N/A]       SM-070: There is no vesting or elapsed-time subtraction anywhere.
[N/A]       SM-071: There are no time units in state to mix.
[N/A]       SM-072: There is no cliff or linear-release schedule.
```

### Checklist 06 — Economic & Logic (ECON-001 … ECON-089)

```
[N/A]       ECON-001: No flash-loan surface — feature absent. Shares are fixed at init (state/fee_vault.rs:76-83)
                      and cannot be acquired by depositing; there is no NAV and no oracle-priced share
                      (grep flash|pyth|switchboard|oracle over programs/: zero hits).
[N/A]       ECON-002: There is nothing to acquire atomically, so no deposit cooldown is needed.
[N/A]       ECON-003: No share minting exists to delay.
[N/A]       ECON-004: Shares are non-transferable u32 state fields, not tokens — they cannot be used as collateral.
[N/A]       ECON-005: No NAV attestation exists.
[N/A]       ECON-006: No swap instruction exists.
[N/A]       ECON-007: No swap instruction exists to sandwich.
[PARTIAL]   ECON-008: The concern the item names does apply, to a fee-claim CPI rather than a swap: the route
                      (which action) and the arguments are determined off-chain and forwarded unvalidated
                      (ix_fund_by_claiming_fee.rs:122).
              Fix: see F-001 / F-002.
[N/A]       ECON-009: There is no deposit-for-shares instruction to sandwich.
[PARTIAL]   ECON-010: A claim cannot be sandwiched for value — the amount is deterministic from state
                      (state/fee_vault.rs:110-115). But a share holder CAN front-run an honest
                      fund_by_claiming_fee with a diverting variant of the same call, which differs only in one
                      account and two argument words — F-001.
[PASS]      ECON-011: fund_fee rejects zero (ix_fund_fee.rs:30), and every funding is O(1), so dust funding
                      imposes no per-transaction cost on anyone but the funder.
[PASS]      ECON-012: A claim whose delta rounds to zero performs no transfer (ix_claim_fee.rs:38); the caller
                      pays their own transaction fee either way.
[N/A]       ECON-013: There is no share-pricing formula — the roster is fixed.
[PASS]      ECON-014: The donation/inflation attack is structurally impossible: entitlement is computed from
                      fee_per_share, never from token_vault.amount (state/fee_vault.rs:110-115), so donating
                      changes nobody's claim. (The same property strands the donated tokens — F-008.)
[N/A]       ECON-015: There is no deposit, hence no minimum first deposit.
[N/A]       ECON-016: Virtual/dead shares are unnecessary — the roster is fixed at init.
[N/A]       ECON-017: No shares are created at runtime.
[N/A]       ECON-018: There is no NAV — a vault tracks exactly one mint and never prices it.
[N/A]       ECON-019: No NAV attestation exists.
[N/A]       ECON-020: No NAV attestation exists.
[N/A]       ECON-021: No NAV attestation exists.
[N/A]       ECON-022: No NAV attestation exists.
[N/A]       ECON-023: No NAV exists to floor.
[N/A]       ECON-024: No NAV exists to ceiling.
[N/A]       ECON-025: No NAV exists to go stale.
[N/A]       ECON-026: No settable fee exists — the program takes no cut of its own.
[N/A]       ECON-027: No fee parameter exists to change retroactively.
[N/A]       ECON-028: No fee change exists to timelock.
[N/A]       ECON-029: No volume-based fee exists to wash-trade against.
[N/A]       ECON-030: No management-fee accrual model exists.
[N/A]       ECON-031: No performance fee, hence no high-water mark.
[N/A]       ECON-032: No fee is extracted by this program from the amounts it splits.
[FAIL-7]    ECON-033: Yes — value can leave the fee path entirely, via a direct transfer inside the CPI.
              File: programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:35-36, 118-126
              Impact: the second token of a two-token whitelisted action goes to a caller-chosen account instead
                      of the vault, so it never enters the sharing accounting at all — F-001.
              Fix: pin every value-receiving destination, or force the corresponding max_* to 0 — see F-001.
              Rule 5b: REACHABLE / bounds worked / profitable — see F-001.
[N/A]       ECON-034: There is no manager and no swap — assets cannot be converted to a worthless token.
[N/A]       ECON-035: There is no pda_token_transfer-style general transfer instruction.
[FAIL-7]    ECON-036: The CPI's source is constrained but its destination is not.
              File: programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:35-36
              Impact: for the four two-token actions, the non-vault-mint destination is not required to be a
                      vault-owned account — F-001.
              Fix: see F-001.
              Rule 5b: see F-001.
[N/A]       ECON-037: There is no lamport-transfer instruction (grep `lamports` over programs/: zero hits).
[N/A]       ECON-038: There is no approve instruction, so no delegate can be granted over vault tokens.
[N/A]       ECON-039: There is no swap route to make unfavourable.
[PARTIAL]   ECON-040: A malicious program cannot be invoked — the CPI target is whitelisted to two hardcoded
                      program IDs (constants.rs:19-67, checked at ix_fund_by_claiming_fee.rs:31-32). What remains
                      unconstrained is the instruction's arguments and non-pinned accounts within those two
                      programs — F-002.
[PASS]      ECON-041: The whitelist is not controlled by any on-chain role: it is a compile-time `static`
                      (constants.rs:19). Only a program upgrade can change it.
[PASS]      ECON-042: Nobody can add a program to the whitelist on-chain — same reason as ECON-041.
[PARTIAL]   ECON-043: Share holders have no protection against a peer's diversion (F-001) and no exit beyond
                      claiming their accrued balance. There is no timelock, no multisig, and no pause (F-007).
[PASS]      ECON-044: A Token-2022 transfer-hook mint cannot become a vault mint — is_supported_mint rejects every
                      extension outside {TransferFeeConfig, MetadataPointer, TokenMetadata}
                      (utils/token.rs:47-51), and TransferHook is not among them.
[PASS]      ECON-045: Fee-on-transfer is handled correctly in both directions: the inbound credit excludes the
                      transfer fee using the token program's own calculation for the current epoch
                      (utils/token.rs:63-84, ix_fund_fee.rs:33-37), CPI funding credits the measured delta
                      (ix_fund_by_claiming_fee.rs:128-132), and the outbound fee is borne by the claimer while the
                      vault is debited the gross amount (ix_claim_fee.rs:45).
[PASS]      ECON-046: Rebasing and interest-bearing mints are rejected by the extension allowlist
                      (utils/token.rs:47-51); classic SPL Token has no rebase mechanism.
[FAIL-5]    ECON-047: Yes — a third party can freeze the fund's token account.
              File: programs/dynamic-fee-sharing/src/utils/token.rs:37-55 (freeze_authority never inspected on
                    either the classic-SPL or the Token-2022 path)
              Impact: claim_fee reverts permanently for every holder of that vault, with no recovery path — F-003.
              Fix: reject mints with a live freeze authority, and/or add an owner-gated sweep — see F-003.
[PASS]      ECON-048: Supply inflation of the fee token does not affect the accounting, which is denominated in raw
                      units of that mint and is purely proportional (state/fee_vault.rs:95, :112).
[PASS]      ECON-049: Any decimal range works — decimals are read from the mint at each transfer_checked
                      (utils/token.rs:125, :158) and all internal accounting is in raw units.
[N/A]       ECON-050: There is no native-SOL / WSOL conversion; WSOL would be handled as an ordinary SPL mint.
[PASS]      ECON-051: No instruction's cost is caller-inflatable: the only loops are bounded by MAX_USER = 5
                      (state/fee_vault.rs:76, :124) and by the 9-entry whitelist (ix_fund_by_claiming_fee.rs:31).
[PASS]      ECON-052: The roster is capped at MAX_USER = 5 (constants.rs:4) and fixed at init, so no one can grow
                      a collection that a later instruction must iterate.
[N/A]       ECON-053: There is no batch-payout instruction taking many remaining_accounts.
[PASS]      ECON-054: Spamming vault creation bloats no shared state — each vault is an independent, self-funded
                      account (ix_initialize_fee_vault.rs:50-56).
[PASS]      ECON-055: State contains no growable collection: users is [UserFee; 5] (state/fee_vault.rs:43) and the
                      params Vec is capped at 5 before use (ix_initialize_fee_vault.rs:28-31).
[PARTIAL]   ECON-056: No in-program state transition can lock funds. One external actor can: the mint's freeze
                      authority (F-003), permanently and with no recovery instruction.
[N/A]       ECON-057: No oracle is used — feature absent (grep pyth|switchboard|oracle|get_price|PriceUpdate over
                      programs/: zero hits).
[N/A]       ECON-058: No oracle, hence no staleness check to require.
[N/A]       ECON-059: No oracle, hence no confidence interval.
[N/A]       ECON-060: No oracle to manipulate.
[N/A]       ECON-061: No oracle, hence no fallback.
[N/A]       ECON-062: No NAV is attested and nothing is priced — there is no trust assumption of this kind to
                      document. The program's economics are purely proportional.
[N/A]       ECON-071: No randomness, lottery, or reward selection exists (grep random|vrf|slot_hashes|blockhash
                      over programs/: zero hits).
[N/A]       ECON-063: Positions cannot shrink — `share` is immutable, so there is no partial-unstake path and the
                      settle-then-shrink requirement cannot be violated. This design choice structurally removes
                      the entire reward-debt-rescaling bug class.
[PASS]      ECON-064: There is exactly one payout path (claim_fee), and it both computes the delta and resets the
                      checkpoint in the same call — state/fee_vault.rs:110 then :117. No second path can pay the
                      same accrual, because no other instruction reads or writes fee_per_share_checkpoint.
[PASS]      ECON-065: The accumulator-before-denominator ordering hazard cannot occur: total_share is immutable
                      after init, so it can never be mutated between accruals.
[PASS]      ECON-066: The per-position snapshot and the global accumulator share scale and type — both are u128
                      scaled by PRECISION_SCALE = 64 (constants.rs:5, state/fee_vault.rs:40, :55) — and the
                      snapshot is written in the same instruction that reads the global value
                      (state/fee_vault.rs:110, :117).
[PASS]      ECON-067: Precision is Q64.64, far above the usual 1e12 scaling, and both directions widen before
                      dividing: shl_div lifts to u128 then shifts then divides (math/math_utils.rs:9-11), and
                      mul_shr lifts to U256 then multiplies then shifts (:17-20).
[PASS]      ECON-068: Total owed <= available holds by the truncation argument (INV-01, section 7), and there is no
                      yield path that could move the ratio without a matching inflow: fee_per_share rises only
                      inside fund_fee, which is called either with an amount transferred in the same instruction
                      (ix_fund_fee.rs:37-46) or with an amount already measured as received
                      (ix_fund_by_claiming_fee.rs:132-136).
[PASS]      ECON-069: total_share == 0 is impossible (>= 2 holders with share > 0 at init,
                      ix_initialize_fee_vault.rs:28-36) and shl_div returns None on a zero denominator anyway
                      (math/math_utils.rs:6-7). No first-staker inflation surface exists because shares cannot be
                      acquired at runtime.
[N/A]       ECON-070: There is no reward rate or emission schedule to change.
[FAIL-3]    ECON-072: There is no aggregate outflow cap and no circuit breaker.
              File: programs/dynamic-fee-sharing/src/lib.rs:17-48 (no pause, no cap, no guardian)
              Impact: bounded in practice — claim_fee can only pay what was funded (INV-01) — so the missing
                      breaker matters for the F-001 diversion path and for a future whitelist change, not for the
                      vault balance itself. Reported at 3 for that reason — F-007.
              Fix: add a guardian-held pause on fund_by_claiming_fee.
[N/A]       ECON-073: There is no mark-to-market, no unrealized PnL, and no borrowing power.
[N/A]       ECON-074: There is no concentration or counterparty allocation — a vault holds only the fees its own
                      position claimed, in a single mint.
[FAIL-3]    ECON-089: There is no rolling per-window outflow accounting and no guardian pause held separately from
                      the upgrade authority.
              File: programs/dynamic-fee-sharing/src/lib.rs:17-48
              Impact: a bug-driven or manipulation-driven drain cannot be halted without a program upgrade — F-007.
              Fix: see F-007.
[N/A]       ECON-075: There is no swap and no min_out — claim_fee's amount is fully determined by state.
[PASS]      ECON-076: The fee base is the executed amount, not a declared one: CPI funding credits the measured
                      balance delta (ix_fund_by_claiming_fee.rs:132), and direct funding is clamped to the funder's
                      real balance before anything is credited (ix_fund_fee.rs:29).
[PASS]      ECON-077: Nothing is debited from the caller's wallet SOL beyond transaction fees; the only lamport
                      outlay is rent at init, paid by the explicit `payer` account (ix_initialize_fee_vault.rs:53, 76).
[PASS]      ECON-078: Quantities are distinctly named and never aliased: `amount` vs
                      `excluded_transfer_fee_amount` (ix_fund_fee.rs:29, :33), `claimed_amount`
                      (ix_fund_by_claiming_fee.rs:132), `fee_being_claimed` (state/fee_vault.rs:112).
[N/A]       ECON-079: There is no bonding curve, threshold, or graduation in this program (grep
                      bonding_curve|virtual_reserve|graduate|curve over programs/: zero hits). The DBC pool has
                      them; that is an external program, out of scope.
[N/A]       ECON-080: There are no virtual/real reserve layers in this program.
[N/A]       ECON-081: There is no curve configuration to validate.
[PARTIAL]   ECON-082: token_vault does have an authority-gated way out — claim_fee, signed by the
                      fee_vault_authority PDA (utils/token.rs:140-171) — but only for the *accounted* portion.
                      The truncation residue and any directly-donated tokens have no withdrawal path at all.
              File: absence of any sweep/close instruction in lib.rs:17-48
              Fix: see F-008.
[PASS]      ECON-083: Cumulative caps are enforced by the checkpoint, not per call:
                      users[i].fee_per_share_checkpoint is advanced to the current global value on every claim
                      (state/fee_vault.rs:117), so N calls cannot exceed the accrual. The running total is also
                      recorded in fee_claimed (:118).
[N/A]       ECON-084: There is no residual-sweep path at all (see ECON-082), so there is no extraction that could
                      pre-empt outstanding liabilities.
[N/A]       ECON-085: There is no time-weighted accumulator — feature absent (grep twap|observation|time_weighted|
                      cumulative over programs/: zero hits). For reference, the value accumulator fee_per_share is
                      u128 and uses safe_add (state/fee_vault.rs:98), so it errors rather than wrapping.
[N/A]       ECON-086: There is no `price x elapsed` term and no idle-gap accrual.
[N/A]       ECON-087: There is no bounded measurement window or proposal to finalize.
[N/A]       ECON-088: There is no TWAP consumer that could read an unseeded accumulator.
```

---
### Checklist 07 — OpSec & Governance (OPS-001 … OPS-085)

> 32 items in this checklist are `[UNKNOWN]`. Each names an *operational* fact — upgrade-authority custody,
> multisig configuration, alerting, git-history integrity — that a read-only, offline review of a source tree
> cannot observe. Per OUTPUT-RULES Rule 10 these are recorded as UNKNOWN, never as PASS, and each is carried
> into §10.C as an explicit follow-up for the client.

```
[UNKNOWN]   OPS-001: Requires `solana program show dfsdo2UqvwfN8DuUVrMRNfQe11VaiNoKcMqLHVvDPzh` — no network
                     access in this engagement. Nothing in the repository records the upgrade authority.
[UNKNOWN]   OPS-002: Depends on OPS-001. The intake assumption (audit_2/intake.md §5) treats the authority as
                     trusted-but-unverified; the "single wallet => severity 8+" lever was NOT applied because its
                     precondition is unconfirmed.
[UNKNOWN]   OPS-003: Depends on OPS-001 — multisig threshold not observable offline.
[UNKNOWN]   OPS-004: Depends on OPS-001 — signer identities not observable offline.
[UNKNOWN]   OPS-005: Depends on OPS-001 — hardware vs hot custody not observable offline.
[UNKNOWN]   OPS-006: No on-chain timelock exists in this program (no Clock comparison anywhere except the
                     transfer-fee epoch read @ utils/token.rs:100). An external timelock on the BPF upgrade
                     authority is not observable offline.
[UNKNOWN]   OPS-007: Depends on OPS-006.
[UNKNOWN]   OPS-008: The actual timelock duration is not observable offline. Recorded so the client can state it:
                     the corpus recommendation for a DeFi program is >= 24 hours.
[PASS]      OPS-009: The program contains no authority-mutation instruction of its own (lib.rs:17-48 exposes
                     exactly five instructions, none of which writes an authority), so the BPF loader's
                     set_authority is the only mechanism — a narrow and auditable surface.
[UNKNOWN]   OPS-010: Whether the program is set immutable is not observable offline. It is upgradeable in the
                     intake's stated assumption.
[PASS]      OPS-011: Yes, by definition, and it is worth stating plainly: an upgrade can replace claim_fee and
                     drain every vault, because token_vault's authority is a PDA of this program
                     (ix_initialize_fee_vault.rs:74). This is the load-bearing trust assumption of the whole
                     system and is recorded as such in audit_2/intake.md §6.
[UNKNOWN]   OPS-012: No emergency-upgrade process is documented in the repository.
[PASS]      OPS-013: No hidden admin instruction exists. lib.rs:17-48 exposes exactly five instructions, all of
                     which appear in the generated IDL, and none accepts a hardcoded admin pubkey.
[PASS]      OPS-014: No god-mode account exists. The only address-pinned account is fee_vault_authority
                     (`address = const_pda::fee_vault_authority::ID` @ ix_claim_fee.rs:17), a PDA of this program
                     with no private key, and it can only sign the fixed transfer built at utils/token.rs:150-168.
[PASS]      OPS-015: No conditional logic keys off a hidden pubkey. The only hardcoded keys are damm_v2::ID and
                     dynamic_bonding_curve::ID (constants.rs:19-67) plus the derived authority; there is no
                     `Pubkey::new_from_array([...])` literal anywhere (grep: zero hits).
[PASS]      OPS-016: No dead or undisclosed handler exists. All five #[program] functions dispatch to a live
                     handler; the only other `pub fn`s are the shared helper create_fee_vault
                     (ix_initialize_fee_vault.rs:124) and the token utilities, none of which is an entry point.
[UNKNOWN]   OPS-017: The built IDL (target/idl/dynamic_fee_sharing.json) is a build artifact and is not tracked in
                     the repository — the tests import it at tests/common/index.ts:15. It is generated from the
                     same source that was audited, so drift would require a tampered build; verifying that
                     requires building, which this engagement does not do.
[PASS]      OPS-018: There is no treasury pubkey in state or in any instruction, so none can be redirected.
[PASS]      OPS-019: The CPI target set cannot be modified on-chain — it is a compile-time
                     `static WHITELISTED_ACTIONS` (constants.rs:19) and no instruction writes it.
[PASS]      OPS-020: There is no manager concept and the share roster is immutable after init
                     (state/fee_vault.rs:76-87; no later writer exists).
[PASS]      OPS-021: There is no share-minting instruction — total_share and users[i].share are written only
                     inside FeeVault::initialize (state/fee_vault.rs:78-84).
[PASS]      OPS-022: There is no share-burning instruction; shares are never decremented anywhere.
[PASS]      OPS-023: There is no `unsafe` block in programs/ (grep: zero hits). Zero-copy safety is delegated to
                     bytemuck's derived Pod/Zeroable impls with compile-time size assertions
                     (state/fee_vault.rs:45, :57).
[PASS]      OPS-024: There is no raw pointer manipulation — no `*const` or `*mut` appears in programs/ (grep: zero hits).
[PASS]      OPS-025: declare_id! @ lib.rs:15 matches Anchor.toml:11 and README.md:5.
[PARTIAL]   OPS-026: There is no verifiable-build configuration in the repository — no Dockerfile, no
                     solana-verify metadata, no published binary hash. The ingredients for reproducibility exist
                     (pinned toolchain @ rust-toolchain.toml:2 and Anchor.toml:2-3, Cargo.lock committed,
                     `anchor build --ignore-keys` @ package.json:5) but nothing ties the deployed binary to this source.
              Fix: adopt solana-verify and publish the hash alongside each release in CHANGELOG.md.
[UNKNOWN]   OPS-027: Deploy-keypair custody is an operational fact not represented in the repository.
[PASS]      OPS-028: No keypair file is tracked — the file list contains no `*keypair*.json`, no `id.json`, and no
                     `.env`; `.gitignore:1-3` excludes `.anchor` and `target`. CI generates a throwaway keypair
                     for localnet only (.github/actions/setup-solana/action.yml:18-21).
[N/A]       OPS-029: There are no manager wallets — the program has no privileged on-chain role.
[N/A]       OPS-030: There is no backend server in this repository.
[N/A]       OPS-031: There is no backend server wallet.
[N/A]       OPS-032: No API key appears anywhere in the repository (grep over all tracked files: zero hits).
[N/A]       OPS-033: No API keys exist to scope.
[N/A]       OPS-034: No RPC endpoint is configured beyond Anchor.toml:17 (`cluster = "localnet"`) and CI's
                     `solana config set --url localhost` (setup-solana/action.yml:20).
[N/A]       OPS-035: There is no frontend.
[PARTIAL]   OPS-036: The tracked tree at 3e327c1 contains no key material, no `.env`, and no `.pem`. A full
                     `git log --all -S` history sweep was NOT performed because shell execution was unavailable
                     for this engagement.
              Fix: run gitleaks/trufflehog over the full history once, and add a pre-commit secret scanner.
[UNKNOWN]   OPS-037: No multisig is referenced anywhere in the repository; whether one governs the upgrade
                     authority is not observable offline.
[UNKNOWN]   OPS-038: Depends on OPS-037.
[UNKNOWN]   OPS-039: Depends on OPS-037.
[UNKNOWN]   OPS-040: Depends on OPS-037.
[UNKNOWN]   OPS-041: Depends on OPS-037.
[UNKNOWN]   OPS-042: Depends on OPS-037.
[UNKNOWN]   OPS-043: Depends on OPS-037.
[FAIL-3]    OPS-044: There is no documented incident-response plan.
              File: repository root — no INCIDENT*, RUNBOOK*, or recovery document exists in the tracked file list.
              Impact: response to an in-flight exploit or a DAMM v2 / DBC breaking change is unrehearsed — F-007.
              Fix: document a runbook covering "callee layout changed" and "vault mint frozen".
[FAIL-3]    OPS-045: The program cannot be paused — there is no pause, freeze, emergency, or circuit-breaker
                     construct anywhere (grep over programs/: zero hits).
              File: programs/dynamic-fee-sharing/src/lib.rs:17-48
              Impact: the only containment lever is a BPF upgrade, whose latency is unknown — F-007.
              Fix: add a guardian-held pause on fund_by_claiming_fee.
[UNKNOWN]   OPS-046: No bug-bounty reference appears in the repository; Meteora may operate one off-repo.
[FAIL-1]    OPS-047: There is no SECURITY.md and no security contact anywhere in the repository.
              File: repository root
              Impact: a third-party reporter has no documented channel — F-007.
              Fix: add SECURITY.md with a disclosure address and a response-time commitment.
[UNKNOWN]   OPS-048: Alerting configuration is not in the repository. Note the raw material exists: EvtFundFee and
                     EvtClaimFee are emitted via emit_cpi! (ix_fund_fee.rs:48, ix_claim_fee.rs:48,
                     ix_fund_by_claiming_fee.rs:138) — with the zero-delta blind spot at F-005.
[UNKNOWN]   OPS-049: Upgrade-transaction alerting is not observable offline.
[UNKNOWN]   OPS-050: Anomaly alerting is not observable offline.
[UNKNOWN]   OPS-051: No war-room process is documented in the repository.
[UNKNOWN]   OPS-052: No post-mortem process is documented in the repository.
[PASS]      OPS-053: The enumeration is complete and empty: the program implements zero time-locked actions. The
                     only Clock read is the transfer-fee epoch lookup (utils/token.rs:100), which gates nothing.
[UNKNOWN]   OPS-054: Upgrade timelock duration — depends on OPS-006.
[N/A]       OPS-055: There is no fee parameter to change.
[N/A]       OPS-056: There is no manager to change.
[PARTIAL]   OPS-057: Whitelist changes require a program upgrade, so their effective timelock equals the upgrade
                     timelock (OPS-006, UNKNOWN). Being compile-time is a strength — no on-chain role can widen
                     the whitelist (ECON-041) — but it also means the only way to *narrow* it in an emergency is
                     an upgrade.
              Fix: pair the compile-time whitelist with the runtime kill switch proposed in F-002 / F-007.
[N/A]       OPS-058: There is no treasury address.
[UNKNOWN]   OPS-059: No emergency timelock-bypass process is documented.
[N/A]       OPS-060: There are no on-chain time-locked transactions to cancel.
[N/A]       OPS-061: There is no pending-change mechanism to notify users about.
[UNKNOWN]   OPS-062: Environment key separation is an operational fact not represented in the repository.
[UNKNOWN]   OPS-063: Developer deploy access is an operational fact not represented in the repository.
[PASS]      OPS-064: CI does not auto-deploy. .github/workflows/ci.yml contains exactly three jobs —
                     program_changed_files (:15), cargo_test (:30), program_test (:45) — and no deploy step,
                     no `anchor deploy`, and no `solana program deploy`.
[N/A]       OPS-065: There are no servers in scope.
[N/A]       OPS-066: There is no database.
[PASS]      OPS-067: No wallet private key is referenced in any workflow — `grep secrets.` over .github/ returns
                     zero hits. The only keypair generated is a throwaway for localnet
                     (.github/actions/setup-solana/action.yml:18).
[N/A]       OPS-068: The pipeline consumes no secrets at all, so no secret manager is required — see OPS-067.
[PASS]      OPS-069: The source is public — CHANGELOG.md:24 and :35 link to pull requests on
                     github.com/MeteoraAg/dynamic-fee-sharing.
[PARTIAL]   OPS-070: No verifiable-build pipeline exists and no binary hash is published — see OPS-026.
[PARTIAL]   OPS-071: The build inputs are pinned — rust-toolchain.toml:2 (1.93.0), Anchor.toml:2-3 (anchor 1.0.2,
                     solana 3.1.10), Cargo.lock and bun.lock committed — so a reproduction is plausible, but no
                     verifiable-build/docker pipeline exists to make it checkable.
              Fix: see OPS-026.
[UNKNOWN]   OPS-072: Git-history integrity (force-pushes) cannot be assessed from a single-commit checkout without
                     shell access.
[PARTIAL]   OPS-073: CI runs on `pull_request` to main and release_* (.github/workflows/ci.yml:3-7), implying a
                     PR-based flow, but there is no CODEOWNERS file in the repository and branch-protection
                     settings are not represented in the tree.
              Fix: add CODEOWNERS requiring review on programs/**, and enable required reviews.
[FAIL-4]    OPS-074: The pipeline is not protected against tag repointing, runs with undeclared permissions, and
                     installs its toolchain from an unverified remote script.
              File: .github/workflows/ci.yml:20,25,35,36,41,50,55,57,62,64;
                    .github/actions/setup-anchor/action.yml:6,8,14; .github/actions/setup-solana/action.yml:6,14
              Impact: a repointed tag on any of five third-party actions executes attacker code in the runner on
                      every PR — see F-004 for the bounded blast radius (no deploy job, no declared secrets).
              Fix: SHA-pin every third-party action, declare `permissions: contents: read`, checksum-verify the
                   Anza installer.
[PARTIAL]   OPS-075: Cargo dependencies use caret-implicit ranges (Cargo.toml:17-19 for anchor-lang/anchor-spl/
                     bytemuck; programs/dynamic-fee-sharing/Cargo.toml:27-30 for num_enum, ruint,
                     static_assertions, const-crypto), and package.json:10-26 uses `^` throughout. This is
                     mitigated — Cargo.lock and bun.lock are both committed, so the resolved versions are pinned
                     for the actual build.
              Fix: for the on-chain crate specifically, consider `=` pins on the security-critical deps
                   (anchor-lang, anchor-spl, bytemuck, ruint).
[N/A]       OPS-076: There is no stake-account interaction (grep stake|StakeProgram|staker|withdrawer over
                     programs/: zero hits).
[N/A]       OPS-077: There is no admin or governance instruction that a pre-signed durable-nonce transaction could
                     abuse — the program has no privileged instruction at all (AC-015).
[UNKNOWN]   OPS-085: The signing surface used to approve BPF upgrades is operational and not represented in the
                     repository. The program itself exposes no privileged instruction that a council would need
                     to decode.
[N/A]       OPS-078: The program deliberately has no on-chain admin role, so there is no authority to rotate.
                     FeeVault.owner is written but never read (F-008) — it is not an authority.
[PARTIAL]   OPS-079: token_vault is the fee-receiving account and is correctly a program-derived token account
                     rather than an ATA (ix_initialize_fee_vault.rs:67-78), with an access-controlled payout path
                     (claim_fee). What is missing is a sweep path for the unaccounted residue.
              Fix: see F-008.
[N/A]       OPS-080: There is no config-update API — every field is immutable after init, so the Option-vs-Patch
                     ambiguity this item targets cannot arise.
[UNKNOWN]   OPS-081: The live multisig threshold cannot be fetched offline — depends on OPS-037.
[PARTIAL]   OPS-082: The only settable numerics are the per-user `share: u32` values. A lower bound is enforced
                     (`share > 0` @ ix_initialize_fee_vault.rs:33-36) and an upper bound exists implicitly
                     (total_share uses safe_add and errors past u32::MAX @ state/fee_vault.rs:82), but no explicit
                     MAX is declared. The downstream math tolerates the full u32 range — proven by the property
                     test at src/tests/fund_fee.rs:12-21 — so this is a documentation-grade gap, not an
                     exploitable one.
              Fix: declare an explicit MAX_SHARE and validate against it, so the tolerated range is stated
                   rather than inferred.
[PASS]      OPS-083: Interdependent values are validated atomically from the incoming params: params.validate()
                     checks roster size, each share, and each address in one pass
                     (ix_initialize_fee_vault.rs:26-44) and runs before any state write (:136 before :139).
                     total_share is then derived from the same array it writes (state/fee_vault.rs:76-84).
[PASS]      OPS-084: The one value that becomes a denominator, total_share (state/fee_vault.rs:95), is forced
                     non-zero by requiring >= 2 holders each with share > 0 (ix_initialize_fee_vault.rs:28-36),
                     and shl_div returns None on a zero denominator as a backstop (math/math_utils.rs:6-7).
```

---
### Checklist 16 — Formal Verification & Testing (FV-001 … FV-072)

```
[PARTIAL]   FV-001: The load-bearing invariants are implicit in the code rather than documented. Two size
                    invariants are pinned by const_assert_eq! (state/fee_vault.rs:45, :57) and one precision
                    invariant by a property test (src/tests/fund_fee.rs:12-21), but nothing states "sum(claims) <=
                    sum(funded)" or "total_share == sum(shares)" anywhere in code or docs.
              Fix: add an INVARIANTS section to the README or module docs, listing the properties in §7 below.
[PARTIAL]   FV-002: Exactly one property is encoded as a property-based test — "small funding amounts do not round
                    fee_per_share to zero" (src/tests/fund_fee.rs:12-21, 10,000 cases). Solvency and conservation
                    are not encoded.
[PARTIAL]   FV-003: safe_math has six unit tests covering add/sub/mul/div/shl/shr at boundary values
                    (math/safe_math.rs:120-160) and const_pda has one (const_pda.rs:22-30). The Q64.64 identities
                    in shl_div / mul_shr have no direct test beyond the single proptest.
[PARTIAL]   FV-004: No state-transition property is specified or tested. Mitigating: the machine is trivial — one
                    write-once enum field and a monotone accumulator — so the space of transitions is tiny.
[PARTIAL]   FV-005: The only reachable-state exploration is the single 10,000-case proptest. There is no model
                    checking and no stateful fuzzing over instruction sequences.
[PARTIAL]   FV-006: Token conservation IS asserted, but only observationally and only on the funding side —
                    `postTotalFundedFee - preTotalFundedFee == postTokenVaultBalance - preTokenVaultBalance`
                    appears in every CPI test (tests/claim_damm_v2.test.ts:139-141, :216-218;
                    tests/claim_dbc_creator_trading_fee.test.ts:105-107, :165-167, :224-226, :284-286, :344-346,
                    :404-406, :464-466). No test asserts sum(claims) <= sum(funded) across all five holders.
[PARTIAL]   FV-007: Authority properties are tested only for init parameters. No test proves that a non-share-holder
                    is rejected by claim_fee or fund_by_claiming_fee, or that a foreign index is rejected —
                    see FV-064 and F-006.
[PASS]      FV-008: Liveness holds structurally: every claim is independently reachable at any time and no process
                    requires another party to advance it (state/fee_vault.rs:104-118). The one exception is
                    external — a frozen mint (F-003) — and is reported there.
[N/A]       FV-009: There is no formal spec document, so there is no spec drift to track.
[N/A]       FV-010: No machine-checked proof is claimed anywhere in the repository.
[N/A]       FV-011: No formal-verification properties are documented.
[N/A]       FV-012: There are no prior verification results to include (first audit).
[FAIL-4]    FV-013: No static-analysis tool runs in CI — and clippy is installed without being invoked.
              File: .github/workflows/ci.yml:39 and :60 add `components: clippy`; no step runs `cargo clippy`.
                    The only commands are `cargo test` (:42) and `bun run test` (:72).
              Impact: the cheapest available defect gate is configured and then discarded — F-006.
              Fix: add `cargo clippy --all-targets -- -D warnings` to the cargo_test job.
[N/A]       FV-014: There are no static-analysis findings to triage, because nothing runs.
[PARTIAL]   FV-015: A lint configuration exists but is minimal: [workspace.lints.rust] (Cargo.toml:21-24)
                    configures only `unexpected_cfgs` at `warn`. There is no clippy lint group and no
                    `unwrap_used` / `expect_used` deny (the code happens to comply anyway — see FV-049).
[FAIL-3]    FV-016: Warnings are not errors.
              File: Cargo.toml:22 (`level = "warn"`); .github/workflows/ci.yml has no `-D warnings` and no RUSTFLAGS.
              Impact: a new warning can land silently — F-006.
              Fix: `-D warnings` in CI.
[FAIL-3]    FV-017: No security-focused ruleset is enabled — no clippy::pedantic, no clippy::suspicious, no Semgrep.
              File: Cargo.toml:21-24; .github/workflows/ci.yml
              Impact: see F-006.
              Fix: enable a clippy lint group in [workspace.lints.clippy].
[PARTIAL]   FV-018: There is no dead-code gate. The one live instance — FeeVault.owner, written at
                    state/fee_vault.rs:71 and never read — would not be caught by `dead_code` anyway (a written
                    struct field is considered used), which is precisely why it needs a human decision (F-008).
[FAIL-4]    FV-019: No dependency vulnerability scanning runs anywhere.
              File: .github/workflows/ci.yml (no cargo audit, no cargo deny, no bun/npm audit); repository root
                    (no dependabot.yml, no renovate.json)
              Impact: a vulnerable transitive crate or npm package would go unnoticed — F-006.
              Fix: add rustsec/audit-check to CI and enable Dependabot for cargo, npm, and github-actions.
[FAIL-3]    FV-020: SAST covers neither production language.
              File: .github/workflows/ci.yml
              Impact: see F-006.
              Fix: add clippy (Rust) and a TS linter or Semgrep ruleset.
[PASS]      FV-021: There are no suppression comments anywhere — `#[allow(`, `#[ignore]`, `@ts-ignore`,
                    `@ts-nocheck` and `eslint-disable` all return zero hits across *.rs, *.ts and *.toml.
[PARTIAL]   FV-022: The only static-analysis config is the three-line [workspace.lints.rust] block (Cargo.toml:21-24)
                    plus .prettierrc; both are version-controlled, but there is little to review because no
                    analyser runs.
[PARTIAL]   FV-023: The program does almost no custom parsing — the one deserialization of caller-supplied bytes is
                    `damm_v2::client::args::ClaimReward::try_from_slice(&payload[8..])`
                    @ ix_fund_by_claiming_fee.rs:47, a Borsh-generated impl with explicit error mapping (:48) and
                    a preceding length guard (:62). It is not fuzzed.
[FAIL-4]    FV-024: No instruction handler has a fuzz target.
              File: repository root — no fuzz/, no cargo-fuzz, no Trident configuration
              Impact: fund_by_claiming_fee takes an arbitrary Vec<u8> and an unbounded account list — the single
                      highest-value fuzz target in the program — and is untested against malformed input. This is
                      also the instruction that carries F-001 and F-002.
              Fix: add a Trident target driving (payload bytes x account permutations) against the invariants in §7.
[FAIL-3]    FV-025: The fuzz/property corpus is discarded rather than persisted.
              File: .gitignore:11 (`proptest-regressions`)
              Impact: a counter-example found by the 10,000-case proptest is never committed and never becomes a
                      regression test — F-006.
              Fix: remove that line so shrunk failures are version-controlled.
[PARTIAL]   FV-026: 10,000 cases (src/tests/fund_fee.rs:6-9) is a meaningful campaign, but it covers one property
                    of one function.
[N/A]       FV-027: There are no fuzz-found crashes to triage, because no fuzzing has been run.
[N/A]       FV-028: There is no second implementation to differentially fuzz against.
[PARTIAL]   FV-029: Arithmetic edges are covered at the unit level — u64::MAX, 0, and division by zero in
                    math/safe_math.rs:122-145, and shift boundaries at :150-159. The proptest deliberately
                    excludes them: its range is `1..=10000u64` (src/tests/fund_fee.rs:12), so 0, u64::MAX and
                    near-overflow amounts are never generated.
              Fix: widen the proptest range and add a case at total_share = 2 with amount = u64::MAX.
[N/A]       FV-030: There are no API endpoints.
[N/A]       FV-031: There is no custom serialization to round-trip.
[PARTIAL]   FV-032: The proptest is reproducible via `cargo test --package dynamic-fee-sharing`
                    (.github/workflows/ci.yml:42), but no fuzzing methodology is documented and regressions are
                    not persisted (FV-025).
[FAIL-3]    FV-033: Coverage is not measured or reported.
              File: repository root and .github/workflows/ci.yml — no tarpaulin, llvm-cov, lcov, or istanbul config
              Impact: the untested branches identified at FV-037 and FV-064 are invisible to the team — F-006.
              Fix: add cargo-llvm-cov to CI and publish a coverage summary per PR.
[PARTIAL]   FV-034: The critical paths ARE exercised end-to-end against the real compiled program and real callee
                    binaries: init -> fund -> claim for both vault variants (tests/fee_sharing.test.ts:129-152,
                    tests/fee_sharing_pda.test.ts:133-156) and CPI funding for **all nine** whitelisted actions
                    (tests/claim_damm_v2.test.ts for claim_position_fee and claim_reward;
                    tests/claim_dbc_creator_trading_fee.test.ts for claim_creator_trading_fee{,2},
                    claim_trading_fee{,2}, creator_withdraw_surplus, partner_withdraw_surplus,
                    withdraw_migration_fee). Branch coverage is unmeasured, and several branches are untested
                    (unsupported mint, share == 0, foreign index, non-holder).
[PARTIAL]   FV-035: All five instructions have at least one test. The state-layer functions
                    FeeVault::validate_and_claim_fee and FeeVault::is_share_holder
                    (state/fee_vault.rs:103-127) have no direct Rust unit test — they are only reached through
                    the SVM tests.
[PASS]      FV-036: Multi-step workflows are covered: create -> fund -> claim across five holders
                    (tests/fee_sharing.test.ts:155-279) and create -> external pool setup -> swap -> CPI-fund ->
                    assert (tests/claim_dbc_creator_trading_fee.test.ts:52-109 with setupPool @ :471-533).
[PARTIAL]   FV-037: Edge cases covered: 6 users (rejected) and 0 users (rejected) — tests/fee_sharing.test.ts:59-127
                    and tests/fee_sharing_pda.test.ts:60-131. Not covered: share == 0, max_amount == 0,
                    max_amount == u64::MAX, two claims in a row, an out-of-range index, and any Token-2022
                    transfer-fee mint end-to-end (every test mint is classic SPL — tests/common/index.ts:100-133).
[FAIL-4]    FV-038: No negative test covers an unauthorized caller.
              File: tests/ — the only negatives are ExceededUser twice (fee_sharing.test.ts:93-94,
                    fee_sharing_pda.test.ts:96-97, :129-130) and InvalidParameters once
                    (claim_damm_v2.test.ts:268-281)
              Impact: authorization is this program's core security property and none of its guards has a test
                      proving it rejects — F-006.
              Fix: add the five negative tests listed in F-006's recommendation.
[PASS]      FV-039: The one recorded security fix has a matching regression test: CHANGELOG.md:33 describes
                    rejecting `skip_reward != 0` for damm_v2 claim_reward, and
                    tests/claim_damm_v2.test.ts:222-282 asserts exactly that rejection by error code.
[FAIL-3]    FV-040: Tests run on every PR, but two gates make "green" weaker than it looks.
              File: .github/workflows/ci.yml:26-28 (`files: programs/dynamic-fee-sharing`), :33 and :48
                    (`if: needs.program_changed_files.outputs.program == 'true'`)
              Impact: a PR touching only tests/, libs/, idls/, Anchor.toml, Cargo.toml, or .github/ — including a
                      PR that edits the workflow itself — runs no tests at all. Compounded by FV-069 — F-006.
              Fix: widen the changed-files filter, or drop the gate for the cargo_test job.
[PASS]      FV-041: The test environment mirrors production closely: the suite loads the actual compiled
                    dynamic_fee_sharing.so (tests/common/svm.ts:24-27, tests/fee_sharing.test.ts:40-43) plus real
                    DAMM v2 and DBC binaries as fixtures (tests/common/svm.ts:29-37), and the toolchain is pinned
                    (rust-toolchain.toml:2, .github/workflows/ci.yml:10-12).
[PASS]      FV-042: No test is skipped or ignored — `.skip(`, `.only(` and `#[ignore]` all return zero hits.
[FAIL-2]    FV-043: Mutation testing has never been run.
              File: repository root — no cargo-mutants or Stryker configuration
              Impact: given FV-069, mutation testing would immediately surface that the two fullFlow tests cannot
                      fail — F-006.
              Fix: run cargo-mutants once over programs/dynamic-fee-sharing and triage survivors.
[N/A]       FV-044: There are no endpoints to load-test. The on-chain analogue (CU profiling) is FV-067.
[PASS]      FV-045: No test uses a hardcoded secret, private key, or real credential — every keypair is generated
                    at runtime (`Keypair.generate()` / `generateUsers`, tests/common/index.ts:236-245,
                    tests/common/svm.ts:77-86).
[PARTIAL]   FV-046: Tests are structurally deterministic but use fresh random keypairs on every run and do not seed
                    the proptest RNG explicitly; combined with .gitignore:11, a failing seed is not preserved.
[PASS]      FV-047: Every external call is explicitly handled: both invoke_signed sites propagate with `?`
                    (utils/token.rs:135, :168; ix_fund_by_claiming_fee.rs:118-126), and every fallible math call
                    maps to a typed error (state/fee_vault.rs:96, :113-115; math/safe_math.rs).
[PASS]      FV-048: Errors are Anchor error codes with fixed messages (error.rs:5-40) and leak nothing about
                    internal state. The one diagnostic message, `msg!("Math error thrown at {}:{}")`
                    (math/safe_math.rs:24), emits a source location — see Notes & Nitpicks for why it currently
                    points at safe_math.rs itself.
[PASS]      FV-049: There is no panic path on user input. No `unwrap()`, `expect()`, `panic!` or unchecked index
                    appears outside `#[cfg(test)]` code (grep confirms all hits are in math/safe_math.rs:120-160,
                    const_pda.rs:22-30 and src/tests/fund_fee.rs). The two potential panic sites are guarded:
                    `users.get_mut(index as usize).ok_or_else(...)` (state/fee_vault.rs:104-107) and
                    `payload[..8]` behind `require!(payload.len() >= 8)` (ix_fund_by_claiming_fee.rs:62-64).
[N/A]       FV-050: There are no HTTP status codes to distinguish.
[PARTIAL]   FV-051: The on-chain analogue of resource exhaustion is the compute budget. It is structurally bounded
                    (all loops <= 9 iterations) but never profiled or budgeted — see FV-067.
[N/A]       FV-052: There are no network calls; the Solana runtime bounds every CPI by the compute budget.
[PASS]      FV-053: Partial failure cannot occur — Solana transactions are atomic, so any failure reverts every
                    state write in the instruction. No compensation or rollback logic is needed.
[PASS]      FV-054: No error is swallowed anywhere: every fallible call uses `?` or `.ok_or_else(...)?`
                    (state/fee_vault.rs:96, :113; math/math_utils.rs:10-11, :19, :21).
[PASS]      FV-055: The program returns 11 specific error variants (error.rs:7-40) and never a bare ProgramError.
[PASS]      FV-056: Error handling is by early return with a distinct variant per failure mode rather than by
                    matching, so there is no non-exhaustive match to miss a case.
[FAIL-3]    FV-057: There is no circuit breaker or fallback for the external DAMM v2 / DBC dependency.
              File: programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:31-41, 118-126
              Impact: if either callee changes the account ordering of a whitelisted instruction,
                      fund_by_claiming_fee either breaks outright or validates the wrong slot, and there is no
                      on-chain switch to disable the path short of an upgrade — F-002 / F-007.
              Fix: add the kill switch proposed in F-002.
[PASS]      FV-058: Exceptional conditions in financial math are blocked, not wrapped: division by zero is guarded
                    twice (math/math_utils.rs:6-7, :11), every accumulator uses checked arithmetic
                    (math/safe_math.rs), and `overflow-checks = true` is set for the release profile
                    (Cargo.toml:8). All balances are unsigned and every subtraction is checked.
[PASS]      FV-059: An in-process SVM suite exists and loads the real compiled .so rather than a mock —
                    tests/common/svm.ts:24-27 and tests/fee_sharing.test.ts:40-43, with `bun run build`
                    (i.e. `anchor build --ignore-keys`) run first via package.json:8.
[N/A]       FV-060: There is no time-locked or deadline instruction in the program to test on both sides.
[PASS]      FV-061: Time-dependent behaviour is driven through the clock sysvar, not wall-clock waiting —
                    `svm.setClock` in warpToTimestamp (tests/common/svm.ts:107-111), used at
                    tests/claim_damm_v2.test.ts:196 and :266.
[N/A]       FV-062: There is no account-closure instruction to verify post-close fields for.
[PARTIAL]   FV-063: Re-initialization is structurally prevented by Anchor `init` (AV-053) but no test asserts it —
                    nothing calls createFeeVaultPda twice with the same `base` and checks the failure.
              Fix: add that test; it is three lines and locks in the guarantee.
[FAIL-4]    FV-064: Authorization negatives are entirely untested through the SVM.
              File: tests/ — no test sends claim_fee from a non-holder, claim_fee with a foreign index,
                    fund_by_claiming_fee from a non-holder, fund_by_claiming_fee with a non-whitelisted
                    (program, discriminator), or fund_by_claiming_fee against a fee_vault_type == 0 vault
              Impact: the guards at state/fee_vault.rs:108 and ix_fund_by_claiming_fee.rs:80-89 are correct but
                      unproven by the suite — a refactor could remove one and CI would stay green — F-006.
              Fix: add the five negative tests; the helper expectThrowsErrorCode (tests/common/svm.ts:88-105)
                   already makes each one short.
[PARTIAL]   FV-065: Arithmetic edges are tested at the Rust unit level (math/safe_math.rs:120-160) and by the
                    proptest, but not through the SVM: no LiteSVM test sends fund_fee(0), fund_fee(u64::MAX), or
                    a second consecutive claim.
[PASS]      FV-066: Token balances are asserted explicitly after transfers, not merely "tx succeeded" —
                    `expect(tokenVaultBalance).eq(fundAmount)` (tests/fee_sharing.test.ts:238),
                    `expect(userTokenBalance).eq(feeClaimed)` (:272-274), and the funding-delta equality in every
                    CPI test. *Qualified by FV-069:* in the two fullFlow helpers those assertions sit inside a
                    success branch.
[FAIL-2]    FV-067: Compute-unit consumption is never profiled or recorded.
              File: tests/ — no CU assertion or baseline anywhere
              Impact: fund_by_claiming_fee forwards an unbounded account list into a CPI
                      (ix_fund_by_claiming_fee.rs:94-110); without a baseline, a CU regression there would only
                      surface in production — F-006.
              Fix: record CU for initialize, fund, claim, and fund_by_claiming_fee, and assert an upper bound.
[PASS]      FV-068: No test relies on a stale blockhash — `tx.recentBlockhash = svm.latestBlockhash()` is set
                    immediately before every send (tests/fee_sharing.test.ts:183, :227, :261;
                    tests/common/dfs.ts:64, :95; tests/common/index.ts:126, :153, :180), which is equivalent to
                    expiring and re-fetching.
[FAIL-3]    FV-069: Failure-path handling is inverted in the two headline tests: they log on failure and pass.
              File: tests/fee_sharing.test.ts:188-206, :232-242, :266-277;
                    tests/fee_sharing_pda.test.ts:194-212, :238-248, :272-283
              Impact: `if (res instanceof TransactionMetadata) { ...assert... } else { console.log(...) }` means a
                      transaction that fails produces a PASSING test. The "Full flow" test for both vault variants
                      — the only end-to-end coverage of initialize_fee_vault, fund_fee and claim_fee — cannot
                      fail for the most important reason a test should. The correct pattern is already in the
                      repository at tests/common/svm.ts:71 — F-006.
              Fix: replace the conditional with `expect(res).instanceOf(TransactionMetadata)` and assert
                   unconditionally.
[PASS]      FV-070: Test PDA derivations use the same seeds as on-chain — deriveFeeVaultAuthorityAddress
                    ("fee_vault_authority"), deriveTokenVaultAddress ("token_vault", feeVault) and
                    deriveFeeVaultPdaAddress ("fee_vault", base, tokenMint) at tests/common/index.ts:73-98,
                    matching constants.rs:7-11 exactly. Mainnet replay is used only for the .so fixtures
                    (tests/common/svm.ts:29-37), never for a security assertion.
[PARTIAL]   FV-071: The suite uses LiteSVM — an appropriate in-process harness — plus one proptest. For a program
                    that custodies claimed protocol fees and signs arbitrary-argument CPIs with a PDA, none of
                    Trident (stateful instruction-sequence fuzzing), Crucible, Kani, or Certora is present.
                    fund_by_claiming_fee's payload/account-list surface is precisely what stateful fuzzing targets.
              Fix: see FV-024 and the maturity roadmap.
[PARTIAL]   FV-072: The on-chain half of the transaction-v1 concern is not applicable — there is no ComputeBudget
                    introspection, no fee sponsor, and no indexer in this repository (AV-089, AV-090, KV-135).
                    What could not be determined offline is whether the pinned harness (`litesvm ^0.1.0`,
                    package.json:15) runs with the v1 gate active, so 4,096-byte transactions and no-op budget
                    instructions may be uncovered by the suite.
              Fix: pin a LiteSVM/validator version with the v1 gate active and add one v1-format transaction test.
```

---
### Out-of-Scope Checklists (rendered from the scope gate, Rule 0)

> These files were **never read**. The verdicts below are generated by the scope gate, not by inspection.

```
[N/A — out of scope: --scope program; no backend/frontend TypeScript, only a LiteSVM test harness]
            TS-001 … TS-064   (Checklist 08, 64 items)
[N/A — out of scope: --scope program; no backend exists in this repository]
            BE-001 … BE-131   (Checklist 09, 131 items)
[N/A — out of scope: --scope program; no frontend exists in this repository]
            FE-001 … FE-084   (Checklist 10, 84 items)
[N/A — out of scope: --scope program; dependency surface partially covered by OPS-075 and KV-080]
            SC-001 … SC-052   (Checklist 11, 52 items)
[N/A — out of scope: --scope program; secret surface partially covered by OPS-027..036 and KV-001]
            SEC-001 … SEC-053 (Checklist 12, 53 items)
[N/A — out of scope: --scope program; deploy surface partially covered by OPS-001..012 and OPS-062..068]
            DEP-001 … DEP-089 (Checklist 13, 89 items)
[N/A — out of scope: no Python file exists in the repository]
            PY-001 … PY-082   (Checklist 14, 82 items)
[N/A — out of scope: no Go / Java / Ruby / PHP file exists in the repository]
            GL-001 … GL-088   (Checklist 15, 88 items)
[N/A — out of scope: --scope program; event-emission surface partially covered by SM-047..050 and OPS-044..052]
            LM-001 … LM-065   (Checklist 17, 65 items)
[N/A — out of scope: --scope program; no PII is handled — Solana pubkeys only]
            PC-001 … PC-060   (Checklist 18, 60 items)
[N/A — out of scope: no .mcp.json, no agent SDK, no LLM dependency; no CLAUDE.md / AGENTS.md / .cursorrules
       exists in the tree (both are listed in .gitignore:14 but absent), so there is also no
       prompt-injection surface to assess]
            AI-001 … AI-033   (Checklist 19, 33 items)
[N/A — out of scope: --scope program; the only .rs outside programs/ is libs/damm-v2/src/lib.rs and
       libs/dynamic-bonding-curve/src/lib.rs, 5 lines each containing only declare_program! CPI shims]
            RS-001 … RS-021   (Checklist 20, 21 items)
```

---

## 6. Known Vector Results

### In-scope vectors (55 evaluated)

```
[PASS*]     KV-001  Private Key Leak: no keypair, .env, or .pem is tracked at this commit (file list enumerated);
                    .gitignore:1-3 excludes .anchor and target; CI generates a throwaway localnet keypair only
                    (.github/actions/setup-solana/action.yml:18). *confidence: medium — git history was not swept
                    (shell unavailable). See OPS-036.
[N/A]       KV-002  Flash Loan Price Manipulation — feature absent: no flash-loan path, no oracle, no
                    oracle-priced deposit/withdraw (grep flash|pyth|switchboard over programs/: zero hits).
                    Shares are fixed at init and cannot be acquired.
[PARTIAL]   KV-003  Reentrancy (CPI): all CPI targets are trusted, whitelisted programs (constants.rs:19-67,
                    checked at ix_fund_by_claiming_fee.rs:31-32), and the Solana runtime forbids reentry into a
                    program already on the call stack. Two of three CPI handlers write state before the call
                    (state/fee_vault.rs:117-118; ix_fund_fee.rs:37); fund_by_claiming_fee writes after
                    (:136) because the credit IS the measured delta. The vector's Step 4 also flags a
                    user-supplied CPI target account — here validated at runtime rather than by type. See F-002.
[PARTIAL]   KV-004  Missing Access Control: every instruction has a Signer and the two sensitive ones bind that
                    signer to state (state/fee_vault.rs:108; ix_fund_by_claiming_fee.rs:80-83). What is missing is
                    not a signer check but a destination constraint on a privileged CPI — recorded at KV-016 / F-001.
                    Defense-in-depth: has_one is not doubled by require_keys_eq! (AV-021).
[N/A]       KV-005  Oracle Manipulation — feature absent: no price feed of any kind (grep: zero hits).
[N/A]       KV-006  First Depositor / Share Inflation — feature absent: no share minting, no deposit-for-shares.
                    `share` values are written once at init (state/fee_vault.rs:76-83) and no instruction mints,
                    burns, or transfers them.
[N/A]       KV-007  MEV Sandwich — feature absent: no swap, no route, no slippage parameter in this program.
[PARTIAL]   KV-008  Rug Pull / Admin Backdoor: no in-program backdoor exists — OPS-013 through OPS-025 all PASS
                    (no hidden instruction, no god-mode account, no hardcoded-pubkey branch, no unsafe, no raw
                    pointers, declare_id matches). The residual risk is the BPF upgrade authority, which is
                    unverified offline (OPS-001..012) and can by definition replace claim_fee and drain every
                    vault (OPS-011). No timelock and no verifiable build (OPS-026).
[PARTIAL]   KV-009  Unchecked CPI Target: the target program is an UncheckedAccount (ix_fund_by_claiming_fee.rs:22)
                    validated at runtime against two hardcoded IDs (:31-32) rather than by an Anchor Program<>
                    type — the vector's own "⚠️ manual checks that are correct but not compile-time enforced"
                    case. remaining_accounts are never used as a CPI target (Step 4 passes). The instruction DATA
                    is unvalidated — F-002.
[PASS]      KV-010  PDA Confusion / Type Cosplay: a single account type, read through AccountLoader (owner +
                    8-byte discriminator enforced); seeds are complete and canonical (PDA-001..013, AV-076); no
                    manual try_deserialize anywhere.
[PASS]      KV-011  Integer Overflow / Underflow: every operation is checked — safe_add/sub/mul/div
                    (math/safe_math.rs), checked_shl and checked_div (math/math_utils.rs:10-11), U256 widening
                    (:17-19) — with `overflow-checks = true` on the release profile (Cargo.toml:8) and no `as`
                    truncation cast anywhere (AR-015, AR-016, AR-017).
[PASS]      KV-012  Arithmetic Rounding Exploit: multiply/shift before divide in both directions
                    (math/math_utils.rs:9-11, :17-20); Q64.64 precision (constants.rs:5); rounding always toward
                    the vault, so no caller can extract dust — a repeated claim yields delta = 0
                    (state/fee_vault.rs:110). The residue is < 1 base unit per claim and is stranded, not
                    extractable (F-008).
[PASS]      KV-013  Missing Signer Check: Signer<'info> on all five instructions (ix_fund_fee.rs:23,
                    ix_claim_fee.rs:29, ix_fund_by_claiming_fee.rs:19, ix_initialize_fee_vault.rs:90,
                    ix_initialize_fee_vault_pda.rs:59, :62), with state binding at state/fee_vault.rs:108 and
                    ix_fund_by_claiming_fee.rs:80-83.
[PASS]      KV-014  Account Reinitialization: both creation paths use Anchor `init`
                    (ix_initialize_fee_vault.rs:51, ix_initialize_fee_vault_pda.rs:16); init_if_needed is used
                    nowhere (grep: zero hits) and there is no manual initialization path.
[PASS]      KV-015  Unchecked Account Owner: every account is Anchor-typed and therefore owner-checked. The three
                    UncheckedAccounts are each constrained by other means — fee_vault_authority by
                    `address =` / seeds+bump, source_program by the runtime whitelist comparison, and `owner`
                    is never read at all (F-008).
[FAIL-7]    KV-016  Token Account Mismatch: a token account used by a CPI has neither its mint nor its authority
                    verified.
              File: programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:35-36
              Impact: the second token's destination in four whitelisted actions is caller-chosen, so any single
                      share holder can capture 100% of that fee stream — F-001.
              Fix: pin every value-receiving index to a vault-controlled account, or force the corresponding
                   max_* argument to 0 — see F-001.
              (Lower-severity companion: fund_token_vault and user_token_vault lack token::mint / token::authority
               constraints — AV-045, AV-046 — but there the mint is bound by transfer_checked and the destination
               is the signer's own choice.)
[PASS]      KV-017  Vault Donation Attack: entitlement never reads the raw vault balance — it is computed purely
                    from fee_per_share and the per-slot checkpoint (state/fee_vault.rs:110-115). Donating to
                    token_vault changes nobody's claim. The balance delta in fund_by_claiming_fee measures only
                    the CPI's own effect, bracketed at :91 and :128-132.
[PARTIAL]   KV-018  Fee-on-Transfer Token Exploit: transfer_checked is used everywhere (utils/token.rs:117, :150),
                    CPI funding credits a true post-transfer delta (ix_fund_by_claiming_fee.rs:128-132), and the
                    Token-2022 extension allowlist explicitly permits TransferFeeConfig with matching accounting
                    (utils/token.rs:47-51, :63-84). The gap is that fund_fee credits a *computed* net rather than
                    a measured one (ix_fund_fee.rs:33-37) — equivalent today, but an assumption rather than an
                    observation. See AV-062 / EXT-014.
[FAIL-5]    KV-019  Freeze Authority Griefing: arbitrary mints are accepted with no freeze-authority check and
                    there is no recovery path — the vector's own "❌" case.
              File: programs/dynamic-fee-sharing/src/utils/token.rs:37-55 (Step 2 fails: freeze_authority is
                    never read on either token-program path); lib.rs:17-48 (Step 3 fails: no emergency, rescue,
                    recover, or close instruction exists)
              Impact: the mint's freeze authority can freeze token_vault, making every claim revert permanently —
                      F-003.
              Fix: reject mints with a live freeze authority and/or add an owner-gated sweep — see F-003.
[PARTIAL]   KV-020  Program Upgrade Hijack: an upgrade can replace claim_fee and drain every vault (OPS-011). The
                    authority's custody, threshold, and timelock are all UNKNOWN offline (OPS-001..012, OPS-037..043),
                    no verifiable build exists (OPS-026, OPS-070), and no keypair is in the repository (OPS-028).
                    Reported as PARTIAL rather than FAIL because the failing condition — a hot single-key
                    authority — is unconfirmed, not because it is ruled out.
[N/A]       KV-021  Governance Attack (Vote Buying) — feature absent: no realm, proposal, vote_record, or
                    voter_weight (grep: zero hits). The program has no governance surface.
[N/A]       KV-022  Bridge Exploit (Fake Proof) — feature absent: no guardian, vaa, emitter, verify_signatures, or
                    attestation (grep: zero hits).
[PASS]      KV-023  Token-2022 Transfer Hook Attack: a transfer-hook mint can never become a vault mint —
                    is_supported_mint allows only {TransferFeeConfig, MetadataPointer, TokenMetadata} and rejects
                    everything else, TransferHook included (utils/token.rs:47-51). No hook accounts therefore need
                    resolving, and no hook program can re-enter during a vault transfer.
[PARTIAL]   KV-024  Stale / Missing Account Close: there is no close instruction and no realloc anywhere (grep:
                    zero hits), so no stale-close or lamport-reclaim hazard exists — but neither does any
                    reclamation path. Rent, rounding residue, and donated tokens are permanently locked — F-008.
[PASS]      KV-025  Compute Budget Exhaustion DoS: every loop is bounded — 5 iterations over the roster
                    (state/fee_vault.rs:76, :124), 9 over the whitelist (ix_fund_by_claiming_fee.rs:31) — and
                    there is no panic site on user input (FV-049). remaining_accounts are cloned once
                    (ix_fund_by_claiming_fee.rs:94-110), which is O(n) in a value the transaction size already
                    caps, with no per-item work beyond the clone. No caller can inflate another caller's cost.
                    (CU is nonetheless unprofiled — FV-067.)
[PASS]      KV-026  PDA Seed Collision: all seeds are fixed-length byte strings and 32-byte pubkeys (PDA-011);
                    the vault PDA's seed set includes a caller-signed `base` (ix_initialize_fee_vault_pda.rs:59),
                    so no attacker-chosen seed material can be steered into a collision.
[N/A]       KV-027  Missing Discriminator Check — feature absent: remaining_accounts are never deserialized by
                    this program; they are cloned and forwarded (ix_fund_by_claiming_fee.rs:106-110). Named
                    accounts are all Anchor-typed, which checks the discriminator automatically.
[PARTIAL]   KV-028  Front-Running Transaction: claim_fee is not front-runnable for value — the payout is fully
                    determined by state (state/fee_vault.rs:110-115). fund_by_claiming_fee is: a share holder can
                    front-run an honest funding call with a diverting variant that differs only in one account and
                    two argument words — F-001.
[N/A]       KV-029  Withdraw-Before-Update Race — feature absent: there is no NAV, no price, and no staleness
                    window. The claim amount is a deterministic function of a monotone accumulator, so there is no
                    stale-value gap to race.
[N/A]       KV-030  Infinite Mint / Uncapped Supply — feature absent: no mint_to, no mint authority, no supply
                    tracking (grep: zero hits). Shares are u32 state fields written once at init.
[FAIL-4]    KV-080  CI/CD Pipeline Injection: Step 2 passes (no pull_request_target — .github/workflows/ci.yml:3-7
                    uses `pull_request`), Step 3 passes (no secret is echoed; `grep secrets.` over .github/
                    returns zero hits), but Step 4 fails (no action is SHA-pinned; `dtolnay/rust-toolchain@stable`
                    is a mutable *branch*), Step 5 fails (no `permissions:` block at any level), and Step 6 is
                    marginal (four third-party vendors, all unpinned, one with a documented tag-repointing
                    compromise).
              File: .github/workflows/ci.yml:20,25,35,36,41,50,55,57,62,64;
                    .github/actions/setup-anchor/action.yml:6,8,14; .github/actions/setup-solana/action.yml:6,14
              Impact: attacker code in the runner on every PR; bounded by the absence of a deploy job and of
                      declared secrets — F-004.
              Fix: SHA-pin, declare least-privilege permissions, checksum-verify the Anza installer.
[UNKNOWN]   KV-091  Upgrade Authority Not Secured: Steps 1, 2 and 4 require `solana program show`, which was not
                    available offline. Step 3 PASSES — no upgrade-authority keypair or hardcoded authority appears
                    anywhere in the repository (OPS-028). Carried into §10.C as an explicit client follow-up.
[N/A]       KV-101  Sysvar Spoofing & Instructions-Sysvar Introspection — feature absent: no sysvar account
                    appears in any Accounts struct, and Clock is read via the syscall (utils/token.rs:100).
[N/A]       KV-102  Precompile Signature Verification Bypass — feature absent: no ed25519/secp256k1 precompile
                    use. `const_crypto::ed25519` (const_pda.rs:2) is a compile-time PDA-derivation helper that
                    runs at build time, not a runtime signature check.
[N/A]       KV-103  Address Lookup Table Manipulation — feature absent: no ALT handling in-program (grep
                    address_lookup_table|AddressLookupTable: zero hits). Privileged accounts are bound by
                    `address =` / has_one / seeds, never by transaction position (AV-075).
[PASS]      KV-104  Non-Canonical Bump / PDA Derivation Confusion: bumps are canonical everywhere —
                    `ctx.bumps.fee_vault` is stored (ix_initialize_fee_vault_pda.rs:81 -> state/fee_vault.rs:86)
                    and replayed for signing (ix_fund_by_claiming_fee.rs:114-115); the authority bump is derived at
                    compile time and unit-tested against find_program_address (const_pda.rs:7-13, :22-30). No
                    user-supplied bump reaches create_program_address (grep: zero hits).
[PARTIAL]   KV-105  Token-2022 Extension Abuse: Step 3 largely PASSES — the extension allowlist
                    (utils/token.rs:47-51) rejects PermanentDelegate, DefaultAccountState, MintCloseAuthority,
                    TransferHook, ConfidentialTransfer and InterestBearingConfig. Step 4 PASSES for CPI funding
                    (true balance delta) and is equivalent-but-computed for direct funding (KV-018). Step 5 FAILS:
                    freeze_authority is a base-Mint field, not an extension, and is never read — and the
                    classic-SPL path returns Ok(true) with no inspection at all (:39-41). See F-003.
[N/A]       KV-106  Account Revival / Zombie After Close — feature absent: there is no close instruction
                    (grep `close =`: zero hits), so no account can be closed and revived.
[N/A]       KV-107  Fake / Non-Canonical ATA — feature absent: the program never derives or assumes an associated
                    token account. token_vault is a seeded PDA token account created with Anchor `init`
                    (ix_initialize_fee_vault.rs:67-78), and its address is pinned thereafter by has_one.
[PASS]      KV-108  Token Decimals & Cross-Mint Amount Confusion: decimals are read from the mint at every
                    transfer (utils/token.rs:125, :158), never hardcoded; a vault handles exactly one mint
                    (has_one = token_mint), so no amounts from different mints are ever added or compared.
[N/A]       KV-109  Pinocchio / p-token Missing Manual Validation — feature absent: this is an Anchor 1.0 program
                    (grep pinocchio|p-token|no_std|entrypoint!: zero hits); owner, discriminator, signer and
                    mut checks are all framework-provided.
[N/A]       KV-118  Stake Account Authority Hijack — feature absent: no stake-program interaction (grep
                    stake|StakeProgram|authorized|staker|withdrawer: zero hits).
[N/A]       KV-119  Durable-Nonce Pre-Signed Governance Abuse — feature absent: no durable-nonce use, and no
                    admin or governance instruction exists that a pre-signed transaction could outlive.
[N/A]       KV-120  On-Chain Randomness Predictability — feature absent: no randomness, VRF, lottery, or
                    reward-selection logic (grep random|vrf|slot_hashes|blockhash: zero hits).
[N/A]       KV-121  cNFT / Account-Compression Merkle Proof Abuse — feature absent: no compression, merkle, or
                    bubblegum interaction (grep: zero hits).
[PARTIAL]   KV-122  Inner-Instruction / Event-Log Spoofing: the consumer side is N/A — no off-chain component in
                    this repository ingests program logs. The vector's Step 4 (on-chain emits must not be
                    attacker-shapable) is where it lands: fund_by_claiming_fee **suppresses** EvtFundFee entirely
                    when the measured delta is zero (ix_fund_by_claiming_fee.rs:134-145), so a value-diverting
                    call produces no event at all; and the event it does emit echoes the caller's payload verbatim
                    (event.rs:20, ix_fund_by_claiming_fee.rs:141), handing any future indexer attacker-controlled
                    bytes in a field it may treat as protocol data. See F-005.
              Fix: emit on every call (including funded_amount = 0) and replace the raw payload with a typed
                   action identifier.
[PASS]      KV-123  Lamport-Donation Account Bricking: no instruction reads, compares, or asserts a lamport
                    balance anywhere — `lamports` does not appear in programs/ (grep: zero hits) — so no
                    exact-balance assumption exists to break by donation. No builtin, sysvar, or precompile
                    account is marked mut, so a read-only demotion cannot break any instruction (AV-085, AV-086).
[N/A]       KV-125  Bonding-Curve Launchpad Graduation & Migration Abuse — feature absent in this program: no
                    curve, no reserves, no graduation, no migration (grep: zero hits). The DBC pool has them; it
                    is an external program, out of scope (see §10.D Assumptions).
[PASS]      KV-127  ATA / Account Pre-Creation DoS: neither init path is front-runnable. The PDA variant's address
                    depends on a caller-signed `base` (ix_initialize_fee_vault_pda.rs:59) and the keypair variant
                    requires that keypair to sign (ix_initialize_fee_vault.rs:52), so an attacker cannot predict
                    either address to pre-create it. No ATA is created by the program at all.
[PASS]      KV-128  On-Chain Floating-Point Financial Math: no f32, f64, `as f64`, powf, powi, sqrt, ln or exp
                    appears anywhere in programs/ (grep: zero hits). All value math is Q64.64 fixed point over
                    checked integers (constants.rs:5, math/math_utils.rs, math/safe_math.rs).
[N/A]       KV-129  Keeper Request->Execute Front-Running — feature absent: there is no keeper, no crank, and no
                    two-step request/execute split (grep keeper|crank: zero hits). Every instruction settles
                    within one transaction.
[N/A]       KV-130  CLMM/DLMM Tick-Boundary & Liquidity Math — feature absent: no tick, sqrt_price, liquidity_net,
                    bin_array, or fee_growth anywhere in this program (grep: zero hits).
[PASS]      KV-131  Write-Lock Account Contention DoS: each FeeVault is an independent account written only by its
                    own <= 5 share holders; there is no global hot writable PDA. fee_vault_authority is read-only
                    in every context (ix_claim_fee.rs:16-19) and is never marked mut, so it creates no write-lock
                    contention across vaults.
[N/A]       KV-134  Token ACL (SRFC-37) Gate-Program Bypass — feature absent: no token_acl, TACLkU6, MINT_CFG,
                    gating_program, or thaw_permissionless reference (grep: zero hits). Related note:
                    DefaultAccountState mints are already rejected by the extension allowlist
                    (utils/token.rs:47-51).
[N/A]       KV-135  Transaction v1 Fee-Sponsor Cap Bypass & Disabled ComputeBudget Gates — feature absent: the
                    program is not a fee sponsor or paymaster, it never co-signs a user-built transaction, and it
                    reads no ComputeBudget instruction from the Instructions sysvar (grep ComputeBudget|
                    load_instruction_at|feePayer|sponsor|paymaster: zero hits). See AV-089, AV-090.
```

### Out-of-scope vectors (81, rendered from the scope gate)

```
[N/A — out of scope: --scope program; no backend exists]        KV-031 … KV-055  (25 vectors)
[N/A — out of scope: --scope program; no frontend exists]       KV-056 … KV-075  (20 vectors)
[N/A — out of scope: --scope program; checklists 11-13 not loaded. KV-080 and KV-091 were pulled IN and
       are evaluated above, because checklist 07 §7.1/§7.7-7.8 covers those surfaces and the repository
       ships CI workflows.]
                                                                KV-076 … KV-079, KV-081 … KV-090,
                                                                KV-092 … KV-100  (23 vectors)
[N/A — out of scope: checklists 19/20 not loaded; no AI agent and no off-chain Rust service]
                                                                KV-110 … KV-117  (8 vectors)
[N/A — out of scope: custody / off-chain domain; no wallet, key-export, or session component exists]
                                                                KV-124, KV-126   (2 vectors)
[N/A — out of scope: no token list or third-party risk API is consumed anywhere (intake Q18/Q22)]
                                                                KV-132, KV-133   (2 vectors)
[N/A — out of scope: reader/indexer domain; no getTransaction, getBlock, blockSubscribe, or Geyser
       consumer exists in this repository]
                                                                KV-136           (1 vector)
```

---

### Audit Metrics

| Metric | Value |
|--------|-------|
| Total items evaluated (in scope) | 591 |
| PASS | 209 (35.4%) |
| FAIL | 37 (6.3%) |
| PARTIAL | 68 (11.5%) |
| N/A | 245 (41.5%) |
| UNKNOWN (not observable offline) | 32 (5.4%) |
| **Pass rate** (excl. N/A) | **60.4%** (209 / 346) |
| **Highest severity found** | **7** |
| **Repository Risk Score** | **7 — 🟠 HIGH (fix first)** |

> Risk-score derivation (OUTPUT-RULES Rule 1): no finding is >= 9, one finding is >= 7, therefore
> `REPO SCORE = max(finding) = 7`. The 37 item-level FAILs de-duplicate by root cause into the
> 10 finding blocks counted in the Severity Distribution (§1).
>
> Pass rate excludes N/A but **includes** the 32 `[UNKNOWN]` items as non-passes. Excluding those as
> well — i.e. counting only items this offline review could actually decide — the pass rate is
> **66.6%** (209 / 314).

### Known Vector Metrics

| Metric | Value |
|--------|-------|
| Total known vectors (corpus) | 136 |
| In-scope vectors | 55 |
| PASS | 17 |
| FAIL | 3 (KV-016 @ 7, KV-019 @ 5, KV-080 @ 4) |
| PARTIAL | 10 |
| N/A (feature provably absent, evidence-backed) | 24 |
| UNKNOWN (not observable offline) | 1 (KV-091) |
| Out-of-scope (rendered from the gate) | 81 |
| **Completion (in-scope)** | **100%** (55 / 55) |

### Per-Checklist Summary

| # | Checklist | Items | Pass | Fail | Partial | N/A | Unknown | Pass Rate |
|---|-----------|------:|-----:|-----:|--------:|----:|--------:|----------:|
| 01 | Account Validation | 90 | 38 | 5 | 13 | 34 | 0 | 67.9% |
| 02 | Access Control | 50 | 19 | 3 | 3 | 25 | 0 | 76.0% |
| 03 | Arithmetic Safety | 63 | 32 | 0 | 2 | 29 | 0 | 94.1% |
| 04 | CPI & PDA Safety | 70 | 27 | 2 | 6 | 35 | 0 | 77.1% |
| 05 | State Machine & Lifecycle | 72 | 28 | 3 | 6 | 35 | 0 | 75.7% |
| 06 | Economic & Logic | 89 | 24 | 5 | 6 | 54 | 0 | 68.6% |
| 07 | OpSec & Governance | 85 | 21 | 4 | 9 | 19 | 32 | 31.8% |
| 16 | Formal Verification & Testing | 72 | 20 | 15 | 23 | 14 | 0 | 34.5% |
| | **In-scope total** | **591** | **209** | **37** | **68** | **245** | **32** | **60.4%** |
| | Known vectors (in scope) | 55 | 17 | 3 | 10 | 24 | 1 | 54.8% |

---
## 7. Instruction Matrix & State Model Verification

> Combines the report-format's Instruction Matrix and State Model Verification sections, since the
> program's state model is a single account and the two read naturally together.

### 7.1 Instruction Matrix

| Instruction | File | Signers | CPI calls | PDA seeds used | Checked math | State changes | Findings |
|---|---|---|---|---|---|---|---|
| `initialize_fee_vault` | `ix_initialize_fee_vault.rs:98-122` | `fee_vault` (fresh keypair), `payer` | System (2× `init`), Token/T22 (`InitializeAccount3` via `init`) | `["token_vault", fee_vault]`; `["fee_vault_authority"]` (address only) | `safe_add` over shares (`state/fee_vault.rs:82`) | writes every `FeeVault` field; `fee_vault_type = 0`, `base = default`, `bump = 0` | F-008, F-009, F-010 |
| `initialize_fee_vault_pda` | `ix_initialize_fee_vault_pda.rs:70-94` | `base`, `payer` | System (2× `init`), Token/T22 | `["fee_vault", base, token_mint]`; `["token_vault", fee_vault]` | `safe_add` over shares | writes every `FeeVault` field; `fee_vault_type = 1`, canonical bump stored | F-008, F-009, F-010 |
| `fund_fee` | `ix_fund_fee.rs:28-57` | `funder` (permissionless) | Token/T22 `transfer_checked` (user → vault) | none (authority is the signer) | `safe_add`, `shl_div`, `checked_sub` (transfer-fee) | `total_funded_fee += net`, `fee_per_share += net<<64/total_share` | — |
| `fund_by_claiming_fee` | `ix_fund_by_claiming_fee.rs:58-147` | `signer` — **must be a registered share holder** | **arbitrary whitelisted instruction on DAMM v2 or DBC, signed by the `fee_vault` PDA**, with caller-supplied data and accounts | `["fee_vault", base, token_mint, bump]` (`macros.rs:10-19`) | `safe_sub` (balance delta), `safe_add`, `shl_div` | `total_funded_fee += delta`, `fee_per_share += delta<<64/total_share` — **only when `delta > 0`** | **F-001**, **F-002**, F-005 |
| `claim_fee` | `ix_claim_fee.rs:34-57` | `user` — must match `users[index].address` | Token/T22 `transfer_checked` (vault → user), signed by `fee_vault_authority` | `["fee_vault_authority", bump]` (`macros.rs:1-8`) | `safe_sub`, `mul_shr` (U256), `safe_add`, `try_into` | `users[index].fee_per_share_checkpoint = fee_per_share`, `users[index].fee_claimed += paid` | F-003 (frozen-vault deadlock) |

### 7.2 Account Types

| Account | Discriminator | Space | Owner | Close target |
|---|---|---|---|---|
| `FeeVault` (`state/fee_vault.rs:27-45`) | ✅ 8-byte, via `#[account(zero_copy)]` | 8 + 640, pinned by `const_assert_eq!(FeeVault::INIT_SPACE, 640)` @ `:45` | this program | ❌ none — no close instruction exists (F-008) |
| `UserFee` (`state/fee_vault.rs:47-57`) | n/a — inline `#[zero_copy]` struct, 5 per vault, never a standalone account | 80, pinned by `const_assert_eq!` @ `:57` | this program (inside `FeeVault`) | n/a |
| `token_vault` | n/a — SPL/Token-2022 account | token-account size | SPL Token or Token-2022 (bound to the mint's program by `token::token_program`) | ❌ none (F-008) |
| `fee_vault_authority` | n/a — signer-only PDA, never allocated | 0 | n/a (no account data; used purely as a CPI signer) | n/a |

**Zero-copy layout check (performed, not assumed).** Field offsets were computed by hand:
`owner 0..32`, `token_mint 32..64`, `token_vault 64..96`, `token_flag 96`, `fee_vault_type 97`,
`fee_vault_bump 98`, `padding_0 99..112`, `total_share 112..116`, `padding_1 116..120`,
`total_funded_fee 120..128`, `fee_per_share 128..144`, `base 144..176`, `padding 176..240`,
`users 240..640`. Every `u128` starts at a 16-byte-aligned offset (128, 176, and 240 + 64 = 304 +
80·k), and `UserFee` is exactly 80 bytes with its `u128` at internal offset 64. The struct therefore
has no implicit padding on either the SBF target (`align_of::<u128>() == 8`) or the host target
(`align_of::<u128>() == 16`), which is what makes the `bytemuck::Pod` derive sound and the two
`const_assert_eq!` size pins meaningful. ✅ PASS.

### 7.3 State Machine Transitions

```
                    initialize_fee_vault                initialize_fee_vault_pda
                    (permissionless; fresh              (permissionless; `base` must sign)
                     keypair must sign)                            |
                              |                                    |
                              v                                    v
                   FeeVault { type = 0 }                  FeeVault { type = 1 }
                   base = Pubkey::default()               base = <signed base>
                   bump = 0                               bump = canonical
                              |                                    |
                              |  <---- both are terminal ---->     |
                              |     (no close, no roster update,   |
                              |      no type change, ever)         |
                              |                                    |
        +---------------------+------------------+-----------------+
        |                                        |                 |
        v                                        v                 v
   fund_fee (anyone)                    fund_fee (anyone)   fund_by_claiming_fee
   fee_per_share += ...                                     (share holders only;
        |                                        |           REQUIRES type == 1)
        |                                        |           fee_per_share += delta
        +---------------------+------------------+-----------------+
                              |
                              v
                    claim_fee (holder i, own index only)
                    checkpoint_i <- fee_per_share ; pay share_i * delta >> 64
                              |
                              +---- repeatable; delta = 0 is a no-op ----+
                              |                                          |
                              +------------------------------------------+

No terminal/closed state exists. Every FeeVault and token_vault created is permanent (F-008).
```

### 7.4 Invariants Verified

| # | Property | Basis | Status |
|---|---|---|---|
| INV-01 | **Solvency.** `token_vault.amount >= Σᵢ ⌊shareᵢ · (fee_per_share − checkpointᵢ) / 2⁶⁴⌋` | Both directions truncate toward zero: funding credits `⌊A·2⁶⁴/S⌋ ≤ A·2⁶⁴/S` (`math_utils.rs:11`) and a claim pays `⌊sᵢ·Δ/2⁶⁴⌋ ≤ sᵢ·A/S` (`math_utils.rs:20`); summing over i gives `≤ A`. Every increase of `fee_per_share` is backed by tokens delivered in the same instruction (`ix_fund_fee.rs:37-46`; `ix_fund_by_claiming_fee.rs:128-136`). | ✅ PASS |
| INV-02 | **Share conservation.** `total_share == Σ users[i].share` | Established at `state/fee_vault.rs:76-84` from the same array it writes; no instruction mutates either side afterwards (verified by grep across `programs/`). | ✅ PASS |
| INV-03 | **Accumulator monotonicity and bound.** `fee_per_share` never decreases and never overflows `u128` | Only `safe_add` writes it (`state/fee_vault.rs:98`). Bound: `Σ amount ≤ u64::MAX` (enforced by `total_funded_fee.safe_add`, `:93`) and `total_share ≥ 2`, so `fee_per_share ≤ 2⁶⁴·2⁶⁴/2 = 2¹²⁷ < u128::MAX`. | ✅ PASS |
| INV-04 | **Checkpoint validity.** `checkpointᵢ ≤ fee_per_share` for every i, always | Initialized to 0 (`Default::default()` @ `state/fee_vault.rs:80`) and only ever assigned the current `fee_per_share` (`:117`), which is monotone by INV-03. This is what makes the `safe_sub` at `:110` unable to underflow. | ✅ PASS |
| INV-05 | **Credit equals receipt.** Every increase of `fee_per_share` corresponds to tokens actually delivered to `token_vault` in the same instruction | `fund_fee` credits the transfer-fee-excluded amount computed from the token program's own fee function for the current epoch (`ix_fund_fee.rs:33-37`, `utils/token.rs:63-84`); `fund_by_claiming_fee` credits the measured before/after delta (`:91`, `:128-132`). | ✅ PASS |
| INV-06 | **No double-pay.** Repeated `claim_fee` with no intervening funding pays zero | After a claim, `checkpointᵢ == fee_per_share`, so the next delta is 0 (`state/fee_vault.rs:110`) and the transfer is skipped (`ix_claim_fee.rs:38`). | ✅ PASS |
| INV-07 | **Authorization.** Only `users[index].address` can claim slot `index`; only a registered holder can trigger a PDA-signed CPI | `require!(user.address.eq(signer))` @ `state/fee_vault.rs:108`; `require!(is_share_holder(signer))` @ `ix_fund_by_claiming_fee.rs:80-83`. The zeroed tail slots hold `Pubkey::default()` = the System Program address, which cannot sign a transaction. | ✅ PASS |
| INV-08 | **Vault-balance reachability.** Every token in `token_vault` is claimable by someone | ❌ Violated. The truncation residue of INV-01 plus any directly-donated tokens are never credited to `fee_per_share` and there is no sweep or close instruction (`lib.rs:17-48`). | ❌ FAIL — F-008 |
| INV-09 | **Fee-path exclusivity.** Every token the vault's PDA is entitled to reaches `token_vault` | ❌ Violated. For the four two-token whitelisted actions, the second token's destination is caller-chosen (`ix_fund_by_claiming_fee.rs:35-36`). | ❌ FAIL — F-001 |
| INV-10 | **Configuration immutability.** `token_mint`, `token_vault`, `base`, `fee_vault_bump`, `fee_vault_type`, `total_share` and the roster are write-once | Written only inside `FeeVault::initialize` (`state/fee_vault.rs:60-90`), reachable only from the two `init` paths. No other writer exists. | ✅ PASS |

---

## 8. Code Maturity Scorecard

> Engineering-quality gate (FULL-AUDIT Phase 4.5), orthogonal to the risk score. 0 absent · 1 ad-hoc ·
> 2 partial · 3 good · 4 strong. Weakest-link scoring.

| # | Category | Score (0-4) | Evidence (file:line / artifact) | Gap to next level |
|---|----------|:-----------:|---------------------------------|-------------------|
| 1 | Access Controls | **3** | Every instruction carries a `Signer` and the two sensitive ones bind it to state (`state/fee_vault.rs:108`; `ix_fund_by_claiming_fee.rs:80-83`). Roles are minimal and clearly separated; the CPI whitelist is compile-time and unmodifiable on-chain (`constants.rs:19`). | Constrain every value-receiving CPI account, not one (F-001); add `require_keys_eq!` behind the `has_one`s (AV-021). |
| 2 | Arithmetic | **4** | Checked math throughout (`math/safe_math.rs`), U256/u128 widening before every multiply/divide (`math/math_utils.rs:9-20`), `overflow-checks = true` (`Cargo.toml:8`), no `as` truncation cast anywhere, rounding consistently toward the vault, and a 10,000-case property test on the precision boundary (`src/tests/fund_fee.rs:12-21`). | Nothing material. Encode INV-01 as a property test; sweep or document the truncation residue (F-008). |
| 3 | Account & Type Safety | **3** | Typed accounts everywhere (AV-001…AV-008), canonical bumps stored and replayed (AV-076), zero-copy layout pinned by two `const_assert_eq!` (`state/fee_vault.rs:45,57`), `init` never `init_if_needed`, Anchor 1.0 duplicate-mut rejection. | `remaining_accounts` are a blind pass-through (AV-032/033/034); `fund_token_vault` / `user_token_vault` lack `token::mint` / `token::authority`. |
| 4 | Input Validation | **2** | Roster parameters are validated properly and atomically before any write (`ix_initialize_fee_vault.rs:26-44`, `:136` before `:139`); `payload.len() >= 8` guards the only slice index (`ix_fund_by_claiming_fee.rs:62`). | The PDA-signed CPI's instruction data and account list are unvalidated (PDA-019, F-002); reserved `padding` is unchecked (F-009); accepted mints are not vetted for freeze authority (F-003); `remaining_accounts.len()` is unchecked (AV-036). |
| 5 | Testing | **2** | A real LiteSVM suite loading the compiled `.so` and genuine DAMM v2 / DBC binaries (`tests/common/svm.ts:24-37`); **all nine** whitelisted CPI actions exercised end-to-end; one regression test for the one recorded security fix (`tests/claim_damm_v2.test.ts:222-282` ↔ `CHANGELOG.md:33`). | No authorization-negative test at all (FV-064); the two "Full flow" tests pass on transaction failure (FV-069); coverage unmeasured (FV-033); CI skips every test when only non-`programs/` files change (FV-040). All F-006. |
| 6 | Fuzzing & Property Tests | **1** | Exactly one property test, over one function, with a range that excludes 0 and `u64::MAX` (`src/tests/fund_fee.rs:12`). | No fuzz target for `fund_by_claiming_fee` — the program's largest untyped input surface (FV-024); `proptest-regressions` is gitignored (`.gitignore:11`, FV-025); no Trident/Kani/Certora (FV-071); no documented invariants (FV-001). |
| 7 | Error Handling & DoS Resilience | **3** | Zero `unwrap()`/`expect()`/`panic!` outside `#[cfg(test)]` (FV-049); 11 typed error variants (`error.rs:7-40`); every fallible call propagated; all loops bounded by 5 or 9; division guarded twice. | No recovery path when `token_vault` is frozen (F-003); no CU profiling baseline (FV-067); no circuit breaker for the external dependency (FV-057). |
| 8 | Upgradeability & Governance | **1** | The one positive: the CPI whitelist is compile-time, so no on-chain role can widen it (`constants.rs:19`, ECON-041). | Upgrade authority, threshold and timelock all unverified (OPS-001…012, OPS-037…043); no verifiable build or published binary hash (OPS-026, OPS-070); no pause (OPS-045); no `SECURITY.md` (OPS-047); no `CODEOWNERS` (OPS-073). |
| 9 | Monitoring & Incident Response | **2** | `emit_cpi!` on all three financial transitions with useful fields (`ix_initialize_fee_vault.rs:113`, `ix_fund_fee.rs:48`, `ix_claim_fee.rs:48`, `ix_fund_by_claiming_fee.rs:138`); events carry the resulting `fee_per_share`, enabling off-chain reconstruction. | A zero-delta `fund_by_claiming_fee` emits nothing (F-005); `EvtFundFee.payload` echoes untrusted bytes (KV-122); no runbook, no `SECURITY.md`, no alerting config (OPS-044…052). |
| | **Weighted Maturity** | | **2.3 / 4.0** (mean of 3,4,3,2,2,1,3,1,2 = 21/9) | |

**Categories scoring ≤ 1 — prioritized in the roadmap regardless of individual finding severity:**
**#6 Fuzzing & Property Tests (1)** and **#8 Upgradeability & Governance (1)**.

The shape of this scorecard is worth stating plainly: the *code* is strong where it was written
carefully (arithmetic 4, account safety 3, error handling 3) and weak exactly where the program
reaches outside itself — input validation on the external CPI (2), verification of that surface (1),
and the governance that would let the team respond if a callee changed (1). That is the same story
the findings tell, viewed from the process side rather than the defect side.

---
## 9. Remediation Roadmap

> Full version with effort estimates and owners: [`audit_2/roadmap.md`](roadmap.md).

### Immediate — Severity 9-10 (Block Deploy)

None.

### Before Release — Severity 7-8

| Finding | Severity | Fix | Effort |
|---|---|---|---|
| F-001 | 7 | Pin every value-receiving account index of every whitelisted action to a vault-controlled destination (widen `WHITELISTED_ACTIONS` to carry a slice of indices and add a `secondary_token_vault` account), **or** force the corresponding `max_*` argument to `0` in `validate_payload` so the unconstrained destination cannot receive value. Add one negative test per action. | 2-4 days |

### Within 2 Weeks — Severity 5-6

| Finding | Severity | Fix | Effort |
|---|---|---|---|
| F-002 | 5 | Build the downstream instruction data in-program from typed arguments instead of forwarding `payload`; pin each action's expected account count; add an on-chain kill switch so the path can be disabled if a callee's layout changes. | 3-5 days |
| F-003 | 5 | Read `freeze_authority` on both token-program paths in `is_supported_mint` and reject a live authority unless allowlisted; add an owner-gated close/sweep so a frozen or exhausted vault is recoverable. | 1-2 days + 2-3 days |

### Next Sprint — Severity 3-4

| Finding | Severity | Fix | Effort |
|---|---|---|---|
| F-004 | 4 | SHA-pin all five third-party actions; add `permissions: contents: read`; checksum-verify the Anza installer; enable Dependabot for `github-actions`. | 2-3 hours |
| F-005 | 3 | Reject a zero delta, or emit `EvtFundFee` unconditionally; alert on `funded_amount == 0`. | 2 hours |
| F-006 | 3 | Run the already-installed clippy with `-D warnings`; add `cargo audit`; measure coverage; ungate CI from `programs/**`; make both `fullFlow` helpers assert success; un-ignore `proptest-regressions`; add the five authorization-negative tests. | 3-5 days |
| F-007 | 3 | Add a guardian-held pause on `fund_by_claiming_fee`; add `SECURITY.md` and an incident runbook. | 2-3 days |

### Backlog — Severity 1-2

| Finding | Severity | Fix | Effort |
|---|---|---|---|
| F-008 | 2 | Give `FeeVault.owner` a purpose (gate the close/sweep from F-003) or remove it; add `close_fee_vault` requiring every slot settled. | 1-2 days |
| F-009 | 2 | `require!(params.padding.iter().all(\|v\| *v == 0))`. | 30 minutes |
| F-010 | 1 | Resolve the duplicate-address question: reject duplicates, or replace the comment with the reasoning. | 1 hour |

### Maturity-driven (categories scoring ≤ 1, per Phase 4.5)

| Category | Score | Action | Effort |
|---|:--:|---|---|
| #6 Fuzzing & Property Tests | 1 | Add a Trident (or `cargo-fuzz`) target for `fund_by_claiming_fee`; encode INV-01 (`Σ claims ≤ Σ funded`) and INV-02 as property tests; persist `proptest-regressions`. | 1-2 weeks |
| #8 Upgradeability & Governance | 1 | Publish the upgrade authority and threshold; add a timelock; adopt `solana-verify` and publish the binary hash per release; add `SECURITY.md`, a bug-bounty reference, and `CODEOWNERS`. | 1-2 weeks |

### 9.1 Re-Audit Checklist

- [ ] F-001 fixed — every value-receiving account of every whitelisted action is pinned to a vault-controlled destination, with a per-action test proving a hostile destination is rejected
- [ ] F-002 fixed — instruction data constructed in-program or fully argument-validated; account count pinned per action; kill switch present
- [ ] F-003 fixed — `freeze_authority` vetted at vault creation; a recovery/sweep path exists and is tested against a frozen `token_vault`
- [ ] F-004 fixed — all third-party actions SHA-pinned; `permissions:` declared; installer checksum-verified
- [ ] F-005 … F-010 addressed, or accepted with documented risk
- [ ] Authorization-negative tests added and green (non-holder claim, foreign index, non-holder CPI funding, non-whitelisted discriminator, `fee_vault_type == 0` vault)
- [ ] Both `fullFlow` helpers assert transaction success unconditionally
- [ ] `cargo clippy -- -D warnings` and a dependency scanner run on every PR, ungated by the changed-files filter
- [ ] INV-01 and INV-02 encoded as property tests; `proptest-regressions` committed
- [ ] Program re-deployed and the binary hash verified against the published source

---

## 10. Appendices

### A. Tool Versions

Declared in the repository (not executed — this audit built and ran nothing):

```
anchor-cli:  1.0.2        (Anchor.toml:2; CI env ANCHOR_CLI_VERSION @ .github/workflows/ci.yml:11)
solana-cli:  3.1.10       (Anchor.toml:3; Cargo.toml:27; CI env SOLANA_CLI_VERSION @ ci.yml:10)
rustc/cargo: 1.93.0       (rust-toolchain.toml:2; CI env TOOLCHAIN @ ci.yml:12)
anchor-lang: 1.0.2        (Cargo.toml:17, features = ["event-cpi"])
anchor-spl:  1.0.2        (Cargo.toml:18)
bytemuck:    1.21         (Cargo.toml:19, features = ["derive", "min_const_generics"])
ruint:       1.3.0        (programs/dynamic-fee-sharing/Cargo.toml:28)
num_enum:    0.7.0        (programs/dynamic-fee-sharing/Cargo.toml:27)
const-crypto: 0.3.0       (programs/dynamic-fee-sharing/Cargo.toml:30)
static_assertions: 1.1.0  (programs/dynamic-fee-sharing/Cargo.toml:29)
proptest:    1.6          (programs/dynamic-fee-sharing/Cargo.toml:35, dev-dependency)
package manager: bun      (Anchor.toml:4; bun.lock committed)
litesvm:     ^0.1.0       (package.json:15)

Audit tooling: auditor-skill 7.3.0@6bb2cbf — checklists 01-07 and 16 (591 items) plus 55 in-scope
known vectors. No deterministic pre-scanner (audit-scan) and no cross-audit memory (audit-mem) were
available in this environment; the instruction matrix and state model in §7 were built by hand from
full file reads.
```

### B. Environment

```
OS:              Linux 6.6.87.2-microsoft-standard-WSL2
Audit method:    static, read-only, offline. Nothing in the repository was built, installed, tested,
                 or executed. No network request was made. Shell execution was unavailable for this
                 engagement, so discovery used file-read and content-search tooling only.
Cluster tested:  none. Anchor.toml:17 pins `cluster = "localnet"`; README.md:5 publishes a program ID.
RPC provider:    none used.
Audited commit:  3e327c1ab085246612d28da21e1a78c7008119fe
Artifacts:       audit_2/REPORT.md (this file), audit_2/roadmap.md, audit_2/intake.md,
                 audit_2/checkpoint.md, audit_2/worksheets/context/*.md (Phase 0.5, 3 files covering
                 all 5 instruction handlers)
```

### C. Follow-Ups Requiring Client Input

> The 32 `[UNKNOWN]` checklist items and KV-091 all reduce to the questions below. None of them could
> be answered from the source tree. Each is an open item, not a pass.

| # | Question | Items it resolves |
|---|---|---|
| 1 | Who holds the upgrade authority for `dfsdo2UqvwfN8DuUVrMRNfQe11VaiNoKcMqLHVvDPzh` — a single wallet, a Squads multisig, or a DAO? What is the threshold, and are the signers on hardware wallets? | OPS-001…005, OPS-010, OPS-037…043, OPS-081, KV-091 |
| 2 | Is there a timelock on upgrades? Enforced on-chain, or by team policy? Is there an emergency-bypass path? | OPS-006…008, OPS-012, OPS-054, OPS-059 |
| 3 | Is the deployed binary reproducible from this commit, and is its hash published? | OPS-017, OPS-026, OPS-070, OPS-071 |
| 4 | What monitoring and alerting exists for large value movements and for upgrade transactions? Is there a war-room and post-mortem process? | OPS-048…052 |
| 5 | Is there a bug-bounty programme? | OPS-046 |
| 6 | Are dev/staging/production keys separated, and does any developer hold production deploy access from a personal machine? | OPS-062, OPS-063 |
| 7 | Has the full git history ever been swept for committed secrets, and is a secret scanner enabled? | OPS-036, OPS-072 |
| 8 | What is the actual deployment status and TVL? Confirming mainnet-live would raise F-001 to severity 8 and F-002/F-003 to 6 (intake §5). | severity calibration for F-001, F-002, F-003 |
| 9 | Is the "second token is not validated by design" decision (`constants.rs:14-16`) made under an assumption that all share holders of a vault are the same party? If so, that assumption should be documented and enforced; if not, F-001 stands as reported. | F-001 severity |

### D. Assumptions Carried From Intake

Recorded in full at [`audit_2/intake.md`](intake.md) §8; the severity-bearing ones are restated in §3
above. In summary: deployment status unconfirmed (mainnet `+1` uplift withheld), TVL unknown (no
double-weighting), upgradeability assumed but unverified (single-wallet auto-flag not applied), first
audit (no prior-fix assumptions), and DAMM v2 / Dynamic Bonding Curve treated as out-of-scope external
programs whose own account-relationship checks this audit did not verify — only their vendored IDLs
were read, and that limitation is the substance of F-002.

### E. Disclaimer

This audit report is provided as-is. It represents a point-in-time review of the codebase at commit
`3e327c1ab085246612d28da21e1a78c7008119fe`. No guarantee is made that all vulnerabilities have been
found. This review was performed statically and offline: no code was built, executed, or tested, no
on-chain state was queried, and no executable proof-of-concept was produced — every finding's evidence
tier is `[PoC-PROSE]`, a structured attacker narrative derived from the source and from the vendored
IDLs. The security of `fund_by_claiming_fee` additionally depends on the internal validation performed
by DAMM v2 and Dynamic Bonding Curve, whose source was not in scope. This is a rigorous first pass and
audit-shaped automation, not a substitute for a human firm audit or a formal proof of correctness, and
it does not constitute financial or legal advice.

