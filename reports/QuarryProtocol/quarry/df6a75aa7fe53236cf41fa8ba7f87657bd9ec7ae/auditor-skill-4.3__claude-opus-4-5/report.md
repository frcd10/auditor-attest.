# Security Audit Report — Quarry Protocol

| Field | Value |
|---|---|
| **Repository** | Quarry Protocol (`Quarry/quarry`) — yield/liquidity-mining staking |
| **Scope** | `programs/quarry-mine`, `programs/quarry-mint-wrapper` (primary); `programs/quarry-merge-mine`, `programs/quarry-redeemer`, `programs/quarry-operator`, `programs/quarry-registry` (surveyed) |
| **Audit type** | AI-assisted first-pass, PROGRAM scope (on-chain Rust/Anchor) |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |
| **Program IDs** | mine `QMNeHCGYnLVDn1icRAfQZpjPLBNkfGbSKRB83G5d8KB`; mint-wrapper `QMWoBmAyJLAsA1Lh9ugMTw2gciTihncciphzdNzdZYV`; redeemer `QRDxhMw1P2NEfiw5mYXG79bwfgHTdasY2xNP76XSea9`; operator `QoP6NfrQbaGnccXQrMLUkog2tQZ4C1RFgJcwDnT8Kmz`; registry `QREGBnEj9Sa5uR91AV8u3FxThgP5ZCvdZUW2bHAkfNc` |

---

## 1. Executive Summary

Quarry is a mature, previously-audited (Quantstamp) liquidity-mining protocol modeled on Synthetix `StakingRewards`. The reward-accounting core (`payroll.rs`, `quarry.rs`, `rewarder.rs`) consistently uses `U192`/`u128` widened intermediates, `checked_*` arithmetic with `unwrap_int!`/`ok_or` propagation, and an explicit `sanity_check` upper-bound guard on claimable rewards. The mint authority is fully wrapped behind `quarry-mint-wrapper`, which enforces a per-minter `allowance` plus a global `hard_cap` and re-reads the mint supply post-mint to detect discrepancies — so even a logic error in reward accounting cannot mint beyond the configured cap. Account validation is conservative and centralized in `Validate` impls: signer checks, `has_one`/`assert_keys_eq!` for every authority and token-account relationship, and explicit rejection of token accounts carrying `delegate`/`close_authority`. Admin powers use two-step (propose/accept) authority transfer and an immutable claim fee fixed at 1 BP.

**Verdict:** No CONFIRMED vulnerabilities of severity ≥ 3 were found. The reviewed program scope is safe to deploy from a code-security standpoint. All observations are by-design trust assumptions or informational hardening notes (Section 3). The protocol carries the normal admin-trust assumption common to staking protocols (the Rewarder authority controls reward rates and shares; the MintWrapper admin controls minter allowances), appropriately gated by signer + key-equality checks and bounded by the hard cap.

### Repository Risk Score: 2 / 10 (Minimal / Informational only)

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 0 |
| High (7-8) | 0 |
| Medium (4-6) | 0 |
| Low (1-3) | 0 |
| Informational (1-2) | 3 |
| **Total confirmed (≥3)** | **0** |

---

## 2. Confirmed Findings

**None.** No finding at severity ≥ 3 was substantiated from the code.

---

## 3. Investigated but Not Confirmed

### 3.1 Reward accounting & rounding (refuted as exploitable)
- **Reward-per-token / rewards-earned math** — `payroll.rs:67-112`. Widens to `U192`, multiplies by `PRECISION_MULTIPLIER = u64::MAX` before dividing by `SECONDS_PER_YEAR` and `total_tokens_deposited`, narrows with `try_into().ok()?`; all `checked_*`. Division rounds down (protocol-favoring). Verified by repo proptests. **Refuted.**
- **Claimable upper-bound guard** — `payroll.rs:137-187`. `sanity_check` independently bounds claimable from elapsed time × rate and rejects excess. Second independent ceiling on `update_rewards_and_miner` (`quarry.rs:37-61`). **Defense-in-depth present.**
- **`total_tokens_deposited == 0` divide-by-zero** — `payroll.rs:68-69` short-circuits before the division. **Refuted.**
- **First-depositor / share-inflation** — N/A: time-based emission proportional to staked balance, no NAV/share-vault; staked tokens held 1:1 (`lib.rs:263-348`).

