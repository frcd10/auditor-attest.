# UXD Protocol — Program Security Audit

| Field | Value |
|---|---|
| **Repository** | UXD Protocol — `uxd-program` |
| **Scope** | `programs/uxd` (on-chain Anchor program) |
| **Audit type** | AI-assisted first-pass (PROGRAM scope) |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |
| **Primary program** | `uxd` — `#[program] pub mod uxd` in `programs/uxd/src/lib.rs` |
| **Program ID (production)** | `UXD8m9cvwk4RcSxnX2HZ9VudQCEeDH6fRnB4CAP57Dr` (`declare_id!`, lib.rs:20) |
| **Program ID (development)** | `CW5VzSk7WC4NPyuNt19VFev9FUHhyk5xxHTj2DUWBexu` (lib.rs:18) |

---

## 1. Executive Summary

**Repository Risk Score: 3 / 10 — LOW**

(Score = highest CONFIRMED severity. No critical/high/medium issues were substantiated from code.)

### What we found

UXD is a USDC-backed, router-based redeemable stablecoin. The audited program enforces a strict **1:1 collateral-to-redeemable** relationship across three depositories (Identity, Mercurial Vault, Credix LP) coordinated by a single Controller PDA. The code is defensively engineered and bears the hallmarks of prior professional audits: **all financial arithmetic uses checked math with `u128` widening**, every depository and external (Credix/Mercurial) account is bound via Anchor `has_one`/`seeds` constraints, and the external-CPI mint/redeem paths use a rigorous **read -> predict -> mutate -> reload -> verify** pattern that re-derives share/value deltas from on-chain state after each CPI and reverts on any mismatch. Governance is gated behind a single `Controller.authority` (`has_one = authority`), there is a global **freeze switch**, and redemptions are throttled by a **per-epoch outflow limit**.

