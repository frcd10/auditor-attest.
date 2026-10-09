# Balanced Solana Contracts — Security Audit Report

| Field | Value |
|---|---|
| **Repository** | Balanced/Balanced-Solana-contracts |
| **Scope** | `programs/asset-manager`, `programs/xcall-manager`, `programs/balanced-dollar` (plus `programs/spoke-token`, reviewed as a near-clone of balanced-dollar) |
| **Audit type** | AI-assisted first-pass (PROGRAM scope: checklists 01-07, 16) |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |
| **Program IDs** | asset-manager `64Ma38GVE1cZ4CkruVYT75D2Ghy93Sk7usH5kiTTtZNp`; xcall-manager `7A2mHXBQCBd53UqUuZpk6HSwoYDyaKGWSPWeniwNKpUJ`; balanced-dollar `6LiSpv3cQzYDrzAW6wgbphSTquyvBngeBhyT76oQwBBi` |
| **Anchor / Solana** | anchor-lang 0.30.1, anchor-spl 0.30.1 |

---

## 1. Executive Summary

The three in-scope programs implement a cross-chain (ICON ↔ Solana) bridge: `asset-manager` custodies SPL tokens and native SOL in PDA vaults; `balanced-dollar`/`spoke-token` mint/burn a wrapped asset; `xcall-manager` holds the list of trusted relayer "protocols" and authorizes inbound messages. All cross-chain entrypoints (`handle_call_message`) are gated by a correctly-constructed `xcall_singer` Signer whose address must equal the xcall `config` PDA — only the xcall program can sign for its own config PDA, so the handlers cannot be invoked directly by an attacker. Message origin is validated against `state.icon_*`, and recipient/mint are bound to decoded message fields. Replay protection is delegated to xcall (out of scope).

No permissionless fund-drain or forged-message mint/withdraw path was found in-scope. The highest-confidence issue is a **state-persistence bug in `xcall-manager::handle_call_message`**: it mutates a *clone* of the state account and never writes it back, so the cross-chain `ConfigureProtocols` governance action (and its whitelist consumption) is silently a no-op — breaking relayer rotation/recovery. Lower-severity hardening gaps are also noted.

Verdict: **Not safe to deploy as-is** until the xcall-manager state-persistence bug is fixed and the governance/recovery path is tested end-to-end. No critical/high fund-loss finding confirmed.

### Repository Risk Score: 6 / 10 (Medium)

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 0 |
| High (7-8) | 0 |
| Medium (4-6) | 2 |
| Low (1-3) | 3 |
| Informational | 1 |
| **Total** | **6** |

---

## 2. Confirmed Findings

### BL-01 — Cross-chain governance/recovery (`ConfigureProtocols`) silently does nothing: state mutated on a clone, never persisted
- **Severity:** 6 / 10 — Medium
- **Category:** State machine / Access control (governance)
- **Location:** `programs/xcall-manager/src/instructions.rs:109-163` (esp. 115, 130, 151-152)

`handle_call_message` begins with `let mut state = ctx.accounts.state.clone();`. All mutations (whitelist `retain` at 130; `state.sources`/`state.destinations` at 151-152) operate on the local clone and are never written back (no `set_inner`/`*ctx.accounts.state = state`). Anchor discards them. Contrast `set_protocols` (49-58), which correctly mutates `&mut ctx.accounts.state`.

**Impact.** The cross-chain `ConfigureProtocols` governance message (relayer rotation + `verify_protocol_recovery`) is a no-op; the whitelisted action is never consumed (remains replayable through the handler); and during an incident the recovery flow returns `success: true` while changing nothing — a dangerous silent failure.

**Recommendation.** Operate on `&mut ctx.accounts.state` and persist; ensure account space fits the new vectors; add a test asserting on-chain `sources`/`destinations` changed and the whitelisted action was removed.

### BL-02 — Rate-limit arithmetic unchecked; correctness relies on the release `overflow-checks` flag, and misconfig disables the limit
- **Severity:** 5 / 10 — Medium
- **Category:** Arithmetic safety / Economic logic
- **Location:** `programs/asset-manager/src/instructions.rs:84-105` (`calculate_limit`), 609-619 (`verify_withdraw`)

