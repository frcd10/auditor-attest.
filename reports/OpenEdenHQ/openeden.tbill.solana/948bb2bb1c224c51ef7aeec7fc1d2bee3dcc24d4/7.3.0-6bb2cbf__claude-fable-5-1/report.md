# 🔒 Security Audit Report — OpenEden TBILL (Solana Token-2022 Transfer Hook)

## 1. Executive Summary

**Repository:** `openeden.tbill.solana` (remote `origin/development`)  
**Commit:** `948bb2bb1c224c51ef7aeec7fc1d2bee3dcc24d4` (short `948bb2b`)  
**Branch:** `development` (detached HEAD at the pinned commit)  
**Date:** 2026-09-11  
**Auditor:** Claude Fable 5.1 running auditor-skill 7.3.0@6bb2cbf, unattended (corpus Mode 1 — FULL audit, single agent, static read-only)  
**Scope:** PROGRAM (`--scope program`) — checklists 01–07 + 16, on-chain known-vector groups + KV-091  
**Program ID:** `48n7YGEww7fKMfJ5gJ3sQC3rM6RWGjpUsghqVfXVkR5A` (`declare_id!`, `programs/tbill/src/lib.rs:18`; matches `Anchor.toml:8`)  
**Languages Detected:** Rust (Anchor 0.30.1 — 1 program file, 181 LOC); TypeScript (2 mocha scripts, 755 LOC — read as evidence for checklists 07/16 only); JavaScript (1 migration stub)  
**Repository Risk Score:** 6 — 🟡 MEDIUM (fix soon)

### What We Found

The on-chain surface is a 181-line Anchor program that acts as the Token-2022 transfer hook for the TBILL mint and enforces exactly one rule: transfers are rejected while a global `pause` PDA is `true`. It custodies no tokens or SOL, performs no value math, and makes a single CPI (System `create_account`). Account validation, PDA derivation, signer gating and error handling are correct; no fund-loss path exists inside the program. The two findings that matter sit at the edges: the initialization runbook leaves the TBILL **mint authority on the deployer's hot wallet** while every other authority goes to the Squads multisig (unbounded issuance by one key, F-002, severity 6 — flagged with uncertainty because a later authority transfer is not visible in the repo), and the per-mint validation account is created with a raw `create_account` that **anyone can brick by pre-funding the PDA with 1 lamport** before the multisig runs the step (transfer DoS for the mint, F-001, severity 5). Below those: unverifiable custody of the hardcoded admin and of the upgrade authority (F-003), a hook that does not check it is being called mid-transfer (F-004), an unnecessary write lock on the global pause account in every transfer (F-005), and a test suite that never exercises the paused path (F-006). The program is not unsafe to deploy on its own, but the mint-authority custody and the pre-funding DoS should be fixed before the mint goes live on mainnet, and the audit is static-only: no build, test or on-chain state was executed or observed.

### Severity Distribution

| Score | Label | Count |
|-------|-------|-------|
| 10 | 🔴 CRITICAL | 0 |
| 9 | 🔴 CRITICAL | 0 |
| 8 | 🟠 HIGH | 0 |
| 7 | 🟠 HIGH | 0 |
| 6 | 🟡 MEDIUM | 1 |
| 5 | 🟡 MEDIUM | 1 |
| 4 | 🔵 LOW | 1 |
| 3 | 🔵 LOW | 3 |
| 2 | ⚪ INFO | 4 |
| 1 | ⚪ INFO | 1 |
| **Total Findings** | | **11** |

### Items Verified

| Metric | Count |
|--------|-------|
| Total checklist items (in scope) | 591 |
| PASS | 136 |
| FAIL | 27 |
| PARTIAL | 43 |
| UNKNOWN (unverifiable from the repository) | 30 |
| N/A | 355 |
| Completion | 100 % (every in-scope item and vector carries a verdict) |

---

## 2. Scope Coverage

> Out-of-scope items render `[N/A — out of scope]` from the scope gate (OUTPUT-RULES Rule 0). `--scope program` maps to FULL-AUDIT.md Scope Control: PROGRAM = checklists 01–07 + 16.

| Checklist / vector group | In scope? | Items evaluated / total | Trigger / reason |
|---|---|---|---|
| 01–07 on-chain | Yes | 519 / 519 | `programs/tbill/src/lib.rs`, `Anchor.toml` |
| 08–10 off-chain (TS/web) | No | 0 / 279 | out of scope: `--scope program`; the `.ts` files are test/initialization scripts, not a product surface (read as evidence for 07/16) |
| 11–13 supply chain / secrets / deployment | No | 0 / 194 | out of scope: `--scope program` (PROGRAM scope = 01–07, 16); incidental observations recorded in Notes & Nitpicks |
| 14 python | No | 0 / 82 | no `.py` files; out of scope |
| 15 general language | No | 0 / 88 | no `.go`/`.java`/`.rb`/`.php`; out of scope |
| 16 formal verification & testing | Yes | 72 / 72 | PROGRAM scope includes 16 |
| 17–18 logging / privacy & compliance | No | 0 / 125 | out of scope: `--scope program` |
| 19 AI-agent | No | 0 / 33 | no `.mcp.json`, agent SDK or LLM code |
| 20 off-chain Rust | No | 0 / 21 | no `.rs` outside `programs/` |
| KV Crypto/On-Chain 1–30 | Yes | 30 / 30 | on-chain phase |
| KV Modern Surface 101–109, 111 | Yes | 10 / 10 | on-chain phase |
| KV 118–123, 125, 127–131, 134 | Yes | 13 / 13 | on-chain phase (feature-gated) |
| KV-091 upgrade authority | Yes | 1 / 1 | checklist 07 phase |
| KV 31–90 (excl. 91), 92–100, 110, 112–117, 124, 126, 132–133, 135–136 | No | 0 / 82 | out of scope: no backend/frontend/devops/AI/custody/reader component in PROGRAM scope |

### Scope Metrics

| Metric | Count |
|---|---:|
| In-scope checklist items | 591 |
| Items with a verdict | 591 |
| In-scope known-vectors | 54 |
| Completion (in-scope) | 100 % |

---

## 3. Scope & Methodology

### Files Audited

| Domain | Language | Files | Lines of Code |
|---|---|---|---|
| Solana Program | Rust | 1 (`programs/tbill/src/lib.rs`) | 181 |
| Program manifests | TOML | 4 (`programs/tbill/Cargo.toml`, `programs/tbill/Xargo.toml`, `Cargo.toml`, `Anchor.toml`) | 60 |
| Tests / initialization runbook (evidence for 07/16) | TypeScript | 2 (`tests/tbill.ts`, `tests/initialize.ts`) | 755 |
| Migration stub | JavaScript | 1 (`migrations/deploy.ts`) | 13 |
| Shared/Config | Various | 7 (`package.json`, `tsconfig.json`, `.env`, `.gitignore`, `.prettierignore`, `README.md`; `Cargo.lock` and `package-lock.json` grepped for versions/sources only) | ≈ 150 (+ lockfiles) |
| **Total** | | **15** | **≈ 1,160** |

Untracked directories present in the working tree (`AUDITOR/`, `audit_1/`, `audit_2/`) are not part of the audited commit and were treated as data; no instruction-like text was found in the tracked tree (prompt-injection sweep: zero hits for auditor/AI-directed text).

### Method

1. Discovery and scope declaration (Rule 0); intake defaults persisted to `audit_2/intake.md`.
2. Phase 0.5 context reconstruction for every handler → `audit_2/worksheets/context/*.md` (purpose, signature, block-by-block, invariants, assumptions, external risks).
3. Instruction-by-instruction walk of checklists 01–04, then cross-cutting 05–07 and 16; every item recorded in `audit_2/verdicts/`.
4. Known vectors loaded only when their INDEX markers were present in `programs/` (grep-evidenced); absent-feature vectors rendered `[N/A — feature absent]`.
5. Every candidate ≥ 6 passed through `references/false-positives.md` and the Rule 5b gate (Reachability / Math-State-Bounds / Attacker-Model blocks appear in the finding).
6. Static only: nothing was built, installed, executed or fetched; on-chain state was not observed.

### Checklists Applied

| # | Checklist | Items | Pass | Fail | Partial | Unknown | N/A | Pass Rate¹ |
|---|---|---|---|---|---|---|---|---|
| 01 | Account Validation | 90 | 33 | 6 | 4 | 0 | 47 | 76.7 % |
| 02 | Access Control | 50 | 23 | 4 | 1 | 0 | 22 | 82.1 % |
| 03 | Arithmetic Safety | 63 | 15 | 0 | 0 | 0 | 48 | 100 % |
| 04 | CPI & PDA | 70 | 20 | 0 | 1 | 0 | 49 | 95.2 % |
| 05 | State Machine | 72 | 14 | 2 | 1 | 0 | 55 | 82.4 % |
| 06 | Economic & Logic | 89 | 3 | 2 | 2 | 0 | 82 | 42.9 % |
| 07 | OpSec & Governance | 85 | 13 | 4 | 12 | 30 | 26 | 44.8 % |
| 16 | Formal Verification & Testing | 72 | 15 | 9 | 22 | 0 | 26 | 32.6 % |
| | **Total (in scope)** | **591** | **136** | **27** | **43** | **30** | **355** | **66.0 %** |

¹ Pass rate = PASS ÷ (PASS + FAIL + PARTIAL); N/A and UNKNOWN excluded. Checklists 08–15, 17–20 are out of scope and excluded from totals.

### Trust Model & Actors (from intake §6)

| Actor | Who / how gated | Trusted to | Trusted NOT to |
|---|---|---|---|
| Upgrade authority | UNKNOWN — not in repo; Anchor default is the deploy wallet (`Anchor.toml:15`) | upgrade the hook program | push a censoring/blocking upgrade |
| Admin (`ADMIN_PUBKEY`) | hardcoded `CPNEkz5…` (`lib.rs:20`); README:43 says "should be a Squads multisig" | set/clear pause; register mints | pause maliciously; lose the key |
| Mint authority | deploy wallet (`tests/initialize.ts:120,129`) | mint on subscriptions | mint unbacked supply |
| Freeze authority | Squads multisig (`tests/initialize.ts:121`) | thaw KYC'd accounts; freeze on compliance events | freeze arbitrarily |
| Transfer-hook / metadata authority | Squads multisig (`tests/initialize.ts:102,108,127`) | change hook program; update metadata | swap the hook for a censoring program |
| Token holder | permissionless once thawed | transfer to thawed accounts; burn own tokens | — (untrusted) |
| Anyone | — | send SOL anywhere; call the hook directly; create (frozen) token accounts | — (the attacker) |

The security of the system rests on custody of four keys outside the program: admin, mint authority, freeze authority and upgrade authority. The program itself can only refuse transfers.

### Assumptions & Simplifications (defaults applied — intake §8)

- Deployment status unanswered → treated as mainnet-intended (mainnet RPC and a Squads address in `.env`), but the +1 "mainnet-live" lever was **not** applied; TVL unknown → no weighting.
- Upgradeability unanswered → assumed upgradeable; authority unverified and treated as trusted-but-single; reported as UNDETERMINED (F-003), not auto-flagged at 8+.
- First audit assumed; an untracked prior report (`audit_1/`) exists in the working directory and was not used as a source of verdicts.
- No CI, secret scanner, bug bounty or incident-response documentation exists in the repo → treated as absent.
- Squads multisig addresses cannot be resolved offline; whether `ADMIN_PUBKEY` is a vault PDA (can sign via CPI) or a config PDA / EOA is UNKNOWN.
- The `.ts` files are treated as the production initialization runbook (they read the multisig address from `.env` and defer steps "To Be Performed By Squad").
- Privilege-gated paths (admin pause, mint authority, freeze authority) are severity-capped per OUTPUT-RULES Rule 1.

---

## 4. Findings

> Every finding, including severity 1–3, has a full block so that the Severity Distribution counts equal the blocks below. Root causes are de-duplicated; item verdicts that share a root cause reference the same F-number.

---

#### [F-001] Pre-funding the per-mint validation PDA permanently blocks `initialize_extra_account_meta_list` (transfer DoS for the mint)

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM |
| **Checklist Item** | AV-085, AV-087, AC-039, AC-041, ECON-056, KV-123, KV-127 |
| **Category** | Denial of Service / Account Pre-Creation |
| **Language** | Rust |
| **File** | `programs/tbill/src/lib.rs:47-59` |
| **Status** | Open |
| **PoC tier** | [PoC-PROSE] |

**Description:**  
The validation account Token-2022 must resolve on every transfer lives at the deterministic PDA `[b"extra-account-metas", mint]` (L128). The handler creates it with a raw System `create_account` CPI (L47-59). The System program rejects `create_account` when the destination already holds lamports (`SystemError::AccountAlreadyInUse`). Funding an address requires no signature, so anyone can send 1 lamport to the PDA before the admin's transaction lands. Anchor's `init`/`init_if_needed` handle this case (transfer shortfall → `allocate` → `assign`); this handler does not. The production runbook (`tests/initialize.ts:152-184`) creates the mint in one step and explicitly defers the validation-account step to the multisig, so the window is not a same-slot race but an operational gap.

**Impact:**  
Once the PDA is pre-funded the admin instruction reverts every time. A mint with a TransferHook extension whose validation account cannot be resolved cannot be transferred at all (`transfer_checked` fails inside the hook resolution), so every TBILL transfer is blocked. Tokens can still be minted to holders (`mint_to` does not invoke the hook) but cannot move. Recovery requires either a program upgrade that tolerates the pre-funded account, or the transfer-hook authority (multisig) pointing the mint at a different hook program / removing the hook (losing the pause control). Attacker cost: 1 lamport plus one transaction fee. Griefing only — no profit.

**Reachability**
- Entry point: any System transfer to the PDA address, then `initialize_extra_account_meta_list` @ `lib.rs:26-67`
- Signer / authority required: permissionless (funding); the admin's call is the victim
- Preconditions: the validation account for the mint has not yet been created; the mint address is public (it is, once `tests/initialize.ts:92-149` runs)
- Guard analysis: `address = ADMIN_PUBKEY` (L120-124) gates the creation call, not the funding; `seeds`/`bump` (L126-130) only verify the address; `create_account` (L47-59) has no pre-funded branch
- Verdict: REACHABLE

**Math / State-Bounds**
- Vulnerable transition: `create_account(from=payer, to=PDA, lamports, space, owner=program)` @ L47-59
- Input domain: PDA lamports ∈ {0} expected; attacker sets ≥ 1
- Boundary that breaks: System program check `to.lamports() > 0 → AccountAlreadyInUse`
- Worked case: attacker `SystemProgram.transfer(1 lamport → PDA)`; admin executes the multisig proposal → instruction error "account already in use"; repeat forever
- Net effect: DoS — 100 % of the mint's transfers blocked until upgrade/migration; no funds moved

**Proof of Concept:**
```ts
// 1. After tests/initialize.ts creates the mint (address public), before the Squad runs the init step:
const [pda] = PublicKey.findProgramAddressSync(
  [Buffer.from("extra-account-metas"), mint.toBuffer()], programId);
await sendAndConfirmTransaction(conn, new Transaction().add(
  SystemProgram.transfer({ fromPubkey: griefer.publicKey, toPubkey: pda, lamports: 1 })), [griefer]);
// 2. Admin's initializeExtraAccountMetaList → fails: "Create Account: account ... already in use"
// 3. Any transferCheckedWithTransferHook of the mint fails (validation account unresolvable)
```

**Recommendation:**
```rust
// programs/tbill/src/lib.rs — replace L47-59 with Anchor's tolerant pattern
let meta_list = ctx.accounts.extra_account_meta_list.to_account_info();
let current = meta_list.lamports();
if current == 0 {
    create_account(CpiContext::new(sys.clone(), CreateAccount { from: payer.clone(), to: meta_list.clone() })
        .with_signer(signer_seeds), lamports, account_size, ctx.program_id)?;
} else {
    let shortfall = lamports.saturating_sub(current);
    if shortfall > 0 {
        system_program::transfer(CpiContext::new(sys.clone(), Transfer { from: payer.clone(), to: meta_list.clone() }), shortfall)?;
    }
    system_program::allocate(CpiContext::new(sys.clone(), Allocate { account_to_allocate: meta_list.clone() }).with_signer(signer_seeds), account_size)?;
    system_program::assign(CpiContext::new(sys, Assign { account_to_assign: meta_list.clone() }).with_signer(signer_seeds), ctx.program_id)?;
}
// Also: run the initialization immediately after mint creation, and add a test that pre-funds the PDA.
```

---

#### [F-002] TBILL mint authority is assigned to the deployer hot wallet while every other authority goes to the multisig

| Field | Value |
|---|---|
| **Severity** | 6 — 🟡 MEDIUM (impact 10 — unbounded issuance; capped: requires compromise of one privileged hot key; *confidence: medium — see uncertainty note*) |
| **Checklist Item** | AC-037, ECON-048, OPS-029, KV-008, KV-030 |
| **Category** | Key Custody / Infinite Mint |
| **Language** | TypeScript (initialization runbook) — Token-2022 authority configuration |
| **File** | `tests/initialize.ts:120` (and `:129`) |
| **Status** | Open |
| **PoC tier** | [PoC-PROSE] |

**Description:**  
The initialization runbook sets the freeze authority (L121), the transfer-hook authority (L102) and the metadata update authority (L108, L127) to `SQUAD_MULTI_SIG`, but the **mint authority** to `wallet.publicKey` (L120) — the Anchor provider wallet, a plaintext filesystem keypair (`Anchor.toml:15`). No `set_authority` step follows in the repo. `DefaultAccountState = Frozen` (L112-116) only protects *new* token accounts; any account already thawed by the freeze authority (every KYC-approved holder, the issuer treasury) can receive minted tokens.

**Uncertainty:** the repository does not show what happens after this script runs. If the operational process transfers the mint authority to the multisig (or the script is only used for non-production mints), this finding drops to Informational. The missing step is provable at `tests/initialize.ts:120`; the live on-chain authority could not be observed in this engagement.

