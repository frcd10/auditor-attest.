# Security Audit — StaFi Solana LSD (rSOL Liquid Staking)

**Repository:** Stafi/solana-lsd-contracts
**Scope:** `programs/lsd-program` (Anchor program; `declare_id!("795MBfkwwtAX4fWiFqZcJK8D91P9tqqtiSRrSNhBvGzq")`, `#[program] mod lsd_program`)
**Audit type:** AI-assisted first-pass (PROGRAM scope — checklists 01-07, 16)
**Date:** 2026-06-20
**Auditor:** Automated security review agent (Claude)
**Toolchain:** Anchor 0.29.0, Solana 1.18.15, `overflow-checks = true`

---

## 1. Executive Summary

StaFi's Solana LSD program implements rSOL-style liquid staking: stakers deposit SOL into a per-`StakeManager` pool PDA and receive an LSD SPL token minted by that PDA; an era/epoch state machine bonds SOL to validators via native stake accounts, observes delegated stake to detect rewards, mints platform/stack fees, and updates the SOL↔LSD exchange `rate`. Unstaking burns LSD, records an `UnstakeAccount`, and is claimable after an unbonding duration.

The core economic accounting (rate computation, fee minting, share conversion) uses `u128` intermediates and is bounded by a `rate_change_limit`; mint authority is correctly held by the pool PDA with `freeze_authority` rejected at init. No permissionless fund-drain or share-inflation exploit was found. The most material issues are (a) **unbounded growth of on-chain `Vec` fields** with the declared `*_len_limit` fields never enforced (latent DoS that can freeze a pool's era pipeline); (b) a **fully permissionless `StakeManager` creation** path that ignores the `Stack`'s entrusted-manager allow-list/limit; and (c) **unchecked subtractions on protocol totals** (`active`) that, under `overflow-checks`, turn rounding edge cases into tx-aborting DoS.

None are individually fund-loss-critical, but the unbounded-vector DoS can render a pool's funds temporarily unwithdrawable via the era path. **Not recommended for production** until limits are enforced and the manager-creation path is gated.

### Repository Risk Score: 5 / 10 (Medium)

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 0 |
| High (7-8) | 0 |
| Medium (4-6) | 2 |
| Low (1-3) | 3 |
| Informational | 1 |
| **Total** | **6** |

---

## 2. Confirmed Findings

### ST-01 — Declared `*_len_limit` fields are never enforced; unbounded `Vec` growth → pool DoS
- **Severity:** 6 / 10 — Medium
- **Category:** State machine / DoS / Resource exhaustion
- **Location:** `era_bond.rs:148-150`; `era_unbond.rs:179-181` & `redelegate.rs:218-224`; `admin_stake_manager.rs:144`; `states.rs:32-33`; `errors.rs:143-144`

`StakeManager` stores `stake_accounts_len_limit`/`split_accounts_len_limit` and `Stack` stores `stake_managers_len_limit`, plus a `StakeAccountsLenOverLimit` error — but **none is ever checked** before pushing. `era_bond`/`era_unbond`/`redelegate` push with only `contains()` dedup. `EraNew` clones the whole `stake_accounts` vector into `pending_stake_accounts`.

**Impact.** As the vectors grow, the serialized `StakeManager` grows toward its allocated size; once exceeded, every instruction mutating `stake_manager` (stake, unstake, all era steps) fails on serialization, the era pipeline can't complete, `era_update_rate` can't run, and the pool wedges — DoS on deposits/rate updates and the staking lifecycle. Growth is throttled (~1/era) and `era_merge` consolidates, so it's degradation/operational-DoS, not instant loss.

**Recommendation.** Enforce the stored limits before every push (return `StakeAccountsLenOverLimit`); size the account for the worst case; document merge/withdraw cadence.

### ST-02 — Permissionless `StakeManager` creation ignores `Stack` entrusted-manager allow-list and limit
- **Severity:** 5 / 10 — Medium
- **Category:** Access control / Governance
- **Location:** `initialize_stake_manager.rs:11-123`

`InitializeStakeManager` accepts any `stack` (only typed, not gated), an arbitrary `admin: Signer`, and a caller-supplied `lsd_token_mint`. It never verifies the manager is in `stack.entrusted_stake_managers`, never enforces `stake_managers_len_limit`. The `Stack` admin has no control over which managers attach; any user can spin up a pool referencing the canonical `Stack`, inheriting its fee commission and routing stack fees to `stack.admin`.

**Impact.** The `entrusted_stake_managers`/limit governance surface is inert. Unauthorized pools can present as "StaFi" pools sharing the `Stack`. Self-created pool funds are controlled by that pool's own admin — a governance/trust-boundary weakness, not direct theft from existing pools.

**Recommendation.** Require `stack.admin` to sign manager creation (or require pre-listing in `entrusted_stake_managers`), and enforce the limit, adding the manager to the list atomically.

### ST-03 — Unchecked subtractions on protocol total `active` enable rounding-induced DoS
- **Severity:** 4 / 10 — Low
- **Category:** Arithmetic safety
- **Location:** `staker_unstake.rs:80` (`active -= sol_amount`); `era_unbond.rs:183`

`active` is incremented in `stake` by raw `stake_amount` but decremented in `unstake` by a rate-converted, floored `sol_amount`, so it isn't a clean conservation. With `overflow-checks`, paths where decrements exceed `active` (around rate updates / small balances) abort the tx.

**Impact.** Underflow panics (revert) rather than corrupting state — localized DoS on `unstake`, not fund loss.

**Recommendation.** Use `checked_sub`/`saturating_sub` with explicit handling; add an invariant test that `Σ sol_amount(unstakes) ≤ active`.

### ST-04 — Era state machine fully permissionless; deactivating stake account can wedge an era
- **Severity:** 4 / 10 — Low
- **Category:** State machine / Access control
- **Location:** `era_update_active.rs:41-45`; era handlers in `lib.rs:265-327`

All era instructions are permissionless (gated only by the state machine). `era_update_active` requires `delegation.deactivation_epoch == u64::MAX`; if any pending account is deactivating, the step reverts and the account is never removed from `pending_stake_accounts`, so `need_update_rate` (requires the list empty) can never become true and the era stalls.

**Impact.** Liveness/griefing — freezes the rate update for that era. No fund theft (steps are deterministic/state-gated).

**Recommendation.** Handle the non-active case instead of hard-reverting; consider gating era progression behind a keeper/balancer role.

### ST-05 — `era_bond` rent funded by permissionless `rent_payer` is swept to the pool on withdraw
- **Severity:** 3 / 10 — Low
- **Category:** Economic / Accounting
- **Location:** `era_bond.rs:37-49`; `era_withdraw.rs:58-77`

The `init`'d stake account's rent reserve is paid by `rent_payer` (permissionless), but `era_withdraw` sends **all** lamports (`get_lamports()`, incl. rent) to `stake_pool`, not back to the payer. The pool accrues third-party-funded rent over many eras.

**Impact.** Minor asymmetric value transfer to the pool; not theft, small amounts; mild keeper disincentive.

**Recommendation.** Refund rent reserves to the original payer, or document that era ops are protocol/balancer-run.

### ST-06 — `RemoveEntrustedStakeManager` returns misleading `ValidatorNotExist` error
- **Severity:** 2 / 10 — Info
- **Category:** Code quality
- **Location:** `admin_stack.rs:108-113`

Uses `Errors::ValidatorNotExist` in a stake-manager removal handler — cosmetic, can mislead monitoring.

**Recommendation.** Add/use a dedicated `StakeManagerNotExist` error.

---

## 3. Investigated but Not Confirmed

- **Exchange-rate / reward accounting** — `u128` intermediates, `calc_rate` guards zero, per-era move capped by `rate_change_limit`; reward = observed delegation − old_active. Subtle but intentional (StaFi era model); no concrete inflation/drain found. By-design/low-confidence.
- **Mint authority & supply** — pass (mint authority == pool PDA, `freeze_authority` rejected, `supply == 0` at init; mints PDA-signed).
- **First-depositor / inflation** — pass (initial `rate = 1e9` 1:1; `calc_rate` returns base when either side zero; `min_stake_amount` enforced; rate from observed delegation not raw lamports).
- **PDA / signer validation** — pass (`stake_pool` seeds+bump as authority; correct `Signer`/`has_one`/`token::mint`; withdraw ties recipient to `unstake_account`; `check_context` rejects stray accounts).
- **`unstake` authority** — pass (delegate vs owner distinguished; recipient bound to token-account owner).
- **CEI / reentrancy / arbitrary CPI** — pass (state set before CPI; CPIs target System/Token/Stake/Metadata with validated ids; only bare `invoke` is `stake::initialize`).
- **`metadata` PDA / `realloc_stake_manager`** — pass (admin-gated; `realloc::zero = false`; no shrink-to-truncate). Note: realloc is the only mitigation for ST-01.
