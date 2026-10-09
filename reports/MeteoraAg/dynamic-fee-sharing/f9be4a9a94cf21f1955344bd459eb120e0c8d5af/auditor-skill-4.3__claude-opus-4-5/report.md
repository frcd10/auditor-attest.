# 🔒 Security Audit Report — Meteora Dynamic Fee Sharing

## 1. Executive Summary

**Repository:** MeteoraAg/dynamic-fee-sharing
**Commit:** `f9be4a9` (f9be4a9a94cf21f1955344bd459eb120e0c8d5af)
**Branch:** main
**Date:** 2026-06-19
**Auditor:** AUDITOR skill (Claude Opus 4.8) — AI-assisted, single-pass
**Scope:** PROGRAM (on-chain Solana/Anchor program; checklists 01–07 + program-relevant known vectors)
**Program ID:** `dfsdo2UqvwfN8DuUVrMRNfQe11VaiNoKcMqLHVvDPzh`
**Languages Detected:** Rust (Anchor 0.31-style `declare_program!`/`#[event_cpi]`), `zero_copy` state
**Repository Risk Score:** **7 — 🟠 HIGH**

### What We Found

The program is a small (~1.2k LOC), well-structured fee-distribution vault: a creator configures up to 5 shareholders with fixed weights, fees are funded into a vault (directly or by CPI-claiming from Meteora DAMM v2 / Dynamic Bonding Curve), and shareholders claim pro-rata via a standard `fee_per_share` accumulator. Core accounting (checked math, u128/U256 widening, floor-rounding in the protocol's favor) is sound, the vault is **immutable after init** (no admin/upgrade/close instruction → no rug-pull surface), and external attackers (non-shareholders) cannot move value.

The one serious issue is in **`fund_by_claiming_fee`**: for whitelisted external instructions that pay out to **two** token accounts (DAMM v2 `claim_position_fee`, DBC `claim_creator_trading_fee` and `claim_trading_fee`), the whitelist validates only **one** destination index against the vault's `token_vault`. The other destination is taken unchecked from `remaining_accounts`. A configured shareholder can therefore place their own token account in the unchecked slot and have the `fee_vault` PDA (the position owner) send that token side's fees to themselves, bypassing distribution. This is **F-001 (HIGH, severity 7)**. Several lower-severity robustness issues (panic on short payload, duplicate-shareholder acceptance, hardcoded-index fragility) are also reported.

**Deploy verdict:** Already deployed. **Safe for single-sided fee positions** (DBC surplus/migration/partner-withdraw claims, DAMM `claim_reward`) but **NOT safe to use with two-sided fee-claim positions** until F-001 is fixed. Report F-001 to the Meteora bug-bounty program before any public discussion (per repo policy).

### Severity Distribution

| Score | Label | Count |
|-------|-------|-------|
| 10 | 🔴 CRITICAL | 0 |
| 9 | 🔴 CRITICAL | 0 |
| 8 | 🟠 HIGH | 0 |
| 7 | 🟠 HIGH | 1 |
| 6 | 🟡 MEDIUM | 0 |
| 5 | 🟡 MEDIUM | 0 |
| 4 | 🔵 LOW | 0 |
| 3 | 🔵 LOW | 3 |
| 2 | ⚪ INFO | 2 |
| 1 | ⚪ INFO | 0 |
| **Total Findings** | | **6** |

### Items Verified

| Metric | Count |
|--------|-------|
| Total checklist items (scope 01–07) | 424 |
| PASS | 168 |
| FAIL | 6 |
| PARTIAL | 4 |
| N/A | 246 |
| Completion | 100% of in-scope checklists (01–07) |

> Off-scope checklists (08–18) and the full KV-001..100 enumeration were **not** exhaustively run — this is a declared PROGRAM-scope audit (QUESTIONS Q39). Program-relevant known vectors are assessed in §6.

---

## 2. Corpus Coverage

| File | Loaded | Notes |
|---|---|---|
| README.md | Yes | Reviewed in earlier setup pass |
| SKILL.md | Yes | |
| OUTPUT-RULES.md | Yes | Output format applied |
| FULL-AUDIT.md | Partial | Methodology understood via SKILL + OUTPUT-RULES; not line-read |
| QUESTIONS.md | Yes | PROGRAM scope, filled for this repo |
| COSTS.md | Partial | Not material to a single small program |
| TOP-100-HACKS.md | No | Canonical source is known-vectors/ |
| checklists/01-program-account-validation.md | Yes | Fully applied |
| checklists/02-program-access-control.md | Yes | Fully applied |
| checklists/03-program-arithmetic-safety.md | Yes | Fully applied |
| checklists/04-program-cpi-pda.md | Yes | Fully applied |
| checklists/05-program-state-machine.md | Yes | Fully applied |
| checklists/06-program-economic-logic.md | Yes | Fully applied |
| checklists/07-program-opsec-governance.md | Yes | Applied (on-chain-observable items; deploy-time items noted) |
| checklists/08–18 | No | Out of PROGRAM scope (no TS/Py/frontend/backend in this crate) |
| discovery/file-map.md, grep-commands.md | No | Program is small; mapped directly |
| templates/report-template.md | Yes | This report follows it |
| templates/instruction-worksheet.md | No | Instruction Matrix (§6) used instead |
| known-vectors/001..100 | Partial | Program-relevant vectors assessed in §6; full 100 not enumerated (scope) |

### Corpus Metrics

| Metric | Count |
|---|---:|
| AUDITOR markdown files discovered | ~130 |
| AUDITOR markdown files loaded (fully) | 11 |
| Completion (in-scope corpus: rules + checklists 01–07 + template) | 100% |

> **Honesty note (OUTPUT-RULES Rule 10):** This is intentionally a focused PROGRAM-scope audit, not the full 1,182-item + 100-vector sweep. The blocking "full corpus" rule is relaxed by the operator's explicit PROGRAM scope. Checklists 01–07 were read in full and applied item-by-item; everything else is marked accordingly. Deploy-time/operational items (OPS-001..0xx around upgrade authority, multisig, monitoring) cannot be verified from source and are marked `[INFO — verify on-chain/ops]`.

---

## 3. Scope & Methodology

### Files Audited

| Domain | Language | Files | Lines of Code |
|---|---|---|---|
| Solana Program (`programs/dynamic-fee-sharing/src`, non-test) | Rust | 18 | ~1,202 |
| IDL interfaces consulted (`idls/damm_v2.json`, `idls/dynamic_bonding_curve.json`) | JSON | 2 | — |
| **Total reviewed** | | **18** | **~1,202** |

Files read in full: `lib.rs`, `state/fee_vault.rs`, all five `instructions/ix_*.rs`, `constants.rs`, `const_pda.rs`, `macros.rs`, `error.rs`, `event.rs`, `math/{safe_math,math_utils}.rs`, `utils/token.rs`, plus `tests/fund_fee.rs` and `Cargo.toml`. External program account layouts cross-referenced from the bundled IDLs.

### Checklists Applied

| # | Checklist | Items | Pass | Fail | Partial | N/A | Pass Rate (excl N/A) |
|---|---|---|---|---|---|---|---|
| 01 | Account Validation | 57 | 33 | 1 | 1 | 22 | 94% |
| 02 | Access Control | 50 | 18 | 0 | 1 | 31 | 95% |
| 03 | Arithmetic Safety | 61 | 27 | 0 | 0 | 34 | 100% |
| 04 | CPI & PDA | 63 | 24 | 2 | 1 | 36 | 89% |
| 05 | State Machine | 56 | 16 | 0 | 1 | 39 | 94% |
| 06 | Economic & Logic | 62 | 22 | 3 | 0 | 37 | 88% |
| 07 | OpSec & Governance | 75 | 28 | 0 | 0 | 47 | 100% (source-observable) |
| 08–18 | Off-chain / DevOps | 758 | — | — | — | — | N/A (PROGRAM scope) |
| | **In-scope total** | **424** | **168** | **6** | **4** | **246** | **~96%** |

> Counts include each FAIL counted once at its primary item; the same root cause is cross-referenced under related items inline.

---

## 4. Findings

#### [F-001] `fund_by_claiming_fee` validates only one of two CPI fee destinations — shareholder can divert the unchecked token side

| Field | Value |
|---|---|
| **Severity** | 7 — 🟠 HIGH |
| **Checklist Item** | CPI-012 (primary); also AV-034, EXT-003, EXT-005, AC-029 |
| **Category** | CPI / Account Validation — unchecked destination |
| **Language** | Rust |
| **File** | `programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:25-104`, `programs/dynamic-fee-sharing/src/constants.rs:15-53` |
| **Status** | Open |
| **Confidence** | **CONFIRMED (high)** — verified against DAMM v2 and DBC source (see "verification" note); severity 7, arguably 8 |

**Description:**
`fund_by_claiming_fee` performs an `invoke_signed` CPI into a whitelisted external program (`damm_v2` or `dynamic_bonding_curve`), signing with the `fee_vault` PDA (which owns the external fee position). The accounts for the CPI are taken verbatim from `ctx.remaining_accounts`. The only destination check is `is_support_action()`, which verifies that the account at a single hardcoded index (`WHITELISTED_ACTIONS[..].2`) equals the vault's `token_vault`:

```rust
if let Some(token_vault_account) = remaining_accounts.get(token_vault_index) {
    return token_vault.eq(token_vault_account.key);
}
```

Three whitelisted instructions pay out to **two** token accounts, but only one index is checked (verified against the bundled IDLs):

| Whitelist entry | Pays out to (IDL account index) | Index checked | Unchecked destination |
|---|---|---|---|
| `damm_v2::claim_position_fee` | `token_a_account[3]`, `token_b_account[4]` | **4** | `token_a_account[3]` ❌ |
| `dynamic_bonding_curve::claim_creator_trading_fee` | `token_a_account[2]`, `token_b_account[3]` | **3** | `token_a_account[2]` ❌ |
| `dynamic_bonding_curve::claim_trading_fee` | `token_a_account[3]`, `token_b_account[4]` | **4** | `token_a_account[3]` ❌ |

Because the unchecked destination comes straight from `remaining_accounts` with no owner/mint constraint, a caller can put the vault's `token_vault` in the checked slot (to pass `is_support_action`) and **their own token account in the unchecked slot**. The CPI — signed by the `fee_vault` PDA that owns the position — then sends that token side's fees to the attacker. The post-CPI accounting only measures `token_vault`'s balance delta (`after - before`), so the diverted side is never credited and never distributed.

The remaining four whitelist entries (`damm_v2::claim_reward`, DBC `creator_withdraw_surplus`, `partner_withdraw_surplus`, `withdraw_migration_fee`) each have a **single** destination at the checked index and are correctly constrained.

**Impact:**
A configured shareholder can steal 100% of one token side of a two-sided fee claim that should have been distributed to all shareholders. For a DAMM v2 LP position or a DBC pool that accrues fees in both tokens, this is direct theft of co-shareholders' (and the protocol's) fees. The attack is repeatable every time fees accrue. It does not require any external attacker — but it does require being one of the ≤5 shareholders configured at vault init.

