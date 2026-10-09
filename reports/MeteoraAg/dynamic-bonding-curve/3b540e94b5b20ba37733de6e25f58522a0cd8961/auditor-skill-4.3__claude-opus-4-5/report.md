# Security Audit Report - dynamic-bonding-curve (Meteora)

- **Repository / Program:** `dynamic-bonding-curve` (Meteora "deepen" run)
- **Scope:** PROGRAM
- **Program path:** `programs/dynamic-bonding-curve`
- **Audit type:** AI-assisted deep-dive (second pass; deepens two areas from a prior subsystem review)
- **Date:** 2026-06-19

---

## 1. Executive Summary

This run deepened **two** areas of the program following a prior subsystem review that found no confirmed critical or high-severity issues:

1. **DAMM v2 migration / second-position seeding** (`migrate_damm_v2_initialize_pool.rs` and the migration handlers for concentrated and compounding liquidity).
2. **Rate-limiter base-fee math** (`fee_rate_limiter.rs`), including the exact-out (QuoteToBase) quadratic-solver path.

After verifying each raw candidate against the source, an independent skeptic confirmed **zero** real critical/high findings. All raised candidates were either refuted on the live execution path, gated by upstream guards, or shown to be self-inflicted / non-griefing transient conditions. They are retained below as unconfirmed/informational items.

### Repository Risk Score

**LOW** - Repository Risk Score is defined as the highest *confirmed* severity. There are **no confirmed findings**, so the score is **LOW (no confirmed crit/high/med/low)**.

### Plain-language verdict

In this pass the two deepened subsystems looked **clean**. Fund-conservation logic in migration is sound (fees reserved before burn, no double-count), liquidity derivation is conservatively bounded by `min(liquidity_from_base, liquidity_from_quote)`, leftover is measured from an actual post-deposit vault reload, and re-entry is gated by `MigrationProgress`. In the rate limiter, the documented arithmetic-panic concern lives on a transaction-revert path that never mutates pool state, so there is no fund loss and no cross-account griefing - at worst a caller blocks their own specific exact-out amount. No exploitable issue was confirmed.

### Severity distribution (CONFIRMED findings only)

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 0 |
| Medium   | 0 |
| Low      | 0 |
| **Total**| **0** |

---

## 2. Confirmed Findings

**None.**

No finding survived independent verification at any severity. The program looked clean in this pass within the two deepened areas. See Section 3 for the candidates that were raised and why they were not confirmed.

---

## 3. Unconfirmed / Informational Candidates

These were raised during the pass but were **refuted, gated by upstream guards, or judged non-exploitable / self-inflicted**. They are listed for completeness and are **not** confirmed vulnerabilities. Severities below are the reporter raw severities, not confirmed ratings - do not treat them as confirmed.

| # | Title | Location | Raw sev | Why not confirmed |
|---|-------|----------|--------|-------------------|
| 1 | Unguarded U256 subtraction in quadratic discriminant can panic on exact-out swaps | `src/base_fee/fee_rate_limiter.rs:160` | 6 | Bare `-` on `y*y - four*x*z` could panic under `overflow-checks=true`, but the path only reverts the attacker own exact-out tx; no pool-state mutation, no fund loss, no cross-user griefing. Self-DoS on a specific amount at most. Defensive fix recommended (use `safe_sub`), but not a confirmed vuln. |
| 2 | Panic / hard DoS on migration if second-position accounts are `None` when leftover liquidity > 0 | `src/instructions/migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs:356` | 5 | `.unwrap()` on optional second-position accounts panics only if a caller omits them. Migration is permissionless, so any subsequent caller with correct accounts completes it - transient, not a permanent lock. No fund loss. |
| 3 | `add_liquidity` slippage thresholds set to `u64::MAX` for second position | `src/instructions/migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs:403` | 3 | All accounts are pool_authority PDA-controlled within the atomic tx; amount is bounded by `liquidity_for_second_position` computed from actual leftover. No external party can manipulate between steps today. TODO acknowledges it; defensive only. |
| 4 | `safe_sub` underflow at line 171 when quadratic underestimates `included_fee_amount` | `src/base_fee/fee_rate_limiter.rs:171` | 3 | Uses `safe_sub`, returns `Err(MathOverflow)` gracefully (no panic). Reverts a specific exact-out amount; self-DoS, well-contained error path, not griefing. |
| 5 | Production re-validation disabled by `#[cfg(feature = "local")]` in concentrated-liquidity `_1` path | `src/migration_handler/concentrated_liquidity.rs:108` | 2 | The `_1` path is only used in `create_config` validation, not in migration execution (which uses the `_2` path against actual vault balances). Overflow already guarded by `require!` on line 102. Informational. |
| 6 | `CompoundingLiquidity::calculate_liquidity_delta` divides by reserves without zero check | `src/migration_handler/compounding_liquidity.rs:116` | 2 | `safe_mul_div_cast_u128` returns `MathOverflow` (clean revert) if a reserve is zero. Reserves are set non-zero by the `initialize_pool` CPI in normal operation; zero-reserve depends on a hypothetical DAMM v2 bug. Low confidence, not exploitable as found. |

