# Security Audit Report — Kamino Lending (klend)

**Repository:** Kamino Lending (klend)
**Scope:** PROGRAM — C:/Users/felip/auditor_validation/Kamino/klend/programs/klend
**Audit type:** AI-assisted first-pass security review
**Date:** 2026-06-19
**Auditor:** Automated security review agent (Claude)

---

## 1. Executive Summary

Kamino Lending is a Solana lending protocol (~27k LOC) deployed on mainnet with >$10M TVL. It consumes Pyth, Switchboard, and Scope oracles and supports Token-2022 mints. This first-pass review prioritized the highest-value paths: reserve math and accounting, the oracle ingestion pipeline, the liquidation/health-factor logic, and handler-level account validation.

### Repository Risk Score: 4 / 10 (Medium)

The score equals the highest CONFIRMED finding severity. One genuine but conditional arithmetic/DoS issue was confirmed in the liquidation path. No confirmed loss-of-funds or unauthorized-access vulnerabilities were found in the reviewed paths. A number of additional candidates were investigated and either refuted, found to be by-design, or judged too low-confidence/edge-case to confirm in this pass (see Section 3).

**Plain-language verdict:** The core protocol invariants reviewed (vault-balance checks after transfers, cToken rounding direction, fee lifecycle net-zero accounting, flash-loan repayment enforcement, market-authority PDA signing, Token-2022 extension whitelisting, obligation ownership constraints) appear sound. The single confirmed issue is a panic-based denial of service that can block liquidation of dust-sized collateral slices on a reserve that has already been impaired by a socialized-loss event — a real but conditional edge case, not a direct theft vector.

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 0 |
| High (7-8) | 0 |
| Medium (4-6) | 1 |
| Low (1-3) | 0 |
| **Total** | **1** |

---

## 2. Confirmed Findings

### KL-01 — Protocol liquidation fee minimum-of-1 causes integer underflow when collateral redeems to zero liquidity

| | |
|---|---|
| **Severity** | Medium (4 / 10) |
| **Category** | Arithmetic / DoS |
| **Location** | programs/klend/src/lending_market/lending_operations.rs:2181 |
| **Confidence** | Medium |

**Description**

In the liquidate-and-redeem path, after redeeming collateral to liquidity, the protocol computes a liquidation fee and subtracts it from the withdrawn liquidity amount using plain unchecked u64 subtraction:

```rust
let protocol_liquidation_fee = liquidation_operations::calculate_protocol_liquidation_fee(
    withdraw_liquidity_amount,
    liquidation_bonus_rate,
    protocol_liquidation_fee_pct,
);
let net_withdraw_liquidity_amount = withdraw_liquidity_amount - protocol_liquidation_fee; // line 2181
```

calculate_protocol_liquidation_fee enforces a minimum return value of 1 (max(protocol_fee, 1), liquidation_operations.rs:960). When the collateral being withdrawn redeems to a floor-rounded liquidity value of 0, the expression becomes 0 - 1. With overflow-checks = true (klend/Cargo.toml:6,12), this panics and aborts the transaction.

The path to a zero withdraw_liquidity_amount is:
- post_liquidate_redeem (line ~2158) calls redeem_reserve_collateral, which returns withdraw_liquidity_amount = collateral_exchange_rate.collateral_to_liquidity(withdraw_collateral_amount) (reserve.rs:451), floor-rounded (reserve.rs:1404-1407).
- The two reserve withdraw helpers (reserve.rs:887-898, 901-913) guard only on > available, not on == 0, so a 0 liquidity amount is accepted; redeem_collateral burns the non-zero ctoken amount and returns 0.
- calculate_protocol_liquidation_fee(0, ...) then returns 1, producing 0 - 1 at line 2181.

The only validation guard (min_acceptable_received_liquidity_amount check, line 2189) runs AFTER the subtraction, so it cannot prevent the panic.

**Reachability / preconditions**

