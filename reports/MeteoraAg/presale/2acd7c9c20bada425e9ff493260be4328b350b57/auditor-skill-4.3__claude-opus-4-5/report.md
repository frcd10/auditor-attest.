# Security Audit Report — Meteora Presale Program

**Scope:** PROGRAM
**Program path:** `C:/Users/felip/auditor_validation/Meteora/presale/programs/presale`
**Audit type:** AI-assisted first-pass security review
**Date:** 2026-06-19
**Domain:** Token presale / fundraising (funds escrowed; claim / refund / vesting lifecycle)

---

## 1. Executive Summary

| Item | Value |
|---|---|
| Repository | Meteora Presale (`programs/presale`) |
| Scope | PROGRAM |
| **Repository Risk Score** | **Low** (highest *confirmed* severity = none / 0) |
| Confirmed findings | 0 |

### Verdict (plain language)

In this pass, **no findings were independently confirmed**. Every candidate surfaced during analysis was either refuted by an independent skeptic, reduced to a defensive/informational gap that requires the legitimate owner's own signature to "exploit," or judged low-confidence and left unverified. The program's core money-movement invariants that were examined — checked arithmetic throughout (SafeMath), proportional allocation that cannot be over-claimed, double-claim / double-withdraw / double-fee-collect guards, escrow PDA binding to `(presale, owner, registry_index)`, merkle-leaf binding to prevent proof reuse, `transfer_checked` enforcing mints, and mutual exclusion between `creator_withdraw` and `perform_unsold_base_token_action` — all held up under review.

The single most notable *unconfirmed* item worth a second human look is the **missing `has_one = owner` on `DepositCtx.escrow`** (`process_deposit.rs:19-23`), which the analysis flagged as a potential third-party "forced participation" griefing vector. It was not promoted to confirmed because the attacker must spend their own quote tokens (no protocol drain), but it remains the highest-value candidate to manually re-verify.

### Severity distribution — CONFIRMED findings only

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| **Total** | **0** |

---

## 2. Confirmed Findings

**None.**

No finding reached the bar of independent confirmation in this pass. See Section 3 for the full list of unconfirmed/informational candidates, which must NOT be treated as vulnerabilities without further manual verification.

---

## 3. Unconfirmed / Informational Candidates

These items were surfaced during analysis but were **refuted, reduced to owner-signed defensive gaps, or rated low-confidence**. They are recorded for completeness only. Do not treat any row below as a confirmed vulnerability, and do not inflate severity. Several are explicitly "the legitimate owner must sign, so no third party can steal" — i.e., not exploitable by an attacker.

