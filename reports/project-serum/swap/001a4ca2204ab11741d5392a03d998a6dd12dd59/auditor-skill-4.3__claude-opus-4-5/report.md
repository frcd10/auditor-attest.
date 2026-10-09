# Security Audit Report — Serum `swap` Program

**Repository:** project-serum/swap (`Serum/swap`)
**Scope:** `programs/swap` (PROGRAM scope) — primary program `serum_swap` (confirmed via `#[program] pub mod serum_swap` + `declare_id!("22Y43yTVxuUkoRKdm9thyRhQ3SdgQS7c7kB6UNCiaczD")`, `lib.rs:19,28`)
**Audit type:** AI-assisted first-pass security review
**Date:** 2026-06-20
**Auditor:** Automated security review agent (Claude)
**Anchor / anchor-spl:** 0.19.0 · **Language:** Rust (~733 LOC, single file)

---

## 1. Executive Summary

The `swap` program is the canonical Project Serum thin Anchor wrapper for instantly-settled IOC trades (direct `swap`) and two-leg transitive trades (`swap_transitive`) on the Serum DEX, plus open-orders init/close helpers. It is **non-custodial**: every value-moving instruction requires `authority` to sign, and that same authority must be the open-orders authority DEX-side, so token movement is confined to the signer's own wallets/open-orders account. On-chain slippage protection is genuinely enforced *after* the trade from balance deltas the program reads itself (`apply_risk_checks`), defeating the off-chain-min-out mistake and bounding MEV/sandwich loss to the user's stated `min_exchange_rate`.

The main weakness is that CPI target programs (`dex_program`, `token_program`) and all SPL token/market accounts are raw, unconstrained `AccountInfo` (no program-ID, `mint`, `owner`, or `token::authority` checks) — the program leans entirely on the downstream DEX and the signer-equals-authority invariant. Given the non-custodial design this is not a permissionless drain, but it is a real defense-in-depth gap.

### Repository Risk Score: 5 / 10 (Medium)

Acceptable to deploy in its original form with tracking; remediate before reuse. No finding ≥ 7.

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 0 |
| High (7-8) | 0 |
| Medium (4-6) | 2 |
| Low (1-3) | 2 |
| **Total** | **4** |

---

## 2. Confirmed Findings

### SR-01 — CPI target programs are unconstrained `AccountInfo` (no program-ID check)

| | |
|---|---|
| **Severity** | Medium (5 / 10) |
| **Category** | Unchecked CPI target (KV-009) |
| **Location** | `lib.rs:382-383` (Swap), `:415-416` (SwapTransitive); used `:33,42,527,556` |

`dex_program`/`token_program` are bare `AccountInfo` with no `Program<>` typing and no `require_keys_eq!(…, &dex::ID)`; every CPI is issued to whatever the caller supplies via `CpiContext::new(ctx.accounts.dex_program.clone(), …)`. `dex::ID` is referenced only at `:469` as an owner-check on the market account, not on the invoked program. anchor-spl 0.19 `new_order_v3`/`settle_funds`/`init_open_orders` do not assert the context program equals `serum_dex::ID`.

**Impact:** Bounded by the non-custodial design (a third party can't drain an uninvolved user), but a user/relayer can be tricked into authorizing a malicious look-alike program, and any fork relaxing the signer model inherits a silent drain primitive.

**Recommendation:** Type as `Program<'info, Dex>` / `Program<'info, Token>` or add explicit `require_keys_eq!` guards.

### SR-02 — SPL token / market accounts lack `owner`, `mint`, `token::authority` constraints

| | |
|---|---|
| **Severity** | Low (4 / 10) |
| **Category** | Account validation / token-account mismatch (KV-015 / KV-016) |
| **Location** | `lib.rs:379-385`, `:591-623` |

`pc_wallet`, `coin_wallet`, `order_payer_token_account`, vaults, and market structural accounts are bare `AccountInfo` constrained only by `mut` + `key != empty::ID`. No mint/authority/owner constraints; only `from_mint != to_mint` is enforced (`_is_valid_swap`, `:651-657`). DEX-side checks plus the program's own balance-delta/`min_exchange_rate` check close the loop in the shipped config (no confirmed drain), but the delta logic at `:98-99` relies on an *implicit, unconstrained* invariant that the same accounts are reused on both legs.

**Recommendation:** Promote to `Account<TokenAccount>` with `token::mint`/`token::authority`, constrain market/vaults `owner = dex::ID`, or at minimum assert the same-accounts invariant.

### SR-03 — `.unwrap()` on checked arithmetic panics instead of returning an error

| | |
|---|---|
| **Severity** | Low (3 / 10) |
| **Category** | Arithmetic safety / DoS (AR-002 / AR-004) |
| **Location** | `lib.rs:98-99,162-191,585`; `apply_risk_checks` chain `:229-310` |

Underflow/divide-by-zero/`checked_pow` overflow (client-supplied `from_decimals`/`quote_decimals` are `u8` up to 255; `quote_amount - spill_amount` divisor at `:279-285` can be 0) panic with an opaque error. No fund loss (atomic revert); self-inflicted griefing only.

**Recommendation:** Use `.ok_or(ErrorCode::MathOverflow)?` and bound the decimals before `checked_pow`.

### SR-04 — `init_account` / `close_account` helpers carry no program-ID or ownership constraints

| | |
|---|---|
| **Severity** | Info (2 / 10) |
| **Category** | Account validation |
| **Location** | `lib.rs:326-369` |

Same unconstrained `dex_program` root cause as SR-01; `open_orders`/`market` lack `owner = dex::ID`. Minimal impact (signer only affects own open-orders account).

**Recommendation:** Apply SR-01's typed-program fix here too.

---

## 3. Investigated but Not Confirmed

- **Slippage / min-out enforcement** — by design, correct (on-chain `apply_risk_checks`, `:212-321`, derived from signer input + self-read balance deltas; refutes KV-007).
- **Missing signer check (KV-013)** — refuted (`authority` is `signer` on all instructions and is the DEX open-orders authority).
- **Leftover-funds / custodial drain** — refuted (transitive `spill_amount` stays in the user's own `pc_wallet`).
- **Reentrancy (KV-003)** — N/A (no persistent mutable state).
- **PDA seed collision / type cosplay (KV-010 / 026)** — N/A (program derives/signs no PDAs of its own).
- **Arithmetic overflow (KV-011)** — overflow-safe (`checked_*`); only the panic-vs-error quality issue remains (SR-03).
- **Same-mint guard** — by design (`:651-657`).
- **Anchor.toml 0.17.0 vs Cargo 0.19.0 version mismatch** — INFO/opsec only, no on-chain impact.
