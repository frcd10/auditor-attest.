# Security Audit Report — damm-v2 (cp-amm)

## 1. Executive Summary

| Field | Value |
|-------|-------|
| Repository | damm-v2 (Meteora) |
| Program | cp-amm — constant-product AMM/DEX |
| Scope | PROGRAM |
| Program path | C:/Users/felip/auditor_validation/Meteora/damm-v2/programs/cp-amm |
| Deployment | Mainnet, TVL > $10M |
| Notable surface | Token-2022 + transfer hooks, pinocchio fast-path swap, compounding & concentrated liquidity math |
| Audit type | AI-assisted FIRST-PASS source review |
| Date | 2026-06-19 |

### Repository Risk Score: LOW (no confirmed findings)

Plain-language verdict: In this first-pass review, no confirmed exploitable vulnerabilities were identified. Every candidate raised during the pass was either (a) refuted by an independent skeptic verification step, or (b) found to be a low-confidence, latent, or defense-in-depth concern that is mitigated by existing controls (most commonly transfer_checked enforcing the correct mint, SafeMath preventing silent overflow/underflow, and PDA/signer constraints gating privileged paths). The constant-product and concentrated-liquidity swap math, fee splitting/capping, slippage enforcement, position lifecycle, and the pinocchio fast-path account validation were each traced and verified safe along the paths reviewed.

Because there are zero confirmed findings, the Repository Risk Score (defined as the highest confirmed severity) is LOW. This is NOT a statement that the program is bug-free — see the Coverage & Methodology and Disclaimer sections for the limits of this pass.

### Severity Distribution (CONFIRMED findings only)

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Total confirmed | 0 |

---

## 2. Confirmed Findings

None.

No finding survived independent skeptic verification in this pass. The confirmed-findings set is empty. Candidates that were investigated but not confirmed are listed in Section 3 for transparency; they are documented as informational only and should NOT be treated as confirmed vulnerabilities.

---

## 3. Unconfirmed / Informational Candidates

The following candidates were surfaced during the review but were refuted, mitigated, or rated low-confidence. They are listed for completeness and to guide any deeper follow-up. None is a confirmed vulnerability. Severities below are the RAW candidate severities (pre-verification) and are intentionally NOT rolled into the risk score.

