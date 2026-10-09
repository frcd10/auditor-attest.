# Security Audit Report — marginfi-v2 (programs/marginfi)

- **Repository:** marginfi-v2
- **Scope:** PROGRAM — `C:/Users/felip/auditor_validation/MarginFi/marginfi-v2/programs/marginfi` (lending program only)
- **Explicitly out of scope:** all `*-mocks` crates and `test_transfer_hook` (test fixtures)
- **Environment:** Solana mainnet, TVL >$10M, Pyth / Switchboard oracles
- **Codebase size:** ~29k LOC (LARGE) — this was a first-pass review of the highest-value paths
- **Audit date:** 2026-06-19
- **Reviewer:** AI-assisted automated security review (Claude Code)

---

## 1. Executive Summary

This is a PROGRAM-scope review of the marginfi lending program. Coverage prioritized the highest-value code paths: deposit / withdraw / borrow / repay / flashloan accounting, share math, liquidation and receivership flow, oracle pricing (Pyth / Switchboard and the composite Kamino / Drift / Solend / JupLend oracle setups), bankruptcy / loss socialization, and the four external-protocol integrations.

After tracing these paths, **one finding was independently confirmed** as a real, reachable bug. It is a **High-severity availability/correctness gap** (not a fund-theft vector): the receivership instruction whitelist omits the Solend withdraw discriminator, blocking efficient liquidation of accounts collateralized with `ASSET_TAG_SOLEND` banks. No confirmed loss-of-funds, theft, or oracle-manipulation vector was found in this pass.

### Repository Risk Score

**HIGH (4 / 6)** — equal to the highest-severity confirmed finding.

**Plain-language verdict:** The core accounting, health-check, oracle, and vault-authority machinery held up well under review — share math rounds conservatively, vault transfers are PDA-seed constrained, health checks are enforced after every balance mutation, and liquidation invariants are sound. The one confirmed issue is a missing entry in an instruction allowlist that prevents liquidators from closing out Solend-tagged collateral during a liquidation transaction. It raises bad-debt risk for a specific class of accounts but does not permanently brick accounts and is fixable without migration. A number of additional candidates (oracle confidence scaling, stake-account panic DoS, rounding asymmetries) merit follow-up but were either refuted, lowered in confidence, or not independently confirmed in this first pass — see Section 3.

### Severity Distribution (CONFIRMED findings only)

| Severity | Count |
|----------|-------|
| Critical (5-6) | 0 |
| High (4) | 1 |
| Medium (3) | 0 |
| Low (1-2) | 0 |
| **Total** | **1** |

---

## 2. Confirmed Findings

### [HIGH] F-1 — `solend_withdraw` missing from receivership exclusive-instruction whitelist

- **Severity:** 4 (High)
- **Category:** Access Control / Denial of Service
- **Location:** `programs/marginfi/src/instructions/marginfi_account/liquidate_start.rs:183` (the allowlist array, lines 183-194)
- **Confidence:** High (independently verified)

**Description**

`start_liquidation` / `start_deleverage` call `validate_ixes_exclusive` (`liquidate_start.rs:180-195`) over the entire transaction. That helper (`ix_utils.rs:117-139`) iterates over every instruction whose `program_id` equals the marginfi program and returns `MarginfiError::ForbiddenIx` for any discriminator not present in the supplied allowlist. The instruction list is read from the instructions sysvar via `load_and_validate_instructions`, so it covers all top-level marginfi instructions in the tx.

The allowlist (lines 183-194) permits: `start_ix`, `end_ix`, `INIT_LIQUIDATION_RECORD`, `LENDING_ACCOUNT_WITHDRAW`, `LENDING_ACCOUNT_REPAY`, `KAMINO_WITHDRAW`, `DRIFT_WITHDRAW`, `JUPLEND_WITHDRAW`. It does **not** include a Solend withdraw discriminator. In fact, no `SOLEND_WITHDRAW` discriminator is defined at all in `ix_discriminators` (`type-crate/src/constants.rs:203-218`; only KAMINO/DRIFT/JUPLEND exist at 211-213). The `TODO` at lines 192-193 explicitly acknowledges that integrator withdraws must be added as they are introduced; Solend was omitted.

