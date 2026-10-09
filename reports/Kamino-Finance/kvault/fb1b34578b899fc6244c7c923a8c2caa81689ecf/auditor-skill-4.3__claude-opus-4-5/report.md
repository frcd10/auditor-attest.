# Security Audit Report -- Kamino Vault (kvault)

- **Repository / Program:** kvault (Kamino Vault)
- **Scope:** PROGRAM -- C:/Users/felip/auditor_validation/Kamino/kvault/programs/kvault
- **Audit type:** AI-assisted first-pass static review
- **Date:** 2026-06-19
- **Program summary:** Kamino Vault allocates user deposits into klend (Kamino Lending) reserves and issues tokenized shares representing a proportional claim on assets under management (AUM).

---

## 1. Executive Summary

### Repository Risk Score: **LOW**

The risk score equals the highest **confirmed** severity. In this pass there were **zero confirmed findings**, so the score is **LOW**.

### Plain-language verdict

This first-pass review traced the full deposit / withdraw / invest / redeem-in-kind / charge-fees / rewards lifecycle across all 40 Rust source files in the program. A number of candidate issues were raised during analysis, but **every one of them was refuted or downgraded** during independent skeptical verification -- either because a compensating control already exists, because the behavior is intentional and internally consistent, or because the issue is gated entirely behind a trusted admin key with no permissionless exploit path.

Key protective properties that held up under scrutiny:

- **Share accounting is consistent.** All vault math uses vault.shares_issued exclusively; deposit and withdraw post-checks (handler_deposit.rs:90-103, vault_checks.rs:69-133) assert that observed token/share deltas equal the computed effects, so silent accounting drift would abort the transaction.
- **First-depositor inflation is mitigated** by the dead-shares mechanism in handler_init_vault.rs (INITIAL_DEPOSIT_AMOUNT locked at init).
- **Rounding is consistently vault-favorable** (shares minted round down, shares burned capped at the holder balance), preventing over-redemption / drains.
- **Arithmetic safety:** overflow-checks = true in the release profile (Cargo.toml), so any unexpected over/underflow aborts rather than silently wrapping. The flagged subtraction sites can at worst panic (DoS), not corrupt state -- and the panic paths require adversarial admin configuration.
- **PDA derivations** for base_vault_authority, token_vault, ctoken_vault, shares_mint, and global_config are deterministic and correctly seeded; ctoken_vault seeds include both vault and reserve keys, preventing cross-vault confusion.
- **Admin transitions** use a correct two-step pending_admin pattern for both VaultState and GlobalConfig.
- The klend skip_price_updates / PriceStatusFlags::NONE path is **safe for this use case** because the collateral exchange rate used for share valuation is derived from on-chain liquidity/collateral accounting, not from oracle prices.

The residual items below are primarily **insider / admin-trust** concerns (e.g., a compromised or malicious vault_admin_authority could set extreme fees or redirect fee/reward destinations) and **sub-lamport rounding asymmetries**. These are real design observations worth tracking, but none constitutes a permissionless vulnerability or a verified loss-of-funds path in this pass.

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

**None.** No findings survived independent verification in this pass. See Section 3 for the full list of candidates that were raised and refuted/downgraded, and Section 4 for coverage.

---

## 3. Unconfirmed / Informational Candidates

The following were raised during analysis but were **refuted, intentional-by-design, gated behind a trusted admin key, or sub-lamport in magnitude**. They are recorded for completeness and future tracking. They are **NOT** confirmed vulnerabilities and should not be treated as such.

