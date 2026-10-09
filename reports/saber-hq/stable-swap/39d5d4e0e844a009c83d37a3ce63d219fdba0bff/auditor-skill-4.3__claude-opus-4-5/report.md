# Security Audit Report — Saber StableSwap (on-chain program)

| Field | Value |
|---|---|
| **Repository** | Saber `stable-swap` |
| **Scope** | `stable-swap-program/program` (on-chain Rust program, `declare_id!("SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ")`) — with supporting crates `stable-swap-math` and `stable-swap-client` (state/instruction/fees) as needed for context |
| **Audit type** | AI-assisted first-pass (PROGRAM scope: checklists 01-07, 16) |
| **Commit** | `39d5d4e` (branch `master`) |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |

---

## 1. Executive Summary

**Repository Risk Score: 3 / 10 — LOW**

Saber StableSwap is a mature, native (non-Anchor) two-token stable-pair AMM implementing the Curve StableSwap invariant. The on-chain program is small, disciplined, and defensively coded: `#![deny(clippy::integer_arithmetic)]` and `#![deny(clippy::unwrap_used)]` are enforced crate-wide, every financial operation uses `checked_*` arithmetic with `u128`/`U192` intermediates, slippage floors (`minimum_amount_out`, `min_mint_amount`, `minimum_token_*_amount`) are enforced on every value-moving path, and the curve math is backed by an extensive proptest suite plus a reference Python model. The pool authority is a program-derived address keyed to the swap account, and token transfers out of reserves are signed with `invoke_signed` against that PDA, which structurally prevents cross-pool reserve theft.

No critical or high-severity issues were found. The program carries the usual **trusted-admin** assumptions of the Curve/Saber design: a single `admin_key` (no on-chain multisig or timelock in the program) can ramp the amplification factor within bounded rate limits, pause swaps/deposits, redirect the admin-fee destination, transfer admin rights (3-day delay), and — most notably — set new fee parameters with **no upper bound and no timelock**. The highest-impact confirmed findings are (a) unbounded/untimelocked fee updates that let the admin retroactively seize most of swap output as fees or brick the pool via fee underflow, and (b) the absence of an explicit program-ownership check on the `SwapInfo` account (mitigated to defense-in-depth because the signing PDA is bound to the swap account key). Both are admin/operational-trust concerns rather than permissionless exploits.

The code is broadly safe to deploy under the assumption that the admin key is a well-secured multisig/timelock operated off-chain. The recommendations below would harden the trust model.

### Severity Distribution

| Score | Label | Count |
|-------|-------|-------|
| 10 | CRITICAL | 0 |
| 9 | CRITICAL | 0 |
| 8 | HIGH | 0 |
| 7 | HIGH | 0 |
| 6 | MEDIUM | 0 |
| 5 | MEDIUM | 0 |
| 4 | LOW | 1 |
| 3 | LOW | 2 |
| 2 | INFO | 1 |
| 1 | INFO | 0 |
| **Total Findings** | | **4** |

### What We Found

Four findings, all LOW/INFO. The most material is unbounded admin fee setting (SB-01). No permissionless fund-loss path was identified; reserve-draining attacks are blocked by the PDA-signed transfer model and the missing owner check is structurally unexploitable.

---

## 2. Confirmed Findings

### SB-01 — Admin can set unbounded fees with no cap and no timelock

| Field | Value |
|---|---|
| **Severity** | 4 / 10 — LOW (economic; gated behind trusted admin) |
| **Category** | Access Control / Economic Logic |
| **Checklist** | AC-023, AC-024, ECON-026, ECON-027, ECON-028, AR-039 |
| **Location** | `stable-swap-program/program/src/processor/admin.rs:256-261` (`set_new_fees`); fee math in `stable-swap-math/src/math.rs:52-105` |

**Description:**
`set_new_fees` overwrites `token_swap.fees` with caller-supplied numerators/denominators with **no validation whatsoever** — no `numerator <= denominator` check, no maximum-fee cap, and no timelock or delay:

```rust
fn set_new_fees(token_swap: &mut SwapInfo, new_fees: &Fees) -> ProgramResult {
    msg!("Admin: Old fees {:?}", token_swap.fees);
    token_swap.fees = *new_fees;   // no bounds check, no cap, no timelock
    msg!("Admin: New fees {:?}", token_swap.fees);
    Ok(())
}
```

Fees are applied via `mul_div_imbalanced(amount, numerator, denominator)` (math.rs:27). Because the numerator is unbounded, the admin can set `trade_fee_numerator/denominator` to e.g. `1/1` (100%) — or larger — at any instant, with no on-chain notice period for LPs/traders to exit.

**Impact:**
- The admin can retroactively raise the trade fee toward ~100% so almost the entire `dy` of any swap is taken as fee (and routed to the admin-controlled `admin_fees` account via `admin_trade_fee`), effectively siphoning swap output from traders. Withdraw fees can likewise be set arbitrarily high to confiscate value on `withdraw`/`withdraw_one`.
- A numerator greater than the denominator makes `dy_fee > dy`, so `amount_swapped = dy.checked_sub(dy_fee)?` (curve.rs:385) returns `None` -> `CalculationFailure`, bricking the swap path (griefing/DoS) until fees are fixed.
- There is no timelock, so LPs cannot reliably withdraw before a hostile fee change takes effect.

This is gated behind the trusted `admin_key` (a correct signer is required), which is why it is rated LOW rather than a permissionless drain. It nonetheless materially widens the admin power beyond what an LP would reasonably expect.

**Recommendation:**
- Validate every fee on `set_new_fees` (and ideally on `Initialize`): require `numerator <= denominator` and enforce a hard maximum (e.g. trade fee <= a few percent), rejecting with `SwapError::InvalidInput` otherwise.
- Add a timelock/announcement window for fee increases (mirroring the 3-day `ADMIN_TRANSFER_DELAY` already used for admin transfer), and/or document that the admin key must be a timelocked multisig.

---

### SB-02 — `SwapInfo` account program-ownership is never verified

| Field | Value |
|---|---|
| **Severity** | 3 / 10 — LOW (defense-in-depth; not exploitable as written) |
| **Category** | Account Validation |
| **Checklist** | AV-001, AV-005, OPS-014 |
| **Location** | `stable-swap-program/program/src/processor/swap.rs:123,309,442,591,708` and `admin.rs:33` (every `SwapInfo::unpack(&swap_info.data.borrow())`) |

**Description:**
This is a native program, so account ownership is not checked automatically (no Anchor `Account<'info, T>`). Every handler deserializes the swap state with `SwapInfo::unpack(&swap_info.data.borrow())` (or `unpack_unchecked` on init) but **never checks `swap_info.owner == program_id`**. `unpack` only verifies the `is_initialized` byte; it reads `nonce`, `token_a/b.reserves`, `admin_fees`, `pool_mint`, `admin_key`, and `fees` straight from caller-supplied bytes.

**Impact (why this is LOW, not high):**
An attacker can supply a fake `swap_info` account they fully control (owned by a different program) with arbitrary `reserves`/`admin_key`/`nonce`. However, all value-moving CPIs that drain reserves use `transfer_as_swap` / `mint_to`, which sign with `invoke_signed` using seeds `[swap_info.key, nonce]` (token.rs:36-37,61-62). The real reserves and pool mint are owned by `PDA(real_swap_info.key, real_nonce)`. To move a victim pool tokens, the attacker would need `create_program_address([fake_key, nonce]) == victim_authority`, which is preimage-infeasible. With a fake swap account the attacker can only manipulate their own throwaway pool. Admin instructions similarly only mutate the same (fake) account they pass in. No path was found by which a forged `SwapInfo` affects a legitimate pool funds.

It remains a genuine defense-in-depth gap: the program should not rely solely on the PDA-binding invariant, and an owner check is cheap insurance against future refactors that weaken that invariant.