**Impact:**  
A single compromised key can mint an unbounded quantity of a tokenized T-Bill into any thawed account (including the attacker's own KYC-approved account), then redeem or sell unbacked tokens. The transfer hook cannot stop it (`mint_to` never invokes the hook) and the pause does not apply. Privilege required caps the score; the blast radius is the entire token supply.

**Reachability**
- Entry point: Token-2022 `MintTo` / `MintToChecked` signed by the mint authority (configured @ `tests/initialize.ts:120`)
- Signer / authority required: the mint authority key (deploy wallet)
- Preconditions: compromise or misuse of `~/.config/solana/id.json`; a thawed destination account (any approved holder)
- Guard analysis: `DefaultAccountState=Frozen` (L112-116) blocks only never-thawed accounts; the hook (`lib.rs:69-73`) is not invoked on mint; no supply cap exists on the mint
- Verdict: REACHABLE (given key compromise)

**Math / State-Bounds**
- Vulnerable transition: `mint.supply += amount` for any `amount ≤ u64::MAX − supply`
- Input domain: attacker-chosen `amount`, attacker-chosen thawed destination
- Boundary that breaks: none — no cap, no rate limit, no second signer
- Worked case: attacker mints 1,000,000 TBILL (6 decimals → `1_000_000_000_000`) to their thawed account; sells/redeems against the issuer's reserves
- Net effect: unbacked supply equal to the amount minted; issuer insolvency risk

**Attacker-Model**
- Capability: compromised admin/deployer hot key
- Capital / setup cost: key theft (phishing, machine compromise) — no on-chain capital
- Profit / damage: up to the liquidity available for TBILL redemption/sale
- Atomicity: single-tx per mint
- Net: requires-privilege (severity capped per Rule 1)

**Proof of Concept:**
```ts
// With the deployer keypair (mint authority per tests/initialize.ts:120):
await mintTo(conn, deployer, mint, attackerThawedAta, deployer.publicKey,
             1_000_000n * 10n ** 6n, [], undefined, TOKEN_2022_PROGRAM_ID);
// Succeeds: no hook on mint, no supply cap, destination already thawed.
```

**Recommendation:**
```ts
// tests/initialize.ts:117-123 — put the mint authority on the multisig from the start
createInitializeMintInstruction(
  mint.publicKey, decimals,
  new PublicKey(process.env.SQUAD_MULTI_SIG), // Mint authority
  new PublicKey(process.env.SQUAD_MULTI_SIG), // Freeze authority
  TOKEN_2022_PROGRAM_ID),
// and in createInitializeInstruction(...) set mintAuthority to the same address (L129).
// If a hot wallet must sign the metadata init, add `createSetAuthorityInstruction(mint, wallet, AuthorityType.MintTokens, SQUAD_MULTI_SIG)` in the same transaction.
// Operationally: alert on every MintTo of the mint; publish the authority map.
```

---

#### [F-003] Privileged-key custody is unverifiable and non-rotatable: hardcoded admin constant, undocumented multisig and upgrade-authority handling

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW ([UNDETERMINED] — extent not determined within this assessment) |
| **Checklist Item** | AC-015, OPS-078, KV-020, KV-091 (+ OPS-027, OPS-037, OPS-063 PARTIAL) |
| **Category** | Access Control / Governance / Centralization |
| **Language** | Rust / configuration |
| **File** | `programs/tbill/src/lib.rs:20`, `Anchor.toml:15`, `README.md:33-71`, `tests/tbill.ts:217` |
| **Status** | Open |
| **PoC tier** | [PoC-PROSE] |

**Description:**  
The only privileged key in the program is `ADMIN_PUBKEY` (`lib.rs:20`), a compile-time constant used by `address =` constraints (L103, L123). README:43 says it "should be a Squads multisig" and `.env:1` labels the same address `SQUAD_MULTI_SIG`, but three things cannot be established from the repository: (a) whether `CPNEkz5…` is a Squads *vault* PDA (which can sign via CPI), a Squads config PDA or an EOA — the committed test signs `update_pause` with the provider wallet (`tests/tbill.ts:217`), which only works if that wallet *is* the admin key; (b) who holds the program upgrade authority — Anchor leaves it on the deploy wallet (`Anchor.toml:15`) and no transfer step or upgrade procedure is documented; (c) any timelock. The admin cannot be rotated without a program upgrade.

**Impact:**  
If the admin is a single key: one compromise pauses every TBILL transfer indefinitely (DoS, not theft). If the constant is a non-signing Squads config PDA: `update_pause` is uncallable and the pause control does not exist until an upgrade. If the upgrade authority is a hot wallet: a malicious upgrade can censor or block transfers or delete the pause (Token-2022 de-escalates the accounts it passes to the hook, so tokens cannot be moved by the hook itself). Severity reflects DoS/censorship impact with unverified likelihood.

**Reachability**
- Entry point: `update_pause` @ `lib.rs:92-96`; BPF Upgradeable Loader `Upgrade`
- Signer / authority required: admin key / upgrade authority
- Preconditions: key compromise, or a mis-chosen admin address
- Guard analysis: `address = ADMIN_PUBKEY` (L103) is correct but unrotatable; no on-chain timelock
- Verdict: REACHABLE given privilege; likelihood UNDETERMINED

**Math / State-Bounds**
- Transition: `pause.state ← true` (L93) by a compromised admin → every transfer reverts at L70; or program bytes replaced by the upgrade authority
- Net effect: DoS/censorship of all transfers; no token movement possible through the hook

**Proof of Concept:**
```text
Actor: holder of ADMIN_PUBKEY (single key or mis-scoped multisig member)
1. update_pause(true) → every transfer_checked of TBILL fails with Error::Paused (L70)
2. No timelock, no second signer, no event; holders learn of it by failed transfers
Recovery: only the same key (or a program upgrade) can unpause.
```

**Recommendation:**
```rust
// Move the admin into state with two-step rotation
#[account] pub struct Config { pub admin: Pubkey, pub pending_admin: Option<Pubkey>, pub bump: u8 }
pub fn propose_admin(ctx: Context<AdminOnly>, new_admin: Pubkey) -> Result<()> { ctx.accounts.config.pending_admin = Some(new_admin); Ok(()) }
pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
    require_keys_eq!(ctx.accounts.config.pending_admin.ok_or(Error::NoPending)?, ctx.accounts.new_admin.key());
    ctx.accounts.config.admin = ctx.accounts.new_admin.key(); ctx.accounts.config.pending_admin = None; Ok(()) }
// Operationally: verify on-chain that ADMIN_PUBKEY is the Squads vault PDA; transfer the upgrade
// authority to the multisig with a time lock (solana program set-upgrade-authority --new-upgrade-authority <SQUADS_VAULT>);
// document the authority map and the upgrade procedure; pin [toolchain] for verifiable builds.
```

---

#### [F-004] The hook does not verify it is invoked by Token-2022 mid-transfer (no `transferring` check) — direct invocation and log spoofing

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | SM-049, KV-122 (noted under KV-023, OPS-016) |
| **Category** | Input Validation / Event Integrity |
| **Language** | Rust |
| **File** | `programs/tbill/src/lib.rs:69-90` |
| **Status** | Open |

**Description:**  
`transfer_hook` (L69-73) and the `fallback` dispatcher (L75-90) accept any caller. The accounts struct (L142-167) verifies mint/authority constraints and the two PDAs, but never asserts that `source_token`'s Token-2022 `TransferHookAccount` extension has `transferring == true` — the standard `check_is_transferring` guard that proves the call originates from a live Token-2022 transfer. Anyone can call the program directly with their own token account, their own key as `owner`, and any `amount`, producing the log `Amount sent: <amount>` (L71) with no transfer.

**Impact:**  
Today the hook has no state and no CPI, so a direct call is harmless on-chain. The gap matters in two ways: any off-chain consumer that treats the program's logs as transfer evidence is spoofable, and any future stateful logic (allowlists, volume caps, counters) would be trivially bypassable/pollutable. Theoretical risk, no exploit path against current code.

**Proof of Concept:**
```ts
// Direct Anchor call with attacker-owned accounts; no Token-2022 transfer involved
await program.methods.transferHook(new BN(1_000_000_000)).accounts({
  sourceToken: attackerAta, mint, destinationToken: attackerAta2, owner: attacker.publicKey,
  extraAccountMetaList: metaListPda, pause: pausePda }).rpc();
// Log: "Amount sent: 1000000000" — nothing moved.
```

**Recommendation:**
```rust
use anchor_spl::token_interface::spl_token_2022::extension::{transfer_hook::TransferHookAccount, BaseStateWithExtensions, StateWithExtensions};
use anchor_spl::token_interface::spl_token_2022::state::Account as T22Account;
fn check_is_transferring(ai: &AccountInfo) -> Result<()> {
    let data = ai.try_borrow_data()?;
    let acc = StateWithExtensions::<T22Account>::unpack(&data)?;
    let ext = acc.get_extension::<TransferHookAccount>()?;
    require!(bool::from(ext.transferring), Error::NotTransferring);
    Ok(())
}
// in transfer_hook: check_is_transferring(&ctx.accounts.source_token.to_account_info())?;
```

---

#### [F-005] The `pause` extra account is registered writable, so every TBILL transfer write-locks one global PDA

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | AV-019, KV-131 (ECON-051 PARTIAL) |
| **Category** | Liveness / Throughput (write-lock contention) |
| **Language** | Rust |
| **File** | `programs/tbill/src/lib.rs:34` |
| **Status** | Open |

**Description:**  
`ExtraAccountMeta::new_with_seeds(..., false /*signer*/, true /*writable*/)` (L29-35) registers the global `pause` PDA as writable in the validation account. Token-2022 forwards the registered flags, so every `transfer_checked` of the mint must take a write lock on `[b"pause"]`. The handler only reads it (L70).

**Impact:**  
Sealevel serializes all transactions that write-lock the same account: TBILL transfers cannot execute in parallel anywhere in the cluster, and the admin's `update_pause` contends with them. Under local fee markets a griefer can spam cheap writes or out-bid the per-account priority auction to delay transfers. No time-critical settlement path exists (no liquidations), so the impact is a throughput cap and low-cost delay griefing, not fund loss.

**Proof of Concept:**
```text
Two holders submit transfers in the same slot → both carry `pause` as writable → scheduled sequentially.
Griefer: N cheap txs each write-locking `pause` (e.g. via the same transfer path with dust) → honest transfers queue behind them.
```

**Recommendation:**
```rust
ExtraAccountMeta::new_with_seeds(&[Seed::Literal { bytes: b"pause".to_vec() }], false, false)?; // read-only
// Existing validation accounts must be re-created (or an admin `update_extra_account_meta_list` added) to apply the change.
```

---

#### [F-006] The paused path is never tested; no CI, static analysis, fuzzing or property tests

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | FV-001, FV-002, FV-005, FV-013, FV-019, FV-024, FV-034, FV-040, FV-071 |
| **Category** | Testing & Verification |
| **Language** | TypeScript (tests) / repo configuration |
| **File** | `tests/tbill.ts:212-222`, `package.json:3-11`, `Anchor.toml:1-5` |
| **Status** | Open |

**Description:**  
The suite sets `pause = false` (tbill.ts:217) and then transfers; it never sets `pause = true` and asserts a transfer fails, so the program's only security property is unverified. There are no tests for unauthorized `initialize_extra_account_meta_list`, double initialization, delegate transfers, direct hook invocation, or a pre-funded PDA (F-001). No CI workflow, clippy, `cargo audit`/`npm audit`, coverage or fuzzing exists; balances are never asserted after mint/transfer/burn.

**Impact:**  
A regression that removes or inverts the `require!` at `lib.rs:70` would pass the suite. Liveness failures such as F-001 are not caught. Dependency advisories go unnoticed.

**Proof of Concept:**
```text
Mutation: change L70 to `require!(ctx.accounts.pause.state == true, ...)` → `anchor run tbill` still passes
(the only hooked transfer runs with pause == false and expects success).
```

**Recommendation:**
```ts
it("blocks transfers while paused", async () => {
  await program.methods.updatePause(true).accounts({}).rpc();
  await assert.rejects(transferCheckedWithTransferHook(/* same args as L332-344 */), /Paused|custom program error: 0x1771/);
  await program.methods.updatePause(false).accounts({}).rpc();
});
// Add: unauthorized initialize → NotAdmin; second initialize → fails; pre-funded PDA → succeeds after F-001 fix;
// delegate transfer → documents F-007; balance assertions after mint/transfer/burn.
// CI: anchor build + anchor test + cargo clippy -D warnings + cargo audit + npm audit on every PR.
```

---

#### [F-007] `token::authority = owner` rejects every delegate-initiated transfer

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | AV-049 |
| **Category** | Design / Liveness |
| **Language** | Rust |
| **File** | `programs/tbill/src/lib.rs:146` |
| **Status** | Open |

**Description:**  
Token-2022 passes the transfer *authority* as the fourth account. For a delegated transfer (`approve` + `transfer_checked` signed by the delegate, or a permanent delegate) that account is the delegate, not the token account owner, so the constraint `source_token.owner == owner` fails and the transfer reverts. The hook does not use `owner` for anything.

**Impact:**  
Any flow that relies on delegation (escrow/settlement programs holding an approval, custodial sweeps, a future compliance clawback via PermanentDelegate) cannot move TBILL. Fail-closed and possibly intended for a permissioned token, but undocumented.

**Proof of Concept:**
```text
holder: approve(delegate, 100) → delegate: transferChecked(source, mint, dest, delegate, 100) → hook: ConstraintTokenOwner
```

**Recommendation:**
```rust
// Either drop the binding (the hook never uses `owner`):
pub source_token: InterfaceAccount<'info, TokenAccount>, // token::mint = mint only
// or accept both owner and delegate explicitly and document the policy:
#[account(token::mint = mint, constraint = source_token.owner == owner.key() || source_token.delegate.contains(&owner.key()) @ Error::BadAuthority)]
```

---

#### [F-008] `update_pause` conflates creation and update through `init_if_needed`

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | AV-023 (KV-014 PARTIAL) |
| **Category** | Hardening / Reinitialization hygiene |
| **Language** | Rust |
| **File** | `programs/tbill/src/lib.rs:106-113` |
| **Status** | Open |

**Description:**  
The single admin instruction both creates the `pause` PDA and overwrites its one field. Today this is safe (admin-gated, the only field is intentionally overwritten — false-positives FP-5), but any field added to `Pause` later would be silently reset on every call, and the create path has no explicit fail-closed default.

**Impact:** Latent — no current exploit.

**Recommendation:**
```rust
pub fn initialize_pause(ctx: Context<InitializePause>) -> Result<()> { ctx.accounts.pause.state = true; ctx.accounts.pause.bump = ctx.bumps.pause; Ok(()) } // init, fail-closed
pub fn update_pause(ctx: Context<UpdatePause>, state: bool) -> Result<()> { ctx.accounts.pause.state = state; Ok(()) }      // mut only
```

---

#### [F-009] No event is emitted when the pause state changes

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | SM-047 (SM-050 PARTIAL) |
| **Category** | Monitoring |
| **Language** | Rust |
| **File** | `programs/tbill/src/lib.rs:92-96` |
| **Status** | Open |

**Description:**  
`update_pause` writes `pause.state` (L93) with no `emit!`; the program's only log is the per-transfer `msg!` (L71). Monitoring must poll the account.

**Impact:** An emergency pause — or a malicious unpause — leaves no structured on-chain event for alerting or indexers.

**Recommendation:**
```rust
#[event] pub struct PauseUpdated { pub state: bool, pub authority: Pubkey, pub slot: u64 }
emit!(PauseUpdated { state, authority: ctx.accounts.payer.key(), slot: Clock::get()?.slot });
```

---

#### [F-010] Key-material hygiene: mint keypair written to the repo root, `.gitignore` lacks key/env patterns

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | KV-001 (OPS-036 PARTIAL) |
| **Category** | Secrets Hygiene |
| **Language** | TypeScript / configuration |
| **File** | `tests/initialize.ts:61-65`, `.gitignore:1-4` |
| **Status** | Open |

**Description:**  
The initialization runbook serializes `mint.secretKey` to `mint-keypair.json` in the working directory (L61-65). `.gitignore` ignores only `node_modules`, `target`, `.DS_Store`, `test-ledger`; `.env` is tracked (it currently holds only public keys and URLs) and no keypair pattern or secret scanner exists. The mint keypair is useless after the mint is created (the account is owned by Token-2022), so the direct impact is low.

**Impact:** A future `.env` with secrets, a deployer keypair, or the mint keypair can be committed by accident; no automated control prevents it.

**Recommendation:**
```gitignore
.env
.env.*
*.pem
*keypair*.json
id.json
```
```ts
// tests/initialize.ts — do not persist the mint secret key; if it must be kept, write it outside the repo with 0600 permissions.
```

---

#### [F-011] Repository and operational hygiene gaps (build reproducibility, config, dead code, security contact)

| Field | Value |
|---|---|
| **Severity** | 1 — ⚪ INFO |
| **Checklist Item** | AV-002, OPS-044, OPS-047 (+ AV-010, OPS-026, OPS-071, FV-018 PARTIAL) |
| **Category** | Code Quality / Operations |
| **Language** | Rust / configuration |
| **File** | `Anchor.toml:1-8`, `programs/tbill/src/lib.rs:131,175`, `programs/tbill/Cargo.toml:25-27`, `README.md` |
| **Status** | Open |

**Description:**  
- `Anchor.toml` has an empty `[toolchain]` (no `anchor_version`/`solana_version`) and only a `[programs.localnet]` entry — no reproducible/verifiable build recipe and no mainnet/devnet program pin.
- `extra_account_meta_list` uses deprecated raw `AccountInfo<'info>` (L131) instead of `UncheckedAccount`.
- `pub enum Error` (L175) shadows `anchor_lang::prelude::Error`.
- Unused direct dependencies `spl-type-length-value`, `spl-pod`, `spl-token-2022` (Cargo.toml:25-27) and unused `token_program` accounts (L114, L138) widen the supply-chain and account surface for no benefit.
- No `SECURITY.md`/security contact and no incident runbook (pause, unpause, validation-account recovery, hook migration).

**Impact:** No direct vulnerability; reduces verifiability, incident readiness and disclosure hygiene.

**Recommendation:**
```toml
# Anchor.toml
[toolchain]
anchor_version = "0.30.1"
solana_version = "1.18.19"
[programs.mainnet]
tbill = "48n7YGEww7fKMfJ5gJ3sQC3rM6RWGjpUsghqVfXVkR5A"
```
```rust
pub extra_account_meta_list: UncheckedAccount<'info>;   // L131
#[error_code] pub enum TbillError { NotAdmin, Paused }  // L175
// remove spl-type-length-value / spl-pod / spl-token-2022 from Cargo.toml and the unused token_program accounts
```
Add `SECURITY.md` and `docs/RUNBOOK.md`.

---

### Findings by Severity (10 → 1)

#### Severity 10 — 🔴 CRITICAL
None

#### Severity 9 — 🔴 CRITICAL
None

#### Severity 8 — 🟠 HIGH
None

#### Severity 7 — 🟠 HIGH
None

#### Severity 6 — 🟡 MEDIUM
- F-002 — Mint authority on the deployer hot wallet (unbounded issuance by one key)

#### Severity 5 — 🟡 MEDIUM
- F-001 — Pre-fundable validation PDA bricks `initialize_extra_account_meta_list` (transfer DoS)

#### Severity 4 — 🔵 LOW
- F-003 — Privileged-key custody unverifiable / non-rotatable admin / upgrade authority (UNDETERMINED)

#### Severity 3 — 🔵 LOW
- F-004 — Hook does not check the `transferring` flag (direct invocation / log spoofing)
- F-005 — `pause` registered writable → global write lock on every transfer
- F-006 — Paused path untested; no CI / static analysis / fuzzing

#### Severity 2 — ⚪ INFO
- F-007 — Delegate transfers rejected by `token::authority = owner`
- F-008 — `init_if_needed` create/update conflation
- F-009 — No event on pause change
- F-010 — Key-material hygiene (`mint-keypair.json`, `.gitignore`)

#### Severity 1 — ⚪ INFO
- F-011 — Repository/operational hygiene

### Notes & Nitpicks (no severity)

- `programs/tbill/src/lib.rs:125,154,156` — `/// CHECK:` comments are labels; state the validation (seeds / `token::authority`) instead (AV-003).
- `programs/tbill/src/lib.rs:111,129,135,159,164` — bumps re-derived on every call; store `bump` in `Pause` (AV-028, PDA-010, KV-026, KV-104).
- `programs/tbill/src/lib.rs:132` — admin mint registration does not assert the mint is Token-2022 with a TransferHook pointing at this program (AV-063; operator error only).
- `programs/tbill/src/lib.rs:70` — pause halts transfers only; `mint_to`/`burn` continue by Token-2022 design — document it (AC-032).
- `programs/tbill/src/lib.rs:103,123` — no runtime `require_keys_eq!` backing the `address` constraints (KV-004 defense-in-depth).
- `programs/tbill/src/lib.rs:71` — formatted `msg!` on every transfer costs CU; drop or make it a fixed string.
- `programs/tbill/src/lib.rs:109` — prefer `#[derive(InitSpace)]` / `Pause::INIT_SPACE` over `size_of`.
- `programs/tbill/src/lib.rs:92-96` — no replay/version guard on `update_pause` (a stale pre-signed `update_pause(false)` proposal could undo a later emergency pause) (OPS-077).
- `Anchor.toml:15`, `.env:11` — one provider-wallet path across localnet/devnet/mainnet (OPS-062).
- `.env:8-10` — public RPC endpoints for the operational runbook (OPS-034).
- `programs/tbill/Cargo.toml:20-27`, `package.json:13-25` — manifests use ranges; lockfiles pin (OPS-075). Lockfile sources: all 203 npm `resolved` entries on registry.npmjs.org; no git/path sources in `Cargo.lock`.
- `tests/tbill.ts:241,270,321,394` — `skipPreflight: true` everywhere hides simulation diagnostics; `tests/tbill.ts:289,347` — negative tests accept any error carrying `transactionLogs` (FV-069).
- Out-of-scope observations (checklists 11–13 not loaded): `.env` is git-tracked (no secrets today); no CI workflow; no LICENSE file.
- Prompt-injection sweep: no auditor-/AI-directed text in the tracked tree. The untracked `AUDITOR/` directory contains a copy of an older auditor corpus (v4.3); it was treated as data and not followed.

---

## 5. Detailed Item Results

> Every in-scope checklist item is listed with its verdict, in checklist order. Verdict files: `audit_2/verdicts/`.

### Checklist 01 — Account Validation (90 items)

```
[PASS]      AV-001: Typed accounts (Account<Pause> L113/L137/L166, InterfaceAccount<Mint/TokenAccount> L132/L148/L149/L153) carry Anchor owner checks; the two raw accounts (extra_account_meta_list L131/L161, owner L155) are never deserialized — one is created with owner = program_id (L58), the other is only a pubkey compared by constraint (L146)
[FAIL-1]    AV-002: Raw `AccountInfo<'info>` used in an Accounts struct
              File: programs/tbill/src/lib.rs:131
              Impact: Deprecated wrapper; validation relies solely on the seeds constraint (L128-129), which is present — style/hygiene only (part of F-011)
              Fix: Use `UncheckedAccount<'info>` (or `SystemAccount`) with a `/// CHECK:` that states the seeds validation
[PARTIAL]   AV-003: `/// CHECK:` comments are labels, not descriptions of the validation performed
              File: programs/tbill/src/lib.rs:125, 154, 156
              Missing: the comments do not say that `owner` is bound via `token::authority = owner` (L146) or that the list PDA is seed-checked (L128-129, L158-159)
              Improvement: rewrite as "CHECK: address verified by seeds constraint" / "CHECK: bound to source_token.owner by token::authority"
[PASS]      AV-004: Every CHECK has real code behind it — owner ↔ L146; extra_account_meta_list ↔ L128-129 and L158-159
[PASS]      AV-005: `Account<'info, Pause>` matches the single `#[account] struct Pause` (L169-172)
[PASS]      AV-006: source/destination are `InterfaceAccount<'info, TokenAccount>` (L148, L153)
[PASS]      AV-007: mint is `InterfaceAccount<'info, Mint>` (L132, L149)
[PASS]      AV-008: `Program<'info, System>` (L115, L139), `Program<'info, Token2022>` (L114, L138); Rent obtained by syscall `Rent::get()` (L38)
[PASS]      AV-009: Only this program's `Pause` is loaded as `Account<T>`; no foreign-program struct
[PARTIAL]   AV-010: `declare_id!` (L18) matches `Anchor.toml:8` for localnet only
              File: Anchor.toml:7-8
              Missing: no `[programs.devnet]`/`[programs.mainnet]` entries and no `target/deploy/*-keypair.json` in the repo, so the deployed program ID cannot be confirmed from the tree (part of F-011)
              Improvement: add cluster-specific program entries and verify the on-chain ID with `solana program show`
[PASS]      AV-011: `Pause` uses `#[account]` → 8-byte Anchor discriminator (L169); the validation account uses the SPL TLV discriminator written by `ExtraAccountMetaList::init::<ExecuteInstruction>` (L61) and is never loaded as an Anchor account
[PASS]      AV-012: Both program-owned account kinds are address-bound by `seeds` (L110, L128, L134, L158, L163); neither can be passed in the other's slot
[N/A]       AV-013: `remaining_accounts` not used (grep: zero hits in programs/)
[N/A]       AV-014: `remaining_accounts` not used
[PASS]      AV-015: Single Anchor account type; no discriminator collision possible
[PASS]      AV-016: `#[account]` attribute used (L169); no manual Borsh state
[N/A]       AV-017: No account migrations/versions exist
[PASS]      AV-018: `mut` present where lamports or data change: payer (L102, L122), pause on init (L106), extra_account_meta_list on create (L127); `TransferHook` mutates nothing and marks nothing `mut`
[FAIL-3]    AV-019: The extra account meta for `pause` is registered `is_writable = true` although `transfer_hook` only reads it
              File: programs/tbill/src/lib.rs:34
              Impact: Every Token-2022 transfer of the mint acquires a write lock on one global PDA, serializing all TBILL transfers cluster-wide (see F-005, KV-131)
              Fix: `ExtraAccountMeta::new_with_seeds(&[...], false, false)` and keep `pause` read-only in `TransferHook`
[N/A]       AV-020: No stored-pubkey relationships exist (`Pause` has no key fields); the admin binding uses `address = ADMIN_PUBKEY` (L103, L123)
[N/A]       AV-021: No `has_one` constraints to back up
[PASS]      AV-022: `pause` init uses `payer`, `space`, `seeds`, `bump` (L106-112)
[FAIL-2]    AV-023: `init_if_needed` is used where a plain `init` plus a separate mutate-only instruction would do
              File: programs/tbill/src/lib.rs:107
              Impact: Create and update semantics are conflated in one admin instruction; a future field added to `Pause` would be silently re-defaulted/overwritten (F-008)
              Fix: `initialize_pause` with `init` (fail-closed default `state = true`) and `update_pause` with `mut` only
[PASS]      AV-024: Re-invocation is the intended semantics — the handler overwrites the only field with the admin-supplied value (L93) and the caller is bound to ADMIN_PUBKEY (L103); no authority/accounting field can be reset (FP-5 satisfied)
[N/A]       AV-025: No `close` constraint in the program (grep: zero hits)
[N/A]       AV-026: No close path
[PASS]      AV-027: `[b"pause"]` is intentionally a global singleton; `[b"extra-account-metas", mint]` is per-mint — distinct prefixes, no cross-entity collision
[PARTIAL]   AV-028: Bumps are re-derived by `find_program_address` at every constraint (L111, L129, L135, L159, L164) instead of being stored
              File: programs/tbill/src/lib.rs:159, 164
              Missing: stored bump on `Pause`; CU cost on every transfer (two derivations per hook call)
              Improvement: add `bump: u8` to `Pause` and use `bump = pause.bump`
[PASS]      AV-029: Custom errors on the only constraints with `@` (`Error::NotAdmin`, L103/L123)
[N/A]       AV-030: No `realloc`
[PASS]      AV-031: `UpdatePause` has two `mut` accounts but `payer` must equal ADMIN_PUBKEY (a wallet/multisig key) and `pause` is a program PDA — aliasing is impossible even on Anchor 0.30.1 (pre-0.31, no automatic dup rejection)
[N/A]       AV-032: `remaining_accounts` not used — the hook receives its extras as named struct fields
[N/A]       AV-033: `remaining_accounts` not used
[N/A]       AV-034: `remaining_accounts` not used
[N/A]       AV-035: `remaining_accounts` not used
[N/A]       AV-036: `remaining_accounts` not used
[N/A]       AV-037: No external CPI receives pass-through accounts
[N/A]       AV-038: `remaining_accounts` not used
[N/A]       AV-039: No investor-position accounts exist
[PASS]      AV-040: `Pause` space = `size_of::<Pause>() + 8` = 1 + 8 = 9 bytes for `state: bool` (L109, L169-172); validation account size from the official `ExtraAccountMetaList::size_of(1)` helper (L37)
[PASS]      AV-041: Rent-exempt minimum used for the manual create (L38) and by Anchor init (L106-112)
[N/A]       AV-042: No `Vec`/`String` fields in state
[N/A]       AV-043: No `realloc`
[N/A]       AV-044: No size-reduction path
[PASS]      AV-045: `token::mint = mint` on both token accounts the hook receives (L145, L151)
[PASS]      AV-046: `token::authority = owner` binds the source account's owner to the authority Token-2022 passes (L146); the hook takes no action on `destination_token`, so its owner needs no binding
[N/A]       AV-047: No vault accounts — the program custodies nothing
[N/A]       AV-048: No ATA derivation in the program
[FAIL-2]    AV-049: Delegate transfers are not considered — `token::authority = owner` compares the token account's `owner` field with the authority passed by Token-2022, which is the delegate for delegated transfers
              File: programs/tbill/src/lib.rs:146
              Impact: Any `approve` + delegated `transfer_checked` of TBILL (escrow programs, custodial flows, a future permanent delegate) fails with a constraint error — a liveness/design limitation, fail-closed (F-007)
              Fix: Drop `token::authority = owner` (the hook does not use `owner`) or accept `source_token.delegate == Some(owner.key())` explicitly, and document the intended delegate policy
[PASS]      AV-050: Token-2022 rejects transfers involving frozen accounts before invoking the hook; the test at tests/tbill.ts:327-353 demonstrates the frozen-destination rejection
[N/A]       AV-051: No WSOL handling
[PASS]      AV-052: `Program<'info, Token2022>` (L114, L138) pins the token program where one is passed; hook accounts use `InterfaceAccount`, and only Token-2022 can invoke a transfer hook
[PASS]      AV-053: `pause` re-init is the intended admin update (AV-024); the validation account cannot be re-created — System `create_account` fails on an existing account (L47-59)
[PASS]      AV-054: Manual creation of the validation account (L47-64) relies on System `create_account` refusing a non-empty target, which makes an `is_initialized` flag unnecessary for reinit (but see AV-087 for the pre-funding failure mode)
[N/A]       AV-055: No close path
[N/A]       AV-056: No close path (KV-106 N/A)
[N/A]       AV-057: No close path
[PASS]      AV-058: Token program typed as Token-2022 (L114, L138); `InterfaceAccount`/`token_interface` used for mint and token accounts (L7, L132, L148-153); the program never CPIs into a token program
[N/A]       AV-059: The program neither derives nor assumes ATAs
[N/A]       AV-060: The program performs no token transfers/mints/burns
[N/A]       AV-061: No amount arithmetic; `decimals` unused
[N/A]       AV-062: No crediting/accounting
[PARTIAL]   AV-063: `initialize_extra_account_meta_list` accepts any `InterfaceAccount<Mint>` without verifying it is a Token-2022 mint whose TransferHook extension points at this program
              File: programs/tbill/src/lib.rs:132
              Missing: `StateWithExtensions::<Mint>::unpack` + `get_extension::<TransferHook>()?.program_id == crate::ID` check; admin-gated (L120-124) so the exposure is operator error, not attack
              Improvement: assert mint owner == Token-2022 and hook program id == this program before creating the validation account
[N/A]       AV-064: No custodied balances
[N/A]       AV-065: The program custodies no tokens; mint/freeze authority custody of the TBILL mint is assessed under checklist 07 (F-002, F-003)
[PASS]      AV-066: Effective mint allowlist — a validation account (and therefore hook enforcement) exists only for mints the admin registers (L120-124)
[N/A]       AV-067: No vault; delegate policy covered under AV-049
[PASS]      AV-068: Rent read via `Rent::get()` syscall (L38)
[N/A]       AV-069: No sysvar accounts are passed
[N/A]       AV-070: No time-gated logic
[N/A]       AV-071: No instruction introspection (grep: zero hits for sysvar/ed25519/secp256k1)
[N/A]       AV-072: No introspection-based signature checks
[N/A]       AV-073: No introspected messages
[N/A]       AV-074: No introspection
[PASS]      AV-075: Privileged accounts bound by `address =` (L103, L123) and `seeds` (L110, L128, L134, L158, L163); nothing is trusted by position
[PASS]      AV-076: `bump` with no value → Anchor canonical bump; signer seeds use `ctx.bumps.extra_account_meta_list` (L44); no user-supplied bump anywhere
[N/A]       AV-089: No ComputeBudget introspection
[N/A]       AV-090: No introspection loops or instruction-count assumptions; the hook's account list is fixed by the interface and validated by Anchor
[PASS]      AV-077: Framework detected: Anchor 0.30.1 (`#[program]` L22, `#[derive(Accounts)]` L99/L118/L142); not native/Pinocchio
[N/A]       AV-078: Anchor program — automatic owner checks (feature absent: pinocchio/no_std/entrypoint!)
[N/A]       AV-079: Anchor program — `Signer<'info>` used (L105, L124)
[N/A]       AV-080: Anchor program — account count and deserialization handled by the framework
[N/A]       AV-081: No `unsafe` blocks (read of lib.rs L1-181)
[N/A]       AV-082: Anchor discriminators (AV-011)
[N/A]       AV-083: Pinocchio not used
[N/A]       AV-084: Not a p-token reimplementation
[FAIL-5]    AV-085: `initialize_extra_account_meta_list` assumes the target PDA holds exactly 0 lamports — System `create_account` returns `AccountAlreadyInUse` when the destination already has lamports
              File: programs/tbill/src/lib.rs:47-59
              Impact: Anyone can send 1 lamport to the deterministic address `[b"extra-account-metas", mint]` before the admin initializes it, after which the validation account can never be created and every transfer of that mint fails (F-001, KV-123/KV-127)
              Fix: Mirror Anchor's init: if `lamports() > 0` then `transfer(diff)` + `allocate` + `assign` (PDA-signed), else `create_account`; or use `#[account(init, payer, space, seeds, bump)]`
[PASS]      AV-086: No builtin/sysvar/precompile account is required writable; `pause` (a program PDA) is the only over-privileged account (AV-019)
[FAIL-5]    AV-087: The manual `create_account` path does not tolerate a pre-existing/pre-funded target
              File: programs/tbill/src/lib.rs:47-59
              Impact: Permissionless pre-creation DoS of the per-mint validation account (F-001); `update_pause` (L106-113) is tolerant via Anchor `init_if_needed`
              Fix: As AV-085
[N/A]       AV-088: No `unsafe` deserialization, `set_len`, `assume_init` or manual decoders (grep: zero hits)
```

### Checklist 02 — Access Control (50 items)

```
[PASS]      AC-001: Both lamport-moving instructions require a signer — `payer: Signer` (L105 update_pause, L124 initialize_extra_account_meta_list)
[PASS]      AC-002: Both state-writing instructions require the admin signer (L101-105, L120-124); `transfer_hook` writes no state (L69-73)
[PASS]      AC-003: The admin signer is bound by `address = ADMIN_PUBKEY @ Error::NotAdmin` (L103, L123) — a compile-time constant rather than a stored field; linkage is enforced (rotation cost noted in F-003)
[PASS]      AC-004: No manual `is_signer` checks; `Signer<'info>` used (L105, L124)
[N/A]       AC-005: No manual `is_signer` check exists
[PASS]      AC-006: Admin instructions combine `Signer` + `address` constraint (L101-105, L120-124); there is no Fund-style state account to `has_one` against
[N/A]       AC-007: No investor instructions
[N/A]       AC-008: No delegate instruction in the program; delegate transfers through the hook are rejected by `token::authority = owner` (AV-049 / F-007)
[PASS]      AC-009: Nobody acts on behalf of another — the hook relies on Token-2022 having already verified the transfer authority's signature
[PASS]      AC-010: `transfer_hook`/`fallback` is permissionless (L69-90) but moves no value; documented — value movement is done by Token-2022 with the holder's own signature
[PASS]      AC-011: Roles: admin (`ADMIN_PUBKEY`) → update_pause, initialize_extra_account_meta_list; anyone/Token-2022 → transfer_hook, fallback. Each instruction maps to exactly one role
[PASS]      AC-012: No instruction has an ambiguous role
[PASS]      AC-013: Admin instructions cannot be reached by spoofing — the constraint is on the `Signer`'s own address (L103, L123), not on a passed-in state account
[N/A]       AC-014: No investor instructions
[FAIL-4]    AC-015: Admin is a hardcoded constant `ADMIN_PUBKEY = CPNEkz5…` (L20); README:43 says it "should be a Squads multisig" but nothing in the repo proves it, and the committed test flow signs `update_pause` with the local provider wallet (tests/tbill.ts:217), which only succeeds if that wallet IS the admin key
              File: programs/tbill/src/lib.rs:20
              Impact: If the constant is an EOA, one key compromise pauses every TBILL transfer (global DoS); the admin cannot be rotated without a program upgrade; upgrade-authority custody is likewise undocumented (F-003)
              Fix: Verify on-chain that the address is a Squads vault PDA; move the admin into a config PDA with a two-step transfer; document upgrade-authority custody
[PASS]      AC-016: Admin capabilities enumerated: set/clear global pause (L92-96) and create per-mint validation accounts (L26-67). Admin cannot mint, burn, freeze, or move tokens — those are Token-2022 authorities outside the program
[PASS]      AC-017: No bypass/god-mode path beyond the documented pause; the hook has exactly one gate (L70)
[N/A]       AC-018: No manager/investor distinction
[N/A]       AC-019: No manager/investor distinction
[N/A]       AC-020: No funds
[N/A]       AC-021: No positions
[N/A]       AC-022: No investor funds in program custody
[N/A]       AC-023: No fees
[N/A]       AC-024: No fees
[N/A]       AC-025: No treasury
[N/A]       AC-026: No treasury
[N/A]       AC-027: No platform fee
[N/A]       AC-028: No transferable ownership concept — the admin is a constant (rotation covered by AC-015)
[PASS]      AC-029: The effective mint allowlist (validation accounts) can only be extended by the admin (L120-124); there is no removal instruction (see SM checklist)
[PASS]      AC-030: Pause mechanism exists — `Pause.state` (L169-172) gated at L70
[PASS]      AC-031: Only `ADMIN_PUBKEY` can toggle it (L101-105)
[PARTIAL]   AC-032: Pause blocks Token-2022 `transfer`/`transfer_checked` only — `mint_to` and `burn` never invoke a transfer hook by Token-2022 design
              File: programs/tbill/src/lib.rs:70
              Missing: issuance (mint authority) and redemption burns continue while paused; acceptable if intended, but undocumented
              Improvement: document that pause is a secondary-transfer stop, and rely on the freeze authority / mint-authority process for issuance-side halts
[N/A]       AC-033: No manager fees
[N/A]       AC-034: No withdrawals; holders can still burn their own tokens while paused (AC-032)
[N/A]       AC-035: A pause mechanism exists
[PASS]      AC-036: Freeze authority is set (tests/initialize.ts:121 → Squads multisig) with `DefaultAccountState = Frozen` (tests/initialize.ts:90, 112-116) — intentional compliance allowlist; trust assumption recorded in intake §6
[FAIL-6]    AC-037: Mint authority of the TBILL mint is the deploy hot wallet (`wallet.publicKey`, tests/initialize.ts:120 and :129) while freeze, hook and metadata authorities go to the multisig
              File: tests/initialize.ts:120
              Impact: A single hot key can mint unbounded TBILL into any already-thawed (KYC-approved) account; DefaultAccountState=Frozen does not protect existing holders' accounts (F-002)
              Fix: Set the mint authority to the Squads multisig at initialization (or `set_authority` to it in the same transaction) and add a monitored process for issuance
[N/A]       AC-038: (evaluated) Freeze authority controlled by the multisig (tests/initialize.ts:121) — see AC-036; no separate shares mint exists
[FAIL-5]    AC-039: The per-mint validation PDA can be pre-funded by anyone, which makes the admin's manual `create_account` fail permanently (System `AccountAlreadyInUse`)
              File: programs/tbill/src/lib.rs:47-59
              Impact: Permissionless griefing that blocks all transfers of the mint until the hook authority swaps the hook program (F-001)
              Fix: Handle the pre-funded case as Anchor `init` does (transfer + allocate + assign)
[N/A]       AC-040: No positions
[FAIL-5]    AC-041: Shared state that an attacker can influence: the validation-account address (pre-funding, F-001). `pause` itself is admin-only (L101-105)
              File: programs/tbill/src/lib.rs:47-59
              Impact: Transfers (the token's only value-moving user flow) can be blocked before initialization
              Fix: As AC-039
[N/A]       AC-042: No close instruction
[PASS]      AC-043: No off-chain replayable authority; Solana recent-blockhash protects on-chain replay; nonce/durable-nonce not used (grep: zero hits)
[N/A]       AC-044: No user-facing stateful operations that would need rate limiting; both admin instructions are idempotent
[PASS]      AC-045: No permissionless `init` — both creating instructions require the admin as payer (L102-105, L120-124)
[PASS]      AC-046: The hook is stateless and the admin instructions are single-account; no authority context carries across instructions
[N/A]       AC-047: No close path
[PASS]      AC-048: The only outbound CPI is System `create_account` (L47-59), a builtin that cannot call back
[PASS]      AC-049: No CPI in the hook path (L69-73); the init CPI targets a builtin — no re-entrant edge exists (false-positives FP-1)
[PASS]      AC-050: Signer seeds `[b"extra-account-metas", mint, bump]` (L41-45) are a PDA of this program; another program cannot produce that signature
```

> AC-038 note: recorded as `[N/A]` in the tally (no shares mint managed by the program); the TBILL mint's freeze authority is covered by AC-036 / KV-019.

### Checklist 03 — Arithmetic Safety (63 items)

Evidence base: the only arithmetic in `programs/tbill/src/lib.rs` is `size_of::<Pause>() + 8` (L109, constant), `ExtraAccountMetaList::size_of(1)? as u64` (L37) and `account_size as usize` (L38). `Cargo.toml:8` sets `overflow-checks = true` for release. Grep for `checked_`, `saturating_`, `wrapping_`, `/`, `*`, `f32`, `f64`: zero hits.

```
[PASS]      AR-001: The single `+` (L109) is a compile-time constant expression (`size_of::<Pause>() + 8`); no state- or user-derived addition exists
[N/A]       AR-002: No subtraction in the program
[N/A]       AR-003: No multiplication in the program
[N/A]       AR-004: No division in the program
[PASS]      AR-005: No bare operators on financial values — the program handles no financial values; `amount` (L69) is only logged (L71)
[PASS]      AR-006: No `saturating_*` (grep: zero hits)
[PASS]      AR-007: No `wrapping_*` (grep: zero hits)
[PASS]      AR-008: L109 operands are constants (`size_of::<Pause>()` = 1, literal 8)
[PASS]      AR-009: `space = size_of::<Pause>() + 8` (L109) is the accepted compile-time space idiom
[N/A]       AR-010: No `a * b / c` pattern
[N/A]       AR-011: No share calculation
[N/A]       AR-012: No fee calculation
[N/A]       AR-013: No proportion calculation
[PASS]      AR-014: No u128 values; the only cast is `usize → u64` (L37) of a library-computed size (≤ 51 bytes for one meta), which cannot truncate
[PASS]      AR-015: No `as u64` on u128
[N/A]       AR-016: No `as u32` casts
[N/A]       AR-017: No `as i64` casts
[N/A]       AR-018: No division
[N/A]       AR-019: No share pricing
[N/A]       AR-020: No withdrawal proportion
[N/A]       AR-021: No truncating division
[N/A]       AR-022: No share minting
[N/A]       AR-023: No share redemption
[N/A]       AR-024: No rounding surface
[N/A]       AR-025: No depositor/share model
[N/A]       AR-026: No share minting formula
[N/A]       AR-027: No share minting
[N/A]       AR-028: No share burning formula
[N/A]       AR-029: No slippage-bearing operation
[N/A]       AR-030: No slippage-bearing operation
[N/A]       AR-031: No vault to donate into (program custodies nothing)
[N/A]       AR-032: No shares
[N/A]       AR-033: No shares
[N/A]       AR-034: No shares mint managed by the program
[N/A]       AR-035: No management fee
[N/A]       AR-036: No performance fee
[N/A]       AR-037: No platform fee
[N/A]       AR-038: No fee split
[N/A]       AR-039: No fee bps
[N/A]       AR-040: No fee minimum
[N/A]       AR-041: No fee ordering
[N/A]       AR-042: No compounding fees
[N/A]       AR-043: No fee calculation
[N/A]       AR-062: No multi-component rate configuration
[N/A]       AR-044: No NAV computation
[N/A]       AR-045: No NAV computation
[N/A]       AR-046: No NAV computation
[N/A]       AR-047: No NAV attestation
[N/A]       AR-048: No NAV attestation
[N/A]       AR-049: No NAV attestation PDA
[N/A]       AR-050: No NAV staleness concept
[PASS]      AR-051: Lamports are `u64` end-to-end — `Rent::minimum_balance` returns u64 (L38) and is passed unchanged to `create_account` (L56)
[PASS]      AR-052: The lamport transfer is performed by the System program's `create_account`, which enforces the payer's balance; the payer is the admin (L120-124)
[PASS]      AR-053: Both program accounts are created rent-exempt (L38, Anchor init L106-112) and nothing ever debits them
[N/A]       AR-054: No lamport-draining path exists
[N/A]       AR-055: No WSOL handling
[PASS]      AR-056: `amount = u64::MAX` reaches only `msg!` (L71) — no arithmetic; `state: bool` has no range
[PASS]      AR-057: `amount = 0` is accepted and logged (Token-2022 permits zero-amount transfers); no path depends on the value
[PASS]      AR-058: `amount = 1` — same as AR-057
[N/A]       AR-059: No shares
[N/A]       AR-060: No investor set
[N/A]       AR-061: No timestamp arithmetic (`Clock` unused)
[PASS]      AR-063: No floating point anywhere (grep `f32|f64|powf|sqrt`: zero hits)
```

### Checklist 04 — CPI & PDA Safety (70 items)

CPI inventory (grep `CpiContext|invoke`): exactly one outbound CPI — System `create_account` at L47-59 via `CpiContext::new(...).with_signer(...)`. Inbound: Token-2022 → `Execute` → `fallback` (L75-90). Per-CPI-site checklist (anchor.md §8) at L47-59: program ID typed (`Program<System>` L139) ✓ · post-CPI read is on the raw `AccountInfo` (L62), no stale Anchor cache ✓ · signer seeds + canonical bump (L41-45) ✓ · callee is an immutable builtin, no re-entrancy edge ✓ · trust classified: immutable ✓.

```
[N/A]       CPI-001: Anchor 0.30.1 API — `CpiContext::new` takes an `AccountInfo` (L48-49); the `Pubkey` form is an Anchor 1.0 signature that does not exist in this version
[N/A]       CPI-002: Same as CPI-001 — `.with_signer` on the 0.30 `CpiContext` (L55)
[N/A]       CPI-003: No CPI into a token program (the `token_program` accounts at L114/L138 are typed `Program<Token2022>` but unused)
[PASS]      CPI-004: The System CPI target is `Program<'info, System>` (L139), used at L49
[N/A]       CPI-005: No Associated Token Program CPI
[N/A]       CPI-006: No DEX CPI
[N/A]       CPI-007: No Metaplex CPI
[PASS]      CPI-008: No `UncheckedAccount`/`AccountInfo` is used as a CPI program (L49 is the typed system program)
[N/A]       CPI-009: No `remaining_accounts` pass-through
[N/A]       CPI-010: No raw `invoke_signed`; the Anchor wrapper binds the program ID to the typed account
[N/A]       CPI-011: No `token::transfer` CPI
[N/A]       CPI-012: No `token::transfer` CPI
[N/A]       CPI-013: No `token::transfer` CPI
[N/A]       CPI-014: No `token::transfer` CPI
[N/A]       CPI-015: No `mint_to` CPI
[N/A]       CPI-016: No `mint_to` CPI
[N/A]       CPI-017: No `mint_to` CPI
[N/A]       CPI-018: No `mint_to` CPI
[N/A]       CPI-019: No `burn` CPI
[N/A]       CPI-020: No `burn` CPI
[N/A]       CPI-021: No `burn` CPI
[N/A]       CPI-022: No `close_account` CPI
[N/A]       CPI-023: No `close_account` CPI
[N/A]       CPI-024: No `close_account` CPI
[PASS]      CPI-025: System `create_account`: `from` = admin signer (L51, bound at L120-124), `to` = seed-verified PDA (L52, L126-130), owner = `ctx.program_id` (L58)
[N/A]       CPI-026: No `approve` CPI
[N/A]       CPI-027: No `revoke` CPI
[PASS]      PDA-001: `[b"pause"]` (global singleton by design) and `[b"extra-account-metas", mint.key()]` (per mint) contain every component needed for their scope
[N/A]       PDA-002: No fund PDA
[PASS]      PDA-003: pause → L110, L134, L163; validation list → L128, L158, signer seeds L41-45 — all components present in every reference
[PASS]      PDA-004: Seed order identical across init and use (L128 ≡ L158 ≡ L42-43; L110 ≡ L134 ≡ L163)
[N/A]       PDA-005: No vault/treasury PDA
[N/A]       PDA-006: The mint is a keypair account created off-chain (tests/initialize.ts:55), not a PDA
[N/A]       PDA-007: No attestation/oracle PDA
[N/A]       PDA-008: `pause` is a deliberate global singleton — no parent entity exists to scope it to
[PASS]      PDA-009: No derivation/usage mismatch (PDA-003/004)
[PARTIAL]   PDA-010: Bumps are re-derived on every call (`bump` without stored value at L111, L129, L135, L159, L164)
              File: programs/tbill/src/lib.rs:159, 164
              Missing: stored bump on `Pause`; each transfer pays two `find_program_address` derivations
              Improvement: persist `bump` in `Pause` and reference `bump = pause.bump`
[PASS]      PDA-011: Seeds are a literal and a 32-byte pubkey — no variable-length user data
[N/A]       PDA-012: No name seeds
[PASS]      PDA-013: Seeds are immutable (literal, mint address)
[PASS]      PDA-014: `with_signer(&[&[b"extra-account-metas", mint.as_ref(), &[bump]]])` (L41-45, L55) signs for the exact PDA being created
[PASS]      PDA-015: Signer seed order matches the constraint (L128 vs L42-43)
[PASS]      PDA-016: `ctx.bumps.extra_account_meta_list` (L44) is the canonical bump Anchor verified at L129
[PASS]      PDA-017: The PDA is the `to` of `create_account` and must sign — `with_signer` is used (L55)
[PASS]      PDA-018: No `invoke` where `invoke_signed` is required
[PASS]      PDA-019: CPI instruction data is fully program-constructed (lamports L38, space L37, owner L58); no caller input reaches it
[N/A]       PDA-020: No Jupiter CPI
[N/A]       PDA-021: No `realloc` (grep: zero hits)
[N/A]       EXT-001: No Jupiter
[N/A]       EXT-002: No Jupiter
[N/A]       EXT-003: No Jupiter
[N/A]       EXT-004: No Jupiter
[N/A]       EXT-005: No Jupiter
[N/A]       EXT-006: No Jupiter
[N/A]       EXT-007: No Metaplex
[N/A]       EXT-008: No Metaplex
[N/A]       EXT-009: No whitelisted protocol CPI
[N/A]       EXT-010: No whitelist account
[PASS]      EXT-011: The only callee is the System builtin — it cannot call back with escalated privileges
[N/A]       EXT-012: The program custodies no hook-bearing mint; it IS the hook. As hook author: extra accounts are registered at L29-35 and address-validated at L157-166
[N/A]       EXT-013: No custodied mints (admin-registered mint is not extension-inspected — recorded at AV-063)
[N/A]       EXT-014: No token movement in the program
[N/A]       EXT-015: The program creates no mint. (The off-chain script creates mint + metadata atomically with update authority = multisig, tests/initialize.ts:92-133 — no unclaimed-metadata window)
[PASS]      RE-001: The only write after the CPI (L61-64) targets the account the CPI just created; the callee is a builtin with no callback path (FP-1)
[PASS]      RE-002: The post-CPI access uses `try_borrow_mut_data()` on the live `AccountInfo` (L62), not a pre-CPI deserialized cache
[N/A]       RE-003: No Anchor-typed account is mutated by a CPI, so `.reload()` is not required
[N/A]       RE-004: No approvals granted
[N/A]       RE-005: No NAV/deposit/withdraw surface; the hook holds no value
[PASS]      RE-006: The callee is the System program with an explicit `lamports` argument (L56); the only signer forwarded is the admin payer and the spend is bounded by the argument
[PASS]      RE-007: The account written after the CPI was assigned to this program by the CPI itself (L58); no reliance on a pre-CPI owner of an attacker-influenced account
```

### Checklist 05 — State Machine & Lifecycle (72 items)

Lifecycle reconstructed from code (not docs):

```
[no accounts] --update_pause(admin, s)--> Pause{state=s}  (init_if_needed, L106-113)
Pause{state=s} --update_pause(admin, s')--> Pause{state=s'}          (L93; any s→s')
Pause exists --initialize_extra_account_meta_list(admin, mint)--> ExtraAccountMetaList[mint] (one-shot, L47-64)
ExtraAccountMetaList[mint] ∧ Pause{state=false} --Token-2022 transfer--> hook Ok (L70)
ExtraAccountMetaList[mint] ∧ Pause{state=true}  --Token-2022 transfer--> Error::Paused (L70)
ExtraAccountMetaList[mint] missing               --Token-2022 transfer--> transfer fails (validation account unresolvable)
```
No terminal state; no close path; no timestamps; no enums.

```
[PASS]      SM-001: No state enums exist; the only state is `Pause.state: bool` (L169-172) — enumerated
[PASS]      SM-002: Variants: `true` (paused) / `false` (open)
[PASS]      SM-003: Both values are reachable via `update_pause(state)` (L92-96)
[PASS]      SM-004: Both values can be left via `update_pause` (L92-96); neither is terminal
[PASS]      SM-005: No dead variants
[PASS]      SM-006: `Pause` is program-owned with an Anchor discriminator (L169); only L93 writes it
[PASS]      SM-007: No terminal state by design — pause is a reversible switch
[N/A]       SM-008: No terminal state; the two singleton PDAs are intended to be permanent (rent locked ≈ 9 + 51 bytes)
[N/A]       SM-009: No withdrawal flow in the program
[N/A]       SM-010: No withdrawal flow
[N/A]       SM-011: No withdrawal flow
[N/A]       SM-012: No withdrawal flow
[N/A]       SM-013: No withdrawal flow
[N/A]       SM-014: No withdrawal flow
[N/A]       SM-015: No withdrawal flow
[N/A]       SM-016: No withdrawal flow
[N/A]       SM-017: No withdrawal flow
[N/A]       SM-018: No withdrawal flow
[N/A]       SM-019: No withdrawal flow
[N/A]       SM-020: No withdrawal flow
[N/A]       SM-021: No withdrawal flow
[N/A]       SM-022: No withdrawal flow
[N/A]       SM-023: No withdrawal flow
[N/A]       SM-024: No withdrawal flow
[N/A]       SM-025: No fund account
[N/A]       SM-026: No fund account
[PASS]      SM-027: The validation account cannot be re-created (System `create_account` rejects an existing account, L47-59); `pause` re-init is the intended admin update with no other fields (AV-024)
[N/A]       SM-028: No fund closure
[N/A]       SM-029: No fund closure
[N/A]       SM-030: No fund closure
[N/A]       SM-031: No fund; the two PDAs have no close instruction by design (rent ≈ 0.0013 SOL locked, no user funds)
[N/A]       SM-032: No name seeds
[N/A]       SM-033: No deposits
[N/A]       SM-034: No deposits
[N/A]       SM-035: No positions
[N/A]       SM-036: No positions
[N/A]       SM-037: No positions
[N/A]       SM-038: No positions
[N/A]       SM-039: No positions
[N/A]       SM-040: No positions
[PASS]      SM-041: `update_pause` performs an unconditional idempotent set (L93); no transition is order-sensitive, so a current-status precondition is unnecessary
[N/A]       SM-042: A two-valued boolean has no intermediate state to skip
[PASS]      SM-043: The transition is a single field write (L93)
[PASS]      SM-044: Solana transaction atomicity — a failed instruction rolls back every write (false-positives FP-4); no cross-transaction half-state exists
[PASS]      SM-045: Repeating `update_pause` with the same value is harmless (idempotent); repeating `initialize_extra_account_meta_list` fails at L47-59
[N/A]       SM-046: No close path
[FAIL-2]    SM-047: The control-plane transition `pause.state` change emits no event (`emit!` absent; grep: zero hits); the hook only logs `msg!` (L71)
              File: programs/tbill/src/lib.rs:92-96
              Impact: Monitoring/indexers cannot subscribe to pause changes and must poll the account; an emergency pause (or a malicious unpause) leaves no structured on-chain event (F-009)
              Fix: `emit!(PauseUpdated { state, authority: ctx.accounts.payer.key(), slot: Clock::get()?.slot })`
[N/A]       SM-048: No events exist (SM-047)
[FAIL-3]    SM-049: The only log the program produces (`msg!("Amount sent: {}", amount)`, L71) can be emitted without any transfer — `fallback`/`transfer_hook` are directly callable with an attacker-chosen `amount` and attacker-owned token accounts that satisfy L144-166; the hook never checks the source account's Token-2022 `transferring` flag
              File: programs/tbill/src/lib.rs:69-90
              Impact: Any off-chain consumer treating this program's logs as transfer evidence is spoofable; no on-chain state effect today (F-004)
              Fix: Assert the `TransferHookAccount` extension's `transferring` flag on `source_token` (the `check_is_transferring` pattern) or drop the log
[PARTIAL]   SM-050: Off-chain state reconstruction must read the `pause` account directly; no event stream exists
              File: programs/tbill/src/lib.rs:92-96
              Missing: structured events (see F-009)
              Improvement: emit events for pause changes and validation-account creation
[N/A]       SM-051: No shares
[N/A]       SM-052: No shares
[N/A]       SM-053: No vault
[N/A]       SM-054: No deposits
[N/A]       SM-055: No withdrawals
[N/A]       SM-056: No swaps
[N/A]       SM-057: No timestamp fields (`Clock` unused)
[N/A]       SM-058: No timestamp sentinels
[N/A]       SM-059: No terminal states
[N/A]       SM-060: No terminal states
[N/A]       SM-061: No asset draining
[N/A]       SM-062: No time gates
[N/A]       SM-063: No time gates
[PASS]      SM-064: Every transition of the boolean is legal by design; there is no illegal transition an allowlist matrix would need to reject
[N/A]       SM-065: No terminal states
[PASS]      SM-066: The admin can only set `state` (L93); there is no lifecycle rewrite an authorized actor could perform illegally
[N/A]       SM-067: Single-field state — no sub-state to preserve
[N/A]       SM-068: No fixed-slot collections (grep: zero hits for `Pubkey::default|break|for .*positions`)
[N/A]       SM-069: No cached aggregates
[N/A]       SM-070: No vesting/elapsed-time math
[N/A]       SM-071: No time units
[N/A]       SM-072: No cliff logic
```

### Checklist 06 — Economic & Logic Attacks (89 items)

Attack-scenario sweep (FULL-AUDIT Step 1.3), against the actual code:
1. Flash loan — no deposit/withdraw/NAV surface; the program holds no value. Not applicable.
2. Sandwich/MEV — no swaps or price-sensitive instructions. Not applicable.
3. First depositor — no shares. Not applicable.
4. NAV manipulation — no NAV. Not applicable.
5. Fee exploitation — no fees. Not applicable.
6. Rug pull — program admin can only pause (DoS). Token-level: mint authority on a hot wallet can inflate supply (F-002); freeze authority (multisig) can freeze any holder (trusted, by design).
7. Token-specific — the program is a Token-2022 transfer hook; TransferFee cannot coexist with TransferHook; delegate transfers are rejected (F-007).
8. DoS — pre-funding the validation PDA blocks a mint's transfers before initialization (F-001); the writable `pause` extra account serializes all transfers (F-005).

Feature gates (grep evidence): `flash|flashloan` 0 hits → §6.1 absent · `pyth|switchboard|oracle|get_price` 0 hits → §6.9 absent · `bonding|curve|swap|reserve` 0 hits → §6.13 absent · `twap|cumulative|observation` 0 hits → §6.15 absent · `reward|staked` 0 hits → §6.10 absent.

```
[N/A]       ECON-001: feature absent (flash) — no deposit/NAV/withdraw path exists
[N/A]       ECON-002: feature absent (flash)
[N/A]       ECON-003: feature absent (flash)
[N/A]       ECON-004: feature absent (flash)
[N/A]       ECON-005: feature absent (flash) — no NAV
[N/A]       ECON-006: No swaps
[N/A]       ECON-007: No swaps
[N/A]       ECON-008: No swaps
[N/A]       ECON-009: No deposits
[N/A]       ECON-010: No withdrawals
[N/A]       ECON-011: No deposits
[N/A]       ECON-012: No withdrawals
[N/A]       ECON-013: No shares
[N/A]       ECON-014: No vault to donate into
[N/A]       ECON-015: No shares
[N/A]       ECON-016: No shares
[N/A]       ECON-017: No shares
[N/A]       ECON-018: No NAV
[N/A]       ECON-019: No NAV
[N/A]       ECON-020: No NAV
[N/A]       ECON-021: No NAV
[N/A]       ECON-022: No NAV
[N/A]       ECON-023: No NAV
[N/A]       ECON-024: No NAV
[N/A]       ECON-025: No NAV
[N/A]       ECON-026: No fees
[N/A]       ECON-027: No fees
[N/A]       ECON-028: No fees
[N/A]       ECON-029: No fees
[N/A]       ECON-030: No fees
[N/A]       ECON-031: No fees
[N/A]       ECON-032: No fees
[N/A]       ECON-033: No fees; no token CPI exists in the program
[N/A]       ECON-034: No manager-controlled assets
[N/A]       ECON-035: No `pda_token_transfer`
[N/A]       ECON-036: No `pda_token_transfer`
[N/A]       ECON-037: No `pda_lamports_transfer`; the program never debits its PDAs
[N/A]       ECON-038: No `pda_token_approve`
[N/A]       ECON-039: No swap vault
[N/A]       ECON-040: No protocol CPI
[N/A]       ECON-041: No CPI whitelist
[N/A]       ECON-042: No CPI whitelist
[N/A]       ECON-043: No investor funds in program custody; token-level protections are the freeze authority and pause (trust model, intake §6)
[PASS]      ECON-044: This program IS the transfer hook. It performs no CPI, holds no value, and mutates no state on the transfer path (L69-73), so it cannot be turned against an integrator beyond reverting when paused; the hook's extra accounts are seed-bound (L157-166). Direct invocation is benign today (F-004)
[N/A]       ECON-045: `TransferFee` and `TransferHook` are mutually exclusive on one mint (Token-2022 runtime rejects the combination); the program does no accounting
[N/A]       ECON-046: No balance-dependent logic
[PASS]      ECON-047: The TBILL mint's freeze authority is the Squads multisig with `DefaultAccountState = Frozen` (tests/initialize.ts:90, 112-116, 121) — a deliberate compliance allowlist; recorded as a trust assumption. The hook program has no token accounts that could be frozen
[FAIL-6]    ECON-048: The TBILL mint authority is the deploy hot wallet (`wallet.publicKey`, tests/initialize.ts:120, 129), not the multisig that holds every other authority
              File: tests/initialize.ts:120
              Impact: One compromised key can inflate the supply of a tokenized T-Bill without limit into any already-thawed account (F-002)
              Fix: Assign the mint authority to the multisig at initialization; monitor `MintTo` on the mint
[N/A]       ECON-049: The program never reads or computes with decimals
[N/A]       ECON-050: No WSOL
[PARTIAL]   ECON-051: Per-transfer cost is fixed (two PDA derivations, `msg!` formatting) and not attacker-inflatable; however every transfer takes a write lock on the single global `pause` PDA because it is registered writable (L34), which serializes all TBILL transfers
              File: programs/tbill/src/lib.rs:34
              Missing: read-only registration of the extra account (F-005)
              Improvement: `is_writable = false`
[N/A]       ECON-052: No positions/batches
[N/A]       ECON-053: No `pay_fund_investors`
[N/A]       ECON-054: No positions
[N/A]       ECON-055: No growable state
[FAIL-5]    ECON-056: An attacker can lock the mint's transfers by donating ≥1 lamport to the validation PDA address before the admin creates it; `create_account` then fails permanently (F-001)
              File: programs/tbill/src/lib.rs:47-59
              Impact: All transfers of the mint blocked until the hook authority migrates to a new hook program
              Fix: Handle the pre-funded PDA (transfer + allocate + assign) as Anchor `init` does
[N/A]       ECON-057: feature absent (oracle)
[N/A]       ECON-058: feature absent (oracle)
[N/A]       ECON-059: feature absent (oracle)
[N/A]       ECON-060: feature absent (oracle)
[N/A]       ECON-061: feature absent (oracle)
[N/A]       ECON-062: No pricing of any kind — no NAV attestation to document
[N/A]       ECON-071: No randomness (grep: zero hits for random/vrf/slot_hashes)
[N/A]       ECON-063: feature absent (staking/rewards)
[N/A]       ECON-064: feature absent (staking/rewards)
[N/A]       ECON-065: feature absent (staking/rewards)
[N/A]       ECON-066: feature absent (staking/rewards)
[N/A]       ECON-067: feature absent (staking/rewards)
[N/A]       ECON-068: feature absent (staking/rewards)
[N/A]       ECON-069: feature absent (staking/rewards)
[N/A]       ECON-070: feature absent (staking/rewards)
[PASS]      ECON-072: The global pause (L70, L92-96) is an admin-held circuit breaker that halts every Token-2022 transfer path of the mint at once, independent of any per-user limit
[N/A]       ECON-073: No collateral/PnL
[N/A]       ECON-074: No reserves or counterparties
[N/A]       ECON-075: No swaps/fees
[N/A]       ECON-076: No swaps/fees
[N/A]       ECON-077: No swaps/fees
[N/A]       ECON-078: No swaps/fees
[N/A]       ECON-079: feature absent (bonding curve)
[N/A]       ECON-080: feature absent (bonding curve)
[N/A]       ECON-081: feature absent (bonding curve)
[N/A]       ECON-082: No PDA-controlled token vaults
[N/A]       ECON-083: No withdrawals
[N/A]       ECON-084: No residual sweeps
[N/A]       ECON-085: feature absent (TWAP)
[N/A]       ECON-086: feature absent (TWAP)
[N/A]       ECON-087: feature absent (TWAP)
[N/A]       ECON-088: feature absent (TWAP)
[PARTIAL]   ECON-089: Rolling outflow accounting is not meaningful for a plain token; the guardian pause exists, but whether the pause key (`ADMIN_PUBKEY`) is held separately from the upgrade authority and from the mint authority cannot be established from the repo
              File: programs/tbill/src/lib.rs:20
              Missing: documented separation of pause / upgrade / mint / freeze key holders (F-003)
              Improvement: publish the authority map and keep the pause key on a distinct, fast multisig
```

### Checklist 07 — OpSec & Governance (85 items)

Evidence limits: no network access and no command execution in this engagement, so on-chain state (`solana program show`, multisig threshold) and organisational process cannot be observed. Items that depend on such evidence are marked `[UNKNOWN]` (OUTPUT-RULES Rule 10) with the evidence the repo does offer. The clone is shallow (`.git/shallow`), so git history is not inspectable.

Repo evidence used: `Anchor.toml:15` (`wallet = "~/.config/solana/id.json"`), `Anchor.toml:1` (empty `[toolchain]`), `README.md:43` ("ADMIN_PUBKEY … should be a Squads multisig"), `.env:1` (`SQUAD_MULTI_SIG=CPNEkz5…`), `lib.rs:20` (same constant), `tests/initialize.ts:100-133` (authority assignment), `tests/tbill.ts:217` (provider wallet signs `update_pause`).

```
[UNKNOWN]   OPS-001: Upgrade authority not observable offline; Anchor's default leaves it at the deploy wallet (`Anchor.toml:15`) unless transferred — no transfer step exists in the repo (F-003)
[UNKNOWN]   OPS-002: Cannot confirm multisig custody of the upgrade authority; treated as unverified single wallet per intake default (F-003)
[UNKNOWN]   OPS-003: Multisig threshold not observable offline
[UNKNOWN]   OPS-004: Signer identities not in repo
[UNKNOWN]   OPS-005: Signer key storage not in repo
[UNKNOWN]   OPS-006: No timelock in the program; whether the (declared) Squads multisig configures a time lock is not observable
[UNKNOWN]   OPS-007: See OPS-006
[UNKNOWN]   OPS-008: No timelock evidence; recommendation stands — ≥24h on upgrades and on `update_pause(false)` proposals
[PASS]      OPS-009: BPF Upgradeable Loader semantics — the current authority can reassign or drop the authority; nothing in the program interferes
[PARTIAL]   OPS-010: Program is upgradeable by Anchor default; no documented decision on immutability
              File: Anchor.toml:1-5
              Missing: written rationale (keeping upgradeability to evolve hook policy is reasonable, but must be paired with multisig + timelock)
              Improvement: document the decision and the custody of the authority
[PASS]      OPS-011: Documented: a malicious upgrade cannot drain tokens (the program custodies nothing and Token-2022 de-escalates the accounts it passes to the hook), but it can censor or block all transfers, or remove the pause
[UNKNOWN]   OPS-012: No emergency-upgrade process in repo
[PASS]      OPS-013: The only privileged key is `ADMIN_PUBKEY` (L20), visible in source, README:43 and the Anchor 0.30 IDL (`address` constraint is exported)
[PASS]      OPS-014: No bypass account; the hook has a single gate (L70)
[PASS]      OPS-015: Pubkey conditionals are limited to declared `address =` constraints (L103, L123)
[PASS]      OPS-016: No unused handlers; `transfer_hook` is reachable both via `fallback` (L75-90) and its Anchor discriminator, and is stateless (F-004 notes the benign direct call)
[UNKNOWN]   OPS-017: Build blocked in this engagement; `idl-build` feature exists (programs/tbill/Cargo.toml:17) — compare `target/idl/tbill.json` against the deployed program's IDL account
[N/A]       OPS-018: No treasury
[N/A]       OPS-019: No DEX program ID
[N/A]       OPS-020: No fund manager
[N/A]       OPS-021: No share minting instruction in the program (supply inflation risk lives with the Token-2022 mint authority — F-002)
[N/A]       OPS-022: No share burning instruction
[PASS]      OPS-023: No `unsafe` in lib.rs (L1-181)
[PASS]      OPS-024: No raw pointers
[PASS]      OPS-025: `declare_id!` (L18) == `Anchor.toml:8`
[PARTIAL]   OPS-026: No verifiable-build configuration (empty `[toolchain]` in Anchor.toml, no `solana-verify`/Docker build recipe)
              File: Anchor.toml:1
              Missing: pinned `anchor_version`/`solana_version` and a reproducible build recipe (F-011)
              Improvement: pin the toolchain and publish a `solana-verify` hash
[PARTIAL]   OPS-027: Tooling points at a filesystem keypair (`Anchor.toml:15`); hardware-wallet use for mainnet cannot be confirmed
              File: Anchor.toml:15
              Missing: evidence of a hardware/multisig deploy path (F-003)
              Improvement: deploy with `--upgrade-authority` set to the multisig and use a hardware signer for the deployer
[PARTIAL]   OPS-028: Not in repo (good); README:33-41 instructs a plaintext filesystem wallet on the developer machine
              File: README.md:33-41
              Missing: guidance to use a hardware wallet / ephemeral deployer for mainnet
              Improvement: document a mainnet deploy procedure separate from the localnet one
[FAIL-6]    OPS-029: Mint authority = deploy hot wallet while freeze/hook/metadata authorities = multisig
              File: tests/initialize.ts:120, 129
              Impact: Single-key unbounded issuance of TBILL (F-002)
              Fix: Mint authority → multisig (or a program-controlled issuance path with limits)
[N/A]       OPS-030: No backend
[N/A]       OPS-031: No backend
[N/A]       OPS-032: No API keys
[N/A]       OPS-033: No API keys
[PARTIAL]   OPS-034: Operational scripts use the public endpoints (`.env:8-10`)
              File: .env:10
              Missing: dedicated RPC for the initialization runbook (rate limits / reliability during a multisig-coordinated deployment)
              Improvement: use a dedicated RPC for mainnet operations (Notes & Nitpicks)
[N/A]       OPS-035: No frontend
[PARTIAL]   OPS-036: Working tree holds no private keys (`.env` contains only public keys and URLs); history not inspectable (shallow clone); `tests/initialize.ts:65` writes `mint-keypair.json` into the repo root and `.gitignore` has no keypair pattern
              File: tests/initialize.ts:65, .gitignore:1-4
              Missing: keypair ignore patterns; secret scanning (F-010)
              Improvement: add `*keypair*.json`, `*.pem` to `.gitignore`; write the mint keypair to a secure location or discard it after mint creation
[PARTIAL]   OPS-037: Squads is declared (README:43, `.env:1`) but the on-chain nature of `CPNEkz5…` is unverified; the committed test signs `update_pause` with the provider wallet (tests/tbill.ts:217), which implies either an EOA admin or an uncommitted test constant
              File: programs/tbill/src/lib.rs:20
              Missing: proof that the constant is a Squads vault PDA (F-003)
              Improvement: verify on-chain and record the multisig address, threshold and members in the repo
[UNKNOWN]   OPS-038: Threshold not observable
[UNKNOWN]   OPS-039: Signer set not observable
[UNKNOWN]   OPS-040: Backup signers not observable
[UNKNOWN]   OPS-041: Threshold-change policy not observable
[UNKNOWN]   OPS-042: Proposal expiry not observable
[UNKNOWN]   OPS-043: Squads executions are on-chain by nature, but no audit-log process is documented
[FAIL-1]    OPS-044: No incident-response plan or runbook in the repository (search: INCIDENT*/RUNBOOK*/SECURITY* — none)
              File: README.md
              Impact: Pause/unpause and hook-migration procedures are undocumented; response time in an incident depends on tribal knowledge (F-011)
              Fix: Add a runbook covering pause, unpause, validation-account recovery and hook-program migration
[PASS]      OPS-045: Emergency pause exists (`update_pause`, L92-96), gated to `ADMIN_PUBKEY`; speed equals multisig execution latency. Scope: transfers only (mint/burn continue — AC-032)
[UNKNOWN]   OPS-046: No bug-bounty reference in repo
[FAIL-1]    OPS-047: No `SECURITY.md` or security contact in the repository
              File: README.md
              Impact: Researchers have no disclosure channel (F-011)
              Fix: Add SECURITY.md with a contact and disclosure policy
[UNKNOWN]   OPS-048: No fund PDAs; monitoring of `MintTo`/`Freeze`/pause changes is not evidenced
[UNKNOWN]   OPS-049: Upgrade-transaction alerting not evidenced
[UNKNOWN]   OPS-050: Pattern alerting not evidenced
[UNKNOWN]   OPS-051: War-room process not in repo
[UNKNOWN]   OPS-052: Post-mortem process not in repo
[PASS]      OPS-053: Time-locked actions in the program: none (documented) — pause and validation-account creation are immediate by design; upgrade timelock is OPS-054
[UNKNOWN]   OPS-054: Upgrade timelock not observable
[N/A]       OPS-055: No fees
[N/A]       OPS-056: Admin is a compile-time constant; change = program upgrade (OPS-054, F-003)
[PASS]      OPS-057: Mint registration (validation-account creation) is immediate and admin-only; it only enables enforcement for a new mint and affects no existing holder
[N/A]       OPS-058: No treasury
[N/A]       OPS-059: No timelock to bypass
[N/A]       OPS-060: No timelock
[N/A]       OPS-061: No time-locked changes (pause changes are unannounced — F-009)
[PARTIAL]   OPS-062: One provider wallet path serves localnet/devnet/mainnet (`Anchor.toml:15`, `.env:11`)
              File: Anchor.toml:15
              Missing: per-environment keys/config (Notes & Nitpicks)
              Improvement: separate mainnet configuration and keys from development ones
[PARTIAL]   OPS-063: README:61-71 and `package.json:8` (`anchor deploy`) describe deploying from a developer machine
              File: README.md:61-71
              Missing: a controlled mainnet deploy path (F-003)
              Improvement: deploy via a dedicated, audited procedure with the upgrade authority on the multisig
[N/A]       OPS-064: No CI/CD pipeline in the repo
[N/A]       OPS-065: No servers
[N/A]       OPS-066: No database
[N/A]       OPS-067: No CI
[UNKNOWN]   OPS-068: Secret-manager usage not in repo
[UNKNOWN]   OPS-069: No LICENSE file; `package.json:2` says ISC; publication status unknown
[UNKNOWN]   OPS-070: Cannot compare with the deployed binary offline
[PARTIAL]   OPS-071: `Cargo.lock` is committed, but the Anchor/Solana toolchain is not pinned (`Anchor.toml:1` empty `[toolchain]`), so a byte-identical rebuild is not guaranteed
              File: Anchor.toml:1
              Missing: toolchain pin (F-011)
              Improvement: `[toolchain] anchor_version = "0.30.1" solana_version = "1.18.x"`
[UNKNOWN]   OPS-072: Shallow clone — history not inspectable
[UNKNOWN]   OPS-073: The HEAD commit is a GitLab-style merge ("Merge branch 'add-env-variables' into 'development'"), suggesting an MR flow, but protection rules are not observable
[N/A]       OPS-074: No CI
[PARTIAL]   OPS-075: Manifests use ranges (`anchor-lang = "0.30.1"` is `^0.30.1`; `package.json` uses `^`), lockfiles pin the resolved set (`Cargo.lock`: anchor-lang 0.30.1, solana-program 1.18.19, spl-token-2022 3.0.4; `package-lock.json`: all 203 `resolved` entries on registry.npmjs.org)
              File: programs/tbill/Cargo.toml:20-27, package.json:13-25
              Missing: exact pins for critical deps (Notes & Nitpicks)
              Improvement: `=0.30.1` style pins for anchor-lang/anchor-spl and exact versions in package.json
[N/A]       OPS-076: No stake accounts
[PARTIAL]   OPS-077: The program cannot distinguish durable-nonce transactions; no version/epoch guard on `update_pause`
              File: programs/tbill/src/lib.rs:92-96
              Missing: a monotonic `version`/`nonce` argument so a stale pre-signed `update_pause(false)` cannot be replayed after a later emergency pause (Notes & Nitpicks — low value for a boolean toggle behind a multisig)
              Improvement: add `expected_current_state` (or a counter) to `update_pause`
[UNKNOWN]   OPS-085: Whether the multisig UI decodes `update_pause`/upgrade instructions at signing time is not observable (Squads decodes Anchor instructions when the IDL is published — OPS-017)
[FAIL-4]    OPS-078: Admin authority is a compile-time constant with no rotation path (`ADMIN_PUBKEY`, L20; `address =` at L103/L123); rotating it requires a program upgrade
              File: programs/tbill/src/lib.rs:20
              Impact: Single point of failure for the pause control; loss or compromise of the key (or an incorrectly chosen Squads address) leaves the pause uncontrollable until an upgrade (F-003)
              Fix: Move the admin into a config PDA with `propose_admin`/`accept_admin` and a `pending_admin: Option<Pubkey>` field
[N/A]       OPS-079: No fee/treasury account
[PASS]      OPS-080: The only config write is `update_pause(state: bool)` — no `Option<T>` ambiguity, no permissionless init, no namespace capture (both creating instructions are admin-only)
[UNKNOWN]   OPS-081: Live threshold not observable
[N/A]       OPS-082: No numeric admin parameters (`bool` only)
[N/A]       OPS-083: No interdependent config
[N/A]       OPS-084: No divisors/durations in config
```

### Checklist 08 — TypeScript Safety
```
[N/A — out of scope: --scope program] TS-001 … TS-064 (64 items; the .ts files are test/initialization scripts, read only as evidence for checklists 07 and 16)
```

### Checklist 09 — Backend Security
```
[N/A — out of scope: --scope program; no backend] BE-001 … BE-131
```

### Checklist 10 — Frontend Security
```
[N/A — out of scope: --scope program; no frontend] FE-001 … FE-084
```

### Checklist 11 — Supply Chain
```
[N/A — out of scope: --scope program] SC-001 … SC-052 (incidental: lockfiles committed; all npm resolved URLs on registry.npmjs.org; no git/path crates)
```

### Checklist 12 — Secrets & OpSec
```
[N/A — out of scope: --scope program] SEC-001 … SEC-053 (incidental: `.env` tracked with public values only; no keys in tree; no injection text found — see Notes & Nitpicks and F-010)
```

### Checklist 13 — Deployment & Infra
```
[N/A — out of scope: --scope program] DEP-001 … DEP-089 (incidental: no CI; toolchain unpinned — F-011)
```

### Checklist 14 — Python Safety
```
[N/A — out of scope: no Python code in repository] PY-001 … PY-082
```

### Checklist 15 — General Language Safety
```
[N/A — out of scope: all languages present have dedicated checklists] GL-001 … GL-088
```

### Checklist 16 — Formal Verification & Testing (72 items)

Test inventory (read in full): `tests/tbill.ts` — 13 mocha cases against `solana-test-validator` (mint creation with TransferHook + MetadataPointer + DefaultAccountState=Frozen; unauthorized `update_pause` rejected L191-210; `update_pause(false)` L212-222; validation-account creation L224-243; mint-to-frozen rejected L245-295; thaw+mint L297-325; transfer-to-frozen rejected L327-353; thaw + hooked transfer + burn L355-397; unauthorized mint/freeze/thaw rejected L399-519; freeze/thaw L468-486, L521-539). `tests/initialize.ts` — production initialization runbook (not a test). No Rust `#[cfg(test)]`, no fuzz targets, no CI workflow, no coverage or clippy configuration; `Anchor.toml:5` keeps Anchor's built-in safety lint enabled (`skip-lint = false`); `package.json:4-5` runs prettier only.

Critical gap: the program's single security property — "a transfer is rejected while `pause.state == true`" (lib.rs:70) — is never exercised. The suite only ever sets `pause = false` (tbill.ts:217) and then transfers.

```
[FAIL-3]    FV-001: No documented invariants (no comment, doc or spec states "transfers revert while paused" or "validation account exists once per mint")
              File: programs/tbill/src/lib.rs:69-73
              Impact: The only enforced property is undocumented, so nothing anchors tests or future changes (F-006)
              Fix: Add an INVARIANTS section to README and doc-comments on `transfer_hook`
[FAIL-3]    FV-002: The pause invariant is not encoded as a test — no case sets `pause = true` and asserts the transfer fails
              File: tests/tbill.ts:212-222
              Impact: A regression that removes L70 would pass the suite (F-006)
              Fix: Add `updatePause(true)` → `transferCheckedWithTransferHook` must fail with `Paused`; then `updatePause(false)` → succeeds
[N/A]       FV-003: No arithmetic identities exist
[PARTIAL]   FV-004: The only transition property ("only admin may flip the flag") is tested for the negative case (tbill.ts:191-210) but not written down as a property
              File: tests/tbill.ts:191-210
              Missing: explicit property statement; positive/negative pair for both values
              Improvement: document and test both `true`/`false` transitions
[FAIL-3]    FV-005: No model checking or fuzzing; reachable states are not explored beyond one happy path
              File: tests/tbill.ts
              Impact: The pre-funded-PDA liveness failure (F-001) is a reachable state the suite never visits (F-006)
              Fix: Add a Trident/LiteSVM harness or at minimum negative-path integration tests
[N/A]       FV-006: The program moves no tokens
[PARTIAL]   FV-007: Unauthorized `update_pause` is rejected in tests (tbill.ts:191-210); unauthorized `initialize_extra_account_meta_list` is not tested
              File: tests/tbill.ts:224-243
              Missing: negative test for the second admin instruction
              Improvement: add an `unauthorised`-signed `initializeExtraAccountMetaList` case expecting `NotAdmin`
[PARTIAL]   FV-008: No liveness test; F-001 (validation account can be made uncreatable) is exactly a liveness violation that a "pre-fund the PDA, then initialize" test would surface
              File: programs/tbill/src/lib.rs:47-59
              Missing: liveness test for validation-account creation under adversarial pre-funding
              Improvement: add the test and fix F-001
[N/A]       FV-009: No formal spec exists
[N/A]       FV-010: No proofs are claimed
[N/A]       FV-011: No custom FV properties
[N/A]       FV-012: No verification results to include
[FAIL-3]    FV-013: No CI; no static analysis runs anywhere (no `.github/`, no clippy config; only Anchor's build-time lint, Anchor.toml:5)
              File: Anchor.toml:5
              Impact: No automated gate catches regressions or lint-detectable footguns (F-006)
              Fix: Add a CI workflow running `cargo clippy -- -D warnings`, `anchor build`, `anchor test`, `cargo audit`, `npm audit`
[N/A]       FV-014: No static-analysis output to triage
[PARTIAL]   FV-015: Only prettier (formatting) is configured (`package.json:4-5`, `.prettierignore`)
              File: package.json:4-5
              Missing: clippy/eslint rule sets
              Improvement: add clippy with `-D warnings` and `clippy::unwrap_used`
[PARTIAL]   FV-016: No zero-warning policy (no `#![deny(warnings)]`, no CI)
              File: programs/tbill/src/lib.rs:1
              Missing: enforcement
              Improvement: enforce in CI
[PARTIAL]   FV-017: No security-focused ruleset enabled
              File: programs/tbill/Cargo.toml
              Missing: `clippy::pedantic`/`clippy::unwrap_used` or Semgrep Solana rules
              Improvement: enable in CI
[PARTIAL]   FV-018: Dead-code detection relies on rustc defaults; unused `token_program` accounts (L114, L138) and unused direct deps (spl-token-2022, spl-pod, spl-type-length-value; programs/tbill/Cargo.toml:25-27) are not flagged
              File: programs/tbill/Cargo.toml:25-27
              Missing: `cargo udeps`/clippy in CI
              Improvement: remove unused deps and accounts (F-011)
[FAIL-3]    FV-019: No dependency vulnerability scanning (`cargo audit`/`npm audit`) — no CI at all
              File: package.json:3-11
              Impact: Advisories against the pinned tree (e.g. in `Cargo.lock`/`package-lock.json`) go unnoticed (F-006)
              Fix: Add `cargo audit` and `npm audit --audit-level=high` to CI
[PARTIAL]   FV-020: No SAST for Rust or TypeScript
              File: package.json:3-11
              Missing: SAST coverage
              Improvement: as FV-013
[PASS]      FV-021: No suppression attributes (`#[allow(...)]`) in lib.rs; nothing to justify
[PARTIAL]   FV-022: Only `.prettierignore` is version-controlled; no analyzer config exists
              File: .prettierignore
              Missing: analyzer config
              Improvement: commit clippy/CI config once added
[PARTIAL]   FV-023: `fallback` parses raw instruction bytes via the SPL interface (`TransferHookInstructionInterface::unpack`, L80) — library-parsed, but no fuzz target for the dispatcher
              File: programs/tbill/src/lib.rs:80
              Missing: fuzz target
              Improvement: fuzz `fallback` with arbitrary `data`
[FAIL-3]    FV-024: No fuzz targets for any instruction handler
              File: programs/tbill/src/lib.rs
              Impact: Malformed-input and adversarial-account behaviour is unexplored (F-006)
              Fix: Trident or cargo-fuzz harness over `update_pause`, `initialize_extra_account_meta_list`, `fallback`
[N/A]       FV-025: No fuzz infrastructure (FV-024)
[N/A]       FV-026: No fuzz infrastructure
[N/A]       FV-027: No fuzz infrastructure
[N/A]       FV-028: No second implementation to differential-fuzz against
[N/A]       FV-029: No arithmetic to fuzz
[N/A]       FV-030: No API endpoints
[N/A]       FV-031: State is a single Borsh `bool`; no custom serialization
[N/A]       FV-032: No fuzz infrastructure
[PARTIAL]   FV-033: Coverage is not measured
              File: package.json:3-11
              Missing: coverage tooling
              Improvement: add `cargo llvm-cov` for Rust tests once they exist
[FAIL-3]    FV-034: The critical path (hook rejecting a transfer while paused) has 0 % coverage — the suite never sets `pause = true`
              File: tests/tbill.ts:217
              Impact: The core control is unverified (F-006)
              Fix: As FV-002
[PARTIAL]   FV-035: Each instruction has at least one integration case (update_pause L212-222, initialize L224-243, hook happy-path L355-397) but no Rust unit tests and no failure-side hook test
              File: tests/tbill.ts
              Missing: hook failure test; unit tests
              Improvement: as FV-002
[PASS]      FV-036: `tests/tbill.ts` runs the full multi-step flow: mint creation → pause → validation account → ATAs → mint → hooked transfer → burn → freeze/thaw
[PARTIAL]   FV-037: No edge-case tests (zero-amount transfer, transfer to self, delegate transfer, second `initialize_extra_account_meta_list`)
              File: tests/tbill.ts
              Missing: edge cases above
              Improvement: add them; the delegate case documents F-007 behaviour
[PARTIAL]   FV-038: Negatives exist for unauthorized pause (L191-210), Token-2022 frozen/authority rules (L245-295, L327-353, L399-519); missing: paused transfer, unauthorized initialize, double initialize
              File: tests/tbill.ts
              Missing: the three negatives above
              Improvement: add them
[N/A]       FV-039: No previously found bugs on record (first audit)
[FAIL-3]    FV-040: No CI — tests are not run on any PR/merge
              File: package.json:9
              Impact: Nothing prevents merging a broken or regressed program (F-006)
              Fix: CI workflow with `anchor test`
[PARTIAL]   FV-041: Tests run on `solana-test-validator` with the real Token-2022 program (mirrors mainnet semantics), but the Anchor/Solana toolchain is unpinned (`Anchor.toml:1`)
              File: Anchor.toml:1
              Missing: toolchain pin
              Improvement: pin `anchor_version`/`solana_version`
[PASS]      FV-042: No skipped/ignored tests; the commented blocks in `tests/initialize.ts:152-214` are runbook steps deliberately deferred to the multisig, not disabled tests
[PARTIAL]   FV-043: Mutation testing never performed
              File: tests/tbill.ts
              Missing: one mutation run
              Improvement: mutate L70 (`== false` → `== true`) and confirm the suite fails — today it would not
[N/A]       FV-044: No endpoints; on-chain CU profiling covered by FV-067
[PASS]      FV-045: Tests generate keypairs at runtime (tbill.ts:62-64) and read only public values from `.env`; no hardcoded secrets
[PASS]      FV-046: Random keypairs per run, but no assertion depends on their values; the flow is reproducible
[PASS]      FV-047: Every external call propagates errors with `?` — `Rent::get()?` (L38), `create_account(...)?` (L59), `ExtraAccountMetaList::init(...)?` (L64), `unpack(data)?` (L80)
[PASS]      FV-048: Errors are enumerated program errors (`NotAdmin`, `Paused`, L174-180) and `InvalidInstructionData` (L88); nothing leaks internals
[PASS]      FV-049: No `unwrap`/`expect`/`panic!` in lib.rs (grep: zero hits); Anchor converts every `Err` to a program error at the entrypoint
[N/A]       FV-050: No HTTP layer
[N/A]       FV-051: On-chain; compute is bounded by the runtime
[N/A]       FV-052: No external network calls
[PASS]      FV-053: Single-transaction atomicity (FP-4); the multi-transaction runbook (mint → pause → validation account) has one adversarial window, recorded as F-001
[PASS]      FV-054: On-chain code never swallows errors; test catch blocks assert (`assert.fail` on unexpected shape, tbill.ts:198-208)
[PASS]      FV-055: Specific `#[error_code]` variants (L174-180)
[PASS]      FV-056: `match instruction { Execute {..} => .., _ => Err(..) }` (L82-89) is exhaustive
[PASS]      FV-057: The pause switch (L70) is the circuit breaker for the transfer path
[N/A]       FV-058: No financial math
[PARTIAL]   FV-059: No LiteSVM/Mollusk suite; the compiled program is exercised through `solana-test-validator` via Anchor's mocha harness (`Anchor.toml:17-19`)
              File: Anchor.toml:17-19
              Missing: in-process SVM harness for fast negative/edge testing
              Improvement: add a LiteSVM suite loading `target/deploy/tbill.so`
[N/A]       FV-060: No time-locked instruction
[N/A]       FV-061: No time-dependent logic
[N/A]       FV-062: No close path
[PARTIAL]   FV-063: Re-initialization is not tested — no second `initializeExtraAccountMetaList` call (should fail) and no second `updatePause` (should succeed idempotently)
              File: tests/tbill.ts:224-243
              Missing: both cases
              Improvement: add them
[PARTIAL]   FV-064: Wrong-signer negative exists for `update_pause` (tbill.ts:191-210) but not for `initialize_extra_account_meta_list`
              File: tests/tbill.ts:224-243
              Missing: second negative
              Improvement: add it
[N/A]       FV-065: No arithmetic
[PARTIAL]   FV-066: No balance assertions after mint (L297-325), transfer (L355-397) or burn — tests only log signatures
              File: tests/tbill.ts:317-324, 390-396
              Missing: `getAccount(...).amount` assertions
              Improvement: assert source/destination amounts after each step
[PARTIAL]   FV-067: CU consumption not profiled for any instruction
              File: tests/tbill.ts
              Missing: CU baseline (the hook adds two PDA derivations + formatted log to every transfer)
              Improvement: record `computeUnitsConsumed` from the confirmed transaction meta
[PASS]      FV-068: Each step uses `sendAndConfirmTransaction`/`.rpc()`, which fetches a fresh blockhash per send
[PARTIAL]   FV-069: Failure paths use try/catch + `assert.fail` correctly, but several accept any error object that carries `transactionLogs` (tbill.ts:288-294, 346-352) without asserting the specific Token-2022 error
              File: tests/tbill.ts:289, 347
              Missing: specific error assertions
              Improvement: parse the custom error code as done at L422-428
[PASS]      FV-070: Test PDA derivation `[Buffer.from("pause")]` (tbill.ts:213-216) matches `seeds = [b"pause"]` (lib.rs:110); no mainnet replay used for assertions
[FAIL-3]    FV-071: No Solana-appropriate verification/fuzzing tool (Trident, LiteSVM/Mollusk, Kani …); the only verification is the mocha happy-path suite, which does not exercise the failure side of the sole security control
              File: tests/tbill.ts
              Impact: Proportionate to the program's simplicity, but the one property that matters is unproven (F-006)
              Fix: LiteSVM suite with paused-transfer, direct-invocation, delegate-transfer and pre-funded-PDA cases
[N/A]       FV-072: No reader/indexer/fee-sponsor component and no instruction introspection; the on-chain program has no transaction-format dependency
```

### Checklist 17 — Logging, Monitoring & Incident Response
```
[N/A — out of scope: --scope program] LM-001 … LM-065 (incidental: no events — F-009; no runbook — F-011)
```

### Checklist 18 — Privacy, Compliance & Change Management
```
[N/A — out of scope: --scope program] PC-001 … PC-060 (no PII in repo; no AI/ML components; no prompt-injection text found)
```

### Checklist 19 — AI Agent Security
```
[N/A — out of scope: no `.mcp.json`, agent SDK or LLM component] AI-001 … AI-033
```

### Checklist 20 — Rust Off-Chain Services
```
[N/A — out of scope: no `.rs` outside `programs/`] RS-001 … RS-021
```

### Audit Metrics

| Metric | Value |
|--------|-------|
| Total items evaluated (in scope) | 591 |
| PASS | 136 (23.0 %) |
| FAIL | 27 (4.6 %) |
| PARTIAL | 43 (7.3 %) |
| UNKNOWN (unverifiable from repo) | 30 (5.1 %) |
| N/A | 355 (60.1 %) |
| **Pass rate** (excl. N/A and UNKNOWN) | **66.0 %** |
| Highest severity found | **6** (F-002) |
| **Repository Risk Score** | **6 — MEDIUM** |

### Known Vector Metrics

| Metric | Value |
|--------|-------|
| Total known vectors | 136 |
| In scope | 54 |
| PASS | 14 |
| FAIL | 7 |
| PARTIAL | 5 |
| UNDETERMINED | 2 |
| N/A (feature absent / not applicable, in scope) | 26 |
| N/A — out of scope | 82 |
| Completion | 100 % |

### Per-Checklist Summary

| # | Checklist | Items | Pass | Fail | Partial | Unknown | N/A | Pass Rate |
|---|-----------|-------|------|------|---------|---------|-----|-----------|
| 01 | Account Validation | 90 | 33 | 6 | 4 | 0 | 47 | 76.7 % |
| 02 | Access Control | 50 | 23 | 4 | 1 | 0 | 22 | 82.1 % |
| 03 | Arithmetic Safety | 63 | 15 | 0 | 0 | 0 | 48 | 100 % |
| 04 | CPI & PDA | 70 | 20 | 0 | 1 | 0 | 49 | 95.2 % |
| 05 | State Machine | 72 | 14 | 2 | 1 | 0 | 55 | 82.4 % |
| 06 | Economic & Logic | 89 | 3 | 2 | 2 | 0 | 82 | 42.9 % |
| 07 | OpSec & Governance | 85 | 13 | 4 | 12 | 30 | 26 | 44.8 % |
| 16 | Formal Verification & Testing | 72 | 15 | 9 | 22 | 0 | 26 | 32.6 % |
| **Total** | | **591** | **136** | **27** | **43** | **30** | **355** | **66.0 %** |

---

## 6. Known Vector Results (KV-001..KV-136)

Gate: `--scope program` → in scope = Crypto/On-Chain (1–30), Modern Surface (101–109), 111, 118–123, 125, 127–131, 134 (on-chain), plus KV-091 (upgrade authority, checklist 07 phase) = 54 vectors. Feature-marker evidence: grep over `programs/` — markers absent for flash, pyth/switchboard/oracle, shares/deposit/vault/total_supply, swap/slippage, division, withdraw, close/realloc, realm/proposal, guardian/vaa, ed25519/secp256k1, lookup_table, stake, nonce, random/vrf, merkle, bonding_curve, f32/f64, keeper, tick, token_acl, pinocchio/no_std.

```
[FAIL-2]    KV-001: Steps 1–3 pass (no key material in tracked files; `.env` holds public keys only; the only `secretKey` reference is the runtime write of the mint keypair at tests/initialize.ts:61-65). Steps 4–5 not runnable (shallow clone, no git execution). Step 6: `.env` is tracked (contains no secrets). Step 7 FAIL: `.gitignore` (L1-4) lacks `.env`, `*.pem`, `*-keypair.json`, `id.json`. Step 10: no pre-commit secret scanner
              File: tests/initialize.ts:65, .gitignore:1-4
              Impact: `mint-keypair.json` is written to the repo root by the initialization runbook and nothing prevents it (or a future `.env` with secrets) from being committed (F-010)
              Fix: add keypair/env patterns to `.gitignore`, write the mint keypair outside the tree (or discard it after creation), add gitleaks pre-commit
[N/A]       KV-002: feature absent — no flash-loan / oracle-priced deposit-withdraw surface (grep: flash|flashloan|pyth|switchboard 0 hits)
[PASS]      KV-003: One CPI (System `create_account`, lib.rs:47-59) to a typed builtin (`Program<System>`, L139); the only post-CPI write targets the account the CPI just created; no user-controlled CPI target; no `remaining_accounts`
[PARTIAL]   KV-004: Every mutating instruction requires `Signer` + `address = ADMIN_PUBKEY` (L101-105, L120-124); init is admin-gated/one-shot. Step 4 gap: no runtime `require_keys_eq!` backing the declarative constraint (defense-in-depth only; the constraint targets a constant) — Notes & Nitpicks
[N/A]       KV-005: feature absent — pyth/switchboard/oracle/get_price (0 hits)
[N/A]       KV-006: feature absent in the program — shares/mint_to/deposit/vault/total_supply (0 hits in programs/); the token's issuance risk is KV-030
[N/A]       KV-007: feature absent — swap/slippage/min_amount_out (0 hits)
[FAIL-6]    KV-008: Admin functions: `update_pause`, `initialize_extra_account_meta_list` (L92, L26). Step 2 PASS (no withdrawal). Step 3 FAIL at the token layer: the TBILL mint authority is the deploy hot wallet (tests/initialize.ts:120, 129) — unbounded issuance by one key (F-002). Step 4: pause has no time limit (indefinite transfer halt by the admin — accepted RWA design, recorded under F-003). Step 5: hardcoded admin constant (L20) — auditable but not rotatable (F-003). Step 7: upgrade authority unknown (KV-091)
              File: tests/initialize.ts:120
              Impact: Infinite mint of a tokenized T-Bill by a single compromised key; indefinite pause by a single (unverified-multisig) admin
              Fix: Mint authority → multisig; admin in a rotatable config PDA; publish the authority map
[PASS]      KV-009: The only CPI program is `Program<'info, System>` (L139); no `UncheckedAccount` program targets; no `remaining_accounts`
[PARTIAL]   KV-010: `#[account]` discriminator on `Pause` (L169); typed `Account`/`InterfaceAccount` everywhere except one raw `AccountInfo` (L131, validated by seeds L128-129) and two `UncheckedAccount`s (L155 pubkey-only, L161 seed-checked, never read); unique seed prefixes (`pause`, `extra-account-metas`). Vector ⚠️ band: unchecked wrappers with adequate runtime checks — style only (AV-002, Notes)
[PASS]      KV-011: No financial arithmetic; the single `+` is a constant (L109); `as u64` (L37) widens a ≤51-byte size; `overflow-checks = true` (Cargo.toml:8)
[N/A]       KV-012: feature absent — no division / share math
[PASS]      KV-013: Both state-writing instructions carry `Signer<'info>` bound to the expected authority by `address =` (L103, L123); the hook writes nothing and relies on Token-2022 having verified the holder's signature
[PARTIAL]   KV-014: `init_if_needed` on `pause` (L107) with safe semantics — the only field is overwritten with the admin's value (L93), caller is admin-gated; the manual write at L61-64 follows a `create_account` that fails on an existing account. Vector ⚠️ band (F-008 hardening: split init/update)
[PASS]      KV-015: Program-owned data uses `Account<'info, Pause>` (owner + discriminator); token accounts/mint use `InterfaceAccount` (owner ∈ {Token, Token-2022}); `owner` (L155) is compared, not deserialized (L146); `extra_account_meta_list` (L161) is seed-checked and never read; no `remaining_accounts`
[PASS]      KV-016: The program performs no transfers; the accounts Token-2022 hands to the hook carry `token::mint = mint` (L145, L151) and the source carries `token::authority = owner` (L146)
[N/A]       KV-017: feature absent — no vault / balance reads
[N/A]       KV-018: The program credits nothing; `TransferFee` cannot coexist with `TransferHook` on one mint (Token-2022 rejects the combination), so no fee-on-transfer accounting can arise for this hook's mint
[PASS]      KV-019: Freeze authority is deliberately set (Squads multisig, tests/initialize.ts:121) with `DefaultAccountState = Frozen` — the compliance allowlist for a permissioned RWA token; acceptably governed and recorded as a trust assumption (intake §6). The hook program owns no token accounts that could be frozen; the freeze authority can thaw (recovery path)
[UNDETERMINED] KV-020: Step 1 not runnable offline; Step 2: `Anchor.toml:15` wallet is a local filesystem key and no authority transfer exists in the repo; Step 3: README documents deploy but no multi-party upgrade process; Step 4: no timelock evidence; Step 5: not verifiable. Reported at the likely band — severity 4 — because a hijacked hook can censor/block transfers but cannot move tokens (Token-2022 de-escalates the accounts it passes) (F-003); extent not determined within this assessment
[N/A]       KV-021: feature absent — realm/proposal/spl-governance (0 hits)
[N/A]       KV-022: feature absent — guardian/vaa/emitter (0 hits)
[PASS]      KV-023: This program IS the transfer hook. It custodies no mint, performs no CPI and writes no state on the transfer path (L69-73); its extra accounts are seed-bound (L157-166), so it cannot be turned into a re-entrancy or injection vector for integrators beyond reverting while paused. Residuals recorded separately: no `transferring`-flag check (F-004) and delegate transfers rejected (F-007)
[PASS]      KV-024: No terminal-state accounts exist; the two singletons are permanent by design and hold no user data; no close path means no stale-reference or revival surface
[PASS]      KV-025: No loops; `vec!` of one element (L29-35); the hook is O(1) with two PDA derivations and one formatted log
[PARTIAL]   KV-026: Unique prefixes (`b"pause"`, `b"extra-account-metas"`), sufficient variable seeds (mint key); bumps re-derived each call (L111/L129/L135/L159/L164) — vector ⚠️ band, CU only (Notes)
[PASS]      KV-027: `Pause` uses `#[account]` (L169) and is loaded via `Account<'info, Pause>` (L113, L137, L166); no manual deserialization of program accounts
[N/A]       KV-028: feature absent — swap/claim/commit/price-sensitive instruction
[N/A]       KV-029: feature absent — withdraw / state-after-CPI pattern
[FAIL-6]    KV-030: The program has no `mint_to`; the TBILL mint's authority is a user-controlled hot wallet (`wallet.publicKey`, tests/initialize.ts:120, 129) — Step 2 FAIL; no supply cap (Step 4); no mint events (Step 5). `DefaultAccountState=Frozen` does not protect already-thawed accounts (F-002)
              File: tests/initialize.ts:120
              Impact: Unbounded issuance by one key
              Fix: Mint authority → multisig; monitor `MintTo`
[UNDETERMINED] KV-091: Steps 1–2 not runnable offline; Step 3 PASS (no upgrade-authority keypair in the repo); Step 4: program upgradeable by default, custody unverified. Reported with KV-020 under F-003 (severity 4 band; extent not determined within this assessment)
[PASS]      KV-101: The only sysvar read is `Rent::get()` (syscall, L38); no sysvar accounts are passed; no time-dependent logic
[N/A]       KV-102: feature absent — ed25519/secp256k1/instructions sysvar
[N/A]       KV-103: feature absent — address lookup tables; no positional trust
[PARTIAL]   KV-104: Canonical bumps only (Anchor `bump` without value → `find_program_address`; signer seeds use `ctx.bumps`, L44); no user-supplied bump; one-per-entity holds. ⚠️ band: bumps re-derived rather than stored (Notes)
[PASS]      KV-105: The program custodies no mint. The mint it serves has TransferHook + MetadataPointer + DefaultAccountState=Frozen and no PermanentDelegate/TransferFee/MintCloseAuthority (tests/initialize.ts:81-85); freeze default is the intended compliance control (KV-019). Admin registration of a mint does not inspect extensions (AV-063 PARTIAL, operator-error only)
[N/A]       KV-106: feature absent — no close path (grep `close` 0 hits); `init_if_needed` cannot revive because nothing is ever closed
[N/A]       KV-107: The program derives or assumes no ATAs; the hook validates mint/authority constraints (L144-153) and needs no canonical-ATA assumption
[N/A]       KV-108: Single fixed mint with known decimals (6) and no value math; `amount` is only logged (L71)
[N/A]       KV-109: feature absent — Anchor program (`#[program]` L22); no pinocchio/no_std/entrypoint!
[PASS*]     KV-111: Contexts are small — `TransferHook` holds 3 `InterfaceAccount`s (≈ 82 + 2×165 bytes), 1 `Account<Pause>` (1 byte) and 2 unchecked accounts; no large arrays or by-value structs; no deep call chains. *confidence: medium — the build (Step 1 linker warning check) could not be run in this engagement
[N/A]       KV-118: feature absent — stake accounts
[N/A]       KV-119: feature absent — durable nonce / governance proposals (OPS-077 records the generic replay nit for `update_pause`)
[N/A]       KV-120: feature absent — randomness
[N/A]       KV-121: feature absent — account compression / merkle
[FAIL-3]    KV-122: Step 1: no off-chain consumer of program logs exists in the repo (consumer side N/A). Step 4 FAIL: the program's only emission (`msg!("Amount sent: {}", amount)`, L71) is attacker-driven — `fallback`/`transfer_hook` can be invoked directly with an arbitrary `amount` and attacker-owned accounts satisfying L144-166, because the hook never checks the source account's Token-2022 `transferring` flag
              File: programs/tbill/src/lib.rs:69-90
              Impact: Any future indexer/keeper that trusts this log (or any stateful logic added to the hook) is spoofable; no on-chain effect today (F-004)
              Fix: Assert `TransferHookAccount.transferring == true` on `source_token` (check_is_transferring pattern)
[FAIL-5]    KV-123: Step 1 FAIL: `initialize_extra_account_meta_list` implicitly assumes the target PDA holds exactly 0 lamports — System `create_account` (L47-59) returns `AccountAlreadyInUse` for any pre-funded destination. Step 2 PASS: no `mut` on builtins/sysvars (the writable `pause` extra account is a program PDA — KV-131). Step 3 FAIL for this account: a donated balance is not tolerated
              File: programs/tbill/src/lib.rs:47-59
              Impact: Permissionless, permanent bricking of validation-account creation for a mint (F-001)
              Fix: Handle the pre-funded case (transfer diff → allocate → assign, PDA-signed) as Anchor `init` does
[N/A]       KV-125: feature absent — bonding curve / graduation
[FAIL-5]    KV-127: The validation account address `[b"extra-account-metas", mint]` is fully public; creation uses a raw `create_account` that cannot tolerate a pre-funded target. The admin gate (L120-124) does not help — funding an address needs no signature. `update_pause` (L106-113) is tolerant via `init_if_needed` and Anchor re-validates the pre-existing branch (owner, discriminator, space) before the overwrite
              File: programs/tbill/src/lib.rs:47-59
              Impact: Front-run/pre-fund → the honest admin call reverts every time → the mint cannot be transferred until a program upgrade or hook migration (F-001)
              Fix: As KV-123
[N/A]       KV-128: feature absent — no floating point
[N/A]       KV-129: feature absent — keeper request/execute lifecycle
[N/A]       KV-130: feature absent — CLMM/DLMM math
[FAIL-3]    KV-131: Step 1: `pause` is a global-seed account (`[b"pause"]`) and it is registered `is_writable = true` in the ExtraAccountMetaList (L34), so EVERY Token-2022 transfer of the mint takes a write lock on it. Step 4 FAIL: the admin path (`update_pause`, `mut` L106) and the hot transfer path write-lock the same account. Step 3 FAIL: the hook only reads `pause` (L70); the lock is unnecessary. No liquidation/settlement race exists, so the ⚠️ band applies (throughput cap, spam/priority-fee griefing on one account)
              File: programs/tbill/src/lib.rs:34
              Impact: All TBILL transfers serialize on one account cluster-wide; a griefer can spam cheap writes / out-bid on that account to delay transfers (F-005)
              Fix: Register the extra account read-only (`is_writable = false`)
[N/A]       KV-134: No Token ACL / SRFC-37: the TBILL mint's freeze authority is the Squads multisig itself (tests/initialize.ts:121), not `TACLkU6…`; there is no gate program or `MINT_CFG`. Permissioning is direct freeze-authority thaw/freeze with `DefaultAccountState=Frozen` (evaluated under KV-019 / AC-036)
[N/A — out of scope: --scope program; no backend component]   KV-031 … KV-055 (25 vectors)
[N/A — out of scope: --scope program; no frontend component]  KV-056 … KV-075 (20 vectors)
[N/A — out of scope: --scope program; devops checklists 11–13 not loaded]  KV-076 … KV-090, KV-092 … KV-100 (24 vectors)
[N/A — out of scope: no AI-agent component]                   KV-110, KV-113 … KV-117 (6 vectors)
[N/A — out of scope: no off-chain Rust service]               KV-112
[N/A — out of scope: no custodial wallet / session component] KV-124, KV-126
[N/A — out of scope: no token-registry / risk-API consumer]   KV-132, KV-133
[N/A — out of scope: no fee-sponsor or transaction reader]    KV-135, KV-136
```

---

## 7. Instruction Matrix

| Instruction | File | Signers | CPI Calls | PDA Seeds | Checked Math | State Changes | Findings |
|---|---|---|---|---|---|---|---|
| `initialize_extra_account_meta_list` | `lib.rs:26-67` (accounts L118-140) | `payer` = `ADMIN_PUBKEY` | System `create_account` (PDA-signed) | `[b"extra-account-metas", mint]` (create); `[b"pause"]` (read) | n/a — `size_of(1)? as u64`, `Rent::minimum_balance` | creates + initializes the validation account (1 meta: `pause`, writable) | F-001, F-005, AV-063 |
| `transfer_hook` (via `fallback` `Execute`) | `lib.rs:69-90` (accounts L142-167) | none — invoked by Token-2022 with de-escalated accounts; directly callable | none | `[b"extra-account-metas", mint]`, `[b"pause"]` (both read) | n/a — `amount` only logged | none (reads `pause.state`) | F-004, F-007 |
| `update_pause` | `lib.rs:92-96` (accounts L99-116) | `payer` = `ADMIN_PUBKEY` | Anchor `init_if_needed` (System create/transfer/allocate/assign) | `[b"pause"]` | constant `size_of::<Pause>() + 8` | `pause.state ← state` | F-003, F-008, F-009 |

---

## 8. State Model Verification

### Account Types

| Account | Discriminator | Space | Owner | Close Target |
|---|---|---|---|---|
| `Pause` (`[b"pause"]`) | Anchor 8-byte (`#[account]`, L169) — verified | 9 bytes (8 + `state: bool`) | this program (Anchor init) | none — permanent by design |
| ExtraAccountMetaList (`[b"extra-account-metas", mint]`) | SPL TLV `ExecuteInstruction` discriminator (L61) — written on init, never loaded as an Anchor account | `ExtraAccountMetaList::size_of(1)` (= 51 bytes) | this program (`create_account` owner = `program_id`, L58) | none — permanent by design |

### State Machine Transitions

```
∅ ──update_pause(admin, s)──▶ Pause{state=s} ──update_pause(admin, s')──▶ Pause{state=s'}   (reversible, idempotent)
Pause ∧ mint ──initialize_extra_account_meta_list(admin)──▶ ExtraAccountMetaList[mint]        (one-shot; blocked forever if PDA pre-funded — F-001)
Token-2022 transfer_checked(mint) ──▶ hook: require!(pause.state == false)  ──▶ Ok | Error::Paused
mint_to / burn on the mint ──▶ no hook invocation (pause does not apply)
```

### Invariants Verified

| Property | Description | Status |
|---|---|---|
| INV-01 | A Token-2022 transfer of a registered mint reverts while `pause.state == true` (`lib.rs:70`) | ✅ PASS in code — ❌ untested (F-006) |
| INV-02 | Only `ADMIN_PUBKEY` can change `pause.state` (`lib.rs:101-105`) | ✅ PASS |
| INV-03 | At most one validation account per mint, creatable only by the admin (`lib.rs:47-59`, L120-124) | ✅ PASS |
| INV-04 | The admin can always create a mint's validation account (liveness) | ❌ FAIL — pre-funded PDA blocks creation (F-001) |
| INV-05 | The hook mutates no state and performs no CPI (`lib.rs:69-73`) | ✅ PASS |
| INV-06 | The `pause` and validation accounts cannot be substituted (seed-bound, typed) (`lib.rs:157-166`) | ✅ PASS |
| INV-07 | The hook is only invoked by Token-2022 during a real transfer | ❌ NOT ENFORCED — direct invocation possible (F-004; benign today) |
| INV-08 | TBILL supply changes only through a governed authority | ❌ NOT ESTABLISHED — mint authority on a hot wallet per the runbook (F-002) |

---

## 9. Code Maturity Scorecard

> Engineering-quality gate (Phase 4.5), orthogonal to the risk score. 0 absent · 1 ad-hoc · 2 partial · 3 good · 4 strong (weakest-link).

| # | Category | Score (0-4) | Evidence (file:line / artifact) | Gap to next level |
|---|----------|:-----------:|---------------------------------|-------------------|
| 1 | Access Controls | 2 | `Signer` + `address = ADMIN_PUBKEY` on both admin paths (lib.rs:101-105, 120-124); admin constant not rotatable; custody unverified (F-003) | rotatable admin in state; verified multisig; documented authority map |
| 2 | Arithmetic | 3 | No value math; `overflow-checks = true` (Cargo.toml:8); only constant/space arithmetic (lib.rs:37, 109) | n/a beyond keeping it that way (nothing to prove) |
| 3 | Account & Type Safety | 3 | Typed accounts, seeds + canonical bump everywhere (lib.rs:106-167); one raw `AccountInfo` (L131); no `transferring` check (F-004) | `UncheckedAccount` + `check_is_transferring`; stored bumps |
| 4 | Input Validation | 2 | Mint/authority constraints on hook accounts (L144-153); registered mint not verified (AV-063); pre-funded PDA unhandled (F-001); delegate case unconsidered (F-007) | tolerate pre-funded PDA; assert mint hook binding; explicit delegate policy |
| 5 | Testing | 1 | Happy-path mocha suite on test validator (tests/tbill.ts); paused path never exercised; no balance assertions (F-006) | negative tests for the pause, initialize, double-init, delegate; balance asserts |
| 6 | Fuzzing & Property Tests | 0 | none | LiteSVM/Trident harness with the four adversarial cases |
| 7 | Error Handling & DoS Resilience | 2 | No `unwrap`/`panic`; specific error codes (L174-180); but pre-creation DoS (F-001) and global write lock (F-005) | fix F-001/F-005; CU baseline |
| 8 | Upgradeability & Governance | 1 | Upgradeable by default; authority unverified; no timelock; admin hardcoded; pause exists (lib.rs:92-96) | multisig + timelock on upgrade authority; rotatable admin; documented decisions |
| 9 | Monitoring & Incident Response | 1 | `msg!` on transfers only (L71); no events (F-009); no runbook / SECURITY.md (F-011) | events on pause/registration; alerts on `MintTo`, upgrades, pause; runbook |
| **Weighted Maturity** | | **1.7 / 4.0** | | |

Categories scoring ≤ 1 (Testing, Fuzzing & Property Tests, Upgradeability & Governance, Monitoring & IR) are prioritized in the Remediation Roadmap regardless of individual finding severity.

---

## 10. Remediation Roadmap

### Immediate — Severity 9-10 (Block Deploy)

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| — | — | None | — | — |

### Before Release — Severity 7-8

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| — | — | None | — | — |

### Within 2 Weeks — Severity 5-6

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-002 | 6 | Mint authority → Squads multisig at initialization (or `set_authority` in the same tx); alert on `MintTo` | 1 h script + ops procedure | Issuer ops / multisig |
| F-001 | 5 | Tolerate a pre-funded validation PDA (transfer shortfall → allocate → assign); run the init step right after mint creation; add the pre-funded-PDA test | 2-4 h + redeploy | Program team |

### Next Sprint — Severity 3-4

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-003 | 4 | Verify `ADMIN_PUBKEY` is the Squads vault PDA; rotatable admin in a config PDA; upgrade authority → multisig with timelock; document deploy/upgrade procedure and authority map | 1-2 d | Program team + ops |
| F-004 | 3 | `check_is_transferring` on `source_token` | 1 h | Program team |
| F-005 | 3 | Register `pause` read-only in the ExtraAccountMetaList | 1 h + redeploy | Program team |
| F-006 | 3 | Paused-transfer, unauthorized-initialize, double-init, delegate and pre-funded-PDA tests; CI with build/test/clippy/audit; LiteSVM or Trident harness | 1-2 d | Program team |

### Backlog — Severity 1-2

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-007 | 2 | Decide and document the delegate policy; adjust the `source_token` constraint | 30 min | Program team |
| F-008 | 2 | Split `initialize_pause` (`init`, fail-closed) from `update_pause` (`mut`) | 1 h | Program team |
| F-009 | 2 | `emit!` on pause change and validation-account creation | 30 min | Program team |
| F-010 | 2 | `.gitignore` key/env patterns; do not persist `mint-keypair.json` in the tree; gitleaks pre-commit | 30 min | Program team |
| F-011 | 1 | Pin `[toolchain]`; add mainnet/devnet program entries; drop unused deps/accounts; rename `Error`; `UncheckedAccount`; SECURITY.md + runbook | 2-3 h | Program team |

Maturity uplift (independent of findings): Testing/Fuzzing → F-006; Upgradeability & Governance → F-003; Monitoring & IR → F-009 + runbook (F-011) + alerts on `update_pause`, `MintTo`, `set_authority`, program upgrades. Full roadmap: `audit_2/roadmap.md`.

---

## 11. Re-Audit Checklist

- [ ] All Critical findings fixed and verified — none reported
- [ ] All High findings fixed and verified — none reported
- [ ] Medium findings (F-001, F-002) addressed or accepted with documented risk
- [ ] Regression tests added for each fix (paused transfer, pre-funded PDA, unauthorized initialize, double init, delegate transfer)
- [ ] Program re-deployed and verified on-chain (`solana program show 48n7YGEww7fKMfJ5gJ3sQC3rM6RWGjpUsghqVfXVkR5A` — authority, last deploy slot)
- [ ] Binary hash matches source code (pinned toolchain, `solana-verify`)
- [ ] On-chain authorities confirmed: mint / freeze / transfer-hook / metadata / upgrade / admin all on the multisig, threshold ≥ ceil(N/2)+1

---

## 12. Appendices

### A. Tool Versions

```
solana-cli: not executed (static-only engagement)
anchor-cli: not executed — repository targets anchor-lang 0.30.1 (Cargo.lock), Anchor.toml [toolchain] unpinned
node / npm: not executed — package-lock.json lockfileVersion 3, typescript 4.9.5, mocha 9.2.2, @solana/spl-token 0.4.9, @solana/web3.js 1.95.4
rustc / cargo: not executed — solana-program 1.18.19, spl-token-2022 3.0.4, spl-transfer-hook-interface 0.6.5, spl-tlv-account-resolution 0.6.5 (Cargo.lock)
auditor-skill: 7.3.0@6bb2cbf
```

### B. Environment

```
OS: Linux (WSL2) — read-only static analysis; no build, test, install, network or on-chain query was performed
Cluster tested: none (on-chain state not observed; upgrade authority and multisig configuration UNKNOWN)
RPC Provider: none
Working tree: detached HEAD at 948bb2bb1c224c51ef7aeec7fc1d2bee3dcc24d4 (shallow clone — git history not inspectable)
Artifacts: audit_2/intake.md · audit_2/checkpoint.md · audit_2/worksheets/context/*.md · audit_2/verdicts/*.md · audit_2/roadmap.md · audit_2/REPORT.md
```

### C. Disclaimer

This audit report is provided as-is. It represents a point-in-time, static-only review of the codebase at commit `948bb2bb1c224c51ef7aeec7fc1d2bee3dcc24d4`. Findings whose validation depends on on-chain state or operational process (F-002, F-003, checklist 07 UNKNOWN items) are reported with explicit uncertainty and must be confirmed against the live deployment. No guarantee is made that all vulnerabilities have been found; this is audit-shaped automation, not a substitute for a human firm audit. The audit does not constitute financial or legal advice, and it does not issue a "safe to deploy" guarantee.