This matters because `solend_withdraw` is a first-class marginfi instruction (`lib.rs:899-905`), is explicitly designed to run during receivership (`withdraw.rs:92-110` fetches price and asserts non-zero price when `in_receivership`; `withdraw.rs:240-279` skips the health check during receivership — mirroring the kamino/drift/juplend withdraws that ARE whitelisted), and is the **only** instruction that can withdraw `ASSET_TAG_SOLEND` (=5) collateral: it requires `is_solend_asset_tag` (`withdraw.rs:323`), whereas the generic `lending_account_withdraw` requires `is_marginfi_asset_tag` (`withdraw.rs:285`), which matches only DEFAULT/SOL/STAKED and excludes SOLEND (`general.rs:443-448, 461-463`).

**Impact**

A liquidator/receiver cannot withdraw Solend-tagged collateral within the same liquidation/deleverage transaction. Any `start_liquidation` tx that includes the required `solend_withdraw` instruction is rejected with `ForbiddenIx`, reverting the entire transaction including the start. This blocks efficient liquidation of Solend-collateralized accounts and elevates bad-debt risk for that class of positions during the receivership window. The guard itself (the whitelist) is the blocker — there is no workaround within a single tx.

Severity is High (4), not Critical: the receiver can still withdraw/repay non-Solend collateral in the same tx, the limitation is fixable without migration, and there is no funds-loss or theft vector and no permanent bricking of accounts. The original claim of "permanently irrecoverable bad debt" is overstated — this is a bounded missing-whitelist DoS specific to `ASSET_TAG_SOLEND` banks.

**Proof-of-Concept sketch**

1. An account holds `ASSET_TAG_SOLEND` collateral and becomes unhealthy.
2. A liquidator constructs a liquidation tx: `start_liquidation` (first ix), `solend_withdraw` (to seize Solend collateral), `end_liquidation` (last ix).
3. `start_liquidation` calls `validate_ixes_exclusive` over the whole tx.
4. The helper encounters the `solend_withdraw` discriminator, which is not in the allowlist, and returns `MarginfiError::ForbiddenIx`.
5. The entire transaction reverts. The Solend collateral cannot be seized; the account stays unhealthy.

**Recommendation**

1. Define a `SOLEND_WITHDRAW` discriminator in `ix_discriminators` (`type-crate/src/constants.rs`), computed from the actual `solend_withdraw` instruction (and add the corresponding `ix_utils` test that validates the hash, as the existing TODO requests).
2. Add `&ix_discriminators::SOLEND_WITHDRAW` to the allowlist in `liquidate_start.rs:183-194` (and to any analogous deleverage whitelist).
3. Add a regression test that performs a full liquidation of a Solend-tagged account end-to-end (start, solend_withdraw, end) to lock in the behavior.
4. As a process fix for the underlying `TODO` pattern: make the integrator-withdraw allowlist a single shared constant derived from the set of registered integrators, so future integrations cannot silently miss it.

---

## 3. Unconfirmed / Informational Candidates

The following candidates were surfaced during review but were **refuted, downgraded, or not independently confirmed** in this first pass. They are listed for completeness and follow-up. **Do not treat these as confirmed bugs** — several have meaningful mitigations or are not reachable under current on-chain constraints. Each should be independently re-verified before any action.