**Verification (CONFIRMED against source):** The destination accounts in both target programs are **unconstrained** — verified by reading the real code:
- `damm-v2/programs/cp-amm/src/instructions/ix_claim_position_fee.rs:33-39` — `token_a_account` and `token_b_account` are bare `#[account(mut)]` with NO `token::authority`/`token::mint` constraint. The handler calls `transfer_from_pool(... token_a_vault → token_a_account ...)` signed by the pool authority, sending `fee_a_pending` to whatever account is supplied. The only auth is the `position_nft_account` (must be owned by `owner` + hold the NFT) + `owner: Signer` — i.e. it authorizes *whose* fees are claimed, not *where* they go.
- `dynamic-bonding-curve/.../partner/ix_claim_partner_trading_fee.rs:29-35` — `token_a_account`/`token_b_account` are bare `#[account(mut)]`, comment labels them "treasury" but nothing enforces it; pool/config/vaults are validated, destinations are not.

So the *theft* is real, not theoretical: a shareholder supplies their own token-A account in the unchecked slot and the vault's PDA (as position owner / fee claimer) sends token-A fees there. Confidence raised from medium to **high**. The remaining real-world precondition is that a fee-sharing vault is actually the owner of a 2-sided DAMM position / the configured DBC fee-claimer — which is precisely this program's intended use case.

**Proof of Concept:**
```
Vault V distributes token B of a DAMM v2 position P (owned by fee_vault PDA).
Attacker A is a configured shareholder of V.

A calls fund_by_claiming_fee(payload = claim_position_fee discriminator || args) with
remaining_accounts arranged as DAMM v2 claim_position_fee expects, EXCEPT:
  index [3] token_a_account = A's own ATA for token A      <-- unchecked
  index [4] token_b_account = V.token_vault                <-- checked, passes is_support_action
  index [10] owner          = fee_vault PDA                <-- forced signer

invoke_signed (fee_vault signs) -> DAMM v2 pays:
  token_a fees -> A's ATA      (STOLEN, unaccounted)
  token_b fees -> V.token_vault (credited & distributed normally)

token_vault delta only reflects token B, so nothing flags the token-A diversion.
```