`calculate_limit` uses plain `*`/`/` on `u64` with no `checked_*`/`u128`. Safety depends entirely on `overflow-checks = true` in `[profile.release]`. `percentage` near 10000 makes `max_limit ≈ balance`; `period == 0` returns limit 0 (no limiting).

**Impact.** With overflow-checks on, large balances make legit withdrawals revert (DoS); with it off, the limit can be bypassed via overflow. Misconfig silently disables the limiter — the primary custody safeguard.

**Recommendation.** Use `u128` intermediates with `checked_mul`/`checked_div`; reject `period == 0`; bound `percentage`. Don't rely on the build profile for financial-math safety.

### BL-03 — Per-token creation-fee PDA is created with `init` (write-once) and cannot be updated
- **Severity:** 4 / 10 — Low
- **Category:** Access control / Operational
- **Location:** `asset-manager/src/states.rs:50-58`; `balanced-dollar/src/states.rs:31-40`

`set_*_creation_fee` use `#[account(init, ...)]`, so the fee can be set once and never adjusted. Under/overpricing the ATA-creation subsidy has no remediation short of a program upgrade.

**Recommendation.** Use `init_if_needed` (with the existing admin check), or add a dedicated update instruction.

### BL-04 — `to_native`/`to_authority` are unchecked `AccountInfo`; recipient binding is imperative, not constraint-enforced
- **Severity:** 3 / 10 — Low
- **Category:** Account validation
- **Location:** `asset-manager/src/states.rs:158-167`; `balanced-dollar/src/states.rs:77-86`

The destination ATA `to` is `init_if_needed` with `authority = to_native`/`to_authority` (unchecked). Safety comes from in-body `recipient == to_native.key()` checks (which hold on every branch reviewed). Residual: validation lives in imperative code, brittle to future refactors.

**Recommendation.** Bind the recipient via constraint where feasible; keep `require_keys_eq!` as backup; add revert tests.

### BL-05 — `ResetLimit` accounts struct lacks admin authority and is dead/partially wired
- **Severity:** 3 / 10 — Low
- **Category:** Access control / Code quality
- **Location:** `asset-manager/src/states.rs:60-71`

`ResetLimit` declares `admin: Signer` but has no `has_one = admin`/`address = state.admin` and no `seeds` on `state`, and no `lib.rs` instruction uses it. Dead today; a latent access-control hole if wired up (any signer could reset rate-limit state).

**Recommendation.** Remove it, or add `has_one = admin` + `seeds` before exposing any `reset_limit` instruction.

### BL-06 — `force_rollback` relies on positional `remaining_accounts` with no in-program validation
- **Severity:** 2 / 10 — Info
- **Category:** CPI / Account validation
- **Location:** `asset-manager/src/instructions.rs:621-652`; `balanced-dollar/src/instructions.rs:310-342`

`force_rollback` and the senders read `remaining_accounts[0..N]` by index and forward to xcall without validating pubkeys; safety delegated to xcall + admin gating. Panic-on-out-of-range if the client omits accounts.

**Recommendation.** Validate forwarded `config`/`proxy_request`/`admin` keys and bounds-check `remaining_accounts.len()`.

---

## 3. Investigated but Not Confirmed

- **Forged cross-chain message → unauthorized mint/withdraw** — refuted (`xcall_singer` Signer constrained to `find_program_address([b"config"], state.xcall).0`; origin checked vs `state.icon_*`).
- **Missing signer / admin access control** — refuted (`address = state.admin`/`has_one = admin` on privileged ops; exception is dead `ResetLimit`).
- **Inbound replay** — out of scope / by-design (delegated to xcall `proxy_request` consumption); BL-01 whitelist bug is separate.
- **Mint/burn amount-scaling overflow** — refuted as exploitable (`overflow-checks` reverts; balance-bounded; ≤1-unit over-burn not profitable).
- **Vault PDA / authority substitution** — refuted (`associated_token::authority` + `VAULT_SEED` constraints; handlers re-assert `get_vault_pda`; PDA-signed transfers).
- **Rate-limit bypass via fee transfer** — low-confidence/by-design (fee bounded by admin-set creation fee; first-time ATA only).
- **Revert origin check uses `state.xcall`** — by-design (reverts emitted by local xcall).
- **Token-2022 / fee-on-transfer / freeze griefing** — N/A (legacy SPL `Token` program).
- **`spoke-token`** — mirrors `balanced-dollar`; BL-02/BL-03 apply analogously.
