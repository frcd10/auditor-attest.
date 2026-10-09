# Security Audit Report - Kamino Scope (Oracle Aggregator)

- **Repository / Program:** Kamino Scope - C:/Users/felip/auditor_validation/Kamino/scope/programs
- **Scope:** PROGRAM (Scope core program + *-itf source-adapter crates for foreign-account deserialization)
- **Audit date:** 2026-06-19
- **Asset at risk:** Price integrity (no fund custody in this program)
- **Method:** AI-assisted first-pass static review, with independent skeptic re-verification of all candidate findings

---

## 1. Executive Summary

Scope is an on-chain oracle aggregator. It has no custody of user funds; the security-relevant asset is the **integrity and freshness of the prices** it publishes for downstream consumers (lending markets, vaults, etc.). The core trust model verified during this pass:

- Every base price account is checked against oracle_mappings.price_info_accounts[idx] **before** deserialization (handler_refresh_prices.rs:83), preventing permissionless account substitution.
- check_execution_ctx (handler_refresh_prices.rs:188) blocks the refresh instruction from running under CPI and requires preceding instructions to be Compute Budget only, defeating sandwich/replay manipulation.
- Privileged instructions (mapping/config changes, admin transfer, freeze, TWAP reset) are gated by has_one = admin checks.
- Chainlink and Pyth Lazer refresh paths verify reports via external programs with hardcoded program IDs.
- Securitize hardcodes ACRED_VAULT_PK; RedStone and Switchboard-on-demand check program owner explicitly.

**Confirmed findings: 0.** After independent skeptic re-verification, **none** of the raw candidate observations were confirmed as exploitable, real-world bugs within the program''s threat model. The candidates fell into three groups: (a) staleness checks deliberately delegated to the consumer (documented in-code), (b) "missing owner check" gaps that are neutralized by the mandatory address-equality check at refresh time and by hardcoded/admin-locked addresses, and (c) admin-gated or correctness/UX issues with no permissionless attack path.

### Repository Risk Score

**LOW** - highest **confirmed** severity = none (0 confirmed findings).

> Plain-language verdict: In this first-pass review, the Scope program looked clean. The aggregator''s central invariant - that an attacker cannot inject a price account it controls without admin authority - held up under review. The most interesting candidates (Pyth/Switchboard/RedStone staleness) reflect a deliberate design choice to push freshness enforcement to consumers, not a latent program bug. They are documented below as informational so integrators are aware of the contract.

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

No findings survived independent verification in this pass. See Section 3 for the full set of unconfirmed/informational candidates and why each was not promoted.

---

## 3. Unconfirmed / Informational Candidates

These were generated as raw candidates and **refuted or down-graded** during verification. They are listed for completeness and to inform consumers/integrators. They are **not** confirmed vulnerabilities and must not be reported as such. Do not inflate.