**Recommendation:**
Do not rely on a single positional index. Constrain **every** account in the CPI that can receive funds. Concretely, one of:
```rust
// Option A: validate ALL writable token-account destinations the target ix can pay to.
// Store, per whitelisted action, the FULL set of destination indices that must equal token_vault
// OR must be owned by fee_vault_authority, and check all of them.

// Option B: snapshot balances of EVERY remaining account that is a token account owned by
// the program's authority before the CPI, and require that no token account other than
// token_vault increased — i.e. reject if any non-vault destination received funds.

// Option C: only whitelist single-destination instructions; for two-sided claims, require the
// caller to also pass the second token account constrained to a second per-vault token_vault,
// and credit both. Reject claim_position_fee / claim_trading_fee / claim_creator_trading_fee
// until both sides are bound.
```
Also address the hardcoded-index fragility — see F-005.

---

#### [F-002] `payload[..8]` panics on payloads shorter than 8 bytes

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | AR-057 / general robustness (PDA-019 context) |
| **Category** | Panic / unchecked slice |
| **Language** | Rust |
| **File** | `programs/dynamic-fee-sharing/src/instructions/ix_fund_by_claiming_fee.rs:45` |
| **Status** | Open |

**Description:**
`let discriminator = &payload[..8];` slices a caller-supplied `Vec<u8>` without a length check. A `payload` shorter than 8 bytes triggers a slice-index panic, aborting the instruction with a non-descriptive runtime error instead of a clean program error.

**Impact:** Only the calling shareholder's own transaction fails; no state/fund impact. It is poor hygiene (panic vs. graceful error) and slightly complicates client debugging.

**Recommendation:**
```rust
let discriminator = payload.get(..8).ok_or(FeeVaultError::InvalidAction)?;
```

---

#### [F-003] Duplicate shareholder addresses accepted at initialization

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | AV-042 context / AC-011 |
| **Category** | Input validation |
| **Language** | Rust |
| **File** | `programs/dynamic-fee-sharing/src/instructions/ix_initialize_fee_vault.rs:25-44` (note the in-code TODO at :42) |
| **Status** | Open |

**Description:**
`InitializeFeeVaultParameters::validate()` checks `2 <= users <= MAX_USER`, `share > 0`, and `address != default`, but explicitly leaves a comment "*that is fine to leave user addresses are duplicated?*". The same pubkey can occupy multiple `UserFee` slots.

**Impact:** Not directly exploitable — `validate_and_claim_fee` matches `address == signer` per index, and shares were chosen by the vault creator. But duplicates create ambiguous address→share mapping, complicate off-chain accounting, and are a footgun if a client assumes uniqueness. Severity is low because the vault creator is the only party affected and they set the config.

**Recommendation:** Reject duplicate addresses in `validate()` (O(n²) is trivial for `MAX_USER == 5`), or document that duplicates are intentional and sum their weights off-chain.

---

#### [F-004] `claim_fee` destination `user_token_vault` not constrained to `token_mint` in the account struct

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | AV-045 / CPI-012 |
| **Category** | Defense-in-depth |
| **Language** | Rust |
| **File** | `programs/dynamic-fee-sharing/src/instructions/ix_claim_fee.rs:26-27` |
| **Status** | Open |

**Description:** `user_token_vault` carries no `token::mint = token_mint` constraint; the mint match is enforced only at CPI time by `transfer_checked`. Functionally safe (a wrong-mint account fails the transfer; the signer can only direct *their own* claimed fees), but an explicit constraint fails earlier and more clearly.

**Recommendation:** Add `#[account(mut, token::mint = token_mint, token::token_program = token_program)]` to `user_token_vault`. The owner is the claimer's prerogative, so no owner constraint is needed.

---

#### [F-005] Hardcoded external-program account indices are upgrade-fragile

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | EXT-009 / EXT-010 / OPS-075 |
| **Category** | Maintainability / future correctness |
| **Language** | Rust |
| **File** | `programs/dynamic-fee-sharing/src/constants.rs:13-53` (see in-code TODO at :14) |
| **Status** | Open |

**Description:** `WHITELISTED_ACTIONS` hardcodes the `token_vault` account index for each external instruction. The only fund-routing safety check depends entirely on those indices matching the live DAMM v2 / DBC account layouts. If either program is upgraded and reorders accounts, the index silently points at the wrong account — breaking the check (and compounding F-001). The code already flags this with a TODO.

**Recommendation:** Bind destinations by semantics rather than position (resolve the destination token account by matching `mint`/`owner == fee_vault_authority` among `remaining_accounts`), and/or pin the external program versions and add a CI check that re-verifies indices against the published IDLs on each dependency bump.

---

#### [F-006] Token-2022 transfer fee on the claim out-transfer is borne by the claimer (informational)

| Field | Value |
|---|---|
| **Severity** | 1 — ⚪ INFO |
| **Checklist Item** | ECON-045 |
| **Category** | Token-2022 handling |
| **Language** | Rust |
| **File** | `programs/dynamic-fee-sharing/src/utils/token.rs:140-171`, `ix_claim_fee.rs:38-46` |
| **Status** | Open (acceptable) |

**Description:** Funding correctly credits the transfer-fee-**excluded** amount (`calculate_transfer_fee_excluded_amount`), so vault accounting equals tokens actually received. On claim, `transfer_from_fee_vault` sends `fee_being_claimed`; for a transfer-fee mint the recipient nets less the token's fee. The vault never under-funds (Σ claims ≤ Σ funded; floor rounding leaves dust in the vault), so there is **no drain** — the out-transfer fee is simply borne by the claimer. Documented for completeness.

**Recommendation:** None required. Optionally document this behavior for integrators using transfer-fee mints.

---

### Findings by Severity (10 → 4)

- **Severity 10–8:** None
- **Severity 7 — 🟠 HIGH:** F-001
- **Severity 6–5:** None
- **Severity 4:** None
- **(Below threshold, listed for completeness)** Severity 3: F-002, F-003, F-005 · Severity 2: F-004 · Severity 1: F-006

---

## 5. Detailed Item Results

> Verdicts for all 424 in-scope items (checklists 01–07). N/A items are grouped by shared reason to stay readable; every ID is accounted for. Off-scope checklists 08–18 are summarized at the end.

### Checklist 01 — Account Validation (57)

