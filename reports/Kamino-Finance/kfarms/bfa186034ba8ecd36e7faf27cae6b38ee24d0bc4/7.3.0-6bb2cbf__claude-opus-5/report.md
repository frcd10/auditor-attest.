# 🔒 Security Audit Report

## 1. Executive Summary

**Repository:** Kamino-Finance / kfarms (KFarms — Kamino Farms Program)
**Commit:** `bfa186034ba8ecd36e7faf27cae6b38ee24d0bc4` (full SHA; short `bfa1860`, "Release 1.7.0 (#25)")
**Branch:** detached HEAD tracking `master`
**Date:** 2026-09-11
**Auditor:** auditor-skill 7.3.0 (`6bb2cbf`), autonomous agent, corpus Mode 1 (FULL repository audit), linear single-agent execution
**Scope:** PROGRAM (`--scope program`)
**Program ID:** `FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr` (`programs/kfarms/src/lib.rs:23`)
**Languages Detected:** Rust (in scope — 41 files, 5,406 LOC); TypeScript (2 files, 28 LOC — out of scope under `--scope program`)
**Repository Risk Score:** **6 — 🟡 MEDIUM** (highest finding = 6; fix soon)

### What We Found

KFarms is a custodial staking/liquidity-mining program: users deposit an SPL token into a program-owned `farm_vault` PDA and accrue up to ten reward tokens via a MasterChef-style `reward_per_share` accumulator, with optional deposit warmup, withdrawal cooldown, lockups with early-withdrawal penalties, and a "delegated farm" mode where a partner protocol holds the real tokens and KFarms is only a points ledger. **No permissionless fund-theft path was found.** Every value-moving instruction binds its signer to the `FarmState`/`UserState` via `has_one`, PDA seeds, or an explicit `address` constraint; all 26 handlers reject `remaining_accounts`; the share↔amount math widens to U192/U256, multiplies before dividing, and rounds consistently in the pool's favour; and the classic first-depositor/donation inflation vector is closed because the only path that raises the vault's tracked balance without minting shares (`deposit_to_farm_vault`) is gated on the farm admin.

The material risk in this codebase is **liveness, not theft**. Several reward-path code paths abort (Rust `panic!`, `assert!`, `unwrap()`, or a raw arithmetic overflow caught by `overflow-checks = true`) instead of returning a typed error, and `refresh_global_rewards` sits on the critical path of *every* user-facing instruction that moves stake. The highest-severity finding (**F-001, severity 6**) is a concrete instance: a farm admin (or the `delegated_rps_admin`) who schedules a reward curve whose first point starts in the future puts the farm into a state where `most_recent_curve_starting_point` returns `InvalidRpsCurvePoint` forever — `last_issuance_ts` can never advance past the future timestamp — so `stake`, `unstake`, `harvest_reward`, `refresh_farm` and even the config instruction that would repair the curve all revert permanently, stranding every active staker's principal. F-002, F-003 and F-005 are three further routes into the same unrecoverable state (an unbounded `rewards_per_second_decimals`, an unchecked `rps × elapsed` product, and an unvalidated Scope oracle price id). F-004 breaks the reward-vault solvency invariant: `reward_user_once` credits a user's unclaimed rewards without debiting `rewards_available`, so the sum of claims can exceed the vault balance. Engineering-process coverage is the weakest area: the repository contains **no tests at all** (the only test file is the Anchor scaffold stub calling a non-existent `initialize` instruction), no fuzzing, no static analysis and no CI configuration (F-012).

**Deploy guidance:** this report does **not** issue a "safe to deploy" clearance. Nothing found here blocks deployment on fund-theft grounds, but F-001/F-002/F-003/F-005 are unrecoverable fund-lock states reachable by ordinary, non-malicious administrative configuration and should be fixed before the next release; F-004 should be resolved or explicitly documented before `is_reward_user_once_enabled` is turned on for any farm. This is audit-shaped automation and a rigorous first pass — not a substitute for a human firm audit, and not a machine-checked proof of correctness.

### Severity Distribution

| Score | Label | Count |
|-------|-------|-------|
| 10 | 🔴 CRITICAL | 0 |
| 9 | 🔴 CRITICAL | 0 |
| 8 | 🟠 HIGH | 0 |
| 7 | 🟠 HIGH | 0 |
| 6 | 🟡 MEDIUM | 1 |
| 5 | 🟡 MEDIUM | 3 |
| 4 | 🔵 LOW | 2 |
| 3 | 🔵 LOW | 7 |
| 2 | ⚪ INFO | 4 |
| 1 | ⚪ INFO | 1 |
| **Total Findings** | | **18** |

### Items Verified

| Metric | Count |
|--------|-------|
| Total checklist items | 591 (in scope) |
| PASS | 215 |
| FAIL | 68 |
| PARTIAL | 95 |
| N/A | 213 |
| Completion | 100% (591 / 591 in-scope items carry an explicit verdict) |

> Of the 213 `N/A` verdicts, 174 are *feature absent / not applicable* (no DEX, no NAV, no mint, no bonding curve, no TWAP, no native/Pinocchio code, no `remaining_accounts`) and 39 are *out of band* — items that can only be answered by an on-chain query (`solana program show`), a multisig console, or an organisational process, none of which a static read-only audit of this repository can reach. Every out-of-band item is labelled as such inline.

---

## 2. Scope Coverage

> Which checklists and vector groups were in scope, and how many items were evaluated. Out-of-scope items render `[N/A — out of scope]` from the scope gate (Rule 0), not from reading each file.

| Checklist / vector group | In scope? | Items evaluated / total | Trigger / reason |
|---|---|---|---|
| 01 Account Validation | Yes | 90 / 90 | `.rs` + `Anchor.toml` detected |
| 02 Access Control | Yes | 50 / 50 | `.rs` + `Anchor.toml` detected |
| 03 Arithmetic Safety | Yes | 63 / 63 | `.rs` + `Anchor.toml` detected |
| 04 CPI & PDA Safety | Yes | 70 / 70 | `.rs` + `Anchor.toml` detected |
| 05 State Machine & Lifecycle | Yes | 72 / 72 | `.rs` + `Anchor.toml` detected |
| 06 Economic & Logic | Yes | 89 / 89 | `.rs` + `Anchor.toml`, protocol handles user funds (intake Q17 = yes) |
| 07 OpSec & Governance | Yes | 85 / 85 | in `PROGRAM` scope set (FULL-AUDIT § Scope Control) |
| 16 Formal Verification & Testing | Yes | 72 / 72 | in `PROGRAM` scope set |
| 08–10 off-chain (TS/web) | No | 0 / 232 | OUT-OF-SCOPE (`--scope program`). Only 2 TS files exist (`tests/kfarms.ts`, `migrations/deploy.ts`), both unmodified Anchor scaffold |
| 11 Supply Chain | No | 0 / 52 | OUT-OF-SCOPE (`--scope program`); Cargo dependency hygiene partially covered by OPS-075 |
| 12 Secrets & Key Management | No | 0 / 53 | OUT-OF-SCOPE (`--scope program`); key-custody surface partially covered by OPS-027…036 |
| 13 Deployment & Infrastructure | No | 0 / 89 | OUT-OF-SCOPE (`--scope program`) |
| 14 Python Safety | No | 0 / 82 | OUT-OF-SCOPE: no `.py` files in the repository |
| 15 General Language Safety | No | 0 / 88 | OUT-OF-SCOPE: no `.go` / `.java` / `.rb` / `.php` files |
| 17 Logging, Monitoring & IR | No | 0 / 65 | OUT-OF-SCOPE (`--scope program`); event-emission gap still reported as F-014 via SM-047…050 |
| 18 Privacy, Compliance & Change Mgmt | No | 0 / 60 | OUT-OF-SCOPE (`--scope program`); no PII surface (on-chain pubkeys only) |
| 19 AI Agent Security | No | 0 / 33 | OUT-OF-SCOPE: no `.mcp.json`, no agent SDK, no LLM integration |
| 20 Rust Off-Chain Services | No | 0 / 21 | OUT-OF-SCOPE: no `.rs` outside `programs/` |
| KV crypto / on-chain (1–30) | Yes | 30 / 30 | `always (crypto)` + Solana program markers |
| KV modern on-chain (101–109) | Yes | 9 / 9 | sysvar / PDA-bump / Token-2022 / ATA / close markers present |
| KV 111 (BPF stack DoS) | Yes | 1 / 1 | on-chain program phase |
| KV 118–123, 125, 127–131 | Yes | 12 / 12 | on-chain phase; evaluated with the feature-marker gate |
| KV 132–136 | Yes | 5 / 5 | on-chain phase; all markers provably absent → evidence-backed `[N/A — feature absent]` |
| KV 091 (upgrade authority) | Yes | 1 / 1 | pulled in by in-scope checklist 07 §7.1 |
| KV backend (31–55) | No | 0 / 25 | OUT-OF-SCOPE: no backend in scope |
| KV frontend (56–75) | No | 0 / 20 | OUT-OF-SCOPE: no frontend in scope |
| KV devops (76–100, excl. 091) | No | 0 / 24 | OUT-OF-SCOPE: checklists 11–13 out of scope |
| KV AI-agent / off-chain-rust / custody (110, 112–117, 124, 126) | No | 0 / 9 | OUT-OF-SCOPE: no AI-agent, off-chain Rust, or custody component |

### Scope Metrics

| Metric | Count |
|---|---:|
| In-scope checklist items | 591 |
| Items with a verdict | 591 |
| In-scope known-vectors | 58 |
| In-scope known-vectors with a verdict | 58 |
| Completion (in-scope) | 100% |

---

## 3. Scope & Methodology

### Files Audited

| Domain | Language | Files | Lines of Code |
|---|---|---|---|
| Solana Program (`programs/kfarms/src/`) | Rust | 41 | 5,406 |
| — core logic (`farm_operations.rs`, `stake_operations.rs`, `state.rs`, `token_operations.rs`, `types.rs`, `lib.rs`) | Rust | 6 | 2,962 |
| — instruction handlers (`handlers/`) | Rust | 27 | 2,103 |
| — utilities (`utils/`) | Rust | 8 | 341 |
| Build / workspace config (`Anchor.toml`, `Cargo.toml`, `programs/kfarms/Cargo.toml`, `rust-toolchain.toml`, `Cargo.lock`, `.gitignore`) | TOML / text | 6 | — |
| Out of scope (read for context only): `tests/kfarms.ts`, `migrations/deploy.ts` | TypeScript | 2 | 28 |
| **Total in scope** | | **47** | **5,406** |

### Method

Executed per `FULL-AUDIT.md` top to bottom, single agent, linear, read-only:

1. **Phase −1 — Scope declaration.** Discovery by extension/marker (`Anchor.toml`, `Cargo.toml`, `programs/`), then the scope gate of `SKILL.md` narrowed by the explicit `--scope program` flag → checklists 01–07 + 16 loaded on demand; all other checklists never read.
2. **Phase 0 — Setup.** Program id, Anchor/Solana/rustc versions, workspace layout, instruction matrix (§6) and state model (§7) reconstructed by hand from the source (no pre-scanner was available; `tools/auditor-tools/` is not present).
3. **Phase 0.5 — Context reconstruction.** Every non-trivial function (all 26 handlers, `farm_operations.rs`, `stake_operations.rs`, `state.rs`, `utils/*`) was read in full before any verdict was recorded. Every claim in this report cites `file:line` at the audited commit.
4. **Phase 1 — Per-instruction review** (checklists 01–04 per handler), then cross-cutting state-machine (05) and economic (06) review.
5. **Phase 3/4 — OpSec & governance (07), verification & testing (16), known vectors (Phase 4.4)** using the `known-vectors/INDEX.md` "Load when (markers)" gate; 18 vector files were opened and applied in full, the remainder resolved from the marker gate with the evidence recorded inline.
6. **Phase 4.5 — Maturity assessment** (§8), **Phase 5 — report**.

Intake (QUESTIONS.md defaults applied non-interactively) is persisted at `audit_2/intake.md`; the code-walk checkpoint at `audit_2/checkpoint-01-code-walk.md`; the remediation roadmap at `audit_2/roadmap.md`.

**Constraints on this engagement (stated for honesty, per Rule 10):**

- Nothing was built, installed, tested or executed. No `anchor build`, no `cargo build-sbf`, no `cargo audit`, no `solana program show`, no test run. All analysis is static.
- Consequently, every item that can only be answered by an on-chain query or an organisational process (upgrade authority, multisig threshold, key custody, branch protection, verifiable build, monitoring/alerting, incident-response process) is recorded as `[N/A — out of band]` with the reason, **not** as PASS.
- The external `scope` crate (`scope-types`, git rev `0c8f7925aad9f5cf30b6715f2bef0ece9235d87a`) is not vendored in this repository and was not available on disk, so the exact length of `scope::OraclePrices::prices` could not be read. F-005 is written to be correct either way and says explicitly what remains unverified.
- Source comments have been stripped from this copy of the tree (blank indentation remains where doc comments were — e.g. `state.rs:187-198`, `stake_operations.rs:1-137`). Intent was therefore reconstructed from code alone, per the Phase 0.5 anti-hallucination rule.

### Trust Model & Actors

Findings are calibrated against this model (derived in `audit_2/intake.md` §6). A gap reachable only by an actor trusted below is capped in severity per OUTPUT-RULES Rule 1 ("privilege required"); the same gap reachable permissionlessly would score higher.

| Actor | Gate | Trusted to | Trusted NOT to |
|---|---|---|---|
| Upgrade authority | unknown (out of band) | upgrade the program | push a malicious upgrade |
| Global admin (`GlobalConfig.global_admin`) | signer + `has_one` | set `treasury_fee_bps` (≤10000), nominate a successor, sweep the treasury vault, set `second_delegated_authority` | set a confiscatory fee |
| Farm admin (`FarmState.farm_admin`) | signer + `require_keys_eq!` | all farm configuration, add/withdraw rewards, appoint `withdraw_authority` | strand or confiscate deposits |
| Withdraw authority (`FarmState.withdraw_authority`) | signer + `has_one` | **remove all staked principal** from `farm_vault` | withdraw for its own benefit — a fully trusted fund-moving role by design |
| Delegate / second delegated authority | signer + explicit compare | set any user's stake, init/close user states, `reward_user_once` | mis-report stake |
| Delegated RPS admin | signer + explicit compare | update reward rate / curve | set an unfundable or malformed schedule |
| Scope oracle | external account, admin-configured | supply a price for the deposit cap and reward scaling | report a manipulated/stale price |
| Depositor / permissionless caller | none | stake, unstake, harvest, refresh, transfer ownership, crank slashed amounts | — (untrusted — the attacker) |

### Assumptions & Simplifications

Every QUESTIONS.md default applied non-interactively is restated here, so "no finding" reads against a stated assumption rather than a blanket clearance:

1. **Deployment = mainnet-live** (inferred from `declare_id!` + `security_txt` + the "Release 1.7.0" tag). No devnet discount was applied to any severity.
2. **TVL = Unknown** → no TVL multiplier in either direction; severities reflect mechanism impact.
3. **Upgradeability unknown** → assumed upgradeable with a single/unknown authority. Not auto-flagged as a finding because the repository contains no evidence either way; recorded instead as an out-of-band coverage gap and a maturity-scorecard item.
4. **Prior audits (OtterSec, Offside Labs, per `lib.rs:34`) were not treated as fixing anything** — the code was audited as if unreviewed.
5. **The farm admin, withdraw authority and delegate authority are honest** for severity purposes. Findings that merely restate their designed power are capped at INFO/LOW (F-007); findings where a *routine, non-malicious* action by those roles produces an unrecoverable state are not capped that way (F-001, F-002, F-005).
6. **`overflow-checks = true`** is assumed to be in force for the deployed artifact (set in the workspace `[profile.release]`, root `Cargo.toml:6`). Every "unchecked arithmetic" finding is therefore written as a panic/DoS, not as silent wraparound. If a future build drops that flag, F-003 escalates sharply.
7. **The external `scope` program is assumed correct and honest** within its documented behaviour; only KFarms' handling of its output was audited.
8. **No CI, branch protection, secret scanning or dependency-update policy exists in the repository** at the audited commit (there is no `.github/` directory). This is stated as "absent from the repo", not "absent from the organisation".
9. **Prompt-injection sweep:** every tracked file was checked for text addressing an AI/auditor and attempting to redirect the audit. **None found.** (The untracked `AUDITOR/` directory in the working tree is a copy of an auditor skill, not repository content at commit `bfa1860`, and was excluded.)

### Checklists Applied

| # | Checklist | Items | Pass | Fail | Partial | N/A | Pass Rate (excl. N/A) |
|---|---|---|---|---|---|---|---|
| 01 | Account Validation | 90 | 42 | 3 | 15 | 30 | 70.0% |
| 02 | Access Control | 50 | 30 | 2 | 9 | 9 | 73.2% |
| 03 | Arithmetic Safety | 63 | 33 | 5 | 12 | 13 | 66.0% |
| 04 | CPI & PDA | 70 | 28 | 0 | 3 | 39 | 90.3% |
| 05 | State Machine | 72 | 39 | 3 | 15 | 15 | 68.4% |
| 06 | Economic & Logic | 89 | 26 | 4 | 22 | 37 | 50.0% |
| 07 | OpSec & Governance | 85 | 12 | 7 | 12 | 54 | 38.7% |
| 16 | Formal Verification & Testing | 72 | 5 | 44 | 7 | 16 | 8.9% |
| 08–15, 17–20 | *(out of scope — `--scope program`)* | 822 | — | — | — | — | — |
| | **Total (in scope)** | **591** | **215** | **68** | **95** | **213** | **56.9%** |

> Checklist 16's pass rate is dominated by a single root cause: the repository ships no test suite, no fuzzing harness and no CI. All 43 of its non-`FV-049` failures deduplicate into finding F-012.

---

## 4. Findings

> Every `[FAIL-N]` item verdict in §5 maps to exactly one of the finding blocks below; the Severity Distribution table counts these blocks. Findings are ordered by severity descending.

---

#### [F-001] Future-dated reward-curve start permanently bricks every stake, unstake and harvest on a farm

| Field | Value |
|---|---|
| **Severity** | 6 — 🟡 MEDIUM (impact 8, capped: trigger requires a privileged but routine config action) |
| **Checklist Item** | ECON-056, SM-064, FV-008 |
| **Category** | Denial of Service / State Machine / Liveness |
| **Language** | Rust |
| **File** | `programs/kfarms/src/state.rs:412-430`, `programs/kfarms/src/farm_operations.rs:368-379` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` — structured attacker/operator narrative; no executable harness was built (no build/execute permitted in this engagement) |

**Description:**

`RewardScheduleCurve::most_recent_curve_starting_point()` returns an error when the curve's **first** point starts after `last_issued_ts`:

```rust
// state.rs:412-430
fn most_recent_curve_starting_point(&self, last_issued_ts: u64) -> Result<usize> {
    for (i, point) in self.points.iter().enumerate() {
        if point.ts_start > last_issued_ts {
            return if i > 0 { Ok(i - 1) } else {
                msg!("Invalid curve: first point has ts_start > last_issued_ts");
                err!(FarmError::InvalidRpsCurvePoint)     // ← L424
            };
        }
    }
    Ok(self.points.len() - 1)
}
```

`update_farm_config(UpdateRewardScheduleCurvePoints)` accepts any point set that passes `RewardScheduleCurve::validate()` (`state.rs:370-410` — sorted, no duplicate timestamps, first point ≠ `u64::MAX`). A curve whose single point is `{ ts_start: <future>, reward_per_time_unit: R }` — the natural way to express "rewards start at launch" — passes validation. The same instruction then sets `reward_info.last_issuance_ts = ts` (`farm_operations.rs:378`), i.e. *now*.

From that moment `last_issuance_ts` is permanently less than `points[0].ts_start`, and `last_issuance_ts` is **only** advanced inside `refresh_global_reward` *after* `get_cumulative_amount_issued_since_last_ts()` has already returned (`farm_operations.rs:880-882` → `:951`). The error therefore fires before the value that would clear it can ever be written. The condition is self-perpetuating and **does not heal when the future timestamp arrives**, because the comparison is against the frozen `last_issued_ts`, not against `now`.

**Impact:**

`refresh_global_rewards` is on the critical path of every instruction that moves stake or rewards. Once a farm enters this state, all of the following revert with `InvalidRpsCurvePoint`, permanently:

| Instruction | Path to the failure |
|---|---|
| `stake` | `handler_stake.rs:32` → `farm_operations.rs:453` |
| `unstake` | `handler_unstake.rs:23` → `farm_operations.rs:768` |
| `harvest_reward` | `handler_harvest_reward.rs:49` → `farm_operations.rs:587` |
| `refresh_farm` / `refresh_user_state` | `handler_refresh_farm.rs:25` / `farm_operations.rs:716` |
| `add_rewards` / `withdraw_reward` | `farm_operations.rs:99` / `:124` |
| `set_stake_delegated` | `farm_operations.rs:534` |
| `update_farm_config(UpdateRewardRps \| UpdateRewardScheduleCurvePoints)` — **the repair path** | `farm_operations.rs:171-175` refreshes *before* writing the new curve |

The escape hatch at `farm_operations.rs:871-876` (skip issuance when `total_active_stake_scaled == 0`) cannot be reached, because reducing the stake to zero requires `unstake`, which is itself blocked. Active stakers' principal is locked with no on-chain recovery. The only residual exits are `withdraw_unstaked_deposits` (works — it never refreshes; only helps users who already had a matured pending withdrawal) and `withdraw_from_farm_vault` (works — a farm admin can set a `withdraw_authority` via a non-reward config mode and evacuate the vault, then compensate users off-chain).

**Reachability** *(Rule 5b, required at N ≥ 6)*

- Entry point: `update_farm_config(mode = UpdateRewardScheduleCurvePoints)` @ `handler_update_farm_config.rs:10-34`.
- Signer / authority required: **`farm_admin` OR `delegated_rps_admin`** @ `handler_update_farm_config.rs:23-27` — privileged, but this is the *intended* instruction for scheduling rewards, not an abuse path.
- Preconditions: the reward index is initialised (`farm_operations.rs:179`); the curve currently in place is valid (so the pre-write refresh at `:171` succeeds); the farm has non-zero `total_active_stake_scaled` (otherwise `refresh_global_reward` short-circuits harmlessly at `:871`).
- Guard analysis: `RewardScheduleCurve::validate()` (`state.rs:370-410`) checks ordering, duplicate timestamps and the `u64::MAX` sentinel — it does **not** check `points[0].ts_start <= now`. `from_points` is additionally `.unwrap()`ed at `farm_operations.rs:373`, so even a rejected curve panics rather than returning the error.
- Verdict: **REACHABLE**.

**Math / State-Bounds** *(Rule 5b, required at N ≥ 6)*

- Vulnerable transition: `last_issuance_ts := now` (`farm_operations.rs:378`) while `points[0].ts_start := T_future` (`:373`), then `most_recent_curve_starting_point(last_issued_ts = now)` @ `state.rs:416`.
- Input domain: any `T_future > now`; `ts_start` is a raw `u64` read from instruction data with no upper or lower bound.
- Boundary that breaks: `points[0].ts_start > last_issued_ts` with `i == 0` ⟹ `Err(InvalidRpsCurvePoint)` @ `state.rs:424`.
- Worked case: at `now = 1_800_000_000` an admin sets `points = [{ ts_start: 1_800_086_400, rps: 1_000 }]` (rewards start in 24 h). The write succeeds. At `now + 1s`, `refresh_global_reward` calls `get_cumulative_amount_issued_since_last_ts(1_800_000_000, 1_800_000_001)` → `most_recent_curve_starting_point(1_800_000_000)` → `1_800_086_400 > 1_800_000_000`, `i == 0` → error. At `now + 48 h` the comparison is unchanged (`1_800_086_400 > 1_800_000_000` still holds) — the farm never recovers.
- Net effect: 100% of the farm's active stake is frozen indefinitely; the reward accounting stops advancing. DoS, not theft — no attacker gains the funds.

**Proof of Concept:**

```text
Actor:      farm_admin (or delegated_rps_admin) — honest operator, routine action
Capability: one update_farm_config call; no capital required

1. Farm F is live with N stakers and total_active_stake_scaled > 0.
2. Operator schedules next week's emissions:
      update_farm_config(mode = UpdateRewardScheduleCurvePoints,
                         data = [reward_index=0] ++ borsh(vec![
                             RewardPerTimeUnitPoint { ts_start: now + 7*86400,
                                                      reward_per_time_unit: R }]))
   - farm_operations.rs:171  refresh_global_rewards(..)  -> OK (old curve still valid)
   - farm_operations.rs:373  from_points(..).unwrap()    -> OK (validate() passes)
   - farm_operations.rs:378  last_issuance_ts = now
3. Any user calls stake / unstake / harvest_reward:
   -> farm_operations.rs:880 get_cumulative_amount_issued_since_last_ts(now, now+dt)
   -> state.rs:424           err!(FarmError::InvalidRpsCurvePoint)
   -> whole transaction reverts.
4. Operator attempts to repair with update_farm_config(UpdateRewardRps, rps = 0):
   -> farm_operations.rs:171 refresh_global_rewards(..) -> same error -> revert.
   The curve can never be rewritten. Stakers cannot unstake. Terminal.
```

**Recommendation:**

```rust
// state.rs — make the accumulator tolerate a not-yet-started schedule instead of failing.
fn most_recent_curve_starting_point(&self, last_issued_ts: u64) -> Result<Option<usize>> {
    for (i, point) in self.points.iter().enumerate() {
        if point.ts_start > last_issued_ts {
            // i == 0 => the schedule has not started yet: nothing has accrued.
            return Ok(if i > 0 { Some(i - 1) } else { None });
        }
    }
    Ok(Some(self.points.len() - 1))
}