| # | Title | Location | Raw sev | Conf. | Why not confirmed |
|---|-------|----------|---------|-------|-------------------|
| 1 | Compounding pool reserve drift: claim_position_fee does not update pool.token_a_amount/token_b_amount | src/instructions/ix_claim_position_fee.rs:86-109 | 7 | high | Strongest candidate. For Compounding pools, claiming LP fees may not decrement on-chain reserve fields used by CompoundingLiquidity swap math, risking reserve/vault drift over time. NOT independently confirmed: needs verifying whether compounding pools use these fields as live reserves at claim time and whether fee accounting already excludes claimed amounts. Flagged for priority manual re-verification. |
| 2 | assert!() panic instead of safe PoolError return in concentrated-liquidity math | concentrated_liquidity.rs:316,372-373,395-396 | 4 | high | Bare assert! aborts the VM instead of returning a recoverable error. Only reachable if pool state is already corrupted; all known call sites enforce the invariants. Hardening / code-quality. |
| 3 | initialize_reward: operator passed as remaining_account[1] with no PDA seed verification | operator/ix_initialize_reward.rs:92-104 | 4 | low | Account is owner+discriminator checked and whitelisted_address verified; stated to be intentional design. No privilege escalation demonstrated. |
| 4 | CompoundingLiquidity remove-liquidity donation/sandwich inflation | compounding_liquidity.rs:46 | 4 | medium | Vault donation could skew per-unit value; DEAD_LIQUIDITY mitigates first-deposit inflation, slippage bounds victim loss. No concrete profitable attack constructed. |
| 5 | claim_protocol_fee2: receiver token account owner not validated against treasury at cp-amm layer | operator/ix_claim_protocol_fee2.rs:45-71 | 4 | low | Destination enforcement delegated to external protocol_fee_program via const_pda::protocol_fee_authority signer. Mitigated under current design. |
| 6 | can_remove_liquidity ignores pool_status (allows removal from disabled pools) | src/pool_action_access/permissionless.rs:46 | 3 | high | Confirmed INTENTIONAL design (let LPs exit a disabled pool). Emergency-freeze-DoS, not theft. |
| 7 | Compounding reserve staleness on fee/protocol-fee claim (xyk pricing under-quote) | state/pool.rs:785-858 | 3 | medium | Related to #1; gradual price under-quote rather than direct theft. Not confirmed. |
| 8 | refresh_vesting: owner is UncheckedAccount, rent lamports sent to unverified owner | src/instructions/ix_refresh_vesting.rs:31 | 3 | medium | NFT ownership check constrains valid owner; third party can trigger close but lamports still go to NFT holder. Low impact. |
| 9 | Primitive subtraction upper-lower in get_delta_amount_a_unsigned_unchecked | concentrated_liquidity.rs:312 | 3 | low | Reachable only via caller logic bug; price-range validation at init enforces lower < upper. Hardening. |
| 10 | ClaimRewardCtx: reward_mint not constrained to pool.reward_infos[index].mint | src/instructions/ix_claim_reward.rs:30-51 | 3 | high | transfer_checked rejects mismatched mint, CPI reverts. No drain; only misleading event logs. Defensive. |
| 11 | fund_reward / withdraw_ineligible_reward: reward_mint not validated against stored mint | ix_fund_reward.rs:22-24, ix_withdraw_ineligible_reward.rs:20-22 | 3 | medium | Transfer reverts on wrong mint; theoretical accounting mismatch but CPI failure prevents the path. Not confirmed. |
| 12 | Partial-fill swap output fee uses trade_fee_numerator from pre-partial-fill input | state/pool.rs:657 | 2 | medium | Current fee modes make numerator amount-independent on the output path, so no effect today. Latent risk only if an amount-dependent output fee is added later. |
| 13 | Referral token account mint not validated in pinocchio swap path | instructions/swap/ix_swap.rs:194 | 2 | high | Mismatched-mint -> TransferChecked fails -> tx reverts (no theft). Same-mint not-owned account could divert only the referral portion; not a fund drain. |
| 14 | split_fees: referral_fee_percent writable but only ever set from constant | state/fee.rs:263-275 | 2 | low | Field only written from HOST_FEE_PERCENT at init; SafeMath errors on corrupt value. Theoretical. |
| 15 | update_pool_fees: compounding_fee_bps can be set to 0 for a Compounding pool | operator/ix_update_pool_fees.rs:92-98, state/pool.rs:1188-1196 | 2 | high | Requires operator action/collusion; no direct theft. Invariant enforced at init but not on update. |
| 16 | Dynamic fee transient variable_fee before cap | state/fee.rs:376-393,122-138 | 2 | low | Self-refuted: get_total_fee_numerator clamps to max_fee_numerator (99%) before use; cap always applies. Confirmed safe. |
| 17 | claim_position_fee: no pool-status access-control check | src/instructions/ix_claim_position_fee.rs:73 | 2 | high | Intentional (protect LP fee rights), same pattern as remove-liquidity. Each position claims only its own accrued fees. No theft. |
| 18 | p_load_mut_unchecked skips owner/discriminator check on pool in pinocchio path | src/instructions/swap/ix_p_swap.rs:78 | 2 | high | validate_p_accounts calls p_load_mut_checked first (both checks present) before the unchecked re-borrow. Code-quality, not a bypass. |
| 19 | update_reward_duration: wrong error code (RewardInitialized vs RewardUninitialized) | operator/ix_update_reward_duration.rs:30 | 1 | high | Condition correct; only the emitted error label is misleading. No security impact. |

Note on #1 / #7: the compounding-pool reserve-accounting cluster is the highest-rated raw candidate and the most worthwhile target for deeper manual verification, but it was NOT independently confirmed in this pass and is therefore excluded from the risk score. Do not treat it as a confirmed bug without reproducing the reserve drift end-to-end.

---

## 4. Coverage & Methodology

This was an AI-assisted FIRST-PASS source-code review. It is NOT exhaustive and does not replace a full manual audit, formal verification, or economic/game-theoretic modeling.

### Areas read and traced

Swap path (area 1): swap_exact_in.rs, swap_exact_out.rs, swap_partial_fill.rs, ix_swap.rs (Anchor context + validate_p_accounts), ix_p_swap.rs (full pinocchio handler incl. single-swap rate-limiter), pool.rs (get_swap_result_from_exact_input/output/partial_input, apply_swap_result), fee.rs (FeeMode, PoolFeesStruct, split_fees, excluded/included fee amounts, DynamicFeeStruct), concentrated_liquidity.rs (all calculate_*, get_delta_amount_a/b, get_next_sqrt_price_*), compounding_liquidity.rs, utils_math.rs, u128x128_math.rs, fee_rate_limiter.rs, fee_time_scheduler.rs, permissionless.rs, constants.rs, p_helper.rs.