| # | Candidate | Location | Raw sev | Confidence | Why not confirmed |
|---|---|---|---|---|---|
| 1 | Missing `has_one = owner` on `DepositCtx.escrow` — third-party deposit / forced participation griefing | `process_deposit.rs:19-23` | 5 | high | Attacker must spend their own quote tokens; no protocol/victim fund drain. Plausible griefing only; needs manual re-verification of cap/withdraw consequences. |
| 2 | Unconstrained destination `owner_base_token` in claim (no `token::authority = owner`) | `process_claim.rs:36-38` | 5 | high | Escrow owner must sign; cannot be exploited by a third party. Defensive gap only. |
| 3 | Unconstrained destination `owner_quote_token` in `withdraw_remaining_quote` | `process_withdraw_remaining_quote.rs:34-35` | 5 | high | Owner must sign; redirect is self-directed. Defensive gap only. |
| 4 | Unconstrained destination `owner_quote_token` in `withdraw` (presale phase) | `process_withdraw.rs:35-37` | 5 | high | Owner must sign; redirect is self-directed. Defensive gap only. |
| 5 | Prorata over-subscription refund rounding floors to 0 — dust locked in vault | `state/presale.rs:464-470` | 3 | medium | Sub-lamport dust, rounds in protocol's favor; not retrievable but not an attacker loss vector. |
| 6 | Vesting cumulative claimable recomputed from live registry `total_deposit` after Prorata withdrawals | `presale_mode_handler/mod.rs:129-153` | 4 | low | Over-release bounded by supply cap; requires pre-end Prorata withdrawals; not demonstrated. Low confidence. |
| 7 | `creator_withdraw` on failed presale transfers full `presale_supply` | `process_creator_withdraw.rs:147-163` | 6 | low | **Explicitly verified safe** — `perform_unsold_base_token_action` requires `Completed`; paths mutually exclusive. False positive. |
| 8 | Unauthorized third-party deposit (duplicate framing of #1) | `process_deposit.rs:19-23` | 5 | high | Same as #1; bounded by attacker spending own tokens. |
| 9 | `initialize_presale`: creator/owner is `UncheckedAccount`, need not sign | `initialize_presale/process_initialize_presale.rs:69-70` | 3 | high | Payer funds the vault from their own tokens; griefing requires self-sacrifice. Design-intent question, not a drain. |
| 10 | `creator_collect_fee`: `fee_receiving_account` lacks ownership constraint | `process_creator_collect_fee.rs:29-32` | 2 | high | Owner must sign; `transfer_checked` enforces mint. Self-directed only. |
| 11 | `perform_unsold_base_token_action` is permissionless | `process_perform_unsold_base_token_action.rs:42-47` | 2 | high | Destination constrained to creator ATA; action fixed at init. Only timing/front-run concern (premature burn). |
| 12 | `refresh_escrow` has no signer | `process_refresh_escrow.rs:5-13` | 1 | high | Deterministic, monotonic recompute; intended permissionless-refresher pattern. No fund loss. |
| 13 | Prorata withdraw does not decrement `total_deposit_fee` (escrow/registry) | `state/escrow.rs:70`, `state/presale_registry.rs:65` | 3 | high | Fee-refund distribution fairness question on overflow path; vault stays solvent. Needs manual confirmation of exact fee-share math. |
| 14 | Deposit fee retained by protocol on user withdraw | `state/escrow.rs:70`, `process_withdraw.rs:80-83` | 2 | medium | May be intentional withdrawal penalty; undocumented. Design question, not a bug. |
| 15 | Token-2022 transfer-fee on claim makes on-chain `total_claimed_token` overstate received amount | `process_claim.rs:78-90`, `token2022.rs:336-404` | 2 | medium | Vault stays solvent (debited exactly the tracked amount); accounting-log mismatch only, requires a fee-on-transfer base mint. |

---

## 4. Coverage & Methodology

### What was read

Multiple independent analysis passes covered the full `src/` tree of the program:

- **State:** `state/presale.rs`, `state/escrow.rs`, `state/presale_registry.rs`, `state/fixed_price_presale_params.rs`, `state/merkle_root_config.rs`, Operator/MerkleRootConfig/FixedPricePresaleExtraArgs structs.
- **Instructions:** `process_deposit.rs`, `process_withdraw.rs`, `process_withdraw_remaining_quote.rs`, `process_claim.rs`, `process_close_escrow.rs`, `process_creator_withdraw.rs`, `process_creator_collect_fee.rs`, `process_refresh_escrow.rs`, `process_perform_unsold_base_token_action.rs`, `create_escrow/*` (all four variants), `initialize_presale/params.rs` and `process_initialize_presale.rs`, `create_operator`, `revoke_operator`, `merkle_root_config`, `permissioned_server_metadata`.
- **Presale mode handlers:** `presale_mode_handler/{mod,fixed_price,prorata,fcfs}.rs` (all three modes).
- **Math & utilities:** `math/safe_math.rs`, `math/fee_math.rs`, `math/claim_math.rs`, `token2022.rs`, `constants.rs`, `const_pda.rs`, `errors.rs`, `lib.rs`.

### What was verified safe (during analysis)

- All arithmetic uses checked `SafeMath` operations; no unchecked overflow paths found; u128 intermediates in vesting math.
- Global cap enforcement correct for FCFS and FixedPrice (min of global and personal quota); Prorata over-subscription uses proportional refund math.
- Deposit-fee accounting consistent across the deposit / withdraw / collect-fee / failed-refund lifecycle.
- `creator_withdraw` amount correctly bounded by `presale_maximum_cap`; claim proportional allocation cannot be over-claimed.
- Escrow PDA seeds bind escrow to `(presale, owner, registry_index)`, preventing unauthorized escrow creation; merkle proof leaf includes `(owner, registry_index, deposit_cap)`, preventing proof reuse / second-preimage.
- Double-claim blocked (`pending_claim_token` zeroed atomically); claim-before-finalize blocked by `PresaleProgress::Completed`; refund-when-not-entitled blocked by `is_remaining_quote_withdrawn`; double-withdraw / double-fee-collect guarded by dedicated boolean flags set before transfer.
- `creator_withdraw` and `perform_unsold_base_token_action` are mutually exclusive via presale-progress check.
- `presale_authority` is a const PDA with correct signer seeds; all token transfers use `transfer_checked` enforcing mint; CEI ordering respected (state updates precede transfers); Token-2022 extension allowlist enforced at initialization; vault over-funds to account for transfer fee; `Burn` action correctly skips transfer fee.

### Important limitations

- **This is an AI-assisted FIRST-PASS review. It is NOT exhaustive** and does not replace a full manual audit or a formal-verification effort.
- **Zero confirmed findings does not mean zero bugs.** It means nothing cleared the confirmation bar in this pass. The unconfirmed candidates in Section 3 — particularly #1/#8 (missing `has_one = owner` on deposit), #6 (vesting share recompute), and #13 (Prorata fee decrement) — warrant manual re-verification.
- **Out of scope / not verified:** deploy-time configuration, upgrade-authority and key-management practices, on-chain operational procedures, off-chain whitelist/merkle-root generation, client/SDK behavior, economic/game-theoretic parameter choices, and integration with external programs.

---

## 5. Disclaimer

This report was produced by an automated, AI-assisted analysis process and is provided "as is," without warranty of any kind. It reflects a single first-pass review of the source code at the path stated above and may contain false negatives (missed issues) and false positives. It is not a guarantee of security, correctness, or fitness for any purpose, and it is not professional security-audit certification.

**Every item in this report — including the "verified safe" notes and especially the unconfirmed candidates in Section 3 — must be independently re-verified by a qualified human reviewer before any reliance, deployment decision, or bug-bounty submission.** Submitting any candidate from this report to a bug-bounty program without independent reproduction and confirmation is strongly discouraged.
