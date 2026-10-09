# Security Audit Report — Orderly Solana Vault (LayerZero OApp)

| Field | Value |
|---|---|
| **Repository** | Orderly/solana-vault |
| **Scope** | `packages/solana/contracts/programs/solana-vault` (PRIMARY PROGRAM) |
| **Program ID** | `ErBmAD61mGFKvrFNaTJuxoPwqrS8GgtwtqJTJVjFWx9Q` (`declare_id!`, `lib.rs:12`) |
| **Audit type** | AI-assisted first-pass |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |

---

## 1. Executive Summary

This program is the Solana leg of Orderly's cross-chain vault/bridge. Users `deposit`/`deposit_sol` SPL tokens or native SOL into a vault custodied by the `vault_authority` PDA; a LayerZero V2 message is sent to the Orderly ledger chain. Withdrawals arrive back as authenticated LayerZero messages handled by `lz_receive`, which releases tokens/SOL to the message-specified receiver.

The core model is sound: cross-chain message **authentication** is enforced (the `peer` PDA constraint binds `(src_eid, sender)` to a configured trusted peer, `oapp_lz_receive.rs:21-30`), and **replay protection** is delegated to the LayerZero endpoint `clear` CPI (`:108-122`), the canonical V2 mechanism. Token custody uses PDA-derived ATAs with correct `associated_token::authority` constraints; admin instructions enforce `has_one = admin`; manager-gated instructions check `manager_role.allowed` (roles granted only by the vault owner). Value-path arithmetic uses underflow-guarded `token_amount - fee` after an explicit `>=` check.

No permissionless fund-drain found. The most significant issues: (1) a **per-peer rate limiter fully wired but never enforced** — the only defense-in-depth cap against a compromised/buggy upstream ledger is inert; (2) a **SOL-withdrawal failure path that permanently consumes the cross-chain message without delivering funds**, stranding user value. Both MEDIUM. Panic-on-malformed-input and ordering-guard gaps are LOW.

Verdict: **Not a clean "ship it," but no critical/high confirmed.** Address the rate-limiter and SOL-failure issues before production reliance.

### Repository Risk Score: 6 / 10 (Medium)

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 0 |
| High (7-8) | 0 |
| Medium (4-6) | 2 |
| Low (1-3) | 3 |
| **Total** | **5** |

---

## 2. Confirmed Findings

### OR-01 — Per-peer rate limiter is configured but never enforced (dead control)
- **Severity:** 6 / 10 — Medium
- **Category:** Economic logic / Defense-in-depth
- **Location:** `state/oapp_state/peer.rs:46` (`try_consume`), `instructions/oapp_instr/set_rate_limit.rs`, `oapp_lz_receive.rs` (consumer absent)

`Peer` carries an `Option<RateLimiter>` with a full token-bucket impl, and `set_rate_limit` configures it, but `try_consume` is **never called anywhere**. `lz_receive` releases tokens/SOL without decrementing the bucket.

**Impact.** No on-chain ceiling on how much value `lz_receive` can release per unit time; withdraw security reduces to trusting the upstream ledger + peer. Operators get a false belief a cap is in force.

**Recommendation.** Call `peer.rate_limiter.try_consume(amount)` in `OAppLzReceive::apply` before each release, mark `peer` mut, persist, and return `RateLimitExceeded` on overflow.

### OR-02 — SOL withdrawal failure consumes the LayerZero message; funds stranded
- **Severity:** 6 / 10 — Medium
- **Category:** State machine / Cross-chain accounting / Fund loss
- **Location:** `oapp_lz_receive.rs:108-192`

The endpoint `clear` CPI runs **first** (consuming the nonce/replay slot); only then does the SOL path attempt delivery. If the receiver wouldn't be rent-exempt (`state=1`) or is executable (`state=2`), the handler skips the transfer, emits `WithdrawSolFailed`, and returns `Ok(())`. The message can never be redelivered.

**Impact.** The ledger debited the user, but no SOL is delivered and the message is permanently retired — value stranded in `sol_vault` with no on-chain recovery path. Reachable whenever a receiver is below rent-exemption or is a program account.

**Recommendation.** Either revert (`Err`) on `state != 0` so the message isn't cleared (allowing redelivery), or credit the undelivered amount to a recoverable claim PDA.

### OR-03 — Panic on malformed inbound message (unchecked slicing / `.unwrap()`)
- **Severity:** 4 / 10 — Low
- **Category:** Input validation / Robustness
- **Location:** `instructions/msg_codec.rs:57-63,136-169`; `oapp_lz_receive.rs:126,129`; `oapp_lz_receive_types.rs:90,93`

`LzMessage::decode`/`AccountWithdrawSol::decode_packed` index fixed byte ranges and call `.try_into().unwrap()` with no length validation. A short message panics rather than returning `Err`. Limited impact (gated behind authenticated peer; panic only aborts the tx).

**Recommendation.** Replace unchecked slicing/`unwrap()` with length checks returning a typed error.

### OR-04 — `check_nonce` ordering guard is inert when `order_delivery == false` (default)
- **Severity:** 4 / 10 — Low
- **Category:** State machine / Message ordering
- **Location:** `state/vault_state/vault_authority.rs:16-23`; `oapp_lz_receive.rs:67-73,124`

`check_nonce` enforces strict `+1` sequencing only when `order_delivery` is true; otherwise returns `true` unconditionally. Replay is still prevented by `clear`; residual risk is purely out-of-order application of withdrawals.

**Recommendation.** Document that replay safety derives from `clear`, not `check_nonce`; enforce `order_delivery = true` at init if strict ordering is required.

### OR-05 — `withdraw_broker_pda` index→hash binding is operator-set and unverified
- **Severity:** 3 / 10 — Low
- **Category:** Access control / Data integrity (admin trust)
- **Location:** `instructions/vault_instr/set_withdraw_broker.rs:36-37`; `oapp_lz_receive.rs:38-43,140-141`

`WithdrawBroker` stores `broker_index` (seed) and `broker_hash` independently with no link; a misconfigured mapping mis-attributes withdrawals in emitted events. Manager-gated; no fund movement depends on `broker_hash`.

**Recommendation.** Validate the index↔hash mapping during `set_withdraw_broker`.

---

## 3. Investigated but Not Confirmed

- **Peer spoofing** — refuted (`peer` PDA bound to `[PEER_SEED, oapp_config, src_eid]`, `peer.address == sender`).
- **Cross-chain replay** — refuted (endpoint `clear` consumes the payload-hash slot).
- **Vault custody / token-account substitution** — refuted (`associated_token::mint`/`authority` constraints; PDA-signed transfers).
- **Withdrawal authorization** — by design (amount/receiver/token/broker from authenticated, replay-protected message; receiver re-derived ATA checked).
- **Admin authority / escalation** — refuted (`has_one = admin` on global config; manager roles granted only by vault owner).
- **Arithmetic over/underflow** — refuted (`require!(token_amount >= fee)`; checked RateLimiter math).
- **`init_if_needed` re-init** — refuted/low-confidence (deterministic PDA seeds; discriminator prevents type confusion).
- **First-depositor / NAV** — N/A (1:1 custody bridge, no share mint).
- **SOL-path placeholder mint** — low-confidence/non-issue (native transfer used; SPL branch not taken).