This requires the collateral exchange rate to be below 1, so that a non-zero ctoken amount floors to 0 liquidity. Under normal interest accrual the rate is monotonically >= 1 (INITIAL_COLLATERAL_RATE = ONE, consts.rs:42), so collateral_to_liquidity(c) >= c >= 1 and the bug cannot trigger.

The rate can only drop below 1 after a socialize_loss / forgive_debt event impairs the reserve: forgive_debt reduces borrowed_amount_sf (and thus total_supply, reserve.rs:1123-1128) without burning ctokens, driving total_supply below mint_total_supply. socialize_loss requires the losing obligation to be fully liquidated first (line 2317-2319), but the resulting rate drop is global to the reserve and affects other obligations holding it as collateral. The market_value guard (line 2034) uses the full non-floored deposited_amount, so it stays non-zero even when a small partial withdraw floors to 0.

This was confirmed against upstream Kamino master — the subtraction is unchecked there too, so this is genuine production code, not an injected bug.

**Impact**

A liquidation that targets a dust-sized collateral slice on an already-impaired reserve (post socialized-loss, exchange rate < 1) panics and aborts. The affected dust slices become unliquidatable through that path. The original "permanently unliquidatable / traps bad debt" framing is overstated: a liquidator can usually supply a larger liquidity_amount so that withdraw_collateral_amount floors above 0, avoiding the dust panic. The genuine, durable impact is blocking liquidation of dust-sized slices on an already-impaired reserve, plus a transaction-level DoS for the specific malformed call.

**PoC sketch**

1. Reserve R suffers a socialized-loss event (an obligation is fully liquidated, then socialize_loss/forgive_debt reduces borrowed_amount_sf), dropping R's collateral exchange rate below 1.
2. A separate obligation O holds a small amount of R as collateral and is liquidatable.
3. Liquidator calls liquidate_obligation_and_redeem_reserve_collateral selecting a withdraw_collateral_amount small enough that collateral_to_liquidity(amount) floors to 0.
4. withdraw_liquidity_amount = 0, calculate_protocol_liquidation_fee returns 1, line 2181 computes 0 - 1, the runtime panics with overflow, and the transaction aborts.

**Recommendation**

Replace the unchecked subtraction with a saturating or checked operation and explicitly handle the zero case, e.g.:

```rust
let net_withdraw_liquidity_amount = withdraw_liquidity_amount.saturating_sub(protocol_liquidation_fee);
```

and/or cap protocol_liquidation_fee to min(protocol_liquidation_fee, withdraw_liquidity_amount) before subtracting. Additionally, consider making calculate_protocol_liquidation_fee return 0 (not the enforced minimum of 1) when its input liquidity amount is 0, since there is no liquidity to take a fee from. Add an explicit guard rejecting (or short-circuiting) redemptions where withdraw_liquidity_amount == 0 so dust slices are handled deterministically rather than panicking.

---

## 3. Unconfirmed / Informational Candidates

The following candidates were investigated during the review and were refuted, found to be by-design, or judged too low-confidence / edge-case to confirm. They are listed for completeness and to guide deeper follow-up review. They are NOT confirmed vulnerabilities and should not be treated as such.