---

## 4. Coverage & Methodology

### Files read / reviewed

**Area 1 - Migration / second-position seeding**
- `src/instructions/migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs` (764 LOC, read fully)
- `src/migration_handler/concentrated_liquidity.rs` (193 LOC)
- `src/migration_handler/compounding_liquidity.rs` (216 LOC)
- `src/migration_handler/mod.rs` (112 LOC)
- `src/state/virtual_pool.rs` (1310 LOC)
- `src/state/config.rs` (1325 LOC)
- `src/instructions/migration/withdraw_leftover.rs` (120 LOC)
- `src/math/utils_math.rs` (97 LOC), `src/math/safe_math.rs` (147 LOC)
- `src/constants.rs`, `src/curve.rs` (partial)

**Area 2 - Rate-limiter base-fee math**
- `src/base_fee/fee_rate_limiter.rs` (375 LOC, read fully)
- `src/math/utils_math.rs` (`sqrt_u256` implementation)
- `src/constants.rs` (`FEE_DENOMINATOR=1e9`, `MAX_FEE_NUMERATOR=990_000_000`, `MIN_FEE_NUMERATOR=2_500_000`)
- `src/state/config.rs` (`PoolFeesConfig::get_included_fee_amount`, `get_excluded_fee_amount`)
- `src/params/fee_parameters.rs` (`to_numerator`)
- Workspace `Cargo.toml` (`overflow-checks = true` confirmed)
- `test_rate_limiter.rs` (proptest coverage observed to stop at `u64::MAX/100`, missing the boundary region)

### Verified safe (positive findings)

- **Fund conservation in migration:** `protocol_and_partner_base_fee + protocol_migration_base_fee` are correctly reserved before the burn calculation; no double-count.
- **Sqrt price integrity:** the `sqrt_price` used to initialize the pool equals `config.migration_sqrt_price` (not recomputed).
- **Conservative liquidity derivation:** uses `min(liquidity_from_base, liquidity_from_quote)`, preventing over-commitment.
- **Leftover measurement:** measured post-deposit from an actual vault reload, not estimated.
- **Re-entry gating:** `MigrationProgress` state prevents re-entry into migration steps.
- **Authority enforcement:** `validate_config_key` enforces `pool_creator_authority == pool_authority` PDA for all non-Customizable fee options.
- **Rate limiter:** the cliff-floor sanity check (lines 216-219) prevents fee undercharging from reaching the caller; the `sqrt_u256` `None` path is handled via `ok_or_else`; the outer `y - sqrt(...)` subtraction is mathematically safe when the discriminant >= 0; the `is_overflow` guard (line 190) correctly prevents the third branch from running when checked amounts overflow `u64`.

### Limitations - please read

- This is an **AI-assisted FIRST-PASS** deep-dive of two specific subsystems. It is **not exhaustive** and does not constitute a full program audit.
- Only the two deepened areas plus their direct dependencies were reviewed in depth. Other instructions/modules were not re-examined in this run.
- **Deploy-time and on-chain operational concerns were NOT verified**: upgrade-authority configuration, account/PDA initialization at deploy, governance/admin key custody, oracle/external-program (DAMM v2) correctness at runtime, and compute-budget behavior under adversarial inputs.
- Dynamic behavior (live transactions, fuzzing the rate-limiter boundary region the existing proptest skips) was **not** executed; conclusions are from static review.

---

## 5. Disclaimer

This report was produced with AI assistance and reflects a time-boxed, first-pass review of a limited scope. Absence of confirmed findings means **no exploitable issue was confirmed in this pass within the deepened areas** - it does **not** prove the program is free of vulnerabilities. Static review cannot fully account for runtime state, external program behavior (e.g., DAMM v2), or deployment configuration.

**All candidates in Section 3 - and any conclusion in this report - must be independently re-verified before being relied upon or submitted to any bug-bounty program.** Submitting unverified AI-generated findings to a bounty program may waste reviewer time and is discouraged. Re-confirm each item against the current source, construct a working proof-of-concept, and validate severity before any submission.
