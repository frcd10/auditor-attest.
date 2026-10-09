# Flash Trade — Perpetuals Program Security Audit

| | |
|---|---|
| **Repository** | FlashTrade / flash-perpetuals |
| **Scope** | programs/perpetuals (on-chain Anchor program) |
| **Primary program** | perpetuals — declare_id!("Bmr31xzZYYVUdoHmAJL1DAp2anaitW8Tw9YfASS94MKJ"), #[program] pub mod perpetuals in src/lib.rs |
| **Audit type** | AI-assisted first-pass (PROGRAM scope: checklists 01-07, 16) |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |
| **Anchor / Solana** | anchor-lang 0.28.0, solana-program 1.16.9, pyth-sdk-solana 0.8.0 |

---

## 1. Executive Summary

The in-scope program is a Solana perpetual-futures / pool-LP protocol. It is a derivative of the **Solana Labs perpetuals** reference implementation (the repo carries the original security_txt citing a Halborn audit, and audit/Solana_Labs_Perpetuals_..._Halborn_Final.pdf is committed). The Flash Trade-specific addition over upstream is the **permissionless off-chain oracle update path** (set_custom_oracle_price_permissionless), which was reviewed with particular care.

The code is mature and defensively written. All financial arithmetic flows through a centralized math module that returns Result on overflow/underflow/zero-division (checked_add/sub/mul/div, checked_decimal_*, checked_as_u64), and multiply-then-divide chains widen to u128 before dividing. Admin actions are gated behind a 6-key Multisig with per-instruction hash binding. PDAs are derived with explicit seeds+bump and token/oracle accounts are constrained by has_one, seeds, or address-equality constraints. Permissionless instructions (swap, liquidity, positions, liquidation) move funds only via a transfer_authority PDA into user-owned accounts validated by has_one = owner / owner constraints.

No vulnerability was confirmed that allows an unauthorized party to drain funds, mint shares for free, bypass the multisig, or corrupt collateral/health accounting. The residual items below are low-severity hardening / robustness observations. The dominant real-world risk is **economic / trust-model** (admin-configured oracle authority and admin fee/permission powers), which is inherent to this protocol design rather than an implementation defect.

**Repository Risk Score: 3 / 10** (LOW — highest confirmed finding is severity 3)

### Severity Distribution

| Severity band | Range | Count |
|---|---|---|
| Critical | 9-10 | 0 |
| High | 7-8 | 0 |
| Medium | 4-6 | 0 |
| Low | 1-3 | 3 |
| **Total confirmed** | | **3** |

---

## 2. Confirmed Findings

All confirmed findings are severity <= 3 (Low / hardening). None block deployment on their own.

---

### FT-01 — Pyth price ingested via get_price_unchecked (manual validation only)

| Field | Value |
|---|---|
| **Severity** | 3 / 10 — LOW |
| **Category** | Oracle ingestion / robustness |
| **Location** | programs/perpetuals/src/state/oracle.rs:296-322 (get_pyth_price) |

**Description.** Pyth prices are read with price_feed.get_price_unchecked() and get_ema_price_unchecked() rather than the trading-status-aware getters (get_price_no_older_than / status checks). The function then performs its own validation: a staleness check (current_time - publish_time > max_price_age_sec -> StaleOraclePrice), a price <= 0 rejection, and a confidence-ratio bound (conf * BPS_POWER / price > max_price_error -> InvalidOraclePrice).

**Impact.** Because staleness and confidence are re-checked manually, the practical exposure is limited to the case where Pyth reports a price whose publish_time is fresh but whose **trading status is not Trading** (e.g., halted market). The unchecked getter does not consult the status field, so a non-trading price within max_price_age_sec could still be accepted. Effect is bounded by max_price_age_sec and max_price_error, both admin-configured per custody.

**Recommendation.** Prefer the status-checked Pyth getters, or explicitly assert the feed's trading status before use. This matches the original upstream Halborn recommendation for this exact code path.

**Justification.** get_price_unchecked()/get_ema_price_unchecked() are called directly at lines 297/299; the subsequent last_update_age_sec and confidence checks (302-316) are the only guards, and neither inspects Pyth's trading status.

---

### FT-02 — add_collateral has no instruction-level permission gate

| Field | Value |
|---|---|
| **Severity** | 2 / 10 — INFO/LOW |
| **Category** | Access control / consistency |
| **Location** | programs/perpetuals/src/instructions/add_collateral.rs:106-127 |

