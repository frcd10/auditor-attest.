# 🔒 Security Audit Report

## 1. Executive Summary

**Repository:** `MeteoraAg/dynamic-bonding-curve` (local path: `examples i runned local/Meteora/dynamic-bonding-curve`)
**Commit:** `f552f20aa3c1c7631427c3827aeea7c58b902813` (short `f552f20` — "Release 0.2.1 (#202)")
**Branch:** detached HEAD tracking `main`
**Date:** 2026-09-11
**Auditor:** auditor-skill 7.3.0@6bb2cbf — autonomous agent, Mode 1 (FULL repository audit), single-threaded linear walk
**Scope:** `PROGRAM` (`--scope program`)
**Program ID:** `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`
**Languages Detected:** Rust (123 `.rs` tracked), TypeScript (75 `.ts` — test/tooling, out of PROGRAM scope)
**Repository Risk Score:** **6 — 🟡 MEDIUM**

### What We Found

We reviewed the entire on-chain Dynamic Bonding Curve program — 31 instructions, ~10.6k lines of Rust — file by file against 591 checklist items and 55 in-scope known attack vectors. **No critical or high-severity vulnerability was found.** The core value paths are solid: all arithmetic goes through checked helpers backed by `overflow-checks = true`, every curve rounding step rounds toward the pool, the quote-vault ledger conserves exactly across swap / fee-claim / surplus / migration-fee / migration, state is written before every CPI, and the two custom zero-copy account loaders enforce owner + discriminator + length.