| # | Candidate | Location | Raw sev | Why not confirmed |
|---|-----------|----------|:------:|-------------------|
| 1 | PythPull staleness check bypassed (i64::MAX age) | oracles/pyth_pull.rs:22 | 7 | Intentional design: code comment states staleness "should be filtered by the caller." Freshness is delegated to downstream consumers via the published unix_timestamp. No in-program invariant is violated. Informational contract note for integrators. |
| 2 | PythPullEMA staleness not enforced | oracles/pyth_pull_ema.rs:14 | 7 | Same deliberate delegation as #1. MAXIMUM_AGE is declared but unused by design; clamp_timestamp_to_now prevents future timestamps. Consumer-side responsibility. |
| 3 | Switchboard On-Demand ignores max_staleness | oracles/switchboard_on_demand.rs:55 | 6 | Consistent with the consumer-enforced freshness model; result.slot is propagated for downstream staleness checks. Not an in-program break. |
| 4 | RedStone missing absolute max-age check | oracles/redstone.rs:38 | 5 | Monotonic timestamp guard present; absolute window enforcement delegated to consumer. Same freshness contract. |
| 5 | SplStake/MsolStake: validate_oracle_cfg returns Ok(()) | oracles/mod.rs:332,336 | 5 | Requires admin (or admin-key compromise) to register the mapping. Not permissionless. Admin is a trusted role in the model. |
| 6 | msol_stake::get_price no owner check | oracles/msol_stake.rs:14 | 4 | Address is locked to the admin-registered mapping and checked at refresh (:83); substitution requires admin. Defense-in-depth gap only. |
| 7 | spl_stake::get_price no owner check | oracles/spl_stake.rs:20 | 4 | Same as #6 - admin-locked address, refresh-time address equality enforced. |
| 8 | jupiter_lp no program-owner check (discriminator-only) | oracles/jupiter_lp.rs:23,61 | 4 | Address pre-registered by admin and equality-checked at refresh; discriminator collision at a fixed admin-locked address is not a practical permissionless path. |
| 9 | flashtrade_lp::get_price no owner check | oracles/flashtrade_lp.rs:43 | 4 | validate_flashtrade_pool checks owner at registration; refresh-time address lock prevents substitution. Defensive gap only. |
| 10 | adrena_lp::get_price no owner check | oracles/adrena_lp.rs:44 | 4 | Same structural pattern as #9; address-locked + admin-gated. |
| 11 | Switchboard validate_confidence panics on negative mantissa | oracles/switchboard_on_demand.rs:79 | 4 | Reaching a negative stdev_mantissa requires admin-crafted/owned account data; with overflow-checks=true the tx merely reverts (per-token refresh skipped when batch). Admin-gated DoS, no price corruption. |
| 12 | Chainlink v7/v9 missing confidence interval check | oracles/chainlink.rs:289 | 4 | Chainlink reports are CPI-verified against the Chainlink verifier with hardcoded IDs; v9 retains ripcord + nav_date age gates. Signal-quality gap, not an injection path. |
| 13 | PythPullEMA uses spot conf to validate EMA price | oracles/pyth_pull_ema.rs:23 | 4 | Real behavioral quirk (spot conf vs ema_conf), but effect is feed availability / weakened gate, not price injection or fund loss. Worth fixing; not a confirmed vulnerability. |
| 14 | JitoRestaking u16 fee-bps addition can panic | oracles/jito_restaking.rs:32 | 2 | Requires admin to point mapping at a crafted vault-shaped account; admin-gated DoS of one feed only. |
| 15 | securitize::get_sacred_price no owner check | oracles/securitize.rs:36 | 3 | Neutralized: check_accounts enforces key == ACRED_VAULT_PK (hardcoded). Substitution impossible. |
| 16 | Orca/Raydium/Meteora no explicit owner check | oracles/orca_whirlpool.rs:30, raydium_ammv3.rs:12, meteora_dlmm.rs:33 | 3 | Address locked to mapping; permissionless substitution prevented. Discriminator collision at a fixed admin-locked address is highly constrained. |
| 17 | approve_admin_cached does not clear admin_cached | handlers/handler_approve_admin_cached.rs:26 | 3 | Stale state / monitoring confusion only; no escalation (admin == admin_cached after transfer), no fund/price impact. |
| 18 | check_confidence_interval unchecked u128 mul | utils/math.rs:214 | 3 | All current callers pass equal exponents; would require a new oracle integration/misconfig with extreme exponent skew. With overflow-checks=true it reverts, not corrupts. |
| 19 | CreateMintMap stores caller-supplied bump | handlers/handler_create_mint_map.rs:43-59 | 2 | Anchor init derives the canonical bump independently for creation; on-chain code never re-derives from stored bump. Correctness issue for off-chain integrators only. |
| 20 | Composite oracle types do not reject self-reference | oracles/most_recent_of.rs:119-138 | 2 | Requires trusted admin to mis-configure; no permissionless path or fund drain. |
| 21 | price_of_lamports_to_price_of_tokens unchecked u64 mul | utils/math.rs:104 | 2 | Bounded by Solana max-18 decimals in practice; with overflow-checks=true reverts rather than corrupts. |

