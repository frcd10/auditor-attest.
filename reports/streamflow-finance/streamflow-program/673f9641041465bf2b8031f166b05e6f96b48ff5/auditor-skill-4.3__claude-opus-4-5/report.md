# Streamflow Program — Security Audit Report

| Field | Value |
|---|---|
| **Repository** | Streamflow / streamflow-program (native Rust Solana program) |
| **Scope** | `./src/` (on-chain program: `lib.rs`, `sol_initialize.rs`, `sol_withdraw.rs`, `sol_cancel.rs`, `utils.rs`, `tok_initialize.rs`) |
| **Audit type** | AI-assisted first-pass |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |
| **Program model** | Native (non-Anchor) Solana program; single entrypoint dispatched on `instruction_data[0]` |
| **NOTE** | This repo is the archived/deprecated 2021 prototype, not the current production Streamflow program. Findings apply to this legacy source. |

---

## 1. Executive Summary

### Repository Risk Score: 10 / 10 (Critical — do not deploy)

**Plain-language verdict:** This is an early-stage (2021) native Solana token-streaming/vesting program. It implements native-SOL stream initialize/withdraw/cancel plus a partial SPL-token initialize. The code is built almost entirely on raw `AccountInfo` handling with **no PDA derivation/verification, no binding between the stream metadata account and the program, and broken withdrawal accounting**. Multiple confirmed CRITICAL issues allow direct theft of escrowed funds and permanent loss of recipient funds. **This program must not be deployed.** Even setting aside the most severe arithmetic bug, the absence of any cryptographic binding of the escrow ("pda") account to a program-derived address means the trust model required for a streaming escrow is not enforced.

The single most damaging concrete bug: in `sol_withdraw`, the program **debits the user-controlled `requested` amount from escrow but always adds `available` to `withdrawn`** (line 98 vs line 102). Combined with the unchecked-subtraction underflow and the panicking arithmetic, this constitutes a permissionless fund-loss / fund-corruption class of bug.

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 2 |
| High (7-8) | 3 |
| Medium (4-6) | 3 |
| Low (1-3) | 2 |
| **Total** | **10** |

---

## 2. Confirmed Findings

### SF-01 — Withdraw accounting mismatch: `withdrawn` advances by `available`, not by `requested`
- **Severity:** 10/10 — Critical
- **Category:** Economic logic / state corruption / fund loss
- **Location:** `src/sol_withdraw.rs:98–104`

The withdraw handler computes `available = amount_unlocked - sf.withdrawn`, lets the caller specify `requested` (defaulting to `available` when `0`), validates `requested <= available`, then transfers `requested` lamports out of escrow but increments `sf.withdrawn += available` (line 102) instead of `requested`. The amount moved is `requested`, but bookkeeping advances by `available`.

**Impact.** (1) Under-withdraw (`requested = 1`) advances `withdrawn` by the full unlocked amount, permanently stranding the difference — unconditional loss of recipient funds. (2) Accounting desync breaks the invariant `escrow_lamports == amount + rent − withdrawn`; combined with SF-02 and SF-03 this is the root condition for draining principal. Permissionless, no precondition.

**Recommendation.** Increment by the transferred amount: `sf.withdrawn += requested;`. Re-derive `available` from a single source of truth.

### SF-02 — Unchecked subtraction underflow in unlock/`available` math (panic & logic abuse)
- **Severity:** 9/10 — Critical
- **Category:** Arithmetic safety / integer underflow
- **Location:** `src/sol_withdraw.rs:71,75`; `src/sol_cancel.rs:63`; `src/utils.rs:96`

All stream math uses raw `-` on `u64` with no `checked_sub`. `now - start` is unguarded at withdraw/cancel time; `available = amount_unlocked - sf.withdrawn` can underflow once `withdrawn` is corrupted (SF-01) or because init pre-sets `withdrawn = 2 * lamports_per_signature` while `amount_unlocked ≈ 0` near `start_time`.

**Impact.** Panic/DoS for withdraw/cancel before `start_time`; or `available` underflows to ~`u64::MAX`, so the `requested > available` check passes for almost any `requested`, letting the recipient drain the entire escrow lamport balance in one call.

**Recommendation.** Use `checked_sub` everywhere; clamp `now` into `[start, end]`; enforce `amount_unlocked >= withdrawn`; don't seed `withdrawn` with the fee pre-payment.

### SF-03 — No PDA derivation/verification: escrow account not bound to the program
- **Severity:** 8/10 — High
- **Category:** Account validation / PDA & CPI
- **Location:** `src/sol_initialize.rs:37,46–57,77–86`; `src/sol_withdraw.rs:37,55`; `src/sol_cancel.rs:35,41`

The "pda" is never derived via `find_program_address`/`create_program_address` and no seeds are checked. At init it's only required to be a writable signer and empty; on withdraw/cancel only `pda.owner == pid` + non-empty data is checked. No canonical stream↔escrow relationship, no uniqueness guarantee, and the escrow is a caller-supplied keypair signer, not a true PDA.

**Recommendation.** Derive the escrow as a real PDA from deterministic seeds and verify on every instruction; use `invoke_signed`; remove the signer requirement on the escrow.