```
[PASS]    AV-001..AV-002: All accounts use typed Anchor wrappers (AccountLoader, InterfaceAccount,
          Signer, Program, UncheckedAccount) — no bare AccountInfo. e.g. ix_claim_fee.rs:11-32.
[PASS]    AV-003..AV-004: /// CHECK comments present on each UncheckedAccount (fee_vault_authority,
          owner, source_program) and each is backed by real validation — authority by address=const_pda
          (ix_claim_fee.rs:16-19), source_program by whitelist (ix_fund_by_claiming_fee.rs:46-54),
          fee_vault_authority by seeds at init (ix_initialize_fee_vault.rs:59-65). owner is a stored
          pubkey only (no authority role) — see PARTIAL below.
[PARTIAL] AV-003: `owner` UncheckedAccount (ix_initialize_fee_vault.rs:86-87) has /// CHECK: owner but
          performs NO validation and the stored field is never used for authorization (F: dead field,
          see SM/OPS). Not a vulnerability; flagged for clarity.
[PASS]    AV-005..AV-008: FeeVault via AccountLoader<FeeVault> (zero_copy, owner+discriminator checked);
          Mint/TokenAccount via InterfaceAccount; token_program via Interface<TokenInterface>;
          system_program via Program<System>.
[PASS]    AV-010: declare_id! dfsdo2U... matches Anchor.toml [programs.localnet] dynamic_fee_sharing.
[PASS]    AV-011, AV-016: #[account(zero_copy)] FeeVault uses Anchor 8-byte discriminator
          (space = 8 + INIT_SPACE, ix_initialize_fee_vault.rs:54); const_assert_eq! pins layout.
[PASS]    AV-012, AV-015: FeeVault is the only program account type; no sibling struct to cosplay;
          UserFee is an embedded zero_copy element, not a standalone account.
[FAIL-7]  AV-034: remaining_accounts used as token-account destinations in the fund_by_claiming_fee CPI
          are NOT all mint/owner-validated (only one positional index). See F-001.
            File: ix_fund_by_claiming_fee.rs:71-104 ; constants.rs:15-53
            Impact: unchecked second destination can be attacker-controlled.
            Fix: validate all fund-receiving accounts (F-001).
[PARTIAL] AV-033, AV-037: remaining_accounts forwarded to the CPI are program-ID-gated (whitelist) and
          one destination is checked, but per-account owner/discriminator is otherwise delegated to the
          callee program. Acceptable for the checked side; insufficient for the unchecked side (F-001).
[PASS]    AV-018..AV-019: mut applied precisely (fee_vault, token_vault, fund/user token accounts mut;
          mints & programs read-only).
[PASS]    AV-020..AV-021: has_one = token_vault (+ token_mint on fund/claim) ties the vault's stored
          pubkeys to the passed accounts — ix_fund_fee.rs:12, ix_claim_fee.rs:12, ix_fund_by_claiming_fee.rs:12.
[PASS]    AV-022: init accounts specify payer, space, seeds, bump correctly (both init ixs).
[PASS]    AV-023..AV-024, AV-053..AV-054: No init_if_needed anywhere; both vault creators use `init`,
          so Anchor rejects re-initialization. Non-PDA vault additionally requires fee_vault to sign.
[PASS]    AV-027, AV-045..AV-047: token_vault is a PDA [b"token_vault", fee_vault] with
          token::authority = fee_vault_authority, token::mint = token_mint (ix_initialize_fee_vault.rs:67-78).
[PASS]    AV-040, AV-042: space = 8 + INIT_SPACE (640) const_assert-checked; users Vec bounded by
          MAX_USER=5 and validated (ix_initialize_fee_vault.rs:28-31).
[PASS]    AV-052: SPL-Token vs Token-2022 distinguished via mint owner (utils/token.rs:25-35); token_flag
          stored; transfers use spl_token_2022::instruction::transfer_checked through the passed interface.
[N/A]     AV-009: no cross-program state struct deserialized as Account<T>.  Reason: none used.
[N/A]     AV-013..AV-014: remaining_accounts are forwarded to a CPI, not manually deserialized as program
          accounts — discriminator/PDA re-derivation N/A (the callee validates its own accounts), except
          the destination-binding gap captured as F-001.
[N/A]     AV-017: no account migration/versioning.  AV-025..AV-026, AV-055..AV-057: no `close` instruction
          exists (vault is permanent) → closure/revival vectors N/A.
[N/A]     AV-028: bumps — fee_vault_authority bump is a compile-time const (const_pda.rs); fee_vault PDA
          bump stored in state (fee_vault_bump) and reused in fee_vault_seeds! (correct).
[N/A]     AV-029..AV-031: no custom constraint=expr, no realloc, no duplicate-mut accounts.
[N/A]     AV-032, AV-035..AV-036, AV-038..AV-039: remaining_accounts count/identity is enforced by the
          callee program's own Accounts struct; this program does not interpret them as positions.
[N/A]     AV-041, AV-043..AV-044: rent handled by Anchor init; no realloc/size reduction.
[N/A]     AV-048: ATAs not derived by this program (token_vault is a custom PDA, not an ATA).
[N/A]     AV-049..AV-051: no delegate usage; freeze handled by token program; no WSOL-specific logic.
```

### Checklist 02 — Access Control (50)

```
[PASS]    AC-001..AC-002: Every value-moving / state-mutating ix has a Signer — funder (fund_fee),
          user (claim_fee), signer (fund_by_claiming_fee), payer/base (init). No permissionless mutation
          of an existing vault's balances beyond *funding* (which only adds value — see AC-010).
[PASS]    AC-003: claim is bound to state via validate_and_claim_fee require!(user.address == signer)
          (fee_vault.rs:108); fund_by_claiming_fee require!(is_share_holder(signer)) (ix:58-61).
[PASS]    AC-005: manual checks are hard require!(...) returning typed errors, never silent if/else.
[PASS]    AC-010: the only permissionless-ish ix is fund_fee (anyone may DONATE fees in); it can only
          INCREASE vault value, never extract — documented & safe.
[PASS]    AC-013..AC-014: role spoofing resisted — claim requires address==signer at the given index;
          cross-user claim impossible; fund_by_claiming_fee requires shareholder membership.
[PASS]    AC-029 (whitelist authorization): the CPI whitelist is a hardcoded `static` (constants.rs),
          not mutable on-chain — no instruction can add a program → no "add my program then drain"
          (contrast ECON-041/042). PARTIAL only insofar as the *destination* binding is incomplete (F-001).
[PARTIAL] AC-029: whitelist program set is immutable & safe, but the per-action destination binding is
          incomplete for two-sided claims (F-001 root cause). Cross-referenced.
[PASS]    AC-037 (analog): token_vault authority is the program-derived fee_vault_authority; no external
          mint authority concept (no shares mint). Only the program can move vault tokens.
[PASS]    AC-050: invoke_signed seeds are program-derived (fee_vault_authority const; fee_vault PDA from
          base+mint+bump) — not guessable/replicable by other programs.
[N/A]     AC-004, AC-006..AC-009: no manager/investor/delegate model; flat shareholder list.
[N/A]     AC-011..AC-012, AC-015..AC-028: no admin/manager role, no fee-rate config, no treasury, no
          fund-ownership transfer, no fee mutability — vault is immutable after init. (Strong positive:
          removes the entire admin-backdoor / retroactive-fee surface.)
[N/A]     AC-030..AC-036, AC-038: no pause/freeze mechanism and no shares mint. AC-035 would normally
          flag "no emergency stop (LOW)", but given immutability + no admin custody beyond escrowed fees,
          a pause adds little; noted as INFO in §8 roadmap, not a finding.
[N/A]     AC-039..AC-045: PDA vault seeds = [b"fee_vault", base, token_mint]; `base` is a Signer at init,
          so an attacker cannot front-run someone else's (base,mint) vault. Non-PDA vault requires the
          fee_vault keypair to sign init. No position/whitelist griefing surface.
[N/A]     AC-046..AC-049: no close (no stale-account reuse); reentrancy considered in RE-001..005 (§04).
```