| # | Title | Location | Raw sev | Confidence | Disposition |
|---|-------|----------|---------|-----------|-------------|
| C-01 | Panic on negative Pyth i64 price — DoS of refresh_reserve | prices/pyth.rs:75 (also :95) | 5 | high | Plausible organic DoS during Pyth circuit-breaker events; account is admin-gated, not attacker-controlled. Worth fixing (use try_from with error, not unwrap). Not confirmed as exploitable in this pass. |
| C-02 | LIQUIDATION_CHECKS omits TWAP_CHECKED / HEURISTIC_CHECKED | state/last_update.rs:46 | 4 | medium | Risk amplifier during genuine oracle instability; attacker cannot manufacture divergence without manipulating the feed. Needs design-intent confirmation. |
| C-03 | Auto-deleverage liquidations skip collateral-priority ordering | state/liquidation_operations.rs:229-239 | 4 | high | Match arm omits deleverage reasons; likely partially by-design. Suboptimal ordering, not a direct theft. Needs design-intent confirmation. |
| C-04 | RepayObligationLiquidity: obligation owner not verified | handlers/handler_repay_obligation_liquidity.rs:114-156 | 4 | high | Repaying another's debt from your own funds is standard lending behavior. Enables liquidation griefing at attacker's own cost; no theft. Likely by-design. |
| C-05 | Switchboard staleness uses slot-based timestamp approximation | prices/switchboard.rs:50 | 3 | medium | Matches Scope reference implementation's acknowledged limitation; last_update_timestamp field exists but unused. Marginal staleness window under congestion. |
| C-06 | Unchecked u64 sub in calculate_borrow_all_available | state/reserve.rs:767 | 3 | low | Worst-case micro-borrow + near-max-fee corner; panics revert atomically, no fund loss. |
| C-07 | Small-position full-liquidation: full debt settled vs partial collateral | state/liquidation_operations.rs:349-363 | 3 | high | Intentional socialized-loss behavior; concern is only that no bad-debt event is emitted (monitoring gap). |
| C-08 | Unchecked u128 add of pending_referrer_fees_sf in compound_interest | state/reserve.rs:1268 | 3 | low | Requires enormous accumulated fees over long time; not practically reachable. |
| C-09 | WithdrawProtocolFees: no signer required (permissionless sweep) | handlers/handler_withdraw_protocol_fees.rs:47-93 | 3 | high | Destination fixed to fee_collector ATA with no delegate; no theft, only loss of timing control. |
| C-10 | SeedDepositOnInitReserve: arbitrary signer can fund initial deposit | handlers/handler_seed_deposit_on_init_reserve.rs:57-84 | 3 | high | Caller donates funds; guarded by has_initial_deposit(); minimal practical impact. |
| C-11 | total_supply() unchecked Fraction subtraction wrap | state/reserve.rs:1123-1128 | 2 | low | Only reachable if reserve already insolvent; not practically reachable. |
| C-12 | Combined deposit path skips is_ctoken_usage_blocked check | lending_market/lending_checks.rs:194-213 | 2 | medium | Circumvents admin intent on combined path; no direct economic harm. Worth aligning with standalone path. |
| C-13 | Pyth EMA/TWAP reuses spot publish_time | prices/pyth.rs:62 | 2 | high | TWAP age parameter has no independent effect for Pyth reserves; config-clarity issue, not exploitable. |
| C-14 | Highest borrow-factor priority enforced only for LtvExceeded | state/liquidation_operations.rs:223-228 | 2 | medium | Partially by-design for auto-deleverage; suboptimal ordering. |
| C-15 | flash_repay_checks uses positional account index 3 | lending_market/flash_ixs.rs:63 | 2 | low | Full account-by-account match enforced on borrow side via flash_borrow_check_matching_repay. |
| C-16 | InitObligationFarmsForReserve: tag >= 4 allows arbitrary seed accounts | handlers/handler_init_obligation.rs:102-112 | 2 | medium | PDA seeds include owner + market; no direct exploit; may confuse off-chain tooling. |

---

## 4. Coverage & Methodology

**This is an AI-assisted FIRST-PASS review. It is NOT exhaustive.** Deploy-time configuration, on-chain operational procedures, admin key management, and runtime/governance assumptions were NOT verified. Economic/game-theoretic simulation was not performed.

### Areas read and traced

**Area 1 — Reserve math & accounting (read fully):** src/state/reserve.rs (CollateralExchangeRate math, total_supply, compound_interest, fee accounting, deposit/redeem/borrow logic), src/lending_market/lending_operations.rs (deposit, redeem, borrow, repay, liquidate_and_redeem, flash borrow/repay, socialize_loss, accumulate_referrer_fees, rollover), src/lending_market/lending_checks.rs (all pre/post transfer invariant checks), all deposit/redeem/flash/liquidate/socialize/withdraw-queue/cancel-ticket handlers, src/utils/fraction.rs, src/utils/consts.rs.

