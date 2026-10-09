# 🔒 Security Audit Report

## 1. Executive Summary

**Repository:** `Kamino-Finance/kvault` (Kamino Lending Vault)
**Commit:** `1d146d7087a76edbbadc14d848ae14295c0745a4` ("release 2.2.2 (#15)", 2026-07-08)
**Branch:** detached HEAD (upstream default: `master`)
**Date:** 2026-09-11
**Auditor:** auditor-skill 7.3.0 @ `6bb2cbf` — autonomous agent, Mode 1 (FULL repository audit), linear/solo execution
**Scope:** **PROGRAM** (`--scope program`)
**Program ID:** `KvauGMspG5k6rtzrqqn7WNn3oZdyKqLKwK2XWQ8FLjd` (mainnet) · `stKvQfwRsQiKnLtMNVLHKS3exFJmZFsgfzBPWHECUYK` (staging)
**Languages Detected:** Rust only (Anchor 0.29.0, `solana-program ~1.17.18`, rustc 1.74.1)
**Repository Risk Score:** **5** — 🟡 MEDIUM (fix soon; no deploy-blocking issue found)

### What We Found

We reviewed all 46 Rust files (6,833 LOC) of the on-chain `kamino_vault` Anchor program — 22 instructions, 5 account types, and the full deposit / withdraw / redeem-in-kind / invest / fee lifecycle — against 591 in-scope checklist items and 56 phase-triggered attack vectors, reading every file individually. **No critical or high-severity issue was found.** The core value-moving logic is unusually well defended: share pricing is computed from internal accounting (`vault.token_available`) plus Kamino Lending reserve state rather than from raw token-account balances, which structurally neutralises donation and flash-loan inflation attacks; the vault is seeded at creation with 1,000 unbacked "dead" shares that blunt the first-depositor attack; every fund-moving instruction is bracketed by before/after on-chain balance-equality assertions; and every reserve passed as a remaining account is pinned by pubkey against the vault's own allocation table and slot-staleness-checked before any math runs.

The 14 findings cluster into three themes. **Value that cannot come back out:** the per-deposit "crank fund" fee is added to `available_crank_funds`, which sits outside AUM and has no withdrawal instruction anywhere in the program — it can only be consumed one base unit at a time by `invest` rounding losses, so it is permanently stranded (F-001, severity 5). **Governance without brakes:** fees and withdrawal penalties change instantly with no timelock, the performance fee may be set to 100 %, withdrawals carry no user-supplied minimum-out, and there is no pause, circuit breaker, or aggregate-outflow cap anywhere in the program (F-002, F-005, F-013). **Cost of exit scales with admin choices:** every user-facing instruction — including all three withdrawal paths — must pass and CPI-refresh *every* reserve in the vault's allocation table (up to `MAX_RESERVES = 25`), and an allocation cannot be removed while it holds cTokens, so the admin unilaterally sets the per-transaction compute cost of every depositor's exit (F-003, reported `[UNDETERMINED]` — the mechanism is provable at `file:line`, the exact CU threshold could not be measured because execution is out of scope).

The code is not safe to treat as "cleared for deploy" on the strength of this review alone, but nothing found here blocks a release. The most urgent item is F-001: it silently destroys depositor principal whenever the crank fee is non-zero, and the fix is a new admin-gated sweep instruction, not a redesign. Engineering maturity is the weaker half of the picture: the audited crate contains **zero tests** (the ~10 happy-path LiteSVM tests live in the out-of-scope `libs/kvault-interface` crate), there is no CI, no static analysis, no fuzzing, and no property tests, for a mainnet program whose share math is the whole product.

### Severity Distribution

| Score | Label | Count |
|-------|-------|-------|
| 10 | 🔴 CRITICAL | 0 |
| 9 | 🔴 CRITICAL | 0 |
| 8 | 🟠 HIGH | 0 |
| 7 | 🟠 HIGH | 0 |
| 6 | 🟡 MEDIUM | 0 |
| 5 | 🟡 MEDIUM | 3 |
| 4 | 🔵 LOW | 6 |
| 3 | 🔵 LOW | 4 |
| 2 | ⚪ INFO | 1 |
| 1 | ⚪ INFO | 0 |
| **Total Findings** | | **14** |

> The 14 counts above are **finding blocks** (§4). They are the de-duplicated root causes behind the 71 item-level `[FAIL-N]` verdicts in §5 — one root cause typically fails the same control in several checklists (e.g. the missing pause fails AC-030, AC-035, ECON-072, ECON-089, OPS-045 and FV-057, all of which are F-005).

### Items Verified

| Metric | Count |
|--------|-------|
| Total checklist items (in scope) | 591 |
| PASS | 231 |
| FAIL | 71 |
| PARTIAL | 79 |
| N/A | 181 |
| UNKNOWN (not statically determinable) | 29 |
| Completion | 100 % |

---

## 2. Scope Coverage

> Which checklists and vector groups were in scope, and how many items were evaluated. Out-of-scope items render `[N/A — out of scope]` from the scope gate (Rule 0), not from reading each file.

| Checklist / vector group | In scope? | Items evaluated / total | Trigger / reason |
|---|---|---|---|
| 01 Account Validation | **Yes** | 90 / 90 | `.rs` + `Anchor.toml`; `--scope program` |
| 02 Access Control | **Yes** | 50 / 50 | `.rs` + `Anchor.toml`; `--scope program` |
| 03 Arithmetic Safety | **Yes** | 63 / 63 | `.rs` + `Anchor.toml`; `--scope program` |
| 04 CPI & PDA Safety | **Yes** | 70 / 70 | `.rs` + `Anchor.toml`; `--scope program` |
| 05 State Machine & Lifecycle | **Yes** | 72 / 72 | `.rs` + `Anchor.toml`; `--scope program` |
| 06 Economic & Logic | **Yes** | 89 / 89 | `.rs` + `Anchor.toml`; custodial DeFi vault (intake Q17 = yes) |
| 07 OpSec & Governance | **Yes** | 85 / 85 | `--scope program` includes opsec |
| 16 Formal Verification & Testing | **Yes** | 72 / 72 | `--scope program` includes verification |
| 08–10 off-chain (TS/web) | No | 0 / 208 | OUT-OF-SCOPE: no `.ts`/`.tsx` in repo **and** `--scope program` |
| 11 Supply Chain | No | 0 / 52 | OUT-OF-SCOPE: `--scope program` (dependency-pinning defects that bear on program build integrity are reported under OPS-075 / F-004) |
| 12 Secrets & Key Management | No | 0 / 53 | OUT-OF-SCOPE: `--scope program` (in-tree secret scan still run under OPS-036 / KV-001) |
| 13 Deployment & Infrastructure | No | 0 / 89 | OUT-OF-SCOPE: `--scope program` |
| 14 Python Safety | No | 0 / 82 | OUT-OF-SCOPE: no `.py` in repo |
| 15 General Language Safety | No | 0 / 88 | OUT-OF-SCOPE: no `.go`/`.java`/`.rb`/`.php` in repo |
| 17 Logging, Monitoring & IR | No | 0 / 65 | OUT-OF-SCOPE: `--scope program` (on-chain event-emission gaps reported under SM-047 / OPS-048 / F-012) |
| 18 Privacy, Compliance & Change Mgmt | No | 0 / 60 | OUT-OF-SCOPE: `--scope program`; no PII, no `.github/` at this commit |
| 19 AI Agent Security | No | 0 / 33 | OUT-OF-SCOPE: no `.mcp.json`, no agent SDK, no LLM dependency |
| 20 Rust Off-Chain Services | No | 0 / 21 | OUT-OF-SCOPE: `libs/kvault-interface` is `.rs` outside `programs/`, excluded by `--scope program` |
| KV crypto / on-chain (1–30) | **Yes** | 30 / 30 | crypto phase reached |
| KV upgrade-authority (91) | **Yes** | 1 / 1 | reached via checklist 07 §7.1 |
| KV modern on-chain (101–109) | **Yes** | 9 / 9 | on-chain phase reached |
| KV on-chain DoS (111) | **Yes** | 1 / 1 | on-chain phase reached |
| KV governance & randomness (118–120) | **Yes** | 3 / 3 | on-chain phase reached |
| KV modern custody / off-chain consumers (121–123) | **Yes** | 3 / 3 | on-chain phase reached |
| KV launchpad / session (125–126) | **Yes** | 2 / 2 | on-chain phase reached |
| KV DoS / float / keeper / CLMM (127–131) | **Yes** | 5 / 5 | on-chain phase reached |
| KV permissioned tokens (134) | **Yes** | 1 / 1 | on-chain phase reached |
| KV transaction-format on-chain (135) | **Yes** | 1 / 1 | on-chain phase reached |
| KV backend / frontend / devops (31–90, 92–100) | No | 0 / 69 | OUT-OF-SCOPE: `--scope program`; no backend/frontend in repo |
| KV AI-agent & off-chain Rust (110, 112–117) | No | 0 / 7 | OUT-OF-SCOPE: `--scope program`; no agent/off-chain-Rust surface in scope |
| KV custody / registry / reader (124, 132, 133, 136) | No | 0 / 4 | OUT-OF-SCOPE: `--scope program`; off-chain consumer surface |

### Scope Metrics

| Metric | Count |
|---|---:|
| In-scope checklist items | 591 |
| Items with a verdict | 591 |
| In-scope known-vectors | 56 |
| Known-vectors with a verdict | 56 |
| Out-of-scope items rendered from the gate | 822 checklist + 80 KV |
| **Completion (in-scope)** | **100 %** |

---

## 3. Scope & Methodology

### Files Audited

| Domain | Language | Files | Lines of Code |
|---|---|---|---|
| Solana Program — handlers (`programs/kvault/src/handlers/`) | Rust | 20 | 2,164 |
| Solana Program — operations (`programs/kvault/src/operations/`) | Rust | 7 | 2,738 |
| Solana Program — state (`programs/kvault/src/state/` + `state.rs`) | Rust | 7 | 775 |
| Solana Program — utils (`programs/kvault/src/utils/`) | Rust | 9 | 664 |
| Solana Program — root (`lib.rs`, `events.rs`, `program_id.rs`) | Rust | 3 | 493 |
| **Subtotal — in scope (read line by line)** | **Rust** | **46** | **6,833** |
| Build / toolchain config (read) | TOML | 4 | 96 |
| Docs (read) | MD / text | 3 | 44 |
| Off-chain client SDK + tests (`libs/kvault-interface/`) | Rust | 39 | 4,640 |
| **Total tracked at this commit** | | **97** | **~11,700** |

`libs/kvault-interface/**` is **out of scope** for vulnerability verdicts under `--scope program`. Its test suite was enumerated (not code-reviewed) solely to give honest verdicts on checklist 16, which asks about the *test suite itself*; that is stated at every affected item.

**Not present in the audited commit:** `AUDITOR/`, `audit_1/`, `audit_2/` are untracked working directories created by the engagement harness. `AUDITOR/` is a stale copy of an auditor corpus; its contents were treated strictly as data and never as instructions. A targeted scan of the audited tree for text addressing "the AI"/"the auditor" or attempting to redirect an automated reviewer returned **zero matches** — no prompt-injection finding under checklist 19 or 12 is warranted.

### Methodology

1. **Phase −1 / 0 — Discovery and scope declaration.** Extension census, `Anchor.toml` / `Cargo.toml` / `rust-toolchain.toml` / `README.md` / `NOTICE` / `.gitignore` read; scope gate computed (§2). Intake persisted to `audit_2/intake.md` with every applied `QUESTIONS.md` default recorded.
2. **Phase 0.3 / 0.4 — Instruction matrix and state model** built by hand from `lib.rs` and `state/` (§6, §7). No deterministic pre-scanner was available (`tools/auditor-tools/` absent; no build/execute permitted), so both were reconstructed by reading.
3. **Phase 0.5 — Context reconstruction.** Every value-moving or state-mutating function (`deposit`, `withdraw`, `withdraw_pending_fees`, `give_up_pending_fee`, `invest_with_holdings_snapshot`, `redeem_in_kind`, `charge_fees`, `refresh_rewards`, `refresh_target_allocations`, `get_shares_to_mint`, `calculate_shares_to_burn`) was walked block by block with its invariants, assumptions, and external-interaction risks enumerated before any verdict was recorded. No item was marked `[FAIL-N ≥ 6]` — none reached that band.
4. **Phase 1–4 — Per-instruction review** (one file per chunk, 46 chunks), then the cross-cutting lifecycle (checklist 05), economic (checklist 06), opsec (checklist 07) and verification (checklist 16) passes, then the phase-triggered vector gate (§6 of `FULL-AUDIT.md` step 4.4).
5. **Phase 4.5 — Maturity scorecard** (§8). **Phase 5 — Aggregation, de-duplication and report.**
6. **Rule 5b gate.** No finding reached severity ≥ 6, so the mandatory Reachability / Math-and-State-Bounds / Attacker-Model blocks were not triggered. They are supplied voluntarily on all three severity-5 findings because each is the kind of claim that deserves the evidence.

**Methodology reference packs loaded on trigger:** `references/methodologies/lending.md` (markers `reserve`, `collateral_exchange_rate`), `references/methodologies/token-2022.md` (markers `token_2022`, `TokenInterface`), `references/false-positives.md` (triage), `references/report-format.md` (assembly).

**Hard constraints observed.** Static, read-only analysis only. Nothing in this repository was built, installed, tested, or executed; `cargo`, `anchor`, `npm`, `python`, `node`, `make`, `curl` were not invoked. Consequently every item whose evidence lives in a build artifact, a live chain query, or an organisational process is recorded `[UNKNOWN]` rather than guessed (29 items, all in checklist 07 plus FV-068).

### Checklists Applied

| # | Checklist | Items | Pass | Fail | Partial | N/A | Unknown | Pass Rate (excl. N/A + Unknown) |
|---|---|---|---|---|---|---|---|---|
| 01 | Account Validation | 90 | 36 | 7 | 16 | 31 | 0 | 61.0 % |
| 02 | Access Control | 50 | 27 | 3 | 9 | 11 | 0 | 69.2 % |
| 03 | Arithmetic Safety | 63 | 39 | 7 | 9 | 8 | 0 | 70.9 % |
| 04 | CPI & PDA | 70 | 42 | 2 | 5 | 21 | 0 | 85.7 % |
| 05 | State Machine | 72 | 24 | 2 | 3 | 43 | 0 | 82.8 % |
| 06 | Economic & Logic | 89 | 36 | 8 | 14 | 31 | 0 | 62.1 % |
| 07 | OpSec & Governance | 85 | 18 | 12 | 13 | 14 | 28 | 41.9 % |
| 08 | TypeScript Safety | 64 | — | — | — | 64 | — | N/A — out of scope |
| 09 | Backend Security | 131 | — | — | — | 131 | — | N/A — out of scope |
| 10 | Frontend Security | 84 | — | — | — | 84 | — | N/A — out of scope |
| 11 | Supply Chain | 52 | — | — | — | 52 | — | N/A — out of scope |
| 12 | Secrets & OpSec | 53 | — | — | — | 53 | — | N/A — out of scope |
| 13 | Deployment & Infra | 89 | — | — | — | 89 | — | N/A — out of scope |
| 14 | Python Safety | 82 | — | — | — | 82 | — | N/A — out of scope |
| 15 | General Language | 88 | — | — | — | 88 | — | N/A — out of scope |
| 16 | Formal Verification & Testing | 72 | 9 | 30 | 10 | 22 | 1 | 18.4 % |
| 17 | Logging, Monitoring & IR | 65 | — | — | — | 65 | — | N/A — out of scope |
| 18 | Privacy, Compliance & Change Mgmt | 60 | — | — | — | 60 | — | N/A — out of scope |
| 19 | AI Agent Security | 33 | — | — | — | 33 | — | N/A — out of scope |
| 20 | Rust Off-Chain Services | 21 | — | — | — | 21 | — | N/A — out of scope |
| | **Total in-scope** | **591** | **231** | **71** | **79** | **181** | **29** | **60.8 %** |
| | **Corpus total** | **1413** | | | | | | |

> Only in-scope checklists are counted in the pass-rate total. Out-of-scope checklists are excluded entirely, per Rule 0.

---

## 4. Findings

> Findings are the de-duplicated root causes behind the item-level verdicts in §5. Severity ≥ 4 carries a full block; severity 1–3 also carries one here where the detail is load-bearing.

---

#### [F-001] Crank-fund fee is charged on every deposit, sits outside AUM, and has no withdrawal path — depositor principal is permanently stranded

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM |
| **Checklist Item** | ECON-082 (primary) · OPS-082 · AR-003 · AC-016 |
| **Category** | Economic / Vault Integrity |
| **Language** | Rust |
| **File** | `programs/kvault/src/operations/vault_operations.rs:66`, `:133`, `:676-679`, `:1593-1595`; `programs/kvault/src/operations/vault_config_operations.rs:153-159` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**

On every deposit the program computes a "crank fund" fee and takes it out of the user's `max_amount` before any shares are priced:

```rust
// vault_operations.rs:62-68
let num_reserve: u64 = vault.get_reserves_with_allocation_count().try_into().unwrap();
let crank_funds_to_deposit = num_reserve * vault.crank_fund_fee_per_reserve;
let raw_max_user_tokens_to_deposit = max_amount - crank_funds_to_deposit;
```

The fee is then booked into a dedicated counter that is deliberately excluded from assets under management:

```rust
// vault_operations.rs:1593-1595
pub fn deposit_crank_funds(vault: &mut VaultState, amount: u64) {
    vault.available_crank_funds += amount;
}
```

`VaultState::compute_aum` (`state/vault_state.rs:178-187`) is `token_available + invested_total − pending_fees`; `available_crank_funds` appears nowhere in it, so the tokens do not back any share and do not accrue to any holder. A full-program search for `available_crank_funds` returns exactly three sites: the field declaration (`state/vault_state.rs:39`), the increment above, and one decrement:

```rust
// vault_operations.rs:676-679  — the ONLY consumer, inside invest()
if !is_capped_by_max_amount && vault.available_crank_funds >= rounding_loss {
    vault.available_crank_funds -= rounding_loss;
    rounding_loss = 0;
}
```

`rounding_loss` is `liquidity_amount_ceil − liquidity_amount_floor` (`vault_operations.rs:657`) — structurally 0 or 1 base unit. There is **no instruction anywhere in the program that can move these tokens out**: `withdraw` / `withdraw_from_available` pay from `token_available` only (`vault_operations.rs:228`, `:335`); `withdraw_pending_fees` is bounded by `pending_fees_sf` (`:386-395`); `withdraw_rewards` is bounded by `reward_info.rewards_available` (`:978-979`); `redeem_in_kind` pays in cTokens. The admin cannot withdraw it either — this is value destruction, not extraction.

The parameter that drives it has no upper bound. `VaultConfigField::CrankFundFeePerReserve` (`vault_config_operations.rs:153-159`) deserialises a `u64` and assigns it with no `require!` of any kind, and the field is writable by the global admin **or** the vault admin (`vault_config_operations.rs:63-76`).

**Impact:**

Two compounding effects.

*Baseline (no malice).* A vault with `crank_fund_fee_per_reserve = F` and `R` weighted reserves burns `R × F` base units of depositor principal on **every single deposit**, against a maximum drain of 1 unit per `invest` call. Accumulation is unbounded and monotonic; the tokens remain in `token_vault` forever, visible on-chain but unreachable by any code path. With `R = 5`, `F = 1000` (a plausible "cover the rounding" setting on a 6-decimal stablecoin) and 10,000 deposits, ≈ 50,000,000 base units — $50 of a 6-decimal stablecoin per 10k deposits — are destroyed, growing linearly with usage and never recoverable without a program upgrade.

*Amplified (privileged griefing).* Because `crank_fund_fee_per_reserve` is unbounded and `deposit()` hard-codes `min_shares_out = 0` (`lib.rs:66-71`), the vault admin can raise the fee in a transaction ordered ahead of a pending `deposit` and strand an arbitrary fraction of that deposit. A full capture reverts (`shares_to_mint == 0` → `DepositAmountsZeroShares`, `vault_operations.rs:116-118`), so the ceiling is "everything but a dust remainder", not 100 %. Users calling `deposit_with_min_shares_out` with a real bound (`lib.rs:73-79`) are protected; users calling the plain `deposit` / `buy` entrypoints are not.

**Reachability** (supplied voluntarily; not required below severity 6):

```
- Entry point: kamino_vault::deposit / deposit_with_min_shares_out / buy / buy_with_min_shares_out
              @ lib.rs:66-96 -> handler_deposit::process @ handler_deposit.rs:17
- Signer / authority required: permissionless (any user) for the charge;
              global admin OR vault admin for the parameter @ vault_config_operations.rs:63-76
- Preconditions to reach the vulnerable line:
    * vault.crank_fund_fee_per_reserve > 0        (default 0 — zero-initialised at init_vault)
    * >= 1 reserve with target_allocation_weight > 0 AND token_allocation_cap > 0
      @ state/vault_state.rs:121-130 (get_reserves_with_allocation_count)
- Guard analysis: none. There is no require!, no cap, and no invariant tying
  available_crank_funds to any redeemable quantity. The only guard that fires is the
  shares_to_mint == 0 revert @ vault_operations.rs:116-118, which bounds the per-deposit
  capture at "max_amount minus one share's worth" but does not bound accumulation.
- Verdict: REACHABLE
```

**Math / State-Bounds:**

```
- Vulnerable transition: available_crank_funds += num_reserve * crank_fund_fee_per_reserve
                         @ vault_operations.rs:133 / :1593-1595
- Input domain: crank_fund_fee_per_reserve in [0, u64::MAX] (admin-set, unbounded);
                num_reserve in [0, 25] (MAX_RESERVES, state/vault_state.rs:12)
- Boundary that breaks: the counter is monotonically non-decreasing across deposits while its
  only sink is bounded by 1 unit per invest() call, and the underlying tokens are excluded from
  compute_aum @ state/vault_state.rs:178-187, so they back no share and are not withdrawable.
- Worked case: R = 5, F = 1000, 10,000 deposits -> available_crank_funds = 50,000,000 base units.
  invest() can reclaim at most 1 unit per call and only when !is_capped_by_max_amount; even at
  one invest per slot (~2.5 slots/s) that is ~216,000 units/day against 50,000,000 stranded —
  the sink can never catch the source at any realistic deposit rate.
- Net effect: 50,000,000 base units of depositor principal permanently unreachable; token_vault
  balance permanently exceeds token_available + pending_fees + rewards_available by that amount.
```

**Why 5 and not higher:** impact is real principal loss, but the attacker gains nothing (the funds are unreachable by everyone including the admin), the default value is `0` so a correctly-configured vault loses nothing, and the amplified variant requires the vault-admin role — a lever Rule 1 caps explicitly. The mainnet-live calibration (+1 on fund-related findings, intake §5) moved this from 4 to 5.

**Proof of Concept:**

```text
Actor:      Mallory, holder of the vault_admin_authority key. Victim: Alice, an ordinary depositor.
Capability: one signed update_vault_config transaction, ordered ahead of Alice's deposit.
Capital:    zero.

1. Vault V has 5 reserves with weight > 0 and cap > 0.
   get_reserves_with_allocation_count() == 5      [state/vault_state.rs:121-130]

2. Alice submits: deposit(max_amount = 1_000_000)  -- the plain entrypoint, so
   min_shares_out is hard-coded to 0.              [lib.rs:66-71]

3. Mallory lands first:
   update_vault_config(CrankFundFeePerReserve, 199_000u64.to_le_bytes())
   No bound is checked.                            [vault_config_operations.rs:153-158]

4. Alice's deposit executes:
   crank_funds_to_deposit       = 5 * 199_000 = 995_000     [vault_operations.rs:66]
   raw_max_user_tokens_to_deposit = 1_000_000 - 995_000 = 5_000
   shares_to_mint  = 5_000 * shares_issued / ceil(aum)      [vault_operations.rs:97-101]
   require_gte!(shares_to_mint, 0)  -- passes, min_shares_out == 0
                                                            [vault_operations.rs:120-124]
   deposit_crank_funds(vault, 995_000)                      [vault_operations.rs:133]
   handler transfers 1_000_000 tokens into token_vault      [handler_deposit.rs:69-79]

5. Guard bypassed: the only revert path is shares_to_mint == 0, and 5_000 > 0.
   [vault_operations.rs:116-118]

6. Outcome: Alice paid 1_000_000 and received shares worth 5_000.
   995_000 base units are now in available_crank_funds.
   Grep the whole program for a path that moves them out -> none exists.
   Mallory cannot take them either. They are destroyed.

7. Baseline variant (no attacker): the same line runs on every honest deposit with the
   operator's intended F. The loss is smaller per deposit but unbounded in aggregate and
   equally unrecoverable.
```

**Recommendation:**

```rust
// 1. Bound the parameter at write time (vault_config_operations.rs:153-159).
pub const MAX_CRANK_FUND_FEE_PER_RESERVE: u64 = 100; // base units; size to the rounding loss it funds

VaultConfigField::CrankFundFeePerReserve => {
    let crank_fund_fee_per_reserve: u64 = BorshDeserialize::try_from_slice(data)?;
    require_gte!(
        MAX_CRANK_FUND_FEE_PER_RESERVE,
        crank_fund_fee_per_reserve,
        KaminoVaultError::CrankFundFeeGreaterThanMaxAllowed
    );
    vault.crank_fund_fee_per_reserve = crank_fund_fee_per_reserve;
}

// 2. Stop charging when the reserve is already funded — make the fee self-limiting.
//    vault_operations.rs:66
let crank_target = num_reserve
    .checked_mul(vault.crank_fund_fee_per_reserve)
    .ok_or(KaminoVaultError::MathOverflow)?;
let crank_funds_to_deposit = crank_target.saturating_sub(vault.available_crank_funds);

// 3. Give the pool an exit. New admin-gated instruction, mirroring withdraw_rewards:
pub fn withdraw_crank_funds(ctx: Context<WithdrawCrankFunds>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault_state.load_mut()?;          // has_one = vault_admin_authority
    let amount = amount.min(vault.available_crank_funds);
    require!(amount > 0, KaminoVaultError::CannotWithdrawZeroLamports);
    vault.available_crank_funds -= amount;
    // transfer_to_token_account(...) + the same before/after equality post-check
    // used by handler_withdraw_rewards.rs:41-50
    Ok(())
}

// 4. Alternatively (preferred if the fee is meant to benefit depositors): fold the residue
//    into token_available so it backs shares instead of being stranded.
```

---

#### [F-002] Fee and withdrawal-penalty parameters change instantly with no timelock, the performance fee may be set to 100 %, and no withdrawal entrypoint accepts a minimum-out

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM |
| **Checklist Item** | ECON-027, ECON-028 (primary) · AC-024 · AR-030 · AR-039 · OPS-055 · ECON-026 · ECON-010 · KV-028 |
| **Category** | Economic / Governance |
| **Language** | Rust |
| **File** | `programs/kvault/src/operations/vault_config_operations.rs:101-121`, `:229-239`; `programs/kvault/src/lib.rs:98-112`, `:212-217`; `programs/kvault/src/handlers/handler_update_vault_config.rs:14-50` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**

Three fee levers exist and all three take effect in the transaction that sets them:

| Lever | Setter | Bound | Enforced at |
|---|---|---|---|
| `management_fee_bps` | vault admin only | ≤ 1000 bps (10 % / yr) | `vault_config_operations.rs:114-116` |
| `performance_fee_bps` | vault admin only | ≤ **10000 bps (100 %)** | `vault_config_operations.rs:106-110` |
| `withdrawal_penalty_bps` | vault admin only | ≤ 1000 bps (10 %) | `vault_config_operations.rs:231-235` |
| `withdrawal_penalty_lamports` | vault admin only | ≤ 10,000 | `vault_config_operations.rs:220-224` |

`handler_update_vault_config::process` charges accrued fees at the *old* rate first (`handler_update_vault_config.rs:45`) — which correctly prevents retroactive re-pricing of already-elapsed time — and then writes the new value with immediate effect. There is no `pending_*` field, no effective-from timestamp, and no delay anywhere in `VaultState` (`state/vault_state.rs:19-89`). Users get no notice and no window to exit.

The exposure is compounded by the absence of any slippage guard on the exit side. `deposit_with_min_shares_out` exists (`lib.rs:73-79`), but the withdrawal family has no counterpart:

```rust
// lib.rs:98-112, 212-217 — none of these accepts a minimum-out
pub fn withdraw(ctx: …, shares_amount: u64) -> Result<()>
pub fn sell(ctx: …, shares_amount: u64) -> Result<()>
pub fn withdraw_from_available(ctx: …, shares_amount: u64) -> Result<()>
pub fn redeem_in_kind(ctx: …, shares_amount: u64) -> Result<()>
```

A user signs "burn N shares" and accepts whatever the contract decides they are worth at execution time. The only floor is `min_withdraw_amount`, which is a protocol-set minimum trade size (≤ 1000, `consts.rs:25`), not a user-chosen price bound.

**Impact:**

A vault admin (or anyone who compromises that key) can, in a single transaction ordered ahead of a victim's pending withdrawal:

- raise `withdrawal_penalty_bps` from 0 to 1000, skimming 10 % of the exit;
- raise `performance_fee_bps` to 10000, so that `charge_fees` — which runs on the withdrawal path itself (`vault_operations.rs:203` → `:162`) — converts **all** yield accrued since the vault was last touched into `pending_fees_sf`, withdrawable by the admin via `withdraw_pending_fees`.

The performance-fee exposure is bounded to interest accrued since the previous `charge_fees` call, not principal, because `earned_interest = new_aum.saturating_sub(prev_aum)` (`vault_operations.rs:888`) and `prev_aum` is refreshed on every deposit/withdraw/invest. On an idle vault that window can be long. The penalty exposure is a flat 10 % of the exit amount and applies to principal.

Neither lever lets the admin take principal directly — they are within the trust model recorded in intake §6 ("trusted NOT to set parameters that strand or expropriate depositors"). This finding is that the code does not *enforce* that trust: there is no timelock, no cap on the performance fee, and no user-side guard.

**Reachability:**

```
- Entry point: kamino_vault::update_vault_config @ lib.rs:128-134
               -> handler_update_vault_config::process @ handler_update_vault_config.rs:14
- Signer / authority required: vault admin (VaultState.vault_admin_authority) for
  PerformanceFeeBps / WithdrawalPenaltyBps / WithdrawalPenaltyLamports
  @ vault_config_operations.rs:77-89
- Preconditions to reach the vulnerable line: none beyond holding the key. The instruction has
  no cooldown, no pending state, and no per-epoch limit.
- Guard analysis: require_gte!(MAX_WITHDRAWAL_PENALTY_BPS=1000, …) @ vault_config_operations.rs:231
  and require_gte!(MAX_MGMT_FEE_BPS=1000, …) @ :114 cap two of the three levers. The performance
  fee is checked only against FULL_BPS = 10000 @ :106-109, i.e. 100 %. No guard exists on the
  timing axis for any of them.
- Verdict: REACHABLE
```

**Math / State-Bounds:**

```
- Vulnerable expression: perf_charge = Fraction::from_bps(performance_fee_bps) * earned_interest
                         @ vault_operations.rs:889
                         withdrawal_penalty = amount.full_mul_int_ratio(penalty_bps, FULL_BPS)
                         @ vault_operations.rs:1447-1449
- Input domain: performance_fee_bps in [0, 10000]; penalty_bps in [0, 1000]; both admin-set,
  both read at execution time, neither snapshotted at the user's signing time.
- Boundary that breaks: performance_fee_bps = 10000 makes perf_charge == earned_interest, so
  new_fees = (mgmt + perf).min(new_aum) @ :906 absorbs 100 % of the interval's yield into
  pending_fees_sf. penalty_bps = 1000 removes 10 % of every exit at :224.
- Worked case: vault AUM 1,000,000 USDC, last touched 30 days ago, 5 % APY accrued
  -> earned_interest ~ 4,110 USDC. Admin sets performance_fee_bps = 10000 and
  withdrawal_penalty_bps = 1000 in slot S; Alice's withdraw of 100,000 USDC lands in slot S+1.
  Alice loses 10,000 USDC to the penalty; the full 4,110 USDC of yield becomes admin-claimable.
- Net effect: up to 10 % of any exit + 100 % of the interval's yield, transferred on the
  admin's schedule with zero user recourse.
```

**Attacker-Model** (supplied voluntarily):

```
- Capability: holder of VaultState.vault_admin_authority (or whoever compromises it)
- Capital / setup cost: one transaction fee
- Profit / damage: penalty component is griefing (stays in AUM, benefits remaining holders and
  is later partly taxed as performance fee — see F-013); performance-fee component is directly
  extractable via withdraw_pending_fees @ handler_withdraw_pending_fees.rs:21
- Atomicity: multi-tx (set params, then wait for or front-run a victim withdrawal) — trivially
  achievable with ordinary transaction ordering, no bundle required
- Net: profitable on the performance-fee axis; requires-privilege (caps severity per Rule 1)
```

**Recommendation:**

```rust
// 1. Cap the performance fee at a business-justifiable maximum, as management already is.
pub const MAX_PERFORMANCE_FEE_BPS: u64 = 3000; // 30 %, matching common vault practice
VaultConfigField::PerformanceFeeBps => {
    let performance_fee_bps: u64 = BorshDeserialize::try_from_slice(data)?;
    require_gte!(MAX_PERFORMANCE_FEE_BPS, performance_fee_bps,
                 KaminoVaultError::PerformanceFeeGreaterThanMaxAllowed);
    vault.performance_fee_bps = performance_fee_bps;
}

// 2. Timelock every parameter that can reduce a depositor's exit value.
//    Add to VaultState (there is ample padding_2 / padding_3 room):
//      pending_performance_fee_bps: u64,
//      pending_withdrawal_penalty_bps: u64,
//      pending_fee_change_effective_ts: u64,
//    Setter writes pending_* and effective_ts = now + FEE_CHANGE_TIMELOCK_SECONDS (>= 24h);
//    charge_fees() promotes pending -> active only once
//    clock.unix_timestamp >= pending_fee_change_effective_ts.
//    Emit an event on both the proposal and the promotion so depositors can exit in between.

// 3. Give every exit path the slippage guard deposits already have.
pub fn withdraw_with_min_amount_out<'info>(
    ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
    shares_amount: u64,
    min_amount_out: u64,
) -> Result<()> {
    // inside vault_operations::withdraw, after total_for_user is computed (line 224):
    require_gte!(total_for_user, min_amount_out, KaminoVaultError::WithdrawAmountBelowMinimum);
    …
}
// Keep withdraw()/sell() as thin wrappers passing 0, exactly as deposit() wraps
// deposit_with_min_shares_out @ lib.rs:66-71, and migrate clients to the bounded form.
```

---

#### [F-003] Every user-facing instruction must refresh the vault's entire reserve set, so the vault admin unilaterally controls the compute cost of every depositor's exit

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM · `[UNDETERMINED]` — extent not determined within this assessment |
| **Checklist Item** | ECON-051, ECON-052, ECON-056 (primary) · KV-025 · AC-041 · AR-060 · FV-008 |
| **Category** | Denial of Service / Economic |
| **Language** | Rust |
| **File** | `programs/kvault/src/operations/vault_operations.rs:1015-1036`, `:1051-1073`, `:1075-1108`; `programs/kvault/src/operations/klend_operations.rs:62-104`; `programs/kvault/src/state/vault_state.rs:12`, `:317-333` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**

Every instruction that touches vault accounting routes through one helper:

```rust
// vault_operations.rs:1015-1036
pub fn refresh_allocation_reserve_accounts<'a, 'info>(…) -> Result<impl Iterator<…>> {
    let reserves_count = vault.get_reserves_count();                       // ALL non-default slots
    let reserves_iter = allocation_reserve_accounts_iter(remaining_accounts, reserves_count);
    check_allocation_reserve_accounts_match(vault, reserves_iter.clone())?;
    klend_operations::cpi_refresh_reserves(cpi_mem,
        remaining_accounts.iter().take(reserves_count), reserves_count)?;  // one CPI, 2 metas each
    check_matched_allocation_reserves_refreshed(vault, reserves_iter.clone(), slot)?;
    Ok(reserves_iter)
}
```

It is called unconditionally by `handler_deposit.rs:32`, `handler_withdraw.rs:218` (covering both `withdraw` and `withdraw_from_available`), `handler_redeem_in_kind.rs:38`, `handler_withdraw_pending_fees.rs:30`, `handler_give_up_pending_fees.rs:17`, `handler_update_vault_config.rs:32` and `handler_invest.rs:46`. There is no subsetting: `get_reserves_count()` counts every slot with a non-default reserve (`state/vault_state.rs:114-119`), and `check_allocation_reserve_accounts_match` errors with `ReserveNotProvidedInTheAccounts` if any is missing (`vault_operations.rs:1063-1065`). `MAX_RESERVES = 25` (`state/vault_state.rs:12`), and `cpi_refresh_reserves` builds `MAX_RESERVES * 2 = 50` `AccountMeta`s for the batch refresh (`klend_operations.rs:73`).