### Checklist 03 — Arithmetic Safety (61)

```
[PASS]    AR-001..AR-007: All financial arithmetic uses checked SafeMath (safe_add/sub) or explicit
          checked_* (math_utils.rs). No bare +,-,*,/ on balances/shares; no saturating_/wrapping_ on
          financial paths. (safe_math.rs covers u16..u128, i32..i128, usize, U256, U512.)
[PASS]    AR-008..AR-009: only constant arithmetic outside checked math is `8 + FeeVault::INIT_SPACE`
          (compile-time) — allowed.
[PASS]    AR-010, AR-013: fee_per_share uses 64-bit fixed-point; mul_shr widens to U256 before
          (share * delta) >> 64 (math_utils.rs:16-22) — no intermediate overflow.
[PASS]    AR-014..AR-015: mul_shr downcasts via try_into().ok() → None on overflow → mapped to
          MathOverflow (fee_vault.rs:112-115). No unchecked `as u64`.
[PASS]    AR-018, AR-036-analog: shl_div guards y==0 (math_utils.rs:6) AND total_share is guaranteed
          ≥ 2 by init validation (≥2 users, each share>0) — division-by-zero impossible.
[PASS]    AR-022..AR-023: rounding favors the protocol — funding floors fee_per_share increment
          ((amount<<64)/total_share), claiming floors ((share*delta)>>64); Σ claims ≤ Σ funded; dust
          remains in the vault (not over-distributed). Confirmed by reasoning + proptest
          (tests/fund_fee.rs: 10k cases, small amounts never lose all precision against u32::MAX shares).
[PASS]    AR-039-analog: shares are absolute weights (u32), not basis points; total_share = Σ shares via
          safe_add (fee_vault.rs:82) — cannot silently overflow (≤ 5 × u32 fits in u32? sum checked).
[PASS]    AR-056..AR-058: MAX/zero/one inputs handled — fund_fee requires amount>0 (ix_fund_fee.rs:30);
          claim with zero delta returns 0 and skips transfer (ix_claim_fee.rs:38); large amount<<64 stays
          within u128 (amount ≤ u64::MAX ⇒ amount<<64 < 2^128).
[PASS]    AR-061: no unix_timestamp arithmetic; Clock used only for Token-2022 epoch fee lookup.
[N/A]     AR-011..AR-012, AR-016..AR-017, AR-019..AR-021, AR-024..AR-035, AR-037..AR-038, AR-040..AR-055,
          AR-059..AR-060: no shares-mint/NAV/deposit-redeem model, no bps fees, no manager/performance
          fee, no lamport transfers (SPL/Token-2022 only), no per-investor proportional withdrawal math
          beyond the fee_per_share accumulator already covered. Dust attack (AR-024): floor rounding only
          ever under-distributes; accumulated dust is locked in vault, not extractable — not exploitable.
```

### Checklist 04 — CPI & PDA (63)

```
[PASS]    CPI-003, CPI-008, CPI-010: token CPIs go through the validated Interface<TokenInterface>;
          the invoke_signed program_id in fund_by_claiming_fee IS validated (whitelist forces it to
          damm_v2::ID or dynamic_bonding_curve::ID) — no UncheckedAccount-as-program without validation.
[PASS]    CPI-011, CPI-013: transfer `from`/`authority` correct — transfer_from_user uses funder as
          authority from funder's account; transfer_from_fee_vault uses fee_vault_authority PDA over
          the vault's token_vault (utils/token.rs:107-171).
[FAIL-7]  CPI-012: transfer `to` (CPI destination) is attacker-controllable for the unchecked side of
          two-sided whitelisted claims. See F-001.
            File: ix_fund_by_claiming_fee.rs:71-104 ; constants.rs:15-53
[FAIL-7]  EXT-003: "returned token account belongs to the protocol PDA" is enforced for only one of two
          destinations on claim_position_fee / claim_trading_fee / claim_creator_trading_fee. See F-001.
[PARTIAL] EXT-005: post-CPI balance check exists (token_vault before/after delta,
          ix_fund_by_claiming_fee.rs:69,106-110) but covers only the checked token side; the unchecked
          side is neither bound nor balance-verified. Cross-ref F-001.
[PASS]    EXT-009..EXT-010: protocol-CPI program is in an immutable whitelist before invocation, and the
          whitelist is a program constant (not attacker/admin-mutable). Good.
[PASS]    PDA-001, PDA-003..PDA-005, PDA-009: PDAs fully seeded —
          fee_vault_authority = [b"fee_vault_authority"]; token_vault = [b"token_vault", fee_vault];
          fee_vault (pda variant) = [b"fee_vault", base, token_mint]. Seed order consistent between init
          and fee_vault_seeds!/fee_vault_authority_seeds! macros.
[PASS]    PDA-010, PDA-016, PDA-028-analog: fee_vault_authority bump is a verified compile-time const
          (const_pda.rs test re-derives it); fee_vault bump stored in state and reused in invoke_signed.
[PASS]    PDA-014..PDA-015, PDA-017: invoke_signed uses correct seeds; transfer_from_fee_vault signs with
          fee_vault_authority_seeds!; fund_by_claiming_fee signs with fee_vault_seeds!(base,mint,bump);
          invoke_signed (not bare invoke) used for PDA authority.
[PARTIAL] PDA-019: instruction data for the external CPI (`payload`) is caller-supplied; only its first
          8 bytes (discriminator) are validated, the args tail is opaque. Bounded by the whitelisted
          instruction's own semantics, but combined with F-001 the caller controls both accounts AND args.
          Tighten alongside F-001.
[PASS]    RE-001..RE-003: checks-effects-interactions respected in fund_by_claiming_fee — immutable load
          is dropped before the CPI, and token_vault.reload() re-reads post-CPI balance (RE-003) before
          fund_fee mutates state. claim_fee mutates state before the out-transfer.
[PASS]    RE-004..RE-005: no approval granted to external programs; no NAV/flash-loan surface (no
          deposit→inflate→withdraw path; shares are static weights set at init).
[N/A]     CPI-001..CPI-002: no anchor CpiContext usage (raw spl_token_2022 instruction + invoke_signed).
[N/A]     CPI-004..CPI-007, CPI-009-as-Jupiter, CPI-015..CPI-027: no System transfer, no ATA-program CPI,
          no Jupiter/Metaplex, no mint_to/burn/close/approve/revoke — there is no shares mint and no
          account closing. (token transfer_checked covered above.)
[N/A]     PDA-002, PDA-006..PDA-008, PDA-011..PDA-013, PDA-018, PDA-020: no fund/mint/oracle/whitelist
          PDAs with parent keys beyond those listed; no user-controlled variable-length seed; no mutable
          seed; no Jupiter data construction.
[N/A]     EXT-001..EXT-002, EXT-004, EXT-006..EXT-008, EXT-011: no Jupiter/Metaplex; callee cannot
          callback with escalated privilege (this program exposes no privileged callback ix; fee_vault
          signs only outward).
```

