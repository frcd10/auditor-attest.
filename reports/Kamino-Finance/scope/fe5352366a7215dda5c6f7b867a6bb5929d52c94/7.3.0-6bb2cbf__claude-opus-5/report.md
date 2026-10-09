# 🔒 Security Audit Report

## 1. Executive Summary

**Repository:** `Kamino-Finance/scope` (local clone: `examples i runned local/Kamino/scope`)
**Commit:** `fe5352366a7215dda5c6f7b867a6bb5929d52c94` (short `fe53523`, "Release 0.41.0 (#52)")
**Branch:** detached HEAD (upstream default `master`)
**Date:** 2026-09-11
**Auditor:** auditor-skill 7.3.0@6bb2cbf — autonomous agent, Mode 1 (FULL repository walk), linear single-agent execution
**Scope:** PROGRAM (`--scope program`)
**Program ID:** `HFn8GnPADiny6XqUoWE8uRPPxb29ikn4yTuPa9MF2fWJ` (mainnet; staging `scpStzYvKzE7DHwsGMP5XLhcMTuLr3feoiC9mJ3yHr5`, devnet `3Vw8Ngkh1MVJTPHthmUbmU2XKtFEkjYvJzMqrv2rh9yX`, localnet `2fU6YqiA2aj9Ct1tDagA8Tng7otgxHM5KwgnsUWsMFxM` — `programs/scope/src/program_id.rs:34-42`)
**Languages Detected:** Rust only (108 `.rs` files, 12 467 tracked LoC). No TypeScript, Python, Go, Java, Ruby or PHP anywhere in the tree.
**Repository Risk Score:** **6 — 🟡 MEDIUM** (fix soon; no deploy blocker found)

### What We Found

Scope is Kamino's on-chain price-oracle aggregator: it copies and derives prices from roughly thirty
upstream sources (Pyth Pull, Pyth Lazer, Chainlink Data Streams, Switchboard On-Demand, RedStone,
Securitize, SPL/Marinade/Jito stake rates, Kamino kTokens, klend cToken rates, and several CLMM/LP
pools) into a single 512-entry feed that other Kamino programs price against. The program custodies
no funds, so nothing here can be drained directly — but everything here is a pricing input to
protocols that do hold funds, so the whole attack surface is *price integrity*.

The code is unusually careful for its size. Prices are pinned to admin-configured source accounts
before any parse; the generic refresh path refuses to run inside a CPI or behind any non-ComputeBudget
instruction; replay is blocked by strictly-increasing report timestamps; suspension/resume is bound
to the exact 24-byte record it was issued for; and the live mainnet configuration layers a
`MostRecentOf` divergence gate plus a `CappedFloored` clamp so a manipulable AMM price can never
*become* a published price. We found **no critical or high-severity issue** and no path by which an
unprivileged attacker can write a value of their choosing into the feed.

The most serious finding (**F-001, severity 6**) is the mirror image of that defence: because the
divergence gate compares a signed oracle against a *permissionlessly movable* CLMM pool price, and
because `refresh_price_list` requires no signer at all, anyone who can push a thin RWA pool past the
configured tolerance can stop a live composite entry from refreshing and let the published
"Checked …" price age out — halting that collateral market. It is griefing, not theft, and it is
partly the system working as designed; the defect is that the trigger is in an attacker's hands.
Below that sit two severity-5 issues (the CPI ban is applied to one of three refresh instructions;
`KTokenToTokenA/B` prices a position split from the raw pool `sqrt_price`, contradicting its own doc
comment) and a set of severity-4 hardening gaps, of which the most consequential for assurance is
that **this repository ships with no tests, no CI, and no fuzzing at all** (F-008).

This report does **not** issue a "safe to deploy" clearance. It is a rigorous first pass over a
single pinned commit, not a substitute for a human firm audit; the trust assumptions it rests on are
listed in §4.6 and in `audit_2/intake.md`.

### Severity Distribution

| Score | Label | Count |
|-------|-------|-------|
| 10 | 🔴 CRITICAL | 0 |
| 9 | 🔴 CRITICAL | 0 |
| 8 | 🟠 HIGH | 0 |
| 7 | 🟠 HIGH | 0 |
| 6 | 🟡 MEDIUM | 1 |
| 5 | 🟡 MEDIUM | 2 |
| 4 | 🔵 LOW | 5 |
| 3 | 🔵 LOW | 6 |
| 2 | ⚪ INFO | 6 |
| 1 | ⚪ INFO | 1 |
| **Total Findings** | | **21** |

> The count in each row equals the number of `[F-xxx]` finding blocks at that severity in §4. Item
> verdicts in §5 may carry the same `[FAIL-N]` marker more than once when several checklist items
> are evidence for one finding (e.g. twenty checklist-16 items all point at F-008); those repeats are
> **not** counted here.

### Items Verified

| Metric | Count |
|--------|-------|
| Total checklist items | 591 |
| PASS | 159 |
| FAIL | 26 |
| PARTIAL | 81 |
| N/A | 325 |
| Completion | 100 % |

---

## 2. Scope Coverage

> Rule 0: out-of-scope rows are generated from the scope gate, not from reading the files.

| Checklist / vector group | In scope? | Items evaluated / total | Trigger / reason |
|---|---|---|---|
| 01 Account Validation | Yes | 90 / 90 | `.rs` under `programs/`, Anchor 0.28 |
| 02 Access Control | Yes | 50 / 50 | on-chain program |
| 03 Arithmetic Safety | Yes | 63 / 63 | on-chain program |
| 04 CPI & PDA Safety | Yes | 70 / 70 | on-chain program |
| 05 State Machine & Lifecycle | Yes | 72 / 72 | on-chain program |
| 06 Economic & Logic | Yes | 89 / 89 | on-chain program; price is the economic primitive |
| 07 OpSec & Governance | Yes | 85 / 85 | on-chain program |
| 08–10 off-chain (TS / backend / web) | No | 0 / 208 | N/A — out of scope: zero `.ts`/`.tsx` files in the repository |
| 11 Supply Chain | No | 0 / 52 | N/A — out of scope: `PROGRAM` gate (FULL-AUDIT.md § Scope Control). Program-relevant dependency observations are folded into OPS-075 |
| 12 Secrets & Key Management | No | 0 / 53 | N/A — out of scope: `PROGRAM` gate. Key-material observations folded into OPS-027…036 |
| 13 Deployment & Infrastructure | No | 0 / 89 | N/A — out of scope: `PROGRAM` gate; no deployment artefacts in the repository |
| 14 Python Safety | No | 0 / 82 | N/A — out of scope: zero `.py` files |
| 15 General Language Safety | No | 0 / 88 | N/A — out of scope: zero `.go`/`.java`/`.rb`/`.php` files |
| 16 Formal Verification & Testing | Yes | 72 / 72 | `PROGRAM` gate includes 16 |
| 17 Logging, Monitoring & IR | No | 0 / 65 | N/A — out of scope: `PROGRAM` gate. Monitoring observations folded into OPS-048…052 and F-013 |
| 18 Privacy, Compliance & Change Mgmt | No | 0 / 60 | N/A — out of scope: `PROGRAM` gate; no PII processed |
| 19 AI Agent Security | No | 0 / 33 | N/A — out of scope: no `.mcp.json`, no agent SDK, no LLM dependency |
| 20 Rust Off-Chain Services | No | 0 / 21 | N/A — out of scope: every `.rs` file is under `programs/`; no off-chain binary |
| **KV crypto / on-chain (001–030)** | Yes | 30 / 30 | on-chain program |
| **KV modern on-chain (101–109)** | Yes | 9 / 9 | sysvars, Token-2022, PDA bumps present |
| **KV 111 (BPF stack)** | Yes | 1 / 1 | large zero-copy structs |
| **KV governance & randomness (118–120)** | Yes | 3 / 3 | admin rotation present |
| **KV modern surface (121–123)** | Yes | 3 / 3 | event parsing / lamport donation |
| **KV custody & consumers (125–126)** | Yes | 2 / 2 | on-chain phase |
| **KV DoS / float / keeper / CLMM (127–131)** | Yes | 5 / 5 | `init`, `f64`, crank, `sqrt_price` all present |
| **KV token registries (132–134)** | Yes | 3 / 3 | on-chain phase |
| **KV transaction v1 (135–136)** | Yes | 2 / 2 | `ComputeBudget` introspection present (`handler_refresh_prices.rs:227`) |
| **KV off-chain (031–100)** | No | 0 / 70 | N/A — out of scope: backend/frontend/devops categories, no such surface in scope |
| **KV AI + off-chain Rust (110, 112–117)** | No | 0 / 7 | N/A — out of scope: no AI/agent or off-chain Rust component |
| **KV 124 custodial key export** | No | 0 / 1 | N/A — out of scope: no custody/wallet component |

### Scope Metrics

| Metric | Count |
|---|---:|
| In-scope checklist items | 591 |
| Items with a verdict | 591 |
| In-scope known-vectors | 58 |
| Known-vectors with a verdict | 58 |
| Completion (in-scope) | **100 %** |

### Coverage limitations (stated, not hidden)

1. **Nothing was built, run or queried.** The engagement is static and read-only by instruction. Every
   item that can only be answered by an on-chain query (upgrade authority, multisig threshold,
   verifiable-build hash) renders `[N/A — not verifiable offline]` with that exact reason, never
   `[PASS]`. This affects OPS-001…010, 012, 017, 026, 037…043, 049, 054, 070, 073, 081, 085 and KV-020.
2. **Five dependencies are not vendored** and were reviewed only at the call boundary: `yvaults`
   (private repo, gates the `KToken*` oracles), `whirlpool`, `raydium-amm-v3`, `pyth-lazer-*`, and
   `chainlink-streams-report`. Where a conclusion depends on their internals it is marked
   `[UNKNOWN — needs manual review]` in the worksheets rather than asserted.
3. **The interface crates are assumed layout-accurate.** `lb-clmm-itf::LbPair`, `klend-itf::Reserve`,
   `sbod-itf::PullFeedAccountData`, `jito_vault_core::Vault`, `adrena`/`flashtrade` `Pool` and
   `securitize-itf::VaultState` are hand-transcribed mirrors of third-party account layouts. A silent
   upstream layout change would make Scope read the wrong bytes; only `sbod-itf` and `klend-itf`
   carry `static_assertions` size checks, and none can detect a *field reordering* that preserves
   size. This is an assumption, not a finding, because no drift was observed at this commit.

---

## 3. Scope & Methodology

### Files Audited

| Domain | Language | Files | Lines of Code |
|---|---|---|---|
| Solana program (`programs/scope/src/`) | Rust | 62 | 9 108 |
| Types crate (`programs/scope-types/`) | Rust | 12 (10 are symlinks into `programs/scope/src/`) | 50 unique |
| Interface crates (`programs/*-itf/`, `yvaults_stub/`) | Rust | 34 | 3 309 |
| Build / manifest / toolchain | TOML, Rust | 17 | 240 |
| Feed configuration | JSON | 2 | 4 920 (data, not code) |
| **Total (tracked at commit)** | | **127** | **12 467 Rust LoC** |

Counts from `git ls-files` at the audited commit. `AUDITOR/`, `audit_1/` and `audit_2/` are untracked
scratch directories and are excluded (see §4.7).

### Method actually followed

1. **Phase −1 — scope declaration.** Extension/marker discovery → PROGRAM gate → checklists 01–07 + 16
   in scope; 58 of 136 known vectors in scope. Recorded above.
2. **Phase 0 — setup.** Manifests, `build.rs` cluster gating, program ids, `.gitignore`, `README.md`,
   both mainnet feed configs. Intake persisted to `audit_2/intake.md` with every QUESTIONS.md default
   recorded under §8 of that file.
3. **Phase 0.5 — context reconstruction.** Worksheets written for the five load-bearing functions
   before any severity-≥6 verdict, per FULL-AUDIT.md: `refresh_price_list`,
   `get_most_recent_price_from_sources`, `capped_floored::get_price`,
   `update_mapping_and_metadata::process`, and `securitize::get_sacred_price` + the admin-rotation /
   freeze-resume triad. See `audit_2/worksheets/context/`.
4. **Phase 1 — per-instruction and per-oracle review.** All 14 instruction handlers and all 31 oracle
   modules read in full, one file at a time, plus the 8 state modules, 7 utility modules, the
   Token-2022 compat parser, and the interface crates. Checkpoint at `audit_2/checkpoint.md`.
5. **Phases 3.1 / 4.1 / 4.4 / 4.5** — checklist 07, checklist 16, phase-triggered known vectors, and
   the maturity scorecard.
6. **Rule 5b gate** applied to every candidate ≥ 6. One candidate (a `CappedFloored` staleness-laundering
   path initially scored 6) was **downgraded to 4** when the live configuration was shown to bound it
   transitively; one (`KTokenToTokenA/B`) was downgraded from 7 to 5 on reachability. Both downgrades
   are shown in the finding blocks.

### Checklists Applied

| # | Checklist | Items | Pass | Fail | Partial | N/A | Pass Rate (excl. N/A) |
|---|---|---|---|---|---|---|---|
| 01 | Account Validation | 90 | 46 | 0 | 16 | 28 | 74.2 % |
| 02 | Access Control | 50 | 22 | 3 | 4 | 21 | 75.9 % |
| 03 | Arithmetic Safety | 63 | 17 | 0 | 11 | 35 | 60.7 % |
| 04 | CPI & PDA | 70 | 15 | 0 | 5 | 50 | 75.0 % |
| 05 | State Machine | 72 | 21 | 1 | 9 | 41 | 67.7 % |
| 06 | Economic & Logic | 89 | 14 | 1 | 11 | 63 | 53.8 % |
| 07 | OpSec & Governance | 85 | 16 | 1 | 14 | 54 | 51.6 % |
| 16 | Formal Verification & Testing | 72 | 8 | 20 | 11 | 33 | 20.5 % |
| | **Total (in scope)** | **591** | **159** | **26** | **81** | **325** | **59.8 %** |

> Non-applicable checklists (08–15, 17–20) are excluded from the totals entirely, per the template note.

---

## 4. Findings

> Full blocks for severity ≥ 4. Severity 1–3 findings carry a compact block (Rule 5 permits the inline
> verdict alone; they are given blocks here so the Severity Distribution table is exactly the set of
> blocks below).

---

#### [F-001] Permissionless refresh plus an attacker-movable CLMM divergence gate is a remote kill-switch on live RWA price entries

| Field | Value |
|---|---|
| **Severity** | 6 — 🟡 MEDIUM |
| **Checklist Item** | ECON-060 (also AC-041, ECON-051, ECON-056, KV-005, KV-129) |
| **Category** | Economic / Oracle manipulation (availability) |
| **Language** | Rust |
| **File** | `programs/scope/src/oracles/most_recent_of.rs:113-119` · `programs/scope/src/oracles/orca_whirlpool.rs:57-74` · `programs/scope/src/oracles/raydium_ammv3.rs:15-32` · `programs/scope/src/handlers/handler_refresh_prices.rs:19-30` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` — structured attacker narrative; no executable harness (no build/run permitted in this engagement) |

**Description**

`refresh_price_list` carries **no `Signer` at all** (`handler_refresh_prices.rs:19-30`): the account
struct is four accounts, none of them a signer. Anyone can refresh any entry at any time.

Several live entries are `MostRecentOf` composites whose source set mixes a signed oracle with an
*instantaneous CLMM pool price*. `get_most_recent_price_from_sources` rejects the entire refresh if the
min/max spread across sources exceeds `max_divergence_bps`:

```rust
// most_recent_of.rs:113-119
assert_prices_within_max_divergence(
    min_price, min_price_index, max_price, max_price_index, max_divergence_bps,
)?;
Ok(*most_recent_price)
```

The CLMM leg is read straight from the pool's current `sqrt_price` and stamped as if freshly attested:

```rust
// orca_whirlpool.rs:57-74  (raydium_ammv3.rs:15-32 and meteora_dlmm.rs:60-94 are identical in shape)
let price = sqrt_price_to_price(a_to_b, pool_data.sqrt_price, mint_a_decimals, mint_b_decimals)?;
Ok(DatedPrice { price, last_updated_slot: clock.slot, unix_timestamp: clock.unix_timestamp as u64, .. })
```

Anyone can move `pool_data.sqrt_price` with a swap. Pushing it beyond `max_divergence_bps` makes the
composite entry permanently un-refreshable for as long as the pool stays off-peg. The downstream
`CappedFloored` "Checked …" entry that consumers actually price against keeps refreshing, but it
inherits its **timestamp** from the now-frozen composite (`capped_floored.rs:40-43, 80-83`), so the
published price ages out and every consumer max-age check starts failing.

**Impact**

A collateral market halt on the affected asset, triggerable by any unprivileged actor for the cost of
holding a thin pool off its peg. In the live mainnet feed
`3t4JZcueEzTbVP6kLxXrL3VpWx45jDer4eqysweBchNH.json` this covers at least:

| Composite | Divergence | AMM leg | Consumer entry |
|---|---|---|---|
| 310 MostRecent PRIME/USD | 30 bps | 448 Orca PRIME/PYUSD | 311 Checked PRIME/wYLDS |
| 346 MostRecent QQQx/USD | 500 bps | 345 | 347 Checked QQQx/USD |
| 349 MostRecent ONyc/USD | 100 bps | 348 Orca ONyc/USDC | 350 Checked ONyc/USD |
| 352 MostRecent PST/USDC | 100 bps | 351 Orca PST/USDC | 353 Checked PST/USDC |
| 393 MostRecent STRCx/USD | 1000 bps | 391 Raydium STRCx/USDC | 394 Checked STRCx/USD |

The 30 bps window on entry 310 is the cheapest: a 0.3 % push on an Orca PRIME/PYUSD pool is enough.
Because the halt is *also* the intended safety response to genuinely diverging sources, it cannot be
distinguished from a real incident without off-chain context, which lengthens the operational
response.

**Reachability**

- Entry point: `scope::refresh_price_list` @ `handler_refresh_prices.rs:32`, reached from
  `lib.rs:52-57`.
- Signer / authority required: **permissionless** — `RefreshList` @ `handler_refresh_prices.rs:19-30`
  declares no `Signer<'info>`.
- Preconditions: an entry of type `MostRecentOf`/`CappedMostRecentOf` whose `source_entries` include a
  CLMM type. Confirmed present in the live config at entries 310, 346, 349, 352, 393
  (`configs/mainnet/3t4J….json:1404-1408, 1667-1672, 1686-1691, 1705-1710, 1929-1934`).
- Guard analysis: `check_execution_ctx` @ `handler_refresh_prices.rs:207-232` blocks the *same-transaction*
  manipulate-then-refresh, and the `CappedFloored` cap==floor clamp
  (`capped_floored.rs:73-78`, config `:1674-1679` etc.) prevents the AMM price from ever *becoming*
  the published price. Neither guard blocks this: the attacker's swap and the refresh live in
  different transactions, and the halt is produced by the refresh **failing**, not succeeding.
- **Verdict: REACHABLE.**

**Math / State-Bounds**

- Vulnerable transition: `spread = max_price − min_price`; refresh aborts when
  `min_price × max_divergence_bps ≤ spread × 10 000` (`math.rs:244-248`).
- Input domain: `max_price`/`min_price` are two entries' `Price` values; one is the attacker-movable
  pool price, unbounded within the pool's tick range.
- Boundary that breaks: any `spread/min > max_divergence_bps/10 000`.
- Worked case — entry 349 (ONyc, 100 bps): let the Chainlink-derived leg (246) be $1.0000. Pushing
  Orca ONyc/USDC (348) to $1.0101 gives `spread/min = 1.01 % > 1.00 %` ⇒
  `CompositeOracleMaxDivergenceBpsViolated` ⇒ 349 stops updating. Entry 350 still refreshes, returning
  price = entry 246 with **entry 349's frozen `unix_timestamp`**. After
  `TokenMetadata.max_age_price_slots` slots elapse, 350 reads as stale to every consumer.
- Net effect: availability loss on one collateral asset, for as long as the pool is held off-peg. No
  state corruption; no value moved inside Scope.

**Attacker-Model**

- Capability: permissionless caller with swap capital on one thin CLMM pool. No signer, no role, no
  prior state.
- Capital / setup cost: the round-trip slippage plus fees of moving a low-liquidity RWA pool ~1 %,
  repeated each time arbitrage restores it. Order of magnitude: low tens of thousands of dollars of
  working capital, of which only the slippage is spent.
- Profit / damage: **griefing — no direct profit inside Scope.** Indirect leverage exists (freezing a
  collateral price can stall liquidations against one's own position), but quantifying that requires
  the consumer protocol's stale-price policy, which is out of scope — *extent not determined within
  this assessment*.
- Atomicity: multi-transaction (swap, then refresh, then hold).
- Net: **griefing-only.** Per Rule 1 this caps the score: impact 7 (a live collateral market is
  rendered unusable) reported at **6** because there is no direct extraction and the state is
  self-healing the moment the pool returns to peg.

**Proof of Concept**

```text
Actor:      Eve, permissionless, holding USDC and ONyc.
Target:     feed 3t4JZcueEzTbVP6kLxXrL3VpWx45jDer4eqysweBchNH, entry 350 "Checked ONyc/USD".

1. Observe entry 246 (signed ONyc/USD) = P. Entry 349 requires |348 − 246| / min ≤ 100 bps.
2. tx A: swap on the Orca ONyc/USDC whirlpool (7jhhyxPUKpu42hPGSYwgMXbR2dtVJHKhs8DW3sAAgAvX)
         until its spot price is 1.02 * P. Cost = slippage + fee.
3. tx B: scope::refresh_price_list(tokens = [348, 349]).
         - 348 refreshes to 1.02*P, stamped last_updated_slot = current slot   (orca_whirlpool.rs:71)
         - 349 aborts: assert_prices_within_max_divergence fails at 200 bps > 100 bps
                                                                     (most_recent_of.rs:113-119)
           -> entry 349 keeps its OLD price AND its OLD unix_timestamp.
4. Anyone (including the honest crank) may now call refresh_price_list([350]) repeatedly.
   capped_floored::get_price copies 349's stale unix_timestamp (capped_floored.rs:40-43, 80-83)
   and clamps the price to entry 246 -> published price is correct, published AGE is not.
5. After TokenMetadata.max_age_price_slots slots, every consumer of entry 350 rejects the price.
   ONyc is unusable as collateral until Eve stops holding the pool off-peg.
```

**Recommendation**

```rust
// Option A (preferred) — let MostRecentOf degrade instead of failing closed on an untrusted leg.
// Mark which sources are "advisory" (movable) vs "attesting" (signed), and drop an advisory source
// that falls outside tolerance rather than aborting the entry.
pub struct MostRecentOfData {
    pub source_entries: [u16; SOURCE_ENTRIES_CHAIN_SIZE],
    pub advisory_mask: u8,        // NEW: bit i set => entry i may be dropped, not fatal
    pub max_divergence_bps: u16,
    pub sources_max_age_s: u64,
}
// ... in get_most_recent_price_from_sources, on a divergence violation:
//   if advisory_mask.bit(i) { warn!(...); continue; } else { return Err(...); }
// At least one attesting source must survive, else fail as today.

// Option B — keep the gate fatal but stop laundering the freshness:
// publish the OLDEST of source/cap/floor so a halted composite is visibly stale at its own entry,
// and have consumers read the health bit rather than inferring it from age.
// (This is also the F-005 fix.)
```

Operationally, until a code fix lands: make sure the `emergency_council` runbook covers "freeze the
AMM leg" (`handler_freeze_price.rs:41` — the council can freeze without the admin), and confirm with
each consumer that a stale `Checked …` entry means *block new borrows*, not *liquidate at the last
price*.

---

#### [F-002] The CPI ban is applied to one of three refresh instructions

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM |
| **Checklist Item** | AC-046 (also ECON-005, KV-003, KV-028) |
| **Category** | Access Control / execution-context isolation |
| **Language** | Rust |
| **File** | `programs/scope/src/handlers/handler_refresh_chainlink_price.rs:56-60` · `programs/scope/src/handlers/handler_refresh_pyth_lazer_price.rs:51-56` (contrast `handler_refresh_prices.rs:36`) |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description**

`refresh_price_list` opens with an explicit execution-context guard:

```rust
// handler_refresh_prices.rs:36
check_execution_ctx(&ctx.accounts.instruction_sysvar_account_info)?;
```

which rejects the instruction if it is running inside a CPI (`ScopeError::RefreshInCPI`, L214 and
L219) or if any preceding top-level instruction belongs to a program other than ComputeBudget
(`ScopeError::RefreshWithUnexpectedIxs`, L224-229). The program even defines dedicated error variants
for both conditions (`errors.rs:48-52`).

Neither `refresh_chainlink_price` nor `refresh_pyth_lazer_price` calls it. Both write the same
`OraclePrices` account (`handler_refresh_chainlink_price.rs:128`,
`handler_refresh_pyth_lazer_price.rs:190`) and both update TWAPs
(`:206-214`, `:138-148`). `refresh_pyth_lazer_price` does not even take the Instructions sysvar for
its own use — it takes it only to forward to the Pyth Lazer verify CPI (`:46-48, 214`).

**Impact**

Two consequences, both bounded because neither oracle's price can be *forged* (the report is
signature-verified by the Chainlink verifier / Pyth Lazer contract, and replay is blocked by a
strictly-increasing timestamp at `chainlink.rs:174-177` and `pyth_lazer.rs:300-303`):

1. **Atomic report selection.** A caller may, in a single transaction, choose which of several validly
   signed recent reports to post and then immediately act on the resulting price — e.g.
   `[refresh_chainlink_price(favourable report), liquidate]`. `refresh_price_list` callers cannot do
   the analogous thing with a manipulated pool.
2. **Composability the program otherwise forbids.** Another program can CPI into these two handlers
   and drive a Scope price update from inside its own flow. Whether that is acceptable is a design
   decision; right now it is neither blocked nor documented, and the asymmetry with the third
   instruction reads as an oversight rather than a choice.

**Reachability**

- Entry points: `scope::refresh_chainlink_price` @ `lib.rs:59-69`, `scope::refresh_pyth_lazer_price`
  @ `lib.rs:73-85`.
- Signer / authority required: `user: Signer` on both (`handler_refresh_chainlink_price.rs:26`,
  `handler_refresh_pyth_lazer_price.rs:21`) — but any keypair qualifies; it exists to pay the Pyth
  Lazer fee and to satisfy the Chainlink verifier's `user` slot.
- Preconditions: a validly signed report newer than the stored `observations_timestamp`. Chainlink
  Data Streams and Pyth Lazer both publish continuously, so at any moment several qualifying reports
  exist.
- Guard analysis: none. There is no `check_execution_ctx`, no `get_stack_height` test, and no
  instruction-index inspection in either handler. `require_keys_eq!(return_program_id,
  VERIFIER_PROGRAM_ID)` (`handler_refresh_chainlink_price.rs:94-98`) authenticates the report, not the
  execution context.
- **Verdict: REACHABLE.**

**Math / State-Bounds**

- Vulnerable transition: `*dated_price_ref = DatedPrice { price, .. }` @ `chainlink.rs:279-284`
  (and the v7/v8/v9/v10 equivalents), executed inside an attacker-composed transaction.
- Input domain: the set of Chainlink/Pyth-Lazer reports with
  `observations_timestamp > stored.observations_timestamp` and, for Chainlink v8/v10, passing the
  market-status gate (`chainlink.rs:185-238`).
- Boundary that breaks: none arithmetically — the defect is temporal, not numeric. The attacker's
  choice set is "any valid newer report", and the staleness window is `PRICE_STALENESS_S = 60`
  (`chainlink.rs:28`) for market-status-gated feeds and unbounded for the others.
- Net effect: the published price is always a genuine signed print; the attacker controls only *which*
  genuine print lands and *when* relative to their own action. No value is created inside Scope.

**Proof of Concept**

```text
Actor:      Eve, any keypair with SOL for the Pyth Lazer fee.
Capability: build a transaction; obtain signed reports from the public Chainlink / Pyth Lazer APIs.

Single transaction:
  ix 0: ComputeBudget::SetComputeUnitLimit        (allowed by check_execution_ctx anyway)
  ix 1: <any program Eve likes>                    <-- would be rejected before refresh_price_list
  ix 2: scope::refresh_chainlink_price(token, report_R)
        - no check_execution_ctx -> accepted regardless of ix 1
        - report_R is any validly signed report with observations_ts > stored ts
  ix 3: <consumer protocol action priced off the entry Eve just set>

Equivalently, a program P may CPI into ix 2 from inside its own handler; the RefreshInCPI error
(errors.rs:48-49) is never raised because check_execution_ctx is not called.
```

**Recommendation**

```rust
// handler_refresh_chainlink_price.rs — at the top of refresh_chainlink_price:
pub struct RefreshChainlinkPrice<'info> {
    // ... existing accounts ...
    /// CHECK: Sysvar fixed address
    #[account(address = SYSVAR_INSTRUCTIONS_ID)]
    pub instruction_sysvar_account_info: AccountInfo<'info>,   // ADD
}

pub fn refresh_chainlink_price(...) -> Result<()> {
    check_execution_ctx(&ctx.accounts.instruction_sysvar_account_info)?;   // ADD
    ...
}

// handler_refresh_pyth_lazer_price.rs — the sysvar account is already present as
// `instructions_sysvar` (:46-48); reuse it:
pub fn refresh_pyth_lazer_price(...) -> Result<()> {
    check_execution_ctx(&ctx.accounts.instructions_sysvar)?;               // ADD
    ...
}
```