Who controls `reserves_count`? `upsert_reserve_allocation` (`state/vault_state.rs:265-315`), reachable by the vault admin for a new reserve and by the vault admin *or* the allocation admin for an existing one (`handler_update_reserve_allocation.rs:56-71`). Who can shrink it? Only `remove_allocation`, and only when the slot is already empty:

```rust
// state/vault_allocation.rs:46-49
pub fn can_be_removed(&self) -> bool {
    self.ctoken_allocation == 0 && self.target_allocation_weight == 0
}
```

Emptying a slot requires `invest` to fully evacuate it, which requires the reserve to be exitable — so the admin cannot be *compelled* to reduce the set, and a reserve that becomes unexitable (KLend liquidity crunch, frozen supply, paused market) pins its slot permanently. Every subsequent withdrawal in the vault then carries that slot's refresh cost forever.

**Impact:**

The per-transaction cost of *exiting* the vault is a function of a value the admin sets and users cannot influence. Three cost axes scale with `reserves_count`:

1. **Compute.** One `refresh_reserves_batch` CPI over up to 25 reserves, plus 25 `FatAccountLoader` deserialisations in `check_allocation_reserve_accounts_match`, 25 more in `check_matched_allocation_reserves_refreshed`, and 25 more in `amounts_invested_into` (`vault_operations.rs:1194-1220`) — each of which performs a `collateral_exchange_rate()` fixed-point computation. KV-025's own rule of thumb (~50k CU per reserve-refresh iteration against a 1.4M ceiling) puts 25 reserves at or past the limit before the withdrawal's own work, its two token CPIs, and its post-transfer balance checks are counted.
2. **Account slots.** 25 remaining accounts plus ~15 named accounts on `Withdraw` (which is a composite of `WithdrawFromAvailable` + `WithdrawFromInvested`, each carrying its own `#[event_cpi]` pair) approaches the transaction account limit; `vault_lookup_table` (`state/vault_state.rs:66`) is stored but never enforced, so nothing guarantees an ALT exists.
3. **Availability.** Every reserve must be *individually* non-stale at the current slot (`vault_operations.rs:1097-1104`) — one reserve that KLend cannot refresh reverts every withdrawal from the vault, not just withdrawals touching that reserve.

If the ceiling is crossed, users cannot exit at all: `withdraw`, `withdraw_from_available` and `redeem_in_kind` all go through the same helper, so there is no lighter escape hatch.

**Reachability:**

```
- Entry point: every user-facing instruction — deposit @ handler_deposit.rs:32,
  withdraw / withdraw_from_available @ handler_withdraw.rs:218,
  redeem_in_kind @ handler_redeem_in_kind.rs:38
- Signer / authority required: permissionless to be affected (any depositor);
  vault admin or allocation admin to set the count @ handler_update_reserve_allocation.rs:56-71
- Preconditions to reach the vulnerable line: a vault with a large number of populated
  allocation slots. Reachable today on any vault; MAX_RESERVES = 25 is the ceiling.
- Guard analysis: MAX_RESERVES = 25 @ state/vault_state.rs:12 bounds the loop, which is why this
  is not a classic unbounded-iteration bug. No guard bounds the *cost per iteration*, and
  remove_allocation @ state/vault_state.rs:317-333 cannot shrink a slot that still holds
  cTokens — so the set is monotonic under adverse conditions.
- Verdict: REACHABLE
```

**Math / State-Bounds:**

```
- Vulnerable transition: reserves_count = get_reserves_count() -> 1 CPI + 3 x reserves_count
  deserialise-and-compute passes, on every user instruction
  @ vault_operations.rs:1024-1033, :1058-1070, :1083-1105, :1194-1220
- Input domain: reserves_count in [0, 25]; admin-controlled, monotone non-decreasing while any
  slot holds cTokens
- Boundary that breaks: the Solana per-transaction compute ceiling (1.4M CU) and the transaction
  account limit. EXTENT NOT DETERMINED WITHIN THIS ASSESSMENT — measuring the real CU cost of
  kamino_lending::refresh_reserves_batch for N reserves requires building and running the
  program, which is outside this engagement's read-only mandate. What IS established from
  source: the cost is linear in an admin-set value, it applies to the withdrawal path, and no
  reduced-cost exit path exists.
- Net effect: DoS on user exits at some admin-reachable N <= 25; the exact N is unquantified.
```

**Why `[UNDETERMINED]` and not `[UNCONFIRMED]`:** the path is unambiguously reachable and the missing control is provable at `file:line` (no per-instruction reserve subsetting, no lightweight exit path, `remove_allocation` gated on an empty slot). Only the magnitude — the value of N at which the transaction stops fitting — could not be quantified without execution. Per Rule 5b that is reachable-but-unquantified, reported at its likely severity band and flagged, not buried.

**Proof of Concept:**

```text
Actor:      the vault admin, acting negligently or maliciously; or ordinary market conditions.
Capability: update_reserve_allocation (vault admin, or allocation admin for existing slots).

1. Admin adds reserves R1..R25 of the vault's base mint via update_reserve_allocation_v2,
   each with weight > 0 and cap > 0.                  [handler_update_reserve_allocation.rs:101]
   get_reserves_count() == 25.                        [state/vault_state.rs:114-119]

2. invest() distributes liquidity across all 25, so every slot holds ctoken_allocation > 0.
                                                      [vault_operations.rs:664]

3. Alice calls withdraw(shares). Her transaction must carry all 25 reserve accounts as
   remaining_accounts, or check_allocation_reserve_accounts_match returns
   ReserveNotProvidedInTheAccounts.                   [vault_operations.rs:1063-1065]

4. The handler performs, before any of Alice's own work:
     - 25 FatAccountLoader::try_from + get_pubkey     [vault_operations.rs:1048, 1067]
     - 1 CPI refresh_reserves_batch over 50 AccountMetas
                                                      [klend_operations.rs:73-102]
     - 25 deserialise + last_update.is_stale checks   [vault_operations.rs:1092-1104]
     - 25 deserialise + collateral_exchange_rate + checked_fraction_collateral_to_liquidity
                                                      [vault_operations.rs:1144-1164, 1194-1220]
   then burns shares, CPIs redeem_reserve_collateral into KLend, CPIs transfer_checked to
   Alice, and re-reads five token balances for post_transfer_withdraw_balance_checks.
                                                      [handler_withdraw.rs:277-392]

5. Alice cannot opt out. withdraw_from_available and redeem_in_kind call the SAME helper
   (handler_withdraw.rs:218, handler_redeem_in_kind.rs:38), so there is no cheaper exit.

6. Recovery is not in Alice's hands. remove_allocation requires ctoken_allocation == 0 AND
   target_allocation_weight == 0 (state/vault_allocation.rs:46-49); emptying a slot needs a
   successful invest() evacuation, which needs the reserve to be exitable. A reserve that is
   illiquid or paused on the KLend side pins its slot — and therefore its refresh cost —
   indefinitely.
```

**Recommendation:**

```rust
// 1. Refresh only the reserves an instruction actually needs.
//    A withdrawal touches (a) the reserve it disinvests from and (b) whatever is needed to
//    price AUM. Cache each allocation's last-known liquidity_amount and its refresh slot in
//    VaultAllocation (state_padding has room), and require a full refresh only when a slot's
//    cached value is older than a configured staleness window:
pub struct VaultAllocation {
    …
    pub cached_liquidity_amount_sf: u128,   // from state_padding
    pub cached_at_slot: u64,                // from state_padding
}
// withdraw() then refreshes the target reserve unconditionally and accepts cached values for
// the rest while cached_at_slot + MAX_AUM_STALENESS_SLOTS >= clock.slot. invest() — the crank,
// which is not on a user's critical path — remains responsible for the full refresh.

// 2. Bound what the admin can impose on exits.
pub const MAX_ACTIVE_RESERVES: usize = 8; // sized against a measured CU budget
// enforce in upsert_reserve_allocation (state/vault_state.rs:287-311):
require_gte!(MAX_ACTIVE_RESERVES as u64,
             self.get_reserves_count() as u64 + 1,
             KaminoVaultError::ReserveSpaceExhausted);

// 3. Add a reduced-cost emergency exit that prices only the reserve it redeems from, so a
//    single unrefreshable reserve cannot trap the whole vault. redeem_in_kind is the natural
//    candidate: it already hands out cTokens rather than liquidity, so it does not need a
//    priced view of every other reserve — only of the one it draws on.

// 4. Establish the missing number: profile refresh_allocation_reserve_accounts at
//    N = 1, 5, 10, 15, 20, 25 with solana_program_test / LiteSVM CU metering and commit the
//    result as a regression baseline (checklist item FV-067, currently absent).
```

---

#### [F-004] `kamino_lending` and two other git dependencies are not pinned to a revision

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | OPS-075 (primary) · OPS-071 · OPS-026 |
| **Category** | Build Integrity / Supply Chain |
| **Language** | Rust (Cargo) |
| **File** | `programs/kvault/Cargo.toml:41`, `:49-51`; `Cargo.toml:38-39` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**

Three dependencies are sourced from git without a `rev`, `tag`, or (for two of them) any immutability guarantee:

```toml
# programs/kvault/Cargo.toml:49-51 — no rev, no tag, no branch: tracks the default branch HEAD
kamino_lending = { git = "https://github.com/Kamino-Finance/klend.git", features = ["no-entrypoint"] }

# programs/kvault/Cargo.toml:41 — branch only
strum = { git = "https://github.com/Kamino-Finance/strum", features = ["derive"], branch = "checked_arithmetics" }

# Cargo.toml:38-39 — branch only
[patch.crates-io]
spl-token-2022 = { git = "https://github.com/Kamino-Finance/solana-program-library.git", branch = "spl-token-2022-v0.9.0-patched" }
```

`Cargo.lock` **is** committed and pins `kamino_lending` to `c06001927d68895be487482bdd82dcf6e88e6348`, `strum` to `95f44367…`, and the `spl-token-2022` fork to `05499337…`. That is the mitigation, and it is why this is severity 4 rather than higher. But the lock file only holds while nobody runs `cargo update`, and a branch is a mutable pointer: a force-push, a compromised maintainer account, or a routine `cargo update -p kamino_lending` silently moves the build to different code.

`kamino_lending` is not an ordinary dependency. The vault imports `Reserve` and deserialises KLend's account layout directly (`operations/vault_operations.rs:1144-1164`), derives every share price from `reserve.collateral_exchange_rate()`, and builds its CPI instruction data from `kamino_lending::instruction::DepositReserveLiquidity::DISCRIMINATOR` (`operations/klend_operations.rs:129`). A layout change in KLend that is not reflected here produces silently mis-parsed reserve state — mis-priced shares, not a compile error, because `bytemuck`-style zero-copy reads do not validate field semantics.

**Impact:**

- **Reproducibility.** The deployed binary cannot be reproduced from source with confidence, because the source of a load-bearing dependency is a moving target. This blocks verifiable builds (OPS-070, OPS-071) and undermines any third party's ability to confirm that the mainnet program matches this commit.
- **Supply chain.** A compromise of the `Kamino-Finance/klend` default branch between lock-file refreshes would be inherited by the next build of the vault, with signing authority over the vault's PDAs.
- **Silent semantic drift.** A `Reserve` layout or `collateral_exchange_rate` change upstream would alter the vault's share pricing without any signal at the kvault call sites.

No exploit path exists *at this commit* — the lock file is present and correct. This is a process defect that removes a control, not a live vulnerability.

**Proof of Concept:**

```text
1. A developer runs `cargo update` (or CI does, or a dependency refresh PR lands).
2. Cargo re-resolves kamino_lending to the current HEAD of klend's default branch —
   whatever that is at that moment. No rev is specified to hold it back.
3. `anchor build` succeeds if the Rust API still type-checks.
4. Two silent divergences are possible and neither is caught by the type system:
   a. Reserve's field layout changed -> compute_invested_reserve @ vault_operations.rs:1144-1164
      reads the wrong offsets -> every AUM computation, and therefore every share price,
      is wrong;
   b. DepositReserveLiquidity's discriminator or argument encoding changed ->
      klend_operations.rs:128-132 builds a malformed instruction -> CPIs revert
      (fail-safe) or, worse, decode as a different KLend instruction.
5. The audited source is unchanged; only the bytes behind the git reference moved.
   Nothing in the repository records which upstream commit the deployed binary was built
   against, so the divergence is not detectable after the fact.
```

**Recommendation:**

```toml
# programs/kvault/Cargo.toml — pin to the exact commit the lock file already records
kamino_lending = { git = "https://github.com/Kamino-Finance/klend.git",
                   rev = "c06001927d68895be487482bdd82dcf6e88e6348",
                   features = ["no-entrypoint"] }

strum = { git = "https://github.com/Kamino-Finance/strum",
          rev = "95f44367da40546bc94f4ff565268f45fb68ed5e",
          features = ["derive"] }

# Cargo.toml
[patch.crates-io]
spl-token-2022 = { git = "https://github.com/Kamino-Finance/solana-program-library.git",
                   rev = "05499337404b7709a07c8c44325fb71f642c06da" }
```

Additionally: adopt Anchor's verifiable-build flow (`anchor build --verifiable`, or a pinned-digest Docker image) and publish the resulting hash alongside each release so the mainnet binary can be checked against this commit; and add `cargo audit` / `cargo deny` to CI once CI exists (FV-019, currently absent). As reference points for the next dependency bump, `Cargo.lock` currently resolves `ed25519-dalek 1.0.1` (RUSTSEC-2022-0093), `curve25519-dalek 3.2.1` (RUSTSEC-2024-0344) and `borsh 0.9.3` (RUSTSEC-2023-0033) transitively through `solana-program 1.17.18` — none reachable from the on-chain instruction paths reviewed here, and all out of scope for checklist 11 under `--scope program`, but they are the kind of thing a dependency-scanning CI job is for.

---

#### [F-005] No pause, circuit breaker, or aggregate-outflow limit anywhere in the program

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | AC-030, AC-035 (primary) · ECON-072 · ECON-089 · OPS-045 · FV-057 |
| **Category** | Operational Security / Incident Response |
| **Language** | Rust |
| **File** | `programs/kvault/src/lib.rs:32-218`; `programs/kvault/src/state/vault_state.rs:19-89` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**

`VaultState` has no `paused`, `frozen`, `halted`, or `emergency` field, and none of the 22 instructions in `lib.rs:32-218` is a pause, halt, or emergency-stop. There is likewise no aggregate cap on value leaving the vault: `withdraw`, `withdraw_from_available` and `redeem_in_kind` are bounded only per-call, by the caller's own share balance (`handler_withdraw.rs:212`, `handler_redeem_in_kind.rs:47`). No rolling per-window outflow accounting exists.

The only lever available in an incident is a program upgrade by the BPF upgrade authority — an action that, per F-002's absent timelock and OPS-006's absent on-chain delay, is itself instantaneous and unbounded.

**Impact:**

This is a control gap, not an exploit. Its significance is conditional on the vault's largest external dependency: **the vault's entire AUM is derived from KLend reserve state read over CPI** (`operations/vault_operations.rs:1144-1164`), with no independent oracle, no sanity bound, and no rate-of-change cap on `collateral_exchange_rate`. If KLend reports a wrong exchange rate — through a bug, a reserve insolvency, or an exploit on the KLend side — kvault will mis-price shares and honour withdrawals at that price until someone ships a program upgrade. There is no intermediate response.

The argument against a pause is real and should be weighed: an always-open withdrawal path *is* a depositor protection, and a pausable vault introduces a new way for an admin to trap funds. The recommendation below therefore proposes an asymmetric breaker — one that can halt inflow and rebalancing while leaving exits open — rather than a blanket pause.

Two secondary consequences:

- ECON-072 / ECON-089: per-user limits do not bound a bug- or manipulation-driven drain. If a pricing defect makes shares redeemable above their true value, nothing rate-limits the resulting outflow.
- FV-057: there is no fallback for the KLend dependency. `check_matched_allocation_reserves_refreshed` (`vault_operations.rs:1075-1108`) rejects a *stale* reserve, which is a liveness guard, but nothing rejects a *wrong* one.

**Proof of Concept:**

```text
Scenario: KLend reports an inflated collateral_exchange_rate for reserve R (upstream bug or
exploit). kvault has no independent price source and no bound on rate-of-change.

1. compute_invested_reserve reads the inflated rate and computes
   liquidity_amount = exchange_rate.checked_fraction_collateral_to_liquidity(ctoken_amount)
                                                          [vault_operations.rs:1151-1153]
2. invested.total, and therefore compute_aum, are inflated
                                                          [state/vault_state.rs:178-187]
3. Every withdraw prices shares against the inflated AUM
   total_for_user = aum * shares / shares_issued           [vault_operations.rs:1400-1404]
   Early withdrawers redeem at the inflated price and drain real liquidity; the loss is
   socialised onto whoever is still holding shares when the rate corrects.
4. Response options available to the operator, in order:
   a. Pause the vault                  -> no such instruction exists.
   b. Cap outflow for one window       -> no aggregate outflow accounting exists.
   c. Drop the bad reserve             -> remove_allocation requires ctoken_allocation == 0
                                          (state/vault_allocation.rs:46-49), which requires a
                                          successful invest() evacuation priced at the same
                                          bad rate.
   d. Set target_allocation_weight = 0 -> stops NEW allocation, does not stop withdrawals
                                          pricing against the bad rate.
   e. Upgrade the program              -> the only real option; minutes-to-hours, and itself
                                          unbounded and un-timelocked.
5. Between detection and (e), nothing slows the drain.
```

**Recommendation:**

```rust
// 1. Asymmetric breaker: halt inflow and rebalancing, never exits.
//    Add to VaultState (padding_2: [u8; 6] has room):
pub deposits_halted: u8,   // 0 = open, 1 = halted
pub invest_halted: u8,     // 0 = open, 1 = halted

// Gate the inflow paths only:
//   handler_deposit::process        -> require!(vault.deposits_halted == 0, VaultDepositsHalted)
//   handler_invest::process         -> require!(vault.invest_halted   == 0, VaultInvestHalted)
// Leave withdraw / withdraw_from_available / redeem_in_kind ungated so depositors can always
// exit. This closes the "admin traps funds" objection by construction.

// 2. Separate the guardian from the admin. Add VaultState.guardian_authority, settable only by
//    the global admin, permitted ONLY to set the halt flags to 1 (never to 0, never anything
//    else). Un-halting stays with the vault admin. A guardian key that can only ever stop
//    inflow is safe to hold hot and to distribute widely.

// 3. Bound the blast radius of a mispricing (ECON-089). Track rolling outflow in VaultState:
pub outflow_window_start_ts: u64,
pub outflow_in_window: u64,
pub max_outflow_per_window: u64,   // 0 = uncapped, preserving today's behaviour by default
// In vault_operations::withdraw, after total_for_user is computed (line 224):
if vault.max_outflow_per_window > 0 {
    if current_timestamp >= vault.outflow_window_start_ts + OUTFLOW_WINDOW_SECONDS {
        vault.outflow_window_start_ts = current_timestamp;
        vault.outflow_in_window = 0;
    }
    vault.outflow_in_window = vault.outflow_in_window
        .checked_add(total_for_user).ok_or(KaminoVaultError::MathOverflow)?;
    require_gte!(vault.max_outflow_per_window, vault.outflow_in_window,
                 KaminoVaultError::OutflowWindowCapReached);
}

// 4. Sanity-bound the trusted input. Store last_exchange_rate_sf per allocation and reject a
//    per-refresh move beyond a configured bps threshold, so an upstream mispricing surfaces as
//    a revert rather than as a silently honoured withdrawal.
```

---

#### [F-006] Token-2022 base mints are accepted with no extension screening — permanent delegate, freeze authority, transfer hook, and frozen-default are all unchecked

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | AV-063, AV-064, AV-065, AV-066 (primary) · AV-050 · EXT-012 · EXT-013 · ECON-044 · ECON-047 · KV-019 · KV-023 · KV-105 |
| **Category** | Account Validation / Token-2022 |
| **Language** | Rust |
| **File** | `programs/kvault/src/handlers/handler_init_vault.rs:101-104`, `:124`; `Cargo.toml:17`; `programs/kvault/src/utils/token_ops.rs:100-137` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**

`init_vault` is permissionless and accepts any mint owned by either token program:

```rust
// handler_init_vault.rs:101-104
#[account(mint::token_program = token_program)]
pub base_token_mint: Box<InterfaceAccount<'info, Mint>>,
…
// handler_init_vault.rs:124
pub token_program: Interface<'info, TokenInterface>,
```

`anchor-spl` is built with the `token_2022` feature (`Cargo.toml:17`), so `TokenInterface` resolves to classic SPL Token *or* Token-2022. A repository-wide search for `get_extension`, `PermanentDelegate`, `DefaultAccountState`, `TransferHook`, `MintCloseAuthority`, `freeze_authority`, `interest_bearing` and `confidential` across `programs/` returns **zero matches**: no extension is ever read, and there is no mint allowlist.

Four of the five Token-2022 sub-vectors in KV-105 are consequently unmitigated on a hostile base mint:

| Extension | Consequence for a vault on that mint | Mitigated? |
|---|---|---|
| `PermanentDelegate` | The delegate can `transfer_checked` or `burn` directly from `token_vault`, bypassing every program check. Accounting keeps showing the old balances. | **No** |
| `FreezeAuthority` / `DefaultAccountState::Frozen` | The authority freezes `token_vault`; all outbound `transfer_checked` calls revert permanently. Deposits already made are locked. | **No** |
| `TransferHook` | `token_ops::tokens::transfer_to_vault` / `transfer_to_token_account` (`utils/token_ops.rs:100-137`) build a plain `TransferChecked` CPI with no hook-account resolution; the hook has no allowlist. | **No** |
| `TransferFee` | Deposits **revert** — `require!(vault_token_balance_after == vault_token_balance_before + total_token_to_deposit)` (`handler_deposit.rs:112-115`) rejects any short credit. | **Yes**, fail-closed (liveness, not loss) |
| `InterestBearing` | UI amount drifts from raw amount; the vault prices in raw units throughout, so no mispricing arises. | Not applicable |

Two genuine mitigations are already present and worth recording: every transfer uses `transfer_checked` with decimals bound (`utils/token_ops.rs:100-113`, `:124-137`), and every fund-moving instruction re-reads balances and asserts exact equality afterwards — which is what turns the fee-on-transfer case into a revert rather than an accounting error. The **shares** mint is unaffected: it is created by the program with `mint::authority = base_vault_authority`, no freeze authority, and is pinned to classic SPL Token via `Program<'info, Token>` (`handler_init_vault.rs:106-113`, `:125`).

**Impact:**

A vault created on an attacker-controlled Token-2022 mint is a rug: the mint's permanent delegate drains `token_vault` with a single `transfer_checked` that never touches this program, or its freeze authority locks every depositor out. Anyone who deposits into such a vault loses everything.

Severity is 4, not higher, because of who bears the risk. `init_vault` is permissionless, so the hostile-mint vault is *a vault the attacker created*, not a compromise of an existing one — a depositor must choose to deposit into it. There is no path from a hostile mint to the funds in an unrelated, legitimately-configured vault. The exposure is therefore: users who deposit into an unvetted vault (mitigated in practice by whatever curation the Kamino front-end applies, which is off-chain and outside this scope), plus the residual risk that a *legitimate* base mint's freeze authority is later used against the vault. The mainnet-live calibration lever moved this from 3 to 4.

**Proof of Concept:**

```text
Actor:      Mallory, mint authority of a Token-2022 mint M configured with PermanentDelegate = Mallory.
Capability: permissionless — init_vault requires no authorization. [handler_init_vault.rs:78-126]
Capital:    rent for the vault accounts + the 1,000-unit initial deposit of her own token.

1. Mallory creates mint M with the PermanentDelegate extension pointing at her own key, plus
   plausible metadata. Nothing in kvault will ever read that extension.

2. Mallory calls init_vault with base_token_mint = M and token_program = Token-2022.
   The only mint constraint is `mint::token_program = token_program`.  [handler_init_vault.rs:101-104]
   The vault is created: token_vault PDA, shares mint, 1,000 dead shares seeded.
                                                                      [handler_init_vault.rs:90-98]

3. The vault looks completely normal on-chain: correct PDAs, correct authorities, working
   deposit/withdraw, a real share price. Every kvault invariant holds.

4. Alice deposits 1,000,000 units of M. transfer_checked moves them into token_vault; the
   post-transfer equality check passes because M charges no transfer fee. [handler_deposit.rs:112-115]

5. Mallory calls spl_token_2022::instruction::transfer_checked DIRECTLY — not through kvault —
   with herself as the permanent delegate authority, source = token_vault, amount = the full
   balance. Token-2022 authorises it because PermanentDelegate outranks the account owner.

6. token_vault is empty. vault.token_available still reads 1,001,000. Alice's next withdraw
   reverts inside the SPL transfer for insufficient funds. No kvault check was bypassed —
   the program was never consulted.

Variant (b): instead of a permanent delegate, M carries a FreezeAuthority. Mallory calls
freeze_account on token_vault. Every outbound transfer_checked reverts forever; no thaw path
exists in kvault. Same outcome, different mechanism.
```

**Recommendation:**

```rust
// In handler_init_vault::process, before vault_operations::initialize (handler_init_vault.rs:30):
use anchor_spl::token_2022::spl_token_2022::extension::{
    BaseStateWithExtensions, StateWithExtensions, ExtensionType,
    permanent_delegate::PermanentDelegate,
    default_account_state::DefaultAccountState,
    transfer_hook::TransferHook,
    mint_close_authority::MintCloseAuthority,
};

fn validate_base_mint(mint_ai: &AccountInfo) -> Result<()> {
    // Classic SPL Token mints carry no extensions — nothing to screen.
    if mint_ai.owner == &anchor_spl::token::ID {
        return Ok(());
    }
    let data = mint_ai.try_borrow_data()?;
    let mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&data)?;

    // Hard rejects: each of these lets a third party seize or lock custodied funds.
    require!(mint.get_extension::<PermanentDelegate>().is_err(),
             KaminoVaultError::UnsupportedMintExtension);
    require!(mint.get_extension::<TransferHook>().is_err(),
             KaminoVaultError::UnsupportedMintExtension);
    require!(mint.get_extension::<MintCloseAuthority>().is_err(),
             KaminoVaultError::UnsupportedMintExtension);
    if let Ok(das) = mint.get_extension::<DefaultAccountState>() {
        require!(das.state == spl_token_2022::state::AccountState::Initialized as u8,
                 KaminoVaultError::UnsupportedMintExtension);
    }
    // Freeze authority: reject, or record it in VaultState so the risk is visible on-chain
    // to every prospective depositor rather than discovered after the fact.
    require!(mint.base.freeze_authority.is_none(),
             KaminoVaultError::UnsupportedMintFreezeAuthority);
    Ok(())
}
```

If the protocol intends to support transfer-hook or transfer-fee mints later, the changes are larger and should be scoped separately: hook-account resolution via `spl_transfer_hook_interface` plus a hook-program allowlist for the former, and switching deposit accounting from declared-amount equality to a balance delta (`after − before`, `checked_sub`) for the latter. Either way, record the decision in-repo: the current silence reads as "unconsidered" rather than "deliberately fail-closed".

---

#### [F-007] `CpiMemoryLender` invokes the raw CPI syscall, skipping the account-borrow consistency checks that `invoke_signed` performs

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | OPS-023, OPS-024 (primary) · AV-088 · RE-003 · RE-007 |
| **Category** | CPI Safety / Memory Soundness |
| **Language** | Rust |
| **File** | `programs/kvault/src/utils/cpi_mem.rs:136-174` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**

Every CPI to Kamino Lending goes through `CpiMemoryLender`, a compute- and heap-optimisation wrapper that reuses one `Vec<AccountMeta>` and one `Vec<u8>` across calls (`cpi_mem.rs:63-113`). Its invocation path does not call `solana_program::program::invoke_signed`; it calls the syscall directly:

```rust
// cpi_mem.rs:141-165
#[cfg(target_os = "solana")]
{
    let stable_instruction = StableInstruction::from(instruction);
    let numeric_result = unsafe {
        solana_program::syscalls::sol_invoke_signed_rust(
            &stable_instruction as *const _ as *const u8,
            account_infos as *const _ as *const u8,
            account_infos.len() as u64,
            signers_seeds as *const _ as *const u8,
            signers_seeds.len() as u64,
        )
    };
    …
}
```

Upstream `invoke_signed` does two things before reaching this syscall. It performs the syscall — and, first, it walks the instruction's account metas and takes a matching `RefCell` borrow on each corresponding `AccountInfo` (`try_borrow_mut_lamports` / `try_borrow_mut_data` for writable metas, the shared variants otherwise), returning `AccountBorrowFailed` if any is already borrowed incompatibly. That check exists because the runtime writes directly into the account data buffers during a CPI: if Rust believes a `Ref` or `RefMut` is live on a buffer the callee mutates, the outstanding reference observes memory changing underneath it — aliasing UB, and in practice a silently stale read.

This implementation drops that check. The `#[cfg(not(target_os = "solana"))]` arm (`cpi_mem.rs:168-173`) *does* call `invoke_signed`, so the safety property that holds under `cargo test` is not the one that holds on-chain — off-chain tests cannot surface a violation.

**Impact:**

**No violation exists at this commit.** Every call site was traced and each drops its borrows before the CPI:

| Call site | Borrow taken | Dropped before CPI |
|---|---|---|
| `handler_withdraw.rs:229` | `Ref<Reserve>` on the target reserve | Yes — explicit `drop(reserve_state_to_withdraw_from)` at `:274`, before the redeem CPI at `:293` |
| `handler_invest.rs:53` | `Ref<Reserve>` | Yes — explicit `drop(reserve)` at `:102`, before the CPIs at `:124`/`:132` |
| `handler_withdraw_pending_fees.rs:37` | `Ref<Reserve>` | Yes — explicit `drop(reserve)` at `:77`, before the CPI at `:81` |
| `klend_operations.rs:81-86` | `Ref<Reserve>` to read `lending_market` | Yes — temporary, dropped at end of statement, before `program_invoke` at `:95` |
| all handlers | `RefMut<VaultState>` held across CPIs | Not dropped — but `vault_state` is never an `AccountMeta` of any CPI, so the runtime never writes it |

The finding is that this correctness is maintained **by convention and by three hand-placed `drop()` calls**, with no compiler or runtime enforcement. The `unsafe` block carries no safety comment stating the invariant callers must uphold, and the `Instruction`-recovery dance around it (`cpi_mem.rs:160-164`) is subtle enough to discourage close reading. A future handler that holds a reserve `Ref` across a klend CPI — the exact pattern three existing handlers narrowly avoid — gets no error, no panic, and no test failure: it gets a stale read of reserve state, feeding `collateral_exchange_rate()` and therefore share pricing.

Two related consequences: `RE-003` — post-CPI balances are re-read via `token_interface::accessor::amount` (`handler_withdraw.rs:302-306`, `:341-355`), which reads bytes 64..72 of the account with no owner re-validation, rather than Anchor's `.reload()`; and `RE-007` — account owners are not re-asserted after CPIs. Both are safe today only because KLend is compile-time pinned (`Program<'info, KaminoLending>`) and no attacker-controlled program is ever invoked.

**Proof of Concept:**

```text
This is a latent-soundness finding: no exploitable instance exists at commit 1d146d70.
What follows is the regression that the current design does not prevent.

1. A developer adds a handler that needs reserve data both before and after a klend CPI,
   and — reasonably, to save a second deserialisation — keeps the guard alive:

       let reserve = ctx.accounts.reserve.load()?;          // Ref<Reserve> now live
       let rate_before = reserve.collateral_exchange_rate();
       klend_operations::cpi_deposit_reserve_liquidity(&ctx, &mut cpi_mem, bump, amount)?;
       let rate_after = reserve.collateral_exchange_rate();  // same Ref, still live

2. Under solana_program::program::invoke_signed this fails loudly and immediately:
   `reserve` is a writable meta of DepositReserveLiquidity (klend_operations.rs:28), so the
   pre-flight borrow check calls try_borrow_mut_data() on it, finds the outstanding Ref, and
   returns AccountBorrowFailed. The bug is caught at the first test run.

3. Under cpi_mem::invoke_signed_and_recover_ix that check does not exist. The syscall is
   entered with the Ref live. The runtime writes the refreshed reserve into the same buffer
   the Ref points at.

4. Result: `rate_after` reads through a reference Rust believes is immutable, over memory the
   runtime just mutated. In the best case it is a stale value that silently mis-prices shares;
   in the worst it is undefined behaviour whose manifestation depends on what the optimiser
   assumed about the immutable borrow.

5. Detection: none. It compiles, no runtime error fires, and the
   #[cfg(not(target_os = "solana"))] arm (cpi_mem.rs:168-173) routes cargo-test builds through
   the CHECKED invoke_signed — so the off-chain test suite would catch it and the on-chain
   binary would not, which is precisely backwards.
```

**Recommendation:**

```rust
// 1. Restore the borrow check in the optimised path. It is ~10 lines and runs only over the
//    instruction's own metas, so the CU cost is small and bounded.
fn invoke_signed_and_recover_ix(
    instruction: Instruction,
    account_infos: &[AccountInfo],
    signers_seeds: &[&[&[u8]]],
) -> (ProgramResult, Instruction) {
    #[cfg(target_os = "solana")]
    {
        // Mirror solana_program::program::invoke_signed's pre-flight check: prove no
        // outstanding Rust borrow aliases memory the runtime is about to write.
        for account_meta in instruction.accounts.iter() {
            for account_info in account_infos.iter() {
                if account_meta.pubkey == *account_info.key {
                    let ok = if account_meta.is_writable {
                        account_info.try_borrow_mut_lamports().is_ok()
                            && account_info.try_borrow_mut_data().is_ok()
                    } else {
                        account_info.try_borrow_lamports().is_ok()
                            && account_info.try_borrow_data().is_ok()
                    };
                    if !ok {
                        return (Err(ProgramError::AccountBorrowFailed), instruction);
                    }
                    break;
                }
            }
        }
        // … existing syscall path unchanged …
    }
}

// 2. Document the invariant at the unsafe block, so the next reader inherits it:
//
//    // SAFETY: sol_invoke_signed_rust requires that no Rust borrow (Ref/RefMut) is live on
//    // any AccountInfo listed as a writable meta of `instruction` — the runtime writes those
//    // buffers in place. Callers MUST drop every AccountLoader::load()/load_mut() guard on a
//    // CPI-touched account before calling. Current callers that rely on this:
//    //   handler_withdraw.rs:274, handler_invest.rs:102, handler_withdraw_pending_fees.rs:77.
//    // Violating it is silent UB on-chain; the non-solana cfg arm below uses the CHECKED
//    // invoke_signed, so off-chain tests will NOT reproduce a violation.

// 3. Make the two arms agree. Either add the check above (preferred), or route the
//    non-solana arm through invoke_signed_unchecked so test and production semantics match
//    and a violation is reproducible off-chain.