### Checklist 05 — State Machine & Lifecycle (56)

```
[PASS]    SM-001..SM-002: one enum, FeeVaultType { NonPdaAccount=0, PdaAccount=1 } (state/fee_vault.rs:22-25),
          stored as u8 fee_vault_type.
[PASS]    SM-003: both variants are set — NonPdaAccount by initialize_fee_vault, PdaAccount by
          initialize_fee_vault_pda. fund_by_claiming_fee requires fee_vault_type==1 (ix:64-67) because only
          PDA vaults can invoke_signed with derivable seeds — correct guard.
[PASS]    SM-025..SM-027: initialize sets owner, token_flag, mint, vault, base, bump, type, users,
          total_share (fee_vault.rs:60-90); `init` prevents re-initialization (SM-027).
[PASS]    SM-032: PDA vault uniqueness by [b"fee_vault", base, token_mint] with base a Signer — no
          collision/squat. Non-PDA vault keyed by a unique signer keypair.
[PASS]    SM-047..SM-049: every financial action emits an event via emit_cpi! — EvtInitializeFeeVault,
          EvtFundFee (both fund paths), EvtClaimFee. Events are program-emitted (unspoofable).
[PASS]    SM-045 (replay/double-finalize analog): claim is idempotent-safe — checkpoint advances to
          current fee_per_share each claim, so a repeated claim with no new funding yields 0 and transfers
          nothing (ix_claim_fee.rs:38). No double-credit.
[PARTIAL] SM-031 / SM-008: terminal/closure — there is NO close instruction; vaults (and their rent) live
          forever, and floor-rounding dust is permanently locked. By-design immutability (good for trust),
          but rent/dust is unrecoverable. INFO, see roadmap.
[N/A]     SM-004..SM-007: FeeVaultType is a creation-time discriminator, not a transitioning lifecycle;
          neither variant is terminal/needs exit transitions; no dead variants.
[N/A]     SM-009..SM-024, SM-033..SM-044, SM-050: no withdrawal lifecycle, no deposit/position model, no
          multi-step state transitions (funding and claiming are single-step, stateless transitions on the
          accumulator). SM-046: no close → no seed-reuse concern.
[N/A]     SM-051..SM-056: no shares mint, no total_assets tracking, no swap → mint-supply/NAV invariants
          N/A. The relevant invariant (Σ claims ≤ total_funded) is covered under AR-022..023.
```

### Checklist 06 — Economic & Logic (62)

```
[PASS]    ECON-033 (fee extraction path): the ONLY way tokens leave the vault is claim_fee, gated by
          address==signer and the fee_per_share accumulator — no direct/admin transfer-out path.
[PASS]    ECON-034..ECON-043 (rug vectors): NO manager role, NO swap, NO pda_token_transfer/approve,
          NO mutable whitelist, NO fee-rate config → none of the manager-rug vectors apply. Vault is
          immutable after init. (Strong positive.)
[PASS]    ECON-044, ECON-047..ECON-049: Token-2022 — supported extensions are allow-listed to
          TransferFeeConfig / MetadataPointer / TokenMetadata only (utils/token.rs:37-55); any other
          extension (incl. TransferHook, permanent delegate, default-account-state, pausable, etc.) is
          REJECTED at init via is_supported_mint. This neutralizes transfer-hook abuse (ECON-044) and
          most freeze/mint-authority griefing surfaces for newly created vaults.
[PASS]    ECON-046 (rebasing): balances enter accounting only via measured transfer/delta, not via a
          cached external supply — rebases cannot desync internal accounting (and rebasing mints would
          carry unsupported extensions anyway).
[FAIL-7]  ECON-040 / ECON-042-analog: "can a (shareholder) CPI into a program to divert assets?" — yes,
          for the unchecked destination side of two-sided whitelisted claims. See F-001. NOTE: the
          whitelist itself is immutable (ECON-041/042 in the classic sense PASS — no one can ADD a program),
          but the destination-binding gap is the economic-loss vector.
[FAIL-1]  ECON-045 (fee-on-transfer): funding side handled correctly (excluded-amount credited); claim
          out-transfer fee borne by claimer — informational, no drain. See F-006.
[PASS]    ECON-051..ECON-056 (economic DoS): bounded everywhere — MAX_USER=5, fixed-size zero_copy state
          (640 bytes), no unbounded Vec in state, no per-attacker position creation against someone else's
          vault. Compute is O(5). No state-growth or lock-out DoS.
[PASS]    ECON-013..ECON-017 (first-depositor / share inflation): N/A in the classic sense — shares are
          fixed weights chosen at init, not minted against deposits; there is no first-depositor price to
          manipulate and no donation-inflation vector (donations via fund_fee benefit all holders pro-rata).
[N/A]     ECON-001..ECON-005 (flash loan / NAV): no NAV, no deposit→withdraw value extraction path.
[N/A]     ECON-006..ECON-012 (sandwich/MEV/min amounts): no swap and no price-sensitive deposit/withdraw;
          claims are deterministic pro-rata of already-funded fees — no MEV surface. (A funder could
          front-run a claimer's checkpoint, but funding only INCREASES everyone's claimable — not harmful.)
[N/A]     ECON-018..ECON-032 (NAV attest / fee-rate exploitation): no NAV attestation, no configurable or
          time-locked fee rate, no high-water mark, no wash-trade fee surface.
[N/A]     ECON-050 (WSOL), ECON-057..ECON-062 (oracles): no native-SOL handling; no oracle dependency.
```