**Cross-cutting note on the "missing owner check" cluster (#6-10, #15, #16):** the recurring pattern is that several get_price adapters rely on Anchor discriminator checks rather than an explicit owner-equality check. In every case the exploit requires either (a) admin authority to set the mapping or (b) a post-registration owner reassignment at a fixed, admin-locked address. The mandatory address-equality check at handler_refresh_prices.rs:83 removes the permissionless substitution vector. These remain reasonable **defense-in-depth hardening** suggestions (add explicit owner checks in each get_price), but none is a confirmed vulnerability in the current threat model.

**Cross-cutting note on the staleness cluster (#1-4):** Scope deliberately publishes raw oracle timestamps and pushes max-age enforcement to consumers. This is documented in-code. It is a **contract that integrators must honor** (always check unix_timestamp/last_updated_slot freshness), not a Scope bug. If product intent is to enforce a hard max-age in-program, that would be an enhancement, not a fix.

---

## 4. Coverage & Methodology

### What was read

- **Core program:** handler_refresh_prices.rs (refresh dispatch, address check, CPI guard), oracles/mod.rs (OracleType dispatch, validate_oracle_cfg, get_non_zero_price), state definitions (configuration, oracle_mappings, oracle_prices, oracle_twaps, token_metadatas, mints_to_scope_chains, oracle_type), and utils/ (math.rs, price_impl.rs, pdas.rs, scope_chain.rs, source_entries.rs, consts).
- **All handlers:** initialize, update_mapping_and_metadata, set_admin_cached, approve_admin_cached, set_emergency_council, freeze_price, reset_twap, create_mint_map, close_mint_map, resume_chainlinkx_price, refresh_prices, refresh_chainlink_price, refresh_pyth_lazer_price.
- **All oracle adapters:** pyth, pyth_pull, pyth_pull_ema, pyth_lazer, switchboard_on_demand, chainlink, redstone, securitize, jupiter_lp, adrena_lp, flashtrade_lp, orca_whirlpool, raydium_ammv3, meteora_dlmm, ktokens, ktokens_token_x, msol_stake, spl_stake, jito_restaking, spl_balance, staked_sol_balance, total_mint_supply, fixed_price, most_recent_of, capped_most_recent_of, multiplication_chain, capped_floored, conditional, twap, discount_to_maturity.
- **Foreign-account *-itf adapter crates:** adrena-perp-itf, flashtrade-perp-itf, jup-perp-itf, lb-clmm-itf, redstone-itf, sbod-itf, securitize-itf, switchbord-itf.

### What was verified safe

- Base account address always checked against oracle_mappings.price_info_accounts[idx] before deserialization (no permissionless substitution).
- check_execution_ctx blocks CPI/sandwich replay of refresh; only Compute Budget instructions may precede it.
- Securitize hardcodes ACRED_VAULT_PK; RedStone and Switchboard-on-demand explicitly check program owner.
- Chainlink refresh is CPI-gated through the Chainlink verifier with hardcoded pubkeys; Pyth Lazer enforces monotone timestamp, confidence interval, channel ID, and feed ID.
- Pyth legacy (v1) enforces 10-min slot staleness and ORACLE_CONFIDENCE_FACTOR.
- admin has_one checks on all privileged instructions; mappings cross-linked via has_one in refresh paths.
- Freeze flag preserved/stripped correctly across read/write paths; zero-price guard (get_non_zero_price) covers all non-exempt types.
- overflow-checks = true in the release profile (Cargo.toml) - arithmetic overflows revert rather than wrap silently.
- Chainlink bigint parsing rejects negatives/oversized values; kToken sqrt-price uses Decimal arithmetic; TWAP EMA tracker logic correct.

### Limitations - read this

- This is an **AI-assisted FIRST-PASS** review. It is **not exhaustive** and is **not a substitute for a full professional audit**.
- **Not verified:** deploy-time configuration, upgrade-authority/governance setup, key management, admin operational security, off-chain keeper/relayer behavior, and any on-chain operations/runtime state.
- The threat model treats admin as a **trusted role**. Findings whose only attack path is "admin (or compromised admin key) does X" were therefore not promoted to confirmed. If admin-key compromise is in-scope for your threat model, re-evaluate candidates #5-7, #8-11, #14, #20.
- Staleness behavior (#1-4) is a **consumer contract**, not assessed against any specific downstream integrator''s enforcement.
- Dynamic testing, fuzzing, and formal verification were **not** performed.

---

## 5. Disclaimer

This report is provided on a best-effort, as-is basis and reflects an automated, AI-assisted static analysis pass. It does not guarantee the absence of vulnerabilities. The absence of confirmed findings in this pass does not certify the program as secure.

**All findings - including the unconfirmed/informational candidates in Section 3 - must be independently re-verified by a human security engineer before any bug-bounty submission or production reliance.** Do not submit any item from Section 3 to a bug-bounty program without first reproducing it against the live program and confirming a concrete, in-scope impact; several were explicitly refuted and submitting them as-is would be inaccurate.