// 4. Replace the post-CPI `accessor::amount` reads with Anchor's `.reload()` on the
//    InterfaceAccount wrappers (handler_withdraw.rs:302-306, :341-355;
//    handler_invest.rs:161-163; handler_withdraw_pending_fees.rs:89, :113-117), which
//    re-validates owner and discriminator rather than trusting a fixed byte offset (RE-003).
```

---

#### [F-008] User-supplied `max_amount` reaches an unchecked subtraction in `deposit` — a small deposit aborts the transaction instead of returning a typed error

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | AR-002 (primary) · AR-001 · AR-003 · AR-005 · AR-056 · KV-011 · FV-058 |
| **Category** | Arithmetic |
| **Language** | Rust |
| **File** | `programs/kvault/src/operations/vault_operations.rs:62-68` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**

```rust
// vault_operations.rs:62-68
let num_reserve: u64 = vault.get_reserves_with_allocation_count().try_into().unwrap();
let crank_funds_to_deposit = num_reserve * vault.crank_fund_fee_per_reserve;   // unchecked *
let raw_max_user_tokens_to_deposit = max_amount - crank_funds_to_deposit;      // unchecked -
```

`max_amount` is the caller's own instruction argument (`lib.rs:66-96`). `crank_fund_fee_per_reserve` is admin-set and unbounded (F-001). When `max_amount < crank_funds_to_deposit` the subtraction underflows.

The workspace sets `overflow-checks = true` for the release profile (`Cargo.toml:6`), so the result is a **panic** — `Program failed to complete` — not a wrap. That is the right failure direction and it is why this is severity 3 rather than higher: a wrapping build would produce a colossal `raw_max_user_tokens_to_deposit`, which would then be clamped by `max_depositable_to_cap` and finally caught by `require!(total_token_to_deposit <= max_amount)` (`handler_deposit.rs:98-101`), so even the wrap case is caught. The defect is the failure *mode*, not a loss of funds.

The same pattern appears on the multiplication at `:66` (25 × `crank_fund_fee_per_reserve` overflows for `crank_fund_fee_per_reserve > u64::MAX / 25`) and in several other places where `overflow-checks` is the only thing standing between the program and a wrap: `vault.token_available += amount` (`:1388`), `vault.token_available -= amount` (`:1392`), `shares_issued += / -=` (`:1577`, `:1581`), `ctoken_allocation += / -=` (`:1557`, `:1571`), `available_crank_funds += / -=` (`:1594`, `:677`), `rewards_available += / -=` (`:964`, `:979`, `:942`), and `allocation_for_reserve.last_invest_slot + vault.min_invest_delay_slots` (`:578`).

**Impact:**

A user who deposits less than the vault's crank fee gets an opaque program abort rather than `DepositAmountBelowMinimum` or `DepositAmountsZero`. Consequences:

- No actionable error for the caller or their wallet UI — a panic carries no `KaminoVaultError` code, so clients cannot distinguish "deposit too small" from a genuine program fault.
- Compute units are consumed up to the panic point.
- Operationally, a panic in a mainnet program is indistinguishable in logs from a real bug, which raises the noise floor for incident detection.

No state corruption and no fund loss: the transaction reverts atomically.

**Proof of Concept:**

```text
1. Vault V has 5 weighted reserves; the admin has set crank_fund_fee_per_reserve = 100.
   crank_funds_to_deposit = 5 * 100 = 500.              [vault_operations.rs:66]

2. Alice — who has no way to see this from the instruction signature — calls
   deposit(max_amount = 400).

3. require!(max_amount > 0) passes.                     [handler_deposit.rs:23]

4. raw_max_user_tokens_to_deposit = 400 - 500
   -> u64 underflow -> panic, because overflow-checks = true [Cargo.toml:6]
                                                        [vault_operations.rs:68]

5. Observed: "Program KvauGMsp... failed: SBF program panicked".
   Expected:  a KaminoVaultError::DepositAmountBelowMinimum (code 1027), which already
              exists and is returned 40 lines later at vault_operations.rs:113 for
              exactly this situation.

6. Companion case: with crank_fund_fee_per_reserve > u64::MAX / 25, line 66 panics on the
   multiplication before line 68 is ever reached.
```

**Recommendation:**

```rust
// vault_operations.rs:62-68
let num_reserve: u64 = u64::try_from(vault.get_reserves_with_allocation_count())
    .map_err(|_| error!(KaminoVaultError::IntegerOverflow))?;

let crank_funds_to_deposit = num_reserve
    .checked_mul(vault.crank_fund_fee_per_reserve)
    .ok_or(KaminoVaultError::MathOverflow)?;

let raw_max_user_tokens_to_deposit = max_amount
    .checked_sub(crank_funds_to_deposit)
    .ok_or(KaminoVaultError::DepositAmountBelowMinimum)?;   // typed, actionable, already exists
```

More broadly: `overflow-checks = true` is a good backstop and should stay, but it is a *panic* backstop. On any path that user input can reach, prefer `checked_*` with an existing `KaminoVaultError` so the failure is legible. The accounting helpers in `vault_operations::common` (`:1387-1395`, `:1548-1582`, `:1593-1595`) are the right place to start — they are small, they are the only writers of the core accounting fields, and converting them to `Result`-returning checked forms would cover most of the sites listed above in one change.

---

#### [F-009] The `min_invest_delay_slots` rate limit is bypassable by capping `max_amount`

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | AC-044 (primary) · SM-041 · ECON-051 |
| **Category** | State Machine / Rate Limiting |
| **Language** | Rust |
| **File** | `programs/kvault/src/operations/vault_operations.rs:578-580`, `:610-621`, `:681-686` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**

`invest` is permissionless (`handler_invest.rs:189` — `payer: Signer`, with no authority link) and carries a per-reserve cooldown:

```rust
// vault_operations.rs:578-580
if current_slot < allocation_for_reserve.last_invest_slot + vault.min_invest_delay_slots {
    return err!(KaminoVaultError::InvestTooSoon);
}
```

The cooldown is armed only on the way out, and only conditionally:

```rust
// vault_operations.rs:610-621
let max_amount_f = Fraction::from(max_amount);
let is_capped_by_max_amount = liquidity_f > max_amount_f;
let liquidity_f = if is_capped_by_max_amount { max_amount_f } else { liquidity_f };
…
// vault_operations.rs:681-686
if !is_capped_by_max_amount {
    vault.set_allocation_last_invest_slot(reserve_address, current_slot)?;
}
```

`max_amount` is the caller's argument (`lib.rs:121-126`). Passing any value below the amount the rebalance actually wants to move sets `is_capped_by_max_amount = true`, which skips the `last_invest_slot` update — so the cooldown never advances and the next call passes the check at `:578` again in the same slot.

The same flag also diverts the rounding-loss accounting: when capped, `available_crank_funds` is not consumed (`:676`) and the payer covers the 0-or-1-unit `rounding_loss` from their own token account instead (`handler_invest.rs:104-119`).

**Impact:**

The cooldown is a liveness/anti-churn control, so bypassing it does not move funds. Its practical effects:

- An attacker can call `invest` repeatedly against the same reserve within one slot, each call moving at most `max_amount` and paying the rounding loss out of pocket (`handler_invest.rs:110-112`). Every call must still clear `liquidity_f > vault.min_invest_amount` (`:635-637`), so with the default `min_invest_amount = 0` the floor is only "moves at least one cToken".
- The AUM-non-decreasing assertions in `post_transfer_invest_checks` (`vault_checks.rs:245-259`) hold on every iteration, so there is no value leak — the attacker burns transaction fees and their own rounding losses to churn the vault's allocation.
- Contribution to F-003: each such call write-locks `vault_state` and every allocation reserve (via the mandatory refresh), so cheap spam can crowd the vault's write-lock queue — see KV-131.

There is no profit path, which is why this is 3 and not higher. The design intent behind the conditional is legible (a partial move is not a completed rebalance, so it should not consume the cooldown), but the effect is that the control does not bind an adversary who simply always passes a small `max_amount`.

**Proof of Concept:**

```text
Actor:      any wallet. invest is permissionless.       [handler_invest.rs:189]
Capital:    transaction fees + 1 base unit per call for rounding_loss.

Precondition: vault.min_invest_amount == 0 (the zero-initialised default —
              init_vault never sets it, handler_init_vault.rs:17-35) and the vault
              is off-target for reserve R by more than 1 unit.

1. Attacker calls invest_with_max_amount(max_amount = 1) targeting R.  [lib.rs:121-126]
2. liquidity_f (the real rebalance delta, large) > 1 -> is_capped_by_max_amount = true
                                                        [vault_operations.rs:611]
   liquidity_f := 1                                     [vault_operations.rs:618]
3. liquidity_f (1) > vault.min_invest_amount (0) -> the guard at :635 passes.
4. collateral_amount = floor(liquidity_to_collateral(1)); the CPI executes if > 0.
5. Because is_capped_by_max_amount is true, line 684 is skipped:
   allocation.last_invest_slot is NOT updated.          [vault_operations.rs:684-686]
6. Attacker repeats in the same slot. The check at :578 still reads the OLD
   last_invest_slot, so InvestTooSoon never fires. Repeat until compute is exhausted.

Cost to attacker: fees + 1 unit per call, paid from payer_token_account.
                                                        [handler_invest.rs:104-119]
Gain: none. The AUM-non-decreasing checks hold every iteration.
                                                        [vault_checks.rs:245-259]
Effect: the rate limit does not bind; vault_state and all allocation reserves are
        write-locked once per call (see KV-131 / F-003).
```

**Recommendation:**

```rust
// vault_operations.rs:681-686 — advance the cooldown whenever a move actually happened,
// and scale it to the fraction moved so a partial rebalance is not penalised as a full one.
if collateral_amount > 0 {
    if is_capped_by_max_amount {
        // Partial move: charge a proportional share of the cooldown, floored at 1 slot so
        // repeated dust calls still cost the caller wall-clock time.
        let fraction_moved_bps = liquidity_f
            .full_mul_int_ratio(FULL_BPS as u64, uncapped_liquidity_f.to_ceil::<u64>().max(1));
        let partial_delay = vault.min_invest_delay_slots
            .saturating_mul(fraction_moved_bps.to_floor::<u64>())
            / u64::from(FULL_BPS);
        vault.set_allocation_last_invest_slot(
            reserve_address,
            current_slot.saturating_sub(vault.min_invest_delay_slots)
                        .saturating_add(partial_delay.max(1)),
        )?;
    } else {
        vault.set_allocation_last_invest_slot(reserve_address, current_slot)?;
    }
}

// Simpler alternative, if proportional accounting is more machinery than the control warrants:
// always set last_invest_slot when collateral_amount > 0, and let the crank operator size
// max_amount to the full delta. A partial move then costs a full cooldown — which is the
// conservative reading of what the cooldown is for.

// Independently: give min_invest_amount a non-zero default at init_vault
// (handler_init_vault.rs:30-35), so a freshly created vault is not born with the
// dust-invest floor disabled.
```

---

#### [F-010] `vault.shares_issued` permanently exceeds `shares_mint.supply` by 1,000 and the divergence is undocumented

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | SM-051 (primary) · AR-034 |
| **Category** | State Invariant / Integration Safety |
| **Language** | Rust |
| **File** | `programs/kvault/src/handlers/handler_init_vault.rs:43-73`; `programs/kvault/src/utils/consts.rs:27`; `programs/kvault/src/operations/vault_operations.rs:127-133` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**

`init_vault` runs a full deposit of `INITIAL_DEPOSIT_AMOUNT = 1000` (`consts.rs:27`) through `vault_operations::deposit`, which credits the accounting:

```rust
// vault_operations.rs:127-133
common::deposit_into_vault(vault, user_tokens_to_deposit);   // token_available += 1000
common::mint_shares(vault, shares_to_mint);                  // shares_issued   += 1000
```

and then transfers the 1,000 tokens in (`handler_init_vault.rs:63-73`) — but **never calls `shares::mint`**. Compare `handler_deposit.rs:82-90`, which does. The result is 1,000 shares that exist in `vault.shares_issued` and are backed by 1,000 real tokens, but for which no SPL token was ever minted and which therefore nobody can ever redeem.

This is the "dead shares" mitigation for the first-depositor inflation attack, and as a mitigation **it works** — it is the reason KV-006 and ECON-013..017 pass. Two properties fall out of it that are worth stating explicitly, because nothing in the repository does:

1. `vault.shares_issued == shares_mint.supply + 1000`, permanently, for every vault.
2. The vault can never reach `shares_issued == 0` while `aum > 0`, which is what keeps the `shares_issued == shares_to_withdraw` shortcut in `compute_user_total_received_on_withdraw_fraction` (`vault_operations.rs:1400-1404`) unreachable in practice and prevents a "last holder takes everything" edge.

The finding is not the mechanism; it is that the mechanism is invisible. There is no comment at `handler_init_vault.rs:43` (the source comments in this tree are stripped), no constant named to suggest it, no event, and no note in `README.md`.

**Impact:**

Any consumer that computes share price as `aum / shares_mint.supply` — the natural formula, and the one an integrator reaches for first — **overstates** the price. The error is `1000 / shares_issued`: 10 % on a vault with 10,000 shares issued, 0.1 % at 1,000,000, asymptotically negligible but never zero, and largest exactly when a vault is new and thinnest.

Downstream effects: a front-end quoting redemption value, a lending protocol accepting vault shares as collateral, or an accounting system reconciling TVL will each be wrong by that factor unless they happen to read `VaultState.shares_issued` instead of the mint. Nothing on-chain is wrong — `withdraw` prices against `vault.shares_issued` throughout (`vault_operations.rs:205`) — so this is an integration-surface hazard rather than a protocol defect. That, plus the small and shrinking magnitude, is why it is 3.

The 1,000 tokens themselves are permanently locked. That is intentional and is the price of the mitigation; it is noted here only for completeness alongside F-001's separate (and unintentional) locked pool.

**Proof of Concept:**

```text
1. Alice calls init_vault. handler_init_vault::process runs:
     vault_operations::deposit(vault, …, INITIAL_DEPOSIT_AMOUNT = 1000, 0, ts)
                                                        [handler_init_vault.rs:47-53]
   Inside deposit, with shares_issued == 0:
     get_shares_to_mint(aum=0, 1000, 0) -> 1000         [vault_operations.rs:1115-1117]
     common::mint_shares(vault, 1000)   -> vault.shares_issued = 1000
                                                        [vault_operations.rs:128, :1580-1582]

2. The handler transfers 1000 tokens from Alice into token_vault …
                                                        [handler_init_vault.rs:63-73]
   … and returns. There is NO shares::mint call anywhere in the function.
   (Contrast handler_deposit.rs:82-90, which mints on every ordinary deposit.)

3. Post-condition:
     vault.shares_issued  = 1000
     shares_mint.supply   = 0
     token_vault.amount   = 1000
     Alice holds 0 shares. Nobody holds the 1000.

4. Bob deposits 9000 and receives 9000 shares. Now:
     vault.shares_issued  = 10000
     shares_mint.supply   =  9000      <-- diverges by exactly 1000, forever
     aum                  = 10000

5. An integrator computes price = aum / shares_mint.supply = 10000 / 9000 = 1.111
   The on-chain truth is    price = aum / vault.shares_issued = 10000 / 10000 = 1.000
   The integrator overstates Bob's position by 11 %.

6. Bob redeems all 9000 shares:
     total_for_user = 10000 * 9000 / 10000 = 9000       [vault_operations.rs:1400-1404]
   He gets 9000 — correct. The remaining 1000 tokens back the 1000 dead shares and stay.
   shares_issued never reaches 0 while aum > 0, which is exactly the protection intended.
```

**Recommendation:**

```rust
// 1. Name the mechanism where it happens (handler_init_vault.rs:42, currently a bare blank line):
//
//    // Seed the vault with INITIAL_DEPOSIT_AMOUNT (1000) of "dead shares": the accounting
//    // records them in vault.shares_issued and the creator funds them with real tokens, but
//    // NO SPL share token is minted, so they are unredeemable by construction. This is the
//    // first-depositor / share-inflation mitigation (KV-006): it keeps shares_issued > 0 and
//    // the share price anchored near 1:1 for the first real depositor.
//    //
//    // INVARIANT, deliberate and permanent:
//    //     vault.shares_issued == shares_mint.supply + INITIAL_DEPOSIT_AMOUNT
//    // Off-chain consumers MUST price against VaultState.shares_issued, never against
//    // shares_mint.supply.

// 2. Make it checkable rather than folklore. Add a named constant and assert the invariant in
//    the post-conditions that already exist in handler_deposit (:98-115) and on the withdrawal
//    paths — it costs one comparison and converts a documentation problem into a runtime one:
pub const DEAD_SHARES: u64 = INITIAL_DEPOSIT_AMOUNT;

require_eq!(
    vault_state.shares_issued,
    ctx.accounts.shares_mint.supply + DEAD_SHARES,
    KaminoVaultError::SharesIssuedAmountDoesNotMatch
);

// 3. Surface it where integrators actually look: document the invariant in README.md next to
//    the deployment addresses, and expose shares_issued (not mint supply) as the canonical
//    denominator in libs/kvault-interface's share-price helper.
```

---

#### [F-011] `f64` constant in the management-fee divisor, plus a contradictory unused integer twin

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | AR-063 (primary) · KV-128 · FV-018 |
| **Category** | Arithmetic / Code Hygiene |
| **Language** | Rust |
| **File** | `programs/kvault/src/utils/consts.rs:19-20`; `programs/kvault/src/operations/vault_operations.rs:873-874` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**

The management-fee accrual divides by a floating-point constant evaluated at runtime:

```rust
// consts.rs:19-20
pub const SECONDS_PER_YEAR: f64 = 365.242_199 * 24.0 * 60.0 * 60.0;   // 31_556_925.2136
pub const SECONDS_PER_YEAR_U64: u64 = 31556925;                        // never referenced

// vault_operations.rs:872-874
let mgmt_fee_yearly = Fraction::from_bps(vault.management_fee_bps);
let mgmt_fee = mgmt_fee_yearly * u128::from(seconds_passed)
    / SECONDS_PER_YEAR.ceil().to_u128().unwrap();
```

`SECONDS_PER_YEAR.ceil()` is `31_556_926.0`; `SECONDS_PER_YEAR_U64` is `31_556_925`. The two constants disagree by one second and the integer one is dead code — a grep across `programs/` finds only its definition.

**Impact:**

Materially, none. The expression is a compile-time-constant `f64` with no user or state input; `ceil()` and `to_u128()` on it are deterministic across any IEEE-754 target, and `.unwrap()` cannot fail on a finite positive value. The resulting divisor differs from the integer twin by 1 part in 31.5 million — a relative fee error of 3.2 × 10⁻⁸, far below one base unit on any realistic AUM.

It is reported because KV-128 treats *any* float in an on-chain value path as a finding on principle, and the principle is sound here even though this instance is benign: the constant sits inside the fee formula, one refactor away from `seconds_passed` or `management_fee_bps` crossing the float boundary — at which point precision loss above 2⁵³ and lossy `f64 → u64` truncation become real. The dead integer twin makes it worse, not better: it signals that someone already started the migration and stopped halfway, leaving two constants that disagree.

Three further dead-code items found alongside it, listed here rather than as separate findings: `MAX_REWARDS_STALENESS_FOR_FEE_UPDATE` (`consts.rs:33`) and `KaminoVaultError::RewardsStaleForFeeUpdate` (`lib.rs:407-408`) are both defined and never used — they describe an intended "rewards must be fresh before a fee update" guard that is not implemented, although `handler_update_vault_config.rs:41` calls `refresh_rewards` before `charge_fees` and so satisfies the intent by other means; and `KaminoVaultResult` (`lib.rs:420`) is declared and never referenced.

**Proof of Concept:**

```text
1. management_fee_bps = 1000 (the maximum, consts.rs:17), seconds_passed = 86_400 (one day),
   prev_aum = 1_000_000_000_000 base units.

2. As implemented:
     divisor  = SECONDS_PER_YEAR.ceil() as u128 = 31_556_926
     mgmt_fee = 0.1 * 86_400 / 31_556_926       = 2.73790e-4
     charge   = 1_000_000_000_000 * 2.73790e-4  = 273_790_069 base units

3. With the dead integer constant that was evidently intended:
     divisor  = SECONDS_PER_YEAR_U64 = 31_556_925
     charge                           = 273_790_078 base units

4. Difference: 9 base units on a 1,000,000-token position over one day — 3.2e-8 relative.
   Neither figure is "wrong"; they simply disagree, and the one in use is not the one the
   codebase also defines.

5. The .unwrap() at vault_operations.rs:874 is unreachable-by-construction:
   f64::ceil() of a finite positive constant always converts. No user input reaches it.
```

**Recommendation:**

```rust
// consts.rs — one constant, integer, matching what the formula actually uses.
/// Mean tropical year in whole seconds (365.242199 d), rounded up — the divisor for
/// annualised management-fee accrual.
pub const SECONDS_PER_YEAR: u64 = 31_556_926;
// delete SECONDS_PER_YEAR_U64

// vault_operations.rs:873-874
let mgmt_fee = mgmt_fee_yearly * u128::from(seconds_passed) / u128::from(SECONDS_PER_YEAR);
```

This removes the only `f64` in the program, removes the `.unwrap()`, removes the contradiction, and leaves the fee arithmetic entirely in `Fraction` fixed-point and checked integers. Separately, delete `MAX_REWARDS_STALENESS_FOR_FEE_UPDATE`, `RewardsStaleForFeeUpdate` and `KaminoVaultResult`, or implement the staleness guard the first two describe — dead security-adjacent declarations are worse than silence, because they suggest a control that is not there.

---

#### [F-012] Privileged, crank, and fee-movement instructions emit no events

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | SM-047, SM-050 (primary) · SM-048 · OPS-048 · OPS-050 · OPS-061 · KV-030 step 5 |
| **Category** | Monitoring / Auditability |
| **Language** | Rust |
| **File** | `programs/kvault/src/events.rs:1-35`; `programs/kvault/src/lib.rs:32-218` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**

The program defines five event types (`events.rs:4-34`) and emits them from three instructions:

| Instruction | Events |
|---|---|
| `deposit` / `buy` (+`_with_min_shares_out`) | `DepositUserAtaBalanceEvent`, `DepositResultEvent` (`handler_deposit.rs:43-45`, `:59-63`) |
| `withdraw` / `sell` / `withdraw_from_available` | `SharesToWithdrawEvent`, `WithdrawResultEvent` (`handler_withdraw.rs:44-45`, `:57-58`) |
| `redeem_in_kind` | `SharesToWithdrawEvent`, `RedeemInKindResultEvent` (`handler_redeem_in_kind.rs:49-52`, `:75-78`) |

The remaining **16 instructions emit nothing structured**. Only `msg!` / `sol_log` strings are produced, which are free-form, truncation-prone, and not part of any ABI:

- `invest` / `invest_with_max_amount` — the crank that moves user liquidity into and out of KLend reserves, i.e. the largest fund-movement path in the program (`handler_invest.rs:29-184`);
- `withdraw_pending_fees` — the admin taking accrued fees out of the vault (`handler_withdraw_pending_fees.rs:21`);
- `give_up_pending_fees`, `topup_rewards`, `withdraw_rewards`;
- `update_vault_config` — every fee, penalty, cap, and admin-delegate change (`handler_update_vault_config.rs:14`);
- `update_admin`, `update_global_config`, `update_global_config_admin` — authority rotations on both the vault and the protocol;
- `add_update_whitelisted_reserve`, `update_reserve_allocation` (v1/v2), `remove_allocation`;
- `init_vault`, `init_global_config`, `initialize_shares_metadata`, `update_shares_metadata`.

Where events *are* emitted, they use `emit_cpi!` (`#[event_cpi]` on the accounts structs) rather than bare `emit!` — the self-CPI form, which is recorded as an inner instruction and cannot be forged by a third party. That is the correct choice and is why KV-122 passes. The gap is coverage, not integrity.

The emitted events are also thin: none carries the vault pubkey, the actor pubkey, or a timestamp (`events.rs:4-34`), so an indexer must join against the enclosing transaction to know which vault a `DepositResultEvent` belongs to.

**Impact:**

Compounding with F-005 (no pause) and F-002 (no timelock), this is the detection half of an incident-response gap: the actions most worth alerting on are precisely the ones that produce no machine-readable trace.

- **No alerting on privileged changes.** A fee raised to 100 %, a withdrawal penalty set to the 10 % maximum, an `allocation_admin` re-pointed, or a vault-admin handover completed all pass silently. Because those changes take effect immediately (F-002), the window between "admin acts" and "depositors could know" is bounded only by how quickly someone diffs account state.
- **No alerting on value movement.** `withdraw_pending_fees` moves real tokens from the vault to the admin and emits nothing structured. `invest` moves the bulk of vault liquidity across the KLend boundary and emits nothing structured.
- **Forensics are reconstruction, not reading.** Post-incident, the sequence of configuration changes must be rebuilt by replaying account snapshots rather than by reading a log — slow, and dependent on an archival node retaining the relevant slots.
- **KV-030 step 5** (mint events for anomaly detection) passes only on the deposit path.

No exploit follows from this directly, which is why it is 3. It raises the cost and latency of noticing every other finding in this report.

**Proof of Concept:**

```text
Scenario: a vault-admin key is compromised. The attacker's goal is to extract value slowly
enough that nobody notices before they finish.

1. Attacker calls update_vault_config(PerformanceFeeBps, 10000).
   Program output: three msg! lines —
     "Updating vault config field PerformanceFeeBps"
     "Prv value is 1000"
     "New value is 10000"                          [vault_config_operations.rs:99, :104-105]
   No event. An indexer subscribed to this program's emit_cpi stream sees NOTHING.
                                                   [handler_update_vault_config.rs:14-50]

2. Attacker waits for yield to accrue. Any depositor's next deposit or withdrawal triggers
   charge_fees, which sweeps 100 % of the interval's interest into pending_fees_sf.
                                                   [vault_operations.rs:889, :906-908]
   No event.

3. Attacker calls withdraw_pending_fees. Real tokens leave token_vault for the admin's ATA.
   Program output: one msg! line of effect amounts.  [handler_withdraw_pending_fees.rs:70-75]
   No event.                                        [handler_withdraw_pending_fees.rs:21-138]

4. Detection surface available to a defender:
   - emit_cpi event stream: silent for all three steps.
   - Log scraping: possible, but msg! strings are unversioned free text with no vault
     identifier, and are truncated under log-size pressure.
   - Account polling: works — but requires knowing to diff VaultState.performance_fee_bps
     across slots, at whatever interval the poller happens to use.

5. Contrast: had steps 1 and 3 emitted VaultConfigUpdatedEvent and PendingFeesWithdrawnEvent,
   a standing alert on "performance_fee_bps increased" or "fee withdrawal > threshold" fires
   in the same slot.
```

**Recommendation:**

```rust
// events.rs — add the structured events the privileged and crank paths are missing.
// Keep using emit_cpi! (add #[event_cpi] to the corresponding Accounts structs) so the
// records remain non-forgeable inner instructions.

#[event]
pub struct VaultConfigUpdatedEvent {
    pub vault: Pubkey,
    pub signer: Pubkey,
    pub field: u8,          // VaultConfigField discriminant
    pub previous_value: [u8; 32],
    pub new_value: [u8; 32],
    pub timestamp: u64,
}

#[event]
pub struct AdminRotatedEvent {      // update_admin + update_global_config_admin
    pub scope: u8,                  // 0 = vault, 1 = global config
    pub target: Pubkey,             // vault pubkey, or the global config PDA
    pub previous_admin: Pubkey,
    pub new_admin: Pubkey,
    pub timestamp: u64,
}

#[event]
pub struct InvestResultEvent {      // handler_invest.rs, after post_transfer_invest_checks
    pub vault: Pubkey,
    pub reserve: Pubkey,
    pub direction: u8,              // InvestingDirection
    pub liquidity_amount: u64,
    pub collateral_amount: u64,
    pub rounding_loss: u64,
    pub aum_before: u128,
    pub aum_after: u128,
}

#[event]
pub struct PendingFeesWithdrawnEvent {
    pub vault: Pubkey,
    pub admin: Pubkey,
    pub amount: u64,
    pub pending_fees_remaining: u128,
}

// Also: ReserveAllocationUpdatedEvent, ReserveAllocationRemovedEvent,
//       ReserveWhitelistUpdatedEvent, RewardsToppedUpEvent, RewardsWithdrawnEvent,
//       GiveUpPendingFeesEvent, VaultInitializedEvent.

// And enrich the three existing events with `vault: Pubkey`, `user: Pubkey` and
// `timestamp: u64` (events.rs:4-34) so an indexer can attribute them without joining
// against the enclosing transaction.

// Rule of thumb worth adopting: every instruction that mutates VaultState or GlobalConfig,
// or that moves tokens, emits exactly one structured result event. That is 22 of 22
// instructions; 16 are currently missing one.
```

---

#### [F-013] The performance fee has no high-water mark — losses reset the fee basis, so recovery is charged again

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | ECON-031 (primary) · AR-042 · ECON-026 |
| **Category** | Economic / Fee Accounting |
| **Language** | Rust |
| **File** | `programs/kvault/src/operations/vault_operations.rs:847-913` (specifically `:888-889`, `:906-910`) |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**

`charge_fees` derives the performance fee from the change in AUM since the previous call, and then unconditionally resets the basis to the current value:

```rust
// vault_operations.rs:888-889
let earned_interest = new_aum.saturating_sub(prev_aum);
let perf_charge = Fraction::from_bps(vault.performance_fee_bps) * earned_interest;
…
// vault_operations.rs:906-910
let new_fees = (mgmt_charge + perf_charge).min(new_aum);
let pending_fees = vault.get_pending_fees() + new_fees;
vault.set_pending_fees(pending_fees);
update_prev_aum(vault, new_aum - new_fees);          // basis := current AUM, always
vault.last_fee_charge_timestamp = timestamp;
```

`prev_aum` is a **rolling** mark, not a high-water mark. When AUM falls, `saturating_sub` correctly charges zero for that interval — but line 909 then writes the *lower* AUM as the new basis. The subsequent recovery back to the prior peak is therefore counted as fresh "earned interest" and charged again.

`charge_fees` is invoked on every deposit, withdrawal, redeem, invest, fee withdrawal, fee give-up, and config update (`vault_operations.rs:78`, `:162`, `:384`, `:458`, `:561`; `handler_update_vault_config.rs:45`), so the basis is reset at whatever cadence the vault is used — the more active the vault, the finer the ratchet.

**Impact:**

Depositors pay a performance fee on the same gains more than once whenever AUM oscillates. For a lending vault whose AUM is driven by KLend interest accrual this is mostly monotonic in normal conditions, which bounds the everyday exposure — but AUM does fall here, through at least three ordinary mechanisms: a KLend reserve exchange-rate correction, a socialised loss, and the management fee itself (which reduces `new_aum − new_fees` every interval).

The overcharge is bounded by `performance_fee_bps` × (sum of all recovered drawdowns). With `performance_fee_bps` capped only at 100 % (F-002), a vault that oscillates ±1 % ten times over a year and sets a 20 % performance fee charges roughly 2 % of AUM in fees against zero net return. The value transfers from depositors to the vault admin, who withdraws it via `withdraw_pending_fees`.

This is a fee-design defect rather than an exploit: it requires no attacker, harms depositors continuously and silently, and is invisible on-chain because no event records fee accrual (F-012). Severity 4 reflects real, recurring, quantifiable value transfer with no privilege required to trigger it — but it is not theft, the magnitude is second-order relative to the headline fee, and high-water marks are a convention rather than a universal requirement, so a protocol may have chosen this deliberately. Nothing in the repository says either way.

A related, smaller asymmetry sits in the same code path (AR-042): withdrawal penalties stay in the vault and therefore raise `new_aum`, so they are themselves counted as `earned_interest` and taxed by the performance fee at the next `charge_fees` — a fee charged on a fee.

**Proof of Concept:**

```text
Vault: performance_fee_bps = 2000 (20 %), management_fee_bps = 0 (isolating the effect).
Start: aum = 1_000_000, prev_aum = 1_000_000.

Interval 1 — gain to 1_100_000. Any user action triggers charge_fees:
  earned_interest = 1_100_000 - 1_000_000 = 100_000       [vault_operations.rs:888]
  perf_charge     = 0.20 * 100_000        =  20_000       [vault_operations.rs:889]
  pending_fees   += 20_000                                [vault_operations.rs:907-908]
  prev_aum       := 1_100_000 - 20_000    = 1_080_000     [vault_operations.rs:909]
  Correct: 20 % of a real 100_000 gain.

Interval 2 — loss back to 1_000_000 (KLend rate correction):
  earned_interest = saturating_sub(1_000_000, 1_080_000) = 0   -> no charge. Correct.
  prev_aum       := 1_000_000 - 0 = 1_000_000             [vault_operations.rs:909]
  <-- HERE. The basis is marked DOWN to the trough. A high-water mark would hold 1_080_000.

Interval 3 — recovery to 1_100_000. Same dollars as interval 1, no new economic gain:
  earned_interest = 1_100_000 - 1_000_000 = 100_000
  perf_charge     = 0.20 * 100_000        =  20_000       <-- CHARGED A SECOND TIME
  pending_fees    = 40_000 total

Net after three intervals:
  True economic gain to depositors, peak to peak: 100_000
  Performance fees charged:                        40_000  (40 % of the real gain)
  Effective fee rate:                              2x the stated 20 %

With a high-water mark, interval 3 charges 0.20 * (1_100_000 - 1_080_000) = 4_000, for a
correct 24_000 total. The overcharge is 16_000 — 1.6 % of AUM — from ONE oscillation.
Each further round trip repeats it.
```

**Recommendation:**

```rust
// Add a persistent high-water mark to VaultState (padding_3: [u128; 232] has ample room):
pub aum_high_water_mark_sf: u128,

impl VaultState {
    pub fn get_aum_high_water_mark(&self) -> Fraction {
        Fraction::from_bits(self.aum_high_water_mark_sf)
    }
    pub fn set_aum_high_water_mark(&mut self, hwm: Fraction) {
        self.aum_high_water_mark_sf = hwm.to_bits();
    }
}

// vault_operations.rs:888-910 — charge only above the mark, and ratchet it up only.
let high_water_mark = vault.get_aum_high_water_mark();
let perf_basis = high_water_mark.max(prev_aum);
let earned_interest_above_hwm = new_aum.saturating_sub(perf_basis);
let perf_charge = Fraction::from_bps(vault.performance_fee_bps) * earned_interest_above_hwm;

// Keep cumulative_earned_interest tracking gross interval interest for analytics — it is a
// different quantity from the fee basis and today the two are conflated:
let gross_interval_interest = new_aum.saturating_sub(prev_aum);
vault.set_cumulative_earned_interest(
    vault.get_cumulative_earned_interest().saturating_add(gross_interval_interest),
);

let new_fees = (mgmt_charge + perf_charge).min(new_aum);
vault.set_pending_fees(vault.get_pending_fees() + new_fees);
let aum_after_fees = new_aum - new_fees;
update_prev_aum(vault, aum_after_fees);
// Ratchet: never mark down.
vault.set_aum_high_water_mark(high_water_mark.max(aum_after_fees));

// Migration note: aum_high_water_mark_sf reads as 0 on every existing vault, so the first
// charge_fees after the upgrade uses perf_basis = prev_aum — identical to today's behaviour —
// and the mark begins ratcheting from that point. No backfill is required.

// Per-share variant: if the protocol wants the mark to survive large deposits and withdrawals
// without dilution artefacts, track high_water_mark as AUM-per-share
// (aum / shares_issued) rather than absolute AUM. That is the stricter and more conventional
// construction; absolute AUM is simpler and adequate if deposits are frequent.

// Separately (AR-042): exclude withdrawal penalties from earned_interest so a fee is not
// charged on a fee. Accumulate penalties into a dedicated field at
// vault_operations.rs:346-348 and subtract it from new_aum before computing earned_interest.
```

---

#### [F-014] Nine admin-settable numeric parameters have no upper bound, and two of them reach unchecked arithmetic

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | OPS-082, OPS-083 (primary) · AR-003 · ECON-074 · AC-023 |
| **Category** | Configuration Bounds / Governance |
| **Language** | Rust |
| **File** | `programs/kvault/src/operations/vault_config_operations.rs:122-273`; `programs/kvault/src/handlers/handler_update_reserve_allocation.rs:101-108`; `programs/kvault/src/state/vault_state.rs:335-407` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**

`update_vault_config` validates four of its twenty-one fields. The rest are deserialised and assigned with no range check at all:

| Field | Bound | Site |
|---|---|---|
| `performance_fee_bps` | ≤ 10000 (100 % — see F-002) | `vault_config_operations.rs:106-110` |
| `management_fee_bps` | ≤ 1000 | `:114-116` |
| `min_withdraw_amount` | ≤ 1000 | `:130-133` |
| `withdrawal_penalty_lamports` | ≤ 10000 | `:220-224` |
| `withdrawal_penalty_bps` | ≤ 1000 | `:231-235` |
| **`min_deposit_amount`** | **none** | `:122-127` |
| **`min_invest_amount`** | **none** | `:139-145` |
| **`min_invest_delay_slots`** | **none** | `:146-152` |
| **`crank_fund_fee_per_reserve`** | **none** | `:153-159` |
| **`unallocated_weight`** | **none** | `:206-211` |
| **`unallocated_tokens_cap`** | **none** | `:212-217` |
| **`deposit_cap`** | **none** | `:268-273` |
| **`reward_per_second`** | **none** | `:258-267` |
| **`target_allocation_weight`** | **none** | `handler_update_reserve_allocation.rs:101-108` |

Two of the unbounded values flow into arithmetic that is not checked:

