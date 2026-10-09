# Security Audit Report — Port Finance Variable Rate Lending

| Field | Value |
|---|---|
| Repository | PortFinance/variable-rate-lending |
| Scope | `token-lending/program` (on-chain lending program); staking program reviewed for CPI surface |
| Primary program | `port-finance-variable-rate-lending` — `declare_id!("Port7uDYB3wk6GJAw4KT1WpTeMtSu9bTcChBHkX2LfR")` (`token-lending/program/src/lib.rs`) |
| Audit type | AI-assisted first-pass (source review) |
| Date | 2026-06-20 |
| Auditor | Automated security review agent (Claude) |

---

## 1. Executive Summary

Native (non-Anchor) Solana lending protocol derived from the SPL Token Lending family (Port Finance variable-rate fork): lending market, reserves with variable interest accrual, collateralized obligations, borrow/repay, liquidation, flash loans, and optional CPI into a staking program.

Account-validation discipline is strong and consistent: every value-moving instruction re-derives the lending-market PDA authority with `create_program_address`, checks `account.owner == program_id`, validates cross-references (reserve/obligation/lending-market/token accounts), and requires the correct signer. Arithmetic uses a checked `Decimal`/`Rate` (U192) layer with `checked_*` and `MathOverflow`, widening multiply-then-divide through `WAD`. The classic "self-liquidation / max-withdraw" exploit is covered by `tests/max_withdraw_bug_poc.rs`, whose assertion is `is_err()` — the fix is in place.

No CRITICAL/HIGH permissionless drain confirmed. Confirmed issues are oracle-quality weaknesses (MEDIUM) plus a LOW staking hygiene nit.

### Repository Risk Score: 6 / 10 (Medium)

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 0 |
| High (7-8) | 0 |
| Medium (4-6) | 2 |
| Low (1-3) | 1 |
| **Total** | **3** |

---

## 2. Confirmed Findings

### PF-01 — Pyth oracle price accepted without confidence-interval validation

| | |
|---|---|
| **Severity** | Medium (6 / 10) |
| **Category** | Oracle manipulation / quality |
| **Location** | `token-lending/program/src/processor.rs` ~2446–2500 (`get_pyth_price`); parsing in `src/pyth.rs` |

`get_pyth_price` validates price type, `Trading` status, and 240-slot staleness, but never reads/bounds `PriceInfo.conf`. A wide-confidence but Trading price is taken at full weight. It feeds `reserve.liquidity.market_price` → obligation valuation, borrow ceiling, and the `unhealthy_borrow_value` liquidation boundary, allowing over-borrow or premature/mispriced liquidation during oracle uncertainty.

**Recommendation:** Bound `conf/price` (~1–2%) and bracket with `price-conf` (collateral) / `price+conf` (debt).

### PF-02 — Switchboard V1 "optimized result" branch skips staleness check

| | |
|---|---|
| **Severity** | Medium (5 / 10) |
| **Category** | Oracle staleness |
| **Location** | `processor.rs` ~2404–2407 (`get_switchboard_price`) |

The `TYPE_AGGREGATOR_RESULT_PARSE_OPTIMIZED` branch returns `feed_data.result.result` with no `round_open_slot`/staleness check (the V1 aggregator branch and V2 path both enforce 240 slots), and uses `.deserialize(...).unwrap()` (panic-aborts on malformed data). A reserve on such a feed can be refreshed with an arbitrarily stale price.

**Recommendation:** Add the same staleness bound and replace `.unwrap()` with `.map_err(|_| LendingError::InvalidOracleConfig)?`.

### PF-03 — Staking: debug `msg!` logging + silent no-op on premature claim

| | |
|---|---|
| **Severity** | Low (3 / 10) |
| **Category** | State machine / opsec hygiene |
| **Location** | `staking/program/src/processor.rs` `process_claim_reward` ~776–779, ~829–841 |

`process_claim_reward` returns `Ok(())` when `clock.slot < earliest_reward_claim_time` instead of an error, and emits `//Todo remove debug log` `msg!` lines printing amounts. Operational/clarity only, no fund loss.

**Recommendation:** Return a dedicated error; strip debug logs.

---

## 3. Investigated but Not Confirmed

- Self-liquidation/max-withdraw exploit — **refuted** (PoC test asserts `is_err()`; correct health-gate direction).
- Account-owner/type-confusion, PDA spoofing/missing-signer — **refuted** (owner checks, version/`assert_uninitialized`, authority re-derivation, signer checks everywhere).
- Flash-loan reentrancy/drain — by-design (pre/post balance check, self-as-receiver forbidden, borrow/repay net zero, no mid-loan accrual).
- First-depositor/donation inflation — refuted (state-tracked supply, non-zero init liquidity, `INITIAL_COLLATERAL_RATE`).
- Staleness/interest consistency — refuted (same-slot refresh enforced, `mark_stale` after mutations).
- Arithmetic overflow/truncation — refuted (checked U192 math, `u64::try_from`, proptests).
- Admin config/fee powers, upgrade authority — not verifiable from source; no on-chain timelock (documented trust assumption).
- Staking CPI from lending — refuted (pool/program/owner and configured-pool matching with XOR presence checks).

## 4. Limitations

Static review only; no localnet/dynamic testing, no `cargo audit`; upgrade-authority/governance is off-chain and not verifiable here.
