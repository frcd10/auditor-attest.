# 🔒 Security Audit Report

## 1. Executive Summary

**Repository:** MeteoraAg / damm-v2 (Meteora Constant Product AMM — `cp-amm`)
**Commit:** `a85c926607433f23f0ea60f4ca7b1ae92f4156cb` (short `a85c926`, "Release 0.2.4 (#225)")
**Branch:** detached HEAD at the release commit (main line)
**Date:** 2026-09-12
**Auditor:** auditor-skill 7.3.0@6bb2cbf — autonomous agent, Mode 1 (FULL repository audit), single-agent linear walk
**Scope:** PROGRAM (`--scope program`)
**Program ID:** `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG` (mainnet-beta + devnet, per `README.md`)
**Languages Detected:** Rust (on-chain program, Anchor 1.0.2 + Pinocchio fast path), TypeScript (integration tests, out of scope), TOML/YAML/JSON configuration
**Repository Risk Score:** 5 — 🟡 MEDIUM

### What We Found

Every non-test source file of the on-chain program was read in full — 80 files / 11,903 lines — and evaluated against the 591 in-scope checklist items and 53 in-scope known attack vectors. **No critical or high-severity issue was found: nothing in this program allows a permissionless attacker to drain a pool, mint liquidity, bypass position ownership, or escape the swap invariant.** The core value-moving machinery is genuinely well built: checked arithmetic with U256/U512 widening throughout, canonical PDA bumps everywhere, slippage enforced on the *net* post-transfer-fee amount in all three swap modes, reward accumulators flushed before every mutation of their own denominator, and a hand-written Pinocchio fast path that re-implements every Anchor account constraint rather than assuming them.

The highest-severity finding is **F-001 (severity 5)**: `update_pool_fees` caps a post-creation *base*-fee raise at 10 % (`MAX_FEE_NUMERATOR_POST_UPDATE`) but applies no equivalent bound to the *dynamic*-fee component written by the same instruction, so a whitelisted operator can raise the effective swap fee on an existing pool to the 99 % ceiling, immediately and with no timelock. It is privilege-gated, which is what keeps it out of the HIGH band, but it defeats a cap the code itself demonstrably intends to enforce. The remaining findings cluster in governance and operational maturity rather than in protocol logic: no timelock or event trail on operator actions (F-001, F-006), a build feature that disables the admin allowlist entirely (F-002), a CI action pinned by a mutable tag (F-003), a permanently squattable customizable-pool address (F-004), and a private key committed to the repository (F-005).

**Deploy guidance:** this report does not issue a "safe to deploy" guarantee. The program is already live on mainnet-beta. Nothing found here warrants an emergency halt. F-001 should be fixed before the next release, and the governance gaps (F-002, F-006, and the absence of any on-chain timelock) should be closed because they are the levers an attacker would reach for after a key compromise — which is the residual risk this audit cannot bound, since the upgrade authority and multisig configuration are not observable from the repository.

### Severity Distribution

| Score | Label | Count |
|-------|-------|-------|
| 10 | 🔴 CRITICAL | 0 |
| 9 | 🔴 CRITICAL | 0 |
| 8 | 🟠 HIGH | 0 |
| 7 | 🟠 HIGH | 0 |
| 6 | 🟡 MEDIUM | 0 |
| 5 | 🟡 MEDIUM | 1 |
| 4 | 🔵 LOW | 2 |
| 3 | 🔵 LOW | 7 |
| 2 | ⚪ INFO | 5 |
| 1 | ⚪ INFO | 0 |
| **Total Findings** | | **15** |

### Items Verified

| Metric | Count |
|--------|-------|
| Total checklist items (in scope) | 591 |
| PASS | 299 |
| FAIL | 30 |
| PARTIAL | 89 |
| N/A | 150 |
| UNKNOWN (not observable offline) | 23 |
| Completion | 100 % (591 / 591) |

---

## 2. Scope Coverage

> Which checklists and vector groups were in scope, and how many items were evaluated. Out-of-scope items render `[N/A — out of scope]` from the scope gate (Rule 0), not from reading each file.

| Checklist / vector group | In scope? | Items evaluated / total | Trigger / reason |
|---|---|---|---|
| 01 Account Validation | Yes | 90 / 90 | `.rs` + `Anchor.toml` |
| 02 Access Control | Yes | 50 / 50 | `.rs` + `Anchor.toml` |
| 03 Arithmetic Safety | Yes | 63 / 63 | `.rs` + `Anchor.toml` |
| 04 CPI & PDA Safety | Yes | 70 / 70 | `.rs` + `Anchor.toml` |
| 05 State Machine & Lifecycle | Yes | 72 / 72 | `.rs` + `Anchor.toml` |
| 06 Economic & Logic | Yes | 89 / 89 | `.rs` + custodial funds (intake Q17 = yes) |
| 07 OpSec & Governance | Yes | 85 / 85 | `--scope program` |
| 16 Formal Verification & Testing | Yes | 72 / 72 | `--scope program` |
| 08–10 off-chain (TS / backend / web) | No | 0 / 279 | OUT-OF-SCOPE (`--scope program`; the only TypeScript in the tree is the integration-test harness) |
| 11 Supply Chain | No | 0 / 52 | OUT-OF-SCOPE (`--scope program`; partially reached via OPS-074/075) |
| 12 Secrets & Key Mgmt | No | 0 / 53 | OUT-OF-SCOPE (`--scope program`; reached via OPS-027/028/036) |
| 13 Deployment & Infra | No | 0 / 89 | OUT-OF-SCOPE (`--scope program`) |
| 14 Python | No | 0 / 82 | OUT-OF-SCOPE (no `.py` in the tree) |
| 15 General Language | No | 0 / 88 | OUT-OF-SCOPE (no Go/Java/Ruby/PHP in the tree) |
| 17 Logging, Monitoring & IR | No | 0 / 65 | OUT-OF-SCOPE (`--scope program`; reached via OPS-044–052 and SM-047–050) |
| 18 Privacy, Compliance & Change Mgmt | No | 0 / 60 | OUT-OF-SCOPE (`--scope program`; program stores no PII) |
| 19 AI Agent Security | No | 0 / 33 | OUT-OF-SCOPE (no `.mcp.json`, no agent SDK, no LLM dependency) |
| 20 Rust Off-Chain Services | No | 0 / 21 | OUT-OF-SCOPE (`rust-sdk/` is a quoting library excluded by `--scope program`) |
| KV crypto / on-chain (1–30) | Yes | 30 / 30 | phase 1 + Rust/Anchor trigger |
| KV modern on-chain (101–109) | Yes | 9 / 9 | sysvar · Token-2022 · Pinocchio · PDA-bump triggers |
| KV governance & randomness (118–120) | Yes | 3 / 3 | on-chain phase |
| KV on-chain subset (121–123, 125, 127–131, 134–135) | Yes | 11 / 11 | on-chain phase + feature markers |
| KV backend / frontend / devops (31–100) | No | 0 / 70 | OUT-OF-SCOPE (`--scope program`) |
| KV AI + off-chain Rust (110–117) | No | 0 / 8 | OUT-OF-SCOPE (no agent/off-chain-Rust surface in scope) |
| KV custody / registry / reader (124, 126, 132, 133, 136) | No | 0 / 5 | OUT-OF-SCOPE (wallet custody, token registries and RPC readers are off-chain surfaces) |

### Scope Metrics

| Metric | Count |
|---|---:|
| In-scope checklist items | 591 |
| Items with a verdict | 591 |
| In-scope known-vectors | 53 |
| Known-vectors with a verdict | 53 |
| Completion (in-scope) | 100 % |

---

## 3. Scope & Methodology

### Files Audited

| Domain | Language | Files | Lines of Code |
|---|---|---|---|
| Solana program (`programs/cp-amm/src`, non-test) | Rust | 80 | 11,903 |
| Program unit / property tests (`programs/cp-amm/src/tests`) | Rust | 20 | 2,445 |
| Proc-macro crate (`libs/derive-variant-count`) | Rust | 1 | 28 |
| Integration tests (`tests/`) — read for checklist-16 evidence only | TypeScript | 50 | 29,377 |
| Off-chain quoting SDK (`rust-sdk/`) — out of scope, inventoried only | Rust | 12 | 840 |
| Build / CI / config (`Anchor.toml`, `Cargo.toml`, `rust-toolchain.toml`, `.github/`, `keys/`) | TOML / YAML / JSON | 14 | — |
| **Total in scope** | | **101** | **14,376** |

**Method.** Phase 0 established the program identity and account graph; Phase 0.5 reconstructed every value-moving function from the code (never from comments or the README) before any verdict was assigned; Phase 1 walked the 26 instruction handlers one file at a time; Phases 2–3 covered the build/CI/governance surface reachable under `--scope program`; Phase 4 ran the 53 in-scope known vectors; Phase 4.5 produced the maturity scorecard. Every `[FAIL-N]` with N ≥ 6 would have required a completed Rule 5b validation gate — none survived to that band, and the two candidates that were initially scored there are recorded with their downgrade levers in §4.

**Constraint.** Per the engagement rules this audit is **static and read-only**: nothing was built, installed, executed, or fetched over the network. Twenty-three checklist items whose answer lives on-chain or in an organisation's operational practice (upgrade authority, multisig threshold, hardware-wallet custody, verifiable-build reproduction) are therefore recorded as `[UNKNOWN]` rather than guessed, per OUTPUT-RULES Rule 10.

### Checklists Applied

| # | Checklist | Items | Pass | Fail | Partial | N/A | Unknown | Pass Rate (excl. N/A + Unknown) |
|---|---|---|---|---|---|---|---|---|
| 01 | Account Validation | 90 | 64 | 2 | 11 | 13 | 0 | 83.1 % |
| 02 | Access Control | 50 | 34 | 3 | 9 | 4 | 0 | 73.9 % |
| 03 | Arithmetic Safety | 63 | 42 | 1 | 5 | 15 | 0 | 87.5 % |
| 04 | CPI & PDA | 70 | 41 | 0 | 6 | 23 | 0 | 87.2 % |
| 05 | State Machine | 72 | 44 | 2 | 6 | 20 | 0 | 84.6 % |
| 06 | Economic & Logic | 89 | 33 | 6 | 10 | 40 | 0 | 67.3 % |
| 07 | OpSec & Governance | 85 | 14 | 9 | 16 | 23 | 23 | 35.9 % |
| 16 | Formal Verification & Testing | 72 | 27 | 7 | 26 | 12 | 0 | 45.0 % |
| | **Total (in scope)** | **591** | **299** | **30** | **89** | **150** | **23** | **71.5 %** |

> Only in-scope checklists are counted. Checklists 08–15 and 17–20 are excluded entirely by the `--scope program` gate and contribute no items to these totals.

---

## 4. Findings

> Findings are ordered by severity descending. Every scored finding (severity 1–10) carries a full block so that the Severity Distribution table in §1 equals the number of blocks below. Observations with **no** security impact are not scored — they are collected in §4.16 Notes & Nitpicks.

---

#### [F-001] Dynamic-fee update path bypasses the 10 % post-creation fee cap, letting an operator raise a live pool's swap fee to the 99 % ceiling

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM |
| **Checklist Item** | AR-062, ECON-026, ECON-027, ECON-028, AC-023, AC-024, OPS-055, OPS-082, OPS-083 |
| **Category** | Economic / Admin-Parameter Bounds |
| **Language** | Rust |
| **File** | `programs/cp-amm/src/state/pool.rs:1236-1252` (uncapped branch) · `programs/cp-amm/src/state/pool.rs:1222-1228` (the cap it bypasses) · `programs/cp-amm/src/instructions/operator/ix_update_pool_fees.rs:76-101` · `programs/cp-amm/src/params/fee_parameters.rs:154-188` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

`update_pool_fees` is the operator instruction that rewrites an *existing, live* pool's fee configuration. It accepts three independent update modes (`ix_update_pool_fees.rs:11-25`), and the handler treats them with visibly different rigour.

For the **base fee**, `Pool::validate_and_update_pool_fees` deliberately clamps a post-creation raise:

```rust
// programs/cp-amm/src/state/pool.rs:1222-1228
// validate current base fee is smaller than our cap
// because base fee is static, so we just need to use min base fee numerator
let current_base_fee_numerator = base_fee_handler.get_min_fee_numerator()?;
require!(
    current_base_fee_numerator <= MAX_FEE_NUMERATOR_POST_UPDATE,   // 100_000_000 = 10 %
    PoolError::InvalidUpdatePoolFeesParameters
);
```

For the **dynamic fee**, written by the *same instruction*, there is no equivalent bound:

```rust
// programs/cp-amm/src/state/pool.rs:1244-1248
DynamicFeeUpdateMode::Update(dynamic_fee) => {
    self.pool_fees.dynamic_fee = dynamic_fee.to_dynamic_fee_struct();
}
```

The only validation the dynamic parameters receive is `DynamicFeeParameters::validate` (`params/fee_parameters.rs:154-188`), whose ceilings — `variable_fee_control <= U24_MAX` and `max_volatility_accumulator <= U24_MAX` — are chosen to prevent *integer overflow*, not to bound the resulting fee. The comment on those two `require!`s says so outright: `// prevent program overflow`.

At swap time the two components are summed and only then clamped to the pool's version ceiling:

```rust
// programs/cp-amm/src/state/fee.rs:122-138
let dynamic_fee = self.dynamic_fee.get_variable_fee()?;
let total_fee_numerator = dynamic_fee.safe_add(base_fee_numerator.into())?;
...
if total_fee_numerator > max_fee_numerator { Ok(max_fee_numerator) } else { ... }
```

`max_fee_numerator` comes from `get_max_fee_numerator(self.fee_version)` and `CURRENT_POOL_VERSION == 1`, so the ceiling is `MAX_FEE_NUMERATOR_V1 = 990_000_000` — **99 %** (`constants.rs:116-118, 153-170`). The 10 % cap the instruction enforces on one component is therefore worth nothing: the other component, written in the same call, reaches the 99 % ceiling on its own.

**Impact:**

An operator holding `OperatorPermission::UpdatePoolFees` can, in a single transaction with no timelock, no notice period and no event beyond `EvtUpdatePoolFees`, raise the effective swap fee on **any** pool in the protocol from (say) 0.25 % to 99 %. Every swapper who has not set a tight `minimum_amount_out` pays it; the operator captures it as an LP (80 % of the fee goes to liquidity, and 20 % of the protocol share is further claimable as referral by whoever routes the swap — F-013). LP capital is not stolen, and users with correct slippage settings are protected by a failed transaction rather than a loss, which is what keeps this out of the HIGH band.

This is a *bounds* bug, not a trust question: the code already decided that post-creation fee raises must be capped at 10 %, and one of the two paths that performs a post-creation fee raise does not honour that decision.

**Reachability** *(Rule 5b — recorded even though the gate is only mandatory at N ≥ 6)*
- Entry point: `cp_amm::update_pool_fees` @ `programs/cp-amm/src/lib.rs:193-199`
- Signer / authority required: **operator** — `#[access_control(is_valid_operator_role(&ctx.accounts.operator, ctx.accounts.signer.key, OperatorPermission::UpdatePoolFees))]` @ `lib.rs:193`
- Preconditions to reach the vulnerable line: the pool account exists (`UpdatePoolFeesCtx.pool` @ `ix_update_pool_fees.rs:107-108` carries no `has_one`, no seeds and no status constraint — any `Pool` account qualifies); `params.dynamic_fee = Some(v)` with `v != DynamicFeeParameters::default()` so `get_dynamic_fee_update_mode()` returns `Update` @ `ix_update_pool_fees.rs:57-67`
- Guard analysis: `UpdatePoolFeesParameters::validate` @ `ix_update_pool_fees.rs:76-101` calls `dynamic_fee.validate()`, which checks `bin_step == 1`, `filter_period < decay_period`, `reduction_factor <= 10_000`, `variable_fee_control <= U24_MAX`, `max_volatility_accumulator <= U24_MAX` — none of which bounds the product that becomes the fee. `validate_and_update_pool_fees` @ `pool.rs:1236-1252` performs no further check on this branch. The `MAX_FEE_NUMERATOR_POST_UPDATE` guard is in the `BaseFeeUpdateMode::Update` arm only and is skipped entirely when `cliff_fee_numerator` is `None`.
- Verdict: **REACHABLE**

**Math / State-Bounds** *(Rule 5b)*
- Vulnerable expression: `v_fee = (volatility_accumulator * bin_step)^2 * variable_fee_control; scaled_v_fee = (v_fee + 99_999_999_999) / 100_000_000_000` @ `programs/cp-amm/src/state/fee.rs:376-393`
- Input domain: `bin_step == 1` (forced), `volatility_accumulator ∈ [0, max_volatility_accumulator]` @ `fee.rs:335-338`, `max_volatility_accumulator ≤ 16_777_215`, `variable_fee_control ≤ 16_777_215`
- Boundary that breaks: the fee numerator has no upper bound of its own; it is clamped only at `fee.rs:133` against `990_000_000`
- Worked case: set `variable_fee_control = max_volatility_accumulator = 16_777_215`. `to_dynamic_fee_struct()` resets `volatility_accumulator` to 0, so the fee starts at the base rate. `update_volatility_accumulator` @ `fee.rs:327-339` then accrues `delta_bin_id * MAX_BASIS_POINT` per swap, where `delta_bin_id ≈ (Δ√P / √P) × 10_000 × 2` (`fee.rs:309-326` with `bin_step_u128 = 2^64/10_000`). A **1 %** price move therefore yields `delta_bin ≈ 200` and `volatility_accumulator ≈ 2.0 × 10⁶`. Substituting: `square_vfa_bin = (2.0e6)² = 4.0e12`; `v_fee = 4.0e12 × 1.6777e7 ≈ 6.71e19`; `scaled_v_fee ≈ 6.71e8 = 671_000_000` → **67 % fee numerator** after a single 1 % price move, rising to the 99 % clamp on an ~8 % move (which saturates `volatility_accumulator` at `U24_MAX`).
- Net effect: the *advertised* post-update fee ceiling of 10 % is not enforced; the real ceiling is 99 %, reachable within one or two swaps of the parameter change. No funds are moved by the instruction itself — the damage is extraction from subsequent swappers and denial of service to those with tight slippage.

**Downgrade lever applied (Rule 1):** *Privilege required.* Impact 7 (significant economic damage to every user of an affected pool) reduced to **5** because the path is gated on `OperatorPermission::UpdatePoolFees`, a role the intake trust model records as trusted, and because slippage-protected swappers lose a failed transaction rather than funds. A permissionless variant of this would score 8.

**Proof of Concept:**

```text
Actor:      holder of an Operator account with OperatorPermission::UpdatePoolFees
Capability: one signed transaction; no capital required
Setup cost: transaction fee only

1. Eve (operator) selects pool P — any Pool account; UpdatePoolFeesCtx imposes no
   has_one, no seeds and no pool-status constraint (ix_update_pool_fees.rs:107-108).
2. Eve submits update_pool_fees with:
       cliff_fee_numerator   = None            // skips the 10 % cap arm entirely
       compounding_fee_bps   = None
       dynamic_fee           = Some(DynamicFeeParameters {
           bin_step: 1, bin_step_u128: BIN_STEP_BPS_U128_DEFAULT,
           filter_period: 1, decay_period: 2, reduction_factor: 10_000,
           max_volatility_accumulator: 16_777_215,   // U24_MAX — accepted
           variable_fee_control:       16_777_215,   // U24_MAX — accepted
       })
3. params.validate() passes: every individual bound is respected.
   validate_and_update_pool_fees() takes the DynamicFeeUpdateMode::Update arm
   (pool.rs:1244) and writes the struct verbatim. MAX_FEE_NUMERATOR_POST_UPDATE
   is never consulted.
4. Eve (or any trader) executes one swap that moves the price ~1 %. update_post_swap
   (pool.rs:1051-1068) drives volatility_accumulator to ~2.0e6.
5. Guard bypassed: the 10 % post-update cap at pool.rs:1226.
6. Quantified outcome: the next swap's trade_fee_numerator is 671_000_000 / 1e9 = 67 %
   (99 % after an ~8 % move). A 10,000 USDC swap yields ~3,300 USDC of output instead
   of ~9,975. Victims with min_out set see the transaction revert (griefing); victims
   with min_out = 0 — a common integrator default — take the full loss.
```

**Recommendation:**

Validate the *combined* worst-case fee against the same cap the base fee is held to, and do it after every update mode has been applied:

```rust
// programs/cp-amm/src/state/pool.rs — end of validate_and_update_pool_fees()
pub fn validate_and_update_pool_fees(&mut self, params: &UpdatePoolFeesParameters) -> Result<()> {
    // ... existing base-fee / dynamic-fee / compounding-fee arms ...

    // NEW: bound the worst-case TOTAL fee after any update, not each component alone.
    let base_fee_handler = self.pool_fees.base_fee.base_fee_info.get_base_fee_handler()?;
    let max_base_fee_numerator = base_fee_handler.get_max_fee_numerator()?;
    let max_dynamic_fee_numerator: u64 = self
        .pool_fees
        .dynamic_fee
        .get_max_variable_fee()?          // new helper: evaluate get_variable_fee()
        .try_into()                       // at volatility_accumulator == max_volatility_accumulator
        .map_err(|_| PoolError::TypeCastFailed)?;

    let max_total_fee_numerator = max_base_fee_numerator.safe_add(max_dynamic_fee_numerator)?;
    require!(
        max_total_fee_numerator <= MAX_FEE_NUMERATOR_POST_UPDATE,
        PoolError::InvalidUpdatePoolFeesParameters
    );
    Ok(())
}
```

Additionally, and independently of the cap: gate `update_pool_fees`, `fix_pool_fee_params` and `fix_config_fee_params` behind an on-chain timelock (propose → wait → execute) so LPs and integrators can observe a pending fee change and exit before it lands (see OPS-055, OPS-061 and F-006).

---

#### [F-002] The `local` cargo feature makes `assert_eq_admin` return `true` for every signer

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | AC-017, OPS-014, OPS-062 |
| **Category** | Access Control / Build Configuration |
| **Language** | Rust |
| **File** | `programs/cp-amm/src/instructions/admin/auth.rs:13-16` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

The admin gate is a hardcoded two-key allowlist:

```rust
// programs/cp-amm/src/instructions/admin/auth.rs:3-23
pub mod admin {
    pub const ADMINS: [Pubkey; 2] = [
        pubkey!("5unTfT2kssBuNvHPY6LbJfJpLqEcdMxGYLWHwShaeTLi"),
        pubkey!("DHLXnJdACTY83yKwnUkeoDjqi4QBbsYGa1v8tJL76ViX"),
    ];
}

#[cfg(feature = "local")]
pub fn assert_eq_admin(_admin: Pubkey) -> bool {
    true                               // <-- every signer is an admin
}

#[cfg(not(feature = "local"))]
pub fn assert_eq_admin(admin: Pubkey) -> bool {
    crate::admin::admin::ADMINS.iter().any(|predefined_admin| predefined_admin.eq(&admin))
}
```

The `local` feature is not obscure — it is the repository's default test build: `package.json` defines `"build-local": "anchor build --ignore-keys -- --features local"` and `"test": "bun run build-local && ... ts-mocha ..."`. The same feature also switches `alpha_vault::ID` to a different program (`utils/alpha_vault.rs:5-9`) and shrinks every activation buffer from hours to seconds (`constants.rs:67-99`). There is no compile-time guard — no `compile_error!`, no `debug_assertions` coupling, no cluster assertion — that prevents a `local` artifact from being produced by a release pipeline and deployed.

**Impact:**

If a `--features local` build were ever deployed to mainnet, *any* signer could call `create_operator_account` and mint themselves an `Operator` account with the full permission bitmask (`bitmask_max(OperatorPermission::VARIANT_COUNT)`, `ix_create_operator_account.rs:39-46`). From there the attacker owns every operator-gated capability in the protocol: `set_pool_status` (pause every pool), `update_pool_fees` (F-001 — 99 % fee on every pool), `create_config` / `create_dynamic_config`, `create_token_badge` (admit an arbitrary Token-2022 mint with a permanent delegate into a pool), `close_config`, `close_token_badge`, `fix_pool_layout_version`. It is a complete governance takeover. It does not by itself move LP principal — `claim_protocol_fee2` is gated on the external protocol-fee program's PDA, not on the operator role — but it is the worst governance outcome the program can produce.

**Impact × Likelihood (Rule 1):** the *impact* axis is 9. The *likelihood* axis drives the score down to **4**: there is no on-chain path to enable the feature, the deployed binary is built without it, and triggering it requires a release-engineering error rather than an attacker action. The finding is reported because the blast radius is total and the guard that would make the mistake impossible costs three lines.

**Proof of Concept:**

```text
Preconditions: a program binary built with `--features local` is deployed at
               cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG.

1. Mallory calls create_operator_account (lib.rs:71-77) with:
       signer             = Mallory (any keypair)
       whitelisted_address = Mallory
       permission          = bitmask_max(12) = 0xFFF
2. #[access_control(is_admin(ctx.accounts.signer.key))] -> access_control.rs:7-10
   -> assert_eq_admin(Mallory) -> returns `true` unconditionally (auth.rs:14-16).
3. The Operator PDA [b"operator", Mallory] is created with every permission bit set.
4. Mallory now satisfies is_valid_operator_role(..) for all nine operator-gated
   instructions in lib.rs. Quantified outcome: complete control of pool status,
   pool and config fee parameters, config creation, and token badging — protocol-wide.
```

**Recommendation:**

Make the dangerous build impossible rather than merely unlikely:

```rust
// programs/cp-amm/src/instructions/admin/auth.rs

// 1. Refuse to compile a `local` build for the BPF/SBF target.
#[cfg(all(feature = "local", target_os = "solana"))]
compile_error!(
    "feature `local` disables the admin allowlist and must never be compiled for a \
     deployable Solana target; use it only for host-side unit tests"
);

// 2. Prefer widening the allowlist over disabling it, so the code path under test
//    is the same code path that ships.
#[cfg(feature = "local")]
pub fn assert_eq_admin(admin: Pubkey) -> bool {
    const LOCAL_TEST_ADMIN: Pubkey = pubkey!("bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1");
    admin == LOCAL_TEST_ADMIN || crate::admin::admin::ADMINS.contains(&admin)
}
```

If option 1 is too strict for the LiteSVM suite (which does build for the SBF target), keep option 2 alone — it preserves the test workflow while ensuring the allowlist logic itself is always exercised.

---

#### [F-003] CI pins a third-party action by mutable tag and installs the toolchain via `curl | sh`

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | OPS-074, OPS-075 |
| **Category** | Supply Chain / Build Integrity |
| **Language** | YAML |
| **File** | `.github/workflows/ci.yml:24-28, 40-44` · `.github/actions/setup-solana/action.yml:12-13` · `.github/actions/setup-anchor/action.yml:13-14` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

The CI workflow resolves a third-party action by a **mutable git tag**:

```yaml
# .github/workflows/ci.yml:24-28 and again at :40-44
- name: Get specific changed files
  id: changed-files-specific
  uses: tj-actions/changed-files@v18.6
  with:
    files: |
      programs/cp-amm
```

A tag is a movable reference. `tj-actions/changed-files` is the action whose tags were retagged to a malicious commit in the March 2025 supply-chain incident (CVE-2025-30066), which is the canonical demonstration that `@v<x>` is not a pin. Every other action in the workflow has the same exposure (`actions/checkout@v4`, `actions/cache@v4`, `oven-sh/setup-bun@v2`, `Swatinem/rust-cache@v2`, `dtolnay/rust-toolchain@stable`), and the composite actions fetch executables over the network at run time:

```yaml
# .github/actions/setup-solana/action.yml:12-13
- run: sh -c "$(curl -sSfL https://release.anza.xyz/v${{ env.SOLANA_CLI_VERSION }}/install)"
# .github/actions/setup-anchor/action.yml:13-14
- run: cargo install --git https://github.com/coral-xyz/anchor --tag v${{ env.ANCHOR_CLI_VERSION }} anchor-cli --locked
```

Neither download is checksum-verified, and the anchor install resolves another mutable tag.

**Impact:**

A compromised action executes with the runner's `GITHUB_TOKEN` and full write access to the workspace. Two concrete consequences:

1. **Build tampering.** The `anchor_build` and `program_integration_test` jobs compile the on-chain program. An action that runs before them can patch `programs/cp-amm/src/**` in the checked-out tree so the artifact that reviewers see pass CI is not the artifact the source describes. This is the same class of trust as a verifiable-build gap (OPS-070), and it is the reason this is scored above INFO.
2. **Runner/secret compromise.** The retagging incident exfiltrated runner memory and printed secrets into logs.

Two facts bound the blast radius and hold this at LOW rather than HIGH. First, the workflow is `on: pull_request` — **not** `pull_request_target` — so a fork PR receives a read-only token and cannot reach repository secrets. Second, there is no deploy job and no deploy key anywhere in `.github/` (OPS-064, OPS-067 both PASS): a compromised runner cannot push a program upgrade. The residual risk is build integrity and the `GITHUB_TOKEN` of same-repo branch PRs.

**Impact × Likelihood (Rule 1):** impact 7, reduced to **4** on the *bounded blast radius* lever — no deploy credential, no `pull_request_target`, read-only token on fork PRs.

**Proof of Concept:**