### 3.2 Mint authority abuse (refuted)
- **`perform_mint` cap enforcement** — `quarry-mint-wrapper/src/lib.rs:130-170`. Checks `allowance >= amount`, `new_supply <= hard_cap`, decrements allowance, mints via PDA, then `reload()`s mint and asserts `new_supply == supply`. Reward-accounting bugs cannot exceed allowance/hard cap. **Strong containment.**
- **Minter defaults** — `new_minter.rs:17` allowance=0; only wrapper `admin` raises it. Rewarder PDA signs CPI (`claim_rewards.rs:83-98`). **Refuted.**
- **`minter_authority` substitution** — `account_validators.rs:43-50` enforces signer + key match + destination mint. **By design.**

### 3.3 Account / signer validation (refuted)
- **`UserStake`** — `account_validators.rs:104-130`: signer, `authority==miner.authority`, `miner.quarry==quarry`, `token_vault_key==miner_vault`, `miner_vault.owner==miner`, mint match, `quarry.rewarder==rewarder`; withdraw CPI Miner-PDA-signed, bounded by `amount<=miner_vault.amount`. **Refuted.**
- **`rescue_tokens`** — `rescue_tokens.rs:44-62`: rescued account must be miner-owned and `assert_keys_neq!` the staking vault; caller must be `miner.authority`. **Refuted.**
- **`extract_fees`** — `account_validators.rs:132-164`: fee account pinned to stored key, destination owner must equal hardcoded `addresses::FEE_TO`, no delegate/close authority. **Refuted.**
- **Redeemer** — `quarry-redeemer/account_validators.rs:15-37`: balances bounded, burn-then-transfer checked. **Refuted.**
- **Merge-mine** — pre/post-instruction `invariant!` reconciliation of balances & replica supply; `mm_cpi.rs` under `#![deny(clippy::integer_arithmetic)]`. **Refuted.**
- **Registry `sync_quarry`** — enforces `quarry.rewarder==registry.rewarder`; holds no funds. **N/A.**

### 3.4 Admin authority & governance (by-design)
- Two-step propose/accept authority transfer (mine `lib.rs:107-126`; wrapper `lib.rs:57-85`).
- Dedicated `pause_authority`; every user `Validate` calls `assert_not_paused()`.
- `set_rewards_share`/`update_quarry_rewards` rate handling (`lib.rs:172-192`): checkpoint uses pre-change rate before adopting the new rate, so accrual ordering is correct; residual is admin-coordination, bounded by hard cap.

### 3.5 Informational items
- **INFO-1 (sev 2)** — Centralized reward-rate & share control (Rewarder authority / operator roles); bounded by `MAX_ANNUAL_REWARDS_RATE` (`lib.rs:131-134`) and hard cap. Intended governance model.
- **INFO-2 (sev 2)** — Global pause is a single-key liveness/griefing risk (cannot move funds). Consider multisig/timelock.
- **INFO-3 (sev 1)** — Stale fields: `Quarry::token_mint_decimals` (`state.rs:71`), `addresses::FEE_SETTER` (unused). Cosmetic.

---

## Appendix — Coverage & Limitations

Files read in full across quarry-mine, quarry-mint-wrapper, quarry-redeemer, quarry-operator, quarry-registry, and quarry-merge-mine (validators, payroll, state, instruction handlers). Cross-cutting greps for unchecked casts/bare arithmetic. Checklists 01-07 applied (adapted to the Synthetix emission model). Limitations: AI-assisted first-pass, on-chain scope only; deprecated v1 variants confirmed to delegate to v2 handlers; no dynamic testing/fuzzing beyond repo proptests; no key-management verification.