Note that `check_execution_ctx`'s ComputeBudget allowlist must be widened for these two handlers if
the ed25519 precompile instruction has to precede `refresh_pyth_lazer_price` in the same transaction —
in that case, allow exactly `{ComputeBudget111…, Ed25519SigVerify111…}` and nothing else, rather than
dropping the guard. If the composability is deliberate, say so in a code comment next to the missing
call so the asymmetry is legible.

---

#### [F-003] `KTokenToTokenA/B` prices the position split from the raw pool `sqrt_price`, contradicting its own doc comment and the sibling `KToken` oracle

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM |
| **Checklist Item** | ECON-060 (also AR-047, KV-005) |
| **Category** | Economic / Oracle manipulation |
| **Language** | Rust |
| **File** | `programs/scope/src/oracles/ktokens_token_x.rs:168-202` (contrast `programs/scope/src/oracles/ktokens.rs:252-302`) |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description**

`ktokens::holdings` — the oracle for `OracleType::KToken` — deliberately refuses to trust the pool:

```rust
// ktokens.rs:252-281
/// Use a sqrt price derived from price_a and price_b, not from the pool as it cannot be considered reliable
let pool_sqrt_price = price_utils::sqrt_price_from_scope_prices(...)?;
// ... and that oracle-derived value is what is passed on:
holdings_no_rewards(strategy, clmm, prices, pool_sqrt_price)
```

`ktokens_token_x::holdings_of_token_x` — the oracle for `OracleType::KTokenToTokenA` and
`KTokenToTokenB` — carries the **same doc comment** but does the opposite:

```rust
// ktokens_token_x.rs:168-202
/// Use a sqrt price derived from price_a and price_b, not from the pool as it cannot be considered reliable
pub fn holdings_of_token_x(...) -> Result<u64> {
    let pool_sqrt_price_from_oracle_prices = price_utils::sqrt_price_from_scope_prices(...)?;  // L179-190

    let pool_sqrt_price = clmm.get_current_sqrt_price();                                        // L192  <-- raw pool

    warn!("[KToken to Token X] pool_sqrt_price: {pool_sqrt_price} vs sqrt_price_from_oracle_prices: {pool_sqrt_price_from_oracle_prices}");

    let (available, invested, fees) = common::underlying_inventory(
        strategy, clmm, LiquidityCalculationMode::Deposit,
        clmm.get_position_liquidity()?,
        pool_sqrt_price,                                                                        // L201  <-- raw pool
    )?;
```