**Description.** Every other state-changing public instruction begins with a require!(perpetuals.permissions.* && custody.permissions.*, InstructionNotAllowed) gate (open_position, close_position, swap, add_liquidity, remove_liquidity, remove_collateral, liquidate). add_collateral omits this check entirely and proceeds straight to input validation.

**Impact.** Adding collateral only *increases* a position's margin and pulls tokens *from* the user into a custody account, so there is no direct fund-loss vector. The issue is that if governance globally pauses the protocol (clears the permission flags) to contain an incident, add_collateral remains callable, and the operation is not consistently behind the kill-switch. The position-risk check_leverage(...true) still runs, so an unhealthy state cannot be created.

**Recommendation.** Add a permission gate consistent with the sibling instructions, e.g. require!(perpetuals.permissions.allow_collateral_withdrawal && custody.permissions.allow_collateral_withdrawal, InstructionNotAllowed) (or a dedicated add-collateral flag), so the pause switch covers this path.

**Justification.** Direct comparison: remove_collateral.rs:116-120 and open_position.rs:124-129 both gate on permissions; add_collateral.rs has no equivalent require! before mutating position and transferring tokens.

---

### FT-03 — Permissionless oracle update silently returns Ok on stale publish_time

| Field | Value |
|---|---|
| **Severity** | 2 / 10 — INFO/LOW |
| **Category** | Oracle ingestion / error semantics |
| **Location** | programs/perpetuals/src/instructions/set_custom_oracle_price_permissionless.rs:66-69 |

**Description.** When the submitted publish_time is not newer than the stored one, the handler logs a message and returns Ok(()) **before** performing the ed25519 signature validation, rather than erroring. The store is correctly not updated (monotonic publish_time is preserved), so this is a no-op, not a corruption.

**Impact.** No fund or pricing impact. The concerns are (a) a stale/replayed submission is accepted as a "successful" transaction, which can mislead off-chain monitoring/relayers into believing an update landed, and (b) the early-return bypasses signature verification, so a *malformed-but-stale* call also succeeds silently. Because the oracle value itself is unchanged, neither is exploitable for price manipulation.

**Recommendation.** Return an explicit error (e.g. StaleOraclePrice) instead of Ok(()) so callers and monitoring can distinguish a rejected stale update from an applied one. Optionally perform signature validation before the staleness short-circuit.

**Justification.** Lines 66-69 short-circuit with return Ok(()) prior to the load_instruction_at_checked / validate_ed25519_signature_instruction block at 70-78.

---

## 3. Investigated but NOT confirmed (refuted / by-design / low-confidence)

The following were specifically examined on the highest-value paths (fund movement, collateral/health math, oracle ingestion, liquidation, admin authority, account/signer validation) and did **not** yield a confirmed vulnerability.

- **Integer overflow / underflow (AR-001..AR-017).** Refuted. All financial arithmetic uses the math::checked_* wrappers which return MathOverflow on failure; a*b/c patterns widen operands to u128 (e.g. pool.rs get_leverage, get_pnl_usd, add_position; add_liquidity.rs:192-198). as u64 downcasts go through checked_as_u64 (range-checked NumCast). The only bare ops are on compile-time constants (Perpetuals::BPS_POWER, decimals).

- **wrapping_add / saturating_sub on financial paths (AR-006/AR-007).** By-design, not a fund risk. These appear only on **statistics accumulators** (volume_stats.*_usd, trade_stats.profit_usd/loss_usd, collected_fees.*_usd, oi_long_usd/oi_short_usd) and on assets.owned gain/loss reconciliation guarded by an explicit if total_amount_out > position.collateral_amount branch (liquidate.rs:240-250, close_position.rs:218-229). They do not gate token transfers, share minting, or solvency checks.

- **Division by zero (AR-018/AR-019).** Refuted. checked_div and checked_decimal_div/checked_decimal_mul guard zero divisors; share/LP math guards pool_amount_usd == 0 (1:1 bootstrap) in add_liquidity.rs:189-199, and get_leverage/get_current_ratio/get_new_ratio guard zero margin / zero AUM.

- **First-depositor / LP-share inflation (ECON-013..ECON-017, KV-006).** Low-confidence / mitigated. First add_liquidity mints lp_amount = token_amount_usd (USD-denominated, 6 decimals) rather than raw token units, and get_assets_under_management_usd values the pool from custody-tracked assets.owned (not the SPL token-account balance), so a raw donation/transfer into the custody token account does not inflate AUM. This neutralizes the classic ERC4626-style donation attack. A residual rounding edge for a dust first deposit exists but is economically immaterial and bounded.