| # | Title | Reported Sev | Status / Note | Location |
|---|-------|--------------|---------------|----------|
| C-1 | Borrow/partial-withdraw share arithmetic rounds in user's favor (vault shortfall) | 4 | Unconfirmed. Per-op loss bounded <1 token; rounding directions elsewhere verified conservative. Needs aggregate-impact modeling. | `marginfi_account.rs:1910` |
| C-2 | `withdraw_all` floors transfer + credits dust to insurance fees, but borrow/partial-withdraw lack ceiling correction | 3 | Unconfirmed accounting asymmetry; dust-level. | `marginfi_account.rs:1675` |
| C-3 | Tokenless repay (risk_admin) records fake inflow in rate limiter before eligibility check | 3 | Medium-confidence; requires risk_admin privilege; effect is rate-limiter headroom skew, not direct theft. | `repay.rs:92` |
| C-4 | `accrue_interest` timestamp conversion uses `unwrap()` — panics if clock goes backward | 2 | Should not occur under normal Solana clock; conditional on a future-dated `last_update`. | `bank.rs:470` |
| C-5 | `collect_bank_fees` uses snapshot `available_liquidity` not re-read from vault | 2 | Low; SPL transfers fail before over-withdrawal; DoS-only, no theft. | `collect_bank_fees.rs:53` |
| C-6 | StakedWithPythPush: confidence interval not scaled by stake-pool exchange rate | 5 | High-confidence per reporter but NOT independently confirmed. Practical error small near 1:1 rates; could mis-state health under high divergence. Strong follow-up candidate. | `price.rs:280-292` |
| C-7 | StakedWithPythPush: panic on non-`Stake` stake-account state, permanent bank DoS | 6 | High-confidence per reporter but NOT independently confirmed. Trigger (pool deactivation) is external to marginfi. Strong follow-up candidate. | `price.rs:258-260` |
| C-8 | StakedWithPythPush: unchecked i128 to i64 cast panics when `lst_supply` tiny | 3 | Medium; largely self-inflicted by pool creator but could DoS co-depositors. | `price.rs:285-292` |
| C-9 | Stale oracle on any position blocks liquidation (maintenance health DoS) | 4 | Medium; remaining accounts are caller-supplied; conditional on oracle outage + multi-position account. | `marginfi_account.rs:1291-1302` |
| C-10 | `KaminoHarvestReward`: `user_reward_ata` has no ownership/mint constraint | 4 | Mitigated: authority must own ATA and destination is locked to global fee wallet; no attacker drain. Residual: unintended drain of authority-owned vaults to fee wallet. | `kamino/harvest_reward.rs:80` |
| C-11 | Kamino deposit credits collateral-share delta with +/-1 token tolerance | 3 | Dust-level over-credit; only aggregate-exploitable; no permissionless drain. | `kamino/deposit.rs:77` |
| C-12 | JupLend withdraw: `claim_account` fully unchecked (documented) | 2 | Known protocol rough edge; JupLend ignores the field today; future-validation maintenance risk only. | `juplend/withdraw.rs:447` |
| C-13 | `StartLiquidation`: no group account / no `has_one = group` binding | 4 | Mitigated: downstream withdraw/repay carry `has_one = group` and enforce pauses; gap is bypassing group-level pause at *start*. | `liquidate_start.rs:205` |
| C-14 | `super_admin_deposit`: Token-2022 transfer-fee tokens inflate `asset_share_value` | 3 | Conditional: requires a T22 fee-bearing token tagged DEFAULT/SOL; uncommon but not blocked on-chain. | `super_admin_deposit.rs:21` |
| C-15 | `InitLiquidationRecord`: no authority check on `marginfi_account` (permissionless record creation) | 2 | Griefing only; PDA is seed-unique per account; no fund loss; record confers no powers until liquidation starts. | `init_liquid_record.rs:29` |
| C-16 | Receivership: any signer can withdraw/repay during order execution (`allow_order_execution` bypass) | 4 | Medium; invariant re-checked at `end_execute_order` via `check_health_and_verify_unchanged`; residual is mid-execution interference / keeper DoS. | `marginfi_account.rs:93` |

> Note: C-6 and C-7 (StakedWithPythPush oracle confidence scaling and stake-account-state panic) are the most promising unconfirmed candidates and are recommended as the first targets for a deeper second pass. They were reported with high confidence but were not part of the independently confirmed set.

---

## 4. Coverage & Methodology

**This was an AI-assisted FIRST-PASS review, not an exhaustive audit.** It focused on the highest-value code paths of a ~29k-LOC program. It did not cover every instruction, every edge case, or any deploy-time / on-chain operational concerns (program upgrade authority, multisig/admin key custody, bank configuration governance, oracle account provisioning, migration scripts). Those must be verified separately.

### Files read and traced in full