```text
Actor:      whoever controls (or compromises) the tj-actions/changed-files repository
Capability: move the `v18.6` tag to an attacker-authored commit
Atomicity:  takes effect on the next CI run; no interaction with this repository needed

1. Attacker force-updates refs/tags/v18.6 in tj-actions/changed-files.
2. The next pull_request to main/release_* resolves `uses: tj-actions/changed-files@v18.6`
   to the attacker's commit. GitHub caches nothing that would prevent this.
3. The action runs in the `program_changed_files` job, which executes BEFORE
   `anchor_build` and `program_integration_test` and shares the checked-out workspace.
4. Guard bypassed: none — there is no allow-list of action SHAs, no
   `permissions:` block restricting the GITHUB_TOKEN, and no artifact attestation.
5. Quantified outcome: attacker-chosen code runs on every PR build; for same-repo
   PRs it holds a write-capable GITHUB_TOKEN. The compiled .so that "passed CI" no
   longer provably corresponds to the reviewed source.
```

**Recommendation:**

```yaml
# .github/workflows/ci.yml — pin every action to a full commit SHA and drop
# the default token to read-only.
permissions:
  contents: read

jobs:
  program_changed_files:
    steps:
      - uses: actions/checkout@<40-char-sha>          # v4.x
        with: { fetch-depth: 0 }
      - uses: tj-actions/changed-files@<40-char-sha>  # v18.6
```

Add a Dependabot/Renovate entry for `github-actions` so SHA pins are still updated deliberately, and verify the Solana installer against a published checksum instead of piping it straight to `sh`:

```yaml
# .github/actions/setup-solana/action.yml
- run: |
    curl -sSfLo install.sh "https://release.anza.xyz/v${{ env.SOLANA_CLI_VERSION }}/install"
    echo "${SOLANA_INSTALLER_SHA256}  install.sh" | sha256sum -c -
    sh install.sh
  shell: bash
```

Separately (OPS-075): `Cargo.toml` declares `anchor-lang = "1.0.2"`, which Cargo reads as `^1.0.2`. `Cargo.lock` is committed so today's builds are exact, but a routine `cargo update` can silently move minor versions of the framework that enforces every account constraint in this program. Pin the framework crates with `=1.0.2`.

---

#### [F-004] The customizable-pool PDA has no creator or config component, so any pair can be permanently squatted

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | AV-027, AV-087, PDA-001, AC-039 |
| **Category** | PDA Derivation / Griefing |
| **Language** | Rust |
| **File** | `programs/cp-amm/src/instructions/initialize_pool/ix_initialize_customizable_pool.rs:161-172` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

`initialize_customizable_pool` is permissionless — it has no `config`, no `pool_creator_authority` and no operator gate — and its pool address is derived from the mint pair alone:

```rust
// programs/cp-amm/src/instructions/initialize_pool/ix_initialize_customizable_pool.rs:161-172
#[account(
    init,
    seeds = [
        CUSTOMIZABLE_POOL_PREFIX.as_ref(),
        &max_key(&token_a_mint.key(), &token_b_mint.key()),
        &min_key(&token_a_mint.key(), &token_b_mint.key()),
    ],
    bump,
    payer = payer,
    space = 8 + Pool::INIT_SPACE
)]
pub pool: AccountLoader<'info, Pool>,
```

`max_key`/`min_key` make the derivation order-independent, so there is exactly **one** customizable-pool address per unordered mint pair, for all time. Compare the two config-based variants, whose seeds include `config.key()` (`ix_initialize_pool.rs:98-103`, `ix_initialize_pool_with_dynamic_config.rs:78-83`) and which therefore admit one pool per (config, pair).

The program has no pool-closure instruction (see F-015), so the slot cannot be reclaimed. The code already recognises the squatting risk and prices it — the forced 1-unit transfer at `ix_initialize_customizable_pool.rs:381-383` is annotated `// require at least 1 lamport to prove ownership of token mints` — but one token unit is not a meaningful deterrent for any freely-obtainable mint.

**Impact:**

For a token pair `(X, SOL)` where the attacker can obtain 1 unit of `X`, an attacker front-runs or simply pre-empts the legitimate launch and creates the canonical customizable pool with adversarial parameters: a 99 %-capable fee schedule, a price range that traps liquidity, an `activation_point` up to 31 days in the future (`MAX_ACTIVATION_TIME_DURATION`, `constants.rs:83-86`), or an `alpha_vault` bound to the attacker's own address (`get_whitelisted_alpha_vault(payer, pool, has_alpha_vault)` at `ix_initialize_customizable_pool.rs:306-310, 429-435` derives the whitelisted vault from the **payer**, i.e. the squatter). The legitimate team can never create *the* customizable pool for that pair and must fall back to a config-based pool — an address that integrators, aggregators and front-ends looking up the canonical customizable-pool PDA will not find.