The oracle-derived value is computed, logged, and then discarded. The inline comment at L177-178 ("We
still use the pool price to compute the sqrt price but print this one as a reference") confirms the
code is doing what it does on purpose — but the function's own doc comment, the sibling oracle, and
the class of the value being produced all say it should not.

**Impact**

For a concentrated-liquidity position, the sqrt price determines how the position's liquidity splits
between token A and token B. Moving the pool's price within the position's range shifts that split
without changing the position's total value. `KTokenToTokenA` reports *only* the token-A amount per
share, so an attacker who moves the pool toward the token-A end of the range inflates the reported
"token A per kToken", and correspondingly deflates `KTokenToTokenB`. Unlike `KToken` (a total-value
oracle, where the split cancels out), these two oracles are **pure functions of the split** — the
exact quantity the pool price controls.

**Reachability**

- Entry point: `scope::refresh_price_list` @ `handler_refresh_prices.rs:32` → `get_non_zero_price`
  @ `oracles/mod.rs:170-190` for `OracleType::KTokenToTokenA` / `KTokenToTokenB`.
- Signer / authority required: **permissionless**.
- Preconditions: an entry configured with `KTokenToTokenA` or `KTokenToTokenB`, plus the five extra
  accounts (global_config, collateral_infos, pool, position, scope_prices), each pinned by a field of
  the mapping-pinned strategy account (`ktokens_token_x.rs:84-104`).
- Guard analysis: `check_execution_ctx` blocks same-transaction manipulate-then-refresh; the pool
  sqrt price is otherwise unguarded — the computed oracle-derived alternative is never compared
  against it, not even with a divergence tolerance (`ktokens_token_x.rs:194` only logs both).
- **However**: a repo-wide grep of both published mainnet feed configurations finds **zero** entries of
  type `KToken`, `KTokenToTokenA` or `KTokenToTokenB`. The code path is compiled in (the `yvaults`
  feature is on by default, `Cargo.toml:25`) but is not reachable through any configuration published
  at this commit.
- **Verdict: REACHABLE in code, GUARDED by configuration → downgraded.**

**Math / State-Bounds**

- Vulnerable expression: `common::underlying_inventory(..., pool_sqrt_price)` @
  `ktokens_token_x.rs:196-202` with `pool_sqrt_price = clmm.get_current_sqrt_price()` @ L192.
- Input domain: the CLMM pool's `sqrt_price`, movable by any swapper across the whole tick range of
  the strategy's position.
- Boundary that breaks: when the pool price crosses to one edge of the position's range, the position
  is entirely in one token — `available.a + invested.a + fees.a` goes to its maximum while the token-B
  reading goes to zero (and vice-versa). The reported per-share ratio therefore spans its full range
  as a function of an attacker-controlled input.
- Worked case: for a position with range `[Pl, Pu]` and the pool at the geometric midpoint, the split
  is roughly 50/50. Pushing the pool to `Pu` moves the whole position into token A, so
  `KTokenToTokenA` reports up to ~2× its midpoint value while `KTokenToTokenB` reports ~0. The exact
  multiple depends on the position's range width, which is strategy configuration — *extent not
  determined within this assessment*.
- Net effect: a per-share token-count oracle that an unprivileged swapper can move by a
  configuration-dependent multiple.

**Attacker-Model**

- Capability: permissionless caller with swap capital in the kToken strategy's CLMM pool.
- Capital / setup cost: the round-trip cost of moving that pool within the position's range —
  materially cheaper than moving it outside the range, and cheaper still in a narrow-range strategy.
- Profit / damage: depends entirely on a consumer that prices something off `KTokenToTokenA/B`. None
  exists in the published configuration.
- Atomicity: multi-transaction (the `check_execution_ctx` guard forces the swap into a separate tx).
- Net: **requires-configuration.** Impact 7 on the mechanism, reported at **5** because no published
  mainnet entry uses these oracle types, so no funds are exposed today. The finding is that the code
  is one config change away from being live, and its own doc comment asserts a property it does not
  have.

**Proof of Concept**

```text
Preconditions: an operator configures entry N as KTokenToTokenA for a Kamino strategy whose CLMM
               position has range [Pl, Pu], and a consumer prices something off entry N.

1. tx A: swap in the strategy's pool until sqrt_price approaches Pu
         (the token-A-heavy edge of the position's range).
2. tx B: scope::refresh_price_list(tokens = [N], remaining = [strategy, global_config,
                                                              collateral_infos, pool, position,
                                                              scope_prices])
         holdings_of_token_x computes the oracle-derived sqrt price (ktokens_token_x.rs:179-190),
         LOGS it (L194), then computes the inventory from clmm.get_current_sqrt_price() (L192, L201).
         -> reported "token A per share" is the manipulated split, not the oracle-implied one.
3. tx C: act on the inflated entry N in the consumer protocol.
4. tx D: unwind the swap.

Note that ktokens.rs (OracleType::KToken) is NOT affected: it passes
price_utils::sqrt_price_from_scope_prices into holdings_no_rewards (ktokens.rs:262, 298).
```

**Recommendation**

```rust
// ktokens_token_x.rs:170-202 — use the oracle-derived sqrt price, exactly as ktokens.rs does.
pub fn holdings_of_token_x(
    strategy: &WhirlpoolStrategy, clmm: &dyn Clmm, prices: &TokenPrices, token: TokenTypes,
) -> Result<u64> {
    let pool_sqrt_price = price_utils::sqrt_price_from_scope_prices(
        &prices.get(CollateralToken::try_from(strategy.token_a_collateral_id)
            .map_err(|_| ScopeError::ConversionFailure)?)?,
        &prices.get(CollateralToken::try_from(strategy.token_b_collateral_id)
            .map_err(|_| ScopeError::ConversionFailure)?)?,
        strategy.token_a_mint_decimals,
        strategy.token_b_mint_decimals,
    )?;

    let (available, invested, fees) = common::underlying_inventory(
        strategy, clmm, LiquidityCalculationMode::Deposit,
        clmm.get_position_liquidity()?,
        pool_sqrt_price,          // was: clmm.get_current_sqrt_price()
    )?;
    ...
}
```

If the raw pool price is genuinely required here (e.g. because `underlying_inventory` in `Deposit`
mode must match what a real deposit would execute at), then (a) fix the doc comment at L169 so it
stops asserting the opposite, and (b) add an explicit divergence guard between the two sqrt prices —
the oracle-derived value is already computed at L179-190 and only logged:

```rust
let bps_diff = /* |pool - oracle| * 10_000 / oracle */;
require_gte!(MAX_KTOKEN_SQRT_PRICE_DIVERGENCE_BPS, bps_diff, ScopeError::PriceNotValid);
```

---

#### [F-004] Reachable panics on oracle-parsing paths abort the whole batch refresh that the per-entry error handling exists to protect

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | FV-058 (also AR-001…005, AR-018, AR-056, FV-049, KV-011, KV-025, AV-088) |
| **Category** | Error handling / DoS resilience |
| **Language** | Rust |
| **File** | `programs/scope/src/oracles/pyth.rs:99-100` · `programs/scope/src/oracles/jupiter_lp.rs:44` · `programs/scope/src/oracles/jito_restaking.rs:32` · `programs/scope/src/utils/mod.rs:55,74,80,100` · `programs/scope/src/utils/math.rs:104,114,177` · `programs/scope/src/oracles/mod.rs:108,310,441` · `programs/scope/src/oracles/switchboard_on_demand.rs:79-81` · `programs/scope/src/oracles/ktokens.rs:169,354-356,410,414` · `programs/scope/src/oracles/chainlink.rs:263,381` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description**

`refresh_price_list` is explicitly designed so one bad entry cannot block a batch:

```rust
// handler_refresh_prices.rs:102-114
let outcome = if fail_tx_on_error { price_res? } else {
    match price_res {
        Ok(outcome) => outcome,
        Err(_) => { msg!("Price skipped as validation failed (token {token_idx}, type {price_type:?})"); continue; }
    }
};
```

A **panic** is not an `Err` — it aborts the entire transaction, so every other entry in the batch is
rolled back too. The workspace sets `overflow-checks = true` (`Cargo.toml:8`), which is the right
choice for correctness but turns every unchecked arithmetic operation into an additional panic site.

The reachable sites found, each taking a value from an account or report Scope does not author:

| Site | Trigger |
|---|---|
| `pyth.rs:99` `u64::try_from(pyth_price.price).unwrap()` | a negative Pyth price (Pyth's schema is `i64` and supports negatives) |
| `pyth.rs:100` `pyth_price.expo.abs().try_into().unwrap()` | `expo == i32::MIN` |
| `jupiter_lp.rs:44` `Decimal::from(lp_value) / lp_token_supply` | JLP mint supply of exactly 0 — an unguarded divisor, unlike the sibling guards at `jito_restaking.rs:26` and `msol_stake.rs:52` |
| `jito_restaking.rs:32` `program_fee_bps.get() + withdrawal_fee_bps.get()` | two `u16` fee fields summing above 65 535 |
| `switchboard_on_demand.rs:81` `stdev_mantissa.try_into().unwrap()` | a negative standard deviation in the feed's `CurrentResult` |
| `ktokens.rs:169` `DEX::try_from(strategy.strategy_dex).unwrap()` | a strategy byte outside the `DEX` enum |
| `ktokens.rs:354-356, 410, 414` `.unwrap()` on `checked_sub`/`checked_mul`/`checked_add` | extreme decimals or exponents |
| `chainlink.rs:263` `let spread = ask_dec - bid_dec;` | a crossed market (`bid > ask`) — `decimal_wad`'s `U192` subtraction panics on underflow |
| `chainlink.rs:381` `chainlink_report.nav_date + NAV_REPORT_STALENESS_IN_MS` | a `nav_date` near `u64::MAX` |
| `utils/mod.rs:74, 100` `bytemuck::from_bytes(&data[8..end])` | an account shorter than `size_of::<T>() + 8` whose first 8 bytes match the discriminator |
| `utils/mod.rs:55, 80` `account.data.try_borrow().unwrap()` | the same account already borrowed elsewhere in the instruction |
| `math.rs:104` `lamport_value * 10_u64.pow(adjust_exp)` | a large decimals gap in `price_of_lamports_to_price_of_tokens` |
| `math.rs:114` `0 => panic!("Creating a price by dividing by 0")` | `u64_div_to_price` with a zero denominator |
| `math.rs:177` `_ => panic!("no support for exponent: {expo}")` | `ten_pow` above 30 |
| `oracles/mod.rs:108, 310, 441` `panic!("DeprecatedPlaceholder is not a valid oracle type")` | a stored `price_types[i]` byte of 1–4, 7, 17 or 20 |

**Impact**

Availability, not integrity. A single entry whose upstream produces one of these values converts a
skip-this-entry outcome into a whole-transaction abort, so the crank's batch fails and *every* entry
in that batch goes unrefreshed until the crank re-partitions around the offender. The three
`oracles/mod.rs` panics are reachable through an admin misconfiguration (a deprecated oracle type)
rather than through upstream data, and `utils/mod.rs:74,100` is the only one that reads memory out of
bounds — Rust's slice indexing makes that a clean panic, not an out-of-bounds read, so there is no
memory-safety consequence.

None of these is a way to make Scope publish a *wrong* price. The severity is 4 because the
failure mode is a self-clearing liveness stall on a live mainnet feed, and because the defect is a
direct defeat of a mechanism the code goes out of its way to provide.

**Proof of Concept**

```text
Actor: any permissionless caller, once an upstream produces a qualifying value.

Concretely, for jupiter_lp.rs:44 (the cleanest of the set):
  1. The Jupiter perps LP mint reaches supply == 0 (every JLP holder redeems).
  2. Crank calls refresh_price_list(tokens = [.., JLP_ENTRY, ..]) as usual.
  3. get_price_no_recompute -> Decimal::from(aum_usd) / 0
     -> decimal_wad's U192 Div panics -> the whole transaction aborts.
  4. Every other token in that batch is rolled back, not merely the JLP entry.
     Compare jito_restaking.rs:26-28, which returns Price::default() for a zero supply,
     and msol_stake.rs:52-53, which returns the amount unchanged.

The pyth.rs:99 site is the same shape with a negative Pyth price; the chainlink.rs:263 site with a
crossed bid/ask in a signed v3 report.
```

**Recommendation**

```rust
// pyth.rs:95-101
pub fn validate_valid_price(pyth_price: &pyth_client::Price, oracle_confidence_factor: u32)
    -> std::result::Result<Price, ScopeError>
{
    let price = u64::try_from(pyth_price.price)
        .map_err(|_| { warn!("Pyth reported a negative price: {}", pyth_price.price);
                       ScopeError::PriceNotValid })?;
    let price_exp: u32 = pyth_price.expo.checked_abs()
        .ok_or(ScopeError::OutOfRangeIntegralConversion)?
        .try_into().map_err(|_| ScopeError::OutOfRangeIntegralConversion)?;
    ...
}

// jupiter_lp.rs:37-44
let lp_token_supply = mint.supply;
require_neq!(lp_token_supply, 0, ScopeError::PriceNotValid);      // ADD
let price_dec = Decimal::from(lp_value) / lp_token_supply;

// jito_restaking.rs:32
let total_fee_bps = vault.program_fee_bps.get()
    .checked_add(vault.withdrawal_fee_bps.get())
    .ok_or(ScopeError::MathOverflow)?;

// chainlink.rs:263
let spread = ask_dec.checked_sub(bid_dec).ok_or(ScopeError::PriceNotValid)?;  // crossed market

// utils/mod.rs:52-75 — bounds-check before bytemuck, and drop the borrow unwrap
let data = account.data.try_borrow().map_err(|_| ScopeError::UnableToDeserializeAccount)?;
let end = std::mem::size_of::<T>() + 8;
if data.len() < end { return Err(ScopeError::UnableToDeserializeAccount); }

// oracles/mod.rs:100-109, 302-311, 433-442 — return BadTokenType instead of panicking.
```

A repo-wide `#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::arithmetic_side_effects)]`
on `programs/scope/src/` (with targeted `#[allow]`s carrying justifications, as `lib.rs:1` already
does for one lint) would keep the class closed. That requires CI, which is F-008.

---

#### [F-005] `CappedFloored` and `CappedMostRecentOf` never age-check the cap/floor entries, and republish the source's timestamp

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | ECON-058 (also AR-050, ECON-025) |
| **Category** | Oracle staleness |
| **Language** | Rust |
| **File** | `programs/scope/src/oracles/capped_floored.rs:40-83` · `programs/scope/src/oracles/capped_most_recent_of.rs:56-68` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description**

`capped_floored::get_price` copies the whole `DatedPrice` from the source entry, then overwrites only
its `.price` from the cap/floor entries:

```rust
// capped_floored.rs:40-83
let mut dated_price = *oracle_prices.prices.get(usize::from(source_entry))
    .ok_or(ScopeError::CompositeOracleInvalidSourceIndex)?;     // price + slot + timestamp
let get_price_helper = |entry: Option<u16>| -> ScopeResult<Option<Price>> {
    entry.map(|idx| oracle_prices.prices.get(usize::from(idx))
        .map(|dated_price| dated_price.price)                   // <-- .price ONLY; ts discarded
        .ok_or(ScopeError::BadTokenNb)).transpose()
};
...
if let Some(cap)   = cap_price   { dated_price.price = dated_price.price.min(cap); }
if let Some(floor) = floor_price { dated_price.price = dated_price.price.max(floor); }
Ok(DatedPrice { generic_data: [0; 24], ..dated_price })          // <-- source's slot + timestamp
```

There is no age check on the cap or floor entry anywhere in the function. `capped_most_recent_of.rs:57-63`
has the identical gap for its `cap_entry` (its `source_entries` *are* age-checked, inside
`get_most_recent_price_from_sources`).

This matters more than it looks because of how the live configuration uses the type: every deployed
`CappedFloored` that wraps a composite sets `cap_entry == floor_entry`, which by the min/max algebra
pins the output price to *that entry alone* —
`min(p, E)` then `max(·, E)` yields `E` for every `p`. Live examples
(`configs/mainnet/3t4JZcueEzTbVP6kLxXrL3VpWx45jDer4eqysweBchNH.json`):

| Entry | source_entry | cap == floor | Published price is… |
|---|---|---|---|
| 311 Checked PRIME/wYLDS `:1411-1415` | 310 | 383 (ChainlinkExchangeRate) | entry 383's price, entry 310's timestamp |
| 347 Checked QQQx/USD `:1674-1679` | 346 | 280 (ChainlinkX) | entry 280's price, entry 346's timestamp |
| 350 Checked ONyc/USD `:1693-1698` | 349 | 246 (MostRecentOf) | entry 246's price, entry 349's timestamp |
| 353 Checked PST/USDC `:1712-1717` | 352 | 479 (PythLazer) | entry 479's price, entry 352's timestamp |
| 394 Checked STRCx/USD `:1936-1941` | 393 | 302 (ChainlinkX) | entry 302's price, entry 393's timestamp |

So each of these entries publishes **100 % of one entry's price under 100 % of a different entry's
freshness stamp**.

**Impact**

A consumer's max-age check can pass on a price that is entirely determined by a third entry whose own
age was never examined. If the cap entry stalls — a ChainlinkX feed entering its suspension blackout
(`chainlink.rs:444-471`), being frozen by the emergency council (`handler_freeze_price.rs:41`), or
simply not being cranked — while the source entry keeps refreshing, the `Checked …` entry keeps
publishing a fresh-looking stale price.

**Why this is 4 and not 6.** In the deployed configuration the gap is bounded *transitively*, and that
bound is configuration, not code: each cap entry is **also** an age-checked source of the
`MostRecentOf` that feeds `source_entry`. For entry 347, the cap is entry 280 and
`source_entry = 346 = MostRecentOf{sources: [280, 345], sources_max_age_s: 60}`
(`config:1667-1672`). If 280 goes stale, 346 refuses to refresh
(`most_recent_of.rs:96-106`), so 346's timestamp stops advancing, so 347's inherited timestamp stops
advancing too — the staleness does surface. The same holds for 311, 350, 353 and 394. The Rule 5b
gate therefore fails on *reachability under the current configuration*: the initially-assigned
severity 6 is **downgraded to 4** as a defence-in-depth gap whose only live mitigation is a
coincidence of configuration that a single future `MappingRefPrice`/`MappingConfig` change could
remove without any code review noticing.

Entries 13, 16 and 390 use fixed prices as cap/floor (`config:72-78, 1912-1918`), which are never
stale, so they are unaffected either way.

**Proof of Concept**

```text
Preconditions: an operator configures a CappedFloored entry whose cap entry is NOT also an
               age-checked source of its source_entry. (Nothing in the program prevents this;
               validate_mapping_cfg at capped_floored.rs:86-125 checks indices and distinctness
               only.)

   entry 500: CappedFloored { source_entry: 501, cap_entry: 502, floor_entry: 502 }
   entry 501: PythLazer XYZ/USD           (refreshed every slot by the crank)
   entry 502: ChainlinkX XYZ/USD          (refreshed only when a Data Streams report is pushed)

1. Entry 502 stops being refreshed at T0 — e.g. it enters the ChainlinkX blackout window and
   suspends (chainlink.rs:444-471), so update_price_v10 returns SuspendExistingPrice and the price
   and its timestamp freeze.
2. The crank keeps refreshing entry 501 normally; its unix_timestamp tracks the clock.
3. Anyone calls refresh_price_list([500]).
   capped_floored::get_price  -> price = entry 502's frozen price      (L73-78)
                              -> unix_timestamp = entry 501's fresh ts (L40-43, L80-83)
4. A consumer reads entry 500, sees an age of ~0 slots, and accepts a price that has not moved
   since T0. There is no on-chain signal that it is stale.
```

**Recommendation**

```rust
// capped_floored.rs — publish the oldest contributing timestamp, so a stale bound is visible.
pub fn get_price(oracle_prices: &OraclePrices, generic_data: &[u8]) -> ScopeResult<DatedPrice> {
    let CappedFlooredData { source_entry, cap_entry, floor_entry } =
        CappedFlooredData::from_generic_data(generic_data)?;

    let mut dated_price = *oracle_prices.prices.get(usize::from(source_entry))
        .ok_or(ScopeError::CompositeOracleInvalidSourceIndex)?;

    // Return the whole DatedPrice, not just .price, so freshness can be folded in.
    let get_dated = |entry: Option<u16>| -> ScopeResult<Option<DatedPrice>> {
        entry.map(|idx| oracle_prices.prices.get(usize::from(idx)).copied()
            .ok_or(ScopeError::BadTokenNb)).transpose()
    };
    let cap = get_dated(cap_entry)?;
    let floor = get_dated(floor_entry)?;

    for bound in [cap.as_ref(), floor.as_ref()].into_iter().flatten() {
        dated_price.unix_timestamp    = dated_price.unix_timestamp.min(bound.unix_timestamp);
        dated_price.last_updated_slot = dated_price.last_updated_slot.min(bound.last_updated_slot);
    }
    ...
}
```

Apply the same change to `capped_most_recent_of.rs:57-68` for its `cap_entry`. If a bound is
intentionally allowed to be older than the source (a slow-moving NAV cap, say), add an explicit
per-entry `bound_max_age_s` to the config and check it, rather than leaving the property to emerge
from how the surrounding entries happen to be wired.

---

#### [F-006] The shared account-deserialization helpers never check `account.owner`

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | AV-001 (also AV-009, AV-012, AV-015, AV-033, KV-010, KV-015, KV-027) |
| **Category** | Account validation / type cosplay |
| **Language** | Rust |
| **File** | `programs/scope/src/utils/mod.rs:22-50` and `:52-75` (+ `:77-102`) |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description**

Both generic deserializers validate the 8-byte Anchor discriminator and nothing else — in particular,
not the account's owning program:

```rust
// utils/mod.rs:22-50
pub fn account_deserialize<T: AccountDeserialize + Discriminator>(account: &AccountInfo<'_>) -> ScopeResult<T> {
    let data = account.clone().data.borrow().to_owned();
    let discriminator = data.get(..8).ok_or_else(|| { ... })?;
    if discriminator != T::discriminator() { ... return Err(ScopeError::InvalidAccountDiscriminator); }
    let user: T = T::try_deserialize(&mut data)...;      // no account.owner check anywhere
    Ok(user)
}
// utils/mod.rs:52-75 — zero_copy_deserialize: same shape, same omission.
```

Eighteen call sites rely on them for third-party account types: `switchboard_on_demand.rs:21,95`,
`jito_restaking.rs:12,45`, `orca_whirlpool.rs:30,82`, `raydium_ammv3.rs:12,40`, `meteora_dlmm.rs:33,102`,
`jupiter_lp.rs:23,61`, `pyth_pull.rs:18,79`, `pyth_pull_ema.rs:21`, `ktokens.rs:54,62,118,120,172,189,191`,
`ktokens_token_x.rs:44,52,108,110`, `klend_ctoken_exchange_rate.rs:35,159`, `redstone.rs:30`,
`securitize.rs:36`. Six oracles *do* check the owner, and their existence shows the check is
considered necessary: `adrena_lp.rs:18`, `flashtrade_lp.rs:18`, `redstone.rs:74-78` (config time only),
`staked_sol_balance.rs:12`, `token_2022_multiplier.rs:104`, `klend_ctoken_exchange_rate.rs:150`
(config time only).

The weakest discriminator in the set is Jito's, which is a little-endian `u64` of 2:

```rust
// jito_restaking.rs:193-198
impl Discriminator for Vault {
    const DISCRIMINATOR: [u8; 8] = [2, 0, 0, 0, 0, 0, 0, 0];
```

Any account of sufficient length whose first eight bytes are `02 00 00 00 00 00 00 00` parses as a
Jito `Vault`, whatever program owns it.

**Impact**

No exploitable path exists at this commit, and the report says so plainly. Two independent controls
stand in the way:

1. **The base account is pinned.** `refresh_price_list` compares the supplied account against
   `oracle_mappings.price_info_accounts[idx]` before parsing
   (`handler_refresh_prices.rs:83-90`), so the account identity is admin-chosen, not attacker-chosen.
2. **Extra accounts are cross-pinned.** Every parser validates its `remaining_accounts` against a
   field inside the already-pinned base account (`orca_whirlpool.rs:33-43`, `ktokens.rs:94-114`,
   `securitize.rs:88-112`, `spl_balance.rs:50-65`, `klend_ctoken_exchange_rate.rs:47-64`).

The residual risk is a *reassignment* one: a mapped account that is not a PDA could in principle be
closed by whoever controls it and re-created, system-assigned, with attacker-chosen bytes carrying the
right discriminator. Whether any currently-mapped source account is non-PDA and third-party-closable
was **not determined within this assessment** (it needs on-chain inspection, which this engagement
does not perform). Severity 4 reflects a provable missing check on a shared, easy-to-misuse helper
with no demonstrated exploit path — reported rather than buried, per Rule 5b's guidance on provable
syntactic gaps.

**Proof of Concept**

```text
This is a defence-in-depth finding; the narrative below is the shape an exploit would take, and each
step names the control that currently blocks it.

1. Eve wants entry N (type JitoRestaking) to report a price of her choosing.
2. She would need scope to parse HER account as jito_vault_core::Vault. Her account needs only
   8 bytes of 02 00 00 00 00 00 00 00 followed by a Vault-sized body — zero_copy_deserialize
   (utils/mod.rs:52-75) will accept it from any owner.
   BLOCKED BY: handler_refresh_prices.rs:83 — the account must equal
               oracle_mappings.price_info_accounts[N], which only the admin can set.
3. Alternative: she targets an extra account instead of the base account.
   BLOCKED BY: each parser pins extras against a field of the base account.
4. Alternative: the mapped account itself is closed by its owner and re-created under a program Eve
   controls, keeping the same address.
   NOT BLOCKED BY ANY SCOPE CODE — blocked only if the mapped account is a PDA of the upstream
   program (Pyth sponsored feeds, Jito vaults and klend reserves are; a keypair-created
   PriceUpdateV2 would not be). Whether every mapped account is a PDA: UNDETERMINED here.
```

**Recommendation**

```rust
// utils/mod.rs — make the owner an argument so it cannot be forgotten at a call site.
pub fn account_deserialize<T: AccountDeserialize + Discriminator>(
    account: &AccountInfo<'_>,
    expected_owner: &Pubkey,                                   // NEW
) -> ScopeResult<T> {
    if account.owner != expected_owner {
        warn!("Account {:?} is owned by {} but expected {}", account.key(), account.owner, expected_owner);
        return Err(ScopeError::WrongAccountOwner);             // already exists: errors.rs:168-169
    }
    ... // existing discriminator + deserialize
}
// Same for zero_copy_deserialize / zero_copy_deserialize_mut, then update the ~18 call sites:
//   orca_whirlpool.rs:30      -> &whirlpool::ID
//   raydium_ammv3.rs:12       -> &raydium_amm_v3::ID
//   meteora_dlmm.rs:33        -> &lb_clmm::ID
//   jupiter_lp.rs:23          -> &perpetuals::ID
//   pyth_pull.rs:18           -> &pyth_solana_receiver_sdk::ID
//   switchboard_on_demand.rs  -> &sbod_itf::ID
//   jito_restaking.rs:12      -> &<jito vault program id>
//   klend_ctoken_exchange_rate.rs:35 -> &klend_itf::ID   (already checked at :150, config-time only)
//   redstone.rs:30            -> &redstone_itf::ID       (already checked at :74, config-time only)
//   securitize.rs:36          -> &securitize_itf::ID
//   ktokens*.rs               -> &yvaults::ID / &whirlpool::ID / &raydium_amm_v3::ID as appropriate
```

The mechanical part is adding the parameter; the judgement part is that several of these program ids
are not currently imported as constants and will need to be (Jito's in particular is only present
implicitly, via the discriminator).

---

#### [F-007] `securitize::get_sacred_price` ignores the vault's `is_paused` flag

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | ECON-058 (also AV-004) |
| **Category** | Oracle validation |
| **Language** | Rust |
| **File** | `programs/scope/src/oracles/securitize.rs:36, 81-115` · field at `programs/securitize-itf/src/accounts.rs:8` |
| **Status** | Open |
| **PoC tier** | `[PoC-PROSE]` |

**Description**

The Securitize `VaultState` interface that Scope transcribes carries an explicit pause flag:

```rust
// securitize-itf/src/accounts.rs:5-9
pub struct VaultState {
    pub id: u64,
    pub admin: Pubkey,
    pub is_paused: bool,
    ...
```

`get_sacred_price` deserializes that struct (`securitize.rs:36`) and `check_accounts`
(`securitize.rs:81-115`) validates five things about it — the vault's own key, `asset_vault`,
`share_mint`, and the RedStone account's owner and key. It does not read `is_paused`. A repo-wide
grep finds zero references to the field outside its declaration.

**Impact**

Scope keeps publishing an sACRED price while the Securitize vault is paused. A pause is the issuer's
incident control — it is asserted exactly when the vault's state should not be trusted as a live
valuation (redemption halt, corporate action, liquidation in progress). The published value is
computed from the vault's *instantaneous* token balance
(`securitize.rs:61-69` → `vault.amount`), which during a paused period may be mid-transition.

The blast radius is contained by two existing controls: the share value is capped at par
(`get_share_value` @ `securitize.rs:127-130` returns `min(10^decimals, assets × rate / supply)`), so a
donation cannot push it above 1.0; and the timestamp is inherited from the RedStone attestation
(`securitize.rs:76-77`), so an ACRED price that also stops updating will surface as staleness. What is
*not* bounded is a downward move: if the vault's balance drops during a pause, Scope reports the
reduced share value as a live, fresh price.

Severity 4: the mechanism is a provable missing check on a live mainnet oracle type
(`ACRED_VAULT_PK` is hard-coded at `securitize.rs:24`), but exploiting it requires the Securitize
operator to pause — it is not attacker-triggerable, so it is a correctness/robustness gap rather than
an attack path.

**Proof of Concept**

```text
Actor: none — this is a missing check, triggered by the upstream issuer, not by an attacker.

1. Securitize pauses the ACRED vault (VaultState.is_paused = true), e.g. during a redemption halt.
2. The crank continues to call refresh_price_list([SACRED_ENTRY], ...) as normal.
3. securitize::get_sacred_price runs check_accounts (securitize.rs:48-54), which validates the five
   pinned pubkeys and returns Ok — is_paused is never read.
4. The price is computed from vault.amount at that instant (securitize.rs:61-69) and published with
   the RedStone timestamp (securitize.rs:76-77).
5. Consumers see a normal, fresh sACRED price for an asset whose issuer has declared it should not
   be transacted against.
```

**Recommendation**

```rust
// securitize.rs:81-115 — add to check_accounts, which already takes `state`:
fn check_accounts(
    state: &VaultState,
    state_account_key: Pubkey,
    vault_account_key: Pubkey,
    mint_account_key: Pubkey,
    redstone_adapter_account: &AccountInfo,
) -> Result<()> {
    require!(!state.is_paused, ScopeError::PriceNotValid);          // ADD
    require_keys_eq!(state_account_key, ACRED_VAULT_PK, ScopeError::UnexpectedAccount);
    ...
}
```

Returning `Err` (rather than a `Suspended` outcome) is the right shape here: the batch path skips the
entry (`handler_refresh_prices.rs:105-113`), the stored price ages out, and consumers fall back to
their own stale-price policy. If instead the intended behaviour is to keep the last good price alive
during a short pause, use `PriceRefreshOutcome::Suspended` as `token_2022_multiplier.rs:156-160` does,
so the stop is explicit and requires the `resume_authority` to clear.

---

#### [F-008] The repository ships with no tests, no CI, no static analysis and no fuzzing

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW |
| **Checklist Item** | FV-013 (also FV-002, FV-019, FV-023, FV-024, FV-033…038, FV-040, FV-059, FV-061…065, FV-069, FV-071) |
| **Category** | Assurance / verification |
| **Language** | Rust |
| **File** | repository-wide (`git ls-files`) |
| **Status** | Open |
| **PoC tier** | N/A — process finding |

**Description**

At the audited commit:

- **Zero tests.** A repo-wide search for `#[cfg(test)]`, `#[test]` and `mod tests` across all 108
  `.rs` files returns **0 matches**. There is no `tests/` directory and no `programs/*/tests/`.
- **Zero CI.** `git ls-files` lists exactly one dotfile — `.gitignore`. There is no `.github/`, no
  `.gitlab-ci.yml`, no `Makefile`, no `justfile`, no CI manifest of any kind.
- **Zero static analysis config.** No `clippy.toml`, no `deny.toml`, no `rustfmt.toml`, no
  `cargo-audit` configuration. The only lint directive in the tree is a single justified
  `#![allow(clippy::result_large_err)]` (`lib.rs:1`).
- **Zero fuzzing.** No `fuzz/` directory, no `cargo-fuzz` target, no `proptest`/`quickcheck`
  dependency, no Trident configuration.

There is indirect evidence that a private suite exists — `oracles/mod.rs:118-119` cites a measured CU
figure "under `cargo test-sbf` against a real 8-extension mainnet mint
(`test_token_2022_multiplier_refresh_from_real_mainnet_mint`)", naming a test that is not in this
repository. If so, the finding is one of *published* assurance rather than of engineering practice —
but a public, BUSL-licensed repository that invites external review (`README.md` documents how to
build without the private `yvaults` dependency) gives a reviewer nothing executable to check a claim
against.

**Impact**

Every finding in this report that turns on an edge case — the negative-Pyth-price panic (F-004), the
zero-supply division (F-004), the cap/floor freshness inheritance (F-005), the `KTokenToTokenA` sqrt
price (F-003) — is exactly the kind of defect a property test or an SVM negative test catches for
free. The hand-written decoders are the sharpest example: `compat/token_2022_scaled_ui_amount.rs`
walks an attacker-adjacent TLV structure by hand across 176 lines, with a manual cursor, three
`.get(..)` bounds checks and a `checked_add`, and nothing in the repository exercises it against a
malformed mint. The same applies to every `from_generic_data` implementation and to
`chainlink_bigint_value_parse` (`chainlink.rs:568-582`).

Severity 4 rather than higher because this is an assurance gap, not a vulnerability: no attacker
exploits the absence of a test. It is listed as a finding because for a mainnet oracle whose output
prices other protocols' collateral, the absence of *any* executable verification is a security-relevant
property of the delivery, and because checklist 16 is explicitly in scope.

**Recommendation**

```text
1. Publish the SVM suite (or state in README.md that it lives in a private repository, so reviewers
   know what they are not seeing). At minimum, per FV-059..FV-070:
     - load the actual compiled .so via LiteSVM or Mollusk, not a mock
     - one fixture test per oracle type against a real mainnet account snapshot
     - negative tests: wrong signer on every admin instruction; freeze by a non-council key;
       resume with a mismatched expected_price_data (handler_resume_suspended_price.rs:77-80);
       double-initialize (handler_initialize.rs:21-36)
     - clock control via set_sysvar(Clock)/warp_to_slot for every staleness and TWAP window

2. Add a CI workflow that runs, on every PR:
     cargo clippy --all-targets --all-features -- -D warnings
     cargo audit
     cargo build-sbf --manifest-path=./programs/scope/Cargo.toml --no-default-features
     <the SVM suite>

3. Add cargo-fuzz targets for the byte-level decoders — these are pure functions and cheap to fuzz:
     compat::token_2022_scaled_ui_amount::parse_scaled_ui_amount_multipliers
     oracles::chainlink::chainlink_bigint_value_parse
     every *Data::from_generic_data  (fixed_price, discount_to_maturity, most_recent_of,
                                      capped_most_recent_of, capped_floored, multiplication_chain,
                                      conditional, pyth_lazer, token_2022_multiplier, chainlink)

4. Add a property test for the invariants the comments already assert in prose, e.g.
     - capped_floored: cap == floor  =>  output price == that entry's price, for all source prices
     - Price::cmp is a total order over the reachable (value, exp) domain
     - EmaTracker::erase_old_samples + update_tracker never sets a bit outside the window
```

---

#### [F-009] `initialize` is permissionless — any signer can claim a `feed_name` PDA first

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW · **Checklist Item** AC-039 (also AC-045, AV-087, SM-032, KV-014, KV-127) · **Category** Access control / init front-running · **File** `programs/scope/src/handlers/handler_initialize.rs:12-37` |

`Initialize` requires only `admin: Signer` and takes `feed_name` as a PDA seed
(`[b"conf", feed_name.as_bytes()]`, L21). Anyone can call it and become the admin of a new feed. The
`/// CHECK:` comment at L13 acknowledges this ("At creation admin can be anyone, this ix can't
override an existing feed"), and `#[account(init, …)]` correctly prevents overwriting an existing
feed. The residual is *name squatting*: an attacker who front-runs Kamino's creation of a new feed
name owns that PDA permanently, and Kamino must pick another name. The attacker also gets a
fully-functional feed of their own, which they can fill with `FixedPrice` entries — harmless as long
as consumers pin the `OraclePrices` **pubkey** rather than resolving a feed by name, which is how the
code is structured (`handler_refresh_prices.rs:21-25` ties the triple together by `has_one`, never by
name). Cost to the attacker: rent for five accounts (~2.9 SOL, dominated by the 336 KB
`OracleTwaps`), self-funded. **Fix:** gate `initialize` behind a hard-coded deployer key, or document
the squatting risk as accepted.

---

#### [F-010] `set_ref_price_tolerance_bps` accepts any `u16`, so a tolerance above 100 % silently disables the reference-price gate

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW · **Checklist Item** OPS-082 (also ECON-021) · **Category** Admin parameter bounds · **File** `programs/scope/src/states/oracle_mappings.rs:154-171` |

```rust
// oracle_mappings.rs:166-169
} else {
    self.twap_source_or_ref_price_tolerance_bps[entry_id] =
        ref_price_tolerance_bps.unwrap_or(u16::MAX);          // no FULL_BPS bound
}
```

Consumed by `check_ref_price_difference` (`utils/price_impl.rs:31-55`), which compares
`absolute_diff × 10 000 > ref_price × tolerance_bps`. A tolerance of, say, 50 000 makes the gate
accept a 5× price move; the maximum meaningful value is `FULL_BPS = 10 000`. The sibling parameters
*are* bounded — `MetadataEagerEvalBps` by `FULL_BPS`
(`handler_update_mapping_and_metadata.rs:353-357`), `max_divergence_bps` by `FULL_BPS`
(`most_recent_of.rs:163-165`), `tolerance_bps` by `FULL_BPS` (`conditional.rs:240-246`) — which makes
this one an inconsistency rather than a deliberate choice. The live config uses 500 and 1000 bps.
Admin-only, so severity 3. **Fix:** `require_gte!(FULL_BPS, bps, ScopeError::…)` in the setter.
(`max_age_price_slots` and `group_ids_bitset` are likewise unbounded but have no unsafe consumer.)

---

#### [F-011] `sqrt_price_to_x64_price` guards a 192-bit overflow with `debug_assert_eq!`, which is compiled out of release builds

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW · **Checklist Item** AR-015 (also KV-130) · **Category** Arithmetic truncation · **File** `programs/scope/src/utils/math.rs:12-22` |

```rust
// math.rs:15-21
let price_u256 = if decimals_a >= decimals_b {
    price * U256::from(ten_pow(decimals_a - decimals_b))
} else { price / U256::from(ten_pow(decimals_b - decimals_a)) };
debug_assert_eq!(price_u256.0[3], 0, "price overflow: {:?}", price_u256); // should not overflow because of the shift
U192([price_u256.0[0], price_u256.0[1], price_u256.0[2]])                // top limb dropped
```

`debug_assert_eq!` is a no-op in the release profile the on-chain binary is built with, so if the
top 64-bit limb is ever non-zero it is **silently discarded** and the function returns an arbitrary
wrong price with no error. The comment's reasoning holds for real pools — Orca/Raydium bound
`sqrt_price` to ≈ 2⁹⁶, so `sqrt_price² >> 64 ≤ 2¹²⁸` and a decimals gap of ≤ 19 keeps the product
under 2¹⁹² — which is why this is 3 and not higher. It is still a value-integrity guard that does not
exist in the shipped binary. Note also `ten_pow` panics above exponent 30
(`math.rs:177`) and `decimals_a - decimals_b` is a bare `u8` subtraction whose operands come from mint
accounts. **Fix:** replace with a checked conversion returning `ScopeError::MathOverflow`.

---

#### [F-012] `get_price_from_chain` can panic on `checked_pow(...).unwrap()`

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW · **Checklist Item** AR-004 (also FV-058) · **Category** Arithmetic / library surface · **File** `programs/scope/src/utils/scope_chain.rs:283-291` |

```rust
// scope_chain.rs:283-291
let scale_down_decimals: u32 = total_decimals.checked_sub(exp).unwrap().try_into().unwrap();
let scale_down_factor = U128::from(10u128).checked_pow(U128::from(scale_down_decimals)).unwrap();
let value: u64 = product.checked_div(scale_down_factor).unwrap().try_into()...
```

`total_decimals` is the **sum** of every link's exponent (L260-264) and `exp` is the last link's
(L267-271). When the difference reaches 39, `10^39` exceeds `U128::MAX ≈ 3.4 × 10³⁸`, `checked_pow`
returns `None`, and the `unwrap()` panics. Four links at exponent 18 give
`72 − 18 = 54`. The corner is narrow: reaching it also requires the product of the four values to stay
under `U128::MAX` (otherwise the `checked_mul` at L277-280 fails first with a clean `MathOverflow`),
so all four prices must be small — roughly below `7.6 × 10⁻⁹` each. That is not a realistic chain,
hence severity 3. The file's own `// TODO not working with latest prices that have a lot of decimals`
(L241) flags the same area. This function is **exported library surface**
(`lib.rs:29` re-exports `utils::scope_chain`), so a panic lands in a consumer program, not in Scope.
**Fix:** return `ScopeChainError::MathOverflow` from all three `unwrap()`s.

---

#### [F-013] No events are emitted; `msg!` text is the only off-chain signal

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW · **Checklist Item** SM-047 (also SM-048, SM-050, OPS-050, OPS-061, KV-122) · **Category** Observability · **File** repository-wide |

A repo-wide search for `emit!` and `emit_cpi` returns **0 matches**. Every state change — a price
write, a freeze, a suspension, an admin rotation, a mapping change — is observable only as formatted
`msg!` text (e.g. `handler_refresh_prices.rs:186-195`,
`handler_update_mapping_and_metadata.rs:132-170`, `handler_set_admin_cached.rs:17-21`). Three
consequences: (a) off-chain monitoring must parse human-readable strings whose format is not part of
any interface and changes freely between releases; (b) there is no typed, indexable record of
privileged actions such as `set_admin_cached`/`approve_admin_cached`/`set_emergency_council`; and
(c) program logs can be imitated by an unrelated program's inner instruction in the same transaction,
so a naive log consumer can be spoofed (KV-122). **Fix:** add an Anchor `#[event]` per price write
(entry id, previous and new price, slot) and per privileged action.

---

#### [F-014] Switchboard On-Demand results are consumed without checking the sample count against the feed's own minimum

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW · **Checklist Item** ECON-059 · **Category** Oracle validation · **File** `programs/scope/src/oracles/switchboard_on_demand.rs:17-69` |

`get_price` reads `feed.result.value()` and `feed.result.std_dev()`
(`switchboard_on_demand.rs:23-33`), which return `None` only when `result.slot == 0`
(`sbod-itf/src/accounts.rs:34-47`). The account carries `min_responses` and `min_sample_size`
(`sbod-itf/src/accounts.rs:83, 87`) alongside `result.num_samples` (`:23`), and none of the three is
read. The legacy Switchboard V2 path that this replaced *did* perform the equivalent check —
`AggregatorAccountData::get_result` compares `min_oracle_results` against
`latest_confirmed_round.num_success` and returns `None` on a shortfall
(`switchbord-itf/src/accounts.rs:194-204`) — so the guard was dropped, not consciously omitted.
Mitigating: the Switchboard On-Demand program writes `CurrentResult` only after its own quorum rules
are satisfied, so this is a redundancy rather than a hole, and the confidence-interval check at
`switchboard_on_demand.rs:34-50` provides an independent bound. Severity 3. **Fix:**
`require_gte!(feed.result.num_samples, feed.min_sample_size, ScopeError::SwitchboardOnDemandError)`.

---

#### [F-015] Two admin paths index a 512-element array with an unvalidated `u16` before the bound check

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO · **Checklist Item** AV-088 · **Category** Input validation · **File** `programs/scope/src/handlers/handler_update_mapping_and_metadata.rs:241-242, 304-310` |

`maybe_get_entry_name` calls `OracleMappings::is_entry_used`, which indexes
`self.price_types[entry_id]` directly (`states/oracle_mappings.rs:173-176`). It is reached twice with
a value that has not yet been range-checked: `twap_source.into()` at L242 (the check lives inside
`set_twap_source` at `oracle_mappings.rs:133-137`, called later at L260) and
`usize::from(*id)` for `ref_price_index` at L305 and L309 (the `require_gt!` is at L314, five lines
after). An out-of-range value therefore produces a Rust index-out-of-bounds panic rather than
`ScopeError::BadTokenNb`. Admin-only and equally fatal to the transaction either way, so this is an
error-quality issue, not a vulnerability. **Fix:** move the bound checks above the logging calls.

---

#### [F-016] `TokenMetadata::set_name` panics on a name longer than 32 bytes

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO · **Checklist Item** AV-042 · **Category** Input validation · **File** `programs/scope/src/states/token_metadatas.rs:30-35` |

```rust
pub fn set_name(&mut self, name: &str) {
    let bytes = name.as_bytes();
    let mut padded_name = [0_u8; 32];
    padded_name[..bytes.len()].copy_from_slice(bytes);   // panics if bytes.len() > 32
    self.name = padded_name;
}
```

Reached from `MetadataName(String)` (`handler_update_mapping_and_metadata.rs:323-326`) with an
admin-supplied, unbounded `String`. Admin-only. Worth noting that the *reader*,
`get_name` (`token_metadatas.rs:24-28`), does `std::str::from_utf8(&self.name).unwrap()` and is
therefore safe **only because** this writer copies whole UTF-8 slices and zero-pads — truncating
instead of rejecting would break that coupling and make the reader panic on a split multi-byte
character. **Fix:** `require!(name.len() <= 32, …)`, or truncate on a `char_indices` boundary.

---

#### [F-017] `create_mint_map` stores a caller-supplied `bump` without validating it

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO · **Checklist Item** AV-028 (also PDA-010, KV-104) · **Category** PDA canonicalization · **File** `programs/scope/src/handlers/handler_create_mint_map.rs:38-46` |

The account is created with Anchor's canonical bump (`#[account(init, seeds = […], bump, …)]`, L21-27,
no `bump = <expr>`), but the `bump: u8` **instruction argument** is written into state unchanged
(L45) and never compared against the derived one. `MintsToScopeChains.bump`
(`states/mints_to_scope_chains.rs:14`) can therefore hold an arbitrary value, so any consumer that
re-derives the address from the stored bump via `create_program_address` will fail or land on a
different address. Not exploitable inside Scope (nothing reads the field), and the account address
itself is canonical — hence INFO. **Fix:** drop the argument and store `ctx.bumps.mappings`.

---

#### [F-018] `approve_admin_cached` leaves the promoted key in `admin_cached`

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO · **Checklist Item** SM-045 · **Category** State hygiene · **File** `programs/scope/src/handlers/handler_approve_admin_cached.rs:26` |

```rust
configuration.admin = configuration.admin_cached;    // admin_cached is not cleared
```

After a successful handover `admin == admin_cached`, so a second `approve_admin_cached` is a
self-assignment no-op and the state retains a stale claim. No privilege is gained — the only key that
can act on it is the one that just became admin — but the invariant "a non-default `admin_cached`
means a rotation is pending" does not hold, which is the kind of thing monitoring and future code
tend to assume. **Fix:** `configuration.admin_cached = Pubkey::default();` after the assignment
(mirroring `handler_initialize.rs:62`, which sets it to default at creation).

---

#### [F-019] `check_execution_ctx` introspects ComputeBudget instructions, a pattern transaction v1 disables

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO · **Checklist Item** AV-089 (also KV-135) · **Category** Forward compatibility · **File** `programs/scope/src/handlers/handler_refresh_prices.rs:223-229` |

```rust
for ixn in 0..current_index {
    let ix = load_instruction_at_checked(ixn, instruction_sysvar_account_info)?;
    if ix.program_id != COMPUTE_BUDGET_ID { return err!(ScopeError::RefreshWithUnexpectedIxs); }
}
```

Under SIMD-0385 (transaction v1) the compute-unit limit, data-size limit, heap size and priority fee
move into the message config and `ComputeBudgetProgram` instructions execute as successful no-ops.
Scope's loop is **not** silently disabled by that change, because it never reads budget *semantics* —
it is a program-id allowlist on preceding instructions, and the property it enforces ("no other
program ran before me in this transaction") is version-independent. A v1 transaction that carries its
budget in the header and no ComputeBudget instructions passes trivially (the loop body never runs);
one that also carries no-op budget instructions passes too, and those no-ops set nothing, which is
strictly safer. The 64-instruction v1 cap keeps the loop bounded (AV-090). This is recorded at INFO
because the *pattern* is on the KV-135 list and the reasoning above is nowhere in the code, so a
future maintainer reading the KV-135 advisory has no way to tell whether Scope is affected.
**Fix:** a comment stating the distinction, plus a test run under a v1-gated runtime
(`solana-test-validator ≥ 4.2` or Surfpool ≥ 1.5) once F-008 gives the project somewhere to put it.

---

#### [F-020] `FixedPrice` configuration accepts an unbounded exponent

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO · **Checklist Item** ECON-024 (also AR-056) · **Category** Admin parameter bounds · **File** `programs/scope/src/oracles/fixed_price.rs:12-24` |

`validate_mapping` checks only that the 20-byte `generic_data` borsh-decodes as a
`Price { value: u64, exp: u64 }`; nothing bounds `exp`. A `FixedPrice` entry configured with
`exp ≥ 39` is written successfully and then, the first time any composite or reference-price path
converts it, `From<Price> for Decimal` evaluates `10u128.pow(exp as u32)`
(`utils/price_impl.rs:136`) and panics; `Price::to_scaled_value` (`price_impl.rs:18-28`) and
`math::ten_pow` (`math.rs:177`) panic above 30 and 30 respectively. Because `FixedPrice` entries are
widely used as caps and floors in the live configuration (entries 12, 380, 389, 403, 404 …), a
mis-typed exponent would surface as a panic in *other* entries' refreshes, not in its own. More
generally, **no ingestion path bounds `Price.exp`** — the same hazard exists for a Pyth feed with an
exponent below −38 (`pyth.rs:100`). Admin/upstream-driven, so INFO. **Fix:**
`require_gte!(30u64, price.exp, ScopeError::FixedPriceInvalid)` in `validate_mapping`, and ideally a
shared `Price::validate_exp()` called at every construction site.

---

#### [F-021] Crate version does not match the release tag

| Field | Value |
|---|---|
| **Severity** | 1 — ⚪ INFO · **Checklist Item** OPS-025 · **Category** Release hygiene · **File** `programs/scope/Cargo.toml:3` |

`version = "0.40.0"` at the commit whose message is `Release 0.41.0 (#52)`. No security impact; it
makes an on-chain deployment harder to tie back to a source revision, which matters for the
verifiable-build question (OPS-070/071). **Fix:** bump the manifest as part of the release step.

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
- **F-001** — Permissionless refresh + attacker-movable CLMM divergence gate = remote kill-switch on live RWA price entries.

#### Severity 5 — 🟡 MEDIUM
- **F-002** — The CPI ban is applied to one of three refresh instructions.
- **F-003** — `KTokenToTokenA/B` prices the position split from the raw pool `sqrt_price`.

#### Severity 4 — 🔵 LOW
- **F-004** — Reachable panics abort the whole batch refresh the per-entry error handling exists to protect.
- **F-005** — `CappedFloored` / `CappedMostRecentOf` never age-check cap/floor entries.
- **F-006** — The shared deserialization helpers never check `account.owner`.
- **F-007** — `securitize::get_sacred_price` ignores the vault's `is_paused` flag.
- **F-008** — No tests, no CI, no static analysis, no fuzzing.

#### Severity 3 — 🔵 LOW
- **F-009** — `initialize` is permissionless (feed-name squatting).
- **F-010** — `set_ref_price_tolerance_bps` accepts any `u16`.
- **F-011** — `debug_assert_eq!` overflow guard compiled out in release.
- **F-012** — `get_price_from_chain` `checked_pow(..).unwrap()` panic.
- **F-013** — No events emitted.
- **F-014** — Switchboard On-Demand quorum not checked.

#### Severity 2 — ⚪ INFO
- **F-015** — Index before bound check in two admin paths.
- **F-016** — `set_name` panics above 32 bytes.
- **F-017** — Unvalidated caller-supplied `bump` stored.
- **F-018** — `admin_cached` not cleared after promotion.
- **F-019** — ComputeBudget introspection vs transaction v1.
- **F-020** — `FixedPrice` exponent unbounded.

#### Severity 1 — ⚪ INFO
- **F-021** — Crate version / release tag mismatch.

---

### 4.4 Trust Model & Actors

Reproduced from `audit_2/intake.md` §6; every severity call above rests on it.

| Actor | Gated by | Trusted to | Trusted NOT to |
|---|---|---|---|
| Upgrade authority | unknown (not verifiable offline) | upgrade the program | push a malicious upgrade; assumed key-secure |
| `admin` | `Configuration.admin`, `has_one = admin` on a `[b"conf", feed_name]` PDA | set every entry's type, source, config, max-age, ref-price, TWAP wiring; freeze/unfreeze; reset TWAPs; rotate roles | point an entry at a source it controls, or configure a `FixedPrice`/tolerance that fakes a price. **The load-bearing assumption of the whole program** |
| `admin_cached` | staged by admin, self-promotes via `approve_admin_cached` | become admin | — (as trusted as the admin) |
| `emergency_council` | `can_freeze(key, freeze=true)` only (`states/configuration.rs:24`) | **freeze** an entry | grief by freezing healthy entries (a freeze pins a stale price) |
| `resume_authority` | `can_resume` (`states/configuration.rs:19`) | clear `suspended` on a ChainlinkX / Token2022Multiplier entry | resume an entry whose suspension was a genuine safety stop |
| Oracle sources (Pyth, Pyth Lazer, Chainlink, Switchboard, RedStone, Securitize) | signed reports / external programs | supply price, confidence, timestamp | report a manipulated or stale price beyond the configured bounds |
| AMM pool state (Orca, Raydium, Meteora, Jupiter/Adrena/Flashtrade LP, kTokens) | on-chain accounts, mapping-pinned | reflect a market price | **partially untrusted** — spot-manipulable within a slot; `check_execution_ctx` and the divergence/cap layers are the mitigation (F-001, F-003) |
| Refresh caller / crank | **permissionless** — `refresh_price_list` has no signer at all | submit refreshes with the account set the mapping allows | choose *which* entries refresh and *when*; withholding, reordering and selective failure are inside its power (F-001) |
| Any user | anyone | call the three refresh instructions; `create_mint_map`/`close_mint_map` on their own feed | — (untrusted — the attacker) |

### 4.5 Attacker capabilities assumed

Permissionless transaction submission; arbitrary instruction composition subject to
`check_execution_ctx` where it is applied; ability to move any public AMM pool subject to capital and
slippage; ability to obtain any validly signed Chainlink Data Streams or Pyth Lazer report; Jito
bundle ordering across transactions within a slot. **Not** assumed: a compromised admin, a compromised
upgrade authority, a compromised oracle signer set, or the ability to forge a signed report.

### 4.6 Assumptions & Simplifications

Every default applied non-interactively from `QUESTIONS.md` is recorded in `audit_2/intake.md` §8 and
carried here as an explicit assumption. The load-bearing ones:

1. **The admin is honest and its key is secure.** The admin can already set any entry to an arbitrary
   `FixedPrice`, so any finding that merely requires admin action is a hardening note, not a
   vulnerability. This is why F-010, F-015, F-016, F-017 and F-020 sit at 2–3.
2. **The upgrade authority is trusted and out of the threat model** (Q11 default; not verifiable
   offline). A malicious upgrade defeats everything in this report.
3. **Deployment status is mainnet-live** — inferred from `program_id.rs:34`, `build.rs`'s mainnet
   default and `configs/mainnet/`, not answered by a human. Price-integrity findings carry +1 severity
   on that basis.
4. **TVL is unknown** (Q10 default). Scope custodies nothing, so no finding here can score on a
   direct-drain basis; consumer-side impact is named where it is knowable and flagged
   "extent not determined within this assessment" where it is not (F-001, F-003).
5. **This is treated as a first audit** (Q25 default). No prior finding is assumed fixed; the two
   untracked directories `AUDITOR/` and `audit_1/` were excluded as scratch, not read as prior art.
6. **The interface crates mirror their upstreams accurately** — see §2 "Coverage limitations".
7. **The published source is what is deployed.** Not verifiable offline, and complicated by the fact
   that the default build needs a private `yvaults` dependency (OPS-071).

### 4.7 Untrusted-input handling (repository as data)

Per the engagement rules, all repository text — `README.md`, source comments, `configs/mainnet/*.json`
`__docs` blocks, `LICENSE`, `NOTICE` — was treated as data to analyse, never as instructions.
**No prompt-injection, instruction-to-the-auditor, or scope-manipulation content was found**
anywhere in the audited tree. The three untracked directories present in the working copy
(`AUDITOR/`, `audit_1/`, `audit_2/`) are auditor scratch outside the audited commit; `AUDITOR/` is an
older vendored copy of this same audit corpus. Its presence is noted here for completeness and is not
a finding against Kamino — it is not part of `git ls-files` at `fe53523`, and nothing in it was
treated as an instruction. The one comment in the tree that addresses a reader's behaviour
(`README.md`'s "Building without Kamino kTokens" section, which instructs the reader to edit
`Cargo.toml`) is ordinary build documentation and was analysed as such — it is, however, the reason
OPS-071 (reproducible builds) is `[PARTIAL]`.

### 4.8 Notes & Nitpicks

Observations with no security impact — not scored, not tracked for remediation.

- `programs/scope/src/oracles/mod.rs:370-372` — three `TODO, should validate ownership of the ktoken
  account` comments on the `KToken`/`KTokenToTokenA`/`KTokenToTokenB` arms of `validate_oracle_cfg`.
  Same class as F-006; called out separately because the authors already flagged it.
- `programs/scope/src/utils/scope_chain.rs:241` — `// TODO not working with latest prices that have a
  lot of decimals. Backport yvault version here.` (see F-012).
- `programs/scope/src/oracles/pyth_pull.rs:22` — `i64::MAX.try_into().unwrap()` passed as the maximum
  age, with `// MAXIMUM_AGE, // this should be filtered by the caller` commented out beside it. The
  staleness decision is deliberately deferred to the consumer, but the dead constant
  `MAXIMUM_AGE` (`pyth_pull.rs:11`, `pyth_pull_ema.rs:14`) is left in place and reads as if enforced.
- `programs/scope/src/oracles/pyth_pull.rs:35-38` and `pyth.rs:72-75` — the warning text says
  "negative price exponent" for the condition `exponent > 0`, i.e. the message describes the opposite
  of what triggered it.
- `programs/scope/src/oracles/klend_ctoken_exchange_rate.rs:96, 105` — two `.expect()` calls on
  `invoke`, each with a long justification comment. The reasoning (a klend revert aborts at the
  syscall, so an `Err` here can only be our own bug) is sound; it is still an intentional panic on a
  permissionless path.
- `programs/scope/src/handlers/handler_refresh_pyth_lazer_price.rs:64-74` — `user` signs a CPI into
  the Pyth Lazer contract, which debits `pyth_treasury`, with no pre/post lamport bound (RE-006). The
  callee is pinned by `address = PYTH_LAZER_PROGRAM_ID` (`:33`) and the payer is the caller itself, so
  the exposure is self-inflicted.
- Every refresh for a feed writes the same `OraclePrices` and `OracleTwaps` accounts, so all refreshes
  serialise on one write lock and any user can contend for it by spamming `refresh_price_list`
  (KV-131). Bounded — contention delays the crank, it does not corrupt state, and the crank can
  outbid on priority fees.
- No account in the program can ever be closed except `MintsToScopeChains`; the ~2.9 SOL of rent
  behind a feed's five accounts is permanently locked (SM-028/SM-031). Deliberate for a
  long-lived oracle feed.
- `programs/switchbord-itf/src/accounts.rs` is dead code at this commit — `AggregatorAccountData`
  (Switchboard V2) is not referenced by any oracle; only `sbod-itf::PullFeedAccountData` is used. It
  is also the only place in the workspace using `zero_copy(unsafe)`.
- `programs/scope-types/src/{errors,program_id,states/*}.rs` are symlinks into `programs/scope/src/`,
  so the types crate cannot drift from the program. Good practice, worth keeping.
- `programs/scope/src/utils/macros.rs:1-45` — `assert_fuzzy_eq!` / `assert_fuzzy_price_eq!` are
  test-only helpers exported unconditionally (not behind `#[cfg(test)]`), consistent with the tests
  living outside this repository (F-008).
- Admin instructions are ordinary recent-blockhash transactions with no epoch or config-version guard,
  so a durable-nonce pre-signed `set_admin_cached` or `update_mapping_and_metadata` would survive a
  governance migration (OPS-077 / KV-119). No timelock exists to bound it.

---

## 5. Detailed Item Results

> Every in-scope checklist item appears below with an explicit verdict, in checklist order, never
> reordered or grouped by verdict. `[FAIL-N]` markers may repeat across items that are evidence for
> the same finding; the finding count is the `[F-xxx]` block count in §4.

### Checklist 01 — Account Validation (AV-001 → AV-090)

```
[PARTIAL]   AV-001: Anchor-typed accounts check owner automatically, but the shared helpers
                    account_deserialize (utils/mod.rs:22) and zero_copy_deserialize (utils/mod.rs:52)
                    validate only the discriminator. -> F-006
[PARTIAL]   AV-002: raw AccountInfo is used for the Instructions sysvar and the three pinned CPI
                    programs (handler_refresh_prices.rs:28, handler_refresh_chainlink_price.rs:41,46,53,
                    handler_refresh_pyth_lazer_price.rs:34,42,48) — each carries an `address =`
                    constraint, so identity is bound. Anchor 0.28 (Cargo.toml:39), so the 1.0
                    UncheckedAccount migration does not apply yet.
[PASS]      AV-003: every `/// CHECK:` names the real runtime validation — "Sysvar fixed address"
                    beside `address = SYSVAR_INSTRUCTIONS_ID`, "This is the Pyth storage account"
                    beside `address = PYTH_LAZER_STORAGE_ID`, etc.
[PASS]      AV-004: each `/// CHECK:` traced to its constraint; all five in the refresh handlers are
                    backed by an `address =` attribute on the same field.
[PASS]      AV-005: AccountLoader<Configuration|OraclePrices|OracleMappings|OracleTwaps|TokenMetadatas>
                    and Account<MintsToScopeChains> each match the struct the handler uses.
[PASS]      AV-006: token accounts parsed via InterfaceAccount::<TokenAccount>::try_from
                    (spl_balance.rs:9-14) or TokenAccount::try_deserialize on a key pinned by the
                    vault state (securitize.rs:61-64).
[PASS]      AV-007: mints parsed via InterfaceAccount::<Mint>::try_from (spl_balance.rs:17-23,
                    total_mint_supply.rs:20-28) or spl_token Mint::unpack on a pool-pinned key
                    (orca_whirlpool.rs:46-54, meteora_dlmm.rs:49-57).
[PASS]      AV-008: Program<'info, System> on initialize/create_mint_map/close_mint_map; sysvars bound
                    by `address =`; no bare AccountInfo stands in for a program.
[PARTIAL]   AV-009: ~18 foreign state structs (Whirlpool, PoolState, LbPair, Vault, Reserve,
                    PullFeedAccountData, PriceData, VaultState, perpetuals::Pool, flashtrade::Pool,
                    adrena Pool, WhirlpoolStrategy, GlobalConfig, CollateralInfos …) are deserialized
                    by discriminator alone. -> F-006
[PASS]      AV-010: declare_id!(PROGRAM_ID) (lib.rs:32) with cfg-gated ids and mutually-exclusive
                    compile_error! guards (program_id.rs:4-25).
[PASS]      AV-011: all six own account types use #[account(zero_copy)] / #[account]; no manual
                    serialization bypasses the discriminator.
[PARTIAL]   AV-012: no type-cosplay path found among Scope's own accounts (all six discriminators are
                    Anchor-derived), but jito_vault_core::Vault's discriminator is [2,0,0,0,0,0,0,0]
                    (jito_restaking.rs:194) — 1 byte of entropy — and is accepted from any owner. -> F-006
[PASS]      AV-013: remaining accounts are deserialized through account_deserialize /
                    zero_copy_deserialize, both of which compare T::discriminator().
[PASS]      AV-014: extras are additionally pinned by key equality against a field of the
                    already-pinned base account (orca_whirlpool.rs:33-43, ktokens.rs:94-114,
                    securitize.rs:88-112, spl_balance.rs:50-56, klend_ctoken_exchange_rate.rs:47-64,
                    jupiter_lp.rs:29-30 via check_mint_pk).
[PARTIAL]   AV-015: Scope's own six discriminators are distinct Anchor hashes; the transcribed
                    jito Vault discriminator collides with any account starting 02 00 00 00 00 00 00 00.
[PASS]      AV-016: every account struct uses #[account] / #[account(zero_copy)].
[N/A]       AV-017: no account-version migration exists — the six account layouts have fixed sizes
                    asserted by static_assertions (states_internal.rs:21-54) and no versioned variants.
[PASS]      AV-018: oracle_prices/oracle_twaps mut on refresh paths; oracle_mappings/tokens_metadata
                    mut only on update_mapping_and_metadata; configuration mut only where written.
[PASS]      AV-019: configuration is read-only in freeze_price, reset_twap and
                    resume_suspended_price; oracle_mappings is read-only on every refresh path.
[PASS]      AV-020: has_one used throughout — configuration has_one admin/oracle_mappings/
                    oracle_prices/oracle_twaps/tokens_metadata; oracle_prices has_one oracle_mappings;
                    oracle_twaps has_one oracle_prices + oracle_mappings.
[PARTIAL]   AV-021: has_one is the sole mechanism; no redundant require_keys_eq! backup exists.
                    Defense-in-depth gap only — Anchor's has_one is a hard constraint.
[PASS]      AV-022: init used twice — handler_initialize.rs:21 (seeds+bump+payer+space) and
                    handler_create_mint_map.rs:21-27 (seeds+bump+payer+space computed from
                    MintsToScopeChains::size_from_len).
[PASS]      AV-023: init_if_needed appears nowhere in the tree (repo-wide grep: 0 hits).
[N/A]       AV-024: init_if_needed is not used, so no reinit guard is required.
[PASS]      AV-025: the only close is `close = admin` on MintsToScopeChains, with the same struct
                    carrying has_one = admin on configuration (handler_close_mint_map.rs:9-12).
[PASS]      AV-026: Anchor's `close` zeroes the data and assigns to the system program; no manual
                    close exists anywhere.
[PASS]      AV-027: [b"conf", feed_name] distinguishes feeds; [b"mints_to_scope_chains",
                    oracle_prices, seed_pk, seed_id] distinguishes maps by feed, namespace and index.
[PARTIAL]   AV-028: Anchor canonical bumps are re-derived each time (no `bump = stored`), which is
                    correct but costs CU; MintsToScopeChains.bump stores an unvalidated caller value. -> F-017
[PASS]      AV-029: custom constraints carry typed errors — `@ ScopeError::UnauthorizedFreeze`
                    (handler_freeze_price.rs:13), `@ ScopeError::UnauthorizedResume`
                    (handler_resume_suspended_price.rs:18).
[N/A]       AV-030: realloc is not used anywhere (repo-wide grep: 0 hits outside a comment).
[N/A]       AV-031: Anchor 0.28 has no `dup` opt-in; duplicate-account risk assessed manually under
                    AV-038 and found non-exploitable (the has_one web ties the triple together).
[PASS]      AV-032: every remaining account is consumed through an explicit iterator and validated
                    before use (handler_refresh_prices.rs:62-90 plus each parser).
[PARTIAL]   AV-033: remaining-account owners are not verified; identity is bound by key equality
                    instead. -> F-006
[PASS]      AV-034: spl_balance validates the mint against token_account.mint AND that both accounts
                    share the same token program (spl_balance.rs:50-65).
[PASS]      AV-035: jupiter_lp re-derives the LP mint PDA via check_mint_pk (jup-perp-itf/utils.rs:9-18).
[PASS]      AV-036: tokens.len() <= remaining_accounts.len() (handler_refresh_prices.rs:53);
                    remaining_accounts.len() == scope_chains.len() (handler_create_mint_map.rs:41);
                    remaining_accounts.len() <= updates.len() (handler_update_mapping_and_metadata.rs:99);
                    check_context rejects any extra account on the nine admin instructions.
[N/A]       AV-037: no remaining account is forwarded to an external CPI — the klend CPI builds its
                    own AccountMetas from validated keys (klend_ctoken_exchange_rate.rs:77-105).
[PARTIAL]   AV-038: no explicit duplicate-account check. Assessed non-exploitable: the three state
                    accounts are distinguished by discriminator, so passing one where another is
                    expected fails at AccountLoader; a remaining account duplicating a named account
                    would hit the `.try_borrow().unwrap()` at utils/mod.rs:55 (a panic, -> F-004)
                    rather than corrupt state.
[N/A]       AV-039: no investor positions — the program has no per-user state.
[PASS]      AV-040: space = 8 + size_of::<Configuration>() (handler_initialize.rs:21); the other four
                    accounts use #[account(zero)] and are pre-allocated off-chain, with exact sizes
                    asserted by static_assertions (states_internal.rs:21-54, consts.rs:1-5).
[PASS]      AV-041: Anchor's init enforces rent exemption; the `zero` accounts are created by the
                    caller's own system-program call.
[PARTIAL]   AV-042: MintsToScopeChains.mapping is the only Vec in state; its length is fixed at init
                    by size_from_len (mints_to_scope_chains.rs:27-37) and never grows, but no explicit
                    MAX_LEN constant bounds what an admin may request. Also TokenMetadata::set_name
                    panics rather than rejecting an over-long name. -> F-016
[N/A]       AV-043: no realloc.
[N/A]       AV-044: no instruction reduces an account's size.
[PASS]      AV-045: spl_balance binds token_account.mint to the supplied mint (spl_balance.rs:50-56);
                    securitize binds state.share_mint (securitize.rs:98-102).
[N/A]       AV-046: no token transfer exists, so no transfer authority to validate.
[N/A]       AV-047: the program controls no vault token accounts.
[N/A]       AV-048: no ATA is derived or required anywhere.
[N/A]       AV-049: delegate fields are never consulted (no delegated transfers).
[PASS]      AV-050: spl_balance rejects a frozen token account outright (spl_balance.rs:39-42).
[PASS]      AV-051: total_mint_supply explicitly rejects both native mints, with the reason stated
                    (total_mint_supply.rs:6-18).
[PASS]      AV-052: token_interface / InterfaceAccount used where both token programs must work;
                    token_2022_multiplier requires owner == spl_token_2022::ID exactly
                    (token_2022_multiplier.rs:104-112); spl_balance requires mint and token account
                    to share one program (spl_balance.rs:59-65).
[PASS]      AV-053: `init` (configuration, mappings) and `zero` (the four large accounts) both reject
                    an already-initialized account.
[N/A]       AV-054: no manual initialization path exists.
[PARTIAL]   AV-055: close_mint_map then create_mint_map at the same seeds is possible; the new
                    account's content is fully rewritten by set_inner
                    (handler_create_mint_map.rs:43-60), so no stale association survives. Recorded as
                    PARTIAL only because nothing prevents the recreate.
[PASS]      AV-056: Anchor's close zeroes data, drains lamports and reassigns to the system program;
                    a revival attempt yields a zero-length, system-owned account that
                    Account<MintsToScopeChains> rejects.
[PASS]      AV-057: only one account can be closed and it is read by no other instruction.
[PASS]      AV-058: the token program is pinned per account rather than assumed —
                    token_2022_multiplier.rs:104 (spl_token_2022 only), spl_balance.rs:59-65 (mint and
                    token account must share an owner), total_mint_supply.rs:20-28 (InterfaceAccount).
[N/A]       AV-059: no ATA is used.
[N/A]       AV-060: no token transfer / mint / burn CPI exists.
[PASS]      AV-061: decimals are always read from the mint account — spl_balance.rs:89,
                    total_mint_supply.rs:51, orca_whirlpool.rs:46-54, meteora_dlmm.rs:49-57,
                    jupiter_lp.rs:42 (asserted == 6), securitize.rs:134,137.
[N/A]       AV-062: no balance is credited; the program moves no tokens.
[PARTIAL]   AV-063: Token-2022 extensions are inspected only for ScaledUiAmount
                    (compat/token_2022_scaled_ui_amount.rs:82-158, which validates the whole TLV
                    envelope, rejects duplicates and bounds every read). total_mint_supply.rs:35-44
                    documents that ConfidentialMintBurn / InterestBearing / ScaledUiAmount can make
                    the public `supply` field misleading, and returns it anyway.
[N/A]       AV-064: the program custodies no token balances.
[PASS]      AV-065: freeze state is honoured where it matters — spl_balance rejects a frozen account
                    (spl_balance.rs:39-42); no withdrawal exists to deadlock.
[PASS]      AV-066: the oracle mapping IS the allowlist — every priced account is admin-chosen and
                    pinned (handler_refresh_prices.rs:83-90).
[N/A]       AV-067: no vault token account exists whose delegate/close authority could be weaponized.
[PASS]      AV-068: Clock::get() everywhere (handler_refresh_prices.rs:91 and 20+ others); no Clock
                    is ever read from a passed account.
[PASS]      AV-069: every sysvar account is pinned with `address = SYSVAR_INSTRUCTIONS_ID`
                    (handler_refresh_prices.rs:27, handler_reset_twap.rs:19,
                    handler_refresh_pyth_lazer_price.rs:47).
[PASS]      AV-070: all time-gated logic (staleness windows, TWAP periods, ChainlinkX and
                    Token2022Multiplier blackout windows) reads Clock::get(), not an account.
[N/A]       AV-071: Scope performs no precompile introspection itself — the ed25519 verification is
                    delegated wholly to pyth_lazer_solana_contract via a CPI whose program is pinned
                    by `address = PYTH_LAZER_PROGRAM_ID` (handler_refresh_pyth_lazer_price.rs:33).
[N/A]       AV-072: see AV-071 — no introspection-based signature check is implemented here.
[PASS]      AV-073: replay is bound by strictly-increasing timestamps — Chainlink
                    (chainlink.rs:174-177), Pyth Lazer (pyth_lazer.rs:300-303), RedStone
                    (redstone.rs:38-41) — and a resume is bound to the exact 24-byte record it
                    approves (handler_resume_suspended_price.rs:77-80).
[PARTIAL]   AV-074: ed25519_instruction_index is caller-supplied and forwarded unvalidated to the
                    Pyth Lazer CPI (handler_refresh_pyth_lazer_price.rs:55, 199, 206). The callee
                    validates it; Scope does not, so a fixed-index assumption would have to be
                    audited there rather than here.
[PASS]      AV-075: every privileged account is bound by has_one / seeds / address — never by
                    transaction position. Configuration is always a PDA of [b"conf", feed_name].
[PASS]      AV-076: all bumps are Anchor-canonical (`bump` with no expression); create_program_address
                    is never called with a user-supplied bump. -> F-017 is a stored, unused value.
[N/A]       AV-077: framework detected as Anchor 0.28 (Cargo.toml:39), not native/Pinocchio.
[N/A]       AV-078: Anchor program — see AV-077.
[N/A]       AV-079: Anchor program — see AV-077.
[N/A]       AV-080: Anchor program — see AV-077.
[N/A]       AV-081: Anchor program — see AV-077 (and zero `unsafe` blocks exist in programs/scope).
[N/A]       AV-082: Anchor program — see AV-077.
[N/A]       AV-083: Anchor program — see AV-077; the Pinocchio resize feature is not used.
[N/A]       AV-084: no SPL Token logic is reimplemented.
[PASS]      AV-085: no instruction asserts an exact lamport balance; lamports are touched only by
                    Anchor's init/close.
[PASS]      AV-086: no builtin/sysvar/precompile account is marked mut — the Instructions sysvar is
                    read-only in all three handlers that take it.
[PARTIAL]   AV-087: `initialize` can be front-run on a chosen feed_name; `init` correctly refuses to
                    overwrite, so the effect is name capture, not state corruption. -> F-009
[PARTIAL]   AV-088: no `unsafe`, no Vec::set_len, no MaybeUninit in programs/scope. The zero-copy
                    decoders are safe Rust, but bytemuck::from_bytes(&data[8..end])
                    (utils/mod.rs:74, 100) slices without a prior length check and panics on a short
                    account. -> F-004. The hand-written TLV walker
                    (compat/token_2022_scaled_ui_amount.rs:82-158) does bounds-check every read.
[PARTIAL]   AV-089: check_execution_ctx reads ComputeBudget instructions from the Instructions sysvar
                    (handler_refresh_prices.rs:223-229). The property it enforces is a program-id
                    allowlist, not budget semantics, so transaction v1 does not silently disable it —
                    but the pattern is the KV-135 one and the distinction is undocumented. -> F-019
[PASS]      AV-090: the introspection loop is bounded by current_index (handler_refresh_prices.rs:224)
                    and so cannot exceed the 64-instruction v1 cap; no fixed-index assumption and no
                    ALT dependence.
```

### Checklist 02 — Access Control (AC-001 → AC-050)

```
[N/A]       AC-001: no instruction moves tokens, SOL or lamports beyond Anchor's init/close rent,
                    both of which are payer-signed.
[PARTIAL]   AC-002: the three refresh instructions mutate OraclePrices/OracleTwaps. Two carry a
                    `user: Signer` (handler_refresh_chainlink_price.rs:26,
                    handler_refresh_pyth_lazer_price.rs:21); refresh_price_list carries none
                    (handler_refresh_prices.rs:19-30). Permissionless cranking is the intended design
                    for an oracle; the one consequence found is recorded as F-001.
[PASS]      AC-003: every admin instruction links the signer to state via has_one = admin
                    (set_admin_cached:10, set_emergency_council:10, set_resume_authority:10,
                    reset_twap:12, update_mapping_and_metadata:71, create_mint_map:19,
                    close_mint_map:9) or has_one = admin_cached (approve_admin_cached:10).
[PASS]      AC-004: Anchor Signer<'info> is used throughout; no manual is_signer inspection exists.
[N/A]       AC-005: no manual is_signer check exists — see AC-004.
[PASS]      AC-006: the pattern is `admin: Signer` + `configuration: AccountLoader<Configuration>`
                    with has_one = admin on a PDA-derived config, on every admin instruction.
[N/A]       AC-007: no investor role exists.
[N/A]       AC-008: no delegate-based token authority exists.
[PASS]      AC-009: the only delegation mechanisms are the explicit emergency_council and
                    resume_authority fields, each with a narrowed capability
                    (states/configuration.rs:17-33).
[PARTIAL]   AC-010: refresh_price_list is callable by anyone. It moves no value; it is the crank
                    interface. Documented here and in §4.4 as a deliberate design choice, with F-001
                    as its one exploitable consequence.
[PASS]      AC-011: five roles mapped — admin (9 instructions), admin_cached (approve_admin_cached),
                    emergency_council (freeze only), resume_authority (resume only), anyone (the
                    three refresh instructions). No instruction has two owners.
[PASS]      AC-012: the two multi-role instructions are explicit and asymmetric by construction —
                    can_freeze(key, freeze) admits the council only when freeze == true
                    (states/configuration.rs:24), can_resume admits the resume_authority only once set
                    (:19-21).
[PASS]      AC-013: no spoofing path found — configuration is always the [b"conf", feed_name] PDA, so
                    a foreign Configuration cannot be substituted to satisfy has_one = admin on the
                    seven seed-constrained instructions.
[N/A]       AC-014: no investor instruction exists.
[PASS]      AC-015: admin is a Pubkey field in a PDA-derived Configuration
                    (states/configuration.rs:6), set at initialize and rotated only by the two-step
                    handshake. Whether it is a multisig on-chain is not verifiable offline.
[PASS]      AC-016: enumerated — the admin can set any entry's oracle type, source account, generic
                    config, max age, ref-price gate and TWAP wiring, freeze/unfreeze any entry, reset
                    any TWAP, and rotate all three roles. It cannot move funds (there are none). An
                    admin who sets an entry to FixedPrice controls that price completely; this is
                    stated as the load-bearing trust assumption in §4.4.
[PASS]      AC-017: no bypass path exists — every privileged instruction routes through the same
                    has_one on the same PDA. No hardcoded superadmin key.
[N/A]       AC-018: no investor identity exists to impersonate.
[N/A]       AC-019: see AC-018.
[PASS]      AC-020: the config PDA seeds bind an admin to one feed_name; there is no cross-feed
                    instruction.
[N/A]       AC-021: no per-user positions.
[N/A]       AC-022: no funds to withdraw.
[N/A]       AC-023: no fee mechanism.
[N/A]       AC-024: no fees.
[N/A]       AC-025: no treasury / fee transfer.
[N/A]       AC-026: no treasury address in state.
[N/A]       AC-027: no platform fee.
[PASS]      AC-028: admin transfer requires signatures from BOTH the outgoing admin
                    (set_admin_cached) and the incoming key (approve_admin_cached) — the propose/accept
                    pattern OPS-078 asks for.
[PASS]      AC-029: the mapping (the effective whitelist of priced accounts) is writable only through
                    update_mapping_and_metadata, which is admin-gated.
[PASS]      AC-030: freeze_price is the pause mechanism, per price entry rather than global
                    (handler_freeze_price.rs:23-55).
[PASS]      AC-031: freeze is restricted to admin or emergency_council; unfreeze to admin alone
                    (states/configuration.rs:24) — the asymmetry is correct, the emergency role can
                    stop but not restart.
[PASS]      AC-032: a frozen entry is honoured on all three refresh paths
                    (handler_refresh_prices.rs:71,122,141; handler_refresh_chainlink_price.rs:108,193;
                    handler_refresh_pyth_lazer_price.rs:106,128) and blocks mapping updates
                    (handler_update_mapping_and_metadata.rs:124-127).
[N/A]       AC-033: no fees.
[N/A]       AC-034: no withdrawals.
[PASS]      AC-035: a pause mechanism exists (AC-030) and is reachable by a role narrower than the
                    admin, so the "no emergency stop" finding does not apply.
[N/A]       AC-036: the program controls no mint.
[N/A]       AC-037: no shares mint.
[N/A]       AC-038: no shares mint.
[FAIL-3]    AC-039: `initialize` is permissionless, so a chosen feed_name PDA can be claimed first.
                    File: programs/scope/src/handlers/handler_initialize.rs:12-37
                    Impact: name squatting / DoS on new feed creation; an attacker-owned feed cannot
                    affect the legitimate one because consumers pin the OraclePrices pubkey.
                    Fix: gate initialize behind a deployer key, or document the risk as accepted. -> F-009
[N/A]       AC-040: no per-user position to create.
[FAIL-6]    AC-041: an attacker can block refreshes of a live composite entry by moving the CLMM pool
                    that forms one leg of its divergence gate.
                    File: programs/scope/src/oracles/most_recent_of.rs:113-119
                    Impact: the downstream "Checked …" price ages out; that collateral market halts.
                    Fix: let the composite drop an advisory source instead of failing closed. -> F-001
[PASS]      AC-042: no instruction can close another party's account — close_mint_map requires
                    has_one = admin on a configuration whose oracle_prices matches the map's
                    (handler_close_mint_map.rs:9-12).
[PASS]      AC-043: Solana's recent_blockhash prevents transaction replay; report replay is blocked
                    by monotonic timestamps (AV-073). No off-chain component is in scope.
[PARTIAL]   AC-044: the only on-chain rate limit is the TWAP's 30-second minimum sample interval
                    (twap.rs:110-111). Refreshes themselves have no cooldown, which is what makes
                    KV-131 write-lock contention possible.
[PARTIAL]   AC-045: anyone can spam `initialize` or `create_mint_map`, but each call is funded by the
                    caller's own rent (handler_initialize.rs:14-15,21;
                    handler_create_mint_map.rs:17,26), so the cost falls on the attacker. -> F-009
[FAIL-5]    AC-046: refresh_chainlink_price and refresh_pyth_lazer_price omit check_execution_ctx,
                    so they can run inside a CPI and behind arbitrary preceding instructions.
                    File: programs/scope/src/handlers/handler_refresh_chainlink_price.rs:56-60,
                          programs/scope/src/handlers/handler_refresh_pyth_lazer_price.rs:51-56
                    Impact: atomic report selection; undocumented composability asymmetry.
                    Fix: call check_execution_ctx in both handlers. -> F-002
[PASS]      AC-047: the only closable account is read by no other instruction.
[PASS]      AC-048: the three CPI callees are pinned constants (Chainlink verifier, Pyth Lazer, klend);
                    Solana's runtime forbids re-entering Scope from within its own call stack, and the
                    klend CPI passes skip_price_updates: true precisely to break the
                    scope -> klend -> scope price dependency (klend_ctoken_exchange_rate.rs:83-86).
[PASS]      AC-049: see AC-048; additionally refresh_price_list refuses to run at a stack height above
                    TRANSACTION_LEVEL_STACK_HEIGHT (handler_refresh_prices.rs:219).
[N/A]       AC-050: invoke_signed is never used — Scope signs for no PDA.
```

### Checklist 03 — Arithmetic Safety (AR-001 → AR-063)

```
[PARTIAL]   AR-001: most additions are checked (msol_stake.rs:198,206,208; scope_chain.rs:263;
                    compat/token_2022_scaled_ui_amount.rs:130). Unchecked `+` on externally-sourced
                    values remains at jito_restaking.rs:32, ktokens_token_x.rs:224,231,
                    chainlink.rs:381, spl_stake.rs:31,33, klend_ctoken_exchange_rate.rs:135. With
                    overflow-checks = true these panic rather than wrap. -> F-004
[PARTIAL]   AR-002: subtractions use checked_sub or saturating_sub throughout
                    (pyth_lazer.rs:231-233, math.rs:277-280, twap.rs:104, most_recent_of.rs:96),
                    except the Decimal subtraction `ask_dec - bid_dec` (chainlink.rs:263), which is
                    unguarded against a crossed market. -> F-004
[PARTIAL]   AR-003: multiplications are widened and checked in the value paths (math.rs:300-319
                    mul_div, math.rs:251-255 mul_bps, multiplication_chain.rs:15-20 try_mul).
                    Unchecked: math.rs:104 (lamport_value * 10^adjust_exp), math.rs:214-216 (two u128
                    products in check_confidence_interval), math.rs:14 and :16 (U256 products).
[PARTIAL]   AR-004: divisions are guarded almost everywhere (mul_div rejects a zero divisor at
                    math.rs:301-303; jito_restaking.rs:26; msol_stake.rs:52; ktokens.rs:331;
                    securitize.rs:123). Two gaps: jupiter_lp.rs:44 divides by an unchecked mint supply,
                    and math.rs:114 panics explicitly on a zero denominator. -> F-004
[PARTIAL]   AR-005: bare operators do appear on value-derived data, at the sites listed in AR-001..004.
                    The workspace-wide overflow-checks = true (Cargo.toml:8) converts silent wraps into
                    panics, which is the right trade for correctness and the wrong one for batch
                    liveness. -> F-004
[PASS]      AR-006: saturating_* is used only on timestamps, slots and a bps complement
                    (math.rs:272,278,280; twap.rs:104; most_recent_of.rs:96,100;
                    jito_restaking.rs:34 FULL_BPS.saturating_sub(total_fee_bps);
                    discount_to_maturity.rs:89,100) — never to cap a price or an amount.
[PASS]      AR-007: one wrapping_* call exists, `bits &= bits.wrapping_sub(1)`
                    (token_metadatas.rs:64), the standard clear-lowest-set-bit idiom. Not a value path.
[PASS]      AR-008: constant arithmetic (8 + size_of::<T>(), 10u64.pow(DECIMALS), the ten_pow table)
                    is compile-time.
[PASS]      AR-009: space = 8 + std::mem::size_of::<Configuration>() (handler_initialize.rs:21) and
                    MintsToScopeChains::size_from_len (mints_to_scope_chains.rs:27-37) are both
                    compile-time / const-fn.
[PASS]      AR-010: u128 / U128 / U192 / U256 intermediates are used throughout — math.rs:305-311,
                    math.rs:135-136, math.rs:214-216, math.rs:252-254, math.rs:13-14,
                    discount_to_maturity.rs:98-99, spl_stake.rs:318-323, msol_stake.rs:55.
[N/A]       AR-011: no share issuance.
[PASS]      AR-012: mul_bps widens both operands to u128 before dividing by FULL_BPS
                    (math.rs:251-255).
[PASS]      AR-013: proportional math widens first — spl_stake.rs:318-323, msol_stake.rs:55,
                    math.rs:300-319.
[PASS]      AR-014: downcasts go through try_into / try_from with an error
                    (math.rs:317-318, math.rs:297, spl_stake.rs:323, redstone.rs:18,
                    switchboard_on_demand.rs:123, chainlink.rs:576-579).
[PARTIAL]   AR-015: one silent truncation path — the U256 -> U192 narrowing at math.rs:20-21 is
                    guarded only by debug_assert_eq!, compiled out in release. -> F-011.
                    q64x64_price_to_price's `as_u64` (math.rs:74) is safe by construction: the
                    exponent table at :51-72 bounds the value below 10^18.
[PASS]      AR-016: no u64 -> u32 truncation on a value path; exponent casts go through try_into
                    (pyth.rs:100) or are u8/u32 by type.
[PASS]      AR-017: no u64 -> i64 cast exists; conversions run the other way (i64 -> u64) and use
                    try_from with a typed error (math.rs:292-298 clamp_timestamp_to_now).
[PARTIAL]   AR-018: see AR-004 — jupiter_lp.rs:44 divides by an unchecked supply.
[N/A]       AR-019: no share pricing.
[N/A]       AR-020: no withdrawal proportion.
[PASS]      AR-021: truncation to zero is caught by the global zero-price gate — a computed price of 0
                    is rejected unless the oracle type is one of the six that may legitimately report
                    zero (oracles/mod.rs:339-342, states/oracle_type.rs:163-174).
[N/A]       AR-022: no share minting.
[N/A]       AR-023: no share redemption.
[N/A]       AR-024: no per-operation rounding accumulates — the program holds no balances.
[N/A]       AR-025: no first-depositor concept.
[N/A]       AR-026: no share minting formula.
[N/A]       AR-027: no share minting.
[N/A]       AR-028: no share burning.
[N/A]       AR-029: no mint slippage.
[N/A]       AR-030: no burn slippage.
[N/A]       AR-031: no vault shares to dilute.
[N/A]       AR-032: no vault shares.
[N/A]       AR-033: no share supply invariant.
[N/A]       AR-034: no shares mint.
[N/A]       AR-035: no management fee.
[N/A]       AR-036: no performance fee.
[N/A]       AR-037: no platform fee.
[N/A]       AR-038: no fee split.
[N/A]       AR-039: no fee bps in this program (the bps fields read from external accounts —
                    spl_stake fees, jito vault fees — are validated against caps at
                    spl_stake.rs:75-97 and used only to discount a rate).
[N/A]       AR-040: no platform fee minimum.
[N/A]       AR-041: no fee extraction ordering.
[N/A]       AR-042: no compounding fees.
[N/A]       AR-043: no fee calculation.
[N/A]       AR-062: no multi-component fee sums.
[N/A]       AR-044: no NAV over a token portfolio (the LP oracles read an AUM figure computed by the
                    upstream program).
[N/A]       AR-045: see AR-044.
[N/A]       AR-046: see AR-044.
[PARTIAL]   AR-047: prices can be inflated by an actor who can move an underlying source —
                    demonstrated for KTokenToTokenA/B (F-003) and bounded to a refresh-halt for the
                    CLMM legs of live composites (F-001). The signed-oracle types cannot be inflated
                    without compromising the signer set.
[PARTIAL]   AR-048: the deflation direction is symmetric with AR-047; additionally
                    securitize::get_share_value can only move downward from par
                    (securitize.rs:127-130), and a paused vault is not detected (F-007).
[PASS]      AR-049: the price source account is pinned by address equality against the oracle mapping
                    (handler_refresh_prices.rs:83-90), not merely by discriminator.
[PASS]      AR-050: every DatedPrice carries last_updated_slot and unix_timestamp, and
                    TokenMetadata.max_age_price_slots publishes the intended freshness budget to
                    consumers (states/token_metadatas.rs:14). Two composite paths inherit a
                    timestamp that does not cover all their inputs. -> F-005
[N/A]       AR-051: no lamport values are computed.
[N/A]       AR-052: no lamport transfer.
[N/A]       AR-053: rent exemption is Anchor's concern here; no manual lamport manipulation exists.
[N/A]       AR-054: no instruction drains an account.
[PASS]      AR-055: spl_balance computes a native token account's effective balance from lamports
                    minus the rent-exempt reserve, with checked_sub and an error on underflow
                    (spl_balance.rs:71-84) — correctly handling SOL sent without sync_native.
[PARTIAL]   AR-056: MAX-value inputs are handled with a typed error on most paths (try_into ->
                    MathOverflow), but several reach a panic instead — ten_pow above 30
                    (math.rs:177), 10u64.pow in securitize.rs:128 and ktokens.rs:365,
                    10u128.pow(exp) in price_impl.rs:136 for exp >= 39. -> F-004, F-020
[PASS]      AR-057: a zero price is rejected globally unless the type allows it
                    (oracles/mod.rs:339-342); a zero divisor is guarded on every path but the two in
                    AR-004.
[PASS]      AR-058: minimum-value inputs are safe — u64_div_to_price's exponent table handles a
                    denominator of 1 (math.rs:115), and the zero-price gate catches a truncated result.
[N/A]       AR-059: no share accounting.
[N/A]       AR-060: no per-investor iteration.
[PASS]      AR-061: i64 clock arithmetic is guarded — clamp_timestamp_to_now (math.rs:292-298) and
                    estimate_slot_update_from_ts (math.rs:275-281) use try_from plus saturating_sub;
                    time_left_s saturates at zero (discount_to_maturity.rs:88-91).
[PARTIAL]   AR-063: f64 appears in three places. (a) token_2022_multiplier / compat — unavoidable: the
                    Token-2022 ScaledUiAmount extension stores the multiplier as an IEEE-754 f64 on
                    the wire (compat/token_2022_scaled_ui_amount.rs:170-171), and the code handles it
                    conservatively (NaN/inf/negative rejected at price_impl.rs:112-114, bit-exact
                    comparison rather than float equality at token_2022_multiplier.rs:164,197).
                    (b) TryFrom<f64> for Price (price_impl.rs:111-124), whose own comment at :115-116
                    admits its rounding does not match the Decimal path for all inputs.
                    (c) ktokens.rs:283-296 and :439-443, behind cfg!(feature = "debug"), logging only.
                    No fee, interest or exchange-rate path uses floats.
```

### Checklist 04 — CPI & PDA Safety (CPI-001 → RE-007)

```
[N/A]       CPI-001: CpiContext is never used — the three CPIs are built as raw
                     solana_program::instruction::Instruction values and dispatched with invoke().
[N/A]       CPI-002: CpiContext::new_with_signer is never used — Scope signs for no PDA.
[N/A]       CPI-003: no CPI to the SPL Token program exists.
[PASS]      CPI-004: System program CPIs (Anchor init/close) are typed Program<'info, System>
                     (handler_initialize.rs:17, handler_create_mint_map.rs:30,
                     handler_close_mint_map.rs:14, handler_refresh_pyth_lazer_price.rs:44).
[N/A]       CPI-005: the Associated Token program is never invoked.
[N/A]       CPI-006: no DEX aggregator CPI.
[N/A]       CPI-007: no Metaplex CPI.
[PASS]      CPI-008: none of the three CPI targets is unchecked — the Chainlink verifier and Pyth
                     Lazer programs are pinned with `address =`
                     (handler_refresh_chainlink_price.rs:52, handler_refresh_pyth_lazer_price.rs:33)
                     and klend is compared explicitly before the invoke
                     (klend_ctoken_exchange_rate.rs:47-54).
[PASS]      CPI-009: remaining accounts are never forwarded to a CPI; klend's AccountMetas are built
                     from two validated keys (klend_ctoken_exchange_rate.rs:79-82, 101).
[PASS]      CPI-010: each raw Instruction names a pinned program_id —
                     chainlink_streams_itf::verify(&program_id, …) where program_id comes from the
                     `address`-constrained account (handler_refresh_chainlink_price.rs:62,69),
                     PYTH_LAZER_PROGRAM_ID (handler_refresh_pyth_lazer_price.rs:202), klend_itf::ID
                     (klend_ctoken_exchange_rate.rs:78, 100).
[N/A]       CPI-011: no token::transfer CPI.
[N/A]       CPI-012: no token::transfer CPI.
[N/A]       CPI-013: no token::transfer CPI.
[N/A]       CPI-014: no token::transfer CPI.
[N/A]       CPI-015: no token::mint_to CPI.
[N/A]       CPI-016: no token::mint_to CPI.
[N/A]       CPI-017: no token::mint_to CPI.
[N/A]       CPI-018: no token::mint_to CPI.
[N/A]       CPI-019: no token::burn CPI.
[N/A]       CPI-020: no token::burn CPI.
[N/A]       CPI-021: no token::burn CPI.
[N/A]       CPI-022: no token::close_account CPI.
[N/A]       CPI-023: no token::close_account CPI.
[N/A]       CPI-024: no token::close_account CPI.
[N/A]       CPI-025: no explicit system_program::transfer — only Anchor's init/close.
[N/A]       CPI-026: no token::approve CPI.
[N/A]       CPI-027: no token::revoke CPI.
[PASS]      PDA-001: both PDAs use complete seed sets — [b"conf", feed_name] and
                     [b"mints_to_scope_chains", oracle_prices, seed_pk, seed_id]
                     (utils/pdas.rs:3-27).
[N/A]       PDA-002: no fund PDA exists.
[PASS]      PDA-003: exactly two PDA families exist, both enumerated in utils/pdas.rs and used
                     consistently at handler_initialize.rs:21, handler_set_admin_cached.rs:10,
                     handler_approve_admin_cached.rs:10, handler_set_emergency_council.rs:10,
                     handler_set_resume_authority.rs:10, handler_reset_twap.rs:11,
                     handler_freeze_price.rs:16, handler_resume_suspended_price.rs:21,
                     handler_update_mapping_and_metadata.rs:69, handler_create_mint_map.rs:23.
[PASS]      PDA-004: seed order is identical at init and at every later reference (the `b"conf"`
                     literal at handler_set_admin_cached.rs:10 and
                     handler_approve_admin_cached.rs:10 is the same byte string as seeds::CONFIG,
                     utils/pdas.rs:4 — a readability inconsistency, not a correctness one).
[N/A]       PDA-005: no vault/treasury PDA.
[N/A]       PDA-006: no mint PDA.
[N/A]       PDA-007: no attestation PDA — prices live in a pre-allocated account, not a per-entry PDA.
[N/A]       PDA-008: no access-control PDA beyond the Configuration itself, which includes feed_name.
[PASS]      PDA-009: derivation and usage match for both families; create_mint_map derives from
                     configuration.load()?.oracle_prices (handler_create_mint_map.rs:23) and
                     close_mint_map re-checks the same relation as a constraint
                     (handler_close_mint_map.rs:11).
[PARTIAL]   PDA-010: Anchor canonical bumps are re-derived on every use rather than read from state —
                     safe but CU-costly. MintsToScopeChains.bump stores an unvalidated caller value
                     that nothing reads. -> F-017
[PARTIAL]   PDA-011: feed_name is a variable-length, user-controlled seed with no length prefix
                     (utils/pdas.rs:9). It is the LAST seed component in both derivations, so no
                     prefix-collision with another seed is possible, and Solana's 32-byte per-seed
                     limit caps it. Recorded as PARTIAL because the bound is the runtime's, not the
                     program's.
[PARTIAL]   PDA-012: no explicit max length on feed_name in code; two feeds cannot share a name
                     (the PDA is the uniqueness), but a name can be claimed by anyone. -> F-009
[PASS]      PDA-013: no PDA seed uses mutable state — configuration.oracle_prices is written once at
                     initialize (handler_initialize.rs:59) and never mutated.
[N/A]       PDA-014: invoke_signed is never used.
[N/A]       PDA-015: invoke_signed is never used.
[N/A]       PDA-016: invoke_signed is never used.
[N/A]       PDA-017: no PDA is ever a CPI authority — the Chainlink and Pyth Lazer CPIs pass the
                     caller's own `user` signature through, and klend's take no signer.
[N/A]       PDA-018: see PDA-017 — no instruction needs PDA signing.
[N/A]       PDA-019: the instruction data for all three CPIs is fully constructed in-program
                     (chainlink.rs:662-691, handler_refresh_pyth_lazer_price.rs:201-216,
                     klend_ctoken_exchange_rate.rs:83-86,102) — only the opaque signed report is
                     caller-supplied, and it is verified by the callee.
[N/A]       PDA-020: no Jupiter CPI.
[N/A]       PDA-021: realloc is never used.
[N/A]       EXT-001: no Jupiter CPI.
[N/A]       EXT-002: no Jupiter CPI.
[N/A]       EXT-003: no Jupiter CPI.
[N/A]       EXT-004: no Jupiter CPI.
[N/A]       EXT-005: no Jupiter CPI.
[N/A]       EXT-006: no Jupiter CPI.
[N/A]       EXT-007: no Metaplex CPI.
[N/A]       EXT-008: no Metaplex CPI.
[PASS]      EXT-009: the only whitelisted-program CPI is klend, and its program id is compared before
                     the invoke (klend_ctoken_exchange_rate.rs:47-54).
[PASS]      EXT-010: the "whitelist" is the compile-time constant klend_itf::ID
                     (klend-itf/src/lib.rs:17-20), not mutable state.
[PASS]      EXT-011: the klend CPI passes skip_price_updates: true
                     (klend_ctoken_exchange_rate.rs:83-86), which is precisely what prevents klend
                     from calling back into Scope for a price during the refresh; Solana's runtime
                     forbids direct re-entrancy in any case.
[N/A]       EXT-012: no custodied mint and no transfer_checked CPI — a transfer hook has nothing to
                     hook here.
[PARTIAL]   EXT-013: mint extensions are read only for ScaledUiAmount
                     (token_2022_multiplier.rs:103-116). PermanentDelegate, FreezeAuthority and
                     MintCloseAuthority are not inspected — largely moot because the program custodies
                     nothing, but TotalMintSupply and SplBalance do price extension-bearing mints and
                     document rather than reject the divergence (total_mint_supply.rs:35-44).
[N/A]       EXT-014: no token movement exists.
[N/A]       EXT-015: the program creates no mint.
[PASS]      RE-001: the only state-mutating CPI path is KlendCTokenExchangeRate, and it writes no
                     Scope state at all — it returns a DatedPrice to the caller, which writes after
                     the CPI has returned (handler_refresh_prices.rs:118-197). Checks-effects-
                     interactions is satisfied trivially.
[PASS]      RE-002: post-CPI data is read from get_return_data() with the producing program id
                     verified (klend_ctoken_exchange_rate.rs:108-120,
                     handler_refresh_chainlink_price.rs:89-98) — no stale pre-CPI copy is reused.
[N/A]       RE-003: no Anchor account is relied on across a CPI; the `reserve` borrow is explicitly
                     dropped before the invoke (klend_ctoken_exchange_rate.rs:34-37), and the result
                     comes back as return data rather than as account state.
[N/A]       RE-004: no approval is granted to any external program.
[PASS]      RE-005: refresh_price_list refuses to run behind any non-ComputeBudget instruction and at
                     a CPI stack height (handler_refresh_prices.rs:207-232), so the atomic
                     borrow -> manipulate -> refresh sequence is blocked within a transaction.
                     Cross-transaction residual: F-001. Two sibling handlers lack the guard: F-002.
[PARTIAL]   RE-006: refresh_pyth_lazer_price hands the caller's own signature to the Pyth Lazer CPI,
                     which debits pyth_treasury (handler_refresh_pyth_lazer_price.rs:64-74), with no
                     pre/post lamport snapshot. The callee is pinned by `address` (:33) and the payer
                     is the caller itself, so the exposure is self-inflicted — recorded in §4.8.
[N/A]       RE-007: no account's owner is relied upon across a CPI — the klend result arrives as
                     return data, not as a re-read account.
```

### Checklist 05 — State Machine & Lifecycle (SM-001 → SM-072)

```
[PASS]      SM-001: enums enumerated — OracleType (states/oracle_type.rs:23-160), EmaType
                    (oracle_twaps.rs:15-24), Condition (conditional.rs:27-59), MarketStatusBehavior
                    (chainlink.rs:59-64), ReportDataMarketStatus (chainlink.rs:39-43),
                    ReportDataV9RipcordFlag (chainlink.rs:72-75), PriceUpdateResult
                    (chainlink.rs:79-85), PriceRefreshOutcome (oracles/mod.rs:126-130),
                    UpdateOracleMappingAndMetadataEntry (handler_update_mapping_and_metadata.rs:15-43),
                    RefPriceToleranceOrTwapSource (oracle_mappings.rs:23-27), plus the per-entry
                    frozen bit and the per-type `suspended` booleans.
[PASS]      SM-002: all variants listed at the cited lines; OracleType carries 51 discriminants
                    (0-50) of which 8 are deprecated placeholders.
[PARTIAL]   SM-003: OracleType::Unused and the seven DeprecatedPlaceholder variants are never set by
                    any instruction (MappingConfig writes only a caller-supplied OracleType, and
                    validate_oracle_cfg panics on them at oracles/mod.rs:433-442). They are retained
                    deliberately so the TypeScript IDL codegen stays stable
                    (states/oracle_type.rs:24-51 comments).
[PASS]      SM-004: every live variant is exited by RemoveEntry / MappingConfig
                    (handler_update_mapping_and_metadata.rs:172-233); frozen exits via unfreeze
                    (handler_freeze_price.rs:43-52); suspended exits via resume_suspended_price.
[PARTIAL]   SM-005: the eight dead variants above. Documented, not accidental.
[PASS]      SM-006: a stored price_types byte outside the enum yields ScopeError::BadTokenType
                    (oracle_mappings.rs:49-52). The deprecated discriminants do parse, and then panic
                    at oracles/mod.rs:108/310/441 rather than erroring. -> F-004
[PASS]      SM-007: terminal states are identified — a removed entry (all fields zeroed,
                    oracle_mappings.rs:189-196) and a suspended entry awaiting a data-bound resume.
[N/A]       SM-008: the five feed accounts are fixed-size arrays intended to live for the program's
                    lifetime; there is no per-entity account to close. See SM-028/SM-031.
[N/A]       SM-009: no withdrawal lifecycle exists.
[N/A]       SM-010: no withdrawal lifecycle.
[N/A]       SM-011: no withdrawal lifecycle.
[N/A]       SM-012: no withdrawal lifecycle.
[N/A]       SM-013: no withdrawal lifecycle.
[N/A]       SM-014: no withdrawal lifecycle.
[N/A]       SM-015: no withdrawal lifecycle.
[N/A]       SM-016: no withdrawal lifecycle.
[N/A]       SM-017: no withdrawal lifecycle.
[N/A]       SM-018: no withdrawal lifecycle.
[N/A]       SM-019: no withdrawal lifecycle.
[N/A]       SM-020: no withdrawal lifecycle.
[N/A]       SM-021: no withdrawal lifecycle.
[N/A]       SM-022: no withdrawal lifecycle.
[N/A]       SM-023: no withdrawal lifecycle.
[N/A]       SM-024: no withdrawal lifecycle.
[PASS]      SM-025: initialize sets every Configuration field explicitly, including the three role
                    fields to Pubkey::default() (handler_initialize.rs:57-65), and seeds OraclePrices
                    and OracleTwaps with their cross-references (:54, :68-69).
[PASS]      SM-026: admin, oracle_mappings, oracle_prices, oracle_twaps and tokens_metadata are all
                    written from the passed accounts' keys, not from user input
                    (handler_initialize.rs:47-61).
[PASS]      SM-027: #[account(init, …)] on configuration and #[account(zero)] on the other four both
                    reject an already-initialized account.
[PARTIAL]   SM-028: no instruction closes a Configuration, OracleMappings, OraclePrices, OracleTwaps
                    or TokenMetadatas account; only MintsToScopeChains has a close path
                    (handler_close_mint_map.rs). Deliberate for a permanent feed.
[N/A]       SM-029: no investor positions to settle.
[N/A]       SM-030: no pending withdrawals.
[PARTIAL]   SM-031: the ~2.9 SOL of rent behind a feed's five accounts is permanently locked. Recorded
                    in §4.8 as an accepted design consequence, not a defect.
[PARTIAL]   SM-032: two feeds cannot share a name — the PDA derivation is the uniqueness constraint —
                    but the first caller to claim a name owns it. -> F-009
[N/A]       SM-033: no deposit lifecycle.
[N/A]       SM-034: no deposit lifecycle.
[N/A]       SM-035: no positions.
[N/A]       SM-036: no positions.
[N/A]       SM-037: no positions.
[N/A]       SM-038: no positions.
[N/A]       SM-039: no positions.
[N/A]       SM-040: no positions.
[PASS]      SM-041: every transition checks its precondition — freeze requires is_entry_used and
                    !is_frozen (handler_freeze_price.rs:32-39), unfreeze requires is_frozen (:45-48),
                    resume requires the stored `suspended` flag (handler_resume_suspended_price.rs:90,
                    113) AND an exact generic_data match (:77-80), mapping updates require !is_frozen
                    (handler_update_mapping_and_metadata.rs:124-127).
[PASS]      SM-042: no transition skips a state — a suspension can only be cleared by resume, and
                    resume cannot be reached on a non-suspended entry
                    (ChainlinkXPriceNotSuspended / PriceNotSuspended).
[PASS]      SM-043: each transition is a single field write inside one instruction; Solana's
                    transaction atomicity covers the rest.
[PASS]      SM-044: no audited path writes state before a fallible step in a way that could survive a
                    later failure — the refresh handlers compute the full DatedPrice first and write
                    last (handler_refresh_prices.rs:181-197); handler_refresh_chainlink_price.rs
                    writes through dated_price_ref and then restores old_price if the entry turns out
                    to be frozen (:193-202), with the whole transaction reverting on a later error.
[PASS]      SM-045: a resume approves exactly one suspension — require!(dated_price.generic_data ==
                    expected_price_data) (handler_resume_suspended_price.rs:77-80) — so an approval
                    collected for one suspension cannot be replayed on a later one. The deprecated
                    resume_chainlinkx_price, which lacked this binding, now errors
                    (lib.rs:140-150). Exemplary design.
[PARTIAL]   SM-046: close_mint_map frees seeds that create_mint_map can reuse; the recreated account
                    is fully overwritten by set_inner, so no stale association survives. See AV-055.
[FAIL-3]    SM-047: no financial-state transition emits an event — `emit!` and `emit_cpi` appear
                    nowhere in the repository.
                    File: programs/scope/src/handlers/handler_refresh_prices.rs:186-195 (msg! only)
                    Impact: monitoring and indexers must parse unversioned log text; privileged
                    actions leave no typed record.
                    Fix: add #[event] structs for price writes and role changes. -> F-013
[PARTIAL]   SM-048: the msg! output does carry the relevant data (entry id, old and new price, both
                    slots, current slot) — it is complete in content, wrong in form. -> F-013
[PASS]      SM-049: msg! output is emitted by program execution and cannot be forged by instruction
                    data. It can, however, be *imitated* by another program's log in the same
                    transaction (KV-122), which is a consumer-side parsing hazard.
[PARTIAL]   SM-050: off-chain reconstruction is possible from the logs but depends on their text
                    format. -> F-013
[N/A]       SM-051: no shares mint.
[N/A]       SM-052: no investor positions.
[N/A]       SM-053: no vault balance.
[N/A]       SM-054: no deposits.
[N/A]       SM-055: no withdrawals.
[N/A]       SM-056: no swaps.
[PASS]      SM-057: the two sentinel timestamps in the codebase are handled by explicit branches, not
                    arithmetic — `ema_feed_update_timestamp_us == 0` returns
                    PythLazerEmaPriceNotPresent (pyth_lazer.rs:458-461) and `twap.last_update_slot == 0`
                    seeds the EMA and returns early (twap.rs:140-143). Neither is fed to a
                    `sentinel + grace` comparison.
[PASS]      SM-058: see SM-057 — both sentinels are branch-guarded.
[N/A]       SM-059: there is no terminal-state cleanup with side effects to centralize — a removed
                    entry is four independent `reset_entry` calls applied together
                    (handler_update_mapping_and_metadata.rs:176-179), and they are duplicated once at
                    :147-150 for the unused-entry path, which is the same four calls in the same order.
[N/A]       SM-060: see SM-059 — no drain/zeroing side effects exist.
[N/A]       SM-061: no assets to drain and no accounting fields backing them.
[N/A]       SM-062: no paired time-gate controls two opposite permissions.
[N/A]       SM-063: see SM-062.
[PARTIAL]   SM-064: transitions are validated by exclusion-style require!s (`!is_frozen`, `is_frozen`,
                    `suspended`) rather than an is_allowed_transition matrix. The state space is a
                    two-bit product (frozen × suspended) per entry and all four combinations were
                    walked: a frozen entry rejects mapping updates and price writes; a suspended entry
                    rejects refreshes; a frozen+suspended entry rejects both and can still be resumed
                    by the authority, which is harmless because the frozen flag still blocks the
                    subsequent write. Complete in practice, brittle in form.
[PASS]      SM-065: suspension is absorbing — update_price_v10 rejects any refresh while suspended
                    (chainlink.rs:427-440) and token_2022_multiplier does the same
                    (token_2022_multiplier.rs:132-138); the only exit is the explicitly
                    precondition'd, data-bound resume.
[PASS]      SM-066: an authorized actor cannot perform an illegal rewrite — the admin can call
                    resume_suspended_price but still cannot clear a suspension without naming the
                    exact stored record (handler_resume_suspended_price.rs:77-80), and cannot mutate a
                    frozen entry at all (handler_update_mapping_and_metadata.rs:124-127).
[PASS]      SM-067: sub-state is preserved across primary transitions — freeze()/unfreeze() touch only
                    bit 7 and leave the oracle type in bits 0-6 (oracle_mappings.rs:58-64), and every
                    writer that clears the flag carries the "callers must reject frozen entries first"
                    note (:125-126, :187-188, :198-199), honoured at
                    handler_update_mapping_and_metadata.rs:124-127.
[N/A]       SM-068: no fixed-slot collection is iterated with a stop-at-first-empty loop —
                    refresh_price_list iterates the caller's explicit token list, and the composite
                    oracles iterate a 4- or 6-element source array with `continue`/`break` semantics
                    that validate_source_entries (utils/source_entries.rs:7-26) has already made
                    contiguous.
[N/A]       SM-069: no denormalized aggregate is cached — every composite recomputes from the current
                    stored entries on each refresh.
[PASS]      SM-070: elapsed-time subtraction cannot underflow — time_left_s uses saturating_sub and
                    coerces a negative to 0 (discount_to_maturity.rs:88-91);
                    now.saturating_sub(dated_price.unix_timestamp) in the composites
                    (most_recent_of.rs:96, multiplication_chain.rs:75); twap.rs:104 likewise. The one
                    assert! that requires ordering (twap.rs:369-372) is preceded by an explicit
                    current_ts < last_update check (twap.rs:236-239) and, on the write path, by the
                    30-second minimum interval that guarantees price_ts > last_update_ts
                    (twap.rs:110-111).
[PASS]      SM-071: units are consistent — seconds throughout for staleness and TWAP windows; the
                    slot<->second conversions are explicit, documented and rounded conservatively
                    (math.rs:257-281, with the rounding direction justified in a comment at :262-266).
[N/A]       SM-072: no vesting, cliff or lockup schedule exists (DiscountToMaturity is a linear
                    discount to a maturity date with no cliff and no claim).
```

### Checklist 06 — Economic & Logic (ECON-001 → ECON-089)

```
[N/A]       ECON-001: no deposit/withdraw exists — the program custodies nothing.
[N/A]       ECON-002: no deposit cooldown is meaningful without deposits.
[N/A]       ECON-003: no share minting.
[N/A]       ECON-004: no shares to use as collateral.
[PARTIAL]   ECON-005: for refresh_price_list, attestation and consumption cannot be atomic
                     (check_execution_ctx, handler_refresh_prices.rs:207-232). For
                     refresh_chainlink_price and refresh_pyth_lazer_price they can. -> F-002
[N/A]       ECON-006: no swap instruction.
[N/A]       ECON-007: no swap to sandwich.
[N/A]       ECON-008: no swap route.
[N/A]       ECON-009: no deposit.
[N/A]       ECON-010: no withdrawal.
[N/A]       ECON-011: no deposit.
[N/A]       ECON-012: no withdrawal.
[N/A]       ECON-013: no shares.
[N/A]       ECON-014: no vault to donate into (securitize's vault is Securitize's, and the price is
                     capped at par — see ECON-023 and KV-017).
[N/A]       ECON-015: no first deposit.
[N/A]       ECON-016: no virtual/dead shares needed.
[N/A]       ECON-017: no share price at creation.
[PASS]      ECON-018: prices are attested by external oracle programs and signed report feeds, with
                     the source for each entry chosen by the admin. Documented in §4.4.
[N/A]       ECON-019: there is no manager-attested NAV — the admin chooses the *source*, not the
                     value (except via FixedPrice, covered by AC-016).
[N/A]       ECON-020: see ECON-019.
[PARTIAL]   ECON-021: a per-refresh rate limit exists only where an entry configures ref_price —
                     check_ref_price_difference bounds the move against a reference
                     (utils/price_impl.rs:31-55, applied at handler_refresh_prices.rs:163-180,
                     handler_refresh_chainlink_price.rs:233-242,
                     handler_refresh_pyth_lazer_price.rs:156-172). Entries without ref_price have no
                     bound on a single-refresh jump, and the tolerance itself is unbounded. -> F-010
[PASS]      ECON-022: three independent verification mechanisms exist — the ref-price tolerance gate,
                     the MostRecentOf max_divergence_bps cross-check, and the CappedFloored clamp. The
                     live configuration composes all three.
[PASS]      ECON-023: a computed price of 0 is rejected globally unless the oracle type legitimately
                     reports zero — FixedPrice, MultiplicationChain, SplBalance, StakedSolBalance,
                     TotalMintSupply, Conditional (oracles/mod.rs:339-342,
                     states/oracle_type.rs:163-174).
[PARTIAL]   ECON-024: no ceiling is enforced on a published price value or exponent. Downstream
                     conversions panic rather than error for exp >= 39. -> F-020
[PASS]      ECON-025: every DatedPrice carries a slot and a timestamp, and TokenMetadata publishes
                     max_age_price_slots per entry so consumers can enforce freshness. Two composite
                     paths inherit an incomplete timestamp. -> F-005
[N/A]       ECON-026: no fees.
[N/A]       ECON-027: no fees.
[N/A]       ECON-028: no fees.
[N/A]       ECON-029: no wash-trade surface.
[N/A]       ECON-030: no fee accrual.
[N/A]       ECON-031: no performance fee / high-water mark.
[N/A]       ECON-032: no fee extraction order.
[N/A]       ECON-033: no fees.
[N/A]       ECON-034: no fund assets.
[N/A]       ECON-035: no token transfer instruction.
[N/A]       ECON-036: no pda_token_transfer equivalent.
[N/A]       ECON-037: no lamport transfer instruction.
[N/A]       ECON-038: no approve instruction.
[N/A]       ECON-039: no swap.
[N/A]       ECON-040: the only CPI target reachable by configuration is klend, pinned at compile time.
[PASS]      ECON-041: the oracle mapping is the effective whitelist and is admin-controlled. This is
                     the declared trust model (§4.4), not a finding: an admin who wants a wrong price
                     does not need a CPI, they can set FixedPrice.
[PASS]      ECON-042: see ECON-041 — the admin's worst case is fully enumerated and accepted.
[PARTIAL]   ECON-043: there is no timelock on mapping or role changes; the two-step admin handover
                     (AC-028) is the only delay, and it gates only the admin key itself, not the
                     parameters. -> OPS-056/OPS-057
[N/A]       ECON-044: no token is ever transferred, so a transfer hook cannot fire.
[N/A]       ECON-045: see ECON-044.
[PARTIAL]   ECON-046: rebasing behaviour is handled where it is priced — Token2022Multiplier tracks
                     the ScaledUiAmount multiplier explicitly and suspends when it changes
                     (token_2022_multiplier.rs:169-215). TotalMintSupply documents that
                     InterestBearing and ConfidentialMintBurn make the public supply misleading and
                     returns it anyway (total_mint_supply.rs:35-44).
[PASS]      ECON-047: spl_balance rejects a frozen token account rather than pricing an inaccessible
                     balance (spl_balance.rs:39-42).
[N/A]       ECON-048: the program buys nothing.
[PASS]      ECON-049: decimals are read from each mint and normalized explicitly
                     (math::normalize_rate, math.rs:321-341; price_of_lamports_to_price_of_tokens,
                     math.rs:79-107); jupiter_lp asserts the expected decimals rather than assuming
                     (jupiter_lp.rs:42).
[PASS]      ECON-050: spl_balance handles the native-SOL token account case from lamports minus the
                     rent-exempt reserve (spl_balance.rs:69-84); total_mint_supply rejects the native
                     mints outright (total_mint_supply.rs:6-18).
[PARTIAL]   ECON-051: an attacker cannot make Scope transactions expensive, but can make a composite
                     entry's refresh fail indefinitely. -> F-001. Compute cost is bounded by
                     MAX_ENTRIES and by the caller's own budget; per-type CU costs are catalogued at
                     oracles/mod.rs:61-122.
[PASS]      ECON-052: the refresh loop is bounded by tokens.len() <= MAX_ENTRIES
                     (handler_refresh_prices.rs:47) and by remaining_accounts.len() (:53); the caller
                     chooses the batch size and pays for it.
[N/A]       ECON-053: no payout instruction over remaining accounts.
[N/A]       ECON-054: no per-user state to bloat.
[PARTIAL]   ECON-055: the only Vec in state is MintsToScopeChains.mapping, sized once at init and
                     never grown (mints_to_scope_chains.rs:27-37). Anyone can create such accounts,
                     each self-funded. -> F-009
[PARTIAL]   ECON-056: an attacker can create a state in which a legitimate refresh cannot complete —
                     that is exactly F-001. No state that blocks an *admin* operation was found.
[PASS]      ECON-057: sources enumerated — Pyth Pull and Pyth Pull EMA, Pyth Lazer and Pyth Lazer EMA,
                     Switchboard On-Demand, Chainlink Data Streams (v3/v7/v8/v9/v10), RedStone,
                     Securitize, SPL and Marinade stake rates, Jito restaking, klend cToken rate,
                     Kamino kTokens, Orca/Raydium/Meteora CLMM spot, Jupiter/Adrena/Flashtrade LP,
                     SPL balance / staked-SOL balance / mint supply, and the derived composites.
[PARTIAL]   ECON-058: staleness is checked on the main paths — Pyth Pull's 10-minute window
                     (pyth.rs:24,34-69), Chainlink's monotonic observations timestamp
                     (chainlink.rs:174-177) and 60-second market-status window (:28,194-195), RedStone's
                     monotonic timestamp (redstone.rs:38-41), SPL stake's epoch-freshness rule
                     (spl_stake.rs:26-42), the composites' sources_max_age_s
                     (most_recent_of.rs:96-106, multiplication_chain.rs:75-77). Gaps: cap/floor entries
                     (F-005), the Securitize pause flag (F-007), and the rate-style oracles
                     (msol_stake, jito_restaking, klend cToken, the CLMM types) which stamp
                     clock.slot and rely on the consumer's own max-age policy.
[PARTIAL]   ECON-059: confidence is checked for Pyth (pyth.rs:109-120 against
                     ORACLE_CONFIDENCE_FACTOR = 2 %), Pyth Lazer (bid/ask spread and native
                     confidence, pyth_lazer.rs:220-274), Switchboard On-Demand (std-dev,
                     switchboard_on_demand.rs:29-51) and Chainlink v3 (bid/ask spread,
                     chainlink.rs:258-273). Gap: the Switchboard quorum size is not checked (F-014);
                     several oracle types have no confidence concept at all.
[FAIL-6]    ECON-060: a party who benefits can move an input that the oracle consumes — the CLMM leg
                     of a live composite's divergence gate.
                     File: programs/scope/src/oracles/most_recent_of.rs:113-119,
                           programs/scope/src/oracles/orca_whirlpool.rs:57-74
                     Impact: permissionless halt of a live RWA collateral price.
                     Fix: advisory-source degradation, or move the AMM leg to a separate health entry.
                     -> F-001 (and F-003 for the KTokenToTokenA/B variant)
[PASS]      ECON-061: MostRecentOf and CappedMostRecentOf are exactly the multi-oracle fallback
                     mechanism, and the live configuration pairs a signed feed with a second source on
                     every RWA entry.
[N/A]       ECON-062: no manager-attested NAV — see ECON-019.
[N/A]       ECON-071: no randomness, lottery or reward selection exists.
[N/A]       ECON-063: no staking rewards.
[N/A]       ECON-064: no reward payout paths.
[N/A]       ECON-065: no global reward accumulator.
[N/A]       ECON-066: no per-position reward snapshot.
[N/A]       ECON-067: no reward-per-share precision concern.
[N/A]       ECON-068: no reward source solvency.
[N/A]       ECON-069: no first-staker concern.
[N/A]       ECON-070: no reward rate to change.
[N/A]       ECON-072: no value-outflow path exists to gate.
[N/A]       ECON-073: no mark-to-market PnL contributes to borrowing power in this program.
[N/A]       ECON-074: no reserves to concentrate.
[PARTIAL]   ECON-089: freeze_price is a per-entry circuit breaker held by a role *separate* from the
                     admin (emergency_council can freeze without the admin,
                     states/configuration.rs:24) — which is the separation the item asks for. There is
                     no aggregate breaker, but there is also no aggregate outflow to bound; the
                     equivalent "drain" here is a bad price, and the breaker acts per entry.
[N/A]       ECON-075: no swap output.
[N/A]       ECON-076: no swap fee base.
[N/A]       ECON-077: no fee deduction.
[N/A]       ECON-078: no gross/net value naming — no swap exists.
[N/A]       ECON-079: no bonding curve.
[N/A]       ECON-080: no virtual/real reserve layers.
[N/A]       ECON-081: no curve config (composite-oracle configs ARE validated atomically — see
                     OPS-083).
[N/A]       ECON-082: no PDA-controlled token vault.
[N/A]       ECON-083: no capped withdrawals.
[N/A]       ECON-084: no residual sweep.
[N/A]       ECON-085: Scope's TWAP is an exponential moving average with a 64-bit sample-presence
                     bitmap (twap.rs:329-421), not a Sigma(price x elapsed) accumulator, so there is
                     no accumulator to wrap and no wrapping-difference read to get wrong.
[PASS]      ECON-086: a long gap is bounded by design — get_adjusted_smoothing_factor caps alpha at 1
                     when the gap reaches the EMA period (twap.rs:106-108), and erase_old_samples
                     zeroes the whole tracker when last_update + period <= now (twap.rs:379-381), so
                     a stale observation cannot carry outsized weight. The EMA value itself is stored
                     as a u128 scaled Decimal with a checked to_scaled_val (twap.rs:156-159).
[N/A]       ECON-087: there is no bounded measurement window or proposal whose TWAP is finalized —
                     the EMAs are continuous.
[PASS]      ECON-088: a TWAP read is rejected until the accumulator is seeded and populated —
                     validate_ema requires a minimum sample count in the period (10/24/48/60 for
                     1h/8h/24h/7d) AND at least one sample in both the first and last sub-period
                     (twap.rs:231-326), returning TwapNotEnoughSamplesInPeriod otherwise. The first
                     sample seeds the EMA and publishes nothing (twap.rs:140-143). This is a
                     well-constructed guard.
```

### Checklist 07 — OpSec & Governance (OPS-001 → OPS-085)

```
[N/A]       OPS-001: not verifiable offline — requires `solana program show HFn8Gn…`. This engagement
                     is static and read-only by instruction; marking PASS would violate Rule 10.
[N/A]       OPS-002: not verifiable offline — see OPS-001.
[N/A]       OPS-003: not verifiable offline — see OPS-001.
[N/A]       OPS-004: not verifiable offline — see OPS-001.
[N/A]       OPS-005: not verifiable offline — signer hardware custody is an operational fact.
[N/A]       OPS-006: not verifiable offline — no on-chain upgrade timelock is implemented *in this
                     program*, but a BPFLoaderUpgradeable-level or multisig-level timelock cannot be
                     observed from the source.
[N/A]       OPS-007: not verifiable offline — see OPS-006.
[N/A]       OPS-008: not verifiable offline — see OPS-006.
[N/A]       OPS-009: not verifiable offline — see OPS-001.
[N/A]       OPS-010: not verifiable offline — see OPS-001.
[PASS]      OPS-011: acknowledged and recorded. An upgrade can redefine every price this program
                     publishes, which is strictly more powerful than any finding in this report.
                     Carried as assumption 2 in §4.6.
[N/A]       OPS-012: not verifiable offline — emergency-upgrade process is operational.
[PASS]      OPS-013: no hidden admin instruction. All 14 entry points are declared in
                     lib.rs:40-177 and each maps to exactly one handler in handlers/mod.rs:1-14; no
                     handler accepts a hardcoded admin pubkey.
[PASS]      OPS-014: no god-mode account — every privileged path routes through
                     Configuration.admin (or the two narrowed delegates), which is a state field on a
                     PDA, not a constant.
[PASS]      OPS-015: the hardcoded pubkeys in the tree are all external program / feed identifiers,
                     each documented: ACRED_VAULT_PK and REDSTONE_FEED_PK (securitize.rs:24-25),
                     ACCESS_CONTROLLER_PUBKEY / VERIFIER_CONFIG_PUBKEY / VERIFIER_PROGRAM_ID
                     (chainlink.rs:628-641), COMPUTE_BUDGET_ID (handler_refresh_prices.rs:17),
                     klend_itf::ID, PYTH_LAZER_PROGRAM_ID/STORAGE_ID, the four cluster program ids
                     (program_id.rs:27-42). None is used as an authority bypass.
[PARTIAL]   OPS-016: one deliberately-retained dead handler — resume_chainlinkx_price
                     (lib.rs:142-150) is still callable and returns DeprecatedInstruction, kept so the
                     IDL keeps its shape. The eight DeprecatedPlaceholder oracle types are similarly
                     retained but panic rather than error if reached (F-004).
[N/A]       OPS-017: not verifiable offline — no IDL artefact is committed to the repository, so
                     IDL-vs-binary comparison is impossible here.
[N/A]       OPS-018: no treasury pubkey exists in state.
[PASS]      OPS-019: no instruction can change an external program id — all are compile-time
                     constants (see OPS-015), and the Chainlink verifier / Pyth Lazer accounts are
                     bound with `address =` rather than read from state.
[PASS]      OPS-020: the manager/admin can only be changed through the two-step
                     set_admin_cached -> approve_admin_cached handshake; there is no single-signature
                     path (handler_set_admin_cached.rs:14-28,
                     handler_approve_admin_cached.rs:14-29).
[N/A]       OPS-021: the program controls no mint.
[N/A]       OPS-022: the program controls no mint.
[PASS]      OPS-023: zero `unsafe` blocks in programs/scope (repo-wide grep). The only
                     `zero_copy(unsafe)` attributes are on the unused Switchboard-V2 legacy structs in
                     programs/switchbord-itf/src/accounts.rs:4,113,136,171, which no oracle references.
[PASS]      OPS-024: no raw pointer manipulation — `*const` / `*mut` appear nowhere in the workspace.
[PASS]      OPS-025: declare_id!(PROGRAM_ID) with the cluster selection centralised in
                     program_id.rs:27-42 and guarded by seven mutually-exclusive compile_error!s
                     (:4-25). There is no Anchor.toml in the repository, so no mismatch is possible.
                     Note the manifest version does not match the release tag. -> F-021
[N/A]       OPS-026: not verifiable offline — a verifiable-build comparison needs the deployed binary.
                     See OPS-071 for the reproducibility obstacle that is visible in-source.
[N/A]       OPS-027: no deploy keypair in scope; none is present in the tree.
[N/A]       OPS-028: no keypair file exists in the repository — `git ls-files` contains no `*keypair*`,
                     `id.json` or `.pem`, and the only JSON files are the two feed configs.
[N/A]       OPS-029: no manager wallet in scope (on-chain authority only).
[N/A]       OPS-030: no backend server exists in scope.
[N/A]       OPS-031: no backend server wallet.
[N/A]       OPS-032: no API keys — the repository contains none.
[N/A]       OPS-033: see OPS-032.
[N/A]       OPS-034: no RPC endpoint configuration in scope.
[N/A]       OPS-035: no frontend in scope.
[PARTIAL]   OPS-036: the current tree is clean — no key material, no `.env`, no `*keypair*.json`
                     (verified against `git ls-files`), and `.gitignore` excludes `.cargo/`, `target`
                     and `.anchor`. A full `git log --all -S` history scan was not performed within
                     this engagement, so a historically-committed secret cannot be ruled out.
[N/A]       OPS-037: not verifiable offline — multisig platform is an operational fact.
[N/A]       OPS-038: not verifiable offline — see OPS-037.
[N/A]       OPS-039: not verifiable offline — see OPS-037.
[N/A]       OPS-040: not verifiable offline — see OPS-037.
[N/A]       OPS-041: not verifiable offline — see OPS-037.
[N/A]       OPS-042: not verifiable offline — see OPS-037.
[N/A]       OPS-043: not verifiable offline — see OPS-037.
[PARTIAL]   OPS-044: no incident-response document exists at this commit — no `INCIDENT*`, `RUNBOOK*`,
                     `SECURITY.md` or equivalent is tracked. The program does provide the mechanism an
                     IR plan would use (freeze_price via the emergency_council); what is missing is
                     the written procedure.
[PASS]      OPS-045: yes — freeze_price (handler_freeze_price.rs:23-55) halts refreshes for a price
                     entry and is reachable by the emergency_council alone, without the admin
                     (states/configuration.rs:24). Per-entry rather than global, which is the right
                     granularity for an oracle.
[PARTIAL]   OPS-046: no bug-bounty reference in the repository.
[PARTIAL]   OPS-047: no SECURITY.md and no security contact in the repository.
[N/A]       OPS-048: no fund PDAs exist to monitor for value movement.
[N/A]       OPS-049: not verifiable offline — upgrade-transaction alerting is operational.
[PARTIAL]   OPS-050: there are no events to alert on; monitoring must parse msg! text. -> F-013
[N/A]       OPS-051: not present in the repository — operational.
[N/A]       OPS-052: not present in the repository — operational.
[PASS]      OPS-053: enumerated, and the answer is "none". No instruction in the program implements a
                     time delay. The only multi-step gate is the admin handshake, which is
                     two-signature rather than time-based.
[N/A]       OPS-054: not verifiable offline — see OPS-006.
[N/A]       OPS-055: no fees exist.
[PARTIAL]   OPS-056: admin change is two-step but has **no** time delay — a compromised admin can
                     stage and, if it also controls the staged key, immediately approve a rotation.
[PARTIAL]   OPS-057: mapping changes — the de facto whitelist of what each entry prices — take effect
                     in the same transaction, with no timelock and no announcement window.
[N/A]       OPS-058: no treasury address.
[N/A]       OPS-059: no timelock exists, so no bypass exists.
[PASS]      OPS-060: a staged rotation can be cancelled — the current admin can overwrite
                     admin_cached at any time before approval (handler_set_admin_cached.rs:25).
[PARTIAL]   OPS-061: pending changes are visible only as msg! text; there is no on-chain event for a
                     staged admin rotation or a mapping change. -> F-013
[N/A]       OPS-062: no dev/staging/prod key separation to assess — the program does separate the
                     *environments* cleanly via distinct program ids and compile_error!-enforced
                     mutually-exclusive features (program_id.rs:4-42), which is the in-source half of
                     this control.
[N/A]       OPS-063: operational — not observable from the repository.
[N/A]       OPS-064: no CI/CD pipeline exists in the repository (F-008), so there is nothing to
                     auto-deploy.
[N/A]       OPS-065: no servers in scope.
[N/A]       OPS-066: no database in scope.
[N/A]       OPS-067: no CI environment exists in the repository, so no CI secret can be exposed.
[N/A]       OPS-068: no secret manager needed — no secrets in scope.
[PASS]      OPS-069: the program source is open — the repository is public and BUSL-1.1 licensed
                     (LICENSE, NOTICE, Cargo.toml:6).
[N/A]       OPS-070: not verifiable offline — requires the deployed binary.
[PARTIAL]   OPS-071: the audit cannot be reproduced from this repository alone at the default feature
                     set: `default = ["yvaults"]` (Cargo.toml:25) pulls a **private** git dependency
                     (`ssh://git@github.com/Kamino-Finance/yvaults.git`, Cargo.toml:45-49). README.md
                     documents building with `--no-default-features` against the local `yvaults_stub`,
                     but that stub is a one-line crate (`yvaults_stub/src/lib.rs`, 1 line), so the
                     resulting binary is NOT the mainnet binary — the KToken oracle paths are compiled
                     out. A public reviewer therefore cannot reproduce the deployed artefact.
[PASS]      OPS-072: `git log` shows a linear release history (`Release 0.41.0 (#52)`,
                     `Release 0.40.0 (#51)`, `Release 0.39.0 (#50)`, …) with no evidence of history
                     rewriting at this commit.
[N/A]       OPS-073: not verifiable offline — the `(#52)`-style commit titles indicate a PR workflow
                     upstream, but no `.github/` is published at this commit so branch-protection
                     rules cannot be read.
[N/A]       OPS-074: no CI pipeline exists in the repository to secure. -> F-008
[PARTIAL]   OPS-075: `Cargo.lock` is committed, which pins resolved versions for a `--locked` build.
                     However five dependencies are sourced from a git **branch** rather than a pinned
                     rev: `yvaults` (branch `scope-public-compat`), `whirlpool` (branch
                     `anchor/0.28.0`), `pyth-lazer-solana-contract` and `pyth-lazer-protocol` (branch
                     `lazer_on_anchor_0.28`), and `chainlink-streams-report` (default branch) —
                     Cargo.toml:45-72. Only `raydium-amm-v3` uses `rev =`
                     (Cargo.toml:56). A lock refresh therefore silently follows whatever the branch
                     head is, including on a repository Kamino does not control
                     (smartcontractkit/data-streams-sdk). Registry deps mostly use caret ranges
                     (`anchor-lang = "0.28.0"`, `solana-program = ">1.16.18"` — the latter an
                     unbounded lower-bound range).
[N/A]       OPS-076: no stake-account authority is managed — staked_sol_balance only *reads* a stake
                     account (staked_sol_balance.rs:10-22) and the program never calls Authorize.
[PARTIAL]   OPS-077: admin and governance instructions are ordinary recent-blockhash transactions with
                     no epoch, nonce or config-version guard. A durable-nonce pre-signed
                     set_admin_cached, set_emergency_council or update_mapping_and_metadata would
                     therefore remain executable across an authority migration, and there is no
                     timelock or aggregate breaker to bound it. Cross-ref KV-119.
[PASS]      OPS-078: admin rotation is a two-step propose/accept handshake backed by a staged
                     `admin_cached` field — exactly the pattern this item asks for
                     (handler_set_admin_cached.rs:25, handler_approve_admin_cached.rs:26). The
                     accompanying timelock requirement is not met, which is recorded at OPS-056; the
                     handshake itself is correct, so PASS with that cross-reference.
[N/A]       OPS-079: no fee or treasury account exists.
[PARTIAL]   OPS-080: the config-update API is an explicit per-field enum
                     (UpdateOracleMappingAndMetadataEntry, handler_update_mapping_and_metadata.rs:15-43),
                     which is the right shape and avoids the "one big Option<T> struct" problem. Two
                     residuals: MappingRefPrice takes `Option<u16>` where `None` means *clear*
                     (:35-38, :313-321) — the Unchanged/Set/Clear conflation the item warns about,
                     mitigated here because the enum variant's presence already means "change this" —
                     and permissionless `initialize` does not decouple creator from authority (F-009).
[N/A]       OPS-081: not verifiable offline — requires fetching the live multisig account.
[FAIL-3]    OPS-082: not every admin-settable numeric has both bounds.
                     File: programs/scope/src/states/oracle_mappings.rs:154-171
                     Impact: ref_price_tolerance_bps above FULL_BPS makes the reference-price gate
                     vacuous; max_age_price_slots and group_ids_bitset are also unbounded (no unsafe
                     consumer found for those two).
                     Fix: require_gte!(FULL_BPS, bps) in the setter. -> F-010
                     Correctly bounded elsewhere: eager_eval_price_move_bps <= FULL_BPS
                     (handler_update_mapping_and_metadata.rs:353-357), max_divergence_bps in
                     1..=FULL_BPS (most_recent_of.rs:163-165), tolerance_bps in 1..=FULL_BPS
                     (conditional.rs:240-246), PythLazer exponent in 3..=12 (pyth_lazer.rs:506-508),
                     twap_source < 512 (oracle_mappings.rs:133-137), ref_price_index < 512
                     (handler_update_mapping_and_metadata.rs:314), TwapEnabledBitmask < 1<<4
                     (oracle_twaps.rs:139).
[PARTIAL]   OPS-083: composite configurations ARE cross-validated atomically against the incoming
                     params — validate_most_recent_of_params checks the source array, divergence and
                     max-age together (most_recent_of.rs:154-173); capped_most_recent_of additionally
                     rejects a cap that duplicates a source (capped_most_recent_of.rs:90-99);
                     capped_floored rejects cap==source, floor==source and both-None
                     (capped_floored.rs:100-122); conditional rejects self-reference and validates the
                     source count per condition (conditional.rs:207-249). The gaps are warn-only
                     rather than reject: an undefined TWAP source
                     (handler_update_mapping_and_metadata.rs:263-269), a TWAP source without the
                     required EMA type enabled (:265-269), and an undefined ref-price entry
                     (:315-317) all log a WARNING and proceed.
[PASS]      OPS-084: zero-valued parameters that would cause degenerate math are rejected at
                     write-time — max_divergence_bps != 0 and sources_max_age_s != 0
                     (most_recent_of.rs:163-170), tolerance_bps != 0 (conditional.rs:240-246),
                     confidence_factor >= 1 (chainlink.rs:516-519), pyth_lazer feed_id != 0 and
                     price_confidence_factor >= 1 (pyth_lazer.rs:502-517).
[N/A]       OPS-085: not verifiable offline — signing-council UX is operational, not in-source.
```

### Checklist 16 — Formal Verification & Testing (FV-001 → FV-072)

```
[PARTIAL]   FV-001: invariants are documented, but only in prose comments — e.g. the composite
                    divergence rationale (most_recent_of.rs:130-132), the cap/floor edge case
                    (capped_floored.rs:63-64), the EMA sample-tracker semantics (twap.rs:329-331), the
                    Token-2022 suspension model (token_2022_multiplier.rs:1-21), the frozen-flag
                    contract (oracle_mappings.rs:29-46, :125-126). None is executable.
[FAIL-4]    FV-002: no invariant is encoded as an assertion or property test — zero tests exist.
                    File: repository-wide
                    Impact: documented invariants can silently stop holding.
                    Fix: property tests for the invariants listed in F-008's recommendation. -> F-008
[PARTIAL]   FV-003: account sizes and alignments ARE machine-checked at compile time —
                    static_assertions::const_assert_eq! on all five account types plus the
                    TwapEnabledBitmask width (states_internal.rs:21-54), on PullFeedAccountData
                    (sbod-itf/src/accounts.rs:62) and on Reserve (klend-itf/src/state.rs:14-15). No
                    arithmetic identity has a proof or an exhaustive test.
[PARTIAL]   FV-004: state-transition properties are stated in comments (SM-041, SM-065) and hold on
                    inspection, but are specified nowhere machine-readable.
[PARTIAL]   FV-005: no model checking or fuzzing exists to establish that no reachable state violates
                    the documented invariants. This audit walked the state space by hand (SM-064).
[N/A]       FV-006: token conservation does not apply — the program moves no tokens.
[PARTIAL]   FV-007: authority properties hold by construction (Signer + has_one on a PDA-derived
                    config, verified item-by-item in checklist 02) but are not verified by any test.
[PASS]      FV-008: liveness holds — every suspension has a reachable resume
                    (handler_resume_suspended_price.rs:82-118 covers both suspendable types), every
                    freeze a reachable unfreeze (handler_freeze_price.rs:43-52), and no entry can
                    enter a state from which no instruction can extract it. No deadlock found.
[N/A]       FV-009: no formal specification document exists, so there is no spec drift to track.
[N/A]       FV-010: no proof is claimed anywhere, so none needs to be machine-checked.
[N/A]       FV-011: no formal verification properties are documented.
[N/A]       FV-012: no verification results exist to include.
[FAIL-4]    FV-013: no static analysis tool runs in CI, because no CI exists.
                    File: repository-wide — `git ls-files` returns exactly one dotfile, `.gitignore`
                    Impact: clippy-detectable classes (F-004's unwrap/panic sites) go unflagged.
                    Fix: add a CI workflow running clippy -D warnings + cargo audit. -> F-008
[N/A]       FV-014: there are no static-analysis findings to triage, because no tool runs.
[PARTIAL]   FV-015: the only lint directive in the tree is `#![allow(clippy::result_large_err)]`
                    (lib.rs:1, scope-types/src/lib.rs:1, klend-itf/src/lib.rs:3), each justified by a
                    comment. No project-specific deny rules exist — notably none for `unwrap` in
                    production code, which F-004 is entirely about.
[N/A]       FV-016: no CI exists to enforce a zero-warning policy.
[N/A]       FV-017: no lint configuration exists to enable security rulesets in.
[N/A]       FV-018: no dead-code detection runs (one dead module was found by hand:
                    programs/switchbord-itf/src/accounts.rs, see §4.8).
[FAIL-4]    FV-019: no dependency vulnerability scanning.
                    File: repository-wide — no `cargo audit` invocation, no `deny.toml`
                    Impact: five git-branch dependencies (OPS-075) and the full registry tree are
                    unscanned.
                    Fix: `cargo audit` in CI. -> F-008
[N/A]       FV-020: no SAST tooling exists to cover the one production language.
[PASS]      FV-021: the sole suppression directive carries a justification on the same line
                    (`//Needed because we can't change Anchor result type`, lib.rs:1; and the
                    three-line rationale at klend-itf/src/lib.rs:1-3).
[N/A]       FV-022: there are no static-analysis config files to version-control.
[FAIL-4]    FV-023: no fuzz testing of parsing/deserialization, despite an unusual amount of
                    hand-written decoding.
                    File: programs/scope/src/compat/token_2022_scaled_ui_amount.rs:82-158 (manual TLV
                    walker), programs/scope/src/oracles/chainlink.rs:568-582 (BigInt parse), and
                    eleven `*Data::from_generic_data` implementations
                    Impact: malformed-input handling in the most attacker-adjacent code is unverified.
                    Fix: cargo-fuzz targets for each pure decoder. -> F-008
[FAIL-4]    FV-024: no fuzz target covers any instruction handler.
                    File: programs/scope/src/handlers/
                    Impact: the permissionless refresh path (F-001's entry point) has no adversarial
                    input coverage.
                    Fix: Trident for instruction sequences. -> F-008
[N/A]       FV-025: no fuzz corpus exists, because no fuzzing exists.
[N/A]       FV-026: no fuzz campaign has been run.
[N/A]       FV-027: no fuzzing crashes exist to triage.
[N/A]       FV-028: no second implementation exists to differential-fuzz against.
[N/A]       FV-029: no fuzz coverage of arithmetic edge cases, because no fuzzing exists (the edge
                    cases themselves are assessed by hand under AR-056…058).
[N/A]       FV-030: no API endpoints in scope.
[N/A]       FV-031: no serialization round-trip fuzzing, because no fuzzing exists. The `to_generic_data`
                    / `from_generic_data` pairs are exactly the round-trip this item describes and are
                    a natural first target.
[N/A]       FV-032: no fuzzing infrastructure exists to document.
[FAIL-4]    FV-033: test coverage is neither measured nor reported — there are no tests. -> F-008
[FAIL-4]    FV-034: the critical paths (refresh, freeze, suspend, resume, mapping update) have 0 %
                    branch coverage in this repository. -> F-008
[FAIL-4]    FV-035: no unit test exists for any of the 14 instructions or 31 oracle modules. -> F-008
[FAIL-4]    FV-036: no integration test covers a multi-step workflow (initialize -> configure ->
                    refresh -> freeze -> resume). -> F-008
[FAIL-4]    FV-037: no edge-case tests — the zero-amount, max-value and boundary cases assessed by
                    hand in checklist 03 are untested. -> F-008
[FAIL-4]    FV-038: no negative tests — wrong signer, frozen entry, mismatched resume data, and
                    double-initialize are all unexercised. -> F-008
[N/A]       FV-039: no previously-found bug list exists in the repository to regression-test against.
[FAIL-4]    FV-040: no tests run in CI on PRs, because neither exists. -> F-008
[N/A]       FV-041: no test environment exists to compare against production config.
[N/A]       FV-042: no tests exist, so none can be flaky or skipped.
[N/A]       FV-043: mutation testing presupposes a test suite.
[N/A]       FV-044: no endpoints; per-type CU costs ARE catalogued (oracles/mod.rs:61-122), which is
                    the on-chain analogue of a performance budget, but it is a constant table rather
                    than a measured regression test.
[PASS]      FV-045: no hardcoded secrets, private keys or credentials anywhere in the tree — verified
                    against `git ls-files` (no `.env`, no `*keypair*`, no `.pem`) and by inspecting
                    every hardcoded pubkey (OPS-015), all of which are public program/feed ids.
[N/A]       FV-046: no test data exists.
[PARTIAL]   FV-047: CPI error handling is explicit but inconsistent — the Chainlink and Pyth Lazer
                    invokes map to typed errors (handler_refresh_chainlink_price.rs:87,
                    handler_refresh_pyth_lazer_price.rs:74), while the two klend invokes `.expect()`
                    with a long justification (klend_ctoken_exchange_rate.rs:96,105). The reasoning
                    given is sound, but it is still an intentional panic on a permissionless path.
[PASS]      FV-048: errors leak nothing — the 88 ScopeError variants carry terse operational messages
                    (errors.rs:9-251) and the msg! logs contain entry ids, prices and pubkeys, all of
                    which are public on-chain data.
[PARTIAL]   FV-049: panics cannot be caught at a boundary on-chain, and the batch-refresh design
                    (Err -> continue) is defeated by any panic in a parser. -> F-004
[N/A]       FV-050: no HTTP status codes — not an API.
[N/A]       FV-051: OOM / disk / connection-pool exhaustion do not apply to a BPF program; the
                    analogous bound (compute budget) is addressed under ECON-052.
[N/A]       FV-052: no external call can block — CPIs are synchronous and bounded by the compute
                    budget.
[PASS]      FV-053: partial failure is handled deliberately — a multi-token refresh skips a failing
                    entry and continues (handler_refresh_prices.rs:105-113,
                    handler_refresh_pyth_lazer_price.rs:114-124) while a single-token refresh fails
                    loudly (fail_tx_on_error, :58 / :87). The design is explicit and commented.
[PARTIAL]   FV-054: three deliberate swallow points, each of which logs: the TWAP update error
                    (handler_refresh_prices.rs:157-159, handler_refresh_chainlink_price.rs:211-213,
                    handler_refresh_pyth_lazer_price.rs:145-147) and the two per-entry `Err(_) =>
                    continue` paths. Intentional and documented, but a TWAP that silently stops
                    updating is exactly the kind of failure an operator would want alerted rather than
                    logged — and there are no events to alert on (F-013).
[PASS]      FV-055: 88 specific ScopeError variants (errors.rs:9-251). Exactly one generic
                    ProgramError is returned, for an over-long token list
                    (handler_refresh_prices.rs:48) — a nitpick, not a leak.
[PASS]      FV-056: every OracleType match is exhaustive with no `_` arm —
                    get_update_cu_budget (oracles/mod.rs:62-121), get_non_zero_price (:151-334),
                    validate_oracle_cfg (:363-458), update_generic_data_must_reset_price (:462-516),
                    debug_format_generic_data (:524-634), is_chainlink_provider
                    (oracle_type.rs:200-255). Adding a variant forces every site to be updated, which
                    is the right property; the cost is the panic arms noted in F-004.
[PASS]      FV-057: fallbacks exist — MostRecentOf/CappedMostRecentOf cross-check multiple sources and
                    CappedFloored clamps to a trusted bound; freeze_price is the circuit breaker.
[PARTIAL]   FV-058: divide-by-zero and other exceptional conditions in the value math are mostly
                    blocked (mul_div rejects a zero divisor, math.rs:301-303; three oracles guard a
                    zero supply), but two paths convert them into panics instead —
                    jupiter_lp.rs:44 and math.rs:114. -> F-004
[FAIL-4]    FV-059: no in-process SVM suite exists in this repository.
                    File: repository-wide
                    Impact: the compiled .so is never exercised against real account fixtures here.
                    Fix: LiteSVM/Mollusk suite loading the built .so. -> F-008
                    (Note: oracles/mod.rs:118-119 cites a `cargo test-sbf` measurement from a test
                    named `test_token_2022_multiplier_refresh_from_real_mainnet_mint`, which suggests
                    such a suite exists privately.)
[N/A]       FV-060: no time-locked or deadline instruction exists to test on both sides (OPS-053).
[FAIL-4]    FV-061: time-dependent logic is pervasive — staleness windows, EMA periods and sub-period
                    sample requirements, ChainlinkX and Token2022Multiplier blackout windows — and
                    none is tested via sysvar/clock control here. -> F-008
[FAIL-4]    FV-062: account closure (`close = admin` on MintsToScopeChains) is never verified for
                    lamports == 0, data.len() == 0 and owner == system_program. -> F-008
[FAIL-4]    FV-063: re-initialization is never tested, despite `init` and `zero` being the sole
                    defence (AV-053). -> F-008
[FAIL-4]    FV-064: authorization negatives are never tested — a wrong signer on any of the nine
                    admin instructions, or an emergency_council attempting an unfreeze. -> F-008
[FAIL-4]    FV-065: arithmetic edge cases are never exercised through the SVM. -> F-008
[N/A]       FV-066: no token transfer occurs, so there are no balances to assert after one.
[PARTIAL]   FV-067: CU consumption IS catalogued per oracle type in
                    get_update_cu_budget (oracles/mod.rs:61-122), with at least one figure explicitly
                    sourced from a real measurement (:118-119). It is a hand-maintained constant
                    table, not a regression baseline produced by a test run, and nothing detects
                    drift between the table and reality.
[N/A]       FV-068: no multi-transaction test suite exists to advance blockhashes in.
[FAIL-4]    FV-069: no failure-path test exists, so none can be checked for `assert!(result.is_err())`
                    versus an unwrap. -> F-008
[N/A]       FV-070: no tests exist, so no PDA derivation is duplicated in test code.
[FAIL-4]    FV-071: no Solana-appropriate verification tooling is present — no Trident, Crucible,
                    Riverguard, Certora, Kani, Mollusk or LiteSVM configuration anywhere in the tree.
                    File: repository-wide
                    Impact: a mainnet oracle whose output prices other protocols' collateral ships
                    with no executable verification of any kind in its public repository.
                    Fix: adopt at least Mollusk/LiteSVM for the parsers plus Trident for the
                    permissionless refresh path. -> F-008
[N/A]       FV-072: no reader, indexer or fee-sponsor component is in scope. The program's own
                    transaction-v1 exposure is assessed at AV-089 / F-019; testing it under a
                    v1-gated runtime is part of the F-008 remediation.
```

---

### Audit Metrics

| Metric | Value |
|--------|-------|
| Total items evaluated | 591 |
| PASS | 159 (26.9 %) |
| FAIL | 26 (4.4 %) |
| PARTIAL | 81 (13.7 %) |
| N/A | 325 (55.0 %) |
| **Pass rate** (excl. N/A) | **59.8 %** |
| **Highest severity found** | **6** |
| **Repository Risk Score** | **6** |

> **Highest severity found: 6** (F-001). Per OUTPUT-RULES Rule 1, `highest finding >= 5` ⇒
> `REPO SCORE = max(finding) = 6` — MEDIUM, fix soon. No finding reached 7, so no deploy gate is
> asserted by this report.
>
> The high N/A share (55 %) is expected and honest for this target: checklists 01–06 are written for a
> custodial DeFi program (shares, fees, vaults, withdrawals, NAV attestation, staking rewards, bonding
> curves), and Scope custodies nothing. Every N/A cites the specific absent feature rather than a
> blanket "not applicable". The pass rate excluding N/A (59.8 %) is depressed mainly by checklist 16
> (20.5 %), which is one finding — F-008 — spread across twenty items.

### Known Vector Metrics

| Metric | Value |
|--------|-------|
| Total known vectors (corpus) | 136 |
| In scope (PROGRAM gate) | 58 |
| PASS | 21 |
| FAIL | 1 |
| PARTIAL | 18 |
| N/A (feature absent / not verifiable offline) | 18 |
| Out of scope (rendered from the gate) | 78 |
| Completion (in-scope) | 100 % |

### Per-Checklist Summary

| # | Checklist | Items | Pass | Fail | Partial | N/A | Pass Rate |
|---|-----------|-------|------|------|---------|-----|-----------|
| 01 | Account Validation | 90 | 46 | 0 | 16 | 28 | 74.2 % |
| 02 | Access Control | 50 | 22 | 3 | 4 | 21 | 75.9 % |
| 03 | Arithmetic Safety | 63 | 17 | 0 | 11 | 35 | 60.7 % |
| 04 | CPI & PDA | 70 | 15 | 0 | 5 | 50 | 75.0 % |
| 05 | State Machine | 72 | 21 | 1 | 9 | 41 | 67.7 % |
| 06 | Economic & Logic | 89 | 14 | 1 | 11 | 63 | 53.8 % |
| 07 | OpSec & Governance | 85 | 16 | 1 | 14 | 54 | 51.6 % |
| 16 | Formal Verification & Testing | 72 | 8 | 20 | 11 | 33 | 20.5 % |
| | **Total** | **591** | **159** | **26** | **81** | **325** | **59.8 %** |

---

## 6. Known Vector Results

> 58 in-scope vectors, each with a verdict. `[N/A — feature absent: …]` is an evidence-backed verdict
> from the load gate (SKILL.md Step 3), not a silent skip, and reopens the moment a manual read
> surfaces the feature — which happened twice during this audit (KV-135 and KV-002 were both opened
> after their markers were found in the tree). Out-of-scope vectors render from the scope gate; they
> are listed in §2, not repeated here.

```
[PASS]      KV-001 Private Key Leak: no key material of any kind in the tree — `git ls-files` has no
                   `.env`, `*keypair*.json`, `id.json` or `.pem`; the only JSON files are the two
                   public feed configs; .gitignore excludes `.cargo/`, `target`, `.anchor`.
                   (History not scanned — see OPS-036.)
[PASS]      KV-002 Flash Loan Price Manipulation: markers present (`pyth`, `switchboard`), so the
                   vector was opened. Scope has no deposit/withdraw and no oracle-priced share
                   issuance, so the canonical flash-loan shape does not exist. The nearest analogue —
                   borrow, move a pool, refresh, profit — is blocked within a transaction by
                   check_execution_ctx (handler_refresh_prices.rs:207-232) and, for the composite
                   entries, defanged by the cap==floor clamp (capped_floored.rs:73-78). The
                   cross-transaction residual is tracked as F-001.
[PASS]      KV-003 Reentrancy (CPI): three `invoke` sites, all to pinned programs. Solana's runtime
                   forbids re-entering a program already on the call stack; additionally the klend
                   CPI passes skip_price_updates: true (klend_ctoken_exchange_rate.rs:83-86) to break
                   the scope->klend->scope price dependency, and refresh_price_list refuses to run
                   above TRANSACTION_LEVEL_STACK_HEIGHT (:219). Two handlers lack that last guard:
                   F-002.
[PASS]      KV-004 Missing Access Control: every state-mutating admin path carries Signer + has_one on
                   a PDA-derived Configuration; the two delegate roles are narrowed by capability
                   (states/configuration.rs:17-33) and refuse an unset (default) pubkey (:31-33).
[FAIL-6]    KV-005 Oracle Manipulation: Step 2 of the procedure is ❌ for the CLMM types — the price
                   is derived from pool reserves (orca_whirlpool.rs:57-74, raydium_ammv3.rs:15-32,
                   meteora_dlmm.rs:60-94). Step 3 ✅ (staleness and confidence are checked on the
                   signed feeds). Step 4 ⚠️ (owner not checked — F-006 — but the account is pinned by
                   the mapping). Step 5 ✅ (securitize caps the share value at par, so a donation
                   cannot inflate it).
                   File: programs/scope/src/oracles/most_recent_of.rs:113-119
                   Impact: a permissionless halt of a live RWA collateral price.
                   Fix: advisory-source degradation in MostRecentOf. -> F-001, F-003
[N/A]       KV-006 First Depositor / Share Inflation: [feature absent: no `shares`, `mint_to`,
                   `deposit` or `total_supply` write anywhere — the program issues nothing].
[N/A]       KV-007 MEV Sandwich Attack: [feature absent: no `swap`, `slippage`, `min_amount_out` or
                   route — the program executes no trade]. The price-selection MEV shape is tracked
                   separately under KV-028 / F-002.
[PARTIAL]   KV-008 Rug Pull / Admin Backdoor: no hidden instruction, no god-mode key, no
                   pubkey-conditional branch (OPS-013…015). The admin's legitimate ability to set any
                   entry to FixedPrice is rug-equivalent for a consumer and is disclosed as the
                   program's central trust assumption (§4.4, AC-016) rather than concealed. PARTIAL
                   because the capability exists with no timelock and no on-chain event (F-013,
                   OPS-056/057).
[PASS]      KV-009 Unchecked CPI Target: all three targets pinned — `address = VERIFIER_PROGRAM_ID`
                   (handler_refresh_chainlink_price.rs:52), `address = PYTH_LAZER_PROGRAM_ID`
                   (handler_refresh_pyth_lazer_price.rs:33), explicit key comparison against
                   klend_itf::ID before the invoke (klend_ctoken_exchange_rate.rs:47-54).
[PARTIAL]   KV-010 PDA Confusion / Type Cosplay: Scope's own six account types carry distinct Anchor
                   discriminators and are loaded through typed AccountLoader/Account. Foreign types
                   are matched on discriminator alone, with jito's being 1 byte of entropy. Blocked in
                   practice by the mapping pin. -> F-006
[PARTIAL]   KV-011 Integer Overflow / Underflow: `overflow-checks = true` (Cargo.toml:8) removes the
                   silent-wrap class entirely; widening to u128/U192/U256 is used consistently in the
                   value math. The residual is that ~8 unchecked operations on externally-sourced
                   values become panics. -> F-004
[PASS]      KV-012 Arithmetic Rounding Exploit: no value transfer exists, so rounding cannot favour a
                   party. Precision loss is deliberate and documented where it occurs
                   (switchboard_on_demand.rs:116 "Loss of precision here is expected", capping the
                   exponent at 15); truncation to zero is caught by the global zero-price gate
                   (oracles/mod.rs:339-342).
[PASS]      KV-013 Missing Signer Check: every privileged instruction uses Anchor's Signer type; the
                   three permissionless refreshes move no value and are the intended crank interface
                   (AC-002, AC-010).
[PARTIAL]   KV-014 Account Reinitialization: init_if_needed appears nowhere; `init` and `zero` both
                   reject an initialized account. Residual: the initialize instruction itself is
                   permissionless, so a feed name can be claimed. -> F-009
[PARTIAL]   KV-015 Unchecked Account Owner: six oracles do check the owner
                   (adrena_lp.rs:18, flashtrade_lp.rs:18, staked_sol_balance.rs:12,
                   token_2022_multiplier.rs:104, redstone.rs:74, klend_ctoken_exchange_rate.rs:150);
                   the shared helpers do not, and ~18 call sites rely on them. -> F-006
[PASS]      KV-016 Token Account Mismatch: spl_balance validates the mint against token_account.mint
                   and requires both accounts to share one token program (spl_balance.rs:50-65);
                   securitize pins the vault and share mint from the vault state
                   (securitize.rs:93-102).
[PASS]      KV-017 Vault Donation Attack: the two oracles that read a live balance are explicit about
                   it. securitize caps the resulting share value at par
                   (get_share_value, securitize.rs:127-130), so donating ACRED cannot inflate it.
                   SplBalance and TotalMintSupply are *intended* to report a raw balance/supply and
                   document that (spl_balance.rs:25-28, total_mint_supply.rs:30-44); any protocol
                   using them as a price rather than a quantity is making that choice consciously.
[N/A]       KV-018 Fee-on-Transfer Token Exploit: [feature absent: no token transfer occurs, so there
                   is no credited amount to under- or over-count].
[PASS]      KV-019 Freeze Authority Griefing: spl_balance rejects a frozen token account outright
                   rather than pricing an inaccessible balance (spl_balance.rs:39-42); no withdrawal
                   path exists that a freeze could deadlock.
[N/A]       KV-020 Program Upgrade Hijack: [not verifiable offline: requires `solana program show`.
                   Recorded as assumption 2 in §4.6 — the upgrade authority is modelled as trusted].
[N/A]       KV-021 Governance Attack (Vote Buying): [feature absent: no `realm`, `proposal`,
                   `vote_record`, `voter_weight` or spl-governance dependency].
[N/A]       KV-022 Bridge Exploit (Fake Proof): [feature absent: no `guardian`, `vaa`, `emitter`,
                   `verify_signatures` or attestation-set logic. The Chainlink and Pyth Lazer report
                   verification is delegated to their own on-chain programs, not reimplemented here].
[PARTIAL]   KV-023 Token-2022 Transfer Hook Attack: no transfer occurs, so a hook cannot fire. The
                   Token-2022 surface that IS used — the ScaledUiAmount extension — is parsed with a
                   hand-written TLV walker that validates the whole envelope, rejects duplicates and
                   bounds every read (compat/token_2022_scaled_ui_amount.rs:82-158), and requires
                   owner == spl_token_2022::ID (token_2022_multiplier.rs:104). PARTIAL for the
                   unread extensions noted at EXT-013 / AV-063.
[PASS]      KV-024 Stale/Missing Account Close: the one closable account uses Anchor's `close = admin`
                   with a constrained destination (handler_close_mint_map.rs:11), which zeroes the
                   data and reassigns to the system program.
[PARTIAL]   KV-025 Compute Budget Exhaustion DoS: loop bounds are correct (tokens.len() <=
                   MAX_ENTRIES, handler_refresh_prices.rs:47; <= remaining_accounts.len(), :53) and
                   per-type CU costs are catalogued (oracles/mod.rs:61-122). The residual is the panic
                   class — a panic consumes the transaction rather than skipping one entry. -> F-004
[PASS]      KV-026 PDA Seed Collision: two seed families, both complete and both placing the only
                   variable-length component last (utils/pdas.rs:3-27). No collision path found.
[PASS]      KV-027 Missing Discriminator Check: both shared helpers compare T::discriminator() before
                   deserializing (utils/mod.rs:33-41, :64-72) and return
                   ScopeError::InvalidAccountDiscriminator on mismatch. The owner half is F-006.
[PARTIAL]   KV-028 Front-Running Transaction: the crank is permissionless by design, so ordering is
                   inherently contestable — which entries refresh and when is attacker-selectable
                   (F-001), and for the two handlers without check_execution_ctx the refresh can be
                   bundled atomically with the action that consumes it (F-002).
[PASS]      KV-029 Withdraw-Before-Update Race: no withdrawal exists. In the one CPI-bearing oracle
                   the state write happens strictly after the CPI returns, using return data rather
                   than a re-read account (klend_ctoken_exchange_rate.rs:108-143).
[N/A]       KV-030 Infinite Mint / Uncapped Supply: [feature absent: the program controls no mint and
                   calls no `mint_to`].
[PASS]      KV-101 Sysvar Spoofing & Instructions-Sysvar Introspection: Clock always via
                   Clock::get() syscall; the Instructions sysvar is pinned by
                   `address = SYSVAR_INSTRUCTIONS_ID` on all three handlers that take it
                   (handler_refresh_prices.rs:27, handler_reset_twap.rs:19,
                   handler_refresh_pyth_lazer_price.rs:47); the introspection itself uses the
                   *_checked helpers (load_current_index_checked, load_instruction_at_checked).
[PARTIAL]   KV-102 Precompile Signature Verification Bypass: Scope implements no precompile check of
                   its own — ed25519 verification is delegated entirely to
                   pyth_lazer_solana_contract::VerifyMessage via a CPI whose program is pinned
                   (handler_refresh_pyth_lazer_price.rs:33, 201-216). Scope does forward a
                   caller-supplied `ed25519_instruction_index` without validating it (:55, :199),
                   relying on the callee. Message-to-action binding IS enforced on Scope's side: the
                   per-feed id is checked against the mapping (pyth_lazer.rs:160-162) and replay is
                   blocked by a strictly-increasing feed timestamp (:300-303). PARTIAL because a
                   material part of the check lives in an unvendored dependency (§2 limitation 2).
[PASS]      KV-103 Address Lookup Table Manipulation: no privileged account is identified by
                   transaction position or by ALT-resolved order — every one is bound by has_one,
                   seeds or `address =` (AV-075).
[PASS]      KV-104 Non-Canonical Bump / PDA Derivation Confusion: all bumps are Anchor-canonical;
                   create_program_address is never called with a user-supplied bump. The one stored
                   user bump is unused. -> F-017
[PARTIAL]   KV-105 Token-2022 Extension Abuse: the program custodies nothing, so permanent-delegate
                   clawback, default-frozen and mint-close have no vault to attack. The residual is
                   informational rather than custodial: TotalMintSupply prices a mint's public supply
                   and documents that ConfidentialMintBurn / InterestBearing can make that figure
                   misleading (total_mint_supply.rs:35-44) without rejecting such mints. -> AV-063
[PASS]      KV-106 Account Revival / Zombie After Close: Anchor's `close` zeroes data, drains lamports
                   and reassigns to the system program; a revived account fails the
                   Account<MintsToScopeChains> discriminator check, and a legitimately recreated map
                   is fully overwritten by set_inner (handler_create_mint_map.rs:43-60).
[N/A]       KV-107 Fake / Non-Canonical ATA: [feature absent: no `associated_token`,
                   `get_associated_token_address` or ATA derivation anywhere].
[PASS]      KV-108 Token Decimals & Cross-Mint Amount Confusion: decimals are always read from the
                   mint (ECON-049) and cross-decimal conversion goes through checked helpers —
                   math::normalize_rate (math.rs:321-341) and
                   price_of_lamports_to_price_of_tokens (math.rs:79-107). jupiter_lp asserts the
                   expected decimals rather than assuming (jupiter_lp.rs:42).
[N/A]       KV-109 Pinocchio / p-token Missing Manual Validation: [feature absent: Anchor 0.28
                   program; no `pinocchio`, `p-token`, `no_std` or `entrypoint!` in the tree].
[PASS]      KV-111 BPF Stack Frame Overflow DoS: the large structures — OracleMappings (29 696 B),
                   OracleTwaps (344 128 B), TokenMetadatas (86 016 B), OraclePrices (28 704 B) — live
                   in account data and are accessed through zero-copy AccountLoader refs, never
                   materialised on the 4 KB BPF stack. No recursion exists. The only heap allocation
                   on a hot path is `list_set_bit_positions`, bounded to 64 entries
                   (token_metadatas.rs:59-67).
[N/A]       KV-118 Stake Account Authority Hijack: [feature absent: the stake account in
                   staked_sol_balance is read-only (staked_sol_balance.rs:10-22); the program never
                   constructs an Authorize instruction and holds no staker/withdrawer authority].
[PARTIAL]   KV-119 Durable-Nonce Pre-Signed Governance Abuse: admin instructions carry no epoch,
                   nonce-age or config-version guard, so a pre-signed set_admin_cached,
                   set_emergency_council or update_mapping_and_metadata would survive an authority
                   migration; there is no timelock and no aggregate breaker to bound it. -> OPS-077
[N/A]       KV-120 On-Chain Randomness Predictability: [feature absent: no `random`, `vrf`,
                   `slot_hashes` or blockhash-derived entropy — the program makes no random choice].
[N/A]       KV-121 cNFT / Account-Compression Merkle Proof Abuse: [feature absent: no
                   `spl-account-compression`, `bubblegum`, `merkle` or proof verification].
[PARTIAL]   KV-122 Inner-Instruction / Event-Log Spoofing: Scope emits no structured events, so every
                   off-chain consumer must parse msg! text (F-013). Program logs from an unrelated
                   inner instruction in the same transaction can imitate that text, so a naive parser
                   can be fed a fabricated "price updated" line. Scope itself is not affected — it
                   reads nothing from logs — but it pushes the hazard onto its consumers.
[PASS]      KV-123 Lamport-Donation Account Bricking: no instruction asserts an exact lamport balance
                   (AV-085), and no builtin/sysvar/precompile account is marked mut (AV-086), so
                   neither the donation-bricking nor the writability-demotion half applies.
[N/A]       KV-125 Bonding-Curve Launchpad Graduation Abuse: [feature absent: no `bonding_curve`,
                   `virtual_reserves`, `graduate` or `migrate`].
[N/A]       KV-126 Session Token as Custody: [feature absent: no `session`, `session_token`,
                   `spending_limit` or delegated-signing mechanism. The two delegate roles
                   (emergency_council, resume_authority) are capability-narrowed on-chain authorities,
                   not bearer sessions].
[PARTIAL]   KV-127 ATA / Account Pre-Creation DoS: no ATA is created, but the analogous shape exists —
                   `initialize` can be front-run on a chosen feed_name, and `init` then permanently
                   refuses the honest creation. -> F-009
[PARTIAL]   KV-128 On-Chain Floating-Point Financial Math: f64 is present in three places, one of
                   which is forced by an external ABI. Assessed in full at AR-063; the conversion
                   boundary (price_impl.rs:111-124) rejects NaN/inf/negative and its own comment
                   admits a rounding divergence from the Decimal path.
[PARTIAL]   KV-129 Keeper Request->Execute Front-Running & Reordering: Scope's crank is a single-step
                   push rather than a request/execute pair, so the classic two-step race does not
                   exist. What does exist is selection power: the caller chooses which entries
                   refresh, in what order, and when (F-001), and for two handlers can bundle the
                   refresh atomically with its consumption (F-002).
[PARTIAL]   KV-130 CLMM/DLMM Tick-Boundary & Liquidity Math: tick and bin math is delegated to the
                   upstream crates (`whirlpool`, `raydium-amm-v3`, and the vendored
                   lb-clmm-itf::u64x64_math pow implementation, which is fully checked and returns
                   None on overflow, lb-clmm-itf/src/u64x64_math.rs:18-179). Scope's own conversion,
                   sqrt_price_to_price (math.rs:24-43), is sound for real pool ranges but guards its
                   192-bit narrowing with debug_assert_eq! -> F-011.
[PARTIAL]   KV-131 Write-Lock Account Contention DoS: every refresh for a feed takes a write lock on
                   the same OraclePrices and OracleTwaps accounts
                   (handler_refresh_prices.rs:21-25), so all refreshes serialise and any user can
                   contend by spamming refresh_price_list. Bounded: contention delays the crank, it
                   does not corrupt state, and the crank can outbid on priority fees. This is inherent
                   to a single-account price feed and is recorded in §4.8 rather than as a finding.
[N/A]       KV-132 Canonical-Asset / Token-List Spoofing: [feature absent: no token list, `assetId`,
                   `getTokenBySymbol`, `coingeckoId` or registry lookup. The oracle mapping is an
                   on-chain, admin-controlled allowlist, not an off-chain registry].
[N/A]       KV-133 Token Risk-Score / Trust-Tier Metric Farming: [feature absent: no `riskScore`,
                   `trustTier`, `isVerified`, rugcheck/webacy/goplus consumption].
[N/A]       KV-134 Token ACL (SRFC-37) Gate-Program Bypass: [feature absent: no `token_acl`,
                   `TACLkU6`, `MINT_CFG`, `gating_program` or `thaw_permissionless`].
[PARTIAL]   KV-135 Transaction v1 Fee-Sponsor Cap Bypass & Disabled ComputeBudget Gates: Step 1 finds
                   no fee-sponsor or co-signer in scope (Steps 2-4 therefore N/A). Step 5 applies:
                   check_execution_ctx DOES read ComputeBudget instructions from the Instructions
                   sysvar (handler_refresh_prices.rs:223-229). It is not silently disabled by v1,
                   because it enforces a program-id allowlist rather than a budget floor — a v1
                   transaction with its budget in the message config and no ComputeBudget
                   instructions passes the loop trivially, and no-op budget instructions set nothing.
                   The loop is bounded by current_index, so the 64-instruction cap is respected
                   (AV-090). Step 6 fails: nothing tests it under a v1-gated runtime. -> F-019
[N/A]       KV-136 Transaction v1 Reader Wedge & Zero-Budget Indexing: [feature absent: no
                   `getTransaction`, `getBlock`, `blockSubscribe`, Geyser or Yellowstone consumer in
                   scope — the off-chain crank that would carry this exposure lives in a separate,
                   un-supplied repository].
```

---

## 7. Instruction Matrix

| # | Instruction | File | Signers | CPI calls | PDA seeds | Checked math | State changes | Findings |
|---|---|---|---|---|---|---|---|---|
| 1 | `initialize` | `handler_initialize.rs:39` | `admin` (any) | System (Anchor `init`) | `[b"conf", feed_name]` | n/a | creates Configuration; zero-inits OracleMappings, OraclePrices, OracleTwaps, TokenMetadatas | F-009 |
| 2 | `refresh_price_list` | `handler_refresh_prices.rs:32` | **none** | none directly; klend ×2 via `KlendCTokenExchangeRate` | none (accounts tied by `has_one`) | mostly ✅ — see F-004 | `OraclePrices.prices[i]`, `OracleTwaps.twaps[i]` | F-001, F-004 |
| 3 | `refresh_chainlink_price` | `handler_refresh_chainlink_price.rs:56` | `user` (any) | Chainlink verifier `verify` | none | ✅ | `OraclePrices.prices[i]`, `OracleTwaps.twaps[i]` | F-002, F-004 |
| 4 | `refresh_pyth_lazer_price` | `handler_refresh_pyth_lazer_price.rs:51` | `user` (any) | Pyth Lazer `VerifyMessage` | none | ✅ | `OraclePrices.prices[i]`, `OracleTwaps.twaps[i]` | F-002 |
| 5 | `update_mapping_and_metadata` | `handler_update_mapping_and_metadata.rs:94` | `admin` | none | `[b"conf", feed_name]` | ✅ | all fields of `OracleMappings[i]`, `TokenMetadatas[i]`; resets `OraclePrices[i]` / `OracleTwaps[i]` | F-010, F-015, F-016, F-020 |
| 6 | `reset_twap` | `handler_reset_twap.rs:23` | `admin` | none | `[b"conf", feed_name]` | ✅ (`get_mut` bound-checked, `twap.rs:49-56`) | `OracleTwaps.twaps[i]` = default | — |
| 7 | `set_admin_cached` | `handler_set_admin_cached.rs:14` | `admin` | none | `[b"conf", feed_name]` | n/a | `Configuration.admin_cached` | — |
| 8 | `approve_admin_cached` | `handler_approve_admin_cached.rs:14` | `admin_cached` | none | `[b"conf", feed_name]` | n/a | `Configuration.admin` | F-018 |
| 9 | `create_mint_map` | `handler_create_mint_map.rs:34` | `admin` | System (Anchor `init`) | `[b"mints_to_scope_chains", oracle_prices, seed_pk, seed_id]` | n/a | creates `MintsToScopeChains` | F-017 |
| 10 | `close_mint_map` | `handler_close_mint_map.rs:17` | `admin` | System (Anchor `close`) | none on `configuration` (only `has_one = admin`) | n/a | closes `MintsToScopeChains`, rent to admin | — |
| 11 | `resume_suspended_price` | `handler_resume_suspended_price.rs:31` | `admin` **or** `resume_authority` | none | `[b"conf", feed_name]` | ✅ | `OraclePrices.prices[i].generic_data` (clears `suspended`) | — |
| 12 | `resume_chainlinkx_price` | `lib.rs:142` | — (always errors) | none | `[b"conf", feed_name]` | n/a | none — returns `DeprecatedInstruction` | OPS-016 |
| 13 | `freeze_price` | `handler_freeze_price.rs:23` | `admin` (freeze/unfreeze) **or** `emergency_council` (freeze only) | none | `[b"conf", feed_name]` | ✅ (`require_gt!(MAX_ENTRIES, entry_id)`) | `OracleMappings.price_types[i]` bit 7 | — |
| 14 | `set_emergency_council` | `handler_set_emergency_council.rs:14` | `admin` | none | `[b"conf", feed_name]` | n/a | `Configuration.emergency_council` | — |
| 15 | `set_resume_authority` | `handler_set_resume_authority.rs:14` | `admin` | none | `[b"conf", feed_name]` | n/a | `Configuration.resume_authority` | — |

> 14 `#[program]` entry points plus the deprecated stub. Nine of the fifteen call
> `oracles::check_context` (`oracles/mod.rs:50-57`), which rejects any unexpected extra account; the
> three refresh instructions do not, because they consume `remaining_accounts` by design, and
> `initialize` / `create_mint_map` / `close_mint_map` take fixed account sets.

---

## 8. State Model Verification

### Account Types

| Account | Discriminator | Space | Owner | Close target | Seeds |
|---|---|---|---|---|---|
| `Configuration` | Anchor `#[account(zero_copy)]` | 10 232 B (`const_assert_eq!`, `states_internal.rs:21-25`) | this program | never closed | `[b"conf", feed_name]` |
| `OracleMappings` | Anchor `#[account(zero_copy)]` | 29 696 B (`:40-44`) | this program | never closed | none — pre-allocated, tied by `has_one` |
| `OraclePrices` | Anchor `#[account(zero_copy)]` | 28 704 B (`:28-32`) | this program | never closed | none — tied by `has_one` |
| `OracleTwaps` | Anchor `#[account(zero_copy)]` | 344 128 B (`:35-36`) | this program | never closed | none — tied by `has_one` |
| `TokenMetadatas` | Anchor `#[account(zero_copy)]` | 86 016 B (`:47-54`) | this program | never closed | none — tied by `has_one` |
| `MintsToScopeChains` | Anchor `#[account]` | `8 + size_from_len(n)` | this program | `close = admin` | `[b"mints_to_scope_chains", oracle_prices, seed_pk, seed_id]` |

All six sizes are asserted at compile time and all are 8-byte aligned (`% 8 == 0` assertions at
`states_internal.rs:25, 32, 36, 44, 51-54`), which is the correct discipline for `bytemuck`-backed
zero-copy accounts.

### State machine — per price entry

```
                 update_mapping_and_metadata (admin, !frozen)
                 ┌──────────────────────────────────────────┐
                 v                                          │
   [unused] ──MappingConfig / MappingTwapEntry──> [configured] ──RemoveEntry──> [unused]
                                                    │   ^
                       refresh_* (permissionless)   │   │  resume_suspended_price
                       writes price + twap          │   │  (admin | resume_authority,
                                                    │   │   requires exact generic_data match)
                                                    v   │
                                              [suspended]        <- set by the ChainlinkX blackout
                                                                    (chainlink.rs:444-471) or by a
                                                                    Token2022Multiplier change
                                                                    (token_2022_multiplier.rs:169-215)

   Orthogonal, stored in bit 7 of price_types[i]:

   [thawed] ──freeze_price(freeze=true)──>  [frozen]   (admin OR emergency_council)
   [frozen] ──freeze_price(freeze=false)──> [thawed]   (admin ONLY)

   While frozen: refreshes fetch and log the price but do not store it
                 (handler_refresh_prices.rs:141-149, handler_refresh_chainlink_price.rs:193-202,
                  handler_refresh_pyth_lazer_price.rs:128-136);
                 mapping updates are rejected (handler_update_mapping_and_metadata.rs:124-127).
```

### Configuration role machine

```
   initialize: admin = signer; admin_cached = emergency_council = resume_authority = default
       │
       ├── set_admin_cached(new)      [admin]         -> admin_cached = new   (revocable, OPS-060)
       ├── approve_admin_cached()     [admin_cached]  -> admin = admin_cached (F-018: not cleared)
       ├── set_emergency_council(k)   [admin]         -> emergency_council = k
       └── set_resume_authority(k)    [admin]         -> resume_authority = k

   An unset (default) delegate grants nothing — is_active_delegate, states/configuration.rs:31-33.
```

### Invariants verified

| # | Property | Where enforced | Status |
|---|---|---|---|
| INV-01 | `OraclePrices.oracle_mappings == OracleMappings` key, and `OracleTwaps` references both | `has_one` at `handler_refresh_prices.rs:21-25` and on every other handler that takes the triple | ✅ PASS |
| INV-02 | A written price always derives from the account pinned at `price_info_accounts[i]` | `handler_refresh_prices.rs:83-90` | ✅ PASS |
| INV-03 | A frozen entry's price and TWAP never change | `:71, :122, :141-149` + the two sibling handlers | ✅ PASS |
| INV-04 | A suspended entry cannot be refreshed until a resume that names its exact 24-byte record | `chainlink.rs:427-440`, `token_2022_multiplier.rs:132-138`, `handler_resume_suspended_price.rs:77-80` | ✅ PASS |
| INV-05 | A published price is never zero unless its oracle type permits zero | `oracles/mod.rs:339-342`, `states/oracle_type.rs:163-174` | ✅ PASS |
| INV-06 | A report older than or equal to the stored one is rejected | `chainlink.rs:174-177`, `pyth_lazer.rs:300-303`, `redstone.rs:38-41` | ✅ PASS |
| INV-07 | `remaining_accounts` stays index-aligned with `tokens` across every `continue` | `handler_refresh_prices.rs:74` (consumed before the skip at `:78`) | ✅ PASS |
| INV-08 | A composite's published timestamp covers all of its price inputs | `capped_floored.rs:80-83`, `capped_most_recent_of.rs:57-68` | ❌ FAIL — F-005 |
| INV-09 | A price's `unix_timestamp` reflects when the value was observed | holds for the signed feeds; **not** for the CLMM/rate types, which stamp `clock.slot` (`orca_whirlpool.rs:71`, `msol_stake.rs:31`, `jito_restaking.rs:16`) | ⚠️ PARTIAL — by design for rate oracles, load-bearing for F-001 |
| INV-10 | Admin rotation requires both the outgoing and the incoming key | `handler_set_admin_cached.rs:10`, `handler_approve_admin_cached.rs:10` | ✅ PASS |
| INV-11 | `emergency_council` can stop but not restart a price | `states/configuration.rs:24` (`freeze &&` guard) | ✅ PASS |
| INV-12 | Every in-scope account size matches its declared constant | `states_internal.rs:21-54` (compile-time) | ✅ PASS |

---

## 9. Code Maturity Scorecard

> Phase 4.5 — the engineering-quality gate, orthogonal to the risk score. 0 absent · 1 ad-hoc ·
> 2 partial · 3 good · 4 strong.

| # | Category | Score (0-4) | Evidence (file:line / artifact) | Gap to next level |
|---|----------|:-----------:|---------------------------------|-------------------|
| 1 | Access Controls | **3** | `Signer` + `has_one` on a PDA-derived `Configuration` for all nine admin instructions; two-step admin handshake (`handler_set_admin_cached.rs:25` → `handler_approve_admin_cached.rs:26`); two capability-narrowed delegate roles with an unset-delegate guard (`states/configuration.rs:19-33`); a resume bound to the exact record it approves (`handler_resume_suspended_price.rs:77-80`) | No timelock on any privileged action (OPS-053/056/057); `initialize` is permissionless (F-009); no on-chain event for a role change (F-013) |
| 2 | Arithmetic | **3** | `overflow-checks = true` workspace-wide (`Cargo.toml:8`); u128/U192/U256 intermediates throughout; `mul_div` rejects a zero divisor (`math.rs:300-319`); timestamp math saturates (`math.rs:257-298`); precision-loss decisions documented (`switchboard_on_demand.rs:107-121`) | ~8 unchecked operations on externally-sourced values and two unguarded divisions become panics (F-004); a release-invisible overflow guard (F-011); `Price.exp` unbounded at every ingestion point (F-020) |
| 3 | Account & Type Safety | **2** | Typed `AccountLoader`/`Account` for all own state; source accounts pinned by address against the mapping (`handler_refresh_prices.rs:83-90`); extras cross-pinned against base-account fields; discriminators checked in both shared helpers; compile-time size assertions (`states_internal.rs:21-54`) | The shared helpers never check `account.owner` across ~18 call sites, and one foreign discriminator carries 1 byte of entropy (F-006); `bytemuck::from_bytes` slices without a length check (F-004) |
| 4 | Input Validation | **3** | `validate_oracle_cfg` gates every mapping write (`oracles/mod.rs:350-459`); each composite validates its full parameter set atomically (`most_recent_of.rs:154-173`, `capped_floored.rs:86-125`, `conditional.rs:194-259`); zero-valued divisors rejected at config time (OPS-084); `validate_source_entries` enforces contiguity (`utils/source_entries.rs:7-26`); the Token-2022 TLV walker bounds every read (`compat/token_2022_scaled_ui_amount.rs:82-158`) | One unbounded bps parameter (F-010); two index-before-bound-check sites (F-015); an unbounded name length (F-016); four config-time `Ok(())` no-ops with `TODO`s (`oracles/mod.rs:369-373`); three warn-instead-of-reject cases (OPS-083) |
| 5 | Testing | **0** | **Nothing.** Zero `#[cfg(test)]`, `#[test]` or `mod tests` across 108 `.rs` files; no `tests/` directory | Publish or create an SVM suite (F-008). This is the weakest link in the whole assessment |
| 6 | Fuzzing & Property Tests | **0** | **Nothing.** No `fuzz/`, no `cargo-fuzz`, no `proptest`/`quickcheck`, no Trident — despite eleven hand-written `from_generic_data` decoders and a manual TLV walker | Fuzz the pure decoders first; they are free to harness (F-008) |
| 7 | Error Handling & DoS Resilience | **2** | 88 specific `ScopeError` variants (`errors.rs`); an explicit partial-failure design where a batch skips a failing entry and a single-entry call fails loudly (`handler_refresh_prices.rs:58, 102-114`); exhaustive matches with no `_` arm (FV-056) | Reachable panics defeat the skip-on-error design and abort whole batches (F-004); four intentional `panic!`/`expect` sites on permissionless paths (`oracles/mod.rs:108,310,441`, `klend_ctoken_exchange_rate.rs:96,105`) |
| 8 | Upgradeability & Governance | **2** | Two-step admin rotation with a revocable staging slot (OPS-060); separate, narrower freeze and resume roles; a deprecated instruction retained as an erroring stub rather than removed (`lib.rs:140-150`); cluster ids guarded by seven mutually-exclusive `compile_error!`s (`program_id.rs:4-25`) | No timelock anywhere (OPS-053); upgrade authority not verifiable offline (OPS-001…010); the published source cannot reproduce the deployed binary without a private dependency (OPS-071); no epoch/version guard against pre-signed admin transactions (OPS-077) |
| 9 | Monitoring & Incident Response | **1** | A genuine emergency stop exists and is reachable by a role narrower than the admin (`handler_freeze_price.rs:23-55`); refresh logs carry entry id, old and new price, and both slots (`handler_refresh_prices.rs:186-195`) | No `emit!` anywhere, so monitoring must parse log text (F-013); no `SECURITY.md`, no IR runbook, no bug-bounty reference (OPS-044/046/047) |
| **Mean** | | **1.8 / 4.0** | | |
| **Weakest link** | | **0 / 4.0** | Testing and Fuzzing both score 0 | |

Categories scoring ≤ 1 — **Testing (0)**, **Fuzzing & Property Tests (0)** and **Monitoring & IR (1)** —
are prioritised in the roadmap below regardless of individual finding severity, per Phase 4.5.

The shape of this scorecard is worth stating plainly: the *code* is good (three categories at 3, none
below 2 on the implementation side) and the *assurance around it* is absent. That is a different risk
profile from a codebase with weak logic and strong tests — nothing here is currently broken in a way
an attacker can monetise, but there is no mechanism that would catch it if a future change broke it.

---

## 10. Remediation Roadmap

Full table with effort estimates: `audit_2/roadmap.md`. Summary:

### Immediate — Severity 9-10 (block deploy)

None. No finding in this report blocks a deployment.

### Before Release — Severity 7-8

None.

### Within 2 Weeks — Severity 5-6

| Finding | Sev | Fix |
|---|---|---|
| F-001 | 6 | Let `MostRecentOf` drop an out-of-tolerance *advisory* source instead of failing the whole entry, or move the AMM leg out of the divergence set into a separate health entry. Interim: `emergency_council` runbook covers "freeze the AMM leg"; confirm consumers treat a stale `Checked …` entry as *block new borrows*, not *liquidate at last price* |
| F-002 | 5 | Call `check_execution_ctx` in `refresh_chainlink_price` and `refresh_pyth_lazer_price` (widening the allowlist to the ed25519 precompile where that instruction must precede), or document the asymmetry in code |
| F-003 | 5 | Pass `pool_sqrt_price_from_oracle_prices` to `underlying_inventory` in `holdings_of_token_x`, matching `ktokens::holdings` — or fix the contradictory doc comment and add a divergence guard between the two sqrt prices |

### Next Sprint — Severity 3-4

| Finding | Sev | Fix |
|---|---|---|
| F-004 | 4 | Convert the enumerated panic sites to typed `ScopeError`s so a bad entry is skipped, not the batch |
| F-005 | 4 | Publish `min(source, cap, floor)` as the entry's timestamp, or age-check the bounds |
| F-006 | 4 | Add an `expected_owner` parameter to both shared deserializers and thread the real program ids through ~18 call sites |
| F-007 | 4 | `require!(!state.is_paused)` in `securitize::check_accounts` |
| F-008 | 4 | Publish/write the SVM suite; add CI running `clippy -D warnings`, `cargo audit` and the suite |
| F-009 | 3 | Gate `initialize` behind a deployer key, or document the squatting risk as accepted |
| F-010 | 3 | `require_gte!(FULL_BPS, ref_price_tolerance_bps)` |
| F-011 | 3 | Replace `debug_assert_eq!` with a checked narrowing returning `MathOverflow` |
| F-012 | 3 | Return `ScopeChainError` from the three `unwrap()`s in `get_price_from_chain` |
| F-013 | 3 | Add `#[event]` emission for price writes and privileged actions |
| F-014 | 3 | Check `result.num_samples` against `min_sample_size` in the Switchboard path |

### Backlog — Severity 1-2

F-015 (bound check ordering) · F-016 (`set_name` length) · F-017 (stored bump) · F-018 (clear
`admin_cached`) · F-019 (document the v1 distinction + test under a v1 runtime) · F-020 (bound
`Price.exp`) · F-021 (crate version).

### Maturity-driven work (independent of finding severity)

| Category | Score | Action |
|---|---|---|
| Testing | 0 | SVM suite loading the compiled `.so`, one fixture per oracle type, plus the negative paths for freeze / suspend / resume / unauthorized authority and clock-controlled staleness tests |
| Fuzzing & Property Tests | 0 | `cargo-fuzz` targets for the eleven `from_generic_data` decoders and the TLV walker; Trident for `refresh_price_list` instruction sequences |
| Monitoring & Incident Response | 1 | Events (F-013); `SECURITY.md`; an IR runbook for the `emergency_council` freeze path; alerting on `freeze_price`, `set_admin_cached`, `approve_admin_cached`, `set_emergency_council`, `set_resume_authority` |

### Re-Audit Checklist

- [ ] All Critical findings fixed and verified — *none exist*
- [ ] All High findings fixed and verified — *none exist*
- [ ] Medium findings (F-001, F-002, F-003) fixed, or accepted with documented risk
- [ ] Low/Info findings triaged; accepted ones recorded with a rationale
- [ ] Regression tests added for each fix — **blocked on F-008**; this is the reason F-008 is
      prioritised above several higher-numbered findings
- [ ] Program re-deployed and the deployed binary verified against the published source (OPS-070/071 —
      needs the `yvaults` reproducibility question answered)
- [ ] `/auditor:re-audit` run against this report to classify each finding FIXED / PARTIALLY-FIXED /
      STILL-OPEN / REGRESSED, plus a sibling-patch sweep for the F-004 and F-006 anti-patterns (both
      are repeated-pattern findings; a point fix at one call site leaves the others open)

---

## 11. Appendices

### A. Tool versions

```
Auditor:            auditor-skill 7.3.0@6bb2cbf (corpus at /home/felip/dev/auditor-site/vendor/auditor-skill)
Mode:               1 — FULL repository audit, linear single-agent execution (no subagents)
Scope flag:         --scope program
Checklists loaded:  01, 02, 03, 04, 05, 06, 07, 16   (591 items)
Known vectors:      58 of 136 loaded (INDEX.md trigger gate); KV-135 and KV-002 reopened on evidence
References loaded:  known-vectors/INDEX.md, known-vectors/005, known-vectors/135,
                    references/report-format.md, templates/report-template.md, templates/intake.md
Build tooling:      NONE RUN — cargo, rustc, anchor, solana, npm/node were not invoked at any point
```

**Declared toolchain of the target** (read, not executed): `rust-toolchain.toml` pins
`channel = "1.74.1"`; `Cargo.toml` sets `resolver = "2"`, `lto = "thin"`, `overflow-checks = true`;
`anchor-lang`/`anchor-spl` `0.28.0`; `solana-program` `>1.16.18`.

### B. Environment

```
OS:               Linux 6.6.87.2-microsoft-standard-WSL2
Analysis method:  static, read-only. No build, no test, no deployment, no RPC query, no network call.
Cluster tested:   NONE — no validator, no fork, no simulation was run.
RPC provider:     NONE.
Repository:       local clone, detached HEAD at fe5352366a7215dda5c6f7b867a6bb5929d52c94
Working tree:     clean with respect to tracked files; three untracked directories
                  (AUDITOR/, audit_1/, audit_2/) excluded from the audit — see §4.7
Artifacts:        audit_2/REPORT.md (this file)
                  audit_2/intake.md              — persisted questionnaire + applied defaults
                  audit_2/roadmap.md             — prioritised remediation plan
                  audit_2/checkpoint.md          — chunked-execution progress record
                  audit_2/worksheets/context/    — Phase 0.5 context reconstruction (4 files)
```

### C. Evidence tiers used

| Tier | Meaning | Applied to |
|---|---|---|
| `[PoC-PROSE]` | Structured attacker narrative — actor, capability, numbered steps, guard bypassed, quantified outcome | F-001, F-002, F-003, F-004, F-005, F-006, F-007 |
| `[PoC-REPRODUCED]` / `[PoC-SIM-REPRODUCED]` / `[PoC-FUZZ-REPRODUCED]` | Executable proof | **None** — building and running anything was out of bounds for this engagement, so no finding claims an executable tier |

No finding in this report claims a fix-evidence tier: no patch was applied, and nothing was executed
to verify one. All recommendations are proposals against the pinned commit.

### D. What this report does not establish

1. **It is not a clearance.** The absence of a Critical or High finding means this pass did not find
   one, not that none exists. Rule 10 applies throughout: every item marked `[PASS]` cites the code
   that proves it, every `[N/A]` states why, and every unverifiable item says so rather than
   defaulting to PASS.
2. **The economic model was not simulated.** F-001's and F-003's downstream impact depends on each
   consumer protocol's stale-price and liquidation policy, which is outside `--scope program`. Both
   findings carry the phrase "extent not determined within this assessment" where that boundary bites.
3. **The upgrade authority, the multisig configuration and the deployed binary were not inspected** —
   all three require on-chain queries. They are the three largest residual unknowns, and the first two
   are load-bearing for the trust model in §4.4.
4. **Five dependencies were reviewed only at the call boundary** (§2, limitation 2). In particular the
   `yvaults` crate, which gates the three kToken oracle types and is a private repository, was not
   read; F-003's severity reflects that its impact multiple could not be computed without it.
5. **The off-chain crank was not audited** — it is not in this repository. It is the component that
   decides which entries get refreshed and how often, which is the operational counterpart to F-001.

### E. Disclaimer

This audit report is provided as-is. It represents a point-in-time review of the codebase at commit
`fe5352366a7215dda5c6f7b867a6bb5929d52c94`. No guarantee is made that all vulnerabilities have been
found. It is audit-shaped automation and a rigorous first pass — not a substitute for a human firm
audit covering business logic, economic modelling and legal compliance, and not a formal proof of
correctness. The audit does not constitute financial or legal advice, and it does not issue a
"safe to deploy" guarantee.