pub fn get_cumulative_amount_issued_since_last_ts(&self, last_issued_ts: u64, current_ts: u64)
    -> Result<u64>
{
    // ...
    let Some(start_index) = self.most_recent_curve_starting_point(last_issued_ts)? else {
        return Ok(0);           // schedule starts in the future — issue nothing, stay live
    };
    // ...
}
```

Additionally (defence in depth): in `farm_operations::update_reward_config`, clamp the stored watermark to the schedule start — `reward_info.last_issuance_ts = ts.min(curve.points[0].ts_start)` — and replace `RewardScheduleCurve::from_points(&points).unwrap()` at `farm_operations.rs:373` with `?` propagation (see F-010).

---

#### [F-002] Admin configuration values are accepted with no bounds and no cross-validation; `rewards_per_second_decimals ≥ 20` bricks the farm irrecoverably

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM |
| **Checklist Item** | OPS-082, OPS-083, OPS-084 |
| **Category** | Input Validation / Admin Config |
| **Language** | Rust |
| **File** | `programs/kfarms/src/farm_operations.rs:362-367`, `programs/kfarms/src/utils/math.rs:41-42`, `programs/kfarms/src/farm_operations.rs:894-895` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

Only two of the fifteen settable farm parameters are range-checked: `treasury_fee_bps ≤ 10000` (`farm_operations.rs:44-47`) and `locking_early_withdrawal_penalty_bps ≤ 10000` (`:229`). Everything else is deserialised and stored verbatim:

| `FarmConfigOption` | Field | Bound enforced | Consequence of a bad value |
|---|---|---|---|
| `RpsDecimals` | `rewards_per_second_decimals: u8` | **none** | `ten_pow(x)` panics for `x > 19` (`utils/math.rs:41-42`) on every refresh → permanent brick |
| `ScopeOraclePriceId` | `scope_oracle_price_id: u64` | **none** | out-of-range index into `scope_prices.prices` (`utils/scope.rs:23`) → panic (F-005) |
| `ScopeOracleMaxAge` | `scope_oracle_max_age: u64` | **none** | `0` (the value a freshly-initialised farm holds) rejects every price as stale (F-005) |
| `LockingStartTimestamp` / `LockingDuration` | `u64` | **none**, and never cross-checked against each other or `now` | `locking_start + locking_duration` overflows → panic in `apply_early_withdrawal_penalty` (`utils/withdrawal_penalty.rs:66`); `locking_start = 0` silently disables the penalty in `WithExpiry` mode |
| `UpdateRewardRps` | `reward_per_time_unit: u64` | **none** | `rps × elapsed` overflow → panic (F-003) |
| `DepositWarmupPeriod` / `WithdrawCooldownPeriod` | `u32` | **none** | a large cooldown locks withdrawals for up to ~136 years |
| `UpdateRewardMinClaimDuration` | `u64` | **none** | a large value makes rewards permanently unclaimable |
| `LockingMode` | `u64` | validated **after** assignment, by `.unwrap()` | panic instead of `InvalidConfigValue` (`farm_operations.rs:218-219`) |

The `rewards_per_second_decimals` case is the severe one because, like F-001, it is unrecoverable: `refresh_global_reward` evaluates `ten_pow(reward_info.rewards_per_second_decimals.into())` unconditionally (`farm_operations.rs:894-895`), and the config instruction that would repair the value refreshes first (`:171-186`), so it panics before it can write.

**Impact:**

A farm admin who sets `RpsDecimals` to any value in `20..=255` — a single byte, with no UI or on-chain guard — permanently bricks the farm exactly as in F-001: `stake`, `unstake`, `harvest_reward`, `refresh_farm`, `add_rewards`, `withdraw_reward` and the repair path all abort with a VM panic, and active stakers' principal is locked. The remaining unbounded parameters produce recoverable but user-visible failures (rewards unclaimable, withdrawals locked, penalties silently disabled).

**Reachability:** entry `update_farm_config(mode = RpsDecimals)` @ `handler_update_farm_config.rs:10`; authority `farm_admin` only (`:29`); no guard exists between deserialisation (`farm_operations.rs:363`) and the store (`:366`). REACHABLE.

**Math / State-Bounds:** `ten_pow(x)` is a lookup into `POWERS_OF_TEN: [u64; 20]` guarded by `if x > 19 { panic!(...) }` (`utils/math.rs:41-46`). Input domain `0..=255` from a `u8` config write. Boundary: `x = 20`. Worked case: admin sets `rps_decimals = 20`; next `refresh_global_reward` with `total_active_stake_scaled > 0` and `ts != last_issuance_ts` reaches `:895` and aborts. Net effect: the whole farm's stake is frozen.

**Recommendation:**

```rust
// farm_operations.rs — update_reward_config
FarmConfigOption::RpsDecimals => {
    let value: u8 = BorshDeserialize::try_from_slice(&data[..1])?;
    require_gte!(19u8, value, FarmError::InvalidConfigValue);   // ten_pow domain
    reward_info.rewards_per_second_decimals = value;
}

// utils/math.rs — never panic on a config-derived exponent
pub fn ten_pow(x: usize) -> Result<u64, FarmError> {
    POWERS_OF_TEN.get(x).copied().ok_or(FarmError::InvalidConfigValue)
}
```

Apply the same treatment to every other setter: bound `scope_oracle_price_id` by the Scope price-array length, require `scope_oracle_max_age` to be within a sane window (e.g. `1..=86_400`) whenever the oracle is enabled, reject `locking_start_timestamp.checked_add(locking_duration)` overflow atomically at write time, cap `deposit_warmup_period` / `withdrawal_cooldown_period` / `min_claim_duration_seconds`, and validate `LockingMode` **before** assignment with `require!(LockingMode::try_from_primitive(value).is_ok(), FarmError::InvalidConfigValue)`.

---

#### [F-003] Unchecked arithmetic throughout the reward and stake math aborts the transaction; in the refresh path the abort is unrecoverable

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM (would be 8+ without `overflow-checks = true`) |
| **Checklist Item** | AR-001, AR-002, AR-003, AR-005, FV-049, KV-011 |
| **Category** | Arithmetic / Denial of Service |
| **Language** | Rust |
| **File** | `programs/kfarms/src/state.rs:476-477`, `:199`, `:217`; `programs/kfarms/src/farm_operations.rs:890`, `:920`, `:933`; `programs/kfarms/src/stake_operations.rs:352-606`; `programs/kfarms/src/utils/withdrawal_penalty.rs:48-78` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

The value-moving math uses bare `+ - * /` on state- and user-derived `u64`/`u128` values in roughly 40 places, with `checked_*` used only sporadically (`farm_operations.rs:104-107`, `:592`, `:604-608`, `:955-968`). The workspace sets `overflow-checks = true` (`Cargo.toml:6`), so these **abort the VM rather than wrapping** — there is no silent value corruption anywhere in this program. The residual risk is therefore liveness, and it is concentrated in three places on the reward-refresh critical path:

```rust
// state.rs:476-477 — reward accumulation, both operators unchecked
let period_amount = point.reward_per_time_unit * (end_ts - start_ts);
cumulative_amount += period_amount;

// farm_operations.rs:890 — Constant-type rewards, unchecked u128 product
RewardType::Constant => cumulative_amt * u128::from(farm_state.total_staked_amount),

// farm_operations.rs:920/933 — oracle scaling, then an unwrapped narrowing cast
decimal_adjusted_amt * px / factor
...
oracle_adjusted_amt.try_into().unwrap()          // u128 -> u64, panics above u64::MAX
```

Because `last_issuance_ts` only advances *after* these expressions evaluate (`farm_operations.rs:951`), a farm that once overflows keeps overflowing: the elapsed term grows monotonically, so the condition is permanent, and — as in F-001 — the config instruction that would lower the rate refreshes first (`:171-186`) and aborts too.

Secondary unchecked sites (transaction-local aborts, no permanence): `state.rs:199` (`total_staked_amount + amount` in `can_accept_deposit`, reachable with an attacker-chosen `amount` before any balance check), `state.rs:217` (`unadjusted_total * price_value / price_ten_pow` then `.unwrap()` on the narrowing cast), `utils/withdrawal_penalty.rs:66` (`locking_start + locking_duration`), `:54` (`penalty_bps * time_remaining`), `stake_operations.rs:354/378/405/450/475/550/566/578/598-601` (pool accounting; all structurally bounded by the invariants they maintain), `farm_operations.rs:654/664/746/750/813-814/982/1049`.

**Impact:**

For a farm configured with a high-precision emission rate, a quiet period is enough to lock the farm. Worked bound: `u64::MAX / rps` seconds of no interaction. At `rps = 1e15` (1 token/s of a 6-decimals token expressed with `rps_decimals = 9`) that is `18_446_744_073_709_551_615 / 1e15 ≈ 18_446 s ≈ 5.1 hours` without a single `refresh_farm`/`stake`/`harvest` call. At `rps = 1e12` it is ~213 days. The `RewardType::Constant` variant multiplies by `total_staked_amount` on top, and the `u128 → u64` cast at `:933` fails long before the `u128` product does. Consequence: the same permanent stake freeze as F-001, with no attacker profit.

**Reachability:** `refresh_global_reward` is called from every stake/unstake/harvest/refresh/add-reward path (see the table in F-001). No signer is required — `refresh_farm` is permissionless (`handler_refresh_farm.rs:33-40`) — but no attacker can *choose* the overflow, since `rps` is admin-set and the elapsed term is wall-clock. REACHABLE, operator-triggered.

**Math / State-Bounds:** vulnerable expression `point.reward_per_time_unit * (end_ts - start_ts)` @ `state.rs:476`; input domain `reward_per_time_unit ∈ [0, u64::MAX]` (admin-set, unbounded — F-002), `end_ts - start_ts ∈ [0, ~1e10]` (wall-clock seconds). Boundary: product `≥ 2^64`. Net effect: abort on every call thereafter; funds frozen, none moved.

**Recommendation:**

```rust
// state.rs:476-477
let period_amount = point
    .reward_per_time_unit
    .checked_mul(end_ts.checked_sub(start_ts).ok_or(FarmError::MathOverflow)?)
    .ok_or(FarmError::MathOverflow)?;
cumulative_amount = cumulative_amount
    .checked_add(period_amount)
    .ok_or(FarmError::MathOverflow)?;
```

…and, for the refresh path specifically, prefer **saturating** semantics over a hard error so that a mis-configured emission rate degrades to "issue at most `rewards_available`" instead of freezing the farm — `rewards` is already clamped by `cmp::min(amount, reward_info.rewards_available)` at `farm_operations.rs:942`, so saturation is safe and strictly better for liveness:

```rust
let period_amount = point.reward_per_time_unit.saturating_mul(end_ts.saturating_sub(start_ts));
cumulative_amount = cumulative_amount.saturating_add(period_amount);
```

Replace `oracle_adjusted_amt.try_into().unwrap()` (`:933`) and `(… / price_ten_pow).try_into().unwrap()` (`state.rs:217-219`) with `u64::try_from(..).map_err(|_| FarmError::MathOverflow)?`, and convert the remaining bare operators in `stake_operations.rs` to `checked_*` with `FarmError::MathOverflow`.

---

#### [F-004] `reward_user_once` credits unclaimed rewards without debiting `rewards_available`, over-committing the reward vault

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM |
| **Checklist Item** | ECON-068 |
| **Category** | Economic / Reward Accounting |
| **Language** | Rust |
| **File** | `programs/kfarms/src/farm_operations.rs:732-754` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

The reward vault's solvency invariant is `vault_balance == rewards_available + rewards_issued_unclaimed`. It is maintained by every other path:

| Path | `rewards_available` | `rewards_issued_unclaimed` | vault balance |
|---|---|---|---|
| `add_reward` (`:104-107`) | `+amount` | — | `+amount` |
| `refresh_global_reward` (`:953-968`) | `−rewards` | `+rewards` | — |
| `harvest` (`:604-608` + CPI) | — | `−reward` | `−reward` |
| `withdraw_reward` (`:137-139` + CPI) | `−amount` | — | `−amount` |
| **`reward_user_once` (`:746-752`)** | **unchanged** | **`+amount`** | **unchanged** |

```rust
// farm_operations.rs:746-752 — note the absence of any rewards_available debit
farm_state.reward_infos[index].rewards_issued_unclaimed += amount;
farm_state.reward_infos[index].rewards_issued_cumulative =
    farm_state.reward_infos[index].rewards_issued_cumulative.saturating_add(amount);
user_state.rewards_issued_unclaimed[index] += amount;
user_state.rewards_issued_cumulative[index] =
    user_state.rewards_issued_cumulative[index].saturating_add(amount);
```

Each call therefore inflates total claims by `amount` without any matching inflow, leaving `rewards_available + rewards_issued_unclaimed > vault_balance`.

**Impact:**

Two consequences, both first-come-first-served:

1. **Under-collateralised claims.** Once the cumulative `reward_user_once` amount exceeds the vault's free balance, the last users to call `harvest_reward` get an SPL `insufficient funds` error from the token CPI and cannot claim rewards the program's own state says they are owed. Their `rewards_issued_unclaimed` stays non-zero, which also permanently blocks `close_empty_user_state` (`handler_close_empty_user_state.rs:26-32`).
2. **Admin over-withdrawal.** `withdraw_reward` caps the withdrawal at `rewards_available` (`farm_operations.rs:137`), which is now overstated relative to what is actually owed, so an admin can withdraw tokens that back outstanding user claims.

Severity is held at 5 rather than higher because the path is gated on the `delegate_authority` (`handler_reward_user_once.rs:53`) **and** on `is_reward_user_once_enabled == 1` (`:25-29`), which itself can only be turned on for delegated farms (`farm_operations.rs:306`). No permissionless actor can trigger it, and a careful operator who tops the vault up via `add_rewards` for every `reward_user_once` keeps the invariant intact — but nothing in the program enforces that pairing.

**Proof of Concept:**

```text
Setup:  delegated farm F, reward index 0, vault holds 1,000 tokens,
        rewards_available = 1,000, rewards_issued_unclaimed = 0,
        is_reward_user_once_enabled = 1.

1. delegate_authority calls reward_user_once(index=0, amount=1_000, ...) for Alice.
      -> rewards_issued_unclaimed = 1_000 ; rewards_available STILL 1_000 ; vault = 1_000
2. Time passes; refresh_global_reward issues the scheduled emission to Bob:
      -> rewards_available 1_000 -> 0 ; rewards_issued_unclaimed 1_000 -> 2_000
      Program state now owes 2_000 against a 1_000-token vault.
3. Alice harvests first -> receives 1_000 (minus treasury fee). Vault = 0.
4. Bob harvests -> token CPI fails (insufficient funds). Bob's rewards are
   unclaimable, and close_empty_user_state is blocked for him forever.
```

**Recommendation:**

```rust
// farm_operations.rs — reward_user_once
pub fn reward_user_once(farm_state: &mut FarmState, user_state: &mut UserState,
                        reward_index: u64, amount: u64) -> Result<()> {
    let index: usize = reward_index.try_into().map_err(|_| FarmError::RewardIndexOutOfRange)?;
    require!((index as u64) < farm_state.num_reward_tokens, FarmError::RewardIndexOutOfRange); // F-009

    let reward = &mut farm_state.reward_infos[index];
    // Fund the one-off reward out of the un-issued pool, preserving
    // vault_balance == rewards_available + rewards_issued_unclaimed.
    reward.rewards_available = reward
        .rewards_available
        .checked_sub(amount)
        .ok_or(FarmError::WithdrawRewardZeroAvailable)?;
    reward.rewards_issued_unclaimed = reward
        .rewards_issued_unclaimed
        .checked_add(amount)
        .ok_or(FarmError::IntegerOverflow)?;
    // ... user-side accounting unchanged, but with checked_add
}
```

If issuing outside the tracked pool is intentional, make it explicit instead: require the caller to have topped the vault up in the same transaction, and add a debug/invariant assertion that `rewards_available + rewards_issued_unclaimed <= rewards_vault.amount`.

---

#### [F-005] Scope-oracle configuration is unvalidated: an out-of-range price id panics, and a freshly-initialised farm carries `scope_oracle_max_age = 0`

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | ECON-058, OPS-082 |
| **Category** | Input Validation / Oracle |
| **Language** | Rust |
| **File** | `programs/kfarms/src/farm_operations.rs:263-274`, `programs/kfarms/src/utils/scope.rs:22-24`, `programs/kfarms/src/handlers/handler_initialize_farm.rs:21` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

Two independent gaps in the same feature:

1. **Unbounded price id.** `FarmConfigOption::ScopeOraclePriceId` stores the raw `u64` (`farm_operations.rs:263-268`) and `load_scope_price` then uses it as a direct array index: `scope_prices.prices[farm_state.scope_oracle_price_id as usize]` (`utils/scope.rs:23`). Any id at or beyond the length of Scope's `prices` array is an out-of-bounds index — a Rust panic, not a program error. *(The exact array length could not be confirmed: the `scope-types` crate is a git dependency and is not vendored in this repository. The missing bounds check is provable at `farm_operations.rs:263-268` regardless of what that length is; what remains unproven is the precise threshold.)*
2. **Zero-initialised staleness window.** `FarmState::default()` sets `scope_oracle_max_age: u64::MAX` (`state.rs:278`), but `handler_initialize_farm` does not use `Default` — it initialises a zeroed account and explicitly sets only `scope_oracle_price_id = u64::MAX` (`:21`), leaving `scope_oracle_max_age == 0`. An admin who enables the oracle (`ScopeOraclePriceId`) without also setting `ScopeOracleMaxAge` makes `ts - price.unix_timestamp > 0` true for every price older than the current second, so `can_accept_deposit` and `refresh_global_reward` return `ScopeOraclePriceTooOld` on essentially every call (`state.rs:204-211`, `farm_operations.rs:906-913`).

**Impact:** every instruction that refreshes rewards or checks the deposit cap fails for that farm — `stake`, `unstake`, `harvest_reward`, `refresh_farm`, `add_rewards`. Unlike F-001/F-002 this is **recoverable**: `update_farm_config` for a non-reward mode does not refresh, and `load_scope_price` is called through `map_or(None, |v| v)` (`handler_update_farm_config.rs:14`), so an admin can repair the configuration by passing `scope_prices = None`. Until they do, user principal is unwithdrawable.

**Recommendation:** validate at write time — `require_gt!(scope::MAX_ENTRIES as u64, value, FarmError::InvalidOracleConfig)` for the price id, `require!(value > 0 && value <= MAX_REASONABLE_AGE, FarmError::InvalidOracleConfig)` for the max age — and reject enabling `ScopeOraclePriceId` while `scope_prices == Pubkey::default()` or `scope_oracle_max_age == 0` (cross-validate the three fields atomically, per OPS-083). Also set `scope_oracle_max_age` explicitly in both `initialize_farm` and `initialize_farm_delegated` so the on-chain default matches `FarmState::default()`.

---

#### [F-006] `is_farm_frozen` is written but never read — the program has no working pause, and a full vault withdrawal strands outstanding user claims

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | AC-030, AC-032, AC-035, OPS-045, SM-004, SM-060, SM-065, ECON-072, ECON-084 |
| **Category** | Access Control / Emergency Response |
| **Language** | Rust |
| **File** | `programs/kfarms/src/farm_operations.rs:1017-1019`, `programs/kfarms/src/state.rs:96` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

`withdraw_from_farm_vault` sets `farm_state.is_farm_frozen = true` when the withdraw authority drains the entire vault (`farm_operations.rs:1017-1019`, via `stake_operations::withdraw_farm:580-589`). A repository-wide search finds exactly three references to the field: the declaration (`state.rs:96`), the `Default` impl (`state.rs:247`) and that one write. **No instruction ever reads it.** The program therefore has no emergency stop of any kind, and the "frozen" state is advisory metadata only.

Two concrete consequences:

1. **No pause.** There is no way to halt deposits, withdrawals or harvests during an incident. Combined with the absence of any aggregate outflow limit (ECON-072/ECON-089), the only lever an operator has in an incident is a program upgrade.
2. **Residual extraction with liabilities outstanding.** `withdraw_farm` zeroes both `total_active_amount` and `total_pending_amount` and withdraws their sum without asserting that pending user withdrawals are settled (`stake_operations.rs:578-589`). After a full drain, a user who already holds `pending_withdrawal_unstake_scaled > 0` calls `withdraw_unstaked_deposits`, `convert_stake_to_amount` computes `full_decimal_mul_div(stake, total_amount = 0, total_stake)` = 0 (`stake_operations.rs:299-307`), and their pending stake is silently zeroed for a 0-token payout — no error, no event. Meanwhile a *new* staker hits `convert_amount_to_stake(amount, total_stake > 0, total_amount = 0)`, whose `assert_eq!` at `stake_operations.rs:325-329` aborts the VM.

**Impact:** loss of an incident-response lever plus silent, error-free zeroing of a user's pending withdrawal after the trusted withdraw authority evacuates the vault. Severity is held at 4 because reaching the state requires the `withdraw_authority`, a fully trusted role by design (§3 Trust Model), and because no attacker gains value.

**Recommendation:**

```rust
// utils/constraints.rs
pub fn check_farm_not_frozen(farm_state: &FarmState) -> Result<()> {
    require!(farm_state.is_farm_frozen == 0, FarmError::OperationForbidden); // error already declared, unused
    Ok(())
}
```

Call it from `stake`, `deposit_to_farm_vault`, `set_stake_delegated` and `transfer_ownership` (deposit-side operations), while deliberately leaving `unstake`, `withdraw_unstaked_deposits` and `harvest_reward` reachable so users can always exit. Add an admin-gated `set_farm_frozen(bool)` so the flag can be both raised and cleared, and make `withdraw_farm` either reject or explicitly account for a drain while `total_pending_amount > 0`.

---

#### [F-007] The farm admin can appoint an arbitrary `withdraw_authority` and remove all staked principal, with no timelock, acceptance handshake or event

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW (designed privilege; the gap is the absence of friction and observability) |
| **Checklist Item** | ECON-035, ECON-036, ECON-043, OPS-058, OPS-078 |
| **Category** | Governance / Trust |
| **Language** | Rust |
| **File** | `programs/kfarms/src/farm_operations.rs:188-193`, `programs/kfarms/src/handlers/handler_withdraw_from_farm_vault.rs:10-44` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

`update_farm_config(WithdrawAuthority)` writes `farm_state.withdraw_authority` in one step from any pubkey the farm admin supplies (`farm_operations.rs:188-193`) — no two-step acceptance (unlike `pending_farm_admin`/`pending_global_admin`), no timelock, no event. `withdraw_from_farm_vault` then lets that key move the entire vault to a token account it controls (`handler_withdraw_from_farm_vault.rs:51-62`, `token::authority = withdraw_authority`), zeroing user accounting and freezing the farm.

This is the documented design for delegated custody (the withdraw authority is how a partner protocol moves deposits into its own strategy), so the *capability* is not the finding. The finding is that the single most consequential authority in the program rotates instantly, silently and irreversibly: stakers have no on-chain signal (no event — F-014) and no window in which to exit before the new authority can act.

**Impact:** a compromised or mistaken farm-admin key converts directly into a total loss of the farm's principal within one transaction. With `deposit_warmup_period`/`withdrawal_cooldown_period` set, users cannot exit fast enough even if they were watching account state.

**Recommendation:** mirror the admin pattern — add `pending_withdraw_authority` with an `accept_withdraw_authority` instruction signed by the new key, gate the switch behind a minimum delay stored in `FarmState` (e.g. `withdraw_authority_effective_ts`), and emit an Anchor event on both nomination and activation (F-014). For the highest-value farms, require the withdraw authority to be a program-owned PDA of the consuming protocol rather than a bare wallet.

---

#### [F-008] `rewards_treasury_vault` delegate and close-authority constraints check the wrong account

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | AV-067, AV-049 |
| **Category** | Account Validation |
| **Language** | Rust |
| **File** | `programs/kfarms/src/handlers/handler_harvest_reward.rs:149-157` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

```rust
// handler_harvest_reward.rs:149-157
#[account(mut,
    seeds = [BASE_SEED_REWARD_TREASURY_VAULT.as_ref(), global_config.key().as_ref(), rewards_vault.mint.as_ref()],
    bump,
    constraint = rewards_vault.delegate.is_none()        @ FarmError::RewardsTreasuryVaultHasDelegate,       // ← rewards_vault
    constraint = rewards_vault.close_authority.is_none() @ FarmError::RewardsTreasuryVaultHasCloseAuthority, // ← rewards_vault
    token::mint = reward_mint,
    token::token_program = token_program
)]
pub rewards_treasury_vault: Box<InterfaceAccount<'info, TokenAccountInterface>>,
```

Both constraints re-check `rewards_vault` — the *reward* vault, already checked two blocks above (`:141-142`) — instead of `rewards_treasury_vault`. The error names (`RewardsTreasuryVaultHasDelegate`, `RewardsTreasuryVaultHasCloseAuthority`) make the intent unambiguous: this is a copy-paste defect, and the treasury vault's `delegate`/`close_authority` are never validated anywhere in the program.

**Impact:** a defence-in-depth gap, not a live exploit. The treasury vault is a PDA whose authority is `treasury_vaults_authority` (`handler_initialize_reward.rs:75-83`), and the program never issues `approve` or `set_authority` on it, so no delegate or close authority can be installed through any code path audited here. The check exists precisely to catch the case where one appears anyway (e.g. via a future instruction, a Token-2022 extension, or an operator error); as written it would not.

**Recommendation:**

```rust
constraint = rewards_treasury_vault.delegate.is_none()        @ FarmError::RewardsTreasuryVaultHasDelegate,
constraint = rewards_treasury_vault.close_authority.is_none() @ FarmError::RewardsTreasuryVaultHasCloseAuthority,
```

---

#### [F-009] `reward_user_once` does not bound `reward_index`, stranding unclaimable rewards and permanently blocking `close_empty_user_state`

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | ECON-056, AV-029 |
| **Category** | Input Validation |
| **Language** | Rust |
| **File** | `programs/kfarms/src/handlers/handler_reward_user_once.rs:31-43`, `programs/kfarms/src/farm_operations.rs:738-752` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

Every other reward instruction bounds the index — `harvest_reward` (`handler_harvest_reward.rs:35-38`), `update_farm_config` (`farm_operations.rs:164-167`), `add_rewards`/`withdraw_reward` (implicitly, via the `reward_vault.key() == reward_infos[i].rewards_vault` constraint, which cannot match the zero pubkey of an unused slot). `reward_user_once` bounds nothing:

```rust
// handler_reward_user_once.rs:31-35 — indexes before any range check
require_eq!(user_state.rewards_issued_cumulative[reward_index as usize], ...);
// farm_operations.rs:738
let index: usize = reward_index.try_into().unwrap();
```

Two input classes:

- `reward_index >= 10` (`MAX_REWARDS_TOKENS`): out-of-bounds array index → VM panic instead of `RewardIndexOutOfRange`.
- `num_reward_tokens <= reward_index < 10`: writes into an **uninitialised reward slot**. The user's `rewards_issued_unclaimed[index]` becomes non-zero for a reward that has no vault and no mint, so it can never be harvested (`harvest_reward` rejects the index at `handler_harvest_reward.rs:35-38`), and `close_empty_user_state` — which requires *every* entry of `rewards_issued_unclaimed` to be zero (`handler_close_empty_user_state.rs:26-32`) — is blocked for that user forever, locking their rent.

**Impact:** operator error or a hostile delegate authority permanently blocks a user's ability to close their `UserState` and reclaim rent (~0.0074 SOL for 920 bytes), and corrupts `reward_infos[index]` for a slot that a later `initialize_reward` will hand out (`farm_operations.rs:71` writes into `reward_infos[num_reward_tokens]` without clearing the pre-existing `rewards_issued_unclaimed`).

**Recommendation:**

```rust
// handler_reward_user_once.rs — before any indexing
require_gt!(farm_state.num_reward_tokens, reward_index, FarmError::RewardIndexOutOfRange);
```

and, defensively, have `farm_operations::initialize_reward` zero the whole `RewardInfo` slot (`*reward_info = RewardInfo::default()`) before populating it.

---

#### [F-010] Reachable `assert!` / `unwrap()` / `panic!` / `unimplemented!()` replace typed program errors

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | FV-049, FV-055, AR-014 |
| **Category** | Error Handling / DoS Resilience |
| **Language** | Rust |
| **File** | `programs/kfarms/src/stake_operations.rs:325-329`, `:433-438`; `programs/kfarms/src/farm_operations.rs:514-526`, `:219`, `:357`, `:373`, `:375`, `:738`, `:933`; `programs/kfarms/src/utils/math.rs:42`, `:82`, `:94`; `programs/kfarms/src/state.rs:166-178`, `:219`, `:729`, `:747`; `programs/kfarms/src/handlers/handler_update_farm_config.rs:16` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

Eighteen call sites abort the SBF VM instead of returning a `FarmError`. On Solana a panic and an error both revert the transaction, so this is not exploitable in itself — but it (a) gives operators and users a bare `SBF program panicked` with no error code or `#[msg]` text, (b) defeats client-side error handling and `simulateTransaction` triage, and (c) is the delivery mechanism for the unrecoverable states in F-002/F-003. Representative sites:

| Site | Trigger |
|---|---|
| `handler_update_farm_config.rs:16` — `mode.try_into().unwrap()` | any `mode > 24` from a client |
| `farm_operations.rs:219` — `LockingMode::try_from_primitive(value).unwrap()` | `locking_mode ∉ {0,1,2}`; note the field is written on the line *above* the validation |
| `farm_operations.rs:357` — `RewardType::try_from_primitive(value).unwrap()` inside `xmsg!` | `reward_type > 1` |
| `farm_operations.rs:373` — `from_points(&points).unwrap()` | any malformed curve (an error type already exists and is discarded) |
| `farm_operations.rs:375` — `_ => unimplemented!()` | unreachable today only because the caller filters modes at `:158-162` |
| `farm_operations.rs:514-526` — five `assert_eq!` + `.expect()` | delegated-farm precondition drift |
| `stake_operations.rs:325-329`, `:433-438` — `assert_eq!`, `assert!` | pool-invariant drift (reachable after a full vault drain — F-006) |
| `utils/math.rs:42`, `:82`, `:94` — `panic!`, two `.expect()` | out-of-domain exponent (F-002); U256→U192 and U128→u64 narrowing |
| `state.rs:166-178`, `:729`, `:747` — `.unwrap()` on `to_scaled_val` / `try_from` | overflow or an invalid enum byte in state |

