# Security Audit Report — Fragmetric / solana-jito-restaking

| Field | Value |
|---|---|
| **Repository** | Fragmetric/solana-jito-restaking (Jito Restaking: liquid restaking) |
| **Scope** | `vault_program/` + `vault_core/` (prioritized — funds custody), `restaking_program/` + `restaking_core/` |
| **Audit type** | AI-assisted first-pass (PROGRAM scope) |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |
| **Programs confirmed** | `vault_program` (`declare_id!(env!("VAULT_PROGRAM_ID"))`), `restaking_program` (`declare_id!(env!("RESTAKING_PROGRAM_ID"))`) — native Solana programs (non-Anchor), shank/bytemuck-based |

---

## 1. Executive Summary

This repository is the canonical Jito Restaking vault and restaking programs — native (non-Anchor) Solana programs whose share/exchange-rate accounting, deposit/withdraw flow, reward-fee logic, and admin-authority model match the upstream, multiply-audited Jito implementation. The highest-value custody paths were reviewed directly from source — `mint_with_fee` / `calculate_vrt_mint_amount`, `burn_with_fee` / `calculate_burn_summary`, the reward-fee minting path in `update_vault_balance`, the withdrawal-ticket lifecycle, vault initialization, and every admin setter — and no confirmed vulnerability was found. The first-depositor / donation inflation attack is explicitly mitigated; arithmetic uses checked ops with `u128` intermediates and vault-favorable rounding; value-moving instructions enforce signer + ATA-owner + mint constraints. Several issues surfaced by automated fan-out were verified to be false positives or upstream by-design behavior (§3).

**Verdict:** No blocker to deploy identified within program scope. Standard caveat: first-pass automated review, not a substitute for the existing formal Jito audits.

### Repository Risk Score: 0 / 10 (No confirmed findings)

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

**None.** No finding reached the confirmed-and-substantiated bar within program scope. Key evidence that the custody paths are sound:

- **Exchange rate / share math** — `calculate_vrt_mint_amount` (`vault_core/src/vault.rs:933`) returns 1:1 only when `tokens_deposited == 0`, else pro-rata `amount * vrt_supply / tokens_deposited` in `u128`. `calculate_burn_summary` (`vault.rs:1012`) computes `out = burn_amount * tokens_deposited / vrt_supply` in `u128`. Fees use `div_ceil` (vault-favorable, `vault.rs:946-962`).
- **First-depositor / donation inflation** — mitigated. `initialize_vault.rs:167-246` forces an admin deposit and mints matching VRT into a permanently-locked `burn_vault` PDA, seeding NAV at 1:1. `mint_to.rs:79-90` blocks self-deposit / vault-token-account reuse and rejects zero VRT out (`:97`).
- **Deposit/withdraw accounting** — `mint_with_fee` (`vault.rs:965`) enforces capacity, slippage (`min_amount_out`), checked supply/deposit updates. `burn_with_fee` (`vault.rs:1060`) rejects `amount_in > vrt_supply` and caps `out_amount` at `tokens_deposited - delegation_state.total_security()`.
- **Reward fee** — `update_vault_balance.rs:44-68` takes only `reward_fee_bps` of the ST reward delta, prices fee VRT against post-fee NAV, restores true balance, then mints; `check_reward_fee_effective_rate` bounds the rate within `MAX_REWARD_DELTA_BPS` (0.5%). Permissionless but value-bounded.
- **Authority** — value-moving instructions call `load_signer` (always enforces `is_signer`; second arg is `expect_writable`, `core/src/loader.rs:17`) plus explicit key-equality vs stored admin/staker, and validate token accounts via `load_associated_token_account`.
- **CPI/PDA** — mints/transfers/burns use `invoke_signed` with `vault.signing_seeds()`; VRT mint authority is the vault PDA; only `spl_token::id()` accepted on value paths (avoids Token-2022 fee-on-transfer surprises).

---

## 3. Investigated but Not Confirmed (refuted / by-design / low-confidence)

- **"Missing signer enforcement: `load_signer(admin, false)`"** — refuted. `load_signer` unconditionally returns `MissingRequiredSignature` if `!is_signer` (`core/src/loader.rs:17-28`); the `false` arg relaxes only the *writable* requirement.
- **"Missing payer signer check in close_update_state_tracker"** — refuted (`load_signer(payer, true)` at `:41`).
- **"`set_config_admin` / `operator_set_secondary_admin` don't require new admin to sign"** — by-design (upstream Jito); only an authenticated admin can self-inflict a fat-fingered key.
- **"`set_program_fee_wallet` stores unvalidated pubkey"** — by-design (later consumed as ATA owner; misconfig is self-correctable). Admin-gated + signer-checked.
- **"Reward-fee double-counting in `update_vault_balance`"** — refuted/by-design (intermediate write prices fee against post-fee NAV; net effect is correct dilution).
- **"State desync in crank tracker"** — low-confidence/refuted (atomic per-instruction mutation; tracker committed only after `all_operators_updated` and zero additional unstaking).
- **First-depositor inflation, NAV donation, fee-on-transfer, zero-mint/burn, slippage** — checked/guarded (§2).
- **Off-chain scope (checklists 08-18)** — not assessed; engagement is PROGRAM scope on the two Rust programs.