- **Vault donation / AUM manipulation (KV-017).** Refuted for the LP path: AUM is derived from internal assets.owned accounting updated only through program instructions, not from token_account.amount. Direct token transfers into a custody token account are not counted.

- **Missing signer / access control (AV/AC, KV-004/KV-013).** Refuted. All admin instructions route through Multisig::sign_multisig, which requires signer_account.is_signer, membership in the signer set, per-instruction hash/accounts/data binding, and min_signatures accumulation with replay protection (MultisigAlreadySigned / MultisigAlreadyExecuted). init validates the program upgrade authority (validate_upgrade_authority). User instructions enforce Signer<info> plus has_one = owner on funding/receiving/position accounts.

- **PDA confusion / type cosplay (KV-010/KV-026/KV-027).** Refuted. Accounts are typed Account<info, T> (discriminator-checked) and derived with explicit seeds+stored bump; cross-references use constraint = position.custody == custody.key(), custody.key() == params.custody_account, and oracle address equality. The AUM remaining-accounts loop re-validates accounts[idx].key() == pool.custodies[idx] and the paired oracle against custody.oracle.oracle_account (pool.rs:716-725).

- **Unchecked CPI target (KV-009).** Refuted. Token CPIs go through anchor_spl::token with Program<info, Token>; mint/burn/transfer authority is the transfer_authority PDA signed via with_signer. No raw invoke/invoke_signed to attacker-supplied program IDs in scope.

- **Liquidation abuse.** Refuted. liquidate requires the position to actually be liquidatable (require!(!check_leverage(...))), pays the position owner (receiving_account.owner == position.owner) and the caller only the liquidation-fee reward (rewards_receiving_account.owner == signer.key()); both amounts are bounded by get_close_amount and check_available_amount. The permissionless liquidator model is intended.

- **Permissionless oracle signature spoofing (FT-specific).** Refuted as exploitable. validate_ed25519_signature_instruction pins program_id == ed25519_program::ID, asserts exactly one signature (data[0]==0x01), fixed data.len()==180, no touched accounts, and byte-compares the embedded signer pubkey against the admin-set custody.oracle.oracle_authority and the embedded message against the full instruction params. A valid update therefore requires a genuine ed25519 signature by the configured authority over the exact (price,expo,conf,ema,publish_time,custody) payload. (See FT-03 for the only residual semantic nit.)

- **Oracle staleness / confidence (ECON-058/059).** Pass. Both custom and Pyth paths enforce max_price_age_sec and a confidence-ratio bound (oracle.rs:255-273 and 302-316). See FT-01 for the Pyth trading-status caveat.

- **Test backdoor set_test_time (KV-008).** Refuted. It is hard-gated by if !cfg!(feature = "test") { return err!(InvalidEnvironment) } and the test feature is non-default (Cargo.toml [features] test = [], default = []). Perpetuals::get_time() likewise uses the real Clock sysvar unless built with feature = "test".

- **Reentrancy / checks-effects-interactions (KV-003/KV-029).** Refuted within scope. Solana's single-threaded execution plus the absence of callbacks into untrusted programs during these handlers means classic reentrancy does not apply; state is mutated in the same instruction without yielding to attacker code.

- **Fee bounds (AR-039, ECON-026).** Pass. Fees::validate() caps every fee field at BPS_POWER (100%) and protocol_share <= 100%; PricingParams::validate() and TokenRatios::validate() enforce leverage/ratio sanity. These run on admin config (add_custody/set_custody_config).

### Notes / out of scope

- Economic trust assumptions are inherent to the design and not implementation bugs: the multisig admins can set fees, pause/permission instructions, configure each custody's oracle source and oracle_authority, and (per init) the program upgrade authority governs code. These are documented governance powers, not vulnerabilities, but should be disclosed to users (timelock/transparency recommended).
- Off-chain components (app/, ui/, TypeScript clients) and devops/supply-chain were **out of PROGRAM scope** and not reviewed here.
- The committed Halborn PDF audits the upstream Solana Labs program; the Flash Trade permissionless-oracle delta is the principal net-new on-chain surface and was the focus of FT-01/FT-03 and the refutation notes above.

---

*This is an AI-assisted first-pass review and does not replace a full manual audit. Absence of a confirmed critical/high finding is not a guarantee of correctness; the economic/governance trust model in particular warrants independent review.*
