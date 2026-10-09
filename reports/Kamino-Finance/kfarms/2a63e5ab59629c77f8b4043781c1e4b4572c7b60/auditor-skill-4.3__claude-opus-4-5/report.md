# Security Audit Report -- Kamino Farms (kfarms)

## 1. Executive Summary

- Repository / Program: Kamino Farms (kfarms)
- Program path: C:/Users/felip/auditor_validation/Kamino/kfarms/programs/kfarms
- Scope: PROGRAM (on-chain Solana program; staking + reward-per-share distribution; Token-2022 with transfer hooks)
- Audit date: 2026-06-19
- Confirmed findings: 0
- Repository Risk Score: LOW (no confirmed findings; highest confirmed severity = none / 0)

### Plain-language verdict

In this first-pass review, no findings were confirmed as exploitable. Every candidate raised during reconnaissance was either refuted by direct code inspection or downgraded to low-confidence / informational status. The core reward-per-share accounting, stake/unstake principal handling, PDA and authority constraints, and Token-2022 extension validation all held up to scrutiny in the paths that were examined.

Notably, the recurring "unchecked arithmetic / overflow" theme across many candidates was not confirmed as a real vulnerability: the verification passes found that the critical reward-distribution paths are gated by cmp::min against rewards_available and use checked_add / checked_sub and wide-integer (Decimal / U128 / U256) intermediates where it matters. The reward_user_once "drain" theory was not substantiated, because it is gated behind a delegate_authority has_one constraint and a feature flag, and the harvest path physically transfers from the vault (an over-credit simply fails the transfer CPI rather than minting value).

This does not mean the program is provably bug-free. See Section 4 for coverage limits and Section 5 for the disclaimer.

### Severity distribution (CONFIRMED findings only)

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 0 |
| Medium   | 0 |
| Low      | 0 |
| Total    | 0 |

---

## 2. Confirmed Findings

None.

No finding survived independent verification in this pass. The program looked clean in the areas reviewed. As a result, the Repository Risk Score is LOW.

---

## 3. Unconfirmed / Informational Candidates

The following candidates were surfaced during reconnaissance but were refuted, mitigated by existing guards, or judged low-confidence on closer inspection. They are recorded for transparency and to guide any future deeper review. They are not confirmed vulnerabilities and should not be treated as such.

