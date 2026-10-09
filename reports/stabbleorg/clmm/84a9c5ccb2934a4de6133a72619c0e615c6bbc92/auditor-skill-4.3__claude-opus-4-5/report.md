# Security Audit Report — Stabble CLMM

| Field | Value |
|---|---|
| **Repository** | Stabble (`Stabble/clmm`) — concentrated-liquidity AMM (Raydium CLMM V3 fork) |
| **Scope** | `programs/clmm` (PROGRAM scope, on-chain Rust/Anchor) |
| **Audit type** | AI-assisted first-pass security review |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |

---

## 1. Executive Summary

`programs/clmm` is a concentrated-liquidity AMM forked from Raydium CLMM V3, with Stabble-specific additions (e.g. a solvency auto-freeze and a `superstate`/allowlisted-mint concept). Core math (sqrt-price, liquidity, fee and reward accounting), position ownership (NFT-based), tick-array/bitmap handling, and fee-collection authority all validate correctly and follow the upstream Raydium design with bounded `checked_*` arithmetic and CEI ordering.

The most material issue is that the Token-2022 mint allowlist gate (`is_supported_mint`) is **commented out** on the permissionless pool-creation path, so pools can be created over arbitrary Token-2022 mints — including ones carrying `PermanentDelegate` / `TransferHook` extensions — re-introducing a malicious-token rug risk for LPs who opt into such pools. The same check is still enforced for reward tokens. No CRITICAL/HIGH issue, no permissionless drain, missing-signer, or owner-substitution bug was found.

### Repository Risk Score: 6 / 10 (Medium)

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 0 |
| High (7-8) | 0 |
| Medium (4-6) | 1 |
| Low (1-3) | 3 |
| Informational (1-2) | 2 |
| **Total** | **6** |

---

## 2. Confirmed Findings

### ST-01 — Token-2022 mint allowlist gate commented out on pool creation

| | |
|---|---|
| **Severity** | Medium (6 / 10) |
| **Category** | Account validation / malicious token |
| **Location** | `create_pool.rs:132-138` |

`is_supported_mint` is commented out, so permissionless pool creation accepts arbitrary Token-2022 mints, including non-allowlisted `PermanentDelegate` / `TransferHook` mints. This re-introduces a malicious-token rug risk for LPs who opt into such pools. The check still exists and is enforced for reward tokens (`initialize_reward.rs:104`).

**Recommendation:** Re-enable `is_supported_mint` on the pool-creation path (or explicitly reject `PermanentDelegate`/`TransferHook` extensions).

### ST-02 — Admin-triggerable panic / unvalidated non-signer new owner

| | |
|---|---|
| **Severity** | Low (4 / 10) |
| **Category** | Access control / arithmetic safety |
| **Location** | `update_amm_config` (params 3/4), `transfer_reward_owner` |

Admin paths can panic on certain param values, and a new owner is accepted without a signer check.

**Recommendation:** Validate param ranges with explicit errors; require the new owner to sign (or use two-step transfer).

### ST-03 — `require_gte!(255, status)` is a no-op

| | |
|---|---|
| **Severity** | Low (3 / 10) |
| **Category** | Input validation |
| **Location** | `update_pool_status` |

A `u8` status is always ≤ 255, so the bound check never rejects anything.

**Recommendation:** Bound against the actual valid status bitmask.

### ST-04 — Fee-rate bounds enforced only in wrapper, not handler

| | |
|---|---|
| **Severity** | Low (3 / 10) |
| **Category** | Input validation |
| **Location** | `create_amm_config` (bounds in `lib.rs` wrapper, absent in handler) |

**Recommendation:** Enforce fee-rate bounds in the handler so they hold regardless of call path.

### ST-05 — `collect_fund_fee` emits `CollectProtocolFeeEvent`

| | |
|---|---|
| **Severity** | Info (2 / 10) |
| **Category** | Logging/observability |

Wrong event type emitted; cosmetic/monitoring impact only.

### ST-06 — `is_superstate_token` uses `.unwrap()` on mint unpack

| | |
|---|---|
| **Severity** | Info (2 / 10) |
| **Category** | Arithmetic/robustness |

Panic-on-malformed-data instead of a graceful error.

---

## 3. Investigated but Not Confirmed

Refuted / by-design (13 areas): position ownership via NFT, vault/output substitution, tick-array/bitmap spoofing, fee-collection owner substitution, sqrt-price/liquidity/fee rounding, reward accounting, NFT/PDA forgery, CEI/reentrancy, swap price-limit/partial-fill handling, bounded unwraps, the Stabble solvency auto-freeze, deprecated `protocol_position`, and upgrade governance (deploy-time). No CRITICAL/HIGH; no permissionless drain, missing-signer, or owner-substitution bug found.