Fee accounting (area 2): state/fee.rs, math/fee_math.rs, state/pool.rs, state/position.rs, state/config.rs, state/operator.rs, params/fee_parameters.rs, constants.rs, const_pda.rs, access_control.rs, ix_claim_position_fee.rs, operator/ix_claim_protocol_fee.rs, operator/ix_claim_protocol_fee2.rs, operator/ix_update_pool_fees.rs, operator/ix_zap_protocol_fee.rs, operator/ix_fix_pool_fee_params.rs, plus swap and compounding handlers and utils/p_helper.rs.

Liquidity lifecycle (area 3): ix_add_liquidity.rs, ix_remove_liquidity.rs, ix_create_position.rs, ix_close_position.rs, ix_claim_position_fee.rs, ix_lock_position.rs, ix_lock_inner_position.rs, ix_permanent_lock_position.rs, ix_split_position.rs, ix_split_position2.rs, ix_refresh_vesting.rs, all three pool-init handlers, state/pool.rs (apply_add/remove_liquidity, fee accounting, update_rewards), state/position.rs, state/vesting.rs, both liquidity handlers (incl. DEAD_LIQUIDITY guard), utils/token.rs, pool_action_access/permissionless.rs, math/safe_math.rs, math/u128x128_math.rs.

Instruction & account validation (area 4): all swap, liquidity, position, reward, pool-init, protocol-fee, and operator-admin instruction files; all state files; utils; access_control.rs; pool_action_access; const_pda.rs; concentrated/compounding liquidity handlers.

### Verified safe (high level)

- Slippage checks applied against after-transfer-fee output (exact-in and exact-out).
- get_excluded_fee_amount rounds Up (protocol-favorable; no fee bypass).
- sqrt-price update direction correct for both trade directions; FeeMode::get_fee_mode correctly maps collect_fee_mode x trade_direction.
- split_fees conservation (total in = total out) and fee capping at max_fee_numerator (99%).
- Protocol-fee destination enforced via treasury ATA (validate_ata_token) in v1; claim_protocol_fee2 gated by the protocol_fee_authority const PDA signer.
- Position close requires zero pending fees; NFT ownership enforced via amount == 1 and authority == owner; has_one = pool enforced on position-touching instructions.
- pool.liquidity invariant holds across permanent-lock and vesting; fee checkpoint updated before liquidity change.
- transfer_checked used in transfers (prevents mint cosplay); pinocchio path validates accounts (p_load_mut_checked) before the unchecked re-borrow.
- SafeMath used throughout reviewed math; no unchecked arithmetic found on primary paths (one primitive subtraction noted as hardening, candidate #9).
- Token-2022 transfer-hook support handled via is_supported_mint logic.

### Explicitly NOT covered

- Deploy-time configuration, upgrade authority, and on-chain operational/admin procedures.
- The external protocol_fee_program referenced by claim_protocol_fee2 (treated as a trusted dependency; its routing logic was not audited).
- Economic/MEV modeling beyond spot-checking specific sandwich/donation candidates.
- Compute-budget exhaustion, full instruction-permutation/CPI-reentrancy fuzzing, and formal verification of the AMM invariants.
- Off-chain SDK/client behavior and integration-side assumptions.
- Runtime/on-chain state of live mainnet pools (review is static source analysis only).

---

## 5. Disclaimer

This report is the product of an AI-assisted first-pass security review and is provided as-is, without warranty. It is NOT a comprehensive audit, a guarantee of security, or a substitute for a professional manual audit. Absence of confirmed findings means none were identified in this pass within the covered scope — it does NOT prove the program is free of vulnerabilities. Static review cannot rule out issues arising from on-chain state, deploy configuration, untrusted external programs, compute limits, or complex multi-instruction/economic interactions.

Before any bug-bounty submission: every candidate in Section 3 (and any later confirmed finding) MUST be independently re-verified, reproduced with a concrete proof-of-concept against the exact deployed program version, and validated against the relevant program bug-bounty scope and rules. Do not submit candidates from Section 3 as-is — they are unconfirmed and several are explicitly intentional design or mitigated by existing controls. Submitting unverified or out-of-scope reports may violate program rules.
