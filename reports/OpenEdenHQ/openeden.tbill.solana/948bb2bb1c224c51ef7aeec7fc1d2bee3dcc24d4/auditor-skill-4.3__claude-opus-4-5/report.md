# Security Audit Report — OpenEden tBILL (Solana Token-2022 Transfer Hook)

| Field | Value |
|---|---|
| **Repository** | openeden.tbill.solana |
| **Scope** | `programs/tbill` (`declare_id!` = `48n7YGEww7fKMfJ5gJ3sQC3rM6RWGjpUsghqVfXVkR5A`) |
| **Audit type** | AI-assisted first-pass, PROGRAM-scope |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |

---

## 1. Executive Summary

The on-chain program in scope is intentionally minimal. It is **not** the RWA fund/NAV/subscribe-redeem engine — that logic lives entirely off-chain. The deployed program (`programs/tbill/src/lib.rs`, ~181 lines) is a **Token-2022 Transfer Hook program** plus a single global **pause** kill-switch. There is no on-chain custody of value, no token mint/burn, no NAV/oracle/price math, no fee accounting, and no per-instruction transfers. The whole class of "permissionless drain / NAV manipulation / fee rounding / mint-authority abuse" is out of the on-chain attack surface by construction.

Compliance/allowlist enforcement is implemented at the **token layer** (Token-2022 `DefaultAccountState = Frozen` + a Freeze Authority controlled by a Squads multisig), not in the program. The transfer hook only enforces a single boolean global pause. Account validation is correct: typed Anchor accounts, PDA seeds + bump, the `pause` account resolved through the `ExtraAccountMetaList` (cannot be spoofed), and the two privileged instructions gated by `address = ADMIN_PUBKEY`.

No CONFIRMED finding rises above LOW. Residual risks are centralization/availability (pause + freeze are powerful kill-switches; if `ADMIN_PUBKEY` is a single key, a compromise can halt all transfers — DoS, not theft) and minor account hygiene.

### Repository Risk Score: 3 / 10 (Low)

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 0 |
| High (7-8) | 0 |
| Medium (4-6) | 0 |
| Low (1-3) | 3 |
| Informational | 1 |
| **Total** | **4** |

---

## 2. Confirmed Findings

### OE-01 — Pause / freeze kill-switch is a single-point centralization & DoS lever
- **Severity:** 4 / 10 — Low
- **Category:** Access Control / Centralization / Availability
- **Location:** `programs/tbill/src/lib.rs:20` (`ADMIN_PUBKEY`), `:92-96` (`update_pause`), `:69-73` (`transfer_hook`), `:100-105`

The transfer-hook gate is a single global boolean `require!(pause.state == false, Error::Paused)`. `update_pause` is gated only by `address = ADMIN_PUBKEY` (a hardcoded constant). README states it "should be a Squads multisig," but the program cannot enforce that.

**Impact.** If `ADMIN_PUBKEY` is an EOA, a one-key compromise lets an attacker set `pause.state = true` and halt every token transfer globally (DoS/griefing). Cannot mint, burn, redirect, or steal — availability risk, not fund loss. The Token-2022 freeze authority is an even stronger lever, reinforcing that key management is the dominant risk.

**Recommendation.** Confirm/document on deployment that `ADMIN_PUBKEY` and the mint's freeze/hook authority are the Squads multisig; emit events on pause changes; document an unpause runbook.

### OE-02 — `update_pause` uses `init_if_needed` with no initialized/version guard
- **Severity:** 3 / 10 — Low
- **Category:** Account Validation / Reinitialization hygiene
- **Location:** `programs/tbill/src/lib.rs:106-113`; `Cargo.toml:20`

`pause` is `init_if_needed`, so `update_pause` both creates and mutates the singleton. Risk largely neutralized (admin-gated, single field overwritten unconditionally, fixed seeds), but `init_if_needed` is discouraged and the creation default `state = false` is fail-open.

**Recommendation.** Split into explicit `initialize_pause` (`init`) + mutate-only `update_pause`, or default a fresh pause to `state = true` (fail closed).

### OE-03 — Transfer hook does not enforce sender/recipient allowlisting (KYC is off-chain only)
- **Severity:** 3 / 10 — Low (by-design, residual-risk note)
- **Category:** Access Control / Compliance design
- **Location:** `programs/tbill/src/lib.rs:69-73`, `:142-167`

The hook only checks the global pause; it performs no allowlist/permission comparison on source/destination/owner. By design — gating is enforced at the token layer (`DefaultAccountState = Frozen` + freeze authority). Recorded as a residual-risk note: holder gating rests entirely on the freeze authority's off-chain process and key custody, with no on-chain backstop.

**Recommendation.** Accept as-designed; document the model. Optionally add an on-chain allowlist PDA check for defense-in-depth if regulation demands redundancy.

### OE-04 — Uninitialized `pause` PDA causes all transfers to revert (fail-closed dependency)
- **Severity:** 2 / 10 — Info
- **Category:** State Machine / Operational ordering
- **Location:** `programs/tbill/src/lib.rs:162-166`, `:133-137`

Both the hook and EAML init declare `pause` as a typed `Account<Pause>`, so it must exist before any transfer; otherwise transfers revert. Fail-closed (safe), but an operational ordering footgun.

**Recommendation.** Document the deployment order (create pause → init EAML → mint/distribute).

---

## 3. Investigated but Not Confirmed

- **Reentrancy via transfer hook** — refuted (hook does no CPI/state mutation).
- **`pause` account spoofing** — by-design/safe (supplied via EAML, re-validated by seeds + discriminator).
- **Missing signer checks** — pass (`Signer` + `address = ADMIN_PUBKEY` on both privileged instructions).
- **Arbitrary/unchecked CPI** — pass (only `create_account` to typed `Program<System>` with correct seeds).
- **PDA seed collision** — pass (distinct `[b"pause"]` and `[b"extra-account-metas", mint]`).
- **EAML reinitialization** — pass (raw `create_account` fails if exists; admin-gated).
- **Arithmetic / NAV / mint authority / first-depositor / oracle** — N/A (no such logic on-chain; off-chain scope).
- **Freeze-authority griefing** — by-design (intended compliance mechanism; folded into OE-01).
- **`declare_id!` mismatch** — pass. **Supply-chain pinning** — pass (program scope).