Cost to the attacker: 1 unit of each mint plus rent for the pool (1,112 bytes), two vaults, a position, an NFT mint and an NFT account — on the order of 0.02 SOL. Blast radius is bounded (nobody's funds are taken; the affected team has a working alternative), which is what holds this at LOW.

**Proof of Concept:**

```text
Actor:      any funded wallet
Capability: permissionless; ~0.02 SOL of rent + 1 unit of each mint
Atomicity:  single transaction

1. Team T announces a launch of token X paired with SOL.
2. Mallory acquires 1 unit of X (any airdrop, faucet, or the first public buy).
3. Mallory calls initialize_customizable_pool with token_a_mint = X,
   token_b_mint = WSOL, has_alpha_vault = true, an adversarial
   PoolFeeParameters, and activation_point = now + 31 days.
4. The PDA [b"cpool", max(X,WSOL), min(X,WSOL)] is now initialized.
5. Guard bypassed: there is no creator/config seed component and no closure path
   (lib.rs exposes no close_pool instruction).
6. Quantified outcome: T can never occupy the canonical customizable-pool address
   for (X, SOL). Any integrator that derives that PDA — the documented way to find
   a customizable pool — resolves to Mallory's pool, whose whitelisted alpha vault
   is derived from Mallory's key and whose fee schedule Mallory chose.
```

**Recommendation:**

Add a creator component to the seed set so the namespace is per-creator rather than global, and keep the existing token-ownership cost as a secondary deterrent:

```rust
// programs/cp-amm/src/instructions/initialize_pool/ix_initialize_customizable_pool.rs
#[account(
    init,
    seeds = [
        CUSTOMIZABLE_POOL_PREFIX.as_ref(),
        creator.key().as_ref(),                       // <-- new
        &max_key(&token_a_mint.key(), &token_b_mint.key()),
        &min_key(&token_a_mint.key(), &token_b_mint.key()),
    ],
    bump,
    payer = payer,
    space = 8 + Pool::INIT_SPACE
)]
pub pool: AccountLoader<'info, Pool>,
```

This is a layout-breaking change for existing customizable pools, so if it cannot be made, the alternative is to raise the squatting cost to something economically meaningful — require the initial liquidity to exceed a configured minimum notional rather than 1 unit — and to publish, off-chain, that the customizable-pool PDA is *not* an authenticity signal.

---

#### [F-005] An ed25519 private key is committed to the repository

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | OPS-028, OPS-036, FV-045 |
| **Category** | Secrets / Key Management |
| **Language** | JSON |
| **File** | `keys/local/admin-bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1.json` (added in commit `a3d3827`, present at `a85c926`) |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

The repository tracks a 64-byte ed25519 secret key in the standard Solana keypair format:

```
$ git ls-files | grep -i keys/
keys/local/admin-bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1.json

$ git log --all --diff-filter=A --name-only -- "keys/*"
a3d3827   keys/local/admin-bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1.json
```

The file begins `[230,207,238,109,95,154,47,93,...]` — the full signing key, not a public key. It is wired into the build: `Anchor.toml` sets `wallet = "keys/local/admin-bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1.json"` and `package.json`'s `test` script exports it as `ANCHOR_WALLET`. `.gitignore` covers `.env`, `.anchor`, `target` and `node_modules` but not `keys/`.

**Impact:**

The compromise is bounded, and the bound should be stated precisely rather than assumed. The filename advertises the pubkey `bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1`, which is **not** a member of `admin::ADMINS` (`auth.rs:7-10`) — so this key holds no privileged role in the deployed mainnet program. Its "admin" status exists only in `--features local` builds, where `assert_eq_admin` returns `true` for everyone anyway (F-002) and the key's identity is irrelevant.

What remains is real but small: the key is permanently public and unrecoverable. Anything ever sent to that address — an accidental mainnet transfer, a devnet airdrop, a token the team mints to it during a rehearsal — is immediately spendable by anyone. A committed key is also a standing invitation for reuse: the next developer who needs "the admin key" reaches for the one in the repo.

**Impact × Likelihood (Rule 1):** impact 3 — the *self-sacrifice / no-privilege* lever applies, because the key controls nothing of value in the production trust model. Scored at **3** rather than the checklist's nominal 7 for FV-045 precisely because that verification was performed: the pubkey was checked against the on-chain admin allowlist in source and is absent from it.

**Proof of Concept:**

```text
Actor:      anyone who can read the public repository (it is open source, license.md)
Capability: clone; no exploit required

1. git clone <repo>
2. solana-keygen pubkey keys/local/admin-boss....json
   -> bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1
3. The signing key is now held by every reader, permanently, on every mirror and
   fork, including the pre-rewrite history of any future cleanup.
4. Quantified outcome: any balance or token account controlled by that address on
   any cluster is spendable by any observer. On mainnet the address holds no
   protocol authority (it is absent from admin::ADMINS at auth.rs:7-10), so the
   loss ceiling is whatever is mistakenly sent to it.
```

**Recommendation:**

1. Treat the key as permanently compromised. Do not "rotate" it by editing the file — git history preserves it. Sweep any balance on any cluster and stop using the address.
2. Remove the file and generate the test wallet at test time, so no key is ever tracked:

```jsonc
// package.json
"scripts": {
  "test:setup": "solana-keygen new --no-bip39-passphrase --force -o .anchor/local-admin.json",
  "test": "bun run test:setup && bun run build-local && ANCHOR_WALLET=.anchor/local-admin.json bunx ts-mocha -p ./tsconfig.json -t 1000000 tests/*.test.ts"
}
```

```gitignore
# .gitignore
keys/
*.json.key
```

3. Add a secret scanner to CI (`gitleaks`, `trufflehog`, or GitHub secret scanning with push protection) so this cannot recur — the repository currently has none (intake Q33).

---

#### [F-006] The most privileged instructions emit no events

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | SM-047, SM-050, OPS-043, OPS-061 |
| **Category** | Monitoring / Governance Observability |
| **Language** | Rust |
| **File** | `programs/cp-amm/src/instructions/admin/ix_create_operator_account.rs:35-47` · `programs/cp-amm/src/lib.rs:79-82` · `programs/cp-amm/src/instructions/operator/ix_fix_pool_fee_params.rs:24-92` · `ix_fix_config_fee_params.rs:20-66` · `ix_fix_pool_layout_version.rs:15-19` · `ix_close_token_badge.rs:22-25` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

The program's user-facing paths are well instrumented — `event.rs` defines 22 events and every swap, liquidity change, fee claim, reward operation, lock, split and position lifecycle step emits one via `emit_cpi!`. The privileged paths are not. Six instructions mutate governance-critical state and emit nothing:

| Instruction | State mutated | Event |
|---|---|---|
| `create_operator_account` | creates an `Operator` with an arbitrary `u128` permission bitmask | none — the ctx carries `#[event_cpi]` but the handler never calls `emit_cpi!` (`ix_create_operator_account.rs:35-47`) |
| `close_operator_account` | revokes every permission held by an operator | none — the handler body is literally `Ok(())` (`lib.rs:79-82`) |
| `fix_pool_fee_params` | overwrites `pool.pool_fees.base_fee` | none (`ix_fix_pool_fee_params.rs:62`) |
| `fix_config_fee_params` | overwrites `config.pool_fees.base_fee` | none (`ix_fix_config_fee_params.rs:46`) |
| `fix_pool_layout_version` | rewrites `pool.token_a_amount` / `token_b_amount` | none (`ix_fix_pool_layout_version.rs:15-19`) |
| `close_token_badge` | revokes a mint's whitelist status | none (`ix_close_token_badge.rs:22-25`) |

`create_operator_account` is the single most consequential instruction in the program — it is the transition from "some pubkey" to "can re-price and pause every pool" — and it leaves no structured trace.

**Impact:**

An off-chain indexer or monitoring service cannot reconstruct the protocol's permission history from events. Detecting that an operator was granted `UpdatePoolFees` (the precondition for F-001) requires diffing raw account state or decoding instruction data from block history, which is exactly the work that events exist to avoid. In an incident, the question "when did this key become an operator, and who granted it?" has no cheap answer. This directly weakens the detection side of the F-001 and F-002 risks: the mechanisms are privilege-gated, and the compensating control for a privilege-gated risk is observability.

A secondary note: `claim_protocol_fee2` uses plain `emit!` rather than `emit_cpi!`, and the code itself flags the consequence — `// emit! log could be truncated. should not rely on this` (`ix_claim_protocol_fee2.rs:132`). Protocol-fee sweeps are therefore also unreliable to index.

**Proof of Concept:**

```text
Scenario: post-incident forensics after a suspected operator-key compromise.

1. Analyst subscribes to cp-amm program logs / parses emit_cpi inner instructions.
2. Analyst searches for the grant that created the attacking Operator account.
3. No event exists. event.rs defines no EvtCreateOperator / EvtCloseOperator, and
   handle_create_operator (ix_create_operator_account.rs:35-47) ends at
   `operator.initialize(...); Ok(())` with no emit_cpi!.
4. Guard bypassed: none — this is an absence of instrumentation, not a control gap.
5. Quantified outcome: the analyst must fall back to scanning every historical
   transaction addressed to the program for the create_operator_account
   discriminator and decoding its accounts by hand, or diff account snapshots.
   Mean time to detection of an unauthorized permission grant is unbounded.
```

**Recommendation:**

```rust
// programs/cp-amm/src/event.rs
#[event]
pub struct EvtCreateOperatorAccount {
    pub operator: Pubkey,
    pub whitelisted_address: Pubkey,
    pub permission: u128,
    pub admin: Pubkey,
}

#[event]
pub struct EvtCloseOperatorAccount {
    pub operator: Pubkey,
    pub whitelisted_address: Pubkey,
    pub admin: Pubkey,
}

#[event]
pub struct EvtFixPoolFeeParams {
    pub pool: Pubkey,
    pub operator: Pubkey,
    pub old_base_fee: [u8; 32],
    pub new_base_fee: [u8; 32],
}
```

```rust
// programs/cp-amm/src/instructions/admin/ix_create_operator_account.rs:44-46
let mut operator = ctx.accounts.operator.load_init()?;
operator.initialize(ctx.accounts.whitelisted_address.key(), permission);

emit_cpi!(EvtCreateOperatorAccount {
    operator: ctx.accounts.operator.key(),
    whitelisted_address: ctx.accounts.whitelisted_address.key(),
    permission,
    admin: ctx.accounts.signer.key(),
});
Ok(())
```

Apply the same pattern to `close_operator_account`, `fix_pool_fee_params`, `fix_config_fee_params`, `fix_pool_layout_version` and `close_token_badge` (the last two need `#[event_cpi]` added to their contexts, which they currently lack). Convert `claim_protocol_fee2` from `emit!` to `emit_cpi!` so the record survives log truncation.

---

#### [F-007] The market-cap base-fee scheduler is keyed on the pool's own instantaneous `sqrt_price`

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | ECON-060 |
| **Category** | Economic / Price-Feed Integrity |
| **Language** | Rust |
| **File** | `programs/cp-amm/src/base_fee/fee_market_cap_scheduler.rs:122-162` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

`BaseFeeMode::FeeMarketCapSchedulerLinear` / `…Exponential` decay the swap fee as the token's "market cap" rises. The market-cap signal is the pool's own spot price, read directly from state with no time-weighting, no confidence band and no smoothing:

```rust
// programs/cp-amm/src/base_fee/fee_market_cap_scheduler.rs:137-158
let period = if current_sqrt_price <= init_sqrt_price {
    0u64
} else {
    let passed_period = current_sqrt_price
        .safe_sub(init_sqrt_price)?
        .safe_mul(max_bps)?
        .safe_div(init_sqrt_price)?
        .safe_div(sqrt_price_step_bps)?;
    ...
};
self.get_base_fee_numerator_by_period(period)
```

`current_sqrt_price` is `pool.sqrt_price` as it stands *before* the swap being priced (`pool.rs:730-739`, `pool.rs:481-490`). Any party can set it to a value of their choosing in the immediately preceding instruction of the same transaction, because moving `pool.sqrt_price` is precisely what a swap does. Checklist item ECON-060 — "can the oracle be manipulated by the same party who benefits from the manipulation?" — is answered yes by construction.

**Impact:**

The fee *tier* another user's swap will pay is attacker-selectable within a transaction:

- Pushing the price **below** `init_sqrt_price` snaps `period` to 0, i.e. the `cliff_fee_numerator`, which may legitimately be configured up to 99 % (`MAX_FEE_BPS_V1`). A sandwiching attacker can therefore force a victim's swap into the maximum fee tier.
- Pushing the price **up** lowers the tier, but the manipulation leg is itself charged at the pre-manipulation (high) rate, so buying your way to a discount costs more than the discount.

The practical ceiling on damage is the victim's own slippage guard. All three swap modes compare the **net, post-transfer-fee** output against `minimum_amount_out` (`swap_exact_in.rs:37-48`, `swap_partial_fill.rs:44-55`, `swap_exact_out.rs:40-51`), so a victim who sets a realistic `min_out` sees a reverted transaction, not a loss. Victims exposed to real loss are those routing with `min_out = 0` — a real but self-inflicted integrator default.

**Downgrade levers applied (Rule 1):** *Self-sacrifice* — the attacker pays the pre-manipulation fee rate on the manipulation leg and eats the round-trip price impact, so the strategy is only self-financing for an actor who is simultaneously the dominant LP (and thus recaptures ~80 % of the fee). *Defense-in-depth exceeds norms* — net-output slippage checking on all three swap paths converts the attack into a denial of service for correctly-configured callers. Impact 6 → reported at **3**.

**Proof of Concept:**

```text
Actor:      permissionless swapper who is also the dominant LP of pool P
Capability: two swaps around a victim transaction; capital = enough to move sqrt_price
Atomicity:  multi-instruction, single transaction (or a same-slot sandwich)

Preconditions: P uses BaseFeeMode::FeeMarketCapScheduler*, current sqrt_price is
               several `sqrt_price_step_bps` above init_sqrt_price (so the fee has
               decayed to its floor), and a large victim buy is pending.

1. Eve sells token A into P, driving pool.sqrt_price below pool_fees.init_sqrt_price.
   Her own leg is priced at the CURRENT (floor) fee — this is the cheap direction.
2. Victim's buy executes. get_total_trading_fee_from_included_fee_amount
   (fee.rs:141-162) calls the market-cap handler, which sees
   current_sqrt_price <= init_sqrt_price and returns period = 0
   (fee_market_cap_scheduler.rs:137-138) -> cliff_fee_numerator, up to 99 %.
3. Eve buys back, restoring the price.
4. Guard bypassed: none in the program. The victim's own `minimum_amount_out` is the
   only control, and it holds for any non-zero setting — see swap_exact_in.rs:45-48.
5. Quantified outcome: with min_out = 0 the victim pays the cliff fee instead of the
   floor fee (e.g. 50 % instead of 0.25 % — a 199x overcharge), of which ~80 % accrues
   to liquidity that Eve dominates. With min_out set, the victim's transaction simply
   reverts: griefing, no direct profit.
```

**Recommendation:**

Do not price a fee tier from a value the fee payer's counterparty can set in the same transaction. In decreasing order of preference:

1. **Ratchet the tier.** Persist the highest period reached and never decrease it, so a downward price manipulation cannot re-raise the fee:

```rust
// programs/cp-amm/src/state/fee.rs — PoolFeesStruct gains one field
pub max_period_reached: u16,

// programs/cp-amm/src/base_fee/fee_market_cap_scheduler.rs — in get_base_fee_numerator
let period = core::cmp::max(computed_period, max_period_reached as u64);
```

2. **Time-weight the signal.** Feed the scheduler a short TWAP of `sqrt_price` rather than the spot value; the existing `DynamicFeeStruct::sqrt_price_reference` / `last_update_timestamp` machinery (`fee.rs:342-370`) already provides a decayed reference that is not settable in a single instruction.

3. At minimum, document in the README that `FeeMarketCapScheduler*` pools price their fee from spot and that integrators **must** set a non-zero `minimum_amount_out`.

---

#### [F-008] Reachable `assert!` panics in the concentrated-liquidity swap math

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | FV-049, FV-058, AR-059 |
| **Category** | Error Handling / DoS Resilience |
| **Language** | Rust |
| **File** | `programs/cp-amm/src/liquidity_handler/concentrated_liquidity.rs:372-373, 395-396` (and `:316`) |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

The two entry points of the concentrated-liquidity price solver guard their preconditions with `assert!` rather than `require!`:

```rust
// programs/cp-amm/src/liquidity_handler/concentrated_liquidity.rs:366-385
pub fn get_next_sqrt_price_from_input(
    sqrt_price: u128, liquidity: u128, amount_in: u64, a_for_b: bool,
) -> Result<u128> {
    assert!(sqrt_price > 0);
    assert!(liquidity > 0);          // <-- panics instead of returning PoolError
    if amount_in == 0 { return Ok(sqrt_price); }
    ...
}
// identical pair at :395-396 in get_next_sqrt_price_from_output
```

`assert!` is unconditional in release builds (unlike `debug_assert!`), and a failed `assert!` aborts the BPF program rather than returning a typed error.

`liquidity == 0` is reachable. For `CollectFeeMode::BothToken` and `CollectFeeMode::OnlyB` pools there is no dead-liquidity floor — the `DEAD_LIQUIDITY` burn applies only to compounding pools (`compounding_liquidity.rs:13, 25-28, 38`). A pool whose sole LP calls `remove_all_liquidity` leaves `pool.liquidity == 0` (`pool.rs:923`), and the next `swap` reaches `liquidity_handler.calculate_a_to_b_from_amount_in(...)` → `get_next_sqrt_price_from_input(self.sqrt_price, 0, amount_in, true)` → panic.

The third `assert!`, `assert!(denominator > U256::ZERO)` at `:316`, was checked and is **not** reachable: `denominator = lower_sqrt_price * upper_sqrt_price` and every concentrated path enforces `sqrt_min_price >= MIN_SQRT_PRICE > 0` (`ix_create_static_config.rs:74-82`, `ix_initialize_customizable_pool.rs:84-92`), while compounding pools — the only ones with `sqrt_min_price == 0` — never construct a `ConcentratedLiquidity` handler (`pool.rs:1273-1289`).

**Impact:**

Bounded and non-financial. A panicking instruction and an erroring instruction both fail the transaction and revert all state, so no funds are at risk and no state is corrupted. Three concrete costs remain: the transaction consumes its entire compute budget rather than exiting at the guard; the on-chain log carries a Rust panic string instead of a decodable `PoolError`, so clients and indexers cannot classify the failure; and a future refactor that moves either function behind a path with weaker invariants converts a clean error into an abort. Note that the adjacent path *does* handle `liquidity == 0` correctly — `apply_swap_result` divides via `shl_div_256`, which returns `None` → `PoolError::MathOverflow` (`pool.rs:833-835`) — so the inconsistency is within one call chain.

Scored **3** (missing best practice with theoretical risk): reachable, but the outcome is identical to the correct behaviour from a user's and the protocol's point of view.

**Proof of Concept:**

```text
Actor:      any swapper; no privilege, no capital beyond the swap itself
Atomicity:  single transaction

1. A pool P is created with CollectFeeMode::BothToken or ::OnlyB (no DEAD_LIQUIDITY
   floor — compounding_liquidity.rs:25-28 applies only to Compounding).
2. P's only position holder calls remove_all_liquidity. apply_remove_liquidity
   (pool.rs:909-928) sets pool.liquidity = 0.
3. Anyone calls swap on P with amount_0 > 0.
4. p_handle_swap -> get_swap_result_from_exact_input (pool.rs:710) ->
   ConcentratedLiquidity::calculate_a_to_b_from_amount_in (concentrated_liquidity.rs:66)
   -> get_next_sqrt_price_from_input(sqrt_price, 0, amount_in, true)
   -> assert!(liquidity > 0) FAILS.
5. Guard bypassed: none — this is the guard, implemented with the wrong primitive.
6. Quantified outcome: the transaction aborts with ProgramFailedToComplete after
   consuming the full CU budget, instead of returning a typed PoolError. No funds
   move; no state changes.
```

**Recommendation:**

```rust
// programs/cp-amm/src/liquidity_handler/concentrated_liquidity.rs:366-385
pub fn get_next_sqrt_price_from_input(
    sqrt_price: u128, liquidity: u128, amount_in: u64, a_for_b: bool,
) -> Result<u128> {
    require!(sqrt_price > 0, PoolError::InvalidPriceRange);
    require!(liquidity > 0, PoolError::InsufficientLiquidity);
    if amount_in == 0 { return Ok(sqrt_price); }
    ...
}
```

Apply the same substitution at `:395-396` and, for consistency, convert `assert!(denominator > U256::ZERO)` at `:316` to `require!(denominator > U256::ZERO, PoolError::MathOverflow)` even though it is currently unreachable — the cost is one instruction and it removes a latent abort from the hot path. While there, `Ok(amount.try_into().unwrap())` at `:277` is inside a `#[cfg(test)]` helper and needs no change, but the `.unwrap()` at `utils/token.rs:126` is production code (it is provably infallible for `u64` inputs, per `spl_token_2022`'s `calculate_fee` widening to `u128`, but should be `.ok_or(PoolError::MathOverflow)?` for uniformity).

---

#### [F-009] The Anchor `swap` / `swap2` handlers are silent no-ops

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | OPS-016 |
| **Category** | Backdoor Detection / Build Configuration |
| **Language** | Rust |
| **File** | `programs/cp-amm/src/lib.rs:264-270` · `programs/cp-amm/src/entrypoint.rs:27-123` · `programs/cp-amm/Cargo.toml:6-10` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

Swaps are served by a hand-written Pinocchio fast path, not by the Anchor dispatcher. The `#[program]` module still declares `swap` and `swap2` so that the discriminators and IDL types exist, and both bodies do nothing at all:

```rust
// programs/cp-amm/src/lib.rs:264-270
pub fn swap(_ctx: Context<SwapCtx>, _params: SwapParameters) -> Result<()> {
    Ok(())
}

pub fn swap2(_ctx: Context<SwapCtx>, _params: SwapParameters2) -> Result<()> {
    Ok(())
}
```

The real implementation is reached only through the custom entrypoint, which intercepts those two discriminators before Anchor sees them (`entrypoint.rs:45-96`) and is itself conditional:

```rust
// programs/cp-amm/src/lib.rs:35-38
#[cfg(not(feature = "no-custom-entrypoint"))]
mod entrypoint;
#[cfg(not(feature = "no-custom-entrypoint"))]
pub use entrypoint::entrypoint;
```

```toml
# programs/cp-amm/Cargo.toml:6-10
no-custom-entrypoint = []
cpi = ["no-entrypoint", "no-custom-entrypoint"]
```

Dispatch was traced end to end and the **deployed configuration is correct**: `default = ["no-entrypoint"]` disables only Anchor's `entrypoint!`, `no-custom-entrypoint` is not set, so `entrypoint.rs`'s `#[no_mangle] extern "C" fn entrypoint` is the program's real entrypoint. Every `Swap`/`Swap2` discriminator — including one arriving via CPI, since `p_entrypoint` checks `program_id == crate::ID` (`entrypoint.rs:38-41`) — is routed to `p_handle_swap`. The no-op handlers are unreachable in the shipped binary.

**Impact:**

The finding is the *failure mode*, not a present exploit. If any future build enables `no-custom-entrypoint` — the `cpi` feature does exactly that, and feature unification in a workspace is a well-known way to acquire a feature unintentionally — or if the custom entrypoint fails to link or is refactored away, then `swap` and `swap2` fall through to Anchor and **return success while transferring nothing**. A caller's slippage guard cannot catch this: `minimum_amount_out` is checked inside `process_swap_*`, which is never reached. A CPI integrator would observe `Ok(())` and proceed as though a swap had executed. Silent success is strictly worse than a revert, which is why a latent build-configuration issue is worth reporting at all.

**Impact × Likelihood (Rule 1):** impact 8 (integrators act on a false success signal), reduced to **3** on the *likelihood* axis — it requires a build-configuration error, there is no on-chain trigger, and the current release is correct.

**Proof of Concept:**

```text
Preconditions: a binary built with `--features no-custom-entrypoint` (directly, or
               transitively via the `cpi` feature) is deployed.

1. lib.rs:35-38 compiles out `mod entrypoint`, so anchor_lang's dispatcher becomes
   the program entrypoint (the `no-entrypoint` default feature would need to be
   disabled too, which `anchor build` does when the crate is consumed as a lib).
2. A user submits instruction `Swap { amount_in: 1_000_000, minimum_amount_out: 990_000 }`.
3. Anchor validates SwapCtx (all constraints pass — the accounts are genuine) and
   calls cp_amm::swap, which returns Ok(()) immediately (lib.rs:264-266).
4. Guard bypassed: the slippage check at swap_exact_in.rs:45-48 is never executed,
   because process_swap_exact_in is only called from p_handle_swap.
5. Quantified outcome: the transaction succeeds. No tokens move, no fee accrues, no
   EvtSwap2 is emitted. A CPI caller that treats Ok(()) as "swap executed" — the
   normal contract — proceeds on a false premise.
```

**Recommendation:**

Make the fallback loud instead of silent, so a misconfigured build fails closed:

```rust
// programs/cp-amm/src/lib.rs:264-270
/// Swaps are served exclusively by the Pinocchio fast path in `entrypoint.rs`.
/// These handlers exist only so the discriminators and IDL types are generated;
/// reaching one means the custom entrypoint was compiled out.
pub fn swap(_ctx: Context<SwapCtx>, _params: SwapParameters) -> Result<()> {
    err!(PoolError::UndeterminedError)
}

pub fn swap2(_ctx: Context<SwapCtx>, _params: SwapParameters2) -> Result<()> {
    err!(PoolError::UndeterminedError)
}
```

Back it with a build-time assertion so the situation cannot arise unnoticed:

```rust
// programs/cp-amm/src/lib.rs
#[cfg(all(feature = "no-custom-entrypoint", not(feature = "cpi"), target_os = "solana"))]
compile_error!(
    "`no-custom-entrypoint` removes the Pinocchio swap dispatcher; a deployable build \
     must keep it, otherwise swap/swap2 become no-ops"
);
```

A dedicated negative test (submit `Swap` and assert the transfer occurred, not merely that the transaction succeeded — cf. FV-066) would also catch a regression here.

---

#### [F-010] Verification tooling declared in CI but never run; no dependency scanning, coverage, CU baseline or instruction-level fuzzing

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | FV-013, FV-016, FV-019, FV-024, FV-033, FV-067 |
| **Category** | Test Coverage / Static Analysis |
| **Language** | YAML / Rust |
| **File** | `.github/workflows/ci.yml:47-53, 96-105, 107-118` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

Three CI jobs install Clippy as a toolchain component and then never invoke it:

```yaml
# .github/workflows/ci.yml:96-105 (program_unit_test — the same pattern at :107-118 and :47-53)
- uses: dtolnay/rust-toolchain@stable
  with:
    toolchain: ${{ env.TOOLCHAIN }}
    components: clippy          # <-- installed
- uses: Swatinem/rust-cache@v2
- run: cargo test --package cp-amm   # <-- clippy is never run
  shell: bash
```

The complete set of checks in CI is `cargo fmt --all -- --check`, `bun run build-local`, `cargo test --package rust-sdk`, `cargo test --package cp-amm`, and `bun run test`. A formatter is not a linter. Beyond the absent Clippy run, the pipeline has:

- **no dependency vulnerability scan** — no `cargo audit`, `cargo deny`, `bun audit` or Dependabot configuration anywhere in the repository (FV-019);
- **no warning-denial policy** — no `-D warnings`, no `RUSTFLAGS`; the only configured lint is `unexpected_cfgs = warn` in `Cargo.toml`'s `[workspace.lints.rust]`, which by definition does not fail the build (FV-016);
- **no coverage measurement** — no `tarpaulin`, `llvm-cov` or `lcov` (FV-033), so the claim that critical paths are well covered is untested;
- **no instruction-level fuzzing** — no `fuzz/` directory, no Trident, no `cargo-fuzz`. Property testing exists and is good (`proptest!` in eight modules) but stops at pure functions; the handlers themselves are only exercised by hand-written LiteSVM suites (FV-024);
- **no CU regression baseline** (FV-067) — notable because the entire Pinocchio fast path exists for compute-unit reasons, and nothing detects a regression in the metric it was built to optimise;
- `.gitignore` excludes `proptest-regressions`, so a shrunk counterexample found by a property test is never committed as a regression seed (FV-027).

**Impact:**

This is a detection-capability gap, not a vulnerability. Its concrete cost is visible in this very report: Clippy's default lint set flags `clippy::indexing_slicing`-adjacent patterns and would plausibly have surfaced F-011 (`p_accessor_mint`'s unchecked `[..32]`), while a `-D warnings` policy plus `clippy::panic`/`clippy::unwrap_used` would have surfaced F-008's `assert!`s and the production `.unwrap()` at `utils/token.rs:126`. Three of the fifteen findings in this report are the kind a linter finds for free. Without `cargo audit`, a future RUSTSEC advisory against `anchor-lang`, `anchor-spl`, `bytemuck`, `ruint` or the git-pinned `pinocchio` produces no signal.

Scored **3**: no exploit path, but it measurably weakens the ability to prevent the next finding.

**Proof of Concept:**

```text
Scenario: a contributor introduces `let x = data[..32];` on a length-unchecked slice
          (the F-011 pattern) in a new handler.

1. PR opened against main. CI runs cargo fmt --check (passes — formatting is fine),
   cargo test (passes — no test exercises a short account), bun run test (passes).
2. Clippy is installed at .github/workflows/ci.yml:96-100 but never executed, so
   no lint fires.
3. Guard bypassed: none — there is no static-analysis gate to bypass.
4. Quantified outcome: the PR merges green with a reachable panic. The same holds
   for a new RUSTSEC advisory against any dependency: no job would report it.
```

**Recommendation:**

```yaml
# .github/workflows/ci.yml — replace the unused `components: clippy` with a real gate
  clippy:
    runs-on: ubuntu-latest
    needs: program_changed_files
    if: needs.program_changed_files.outputs.program == 'true'
    steps:
      - uses: actions/checkout@<sha>
      - uses: dtolnay/rust-toolchain@<sha>
        with:
          toolchain: ${{ env.TOOLCHAIN }}
          components: clippy
      - uses: Swatinem/rust-cache@<sha>
      - run: cargo clippy --workspace --all-targets -- -D warnings
        shell: bash

  cargo_audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>
      - uses: rustsec/audit-check@<sha>
        with: { token: ${{ secrets.GITHUB_TOKEN }} }
```

For the on-chain crate specifically, enable the lints that map to the findings above:

```toml
# Cargo.toml
[workspace.lints.clippy]
unwrap_used       = "deny"
expect_used       = "deny"
panic             = "deny"
indexing_slicing  = "warn"   # start at warn; the fee-rate-limiter U256 math needs review
arithmetic_side_effects = "warn"
```

Then add, in priority order: a `cargo llvm-cov` job publishing branch coverage for `programs/cp-amm`; a Trident (or `cargo-fuzz` + Mollusk) target over `swap`, `add_liquidity`, `remove_liquidity` and `split_position2`; a committed `proptest-regressions` directory (remove it from `.gitignore`); and a CU-consumption assertion in the LiteSVM suite for `swap`, `initialize_pool` and `close_position`.

---

#### [F-011] `p_accessor_mint` indexes a 32-byte slice without a length check

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | AV-080, AV-081, FV-049 |
| **Category** | Native / Pinocchio Input Validation |
| **Language** | Rust |
| **File** | `programs/cp-amm/src/utils/p_helper.rs:124-132` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

```rust
// programs/cp-amm/src/utils/p_helper.rs:124-132
pub fn p_accessor_mint(token_account: &AccountInfo) -> Result<Pubkey> {
    let mint: Pubkey = token_account
        .try_borrow_data()
        .map_err(|err| ProgramError::from(u64::from(err)))?[..32]   // <-- unchecked
        .try_into()
        .map_err(|_| ErrorCode::AccountDidNotDeserialize)?;
    Ok(mint)
}
```

The `[..32]` slice panics if the account holds fewer than 32 bytes. The caller that reaches attacker-supplied data is `get_trade_direction` (`ix_p_swap.rs:32-42`), which runs on `input_token_account`. That account's only validation is `validate_mut_token_account` (`p_helper.rs:141-149`), which asserts writability, non-system ownership and `TokenAccount::check_owner` — i.e. that the owner is the SPL Token or Token-2022 program — but never that the data is long enough to be a token account.

An account owned by the Token program with zero-length data is trivially creatable: `SystemProgram::createAccount { space: 0, owner: spl_token::ID }` succeeds for any new keypair. The `Mint::check_owner`-guarded call sites are safe by contrast — `token_a_mint`/`token_b_mint` are bound to `p_accessor_mint(token_a_vault)` / `(token_b_vault)`, and those vaults are `pool.token_a_vault`/`token_b_vault` via `has_one`, so they are genuine 165-byte token accounts.

**Impact:**

Self-inflicted only. The attacker must supply their own malformed account, and the result is a panic that aborts their own transaction with no state change and no fund movement. The costs are the same three as F-008: full CU burn, an undecodable panic log instead of a typed error, and a latent hazard if `p_accessor_mint` is later called on an account reached through a different path. It is reported because AV-080 makes bounds-checking every zero-copy read a hard requirement for native/Pinocchio code, and because this is the one place in an otherwise-thorough manual validation layer where it is missing.

**Proof of Concept:**

```text
Actor:      any funded wallet; no privilege
Atomicity:  single transaction

1. Mallory creates account M: SystemProgram::createAccount { space: 0,
   owner: spl_token::ID, lamports: rent_exempt(0) }, signed by M's keypair.
2. Mallory submits `swap` against any pool with input_token_account = M (writable).
3. SwapCtx::validate_p_accounts (ix_swap.rs:146) calls validate_mut_token_account(M):
     - is_writable                              -> true
     - owner != system_program || lamports > 0  -> true (owner is spl_token)
     - TokenAccount::check_owner(spl_token::ID) -> Ok
   No length check is performed.
4. p_handle_swap (ix_p_swap.rs:98) calls get_trade_direction(M, token_a_mint)
   -> p_accessor_mint(M) -> data[..32] on a 0-byte slice -> PANIC.
5. Guard bypassed: none — validate_mut_token_account has no data-length assertion.
6. Quantified outcome: Mallory's own transaction aborts with
   ProgramFailedToComplete after burning its full CU budget. No pool state changes,
   no tokens move, no other user is affected.
```

**Recommendation:**

```rust
// programs/cp-amm/src/utils/p_helper.rs:124-132
pub fn p_accessor_mint(token_account: &AccountInfo) -> Result<Pubkey> {
    let data = token_account
        .try_borrow_data()
        .map_err(|err| ProgramError::from(u64::from(err)))?;
    let raw = data
        .get(..32)
        .ok_or(ErrorCode::AccountDidNotDeserialize)?;
    Ok(Pubkey::try_from(raw).map_err(|_| ErrorCode::AccountDidNotDeserialize)?)
}
```

Better still, assert the length once where the account is admitted, so every later accessor inherits the guarantee:

```rust
// programs/cp-amm/src/utils/p_helper.rs:141-149
pub fn validate_mut_token_account(token_account: &AccountInfo) -> Result<()> {
    require!(token_account.is_writable(), ErrorCode::AccountNotMutable);
    require!(
        token_account.owner() != system_program::ID.as_array() || token_account.lamports() > 0,
        ErrorCode::AccountNotInitialized
    );
    TokenAccount::check_owner(&Pubkey::new_from_array(*token_account.owner()))?;
    require!(
        token_account.data_len() >= spl_token::state::Account::LEN,   // 165
        ErrorCode::AccountDidNotDeserialize
    );
    Ok(())
}
```

`p_accessor_decimals` (`p_helper.rs:134-139`, `data[44..45]`) has the same shape; it is currently safe because its argument is always a mint bound to a real vault, but the same `.get(..)` treatment costs nothing and removes the need to re-derive that argument on every future change.

---

#### [F-012] `claim_position_fee` resets the pending fee after the token transfers

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | RE-001, AC-049 |
| **Category** | Checks-Effects-Interactions |
| **Language** | Rust |
| **File** | `programs/cp-amm/src/instructions/ix_claim_position_fee.rs:98-127` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

Every other value-moving handler in the program zeroes its source field *before* the outbound CPI — `claim_protocol_fee` (`pool.rs:1118-1130`), `claim_reward` (`position.rs:335-343`, called at `ix_claim_reward.rs:109` before the transfer at `:116`), `claim_ineligible_reward` (`pool.rs:1142-1156`), `apply_remove_liquidity` (`ix_remove_liquidity.rs:168` before `:176`). `claim_position_fee` is the exception:

```rust
// programs/cp-amm/src/instructions/ix_claim_position_fee.rs:98-127
let fee_a_pending = position.fee_a_pending;
let fee_b_pending = position.fee_b_pending;
position.metrics.accumulate_claimed_fee(fee_a_pending, fee_b_pending)?;

if fee_a_pending > 0 { transfer_from_pool(/* ... */ fee_a_pending)?; }   // CPI
if fee_b_pending > 0 { transfer_from_pool(/* ... */ fee_b_pending)?; }   // CPI

position.reset_pending_fee();                                            // effect, after
```

**Impact:**

No exploit path exists today, and the reasons were verified rather than assumed. Solana's runtime rejects a cross-program invocation that re-enters a program already on the call stack, so the SPL Token / Token-2022 callee cannot call back into `cp-amm`. Even if it could, `position` is held as a `load_mut()` borrow across both CPIs, so a re-entrant `AccountLoader::load_mut` would fail the `RefCell` borrow. And the one mechanism that can inject attacker code into a Token-2022 `transfer_checked` — a transfer hook — cannot be present on a pool mint reached permissionlessly: `is_permissionless_supported_mint` returns `false` unless the hook's `program_id` **and** `authority` are both `None` (`utils/token.rs:244-256`).

What remains is that the safety of this handler depends on three external invariants (runtime re-entrancy policy, Anchor borrow semantics, and the mint allowlist) rather than on its own ordering. Reordering two lines makes it depend on none of them.

**Proof of Concept:**

```text
Hypothetical (blocked today — recorded to show what the ordering would cost if any
one of the three current mitigations changed):

1. Position P has fee_a_pending = 1_000_000.
2. Owner calls claim_position_fee. fee_a_pending is snapshotted (line 98) and
   transfer_from_pool executes (line 106).
3. IF the callee could re-enter cp_amm::claim_position_fee for the same position
   (it cannot: Solana rejects re-entrancy, and the position RefMut is still held),
   the re-entrant call would read fee_a_pending = 1_000_000 again, because
   reset_pending_fee() has not yet run (line 127).
4. Guard that blocks it: Solana runtime re-entrancy rejection + AccountLoader
   borrow + the transfer-hook allowlist at utils/token.rs:244-256.
5. Quantified outcome today: none. Residual: the handler is correct because of
   external invariants, not because of its own structure.
```

**Recommendation:**

```rust
// programs/cp-amm/src/instructions/ix_claim_position_fee.rs:98-127
let fee_a_pending = position.fee_a_pending;
let fee_b_pending = position.fee_b_pending;
position.metrics.accumulate_claimed_fee(fee_a_pending, fee_b_pending)?;
position.reset_pending_fee();          // <-- effect BEFORE interaction
drop(position);                        // release the borrow before the CPIs

if fee_a_pending > 0 { transfer_from_pool(/* ... */ fee_a_pending)?; }
if fee_b_pending > 0 { transfer_from_pool(/* ... */ fee_b_pending)?; }
```

---

#### [F-013] The referral (host) fee share is permissionlessly self-assignable

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | ECON-033 (residual), AC-025 (residual) |
| **Category** | Economic / Protocol Revenue |
| **Language** | Rust |
| **File** | `programs/cp-amm/src/instructions/swap/ix_p_swap.rs:128, 201-224` · `programs/cp-amm/src/state/fee.rs:264-275` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

A swap is treated as referred whenever the `referral_token_account` slot holds anything other than the program's own ID used as a sentinel:

```rust
// programs/cp-amm/src/instructions/swap/ix_p_swap.rs:128
let has_referral = referral_token_account.key().ne(crate::ID.as_array());
```

There is no allowlist, no registration, and no relationship required between the referrer and the swapper. `split_fees` then routes a fixed share of the protocol's cut to that account:

```rust
// programs/cp-amm/src/state/fee.rs:264-275
let referral_fee = if has_referral {
    safe_mul_div_cast_u64(protocol_fee, self.referral_fee_percent.into(), 100, Rounding::Down)?
} else { 0 };
let protocol_fee = protocol_fee.safe_sub(referral_fee)?;
```

`referral_fee_percent` is hardcoded to `HOST_FEE_PERCENT = 20` for every pool at creation (`params/fee_parameters.rs:70, 79, 97, 107`; `constants.rs:148`). Any swapper can therefore pass one of their own token accounts and collect 20 % of the protocol fee on their own trade.

**Impact:**

This is the standard SPL token-swap "host fee" model and is very likely intentional — but it is worth stating explicitly because the consequence is not obvious from the README, which does not mention a referral or host fee at all. In the limit where every swapper self-refers, protocol fee revenue is 80 % of the modelled amount (16 % of trade fees instead of 20 %). Nothing is stolen: LP fees, compounding fees and pool reserves are untouched, and `protocol_fee` is reduced by exactly `referral_fee` with no double-count. There is no correctness bug here — only a revenue assumption that should be written down rather than inferred.

One related detail worth noting: passing `token_a_vault` or `token_b_vault` as the referral account makes the pool transfer the referral fee to itself (a no-op in SPL Token) while `protocol_a/b_fee` has already been reduced. That strands the amount in the vault as unowned surplus. It is not extractable by anyone — every outflow path is bounded by a state field — so it is a dust accounting leak, not a loss.

**Proof of Concept:**

```text
Actor:      any swapper; no privilege
Atomicity:  single transaction, zero extra cost

1. Eve builds a normal `swap` instruction against pool P.
2. Instead of leaving the referral slot as the sentinel (crate::ID), Eve passes her
   own token account for the fee-side mint.
3. has_referral = true (ix_p_swap.rs:128). validate_mut_token_account accepts any
   token-program-owned writable account (ix_swap.rs:194-197); the mint is bound by
   transfer_checked at settlement time.
4. Guard bypassed: none — there is no referrer allowlist and no
   referrer != payer check.
5. Quantified outcome: on a 100,000 USDC swap at a 0.25 % fee, the fee is 250 USDC;
   protocol_fee = 20 % = 50 USDC; referral_fee = 20 % of that = 10 USDC to Eve.
   Protocol receives 40 USDC instead of 50 — a 20 % reduction in protocol revenue,
   repeatable on every swap by every swapper.
```

**Recommendation:**

If self-referral is intended, document it in `README.md` alongside the fee description so integrators and treasury models price it correctly. If it is not intended, gate it — the cheapest form is to require the referral account's owner to differ from the swapper:

```rust
// programs/cp-amm/src/instructions/swap/ix_swap.rs — in validate_p_accounts
if referral_token_account.key() != crate::ID.as_array() {
    validate_mut_token_account(referral_token_account)?;
    // A referrer must not be the trader themselves.
    let referral_owner = p_accessor_authority(referral_token_account)?;   // bytes [32..64]
    require!(referral_owner.as_array() != payer.key(), ErrorCode::ConstraintRaw);
}
```

A registered-referrer PDA would be stronger but costs an account and CU on the hot path; the owner-inequality check is the pragmatic middle ground. Separately, reject a referral account equal to either pool vault to close the dust leak.

---

#### [F-014] No protocol-wide pause and no aggregate-outflow circuit breaker

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | ECON-072, ECON-089, OPS-045 |
| **Category** | Blast Radius / Incident Response |
| **Language** | Rust |
| **File** | `programs/cp-amm/src/instructions/operator/ix_set_pool_status.rs:21-39` · `programs/cp-amm/src/pool_action_access/permissionless.rs:41-71` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

The only emergency control is per-pool:

```rust
// programs/cp-amm/src/instructions/operator/ix_set_pool_status.rs:21-31
pub fn handle_set_pool_status(ctx: Context<SetPoolStatusCtx>, status: u8) -> Result<()> {
    let mut pool = ctx.accounts.pool.load_mut()?;
    let new_pool_status = PoolStatus::try_from(status).map_err(|_| PoolError::TypeCastFailed)?;
    ...
    pool.pool_status = new_pool_status.into();
```

It blocks `swap`, `add_liquidity`, `create_position`, `lock_position` and `split_position`, and deliberately leaves `remove_liquidity` open so LPs can always exit (`permissionless.rs:42-70`). There is no global kill switch, no per-window outflow accounting, and no pause on `claim_position_fee` or `claim_reward` (neither consults the access validator at all).

**Impact:**

The right framing for an AMM is different from a lending protocol or a shared treasury, and the design is defensible: pools are fully isolated (each has its own vaults — the README calls this out as a deliberate fix for dynamic-amm v1's "hot account" problem), there is no shared reserve to drain, and LP funds *should* remain withdrawable during an incident. ECON-072's premise — that one whale or one manipulated mark can drain a common pot — does not apply here.

What does apply is response time. If a bug were found in a swap path, containment requires one `set_pool_status` transaction per affected pool, executed by an operator, with no batching instruction. For a program that is expected to host thousands of pools, that is an incident-response gap measured in transactions and minutes rather than one action. Combined with F-006 (no events on privileged actions) and the absence of any on-chain timelock, the overall picture is a protocol whose *preventive* controls are strong and whose *reactive* controls are thin.

**Proof of Concept:**

```text
Scenario: a defect is discovered in the concentrated-liquidity swap path affecting
          every pool with CollectFeeMode::BothToken.

1. Operator holds OperatorPermission::SetPoolStatus.
2. Containment requires calling set_pool_status(Disable) once per affected pool.
   SetPoolStatusCtx (ix_set_pool_status.rs:12-19) takes exactly one `pool` account
   and there is no batch or global variant in lib.rs.
3. Guard bypassed: none — this is a missing capability, not a bypassed control.
4. Quantified outcome: time-to-containment scales linearly with pool count. With
   ~1,000 affected pools and ~10 set_pool_status instructions per transaction
   (account-limit bound), containment is ~100 sequential transactions rather than one.
```

**Recommendation:**

Add a program-level pause flag that every access path consults, so one transaction contains the whole protocol, while preserving the existing "withdrawals always work" property:

```rust
// programs/cp-amm/src/state/config.rs — or a new singleton ProtocolState PDA
#[account(zero_copy)]
#[derive(InitSpace, Debug, Default)]
pub struct ProtocolState {
    pub paused: u8,          // 0 = live, 1 = global halt
    pub _padding: [u8; 7],
    pub _reserved: [u64; 8],
}

// programs/cp-amm/src/pool_action_access/permissionless.rs
impl PoolActionAccess for PermissionlessActionAccess {
    fn can_swap(&self, sender: &Pubkey) -> bool {
        if self.protocol_paused { return false; }        // <-- new
        ...
    }
    // can_remove_liquidity() intentionally ignores protocol_paused — emergency exit stays open
}
```

Gate the flag on a **guardian** role held separately from the upgrade authority and from the fee-setting operator role, so the actor who can halt the protocol is not the actor whose compromise would be the reason to halt it (ECON-089). Also bring `claim_position_fee` and `claim_reward` under the access validator so a halt is complete.

---

#### [F-015] No pool-closure instruction — rent is permanently locked in drained pools

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | SM-031, KV-024 |
| **Category** | Lifecycle / Resource Management |
| **Language** | Rust |
| **File** | `programs/cp-amm/src/lib.rs:65-347` (absence) · `programs/cp-amm/src/state/pool.rs:108-185` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

Every other account type in the program has a closure path — `close_position`, `close_config`, `close_token_badge`, `close_operator_account`, and `refresh_vesting`'s automatic close of a completed `Vesting` (`ix_refresh_vesting.rs:78-83`). `Pool` has none. There is no `close_pool` in the `#[program]` module, and consequently no way to reclaim the rent held by a pool account (`8 + Pool::INIT_SPACE = 1,112` bytes) or its two token vaults (165 bytes each) once all liquidity has been removed and all fees claimed.

**Impact:**

Purely economic housekeeping, and modest: roughly 0.0085 SOL of rent per pool-account triple, paid by whoever created the pool and never recoverable. For a permissionless AMM that will accumulate abandoned pools — every squatted customizable pool from F-004, every failed launch — the aggregate is real but small, and it is borne by pool creators rather than by LPs or the protocol.

It compounds F-004: because a pool can never be closed, a squatted customizable-pool address is occupied permanently rather than until someone cleans it up. That interaction is the reason this is worth recording at all rather than filing as a nitpick.

There is a legitimate design reason for the omission: closing a pool safely requires proving that `pool.liquidity == 0`, `permanent_lock_liquidity == 0`, both vaults are empty, `protocol_a_fee == protocol_b_fee == 0`, no reward is initialized with an unswept balance, and `metrics.total_position == 0` — and that last counter uses `wrapping_add`/`wrapping_sub` (`pool.rs:202-207`), so it is not a sound basis for a safety check.

**Proof of Concept:**

```text
Scenario: a pool is created, used, and fully drained.

1. Creator initializes pool P (rent: ~0.0078 SOL for the 1,112-byte pool account,
   plus ~0.00203 SOL per 165-byte vault).
2. All LPs call remove_all_liquidity and claim_position_fee; the protocol-fee
   authority sweeps via claim_protocol_fee2. pool.liquidity == 0, vaults hold only
   the stranded dust described in ECON-082.
3. The creator looks for a way to reclaim rent. lib.rs exposes no close_pool
   instruction; Pool carries no `close = ...` constraint in any context.
4. Guard bypassed: none — this is a missing capability.
5. Quantified outcome: ~0.0119 SOL permanently locked per abandoned pool, and the
   pool's PDA — including the one-per-pair customizable address of F-004 — remains
   occupied forever.
```

**Recommendation:**

Either add a closure instruction with a complete emptiness proof, or document the permanence explicitly so integrators do not expect reclamation. If adding one:

```rust
// programs/cp-amm/src/instructions/operator/ix_close_pool.rs (sketch)
pub fn handle_close_pool(ctx: Context<ClosePoolCtx>) -> Result<()> {
    let pool = ctx.accounts.pool.load()?;

    require!(pool.liquidity == 0, PoolError::InsufficientLiquidity);
    require!(pool.permanent_lock_liquidity == 0, PoolError::PositionIsNotEmpty);
    require!(pool.protocol_a_fee == 0 && pool.protocol_b_fee == 0, PoolError::PositionIsNotEmpty);
    require!(!pool.pool_reward_initialized(), PoolError::RewardInitialized);
    // Vault balances, not the wrapping metrics counter, are the authoritative check.
    require!(
        ctx.accounts.token_a_vault.amount == 0 && ctx.accounts.token_b_vault.amount == 0,
        PoolError::PositionIsNotEmpty
    );
    // close both vaults via token_2022::close_account signed by pool_authority,
    // then Anchor `close = rent_receiver` on the pool account.
    Ok(())
}
```

Note that the vault-balance requirement interacts with the stranded dust from `initialize_customizable_pool`'s forced 1-unit transfer (`ix_initialize_customizable_pool.rs:381-383`, see ECON-082): that dust would have to be swept to `rent_receiver` as part of the same instruction for closure to be reachable at all.

---

### Findings by Severity (10 → 1)

#### Severity 10 — 🔴 CRITICAL
None.

#### Severity 9 — 🔴 CRITICAL
None.

#### Severity 8 — 🟠 HIGH
None.

#### Severity 7 — 🟠 HIGH
None.

#### Severity 6 — 🟡 MEDIUM
None.

#### Severity 5 — 🟡 MEDIUM
- **F-001** — Dynamic-fee update path bypasses the 10 % post-creation fee cap, letting an operator raise a live pool's swap fee to the 99 % ceiling.

#### Severity 4 — 🔵 LOW
- **F-002** — The `local` cargo feature makes `assert_eq_admin` return `true` for every signer.
- **F-003** — CI pins a third-party action by mutable tag and installs the toolchain via `curl | sh`.

#### Severity 3 — 🔵 LOW
- **F-004** — The customizable-pool PDA has no creator or config component, so any pair can be permanently squatted.
- **F-005** — An ed25519 private key is committed to the repository.
- **F-006** — The most privileged instructions emit no events.
- **F-007** — The market-cap base-fee scheduler is keyed on the pool's own instantaneous `sqrt_price`.
- **F-008** — Reachable `assert!` panics in the concentrated-liquidity swap math.
- **F-009** — The Anchor `swap` / `swap2` handlers are silent no-ops.
- **F-010** — Verification tooling declared in CI but never run; no dependency scanning, coverage, CU baseline or instruction-level fuzzing.

#### Severity 2 — ⚪ INFO
- **F-011** — `p_accessor_mint` indexes a 32-byte slice without a length check.
- **F-012** — `claim_position_fee` resets the pending fee after the token transfers.
- **F-013** — The referral (host) fee share is permissionlessly self-assignable.
- **F-014** — No protocol-wide pause and no aggregate-outflow circuit breaker.
- **F-015** — No pool-closure instruction — rent is permanently locked in drained pools.

#### Severity 1 — ⚪ INFO
None.

---

### 4.16 Notes & Nitpicks

> Observations with **no** security impact. Not scored on the 1–10 scale and not counted in the Severity Distribution (OUTPUT-RULES Rule 1).

- `programs/cp-amm/src/liquidity_handler/concentrated_liquidity.rs:312` — `U256::from(upper_sqrt_price - lower_sqrt_price)` is the only raw subtraction on a value path; its sibling `get_delta_amount_b_unsigned_unchecked:348` uses `safe_sub`. All seven call sites were traced and operand ordering is guaranteed by a price-range invariant, and `overflow-checks = true` in `[profile.release]` turns any future regression into a panic rather than a wrap — but the asymmetry with the sibling function invites a copy-paste error. Use `safe_sub` for consistency.
- `programs/cp-amm/src/instructions/initialize_pool/ix_initialize_customizable_pool.rs:381-383` — `total_amount_a.max(1)` / `total_amount_b.max(1)` force a 1-unit transfer that is never credited to `pool.token_a_amount`/`token_b_amount`, leaving permanently stranded dust in each vault. The two config-based initializers do not do this, so the "prove ownership of token mints" protection is inconsistent across the three pool-creation paths.
- `programs/cp-amm/src/state/pool.rs:845, 854` — two identical `// TODO should metrics store trading fee or claiming fee?` comments on a shipped release. The ambiguity is resolved in the code (`trading_fee = claiming_fee + compounding_fee` is stored), but the TODO should be closed or turned into a doc comment.
- `programs/cp-amm/src/state/operator.rs:38` — `pub permission: u128,  // max 128 actions?` — the trailing question mark reads as unresolved. `bitmask_max` (`utils/bits.rs:2-8`) asserts `variant_count < 128`, so the answer is 127; state it.
- `programs/cp-amm/src/instructions/ix_create_position.rs:142` — `// TODO do we need to allow user to input custom name?` on the hardcoded position-NFT metadata name.
- `programs/cp-amm/src/instructions/operator/ix_close_config.rs:10` — a stray blank line inside the `#[derive(Accounts)]` attribute block (same at `ix_set_pool_status.rs:11`).
- `tests/layoutCompatiable.test.ts` — filename typo ("Compatiable" → "Compatible").
- `programs/cp-amm/src/state/fee.rs:52` — `BaseFeeMode::RateLimiter` is marked deprecated in a doc comment but carries no `#[deprecated]` attribute, unlike `EvtSplitPosition2` (`event.rs:256`), so nothing warns a caller who selects it. It is rejected at runtime for new pools (`params/fee_parameters.rs:38-41`), so this is cosmetic.
- `.gitignore` excludes `proptest-regressions`, so counterexamples shrunk by the eight proptest modules are never committed as regression seeds. (Also recorded at FV-027.)
- `programs/cp-amm/src/instructions/operator/ix_fix_pool_layout_version.rs` — the only operator instruction whose context lacks `#[event_cpi]` entirely, which is why F-006's fix needs a context change there rather than just an `emit_cpi!`.

---

## 5. Detailed Item Results

> **Every in-scope checklist item** is listed with its verdict, in checklist order. Nothing is skipped. Out-of-scope checklists render a single scope-gate verdict rather than 822 generated lines (OUTPUT-RULES Rule 0: out-of-scope items are `[N/A — out of scope]` *from the gate*, not from reading each file).
> `[UNKNOWN]` is used per Rule 10 where the answer is not observable from a static, offline review of this repository.

### Checklist 01 — Account Validation (AV-001 … AV-090)

```
[PASS]      AV-001: Every deserialized account is owner-checked — AccountLoader<T>/Account<T> in
                    all Anchor ctxs; the Pinocchio path asserts owner explicitly @ p_helper.rs:73-76
[PASS]      AV-002: No bare AccountInfo<'info> in any #[derive(Accounts)]; UncheckedAccount used
                    (ix_swap.rs:58, ix_create_position.rs:20, ix_close_position.rs:45)
[PASS]      AV-003: Every UncheckedAccount carries a /// CHECK: comment (ix_swap.rs:54,
                    ix_claim_position_fee.rs:14, ix_remove_liquidity.rs:28, ix_refresh_vesting.rs:30)
[PASS]      AV-004: Each /// CHECK: maps to real code — `address = const_pda::pool_authority::ID`,
                    `token::authority = owner`, `address = const_pda::protocol_fee_authority::ID`
[PASS]      AV-005: Typed loaders match their structs — Pool/Position/Config/Operator/TokenBadge/
                    Vesting, each with a const_assert_eq! size lock (pool.rs:185, position.rs:118)
[PASS]      AV-006: Token accounts are Box<InterfaceAccount<TokenAccount>>; Pinocchio path uses
                    validate_mut_token_account @ p_helper.rs:141-149
[PASS]      AV-007: Mints are Box<InterfaceAccount<Mint>>; Pinocchio path Mint::check_owner
                    @ ix_swap.rs:171,179
[PASS]      AV-008: Program<'info, System>, Program<'info, Token2022>, Interface<TokenInterface>;
                    Clock/Rent read via syscall, never as accounts
[PASS]      AV-009: No foreign-program state is typed as Account<T>; the alpha-vault address is
                    derived, not deserialized (utils/alpha_vault.rs:11-17)
[UNKNOWN]   AV-010: declare_id! @ lib.rs:42 matches Anchor.toml and the README mainnet/devnet
                    address, but binary-vs-deployed equivalence needs an on-chain query (offline audit)
[PASS]      AV-011: All state uses #[account(zero_copy)] → 8-byte Anchor discriminator; the
                    Pinocchio loader compares T::DISCRIMINATOR @ p_helper.rs:82-94
[PASS]      AV-012: No type cosplay — Pool(1104)/Position(400)/Config(320)/Operator(64)/
                    TokenBadge(160)/Vesting(176) have distinct discriminators and sizes
[PASS]      AV-013: remaining_accounts are deserialized only via AccountLoader::try_from
                    (ix_update_reward_funder.rs:51, ix_initialize_reward.rs:91) or try_accounts
                    (ix_refresh_vesting.rs:67) — all discriminator-checked
[PASS]      AV-014: Remaining accounts are content-bound, not merely discriminator-checked:
                    operator.whitelisted_address == signer (ix_initialize_reward.rs:94),
                    vesting.position == position (ix_refresh_vesting.rs:43-47),
                    token_badge.token_mint == mint (utils/token.rs:284-287)
[PASS]      AV-015: Discriminators are Anchor-derived from distinct struct names — no collision
[PASS]      AV-016: All account structs use #[account(zero_copy)]; no manual Borsh without a discriminator
[PASS]      AV-017: The V0→V1 layout migration (pool.rs:1170-1180) keeps the discriminator and size
                    fixed and only recomputes reserve fields — old and new cannot be confused
[PASS]      AV-018: Every mutated account is #[account(mut)] (pool on swap/add/remove, position,
                    vaults, user token accounts)
[PASS]      AV-019: No unnecessary mutability — every `mut` pool is genuinely written
                    (update_rewards / accumulate_permanent_locked_liquidity / apply_*)
[PASS]      AV-020: has_one used throughout — pool has_one token_a/b_vault + token_a/b_mint,
                    position has_one pool, config has_one pool_creator_authority
[PARTIAL]   AV-021: has_one is not backed by a redundant require_keys_eq! in the Anchor paths.
                    File: programs/cp-amm/src/instructions/ix_add_liquidity.rs:25
                    Impact: single point of failure if an Anchor constraint regressed
                    Fix: the Pinocchio path already does this (ix_swap.rs:135-143); mirror it
[PASS]      AV-022: All init accounts specify payer + space + seeds + bump
[PASS]      AV-023: init_if_needed is enabled as a workspace feature but used zero times
[N/A]       AV-024: init_if_needed guard — not applicable, the pattern is unused
[PARTIAL]   AV-025: `close = rent_receiver` destinations are UncheckedAccount.
                    File: ix_close_config.rs:24, ix_close_operator_account.rs:17,
                    ix_close_token_badge.rs:19, ix_close_position.rs:45
                    Impact: none today — each close is gated on a privileged or owner signer who
                    chooses their own recipient; but the destination is otherwise unconstrained
                    Fix: constrain to the signer, or document the deliberate flexibility
[PASS]      AV-026: Anchor `close` zeroes and reassigns the account
[PARTIAL]   AV-027: CUSTOMIZABLE_POOL_PREFIX seeds omit any creator/config component — see F-004.
                    File: ix_initialize_customizable_pool.rs:161-172
[PASS]      AV-028: Canonical bumps — Anchor `bump` at init; const_pda::pool_authority::BUMP and
                    EVENT_AUTHORITY_AND_BUMP.1 are compile-time constants reused by pool_authority_seeds!
[PARTIAL]   AV-029: Most `constraint =` use the default ConstraintRaw error.
                    File: ix_add_liquidity.rs:58-59, ix_close_position.rs:23-25
                    Impact: harder client-side diagnosis; no security effect
                    Fix: attach `@ PoolError::...` as ix_split_position.rs:107 already does
[N/A]       AV-030: realloc constraints — the program never reallocs
[PASS]      AV-031: Anchor 1.0 rejects duplicate mutable accounts by default; no `dup` opt-in exists
[PASS]      AV-032: All remaining_accounts are validated before use — no blind pass-through
[PASS]      AV-033: Owner verified via AccountLoader::try_from / try_accounts on every remaining account
[N/A]       AV-034: No remaining account is used as a token account
[PARTIAL]   AV-035: Remaining-account PDAs are bound by content rather than address re-derivation.
                    File: ix_refresh_vesting.rs:41-48, ix_initialize_reward.rs:90-97
                    Impact: equivalent security (each content field uniquely identifies the account)
                    but weaker defence-in-depth than re-deriving the address
                    Fix: add a seeds constraint on the Operator PDA [b"operator", signer]
[PASS]      AV-036: Counts are validated — remaining_accounts.get(0)/get(1) with explicit Option
                    handling; the vesting loop terminates on `is_empty()` (ix_refresh_vesting.rs:63)
[N/A]       AV-037: No remaining account is forwarded to an external CPI
[PASS]      AV-038: A duplicated Vesting account is idempotent — get_new_release_liquidity returns 0
                    on the second pass (state/vesting.rs:68-72)
[PASS]      AV-039: vesting.position == ctx.accounts.position (ix_refresh_vesting.rs:43-47)
[PASS]      AV-040: space = 8 + X::INIT_SPACE with a const_assert_eq! on every struct
[PASS]      AV-041: Anchor `init` funds rent exemption; the NFT mint is topped up explicitly
                    (utils/token.rs:292-308)
[N/A]       AV-042: No Vec/String in any account struct — all state is fixed-layout zero-copy
[N/A]       AV-043: No realloc
[N/A]       AV-044: No account-shrinking path
[PASS]      AV-045: Vault mints bound by `token::mint =` (Anchor) and by
                    p_accessor_mint(vault) comparison (ix_swap.rs:166-179); user accounts are
                    bound at runtime by transfer_checked
[PASS]      AV-046: Vaults use `token::authority = pool_authority`; delegate destinations go
                    through validate_ata_token (state/position.rs:590-592)
[PASS]      AV-047: Vault PDAs are [b"token_vault", mint, pool] with authority = pool_authority
[PASS]      AV-048: ATAs derived with get_associated_token_address_with_program_id (utils/token.rs:317)
[PASS]      AV-049: Delegate authorization requires delegated_amount == 0 (state/position.rs:607-611)
[PASS]      AV-050: reward_vault.is_frozen() is handled with the skip_reward escape
                    (ix_claim_reward.rs:81, 113-115)
[PASS]      AV-051: Token-2022 native mint explicitly rejected (utils/token.rs:229-231, 272-275)
[PASS]      AV-052: token_a_flag/token_b_flag record the program per mint
                    (utils/token.rs:37-55); per-account `token::token_program` constraints
[PASS]      AV-053: Every creation path uses Anchor `init`; no re-initialization is possible
[N/A]       AV-054: No manual initialization — no is_initialized flag pattern
[PASS]      AV-055: Re-derivable PDAs after close (Position/Vesting/TokenBadge/Config/Operator)
                    write a complete fresh state on re-init; no stale association survives
[PASS]      AV-056: Anchor `close` defunds, zeroes and reassigns in-instruction, so a revived
                    account fails the AccountLoader discriminator check
[PASS]      AV-057: Same mechanism — a closed account cannot serve stale data later in the tx
[PASS]      AV-058: Token program identified per account — InterfaceAccount + token_interface +
                    explicit `token::token_program` constraints; never assumed
[PASS]      AV-059: No canonical-ATA assumption exists — position NFT accounts are program PDAs
                    ([b"position_nft_account", mint]) and vaults are PDAs; the only ATA assumption
                    is in validate_ata_token, which re-derives the address (utils/token.rs:310-324)
[PASS]      AV-060: transfer_checked / mint_to / burn (Token-2022) everywhere; decimals bound at runtime
[PASS]      AV-061: Decimals always read from the mint (token_mint.decimals, p_accessor_decimals);
                    A and B amounts are never added or compared, so no normalization is needed
[PARTIAL]   AV-062: Credited amounts are computed analytically, not from a vault balance delta.
                    File: utils/token.rs:70-142 and all three swap modes
                    Impact: correct for TransferFee mints (the fee is exactly computable) and
                    rebasing mints are excluded by is_permissionless_supported_mint; residual risk
                    is a badged mint with an unmodelled balance-changing extension
                    Fix: for badged mints, credit from `vault.reload()` deltas
[PASS]      AV-063: Extension allowlist — only TransferFeeConfig, MetadataPointer, TokenMetadata and
                    an inert TransferHook are permissionless; everything else needs a TokenBadge
                    (utils/token.rs:223-262)
[PARTIAL]   AV-064: A badged mint may carry PermanentDelegate or a freeze authority.
                    File: utils/token.rs:277-289 (badge short-circuits all extension policy)
                    Impact: operator-admitted mint could claw back or freeze vault balances
                    Fix: apply per-extension policy even for badged mints, or record the badge decision
[PARTIAL]   AV-065: Pool-token mint freeze_authority is never inspected.
                    File: utils/token.rs:223-262 (no FreezeAuthority branch)
                    Impact: a mint authority can freeze the pool vault, bricking that pool's swaps
                    and withdrawals; reward vaults have the skip_reward escape, pool vaults do not
                    Fix: inspect freeze_authority at pool creation and surface it in EvtInitializePool
[PASS]      AV-066: A mint allowlist exists — the operator-issued TokenBadge PDA
[PASS]      AV-067: Vault close_authority/delegate cannot be set — vaults are created by the program
                    with authority = pool_authority and the program never CPIs `approve`
[PASS]      AV-068: Clock::get() / Rent::get() syscalls only (activation_handler.rs:41-42,
                    utils/token.rs:297) — no Clock passed as an account
[PASS]      AV-069: The only sysvar account is the Instructions sysvar, asserted against
                    INSTRUCTIONS_ID before use (ix_p_swap.rs:282-284)
[PASS]      AV-070: Activation, vesting and reward time gates all read Clock::get()
[N/A]       AV-071: No precompile signature verification (no ed25519/secp256k1 program use)
[N/A]       AV-072: Same — no introspection-based signature checks
[N/A]       AV-073: Same — no signed-message replay surface
[PASS]      AV-074: Introspection uses load_current_index() and iterates relative to it
                    (ix_p_swap.rs:291-346) — no fixed-index assumption
[PASS]      AV-075: Privileged accounts bound by address/seeds/content — pool_authority and
                    protocol_fee_authority by `address =`, admin by allowlist, operator by
                    whitelisted_address == signer; never by transaction position
[PASS]      AV-076: Canonical bumps only; no create_program_address with a user-supplied bump
[PASS]      AV-077: Framework detected — hybrid Pinocchio fast path (entrypoint.rs) with an
                    Anchor fallback; every Anchor guarantee is re-implemented manually in
                    SwapCtx::validate_p_accounts
[PASS]      AV-078: Owner explicitly verified in the native path — p_load_mut_checked
                    (p_helper.rs:73-76), Mint::check_owner, TokenAccount::check_owner
[PASS]      AV-079: require!(payer.is_signer(), AccountNotSigner) @ ix_swap.rs:182; is_writable
                    asserted in p_load_mut_checked:78-80 and validate_mut_token_account:142
[FAIL-2]    AV-080: Account count is validated (entrypoint.rs:55-57) but a zero-copy byte-slice
                    read is not bounds-checked.
                    File: programs/cp-amm/src/utils/p_helper.rs:127
                    Impact: panic (abort + full CU burn) on an attacker-supplied short account
                    Fix: use `data.get(..32).ok_or(...)?` — see F-011
[PARTIAL]   AV-081: unsafe blocks are justified at entrypoint.rs:52-54 and ix_p_swap.rs:290, but
                    p_get_number_of_accounts_in_instruction reads two raw bytes with only a
                    reference link and no length guard.
                    File: programs/cp-amm/src/utils/p_helper.rs:118-122
                    Impact: relies on the Instructions-sysvar layout holding; [u8;2] has
                    alignment 1 so there is no alignment UB
                    Fix: document the invariant or use the safe pinocchio accessor
[PASS]      AV-082: Account type disambiguated by owner + full 8-byte Anchor discriminator in the
                    native path (p_helper.rs:73-94) — not a single-byte tag
[N/A]       AV-083: Pinocchio `unsafe-account-resize` feature is not enabled
[N/A]       AV-084: No p-token / SPL Token re-implementation — the program CPIs the real token programs
[PASS]      AV-085: No exact-lamport-balance assumption; the one lamport comparison uses `>` and
                    tops up the shortfall (utils/token.rs:299-304)
[PASS]      AV-086: No builtin/sysvar/precompile account is marked #[account(mut)]
[FAIL-3]    AV-087: A user-derivable account can be pre-created to permanently block the honest path.
                    File: ix_initialize_customizable_pool.rs:161-172
                    Impact: one-per-pair customizable-pool namespace squat — see F-004
                    Fix: add creator.key() to the seed set
[PASS]      AV-088: Zero-copy deserialization is over a fixed layout whose length Anchor `init`
                    guarantees; no Vec::set_len, no MaybeUninit::assume_init on partial data
```

### Checklist 02 — Access Control (AC-001 … AC-050)

```
[PASS]      AC-001: Every value-moving instruction has a Signer — payer (swap), signer
                    (add/remove/claim/lock/split), funder (reward), owner (close_position)
[PARTIAL]   AC-002: refresh_vesting mutates Position and Vesting state with no signer at all.
                    File: programs/cp-amm/src/instructions/ix_refresh_vesting.rs:12-32
                    Impact: none — the mutation only moves vested → unlocked liquidity for the
                    NFT holder, and the closed Vesting account's rent goes to that same owner
                    (`token::authority = owner` @ :26). A deliberate permissionless crank.
                    Fix: none required; document the exception
[PASS]      AC-003: The signer is linked to state via NFT ownership/delegation —
                    Position::assert_authority (state/position.rs:546-564)
[PASS]      AC-004: Anchor Signer<'info> in every Anchor ctx
[PASS]      AC-005: The one manual check is a hard require! (ix_swap.rs:182), not an if/else
[PASS]      AC-006: Admin gated by #[access_control(is_admin(..))] on a Signer; operator gated by
                    is_valid_operator_role(&operator, signer.key, perm) with signer: Signer
[PASS]      AC-007: Position instructions require position_nft_account.amount == 1 plus
                    `token::authority = owner` or assert_authority
[PASS]      AC-008: Delegate validated against nft_token_account.delegate == Some(signer) AND
                    delegated_amount == 0 (state/position.rs:597-613)
[PASS]      AC-009: update_delegate_permission is the explicit, owner-signed, bitmask-bounded
                    delegation mechanism (ix_update_delegate_permission.rs:34-54)
[PARTIAL]   AC-010: Two permissionless instructions exist. `swap` is permissionless by design and
                    value-neutral (priced + slippage-guarded); `refresh_vesting` is permissionless
                    but moves no value (see AC-002). Both are documented here rather than left implicit.
[PASS]      AC-011: Roles enumerated — admin, operator, protocol-fee authority, pool creator,
                    reward funder, alpha vault, position owner, position delegate, anyone
                    (see §8 Trust Model)
[PASS]      AC-013: Role escalation via spoofed accounts is blocked — an Operator account must be
                    program-owned, discriminator-valid and name the signer (access_control.rs:12-24)
[PASS]      AC-014: Position spoofing requires holding the NFT (supply is 1, mint authority is a PDA
                    with no reachable second mint_to)
[PASS]      AC-015: Admin is a hardcoded 2-key allowlist compiled into the binary
                    (instructions/admin/auth.rs:7-10)
[PASS]      AC-016: Admin can only create/close Operator accounts — no fund-moving capability
[PARTIAL]   AC-012: Dual-role path — initialize_reward / update_reward_funder /
                    update_reward_duration accept either pool.creator (reward index 0 only) or an
                    operator.  File: state/pool.rs:1166-1168, ix_initialize_reward.rs:85-98
                    Impact: documented and index-restricted; the creator cannot touch reward index 1
                    Fix: none required; noted for role-matrix completeness
[FAIL-4]    AC-017: A compile-time god mode exists.
                    File: programs/cp-amm/src/instructions/admin/auth.rs:13-16
                    Impact: under `--features local`, any signer passes is_admin and can mint
                    itself a full-permission Operator — see F-002
                    Fix: compile_error! on a deployable target, or widen the allowlist instead
[N/A]       AC-018: No manager/investor duality in this protocol
[N/A]       AC-019: Same
[PASS]      AC-020: Operators act protocol-wide by design; pool creators hold no post-creation
                    authority beyond reward index 0
[PASS]      AC-021: A position owner can only operate on positions whose NFT they hold
[PASS]      AC-022: No instruction lets an operator or creator take LP principal;
                    claim_protocol_fee2 is bounded by protocol_a_fee / protocol_b_fee
[PARTIAL]   AC-023: The fee cap is partial — base fee is capped at 10 % on update
                    (state/pool.rs:1226) but the dynamic component is uncapped — see F-001
[FAIL-5]    AC-024: Fees can be changed after pool creation with no timelock and, via the dynamic
                    path, with no cap.
                    File: programs/cp-amm/src/state/pool.rs:1236-1252
                    Impact: effective swap fee raised to 99 % on a live pool — see F-001
                    Fix: bound the combined worst-case fee and add a timelock
[PASS]      AC-025: The protocol-fee receiver is validated by the external protocol_fee program's
                    PDA authority (ix_claim_protocol_fee2.rs:41-42) — it cannot be redirected here
[PASS]      AC-026: protocol_fee_program::ID and its authority PDA are compile-time constants
                    (constants.rs:200-208, const_pda.rs:25-35)
[PASS]      AC-027: PROTOCOL_FEE_PERCENT = 20 is a compile-time constant applied to every pool
                    (params/fee_parameters.rs:70, 79, 97, 107) and is not settable per pool
[N/A]       AC-028: Pools have no transferable ownership
[PASS]      AC-029: TokenBadge create/close are gated on distinct operator permissions
                    (CreateTokenBadge / CloseTokenBadge)
[PASS]      AC-030: A pause mechanism exists — pool.pool_status via set_pool_status
[PASS]      AC-031: Pause is restricted to an operator holding OperatorPermission::SetPoolStatus
[PARTIAL]   AC-032: Pause blocks swap / add_liquidity / create_position / lock / split but
                    deliberately leaves remove_liquidity open; claim_position_fee and claim_reward
                    consult no access validator at all.
                    File: pool_action_access/permissionless.rs:41-71
                    Impact: emergency exit is preserved (intended); fee/reward claiming cannot be halted
                    Fix: bring claim paths under the validator — see F-014
[PASS]      AC-033: Protocol-fee claiming is unaffected by pause, by design
[PASS]      AC-034: Investors can always withdraw — can_remove_liquidity ignores is_enabled
                    (permissionless.rs:46-48)
[N/A]       AC-035: A pause mechanism exists, so the "no emergency stop" flag does not apply
[PARTIAL]   AC-036: Pool-token mints may carry a freeze authority that the program never inspects
                    (see AV-065). Position NFT mints set freeze_authority = pool and the program
                    never CPIs freeze_account, so positions cannot be frozen.
[PASS]      AC-037: Position-NFT mint authority is pool_authority; mint_to is reachable only from
                    create_position_nft on a freshly `init`ed mint (ix_create_position.rs:121-169)
[PASS]      AC-038: mint::freeze_authority = pool, and no code path ever invokes freeze_account
[FAIL-3]    AC-039: An attacker can front-run account creation to claim a PDA.
                    File: ix_initialize_customizable_pool.rs:161-172
                    Impact: permanent one-per-pair squat — see F-004
                    Fix: add creator.key() to the seeds
[PASS]      AC-040: Positions are permissionless by design — anyone may create one in any pool
[PASS]      AC-041: Withdrawals depend only on the caller's own position and pool liquidity; no
                    shared mutable state can block them
[PASS]      AC-042: close_position requires the NFT owner's signature and an empty position
                    (ix_close_position.rs:25, 56)
[PASS]      AC-043: Replay is prevented by Solana's recent_blockhash; there is no off-chain
                    signature-verification surface in the program
[PARTIAL]   AC-044: The only on-chain rate limit is the deprecated RateLimiter base-fee mode,
                    rejected for new pools (params/fee_parameters.rs:38-41). No cooldowns elsewhere.
                    Impact: acceptable for an AMM, where rate limiting would break composability
[PARTIAL]   AC-045: create_position is permissionless and each call increments
                    pool.metrics.total_position via wrapping_add (state/pool.rs:202-204).
                    Impact: the attacker pays full rent per position; nothing depends on the
                    counter, so wrapping it is cosmetic
                    Fix: use checked math on the metric, or document it as advisory
[PASS]      AC-046: Every instruction re-derives authority from its own accounts — no authority
                    context carries across instructions
[PASS]      AC-047: Anchor `close` zeroes and reassigns in-instruction, so instruction N+1 cannot
                    read stale data
[PASS]      AC-048: CPI callees are only SPL Token / Token-2022, System, and the program's own
                    event authority; the runtime blocks re-entry into cp-amm
[PARTIAL]   AC-049: Re-entrancy is blocked by the runtime and by the held load_mut borrow, but
                    claim_position_fee still resets pending fees after its CPIs — see F-012
[PASS]      AC-050: pool_authority seeds are a fixed prefix plus a canonical bump under this
                    program's ID (const_pda.rs:13-23) — no other program can sign for it
```

### Checklist 03 — Arithmetic Safety (AR-001 … AR-063)

```
[PASS]      AR-001: All additions on value paths use SafeMath::safe_add (math/safe_math.rs:25-34)
[PARTIAL]   AR-002: One raw subtraction on a value path.
                    File: liquidity_handler/concentrated_liquidity.rs:312
                    Impact: none today — all 7 call sites guarantee upper >= lower by price-range
                    invariant, and overflow-checks = true makes a regression panic, not wrap
                    Fix: use safe_sub, matching the sibling at :348
[PASS]      AR-003: All multiplications use safe_mul / checked_mul / U256-U512 widening
[PASS]      AR-004: All divisions use safe_div (checked_div → None on zero) or a guarded helper
[PARTIAL]   AR-005: Bare operators appear only at concentrated_liquidity.rs:312 and in the
                    deprecated rate limiter's U256 block (base_fee/fee_rate_limiter.rs:189-204),
                    which is annotated "because we all calculate in U256, so it is safe".
                    Bounds were verified: a <= u64::MAX, i <= 1e9, max_index <= ~9,900, so the
                    largest intermediate is ~6e66 against a U256 max of ~1.15e77
[PARTIAL]   AR-006: One saturating_sub, on a non-value path.
                    File: state/fee.rs:350 (dynamic-fee reference timestamp)
                    Impact: none — deliberate and documented at fee.rs:347-349 to keep off-chain
                    simulation working with an unsynced clock
[PARTIAL]   AR-007: Four wrapping_* uses. state/pool.rs:203,206 (total_position metric) and
                    state/position.rs:332 (total_claimed_rewards metric) are advisory counters
                    nothing depends on. state/pool.rs:334 and :1102 are deliberate mod-2^64
                    dead-liquidity checkpoints whose delta bound is argued in-code at :1091-1094
                    and independently re-derived during this audit (the pending delta is capped by
                    a u64 vault balance, so it wraps at most once)
[PASS]      AR-008: Constants-only arithmetic appears in static_assertions only (constants.rs:57-60,
                    131-144) — evaluated at compile time
[PASS]      AR-009: space = 8 + X::INIT_SPACE is compile-time constant arithmetic
[PASS]      AR-010: a*b/c patterns widen — safe_mul_div_cast_u64 → u128 (utils_math.rs:33),
                    safe_mul_div_cast_u128 → U256 (:53), mul_div_u256 → U512 (u128x128_math.rs:88-92)
[PASS]      AR-011: Proportional liquidity math widens to U256
                    (liquidity_handler/compounding_liquidity.rs:51-62)
[PASS]      AR-012: Fee math widens to u128 (state/fee.rs:216-221, 241-246)
[PASS]      AR-013: Split proportions widen to U256 (state/position.rs:368-427)
[PASS]      AR-014: Downcasts go through T::from_u128(..).ok_or(TypeCastFailed) or try_into with
                    an explicit error — never a bare `as`
[PARTIAL]   AR-015: Two intentional `as u64` truncations of a u128.
                    File: state/pool.rs:327-332 and state/pool.rs:1096-1101
                    Impact: none — these implement mod-2^64 checkpoint semantics paired with
                    wrapping_sub; the justification is written at :1091-1094 and was verified
                    Fix: none; consider a named helper to make the intent unmistakable
[PASS]      AR-016: u16/u32 narrowing uses try_from with an error (fee_time_scheduler.rs:112,
                    fee_rate_limiter.rs:407)
[PASS]      AR-017: The only signed→unsigned cast is Clock::unix_timestamp as u64
                    (activation_handler.rs:42), which cannot be negative on a live cluster
[PASS]      AR-018: Every divisor is guarded — safe_div/checked_div return None on zero;
                    shl_div has an explicit `if y == 0` guard (u128x128_math.rs:56-58);
                    mul_div_u256 returns None on a zero denominator (:84-86). The two div_ceil
                    sites with a non-constant denominator are guarded upstream by
                    liquidity > DEAD_LIQUIDITY (compounding_liquidity.rs:25-28) and
                    sqrt_price >= MIN_SQRT_PRICE (ix_initialize_customizable_pool.rs:59-64)
[PASS]      AR-019: Division by pool.liquidity goes through shl_div_256, which returns None →
                    PoolError::MathOverflow when liquidity is 0 (state/pool.rs:833-835)
[PASS]      AR-020: Proportional removal divides by pool.liquidity only in the compounding handler,
                    where liquidity >= DEAD_LIQUIDITY > 0 is a construction invariant
[PASS]      AR-021: Zero-output is rejected — require!(token_a_amount > 0 || token_b_amount > 0)
                    on add (ix_add_liquidity.rs:112) and remove (ix_remove_liquidity.rs:136);
                    require!(excluded_transfer_fee_amount_in > 0) on all three swap modes
[PASS]      AR-022: Deposits round Up, in the pool's favour (ix_add_liquidity.rs:110)
[PASS]      AR-023: Withdrawals round Down, in the pool's favour (ix_remove_liquidity.rs:134)
[PASS]      AR-024: Dust rounding cannot be farmed — deposits round Up and withdrawals Down, and
                    the split path conserves exactly (calculate_shared_amounts returns
                    (amount - shared, shared), state/position.rs:631-640), so no value is created
[PASS]      AR-025: No first-depositor ratio exists — the initial price is an explicit validated
                    parameter, and compounding pools additionally burn DEAD_LIQUIDITY
[N/A]       AR-026: No share-minting formula — liquidity is CLMM-style, not mint-backed
[N/A]       AR-027: Same
[N/A]       AR-028: Same
[PASS]      AR-029: Slippage on add — token_a/b_amount_threshold (ix_add_liquidity.rs:142-149)
[PASS]      AR-030: Slippage on remove — token_a/b_amount_threshold, compared against the
                    post-transfer-fee amount (ix_remove_liquidity.rs:159-166)
[PASS]      AR-031: Donation cannot dilute — concentrated pools price from sqrt_price/liquidity,
                    and compounding pools price from tracked token_a_amount/token_b_amount fields,
                    never from vault balances (state/pool.rs:1273-1289)
[PASS]      AR-032: Removal is proportional and rounds down — remaining shares cannot be devalued
[PASS]      AR-033: Σ(position liquidity) + DEAD_LIQUIDITY == pool.liquidity holds on every path
                    (apply_add_liquidity/apply_remove_liquidity @ pool.rs:888-928; split is
                    position-to-position only)
[N/A]       AR-034: No shares mint to reconcile against
[N/A]       AR-035: No management fee
[N/A]       AR-036: No performance fee
[PASS]      AR-037: Protocol-fee formula uses checked math (state/fee.rs:240-283)
[PASS]      AR-038: Fee split conserves exactly — claiming + compounding + protocol + referral
                    == fee_amount by construction (fee.rs:249, 258, 275)
[PASS]      AR-039: validate_fee_fraction requires numerator < FEE_DENOMINATOR
                    (params/fee_parameters.rs:211-217); the ceiling is 99 %
[PASS]      AR-040: MIN_FEE_NUMERATOR (1 bps) enforced in every BaseFeeHandler::validate
[PASS]      AR-041: Fee ordering is explicit per direction/mode via FeeMode (state/fee.rs:404-428)
                    and reconciled in apply_swap_result (pool.rs:859-877)
[PASS]      AR-042: Fees are charged once per swap; there is no withdrawal fee to compound on
[PASS]      AR-043: Zero-value transfers are skipped (`if fee_a_pending > 0`,
                    `if amount == 0 { return Ok(()) }` @ ix_claim_protocol_fee2.rs:96-98)
[N/A]       AR-044: No NAV computation
[N/A]       AR-045: No NAV computation
[N/A]       AR-046: No NAV computation
[N/A]       AR-047: No NAV attestation
[N/A]       AR-048: No NAV attestation
[N/A]       AR-049: No NAV attestation PDA
[N/A]       AR-050: No NAV staleness concept
[PASS]      AR-051: All lamport values are u64; no narrowing
[PASS]      AR-052: The only lamport transfer computes its shortfall with safe_sub
                    (utils/token.rs:300-304)
[PASS]      AR-053: Rent exemption is topped up rather than assumed (utils/token.rs:292-308)
[PASS]      AR-054: No lamport-drain path other than Anchor `close`, which closes the account
[N/A]       AR-055: No WSOL wrap/unwrap logic — WSOL is handled as an ordinary SPL mint
[PASS]      AR-056: MAX-value inputs are proptested (tests/test_overflow.rs); rate-limiter
                    validation explicitly evaluates the fee at u64::MAX (fee_rate_limiter.rs:415)
[PASS]      AR-057: Zero-amount inputs rejected on every path — require!(amount_0 > 0)
                    (ix_p_swap.rs:126), require!(liquidity_delta > 0) (ix_add_liquidity.rs:82)
[PASS]      AR-058: 1-unit inputs round against the user on both directions
[PASS]      AR-059: The liquidity == 0 edge case returns MathOverflow via shl_div_256
                    (pool.rs:833-835); the panic-vs-error nit at the price solver is F-008
[N/A]       AR-060: No batch/aggregate withdrawal path — every position is independent
[PASS]      AR-061: Timestamp arithmetic uses safe_sub and min() guards throughout
                    (state/pool.rs:343-348, state/vesting.rs:46-66)
[FAIL-5]    AR-062: Simultaneous fee components are validated individually, never as a sum.
                    File: programs/cp-amm/src/state/pool.rs:1236-1252
                    Impact: base fee capped at 10 % on update while the dynamic component reaches
                    the 99 % ceiling unchecked — see F-001
                    Fix: assert max(base) + max(dynamic) <= MAX_FEE_NUMERATOR_POST_UPDATE
[PASS]      AR-063: Zero f32/f64 occurrences anywhere in the program (verified by grep over
                    programs/cp-amm/src excluding tests)
```

### Checklist 04 — CPI & PDA Safety (CPI-001 … RE-007)

```
[PASS]      CPI-001: CpiContext::new(token_program.key(), ..) — Pubkey first arg, Anchor 1.0 form
                     (ix_close_position.rs:63, ix_create_position.rs:157)
[PASS]      CPI-002: CpiContext::new_with_signer(token_program.key(), ..) — same
                     (ix_create_position.rs:139, ix_close_position.rs:86)
[PASS]      CPI-003: Token program validated per account — Program<'info, Token2022> for NFT ops,
                     Interface<TokenInterface> + `token::token_program` for vault ops, and
                     TokenInterface::check_id in the Pinocchio path (ix_swap.rs:185-186)
[PASS]      CPI-004: System program typed Program<'info, System>
[N/A]       CPI-005: No Associated Token Program CPI — ATAs are address-derived only, never created
[N/A]       CPI-006: No DEX aggregator CPI
[N/A]       CPI-007: No Metaplex CPI — Token-2022's metadata interface is used instead
[PASS]      CPI-008: No UncheckedAccount is ever used as a CPI program target
[N/A]       CPI-009: No remaining account is forwarded to a CPI
[PASS]      CPI-010: Raw invoke_signed instructions are built in-program with a validated
                     token_program key (utils/token.rs:167-187, 200-220)
[PASS]      CPI-011: transfer `from` is the user account or the pool vault, both constrained
[PASS]      CPI-012: transfer `to` is the vault, the user's account, or a validated ATA
[PASS]      CPI-013: transfer `authority` is the user Signer or the pool_authority PDA
[PASS]      CPI-014: transfer `amount` is always a computed state value, never raw user input
                     (except swap's amount_in, which is the user's own deposit)
[PASS]      CPI-015: mint_to targets the freshly `init`ed position NFT mint only
[PASS]      CPI-016: mint_to destination is the position_nft_account PDA
[PASS]      CPI-017: mint_to authority is pool_authority
[PASS]      CPI-018: mint_to amount is the constant 1 (ix_create_position.rs:165)
[PASS]      CPI-019: burn `from` is position_nft_account with token::authority = owner
[PASS]      CPI-020: burn authority is the owner Signer (ix_close_position.rs:68)
[PASS]      CPI-021: burn amount is the constant 1
[PASS]      CPI-022: close_account destinations are `rent_receiver`, chosen by the owner signer
[PASS]      CPI-023: close_account authority is the owner (NFT account) or pool_authority (NFT mint)
[PASS]      CPI-024: The only close_account targets are the position NFT mint and account —
                     pool vaults are never closed
[PASS]      CPI-025: The single system_program::transfer is payer → NFT mint for rent
                     (utils/token.rs:301-304)
[N/A]       CPI-026: The program never CPIs `approve`
[N/A]       CPI-027: The program never CPIs `revoke`
[PARTIAL]   PDA-001: One PDA omits a necessary seed component.
                     File: ix_initialize_customizable_pool.rs:161-172
                     Impact: global one-per-pair namespace — see F-004
                     Fix: add creator.key()
[N/A]       PDA-002: No "fund" PDA in this protocol
[PASS]      PDA-003: Full seed inventory enumerated in §7 State Model
[PASS]      PDA-004: Seed order is identical at init and in every re-derivation (const_pda.rs)
[PASS]      PDA-005: Vault seeds include the parent pool — [b"token_vault", mint, pool]
[N/A]       PDA-006: No program-derived mint (position NFT mints are caller keypairs)
[N/A]       PDA-007: No attestation/oracle PDA
[PASS]      PDA-008: Access-control PDAs include their subject — [b"operator", whitelisted_address],
                     [b"token_badge", mint]
[PASS]      PDA-009: Seeds match between derivation and usage in every case
[PASS]      PDA-010: Bumps are canonical and reused — const_pda::pool_authority::BUMP and
                     EVENT_AUTHORITY_AND_BUMP.1 are computed at compile time via const_crypto
                     and consumed by pool_authority_seeds! (macros.rs:2-9)
[PASS]      PDA-011: All seeds are fixed-length (Pubkey, u64::to_le_bytes, u8::to_le_bytes) —
                     no variable-length user data
[N/A]       PDA-012: No name seed
[PASS]      PDA-013: Seeds use only immutable identity (mints, config key, nft mint, index)
[PASS]      PDA-014: invoke_signed uses pool_authority_seeds!() for every pool-authority transfer
[PASS]      PDA-015: Signer seeds match the derivation exactly — same prefix, same canonical bump
[PASS]      PDA-016: The bump in invoke_signed is the stored compile-time canonical bump
[PASS]      PDA-017: invoke_signed (not invoke) is used wherever a PDA is the authority
                     (utils/token.rs:218, utils/p_helper.rs:63)
[PASS]      PDA-018: The one bare `invoke` is a System transfer authorized by the payer Signer
                     (utils/token.rs:301) — no PDA authority involved
[PASS]      PDA-019: All CPI instruction data is constructed in-program from validated values
[N/A]       PDA-020: No Jupiter CPI
[N/A]       PDA-021: The program never calls realloc
[N/A]       EXT-001: No Jupiter integration
[N/A]       EXT-002: No Jupiter integration
[N/A]       EXT-003: No Jupiter integration
[N/A]       EXT-004: No Jupiter integration
[N/A]       EXT-005: No Jupiter integration
[N/A]       EXT-006: No Jupiter integration
[N/A]       EXT-007: No Metaplex CPI
[N/A]       EXT-008: No Metaplex CPI
[N/A]       EXT-009: No whitelisted-protocol CPI
[N/A]       EXT-010: No whitelisted-protocol CPI
[PASS]      EXT-011: CPI callees are SPL Token/Token-2022, System and this program's own event
                     authority; the runtime blocks re-entry into cp-amm
[PARTIAL]   EXT-012: Transfer-hook handling is exclusion-only.
                     File: utils/token.rs:244-256
                     Impact: a permissionless mint's hook must have program_id AND authority both
                     None (inert), which is correct; but a badged hook mint would be admitted and
                     every transfer_checked would then fail for lack of resolved extra accounts,
                     leaving the pool unusable. No hook allowlist, no spl_transfer_hook_interface
                     resolution, no extra-account forwarding exists.
                     Fix: reject hook mints at badge time, or resolve and forward extra accounts
[PARTIAL]   EXT-013: PermanentDelegate / MintCloseAuthority / DefaultAccountState are rejected for
                     permissionless mints (utils/token.rs:237-260) but a TokenBadge bypasses the
                     check entirely (utils/token.rs:277-289) with no per-extension policy — see AV-064
[PARTIAL]   EXT-014: transfer_checked is used everywhere (PASS on that half), but credit accounting
                     is analytic rather than balance-delta based — see AV-062
[PASS]      EXT-015: Position-NFT metadata is claimed atomically at mint creation with
                     update_authority = pool_authority (ix_create_position.rs:129-145), and the
                     mint is closed on close_position so stale metadata cannot reappear
[PARTIAL]   RE-001: Checks-effects-interactions holds everywhere except one handler.
                     File: ix_claim_position_fee.rs:104-127
                     Impact: none today (runtime blocks re-entrancy; the position RefMut is held) —
                     see F-012
                     Fix: move reset_pending_fee() above the transfers
[PASS]      RE-002: No handler reads state after a CPI — every CPI is terminal in its handler
[N/A]       RE-003: No post-CPI reload is required, because no account is re-read after a CPI
[PASS]      RE-004: The program never grants an approval to an external program
[PASS]      RE-005: Flash-loan resistance — there is no share/NAV pricing to inflate; an atomic
                     deposit→withdraw round trip pays pool-favourable rounding on both legs, and a
                     swap round trip pays the fee twice
[PASS]      RE-006: The only signing accounts handed to a CPI are the user's Signer (SPL Token
                     transfers, which cannot move lamports) and the payer for a fixed-amount
                     System rent top-up
[PARTIAL]   RE-007: No post-CPI owner re-verification exists.
                     File: utils/token.rs:185, 218; utils/p_helper.rs:34, 63
                     Impact: none today — every CPI is the last action that touches the account in
                     its handler, so there is no post-CPI trust to violate
                     Fix: if a future handler reads an account after a CPI, re-assert its owner
```

### Checklist 05 — State Machine & Lifecycle (SM-001 … SM-072)

```
[PASS]      SM-001: Enums enumerated — PoolStatus, PoolType, LayoutVersion, CollectFeeMode,
                    ConfigType, BaseFeeMode, ActivationType, SwapMode, TradeDirection,
                    OperatorPermission, PositionDelegatePermission, ConfigPermission (§7)
[PASS]      SM-002: All variants listed in §7 State Model
[PASS]      SM-003: Every variant has an entry transition — PoolStatus via set_pool_status,
                    LayoutVersion::V1 via Pool::initialize / update_layout_version_if_needed
[PASS]      SM-004: PoolStatus toggles both ways (set_pool_status requires a change, :27-30);
                    LayoutVersion is a deliberate one-way migration
[PARTIAL]   SM-005: Intentional dead variants exist. BaseFeeMode::RateLimiter is rejected for new
                    pools (params/fee_parameters.rs:38-41, ix_initialize_pool.rs:221-224) but kept
                    for legacy pools; OperatorPermission::ClaimProtocolFee and ::ZapProtocolFee are
                    explicit ordinal placeholders (state/operator.rs:29-30). Documented, not dead code
[PASS]      SM-006: Zero-copy accounts are writable only by this program (owner enforcement)
[PASS]      SM-007: Terminal states identified — closed position/config/token-badge/operator,
                    finished Vesting, LayoutVersion::V1
[PASS]      SM-008: Every terminal state returns rent — close_position, close_config,
                    close_token_badge, close_operator_account, and the auto-close of a completed
                    Vesting (ix_refresh_vesting.rs:78-83)
[N/A]       SM-009: No multi-step withdrawal lifecycle — removal is atomic
[N/A]       SM-010: Same
[N/A]       SM-011: Same
[N/A]       SM-012: Same
[N/A]       SM-013: Same
[N/A]       SM-014: Same — no missing readiness step, because there is no staged withdrawal
[N/A]       SM-015: Same
[N/A]       SM-016: Same
[N/A]       SM-017: Same
[N/A]       SM-018: Same
[N/A]       SM-019: Same
[N/A]       SM-020: Same
[N/A]       SM-021: No pending-withdrawal object; a position may hold several concurrent Vesting
                    accounts, each independently validated by vesting.position == position
[N/A]       SM-022: No withdrawal deadline concept
[PASS]      SM-023: Withdrawals cannot be stuck — can_remove_liquidity requires only
                    current_point >= activation_point and ignores the pause flag
                    (pool_action_access/permissionless.rs:46-48)
[PASS]      SM-024: Partial withdrawal supported — liquidity_delta <= unlocked_liquidity
                    (ix_remove_liquidity.rs:122-126)
[PASS]      SM-025: Pool::initialize sets every field (state/pool.rs:413-456)
[PASS]      SM-026: Creator, fees, mints, vaults, price bounds, activation and flags all set at init
[PASS]      SM-027: Re-initialization is impossible — Anchor `init` on a PDA
[N/A]       SM-028: There is no pool-closure instruction (see SM-031 / F-015)
[N/A]       SM-029: No pool closure to precondition
[N/A]       SM-030: No pool closure to precondition
[FAIL-2]    SM-031: No pool-closure instruction exists.
                    File: programs/cp-amm/src/lib.rs (absence of close_pool)
                    Impact: ~0.0119 SOL of rent permanently locked per abandoned pool; compounds
                    the permanence of F-004 — see F-015
                    Fix: add an emptiness-proved close_pool, or document the permanence
[N/A]       SM-032: No name seed — pools are keyed by (config, mint pair) or (mint pair)
[PASS]      SM-033: create_position → add_liquidity → position.unlocked_liquidity increases
[PASS]      SM-034: apply_add_liquidity updates both position and pool atomically (pool.rs:888-907)
[PASS]      SM-035: Positions are created by create_position or implicitly at pool init
[PASS]      SM-036: Position tracks unlocked/vested/permanent_locked liquidity, pending fees,
                    PositionMetrics and per-reward totals (state/position.rs:86-116)
[PARTIAL]   SM-037: close_position exists and requires an empty position, but it is opt-in — a
                    zero-liquidity position lingers until the owner closes it.
                    File: ix_close_position.rs:54-56
                    Impact: rent remains locked at the owner's own expense
                    Fix: none required; noted for completeness
[PASS]      SM-038: Liquidity cannot underflow — safe_sub on every reduction
                    (state/position.rs:286-289, state/pool.rs:923)
[PASS]      SM-039: Position accounting fields are updated atomically within each handler
[PASS]      SM-040: A 0-liquidity position is valid; update_fee and update_rewards short-circuit
                    on zero liquidity (state/position.rs:252-253)
[PASS]      SM-041: Pre-conditions are checked — set_pool_status requires a change (:27-30),
                    update_reward_duration requires the campaign ended (:37-42), initialize_reward
                    requires !initialized (:59-60)
[PASS]      SM-042: No transition skips a state
[PASS]      SM-043: Transitions are atomic — Solana transaction semantics
[PASS]      SM-044: A failed instruction reverts all account writes
[PASS]      SM-045: Replay-safe — claim_position_fee / claim_reward reset pending to 0;
                    refresh_vesting is idempotent (vesting.rs:68-72)
[PASS]      SM-046: Post-close PDA reuse is safe — see AV-055
[FAIL-3]    SM-047: Six privileged state-changing instructions emit no event.
                    File: ix_create_operator_account.rs:35-47, lib.rs:79-82,
                    ix_fix_pool_fee_params.rs:62, ix_fix_config_fee_params.rs:46,
                    ix_fix_pool_layout_version.rs:15-19, ix_close_token_badge.rs:22-25
                    Impact: permission grants and fee fixes are not indexable — see F-006
                    Fix: add EvtCreateOperatorAccount / EvtCloseOperatorAccount / EvtFixPoolFeeParams
[PASS]      SM-048: Events carry pool, position, owner, amounts, reserves and timestamps
                    (event.rs:111-124, 286-301)
[PARTIAL]   SM-049: Events are emitted via emit_cpi! self-CPI with a verified event authority
                    (entrypoint.rs:16-23), so they cannot be forged; but claim_protocol_fee2 uses
                    plain emit! and the code notes the log may be truncated
                    (ix_claim_protocol_fee2.rs:132)
                    Fix: convert to emit_cpi!
[PARTIAL]   SM-050: Off-chain reconstruction is incomplete for the same reason as SM-047 —
                    permission and fee-fix history cannot be rebuilt from events
[N/A]       SM-051: No shares mint to reconcile against supply
[PASS]      SM-052: Σ(position liquidity) + DEAD_LIQUIDITY == pool.liquidity — see AR-033
[PASS]      SM-053: Tracked reserves stay >= true reserves — credits round Up, debits round Down
                    (ix_add_liquidity.rs:110 vs ix_remove_liquidity.rs:134); proptested in
                    tests/test_modify_liquidity.rs and tests/test_integration.rs
[PASS]      SM-054: apply_add_liquidity increases both liquidity and tracked reserves (pool.rs:902-904)
[PASS]      SM-055: apply_remove_liquidity decreases both (pool.rs:923-925)
[PASS]      SM-056: Swaps leave pool.liquidity unchanged and move only price and reserves
                    (apply_swap_result, pool.rs:813-886)
[PASS]      SM-057: No sentinel timestamps — activation_point defaults to the current point
                    (ix_initialize_pool.rs:239-241), cliff_point defaults to now
                    (ix_lock_position.rs:24-26)
[N/A]       SM-058: No timestamp sentinel is in use
[PARTIAL]   SM-059: Terminal cleanup is mostly centralized (close_position), but refresh_vesting
                    closes finished Vesting accounts inline (ix_refresh_vesting.rs:78-83) rather
                    than through a shared helper. Side effects are identical (rent → owner)
[PASS]      SM-060: Each terminal state has exactly one transition into it, and each invokes its
                    cleanup
[PASS]      SM-061: Drain and zeroing are same-transaction — claim_protocol_fee zeroes before the
                    transfer (pool.rs:1127-1128); claim_reward / claim_ineligible_reward reset
                    before paying; claim_position_fee zeroes in the same tx (ordering nit: F-012)
[PASS]      SM-062: One canonical activation_point drives can_swap, can_remove_liquidity and every
                    fee scheduler — no duplicated inline time math
[PASS]      SM-063: Paired gates are exact complements — can_swap uses current >= activation
                    (permissionless.rs:50-60) while the schedulers' alpha-vault branch uses
                    current < activation (fee_time_scheduler.rs:126, fee_market_cap_scheduler.rs:133)
[PARTIAL]   SM-064: set_pool_status uses an exclusion-style guard (new != current) rather than an
                    explicit transition matrix.
                    File: ix_set_pool_status.rs:27-30
                    Impact: none with two variants; would matter if PoolStatus gained a third
                    Fix: an is_allowed_transition matrix if the enum ever grows
[PASS]      SM-065: Terminal states are absorbing — permanent_locked_liquidity has no release path
                    and a burned NFT cannot be re-minted
[PASS]      SM-066: No privileged path can rewrite position liquidity or lifecycle state — the
                    operator surface is limited to fees, status, configs, badges and reward config
[PASS]      SM-067: Sub-state is preserved across updates — update_pool_fees keeps init_sqrt_price
                    and untouched sub-fields; to_dynamic_fee_struct resets only the dynamic-fee
                    accumulators, which is the documented intent (state/pool.rs:1244-1248)
[PASS]      SM-068: The only fixed-slot collection is reward_infos: [RewardInfo; 2], iterated in
                    full with `for reward_idx in 0..NUM_REWARDS` plus an initialized() skip
                    (pool.rs:1133-1140, position.rs:311-320) — never `break` on the first empty slot
[PASS]      SM-069: The cached aggregate (pool.liquidity, the reward denominator) is refreshed by
                    pool.update_rewards before EVERY contributing mutation, including the in-program
                    split path (ix_split_position2.rs:169) — not only after CPIs
[PASS]      SM-070: Elapsed-time subtraction cannot underflow — get_max_unlocked_liquidity returns
                    0 when current_point < cliff_point BEFORE any subtraction
                    (state/vesting.rs:47-49), then uses safe_sub
[PASS]      SM-071: Units are consistent — cliff_point, period_frequency and the clock reading all
                    come from ActivationHandler::get_current_point(pool.activation_type), so a
                    slot pool uses slots end-to-end and a timestamp pool uses seconds end-to-end
[PASS]      SM-072: Cliff and linear release are correct — zero before the cliff (vesting.rs:47-49),
                    linear from cliff_point capped at number_of_period (:55-63); proptested in
                    tests/test_split_inner_vesting.rs and tests/splitVesting.test.ts
```

### Checklist 06 — Economic & Logic (ECON-001 … ECON-089)

```
[PASS]      ECON-001: No NAV or share price exists to inflate; a flash-borrowed round trip pays the
                      swap fee on both legs and pool-favourable rounding on both liquidity legs
[PARTIAL]   ECON-002: No deposit→withdraw cooldown exists.
                      File: ix_add_liquidity.rs / ix_remove_liquidity.rs (no time gate)
                      Impact: atomic add+remove is loss-making (Up/Down rounding), but
                      just-in-time liquidity around a known large swap can capture fees without
                      price exposure — an accepted CLMM-wide property, not a defect
[N/A]       ECON-003: No share minting to delay
[N/A]       ECON-004: Liquidity is a position NFT, not a fungible collateral token
[N/A]       ECON-005: No NAV attestation
[PASS]      ECON-006: Slippage enforced in all three swap modes, on the post-transfer-fee net
                      amount (swap_exact_in.rs:45-48, swap_exact_out.rs:48-51,
                      swap_partial_fill.rs:52-55)
[PARTIAL]   ECON-007: Swaps are sandwichable, as in any AMM; mitigations are user slippage and
                      the deprecated rate limiter. Inherent to the design, documented here
[N/A]       ECON-008: No manager-directed swap path
[PARTIAL]   ECON-009: A liquidity add can be front-run to shift sqrt_price so the LP deposits at a
                      worse ratio; token_a/b_amount_threshold bounds the loss
                      (ix_add_liquidity.rs:142-149)
[PASS]      ECON-010: Withdrawal sandwiching is bounded by token_a/b_amount_threshold
                      (ix_remove_liquidity.rs:159-166)
[PARTIAL]   ECON-011: No minimum swap size beyond `> 0`; dust trades are self-limiting via fees
                      and transaction cost
[PARTIAL]   ECON-012: No minimum withdrawal size beyond a non-zero output requirement
                      (ix_remove_liquidity.rs:136-139)
[N/A]       ECON-013: No share ratio — the creator sets sqrt_price and liquidity explicitly
[PASS]      ECON-014: Donations are inert — pricing never reads vault balances (see AR-031)
[PASS]      ECON-015: Minimum initial liquidity enforced — require!(liquidity > 0) for concentrated
                      pools (ix_initialize_pool.rs:213) and require!(liquidity > DEAD_LIQUIDITY)
                      for compounding pools (compounding_liquidity.rs:25-28)
[PASS]      ECON-016: A dead-shares mechanism exists — DEAD_LIQUIDITY = 100 << 64 is permanently
                      burned into every compounding pool (compounding_liquidity.rs:13, 38) and its
                      accrued fees/rewards are swept to the protocol/funder, never to a user
[PASS]      ECON-017: The initial price is an explicit parameter validated into
                      [sqrt_min_price, sqrt_max_price] (ix_initialize_customizable_pool.rs:53-72)
[N/A]       ECON-018: No NAV attestation
[N/A]       ECON-019: No NAV attestation
[N/A]       ECON-020: No NAV attestation
[N/A]       ECON-021: No NAV attestation
[N/A]       ECON-022: No NAV attestation
[N/A]       ECON-023: No NAV attestation
[N/A]       ECON-024: No NAV attestation
[N/A]       ECON-025: No NAV attestation
[FAIL-5]    ECON-026: An operator can extract more than the documented fee.
                      File: state/pool.rs:1236-1252 — see F-001
[FAIL-5]    ECON-027: Fees can be changed retroactively for existing LPs and traders.
                      File: instructions/operator/ix_update_pool_fees.rs:115-132 — see F-001
[FAIL-5]    ECON-028: There is no timelock on any fee change; it takes effect in the same slot.
                      File: instructions/operator/ix_update_pool_fees.rs:115-132 — see F-001
[PASS]      ECON-029: Wash trading pays the full fee on each leg; there is no volume rebate
[N/A]       ECON-030: No management fee
[N/A]       ECON-031: No performance fee / high-water mark
[PASS]      ECON-032: Fee extraction order is explicit per direction (state/fee.rs:404-428) and
                      reconciled in apply_swap_result (state/pool.rs:859-877)
[PASS]      ECON-033: Every vault-outflow CPI is amount-bounded by a state field — remove_liquidity
                      by liquidity math, claim_position_fee by fee_*_pending, claim_reward by
                      reward_pendings, claim_protocol_fee2 by protocol_*_fee, the swap output by
                      the curve, the referral leg by referral_fee
[N/A]       ECON-034: No manager-directed asset swaps
[PASS]      ECON-035: No arbitrary pda_token_transfer instruction exists
[N/A]       ECON-036: No pda_token_transfer
[N/A]       ECON-037: No pda_lamports_transfer
[N/A]       ECON-038: No pda_token_approve
[N/A]       ECON-039: No manager-routed vault swap
[N/A]       ECON-040: No protocol-CPI whitelist
[N/A]       ECON-041: No protocol-CPI whitelist
[N/A]       ECON-042: No protocol-CPI whitelist
[PARTIAL]   ECON-043: LPs can always withdraw (pause never blocks removal), but there is no
                      timelock or multisig requirement on operator fee changes (F-001) and the
                      upgrade authority is not verifiable offline (OPS-001)
[PARTIAL]   ECON-044: Transfer-hook mints must be inert to be permissionless; a badged hook mint
                      would brick its pool rather than be exploitable — see EXT-012
[PASS]      ECON-045: Fee-on-transfer handled on every leg via
                      calculate_transfer_fee_included/excluded_amount (utils/token.rs:70-142)
[PASS]      ECON-046: Rebasing mints are excluded by is_permissionless_supported_mint, and
                      compounding pools price from tracked reserves, so a rebase cannot move price
[PARTIAL]   ECON-047: A pool-token mint with a freeze authority can freeze the pool vault and
                      permanently block that pool's swaps and withdrawals.
                      File: utils/token.rs:223-262 (freeze_authority never inspected)
                      Impact: one pool bricked; no cross-pool contagion (isolated vaults)
                      Fix: surface freeze_authority at pool creation — see AV-065
[PASS]      ECON-048: Post-purchase supply inflation of a pool token affects only that pool's LPs;
                      vaults are per-pool so there is no contagion
[PASS]      ECON-049: All decimal ranges handled — decimals read from the mint for every
                      transfer_checked; A and B amounts are never summed
[N/A]       ECON-050: No WSOL wrap/unwrap logic
[PASS]      ECON-051: No unbounded loop on user-supplied data except refresh_vesting's
                      remaining-account loop, whose compute the caller pays for
[PASS]      ECON-052: No batch operation iterates positions
[N/A]       ECON-053: No pay_fund_investors equivalent
[PARTIAL]   ECON-054: create_position is permissionless and bloats state at the attacker's own
                      rent cost; pool.metrics.total_position uses wrapping_add but nothing depends
                      on it (state/pool.rs:202-204)
[N/A]       ECON-055: No growable collection in state — all accounts are fixed-layout zero-copy
[PASS]      ECON-056: No state can lock funds — can_remove_liquidity ignores the pause flag
[N/A]       ECON-057: No external price oracle
[N/A]       ECON-058: No oracle staleness concept
[N/A]       ECON-059: No oracle confidence interval
[FAIL-3]    ECON-060: The party who moves the price benefits from the resulting fee tier.
                      File: base_fee/fee_market_cap_scheduler.rs:137-158
                      Impact: attacker-selectable fee tier for another user's swap — see F-007
                      Fix: ratchet the period, or feed the scheduler a TWAP
[N/A]       ECON-061: No fallback oracle (none needed — no oracle)
[PASS]      ECON-062: The absence of an oracle is deliberate and documented: price discovery is the
                      pool itself, and the trust assumption is recorded in §8
[PASS]      ECON-063: Settle-then-shrink is enforced — position.update_rewards
                      (ix_remove_liquidity.rs:130) and position.update_fee (pool.rs:917) both run
                      before remove_unlocked_liquidity
[PASS]      ECON-064: The pending formula is applied on EVERY payout and every liquidity change —
                      add, remove, split, claim-fee, claim-reward — and each sets the checkpoint to
                      the current global value (position.rs:76, 270-271)
[PASS]      ECON-065: The accumulator is flushed before the denominator changes — pool.update_rewards
                      at ix_add_liquidity.rs:106 precedes apply_add_liquidity at :117, and
                      ix_remove_liquidity.rs:130 precedes :168
[PASS]      ECON-066: Snapshot and accumulator share scale and units — UserRewardInfo
                      .reward_per_token_checkpoint vs RewardInfo.reward_per_token_stored both U256
                      at TOTAL_REWARD_SCALE; Position.fee_*_per_token_checkpoint vs
                      Pool.fee_*_per_liquidity both U256 at LIQUIDITY_SCALE
[PASS]      ECON-067: Precision — shl_div_256(fee, liquidity, 128) and mul_shr_256 widen to
                      U256/U512 and multiply before dividing (pool.rs:833, position.rs:254-266)
[PASS]      ECON-068: Rewards are paid from a dedicated reward_vault PDA funded by fund_reward, and
                      reward_rate is derived from the funded amount (pool.rs:379-409), so owed
                      cannot exceed funded
[PASS]      ECON-069: Zero-stake guard — RewardInfo::update_rewards short-circuits when
                      liquidity_supply == 0 and banks the elapsed time in
                      cumulative_seconds_with_empty_liquidity_reward (pool.rs:289-314), reclaimable
                      via withdraw_ineligible_reward
[PASS]      ECON-070: Settle-before-rate-change — fund_reward calls pool.update_rewards(now) at
                      ix_fund_reward.rs:80 BEFORE update_rate_after_funding at :113
[N/A]       ECON-071: No randomness, lottery or reward-selection mechanism
[FAIL-2]    ECON-072: No aggregate outflow cap and no protocol-wide pause exist.
                      File: instructions/operator/ix_set_pool_status.rs:21-39 (per-pool only)
                      Impact: containment scales linearly with pool count — see F-014
                      Fix: add a guardian-held global pause flag consulted by the access validator
[N/A]       ECON-073: No unrealized-PnL collateral
[N/A]       ECON-074: No lending or reserve redeployment — pools are fully isolated
[PASS]      ECON-075: Slippage protects NET output — the guard compares the post-fee,
                      post-transfer-fee amount (swap_exact_in.rs:37-48)
[PASS]      ECON-076: The fee base is the executed amount — partial fill recomputes the fee on
                      actual_amount_in after subtracting the unconsumed remainder (pool.rs:634-669)
[PASS]      ECON-077: Fees are netted from token proceeds; no separate lamport debit
[PASS]      ECON-078: Unambiguous naming — SwapResult2 carries distinct
                      included_fee_input_amount / excluded_fee_input_amount / output_amount /
                      claiming_fee / compounding_fee / protocol_fee / referral_fee (pool.rs:1292-1304)
[N/A]       ECON-079: Not a bonding-curve launchpad
[N/A]       ECON-080: Not a bonding-curve launchpad
[N/A]       ECON-081: Not a bonding-curve launchpad
[PARTIAL]   ECON-082: Every vault has a withdrawal path — pool vaults via remove_liquidity /
                      claim_position_fee / claim_protocol_fee2, reward vaults via claim_reward /
                      withdraw_ineligible_reward / withdraw_dead_liquidity_reward. Residual: the
                      forced 1-unit transfer at ix_initialize_customizable_pool.rs:381-383 is never
                      credited to tracked reserves and has no withdrawal path — stranded dust
[PASS]      ECON-083: Cumulative caps enforced — claim_protocol_fee decrements protocol_*_fee by
                      exactly what it pays (pool.rs:1118-1130); claim_reward and
                      claim_ineligible_reward reset their source field before paying;
                      claim_dead_liquidity_reward advances a checkpoint (pool.rs:321-341)
[PASS]      ECON-084: Residual extraction settles first — withdraw_ineligible_reward requires
                      current_timestamp > reward_duration_end (ix_withdraw_ineligible_reward.rs:51-55)
                      and pays only explicitly banked empty-liquidity seconds;
                      settle_dead_liquidity_fee sweeps only the unowned DEAD_LIQUIDITY share
[N/A]       ECON-085: No internal TWAP accumulator — the dynamic-fee volatility accumulator is
                      bounded by max_volatility_accumulator (state/fee.rs:335-338) and is not a
                      price feed
[N/A]       ECON-086: No TWAP accumulator
[N/A]       ECON-087: No TWAP accumulator / measurement window
[N/A]       ECON-088: No TWAP accumulator to read early
[FAIL-2]    ECON-089: The velocity breaker is absent for every drain cause.
                      File: instructions/operator/ix_set_pool_status.rs:21-39
                      Impact: no rolling outflow accounting; the pause role is not separated from
                      the fee-setting operator role — see F-014
                      Fix: guardian-held global pause + per-window outflow accounting
```

### Checklist 07 — OpSec & Governance (OPS-001 … OPS-085)

```
[UNKNOWN]   OPS-001: Upgrade authority — requires `solana program show`; no network access (Rule 10)
[UNKNOWN]   OPS-002: Multisig vs single wallet — not observable offline
[UNKNOWN]   OPS-003: Multisig threshold — not observable offline
[UNKNOWN]   OPS-004: Signer identities — not observable offline
[UNKNOWN]   OPS-005: Hardware-wallet custody — organisational, not in-repo
[UNKNOWN]   OPS-006: Upgrade timelock — no timelock program is referenced anywhere in the repo,
                     but an out-of-tree Squads/timelock configuration cannot be ruled out
[UNKNOWN]   OPS-007: On-chain vs policy enforcement of any timelock — not observable offline
[UNKNOWN]   OPS-008: Timelock duration vs the 24h/72h recommendation — depends on OPS-006/007
[UNKNOWN]   OPS-009: Who can change the upgrade authority — not observable offline
[UNKNOWN]   OPS-010: Immutability status — not observable offline
[PASS]      OPS-011: Yes, by definition — an upgrade can redefine every handler, and pool_authority
                     is a program-owned PDA, so a malicious upgrade drains every vault. Recorded as
                     the protocol's top trust assumption (§8)
[UNKNOWN]   OPS-012: Emergency-upgrade process — organisational, not in-repo
[PASS]      OPS-013: No hidden admin instruction — the only hardcoded-pubkey gate is
                     admin::ADMINS (instructions/admin/auth.rs:7-10), documented in the README's
                     Admin section and present in open source
[FAIL-4]    OPS-014: A god-mode bypass exists under a build feature.
                     File: programs/cp-amm/src/instructions/admin/auth.rs:13-16
                     Impact: `--features local` makes every signer an admin — see F-002
                     Fix: compile_error! on a deployable target
[PASS]      OPS-015: All pubkey-equality gates are declared constants — admin::ADMINS,
                     const_pda::pool_authority::ID, const_pda::protocol_fee_authority::ID,
                     alpha_vault::ID, RATE_LIMITER_STACK_WHITELIST_PROGRAMS (constants.rs:62-65,
                     the OKX smart-wallet stack-height exemption) and crate::ID as the referral
                     sentinel. No undeclared conditional
[FAIL-3]    OPS-016: Callable dead code exists.
                     File: programs/cp-amm/src/lib.rs:264-270
                     Impact: swap/swap2 return Ok(()) if the custom entrypoint is compiled out —
                     see F-009
                     Fix: return err!(..) and add a compile_error! guard
[PARTIAL]   OPS-017: The IDL is not committed, so IDL↔binary equivalence cannot be checked here.
                     The idl-build-only dummy_ix (lib.rs:340-346) is compiled out of the deployed
                     binary, as is ForIdlTypeGenerationDoNotCallThis (lib.rs:45-54)
                     Fix: publish the IDL alongside each release and verify it on-chain
[PASS]      OPS-018: The protocol-fee destination cannot be redirected — it is the external
                     protocol_fee program's PDA, a compile-time constant (const_pda.rs:25-35)
[N/A]       OPS-019: No DEX/aggregator program ID is stored or mutable
[PASS]      OPS-020: pool.creator is set once at initialization and never mutated afterwards
[N/A]       OPS-021: No shares mint — no dilution instruction can exist
[N/A]       OPS-022: No shares mint — no burn-without-withdrawal instruction can exist
[PARTIAL]   OPS-023: Three unsafe sites. entrypoint.rs:28/110/115 carry a written justification for
                     split_at_unchecked (:52-54); ix_p_swap.rs:290 uses Instructions::new_unchecked
                     after asserting the sysvar key (:282-284); utils/p_helper.rs:120 has only a
                     reference link
                     Fix: document the layout invariant at p_helper.rs:118-122
[PARTIAL]   OPS-024: Raw pointers exist in the Pinocchio fast path (`*mut u8` entrypoint,
                     `*const [u8;2]` at utils/p_helper.rs:120). Expected for Pinocchio, atypical
                     for an Anchor program — called out so reviewers do not treat it as a red flag
[PASS]      OPS-025: declare_id!("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG") @ lib.rs:42 matches
                     Anchor.toml [programs.localnet] and the README's mainnet/devnet addresses
[UNKNOWN]   OPS-026: Verifiable build — cannot be reproduced offline (build and network blocked)
[UNKNOWN]   OPS-027: Deploy-keypair custody — organisational, not in-repo
[FAIL-3]    OPS-028: A private key is stored in the repository.
                     File: keys/local/admin-bossj3JvwiNK7pvjr149DqdtJxf2gdygbcmEPTkb2F1.json
                     Impact: permanently public signing key — see F-005
                     Fix: remove, treat as compromised, generate test wallets at runtime
[UNKNOWN]   OPS-029: Manager/operator wallet custody — organisational, not in-repo
[N/A]       OPS-030: No backend service in this repository
[N/A]       OPS-031: No backend service wallet
[N/A]       OPS-032: No third-party API keys in scope
[N/A]       OPS-033: No third-party API keys in scope
[N/A]       OPS-034: Anchor.toml targets Localnet; no production RPC endpoint is configured in-repo
[N/A]       OPS-035: No frontend in this repository
[FAIL-3]    OPS-036: A key has been committed to git.
                     Evidence: `git log --all --diff-filter=A --name-only -- "keys/*"` → a3d3827
                     Impact: the key is in history and on every fork/mirror — see F-005
                     Fix: rotate the address out of use; add a secret scanner to CI
[UNKNOWN]   OPS-037: Multisig platform — not observable offline
[UNKNOWN]   OPS-038: Multisig threshold > 50 % — not observable offline
[UNKNOWN]   OPS-039: Signer power distribution — not observable offline
[UNKNOWN]   OPS-040: Backup signers — not observable offline
[UNKNOWN]   OPS-041: Threshold-change protection — not observable offline
[UNKNOWN]   OPS-042: Proposal expiry — not observable offline
[FAIL-3]    OPS-043: Privileged executions are not auditable from events.
                     File: ix_create_operator_account.rs:35-47 and five others
                     Impact: no event trail for permission grants — see F-006
                     Fix: emit EvtCreateOperatorAccount / EvtCloseOperatorAccount
[PARTIAL]   OPS-044: No incident-response plan is present in this repository — no SECURITY.md,
                     no INCIDENT*/RUNBOOK* file. One may exist out of tree
[PARTIAL]   OPS-045: A per-pool pause exists (set_pool_status) but there is no protocol-wide pause
                     and no batch variant — see F-014
[PARTIAL]   OPS-046: No bug-bounty reference in-repo; the README links a published audit report at
                     docs.meteora.ag but no disclosure programme
[PARTIAL]   OPS-047: No security contact in-repo (no SECURITY.md, no security@ address)
[N/A]       OPS-048: Value-movement alerting is off-chain infrastructure, not observable here
[N/A]       OPS-049: Upgrade-transaction alerting — off-chain
[N/A]       OPS-050: Anomaly alerting — off-chain
[N/A]       OPS-051: War-room process — organisational
[N/A]       OPS-052: Post-mortem process — organisational
[PASS]      OPS-053: Time-locked actions enumerated — pool activation_point, alpha-vault
                     pre-activation window (SLOT_BUFFER/TIME_BUFFER), base-fee time scheduler,
                     market-cap scheduler expiration, rate-limiter duration (legacy), position
                     vesting cliff/periods, reward duration. Full list in §6 Instruction Matrix
[UNKNOWN]   OPS-054: Program-upgrade timelock duration — not observable offline
[FAIL-5]    OPS-055: Fee changes have no timelock.
                     File: instructions/operator/ix_update_pool_fees.rs:115-132,
                     ix_fix_pool_fee_params.rs:24-92, ix_fix_config_fee_params.rs:20-66
                     Impact: a fee change takes effect in the same slot — see F-001
                     Fix: propose → wait → execute
[N/A]       OPS-056: No manager role to change
[PARTIAL]   OPS-057: Badge and operator changes take effect immediately with no timelock
                     (ix_create_token_badge.rs, ix_create_operator_account.rs)
[PASS]      OPS-058: The protocol-fee destination is immutable — a compile-time PDA of the external
                     protocol_fee program (const_pda.rs:25-35)
[N/A]       OPS-059: No timelock exists to bypass
[N/A]       OPS-060: No queued transactions to cancel
[PARTIAL]   OPS-061: EvtUpdatePoolFees is emitted, but fix_pool_fee_params, fix_config_fee_params
                     and operator grants emit nothing (F-006), and no change is announced before
                     it takes effect (OPS-055)
[PARTIAL]   OPS-062: The `local` feature separates dev behaviour, but the same repository ships a
                     committed dev "admin" keypair (F-005) and the feature disables the admin
                     allowlist entirely (F-002) — dev and prod are not cleanly segregated
[N/A]       OPS-063: Deploy access is organisational, not in this repository
[PASS]      OPS-064: CI does not auto-deploy — the workflow has build and test jobs only, no
                     deploy step and no deploy secret (.github/workflows/ci.yml)
[N/A]       OPS-065: Server access — no servers in scope
[N/A]       OPS-066: Database access — no database in scope
[PASS]      OPS-067: No wallet private key appears in any workflow environment; CI generates a
                     throwaway key (`solana-keygen new --no-bip39-passphrase`,
                     .github/actions/setup-solana/action.yml:16)
[N/A]       OPS-068: No secrets are consumed by this repository's CI, so no secret manager is needed
[PASS]      OPS-069: The program is open source with a license (license.md) and a public README
[UNKNOWN]   OPS-070: Published-source vs deployed-binary equivalence — needs a build + network
[PARTIAL]   OPS-071: Reproducibility preconditions are in place — rust-toolchain.toml pins 1.93.0,
                     Anchor.toml pins anchor 1.0.2 / solana 3.1.10, Cargo.lock and bun.lock are
                     committed — but the reproduction itself could not be run offline
[PASS]      OPS-072: Git history in the audited range is linear and shows no rewriting
                     (a85c926 ← 2565067 ← bdd8a1e ← a3d3827, all release merges)
[PARTIAL]   OPS-073: CI is `on: pull_request` against main/release_*, implying a PR workflow, but
                     branch-protection and required-review settings are not visible in-tree and no
                     CODEOWNERS file exists
[FAIL-4]    OPS-074: The CI pipeline itself is not secured against action substitution.
                     File: .github/workflows/ci.yml:26, 42; .github/actions/setup-solana/action.yml:12
                     Impact: a retagged action runs in the same workspace as the program build —
                     see F-003
                     Fix: pin every action to a commit SHA; add `permissions: contents: read`
[PARTIAL]   OPS-075: Cargo.lock and bun.lock are committed and pinocchio is pinned to a git rev,
                     but Cargo.toml declares anchor-lang = "1.0.2" (i.e. ^1.0.2), so a lockfile
                     refresh can move the framework's minor version
                     Fix: use `=1.0.2` for anchor-lang / anchor-spl / anchor-client
[N/A]       OPS-076: No stake-account interaction
[PARTIAL]   OPS-077: Privileged instructions carry no durable-nonce restriction, no version/epoch
                     guard and no timelock, so a pre-signed privileged transaction stays valid
                     until its blockhash expires (indefinitely under a durable nonce).
                     File: lib.rs:71-199 (all admin/operator entry points)
                     Impact: bounded by what an operator can do (F-001, F-014)
                     Fix: add a config version/epoch check to privileged paths
[PARTIAL]   OPS-078: Admin rotation is possible only via program upgrade — admin::ADMINS is a
                     hardcoded [Pubkey; 2] (auth.rs:7-10). There are two admins rather than one
                     (no single SPOF) but no propose/accept handshake and no timelock
                     Fix: move the admin set into a governed account with two-step rotation
[PASS]      OPS-079: Every fee/treasury vault has an access-controlled sweep — protocol fees via
                     claim_protocol_fee2, reward vaults via withdraw_ineligible_reward and
                     withdraw_dead_liquidity_reward, pool vaults via remove_liquidity /
                     claim_position_fee
[PARTIAL]   OPS-080: UpdatePoolFeesParameters resolves the Option ambiguity for dynamic fee
                     (None = skip, Some(default) = disable, Some(other) = update —
                     ix_update_pool_fees.rs:57-67), but compounding_fee_bps: Option<u16> still
                     conflates "clear to 0" with a legitimate 0, and cross-field validation of the
                     base + dynamic pair is absent (F-001)
[UNKNOWN]   OPS-081: Live multisig threshold — not fetchable offline
[FAIL-5]    OPS-082: An admin/config numeric lacks a meaningful upper bound.
                     File: params/fee_parameters.rs:177-185 (variable_fee_control and
                     max_volatility_accumulator bounded only by U24_MAX, "prevent program overflow")
                     Impact: the resulting fee is bounded only by the 99 % swap-time clamp — F-001
                     Fix: bound the derived fee, not just the raw inputs
[FAIL-5]    OPS-083: Interdependent config values are not cross-validated atomically.
                     File: state/pool.rs:1182-1271 (base-fee and dynamic-fee arms are independent)
                     Impact: an individually-valid write produces a >10 % effective fee — F-001
                     Fix: validate the whole resulting fee configuration as a unit before commit
[PASS]      OPS-084: Every denominator-bearing config value is non-zero-guarded —
                     sqrt_price_step_bps > 0, number_of_period > 0, scheduler_expiration_duration > 0,
                     reduction_factor > 0 (fee_market_cap_scheduler.rs:172-190);
                     period_frequency == 0 short-circuits rather than dividing
                     (fee_time_scheduler.rs:122-124, state/vesting.rs:51-53);
                     reward_duration ∈ [1 day, 1 year] (ix_initialize_reward.rs:54-57);
                     fee_increment_numerator < FEE_DENOMINATOR (fee_rate_limiter.rs:399-404)
[N/A]       OPS-085: Council-side signing legibility is a property of the multisig UI, outside this
                     repository
```

### Checklist 16 — Formal Verification & Testing (FV-001 … FV-072)

```
[PARTIAL]   FV-001: Invariants are encoded but not documented — proptests in test_modify_liquidity,
                    test_liquidity_compounding, test_integration and test_split_inner_vesting plus
                    12 const_assert_eq! layout locks; there is no SPEC.md / INVARIANTS.md
[PASS]      FV-002: Property tests exist — `proptest!` in 8 modules (test_fee_scheduler,
                    test_integration, test_modify_liquidity, test_liquidity_compounding,
                    test_reward, test_split_inner_vesting, test_swap, test_overflow)
[PARTIAL]   FV-003: Arithmetic identities are proptested (test_overflow.rs, test_safe_math.rs,
                    test_swap.rs) but not proved
[PARTIAL]   FV-004: The permission state space is covered (test_operator_permission.rs,
                    test_position_delegate_permission.rs); there is no explicit transition spec
[PARTIAL]   FV-005: Proptest explores a large input space; no model checker is used
[PARTIAL]   FV-006: test_integration.rs asserts reserve consistency across add/swap/remove
                    sequences, but there is no global tokens-in == tokens-out property spanning
                    all instructions
[PASS]      FV-007: Authority properties tested — test_operator_permission.rs,
                    test_position_delegate_permission.rs, and the TS suites configPermission,
                    delegatePosition, rewardByAdmin, rewardByCreator
[PASS]      FV-008: Liveness holds — every position can reach close_position, and withdrawal is
                    never gated on an operator action (permissionless.rs:46-48)
[N/A]       FV-009: No formal spec exists to drift from
[N/A]       FV-010: No machine-checked proof is claimed
[N/A]       FV-011: No custom FV properties are declared
[N/A]       FV-012: No FV results to report
[FAIL-3]    FV-013: No static-analysis tool runs in CI.
                    File: .github/workflows/ci.yml:96-105 (clippy installed, never invoked)
                    Impact: linter-detectable defects reach main — see F-010
                    Fix: add a `cargo clippy --workspace --all-targets -- -D warnings` job
[N/A]       FV-014: No static-analysis findings exist to triage, because no tool runs
[PARTIAL]   FV-015: [workspace.lints.rust] unexpected_cfgs = warn is the only configured lint; no
                    no-unwrap / no-panic rule, and `unwrap()` does appear in production code
                    (utils/token.rs:126)
[FAIL-3]    FV-016: Warnings are not errors.
                    File: .github/workflows/ci.yml (no -D warnings, no RUSTFLAGS)
                    Impact: warning-level regressions merge silently — see F-010
                    Fix: `-D warnings` in the clippy job
[PARTIAL]   FV-017: No clippy::pedantic or security ruleset; `overflow-checks = true` in
                    [profile.release] (Cargo.toml:6) is a meaningful hardening default that many
                    Solana programs omit
[PARTIAL]   FV-018: Dead code is not enforced; BaseFeeMode::RateLimiter and two OperatorPermission
                    variants are intentionally retained (SM-005)
[FAIL-3]    FV-019: No dependency vulnerability scanning.
                    File: .github/workflows/ci.yml (no cargo audit / cargo deny / bun audit)
                    Impact: a new RUSTSEC advisory produces no signal — see F-010
                    Fix: add a rustsec/audit-check job
[PARTIAL]   FV-020: Rust is the only production language and is covered by `cargo test`, but no
                    SAST tool is applied to it
[PASS]      FV-021: Suppressions are justified — #[allow(deprecated)] guards the retained
                    EvtSplitPosition2 path (lib.rs:14, ix_split_position2.rs:11, event.rs:256,
                    each adjacent to the #[deprecated] attribute that explains it) and
                    #[allow(unused_macros)] sits on the conditionally-used unwrap_or_return!
                    (macros.rs:11)
[PASS]      FV-022: Analysis/toolchain config is version-controlled — rust-toolchain.toml,
                    [workspace.lints] in Cargo.toml, .prettierrc, and the CI workflow
[PARTIAL]   FV-023: The program's only user-supplied deserialization surface beyond Anchor's is the
                    base-fee codec, which IS proptested for round-trip fidelity
                    (tests/test_base_fee_serde.rs); no dedicated cargo-fuzz target exists
[FAIL-3]    FV-024: No instruction-level fuzz targets.
                    File: repository root (no fuzz/ directory, no Trident, no cargo-fuzz)
                    Impact: handlers are exercised only by hand-written cases — see F-010
                    Fix: add Trident or cargo-fuzz + Mollusk targets for swap / add / remove / split
[N/A]       FV-025: No fuzz corpus exists to persist
[N/A]       FV-026: No fuzz campaign has been run
[PARTIAL]   FV-027: .gitignore excludes `proptest-regressions`, so shrunk counterexamples are never
                    committed as regression seeds
                    Fix: remove that line and commit the seeds
[PARTIAL]   FV-028: rust-sdk/src/quote_*.rs mirrors the on-chain math and is tested against
                    account fixtures (rust-sdk/src/tests/test_quote_*.rs) — a differential check in
                    spirit — but nothing automatically fuzzes SDK vs program for equivalence
[PASS]      FV-029: Arithmetic edge cases are proptested — tests/test_overflow.rs covers MAX and
                    near-overflow inputs; tests/test_safe_math.rs covers helper boundaries
[N/A]       FV-030: No API endpoints to fuzz
[PASS]      FV-031: Serialization round-trip is proptested for all three fee-mode layouts
                    (tests/test_base_fee_serde.rs)
[PARTIAL]   FV-032: README documents `bun run test` but no fuzz/verification methodology
[FAIL-3]    FV-033: Coverage is not measured.
                    File: .github/workflows/ci.yml (no tarpaulin / llvm-cov / lcov)
                    Impact: coverage claims are untested — see F-010
                    Fix: add a cargo llvm-cov job publishing branch coverage
[PARTIAL]   FV-034: 31 TS LiteSVM suites plus 20 Rust modules cover create/add/swap/remove/claim/
                    lock/split/rewards, but branch coverage is unmeasured (FV-033)
[PARTIAL]   FV-035: Nearly every instruction has a dedicated suite; fix_pool_layout_version,
                    fix_pool_fee_params and fix_config_fee_params have none
[PASS]      FV-036: Multi-step workflows are covered — tests/test_integration.rs (Rust proptest over
                    add→swap→remove sequences) and the end-to-end TS suites
[PASS]      FV-037: Edge cases covered — tests/testMaxFee.test.ts, tests/test_overflow.rs,
                    tests/test_safe_math.rs, plus the zero-amount guards exercised throughout
[PASS]      FV-038: Negative tests exist — 12 of 31 TS suites assert specific program error codes
                    via expectThrowsErrorCode / getCpAmmProgramErrorCode (claimProtocolFee2,
                    configPermission, delegatePosition, rewardByCreator, splitPosition and others)
[PARTIAL]   FV-039: Regression suites exist for past migrations (tests/layoutCompatiable.test.ts,
                    tests/deprecatedRateLimiter.test.ts), but proptest counterexamples are
                    gitignored (FV-027)
[PASS]      FV-040: Tests run on every PR — program_unit_test, rust_sdk_unit_test and
                    program_integration_test jobs, gated on `on: pull_request` to main/release_*
[PASS]      FV-041: The test environment mirrors production pins — SOLANA_CLI_VERSION 3.1.10,
                    ANCHOR_CLI_VERSION 1.0.2, TOOLCHAIN 1.93.0, matching rust-toolchain.toml and
                    Anchor.toml [toolchain]
[PASS]      FV-042: No test is skipped or ignored — zero `.skip(` and zero `#[ignore]` across
                    tests/ and programs/
[N/A]       FV-043: Mutation testing has not been run (no cargo-mutants configuration)
[PARTIAL]   FV-044: No compute-unit or load profiling exists, which is notable because the entire
                    Pinocchio fast path was built for CU reasons
[FAIL-3]    FV-045: Tests use a committed private key.
                    File: package.json (`ANCHOR_WALLET=keys/local/admin-boss….json`), Anchor.toml
                    Impact: the key is permanently public — see F-005
                    Fix: generate the wallet at test time into a gitignored path
[PASS]      FV-046: Tests are deterministic — startSvm() builds a fresh in-process LiteSVM per
                    suite (tests/helpers/svm.ts) with no external state
[PASS]      FV-047: Every CPI result is `?`-propagated; the Pinocchio path maps Pinocchio errors
                    into ProgramError explicitly (ix_p_swap.rs:190, 200, 212, 243)
[PASS]      FV-048: Errors are PoolError codes with short messages — no paths, versions or
                    internals are leaked (error.rs)
[PARTIAL]   FV-049: Panics are reachable and are not converted to typed errors — assert! in
                    concentrated_liquidity.rs:372-373/395-396 (F-008), the unchecked slice in
                    p_helper.rs:127 (F-011), and `.unwrap()` at utils/token.rs:126
[N/A]       FV-050: Not an HTTP surface — no 4xx/5xx distinction applies
[PARTIAL]   FV-051: Compute exhaustion is handled by the runtime; there is no explicit CU budget
                    check, and the refresh_vesting remaining-account loop is bounded only by what
                    the caller is willing to pay for
[N/A]       FV-052: No external network calls to time out
[PASS]      FV-053: Solana transactions are atomic — there is no multi-transaction workflow
                    requiring compensation or rollback
[PASS]      FV-054: No error is silently swallowed. The one `if let Ok(rate_limiter) = ..`
                    (ix_p_swap.rs:134) deliberately skips the single-swap check for pools that do
                    not use the rate-limiter mode, which is the intended semantics
[PASS]      FV-055: 66 specific PoolError variants with #[msg] strings — no generic ProgramError
                    is returned from business logic (error.rs)
[PASS]      FV-056: Every match on BaseFeeMode, CollectFeeMode, SwapMode, TradeDirection,
                    ActivationType, ConfigType and the update-mode enums is exhaustive or carries
                    an explicit error arm (e.g. fee_time_scheduler.rs:117)
[N/A]       FV-057: No external dependency requiring a circuit breaker or fallback
[PARTIAL]   FV-058: Divide-by-zero is blocked everywhere (AR-018) and negative balances are
                    impossible (safe_sub), but three assert!s and one unchecked slice convert an
                    exceptional condition into a panic rather than an error — F-008, F-011
[PASS]      FV-059: An in-process SVM suite exists and loads the real compiled program —
                    litesvm@^0.1.0 with tests/helpers/svm.ts `startSvm()`, preceded by
                    `bun run build-local` in the `test` script
[PARTIAL]   FV-060: Clock-warping helpers exist (warpToTimestamp, warpSlotBy —
                    tests/helpers/svm.ts:122-131) and are used by 5 suites plus the shared
                    common.ts:80 path, but not every time-gated instruction is tested on both
                    sides of its boundary
[PASS]      FV-061: Time is controlled via svm.setClock / svm.warpToSlot
                    (tests/helpers/svm.ts:122-131) — never by wall-clock waiting
[PARTIAL]   FV-062: close_position is exercised by the TS suites, but the three-field post-close
                    assertion (lamports == 0, data.len() == 0, owner == system_program) is not
                    evident in the helpers
[PARTIAL]   FV-063: Re-initialization is structurally prevented by Anchor `init`; no dedicated
                    double-init negative test is identifiable in the suite
[PASS]      FV-064: Authorization negatives are tested — 12 suites assert a specific program error
                    code on a wrong or missing signer via expectThrowsErrorCode
[PASS]      FV-065: Arithmetic edge cases go through the SVM — tests/testMaxFee.test.ts plus the
                    Rust-side test_overflow.rs
[PARTIAL]   FV-066: Token-balance assertions after transfers are present in several suites
                    (tests/helpers/token.ts provides the accessors) but are not uniformly applied
                    on every transfer path
[FAIL-3]    FV-067: CU consumption is not profiled or baselined.
                    File: tests/ (no CU assertion anywhere)
                    Impact: no regression detection for the metric the Pinocchio path exists to
                    optimise — see F-010
                    Fix: assert CU bounds for swap, initialize_pool and close_position
[PASS]      FV-068: Blockhash is advanced between sends — svm.expireBlockhash() in the shared
                    send helper (tests/helpers/svm.ts:75)
[PASS]      FV-069: Failure paths assert rather than unwrap — expectThrowsErrorCode /
                    getCpAmmProgramErrorCode compare the specific error code
[PASS*]     FV-070: PDA derivations live in tests/helpers/accounts.ts and mirror the on-chain
                    seeds; account fixtures (rust-sdk/fixtures/*.bin,
                    programs/cp-amm/src/tests/fixtures/*.bin) are used for layout and quote tests
                    only, not for security assertions
                    *confidence: medium — helper inventory reviewed, not every derivation re-checked
[PARTIAL]   FV-071: The suite uses two appropriate tools (proptest for the math, LiteSVM for the
                    handlers) but no equivalence/invariant prover — no Trident, Crucible, Certora
                    or Kani — which is below the bar for a live high-value AMM's core math
[PARTIAL]   FV-072: The suite pins solana 3.1.10 / LiteSVM 0.1, which predates the transaction-v1
                    gate, and no v1 fixture exists. Exposure is limited because the program itself
                    has no ComputeBudget-dependent logic (AV-089 PASS) and is not a fee sponsor
```

### Out-of-Scope Checklists (scope-gate verdicts, OUTPUT-RULES Rule 0)

```
[N/A — out of scope: --scope program; the only TypeScript in the tree is the LiteSVM test harness]
            TS-001 … TS-064   (Checklist 08, 64 items)
[N/A — out of scope: --scope program; no backend service exists in this repository]
            BE-001 … BE-131   (Checklist 09, 131 items)
[N/A — out of scope: --scope program; no frontend exists in this repository]
            FE-001 … FE-084   (Checklist 10, 84 items)
[N/A — out of scope: --scope program; partially reached via OPS-074/OPS-075 and reported as F-003]
            SC-001 … SC-052   (Checklist 11, 52 items)
[N/A — out of scope: --scope program; partially reached via OPS-027/028/036 and reported as F-005]
            SEC-001 … SEC-053 (Checklist 12, 53 items)
[N/A — out of scope: --scope program; no deployment or infrastructure config in this repository]
            DEP-001 … DEP-089 (Checklist 13, 89 items)
[N/A — out of scope: no Python source in the repository]
            PY-001 … PY-082   (Checklist 14, 82 items)
[N/A — out of scope: no Go/Java/Ruby/PHP source; all Rust and TypeScript have dedicated checklists]
            GL-001 … GL-088   (Checklist 15, 88 items)
[N/A — out of scope: --scope program; on-chain event coverage is assessed under SM-047…SM-050 and
            OPS-043/048-052, and reported as F-006]
            LM-001 … LM-065   (Checklist 17, 65 items)
[N/A — out of scope: --scope program; the program stores no PII — only pubkeys and numeric state]
            PC-001 … PC-060   (Checklist 18, 60 items)
[N/A — out of scope: no .mcp.json, no agent SDK, no LLM dependency anywhere in the tree]
            AI-001 … AI-033   (Checklist 19, 33 items)
[N/A — out of scope: --scope program; rust-sdk/ is an off-chain quoting library excluded by the gate]
            RS-001 … RS-021   (Checklist 20, 21 items)
```

## 6. Known Vector Results (KV-001 … KV-136)

> In-scope vectors were loaded and evaluated individually. Out-of-scope groups render a single
> scope-gate verdict. `[N/A — feature absent: …]` is an evidence-backed verdict (empty grep across
> the in-scope tree) and reopens on demand if a manual read surfaces the feature.

```
[FAIL-3]    KV-001 Private Key Leak: keys/local/admin-bossj3Jvwi….json is a committed 64-byte
                   ed25519 secret, added in a3d3827 and present at HEAD. The pubkey is NOT in
                   admin::ADMINS, so it holds no mainnet authority — see F-005
[PARTIAL]   KV-002 Flash Loan Price Manipulation: no flash-loan facility and no NAV/share pricing
                   to inflate; the only in-transaction price consumer is the market-cap fee
                   scheduler (base_fee/fee_market_cap_scheduler.rs:137-158) — see F-007
[PARTIAL]   KV-003 Reentrancy (CPI): the runtime rejects re-entry into cp-amm and the position
                   RefMut is held across the CPIs, but claim_position_fee resets state after its
                   transfers — see F-012
[FAIL-4]    KV-004 Missing Access Control: every privileged path is gated
                   (access_control.rs:7-24), except under `--features local` where is_admin is a
                   no-op — see F-002
[N/A]       KV-005 Oracle Manipulation: feature absent — zero hits for pyth · switchboard ·
                   oracle · PriceUpdate · get_price across programs/cp-amm/src
[PASS]      KV-006 First Depositor / Share Inflation: no share minting exists; the initial price is
                   an explicit validated parameter, minimum liquidity is enforced, and compounding
                   pools burn DEAD_LIQUIDITY (compounding_liquidity.rs:13, 25-28, 38)
[PARTIAL]   KV-007 MEV Sandwich: slippage is enforced on the net post-transfer-fee output in all
                   three modes; sandwiching itself is inherent to an AMM and is not mitigated
                   beyond user-supplied limits
[FAIL-5]    KV-008 Rug Pull / Admin Backdoor: no fund-draining backdoor exists — admin cannot move
                   value and claim_protocol_fee2 is bounded by protocol_*_fee. The reachable abuse
                   is uncapped, un-timelocked operator fee control — see F-001 (and F-002)
[PASS]      KV-009 Unchecked CPI Target: every CPI program is Program<T>/Interface<TokenInterface>
                   -validated or this program's own ID (ix_swap.rs:185-186, utils/token.rs:167-187)
[PASS]      KV-010 PDA Confusion / Type Cosplay: owner + full 8-byte discriminator checked on every
                   load, including the Pinocchio path (p_helper.rs:69-100)
[PARTIAL]   KV-011 Integer Overflow / Underflow: SafeMath throughout with U256/U512 widening;
                   residuals are one raw `-` (concentrated_liquidity.rs:312), four deliberate
                   wrapping_* and two intentional mod-2^64 checkpoints, all bounded and with
                   overflow-checks = true in release (AR-002, AR-007, AR-015)
[PASS]      KV-012 Arithmetic Rounding Exploit: rounding is consistently pool-favourable (Up on
                   credit, Down on debit) and splits conserve exactly
                   (state/position.rs:631-640)
[PARTIAL]   KV-013 Missing Signer Check: every value-moving instruction has a Signer;
                   refresh_vesting is signer-less but value-neutral and owner-benefiting — AC-002
[PASS]      KV-014 Account Reinitialization: Anchor `init` only; init_if_needed is enabled as a
                   feature but used zero times
[PASS]      KV-015 Unchecked Account Owner: owner verified on every account, manually in the
                   Pinocchio path (p_helper.rs:73-76, 147)
[PASS]      KV-016 Token Account Mismatch: `token::mint` / `token::token_program` constraints,
                   vault-mint binding via p_accessor_mint (ix_swap.rs:166-179), and
                   transfer_checked enforcement on every leg
[PASS]      KV-017 Vault Donation Attack: pricing never reads a vault balance — concentrated pools
                   use sqrt_price/liquidity and compounding pools use tracked reserve fields
                   (state/pool.rs:1273-1289)
[PASS]      KV-018 Fee-on-Transfer Token Exploit: transfer-fee-aware on every leg, including the
                   100 %-fee edge case (utils/token.rs:104-117)
[PARTIAL]   KV-019 Freeze Authority Griefing: reward vaults have the skip_reward escape
                   (ix_claim_reward.rs:81, 113-115); pool-token mint freeze authority is never
                   inspected, so a hostile mint can brick its own pool — AV-065, ECON-047
[UNKNOWN]   KV-020 Program Upgrade Hijack: the upgrade authority cannot be queried offline. The
                   program is upgradeable by construction and a malicious upgrade drains every
                   vault (OPS-011) — the single largest unverified assumption in this audit
[N/A]       KV-021 Governance Attack: feature absent — no realm · proposal · spl-governance ·
                   vote_record · voter_weight
[N/A]       KV-022 Bridge Exploit: feature absent — no guardian · vaa · emitter ·
                   verify_signatures · attestation
[PARTIAL]   KV-023 Token-2022 Transfer Hook Attack: a permissionless mint's hook must have
                   program_id AND authority both None (utils/token.rs:244-256), which correctly
                   excludes active hooks; a badged hook mint would brick its pool rather than be
                   exploitable, because extra accounts are never resolved — EXT-012
[PARTIAL]   KV-024 Stale / Missing Account Close: all closes are Anchor-managed and zero the
                   account; Pool has no close path at all — see F-015
[PASS]      KV-025 Compute Budget Exhaustion DoS: no unbounded loop over attacker-supplied data —
                   the refresh_vesting loop is caller-funded, reward_infos is a fixed [_; 2], and
                   liquidity handlers are boxed (state/pool.rs:1273-1289) rather than stack-heavy
[PASS]      KV-026 PDA Seed Collision: all seeds are fixed-length with no ambiguity. The
                   customizable-pool address is not a *collision* — it is a deliberate global
                   namespace whose squattability is reported separately as F-004
[PASS]      KV-027 Missing Discriminator Check: p_load_mut_checked compares the full 8-byte
                   discriminator (p_helper.rs:82-94); p_load_mut_unchecked is only ever called on
                   the same account after that check has run (ix_p_swap.rs:52 → :78)
[PARTIAL]   KV-028 Front-Running Transaction: pool initialization can be front-run (F-004); swaps
                   are inherently front-runnable with slippage as the mitigation
[PARTIAL]   KV-029 Withdraw-Before-Update Race: state precedes the CPI on every path except
                   claim_position_fee — see F-012
[PASS]      KV-030 Infinite Mint / Uncapped Supply: mint_to is reachable only from
                   create_position_nft, with a constant amount of 1, on a freshly `init`ed mint
                   (ix_create_position.rs:155-166)
[PASS]      KV-101 Sysvar Spoofing & Instructions Introspection: Clock/Rent via syscall only; the
                   Instructions sysvar key is asserted against INSTRUCTIONS_ID before use
                   (ix_p_swap.rs:282-284); introspection is relative to load_current_index()
[N/A]       KV-102 Precompile Signature Bypass: feature absent — no ed25519 · secp256k1 ·
                   precompile signature verification
[PASS]      KV-103 Address Lookup Table Manipulation: no privileged account is bound by
                   transaction position; the introspection loop compares resolved account KEYS
                   (ix_p_swap.rs:330-339), which are materialized in the sysvar regardless of ALT use
[PASS]      KV-104 Non-Canonical Bump / PDA Confusion: canonical bumps only — Anchor `bump` at
                   init and compile-time const_crypto derivations (const_pda.rs); zero uses of
                   create_program_address
[PARTIAL]   KV-105 Token-2022 Extension Abuse: the permissionless allowlist is tight
                   (utils/token.rs:237-260), but a TokenBadge bypasses every extension check with
                   no per-extension policy — AV-064, EXT-013
[PASS]      KV-106 Account Revival / Zombie After Close: Anchor `close` defunds, zeroes and
                   reassigns in-instruction, so a re-funded account fails the discriminator check
[PASS]      KV-107 Fake / Non-Canonical ATA: validate_ata_token re-derives the address with
                   get_associated_token_address_with_program_id and re-checks the authority
                   (utils/token.rs:310-324); pool vaults are PDAs bound by has_one, not assumed ATAs
[PASS]      KV-108 Token Decimals & Cross-Mint Confusion: decimals always read from the mint
                   (token_mint.decimals, p_accessor_decimals); token A and token B amounts are
                   never added or compared to each other
[FAIL-2]    KV-109 Pinocchio Missing Manual Validation: owner, discriminator, signer, writability,
                   mint binding, token-program identity and account count are ALL re-implemented
                   manually (ix_swap.rs:100-200). The single gap is an unchecked byte-slice read —
                   see F-011
[N/A]       KV-118 Stake Account Authority Hijack: feature absent — no stake · StakeProgram ·
                   authorized · staker · withdrawer
[PARTIAL]   KV-119 Durable-Nonce Pre-Signed Governance Abuse: privileged instructions carry no
                   nonce, epoch or version guard and no timelock, so a pre-signed privileged
                   transaction remains executable — OPS-077. Blast radius is bounded by the
                   operator surface (F-001, F-014)
[N/A]       KV-120 On-Chain Randomness Predictability: feature absent — no random · vrf ·
                   slot_hashes · blockhash-derived entropy
[N/A]       KV-121 cNFT / Account-Compression Merkle Proof Abuse: feature absent — no
                   spl-account-compression · bubblegum · merkle · proof
[PASS]      KV-122 Inner-Instruction / Event-Log Spoofing: events are emitted by a self-CPI whose
                   event authority is verified in the entrypoint (entrypoint.rs:10-25), so an
                   outside program cannot forge a cp-amm event. Caveat: claim_protocol_fee2 uses
                   plain emit! and is truncation-prone by the code's own admission (SM-049)
[PASS]      KV-123 Lamport-Donation Account Bricking: no instruction assumes an exact lamport
                   balance (the one comparison uses `>` and tops up, utils/token.rs:299-304), and
                   no builtin/sysvar account is marked mut
[N/A]       KV-125 Bonding-Curve Launchpad Graduation Abuse: feature absent — no bonding_curve ·
                   graduate · virtual_reserves · migrate
[FAIL-3]    KV-127 ATA / Account Pre-Creation DoS: the program never creates ATAs, but the
                   customizable-pool PDA is user-derivable and permanently pre-creatable —
                   see F-004
[PASS]      KV-128 On-Chain Floating-Point Math: zero f32/f64/powf/sqrt-on-float occurrences;
                   all value math is fixed-point integer with checked ops
[N/A]       KV-129 Keeper Request→Execute Front-Running: feature absent — no two-step keeper or
                   crank settlement. refresh_vesting is a permissionless crank but is idempotent
                   and value-neutral
[PARTIAL]   KV-130 CLMM/DLMM Tick-Boundary & Liquidity Math: there are no ticks (a single global
                   price range per pool), bounds are enforced on every swap path
                   (concentrated_liquidity.rs:71-74, 95-97, 197-199, 218-220), and fee growth uses
                   Q128 U256 accumulators. Residuals: the unchecked `upper - lower` at :312 and
                   the assert! panics at :372-373/395-396 (F-008)
[PARTIAL]   KV-131 Write-Lock Account Contention DoS: every swap write-locks its own pool account,
                   serialising that pool within a slot. This is inherent to the design and was an
                   explicit goal — the README calls out "each pool includes a set of unique
                   accounts for swap instruction (no shared accounts between 2 pools)" as the fix
                   for dynamic-amm v1's hot-account problem. There is no single global hot PDA
[N/A]       KV-134 Token ACL (SRFC-37) Gate-Program Bypass: feature absent — no token_acl ·
                   TACLkU6 · MINT_CFG · gating_program · thaw_permissionless
[PASS]      KV-135 Transaction v1 Fee-Sponsor Cap / Disabled ComputeBudget Gates: no require! or
                   branch reads ComputeBudget instructions from the sysvar (AV-089); the
                   introspection loop is key-based and tolerates no-op budget instructions; the
                   program is not a fee sponsor or paymaster. Test-side readiness gap at FV-072
```

```
[N/A — out of scope: --scope program; no backend surface in this repository]
            KV-031 … KV-055   (25 vectors)
[N/A — out of scope: --scope program; no frontend surface in this repository]
            KV-056 … KV-075   (20 vectors)
[N/A — out of scope: --scope program; checklists 11-13 are outside the gate. The two devops
            vectors that touch this program's surface were evaluated under checklist 07 instead:
            KV-078/KV-091 map to OPS-036 (F-005) and OPS-001/OPS-011 (KV-020)]
            KV-076 … KV-100   (25 vectors)
[N/A — out of scope: no AI/agent surface (no .mcp.json, no agent SDK, no LLM dependency) and
            rust-sdk/ off-chain Rust is excluded by --scope program]
            KV-110 … KV-117   (8 vectors)
[N/A — out of scope: wallet-custody surface — this program never holds or exports user key
            material]
            KV-124, KV-126    (2 vectors)
[N/A — out of scope: off-chain token-registry and risk-scoring surfaces — the program resolves no
            token list and consumes no third-party risk signal]
            KV-132, KV-133    (2 vectors)
[N/A — out of scope: off-chain RPC reader / indexer surface — no getTransaction, getBlock,
            blockSubscribe or Geyser consumer in this repository]
            KV-136            (1 vector)
```

---

### Audit Metrics

| Metric | Value |
|--------|-------|
| Total items evaluated (in scope) | 591 |
| PASS | 299 (50.6 %) |
| FAIL | 30 (5.1 %) |
| PARTIAL | 89 (15.1 %) |
| N/A | 150 (25.4 %) |
| UNKNOWN (not observable offline, Rule 10) | 23 (3.9 %) |
| **Pass rate** (excl. N/A and UNKNOWN) | **67.8 %** |
| **Highest severity found** | **5** |
| **Repository Risk Score** | **5** — 🟡 MEDIUM |

> Risk score derivation (OUTPUT-RULES Rule 1): no finding ≥ 9, none ≥ 7, highest finding = 5
> ⟹ REPO SCORE = max(finding) = 5 (MEDIUM — fix soon). The intake's Q10 double-weighting lever for
> a >$1M protocol was considered and does not move the score, because it amplifies *critical*
> findings and none exist. The Q8 mainnet-live +1 lever was applied when scoring F-001 (it is a
> fund-adjacent finding on a live protocol) and is already reflected in the 5.

### Known Vector Metrics

| Metric | Value |
|--------|-------|
| Total known vectors | 136 |
| In scope | 53 |
| Out of scope (scope gate) | 83 |
| PASS | 22 |
| FAIL | 6 |
| PARTIAL | 14 |
| N/A (feature provably absent) | 10 |
| UNKNOWN (not observable offline) | 1 |
| Completion (in-scope) | 100 % (53 / 53) |

### Per-Checklist Summary

| # | Checklist | Items | Pass | Fail | Partial | N/A | Unknown | Pass Rate |
|---|-----------|-------|------|------|---------|-----|---------|-----------|
| 01 | Account Validation | 90 | 64 | 2 | 11 | 13 | 0 | 83.1 % |
| 02 | Access Control | 50 | 34 | 3 | 9 | 4 | 0 | 73.9 % |
| 03 | Arithmetic Safety | 63 | 42 | 1 | 5 | 15 | 0 | 87.5 % |
| 04 | CPI & PDA | 70 | 41 | 0 | 6 | 23 | 0 | 87.2 % |
| 05 | State Machine | 72 | 44 | 2 | 6 | 20 | 0 | 84.6 % |
| 06 | Economic & Logic | 89 | 33 | 6 | 10 | 40 | 0 | 67.3 % |
| 07 | OpSec & Governance | 85 | 14 | 9 | 16 | 23 | 23 | 35.9 % |
| 16 | Formal Verification & Testing | 72 | 27 | 7 | 26 | 12 | 0 | 45.0 % |
| | **Total** | **591** | **299** | **30** | **89** | **150** | **23** | **67.8 %** |

> Checklist 07's low pass rate is dominated by its 23 `[UNKNOWN]` items — upgrade authority,
> multisig configuration and key custody — which a static offline review cannot answer either way.
> Excluding those, checklist 07 stands at 14 PASS / 9 FAIL / 16 PARTIAL.

---

## 7. Instruction Matrix & State Model

> One row per entry point in `#[program] mod cp_amm` (`programs/cp-amm/src/lib.rs:65-347`).
> "Signer / role" is the authority the program actually enforces, verified in code — not what the
> README claims. 38 entry points, all reviewed.

| # | Instruction | File | Signer / role enforced | CPI calls | PDA seeds signed | Checked math | State changes | Findings |
|---|---|---|---|---|---|---|---|---|
| 1 | `create_operator_account` | `admin/ix_create_operator_account.rs` | admin allowlist (`is_admin`) | System (init) | — | `bitmask_max` bound | creates `Operator` | F-002, F-006 |
| 2 | `close_operator_account` | `admin/ix_close_operator_account.rs` | admin allowlist | — | — | — | closes `Operator` | F-006 |
| 3 | `create_config` | `operator/ix_create_static_config.rs` | operator `CreateConfigKey` | System (init) | — | all validated | creates `Config` (static) | — |
| 4 | `create_dynamic_config` | `operator/ix_create_dynamic_config.rs` | operator `CreateConfigKey` | System (init) | — | — | creates `Config` (dynamic) | — |
| 5 | `create_token_badge` | `operator/ix_create_token_badge.rs` | operator `CreateTokenBadge` | System (init) | — | — | creates `TokenBadge` | EXT-013 |
| 6 | `close_config` | `operator/ix_close_config.rs` | operator `RemoveConfigKey` | — | — | — | closes `Config` | — |
| 7 | `fix_pool_fee_params` | `operator/ix_fix_pool_fee_params.rs` | operator `UpdatePoolFees` | — | — | all validated | rewrites `pool.pool_fees.base_fee` | F-006 |
| 8 | `fix_config_fee_params` | `operator/ix_fix_config_fee_params.rs` | operator `UpdatePoolFees` | — | — | all validated | rewrites `config.pool_fees.base_fee` | F-006 |
| 9 | `initialize_reward` | `operator/ix_initialize_reward.rs` | `pool.creator` (index 0 only) **or** operator `InitializeReward` | System + Token (vault init) | — | duration bounds | inits `pool.reward_infos[i]`, creates reward vault | AC-012 |
| 10 | `fund_reward` | `ix_fund_reward.rs` | `reward_info.funder` | `transfer_checked` (user→vault) | — | all checked | `reward_rate`, `reward_duration_end` | — |
| 11 | `withdraw_ineligible_reward` | `ix_withdraw_ineligible_reward.rs` | `reward_info.funder` | `transfer_checked` (vault→funder) | `pool_authority` | `safe_mul_shr_cast` | zeroes `cumulative_seconds_with_empty_liquidity_reward` | — |
| 12 | `withdraw_dead_liquidity_reward` | `ix_withdraw_dead_liquidity_reward.rs` | `reward_info.funder` (Compounding pools only) | `transfer_checked` | `pool_authority` | mod-2^64 checkpoint (AR-015) | advances `dead_liquidity_reward_checkpoint` | — |
| 13 | `update_reward_funder` | `operator/ix_update_reward_funder.rs` | `pool.creator` (index 0) **or** operator `UpdateRewardFunder` | — | — | — | `reward_info.funder` | AC-012 |
| 14 | `update_reward_duration` | `operator/ix_update_reward_duration.rs` | `pool.creator` (index 0) **or** operator `UpdateRewardDuration` | — | — | duration bounds | `reward_info.reward_duration` | AC-012 |
| 15 | `set_pool_status` | `operator/ix_set_pool_status.rs` | operator `SetPoolStatus` | — | — | — | `pool.pool_status` | F-014 |
| 16 | `claim_protocol_fee2` | `operator/ix_claim_protocol_fee2.rs` | `const_pda::protocol_fee_authority::ID` (external program PDA) | `transfer_checked` (vault→receiver) | `pool_authority` | `safe_sub`, `min` | zeroes `protocol_a/b_fee`, settles dead-liquidity fee | SM-049 |
| 17 | `close_token_badge` | `operator/ix_close_token_badge.rs` | operator `CloseTokenBadge` | — | — | — | closes `TokenBadge` | F-006 |
| 18 | `update_pool_fees` | `operator/ix_update_pool_fees.rs` | operator `UpdatePoolFees` | — | — | **base capped, dynamic not** | `pool.pool_fees` (base / dynamic / compounding) | **F-001** |
| 19 | `initialize_pool` | `initialize_pool/ix_initialize_pool.rs` | permissionless, or `config.pool_creator_authority` if set | System, Token/Token-2022 (init + 2 transfers), metadata init, `mint_to` | `pool_authority` | all checked | creates `Pool`, 2 vaults, `Position`, NFT mint + account | — |
| 20 | `initialize_pool_with_dynamic_config` | `initialize_pool/ix_initialize_pool_with_dynamic_config.rs` | `config.pool_creator_authority` (`has_one` + `Signer`) | same as 19 | `pool_authority` | all checked | same as 19 | — |
| 21 | `initialize_customizable_pool` | `initialize_pool/ix_initialize_customizable_pool.rs` | permissionless | same as 19 | `pool_authority` | all checked | same as 19 | **F-004**, ECON-082 |
| 22 | `create_position` | `ix_create_position.rs` | permissionless (payer); NFT minted to `owner` | System, Token-2022 metadata + `mint_to` | `pool_authority` | — | creates `Position`, NFT mint + account | AC-045 |
| 23 | `add_liquidity` | `ix_add_liquidity.rs` | NFT owner **or** delegate with `AddLiquidity` | 2 × `transfer_checked` (user→vault) | — | all checked, round **Up** | `pool.liquidity`, reserves, `position.unlocked_liquidity`, fee checkpoints | — |
| 24 | `remove_liquidity` | `ix_remove_liquidity.rs` | NFT owner **or** delegate (`RemoveLiquidity` / `…ToOwner` + ATA check) | 2 × `transfer_checked` (vault→user) | `pool_authority` | all checked, round **Down** | `pool.liquidity`, reserves, `position.unlocked_liquidity` | — |
| 25 | `remove_all_liquidity` | `ix_remove_liquidity.rs` (`liquidity_delta = None`) | same as 24 | same as 24 | `pool_authority` | same as 24 | same as 24; can drive `pool.liquidity` to 0 | F-008 |
| 26 | `close_position` | `ix_close_position.rs` | NFT owner (`token::authority = owner`) | Token-2022 `burn`, 2 × `close_account` | `pool_authority` | — | closes `Position`, burns NFT, closes mint | — |
| 27 | `swap` | `swap/ix_p_swap.rs` (Pinocchio) | permissionless `payer` (`is_signer` asserted) | 2–3 × `transfer_checked`, event self-CPI | `pool_authority`, `__event_authority` | all checked | `sqrt_price`, reserves, `protocol_*_fee`, `fee_*_per_liquidity`, volatility | F-007, F-009, F-011, F-013 |
| 28 | `swap2` | `swap/ix_p_swap.rs` (Pinocchio) | same as 27 (adds `SwapMode`) | same as 27 | same as 27 | all checked | same as 27 | same as 27 |
| 29 | `claim_position_fee` | `ix_claim_position_fee.rs` | NFT owner **or** delegate (`ClaimPositionFee` / `…ToOwner` + ATA check) | 2 × `transfer_checked` (vault→user) | `pool_authority` | all checked | `position.fee_a/b_pending → 0`, metrics | **F-012** |
| 30 | `lock_position` | `ix_lock_position.rs` | NFT owner **or** delegate with `LockPosition` | System (init `Vesting`) | — | all checked | creates `Vesting`, moves unlocked→vested | — |
| 31 | `lock_inner_position` | `ix_lock_inner_position.rs` | NFT owner **or** delegate with `LockPosition` | — | — | all checked | sets `position.inner_vesting`, moves unlocked→vested | — |
| 32 | `refresh_vesting` | `ix_refresh_vesting.rs` | **none** — permissionless crank | — | — | all checked | releases vested→unlocked; closes finished `Vesting` | AC-002 |
| 33 | `permanent_lock_position` | `ix_permanent_lock_position.rs` | NFT owner **or** delegate with `LockPosition` | — | — | `safe_add` | `position.permanent_locked_liquidity`, `pool.permanent_lock_liquidity` | — |
| 34 | `claim_reward` | `ix_claim_reward.rs` | NFT owner **or** delegate (`ClaimReward` / `…ToOwner` + ATA check) | `transfer_checked` (reward vault→user) | `pool_authority` | all checked | `reward_pendings → 0`, `total_claimed_rewards` | — |
| 35 | `split_position` | `ix_split_position.rs` → `handle_split_position2` | **both** NFT owners sign | — | — | all checked, round Down, conserving | moves liquidity/fees/rewards/vesting between two positions | — |
| 36 | `split_position2` | `ix_split_position2.rs` | **both** NFT owners sign | — | — | same as 35 | same as 35 (uniform numerator) | — |
| 37 | `fix_pool_layout_version` | `operator/ix_fix_pool_layout_version.rs` | operator `FixPool` | — | — | derived from price math | `pool.token_a/b_amount`, `layout_version` | F-006 |
| 38 | `update_delegate_permission` | `ix_update_delegate_permission.rs` | NFT owner (`token::authority = owner`) | — | — | `bitmask_max` bound | `position.delegate_permission` | — |

### PDA inventory

| PDA | Seeds | Derivation | Signs CPIs? |
|---|---|---|---|
| `pool_authority` | `[b"pool_authority"]` | compile-time `const_crypto::ed25519::derive_program_address` (`const_pda.rs:13-23`) | **yes** — every vault outflow |
| `__event_authority` | `[b"__event_authority"]` | compile-time (`const_pda.rs:4-11`) | yes — event self-CPI |
| `Pool` (config-based) | `[b"pool", config, max(mintA,mintB), min(mintA,mintB)]` | Anchor canonical bump | no |
| `Pool` (customizable) | `[b"cpool", max(mintA,mintB), min(mintA,mintB)]` | Anchor canonical bump | no — **F-004** |
| token vault | `[b"token_vault", mint, pool]` | Anchor canonical bump | no |
| `Position` | `[b"position", position_nft_mint]` | Anchor canonical bump | no |
| position NFT account | `[b"position_nft_account", position_nft_mint]` | Anchor canonical bump | no |
| `Config` | `[b"config", index.to_le_bytes()]` | Anchor canonical bump | no |
| `TokenBadge` | `[b"token_badge", token_mint]` | Anchor canonical bump | no |
| `Operator` | `[b"operator", whitelisted_address]` | Anchor canonical bump | no |
| reward vault | `[b"reward_vault", pool, reward_index.to_le_bytes()]` | Anchor canonical bump | no |
| `Vesting` | *(none — a caller-supplied keypair account, bound by `vesting.position`)* | n/a | no |
| `protocol_fee_authority` | `[b"protocol_fee_authority"]` under the **external** `pFee3tb7…` program | compile-time (`const_pda.rs:25-35`) | n/a — checked as a signer |

---

## 8. State Model Verification — Trust Model, Invariants & Assumptions

### Account Types

| Account | Discriminator | Space (`INIT_SPACE`) | Owner | Close target |
|---|---|---|---|---|
| `Pool` | ✅ Anchor 8-byte, `const_assert_eq!(1104)` | 1,104 (+8) | cp-amm | **none** — no close path (F-015) |
| `Position` | ✅ `const_assert_eq!(400)` | 400 (+8) | cp-amm | `rent_receiver`, unconstrained (AV-025) |
| `Config` | ✅ `const_assert_eq!(320)` | 320 (+8) | cp-amm | `rent_receiver`, unconstrained |
| `Operator` | ✅ `const_assert_eq!(64)` | 64 (+8) | cp-amm | `rent_receiver`, unconstrained |
| `TokenBadge` | ✅ `const_assert_eq!(160)` | 160 (+8) | cp-amm | `rent_receiver`, unconstrained |
| `Vesting` | ✅ `const_assert_eq!(176)` | 176 (+8) | cp-amm | position owner (auto-close on completion) |
| token vault / reward vault | n/a (SPL) | 165 | Token or Token-2022 | never closed |
| position NFT mint / account | n/a (SPL) | variable | Token-2022 | closed on `close_position` |

### State Machine Transitions

```
POOL LIFECYCLE
  (none) --initialize_pool / _with_dynamic_config / _customizable--> Enable
  Enable <--set_pool_status(Disable/Enable)--> Disable
  Enable | Disable ---> (no terminal state; no close_pool instruction)          [F-015]

  While Disable:  swap ✗   add_liquidity ✗   create_position ✗   lock ✗   split ✗
                  remove_liquidity ✓   claim_position_fee ✓   claim_reward ✓   close_position ✓
                  (can_remove_liquidity ignores is_enabled — deliberate emergency exit)

  LayoutVersion:  V0 --update_layout_version_if_needed (any mutating ix) --> V1   [one-way]

POSITION LIFECYCLE
  (none) --create_position / pool init--> Open(liquidity ≥ 0)
  Open --add_liquidity--> Open            Open --remove_liquidity--> Open
  Open --lock_position--> Open + external Vesting account(s)
  Open --lock_inner_position--> Open + inner_vesting (at most one)
  Open --permanent_lock_position--> Open (permanent_locked_liquidity ↑, absorbing)
  Open --split_position(2)--> Open + Open'  (both owners sign)
  Open(empty) --close_position--> Closed [terminal: NFT burned, mint closed, rent returned]

  is_empty() requires: both reward_pendings == 0 AND total_liquidity == 0
                       AND fee_a_pending == 0 AND fee_b_pending == 0   (position.rs:356-365)

VESTING LIFECYCLE
  initialize --> accruing --refresh_vesting / any owner action--> released
  released (done()) --> auto-close (external Vesting) or reset to default (inner_vesting)

REWARD LIFECYCLE
  Uninitialized --initialize_reward--> Initialized (rate 0)
  Initialized --fund_reward--> Active (reward_duration_end = now + duration)
  Active --(time passes)--> Ended --update_reward_duration--> Ended(new duration)
  Ended --withdraw_ineligible_reward--> banked empty-liquidity seconds returned to funder
  Initialized is absorbing — a reward can never return to Uninitialized (pool.rs:263-267)
```

### Invariants Verified

| Property | Description | Status | Evidence |
|---|---|---|---|
| INV-01 | `Σ(position.unlocked + vested + permanent_locked) + DEAD_LIQUIDITY(compounding) == pool.liquidity` | ✅ PASS | `apply_add_liquidity`/`apply_remove_liquidity` (pool.rs:888-928); split is position-to-position only; verified across all 38 entry points |
| INV-02 | `pool.sqrt_min_price <= pool.sqrt_price <= pool.sqrt_max_price` after every swap | ✅ PASS | `PriceRangeViolation` guards at concentrated_liquidity.rs:71-74, 95-97, 197-199, 218-220; partial-fill clamps at :124-135, :164-175 |
| INV-03 | Tracked reserves ≥ true reserves (`token_a/b_amount` vs price-derived) | ✅ PASS | credits round `Up` (ix_add_liquidity.rs:110, `get_initial_pool_information`), debits round `Down` (ix_remove_liquidity.rs:134); proptested in test_modify_liquidity.rs, test_integration.rs |
| INV-04 | Reward accumulator is current before `pool.liquidity` (its denominator) changes | ✅ PASS | `pool.update_rewards` precedes every mutation — ix_add_liquidity.rs:106→117, ix_remove_liquidity.rs:130→168, ix_split_position2.rs:169→174, ix_fund_reward.rs:80→113 |
| INV-05 | Fee split conserves: `claiming + compounding + protocol + referral == fee_amount` | ✅ PASS | `split_fees` (state/fee.rs:240-283) — each component is derived by subtraction from the previous |
| INV-06 | Position fee/reward checkpoints are non-decreasing and same-scale as the pool accumulators | ✅ PASS | U256 at `LIQUIDITY_SCALE` (fees) and `TOTAL_REWARD_SCALE` (rewards); `safe_sub` on the delta would error on a decrease (position.rs:256, 264, 70) |
| INV-07 | Every vault outflow is bounded by a state field | ✅ PASS | ECON-033 — six outflow paths enumerated, each amount-bounded |
| INV-08 | Only the position-NFT holder (or an explicitly-delegated key) can move a position's value | ✅ PASS | `amount == 1` + `assert_authority` / `assert_authority_with_owner_destinations` on all six position paths (position.rs:546-614) |
| INV-09 | Effective swap fee ≤ the pool's configured maximum | ❌ **FAIL** | the *enforced* maximum is the 99 % version ceiling, not the 10 % post-update cap the code intends — **F-001** (state/pool.rs:1222-1252) |
| INV-10 | Dead-liquidity fee/reward checkpoint delta < 2^64 (justifying the `as u64` + `wrapping_sub`) | ✅ PASS | the pending delta is physically held in a vault whose balance is a `u64`; argued in-code at pool.rs:1091-1094 and independently re-derived during this review |

### Trust Model & Actors

| Actor | Gated by | Trusted to | Trusted **NOT** to | Verified in code |
|---|---|---|---|---|
| **Upgrade authority** | out-of-band — **not observable offline** | upgrade the program | push a malicious upgrade | `[UNKNOWN]` OPS-001 · a malicious upgrade drains every vault (OPS-011) |
| **Admin** (2 keys) | `admin::ADMINS` allowlist | create/close `Operator` accounts | mint itself arbitrary permissions | `auth.rs:7-10`, `access_control.rs:7-10` — **broken under `--features local`** (F-002) |
| **Operator** | `Operator` PDA + `u128` bitmask | configs, badges, pause, fee params, reward config, layout fix | set abusive fee parameters | `access_control.rs:12-24` — **fee bound incomplete** (F-001) |
| **Protocol-fee authority** | external `pFee3tb7…` program PDA | sweep accrued protocol fees | sweep more than accrued | `ix_claim_protocol_fee2.rs:41-42`, bounded by `protocol_*_fee` — ✅ |
| **Pool creator** | permissionless (static config) or `config.pool_creator_authority` | create pools; configure reward index 0 | set fee params outside validated bounds | `ix_initialize_pool.rs:226-230`, `pool.rs:1166-1168` — ✅ (bounds are the control, not honesty) |
| **Reward funder** | `reward_info.funder` | fund rewards; reclaim ineligible/dead-liquidity rewards | withhold funding (griefing only) | `ix_fund_reward.rs:45-48` — ✅ |
| **Alpha Vault** | address derived from `config.vault_config_key` (or the payer, for customizable pools) | buy before `activation_point` | — (capability is the design) | `permissionless.rs:50-60`, `utils/alpha_vault.rs:11-17` — ✅ |
| **Position owner** | holds the NFT (`amount == 1`) | full control of own position | — (untrusted) | `position.rs:546-564` — ✅ |
| **Position delegate** | SPL `Approve` with `delegated_amount == 0` + `position.delegate_permission` bitmask | only the delegated actions | exceed the bitmask | `position.rs:566-614` — ✅ (the `ToOwner` variants additionally force ATA destinations) |
| **Swapper** | anyone | call `swap` / `swap2` | — (untrusted — the attacker) | `ix_swap.rs:100-200` — ✅ |

### Assumptions & Simplifications

Carried from `audit_2/intake.md` §8, where every QUESTIONS.md default applied non-interactively is recorded. Each is a stated assumption, so "no finding here" reads against the assumption rather than as a blanket clearance.

1. **Upgrade authority is unverified.** No network access, so `solana program show` could not be run. The audit assumes the program is upgradeable with a non-immutable authority. If that authority is a single hot wallet, it supersedes every finding in this report in severity.
2. **Deployment is mainnet-live** (read from `README.md`), and **TVL is unknown**, calibrated as `>$1M`. Both levers were applied when scoring and are cited where they moved a number.
3. **The prior audit was not read.** `README.md` links a published report at `docs.meteora.ag`; it could not be retrieved. This review therefore proceeds as a first audit and assumes nothing about previously-fixed issues (intake Q25).
4. **The deployed binary was not compared to this source.** OPS-026/OPS-070 are `[UNKNOWN]`; findings describe the source at `a85c926`.
5. **The external `protocol_fee` program (`pFee3tb7qh5z53jRF4PbLwmNd148Q8ypLNZbqsMeinA`) was not audited.** `claim_protocol_fee2` trusts it to validate `receiver_token_account` (stated in the code comment at `ix_claim_protocol_fee2.rs:13`). Its correctness is an external dependency.
6. **The Alpha Vault program (`vaU6kP7iNEGkbmPkLmZfGwiGxd4Mob24QQCie5R9kd2`) was not audited.** cp-amm only derives and compares its address; it never CPIs into it.
7. **TypeScript integration tests were inventoried and sampled, not audited line by line.** Checklist-16 verdicts about the suite's *content* (FV-060, FV-062, FV-063, FV-066) are marked `[PARTIAL]` rather than `[PASS]` precisely because per-assertion review was outside the engagement budget.
8. **Legacy on-chain state was not sampled.** Pools created before the `LayoutVersion::V1` migration and pools using the deprecated `BaseFeeMode::RateLimiter` exist by the code's own admission but could not be enumerated offline; the migration and rate-limiter paths were reviewed statically only.
9. **Operator and admin key custody is assumed sound.** Findings F-001, F-002 and F-014 all become materially more severe if an operator or admin key is compromised — that is the scenario their remediations are for.
10. **No code was built, executed or fuzzed.** Every verdict is derived from reading the source at the pinned commit. Where a claim could not be established from the code, the item is `[UNKNOWN]` or `[PARTIAL]`, never `[PASS]`.

---

## 9. Code Maturity Scorecard

> Engineering-quality gate (Phase 4.5), orthogonal to the risk score in §1. Scale: 0 absent ·
> 1 ad-hoc · 2 partial · 3 good · 4 strong. Scored weakest-link within each category.

| # | Category | Score (0-4) | Evidence (file:line / artifact) | Gap to next level |
|---|----------|:-----------:|---------------------------------|-------------------|
| 1 | Access Controls | **3** | Every one of the 38 entry points is gated and was traced: admin allowlist (`auth.rs:7-10`), operator `u128` bitmask (`access_control.rs:12-24`), position-NFT ownership with a separate delegate bitmask and forced-ATA destinations (`position.rs:546-614`), external-PDA protocol-fee authority (`ix_claim_protocol_fee2.rs:41-42`) | Remove the `--features local` god mode (F-002); add two-step admin rotation and a timelock on operator grants (OPS-078) |
| 2 | Arithmetic | **3** | `SafeMath` on every value path with `u128`/`U256`/`U512` widening (`utils_math.rs`, `u128x128_math.rs`); `overflow-checks = true` in `[profile.release]`; multiply-before-divide throughout; pool-favourable rounding both directions | One raw `-` (`concentrated_liquidity.rs:312`), four `wrapping_*`, and three `assert!` panics (F-008) keep this off 4 |
| 3 | Account & Type Safety | **3** | Typed loaders everywhere; canonical bumps only (zero `create_program_address`); 12 `const_assert_eq!` layout locks; the Pinocchio path re-implements owner + full 8-byte discriminator + writability + signer + mint binding by hand (`ix_swap.rs:100-200`, `p_helper.rs:69-100`) | One unchecked byte-slice read (`p_helper.rs:127`, F-011) and the seed gap at `ix_initialize_customizable_pool.rs:161-172` (F-004) |
| 4 | Input Validation | **3** | Bounds on fee schedulers (`fee_time_scheduler.rs:139-162`, `fee_market_cap_scheduler.rs:166-204`, `fee_rate_limiter.rs:361-423`), vesting (`ix_lock_position.rs:37-69`), reward duration, price range, split numerators, permission bitmasks; slippage on every value-moving path | Fee components are validated individually, never as a sum (F-001, OPS-082/083) |
| 5 | Testing | **3** | 31 LiteSVM/mocha integration suites + 20 Rust modules (2,445 LOC); 12 suites assert specific error codes on negative paths; clock control via `setClock`/`warpToSlot`; `expireBlockhash` between sends; CI runs all three suites on every PR with pinned toolchain versions | No coverage measurement (F-010/FV-033); three instructions have no dedicated suite (FV-035); post-close three-field assertions absent (FV-062) |
| 6 | Fuzzing & Property Tests | **2** | `proptest!` in 8 modules covering swap math, liquidity modification, compounding, rewards, fee schedulers, overflow and inner-vesting splits; serialization round-trip proptested (`test_base_fee_serde.rs`) | No instruction-level fuzzing (Trident/cargo-fuzz), no equivalence prover for a live high-value AMM's math (FV-071), and counterexample seeds are gitignored (FV-027) |
| 7 | Error Handling & DoS Resilience | **2** | 66 typed `PoolError` variants; every CPI result propagated; no empty catch-equivalent; no unbounded loop over attacker-supplied data; compute-conscious Pinocchio fast path | Reachable panics — three `assert!`s (F-008), one unchecked slice (F-011), one production `.unwrap()` (`utils/token.rs:126`) — and no CU regression baseline (FV-067) |
| 8 | Upgradeability & Governance | **1** | A per-pool pause exists (`set_pool_status`) and withdrawals are deliberately exempt from it; the protocol-fee destination is immutable | **No on-chain timelock on anything** (OPS-055); no admin rotation handshake (OPS-078); no protocol-wide pause (F-014); upgrade authority unverifiable (OPS-001); the `local` feature can disable the admin gate entirely (F-002) |
| 9 | Monitoring & Incident Response | **1** | 22 well-structured events covering every user-facing path, emitted via tamper-resistant `emit_cpi!` self-CPI with a verified event authority | **The six most privileged instructions emit nothing** (F-006); `claim_protocol_fee2` uses truncation-prone `emit!`; no SECURITY.md, runbook, bug-bounty reference or security contact in-repo (OPS-044/046/047) |
| | **Weighted Maturity** | | **2.3 / 4.0** | |

**Reading the scorecard.** The distribution is the story: categories 1–5 sit at 3 (good), and the two categories at 1 are both *operational*, not code-quality. This is a program whose protocol logic has clearly been through serious review and whose governance and observability layers have not caught up. Per Phase 4.5, categories scoring ≤ 1 are prioritised in the roadmap below regardless of the individual finding severities attached to them — which is why F-006 (severity 3) and F-014 (severity 2) appear above several higher-scored items.

---

## 10. Remediation Roadmap

### Immediate — Severity 9-10 (Block Deploy)

*None.* No finding in this audit warrants blocking a deploy or halting the live program.

### Before Release — Severity 7-8

*None.*

### Within 2 Weeks — Severity 5-6

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-001 | 5 | Assert the combined worst-case fee (`max_base + max_dynamic`) against `MAX_FEE_NUMERATOR_POST_UPDATE` at the end of `validate_and_update_pool_fees`; add a `get_max_variable_fee()` helper on `DynamicFeeStruct`. Add a regression test that a max-`U24` dynamic-fee update is rejected | 0.5–1 day + test | Program team |

### Next Sprint — Severity 3-4

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| **Maturity #8** (Governance = 1) | — | **Prioritised by Phase 4.5 regardless of finding severity.** Introduce an on-chain timelock for `update_pool_fees`, `fix_pool_fee_params`, `fix_config_fee_params` and `create_operator_account` (propose → wait → execute), plus two-step admin rotation (OPS-078) | 1–2 weeks | Program team |
| **Maturity #9** (Monitoring = 1) | — | **Prioritised by Phase 4.5.** Ship F-006's events, convert `claim_protocol_fee2` to `emit_cpi!`, and add SECURITY.md with a disclosure contact | 2–3 days | Program + security |
| F-002 | 4 | `compile_error!` when `local` is compiled for a deployable target, or widen the allowlist instead of bypassing it | 1 hour | Program team |
| F-003 | 4 | Pin every GitHub Action to a 40-char commit SHA; add `permissions: contents: read`; checksum the Solana installer; pin `anchor-*` with `=1.0.2` | 2–4 hours | DevOps |
| F-004 | 3 | Add `creator.key()` to the customizable-pool seeds (layout-breaking — schedule with a migration), or raise the minimum initial liquidity to an economically meaningful notional | 1 day + migration plan | Program team |
| F-005 | 3 | Treat `bossj3Jvwi…` as permanently compromised and stop using it; delete `keys/`, generate the test wallet at runtime, add `keys/` to `.gitignore`, enable secret scanning with push protection | 2 hours | DevOps |
| F-006 | 3 | Add `EvtCreateOperatorAccount`, `EvtCloseOperatorAccount`, `EvtFixPoolFeeParams`, `EvtFixConfigFeeParams`, `EvtFixPoolLayoutVersion`, `EvtCloseTokenBadge`; add `#[event_cpi]` to `FixPoolLayoutVersionCtx` | 3–4 hours | Program team |
| F-007 | 3 | Ratchet `period` to its historical maximum (one `u16` field), or feed the scheduler a TWAP instead of spot `sqrt_price`; at minimum document the spot dependency for integrators | 1–2 days | Program team |
| F-008 | 3 | Replace the three `assert!`s in `concentrated_liquidity.rs` with `require!` + `PoolError`; convert `utils/token.rs:126`'s `.unwrap()` to `.ok_or(...)?` | 1 hour | Program team |
| F-009 | 3 | Make `swap`/`swap2` Anchor fallbacks `err!(...)` and add a `compile_error!` guard against `no-custom-entrypoint` on a deployable target | 1 hour | Program team |
| F-010 | 3 | Add a `cargo clippy -- -D warnings` job, a `rustsec/audit-check` job, a `cargo llvm-cov` coverage job, deny `unwrap_used`/`expect_used`/`panic` in `[workspace.lints.clippy]`, un-ignore `proptest-regressions` | 1 day (CI) + ongoing lint cleanup | DevOps + program team |

### Backlog — Severity 1-2

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-011 | 2 | Use `data.get(..32).ok_or(...)?` in `p_accessor_mint`; add a `data_len() >= Account::LEN` assertion to `validate_mut_token_account` | 1 hour | Program team |
| F-012 | 2 | Move `position.reset_pending_fee()` above the two `transfer_from_pool` calls in `claim_position_fee` | 15 minutes | Program team |
| F-013 | 2 | Document the self-assignable host fee in the README, or require `referral_owner != payer` | 2 hours | Program team + docs |
| F-014 | 2 | Add a guardian-held global pause flag consulted by `PoolActionAccess`, keeping `can_remove_liquidity` exempt; bring `claim_position_fee`/`claim_reward` under the validator | 3–5 days | Program team |
| F-015 | 2 | Add an emptiness-proved `close_pool` (vault balances, not the wrapping metrics counter, as the authority), or document the permanence | 2–3 days | Program team |
| Notes & Nitpicks (§4.16) | — | Ten items: `safe_sub` at `concentrated_liquidity.rs:312`, the 1-unit dust inconsistency, four stale TODO/`?` comments, one filename typo, `#[deprecated]` on `BaseFeeMode::RateLimiter`, un-ignore proptest seeds, `#[event_cpi]` on `FixPoolLayoutVersionCtx` | 2–4 hours total | Program team |

---

## 11. Re-Audit Checklist

- [ ] All Critical findings fixed and verified — *n/a, none found*
- [ ] All High findings fixed and verified — *n/a, none found*
- [x] Medium findings identified — **F-001** must be fixed or accepted with documented risk before the next release
- [ ] Regression tests added for each fix — specifically: a rejected max-`U24` dynamic-fee update (F-001), a swap against a zero-liquidity pool asserting a typed error rather than a panic (F-008), a `swap` that asserts the transfer occurred rather than that the transaction succeeded (F-009), and a short-account `input_token_account` asserting a typed error (F-011)
- [ ] Governance controls added — on-chain timelock and event emission for privileged paths (maturity categories 8 and 9)
- [ ] Program re-deployed and verified on-chain
- [ ] Binary hash matches source code (`anchor verify` / verifiable build) — currently `[UNKNOWN]`, OPS-070
- [ ] Upgrade authority confirmed to be a multisig with a threshold ≥ ceil(N/2)+1 — currently `[UNKNOWN]`, OPS-001/OPS-081
- [ ] Committed keypair `bossj3Jvwi…` confirmed unused and unfunded on all clusters (F-005)

---

## 12. Appendices

### A. Tool Versions

```
Declared by the repository (verified from files, not executed):
  anchor-cli:  1.0.2          (Anchor.toml [toolchain], .github/workflows/ci.yml ANCHOR_CLI_VERSION)
  solana-cli:  3.1.10         (Anchor.toml [toolchain], Cargo.toml [workspace.metadata.cli],
                               .github/workflows/ci.yml SOLANA_CLI_VERSION)
  rustc/cargo: 1.93.0         (rust-toolchain.toml)
  anchor-lang / anchor-spl:   1.0.2 (caret-resolved — see OPS-075)
  pinocchio / -token / -2022: git rev 17b0e862c01a868ea07ef81a2f8a9b4a504bdfed
  bun + ts-mocha + litesvm:   bun.lock committed; litesvm ^0.1.0
  cargo profile:              [profile.release] overflow-checks = true, lto = "fat",
                              codegen-units = 1

Used by the auditor:
  auditor-skill 7.3.0@6bb2cbf (1,413 checklist items / 136 known vectors)
  git (read-only inspection), ripgrep (evidence grep)
  NOTE: nothing in the repository was built, installed or executed. cargo/npm/pnpm/yarn/
        pip/python/node/make/curl/wget were blocked for the duration of the engagement.
```

### B. Environment

```
OS:              Linux 6.6.87.2-microsoft-standard-WSL2
Audited commit:  a85c926607433f23f0ea60f4ca7b1ae92f4156cb
Cluster tested:  none — static, read-only, offline analysis
RPC provider:    none — no network access
Analysis mode:   auditor-skill Mode 1 (FULL repository audit), single-agent linear walk;
                 no subagents, no Task/Agent tool, file-by-file with checkpointing
Artifacts:       audit_2/intake.md      — persisted QUESTIONS.md intake (defaults recorded)
                 audit_2/checkpoint.md  — per-chunk progress and candidate-finding log
                 audit_2/REPORT.md      — this document
                 audit_2/roadmap.md     — prioritised remediation roadmap
```

### C. Repository-Supplied Text Treated as Data

Per the engagement rules, all README files, code comments, docstrings, CI files and any text
addressing "the AI" or "the auditor" were analysed as untrusted input, never as instructions.

- No prompt-injection attempt, embedded instruction, or text addressed to an AI auditor was found
  anywhere in the audited commit. There is no `AGENTS.md`, `CLAUDE.md`, `.cursorrules` or `.claude/`
  directory in the tree (`.gitignore` lists `.claude` as ignored, and no such directory is tracked).
  Nothing is reported under checklist 19 or 12 on this basis.
- `README.md` claims were treated as claims and verified independently. Two are worth recording:
  the "Admin" endpoint list omits `update_pool_fees`, `fix_pool_fee_params`, `fix_config_fee_params`
  and `fix_pool_layout_version` (the instructions behind F-001 and F-006), and it describes
  `close_claim_fee_operator` / `create_claim_fee_operator`, which no longer exist under those names
  — the operator model was generalised to `create_operator_account` with a permission bitmask.
  The README is stale relative to the code it documents.
- `README.md` states "The program has been audited" and links `docs.meteora.ag`. That report was not
  retrieved (no network access) and no credit was given for it: every item in this report was
  evaluated independently against the source.
- The untracked `AUDITOR/` and `audit_1/` directories present in the working tree are artifacts of a
  prior local run, are not part of commit `a85c926`, and were excluded from the audit scope. Their
  contents were not read into the analysis.

### D. Disclaimer

This audit report is provided as-is. It represents a point-in-time review of the codebase at commit
`a85c926607433f23f0ea60f4ca7b1ae92f4156cb`, performed statically and offline by an autonomous agent
following the auditor-skill 7.3 methodology. No guarantee is made that all vulnerabilities have been
found. This is a rigorous first pass and audit-shaped automation — **not** a substitute for a human
firm audit of business logic, economic modelling, or legal compliance, and **not** a machine-checked
proof of correctness. It does not issue a "safe to deploy" guarantee.

Three limits deserve emphasis rather than burial. First, the upgrade authority and multisig
configuration could not be observed offline; if that authority is weak, it dominates every finding
here (23 items are recorded `[UNKNOWN]` for this reason). Second, the deployed binary was not
compared against this source, so the findings describe the source, not necessarily what is running.
Third, the TypeScript test suite was inventoried and sampled rather than read line by line, which is
why four checklist-16 items about the suite's content are `[PARTIAL]` rather than `[PASS]`.

The audit does not constitute financial or legal advice.