We did **not** find any path allowing a permissionless attacker to drain funds, mint un-backed redeemables, redirect collateral or profits, or corrupt protocol accounting. The mint/redeem invariants, fee math, rounding direction (consistently floor, with precision loss absorbed by the user, never the protocol's backing), and access control all hold up under review.

The only confirmed finding is a **single unchecked integer division** (severity 3, LOW) in the governance/rebalance-context `exchange_liquidity_with_credix_lp_depository` instruction that can panic (transaction abort, no fund loss) on a zero-divisor edge case. Several items are documented as **by-design trust assumptions** inherent to a delta-neutral / illiquid-credit stablecoin (manager-set weights, reliance on Credix pool solvency, `u128::MAX` global supply cap) — these are governance/protocol-risk, not code vulnerabilities.

**Verdict: Safe to deploy.** The one LOW finding should be hardened in the next sprint.

### Severity Distribution

| Score | Label | Count |
|-------|-------|-------|
| 10 | CRITICAL | 0 |
| 9 | CRITICAL | 0 |
| 8 | HIGH | 0 |
| 7 | HIGH | 0 |
| 6 | MEDIUM | 0 |
| 5 | MEDIUM | 0 |
| 4 | LOW | 0 |
| 3 | LOW | 1 |
| 2 | INFO | 0 |
| 1 | INFO | 0 |
| **Total Findings** | | **1** |

C / H / M / L = **0 / 0 / 0 / 1**

---

## 2. Confirmed Findings

### UXD-01 — Unchecked integer division can panic on zero divisor (`exchange_liquidity`)

| Field | Value |
|---|---|
| **ID** | UXD-01 |
| **Severity** | 3 / 10 — LOW |
| **Category** | Arithmetic Safety / Denial of Service (bounded) |
| **Location** | `programs/uxd/src/instructions/credix_lp/exchange_liquidity_with_credix_lp_depository.rs:129-132` |
| **Status** | Open |

**Description.**
The share-exchange amount is computed with raw operators rather than the project's standard `checked_*` helpers:

```rust
let exchanged_shares_amount = checked_as_u64(
    u128::from(available_shares_amount) * u128::from(collateral_amount)
        / redeemable_amount_under_management,
)?;
```

The multiplication is over `u128` of two `u64`-sourced operands and therefore cannot overflow (`u64::MAX * u64::MAX < u128::MAX`). However the divisor `redeemable_amount_under_management` is **not** guarded against zero. If the Credix LP depository's `redeemable_amount_under_management` is `0` (e.g. a freshly-registered or fully-redeemed depository) the division panics, aborting the transaction. Every other division in the program routes through `checked_div` / the `compute_*` helpers, which return `UxdError::MathOverflow` instead of panicking — this call site is the lone exception.

**Impact.**
Bounded denial-of-service only. The instruction would already be economically meaningless when `redeemable_amount_under_management == 0` (there is nothing to exchange), and the `exchanged_shares_amount > 0` guard sits *after* the division so it provides no protection. No fund loss, no state corruption, no value extraction — a panic simply reverts the call. The blast radius is limited to this one governance/rebalance-context instruction.

**Recommendation.**
Use the existing checked helper so the zero case returns a graceful error:

```rust
let exchanged_shares_amount = checked_as_u64(checked_div::<u128>(
    checked_mul::<u128>(
        u128::from(available_shares_amount),
        u128::from(collateral_amount),
    )?,
    u128::from(redeemable_amount_under_management),
)?)?;
```

or add an explicit `require!(redeemable_amount_under_management > 0, UxdError::...)` guard before the computation.

**Code-grounded justification.**
Confirmed by direct read of lines 129-132. Contrast with `compute_shares_amount_for_value_floor` (utils/math/compute_shares_amount_for_value_floor.rs:14-23) and `compute_value_for_shares_amount_floor`, which both `require!(total_shares_value > 0 ...)` and use `checked_mul`/`checked_div` — the pattern the rest of the codebase follows and that this call site deviates from.

---

## 3. Investigated but not confirmed (refuted / by-design / low-confidence)

The following high-value attack hypotheses were investigated and found **not exploitable** as written. They are recorded for transparency.

**Mint/redeem 1:1 backing & supply integrity — SAFE.**
Identity-depository mint mints redeemable exactly equal to collateral transferred in (`mint_with_identity_depository.rs:110`, 1:1, no fee path), updates depository + controller accounting with `checked_add`, then enforces both the depository cap and the global supply cap *after* mutation (lines 122-153). Credix and Mercurial mint paths derive the redeemable amount from the *actually-received* LP/share value (post-CPI reload + delta verification, `mint_with_credix_lp_depository.rs:285-407`, `mint_with_mercurial_vault_depository.rs:150-199`) and enforce `redeemable_amount_after_fees <= collateral_amount`. Un-backed minting is not reachable.

**External CPI trust (Credix / Mercurial) — SAFE / by-design.**
All Credix/Mercurial accounts are pinned into depository state at registration and re-validated on every use via `has_one` (e.g. `mint_with_credix_lp_depository.rs:64-71`). The external programs are typed `Program<'info, credix_client::program::Credix>` / `mercurial_vault::program::Vault`, so the CPI target program ID is enforced by Anchor. Reliance on Credix pool solvency / NAV is an inherent protocol-risk of an illiquid-credit-backed stablecoin, documented and out of code-bug scope.

**Profit redirection via permissionless `collect_profits` / `rebalance_redeem` — REFUTED.**
These instructions are permissionless (only a `payer` signer) but the profit destination `profits_beneficiary_collateral` carries `has_one = profits_beneficiary_collateral` plus `token::mint = collateral_mint`. The stored value is only settable by the DAO via `edit_*`; until set it is `Pubkey::default()`, which no real token account can match, so collection simply reverts. A permissionless caller cannot redirect profits or backing. Overflow portions route only to the fixed identity-depository PDA. (Confirmed across `collect_profits_of_credix_lp_depository.rs`, `collect_profits_of_mercurial_vault_depository.rs`, `rebalance_redeem_withdraw_request_from_credix_lp_depository.rs`.)

**Rounding / precision-loss exploitation — REFUTED.**
Share and value conversions consistently use **floor** (`compute_value_for_shares_amount_floor`, `compute_shares_amount_for_value_floor`) and fee math uses floor (`compute_amount_less_fraction_floor`); `compute_amount_fraction_ceil` is used for *target* allocation (rounds the protocol's claim up, in the protocol's favor) and is guarded against underflow by an `amount == 0 || numerator == 0` early-return. Precision loss is deliberately charged to the user / taken from the profit slice, never from the redeemable backing (e.g. `rebalance_redeem...rs` precision-loss-from-profits logic). No dust-accumulation or first-depositor inflation path was found (1:1 USDC backing, no internal share token exposed to users).

**Access control / privilege escalation — SAFE.**
Governance instructions (`edit_controller`, `edit_controller_authority`, `freeze_program`, `register_*`, `edit_*`, `initialize_*`) are all gated by `has_one = authority` against the Controller. Router sub-instructions (`mint_with_*`, `redeem_from_*`) accept `authority == controller.key()` (the router PDA-as-signer) **or** `authority == controller.authority`, and additionally require the `user` to sign and to own the collateral/redeemable token accounts (owner constraints). No missing-signer or confused-deputy path was found.

**Arithmetic overflow / unsafe casts — SAFE.**
No `unsafe`, no `panic!`, no `wrapping_*`. The only `saturating_sub` uses (`mint.rs:215`, `redeem.rs:207`, the two rebalance files) are intentional floor-at-zero clamps on the outflow counter / profit computation and are correct. All `.unwrap()` occurrences are on compile-time-constant Pubkey strings (USDC mint) — infallible. Downcasts use `u64::try_from(...).ok().ok_or(MathOverflow)?` or `checked_as_u64`.

**`edit_controller_authority` zero-address — by-design / LOW-confidence.**
`edit_controller_authority.rs:22-24` sets `controller.authority` to an arbitrary caller-supplied `Pubkey` with no non-default check; setting it to `Pubkey::default()` would brick governance. This is a self-inflicted action by the current authorized authority (not attacker-reachable) and is a standard "irreversible admin transfer" pattern, so it is not raised as a finding.

**Global supply cap is effectively unbounded — by-design.**
`MAX_REDEEMABLE_GLOBAL_SUPPLY_CAP = u128::MAX` (lib.rs:41) makes the upper-bound validation in `edit_controller` a no-op; the *operative* cap is whatever value the DAO sets in `redeemable_global_supply_cap`. This is an intentional governance lever, not a bug.

**Mercurial / Credix slippage param `= 0` on CPI — REFUTED.**
The deposit/withdraw CPIs pass `0` for the external slippage argument, but the program substitutes its own protection: an exact post-CPI LP/share-delta equality check plus an `is_within_range_inclusive` band on the realized collateral value (`mint_with_mercurial_vault_depository.rs:168-176`, `mint_with_credix_lp_depository.rs:391-407`). Adverse precision/slippage beyond 1 native unit causes a revert.

---

*Scope note:* This is a PROGRAM-scope, AI-assisted first-pass focused on the on-chain Rust crate (`programs/uxd`). Off-chain TypeScript clients, deployment/upgrade-authority configuration, and the external Credix/Mercurial program internals were out of scope. An AI first-pass complements but does not replace a full manual audit and on-chain upgrade-authority/multisig verification.