**Recommendation:** convert each to a `require!`/`?` returning the appropriate existing `FarmError` (`InvalidConfigValue`, `MathOverflow`, `ConversionFailure`, `InvalidRpsCurvePoint` — several of which are already declared and unused, see Notes & Nitpicks), keep `assert!`-style invariants only behind `#[cfg(test)]`, and move `farm_operations.rs:219`'s validation *before* the assignment.

---

#### [F-011] The reward-mint extension allowlist permits clawback- and freeze-capable mints

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | AV-063, AV-064, AV-065, EXT-013, KV-019, KV-105 |
| **Category** | Token-2022 / Custody |
| **Language** | Rust |
| **File** | `programs/kfarms/src/utils/constraints.rs:34-95` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

`validate_base_token_extensions` does inspect Token-2022 mint extensions and enforces a real allowlist — transfer fees must be zero (`:65-74`), a transfer hook must have no program id (`:75-85`), and `DefaultAccountState` must be `Initialized` (`:86-92`). But the allowlist itself (`:34-44`) admits three extensions that hand the mint issuer power over the program's own vault:

```rust
const VALID_BASE_TOKEN_EXTENSIONS: &[ExtensionType] = &[
    ExtensionType::ConfidentialTransferFeeConfig,
    ExtensionType::ConfidentialTransferMint,
    ExtensionType::MintCloseAuthority,     // mint can be closed and its address recycled
    ExtensionType::MetadataPointer,
    ExtensionType::PermanentDelegate,      // issuer can move tokens out of rewards_vault at will
    ExtensionType::TransferFeeConfig,
    ExtensionType::TokenMetadata,
    ExtensionType::TransferHook,
    ExtensionType::DefaultAccountState,
];
```

Additionally, neither classic-SPL nor Token-2022 `freeze_authority` is ever inspected, for reward mints or for the base staking mint.

**Impact:** for a reward token whose issuer is not trusted, `PermanentDelegate` allows draining `rewards_vault` at any time, and a live `freeze_authority` allows freezing either the reward vault (blocking all harvests) or an individual user's reward ATA (blocking that user's harvest, with their `rewards_issued_unclaimed` stuck non-zero and `close_empty_user_state` blocked — same tail as F-009). User **principal** is not exposed: the base staking mint is constrained to the classic Token program by `Program<'info, Token>` (`handler_initialize_farm.rs:70`) and `token::transfer`, so no Token-2022 base mint can be registered. Severity is held at 3 because the reward mint is chosen by the farm admin, the risk is disclosed by the token itself on-chain, and the loss is bounded by the un-harvested reward balance.

**Recommendation:** drop `PermanentDelegate` and `MintCloseAuthority` from the allowlist (or gate them behind an explicit per-mint acknowledgement stored in `RewardInfo`), and add a `freeze_authority.is_none()` check — or an explicit trusted-mint allowlist — at `initialize_reward`, where the decision is made once rather than being re-derived on every harvest.

---

#### [F-012] No tests, no fuzzing, no static analysis, no CI

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | FV-002…FV-008, FV-013, FV-019, FV-023…FV-032, FV-033…FV-044, FV-059…FV-072 (42 items) |
| **Category** | Verification & Testing |
| **Language** | Rust / TypeScript |
| **File** | `tests/kfarms.ts:1-16`; absence of `.github/`, `#[cfg(test)]`, fuzz targets |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` — evidenced by absence; verified by exhaustive search over the 56 tracked files |

**Description:**

At the audited commit the repository contains:

- **No Rust tests.** A repository-wide search for `#[cfg(test)]`, `mod tests`, `#[test]` and `proptest` returns zero matches across all 41 `.rs` files.
- **No working integration tests.** `tests/kfarms.ts` is the unmodified Anchor scaffold: it imports a type `Kfarms` from `../target/types/kfarms` (the crate is named `farms`) and calls `program.methods.initialize()` — an instruction that does not exist in this program. It cannot compile, let alone pass.
- **No CI.** There is no `.github/` directory, no GitLab CI file and no `Makefile`; nothing runs `cargo clippy`, `cargo audit`, `anchor test` or any SAST tool on a change.
- **No fuzzing or property tests** (no Trident, cargo-fuzz, Kani, Certora, Mollusk or LiteSVM harness) and no documented invariants — the only machine-checkable invariants in the whole codebase are the five `assert_eq!`s in `farm_operations::set_stake` (`:514-521`) and the three `static_assertions::const_assert_eq!` account-size checks (`state.rs:17-21`, `:60-64`, `:491-495`).

**Impact:** every finding in this report is a bug class a test suite would plausibly have caught. F-001 fails on the first "schedule rewards for next week" integration test; F-002 fails on a boundary test of `RpsDecimals = 20`; F-004 fails on a token-conservation assertion over the reward vault; F-008 fails on a negative test that installs a delegate on the treasury vault. For a mainnet-live program that custodies user funds, the absence of any executable verification is the single largest process gap in this audit, and it is why the Code Maturity Scorecard (§8) scores 0 for both Testing and Fuzzing.

**Recommendation:** in priority order —

1. A Mollusk or LiteSVM suite that loads the compiled `.so` and covers, per instruction, one success path and one authorization-negative (wrong signer) path.
2. Invariant tests for the three properties this audit checked by hand: `total_active_stake_scaled == Σ user.active_stake_scaled`; `farm_vault.amount >= total_staked_amount + total_pending_amount + slashed_amount_current`; `rewards_vault.amount >= rewards_available + rewards_issued_unclaimed` (this one currently fails — F-004).
3. Boundary tests over every `FarmConfigOption` value, including the out-of-domain values in F-002.
4. A CI workflow running `cargo clippy -- -D warnings`, `cargo audit` and the test suite on every PR.
5. A Trident (or cargo-fuzz) target over `RewardScheduleCurve::get_cumulative_amount_issued_since_last_ts` and the `stake_operations` conversion pair — the two functions with the widest input domain.

---

#### [F-013] Oracle timestamp subtraction underflows and aborts on a future-dated price

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | AR-061, SM-070 |
| **Category** | Arithmetic / Oracle |
| **Language** | Rust |
| **File** | `programs/kfarms/src/state.rs:204`, `programs/kfarms/src/farm_operations.rs:906` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

Both staleness checks compute the age with a raw unsigned subtraction:

```rust
// state.rs:204 (can_accept_deposit)  and  farm_operations.rs:906 (refresh_global_reward)
if ts - price.unix_timestamp > self.scope_oracle_max_age {
```

If the Scope feed ever reports `unix_timestamp > ts` — clock skew between the oracle crank's clock and the validator's `Clock` sysvar, or a feed that timestamps slightly ahead — the subtraction underflows and, with `overflow-checks = true`, aborts the transaction. A third site, `ts - reward_info.last_issuance_ts` inside an `xmsg!` (`farm_operations.rs:926`), has the same shape; it is safe today only because `get_cumulative_amount_issued_since_last_ts` has already rejected `last_issued_ts > current_ts` at `state.rs:437-440`.

