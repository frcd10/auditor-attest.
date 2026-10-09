# Security Audit Report — Hedgehog Parimutuel (Eclipse)

| Field | Value |
|---|---|
| **Repository** | hpl-parimutuel-eclipse (Hedgehog Markets) |
| **Scope** | `programs/parimutuel` (native Solana program; primary program ID `PARrVs6F5egaNuz8g6pKJyU4ze3eX5xGZCFb3GLiVvu`) + shared `crates/cpi` |
| **Audit type** | AI-assisted first-pass program-scope security review |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |

---

## 1. Executive Summary

This is a native (non-Anchor) parimutuel prediction-market program. Accounts are typed via a discriminator (`AccountType`) with explicit program-owner checks in `safe_deserialize`/`check_account_owner`, and PDAs are derived/asserted via a `pdas!` macro. General hygiene is good: signer checks, token/system program ID checks, discriminator + owner checks, checked arithmetic with `u128` intermediates, and PDA assertions in **most** instructions.

However, **`DepositV1` fails to validate that the supplied `deposit` token account is the market's canonical deposit PDA** (`pda::deposit::assert_pda` is present in `claim`, `withdraw`, and `invalidate` but **omitted in `deposit`**). Since pool accounting (`market.amounts` / `user_position.amounts`) is incremented from the instruction `amount` while tokens are transferred into an **attacker-controlled** destination, an attacker can record fully-backed-looking positions without funding the real pool, then `Claim` a payout paid out of the **canonical deposit PDA holding honest users' real deposits**. Permissionless total drain.

**Verdict: NOT safe to deploy.** One CRITICAL (10/10) finding must be fixed before any release.

### Repository Risk Score: 10 / 10 (Critical — do not deploy)

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 1 |
| High (7-8) | 0 |
| Medium (4-6) | 0 |
| Low (1-3) | 2 |
| **Total** | **3** |

---

## 2. Confirmed Findings

### HH-01 — `DepositV1` does not validate the deposit token account is the canonical market PDA → permissionless pool drain

| | |
|---|---|
| **Severity** | 10 / 10 — Critical |
| **Category** | Account Validation / Token-Account Mismatch / Economic |
| **Location** | `programs/parimutuel/src/processor/deposit_v1.rs:17-93` (absence of `pda::deposit::assert_pda`; transfer at `:78-89`) |

`deposit_v1` validates the `user_position` PDA, market PDA, market mint, and option index, and increments `market.amounts[option]` and `user_position.amounts[option]` by `args.amount` (`:59`, `:69`). It then transfers `args.amount` into `ctx.accounts.deposit` (`:78-89`) — but **never checks `deposit` against the canonical deposit PDA.** Every other token-moving instruction asserts it (`claim_v1.rs:36`, `withdraw_v1.rs:26`). As a native program, Shank `#[account]` annotations impose no on-chain constraints, and the transfer authority is the user's own signed `wallet`, so the destination can be any attacker-controlled token account of the correct mint.

**Impact.** (1) Honest users fund the canonical PDA. (2) Attacker calls `DepositV1` on the winning option with a large `amount`, passing their **own** token account as `deposit` — accounting is recorded but the canonical PDA isn't funded. (3) After resolution, `ClaimV1` pays `winnings + user_correct` **out of the canonical PDA** (`claim_v1.rs:125-136`), draining honest users' real funds. Permissionless total loss.

**Recommendation.** Add `pda::deposit::assert_pda(ctx.accounts.deposit.key, ctx.accounts.market.key)?;` before transferring, mirroring `claim`/`withdraw`.

### HH-02 — `WithdrawV1` does not assert the market mint (defense-in-depth gap)

| | |
|---|---|
| **Severity** | 4 / 10 — Low |
| **Category** | Account Validation |
| **Location** | `programs/parimutuel/src/processor/withdraw_v1.rs:11-83` |

Unlike `claim_v1` (`:28` calls `market.assert_mint`), `withdraw_v1` never calls `market.assert_mint(mint.key)`. Not directly exploitable — `transfer_checked` enforces the mint matches the source PDA token account — but a missing explicit invariant.

**Recommendation.** Add `market.assert_mint(ctx.accounts.mint.key)?;` for parity with `claim_v1`.

### HH-03 — Market resolver is fully creator-defined (centralized resolution trust)

| | |
|---|---|
| **Severity** | 3 / 10 — Low (by-design centralization) |
| **Category** | Access Control / Oracle Authority |
| **Location** | `create_market_v1.rs:91-99` (resolver = `args.resolver`); `resolve_v1.rs:39` |

The creator sets `resolver` to an arbitrary key; `resolve_v1` only checks `market.assert_resolver` + a timestamp gate. No oracle, dispute window, or bond. A creator-controlled resolver can resolve to a self-favoring outcome. Inherent to the design; partially mitigated by `InvalidateInactiveV1`.

**Recommendation.** Document the resolver trust model; consider an optional dispute/timelock or curated resolver allowlist for high-value markets.

---

## 3. Investigated but Not Confirmed

- **Double-claim / replay** — refuted (`UserPositionV1::claim()` sets/checks `claimed`; mark-claimed before transfer; re-init blocked by discriminator/owner checks).
- **Integer overflow/underflow** — refuted (`checked_add!`, `TrySum`, `u128` intermediates; truncation favors pool).
- **Fee > 100%** — refuted (`create_market_v1.rs:57-60` rejects `creator+platform > 10_000` bps).
- **Unchecked CPI target / token program** — refuted (`assert_token_program` allows only Token/Token-2022; system program asserted).
- **Missing signer checks** — refuted (`assert_signer` on all authorities; platform/creator fee withdrawals gated).
- **Owner / type confusion** — refuted (program ownership + discriminator enforced for all program accounts).
- **PDA seed collision** — low concern (distinct fixed-width seed prefixes per family).
- **Vault donation / first-depositor inflation** — refuted for this model (payouts driven by recorded `market.amounts`, not raw balance). HH-01 is the inverse (record without funding) — the real risk.
- **`create_config_v1` permissionless creation** — low-confidence/by-design (single global config PDA, created once; re-init blocked). Recommend atomic creation at deploy.
- **Token-2022 transfer-hook / fee-on-transfer** — low-confidence: accounting credits `args.amount` rather than observed balance delta; with fee-on-transfer mints recorded `amounts` could exceed received. With HH-01 fixed, consider crediting from observed delta for fee-bearing mints.