```rust
// state/vault_state.rs:337-342 — plain .sum::<u64>() over up to 25 admin-set weights
let total_weight = self.vault_allocation_strategy.iter()
    .filter(|r| r.reserve != Pubkey::default() && r.token_allocation_cap > 0)
    .map(|r| r.target_allocation_weight)
    .sum::<u64>();

// state/vault_state.rs:355-358 — plain + on two admin-set u64s
let unallocated_target = total_tokens.mul_int_ratio(
    self.unallocated_weight, total_weight + self.unallocated_weight);

// vault_operations.rs:578 — plain + on an admin-set u64 and a stored slot
if current_slot < allocation_for_reserve.last_invest_slot + vault.min_invest_delay_slots {
```

With `overflow-checks = true` (`Cargo.toml:6`) each of these aborts rather than wraps. Aborting is the safe direction — but `refresh_target_allocations` is called from `invest` (`vault_operations.rs:563`), so a weight configuration that overflows the sum makes the rebalance crank panic on every call.

Several unbounded values are also individually load-bearing: `min_deposit_amount = u64::MAX` blocks every deposit (`vault_operations.rs:108-114`); `min_invest_amount = u64::MAX` blocks every non-evacuation invest (`:635-637`); `min_invest_delay_slots` near `u64::MAX` makes `last_invest_slot + delay` overflow and panic.

The interdependency check is missing too (OPS-083): `unallocated_weight` and the per-reserve `target_allocation_weight`s together determine the allocation split (`state/vault_state.rs:348-407`), and `deposit_cap` interacts with `min_deposit_amount` (a cap below the minimum makes every deposit fail `DepositAmountBelowMinimum` → `VaultDepositCapReached`), but each is written in isolation with no validation of the resulting configuration as a whole.

**Impact:**

Every consequence requires the vault-admin or allocation-admin role, so this is bounded by the trust model in intake §6 — the finding is that the code does not enforce the bounds that model assumes. Concretely:

- **Deposit lockout.** `min_deposit_amount = u64::MAX` — one transaction, instantly reversible by the same admin, no deposit possible in between.
- **Crank lockout.** `min_invest_amount = u64::MAX`, or weights summing past `u64::MAX`, makes `invest` revert or panic. Because `invest` is the only path that moves liquidity into and out of KLend, the vault's allocation freezes; withdrawals still work from `token_available` and from the target reserve, so funds are not trapped, but the vault stops functioning as a yield product.
- **Principal destruction.** `crank_fund_fee_per_reserve` — this is F-001, whose severity is driven by the missing withdrawal path rather than by the missing bound.
- **Accidental misconfiguration.** These are not exotic adversarial values. A units error on `min_deposit_amount` (treating a 6-decimal token as 9-decimal) or a weight entered as basis points on a `u64` scale reaches the same outcomes with no malice.

Severity 4: privilege-gated (Rule 1 caps it), fully reversible in every case except F-001's stranded funds, but it converts operator mistakes into user-visible outages and gives a compromised admin key several immediate levers.

**Proof of Concept:**

```text
Case A — deposit lockout, one transaction, no recovery path for users:

  1. update_vault_config(MinDepositAmount, u64::MAX.to_le_bytes())
     No require!, no cap.                              [vault_config_operations.rs:122-127]
  2. Alice calls deposit(1_000_000).
     user_tokens_to_deposit (1_000_000) < min_deposit_amount (u64::MAX)
     -> err!(DepositAmountBelowMinimum)                [vault_operations.rs:108-113]
  3. Every deposit in the vault fails until the admin reverts it. Withdrawals still work.

Case B — crank panic via weight overflow:

  1. update_reserve_allocation_v2(R1, weight = u64::MAX,     cap = u64::MAX, ctoken_cap = 0)
     update_reserve_allocation_v2(R2, weight = u64::MAX - 1, cap = u64::MAX, ctoken_cap = 0)
     Neither call bounds `weight`.                     [handler_update_reserve_allocation.rs:101-108]
  2. Anyone calls invest -> vault.refresh_target_allocations(invested)
                                                       [vault_operations.rs:563]
  3. total_weight = [u64::MAX, u64::MAX - 1].sum::<u64>()
     -> overflow -> panic (overflow-checks = true)     [state/vault_state.rs:337-342]
  4. invest reverts with "SBF program panicked" on every call. Rebalancing is dead until the
     admin lowers a weight. Deposits and withdrawals continue to work.

Case C — companion overflow on the invest cooldown:

  1. update_vault_config(MinInvestDelaySlots, (u64::MAX - 10).to_le_bytes())
                                                       [vault_config_operations.rs:146-152]
  2. invest -> allocation_for_reserve.last_invest_slot + vault.min_invest_delay_slots
     -> overflow -> panic                              [vault_operations.rs:578]
     Same outcome as Case B, reached through a different field.
```

**Recommendation:**

```rust
// 1. Give every numeric setter a bound the downstream math can actually consume.
//    consts.rs:
pub const MAX_CRANK_FUND_FEE_PER_RESERVE: u64 = 100;
pub const MAX_MIN_DEPOSIT_AMOUNT: u64        = 1_000_000_000;   // 1000 units @ 6 decimals
pub const MAX_MIN_INVEST_AMOUNT: u64         = 1_000_000_000;
pub const MAX_MIN_INVEST_DELAY_SLOTS: u64    = 216_000;         // ~24h at 2.5 slots/s
pub const MAX_ALLOCATION_WEIGHT: u64         = 1_000_000;       // x25 reserves cannot overflow u64
pub const MAX_UNALLOCATED_WEIGHT: u64        = MAX_ALLOCATION_WEIGHT;
pub const MAX_REWARD_PER_SECOND: u64         = 1_000_000_000;

//    vault_config_operations.rs — one require_gte! per field, matching the shape already
//    used for MinWithdrawAmount at :130-133:
VaultConfigField::MinDepositAmount => {
    let v: u64 = BorshDeserialize::try_from_slice(data)?;
    require_gte!(MAX_MIN_DEPOSIT_AMOUNT, v, KaminoVaultError::MinDepositAmountTooBig);
    vault.min_deposit_amount = v;
}
// … and equivalently for MinInvestAmount, MinInvestDelaySlots, CrankFundFeePerReserve,
//     UnallocatedWeight, RewardPerSecond.

//    handler_update_reserve_allocation.rs, before upsert_reserve_allocation at :101:
require_gte!(MAX_ALLOCATION_WEIGHT, target_allocation_weight,
             KaminoVaultError::AllocationWeightTooBig);

// 2. Make the arithmetic checked regardless, so a bound regression cannot panic the crank.
//    state/vault_state.rs:337-342:
let total_weight = self.vault_allocation_strategy.iter()
    .filter(|r| r.reserve != Pubkey::default() && r.token_allocation_cap > 0)
    .try_fold(0u64, |acc, r| acc.checked_add(r.target_allocation_weight))
    .ok_or(error!(KaminoVaultError::MathOverflow))?;

//    state/vault_state.rs:355-358:
let weight_denominator = total_weight
    .checked_add(self.unallocated_weight)
    .ok_or(error!(KaminoVaultError::MathOverflow))?;

//    vault_operations.rs:578:
let next_allowed_slot = allocation_for_reserve.last_invest_slot
    .saturating_add(vault.min_invest_delay_slots);
if current_slot < next_allowed_slot { return err!(KaminoVaultError::InvestTooSoon); }

// 3. Cross-validate the resulting configuration, not just the incoming field (OPS-083).
//    After each write in update_vault_config, run one shared validator:
fn validate_vault_config_consistency(vault: &VaultState) -> Result<()> {
    // A deposit cap below the deposit minimum makes every deposit unsatisfiable.
    if vault.deposit_cap > 0 {
        require_gte!(vault.deposit_cap, vault.min_deposit_amount,
                     KaminoVaultError::InconsistentVaultConfig);
    }
    // Weights must sum within range with the unallocated share included.
    let total: u64 = vault.vault_allocation_strategy.iter()
        .filter(|r| r.reserve != Pubkey::default())
        .try_fold(0u64, |acc, r| acc.checked_add(r.target_allocation_weight))
        .ok_or(error!(KaminoVaultError::MathOverflow))?;
    total.checked_add(vault.unallocated_weight)
         .ok_or(error!(KaminoVaultError::MathOverflow))?;
    Ok(())
}
```

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
- **F-001** — Crank-fund fee is charged on every deposit, sits outside AUM, and has no withdrawal path
- **F-002** — Fee/penalty parameters change instantly with no timelock; performance fee may reach 100 %; no withdrawal minimum-out
- **F-003** — Mandatory full-allocation-set reserve refresh on every user path → admin-controlled exit cost `[UNDETERMINED]`

#### Severity 4 — 🔵 LOW
- **F-004** — `kamino_lending` and two other git dependencies are not pinned to a revision
- **F-005** — No pause, circuit breaker, or aggregate-outflow limit
- **F-006** — Token-2022 base mints accepted with no extension screening
- **F-007** — `CpiMemoryLender` raw syscall skips `invoke_signed`'s account-borrow checks
- **F-013** — Performance fee has no high-water mark
- **F-014** — Nine admin-settable numerics unbounded; two reach unchecked arithmetic

> Severity 3 and 2 findings (F-008, F-009, F-010, F-011, F-012) carry full blocks above and are listed in the Remediation Roadmap (§9).

---

### Notes & Nitpicks

Observations with no security impact — not scored on the 1–10 scale, no remediation obligation.

- `programs/kvault/src/operations/vault_operations.rs:328-332` — the `is_allocated_to_reserve` guard in `withdraw` is unreachable: `holdings.invested.in_reserve(reserve_address)` at `:237` already panics via `.unwrap()` (`:1710-1716`) if the reserve is absent, and `handler_withdraw.rs:232-233` has validated it through `allocation_for_reserve` before that. Dead check; the panic path is unreachable in practice for the same reason.
- `programs/kvault/src/operations/vault_operations.rs:1400-1404` — the `shares_issued == shares_to_withdraw` fast path is unreachable while the 1,000 dead shares exist (F-010), since no holder can own the full `shares_issued`.
- `programs/kvault/src/handlers/handler_withdraw.rs:93-94`, `:98` — `lending_market`, `lending_market_authority` and `reserve_collateral_mint` are raw `AccountInfo` with **no `/// CHECK:` doc comment**, unlike every other unchecked account in the program (cf. `handler_invest.rs:228-237`). `Anchor.toml:3` sets `skip-lint = false`, so `anchor build` should flag these.
- `programs/kvault/src/handlers/handler_withdraw.rs:66-74` — `Withdraw` is a composite containing `WithdrawFromAvailable`, which itself carries `#[event_cpi]`; the outer struct carries another. Callers must supply two `event_authority` / `program` pairs.
- `programs/kvault/src/operations/vault_operations.rs:1048` — `FatAccountLoader::try_from(account_info).unwrap()` panics rather than returning `CouldNotDeserializeAccountAsReserve` when a caller passes a non-reserve account. Same pattern at `handler_init_vault.rs:40`.
- `programs/kvault/src/utils/fraction_utils.rs:17-19` — `.expect("Result doesn't fit in a Fraction.")` on the `U256 → u128` narrowing in `full_mul_fraction_ratio_ceil`. Bounded in practice: callers guarantee `total_vault_aum > 0` (`vault_operations.rs:167-170`) and `amount_to_send ≥ 1`, keeping the quotient under 2¹²⁴.
- `programs/kvault/src/handlers/handler_redeem_in_kind.rs` + `vault_operations.rs:833-837` — a narrow rounding edge where `actual_liquidity_value_f` could exceed `current_vault_aum` by one ULP (100 % redemption, zero penalty, `token_available == pending_fees`), underflowing the `Fraction` subtraction into a panic. Not confirmed: it depends on the exact rounding semantics of KLend's `fraction_collateral_to_liquidity_ceil`, which is an unvendored git dependency.
- `programs/kvault/src/utils/consts.rs:20` (`SECONDS_PER_YEAR_U64`), `:33` (`MAX_REWARDS_STALENESS_FOR_FEE_UPDATE`), `lib.rs:407-408` (`RewardsStaleForFeeUpdate`), `lib.rs:420` (`KaminoVaultResult`) — declared, never referenced. See F-011.
- `programs/kvault/src/lib.rs:1` — `#![allow(clippy::result_large_err)]` is a crate-wide suppression with no justification comment (FV-021).
- `programs/kvault/src/state/vault_state.rs:156-176`, `state/reserve_whitelist_entry.rs:26-46` — `panic!` on out-of-range bool-like values. Unreachable: both writers validate `value ≤ 1` (`vault_config_operations.rs:47-61`, `reserve_whitelist_operations.rs:14-20`).
- `programs/kvault/src/handlers/handler_update_reserve_allocation.rs:126-143` — when an allocation is removed (`remove_allocation`), its `ctoken_vault` token account is not closed; the rent stays locked and the account lingers.
- `programs/kvault/src/handlers/handler_topup_rewards.rs:56-80` — `TopupRewards` omits `has_one = token_program` (present on every other context). Harmless: `token_vault` is an `InterfaceAccount`, so a mismatched program fails the CPI.
- `.gitignore` (7 lines) lacks `.env`, `.env.*`, `*.pem`, `*keypair*.json`, `id.json`. No secret material is present or has ever been committed, but the defence-in-depth patterns are missing (KV-001 step 7).
- `Anchor.toml:10` — `wallet = "/wallet.json"`, an absolute path outside the repository. Not a leak; worth noting as an unusual default.
- `programs/kvault/src/handlers/handler_initialize_shares_metadata.rs:15-26` — shares metadata is created with `is_mutable: true` (`utils/metadata.rs:60`), so the vault admin can rename the share token at any time. Reasonable for a vault; relevant to any UI that trusts the on-chain symbol.
- `programs/kvault/src/handlers/handler_initialize_global_config.rs:14-19` — `global_admin` is snapshotted from the program's upgrade authority once at init and never re-read. Rotating the program's upgrade authority does **not** rotate `global_admin`; that requires the separate two-step `update_global_config_admin` handshake.

---

## 5. Detailed Item Results

> Every in-scope checklist item, in checklist order, with an explicit verdict. `[UNKNOWN]` marks items whose evidence lives in a build artifact, a live-chain query, or an organisational process — none of which is reachable from a static, read-only review (Rule 10).

### Checklist 01 — Account Validation (AV-001 … AV-090)

```
[PASS]      AV-001: All deserialized accounts are typed — AccountLoader<VaultState/GlobalConfig/Reserve>,
                    Account<ReserveWhitelistEntry>, InterfaceAccount<TokenAccount/Mint>; owner checked by Anchor.
[PARTIAL]   AV-002: 14 fields use raw AccountInfo<'info> rather than UncheckedAccount<'info>.
              File: handler_withdraw.rs:93-104, handler_invest.rs:229-237, handler_withdraw_pending_fees.rs:173-196
              Impact: Anchor 0.29 permits it; the 1.0 idiom (UncheckedAccount) is self-documenting.
              Fix: migrate raw AccountInfo fields to UncheckedAccount<'info>.
[PARTIAL]   AV-003: 3 raw AccountInfo fields carry no `/// CHECK:` doc comment.
              File: handler_withdraw.rs:93 (lending_market), :94 (lending_market_authority), :98 (reserve_collateral_mint)
              Impact: Anchor.toml sets skip-lint=false, so `anchor build` should reject these.
              Fix: add `/// CHECK: validated by klend on the RedeemReserveCollateral CPI`.
[PASS]      AV-004: Every `/// CHECK:` maps to a real control — has_one on vault_state, or klend-side CPI validation.
[PASS]      AV-005: Account<T>/AccountLoader<T> types match the structs they name throughout.
[PARTIAL]   AV-006: reserve_liquidity_supply is raw AccountInfo in Invest, read via accessor::amount (no owner check).
              File: handler_invest.rs:234, read at :59 and :163
              Impact: none today — the klend CPI validates it whenever liquidity_amount > 0.
              Fix: type it Box<InterfaceAccount<'info, TokenAccount>> as WithdrawFromInvested already does (handler_withdraw.rs:96).
[PARTIAL]   AV-007: reserve_collateral_mint is raw AccountInfo in Invest/Withdraw/WithdrawPendingFees.
              File: handler_invest.rs:237, handler_withdraw.rs:98, handler_withdraw_pending_fees.rs:196
              Impact: validated klend-side only. UpdateReserveAllocation does it correctly (`address = reserve.load()?.collateral.mint_pubkey`).
              Fix: apply the same `address =` constraint in the other three contexts.
[PASS]      AV-008: system_program/rent/token_program typed Program<System>/Sysvar<Rent>/Interface<TokenInterface>.
[PASS]      AV-009: AccountLoader<'info, Reserve> — Reserve declares klend as owner; Anchor enforces it.
[PASS]      AV-010: declare_id!(KVAULT_PROGRAM_ID) (lib.rs:18) == program_id.rs:17 == Anchor.toml:6.
[PASS]      AV-011: All 5 account types use #[account]/#[account(zero_copy)] — 8-byte discriminator automatic.
[PASS]      AV-012: VaultState/GlobalConfig/ReserveWhitelistEntry have distinct discriminators and layouts.
[PASS]      AV-013: remaining_accounts deserialize via FatAccountLoader::try_from — checked owner + discriminator.
              File: vault_operations.rs:1048
[PASS]      AV-014: Beyond the discriminator, each reserve's pubkey is compared to vault_allocation_strategy[i].reserve.
              File: vault_operations.rs:1067
[PASS]      AV-015: No discriminator collision — distinct struct names produce distinct 8-byte prefixes.
[PASS]      AV-016: No manual Borsh serialization of account state anywhere.
[N/A]       AV-017: No versioned account migration exists in this program.
[PASS]      AV-018: Every mutated account carries #[account(mut)] — verified per handler.
[PARTIAL]   AV-019: base_vault_authority (data-less PDA) and token_mint are marked mut though never mutated.
              File: handler_invest.rs:213, handler_withdraw_pending_fees.rs:172, handler_withdraw.rs:144
              Impact: unnecessary write locks widen transaction contention (see KV-131).
              Fix: drop `mut` where the account is not written.
[PASS]      AV-020: has_one binds base_vault_authority/token_vault/token_mint/token_program/shares_mint/admin on every context.
[PARTIAL]   AV-021: has_one is the sole check on most links; only ctoken_vault gets a runtime require_keys_eq! backup.
              File: handler_withdraw.rs:234-237, handler_withdraw_pending_fees.rs:48-51
              Impact: defense-in-depth gap — single point of failure per link.
              Fix: add require_keys_eq! after load for the highest-value links (token_vault, shares_mint).
[PASS]      AV-022: init constraints supply payer + seeds + bump; space via static_assertions-checked constants.
[PARTIAL]   AV-023: init_if_needed used twice — both admin-gated.
              File: handler_update_reserve_allocation.rs:135 (ctoken_vault), handler_add_update_whitelisted_reserve.rs:50
              Impact: reinit is blocked by Anchor's constraint revalidation, not by an explicit flag.
              Fix: acceptable; document why init_if_needed is required.
[PARTIAL]   AV-024: The reinit guard is Anchor's mint/authority/token_program/seeds revalidation, not a version flag.
              File: handler_update_reserve_allocation.rs:135-143
              Impact: correct today; relies on constraint coverage staying complete.
              Fix: add an explicit `initialized` discriminator check on the whitelist entry.
[N/A]       AV-025: No `close =` constraint anywhere in the program.
[N/A]       AV-026: No account-close path exists.
[PASS]      AV-027: Every PDA seed set includes its parent — [b"token_vault", vault], [b"ctoken_vault", vault, reserve],
                    [b"authority", vault], [b"shares", vault], [b"whitelisted_reserves", reserve].
[PARTIAL]   AV-028: base_vault_authority_bump is stored and reused for signing; constraint bumps are re-derived.
              File: token_ops.rs:20-24 (reuse) vs handler_withdraw.rs:88, handler_invest.rs:219 (bare `bump`)
              Impact: ctoken_vault_bump is stored in VaultAllocation (state/vault_allocation.rs:24) but never consumed.
              Fix: use `bump = vault.allocation_for_reserve(&reserve.key())?.ctoken_vault_bump as u8`.
[PARTIAL]   AV-029: One custom constraint has no typed error, defaulting to ConstraintRaw.
              File: handler_update_metadata.rs:44-46
              Impact: opaque failure for callers.
              Fix: add `@ KaminoVaultError::SharesMintIncorrect`.
[N/A]       AV-030: No realloc anywhere.
[N/A]       AV-031: Anchor 0.29 has no `dup` opt-in; duplicate-account risk is covered by AV-038.
[PASS]      AV-032: remaining_accounts are validated before use by check_allocation_reserve_accounts_match.
              File: vault_operations.rs:1027, :1051-1073
[PASS]      AV-033: Owner is checked — the checked try_from pass runs before the try_from_unchecked read.
              File: vault_operations.rs:1027 then klend_operations.rs:81
[N/A]       AV-034: remaining_accounts are klend reserves, never token accounts.
[PASS]      AV-035: Each address is compared against the vault's own allocation table — stronger than re-derivation.
              File: vault_operations.rs:1067
[PASS]      AV-036: Count validated; a short list errors ReserveNotProvidedInTheAccounts.
              File: vault_operations.rs:1063-1065, klend_operations.rs:91-93
[PASS]      AV-037: The only remaining-account CPI is the klend batch refresh, built from checked loaders.
[PARTIAL]   AV-038: Nothing prevents a remaining account from aliasing a named account.
              File: vault_operations.rs:1045-1049
              Impact: bounded — the pubkey-equality check pins each slot to a specific reserve.
              Fix: assert remaining_accounts are disjoint from the named set.
[N/A]       AV-039: No investor-position accounts — shares are bearer SPL tokens.
[PASS]      AV-040: Sizes are compile-time asserted — VAULT_STATE_SIZE, GLOBAL_CONFIG_SIZE, RESERVE_WHITELIST_ENTRY_SIZE.
              File: state/vault_state.rs:14-15, state/global_config.rs:12-13, state/reserve_whitelist_entry.rs:5-9
[PASS]      AV-041: Anchor init/zero enforce rent exemption.
[N/A]       AV-042: No Vec/String in account state; `name: [u8; 40]` is fixed and truncated at vault_operations.rs:1728-1737.
[N/A]       AV-043: No realloc.
[N/A]       AV-044: No size-reduction path.
[PASS]      AV-045: token::mint on every user-facing token account; vault accounts bound by has_one.
[PARTIAL]   AV-046: withdraw_token_account has token::mint but no token::authority.
              File: handler_withdraw_rewards.rs:84-88
              Impact: the admin may send rewards to any token account of the right mint. Within the admin trust model.
              Fix: add token::authority = vault_admin_authority for symmetry with handler_withdraw_pending_fees.rs:178.
[PASS]      AV-047: token_vault is a PDA created with token::authority = base_vault_authority.
              File: handler_init_vault.rs:90-98
[N/A]       AV-048: The program deliberately does not require canonical ATAs — any mint+authority-correct account is accepted.
[FAIL-3]    AV-049: Token-account delegate fields are never inspected before the vault relies on them.
              File: handler_deposit.rs:136, handler_withdraw.rs:130
              Impact: a delegate on token_vault could move funds outside program control. See F-006.
              Fix: assert token_vault.delegate.is_none() at init and on the withdrawal path.
[FAIL-4]    AV-050: Frozen state is never checked on token_vault or the base mint. See F-006.
              File: handler_init_vault.rs:101-104
              Impact: a frozen vault account blocks every withdrawal with no recovery path.
              Fix: reject mints with a non-None freeze authority, or record the risk on-chain.