Verified safe: FIFO ticket ordering via PDA seed; initial-deposit anti-inflation guard (MIN_INITIAL_DEPOSIT_AMOUNT seeded 1:1); vault-balance invariant checks after every transfer; socialize_loss access control (lending_market_owner); flash-loan repayment enforcement via instruction sysvar; cToken rounding direction (protocol-favorable); fee lifecycle (pending->accumulated net-zero to total_supply); forgive_debt capped to borrowed_amount.

**Area 2 — Oracle pipeline (read fully):** prices/mod.rs, pyth.rs, switchboard.rs, scope.rs, checks.rs, types.rs, utils.rs. Traced full ingestion path from refresh_reserve -> get_price -> get_most_recent_price_and_twap -> get_validated_price into borrow/liquidation checks.

Verified: PriceStatusFlags definitions and all is_stale() call sites; Pyth account key validation (check_pyth_acc_matches); Switchboard owner/discriminator checks; Scope discriminator check; last_update_timestamp field existence in sbod-itf; Scope confidence-interval check absent by design; TWAP config validity via is_twap_config_valid(); oracle selection (most-recent timestamp wins); Pyth eager / Switchboard lazy confidence checks at 2% threshold; Scope chain multiplication overflow protected by checked_mul.

**Area 3 — Liquidation / health-factor (read fully):** liquidation_operations.rs (all 962 lines), lending_operations.rs (all 4528 lines), obligation.rs (all 1672 lines), reserve.rs (key sections), last_update.rs, lending_checks.rs, handler_liquidate_obligation_and_redeem_reserve_collateral.rs.

Verified safe: health-factor computation uses atomically-set stored sf values; borrow LTV guard via unhealthy_loan_to_value(); repay updates elevation-group trackers using settled (not repaid) amount; accrue_interest uses U256 BigFraction to avoid overflow; collateral_exchange_rate zero-supply guard; flash-loan repay amount validation; liquidation staleness requires LIQUIDATION_CHECKS; PriceStatusFlags intersect across reserves on refresh.

**Area 4 — Handler / account validation (all 55 handlers read fully):** borrow, repay, withdraw-collateral, liquidation, flash loan (both sides), init-reserve, init-obligation, init/refresh-farms, withdraw-protocol-fees, redeem-fees, withdraw-referrer-fees, socialize-loss, rollover, fill-borrow-order, queue handlers, recover/cancel-ticket, update/transfer-ownership handlers, seed-deposit, clone-reserve-config, topup-rewards, deposit handlers, mark-for-deleveraging. Plus flash_ixs.rs, farms_ixs.rs, kvault_ixs.rs, ix_utils.rs, constraints.rs, permissioning.rs, refresh_ix_utils.rs.

Verified safe: Token-2022 extension whitelist (TransferFeeConfig 0 bps, no TransferHook program, ConfidentialTransfer auto_approve=false, Pausable not paused); market-authority PDA seeds on all transfer-signing paths; obligation has_one = owner on all write-sensitive instructions (except repay, which is by-design open); farming CPI validates delegatee == obligation; flash-loan two-way account matching.

---

## 5. Disclaimer

This report was produced by an automated, AI-assisted security review process and represents a FIRST-PASS examination of the highest-value code paths. It does NOT constitute a complete or exhaustive audit, a guarantee of security, or professional financial/legal advice. Absence of a finding in a given area does not imply that area is free of vulnerabilities.

The single confirmed finding (KL-01) is conditional and edge-case in nature, with confidence rated medium. Its preconditions (a prior socialized-loss event impairing the reserve, plus a dust-sized withdraw) limit practical impact, and a competent liquidator can frequently avoid the panic by adjusting the withdraw amount.

**All findings in this report — including the confirmed finding — MUST be independently re-verified against the current deployed source and reproduced (e.g., via a localnet/test harness) before any bug-bounty submission or remediation action.** Severity ratings are advisory and should be re-assessed in the context of program-specific bounty rules and live economic conditions.
