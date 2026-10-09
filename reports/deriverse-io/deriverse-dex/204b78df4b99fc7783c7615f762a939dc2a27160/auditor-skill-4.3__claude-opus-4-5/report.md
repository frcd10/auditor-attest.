# Security Audit Report — Deriverse DEX

| Field | Value |
|---|---|
| **Repository** | Deriverse (`Deriverse/deriverse-dex`) — on-chain order-book DEX (Mango v4 fork) |
| **Scope** | `programs/mango-v4` (PROGRAM scope, on-chain Rust/Anchor) |
| **Upstream** | Mango v4 0.24.0 (OtterSec-audited) |
| **Audit type** | AI-assisted first-pass security review |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |

---

## 1. Executive Summary

`deriverse-dex` is a near-verbatim fork of Mango v4 0.24.0. The high-risk inherited machinery — oracle staleness/confidence validation, the health-cache, PnL settle limits, liquidation monotonicity, withdraw pre/post-health checks, and vault/bank binding — is intact and matches upstream. No permissionless fund-loss vector was found in the inherited core.

Deriverse's own deltas vs upstream are few and low-severity. The most notable is a set of `openbook_v2_*` integration handlers that are currently empty `Ok(())` stubs whose account structs omit market-binding constraints and reference inline validation code that does not exist — inert today, but latent-critical if implemented as written. The remaining deltas are an availability-affecting minimum-deposit rule, a devnet-only faucet, and admin-trust/test hooks. Highest confirmed severity = 4.

### Repository Risk Score: 4 / 10 (Low–Medium)

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 0 |
| High (7-8) | 0 |
| Medium (4-6) | 2 |
| Low (1-3) | 2 |
| Informational (1-2) | 1 |
| **Total** | **5** |

---

## 2. Confirmed Findings

### DV-01 — Empty `openbook_v2_*` handler stubs with unconstrained account structs

| | |
|---|---|
| **Severity** | Medium (4 / 10) |
| **Category** | Account validation (latent) |
| **Location** | `lib.rs:1681-1768`; `accounts_ix/openbook_v2_place_order.rs:28` |

All `openbook_v2_*` handlers are empty `Ok(())` stubs. Their account structs (esp. `OpenbookV2PlaceOrder`) omit the market-binding `has_one` constraints and defer signer/owner checks to inline `#1/#2/#3` code that does not exist. Inert today; latent-critical if implemented as-is.

**Recommendation:** Remove the stubs from the deployed program, or add the full `has_one`/signer/owner constraints before implementing.

### DV-02 — Deriverse-added $50 USD-bank minimum deposit blocks reduce-only / recovery deposits

| | |
|---|---|
| **Severity** | Medium (4 / 10) |
| **Category** | Availability / economic logic |
| **Location** | `token_deposit.rs:50-55` |

The added `$50` minimum deposit is checked before reduce-only capping, so it can block small reduce-only repayments and liquidation-recovery deposits.

**Recommendation:** Exempt reduce-only / recovery deposits from the minimum, or apply the check after reduce-only capping.

### DV-03 — Devnet `airdrop` has unconstrained `reserve_account`

| | |
|---|---|
| **Severity** | Low (3 / 10) |
| **Category** | Account validation |
| **Location** | `accounts_ix/airdrop.rs:11-12` |

`reserve_account` has no mint/address binding. Devnet-only faucet abuse, not mainnet fund loss.

**Recommendation:** Constrain `reserve_account`, and ensure the instruction is devnet-gated at deploy.

### DV-04 — `stub_oracle_set_test` lacks an `is_testing()` gate

| | |
|---|---|
| **Severity** | Low (3 / 10) |
| **Category** | Oracle / admin trust |
| **Location** | `lib.rs:506`; `oracle.rs:340-351` |

Combined with stub staleness/confidence rewrites, an admin can wire a validation-immune feed into a live market. Largely upstream behavior; admin-trust.

**Recommendation:** Gate behind `is_testing()` (as upstream test hooks are).

### DV-05 — Stray `// TODO: FIX THIS !!!` above `security_txt!`

| | |
|---|---|
| **Severity** | Info (2 / 10) |
| **Category** | Hygiene |
| **Location** | `lib.rs:1790` |

Cosmetic.

---

## 3. Investigated but Not Confirmed

Inherited Mango v4 machinery verified intact and matching upstream: oracle staleness/confidence, health-cache computation, PnL settle limits, liquidation monotonicity, withdraw pre/post-health enforcement, and vault/bank binding. No permissionless drain, missing-signer, or owner-substitution vector found in the inherited core.