**Impact:** every deposit and reward refresh on an oracle-enabled farm reverts for as long as the feed is ahead of the validator clock. Self-healing (it clears as soon as the feed's timestamp falls behind), and only reachable on farms that enable the Scope oracle.

**Recommendation:**

```rust
let age = ts.saturating_sub(price.unix_timestamp);   // a future-dated price reads as age 0
require_gte!(self.scope_oracle_max_age, age, FarmError::ScopeOraclePriceTooOld);
```

and, if a future-dated price should itself be rejected, do so explicitly with its own error rather than by arithmetic accident.

---

#### [F-014] No events are emitted for any financial operation

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | SM-047, SM-048, SM-050, OPS-061, KV-122 |
| **Category** | Monitoring / Observability |
| **Language** | Rust |
| **File** | program-wide (no `emit!`, `emit_cpi!` or `#[event]` anywhere in `programs/kfarms/src/`) |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` — evidenced by absence |

**Description:**

The program emits no structured Anchor events. Every observable signal is free-form `msg!`/`xmsg!` text (`handler_stake.rs:40-44`, `farm_operations.rs:806-810`, etc.). Stakes, unstakes, harvests, treasury-fee transfers, vault withdrawals, slashing, admin handovers and authority rotations all land on-chain with no machine-parseable record.

**Impact:** (a) off-chain accounting and monitoring must parse log strings or reconstruct state by diffing account snapshots — the log-scraping surface that KV-122 describes as spoofable, since any program can emit a lookalike `msg!`; (b) there is no on-chain signal a user or watcher can subscribe to for the authority rotations in F-007 or for a full vault drain; (c) an incident timeline has to be rebuilt from transaction decoding rather than from events.

**Recommendation:** add `#[event]` structs and `emit!` (or `emit_cpi!` for CPI-callable indexing) for at least: `Staked`, `Unstaked`, `WithdrawnUnstaked`, `RewardHarvested { user, reward_index, user_amount, treasury_amount }`, `RewardsAdded`, `RewardWithdrawn`, `FarmVaultWithdrawn`, `SlashedAmountWithdrawn`, `FarmConfigUpdated { mode, old, new }`, `AdminPending` / `AdminAccepted`, `WithdrawAuthorityChanged`.

---

#### [F-015] Admin withdrawal destinations are unconstrained; the declared `RewardAtaOwnerNotAdmin` error is never used

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | AV-046, KV-016 |
| **Category** | Account Validation |
| **Language** | Rust |
| **File** | `programs/kfarms/src/handlers/handler_withdraw_reward.rs:100-104`, `programs/kfarms/src/handlers/handler_withdraw_treasury.rs:80-84`, `programs/kfarms/src/lib.rs:344` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

`withdraw_reward`'s `admin_reward_token_ata` and `withdraw_treasury`'s `withdraw_destination_token_account` are constrained only on `token::mint` and `token::token_program` — neither binds `token::authority`. Every other token account in the program binds its owner (`handler_add_reward.rs:104`, `handler_stake.rs:84`, `handler_harvest_reward.rs:125`, `handler_withdraw_from_farm_vault.rs:60`). `FarmError::RewardAtaOwnerNotAdmin` — "Reward ata owner is different than farm admin" — is declared at `lib.rs:344` and never referenced, which strongly suggests the constraint was intended and dropped.

**Impact:** none directly — both instructions already require the corresponding admin's signature, and an admin who wants funds elsewhere can forward them in a second transaction. The value of the missing constraint is defence in depth: it would make a mis-built client transaction (or a partially-signed transaction assembled by a third party) fail closed rather than send protocol funds to an arbitrary account.

**Recommendation:** add `token::authority = farm_admin` to `handler_withdraw_reward.rs:100-104` and `token::authority = global_admin` to `handler_withdraw_treasury.rs:80-84`, using the already-declared errors.

---

#### [F-016] `.gitignore` does not exclude the `wallet.json` that `Anchor.toml` points the provider at

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | OPS-028 |
| **Category** | Key Management |
| **Language** | config |
| **File** | `.gitignore:1-7`, `Anchor.toml:11` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

`Anchor.toml` sets `[provider] wallet = "./wallet.json"` (`:11`), i.e. the tooling expects a signing keypair at the repository root. `.gitignore` lists only `.anchor`, `.DS_Store`, `target`, `**/*.rs.bk`, `node_modules`, `test-ledger`, `.yarn`, `.cargo` — no `wallet.json`, no `*keypair*.json`, no `id.json`, no `.env`. A developer following the repository's own configuration creates an untracked-but-unignored private key in the working tree, one `git add -A` away from being committed.

Verified: no keypair, `.env` or PEM file has ever existed in this repository's history (`git log --all --diff-filter=A` over `*.env*`, `*.pem`, `*secret*`, `*keypair*`, `id.json`, `wallet.json` returns nothing; the complete all-history file list is the same 56 tracked files). This is a latent exposure, not a live one.

**Recommendation:** add `wallet.json`, `*keypair*.json`, `id.json`, `.env*` and `*.pem` to `.gitignore`; point `Anchor.toml` at a path outside the repository (e.g. `~/.config/solana/id.json`); and enable a secret scanner (gitleaks/trufflehog) in the CI pipeline recommended by F-012.

---

#### [F-017] The `scope` dependency is tracked by git branch rather than a pinned revision or tag

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO |
| **Checklist Item** | OPS-075, OPS-071 |
| **Category** | Supply Chain / Reproducibility |
| **Language** | Rust |
| **File** | `programs/kfarms/Cargo.toml:31`, `Cargo.lock:1769-1771` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

```toml
# programs/kfarms/Cargo.toml:31
scope = { git = "https://github.com/Kamino-Finance/scope.git", package = "scope-types", branch = "anchor_0.29_idl" }
```

The only dependency that is not a crates.io release is fetched from a **moving branch**. `Cargo.lock` does pin the resolved revision (`0c8f7925aad9f5cf30b6715f2bef0ece9235d87a`, `Cargo.lock:1771`), so a lock-respecting build is reproducible today — but `cargo update` silently follows the branch head, a force-push to `anchor_0.29_idl` changes what that name means, and the pinned object can be garbage-collected out of existence. This dependency supplies `scope::OraclePrices` and `scope::DatedPrice`, i.e. the layout the program indexes into at `utils/scope.rs:23` — a silent layout change would mis-read prices.

The rest of the dependency set is conventional (`anchor-lang`/`anchor-spl` 0.29.0, `solana-sdk` 1.17.18, `spl-token` 4.0.0, `decimal-wad` 0.1.9, `uint` 0.9.5, `bytemuck` 1.4.0), all caret-versioned with the graph pinned by the committed `Cargo.lock`, and `rust-toolchain.toml` pins rustc 1.74.1 — good reproducibility hygiene apart from this one entry. No dependency was cross-checked against an advisory database (`cargo audit` was not run — see §3 Constraints).

**Recommendation:** replace `branch = "anchor_0.29_idl"` with `rev = "0c8f7925aad9f5cf30b6715f2bef0ece9235d87a"` (or a signed tag), vendor the crate, and add `cargo audit` / `cargo deny` to CI.

---

#### [F-018] Build-configuration inconsistencies: an inert `compile_error!` guard and an `Anchor.toml` program-name mismatch

| Field | Value |
|---|---|
| **Severity** | 1 — ⚪ INFO |
| **Checklist Item** | OPS-025 |
| **Category** | Build / Configuration |
| **Language** | Rust / TOML |
| **File** | `programs/kfarms/src/lib.rs:19-20`, `programs/kfarms/Cargo.toml:14-18`, `Anchor.toml:4-5` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

1. **Inert cluster guard.** `lib.rs:19-20` declares `#[cfg(all(feature = "mainnet", any(feature = "devnet", feature = "localnet")))] compile_error!(...)`, but `programs/kfarms/Cargo.toml:14-18` declares only `no-entrypoint`, `no-idl`, `cpi` and `idl-build`. The features `mainnet`, `devnet` and `localnet` do not exist, so every `cfg` arm is permanently false and the guard can never fire. If those features were ever meant to gate cluster-specific constants, nothing enforces their mutual exclusion.
2. **Program-name mismatch.** `Anchor.toml:4-5` maps `kfarms = "FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr"`, but the crate and `[lib] name` are both `farms` (`programs/kfarms/Cargo.toml:2,11`). Anchor keys `[programs.<cluster>]` by the *program* name, so the declared id is not wired to the built artifact; `anchor test`/`anchor deploy` and the scaffold test's `anchor.workspace.Kfarms` cannot resolve. The `declare_id!` value itself (`lib.rs:23`) does match the address in `Anchor.toml`.

**Impact:** none at runtime — the deployed binary's identity comes from `declare_id!`. This is developer-experience and build-integrity friction, and it is part of why the test suite in F-012 cannot run.

**Recommendation:** either declare the three cluster features in `[features]` (and use them) or delete the `compile_error!` guard; rename the `Anchor.toml` key to `farms` (or rename the crate to `kfarms`) so the workspace mapping resolves.

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
- **F-001** — Future-dated reward-curve start permanently bricks every stake, unstake and harvest on a farm.

#### Severity 5 — 🟡 MEDIUM
- **F-002** — Admin configuration values accepted with no bounds; `rewards_per_second_decimals ≥ 20` bricks the farm irrecoverably.
- **F-003** — Unchecked arithmetic in the reward-issuance path aborts the transaction; unrecoverable in the refresh path.
- **F-004** — `reward_user_once` over-commits the reward vault.

#### Severity 4 — 🔵 LOW
- **F-005** — Scope-oracle configuration unvalidated (out-of-range price id; zero-initialised `scope_oracle_max_age`).
- **F-006** — `is_farm_frozen` never enforced; no working pause; residual extraction with liabilities outstanding.

#### Severity 3 — 🔵 LOW
- **F-007** — Un-timelocked, unannounced `withdraw_authority` appointment can remove all principal.
- **F-008** — Treasury-vault delegate/close-authority constraints check the wrong account.
- **F-009** — `reward_user_once` unbounded `reward_index` strands rewards and blocks user-state closure.
- **F-010** — Reachable `assert!`/`unwrap()`/`panic!`/`unimplemented!()` instead of typed errors.
- **F-011** — Reward-mint allowlist permits clawback- and freeze-capable mints.
- **F-012** — No tests, fuzzing, static analysis or CI.
- **F-013** — Oracle timestamp subtraction underflows on a future-dated price.

#### Severity 2 — ⚪ INFO
- **F-014** — No events emitted for any financial operation.
- **F-015** — Admin withdrawal destinations unconstrained (unused `RewardAtaOwnerNotAdmin`).
- **F-016** — `.gitignore` omits the `Anchor.toml`-referenced `wallet.json`.
- **F-017** — `scope` dependency tracked by git branch.

#### Severity 1 — ⚪ INFO
- **F-018** — Inert `compile_error!` guard and `Anchor.toml` program-name mismatch.

---

### Notes & Nitpicks

> Observations with **no security impact** — not scored on the 1–10 scale and not tracked as findings (OUTPUT-RULES Rule 1).

- `programs/kfarms/src/**` — source comments have been stripped throughout this copy of the tree; only the blank indentation remains (e.g. `state.rs:187-198`, `stake_operations.rs:1-137`, `lib.rs:192-428`). Reviewability and intent-recovery are materially reduced.
- `lib.rs:177-186` — `idl_missing_types` is a live, callable instruction whose body is `unreachable!()`. It is gated behind the `UpdateGlobalConfig` context, so only a global admin can trigger the panic; it exists only to force IDL type emission.
- `lib.rs:209, 218, 224, 227, 233, 239, 344, 389` — declared `FarmError` variants that are never constructed: `RewardAlreadyInitialized`, `WrongRewardVaultAccount`, `RewardVaultAuthorityMismatch`, `NothingStaked`, `ConversionFailure`, `OperationForbidden`, `RewardAtaOwnerNotAdmin`, `UserTokenAccountOwnerMismatch`.
- `state.rs:483-488` (`get_current_rps`) and `state.rs:742-744` (`has_rewards_available`) are never called.
- `state.rs:697-700` — `TimeUnit::Slots` is unreachable: no instruction writes `FarmState::time_unit`, so every farm runs on `Seconds`. Either wire up a setter or delete the variant.
- `state.rs:226-290` — `FarmState::default()` disagrees with `handler_initialize_farm` on `scope_oracle_max_age` (`u64::MAX` vs the zeroed `0`); see F-005.
- `handler_add_reward.rs:90`, `handler_withdraw_reward.rs:89`, `handler_harvest_reward.rs:143` — `constraint = …` without an `@ FarmError::…`, so a mismatch surfaces as an opaque `ConstraintRaw`.
- `handler_add_reward.rs:90`, `handler_withdraw_reward.rs:89`, `handler_harvest_reward.rs:143` — `reward_infos[reward_index as usize]` is indexed inside the account constraint, which Anchor evaluates *before* the handler's `RewardIndexOutOfRange` check, so an out-of-range index panics rather than returning the typed error.
- `handler_reward_user_once.rs:51`, `handler_withdraw_slashed_amount.rs:43`, `handler_unstake.rs:37`, `handler_update_farm_admin.rs:24`, `handler_update_global_config_admin.rs` — `#[account(mut)]` on signers that neither pay rent nor receive lamports.
- Ten sites use raw `AccountInfo<'info>` where `UncheckedAccount<'info>` is the idiomatic (and Anchor-1.0-required) type — e.g. `handler_initialize_global_config.rs:33`, `handler_initialize_user.rs:73,76`, `handler_transfer_ownership.rs:163`, `handler_update_second_delegated_authority.rs:37`.
- `/// CHECK:` comments are terse ("authority", "Farm checks this") and do not name the constraint that performs the validation; the validation does exist in every case.
- `farm_operations.rs:614` — the treasury fee floors (`u64_mul_div`), so the treasury under-collects by <1 unit per claim. Harmless, but the conventional direction is to round fees up.
- `stake_operations.rs:299-307` — `convert_stake_to_amount` returns the **entire** `total_amount` when `total_stake == 0`; only reachable if the stake/amount invariant is already broken, but it is a surprising fallback to leave unguarded.
- `consts.rs:8-9` — `BASE_SEED_FARM_VAULTS_AUTHORITY` and `BASE_SEED_TREASURY_VAULTS_AUTHORITY` are the same literal `b"authority"`; collision is prevented only by the second seed (`farm_state` vs `global_config`). Distinct literals would be clearer.
- `farm_operations.rs:865`, `:1044` — `RewardInfo` (~712 bytes) is copied by value onto the stack; safe today against the 4 KiB SBF frame limit, but it is the largest local in the program (see KV-111).
- `handler_transfer_ownership.rs:136-140` — `require_eq!(amount_to_stake, amount_to_withdraw)` is tautological: `stake_with_cap_check` returns its own `amount` argument unchanged (`farm_operations.rs:499-501`).
- `handler_update_farm_config.rs:29` — `require_keys_eq!(farm_state.farm_admin, *ctx.accounts.signer.key)` has no custom error, unlike the sibling branch at `:23-27`.
- No `virtual`/dead-share offset exists in the share math; this is safe **only** because `deposit_to_farm_vault` is farm-admin-gated. If a permissionless donation path is ever added, the first-depositor inflation vector (KV-006) opens immediately.

---
## 5. Detailed Item Results

> Every in-scope checklist item appears below with an explicit verdict, in checklist order (OUTPUT-RULES Rule 4). `[N/A]` always carries the reason. `[FAIL-N]` verdicts cite the finding block in §4 that carries the full analysis. Line references are against commit `bfa186034ba8ecd36e7faf27cae6b38ee24d0bc4`.

### Checklist 01 — Account Validation (90 items)

```
[PASS]      AV-001: Every deserialized account is typed (Account/InterfaceAccount/AccountLoader/Program/Signer/Sysvar), so Anchor checks the owner; the only raw AccountInfos are PDA authorities bound by seeds+bump and/or has_one — handler_harvest_reward.rs:116,160-164
[PARTIAL]   AV-002: 10 accounts use raw AccountInfo<'info> instead of UncheckedAccount<'info> (Anchor 0.29 permits it; Anchor 1.0 does not)
              File: handler_initialize_global_config.rs:33, handler_initialize_user.rs:73,76, handler_transfer_ownership.rs:163, handler_update_second_delegated_authority.rs:37, handler_withdraw_treasury.rs:78, handler_close_empty_user_state.rs:87, handler_harvest_reward.rs:164, handler_withdraw_from_farm_vault.rs:77, handler_withdraw_unstaked_deposits.rs:87
              Improvement: switch to UncheckedAccount before the Anchor 1.0 migration; every one is constrained today
[PARTIAL]   AV-003: All raw AccountInfo fields carry a /// CHECK: comment, but the text is terse ("authority", "Farm checks this") and does not name the validation performed
              File: handler_initialize_farm.rs:61, handler_stake.rs:94, handler_harvest_reward.rs:159,166
              Improvement: state the constraint that validates the account (e.g. "CHECK: seeds+bump, and has_one = farm_vaults_authority on farm_state")
[PASS]      AV-004: Each /// CHECK: corresponds to real code — "Verified with a has_one constraint in farm state" (harvest_reward.rs:159) ⇒ has_one = farm_vaults_authority at :116; "Farm checks this" (scope_prices) ⇒ utils/scope.rs:13-20 key-equality checks
[PASS]      AV-005: AccountLoader<'info, T> is used only with this program's own types (GlobalConfig, FarmState, UserState) plus scope::OraclePrices, whose owner is the Scope program — utils/scope.rs:7
[PASS]      AV-006: All token accounts are Account<TokenAccount> or InterfaceAccount<TokenAccountInterface> — handler_stake.rs:80,87; handler_harvest_reward.rs:136,147,157
[PASS]      AV-007: All mints are Account<Mint>/InterfaceAccount<MintInterface> — handler_initialize_farm.rs:68, handler_harvest_reward.rs:122
[PASS]      AV-008: Program<System>, Program<Token>, Interface<TokenInterface>, Sysvar<Rent> used throughout — handler_initialize_farm.rs:70-73
[PASS]      AV-009: The only foreign-program state is scope::OraclePrices, loaded via AccountLoader (owner = Scope program) and additionally key-matched against farm_state.scope_prices — utils/scope.rs:18-20
[PARTIAL]   AV-010: declare_id! (lib.rs:23) matches the address in Anchor.toml, but the Anchor.toml key is `kfarms` while the crate/lib is `farms`, so the workspace mapping does not resolve; no keypair file is present to compare
              File: lib.rs:23, Anchor.toml:4-5, programs/kfarms/Cargo.toml:2,11 — see F-018
[PASS]      AV-011: All three account types use #[account(zero_copy)] with Anchor's 8-byte discriminator; sizes are asserted at compile time — state.rs:17-21,60-64,491-495
[PASS]      AV-012: No two account structs are interchangeable — AccountLoader enforces owner + discriminator on every load, and no instruction deserializes one type's bytes as another
[N/A]       AV-013: remaining_accounts are rejected outright in all 26 handlers, so none are deserialized — utils/constraints.rs:9-19
[N/A]       AV-014: no remaining_accounts are accepted (see AV-013)
[PASS]      AV-015: Discriminators are Anchor-derived from distinct struct names (GlobalConfig/FarmState/UserState) — no prefix collision
[PASS]      AV-016: All state uses #[account(zero_copy)]; no manual Borsh (de)serialization of account data
[N/A]       AV-017: no account versioning or migration exists; the only field fixup (refresh_farm.rs:21-23) rewrites a data field, not a discriminator
[PASS]      AV-018: Every mutated account is marked mut — farm_state/user_state on all state-changing paths, vaults on all transfer paths
[PARTIAL]   AV-019: Several signers are marked mut although they neither pay rent nor receive lamports
              File: handler_reward_user_once.rs:51, handler_withdraw_slashed_amount.rs:43, handler_unstake.rs:37, handler_update_farm_admin.rs:24, handler_withdraw_treasury.rs:55
              Improvement: drop the unnecessary mut to avoid taking write locks (see KV-131 contention)
[PASS]      AV-020: has_one is used pervasively — user_state has_one owner/farm_state; farm_state has_one farm_vault/farm_vaults_authority/global_config/farm_admin/withdraw_authority/delegate_authority/slashed_amount_spill_address; global_config has_one global_admin/treasury_vaults_authority
[PARTIAL]   AV-021: has_one is mostly the sole check; only three paths add a runtime comparison (handler_update_farm_config.rs:23-29, handler_close_empty_user_state.rs:37-59, handler_set_stake_delegated.rs:16-20)
              File: handler_stake.rs:63-72 (has_one only)
              Improvement: add require_keys_eq! backups on the highest-value paths (withdraw_from_farm_vault, withdraw_reward, withdraw_treasury)
[PASS]      AV-022: Every init carries payer, space (SIZE_USER_STATE) or token::* layout, and seeds+bump — handler_initialize_user.rs:78-83, handler_initialize_reward.rs:65-83
[PARTIAL]   AV-023: init_if_needed is enabled (programs/kfarms/Cargo.toml:21) and used twice
              File: handler_transfer_ownership.rs:168-174, handler_initialize_reward.rs:75-83
              Improvement: both uses are legitimate (a shared per-(config,mint) treasury vault; an idempotent destination user state) and both re-validate — keep, but document why in code
[PASS]      AV-024: The reinit guard is explicit: transfer_ownership reads the discriminator first (utils/accessors.rs:10-16, handler_transfer_ownership.rs:24-33) and takes load_init only for a zeroed account; AccountLoader::load_init itself rejects a non-zero discriminator
[PASS]      AV-025: close = rent_receiver, and rent_receiver is validated in the handler against user_state.owner (non-delegated) or farm_state.farm_admin (delegated) — handler_close_empty_user_state.rs:43-58,73
[PASS]      AV-026: Closure uses Anchor's close (writes CLOSED_ACCOUNT_DISCRIMINATOR and drains lamports); no manual close exists
[PASS]      AV-027: Seeds are complete — user_state [b"user", farm_state, delegatee]; farm_vault [b"fvault", farm_state, mint]; reward_vault [b"rvault", farm_state, reward_mint]; treasury vault [b"tvault", global_config, reward_mint] — consts.rs:5-10
[PARTIAL]   AV-028: Bumps are stored (farm_state.farm_vaults_authority_bump, global_config.treasury_vaults_authority_bump, user_state.bump) and reused for invoke_signed, but account constraints re-derive canonically with bare `bump` instead of `bump = state.bump`
              File: handler_stake.rs:74-79, handler_withdraw_unstaked_deposits.rs:74-79
              Improvement: use the stored bump in constraints to save the find_program_address compute (correctness is unaffected — both resolve to the canonical bump)
[PARTIAL]   AV-029: Most custom constraints carry a named error, three do not and surface as ConstraintRaw
              File: handler_add_reward.rs:90, handler_withdraw_reward.rs:89, handler_harvest_reward.rs:143
              Improvement: add @ FarmError::RewardVaultMismatch to each
[N/A]       AV-030: no realloc is used anywhere in the program
[N/A]       AV-031: no duplicate mutable account is declared in any context; a duplicate would fail on the second try_borrow_mut_data
[PASS]      AV-032: remaining_accounts are validated before use by being rejected — check_remaining_accounts is the first statement of all 26 handlers — utils/constraints.rs:9-19
[N/A]       AV-033: no remaining accounts are accepted
[N/A]       AV-034: no remaining accounts are accepted
[N/A]       AV-035: no remaining accounts are accepted
[N/A]       AV-036: no remaining accounts are accepted (count is required to be zero)
[N/A]       AV-037: no external/DEX CPI exists
[N/A]       AV-038: no remaining accounts are accepted
[N/A]       AV-039: no remaining accounts are accepted
[PASS]      AV-040: Space is const and compile-time asserted — SIZE_GLOBAL_CONFIG 2136, SIZE_FARM_STATE 8336, SIZE_USER_STATE 920 with const_assert_eq!(SIZE, size_of::<T>() + 8) — consts.rs:13-15, state.rs:17-21,61-64,492-495
[PASS]      AV-041: Rent exemption is enforced by Anchor's init (system create_account) and by #[account(zero)] pre-creation
[N/A]       AV-042: no Vec or String fields exist in any account struct; all collections are fixed arrays ([RewardInfo; 10], [u128; 10], [RewardPerTimeUnitPoint; 20])
[N/A]       AV-043: no realloc
[N/A]       AV-044: no account-shrinking path exists
[PASS]      AV-045: Every transfer's token accounts are mint-checked — handler_stake.rs:85,90; handler_withdraw_unstaked_deposits.rs:70; handler_harvest_reward.rs:126,144,154; handler_add_reward.rs:87,103
[FAIL-2]    AV-046: Two admin destination token accounts have no authority/owner constraint
              File: handler_withdraw_reward.rs:100-104, handler_withdraw_treasury.rs:80-84
              Impact: a mis-built or third-party-assembled admin transaction can send protocol funds to an arbitrary token account of the right mint
              Fix: add token::authority = farm_admin / global_admin (see F-015)
[PASS]      AV-047: Vault ownership is enforced both by PDA seeds and by token::authority = farm_vaults_authority / treasury_vault_authority — handler_initialize_farm.rs:52-58, handler_initialize_reward.rs:65-83, handler_withdraw_treasury.rs:64-70
[PARTIAL]   AV-048: Canonical ATA derivation is enforced exactly where it matters (harvest when payer != owner) and nowhere else
              File: handler_harvest_reward.rs:128-134,184-198
              Improvement: owner-signed flows legitimately accept any token account of the owner; no change needed there, but the two admin destinations (AV-046) should be constrained
[PASS]      AV-049: delegate.is_none() is enforced on farm_vault (handler_stake.rs:77, handler_withdraw_from_farm_vault.rs:67, handler_withdraw_unstaked_deposits.rs:77, handler_deposit_to_farm_vault.rs:46, handler_withdraw_slashed_amount.rs:61) and on rewards_vault (handler_harvest_reward.rs:141); the treasury-vault check is misdirected — see AV-067
[PARTIAL]   AV-050: No token account's frozen state is ever checked, and no mint freeze_authority is inspected
              File: utils/constraints.rs:34-95 (extension allowlist has no freeze-authority rule)
              Improvement: a frozen vault or user ATA silently blocks withdrawals/harvests — see F-011
[N/A]       AV-051: no WSOL-specific handling exists; native SOL is never wrapped/unwrapped (WSOL would be treated as any other SPL mint)
[PASS]      AV-052: Token vs Token-2022 is bound per account via token::token_program and Interface<TokenInterface>; the base staking token is pinned to the classic Token program by Program<'info, Token> — handler_initialize_farm.rs:70, handler_harvest_reward.rs:127,145,155,169
[PASS]      AV-053: Every account creation uses Anchor init (user_state, vaults) or #[account(zero)] + load_init (farm_state, global_config); load_init rejects a non-zero discriminator
[PASS]      AV-054: No manual initialization path exists; the discriminator is the initialized flag
[PASS]      AV-055: After close_empty_user_state the same seeds may be reused, but initialize_user writes a complete fresh UserState with a new user_id — farm_operations.rs:389-412
[PASS]      AV-056: Revival is blocked — Anchor's close writes CLOSED_ACCOUNT_DISCRIMINATOR, and both re-entry paths (init, init_if_needed + load_init) require a zero discriminator (see KV-106)
[PASS]      AV-057: Only one instruction closes an account and it performs no further work afterwards; no cross-instruction stale read is possible within this program
[PASS]      AV-058: Token program identity is constrained per account (never assumed) and token_interface is used wherever both programs must be supported — handler_harvest_reward.rs:127,145,155
[PARTIAL]   AV-059: associated_token::* constraints are not used; the canonical ATA is enforced by manual derivation in the one place it is required
              File: handler_harvest_reward.rs:184-198
              Improvement: prefer associated_token::mint/authority/token_program constraints for clarity
[PARTIAL]   AV-060: transfer_checked is used on all reward paths (token_operations.rs:38-47, handler_add_reward.rs:54-70), but base-token paths use the legacy token::transfer
              File: token_operations.rs:18-26, :56-65
              Improvement: safe today only because the base mint is pinned to classic SPL Token; migrate to transfer_checked if Token-2022 base mints are ever allowed
[PASS]      AV-061: Decimals are read from the mint account at call time, never hardcoded — utils/accessors.rs:3-8 used by token_operations.rs:46; handler_add_reward.rs:69 uses reward_mint.decimals. No cross-mint amounts are added or compared anywhere
[PARTIAL]   AV-062: Credited amounts are the declared transfer amount, not a post-transfer balance delta
              File: farm_operations.rs:104-107 (add_reward), stake_operations.rs:354 (stake)
              Improvement: safe only because transfer-fee mints are rejected (utils/constraints.rs:65-74) and the base mint is classic SPL; add a reload()-based delta if that ever changes
[PARTIAL]   AV-063: Token-2022 extensions are inspected and allowlisted, but PermanentDelegate, MintCloseAuthority and the confidential-transfer configs are accepted
              File: utils/constraints.rs:34-44 — see F-011
[FAIL-3]    AV-064: Custodied reward balances can be clawed back or frozen by an untrusted mint authority
              File: utils/constraints.rs:34-44
              Impact: a reward mint with PermanentDelegate can drain rewards_vault; an un-inspected freeze authority can block all harvests
              Fix: remove PermanentDelegate/MintCloseAuthority from the allowlist and check freeze_authority at initialize_reward (see F-011)
[PARTIAL]   AV-065: freeze_authority and mint_authority are never read for either the base or the reward mints
              File: handler_initialize_reward.rs:60-63, handler_initialize_farm.rs:68
              Improvement: a frozen vault deadlocks withdrawals with no recovery path — see F-011
[PASS]      AV-066: An explicit allowlist exists for Token-2022 extensions (VALID_BASE_TOKEN_EXTENSIONS) and is applied at initialize_reward, add_rewards, harvest_reward, withdraw_reward and withdraw_treasury — utils/constraints.rs:34-44
[FAIL-3]    AV-067: The treasury vault's delegate/close_authority constraints check rewards_vault instead
              File: handler_harvest_reward.rs:152-153
              Impact: rewards_treasury_vault's delegate and close authority are never validated anywhere in the program
              Fix: change both constraints to rewards_treasury_vault.* (see F-008)
[PASS]      AV-068: Clock is always obtained via the syscall (Clock::get()), never from a passed account — state.rs:728-735 and all 26 handlers
[PASS]      AV-069: The only sysvar passed as an account is Sysvar<'info, Rent>, which Anchor address-checks — handler_initialize_farm.rs:73, handler_initialize_user.rs:90
[PASS]      AV-070: All time gates (deposit warmup, withdrawal cooldown, min claim duration, oracle staleness, locking maturity) read Clock::get(), so a forged clock account cannot bypass them
[N/A]       AV-071: no Instructions-sysvar introspection and no precompile use
[N/A]       AV-072: no introspection-based signature checks exist
[N/A]       AV-073: no introspected signed messages exist
[N/A]       AV-074: no instruction-index introspection exists
[PASS]      AV-075: Every privileged account is bound by has_one, seeds, or address — never by transaction position — handler_transfer_ownership.rs:154-156, handler_deposit_to_farm_vault.rs:35, handler_withdraw_from_farm_vault.rs:51-55
[PASS]      AV-076: Bumps are canonical: Anchor `bump` (find_program_address) at derivation, ctx.bumps stored at init, and the stored bump reused for invoke_signed; create_program_address is never called — handler_initialize_farm.rs:19, utils/macros.rs:10-17 (see KV-104)
[N/A]       AV-089: no `require!` or branch reads ComputeBudget instructions — the program performs no Instructions-sysvar introspection at all (no load_instruction_at / get_instruction_relative / compute_budget anywhere), so there is no transaction-v1 budget gate to be silently unenforced (see KV-135)
[N/A]       AV-090: no instruction-introspection loop and no positional/count assumption exists — remaining_accounts are rejected outright (utils/constraints.rs:14-17) and every account is named in the Accounts struct, so the v1 instruction/account caps and no-op ComputeBudget instructions cannot affect this program (see KV-103, KV-136)
[N/A]       AV-077: the program is Anchor 0.29 (no native/Pinocchio entrypoint) — Anchor supplies the owner/discriminator/signer guarantees automatically
[N/A]       AV-078: Anchor program — owner checks are automatic (see AV-077)
[N/A]       AV-079: Anchor program — Signer<'info> and mut are enforced by the framework
[N/A]       AV-080: Anchor program — account count and layout are enforced by #[derive(Accounts)]; zero-copy loads are bounds-checked by bytemuck
[N/A]       AV-081: no unsafe blocks exist in the program (grep: zero matches)
[N/A]       AV-082: Anchor program — type disambiguation is by 8-byte discriminator (see AV-011)
[N/A]       AV-083: Pinocchio is not used
[N/A]       AV-084: no SPL Token logic is reimplemented; all token operations are CPIs to the canonical programs
[PASS]      AV-085: No instruction asserts or depends on an exact lamport balance; lamport movement happens only inside Anchor's init/close — see KV-123
[PASS]      AV-086: No builtin, sysvar or precompile account is marked mut; Program<System>, Program<Token>, Interface<TokenInterface> and Sysvar<Rent> are all read-only
[PASS]      AV-087: Every init target is either a program-owned PDA (not creatable by an attacker, since only this program can sign its seeds) or seeded by the caller's own key, so honest init cannot be front-run — handler_initialize_user.rs:78-83 (see KV-127)
[PASS]      AV-088: No unsafe deserialization — zero-copy loads go through bytemuck Pod with compile-time size assertions; the only manual byte access (utils/accessors.rs:3-16) reads fixed offsets of accounts Anchor has already typed as Mint / AccountLoader
```

*Checklist 01 totals: 90 items — PASS 42, FAIL 3, PARTIAL 15, N/A 30.*

### Checklist 02 — Access Control (50 items)

```
[PASS]      AC-001: Every value-moving instruction has a Signer — stake/unstake/withdraw_unstaked (owner), harvest (payer), add_rewards (payer), withdraw_reward/deposit_to_farm_vault (farm_admin), withdraw_from_farm_vault (withdraw_authority), withdraw_treasury (global_admin), withdraw_slashed_amount (crank)
[PARTIAL]   AC-002: Two instructions mutate state with no signer at all
              File: handler_refresh_farm.rs:33-40, handler_refresh_user_state.rs:28-40
              Improvement: this is intentional (permissionless cranks that only advance time-based accounting) but should be documented; refresh_farm also performs a one-way data fixup at handler_refresh_farm.rs:21-23
[PASS]      AC-003: Signers are linked to state — user_state has_one owner (handler_stake.rs:64), farm_state has_one farm_admin / withdraw_authority / delegate_authority / pending_farm_admin, global_config has_one global_admin / pending_global_admin
[PASS]      AC-004: No manual is_signer inspection exists; every authority is an Anchor Signer<'info>
[N/A]       AC-005: no manual is_signer checks exist (see AC-004)
[PASS]      AC-006: Admin instructions pair a Signer with a has_one — handler_withdraw_reward.rs:74-81, handler_initialize_reward.rs:46-55, handler_withdraw_treasury.rs:54-60
[PASS]      AC-007: User instructions pair owner: Signer with user_state has_one owner — handler_stake.rs:61-67, handler_unstake.rs:36-43, handler_withdraw_unstaked_deposits.rs:52-59
[N/A]       AC-008: the program never relies on an SPL token delegate; "delegate authority" here is a farm role, and vault delegates are explicitly rejected (AV-049)
[PASS]      AC-009: Acting on behalf of another user exists only through two explicit mechanisms — is_harvesting_permissionless (with a canonical-ATA constraint forcing proceeds to the owner, handler_harvest_reward.rs:104,128-134) and the delegated-farm authority set
[PARTIAL]   AC-010: One permissionless instruction moves value: withdraw_slashed_amount
              File: handler_withdraw_slashed_amount.rs:41-74
              Improvement: safe because the destination is pinned by has_one = slashed_amount_spill_address and the amount by slashed_amount_current; worth documenting as an intentional crank
[PASS]      AC-011: Roles are enumerable and each instruction maps to exactly one — see the Instruction Matrix (§6): global_admin, farm_admin, delegated_rps_admin, withdraw_authority, delegate_authority (+ second), user/owner, permissionless
[PARTIAL]   AC-012: Two instructions accept an OR of roles
              File: handler_update_farm_config.rs:19-30 (farm_admin OR delegated_rps_admin, for reward-rate modes only), handler_set_stake_delegated.rs:16-20 (delegate_authority OR second_delegated_authority)
              Improvement: both are deliberate; document the delegated_rps_admin's exact power (it can reach F-001 and F-003)
[PASS]      AC-013: Role escalation by account substitution is blocked — every admin instruction resolves the expected key from the FarmState/GlobalConfig being acted on, so supplying a different config only lets the caller administer their own
[PASS]      AC-014: A user cannot act on another user's position — user_state has_one owner plus PDA seeds [b"user", farm_state, delegatee]
[PASS]      AC-015: Admin is defined as a mutable on-chain pubkey field (global_admin, farm_admin), not a hardcoded key or the program authority — state.rs:25,69
[PASS]      AC-016: Admin powers are enumerated in §3 Trust Model: the farm admin configures everything and can appoint a withdraw_authority that removes principal (F-007); there is no pause (F-006)
[PASS]      AC-017: No god-mode path exists — every privileged instruction re-derives its authority from the specific account being modified; the global admin's reach is limited to its own GlobalConfig plus second_delegated_authority on farms that reference it
[PASS]      AC-018: The farm admin cannot impersonate a user — every user path requires user_state.owner to sign (or, in delegated farms, the delegate authority, which is the documented custodian)
[PASS]      AC-019: A user cannot impersonate an admin — all admin checks compare against the stored admin pubkey
[PASS]      AC-020: Each admin operates only on their own farm — every admin instruction takes the target farm_state and checks has_one/require_keys_eq against it
[PASS]      AC-021: Each user operates only on their own position (AC-014)
[PARTIAL]   AC-022: The withdraw authority can remove user principal directly
              File: handler_withdraw_from_farm_vault.rs:34-41
              Improvement: intentional (delegated custody) but unbounded and un-timelocked — see F-007
[PASS]      AC-023: Fee caps are enforced on-chain — treasury_fee_bps <= 10000 (farm_operations.rs:44-47), locking_early_withdrawal_penalty_bps <= 10000 (:229)
[PARTIAL]   AC-024: Fees can be changed at any time with no timelock and no notification
              File: farm_operations.rs:42-54 (treasury fee), :227-238 (penalty bps)
              Improvement: the treasury fee applies to rewards accrued before the change (see ECON-027)
[PASS]      AC-025: The treasury destination cannot be redirected — it is a PDA of [b"tvault", global_config, reward_mint] validated by seeds on every use — handler_harvest_reward.rs:149-151
[PARTIAL]   AC-026: The treasury vault address is immutable per (global_config, mint), but the global_admin who can sweep it is a mutable field
              File: state.rs:25,32; handler_update_global_config_admin.rs:5-18
              Improvement: two-step transfer exists; a timelock does not
[N/A]       AC-027: no minimum platform fee concept exists in this protocol
[PASS]      AC-028: Admin handover is two-step for both roles — pending_farm_admin → update_farm_admin (handler_update_farm_admin.rs:16), pending_global_admin → update_global_config_admin (handler_update_global_config_admin.rs:15)
[N/A]       AC-029: no program whitelist exists (no external CPI targets beyond SPL Token)
[FAIL-4]    AC-030: A pause flag exists but nothing reads it
              File: state.rs:96, farm_operations.rs:1017-1019
              Impact: no emergency stop; the only incident lever is a program upgrade
              Fix: enforce is_farm_frozen on deposit-side instructions and add a setter (see F-006)
[PASS]      AC-031: The only writer of is_farm_frozen is withdraw_from_farm_vault, itself gated on the withdraw authority — farm_operations.rs:1015-1019
[FAIL-4]    AC-032: The freeze does not prevent any value-moving operation
              File: repository-wide: is_farm_frozen has zero readers
              Impact: stake/unstake/harvest all proceed on a "frozen" farm; a new stake instead hits the assert_eq! panic at stake_operations.rs:325
              Fix: see F-006
[N/A]       AC-033: not applicable — the pause is not enforced (AC-032), so there is no paused-state fee behaviour to evaluate
[N/A]       AC-034: not applicable — the pause is not enforced (AC-032)
[PARTIAL]   AC-035: No functioning emergency stop exists
              File: state.rs:96 (flag declared, never read)
              Improvement: see F-006; recommended design is deposit-side-only pause so users can always exit
[N/A]       AC-036: the program controls no mint and therefore no freeze authority (third-party mint freeze risk is tracked under AV-065 / F-011)
[N/A]       AC-037: there is no shares mint — stake is internal accounting (total_active_stake_scaled), so no minting authority exists
[N/A]       AC-038: no shares mint exists (see AC-037)
[PASS]      AC-039: PDA front-running is impossible — user_state seeds include the caller's own key (and, for delegated farms, require the delegate authority's signature); all other PDAs require the farm admin — handler_initialize_user.rs:27-49,78-83
[PASS]      AC-040: Position creation is intentionally open on non-delegated farms (payer == owner == delegatee == authority) and restricted to the delegate authority on delegated farms — handler_initialize_user.rs:27-49
[PARTIAL]   AC-041: An attacker cannot block another user's withdrawal, but shared state can be wedged by privileged misconfiguration
              File: farm_operations.rs:785-789 (a matured, un-withdrawn pending withdrawal blocks further unstakes — self-inflicted and recoverable by withdrawing)
              Improvement: the real wedging risks are F-001/F-002/F-003/F-005, all admin-triggered
[PASS]      AC-042: An attacker cannot force-close another user's account — close_empty_user_state requires signer == user_state.owner (or the delegate authority on delegated farms) and all balances zero — handler_close_empty_user_state.rs:11-59
[PASS]      AC-043: Replay is prevented by Solana's recent-blockhash/nonce mechanism; the program holds no off-chain signature surface. reward_user_once additionally binds expected_rewards_issued_cumulative + user_state_id as an idempotency guard — handler_reward_user_once.rs:31-41
[PASS]      AC-044: On-chain rate limits exist — deposit_warmup_period, withdrawal_cooldown_period and min_claim_duration_seconds — farm_operations.rs:474-478, :799-801, :591-596
[PARTIAL]   AC-045: initialize_user can be spammed on a non-delegated farm
              File: handler_initialize_user.rs:78-83
              Improvement: each account costs the attacker ~0.0074 SOL of rent and only increments num_users; nothing iterates over users, so there is no protocol-side amplification. Bounded griefing only
[PASS]      AC-046: No instruction leaves an authority context that a later instruction could consume — every handler re-derives its authority from account state
[PASS]      AC-047: The only close (close_empty_user_state) does no post-close work, and a closed account cannot be re-read as valid state within the same transaction (discriminator is overwritten)
[PASS]      AC-048: The only CPI targets are SPL Token and Token-2022, which cannot call back into this program
[PASS]      AC-049: Re-entrancy is structurally impossible (no untrusted CPI target) and state mutations precede every CPI — handler_harvest_reward.rs:49-56 before :73-95
[PASS]      AC-050: invoke_signed seeds are [b"authority", farm_state] / [b"authority", global_config] plus the canonical bump — only this program can produce them — utils/macros.rs:10-17
```

*Checklist 02 totals: 50 items — PASS 30, FAIL 2, PARTIAL 9, N/A 9.*

### Checklist 03 — Arithmetic Safety (63 items)

```
[FAIL-5]    AR-001: Bare + on state/user-derived values in ~18 places
              File: state.rs:199,477; stake_operations.rs:352,354,403,405,475,476,566,578,601; farm_operations.rs:654,664,746,750,813,814,982,1049
              Impact: overflow aborts the VM (overflow-checks = true); in the reward-refresh path the abort is permanent (F-003)
              Fix: checked_add(..).ok_or(FarmError::MathOverflow)?, or saturating semantics in the refresh path
[FAIL-5]    AR-002: Bare - on state/user-derived values in ~15 places
              File: state.rs:204,476; stake_operations.rs:378,380,448,450,451,550,551,598,599; utils/withdrawal_penalty.rs:48,51,78; farm_operations.rs:544,550,649,926
              Impact: underflow aborts the VM; state.rs:204 is reachable from an oracle timestamp (F-013)
              Fix: checked_sub / saturating_sub with an explicit guard
[FAIL-5]    AR-003: Bare * on state/user-derived values
              File: state.rs:217,476; farm_operations.rs:572,644,821,890,920,1049; utils/withdrawal_penalty.rs:54; utils/math.rs:77,92
              Impact: the state.rs:476 and farm_operations.rs:890 products are the unrecoverable brick in F-003
              Fix: checked_mul / saturating_mul (see F-003)
[PARTIAL]   AR-004: No division uses checked_div; every divisor is structurally non-zero or guarded by an early return
              File: utils/math.rs:78,93; farm_operations.rs:895,920,977,979; stake_operations.rs:332
              Improvement: guards are correct today (BPS_DIV_FACTOR is a non-zero const, ten_pow >= 1, total_active_stake_scaled == 0 short-circuits at farm_operations.rs:871) but nothing prevents a future caller from passing 0 to u64_mul_div
[FAIL-5]    AR-005: Bare arithmetic operators are used on financial values throughout
              File: see AR-001/AR-002/AR-003
              Impact: abort-on-overflow DoS rather than wraparound, because Cargo.toml:6 sets overflow-checks = true
              Fix: convert to checked_* (F-003); do NOT rely on the profile flag as the only protection
[PARTIAL]   AR-006: saturating_add / saturating_sub appear on financial paths
              File: farm_operations.rs:666,749,752 (rewards_issued_cumulative), :832 (reward tally)
              Improvement: the cumulative counters are deliberately saturating (they are statistics, and reward_user_once explicitly checks for the u64::MAX ceiling at :741-744); the tally saturation at :832 is guarded by the require_gt! at :825-829. Document the intent
[PASS]      AR-007: No wrapping_add / wrapping_sub / wrapping_mul anywhere in the program
[PASS]      AR-008: Constant-only arithmetic is limited to size/seed constants — consts.rs:13-15, state.rs:17-21
[PASS]      AR-009: space is a compile-time constant (SIZE_USER_STATE) — handler_initialize_user.rs:82
[PASS]      AR-010: a*b/c patterns widen first — full_decimal_mul_div promotes U192 to U256 before multiplying (utils/math.rs:68-85); u64_mul_div promotes to U128 (:88-95)
[PASS]      AR-011: Share conversion is (total_stake * amount) / total_amount computed in Decimal/U192 — stake_operations.rs:332
[PASS]      AR-012: Fee computation u64_mul_div(reward, bps, 10000) widens to U128 — farm_operations.rs:614, utils/math.rs:88-95
[PASS]      AR-013: Proportional withdrawal u64_mul_div(total_active, req, vault) widens to U128 — stake_operations.rs:591-594
[PARTIAL]   AR-014: Downcasts use try_into/try_from, but the failure path is .unwrap()/.expect() (panic) rather than an error
              File: utils/math.rs:82,94; state.rs:219; farm_operations.rs:526,933
              Improvement: map_err to FarmError::MathOverflow (see F-010)
[PASS]      AR-015: No bare `as u64` on a u128 value exists in any value path; every narrowing goes through try_into (correctness verified at utils/math.rs:80-84,94; farm_operations.rs:933; state.rs:218-219)
[PASS]      AR-016: No u64→u32 truncation; the u32 config fields (deposit_warmup_period, withdrawal_cooldown_period) are only widened via .into() — farm_operations.rs:477, :800
[PASS]      AR-017: No `as i64` casts exist. The one i64→u64 cast (clock.unix_timestamp as u64, state.rs:731) widens a value that cannot be negative on a live cluster
[PARTIAL]   AR-018: Divisor-zero safety relies on structure, not on explicit checks
              File: utils/math.rs:78,93 (no c != 0 guard inside u64_mul_div / full_decimal_mul_div)
              Improvement: all current call sites pass a non-zero divisor (see AR-004); add an explicit require! inside the helpers so the property is local
[PASS]      AR-019: Reward-per-share division is guarded — refresh_global_reward returns early when total_active_stake_scaled == 0 — farm_operations.rs:871-876
[PASS]      AR-020: Both conversion helpers guard the zero-denominator case explicitly — stake_operations.rs:299-307, :322-333
[PARTIAL]   AR-021: Conversions can truncate to zero with no minimum-output requirement
              File: stake_operations.rs:441-446 (unstake floors), :371-376
              Improvement: a dust unstake burns shares for a 0-token payout; consider require!(unstaked_amount > 0) on the user-facing path
[PASS]      AR-022: Deposit→share conversion truncates downward, favouring the pool — stake_operations.rs:332 (Decimal division truncates)
[PARTIAL]   AR-023: Redemption also rounds DOWN (protocol-favouring) rather than user-favouring
              File: stake_operations.rs:441-446, :543-548 (round_up = false)
              Improvement: this is the solvency-safe direction and is the right call; the residual dust accumulates in the pool with no sweep path (see ECON-082)
[PASS]      AR-024: Dust rounding always favours the pool, so a repeated stake/unstake loop loses value for the attacker — no extraction path exists
[PASS]      AR-025: First depositor cannot manipulate the initial rate: total_stake == 0 yields a 1:1 Decimal ratio (stake_operations.rs:322-330) and no permissionless donation path exists to move it afterwards (see KV-006/KV-017)
[PASS]      AR-026: Share minting formula verified correct: gained = total_stake * amount / total_amount — stake_operations.rs:318-334
[PASS]      AR-027: The zero-supply case uses a 1:1 ratio with an explicit assertion that the counterpart is also zero — stake_operations.rs:322-330
[PASS]      AR-028: Share burning formula verified correct: amount = full_decimal_mul_div(stake, total_amount, total_stake) — stake_operations.rs:289-314
[PARTIAL]   AR-029: No min_shares_out slippage parameter exists on stake
              File: handler_stake.rs:13-38
              Improvement: the active-pool exchange rate is invariant under every permissionless operation (stake and unstake move amount and shares together), so the only mover is an admin deposit_to_farm_vault / withdraw_from_farm_vault; a slippage bound would still protect users against that race
[PARTIAL]   AR-030: No min_assets_out parameter exists on unstake
              File: handler_unstake.rs:11-32 — same reasoning as AR-029
[PASS]      AR-031: Inflation-by-donation is not possible — share value is computed from tracked totals, never from farm_vault.amount, and the only path that raises the tracked total without shares (deposit_to_farm_vault) requires the farm admin — handler_deposit_to_farm_vault.rs:35
[PARTIAL]   AR-032: A withdrawal that makes remaining shares worth less is possible, but only by the withdraw authority
              File: stake_operations.rs:591-601 (pro-rata reduction of total_active_amount)
              Improvement: intentional; see F-007
[PASS]      AR-033: total_active_stake_scaled == Σ user.active_stake_scaled holds by construction — every mutation goes through stake_operations, which updates the user and farm sides in the same function under the Drop-based accessor pattern (stake_operations.rs:190-194, :236-240)
[N/A]       AR-034: there is no shares mint, so there is no mint supply to reconcile (see AC-037)
[N/A]       AR-035: no management fee exists
[N/A]       AR-036: no performance fee exists
[PARTIAL]   AR-037: The treasury fee is correct and widened but uses no checked math and floors
              File: farm_operations.rs:614 (u64_mul_div), utils/math.rs:88-95 (.expect() on the narrowing)
              Improvement: bounded by construction (bps <= 10000 ⇒ result <= reward), so the expect() is unreachable; rounding direction favours the user by <1 unit
[PASS]      AR-038: The split is exact: reward_user = reward - reward_treasury with checked_sub — farm_operations.rs:614-617
[PASS]      AR-039: fee_bps <= 10000 is enforced at write time — farm_operations.rs:44-47
[N/A]       AR-040: no minimum platform fee concept exists
[PASS]      AR-041: Fee ordering is unambiguous — the user's accrual is computed first (farm_operations.rs:588-609), then the fee is split out of that reward (:614-617); share math is untouched
[PASS]      AR-042: No fee-on-fee: the treasury fee is charged once, on newly-issued rewards only, and harvested rewards leave the accounting entirely
[PASS]      AR-043: Zero-amount transfers are skipped rather than issued — handler_harvest_reward.rs:73,85; handler_withdraw_unstaked_deposits.rs:36; handler_withdraw_slashed_amount.rs:27
[N/A]       AR-044: no NAV concept — the protocol tracks token amounts directly, not a portfolio valuation
[N/A]       AR-045: no NAV concept (see AR-044)
[N/A]       AR-046: no NAV concept (see AR-044)
[N/A]       AR-047: no NAV concept; the Scope price scales only the deposit cap and reward issuance, never user share value
[N/A]       AR-048: no NAV concept (see AR-047)
[N/A]       AR-049: no NAV attestation PDA exists; the Scope account is validated by key equality — utils/scope.rs:18-20
[N/A]       AR-050: no NAV concept; oracle staleness is covered by ECON-058 / F-005
[PASS]      AR-051: All lamport and token amounts are u64 end to end; no narrower type is used for value
[N/A]       AR-052: the program performs no direct lamport transfers — only Anchor's init (rent) and close (refund)
[PASS]      AR-053: Rent exemption is maintained by construction — Anchor's init funds it and only close (which deletes the account) removes it
[PASS]      AR-054: The only lamport drain is close_empty_user_state, which closes the account entirely — handler_close_empty_user_state.rs:71-76
[N/A]       AR-055: no WSOL wrapping/unwrapping exists
[PARTIAL]   AR-056: u64::MAX is a documented sentinel on stake (means "all of user_ata.amount") but is unguarded elsewhere
              File: handler_stake.rs:22-27 (sentinel), state.rs:199 (total_staked_amount + amount panics for a near-MAX amount before any balance check)
              Improvement: bound `amount` against user_ata.amount early, or use checked_add in can_accept_deposit (see F-003)
[PASS]      AR-057: Zero is explicitly rejected or short-circuited on every path — StakeZero (handler_stake.rs:14), UnstakeZero (handler_unstake.rs:12), DepositZero (handler_deposit_to_farm_vault.rs:12), NothingToWithdraw (handler_withdraw_treasury.rs:46), NothingToUnstake (farm_operations.rs:776-779), and zero-amount CPIs are skipped (AR-043)
[PASS]      AR-058: One-unit amounts behave correctly — shares are WAD-scaled (1e18), so a 1-token stake produces 1e18 scaled units, far from truncation
[PASS]      AR-059: The last remaining staker receives the full remaining amount — convert_stake_to_amount with stake == total_stake yields total_amount exactly — stake_operations.rs:299-307
[PARTIAL]   AR-060: There is no batch/aggregate operation, so a mass exit is N independent transactions
              File: n/a (by design)
              Improvement: the real mass-failure mode is the shared refresh path — a single bricked reward index blocks every user at once (F-001/F-003)
[FAIL-3]    AR-061: Timestamp arithmetic underflows on a future-dated oracle price
              File: state.rs:204, farm_operations.rs:906
              Impact: `ts - price.unix_timestamp` aborts the transaction whenever the feed is ahead of the validator clock
              Fix: use saturating_sub and compare (see F-013)
[PASS]      AR-062: Only one fee component applies per path (treasury fee on rewards; early-withdrawal penalty on unstake), each independently capped at 10000 bps; they never apply to the same amount, so no sum-over-denominator case exists
[PASS]      AR-063: No f32/f64, powf, sqrt, ln, exp or float casts appear anywhere in the program — all math is fixed-point (decimal_wad Decimal / U192 / U256) with integer arithmetic
```

*Checklist 03 totals: 63 items — PASS 33, FAIL 5, PARTIAL 12, N/A 13.*

### Checklist 04 — CPI & PDA Safety (70 items)

```
[N/A]       CPI-001: Anchor 0.29 (not 1.0) — CpiContext::new takes an AccountInfo by design in this version; the Pubkey-first signature does not exist yet — token_operations.rs:24,45,61
[N/A]       CPI-002: new_with_signer is not used; the equivalent .with_signer(seeds) builder is — token_operations.rs:24,45
[PASS]      CPI-003: SPL Token CPIs are constrained to the real program via Program<'info, Token> / Interface<'info, TokenInterface> plus per-account token::token_program — handler_stake.rs:97, handler_harvest_reward.rs:127,145,155,169
[PASS]      CPI-004: The System program is typed Program<'info, System> everywhere it appears — handler_initialize_user.rs:89, handler_initialize_farm.rs:71
[N/A]       CPI-005: no Associated Token Program CPI — ATAs are only derived for comparison (handler_harvest_reward.rs:194), never created
[N/A]       CPI-006: no DEX / aggregator CPI exists
[N/A]       CPI-007: no Metaplex CPI exists
[PASS]      CPI-008: No CPI uses an UncheckedAccount as the invoked program; every target is a typed Program/Interface account
[N/A]       CPI-009: remaining_accounts are rejected, so none are forwarded to a CPI
[N/A]       CPI-010: no raw invoke/invoke_signed is used; all CPIs go through anchor_spl helpers
[PASS]      CPI-011: transfer `from` is always the intended source — the PDA vault for outbound transfers (token_operations.rs:20,40) and the signer's own ATA for inbound (:57, handler_stake.rs:49)
[PASS]      CPI-012: transfer `to` is always constrained — user_reward_token_account (token::authority = user_state.owner), farm_vault (PDA + has_one), rewards_treasury_vault (PDA seeds), slashed_amount_spill_address (has_one)
[PASS]      CPI-013: transfer `authority` is the correct PDA (farm_vaults_authority / treasury_vault_authority, both has_one- or seeds-validated) or the user signer — handler_withdraw_unstaked_deposits.rs:42, handler_withdraw_treasury.rs:41
[PASS]      CPI-014: transfer `amount` is always a value computed by farm_operations from validated state, never a raw instruction argument on outbound paths — handler_harvest_reward.rs:46-56,73-95
[N/A]       CPI-015: no mint_to CPI — the program owns no mint
[N/A]       CPI-016: no mint_to CPI (see CPI-015)
[N/A]       CPI-017: no mint_to CPI (see CPI-015)
[N/A]       CPI-018: no mint_to CPI (see CPI-015)
[N/A]       CPI-019: no burn CPI exists
[N/A]       CPI-020: no burn CPI exists
[N/A]       CPI-021: no burn CPI exists
[N/A]       CPI-022: no close_account CPI exists (the only closure is Anchor's account close, not a token-account close)
[N/A]       CPI-023: no close_account CPI exists
[N/A]       CPI-024: no close_account CPI exists — the vault can never be closed by this program
[N/A]       CPI-025: no system_program::transfer CPI beyond Anchor's init/close machinery
[N/A]       CPI-026: no approve CPI exists (delegates are rejected, not granted)
[N/A]       CPI-027: no revoke CPI exists
[PASS]      PDA-001: Every PDA includes the discriminating parent key — user_state includes farm_state and delegatee; the vaults include farm_state/global_config and the mint — consts.rs:5-10
[N/A]       PDA-002: the fund-equivalent account (FarmState) is not a PDA — it is a caller-created, zero-initialised account (handler_initialize_farm.rs:47), so no seed set applies
[PASS]      PDA-003: The complete PDA inventory is enumerated in §7 (6 families) with seeds verified at every use site
[PASS]      PDA-004: Seed order is identical at init and at every later reference — compare handler_initialize_farm.rs:54 with handler_stake.rs:75, handler_withdraw_unstaked_deposits.rs:75, handler_deposit_to_farm_vault.rs:44
[PASS]      PDA-005: Vault/treasury PDAs include the parent key — [b"fvault", farm_state, mint], [b"rvault", farm_state, reward_mint], [b"tvault", global_config, reward_mint]
[N/A]       PDA-006: no mint is created by the program, so there is no mint PDA
[N/A]       PDA-007: no attestation/oracle PDA is derived; the Scope account is an externally-owned account matched by key
[N/A]       PDA-008: no whitelist/role/permission PDA exists — roles are pubkey fields in FarmState/GlobalConfig
[PASS]      PDA-009: No mismatch between derivation and usage was found for any of the six PDA families (verified site by site)
[PARTIAL]   PDA-010: Bumps are stored but constraints re-derive rather than reuse
              File: handler_stake.rs:76, handler_harvest_reward.rs:140,151,162 (bare `bump`)
              Improvement: `bump = farm_state.load()?.farm_vaults_authority_bump as u8` saves ~1.5k CU per derivation; correctness is unaffected (see AV-028)
[PASS]      PDA-011: No seed uses variable-length user data — all seeds are fixed byte literals plus 32-byte pubkeys
[N/A]       PDA-012: no name/string seed exists, so no truncation collision is possible
[PASS]      PDA-013: No seed component is mutable — farm_state.token.mint is written once at init and never updated (no FarmConfigOption touches TokenInfo)
[PASS]      PDA-014: invoke_signed seeds match the authority PDA exactly — gen_signer_seeds_two!(BASE_SEED_FARM_VAULTS_AUTHORITY, farm_state_key, bump) vs the seeds constraint — utils/macros.rs:10-17, handler_harvest_reward.rs:67-71,161-163
[PASS]      PDA-015: Seed array order and components match the derivation in all five signing sites (harvest, withdraw_reward, withdraw_unstaked_deposits, withdraw_from_farm_vault, withdraw_slashed_amount) and in withdraw_treasury (which uses ctx.bumps directly, handler_withdraw_treasury.rs:22-26)
[PASS]      PDA-016: The bump used for signing is the stored canonical bump captured from ctx.bumps at init — handler_initialize_farm.rs:19, handler_initialize_global_config.rs:15
[PASS]      PDA-017: invoke_signed (via .with_signer) is used for every PDA-authority transfer — token_operations.rs:24,45
[PASS]      PDA-018: No CPI that needs PDA signing uses a bare invoke — transfer_from_user (token_operations.rs:61) correctly omits the signer because the user signs
[PASS]      PDA-019: Instruction data for every CPI is constructed by anchor_spl from program-computed amounts; the caller cannot alter the operation
[N/A]       PDA-020: no Jupiter/aggregator CPI exists
[N/A]       PDA-021: no realloc is used (neither growth nor shrink), so neither the zero-init nor the rent-payer sub-check applies
[N/A]       EXT-001: no Jupiter CPI
[N/A]       EXT-002: no Jupiter CPI
[N/A]       EXT-003: no Jupiter CPI
[N/A]       EXT-004: no Jupiter CPI
[N/A]       EXT-005: no Jupiter CPI
[N/A]       EXT-006: no Jupiter CPI
[N/A]       EXT-007: no Metaplex CPI
[N/A]       EXT-008: no Metaplex CPI
[N/A]       EXT-009: no protocol-whitelist CPI exists
[N/A]       EXT-010: no protocol-whitelist CPI exists
[PASS]      EXT-011: The only CPI targets are SPL Token and Token-2022; neither can call back into this program with elevated privileges
[PASS]      EXT-012: Transfer-hook mints are rejected outright — a hook program id must be unset — utils/constraints.rs:75-85
[PARTIAL]   EXT-013: Extensions are inspected but the allowlist admits PermanentDelegate and MintCloseAuthority, and freeze_authority is never read
              File: utils/constraints.rs:34-44
              Improvement: see F-011
[PARTIAL]   EXT-014: transfer_checked is used on all Token-2022/reward paths, but base-token movement uses legacy token::transfer and credit is the declared amount rather than a balance delta
              File: token_operations.rs:18-26,56-65; farm_operations.rs:104-107
              Improvement: safe today (transfer-fee mints rejected; base mint pinned to classic SPL) — see AV-060/AV-062
[N/A]       EXT-015: the program creates no mint, so there is no metadata to claim
[PASS]      RE-001: Checks-effects-interactions is respected everywhere — harvest zeroes the user's unclaimed rewards (farm_operations.rs:604-610) before the transfer CPI (handler_harvest_reward.rs:73-95); stake updates accounting (farm_operations.rs:479-497) before pulling tokens (handler_stake.rs:46-54); the same holds for unstake/withdraw/deposit/withdraw_reward/withdraw_treasury
[PASS]      RE-002: No account state is read after a CPI in any handler — the CPI is always the final action
[N/A]       RE-003: no post-CPI reload is required because no post-CPI state read occurs (see RE-002)
[PASS]      RE-004: No approve/delegation CPI is issued; delegates are rejected on the vaults (AV-049)
[PASS]      RE-005: Flash-loan resistant — refresh_global_reward short-circuits when ts == last_issuance_ts (farm_operations.rs:867-869), so an atomic stake→unstake in one slot accrues zero rewards; share value is not oracle-priced, so nothing can be inflated within a transaction
[PASS]      RE-006: No signing account is handed to an untrusted CPI callee — the only CPI targets are SPL Token/Token-2022, and the only signers passed are the user (for their own transfer) and program PDAs
[PASS]      RE-007: No account's owner is relied upon after a CPI (see RE-002); Anchor re-validates on every instruction entry
```

*Checklist 04 totals: 70 items — PASS 28, FAIL 0, PARTIAL 3, N/A 39.*

### Checklist 05 — State Machine & Lifecycle (72 items)

```
[PASS]      SM-001: State enums enumerated — GlobalConfigOption (state.rs:55-58), FarmConfigOption (:665-691), TimeUnit (:697-700), RewardType (:706-709), LockingMode (:715-719); plus four u8 flag fields (is_farm_frozen, is_farm_delegated, is_reward_user_once_enabled, is_harvesting_permissionless) and the implicit user stake lifecycle
[PASS]      SM-002: All variants listed in §7 (State Model). LockingMode {None, Continuous, WithExpiry}; RewardType {Proportional, Constant}; TimeUnit {Seconds, Slots}; FarmConfigOption has 25 variants; GlobalConfigOption has 2
[PARTIAL]   SM-003: One enum variant has no instruction that transitions into it
              File: state.rs:699 — TimeUnit::Slots; no FarmConfigOption writes FarmState::time_unit, and both init handlers leave the zeroed value
              Improvement: add a setter or remove the variant (the whole program is therefore Seconds-only, which also makes the oracle timestamp comparison well-typed — see F-013)
[PARTIAL]   SM-004: is_farm_frozen has no transition out
              File: farm_operations.rs:1017-1019 sets it; nothing clears it, and nothing reads it
              Improvement: see F-006
[PARTIAL]   SM-005: Dead variant identified: TimeUnit::Slots (see SM-003). Dead code, no security impact — also listed under Notes & Nitpicks
[PASS]      SM-006: Dead variants cannot be set externally — all three account types are program-owned zero-copy accounts with Anchor discriminators; no user can write raw bytes
[PASS]      SM-007: Terminal states are identifiable — a frozen farm (is_farm_frozen = 1, farm_operations.rs:1018) and a closed UserState (handler_close_empty_user_state.rs:73)
[PARTIAL]   SM-008: One terminal state leaves a zombie account
              File: farm_operations.rs:1017-1019 — a frozen farm is never closed; FarmState (8336 B) and GlobalConfig (2136 B) have no close instruction, so their rent is locked permanently
              Improvement: add an admin-gated close_farm requiring zero stake, zero pending and zero rewards outstanding
[PASS]      SM-009: Withdrawal initiation = unstake: it moves active stake into the pending-withdrawal pool and stamps pending_withdrawal_unstake_ts — farm_operations.rs:799-804
[PASS]      SM-010: Initiation requires the owner's signature and sufficient stake — handler_unstake.rs:36-43; amount is min()'d against the user's active stake and must be > 0 (farm_operations.rs:772-779)
[N/A]       SM-011: there is no swap/conversion step in the withdrawal flow — the asset never changes
[N/A]       SM-012: no multi-status swap step exists (see SM-011)
[PASS]      SM-013: The readiness transition exists and is purely time-based: pending_withdrawal_unstake_ts <= ts — farm_operations.rs:845-848
[PASS]      SM-014: The readiness step is not missing — it is implicit and requires no third-party action, which removes the classic "stuck withdrawal" griefing vector
[PASS]      SM-015: Finalization requires the cooldown to have elapsed and a non-zero pending balance — farm_operations.rs:845-852
[PASS]      SM-016: There is no separate withdrawal account to close; the pending state lives in UserState, and rent is reclaimed via close_empty_user_state — handler_close_empty_user_state.rs:71-76
[PASS]      SM-017: Finalization transfers tokens and zeroes the pending stake atomically — stake_operations.rs:535-556 then handler_withdraw_unstaked_deposits.rs:36-45
[N/A]       SM-018: there is no cancellation instruction — an initiated unstake can only be completed, by design (re-staking requires withdrawing first)
[N/A]       SM-019: no cancellation path (see SM-018)
[N/A]       SM-020: no cancellation path (see SM-018)
[PASS]      SM-021: Uniqueness is enforced — a second unstake extends the existing pending withdrawal, and an already-matured, un-withdrawn one is rejected with PendingWithdrawalNotWithdrawnYet — farm_operations.rs:785-797
[PARTIAL]   SM-022: A pending withdrawal has no expiry
              File: farm_operations.rs:840-857
              Improvement: funds can sit in the pending pool indefinitely earning nothing; harmless but undiscoverable without events (F-014)
[PASS]      SM-023: A withdrawal cannot be stuck by an admin — no privileged step advances it; only the clock does (SM-013)
[PASS]      SM-024: Partial unstake is supported — the user passes the share amount and it is min()'d against their balance — farm_operations.rs:772-775
[PASS]      SM-025: initialize_farm sets every field it needs and leaves the rest zeroed by #[account(zero)] — handler_initialize_farm.rs:13-31 (note the scope_oracle_max_age consequence in F-005)
[PASS]      SM-026: Admin, global config, vault, authority, bump, token info and reward slots are all initialised explicitly — handler_initialize_farm.rs:15-30
[PASS]      SM-027: Re-initialization is impossible — #[account(zero)] plus load_init, which rejects a non-zero discriminator — handler_initialize_farm.rs:13,47
[N/A]       SM-028: no farm-closure instruction exists (see SM-008)
[N/A]       SM-029: no farm-closure instruction exists
[N/A]       SM-030: no farm-closure instruction exists
[PARTIAL]   SM-031: Farms and global configs live forever, locking rent
              File: handler_initialize_farm.rs:47, handler_initialize_global_config.rs:25
              Improvement: informational — ~0.058 SOL per FarmState, ~0.015 SOL per GlobalConfig
[N/A]       SM-032: FarmState is not a PDA and has no name seed, so two farms cannot collide (each is a distinct keypair account)
[PASS]      SM-033: Deposit lifecycle verified: stake → (warmup ? pending_deposit : active) → shares credited → tokens pulled — farm_operations.rs:474-501, handler_stake.rs:46-54
[PASS]      SM-034: The user's stake increases by exactly the converted share amount, and the farm total by the same value, inside one accessor scope — stake_operations.rs:389-409
[PASS]      SM-035: Position creation is an explicit instruction (initialize_user) rather than an implicit side effect, with PDA seeds tying it to the farm and the delegatee — handler_initialize_user.rs:78-83
[PARTIAL]   SM-036: UserState tracks stake, pending stake and rewards, but not total_deposited / total_withdrawn
              File: state.rs:496-544
              Improvement: combined with the absence of events (F-014), off-chain accounting must diff account snapshots
[PARTIAL]   SM-037: Position closure is manual, not automatic
              File: handler_close_empty_user_state.rs:5-61
              Improvement: a fully-exited user keeps paying rent until they remember to close; acceptable, but worth surfacing in the UI
[PASS]      SM-038: Stake cannot go negative — Decimal subtraction is preceded by a min() clamp (farm_operations.rs:772-775) and an explicit bound check (stake_operations.rs:433-438)
[PASS]      SM-039: Stake and its bookkeeping are updated atomically through the Drop-based accessor pattern, which writes user and farm state together — stake_operations.rs:190-194,236-240
[PASS]      SM-040: A zero-stake position is valid and inert — user_refresh_all_rewards skips it (farm_operations.rs:675) and every operation on it is a no-op or a clean error
[PASS]      SM-041: Every transition checks its precondition — unstake checks the pending-withdrawal state (farm_operations.rs:785-789), withdraw checks maturity (:845-848), close checks all balances (handler_close_empty_user_state.rs:11-32)
[PASS]      SM-042: The cooldown cannot be skipped — pending_withdrawal_unstake_ts is written from the clock plus the configured period and compared against the clock on withdrawal
[PASS]      SM-043: Transitions are atomic within a Solana transaction; a failure reverts all account writes
[PASS]      SM-044: No partial-state window exists — all state writes precede the CPI, and a CPI failure reverts everything (RE-001)
[PASS]      SM-045: Replay is prevented — withdraw_unstaked_deposits zeroes pending_withdrawal_unstake_scaled (stake_operations.rs:553) so a second call hits NothingToWithdraw; harvest zeroes rewards_issued_unclaimed (farm_operations.rs:609)
[PASS]      SM-046: PDA reuse after close is safe — initialize_user overwrites every field and assigns a fresh user_id (farm_operations.rs:389-412); stale associations cannot survive because load_init requires a zeroed discriminator
[FAIL-2]    SM-047: No financial state transition emits an event
              File: program-wide — zero occurrences of emit!/#[event]/emit_cpi
              Impact: stakes, unstakes, harvests, fee transfers, vault drains and authority changes have no machine-parseable record
              Fix: add Anchor events (see F-014)
[FAIL-2]    SM-048: No event payloads exist at all
              File: program-wide (see SM-047)
              Impact: amounts, parties and timestamps must be recovered by decoding instruction data or diffing accounts
              Fix: see F-014
[PASS]      SM-049: The msg!/xmsg! log output that does exist is emitted by program execution and cannot be forged within this program's own transactions (the cross-program lookalike risk is KV-122)
[FAIL-2]    SM-050: Off-chain reconstruction cannot rely on events
              File: program-wide (see SM-047)
              Impact: indexers must parse free-form log text — the spoofable surface described by KV-122
              Fix: see F-014
[N/A]       SM-051: there is no shares mint, so no mint-supply invariant exists (stake is internal accounting only)
[PASS]      SM-052: total_active_stake_scaled == Σ user.active_stake_scaled and total_pending_stake_scaled == Σ user pending stakes hold by construction — every mutation passes through stake_operations, which updates both sides inside one accessor scope (stake_operations.rs:338-409,424-479,535-556)
[PARTIAL]   SM-053: The vault-balance invariant holds for tracked flows but is never asserted, and untracked inflows are unrecoverable
              File: stake_operations.rs:560-568,572-609
              Improvement: farm_vault.amount >= total_staked_amount + total_pending_amount + slashed_amount_current holds; tokens transferred directly to farm_vault are never credited (safe) and can never be swept (see ECON-082)
[PASS]      SM-054: After a deposit both the share total and the amount total increase in the same call — stake_operations.rs:397-406
[PASS]      SM-055: After a withdrawal both decrease together — stake_operations.rs:441-451 and :543-551
[N/A]       SM-056: no swap operation exists
[PARTIAL]   SM-057: A zero timestamp is used as a live value, not as a guarded sentinel
              File: state.rs:135 (locking_start_timestamp) consumed at utils/withdrawal_penalty.rs:66 as `locking_start + locking_duration`
              Improvement: a farm left at locking_start_timestamp = 0 in WithExpiry mode anchors maturity to 1970, so `timestamp_now >= timestamp_maturity` is always true and the early-withdrawal penalty silently never applies; require a non-zero, near-present start when locking_mode != None
[PASS]      SM-058: The one genuine sentinel is handled by an explicit branch, not by arithmetic — scope_oracle_price_id == u64::MAX short-circuits the whole oracle path (utils/scope.rs:10-11, state.rs:200, farm_operations.rs:898)
[N/A]       SM-059: there is no multi-path terminal cleanup to centralise — the only terminal transition (farm freeze) has exactly one entry point
[PARTIAL]   SM-060: The single terminal state has one entry path and no cleanup or enforcement
              File: farm_operations.rs:1017-1019
              Improvement: see F-006
[PARTIAL]   SM-061: Draining and zeroing happen together, but there is no post-drain backing check
              File: stake_operations.rs:578-589 (zeroes both pools and returns the full amount)
              Improvement: assert the resulting farm_vault.amount against slashed_amount_current after the transfer, and refuse a full drain while pending user withdrawals exist (ECON-084)
[N/A]       SM-062: no paired opposite-permission time gate exists (the cooldown gate is single-sided)
[N/A]       SM-063: no paired time gate (see SM-062)
[PARTIAL]   SM-064: Transitions are validated by exclusion-style guards rather than an allowlist matrix
              File: handler_unstake.rs:21, handler_stake.rs:30, handler_withdraw_unstaked_deposits.rs:21 (`require!(!farm_state.is_delegated())`)
              Improvement: adequate for this small state space, but the frozen state is not part of any guard (F-006)
[PARTIAL]   SM-065: The terminal frozen state is not absorbing because it is not enforced at all
              File: state.rs:96 (no readers)
              Improvement: see F-006
[PASS]      SM-066: Authorization is not a substitute for transition validation — even the delegate authority's set_stake enforces the structural preconditions (zero pending pools, zero warmup/cooldown) before mutating — farm_operations.rs:514-521
[PASS]      SM-067: No primary transition blindly resets a secondary flag — refresh_farm recomputes is_farm_delegated from the authoritative delegate_authority field rather than overwriting it with a constant — handler_refresh_farm.rs:18
[PASS]      SM-068: The only fixed-slot collection is reward_infos[10], and every iteration is `0..num_reward_tokens` with no early break on an empty slot (farm_operations.rs:568,676,816,997,1043). Slots are append-only — initialize_reward always writes index num_reward_tokens and increments (farm_operations.rs:67-86) — so no gap can ever form
[PASS]      SM-069: No cached aggregate is read stale — total_staked_amount / total_active_stake_scaled / total_pending_* are updated in the same function as every contributing mutation (stake_operations.rs:281-287), and reward_per_share is flushed by refresh_global_rewards before any stake change on every path (ECON-065)
[PARTIAL]   SM-070: Elapsed-time subtraction is guarded in the locking math but not in the oracle/reward math
              File: guarded — utils/withdrawal_penalty.rs:10-32 (both `now < beginning` and `maturity < beginning` return early); unguarded — state.rs:204, farm_operations.rs:906,926
              Improvement: see F-013
[PASS]      SM-071: Time units are consistent end to end — every timestamp derives from TimeUnit::now_from_clock (state.rs:727-735), and because time_unit is permanently Seconds (SM-003) all comparisons, including the oracle's unix_timestamp, share one unit
[N/A]       SM-072: there is no cliff/linear vesting schedule; the closest analogue (the early-withdrawal penalty) is a linear decay validated separately at utils/withdrawal_penalty.rs:48-56
```

*Checklist 05 totals: 72 items — PASS 39, FAIL 3, PARTIAL 15, N/A 15.*

### Checklist 06 — Economic & Logic Attacks (89 items)

```
[PASS]      ECON-001: There is no NAV to inflate — share value derives from tracked token totals, and a flash-borrowed deposit converts at exactly the prevailing 1:1-equivalent rate; rewards accrue only when the clock advances (farm_operations.rs:867-869)
[PARTIAL]   ECON-002: No mandatory cooldown exists between deposit and withdrawal
              File: state.rs:115-117 — deposit_warmup_period and withdrawal_cooldown_period both default to 0
              Improvement: an atomic stake→unstake→withdraw is possible on a default-configured farm; no profit path was found (rewards require elapsed time), but the atomicity is available to any future value-bearing addition
[PASS]      ECON-003: Stake is credited immediately, but it earns nothing until `ts` advances past last_issuance_ts, which is the property that matters — farm_operations.rs:867-869
[PARTIAL]   ECON-004: Stake is internal state, not a transferable token, so it cannot be used as collateral elsewhere; transfer_ownership does move a whole position atomically
              File: handler_transfer_ownership.rs:19-149
              Improvement: no exploit path found — the transfer is owner-signed and value-preserving (require_eq! at :136-140)
[N/A]       ECON-005: no NAV attestation mechanism exists
[N/A]       ECON-006: no swap instruction exists
[N/A]       ECON-007: no swap instruction exists
[N/A]       ECON-008: no swap route/slippage data is accepted
[PASS]      ECON-009: Deposits cannot be sandwiched — the share↔amount rate is invariant under every permissionless operation (stake and unstake move shares and amounts together, stake_operations.rs:397-406,441-451)
[PASS]      ECON-010: Withdrawals cannot be sandwiched — same invariance as ECON-009; no price is read at withdrawal time
[PARTIAL]   ECON-011: No minimum deposit is enforced
              File: handler_stake.rs:14 (only `amount != 0`)
              Improvement: dust stakes are harmless here (no per-user iteration exists), but see ECON-054 for the account-bloat angle
[PARTIAL]   ECON-012: No minimum withdrawal is enforced
              File: handler_unstake.rs:12 (only `amount != 0`)
              Improvement: a dust unstake can floor to a 0-token payout while burning shares (AR-021)
[PASS]      ECON-013: With zero shares and zero assets the first deposit converts 1:1 — stake_operations.rs:322-330
[PASS]      ECON-014: The donate-then-dilute sequence is unavailable: the only instruction that raises the tracked amount without issuing shares is deposit_to_farm_vault, gated on `address = farm_state.farm_admin` — handler_deposit_to_farm_vault.rs:35
[PARTIAL]   ECON-015: No minimum first deposit is required
              File: stake_operations.rs:318-334
              Improvement: mitigated entirely by the absence of a donation path (ECON-014); add a minimum if that ever changes
[PARTIAL]   ECON-016: No virtual/dead-share offset exists
              File: stake_operations.rs:322-330
              Improvement: same mitigation and same caveat as ECON-015 (also noted under Notes & Nitpicks)
[PASS]      ECON-017: The share price at creation is exactly 1:1 with the deposit — Decimal::from(amount) — stake_operations.rs:330
[N/A]       ECON-018: no NAV is attested by anyone — the protocol tracks raw token amounts
[N/A]       ECON-019: no NAV attestation (see ECON-018)
[N/A]       ECON-020: no NAV attestation (see ECON-018)
[N/A]       ECON-021: no NAV attestation (see ECON-018)
[N/A]       ECON-022: no NAV attestation (see ECON-018)
[N/A]       ECON-023: no NAV concept; a zero total_amount is handled explicitly in both conversion helpers (stake_operations.rs:299-307,322-330)
[N/A]       ECON-024: no NAV concept; the analogous overflow risk in the oracle-scaled cap is covered by AR-003 / F-003
[N/A]       ECON-025: no NAV concept; oracle staleness is covered by ECON-058 / F-005
[PASS]      ECON-026: The maximum fee is enforced on-chain at write time — treasury_fee_bps <= 10000 — farm_operations.rs:44-47
[PARTIAL]   ECON-027: The treasury fee can be changed at any time and applies to rewards that accrued before the change
              File: farm_operations.rs:42-54; the fee is read at claim time (:614), not at accrual time
              Improvement: a fee raised just before a large harvest retroactively taxes already-earned rewards; snapshot the fee at accrual or timelock the change
[PARTIAL]   ECON-028: There is no timelock on fee changes
              File: handler_update_global_config.rs:9-21
              Improvement: users cannot exit ahead of a fee increase (and would not see it — F-014)
[N/A]       ECON-029: there is no volume- or trade-based fee to wash
[PASS]      ECON-030: The treasury fee is charged per harvest on the issued reward, not as a time-proportional levy on principal — farm_operations.rs:614
[N/A]       ECON-031: no performance fee and no high-water mark exist
[PASS]      ECON-032: Fee extraction happens after the user's reward is computed and does not touch share math — farm_operations.rs:588-621
[PARTIAL]   ECON-033: Value can leave through authority paths outside the fee mechanism
              File: handler_withdraw_from_farm_vault.rs:34-41 (principal, withdraw_authority), handler_withdraw_reward.rs:58-66 (un-issued rewards, farm_admin, only while the schedule curve is default — farm_operations.rs:132-135)
              Improvement: intentional; see F-007 and the Trust Model
[N/A]       ECON-034: the program cannot swap or convert assets — it only holds the mints it was configured with
[FAIL-3]    ECON-035: A configured withdraw authority can move all principal to its own token account
              File: handler_withdraw_from_farm_vault.rs:51-62 (token::authority = withdraw_authority), farm_operations.rs:188-193 (the authority is set in one un-timelocked step)
              Impact: a compromised or mistaken farm-admin key converts to total loss of the farm's principal in one transaction, with no on-chain notice to stakers
              Fix: two-step + timelocked appointment and an event (see F-007)
[PARTIAL]   ECON-036: The destination is constrained to the withdraw authority's own token account, not to a program-owned account
              File: handler_withdraw_from_farm_vault.rs:58-61
              Improvement: requiring a PDA destination of the consuming protocol would remove the bare-wallet exfiltration shape (F-007)
[N/A]       ECON-037: the program performs no lamport transfers (rent only)
[N/A]       ECON-038: no approve/delegate CPI exists; vault delegates are rejected (AV-049)
[N/A]       ECON-039: no swap or route-selection path exists
[N/A]       ECON-040: no arbitrary-program CPI exists
[N/A]       ECON-041: no CPI whitelist exists (nothing to guard)
[N/A]       ECON-042: no CPI whitelist exists (see ECON-041)
[PARTIAL]   ECON-043: Users are protected against per-position seizure but not against pooled-principal removal
              File: no instruction can touch an individual UserState's stake except the owner's (or, in delegated farms, the delegate's set_stake); but see ECON-035
              Improvement: a timelock plus events would give users an exit window (F-007, F-014)
[PASS]      ECON-044: Transfer-hook mints are rejected for rewards, and the base token is pinned to the classic Token program — utils/constraints.rs:75-85, handler_initialize_farm.rs:70
[PASS]      ECON-045: Fee-on-transfer mints are rejected — both older_transfer_fee and newer_transfer_fee must be zero — utils/constraints.rs:65-74
[PARTIAL]   ECON-046: Rebasing tokens are not detected
              File: stake_operations.rs (all accounting is internal)
              Improvement: a rebase would desync farm_vault.amount from total_staked_amount; no SPL rebase standard exists today, so this is theoretical — but the mint allowlist (F-011) is the place to address it
[PARTIAL]   ECON-047: A mint freeze authority can freeze the vault or a user's reward ATA
              File: utils/constraints.rs:34-44 (no freeze-authority rule)
              Improvement: see F-011
[PARTIAL]   ECON-048: A reward mint's authority can inflate its own supply after users have accrued claims
              File: handler_initialize_reward.rs:60-63 (no mint_authority inspection)
              Improvement: inherent to accepting arbitrary reward tokens; disclose per farm, or allowlist reward mints (F-011)
[PASS]      ECON-049: Non-standard decimals are handled — decimals are read from the mint and used only for transfer_checked; no cross-mint amount is ever added or compared — utils/accessors.rs:3-8, token_operations.rs:46
[N/A]       ECON-050: no native SOL path exists (no wrapping/unwrapping)
[PASS]      ECON-051: No attacker-controllable loop exists — iterations are bounded by MAX_REWARDS_TOKENS (10) and REWARD_CURVE_POINTS (20), and remaining_accounts are rejected — consts.rs:1-2, utils/constraints.rs:14-17
[N/A]       ECON-052: there is no batch operation over positions or withdrawals
[N/A]       ECON-053: no remaining_accounts-driven payout instruction exists
[PARTIAL]   ECON-054: Unbounded UserState creation is possible on non-delegated farms
              File: handler_initialize_user.rs:78-83
              Improvement: each account costs the attacker ~0.0074 SOL and nothing iterates over users, so there is no amplification — bounded griefing only (see AC-045)
[PASS]      ECON-055: No growable collection exists in state — all arrays are fixed size with compile-time asserted account sizes (state.rs:17-21,60-64,491-495)
[FAIL-6]    ECON-056: An attacker-free but reachable state prevents all legitimate operations on a farm
              File: state.rs:412-430 + farm_operations.rs:368-379 (F-001); farm_operations.rs:894-895 + utils/math.rs:41-42 (F-002); state.rs:476-477 + farm_operations.rs:890,933 (F-003); handler_reward_user_once.rs:31-35 (F-009)
              Impact: a farm can be driven into a permanent state in which stake, unstake, harvest and even the repairing config instruction all revert, locking user principal
              Fix: see F-001, F-002, F-003, F-009
[PASS]      ECON-057: The oracle is Scope (Kamino's own aggregator), loaded as a typed AccountLoader<scope::OraclePrices> whose owner Anchor verifies, and key-matched against farm_state.scope_prices — utils/scope.rs:6-28
[FAIL-4]    ECON-058: The staleness window is unvalidated and is zero on a freshly-initialised farm
              File: farm_operations.rs:269-274 (no bound on scope_oracle_max_age), handler_initialize_farm.rs:21 (leaves it 0 while FarmState::default() says u64::MAX)
              Impact: enabling the oracle without setting the max age rejects every price as stale, blocking stake/unstake/harvest until an admin repairs the config
              Fix: validate at write time and initialise explicitly (see F-005)
[PARTIAL]   ECON-059: No confidence-interval or deviation check is applied to the Scope price
              File: utils/scope.rs:22-24 (only unix_timestamp is examined, at state.rs:204 / farm_operations.rs:906)
              Improvement: impact is bounded — the price never prices user shares, only the deposit cap and the reward-issuance scale — but a wide/garbage print silently distorts both
[PARTIAL]   ECON-060: The party that benefits from the price also chooses it
              File: farm_operations.rs:257-268 (the farm admin sets both scope_prices and scope_oracle_price_id)
              Improvement: a manipulated feed can only relax/tighten the deposit cap and scale reward issuance; it cannot move user principal
[N/A]       ECON-061: no fallback oracle exists — a single Scope feed by design (documented as a trust-model input)
[N/A]       ECON-062: an oracle IS used; there is no manager-attested NAV to flag
[N/A]       ECON-071: no randomness, lottery or reward-selection draw exists in the program (listed here in checklist order — §6.9)
[PASS]      ECON-063: Settle-then-shrink is correct — user_refresh_all_rewards brings the tally current (farm_operations.rs:770) before remove_active_stake reduces the principal (:804), and the tally is then reduced by exactly shares_removed × reward_per_share (:816-835)
[PASS]      ECON-064: The pending = accrued − tally formula is applied on every payout path — harvest (:588), stake (:454), unstake (:770), refresh_user_state (:717), set_stake (:535) — and each updates the tally afterwards (:662, :1051, :834, :572)
[PASS]      ECON-065: The accumulator is always flushed before the denominator moves — refresh_global_rewards precedes every total_active_stake mutation: stake :453 before :488; unstake :768 before :804; set_stake :534 before :562; transfer_ownership via both
[PASS]      ECON-066: The per-user snapshot and the global accumulator share one scale — WAD-scaled Decimal for non-delegated farms (state.rs:559-577, farm_operations.rs:646) and raw units for delegated farms (farm_operations.rs:644, :572), consistently on both sides
[PASS]      ECON-067: Precision is adequate and ordered correctly — reward_per_share is a WAD (1e18) fixed-point Decimal, products widen to U192/U256 before dividing, and multiply precedes divide throughout — utils/math.rs:68-85, farm_operations.rs:972-984
[FAIL-5]    ECON-068: Total owed can exceed the reward vault's balance, and no invariant asserts otherwise
              File: farm_operations.rs:746-752 (reward_user_once credits rewards_issued_unclaimed without debiting rewards_available)
              Impact: last-claimer insolvency — a user's harvest fails at the token CPI, their rewards_issued_unclaimed stays non-zero, and close_empty_user_state is blocked for them permanently
              Fix: debit rewards_available with checked_sub (see F-004)
[PASS]      ECON-069: The zero-stake case short-circuits before the divide (farm_operations.rs:871-876), and first-staker inflation is blocked by the absence of a donation path (ECON-014)
[PASS]      ECON-070: Settle-before-rate-change is correct — update_farm_config flushes the accumulator with the OLD rate before writing the new curve — farm_operations.rs:171-186
[PARTIAL]   ECON-072: There is no aggregate outflow cap and no functioning circuit breaker
              File: state.rs:96 (the only breaker-shaped field is never read — F-006)
              Improvement: outflow is inherently bounded per user by their own share balance, so the missing global cap matters mainly for a logic-bug or authority-compromise drain; a guardian pause on deposit-side operations is the minimum (F-006)
[N/A]       ECON-073: no mark-to-market or unrealized-PnL collateral exists — there is no borrowing power to inflate
[PARTIAL]   ECON-074: There are no concentration or counterparty caps
              File: handler_withdraw_from_farm_vault.rs (a single withdraw authority may take 100% of a farm's vault)
              Improvement: concentration risk lives in the consuming protocol rather than here, but the vault has no per-window ceiling of its own
[N/A]       ECON-075: no swap / min_out path exists
[N/A]       ECON-076: no swap input to compute a fee base from
[PASS]      ECON-077: The treasury fee is netted out of the reward proceeds the instruction is already moving, never charged as a separate debit — farm_operations.rs:614-621, handler_harvest_reward.rs:73-95
[PASS]      ECON-078: The three quantities are separately named and typed — HarvestEffects { reward_user, reward_treasury } derived from `reward` — types.rs:1-5, farm_operations.rs:590,614-622
[N/A]       ECON-079: no bonding curve / completion threshold exists
[N/A]       ECON-080: no virtual/real reserve layers exist
[N/A]       ECON-081: no curve configuration exists
[PARTIAL]   ECON-082: Every vault has an authorised withdrawal path, but untracked inflows are permanently stranded
              File: farm_vault → withdraw_unstaked_deposits / withdraw_from_farm_vault / withdraw_slashed_amount; rewards_vault → harvest_reward / withdraw_reward; treasury vault → withdraw_treasury
              Improvement: withdraw_farm caps at total_active + total_pending (stake_operations.rs:578-601) and withdraw_slashed_amount at slashed_amount_current, so tokens transferred directly into farm_vault can never be swept; add an admin sweep for `farm_vault.amount − tracked`
[PASS]      ECON-083: Cumulative limits are structural — a withdrawal burns the shares it redeems, so N calls cannot exceed the position (stake_operations.rs:441-453, :535-556); there is no allocation counter to bypass
[PARTIAL]   ECON-084: A residual extraction can run while user liabilities are outstanding
              File: stake_operations.rs:578-589 — a full withdraw_from_farm_vault zeroes total_pending_amount without checking that pending user withdrawals are settled
              Improvement: users holding a matured pending withdrawal then receive 0 tokens with no error (see F-006)
[N/A]       ECON-085: the program maintains no price observation or TWAP accumulator (reward_per_share is a reward accumulator, covered by §6.10)
[N/A]       ECON-086: no TWAP accumulator (see ECON-085)
[N/A]       ECON-087: no bounded measurement window / TWAP exists
[N/A]       ECON-088: no TWAP read path exists
[PARTIAL]   ECON-089: There is no rolling per-window outflow accounting and no guardian pause separate from the admin
              File: program-wide; the only pause-shaped state is the unread is_farm_frozen
              Improvement: see F-006 — a breaker that trips on a bug or oracle drain (not only on a whale) is the missing control
```

*Checklist 06 totals: 89 items — PASS 26, FAIL 4, PARTIAL 22, N/A 37.*

### Checklist 07 — OpSec & Governance (85 items)

> §7.1, §7.3–§7.5 and §7.7 are dominated by deployment- and organisation-level facts. This engagement is static and read-only over the repository at commit `bfa1860`: no chain query, no multisig console, no CI system and no organisational process was in reach. Those items are recorded `[N/A — out of band]` with the reason rather than guessed (OUTPUT-RULES Rule 10).

```
[N/A]       OPS-001: out of band — requires `solana program show FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr`; no execution or network access in this engagement
[N/A]       OPS-002: out of band — upgrade-authority identity is on-chain deployment state, not in the repository
[N/A]       OPS-003: out of band — multisig threshold is not represented in the repository
[N/A]       OPS-004: out of band — signer identities are not in the repository
[N/A]       OPS-005: out of band — signer key-custody practice is not in the repository
[N/A]       OPS-006: out of band — a BPF-loader upgrade timelock is deployment configuration; note that the program itself implements no timelock (see OPS-053)
[N/A]       OPS-007: out of band (see OPS-006)
[N/A]       OPS-008: out of band — recommendation only; no timelock evidence available either way
[N/A]       OPS-009: out of band — upgrade-authority rotation is a loader-level operation
[N/A]       OPS-010: out of band — immutability is deployment state
[PASS]      OPS-011: True by construction and acknowledged: if the program is upgradeable, an upgrade can redirect every vault. This is stated in §3 Trust Model as a load-bearing assumption; no in-program mitigation is possible
[N/A]       OPS-012: out of band — emergency-upgrade process is organisational
[PASS]      OPS-013: No hidden admin exists — every authority is read from account state; the only hardcoded key in the program is declare_id! (lib.rs:23), verified against Anchor.toml
[PASS]      OPS-014: No account bypasses access control — each privileged instruction re-derives its expected authority from the account being modified
[PASS]      OPS-015: No pubkey-literal conditionals exist (grep for Pubkey::new_from_array / literal arrays: only Pubkey::default() comparisons, which are sentinel checks — state.rs:174,739; utils/scope.rs:14)
[PARTIAL]   OPS-016: One dead-but-callable instruction exists
              File: lib.rs:177-186 — idl_missing_types is exported and its body is unreachable!()
              Improvement: standard Anchor IDL trick, gated behind the UpdateGlobalConfig context (global-admin signer), so only an admin can trigger the panic; annotate or move behind #[cfg(feature = "idl-build")]
[N/A]       OPS-017: out of band — no IDL artifact is committed, and the binary is not available for comparison
[PARTIAL]   OPS-018: The treasury destination cannot be redirected, but the fee and the admin who sweeps it can be changed instantly
              File: state.rs:29 (treasury_vaults_authority is fixed at init), farm_operations.rs:42-54 (fee), handler_update_global_config_admin.rs (admin)
              Improvement: see ECON-027/028
[N/A]       OPS-019: no DEX/aggregator program id exists in the program
[PARTIAL]   OPS-020: The farm admin can be changed without user consent (two-step, no timelock, no event)
              File: farm_operations.rs:275-280 (nominate), handler_update_farm_admin.rs:16 (accept)
              Improvement: the two-step handshake is good practice; add a timelock and an event for the highest-value farms (F-007, F-014)
[N/A]       OPS-021: no share-minting instruction exists (stake is internal accounting, not a token)
[N/A]       OPS-022: no share-burning instruction exists (see OPS-021)
[PASS]      OPS-023: No `unsafe` block exists anywhere in the program (repository-wide grep: zero matches)
[PASS]      OPS-024: No raw pointer manipulation exists; zero-copy access goes through bytemuck's Pod/Zeroable — state.rs:4,22,65,496
[FAIL-1]    OPS-025: Build configuration is internally inconsistent
              File: lib.rs:19-20 + programs/kfarms/Cargo.toml:14-18 (features referenced but never declared); Anchor.toml:4-5 vs programs/kfarms/Cargo.toml:2,11 (`kfarms` vs `farms`)
              Impact: the compile_error! cluster guard can never fire, and the Anchor workspace cannot map the program to its declared id
              Fix: see F-018
[N/A]       OPS-026: out of band — verifiable-build comparison requires building and fetching the deployed binary
[N/A]       OPS-027: out of band — deploy-keypair custody is not represented in the repository
[FAIL-2]    OPS-028: The repository's own configuration invites a private key into the working tree
              File: Anchor.toml:11 (`wallet = "./wallet.json"`) with .gitignore:1-7 not excluding it
              Impact: a developer following the repo's configuration creates an unignored keypair at the repository root
              Fix: ignore wallet.json / *keypair*.json / id.json / .env* and point the provider outside the repo (see F-016)
[N/A]       OPS-029: out of band — manager-wallet custody is organisational
[N/A]       OPS-030: no backend component exists in this repository
[N/A]       OPS-031: no backend component exists
[N/A]       OPS-032: no API keys exist in the repository
[N/A]       OPS-033: no API keys exist in the repository
[N/A]       OPS-034: no RPC endpoint configuration beyond Anchor.toml's `cluster = "Localnet"`
[N/A]       OPS-035: no frontend exists in this repository
[PASS]      OPS-036: No secret has ever been committed — `git log --all --diff-filter=A` over *.env*, *.pem, *secret*, *keypair*, id.json and wallet.json returns nothing, and the complete all-history file list is exactly the 56 tracked files
[N/A]       OPS-037: out of band — multisig platform is not represented in the repository
[N/A]       OPS-038: out of band — multisig threshold (see OPS-037)
[N/A]       OPS-039: out of band — signer power distribution
[N/A]       OPS-040: out of band — backup signers
[N/A]       OPS-041: out of band — threshold-change policy
[N/A]       OPS-042: out of band — proposal expiry
[N/A]       OPS-043: out of band — multisig transaction logging
[N/A]       OPS-044: out of band — no incident-response plan is in the repository; SECURITY.md is referenced by URL (lib.rs:30) but lives in another repository
[FAIL-4]    OPS-045: The program cannot be paused in an emergency
              File: state.rs:96 (is_farm_frozen has no readers), farm_operations.rs:1017-1019 (only writer)
              Impact: the only incident lever is a program upgrade
              Fix: enforce the flag on deposit-side instructions and add a setter (see F-006)
[PASS]      OPS-046: A security policy is published on-chain in the program binary — policy URL in security_txt — lib.rs:30
[PASS]      OPS-047: A security contact is published on-chain — `email:security@kamino.finance` — lib.rs:29; prior auditors are also declared (lib.rs:34)
[N/A]       OPS-048: out of band — monitoring/alerting is off-chain infrastructure; note that the absence of events (F-014) makes value-movement alerting materially harder
[N/A]       OPS-049: out of band — upgrade-transaction alerting is off-chain
[N/A]       OPS-050: out of band — anomaly alerting is off-chain
[N/A]       OPS-051: out of band — war-room process is organisational
[N/A]       OPS-052: out of band — post-mortem process is organisational
[PASS]      OPS-053: The complete list of time-locked actions is: none. No instruction implements a governance timelock; the only time gates are user-facing (deposit_warmup_period, withdrawal_cooldown_period, min_claim_duration_seconds, locking_duration) — farm_operations.rs:474-478,799-801,591-596; utils/withdrawal_penalty.rs
[N/A]       OPS-054: out of band — program-upgrade timelock is deployment configuration (see OPS-006)
[PARTIAL]   OPS-055: Fee changes have no timelock — duration: none
              File: farm_operations.rs:42-54
              Improvement: see ECON-028
[PARTIAL]   OPS-056: Admin changes are two-step but not time-locked — duration: none
              File: handler_update_farm_admin.rs:16, handler_update_global_config_admin.rs:15
              Improvement: see F-007
[N/A]       OPS-057: no whitelist mechanism exists
[PARTIAL]   OPS-058: Treasury *vault* addresses are immutable (PDA-derived), but three fund-relevant addresses are freely mutable with no timelock
              File: withdraw_authority (farm_operations.rs:188-193), slashed_amount_spill_address (:251-256), second_delegated_authority (:299-304 and handler_update_second_delegated_authority.rs:17)
              Improvement: see F-007
[N/A]       OPS-059: no timelock exists, so there is no emergency-bypass path to evaluate
[N/A]       OPS-060: no timelock exists, so there is no pending transaction to cancel
[FAIL-2]    OPS-061: Users are not notified of pending privileged changes
              File: program-wide — pending_farm_admin / pending_global_admin / withdraw_authority changes emit no event
              Impact: a user can only detect a pending admin or authority change by polling raw account data
              Fix: emit events on nomination and acceptance (see F-014)
[N/A]       OPS-062: out of band — environment key separation is organisational
[N/A]       OPS-063: out of band — deploy-access policy is organisational
[N/A]       OPS-064: no CI/CD pipeline exists in the repository (there is no .github/ directory), so nothing auto-deploys from this repo
[N/A]       OPS-065: out of band — server access controls; no servers in scope
[N/A]       OPS-066: out of band — no database in scope
[N/A]       OPS-067: out of band — no CI/CD environment exists in the repository
[N/A]       OPS-068: out of band — no secret manager is referenced in the repository
[PASS]      OPS-069: The source is published under BUSL-1.1 (source-available, change date 2027-11-17) — LICENSE, NOTICE
[N/A]       OPS-070: out of band — verifiable-build comparison requires building and fetching the deployed binary
[PARTIAL]   OPS-071: Reproducibility is mostly well-supported but was not exercised
              File: rust-toolchain.toml:2 (rustc 1.74.1 pinned), Cargo.lock committed, anchor-lang/anchor-spl 0.29.0
              Improvement: no build was run in this engagement; the one weak link is the branch-tracked scope dependency (F-017)
[PASS]      OPS-072: The audited history is linear and intact — two commits (`bfa1860` "Release 1.7.0 (#25)", `2a63e5a` "Update README (#21)"), both merge-style PR commits, with no evidence of rewriting
[N/A]       OPS-073: out of band — branch protection is a GitHub repository setting
[N/A]       OPS-074: no CI/CD pipeline exists in the repository (see OPS-064)
[FAIL-2]    OPS-075: One dependency is tracked by a moving git branch
              File: programs/kfarms/Cargo.toml:31 (`branch = "anchor_0.29_idl"`), pinned only by Cargo.lock:1771
              Impact: `cargo update` or a force-push changes what the name resolves to; this crate defines the price layout the program indexes into
              Fix: pin `rev = "0c8f7925..."` or a signed tag (see F-017)
[N/A]       OPS-076: the program never interacts with the Solana Stake program; "stake" here is internal accounting, so there is no Staker/Withdrawer authority to monitor
[PARTIAL]   OPS-077: Privileged instructions carry no epoch/version guard against pre-signed durable-nonce execution
              File: all admin handlers (e.g. handler_update_farm_config.rs:10-34) take no nonce/epoch/version argument
              Improvement: combined with the absence of any timelock (OPS-053), a pre-signed admin transaction can execute long after the authorising context has changed; bind privileged instructions to a monotonically increasing config version
[PARTIAL]   OPS-078: Two-step rotation exists for the admin roles only
              File: two-step — pending_farm_admin / pending_global_admin (handler_update_farm_admin.rs, handler_update_global_config_admin.rs); one-step — withdraw_authority, delegate_authority, second_delegated_authority, delegated_rps_admin, slashed_amount_spill_address (farm_operations.rs:188-193,251-256,287-304,312-323)
              Improvement: extend the pending/accept handshake to the fund-moving roles, and add a timelock (F-007)
[PARTIAL]   OPS-079: Fee/treasury accounts are token-capable and sweepable, but one vault has no residual sweep
              File: treasury vault created as a real token account at handler_initialize_reward.rs:75-83 with a sweep path at handler_withdraw_treasury.rs; slashed_amount_spill_address is constrained to a token account of the right mint (handler_withdraw_slashed_amount.rs:53-56)
              Improvement: tokens sent directly to farm_vault have no sweep path (ECON-082)
[PARTIAL]   OPS-080: Config updates use a `mode + raw bytes` API with no tri-state patch and no atomic cross-validation
              File: handler_update_farm_config.rs:10-34, farm_operations.rs:146-332
              Improvement: each field is written independently, which is the mechanism behind F-002 and F-005; validate the resulting config as a unit. Permissionless init (initialize_global_config / initialize_farm) binds authority to the creator, which is safe here because each config is independent
[N/A]       OPS-081: out of band — verifying a live multisig threshold requires fetching the account
[FAIL-5]    OPS-082: Most admin-settable numerics have no bounds at all
              File: farm_operations.rs:362-367 (rewards_per_second_decimals), :263-268 (scope_oracle_price_id), :269-274 (scope_oracle_max_age), :239-244 (locking_duration), :221-226 (locking_start_timestamp), :194-213 (warmup/cooldown), :347-352 (min_claim_duration), :341-346 (reward_per_time_unit), :245-250 (deposit_cap_amount)
              Impact: `rewards_per_second_decimals >= 20` makes ten_pow panic on every refresh and bricks the farm irrecoverably
              Fix: enforce a min and max on every setter (see F-002)
[FAIL-5]    OPS-083: Interdependent config values are never cross-validated
              File: locking_start_timestamp vs locking_duration vs now (farm_operations.rs:221-244); scope_prices vs scope_oracle_price_id vs scope_oracle_max_age (:257-274); reward_per_time_unit vs rewards_per_second_decimals (:341-367)
              Impact: individually-valid writes produce a mutually inconsistent config — a silently disabled penalty (SM-057) or a farm that rejects every price (F-005)
              Fix: validate the whole resulting config atomically at write time (see F-002)
[PARTIAL]   OPS-084: No settable value is used as a raw divisor, but two feed degenerate math
              File: divisors are BPS_DIV_FACTOR (const 10000), ten_pow() (>= 1) and guarded stake totals; however ten_pow(rps_decimals) panics above 19 (utils/math.rs:41-42) and locking_duration = 0 is absorbed by early returns (utils/withdrawal_penalty.rs:16-32)
              Improvement: add explicit non-zero / in-domain guards at write time (see F-002)
[N/A]       OPS-085: out of band — signing-surface legibility is a multisig/council-side control outside this repository
```

*Checklist 07 totals: 85 items — PASS 12, FAIL 7, PARTIAL 12, N/A 54 (of which 39 are out-of-band and 15 are feature-absent).*

### Checklist 16 — Formal Verification & Testing Quality (72 items)

> This checklist is dominated by a single root cause: at commit `bfa1860` the repository contains **no test suite, no fuzzing harness, no static-analysis configuration and no CI**. Each unmet-but-applicable item is recorded `[FAIL-3]` and deduplicated into **F-012**; items that genuinely do not apply (no HTTP API, no prior-bug list, no tests to be flaky) are `[N/A]` with the reason.

```
[PARTIAL]   FV-001: Invariants exist in code but are nowhere documented
              File: farm_operations.rs:514-521 (five assert_eq! preconditions for delegated farms), state.rs:17-21,60-64,491-495 (account-size assertions)
              Improvement: document the three load-bearing invariants this audit verified by hand — Σ user stake == farm total; vault balance >= tracked totals; rewards_available + issued_unclaimed <= vault balance (currently violated, F-004)
[FAIL-3]    FV-002: No invariant is encoded as a property-based test — F-012
[FAIL-3]    FV-003: No arithmetic identity (share round-trip, fee split, penalty decay) has a proof or exhaustive test — F-012
[FAIL-3]    FV-004: No state-transition property is specified or tested — F-012
[FAIL-3]    FV-005: No model checking or fuzzing exists, so reachable invariant violations are unverified — F-012 (and F-004 is exactly such a violation)
[FAIL-3]    FV-006: Token conservation is never tested on any path — F-012
[FAIL-3]    FV-007: Authority properties are never tested (no negative-authorization test exists) — F-012
[FAIL-3]    FV-008: Liveness is never tested — and is in fact violated: F-001/F-002/F-003 reach states from which no instruction can complete — F-012
[N/A]       FV-009: no formal specification exists, so there is no spec drift to track
[N/A]       FV-010: the project claims no mathematical proofs
[N/A]       FV-011: no formal-verification properties exist to document
[N/A]       FV-012: no verification results are claimed anywhere in the repository
[FAIL-3]    FV-013: No static-analysis tool runs in CI — there is no CI (no .github/, no Makefile, no pipeline file) — F-012
[N/A]       FV-014: no static-analysis output exists to triage
[PARTIAL]   FV-015: No custom lint rules enforce project conventions, and two blanket allows carry no justification
              File: lib.rs:1 (#![allow(clippy::result_large_err)]), state.rs:1 (#![allow(clippy::derivable_impls)])
              Improvement: a `clippy::unwrap_used` / `clippy::panic` deny would have caught every site in F-010
[N/A]       FV-016: there is no CI in which to enforce a zero-warning policy
[N/A]       FV-017: no lint configuration file exists in the repository
[PARTIAL]   FV-018: Dead code exists and nothing flags it
              File: lib.rs:209,218,224,227,233,239,344,389 (8 unused error variants), state.rs:483-488 (get_current_rps), :742-744 (has_rewards_available), :699 (TimeUnit::Slots)
              Improvement: enabling `dead_code` warnings in CI would surface these (see Notes & Nitpicks)
[FAIL-3]    FV-019: No dependency vulnerability scanning exists (`cargo audit` / `cargo deny` are not configured or run) — F-012; relevant given the branch-tracked git dependency (F-017)
[N/A]       FV-020: no SAST tooling is configured for any language in the repository
[PARTIAL]   FV-021: The two `#![allow(...)]` suppressions carry no justification comment
              File: lib.rs:1, state.rs:1
              Improvement: add a one-line rationale next to each
[N/A]       FV-022: there are no static-analysis config files to version-control or review
[FAIL-3]    FV-023: No fuzz target exists for any deserialization path (Borsh config payloads, zero-copy state) — F-012
[FAIL-3]    FV-024: No instruction handler has a fuzz target — F-012
[FAIL-3]    FV-025: No fuzz corpus exists to persist — F-012
[FAIL-3]    FV-026: No fuzz campaign has been run — F-012
[FAIL-3]    FV-027: No fuzz-found crash triage process exists — F-012
[FAIL-3]    FV-028: No differential fuzzing exists (e.g. v1.6 vs v1.7 reward accounting) — F-012
[FAIL-3]    FV-029: Arithmetic edge cases (MAX/MIN/0/1/near-overflow) are untested — precisely the inputs behind F-002 and F-003 — F-012
[N/A]       FV-030: no HTTP/RPC API endpoints exist in this repository to fuzz
[FAIL-3]    FV-031: No serialization round-trip test exists for the zero-copy state structs — F-012
[FAIL-3]    FV-032: No fuzzing infrastructure exists to document or reproduce — F-012
[FAIL-3]    FV-033: No coverage measurement exists (no tarpaulin/llvm-cov configuration) — F-012
[FAIL-3]    FV-034: Critical paths (stake, unstake, harvest, withdraw) have 0% branch coverage — F-012
[FAIL-3]    FV-035: No unit test exists for any of the 26 instructions or any helper in farm_operations/stake_operations — F-012
[FAIL-3]    FV-036: No integration test covers the create → stake → refresh → unstake → withdraw workflow — F-012
[FAIL-3]    FV-037: No edge-case tests exist (zero amounts, u64::MAX sentinel, empty reward list, boundary timestamps) — F-012
[FAIL-3]    FV-038: No negative tests exist (wrong signer, wrong farm, delegated-farm guard, cooldown not elapsed) — F-012
[FAIL-3]    FV-039: N/A-adjacent but scored: no regression test exists for any previously-found bug; the repository documents none, but two prior audits are declared (lib.rs:34) — F-012
[FAIL-3]    FV-040: No CI runs tests on a PR — there is no CI — F-012
[FAIL-3]    FV-041: No test environment configuration exists to mirror production (no validator version pin, no feature-set pin) — F-012
[N/A]       FV-042: there are no tests, therefore no flaky tests in a skip state
[FAIL-3]    FV-043: Mutation testing has never been run — F-012
[FAIL-3]    FV-044: No performance/CU-budget test exists; compute cost is unmeasured for every instruction — F-012
[PASS]      FV-045: No hardcoded secrets, private keys or real credentials appear in the one test file — tests/kfarms.ts:1-16 uses AnchorProvider.env()
[N/A]       FV-046: there are no tests whose determinism/seeding could be evaluated
[PASS]      FV-047: Every CPI result is explicitly propagated with `?` — token_operations.rs:25,46,63; all handler call sites
[PASS]      FV-048: Error output leaks nothing sensitive — errors are static #[msg] strings (lib.rs:189-429) and log output is numeric state only
[FAIL-5]    FV-049: Reachable panics are not caught at any boundary and surface as a bare VM abort
              File: stake_operations.rs:325-329,433-438; farm_operations.rs:219,357,373,375,514-526,738,933; utils/math.rs:42,82,94; state.rs:166-178,219,729,747; handler_update_farm_config.rs:16
              Impact: no error code, no #[msg] text, no client-side triage; also the delivery mechanism for the unrecoverable states in F-002/F-003
              Fix: convert to require!/? with typed FarmError values (see F-010)
[N/A]       FV-050: this is an on-chain program, not an HTTP service — there are no 4xx/5xx status semantics
[N/A]       FV-051: no resource pools, OOM handling or disk state exist in an on-chain program
[N/A]       FV-052: no external network calls exist; CPIs are synchronous and bounded by the compute budget
[PASS]      FV-053: Partial failure is impossible — Solana transaction atomicity rolls back all account writes on any error
[PARTIAL]   FV-054: One error is deliberately swallowed
              File: handler_update_farm_config.rs:14 — `load_scope_price(..).map_or(None, |v| v)` converts InvalidOracleConfig into None
              Improvement: intentional (it is what lets an admin repair a broken oracle config — see F-005), but it should be an explicit match with a comment rather than a silent map_or
[PARTIAL]   FV-055: Specific error codes are returned on error paths, but panic paths return none
              File: lib.rs:189-429 defines 80 typed errors; the 18 panic sites in FV-049 bypass them entirely
              Improvement: see F-010
[PASS]      FV-056: Enum matches are exhaustive — update_global_config and update_farm_config match every variant with no catch-all; update_reward_config's `_ => unimplemented!()` (farm_operations.rs:375) is unreachable because its only caller filters the modes at :158-162
[PARTIAL]   FV-058: Exceptional financial-math conditions are blocked rather than wrapped — but the block is a panic
              File: Cargo.toml:6 (overflow-checks = true) converts every overflow into an abort; divide-by-zero is prevented structurally (AR-018)
              Improvement: blocking is the correct semantic; returning MathOverflow instead of aborting would make it observable and, in the refresh path, survivable (F-003)
[N/A]       FV-057: there are no external dependencies to circuit-break; the single oracle read has a staleness gate but no fallback by design (ECON-061)
[FAIL-3]    FV-059: No in-process SVM suite (LiteSVM or Mollusk) exists — F-012
[FAIL-3]    FV-060: The four time-locked paths (deposit warmup, withdrawal cooldown, min claim duration, locking maturity) are untested on both sides — F-012
[FAIL-3]    FV-061: No sysvar/clock control test exists — F-012
[FAIL-3]    FV-062: Account closure is never verified on lamports/data/owner — F-012 (the one close instruction is handler_close_empty_user_state.rs)
[FAIL-3]    FV-063: Re-initialization is never tested, despite two init_if_needed sites — F-012 (see AV-023/AV-024)
[FAIL-3]    FV-064: Authorization negatives are never tested for any of the seven roles — F-012
[FAIL-3]    FV-065: Arithmetic edge cases are never exercised through the SVM — F-012
[FAIL-3]    FV-066: Token balances are never asserted after a transfer path — F-012
[FAIL-3]    FV-067: Compute-unit consumption is never profiled or baselined — F-012 (relevant: the constraint-side find_program_address derivations in PDA-010)
[FAIL-3]    FV-068: No multi-transaction test exists, so blockhash handling is untested — F-012
[FAIL-3]    FV-069: No failure-path test exists to assert is_err() on — F-012
[FAIL-3]    FV-070: No test derives a PDA, so seed parity with the on-chain derivation is unverified — F-012
[FAIL-3]    FV-071: No Solana-appropriate verification or fuzzing tool is used — no Trident, Crucible, Riverguard, Certora, Kani, Mollusk or LiteSVM. For a mainnet-live custodial staking program this is the single largest process gap — F-012
[FAIL-3]    FV-072: The current transaction format is not exercised, because no suite exists to exercise it — F-012. Note the program itself has no reader/indexer/fee-sponsor component, so the v1 surface is limited to running under a v1-gated runtime (see KV-135/KV-136)
```

*Checklist 16 totals: 72 items — PASS 5, FAIL 44, PARTIAL 7, N/A 16. Of the 44 FAIL verdicts, 43 share the single root cause F-012 (no tests / fuzzing / static analysis / CI); FV-049 maps to F-010 and F-003.*

---

## 6. Known Vector Results

> In-scope vectors (58) carry an explicit verdict. `[N/A — feature absent: …]` is an evidence-backed gate verdict (marker provably absent from the in-scope tree); it reopens the moment a manual read surfaces the feature. Out-of-scope vectors (78) render from the scope gate.

```
[PASS]      KV-001 (Private Key Leak): no key material in the tree or in history — `git ls-files` is 56 files with no keypair/.env/PEM, and `git log --all --diff-filter=A` over those patterns is empty (OPS-036). Latent gap only: .gitignore does not cover wallet.json (F-016)
[PASS]      KV-002 (Flash Loan Price Manipulation): share value is never oracle-priced; an atomic stake→unstake in one slot accrues zero rewards because refresh short-circuits on ts == last_issuance_ts — farm_operations.rs:867-869
[PASS]      KV-003 (Reentrancy via CPI): the only CPI targets are SPL Token / Token-2022 (no callback surface), and every state mutation precedes every CPI — handler_harvest_reward.rs:49-95
[PASS]      KV-004 (Missing Access Control): all 26 handlers bind their authority via Signer + has_one / address / explicit compare — see checklist 02
[PARTIAL]   KV-005 (Oracle Manipulation): a staleness gate exists (state.rs:204-211, farm_operations.rs:906-913) but the window is unvalidated and zero on a new farm, and no confidence bound is applied
              File: farm_operations.rs:263-274 — see F-005 / ECON-058 / ECON-059
              Improvement: impact is bounded — the price scales only the deposit cap and reward issuance, never user share value
[PASS*]     KV-006 (First Depositor / Share Inflation): mul-before-div with U192/U256 widening, floor rounding in the pool's favour, explicit 1:1 first deposit, and no permissionless donation path (deposit_to_farm_vault is farm-admin-gated) — stake_operations.rs:289-334, handler_deposit_to_farm_vault.rs:35. *confidence: high on reachability; no virtual-share offset exists, so the property depends entirely on donation staying admin-gated
[N/A]       KV-007 (MEV Sandwich): feature absent — no swap, route, slippage or min_amount_out anywhere in the program
[PARTIAL]   KV-008 (Rug Pull / Admin Backdoor): no hidden backdoor exists (OPS-013…015, OPS-023/024), but a documented, un-timelocked authority path can remove all principal
              File: handler_withdraw_from_farm_vault.rs:34-41, farm_operations.rs:188-193 — see F-007
[PASS]      KV-009 (Unchecked CPI Target): every CPI program account is typed Program<Token> / Interface<TokenInterface> and cross-checked per account via token::token_program — handler_harvest_reward.rs:127,145,155,169
[PASS]      KV-010 (PDA Confusion / Type Cosplay): three zero-copy account types with distinct Anchor discriminators, all loaded through AccountLoader (owner + discriminator enforced); no manual deserialization of foreign bytes
[PARTIAL]   KV-011 (Integer Overflow / Underflow): ~40 bare arithmetic sites exist, but `overflow-checks = true` (Cargo.toml:6) converts wraparound into an abort — there is no silent value corruption anywhere
              File: state.rs:476-477, farm_operations.rs:890,920,933 — see F-003
              Improvement: the residual risk is an unrecoverable liveness failure in the refresh path, not theft
[PASS]      KV-012 (Arithmetic Rounding Exploit): multiply-before-divide with U192/U256 intermediates everywhere (utils/math.rs:68-95); every rounding direction favours the pool; a stake/unstake round trip strictly loses dust, so no extraction path exists
[PASS]      KV-013 (Missing Signer Check): every value-moving and state-mutating instruction except the two documented permissionless cranks carries a Signer bound to state — see AC-001/AC-002
[PARTIAL]   KV-014 (Account Reinitialization): init_if_needed is used twice, both with adequate guards
              File: handler_transfer_ownership.rs:168-174 (discriminator branch + load_init zero-check + owner/farm re-validation at :72-88), handler_initialize_reward.rs:75-83 (token::mint / authority / token_program re-validated)
              Improvement: both are justified; document why in code, and prefer explicit state validation over relying on Anchor's implicit re-checks
[PASS]      KV-015 (Unchecked Account Owner): every account is typed, so Anchor verifies the owner; the one foreign account (scope::OraclePrices) is owned by the Scope program and additionally key-matched — utils/scope.rs:18-20
[PASS]      KV-016 (Token Account Mismatch): mint and authority are constrained on every token account on a user path; the two unconstrained ones are admin destinations behind an admin signature (F-015)
[PASS]      KV-017 (Vault Donation Attack): the vault's raw balance is never read for pricing — all share math uses tracked totals (total_staked_amount, total_pending_amount); a direct token transfer into farm_vault is simply ignored (and, per ECON-082, unrecoverable)
[PASS]      KV-018 (Fee-on-Transfer Token Exploit): Token-2022 transfer-fee mints are rejected outright for rewards (both older and newer fee must be zero), and the base token is pinned to classic SPL — utils/constraints.rs:65-74, handler_initialize_farm.rs:70
[PARTIAL]   KV-019 (Freeze Authority Griefing): no mint's freeze_authority is ever inspected, and no token account's frozen state is checked
              File: utils/constraints.rs:34-44, handler_initialize_reward.rs:60-63 — see F-011
              Improvement: a frozen rewards_vault blocks all harvests; a frozen user ATA blocks that user's harvest and permanently blocks their close_empty_user_state
[N/A]       KV-020 (Program Upgrade Hijack): out of band — the upgrade authority is on-chain deployment state; cross-ref OPS-001…012 and the §3 trust assumption
[N/A]       KV-021 (Governance Attack): feature absent — no spl-governance, realm, proposal, vote_record or voter_weight
[N/A]       KV-022 (Bridge Exploit): feature absent — no guardian, VAA, emitter, attestation or cross-chain message verification
[PASS]      KV-023 (Token-2022 Transfer Hook Attack): a reward mint carrying a TransferHook must have no hook program id, else UnsupportedTokenExtension — utils/constraints.rs:75-85
[PASS]      KV-024 (Stale / Missing Account Close): the single close path uses Anchor `close = rent_receiver` (discriminator overwritten + lamports drained); no manual lamport-only close exists — handler_close_empty_user_state.rs:71-76
[PASS]      KV-025 (Compute Budget Exhaustion DoS): all loops are bounded by MAX_REWARDS_TOKENS (10) or REWARD_CURVE_POINTS (20); remaining_accounts are rejected in all 26 handlers; worst case is ~10 reward iterations per instruction — consts.rs:1-2
[PASS]      KV-026 (PDA Seed Collision): seed sets are distinct and fully parameterised; the shared b"authority" literal is disambiguated by its second seed (farm_state vs global_config), which cannot collide — consts.rs:5-10
[PASS]      KV-027 (Missing Discriminator Check): no manual deserialization exists; the one manual discriminator read compares against UserState::DISCRIMINATOR — utils/accessors.rs:10-16, handler_transfer_ownership.rs:24-29
[PARTIAL]   KV-028 (Front-Running Transaction): no price-sensitive instruction exists, and user_state PDAs are self-seeded so creation cannot be front-run (KV-127)
              File: farm_operations.rs:188-193 — the residual surface is an admin config change (fee, withdraw authority, reward curve) landing ahead of a user's stake/unstake, with no timelock and no event
              Improvement: see F-007 / F-014
[PASS]      KV-029 (Withdraw-Before-Update Race): the withdrawal amount is fixed by internal share accounting with no price read at any step; the two-step flow is time-gated rather than admin-advanced — farm_operations.rs:840-857
[N/A]       KV-030 (Infinite Mint / Uncapped Supply): feature absent — the program owns no mint and never calls mint_to; stake is internal accounting
[N/A]       KV-091 (Upgrade Authority Not Secured): out of band — see KV-020 / OPS-001…012
[PASS]      KV-101 (Sysvar Spoofing / Instructions Introspection): Clock is read via the syscall only (state.rs:728-735); the sole sysvar account is Sysvar<Rent>; there is no instructions-sysvar introspection
[N/A]       KV-102 (Precompile Signature Verification Bypass): feature absent — no ed25519/secp256k1 precompile use and no signature introspection
[PASS]      KV-103 (Address Lookup Table Manipulation): no positional or ALT-resolution assumption exists — every account is named in the Accounts struct and bound by constraint
[PASS]      KV-104 (Non-Canonical Bump / PDA Derivation Confusion): Anchor canonical bumps everywhere; ctx.bumps stored at init and reused for invoke_signed; create_program_address is never called with a user-supplied bump — handler_initialize_farm.rs:19, utils/macros.rs:10-17
[PARTIAL]   KV-105 (Token-2022 Extension Abuse): extensions ARE read and allowlisted (a genuine strength), but PermanentDelegate, MintCloseAuthority and the confidential-transfer configs are accepted, and freeze authority is unchecked
              File: utils/constraints.rs:34-44 — see F-011
              Improvement: user principal is not exposed (the base mint is pinned to classic SPL); the exposure is the reward vault
[PASS]      KV-106 (Account Revival / Zombie After Close): Anchor's close writes CLOSED_ACCOUNT_DISCRIMINATOR and drains lamports; both re-entry paths require a zero discriminator (AccountLoader::load_init), so a re-funded address cannot be revived with stale state
[PASS]      KV-107 (Fake / Non-Canonical ATA): the canonical ATA is enforced exactly where the payer is not the owner (get_associated_token_address_with_program_id with the correct token program); when the owner signs, any of their own token accounts is legitimately acceptable — handler_harvest_reward.rs:128-134,184-198
[PASS]      KV-108 (Token Decimals / Cross-Mint Confusion): decimals are always read from the mint account (utils/accessors.rs:3-8, handler_add_reward.rs:69) and no amount is ever compared or summed across mints
[N/A]       KV-109 (Pinocchio / p-token Missing Validation): feature absent — this is an Anchor 0.29 program with no native entrypoint, no no_std and no manual AccountInfo validation
[PASS*]     KV-111 (BPF Stack Frame Overflow DoS): all heavy typed accounts are Box'ed (handler_harvest_reward.rs:122-157, handler_stake.rs:80-92) and the large state structs are zero-copy behind AccountLoader, so no context struct carries them by value; the largest by-value local is a ~712-byte RewardInfo copy at farm_operations.rs:865 and :1044. *confidence: medium — the build was not executed in this engagement, so the linker-stage stack report could not be inspected (§3 Constraints)
[N/A]       KV-118 (Stake Account Authority Hijack): feature absent — no Solana StakeProgram interaction; "stake" here is internal accounting with no Staker/Withdrawer authority
[PARTIAL]   KV-119 (Durable-Nonce Pre-Signed Governance Abuse): privileged instructions carry no epoch/version guard and no timelock
              File: handler_update_farm_config.rs:10-34, handler_update_global_config.rs:9-21 — see OPS-077
              Improvement: a pre-signed admin transaction can execute after the authorising context has changed; bind privileged instructions to a monotonic config version
[N/A]       KV-120 (On-Chain Randomness Predictability): feature absent — no randomness, VRF, lottery or reward-selection draw
[N/A]       KV-121 (cNFT / Account-Compression Merkle Proof Abuse): feature absent — no spl-account-compression, bubblegum, merkle tree or proof verification
[PARTIAL]   KV-122 (Inner-Instruction / Event-Log Spoofing): the program emits no structured events, so any off-chain consumer must parse free-form msg! text or inner instructions — exactly the spoofable surface this vector describes
              File: program-wide — see F-014
              Improvement: emit_cpi!/emit! with typed events removes the ambiguity
[PASS]      KV-123 (Lamport-Donation Account Bricking): no instruction asserts an exact lamport balance, and no builtin/sysvar/precompile account is marked mut; a donated balance cannot force an invalid RentState transition
[N/A]       KV-125 (Bonding-Curve Launchpad Graduation Abuse): feature absent — no bonding curve, virtual reserves, graduation or migration
[PASS]      KV-127 (ATA / Account Pre-Creation DoS): every `init` target is either a program-owned PDA (only this program can sign its seeds, so an attacker cannot pre-create it) or a user_state PDA seeded by the caller's own key; no ATA is created by this program — handler_initialize_user.rs:78-83, handler_initialize_reward.rs:65-83
[PASS]      KV-128 (On-Chain Floating-Point Math): no f32/f64, no powf/sqrt/ln/exp, no float casts — all value math is fixed-point integer (decimal_wad Decimal, U128/U192/U256)
[PARTIAL]   KV-129 (Keeper Request→Execute Front-Running): the two-step unstake→withdraw is entirely time-gated and self-serviced, so no keeper can reorder or withhold it; withdraw_slashed_amount is a permissionless crank with a has_one-pinned destination
              File: farm_operations.rs:840-857, handler_withdraw_slashed_amount.rs:46-56
              Improvement: the residual gap is that an admin config change (fee, penalty bps, withdraw authority) can land between a user's two steps with no timelock (KV-028, F-007)
[N/A]       KV-130 (CLMM / DLMM Tick-Boundary Math): feature absent — no tick, sqrt_price, liquidity_net, bin_array or fee_growth
[PARTIAL]   KV-131 (Write-Lock Account Contention DoS): every user action write-locks the single per-farm FarmState (stake, unstake, harvest, refresh, deposit, withdraw), so all writers to one farm serialise
              File: handler_stake.rs:69-72, handler_refresh_farm.rs:35-36
              Improvement: state IS partitioned per farm and per user, and no time-critical path exists (no liquidations, auctions or settlement races), so contention is a throughput cap rather than an economic-impact starvation — matching this vector's ⚠ criterion. The permissionless refresh_farm is the cheapest contention lever; the unnecessary `mut` signers in AV-019 add avoidable write locks
[N/A]       KV-132 (Canonical-Asset / Token-List Spoofing): feature absent — no token list, registry, assetId or canonical-variant resolution
[N/A]       KV-133 (Token Risk-Score Metric Farming): feature absent — no riskScore, trustTier, isVerified or third-party risk API
[N/A]       KV-134 (Token ACL / SRFC-37 Gate Bypass): feature absent — no token_acl, gating_program, MINT_CFG or thaw_permissionless
[N/A]       KV-135 (Transaction v1 Fee-Sponsor Cap Bypass): feature absent — the program is not a fee sponsor/paymaster and performs no ComputeBudget introspection (no load_instruction_at anywhere)
[N/A]       KV-136 (Transaction v1 Reader Wedge / Zero-Budget Indexing): feature absent — no off-chain reader, indexer or Geyser consumer is in scope

[N/A — out of scope]  KV-031…KV-055 (Backend / API, 25 vectors): no backend is in scope under `--scope program`
[N/A — out of scope]  KV-056…KV-075 (Frontend / Client-Side, 20 vectors): no frontend is in scope under `--scope program`
[N/A — out of scope]  KV-076…KV-090, KV-092…KV-100 (DevOps / Supply Chain, 24 vectors): checklists 11–13 are out of scope under `--scope program`
[N/A — out of scope]  KV-110, KV-112…KV-117 (Solana × AI + off-chain Rust, 7 vectors): no AI-agent or off-chain Rust component exists
[N/A — out of scope]  KV-124, KV-126 (Custody / session tokens, 2 vectors): no custodial key-management or session-token component exists
```

---

### Audit Metrics

| Metric | Value |
|--------|-------|
| Total items evaluated | 591 (in-scope checklist items) |
| PASS | 215 (36.4%) |
| FAIL | 68 (11.5%) |
| PARTIAL | 95 (16.1%) |
| N/A | 213 (36.0%) |
| **Pass rate** (excl. N/A) | **56.9%** |
| Highest severity found | **6** |
| **Repository Risk Score** | **6 — 🟡 MEDIUM** |

> Of the 68 FAIL verdicts, 43 deduplicate into F-012 (no tests/CI) and the remaining 25 map to the other 17 findings. Of the 213 N/A verdicts, 174 are feature-absent/not-applicable and 39 are out-of-band (all of them in checklist 07 §7.1/§7.3–§7.5/§7.7, plus KV-020 and KV-091 in the vector set).

### Known Vector Metrics

| Metric | Value |
|--------|-------|
| Total known vectors | 136 |
| In scope | 58 |
| PASS | 29 |
| FAIL | 0 |
| PARTIAL | 11 |
| N/A (in scope — feature absent / out of band) | 18 |
| N/A (out of scope) | 78 |
| Completion (in scope) | 100% (58 / 58) |

### Per-Checklist Summary

| # | Checklist | Items | Pass | Fail | Partial | N/A | Pass Rate (excl. N/A) |
|---|-----------|-------|------|------|---------|-----|-----------|
| 01 | Account Validation | 90 | 42 | 3 | 15 | 30 | 70.0% |
| 02 | Access Control | 50 | 30 | 2 | 9 | 9 | 73.2% |
| 03 | Arithmetic Safety | 63 | 33 | 5 | 12 | 13 | 66.0% |
| 04 | CPI & PDA | 70 | 28 | 0 | 3 | 39 | 90.3% |
| 05 | State Machine | 72 | 39 | 3 | 15 | 15 | 68.4% |
| 06 | Economic & Logic | 89 | 26 | 4 | 22 | 37 | 50.0% |
| 07 | OpSec & Governance | 85 | 12 | 7 | 12 | 54 | 38.7% |
| 16 | Formal Verification & Testing | 72 | 5 | 44 | 7 | 16 | 8.9% |
| | **Total (in scope)** | **591** | **215** | **68** | **95** | **213** | **56.9%** |

---

## 7. Instruction Matrix

| # | Instruction | File | Signer(s) / authority | CPI calls | PDA seeds used | Checked math | State changes | Findings |
|---|---|---|---|---|---|---|---|---|
| 1 | `initialize_global_config` | `handler_initialize_global_config.rs` | `global_admin` (permissionless — creates its own config) | none | `[b"authority", global_config]` (derive only) | n/a | GlobalConfig init | — |
| 2 | `update_global_config` | `handler_update_global_config.rs` | `global_admin` (`has_one`) | none | — | bps ≤ 10000 ✓ | `treasury_fee_bps`, `pending_global_admin` | F-014, ECON-027/028 |
| 3 | `update_global_config_admin` | `handler_update_global_config_admin.rs` | `pending_global_admin` (`has_one`) | none | — | n/a | `global_admin` | F-014 |
| 4 | `initialize_farm` | `handler_initialize_farm.rs` | `farm_admin` (permissionless) | Token init (Anchor) | `[b"fvault", farm_state, mint]`, `[b"authority", farm_state]` | n/a | FarmState init, farm_vault created | F-005 (max_age left 0) |
| 5 | `initialize_farm_delegated` | `handler_initialize_farm_delegated.rs` | `farm_admin` + `farm_delegate` (both sign) | none | `[b"authority", farm_state]` | n/a | FarmState init (delegated) | F-005 |
| 6 | `initialize_reward` | `handler_initialize_reward.rs` | `farm_admin` (`has_one`) | Token/Token-2022 init ×2 | `[b"rvault", farm_state, reward_mint]`, `[b"tvault", global_config, reward_mint]` | `checked_add` on `num_reward_tokens` ✓ | `reward_infos[n]`, vaults created | F-011 |
| 7 | `add_rewards` | `handler_add_reward.rs` | `payer` — **permissionless** (funds the farm) | `token_2022::transfer_checked` | `[b"authority", farm_state]` | `checked_add` ✓ | `rewards_available`, refresh | F-003 (refresh path) |
| 8 | `update_farm_config` | `handler_update_farm_config.rs` | `farm_admin`, or `delegated_rps_admin` for rate modes | none | — | **none on most values** | 25 config fields, refresh | **F-001, F-002, F-005**, F-010 |
| 9 | `initialize_user` | `handler_initialize_user.rs` | `authority` + `payer`; delegated farms require the delegate | none | `[b"user", farm_state, delegatee]` | `checked_add` on `num_users` ✓ | UserState init | — |
| 10 | `transfer_ownership` | `handler_transfer_ownership.rs` | `old_owner` (`address =`) + `payer` | none | `[b"user", farm_state, new_owner]` (`init_if_needed`) | via stake_operations | full stake move between UserStates | KV-014 |
| 11 | `reward_user_once` | `handler_reward_user_once.rs` | `delegate_authority` (`has_one`) + feature flag | none | — | **unchecked `+=`** | `rewards_issued_unclaimed/cumulative` | **F-004, F-009** |
| 12 | `refresh_farm` | `handler_refresh_farm.rs` | **none — permissionless** | none | — | reward math | reward accrual, `is_farm_delegated` fixup | F-001, F-003 |
| 13 | `stake` | `handler_stake.rs` | `owner` (`has_one`) | `token::transfer` (user → vault) | `[b"fvault", farm_state, mint]` | share math (widened) ✓ | user + farm stake, refresh | F-003 (`can_accept_deposit`) |
| 14 | `set_stake_delegated` | `handler_set_stake_delegated.rs` | `delegate_authority` or `second_delegated_authority` | none | — | `assert_eq!` preconditions | user + farm stake (absolute set) | F-010 |
| 15 | `harvest_reward` | `handler_harvest_reward.rs` | `payer` = owner, or anyone if `is_harvesting_permissionless` | `transfer_checked` ×2 (vault → user, vault → treasury) | `[b"rvault", …]`, `[b"tvault", …]`, `[b"authority", farm_state]` | `checked_sub` + `u64_mul_div` ✓ | rewards claimed, fee split | **F-008**, F-004 |
| 16 | `unstake` | `handler_unstake.rs` | `owner` (`has_one`) | none | — | share math + penalty | active → pending withdrawal, slashed amount | F-003 |
| 17 | `refresh_user_state` | `handler_refresh_user_state.rs` | **none — permissionless** | none | — | reward math | user reward accrual, pending activation | F-001, F-003 |
| 18 | `withdraw_unstaked_deposits` | `handler_withdraw_unstaked_deposits.rs` | `owner` (`has_one`) | `token::transfer` (vault → user) | `[b"fvault", …]`, `[b"authority", farm_state]` | pending conversion (floor) | pending withdrawal settled | F-006 (post-drain) |
| 19 | `withdraw_treasury` | `handler_withdraw_treasury.rs` | `global_admin` (`has_one`) | `transfer_checked` (treasury → dest) | `[b"tvault", global_config, mint]`, `[b"authority", global_config]` | n/a | treasury vault balance | F-015 |
| 20 | `deposit_to_farm_vault` | `handler_deposit_to_farm_vault.rs` | `farm_admin` (`address =`) | `token::transfer` (admin → vault) | `[b"fvault", …]` | unchecked `+=` | `total_staked_amount` (raises share value) | F-003 |
| 21 | `withdraw_from_farm_vault` | `handler_withdraw_from_farm_vault.rs` | `withdraw_authority` (`has_one`) | `token::transfer` (vault → authority) | `[b"fvault", …]`, `[b"authority", farm_state]` | `u64_mul_div` (floor) ✓ | pro-rata pool reduction, sets `is_farm_frozen` | **F-006, F-007** |
| 22 | `withdraw_slashed_amount` | `handler_withdraw_slashed_amount.rs` | **`crank` — permissionless** (destination pinned by `has_one`) | `token::transfer` (vault → spill) | `[b"fvault", …]`, `[b"authority", farm_state]` | n/a | `slashed_amount_current` → 0 | — |
| 23 | `update_farm_admin` | `handler_update_farm_admin.rs` | `pending_farm_admin` (`has_one`) | none | — | n/a | `farm_admin` | F-014 |
| 24 | `withdraw_reward` | `handler_withdraw_reward.rs` | `farm_admin` (`has_one`) | `transfer_checked` (reward vault → admin) | `[b"rvault", …]`, `[b"authority", farm_state]` | `cmp::min` + `-=` | `rewards_available` | F-015 |
| 25 | `update_second_delegated_authority` | `handler_update_second_delegated_authority.rs` | `global_admin` of the farm's `global_config` | none | — | n/a | `second_delegated_authority` | F-014 |
| 26 | `close_empty_user_state` | `handler_close_empty_user_state.rs` | `owner`, or the delegate authority on delegated farms | Anchor `close` | — | n/a | UserState closed, rent refunded | F-009 (can be blocked) |
| — | `idl_missing_types` | `lib.rs:177-186` | `global_admin` context; body is `unreachable!()` | none | — | n/a | none (always panics) | Notes & Nitpicks |

---

## 8. State Model Verification

### Account Types

| Account | Kind | Seeds | Space | Owner | Close target |
|---|---|---|---|---|---|
| `GlobalConfig` | zero-copy, caller-created | none (`#[account(zero)]`) | 2136 B (`consts.rs:13`, compile-asserted `state.rs:17-21`) | program | **none** (no close instruction — SM-031) |
| `FarmState` | zero-copy, caller-created | none (`#[account(zero)]`) | 8336 B (`consts.rs:14`, asserted `state.rs:61-64`) | program | **none** (SM-008/SM-031) |
| `UserState` | zero-copy PDA | `[b"user", farm_state, delegatee]` | 920 B (`consts.rs:15`, asserted `state.rs:492-495`) | program | `rent_receiver`, validated against `owner` / `farm_admin` (`handler_close_empty_user_state.rs:43-58`) |
| `farm_vault` | SPL token account | `[b"fvault", farm_state, token.mint]` | token layout | Token program | never closed |
| `reward_vault` | token / Token-2022 account | `[b"rvault", farm_state, reward_mint]` | token layout | Token(-2022) program | never closed |
| `reward_treasury_vault` | token / Token-2022 account | `[b"tvault", global_config, reward_mint]` | token layout | Token(-2022) program | never closed |
| `farm_vaults_authority` | PDA (signer only) | `[b"authority", farm_state]` | 0 | — | n/a |
| `treasury_vaults_authority` | PDA (signer only) | `[b"authority", global_config]` | 0 | — | n/a |

Relationships: `UserState.farm_state → FarmState`; `FarmState.global_config → GlobalConfig`; `FarmState.farm_vault → farm_vault`; `FarmState.reward_infos[i].rewards_vault → reward_vault_i`. Every one of these links is enforced at use time by `has_one` or by PDA seeds.

### State Machine Transitions

```
User stake lifecycle (non-delegated farm)
─────────────────────────────────────────
   (no account)
        │ initialize_user                                   [permissionless, self-seeded]
        ▼
   UserState{ stake=0 }
        │ stake(amount)
        ├─ deposit_warmup_period == 0 ──────────────► active_stake += shares
        └─ deposit_warmup_period  > 0 ──► pending_deposit_stake, ts = now + warmup
                                              │ (any refresh after ts)
                                              └─► activate_pending_stake ► active_stake
        │ unstake(shares)                                   [applies locking penalty → slashed_amount]
        ▼
   pending_withdrawal_unstake, ts = now + cooldown
        │ (ts elapsed)  withdraw_unstaked_deposits
        ▼
   tokens returned; pending = 0
        │ all balances zero + no unclaimed rewards
        │ close_empty_user_state                            [signer == owner, rent → owner]
        ▼
   (account closed — seeds reusable, fresh user_id on re-init)

Farm lifecycle
──────────────
   initialize_farm / initialize_farm_delegated ─► ACTIVE ──(withdraw_from_farm_vault drains all)──► "FROZEN"
                                                     ▲                                                  │
                                                     └──────────── flag never read, never cleared ──────┘   [F-006]

Reward lifecycle (per index)
────────────────────────────
   initialize_reward ─► add_rewards(+available) ─► refresh_global_reward(available → issued_unclaimed,
                                                     reward_per_share += r / total_active_stake)
                     ─► harvest(issued_unclaimed → user + treasury)
                     ─► withdraw_reward(available → admin, only while the schedule curve is default)
   reward_user_once(+issued_unclaimed, available UNCHANGED)                                             [F-004]
```

### Invariants Verified

| Property | Description | Status |
|---|---|---|
| INV-01 | `total_active_stake_scaled == Σ user.active_stake_scaled` (and the same for the pending pool) | ✅ PASS — every mutation is paired inside one accessor scope (`stake_operations.rs:190-194, 236-240, 338-479`) |
| INV-02 | `farm_vault.amount >= total_staked_amount + total_pending_amount + slashed_amount_current` | ✅ PASS — the penalty carve-out is added to `slashed_amount_current` (`farm_operations.rs:813-814`) exactly as it is withheld from the pending pool (`stake_operations.rs:489-531`); untracked donations only increase the left side |
| INV-03 | `reward_vault.amount >= rewards_available + rewards_issued_unclaimed` | ❌ **FAIL** — `reward_user_once` raises the right side with no inflow (`farm_operations.rs:746-750`) — **F-004** |
| INV-04 | Delegated farms: `total_active_stake_scaled == u128::from(total_staked_amount)` | ✅ PASS — asserted at `farm_operations.rs:514-517` and maintained by paired `op_u128`/`op_u64` application (`:562-563`); the instructions that could desync it are blocked on delegated farms |
| INV-05 | `Σ user.rewards_issued_unclaimed[i] <= reward_infos[i].rewards_issued_unclaimed` | ✅ PASS — the farm side is credited when rewards are issued globally (`farm_operations.rs:953-957`) and the user side only materialises a portion of that (`:664`); harvest debits both (`:604-609`) |
| INV-06 | Share↔amount exchange rate is invariant under permissionless operations | ✅ PASS — stake and unstake move shares and amounts together (`stake_operations.rs:397-406, 441-451`); only `deposit_to_farm_vault` / `withdraw_from_farm_vault` (both privileged) move the rate |
| INV-07 | Reward accrual monotonicity: `last_issuance_ts` is non-decreasing and never exceeds `now` | ⚠️ **PARTIAL** — enforced at `state.rs:437-440`, but the watermark can be frozen behind a future-dated curve point with no recovery — **F-001** |

---

## 9. Code Maturity Scorecard

> Engineering-quality gate (Phase 4.5), orthogonal to the risk score. 0 absent · 1 ad-hoc · 2 partial · 3 good · 4 strong (weakest-link).

| # | Category | Score (0-4) | Evidence (file:line / artifact) | Gap to next level |
|---|----------|:-----------:|---------------------------------|-------------------|
| 1 | Access Controls | **3** | Every privileged path binds its authority (`handler_withdraw_from_farm_vault.rs:51-55`, `handler_harvest_reward.rs:104-116`); two-step admin handover (`handler_update_farm_admin.rs:16`); `check_remaining_accounts` in all 26 handlers | No timelock or acceptance handshake on the fund-moving roles (F-007); no working pause (F-006) |
| 2 | Arithmetic | **2** | U192/U256 widening, multiply-before-divide, pool-favouring rounding (`utils/math.rs:68-95`, `stake_operations.rs:289-334`) — but ~40 bare operators relying on `overflow-checks` (`state.rs:476-477`) | Convert the value paths to `checked_*`/`saturating_*` with typed errors (F-003) |
| 3 | Account & Type Safety | **3** | Typed accounts throughout, canonical bumps, compile-time size assertions (`state.rs:17-21`), zero-copy via bytemuck, no `unsafe` | One constraint validates the wrong account (F-008); raw `AccountInfo` where `UncheckedAccount` belongs |
| 4 | Input Validation | **1** | Instruction *arguments* are validated (`handler_stake.rs:14`, `farm_operations.rs:776-779`), but 13 of 15 admin config values have no bounds and none are cross-validated (`farm_operations.rs:146-332`) | Bound every setter and validate the resulting config atomically (F-002, F-005) — **prioritised in the roadmap** |
| 5 | Testing | **0** | No `#[cfg(test)]`, no `#[test]`, no integration test; `tests/kfarms.ts:13` calls a non-existent instruction | Any executable suite at all (F-012) — **prioritised in the roadmap** |
| 6 | Fuzzing & Property Tests | **0** | No Trident/cargo-fuzz/Kani/Certora/proptest; no documented invariants | One fuzz target over the reward-curve accumulator and the share-conversion pair (F-012) — **prioritised** |
| 7 | Error Handling & DoS Resilience | **1** | 80 typed errors are defined (`lib.rs:189-429`) but 18 reachable sites panic instead (`utils/math.rs:42`, `stake_operations.rs:325,433`), and three of them brick a farm permanently | Eliminate panics on reachable paths and make the refresh path failure-tolerant (F-010, F-001, F-003) — **prioritised** |
| 8 | Upgradeability & Governance | **2** | Two-step admin transfer for both admin roles; on-chain `security_txt` with a policy URL and prior auditors (`lib.rs:26-35`) | No in-program timelock (OPS-053), no emergency pause (F-006), no event trail for privileged changes (F-014); upgrade-authority custody unverifiable here |
| 9 | Monitoring & Incident Response | **1** | `msg!`/`xmsg!` logging is present and reasonably detailed; a published security contact exists (`lib.rs:29`) | No events at all (F-014), no runbook in the repository, no pause to invoke (F-006) — **prioritised** |
| **Weighted Maturity** | | **1.4 / 4.0** | mean of the nine categories (13 / 9) | Weakest link: Testing and Fuzzing at 0 |

Categories scoring ≤ 1 — **Input Validation (1), Testing (0), Fuzzing & Property Tests (0), Error Handling & DoS Resilience (1), Monitoring & IR (1)** — are prioritised in the roadmap below regardless of individual finding severity.

---

## 10. Remediation Roadmap

### Immediate — Severity 9-10 (Block Deploy)

None.

### Before Release — Severity 7-8

None.

### Within 2 Weeks — Severity 5-6

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-001 | 6 | Return `Ok(0)` instead of an error when the reward schedule has not started; clamp `last_issuance_ts` to the schedule start on config write | 2-4 h + tests | Program team |
| F-002 | 5 | Bound every admin-settable numeric at write time (`rewards_per_second_decimals ≤ 19` first) and make `ten_pow` fallible | 4-8 h | Program team |
| F-003 | 5 | Convert the reward-issuance arithmetic to `saturating_*` (issuance is already clamped by `rewards_available`) and the remaining value math to `checked_*` | 1-2 d | Program team |
| F-004 | 5 | Debit `rewards_available` in `reward_user_once`, or document and assert the alternative funding model | 1-2 h + test | Program team |

### Next Sprint — Severity 3-4

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-005 | 4 | Bound `scope_oracle_price_id`; require a sane non-zero `scope_oracle_max_age`; initialise it explicitly in both farm-init handlers | 2-4 h | Program team |
| F-006 | 4 | Enforce `is_farm_frozen` on deposit-side instructions, add a setter, and refuse a full vault drain while pending withdrawals exist | 4-8 h | Program team |
| F-007 | 3 | `pending_withdraw_authority` + accept handshake + minimum delay + event | 1 d | Program team + governance |
| F-008 | 3 | One-line constraint fix (`rewards_treasury_vault.*`) | 15 min | Program team |
| F-009 | 3 | `require_gt!(num_reward_tokens, reward_index)` in `reward_user_once`; zero the `RewardInfo` slot in `initialize_reward` | 1 h | Program team |
| F-010 | 3 | Replace the 18 panic sites with typed errors; add a `clippy::unwrap_used` deny | 1 d | Program team |
| F-011 | 3 | Drop `PermanentDelegate`/`MintCloseAuthority` from the allowlist; check `freeze_authority` at `initialize_reward` | 4 h | Program team |
| F-012 | 3 | Mollusk/LiteSVM suite + invariant tests + a CI workflow (clippy, cargo audit, tests) | 1-2 weeks | Program team |
| F-013 | 3 | `saturating_sub` in both staleness checks | 30 min | Program team |

### Backlog — Severity 1-2

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-014 | 2 | Add `#[event]` structs and `emit!` for all financial operations and privileged changes | 1-2 d | Program team |
| F-015 | 2 | Add `token::authority` constraints to the two admin destination accounts | 30 min | Program team |
| F-016 | 2 | Extend `.gitignore`; move the provider wallet path outside the repository | 15 min | DevOps |
| F-017 | 2 | Pin the `scope` dependency to a `rev`/tag; add `cargo audit`/`cargo deny` | 1 h | DevOps |
| F-018 | 1 | Declare or delete the cluster features; align the `Anchor.toml` program key with the crate name | 30 min | Program team |

### Maturity-Driven Work (categories scoring ≤ 1, independent of finding severity)

| Category | Score | Action |
|---|:--:|---|
| Testing | 0 | Stand up the LiteSVM/Mollusk suite from F-012 before any further feature work |
| Fuzzing & Property Tests | 0 | Add one Trident/cargo-fuzz target over `RewardScheduleCurve::get_cumulative_amount_issued_since_last_ts` and the `convert_amount_to_stake` / `convert_stake_to_amount` pair |
| Input Validation | 1 | Ship the F-002/F-005 bounds as a single "config hardening" change with a table of min/max per parameter |
| Error Handling & DoS Resilience | 1 | Ship F-010 alongside F-003 so the refresh path both stops panicking and stops failing |
| Monitoring & IR | 1 | Ship F-014 (events), then write a runbook covering the F-006 pause once it exists |

---

## 11. Re-Audit Checklist

- [ ] All Critical findings fixed and verified — *none exist at this commit*
- [ ] All High findings fixed and verified — *none exist at this commit*
- [ ] F-001 fixed: a farm with a future-dated reward curve still permits stake/unstake/harvest (regression test required)
- [ ] F-002 fixed: every admin config setter rejects out-of-domain values, with a documented min/max table
- [ ] F-003 fixed: the reward-issuance path cannot abort on arithmetic for any admin-settable rate
- [ ] F-004 fixed: `reward_vault.amount >= rewards_available + rewards_issued_unclaimed` asserted by an invariant test
- [ ] Medium findings addressed or accepted with documented risk
- [ ] Regression tests added for each fix (blocked on F-012 — the suite must exist first)
- [ ] Program rebuilt and re-deployed; binary hash matches source (verifiable build)
- [ ] Upgrade-authority custody documented so OPS-001…012 can move from out-of-band to verified

---

## 12. Appendices

### A. Tool Versions

Declared by the repository (nothing was executed — see §3 Constraints):

```
anchor-lang / anchor-spl : 0.29.0            (Cargo.toml:12-14)
solana-sdk               : 1.17.18           (Cargo.toml:16)
spl-token                : 4.0.0             (Cargo.toml:18)
spl-associated-token-account : 2.3.0         (Cargo.toml:19)
decimal-wad              : 0.1.9             (Cargo.toml:21)
scope-types              : git 0c8f7925aad9f5cf30b6715f2bef0ece9235d87a  (Cargo.lock:1769-1771)
rustc                    : 1.74.1            (rust-toolchain.toml:2)
program version          : farms 1.7.0       (programs/kfarms/Cargo.toml:4)
```

### B. Environment

```
Audit type      : static, read-only, single-agent (corpus Mode 1, --scope program)
Executed        : nothing — no build, install, test, network or chain query
Cluster tested  : none (Anchor.toml declares `cluster = "Localnet"`)
RPC provider    : none used
Commit audited  : bfa186034ba8ecd36e7faf27cae6b38ee24d0bc4
Artifacts       : audit_2/intake.md · audit_2/checkpoint-01-code-walk.md · audit_2/REPORT.md · audit_2/roadmap.md
```

### C. Corpus Coverage

| auditor-skill file | Used |
|---|---|
| `SKILL.md`, `OUTPUT-RULES.md`, `FULL-AUDIT.md`, `QUESTIONS.md` | read in full (mandatory) |
| `templates/intake.md`, `templates/report-template.md`, `references/report-format.md` | read in full (mandatory) |
| `checklists/01`–`07`, `checklists/16` | loaded on demand as each phase began (in scope) |
| `checklists/08`–`15`, `17`–`20` | **never read** (out of scope — the scope gate emitted their verdicts) |
| `known-vectors/INDEX.md` | read in full (trigger table) |
| `known-vectors/006, 011, 012, 014, 017, 025, 029, 104, 106, 107, 111, 123, 127, 131` | opened and applied in full |
| all other vector files | resolved from the INDEX marker gate (feature-absent / out-of-scope), not read |
| `references/methodologies/*`, `references/vuln-classes/*` | not loaded — no methodology trigger fired beyond oracle/token-2022 markers, which the in-scope checklists already cover item-by-item |

### D. Disclaimer

This audit report is provided as-is. It represents a point-in-time review of the codebase at commit `bfa186034ba8ecd36e7faf27cae6b38ee24d0bc4` and nothing else. No guarantee is made that all vulnerabilities have been found. The review was performed by an autonomous agent using static analysis only: no code was built, executed, tested or deployed, no on-chain state was queried, and no proof-of-concept exploit was run — every finding's evidence tier is `[PoC-PROSE]`. Items that depend on deployment state or organisational process are explicitly marked `[N/A — out of band]` rather than passed. This is audit-shaped automation and a rigorous first pass, not a substitute for a human firm audit of business logic, economic design and legal compliance, and not a machine-checked proof of correctness. It does not constitute financial or legal advice, and it does not certify that the program is safe to deploy.
</content>
</invoke>
