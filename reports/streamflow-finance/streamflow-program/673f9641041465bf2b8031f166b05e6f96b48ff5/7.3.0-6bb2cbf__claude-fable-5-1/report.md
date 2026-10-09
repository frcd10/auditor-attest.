# 🔒 Security Audit Report — StreamFlow `streamflow-program`

## 1. Executive Summary

**Repository:** StreamFlow-Finance/streamflow-program (local clone; `Cargo.toml:7`)  
**Commit:** `673f9641041465bf2b8031f166b05e6f96b48ff5` (short `673f964`)  
**Branch:** detached `HEAD` (default branch `master`)  
**Date:** 2026-09-10  
**Auditor:** auditor-skill 7.3.0@6bb2cbf, unattended Mode 1 (single linear agent, static analysis only)  
**Scope:** PROGRAM (`--scope program` → checklists 01–07 + 16; on-chain known-vector groups)  
**Program ID:** devnet `2DvvSEde36Ch3B52g9hKWDYbfmJimLpJwVBV9Cknypi4` (`README.md:22`); mainnet not deployed per `README.md:20`; no `declare_id!` in source  
**Languages Detected:** Rust (program, tests, example client); JavaScript, Python, shell, YAML (dev/CI scripts — out of program scope)  
**Repository Risk Score:** **10 — 🔴 CRITICAL (do not deploy)** — driven by one severity-9 finding (Rule 1: any finding ≥ 9 ⇒ score 10)

### What We Found

The audit covered the entire native Solana program (6 Rust files, 752 lines): a SOL/SPL token streaming escrow with four instructions (initialize, withdraw, cancel, token-initialize). The core access-control design is sound — every instruction requires a signer bound to the stored sender/recipient key, CPI targets are fixed to the System and SPL Token programs, and there is no admin role. The arithmetic and lifecycle logic is not: the vesting formula performs unchecked `u64` subtraction and floating-point math with no guard for "stream not yet started", so **a stream recipient can withdraw the entire locked balance before a single lamport has vested (F-001, severity 9)** on the default release build, which has no overflow checks. The half-finished SPL-token path (instruction 3) escrows tokens under an authority the program can never sign for, so **every token ever streamed through it is permanently locked (F-002, severity 7)**, and the program-ID keypair used by the deploy script is committed to the repository (F-003, severity 6). Further medium/low issues include a withdrawal-accounting bug that forfeits funds on partial withdrawals, a cancel path that always fails before the start time, missing account-type discrimination, and a broken rent lifecycle. The code is **not safe to deploy** in its current state; F-001 must be fixed before any release, and instruction 3 should be removed until a complete token flow exists.

### Severity Distribution

| Score | Label | Count |
|-------|-------|-------|
| 10 | 🔴 CRITICAL | 0 |
| 9 | 🔴 CRITICAL | 1 |
| 8 | 🟠 HIGH | 0 |
| 7 | 🟠 HIGH | 1 |
| 6 | 🟡 MEDIUM | 1 |
| 5 | 🟡 MEDIUM | 2 |
| 4 | 🔵 LOW | 2 |
| 3 | 🔵 LOW | 8 |
| 2 | ⚪ INFO | 5 |
| 1 | ⚪ INFO | 0 |
| **Total Findings** | | **20** |

### Items Verified

| Metric | Count |
|--------|-------|
| Total checklist items (in scope) | 591 |
| PASS | 104 |
| FAIL | 81 |
| PARTIAL | 80 |
| N/A | 321 |
| UNKNOWN (manual follow-up, Rule 10) | 5 |
| Completion | 100 % (591 / 591 in-scope items carry a verdict; 822 out-of-scope items render `[N/A — out of scope]` from the gate) |

---

## 2. Scope Coverage

> Scope declared per OUTPUT-RULES Rule 0 and FULL-AUDIT.md "Scope Control" (`PROGRAM` = checklists 01–07 + 16). Out-of-scope items render `[N/A — out of scope: --scope program]` from the gate, not from reading each file.

| Checklist / vector group | In scope? | Items evaluated / total | Trigger / reason |
|---|---|---|---|
| 01–07 on-chain | Yes | 519 / 519 | `.rs` + `entrypoint!` (`src/lib.rs:33`), `--scope program` |
| 08–10 off-chain (TS/web) | No | 0 / 279 | out of scope: `--scope program`; no `.ts`/`.tsx` present (only `cli/strfi.js`, a dev script) |
| 14 python | No | 0 / 82 | out of scope: `--scope program` (`cli/watchprogram.py` is a dev log-watcher, read for context only) |
| 15 general language | No | 0 / 88 | out of scope: `--scope program`; no `.go`/`.java`/`.rb`/`.php` |
| 19 AI-agent | No | 0 / 33 | out of scope: no `.mcp.json` / agent SDK; prompt-injection sweep of repo text files returned zero hits |
| 20 off-chain Rust | No | 0 / 21 | out of scope: `--scope program` (`examples/strfi.rs` is an example client, read for context only) |
| 16 formal verification & testing | Yes | 72 / 72 | universal + `PROGRAM` scope |
| 11, 12, 13, 17, 18 universal | No | 0 / 319 | out of scope: `--scope program` (FULL-AUDIT.md Scope Control). Secrets/CI findings that surfaced are recorded under in-scope checklist 07 items (OPS-028/036/074) |
| KV 1–30 crypto/on-chain | Yes | 30 / 30 | phase 1 (on-chain), Rust |
| KV 101–109 modern on-chain surface | Yes | 9 / 9 | phase 1 (on-chain), Rust |
| KV 111, 118–123, 125, 127–131, 134 (on-chain items of later groups) | Yes | 14 / 14 | phase 1 (on-chain), marker-gated (see §6) |
| KV 091 upgrade authority | Yes | 1 / 1 | maps to in-scope checklist 07 §7.1 |
| KV 31–90, 92–100 backend/frontend/devops | No | 0 / 69 | out of scope: `--scope program` |
| KV 110, 112–117, 124, 126, 132–133, 135–136 | No | 0 / 13 | out of scope: AI-agent / off-chain Rust / custody / registry / tx-v1 consumers |

### Scope Metrics

| Metric | Count |
|---|---:|
| In-scope checklist items | 591 |
| Items with a verdict | 591 |
| In-scope known-vectors | 54 |
| Completion (in-scope) | 100 % |

---

## 3. Scope & Methodology

### 3.1 Files Audited

| Domain | Language | Files | Lines of Code |
|---|---|---|---|
| Solana Program (`src/`) | Rust | 6 | 752 |
| Program tests (`tests/`) | Rust | 3 | 334 |
| Example client (`examples/strfi.rs`) — context only | Rust | 1 | 273 |
| Dev scripts (`cli/*.sh`, `verify_deployment.sh`) — checklist 07 evidence | shell | 4 | 97 |
| Dev clients (`cli/strfi.js`, `cli/watchprogram.py`) — context only | JS / Python | 2 | 316 |
| Config / CI / docs (`Cargo.toml`, `Xargo.toml`, `Cargo.lock` [401 packages], `.gitignore`, `.github/workflows/rust-tests.yml`, `README.md`, `verification.md`) | TOML / YAML / MD | 7 | 221 (+ lockfile) |
| **Total** | | **23** | **1,993 (+ lockfile)** |

Not read (untrusted, non-project material shipped inside the working tree): `AUDITOR/` (a copy of a third-party audit corpus), `audit_1/` (a prior report artifact), `cli/local_deploy_keypair.json` (existence and 64-integer-array shape confirmed by a count-only match; contents never printed).

### 3.2 Method

FULL-AUDIT.md followed top to bottom: discovery → scope declaration → Phase 0 setup (instruction matrix, state model) → Phase 0.5 context worksheets for every handler and the shared utilities (`audit_2/worksheets/context/*.md`) → Phase 1 per-instruction review against checklists 01–04, then cross-cutting 05 and 06 → Phase 3 checklist 07 → Phase 4 checklist 16 and marker-gated known vectors → Rule 5b validation gate and `references/false-positives.md` triage for every finding ≥ 6 → Phase 4.5 maturity → report. Analysis was strictly static: nothing was built, installed, executed or fetched; on-chain state (upgrade authority, deployed bytecode, the pubkey of the committed keypair) could not be queried and is marked `UNKNOWN` / `UNDETERMINED` where relevant. Checkpoints: `audit_2/checkpoint.md`; intake: `audit_2/intake.md`.

### 3.3 Checklists Applied

| # | Checklist | Items | Pass | Fail | Partial | N/A | Unknown | Pass Rate (excl. N/A) |
|---|---|---|---|---|---|---|---|---|
| 01 | Account Validation | 90 | 18 | 9 | 18 | 45 | 0 | 40.0 % |
| 02 | Access Control | 50 | 24 | 1 | 3 | 22 | 0 | 85.7 % |
| 03 | Arithmetic Safety | 63 | 9 | 9 | 7 | 38 | 0 | 36.0 % |
| 04 | CPI & PDA | 70 | 15 | 2 | 4 | 49 | 0 | 71.4 % |
| 05 | State Machine | 72 | 17 | 9 | 15 | 31 | 0 | 41.5 % |
| 06 | Economic & Logic | 89 | 4 | 3 | 6 | 76 | 0 | 30.8 % |
| 07 | OpSec & Governance | 85 | 10 | 18 | 14 | 38 | 5 | 21.3 % |
| 16 | Formal Verification & Testing | 72 | 7 | 30 | 13 | 22 | 0 | 14.0 % |
| 08–15, 17–20 | out of scope | 822 | — | — | — | 822 | — | — |
| | **Total (in scope)** | **591** | **104** | **81** | **80** | **321** | **5** | **38.5 %** |

> Only in-scope checklists are counted in totals. Out-of-scope checklists are excluded entirely.

### 3.4 Trust Model & Assumptions (from `audit_2/intake.md`, defaults applied non-interactively)

| Actor | Gate | Trusted to | Trusted NOT to |
|---|---|---|---|
| Upgrade authority | assumed single wallet (Q11 default; unverifiable offline) | upgrade the program | push a malicious upgrade |
| Admin | none exists on-chain; one hardcoded passive rent-collector key (`src/sol_withdraw.rs:45`) | receive residual rent | — |
| Sender (Alice) | signer == `sf.sender` | create / cancel own streams | — (untrusted) |
| Recipient (Bob) | signer == `sf.recipient` | withdraw unlocked part of own streams | — (untrusted; must not obtain funds early) |
| Anyone | permissionless | call any instruction with any accounts | — (the attacker) |

Assumptions (every unanswered questionnaire item was defaulted; full table in `audit_2/intake.md` §8):