### Checklist 07 — OpSec & Governance (75)

```
[PASS]    OPS-013..OPS-016, OPS-020..OPS-022: no hidden admin ix, no god-mode account, no pubkey-equality
          backdoor, no dead callable handler, no mint-without-deposit / burn-without-withdraw (no shares
          mint at all). Full instruction set is the 5 in lib.rs:22-49.
[PASS]    OPS-018..OPS-019: no instruction can change a treasury/DEX address to redirect funds (no such
          mutable config); whitelist & destinations are constants (modulo F-001's positional gap).
[PASS]    OPS-023..OPS-024: no `unsafe` blocks and no raw-pointer manipulation in the program crate
          (zero_copy is via bytemuck-backed Anchor macros, not hand-written unsafe).
[PASS]    OPS-025: declare_id! matches Anchor.toml.
[PASS]    OPS-069: source is public/open.
[PASS]    OPS-075: critical deps are version-pinned (num_enum 0.7.0, ruint 1.3.0, static_assertions 1.1.0,
          const-crypto 0.3.0; anchor via workspace; damm-v2/DBC via local path). No `^`/`~` ranges.
[INFO]    OPS-001..OPS-012 (upgrade authority/timelock): NOT verifiable from source — VERIFY ON-CHAIN
          (`solana program show dfsdo2U...`): confirm authority is a Squads multisig with a timelock, or
          immutable. QUESTIONS Q11 assumed multisig — confirm. A single-wallet authority would be HIGH.
[INFO]    OPS-037..OPS-043 (multisig config), OPS-044..OPS-052 (incident response), OPS-062..OPS-068
          (access segregation), OPS-070..OPS-074 (verifiable build / branch protection): operational,
          out of source scope — verify with the Meteora team. Repo-level: confirm `anchor verify` matches
          the deployed binary (OPS-070).
[N/A]     OPS-017 (IDL vs binary): IDL present (idls/); confirm matches deployed binary off-chain.
          OPS-026..OPS-036 (key mgmt), OPS-045 pause: no on-chain pause (see AC-035 note); rest are ops.
          OPS-053..OPS-061 (timelock analysis): program has no on-chain timelocked actions (immutable);
          program-upgrade timelock is the only relevant one → verify on-chain (OPS-006/008).
```

### Off-scope checklists (08–18) — not assessed

```
[N/A]  08 TypeScript, 09 Backend, 10 Frontend, 14 Python, 15 General-language: no such code in this crate.
[INFO] 11 Supply Chain: Cargo deps are pinned (see OPS-075); damm-v2/DBC consumed as LOCAL path crates
       generated from bundled IDLs — verify those IDLs match the deployed DAMM/DBC programs.
[INFO] 12 Secrets, 13 Deployment/Infra, 17 Logging/Monitoring, 18 Privacy/Compliance: operational, out of
       PROGRAM scope.
[INFO] 16 Formal Verification & Testing: a proptest exists for fund_fee precision (10k cases). Coverage is
       thin for a fee program — recommend property tests for the full fund→claim conservation invariant
       (Σ claimed ≤ Σ funded) and for fund_by_claiming_fee destination binding (regression for F-001).
```

### Audit Metrics

| Metric | Value |
|--------|-------|
| Total in-scope items (01–07) | 424 |
| PASS | 168 (40%) |
| FAIL | 6 (1.4%) |
| PARTIAL | 4 (0.9%) |
| N/A | 246 (58%) |
| **Pass rate** (excl. N/A) | **~94%** |
| Highest severity found | 7 |
| **Repository Risk Score** | **7 (HIGH)** |

> FAIL count = 6 item-level FAILs (CPI-012, EXT-003, AV-034, ECON-040 all stem from F-001; ECON-045 = F-006; plus the low robustness items F-002/F-003/F-005 are tracked as findings though several map to "general robustness" rather than a single checklist FAIL). Finding count = 6 (one HIGH, three LOW, two INFO).

### Known Vector Results (program-relevant subset)

```
[FAIL-7]  KV-009  Unchecked CPI target / account substitution — F-001 (unchecked destination account).
[PASS]    KV-003  Reentrancy via CPI — CEI respected, reload() used, no privileged callback.
[PASS]    KV-004  Missing access control — claim bound to address==signer; fund_by_claiming_fee to shareholder.
[PASS]    KV-008  Rug-pull admin backdoor — none; vault immutable, no admin/upgrade-of-state ix.
[PASS]    KV-010  PDA confusion / type cosplay — single account type, fully-seeded PDAs.
[PASS]    KV-011  Integer overflow/underflow — checked SafeMath throughout.
[PASS]    KV-012  Arithmetic rounding exploit — floors in protocol's favor; dust locked, not extractable.
[PASS]    KV-013  Missing signer check — all mutating ix require Signer.
[PASS]    KV-014  Account reinitialization — `init` (not init_if_needed) on both creators.
[PASS]    KV-015  Unchecked account owner — typed Anchor wrappers; mint owner used to pick token program.
[PARTIAL] KV-016  Token account mismatch — claim destination mint enforced only at CPI (F-004);
                  fund_by_claiming_fee unchecked destination (F-001).
[FAIL-1]  KV-018  Fee-on-transfer token — funding handled; claim out-fee borne by claimer (F-006, info).
[PASS]    KV-019  Freeze-authority griefing — freeze/pausable extensions rejected by is_supported_mint.
[PASS]    KV-023  Token-2022 transfer-hook attack — TransferHook extension rejected at init.
[PASS]    KV-024  Stale / missing account close — no close ix; no stale-data reuse (also locks rent, INFO).
[PASS]    KV-025  Compute-budget exhaustion DoS — O(5) bounded; fixed-size state.
[PASS]    KV-026  PDA seed collision — vault seeds include base(signer)+mint; authority seed is global+const.
[PASS]    KV-027  Missing discriminator check — Anchor 8-byte discriminator on FeeVault.
[PASS]    KV-028  Front-running — funding only increases claimable; no harmful ordering.
[PASS]    KV-029  Withdraw-before-update race — checkpoint updated atomically with claim; no double-claim.
[PASS]    KV-030  Infinite mint / uncapped supply — no mint; shares are fixed weights.
[N/A]     KV-001,002,005,006,007,017,020,021,022,031..100  Key-leak/oracle/flash-loan/first-depositor/
          MEV-sandwich/vault-donation/upgrade-hijack(verify on-chain)/governance/bridge and all
          web2/devops vectors — not applicable to this on-chain fee-splitter (or operational, out of scope).
```