| # | Candidate (raised) | Location | Raised sev. | Status / why not confirmed |
|---|--------------------|----------|-------------|-----------------------------|
| 1 | reward_user_once credits unclaimed without rewards_available check, delegate drains vault | farm_operations.rs:738-743 | 8 | Unconfirmed. Gated by delegate_authority has_one + feature flag; harvest physically transfers from vault, so over-credit fails the CPI rather than minting value. |
| 2 | reward_user_once unchecked += panics/wraps | farm_operations.rs:738,743 | 5 | Unconfirmed. Requires privileged delegate + adversarial inputs; release builds do not wrap here in a fund-moving way. |
| 3 | set_stake unchecked u128 multiply underprices tally | farm_operations.rs:572 | 6 | Unconfirmed. Delegated-authority path with assert_eq invariants; no concrete over-harvest path demonstrated. |
| 4 | refresh_global_reward does not advance last_issuance_ts on zero-round | farm_operations.rs:929-932 | 4 | Unconfirmed. Curve integral noted mathematically correct; rate-change edge case is speculative. |
| 5 | harvest lacks vault-balance guard vs reward_user_once inflation | handler_harvest_reward.rs:70-92 | 7 | Unconfirmed. Same mitigation as #1; transfer CPI fails on overdraw. |
| 6 | user_refresh_reward unchecked add | farm_operations.rs:664 | 3 | Unconfirmed. reward bounded by rewards_available in normal flow. |
| 7 | Shared pending pool (deposit-warmup vs withdrawal-cooldown) exchange-rate contamination | stake_operations.rs:458 | 6 | Unconfirmed. Verification found conversion helpers and saturating/require guards; no concrete loss/underflow path reproduced. |
| 8 | Unchecked u64 overflow in reward-schedule cumulative (rps * elapsed) | state.rs:476 | 5 | Unconfirmed. Requires admin-set near-u64::MAX rps; not a permissionless exploit. |
| 9 | Unchecked add on slashed_amount_current/cumulative | farm_operations.rs:806 | 4 | Unconfirmed. Only at near-u64::MAX cumulative slashes; practically unreachable. |
| 10 | Unchecked add in deposit-cap check can wrap | state.rs:199 | 5 | Unconfirmed. Requires total_staked_amount near u64::MAX. |
| 11 | Unchecked add on rewards_issued_unclaimed (per-user/per-farm) | farm_operations.rs:738 | 4 | Unconfirmed. Privileged delegate precondition; harvest uses checked_sub. |
| 12 | Panic on u128->u64 downcast of oracle-adjusted reward | farm_operations.rs:926 | 6 | Unconfirmed. Requires extreme oracle/rps config; not demonstrated permissionless. |
| 13 | Unchecked overflow in reward-curve emission (period_amount/cumulative_amount) | state.rs:476-477 | 7 | Unconfirmed. Admin-controlled rps/curve; requires ~136-year / extreme inputs. |
| 14 | (dup of #1/#11) reward_user_once unchecked += | farm_operations.rs:738,743 | 7 | Unconfirmed. Duplicate; same mitigations. |
| 15 | Unchecked add on slashed amounts during unstake | farm_operations.rs:806-807 | 5 | Unconfirmed. Duplicate of #9. |
| 16 | Negative unix_timestamp cast to u64 wraps | state.rs:731 | 5 | Unconfirmed. Mainnet clock non-negative; latent test/devnet edge only. |
| 17 | Constant-reward unchecked u128 multiply | farm_operations.rs:883 | 6 | Unconfirmed. Requires large stake + large rps simultaneously; not reproduced. |
| 18 | most_recent_curve_starting_point stale sentinel index | state.rs:412-429 | 4 | Unconfirmed (author noted benign). from_points/validate require a u64::MAX sentinel. |
| 19 | stake() uses legacy token::transfer not transfer_checked | handler_stake.rs:47, token_operations.rs:49-66 | 6 | Unconfirmed. Verification found transfer-fee = 0 and hook-program checks enforced; no drift path confirmed. |
| 20 | withdraw_unstaked_deposits / withdraw_from_farm_vault legacy transfer | handler_withdraw_unstaked_deposits.rs:37, handler_withdraw_from_farm_vault.rs:34 | 5 | Unconfirmed. Same extension-validation mitigation. |
| 21 | (dup) reward_user_once inflate-then-drain | farm_operations.rs:738,743 | 7 | Unconfirmed. Duplicate; delegate-gated, transfer-bounded. |
| 22 | add_reward/withdraw_reward reward_index not bounds-checked in constraint | handler_add_reward.rs:90, handler_withdraw_reward.rs:89 | 4 | Unconfirmed. At worst a revert/DoS on a privileged-ish path; no fund extraction. |
| 23 | withdraw_treasury destination lacks authority constraint | handler_withdraw_treasury.rs:80-84 | 3 | Unconfirmed. Requires compromised global_admin; defense-in-depth only. |
| 24 | Identical PDA seeds for farm-vaults vs treasury-vaults authority | utils/consts.rs:8-9 | 2 | Unconfirmed. Distinct second seed keys + distinct account types; theoretical. |
| 25 | initialize_farm no extension validation on staking mint | handler_initialize_farm.rs:68 | 5 | Unconfirmed. Reward mints validated; staking-mint drift path not demonstrated end-to-end. |

Note: several candidates above are near-duplicates (the reward_user_once arithmetic cluster and the slashed-amount cluster). They are listed individually as raised, but represent overlapping theories that share the same mitigations.

---

## 4. Coverage & Methodology

### What this is

This is an AI-assisted FIRST-PASS security review. It is not exhaustive and is not a substitute for a full manual audit, formal verification, or economic/game-theoretic modeling. Findings (including the "unconfirmed" list) must be independently re-verified before being relied upon.

### What was read (source-level coverage)

Across multiple review passes, the following were read in full:

- Core logic:
  - src/state.rs -- FarmState, UserState, RewardInfo, RewardScheduleCurve structs and helpers (get_cumulative_amount_issued_since_last_ts, most_recent_curve_starting_point, can_accept_deposit, timestamp handling).
  - src/farm_operations.rs (full, ~1057 lines) -- initialize_reward, add_reward, withdraw_reward, refresh_global_reward(s), user_refresh_reward(s), user_refresh_stake, harvest, reward_user_once, set_stake, unstake, withdraw_unstaked_deposits, update_user_rewards_tally_on_stake_increase.
  - src/stake_operations.rs (full, ~610 lines) -- add/remove active stake, pending deposit/withdrawal helpers, convert_amount_to_stake, convert_stake_to_amount.
  - src/token_operations.rs -- transfer helpers (transfer_from_user, transfer_from_vault).
  - src/utils/ -- math.rs, consts.rs, constraints.rs, withdrawal_penalty.rs, plus scope/macros/accessors.
  - src/lib.rs -- error codes + instruction dispatch; types.rs.
- Handlers (all 26 reviewed; key ones in full): handler_harvest_reward, handler_refresh_farm, handler_refresh_user_state, handler_stake, handler_unstake, handler_reward_user_once, handler_set_stake_delegated, handler_add_reward, handler_withdraw_reward, handler_withdraw_unstaked_deposits, handler_initialize_reward, handler_initialize_farm, handler_deposit_to_farm_vault, handler_withdraw_from_farm_vault, handler_withdraw_slashed_amount, handler_withdraw_treasury, handler_update_farm_config.

### What was verified safe

- Reward distribution cannot be over-distributed via normal refresh: rewards_available is gated by cmp::min in refresh_global_reward, so the vault cannot be over-distributed through the standard refresh path.
- withdraw_reward enforces rewards_available > 0 and the schedule-default guard.
- unstake calls user_refresh_all_rewards before tally reduction; reward-tally reduction uses saturating_sub with a require_gt guard.
- Principal accounting: remove_active_stake asserts a user cannot unstake more than held; the unstake path caps stake_share_to_unstake via std::cmp::min.
- Arithmetic where it moves funds: checked_add/checked_sub guard rewards_available, rewards_issued_unclaimed decrement, and reward-per-share accumulation uses 192-bit Decimal; u64_mul_div uses U128 intermediate; full_decimal_mul_div uses U256 intermediate. Warmup/cooldown and treasury-fee/penalty bps values are range-bounded (<= 10000) and validated.
- Access control / PDAs: has_one / address constraints verified on privileged ops (farm_admin, global_admin, delegate_authority, withdraw_authority, pending_farm_admin); PDA seeds verified for farm_vault, reward_vault, reward_treasury_vault, farm_vaults_authority, and user_state.
- Double-issuance / double-harvest: blocked by the ts == last_issuance_ts early-exit guard within a transaction.
- Token-2022: validate_base_token_extensions rejects non-zero transfer fees and transfer-hook programs for reward mints; reward_index bounds-checked inline in the harvest handler; reward_user_once gated behind delegate_authority has_one + is_reward_user_once_enabled flag.

### What was NOT verified (out of scope / limits)

- Deploy-time and on-chain operational items: upgrade authority, program deployment configuration, governance/multisig of admin keys, and account initialization performed by off-chain tooling.
- Economic / incentive modeling: game-theoretic attacks, MEV, oracle-price manipulation economics, and reward-schedule parameterization risk.
- Compiler/build settings in practice: whether overflow-checks is enabled in the shipped release profile was reasoned about but not independently confirmed against the deployed artifact.
- Cross-program interactions with real Token-2022 mints carrying live extensions (hooks/fees) on-chain, beyond the validation logic in source.
- Exhaustiveness: not all of the 26 handlers were line-by-line dissected to the same depth; less-trafficked admin handlers received lighter review.

---

## 5. Disclaimer

This report was produced by an AI-assisted, first-pass review process and is provided as-is, without warranty. It does not constitute a guarantee that the program is free of vulnerabilities. Absence of confirmed findings reflects the limits of this pass, not a proof of correctness.

All findings -- including every item in the "Unconfirmed / Informational" section -- must be independently re-verified by a qualified human auditor before any action is taken, and in particular before any bug-bounty submission. Submitting unverified or refuted candidates to a bug-bounty program may be incorrect, wastes triage resources, and can harm the submitter standing. Re-confirm exploitability with a working proof-of-concept against the actual deployed program and its real configuration before relying on anything in this document.