**Recommendation:**
At the top of `process_swap_instruction` and `process_admin_instruction`, assert `swap_info.owner == program_id` (return `SwapError::InvalidProgramAddress` / `ProgramError::IncorrectProgramId` otherwise) before unpacking.

---

### SB-03 — `set_fee_account` does not verify the new fee account owner/authority

| Field | Value |
|---|---|
| **Severity** | 3 / 10 — LOW (admin-gated) |
| **Category** | Access Control / Token Account Validation |
| **Checklist** | AC-025, AC-026, AV-046 |
| **Location** | `stable-swap-program/program/src/processor/admin.rs:179-210` (`set_fee_account`) |

**Description:**
`set_fee_account` validates only that the new fee account **mint** matches token A or token B; it does not validate the token account `owner`/authority, nor require it to be owned by the pool authority PDA. The admin may therefore set `admin_fees` to any token account of the correct mint, including one whose authority is an arbitrary third party.

**Impact:**
Consistent with the design (admin fees are intended to be the admin own account), so it is not a vulnerability against users — admin fees are a portion the protocol/admin is entitled to. The risk is operational: a careless or compromised admin can misroute fees to an unintended/unrecoverable account. Because it is fully admin-gated and only affects the admin own fee share, severity is LOW. The fee destination is a mutable field rather than immutable (AC-026 intentionally not met by this design).

**Recommendation:**
Optionally constrain the fee destination (e.g., require ownership by the pool authority PDA or the `admin_key`), or document that fee-destination selection is an admin responsibility with no on-chain safety net.

---

### SB-04 — User-authority signer is enforced implicitly by SPL Token, not by the program

| Field | Value |
|---|---|
| **Severity** | 2 / 10 — INFO (no exploit; clarity/defense-in-depth) |
| **Category** | Access Control / Signer Verification |
| **Checklist** | AC-001, AC-004, AC-005 |
| **Location** | `stable-swap-program/program/src/processor/token.rs:8-24,81-97` (`burn`, `transfer_as_user`); call sites in `swap.rs` |

**Description:**
The program never explicitly checks `user_authority_info.is_signer`. For user-side movements (`transfer_as_user` on deposit/swap input, `burn` of LP on withdraw), the program issues a plain `invoke` of the SPL Token instruction with the user authority as the token authority. The signer requirement is therefore enforced by the SPL Token program (which requires the source/owner to have signed), not by this program directly.

**Impact:**
No exploit: SPL Token rejects the CPI if the user authority did not sign, so funds cannot be moved from a non-signing user. Purely a robustness/readability observation — explicit signer checks make the security argument local and resilient to future changes (e.g., a delegate-based path). Pool-side transfers correctly use `invoke_signed` with the PDA, and the admin path does explicitly check `is_signer` (checks.rs:39-41).

**Recommendation:**
Optionally add `if !user_authority_info.is_signer { return Err(MissingRequiredSignature) }` before user-authority CPIs for explicitness.

---

## 3. Investigated but NOT Confirmed (refuted / by-design / low-confidence)

- **StableSwap invariant & rounding (AR-021..AR-024)** — *Refuted.* `swap_to` and `compute_withdraw_one` deliberately subtract 1 (`...checked_sub(1)?`, curve.rs:381,362) so rounding favors the pool, not the user. Withdraw rates (`pool_converter.rs`) compute `pool_tokens * reserve / supply` in `u128` then downcast. Proptests assert virtual price never decreases on deposit/swap/withdraw/withdraw_one (curve.rs:1072-1213).

- **First-depositor / vault-donation share inflation (ECON-013..017, KV-006, KV-017)** — *Refuted / by-design.* Initial LP supply is minted as `compute_d(token_a.amount, token_b.amount)` (swap.rs:231-234), proportional to the invariant of the seeded reserves, and `Initialize` rejects empty reserves (`EmptySupply` if either side is 0, swap.rs:161-166). LP value is always derived from `D` against live reserves, so a later token donation raises `D` for all LPs proportionally and cannot round a new depositor mint to zero in a way that profits the attacker. No 1:1 zero-supply bootstrap exists to manipulate.

