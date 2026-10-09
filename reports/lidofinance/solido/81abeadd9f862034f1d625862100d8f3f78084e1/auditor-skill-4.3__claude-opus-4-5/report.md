# Solido (Lido for Solana) — Program Security Audit

| Field | Value |
|---|---|
| **Repository** | Lido/solido (Lido for Solana — liquid staking) |
| **Scope** | `program/` (on-chain Solido staking program) |
| **Primary program** | `program/src/` — native Rust (no Anchor); entrypoint `entrypoint.rs` -> `processor::process` |
| **Audit type** | AI-assisted first-pass (manual code review) |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |

---

## 1. Executive Summary

This audit covered the on-chain Solido program: deposit/withdraw, the per-epoch stSOL/SOL exchange-rate accounting, stake/unstake delegation to validators, reward/fee minting, validator/maintainer administration, and the manual (native, non-Anchor) account/signer/owner/PDA validation.

**Verdict:** The core staking program is well-engineered and defensively coded. Account validation is centralized in a single `accounts_struct!` macro that enforces `is_signer`/`is_writable` flags and verifies fixed-address (sysvar/program) accounts on every instruction. All value-moving PDAs (reserve, stake/mint authority, per-validator stake/unstake accounts) are re-derived and compared before any CPI. Arithmetic uses checked wrapper types (`Lamports`/`StLamports`) with `u128` intermediates; the exchange rate is fixed per-epoch (computed only by the permissionless `UpdateExchangeRate`), structurally neutralizing deposit/donation ordering and the classic first-depositor share-inflation vector. Admin actions are gated by `check_manager`, maintenance by `check_maintainer`; owner and token/mint checks are present throughout.

No confirmed vulnerabilities of severity ≥ 4. Items examined resolved to by-design behavior or pre-existing low-risk code-quality notes (§3). The codebase carries multiple prior professional audits (`audit/`). First-pass review; not a substitute for a full professional audit with runtime testing.

### Repository Risk Score: 0 / 10 (Minimal — no confirmed findings)

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 0 |
| High (7-8) | 0 |
| Medium (4-6) | 0 |
| Low (1-3) | 0 |
| **Total** | **0** |

---

## 2. Confirmed Findings

**None.** No issue reached the confidence/severity bar (≥4, substantiated from code). Highest-value paths examined and found sound:

- **Exchange-rate & share accounting** (`state.rs` `ExchangeRate::exchange_sol`/`exchange_st_sol`, 411-448): multiply-then-divide in `u128` (`token.rs:106-118`), 1:1 fallback when supply/balance zero, rounding favors the pool.
- **Deposit** (`processor.rs:180-227`): SOL transferred to reserve before stSOL minted; mint identity, mint-authority PDA, recipient account validity checked in `mint_st_sol_to` (`logic.rs:200-243`).
- **Withdraw** (`processor.rs:1034-1174`): requires current exchange rate, forces withdrawal from most-staked validator, re-derives `source_stake_account`, burns stSOL with token-owner check, enforces min stake-account balance.
- **Reward/fee minting** (`logic.rs:343-399`): gated on mint + fee-recipient identities + up-to-date rate; reward derived from observed-vs-tracked balances via `observe_balance`.
- **Stake/unstake** (`processor.rs:229-595`): maintainer-gated; PDAs re-derived/balance-checked; merge accounts epoch-scoped.
- **Manual validation**: `accounts_struct!` enforces signer/writable + const-address equality; `check_account_owner`/`deserialize_lido` enforce ownership and type discriminants.

---

## 3. Investigated but Not Confirmed (by-design / low-confidence / refuted)

- **Deposit uses per-epoch-stale exchange rate** — by design (documented in `state.rs:327-393`; rate fixed for epoch so deposits/donations commute). No theft path.
- **First-depositor / vault-donation inflation** — by design (rate is a stored snapshot updated only by permissionless `UpdateExchangeRate`; 1:1 fallback when supply zero; donations socialized at next update).
- **Dust-rounding loss on small deposits** — low-confidence/accepted (rounds down, harms only dust-depositor; favors pool).
- **`get_vote_account_commission` reads byte 68 with only owner check in perf-update path** — low-confidence, no fund-loss (bounds-safe `.get(68)`; instructions adjust perf flags only).
- **Permissionless `UpdateStakeAccountBalance` `.expect()` on subtraction** — refuted (`observe_balance` errors cleanly before; no slashing on Solana; defensive only).
- **Deprecated `Pubkey::new`** — informational, correct behavior.
- **Admin/manager trust model** — by design (manager is a multisig per `multisig/`).
