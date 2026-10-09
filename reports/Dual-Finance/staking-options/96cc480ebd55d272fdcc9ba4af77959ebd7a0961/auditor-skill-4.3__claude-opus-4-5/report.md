# Security Audit Report — Dual Finance Staking Options

**Repository:** Dual-Finance / staking-options
**Scope:** `programs/staking-options/` (single Anchor program; `declare_id!("4yx1NJ4Vqf2zT1oVLk4SySBhhDJXmXFt88ncm4gPxtL7")`, `#[program] pub mod staking_options`). No `programs/gso` present in this checkout.
**Audit type:** AI-assisted first-pass security review (manual code walk of all instruction handlers)
**Date:** 2026-06-20
**Auditor:** Automated security review agent (Claude)

---

## 1. Executive Summary

The `staking-options` program implements a covered-call style staking-options protocol: a project `config`s an SO (depositing base collateral into a PDA vault), defines `strike`s (each minting a 0-decimal option mint at a PDA), `issue`s option lots to users, lets users `exercise` (burn option, pay quote, receive base), and lets the authority `withdraw` collateral after subscription/expiration. A reversible variant escrows quote tokens in a second vault.

The core collateral accounting is sound: issuance debits `options_available`, exercise transfers `amount_lots * lot_size` base out of the PDA vault, and arithmetic uses `checked_*` throughout. Vault and mint PDAs are correctly bound to `state` + seeds, and the privileged `config`/`issue`/`init_strike`/`withdraw` paths enforce `state.authority` (or `issue_authority`).

The most significant issue is in **`modify_expiration`**, which is missing both an authority check and any binding of the supplied `option_mint`/`user_so_account` to the program-derived option mint. Because the only ownership tie is the runtime equality `user_so_account.amount == option_mint.supply`, **any unprivileged user can supply a self-created mint they fully hold and accelerate the expiration of any single-strike SO**, causing legitimately-issued (potentially in-the-money) options held by other users to expire early and become unexercisable.

The program is **not recommended for deployment** until DF-01 is fixed.

### Repository Risk Score: 7 / 10 (High)

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 0 |
| High (7-8) | 1 |
| Medium (4-6) | 0 |
| Low (1-3) | 2 |
| Informational | 1 |
| **Total** | **4** |

---

## 2. Confirmed Findings

### DF-01 — `modify_expiration` is unauthenticated and accepts an arbitrary option mint, letting anyone force-expire others' options

| | |
|---|---|
| **Severity** | 7 / 10 — High |
| **Category** | Access Control / State Machine / Account Validation |
| **Location** | `programs/staking-options/src/instructions/modify_expiration.rs:6-49`; registered with no `#[access_control]` in `lib.rs:153-159` |

`modify_expiration` is the only instruction registered without an `#[access_control(...)]` guard. The handler's only checks are an "accelerate-only" comparison, `strikes.len() == 1`, `user_so_account.owner == authority.key`, and `user_so_account.amount == option_mint.supply`. There is **no `require_keys_eq!(authority.key(), state.authority)`**, and `option_mint`/`user_so_account` carry **no seeds/PDA constraint and no link to `state`** (no `check_mint!`). An attacker can create their own SPL mint, mint full supply to themselves, and pass both — all asserts pass.

**Impact.** Any unprivileged user can accelerate `option_expiration` (and `subscription_period_end`) of any single-strike SO to now. Real holders of in-the-money options can no longer exercise (`exercise.rs:167` rejects after expiry), losing the option value; the genuine authority can then immediately drain the base vault via `withdraw`. Permissionless griefing + economic loss.

**Recommendation.** (1) Require `state.authority`; (2) bind `option_mint` to the program via PDA/`check_mint!` and constrain `user_so_account.mint == option_mint.key()`; (3) replace `assert!` with typed `require!` errors.

### DF-02 — `withdraw_all` quote-fee can be evaded via an unconstrained, attacker-chosen `quote_account`

| | |
|---|---|
| **Severity** | 4 / 10 — Low |
| **Category** | Economic Logic / Account Validation |
| **Location** | `programs/staking-options/src/instructions/withdraw.rs:136-151, 228-229` |

On the post-expiration branch, the DUAL fee is `0` when `is_fee_exempt(quote_account.owner)` is true; `quote_account` is caller-chosen with no owner/PDA constraint. The authority (project) can route to a fee-exempt-owned account to zero the fee. Only DUAL fee revenue at risk; exploitable only by the trusted authority.

**Recommendation.** Compute exemption from a state-bound identity, or constrain `quote_account` to `state.quote_account`.

### DF-03 — `exercise` uses a hardcoded 3.5% fee that rounds to zero for small payments; inconsistent with `withdraw_all`

| | |
|---|---|
| **Severity** | 3 / 10 — Low |
| **Category** | Economic Logic / Rounding |
| **Location** | `programs/staking-options/src/instructions/exercise.rs:31-62` |

`fee = payment * 35 / 1_000` truncates to 0 for `payment < 29` atoms and generally rounds down; `withdraw_all` uses tiered `get_fee_bps` instead, so pricing is inconsistent. Minor bounded fee leakage; no user/collateral loss.

**Recommendation.** Use shared `get_fee_bps`/`is_fee_exempt` and round fees up.

### DF-04 — Panic-style validation (`assert!`, `.unwrap()` on `Clock`) instead of typed errors

| | |
|---|---|
| **Severity** | 2 / 10 — Info |
| **Category** | Code Quality / Error Handling |
| **Location** | `modify_expiration.rs:11-18`; `macros.rs:3,12`; `withdraw.rs:9,94` |

Raw `assert!`/`.unwrap()` abort via panic rather than returning structured `SOErrorCode`. No fund-safety impact; opaque errors and inconsistent with the codebase's `require!` usage.

---

## 3. Investigated but Not Confirmed

- Collateral conservation across issue/exercise — refuted (base out matches base locked).
- Vault / option-mint PDA substitution in issue/exercise/withdraw/add_tokens — refuted (seeds+bump constrained; mints re-derived via `check_mint!`).
- Authority enforcement on privileged paths — pass everywhere except `modify_expiration` (DF-01).
- `exercise` quote/fee mint mismatch — refuted (SPL enforces equal mints; fee account pinned to DUAL_DAO).
- Reentrancy via CPI — refuted (CPIs target SPL Token/Metaplex only).
- Integer overflow — refuted (checked math; `name_token` f64 is display-only; note: no workspace `overflow-checks`).
- `init_strike` duplicate strike push — low-confidence/non-security (vector is monitoring-only, bounded 100).
- `so_name` length / PDA seed collision — by-design (`len < 32`, PDAs include `base_mint`).