**Core accounting / instructions (`marginfi_account/`, `marginfi_group/`):**
deposit, withdraw, borrow, repay, flashloan, liquidate, liquidate_start, liquidate_end, order, init_liquid_record, initialize, transfer_account, close, close_balance, freeze, emissions, handle_bankruptcy, collect_bank_fees, super_admin_deposit, super_admin_withdraw, purge_delev_balance, configure_bank, configure_bank_lite, configure_rate_limits, add_pool, add_pool_permissionless, accrue_bank_interest.

**State:**
`marginfi_account.rs` (full — `BankAccountWrapper`, `increase_balance_internal`, `decrease_balance_internal`, `withdraw_all`, `repay_all`, `get_health_components`, `calc_weighted_asset/liab_value_standalone`, `calc_weighted_value_cached`, `check_pre/post_liquidation`, `check_account_init_health`, `LendingAccountImpl`), `bank.rs` (full — `socialize_loss`, `accrue_interest`, `change_asset/liability_shares`), `interest_rate.rs` (full), `price.rs` (full — all `OracleSetup` arms, Pyth/Switchboard `load_checked`, `get_confidence_interval`, exchange-rate scaling for all composite oracle types), `marginfi_group.rs`.

**Integrations (full):**
kamino (deposit, withdraw, harvest_reward, init_obligation, add_pool), drift (deposit, withdraw, harvest_reward, init_user, add_pool), juplend (deposit, withdraw, init_position, add_pool). Plus the mock state types and integration utils for tracing only (the `*-mocks` crates themselves are out of scope).

**Utils / config:** `utils/general.rs` (full), `utils/kamino.rs`, `ix_utils.rs`, `constants.rs`, `lib.rs`.

### Verified safe in this pass

- Health-check enforcement: `check_account_init_health` is called after every borrow/withdraw; health checks run after all balance mutations.
- Utilization-ratio check on every non-liquidation balance decrease.
- Vault PDA seed constraints and bump verification on all transfer paths; `deposit_spl_transfer` enforces `to == liquidity_vault`; withdrawal `transfer_checked` uses `liquidity_vault_authority` PDA.
- Share-value manipulation infeasible: PDA-only vault access; first-depositor inflation attack not possible (`share_value` initialized to 1.0).
- Share-math rounding directions: assets floor, liabilities ceil (conservative for the protocol on the primary paths).
- Liquidation pre/post health invariants; liquidation math (`liab_amount_liquidator`, `liab_amount_final`, insurance-fund fee); post-liquidation health-improvement invariant.
- `socialize_loss` correctly clamps at zero; bankruptcy equity threshold sound.
- Interest curve: `rate_from_u32` scaling and `validate_seven_point` guards.
- Oracle account key binding via `check_primary_oracle_key` / `bank_config.oracle_keys`; Pyth feed_id binding via PDA derivation; Switchboard and Kamino/Drift/Solend/JupLend staleness checks present.
- Integration program IDs are hardcoded constants with `#[account(address=...)]`; bank `has_one` binds integration account keys; obligation `deposits[0]`-only constraint enforced by two distinct Anchor constraints; Drift spot-position indexing enforced by `validate_spot_position`.
- Flashloan CPI guard (stack-height + sysvar) sound; `is_signer_authorized` correctly forbids self-receivership.
- Fee-collection ATA validation correct.

### Not covered / limitations

- Not every instruction or branch was exhaustively analyzed (large codebase, first pass).
- No dynamic testing, fuzzing, or formal verification was performed.
- Deploy-time, governance, admin-key, and oracle-provisioning operational risks were not assessed.
- The unconfirmed candidates in Section 3 were not all independently re-verified; they reflect single-pass observations of varying confidence.

---

## 5. Disclaimer

This report was produced by an AI-assisted automated security review and represents a **first-pass, non-exhaustive** analysis of the in-scope code. The absence of a finding in this report is **not** a guarantee that the code is free of vulnerabilities. Severity ratings reflect the reviewer's judgment in this pass and may differ under deeper analysis or different threat models.

**All findings — including the single confirmed finding (F-1) and every candidate in Section 3 — MUST be independently re-verified against the current source before any bug-bounty submission, remediation, or public disclosure.** Do not submit any item from this report to a bug-bounty program without first reproducing it and confirming it has not already been fixed or mitigated. The author accepts no liability for actions taken on the basis of this report.
