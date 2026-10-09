# Security Audit Report — ISC Bridge (Solana Swap Program)

| Field | Value |
|---|---|
| **Repository** | ISC / isc_bridge (International Stable Currency — multichain bridge) |
| **Scope** | `solana/` native Rust program (`solana/src/lib.rs`, `instructions.rs`, `processes.rs`) |
| **Audit type** | AI-assisted first-pass (PROGRAM scope) |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |
| **Program ID** | `7JAUAovyJHXsvqJkeXmjiTUpWTBADiFPagmkgj2Y2s47` (`declare_id!`, lib.rs:34) |
| **Toolchain** | native `solana-program` 1.16.1, `spl-token` 3.5.0, `spl-associated-token-account` 1.1.3 — NO Anchor |

---

## 1. Executive Summary

The in-scope Solana program is a small (~360 LOC), single-purpose **1:1 swap pool** between two SPL mints — `ISC` (the stablecoin) and `OIL` (the Wormhole-wrapped bridge counterpart of ISC). It exposes exactly two instructions (`SwapIscToOil`, `SwapOilToIsc`). It is NOT a lock/mint bridge with off-chain signature attestation; there is no mint authority, no message/proof verification, and no replay-protected minting in this program — those live on the EVM/Wormhole side (out of scope).

The program does most manual native validation correctly: the signer is checked, the program-derived `oolaa` PDA is re-derived and compared, both PDA token vaults are checked against `get_associated_token_address`, both mints are pinned to hardcoded constants, and the token/ATA/system program IDs are all verified. The PDA signs only for its own correctly-derived ATAs via `invoke_signed`. Every value-moving path requires the user's signature and an equal-and-opposite real SPL transfer, so **no permissionless drain, admin backdoor, or asymmetric value-extraction path** was found.

Confirmed issues are limited to robustness/defense-in-depth. No CRITICAL or HIGH issues. Acceptable to deploy with the items tracked, provided the 1:1 peg and the off-chain bridge components (out of scope) are sound.

### Repository Risk Score: 4 / 10 (Low)

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 0 |
| High (7-8) | 0 |
| Medium (4-6) | 1 |
| Low (1-3) | 2 |
| Informational | 1 |
| **Total** | **4** |

---

## 2. Confirmed Findings

### ISC-01 — Unvalidated borsh deserialization panics on malformed instruction data
- **Severity:** 3 / 10 — Low
- **Category:** Input Validation / DoS (robustness)
- **Location:** `solana/src/instructions.rs:17`

`SwapInstruction::unpack` does `SwapPayload::try_from_slice(payload).unwrap();` on fully attacker-controlled instruction data; malformed/short data panics instead of returning `InvalidInstructionData`. The panic aborts the instruction before any state change, so the practical effect is a failed transaction — no state corruption or cross-user DoS.

**Recommendation.** Replace `.unwrap()` with `.map_err(|_| ProgramError::InvalidInstructionData)?` and validate length before split.

### ISC-02 — Copy-paste bug: user OIL token account program-owner never validated
- **Severity:** 4 / 10 — Medium (auditor labeled Low)
- **Category:** Account Validation (native owner check)
- **Location:** `solana/src/processes.rs:60` and `:231` (both swap handlers)

After unpacking the user's OIL token account, the code re-checks the wrong account (`acc_info_initializer_isc_ata.owner` twice) instead of `acc_info_initializer_oil_ata.owner`, so the user OIL ATA's program-owner is never explicitly verified. Defense-in-depth gap only: the account still goes through `TokenAccount::unpack_from_slice` and the `spl_token::transfer` CPI, where SPL enforces ownership and rejects non-token accounts. No confirmed value-extraction path.

**Recommendation.** Change both occurrences to check `acc_info_initializer_oil_ata.owner != spl_token::id()`.

### ISC-03 — Hardcoded test private key committed in client config
- **Severity:** 3 / 10 — Low
- **Category:** Secrets / OpSec
- **Location:** `web-client/config/config.json`

A Solana secret-key byte array and EVM private keys are committed in cleartext; the EVM key is the well-known Hardhat default account #0 and the Solana key is wired to `127.0.0.1:8899`/localhost (local-devnet test materials). No mainnet exposure, but poor practice.

**Recommendation.** Move keys to untracked `.env`, gitignore the config, rotate any key that ever touched a funded address.

### ISC-04 — No event emission for swaps (only `msg!` logs)
- **Severity:** 2 / 10 — Info
- **Category:** Logging / Monitoring
- **Location:** `solana/src/lib.rs:22-30`, `processes.rs`

Value-moving operations emit only human-readable `msg!` strings; no structured event for off-chain reconciliation/monitoring.

**Recommendation.** Emit a structured `sol_log_data` record (direction, amount, user, slot).

---

## 3. Investigated but Not Confirmed (refuted / by-design / low-confidence)

- **1:1 swap, no slippage** — by design (ISC↔OIL pegged pair; both `decimals: 9`, unit-consistent).
- **Mint authority / infinite mint** — N/A in scope (program only transfers pre-existing balances; minting/attestation live on EVM/Wormhole side).
- **Bridge fake-proof / signature replay** — N/A in this program (no on-chain proof/signature path).
- **PDA drain / missing PDA validation** — refuted (`find_program_address` re-derivation + compare; vault ATAs compared to `get_associated_token_address`; correct `invoke_signed` seeds).
- **Missing signer check** — refuted (`is_signer` enforced; user is transfer authority).
- **Reentrancy / CEI** — N/A (no mutable on-chain state).
- **Reinitialization** — N/A (idempotent ATA creation with lamports==0 guard).
- **Arithmetic overflow** — N/A (`amount` forwarded verbatim to `spl_token::transfer`).
- **Vault donation / first-depositor inflation** — N/A (fixed 1:1 reserve, no share math).
- **Program/account-program-id checks** — pass (program id, token program, ATA program, system program all verified).