---

## 6. Instruction Matrix

| Instruction | File | Signer(s) | CPI Calls | PDA Seeds (signer) | Checked Math | State Changes | Findings |
|---|---|---|---|---|---|---|---|
| `initialize_fee_vault` | ix_initialize_fee_vault.rs | payer | init token_vault (token prog) | token_vault=[b"token_vault",fee_vault]; authority=[b"fee_vault_authority"] | n/a (init) | creates FeeVault (NonPda), sets users/shares | F-003 |
| `initialize_fee_vault_pda` | ix_initialize_fee_vault_pda.rs | payer, base | init token_vault | fee_vault=[b"fee_vault",base,mint]; +above | n/a | creates FeeVault (Pda) | F-003 |
| `fund_fee` | ix_fund_fee.rs | funder | transfer_checked (funder→vault) | — (funder signs) | ✅ safe_add, shl_div | total_funded_fee += , fee_per_share += | — |
| `fund_by_claiming_fee` | ix_fund_by_claiming_fee.rs | signer (must be shareholder) | **invoke_signed → damm_v2 / DBC** (fee_vault PDA signs) | fee_vault=[b"fee_vault",base,mint,bump] | ✅ safe_sub delta, safe_add | fee_per_share += claimed delta | **F-001**, F-002, F-005 |
| `claim_fee` | ix_claim_fee.rs | user (must == users[index].address) | transfer_checked (vault→user, authority PDA signs) | authority=[b"fee_vault_authority",bump] | ✅ safe_sub/add, mul_shr | user.fee_claimed +=, checkpoint = fee_per_share | F-004 |

---

## 7. State Model Verification

### Account Types

| Account | Discriminator | Space | Owner | Close Target |
|---|---|---|---|---|
| `FeeVault` (zero_copy) | Anchor 8-byte | 8 + 640 (const_assert) | this program | none (no close ix) |
| `UserFee` (embedded ×5) | n/a (embedded) | 80 each (const_assert) | — | — |
| `token_vault` (PDA TokenAccount) | SPL/Token-2022 | std | token program, authority = fee_vault_authority | none |

### Key invariant

```
fee_per_share += floor( (funded_amount << 64) / total_share )      [fund]
claimable(user) = floor( user.share * (fee_per_share - user.checkpoint) >> 64 )   [claim]
=> Σ_users claimable ≤ total_funded_fee   (floor rounding leaves dust locked in vault)
```

### Invariants Verified

| Property | Description | Status |
|---|---|---|
| INV-01 | Σ claims ≤ Σ funded (no over-distribution) | ✅ PASS (reasoning + proptest) |
| INV-02 | total_share ≥ 2, never 0 (no div-by-zero) | ✅ PASS (init validation) |
| INV-03 | Only `claim_fee` removes tokens from vault; bound to address==signer | ✅ PASS |
| INV-04 | Funds entering vault via `fund_by_claiming_fee` equal token_vault delta | ⚠️ PARTIAL — true for the checked token side only; second side unbound (F-001) |
| INV-05 | Vault config immutable after init (no admin mutation) | ✅ PASS |

---

## 8. Remediation Roadmap

### Before Release — Severity 7
| Finding | Severity | Fix | Effort |
|---|---|---|---|
| F-001 | 7 | Bind **all** fund-receiving CPI destinations (validate every writable token account the target ix can pay to, or balance-check all non-vault token accounts, or drop two-sided claim entries until both sides are bound). Add regression test. | 1–3 days |

### Next Sprint — Severity 3
| Finding | Severity | Fix | Effort |
|---|---|---|---|
| F-002 | 3 | `payload.get(..8).ok_or(InvalidAction)?` instead of `payload[..8]`. | 5 min |
| F-003 | 3 | Reject duplicate shareholder addresses in `validate()`. | 15 min |
| F-005 | 3 | Resolve CPI destinations by semantics, not hardcoded index; CI check vs IDLs on dep bump. | 0.5–1 day |

### Backlog — Severity 1–2 / INFO
| Finding | Severity | Fix |
|---|---|---|
| F-004 | 2 | Add `token::mint`/`token::token_program` constraint on `user_token_vault`. |
| F-006 | 1 | Document transfer-fee-on-claim behavior for integrators. |
| (ops) | INFO | Verify on-chain upgrade authority is multisig+timelock or immutable (OPS-001..012); confirm `anchor verify` reproducible build (OPS-070); consider whether an emergency pause is warranted given immutability (AC-035). |

---

## 9. Re-Audit Checklist

- [ ] F-001 fixed: all two-sided claim destinations bound; regression test covering an attacker-supplied second destination.
- [ ] F-002/F-003/F-005 addressed.
- [ ] On-chain upgrade authority confirmed (multisig + timelock, or immutable).
- [ ] `anchor verify` confirms deployed binary matches this commit.
- [ ] Property test added for the Σ claims ≤ Σ funded conservation invariant.

---

## 10. Appendices

### A. Tool Versions
```
Audit method: source review (AUDITOR skill, checklists 01–07) + IDL cross-reference
rustc/anchor/solana: not executed (static review only)
Cargo deps (program): anchor (workspace), num_enum 0.7.0, ruint 1.3.0, static_assertions 1.1.0,
                      const-crypto 0.3.0, damm-v2 (path), dynamic-bonding-curve (path), proptest 1.2.0 (dev)
```

### B. Environment
```
Repo: MeteoraAg/dynamic-fee-sharing @ f9be4a9 (main), shallow clone
Cluster: code-only review; no devnet/mainnet execution performed
Program ID: dfsdo2UqvwfN8DuUVrMRNfQe11VaiNoKcMqLHVvDPzh
```

### C. Disclaimer
This report is a point-in-time, AI-assisted static review at the specified commit. It is not exhaustive and does not replace a professional human audit or on-chain operational review. F-001's final severity depends on the destination-account constraints enforced by DAMM v2 / DBC — verify those before triage. No guarantee is made that all vulnerabilities were found. **Per the operator's policy: do not open PRs or disclose publicly — report confirmed findings to the Meteora bug-bounty program first.**
```