- **Integer overflow / underflow (AR-001..AR-009, KV-011)** — *Refuted.* `#![deny(clippy::integer_arithmetic)]` is set on program and math crates; all non-test arithmetic uses `checked_*` / `U192` / `U256`. `unpack`/`pack` use fixed-size `array_refs!`.

- **Amp-factor ramp manipulation** — *By-design with guardrails.* `ramp_a` enforces `MIN_RAMP_DURATION` (1 day) since last ramp (`RampLocked`), a minimum future stop time, and a max factor-of-10 change per ramp (`MAX_A_CHANGE`, admin.rs:99-126). Admin-gated; matches Curve.

- **Missing pause on proportional `withdraw` (AC-032..034)** — *By-design.* `process_withdraw` intentionally omits the `is_paused` check that `swap`/`deposit`/`withdraw_one` have, giving an emergency balanced exit while paused. The `Pause` instruction doc explicitly scopes pause to "swap, deposit, and withdraw_one" (instruction.rs:105).

- **Reserve/admin-fee account substitution (AV-045..047, CPI-011..017)** — *Refuted.* Reserves are pinned to `token_swap.token_a/b.reserves` via `check_*_token_accounts` / `check_swap_token_destination_accounts`, admin-fee destinations to `token.admin_fees`, pool mint to `token_swap.pool_mint`, and the swap authority is re-derived and compared (`check_swap_authority`). Source accounts are forbidden from equaling reserves; swap source/destination reserves forbidden from being equal.

- **CPI target validation (CPI-003, CPI-008, KV-009)** — *Pass.* `spl_token::instruction::{transfer,mint_to,burn}` builders validate the supplied `token_program.key`; a wrong token-program key yields `IncorrectProgramId` (covered by `test_token_program_id_error` and the deposit "wrong token program id" test).

- **Admin transfer / re-init (SM-027, AV-053, KV-014)** — *Pass.* `Initialize` rejects an already-initialized swap (`AlreadyInUse`, swap.rs:124). Admin transfer is two-step with a 3-day deadline window (`commit_new_admin`/`apply_new_admin`, admin.rs:213-253).

- **Reentrancy / checks-effects-interactions (RE-001..005, KV-003)** — *Pass.* Admin-op state is packed after computation; swap/deposit/withdraw read reserve balances fresh each call and rely on SPL Token CPIs with no callback surface into this program. No flash-loan NAV path (LP value is invariant-derived from live reserves).

- **`unsafe` / raw pointers / backdoors (OPS-013..024)** — *Pass.* No `unsafe`, no raw-pointer manipulation, no hardcoded pubkey backdoors. `declare_id!` present. Dispatch routes tags 100-107 to admin, all others to the swap router (instruction.rs:144-169) — no hidden instruction.

- **`unwrap()` in production paths (Checklist 16)** — *Pass.* `clippy::unwrap_used` is denied outside `#[cfg(test)]`; all `unwrap`/`integer_arithmetic` usages are inside test modules.

- **Upgrade authority / multisig / monitoring (OPS-001..012, 037..052)** — *N/A to source.* Deployment/operational properties not determinable from the repository. The program is upgradeable by definition; secure-multisig + timelock on the upgrade authority and `admin_key` are required operationally and should be confirmed out-of-band (`solana program show`).

---

*Methodology: AUDITOR corpus (OUTPUT-RULES, FULL-AUDIT, checklists 01-07/16, known-vectors index) loaded and applied. Program is native Solana (no Anchor); Anchor-specific checklist items were mapped to equivalent native validation patterns (manual owner/discriminator/PDA checks). Findings are grounded in the cited source lines. This is an AI-assisted first-pass review and does not replace a full manual audit or formal verification; an existing professional audit (audit/bramah-systems.pdf) is present in the repo and was not re-derived here.*