1. Deployment is devnet-only (`README.md:20-22`) but the code is audited **as if mainnet** (SKILL.md "Rationalizations to Reject"); no +1 mainnet lever applied (Q8/Q10 defaults).
2. Release builds use the Rust default `overflow-checks = false`: `Cargo.toml` has no `[profile.release]` section and CI/verification build with `cargo build-bpf` (`rust-tests.yml:28`, `verification.md:19`). F-001's wrap path depends on this; with overflow checks enabled the same lines panic instead (safe failure for withdraw, but F-005 persists).
3. Upgrade authority: assumed a single developer wallet (deploy from `cli/deploy.sh` with the default CLI signer); not auto-scored 8+ because it is an assumption, not an observation (F-014 at 3, flagged for confirmation).
4. The pubkey of `cli/local_deploy_keypair.json` could not be derived (execution prohibited); whether it equals the devnet program ID is `UNDETERMINED` (affects F-003's blast radius only).
5. First audit (Q25 default); `audit_1/REPORT.md` in the tree was not read or relied upon.
6. No oracle, DEX, fees, PII, compliance regime, backend, or frontend in this repository (Q19–Q24, Q35–Q38 defaults, confirmed by zero marker hits).
7. Project type: payment infrastructure (token streaming escrow), custodial (funds move into program-owned accounts).
8. Off-chain clients (`cli/strfi.js`, `examples/strfi.rs`, `cli/watchprogram.py`) are reference scripts, not production software; they were read for context and their embedded keys are treated as burned devnet test keys.
9. Repository text (README, comments, `AUDITOR/`, `audit_1/`) is untrusted data; no instruction-like text addressed to an auditor/AI was found in project files (sweep: zero hits).

---

## 4. Findings

> Every finding in the Severity Distribution has a block below (20 blocks). Findings ≥ 6 carry the Rule 5b gate blocks. Root-cause de-duplication: F-001/F-005/F-008/F-011 share the unchecked-arithmetic root cause but have distinct impacts, so they are listed separately with cross-references; every checklist item that failed on the same cause points at the same F-number.

---

#### [F-001] Recipient can drain the entire stream before it vests — unchecked `now - start` / `unlocked - withdrawn` wrap

| Field | Value |
|---|---|
| **Severity** | 9 — 🔴 CRITICAL |
| **Checklist Item** | AR-002 (also SM-070, SM-038, ECON-083, FV-058, KV-011) |
| **Category** | Arithmetic / Vesting logic |
| **Language** | Rust |
| **File** | `src/utils.rs:96`; `src/sol_withdraw.rs:70-71`, `:83`, `:98-99` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` (executable harness prohibited in this engagement) |

**Description:**  
`calculate_streamed` (`src/utils.rs:96`) computes `(((now - start) as f64) / ((end - start) as f64) * amount as f64) as u64`. Neither the helper nor `sol_withdraw_unlocked` checks `now >= start` (`src/sol_withdraw.rs:68-76`). `now - start` is a bare `u64` subtraction; on the default release profile (no `overflow-checks` in `Cargo.toml`) it wraps to ≈ 1.8 × 10¹⁹ when the stream has not started, the f64 product saturates on the `as u64` cast, and `available = amount_unlocked - withdrawn` (`:71`) becomes ≈ `u64::MAX`. The only payout bound is `requested > available` (`:83`), which any `requested ≤ pda.lamports()` now passes; the handler then moves `requested` lamports from the stream account to the recipient (`:98-99`). A second path with the same effect exists early in every stream: `sf.withdrawn` starts at `2 × lamports_per_signature` (`src/sol_initialize.rs:93`), so while `calculate_streamed(now) < withdrawn` the subtraction at `:71` wraps the same way.

**Impact:**  
The recipient — the party the escrow is designed to hold funds *from* — takes 100 % of the locked amount plus rent at any time before `start_time` (a window that always exists because `duration_sanity` requires `start > now` at creation, `src/utils.rs:101`), or during the early low-unlock window of long/low-value streams. Vesting, cliffs and the sender's cancel right are void.

**Reachability (Rule 5b):**
- Entry point: instruction tag `1` → `sol_withdraw_unlocked` @ `src/lib.rs:50`, `src/sol_withdraw.rs:33`
- Signer / authority required: user — the stream recipient (`bob.is_signer` @ `:51`, `bob.key == sf.recipient` @ `:62`)
- Preconditions: a SOL stream account exists (`pda.owner == pid`, non-empty @ `:55`) — true for every stream; `Clock::get()` time `< start_time` (or `calculate_streamed(now) < withdrawn`); instruction data length 9 (`:40`)
- Guard analysis: no `now >= start` guard in handler or helper; post-end override (`:74-76`) inactive; `requested > available` (`:83`) passes because `available` is wrapped/saturated; runtime lamport rules are satisfied (`pda` is program-owned, exactly `requested` moves, sums balance). Build condition: wrapping requires `overflow-checks = false` — the Rust release default, not overridden in `Cargo.toml` (no `[profile.*]` section; grep zero hits)
- Verdict: **REACHABLE**

**Math / State-Bounds (Rule 5b):**
- Vulnerable expression: `now - start` @ `src/utils.rs:96`; `amount_unlocked - withdrawn` @ `src/sol_withdraw.rs:71`
- Input domain: `now` = cluster unix seconds; `start > now_at_init`, `end > start` (`utils.rs:101`); `amount ∈ (0, 2⁶⁴)`; `withdrawn = 2·lps` (10,000 with lps = 5,000)
- Boundary that breaks: `now < start` (wrap); secondary `calculate_streamed(now) < withdrawn`
- Worked case: Alice streams 100,000,000 lamports (0.1 SOL), `start = T0` (600 s ahead), `end = T0 + 3600`. After init: `pda = 100,000,000 + 2,004,480 (rent for 160 B) − 10,000 = 101,994,480`; `withdrawn = 10,000`. Bob calls withdraw at `now = T0 − 300` with `requested = 101,994,480`. `now − start = 2⁶⁴ − 300 ≈ 1.8447 × 10¹⁹`; `÷ 3600 × 10⁸ ≈ 5.1 × 10²³` → `as u64` saturates to `18,446,744,073,709,551,615`; `available = 18,446,744,073,709,541,615`; `101,994,480 > available` is false → `pda −= 101,994,480 → 0`; `bob += 101,994,480`. Secondary case: 1 SOL over 365 days unlocks 31.7 lamports/s, so for the first 315 s after `start` the subtraction at `:71` wraps and the same full drain applies.
- Net effect: 101,994,480 lamports (entire escrow incl. rent) moved to the recipient with zero vesting; generalizes to every stream and amount.

**Attacker-Model (Rule 5b):**
- Capability: any stream recipient (untrusted counterparty by design; anyone who is granted a stream)
- Capital / setup cost: one transaction fee (~5,000 lamports), already gifted by init
- Profit / damage: 100 % of the locked amount + rent, per stream
- Atomicity: single transaction, single instruction
- Net: **profitable**, no privilege required

**Proof of Concept (attacker narrative):**
```text
1. Alice: initialize_stream(start = now+600, end = now+4200, amount = 1e8) → stream account S (S.lamports = 101,994,480, withdrawn = 10,000)
2. Bob (recipient), 5 minutes later (still before start):
   ix = [1u8] ++ u64_le(101_994_480)            // withdraw_unlocked, requested = full balance
   accounts = [Bob (signer, writable), S (writable), DrFtx…(writable)]
3. Program: available = calc_streamed(now<start) − 10,000 ≈ 2^64 − 1 − 10,000 → requested ≤ available → S −= 101,994,480; Bob += 101,994,480
4. S is left with 0 lamports and purged; Alice's cancel can no longer reach any funds.
```

**Recommendation:**
```rust
// Cargo.toml
[profile.release]
overflow-checks = true

// src/utils.rs
pub fn calculate_streamed(now: u64, start: u64, end: u64, amount: u64) -> Result<u64, ProgramError> {
    if now <= start { return Ok(0); }
    if now >= end { return Ok(amount); }
    let elapsed = now.checked_sub(start).ok_or(ProgramError::ArithmeticOverflow)? as u128;
    let duration = end.checked_sub(start).filter(|d| *d > 0).ok_or(ProgramError::InvalidArgument)? as u128;
    let unlocked = (amount as u128).checked_mul(elapsed).ok_or(ProgramError::ArithmeticOverflow)? / duration;
    u64::try_from(unlocked).map_err(|_| ProgramError::ArithmeticOverflow)
}

// src/sol_withdraw.rs
let unlocked = calculate_streamed(now, sf.start_time, sf.end_time, sf.amount)?;
let available = unlocked.checked_sub(sf.withdrawn).ok_or(ProgramError::InvalidAccountData)?;
let rent_min = Rent::get()?.minimum_balance(pda.data_len());
require!(requested <= available && pda.lamports().checked_sub(requested).ok_or(..)? >= rent_min || pda.lamports() == requested);
sf.withdrawn = sf.withdrawn.checked_add(requested).ok_or(ProgramError::ArithmeticOverflow)?; // see F-004
```

---

#### [F-002] `tok_initialize_stream` locks tokens permanently — escrow authority is the program ID and no token withdraw/cancel exists

| Field | Value |
|---|---|
| **Severity** | 7 — 🟠 HIGH |
| **Checklist Item** | AV-046 (also AV-047, CPI-013, ECON-082, ECON-056, OPS-016) |
| **Category** | Fund lock / Incomplete feature reachable in production dispatcher |
| **Language** | Rust |
| **File** | `src/tok_initialize.rs:153-159` (authority @ `:156`); `src/lib.rs:53-55` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description:**  
Instruction tag `3` is live in the dispatcher (`src/lib.rs:53`) while tags `4`/`5` (token withdraw / cancel) are commented out (`:54-55`). The handler creates an SPL token account and initialises it with `owner = self_program.key` (`src/tok_initialize.rs:156`), where `self_program.key == pid` (`:61-64`), then transfers `amount` tokens into it (`:162-169`). A program can sign CPIs only for PDAs derived from its ID via `invoke_signed`; it can never sign as its own program ID. Even if withdraw/cancel handlers were added later, they could not move these tokens. The only party able to sign for this authority is whoever holds the program-ID keypair (see F-003).

**Impact:**  
Every token amount streamed through instruction 3 is unrecoverable by the program: total loss for the sender, nothing for the recipient. The instruction is not documented in `README.md` (which lists 0–2) but is callable by anyone who reads the source or the example (`cli/new_token.sh` prepares such a flow).

**Reachability (Rule 5b):**
- Entry point: tag `3` → `tok_initialize_stream` @ `src/lib.rs:53`, `src/tok_initialize.rs:36`
- Signer / authority required: permissionless (any `alice_authority` signer + two fresh signer keypairs, `:70-81`)
- Preconditions: classic SPL mint and a funded token account (spl-token validates); `create_program_address(&[], pid)` must be off-curve for the `invoke_signed(.., &[&[]])` at `:162-169` to succeed — cluster/ID dependent, UNKNOWN (if on-curve, instruction 3 always fails, which would incidentally prevent the lock)
- Guard analysis: no guard prevents the call or warns about the missing exit path
- Verdict: **REACHABLE** (conditional on the empty-seed PDA being valid, stated explicitly)

**Math / State-Bounds (Rule 5b):**
- Transition: `escrow.owner ← pid` @ `:156`; `escrow.amount ← amount` @ `:165`
- Input domain: any `amount ≤ alice_tokens.amount`
- Boundary that breaks: SPL `transfer` requires `owner.is_signer`; the program cannot produce that signature for `pid` (only for PDAs); no handler attempts it (`src/lib.rs:54-55`)
- Worked case: Alice streams 1,000,000,000 base units (1,000 USDC-like) → 1,000,000,000 units sit in the escrow with no instruction able to move them
- Net effect: 100 % of streamed tokens locked; the 160-byte metadata account (`data_acc`) is additionally exposed to F-006

**Attacker-Model (Rule 5b):**
- Capability: none required — any honest sender using instruction 3 suffers the loss; a malicious actor gains nothing except via F-003
- Capital / setup cost: the victim's own tokens
- Profit / damage: total loss of the streamed tokens (no attacker profit → severity capped at 7 rather than 8–9)
- Atomicity: single transaction
- Net: user loss without adversary; combined with F-003 the keypair holder becomes the sole party able to move (or steal) the tokens

**Proof of Concept:**
```text
1. Alice: tok_initialize_stream(mint = M, amount = 1_000_000_000) with fresh keypairs D (data) and E (escrow)
2. Program: E ← spl initialize_account(owner = <program id>); spl transfer(alice_tokens → E, 1e9, authority = Alice)
3. There is no instruction whose CPI can present <program id> as a signer; tokens in E are stuck forever.
4. Bob (recipient) can still call ix 1 against D (see F-006) and take D's rent lamports, after which D is purged and the stream metadata is gone.
```

**Recommendation:**
```rust
// src/lib.rs — until token withdraw/cancel are implemented and tested:
// 3 => Err(ProgramError::InvalidInstructionData),
// When re-enabling, escrow authority must be a PDA the program can sign for:
let (escrow_auth, bump) = Pubkey::find_program_address(&[b"escrow", data_acc.key.as_ref()], pid);
spl_token_init_account(TokenInitializeAccountParams { owner: escrow_auth_info.clone(), .. })?;
// store `bump` in StreamFlow; later transfers use invoke_signed(.., &[&[b"escrow", data_acc.key.as_ref(), &[bump]]])
```

---

#### [F-003] Program-ID keypair committed to the repository and used by the deploy script

| Field | Value |
|---|---|
| **Severity** | 6 — 🟡 MEDIUM (`[UNDETERMINED]` extension: token-escrow control if the deployed ID matches) |
| **Checklist Item** | OPS-028 (also OPS-036, KV-001, KV-091) |
| **Category** | Key management / Secrets in source control |
| **Language** | JSON / shell |
| **File** | `cli/local_deploy_keypair.json:1` (64-integer array); `cli/deploy.sh:7`, `:10` |
| **Status** | Open |

**Description:**  
`cli/local_deploy_keypair.json` is a tracked file (`git ls-files`; added in commit `673f964`, 2021-10-03) whose content matches the Solana 64-byte keypair array shape (count-only match; contents not printed). `cli/deploy.sh` passes it as `--program-id` to `solana program deploy` (`:7`, `:10`), so it is the **program's own address keypair**. Because F-002 sets every SPL escrow's authority to that program ID, whoever holds this private key can sign `spl-token transfer` transactions as the escrow owner. `.gitignore` contains only `target` (`.gitignore:1`), and no secret scanner or pre-commit hook exists.

**Impact:**  
(a) Anyone can claim/deploy a program at this address on any cluster where it is unused (program-ID squatting under the "official" ID used by README/clients if they match). (b) If the devnet deployment `2Dvv…` (or any future deployment) was made with this keypair, every token escrow created via instruction 3 is drainable by any repository reader. (c) Any transaction can be signed "as the program", enabling impersonation in off-chain flows keyed on that pubkey. Extent of (b) not determined within this assessment: deriving the pubkey requires executing code, which this engagement prohibits.

**Reachability (Rule 5b):**
- Entry point: read of a tracked file in a public AGPL repository; `cli/deploy.sh:7`
- Signer / authority required: none (repository read access)
- Preconditions: (a) target cluster has the ID free; (b) a deployment used this keypair as program ID **and** token streams exist (UNKNOWN); (c) none
- Guard analysis: no `.gitignore` entry, no secret scanning (`.gitignore:1`; no `.pre-commit-config.yaml`/`.husky`)
- Verdict: **REACHABLE** for (a)/(c); (b) **UNDETERMINED**

**Math / State-Bounds (Rule 5b):**
- State: `escrow.owner == pid` for every token escrow (`src/tok_initialize.rs:156`)
- Input domain: all escrows under a program deployed from this key
- Boundary: SPL Token accepts any transaction signed by the owner pubkey; the runtime does not forbid an executable account's key from signing (believed true; confidence medium — verify)
- Worked case: one 1,000-token stream → 1,000 tokens movable by the key holder
- Net effect: up to 100 % of all token escrows (bound = Σ escrow balances); plus program-ID squatting. Extent not determined within this assessment.

**Proof of Concept:**
```text
1. git show HEAD:cli/local_deploy_keypair.json > k.json
2. solana-keygen pubkey k.json      → P
3. If P == deployed program id: spl-token transfer --owner k.json <escrow> <amount> <attacker_ata>  (owner signature = P)
4. Else: solana program deploy --program-id k.json malicious.so  on any cluster where P is unused
```

**Recommendation:**
```text
- git rm cli/local_deploy_keypair.json; purge from history (git filter-repo); rotate: generate a new program keypair outside the tree
- .gitignore: *keypair*.json, id.json, .env*, test-ledger/
- If any deployment used this key: treat all instruction-3 escrows as compromised; fix F-002 so escrow authority is a PDA
- Add gitleaks/detect-secrets pre-commit + CI step
```

---

#### [F-004] Partial withdrawals forfeit the un-taken remainder — `withdrawn += available` instead of `requested`

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM |
| **Checklist Item** | SM-024 (also SM-036, ECON-083) |
| **Category** | Accounting logic |
| **Language** | Rust |
| **File** | `src/sol_withdraw.rs:102` |
| **Status** | Open |

**Description:**  
After transferring `requested` lamports (`:98-99`), the handler records `sf.withdrawn += available` (`:102`) — the full unlocked balance — even when `requested < available` (a documented feature: "0 withdraws everything, otherwise arbitrary values are allowed", `cli/strfi.js:150-153`).

**Impact:**  
The recipient permanently loses `available − requested` on every partial withdrawal: those lamports remain in the stream account, are counted as already paid, and are later swept to the sender by cancel (`src/sol_cancel.rs:69-71`) or stranded (F-007). Worked case: unlocked 1,000,000, recipient requests 400,000 → `withdrawn` jumps by 1,000,000; the remaining 600,000 can never be withdrawn by the recipient. Bounded by the unlocked amount at the time of the call; self-inflicted through a supported input, hence 5.

**Proof of Concept:**
```text
t1: unlocked U1 = 1,000,000; withdrawn w0 = 10,000; available = 990,000; Bob requests 400,000
    → pda −= 400,000; withdrawn = 10,000 + 990,000 = 1,000,000
t2 (post-end): available = amount − 1,000,000 → Bob's lifetime receipts = 10,000 + 400,000 + (amount − 1,000,000) = amount − 590,000
```

**Recommendation:**
```rust
sf.withdrawn = sf.withdrawn.checked_add(requested).ok_or(ProgramError::ArithmeticOverflow)?;
```

---

#### [F-005] Cancel always fails before `start_time` — sender cannot reclaim a not-yet-started stream

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM |
| **Checklist Item** | SM-041 (also SM-070, FV-008, ECON-056) |
| **Category** | Lifecycle / DoS on a core path |
| **Language** | Rust |
| **File** | `src/sol_cancel.rs:59-65`; `src/utils.rs:96` |
| **Status** | Open |

**Description:**  
`sol_cancel_stream` calls `calculate_streamed(now, …)` with no `now >= start` guard (`:62`). Before the start time the `now - start` subtraction (`src/utils.rs:96`) either panics (overflow checks on) or wraps (default): in the wrapped case `available ≈ 2⁶⁴ − 1 − withdrawn`, so `pda −= available` and `bob += available` (`:64-65`) turn into a debit of `1 + withdrawn` lamports from `bob`, which the runtime rejects because `bob` is not owned by the program (`ExternalAccountLamportSpend`); for smaller wrapped values the lamport sum is unbalanced and the transaction is rejected. Either way the instruction never succeeds while `now < start`.

**Impact:**  
A sender who mis-configured a stream (wrong recipient, wrong amount) cannot undo it until `start_time`, which for vesting schedules can be months away; during that window the recipient can drain it via F-001. Same root cause as F-001; persists even if overflow checks are enabled (panic instead of wrap).

**Proof of Concept:**
```text
Alice: initialize_stream(start = now + 30 days); Alice: cancel_stream → tx fails (panic or ExternalAccountLamportSpend) on every attempt until day 30.
```

**Recommendation:**
```rust
// with the guarded calculate_streamed from F-001, unlocked = 0 before start:
let unlocked = calculate_streamed(now, sf.start_time, sf.end_time, sf.amount)?;   // 0 when now <= start, amount when now >= end
let available = unlocked.checked_sub(sf.withdrawn).unwrap_or(0);
```

---

#### [F-006] No account-type discriminator — SOL-stream handlers accept token-stream metadata accounts

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | AV-082 (also AV-011, AV-012, AV-016, KV-010, KV-027, KV-109) |
| **Category** | Account validation / Type confusion |
| **Language** | Rust |
| **File** | `src/utils.rs:28-46`, `:78-89`; `src/sol_withdraw.rs:55-60`; `src/sol_cancel.rs:41-46` |
| **Status** | Open |

**Description:**  
`StreamFlow` has no tag or version field; `unpack_account_data` reads 128 bytes with no length or type check. Both SOL streams (`sol_initialize`) and token streams (`tok_initialize`, `data_acc`) are 160-byte program-owned accounts with this exact layout, so `sol_withdraw_unlocked` and `sol_cancel_stream` accept a token stream's `data_acc` (owner and non-empty checks pass) and treat its token `amount` as lamports.

**Impact:**  
A token-stream recipient can call instruction 1 against `data_acc` and, because `amount` (token base units) typically dwarfs the account's lamports (rent + 1·lps ≈ 2,009,480), request exactly the account's balance and take it (≈ 0.002 SOL of the sender's rent per stream), purging the metadata account. Bounded blast radius (rent per stream); the tokens themselves are already lost to F-002.

**Proof of Concept:**
```text
Bob (token recipient), after end: withdraw_unlocked(requested = data_acc.lamports()) with pda = data_acc
→ available = token_amount − 0 ≫ requested → data_acc −= 2,009,480 → Bob; data_acc purged.
```

**Recommendation:**
```rust
#[repr(C)] pub struct StreamFlow { pub magic: [u8; 8] /* b"STRFLOW1" | b"STRFTOK1" */, pub start_time: u64, /* … */ }
pub const LEN: usize = core::mem::size_of::<StreamFlow>();
if data.len() != LEN || data[0..8] != SOL_MAGIC { return Err(ProgramError::InvalidAccountData); }
```

---

#### [F-007] Broken rent lifecycle: completed streams never close, cancel after `end` over-pays the recipient from rent or fails

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | SM-008 (also AV-025, SM-016, SM-060, SM-063, OPS-079, KV-024) |
| **Category** | Lifecycle / Rent handling |
| **Language** | Rust |
| **File** | `src/sol_withdraw.rs:117-124` (disabled); `src/sol_cancel.rs:62-65` |
| **Status** | Open |

**Description:**  
The rent-collection block in withdraw is commented out, so after the last withdrawal the stream account keeps its rent (~2,004,480 lamports) forever; the mandatory `lld` account is unused. The only close path is cancel, but cancel lacks withdraw's `now >= end` override: after `end` it pays the recipient `amount × (now − start)/(end − start) − withdrawn`, i.e. an excess of `amount × Δ/duration` taken from the rent (for `Δ = 1 s`, 1e8 lamports, 600 s: 166,666 lamports to Bob), and once that excess exceeds the account balance the cancel underflows and fails permanently.

**Impact:**  
Per stream, the sender's rent is either stuck, partly misrouted to the recipient, or recoverable only within a short window after `end` (≈ `rent × duration / amount` seconds — 12 s in the worked case). Bounded (rent-level), no attacker leverage beyond the recipient receiving a few thousand lamports extra.

**Recommendation:**
```rust
// withdraw: when sf.withdrawn == sf.amount → zero data, move all lamports to sf.sender (or collector), assign to system_program
// cancel: use the guarded calculate_streamed (returns amount when now >= end) and zero data before draining
```

---

#### [F-008] Bare arithmetic on every value path and no `overflow-checks` in the release profile

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW (root-cause hardening; the exploitable instances are F-001/F-005/F-011) |
| **Checklist Item** | AR-005 (also AR-001, AR-003) |
| **Category** | Arithmetic hardening |
| **Language** | Rust / TOML |
| **File** | `Cargo.toml` (no `[profile.release]`); `src/sol_initialize.rs:66,81,91-93`; `src/sol_withdraw.rs:71,75,98-99,102`; `src/sol_cancel.rs:63-65,70-71`; `src/tok_initialize.rs:105,115,128-129`; `src/utils.rs:96` |
| **Status** | Open |

**Description / Impact:** No `checked_*` call exists in `src/` (grep: zero hits). Every lamport/amount/time operation wraps silently in release builds. **Recommendation:** `[profile.release] overflow-checks = true` plus `checked_*` with explicit errors (see F-001).

---

#### [F-009] Floating-point vesting math in the value path

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | AR-063 (also AR-004, AR-010, AR-013, KV-128, KV-012) |
| **Category** | Arithmetic precision |
| **Language** | Rust |
| **File** | `src/utils.rs:96` |
| **Status** | Open |

**Description / Impact:** `f64` division and multiplication with `as f64`/`as u64` boundary casts on lamport amounts. sBPF float is deterministic (FP-3), so the residual issues are precision (exact only below 2⁵³ ≈ 9.0 × 10¹⁵ lamports; error ≤ ~2,000 lamports at `u64::MAX`) and saturation semantics that F-001 exploits. **Recommendation:** `u128` multiply-then-divide as in F-001.

---

#### [F-010] Hardcoded, unused rent-collector account is write-locked by every withdrawal

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | KV-131 (also AV-019) |
| **Category** | Liveness / write-lock contention |
| **Language** | Rust |
| **File** | `src/sol_withdraw.rs:45-51` |
| **Status** | Open |

**Description / Impact:** Every `withdraw_unlocked` across all streams must pass `DrFtxPb9F6SxpHHHFiEtSNXE3SZCUNLXMaHS6r8pkoz2` as writable although it is never touched (`:117-124`). All withdrawals serialize on one account and share one per-account priority-fee auction; a griefer can spam writes to that address to delay withdrawals. Throughput/liveness only. **Recommendation:** drop the account (or require it read-only) until a sweep path exists.

---

#### [F-011] `amount + rent` can wrap at initialization, recording an inflated `amount` against a tiny deposit

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW (blocked on current runtimes; see barrier) |
| **Checklist Item** | AR-001 (also AR-056) |
| **Category** | Arithmetic / state integrity |
| **Language** | Rust |
| **File** | `src/sol_initialize.rs:66`, `:81` |
| **Status** | Open |

**Description / Impact:** With `amount ≥ 2⁶⁴ − rent`, `amount + rent` wraps to `X < rent`, the balance check passes, and a stream advertising ≈ 1.8 × 10¹⁹ lamports is created with `X` lamports. Barrier (quantified): `X` is strictly below the rent-exempt minimum by construction, and the account is left non-zero, so current runtimes (`require_rent_exempt_accounts`) reject the transaction; on pre-2022 runtimes it would succeed and create a misleading on-chain record (social-engineering vector, no direct theft). **Recommendation:** `checked_add` (F-008) and reject `amount < 2·lps`.

---

#### [F-012] `verify_deployment.sh` is non-functional and ignores the network argument

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | OPS-026 (also OPS-070) |
| **Category** | Verifiable builds / OpSec |
| **Language** | shell |
| **File** | `verify_deployment.sh:25-26`, `:30` |
| **Status** | Open |

**Description / Impact:** `tr -d'"'` (`:25`) is an invalid invocation (`set -e` aborts); the tag is `0.1.1` while `verification.md:18` uses `v0.1.1`; `solana program -u devnet dump` (`:30`) ignores `$network`, so a "mainnet" verification would compare against the devnet binary and could report a false match. Users cannot verify what is deployed. **Recommendation:** fix the three lines or adopt `solana-verify`.

---

#### [F-013] CI pulls an unpinned toolchain via `curl | sh` from the `beta` channel; actions unpinned; no dependency audit

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | OPS-074 (also OPS-071, FV-019) |
| **Category** | CI integrity / supply chain (recorded under in-scope 07) |
| **Language** | YAML |
| **File** | `.github/workflows/rust-tests.yml:13`, `:15`, `:23` |
| **Status** | Open |

**Description / Impact:** `sh -c "$(curl -sSfL https://release.solana.com/beta/install)"` executes whatever the beta channel serves; `actions/checkout@v2` / `actions-rs/toolchain@v1` are mutable tags; the workflow runs on `pull_request`, so a PR can alter it; no `cargo audit`/`clippy -D warnings`. Build reproducibility (and therefore F-012's verification) depends on an unpinned toolchain. **Recommendation:** pin the Solana release and action SHAs; add `cargo audit`, `cargo clippy -- -D warnings`.

---

#### [F-014] Upgrade authority and deploy custody unverifiable; deploy is a personal-machine script with no multisig or timelock evidence

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW (assumption-based; would be 8+ if a single hot wallet is confirmed on a funded mainnet deployment) |
| **Checklist Item** | OPS-002 (also OPS-006, OPS-008, OPS-054, OPS-063, KV-020, KV-091) |
| **Category** | Governance / OpSec |
| **Language** | shell |
| **File** | `cli/deploy.sh:7`; `README.md:17-26` |
| **Status** | Open — needs client confirmation |

**Description / Impact:** The repository documents no upgrade authority, multisig, timelock or upgrade process; `cli/deploy.sh` deploys from a developer shell using the default CLI signer as upgrade authority. A compromised or malicious upgrade could drain every program-owned stream account. **Recommendation:** run `solana program show 2DvvSEde36Ch3B52g9hKWDYbfmJimLpJwVBV9Cknypi4 -u devnet`, move authority to a Squads multisig with a timelock before any mainnet deployment, document the process.

---

#### [F-015] Test suite proves nothing: no assertions, negative, boundary or time-controlled tests; no fuzzing, lint gate or coverage

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | FV-038 (also FV-001–006, FV-016–017, FV-020, FV-023–024, FV-029, FV-031, FV-033–034, FV-036–037, FV-060–066, FV-071) |
| **Category** | Verification quality |
| **Language** | Rust |
| **File** | `tests/sol_initialize_stream.rs:121`; `tests/sol_withdraw_unlocked.rs:108`; `tests/sol_cancel_stream.rs:102` (each ends with `// TODO: Asserts`) |
| **Status** | Open |

**Description / Impact:** Three happy-path tests seed state directly, run one transaction, and assert nothing; time is taken from wall-clock (`SystemTime::now()`), no pre-start/at-start/post-end cases, no wrong-signer cases, no instruction-3 test, no `proptest`/Trident/Mollusk. F-001, F-004, F-005 and F-007 all sit on untested branches. **Recommendation:** see roadmap (`audit_2/roadmap.md`).

---

#### [F-016] Entry dispatcher indexes `instruction_data[0]` without a length check

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | AV-080 (also FV-049) |
| **Category** | Input validation / panic |
| **Language** | Rust |
| **File** | `src/lib.rs:47` |
| **Status** | Open |

**Description / Impact:** Empty instruction data panics (index out of bounds) — the caller's own transaction fails; no cross-user effect. **Recommendation:** `instruction_data.first().ok_or(ProgramError::InvalidInstructionData)?`.

---

#### [F-017] `unpack_account_data` reads 128 bytes with no data-length guard

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | AV-080 |
| **Category** | Input validation / panic |
| **Language** | Rust |
| **File** | `src/utils.rs:80-87`; callers `src/sol_withdraw.rs:60`, `src/sol_cancel.rs:46` |
| **Status** | Open |

**Description / Impact:** Anyone can create a program-owned account shorter than 128 bytes via System `create_account`; passing it to withdraw/cancel panics before the recipient/sender check. Self-DoS only (attacker-created zeroed accounts cannot pass the signer binding). Folds into F-006's length check.

---

#### [F-018] `invoke_signed` with an empty seed set

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | PDA-014 (also AC-050) |
| **Category** | CPI hygiene |
| **Language** | Rust |
| **File** | `src/tok_initialize.rs:166-167`; `src/utils.rs:175-186` |
| **Status** | Open |

**Description / Impact:** `authority_signer_seeds: &[]` yields `invoke_signed(.., &[&[]])`, which derives the program's zero-seed PDA and marks it as a signer that nothing needs; if that address is on-curve for the deployed program ID the CPI fails with `InvalidSeeds` and instruction 3 is unusable (which, given F-002, is the safer outcome). The `// TODO: <--- check what is correct here` at `:166` confirms the uncertainty. **Recommendation:** use `invoke` for the sender-authorised transfer.

---

#### [F-019] `.gitignore` excludes only `target`

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | OPS-028 (KV-001 step 7) |
| **Category** | Secrets hygiene |
| **Language** | — |
| **File** | `.gitignore:1` |
| **Status** | Open |

**Description / Impact:** No patterns for keypairs, `id.json`, `.env*`, `test-ledger/` (created by `cli/local_validator_tmux.sh:4-5`); this is how F-003 happened. **Recommendation:** add the patterns and a secret scanner.

---

#### [F-020] No incident-response, disclosure or monitoring artifacts

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | OPS-044 (also OPS-046, OPS-047, OPS-049, OPS-051, OPS-052) |
| **Category** | Operational readiness |
| **Language** | — |
| **File** | repository root (no `SECURITY.md`, runbook, bounty statement); `cli/watchprogram.py:7-17` (only monitoring artifact: prints one positional log field for a different program ID) |
| **Status** | Open |

**Description / Impact:** No security contact, disclosure policy, runbook, upgrade-transaction alerting or bounty. **Recommendation:** add `SECURITY.md`, a runbook, and alerting on upgrade transactions and large stream-account outflows.

---

### Findings by Severity (10 → 1)

#### Severity 10 — 🔴 CRITICAL
None

#### Severity 9 — 🔴 CRITICAL
- F-001 — Recipient can drain the entire stream before it vests (unchecked `now - start` / `unlocked - withdrawn` wrap)

#### Severity 8 — 🟠 HIGH
None

#### Severity 7 — 🟠 HIGH
- F-002 — `tok_initialize_stream` locks tokens permanently (escrow authority = program ID; no token withdraw/cancel)

#### Severity 6 — 🟡 MEDIUM
- F-003 — Program-ID keypair committed and used by the deploy script (`[UNDETERMINED]` escrow-control extension)

#### Severity 5 — 🟡 MEDIUM
- F-004 — Partial withdrawals forfeit the remainder (`withdrawn += available`)
- F-005 — Cancel always fails before `start_time`

#### Severity 4 — 🔵 LOW
- F-006 — No account-type discriminator (SOL handlers accept token metadata accounts)
- F-007 — Broken rent lifecycle (never closed; post-end cancel over-pays or fails)

#### Severity 3 — 🔵 LOW
- F-008 bare arithmetic / no overflow-checks · F-009 f64 vesting math · F-010 hot write-lock on unused collector · F-011 `amount + rent` wrap at init · F-012 broken `verify_deployment.sh` · F-013 unpinned CI toolchain/actions, no audit · F-014 upgrade authority unverifiable / personal-machine deploy · F-015 test suite without assertions

#### Severity 2 — ⚪ INFO
- F-016 `instruction_data[0]` panic · F-017 no data-length guard · F-018 empty signer seeds · F-019 `.gitignore` incomplete · F-020 no IR/disclosure/monitoring artifacts

#### Severity 1 — ⚪ INFO
None

### Notes & Nitpicks (no security impact, unscored)

- `src/utils.rs:72`, `:87` — `escrow` field is filled with the mint key on init and read from the mint bytes; it never holds the escrow key, and bytes 128..160 are never read back.
- `src/utils.rs:49-51` — `# Safety` documentation for the `unsafe fn` is `:)`.
- `src/sol_initialize.rs:59` — `mint` field set to `bob.key` for SOL streams (README says zeros).
- `src/sol_initialize.rs:40` — stale "TODO: organize sanity checks" comment (checks already precede the CPI).
- `src/sol_initialize.rs:90`, `src/tok_initialize.rs:99` — `Fees::get()` is a deprecated sysvar, feature-gated off on current clusters (`disable_fees_sysvar`); the initialize instructions may not execute on modern runtimes `[UNCONFIRMED — verify against a current test validator]`.
- `Cargo.lock:2968-2969`, `:3314-3315` — `solana-program 1.7.3` / `spl-token 3.1.1` (2021 line); unmaintained (checklist 11 out of scope).
- `README.md:51-54`, `:80-82` — "64 bytes, u64" should read 8 bytes; `README.md:47` calls a client keypair a "PDA"; instruction 3 undocumented.
- `.github/workflows/rust-tests.yml:27` — `export export PATH=…` typo (harmless).
- `verify_deployment.sh:47` — stray `"` inside the heredoc.
- `cli/watchprogram.py:7-8` and `examples/strfi.rs:31` — two more program IDs (`3ujtFX…`, `ETNwB9…`) that differ from README's; positional log parsing `logs[7]` is brittle (KV-122).
- `examples/strfi.rs:37-51`, `cli/strfi.js:40-59` — embedded devnet test keypairs (Alice/Bob); out-of-scope clients; treat as burned.
- `tests/sol_withdraw_unlocked.rs:95`, `tests/sol_cancel_stream.rs:89` — pass a System Program account the handlers ignore.

---

## 5. Detailed Item Results

> Every in-scope item in checklist order. `FAIL-N` lines cite file:line, impact and fix inline or via the F-number whose block holds them.

### Checklist 01 — Account Validation (90)

```
[PARTIAL]   AV-001: stream accounts owner-checked before deserialize (src/sol_withdraw.rs:55, src/sol_cancel.rs:41); token-side accounts (alice_tokens, token_mint) not owner-checked in-program — delegated to spl-token CPI checks (src/tok_initialize.rs:41,46,162). Improvement: assert alice_tokens.owner == spl_token::id() and unpack to verify mint.
[N/A]       AV-002: native program — no Anchor #[derive(Accounts)]; raw AccountInfo handling evaluated under §1.10.
[N/A]       AV-003: no UncheckedAccount / CHECK comments (Anchor-only construct).
[N/A]       AV-004: as AV-003.
[N/A]       AV-005: no Account<'info, T> types.
[PARTIAL]   AV-006: token accounts are raw AccountInfo (src/tok_initialize.rs:41,43,45); mint/authority enforced only by the spl-token transfer CPI; bob_tokens unused. Improvement: unpack alice_tokens as spl_token::state::Account and assert mint.
[PARTIAL]   AV-007: token_mint is raw AccountInfo (src/tok_initialize.rs:46); spl-token initialize_account validates it; no in-program check.
[PARTIAL]   AV-008: token_program and self_program keys pinned (src/tok_initialize.rs:56-64); system_program (src/sol_initialize.rs:38; src/tok_initialize.rs:50) and rent_acc (:47) not compared to their IDs — substitution only fails the CPI.
[N/A]       AV-009: no typed accounts.
[PARTIAL]   AV-010: no declare_id!; program id only used via runtime arg and self_program comparison (src/tok_initialize.rs:61); README devnet id vs cli/local_deploy_keypair.json not reconcilable statically. Improvement: add declare_id! + check.
[FAIL-4]    AV-011: no discriminator on StreamFlow (src/utils.rs:28-46) → F-006.
              File: src/utils.rs:28-46
              Impact: token-stream metadata passes as a SOL stream
              Fix: 8-byte magic/version tag checked by every reader
[FAIL-4]    AV-012: identical layout for SOL and token streams; withdraw accepts either (src/sol_withdraw.rs:55-60) → F-006.
[N/A]       AV-013: no remaining_accounts.
[N/A]       AV-014: no remaining_accounts.
[N/A]       AV-015: no discriminators exist (covered by AV-011).
[FAIL-4]    AV-016: manual #[repr(C)] + unsafe byte copy without discriminator (src/utils.rs:52-54, src/sol_initialize.rs:97-98) → F-006.
[N/A]       AV-017: no account versioning/migration.
[PASS]      AV-018: every mutated account asserts is_writable (src/sol_initialize.rs:50-52; src/sol_withdraw.rs:51; src/sol_cancel.rs:37; src/tok_initialize.rs:70-79).
[FAIL-3]    AV-019: unused accounts required writable: lld (src/sol_withdraw.rs:51) and bob_tokens (src/tok_initialize.rs:74) → F-010.
              File: src/sol_withdraw.rs:51
              Impact: global write-lock on one account for every withdrawal
              Fix: drop or make read-only
[N/A]       AV-020: no Anchor has_one; runtime key binding evaluated at AC-003.
[PASS]      AV-021: runtime key equality present for every binding (src/sol_withdraw.rs:62; src/sol_cancel.rs:48,53).
[N/A]       AV-022: no Anchor init; manual creation evaluated at AV-054/AV-080.
[PASS]      AV-023: no init_if_needed; creation gated by data_is_empty() (src/sol_initialize.rs:46; src/tok_initialize.rs:66) and System create_account.
[N/A]       AV-024: init_if_needed not used.
[FAIL-4]    AV-025: manual close in cancel sends remains to the bound sender (src/sol_cancel.rs:48-51,71) ✓, but the completion-close path is disabled (src/sol_withdraw.rs:117-124) → F-007.
[PARTIAL]   AV-026: cancel drains lamports (src/sol_cancel.rs:69-71) without zeroing data or reassigning owner. Improvement: data.fill(0) + assign(system_program) before draining.
[N/A]       AV-027: no PDA seeds — stream accounts are client keypairs that must sign (src/sol_initialize.rs:54).
[N/A]       AV-028: no bumps.
[N/A]       AV-029: no Anchor constraints (generic ProgramError variants — see FV-055).
[N/A]       AV-030: no realloc.
[PARTIAL]   AV-031: no duplicate-mutable-account check (native); aliasing cases (bob==pda, alice==pda, bob==alice) analysed in worksheets — net-zero/self transfers only, but no explicit rejection (src/sol_withdraw.rs:36-38; src/sol_cancel.rs:33-35).
[N/A]       AV-032: no remaining_accounts.
[N/A]       AV-033: no remaining_accounts.
[N/A]       AV-034: no remaining_accounts.
[N/A]       AV-035: no remaining_accounts.
[N/A]       AV-036: no remaining_accounts.
[N/A]       AV-037: no remaining_accounts.
[N/A]       AV-038: no remaining_accounts.
[N/A]       AV-039: no remaining_accounts.
[PASS]      AV-040: space = size_of::<StreamFlow>() = 160 B, exactly the serialized struct (src/sol_initialize.rs:60,82; src/utils.rs:28-46); escrow uses Account::LEN (src/tok_initialize.rs:86).
[PARTIAL]   AV-041: account created with amount+rent then debited 2·lps (src/sol_initialize.rs:81,91) — below rent-exempt when amount < 2·lps (runtime rejects on current clusters). Improvement: require amount ≥ 2·lps; assert post-state ≥ minimum_balance.
[N/A]       AV-042: no variable-length fields.
[N/A]       AV-043: no realloc.
[N/A]       AV-044: no size changes.
[PARTIAL]   AV-045: alice_tokens/escrow mint match enforced only by the spl-token transfer CPI (src/tok_initialize.rs:162-169).
[FAIL-7]    AV-046: escrow authority set to the program ID (src/tok_initialize.rs:156) — unsignable by the program → F-002.
              File: src/tok_initialize.rs:156
              Impact: tokens permanently locked
              Fix: PDA authority + invoke_signed
[FAIL-7]    AV-047: vault is not owned by a PDA but by the program ID itself (src/tok_initialize.rs:156) → F-002.
[N/A]       AV-048: no ATAs (escrow is a fresh keypair account).
[N/A]       AV-049: delegate field not used.
[PARTIAL]   AV-050: frozen state never checked; escrow freezable by the mint's freeze authority (src/tok_initialize.rs:46) — moot until a token withdraw exists (F-002).
[N/A]       AV-051: no WSOL (native lamports used directly).
[PASS]      AV-052: token_program.key == spl_token::id() (src/tok_initialize.rs:56) — Token-2022 rejected.
[PASS]      AV-053: data_is_empty() gate + create_account (src/sol_initialize.rs:46,77; src/tok_initialize.rs:66,111,137).
[PASS]      AV-054: manual init gated by data_is_empty(); System create_account fails on funded/non-empty accounts (src/sol_initialize.rs:46,78).
[N/A]       AV-055: no PDA seeds; a purged keypair address can only be recreated with that keypair's signature and empty data.
[PARTIAL]   AV-056: cancel leaves data intact (src/sol_cancel.rs:69-71); same-tx revival needs attacker-funded lamports (gain ≤ own donation → net ≤ 0, quantified at KV-106). Improvement: zero data.
[PARTIAL]   AV-057: stale data readable later in the same tx after cancel; withdraw against the 0-lamport account wraps and fails the sum check. Improvement: zero data + owner reassign.
[PASS]      AV-058: classic Token program pinned (src/tok_initialize.rs:56); Token-2022 explicitly unsupported.
[N/A]       AV-059: no ATAs.
[PARTIAL]   AV-060: legacy spl_token::instruction::transfer (src/utils.rs:176) — acceptable for classic SPL only; transfer_checked would bind mint+decimals.
[N/A]       AV-061: no decimals-dependent math; raw base units stored (src/utils.rs:34).
[N/A]       AV-062: fee-on-transfer impossible — Token-2022 rejected (src/tok_initialize.rs:56).
[N/A]       AV-063: Token-2022 rejected.
[PARTIAL]   AV-064: any classic mint accepted; mint freeze authority could freeze the escrow; no allowlist (src/tok_initialize.rs:46).
[PARTIAL]   AV-065: freeze/mint authority status not considered (src/tok_initialize.rs:46).
[PARTIAL]   AV-066: no mint allowlist and freeze risk undocumented.
[N/A]       AV-067: escrow freshly initialised by the program — no delegate/close authority set (src/tok_initialize.rs:153-159).
[PASS]      AV-068: Clock/Rent/Fees via syscalls (src/sol_initialize.rs:65,71,90; src/sol_withdraw.rs:68; src/sol_cancel.rs:59; src/tok_initialize.rs:84,93,99).
[PARTIAL]   AV-069: rent_acc passed as raw AccountInfo (src/tok_initialize.rs:47) without an in-program id check; spl-token's Rent::from_account_info asserts the sysvar id.
[PASS]      AV-070: vesting time from Clock::get() (src/sol_withdraw.rs:68; src/sol_cancel.rs:59) — not forgeable.
[N/A]       AV-071: no instruction introspection.
[N/A]       AV-072: no introspection.
[N/A]       AV-073: no introspection.
[N/A]       AV-074: no introspection.
[PASS]      AV-075: privileged binding by stored-key equality (src/sol_withdraw.rs:62; src/sol_cancel.rs:48-56) and a hardcoded collector key (src/sol_withdraw.rs:45-49) — never by position alone.
[N/A]       AV-076: no PDAs.
[PASS]      AV-077: framework detected as native (entrypoint! src/lib.rs:33; no anchor-lang in Cargo.toml) — all guarantees treated as manual.
[PARTIAL]   AV-078: program-owned stream accounts owner-checked (src/sol_withdraw.rs:55; src/sol_cancel.rs:41); token-side accounts rely on spl-token checks (as AV-001).
[PASS]      AV-079: explicit is_signer on alice/bob/pda/data_acc/escrow_acc and is_writable on every mutated account (src/sol_initialize.rs:50-57; src/sol_withdraw.rs:51; src/sol_cancel.rs:37; src/tok_initialize.rs:70-81).
[FAIL-2]    AV-080: instruction_data[0] without length check (src/lib.rs:47) and unpack_account_data slices [0..128] without data_len() >= 128 (src/utils.rs:80-87) → F-016, F-017.
              File: src/lib.rs:47; src/utils.rs:80-87
              Impact: caller-triggered panic (own transaction only)
              Fix: .first().ok_or(..)?; length guard before unpack
[PASS]      AV-081: the only unsafe block (src/utils.rs:52-54) reads a padding-free #[repr(C)] struct by value; no input-driven pointer math.
[FAIL-4]    AV-082: no tag; owner + length not used to disambiguate SOL vs token metadata (src/utils.rs:78-89) → F-006.
[N/A]       AV-083: no Pinocchio / account resize.
[N/A]       AV-084: no token logic reimplemented; CPIs go to canonical SPL Token.
[PASS]      AV-085: no exact-balance assumptions; sufficiency checks use >= (src/sol_initialize.rs:66); cancel sweeps the live balance (src/sol_cancel.rs:69).
[PASS]      AV-086: no builtin/sysvar/precompile is required writable (system_program, rent_acc not flag-checked as writable); the unused writable lld is a plain wallet (handled at AV-019/F-010).
[PASS]      AV-087: created accounts are fresh client keypairs that must sign (src/sol_initialize.rs:54; src/tok_initialize.rs:75-78) — not attacker-predictable.
[PASS]      AV-088: no set_len/assume_init; the unsafe serializer reads a fully-initialised struct (src/utils.rs:52-54).
[N/A]       AV-089: no ComputeBudget introspection.
[N/A]       AV-090: no introspection or account-count assumptions beyond next_account_info (returns NotEnoughAccountKeys).
```

### Checklist 02 — Access Control (50)

```
[PASS]      AC-001: every value-moving instruction asserts a signer (src/sol_initialize.rs:53; src/sol_withdraw.rs:51; src/sol_cancel.rs:37; src/tok_initialize.rs:70).
[PASS]      AC-002: all four state-mutating handlers require a signer (same lines).
[PASS]      AC-003: signer bound to state by key equality — recipient (src/sol_withdraw.rs:62-65), sender (src/sol_cancel.rs:48-51).
[N/A]       AC-004: native program — manual is_signer is the only mechanism.
[PASS]      AC-005: every is_signer check is a hard early return with MissingRequiredSignature (src/sol_initialize.rs:50-57; src/sol_withdraw.rs:51-53; src/sol_cancel.rs:37-39; src/tok_initialize.rs:70-81).
[N/A]       AC-006: no admin/manager role.
[PASS]      AC-007: recipient instruction binds signer to sf.recipient (src/sol_withdraw.rs:62).
[N/A]       AC-008: no delegation.
[PASS]      AC-009: no third-party action path — withdraw needs the recipient's signature, cancel the sender's.
[PASS]      AC-010: no permissionless value-moving instruction; init moves only the caller's own funds (src/sol_initialize.rs:77-86).
[PASS]      AC-011: roles mapped — sender: ix 0, 2, 3; recipient: ix 1 (report §7).
[PASS]      AC-012: each instruction has exactly one role.
[N/A]       AC-013: no manager instructions.
[PASS]      AC-014: recipient impersonation blocked by is_signer + key equality (src/sol_withdraw.rs:51,62).
[PASS]      AC-015: no admin; the only fixed key is the passive collector DrFtx… (src/sol_withdraw.rs:45), which can only receive.
[PASS]      AC-016: collector cannot drain, pause or act — never a signer; payout code disabled (src/sol_withdraw.rs:117-124).
[PASS]      AC-017: no bypass path; every handler enforces its binding unconditionally.
[N/A]       AC-018: no manager.
[N/A]       AC-019: no manager.
[N/A]       AC-020: no funds/managers.
[PASS]      AC-021: recipient can only act on streams whose stored recipient equals their key (src/sol_withdraw.rs:62).
[N/A]       AC-022: no manager.
[N/A]       AC-023: no fees.
[N/A]       AC-024: no fees.
[PASS]      AC-025: collector key compared on every (would-be) payout path (src/sol_withdraw.rs:46).
[PASS]      AC-026: collector is a compile-time constant (src/sol_withdraw.rs:45).
[N/A]       AC-027: no platform fee.
[N/A]       AC-028: no ownership transfer instruction.
[N/A]       AC-029: no whitelist.
[N/A]       AC-030: no pause mechanism exists (see AC-035).
[N/A]       AC-031: no pause.
[N/A]       AC-032: no pause.
[N/A]       AC-033: no pause.
[N/A]       AC-034: no pause.
[PARTIAL]   AC-035: no emergency stop; admin-less bilateral design (adding a pause would introduce a trusted role) — recorded as a design trade-off, not scored (see OPS-045).
[PARTIAL]   AC-036: SPL escrow can be frozen by a mint freeze authority (src/tok_initialize.rs:46); SOL path unaffected.
[N/A]       AC-037: no shares mint.
[N/A]       AC-038: no shares mint.
[PASS]      AC-039: no PDAs; accounts are signer keypairs (KV-127 PASS).
[N/A]       AC-040: no funds/positions.
[PASS]      AC-041: no shared state between streams; nothing an attacker can mutate to block others (write-lock contention on lld is throughput only, F-010).
[PASS]      AC-042: cancel requires the stream's own sender signature (src/sol_cancel.rs:37,48).
[PASS]      AC-043: on-chain replay prevented by recent_blockhash; no off-chain signed-message scheme.
[N/A]       AC-044: no rate limits — none needed for bilateral streams.
[PASS]      AC-045: init costs the caller amount + rent from their own balance (src/sol_initialize.rs:66,81); no shared space.
[PASS]      AC-046: no authority context carries across instructions; each handler re-validates.
[PARTIAL]   AC-047: cancel does not zero data — stale record readable later in the same tx (src/sol_cancel.rs:45,69-71); no profitable path (revival must be attacker-funded).
[PASS]      AC-048: CPI targets are only System and SPL Token, which never call back.
[PASS]      AC-049: no re-entrant surface — trusted callees only (FP-1) (src/utils.rs:137,175; src/sol_initialize.rs:77; src/tok_initialize.rs:111,137).
[FAIL-2]    AC-050: invoke_signed with empty seed set &[&[]] (src/tok_initialize.rs:167 → src/utils.rs:185) — derives a meaningless zero-seed PDA; fails if on-curve → F-018.
              File: src/tok_initialize.rs:167
              Impact: instruction 3 may always fail; no security bypass
              Fix: use invoke
```

### Checklist 03 — Arithmetic Safety (63)

```
[FAIL-3]    AR-001: bare + on user amount: sf.amount + rent (src/sol_initialize.rs:66,81); += on lamports/withdrawn (src/sol_initialize.rs:92-93; src/sol_withdraw.rs:99,102; src/sol_cancel.rs:65,71; src/tok_initialize.rs:105,115,129) → F-011, F-008.
              File: src/sol_initialize.rs:66,81
              Impact: wrapped sum → inflated recorded amount (blocked by rent-exempt enforcement on current runtimes)
              Fix: checked_add
[FAIL-9]    AR-002: bare -: now - start (src/utils.rs:96); amount_unlocked - withdrawn (src/sol_withdraw.rs:71; src/sol_cancel.rs:63); amount - withdrawn (src/sol_withdraw.rs:75); lamport -= (src/sol_withdraw.rs:98; src/sol_cancel.rs:64,70; src/sol_initialize.rs:91; src/tok_initialize.rs:128) → F-001, F-005.
              File: src/utils.rs:96; src/sol_withdraw.rs:71
              Impact: recipient drains stream pre-start; cancel bricks pre-start
              Fix: guard now < start; checked_sub; overflow-checks = true
[FAIL-3]    AR-003: bare *: lamports_per_signature * 2 (src/sol_initialize.rs:91-93), lps * 4 / lps * 3 (src/tok_initialize.rs:105,115,128-129); f64 * (src/utils.rs:96) — operands small, hardening only → F-008.
[FAIL-3]    AR-004: division performed in f64 (src/utils.rs:96) — divisor end-start > 0 for program-written records; f64 division yields NaN/inf on zero instead of erroring → F-009.
[FAIL-3]    AR-005: bare operators throughout; zero checked_* calls in src/ (grep) → F-008.
[PASS]      AR-006: no saturating_* (grep zero hits in src/).
[PASS]      AR-007: no wrapping_* (grep zero hits).
[PASS]      AR-008: size_of::<StreamFlow>() and Account::LEN are compile-time constants (src/sol_initialize.rs:60; src/tok_initialize.rs:85-86).
[N/A]       AR-009: no Anchor space.
[FAIL-3]    AR-010: (now-start)/(end-start)*amount computed in f64, not u128 (src/utils.rs:96) → F-009.
[N/A]       AR-011: no share math.
[N/A]       AR-012: no fee math.
[FAIL-3]    AR-013: proportion (elapsed/duration)*amount in f64 (src/utils.rs:96) → F-009.
[N/A]       AR-014: no u128.
[N/A]       AR-015: no u128 → u64 casts.
[PASS]      AR-016: no as u32 casts (grep).
[PASS]      AR-017: only i64 → u64 (unix_timestamp as u64: src/sol_initialize.rs:71; src/sol_withdraw.rs:68; src/sol_cancel.rs:59; src/tok_initialize.rs:93); negative cluster time unreachable; no u64 → i64.
[PARTIAL]   AR-018: divisor end - start is non-zero for program-written records (src/utils.rs:101) but not asserted at the read site (src/utils.rs:96); attacker-created zeroed program-owned accounts give 0/0 → NaN → 0 (harmless; unsignable sender/recipient). Improvement: guard end > start in calculate_streamed.
[N/A]       AR-019: no share pricing.
[N/A]       AR-020: no share pricing.
[PASS]      AR-021: floor to 0 only while elapsed·amount < duration; nothing lost, becomes available later; post-end override pays the exact remainder (src/sol_withdraw.rs:74-76).
[N/A]       AR-022: no minting.
[PASS]      AR-023: floor rounding favors the locked side during the stream; exact remainder at end — consistent with escrow purpose.
[PASS]      AR-024: no cumulative rounding — each call recomputes absolutely from calculate_streamed(now) and stored withdrawn (src/sol_withdraw.rs:70-71); error ≤ 1 lamport, non-cumulative (F-004 loss is accounting, not rounding).
[N/A]       AR-025: no shares.
[N/A]       AR-026: no share math.
[N/A]       AR-027: no share math.
[N/A]       AR-028: no share math.
[N/A]       AR-029: no share math.
[N/A]       AR-030: no share math.
[N/A]       AR-031: no share math.
[N/A]       AR-032: no share math.
[N/A]       AR-033: no share math.
[N/A]       AR-034: no share math.
[N/A]       AR-035: no fees.
[N/A]       AR-036: no fees.
[N/A]       AR-037: no fees.
[N/A]       AR-038: no fees.
[N/A]       AR-039: no fees.
[N/A]       AR-040: no fees.
[N/A]       AR-041: no fees.
[N/A]       AR-042: no fees.
[N/A]       AR-043: no fees.
[N/A]       AR-062: no fee components.
[N/A]       AR-044: no NAV.
[N/A]       AR-045: no NAV.
[N/A]       AR-046: no NAV.
[N/A]       AR-047: no NAV.
[N/A]       AR-048: no NAV.
[N/A]       AR-049: no NAV.
[N/A]       AR-050: no NAV.
[PASS]      AR-051: all lamport values are u64 (src/utils.rs:30-36; handlers) — no narrowing.
[PARTIAL]   AR-052: init checks alice.lamports() >= amount + rent (src/sol_initialize.rs:66) but not the tx fee; withdraw checks requested <= available, not requested <= pda.lamports() (src/sol_withdraw.rs:83) — relies on runtime balance/sum rules when available is wrong (F-001).
[PARTIAL]   AR-053: nothing asserts pda.lamports() >= rent after a partial withdraw (src/sol_withdraw.rs:98) or after the init gift (src/sol_initialize.rs:91); runtime rejects sub-rent non-zero balances (backstop, not program logic).
[PARTIAL]   AR-054: withdraw can take the escrow to any balance including 0 (implicit close) or below rent-exempt (runtime-rejected) — no explicit policy (src/sol_withdraw.rs:98).
[N/A]       AR-055: no WSOL.
[FAIL-3]    AR-056: amount = u64::MAX → amount + rent wraps (src/sol_initialize.rs:66,81) → F-011; end_time = u64::MAX handled; requested = u64::MAX rejected unless available wrapped (F-001).
[PARTIAL]   AR-057: requested = 0 means "all" (src/sol_withdraw.rs:79-81) ✓; amount = 0 stream not rejected at init (src/sol_initialize.rs:59-74) and yields withdrawn > amount → wrap at src/sol_withdraw.rs:75 (F-001 root cause). Improvement: require amount > 2·lps.
[PARTIAL]   AR-058: 1-lamport stream: init gift 2·lps exceeds amount (src/sol_initialize.rs:91-93) → withdrawn > amount → wrap path; no minimum enforced.
[N/A]       AR-059: no shares.
[N/A]       AR-060: no multi-investor batch.
[PARTIAL]   AR-061: unix_timestamp cast to u64 is fine; all subsequent time subtraction is unchecked (src/utils.rs:96) → F-001/F-005.
[FAIL-3]    AR-063: f64 in the value path with as f64 / as u64 boundary casts (src/utils.rs:96) → F-009.
              File: src/utils.rs:96
              Impact: precision loss above 2^53 lamports; saturation semantics exploited by F-001
              Fix: u128 mul-then-div
```

### Checklist 04 — CPI & PDA (70)

```
[N/A]       CPI-001: no CpiContext (native invoke).
[N/A]       CPI-002: no CpiContext.
[PASS]      CPI-003: token_program.key == spl_token::id() before both token CPIs (src/tok_initialize.rs:56-59).
[PARTIAL]   CPI-004: system_program account not compared to system_program::ID (src/sol_initialize.rs:38; src/tok_initialize.rs:50); the CPI program id is fixed by system_instruction::create_account so substitution only fails the CPI. Improvement: assert the key.
[N/A]       CPI-005: no Associated Token program.
[N/A]       CPI-006: no DEX.
[N/A]       CPI-007: no Metaplex.
[PASS]      CPI-008: no CPI uses a caller-chosen program id: System id SDK-fixed, Token id pinned (src/tok_initialize.rs:56).
[N/A]       CPI-009: no remaining_accounts.
[PASS]      CPI-010: invoke_signed target = token_program.key pinned to spl_token::id() (src/utils.rs:177; src/tok_initialize.rs:56).
[PASS]      CPI-011: transfer from = alice_tokens (sender's account; spl-token checks the authority signed) (src/tok_initialize.rs:163).
[PASS]      CPI-012: transfer to = escrow_acc created and initialised by the program in the same instruction (src/tok_initialize.rs:137-159,164).
[FAIL-7]    CPI-013: escrow authority = program ID (src/tok_initialize.rs:156) — no future transfer out is signable → F-002; deposit-side authority alice_authority (:166) is correct.
              File: src/tok_initialize.rs:156
              Impact: permanent token lock
              Fix: PDA authority
[PASS]      CPI-014: amount = sf.amount from the instruction, the value recorded in metadata (src/tok_initialize.rs:91,165).
[N/A]       CPI-015: no mint_to.
[N/A]       CPI-016: no mint_to.
[N/A]       CPI-017: no mint_to.
[N/A]       CPI-018: no mint_to.
[N/A]       CPI-019: no burn.
[N/A]       CPI-020: no burn.
[N/A]       CPI-021: no burn.
[N/A]       CPI-022: no close_account CPI.
[N/A]       CPI-023: no close_account CPI.
[N/A]       CPI-024: no close_account CPI.
[PASS]      CPI-025: create_account source = signer alice, destination = signer/empty pda (src/sol_initialize.rs:78-85; src/tok_initialize.rs:112-123,138-149); withdraw/cancel lamport moves are direct and bound to stored keys.
[N/A]       CPI-026: no approve.
[N/A]       CPI-027: no revoke.
[N/A]       PDA-001: no PDAs — stream/escrow accounts are client keypairs that must sign (src/sol_initialize.rs:54; src/tok_initialize.rs:75-78); find_program_address/create_program_address: zero hits in src/.
[N/A]       PDA-002: no PDAs.
[N/A]       PDA-003: no PDAs.
[N/A]       PDA-004: no PDAs.
[N/A]       PDA-005: no PDAs.
[N/A]       PDA-006: no PDAs.
[N/A]       PDA-007: no PDAs.
[N/A]       PDA-008: no PDAs.
[N/A]       PDA-009: no PDAs.
[N/A]       PDA-010: no bumps.
[N/A]       PDA-011: no seeds.
[N/A]       PDA-012: no seeds.
[N/A]       PDA-013: no seeds.
[FAIL-2]    PDA-014: invoke_signed seeds &[&[]] (src/tok_initialize.rs:167; src/utils.rs:185) — no PDA authority exists; empty seed set meaningless and may fail on-curve → F-018.
              File: src/tok_initialize.rs:167
              Impact: instruction 3 may be unusable; no bypass
              Fix: invoke
[N/A]       PDA-015: no derivation to match.
[N/A]       PDA-016: no bump.
[N/A]       PDA-017: no PDA authority.
[PASS]      PDA-018: no path needs a PDA signature; the single invoke_signed should be a plain invoke (F-018).
[PASS]      PDA-019: CPI instruction data fully program-built from validated values (src/sol_initialize.rs:78; src/tok_initialize.rs:112,138; src/utils.rs:138,176).
[N/A]       PDA-020: no Jupiter.
[N/A]       PDA-021: no realloc.
[N/A]       EXT-001: no Jupiter.
[N/A]       EXT-002: no Jupiter.
[N/A]       EXT-003: no Jupiter.
[N/A]       EXT-004: no Jupiter.
[N/A]       EXT-005: no Jupiter.
[N/A]       EXT-006: no Jupiter.
[N/A]       EXT-007: no Metaplex.
[N/A]       EXT-008: no Metaplex.
[N/A]       EXT-009: no whitelist/protocol CPI.
[N/A]       EXT-010: no whitelist.
[PASS]      EXT-011: only System/SPL Token callees — no callback capability.
[N/A]       EXT-012: Token-2022 rejected (src/tok_initialize.rs:56).
[PARTIAL]   EXT-013: freeze authority not inspected for accepted classic mints (src/tok_initialize.rs:46); PermanentDelegate/MintClose are Token-2022-only (rejected).
[PARTIAL]   EXT-014: legacy transfer + declared-amount accounting (src/tok_initialize.rs:162-169) — correct for classic SPL; no balance-delta check.
[N/A]       EXT-015: program creates no mint.
[PARTIAL]   RE-001: metadata written after the create_account CPI (necessarily) (src/sol_initialize.rs:77-98) and between CPIs (src/tok_initialize.rs:132-134); callees trusted (FP-1) — no exploitable ordering.
[PASS]      RE-002: no pre-CPI account-data copy is reused after a CPI; sf is built from the instruction (src/sol_initialize.rs:59; src/tok_initialize.rs:91).
[N/A]       RE-003: no .reload() (native); no post-CPI account reads.
[PASS]      RE-004: no approve CPI.
[PASS]      RE-005: no flash-loan surface (no shares/NAV); withdraw pays only time-unlocked lamports (src/sol_withdraw.rs:70-96) — F-001 is an arithmetic bug, not a flash-loan path.
[PASS]      RE-006: signing accounts passed only to System/SPL Token with program-built instructions spending exactly the computed amounts (src/sol_initialize.rs:81; src/tok_initialize.rs:115,141,165).
[PASS]      RE-007: after create_account the program does not re-check pda.owner (src/sol_initialize.rs:96) but the callee is the System Program with a fixed instruction setting owner = pid (:83); no untrusted callee can assign.
```

### Checklist 05 — State Machine & Lifecycle (72)

```
[N/A]       SM-001: no state enum; lifecycle is implicit (Created → Streaming → Completed | Cancelled) — see §8.
[N/A]       SM-002: no enum variants.
[PASS]      SM-003: every implicit state is reachable: Created (ix 0/3), Streaming (time), Completed (ix 1 after end), Cancelled (ix 2).
[PARTIAL]   SM-004: Completed has no transition out — the account is never closed (src/sol_withdraw.rs:117-124) → F-007.
[N/A]       SM-005: no dead variants.
[PASS]      SM-006: only the owner program can write account data (runtime); attacker-created zeroed program-owned accounts carry unsignable zero keys.
[PARTIAL]   SM-007: terminal "Completed" is only implicit (withdrawn == amount); intent visible in disabled code (src/sol_withdraw.rs:117-124).
[FAIL-4]    SM-008: terminal-state accounts are never closed; rent stranded (src/sol_withdraw.rs:117-124) → F-007.
              File: src/sol_withdraw.rs:117-124
              Impact: ~2,004,480 lamports per completed stream locked or misrouted
              Fix: close on final withdrawal
[N/A]       SM-009: single-step withdrawal — no initiation state.
[PASS]      SM-010: withdraw requires the recipient signer and a program-owned stream (src/sol_withdraw.rs:51,55,62).
[N/A]       SM-011: no conversion step.
[N/A]       SM-012: no conversion step.
[N/A]       SM-013: no readiness step (single-step design).
[N/A]       SM-014: readiness step not required by design.
[N/A]       SM-015: no finalization step.
[FAIL-4]    SM-016: final withdrawal does not close the account or return rent (src/sol_withdraw.rs:117-124) → F-007.
[PASS]      SM-017: withdrawal transfers lamports to the recipient (src/sol_withdraw.rs:98-99).
[PARTIAL]   SM-018: cancel allowed in every phase including after completion, where it over-pays from rent or fails (src/sol_cancel.rs:62-65) → F-007.
[PASS]      SM-019: cancel pays the recipient the unlocked part and the sender the rest for start ≤ now ≤ end (src/sol_cancel.rs:62-71).
[PASS]      SM-020: cancel drains to 0 → account purged (src/sol_cancel.rs:69-71).
[N/A]       SM-021: no withdrawal objects; repeated withdraws are the design.
[N/A]       SM-022: no timeout concept.
[PASS]      SM-023: no admin step can strand a recipient — withdraw is available once now ≥ start (src/sol_withdraw.rs); sender-side pre-start cancel is F-005.
[FAIL-5]    SM-024: partial withdrawal supported but mis-accounted — withdrawn += available (src/sol_withdraw.rs:102) → F-004.
              File: src/sol_withdraw.rs:102
              Impact: recipient forfeits available − requested
              Fix: += requested
[PARTIAL]   SM-025: init writes all fields (src/utils.rs:64-73; src/sol_initialize.rs:96-98) but escrow = mint key (src/utils.rs:72) — data-quality defect.
[PARTIAL]   SM-026: mint field = bob.key for SOL streams (src/sol_initialize.rs:59); README says zeros.
[PASS]      SM-027: reinit blocked (src/sol_initialize.rs:46; System create_account).
[PARTIAL]   SM-028: closure exists (cancel; preconditions: sender signer, src/sol_cancel.rs:37-51) but fails before start (F-005).
[N/A]       SM-029: no positions.
[N/A]       SM-030: no pending withdrawals.
[PARTIAL]   SM-031: closure exists for the active state (cancel) but not for the completed state → F-007.
[N/A]       SM-032: no names/PDAs.
[N/A]       SM-033: no deposits/shares.
[N/A]       SM-034: no shares.
[N/A]       SM-035: no positions.
[FAIL-5]    SM-036: the analogous tracking field withdrawn is mis-updated (src/sol_withdraw.rs:102) → F-004.
[N/A]       SM-037: no positions.
[FAIL-9]    SM-038: available = unlocked − withdrawn underflows (src/sol_withdraw.rs:71; src/utils.rs:96) → F-001.
              File: src/sol_withdraw.rs:71
              Impact: full pre-vesting drain
              Fix: checked_sub + now < start guard
[N/A]       SM-039: no positions.
[N/A]       SM-040: no positions.
[FAIL-5]    SM-041: transitions do not check the current phase — withdraw/cancel run before start with no now >= start guard (src/sol_withdraw.rs:68-71; src/sol_cancel.rs:59-63) → F-005 (and F-001).
              File: src/sol_cancel.rs:59-63
              Impact: cancel bricked pre-start; withdraw drains pre-start
              Fix: phase guard in calculate_streamed
[PASS]      SM-042: no skippable multi-step states (single-step design).
[PASS]      SM-043: each transition is one instruction (atomic).
[PASS]      SM-044: Solana atomic rollback (FP-4); no cross-transaction half-states.
[PASS]      SM-045: repeated withdraw bounded by withdrawn accounting within [start, end] (src/sol_withdraw.rs:71,102); repeated cancel impossible (account purged).
[N/A]       SM-046: no PDA seeds.
[PARTIAL]   SM-047: msg! logs only, no structured events (src/sol_initialize.rs:100-108; src/sol_withdraw.rs:106-115; src/sol_cancel.rs:73-85) — checklist 17 out of scope.
[PARTIAL]   SM-048: logs include amounts and parties but no timestamps; free-text format.
[PASS]      SM-049: logs are emitted by program execution only.
[PARTIAL]   SM-050: cli/watchprogram.py:17 (out of scope) parses a positional log line — brittle; on-chain state must be authoritative (KV-122).
[N/A]       SM-051: no shares.
[N/A]       SM-052: no shares.
[PARTIAL]   SM-053: the analogous invariant pda.lamports >= amount − withdrawn + rent is not enforced (F-011 wrap at init; runtime backstop).
[N/A]       SM-054: no shares/assets tracking.
[N/A]       SM-055: no shares/assets tracking.
[N/A]       SM-056: no swaps.
[PASS]      SM-057: no zero-sentinel timestamps; start > now and end > start validated at init (src/utils.rs:101).
[N/A]       SM-058: no sentinel.
[PARTIAL]   SM-059: two terminal paths implemented inconsistently (cancel drain src/sol_cancel.rs:69-71 vs disabled collector close src/sol_withdraw.rs:117-124) → F-007.
[FAIL-4]    SM-060: terminal Completed via withdraw never drains/closes → F-007.
[PARTIAL]   SM-061: cancel drains without zeroing accounting; no post-drain invariant check (src/sol_cancel.rs:64-71).
[PARTIAL]   SM-062: the now >= end full-unlock gate exists only in withdraw (src/sol_withdraw.rs:74-76), not in cancel (src/sol_cancel.rs:62-63) — duplicated, divergent time-gate math → F-007.
[FAIL-4]    SM-063: cancel after end computes available from a ratio > 1 (overlap) → over-pays from rent or fails (src/sol_cancel.rs:62-65) → F-007.
[N/A]       SM-064: no explicit state machine / transition matrix.
[PASS]      SM-065: cancelled streams are purged (absorbing); completed streams cannot un-complete (withdrawn only grows, src/sol_withdraw.rs:102).
[PASS]      SM-066: no admin; sender/recipient cannot rewrite lifecycle fields (only the program writes derived values).
[N/A]       SM-067: no sub-state.
[N/A]       SM-068: no fixed-slot collections.
[N/A]       SM-069: no cached aggregates.
[FAIL-9]    SM-070: raw now − start with no now < start guard (src/utils.rs:96) — on a wrapping build unlocks the entire schedule → F-001; on a checked build bricks cancel → F-005.
              File: src/utils.rs:96
              Impact: pre-vesting drain / cancel DoS
              Fix: early-return 0 when now <= start; checked_sub
[PASS]      SM-071: all time values are unix seconds — Clock::get()?.unix_timestamp vs stored start_time/end_time (src/sol_withdraw.rs:68; src/utils.rs:96; README.md:52-53).
[PARTIAL]   SM-072: no cliff concept (linear from start); pre-start claim is not zero (F-001); no boundary tests (tests/*.rs) → FV-060.
```

### Checklist 06 — Economic & Logic (89)

```
[N/A]       ECON-001: feature absent — no flash-loan/shares/NAV surface (zero hits: flash, shares, vault, mint_to).
[N/A]       ECON-002: feature absent (no deposit→withdraw share cycle).
[N/A]       ECON-003: feature absent.
[N/A]       ECON-004: feature absent.
[N/A]       ECON-005: feature absent (no NAV).
[N/A]       ECON-006: no swaps/DEX.
[N/A]       ECON-007: no swaps.
[N/A]       ECON-008: no swaps.
[N/A]       ECON-009: deposits are not price-sensitive (fixed lamport escrow).
[N/A]       ECON-010: withdrawals are not price-sensitive.
[PARTIAL]   ECON-011: no minimum stream amount; dust streams (< 2·lps) break accounting (withdrawn > amount, src/sol_initialize.rs:91-93) — F-001 root cause / AR-058.
[PARTIAL]   ECON-012: no minimum withdrawal; requested = 0 means all (src/sol_withdraw.rs:78-81); partial withdrawals lose funds (F-004).
[N/A]       ECON-013: no shares.
[N/A]       ECON-014: no shares.
[N/A]       ECON-015: no shares.
[N/A]       ECON-016: no shares.
[N/A]       ECON-017: no shares.
[N/A]       ECON-018: no NAV.
[N/A]       ECON-019: no NAV.
[N/A]       ECON-020: no NAV.
[N/A]       ECON-021: no NAV.
[N/A]       ECON-022: no NAV.
[N/A]       ECON-023: no NAV.
[N/A]       ECON-024: no NAV.
[N/A]       ECON-025: no NAV.
[N/A]       ECON-026: no fees.
[N/A]       ECON-027: no fees.
[N/A]       ECON-028: no fees.
[N/A]       ECON-029: no fees/trades.
[N/A]       ECON-030: no fees.
[N/A]       ECON-031: no fees.
[N/A]       ECON-032: no fees.
[N/A]       ECON-033: no fees.
[N/A]       ECON-034: no manager.
[N/A]       ECON-035: no manager.
[N/A]       ECON-036: no pda_token_transfer.
[N/A]       ECON-037: no pda_lamports_transfer instruction (lamport moves are bound to stored keys, AC-003).
[N/A]       ECON-038: no approve.
[N/A]       ECON-039: no swaps.
[N/A]       ECON-040: no protocol CPI.
[N/A]       ECON-041: no whitelist.
[N/A]       ECON-042: no whitelist.
[N/A]       ECON-043: no manager to protect against.
[N/A]       ECON-044: Token-2022 rejected (src/tok_initialize.rs:56).
[N/A]       ECON-045: classic SPL has no fee-on-transfer.
[N/A]       ECON-046: no rebasing on classic SPL; amount stored raw.
[PARTIAL]   ECON-047: freeze authority can freeze the escrow (src/tok_initialize.rs:46) — no check; moot while no token withdraw exists (F-002).
[N/A]       ECON-048: supply inflation does not affect a fixed-amount escrow.
[PASS]      ECON-049: raw base units throughout; decimals irrelevant (src/utils.rs:34; src/tok_initialize.rs:165).
[N/A]       ECON-050: no WSOL.
[PASS]      ECON-051: no loops/bloat; fixed 160-byte accounts; per-stream isolation.
[N/A]       ECON-052: no batch operations.
[N/A]       ECON-053: no remaining_accounts.
[PASS]      ECON-054: every stream costs its creator rent + amount (src/sol_initialize.rs:66); no shared state grows.
[PASS]      ECON-055: no Vec/array in state (src/utils.rs:28-46).
[FAIL-7]    ECON-056: funds can be locked — token streams permanently (src/tok_initialize.rs:156; src/lib.rs:54-55) → F-002; SOL streams until start (F-005).
              File: src/tok_initialize.rs:156
              Impact: permanent lock of streamed tokens
              Fix: disable ix 3 / PDA authority
[N/A]       ECON-057: feature absent — no oracle (zero hits: pyth, switchboard, oracle).
[N/A]       ECON-058: feature absent.
[N/A]       ECON-059: feature absent.
[N/A]       ECON-060: feature absent.
[N/A]       ECON-061: feature absent.
[N/A]       ECON-062: no pricing at all — no NAV trust assumption to document.
[N/A]       ECON-071: no randomness.
[N/A]       ECON-063: no staking/rewards.
[N/A]       ECON-064: no staking/rewards.
[N/A]       ECON-065: no staking/rewards.
[N/A]       ECON-066: no staking/rewards.
[N/A]       ECON-067: no staking/rewards.
[N/A]       ECON-068: no staking/rewards.
[N/A]       ECON-069: no staking/rewards.
[N/A]       ECON-070: no staking/rewards.
[PARTIAL]   ECON-072: no aggregate outflow breaker or pause; per-stream isolation bounds each drain to one stream but F-001 applies to every stream; admin-less design (adding a guardian is a trust trade-off).
[N/A]       ECON-073: no PnL/collateral.
[N/A]       ECON-074: no reserves/counterparties.
[PARTIAL]   ECON-089: no circuit breaker / guardian pause (as ECON-072).
[N/A]       ECON-075: no swaps/slippage.
[N/A]       ECON-076: no fees.
[N/A]       ECON-077: no fees.
[N/A]       ECON-078: no swap code.
[N/A]       ECON-079: feature absent — no bonding curve.
[N/A]       ECON-080: feature absent.
[N/A]       ECON-081: feature absent.
[FAIL-7]    ECON-082: the SPL escrow has no withdrawal path (src/lib.rs:54-55) and an unsignable authority (src/tok_initialize.rs:156) → F-002.
[FAIL-9]    ECON-083: cumulative-cap check bypassed when available wraps (src/sol_withdraw.rs:71,83) → F-001; running total mis-tracked (:102) → F-004.
              File: src/sol_withdraw.rs:71,83,102
              Impact: cap bypass (drain) and over-counting
              Fix: checked math + withdrawn += requested
[PARTIAL]   ECON-084: cancel's residual sweep to the sender happens after paying the recipient (src/sol_cancel.rs:62-71) ✓ but with wrong post-end math (F-007) and pre-start failure (F-005).
[N/A]       ECON-085: feature absent — no TWAP.
[N/A]       ECON-086: feature absent.
[N/A]       ECON-087: feature absent.
[N/A]       ECON-088: feature absent.
```

### Checklist 07 — OpSec & Governance (85)

```
[UNKNOWN]   OPS-001: cannot run solana program show (static-only engagement); devnet ID 2DvvSEde36Ch3B52g9hKWDYbfmJimLpJwVBV9Cknypi4 (README.md:22); mainnet not deployed (README.md:20) — manual follow-up.
[FAIL-3]    OPS-002: no multisig evidence; cli/deploy.sh:7 deploys from a developer shell with the default CLI keypair as authority → F-014 (assumption-based; 8+ if a single hot wallet is confirmed on a funded deployment).
              File: cli/deploy.sh:7
              Impact: single-key upgrade → total drain capability
              Fix: Squads multisig + timelock before mainnet
[N/A]       OPS-003: no multisig.
[N/A]       OPS-004: no multisig.
[N/A]       OPS-005: no multisig.
[FAIL-3]    OPS-006: no timelock on upgrades (no governance code; direct deploy.sh) → F-014.
[N/A]       OPS-007: no timelock.
[FAIL-3]    OPS-008: no timelock (recommended ≥ 24 h) → F-014.
[UNKNOWN]   OPS-009: authority-change process undocumented; on-chain state not checkable offline.
[PARTIAL]   OPS-010: not immutable; no documented reasoning (README.md has no upgrade policy).
[PARTIAL]   OPS-011: yes — a malicious upgrade could drain every program-owned stream account; mitigations (OPS-002/006) absent.
[N/A]       OPS-012: no timelock to bypass.
[PASS]      OPS-013: one hardcoded pubkey (DrFtx…, src/sol_withdraw.rs:45), documented (README.md:77-78; cli/strfi.js:175-178), passive recipient only.
[PASS]      OPS-014: no god-mode account; every handler enforces stored-key binding (src/sol_withdraw.rs:62; src/sol_cancel.rs:48-56).
[PASS]      OPS-015: the single key comparison (src/sol_withdraw.rs:46) is a documented sink check, not a hidden privilege.
[FAIL-7]    OPS-016: reachable half-implemented handler tok_initialize_stream (src/lib.rs:53) with no counterpart withdraw/cancel (:54-55) → F-002.
              File: src/lib.rs:53-55
              Impact: users can lock tokens forever
              Fix: remove from dispatcher until complete
[PARTIAL]   OPS-017: no IDL (native); README documents instructions 0–2 but omits instruction 3 (README.md:35-98 vs src/lib.rs:53).
[PASS]      OPS-018: treasury/rent collector is a compile-time constant; no instruction modifies it (src/sol_withdraw.rs:45).
[N/A]       OPS-019: no DEX.
[N/A]       OPS-020: no manager.
[N/A]       OPS-021: no shares.
[N/A]       OPS-022: no shares.
[PARTIAL]   OPS-023: one unsafe fn any_as_u8_slice (src/utils.rs:52-54) — sound for the padding-free #[repr(C)] struct but its # Safety doc is ":)" (:49-51).
[PARTIAL]   OPS-024: raw pointer cast + from_raw_parts (src/utils.rs:53) used for serialization; recommend bytemuck/borsh.
[PARTIAL]   OPS-025: no declare_id!, no Anchor.toml; deploy keypair (cli/local_deploy_keypair.json) vs README ID not reconcilable statically (AV-010).
[FAIL-3]    OPS-026: verification procedure exists (verification.md, verify_deployment.sh) but the script is non-functional: tr -d'"' (:25), tag 0.1.1 vs v0.1.1 (:25-26 vs verification.md:18), always dumps devnet (:30) → F-012.
              File: verify_deployment.sh:25,26,30
              Impact: deployed binary cannot be verified; mainnet check would compare devnet
              Fix: correct the script / solana-verify
[UNKNOWN]   OPS-027: hardware-wallet use not determinable; deploy.sh uses the CLI default signer.
[FAIL-6]    OPS-028: program-ID keypair committed: cli/local_deploy_keypair.json (64-int array), used by cli/deploy.sh:7 → F-003; .gitignore has only target (:1) → F-019.
              File: cli/local_deploy_keypair.json:1
              Impact: program-ID squatting; token-escrow control if the deployed ID matches (UNDETERMINED)
              Fix: purge + rotate + gitignore + secret scanner
[N/A]       OPS-029: no manager wallets.
[N/A]       OPS-030: no backend.
[N/A]       OPS-031: no backend.
[N/A]       OPS-032: no API keys.
[N/A]       OPS-033: no API keys.
[N/A]       OPS-034: no backend RPC (clients use public endpoints; out of scope).
[N/A]       OPS-035: no frontend.
[FAIL-6]    OPS-036: git ls-files shows cli/local_deploy_keypair.json tracked (added 673f964, 2021-10-03) → F-003; devnet test keypairs embedded in examples/strfi.rs:37-51 and cli/strfi.js:40-59 (out-of-scope clients — note).
[N/A]       OPS-037: no multisig.
[N/A]       OPS-038: no multisig.
[N/A]       OPS-039: no multisig.
[N/A]       OPS-040: no multisig.
[N/A]       OPS-041: no multisig.
[N/A]       OPS-042: no multisig.
[N/A]       OPS-043: no multisig.
[FAIL-2]    OPS-044: no incident-response document in the repository → F-020.
[PARTIAL]   OPS-045: no pause; only an upgrade can stop the program (AC-035).
[FAIL-2]    OPS-046: no bug bounty / SECURITY.md → F-020.
[FAIL-2]    OPS-047: no security contact (Cargo.toml:6 lists hello@ only) → F-020.
[PARTIAL]   OPS-048: cli/watchprogram.py subscribes to program logs (out-of-scope script; prints one positional field, hardcodes a different program ID) — no alerting.
[FAIL-2]    OPS-049: no upgrade-transaction monitoring → F-020.
[PARTIAL]   OPS-050: watchprogram.py only; no pattern alerting.
[FAIL-2]    OPS-051: no war-room process → F-020.
[FAIL-2]    OPS-052: no post-mortem process → F-020.
[PASS]      OPS-053: enumerated: no admin actions exist to time-lock; the only time gate is the stream schedule (src/utils.rs:96).
[FAIL-3]    OPS-054: upgrades — no timelock → F-014.
[N/A]       OPS-055: no fees.
[N/A]       OPS-056: no manager.
[N/A]       OPS-057: no whitelist.
[PASS]      OPS-058: treasury/rent collector immutable (compile-time constant, src/sol_withdraw.rs:45).
[N/A]       OPS-059: no timelock.
[N/A]       OPS-060: no timelock.
[N/A]       OPS-061: no timelock.
[PARTIAL]   OPS-062: cli/deploy.sh uses one "local" keypair; no environment separation documented; test keys hardcoded in clients.
[FAIL-3]    OPS-063: deploy.sh is a personal-machine deploy (cli/deploy.sh:4-12) → F-014 (devnet-only per README).
[PASS]      OPS-064: CI does not deploy (rust-tests.yml: build + test only).
[N/A]       OPS-065: no servers.
[N/A]       OPS-066: no database.
[PASS]      OPS-067: CI workflow has no secrets/env keys (rust-tests.yml:1-29).
[N/A]       OPS-068: no secrets to manage beyond the deploy keypair (in-repo — F-003).
[PASS]      OPS-069: AGPL-3.0 open source (Cargo.toml:9; LICENSE).
[FAIL-3]    OPS-070: verification path documented but broken (verify_deployment.sh) → F-012; not verified on an explorer.
[PARTIAL]   OPS-071: build uses cargo build-bpf on an unpinned "beta" toolchain (rust-tests.yml:23; verification.md:19); no rust-toolchain file — reproducibility not pinned (F-013).
[UNKNOWN]   OPS-072: local clone has a single commit 673f964 — history unavailable for force-push analysis.
[UNKNOWN]   OPS-073: branch protection not determinable offline (assumed none, intake Q30).
[FAIL-3]    OPS-074: CI runs on pull_request with curl -sSfL https://release.solana.com/beta/install | sh (rust-tests.yml:23) and unpinned actions/checkout@v2, actions-rs/toolchain@v1 (:13,15) → F-013.
              File: .github/workflows/rust-tests.yml:13,15,23
              Impact: PR/toolchain-channel can alter the build
              Fix: pin SHAs and release version; add cargo audit
[PARTIAL]   OPS-075: caret ranges in Cargo.toml:13-19 resolved by the committed Cargo.lock (solana-program 1.7.3: Cargo.lock:2968-2969; spl-token 3.1.1: :3314-3315) — reproducible, but a 2021 unmaintained line.
[N/A]       OPS-076: no stake accounts.
[N/A]       OPS-077: no admin/governance instructions.
[N/A]       OPS-085: no multisig council.
[N/A]       OPS-078: no admin authority to rotate.
[FAIL-4]    OPS-079: fee/treasury sweep path disabled (src/sol_withdraw.rs:117-124); rent has no recovery route after completion → F-007.
              File: src/sol_withdraw.rs:117-124
              Impact: rent stranded per stream
              Fix: implement close/sweep
[N/A]       OPS-080: no config-update API.
[N/A]       OPS-081: no multisig.
[PARTIAL]   OPS-082: per-stream params bounded (start > now, end > start: src/utils.rs:101) but no minimum amount (> 2·lps) and no maximum duration (AR-058/F-001).
[PASS]      OPS-083: start/end cross-validated together at write time from the instruction params (src/utils.rs:100-111).
[PARTIAL]   OPS-084: end − start == 0 rejected at init (src/utils.rs:101) so the divisor is non-zero for program-written records; not re-asserted at the read site (src/utils.rs:96).
```

### Checklist 16 — Formal Verification & Testing (72)

```
[FAIL-3]    FV-001: no documented invariants (README.md describes layout only) → F-015.
              File: README.md; tests/
              Impact: paid ≤ unlocked and conservation are neither stated nor tested (both violated: F-001, F-004)
              Fix: document + encode as tests
[FAIL-3]    FV-002: no invariant assertions/property tests → F-015.
[FAIL-3]    FV-003: vesting identity streamed(now) ∈ [0, amount] neither proven nor tested; violated (F-001) → F-015.
[FAIL-3]    FV-004: no transition properties specified → F-015.
[FAIL-3]    FV-005: reachable states violate the intended invariants (F-001, F-005); no model checking/fuzzing → F-015.
[FAIL-3]    FV-006: conservation (paid_to_bob + returned_to_alice + rent == deposit) untested; violated by F-004/F-007 → F-015.
[PARTIAL]   FV-007: authority checks exist in code (AC-003) but no test exercises a wrong signer (tests/*.rs).
[FAIL-5]    FV-008: liveness violated — cancel before start cannot complete (F-005); token streams never complete (F-002).
              File: src/sol_cancel.rs:62-65; src/lib.rs:54-55
              Impact: initiated processes cannot reach completion
              Fix: F-001 guard; complete or remove ix 3
[N/A]       FV-009: no formal spec.
[N/A]       FV-010: no proofs claimed.
[N/A]       FV-011: no FV properties.
[N/A]       FV-012: no verification results to include.
[PARTIAL]   FV-013: clippy installed in CI (rust-tests.yml:19) but never run (:28-29).
[N/A]       FV-014: no static-analysis output to triage.
[PARTIAL]   FV-015: no lint config; unwrap() sites on fixed-size slices are guarded by length checks except src/utils.rs:80-87 (AV-080).
[FAIL-3]    FV-016: no -D warnings / zero-warning policy (rust-tests.yml:25-29) → F-015.
[FAIL-3]    FV-017: no security rulesets → F-015.
[PARTIAL]   FV-018: default dead-code lints only; unused bound accounts (bob_tokens, lld) are not flagged by the compiler.
[FAIL-3]    FV-019: no cargo audit / cargo deny in CI (rust-tests.yml) → F-013.
[FAIL-3]    FV-020: no SAST → F-015.
[PASS]      FV-021: no suppression attributes (#[allow]/#[deny]/#[warn]: zero hits in *.rs).
[N/A]       FV-022: no static-analysis config files.
[FAIL-3]    FV-023: no fuzzing of unpack_* (src/utils.rs:58-89) → F-015.
[FAIL-3]    FV-024: no fuzz targets for handlers → F-015.
[N/A]       FV-025: no fuzz infra.
[N/A]       FV-026: no fuzz infra.
[N/A]       FV-027: no fuzz infra.
[N/A]       FV-028: no fuzz infra.
[FAIL-3]    FV-029: arithmetic edge cases (MAX, 0, 1, pre-start) untested — exactly where F-001/F-011 live → F-015.
[N/A]       FV-030: no API endpoints.
[FAIL-3]    FV-031: no round-trip test for any_as_u8_slice/unpack_account_data (escrow field does not round-trip: src/utils.rs:72,87) → F-015.
[N/A]       FV-032: no fuzz infra.
[FAIL-3]    FV-033: no coverage tooling → F-015.
[FAIL-3]    FV-034: three happy-path tests only (tests/*.rs) → F-015.
[PARTIAL]   FV-035: tests exist for instructions 0–2 (tests/sol_*.rs) but none for instruction 3; utils helpers untested.
[FAIL-3]    FV-036: no multi-step workflow test; each test seeds state directly (tests/sol_withdraw_unlocked.rs:75-83) → F-015.
[FAIL-3]    FV-037: no edge-case tests → F-015.
[FAIL-3]    FV-038: no negative tests (wrong signer, wrong recipient, pre-start withdraw) → F-015.
              File: tests/sol_withdraw_unlocked.rs:108 ("TODO: Asserts")
              Impact: F-001 sits on an untested branch
              Fix: add failure-path tests with clock control
[N/A]       FV-039: no previously-found bugs recorded.
[PASS]      FV-040: cargo test-bpf runs on push to master and on PRs (rust-tests.yml:3-7,29).
[PARTIAL]   FV-041: CI installs the "beta" Solana release (rust-tests.yml:23) while Cargo pins 1.7.x crates — test runtime ≠ deployment runtime; unpinned.
[PASS]      FV-042: no #[ignore]d tests (tests/*.rs).
[N/A]       FV-043: no mutation testing.
[N/A]       FV-044: no endpoints; on-chain CU bounded (no loops).
[PARTIAL]   FV-045: tests/ use fresh Keypair::new() ✓; the example client and CLI embed devnet test keypairs (examples/strfi.rs:37-51; cli/strfi.js:40-59, out of scope) and the deploy keypair is committed (F-003).
[PARTIAL]   FV-046: tests depend on wall-clock SystemTime::now() (tests/*.rs:52-55) — not deterministic.
[PASS]      FV-047: every CPI result is propagated with ? (src/sol_initialize.rs:86; src/tok_initialize.rs:124,150,159,169).
[PASS]      FV-048: logs contain amounts/pubkeys only — no secrets.
[FAIL-2]    FV-049: panics possible on malformed input (src/lib.rs:47; src/utils.rs:80-87) → F-016, F-017.
[N/A]       FV-050: no HTTP.
[N/A]       FV-051: no off-chain resources.
[N/A]       FV-052: CPIs are synchronous; no external calls with timeouts.
[PASS]      FV-053: single-instruction atomic operations; runtime rolls back on failure (FP-4).
[PASS]      FV-054: no swallowed errors — all ? / early returns.
[PARTIAL]   FV-055: only generic ProgramError variants; MissingRequiredSignature reused for "wrong recipient" (src/sol_withdraw.rs:64) — no custom error enum.
[N/A]       FV-056: no error matching.
[N/A]       FV-057: no runtime external dependencies beyond System/SPL Token.
[FAIL-9]    FV-058: financial math wraps instead of erroring (src/utils.rs:96; src/sol_withdraw.rs:71,75) → F-001.
              File: src/utils.rs:96
              Impact: pre-vesting drain
              Fix: checked math + overflow-checks
[PARTIAL]   FV-059: solana-program-test (BanksClient) with processor! runs the natively compiled processor, not the .so (tests/*.rs:49-50); LiteSVM/Mollusk absent.
[FAIL-3]    FV-060: no before/after deadline tests (only post-end withdraw/cancel exercised: tests/sol_withdraw_unlocked.rs:65-66) → F-015.
[FAIL-3]    FV-061: real wall-clock offsets instead of clock control (tests/*.rs:52-55) → F-015.
[FAIL-3]    FV-062: no close assertions (tests/sol_cancel_stream.rs:102 "TODO: Asserts") → F-015.
[FAIL-3]    FV-063: no double-init test → F-015.
[FAIL-3]    FV-064: no wrong-signer test → F-015.
[FAIL-3]    FV-065: no arithmetic-edge tests → F-015.
[FAIL-3]    FV-066: no balance assertions after transfers (all three tests end with "TODO: Asserts") → F-015.
[PARTIAL]   FV-067: CU not profiled; program has no loops so CU is small and stable — informational.
[N/A]       FV-068: single-transaction tests only.
[PARTIAL]   FV-069: tests panic! on error (tests/*.rs:118) — acceptable for happy paths; no failure-path tests exist.
[N/A]       FV-070: no PDAs.
[FAIL-3]    FV-071: no Trident/Mollusk/LiteSVM/Kani/proptest → F-015.
[PARTIAL]   FV-072: test runtime is solana-program-test 1.7.3 (Cargo.lock:3002-3003) — predates current runtime features (e.g., Fees sysvar removal, see Notes); no v1-gate coverage; program does not introspect transaction format.
```

### Checklists 08–15, 17–20 — Out of scope

```
[N/A — out of scope: --scope program]   TS-001 … TS-064 (08), BE-001 … BE-131 (09), FE-001 … FE-084 (10), SC-001 … SC-052 (11), SEC-001 … SEC-053 (12), DEP-001 … DEP-089 (13), PY-001 … PY-082 (14), GL-001 … GL-088 (15), LM-001 … LM-065 (17), PC-001 … PC-060 (18), AI-001 … AI-033 (19), RS-001 … RS-021 (20) — 822 items rendered from the scope gate. Secrets/CI observations that arose incidentally are recorded under in-scope items OPS-028, OPS-036, OPS-074 and FV-019.
```

### Audit Metrics

| Metric | Value |
|--------|-------|
| Total items evaluated (in scope) | 591 |
| PASS | 104 (17.6 %) |
| FAIL | 81 (13.7 %) |
| PARTIAL | 80 (13.5 %) |
| N/A | 321 (54.3 %) |
| UNKNOWN (manual follow-up) | 5 (0.8 %) |
| **Pass rate** (excl. N/A) | **38.5 %** (104 / 270) |
| Highest severity found | **9** (F-001) |
| **Repository Risk Score** | **10 — CRITICAL (do not deploy)** |

### Known Vector Metrics

| Metric | Value |
|--------|-------|
| Total known vectors | 136 |
| In scope (evaluated) | 54 |
| PASS | 12 |
| FAIL | 10 |
| PARTIAL | 7 |
| N/A (feature absent / not applicable, in scope) | 25 |
| N/A — out of scope | 82 |
| Completion | 100 % |

### Per-Checklist Summary

See §3.3 (identical table; in-scope total 591, pass rate 38.5 %).

---

## 6. Known Vector Results (KV-001..KV-136)

```
[FAIL-6]    KV-001: Private Key Leak — cli/local_deploy_keypair.json tracked (step 6 FAIL), .gitignore incomplete (step 7), no pre-commit scanner (step 10); devnet test keypairs in examples/cli → F-003, F-019.
              File: cli/local_deploy_keypair.json:1; .gitignore:1
              Impact: program-ID squatting; escrow control if ID matches (UNDETERMINED)
              Fix: purge, rotate, ignore, scan
[N/A]       KV-002: feature absent — flash/flashloan/pyth/switchboard: zero grep hits.
[PASS]      KV-003: Reentrancy — CPIs only to System/SPL Token with program-built instructions (src/sol_initialize.rs:77; src/tok_initialize.rs:111,137,153,162); FP-1.
[PASS]      KV-004: Missing Access Control — every mutation requires a signer bound to stored keys (src/sol_withdraw.rs:51,62; src/sol_cancel.rs:37,48-56); init one-time.
[N/A]       KV-005: feature absent — oracle: zero hits.
[N/A]       KV-006: feature absent — shares/mint_to/vault/total_supply: zero hits.
[N/A]       KV-007: feature absent — swap/slippage: zero hits.
[PASS]      KV-008: Rug Pull / Admin Backdoor — no admin functions; one hardcoded passive sink (src/sol_withdraw.rs:45) documented; no pause; upgrade authority handled at KV-091.
[PARTIAL]   KV-009: Unchecked CPI Target — token program pinned (src/tok_initialize.rs:56); System id SDK-fixed but system_program key not asserted (step 2 manual, not compile-time).
[FAIL-4]    KV-010: PDA Confusion / Type Cosplay — no discriminator; raw AccountInfo without type tag; SOL/token metadata confusable (src/utils.rs:28-46; src/sol_withdraw.rs:55-60) → F-006.
              File: src/utils.rs:28-46
              Impact: token recipient takes metadata-account rent
              Fix: tag + length check
[FAIL-9]    KV-011: Integer Overflow / Underflow — bare lamport arithmetic; now − start and unlocked − withdrawn underflow (src/utils.rs:96; src/sol_withdraw.rs:71) → F-001.
              File: src/utils.rs:96
              Impact: pre-vesting drain
              Fix: checked math + guard + overflow-checks
[PARTIAL]   KV-012: Arithmetic Rounding — single f64 mul/div (src/utils.rs:96); floor favors the locked side; no u128; bounded error → F-009.
[PASS]      KV-013: Missing Signer Check — signers present and bound to stored authority on every mutation (AC-003).
[PASS]      KV-014: Account Reinitialization — data_is_empty() gate + System create_account (src/sol_initialize.rs:46; src/tok_initialize.rs:66).
[PARTIAL]   KV-015: Unchecked Account Owner — program-owned stream accounts owner-checked (src/sol_withdraw.rs:55; src/sol_cancel.rs:41); token accounts/mint/rent delegated to spl-token; system_program unchecked.
[PARTIAL]   KV-016: Token Account Mismatch — mint match enforced only by the spl-token transfer CPI; destination is program-created (src/tok_initialize.rs:137-169).
[N/A]       KV-017: feature absent — no share accounting; donations only enlarge the cancel sweep (src/sol_cancel.rs:69).
[N/A]       KV-018: feature absent — Token-2022/TransferFee rejected (src/tok_initialize.rs:56).
[PARTIAL]   KV-019: Freeze Authority Griefing — any classic mint accepted, no freeze-authority check, no recovery path (src/tok_initialize.rs:46); moot until a token withdraw exists (F-002).
[FAIL-3]    KV-020: Program Upgrade Hijack — authority unverifiable; no documented process/timelock; program not explorer-verified and the manual verification script is broken → F-014, F-012.
              File: cli/deploy.sh:7; verify_deployment.sh:30
              Impact: single-key upgrade risk (assumed)
              Fix: multisig + timelock + working verification
[N/A]       KV-021: feature absent — realm/proposal: zero hits.
[N/A]       KV-022: feature absent — guardian/vaa: zero hits.
[N/A]       KV-023: feature absent — transfer_hook: zero hits.
[FAIL-4]    KV-024: Stale/Missing Account Close — completed streams never closed (src/sol_withdraw.rs:117-124); cancel drains without zeroing (src/sol_cancel.rs:69-71) → F-007.
              File: src/sol_withdraw.rs:117-124
              Impact: rent stranded; stale data until purge
              Fix: close on completion; zero data
[PASS]      KV-025: Compute Budget Exhaustion — no loops, no remaining_accounts, fixed-size state.
[N/A]       KV-026: feature absent — no PDA derivation (find_program_address/create_program_address: zero hits); authority_signer_seeds is an empty pass-through (F-018).
[FAIL-4]    KV-027: Missing Discriminator Check — manual deserialization without discriminator (src/utils.rs:78-89) → F-006.
[N/A]       KV-028: feature absent — swap/claim/commit/slippage: zero hits; withdraw/cancel ordering is symmetric by design.
[PASS]      KV-029: Withdraw-Before-Update Race — no NAV/price; withdraw computes from Clock::get() and stored fields at execution (src/sol_withdraw.rs:68-76); no CPI precedes the state write.
[N/A]       KV-030: feature absent — mint_to/supply: zero hits.
[N/A — out of scope: --scope program]   KV-031 … KV-090 (backend / frontend / devops; 60 vectors).
[FAIL-3]    KV-091: Upgrade Authority Not Secured — no multisig/immutability evidence; the program-ID keypair (not the upgrade-authority keypair) is in the repo (step 3) → F-014, F-003.
              File: cli/deploy.sh:7; cli/local_deploy_keypair.json
              Impact: as KV-020
              Fix: as KV-020
[N/A — out of scope: --scope program]   KV-092 … KV-100 (devops; 9 vectors).
[PASS]      KV-101: Sysvar Spoofing — Clock/Rent/Fees via syscalls (src/sol_initialize.rs:65,71,90; src/sol_withdraw.rs:68; src/sol_cancel.rs:59; src/tok_initialize.rs:84,93,99); the passed rent_acc is id-checked by spl-token.
[N/A]       KV-102: feature absent — ed25519/secp256k1: zero hits.
[N/A]       KV-103: feature absent — address_lookup_table: zero hits.
[N/A]       KV-104: feature absent — no PDAs/bumps.
[N/A]       KV-105: feature absent — token_2022: zero hits.
[PARTIAL]   KV-106: Account Revival — manual close (cancel) drains all lamports but leaves data (src/sol_cancel.rs:69-71); same-tx re-read possible; revival needs attacker-funded lamports — gain ≤ donation (net ≤ 0) → no exploit; recommend zeroing (F-007).
[N/A]       KV-107: feature absent — associated_token: zero hits.
[PASS]      KV-108: Token Decimals — amounts are raw base units with no cross-mint math (src/tok_initialize.rs:165); legacy transfer noted at AV-060.
[FAIL-4]    KV-109: Native — Missing Manual Validation — owner/signer checks present (steps 2-3 ✓); bounds check missing (step 4: src/lib.rs:47; src/utils.rs:80-87); no type tag (step 5) → F-006, F-016, F-017.
              File: src/utils.rs:78-89
              Impact: type confusion; caller-side panics
              Fix: tag + length guard
[N/A — out of scope: AI-agent]   KV-110.
[PASS]      KV-111: BPF Stack Frame — largest local is the 160-byte StreamFlow (src/utils.rs:28-46); no arrays ≥ 4 KB; no deep call chains.
[N/A — out of scope: off-chain Rust / AI-agent]   KV-112 … KV-117 (6 vectors).
[N/A]       KV-118: feature absent — stake: zero hits.
[N/A]       KV-119: feature absent — nonce/realm: zero hits.
[N/A]       KV-120: Clock used only for vesting time; no randomness-dependent selection (src/sol_withdraw.rs:68).
[N/A]       KV-121: feature absent — merkle/bubblegum: zero hits.
[PARTIAL]   KV-122: Event-Log Spoofing — on-chain msg! logs accompany real state changes and cannot be attacker-forged via CPI; off-chain cli/watchprogram.py:17 (out of scope) parses a positional log line — consumers must use account state.
[PASS]      KV-123: Lamport-Donation Bricking — no exact-balance assumptions; >= sufficiency at init (src/sol_initialize.rs:66); cancel sweeps the live balance (src/sol_cancel.rs:69); no builtin/sysvar required writable.
[N/A — out of scope: custody]   KV-124.
[N/A]       KV-125: feature absent — bonding_curve: zero hits.
[N/A — out of scope: custody]   KV-126.
[PASS]      KV-127: Pre-Creation DoS — created accounts are fresh signer keypairs (src/sol_initialize.rs:54; src/tok_initialize.rs:75-78) — not attacker-pre-creatable.
[FAIL-3]    KV-128: Floating-Point Financial Math — f64 vesting math with as f64 / as u64 boundary casts (src/utils.rs:96) → F-009.
              File: src/utils.rs:96
              Impact: precision/saturation in the value path
              Fix: u128 fixed-point
[N/A]       KV-129: feature absent — keeper/crank: zero hits.
[N/A]       KV-130: feature absent — tick/sqrt_price: zero hits.
[FAIL-3]    KV-131: Write-Lock Contention — every withdraw write-locks the single hardcoded collector (src/sol_withdraw.rs:45-51) → F-010.
              File: src/sol_withdraw.rs:51
              Impact: global serialization / griefable priority auction
              Fix: drop the account
[N/A — out of scope: token registry]   KV-132, KV-133.
[N/A]       KV-134: feature absent — token_acl: zero hits.
[N/A — out of scope: tx-v1 consumers / fee sponsor]   KV-135, KV-136.
```

---

## 7. Instruction Matrix

| Instruction | File | Signers | CPI Calls | PDA Seeds | Checked Math | State Changes | Findings |
|---|---|---|---|---|---|---|---|
| `initialize_stream` (tag 0) | `src/sol_initialize.rs` | `alice` (sender), `pda` (new account keypair) | System `create_account` | none — client keypair | No (bare `+`, `-`, `*`) | creates 160-B account owned by program; writes `StreamFlow`; `bob += 2·lps`; `withdrawn = 2·lps` | F-008, F-011, F-016 |
| `withdraw_unlocked` (tag 1) | `src/sol_withdraw.rs` | `bob` (recipient) | none | none | No | `pda −= requested`; `bob += requested`; `withdrawn += available` | F-001, F-004, F-006, F-007, F-010, F-017 |
| `cancel_stream` (tag 2) | `src/sol_cancel.rs` | `alice` (sender) | none | none | No | `pda → bob` (unlocked − withdrawn); `pda → alice` (rest); account purged, data not zeroed | F-005, F-006, F-007 |
| `tok_initialize_stream` (tag 3) | `src/tok_initialize.rs` | `alice_authority`, `data_acc`, `escrow_acc` | System `create_account` ×2; SPL `initialize_account`; SPL `transfer` (`invoke_signed`, empty seeds) | none (`&[&[]]`) | No | creates metadata + escrow; escrow authority = program ID; `bob_authority += 3·lps`; tokens → escrow | F-002, F-003, F-006, F-018 |
| tags 4–5 | `src/lib.rs:54-55` | — | — | — | — | commented out (token withdraw/cancel absent) | F-002 |

Roles: sender → 0, 2, 3; recipient → 1; no admin; hardcoded passive collector `DrFtxPb9F6SxpHHHFiEtSNXE3SZCUNLXMaHS6r8pkoz2` required (writable, unused) by tag 1.

---

## 8. State Model Verification

### Account Types

| Account | Discriminator | Space | Owner | Close Target |
|---|---|---|---|---|
| `StreamFlow` (SOL stream) — `src/utils.rs:28-46` | ❌ none | 160 B (`4×u64 + 4×[u8;32]`, `#[repr(C)]`, no padding) | this program (`create_account` owner = `pid`) | cancel → `alice` (drain only, no zeroing); no close on completion |
| `StreamFlow` (token stream `data_acc`) | ❌ none (same layout; `mint` = mint key) | 160 B | this program | none (confusable with SOL stream — F-006) |
| SPL escrow (`escrow_acc`) | SPL Token layout | 165 B (`Account::LEN`) | SPL Token program; token authority = **program ID** | none (F-002) |

### State Machine Transitions

```
                 initialize_stream (0) / tok_initialize_stream (3)
   [none] ──────────────────────────────────────────────► Created (withdrawn = 2·lps; now < start)
                                                              │
                        time passes (now ≥ start)             │   cancel_stream (2): ALWAYS FAILS while now < start  (F-005)
                                                              ▼   withdraw_unlocked (1): DRAINS while now < start     (F-001)
                                                          Streaming (start ≤ now < end)
                          withdraw (1): pays unlocked − withdrawn; withdrawn += available (F-004)
                          cancel (2): bob ← unlocked − withdrawn, alice ← rest, account purged ──► Cancelled (terminal, data not zeroed)
                                                              │
                                                              ▼  now ≥ end
                                                          Completed-eligible: withdraw pays amount − withdrawn
                                                              │  account persists with rent forever (F-007)
                                                              └─ cancel after end: over-pays bob from rent or fails (F-007)
   Token streams: escrow has no outgoing transition at all (F-002)
```

### Invariants Verified

| Property | Description | Status |
|---|---|---|
| INV-01 | Σ paid to recipient ≤ unlocked(now) ≤ amount at all times | ❌ FAIL — F-001 (pre-start / early-window wrap) |
| INV-02 | `withdrawn` == Σ lamports actually paid to the recipient | ❌ FAIL — F-004 |
| INV-03 | Only the stored sender can cancel; only the stored recipient can withdraw | ✅ PASS (`src/sol_cancel.rs:48-56`; `src/sol_withdraw.rs:51,62`) |
| INV-04 | Stream account owner == program before any field is trusted | ✅ PASS (`src/sol_withdraw.rs:55`; `src/sol_cancel.rs:41`) |
| INV-05 | Cancel returns exactly `amount − unlocked(now)` (+ rent) to the sender | ✅ within `[start, end]`; ❌ outside (F-005, F-007) |
| INV-06 | Escrowed tokens can be released or returned | ❌ FAIL — F-002 |
| INV-07 | `pda.lamports ≥ amount − withdrawn + rent` after init | ⚠️ not enforced by the program (F-011); runtime rent-exemption backstop |
| INV-08 | CPI targets fixed to System / SPL Token | ✅ PASS (`src/tok_initialize.rs:56`; SDK-built System instructions) |
| INV-09 | A program-owned account is interpreted as exactly one type | ❌ FAIL — F-006 |

---

## 9. Code Maturity Scorecard

> Engineering-quality gate (Phase 4.5), orthogonal to the risk score. 0 absent · 1 ad-hoc · 2 partial · 3 good · 4 strong (weakest-link).

| # | Category | Score (0-4) | Evidence (file:line / artifact) | Gap to next level |
|---|----------|:-----------:|---------------------------------|-------------------|
| 1 | Access Controls | 3 | signer + stored-key binding on every handler (`src/sol_withdraw.rs:51,62`; `src/sol_cancel.rs:37,48-56`); no admin | explicit duplicate-account rejection; custom error codes |
| 2 | Arithmetic | 0 | zero `checked_*` calls; f64 value math; no `overflow-checks` (`src/utils.rs:96`; `Cargo.toml`) | checked u128 fixed-point + release overflow checks (F-001/F-008/F-009) |
| 3 | Account & Type Safety | 1 | owner checks present; no discriminator, no length guard (`src/utils.rs:78-89`) | tag + `LEN` check (F-006/F-017) |
| 4 | Input Validation | 2 | ix length pinned (`:42`, `:40`, `:52`); `duration_sanity` (`src/utils.rs:100-111`); no amount bounds, no phase guard | min amount, `now ≥ start` guard, `first()` on ix tag |
| 5 | Testing | 1 | three happy-path tests without assertions (`tests/*.rs`) | assertions, negatives, clock control (F-015) |
| 6 | Fuzzing & Property Tests | 0 | none | `proptest` on `calculate_streamed`; Trident/Mollusk target |
| 7 | Error Handling & DoS Resilience | 1 | panics on malformed input (`src/lib.rs:47`); generic errors; no loops (CU safe) | length guards; custom error enum |
| 8 | Upgradeability & Governance | 1 | personal-machine deploy (`cli/deploy.sh`); keypair in repo; no multisig/timelock evidence | multisig + timelock + documented process (F-003/F-014) |
| 9 | Monitoring & Incident Response | 1 | `msg!` logs; brittle log watcher (`cli/watchprogram.py`); no runbook/SECURITY.md | alerting on upgrades/outflows; SECURITY.md (F-020) |
| **Weighted Maturity** | | **1.1 / 4.0** | | |

Categories scoring ≤ 1 (Arithmetic, Fuzzing, Account & Type Safety, Testing, Error Handling, Upgradeability, Monitoring) are prioritized in the Remediation Roadmap regardless of individual finding severity.

---

## 10. Remediation Roadmap

Full roadmap with effort/owner columns: `audit_2/roadmap.md`.

### Immediate — Severity 9-10 (Block Deploy)

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-001 | 9 | Guard `now < start` / `now ≥ end` in `calculate_streamed`; `checked_*` on all lamport math; `[profile.release] overflow-checks = true`; bound `requested` by the account balance | 0.5 day + tests | program dev |

### Before Release — Severity 7-8

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-002 | 7 | Remove tag 3 from the dispatcher until token withdraw/cancel exist; escrow authority must be a PDA signed via `invoke_signed` | 1–2 days | program dev |

### Within 2 Weeks — Severity 5-6

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-003 | 6 | Purge `cli/local_deploy_keypair.json` from tree and history; rotate; gitignore; secret scanner; assess any deployment made with it | 0.5 day | ops |
| F-004 | 5 | `sf.withdrawn += requested` | 5 min + test | program dev |
| F-005 | 5 | Covered by the F-001 guard (`unlocked = 0` before start) | — | program dev |

### Next Sprint — Severity 3-4

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-006 | 4 | 8-byte tag + version; `data_len() == LEN` in every reader; distinct tag for token streams | 0.5 day | program dev |
| F-007 | 4 | Close on final withdrawal (zero, drain, assign); apply the `now ≥ end` override in cancel | 0.5 day | program dev |
| F-008 | 3 | Part of F-001 | — | program dev |
| F-009 | 3 | u128 mul-then-div | 1 h | program dev |
| F-010 | 3 | Drop the unused collector account | 15 min | program dev |
| F-011 | 3 | `checked_add`; enforce `amount ≥ 2·lps` | — | program dev |
| F-012 | 3 | Fix `verify_deployment.sh` (`tr`, tag, `-u "$network"`) or adopt `solana-verify` | 1 h | ops |
| F-013 | 3 | Pin action SHAs and Solana release; add `cargo audit`, `clippy -D warnings` | 2 h | ops |
| F-014 | 3 | Verify/document upgrade authority; multisig + timelock before mainnet | 1 day | ops |
| F-015 | 3 | Assertions, negative/boundary/clock-controlled tests, proptest + Trident/Mollusk | 2–3 days | program dev |

### Backlog — Severity 1-2

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-016 | 2 | `instruction_data.first().ok_or(..)?` | 5 min | program dev |
| F-017 | 2 | Length guard before `unpack_account_data` | 5 min | program dev |
| F-018 | 2 | `invoke` instead of `invoke_signed(.., &[&[]])` | 5 min | program dev |
| F-019 | 2 | Extend `.gitignore` | 5 min | ops |
| F-020 | 2 | `SECURITY.md`, runbook, upgrade/outflow alerting, bounty statement | 0.5 day | ops |

---

## 11. Re-Audit Checklist

- [ ] All Critical findings fixed and verified (F-001: pre-start and early-window withdraw must fail; cancel before start must return the deposit)
- [ ] All High findings fixed and verified (F-002: tag 3 removed or escrow authority is a PDA with a tested withdraw/cancel path)
- [ ] Medium findings addressed or accepted with documented risk (F-003 key rotated and history purged; F-004; F-005)
- [ ] Regression tests added for each fix (clock-controlled pre-start / at-start / post-end; partial withdrawal accounting; wrong signer)
- [ ] `overflow-checks = true` present in the release profile of the shipped build
- [ ] Program re-deployed and verified on-chain with a working verification script
- [ ] Binary hash matches source code
- [ ] Upgrade authority confirmed (multisig / timelock) and documented

---

## 12. Appendices

### A. Tool Versions

```
Engagement was static-only: no toolchain was executed.
From the repository:
  solana-program:      1.7.3 (Cargo.lock:2968-2969; Cargo.toml requests ^1.7.1)
  spl-token:           3.1.1 (Cargo.lock:3314-3315)
  solana-program-test: 1.7.3 (Cargo.lock:3002-3003)
  solana-sdk:          1.7.3 (Cargo.lock:3110-3111)
  CI toolchain:        Rust "stable" (unpinned) + Solana "beta" channel install (unpinned) (.github/workflows/rust-tests.yml:17,23)
  rustc / cargo / node / npm / solana-cli / anchor-cli: not executed
Auditor: auditor-skill 7.3.0@6bb2cbf (corpus at /home/felip/dev/auditor-site/vendor/auditor-skill), Mode 1 single linear agent
```

### B. Environment

```
OS: Linux 6.6.87.2-microsoft-standard-WSL2 (audit host)
Cluster tested: none (static analysis; no RPC access; build/test/execute prohibited)
RPC Provider: none
Artifacts: audit_2/intake.md, audit_2/checkpoint.md, audit_2/worksheets/context/*.md, audit_2/roadmap.md, audit_2/REPORT.md
```

### C. Limitations

- No code was built or executed; the `overflow-checks` assumption (Rust release default, not overridden) and the behaviour of `Fees::get()` on current runtimes were not confirmed by running the program.
- On-chain facts (upgrade authority, deployed bytecode, the pubkey of the committed keypair) could not be queried; five checklist items are `UNKNOWN` and F-003's escrow-control extension is `UNDETERMINED`.
- `AUDITOR/`, `audit_1/` and the keypair file contents were deliberately not read.

### D. Disclaimer

This audit report is provided as-is. It represents a point-in-time review of the codebase at commit `673f9641041465bf2b8031f166b05e6f96b48ff5`. No guarantee is made that all vulnerabilities have been found. It is audit-shaped automation — a rigorous first pass — not a substitute for a human firm audit, and it does not constitute financial or legal advice.