### SF-04 — Forgeable stream metadata enables theft (no discriminator / integrity check)
- **Severity:** 8/10 — High
- **Category:** Account validation / type-cosplay / state machine
- **Location:** `src/utils.rs:27–46,78–89`; `src/sol_withdraw.rs:55–65`; `src/sol_cancel.rs:41–56`

`StreamFlow` is `#[repr(C)]` serialized by raw memory copy with no discriminator/version/initialized flag. Withdraw/cancel trust any program-owned, non-empty account's bytes for `sender`/`recipient`/`amount`/`withdrawn`, with no check that it was created by this program with sane invariants or that `amount + rent == pda.lamports()`.

**Recommendation.** Add an 8-byte discriminator + version written at init and verified on load; enforce invariants (`withdrawn <= amount`, lamports reconcile); reject accounts whose data length ≠ `size_of::<StreamFlow>()`.

### SF-05 — Init pre-credits recipient and seeds `withdrawn` with fees
- **Severity:** 7/10 — High
- **Category:** Economic logic / arithmetic
- **Location:** `src/sol_initialize.rs:90–93`

Init transfers `2 * lamports_per_signature` from escrow to Bob and sets `sf.withdrawn += 2 * lamports_per_signature`, under-funding the escrow relative to `amount` and pre-setting `withdrawn` nonzero before `start_time` (feeds SF-02 underflow; can leave the final withdraw short).

**Recommendation.** Fund the bootstrap fee from the sender directly, not from escrow; don't mutate `withdrawn` for fees.

### SF-06 — Lossy `f64` unlock math: precision loss / non-determinism risk
- **Severity:** 6/10 — Medium
- **Category:** Arithmetic / rounding
- **Location:** `src/utils.rs:92–97`

`calculate_streamed` uses `f64` division/multiplication then casts to `u64`. For large `amount` (> 2^53) the result is rounded; floats on-chain are discouraged (toolchain-dependent).

**Recommendation.** Integer math: `amount * (now - start) / (end - start)` with `checked_mul`/`u128` intermediates.

### SF-07 — Missing rent-exemption / leftover-lamport handling
- **Severity:** 6/10 — Medium
- **Category:** State machine / account close
- **Location:** `src/sol_withdraw.rs:117–124` (commented-out rent collection); `src/sol_initialize.rs:62–64`

Rent-reclamation that would zero the escrow on completion is commented out; only cancel empties it. Completed streams strand rent in a never-closed program-owned account; the hardcoded `rent_reaper` is required on every withdraw for no benefit; donations to the account are unaccounted (no reconciliation).

**Recommendation.** Close the account on completion (transfer remaining lamports, zero data); remove the unused `rent_reaper` gating from the hot path.

### SF-08 — `instruction_data[0]` indexed without length check (panic DoS)
- **Severity:** 5/10 — Medium
- **Category:** Input validation / DoS
- **Location:** `src/lib.rs:47`

Dispatcher reads `instruction_data[0]` before checking the slice is non-empty → index-out-of-bounds panic on empty data.

**Recommendation.** `match instruction_data.first() { Some(0) => ..., None => Err(InvalidInstructionData), ... }`.

### SF-09 — `unpack_account_data` assumes sufficient data length (panic on short accounts)
- **Severity:** 4/10 — Low
- **Category:** Input validation / memory safety
- **Location:** `src/utils.rs:78–89`; `src/sol_withdraw.rs:59–60,104`; `src/sol_cancel.rs:45–46`

Fixed-range slicing without checking `data.len() >= 128`; a program-owned account with 1–127 bytes passes the emptiness check then panics on slicing.

**Recommendation.** Verify `data.len() == size_of::<StreamFlow>()` before unpacking; prefer a checked deserializer (borsh).

### SF-10 — `unsafe` raw struct (de)serialization
- **Severity:** 3/10 — Low
- **Category:** Memory safety / code quality
- **Location:** `src/utils.rs:48–54,96–98`

Serialization copies raw struct memory via `unsafe any_as_u8_slice`, coupling on-chain layout to compiler/ABI details and bypassing schema validation (amplifies SF-04/SF-09).

**Recommendation.** Use `borsh` or `bytemuck` (`Pod`/`Zeroable`).

---

## 3. Investigated but Not Confirmed

- **Signer & owner checks on hot paths** — adequate (recipient/sender authorization logic is correct; the problems are accounting/escrow-binding, not who may call).
- **Classic CPI re-entrancy** — refuted (no synchronous re-entrancy; the realistic vector is SF-01/SF-02).
- **`tok_initialize` (instruction 3)** — out of primary scope / incomplete; token withdraw/cancel (4/5) are commented out in `lib.rs:54–55`, so the token feature is non-functional. Flagged for manual follow-up.
- **Hardcoded `rent_reaper`** — folded into SF-07.
- **`duration_sanity`** — partially effective (guards init `end - start`, not `now - start` at withdraw/cancel).
- **`ix.len()` checks at init/withdraw** — present and correct; the gap is in the dispatcher (SF-08) and account-data length (SF-09).