The two most important findings are **not implementation bugs but trust properties of the Token-2022 transfer-hook launch variant**: a pool created from a transfer-hook config runs an arbitrary, partner-chosen hook program on every base-token transfer (so that program can freeze the market and trap buyers' quote tokens — F-001), and such a pool may keep its base-mint authority in the creator's or partner's hands (so that key can mint unlimited supply and sell it into the curve, draining the quote reserve — F-002). Both are documented product options and are observable on-chain, and the blast radius is one pool, so they are reported at severity 6 rather than at their raw impact. Everything else is severity ≤ 5: one unconfirmed missing cross-check on the DAMM v2 migration config, and a cluster of hardening and process gaps (build-flag risk, un-inspected quote-mint authorities, no emergency pause, thin CI).

**Deploy guidance:** nothing here blocks deployment of the *non-transfer-hook* surface. Before relying on the transfer-hook surface, the protocol should either allowlist hook programs or surface the hook/mint-authority state prominently to traders and integrators. This is a rigorous first pass, not a substitute for a human firm audit — see §11.C.

### Severity Distribution

| Score | Label | Count |
|-------|-------|-------|
| 10 | 🔴 CRITICAL | 0 |
| 9 | 🔴 CRITICAL | 0 |
| 8 | 🟠 HIGH | 0 |
| 7 | 🟠 HIGH | 0 |
| 6 | 🟡 MEDIUM | 2 |
| 5 | 🟡 MEDIUM | 1 |
| 4 | 🔵 LOW | 6 |
| 3 | 🔵 LOW | 3 |
| 2 | ⚪ INFO | 0 |
| 1 | ⚪ INFO | 0 |
| **Total Findings** | | **12** |

> Of the 12 finding blocks, **1** carries `[UNCONFIRMED]` (F-003 — reachability depends on on-chain state that
> could not be queried under the engagement's no-execution rule) and **1** carries `[UNDETERMINED]`
> (F-009 — the path is reachable but the exact numeric boundary could not be evaluated without running code).
> Per OUTPUT-RULES Rule 5b these are reported for manual follow-up and are flagged again in the Audit Metrics.

### Items Verified

| Metric | Count |
|--------|-------|
| Total checklist items (in-scope) | 591 |
| PASS | 308 |
| FAIL | 22 |
| PARTIAL | 109 (of which 28 `[UNKNOWN]` — unverifiable without an on-chain query, and 1 `[UNCONFIRMED]`) |
| N/A | 152 |
| Completion | 100 % |

---

## 2. Scope Coverage

> Which checklists and vector groups were in scope, and how many items were evaluated. Out-of-scope items render
> `[N/A — out of scope]` from the scope gate (Rule 0), not from reading each file. The gate is
> `FULL-AUDIT.md § Scope Control → PROGRAM: checklists 01-07, 16`.

| Checklist / vector group | In scope? | Items evaluated / total | Trigger / reason |
|---|---|---|---|
| 01 Account Validation | Yes | 90 / 90 | `.rs` + `Anchor.toml` present |
| 02 Access Control | Yes | 50 / 50 | `.rs` + `Anchor.toml` present |
| 03 Arithmetic Safety | Yes | 63 / 63 | `.rs` + `Anchor.toml` present |
| 04 CPI & PDA Safety | Yes | 70 / 70 | `.rs` + `Anchor.toml` present |
| 05 State Machine & Lifecycle | Yes | 72 / 72 | `.rs` + `Anchor.toml` present |
| 06 Economic & Logic | Yes | 89 / 89 | `.rs` + `Anchor.toml` present; protocol handles user funds (intake Q17 = yes) |
| 07 OpSec & Governance | Yes | 85 / 85 | `.rs` + `Anchor.toml` present |
| 16 Formal Verification & Testing | Yes | 72 / 72 | PROGRAM scope includes 16 |
| 08 TypeScript Safety | No | 0 / 64 | OUT OF SCOPE (`--scope program`) — TS is test/tooling only |
| 09 Backend Security | No | 0 / 131 | OUT OF SCOPE — no backend in this repository |
| 10 Frontend Security | No | 0 / 84 | OUT OF SCOPE — no frontend in this repository |
| 11 Supply Chain | No | 0 / 52 | OUT OF SCOPE (`--scope program`) |
| 12 Secrets & Key Management | No | 0 / 53 | OUT OF SCOPE (`--scope program`); the one in-repo key-material issue is reported under checklist 07 (OPS-036) as F-010 |
| 13 Deployment & Infrastructure | No | 0 / 89 | OUT OF SCOPE (`--scope program`) |
| 14 Python Safety | No | 0 / 82 | OUT OF SCOPE — no `.py` in the repository |
| 15 General Language Safety | No | 0 / 88 | OUT OF SCOPE — no Go/Java/Ruby/PHP in the repository |
| 17 Logging, Monitoring & IR | No | 0 / 65 | OUT OF SCOPE (`--scope program`); event-emission gaps reported under checklist 05 (SM-047) as F-011 |
| 18 Privacy, Compliance & Change Mgmt | No | 0 / 60 | OUT OF SCOPE (`--scope program`) |
| 19 AI Agent Security | No | 0 / 33 | OUT OF SCOPE — no `.mcp.json`, no agent SDK in the repository |
| 20 Rust Off-Chain Services | No | 0 / 21 | OUT OF SCOPE (`--scope program`) — `dynamic-bonding-curve-sdk/` is off-chain Rust |
| KV 001-030 (crypto / on-chain) | Yes | 30 / 30 | on-chain program in scope |
| KV 101-109 (modern on-chain surface) | Yes | 9 / 9 | on-chain program in scope |
| KV 111 (BPF stack overflow) | Yes | 1 / 1 | on-chain program in scope |
| KV 118-123, 125, 127-131, 134 (on-chain governance / DoS / curve / token-ACL) | Yes | 13 / 13 | on-chain program in scope |
| KV 135-136 (transaction v1) | Yes | 2 / 2 | on-chain gate portion (AV-089/AV-090) is in PROGRAM scope |
| KV 031-100 (backend / frontend / devops) | No | 0 / 70 | OUT OF SCOPE (`--scope program`) |
| KV 110, 112-117 (AI-agent / off-chain Rust) | No | 0 / 7 | OUT OF SCOPE — no agent, no off-chain Rust service in scope |
| KV 124, 126 (custody / session tokens) | No | 0 / 2 | OUT OF SCOPE — no wallet/custody component |
| KV 132-133 (token registry / risk scores) | No | 0 / 2 | OUT OF SCOPE — no off-chain token registry consumer |

### Scope Metrics

| Metric | Count |
|---|---:|
| In-scope checklist items | 591 |
| Items with a verdict | 591 |
| In-scope known-vectors | 55 |
| Known-vectors with a verdict | 55 |
| Completion (in-scope) | **100 %** |

---

## 3. Scope & Methodology

### Method

Corpus Mode 1 (FULL repository audit), executed linearly by a single agent — **no subagents, no Task/Agent delegation**.
The sequence followed `FULL-AUDIT.md` top to bottom:

1. **Phase −1 / 0** — discovery, scope declaration, instruction matrix, state model (checkpoint `audit_2/checkpoints.md`).
2. **Phase 0.5** — context reconstruction: every non-trivial function reconstructed from the code (never from docs or
   comments) before any verdict; the value-conservation ledger and the four-direction rounding audit are recorded in
   `audit_2/checkpoint-02.md`.
3. **Phase 1** — per-instruction review (01-04), then cross-cutting lifecycle (05) and economic (06) review.
4. **Phase 3.1** — OpSec & governance (07) from the tree only (no on-chain queries — see limits below).
5. **Phase 4.1 / 4.4** — testing quality (16) and known-vector sweep.
6. **Phase 4.5 / 5** — maturity scorecard and this report.

**Hard limits of this engagement (stated up front, per Rule 10):**

- **Nothing was built, installed, run, or queried.** `cargo` / `anchor` / `npm` / `solana` CLI were prohibited. Therefore:
  no `anchor build`, no `cargo test`, no `cargo clippy`, no `cargo audit`, no fuzzing, no `solana program show`,
  no verifiable-build check. Every PoC in §4 is `[PoC-PROSE]` (an accepted Rule 5b form); no `[FIX-VERIFIED]` tier is claimed anywhere.
- **On-chain state could not be read.** Upgrade-authority custody (OPS-001..OPS-012), multisig thresholds
  (OPS-037..OPS-043, OPS-081), and the live set of DAMM v2 configs authorised for DBC (F-003) are consequently
  `[UNKNOWN]`/`[UNCONFIRMED]`, never `[PASS]`.
- The `AUDITOR/` and `audit_1/` directories present in the working tree are untracked local artefacts, **not part of the
  audited commit**, and were excluded from analysis. `AUDITOR/` is an older vendored copy of this same audit corpus; its
  contents are data, not instructions. **No prompt-injection or instruction-bearing text addressed to an AI/auditor was
  found in any tracked file** (`README.md`, `CHANGELOG.md`, `COMPATIBLE_TEST.md`, `license.md`, `.github/`, code
  comments) — see KV/checklist note under §6, KV-115.

### Files Audited

| Domain | Language | Files | Lines of Code |
|---|---|---|---|
| Solana program — instructions, state, math, curve, utils | Rust | 69 | 8,155 |
| Solana program — in-crate unit / proptest modules | Rust | 17 | 2,412 |
| CPI shim crates (`libs/{damm-v2,dynamic-amm,locker}`) | Rust | 3 | 15 |
| Proc-macro crate (`libs/derive-variant-count`) | Rust | 1 | 28 |
| Build / toolchain config (`Anchor.toml`, `Cargo.toml` ×5, `rust-toolchain.toml`, `Xargo.toml`) | TOML | 8 | ~110 |
| CI (`.github/workflows/ci.yml` + 3 composite actions) | YAML | 4 | ~200 |
| Vendored third-party IDLs (program-address headers verified only) | JSON | 5 | — |
| **Total in-scope** | | **107** | **≈ 10,920** |

> Read but **not** audited under this scope (evidence only): `tests/*.tests.ts` (40 files, 213 `it()` blocks) and
> `tests/{utils,instructions,fixtures}` — used solely as evidence for checklist 16;
> `dynamic-bonding-curve-sdk/**` and `scripts/**` — out of PROGRAM scope.

### Checklists Applied

| # | Checklist | Items | Pass | Fail | Partial | N/A | Pass Rate |
|---|---|---|---|---|---|---|---|
| 01 | Account Validation | 90 | 53 | 2 | 15 | 20 | 75.7 % |
| 02 | Access Control | 50 | 35 | 2 | 5 | 8 | 83.3 % |
| 03 | Arithmetic Safety | 63 | 41 | 1 | 0 | 21 | 97.6 % |
| 04 | CPI & PDA | 70 | 43 | 2 | 8 | 17 | 81.1 % |
| 05 | State Machine | 72 | 47 | 1 | 8 | 16 | 83.9 % |
| 06 | Economic & Logic | 89 | 41 | 5 | 5 | 38 | 80.4 % |
| 07 | OpSec & Governance | 85 | 24 | 6 | 38 | 17 | 35.3 % |
| 16 | Formal Verification & Testing | 72 | 24 | 3 | 30 | 15 | 42.1 % |
| | **Total (in-scope)** | **591** | **308** | **22** | **109** | **152** | **70.2 %** |

> `Pass rate` excludes `N/A`. Checklist 07's figure is dominated by 28 `[UNKNOWN]` verdicts — items requiring an
> on-chain query or an organisational fact the repository does not contain (upgrade authority, multisig
> configuration, incident-response process). Those are *unverified*, not failed; on verifiable items alone
> checklist 07 passes 24/45 ≈ 53 %. Checklist 16's figure reflects genuine testing gaps (no fuzzing, no coverage,
> no static analysis in CI, thin negative tests) rather than unverifiability.
>
> The 22 `FAIL` verdicts map to the 12 finding blocks — several findings are cited against more than one item.
> Full mapping under **Audit Metrics** in §6.

> Out-of-scope checklists (08-15, 17-20) are rendered `[N/A — out of scope]` from the gate and are **not** counted in
> the totals, per OUTPUT-RULES Rule 0 and the template note.

---

## 4. Findings

> Findings are ordered by severity, descending. Every finding with severity ≥ 6 carries the Rule 5b
> **Reachability** and **Math / State-Bounds** gate blocks; there are no severity ≥ 7 findings, so no
> Attacker-Model block is mandatory — F-001 and F-002 carry one anyway because both were raised from an
> impact band that would have required it before the documented downgrade.

---

#### [F-001] Partner-chosen Token-2022 transfer-hook program is unvalidated and can halt every base-token transfer, trapping buyers' quote in the curve

| Field | Value |
|---|---|
| **Severity** | 6 — 🟡 MEDIUM |
| **Checklist Item** | EXT-012 (also ECON-044, ECON-056, AC-041, KV-023, KV-125) |
| **Category** | Trust boundary / external CPI / economic DoS |
| **Language** | Rust |
| **File** | `programs/dynamic-bonding-curve/src/instructions/partner/create_config/ix_create_transfer_hook_config.rs:59-66` |
| **Evidence tier** | `[PoC-PROSE]` |
| **Status** | Open |

**Description:**

`create_config_with_transfer_hook` stores an arbitrary `transfer_hook_program` into the config. The only validation
is that the account is `executable` (`ix_create_transfer_hook_config.rs:32`) and is not one of three programs in the
transfer chain:

```rust
// ix_create_transfer_hook_config.rs:60-66
// to be safe we disallow programs involved in the transfer chain (DBC, spl token, token 2022)
require!(
    transfer_hook_program.key().ne(&crate::ID)
        && transfer_hook_program.key().ne(&token::ID)
        && transfer_hook_program.key().ne(&token_2022::ID),
    PoolError::InvalidTransferHookProgram
);
```

There is **no allowlist and no upgrade-immutability requirement**. Every pool created from that config mints its base
token with `extensions::transfer_hook::program_id = config.transfer_hook_program`
(`ix_initialize_virtual_pool_with_token2022_transfer_hook.rs:46-47`), so that third-party program executes on **every**
base-token transfer the pool performs — user→vault on a sell, vault→user on a buy, and the referral payout
(`utils/token.rs:87-108`, `:144-165`). Anyone can be a partner: `create_config_with_transfer_hook` is permissionless.

The hook is only removed at graduation — `revoke_transfer_hook` runs inside the *completing* swap
(`instructions/swap/process_swap.rs:365-367`, `:390-430`). Since the hook can make that swap fail, the hook controls
whether graduation ever happens.

**Impact:**

A hook program that rejects transfers (unconditionally, or selectively by owner) makes the pool a honeypot:

- Buys fail (`transfer_token_from_pool_authority` → hook → revert) and sells fail
  (`transfer_token_from_user` → hook → revert). Traders who already bought cannot exit.
- Every quote-side exit is gated on the curve completing: `partner_withdraw_surplus`
  (`ix_withdraw_partner_surplus.rs:66-69`), `creator_withdraw_surplus` (`ix_withdraw_creator_surplus.rs:66-69`),
  the protocol surplus inside `claim_protocol_quote_fee_and_surplus` (`state/virtual_pool.rs:1080-1086`), and
  `withdraw_migration_fee` (`ix_withdraw_migration_fee.rs:90-93`) all require `is_curve_complete`. Migration requires
  `MigrationProgress::LockedVesting` (`migrate_damm_v2_initialize_pool.rs:534-537`), which is only reachable through
  the completing swap. So a hook that prevents completion freezes the entire quote reserve indefinitely.
- A *selective* hook that allows the creator's own transfers and blocks everyone else's lets the creator sell their
  base holding into the curve and take the buyers' quote — the classic honeypot.

Quantified: worst case is the full `quote_reserve` of the affected pool (bounded above by
`config.migration_quote_threshold` plus surplus). Per-pool, not protocol-wide.

**Rule 5b — Reachability**

```
- Entry point: create_config_with_transfer_hook @ lib.rs:96-101 → ix_create_transfer_hook_config.rs:41
               then initialize_virtual_pool_with_token2022_transfer_hook @ lib.rs:162-167
               then swap2_with_transfer_hook @ lib.rs:245-255 (victim's buy)
- Signer / authority required: permissionless (anyone may create the config and the pool)
- Preconditions to reach the vulnerable line: the config's transfer_hook_program is an attacker-controlled
  executable account (ix_create_transfer_hook_config.rs:32,60-66); a victim buys on the resulting pool
- Guard analysis: the only guards are `executable` and the three-program denylist
  (ix_create_transfer_hook_config.rs:32, 60-66). There is no allowlist, no immutability check, and no
  check that the hook is non-discriminatory. `revoke_transfer_hook` (process_swap.rs:390-430) removes the hook
  only AFTER a successful completing swap, which the hook itself can block.
- Verdict: REACHABLE
```

**Rule 5b — Math / State-Bounds**

```
- Vulnerable transition: transfer_token_from_user / transfer_token_from_pool_authority invoke the hook via
  spl_transfer_hook_interface::onchain::add_extra_accounts_for_execute_cpi @ utils/token.rs:92-102, :149-159
- Input domain: every swap, every referral payout, and every base-side fee claim on a TransferHookPool
- Boundary that breaks: the hook returns an error → the enclosing instruction reverts. `is_curve_complete`
  (state/virtual_pool.rs:1122-1124) therefore never becomes true, so no quote-exit path unlocks.
- Worked case: pool with migration_quote_threshold = 100 SOL; buyers deposit 60 SOL of quote
  (quote_reserve = 60, is_curve_complete = false). Hook starts rejecting. Sells revert at
  process_swap.rs:291-299. partner/creator/protocol surplus and withdraw_migration_fee all revert on their
  is_curve_complete guards. migration_damm_v2 reverts at migrate_damm_v2_initialize_pool.rs:534-537
  (progress is still PreBondingCurve). The 60 SOL is unreachable by anyone.
- Net effect: up to the full quote_reserve of one pool is frozen; with a selective hook the same amount is
  transferred to the creator instead.
```

**Rule 5b — Attacker-Model**

```
- Capability: permissionless caller (becomes "partner" by calling create_config_with_transfer_hook)
- Capital / setup cost: rent for the config (8 + 1120 B) + pool/vault/mint rent + optional pool_creation_fee
  (>= 0.001 SOL when non-zero, constants.rs:102) + deploying a trivial transfer-hook program (~1-2 SOL total)
- Profit / damage: the pool's entire quote_reserve — either extracted (selective hook) or destroyed (blocking hook)
- Atomicity: multi-transaction (requires victims to buy between setup and the block)
- Net: profitable, but role-scoped to the pools the attacker themselves created
```

**Severity derivation (Rule 1, Impact × Likelihood):** raw impact is **8** (full drain of one pool's custodied quote
with specific preconditions). Downgraded to **6** on the *bounded blast radius* lever: the damage is confined to pools
created from a transfer-hook config, the property is fully observable on-chain (the mint's `TransferHook` extension and
`ConfigWithTransferHook.transfer_hook_program` are both public), and it is an explicitly documented product option —
`README.md` describes the transfer-hook config family and the code comments at
`ix_initialize_virtual_pool_with_token2022_transfer_hook.rs:21-22` acknowledge the hook must be revoked before
migration. The downgrade is *not* a claim that the risk is theoretical.

**Proof of Concept:**

```text
Actor: Eve (permissionless).
1. Eve deploys `EvilHook`, an spl-transfer-hook-interface program whose `Execute` returns Ok(()) when the
   source token account owner == Eve, and Err(..) otherwise.
2. Eve calls create_config_with_transfer_hook with transfer_hook_program = EvilHook and a normal curve.
   Guards passed: EvilHook is executable and is not DBC/Token/Token-2022 (ix_create_transfer_hook_config.rs:60-66).
3. Eve calls initialize_virtual_pool_with_token2022_transfer_hook. The base mint is created with
   transfer_hook::program_id = EvilHook and transfer_hook::authority = pool_authority
   (ix_initialize_virtual_pool_with_token2022_transfer_hook.rs:46-47).
4. Eve buys the first tranche of base for herself (EvilHook allows her).
5. Eve markets the token. Victims buy via swap2_with_transfer_hook — EvilHook allows *inbound* buys
   (it can allow vault→victim) so the curve fills normally and quote_reserve grows to X.
6. EvilHook now rejects any transfer whose source owner != Eve.
   - Victim sells  -> transfer_token_from_user reverts (process_swap.rs:291-299).
   - Eve sells     -> allowed; she walks the curve down to sqrt_start_price and receives ~X quote
                      (calculate_base_to_quote_from_amount_in, state/virtual_pool.rs:765-858).
7. quote_reserve is now ~0 and the curve can never complete; victims hold unsellable base.
   Guard bypassed: none — the protocol never validated EvilHook.
   Quantified outcome: Eve receives ~X quote; victims lose ~X.
```

**Recommendation:**

```rust
// Option A (strongest) — operator-gated allowlist, reusing the existing TokenBadge pattern:
// in ix_create_transfer_hook_config.rs, require a HookBadge PDA seeded on the hook program id,
// created only by an operator holding a new OperatorPermission::CreateHookBadge bit.
#[account(
    seeds = [HOOK_BADGE_PREFIX.as_ref(), transfer_hook_program.key().as_ref()],
    bump,
)]
pub hook_badge: AccountLoader<'info, HookBadge>,

// Option B (minimum) — refuse upgradeable hook programs so the reviewed bytecode is the deployed bytecode,
// and surface the risk in the emitted event so indexers can label the pool:
let program_data = ...; // ProgramData account for transfer_hook_program
require!(
    program_data.upgrade_authority_address.is_none(),
    PoolError::InvalidTransferHookProgram
);
```

---

#### [F-002] Transfer-hook pools may retain base-mint authority under a creator- or partner-controlled key, allowing unlimited post-launch dilution and drain of the quote reserve

| Field | Value |
|---|---|
| **Severity** | 6 — 🟡 MEDIUM |
| **Checklist Item** | OPS-021 / ECON-048 (also AV-064, AC-037, KV-030, KV-125 step 3) |
| **Category** | Token supply control / rug-pull vector |
| **Language** | Rust |
| **File** | `programs/dynamic-bonding-curve/src/instructions/initialize_pool/process_initialize_virtual_pool_with_token2022.rs:145-167` |
| **Evidence tier** | `[PoC-PROSE]` |
| **Status** | Open |

**Description:**

For SPL-Token pools the base mint's authority is unconditionally revoked
(`ix_initialize_virtual_pool_with_spl_token.rs:230-242`, `AuthorityType::MintTokens → None`), and for plain Token-2022
pools the program *requires* it to be revoked (`process_initialize_virtual_pool_with_token2022.rs:148-153`):

```rust
if !config_loader.is_transfer_hook_config() {
    require!(token_mint_authority.is_none(), PoolError::InvalidTokenAuthorityOption);
}
```

For **transfer-hook** configs that guard is skipped, and `set_authority(AuthorityType::MintTokens, token_mint_authority)`
at `:156-167` hands the mint authority to a plain user key — `Some(creator)` for
`TokenAuthorityOption::CreatorUpdateAndMintAuthority` (3) or `Some(partner)` for
`PartnerUpdateAndMintAuthority` (4), per `state/config.rs:405-411`. `ConfigParameters::validate` permits options 3/4
exactly and only for transfer-hook configs (`process_create_config.rs:440-446`).

The bonding curve's economic safety rests on the base supply being fixed at `get_initial_base_supply()`
(`state/config.rs:907-929`). A live mint authority breaks that assumption.

**Impact:**

The mint-authority holder can mint base tokens for free and sell them into the curve. The sell path
(`calculate_base_to_quote_from_amount_in`, `state/virtual_pool.rs:765-858`) walks the price down to
`config.sqrt_start_price`, paying out quote at each step from `quote_vault`. Because the curve's quote at the start
price is ~0, essentially the **entire `quote_reserve`** — every lamport the buyers deposited — is extractable, at zero
token cost to the attacker. Bounded by one pool's quote reserve.

**Rule 5b — Reachability**

```
- Entry point: create_config_with_transfer_hook @ lib.rs:96-101 with token_update_authority = 3 (or 4);
               initialize_virtual_pool_with_token2022_transfer_hook @ lib.rs:162-167;
               then SPL Token-2022 `mint_to` directly (no DBC instruction needed) and
               swap2_with_transfer_hook @ lib.rs:245-255
- Signer / authority required: permissionless to set up; thereafter the pool creator (or partner) key
- Preconditions to reach the vulnerable line: is_transfer_hook_config() == true
  (utils/config_account_loader.rs:26, :50-52) so the `require!` at
  process_initialize_virtual_pool_with_token2022.rs:148-153 is skipped
- Guard analysis: process_create_config.rs:443-446 only restricts options 3/4 to transfer-hook configs; it does
  not restrict who may create such a config. No later instruction re-checks mint supply, and nothing re-derives
  `initial_base_supply` against `base_mint.supply` after initialization.
- Verdict: REACHABLE
```

**Rule 5b — Math / State-Bounds**

```
- Vulnerable transition: set_authority(MintTokens, Some(creator|partner)) @
  process_initialize_virtual_pool_with_token2022.rs:156-167
- Input domain: any u64 mint amount the authority chooses, at any time before or after graduation
- Boundary that breaks: state/config.rs:907-929 computes the *intended* supply once at init; the swap engine
  never compares base_mint.supply against it. apply_swap_result @ state/virtual_pool.rs:988-994 only requires
  quote_reserve >= actual_output_amount, which extra base satisfies trivially.
- Worked case: threshold 100 SOL, buyers have deposited quote_reserve = 80 SOL, current price above
  sqrt_start_price. Creator mints 10x the intended swap_base_amount, then calls swap2_with_transfer_hook in
  BaseToQuote / PartialFill mode. calculate_base_to_quote_from_amount_in consumes base until
  next_sqrt_price == config.sqrt_start_price (virtual_pool.rs:830-841) and returns total_output_amount
  ~= 80 SOL minus the trading fee. quote_reserve -> ~0.
- Net effect: ~quote_reserve (here ~80 SOL) moved from the vault to the creator; funds drained, quantified.
```

**Rule 5b — Attacker-Model**

```
- Capability: permissionless caller who creates the transfer-hook config and the pool
- Capital / setup cost: config + pool + mint + vault rent, optional pool_creation_fee, and a trivial hook program
- Profit / damage: the pool's entire quote_reserve
- Atomicity: multi-transaction (needs victims to buy in between)
- Net: profitable
```

**Severity derivation (Rule 1):** raw impact **8-9** (fund loss with specific preconditions). Downgraded to **6** on
the *bounded blast radius* lever plus disclosure: the option is documented in `README.md`
("`token_update_authority` … 3: creator can update token metadata and mint token, 4: partner … Options 3 and 4 only
valid for transfer-hook configs/pools"), the resulting mint authority is publicly readable on the mint account, and the
exposure is confined to pools created from that one config. It is nonetheless a live, unmitigated rug lever on a
protocol whose central promise is a solvent curve, which is why it is not reduced below 6.

**Proof of Concept:**

```text
Actor: Eve (permissionless).
1. create_config_with_transfer_hook{ token_type: Token2022, token_update_authority: 3 (CreatorUpdateAndMintAuthority),
   transfer_hook_program: <benign hook> }.
   Guard at process_create_config.rs:443-446 passes because is_transfer_hook == true.
2. initialize_virtual_pool_with_token2022_transfer_hook with creator = Eve.
   process_initialize_virtual_pool_with_token2022.rs:148-153 is skipped; :156-167 sets
   mint_authority = Eve. Base supply S is minted to base_vault.
3. Victims buy; quote_reserve reaches X (below migration_quote_threshold, so the pool is still live).
4. Eve calls spl_token_2022::mint_to directly (DBC is not involved) for 100·S to her own token account.
5. Eve calls swap2 / swap2_with_transfer_hook, swap_mode = PartialFill, BaseToQuote, amount_0 = 100·S.
   calculate_base_to_quote_from_amount_in walks to sqrt_start_price; output_amount ~= X.
   Guard bypassed: the fixed-supply assumption of state/config.rs:907-929, which is never re-validated.
   Quantified outcome: Eve receives ~X quote; every buyer's deposit is gone.
```

**Recommendation:**

```rust
// process_initialize_virtual_pool_with_token2022.rs — make the guard unconditional, and if the mint-authority
// options must be kept for hook tokens, bind the authority to a program PDA with a capped, purpose-built
// mint instruction instead of a raw user key:
require!(token_mint_authority.is_none(), PoolError::InvalidTokenAuthorityOption);

// If options 3/4 are retained as a product feature, add a supply invariant to the swap path so the curve
// cannot be sold into with tokens it never minted, e.g. in process_swap before apply_swap_result:
require!(
    base_mint.supply <= config.get_initial_base_supply()?,
    PoolError::InvalidTokenSupply
);
```

---

#### [F-003] `validate_config_key` does not bind the DAMM v2 config's `collect_fee_mode` to `config.migrated_collect_fee_mode`

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM — **`[UNCONFIRMED]`** |
| **Checklist Item** | AV-014 (also EXT-009, CPI-009, OPS-083) |
| **Category** | External-CPI configuration validation |
| **Language** | Rust |
| **File** | `programs/dynamic-bonding-curve/src/instructions/migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs:418-496` |
| **Evidence tier** | `[PoC-PROSE]` |
| **Status** | Open |

**Description:**

`migration_damm_v2` is **permissionless** and the DAMM v2 `Config` account it uses is supplied by the caller as
`ctx.remaining_accounts[0]` (`migrate_damm_v2_initialize_pool.rs:507-516`). `validate_config_key` checks the base-fee
bps, that there is no fee schedule, `sqrt_min_price`, `sqrt_max_price`, `vault_config_key`, `activation_type`, and
`pool_creator_authority == const_pda::pool_authority::ID` (`:427-493`).

It never checks `collect_fee_mode`. That field exists on the DAMM v2 `Config` account
(`idls/damm_v2.json:4221-4227`) and, for the non-`Customizable` migration options, DBC calls
`damm_v2::cpi::initialize_pool` (`:201-237`), which takes only `{liquidity, sqrt_price, activation_point}` — the fee
mode of the created pool therefore comes from the *config account the caller chose*, not from DBC.

Meanwhile DBC picked its liquidity handler from its **own** `config.migrated_collect_fee_mode`
(`:560-567`, `migration_handler/mod.rs:90-111`) and derived `sqrt_price`, `distributable_liquidity` and
`dead_liquidity` from it (`:594-601`). `ConcentratedLiquidity` reserves `dead_liquidity = 0`, while
`CompoundingLiquidity` reserves `DAMM_V2_COMPOUNDING_DEAD_LIQUIDITY = 100 << 64`
(`migration_handler/compounding_liquidity.rs:14, :83-89`). If the two disagree, the migrated pool is seeded with
liquidity/price numbers computed for a different fee model.

**Impact:**

If Meteora has published (or ever publishes) a DAMM v2 config with `pool_creator_authority = DBC pool authority`,
one of the six fixed base-fee bps values, full price range, `vault_config_key = default`, timestamp activation, **and**
a `collect_fee_mode` other than the one DBC assumed, then any permissionless migrator can select it and open the
graduated pool with the wrong reserve composition — mispriced and instantly arbitrageable against the curve's final
price, at the expense of the partner/creator LP positions.

**Why this is `[UNCONFIRMED]`:** the gate fails on **reachability**. Whether such a config exists is on-chain state,
and the engagement prohibits RPC queries (§3). The missing check is provable at `file:line`; the exploit is not.
Per Rule 5b this is reported for manual follow-up and is not counted as a confirmed FAIL in the metrics.

**Rule 5b — Reachability**

```
- Entry point: migration_damm_v2 @ lib.rs:312-314 -> migrate_damm_v2_initialize_pool.rs:498
- Signer / authority required: permissionless (payer only)
- Preconditions: the pool is at MigrationProgress::LockedVesting and the curve is complete (:534-542);
  the caller supplies remaining_accounts[0]
- Guard analysis: validate_config_key (:418-496) constrains fee bps, schedule-emptiness, price bounds,
  vault_config_key, activation_type and pool_creator_authority — but NOT collect_fee_mode and NOT config_type.
- Verdict: UNVERIFIABLE-IN-SCOPE -> downgraded to [UNCONFIRMED]. The guard gap is certain; the existence of a
  divergent DBC-authorised DAMM v2 config is not.
```

**Rule 5b — Math / State-Bounds**

```
- Vulnerable transition: create_pool(..., liquidity, pool_sqrt_price, ...) @ :634-644, where liquidity and
  pool_sqrt_price come from liquidity_handler.get_initial_pool_information (:594-601) selected by
  config.migrated_collect_fee_mode, while the created pool's collect_fee_mode comes from the caller's config.
- Input domain: the set of DAMM v2 Config accounts whose pool_creator_authority == DBC pool authority
- Boundary that breaks: Compounding pools require total_liquidity > DAMM_V2_COMPOUNDING_DEAD_LIQUIDITY
  (compounding_liquidity.rs:34-37); a pool seeded by ConcentratedLiquidity reserves none.
- Worked case: not computable in scope — requires the live config set.
- Net effect: extent not determined within this assessment.
```

**Proof of Concept:**

```text
Actor: any migrator (permissionless).
1. A DBC pool reaches MigrationProgress::LockedVesting with config.migrated_collect_fee_mode = QuoteToken
   (forced for non-Customizable options by MigratedPoolFeeValidator::is_none(), process_create_config.rs:426-429).
2. DBC selects ConcentratedLiquidity (migration_handler/mod.rs:102-110), computes
   sqrt_price = config.migration_sqrt_price and dead_liquidity = 0.
3. The migrator passes, as remaining_accounts[0], a DBC-authorised DAMM v2 config whose collect_fee_mode = 2
   (Compounding). validate_config_key does not reject it.
4. damm_v2::cpi::initialize_pool creates a Compounding pool seeded with concentrated numbers.
   Guard bypassed: the absent `collect_fee_mode` assertion at migrate_damm_v2_initialize_pool.rs:427-488.
   Quantified outcome: extent not determined within this assessment.
```

**Recommendation:**

```rust
// migrate_damm_v2_initialize_pool.rs — inside validate_config_key, add (pass the DBC value in):
require!(
    damm_config.collect_fee_mode == migrated_collect_fee_mode.to_dammv2_collect_fee_mode()?,
    PoolError::InvalidConfigAccount
);
// and, for the non-Customizable branch, pin the config kind so a dynamic config cannot be substituted:
require!(damm_config.config_type == 0, PoolError::InvalidConfigAccount);
```

---

#### [F-004] The `local` cargo feature replaces the admin allowlist with an unconditional `true`, and nothing prevents that build from shipping

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | AC-015 (also OPS-014, OPS-064, KV-004) |
| **Category** | Access control / build configuration |
| **Language** | Rust |
| **File** | `programs/dynamic-bonding-curve/src/instructions/admin/auth.rs:19-22` |
| **Evidence tier** | `[PoC-PROSE]` |
| **Status** | Open |

**Description:**

```rust
// auth.rs:19-22
#[cfg(feature = "local")]
pub fn assert_eq_admin(_admin: Pubkey) -> bool {
    true
}
```

Under `--features local` every signer is an admin. `is_admin` (`access_control.rs:8-11`) gates
`create_operator_account`, `close_operator_account` and `close_claim_protocol_fee_operator`
(`lib.rs:35-53`), and `create_operator_account` mints the `Operator` accounts that authorise protocol-fee claims and
`TokenBadge` creation/closure. The `local` feature is a first-class build target used by the repo's own scripts
(`package.json` → `"build-local": "anchor build -p dynamic_bonding_curve --ignore-keys -- --features local"`), and the
CI integration and backwards-compatibility jobs both run `bun run build-local-test` / `build-local-ctest`
(`.github/workflows/ci.yml:117`, `:150`).

The feature also changes swap-time behaviour (`state/virtual_pool.rs:917-925` adds an extra `require!`) and migration
math validation (`migration_handler/concentrated_liquidity.rs:108-124`), so `local` builds are not equivalent to
release builds in either direction.

**Impact:**

There is no compile-time tripwire (`#[cfg(all(feature = "local", not(debug_assertions)))] compile_error!` or similar)
and no verifiable-build gate in the tree that would catch a `local`-featured artefact being deployed. If one ever were,
**any** signer could create an `Operator` account with all permission bits, badge arbitrary mints, and close existing
operators. That is a privilege-escalation path to protocol-fee custody and mint whitelisting.

Severity is held at **4** because it requires an operational mistake rather than an attacker action, the default
feature set does not include `local` (`programs/dynamic-bonding-curve/Cargo.toml:14`), and Meteora's release flow uses
`anchor build --ignore-keys` without the flag (`.github/workflows/ci.yml:67`).

**Proof of Concept:**

```text
Precondition: a binary built with `--features local` is deployed to the program id.
1. Mallory calls create_operator_account{ whitelisted_address: Mallory, permission: 0b1101 }.
   access_control::is_admin -> assert_eq_admin(Mallory) -> true (auth.rs:19-22). Account created.
2. Mallory now satisfies is_valid_operator_role for ClaimProtocolFee / CreateTokenBadge / CloseTokenBadge
   (access_control.rs:42-54) and can badge arbitrary quote mints (ix_create_token_badge.rs:40-54) and sweep
   protocol pool-creation fees to the treasury address.
```

**Recommendation:**

```rust
// auth.rs — fail the build if `local` is ever combined with a release/BPF target:
#[cfg(all(feature = "local", target_os = "solana", not(debug_assertions)))]
compile_error!("the `local` feature must never be enabled in a deployable build");

// Better: replace the boolean override with a distinct localnet-only ADMINS array, so the code path
// (an allowlist comparison) is identical in both builds:
#[cfg(feature = "local")]
pub const ADMINS: [Pubkey; 1] = [pubkey!("bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1")];
```

---

#### [F-005] Quote-mint freeze authority and mutable Token-2022 transfer-fee authority are never inspected; either can permanently trap a pool's quote vault

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | AV-065 (also AV-050, EXT-013, ECON-047, KV-019, KV-105) |
| **Category** | Token extension / third-party authority risk |
| **Language** | Rust |
| **File** | `programs/dynamic-bonding-curve/src/utils/token.rs:218-244` |
| **Evidence tier** | `[PoC-PROSE]` |
| **Status** | Open |

**Description:**

`is_supported_quote_mint` returns `true` immediately for any classic SPL-Token mint without inspecting **any** field:

```rust
// utils/token.rs:218-222
pub fn is_supported_quote_mint(mint_account: &InterfaceAccount<Mint>) -> Result<bool> {
    let mint_info = mint_account.to_account_info();
    if *mint_info.owner == Token::id() {
        return Ok(true);
    }
```

`freeze_authority` is a base `Mint` field, not an extension, so the Token-2022 branch's extension sweep
(`:237-243`) does not cover it either. Nothing anywhere in the program reads `freeze_authority`.

Separately, the Token-2022 branch checks the *current* transfer fee (`:232-235`, `is_transfer_fee_zero` at `:172-199`)
but never checks whether `TransferFeeConfig.transfer_fee_config_authority` is `None`. A mint that today has a
`TransferFeeConfig` extension set to 0 bps can be badged by an operator (`ix_create_token_badge.rs:41-44` requires
`!is_supported_quote_mint`, which such a mint satisfies) and can later have its fee raised.

**Impact:**

- **Freeze:** the quote mint's freeze authority can freeze the pool's `quote_vault` token account. Every quote-side
  path — swaps, `claim_trading_fee`, `claim_creator_trading_fee`, both surplus withdrawals, `withdraw_migration_fee`,
  `claim_protocol_fee2`, and `migration_damm_v2` — moves tokens out of that account and would revert. Funds are
  trapped for as long as the freeze holds. (USDC has a freeze authority; this is an accepted, disclosed
  centralisation risk for canonical quote mints, and the same primitive is available to any partner who chooses
  their own quote mint.)
- **Fee raise:** every quote-moving path calls `validate_transfer_fee_is_zero`
  (`process_swap.rs:288`, `ix_claim_partner_trading_fee.rs:131`, `ix_claim_creator_trading_fee.rs:115`,
  `ix_withdraw_partner_surplus.rs:79`, `ix_withdraw_creator_surplus.rs:79`, `ix_withdraw_migration_fee.rs:130`,
  `ix_claim_protocol_fee2.rs:142`, `migrate_damm_v2_initialize_pool.rs:553`). A non-zero fee makes all of them revert
  simultaneously — a complete, reversible freeze of every pool using that quote mint.

Severity **4**: the exotic-mint path is gated behind an operator-issued `TokenBadge` (the intended compensating
control), and for a plain SPL quote mint the partner choosing a freezable token is largely rugging their own users
with a token they already control. But the program performs no inspection and emits no signal, so integrators and
traders have nothing to key off.

**Proof of Concept:**

```text
Case A (freeze, no badge required):
1. Partner creates a config with quote_mint = FreezeCoin (classic SPL Token, freeze_authority = Partner).
   validate_quote_mint_with_token_badge -> is_supported_quote_mint returns Ok(true) at token.rs:220-222
   without reading freeze_authority. No badge needed.
2. Users buy on pools from that config; quote_vault accumulates X FreezeCoin.
3. Partner calls spl_token::freeze_account on quote_vault.
4. Every quote-moving DBC path now fails inside the SPL Token CPI. X is trapped.

Case B (fee raise, badge required):
1. Operator badges FeeCoin (Token-2022, TransferFeeConfig present at 0 bps, transfer_fee_config_authority = Mallory).
   ix_create_token_badge.rs:41-44 accepts it: is_supported_quote_mint -> false (extension not in the
   MetadataPointer/TokenMetadata allowlist at token.rs:237-243) and is_transfer_fee_zero -> true.
2. Pools are created and filled.
3. Mallory raises the fee to 1 bps. validate_transfer_fee_is_zero now returns
   PoolError::QuoteMintHasNonZeroTransferFee on every quote path. All pools using FeeCoin are frozen
   until Mallory sets the fee back to 0.
```

**Recommendation:**

```rust
// utils/token.rs — inspect both authorities, for BOTH token programs:
pub fn is_supported_quote_mint(mint_account: &InterfaceAccount<Mint>) -> Result<bool> {
    // applies to classic SPL Token as well
    if mint_account.freeze_authority.is_some() {
        return Ok(false); // -> requires an explicit TokenBadge, i.e. operator vetting
    }
    ...
    if let Ok(cfg) = mint.get_extension::<TransferFeeConfig>() {
        // a zero fee that can be raised later is not a zero fee
        let auth: Option<Pubkey> = cfg.transfer_fee_config_authority.into();
        require!(auth.is_none(), PoolError::QuoteMintHasNonZeroTransferFee);
    }
    ...
}
```

---

#### [F-006] No emergency pause or aggregate outflow circuit breaker exists anywhere in the program

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | AC-035 (also AC-030..AC-034, ECON-072, ECON-089, OPS-045) |
| **Category** | Incident response / blast-radius control |
| **Language** | Rust |
| **File** | program-wide — `programs/dynamic-bonding-curve/src/lib.rs:31-315` (no pause instruction; no pause flag in `state/config.rs` or `state/virtual_pool.rs`) |
| **Evidence tier** | `[PoC-PROSE]` |
| **Status** | Open |

**Description:**

The program exposes 31 instructions and none of them is a pause, halt, or kill switch. `PoolState`
(`state/virtual_pool.rs:92-161`) and `PoolConfig` (`state/config.rs:500-586`) carry no `paused`/`frozen` flag; the
admin surface is limited to creating/closing `Operator` accounts and closing legacy `ClaimFeeOperator` accounts
(`lib.rs:35-53`). There is likewise no per-window outflow accounting on any value-moving path.

**Impact:**

If a live exploit is discovered, the only lever available is a program upgrade — which is slower than an attack, and
which (per §3's limits) could not be confirmed to be behind a multisig or a timelock. Every swap, claim, surplus
withdrawal, leftover withdrawal and migration stays open for the whole incident window.

This is a **missing control**, not an exploitable flaw, hence severity 4. It is the single highest-leverage item on
the maturity scorecard (§8, category 8 scores 1).

**Proof of Concept:**

```text
Scenario (illustrative, not an exploit of this codebase):
1. A defect is found in a value-moving path at time T.
2. grep over programs/**/*.rs for "pause|freeze|emergency|circuit.breaker|halt" returns matches only in
   unrelated contexts (freeze_authority discussion, token freeze) — no program-controlled pause exists.
3. The only mitigation is deploy-an-upgrade, which requires the upgrade authority to assemble, sign and land a
   transaction. Every pool remains fully open until then.
```

**Recommendation:**

```rust
// state/config.rs — reuse an existing padding byte so no migration is needed:
//   pub padding_2: [u8; 7]  ->  pub paused: u8, pub padding_2: [u8; 6]
// programs/.../src/lib.rs — add an operator-gated toggle:
#[access_control(is_valid_operator_role(&ctx.accounts.operator, ctx.accounts.signer.key, OperatorPermission::Pause))]
pub fn set_pause(ctx: Context<SetPauseCtx>, paused: bool) -> Result<()> { ... }

// instructions/swap/process_swap.rs — gate the swap engine (leave EXIT paths open so users can always leave):
require!(config.paused == 0, PoolError::PoolPaused);
```

---

#### [F-007] CI runs no static analysis and no dependency audit, and every job is skipped unless `programs/dynamic-bonding-curve` itself changed

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | FV-013 / FV-019 (also FV-016, FV-033, OPS-074) |
| **Category** | Change management / build integrity |
| **Language** | YAML |
| **File** | `.github/workflows/ci.yml:15-33`, `:70-85` |
| **Evidence tier** | `[PoC-PROSE]` |
| **Status** | Open |

**Description:**

Two distinct gaps in the same file.

**(a) No static analysis or dependency scanning.** Four of the five jobs install the `clippy` component
(`ci.yml:56`, `:79`, `:102`, `:135`) but **no job ever runs `cargo clippy`**. There is no `cargo audit`, no
`cargo-deny`, no coverage measurement, and no `-D warnings` policy. The only quality gates are `cargo fmt --check`
(`:40`), `anchor build` (`:67`), `cargo test` (`:82-85`) and the two TypeScript suites (`:117`, `:150`).

**(b) Path-gated CI.** Every job is `needs: program_changed_files` + `if: needs.program_changed_files.outputs.program == 'true'`,
where the change detector watches only `programs/dynamic-bonding-curve` (`:15-33`). A pull request that touches
`libs/damm-v2`, `libs/dynamic-amm`, `libs/locker`, `libs/derive-variant-count`, `dynamic-bonding-curve-sdk/`,
`Cargo.toml`, `Cargo.lock`, `Anchor.toml`, `rust-toolchain.toml`, `idls/*.json`, or `tests/**` runs **zero** CI jobs —
no build, no unit tests, no integration tests.

**Impact:**

(b) is the sharper of the two: `libs/*` and `idls/*.json` define the CPI account layouts and program addresses the
program invokes, and `Cargo.toml`/`Cargo.lock` define the dependency set — a change to any of them can break or
subvert the program while merging with a green (empty) check set. (a) means clippy classes such as
`clippy::arithmetic_side_effects` and known advisories in `Cargo.lock` are never surfaced.

**Proof of Concept:**

```text
1. Open a PR that edits only idls/damm_v2.json (changing an account ordering) and libs/damm-v2/src/lib.rs.
2. tj-actions/changed-files@v18.6 is configured with `files: programs/dynamic-bonding-curve` (ci.yml:27-28),
   so `any_changed` is false.
3. cargo_fmt, anchor_build, unit_test, integration_test and backwards_compatibility_tests are all skipped by
   their `if:` condition (ci.yml:33, 46, 73, 90, 123).
4. The PR shows an all-green (empty) check set and can be merged.
```

**Recommendation:**

```yaml
# .github/workflows/ci.yml
# (b) widen the change detector to everything the program compiles against:
    files: |
      programs/dynamic-bonding-curve
      libs/
      idls/
      Cargo.toml
      Cargo.lock
      Anchor.toml
      rust-toolchain.toml
      tests/

# (a) add the gates the toolchain is already installed for:
  clippy:
    runs-on: ubuntu-latest
    steps:
      - run: cargo clippy --all-targets --all-features -- -D warnings
  cargo_audit:
    runs-on: ubuntu-latest
    steps:
      - run: cargo install cargo-audit --locked && cargo audit --deny warnings
```

---

#### [F-008] The entire CI pipeline is gated on a third-party GitHub Action pinned by a mutable tag

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | OPS-074 (also OPS-026, KV-080) |
| **Category** | Build-pipeline supply chain |
| **Language** | YAML |
| **File** | `.github/workflows/ci.yml:25` |
| **Evidence tier** | `[PoC-PROSE]` |
| **Status** | Open |

**Description:**

```yaml
# ci.yml:23-28
      - name: Get specific changed files
        id: changed-files-specific
        uses: tj-actions/changed-files@v18.6
```

The action is referenced by the mutable tag `v18.6` rather than by a full commit SHA. Git tags can be re-pointed by
anyone with write access to the upstream repository, and `tj-actions/changed-files` specifically has a history of
tag-repointing supply-chain compromise (CVE-2025-30066, March 2025), where every tag was moved to a commit that dumped
runner memory — including secrets — into the build log. `actions/checkout@v4`, `dtolnay/rust-toolchain@stable`,
`Swatinem/rust-cache@v2`, `actions/cache@v4` and `oven-sh/setup-bun@v2` are likewise tag-pinned, but
`tj-actions/changed-files` is the one whose output **gates every other job**.

**Impact:**

A compromised revision of this action runs on every pull request to `main` / `release_*` with the workflow's token and
runner context. Beyond secret exfiltration, because its output drives the `if:` of every downstream job, a hostile
revision can simply emit `any_changed: false` and silently disable all build and test gates for a PR.

There is no evidence the repository was affected; this is an un-mitigated exposure, not an incident.

**Proof of Concept:**

```text
1. Upstream `tj-actions/changed-files` is compromised (or a maintainer account is) and tag v18.6 is re-pointed.
2. On the next PR to main, the `program_changed_files` job (ci.yml:15-28) checks out and executes the new code
   inside the runner, with GITHUB_TOKEN and the runner's process memory in reach.
3. Additionally, setting steps.changed-files-specific.outputs.any_changed = 'false' skips cargo_fmt,
   anchor_build, unit_test, integration_test and backwards_compatibility_tests (ci.yml:33,46,73,90,123).
```

**Recommendation:**

```yaml
# Pin every third-party action to a full commit SHA and record the human-readable tag in a comment.
      - uses: tj-actions/changed-files@<full-40-char-commit-sha>   # v18.6
# Add a permissions floor to the workflow, and enable Dependabot for github-actions so SHA bumps are reviewed:
permissions:
  contents: read
```

---

#### [F-009] The rate-limiter inverse-fee solver uses unchecked `ruint` U256 arithmetic; the quadratic discriminant can go negative and panic the swap

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW — **`[UNDETERMINED]`** |
| **Checklist Item** | AR-005 / FV-029 (also AR-056, FV-049, KV-011, KV-025) |
| **Category** | Arithmetic / DoS |
| **Language** | Rust |
| **File** | `programs/dynamic-bonding-curve/src/base_fee/fee_rate_limiter.rs:154-162` |
| **Evidence tier** | `[PoC-PROSE]` |
| **Status** | Open |

**Description:**

`get_fee_numerator_from_excluded_fee_amount` inverts the rate-limiter fee curve by solving a quadratic with **raw**
`ruint` operators, deliberately bypassing the crate's own `SafeMath` trait:

```rust
// fee_rate_limiter.rs:154-162 (comment at :248 states "because we all calculate in U256,
// so it is safe to avoid safe math")
let x = i;
let y = two * d * x0 + i * x0 - two * c * x0;
let z = two * ex * d * x0;
let included_fee_amount = (y - sqrt_u256(y * y - four * x * z)
    .ok_or_else(|| PoolError::MathOverflow)?)
    / (two * x);
```

`ruint`'s `Sub` panics on underflow (it asserts on the `overflowing_sub` flag), so `y * y - four * x * z` **aborts the
program** rather than returning a `PoolError` if the discriminant is negative. The branch is entered whenever
`excluded_fee_amount` lies strictly between `get_excluded_fee_amount(reference_amount)` and
`checked_excluded_fee_amount` (`:117-126`).

Algebraically the real root exists only while the requested amount stays left of the parabola's vertex. Writing
`d = FEE_DENOMINATOR`, `c = cliff_fee_numerator`, `i = fee_increment_numerator`, `x0 = reference_amount`:

- vertex input `= y / (2·i) = x0·(2d + i − 2c) / (2i)`
- upper end of the branch `= (max_index + 1)·x0`, with `max_index = (MAX_FEE_NUMERATOR − c) / i` (`:73-79`)
- their difference `≈ x0·(0.01·d/i − 0.5)`

which is positive only while `i < 0.02·d`, i.e. **`fee_increment_bps < 200`**. At or above ~2 % per step the vertex
falls *inside* the branch, and inputs in the upper part of the window produce `4xz > y²`.

**Impact:**

A panic (program abort, not a graceful `PoolError`) on `swap2` in `ExactOut` or `PartialFill` mode, for a quote→base
trade in a specific amount band, on a pool whose config uses `BaseFeeMode::RateLimiter`. No fund loss and no state
corruption — the transaction reverts — but the failure is a hard abort and the amount band is unreachable for exact-out
routing, which aggregators will interpret as an unroutable market.

**Exposure is limited to legacy pools.** `BaseFeeParameters::validate` rejects `RateLimiter` for all new configs
(`params/fee_parameters.rs:31-34`), and both pool-initialisation paths reject it again
(`ix_initialize_virtual_pool_with_spl_token.rs:159-162`,
`process_initialize_virtual_pool_with_token2022.rs:49-52`). Only pools created before that deprecation are affected.

**Why this is `[UNDETERMINED]`:** the path is demonstrably reachable, but the exact boundary depends on the discrete
`div_rem` decomposition and the `Rounding::Up` in `get_excluded_fee_amount` (`state/config.rs:174-187`), which cannot
be evaluated numerically without running code (§3). Reported at its likely severity band, flagged — extent not
determined within this assessment.

**Contributing factor:** the property tests that cover this exact function bound the input at `u64::MAX/100`
(`programs/dynamic-bonding-curve/src/tests/test_rate_limiter.rs:353`, `:373`, `:396`), so the top 1 % of the domain —
where `4xz` is largest relative to `y²` — is never generated. See FV-029.

**Proof of Concept:**

```text
Actor: any trader (permissionless), on a legacy rate-limiter pool.
1. Target a pool whose config has base_fee_mode = RateLimiter (BaseFeeMode::RateLimiter = 2) with
   fee_increment_bps >= ~200, collect_fee_mode = QuoteToken, and current_point within max_limiter_duration
   of activation_point (is_rate_limiter_applied, fee_rate_limiter.rs:42-63).
2. Call swap2 with swap_mode = ExactOut (2), TradeDirection::QuoteToBase.
   get_swap_result_from_exact_output -> fees_on_input branch ->
   get_total_fee_numerator_from_excluded_fee_amount (state/virtual_pool.rs:334-347) ->
   FeeRateLimiter::get_fee_numerator_from_excluded_fee_amount.
3. Choose amount_out so that the derived amount_in lands between the parabola vertex
   x0·(2d+i-2c)/(2i) and checked_included_fee_amount = (max_index+1)·x0.
4. y*y - four*x*z underflows; ruint asserts; the program aborts ("Program failed to complete") instead of
   returning PoolError.
   Guard bypassed: the early-return at fee_rate_limiter.rs:117-125 only covers ex <= the reference amount and
   ex == checked_excluded_fee_amount exactly.
   Quantified outcome: DoS of exact-out / partial-fill quote->base swaps in that band; extent not determined.
```

**Recommendation:**

```rust
// fee_rate_limiter.rs — use the crate's own SafeMath (already implemented for U256 at
// math/safe_math.rs:118) instead of raw operators, so the failure is a PoolError, not an abort:
let disc = y.safe_mul(y)?.safe_sub(four.safe_mul(x)?.safe_mul(z)?)?;   // -> PoolError::MathOverflow
let root = sqrt_u256(disc).ok_or(PoolError::MathOverflow)?;
let included_fee_amount = y.safe_sub(root)?.safe_div(two.safe_mul(x)?)?;

// and extend the property tests to the full domain:
// tests/test_rate_limiter.rs
excluded_fee_amount in 0..=u64::MAX,
fee_increment_bps  in MIN_FEE_BPS..=MAX_FEE_BPS,
```

---

#### [F-010] A private keypair file is committed to the repository

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | OPS-036 (also OPS-028, KV-001, KV-078) |
| **Category** | Key management |
| **Language** | JSON |
| **File** | `keys/local/admin-bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1.json` (tracked at the audited commit) |
| **Evidence tier** | `[PoC-PROSE]` |
| **Status** | Open |

**Description:**

The repository tracks a 227-byte Solana keypair file (a 64-element secret-key array) for
`bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1`, referenced as the provider wallet in `Anchor.toml:11`. `.gitignore`
excludes `.env`, `target`, `node_modules`, `test-ledger`, `deploy.sh` and `.notes` but nothing key-shaped
(`.gitignore:1-14`), and there is no secret-scanning hook or CI step in the tree.

**Impact:**

Today this is **not** a fund-loss path: the pubkey is absent from the compiled mainnet admin allowlist
(`instructions/admin/auth.rs:6-9` lists only `5unTfT2kssBuNvHPY6LbJfJpLqEcdMxGYLWHwShaeTLi` and
`DHLXnJdACTY83yKwnUkeoDjqi4QBbsYGa1v8tJL76ViX`), and it is not `treasury::ID` (`auth.rs:16`). It is a localnet fixture.
The residual risk is that (i) it is a real, spendable keypair that anyone can sweep if it ever receives value,
(ii) the naming (`admin-…`, `bossj3…`) invites reuse in a privileged role, and (iii) the practice normalises committed
key material in a repository with no secret scanning. Cross-reference F-004: a `local` build makes *any* signer an
admin, so the localnet/mainnet boundary is already thinner than it should be.

**Proof of Concept:**

```text
1. git ls-files | grep -i key  ->  keys/local/admin-bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1.json
2. The file contains the raw 64-byte ed25519 secret key. Anyone with repository read access (it is public)
   holds full signing authority for bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1 on every cluster.
3. Impact is bounded today only because that pubkey is not in admin::ADMINS (auth.rs:6-9) and not treasury::ID.
```

**Recommendation:**

```bash
# 1. Treat the key as burned: generate a fresh localnet keypair and never commit it.
# 2. Remove it from the working tree AND rewrite it out of history (git filter-repo --path keys/ --invert-paths),
#    then force-push and rotate anything it ever touched.
# 3. Add to .gitignore:
keys/
*keypair*.json
id.json
# 4. Have CI generate the localnet wallet at runtime:
#    solana-keygen new --no-bip39-passphrase -o keys/local/admin.json
# 5. Enable GitHub secret scanning + push protection, and add gitleaks to the pre-commit hook.
```

---

#### [F-011] Neither migration instruction emits an event

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | SM-047 (also SM-048, SM-050) |
| **Category** | Observability / off-chain state reconstruction |
| **Language** | Rust |
| **File** | `programs/dynamic-bonding-curve/src/instructions/migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs:769`, `programs/dynamic-bonding-curve/src/instructions/migration/meteora_damm/migrate_meteora_damm_initialize_pool.rs:317` |
| **Evidence tier** | `[PoC-PROSE]` |
| **Status** | Open |

**Description:**

Both graduation handlers end with a literal `// TODO emit event` and no `emit!`/`emit_cpi!`. `migration_damm_v2` is the
single highest-value instruction in the program: it creates the destination AMM pool, deposits both reserves, locks
and vests liquidity, transfers two position NFTs to the partner and creator, saves the protocol migration fee, and
burns the residual base supply. None of that is reported.

`MigrateDammV2Ctx` also carries no `#[event_cpi]` attribute (compare every other handler, e.g.
`ix_swap.rs:11`, `ix_withdraw_partner_surplus.rs:13`), so adding an event requires an account-layout change.

Separately, `claim_protocol_fee2` uses plain `emit!` with an in-code caveat that the log "could be truncated. should
not rely on this" (`ix_claim_protocol_fee2.rs:161-168`), while every other handler uses the untruncatable
`emit_cpi!`.

**Impact:**

Indexers, dashboards and monitoring cannot reconstruct migration from program logs. They must poll
`VirtualPool.migration_progress` or parse the inner DAMM v2 instructions. Detecting an anomalous migration —
wrong destination config, wrong liquidity split, unexpected burn — becomes materially harder, which directly weakens
the incident-response posture already flagged in F-006.

**Proof of Concept:**

```text
1. grep -n "emit" programs/dynamic-bonding-curve/src/instructions/migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs
   -> no matches; line 769 reads "// TODO emit event".
2. Same for .../meteora_damm/migrate_meteora_damm_initialize_pool.rs:317.
3. An off-chain consumer watching DBC program logs sees EvtCurveComplete at graduation and then nothing until the
   pool's migration_progress is re-read, even though ~all of the pool's value moved in between.
```

**Recommendation:**

```rust
// event.rs
#[event]
pub struct EvtMigrateDammV2 {
    pub virtual_pool: Pubkey,
    pub damm_pool: Pubkey,
    pub damm_config: Pubkey,
    pub deposited_base_amount: u64,
    pub deposited_quote_amount: u64,
    pub first_position: Pubkey,
    pub first_position_owner: Pubkey,
    pub second_position: Option<Pubkey>,
    pub second_position_owner: Pubkey,
    pub protocol_migration_base_fee: u64,
    pub protocol_migration_quote_fee: u64,
    pub burned_base_amount: u64,
}
// add #[event_cpi] to MigrateDammV2Ctx / MigrateMeteoraDammCtx and emit_cpi! at the end of each handler,
// replacing the two `// TODO emit event` comments. Also switch ix_claim_protocol_fee2.rs:162 to emit_cpi!.
```

---

#### [F-012] `metadata_program` and `vault_program` are forwarded into the DAMM v1 migration CPI without any address constraint

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | CPI-007 / CPI-008 (also EXT-008, KV-009) |
| **Category** | CPI target validation |
| **Language** | Rust |
| **File** | `programs/dynamic-bonding-curve/src/instructions/migration/meteora_damm/migrate_meteora_damm_initialize_pool.rs:93-107` |
| **Evidence tier** | `[PoC-PROSE]` |
| **Status** | Open |

**Description:**

`MigrateMeteoraDammCtx` constrains `amm_program` (`address = dynamic_amm::ID`, `:103`) and types `token_program` as
`Program<'info, Token>` (`:110`), but leaves three program-ish accounts entirely unchecked and passes all of them into
the DAMM v1 CPI (`:186-191`):

```rust
    /// CHECK:
    pub rent: UncheckedAccount<'info>,
    ...
    /// CHECK: Metadata program
    pub metadata_program: UncheckedAccount<'info>,
    ...
    /// CHECK: vault_program
    pub vault_program: UncheckedAccount<'info>,
    ...
    /// CHECK: Associated token program.
    pub associated_token_program: UncheckedAccount<'info>,
```

By contrast the SPL-token pool-initialisation path *does* constrain the same program:
`#[account(address = mpl_token_metadata::ID)] pub metadata_program` (`ix_initialize_virtual_pool_with_spl_token.rs:129-130`).
The vendored DAMM v1 IDL shows no `address` constraint on `metadata_program` or `vault_program` either
(`idls/dynamic_amm.json:155-159`), where it *does* show one for `system_program`
(`idls/dynamic_amm.json:2010`) — so DBC cannot assume the callee constrains them.

The same instruction passes `virtual_pool_lp` as an `UncheckedAccount` whose own comment admits the gap —
`// TODO check this address and validate` (`:81`) — and then reads its balance to compute the LP distribution
(`:308-314`).

**Impact:**

DBC signs the DAMM v1 invocation with `pool_authority` seeds (`:163`, `:193`), so `pool_authority` is a *signer* inside
DAMM v1 and therefore inside any program DAMM v1 forwards it to. A hostile `metadata_program` could act with that
signature on whatever accounts DAMM v1 hands it.

Three factors keep this at severity 3 rather than higher:
1. DAMM v1 passes only its metadata-creation accounts to that program; a callee cannot touch accounts it was not given.
2. The whole CPI is wrapped in `cpi_with_account_lamport_and_owner_checking` (`:205-208`,
   `utils/cpi_checker.rs:4-32`), which asserts `after_lamports >= before_lamports` and that the owner and data length
   of `pool_authority` are unchanged — closing the lamport-siphon path (checklist RE-006 / RE-007).
3. `migration_option = MeteoraDamm` is rejected for all new configs (`process_create_config.rs:418-421`) and new
   pools (`ix_initialize_virtual_pool_with_spl_token.rs:167-170`), so this is a legacy-only path.

Whether DAMM v1 validates these accounts internally could not be confirmed — its source is not in this repository and
no on-chain query was permitted (§3).

**Proof of Concept:**

```text
Actor: any migrator of a legacy DAMM v1 pool (migration is permissionless).
1. Call migrate_meteora_damm with metadata_program = MalProgram (any executable account).
2. DBC does not check it (migrate_meteora_damm_initialize_pool.rs:99-100) and forwards it into
   dynamic_amm::cpi::initialize_permissionless_constant_product_pool_with_config2 at :186.
3. DBC's outer CpiContext::new_with_signer(pool_authority_seeds) makes pool_authority a signer for the callee
   and for anything the callee re-invokes with it.
4. Residual impact depends on whether DAMM v1 itself constrains metadata_program; the lamport/owner invariant at
   :205-208 blocks the SOL-siphon variant regardless. Extent not determined within this assessment.
```

**Recommendation:**

```rust
// migrate_meteora_damm_initialize_pool.rs — mirror the constraint already used in the SPL init path:
    /// CHECK: Metadata program
    #[account(address = mpl_token_metadata::ID)]
    pub metadata_program: UncheckedAccount<'info>,

    /// CHECK: vault_program
    #[account(address = dynamic_vault::ID)]   // 24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi
    pub vault_program: UncheckedAccount<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, AssociatedToken>,

// and close the acknowledged TODO at :81 by deriving the LP ATA instead of trusting it:
    #[account(
        mut,
        associated_token::mint = lp_mint,
        associated_token::authority = pool_authority,
    )]
    pub virtual_pool_lp: Box<Account<'info, TokenAccount>>,
```

---

### Findings by Severity (10 → 3)

#### Severity 10 — 🔴 CRITICAL
None.

#### Severity 9 — 🔴 CRITICAL
None.

#### Severity 8 — 🟠 HIGH
None.

#### Severity 7 — 🟠 HIGH
None.

#### Severity 6 — 🟡 MEDIUM
- **F-001** — Unvalidated partner-chosen Token-2022 transfer-hook program can halt all base transfers (honeypot / trapped quote).
- **F-002** — Transfer-hook pools may retain base-mint authority under a creator/partner key (unlimited dilution → quote drain).

#### Severity 5 — 🟡 MEDIUM
- **F-003** `[UNCONFIRMED]` — `validate_config_key` does not bind the DAMM v2 config's `collect_fee_mode`.

#### Severity 4 — 🔵 LOW
- **F-004** — `local` cargo feature nullifies the admin allowlist, with no build-time tripwire.
- **F-005** — Quote-mint freeze authority / mutable transfer-fee authority never inspected.
- **F-006** — No emergency pause or aggregate outflow circuit breaker.
- **F-007** — CI runs no static analysis or dependency audit and is gated on a single path.
- **F-008** — Entire CI pipeline gated on a mutably-tagged third-party GitHub Action.
- **F-009** `[UNDETERMINED]` — Unchecked `ruint` U256 arithmetic in the rate-limiter inverse solver can panic.

#### Severity 3 — 🔵 LOW
- **F-010** — Private keypair committed to the repository.
- **F-011** — Neither migration instruction emits an event.
- **F-012** — `metadata_program` / `vault_program` forwarded unconstrained into the DAMM v1 CPI.

---

### Notes & Nitpicks (no severity — below the 1-10 scale)

These carry no security impact on their own; they are recorded per OUTPUT-RULES Rule 1 § *Notes & Nitpicks* so the
findings table stays reserved for genuine security issues.

- `programs/dynamic-bonding-curve/src/instructions/migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs:359,364,366,384,394`
  — `create_second_position` calls `.unwrap()` on the optional `second_position*` accounts, while the `else { return Err(InvalidAccount) }`
  guards that would have produced a clean error live *after* the call (`:699-715`). A caller who omits the optional
  accounts gets a panic instead of `PoolError::InvalidAccount`. Self-griefing only; move the guards above the call.
- `programs/dynamic-bonding-curve/src/instructions/swap/process_swap.rs:490`, `:495`, `:530` — `&instruction.data[..8]`
  and `instruction.accounts[2]` index without a length check. Currently unreachable (only already-executed
  instructions to `crate::ID` are inspected, and those necessarily carry ≥ 8 data bytes and ≥ 3 accounts), but
  `data.get(..8)` / `accounts.get(2)` would make the invariant local rather than global.
- `programs/dynamic-bonding-curve/src/state/virtual_pool.rs:425` — `.try_into().unwrap()` where the sibling at `:516-519`
  uses `.map_err(|_| PoolError::TypeCastFailed)`. Both are provably safe (the `else` branch establishes
  `max_amount_out <= amount_left <= u64::MAX`); the inconsistency is worth removing.
- `programs/dynamic-bonding-curve/src/utils/pool_account_loader.rs:43-57` and
  `utils/config_account_loader.rs:54-68` — `bytemuck::from_bytes` requires the slice length to equal
  `size_of::<T>()`, but the code slices by `T::INIT_SPACE`. The `const_assert_eq!(PoolState::INIT_SPACE, 416)` at
  `state/virtual_pool.rs:202` pins one side only. Add `const_assert_eq!(std::mem::size_of::<PoolState>(), PoolState::INIT_SPACE)`
  (and the same for `PoolConfig`) so a future field reordering fails to compile instead of panicking at runtime.
- `programs/dynamic-bonding-curve/src/state/virtual_pool.rs:1168-1178` — surplus withdrawal sets the
  `is_*_withdraw_surplus` flags but never decrements `quote_reserve`, so after graduation `quote_reserve`
  over-states the vault. Harmless on-chain (no path re-reads it for a transfer) but misleading to indexers.
- `programs/dynamic-bonding-curve/src/instructions/migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs:406-407`
  — `token_a_amount_threshold: u64::MAX, token_b_amount_threshold: u64::MAX` with a `// TODO should we take care for
  that`. The over-draw is bounded to ~1 unit per side (the liquidity delta is a `min()` of two round-down conversions
  at `migration_handler/concentrated_liquidity.rs:148-164`, while DAMM v2 rounds the required amounts up), and the
  base side is caught downstream by the `safe_sub` at `:743-747`. The quote side has no post-check.
- Five `// TODO check whether we should use round down or round up` comments remain on production curve math
  (`params/liquidity_distribution.rs:49,58,77,97`; `state/virtual_pool.rs:881`). The rounding was verified correct
  (pool-favourable) in this review; the comments should be resolved so the next reader does not have to re-derive it.
- Dead code: `access_control::is_claim_fee_operator` (`access_control.rs:13-23`) has no caller;
  `EvtCreateClaimFeeOperator` (`event.rs:76-79`) is never emitted; `MeteoraDammV2Metadata`
  (`instructions/migration/dynamic_amm_v2/damm_v2_metadata_state.rs:5-19`) has no loader;
  `handle_migration_damm_v2_create_metadata` (`migration_damm_v2_create_metadata.rs:20-24`) is a deprecated no-op
  whose five accounts are all unchecked.
- `programs/dynamic-bonding-curve/src/error.rs` carries 14 variants explicitly marked `/// deprecated`
  (`:32`, `:90`, `:148`, `:155`, `:183`, `:187`, `:197`, `:201`, `:205`, `:209`, `:213`, `:217`). Keeping them is
  correct (error codes are positional) — worth a one-line comment saying so.
- `programs/dynamic-bonding-curve/src/instructions/creator/ix_create_virtual_pool_metadata.rs:30` and
  `instructions/partner/ix_create_partner_metadata.rs:28` — `space = 8 + …::space(&metadata)` derives the account
  size from unbounded user strings. The payer funds the rent and the 10 MB account cap applies, so there is no
  protocol cost, but a `require!(name.len() <= N)` would make the bound explicit (AV-042).
- `programs/dynamic-bonding-curve/src/migration_handler/concentrated_liquidity.rs:119` — a `msg!("debug dammv2 …")`
  left in `#[cfg(feature = "local")]` code. Harmless; remove with the rest of the `local`-gated debug scaffolding.
- `programs/dynamic-bonding-curve/src/tests/test_swap.rs:241-292` — `test_swap_wont_depelete_reserve` runs 10 000
  randomised swaps but asserts nothing; it only `println!`s the final user balance. The test name states an
  invariant the test never checks. Add `assert!(user.quote_balance <= u64::MAX)` → i.e. a real conservation assert.

---

## 5. Detailed Item Results

> Every in-scope checklist item appears below with an explicit verdict, in checklist order (OUTPUT-RULES Rule 4).
> Paths are relative to `programs/dynamic-bonding-curve/src/` unless a longer path is given.
> `[UNCONFIRMED]` / `[UNDETERMINED]` are Rule 5b validation-gate outcomes; they are tallied under **Partial**
> and are never counted as confirmed FAILs.

### Checklist 01 — Account Validation (AV-001 → AV-090)

```
[PASS]      AV-001: Owner validated on every deserialized account — typed Anchor accounts, plus the two custom
                    zero-copy loaders which assert owner == crate::ID before any read.
                    utils/pool_account_loader.rs:17-20 · utils/config_account_loader.rs:17-20
[PASS]      AV-002: No raw `AccountInfo<'info>` field in any #[derive(Accounts)] struct; unvalidated slots use
                    UncheckedAccount<'info>. The only AccountInfo fields are in the plain helper struct
                    ProcessCreateTokenMetadataParams (initialize_pool/process_create_token_metadata.rs:5-19),
                    which is not an Accounts struct.
[PARTIAL]   AV-003: Every UncheckedAccount carries a `/// CHECK:` comment, but many are bare labels
                    ("pool account", "rent", "config account") rather than a description of the runtime check.
                    File: creator/ix_claim_creator_trading_fee.rs:22-24 ·
                          migration/meteora_damm/migrate_meteora_damm_initialize_pool.rs:93-94
                    Improvement: name the check and its location, e.g. "owner+disc via PoolAccountLoader::try_from,
                    vaults/config re-bound at :72-83".
[PARTIAL]   AV-004: Most /// CHECK: comments do map to real code, but one explicitly admits the gap:
                    "CHECK: virtual pool lp  // TODO check this address and validate".
                    File: migration/meteora_damm/migrate_meteora_damm_initialize_pool.rs:79-81 (balance read at :308)
                    Improvement: derive it as the pool_authority ATA of lp_mint — see F-012.
[PASS]      AV-005: Typed Account/AccountLoader used with the matching state struct throughout; e.g.
                    AccountLoader<PoolConfig> in ix_create_config.rs:19 vs AccountLoader<ConfigWithTransferHook>
                    in ix_create_transfer_hook_config.rs:22 — distinct discriminators enforce the split.
[PASS]      AV-006: All token accounts are Box<InterfaceAccount<TokenAccount>> or Box<Account<TokenAccount>>;
                    no raw AccountInfo. e.g. swap/ix_swap.rs:29-41 · migration/withdraw_leftover.rs:32-36
[PARTIAL]   AV-007: Mints are typed in the swap/claim/init paths (Box<InterfaceAccount<Mint>>), but base_mint is an
                    UncheckedAccount in three migration/locker contexts, bound only indirectly.
                    File: migration/create_locker.rs:30-31 (bound by pool.base_mint == key at :86-89) ·
                          migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs:87-92 (bound by
                          token::mint = base_mint on base_vault + pool.base_vault == key at :521-528)
                    Improvement: type them as InterfaceAccount<Mint> so the binding is declarative.
[PARTIAL]   AV-008: System/token/metadata programs are typed or address-constrained in the swap and init paths
                    (Program<System>, Program<Token>, Interface<TokenInterface>,
                    address = mpl_token_metadata::ID at initialize_pool/ix_initialize_virtual_pool_with_spl_token.rs:129).
                    The legacy DAMM v1 migration context leaves rent, metadata_program, vault_program and
                    associated_token_program unchecked.
                    File: migration/meteora_damm/migrate_meteora_damm_initialize_pool.rs:93-113 — see F-012
[PASS]      AV-009: Foreign state structs are loaded through their own owner impl —
                    AccountLoader<damm_v2::accounts::Config> (migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs:511)
                    and Box<Account<dynamic_amm::accounts::Config>> (meteora_damm/migrate_meteora_damm_initialize_pool.rs:36);
                    both crates are declare_program! shims whose ids come from the vendored IDLs
                    (idls/damm_v2.json:2 = cpamdpZ… · idls/dynamic_amm.json:2 = Eo7WjKq…), which match the
                    published Meteora program ids.
[PASS]      AV-010: declare_id!("dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN") (lib.rs:29) matches
                    Anchor.toml:6 [programs.localnet] dynamic_bonding_curve. The deployed-binary match could not
                    be verified (no build/RPC — see §3); tracked at OPS-025/OPS-070.
[PASS]      AV-011: All persistent accounts use #[account(zero_copy)] / #[account], so Anchor emits and checks the
                    8-byte discriminator; the custom loaders re-check it by hand
                    (pool_account_loader.rs:29-35 · config_account_loader.rs:22-42).
[PARTIAL]   AV-012: VirtualPool and TransferHookPool are byte-identical wrappers over PoolState (416 B,
                    state/virtual_pool.rs:163-204) and PoolAccountLoader accepts either. The intended-variant check
                    is then re-asserted per handler rather than by the type system.
                    File: swap/ix_swap.rs:69-72 (rejects hook pools) · swap/ix_swap2_with_transfer_hook.rs:73-76
                          (requires hook pools) · partner/ix_claim_partner_trading_fee.rs:76-79 ·
                          creator/ix_claim_creator_trading_fee.rs:65-68
                    Every polymorphic entry point was checked and each one does assert the variant it needs, so this
                    is a deliberate design rather than a gap — but it is a same-layout pair guarded by convention.
                    Improvement: add a compile-time-enforced marker byte, or a shared helper that takes the expected
                    variant as an argument so a future handler cannot forget the require!.
[PASS]      AV-013: The one manually-supplied remaining account that is deserialized (the DAMM v2 config) goes through
                    AccountLoader::try_from, which checks owner + discriminator.
                    migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs:511-513
[UNCONFIRMED] AV-014: The DAMM v2 config in remaining_accounts[0] is not address-derived (it is a keypair account, not
                    a PDA), and the substitute binding — pool_creator_authority == pool_authority — does not cover
                    collect_fee_mode or config_type.
                    File: migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs:418-496 — F-003
                    Gate: reachability unverifiable in scope (needs the live DBC-authorised config set).
[PASS]      AV-015: All eight account discriminators are Anchor-derived from distinct type names
                    (PoolConfig, ConfigWithTransferHook, VirtualPool, TransferHookPool, Operator, ClaimFeeOperator,
                    TokenBadge, PartnerMetadata, VirtualPoolMetadata, MeteoraDammMigrationMetadata) — no collision.
[PASS]      AV-016: No manual Borsh (de)serialization of a persistent account anywhere; every struct in state/ uses
                    #[account] or #[account(zero_copy)].
[PASS]      AV-017: Version drift is handled by tombstoned padding fields with explicit warnings rather than by
                    discriminator reuse — state/config.rs:513-516 ("Previously was protocol and referral fee percent.
                    Beware of tombstone.") · meteora_damm_metadata_state.rs:10-11 · virtual_pool.rs:147-148.
                    PoolConfig also carries an explicit `version: u8` (state/config.rs:525-526).
[PASS]      AV-018: Every mutated account is #[account(mut)] — verified per handler; e.g. pool + both vaults + both
                    user token accounts in swap/ix_swap.rs:24-41, pool in creator/ix_transfer_pool_creator.rs:14-15.
[PARTIAL]   AV-019: A few accounts are mut without being written. base_mint is mut in CreateLockerCtx although the
                    locker CPI only moves tokens out of base_vault.
                    File: migration/create_locker.rs:29-31
                    (pool_authority's `mut` in the migration contexts IS required — flash_rent.rs:6-25 moves its
                    lamports; base_mint's `mut` in SwapWithTransferHookCtx IS required — revoke_transfer_hook
                    rewrites the mint extension at process_swap.rs:390-430.)
                    Improvement: drop the unnecessary mut so an unrelated write-lock is not taken (cross-ref KV-131).
[PASS]      AV-020: Cross-account references are bound on every path. Typed contexts use declarative has_one
                    (meteora_damm/migrate_meteora_damm_initialize_pool.rs:16 has_one = base_vault/quote_vault/config;
                    meteora_damm_claim_lp_token.rs:13 has_one = lp_mint/virtual_pool;
                    ix_initialize_virtual_pool_with_spl_token.rs:51 has_one = quote_mint). Polymorphic contexts use
                    the runtime equivalent, e.g. swap/process_swap.rs:113-124 binds pool.base_vault/quote_vault/config.
[PASS]      AV-021: The runtime require!-with-ErrorCode::ConstraintHasOne backup is present exactly where the
                    declarative form cannot be used, and is applied consistently across all 11 polymorphic handlers
                    (process_swap.rs:113-124 · ix_claim_partner_trading_fee.rs:70-98 ·
                    ix_claim_creator_trading_fee.rs:72-83 · ix_withdraw_partner_surplus.rs:49-63 ·
                    ix_withdraw_creator_surplus.rs:48-63 · ix_withdraw_migration_fee.rs:72-87 ·
                    withdraw_leftover.rs:54-75 · create_locker.rs:74-89 · ix_claim_protocol_fee2.rs:84-107 ·
                    ix_claim_protocol_pool_creation_fee.rs:42-45 · migrate_damm_v2_initialize_pool.rs:521-532).
[PASS]      AV-022: Every init carries payer + space + (seeds,bump) or an explicit `signer` constraint, e.g.
                    ix_initialize_virtual_pool_with_spl_token.rs:78-122 (pool + both vaults, all PDA-seeded) ·
                    ix_create_config.rs:13-19 (keypair config, `signer` required).
[PASS]      AV-023: init_if_needed is not used anywhere in the program (zero occurrences).
[N/A]       AV-024: No init_if_needed to guard — see AV-023.
[PARTIAL]   AV-025: `close = destination` is used three times and the destination is an unconstrained
                    UncheckedAccount in all three; the caller chooses where the rent goes.
                    File: admin/ix_close_operator_account.rs:6-16 · operator/ix_close_token_badge.rs:11-23 ·
                          admin/ix_close_claim_protocol_fee_operator.rs:8-16
                    Impact is bounded (the closer is the admin or a permissioned operator, and the amount is the
                    account rent) but the destination is not tied to a protocol address.
                    Improvement: constrain rent_receiver to the signer or to treasury::ID.
[PASS]      AV-026: All closes go through Anchor's `close =` constraint, which zeroes data, sets the closed
                    discriminator and reassigns to the system program; no handler closes an account by hand.
[PASS]      AV-027: Every PDA includes the full identity of its parent — pool ["pool", config, max(mint), min(mint)]
                    (ix_initialize_virtual_pool_with_spl_token.rs:80-85), vault ["token_vault", mint, pool] (:95-99),
                    token_badge ["token_badge", mint] (ix_create_token_badge.rs:18-21), operator
                    ["operator", whitelisted] (ix_create_operator_account.rs:15-18), base_locker
                    ["base_locker", virtual_pool] (macros.rs:8-12), metadata PDAs on their parent key.
                    The max/min mint ordering makes the pool seed canonical regardless of argument order.
[PARTIAL]   AV-028: Bumps are not stored in state and are re-derived by Anchor on every reference. The one hot path
                    that would have cost the most is pinned at compile time instead —
                    const_pda::pool_authority::BUMP via const_crypto::ed25519 (const_pda.rs:7-13) — and
                    ctx.bumps.base is used for the locker PDA (create_locker.rs:105). Correctness is unaffected
                    (Anchor always derives the canonical bump); this is a compute-unit note.
[PASS]      AV-029: Custom constraints carry named errors, e.g.
                    `constraint = new_creator.key().ne(creator.key) @ PoolError::InvalidNewCreator`
                    (creator/ix_transfer_pool_creator.rs:23-25). No bare ConstraintRaw was found.
[N/A]       AV-030: No `realloc` anywhere in the program (zero occurrences) — no account is ever resized.
[PASS]      AV-031: The only duplicate-capable slot opts in explicitly with Anchor 1.0's `dup`:
                    `#[account(mut, dup)] pub referral_token_account: Option<...>` (swap/ix_swap.rs:59-60 ·
                    swap/ix_swap2_with_transfer_hook.rs:62-63) — required because the referral account may equal
                    the user's output account.
[PASS]      AV-032: remaining_accounts are never passed through blind. The swap path accounts for every slot:
                    length arithmetic at process_swap.rs:174-195, sysvar identity check at :188-191, and the
                    transfer-hook slices consumed exactly at utils/remaining_accounts.rs:36-73.
                    The claim paths additionally require the slice to be fully consumed
                    (ix_claim_partner_trading_fee.rs:106-109 · ix_claim_creator_trading_fee.rs:91-94).
[PASS]      AV-033: Owner is verified for every remaining account that is read — the instructions sysvar by address
                    (process_swap.rs:188-191), the DAMM v2 config by AccountLoader (migrate_damm_v2_…:511-513),
                    the quote-mint TokenBadge by AccountLoader (utils/token.rs:260-267).
[N/A]       AV-034: No remaining account is used as a token account. The transfer-hook slices are forwarded to
                    spl_transfer_hook_interface::onchain::add_extra_accounts_for_execute_cpi (utils/token.rs:92-102),
                    which resolves the required metas from the mint's ExtraAccountMetaList and matches them against
                    the supplied set — DBC never interprets them as token accounts itself.
[PARTIAL]   AV-035: The one remaining account used as program state (the DAMM v2 config) is not address-derived; it
                    is a keypair-indexed account, so re-derivation is impossible and the substitute binding is
                    pool_creator_authority == pool_authority. That binding is sound but incomplete — see AV-014/F-003.
                    File: migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs:490-493
[PASS]      AV-036: Counts are validated everywhere they matter: `extra_remaining_account_count <= 1`
                    (process_swap.rs:182-185, with safe_sub so an over-declared slice errors rather than wraps),
                    `remaining_accounts.len() >= length` per slice (utils/remaining_accounts.rs:47-50),
                    `remaining_accounts.is_empty()` after parsing in both claim paths, and
                    `ctx.remaining_accounts.len() >= 1` before the migration config read (migrate_damm_v2_…:507-510).
[PASS]      AV-037: The only external CPI that receives remaining accounts is the transfer hook, and the hook program
                    id is read from the mint itself (utils/token.rs:46-56, :87), not from the caller — so the CPI
                    target is state-derived. (The *trust* problem with that program is F-001, not a validation gap.)
[PASS]      AV-038: Duplicate-account confusion is prevented structurally: the transfer-hook slices are taken from a
                    disjoint suffix of remaining_accounts (process_swap.rs:272) and each slice type may appear at most
                    once (utils/remaining_accounts.rs:56-71, DuplicatedRemainingAccountTypes).
[N/A]       AV-039: No investor-position accounts — DBC has no per-user state account; a trader's position is their
                    SPL token balance.
[PASS]      AV-040: All space values are `8 + T::INIT_SPACE` with the layout pinned by const_assert_eq!:
                    PoolConfig 1040 (config.rs:588), ConfigWithTransferHook 1120 (:598), PoolState/VirtualPool/
                    TransferHookPool 416 (virtual_pool.rs:202-204), Operator 64 (operator.rs:35), TokenBadge 160
                    (token_badge.rs:14), ClaimFeeOperator 160 (claim_fee_operator.rs:14),
                    MeteoraDammMigrationMetadata 272 (meteora_damm_metadata_state.rs:37).
[PASS]      AV-041: Every account is created through Anchor `init`, which funds rent-exemption from the payer; the
                    only path that later removes lamports re-asserts the floor
                    (utils/token.rs:301-317, InsufficientPoolLamports).
[PARTIAL]   AV-042: The two metadata accounts size themselves from unbounded user strings with no length cap.
                    File: creator/ix_create_virtual_pool_metadata.rs:30 + state/virtual_pool_metadata.rs:21-30 ·
                          partner/ix_create_partner_metadata.rs:28 + state/partner_metadata.rs:21-30
                    The payer funds the rent and Solana's 10 MB cap applies, so there is no protocol cost.
                    Improvement: require!(name.len() <= 64 && website.len() <= 256 && logo.len() <= 256).
[N/A]       AV-043: No realloc — see AV-030.
[N/A]       AV-044: No instruction shrinks an account; sizes are fixed at init.
[PASS]      AV-045: Every transfer goes through transfer_checked with the mint supplied, and the vaults carry
                    `token::mint = …` constraints bound back to the pool. utils/token.rs:69-78, :126-135 ·
                    swap/ix_swap.rs:36-41 · migration/withdraw_leftover.rs:35-36
[PASS]      AV-046: Vault authority is pinned to the single global pool_authority PDA at creation
                    (`token::authority = pool_authority`, ix_initialize_virtual_pool_with_spl_token.rs:101, :117)
                    and the account itself is address-constrained on every later use
                    (`address = const_pda::pool_authority::ID`, e.g. swap/ix_swap.rs:15-18).
[PASS]      AV-047: Vault identity is re-bound to the pool on every value path via
                    pool.base_vault/quote_vault == key (process_swap.rs:113-120 and the ten sibling handlers listed
                    at AV-021), so a vault from another pool cannot be substituted.
[PASS]      AV-048: ATAs are enforced declaratively where they are required —
                    `associated_token::authority/mint/token_program` in withdraw_leftover.rs:27-31 and
                    `associated_token::mint/authority` in meteora_damm_claim_lp_token.rs:27-39 and
                    meteora_damm_lock_lp_token.rs:44-48.
[N/A]       AV-049: The program never reads or relies on a token account's `delegate` / `delegated_amount`.
[PARTIAL]   AV-050: Frozen-state handling is absent: no path reads `TokenAccount.state` or `Mint.freeze_authority`.
                    Base mints are created by the program with no freeze authority (Anchor `init` leaves it None —
                    ix_initialize_virtual_pool_with_spl_token.rs:62-70), so only the quote side is exposed.
                    File: utils/token.rs:218-244 — see F-005
[N/A]       AV-051: WSOL is never wrapped/unwrapped by the program; SOL-quoted pools use the standard native mint as
                    an ordinary SPL mint, and the only lamport movements are the pool-creation fee and flash rent.
[PASS]      AV-052: The two token programs are never conflated — token_base_program and token_quote_program are
                    separate Interface<TokenInterface> slots bound to their own vault
                    (`token::token_program = …`, swap/ix_swap.rs:36-41), the quote flag is recorded at config time
                    (get_token_program_flags, utils/token.rs:34-44), and the Token-2022-only paths are typed
                    Program<'info, Token2022> (ix_initialize_virtual_pool_with_token2022.rs:107).
[PASS]      AV-053: Every persistent account is created with Anchor `init` (never init_if_needed), which fails if the
                    account already exists — re-initialization is impossible for PoolConfig, VirtualPool,
                    TransferHookPool, both vaults, Operator, TokenBadge and the metadata accounts.
[N/A]       AV-054: No manual initialization path exists — see AV-053.
[PASS]      AV-055: The three closable accounts (Operator, TokenBadge, ClaimFeeOperator) are pure capability records
                    with no balances and no pointers into pool state; re-deriving their seeds after a close yields a
                    fresh account that must be re-initialized by the admin/operator, carrying no stale association.
[PASS]      AV-056: Revival is blocked by Anchor 1.0's close semantics (data zeroed, owner reassigned to the system
                    program), and none of the three closable accounts is re-read after close within the same
                    transaction. Cross-ref KV-106.
[PASS]      AV-057: No handler both closes an account and continues to use it; the two close-only handlers read the
                    account before the constraint fires and then return (ix_close_token_badge.rs:26-35 ·
                    ix_close_claim_protocol_fee_operator.rs:21-31).
[PASS]      AV-058: The token program is constrained per account rather than assumed —
                    `token::token_program = token_base_program` / `= token_quote_program` on the vaults
                    (swap/ix_swap.rs:36-41) and `mint::token_program` on the mints
                    (ix_initialize_virtual_pool_with_spl_token.rs:68, :73); InterfaceAccount/token_interface is used
                    wherever both programs must be supported.
[PARTIAL]   AV-059: ATA enforcement is declarative in withdraw_leftover and the two DAMM v1 LP handlers (see AV-048)
                    but absent on the fee-receiving accounts, which are plain InterfaceAccount<TokenAccount> chosen
                    by the claimer.
                    File: partner/ix_claim_partner_trading_fee.rs:30-35 · creator/ix_claim_creator_trading_fee.rs:27-32
                          · swap/ix_swap.rs:59-60 (referral)
                    This is safe — transfer_checked binds the mint and the claimer is already authenticated — but it
                    means a mistyped destination is not caught. Cross-ref KV-107.
[PASS]      AV-060: All token movement uses the checked variants — transfer_checked
                    (utils/token.rs:69, :126), anchor_spl::token::mint_to /
                    anchor_spl::token_2022::mint_to with the mint supplied
                    (ix_initialize_virtual_pool_with_spl_token.rs:217, process_initialize_…_token2022.rs:132),
                    and token_interface::burn (migrate_damm_v2_initialize_pool.rs:753).
[PASS]      AV-061: Decimals are always read from the mint account (`token_mint.decimals` at utils/token.rs:77, :134)
                    and the config's token_decimal is validated to 6..=9 at creation
                    (process_create_config.rs:449-452). No decimals are hardcoded, and base and quote amounts are
                    never added to or compared with each other.
[PASS]      AV-062: Where a transfer could change the credited amount, the program re-reads the balance rather than
                    trusting the declared amount: base_vault.reload() before the completion solvency check
                    (process_swap.rs:344-354) and before the burn (migrate_damm_v2_initialize_pool.rs:737-747), and
                    both vaults reload to compute the real deposited deltas at :664-676. Fee-on-transfer is
                    additionally excluded outright — see AV-063.
[PARTIAL]   AV-063: Extension handling is selective rather than exhaustive. TransferFee is rejected for quote mints
                    (utils/token.rs:172-199, :232-235) and the non-badged quote allowlist is restricted to
                    MetadataPointer/TokenMetadata (:237-243). TransferHook is supported by design but unvalidated
                    (F-001). PermanentDelegate, DefaultAccountState, MintCloseAuthority, ConfidentialTransfer and
                    InterestBearing are never inspected — they are only excluded indirectly, for non-badged quote
                    mints, by the extension allowlist; a badged mint bypasses that.
                    File: utils/token.rs:218-258 — cross-ref F-005, KV-105
[FAIL-6]    AV-064: Custodied base tokens can be diluted by an untrusted mint authority. For transfer-hook configs the
                    base mint's authority is handed to a plain creator/partner key instead of being revoked.
                    File: initialize_pool/process_initialize_virtual_pool_with_token2022.rs:145-167
                          (guard at :148-153 applies only when !is_transfer_hook_config)
                    Impact: the key holder mints unlimited base and sells it into the curve, extracting essentially
                    the whole quote_reserve.
                    Fix: make the `require!(token_mint_authority.is_none())` unconditional, or add a supply
                    invariant to the swap path. See F-002.
[FAIL-4]    AV-065: Mint freeze_authority is never read, for either token program; is_supported_quote_mint returns
                    true for any classic SPL mint without inspecting anything.
                    File: utils/token.rs:218-222
                    Impact: a freezable quote mint can freeze the pool's quote_vault, reverting every quote-side
                    path (swap, all fee claims, both surplus withdrawals, migration fee, migration) until unfrozen.
                    Fix: return false (i.e. require a TokenBadge) when freeze_authority.is_some(). See F-005.
[PASS]      AV-066: A mint allowlist does exist and is operator-gated: TokenBadge, seeded on the mint and creatable
                    only by an operator holding OperatorPermission::CreateTokenBadge
                    (operator/ix_create_token_badge.rs:15-38, lib.rs:63-66). Any quote mint outside the
                    "plain SPL, or Token-2022 with metadata extensions only and zero transfer fee" envelope must be
                    badged (utils/token.rs:246-258), and badge creation itself refuses mints that are already
                    supported (ix_create_token_badge.rs:41-44).
[PASS]      AV-067: Token account close_authority and delegate are structurally excluded: both vaults are created by
                    the program with Anchor `init` and `token::authority = pool_authority`
                    (ix_initialize_virtual_pool_with_spl_token.rs:93-122), which sets no delegate and no
                    close authority, and no instruction ever calls approve/set_authority on a vault.
[PASS]      AV-068: Clock is always obtained by syscall — Clock::get() at utils/activation_handler.rs:29-30,
                    swap/process_swap.rs:230, migrate_damm_v2_initialize_pool.rs:499,
                    ix_create_config.rs:41, utils/token.rs:209, :233 — and Rent::get() at utils/token.rs:274, :309.
                    No Clock or Rent account is ever passed in and read.
[PARTIAL]   AV-069: The instructions sysvar is address-asserted rather than typed —
                    `require!(account.key.eq(&instructions_sysvar::ID), PoolError::InvalidInstructionsSysvar)`
                    (process_swap.rs:186-195), which is equivalent in effect. The legacy DAMM v1 context, however,
                    passes `rent` as a bare UncheckedAccount with no address assertion.
                    File: migration/meteora_damm/migrate_meteora_damm_initialize_pool.rs:93-94 — cross-ref F-012
[PASS]      AV-070: Time-gated logic cannot be spoofed: the fee scheduler and rate limiter read current_point from
                    get_current_point (Clock syscall, activation_handler.rs:25-33), the vesting cliff is derived from
                    pool.finish_curve_timestamp written on-chain at graduation (process_swap.rs:357), and the
                    volatility tracker uses Clock::get()?.unix_timestamp (process_swap.rs:230).
[N/A]       AV-071: No signature is verified via Instructions-sysvar introspection; the ed25519/secp256k1 precompiles
                    are never referenced. Introspection is used only to count sibling swaps and to look for an
                    initialize-pool instruction (process_swap.rs:432-550).
[N/A]       AV-072: No introspection-based signature check exists — see AV-071.
[N/A]       AV-073: No introspected signed messages — see AV-071.
[PASS]      AV-074: Instruction indices are computed, never assumed. load_current_index_checked is used to find the
                    current position and the scan runs 0..current_index (process_swap.rs:440-485, :516-547); sibling
                    scanning uses get_processed_sibling_instruction with an incrementing index (:451-461). No fixed
                    index into the transaction is used.
[PASS]      AV-075: Privileged accounts are bound by address or by state, never by position: pool_authority via
                    `address = const_pda::pool_authority::ID` (every context), the protocol-fee caller via
                    `address = const_pda::protocol_fee_authority::ID` on a Signer (ix_claim_protocol_fee2.rs:41-42),
                    treasury via `address = treasury::ID` (ix_claim_protocol_pool_creation_fee.rs:26-30), admins via
                    the compiled allowlist (admin/auth.rs:6-9, :24-29), and fee_claimer/creator via config/pool state
                    (access_control.rs:25-40).
[PASS]      AV-076: Bumps are canonical throughout — Anchor `seeds`/`bump` (which uses find_program_address) for every
                    PDA, and a compile-time canonical derivation for the two global authorities via
                    const_crypto::ed25519::derive_program_address (const_pda.rs:7-13, :19-25). No user-supplied bump
                    is ever fed to create_program_address. Covered by a dedicated unit test
                    (tests/test_const_pda.rs). Cross-ref KV-104.
[N/A]       AV-077: The program is Anchor 1.0 (anchor-lang 1.0.2, Cargo.toml:17) — not native/Pinocchio. §1.10 items
                    AV-078..AV-084 are therefore evaluated as N/A from this gate.
[N/A]       AV-078: Not a native program — Anchor performs the owner check. See AV-077, AV-001.
[N/A]       AV-079: Not a native program — Anchor's Signer<'info> and `mut` provide these. See AV-077.
[N/A]       AV-080: Not a native program — Anchor validates account counts. The only manual byte-slice reads are in
                    the two custom loaders, which are length-checked (pool_account_loader.rs:24-27 ·
                    config_account_loader.rs:22-42). See AV-077.
[N/A]       AV-081: No `unsafe` block exists anywhere in the program (zero occurrences). See AV-077, OPS-023.
[N/A]       AV-082: Not a native program — 8-byte Anchor discriminators are used. See AV-077, AV-012.
[N/A]       AV-083: Pinocchio is not a dependency (Cargo.toml:31-46).
[N/A]       AV-084: The program does not reimplement SPL Token logic; it CPIs to the real token programs.
[PASS]      AV-085: No instruction asserts an exact lamport balance. The one lamport-floor check uses `>=`
                    (utils/token.rs:311-314) and the rent top-up uses `if minimum_balance > current_lamport`
                    (:276-282), so a donation is absorbed rather than fatal. flash_rent uses saturating_sub and
                    only tops up a consumed amount (flash_rent.rs:13-23). Cross-ref KV-123.
[PASS]      AV-086: No builtin, sysvar or precompile account is requested as writable anywhere. The instructions
                    sysvar is read-only (process_swap.rs:186-195); system/token/metadata/AMM programs are all
                    non-mut.
[PASS]      AV-087: The pre-creation DoS does not apply: every `init` target is either a PDA seeded on a
                    caller-chosen fresh keypair (pool/vaults derive from base_mint, which is `init, signer` — so an
                    attacker cannot predict it) or the keypair account itself (config). No ATA is created by the
                    program. Cross-ref KV-127.
[PASS]      AV-088: No `unsafe` deserialization. The zero-copy reads use bytemuck::from_bytes on a length-validated
                    slice of an owner- and discriminator-checked account (pool_account_loader.rs:22-57 ·
                    config_account_loader.rs:22-68); no Vec::set_len, MaybeUninit or memmove decoder exists.
                    (See Notes & Nitpicks for the INIT_SPACE vs size_of hardening suggestion.)
[PASS]      AV-089: No branch anywhere reads ComputeBudgetProgram instructions from the Instructions sysvar. The two
                    introspection routines filter on crate::ID and on the initialize-pool/swap discriminators only
                    (process_swap.rs:471-484, :529-546); a no-op ComputeBudget instruction in the message is simply
                    ignored. Cross-ref KV-135.
[PASS]      AV-090: The introspection loops are v1-safe. They are bounded by current_index rather than by a constant,
                    make no "exactly N instructions" assumption, tolerate interleaved unrelated instructions, and do
                    not depend on address-lookup-table resolution. remaining_accounts is bounded relatively
                    (extra <= 1 plus the declared hook slices, process_swap.rs:174-195), not by a fixed cap.
                    Cross-ref KV-136.
```

**Checklist 01 tally — PASS 53 · FAIL 2 · PARTIAL 15 (incl. 1 `[UNCONFIRMED]`) · N/A 20 = 90**

### Checklist 02 — Access Control (AC-001 → AC-050)

```
[PASS]      AC-001: Every value-moving instruction has a Signer. Swaps: payer (ix_swap.rs:50). Claims:
                    fee_claimer / creator / signer (ix_claim_partner_trading_fee.rs:51 ·
                    ix_claim_creator_trading_fee.rs:48 · ix_claim_protocol_fee2.rs:42). Migration/locker/leftover
                    have payer or are pure state-to-state moves whose destinations are fixed by config
                    (withdraw_leftover.rs:27-42 pays the config's leftover_receiver ATA).
[PARTIAL]   AC-002: Four instructions mutate pool state without any Signer bound to a role — they are permissionless
                    cranks by design: create_locker (create_locker.rs:53-54 payer only), withdraw_leftover
                    (no signer at all), migration_damm_v2 (payer only), migrate_meteora_damm (payer only).
                    Each is guarded by a migration-progress precondition and pays a config-fixed destination, so a
                    hostile cranker gains nothing; but the outcome of the crank (e.g. which DAMM v2 config is used)
                    is attacker-selected — see F-003.
[PASS]      AC-003: Signer-to-state binding is explicit on every role path: is_partner_fee_claimer reads
                    config.fee_claimer (access_control.rs:25-33), is_pool_creator reads pool.creator (:35-40),
                    is_valid_operator_role reads operator.whitelisted_address (:42-54), is_admin reads the compiled
                    allowlist (:8-11), and withdraw_migration_fee re-checks both in-handler
                    (ix_withdraw_migration_fee.rs:100-118).
[PASS]      AC-004: All signers are Anchor Signer<'info>; no manual is_signer inspection exists anywhere.
[N/A]       AC-005: No manual is_signer check to evaluate — see AC-004.
[PASS]      AC-006: The admin surface uses #[access_control(is_admin(ctx.accounts.signer.key))] on all three
                    admin instructions (lib.rs:35, :43, :48) and the operator surface uses
                    is_valid_operator_role with an explicit permission bit (lib.rs:56, :63, :68).
[N/A]       AC-007: No investor/position accounts exist — a trader's position is their SPL token balance, held in
                    their own wallet. See AV-039.
[N/A]       AC-008: No delegate mechanism; the program never reads token_account.delegate.
[PASS]      AC-009: No third party can act for a signer. The only "anyone can trigger" instructions pay to
                    config- or pool-derived destinations (withdraw_leftover → config.leftover_receiver ATA;
                    meteora_damm_claim_lp_token → the owner's ATA, with owner required to equal
                    migration_metadata.partner or virtual_pool.creator, meteora_damm_claim_lp_token.rs:84-92).
[PASS]      AC-010: The permissionless value-moving instructions are documented and bounded: migration and locker
                    move value only into their protocol-fixed destinations; withdraw_leftover pays only the
                    config's leftover_receiver; the LP claim/lock handlers pay only the recorded partner/creator.
                    None lets the caller nominate an arbitrary recipient.
[PASS]      AC-011: Roles enumerated and mapped: admin (3 ix), operator (3 ix), protocol-fee authority PDA (1 ix),
                    partner/fee_claimer (5 ix), pool creator (5 ix), partner-or-creator (1 ix,
                    withdraw_migration_fee), permissionless (14 ix). Full map in §6.
[PASS]      AC-012: The one dual-role instruction is explicit and disambiguated by an argument:
                    withdraw_migration_fee takes `flag: u8` and re-checks the matching authority in-handler
                    (ix_withdraw_migration_fee.rs:99-128), with separate one-shot bits per role
                    (PARTNER_MIGRATION_FEE_MASK / CREATOR_MIGRATION_FEE_MASK, state/virtual_pool.rs:206-207).
[PASS]      AC-013: Manager-role escalation blocked: is_partner_fee_claimer loads the config through
                    ConfigAccountLoader (owner + discriminator + length, config_account_loader.rs:16-48) before
                    comparing fee_claimer, and every handler then re-binds pool.config == config.key(), so a
                    substituted config cannot be used against another pool.
[PASS]      AC-014: Creator-role escalation blocked the same way: is_pool_creator loads the pool through
                    PoolAccountLoader (access_control.rs:35-40) and each handler re-binds the vaults/config.
[PARTIAL]   AC-015: The admin role is a hard-coded 2-entry allowlist compiled into the binary
                    (admin/auth.rs:6-9). That is a clear, auditable definition, but it is also immutable without a
                    program upgrade — there is no rotation path (see OPS-078) — and the `local` feature replaces it
                    with an unconditional true.
                    File: admin/auth.rs:19-22 — see F-004
[PASS]      AC-016: Admin powers are narrow and cannot touch funds: create/close Operator accounts and close legacy
                    ClaimFeeOperator accounts (lib.rs:35-53). Admin cannot move tokens, cannot change any config,
                    cannot pause (there is nothing to pause — F-006), and cannot claim fees. Protocol fees are
                    claimable only by the protocol-fee-program PDA (ix_claim_protocol_fee2.rs:41-42) and pool-creation
                    fees only to the hard-coded treasury (ix_claim_protocol_pool_creation_fee.rs:26-30).
[PASS]      AC-017: No superadmin or god-mode path. Every instruction's authority is one of the six roles at AC-011;
                    no branch bypasses a check based on a pubkey comparison outside admin/auth.rs and const_pda.rs.
[PASS]      AC-018: The partner cannot impersonate a creator: the creator paths compare against pool.creator, which
                    is written once at init from the `creator: Signer` (ix_initialize_virtual_pool_with_spl_token.rs:262)
                    and changed only by transfer_pool_creator, itself gated on the current creator.
[PASS]      AC-019: The creator cannot impersonate the partner: the partner paths compare against config.fee_claimer,
                    which is immutable after create_config (no update_config instruction exists).
[PASS]      AC-020: A partner's authority is scoped to their own config, and each pool is bound to exactly one config
                    by pool.config, re-checked on every partner path
                    (ix_claim_partner_trading_fee.rs:95-98 · ix_withdraw_partner_surplus.rs:60-63 ·
                    ix_claim_partner_pool_creation_fee.rs:35-38).
[PASS]      AC-021: A creator's authority is scoped to their own pool via pool.creator; no creator instruction takes
                    a second pool or a cross-pool account.
[PASS]      AC-022: Partner and creator cannot reach trader funds. The curve's quote is withdrawable only by walking
                    the curve back down (a swap anyone can do) or by the surplus mechanism, which pays only the
                    portion above migration_quote_threshold and is one-shot per role
                    (state/virtual_pool.rs:1130-1178). Fee claims are capped by the accumulated fee counters
                    (:1091-1113). (The transfer-hook exceptions are F-001/F-002.)
[PASS]      AC-023: Fee caps are enforced on-chain at config creation: base fee ≤ MAX_FEE_NUMERATOR (99 %) and
                    ≥ MIN_FEE_NUMERATOR (0.25 %) (base_fee/fee_scheduler.rs:87-94), total fee capped at
                    MAX_FEE_NUMERATOR after the dynamic component (state/config.rs:129-134),
                    creator_trading_fee_percentage ≤ 100 (process_create_config.rs:388-391),
                    migration_fee_percentage ≤ 99 and creator_fee_percentage ≤ 100 (:81-98),
                    migrated_pool_fee_bps in [10,1000] (:147-151), pool_creation_fee in
                    [0.001 SOL, 100 SOL] when non-zero (:475-481).
[PASS]      AC-024: Fees cannot be changed after the fact — PoolConfig has no setter; there is no update_config
                    instruction in lib.rs. Each pool is permanently bound to the config it was created from.
[PASS]      AC-025: Protocol fee destinations are fixed, not chosen: the pool-creation fee goes only to
                    `address = treasury::ID` (ix_claim_protocol_pool_creation_fee.rs:26-30) and the trading-fee
                    claim is callable only by the protocol-fee-program PDA, which validates the receiver
                    (ix_claim_protocol_fee2.rs:15, :41-42, :45-73).
[PASS]      AC-026: treasury::ID is a compile-time constant (admin/auth.rs:12-17) documented with its Squads URL;
                    there is no instruction that can change it.
[PASS]      AC-027: A protocol minimum is enforced structurally: PROTOCOL_FEE_PERCENT = 20 % of every trading fee and
                    PROTOCOL_POOL_CREATION_FEE_PERCENT = 10 % of the creation fee are constants
                    (constants.rs:94-99) applied in split_fees / split_pool_creation_fee
                    (state/config.rs:203-219, :1035-1044) — a partner cannot set them to zero. MIN_FEE_BPS = 25
                    (constants.rs:81) floors the trading fee itself.
[PASS]      AC-028: Creatorship transfer is explicit, self-gated and lifecycle-restricted: transfer_pool_creator
                    requires the current creator's signature, forbids a no-op (`new_creator != creator`), and only
                    permits PreBondingCurve or a fully-settled CreatedPool state
                    (creator/ix_transfer_pool_creator.rs:23-25, :40-90). Config ownership is never transferable.
[PASS]      AC-029: Whitelist management (TokenBadge) is operator-gated with distinct permission bits for create and
                    close (lib.rs:63-71, state/operator.rs:20-25), and the bitmask is validated on issue
                    (`permission > 0 && <= bitmask_max(VARIANT_COUNT)`, ix_create_operator_account.rs:39-43,
                    utils/bits.rs:2-8, covered by tests/test_operator_permission.rs).
[FAIL-4]    AC-030: No pause mechanism exists — no flag in PoolState/PoolConfig, no instruction in lib.rs.
                    File: lib.rs:31-315 (program-wide) — see F-006
                    Impact: no way to stop value movement during an incident.
                    Fix: add an operator-gated pause flag gating the swap engine while leaving exits open.
[N/A]       AC-031: No pause mechanism to attribute — see AC-030.
[N/A]       AC-032: No pause mechanism to evaluate — see AC-030.
[N/A]       AC-033: No pause mechanism — see AC-030.
[N/A]       AC-034: No pause mechanism — see AC-030.
[FAIL-4]    AC-035: Confirmed absence of an emergency stop on a mainnet program custodying user funds.
                    File: lib.rs:31-315 — see F-006
                    Impact: incident response is limited to a program upgrade.
                    Fix: as AC-030.
[PASS]      AC-036: The program's own mints cannot be frozen: base mints are created by the program and Anchor's
                    `init` leaves freeze_authority = None (ix_initialize_virtual_pool_with_spl_token.rs:62-70 ·
                    ix_initialize_virtual_pool_with_token2022.rs:36-46 — no mint::freeze_authority is specified).
                    The quote-mint exposure is F-005 / AV-065.
[PASS]      AC-037: Base-mint authority is pool_authority at creation and is revoked before the pool goes live for
                    SPL (`AuthorityType::MintTokens → None`, ix_initialize_virtual_pool_with_spl_token.rs:230-242)
                    and for non-hook Token-2022 (process_initialize_…_token2022.rs:145-167 with the
                    require!(is_none()) at :148-153). The transfer-hook exception is F-002 / AV-064.
[PASS]      AC-038: No freeze authority is ever set on a program-created mint — see AC-036.
[PASS]      AC-039: PDA front-running is not possible. Pool and vault PDAs are seeded on base_mint, which is itself
                    `init, signer` — a fresh keypair the attacker cannot predict
                    (ix_initialize_virtual_pool_with_spl_token.rs:62-105). Config accounts are keypair accounts with
                    `signer` required (ix_create_config.rs:13-19). Cross-ref KV-026, KV-127.
[N/A]       AC-040: There are no per-user position accounts to create — see AV-039.
[PARTIAL]   AC-041: A trader cannot block another trader's exit through shared program state, but a partner-chosen
                    transfer-hook program can block every exit on its own pool.
                    File: instructions/partner/create_config/ix_create_transfer_hook_config.rs:59-66 — see F-001.
                    A quote mint with a freeze authority or a mutable transfer-fee authority can do the same
                    (F-005). Both are third-party-authority risks, not shared-state manipulation.
[PASS]      AC-042: No instruction closes an account belonging to another user. The three `close =` handlers are
                    admin- or operator-gated and target protocol capability records, not user accounts
                    (AV-025).
[PASS]      AC-043: Replay is prevented by Solana's recent-blockhash rule, and every one-shot economic action is
                    additionally flag-guarded on-chain: is_partner/creator/protocol_withdraw_surplus
                    (state/virtual_pool.rs:1168-1178), is_withdraw_leftover (:1180-1182),
                    migration_fee_withdraw_status bits (:1184-1189), creation_fee_bits (:1219-1241),
                    and the MigrationProgress enum for the migration chain.
[PASS]      AC-044: On-chain rate limiting exists in two forms — the (now deprecated) FeeRateLimiter, which prices
                    size-based sniping and additionally forbids multiple swaps on the same pool in one transaction
                    (process_swap.rs:201-212, :432-498), and the fee scheduler's time decay
                    (base_fee/fee_scheduler.rs:64-74).
[PASS]      AC-045: Spam-init is self-limiting: the spammer pays all rent (payer = their own key on every init) and,
                    where the partner configured one, the pool_creation_fee. No shared or global account grows with
                    the number of pools, so there is no state-bloat amplification against the protocol.
[PASS]      AC-046: No instruction leaves an authority context usable by a later instruction; every handler
                    re-derives its authority from account state within its own execution
                    (access_control.rs:8-54) and Solana's signer privileges do not persist across instructions.
[PASS]      AC-047: The three closable accounts are not read after close in the same transaction, and Anchor 1.0's
                    close zeroes the data and reassigns the owner, so a later instruction would fail the owner
                    check. See AV-056/AV-057.
[PARTIAL]   AC-048: DBC signs external CPIs with pool_authority, so a callee could in principle re-enter. Direct
                    re-entry into a DBC handler is contained — state is written before every CPI (RE-001) and the
                    outstanding RefMut borrows make a same-account re-entry fail on borrow — and the lamport/owner
                    invariant wrapper closes the SOL-siphon path (utils/cpi_checker.rs:4-32). What remains is that
                    the transfer-hook program is an untrusted callee receiving pool_authority's signature
                    (F-001), and the legacy DAMM v1 path forwards unconstrained program accounts (F-012).
[PARTIAL]   AC-049: There is no explicit re-entrancy guard (no flag, no depth counter). The protection is structural:
                    pool and config borrows are dropped only after all state writes (process_swap.rs:269-270), the
                    reserves are consistent at the moment the hook runs, and a re-entrant swap operates on
                    already-updated state — the outer transfer then simply fails if the vault is short. The rate
                    limiter additionally rejects stack height > 2 (process_swap.rs:446-449). Analysed in full; no
                    profitable re-entrant sequence was found. Cross-ref KV-003.
                    Improvement: an explicit in-progress flag on PoolState would make the property local rather than
                    emergent.
[PASS]      AC-050: invoke_signed seeds cannot be replicated by another program: pool_authority = PDA(["pool_authority"],
                    DBC program id) with a compile-time canonical bump (const_pda.rs:4-14), and the base-locker seeds
                    include the pool key (macros.rs:8-12). PDAs are program-scoped by construction, so no other
                    program can sign for them.
```

**Checklist 02 tally — PASS 35 · FAIL 2 · PARTIAL 5 · N/A 8 = 50**

### Checklist 03 — Arithmetic Safety (AR-001 → AR-063)

```
[PASS]      AR-001: All additions on value-bearing data use safe_add, which returns PoolError::MathOverflow with a
                    #[track_caller] log line rather than wrapping (math/safe_math.rs:22-32, impls at :109-119 for
                    u8/u16/u32/u64/u128/usize/i32/i64/i128/U256/U512). Verified across the fee accumulators
                    (state/virtual_pool.rs:960-977), the metrics (:227-243) and the curve walkers (:411, :502).
[PASS]      AR-002: All subtractions use safe_sub — including the ones that are the real guards, e.g.
                    quote_reserve.safe_sub(actual_output_amount) (state/virtual_pool.rs:990),
                    base_reserve.safe_sub(actual_output_amount) (:993), get_total_surplus (:1130-1132), and the
                    leftover computation (withdraw_leftover.rs:93-98).
[PASS]      AR-003: All multiplications use safe_mul or are performed in U256/U512 where the product provably fits
                    (utils_math.rs:25, :46; u128x128_math.rs:74-97 widens to U512 before the divide).
[PASS]      AR-004: All divisions use safe_div (checked_div → None on a zero divisor) or ruint's checked_div /
                    div_ceil on a value proven non-zero. utils_math.rs:28-34, :49-55 · u128x128_math.rs:46-71
[FAIL-4]    AR-005: One function deliberately opts out of the crate's own checked helpers and uses raw ruint
                    operators, and ruint's Sub asserts (panics) on underflow rather than returning an error.
                    File: base_fee/fee_rate_limiter.rs:154-162 ("because we all calculate in U256, so it is safe to
                    avoid safe math", :248)
                    Impact: `y * y - four * x * z` can underflow for legacy rate-limiter configs, aborting the
                    program instead of returning PoolError. DoS of exact-out/partial-fill swaps in one amount band.
                    Fix: use the U256 SafeMath impl that already exists (math/safe_math.rs:118). See F-009.
[PASS]      AR-006: The three saturating operations are all outside the value path and each is justified in-code:
                    a timestamp delta for the volatility decay window (state/fee.rs:87-90, with the rationale
                    written out), a vesting cliff timestamp (process_create_config.rs:275-276), and the flash-rent
                    consumed-lamports delta (flash_rent.rs:16). None can silently cap a token amount.
[PASS]      AR-007: No wrapping_add / wrapping_sub / wrapping_mul anywhere in the program. The two overflowing_shr
                    uses are on U256/u128 right-shifts where the shift is a compile-time constant well below the
                    width (u128x128_math.rs:40, curve.rs:126, utils_math.rs:93, fee_math.rs:28).
[PASS]      AR-008: Constant-only arithmetic is confined to compile-time contexts and is asserted: every size and
                    fee-identity constant is pinned with const_assert / const_assert_eq
                    (constants.rs:43, :49, :53-56, :66, :84-92 and the ten layout asserts listed at AV-040).
[PASS]      AR-009: `space = 8 + T::INIT_SPACE` throughout — compile-time values, each pinned by a const_assert_eq.
                    See AV-040.
[PASS]      AR-010: Every multiply-then-divide widens first: safe_mul_div_cast_u64 promotes both u64 operands to
                    u128 before the product (utils_math.rs:19-37), safe_mul_div_cast_u128 promotes u128 to U256
                    (:40-58), and mul_div_u256 promotes U256 to U512 (u128x128_math.rs:74-97).
[N/A]       AR-011: No share issuance — DBC is a bonding curve, not a share-based vault. See AV-039.
[PASS]      AR-012: All fee math is widened: get_excluded_fee_amount and get_included_fee_amount route through
                    safe_mul_div_cast_u64 (state/config.rs:174-201), and the rate limiter computes in U256
                    (fee_rate_limiter.rs:234-277).
[PASS]      AR-013: Every proportional split is widened and checked — split_fees / get_fee_on_amount
                    (state/config.rs:139-219), split_partner_and_creator_fee (:1014-1033),
                    split_pool_creation_fee (:1035-1044), get_liquidity_distribution (:951-1012),
                    get_migration_fee_distribution (:860-874), get_partner_and_creator_surplus
                    (state/virtual_pool.rs:1134-1142).
[PASS]      AR-014: Downcasts are explicit and fallible — SafeCast::safe_cast (math/safe_math.rs:121-147),
                    u64::try_from(...).map_err(TypeCastFailed) (curve.rs:43, :90; config.rs:889; params/fee_parameters.rs:186, :193),
                    and T::from_u128(...).ok_or(TypeCastFailed) (utils_math.rs:14-15, :36, :67-68).
[PASS]      AR-015: No `as u64` truncation of a u128 anywhere in the program; every narrowing goes through
                    try_into/try_from/from_u128 with an error on overflow. See AR-014.
[PASS]      AR-016: No `as u32` truncation of a u64. The one u64→u16 narrowing is checked
                    (base_fee/fee_scheduler.rs:56, damm_v2_utils.rs:250).
[PASS]      AR-017: No `as i64` cast of a u64. The only signed value is Clock's unix_timestamp, which is cast the
                    other way (`as u64`, process_swap.rs:230) — see AR-061.
[PASS]      AR-018: Divisors are either constants (100, FEE_DENOMINATOR, MAX_BASIS_POINT), proven non-zero by a
                    config-time require!, or routed through checked_div. Specifically: fee_increment_numerator in
                    get_max_index is non-zero because is_zero_rate_limiter short-circuits and
                    is_non_zero_rate_limiter is required at validate (fee_rate_limiter.rs:65-79, :300-307);
                    period_frequency == 0 is an early return (fee_scheduler.rs:65-67);
                    curve[i].liquidity == 0 breaks/continues before use (state/virtual_pool.rs:387-388, :477-479).
[N/A]       AR-019: No share pricing — see AR-011.
[N/A]       AR-020: No share-proportion withdrawal — see AR-011.
[PASS]      AR-021: Truncation-to-zero is handled where it matters. The trading fee rounds UP
                    (state/config.rs:178-183), so a non-zero trade always pays a non-zero fee. Liquidity-per-period
                    truncating to zero is explicitly detected and converted to a cliff-only lock
                    (state/config.rs:684-697). Zero-amount swaps are rejected outright (process_swap.rs:172).
[PASS]      AR-022: Rounding favours the protocol on every input path: the fee rounds up
                    (state/config.rs:178-183 Rounding::Up), the required input on exact-out rounds up
                    (get_delta_amount_base_unsigned(..., Rounding::Up) at virtual_pool.rs:409, :421, :455;
                    get_delta_amount_quote_unsigned(..., Rounding::Up) at :500, :512), and the next price on
                    base-in rounds up so the price drops less (curve.rs:234-250).
[PASS]      AR-023: Rounding favours the protocol on every output path too (a bonding curve has no redemption side
                    to favour the user on): output amounts round DOWN
                    (get_delta_amount_quote_unsigned(..., Rounding::Down) at virtual_pool.rs:798, :810, :847;
                    get_delta_amount_base_unsigned(..., Rounding::Down) at :895, :907) and the next price on
                    quote-in rounds down so less base is released (curve.rs:266-277). All four directions were
                    walked; no direction rounds toward the trader.
[PASS]      AR-024: Dust accumulation is not profitable. Each swap pays a fee rounded up with a floor of
                    MIN_FEE_NUMERATOR = 0.25 % (constants.rs:81-82), zero-amount swaps revert
                    (process_swap.rs:172), and every price step rounds toward the pool (AR-022/AR-023), so a
                    round-trip of N tiny swaps strictly loses value. Exercised by
                    tests/test_swap.rs:241-292 (10 000 randomised swaps; note the missing assert at FV-002).
[N/A]       AR-025: No first-depositor share pricing — the initial price is the partner's sqrt_start_price, fixed in
                    the config before any trade. See ECON-013.
[N/A]       AR-026: No share minting formula — see AR-011.
[N/A]       AR-027: No zero-supply share ratio — see AR-011.
[N/A]       AR-028: No share burning formula — see AR-011.
[PASS]      AR-029: Slippage protection on the buy side: `require!(swap_result.output_amount >= minimum_amount_out,
                    ExceededSlippage)` for exact-in (swap/swap_exact_in.rs:29-32) and partial-fill
                    (swap_partial_fill.rs:28-31), and `require!(included_fee_input_amount <= maximum_amount_in)`
                    for exact-out (swap_exact_out.rs:31-34).
[PASS]      AR-030: Same guard on the sell side — the checks at AR-029 are direction-agnostic and apply to
                    BaseToQuote identically.
[PASS]      AR-031: Donation cannot dilute anyone. Pricing is a function of sqrt_price and the configured curve, not
                    of vault balances (state/virtual_pool.rs:765-938), so donating tokens to a vault changes no
                    price. The only balance reads are the solvency check at completion (process_swap.rs:344-354),
                    the leftover computation (withdraw_leftover.rs:93-98) and the migration deltas
                    (migrate_damm_v2_initialize_pool.rs:664-676) — a donation there is strictly protocol-favourable.
                    Cross-ref KV-017.
[PASS]      AR-032: No withdrawal can reduce the value of others' holdings: quote exits are either curve swaps
                    (priced by the curve) or one-shot surplus/fee claims bounded by their own counters
                    (state/virtual_pool.rs:1091-1113, :1130-1166).
[N/A]       AR-033: No share supply invariant — see AR-011.
[N/A]       AR-034: No shares mint — see AR-011.
[N/A]       AR-035: No management (AUM-based) fee in this protocol.
[N/A]       AR-036: No performance fee in this protocol.
[PASS]      AR-037: The platform/protocol fee is exact and checked: protocol_fee = floor(trading_fee × 20 / 100) and
                    the remainder is the partner/creator fee, so the two always sum to the input
                    (state/config.rs:203-219, PROTOCOL_FEE_PERCENT at constants.rs:94).
[PASS]      AR-038: Fee splits conserve exactly by construction — every split computes one side with floor division
                    and derives the other by safe_sub from the same total: split_fees (config.rs:203-219),
                    get_fee_on_amount (:139-172), split_partner_and_creator_fee (:1014-1033),
                    split_pool_creation_fee (:1035-1044), get_migration_fee_distribution (:860-874),
                    get_protocol_surplus (virtual_pool.rs:1162-1166). No rounding residue is created or lost.
[PASS]      AR-039: Fee bps ceilings are enforced: MAX_FEE_BPS = 9900 / MAX_FEE_NUMERATOR = 990 000 000, tied by a
                    const_assert_eq (constants.rs:75-87), checked at config time
                    (fee_scheduler.rs:89-94, fee_rate_limiter.rs:294-298, :326-331) and re-capped at swap time
                    (state/config.rs:129-134).
[PASS]      AR-040: Minimum fee is enforced: MIN_FEE_BPS = 25 / MIN_FEE_NUMERATOR = 2 500 000 (constants.rs:81-82),
                    required both at config time (fee_scheduler.rs:91-94) and again at pool-init time
                    (validate_min_base_fee, ix_initialize_virtual_pool_with_spl_token.rs:173 ·
                    process_initialize_…_token2022.rs:55).
[PASS]      AR-041: Fee ordering is explicit per collect-fee mode and consistent between the forward and inverse
                    solvers: FeeMode::get_fee_mode decides fees_on_input/fees_on_base_token once
                    (state/fee.rs:120-145), and each swap-mode path applies it in the same order
                    (virtual_pool.rs:273-375 exact-out, :533-629 exact-in, :631-763 partial-fill).
[PASS]      AR-042: No compounding of fees on fees. Fee counters are accumulated separately from the reserves
                    (apply_swap_result, virtual_pool.rs:960-994) and claims subtract from those counters, never from
                    the curve reserves; the surplus is computed from quote_reserve, which already excludes fees.
[PASS]      AR-043: Zero-amount transfers are avoided rather than attempted: `if token_base_amount > 0`
                    (ix_claim_partner_trading_fee.rs:118, ix_claim_creator_trading_fee.rs:102),
                    `if amount == 0 { return Ok(()) }` (ix_claim_protocol_fee2.rs:131-133),
                    `if swap_result.referral_fee > 0` (process_swap.rs:314), `if burnable_amount > 0`
                    (migrate_damm_v2_initialize_pool.rs:751), `if protocol_fee > 0`
                    (ix_claim_protocol_pool_creation_fee.rs:61).
[N/A]       AR-044: No NAV concept — the pool has no basket of positions to value.
[N/A]       AR-045: No NAV — see AR-044.
[N/A]       AR-046: No NAV — see AR-044.
[N/A]       AR-047: No NAV attestation — price is the on-curve sqrt_price, not an attested value.
[N/A]       AR-048: No NAV — see AR-047.
[N/A]       AR-049: No NAV attestation PDA — see AR-047.
[N/A]       AR-050: No NAV staleness concept — see AR-047.
[PASS]      AR-051: All lamport values are u64 end to end — pool_creation_fee (state/config.rs:576-577),
                    FLASH_RENT_FUND (constants.rs:12), and the transfer helpers
                    (utils/token.rs:269-317). No narrowing occurs.
[PASS]      AR-052: The one path that removes lamports from a program account re-asserts rent-exemption afterwards:
                    transfer_lamports_from_pool_account computes Rent::get()?.minimum_balance(8 + PoolState::INIT_SPACE)
                    and requires the remaining balance to cover it (utils/token.rs:301-317).
[PASS]      AR-053: Rent exemption is preserved on every lamport move — see AR-052 for the withdrawal side and
                    update_account_lamports_to_minimum_balance (utils/token.rs:269-285) for the top-up side, which
                    is used after the Token-2022 metadata write grows the mint account.
[PASS]      AR-054: No instruction can drain an account below rent exemption without closing it — the two pool-creation
                    fee claims are the only lamport withdrawals and both go through transfer_lamports_from_pool_account
                    (ix_claim_protocol_pool_creation_fee.rs:62-66 · ix_claim_partner_pool_creation_fee.rs:48-52).
[N/A]       AR-055: No WSOL wrap/unwrap logic — see AV-051.
[PASS]      AR-056: u64::MAX inputs are handled: amount_0 = u64::MAX on a swap either resolves through the curve
                    walk and reverts with InsufficientLiquidity (exact-in, virtual_pool.rs:596) or partially fills;
                    the rate limiter's config-time validation explicitly probes
                    get_fee_numerator_from_included_fee_amount(u64::MAX) (fee_rate_limiter.rs:327) and
                    get_checked_amounts handles the U256-overflow branch (:85-101). The untested top band of the
                    *inverse* solver is F-009 / FV-029.
[PASS]      AR-057: Zero amounts are rejected at the entry point: `require!(amount_0 > 0, PoolError::AmountIsZero)`
                    (process_swap.rs:172). Zero fee/claim/burn amounts short-circuit — see AR-043.
[PASS]      AR-058: One-unit inputs behave correctly: the fee rounds up so a 1-unit trade still pays a fee
                    (config.rs:178-183) and the curve output rounds down, so the trade is either a strict loss to
                    the trader or reverts on slippage — never a free extraction. See AR-024.
[N/A]       AR-059: No share accounting, so no "last share" edge case — see AR-011.
[N/A]       AR-060: No batch-investor operation exists; every instruction touches one pool.
[PASS]      AR-061: Timestamp handling is safe. unix_timestamp (i64) is cast to u64 once at
                    process_swap.rs:230 / migrate_damm_v2_initialize_pool.rs:499 / ix_create_config.rs:41 — a
                    negative value is impossible post-genesis, and the only elapsed-time subtraction uses
                    saturating_sub with a written rationale (state/fee.rs:87-90). The scheduler's
                    current_point − activation_point uses safe_sub (fee_scheduler.rs:69-71), and activation_point is
                    set from the same clock at pool init, so it can never exceed current_point.
[PASS]      AR-062: Composite fee components are nested splits of one pot, so they cannot sum past 100 % by
                    construction: trading_fee is carved from the trade, protocol_fee = 20 % of trading_fee,
                    referral_fee = 20 % of protocol_fee, creator_fee = creator_trading_fee_percentage % of the
                    partner/creator remainder — each derived by safe_sub from its parent
                    (state/config.rs:139-219, :1014-1033). The total is additionally capped at MAX_FEE_NUMERATOR
                    after the dynamic component (:129-134). Cross-ref KV-128.
[PASS]      AR-063: No floating point anywhere in the program — zero occurrences of f32/f64/powf/powi/sqrt outside
                    #[cfg(test)] modules. Exponential fee decay is fixed-point Q64.64 (fee_math.rs:13-201) and the
                    integer square root is a binary-digit algorithm on U256 (utils_math.rs:74-96). Cross-ref KV-128.
```

**Checklist 03 tally — PASS 41 · FAIL 1 · PARTIAL 0 · N/A 21 = 63**

### Checklist 04 — CPI & PDA Safety (CPI-001 → RE-007)

```
[PASS]      CPI-001: Every CpiContext::new passes a Pubkey as the first argument (Anchor 1.0 form), e.g.
                    `CpiContext::new(self.amm_program.key(), …)` (migrate_damm_v2_initialize_pool.rs:351-352).
                    No .to_account_info() first argument remains anywhere.
[PASS]      CPI-002: Same for CpiContext::new_with_signer — 20 call sites, all passing `.key()`:
                    utils/token.rs (via raw invoke), ix_initialize_virtual_pool_with_spl_token.rs:218-219, :232-233 ·
                    process_initialize_…_token2022.rs:78, :95-96, :112-113, :133-134, :157-158 ·
                    process_swap.rs:417-418 · create_locker.rs:117-118 ·
                    migrate_damm_v2_initialize_pool.rs:167-168, :202-203, :264-265, :287-288, :334-335, :380-381 ·
                    migrate_meteora_damm_initialize_pool.rs:163-165, :295-296 · meteora_damm_claim_lp_token.rs:57-58 ·
                    meteora_damm_lock_lp_token.rs:83-84
[PASS]      CPI-003: The token program is always type- or address-constrained: Program<'info, Token>
                    (ix_initialize_virtual_pool_with_spl_token.rs:139, migrate_meteora_damm_initialize_pool.rs:110),
                    Program<'info, Token2022> (ix_initialize_virtual_pool_with_token2022.rs:107), or
                    Interface<'info, TokenInterface> (swap/ix_swap.rs:53-56), which Anchor restricts to the two
                    SPL token program ids. transfer_checked is built against `token_program.key`
                    (utils/token.rs:69-70, :126-127).
[PASS]      CPI-004: System program is Program<'info, System> in every context that uses it
                    (ix_create_config.rs:31, ix_initialize_virtual_pool_with_spl_token.rs:142, create_locker.rs:67,
                    migrate_damm_v2_initialize_pool.rs:125, ix_create_operator_account.rs:32, …).
[PARTIAL]   CPI-005: The Associated Token Program is typed nowhere. It is not needed in the paths that enforce ATAs
                    declaratively (Anchor derives the address itself — withdraw_leftover.rs:27-31,
                    meteora_damm_claim_lp_token.rs:27-39), but the legacy DAMM v1 migration passes it as a bare
                    UncheckedAccount into the CPI.
                    File: migration/meteora_damm/migrate_meteora_damm_initialize_pool.rs:112-113 — cross-ref F-012
                    Improvement: type it Program<'info, AssociatedToken>.
[N/A]       CPI-006: No DEX-aggregator CPI. DBC is itself the venue; it never routes through Jupiter or similar.
[FAIL-3]    CPI-007: The Metaplex program is address-constrained in the SPL pool-init path
                    (`address = mpl_token_metadata::ID`, ix_initialize_virtual_pool_with_spl_token.rs:129-130) but
                    not in the DAMM v1 migration path, where it is forwarded into a pool_authority-signed CPI.
                    File: migration/meteora_damm/migrate_meteora_damm_initialize_pool.rs:99-100 (forwarded at :186)
                    Impact: an attacker-chosen "metadata program" executes inside a CPI chain in which
                    pool_authority is a signer; the lamport/owner invariant wrapper bounds but does not eliminate it.
                    Fix: add `#[account(address = mpl_token_metadata::ID)]`. See F-012.
[PARTIAL]   CPI-008: The programs DBC actually invokes are all address-constrained — amm_program
                    (`address = damm_v2::ID` at migrate_damm_v2_initialize_pool.rs:84-85;
                    `address = dynamic_amm::ID` at migrate_meteora_damm_initialize_pool.rs:103-104),
                    locker_program (`address = locker::ID`, create_locker.rs:60-61), the token programs (CPI-003)
                    and Metaplex in the init path. The gap is the *forwarded* programs in the DAMM v1 context
                    (metadata_program, vault_program, associated_token_program, rent).
                    File: migrate_meteora_damm_initialize_pool.rs:93-113 — see F-012
[PASS]      CPI-009: The only remaining-account-driven CPI target is the transfer hook, and it is read from the mint
                    account's own extension rather than from the caller
                    (get_transfer_hook_program_id, utils/token.rs:46-56, used at :87 and :144). The DAMM v2 config
                    supplied in remaining_accounts is data, not a program.
[PASS]      CPI-010: The three raw invoke_signed sites build their Instruction locally against an already-constrained
                    program id: transfer_checked against `token_program.key` (utils/token.rs:126-135, :167),
                    the transfer-hook `update` instruction against `token_program.key()`
                    (process_swap.rs:398-413), and the Metaplex builders against the address-constrained
                    metadata_program (process_create_token_metadata.rs:25-27, :49, :58-65).
[PASS]      CPI-011: Transfer sources are always the bound account — the pool's own vault
                    (re-bound by pool.base_vault/quote_vault == key, see AV-047) for outbound transfers, and the
                    caller's own signed token account for inbound (utils/token.rs:58-66 takes
                    `authority: &Signer`).
[PASS]      CPI-012: Transfer destinations are constrained per path: the config's leftover_receiver ATA
                    (withdraw_leftover.rs:27-31), the recorded partner/creator ATA
                    (meteora_damm_claim_lp_token.rs:35-39 with the owner check at :84-92), the protocol-fee
                    program's validated receiver (ix_claim_protocol_fee2.rs:45-73), or — for fee claims — an account
                    of the authenticated claimer's own choosing, which is by design.
[PASS]      CPI-013: The authority is pool_authority for every outbound transfer, signed with the canonical seeds
                    (utils/token.rs:115-170) and address-constrained in the account struct
                    (`address = const_pda::pool_authority::ID`).
[PASS]      CPI-014: Transfer amounts are always program-computed: swap_result.output_amount / referral_fee
                    (process_swap.rs:297, :308, :324, :334), the fee counters' claim results
                    (state/virtual_pool.rs:1091-1113), the surplus formulas (:1130-1166), the migration-fee
                    distribution (state/config.rs:860-874) and the leftover computation
                    (withdraw_leftover.rs:93-98). No caller-supplied amount is transferred directly; `max_amount`
                    arguments only cap a computed value via `.min()`.
[PASS]      CPI-015: mint_to targets the freshly created base mint, which is `init` in the same instruction
                    (ix_initialize_virtual_pool_with_spl_token.rs:62-70, :217-228 ·
                    process_initialize_…_token2022.rs:132-143) — it cannot be attacker-supplied.
[PASS]      CPI-016: mint_to's destination is the PDA-derived base_vault created in the same instruction
                    (`seeds = ["token_vault", base_mint, pool]`, ix_initialize_virtual_pool_with_spl_token.rs:93-106).
[PASS]      CPI-017: mint_to's authority is pool_authority, signed with the canonical seeds
                    (ix_initialize_virtual_pool_with_spl_token.rs:216-226).
[PASS]      CPI-018: The minted amount is config.get_initial_base_supply() — derived from the immutable config, not
                    from any instruction argument (state/config.rs:907-929, called at
                    ix_initialize_virtual_pool_with_spl_token.rs:175 and process_initialize_…_token2022.rs:128).
[PASS]      CPI-019: The one burn is from the program's own base_vault (migrate_damm_v2_initialize_pool.rs:753-764 ·
                    migrate_meteora_damm_initialize_pool.rs:294-305), never from a user account.
[PASS]      CPI-020: The burn authority is pool_authority with canonical seeds — see CPI-019.
[PASS]      CPI-021: The burn amount is config.get_burnable_amount_post_migration(left_base_token), which is
                    min(pre−post supply, actual leftover) for fixed-supply configs and the full leftover otherwise,
                    computed from a reloaded vault balance minus the reserved fees
                    (state/config.rs:931-945, migrate_damm_v2_initialize_pool.rs:737-749).
[N/A]       CPI-022: No token::close_account CPI exists in the program.
[N/A]       CPI-023: No token::close_account — see CPI-022.
[N/A]       CPI-024: No token::close_account — the vaults can never be closed. See CPI-022.
[PASS]      CPI-025: The three system-program transfers have constrained endpoints: payer → pool for the creation fee
                    (utils/token.rs:287-299, called with ctx.accounts.pool), payer → base_mint for the Token-2022
                    rent top-up (:269-285), and borrower → lender inside flash_rent, where the lender is the
                    address-constrained pool_authority (flash_rent.rs:19-23).
[N/A]       CPI-026: No token::approve CPI — the program never delegates.
[N/A]       CPI-027: No token::revoke CPI — see CPI-026.
[PASS]      PDA-001: Full seed sets are used everywhere — see AV-027 for the enumeration.
[PASS]      PDA-002: The pool PDA carries config + both mints in canonical (max,min) order
                    (ix_initialize_virtual_pool_with_spl_token.rs:80-85), which is the DBC analogue of the
                    fund-PDA item and prevents both cross-config and argument-order collisions.
[PASS]      PDA-003: Enumerated: pool_authority ["pool_authority"]; protocol_fee_authority
                    ["protocol_fee_authority"] (foreign program); pool ["pool", config, max_mint, min_mint];
                    vault ["token_vault", mint, pool]; token_badge ["token_badge", mint];
                    operator ["operator", whitelisted_address]; cf_operator ["cf_operator", operator];
                    partner_metadata ["partner_metadata", fee_claimer];
                    virtual_pool_metadata ["virtual_pool_metadata", virtual_pool];
                    meteora ["meteora", virtual_pool]; base_locker ["base_locker", virtual_pool].
                    Prefixes are centralised in constants.rs:110-127.
[PASS]      PDA-004: Seed order is identical at init and at every later reference because the prefixes come from the
                    shared constants module and the derivations are written once per account type; the pool_authority
                    seeds are produced by a single macro (macros.rs:2-6) used at all 12 signing sites.
[PASS]      PDA-005: Both vault PDAs include the pool key (ix_initialize_virtual_pool_with_spl_token.rs:95-99, :111-115).
[N/A]       PDA-006: No mint is a PDA — base mints are caller-supplied fresh keypairs (`init, signer`).
[N/A]       PDA-007: No attestation or oracle PDA exists — see AR-047.
[PASS]      PDA-008: The access-control PDAs include their subject key: operator ["operator", whitelisted_address]
                    (ix_create_operator_account.rs:15-18) and token_badge ["token_badge", token_mint]
                    (ix_create_token_badge.rs:18-21).
[PARTIAL]   PDA-009: Derivations match between init and use for every PDA that is re-derived — but the Operator
                    account is NOT re-derived at its point of use; the two operator-gated instructions accept it as
                    a plain AccountLoader<Operator> with no seeds constraint, relying on
                    operator.whitelisted_address == signer instead.
                    File: operator/ix_create_token_badge.rs:29 · operator/ix_close_token_badge.rs:17 ·
                          operator/ix_claim_protocol_pool_creation_fee.rs:20 (check at access_control.rs:42-54)
                    This is sound today — only the admin can create an Operator account and its contents are fixed
                    at init — but it removes the canonical-address guarantee.
                    Improvement: add `seeds = [OPERATOR_PREFIX, signer.key().as_ref()], bump`.
[PARTIAL]   PDA-010: Bumps are re-derived rather than stored — see AV-028. Correctness is unaffected; the two global
                    authorities avoid the cost via compile-time derivation (const_pda.rs).
[PASS]      PDA-011: No PDA seed uses variable-length user data. Every seed component is a 32-byte Pubkey or a
                    fixed byte-string prefix (constants.rs:110-127); the metadata strings are account *contents*,
                    never seeds.
[N/A]       PDA-012: No name-based PDA — see PDA-011.
[PASS]      PDA-013: No PDA seed uses mutable state. pool seeds use config + mints (both immutable);
                    partner_metadata uses fee_claimer (config-immutable); virtual_pool_metadata and base_locker use
                    the pool key. Note that `pool.creator` IS mutable (transfer_pool_creator) and is correctly NOT
                    used as a seed anywhere.
[PASS]      PDA-014: All 12 invoke_signed/new_with_signer sites use pool_authority_seeds!(BUMP) or
                    base_locker_seeds!(pool, bump) — the macros at macros.rs:2-12 — matching the PDA being signed for.
[PASS]      PDA-015: The signer-seed arrays match the derivations exactly. pool_authority_seeds! expands to
                    `[b"pool_authority", [bump]]`, the same seeds used in const_pda.rs:7-10;
                    base_locker_seeds! expands to `[b"base_locker", virtual_pool, [bump]]`, matching the
                    `seeds = [BASE_LOCKER_PREFIX, virtual_pool.key()]` constraint at create_locker.rs:34-41.
[PASS]      PDA-016: The pool_authority bump is a single compile-time constant derived from the canonical
                    find_program_address equivalent (const_pda.rs:7-13); the locker bump comes from
                    ctx.bumps.base (create_locker.rs:105), i.e. Anchor's canonical bump. No literal or
                    user-supplied bump is used.
[PASS]      PDA-017: invoke_signed (not invoke) is used wherever the PDA is the authority — utils/token.rs:167
                    (vault → user), process_swap.rs:406 (mint hook revoke),
                    process_create_token_metadata.rs:49, :65, and every `new_with_signer` site at CPI-002.
[PASS]      PDA-018: The three bare `invoke` calls are correct: transfer_token_from_user signs with the user's own
                    Signer (utils/token.rs:110), and the two system transfers debit the user/payer, not a PDA
                    (:278-282, :293-297, flash_rent.rs:22).
[PASS]      PDA-019: Instruction data for signed CPIs is fully constructed by DBC from program-derived values — the
                    DAMM v2 InitializePoolParameters/AddLiquidityParameters (migrate_damm_v2_initialize_pool.rs:154-165,
                    :232-236, :404-408), the locker CreateVestingEscrowParameters
                    (process_create_config.rs:271-287 from config state), the token instruction builders
                    (utils/token.rs:69-78, :126-135). No caller-supplied byte blob is forwarded.
[N/A]       PDA-020: No Jupiter CPI — see CPI-006.
[N/A]       PDA-021: No realloc anywhere — see AV-030.
[N/A]       EXT-001: No Jupiter swap CPI — see CPI-006.
[N/A]       EXT-002: No Jupiter swap CPI — see CPI-006. (DBC's own slippage guards are AR-029/AR-030; the
                    unbounded DAMM v2 add_liquidity thresholds are in Notes & Nitpicks.)
[N/A]       EXT-003: No Jupiter swap CPI — see CPI-006.
[N/A]       EXT-004: No Jupiter swap CPI — see CPI-006.
[PASS]      EXT-005: Post-CPI balances are re-read and reconciled where it matters: both vaults reload after pool
                    creation and the deposited deltas are computed and checked against the expected amounts with
                    safe_sub (migrate_damm_v2_initialize_pool.rs:664-676), the base vault reloads before the burn
                    (:737-749), and the completion solvency check reloads before asserting
                    (process_swap.rs:344-354).
[N/A]       EXT-006: No Jupiter program id to validate — see CPI-006.
[PASS]      EXT-007: The Metaplex metadata account is derived by the Metaplex CPI builder itself from the mint
                    (process_create_token_metadata.rs:25-49); DBC passes it as `mint_metadata` and the callee
                    enforces the PDA.
[PARTIAL]   EXT-008: Metaplex's program id is validated in the pool-init path but not in the DAMM v1 migration path
                    — see CPI-007 / F-012.
[PASS]      EXT-009: The whitelist-before-invoke property holds for the programs DBC invokes directly (all
                    address-constrained, CPI-008) and for the DAMM v2 config, which must name pool_authority as its
                    pool_creator_authority (migrate_damm_v2_initialize_pool.rs:490-493). The residual gap in that
                    config check is F-003.
[PASS]      EXT-010: The DAMM v2 config allowlist is effectively owned by the protocol: only a config whose
                    pool_creator_authority equals DBC's own pool_authority PDA is accepted, and that field can only
                    be set by whoever creates the config in DAMM v2.
[PARTIAL]   EXT-011: Privilege escalation through a callee is bounded but not eliminated: pool_authority signs the
                    DAMM v1/v2 and locker CPIs, and the lamport/owner/data-length invariant wrapper
                    (utils/cpi_checker.rs:4-32, applied at create_locker.rs:143-146,
                    migrate_damm_v2_initialize_pool.rs:245-248, :318-321, :377-412,
                    migrate_meteora_damm_initialize_pool.rs:205-208, meteora_damm_lock_lp_token.rs:80-106) closes
                    the SOL-siphon path. The residual surfaces are the untrusted transfer hook (F-001) and the
                    unconstrained forwarded programs in the DAMM v1 context (F-012).
[FAIL-6]    EXT-012: The custodied mint's TransferHook program is NOT allowlisted. Extra accounts are resolved and
                    forwarded correctly (utils/token.rs:92-102, :149-159 via
                    spl_transfer_hook_interface::onchain::add_extra_accounts_for_execute_cpi), so half the item
                    passes, but the hook program itself is an arbitrary executable chosen by the config creator.
                    File: instructions/partner/create_config/ix_create_transfer_hook_config.rs:59-66
                    Impact: the hook can reject every base transfer, freezing the pool and trapping buyers' quote,
                    or allow only the insider's transfers (honeypot).
                    Fix: gate the hook program behind an operator-issued badge, or require it to be non-upgradeable.
                    See F-001.
[PARTIAL]   EXT-013: Of the five extensions this item names, only TransferFee is genuinely inspected
                    (utils/token.rs:172-199) and only for quote mints. PermanentDelegate, DefaultAccountState,
                    MintCloseAuthority and ConfidentialTransfer are excluded only indirectly, by the
                    "metadata extensions only" allowlist for *non-badged* quote mints (:237-243) — a badged mint
                    bypasses that entirely, and freeze_authority is not an extension so it is never seen at all.
                    File: utils/token.rs:218-258 — cross-ref F-005, AV-063
[PASS]      EXT-014: All movement uses transfer_checked with mint + decimals (utils/token.rs:69-78, :126-135), and
                    the paths where the received amount could differ from the declared amount re-read the balance
                    (EXT-005). Fee-on-transfer is additionally forbidden outright for quote mints
                    (validate_transfer_fee_is_zero on all eight quote paths, listed at F-005) and structurally
                    impossible for base mints, which the program creates itself without the extension.
[PASS]      EXT-015: Metadata is claimed atomically in the same instruction that creates the mint, with the
                    authority set deliberately rather than left unclaimed: Metaplex CreateMetadataAccountV3 followed
                    immediately by UpdateMetadataAccountV2 to the configured authority
                    (process_create_token_metadata.rs:21-67), and the Token-2022 equivalent via
                    token_metadata_initialize + metadata-pointer and metadata-update-authority set-authority calls
                    (process_initialize_…_token2022.rs:68-126). TokenAuthorityOption::Immutable maps to
                    is_mutable = false and a None authority (process_create_token_metadata.rs:29, state/config.rs:386-395).
[PASS]      RE-001: Checks-effects-interactions is followed on every value path. In the swap the whole result is
                    applied to pool state and the borrow is dropped BEFORE any transfer
                    (process_swap.rs:256-270, transfers begin at :291). The claim paths mutate the fee counters
                    before transferring (ix_claim_partner_trading_fee.rs:111-115 →:118;
                    ix_claim_creator_trading_fee.rs:96-100 →:102). Migration writes
                    save_protocol_liquidity_migration_fee before creating the pool
                    (migrate_damm_v2_initialize_pool.rs:584-587 →:634).
[PARTIAL]   RE-002: Post-CPI state is re-read where a balance is involved (EXT-005) and the pool is re-loaded after
                    the swap transfers (process_swap.rs:341). The exception is the three surplus/migration-fee
                    withdrawals, which set their one-shot flag AFTER the transfer rather than before.
                    File: ix_withdraw_partner_surplus.rs:81-92 · ix_withdraw_creator_surplus.rs:81-92
                    Not exploitable: the RefMut on the pool is still held across the CPI (so a re-entrant load_mut
                    would fail) and the callee is an Interface-constrained token program, i.e. trusted.
                    Improvement: move update_*_withdraw_surplus() above the transfer for strict CEI.
[PASS]      RE-003: Reloads go through Anchor's `.reload()`, which re-runs the owner and discriminator checks
                    (migrate_damm_v2_initialize_pool.rs:664-665, :737; process_swap.rs:344).
[PASS]      RE-004: No approval is ever granted to an external program — see CPI-026. The transfer-hook CPI passes
                    accounts, not authority.
[N/A]       RE-005: There is no NAV or share price to inflate within a transaction; the curve price is a pure
                    function of accumulated quote. A flash-borrowed buy simply moves along the curve and the
                    matching sell moves back at a strictly worse price (AR-022/AR-023). Cross-ref KV-002.
[PASS]      RE-006: The callee-SOL-spend guard is implemented exactly as this item describes:
                    cpi_with_account_lamport_and_owner_checking snapshots pool_authority's lamports before the CPI
                    and asserts `after >= before` afterwards (utils/cpi_checker.rs:8-21), applied to all six
                    external-CPI sites listed at EXT-011. flash_rent additionally reimburses any legitimate rent
                    consumption from the caller rather than from the protocol (flash_rent.rs:13-23).
[PASS]      RE-007: Post-CPI owner re-verification is implemented: the same wrapper asserts
                    `before_owner == after_owner` and `before_data_len == after_data_len` on pool_authority
                    (utils/cpi_checker.rs:9, :15, :22-29), and every other relied-upon account is either reloaded
                    through Anchor (RE-003) or re-loaded through the owner-checking custom loader
                    (process_swap.rs:341).
```

**Checklist 04 tally — PASS 43 · FAIL 2 · PARTIAL 8 · N/A 17 = 70**

### Checklist 05 — State Machine & Lifecycle (SM-001 → SM-072)

```
[PASS]      SM-001: Five enums govern state. MigrationProgress (state/virtual_pool.rs:83-88) is the lifecycle;
                    CollectFeeMode (:43-48), PoolType (:61-64), BaseFeeMode (state/config.rs:54-61),
                    MigrationOption (:425-430), TokenType (:443-446), MigrationFeeOption (:459-467),
                    TokenAuthorityOption (:371-383), MigratedCollectFeeMode (migration_handler/mod.rs:31-35),
                    SwapMode (swap/process_swap.rs:69-73), ActivationType (utils/activation_handler.rs:20-23) and
                    SenderFlag (ix_withdraw_migration_fee.rs:59-63) are configuration selectors, not lifecycles.
[PASS]      SM-002: MigrationProgress variants: PreBondingCurve (0), PostBondingCurve (1), LockedVesting (2),
                    CreatedPool (3). The intended flows are documented in-code at state/virtual_pool.rs:66-71
                    ("without jup lock: PreBonding → LockedVesting → CreatedPool"; "with jup lock:
                    PreBonding → PostBonding → LockedVesting → CreatedPool").
[PASS]      SM-003: Every variant has an entry transition. PreBondingCurve is the zero-initialised default
                    (PoolState::initialize never writes migration_progress, virtual_pool.rs:246-271).
                    PostBondingCurve and LockedVesting are both set by the completing swap, branching on whether
                    locked vesting is configured (process_swap.rs:359-363). LockedVesting is also reached from
                    PostBondingCurve by create_locker (create_locker.rs:149). CreatedPool is set by either
                    migration handler (migrate_damm_v2_initialize_pool.rs:767 ·
                    migrate_meteora_damm_initialize_pool.rs:315).
[PASS]      SM-004: Every non-terminal variant has an exit. PreBondingCurve → the completing swap;
                    PostBondingCurve → create_locker; LockedVesting → migration. CreatedPool is terminal by design.
[PASS]      SM-005: No dead variants — all four are both written and read (SM-003, and read by
                    get_migration_progress at virtual_pool.rs:1191-1195, used as a guard in six handlers).
[PASS]      SM-006: Variants cannot be set out of band: migration_progress lives inside an Anchor-owned zero-copy
                    account, writable only by this program, and set_migration_progress
                    (virtual_pool.rs:1197-1199) is called from exactly the four sites at SM-003.
[PASS]      SM-007: CreatedPool is the single terminal state and is explicitly documented as the end of both flows
                    (virtual_pool.rs:66-71). Post-terminal actions (leftover withdrawal, LP claim/lock, creator
                    transfer) all require it and none transitions out.
[PARTIAL]   SM-008: Terminal-state accounts are NOT closed — the VirtualPool/TransferHookPool account and both
                    vault accounts persist forever after CreatedPool, with their rent locked.
                    File: lib.rs:31-315 (no close_pool instruction) · the vaults are never closed (CPI-022)
                    This is deliberate — the pool remains the canonical record and the base vault keeps the
                    protocol's unclaimed migration fee — but it means rent is permanently sunk per pool.
                    Improvement: add a permissionless close-pool path once every fee counter and creation-fee bit
                    is zero, returning rent to the creator.
[PASS]      SM-009: The graduation analogue of "initiation": a pool is created in PreBondingCurve with all
                    accounting zeroed by Anchor's `init` and the fields written explicitly by
                    PoolState::initialize (virtual_pool.rs:246-271). No partially-initialised state is reachable.
[PASS]      SM-010: Pool creation requires `creator: Signer` and an existing, immutable config
                    (ix_initialize_virtual_pool_with_spl_token.rs:51-60), and the config's curve/threshold/supply
                    parameters were fully cross-validated at create_config time
                    (process_create_config.rs:369-515, :526-720).
[PASS]      SM-011: The swap engine is restricted to the pre-completion state:
                    `require!(!pool.is_curve_complete(config.migration_quote_threshold), PoolError::PoolIsCompleted)`
                    (process_swap.rs:223-227). Once complete, no further swap can run, so quote_reserve is frozen
                    at its completion value — which is what makes the surplus formula well-defined.
[PASS]      SM-012: The one instruction that accepts two lifecycle states does so deliberately and with per-state
                    preconditions: transfer_pool_creator permits PreBondingCurve unconditionally and CreatedPool
                    only after every DAMM v1 LP claim/lock has settled (creator/ix_transfer_pool_creator.rs:43-90);
                    PostBondingCurve and LockedVesting are rejected by the `_ =>` arm at :89.
[PASS]      SM-013: The intermediate readiness step exists and is create_locker, which moves
                    PostBondingCurve → LockedVesting (create_locker.rs:91-94, :149). It is permissionless, so it
                    cannot be withheld by a privileged party.
[PASS]      SM-014: The readiness instruction is present — see SM-013. Pools with no locked vesting skip it by
                    going straight to LockedVesting at completion (process_swap.rs:359-363).
[PASS]      SM-015: Finalisation (migration) requires the intermediate state, never the initial one:
                    `require!(virtual_pool.get_migration_progress()? == MigrationProgress::LockedVesting)`
                    (migrate_damm_v2_initialize_pool.rs:534-537 · migrate_meteora_damm_initialize_pool.rs:220-223),
                    plus a redundant is_curve_complete check (:539-542 / :227-230).
[PARTIAL]   SM-016: Finalisation does not close anything — rent stays locked. See SM-008.
[PASS]      SM-017: Finalisation moves the value correctly: both reserves are deposited into the destination pool,
                    liquidity is locked/vested per config, the two position NFTs are transferred to partner and
                    creator, the protocol migration fee is recorded, and the residual base is burned
                    (migrate_damm_v2_initialize_pool.rs:632-767).
[N/A]       SM-018: There is no cancellation path — graduation is irreversible by design. Trading "cancels" itself
                    by selling back down the curve while the pool is still live.
[N/A]       SM-019: No cancellation — see SM-018.
[N/A]       SM-020: No cancellation — see SM-018.
[PASS]      SM-021: Concurrency is structurally impossible: each pool has exactly one lifecycle, tracked by one
                    field, and each one-shot economic action carries its own idempotence flag (AC-043).
[N/A]       SM-022: No withdrawal deadline exists; there is nothing that can expire.
[PASS]      SM-023: Nothing can be withheld by a privileged party. Every step past completion is permissionless —
                    create_locker, withdraw_leftover, both migration handlers and both LP handlers take no
                    privileged signer (lib.rs:257-314). The only actor who could stall the chain is the transfer-hook
                    program on a hook pool (F-001).
[PASS]      SM-024: Partial exit is always available while the pool is live: a holder can sell any fraction of their
                    base back into the curve (swap_partial_fill.rs:7-44 even fills partially when the curve runs
                    out), with no minimum beyond amount > 0.
[PASS]      SM-025: Pool creation initialises every field: the three init'd accounts are Anchor-zeroed and
                    PoolState::initialize writes volatility_tracker, config, creator, base_mint, base_vault,
                    quote_vault, sqrt_price, pool_type, activation_point, base_reserve and
                    protocol_liquidity_migration_fee_bps (virtual_pool.rs:246-271). All remaining fields are
                    intentionally zero (fee counters, progress, flags).
[PASS]      SM-026: The identity fields are set correctly and from the right sources — config key from the account,
                    creator from the Signer, mints/vaults from the just-created accounts, sqrt_price from
                    config.sqrt_start_price, activation_point from the clock
                    (ix_initialize_virtual_pool_with_spl_token.rs:255-271).
[PASS]      SM-027: Re-initialisation is impossible — `init` (never init_if_needed) on the pool PDA
                    (:78-89), which fails if the account exists. See AV-053.
[PARTIAL]   SM-028: There is no pool-closure instruction. See SM-008.
[N/A]       SM-029: No closure path, so no settle-before-close precondition to verify — see SM-028.
[N/A]       SM-030: No closure path — see SM-028.
[PARTIAL]   SM-031: Confirmed: pools and their two vaults live forever and their rent is permanently locked.
                    For a launchpad that creates one pool per token this is a real cumulative cost, though it is
                    borne by the pool creator who paid it. See SM-008.
[PASS]      SM-032: Collisions between pools are impossible: the pool PDA is seeded on config + both mints, and the
                    base mint is a fresh `init, signer` keypair, so two pools can never share a PDA
                    (ix_initialize_virtual_pool_with_spl_token.rs:62-89). The (max,min) ordering makes the seed
                    canonical.
[PASS]      SM-033: The deposit analogue (a buy) follows one path: price update → reserves → fee counters →
                    token movement, all in apply_swap_result before any CPI (virtual_pool.rs:940-1000).
[PASS]      SM-034: The buy's accounting is exact: quote_reserve += excluded_fee_input_amount and
                    base_reserve -= (output + fees when fees are on output) (virtual_pool.rs:979-994), with the fee
                    portion simultaneously credited to the three fee counters (:960-977).
[N/A]       SM-035: No position accounts — a trader's position is their SPL token balance. See AV-039.
[N/A]       SM-036: No position tracking — see SM-035.
[N/A]       SM-037: No position closure — see SM-035.
[N/A]       SM-038: No position share field. The reserve fields that play the analogous role cannot underflow —
                    both use safe_sub (virtual_pool.rs:990, :993).
[N/A]       SM-039: No position deposit/withdraw counters — see SM-035.
[N/A]       SM-040: No zero-share position state — see SM-035.
[PASS]      SM-041: Every transition checks its precondition: the completing swap requires !is_curve_complete before
                    running (process_swap.rs:223-227) and re-reads the pool to set progress (:341-375);
                    create_locker requires PostBondingCurve (:91-94); migration requires LockedVesting;
                    withdraw_leftover requires CreatedPool (withdraw_leftover.rs:77-80); the LP handlers require
                    CreatedPool (meteora_damm_claim_lp_token.rs:77-80 · meteora_damm_lock_lp_token.rs:116-119).
[PASS]      SM-042: No state can be skipped. PostBondingCurve is entered only when locked vesting exists, and in
                    that case create_locker is the only way to LockedVesting (create_locker.rs:91-94, :149);
                    migration accepts only LockedVesting, so a vesting pool cannot reach CreatedPool without the
                    escrow having been funded.
[PASS]      SM-043: Transitions are atomic — each is a single field write inside one instruction, and Solana reverts
                    the whole instruction on any later failure.
[PASS]      SM-044: No partial state survives a failure: the migration handler performs all of its CPIs and writes
                    inside one instruction, so a failure anywhere (e.g. the second-position add_liquidity) rolls
                    back the pool creation, the locks, the NFT transfers and the progress write together.
[PASS]      SM-045: Every one-shot transition is replay-guarded — see AC-043 for the full list of flags and bits.
                    The XOR-based setters (update_withdraw_migration_fee at virtual_pool.rs:1187-1189,
                    update_*_pool_creation_fee_claimed at :1225-1241) are always preceded by an eligibility check
                    that the bit is currently 0, so the XOR behaves as a set — verified for all four call sites
                    (ix_withdraw_migration_fee.rs:107-112, :121-126; ix_claim_partner_pool_creation_fee.rs:40-46;
                    ix_claim_protocol_pool_creation_fee.rs:47-59).
[PASS]      SM-046: The three closable PDAs carry no stale association after close — see AV-055/AV-056.
[FAIL-3]    SM-047: Two financial state transitions emit no event at all.
                    File: migration/dynamic_amm_v2/migrate_damm_v2_initialize_pool.rs:769 ("// TODO emit event") ·
                          migration/meteora_damm/migrate_meteora_damm_initialize_pool.rs:317 ("// TODO emit event")
                    Impact: the single highest-value instruction in the program is invisible to log-based indexers
                    and monitoring.
                    Fix: add #[event_cpi] to both contexts and emit a migration event. See F-011.
[PASS]      SM-048: The events that do exist are complete — EvtSwap2 carries the full SwapResult2, both reserves and
                    the threshold (event.rs:120-131); EvtCreateConfigV2 carries the entire ConfigParameters
                    (:56-63); the claim/surplus/leftover/migration-fee events carry amounts and parties
                    (:170-235). Cross-ref SM-047 for the gap.
[PARTIAL]   SM-049: Events are program-emitted and therefore unforgeable in content, and 22 of the 23 event types use
                    emit_cpi! (self-CPI), which an indexer can attribute to this program id. One uses plain emit!
                    with an in-code caveat that the log "could be truncated. should not rely on this".
                    File: operator/ix_claim_protocol_fee2.rs:161-168
                    Improvement: switch it to emit_cpi! like the rest. Cross-ref KV-122.
[PARTIAL]   SM-050: Off-chain reconstruction is possible for the trading phase but breaks at graduation: there is no
                    migration event (SM-047) and no event for the DAMM v1 LP claim/lock handlers
                    (meteora_damm_claim_lp_token.rs · meteora_damm_lock_lp_token.rs emit nothing). An indexer must
                    fall back to polling migration_progress and the metadata flags.
[N/A]       SM-051: No shares mint — see AR-011.
[N/A]       SM-052: No investor positions to sum — see SM-035.
[PASS]      SM-053: Vault-versus-tracking consistency holds and is the protocol's central invariant. Reconstructed
                    and verified in full: quote_vault = quote_reserve + protocol_quote_fee + partner_quote_fee +
                    creator_quote_fee at every point before graduation (apply_swap_result at
                    virtual_pool.rs:960-994 credits input net of fees to quote_reserve and the fee portion to the
                    counters; claims decrement both sides together at :1091-1113). After graduation the four draws
                    — surplus (:1130-1166), migration deposit, migration fee (config.rs:846-874) and the protocol
                    migration fee (:1041-1069) — sum exactly to the vault balance. The base side is enforced
                    explicitly at completion (process_swap.rs:344-354). See `audit_2/checkpoint-02.md`.
[PASS]      SM-054: After every buy both sides move consistently — see SM-034.
[PASS]      SM-055: After every sell: base_reserve += input, quote_reserve -= (output + fees), fee counters += fees
                    (virtual_pool.rs:964-994). Both use safe_add/safe_sub so neither can wrap.
[N/A]       SM-056: There is no separate swap-versus-NAV notion — the swap IS the price mechanism here. See AR-044.
[PASS]      SM-057: No timestamp field uses 0 as a live sentinel. finish_curve_timestamp is written from the real
                    clock at graduation (process_swap.rs:357) and is only read afterwards
                    (create_locker.rs:101-102); activation_point is written from get_current_point at pool init.
                    The vesting cliff is computed as finish_curve_timestamp + cliff_duration
                    (process_create_config.rs:275-276), i.e. anchored to a real time, never to the epoch.
[PASS]      SM-058: Where a zero *duration* is meaningful it is handled by an explicit branch rather than by
                    arithmetic: period_frequency == 0 returns the cliff fee directly (fee_scheduler.rs:65-67),
                    liquidity_per_period == 0 converts the schedule to a cliff-only lock and bumps the cliff to
                    at least 1 to avoid cliff_point == now (state/config.rs:684-697, with the DAMM v2 constraint
                    cited in the comment), and number_of_period == 0 skips the divide (:684-688).
[PARTIAL]   SM-059: Terminal-state cleanup is not centralised: CreatedPool is reached from two handlers
                    (migrate_damm_v2_initialize_pool.rs:734-767 · migrate_meteora_damm_initialize_pool.rs:276-315)
                    which each re-implement the same sequence — update_after_create_pool, reload, compute the
                    non-burnable reserve, burn, set progress — with subtly different code
                    (e.g. the DAMM v2 path recomputes protocol_and_partner_base_fee before the burn at :741, the
                    DAMM v1 path re-reads it at :281-283).
                    Improvement: extract one `finalize_migration(...)` helper used by both.
[PASS]      SM-060: Both transitions into CreatedPool were enumerated and compared line by line (SM-059). Despite
                    the duplication, both do perform the same cleanup: fee reserve excluded, residual burned,
                    progress set. No path skips the burn or leaves the protocol migration fee unreserved.
[PASS]      SM-061: Draining and zeroing happen together, with a post-drain invariant. The completing swap reloads
                    the base vault and asserts it still covers migration_base_threshold +
                    accumulated base fees + the full locked-vesting amount before declaring the curve complete
                    (process_swap.rs:344-354, InsufficientLiquidityForMigration). withdraw_leftover subtracts the
                    outstanding fee liabilities with safe_sub before paying out (withdraw_leftover.rs:93-98), so an
                    over-withdrawal errors rather than under-reserving.
[PASS]      SM-062: There is exactly one canonical completion predicate — is_curve_complete(migration_threshold)
                    (virtual_pool.rs:1122-1124) — and all nine call sites pass config.migration_quote_threshold
                    from the same immutable config (process_swap.rs:225, :343;
                    ix_withdraw_partner_surplus.rs:67; ix_withdraw_creator_surplus.rs:67;
                    ix_withdraw_migration_fee.rs:91; ix_claim_protocol_fee2.rs:122, :128;
                    migrate_damm_v2_initialize_pool.rs:540; migrate_meteora_damm_initialize_pool.rs:228).
                    No inline duplicate of the comparison exists.
[PASS]      SM-063: The paired gate is an exact complement: the swap requires `!is_curve_complete` and every
                    post-completion action requires `is_curve_complete`, both evaluating the same
                    `quote_reserve >= migration_threshold`. There is no gap and no overlap.
[PARTIAL]   SM-064: Transitions are validated by per-handler `require!`s on the current state rather than by a
                    central is_allowed_transition matrix. Each guard is an exact equality
                    (`== PostBondingCurve`, `== LockedVesting`, `== CreatedPool`) rather than an exclusion, so the
                    known foot-gun of this item is avoided — but the matrix lives implicitly across six files.
                    File: create_locker.rs:91-94 · migrate_damm_v2_initialize_pool.rs:534-537 ·
                          migrate_meteora_damm_initialize_pool.rs:220-223 · withdraw_leftover.rs:77-80 ·
                          meteora_damm_claim_lp_token.rs:77-80 · meteora_damm_lock_lp_token.rs:116-119
                    Improvement: a single `require_transition(current, next)` helper.
[PASS]      SM-065: CreatedPool is absorbing — no instruction writes a lower MigrationProgress value, and the only
                    two writers of CreatedPool require LockedVesting first. There is no recovery/escape path.
[PASS]      SM-066: Authority is never a substitute for the transition check. The strongest role in the program
                    (admin) cannot touch pool state at all (AC-016), and the partner/creator paths that do run
                    post-completion are additionally gated on the progress value
                    (creator/ix_transfer_pool_creator.rs:43-90) or on is_curve_complete.
[PASS]      SM-067: Sub-state is preserved across primary transitions: the migration handlers write
                    migration_progress and the protocol-migration-fee fields but leave every fee counter, surplus
                    flag, creation-fee bit and migration_fee_withdraw_status untouched
                    (migrate_damm_v2_initialize_pool.rs:584-587, :734, :767). Nothing is reset to a default.
[N/A]       SM-068: No fixed-slot collection is iterated for value. The only fixed array is the 20-entry curve
                    (state/config.rs:585), which is configuration, not a slot pool — and the swap walkers skip
                    zero-liquidity entries with `continue` in the descending direction
                    (virtual_pool.rs:387-389) rather than breaking.
[PASS]      SM-069: The one cached aggregate — the VolatilityTracker — is refreshed on every contributing mutation:
                    update_pre_swap before the swap and update_post_swap after it, both called unconditionally from
                    the swap path (process_swap.rs:231, virtual_pool.rs:996, :1002-1035). No other denormalised
                    aggregate exists (the fee counters are exact sums, not caches).
[PASS]      SM-070: Elapsed-time subtraction cannot underflow anywhere. The volatility decay uses saturating_sub
                    with a written rationale (state/fee.rs:87-90); the fee scheduler uses safe_sub against
                    activation_point, which is written from the same clock source at pool init and therefore cannot
                    exceed current_point (fee_scheduler.rs:69-71); the DAMM v2 vesting helper guards
                    `if current_point < cliff_point { return Ok(0) }` before subtracting
                    (damm_v2_utils.rs:58-69); validate_vesting_parameters requires cliff_point >= current_point
                    before its safe_sub (:103-128).
[PASS]      SM-071: Units are consistent within every calculation. ActivationType fixes slot-vs-timestamp once per
                    config and get_current_point returns the matching unit (activation_handler.rs:25-33); the
                    rate-limiter duration cap is unit-specific (MAX_RATE_LIMITER_DURATION_IN_SLOTS vs
                    _IN_SECONDS, selected by activation_type at fee_rate_limiter.rs:309-316, with the two constants
                    tied by a const_assert_eq at constants.rs:51-56). The vesting/locker path is unconditionally
                    unix-timestamp based (process_swap.rs:230 → finish_curve_timestamp → cliff_time), matching the
                    locker and DAMM v2 programs, and the DAMM v2 migrated pool is forced to activation_type = 1
                    (timestamp) with the config's activation_type validated to match
                    (migrate_damm_v2_initialize_pool.rs:161, :480-486).
[PASS]      SM-072: The cliff gate tests the real boundary, not a "started" flag: get_max_unlocked_liquidity_at_current_point
                    returns 0 while current_point < cliff_point and only then computes
                    period = (current_point − cliff_point) / period_frequency, capped at number_of_period
                    (damm_v2_utils.rs:54-80) — so pre-cliff time never counts toward the linear release.
                    The behaviour is unit-tested at both sides of the boundary
                    (tests/test_dammv2_vesting_params.rs, 195 lines).
```

**Checklist 05 tally — PASS 47 · FAIL 1 · PARTIAL 8 · N/A 16 = 72**

### Checklist 06 — Economic & Logic Attacks (ECON-001 → ECON-089)

```
[N/A]       ECON-001: There is no NAV and no share issuance to inflate — deposits buy tokens at a deterministic
                    curve price, so an atomic borrow-deposit-withdraw is just a round trip at a strictly worse
                    price (AR-022/AR-023). §6.1 items are evaluated against that structure rather than deferred.
[PASS]      ECON-002: No cooldown is needed and none exists, because the atomic round trip is unprofitable by
                    construction: the fee is charged on both legs (state/config.rs:139-172) with a 0.25 % floor,
                    and every price step rounds toward the pool.
[PASS]      ECON-003: Same-slot manipulation gains nothing — there is no per-slot price accumulator that a buy could
                    poison; the price is the state itself.
[N/A]       ECON-004: No share token is minted that could be used as collateral elsewhere; the buyer receives the
                    plain base SPL token.
[N/A]       ECON-005: No NAV attestation exists — see AR-047.
[PASS]      ECON-006: Slippage limits are enforced on every swap mode and are user-supplied — see AR-029/AR-030.
[PARTIAL]   ECON-007: Sandwiching is possible, as on any on-chain AMM: the curve price is public and a searcher can
                    front-run a buy. DBC's mitigations are real but partial — user-set slippage bounds
                    (AR-029), the optional fee scheduler that starts at a high cliff fee and decays
                    (base_fee/fee_scheduler.rs:64-74), the dynamic fee that rises with realised volatility
                    (state/config.rs:309-331), and the (deprecated) rate limiter that prices size and forbids
                    multiple swaps on one pool per transaction (process_swap.rs:201-212, :432-498).
                    No protocol-level ordering protection exists, which is expected for a spot venue.
[N/A]       ECON-008: The route is not chosen by the protocol — DBC is the venue. See CPI-006.
[PASS]      ECON-009: A buy cannot be sandwiched to "dilute" anyone, because there are no shares — the victim
                    simply pays a worse curve price, which their own minimum_amount_out bounds (AR-029).
[PASS]      ECON-010: Likewise for sells — the seller's minimum_amount_out bounds the damage.
[PARTIAL]   ECON-011: The only minimum is `amount_0 > 0` (process_swap.rs:172); there is no minimum trade size. The
                    economic protection instead comes from the fee floor and pool-favourable rounding (AR-024), so
                    dust trades are strictly loss-making for the trader and cost the protocol nothing. A dust
                    spammer does raise compute/write-lock contention on the pool account — see ECON-051, KV-131.
[N/A]       ECON-012: No withdrawal instruction with an amount — exits are swaps (ECON-011) or fixed one-shot
                    claims.
[PASS]      ECON-013: The "first deposit" has no discretion: the opening price is config.sqrt_start_price, fixed and
                    validated at config creation (MIN_SQRT_PRICE <= sqrt_start_price < MAX_SQRT_PRICE and
                    curve[0].sqrt_price > sqrt_start_price, process_create_config.rs:484-498), and written into the
                    pool at init (ix_initialize_virtual_pool_with_spl_token.rs:266).
[PASS]      ECON-014: Donation cannot change anyone's price — pricing never reads a vault balance. See AR-031.
[PASS]      ECON-015: No minimum first deposit is required because the attack it defends against does not exist
                    here — see ECON-013/ECON-014.
[N/A]       ECON-016: No dead-shares mechanism is needed — there are no shares. (The DAMM v2 *migrated* pool does
                    use dead liquidity in compounding mode, and DBC accounts for it:
                    DAMM_V2_COMPOUNDING_DEAD_LIQUIDITY at migration_handler/compounding_liquidity.rs:14, subtracted
                    at :83-89 and added back into the first position at
                    migrate_damm_v2_initialize_pool.rs:636-638.)
[PASS]      ECON-017: The initial price is explicit configuration, not a derived ratio — see ECON-013.
[N/A]       ECON-018: No NAV attestor — the price is the on-curve sqrt_price. See AR-047.
[N/A]       ECON-019: No manager NAV attestation — see ECON-018.
[N/A]       ECON-020: No manager NAV attestation — see ECON-018.
[N/A]       ECON-021: No NAV rate limiting needed — see ECON-018.
[N/A]       ECON-022: No NAV verification needed — see ECON-018.
[PASS]      ECON-023: The price floor cannot reach zero: sqrt_price is bounded below by config.sqrt_start_price on
                    every sell path (virtual_pool.rs:830-841 clamps to it; :447-450 re-asserts it) and
                    sqrt_start_price >= MIN_SQRT_PRICE = 4 295 048 016 (constants.rs:3,
                    process_create_config.rs:484-487).
[PASS]      ECON-024: The price ceiling is bounded: every buy stops at config.migration_sqrt_price
                    (virtual_pool.rs:875, :916-928 and the explicit
                    `require!(next_sqrt_price <= config.migration_sqrt_price)` at :329-332), and
                    migration_sqrt_price < MAX_SQRT_PRICE is required at config creation
                    (process_create_config.rs:566-570). Downstream u128/U256 math is therefore bounded.
[N/A]       ECON-025: No NAV freshness concept — see ECON-018.
[PASS]      ECON-026: Fee ceilings are enforced on-chain and cannot be exceeded — see AR-023/AR-039.
[PASS]      ECON-027: Fees cannot be changed retroactively: PoolConfig is immutable after creation and each pool is
                    bound to one config. See AC-024.
[N/A]       ECON-028: No fee-change timelock is needed because fees cannot change — see ECON-027.
[PASS]      ECON-029: Wash trading to farm fees is unprofitable: the wash trader pays the full fee on both legs and
                    receives back only the partner/creator share (at most 80 % of the trading fee, and only if they
                    are both partner and creator), while 20 % goes to the protocol and the curve rounding takes
                    more. Net loss on every round trip.
[N/A]       ECON-030: No time-proportional management fee exists — fees accrue per trade only.
[N/A]       ECON-031: No performance fee, so no high-water mark is needed.
[PASS]      ECON-032: Fee extraction order is fixed by FeeMode and applied identically in the forward and inverse
                    solvers — see AR-041.
[PASS]      ECON-033: Fees cannot be extracted outside the fee path: every transfer out of a vault is one of the
                    enumerated instructions, each bounded by a program-computed amount (CPI-014), and there is no
                    generic "transfer from vault" instruction.
[PASS]      ECON-034: There is no discretionary asset management — the pool holds exactly the two configured mints
                    and cannot swap into anything else.
[PASS]      ECON-035: There is no generic PDA-token-transfer instruction. See ECON-033.
[N/A]       ECON-036: No pda_token_transfer instruction exists — see ECON-035.
[PASS]      ECON-037: Lamport movement out of a program account is limited to the two pool-creation-fee claims, one
                    of which pays the hard-coded treasury and the other the partner, both bounded by
                    config.pool_creation_fee and floored at rent exemption
                    (ix_claim_protocol_pool_creation_fee.rs:47-67 · ix_claim_partner_pool_creation_fee.rs:28-52 ·
                    utils/token.rs:301-317).
[N/A]       ECON-038: No approve/delegate instruction — see CPI-026.
[N/A]       ECON-039: No manager-chosen swap route — DBC is the venue. See ECON-008.
[PASS]      ECON-040: The set of programs DBC can CPI into is fixed at compile time (damm_v2, dynamic_amm, locker,
                    the two token programs, Metaplex, System) plus the mint-declared transfer hook. No role can add
                    a CPI target. The transfer hook is the one untrusted callee — F-001.
[PASS]      ECON-041: The one allowlist that exists (TokenBadge) is controlled by admin-appointed operators, not by
                    the partner who benefits from it — see AC-029.
[PASS]      ECON-042: A partner cannot add anything to any allowlist; badge creation requires
                    OperatorPermission::CreateTokenBadge (lib.rs:63-66).
[PARTIAL]   ECON-043: Trader-side protection against partner/creator misbehaviour is limited to what is observable
                    on-chain: the config is immutable and fully published in EvtCreateConfigV2 (event.rs:56-63), a
                    minimum 10 % of migrated liquidity must be locked
                    (MIN_LOCKED_LIQUIDITY_BPS, constants.rs:60, enforced at process_create_config.rs:707-711 AND
                    re-checked at pool init, ix_initialize_virtual_pool_with_spl_token.rs:153-157), and the fee is
                    capped. There is no timelock, no multisig and no withdrawal guarantee. For transfer-hook pools
                    the partner/creator retain two further levers (F-001, F-002).
[FAIL-6]    ECON-044: A malicious Token-2022 transfer hook CAN exploit the pool — it executes on every base transfer
                    and can block or selectively permit them.
                    File: instructions/partner/create_config/ix_create_transfer_hook_config.rs:59-66
                    Impact: honeypot / permanently trapped quote reserve.
                    Fix: allowlist or immutability-gate the hook program. See F-001, EXT-012.
                    (The re-entrancy half of this vector is contained — see AC-049, RE-001, KV-003.)
[PASS]      ECON-045: Fee-on-transfer tokens cannot enter the protocol. Quote mints with a non-zero transfer fee are
                    rejected at config creation (utils/token.rs:232-235) and re-validated on all eight quote-moving
                    paths at runtime (validate_transfer_fee_is_zero, listed under F-005); base mints are created by
                    the program without the extension. The residual — a fee that is zero now and raised later — is
                    F-005.
[PASS]      ECON-046: Rebasing tokens cannot enter either: the base mint is program-created, and the quote mint must
                    be plain SPL, or Token-2022 with metadata extensions only, or explicitly badged
                    (utils/token.rs:218-258). InterestBearing is not in the allowlist.
[FAIL-4]    ECON-047: A quote mint's freeze authority can freeze the pool's quote_vault and the program never
                    inspects it.
                    File: utils/token.rs:218-222 (returns true for any classic SPL mint without reading anything)
                    Impact: every quote-side path reverts until unfrozen; funds are trapped.
                    Fix: require a TokenBadge when freeze_authority.is_some(). See F-005, AV-065.
[FAIL-6]    ECON-048: A retained mint authority can inflate the base supply after buyers have committed.
                    File: initialize_pool/process_initialize_virtual_pool_with_token2022.rs:145-167
                    Impact: the authority holder mints freely and sells into the curve, taking the quote reserve.
                    Fix: revoke unconditionally, or add a supply invariant to the swap. See F-002, AV-064.
[PASS]      ECON-049: Decimals are bounded and read from the mint, never assumed — token_decimal is validated to
                    6..=9 at config creation (process_create_config.rs:449-452), the base mint is created with
                    exactly that value (`mint::decimals = config.load()?.token_decimal`,
                    ix_initialize_virtual_pool_with_spl_token.rs:66), and every transfer_checked passes
                    token_mint.decimals read live from the account (utils/token.rs:77, :134).
[N/A]       ECON-050: No WSOL wrapping/unwrapping is performed — see AV-051.
[PARTIAL]   ECON-051: Compute-unit exhaustion is bounded but the bound is not asserted. The swap walks at most 20
                    curve points (state/virtual_pool.rs:386, :476, :775, :871 — fixed array length), the transfer-hook
                    slices are capped by `extra_remaining_account_count <= 1` plus the declared lengths
                    (process_swap.rs:174-195), and the single-swap validator scans at most `current_index`
                    instructions (:468-485), which the runtime caps. Nothing is unbounded, but no explicit CU guard
                    or `remaining_accounts.len() <= N` cap exists, and the repository's own
                    tests/simulate_cu_swap.tests.ts suggests CU is a live concern.
                    Improvement: assert a hard cap on the total hook-account count.
[N/A]       ECON-052: There is no batch operation over user positions — every instruction touches one pool.
[N/A]       ECON-053: No pay-investors instruction exists — see ECON-052.
[PASS]      ECON-054: Spamming pools costs the spammer rent plus any configured creation fee and creates no shared
                    state — see AC-045.
[PASS]      ECON-055: No Vec or growable array is stored on-chain. The curve is a fixed [LiquidityDistributionConfig; 20]
                    (state/config.rs:585) with the *usable* length capped at 16 by
                    MAX_CURVE_POINT (constants.rs:41-43, enforced at process_create_config.rs:489-492), and
                    the metadata strings are sized once at init (AV-042).
[PARTIAL]   ECON-056: Two third-party-authority paths can lock funds: a hostile transfer hook (F-001) and a
                    freezable or fee-mutable quote mint (F-005). No attacker-controlled *program state* can lock
                    funds — the lifecycle guards all have permissionless exits (SM-023).
[N/A]       ECON-057: No price oracle is used anywhere — zero occurrences of pyth/switchboard/chainlink/PriceUpdate.
                    §6.9 is evaluated from that fact rather than deferred.
[N/A]       ECON-058: No oracle — see ECON-057.
[N/A]       ECON-059: No oracle — see ECON-057.
[N/A]       ECON-060: No oracle — see ECON-057.
[N/A]       ECON-061: No oracle — see ECON-057.
[PASS]      ECON-062: The trust assumption is explicit and minimal: there is no oracle and no attested value. Price
                    is a pure function of the immutable configured curve and the accumulated quote
                    (state/virtual_pool.rs:765-938), so it cannot be misreported — only traded against.
[N/A]       ECON-071: No randomness, lottery or reward selection exists — zero occurrences of vrf/slot_hashes/
                    blockhash-derived entropy. Cross-ref KV-120.
[N/A]       ECON-063: No staking or reward accounting — DBC has no reward_debt / acc_reward_per_share mechanism.
                    §6.10 items are evaluated against that fact.
[N/A]       ECON-064: No reward payout paths — see ECON-063.
[N/A]       ECON-065: No global reward accumulator — see ECON-063.
[N/A]       ECON-066: No per-position reward snapshot — see ECON-063.
[N/A]       ECON-067: No acc_reward_per_share scaling — see ECON-063. (The analogous precision discipline for fees
                    is verified at AR-010/AR-012.)
[N/A]       ECON-068: No share-price/dead-share insolvency surface — see ECON-063 and ECON-016.
[N/A]       ECON-069: No first-staker or total_staked == 0 divide — see ECON-063.
[N/A]       ECON-070: No mutable reward rate — see ECON-063. (Fee rates are immutable per config, ECON-027.)
[FAIL-4]    ECON-072: No aggregate value-outflow ceiling and no pausable circuit breaker exists. Every outflow path
                    (swap output, referral fee, all fee claims, both surplus withdrawals, migration fee, leftover,
                    migration deposit) is individually bounded by its own accounting, but nothing bounds them in
                    aggregate and nothing can halt them.
                    File: lib.rs:31-315 — see F-006
                    Impact: no loss limiter during an incident.
                    Fix: add an operator-gated pause on the value-moving paths.
                    Mitigating structure: risk is naturally partitioned per pool — there is no shared treasury
                    vault, so one compromised pool cannot drain another.
[N/A]       ECON-073: No mark-to-market or unrealised PnL contributes to any borrowing power — DBC has no lending,
                    margin or health computation.
[PASS]      ECON-074: Concentration risk is structurally bounded: each pool holds only its own two mints in its own
                    two PDA vaults, no reserve is ever redeployed to a downstream venue, and the only cross-pool
                    shared object is the pool_authority PDA, which holds no persistent balance (flash rent is
                    repaid within the instruction, flash_rent.rs:13-23).
[FAIL-4]    ECON-089: No rolling per-window outflow accounting exists on any value-moving path, and there is no
                    guardian pause held separately from the upgrade authority.
                    File: lib.rs:31-315 — see F-006
                    Impact: a drain from a logic bug or a third-party-authority action (F-001/F-005) runs to
                    completion with no velocity breaker.
                    Fix: pause capability + per-window outflow accounting, with the pause key separate from the
                    upgrade authority.
[PASS]      ECON-075: The slippage guard protects the NET amount the user receives. For exact-in and partial-fill,
                    swap_result.output_amount is the post-fee value (actual_amount_out is computed after
                    get_fee_on_amount when fees are on output, virtual_pool.rs:598-617, :732-751) and that is what
                    is compared against minimum_amount_out (swap_exact_in.rs:29-32, swap_partial_fill.rs:28-31).
                    For exact-out, included_fee_input_amount is the fee-inclusive amount the user pays and it is
                    compared against maximum_amount_in (swap_exact_out.rs:29-34).
[PASS]      ECON-076: The fee base is the executed amount, not the declared one. In partial fill the input is
                    reduced to the consumed amount and the fee is recomputed from scratch against it before the
                    transfer (virtual_pool.rs:694-730), and the transfer moves exactly
                    swap_result_2.included_fee_input_amount (process_swap.rs:297).
[PASS]      ECON-077: The fee is netted from the tokens the instruction is already moving — either withheld from the
                    input (fees_on_input) or from the output (state/fee.rs:129-137) — never charged as a separate
                    lamport debit. The one lamport charge, pool_creation_fee, is a disclosed config value taken at
                    pool creation, not at swap time (ix_initialize_virtual_pool_with_spl_token.rs:244-252).
[PASS]      ECON-078: The quantities are distinctly named and never aliased: SwapResult2 carries
                    included_fee_input_amount, excluded_fee_input_amount, output_amount, trading_fee, protocol_fee
                    and referral_fee as separate fields (state/virtual_pool.rs:1275-1285), and the helper names say
                    which base they use (get_excluded_fee_amount / get_included_fee_amount,
                    get_total_fee_numerator_from_included_fee_amount / _from_excluded_fee_amount). The slippage
                    guard provably reads the post-fee field.
[PASS]      ECON-079: Purchases ARE capped at the completion threshold, and correctly. The quote→base walker takes
                    stop_sqrt_price = config.migration_sqrt_price and stops there, returning the unconsumed
                    amount_left (virtual_pool.rs:860-938, :875, :916-928). Exact-in then REJECTS any overshoot
                    (`require!(amount_left == 0, InsufficientLiquidity)`, :596) while partial-fill CAPS it,
                    recomputes the fee against the consumed amount, and re-checks slippage against the capped
                    output (:694-730, swap_partial_fill.rs:28-31). Exact-out is bounded by
                    `require!(next_sqrt_price <= config.migration_sqrt_price)` (:329-332). Terminal solvency is
                    then asserted explicitly before the curve is declared complete (process_swap.rs:344-354).
                    Cross-ref KV-125.
[PASS]      ECON-080: There is only one reserve layer, so the two cannot diverge: base_reserve/quote_reserve are the
                    curve's own accounting and the vaults hold the matching tokens, with the relationship asserted
                    at the one point where it must hold exactly — graduation (process_swap.rs:344-354) — and
                    re-derived from reloaded balances at migration (migrate_damm_v2_initialize_pool.rs:664-676).
                    The 25 % mint buffer (SWAP_BUFFER_PERCENTAGE, constants.rs:45, applied at
                    state/config.rs:876-895) absorbs the fee-retention drift. Full ledger at
                    `audit_2/checkpoint-02.md`.
[PASS]      ECON-081: Interdependent config is validated atomically from the instruction parameters, before anything
                    is written: ConfigParameters::validate checks the quote mint/badge, fee mode vs collect-fee
                    mode vs activation type, the liquidity-percentage sum == 100, decimals, the monotone curve and
                    its bounds (process_create_config.rs:369-515); process_create_config then derives
                    migration_sqrt_price and swap_base_amount from those same params, cross-checks the
                    fixed-supply triple against both buffered and unbuffered minimums (:621-658), validates the
                    compounding pool's implied price against the curve-derived one to within 1 %
                    (:598-619 → compounding_liquidity.rs:39-47), and finally re-checks the 10 % locked-liquidity
                    floor on the assembled config (:707-711). Nothing is read back from mutable state.
[PASS]      ECON-082: Every PDA-controlled vault has a reachable withdrawal path. quote_vault: swaps, three fee
                    claims, three surplus withdrawals, migration fee, migration deposit. base_vault: swaps,
                    two fee claims, locker funding, leftover withdrawal, migration deposit, burn. The pool account's
                    lamports: two creation-fee claims. pool_authority holds no persistent balance (ECON-074).
                    No vault accumulates value with no way out.
[PASS]      ECON-083: Cumulative caps are enforced by construction rather than by a running total: each capped
                    withdrawal either decrements the counter it draws from (claim_partner_trading_fee /
                    claim_creator_trading_fee / claim_protocol_*_fee use `.min()` then `safe_sub`,
                    state/virtual_pool.rs:1041-1113) or is one-shot behind a flag/bit (surplus, leftover, migration
                    fee, creation fee — AC-043). Repeated calls cannot exceed the allocation.
[PASS]      ECON-084: Residual extraction settles liabilities first. withdraw_leftover subtracts the outstanding
                    protocol/partner/creator base fees AND the protocol migration base fee before paying the
                    residual, using safe_sub so an over-draw errors (withdraw_leftover.rs:93-98). The migration
                    burn does the same (migrate_damm_v2_initialize_pool.rs:740-749). Both additionally require
                    MigrationProgress::CreatedPool, i.e. after all obligations are known.
[N/A]       ECON-085: DBC maintains no TWAP and no Σ(price × elapsed) accumulator. The VolatilityTracker
                    (state/fee.rs:26-111) is a decaying volatility counter used only to raise the fee — it is not a
                    price feed and nothing prices off it. §6.15 is evaluated against that fact.
[PASS]      ECON-086: The one accumulator that does exist is hard-capped rather than saturating:
                    volatility_accumulator = min(volatility_reference + Δbin × 10 000, max_volatility_accumulator)
                    (state/fee.rs:69-78), with max_volatility_accumulator itself bounded by U24_MAX at config time
                    (params/fee_parameters.rs:144-147). A long idle gap only zeroes the reference
                    (:104-107); it cannot spike the value. The derived fee is then capped again at
                    MAX_FEE_NUMERATOR (state/config.rs:129-134).
[N/A]       ECON-087: There is no bounded measurement window or proposal to accrue past — see ECON-085.
[PASS]      ECON-088: A zero accumulator is meaningful and safe here: a fresh VolatilityTracker yields
                    variable_fee = 0 (state/config.rs:313-315 returns 0 when dynamic fee is disabled;
                    with it enabled, a zero accumulator yields a zero variable term), so the pool simply charges
                    the base fee. There is no division by an elapsed span anywhere in the tracker
                    (get_delta_bin_id divides by the config's bin_step_u128, which is required to equal the
                    non-zero BIN_STEP_BPS_U128_DEFAULT at params/fee_parameters.rs:122-125).
```

**Checklist 06 tally — PASS 41 · FAIL 5 · PARTIAL 5 · N/A 38 = 89**

### Checklist 07 — OpSec & Governance (OPS-001 → OPS-085)

> `[UNKNOWN]` below means the item requires an on-chain query or an organisational fact that the repository does not
> contain, and the engagement prohibits execution (§3). Per OUTPUT-RULES Rule 10 these are reported as unknown rather
> than passed; they are tallied under **Partial**.

```
[UNKNOWN]   OPS-001: The deployed upgrade authority could not be read — `solana program show dbcij3…` is
                    prohibited (§3) and the repository records no upgrade authority. Manual verification required.
[UNKNOWN]   OPS-002: Multisig-vs-single-wallet for the upgrade authority is unverifiable in scope — see OPS-001.
                    Circumstantial evidence that Meteora uses Squads exists in-tree (treasury::ID is documented
                    with a Squads URL at instructions/admin/auth.rs:15-16), but that is the treasury, not the
                    upgrade authority. The QUESTIONS.md "single wallet → auto-flag Severity 8" default was
                    deliberately NOT applied — see `audit_2/intake.md` §5.
[UNKNOWN]   OPS-003: Multisig threshold unverifiable — see OPS-001.
[UNKNOWN]   OPS-004: Signer identities unverifiable — see OPS-001.
[UNKNOWN]   OPS-005: Signer key custody (hardware vs hot) unverifiable — see OPS-001.
[PARTIAL]   OPS-006: There is no on-chain upgrade timelock in this program, and none could be enforced by it (the
                    upgrade path belongs to the BPF loader). Any timelock would be a property of the upgrade
                    authority account, which is unverifiable — see OPS-001.
[UNKNOWN]   OPS-007: Whether a timelock is enforced on-chain or by policy is unverifiable — see OPS-006.
[UNKNOWN]   OPS-008: Timelock duration unverifiable — see OPS-006.
[UNKNOWN]   OPS-009: Upgrade-authority rotation control is a BPF-loader property, unverifiable — see OPS-001.
[UNKNOWN]   OPS-010: Immutability status unverifiable — see OPS-001. Nothing in the repository documents an
                    intention to freeze the program.
[PASS]      OPS-011: Correct by construction, and worth stating explicitly for the trust model: if the program is
                    upgradeable, the upgrade authority can replace every check in this report and drain every pool.
                    All findings in §4 are therefore conditional on that authority being honest and key-secure —
                    see `audit_2/intake.md` §6 and §4.6 of this report.
[UNKNOWN]   OPS-012: Emergency-upgrade process unverifiable — no runbook or policy document exists in the repository.
[PASS]      OPS-013: No hidden admin instruction. All 31 instructions are declared in the #[program] module
                    (lib.rs:31-315) and therefore appear in the generated IDL; the admin allowlist is a plain,
                    readable constant (instructions/admin/auth.rs:6-9) rather than an obfuscated byte array.
[FAIL-4]    OPS-014: A god-mode path exists behind a build flag: with `--features local`, assert_eq_admin returns
                    true for every signer, so any key satisfies is_admin and can mint itself a fully-permissioned
                    Operator account.
                    File: instructions/admin/auth.rs:19-22 (used by access_control.rs:8-11, gating lib.rs:35,43,48)
                    Impact: privilege escalation to protocol-fee custody and mint whitelisting, if such a build is
                    ever deployed. No compile-time tripwire prevents it.
                    Fix: compile_error! on `local` + release/BPF target, or use a distinct localnet allowlist so the
                    code path is identical. See F-004.
[PASS]      OPS-015: No hidden pubkey comparisons. Every `key() == X` comparison in the program is one of the
                    documented authority checks: the admin allowlist (auth.rs:24-29), treasury::ID
                    (ix_claim_protocol_pool_creation_fee.rs:26-30), the two const_pda authorities
                    (const_pda.rs:4-26), the three CPI program ids (damm_v2::ID, dynamic_amm::ID, locker::ID,
                    mpl_token_metadata::ID), the instructions sysvar (process_swap.rs:188-191), and the
                    transfer-hook denylist (ix_create_transfer_hook_config.rs:60-66). Each was read and accounted for.
[PARTIAL]   OPS-016: There is dead but still-callable code: `migration_damm_v2_create_metadata` is a deprecated
                    no-op whose five accounts are all unchecked UncheckedAccounts.
                    File: instructions/migration/dynamic_amm_v2/migration_damm_v2_create_metadata.rs:6-24
                          (declared at lib.rs:301-309 with a #[deprecated] note "It's unneeded. Will be removed in
                          next release version")
                    It writes nothing and returns Ok(()), so the blast radius is a wasted transaction; but it is a
                    callable surface that reads as unaudited. Also dead: access_control::is_claim_fee_operator
                    (no caller) and EvtCreateClaimFeeOperator (never emitted).
                    Improvement: remove them as the deprecation note already promises.
[UNKNOWN]   OPS-017: IDL-vs-binary equivalence cannot be checked without building (§3). The IDL is generated by
                    Anchor from the same source under the `idl-build` feature
                    (programs/dynamic-bonding-curve/Cargo.toml:13), which makes divergence unlikely by construction,
                    but the deployed IDL account was not fetched.
[PASS]      OPS-018: No instruction can change a fee destination. treasury::ID is a compile-time constant with no
                    setter (auth.rs:12-17); config.fee_claimer and config.leftover_receiver are written once at
                    create_config and there is no update_config instruction; pool.creator is transferable but only
                    by the current creator and only in two lifecycle states
                    (creator/ix_transfer_pool_creator.rs:29-99).
[PASS]      OPS-019: No instruction can change a CPI program id. damm_v2::ID, dynamic_amm::ID, locker::ID and
                    mpl_token_metadata::ID are compile-time constants used in `address =` constraints. The one
                    program id that IS stored in state — ConfigWithTransferHook.transfer_hook_program — is written
                    once at config creation and never updated (state/config.rs:590-596); that it is unvalidated at
                    write time is F-001, not a mutability problem.
[PASS]      OPS-020: Creatorship change requires the current creator's signature and forbids a no-op, and cannot
                    happen mid-lifecycle — see AC-028, SM-012.
[FAIL-6]    OPS-021: An instruction path leaves the base mint's authority with a user key, so supply can be created
                    after buyers have committed — the token-launch analogue of "mint shares without deposit".
                    File: initialize_pool/process_initialize_virtual_pool_with_token2022.rs:145-167
                    Impact: unlimited base minted and sold into the curve; the quote reserve is drained.
                    Fix: revoke unconditionally, or add a supply invariant to the swap path. See F-002.
[PASS]      OPS-022: Nothing can be burned out from under a holder. The only burn is from the program's own
                    base_vault at migration, bounded by the leftover after fee reserves
                    (migrate_damm_v2_initialize_pool.rs:737-765 · migrate_meteora_damm_initialize_pool.rs:279-306).
                    User token accounts are never touched except by transfers the user signs.
[PASS]      OPS-023: Zero `unsafe` blocks in the program (verified by an exhaustive grep over
                    programs/dynamic-bonding-curve/src). Cross-ref AV-081.
[PASS]      OPS-024: No raw pointer manipulation. The only low-level memory access is bytemuck::from_bytes /
                    from_bytes_mut on a validated slice (utils/pool_account_loader.rs:43-57 ·
                    utils/config_account_loader.rs:54-68), which is safe Rust.
[PASS]      OPS-025: declare_id! matches Anchor.toml — see AV-010.
[UNKNOWN]   OPS-026: Verifiable-build equivalence could not be checked — `anchor build` / `solana-verify` are
                    prohibited (§3). The repository supports it structurally (pinned toolchain
                    rust-toolchain.toml:2 = 1.93.0, Anchor.toml:14-16 = anchor 1.0.2 / solana 3.1.10, committed
                    Cargo.lock) but publishes no build hash or verification badge.
[UNKNOWN]   OPS-027: Deploy-keypair custody is not recorded in the repository.
[FAIL-3]    OPS-028: Key material IS stored in the repository — a complete ed25519 keypair is tracked at
                    keys/local/admin-bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1.json and referenced as the
                    provider wallet at Anchor.toml:11. (Counted once, at OPS-036.)
                    Impact: bounded today — the pubkey is not in admin::ADMINS (auth.rs:6-9) and is not
                    treasury::ID — but it is a live, spendable key in a public repository.
                    Fix: burn the key, remove it from history, gitignore `keys/`, generate it in CI. See F-010.
[UNKNOWN]   OPS-029: Partner/creator wallet custody is outside the repository and outside DBC's control — those are
                    third-party keys by design.
[N/A]       OPS-030: No backend server wallet exists — there is no off-chain service in scope.
[N/A]       OPS-031: No backend server wallet — see OPS-030.
[N/A]       OPS-032: No API keys are used by the program; there is no off-chain component in scope.
[N/A]       OPS-033: No API keys — see OPS-032.
[N/A]       OPS-034: No RPC endpoint is configured by the program. Anchor.toml:10 sets cluster = "Localnet" for
                    local development only.
[N/A]       OPS-035: No frontend in scope — see OPS-032.
[FAIL-3]    OPS-036: A private key has been committed to git and is present at the audited commit.
                    File: keys/local/admin-bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1.json
                    (tracked; .gitignore:1-14 excludes .env/target/node_modules/test-ledger/deploy.sh/.notes but
                    nothing key-shaped, and no secret scanner is configured in .github/)
                    Impact: full signing authority for that pubkey is public. Not currently privileged (see OPS-028).
                    Fix: as OPS-028. See F-010.
[UNKNOWN]   OPS-037: Which multisig platform (if any) governs on-chain operations is not verifiable in scope. The
                    only in-repo signal is the Squads treasury URL comment at instructions/admin/auth.rs:15-16.
[UNKNOWN]   OPS-038: Multisig threshold unverifiable — see OPS-037.
[UNKNOWN]   OPS-039: Signer power distribution unverifiable — see OPS-037.
[UNKNOWN]   OPS-040: Backup signers unverifiable — see OPS-037.
[UNKNOWN]   OPS-041: Whether a single compromised signer could lower the threshold is unverifiable — see OPS-037.
[UNKNOWN]   OPS-042: Proposal expiry unverifiable — see OPS-037.
[UNKNOWN]   OPS-043: Multisig execution logging unverifiable — see OPS-037.
[PARTIAL]   OPS-044: No incident-response plan exists in the repository — no SECURITY.md, no INCIDENT*/RUNBOOK*/
                    *disaster*/*recovery* file, and no security contact. (Meteora may maintain one off-repo; it is
                    not pinned to this commit.)
[FAIL-4]    OPS-045: The program cannot be paused. There is no pause instruction, no pause flag, and no
                    guardian role.
                    File: lib.rs:31-315 — see F-006
                    Impact: during an incident, the only lever is a program upgrade.
                    Fix: add an operator-gated pause on the value-moving paths, with the pause key held separately
                    from the upgrade authority.
[PARTIAL]   OPS-046: No bug-bounty program is referenced in the repository (no SECURITY.md, no
                    .well-known/security.txt, no mention in README.md or CHANGELOG.md). Meteora may run one
                    off-repo.
[PARTIAL]   OPS-047: No security contact is published in the repository — there is no SECURITY.md and no contact
                    address in README.md or license.md.
                    Improvement: add SECURITY.md with a disclosure address and response SLA.
[N/A]       OPS-048: Monitoring configuration is not part of an on-chain program repository and none is present.
                    The on-chain side of monitoring — event coverage — is assessed at SM-047..SM-050 (gap: F-011).
[N/A]       OPS-049: Upgrade-transaction alerting is an off-chain control; nothing in the repository configures it.
[N/A]       OPS-050: Transaction-pattern alerting is an off-chain control; nothing in the repository configures it.
[UNKNOWN]   OPS-051: No war-room/escalation process is documented in the repository.
[UNKNOWN]   OPS-052: No post-mortem process is documented in the repository.
[PASS]      OPS-053: Time-locked actions enumerated. On-chain, three mechanisms are time-gated and all are
                    per-pool economic schedules rather than governance timelocks: the fee scheduler
                    (base_fee/fee_scheduler.rs:64-74, decaying from activation_point), the rate limiter's
                    max_limiter_duration window (fee_rate_limiter.rs:42-63, capped at 12 h by
                    constants.rs:51-56), and the two vesting schedules — creator token vesting via Jup Lock
                    (process_create_config.rs:271-287) and DAMM v2 LP vesting capped at 2 years
                    (MAX_LOCK_DURATION_IN_SECONDS, constants.rs:62-66, enforced at
                    damm_v2_utils.rs:124-133). There is no governance timelock, and none is claimed.
[UNKNOWN]   OPS-054: Program-upgrade timelock duration unverifiable — see OPS-006/OPS-008.
[PASS]      OPS-055: Fee changes need no timelock because fees cannot change: PoolConfig is immutable and each pool
                    is bound to one config (AC-024, ECON-027). This is stronger than a timelock.
[PASS]      OPS-056: Creator changes are instant but are self-gated, non-transferable to the same key, and blocked
                    in the two mid-migration states (creator/ix_transfer_pool_creator.rs:23-25, :43-90). The
                    partner (config.fee_claimer) cannot change at all.
[PASS]      OPS-057: Whitelist (TokenBadge) changes are instant but operator-gated and narrowly scoped: creating a
                    badge only widens the set of usable *quote* mints for *future* configs and pools; closing one
                    cannot affect existing pools (the badge is consulted only at create_config and pool init —
                    utils/token.rs:246-258, called from process_create_config.rs:378 and the three init handlers).
[PASS]      OPS-058: The treasury address is effectively immutable — a compile-time constant with no setter
                    (instructions/admin/auth.rs:12-17). This is the item's recommended state.
[N/A]       OPS-059: No timelock exists, so there is no emergency-bypass mechanism to evaluate.
[N/A]       OPS-060: No time-locked transaction queue exists in this program.
[PARTIAL]   OPS-061: On-chain notification is good for configuration (EvtCreateConfigV2 /
                    EvtCreateConfigV2WithTransferHook publish the entire ConfigParameters including the hook
                    program, event.rs:56-73) but absent for the highest-value change of all — migration emits
                    nothing (F-011). There is also no on-chain signal that a pool's mint authority was retained
                    (F-002) beyond reading the mint account directly.
[N/A]       OPS-062: Environment separation is an organisational control with no in-repo artefact. The program's
                    own separation mechanism — the `local` feature — is assessed at OPS-014 (F-004).
[UNKNOWN]   OPS-063: Developer deploy access is not recorded in the repository.
[PASS]      OPS-064: CI does not auto-deploy. The workflow runs fmt, build, unit tests and two integration suites
                    only; there is no deploy step, no `solana program deploy`, and no secret is referenced
                    (.github/workflows/ci.yml:1-152). `deploy.sh` is explicitly gitignored (.gitignore:12).
[N/A]       OPS-065: Server access controls are outside the scope of an on-chain program repository.
[N/A]       OPS-066: No database exists in this repository.
[PASS]      OPS-067: No wallet private key is referenced in CI. The workflow defines only
                    SOLANA_CLI_VERSION / ANCHOR_CLI_VERSION / TOOLCHAIN
                    (.github/workflows/ci.yml:9-12) and uses `${{ }}` interpolation only for those three
                    constants and for the cache keys — no `secrets.*` reference exists anywhere.
[N/A]       OPS-068: No secret manager is needed — CI consumes no secrets (OPS-067).
[PASS]      OPS-069: The program is fully open source, with a license file (license.md), a maintained CHANGELOG.md
                    covering every release, and vendored historical IDLs for four prior versions
                    (scripts/idl/release_0.1.2.json … release_0.1.6.json) — which materially helps external review.
[UNKNOWN]   OPS-070: Source-to-binary equivalence unverifiable — see OPS-026.
[PARTIAL]   OPS-071: Reproducibility is well-supported but unproven here. The toolchain is fully pinned
                    (rust-toolchain.toml:2, Anchor.toml:14-16, committed Cargo.lock and bun.lock) and the release
                    profile is deterministic-leaning (lto = "fat", codegen-units = 1, incremental = false,
                    Cargo.toml:5-13) — but no build was run (§3) and no expected artefact hash is published.
                    Improvement: publish the verifiable-build hash per release in CHANGELOG.md.
[PASS]      OPS-072: The git history is linear and PR-based — the two most recent commits are
                    "Release 0.2.1 (#202)" and "release 0.2.0 (#193)", i.e. merged pull requests with sequential
                    numbers, and CHANGELOG.md records every version back to 0.1.0. No evidence of history rewriting.
[UNKNOWN]   OPS-073: Branch-protection rules live in the GitHub repository settings, not in the tree. The workflow
                    triggers on `pull_request` to `main` and `release_*` (.github/workflows/ci.yml:4-7) and the
                    history is PR-numbered (OPS-072), which is consistent with required PRs — but the required-review
                    and required-check settings could not be read.
[FAIL-4]    OPS-074: The CI pipeline itself is not secured against a PR skipping its checks. Two issues:
                    (a) every job is gated on a third-party action pinned by a MUTABLE TAG
                    (`tj-actions/changed-files@v18.6`, .github/workflows/ci.yml:25) — an upstream tag repoint
                    replaces the code that decides whether any test runs at all;
                    (b) the change detector watches only `programs/dynamic-bonding-curve` (:27-28), so a PR that
                    edits libs/, idls/, Cargo.toml/Cargo.lock, Anchor.toml, rust-toolchain.toml or tests/ runs
                    zero jobs and merges green.
                    File: .github/workflows/ci.yml:15-33
                    Impact: build and test gates can be silently bypassed, and a compromised action executes with
                    the runner's context on every PR.
                    Fix: SHA-pin every third-party action, widen the change detector, add `permissions: contents: read`.
                    See F-008 (a) and F-007 (b).
[PARTIAL]   OPS-075: Dependency pinning is partial. The lockfiles are committed (Cargo.lock 96 kB, bun.lock 54 kB),
                    which fixes the actual resolved versions, and one transitive dependency is deliberately
                    floor-pinned with a written rationale
                    (`spl-tlv-account-resolution = "^0.11.1"` — "explicitly pin transitive dep … to min version with
                    proper de_escalate_account_meta", Cargo.toml:39-40). But every workspace dependency uses a
                    caret range (anchor-lang "1.0.2", ruint "1.14.0", bytemuck "1.21", mpl-token-metadata
                    "5.1.2-alpha.2", …, Cargo.toml:16-40), and one is a pre-release alpha pulled from a
                    commit-linked comment (:24-25). Note also the GitHub Actions pinning gap at OPS-074.
                    Improvement: use `=` pins for the security-critical crates, or at minimum document that the
                    lockfile is authoritative and never regenerated ad hoc.
[N/A]       OPS-076: The program does not interact with stake accounts — no StakeProgram, staker or withdrawer
                    reference exists. Cross-ref KV-118.
[PASS]      OPS-077: Privileged instructions are not reachable via stale pre-signed transactions in any way this
                    program controls: there is no durable-nonce handling, and the admin/operator surface is narrow
                    and idempotent (creating an Operator account for an address that already has one fails on
                    `init`). A pre-signed admin transaction would still be a real risk at the wallet level, but the
                    program exposes no version/epoch guard to invalidate one.
                    Cross-ref KV-119, and OPS-078 for the missing rotation handshake.
[PARTIAL]   OPS-078: There is no two-step admin rotation. The admin set is a compile-time array
                    (instructions/admin/auth.rs:6-9) with no propose/accept handshake and no pending_admin field —
                    rotating an admin requires a program upgrade, which is a heavier and riskier operation than a
                    rotation should be. The *operator* layer partially compensates: operators are revocable at
                    runtime (close_operator_account, lib.rs:43-46) and permissions are bit-scoped.
[PASS]      OPS-079: Fee/treasury accounts are validated for token-receiving capability where it matters and all
                    have a sweep path: the pool-creation fee lands in the pool account's lamports and is swept by
                    two instructions (ECON-082); trading fees sit in the vaults and are claimed to a
                    caller-supplied InterfaceAccount<TokenAccount>, whose validity transfer_checked enforces; the
                    protocol trading fee is routed through the protocol-fee program, which validates its own
                    receiver (ix_claim_protocol_fee2.rs:45-73). No fee destination is a dead end.
[PARTIAL]   OPS-080: Config creation is permissionless and the creator identity IS decoupled from the privileged
                    role — `fee_claimer` and `leftover_receiver` are independent accounts, not the payer
                    (ix_create_config.rs:21-24) — which is the namespace-capture protection this item asks for.
                    What is missing is the acceptance half: neither address must sign or accept, so a config can
                    name an unwitting third party as fee_claimer. Impact is benign (it can only *give* them fees)
                    but it means partner_metadata can be created for any address that later signs
                    (ix_create_partner_metadata.rs:35). There is no config-update API at all, so the Patch<T>
                    half of the item does not apply.
[UNKNOWN]   OPS-081: The live multisig threshold could not be fetched — see OPS-037/OPS-002.
[PASS]      OPS-082: Every partner-settable numeric carries BOTH a lower and an upper bound, enforced at
                    create_config: cliff_fee_numerator in [MIN_FEE_NUMERATOR, MAX_FEE_NUMERATOR]
                    (fee_scheduler.rs:87-94), the scheduler's derived min fee likewise (:91-94), migration_fee
                    percentage <= 99 with creator share <= 100 (process_create_config.rs:81-98),
                    creator_trading_fee_percentage <= 100 (:388-391), token_decimal in 6..=9 (:449-452),
                    migrated_pool_fee_bps in [10, 1000] (:147-151), compounding_fee_bps in (0, MAX_BASIS_POINT]
                    when compounding (:159-162), pool_creation_fee in [1e6, 1e11] when non-zero (:475-481),
                    sqrt_start_price in [MIN_SQRT_PRICE, MAX_SQRT_PRICE) (:484-487), curve length in [1, 16]
                    (:489-492), the liquidity-percentage sum == 100 exactly (:454-464), the dynamic-fee parameters
                    against U24_MAX and BASIS_POINT_MAX (params/fee_parameters.rs:116-150), and
                    max_limiter_duration against a unit-specific cap (fee_rate_limiter.rs:309-316).
[PASS]      OPS-083: Interdependent values are cross-validated atomically from the incoming parameters — see
                    ECON-081 for the full enumeration (curve monotonicity, threshold-vs-curve, supply triple vs
                    both buffered and unbuffered minimums, compounding price within 1 % of the curve price,
                    migration_sqrt_price < MAX_SQRT_PRICE, and the 10 % locked-liquidity floor re-checked on the
                    assembled config at process_create_config.rs:707-711).
[PASS]      OPS-084: Every value that later becomes a denominator or a curve base is rejected at zero:
                    migration_quote_threshold > 0 (process_create_config.rs:466-469), curve[i].liquidity > 0 for
                    all i (:493-506), included_protocol_fee_migration_base_amount > 0 && swap_base_amount > 0
                    (:592-596), the vesting frequency and total amount non-zero when vesting is configured
                    (:300-309), bin_step_u128 forced to a non-zero constant (params/fee_parameters.rs:122-125),
                    and the rate limiter's all-or-nothing zero check (fee_rate_limiter.rs:300-307). The remaining
                    divisors are literal constants (100, FEE_DENOMINATOR, MAX_BASIS_POINT).
[N/A]       OPS-085: There is no in-repo multisig/governance signing surface to assess for legibility — the program
                    has no proposal or council mechanism, and the admin instructions are plain Anchor calls. The
                    council-side rendering of an upgrade transaction is a property of the (unverifiable) upgrade
                    authority — see OPS-001.
```

**Checklist 07 tally — PASS 24 · FAIL 6 · PARTIAL 10 · UNKNOWN 28 (tallied under Partial) · N/A 17 = 85**

### Checklist 16 — Formal Verification & Testing Quality (FV-001 → FV-072)

```
[PARTIAL]   FV-001: Some invariants are documented, but not as a consolidated set. In-code documentation exists for
                    the lifecycle (state/virtual_pool.rs:66-71), the fee-split identities
                    (state/virtual_pool.rs:306, :352, :715 "that ensure included = amount + trading + protocol +
                    referral"), the rate-limiter algebra (base_fee/fee_rate_limiter.rs:22-32, :103-145) and the
                    layout constants (the ten const_assert_eq sites at AV-040). What is missing is a written
                    statement of the load-bearing conservation invariant this audit had to reconstruct by hand
                    (§SM-053). No SPEC.md, no invariants section in README.md.
[PARTIAL]   FV-002: Invariants are encoded as property tests for the *math layer* only. Six proptest suites
                    exist — rate limiter (tests/test_rate_limiter.rs:345-409), inverse fee
                    (test_inverse_fee.rs:5+), math utils (test_math_utils.rs:24+), dynamic fee params
                    (test_dynamic_fee_params.rs:18+), migration fee (test_migration_fee.rs:22,64,92,129) and total
                    supply (test_total_supply.rs:239-272, 10 000 cases asserting an exact round-trip identity).
                    None encodes the vault-conservation or reserve-solvency invariant. The one test that simulates
                    10 000 randomised swaps asserts nothing at all — it only println!s
                    (tests/test_swap.rs:241-292, named `test_swap_wont_depelete_reserve`).
                    Improvement: assert `user.quote_balance <= u64::MAX` (i.e. the trader never profits from a
                    round trip) and a per-step `vault >= reserve + fees` check.
[PARTIAL]   FV-003: The arithmetic identities that ARE relied on are well covered — the supply round-trip
                    (test_total_supply.rs:178-272), the fee inverse (test_inverse_fee.rs), the rate-limiter
                    forward/inverse agreement (test_rate_limiter.rs:1-343 with ten hand-picked boundary cases),
                    migration-fee distribution (test_migration_fee.rs, 171 lines) and the DAMM v2 vesting
                    parameters (test_dammv2_vesting_params.rs, 195 lines). Not covered: the four-direction curve
                    rounding property this audit verified by reading (AR-022/AR-023), and the top 1 % of the
                    rate-limiter domain (FV-029).
[PARTIAL]   FV-004: State-transition properties are enforced in code (SM-041, SM-064) and exercised by the
                    TypeScript integration suite (tests/migrate_to_damm_v2*.tests.ts, create_locker.tests.ts,
                    swap_over_curve.tests.ts), but there is no explicit transition-matrix specification or test
                    that enumerates the illegal transitions.
[PARTIAL]   FV-005: No model checking or stateful fuzzing exists. The randomised swap sequence in
                    tests/test_swap.rs:241-292 is the closest thing and, as noted at FV-002, it asserts nothing.
                    tests/test_migration_fee_status.rs does cover the migration-fee bit state machine.
[PARTIAL]   FV-006: Token conservation is NOT verified by any test. It holds — this audit reconstructed it in full
                    (SM-053, `audit_2/checkpoint-02.md`) — and one on-chain check partially enforces it
                    (process_swap.rs:344-354), but no test asserts `tokens in == tokens out` across instruction
                    paths. This is the single highest-value testing gap for a protocol of this type.
                    Improvement: a LiteSVM/Mollusk property test that, after an arbitrary sequence of swaps and
                    claims, asserts quote_vault.amount == quote_reserve + protocol_quote_fee + partner_quote_fee +
                    creator_quote_fee.
[PARTIAL]   FV-007: Authority properties are tested only in part. The Rust unit tests cover the operator permission
                    bitmask (tests/test_operator_permission.rs) and the TypeScript suite covers token-authority
                    options (tests/token_authority.tests.ts, tests/token_update_authority.tests.ts) and badge
                    behaviour (tests/token_badge.tests.ts) — the three files that contain failure-path assertions.
                    There is no systematic "wrong signer is rejected" test across the 11 role-gated instructions.
[PASS]      FV-008: Liveness holds and is demonstrated end to end: every initiated pool can reach CreatedPool, every
                    step past completion is permissionless (SM-023), and the full path is exercised by
                    tests/full_flow_with_sol.tests.ts plus the five migrate_to_damm_v2*.tests.ts variants.
[N/A]       FV-009: No formal specification document exists, so there is no spec-drift to track. (This is itself
                    captured at FV-001.)
[N/A]       FV-010: The project makes no machine-checked-proof claim anywhere in README.md or CHANGELOG.md.
[N/A]       FV-011: No custom formal-verification properties are defined — see FV-009.
[N/A]       FV-012: No prior verification results exist to include — this is the first audit pinned to this
                    repository (see `audit_2/intake.md` §7).
[FAIL-4]    FV-013: No static-analysis tool runs in CI. Four of the five jobs install the `clippy` component
                    (.github/workflows/ci.yml:56, :79, :102, :135) but no job ever invokes `cargo clippy`; there is
                    no semgrep, no custom lint, and no `-D warnings`.
                    File: .github/workflows/ci.yml:30-152
                    Impact: whole classes of defect (including clippy::arithmetic_side_effects, which is directly
                    relevant to F-009) are never surfaced.
                    Fix: add a clippy job with `-D warnings`. See F-007.
[N/A]       FV-014: No static-analysis findings exist to triage — no tool runs (FV-013).
[PARTIAL]   FV-015: A project convention IS enforced at the language level rather than by lint: the SafeMath /
                    SafeCast traits (math/safe_math.rs) make checked arithmetic the ergonomic default, and
                    `#[workspace.lints.rust] unexpected_cfgs` is configured (Cargo.toml:42-46). But there is no
                    lint forbidding raw arithmetic operators or `unwrap()` in program code — which is exactly what
                    F-009 and the `.unwrap()` notes in §4 would have been caught by.
[PARTIAL]   FV-016: `cargo fmt --all -- --check` is enforced (.github/workflows/ci.yml:40), so formatting is a hard
                    gate, but compiler and clippy warnings are not: `anchor build` runs without `-D warnings`
                    (:67) and `cargo test` likewise (:82-85).
[N/A]       FV-017: No security-focused ruleset can be enabled because no static-analysis tool runs — see FV-013.
[N/A]       FV-018: No dead-code detection runs — see FV-013. (Dead code was found manually: OPS-016.)
[FAIL-4]    FV-019: No dependency-vulnerability scanning runs in CI — no `cargo audit`, no `cargo-deny`, no
                    `npm/bun audit`, and no Dependabot configuration in `.github/`.
                    File: .github/workflows/ci.yml:1-152
                    Impact: a published advisory in any of the 40+ transitive crates (or in the pinned
                    mpl-token-metadata 5.1.2-alpha.2 pre-release) would go unnoticed.
                    Fix: add a cargo-audit job. See F-007.
[N/A]       FV-020: No SAST tool is configured for any language — see FV-013.
[PASS]      FV-021: There are no unjustified suppressions. The four `#[allow(...)]` occurrences each have a reason
                    that is legible from context: `#[allow(deprecated)]` on the deprecated event/instruction paths
                    (lib.rs:14, ix_create_config.rs:4, :60, damm_v2_metadata_state.rs:1,
                    migration_damm_v2_create_metadata.rs:1) and `#[allow(clippy::too_many_arguments)]` on the
                    16-parameter process_swap (swap/process_swap.rs:92). No `#[allow]` disables a correctness lint.
[PARTIAL]   FV-022: The static-analysis configuration that exists is version-controlled (rust-toolchain.toml,
                    .prettierrc, .prettierignore, the workspace lints block in Cargo.toml:42-46), but there is no
                    clippy.toml, no .semgrep, and no CODEOWNERS to require review on changes to CI or lint config.
[PARTIAL]   FV-023: Deserialization fuzzing is absent as such, but the parsing surface is small and the
                    deserializers are the framework's: Anchor/borsh for instruction data and bytemuck for the
                    zero-copy accounts, both preceded by length and discriminator checks
                    (utils/pool_account_loader.rs:16-41, utils/config_account_loader.rs:16-48). The one hand-written
                    parser — parse_transfer_hook_accounts (utils/remaining_accounts.rs:29-76) — has no fuzz target
                    despite consuming attacker-supplied slice lengths.
                    Improvement: a cargo-fuzz target over (remaining_accounts.len(), slices) for that function.
[PARTIAL]   FV-024: No instruction-handler fuzz targets exist — there is no Trident, cargo-fuzz or Crucible harness
                    in the repository (no fuzz/ directory, no fuzz target in any Cargo.toml, and
                    `proptest-regressions` in .gitignore:11 is for the unit-level proptests only). The malicious-input
                    surface is instead covered by hand-written negative TypeScript cases in three files
                    (tests/token_badge.tests.ts, tests/token_authority.tests.ts, tests/full_flow_with_sol.tests.ts).
                    For a mainnet protocol of this value, stateful instruction-sequence fuzzing is the expected bar
                    — see FV-071.
[N/A]       FV-025: No fuzz corpus exists because no fuzzer is configured — see FV-024. (`proptest-regressions` is
                    gitignored at .gitignore:11, so even proptest's shrunk counter-examples are not persisted —
                    noted at FV-027.)
[N/A]       FV-026: No fuzz campaigns have been run — see FV-024. The proptest suites do run 10 000 cases each
                    (test_rate_limiter.rs:348, test_total_supply.rs:241), which is a meaningful unit-level budget.
[PARTIAL]   FV-027: Regression capture is undermined by configuration: `proptest-regressions` is gitignored
                    (.gitignore:11), so when a property test shrinks a failing case the counter-example is NOT
                    committed and the regression is not locked in. Hand-written regression cases do exist for past
                    boundary work (test_rate_limiter.rs:1-343 walks ten specific input regimes).
                    Improvement: remove `proptest-regressions` from .gitignore and commit the files.
[PASS]      FV-028: Differential testing IS present and is a genuine strength: a dedicated backwards-compatibility
                    suite runs in its own CI job (tests/backwards_compatibility/, `bun run build-local-ctest`,
                    .github/workflows/ci.yml:120-151) against four vendored historical IDLs
                    (scripts/idl/release_0.1.2.json … 0.1.6.json), plus COMPATIBLE_TEST.md documenting the process
                    and a fixture-based SDK test set (dynamic-bonding-curve-sdk/fixtures/*.bin).
[FAIL-4]    FV-029: The property tests for the rate-limiter inverse solver bound the input at `u64::MAX/100`,
                    excluding the top 1 % of the domain — which is precisely where the quadratic discriminant is
                    most likely to go negative.
                    File: programs/dynamic-bonding-curve/src/tests/test_rate_limiter.rs:353, :373, :396
                    Impact: the arithmetic edge case at F-009 is structurally unreachable by the existing suite.
                    Fix: raise the bound to `0..=u64::MAX` and sweep fee_increment_bps across its full range.
                    See F-009.
[N/A]       FV-030: There are no API endpoints in scope — the program is the only surface.
[PASS]      FV-031: Serialization round-trips are exercised where they matter: the config's packed
                    MigratedPoolMarketCapFeeSchedulerParams is serialized into a [u8; 16] and deserialized back on
                    every migration (state/config.rs:817-823 → :1121-1123, :1169-1171), and the fixed-supply
                    round-trip identity is proptested over 10 000 cases (test_total_supply.rs:239-272). The
                    backwards-compatibility suite (FV-028) is a round-trip test across versions.
[PARTIAL]   FV-032: The unit/proptest infrastructure is reproducible (pinned toolchain, `cargo test --package …`
                    in CI at .github/workflows/ci.yml:82-85) and COMPATIBLE_TEST.md documents the
                    backwards-compatibility procedure, but no fuzzing infrastructure exists to document (FV-024).
[PARTIAL]   FV-033: Coverage is not measured. No tarpaulin/llvm-cov/lcov/codecov configuration exists anywhere in
                    the repository, and no coverage step runs in CI.
                    Improvement: add `cargo llvm-cov` to the unit_test job and publish the number per release.
[PARTIAL]   FV-034: Critical-path coverage looks good by file count but is unmeasured (FV-033). The 40 integration
                    files with 213 `it()` blocks do cover pool creation (SPL / Token-2022 / transfer-hook), swap
                    (exact-in, partial fill, over-curve, referral, first-swap, rate-limited, CU simulation), all
                    fee claims, surplus, leftover, both migration targets with five DAMM v2 variants, locker
                    creation, token badge, and creator transfer. No branch-coverage figure exists.
[PARTIAL]   FV-035: Every one of the 31 instructions has at least one integration test that exercises it (mapped
                    file-by-file against tests/*.tests.ts), but not every *public function* has a unit test — the
                    curve walkers in state/virtual_pool.rs:377-938, which are the highest-risk pure functions in the
                    program, are reached only indirectly through test_swap.rs's three tests.
[PASS]      FV-036: Multi-step workflows are covered end to end: tests/full_flow_with_sol.tests.ts,
                    tests/migrate_to_damm_v2_with_vesting.tests.ts, tests/claim_and_lock_lp_on_meteora_damm.tests.ts
                    and tests/fixed_token_supply.tests.ts each drive create-config → init-pool → swap → complete →
                    lock/migrate → claim.
[PASS]      FV-037: Edge cases are well covered at the unit level: ten hand-picked rate-limiter input regimes
                    including u64::MAX (test_rate_limiter.rs:1-343, case "10" at :338-342), zero/boundary
                    activation handling (test_activation_handler.rs), fee-mode matrix (test_fee_mode.rs, 14 cases),
                    migration-fee boundaries (test_migration_fee.rs), safe-math boundaries (test_safe_math.rs),
                    swap-over-curve at the threshold (tests/swap_over_curve.tests.ts). The gap is the top 1 % of the
                    rate-limiter domain (FV-029).
[PARTIAL]   FV-038: Negative testing is thin. Only three of the 40 integration files contain failure-path
                    assertions (tests/token_badge.tests.ts, tests/token_authority.tests.ts,
                    tests/full_flow_with_sol.tests.ts), and there is one Rust negative assertion
                    (test_swap.rs:294-322 asserting InsufficientLiquidity, and :196-199 asserting the same inside
                    the simulation helper). There is no systematic "unauthorized caller is rejected" suite across
                    the 11 role-gated instructions, and no test that a TransferHookPool is rejected by the plain
                    swap path (the tests/swap_pool_type_mismatch.tests.ts file name suggests intent — it should be
                    extended to the claim paths too).
[PARTIAL]   FV-039: Regression tests exist for past issues in the form of the backwards-compatibility suite
                    (FV-028) and the hand-written rate-limiter regimes, and CHANGELOG.md documents behavioural
                    fixes per release. But proptest counter-examples are not persisted (FV-027), so shrunk failures
                    are not locked in.
[PARTIAL]   FV-040: Tests do run in CI on every PR to main/release_* (.github/workflows/ci.yml:3-7, :70-151) — but
                    only when the path filter fires, so a PR that touches libs/, idls/, Cargo.toml or tests/ itself
                    merges with no tests at all.
                    File: .github/workflows/ci.yml:15-33 — see F-007(b)
[PASS]      FV-041: The test environment mirrors production configuration closely: the same pinned toolchain
                    (TOOLCHAIN 1.93.0, SOLANA_CLI_VERSION 3.1.10, ANCHOR_CLI_VERSION 1.0.2 at
                    .github/workflows/ci.yml:9-12, matching rust-toolchain.toml:2 and Anchor.toml:14-16), real
                    program fixtures for the CPI targets (tests/fixtures/*.so — damm_v2, dynamic_amm,
                    dynamic_vault, locker, metaplex, transfer_hook_counter), and the real DAMM v2/locker programs
                    rather than mocks. The one divergence is the `--features local` build (F-004), which changes
                    admin gating and adds extra require!s.
[PASS]      FV-042: No test is skipped or ignored — no `#[ignore]`, no `.skip(`, no `xit(`, no `describe.skip` in
                    either the Rust or the TypeScript suites.
[N/A]       FV-043: Mutation testing has not been run and no mutation-testing configuration exists
                    (no cargo-mutants). This is an aspirational item at this maturity level.
[PARTIAL]   FV-044: Performance/DoS testing exists in one place — tests/simulate_cu_swap.tests.ts profiles compute
                    units for the swap — but there is no CU regression baseline recorded per instruction and no
                    load test for the worst-case curve walk (20 points) or the maximum transfer-hook account set.
                    Cross-ref ECON-051, FV-067.
[PASS]      FV-045: No test uses a real credential. The only keypair in the repository is the localnet fixture
                    (F-010), the TypeScript suites generate keypairs at runtime (tests/utils/), and CI references
                    no `secrets.*` (OPS-067). No mainnet key or RPC token appears anywhere.
[PASS]      FV-046: Tests are reproducible. The Rust suite is deterministic apart from test_swap.rs's use of
                    `rand::rng()` (:243) — and that test asserts nothing, so non-determinism cannot cause a flake;
                    proptest is configured with an explicit case count (test_rate_limiter.rs:347-349,
                    test_total_supply.rs:240-242); the TypeScript suite runs `--runInBand` against a fresh
                    local validator with committed `.so` fixtures (package.json:7-8).
                    Improvement: when FV-002 is fixed, seed the RNG so the new asserts are reproducible.
[PARTIAL]   FV-059: An in-process SVM suite exists — `litesvm ^0.1.0` is a devDependency (package.json:31) and is
                    used by the test harness — and the CPI targets are loaded as real compiled `.so` fixtures
                    (tests/fixtures/), not mocks. But the primary suite is ts-mocha driving
                    `anchor build --features local` (package.json:6-8), i.e. it tests the `local` binary rather than
                    the release binary (FV-041), and no Mollusk harness exists.
[PARTIAL]   FV-060: Time-gated instructions are tested on the "after" side but not systematically on the "before"
                    side. tests/rate_limiter.tests.ts and tests/deprecated_rate_limiter.tests.ts exercise the
                    limiter window and tests/fee_swap.tests.ts the scheduler decay; there is no test asserting that
                    create_locker fails before PostBondingCurve, or that migration fails before LockedVesting.
[PASS]      FV-061: Time-dependent logic is driven by sysvar/clock control rather than by wall-clock waiting — the
                    suites manipulate the validator clock (tests/utils/) to advance the fee scheduler and the rate
                    limiter, and the Rust unit tests pass current_point explicitly as a parameter
                    (test_rate_limiter.rs, test_fee_mode.rs, test_activation_handler.rs).
[PARTIAL]   FV-062: Account closure is exercised (tests/token_badge.tests.ts closes a badge) but the assertions
                    check behaviour rather than the three post-close fields; no test asserts
                    `lamports == 0 && data.len() == 0 && owner == system_program`.
                    Improvement: assert all three after close_token_badge / close_operator_account.
[PARTIAL]   FV-063: Re-initialization is prevented structurally by `init` (AV-053) and is implicitly covered when a
                    suite re-runs against an existing pool, but no test explicitly asserts that
                    double-initialization fails.
[PARTIAL]   FV-064: Authorization negatives are tested in three files only — see FV-038. There is no test that a
                    wrong `fee_claimer`, a wrong `creator`, a non-admin signer or a non-operator is rejected.
[PASS]      FV-065: Arithmetic edge cases ARE tested through the SVM as well as at unit level:
                    tests/swap_over_curve.tests.ts (over-threshold swap), tests/quote_transfer_fee.tests.ts,
                    tests/design_curve.tests.ts and tests/build_graph_curve.tests.ts (curve extremes), plus the
                    unit-level boundary suites at FV-037. Zero-amount rejection is enforced in code
                    (process_swap.rs:172).
[PASS]      FV-066: Token balances are asserted explicitly after transfer paths rather than merely checking that the
                    transaction succeeded — the suites fetch and compare balances via tests/utils/fetcher.ts across
                    the swap, claim, surplus, leftover and migration tests.
[PARTIAL]   FV-067: CU is profiled for one instruction (tests/simulate_cu_swap.tests.ts) but there is no recorded
                    baseline for initialize, migrate or close, and no CI assertion that CU has not regressed.
                    Cross-ref FV-044.
[PASS]      FV-068: Multi-transaction tests advance the blockhash correctly — the suites run `--runInBand` against a
                    live local validator (package.json:7-8), where each `sendAndConfirm` fetches a fresh blockhash;
                    no stale-blockhash reuse pattern was found in tests/utils/common.ts.
[PASS]      FV-069: Failure-path tests assert on the error rather than unwrapping the send: the Rust helpers use
                    `assert_eq!(err, PoolError::InsufficientLiquidity.into())` (test_swap.rs:196-199, :318-321) and
                    the TypeScript negatives use catch/expect (tests/token_badge.tests.ts,
                    tests/token_authority.tests.ts, tests/full_flow_with_sol.tests.ts).
[PASS]      FV-070: PDA derivations in tests mirror the on-chain seeds — the helpers in tests/instructions/ and
                    tests/utils/ derive from the same prefixes as constants.rs:110-127, and the const_pda
                    derivation has a dedicated equivalence test (src/tests/test_const_pda.rs). Mainnet replay is
                    used only for the vendored `.so` fixtures, never for a security assertion.
[PARTIAL]   FV-071: The tooling present is appropriate but incomplete for the risk profile. Present: proptest
                    (six suites, 10 000 cases each), a real-`.so` integration harness with litesvm available, and
                    a differential backwards-compatibility suite (FV-028) — which is more than most launchpads
                    ship. Absent: any stateful instruction-sequence fuzzer (Trident), any sBPF invariant fuzzer
                    (Crucible), any bounded model checking (Kani), and any equivalence/invariant proving
                    (Certora CVL). For a mainnet launchpad custodying the entire quote side of every active curve,
                    the token-conservation invariant at FV-006 should be machine-checked, not hand-verified.
                    Improvement: start with a Trident harness over
                    {create_config, init_pool, swap*, claim*, migrate} asserting the SM-053 ledger identity.
[N/A]       FV-072: Transaction-v1 readiness is an off-chain/reader concern; the program itself has no indexer,
                    no fee-sponsor path and no ComputeBudget-dependent logic (AV-089/AV-090), so there is nothing
                    for its test suite to round-trip. Cross-ref KV-135, KV-136.
[PASS]      FV-047: Every CPI is error-checked with `?` — there is no ignored Result anywhere in the program, and
                    the external-CPI sites additionally assert post-conditions
                    (utils/cpi_checker.rs:4-32, applied at six call sites — see EXT-011).
[PASS]      FV-048: Errors leak nothing sensitive. PoolError messages are short, generic strings
                    (error.rs:7-268) and the one diagnostic that includes a source location is the math-overflow
                    log, which prints only the crate-relative file and line (math/safe_math.rs:27-29) — useful for
                    debugging, harmless to an attacker who already has the open-source code.
[PARTIAL]   FV-049: Panics in production code are not fully eliminated. Five `assert!` calls remain in the curve
                    math (curve.rs:73, :140, :141, :157, :158) and one in a const fn (utils/bits.rs:3); each was
                    traced and found unreachable given the config-time guards (liquidity > 0 at
                    process_create_config.rs:493-506; sqrt_price >= MIN_SQRT_PRICE at :484-487), but they abort
                    rather than return a PoolError. Five `.unwrap()` calls also remain
                    (state/virtual_pool.rs:425, state/config.rs:133, and the four optional-account unwraps at
                    migrate_damm_v2_initialize_pool.rs:359-394 — see Notes & Nitpicks). The raw ruint arithmetic
                    at F-009 is the one case where a panic is plausibly reachable.
                    Improvement: convert the asserts to `require!` with a PoolError.
[N/A]       FV-050: There is no HTTP status-code surface — the program returns Anchor error codes.
[PASS]      FV-051: Resource exhaustion is handled by the runtime and bounded by design — every loop has a fixed
                    upper bound (ECON-051, ECON-055), there is no recursion, no heap allocation beyond small Vecs
                    in the config/migration builders, and no large stack array (cross-ref KV-111).
[N/A]       FV-052: There are no external network calls; CPIs are synchronous and bounded by the runtime's own CU
                    and depth limits.
[PASS]      FV-053: Partial failure is impossible at the protocol level — Solana instructions are atomic, and the
                    multi-CPI migration handler performs all of its work inside one instruction so a late failure
                    rolls back the pool creation, the locks and the NFT transfers together (SM-044).
[PASS]      FV-054: No error is swallowed. Every fallible call uses `?`; the two places that deliberately degrade
                    do so explicitly and log the reason — the dynamic-fee parameter fallback
                    (state/config.rs:1078-1084, `msg!("Undetermined Issues, fall back to none dynamic fee …")`)
                    and the first-swap-min-fee eligibility probe, whose `.is_ok()` is the intended semantics
                    (process_swap.rs:214-221).
[PASS]      FV-055: The program returns specific error codes throughout — 78 distinct PoolError variants
                    (error.rs:7-268), each with a human-readable `#[msg]`, plus Anchor's ErrorCode::ConstraintHasOne
                    for the manual has_one equivalents. No bare ProgramError is returned.
[PASS]      FV-056: Error handling is exhaustive by construction: every enum conversion goes through
                    num_enum's TryFromPrimitive with an explicit `.map_err(|_| PoolError::…)`
                    (state/config.rs:834-838, :1094-1097, :1147-1150; migration_handler/mod.rs; base_fee/mod.rs:20-33),
                    and every `match` on a converted enum is total, with the impossible arms returning
                    UndeterminedError rather than falling through (state/config.rs:1135-1139, :1192-1195,
                    damm_v2_utils.rs:255-256).
[PASS]      FV-058: Exceptional financial conditions are blocked, not wrapped: division by zero returns
                    PoolError::MathOverflow via checked_div (math/safe_math.rs:58-68), negative balances are
                    impossible (all subtraction is safe_sub), the release profile sets `overflow-checks = true`
                    (Cargo.toml:6) as a second line of defence, and insolvency at graduation is rejected outright
                    (process_swap.rs:351-354). The one exception is the raw ruint path at F-009.
[PARTIAL]   FV-057: There is no circuit breaker or fallback for a failing external dependency. If the DAMM v2
                    program, the locker program or a mint's transfer hook starts rejecting, the affected pools
                    simply cannot progress — there is no alternative migration target, no timeout, and no pause
                    (F-006). The `calculate_dynamic_fee_params` fallback (state/config.rs:1078-1084) is the only
                    graceful-degradation path in the program.
```

**Checklist 16 tally — PASS 24 · FAIL 3 · PARTIAL 30 · N/A 15 = 72**

---

## 6. Known Vector Results (KV-001 → KV-136)

> Load gating per FULL-AUDIT.md Phase 4.4: each in-scope vector's `Load when (markers)` column was checked against the
> tree; vectors whose markers are provably absent render `[N/A — feature absent]` (an evidence-backed verdict, which
> reopens on demand), `always (<phase>)` vectors were always opened, and out-of-scope groups render
> `[N/A — out of scope]` from the scope gate. Three vectors were opened in full and walked step by step against the
> code: KV-003, KV-023 and KV-125.

```
[PASS]      KV-001 Private Key Leak: always-load (crypto). No key material is embedded in program source. One
                    localnet keypair file IS tracked in the repository — keys/local/admin-boss….json — but it is
                    not in admin::ADMINS (instructions/admin/auth.rs:6-9) and is not treasury::ID, so no on-chain
                    privilege is exposed. Reported as F-010 under checklist 07 (OPS-036).
[N/A]       KV-002 Flash Loan Price Manipulation: [feature absent: flash · flashloan · oracle-priced deposit/withdraw
                    · pyth · switchboard]. No oracle and no share pricing exist; the curve price is state, and an
                    atomic borrow-buy-sell round trip loses the fee on both legs plus the rounding (ECON-001..005).
[PARTIAL]   KV-003 Reentrancy (CPI): OPENED and walked. Step 1 — 21 CpiContext sites + 4 raw invoke/invoke_signed
                    sites enumerated (CPI-002, PDA-017/018). Step 2 — state is written before every CPI on every
                    value path (RE-001): the swap applies the full result and drops the borrow at
                    process_swap.rs:256-270 before the first transfer at :291. Step 3 — no explicit guard exists;
                    the protection is structural (AC-049). Step 4 — all CPI targets are address-constrained
                    EXCEPT the mint-declared transfer hook and the forwarded DAMM v1 program accounts. Step 5 —
                    no program is invoked from remaining_accounts; the hook id comes from the mint
                    (utils/token.rs:46-56).
                    Verdict per the vector's own scale: ⚠️ PARTIAL — "CPIs to trusted programs but no explicit
                    guard", with the untrusted-callee caveat tracked separately as F-001 (the hook's ability to
                    block, not to re-enter profitably). A re-entrant swap operates on already-updated reserves and
                    the outer transfer simply fails if the vault is short; no profitable sequence was found.
[PASS]      KV-004 Missing Access Control: always-load (crypto). Every privileged instruction carries an
                    #[access_control] attribute or an in-handler authority check, and all 31 were mapped to a role
                    (AC-011, §6 Instruction Matrix). The one conditional bypass is the `local` build flag —
                    F-004 / OPS-014.
[N/A]       KV-005 Oracle Manipulation: [feature absent: pyth · switchboard · oracle · PriceUpdate · get_price].
                    Zero occurrences in the tree. See ECON-057.
[N/A]       KV-006 First Depositor / Share Inflation: [feature absent: shares · mint_to into a share mint · vault
                    share accounting · total_supply pricing]. `mint_to` exists but mints the *base* token at a
                    price fixed by config, not shares against a vault balance (ECON-013..017).
[PARTIAL]   KV-007 MEV Sandwich Attack: markers present (swap · slippage · min_amount_out). User-set slippage bounds
                    are enforced on all three swap modes (AR-029/AR-030) and three fee mechanisms raise the cost of
                    sniping (fee scheduler, dynamic fee, rate limiter), but ordering protection is absent, as on
                    any spot venue. See ECON-007.
[PARTIAL]   KV-008 Rug Pull / Admin Backdoor: always-load (crypto). The *admin* surface is clean — it cannot move
                    funds, change fees or pause (AC-016). The rug levers that do exist belong to the
                    partner/creator on transfer-hook pools: an unvalidated hook program (F-001) and a retained
                    mint authority (F-002). Both are documented product options, which is why this is PARTIAL
                    rather than FAIL at the vector level; the mechanisms themselves are reported at severity 6.
[PARTIAL]   KV-009 Unchecked CPI Target: markers present (invoke · invoke_signed · CpiContext · program_id). Every
                    program DBC *invokes* is address-constrained (CPI-008). The gap is the programs it *forwards*
                    into the legacy DAMM v1 CPI — metadata_program, vault_program, associated_token_program, rent
                    — which are bare UncheckedAccounts. F-012 / CPI-007.
[PASS]      KV-010 PDA Confusion / Type Cosplay: markers present (seeds · find_program_address · AccountInfo ·
                    try_deserialize). Every deserialization checks owner + discriminator + length
                    (utils/pool_account_loader.rs:16-41, utils/config_account_loader.rs:16-48), all PDAs carry
                    their parent identity in the seeds (AV-027), and the one same-layout pair
                    (VirtualPool/TransferHookPool) is disambiguated by discriminator and re-asserted per handler
                    (AV-012).
[PASS]      KV-011 Integer Overflow / Underflow: markers present (arithmetic sites). All arithmetic routes through
                    the SafeMath/SafeCast traits (math/safe_math.rs) with `overflow-checks = true` in the release
                    profile (Cargo.toml:6) as a second line of defence. The single exception is the raw ruint block
                    at base_fee/fee_rate_limiter.rs:154-162 — F-009 / AR-005.
[PASS]      KV-012 Arithmetic Rounding Exploit: markers present (division · mul_div). All four curve directions were
                    walked and every rounding step favours the pool; the fee rounds up with a 0.25 % floor
                    (AR-022, AR-023, AR-024). A round trip of N dust trades strictly loses value.
[PASS]      KV-013 Missing Signer Check: always-load (crypto). Every value-moving instruction has a Signer
                    (AC-001), all signers are Anchor `Signer<'info>` (AC-004), and the permissionless cranks pay
                    only to config- or state-derived destinations (AC-010).
[PASS]      KV-014 Account Reinitialization: markers present (init). `init_if_needed` is used zero times; every
                    persistent account uses plain `init`, which fails on an existing account (AV-023, AV-053).
[PASS]      KV-015 Unchecked Account Owner: always-load (crypto). Owner is checked on every deserialized account —
                    by Anchor for typed accounts, and explicitly at pool_account_loader.rs:17-20 and
                    config_account_loader.rs:17-20 for the two polymorphic loaders (AV-001).
[PASS]      KV-016 Token Account Mismatch: markers present (TokenAccount · token::mint · token::authority).
                    Vault mint and authority are constrained at creation and the vault identity is re-bound to the
                    pool on every value path (AV-045..AV-047); transfer_checked re-validates the mint at runtime.
[PASS]      KV-017 Vault Donation Attack: markers present (vault · .amount). Pricing never reads a vault balance —
                    it is a pure function of sqrt_price and the configured curve (AR-031). The three balance reads
                    that do exist (completion solvency, leftover, migration deltas) treat a donation as
                    protocol-favourable.
[PASS]      KV-018 Fee-on-Transfer Token Exploit: markers present (token_2022 · TransferFee · get_extension). Quote
                    mints with a non-zero transfer fee are rejected at config time (utils/token.rs:232-235) and
                    re-validated on all eight quote-moving paths at runtime; base mints are program-created without
                    the extension (ECON-045). Residual — a fee that is zero now and raised later — is F-005.
[PARTIAL]   KV-019 Freeze Authority Griefing: markers present (freeze_authority · mint). The program's own base
                    mints have no freeze authority (AC-036), but the quote mint's freeze authority is never
                    inspected, so a freezable quote mint can freeze the pool's quote_vault and block every
                    quote-side path. F-005 / AV-065 / ECON-047.
[UNKNOWN]   KV-020 Program Upgrade Hijack: always-load (crypto). The program is presumably upgradeable, and an
                    upgrade authority can by definition replace every control in this report (OPS-011). Custody,
                    threshold and timelock could not be verified — `solana program show` is prohibited (§3).
                    Manual verification required; see OPS-001..OPS-012.
[N/A]       KV-021 Governance Attack (Vote Buying): [feature absent: realm · proposal · spl-governance ·
                    vote_record · voter_weight]. No governance mechanism exists in the program.
[N/A]       KV-022 Bridge Exploit (Fake Proof): [feature absent: guardian · vaa · emitter · verify_signatures ·
                    attestation]. No bridge or cross-chain attestation surface.
[FAIL-6]    KV-023 Token-2022 Transfer Hook Attack: OPENED and walked. Step 1 — the protocol handles Token-2022
                    (anchor-spl token_2022, spl-transfer-hook-interface 2.1.0, Cargo.toml:38). Step 2 — arbitrary
                    *base* mints are not accepted (the program creates them) but the *hook program* attached to
                    them is arbitrary and partner-supplied. Step 3 — the code is fully hook-AWARE (it resolves and
                    forwards the extra accounts, utils/token.rs:87-108, :144-165, and revokes the hook at
                    graduation, process_swap.rs:390-430) but does not validate or allowlist the hook program.
                    Step 4 — state ordering is correct: all writes precede the transfer (RE-001).
                    File: instructions/partner/create_config/ix_create_transfer_hook_config.rs:59-66
                    Impact: the hook can block every base transfer, freezing the pool and trapping buyers' quote,
                    or permit only the insider's transfers.
                    Fix: allowlist the hook program (a HookBadge PDA mirroring TokenBadge) or require it to be
                    non-upgradeable. See F-001.
[PARTIAL]   KV-024 Stale / Missing Account Close: markers present (close · lamports). Closes are correct
                    (AV-026, AV-055, AV-056), but the pool and both vaults are never closable, so their rent is
                    permanently locked — SM-008 / SM-031.
[PARTIAL]   KV-025 Compute Budget Exhaustion DoS: markers present (loops · remaining_accounts · panic sites).
                    Every loop is bounded by a fixed array length or by the runtime's own instruction cap, and the
                    remaining-accounts surface is length-checked (ECON-051). What is missing is an explicit cap on
                    the total transfer-hook account count and a CU regression baseline (FV-044, FV-067). The
                    reachable-panic question is F-009.
[PASS]      KV-026 PDA Seed Collision: markers present (seeds · find_program_address). Pool seeds include the config
                    and both mints in canonical (max,min) order, with the base mint being an unpredictable fresh
                    keypair; all other PDAs carry their parent key; no seed uses variable-length user data
                    (AV-027, PDA-011, AC-039).
[PASS]      KV-027 Missing Discriminator Check: markers present (try_deserialize · remaining_accounts). Both custom
                    loaders check the discriminator explicitly before mapping the bytes
                    (pool_account_loader.rs:29-35, config_account_loader.rs:22-42), and the one deserialized
                    remaining account uses AccountLoader::try_from (AV-013).
[PARTIAL]   KV-028 Front-Running Transaction: markers present (swap · claim · slippage). Swap front-running is
                    bounded by user slippage (KV-007). Claims cannot be front-run for profit — they pay the
                    authenticated claimer. Pool/config creation cannot be front-run because the PDA depends on an
                    unpredictable fresh mint (AC-039). The permissionless cranks can be front-run, and for
                    migration the cranker chooses the DAMM v2 config — F-003.
[PASS]      KV-029 Withdraw-Before-Update Race: markers present (withdraw · invoke · reload). State is updated
                    before every CPI on the swap and claim paths (RE-001). The three surplus/migration-fee
                    withdrawals set their one-shot flag after the transfer, but the pool RefMut is held across the
                    CPI and the callee is an Interface-constrained token program, so re-entry is impossible —
                    RE-002 (improvement noted).
[PARTIAL]   KV-030 Infinite Mint / Uncapped Supply: markers present (mint_to · supply · mint_authority). For SPL
                    and plain Token-2022 pools the mint authority is revoked and the supply is exactly
                    get_initial_base_supply() (AC-037, CPI-018). For transfer-hook pools it may be retained by a
                    user key, and no supply invariant is re-checked afterwards — F-002 / AV-064 / ECON-048.
[N/A]       KV-031…KV-055 Backend / API vectors: [out of scope: `--scope program`; no backend exists in this
                    repository]. 25 vectors.
[N/A]       KV-056…KV-075 Frontend / client-side vectors: [out of scope: `--scope program`; no frontend exists in
                    this repository]. 20 vectors.
[N/A]       KV-076…KV-100 DevOps / supply-chain vectors: [out of scope: `--scope program` excludes checklists
                    11-13]. 25 vectors. Three of them overlap findings reported here under checklist 07 and are
                    noted for the reader's benefit without being counted as in-scope verdicts: KV-078 (secrets in
                    git history → F-010 / OPS-036), KV-080 (CI/CD pipeline injection → F-008 / OPS-074),
                    KV-091 (upgrade authority not secured → OPS-001..OPS-012, unverifiable).
[PASS]      KV-101 Sysvar Spoofing & Instructions-Sysvar Introspection: markers present (instructions_sysvar ·
                    load_instruction_at). Clock and Rent come only from syscalls (AV-068); the instructions sysvar
                    is address-asserted before use (process_swap.rs:186-195); indices are computed via
                    load_current_index_checked, never assumed (AV-074).
[N/A]       KV-102 Precompile Signature Verification Bypass: [feature absent: ed25519 · secp256k1 · precompile
                    signature verification]. No signature is verified by introspection (AV-071).
[PASS]      KV-103 Address Lookup Table Manipulation: markers present indirectly (versioned tx / instruction
                    introspection). No privileged account is identified by transaction position or by ALT-resolved
                    order — every one is bound by `address =`, `has_one`, seeds or a state comparison (AV-075).
                    The introspection routines match on program id and discriminator, not on position (AV-090).
[PASS]      KV-104 Non-Canonical Bump / PDA Derivation Confusion: markers present (seeds · bump ·
                    find_program_address). All bumps are canonical — Anchor `bump` everywhere plus a compile-time
                    canonical derivation for the two global authorities (const_pda.rs:7-13, :19-25), with a
                    dedicated equivalence test (src/tests/test_const_pda.rs). `create_program_address` is never
                    called with a user-supplied bump (AV-076, PDA-016).
[PARTIAL]   KV-105 Token-2022 Extension Abuse: markers present (token_2022 · get_extension · TransferFee).
                    TransferFee is read and rejected for quote mints (utils/token.rs:172-199); the non-badged quote
                    allowlist admits only MetadataPointer/TokenMetadata (:237-243). Not inspected anywhere:
                    PermanentDelegate, DefaultAccountState(Frozen), MintCloseAuthority, ConfidentialTransfer,
                    InterestBearing, and the base `freeze_authority` field — all reachable for a *badged* quote
                    mint. AV-063 / EXT-013 / F-005.
[PASS]      KV-106 Account Revival / Zombie After Close: markers present (close · lamports). Anchor 1.0's `close`
                    zeroes the data and reassigns the owner to the system program; none of the three closable
                    accounts is re-read after close, and re-deriving their seeds yields a fresh account that must
                    be re-initialized by the admin/operator (AV-055, AV-056, AV-057).
[PARTIAL]   KV-107 Fake / Non-Canonical ATA: markers present (associated_token · token::authority). ATAs are
                    enforced declaratively exactly where the destination is not the caller's own choice
                    (withdraw_leftover.rs:27-31, meteora_damm_claim_lp_token.rs:27-39,
                    meteora_damm_lock_lp_token.rs:44-48). The fee-claim and referral destinations are plain
                    InterfaceAccount<TokenAccount> — safe, because transfer_checked binds the mint and the claimer
                    is authenticated, but not canonical. AV-059.
[PASS]      KV-108 Token Decimals & Cross-Mint Amount Confusion: markers present (decimals · transfer_checked ·
                    multi-mint). Decimals are always read live from the mint (utils/token.rs:77, :134), bounded to
                    6..=9 at config time, and base and quote amounts are never added to or compared with each
                    other — the two sides are tracked in separate fields and separate fee counters throughout
                    (AV-061, ECON-049).
[N/A]       KV-109 Pinocchio / p-token Missing Manual Validation: [feature absent: pinocchio · p-token · no_std].
                    The program is Anchor 1.0 (AV-077).
[N/A]       KV-110 Agent Wallet Key Custody & Missing Spend Caps: [out of scope: no AI-agent component].
[PASS]      KV-111 BPF Stack Frame Overflow DoS: markers present (fixed-size arrays in on-chain code). The largest
                    stack-resident structures are the zero-copy account bodies, which are accessed by reference
                    through bytemuck rather than copied (Ref/RefMut, pool_account_loader.rs:43-57), and the
                    hot-path accounts are Boxed (`Box<InterfaceAccount<…>>` throughout the swap and claim
                    contexts). There is no recursion. The largest inline array is
                    `curve: [LiquidityDistributionConfig; 20]` (640 B) inside a Boxed/zero-copy account, not a
                    stack local. Compute-unit behaviour is measured at tests/simulate_cu_swap.tests.ts.
[N/A]       KV-112…KV-117 Off-chain Rust & Solana×AI vectors: [out of scope: no off-chain Rust service and no AI
                    agent in scope]. 6 vectors (112, 113, 114, 115, 116, 117). Note for the reader: the audited
                    tree contains no prompt-injection or instruction-bearing text addressed to an AI or auditor —
                    README.md, CHANGELOG.md, COMPATIBLE_TEST.md, license.md, .github/ and all code comments were
                    read and are ordinary technical prose. There is no .claude/, AGENTS.md, CLAUDE.md or
                    .cursorrules in the repository at this commit.
[N/A]       KV-118 Stake Account Authority Hijack: [feature absent: stake · StakeProgram · staker · withdrawer].
                    The program never touches stake accounts (OPS-076).
[PARTIAL]   KV-119 Durable-Nonce Pre-Signed Governance Abuse: [markers partially present: privileged instructions
                    exist, `nonce`/`durable_nonce` do not]. The program has no durable-nonce handling of its own and
                    its privileged surface is narrow and idempotent (OPS-077), but it also has no version or epoch
                    guard that would invalidate a stale pre-signed admin transaction after a key rotation — and
                    rotation itself requires a program upgrade (OPS-078). Combined with the absence of a timelock
                    and an outflow breaker (F-006), the defence-in-depth this vector asks for is not present.
[N/A]       KV-120 On-Chain Randomness Predictability & VRF Misbinding: [feature absent: random · vrf · switchboard
                    · slot_hashes · blockhash-derived entropy]. No randomness is used anywhere (ECON-071).
[N/A]       KV-121 cNFT / Account-Compression Merkle Proof Abuse: [feature absent: spl-account-compression ·
                    bubblegum · merkle · cNFT · proof]. The position NFTs minted at migration are ordinary
                    Token-2022 NFTs created by DAMM v2, not compressed NFTs.
[PARTIAL]   KV-122 Inner-Instruction / Event-Log Spoofing: markers present (emit_cpi · invoke · inner-instruction).
                    22 of the 23 event types use `emit_cpi!` (self-CPI), which an indexer can attribute reliably to
                    this program id. One uses plain `emit!` with an in-code caveat that the log "could be
                    truncated" (operator/ix_claim_protocol_fee2.rs:161-168) — SM-049. Separately, the two
                    highest-value instructions emit nothing at all, so an indexer reconstructing migration must
                    parse inner instructions from DAMM v2, which is exactly the fragile pattern this vector warns
                    about — F-011.
[PASS]      KV-123 Lamport-Donation Account Bricking: markers present (lamports · rent-exempt check). No instruction
                    assumes an exact balance — the one floor check uses `>=` (utils/token.rs:311-314), the rent
                    top-up is conditional (`if minimum_balance > current_lamport`, :276-282), and flash_rent uses
                    saturating_sub (flash_rent.rs:16). No builtin or sysvar is requested writable (AV-086).
                    A donation into a pool account is simply absorbed (AV-085).
[N/A]       KV-124 Custodial Cleartext Key Export: [out of scope: no wallet/custody component in this repository].
[FAIL-6]    KV-125 Bonding-Curve Launchpad Graduation & Migration Abuse: OPENED and walked — this vector cites an
                    audit of this exact protocol, so all five steps were executed.
                    Step 1 (locate graduation): is_curve_complete (state/virtual_pool.rs:1122-1124) gates the flip;
                      the completing swap sets progress at process_swap.rs:343-375; migration at
                      migrate_damm_v2_initialize_pool.rs:498-772. ✅
                    Step 2 (eligibility counts all buckets): PASS. The completion check compares only quote_reserve,
                      which excludes fees by construction (apply_swap_result, virtual_pool.rs:960-994), and the
                      terminal solvency check explicitly requires the base vault to still cover
                      migration_base_threshold + accumulated base fees + the FULL locked-vesting amount
                      (process_swap.rs:344-354) — i.e. the locked/vesting bucket IS counted, and deliberately. ✅
                    Step 3 (destination mint authorities renounced): ❌ FAIL. Base-mint freeze authority is always
                      None (AC-036) and mint authority is revoked for SPL and plain Token-2022 — but for
                      transfer-hook configs it is handed to a creator/partner key
                      (process_initialize_virtual_pool_with_token2022.rs:145-167). This is the vector's
                      "pre-created mint with attacker-held authority" bullet, in its dilution form.
                      Additionally, the transfer-hook program is itself an unrevoked freeze-equivalent until
                      graduation (F-001) — the vector's "bought tokens become unsellable" outcome.
                    Step 4 (migration DoS via mutability/ordering): PASS. Every account written during migration is
                      `mut` (virtual_pool, pool_authority, pool, both vaults, both mints, the position accounts —
                      migrate_damm_v2_initialize_pool.rs:34-125), migration is permissionless so it cannot be
                      withheld, and it is atomic (SM-044). ✅
                    Step 5 (reserve accounting at graduation): PASS. Amounts are derived from reloaded real
                      balances, not from stale virtual reserves: both vaults reload and the deposited deltas are
                      computed with safe_sub (:664-676), the base vault reloads again before the burn (:737-749),
                      and the protocol migration fee is reserved before anything is moved (:577-592). ✅
                    Overall verdict: ❌ on Step 3. See F-001 and F-002.
                    Fix: revoke the mint authority unconditionally (or add a supply invariant), and allowlist the
                    hook program.
[N/A]       KV-126 Session Token as Custody: [out of scope: no session/delegated-signing component].
[PASS]      KV-127 ATA / Account Pre-Creation DoS: markers present (init). No ATA is created by the program, and
                    every `init` target is either seeded on an unpredictable fresh mint keypair (pool, both vaults)
                    or is the keypair account itself with `signer` required (config) — so an attacker cannot
                    pre-create it to grief an honest instruction (AV-087, AC-039).
[PASS]      KV-128 On-Chain Floating-Point Financial Math: markers present would be (f32 · f64 · as f64 · .sqrt()).
                    Zero occurrences outside #[cfg(test)]. Exponential fee decay is fixed-point Q64.64
                    (math/fee_math.rs:13-201) and the square root is an integer binary-digit algorithm on U256
                    (utils_math.rs:74-96). Composite fee components are nested splits that cannot sum past the
                    denominator (AR-062). AR-063.
[PARTIAL]   KV-129 Keeper Request→Execute Front-Running & Reordering: markers present (permissionless crank /
                    two-step settlement). DBC's cranks are permissionless and idempotent, and their destinations
                    are config- or state-derived, so there is no request/execute value to steal (AC-010, SM-023).
                    The one caller-influenced degree of freedom is which DAMM v2 config the migration uses —
                    F-003.
[PASS]      KV-130 CLMM/DLMM Tick-Boundary & Liquidity Math: markers present (sqrt_price · liquidity · curve
                    segments). The curve is a 16-segment piecewise-constant-liquidity ladder rather than a tick
                    array, and the segment walk was verified in both directions: ascending uses curve[i].liquidity
                    for the range up to curve[i].sqrt_price (virtual_pool.rs:871-931), descending uses
                    curve[i+1].liquidity for the range down to curve[i].sqrt_price (:775-821), which is the
                    consistent pairing. Segments are strictly monotone increasing with non-zero liquidity
                    (process_create_config.rs:493-506), zero-liquidity slots are skipped rather than treated as
                    real (`continue` at :387-389, `break` at :477-479), the final partial segment is handled
                    explicitly against sqrt_start_price (:822-851) with a redundant lower-bound re-assertion
                    (:447-450), and every boundary crossing rounds toward the pool (AR-022/AR-023). The
                    price-boundary behaviour is exercised at tests/swap_over_curve.tests.ts and
                    tests/design_curve.tests.ts.
[PARTIAL]   KV-131 Write-Lock Account Contention DoS: markers present (shared writable account · #[account(mut)]).
                    Contention is low by design — there is no global writable state; the hottest shared account is
                    the per-pool VirtualPool, which is inherently serialised by trading. Two minor amplifiers: the
                    global pool_authority PDA is taken WRITABLE by every migration and locker instruction
                    (create_locker.rs:16-20, migrate_damm_v2_initialize_pool.rs:46-50,
                    migrate_meteora_damm_initialize_pool.rs:25-29) because of the flash-rent mechanism, so
                    concurrent migrations across *different* pools serialise against each other; and one
                    unnecessary `mut` on base_mint in CreateLockerCtx (AV-019). Neither is a DoS — migration is a
                    one-off per pool — but the flash-rent design does create a single global write lock.
[N/A]       KV-132 Canonical-Asset / Token-List Spoofing: [out of scope: no off-chain token registry or token-list
                    consumer in this repository].
[N/A]       KV-133 Token Risk-Score / Trust-Tier Metric Farming: [out of scope: no risk-score consumer].
[N/A]       KV-134 Token ACL (SRFC-37) Gate-Program Bypass & Permissionless-Freeze Griefing: [feature absent:
                    token_acl · TACLkU6 · MINT_CFG · gating_program · thaw_permissionless · DefaultAccountState +
                    delegated freeze authority]. Zero occurrences; the program neither implements nor consumes a
                    token-ACL gate. (The adjacent freeze-authority risk on quote mints is tracked at KV-019/F-005.)
[PASS]      KV-135 Transaction v1 Fee-Sponsor Cap Bypass & Disabled ComputeBudget Gates: evaluated for the on-chain
                    portion in scope (AV-089). No branch anywhere reads ComputeBudgetProgram instructions from the
                    Instructions sysvar, and there is no fee-sponsor / paymaster / co-signing path in the program —
                    the swap's `payer` is the trader's own Signer. The two introspection routines filter on
                    crate::ID and on specific discriminators (process_swap.rs:471-484, :529-546), so no-op
                    ComputeBudget instructions in a v1 message are simply skipped.
[PASS]      KV-136 Transaction v1 Reader Wedge & Zero-Budget Indexing: evaluated for the on-chain portion in scope
                    (AV-090). The introspection loops are bounded by the runtime's own instruction count rather
                    than by a constant, make no positional or "exactly N" assumption, tolerate interleaved
                    instructions, and do not depend on ALT resolution. The off-chain reader half (getTransaction /
                    getBlock / maxSupportedTransactionVersion) is out of PROGRAM scope — there is no indexer in
                    this repository.
```

### Known Vector Metrics

| Metric | Value |
|--------|-------|
| Total known vectors | 136 |
| In scope | 55 |
| PASS | 26 |
| FAIL | 2 |
| PARTIAL | 16 |
| UNKNOWN (unverifiable in scope) | 1 |
| N/A — feature absent (evidence-backed, in scope) | 10 |
| N/A — out of scope (scope gate) | 81 |
| Completion (in-scope) | **100 %** |

> In-scope total: 26 + 2 + 16 + 1 + 10 = 55.
> In-scope FAILs: KV-023 (→ F-001) and KV-125 (→ F-001 and F-002, failing the vector's own Step 3).
> KV-020 is `[UNKNOWN]` because the upgrade authority could not be queried (§3).

---

### Audit Metrics

| Metric | Value |
|--------|-------|
| Total checklist items evaluated | 591 |
| PASS | 308 (52.1 %) |
| FAIL | 22 (3.7 %) |
| PARTIAL | 109 (18.4 %) — of which 80 true `[PARTIAL]`, 28 `[UNKNOWN]`, 1 `[UNCONFIRMED]` |
| N/A | 152 (25.7 %) |
| **Pass rate** (excl. N/A) | **70.2 %** |
| Known vectors evaluated (in scope) | 55 / 55 (100 %) |
| Finding blocks | 12 |
| Findings carrying a Rule 5b downgrade token | 2 (F-003 `[UNCONFIRMED]`, F-009 `[UNDETERMINED]`) |
| PoC evidence tiers | 12 × `[PoC-PROSE]` (no executable harness — execution prohibited, §3) |
| Fix evidence tiers | none claimed (`/auditor:patch` not run — execution prohibited) |
| **Highest severity found** | **6** |
| **Repository Risk Score** | **6** — 🟡 MEDIUM (Rule 1: highest finding ≥ 5 ⟹ score = max(finding)) |

### Per-Checklist Summary

| # | Checklist | Items | Pass | Fail | Partial | N/A | Pass Rate (excl. N/A) |
|---|-----------|------:|-----:|-----:|--------:|----:|----------------------:|
| 01 | Account Validation | 90 | 53 | 2 | 15 | 20 | 75.7 % |
| 02 | Access Control | 50 | 35 | 2 | 5 | 8 | 83.3 % |
| 03 | Arithmetic Safety | 63 | 41 | 1 | 0 | 21 | 97.6 % |
| 04 | CPI & PDA Safety | 70 | 43 | 2 | 8 | 17 | 81.1 % |
| 05 | State Machine & Lifecycle | 72 | 47 | 1 | 8 | 16 | 83.9 % |
| 06 | Economic & Logic | 89 | 41 | 5 | 5 | 38 | 80.4 % |
| 07 | OpSec & Governance | 85 | 24 | 6 | 38 | 17 | 35.3 % |
| 16 | Formal Verification & Testing | 72 | 24 | 3 | 30 | 15 | 42.1 % |
| | **Total (in-scope)** | **591** | **308** | **22** | **109** | **152** | **70.2 %** |

> Checklist 07's low pass rate is dominated by its 28 `[UNKNOWN]` verdicts — items that require an on-chain query
> or an organisational fact the repository does not contain (upgrade authority, multisig configuration,
> incident-response process). They are unverified, not failed; on verifiable items alone checklist 07 passes
> 24/45 ≈ 53 %. Checklist 16's figure, by contrast, reflects real gaps: no fuzzing, no coverage measurement, no
> static analysis or dependency audit in CI, and thin negative testing.
>
> The 22 `FAIL` verdicts map to the 12 finding blocks as follows:
> F-001 → EXT-012, ECON-044 (2) · F-002 → AV-064, ECON-048, OPS-021 (3) · F-004 → OPS-014 (1) ·
> F-005 → AV-065, ECON-047 (2) · F-006 → AC-030, AC-035, ECON-072, ECON-089, OPS-045 (5) ·
> F-007 → FV-013, FV-019 (2) · F-008 → OPS-074 (1) · F-009 → AR-005, FV-029 (2) ·
> F-010 → OPS-028, OPS-036 (2) · F-011 → SM-047 (1) · F-012 → CPI-007 (1).
> **F-003 carries no `FAIL` verdict** — per Rule 5b it is recorded as `[UNCONFIRMED]` at AV-014 and is therefore
> not counted as a confirmed FAIL, while still appearing as a finding block so that it is tracked for follow-up.

---

## 7. Instruction Matrix

> All 31 instructions declared in `programs/dynamic-bonding-curve/src/lib.rs:31-315`. "VP" = `VirtualPool`,
> "THP" = `TransferHookPool`. Checked math is `yes` where every arithmetic operation on the path routes through
> `math/safe_math.rs` or U256/U512 widening.

| # | Instruction | Signers / gate | CPI targets | PDA seeds used | Checked math | State changes | Findings |
|---|---|---|---|---|---|---|---|
| 1 | `create_operator_account` | `signer` + `is_admin` (allowlist) | System (init) | `["operator", whitelisted]` | yes | creates `Operator` | F-004 |
| 2 | `close_operator_account` | `signer` + `is_admin` | — | — | n/a | closes `Operator` | F-004 |
| 3 | `close_claim_protocol_fee_operator` | `signer` + `is_admin` | — | — | n/a | closes `ClaimFeeOperator` | F-004 |
| 4 | `claim_protocol_pool_creation_fee` | `signer` + operator `ClaimProtocolFee` | lamport move (no CPI) | — | yes | `creation_fee_bits`, pool lamports → treasury | — |
| 5 | `create_token_badge` | `signer` + operator `CreateTokenBadge` | System (init) | `["token_badge", mint]` | n/a | creates `TokenBadge` | F-005 |
| 6 | `close_token_badge` | `signer` + operator `CloseTokenBadge` | — | — | n/a | closes `TokenBadge` | — |
| 7 | `claim_protocol_fee2` | `signer == protocol_fee_authority` PDA | Token / Token-2022 | `["pool_authority"]` | yes | protocol fee counters, surplus flag; vault → receiver | F-005 |
| 8 | `create_partner_metadata` | `payer`, `fee_claimer` | System (init) | `["partner_metadata", fee_claimer]` | n/a | creates `PartnerMetadata` | — |
| 9 | `create_config` | `payer`, `config` keypair (permissionless) | System (init) | keypair account | yes | creates `PoolConfig` | — |
| 10 | `create_config_with_transfer_hook` | `payer`, `config` keypair (permissionless) | System (init) | keypair account | yes | creates `ConfigWithTransferHook` | **F-001** |
| 11 | `claim_trading_fee` (VP) | `fee_claimer` + `is_partner_fee_claimer` | Token / Token-2022 | `["pool_authority"]` | yes | partner fee counters; vaults → claimer | — |
| 11b | `claim_trading_fee2` (VP/THP) | `fee_claimer` + `is_partner_fee_claimer` | Token-2022 + transfer hook | `["pool_authority"]` | yes | as above | F-001 |
| 12 | `claim_partner_pool_creation_fee` | `fee_claimer` + `is_partner_fee_claimer` | lamport move | — | yes | `creation_fee_bits`, pool lamports → receiver | — |
| 13 | `partner_withdraw_surplus` | `fee_claimer` + `is_partner_fee_claimer` | Token / Token-2022 | `["pool_authority"]` | yes | `is_partner_withdraw_surplus`; vault → claimer | F-005 |
| 14 | `initialize_virtual_pool_with_spl_token` | `creator`, `payer` (permissionless) | Token, Metaplex, System | `["pool",…]`, `["token_vault",…]`, `["pool_authority"]` | yes | creates VP + 2 vaults + mint; mints supply; revokes mint authority | — |
| 15 | `initialize_virtual_pool_with_token2022` | `creator`, `payer` (permissionless) | Token-2022, System | as above | yes | creates VP + 2 vaults + mint; mints supply; revokes mint authority | — |
| 16 | `initialize_virtual_pool_with_token2022_transfer_hook` | `creator`, `payer` (permissionless) | Token-2022, System | as above | yes | creates THP + 2 vaults + hooked mint; **may retain mint authority** | **F-002** |
| 17 | `create_virtual_pool_metadata` | `creator` + `is_pool_creator` | System (init) | `["virtual_pool_metadata", pool]` | n/a | creates `VirtualPoolMetadata` | — |
| 18 | `claim_creator_trading_fee`(2) | `creator` + `is_pool_creator` | Token / Token-2022 (+ hook) | `["pool_authority"]` | yes | creator fee counters; vaults → creator | F-001 |
| 19 | `creator_withdraw_surplus` | `creator` + `is_pool_creator` | Token / Token-2022 | `["pool_authority"]` | yes | `is_creator_withdraw_surplus`; vault → creator | F-005 |
| 20 | `transfer_pool_creator` | `creator` + `is_pool_creator` | — | — | n/a | `pool.creator` | — |
| 21 | `withdraw_migration_fee` | `sender` == `fee_claimer` or `pool.creator` (in-handler, by `flag`) | Token / Token-2022 | `["pool_authority"]` | yes | `migration_fee_withdraw_status`; vault → sender | F-005 |
| 22 | `swap` / `swap2` (VP only) | `payer` (permissionless) | Token / Token-2022 | `["pool_authority"]` | yes | price, both reserves, all fee counters, volatility, progress at completion | F-009 |
| 23 | `swap2_with_transfer_hook` (THP only) | `payer` (permissionless) | Token-2022 + **transfer hook**, mint `update`/`set_authority` at completion | `["pool_authority"]` | yes | as above + revokes the hook at completion | **F-001**, **F-002** |
| 24 | `create_locker` | `payer` (permissionless) | Jup `locker`, System | `["base_locker", pool]`, `["pool_authority"]` | yes | progress → `LockedVesting`; base_vault → escrow | — |
| 25 | `withdraw_leftover` | none (permissionless) | Token / Token-2022 | `["pool_authority"]` | yes | `is_withdraw_leftover`; base_vault → leftover_receiver ATA | — |
| 26 | `migration_meteora_damm_create_metadata` | `payer` (permissionless) | System (init) | `["meteora", pool]` | n/a | creates `MeteoraDammMigrationMetadata` | — |
| 27 | `migrate_meteora_damm` (legacy) | `payer` (permissionless) | `dynamic_amm`, Token, System | `["pool_authority"]` | yes | progress → `CreatedPool`; creates DAMM v1 pool; burns residual | **F-012**, F-011 |
| 28 | `migrate_meteora_damm_lock_lp_token` | `sender` (permissionless) | `dynamic_amm` | `["pool_authority"]` | yes | metadata lock flags; LP → lock escrow | — |
| 29 | `migrate_meteora_damm_claim_lp_token` | `sender` (permissionless) | Token | `["pool_authority"]` | yes | metadata claim flags; LP → owner ATA | — |
| 30 | `migration_damm_v2_create_metadata` (deprecated) | none | — | — | n/a | **none — no-op** | — |
| 31 | `migration_damm_v2` | `payer`, `first/second_position_nft_mint` keypairs (permissionless) | `damm_v2`, Token-2022, Token, System | `["pool_authority"]` | yes | progress → `CreatedPool`; creates DAMM v2 pool, 1-2 positions, locks/vests, burns residual | **F-003**, F-011 |

---

## 8. State Model Verification

### Account Types

| Account | Discriminator | Space | Owner enforced | Close target |
|---|---|---|---|---|
| `PoolConfig` | Anchor 8-byte, verified in `ConfigAccountLoader` | 8 + 1040 | yes (`config_account_loader.rs:17-20`) | never closed |
| `ConfigWithTransferHook` | Anchor 8-byte, distinct from `PoolConfig` | 8 + 1120 | yes (same loader) | never closed |
| `VirtualPool` | Anchor 8-byte, verified in `PoolAccountLoader` | 8 + 416 | yes (`pool_account_loader.rs:17-20`) | never closed (SM-008) |
| `TransferHookPool` | Anchor 8-byte, distinct from `VirtualPool` | 8 + 416 | yes (same loader) | never closed |
| base / quote vault | SPL token account | 165 / 165+ | yes (`token::` constraints + `pool.*_vault ==` re-bind) | never closed |
| `Operator` | Anchor 8-byte | 8 + 64 | yes (`AccountLoader`) | `rent_receiver` (unconstrained — AV-025) |
| `ClaimFeeOperator` (legacy) | Anchor 8-byte | 8 + 160 | yes | `rent_receiver` (unconstrained) |
| `TokenBadge` | Anchor 8-byte | 8 + 160 | yes | `rent_receiver` (unconstrained) |
| `PartnerMetadata` | Anchor 8-byte | 8 + variable | yes | never closed |
| `VirtualPoolMetadata` | Anchor 8-byte | 8 + variable | yes | never closed |
| `MeteoraDammMigrationMetadata` | Anchor 8-byte | 8 + 272 | yes | never closed |
| `MeteoraDammV2Metadata` (dead) | Anchor 8-byte | 8 + 222 | n/a — no loader remains | n/a |

### State Machine Transitions

```
                    initialize_virtual_pool_*            (permissionless)
                              |
                              v
                     [ PreBondingCurve ]  <-- transfer_pool_creator allowed
                              |
                   swap that fills quote_reserve >= migration_quote_threshold
                   + solvency assert: base_vault >= migration_base_threshold
                                              + protocol/partner/creator base fees
                                              + locked_vesting total
                   + (THP only) revoke_transfer_hook
                              |
                 has locked vesting? ---- yes ----> [ PostBondingCurve ]
                              |                             |
                              no                     create_locker (permissionless)
                              |                     base_vault --> Jup Lock escrow
                              v                             |
                     [ LockedVesting ]  <--------------------
                              |
             migration_damm_v2  /  migrate_meteora_damm     (permissionless)
             creates the AMM pool, deposits both reserves,
             locks/vests LP, transfers positions, burns residual
                              |
                              v
                     [ CreatedPool ]  (terminal, absorbing)
                              |
                 withdraw_leftover (fixed-supply configs only)
                 migrate_meteora_damm_{lock,claim}_lp_token (DAMM v1 only)
                 transfer_pool_creator (once LP fully settled)

Gated on is_curve_complete (not on progress), i.e. available from graduation onward:
   partner_withdraw_surplus · creator_withdraw_surplus ·
   claim_protocol_fee2 (surplus portion) · withdraw_migration_fee
Available throughout: claim_trading_fee(2) · claim_creator_trading_fee(2) ·
   claim_*_pool_creation_fee · create_virtual_pool_metadata
```

### Invariants Verified

| # | Property | How verified | Status |
|---|---|---|---|
| INV-01 | `quote_vault.amount == quote_reserve + protocol_quote_fee + partner_quote_fee + creator_quote_fee` before graduation | Reconstructed across `apply_swap_result` (`state/virtual_pool.rs:960-994`) and all claim paths (`:1041-1113`) | ✅ PASS (by reading; **not** machine-checked — FV-006) |
| INV-02 | The four post-graduation quote draws sum exactly to the vault balance | surplus (`:1130-1166`) + migration deposit + migration fee (`state/config.rs:846-874`) + protocol migration fee = `quote_reserve + fees` | ✅ PASS |
| INV-03 | At graduation, `base_vault ≥ migration_base_threshold + Σ base fees + locked_vesting_total` | Enforced on-chain at `process_swap.rs:344-354` after `reload()` | ✅ PASS (enforced, not merely asserted by the auditor) |
| INV-04 | Free base at graduation `= 0.25 × swap_base_amount ≥ 0` | Derived from `SWAP_BUFFER_PERCENTAGE` (`constants.rs:45`) + `get_swap_amount_with_buffer` (`state/config.rs:876-895`) | ✅ PASS |
| INV-05 | Every fee split conserves: `Σ parts == total` | Each split derives one side by `safe_sub` from the same total (AR-038) | ✅ PASS |
| INV-06 | Every curve rounding step favours the pool | All four directions walked (AR-022, AR-023) | ✅ PASS |
| INV-07 | `sqrt_start_price ≤ sqrt_price ≤ migration_sqrt_price` at all times | Lower bound clamped at `virtual_pool.rs:830-841` + re-asserted `:447-450`; upper bound at `:875, :329-332` | ✅ PASS |
| INV-08 | Base supply is fixed at `get_initial_base_supply()` | Holds for SPL and plain Token-2022 (mint authority revoked) | ❌ **FAIL for transfer-hook pools** — F-002 |
| INV-09 | A holder can always exit into the curve while the pool is live | Holds for SPL and plain Token-2022 pools | ❌ **FAIL for transfer-hook pools** — F-001 |
| INV-10 | Every one-shot economic action can occur at most once | Flags/bits enumerated and every setter is preceded by its eligibility check (SM-045) | ✅ PASS |
| INV-11 | `CreatedPool` is absorbing | No writer lowers `migration_progress` (SM-065) | ✅ PASS |

---

## 9. Code Maturity Scorecard

> Phase 4.5. Engineering-quality gate, orthogonal to the risk score. 0 absent · 1 ad-hoc · 2 partial · 3 good ·
> 4 strong. Weakest-link scoring.

| # | Category | Score (0-4) | Evidence (file:line / artifact) | Gap to next level |
|---|----------|:-----------:|---------------------------------|-------------------|
| 1 | Access Controls | **3** | Six clearly separated roles, all bound to state or to a compiled allowlist (`access_control.rs:8-54`); admin cannot touch funds (AC-016); operator permissions are bit-scoped and unit-tested (`tests/test_operator_permission.rs`) | Remove the `local` god-mode branch (F-004); add two-step admin rotation (OPS-078); seed-constrain the `Operator` account at its point of use (PDA-009) |
| 2 | Arithmetic | **4** | `SafeMath`/`SafeCast` traits with `#[track_caller]` diagnostics (`math/safe_math.rs`); `overflow-checks = true` in release (`Cargo.toml:6`); U128→U256→U512 widening ladder; no floating point; all four rounding directions favour the pool; six proptest suites | Close the one raw-`ruint` block (F-009) and extend its property tests to the full `u64` domain (FV-029) |
| 3 | Account & Type Safety | **3** | Typed accounts throughout; two custom loaders enforcing owner + discriminator + length (`pool_account_loader.rs:16-41`); canonical bumps including a compile-time derivation with its own test (`const_pda.rs`, `tests/test_const_pda.rs`); ten layout `const_assert_eq!`s | Type the three `UncheckedAccount` mints (AV-007); constrain the forwarded DAMM v1 programs (F-012); add `size_of == INIT_SPACE` asserts |
| 4 | Input Validation | **3** | `ConfigParameters::validate` + `process_create_config` cross-validate the entire config atomically from the params, with two-sided bounds on every numeric (OPS-082, OPS-083, OPS-084); remaining-accounts lengths and types fully accounted (AV-032, AV-036) | Inspect quote-mint `freeze_authority` and the transfer-fee authority (F-005); allowlist the transfer-hook program (F-001); bound the metadata string lengths (AV-042) |
| 5 | Testing | **3** | 40 integration files / 213 `it()` blocks covering every instruction, against real `.so` fixtures for all four CPI targets; 17 in-crate unit modules; a dedicated backwards-compatibility suite against four historical IDLs (FV-028) | Systematic negative/authorization tests (FV-038, FV-064); coverage measurement (FV-033); widen the CI path filter so tests actually run (F-007) |
| 6 | Fuzzing & Property Tests | **2** | Six proptest suites at 10 000 cases each, including an exact supply round-trip identity (`tests/test_total_supply.rs:239-272`) | No stateful instruction fuzzer (Trident/Crucible), no conservation-invariant property test (FV-006), proptest regressions are gitignored (FV-027), the rate-limiter domain is truncated (FV-029) |
| 7 | Error Handling & DoS Resilience | **3** | 78 specific error variants; every fallible call uses `?`; no silent swallowing; all loops bounded; no recursion; no `unsafe`; zero-amount and slippage guards on every swap | Convert the five `assert!`s in `curve.rs` to `require!`; remove the four optional-account `.unwrap()`s in the migration handler; fix the raw-`ruint` panic path (F-009) |
| 8 | Upgradeability & Governance | **1** | Fees and configs are immutable by construction (AC-024) and the treasury address is a compile-time constant (OPS-058), which are genuine strengths | **No emergency pause and no outflow breaker at all (F-006)**; no admin rotation without an upgrade (OPS-078); upgrade-authority custody, threshold and timelock unverifiable (OPS-001..012); no `SECURITY.md` and no documented IR plan (OPS-044, OPS-047) |
| 9 | Monitoring & Incident Response | **1** | 23 event types, 22 of them via the untruncatable `emit_cpi!`, and `EvtCreateConfigV2` publishes the entire config | **The two migration instructions emit nothing (F-011)**; the DAMM v1 LP handlers emit nothing; one event still uses truncatable `emit!`; no IR runbook, no security contact, no bug bounty referenced in-repo |
| | **Weighted Maturity (weakest-link)** | | **2.6 / 4.0** | Categories 8 and 9 score ≤ 1 and are prioritised first in §10 regardless of finding severity |

---

## 10. Remediation Roadmap

> Also written to `audit_2/roadmap.md`. Maturity categories scoring ≤ 1 (8 — Upgradeability & Governance,
> 9 — Monitoring & IR) are placed first, ahead of individually higher-severity items, per Phase 4.5.

### Priority 0 — Maturity categories scoring ≤ 1 (do these first)

| Item | Source | Fix | Effort | Owner |
|---|---|---|---|---|
| No emergency pause / outflow breaker | F-006 (maturity cat. 8) | Add a `paused` byte in `PoolConfig`'s existing padding + an operator-gated `set_pause`; gate the swap engine and leave exit paths open; hold the pause key separately from the upgrade authority | 2-3 days | protocol |
| Migration emits no events | F-011 (maturity cat. 9) | Add `#[event_cpi]` to both migration contexts and emit `EvtMigrateDammV2` / `EvtMigrateDammV1`; switch `ix_claim_protocol_fee2.rs:162` to `emit_cpi!` | 1 day | protocol |
| No security contact / IR plan | OPS-044, OPS-047 | Add `SECURITY.md` with a disclosure address, response SLA and the upgrade-authority/multisig disclosure | 2 hours | protocol |
| Upgrade authority unverified | OPS-001..OPS-012 | Publish the upgrade authority, its threshold and any timelock; ideally publish the verifiable-build hash per release (OPS-026, OPS-071) | 1 day | protocol |

### Immediate — Severity 9-10 (Block Deploy)

None.

### Before Release — Severity 7-8

None.

### Within 2 Weeks — Severity 5-6

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-001 | 6 | Allowlist transfer-hook programs behind an operator-issued `HookBadge` (mirroring `TokenBadge`), or at minimum reject upgradeable hook programs; surface the hook in the pool event so integrators can label the market | 3-5 days | protocol |
| F-002 | 6 | Make `require!(token_mint_authority.is_none())` unconditional in `process_initialize_virtual_pool_with_token2022.rs:148-153`; if options 3/4 must stay, add `require!(base_mint.supply <= config.get_initial_base_supply()?)` to the swap path | 1-2 days | protocol |
| F-003 | 5 `[UNCONFIRMED]` | Add `damm_config.collect_fee_mode == migrated_collect_fee_mode.to_dammv2_collect_fee_mode()?` and `damm_config.config_type == 0` to `validate_config_key`; **first** enumerate the live DBC-authorised DAMM v2 config set to confirm or dismiss reachability | 4 hours + verification | protocol |

### Next Sprint — Severity 3-4

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-004 | 4 | `compile_error!` on `local` + release/BPF target, or replace the boolean override with a localnet `ADMINS` array | 2 hours | protocol |
| F-005 | 4 | Return `false` from `is_supported_quote_mint` when `freeze_authority.is_some()` (both token programs) and require `transfer_fee_config_authority.is_none()` | 4 hours | protocol |
| F-007 | 4 | Widen the CI path filter to `libs/`, `idls/`, `Cargo.toml`, `Cargo.lock`, `Anchor.toml`, `rust-toolchain.toml`, `tests/`; add `cargo clippy -- -D warnings` and `cargo audit` jobs | 3 hours | devops |
| F-008 | 4 | SHA-pin every third-party GitHub Action; add `permissions: contents: read`; enable Dependabot for `github-actions` | 2 hours | devops |
| F-009 | 4 `[UNDETERMINED]` | Replace the raw `ruint` operators at `fee_rate_limiter.rs:154-162` with the existing U256 `SafeMath` impl; raise the proptest bound to `u64::MAX` and sweep `fee_increment_bps` fully | 4 hours | protocol |
| F-010 | 3 | Burn the committed key, rewrite it out of history, gitignore `keys/`, generate it in CI, enable secret scanning + push protection | 3 hours | devops |
| F-011 | 3 | See Priority 0 | — | — |
| F-012 | 3 | Add `address =` constraints to `metadata_program` / `vault_program` and type `rent` / `associated_token_program` in `MigrateMeteoraDammCtx`; derive `virtual_pool_lp` as the pool_authority ATA (closing the in-code `// TODO`) | 3 hours | protocol |

### Backlog — Notes & Nitpicks (no severity)

| Item | Fix | Effort |
|---|---|---|
| `.unwrap()` on optional accounts before the `None` guard | Move the `else { return Err(InvalidAccount) }` checks above `create_second_position` | 1 hour |
| `assert!` in `curve.rs` (5 sites) | Convert to `require!` with a `PoolError` | 1 hour |
| `INIT_SPACE` vs `size_of` in the custom loaders | Add `const_assert_eq!(size_of::<PoolState>(), PoolState::INIT_SPACE)` (and for `PoolConfig`) | 30 min |
| `&instruction.data[..8]` / `accounts[2]` indexing | Use `.get(..8)` / `.get(2)` | 30 min |
| Dead code (`is_claim_fee_operator`, `EvtCreateClaimFeeOperator`, `MeteoraDammV2Metadata`, the no-op deprecated instruction) | Remove as the deprecation notes already promise | 2 hours |
| Five unresolved `// TODO check … round down or round up` comments | Resolve and document the verified direction | 1 hour |
| `test_swap_wont_depelete_reserve` asserts nothing | Add the conservation assertions and seed the RNG | 2 hours |
| `quote_reserve` not decremented on surplus withdrawal | Decrement, or document that it is intentionally frozen at completion | 1 hour |
| Unbounded metadata string lengths | `require!(name.len() <= 64 …)` | 1 hour |
| Terminal-state cleanup duplicated across the two migration handlers | Extract one `finalize_migration()` helper | 4 hours |
| Unbounded `add_liquidity` thresholds (`u64::MAX`) | Pass the computed leftover amounts as the thresholds | 2 hours |

---

## 11. Re-Audit Checklist

- [ ] All Critical findings fixed and verified — **n/a, none found**
- [ ] All High findings fixed and verified — **n/a, none found**
- [ ] Medium findings (F-001, F-002, F-003) addressed or accepted with documented, published risk
- [ ] F-003's reachability resolved by enumerating the live DBC-authorised DAMM v2 config set
- [ ] Low findings (F-004 … F-012) addressed
- [ ] Maturity categories 8 and 9 raised above 1 (pause mechanism, migration events, `SECURITY.md`)
- [ ] Regression tests added for each fix — in particular a conservation-invariant property test (FV-006) and a
      full-domain rate-limiter proptest (FV-029)
- [ ] `cargo clippy -- -D warnings` and `cargo audit` green in CI, on a widened path filter
- [ ] Program re-deployed and the verifiable-build hash published per release
- [ ] Binary hash matches source code (`solana-verify` / `anchor verify`)

---

## 12. Appendices

### A. Tool Versions

```
Declared by the repository (NOT executed — see §3):
  anchor-cli : 1.0.2          (Anchor.toml:15, .github/workflows/ci.yml:11)
  solana-cli : 3.1.10         (Anchor.toml:16, Cargo.toml:49, .github/workflows/ci.yml:10)
  rustc      : 1.93.0         (rust-toolchain.toml:2, .github/workflows/ci.yml:12)
  anchor-lang / anchor-spl / anchor-client : 1.0.2   (Cargo.toml:17-19)
  bun        : oven-sh/setup-bun@v2 (unpinned minor)
  typescript : ^5.9.3         (package.json:28)

Used by the auditor:
  auditor-skill : 7.3.0@6bb2cbf  (corpus at vendor/auditor-skill, read-only)
  static analysis only — no compiler, package manager, validator or RPC client was invoked.
```

### B. Environment

```
OS              : Linux 6.6.87.2-microsoft-standard-WSL2
Cluster tested  : none — no cluster, validator or RPC was contacted (§3)
RPC Provider    : none
Method          : static, read-only source review at commit f552f20aa3c1c7631427c3827aeea7c58b902813
Artifacts       : audit_2/intake.md · audit_2/checkpoints.md · audit_2/checkpoint-02.md ·
                  audit_2/REPORT.md · audit_2/roadmap.md
```

### C. Trust Model & Actors

Derived from `audit_2/intake.md` §6. A finding gated by a trusted role is capped in severity *because* of what is
recorded here; where an actor is untrusted, a bypass by that actor is a full-severity finding.

| Actor | How gated | Trusted to | Trusted NOT to | Verified? |
|---|---|---|---|---|
| Upgrade authority | unknown custody | upgrade the program | push a malicious upgrade | ❌ unverifiable (OPS-001) |
| Admin | compiled allowlist, 2 keys (`admin/auth.rs:6-9`) | create/close `Operator`s, close legacy `ClaimFeeOperator`s | grant operator rights to a hostile key | ✅ scope verified (AC-016) |
| Operator | admin-minted `Operator`, permission bitmask | claim protocol fees, create/close `TokenBadge`s | badge a hostile mint | ✅ scope verified (AC-029) |
| Partner (`config.fee_claimer` / `owner`) | **permissionless to become** | set every curve/fee/migration parameter; claim partner fees and surplus | — untrusted toward the protocol; **trusted by the users of their own pools** | ✅ parameters bounded (OPS-082/083/084); ❌ hook program unbounded (F-001) |
| Pool creator (`pool.creator`) | whoever calls `initialize_*` | claim creator fees and surplus; update token metadata; transfer creatorship | — untrusted toward the protocol | ✅ except mint authority on hook pools (F-002) |
| Keeper / cranker | **none — permissionless** | trigger locker, migration, leftover, LP claim/lock | reorder or withhold to grief | ✅ destinations are state-derived (AC-010); one degree of freedom remains (F-003) |
| Trader | anyone | swap on any live pool | — untrusted (the attacker) | ✅ |
| Transfer-hook program | **partner-chosen, unvalidated** | run arbitrary code inside every base transfer | block or discriminate between transfers | ❌ **F-001** |
| Quote-mint authority | third party chosen by the partner | — | freeze the vault, raise a transfer fee | ❌ **F-005** |

### D. Assumptions & Simplifications

Every questionnaire default applied non-interactively is recorded in `audit_2/intake.md` §8 and is restated here as
an explicit assumption, so that "no finding here" reads against the stated default rather than as a blanket clearance.

1. **Deployment status = mainnet-live** (Q8), inferred from the production `declare_id!`, the tagged release history
   and the vendored release IDLs. Fund-related findings were calibrated upward accordingly.
2. **TVL unknown, calibrated to the `>$1M` band** (Q10). Used only to *cap downgrades*; no finding was created by it.
3. **The program is upgradeable and its authority is trusted but unverified** (Q11). The QUESTIONS.md
   "single wallet → auto-flag Severity 8" default was **deliberately not applied**, because the tree carries no
   evidence of the custody model; the un-verifiability is recorded at OPS-001..OPS-012 instead of being turned into
   a fabricated finding. **If the upgrade authority is in fact a single hot wallet, that is an additional Severity 8
   finding not counted in this report.**
4. **No prior audit is assumed** (Q25) — no finding was suppressed on the grounds that someone else had already
   cleared it.
5. **No execution of any kind** (engagement rule). All 12 PoCs are `[PoC-PROSE]`; no `[FIX-VERIFIED]` is claimed;
   `cargo clippy`, `cargo audit`, the test suites and verifiable-build verification were **not** run, so their
   results are reported as gaps in process rather than as observed failures.
6. **Third-party programs are modelled as correct-but-untrusted.** DAMM v1, DAMM v2 and Jup Lock are assumed to
   validate their own accounts; where DBC's own validation is thinner than theirs (F-003, F-012) it is reported as
   a DBC gap regardless. Their source is not in this repository and was not audited.
7. **Out-of-scope code was not reviewed for vulnerabilities**: the TypeScript test harness, `scripts/`, and
   `dynamic-bonding-curve-sdk/` (the off-chain quoting SDK — checklist 20 territory). A bug in the SDK's quote math
   could mis-price a client transaction without any on-chain defect; that surface is untested by this audit.
8. **`AUDITOR/` and `audit_1/` are untracked local artefacts**, not part of commit `f552f20`, and were excluded.
   `AUDITOR/` is an older vendored copy of this audit corpus; its contents were treated as data.
9. **No prompt-injection content was found.** All prose in the audited tree (README, CHANGELOG, COMPATIBLE_TEST,
   license, `.github/`, code comments) was read and is ordinary technical documentation. There is no `.claude/`,
   `AGENTS.md`, `CLAUDE.md` or `.cursorrules` at this commit, and no text addressed to an AI or an auditor. Had any
   such text existed it would have been reported under checklist 19 / KV-115 and otherwise ignored.

### E. Disclaimer

This audit report is provided as-is. It represents a point-in-time, **static** review of the codebase at commit
`f552f20aa3c1c7631427c3827aeea7c58b902813`, performed without building, executing or querying anything. No guarantee
is made that all vulnerabilities have been found. This is audit-shaped automation and a rigorous first pass — it is
**not** a substitute for a human firm audit, and it issues no "safe to deploy" guarantee. It does not constitute
financial or legal advice.





