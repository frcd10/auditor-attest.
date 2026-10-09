# Security Audit Report — PrivacyCash (zkcash program)

| | |
|---|---|
| **Repository** | PrivacyCash / privacy-cash |
| **Scope** | `anchor/programs/zkcash` (on-chain Solana/Anchor program) |
| **Primary program** | `zkcash` — declare_id `9fhQBbumKEFuXtMBDw8AaQyAjCorLGJQiS3skWZdQyQD` (mainnet) / `ATZj4jZ4FFzkvAcvk27DW9GRkgSbFnHo49fKKPQXU7VS` (dev/local) |
| **Audit type** | AI-assisted first-pass (program-scope), code-grounded |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |
| **Files reviewed** | `lib.rs`, `utils.rs`, `groth16.rs`, `merkle_tree.rs`, `errors.rs` |

---

## 1. Executive Summary

PrivacyCash is a Tornado-style ZK shielded pool implementing a UTXO/nullifier model over a height-26 Poseidon sparse Merkle tree, with Groth16 proof verification on BN254 (via Light Protocol's `groth16-solana`). It supports native SOL (`transact`) and SPL tokens (`transact_spl`), plus admin-only init/config instructions.

The core security-critical machinery is implemented correctly and defensively: (a) **nullifier double-spend protection** is sound — nullifier PDAs use `init` (not `init_if_needed`), so a replayed nullifier fails account creation; (b) the `nullifier2`/`nullifier3` `SystemAccount` cross-checks block the "same nullifier for both inputs" attack; (c) **proof public inputs are fully bound** — root, public_amount, ext_data_hash, both input nullifiers and both output commitments — and `ext_data_hash` binds recipient, amount, fee, fee_recipient, mint; (d) the verifier enforces the field-size check on public inputs; (e) value conservation is enforced by `check_public_amount`; (f) lamport/withdrawal arithmetic is checked; reentrancy is prevented by Anchor's pre-CPI nullifier creation.

No critical or high-severity fund-loss vector was confirmed. The remaining findings are a non-enforced fee recipient / fee-rate economic gap (a withdrawer can route the "fee" to themselves, undermining the relayer/fee model but not pool solvency) and minor hardening gaps.

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

### PC-01 — Protocol fee recipient and fee rate are not enforced; withdrawer controls fee routing
- **Severity:** 5 / 10 — Medium
- **Category:** Economic / Access Control (fee model)
- **Location:** `lib.rs:320-344` (SOL), `:480-498` (SPL); `utils.rs:148-212` (`validate_fee`); `lib.rs:568-588`

`fee_recipient_account` (SOL) / `fee_recipient_ata` (SPL) are `UncheckedAccount`s supplied by the caller; their keys are bound into `ext_data_hash` but nothing constrains them to a protocol-owned address. `validate_fee` only checks `fee >= min_acceptable_fee`, never the recipient. `GlobalConfig` has no `fee_recipient` field and the declared `InvalidFeeRecipient` error is never used. A withdrawer can set `fee_recipient = their own account` and reclaim the fee.

**Impact.** Protocol/relayer fee is effectively optional/self-routable. Not a solvency issue (value conservation holds via `public_amount`); impact is lost fee revenue / broken relayer incentive.

**Recommendation.** Add `fee_recipient` to `GlobalConfig` and enforce `require_keys_eq!(fee_recipient_account.key(), global_config.fee_recipient, InvalidFeeRecipient)`, or document self-routing and remove the dead error path.

### PC-02 — `tree_ata` uses `init_if_needed` with `payer = signer` (rent-griefing on first SPL deposit)
- **Severity:** 4 / 10 — Low
- **Category:** Account init / DoS
- **Location:** `lib.rs:746-752`

The tree ATA is `init_if_needed, payer = signer`. Functionally safe (deterministic, `global_config`-owned authority, mint gated by `ALLOWED_TOKENS`), but `init_if_needed` on a hot path shifts rent onto whoever first touches a mint and widens the surface.

**Recommendation.** Create the tree ATA in the admin-only init instruction rather than lazily during `transact_spl`.

### PC-03 — Single-key admin; config updates have no events and limited bounds
- **Severity:** 3 / 10 — Low
- **Category:** Governance / Observability
- **Location:** `lib.rs:107-146`, `:26-32`

Admin is a single hardcoded `ADMIN_PUBKEY` per profile; config changes emit only `msg!` (no `emit!`); `update_deposit_limit` allows any `u64` (incl. 0). No timelock.

**Recommendation.** Emit structured events; consider multisig/timelock; enforce a sane lower bound on `max_deposit_amount`.

### PC-04 — `ext_data_hash` comparison mixes LE/BE reductions (hardening/clarity)
- **Severity:** 2 / 10 — Info
- **Category:** Cryptographic binding / code clarity
- **Location:** `lib.rs:239-242`/`:411-414`; `utils.rs:276-311`

`Fr::from_le_bytes_mod_order(calculated)` is compared to `Fr::from_be_bytes_mod_order(proof.ext_data_hash)`. Sound only if the off-chain circuit uses matching endianness; fragile under client refactors (fails closed, not open).

**Recommendation.** Document the endianness contract; add a known-vector unit test.

---

## 3. Investigated but Not Confirmed

- **Nullifier replay / double-spend** — refuted (`init` not `init_if_needed`; replay fails account creation).
- **Same nullifier for both inputs** — refuted (`nullifier2`/`nullifier3` SystemAccount PDA-collision guard).
- **Proof public-input binding** — refuted (all 7 inputs bound; `check_public_amount` re-derives).
- **Merkle root authenticity** — refuted (`is_known_root` rejects zero root, only accepts program-written history).
- **Field-size / proof malleability** — refuted (`verify()` CHECK=true; G1 validated).
- **Value conservation / pool drain** — refuted (`public_amount` binds debit; checked math; rent-exempt floor).
- **Reentrancy via CPI** — refuted (nullifiers created before handler logic; no callback into program).
- **Arithmetic overflow/underflow** — refuted (`checked_*`, `u128` intermediates; `i64::MIN` rejected).
- **PDA / account substitution** — refuted (seed+bump constraints; token mint/authority constraints).
- **Admin can drain pool** — refuted (admin gates init/limit/config only; no fund-moving admin path).
- **Merkle tree full** — by-design (height-26; `MerkleTreeFull` on exhaustion).
- **First-depositor** — N/A (mixer, not share vault).