| # | Candidate | Location | Raised sev. | Why not confirmed |
|---|-----------|----------|-------------|-------------------|
| 1 | Unchecked max_amount - crank_funds_to_deposit subtraction can panic (DoS) | vault_operations.rs:68 | Medium/High | With overflow-checks=true this aborts cleanly (no state corruption). Reaching it requires an admin to set a very large crank_fund_fee_per_reserve; admin-config/UX issue, not a permissionless exploit. (Reported several times under different framings.) |
| 2 | get_shares_to_mint uses ceil(AUM) as denominator (under-mint) | vault_operations.rs:1034-1037 | Low | Rounding is intentionally vault-favorable; magnitude sub-unit per deposit. No attacker profit path. |
| 3 | Permissionless topup_rewards (no admin constraint) | handler_topup_rewards.rs | Low/Med | Tokens transferred in first; per-block impact bounded by reward_per_second. Donating value is not an exploit; no verified profitable manipulation. |
| 4 | shares_issued diverges from on-chain shares_mint.supply after init | handler_init_vault.rs:43-52 | Info | Intended dead-shares anti-inflation mechanism; internal accounting verified consistent. |
| 5 | withdraw_pending_fees decrements pending_fees by pre-rounding amount | vault_operations.rs:426-431 | Low | At most 1 base token per call; residual stays in vault (benefits depositors). Not a loss of user funds. |
| 6 | Performance fee charged on admin-supplied reward tokens | vault_operations.rs:60, 803-871 | Low/Med | Admin controls both reward rate and fee; self-affecting design choice, not a permissionless exploit. |
| 7 | redeem_in_kind computes withdrawal penalty twice; AUM update ignores penalty component | vault_operations.rs:680-749 | Low/Med | Penalty stays in vault (benefits remaining holders); bounded by max penalty BPS and ctoken cap. Not verified exploitable. |
| 8 | cpi_refresh_reserves uses skip_price_updates=true + PriceStatusFlags::NONE | klend_operations.rs:52, vault_operations.rs:1010 | Low | Verified safe: ctoken exchange rate is independent of oracle prices in klend. |
| 9 | Performance / management fee can be set up to 100% (FULL_BPS) with no timelock | vault_config_operations.rs:101-110 | Med | Requires trusted/compromised vault_admin_authority; governance/timelock is operational, not code, control. Insider-risk only. |
| 10 | Shares-to-burn ceiling rounding | vault_operations.rs:292-297, 1272-1285 | Low | Capped at holder balance; rounding vault-favorable and prevents over-burn. |
| 11 | withdraw_pending_fees / WithdrawRewards destination lacks strict on-chain receiver pin | handler_withdraw_pending_fees.rs, handler_withdraw_rewards.rs:84-89 | Low | Constrained to authority = vault_admin_authority (fees) / mint (rewards); redirection requires the admin key. Insider-risk; no permissionless path. |
| 12 | TopupRewards/WithdrawRewards missing has_one = token_program | handler_topup_rewards.rs, handler_withdraw_rewards.rs | Low | Defense-in-depth only; mismatched program causes the CPI to fail. No fund loss. |
| 13 | UpdateVaultConfig admin check is in-code, not declarative has_one | handler_update_vault_config.rs:53-70 | Low | Logic verified correct; style/defense-in-depth observation. |
| 14 | refresh_rewards increments token_available without re-reading token_vault balance | vault_operations.rs:855 | Low | Topup transfers tokens first; no verified path to inflate beyond actual balance. |

---

## 4. Coverage & Methodology

**This is an AI-assisted FIRST-PASS static review. It is NOT exhaustive and does NOT constitute a formal audit or a guarantee of correctness.**

### What was read / analyzed

- **All 40 Rust source files** in programs/kvault were read.
- **Handlers:** handler_init_vault, handler_deposit, handler_withdraw, handler_invest, handler_update_reserve_allocation, handler_update_vault_config, handler_withdraw_pending_fees, handler_update_admin, handler_remove_allocation, handler_initialize_global_config, handler_update_global_config, handler_update_global_config_admin, handler_add_update_whitelisted_reserve, handler_topup_rewards, handler_withdraw_rewards, handler_redeem_in_kind, handler_give_up_pending_fees, handler_initialize_shares_metadata, handler_update_metadata.
- **Operations:** vault_operations.rs (full, ~1424 lines -- deposit, withdraw, withdraw_pending_fees, redeem_in_kind, invest, charge_fees, refresh_rewards, give_up_pending_fee), vault_checks.rs, vault_config_operations.rs, reserve_whitelist_operations.rs, klend_operations.rs, effects.rs.
- **State / utils:** state.rs, lib.rs, consts.rs, pda.rs, token_ops.rs, macros.rs, cpi_mem.rs, global_config.rs, fraction_utils.rs, and Cargo.toml.
- Cross-referenced klend last_update.rs to confirm PriceStatusFlags::NONE semantics.

### What was verified safe

- Deposit/withdraw post-condition checks assert token and share deltas equal computed effects.
- calculate_shares_to_burn rounds up and is capped at the holder balance (no over-burn).
- AUM underflow guard in compute_aum; management fee charged on net (ex-pending_fees) AUM.
- Reserve ordering enforced by check_allocation_reserve_accounts_match; whitelist keyed by reserve pubkey.
- ctoken_vault PDA seeds bind vault + reserve; CPI program identity enforced via Anchor Program type.
- Withdrawal penalty retained in the vault (benefits remaining shareholders).
- Two-step admin transfer (pending_admin) for VaultState and GlobalConfig.
- overflow-checks = true in the release profile (arithmetic panics rather than wraps).

### What was NOT covered / out of scope

- **Deploy-time and on-chain operational configuration** (admin key custody, multisig/governance/timelock around vault_admin_authority and global_admin, real reserve allocations, real fee settings) were **not verified** -- several informational items hinge on these.
- Runtime/integration behavior, on-chain state at any specific slot, and economic simulation under live market conditions.
- The klend program itself (trusted dependency beyond the specific interactions traced).
- Compute-budget / transaction-size limits with the maximum number of reserves.
- Off-chain components, SDKs, and front-ends.

---

## 5. Disclaimer

This report was produced by an AI-assisted, automated first-pass review and is provided "as is" without warranty of any kind. It is **not** a substitute for a professional manual audit, formal verification, or economic-security analysis. Absence of confirmed findings in this pass does **not** mean the program is free of vulnerabilities -- only that none were confirmed within the scope, time, and method of this review.

**All findings (including the informational/unconfirmed candidates in Section 3) MUST be independently re-verified against the current source and on-chain deployment before any bug-bounty submission, remediation, or production decision.** Do not submit any item from Section 3 to a bug-bounty program without first reproducing it end-to-end and confirming a concrete, permissionless impact; several were explicitly downgraded because they require a trusted/compromised admin key or are sub-lamport rounding artifacts.