[N/A]       AV-051: No WSOL-specific wrap/unwrap handling.
[PASS]      AV-052: token_program bound via has_one; the shares mint is pinned to classic Token (Program<'info, Token>).
[PASS]      AV-053: init / #[account(zero)] + load_init prevent re-initialization.
              File: handler_init_vault.rs:18, :83-84
[N/A]       AV-054: No manual initialization path.
[N/A]       AV-055: No close path, so no seed reuse after closure.
[N/A]       AV-056: No close path — revival is not reachable.
[N/A]       AV-057: No mid-transaction close.
[PASS]      AV-058: Token program identified per account — Interface<TokenInterface> for the base asset,
                    Program<Token> for shares and cTokens; has_one = token_program binds the base.
[N/A]       AV-059: No ATA assumption is made anywhere (see AV-048).
[PARTIAL]   AV-060: transfer_checked used for all asset movement; shares use unchecked mint_to/burn.
              File: token_ops.rs:26-37 (mint_to), :49-59 (burn) vs :100-113, :124-137 (transfer_checked)
              Impact: minimal — the shares mint is program-created and pinned to classic Token.
              Fix: migrate to mint_to_checked / burn_checked with shares_mint_decimals.
[PASS]      AV-061: Decimals are read from the mint (handler_deposit.rs:78) or from vault.token_mint_decimals,
                    captured at init from the real mint (handler_init_vault.rs:32).
[PARTIAL]   AV-062: Credited amounts are the declared amount with an exact-equality post-check, not a balance delta.
              File: handler_deposit.rs:112-115
              Impact: fee-on-transfer mints revert rather than mis-credit — fail-closed, but deposits break. See F-006.
              Fix: credit `after - before` with checked_sub to support transfer-fee mints.
[FAIL-4]    AV-063: Token-2022 mint extensions are never inspected. See F-006.
              File: handler_init_vault.rs:101-104
              Impact: PermanentDelegate/DefaultAccountState::Frozen/TransferHook/MintCloseAuthority all pass unchecked.
              Fix: screen extensions at init_vault per F-006.
[FAIL-4]    AV-064: Custodied balances are exposed to clawback/freeze by an untrusted mint authority. See F-006.
              File: handler_init_vault.rs:101-104
              Impact: a permanent delegate drains token_vault without touching this program.
              Fix: reject PermanentDelegate; reject or record a non-None freeze authority.
[FAIL-4]    AV-065: freeze_authority / mint_authority status is not considered for accepted tokens. See F-006.
              File: handler_init_vault.rs:101-104
              Impact: frozen accounts deadlock withdrawals permanently.
              Fix: as F-006.
[FAIL-4]    AV-066: No mint allowlist and no per-mint vetting. See F-006.
              File: handler_init_vault.rs:78-126
              Impact: init_vault is permissionless, so any mint can back a vault.
              Fix: allowlist, or extension screening, or both.
[FAIL-3]    AV-067: close_authority / delegate on vault token accounts are never validated.
              File: handler_init_vault.rs:90-98
              Impact: token_vault is program-created so both are None at creation, but nothing re-asserts it later.
              Fix: assert delegate.is_none() && close_authority.is_none() on the withdrawal path.
[PASS]      AV-068: Clock::get() everywhere — 12 sites; no Clock is ever read from a passed account.
[PASS]      AV-069: The Instructions sysvar is pinned by `address = sysvar::instructions::ID`.
              File: handler_withdraw.rs:103, handler_invest.rs:250, handler_withdraw_pending_fees.rs:203
[PASS]      AV-070: The only time-gated logic (min_invest_delay_slots, charge_fees, refresh_rewards) reads Clock::get().
[N/A]       AV-071: No precompile signature verification.
[N/A]       AV-072: No introspection-based signature checks.
[N/A]       AV-073: No introspected signed messages.
[N/A]       AV-074: No instruction-index introspection — the sysvar is only forwarded to klend.
[PASS]      AV-075: Every privileged account is bound by has_one / seeds / address / explicit key comparison —
                    never by transaction position.
[PARTIAL]   AV-076: Canonical bumps only, but stored bumps are not reused in account constraints. See AV-028.
              File: state/vault_allocation.rs:24, handler_invest.rs:219
              Impact: CU waste; no correctness risk (Anchor's bare `bump` is canonical).
              Fix: consume the stored ctoken_vault_bump.
[N/A]       AV-077: Anchor program — framework guarantees apply.
[N/A]       AV-078: Anchor Account<T>/AccountLoader<T> check owner automatically.
[N/A]       AV-079: Anchor Signer<'info> and #[account(mut)] enforce signer/writable.
[N/A]       AV-080: Anchor validates account counts and zero-copy lengths.
[N/A]       AV-081: The single unsafe block is a CPI syscall, not a slice read — covered by AV-088 / F-007.
[N/A]       AV-082: Anchor 8-byte discriminators disambiguate every type.
[N/A]       AV-083: Pinocchio not used.
[N/A]       AV-084: No reimplemented SPL Token logic.
[PASS]      AV-085: No instruction assumes an exact lamport balance; the program never reads .lamports().
[PASS]      AV-086: No builtin/sysvar/precompile account is marked mut.
[PASS]      AV-087: No permissionless plain `init` on an attacker-derivable address — token_vault/shares_mint seed from a
                    caller-supplied new vault_state, and the global_config PDA can only be created by this program.
              File: handler_init_vault.rs:90-113, handler_initialize_global_config.rs:34-41
[PARTIAL]   AV-088: Zero-copy reads are length-checked by Anchor; the CPI syscall path uses raw pointer casts.
              File: utils/cpi_mem.rs:136-174
              Impact: see F-007 — the account-borrow consistency check is skipped.
              Fix: restore the pre-flight borrow check; document the invariant.
[N/A]       AV-089: No ComputeBudgetProgram introspection anywhere.
[N/A]       AV-090: No instruction-introspection loops or positional assumptions.
```

**Checklist 01 tally — PASS 36 · FAIL 7 · PARTIAL 16 · N/A 31 · Total 90**

### Checklist 02 — Access Control (AC-001 … AC-050)

```
[PASS]      AC-001: Every token/SOL-moving instruction has a Signer — user, vault_admin_authority,
                    global_admin, pending_admin, or payer. Verified across all 22 handlers.
[PARTIAL]   AC-002: invest / invest_with_max_amount mutate vault accounting with a signer that has no authority link.
              File: handler_invest.rs:189 (payer: Signer, no has_one)
              Impact: permissionless by design (crank); every effect is bounded by post_transfer_invest_checks.
              Fix: document the permissionless crank role in-repo; consider an optional keeper allowlist.
[PASS]      AC-003: Signers are linked to state — has_one = vault_admin_authority / pending_admin / global_admin,
                    or an explicit key comparison (handler_update_reserve_allocation.rs:56-57).
[PASS]      AC-004: Anchor Signer<'info> is used throughout; no manual is_signer inspection anywhere.
[N/A]       AC-005: No manual is_signer checks exist.
[PASS]      AC-006: Admin instructions pair Signer with has_one — e.g. WithdrawPendingFees (handler_withdraw_pending_fees.rs:143-151).
[N/A]       AC-007: No investor-position accounts; shares are bearer SPL tokens with token::authority = user.
[N/A]       AC-008: No delegate-based instruction path.
[PASS]      AC-009: No instruction lets a third party act for a signer; shares move only via SPL authority.
[PARTIAL]   AC-010: Three permissionless instructions move value and none is documented in-repo.
              File: lib.rs:114-126 (invest), :204-206 (topup_rewards), :37-39 (init_vault)
              Impact: invest moves vault liquidity across the klend boundary; topup_rewards moves tokens in.
                      Both are value-bounded by post-transfer checks, but the "why" is nowhere recorded.
              Fix: document the crank/donation roles in README.md and in code comments.
[PASS]      AC-011: Five roles — global_admin, vault_admin_authority, allocation_admin, pending_admin, permissionless.
                    Each instruction maps to exactly one (see §6 Instruction Matrix).
[PARTIAL]   AC-012: Two instructions accept either of two roles, with no in-repo justification.
              File: handler_update_reserve_allocation.rs:56-71 (vault admin OR allocation admin),
                    vault_config_operations.rs:40-92 (global admin OR vault admin per field)
              Impact: the split is deliberate and sensible; it is simply undocumented.
              Fix: record the delegation rationale alongside VaultConfigField.
[PASS]      AC-013: Role escalation blocked — admin identity is read from the loaded account, not from a passed key.
              File: handler_update_vault_config.rs:21-22, handler_update_reserve_allocation.rs:56-57
[N/A]       AC-014: No investor-position accounts to spoof.
[PASS]      AC-015: global_admin is bootstrapped from the program's BPF upgrade authority;
                    vault_admin_authority is the vault creator.
              File: handler_initialize_global_config.rs:14-19, handler_init_vault.rs:20
[PARTIAL]   AC-016: Admin cannot drain principal, but has unbounded timing control over fees/penalties and no pause.
              File: vault_config_operations.rs:101-121, :229-239
              Impact: see F-002 and F-005.
              Fix: timelock fee changes; add an asymmetric breaker.
[PASS]      AC-017: No god-mode account or bypass path exists across the 22 instructions.
[PASS]      AC-018: The vault admin cannot impersonate a holder — shares burn requires token::authority = user.
              File: handler_withdraw.rs:147-152, token_ops.rs:42-62
[PASS]      AC-019: Holders cannot reach admin paths — every admin instruction checks the stored authority.
[PASS]      AC-020: has_one = vault_admin_authority scopes each admin to their own vault.
[PASS]      AC-021: Holders act only on their own shares (token::authority = user on every user_shares_ata).
[PASS]      AC-022: The admin withdrawal path is bounded by pending_fees_sf, never by depositor balances.
              File: vault_operations.rs:386-395
[PARTIAL]   AC-023: Management fee capped at 10 %, withdrawal penalty at 10 % — but performance fee at 100 %.
              File: vault_config_operations.rs:106-110 vs :114-116, :231-235
              Impact: see F-002.
              Fix: introduce MAX_PERFORMANCE_FEE_BPS.
[FAIL-5]    AC-024: Fees change at any time with immediate effect and no timelock. See F-002.
              File: vault_config_operations.rs:101-121, handler_update_vault_config.rs:47
              Impact: a fee or penalty change lands in the same slot as a victim's pending withdrawal.
              Fix: pending_* fields plus an effective-from timestamp; emit an event on proposal and promotion.
[PASS]      AC-025: The fee destination is validated on every transfer — token::mint = token_mint,
                    token::authority = vault_admin_authority.
              File: handler_withdraw_pending_fees.rs:176-180
[PARTIAL]   AC-026: The destination follows the admin, and the admin is mutable (two-step).
              File: handler_update_admin.rs:5-16
              Impact: acceptable for a per-vault manager model; there is no immutable treasury.
              Fix: none required; note the design in documentation.
[N/A]       AC-027: No platform-fee-minimum concept in this protocol.
[PASS]      AC-028: Admin handover is two-step — PendingVaultAdmin set by the admin, accepted by the pending admin.
              File: vault_config_operations.rs:160-166, handler_update_admin.rs:18-27
[PASS]      AC-029: The reserve whitelist is global-admin-only, separate from every vault admin.
              File: handler_add_update_whitelisted_reserve.rs:36-45
[FAIL-4]    AC-030: No pause mechanism exists. See F-005.
              File: lib.rs:32-218, state/vault_state.rs:19-89
              Impact: a program upgrade is the only incident response.
              Fix: asymmetric breaker halting inflow only.
[N/A]       AC-031: No pause exists.
[N/A]       AC-032: No pause exists.
[N/A]       AC-033: No pause exists.
[N/A]       AC-034: No pause exists.
[FAIL-4]    AC-035: No emergency stop — flagged per this item. See F-005.
              File: lib.rs:32-218
              Impact: no bounded response between detection and upgrade.
              Fix: as F-005.
[PASS]      AC-036: The shares mint is created without a freeze authority (no mint::freeze_authority given).
              File: handler_init_vault.rs:106-113
[PASS]      AC-037: The shares mint authority is the base_vault_authority PDA; only this program can mint.
              File: handler_init_vault.rs:111, token_ops.rs:20-37
[PASS]      AC-038: No freeze authority on shares — nobody can freeze a holder's position.
[PASS]      AC-039: PDA front-running is not reachable — see AV-087.
[N/A]       AC-040: No per-user position accounts to create.
[PARTIAL]   AC-041: The allocation admin can raise the cost of every user's exit. See F-003.
              File: handler_update_reserve_allocation.rs:56-71, vault_operations.rs:1024
              Impact: withdrawals scale with an admin-set reserve count.
              Fix: per-instruction reserve subsetting; MAX_ACTIVE_RESERVES.
[PASS]      AC-042: No close path exists, so no account can be force-closed.
[PASS]      AC-043: Solana's recent-blockhash mechanism prevents replay; no off-chain component in scope.
[PARTIAL]   AC-044: min_invest_delay_slots is the only on-chain rate limit and it is bypassable. See F-009.
              File: vault_operations.rs:578-580, :681-686
              Impact: the cooldown does not bind an adversary who caps max_amount.
              Fix: advance last_invest_slot whenever collateral moves.
[PARTIAL]   AC-045: init_vault is permissionless; each vault costs its creator ~0.44 SOL of rent for 62,552 bytes.
              File: handler_init_vault.rs:78-126, utils/consts.rs:10
              Impact: spam is self-funded and therefore self-limiting; no shared resource is exhausted.
              Fix: none required.
[PASS]      AC-046: No cross-instruction authority carry-over — every handler re-derives authority from state.
[N/A]       AC-047: No close path, so no stale post-close access.
[PASS]      AC-048: klend cannot call back — this program exposes no instruction klend would invoke.
[PASS]      AC-049: Checks-effects-interactions is respected on every path; all accounting precedes CPIs.
              File: vault_operations.rs:335-343 then handler_withdraw.rs:277-299
[PASS]      AC-050: Signer seeds are [b"authority", vault_state, bump] — vault_state is a program-owned account,
                    so no other program can reproduce them.
              File: utils/token_ops.rs:20-24, utils/consts.rs:3
```

**Checklist 02 tally — PASS 27 · FAIL 3 · PARTIAL 9 · N/A 11 · Total 50**

### Checklist 03 — Arithmetic Safety (AR-001 … AR-063)

```
[FAIL-3]    AR-001: Bare `+` on accounting fields; overflow-checks=true turns a wrap into a panic, not a typed error.
              File: vault_operations.rs:940, :964, :944, :1388, :1557, :1581, :1594, :578
              Impact: aborts instead of returning MathOverflow — opaque failures, no client-actionable code.
              Fix: checked_add(...).ok_or(KaminoVaultError::MathOverflow)? in the common accounting helpers.
[FAIL-3]    AR-002: Bare `-`, including on user input. See F-008.
              File: vault_operations.rs:68, :1392, :1571, :1577, :677, :942, :979
              Impact: a deposit below the crank fee panics rather than returning DepositAmountBelowMinimum.
              Fix: checked_sub with the existing typed errors.
[FAIL-3]    AR-003: Bare `*` on an unbounded admin parameter.
              File: vault_operations.rs:66 (num_reserve * crank_fund_fee_per_reserve)
              Impact: panics for crank_fund_fee_per_reserve > u64::MAX/25. See F-008, F-014.
              Fix: checked_mul.
[PASS]      AR-004: Every division routes through Fraction helpers (mul_int_ratio, full_mul_int_ratio) or U256.
              File: fraction_utils.rs:15, vault_operations.rs:1123, :1403, :1448
[FAIL-3]    AR-005: Bare operators appear on financial values across ~15 sites — see AR-001..003.
              File: vault_operations.rs:66-68, :940-944, :1388-1394, :1548-1595
              Impact: the program relies on a build profile setting rather than on explicit checks.
              Fix: convert the accounting helpers in vault_operations::common to checked, Result-returning forms.
[PARTIAL]   AR-006: saturating_* appears on financial paths.
              File: vault_operations.rs:853, :888, :898-904, :930, :935, :477
              Impact: mostly correct (saturating_sub for elapsed time and for AUM drawdown is the right semantic),
                      but cumulative_* analytics silently cap rather than failing.
              Fix: keep the time/drawdown uses; make the cumulative counters checked.
[PASS]      AR-007: No wrapping_add / wrapping_sub / wrapping_mul anywhere in the program.
[PASS]      AR-008: Constant-only arithmetic (SECONDS_PER_HOUR etc.) is compile-time. utils/consts.rs:21-23.
[PASS]      AR-009: No `space = ...` arithmetic beyond `8 + CONST`, with static_assertions on each CONST.
[PASS]      AR-010: a*b/c uses U256 or Fraction::full_mul_int_ratio throughout.
              File: fraction_utils.rs:9-20, vault_operations.rs:1123-1126
[PASS]      AR-011: Share minting widens to Fraction (U68F60) with a u64 ratio — no u64*u64 product.
              File: vault_operations.rs:1123-1124
[PASS]      AR-012: Fee/penalty bps math uses full_mul_int_ratio against FULL_BPS.
              File: vault_operations.rs:1447-1449
[PASS]      AR-013: Proportional payout uses full_mul_int_ratio(shares_to_withdraw, shares_issued).
              File: vault_operations.rs:1400-1404
[PARTIAL]   AR-014: Fraction→u64 narrowing uses to_floor/to_ceil, which do not surface an out-of-range result.
              File: vault_operations.rs:251, :390, :396, :1126, :1425, :1462, :1544
              Impact: only try_to_ceil (with unwrap_or(u64::MAX)) is guarded, at :1009.
              Fix: use the checked try_to_* variants with an explicit IntegerOverflow error.
[PARTIAL]   AR-015: U256→u128 narrowing panics via .expect() rather than returning an error.
              File: utils/fraction_utils.rs:17-19
              Impact: bounded in practice — callers guarantee aum > 0 and amount >= 1, keeping the quotient under 2^124.
              Fix: return Result and map to MathOverflow.
[PASS]      AR-016: u64→u8 narrowing uses try_from on bump and decimals, both proven <= 255 by VaultState::validate.
              File: handler_withdraw.rs:336-338, state/vault_state.rs:198-208
[N/A]       AR-017: No u64→i64 casts on value quantities.
[PASS]      AR-018: Divisors are guarded — current_vault_aum > 0 (:167-170), holdings_aum != 0 (:1119-1121),
                    loop_weight > 0 (state/vault_state.rs:367), FULL_BPS and SECONDS_PER_YEAR constant.
[PASS]      AR-019: get_shares_to_mint returns early for shares_issued == 0 and errors on aum == 0.
              File: vault_operations.rs:1115-1121
[PASS]      AR-020: Withdrawal proportion is guarded by VaultAUMZero and by the dead shares keeping shares_issued > 0.
              File: vault_operations.rs:167-170
[PASS]      AR-021: Zero-output truncation is rejected — DepositAmountsZeroShares, WithdrawResultsInZeroShares,
                    CannotWithdrawZeroLamports.
              File: vault_operations.rs:116-118, :212-215, :308-310, :787-789, :812-814
[PASS]      AR-022: Share minting floors the numerator and ceils the denominator — rounds toward the vault.
              File: vault_operations.rs:1123-1126
[PASS]      AR-023: Share burning ceils (user burns at least their due) and payout floors.
              File: vault_operations.rs:1539-1545, :1425
[PASS]      AR-024: Every rounding direction favours the vault, and min_deposit_amount / min_withdraw_amount
                    bound dust-sized round trips.
              File: vault_operations.rs:108-114, :324-326
[PASS]      AR-025: First-depositor manipulation is blocked by the 1,000 dead shares seeded at init.
              File: handler_init_vault.rs:47-53, utils/consts.rs:27
[PASS]      AR-026: shares = user_amount * shares_issued / ceil(aum) — correct and vault-favourable.
              File: vault_operations.rs:1123-1126
[PASS]      AR-027: shares_issued == 0 yields a 1:1 ratio.
              File: vault_operations.rs:1115-1117
[PASS]      AR-028: asset_return = aum * shares / shares_issued, floored.
              File: vault_operations.rs:1400-1404, :1425
[PASS]      AR-029: Slippage protection on mint exists — min_shares_out with require_gte!.
              File: lib.rs:73-79, vault_operations.rs:120-124
[FAIL-4]    AR-030: No slippage protection on burn — no withdrawal entrypoint accepts a minimum-out. See F-002.
              File: lib.rs:98-112, :212-217
              Impact: users sign "burn N shares" and accept any execution price.
              Fix: add withdraw_with_min_amount_out / redeem_in_kind_with_min_out.
[PASS]      AR-031: Donation cannot dilute — AUM reads vault.token_available, never token_vault.amount.
              File: vault_operations.rs:1383-1385, state/vault_state.rs:178-187
[PASS]      AR-032: Withdrawals reduce shares_issued and AUM proportionally; the penalty stays in the vault,
                    raising the price for remaining holders.
              File: vault_operations.rs:335-348
[N/A]       AR-033: No per-investor position accounts to sum.
[FAIL-3]    AR-034: shares_issued != shares_mint.supply by a permanent 1,000. See F-010.
              File: handler_init_vault.rs:43-73
              Impact: off-chain consumers pricing against mint supply overstate share value.
              Fix: document the invariant; assert it in the post-checks.
[PASS]      AR-035: Management fee = prev_aum * bps * seconds / SECONDS_PER_YEAR, in Fraction arithmetic.
              File: vault_operations.rs:868-885
[PASS]      AR-036: Performance fee = bps * earned_interest, in Fraction arithmetic.
              File: vault_operations.rs:888-889
[N/A]       AR-037: No platform/treasury fee tier exists.
[PASS]      AR-038: new_fees is clamped to new_aum, so fees can never exceed assets.
              File: vault_operations.rs:906
[PARTIAL]   AR-039: Performance fee bound is 10000 bps (100 %). See F-002.
              File: vault_config_operations.rs:106-110
              Impact: 100 % of interval yield is capturable.
              Fix: MAX_PERFORMANCE_FEE_BPS.
[N/A]       AR-040: No minimum-fee requirement in this protocol.
[PASS]      AR-041: charge_fees runs before share math on every path — deposit :78, withdraw :162, invest :561.
[PARTIAL]   AR-042: Withdrawal penalties remain in AUM and are counted as earned_interest at the next charge_fees.
              File: vault_operations.rs:346-348 then :888
              Impact: a performance fee is charged on a withdrawal penalty — a fee on a fee. See F-013.
              Fix: track penalties separately and exclude them from earned_interest.
[PASS]      AR-043: Zero-amount transfers are skipped rather than CPI'd.
              File: token_ops.rs:99-114
[PASS]      AR-044: AUM = token_available + sum(invested per reserve) - pending_fees.
              File: state/vault_state.rs:178-187, vault_operations.rs:1194-1222
[PASS]      AR-045: Single-mint vault — one decimals value, captured at init from the real mint.
              File: handler_init_vault.rs:32, state/vault_state.rs:206-208
[PASS]      AR-046: Zero-balance reserves contribute 0 via checked_fraction_collateral_to_liquidity(0).
              File: vault_operations.rs:1148-1153
[PASS]      AR-047: AUM is derived from klend reserve state, not attested by the manager.
              File: vault_operations.rs:1144-1164
[PASS]      AR-048: The admin has no lever that deflates AUM ahead of a deposit — AUM is a pure function
                    of accounting plus klend exchange rates.
[PASS]      AR-049: Reserve identity is pinned by pubkey equality against vault_allocation_strategy, not by
                    discriminator alone.
              File: vault_operations.rs:1067, :1213-1215
[PASS]      AR-050: Reserve staleness is enforced per slot before any math runs.
              File: vault_operations.rs:1097-1104
[PASS]      AR-051: All lamport/token values are u64 end to end; no narrowing.
[N/A]       AR-052: No raw lamport transfers — all value moves via SPL Token CPIs.
[N/A]       AR-053: No lamport manipulation.
[N/A]       AR-054: No account-drain path.
[N/A]       AR-055: No WSOL wrap/unwrap handling.
[PARTIAL]   AR-056: max_amount = u64::MAX is safe; small max_amount underflows. See F-008.
              File: vault_operations.rs:68
              Impact: panic on a legitimate small deposit.
              Fix: checked_sub.
[PASS]      AR-057: Zero inputs are rejected — max_amount > 0 (handler_deposit.rs:23), number_of_shares > 0
                    (vault_operations.rs:193-196, :732-735), amount > 0 (:960, :974), max_amount > 0 (:548-551).
[PASS]      AR-058: Minimum viable amounts are handled — 1-unit deposits produce 1 share at parity;
                    1-unit withdrawals are rejected by min_withdraw_amount rather than mis-priced.
[PASS]      AR-059: The vault can never reach 1 or 0 shares while AUM > 0 — the 1,000 dead shares are a floor.
[PARTIAL]   AR-060: The many-reserve worst case is not bounded by cost, only by count. See F-003.
              File: state/vault_state.rs:12, vault_operations.rs:1024
              Impact: 25 reserves must be refreshed on every user instruction.
              Fix: per-instruction subsetting; profile and cap.
[PARTIAL]   AR-061: clock.unix_timestamp (i64) is narrowed with .try_into().unwrap() at 12 sites.
              File: handler_deposit.rs:56, handler_invest.rs:44, handler_withdraw.rs:254, vault_operations.rs:737,
                    :749, handler_init_vault.rs:34, :52, handler_topup_rewards.rs:11, handler_withdraw_rewards.rs:12,
                    handler_give_up_pending_fees.rs:27, handler_update_vault_config.rs:39, vault_config_operations.rs:260
              Impact: panics on a negative timestamp — unreachable on mainnet, but a panic rather than an error.
              Fix: u64::try_from(...).map_err(|_| KaminoVaultError::IntegerOverflow)?
[PARTIAL]   AR-062: Fee components are bounded individually but never summed.
              File: vault_config_operations.rs:106-121, :229-239
              Impact: mgmt (10 %) + perf (100 %) + penalty (10 %) are each valid yet jointly extreme.
              Fix: validate the combined worst case at write time.
[FAIL-2]    AR-063: f64 appears in the management-fee divisor. See F-011.
              File: utils/consts.rs:19, vault_operations.rs:873-874
              Impact: none materially — a compile-time constant with no user input — but it is a float in a value path.
              Fix: replace with an integer constant.
```

**Checklist 03 tally — PASS 39 · FAIL 7 · PARTIAL 9 · N/A 8 · Total 63**

### Checklist 04 — CPI & PDA Safety (CPI-001 … RE-007)

```
[N/A]       CPI-001: Pubkey-first CpiContext is an Anchor 1.0 API; this program targets Anchor 0.29,
                     where .to_account_info() is the correct idiom. Cargo.toml:16.
[N/A]       CPI-002: Same as CPI-001 for new_with_signer.
[PASS]      CPI-003: Token CPIs use Interface<'info, TokenInterface> (base asset) and Program<'info, Token>
                     (shares, cTokens) — program ID validated by Anchor.
              File: handler_deposit.rs:164-165, handler_withdraw.rs:156-157
[PASS]      CPI-004: System program typed Program<'info, System> wherever init is used.
              File: handler_init_vault.rs:122, handler_add_update_whitelisted_reserve.rs:58
[N/A]       CPI-005: No Associated Token Program CPI — vault token accounts are program PDAs.
[N/A]       CPI-006: No DEX/aggregator CPI.
[PASS]      CPI-007: Metaplex CPI target is Program<'info, Metadata> — ID validated by anchor-spl.
              File: handler_initialize_shares_metadata.rs:55, handler_update_metadata.rs:49
[PASS]      CPI-008: No UncheckedAccount is ever used as a CPI program.
[PASS]      CPI-009: remaining_accounts feed the klend batch refresh, whose program ID is the hardcoded
                     kamino_lending::id().
              File: klend_operations.rs:96
[PASS]      CPI-010: Raw invoke_signed targets are validated — kamino_lending::id() for the refresh,
                     ctx.accounts.klend_program.key() (Program<KaminoLending>) for deposit/redeem.
              File: klend_operations.rs:96, :144, :195, :241, :287
[PASS]      CPI-011: transfer_checked `from` is token_vault (has_one-bound) or the user's own ATA.
              File: token_ops.rs:104-106, :128-130
[PASS]      CPI-012: transfer_checked `to` is the user's constrained ATA or token_vault.
              File: token_ops.rs:104, :129
[PASS]      CPI-013: Authority is base_vault_authority (PDA-signed) outbound, the user inbound.
              File: token_ops.rs:106, :130
[PASS]      CPI-014: Amounts are formula-derived and re-asserted by the post-transfer balance checks.
              File: vault_checks.rs:69-134, :196-262
[PASS]      CPI-015: mint_to targets shares_mint, bound by has_one = shares_mint on vault_state.
              File: handler_deposit.rs:131, token_ops.rs:30
[PASS]      CPI-016: mint_to destination is user_shares_ata with token::mint = shares_mint, token::authority = user.
              File: handler_deposit.rs:157-161
[PASS]      CPI-017: mint_to authority is base_vault_authority, signed with [b"authority", vault_state, bump].
              File: token_ops.rs:20-35
[PASS]      CPI-018: shares_to_mint comes from get_shares_to_mint, never from user input, and is re-asserted
                     against the minted delta afterwards.
              File: vault_operations.rs:97-101, handler_deposit.rs:102-105
[PASS]      CPI-019: burn `from` is user_shares_ata (token::authority = user).
              File: handler_withdraw.rs:147-152, token_ops.rs:54
[PASS]      CPI-020: burn authority is the user's own signature — CpiContext::new, not new_with_signer.
              File: token_ops.rs:49-59
[PASS]      CPI-021: shares_to_burn is formula-derived, clamped to the requested amount, and re-asserted
                     against the observed balance delta.
              File: vault_operations.rs:1533-1546, vault_checks.rs:118-122
[N/A]       CPI-022: No close_account CPI anywhere.
[N/A]       CPI-023: No close_account CPI.
[N/A]       CPI-024: No close_account CPI — the vault cannot be closed.
[N/A]       CPI-025: No system_program::transfer CPI.
[N/A]       CPI-026: No token::approve CPI.
[N/A]       CPI-027: No token::revoke CPI.
[PASS]      PDA-001: Every PDA carries a type prefix plus its parent key(s).
              File: utils/consts.rs:1-8
[N/A]       PDA-002: No "fund" PDA — vault_state is a client-generated keypair account (#[account(zero)]).
[PASS]      PDA-003: Six PDA families, each enumerated and verified:
                     token_vault [b"token_vault", vault] · ctoken_vault [b"ctoken_vault", vault, reserve] ·
                     base_vault_authority [b"authority", vault] · shares_mint [b"shares", vault] ·
                     global_config [b"global_config"] · whitelist [b"whitelisted_reserves", reserve].
[PASS]      PDA-004: Seed order is identical at init and at every later reference — verified across all handlers.
[PASS]      PDA-005: token_vault and ctoken_vault seeds include vault_state.key().
              File: handler_init_vault.rs:91, handler_withdraw.rs:87
[PASS]      PDA-006: shares_mint seeds include vault_state.key().
              File: handler_init_vault.rs:107
[N/A]       PDA-007: No attestation/oracle PDA exists.
[PASS]      PDA-008: The whitelist PDA is seeded by the reserve it governs.
              File: handler_invest.rs:240, handler_update_reserve_allocation.rs:146
[PASS]      PDA-009: Derivation and usage match — ctoken_vault is additionally cross-checked against the stored
                     allocation.ctoken_vault.
              File: handler_withdraw.rs:234-237
[PARTIAL]   PDA-010: base_vault_authority_bump is stored and reused; other bumps are re-derived each call.
              File: state/vault_allocation.rs:24 (ctoken_vault_bump stored, never consumed)
              Impact: CU cost, no correctness risk — Anchor's bare `bump` is canonical.
              Fix: consume the stored bump in the constraint.
[PASS]      PDA-011: No variable-length or user-controlled seed data anywhere.
[N/A]       PDA-012: The vault name is not a PDA seed (state/vault_state.rs:65 is display metadata only).
[PASS]      PDA-013: No seed derives from mutable state — all seeds are constants plus immutable account keys.
[PASS]      PDA-014: invoke_signed uses [b"authority", vault_state, bump] for every PDA-authorized CPI.
              File: klend_operations.rs:136-141, :187-192, :233-238, :279-284, token_ops.rs:93-97
[PASS]      PDA-015: Signer seeds match the base_vault_authority derivation exactly (order and components).
              File: utils/consts.rs:3 vs handler_init_vault.rs:87
[PASS]      PDA-016: The bump used for signing is the stored base_vault_authority_bump captured at init.
              File: handler_init_vault.rs:27, handler_withdraw.rs:336
[PASS]      PDA-017: invoke_signed (not invoke) is used wherever the PDA is the authority.
              File: cpi_mem.rs:102-113, klend_operations.rs:143, token_ops.rs:100-113
[PASS]      PDA-018: The only unsigned CPIs are user-authorized (burn, deposit transfer, rounding-loss top-up).
              File: token_ops.rs:49-59, :124-137, handler_invest.rs:106-118
[PASS]      PDA-019: CPI instruction data is built in-program from klend's own discriminator constants —
                     never taken from the caller.
              File: klend_operations.rs:128-132, :179-183, :225-229, :271-275
[N/A]       PDA-020: No Jupiter CPI.
[N/A]       PDA-021: No realloc anywhere in the program.
[N/A]       EXT-001: No Jupiter integration.
[N/A]       EXT-002: No Jupiter integration.
[N/A]       EXT-003: No Jupiter integration.
[N/A]       EXT-004: No Jupiter integration.
[N/A]       EXT-005: No Jupiter integration.
[N/A]       EXT-006: No Jupiter integration.
[PASS]      EXT-007: The metadata account is derived and validated by Metaplex; the update path additionally
                     constrains update_authority and mint against vault_state.
              File: handler_update_metadata.rs:42-47
[PASS]      EXT-008: Metaplex program ID validated via Program<'info, Metadata>.
[PASS]      EXT-009: klend is the only protocol CPI and is compile-time pinned on every context.
              File: handler_deposit.rs:163, handler_withdraw.rs:159, handler_invest.rs:245
[PASS]      EXT-010: The reserve whitelist is program-owned, PDA-derived per reserve, and global-admin-managed —
                     separate from any vault admin.
              File: handler_add_update_whitelisted_reserve.rs:36-56
[PASS]      EXT-011: No CPI grants the callee elevated privilege back into this program.
[FAIL-4]    EXT-012: Transfer-hook mints are neither rejected nor supported. See F-006.
              File: token_ops.rs:100-137
              Impact: transfer_checked is built with no hook-account resolution and no hook allowlist.
              Fix: reject TransferHook at init_vault, or resolve extra accounts via spl_transfer_hook_interface.
[FAIL-4]    EXT-013: Custodied mints are never inspected for PermanentDelegate / FreezeAuthority /
                     MintCloseAuthority. See F-006.
              File: handler_init_vault.rs:101-104
              Impact: a hostile mint authority can seize or freeze the vault.
              Fix: get_extension screening at init, or a mint allowlist.
[PARTIAL]   EXT-014: transfer_checked is used everywhere, but credit is the declared amount plus an
                     exact-equality post-check rather than a balance delta.
              File: token_ops.rs:100-137, handler_deposit.rs:112-115
              Impact: fee-on-transfer mints revert (fail-closed) instead of being accounted correctly.
              Fix: credit after-before with checked_sub if transfer-fee support is desired.
[PASS]      EXT-015: The shares mint's metadata can only be created by this program — the Metaplex CPI is signed
                     by base_vault_authority, which is the mint authority — and update_authority is set to that PDA.
              File: utils/metadata.rs:30-50, handler_init_vault.rs:111
[PASS]      RE-001: All accounting mutations precede every CPI on every path.
              File: vault_operations.rs:335-348 before handler_withdraw.rs:277; :127-133 before handler_deposit.rs:69
[PASS]      RE-002: Post-CPI state is re-read from the chain, never reused from a pre-CPI snapshot.
              File: handler_withdraw.rs:302-306, :341-355; handler_invest.rs:150-163
[PARTIAL]   RE-003: Post-CPI reads use token_interface::accessor::amount (a fixed byte-offset read) rather than
                     Anchor's .reload(), so owner and discriminator are not re-validated.
              File: handler_withdraw.rs:302-306, :341-369; handler_invest.rs:161-163
              Impact: safe today — every CPI target is compile-time pinned, so no callee can reassign an owner.
              Fix: use .reload() on the InterfaceAccount wrappers.
[PASS]      RE-004: No approval or delegation is ever granted to an external program.
[PASS]      RE-005: Flash-loan resistant — share price derives from internal accounting plus klend exchange rates,
                     neither of which an atomic borrow can move.
              File: vault_operations.rs:1383-1385, :1144-1164
[PARTIAL]   RE-006: Signing accounts are forwarded into the klend CPI account_infos with no lamport-drain bound.
              File: cpi_mem.rs:53-60 (all ctx accounts + remaining), klend_operations.rs:143
              Impact: nil in practice — the callee is always the pinned kamino_lending program.
              Fix: snapshot payer/user lamports and assert the post-CPI drain if an untrusted CPI is ever added.
[PARTIAL]   RE-007: Account owners are not re-asserted after CPIs.
              File: handler_withdraw.rs:341-369, handler_invest.rs:150-163
              Impact: nil in practice — no attacker-controlled program is ever invoked, so no System assign can occur.
              Fix: re-check owner after CPI, or move to .reload() which does it (see RE-003).
```

**Checklist 04 tally — PASS 42 · FAIL 2 · PARTIAL 5 · N/A 21 · Total 70**

### Checklist 05 — State Machine & Lifecycle (SM-001 … SM-072)

```
[PASS]      SM-001: Five enums exist — VaultConfigField, UpdateGlobalConfigMode, UpdateReserveWhitelistMode,
                    InvestingDirection, CtokenCap. None is a persisted lifecycle status.
              File: vault_config_operations.rs:15-38, utils/global_config.rs:6-12,
                    reserve_whitelist_operations.rs:8-12, operations/effects.rs:28-32, state/ctoken_cap.rs:3-4
[PASS]      SM-002: All variants enumerated and reviewed — 21 config fields, 3 global modes, 2 whitelist modes,
                    2 investing directions.
[N/A]       SM-003: No persisted state enum exists; VaultState holds no status field.
[N/A]       SM-004: No persisted state enum.
[PASS]      SM-005: No dead variants — every VaultConfigField arm is handled in both the permission gate and the
                    writer (vault_config_operations.rs:46-90 and :100-274).
[PASS]      SM-006: Anchor discriminators prevent external writes to program-owned accounts.
[N/A]       SM-007: No terminal states — the vault has no lifecycle status.
[N/A]       SM-008: No terminal-state accounts to close.
[N/A]       SM-009: Withdrawal is single-transaction; no initiation step or request PDA exists.
[N/A]       SM-010: No withdrawal-initiation instruction.
[N/A]       SM-011: No swap/conversion step in the withdrawal flow.
[N/A]       SM-012: No multi-status withdrawal flow.
[N/A]       SM-013: No intermediate readiness step by design.
[N/A]       SM-014: Not applicable — single-step withdrawal is the intended design, not a missing step.
[N/A]       SM-015: No finalization step.
[N/A]       SM-016: No withdrawal account to close.
[N/A]       SM-017: Shares burn and tokens transfer atomically in one instruction (handler_withdraw.rs:277-339).
[N/A]       SM-018: No cancellation step.
[N/A]       SM-019: No cancellation step.
[N/A]       SM-020: No cancellation step.
[N/A]       SM-021: No withdrawal accounts, so no uniqueness constraint needed.
[N/A]       SM-022: No pending withdrawals to time out.
[N/A]       SM-023: Withdrawals cannot get stuck pending — they complete or revert atomically.
[N/A]       SM-024: Partial withdrawal is inherent — the user names the share amount.
[PASS]      SM-025: init_vault populates every required field before validate() runs.
              File: handler_init_vault.rs:20-35, state/vault_state.rs:189-234
[PASS]      SM-026: Admin, token mint, vault, shares mint, authority and bump are all set at init.
              File: handler_init_vault.rs:20-27
[PASS]      SM-027: Re-initialization is blocked — #[account(zero)] requires a zero discriminator and load_init sets it.
              File: handler_init_vault.rs:18, :83-84
[FAIL-2]    SM-028: No vault-closure instruction exists; the 62,552-byte vault_state rent (~0.44 SOL) plus each
                    ctoken_vault's rent are locked permanently, alongside the 1,000 dead-share deposit.
              File: lib.rs:32-218 (no close instruction), handler_init_vault.rs:83-84
              Impact: an abandoned vault's rent is unrecoverable. No security consequence.
              Fix: add an admin-gated close_vault requiring shares_issued == INITIAL_DEPOSIT_AMOUNT,
                   pending_fees == 0, and every allocation empty.
[N/A]       SM-029: No closure instruction to gate.
[N/A]       SM-030: No closure instruction to gate.
[PASS]      SM-031: The "no closure instruction" condition is present and flagged as INFO — see SM-028.
[N/A]       SM-032: vault_state is a client-generated keypair, not a name-seeded PDA, so no name collision exists.
[PASS]      SM-033: deposit → accounting credit → share mint, in that order, with post-checks.
              File: vault_operations.rs:127-133, handler_deposit.rs:82-115
[PASS]      SM-034: shares_issued increases by exactly the minted amount, asserted against the observed delta.
              File: handler_deposit.rs:102-105
[N/A]       SM-035: No position accounts — shares are bearer SPL tokens.
[N/A]       SM-036: No position accounts.
[N/A]       SM-037: No position accounts.
[N/A]       SM-038: No position accounts; share balances are enforced by the SPL Token program.
[N/A]       SM-039: No position accounts.
[N/A]       SM-040: No position accounts.
[N/A]       SM-041: No state transitions to guard — there is no status field.
[N/A]       SM-042: No multi-state sequence exists.
[PASS]      SM-043: All accounting mutations complete before any CPI; a CPI failure reverts the whole transaction.
              File: vault_operations.rs:335-348
[PASS]      SM-044: Solana transaction atomicity guarantees no partial state.
[PASS]      SM-045: Repeated transitions are idempotent — update_admin re-applies the same pending_admin;
                    update_global_config_admin likewise.
              File: handler_update_admin.rs:13, state/global_config.rs:80-83
[N/A]       SM-046: No close path, so no seed reuse.
[PARTIAL]   SM-047: Only 3 of 22 instructions emit structured events. See F-012.
              File: events.rs:1-35, handler_invest.rs (none), handler_withdraw_pending_fees.rs (none)
              Impact: the crank, fee withdrawal, config changes and admin rotations are unobservable off-chain.
              Fix: add the events listed in F-012.
[PARTIAL]   SM-048: Emitted events omit the vault pubkey, the actor, and a timestamp.
              File: events.rs:4-34
              Impact: an indexer must join against the enclosing transaction to attribute an event.
              Fix: add vault / user / timestamp fields.
[PASS]      SM-049: Events use emit_cpi! (self-CPI inner instructions), the non-spoofable form.
              File: handler_deposit.rs:43, :59; handler_withdraw.rs:44-45; handler_redeem_in_kind.rs:49, :75
[PARTIAL]   SM-050: Off-chain reconstruction is incomplete for the 16 silent instructions. See SM-047.
              File: events.rs:1-35
              Impact: indexers must poll account state for configuration and crank activity.
              Fix: as F-012.
[FAIL-3]    SM-051: vault.shares_issued == shares_mint.supply does not hold — it diverges by 1,000. See F-010.
              File: handler_init_vault.rs:43-73
              Impact: integrators pricing against mint supply overstate share value.
              Fix: document and assert the intended invariant (supply + DEAD_SHARES).
[N/A]       SM-052: No per-investor position accounts to sum.
[PASS]      SM-053: token_vault.amount >= token_available + available_crank_funds + rewards_available is maintained
                    by the exact-equality post-transfer checks on every path.
              File: vault_checks.rs:69-262, handler_deposit.rs:112-115, handler_topup_rewards.rs:36-44
[PASS]      SM-054: Every deposit increases both shares_issued and token_available, asserted post-hoc.
              File: vault_operations.rs:127-128, handler_deposit.rs:102-115
[PASS]      SM-055: Every withdrawal decreases both, asserted post-hoc.
              File: vault_operations.rs:335, vault_checks.rs:97-131
[PASS]      SM-056: invest leaves shares_issued unchanged and asserts total holdings do not decrease.
              File: vault_checks.rs:245-259
[PASS]      SM-057: Zero-timestamp sentinels are handled by explicit branches, never by arithmetic.
              File: vault_operations.rs:847-851 (last_fee_charge_timestamp), :925-928 (last_issuance_ts)
[PASS]      SM-058: The sentinel value never reaches a comparison like `sentinel + grace` — both branches
                    return early after seeding the real timestamp.
[N/A]       SM-059: No terminal state, so no cleanup helper is required.
[N/A]       SM-060: No terminal state.
[PASS]      SM-061: Draining and zeroing happen in the same transaction with a post-drain backing check —
                    e.g. pending fees are decremented and the transfer is asserted against the observed delta.
              File: vault_operations.rs:421-434, vault_checks.rs:136-194
[N/A]       SM-062: No paired time-gate exists.
[N/A]       SM-063: No paired time-gate exists.
[N/A]       SM-064: No transition matrix needed — there is no status field.
[N/A]       SM-065: No terminal states.
[N/A]       SM-066: No lifecycle transitions for an admin to rewrite.
[PASS]      SM-067: upsert_reserve_allocation preserves ctoken_allocation, last_invest_slot and
                    token_target_allocation_sf when updating an existing slot — only config fields are written.
              File: state/vault_state.rs:277-286
[PASS]      SM-068: Fixed-slot iteration skips empties with filter/continue and never breaks at the first gap.
              File: state/vault_state.rs:114-130, :338-342, :371-377; vault_operations.rs:1058-1070, :1194-1220
[PASS]      SM-069: No cached aggregate exists across instructions — holdings and AUM are recomputed from live
                    reserve state on every call.
              File: vault_operations.rs:1283-1314, :1369-1381
[N/A]       SM-070: No vesting, cliff or lockup schedule.
[N/A]       SM-071: No vesting schedule; all time math is in unix seconds except min_invest_delay_slots,
                    which is compared against clock.slot — consistent within its own use.
[N/A]       SM-072: No cliff logic.
```

**Checklist 05 tally — PASS 24 · FAIL 2 · PARTIAL 3 · N/A 43 · Total 72**

### Checklist 06 — Economic & Logic Attacks (ECON-001 … ECON-089)

```
[PASS]      ECON-001: Flash-borrow → deposit → inflate → withdraw fails. AUM = vault.token_available +
                      klend-derived invested − pending_fees; a borrowed balance moves neither term.
              File: vault_operations.rs:1383-1385, state/vault_state.rs:178-187
[PASS]      ECON-002: No cooldown exists, and none is needed — a same-transaction deposit→withdraw returns the
                      deposit minus the withdrawal penalty, never more.
              File: vault_operations.rs:207-224
[PASS]      ECON-003: Same-slot share minting is safe for the same reason — there is no spot price to manipulate
                      between mint and burn.
[PASS]      ECON-004: Shares are ordinary SPL tokens; using them elsewhere in the same transaction confers no
                      advantage because their price is not derived from any pool.
[N/A]       ECON-005: No NAV attestation instruction exists.
[N/A]       ECON-006: No swap instruction in this program.
[N/A]       ECON-007: No swap to sandwich.
[N/A]       ECON-008: No off-chain-supplied swap route.
[PASS]      ECON-009: A prior deposit cannot dilute the next — each deposit adds exactly its own value to AUM
                      and mints proportionally.
              File: vault_operations.rs:97-133
[PARTIAL]   ECON-010: Withdrawals can be adversely re-priced by an admin transaction ordered ahead of them.
              File: vault_config_operations.rs:229-239, lib.rs:98-112
              Impact: up to a 10 % penalty plus 100 % of interval yield. See F-002.
              Fix: timelock fee changes; add a withdrawal minimum-out.
[PASS]      ECON-011: min_deposit_amount is enforced before shares are minted.
              File: vault_operations.rs:108-114
[PASS]      ECON-012: min_withdraw_amount is enforced and itself capped at 1000.
              File: vault_operations.rs:324-326, :824-826; utils/consts.rs:25
[PASS]      ECON-013: First deposit into an empty vault uses a 1:1 ratio.
              File: vault_operations.rs:1115-1117
[PASS]      ECON-014: The donate-then-dilute sequence fails — direct transfers into token_vault do not change
                      vault.token_available, so they never reach the share price.
              File: vault_operations.rs:1383-1385
[PASS]      ECON-015: A mandatory 1,000-unit initial deposit is taken at vault creation.
              File: handler_init_vault.rs:47-53, utils/consts.rs:27
[PASS]      ECON-016: Dead shares are implemented — 1,000 shares are booked with no SPL token minted, so they
                      are permanently unredeemable. See F-010 for the documentation gap.
              File: handler_init_vault.rs:43-73
[PASS]      ECON-017: Share price at creation is exactly 1:1 (1,000 tokens ↔ 1,000 accounted shares).
[PASS]      ECON-018: NAV is computed on-chain from klend reserve state — no attestor role exists.
              File: vault_operations.rs:1144-1164
[PASS]      ECON-019: No admin lever inflates AUM ahead of deposits.
[PASS]      ECON-020: No admin lever deflates AUM ahead of withdrawals.
[N/A]       ECON-021: No NAV attestation to rate-limit.
[PARTIAL]   ECON-022: AUM correctness is fully delegated to klend's collateral_exchange_rate with no independent
                      cross-check, sanity bound, or rate-of-change cap.
              File: vault_operations.rs:1151-1153, :1129-1137
              Impact: an upstream pricing defect propagates directly into share pricing. See F-005.
              Fix: store last_exchange_rate_sf per allocation and reject moves beyond a configured bps threshold.
[PASS]      ECON-023: AUM of zero is rejected before any share math.
              File: vault_operations.rs:167-170
[PARTIAL]   ECON-024: AUM has no upper bound; the U256→u128 narrowing in calculate_shares_to_burn panics rather
                      than erroring if it were ever exceeded.
              File: utils/fraction_utils.rs:17-19
              Impact: unreachable in practice — callers guarantee aum > 0 and amount >= 1, bounding the quotient
                      below 2^124.
              Fix: return Result; map to MathOverflow.
[PASS]      ECON-025: Reserves are CPI-refreshed and slot-staleness-checked inside the same transaction that
                      prices shares.
              File: vault_operations.rs:1028-1033, :1097-1104
[PARTIAL]   ECON-026: The performance fee may be set to 100 %, so the documented fee is not an enforced ceiling.
              File: vault_config_operations.rs:106-110
              Impact: see F-002.
              Fix: MAX_PERFORMANCE_FEE_BPS.
[FAIL-5]    ECON-027: Fees change after deposits with immediate effect. See F-002.
              File: vault_config_operations.rs:101-121, handler_update_vault_config.rs:47
              Impact: depositors cannot rely on the fee schedule they entered under.
              Fix: timelock + event on proposal and promotion.
[FAIL-5]    ECON-028: No timelock on fee changes — no window for depositors to exit. See F-002.
              File: state/vault_state.rs:19-89 (no pending_* fee fields)
              Impact: a fee change and a victim's withdrawal can land in adjacent slots.
              Fix: pending_* fields plus effective-from timestamp.
[N/A]       ECON-029: No trading or volume-based fee exists.
[PASS]      ECON-030: The management fee is time-proportional, computed from seconds elapsed.
              File: vault_operations.rs:868-885
[FAIL-4]    ECON-031: No high-water mark — prev_aum is marked down on losses, so recovery is charged again.
                      See F-013.
              File: vault_operations.rs:888-889, :909
              Impact: repeated performance fees on the same economic gain across AUM oscillations.
              Fix: persist aum_high_water_mark_sf and charge only above it.
[PASS]      ECON-032: Fees are extracted before share math on every path (charge_fees precedes get_shares_to_mint
                      and compute_user_total_received_on_withdraw).
              File: vault_operations.rs:78-101, :162-211
[PASS]      ECON-033: There is no direct-transfer path out of token_vault — every outbound transfer is bounded by
                      token_available, pending_fees_sf, or rewards_available.
              File: vault_operations.rs:228, :386-395, :978-979
[PARTIAL]   ECON-034: The admin chooses which klend reserves receive user liquidity; the reserve whitelist that
                      would bound this is disabled by default.
              File: state/vault_state.rs:80 (allow_allocations_in_whitelisted_reserves_only, zero-initialised),
                    handler_update_reserve_allocation.rs:87 (same-mint requirement is enforced)
              Impact: liquidity can be routed into any same-mint klend reserve, including an illiquid one.
              Fix: default the whitelist flag to enabled at init_vault.
[PASS]      ECON-035: No instruction can send vault tokens to an arbitrary destination — every destination is
                      constrained by token::mint plus token::authority or a has_one link.
[PASS]      ECON-036: Both ends of every vault transfer are constrained (token_vault by has_one, the counterparty
                      by token::authority).
              File: handler_withdraw_pending_fees.rs:158-181
[N/A]       ECON-037: No lamport-transfer instruction exists.
[N/A]       ECON-038: No token::approve path.
[N/A]       ECON-039: No swap route to make unfavourable.
[PASS]      ECON-040: The only protocol CPI is klend, compile-time pinned via Program<'info, KaminoLending>.
[PARTIAL]   ECON-041: Whitelist control is correctly separated (global admin) from allocation control (vault /
                      allocation admin) — but per-vault enforcement defaults to off.
              File: handler_add_update_whitelisted_reserve.rs:36-45, state/vault_state.rs:80-81
              Impact: the separation only binds on vaults that opt in.
              Fix: enable by default at init_vault.
[PASS]      ECON-042: A vault admin cannot modify the global whitelist — has_one = global_admin on GlobalConfig.
              File: handler_add_update_whitelisted_reserve.rs:40-45
[PARTIAL]   ECON-043: Investor protection is the always-open withdrawal path; there is no timelock or multisig
                      requirement on the levers that re-price it.
              File: vault_config_operations.rs:101-121
              Impact: exit is always possible, but possibly at an admin-chosen price. See F-002.
              Fix: timelock; withdrawal minimum-out.
[FAIL-4]    ECON-044: Token-2022 transfer hooks are unhandled. See F-006.
              File: token_ops.rs:100-137
              Impact: a hook mint either bricks transfers or executes unvalidated code mid-transfer.
              Fix: reject TransferHook mints at init_vault.
[PARTIAL]   ECON-045: Fee-on-transfer tokens revert rather than being accounted.
              File: handler_deposit.rs:112-115
              Impact: fail-closed (no loss), but such a vault cannot function.
              Fix: delta-based credit, or explicit rejection at init with a clear error.
[PARTIAL]   ECON-046: Rebasing / interest-bearing mints are not detected.
              File: handler_init_vault.rs:101-104
              Impact: the vault prices in raw units throughout, so no mispricing arises — but the case is
                      unconsidered rather than deliberately safe.
              Fix: screen InterestBearingConfig at init.
[FAIL-4]    ECON-047: Freeze authority on the base mint is never checked. See F-006.
              File: handler_init_vault.rs:101-104
              Impact: the mint authority can freeze token_vault and block all withdrawals permanently.
              Fix: reject a non-None freeze authority, or record it on-chain.
[PASS]      ECON-048: The vault holds only its own base mint; supply inflation of that mint is the depositor's
                      chosen asset risk, not a protocol defect.
[PASS]      ECON-049: Decimals are read from the mint and stored at init — no hardcoded scale anywhere.
              File: handler_init_vault.rs:32, handler_deposit.rs:78
[N/A]       ECON-050: No native SOL handling — the program is SPL-only.
[PARTIAL]   ECON-051: Transaction cost scales with an admin-set reserve count. See F-003.
              File: vault_operations.rs:1015-1036
              Impact: exits may become unaffordable or impossible.
              Fix: per-instruction subsetting; MAX_ACTIVE_RESERVES; CU profiling.
[PARTIAL]   ECON-052: Batch operations (the mandatory refresh) can fail on compute at high reserve counts. See F-003.
              File: klend_operations.rs:62-104
              Impact: all user paths share the same batch, so there is no lighter alternative.
              Fix: as F-003.
[N/A]       ECON-053: No pay-investors batch instruction exists.
[PASS]      ECON-054: No per-user state accounts, so deposit spam cannot bloat program state.
[PASS]      ECON-055: vault_allocation_strategy is a fixed [VaultAllocation; 25]; no growable collection exists.
              File: state/vault_state.rs:49, :12
[PARTIAL]   ECON-056: An allocation cannot be removed while it holds cTokens, so an unexitable reserve pins its
                      slot and its per-transaction cost indefinitely. See F-003.
              File: state/vault_allocation.rs:46-49, state/vault_state.rs:317-333
              Impact: the vault's exit cost ratchets up and cannot ratchet down.
              Fix: allow forced removal after an evacuation attempt, or subset the refresh.
[N/A]       ECON-057: No price oracle is used by this program.
[PASS]      ECON-058: Staleness is enforced on every allocation reserve at the current slot.
              File: vault_operations.rs:1097-1104
[N/A]       ECON-059: No confidence interval — no oracle.
[PASS]      ECON-060: Nobody who benefits can move the pricing input — collateral_exchange_rate is klend
                      protocol state, not a vault-controlled value.
[N/A]       ECON-061: No oracle, so no fallback oracle applies.
[PARTIAL]   ECON-062: The trust assumption (pricing fully delegated to klend) is real and correct, but it is
                      documented nowhere in the repository.
              File: README.md:1-13, vault_operations.rs:1144-1164
              Impact: depositors cannot read the dependency from the code's own documentation.
              Fix: state the klend pricing dependency in README.md.
[N/A]       ECON-063: No reward_debt model — rewards drip linearly into token_available for all holders.
[N/A]       ECON-064: No per-position reward accounting exists.
[N/A]       ECON-065: No global reward accumulator divided by total_staked.
[N/A]       ECON-066: No per-position reward snapshot.
[N/A]       ECON-067: No acc_reward_per_share scaling — rewards are whole token units.
[PASS]      ECON-068: Rewards are backed by real deposits — rewards_available only grows via topup_rewards,
                      which transfers the tokens in and asserts the balance delta.
              File: vault_operations.rs:959-971, handler_topup_rewards.rs:36-44
[N/A]       ECON-069: No division by a stake denominator, so no zero-stake guard is needed;
                      first-depositor protection is covered by ECON-015/016.
[PASS]      ECON-070: refresh_rewards is called before reward_per_second is changed, so the new rate applies
                      only going forward.
              File: handler_update_vault_config.rs:41 then vault_config_operations.rs:258-267
[FAIL-4]    ECON-072: No aggregate outflow cap and no pausable circuit breaker. See F-005.
              File: lib.rs:32-218, vault_operations.rs:180-357
              Impact: only per-user limits exist; a bug- or mispricing-driven drain is unbounded.
              Fix: rolling per-window outflow accounting plus a guardian pause.
[N/A]       ECON-073: Unrealized PnL is not used as collateral — the vault has no borrowing.
[PARTIAL]   ECON-074: Per-reserve concentration caps exist (token_allocation_cap, ctoken_allocation_cap) but
                      deposit_cap defaults to u64::MAX and no protocol-wide counterparty cap exists.
              File: state/vault_allocation.rs:23, :25; vault_operations.rs:44
              Impact: a vault may be fully concentrated in one klend reserve.
              Fix: require a non-trivial deposit_cap and a maximum single-reserve share at config time.
[N/A]       ECON-075: No swap, so no gross-vs-net slippage base.
[N/A]       ECON-076: No swap input to base a fee on.
[PASS]      ECON-077: The withdrawal penalty is netted from proceeds via extra shares burned — never charged as
                      a separate lamport debit.
              File: vault_operations.rs:291-302
[PASS]      ECON-078: Quantities are unambiguously named — total_liquidity_for_user_with_penalty,
                      withdrawal_penalty, total_for_user, theoretical_amount_to_send_to_user_f.
              File: vault_operations.rs:207-302
[N/A]       ECON-079: No bonding curve or completion threshold.
[N/A]       ECON-080: No virtual/real reserve layers.
[N/A]       ECON-081: No curve configuration.
[FAIL-5]    ECON-082: available_crank_funds is a PDA-held balance with no withdrawal path. See F-001.
              File: vault_operations.rs:1593-1595 (only writer), :676-679 (only reader)
              Impact: depositor principal permanently unreachable by anyone.
              Fix: add an admin-gated sweep, or fold the residue into token_available.
[PASS]      ECON-083: Capped withdrawals track a running total — pending_fees_sf and rewards_available are both
                      decremented by the amount paid, so repeated calls cannot exceed the allocation.
              File: vault_operations.rs:429-434, :978-979
[PASS]      ECON-084: Liabilities are settled before residual value is priced — compute_aum subtracts
                      pending_fees and errors with AUMBelowPendingFees if they exceed assets.
              File: state/vault_state.rs:178-187
[N/A]       ECON-085: No TWAP accumulator in this program.
[N/A]       ECON-086: No accumulator to saturate.
[N/A]       ECON-087: No measurement window.
[N/A]       ECON-088: No TWAP consumer.
[FAIL-4]    ECON-089: No velocity breaker — no rolling outflow accounting and no guardian role separate from
                      the admin. See F-005.
              File: lib.rs:32-218
              Impact: a drain caused by a bug or by an upstream mispricing proceeds at full speed.
              Fix: per-window outflow cap plus a halt-only guardian key distinct from the admin.
```

**Checklist 06 tally — PASS 36 · FAIL 8 · PARTIAL 14 · N/A 31 · Total 89**

### Checklist 07 — OpSec & Governance (OPS-001 … OPS-085)

> `[UNKNOWN]` here means the evidence lives off-chain (a live `solana program show`, a multisig account fetch,
> a GitHub setting, or an organisational process). This engagement is static and read-only, so those items are
> recorded honestly rather than guessed (Rule 10). Each names the query that would settle it.

```
[UNKNOWN]   OPS-001: Current upgrade authority — requires `solana program show KvauGMspG5k6…`. Not statically knowable.
[UNKNOWN]   OPS-002: Whether the authority is a multisig — same query.
[UNKNOWN]   OPS-003: Multisig threshold — requires fetching the multisig account.
[UNKNOWN]   OPS-004: Signer identities — off-chain.
[UNKNOWN]   OPS-005: Hardware vs hot wallet custody — off-chain.
[FAIL-3]    OPS-006: No on-chain upgrade timelock exists in the program.
              File: lib.rs:32-218 (no timelock instruction), state/global_config.rs:18-26 (no delay field)
              Impact: any upgrade timelock is a policy convention, unverifiable by depositors.
              Fix: place the upgrade authority behind a timelock program (e.g. Squads with a time delay).
[UNKNOWN]   OPS-007: Whether a timelock is enforced or a policy — depends on the off-chain authority setup.
[FAIL-3]    OPS-008: The recommended 24–72 h DeFi upgrade timelock is not evidenced on-chain.
              File: lib.rs:32-218
              Impact: as OPS-006.
              Fix: as OPS-006.
[PARTIAL]   OPS-009: BPF-loader semantics allow the authority to rotate or revoke, but global_admin is snapshotted
                     from it once at init and never re-read.
              File: handler_initialize_global_config.rs:14-19
              Impact: rotating the program's upgrade authority does NOT rotate global_admin; that needs the
                      separate two-step update_global_config_admin handshake.
              Fix: document the decoupling; it is defensible but surprising.
[PARTIAL]   OPS-010: The program is upgradeable by design — init_global_config requires a live upgrade authority
                     and errors NoUpgradeAuthority without one.
              File: handler_initialize_global_config.rs:14-19, lib.rs:377-378
              Impact: immutability is incompatible with bootstrapping the global config as written.
              Fix: none required; record the reasoning.
[PASS]      OPS-011: Acknowledged — an upgradeable program can by definition be upgraded to drain funds;
                     the mitigations are multisig plus timelock, tracked under OPS-002/OPS-006.
[UNKNOWN]   OPS-012: Emergency-upgrade process — off-chain.
[PASS]      OPS-013: No hidden admin instruction. All 22 entrypoints enumerated and reviewed.
              File: lib.rs:32-218
[PASS]      OPS-014: No god-mode account — every privileged path reads its authority from program-owned state.
[PASS]      OPS-015: The only hardcoded pubkeys are the four cluster program IDs.
              File: program_id.rs:16-25
[PASS]      OPS-016: No dead callable handlers — `buy`/`sell` are documented aliases of deposit/withdraw.
              File: lib.rs:81-96, :105-112
[UNKNOWN]   OPS-017: IDL-vs-binary correspondence — no IDL is committed at this commit; requires the built artifact.
[PASS]      OPS-018: Fees can only go to a token account owned by the current vault admin; redirecting them
                     requires the two-step admin handover.
              File: handler_withdraw_pending_fees.rs:176-180, handler_update_admin.rs:18-27
[PASS]      OPS-019: The klend program ID cannot be changed — it is a compile-time Program<'info, KaminoLending>.
              File: handler_invest.rs:245, klend_operations.rs:96
[PASS]      OPS-020: Vault-admin change requires the incoming admin to sign, so it cannot be pushed unilaterally.
              File: handler_update_admin.rs:18-27
[PASS]      OPS-021: Shares cannot be minted without a matching deposit — mint_to is reachable only from the
                     deposit path with a formula-derived amount and a post-check.
              File: handler_deposit.rs:82-105
[PASS]      OPS-022: Shares cannot be burned without the holder's signature — burn uses the user as authority.
              File: token_ops.rs:49-59
[FAIL-4]    OPS-023: One `unsafe` block exists and carries no safety comment. See F-007.
              File: utils/cpi_mem.rs:145-153
              Impact: the invariant callers must uphold (no live borrow on a CPI-written account) is undocumented.
              Fix: add a SAFETY comment; restore the pre-flight borrow check.
[FAIL-4]    OPS-024: Raw pointer casts appear in an Anchor program. See F-007.
              File: utils/cpi_mem.rs:146-151 (`*const _ as *const u8`, four casts)
              Impact: bypasses the account-borrow consistency check that invoke_signed performs.
              Fix: as F-007.
[PASS]      OPS-025: declare_id! matches Anchor.toml and program_id.rs for the default `mainnet` feature.
              File: lib.rs:18, program_id.rs:27-28, Anchor.toml:6
[PARTIAL]   OPS-026: No verifiable-build configuration exists — no Docker recipe, no pinned build image,
                     no published artifact hash.
              File: Anchor.toml:1-11, repository root (no Dockerfile, no CI)
              Impact: the mainnet binary cannot be tied to this commit by a third party. Compounded by F-004.
              Fix: adopt `anchor build --verifiable`; publish the hash per release.
[UNKNOWN]   OPS-027: Deploy-keypair custody — off-chain.
[PARTIAL]   OPS-028: No key material is present in the tree, but .gitignore lacks the standard secret patterns.
              File: .gitignore:1-8 (no .env, .env.*, *.pem, *keypair*.json, id.json)
              Impact: no current exposure; the accident-prevention layer is missing.
              Fix: extend .gitignore.
[UNKNOWN]   OPS-029: Manager-wallet custody — off-chain.
[N/A]       OPS-030: No backend server in scope.
[N/A]       OPS-031: No backend server in scope.
[N/A]       OPS-032: No API keys in scope.
[N/A]       OPS-033: No API keys in scope.
[N/A]       OPS-034: No RPC configuration in scope.
[N/A]       OPS-035: No frontend in scope.
[PASS]      OPS-036: No secret was ever committed — 97 tracked files, all source/config; targeted scans for key
                     material, keypair arrays and PEM blocks across programs/ returned zero matches.
[UNKNOWN]   OPS-037: Multisig platform — off-chain.
[UNKNOWN]   OPS-038: Multisig threshold — off-chain.
[UNKNOWN]   OPS-039: Signer power distribution — off-chain.
[UNKNOWN]   OPS-040: Backup signers — off-chain.
[UNKNOWN]   OPS-041: Threshold-change risk — off-chain.
[UNKNOWN]   OPS-042: Proposal expiry — off-chain.
[UNKNOWN]   OPS-043: Multisig execution logging — off-chain.
[UNKNOWN]   OPS-044: Incident-response plan — none in the repository; may exist at the published policy URL.
[FAIL-4]    OPS-045: The program cannot be paused. See F-005.
              File: lib.rs:32-218, state/vault_state.rs:19-89
              Impact: a program upgrade is the only response lever.
              Fix: asymmetric breaker halting inflow only.
[PARTIAL]   OPS-046: A security policy URL is published; no bounty platform is named.
              File: lib.rs:25 (policy: github.com/Kamino-Finance/audits/blob/master/docs/SECURITY.md)
              Impact: responsible disclosure is possible; bounty terms are not discoverable on-chain.
              Fix: name the bounty program in security_txt! if one exists.
[PASS]      OPS-047: A security contact is published on-chain via solana-security-txt.
              File: lib.rs:21-30 (contacts: email:security@kamino.finance)
[PARTIAL]   OPS-048: Large value movements on the crank and fee paths emit no structured event to alert on.
                     See F-012.
              File: handler_invest.rs (no emit_cpi), handler_withdraw_pending_fees.rs (no emit_cpi)
              Impact: monitoring must poll account state rather than subscribe to events.
              Fix: add InvestResultEvent and PendingFeesWithdrawnEvent.
[UNKNOWN]   OPS-049: Upgrade-transaction alerting — off-chain monitoring configuration.
[PARTIAL]   OPS-050: Unusual-pattern alerting is limited by event coverage — deposits and withdrawals are
                     observable, configuration changes and crank activity are not. See F-012.
              File: events.rs:1-35
              Impact: 16 of 22 instructions are invisible to an event-driven monitor.
              Fix: as F-012.
[UNKNOWN]   OPS-051: War-room process — off-chain.
[UNKNOWN]   OPS-052: Post-mortem process — off-chain.
[PASS]      OPS-053: The complete list of on-chain time-locked actions is: min_invest_delay_slots (per reserve,
                     bypassable — see F-009). Nothing else is delayed. Enumerated and recorded.
              File: vault_operations.rs:578-580
[FAIL-3]    OPS-054: Program-upgrade timelock duration: none on-chain.
              File: lib.rs:32-218
              Impact: as OPS-006.
              Fix: external timelock program.
[FAIL-5]    OPS-055: Fee-change timelock duration: none. See F-002.
              File: vault_config_operations.rs:101-121
              Impact: fee and penalty changes take effect in the same transaction that sets them.
              Fix: pending_* fields with an effective-from timestamp.
[PARTIAL]   OPS-056: Manager-change timelock: none, but the handover is two-step and requires the incoming
                     admin to sign.
              File: vault_config_operations.rs:160-166, handler_update_admin.rs:18-27
              Impact: acceptance is a meaningful guard; a delay would be stronger.
              Fix: add a minimum delay between proposal and acceptance.
[FAIL-3]    OPS-057: Whitelist-change timelock: none — add_update_whitelisted_reserve takes effect immediately.
              File: handler_add_update_whitelisted_reserve.rs:12-33
              Impact: a reserve can be whitelisted and allocated to within one slot.
              Fix: timelock whitelist additions (removals should stay immediate).
[PASS]      OPS-058: The fee destination is not an independently mutable address — it is bound to the current
                     vault admin's own token account by token::authority.
              File: handler_withdraw_pending_fees.rs:176-180
[N/A]       OPS-059: No timelock exists, so no emergency bypass applies.
[PARTIAL]   OPS-060: A pending admin proposal can be cancelled by overwriting it, but there is no explicit
                     cancel instruction and no expiry — a pending admin can accept months later.
              File: vault_config_operations.rs:160-166, state/global_config.rs:47-51
              Impact: a stale proposal remains executable indefinitely.
              Fix: add an expiry timestamp to the pending-admin proposal.
[FAIL-3]    OPS-061: Users are not notified of pending changes — no event is emitted on any config write. See F-012.
              File: handler_update_vault_config.rs:47, vault_config_operations.rs:99-274 (msg! only)
              Impact: depositors cannot subscribe to changes that affect their position.
              Fix: VaultConfigUpdatedEvent via emit_cpi!.
[UNKNOWN]   OPS-062: Environment key separation — off-chain, though the code supports separate mainnet/staging/
                     devnet program IDs via mutually exclusive cargo features (program_id.rs:4-14).
[UNKNOWN]   OPS-063: Developer deploy access — off-chain.
[N/A]       OPS-064: No CI/CD pipeline exists at this commit (no .github/, no Makefile, no scripts/).
[N/A]       OPS-065: No servers in scope.
[N/A]       OPS-066: No database in scope.
[N/A]       OPS-067: No CI environment in scope.
[N/A]       OPS-068: No secret manager in scope.
[PASS]      OPS-069: The source is published under BUSL-1.1 with a 2029-05-20 change date.
              File: LICENSE, NOTICE:1-11
[UNKNOWN]   OPS-070: Source-to-binary correspondence — requires the deployed artifact. Blocked additionally by
                     the unpinned git dependencies (F-004) and the absent verifiable-build recipe (OPS-026).
[PARTIAL]   OPS-071: rustc is pinned (1.74.1) and Cargo.lock is committed, but three git dependencies carry no
                     rev and there is no reproducible build recipe. See F-004.
              File: rust-toolchain.toml:1-3, programs/kvault/Cargo.toml:41, :49-51, Cargo.toml:38-39
              Impact: the build is not reproducible from source alone.
              Fix: pin every git dependency by rev; add a verifiable-build recipe.
[UNKNOWN]   OPS-072: Git history integrity — requires the full upstream history; this working copy has 3 commits.
[UNKNOWN]   OPS-073: Branch protection — a GitHub-side setting, invisible to a static read. No .github/ exists
                     at this commit.
[N/A]       OPS-074: No CI pipeline exists to secure.
[FAIL-4]    OPS-075: Critical dependencies are not version-pinned. See F-004.
              File: programs/kvault/Cargo.toml:41, :49-51; Cargo.toml:38-39
              Impact: kamino_lending — the source of every share price — tracks a mutable branch pointer.
              Fix: pin by rev.
[N/A]       OPS-076: No stake accounts or Authorize instructions in this program.
[PARTIAL]   OPS-077: Admin instructions carry no version/epoch guard, so a durable-nonce pre-signed admin
                     transaction would remain valid indefinitely.
              File: handler_update_vault_config.rs:14-50, handler_update_admin.rs:5-16
              Impact: a pre-signed privileged transaction survives an authority migration.
              Fix: include a config version or epoch in the privileged instruction and bump it on rotation.
[PARTIAL]   OPS-078: Two-step admin rotation is implemented on both the vault and the global config, but no
                     rotation or critical path is timelocked.
              File: vault_config_operations.rs:160-166, handler_update_admin.rs:18-27,
                    state/global_config.rs:47-51, handler_update_global_config_admin.rs:14-22
              Impact: the SPOF is addressed; the delay is not. See F-002.
              Fix: add a timelock to the critical rotation and fee paths.
[PASS]      OPS-079: The fee account is validated for token-receiving capability (token::mint + token::authority)
                     and has an access-controlled sweep path (withdraw_pending_fees).
              File: handler_withdraw_pending_fees.rs:176-181, :98-110
[PARTIAL]   OPS-080: VaultConfigField is a tagged union (better than an Option that conflates unset with clear),
                     but fields are validated individually with no atomic whole-config check.
              File: vault_config_operations.rs:15-38, :94-276
              Impact: see F-014 (OPS-083).
              Fix: run a shared validate_vault_config_consistency after every write.
[UNKNOWN]   OPS-081: Live multisig threshold — requires fetching the on-chain multisig account.
[FAIL-4]    OPS-082: Nine admin numerics have no upper bound. See F-014.
              File: vault_config_operations.rs:122-127, :139-159, :206-217, :258-273;
                    handler_update_reserve_allocation.rs:101-108
              Impact: deposit lockout, crank lockout via weight-sum overflow, and F-001's stranded funds.
              Fix: require_gte! on every setter against a downstream-tolerable maximum.
[FAIL-4]    OPS-083: Interdependent values are never cross-validated. See F-014.
              File: vault_config_operations.rs:94-276 (per-field writes, no joint check)
              Impact: deposit_cap below min_deposit_amount, or weights summing past u64::MAX, are both accepted.
              Fix: atomic post-write consistency validation.
[PASS]      OPS-084: Every value that reaches a denominator is guarded — current_vault_aum > 0 (:167-170),
                     holdings_aum != 0 (:1119-1121), loop_weight > 0 (state/vault_state.rs:367),
                     total_weight + unallocated_weight > 0 when entered (state/vault_state.rs:348-358),
                     and Fraction::ONE - f cannot reach zero because penalty bps <= 1000
                     (vault_config_operations.rs:231-235, state/global_config.rs:65-74).
[UNKNOWN]   OPS-085: Signing-council legibility — a property of the multisig UI and process, off-chain.
```

**Checklist 07 tally — PASS 18 · FAIL 12 · PARTIAL 13 · N/A 14 · UNKNOWN 28 · Total 85**

### Checklist 08 — TypeScript Safety

```
[N/A]       TS-001 … TS-064: No TypeScript in the repository (0 of 97 tracked files), and checklist 08 is
                             outside `--scope program`. All 64 items render N/A from the scope gate.
```

### Checklist 09 — Backend Security

```
[N/A]       BE-001 … BE-131: No backend service in the repository; outside `--scope program`. 131 items N/A.
```

### Checklist 10 — Frontend Security

```
[N/A]       FE-001 … FE-084: No frontend in the repository; outside `--scope program`. 84 items N/A.
```

### Checklist 11 — Supply Chain

```
[N/A]       SC-001 … SC-052: Outside `--scope program`. 52 items N/A from the gate.
                             Dependency-pinning defects that bear directly on program build integrity were
                             still evaluated, under OPS-071 / OPS-075 (checklist 07) and reported as F-004.
```

### Checklist 12 — Secrets & Key Management

```
[N/A]       SEC-001 … SEC-053: Outside `--scope program`. 53 items N/A from the gate.
                               An in-tree secret scan was still run, under OPS-028 / OPS-036 and KV-001:
                               zero key material, zero secret files ever tracked.
```

### Checklist 13 — Deployment & Infrastructure

```
[N/A]       DEP-001 … DEP-089: Outside `--scope program`. 89 items N/A from the gate.
```

### Checklist 14 — Python Safety

```
[N/A]       PY-001 … PY-082: No Python in the repository; outside `--scope program`. 82 items N/A.
```

### Checklist 15 — General Language Safety

```
[N/A]       GL-001 … GL-088: The only language present is Rust, which has dedicated coverage in checklists
                             01–07 and 16. Outside `--scope program`. 88 items N/A.
```

### Checklist 16 — Formal Verification & Testing (FV-001 … FV-072)

> Coverage note: `programs/kvault` contains **no tests** — no `tests/` directory and no `#[cfg(test)]` module
> in any of its 46 files. The only tests in the repository live in `libs/kvault-interface/tests/` (10 files,
> 1,800 lines, ~25 `#[test]` functions), which is outside `--scope program`. That suite was **enumerated but
> not code-reviewed**, solely so that checklist 16 — whose subject is the test suite itself — could be answered
> from evidence rather than from silence. Verdicts below say which basis applies.

```
[PARTIAL]   FV-001: Critical invariants are encoded as runtime assertions but documented nowhere.
              File: vault_checks.rs:69-262 (conservation, disinvest, share-burn equality);
                    vault_operations.rs:906 (fees <= aum); state/vault_state.rs:182-184 (aum >= pending_fees)
              Impact: the invariants are real and enforced, but a reader must reverse-engineer them.
              Fix: an INVARIANTS.md listing each property and the code that enforces it.
[PARTIAL]   FV-002: Properties are encoded as require!/require_eq! at runtime, not as property-based tests.
              File: vault_checks.rs:38-66, :97-131, :212-259
              Impact: the assertions run only on paths an execution actually takes.
              Fix: lift them into proptest/Trident properties over generated state.
[FAIL-4]    FV-003: No proof or exhaustive test exists for the arithmetic identities the protocol relies on
                    (share mint/burn round-trip, fee conservation, allocation-sum closure).
              File: vault_operations.rs:1110-1127, :1533-1546; state/vault_state.rs:335-447
              Impact: rounding-direction correctness is argued, never demonstrated.
              Fix: property tests asserting round-trip non-profitability and allocation-sum closure.
[FAIL-3]    FV-004: No state-transition specification exists.
              File: repository root (no spec, no INVARIANTS.md)
              Impact: reviewers must infer the intended lifecycle from handlers.
              Fix: document the deposit/withdraw/invest/fee state machine.
[FAIL-4]    FV-005: No model checking or fuzzing — no reachable-state exploration of any kind.
              File: repository root (no fuzz/, no proptest, no Trident, no Kani)
              Impact: exactly the class of defect F-008 and F-014 represent goes undetected.
              Fix: cargo-fuzz or Trident targets on the accounting helpers.
[PARTIAL]   FV-006: Token conservation is asserted per instruction at runtime but never verified across paths.
              File: vault_checks.rs:97-131, :163-191, :212-241
              Impact: strong per-transaction guarantees; no cross-path proof.
              Fix: a conservation property over generated instruction sequences.
[PARTIAL]   FV-007: Authority properties hold by construction (Anchor Signer + has_one) but no test asserts
                    that an unauthorized caller is rejected.
              File: libs/kvault-interface/tests/integration/ (no negative-authorization test)
              Impact: a regression that drops a has_one would not fail the suite.
              Fix: a wrong-signer test per privileged instruction (see FV-064).
[FAIL-3]    FV-008: No liveness analysis — F-003 is precisely a liveness gap that no artifact examines.
              File: vault_operations.rs:1015-1036
              Impact: "can every depositor always exit?" is unanswered.
              Fix: CU profiling across reserve counts; an exit-always-possible property.
[N/A]       FV-009: No formal specification exists to drift from.
[N/A]       FV-010: No proof claims are made.
[N/A]       FV-011: No formal verification properties exist.
[N/A]       FV-012: No verification results to report.
[FAIL-5]    FV-013: No static analysis in CI — there is no CI at this commit.
              File: repository root (no .github/, no Makefile, no scripts/)
              Impact: clippy, cargo-audit and semgrep never run automatically.
              Fix: a GitHub Actions workflow running clippy -D warnings, cargo audit, and the test suite.
[N/A]       FV-014: No static analysis tool runs, so there are no findings to triage.
[FAIL-3]    FV-015: No custom lint configuration — no clippy.toml, no deny list for unwrap/panic in program code.
              File: repository root
              Impact: the reachable unwrap/expect/panic sites in F-008 and the Notes list are unpoliced.
              Fix: clippy.toml denying unwrap_used/expect_used/panic in programs/.
[FAIL-3]    FV-016: No zero-warning policy — warnings are not treated as errors anywhere.
              File: repository root (no CI to enforce it)
              Impact: the KV-111 stack-offset warning class would be easy to miss.
              Fix: `cargo clippy --all-targets -- -D warnings` in CI.
[FAIL-3]    FV-017: No security-focused rulesets enabled (no clippy::pedantic, no semgrep rules).
              File: repository root
              Impact: arithmetic and panic lints that would catch F-008 are off.
              Fix: enable clippy::pedantic selectively on programs/.
[FAIL-3]    FV-018: Dead code is present and unflagged.
              File: utils/consts.rs:20 (SECONDS_PER_YEAR_U64), :33 (MAX_REWARDS_STALENESS_FOR_FEE_UPDATE),
                    lib.rs:407-408 (RewardsStaleForFeeUpdate), lib.rs:420 (KaminoVaultResult)
              Impact: two of the four describe a security guard that is not implemented. See F-011.
              Fix: `#![deny(dead_code)]` plus removal.
[FAIL-5]    FV-019: No dependency vulnerability scanning — cargo-audit / cargo-deny are absent.
              File: repository root, Cargo.toml
              Impact: transitive advisories go unnoticed; compounded by the unpinned git deps of F-004.
              Fix: cargo audit + cargo deny in CI.
[FAIL-5]    FV-020: No SAST covers the only production language in the repository.
              File: repository root
              Impact: no automated analysis runs over 6,833 lines of on-chain Rust.
              Fix: clippy + semgrep rules for Solana anti-patterns.
[PARTIAL]   FV-021: One crate-wide suppression carries no justification.
              File: lib.rs:1 (#![allow(clippy::result_large_err)])
              Impact: minor; the suppression is plausible for Anchor but unexplained.
              Fix: add a one-line rationale.
[N/A]       FV-022: No static-analysis configuration files exist to version-control.
[FAIL-3]    FV-023: No fuzzing of deserialization — VaultState is a 62,544-byte zero-copy struct decoded
                    from account data on every instruction.
              File: state/vault_state.rs:17-89
              Impact: malformed-input behaviour is unexplored.
              Fix: cargo-fuzz target over VaultState/GlobalConfig byte inputs.
[FAIL-4]    FV-024: No fuzz targets on instruction handlers.
              File: repository root
              Impact: 22 handlers, zero fuzz coverage on a live mainnet vault.
              Fix: Trident targets over deposit/withdraw/invest sequences.
[N/A]       FV-025: No fuzz corpus exists.
[N/A]       FV-026: No fuzz campaigns have been run.
[N/A]       FV-027: No fuzzing crashes to triage.
[N/A]       FV-028: No differential fuzzing target exists.
[FAIL-4]    FV-029: Arithmetic edge cases (MAX, MIN, 0, 1, near-overflow) are not fuzzed — F-008 and F-014 are
                    exactly what such a campaign surfaces.
              File: vault_operations.rs:62-68, state/vault_state.rs:335-342
              Impact: the unchecked-arithmetic sites are untested at their boundaries.
              Fix: boundary-value fuzzing of the accounting helpers.
[N/A]       FV-030: No API endpoints in scope.
[N/A]       FV-031: No serialization round-trip fuzzing exists.
[N/A]       FV-032: No fuzzing infrastructure to document.
[FAIL-3]    FV-033: Test coverage is not measured — no tarpaulin, llvm-cov, or lcov configuration.
              File: repository root
              Impact: coverage of the audited crate is, by inspection, zero.
              Fix: cargo-llvm-cov with a reported threshold.
[FAIL-4]    FV-034: Critical paths do not approach 90 % branch coverage — each has roughly one happy-path test
                    in an out-of-scope crate.
              File: libs/kvault-interface/tests/integration/test_deposit.rs (2 tests),
                    test_withdraw.rs (3), test_invest.rs (1), test_redeem.rs (1)
              Impact: the branch space of deposit/withdraw (caps, minimums, rounding, partial fills) is unexercised.
              Fix: branch-targeted tests per handler.
[FAIL-4]    FV-035: Unit tests do not exist for every instruction — roughly 8 of 22 are exercised at all, and
                    `programs/kvault` itself contains no test module.
              File: programs/kvault/src/** (no #[cfg(test)]), libs/kvault-interface/tests/integration/
              Impact: 14 instructions — including every admin path — have no test of any kind.
              Fix: a test per instruction, starting with the privileged ones.
[PARTIAL]   FV-036: Multi-step workflows exist — deposit → invest → withdraw is covered.
              File: libs/kvault-interface/tests/integration/test_withdraw.rs:119 (test_withdraw_after_invest)
              Impact: one sequence is covered; fee accrual, redeem-in-kind after invest, and config changes
                      mid-lifecycle are not.
              Fix: extend to fee and configuration sequences.
[FAIL-4]    FV-037: No edge-case tests — zero amounts, u64::MAX, empty allocations, single-share vaults.
              File: libs/kvault-interface/tests/integration/
              Impact: the guards at vault_operations.rs:116-118, :212-215, :308-310 are never exercised.
              Fix: boundary tests per guard.
[FAIL-5]    FV-038: No negative tests for unauthorized callers or invalid states. The only negative tests in the
                    repository are two deserialization cases.
              File: libs/kvault-interface/tests/integration/test_from_account_data.rs:110 (wrong_discriminator),
                    :122 (truncated_data)
              Impact: the entire access-control surface (checklist 02) is unverified by execution — a dropped
                      has_one would pass CI, if CI existed.
              Fix: a rejection test per privileged instruction.
[N/A]       FV-039: No prior-bug list exists in the repository to regress against.
[FAIL-4]    FV-040: Tests do not run in CI — there is no CI.
              File: repository root
              Impact: nothing prevents a merge that breaks the suite.
              Fix: GitHub Actions running the suite on every PR.
[PARTIAL]   FV-041: The LiteSVM harness loads the real compiled program, so the runtime matches; the mainnet
                    feature set and cluster state do not.
              File: libs/kvault-interface/tests/integration/setup.rs
              Impact: reasonable fidelity for logic; not for cluster-specific behaviour.
              Fix: add a Surfpool mainnet-fork case for the klend integration.
[N/A]       FV-042: No skipped or ignored tests exist.
[N/A]       FV-043: Mutation testing has never been run.
[N/A]       FV-044: No endpoints to load-test; the analogous concern (CU cost) is FV-067 and F-003.
[PASS]      FV-045: No hardcoded secrets, private keys, or real credentials appear in the test suite — the
                    scan under OPS-036 covered the whole tree.
[PASS]      FV-046: Tests are deterministic — LiteSVM is in-process with controlled state.
              File: libs/kvault-interface/tests/integration/setup.rs
[PASS]      FV-047: Every CPI result is explicitly handled — `?` propagation on all 12 CPI sites, none discarded.
              File: klend_operations.rs:103, :149, :200, :246, :292; token_ops.rs:37, :59, :113, :137
[N/A]       FV-048: On-chain errors carry no paths, versions, or stack traces to leak.
[PARTIAL]   FV-049: Several panics are reachable from user input rather than being converted to typed errors.
              File: vault_operations.rs:68 (underflow), :1048 (.unwrap on FatAccountLoader), :1715 (.unwrap on
                    in_reserve), utils/fraction_utils.rs:19 (.expect)
              Impact: opaque "program panicked" failures instead of KaminoVaultError codes. See F-008.
              Fix: convert to typed errors.
[N/A]       FV-050: No HTTP status semantics on-chain.
[N/A]       FV-051: Resource exhaustion is the runtime's concern; the program-side analogue is F-003.
[N/A]       FV-052: No external calls with unbounded waits — CPIs are synchronous.
[PASS]      FV-053: Partial failure is impossible — Solana transaction atomicity rolls back the whole instruction.
[PASS]      FV-054: No error is silently swallowed; every Result is propagated or matched.
[PASS]      FV-055: 60+ specific error variants, all with #[msg] descriptions — no generic ProgramError returns.
              File: lib.rs:223-418
[PASS]      FV-056: Error handling is exhaustive — every match over VaultConfigField, UpdateGlobalConfigMode,
                    UpdateReserveWhitelistMode and InvestingDirection covers all variants with no wildcard arm.
              File: vault_config_operations.rs:46-90, :100-274
[FAIL-4]    FV-057: No circuit breaker or fallback for the klend dependency. See F-005.
              File: vault_operations.rs:1144-1164
              Impact: a klend pricing defect propagates straight into share pricing with no bound.
              Fix: rate-of-change bound on the exchange rate; guardian halt.
[FAIL-3]    FV-058: Exceptional financial conditions abort via panic on several paths rather than being blocked
                    by a typed guard.
              File: vault_operations.rs:68, :66; state/vault_state.rs:337-342, :355-358
              Impact: overflow-checks makes the failure safe but illegible. See F-008, F-014.
              Fix: checked arithmetic with typed errors.
[PASS]      FV-059: An in-process SVM suite exists and loads the actual compiled program rather than a mock.
              File: libs/kvault-interface/tests/litesvm_integration.rs,
                    libs/kvault-interface/tests/integration/setup.rs
[FAIL-3]    FV-060: The one time-gated instruction is not tested on both sides.
              File: vault_operations.rs:578-580 (min_invest_delay_slots), no corresponding test
              Impact: neither the InvestTooSoon rejection nor the post-delay success is exercised — and the
                      bypass in F-009 would have been caught by such a pair.
              Fix: before/after tests around the delay.
[PARTIAL]   FV-061: Slot/clock control is used in the refresh tests but not for the time-gated logic.
              File: libs/kvault-interface/tests/integration/test_refresh.rs, setup.rs
              Impact: fee accrual over time and the invest delay are never warped.
              Fix: warp_to_slot / set_sysvar(Clock) tests for charge_fees and min_invest_delay_slots.
[N/A]       FV-062: No account-closure path exists to verify.
[FAIL-4]    FV-063: Re-initialization is not tested — no double-init case for init_vault or init_global_config.
              File: libs/kvault-interface/tests/integration/
              Impact: the #[account(zero)] and `init` guards are unverified by execution.
              Fix: a double-init test asserting failure for both.
[FAIL-5]    FV-064: Authorization negatives are untested — no wrong-signer or missing-signer case exists
                    anywhere in the suite.
              File: libs/kvault-interface/tests/integration/
              Impact: the highest-value control surface in the program has zero executable verification.
              Fix: per-instruction wrong-signer rejection tests.
[FAIL-4]    FV-065: Arithmetic edge cases are not exercised through the SVM.
              File: libs/kvault-interface/tests/integration/test_deposit.rs, test_withdraw.rs
              Impact: F-008's underflow reproduces in one line of test code that does not exist.
              Fix: zero/max/below-minimum deposit and withdrawal tests.
[PASS]      FV-066: Token balances are asserted with explicit assert_eq! after transfer paths, not merely
                    "transaction succeeded".
              File: libs/kvault-interface/tests/integration/test_deposit.rs, test_withdraw.rs
[FAIL-3]    FV-067: No CU profiling baseline exists for any instruction — directly relevant to F-003, whose
                    magnitude is unquantified precisely because this artifact is missing.
              File: libs/kvault-interface/tests/integration/
              Impact: nobody can say how many reserves a withdrawal supports.
              Fix: record CU for init/deposit/withdraw/invest at N = 1, 5, 10, 15, 20, 25 reserves.
[UNKNOWN]   FV-068: Blockhash handling across multi-transaction tests — determinable only by reading the
                    out-of-scope suite in detail, which this engagement's scope excludes.
[FAIL-3]    FV-069: Failure-path result handling cannot be assessed because the suite contains no failure-path
                    tests to inspect (see FV-038, FV-064).
              File: libs/kvault-interface/tests/integration/
              Impact: no `assert!(result.is_err())` pattern exists anywhere.
              Fix: add failure-path tests asserting the specific InstructionError.
[PARTIAL]   FV-070: Test PDA derivations come from the SDK's own pda module, which mirrors the on-chain seeds —
                    but the mirroring is by convention, not by a shared constant.
              File: libs/kvault-interface/src/pda.rs vs programs/kvault/src/utils/consts.rs:1-8
              Impact: a seed change in one and not the other would not fail the build.
              Fix: have the SDK depend on the program crate's consts.
[FAIL-4]    FV-071: No Solana-appropriate verification tool is used — no Trident, Crucible, Riverguard,
                    Certora CVL, or Kani — for a mainnet vault whose share math is the product.
              File: repository root, Cargo.toml
              Impact: the risk profile (high-value DeFi arithmetic) calls for equivalence or invariant proving;
                      the suite is ~10 happy-path integration tests.
              Fix: Trident for stateful sequences; Certora CVL or Kani for the share-math identities.
[FAIL-3]    FV-072: The suite does not exercise the current transaction format — no v1 coverage, no
                    ComputeBudget no-op cases, no 4,096-byte transaction test.
              File: libs/kvault-interface/tests/integration/setup.rs
              Impact: forward-compatibility with the v1 gate is unverified. Low direct risk here — the program
                      performs no ComputeBudget introspection (AV-089) and has no fee-sponsor role (KV-135).
              Fix: run the suite under a v1-gated runtime once available.
```

**Checklist 16 tally — PASS 9 · FAIL 30 · PARTIAL 10 · N/A 22 · UNKNOWN 1 · Total 72**

### Checklist 17 — Logging, Monitoring & Incident Response

```
[N/A]       LM-001 … LM-065: Outside `--scope program`. 65 items N/A from the gate.
                             On-chain event-emission gaps were still evaluated, under SM-047 / SM-048 / SM-050
                             and OPS-048 / OPS-050 / OPS-061, and reported as F-012.
```

### Checklist 18 — Privacy, Compliance & Change Management

```
[N/A]       PC-001 … PC-060: Outside `--scope program`. 60 items N/A from the gate.
                             No PII is handled (on-chain pubkeys only) and no `.github/` exists at this commit.
```

### Checklist 19 — AI Agent Security

```
[N/A]       AI-001 … AI-033: No `.mcp.json`, no agent SDK, no LLM dependency, no prompt-handling code.
                             Outside `--scope program`. 33 items N/A.
                             Note: the untracked `AUDITOR/` directory contains an auditor corpus but is NOT
                             part of commit 1d146d70. It was treated as data, never as instructions; a scan of
                             the audited tree for reviewer-directed text returned zero matches.
```

### Checklist 20 — Rust Off-Chain Services

```
[N/A]       RS-001 … RS-021: `libs/kvault-interface` is `.rs` outside `programs/` and would trigger this
                             checklist under FULL scope, but `--scope program` excludes it. 21 items N/A.
                             Recommended for a follow-up engagement (see §9).
```

### Known Vector Results (KV-001 … KV-136)

> In-scope vectors were loaded per `known-vectors/INDEX.md` "Load when (markers)": `always (<phase>)` vectors
> were opened and evaluated unconditionally; feature-specific vectors were opened when their markers were
> present in the program tree and rendered `[N/A — feature absent: <marker>]` from the gate when every marker
> was provably absent. `[N/A — out of scope]` verdicts derive from the `--scope program` gate without reading
> the vector file (Rule 0).

```
[PARTIAL]   KV-001: Private Key Leak — steps 1–6 pass (no key material, no keypair arrays, no base58 secrets,
                    no secret file ever tracked, none tracked now); step 7 fails.
              File: .gitignore:1-8 — lacks .env, .env.*, *.pem, *keypair*.json, id.json
              Impact: no current exposure; the accident-prevention layer is absent.
              Fix: extend .gitignore; add a gitleaks pre-commit hook.
[PASS]      KV-002: Flash Loan Price Manipulation — no price is derived from a pool or balance. AUM =
                    vault.token_available (internal accounting) + klend collateral_exchange_rate.
              File: vault_operations.rs:1383-1385, :1144-1164
[PASS]      KV-003: Reentrancy (CPI) — checks-effects-interactions on every path; every CPI target is
                    compile-time pinned; no remaining_account is ever invoked.
              File: vault_operations.rs:335-348 before handler_withdraw.rs:277; klend_operations.rs:96, :144
[PASS]      KV-004: Missing Access Control — every mutating instruction has a Signer bound to stored state;
                    the three permissionless paths are value-bounded by post-transfer assertions.
              File: §6 Instruction Matrix; vault_checks.rs:69-262
[N/A]       KV-005: Oracle Manipulation — feature absent: no `pyth`, `switchboard`, `oracle`, `get_price` or
                    `PriceUpdate` in programs/. The reserve refresh explicitly sets skip_price_updates: true.
              File: klend_operations.rs:99
[PASS]      KV-006: First Depositor / Share Inflation — 1,000 dead shares are seeded at init; mul-before-div
                    with a ceil'd denominator; first deposit is 1:1.
              File: handler_init_vault.rs:47-53, vault_operations.rs:1123-1126
[N/A]       KV-007: MEV Sandwich — feature absent: no swap, route, or slippage path in this program.
                    (The related exit-pricing concern is tracked under KV-028 and F-002.)
[PARTIAL]   KV-008: Rug Pull / Admin Backdoor — no vault-drain path, no arbitrary mint, no pause to abuse, no
                    hardcoded admin. But fees/penalties change instantly (F-002) and upgrade custody is
                    off-chain (KV-091).
              File: vault_config_operations.rs:101-121, handler_withdraw_pending_fees.rs:143-151
              Impact: admin powers are bounded but un-timelocked.
              Fix: timelock; verify multisig custody.
[PASS]      KV-009: Unchecked CPI Target — every target is Program<'info, T> or the hardcoded kamino_lending::id().
              File: klend_operations.rs:96, :144, :195, :241, :287; handler_deposit.rs:163-165
[PASS]      KV-010: PDA Confusion / Type Cosplay — all state uses Anchor discriminators; each PDA family has a
                    unique seed prefix; accounts are typed throughout.
              File: utils/consts.rs:1-8, state/*.rs
[FAIL-3]    KV-011: Integer Overflow / Underflow — bare +, −, * on financial fields; overflow-checks converts a
                    wrap into an abort, not a typed error. See F-008, F-014.
              File: vault_operations.rs:66-68, :1388-1394, :1548-1595
              Impact: opaque panics on user input rather than KaminoVaultError codes.
              Fix: checked_* with the existing typed errors.
[PASS]      KV-012: Arithmetic Rounding Exploit — mul-before-div everywhere, U256/Fraction intermediates, and
                    every rounding direction favours the vault (mint floors, burn ceils, payout floors).
              File: fraction_utils.rs:9-20, vault_operations.rs:1123-1126, :1539-1545, :1425
[PASS]      KV-013: Missing Signer Check — every mutation carries a Signer linked to on-chain authority via
                    has_one or an explicit key comparison.
              File: §6 Instruction Matrix
[PARTIAL]   KV-014: Account Reinitialization — two init_if_needed uses, both admin-gated, both re-validated by
                    Anchor constraints rather than by an explicit initialized flag.
              File: handler_update_reserve_allocation.rs:135, handler_add_update_whitelisted_reserve.rs:50
              Impact: correct today; depends on constraint coverage staying complete.
              Fix: add an explicit state check on the pre-existing branch.
[PASS]      KV-015: Unchecked Account Owner — every deserialized account is typed (Anchor owner check), and
                    remaining-account reserves are additionally pinned by pubkey against the allocation table.
              File: vault_operations.rs:1048, :1067
[PASS]      KV-016: Token Account Mismatch — token::mint and token::authority on every user-facing account;
                    vault accounts bound by has_one or PDA seeds; transfer_checked binds mint and decimals.
              File: handler_deposit.rs:151-161, token_ops.rs:100-137
[PASS]      KV-017: Vault Donation Attack — share price never reads token_vault.amount. Direct transfers into
                    the vault are invisible to pricing.
              File: vault_operations.rs:1383-1385
[PARTIAL]   KV-018: Fee-on-Transfer Token Exploit — transfer_checked is used and the post-transfer equality
                    check rejects short credits, so no over-credit is possible. Deposits simply revert.
              File: handler_deposit.rs:112-115
              Impact: fail-closed rather than accounted. See F-006.
              Fix: delta-based credit if transfer-fee mints are to be supported.
[FAIL-4]    KV-019: Freeze Authority Griefing — the base mint's freeze authority is never checked and there is
                    no recovery path for a frozen vault account. See F-006.
              File: handler_init_vault.rs:101-104
              Impact: an untrusted mint authority can lock all withdrawals permanently.
              Fix: reject a non-None freeze authority, or record it on-chain for depositors.
[UNKNOWN]   KV-020: Program Upgrade Hijack — requires `solana program show` plus explorer verification.
                    Statically: no upgrade-authority keypair is in the repository (OPS-036 PASS), no on-chain
                    timelock exists (OPS-006 FAIL-3), and the program is not reproducibly buildable (F-004).
[N/A]       KV-021: Governance Attack — feature absent: no realm, proposal, spl-governance, vote_record or
                    voter_weight anywhere in programs/.
[N/A]       KV-022: Bridge Exploit — feature absent: no guardian, vaa, emitter, verify_signatures or attestation.
[FAIL-4]    KV-023: Token-2022 Transfer Hook Attack — arbitrary Token-2022 mints are accepted and hooks are
                    neither resolved nor rejected. See F-006.
              File: handler_init_vault.rs:101-104, token_ops.rs:100-137
              Impact: a hook mint bricks transfers or runs unvalidated code mid-transfer.
              Fix: reject TransferHook at init_vault.
                    Mitigating factor: state is always written before the transfer CPI, so a re-entrant hook
                    cannot double-spend (vault_operations.rs:335-348).
[PARTIAL]   KV-024: Stale/Missing Account Close — nothing is ever closed: vault_state (62,552 bytes),
                    ctoken_vaults, and whitelist entries all hold rent permanently.
              File: lib.rs:32-218 (no close instruction), state/vault_state.rs:317-333
              Impact: rent is locked; no stale-reference risk, since nothing is closed and revived.
              Fix: an admin-gated close for fully-wound-down vaults and emptied ctoken_vaults.
[FAIL-5]    KV-025: Compute Budget Exhaustion DoS — every user instruction refreshes the full allocation set
                    (up to MAX_RESERVES = 25) with no subsetting and no lighter exit path. See F-003.
              File: vault_operations.rs:1015-1036, klend_operations.rs:62-104, state/vault_state.rs:12
              Impact: the vector's own heuristic (~50k CU per reserve against a 1.4M ceiling) places 25 reserves
                      at or past the limit before the instruction's own work is counted. Bounded loop, unbounded
                      per-iteration cost.
              Fix: per-instruction subsetting; MAX_ACTIVE_RESERVES; CU profiling baseline.
[PASS]      KV-026: PDA Seed Collision — six PDA families, each with a unique literal prefix plus its parent
                    key(s); no two types share a seed pattern.
              File: utils/consts.rs:1-8
[PASS]      KV-027: Missing Discriminator Check — Anchor discriminators throughout. The one try_from_unchecked
                    read runs only after the checked try_from pass has pinned the same accounts by pubkey.
              File: vault_operations.rs:1027 then klend_operations.rs:81-86
[PARTIAL]   KV-028: Front-Running Transaction — deposits have min_shares_out; no withdrawal entrypoint accepts
                    a minimum-out. See F-002.
              File: lib.rs:73-79 vs :98-112, :212-217
              Impact: an exit can be re-priced by an admin transaction ordered ahead of it.
              Fix: withdraw_with_min_amount_out.
[PASS]      KV-029: Withdraw-Before-Update Race — reserves are CPI-refreshed and slot-staleness-checked inside
                    the same transaction that prices the withdrawal; there is no stored NAV to go stale.
              File: vault_operations.rs:1028-1033, :1097-1104, :200-211
[PASS]      KV-030: Infinite Mint / Uncapped Supply — mint authority is the base_vault_authority PDA,
                    shares_to_mint is formula-derived and never user-supplied, minting is self-limiting
                    (proportional to the deposit), and the minted delta is asserted post-hoc.
              File: handler_init_vault.rs:111, vault_operations.rs:97-101, handler_deposit.rs:102-105
                    (step 5 — mint events — passes on the deposit path only; see F-012)
[N/A]       KV-031 … KV-055: Backend / API vectors — out of scope: `--scope program`; no backend in repository.
[N/A]       KV-056 … KV-075: Frontend / client-side vectors — out of scope: `--scope program`; no frontend.
[N/A]       KV-076 … KV-090: DevOps / supply-chain vectors — out of scope: `--scope program`.
[UNKNOWN]   KV-091: Upgrade Authority Not Secured — step 1 requires `solana program show`, unavailable to a
                    static review. Step 3 PASSES: no upgrade-authority keypair or hardcoded authority exists in
                    the repository. Steps 2 and 4 are undetermined; the intake records the custody type as
                    unknown and treats it as a stated assumption (§11-D).
[N/A]       KV-092 … KV-100: DevOps vectors — out of scope: `--scope program`.
[PASS]      KV-101: Sysvar Spoofing — Clock::get() at all 12 time reads; the Instructions sysvar is pinned by
                    `address = sysvar::instructions::ID`; no sysvar is read from an unchecked account.
              File: handler_withdraw.rs:103, handler_invest.rs:250, handler_withdraw_pending_fees.rs:203
[N/A]       KV-102: Precompile Signature Bypass — feature absent: no ed25519/secp256k1 precompile use and no
                    introspection-based signature verification.
[PASS]      KV-103: Address Lookup Table Manipulation — no positional trust anywhere. Every privileged account
                    is bound by has_one, seeds, address, or an explicit key comparison; remaining accounts are
                    pinned by pubkey against the allocation table. `vault_lookup_table` is stored metadata and
                    is never read for authorization.
              File: vault_operations.rs:1067, state/vault_state.rs:66
[PARTIAL]   KV-104: Non-Canonical Bump — all derivations use canonical bumps (Anchor bare `bump` /
                    find_program_address); base_vault_authority_bump is stored and reused for signing. But
                    ctoken_vault_bump is stored and never consumed, so that constraint re-derives each call.
              File: state/vault_allocation.rs:24, handler_invest.rs:219, handler_withdraw.rs:88
              Impact: CU waste only — no shadow PDA is possible, since Anchor's bare bump is canonical.
              Fix: consume the stored bump.
[FAIL-4]    KV-105: Token-2022 Extension Abuse — sub-vectors (a) PermanentDelegate and (b) FreezeAuthority /
                    DefaultAccountState::Frozen are unmitigated; (c) TransferHook is unhandled; (d) TransferFee
                    is fail-closed by the equality post-check. See F-006.
              File: handler_init_vault.rs:101-104, token_ops.rs:100-137, handler_deposit.rs:112-115
              Impact: a vault on a hostile Token-2022 mint can be drained or frozen by the mint authority
                      without touching this program.
              Fix: get_extension screening at init_vault, or a mint allowlist.
[N/A]       KV-106: Account Revival / Zombie After Close — feature absent: no `close` constraint, no manual
                    close, no lamport manipulation anywhere in programs/.
[N/A]       KV-107: Fake / Non-Canonical ATA — feature absent: the program deliberately does not assume
                    canonical ATAs. Destinations are bound by token::mint + token::authority, which is the
                    correct posture for a vault that must accept any of a user's token accounts.
[PASS]      KV-108: Token Decimals & Cross-Mint Confusion — single-mint vault; decimals read from the mint at
                    init and used via transfer_checked; cTokens transfer with their own mint's decimals;
                    no cross-mint raw-amount arithmetic exists.
              File: handler_init_vault.rs:32, handler_withdraw.rs:338, handler_redeem_in_kind.rs:104
[N/A]       KV-109: Pinocchio / p-token Missing Validation — framework mismatch: this is an Anchor program;
                    Anchor supplies the owner, discriminator, signer and mut checks the vector concerns.
[N/A]       KV-110: Agent Wallet Custody — out of scope: `--scope program`; no agent component.
[PARTIAL]   KV-111: BPF Stack Frame Overflow DoS — mitigations are visible in source: every sizable account
                    field is Box'd (handler_deposit.rs:136-161, handler_invest.rs:195-243), the 62 KB Holdings
                    and Invested buffers are heap-allocated via Box (vault_operations.rs:1266-1269), helpers
                    take references, and hot paths are marked #[inline(never)] (:49, :179, :359, :504, :537, :705).
              File: vault_operations.rs:1266-1269, :49, :179
              Impact: step 1 of the procedure (grep the build for "exceeded max offset of 4096") could not be
                      run — building is outside this engagement's mandate. Source-level evidence is good; the
                      build-level confirmation is missing.
              Fix: run `anchor build 2>&1 | grep -i "exceeded max offset"` and record a clean result per release.
[N/A]       KV-112 … KV-117: Off-chain Rust and AI-agent vectors — out of scope: `--scope program`.
[N/A]       KV-118: Stake Account Authority Hijack — feature absent: no stake, StakeProgram, staker or
                    withdrawer anywhere in programs/.
[PARTIAL]   KV-119: Durable-Nonce Pre-Signed Governance Abuse — admin instructions carry no version or epoch
                    guard and no timelock, so a durable-nonce pre-signed privileged transaction stays valid
                    indefinitely, including across an authority migration.
              File: handler_update_vault_config.rs:14-50, handler_update_admin.rs:5-16 (OPS-077)
              Impact: a pre-signed admin action survives the context that authorized it.
              Fix: include a config version in privileged instructions and bump it on rotation; add a timelock
                   and an aggregate-outflow breaker (F-002, F-005).
[N/A]       KV-120: On-Chain Randomness Predictability — feature absent: no random, vrf, slot_hashes or
                    blockhash use; no lottery or selection mechanism.
[N/A]       KV-121: cNFT / Account-Compression Merkle Proof Abuse — feature absent: no spl-account-compression,
                    bubblegum, merkle or proof handling.
[PASS]      KV-122: Inner-Instruction / Event-Log Spoofing — events use emit_cpi! (self-CPI inner instructions),
                    the non-forgeable form, and no attacker-driven path can make the program emit as another
                    program. No off-chain consumer is in scope.
              File: handler_deposit.rs:43, :59; handler_withdraw.rs:44-45; handler_redeem_in_kind.rs:49, :75
                    (coverage, as opposed to integrity, is the gap — see F-012)
[N/A]       KV-123: Lamport-Donation Account Bricking — feature absent: the program never reads .lamports(),
                    never calls try_borrow_lamports, and makes no exact-balance or rent-state assumption.
[N/A]       KV-124: Custodial Cleartext Key Export — out of scope: `--scope program`; no key custody component.
[N/A]       KV-125: Bonding-Curve Launchpad Graduation Abuse — feature absent: no bonding_curve, graduate,
                    virtual_reserves, migrate or curve.
[N/A]       KV-126: Session Token as Custody — feature absent: no session, session_token, delegated-signing or
                    spending_limit.
[PASS]      KV-127: ATA / Account Pre-Creation DoS — no permissionless plain `init` on an attacker-derivable
                    address. token_vault and shares_mint seed from a caller-supplied fresh vault_state; the
                    global_config PDA can only be created by this program (a PDA is off-curve and cannot sign
                    a System create_account); the two init_if_needed sites are admin-gated and re-validated.
              File: handler_init_vault.rs:90-113, handler_initialize_global_config.rs:34-41,
                    handler_update_reserve_allocation.rs:135
[FAIL-2]    KV-128: On-Chain Floating-Point Financial Math — one f64 constant in the management-fee divisor.
                    See F-011.
              File: utils/consts.rs:19, vault_operations.rs:873-874
              Impact: none materially — a compile-time constant with no user input reaching the float boundary.
                      Reported because a float in a value path is a finding on principle, and because a dead
                      integer twin (SECONDS_PER_YEAR_U64 = 31556925) disagrees with it by one second.
              Fix: replace with an integer constant; delete the twin.
[N/A]       KV-129: Keeper Request→Execute Front-Running — feature absent: no submit/execute split. Deposits,
                    withdrawals and redemptions are single-transaction, and `invest` carries no user request
                    PDA whose parameters could be re-priced between submission and execution.
[N/A]       KV-130: CLMM/DLMM Tick-Boundary Math — feature absent: no tick, sqrt_price, liquidity_net,
                    bin_array or fee_growth.
[PARTIAL]   KV-131: Write-Lock Account Contention DoS — hot-path state is already sharded per vault
                    (vault_state is a distinct account per vault, not a global singleton), which is the main
                    protection. But every user instruction write-locks that vault_state AND write-locks every
                    allocation reserve through the mandatory klend refresh, so all users of a vault — and all
                    users of any reserve it shares with other vaults — serialize behind the same locks.
              File: vault_operations.rs:1015-1036, klend_operations.rs:79 (AccountMeta::new — writable),
                    handler_invest.rs:188-203, AV-019 (unnecessary `mut` on base_vault_authority/token_mint)
              Impact: throughput cap rather than a starved time-critical path — this protocol has no
                      liquidation or auction race to lose. Compounded by F-009's rate-limit bypass, which lets
                      an attacker cheaply add writes to the queue.
              Fix: drop unnecessary `mut` (AV-019); subset the reserve refresh (F-003); fix the invest
                   rate limit (F-009).
[N/A]       KV-132: Canonical-Asset / Token-List Spoofing — out of scope: `--scope program`; no token registry
                    or list resolution in the program.
[N/A]       KV-133: Token Risk-Score Metric Farming — out of scope: `--scope program`; no risk-scoring surface.
[N/A]       KV-134: Token ACL (SRFC-37) Gate-Program Bypass — feature absent: no token_acl, TACLkU6, MINT_CFG,
                    gating_program or thaw_permissionless.
[N/A]       KV-135: Transaction v1 Fee-Sponsor Cap Bypass — feature absent: this program is not a fee sponsor
                    or paymaster, and performs no ComputeBudget introspection (see AV-089). The instructions
                    sysvar is forwarded to klend, never read by this program.
[N/A]       KV-136: Transaction v1 Reader Wedge — out of scope: `--scope program`; the vector concerns
                    off-chain readers and indexers, of which none is in scope.
```

---

### Audit Metrics

| Metric | Value |
|--------|-------|
| Total items evaluated (in-scope checklist) | 591 |
| PASS | 231 (39.1 %) |
| FAIL | 71 (12.0 %) |
| PARTIAL | 79 (13.4 %) |
| N/A | 181 (30.6 %) |
| UNKNOWN (not statically determinable) | 29 (4.9 %) |
| **Pass rate** (excl. N/A and UNKNOWN) | **60.8 %** |
| Distinct findings after de-duplication | 14 |
| **Highest severity found** | **5** — 🟡 MEDIUM |
| **Repository Risk Score** | **5** — 🟡 MEDIUM |

**Risk-score derivation (OUTPUT-RULES Rule 1).** No finding reaches 9 or 7, and the highest is 5, so
`REPO SCORE = max(finding) = 5` (MEDIUM — fix soon). The intake's TVL lever (Q10 ≥ $1M assumed → critical
findings double-weighted) does not move the score, because there are no critical findings to weight. The
mainnet-live lever (Q8 → +1 on fund-related findings) was applied to F-001, F-002, F-003 and F-006 and is
recorded in each block.

### Known Vector Metrics

| Metric | Value |
|--------|-------|
| Total known vectors | 136 |
| In scope (evaluated) | 56 |
| PASS | 20 |
| FAIL | 6 |
| PARTIAL | 10 |
| N/A — feature absent (evidence-backed) | 18 |
| UNKNOWN (off-chain evidence required) | 2 |
| N/A — out of scope (from the gate) | 80 |
| **Completion** | **100 %** (every in-scope vector carries a verdict) |

**Failing vectors:** KV-025 (5), KV-019 (4), KV-023 (4), KV-105 (4), KV-011 (3), KV-128 (2).

### Per-Checklist Summary

| # | Checklist | Items | Pass | Fail | Partial | N/A | Unknown | Pass Rate |
|---|-----------|-------|------|------|---------|-----|---------|-----------|
| 01 | Account Validation | 90 | 36 | 7 | 16 | 31 | 0 | 61.0 % |
| 02 | Access Control | 50 | 27 | 3 | 9 | 11 | 0 | 69.2 % |
| 03 | Arithmetic Safety | 63 | 39 | 7 | 9 | 8 | 0 | 70.9 % |
| 04 | CPI & PDA | 70 | 42 | 2 | 5 | 21 | 0 | 85.7 % |
| 05 | State Machine | 72 | 24 | 2 | 3 | 43 | 0 | 82.8 % |
| 06 | Economic & Logic | 89 | 36 | 8 | 14 | 31 | 0 | 62.1 % |
| 07 | OpSec & Governance | 85 | 18 | 12 | 13 | 14 | 28 | 41.9 % |
| 16 | Formal Verification & Testing | 72 | 9 | 30 | 10 | 22 | 1 | 18.4 % |
| | **Total (in scope)** | **591** | **231** | **71** | **79** | **181** | **29** | **60.8 %** |

---

## 6. Instruction Matrix

> All 22 entrypoints from `lib.rs:32-218`, reconstructed by reading each handler (no pre-scanner was available).
> "Signer role" is the authority the instruction actually enforces, not merely the accounts it declares.

| # | Instruction | File | Signer role | Authority binding | CPI targets | Checked math | State changes | Events | Findings |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `init_vault` | `handler_init_vault.rs:17` | **permissionless** (creator becomes admin) | — (`#[account(zero)]` + `load_init`) | Token/Token-2022 (transfer), System (init ×2) | mixed — `token_to_deposit + crank_funds` unchecked (`:71`) | full `VaultState` init; `shares_issued = 1000`; `deposit_cap = u64::MAX` | none | F-006, F-010, F-012 |
| 2 | `init_global_config` | `handler_initialize_global_config.rs:12` | **permissionless** (admin = program upgrade authority) | `address = pda::program_data()` | System (init) | n/a | `GlobalConfig` init | none | F-012, OPS-009 |
| 3 | `update_global_config` | `handler_update_global_config.rs:8` | global admin | `has_one = global_admin` + PDA seeds | none | n/a | penalty lamports / bps, pending admin | none | F-012 |
| 4 | `update_global_config_admin` | `handler_update_global_config_admin.rs:5` | pending global admin | `has_one = pending_admin` + PDA seeds | none | n/a | `global_admin := pending_admin` | none | F-012, OPS-060 |
| 5 | `add_update_whitelisted_reserve` | `handler_add_update_whitelisted_reserve.rs:12` | global admin | `has_one = global_admin` + PDA seeds | System (`init_if_needed`) | n/a | `ReserveWhitelistEntry` fields | none | F-012, OPS-057, KV-014 |
| 6 | `update_reserve_allocation` (v1) | `handler_update_reserve_allocation.rs:22` | vault admin (new slot) / vault **or** allocation admin (existing) | explicit key comparison `:56-71` | System + Token (`init_if_needed` ctoken_vault) | **no** — `target_allocation_weight` unbounded | upsert `vault_allocation_strategy[i]` | none | F-003, F-012, F-014 |
| 7 | `update_reserve_allocation_v2` | `handler_update_reserve_allocation.rs:30` | same as v1 | same | same | same, plus `ctoken_allocation_cap` | same + ctoken cap | none | F-003, F-012, F-014 |
| 8 | `remove_allocation` | `handler_remove_allocation.rs:7` | vault admin | `has_one = vault_admin_authority` | none | n/a | clears a slot (requires `ctoken_allocation == 0 && weight == 0`) | none | F-003, F-012, KV-024 |
| 9 | `deposit` | `lib.rs:66` → `handler_deposit.rs:17` | **permissionless** (user) | `token::authority = user` | klend refresh, Token transfer_checked, Token mint_to | **no** — `max_amount − crank_funds` (`vault_operations.rs:68`) | `token_available`, `shares_issued`, `prev_aum`, `pending_fees`, `available_crank_funds` | `DepositUserAtaBalanceEvent`, `DepositResultEvent` | **F-001**, F-003, F-008 |
| 10 | `deposit_with_min_shares_out` | `lib.rs:73` | **permissionless** (user) | same | same | same | same | same | **F-001**, F-003, F-008 |
| 11 | `buy` | `lib.rs:81` | **permissionless** (user) | alias of `deposit` | same | same | same | same | **F-001**, F-003, F-008 |
| 12 | `buy_with_min_shares_out` | `lib.rs:88` | **permissionless** (user) | alias of `deposit_with_min_shares_out` | same | same | same | same | **F-001**, F-003, F-008 |
| 13 | `withdraw` | `lib.rs:98` → `handler_withdraw.rs:25` | **permissionless** (user) | `token::authority = user`; `require_keys_eq!` on both `vault_state`s (`:32-35`) and on `ctoken_vault` (`:234`) | klend refresh, klend `RedeemReserveCollateral`, Token burn, Token transfer_checked | mostly — Fraction/U256 throughout; bare `−` in accounting helpers | `token_available`, `shares_issued`, `ctoken_allocation`, `prev_aum`, `pending_fees` | `SharesToWithdrawEvent`, `WithdrawResultEvent` | **F-002**, **F-003**, F-013 |
| 14 | `sell` | `lib.rs:105` | **permissionless** (user) | alias of `withdraw` | same | same | same | same | **F-002**, **F-003**, F-013 |
| 15 | `withdraw_from_available` | `lib.rs:171` → `handler_withdraw.rs:50` | **permissionless** (user) | `token::authority = user` | klend refresh, Token burn, Token transfer_checked | same | `token_available`, `shares_issued`, `prev_aum`, `pending_fees` | `SharesToWithdrawEvent`, `WithdrawResultEvent` | **F-002**, **F-003**, F-013 |
| 16 | `redeem_in_kind` | `lib.rs:212` → `handler_redeem_in_kind.rs:25` | **permissionless** (user) | `token::authority = user`; `ctoken_mint` pinned by `address = reserve.collateral.mint_pubkey` | klend refresh, Token burn, Token transfer_checked (cTokens) | same | `shares_issued`, `ctoken_allocation`, `prev_aum`, `pending_fees` | `SharesToWithdrawEvent`, `RedeemInKindResultEvent` | **F-002**, **F-003** |
| 17 | `invest` | `lib.rs:114` → `handler_invest.rs:29` | **permissionless** (crank) | none — `payer: Signer` with no authority link | klend refresh, klend `DepositReserveLiquidity` **or** `RedeemReserveCollateral`, Token transfer_checked (rounding-loss top-up) | mostly — `last_invest_slot + min_invest_delay_slots` unchecked (`:578`) | `token_available`, `ctoken_allocation`, `token_target_allocation`, `available_crank_funds`, `last_invest_slot`, `pending_fees` | **none** | F-003, F-009, F-012, F-014 |
| 18 | `invest_with_max_amount` | `lib.rs:121` | **permissionless** (crank) | same | same | same | same | **none** | F-003, **F-009**, F-012 |
| 19 | `update_vault_config` | `handler_update_vault_config.rs:14` | global admin **or** vault admin, per field | explicit comparison `:21-22`; gate at `vault_config_operations.rs:40-92` | klend refresh | **no** — 9 fields unbounded | any of 21 config fields; also charges fees first | **none** | **F-002**, F-012, **F-014** |
| 20 | `update_admin` | `handler_update_admin.rs:5` | pending vault admin | `has_one = pending_admin` | none | n/a | `vault_admin_authority := pending_admin` | **none** | F-012, OPS-060 |
| 21 | `withdraw_pending_fees` | `handler_withdraw_pending_fees.rs:21` | vault admin | `has_one = vault_admin_authority`; `token::authority = vault_admin_authority`; `require_keys_eq!` on `ctoken_vault` | klend refresh, klend `RedeemReserveCollateral`, Token transfer_checked | mostly — Fraction throughout | `pending_fees`, `token_available`, `ctoken_allocation` | **none** | F-012 |
| 22 | `give_up_pending_fees` | `handler_give_up_pending_fees.rs:5` | vault admin | `has_one = vault_admin_authority` | klend refresh | Fraction, saturating | `pending_fees`, `prev_aum`, `last_fee_charge_timestamp` | **none** | F-003, F-012 |
| 23 | `topup_rewards` | `handler_topup_rewards.rs:9` | **permissionless** (donor) | `token::authority = payer` | Token transfer_checked | **no** — `rewards_available += amount` (`:964`) | `rewards_available`, `last_issuance_ts`, `token_available` | **none** | F-012, AR-001 |
| 24 | `withdraw_rewards` | `handler_withdraw_rewards.rs:10` | vault admin | `has_one = vault_admin_authority` | Token transfer_checked | **no** — `rewards_available -= amount` (`:979`) | `rewards_available`, `token_available` | **none** | F-012, AV-046 |
| 25 | `initialize_shares_metadata` | `handler_initialize_shares_metadata.rs:6` | vault admin | `has_one = vault_admin_authority`, `has_one = shares_mint`, `has_one = base_vault_authority` | Metaplex `CreateMetadataAccountsV3` | n/a | Metaplex metadata (external) | **none** | F-012 |
| 26 | `update_shares_metadata` | `handler_update_metadata.rs:6` | vault admin | `has_one` ×2 + `constraint` on update_authority and mint | Metaplex `UpdateMetadataAccountsV2` | n/a | Metaplex metadata (external) | **none** | F-012, AV-029 |

> 26 rows for 22 distinct handlers — `buy`/`sell` are aliases (`lib.rs:81-96`, `:105-112`), and
> `deposit`/`withdraw` each have a min-out variant. **Permissionless value-moving instructions: 9**
> (deposit ×4, withdraw ×4, redeem_in_kind, invest ×2, topup_rewards — see AC-010).
> **Instructions with zero structured events: 16 of 22** (F-012).

---

## 7. State Model Verification

### Account Types

| Account | Type | Discriminator | Space | Owner | PDA seeds | Close target |
|---|---|---|---|---|---|---|
| `VaultState` | `#[account(zero_copy)]` | ✅ Anchor 8-byte | 62,544 + 8 (`static_assertions` at `state/vault_state.rs:14-15`; also asserted `% 16 == 0`) | this program | **none** — client-generated keypair, `#[account(zero)]` | **none** (SM-028) |
| `GlobalConfig` | `#[account(zero_copy)]` | ✅ Anchor 8-byte | 1,024 + 8 (`state/global_config.rs:12-13`; `% 8 == 0`) | this program | `[b"global_config"]` | **none** |
| `ReserveWhitelistEntry` | `#[account]` | ✅ Anchor 8-byte | 128 + 8 (`state/reserve_whitelist_entry.rs:5-9`) | this program | `[b"whitelisted_reserves", reserve]` | **none** |
| `VaultAllocation` | `#[zero_copy]` (embedded ×25) | n/a — inline in `VaultState` | 2,160 (`state/vault_allocation.rs:10-14`; `% 16 == 0`) | n/a | n/a | n/a |
| `VaultRewardInfo` | `#[zero_copy]` (embedded) | n/a — inline in `VaultState` | 96 (`state/vault_reward_info.rs:5-9`) | n/a | n/a | n/a |
| `token_vault` | SPL token account | SPL | 165 | Token / Token-2022 | `[b"token_vault", vault_state]` | none |
| `ctoken_vault` (×N) | SPL token account | SPL | 165 | Token (classic) | `[b"ctoken_vault", vault_state, reserve]` | none (KV-024) |
| `shares_mint` | SPL mint | SPL | 82 | Token (classic) | `[b"shares", vault_state]` | none |
| `base_vault_authority` | PDA, no data | n/a | 0 | System | `[b"authority", vault_state]` | n/a |

All three size constants are verified at compile time against `std::mem::size_of::<T>()`, and two are
additionally asserted to be alignment-correct — a genuinely strong control for zero-copy layouts (AV-040 PASS).

### State Machine Transitions

```
GLOBAL CONFIG (singleton PDA, created once)
  [absent] --init_global_config(permissionless)--> [active: global_admin := program upgrade authority]
  [active] --update_global_config(PendingAdmin)--> [active, pending set]
  [active, pending set] --update_global_config_admin(pending signs)--> [active: global_admin := pending]
  Note: pending_admin is NOT cleared on acceptance; after acceptance pending == admin, so no
        escalation follows (state/global_config.rs:80-83). No expiry exists (OPS-060).

VAULT LIFECYCLE  (no status enum — the vault has exactly one live state)
  [absent] --init_vault(permissionless)--> [LIVE]
       on entry: admin := creator, allocation_admin := creator, deposit_cap := u64::MAX,
                 shares_issued := 1000 (dead shares, NO SPL mint — F-010),
                 token_available := 1000, creation_timestamp := now
  [LIVE] --deposit / buy--> [LIVE]            token_available +=, shares_issued +=, shares minted
  [LIVE] --withdraw / sell / withdraw_from_available--> [LIVE]
                                              shares burned, token_available −=, ctoken_allocation −=
  [LIVE] --redeem_in_kind--> [LIVE]           shares burned, ctoken_allocation −=, cTokens out
  [LIVE] --invest / invest_with_max_amount--> [LIVE]   (permissionless crank)
                                              Add:      token_available −= floor, ctoken_allocation += C
                                              Subtract: token_available += floor, ctoken_allocation −= C
  [LIVE] --withdraw_pending_fees--> [LIVE]    pending_fees −=, tokens to admin
  [LIVE] --give_up_pending_fees--> [LIVE]     pending_fees −=, value returns to holders
  [LIVE] --update_vault_config / update_admin / *_allocation--> [LIVE]
  [LIVE] --X--> [CLOSED]                      NO closure transition exists (SM-028)

  Terminal state: none. Every vault, once created, is permanent — rent and the 1,000-unit
  dead-share deposit are locked forever (SM-028, F-010).

ADMIN HANDOVER (two-step, both scopes)
  admin --update_vault_config(PendingVaultAdmin, X)--> pending := X
  X     --update_admin(X signs)-->                     vault_admin_authority := X, pending stays X
  Safety: at init, pending_admin == Pubkey::default() == the System Program address, for which no
          private key exists — so the has_one = pending_admin gate on update_admin is unsatisfiable
          until a real pending admin is set. Verified, not assumed.

RESERVE ALLOCATION (per slot, 25 slots)
  [empty: reserve == Pubkey::default()]
      --update_reserve_allocation(vault admin)--> [populated: weight, caps set, ctoken_allocation = 0]
  [populated] --update_reserve_allocation(vault OR allocation admin)--> [populated: config updated,
              ctoken_allocation / last_invest_slot / token_target_allocation PRESERVED (SM-067)]
  [populated] --invest(Add)--> ctoken_allocation +=
  [populated] --invest(Subtract) / withdraw / redeem_in_kind--> ctoken_allocation −=
  [populated, ctoken_allocation == 0 AND weight == 0] --remove_allocation(vault admin)--> [empty]
      Guard: can_be_removed() (state/vault_allocation.rs:46-49). A slot holding cTokens that cannot be
             evacuated is PINNED — and keeps charging its refresh cost to every user (F-003).
```

### Invariants Verified

| Property | Description | Status |
|---|---|---|
| INV-01 | `token_vault.amount >= token_available + available_crank_funds + rewards_available` | ✅ PASS — maintained by the exact-equality post-transfer checks on every path (`vault_checks.rs:69-262`, `handler_deposit.rs:112-115`, `handler_topup_rewards.rs:36-44`) |
| INV-02 | `vault.shares_issued == shares_mint.supply` | ❌ **FAIL** — diverges by exactly `INITIAL_DEPOSIT_AMOUNT = 1000`, permanently and by design (F-010). The intended invariant is `shares_issued == supply + 1000`, which holds but is undocumented and unasserted. |
| INV-03 | `compute_aum() = token_available + Σ invested − pending_fees`, and never negative | ✅ PASS — `AUMBelowPendingFees` guard at `state/vault_state.rs:182-184` |
| INV-04 | `available_crank_funds` is excluded from AUM and from every user payout | ✅ PASS mechanically — and that is exactly the defect (F-001): excluded from AUM *and* from every withdrawal path, i.e. unreachable |
| INV-05 | Every reserve in `remaining_accounts` matches `vault_allocation_strategy[i].reserve`, in order | ✅ PASS — `vault_operations.rs:1051-1073`, re-checked at `:1213-1215` |
| INV-06 | Every allocation reserve is non-stale at the current slot before any share math | ✅ PASS — `vault_operations.rs:1097-1104` |
| INV-07 | Share minting rounds toward the vault; share burning rounds toward the vault | ✅ PASS — `vault_operations.rs:1123-1126` (floor with ceil'd denominator), `:1539-1545` (ceil) |
| INV-08 | `invest` never decreases total holdings | ✅ PASS — `require_gte!(final_holdings_total, initial_holdings_total)` at `vault_checks.rs:245-249`, plus the AUM check at `:255-259` |
| INV-09 | `pending_fees <= aum` after every `charge_fees` | ✅ PASS — `new_fees = (mgmt + perf).min(new_aum)` at `vault_operations.rs:906` |
| INV-10 | `Σ target_allocation` over reserves ≤ AUM after `refresh_target_allocations` | ✅ PASS — verified by hand: each inner pass allocates at most `loop_total_tokens`, and the weight bookkeeping (`state/vault_state.rs:394`) removes a reserve's weight exactly once, on the pass where it reaches its cap |
| INV-11 | `remaining_weight_to_allocate` cannot underflow | ✅ PASS — a reserve with `token_allocation_cap == 0` has `effective_token_allocation_cap == 0` and hits the `continue` at `state/vault_state.rs:382-384` before reaching the `-=` at `:394`; only reserves counted in `total_weight` can decrement it, and each does so at most once |
| INV-12 | `shares_issued` can never reach 0 while AUM > 0 | ✅ PASS — the 1,000 dead shares are a permanent floor (F-010, second-order benefit) |
| INV-13 | Performance fees are charged only on genuine new gains | ❌ **FAIL** — no high-water mark; `prev_aum` is marked down on losses, so recovery is charged again (F-013) |
| INV-14 | Every PDA-controlled balance has a reachable withdrawal path | ❌ **FAIL** — `available_crank_funds` has none (F-001, ECON-082) |
| INV-15 | A depositor can always exit | ⚠️ **UNDETERMINED** — true at low reserve counts; the cost of every exit path scales with an admin-set value and no lighter path exists (F-003) |

---

## 8. Code Maturity Scorecard

> Engineering-quality gate (Phase 4.5), orthogonal to the risk score. 0 absent · 1 ad-hoc · 2 partial ·
> 3 good · 4 strong (weakest-link within each category).

| # | Category | Score (0-4) | Evidence (file:line / artifact) | Gap to next level |
|---|----------|:-----------:|---------------------------------|-------------------|
| 1 | Access Controls | **3** | Every one of 22 instructions is signer-gated and bound to stored authority via `has_one` or explicit comparison; clean four-role separation (global / vault / allocation / pending); two-step handover on both scopes (`handler_update_admin.rs:18-27`, `handler_update_global_config_admin.rs:14-22`); the `pending_admin == Pubkey::default()` bootstrap is safe by construction | No timelock on any privileged path (F-002, OPS-055); no pause and no guardian role distinct from the admin (F-005); `require_keys_eq!` defence-in-depth is present on only one link (AV-021) |
| 2 | Arithmetic | **3** | `Fraction` (U68F60) fixed-point throughout with U256 intermediates (`fraction_utils.rs:9-20`); mul-before-div everywhere; every rounding direction demonstrably favours the vault; `overflow-checks = true` plus `debug-assertions` forced on the `fixed` crate in release (`Cargo.toml:5-12`) — a deliberate, uncommon hardening choice | ~15 bare `+`/`−`/`*` sites rely on the build profile rather than on `checked_*` with typed errors (F-008); one `f64` in the fee divisor (F-011); nine admin numerics unbounded, two of which reach unchecked arithmetic (F-014) |
| 3 | Account & Type Safety | **3** | Typed accounts throughout; Anchor discriminators on all state; three compile-time `static_assertions` on zero-copy sizes and alignment; canonical bumps; every remaining-account reserve pinned by pubkey against the allocation table *and* staleness-checked (`vault_operations.rs:1051-1108`) | 14 raw `AccountInfo` fields, three without `/// CHECK:` (AV-002, AV-003); no Token-2022 extension screening (F-006); stored `ctoken_vault_bump` never consumed (KV-104) |
| 4 | Input Validation | **2** | Bounds enforced on management fee, min-withdraw, and both withdrawal-penalty fields; `check_bool_like_value` on both bool-like `u8`s; `VaultState::validate()` at init (`state/vault_state.rs:189-234`); same-mint requirement on every allocation (`handler_update_reserve_allocation.rs:87`) | Nine admin numerics with no upper bound (F-014); no interdependency validation (OPS-083); performance fee bounded only at 100 % (F-002); user `max_amount` reaches an unchecked subtraction (F-008) |
| 5 | Testing | **1** | An in-process LiteSVM suite exists and loads the real compiled program (`libs/kvault-interface/tests/integration/setup.rs`, 749 lines of harness); ~25 test functions covering deposit, buy, withdraw ×3, redeem, invest, refresh, plus 8 deserialization cases including two negatives; balances asserted with `assert_eq!` | **`programs/kvault` contains zero tests** — no `tests/`, no `#[cfg(test)]` in any of 46 files; the suite lives in an out-of-scope crate; ~8 of 22 instructions exercised; **no authorization-negative test anywhere** (FV-038, FV-064); no edge-case, reinit, or time-gate tests; no coverage measurement; no CI to run any of it |
| 6 | Fuzzing & Property Tests | **0** | None. No `fuzz/`, no proptest, no Trident, no Crucible, no Kani, no Certora artifacts anywhere in the repository | Everything. For a mainnet vault whose share math *is* the product, the absence of property testing on the mint/burn round-trip and the allocation-sum closure is the single widest gap in this report (FV-005, FV-024, FV-029, FV-071) |
| 7 | Error Handling & DoS Resilience | **2** | 60+ specific `KaminoVaultError` variants with `#[msg]` text (`lib.rs:223-418`); exhaustive matches with no wildcard arms; every CPI result `?`-propagated; exhaustive before/after balance assertions on every fund-moving path (`vault_checks.rs`); bounded iteration at `MAX_RESERVES = 25`; `Box`'d contexts and heap-allocated `Holdings` guard the 4 KB stack frame (KV-111) | Reachable `unwrap`/`expect`/`panic!` on user input (`vault_operations.rs:68`, `:1048`, `:1715`; `fraction_utils.rs:19`) turn typed errors into opaque aborts (F-008, FV-049); exit cost scales with an admin-set value with no lighter path (F-003); no circuit breaker for the klend dependency (FV-057) |
| 8 | Upgradeability & Governance | **2** | Two-step admin handover on both scopes; global-admin bootstrapped from the program's upgrade authority (`handler_initialize_global_config.rs:14-19`); whitelist control separated from allocation control; `solana-security-txt` publishes a contact and policy URL and names four prior audit firms (`lib.rs:21-30`); mutually exclusive cluster features prevent cross-cluster builds (`program_id.rs:4-14`) | No timelock anywhere on-chain (OPS-006, OPS-054, OPS-055, OPS-057); no pause (F-005); upgrade custody unverifiable from source (OPS-001..005); three unpinned git dependencies block reproducible builds (F-004); no verifiable-build recipe (OPS-026) |
| 9 | Monitoring & Incident Response | **1** | Events exist and use the non-forgeable `emit_cpi!` form (KV-122 PASS); a security contact and disclosure policy are published on-chain; `msg!`/`kmsg!` logging is dense and deliberately capacity-bounded (`utils/macros.rs:85-146`) | 16 of 22 instructions emit no structured event — including the crank, every config change, every admin rotation, and fee withdrawal (F-012); emitted events omit vault, actor and timestamp (SM-048); no runbook, no alerting configuration, no CU baseline to detect regression (FV-067) |
| **Weighted Maturity** | | **1.9 / 4.0** | mean of 3,3,3,2,1,0,2,2,1 = 17/9 | |

**Reading.** The on-chain logic scores like a reviewed, production protocol — categories 1–3 are solid, and
several controls (compile-time size assertions, forced `fixed`-crate debug assertions, exhaustive balance
post-checks, pubkey-pinned remaining accounts) go beyond what this checklist asks for. The engineering
envelope around that logic does not keep pace: **categories 5 and 6 (Testing, Fuzzing) and 9 (Monitoring)
score ≤ 1 and are therefore prioritised in the Remediation Roadmap regardless of individual finding
severity**, per Phase 4.5. A mainnet vault with zero tests in the audited crate and no property testing over
its share math is carrying risk that no amount of careful reading — including this report — substitutes for.

---

## 9. Remediation Roadmap

> Also written to `audit_2/roadmap.md`. Effort estimates assume one engineer familiar with the codebase and
> exclude review and deployment.

### Immediate — Severity 9-10 (Block Deploy)

*None. No finding in this audit blocks a deploy.*

### Before Release — Severity 7-8

*None.*

### Within 2 Weeks — Severity 5-6

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| **F-001** | 5 | Add `withdraw_crank_funds` (admin-gated sweep) **or** fold the residue into `token_available`; bound `crank_fund_fee_per_reserve`; make the charge self-limiting against the existing balance | 1–2 days | Protocol eng |
| **F-002** | 5 | Introduce `MAX_PERFORMANCE_FEE_BPS`; add `pending_*` fee fields with an effective-from timestamp (≥ 24 h) promoted inside `charge_fees`; add `withdraw_with_min_amount_out` and `redeem_in_kind_with_min_out`; emit an event on both proposal and promotion | 3–5 days | Protocol eng |
| **F-003** | 5 | **First: measure.** CU-profile `refresh_allocation_reserve_accounts` at N = 1, 5, 10, 15, 20, 25 and publish the number. Then subset the per-instruction refresh (cache per-allocation liquidity + refresh slot), cap active reserves, and add a reduced-cost exit | 1–2 weeks (profiling first, 1 day) | Protocol eng + QA |

### Next Sprint — Severity 3-4

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| **F-013** | 4 | Persist `aum_high_water_mark_sf`; charge the performance fee only above the mark; ratchet up only. Zero-value default makes the migration a no-op | 1 day | Protocol eng |
| **F-014** | 4 | `require_gte!` on all nine unbounded setters; `checked_add` in `refresh_target_allocations` and the invest-delay comparison; one shared `validate_vault_config_consistency` after every config write | 1–2 days | Protocol eng |
| **F-006** | 4 | Screen Token-2022 extensions at `init_vault` — reject `PermanentDelegate`, `TransferHook`, `MintCloseAuthority`, `DefaultAccountState::Frozen`, and a non-None freeze authority (or record it on-chain) | 2 days | Protocol eng |
| **F-007** | 4 | Restore the pre-flight account-borrow check in `invoke_signed_and_recover_ix`; add a SAFETY comment naming the invariant and its three dependent call sites; make the two `cfg` arms agree | 0.5 day | Protocol eng |
| **F-005** | 4 | Asymmetric breaker: `deposits_halted` / `invest_halted` flags gating **inflow only**, settable by a halt-only `guardian_authority` distinct from the admin; optional per-window outflow cap (default uncapped) | 3–4 days | Protocol eng + ops |
| **F-004** | 4 | Pin `kamino_lending`, `strum` and the `spl-token-2022` fork by `rev` (the hashes are already in `Cargo.lock`); adopt `anchor build --verifiable` and publish the artifact hash per release | 0.5 day | Protocol eng |
| **F-012** | 3 | Add the seven missing event types (config, admin rotation, invest, fee withdrawal, rewards ×2, allocation); enrich the three existing events with `vault`, `user`, `timestamp` | 1–2 days | Protocol eng |
| **F-008** | 3 | `checked_mul` / `checked_sub` at `vault_operations.rs:62-68` mapping to the existing typed errors; convert the `vault_operations::common` accounting helpers to checked, `Result`-returning forms | 1 day | Protocol eng |
| **F-009** | 3 | Advance `last_invest_slot` whenever `collateral_amount > 0` (proportionally for a capped move, or fully); give `min_invest_amount` a non-zero default at `init_vault` | 0.5 day | Protocol eng |
| **F-010** | 3 | Document the dead-shares invariant at `handler_init_vault.rs:42` and in `README.md`; add a `DEAD_SHARES` constant; assert `shares_issued == shares_mint.supply + DEAD_SHARES` in the existing post-checks; expose `shares_issued` as the canonical denominator in the SDK | 0.5 day | Protocol eng + docs |

### Backlog — Severity 1-2

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| **F-011** | 2 | Replace `SECONDS_PER_YEAR: f64` with an integer constant; delete `SECONDS_PER_YEAR_U64`, `MAX_REWARDS_STALENESS_FOR_FEE_UPDATE`, `RewardsStaleForFeeUpdate` and `KaminoVaultResult` (or implement the staleness guard the first two describe) | 0.5 day | Protocol eng |
| Notes & Nitpicks | — | Add the three missing `/// CHECK:` comments; drop unnecessary `mut`; close `ctoken_vault` on `remove_allocation`; extend `.gitignore`; add `has_one = token_program` to `TopupRewards`; consume the stored `ctoken_vault_bump` | 1 day | Protocol eng |

### Engineering Maturity — prioritised regardless of finding severity (Phase 4.5)

> Categories scoring ≤ 1 in §8. These are not findings, and they are the highest-leverage work in this report.

| Gap | Maturity category | Action | Effort | Owner |
|---|---|---|---|---|
| **No tests in the audited crate** | 5 — Testing (1/4) | Move (or mirror) the program test suite into `programs/kvault/tests/`; add a **wrong-signer rejection test for every privileged instruction** (FV-064 — the single highest-value test to write); add edge-case tests for zero/max/below-minimum on deposit and withdraw; add a double-init test | 1–2 weeks | Protocol eng + QA |
| **No CI** | 5, plus FV-013/016/019/020/040 | GitHub Actions on every PR: `cargo clippy --all-targets -- -D warnings`, `cargo audit`, `cargo deny`, the full test suite, and `anchor build` with a grep for `exceeded max offset of 4096` (KV-111 step 1) | 2–3 days | DevOps |
| **No fuzzing or property tests** | 6 — Fuzzing (0/4) | Trident targets over deposit/withdraw/invest sequences; property tests for the share mint/burn round-trip (never profitable), fee conservation, and allocation-sum closure; boundary fuzzing of the accounting helpers | 2–3 weeks | Protocol eng + QA |
| **No CU baseline** | 7, 9 — and the blocker for quantifying F-003 | Record CU for init / deposit / withdraw / invest at N = 1, 5, 10, 15, 20, 25 reserves; commit as a regression baseline (FV-067) | 1–2 days | QA |
| **No documented invariants** | 1, 6 — FV-001/004 | An `INVARIANTS.md` enumerating the 15 properties in §7 and the code that enforces each; it is the input a property-test suite and any future audit both need | 1–2 days | Protocol eng |
| **Monitoring** | 9 — Monitoring (1/4) | Once F-012's events land: alerting on fee/penalty increases, admin rotations, whitelist changes, and outsized fee withdrawals; a documented incident runbook | 1 week | Ops |

---

## 10. Re-Audit Checklist

- [ ] All Critical findings fixed and verified — *N/A, none found*
- [ ] All High findings fixed and verified — *N/A, none found*
- [ ] Medium findings (F-001, F-002, F-003) addressed, or accepted with a documented, signed-off risk rationale
- [ ] F-003's CU profile measured and published — the number that turns `[UNDETERMINED]` into a decision
- [ ] Low findings (F-004 … F-010, F-012 … F-014) addressed or backlogged with an owner and a date
- [ ] Regression tests added for **each** fix — with the wrong-signer suite (FV-064) landing first
- [ ] Maturity categories scoring ≤ 1 (Testing, Fuzzing, Monitoring) raised to ≥ 2
- [ ] CI running clippy, `cargo audit`, the test suite, and the stack-offset grep on every PR
- [ ] Every git dependency pinned by `rev`; `cargo audit` clean
- [ ] Program rebuilt with `anchor build --verifiable`; artifact hash published and matched against the deployed binary
- [ ] Upgrade authority confirmed to be a multisig behind a timelock (`solana program show`) — resolves OPS-001..008 and KV-020/KV-091
- [ ] `INVARIANTS.md` published and the §7 invariant table re-verified against it
- [ ] `libs/kvault-interface` reviewed under checklist 20 — deferred from this engagement by `--scope program`

---

## 11. Appendices

### A. Tool Versions

```
Declared by the repository (read from source; nothing was built or executed):
  rustc / cargo   : 1.74.1                (rust-toolchain.toml:1-3)
  anchor-lang     : 0.29.0  [event-cpi]   (Cargo.toml:16)
  anchor-spl      : 0.29.0  [dex, token, token_2022]   (Cargo.toml:17)
  solana-program  : ~1.17.18              (Cargo.toml:20)
  kamino_lending  : 1.23.0 @ git c06001927d68895be487482bdd82dcf6e88e6348   (Cargo.lock:1393-1395)
  spl-token       : 3.5.0 / 4.0.0 (fork)  (Cargo.lock:2900, :2930)
  spl-token-2022  : 0.9.0 (Kamino fork @ 05499337404b7709a07c8c44325fb71f642c06da)   (Cargo.lock:2962)
  fixed           : 1.23.1                (Cargo.lock:1118)
  bytemuck        : 1.14.3                (Cargo.lock:660)
  borsh           : 0.10.3 [const-generics] (+ 0.9.3 transitively)   (Cargo.lock:527, :517)

Auditor toolchain:
  auditor-skill   : 7.3.0 @ 6bb2cbf  (1,413 items / 20 checklists / 136 known vectors)
  Mode            : 1 — FULL repository audit, linear/solo execution
  Deterministic pre-scanner (audit-scan) : NOT AVAILABLE — tools/auditor-tools/ absent and building is
                                           outside scope. Phases 0.2-0.4 were performed by reading.
  audit-mem       : NOT AVAILABLE — no cross-audit memory store; no prior false-positive rulings were
                                    available to suppress, and none was assumed.
```

### B. Environment

```
OS                : Linux 6.6.87.2-microsoft-standard-WSL2
Repository        : local working copy, detached HEAD at 1d146d7087a76edbbadc14d848ae14295c0745a4
Cluster tested    : NONE — no cluster interaction of any kind
RPC provider      : NONE
Build performed   : NO
Tests executed    : NO
Analysis type     : static, read-only source review
```

**Execution constraints, stated plainly.** This engagement was explicitly read-only: `cargo`, `anchor`, `npm`,
`pnpm`, `yarn`, `pip`, `python`, `node`, `make`, `curl` and `wget` were unavailable, and nothing from the
repository was built, installed, or run. Three consequences are load-bearing and are reflected in the verdicts
rather than papered over:

1. **No compiled artifact.** KV-111 step 1 (grep the build for `exceeded max offset of 4096`) could not be
   run, so KV-111 is `[PARTIAL]` on strong source-level evidence rather than `[PASS]`.
2. **No execution.** F-003's CU magnitude could not be measured, so it is reported `[UNDETERMINED]` — reachable
   and provable at `file:line`, magnitude unquantified — rather than being downgraded or inflated.
3. **No chain queries.** 28 checklist-07 items and 2 known vectors (KV-020, KV-091) depend on
   `solana program show` or a multisig account fetch and are recorded `[UNKNOWN]`, each naming the query that
   would settle it.

`kamino_lending` is a git dependency and is **not vendored in this repository**, so its source could not be
read. Every statement about KLend behaviour in this report is derived from how kvault *uses* it — the
instruction discriminators it builds (`klend_operations.rs:128-132`), the `Reserve` fields it reads
(`vault_operations.rs:1144-1164`), and the account metas it supplies — and is flagged as an assumption in §11-D.

### C. Audit Trail

| Artifact | Path |
|---|---|
| Intake (persisted questionnaire + trust model) | `audit_2/intake.md` |
| Session checkpoint (file-by-file progress) | `audit_2/checkpoint.md` |
| This report | `audit_2/REPORT.md` |
| Remediation roadmap | `audit_2/roadmap.md` |

### D. Assumptions & Simplifications

> Every `QUESTIONS.md` default applied non-interactively, carried forward from `audit_2/intake.md` §8 as
> required. A finding's severity reads against these assumptions; if one is wrong, the corresponding severity
> should be re-derived rather than the finding dismissed.

| # | Assumption | Basis | Effect if wrong |
|---|---|---|---|
| A-01 | **TVL ≥ $1M** (Q10 answered "Unknown"; treated as a live mainnet lending vault) | `README.md:12` declares a mainnet program ID | Lower TVL would reduce F-001/F-002/F-003 by roughly one band |
| A-02 | **Deployment is mainnet-live** (Q8) → +1 severity applied to fund-related findings | `README.md:8-13` | Pre-launch status would lower F-001, F-002, F-003, F-006 by one band |
| A-03 | **The program is upgradeable with an off-chain authority of unknown type** (Q11) | `handler_initialize_global_config.rs:14-19` reads the program-data upgrade authority | A single-wallet authority would, per `QUESTIONS.md`, become a Severity-8 finding in its own right. **This is the single most consequential unverified item in the report** — settle it with `solana program show KvauGMspG5k6rtzrqqn7WNn3oZdyKqLKwK2XWQ8FLjd` |
| A-04 | **Kamino Lending is honest and correct** — its `collateral_exchange_rate`, `Reserve` layout, instruction discriminators, and reserve-account validation all behave as kvault assumes | Not vendored; cannot be read at this commit | A KLend pricing defect propagates directly into kvault share pricing with no independent check (ECON-022, F-005). This is the protocol's largest external trust dependency |
| A-05 | **The vault admin and allocation admin are semi-trusted** — trusted to configure, trusted *not* to strand or expropriate depositors (intake §6) | Recorded trust model | If either role is treated as untrusted, F-001, F-002, F-003 and F-014 all rise, since each is currently capped by the "privilege required" lever of Rule 1 |
| A-06 | **Admin actions are protected by on-chain signatures only** (Q16) | No off-chain admin surface exists in scope | An off-chain admin API would add checklist-09 surface not covered here |
| A-07 | **No external price oracle is used** (Q23) | Zero oracle markers in `programs/`; `skip_price_updates: true` at `klend_operations.rs:99` | If a future version adds an oracle, checklist 06 §6.9 and KV-005 reopen |
| A-08 | **No prior audit finding is assumed fixed** (Q25) | `lib.rs:29` names OtterSec, Offside Labs, Certora and Sec3, but no report is in the tree | Overlap with prior findings is possible; none was assumed resolved, so this direction is conservative |
| A-09 | **No security incidents** (Q26) and **bounty status unknown** (Q27) | `QUESTIONS.md` defaults; a disclosure contact exists at `lib.rs:24` | No effect on severities |
| A-10 | **No CI/CD, branch protection, or secret scanning exists** (Q30, Q31, Q33) | No `.github/`, `Makefile`, or CI config tracked at this commit | If CI exists outside the repository, FV-013/016/019/020/040 improve; §8 category 5 stays ≤ 2 regardless, because the audited crate still has no tests |
| A-11 | **Dependency updates are manual** (Q34) | `Cargo.lock` committed; three unpinned git dependencies | A `cargo update` policy would make F-004's exposure materially worse |
| A-12 | **No regulatory framework applies and no PII is handled** (Q35, Q36) | Nothing declared in-repo; on-chain pubkeys only | Checklist 18 would reopen under GDPR/MiCA scope |
| A-13 | **`libs/kvault-interface` is out of scope** (Q44, from `--scope program`) | 39 `.rs` files, 4,640 LOC, unreviewed for vulnerabilities | Client-side defects (checklist 20 / KV-112) are entirely uncovered. Its test suite was enumerated — not code-reviewed — solely to answer checklist 16 |
| A-14 | **`AUDITOR/`, `audit_1/`, `audit_2/` are not part of the audited commit** | Untracked; `git ls-files` returns 97 files, none under those paths | None. `AUDITOR/` was treated as data; a scan of the audited tree for reviewer-directed text found zero matches |
| A-15 | **`overflow-checks = true` is active in the deployed binary** | `Cargo.toml:5-12` sets it for `[profile.release]` and forces `debug-assertions` on the `fixed` crate | If a release were built with a profile that disables it, the ~15 bare-arithmetic sites (F-008, F-014, KV-011) would **wrap silently instead of aborting**, and several would become materially more severe. Worth asserting in CI |

### E. Disclaimer

This audit report is provided as-is. It represents a point-in-time, static review of the source code at commit
`1d146d7087a76edbbadc14d848ae14295c0745a4` by an autonomous agent following the auditor-skill 7.3.0
methodology. Every in-scope checklist item and phase-triggered attack vector carries an explicit verdict, and
every verdict cites the code it rests on — but no guarantee is made that all vulnerabilities have been found.

Specific limits worth restating: nothing was built or executed, so no finding here carries an executable
proof-of-concept (all are `[PoC-PROSE]`, the accepted default for access-control and logic findings under
Rule 5b); the Kamino Lending dependency could not be read; 29 items depend on off-chain evidence and are
marked `[UNKNOWN]` rather than guessed; and F-003 is reported `[UNDETERMINED]` because its magnitude requires
measurement this engagement could not perform.

This is a rigorous first pass and a structured second opinion — **not** a substitute for a human firm audit,
and not a machine-checked proof of correctness. It does not issue a "safe to deploy" guarantee. It should be
paired with human review of the business and economic model, the on-chain verification steps listed in §10,
and the engineering-maturity work in §9 — particularly the test and property-test gaps, which no amount of
code reading replaces. This report does not constitute financial or legal advice.
