# 🔒 Security Audit Report

## 1. Executive Summary

**Repository:** `isc_bridge` — ISC Multichain Bridge (local clone, no remote configured)
**Commit:** `81ae372a6383951796709c55c7687a3b80618601` (`81ae372` — "Cleanup unused imports", 2023-07-18)
**Branch:** detached `HEAD` (main branch of record: `main`; single-commit history)
**Date:** 2026-09-11
**Auditor:** auditor-skill 7.3.0@6bb2cbf — autonomous agent, Mode 1 (FULL repository audit, linear execution)
**Scope:** PROGRAM (`--scope program`) — on-chain code only
**Program ID:** `7JAUAovyJHXsvqJkeXmjiTUpWTBADiFPagmkgj2Y2s47` (`solana/src/lib.rs:33`)
**Languages Detected:** Rust (native Solana, `solana-program 1.16.1`), Solidity `^0.8.9`; JavaScript/ESM and Python present but out of scope
**Repository Risk Score:** **6 — 🟡 MEDIUM**

### What We Found

We reviewed the on-chain half of a Wormhole-assisted ISC bridge: a 413-line native Solana program
that runs a permissionless, fee-free, fixed 1:1 swap pool between two hardcoded SPL mints (ISC and
OIL), plus the two mirrored EVM contracts. The program's account validation is, for a hand-rolled
native program, unusually thorough — the signer, both mints, the PDA, both reserve ATAs and all
three invoked program IDs are pinned before any value moves, there is no arithmetic to overflow, no
admin instruction, no fee, and no program-owned state to corrupt. **We found no confirmed critical
or high-severity vulnerability.**

The two most serious issues are both *latent* rather than presently provable. First, the swap
exchanges raw token base units 1:1 while never reading either mint's `decimals` and never using
`transfer_checked` (`solana/src/processes.rs:152-183`; the EVM mirror at `evm/contracts/Swap.sol:52-53`);
if the two tokens' decimals ever differ — which the architecture makes plausible, since Wormhole
caps wrapped-asset decimals at 8 and OpenZeppelin's default ERC-20 is 18 — a single call drains the
smaller-decimal reserve by a factor of 10^k. We could not read the deployed mints, so this is
reported at **6** and flagged `[UNDETERMINED]`, with the escalation condition stated in the finding.
Second, live private key material is committed to the repository (`web-client/config/config.json:6,19,31`),
including a 64-byte Solana secret key whose on-chain role we cannot verify; the surrounding
localhost RPC endpoints and the well-known Ganache test key beside it strongly suggest a local
harness, which is why this is **6** rather than **10**, but the key must be treated as compromised
and rotated regardless.

Beyond those, the recurring theme is **absent engineering and operational scaffolding rather than
broken logic**: zero tests, zero CI, zero static analysis, no structured events, no pause, no
recovery path if a reserve account is frozen, and no documented upgrade authority, timelock or
verifiable build for a program that holds the bridge's entire pooled liquidity. Two concrete code
defects support that theme — a copy-paste error that leaves one caller-supplied token account's
program ownership unvalidated (`processes.rs:60`, `:231`), and the use of a zero-lamport balance as
an account-existence oracle, which lets anyone brick the pool's first swap for one lamport
(`processes.rs:101`, `:126`).

**Deploy guidance:** this code is **not ready for mainnet with material value at risk**. It is
acceptable for continued devnet/local use. Before any mainnet deployment, resolve F-001 (assert or
normalise decimals), F-002 (rotate the committed keys), F-004 (pin and document the upgrade
authority) and F-008 (stand up a test suite), and re-audit. This report is a thorough first pass,
not a substitute for a human firm audit, and it issues no "safe to deploy" guarantee.

### Severity Distribution

| Score | Label | Count |
|-------|-------|-------|
| 10 | 🔴 CRITICAL | 0 |
| 9 | 🔴 CRITICAL | 0 |
| 8 | 🟠 HIGH | 0 |
| 7 | 🟠 HIGH | 0 |
| 6 | 🟡 MEDIUM | 2 |
| 5 | 🟡 MEDIUM | 2 |
| 4 | 🔵 LOW | 4 |
| 3 | 🔵 LOW | 4 |
| 2 | ⚪ INFO | 1 |
| 1 | ⚪ INFO | 0 |
| **Total Findings** | | **13** |

Every row above corresponds to numbered finding blocks in §4: severity 6 → F-001, F-002;
severity 5 → F-003, F-004; severity 4 → F-005, F-006, F-007, F-008; severity 3 → F-009, F-010,
F-011, F-013; severity 2 → F-012.

### Items Verified

| Metric | Count |
|--------|-------|
| Total checklist items (in scope) | 679 |
| PASS | 101 |
| FAIL | 90 |
| PARTIAL | 38 |
| UNDETERMINED | 9 |
| N/A (evidence-backed, in-scope) | 441 |
| Completion | 100% (679 / 679 in-scope items carry an explicit verdict) |

> **Reading the FAIL count.** 90 item-level FAILs collapse into 13 findings because a single root
> cause trips many items (the absent test suite alone accounts for 35 FAILs across checklist 16,
> and the absent governance documentation for 26 across checklist 07). Per OUTPUT-RULES Rule 5,
> only items at severity ≥ 4 require a full finding block; severity 1-3 FAILs are recorded inline
> and consolidated. Every inline FAIL at severity ≥ 4 maps to an F-xxx block, and no F-xxx exists
> without a supporting item verdict.

---

## 2. Scope Coverage

> Which checklists and vector groups were in scope, and how many items were evaluated.
> Out-of-scope items render `[N/A — out of scope]` from the scope gate (Rule 0), not from reading
> each file.

| Checklist / vector group | In scope? | Items evaluated / total | Trigger / reason |
|---|---|---|---|
| 01 Account Validation | Yes | 90 / 90 | `.rs` on-chain program (`solana/src/`), `--scope program` |
| 02 Access Control | Yes | 50 / 50 | same |
| 03 Arithmetic Safety | Yes | 63 / 63 | same |
| 04 CPI & PDA Safety | Yes | 70 / 70 | same |
| 05 State Machine & Lifecycle | Yes | 72 / 72 | same |
| 06 Economic & Logic | Yes | 89 / 89 | same + Q17 = custodial pool |
| 07 OpSec & Governance | Yes | 85 / 85 | `PROGRAM` scope includes 07 (FULL-AUDIT.md § Scope Control) |
| 08 TypeScript Safety | No | 0 / 64 | OUT-OF-SCOPE (`--scope program`): `web-client/**` is off-chain |
| 09 Backend Security | No | 0 / 131 | OUT-OF-SCOPE: no backend, and off-chain under `--scope program` |
| 10 Frontend Security | No | 0 / 84 | OUT-OF-SCOPE: `web-client/pages/index.js` is off-chain |
| 11 Supply Chain | No | 0 / 52 | OUT-OF-SCOPE under `--scope program` (see §4.6 coverage limits) |
| 12 Secrets & Key Management | No | 0 / 53 | OUT-OF-SCOPE under `--scope program`; the committed-key issue is nonetheless reported via checklist 07 §7.3 (OPS-028/OPS-036) and KV-001, which *are* in scope |
| 13 Deployment & Infrastructure | No | 0 / 89 | OUT-OF-SCOPE under `--scope program` |
| 14 Python Safety | No | 0 / 82 | OUT-OF-SCOPE: `evm/scripts/launch.py` is an off-chain Brownie deploy script |
| 15 General Language Safety | **Yes** | 88 / 88 | OUTPUT-RULES Rule 7 — Solidity (`evm/contracts/*.sol`) is on-chain and has no dedicated checklist, so checklist 15 is applied to it |
| 16 Formal Verification & Testing | Yes | 72 / 72 | `PROGRAM` scope includes 16 (FULL-AUDIT.md § Scope Control) |
| 17 Logging, Monitoring & IR | No | 0 / 65 | OUT-OF-SCOPE under `--scope program`; on-chain event emission is still covered by SM-047–050 and OPS-048–050 |
| 18 Privacy, Compliance & Change Mgmt | No | 0 / 60 | OUT-OF-SCOPE under `--scope program`; Q35 = none, Q36 = no PII |
| 19 AI Agent Security | No | 0 / 33 | OUT-OF-SCOPE: no `.mcp.json`, no agent SDK, no LLM dependency anywhere in the tree |
| 20 Rust Off-Chain Services | No | 0 / 21 | OUT-OF-SCOPE: the only `.rs` files are the program crate itself (`solana/src/`); no off-chain Rust exists |
| KV crypto / on-chain (001–030) | Yes | 30 / 30 | crypto phase, on-chain program present |
| KV backend (031–055) | No | 0 / 25 | OUT-OF-SCOPE: no backend in scope |
| KV frontend (056–075) | No | 0 / 20 | OUT-OF-SCOPE: no frontend in scope |
| KV devops (076–100) | Partial | 1 / 25 | Only KV-091 (Upgrade Authority Not Secured) is evaluated — it maps to in-scope checklist 07 §7.1. The other 24 are OUT-OF-SCOPE under `--scope program`. |
| KV modern on-chain (101–109) | Yes | 9 / 9 | on-chain program present |
| KV AI / off-chain Rust (110–117) | Partial | 1 / 8 | Only KV-111 (BPF stack-frame overflow) is on-chain. KV-110/112–117 are AI-agent or off-chain-Rust — OUT-OF-SCOPE. |
| KV governance & randomness (118–120) | Yes | 3 / 3 | on-chain program present |
| KV modern / custody / consumers (121–126) | Partial | 4 / 6 | KV-121, 122, 123, 125 are on-chain — evaluated. KV-124 (custodial key export) and KV-126 (session-token custody) are off-chain wallet concerns — OUT-OF-SCOPE. |
| KV DoS / float / keeper / CLMM (127–131) | Yes | 5 / 5 | on-chain program present |
| KV token registry (132–134) | Partial | 1 / 3 | KV-134 (Token ACL, on-chain) evaluated. KV-132/133 are off-chain token-list/risk-API concerns — OUT-OF-SCOPE. |
| KV transaction format (135–136) | Partial | 1 / 2 | KV-135 has an on-chain component (`load_instruction_at` + ComputeBudget gates) — evaluated. KV-136 is reader/indexer-side — OUT-OF-SCOPE. |

### Scope Metrics

| Metric | Count |
|---|---:|
| In-scope checklist items | 679 |
| Items with a verdict | 679 |
| Out-of-scope checklist items | 734 |
| In-scope known-vectors | 55 |
| In-scope known-vectors with a verdict | 55 |
| Out-of-scope known-vectors | 81 |
| **Completion (in-scope)** | **100%** |

> Checklist item counts follow the authoritative table in `SKILL.md` § Checklists Reference
> (01 = 90, 08 = 64, 09 = 131, 10 = 84, 11 = 52, 13 = 89, 16 = 72, 17 = 65, 19 = 33, 20 = 21).
> `templates/report-template.md` carries a slightly older count for several checklists; the
> `SKILL.md` figures are used throughout this report and the totals reconcile to 1,413.

---

## 3. Scope & Methodology

### Files Audited

| Domain | Language | Files | Lines of Code |
|---|---|---:|---:|
| Solana program (in scope) | Rust | 3 | 413 |
| Solana program manifest (in scope) | TOML | 1 | 17 |
| EVM contracts (in scope) | Solidity | 2 | 89 |
| **In-scope total** | | **6** | **519** |
| Off-chain client (context only, not verdicted) | JS/ESM, JSON, CSS | 11 | 4,237 |
| Dependency lockfile (context only) | TOML | 1 | 2,209 |
| EVM deploy script (context only) | Python | 1 | 22 |
| Repo config & docs (context only) | YAML, gitignore, MD, SVG | 5 | 33 |
| **Repository total** | | **24 tracked files** | **7,020** |

Untracked working-tree directories (`AUDITOR/`, `audit_1/`, `audit_2/`) are not part of commit
`81ae372` and were excluded from the audit. `AUDITOR/` contains a vendored copy of an auditor-skill
corpus; it was enumerated but not treated as repository content.

### Method

1. **Discovery** — `git ls-files` enumeration, extension/marker detection; no corpus loaded yet.
2. **Scope declaration** (Rule 0) — detected native Solana Rust + Solidity, applied `--scope program`,
   computed the in-scope checklist set above.
3. **Intake** — `QUESTIONS.md` answered non-interactively from repository evidence plus documented
   defaults; persisted to `audit_2/intake.md`. Every applied default is restated in §4.6.
4. **Phase 0.5 context reconstruction** — four worksheets (`audit_2/worksheets/context/`) covering
   both instruction handlers, the entrypoint/decoder, and the EVM pair. Each records purpose,
   signature, block-by-block walkthrough, ≥ 3 invariants, ≥ 5 assumptions and ≥ 3 external-interaction
   risks, every claim line-cited. No item was marked `[FAIL-N≥6]` against a function not reconstructed here.
5. **Phase 1–4** — checklists 01–07, 15, 16 walked item by item against the read source; every
   in-scope known vector evaluated against its own verification procedure or gated out with
   evidence.
6. **Rule 5b validation gate** — both severity-6 findings carry Reachability and Math/State-Bounds
   blocks; neither could be fully bounded within a static, network-isolated engagement, so both are
   flagged `[UNDETERMINED]` rather than reported at their worst-case impact.
7. **Constraints** — analysis was entirely static and read-only. Nothing was built, installed, run
   or fetched; no RPC was queried. Consequences are itemised in §4.6.

### Checklists Applied

| # | Checklist | Items | Pass | Fail | Partial | Und. | N/A | Pass Rate (excl. N/A) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 01 | Account Validation | 90 | 17 | 10 | 10 | 0 | 53 | 46% |
| 02 | Access Control | 50 | 15 | 3 | 4 | 0 | 28 | 68% |
| 03 | Arithmetic Safety | 63 | 12 | 0 | 1 | 0 | 50 | 92% |
| 04 | CPI & PDA | 70 | 21 | 3 | 4 | 0 | 42 | 75% |
| 05 | State Machine | 72 | 7 | 3 | 1 | 0 | 61 | 64% |
| 06 | Economic & Logic | 89 | 8 | 6 | 9 | 0 | 66 | 35% |
| 07 | OpSec & Governance | 85 | 8 | 26 | 2 | 9 | 40 | 18% |
| 08 | TypeScript Safety | 64 | — | — | — | — | 64 | out of scope |
| 09 | Backend Security | 131 | — | — | — | — | 131 | out of scope |
| 10 | Frontend Security | 84 | — | — | — | — | 84 | out of scope |
| 11 | Supply Chain | 52 | — | — | — | — | 52 | out of scope |
| 12 | Secrets & OpSec | 53 | — | — | — | — | 53 | out of scope |
| 13 | Deployment & Infra | 89 | — | — | — | — | 89 | out of scope |
| 14 | Python Safety | 82 | — | — | — | — | 82 | out of scope |
| 15 | General Language (Solidity) | 88 | 7 | 4 | 6 | 0 | 71 | 41% |
| 16 | Formal Verification & Testing | 72 | 6 | 35 | 1 | 0 | 30 | 14% |
| 17 | Logging, Monitoring & IR | 65 | — | — | — | — | 65 | out of scope |
| 18 | Privacy, Compliance & Change Mgmt | 60 | — | — | — | — | 60 | out of scope |
| 19 | AI Agent Security | 33 | — | — | — | — | 33 | out of scope |
| 20 | Rust Off-Chain Services | 21 | — | — | — | — | 21 | out of scope |
| | **In-scope total** | **679** | **101** | **90** | **38** | **9** | **441** | **42%** |
| | **Corpus total** | **1413** | | | | | | |

---

## 4. Findings

> Only items with severity ≥ 4 require a full finding block (Rule 5). Findings F-009 to F-013
> (severity 2-3) are given compact blocks for traceability.

---

#### [F-001] Fixed 1:1 raw-unit swap with no decimal normalisation and no `transfer_checked`

| Field | Value |
|---|---|
| **Severity** | 6 — 🟡 MEDIUM · `[UNDETERMINED]` · impact 8 if the decimals differ |
| **Checklist Item** | AV-060, AV-061, CPI-014, EXT-014, ECON-049, FV-003 |
| **Category** | Arithmetic / Units / Token Accounting |
| **Language** | Rust (native Solana) + Solidity |
| **File** | `solana/src/processes.rs:152-183`, `:322-353`; `evm/contracts/Swap.sol:52-53` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

Both Solana handlers move the caller's `amount` of one mint in and pay out the **identical raw
`amount`** of the other mint. In `swap_isc_to_oil` the same `amount` binding is passed to the ISC
transfer at `processes.rs:158` and the OIL transfer at `:175`; `swap_oil_to_isc` mirrors this at
`:328` and `:345`. The EVM contract does the same at `Swap.sol:52-53`.

`amount` is in **raw base units**, whose value depends on the mint's `decimals`. The program never
reads either mint's decimals — `spl_token::state::Mint` is never imported and the mint accounts
(`acc_info_isc`, `acc_info_oil`) are only compared by address (`:81-86`). It also uses the legacy
`spl_token::instruction::transfer` (`:152`, `:169`, `:322`, `:339`) rather than `transfer_checked`,
which would bind the mint and decimals at runtime. The EVM contract likewise never calls
`decimals()` on either token.

The protocol therefore silently assumes `ISC.decimals == OIL.decimals` and enforces that assumption
nowhere. The assumption is load-bearing for the whole peg and is not stated in the code, in
`README.md`, or in any test.

**Impact:**

If the two mints' decimals differ by `k`, every swap in one direction pays out `10^k` times the
value it takes in, and the smaller-decimal reserve is drained by an unprivileged caller in a single
transaction, limited only by the reserve size. There is no fee, no slippage bound, no rate
parameter and no aggregate outflow cap (ECON-072) to absorb the error.

This is not a hypothetical shape for this architecture. The Wormhole Token Bridge caps wrapped-asset
decimals at 8, so a bridged OIL will not generally match a 9-decimal native SPL ISC; on the EVM leg,
`ISCToken` (`evm/contracts/ISC.sol:9-12`) does not override `decimals()` and therefore inherits
OpenZeppelin's **18**, while `web-client/config/config.json:13,25,40` declares `9` for every chain —
an inconsistency already present in the repository.

**What remains unproven:** we could not read the deployed mints' `decimals` (static, read-only,
network-isolated engagement), and `OILToken.sol` — referenced at `evm/scripts/launch.py:1,6` — is
**not present in the repository**, so the EVM counterparty's decimals are unknown. The missing check
is provable at `file:line`; the exploit arithmetic is not. Extent not determined within this
assessment.

**Rule 5b — Reachability:**

```
- Entry point: SwapInstruction::SwapIscToOil / SwapOilToIsc @ solana/src/lib.rs:22-29;
               Swap.swap(uint256,bool) @ evm/contracts/Swap.sol:49
- Signer / authority required: permissionless (any signer) @ processes.rs:38, :209
- Preconditions to reach the vulnerable line: the twelve pinned accounts (processes.rs:19-30),
  a caller-owned token account per mint (:43, :54), and sufficient reserve balance in the
  outbound ATA (enforced by SPL Token, not by this program)
- Guard analysis: no guard exists between the two transfers. The checks at :38-98 constrain
  *which* accounts participate, never *how much* value each unit represents. transfer (not
  transfer_checked) is used at :152/:169, so the runtime performs no decimals binding either.
- Verdict: REACHABLE
```

**Rule 5b — Math / State-Bounds:**

```
- Vulnerable expression: transfer(user_isc -> pda_isc, amount) @ :152-158 followed by
  transfer(pda_oil -> user_oil, amount) @ :169-175 — the same `amount` for both mints
- Input domain: amount ∈ [0, u64::MAX], caller-chosen, forwarded unmodified from
  instructions.rs:19
- Boundary that breaks: decimals(ISC) != decimals(OIL). Let k = decimals(ISC) - decimals(OIL).
- Worked case: assume decimals(ISC) = 9, decimals(OIL) = 8 (the Wormhole wrapped-asset cap).
  Call swap_isc_to_oil(amount = 1_000_000_000): the caller pays 1e9 raw ISC = 1.0 ISC and
  receives 1e9 raw OIL = 10.0 OIL. Swapping those 10 OIL back via swap_oil_to_isc
  (amount = 1_000_000_000 per call, repeated 10 times) returns 10.0 ISC. Net: +9 ISC per
  round trip, repeatable until the ISC reserve is empty.
- Net effect: full drain of one reserve at a 10^k multiple, if and only if k != 0. If k == 0
  the code is correct and this finding is a latent-invariant / hardening issue only.
```

**Proof of Concept:**

```
Actor:      any wallet holding a small ISC balance (permissionless)
Capability: one signature; no privilege, no capital beyond one unit of ISC
Assumption: decimals(ISC) = 9, decimals(OIL) = 8  <-- the unverified premise

1. Alice calls SwapIscToOil { amount: 1_000_000_000 }.
   processes.rs:152 moves 1e9 raw ISC = 1.0 ISC  from Alice to the PDA reserve.
   processes.rs:169 moves 1e9 raw OIL = 10.0 OIL from the PDA reserve to Alice.
   Alice paid 1.0 ISC and holds 10.0 OIL.
2. Alice calls SwapOilToIsc { amount: 10_000_000_000 }.
   processes.rs:322 moves 1e10 raw OIL = 10.0 OIL from Alice to the PDA reserve.
   processes.rs:339 moves 1e10 raw ISC = 10.0 ISC from the PDA reserve to Alice.
   Net over the round trip at k = 1: Alice turned 1.0 ISC into 10.0 ISC.
3. Repeat. Each round trip multiplies Alice's holdings by 10^k until the ISC reserve is empty.

Guard bypassed: none — there is no guard. The checks at processes.rs:38-98 validate account
identity only; no code path ever compares the two mints' decimals.
Quantified outcome: the entire reserve of whichever token has fewer decimals, in O(log_10) calls.
```

**Recommendation:**

```rust
// solana/src/processes.rs — add near the top of BOTH handlers, after the mint pins at :81-86

use spl_token::state::Mint;

let isc_mint = Mint::unpack(&acc_info_isc.try_borrow_data()?)?;   // Pack::unpack, not
let oil_mint = Mint::unpack(&acc_info_oil.try_borrow_data()?)?;   // unpack_from_slice (F-009)
if isc_mint.decimals != oil_mint.decimals {
    return Err(ProgramError::InvalidAccountData);
}

// ...and replace BOTH legacy transfers with the decimals-binding variant, e.g. at :152:
let tx = spl_token::instruction::transfer_checked(
    acc_info_token_prog.key,
    acc_info_initializer_isc_ata.key,
    acc_info_isc.key,                 // mint is now bound at runtime
    acc_info_pda_isc_ata.key,
    acc_info_initializer.key,
    &[acc_info_initializer.key],
    amount,
    isc_mint.decimals,
)?;
```

```solidity
// evm/contracts/Swap.sol — assert the invariant once, at construction
constructor(address _xOilToken, address _nativeToken) {
    require(_xOilToken != address(0) && _nativeToken != address(0), "xOilSwap: zero address");
    require(_xOilToken != _nativeToken, "xOilSwap: identical tokens");
    require(
        IERC20Metadata(_xOilToken).decimals() == IERC20Metadata(_nativeToken).decimals(),
        "xOilSwap: decimals mismatch"
    );
    xOilToken = IERC20(_xOilToken);
    nativeToken = IERC20(_nativeToken);
    xOilSwapAddress = address(this);
}
```

If the decimals are intentionally different, the swap must scale explicitly
(`out = amount * 10^decOut / 10^decIn` in `u128`, rounding **towards the pool**) rather than pass
`amount` through unchanged.

---

#### [F-002] Live private key material committed to the repository

| Field | Value |
|---|---|
| **Severity** | 6 — 🟡 MEDIUM · `[UNDETERMINED]` · impact 10 if the Solana key holds any on-chain authority or balance |
| **Checklist Item** | OPS-028, OPS-036, OPS-062, OPS-068, GL-020, GL-029, GL-064, FV-045 |
| **Category** | Key Management / Secrets |
| **Language** | JSON (configuration consumed by the in-scope deployment/operation of the program) |
| **File** | `web-client/config/config.json:6`, `:19`, `:31` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

Three private keys are committed in plaintext at the audited commit:

- `web-client/config/config.json:31` — a 64-element integer array, i.e. a complete ed25519
  **Solana secret key** in `Keypair.fromSecretKey` form. It is loaded at
  `web-client/scripts/solana-swap.mjs:42,47` and is the signer for every swap the client performs.
- `web-client/config/config.json:6` and `:19` — the EVM key
  `0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d`, the **same key reused for
  both EVM environments** (`evm0` and `evm1`).

There is **no root `.gitignore`** in the repository (only `evm/.gitignore`, which covers
`__pycache__`, `.env`, `build/` and `reports/` under `evm/` only), no secret-scanning configuration,
and no pre-commit hook. Because the repository has a single commit, the key material is in git
history by definition and deleting the file will not remove it.

**Impact:**

Anyone with read access to the repository holds the signing authority of these keys. For the Solana
key that means the ability to sign any transaction as that account — including, if that account is
the program's deploy/upgrade authority, replacing the program binary at
`7JAUAovyJHXsvqJkeXmjiTUpWTBADiFPagmkgj2Y2s47` with one that transfers both reserve ATAs to an
attacker (see F-004).

**Severity derivation (per Rule 1, likelihood axis).** We report **6**, not the KV-001 nominal 10,
on the strength of three cited mitigating facts: every RPC endpoint in the same file is
`http://localhost:*` (`:5`, `:18`, `:30`); the EVM key is the well-known Ganache/Hardhat
deterministic test key, which has no production value; and the Brownie configuration targets a local
`ganache-cli` with the `brownie` mnemonic (`evm/brownie-config.yaml:11-17`). Together these are
strong evidence of a local development harness. They are **not proof**: the Solana key's on-chain
role could not be checked (no RPC access in this engagement), so its balance and authorities are
unknown. Extent not determined within this assessment. **If that keypair is, or ever was, the
upgrade authority or a funded account on any public cluster, this is a severity-10 finding.**

**Rule 5b — Reachability:**

```
- Entry point: the file is git-tracked at commit 81ae372 and readable by anyone with repository
  access; no decryption or exploitation step is required
- Signer / authority required: none — reading a file
- Preconditions: repository access (the repo carries no licence or access restriction marker;
  Q12 default = public)
- Guard analysis: no root .gitignore exists; no secret scanner, no pre-commit hook, no CI secret
  check (there is no CI at all). Nothing would have prevented the commit and nothing detects it now.
- Verdict: REACHABLE
```

**Rule 5b — Math / State-Bounds:**

```
- Vulnerable state: a complete ed25519 private key in plaintext @ web-client/config/config.json:31
- Input domain: n/a — the secret is static, not derived from input
- Boundary that breaks: any value or authority currently held by the corresponding public key
- Worked case: could not be computed. Deriving the public key requires executing ed25519 key
  derivation, and confirming its holdings requires an RPC query; both are outside a static,
  read-only, network-isolated engagement.
- Net effect: UNQUANTIFIED. Bounded below by "a local test key with no value" and above by
  "full control of the program's upgrade authority and therefore of both reserves."
```

**Proof of Concept:**

```
1. Clone the repository at 81ae372.
2. Read web-client/config/config.json:31 -> a 64-byte secret key array.
3. Keypair.fromSecretKey(Uint8Array.from(thatArray))  // exactly what solana-swap.mjs:42,47 does
4. The attacker now signs as that account: any token it holds is transferable, and any
   authority it holds (upgrade authority, mint authority, freeze authority) is exercisable.
   Step 4's payoff depends on the account's on-chain state, which this assessment could not read.
```

**Recommendation:**

1. **Rotate all three keys now**, treating them as compromised, before any other remediation. For
   the Solana key: if it holds the program's upgrade authority, run
   `solana program set-upgrade-authority <PROGRAM_ID> --new-upgrade-authority <new multisig>`;
   move any balance; revoke any mint/freeze authority it holds.
2. Replace the committed literals with environment indirection and fail fast when absent:

```js
// web-client/config/config.json — remove the privateKey fields entirely, then:
const secret = process.env.SOLANA_SECRET_KEY;
if (!secret) throw new Error("SOLANA_SECRET_KEY is required");
this.keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
```

3. Add a root `.gitignore` covering `.env`, `.env.*`, `*.pem`, `*keypair*.json`, `id.json`,
   `node_modules/`, `target/`, `build/`.
4. Add a pre-commit secret scanner (`gitleaks`, `detect-secrets`) and enable GitHub secret scanning
   + push protection on the remote.
5. Because the keys are in the only commit, purge history (`git filter-repo --path
   web-client/config/config.json --invert-paths`, then force-push) **after** rotation — rotation is
   what actually closes the exposure; history rewriting is hygiene.

---

#### [F-003] `ISCToken` owner can mint without bound and pause the entire bridge

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM (impact 8, capped by "privilege required" per Rule 1) |
| **Checklist Item** | ECON-048, GL-013, GL-021, OPS-082, KV-030, KV-008 |
| **Category** | Access Control / Centralisation |
| **Language** | Solidity |
| **File** | `evm/contracts/ISC.sol:14-24`, `:26-32` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

`ISCToken` is `Ownable` (`ISC.sol:9`) and exposes three owner-only powers with no cap, no timelock,
no multisig requirement and no event beyond the ERC-20 default:

- `mint(address to, uint256 amount)` (`:22-24`) — unbounded. There is no `MAX_SUPPLY`, no per-call
  ceiling, no rate limit, and the amount is a raw owner-chosen argument, not derived from any
  deposit or collateral.
- `pause()` (`:14-16`) — combined with `_beforeTokenTransfer`'s `whenNotPaused` modifier (`:26-32`),
  this halts **every** ISC transfer, including the `Swap` contract's own legs
  (`Swap.sol:52-53`) and any bridge settlement.
- Ownership transfer via OpenZeppelin `Ownable` — single-step (`transferOwnership`), so a mistyped
  address permanently loses control; there is no `pending_owner` handshake (OPS-078).

The constructor's initial mint is commented out (`:11`), so supply starts at zero and *all* ISC in
existence originates from `mint()`.

**Impact:**

For a token named "International Stable Currency" that backs a bridge's reserves, the owner can
issue unlimited unbacked ISC and swap it 1:1 through `Swap` for the pooled xOil — draining the
bridge's counter-asset — or freeze the entire EVM leg indefinitely, stranding user funds mid-bridge
with no expiry and no user-side escape hatch.

**Severity derivation.** Impact is 8 (full drain of the EVM pool's xOil reserve, or an indefinite
freeze of user funds). Reported at **5** because the path is role-gated: it requires the `Ownable`
owner key, which the trust model (intake §6) records as a trusted actor. A permissionless variant
would be 8-9. Note this is *documented centralisation*, not a hidden backdoor — but the repository
contains no governance document, no multisig configuration and no timelock, so nothing constrains
the owner beyond convention.

**Proof of Concept:**

```
Actor:      the ISCToken Ownable owner (single address; custody unknown — see F-004)
Capability: one signature
1. owner calls ISCToken.mint(attacker, 1e30)         // ISC.sol:22 — no cap, no timelock
2. attacker calls ISCToken.approve(swapAddress, 1e30)
3. attacker calls Swap.swap(xOilReserveBalance, false) // Swap.sol:49, nativeToken -> xOil
   The modifier at Swap.sol:33-36 only checks the pool HAS that much xOil; it never questions
   where the ISC came from.
4. The pool's entire xOil reserve is now the attacker's, backed by ISC minted from nothing.

Alternative, no minting required:
1. owner calls ISCToken.pause()                       // ISC.sol:14
2. Every ISC transfer reverts at ISC.sol:26-32, including Swap.sol:52-53 and any in-flight
   bridge settlement. There is no unpause deadline and no user-side override.
```

**Recommendation:**

```solidity
// evm/contracts/ISC.sol
contract ISCToken is ERC20, ERC20Burnable, Pausable, Ownable2Step {
    uint256 public constant MAX_SUPPLY = 100_000_000e18;   // pick and document the real cap
    uint256 public constant MAX_PAUSE_DURATION = 7 days;
    uint256 public pausedAt;

    event Minted(address indexed to, uint256 amount, uint256 newTotalSupply);

    function mint(address to, uint256 amount) public onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "ISC: cap exceeded");
        _mint(to, amount);
        emit Minted(to, amount, totalSupply());
    }

    function pause() public onlyOwner { pausedAt = block.timestamp; _pause(); }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        // auto-expire the pause so users are never frozen indefinitely
        require(!paused() || block.timestamp > pausedAt + MAX_PAUSE_DURATION, "ISC: paused");
        super._beforeTokenTransfer(from, to, amount);
    }
}
```

Additionally: transfer ownership to a ≥ 2-of-3 multisig (Safe) fronted by a ≥ 24 h timelock, and
publish the owner address and its signer set.

---

#### [F-004] Program upgrade authority, deploy process and build reproducibility are entirely undocumented

| Field | Value |
|---|---|
| **Severity** | 5 — 🟡 MEDIUM · `[UNDETERMINED]` on the live authority |
| **Checklist Item** | OPS-006, OPS-007, OPS-008, OPS-010, OPS-011, OPS-026, OPS-037, OPS-053, OPS-054, OPS-061, OPS-062, OPS-063, OPS-071, AV-010, ECON-043, KV-020, KV-091 |
| **Category** | Governance / OpSec |
| **Language** | Rust / repository-wide |
| **File** | repository-wide; `solana/src/lib.rs:33`; absent artefacts |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

The repository contains **no** governance or deployment artefact of any kind:

- no `Anchor.toml`, no deploy script, no `solana program deploy` / `set-upgrade-authority`
  invocation anywhere in the tree;
- no multisig configuration (no Squads, no Realms, no Safe descriptor);
- no timelock — on-chain or as a written policy;
- no `rust-toolchain.toml`, no Docker build, no `solana-verify` configuration, no release artefact,
  so the deployed binary at `7JAUAovyJHXsvqJkeXmjiTUpWTBADiFPagmkgj2Y2s47` cannot be tied to this
  source;
- no CI (`.github/` does not exist), so deployment is necessarily manual from a developer machine —
  and the only key material in the repository is plaintext (F-002);
- no `SECURITY.md`, no upgrade-notification channel, no documented emergency-upgrade procedure;
- the git history is a single squashed commit, so change provenance cannot be reviewed.

The program's declared ID (`lib.rs:33`) does match the client configuration
(`web-client/config/config.json:35`), which is the one positive signal here.

**Impact:**

Whoever holds the upgrade authority can replace the program with a binary that signs for the
`["oolaa"]` PDA (`processes.rs:68-69`) and transfers both reserve ATAs anywhere. This is inherent to
an upgradeable program — the finding is that **nothing in the system bounds, delays, distributes or
even discloses that power**. Users have no way to know who holds it, no timelock window in which to
exit, and no event to monitor.

**Severity derivation.** `QUESTIONS.md` prescribes "Q11 = single wallet ⇒ auto-flag Severity 8+".
We deliberately do **not** apply that rule mechanically, because its premise — that the authority
*is* a single wallet — could not be confirmed: `solana program show` requires network access, which
this engagement does not have. Applying an 8 on an unconfirmed premise would be over-reporting
(Rule 5b). We instead report the **verifiable** deficiency — the complete absence of governance
documentation, timelock, multisig and verifiable build — at **5**. **If the live upgrade authority
is a single hot wallet, this escalates to 8; if it is the keypair committed at
`web-client/config/config.json:31` (F-002), it is 10.** Extent not determined within this
assessment.

**Proof of Concept:**

```
Actor:      whoever currently holds the BPF Upgradeable Loader authority for
            7JAUAovyJHXsvqJkeXmjiTUpWTBADiFPagmkgj2Y2s47 (identity unknown)
Capability: one `solana program deploy --program-id <ID> malicious.so`
1. Author a binary whose SwapIscToOil handler ignores the inbound leg and instead
   invoke_signed()s both reserve ATAs to an attacker address using seeds ["oolaa", bump] —
   the same seeds at processes.rs:182, which any binary deployed at this program ID can sign for.
2. Deploy it. There is no timelock, so it is live in one slot.
3. Call the instruction once. Both reserves are gone.

No user-visible warning precedes step 2: the program emits no upgrade event, the repository
publishes no authority address to watch, and no monitoring exists (F-013).
```

**Recommendation:**

1. Run `solana program show 7JAUAovyJHXsvqJkeXmjiTUpWTBADiFPagmkgj2Y2s47` and publish the current
   authority in `README.md`.
2. Move the authority to a ≥ 2-of-3 Squads multisig whose signers are distinct entities on hardware
   wallets; then front it with a ≥ 24 h timelock (72 h is the recommended figure for bridge
   infrastructure, per OPS-008).
3. Add a reproducible build: commit `rust-toolchain.toml`, build with `solana-verify build`, and
   publish the verified build hash so anyone can confirm the deployed binary matches this source.
4. Document the deploy and emergency-upgrade runbook (who, what quorum, what notice period) and add
   a `SECURITY.md` with a disclosure contact.
5. Once the program is stable, consider freezing it (`--final`) — for a contract this small and this
   parameter-free, immutability is a realistic end state and removes the single largest risk in this
   report.

---

#### [F-005] Duplicated owner check leaves the caller's OIL token account's program ownership unvalidated

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW · `[PARTIAL]` — real validation gap, direct exploitation blocked downstream |
| **Checklist Item** | AV-001, AV-046, AV-052, AV-058, AV-078, AV-082, CPI-012, ECON-036, KV-010, KV-015, KV-016, KV-109 |
| **Category** | Account Validation / Type Safety |
| **Language** | Rust (native Solana) |
| **File** | `solana/src/processes.rs:60`, `solana/src/processes.rs:231` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

Each handler validates the caller's two token accounts in a matched pair of blocks. The ISC block is
correct — it checks the deserialized `.owner` field (`:43`), the `.mint` field (`:46`), and the
account's **owning program** (`:49`). The OIL block that follows checks `.owner` (`:54`) and `.mint`
(`:57`) — but its third check is a copy-paste of the first block's:

```rust
// processes.rs:49  — ISC block, correct
if *acc_info_initializer_isc_ata.owner != spl_token::id() { ... }
...
// processes.rs:60  — OIL block, re-tests the ISC account
if *acc_info_initializer_isc_ata.owner != spl_token::id() { ... }
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ should be acc_info_initializer_oil_ata
```

The identical defect appears in `swap_oil_to_isc` at `:220` / `:231`. Consequently
`acc_info_initializer_oil_ata` is deserialized by this program (`:53`, `:224`) with **no check that
it is owned by the SPL Token program at all** — its `owner` and `mint` fields are read from whatever
bytes the caller's account happens to contain. In `swap_oil_to_isc` that unvalidated account is the
**source** of a value-moving transfer (`:324`).

This is the canonical Solana "missing owner check" (Sealevel attack #2; Neodyme's top pitfall), and
in a native program it is entirely manual — there is no `Account<'info, TokenAccount>` to do it for you.

**Impact:**

`[PARTIAL]` — we could not construct a working exploit, and we state why. An attacker can forge the
`owner` and `mint` bytes of a 165-byte account they control so that this program's checks at `:54`
and `:57` pass. However, that forged account is then handed to the SPL Token program as a transfer
source or destination (`:172`, `:324`), and the Token program — backed by the Solana runtime's rule
that a program may not modify an account it does not own — rejects it. The residual security of this
path therefore rests **entirely on the callee's validation**, not on this program's. That is a real
defense-in-depth failure: it is one dependency change (a token-program fork, a Token-2022 path, a
future refactor that reads `user_oil_account.amount` before transferring) away from becoming
exploitable, and the ISC block proves the author intended the check to be there.

Severity 4, not higher: no exploit path was proven (Rule 5b requires the downgrade), and the
mitigating guard is cited above.

**Proof of Concept:**

```
Actor:      permissionless caller
1. Eve deploys a trivial program P and creates account F (165 bytes, owner = P) whose bytes
   spell a valid spl_token::state::Account: mint = OIL, owner = Eve, amount = 0, state = 1.
2. Eve calls SwapOilToIsc { amount: N } passing F as acc_info_initializer_oil_ata.
3. processes.rs:224  TokenAccount::unpack_from_slice(F) succeeds — F is 165 bytes.
   processes.rs:225  F.owner == Eve            -> passes (Eve wrote those bytes)
   processes.rs:228  F.mint  == OIL            -> passes (Eve wrote those bytes)
   processes.rs:231  checks acc_info_initializer_isc_ata.owner, NOT F.owner -> the gap
4. processes.rs:322-335 hands F to spl_token::transfer as the source.
   >>> The SPL Token program rejects it (F is not owned by the Token program), so the
       transaction fails. Eve gains nothing TODAY. The program's own gate, however,
       did not stop her — the callee did.
```

**Recommendation:**

```rust
// solana/src/processes.rs:60  (and the identical site at :231)
-    if *acc_info_initializer_isc_ata.owner != spl_token::id() {
+    if *acc_info_initializer_oil_ata.owner != spl_token::id() {
         return Err(ProgramError::IncorrectProgramId)
     }
```

Better still, factor the repeated block into one helper so the two call sites cannot drift again:

```rust
fn load_user_token_account(
    acc: &AccountInfo,
    expected_owner: &Pubkey,
    expected_mint: &Pubkey,
) -> Result<TokenAccount, ProgramError> {
    if *acc.owner != spl_token::id() {
        return Err(ProgramError::IncorrectProgramId);
    }
    let ta = TokenAccount::unpack(&acc.try_borrow_data()?)?;   // Pack::unpack — see F-009
    if ta.owner != *expected_owner { return Err(TokenError::OwnerMismatch.into()); }
    if ta.mint != *expected_mint  { return Err(TokenError::MintMismatch.into()); }
    if ta.state != AccountState::Initialized { return Err(ProgramError::UninitializedAccount); }
    Ok(ta)
}
```

Note the helper also fixes the wrong error code at `:47`/`:58`, where a **mint** mismatch is reported
as `TokenError::OwnerMismatch` (see F-010).

---

#### [F-006] A zero lamport balance is used as an account-existence oracle — one lamport bricks the pool's first swap

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW (impact 6, downgraded: recoverable at bounded cost, per Rule 1) |
| **Checklist Item** | AV-085, AV-087, AC-039, ECON-056, KV-123, KV-127, KV-107 |
| **Category** | DoS / Griefing |
| **Language** | Rust (native Solana) |
| **File** | `solana/src/processes.rs:101-102`, `:126-127`, `:273-274`, `:296-297` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

The program decides whether the PDA's reserve ATA needs creating by reading its lamport balance:

```rust
// processes.rs:101-102
let pda_isc_ata_lamports = **acc_info_pda_isc_ata.try_borrow_lamports()?;
if pda_isc_ata_lamports == 0 {
    // ... create_associated_token_account CPI
} else {
    msg!("ISC ATA for PDA exists");     // <-- "has lamports" is treated as "is a usable ATA"
}
```

Lamports can be sent to **any** address permissionlessly — a System-program transfer needs no
signature from the recipient, and the ATA address is publicly derivable
(`get_associated_token_address(pda, mint)`, `:74`). So `lamports != 0` does not imply "this account
exists as an initialized token account"; it only implies "someone funded this address."

The `else` branch performs no validation whatsoever: the account's owner, data length, `state` and
mint are never checked before it is used as a transfer endpoint at `:155` / `:171`.

**Impact:**

Before the reserve ATAs are first created, anyone can send **1 lamport** to either ATA address. Every
subsequent swap then takes the `else` branch, skips creation, and fails at the transfer CPI because
the target is a bare system-owned account with no token data. Both swap directions are dead — the
pool is unusable.

**Severity derivation.** Impact is 6 (complete liveness DoS on a value-moving protocol) for a cost
of 1 lamport. Downgraded to **4** on the "recoverable / self-healing" lever: the block is repairable
by *anyone* in a single out-of-band transaction, because
`spl_associated_token_account`'s `create_pda_account` helper explicitly handles a pre-funded target
(it tops up the rent difference, then `allocate`s and `assign`s). So a permissionless caller can
invoke the ATA program directly to create the account, after which the brick is gone permanently and
cannot be re-applied. The window is therefore "until someone notices," not "forever" — but nothing
in the repository documents this, and there is no monitoring to notice it (F-013).

**Proof of Concept:**

```
Actor:      any wallet with ~0.000000001 SOL (permissionless)
Timing:     any time before the PDA's ISC or OIL ATA has been created
1. Eve derives pda = find_program_address(["oolaa"], 7JAU...)     // processes.rs:68-69
   Eve derives ata = get_associated_token_address(pda, ISC)        // processes.rs:74
2. Eve sends 1 lamport to `ata` with a plain SystemProgram.transfer. No signature from
   anyone else is required; the account now exists as a 0-byte system-owned account.
3. Alice calls SwapIscToOil.
   processes.rs:101  lamports = 1, so `== 0` is false
   processes.rs:121  the else branch logs "ISC ATA for PDA exists" and creates nothing
   processes.rs:162  invoke(transfer -> ata) fails: the destination is not a token account
   Alice's transaction reverts. So does every other swap, in both directions.
Quantified outcome: total protocol liveness DoS for 1 lamport, until someone independently
calls the ATA program to create the account.
```

**Recommendation:**

Test for what actually matters — that the account is an initialized SPL token account of the right
mint and authority — rather than for a nonzero balance:

```rust
// solana/src/processes.rs — replace the lamport probe at :101-123 (and :126-146, :273-293, :296-316)
let needs_creation = acc_info_pda_isc_ata.data_is_empty()
    || *acc_info_pda_isc_ata.owner != spl_token::id();

if needs_creation {
    // create_associated_token_account handles a lamport-primed address correctly
    invoke(&ix, &[...])?;
}

// then ALWAYS validate, whether we just created it or it already existed:
let pda_isc = TokenAccount::unpack(&acc_info_pda_isc_ata.try_borrow_data()?)?;
if pda_isc.mint != isc_pubkey || pda_isc.owner != pda {
    return Err(ProgramError::InvalidAccountData);
}
if pda_isc.state != AccountState::Initialized {
    return Err(ProgramError::UninitializedAccount);   // catches the frozen case too — see F-007
}
```

A cleaner alternative for a pool with exactly two fixed reserves: create both ATAs once in a
dedicated permissionless `initialize_reserves` instruction and have the swap handlers simply
*require* them, removing the branch entirely.

---

#### [F-007] No pause, no recovery path, and no freeze-authority inspection for the custodied reserves

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW (impact 6, downgraded: requires mint-authority privilege or an adverse external event) |
| **Checklist Item** | AV-050, AV-064, AV-065, AC-030, AC-035, AC-036, EXT-013, ECON-047, ECON-056, ECON-072, ECON-074, ECON-082, ECON-089, OPS-045, FV-057, KV-019 |
| **Category** | Availability / Economic Controls |
| **Language** | Rust (native Solana) + Solidity |
| **File** | `solana/src/processes.rs:17-186`, `:188-356`; `evm/contracts/Swap.sol:8-56` |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

The PDA custodies the protocol's entire Solana-side liquidity in two ATAs, and the `Swap` contract
does the same on EVM. Neither has any control surface:

- **No pause.** There is no `paused` flag, no guardian, no circuit breaker (AC-030/AC-035). The
  program has exactly two instructions and both are unconditionally live (`lib.rs:20-30`).
- **No admin withdrawal or sweep.** The reserves' *only* exit is the 1:1 swap, which requires a
  counterparty holding the opposite token (ECON-082). `Swap.sol` likewise has no deposit or
  withdraw function — tokens sent to it are permanently committed.
- **No freeze-authority inspection.** Neither mint's `freeze_authority` is ever read (the mint
  accounts are only compared by address at `:81-86`), and neither the reserve ATAs nor the caller's
  accounts are checked for `AccountState::Frozen` (AV-050). `Pack::unpack_from_slice` (`:42`, `:53`)
  actively skips the state check that `Pack::unpack` would perform (F-009).
- **No aggregate outflow cap.** A single call can move the entire counter-token reserve
  (ECON-072/ECON-089). This is benign while the peg holds — the caller pays full 1:1 value — but it
  means F-001 or a peg break has no backstop.

The `README.md:5` design claim — "limited controlled exposure to ISC in the event of a bridge hack" —
is implemented **only** as an implicit cap (the reserve's own size, maintained out of band). No
on-chain limit expresses it.

**Impact:**

Three concrete failure modes with no on-chain remedy:

1. If either mint's freeze authority is live and is used (or compromised) to freeze a PDA reserve
   ATA, **both** swap directions fail permanently and the *other*, unfrozen reserve becomes
   unreachable — it can only leave via a swap that now always reverts.
2. If one of the two tokens becomes worthless or its supply is inflated (F-003), there is no pause
   to stop the pool from honouring 1:1 swaps into the healthy asset until it is empty.
3. Any funds mistakenly sent to the PDA's ATAs, or left stranded after the counter-token is
   exhausted, cannot be recovered by anyone.

**Severity derivation.** Impact 6 (permanent loss of access to custodied funds). Downgraded to **4**:
mode 1 requires the mint's freeze-authority privilege (Rule 1 "privilege required"), mode 2 requires
the `ISCToken` owner key (already counted in F-003), and mode 3 is bounded by whatever was
mistakenly sent. Note also the genuine upside of this design: the *absence* of an admin withdrawal
path means there is no rug vector through the program itself — the only privileged escape is the
upgrade authority (F-004). The recommendation below must not undo that property.

**Proof of Concept:**

```
Actor:      the freeze authority of either the ISC or the OIL mint (a privileged external party)
1. Authority calls spl_token FreezeAccount on get_associated_token_address(pda, OIL).
2. Any subsequent SwapIscToOil fails: processes.rs:179 transfers OUT of the frozen ATA ->
   TokenError::AccountFrozen.
   Any subsequent SwapOilToIsc fails: processes.rs:332 transfers INTO the frozen ATA -> same.
3. The PDA's ISC reserve is now permanently stranded: its only exit (processes.rs:339-353)
   is reachable only from SwapOilToIsc, which can no longer complete step 2.
Quantified outcome: 100% of the ISC reserve is locked, indefinitely, with no on-chain recovery
instruction in the program and no way to add one except a program upgrade (F-004).
```

**Recommendation:**

```rust
// 1. Reject frozen accounts explicitly, on every account the program touches:
if pda_oil.state != AccountState::Initialized {          // Frozen and Uninitialized both fail
    return Err(TokenError::AccountFrozen.into());
}

// 2. Validate the mints once, at the top of each handler, and refuse a live freeze authority
//    (or allowlist the authority explicitly and document the trust assumption):
let oil_mint = Mint::unpack(&acc_info_oil.try_borrow_data()?)?;
if oil_mint.freeze_authority.is_some() {
    msg!("WARNING: OIL mint has a live freeze authority");   // or hard-fail, per your trust model
}
```

Then add, as new instructions:

- an `emergency_pause` gated by a **guardian** authority held separately from the upgrade authority,
  which blocks both swap directions;
- a `rescue_reserves` path gated by that same guardian **plus** a timelock, so a frozen or stranded
  reserve can be recovered without a program upgrade — accepting that this reintroduces a privileged
  exit and must therefore be multisig-controlled, timelocked, and announced on-chain;
- a rolling per-window outflow cap on each reserve (ECON-089), so no single transaction or short
  burst can empty a reserve regardless of whether the cause is a bug, a peg break or a signed action.

On the EVM side, mirror all three in `Swap.sol` (it currently has neither an owner nor a pause).

---

#### [F-008] No tests, no CI, no static analysis and no fuzzing for a program that custodies pooled liquidity

| Field | Value |
|---|---|
| **Severity** | 4 — 🔵 LOW (engineering-maturity gap; no direct exploit) |
| **Checklist Item** | FV-001 to FV-008, FV-013, FV-015 to FV-020, FV-023, FV-024, FV-031, FV-033 to FV-040, FV-043, FV-059, FV-064 to FV-067, FV-071 |
| **Category** | Verification / Testing |
| **Language** | Rust + Solidity (repository-wide) |
| **File** | repository-wide (absent artefacts) |
| **Status** | Open |
| **Evidence tier** | `[PoC-PROSE]` |

**Description:**

The repository contains **zero** verification of any kind. Confirmed by enumeration over all 24
tracked files:

- no `#[test]`, no `#[cfg(test)]`, no `tests/` directory, no Brownie test file, no `.ts` test;
- no `.github/` directory — therefore no CI, no PR gate, no automated anything;
- no Clippy, ESLint, Slither, solhint, Semgrep or `cargo-audit` configuration;
- no fuzzing (no Trident, no `cargo-fuzz`, no proptest) and no property tests;
- no LiteSVM or Mollusk harness — nothing ever loads the compiled `.so`;
- no documented invariant anywhere in code, comments or `README.md`;
- no coverage measurement, no mutation testing, no CU-consumption baseline.

**Impact:**

Every finding in this report would have been caught cheaply by a basic suite. Specifically: the
duplicated owner check (F-005) dies to a single negative test that passes a wrong-owner account; the
lamport-existence brick (F-006) dies to a LiteSVM test that pre-funds the ATA address; the decimals
assumption (F-001) dies to a test that mints the two tokens with different decimals; the decoder
panic (F-010) dies to a one-line fuzz target. More importantly, there is currently **no regression
barrier at all** — any future change to a program that signs for the bridge's reserves ships
unverified.

**Proof of Concept:**

```
Not an attacker scenario — a coverage measurement:
  instruction handlers in the program                : 2   (lib.rs:22, :26)
  handlers with at least one test                    : 0
  negative tests (unsigned caller, wrong mint, ...)  : 0
  edge-case tests (amount = 0, amount = u64::MAX)    : 0
  CI jobs that would block a regression              : 0
```

**Recommendation:**

Start with the highest-value five tests, using LiteSVM or Mollusk against the real compiled `.so`:

```rust
// solana/tests/swap.rs  (LiteSVM)
#[test] fn rejects_unsigned_caller()            { /* is_signer = false  -> MissingRequiredSignature */ }
#[test] fn rejects_wrong_mint_token_account()   { /* user account of a third mint -> error          */ }
#[test] fn rejects_non_token_program_account()  { /* the F-005 gap: fake OIL account must be refused */ }
#[test] fn survives_lamport_primed_reserve_ata() { /* the F-006 brick: 1 lamport, swap must succeed  */ }
#[test] fn conserves_value_across_a_round_trip() {
    // swap_isc_to_oil(x) then swap_oil_to_isc(x): every balance returns to its start value.
    // This is the token-conservation invariant (FV-006) and it also pins the 1:1/decimals
    // assumption behind F-001.
}
```

Then add:

1. A fuzz target over `SwapInstruction::unpack` (`instructions.rs:15`) — arbitrary bytes must return
   `Err`, never panic (F-010).
2. A minimal GitHub Actions workflow running `cargo clippy -- -D warnings`, `cargo build-sbf`,
   `cargo test`, `cargo audit`, plus `slither evm/contracts/` — gating merges to `main`.
3. Document the protocol's three invariants in `README.md` and assert each in a test: (i) a swap
   conserves total value; (ii) the PDA is the only authority over the reserves; (iii) one raw unit
   of ISC equals one raw unit of OIL.

---

#### [F-009] `Pack::unpack_from_slice` bypasses the length and initialization checks and panics on short data

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | AV-054, AV-080, AV-082, AV-088, KV-109 |
| **Category** | Deserialization / DoS |
| **Language** | Rust (native Solana) |
| **File** | `solana/src/processes.rs:42`, `:53`, `:213`, `:224` |
| **Status** | Open |

**Description:** All four caller-token-account reads use
`TokenAccount::unpack_from_slice(&acc.try_borrow_data()?)`. `unpack_from_slice` is the raw layout
decoder; the safe entry point is `Pack::unpack`, which additionally (a) rejects data whose length is
not exactly `Account::LEN` (165) and (b) rejects an account whose `state` is `Uninitialized`. Calling
the raw decoder directly skips both. Its `array_ref![src, 0, 165]` **panics** when the buffer is
shorter than 165 bytes, so a caller passing any small account (a fresh system account, a `Mint` at 82
bytes) aborts the program instead of receiving `InvalidAccountData`.

**Impact:** Self-inflicted only — the panicking transaction is the caller's own, so this is a
correctness and error-quality issue rather than an exploitable DoS. The skipped `is_initialized`
check is currently masked because a zeroed token account has `owner == Pubkey::default()`, which
fails the check at `:43`. Combined with F-005 (no owning-program check on the OIL account), the two
gaps mean one of the four reads has *no* structural validation at all before its fields are trusted.

**Recommendation:**

```rust
-let user_isc_account = TokenAccount::unpack_from_slice(&acc_info_initializer_isc_ata.try_borrow_data()?)?;
+let user_isc_account = TokenAccount::unpack(&acc_info_initializer_isc_ata.try_borrow_data()?)?;
```

Apply at all four sites (`:42`, `:53`, `:213`, `:224`), ideally via the shared helper proposed in
F-005.

---

#### [F-010] `.unwrap()` on attacker-controlled instruction data, and generic error codes throughout

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | FV-049, FV-055, FV-031 |
| **Category** | Error Handling |
| **Language** | Rust (native Solana) |
| **File** | `solana/src/instructions.rs:17`; `solana/src/processes.rs:47`, `:58`, `:71-97` |
| **Status** | Open |

**Description:** Two related error-handling defects.

1. `SwapPayload::try_from_slice(payload).unwrap()` (`instructions.rs:17`) decodes fully
   attacker-controlled bytes and `unwrap()`s the result. Any instruction data that is not exactly one
   selector byte followed by eight little-endian bytes panics the program instead of returning
   `ProgramError::InvalidInstructionData` — which the very next lines (`:18-22`) are careful to
   return for an unknown selector. `Pubkey::from_str(ISC).unwrap()` (`:32`, `:203`) is safe by
   contrast: its input is a compile-time constant.
2. Error codes are uninformative and in two places wrong. Eight distinct validation failures all
   return the same `ProgramError::InvalidArgument` (`processes.rs:71`, `:75`, `:78`, `:82`, `:85`,
   `:89`, `:93`, `:97`), so an on-chain failure cannot be attributed to a specific check. And a
   **mint** mismatch is reported as `TokenError::OwnerMismatch` (`:47`, `:58`, `:218`, `:229`),
   actively misdirecting whoever debugs it.

**Impact:** No fund risk — a panic aborts only the caller's own transaction. The cost is operational:
failures are indistinguishable, which slows incident response (F-013) and makes the negative tests
recommended in F-008 harder to write meaningfully.

**Recommendation:**

```rust
// solana/src/instructions.rs:17
-let payload = SwapPayload::try_from_slice(payload).unwrap();
+let payload = SwapPayload::try_from_slice(payload)
+    .map_err(|_| ProgramError::InvalidInstructionData)?;
```

Define a program-specific error enum implementing `Into<ProgramError>` with one variant per check
(`InvalidPdaAddress`, `InvalidIscMint`, `InvalidOilMint`, `InvalidTokenProgram`, …) and return
`TokenError::MintMismatch` where a mint — not an owner — failed to match.

---

#### [F-011] No structured event emission for financial operations

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | SM-047, SM-048, SM-049, SM-050, OPS-048, KV-122 |
| **Category** | Monitoring / Observability |
| **Language** | Rust (native Solana) |
| **File** | `solana/src/lib.rs:24`, `:28`; `solana/src/processes.rs:35-184` |
| **Status** | Open |

**Description:** Every value-moving operation is recorded only as free-text
`msg!("Swapped {} ISC to OIL", amount)` (`lib.rs:24`, `:28`). There is no `sol_log_data`, no
Anchor-style event, no CPI-event. The log line carries **only the amount** — not the caller, not the
direction's account addresses, not the resulting reserve balances. The remaining `msg!` calls
(`processes.rs:35`, `:103`, `:110`, `:120`, …) are control-flow trace markers, not audit records.

By contrast the EVM leg does this correctly: `swap_event(address indexed caller, uint256 amount,
bool indexed toNativeToken)` (`Swap.sol:19`, emitted at `:54`).

**Impact:** An off-chain indexer or monitor cannot reconstruct protocol activity from logs; it must
re-parse each transaction's account list to learn who swapped. And because the output is untyped
free text, any other program can print an identical line, so a log-scraping consumer has no
program-bound proof (KV-122). This directly blocks the monitoring recommended in F-013 — there is
nothing structured to alert on.

**Recommendation:**

```rust
// solana/src/processes.rs — emit a typed, program-bound record after the second transfer
use solana_program::log::sol_log_data;

#[derive(BorshSerialize)]
struct SwapEvent {
    direction: u8,          // 0 = ISC->OIL, 1 = OIL->ISC
    initializer: Pubkey,
    amount: u64,
    pda_isc_balance_after: u64,
    pda_oil_balance_after: u64,
}
sol_log_data(&[&event.try_to_vec()?]);
```

Consumers must still verify the fact against finalized account state rather than trusting the log
(KV-122 step 2) — the event is a fast path, not proof.

---

#### [F-012] Both reserve ATAs are global write-locked singletons on every swap

| Field | Value |
|---|---|
| **Severity** | 2 — ⚪ INFO (hardening; no time-critical path exists to starve) |
| **Checklist Item** | KV-131 |
| **Category** | Throughput / Liveness |
| **Language** | Rust (native Solana) |
| **File** | `solana/src/processes.rs:155`, `:171`, `:325`, `:341` |
| **Status** | Open |

**Description:** Every swap, in either direction, takes a write lock on the same two accounts — the
PDA's ISC ATA and OIL ATA. Under Sealevel these transactions cannot execute in parallel; they
serialise into a single queue, and under local fee markets (SIMD-0110) the priority-fee auction for
that queue is scoped to those two accounts, so a griefer can bid against pool users specifically
without congesting the network.

**Impact:** A throughput ceiling and a cheap way to delay other users' swaps. It is **not** an
economic DoS here, because the program has no liquidation, settlement, auction, expiry or
first-to-act path whose value depends on winning a race — a delayed swap is simply a later swap at
the same fixed 1:1 rate. This is why the finding sits at severity 2 rather than KV-131's nominal 6.

**Recommendation:** Architectural, and only worth doing if throughput becomes a real constraint:
shard the reserves across N PDAs (`["oolaa", shard_index]`) so concurrent swaps touch different
accounts, and have the client pick a shard at random. Document the current single-queue behaviour so
operators are not surprised by it.

---

#### [F-013] No incident-response, monitoring or disclosure capability

| Field | Value |
|---|---|
| **Severity** | 3 — 🔵 LOW |
| **Checklist Item** | OPS-044, OPS-046, OPS-047, OPS-048, OPS-049, OPS-050, OPS-051, OPS-052, OPS-061 |
| **Category** | Operations / Incident Response |
| **Language** | repository-wide (absent artefacts) |
| **File** | repository-wide |
| **Status** | Open |

**Description:** The repository contains no `SECURITY.md`, no security contact, no bug-bounty
reference, no incident-response plan, no runbook, no war-room or post-mortem process, and no
monitoring or alerting configuration of any kind. There is no alert for large reserve movements, for
program-upgrade transactions, or for the reserve imbalance that would be the first visible symptom
of F-001. Combined with F-011 (no structured events to alert on) and F-004 (no published upgrade
authority to watch), the protocol has no way to detect an incident, and no channel through which a
finder could report one.

**Impact:** Detection and response time for any of the other twelve findings is unbounded. A
researcher who discovers an issue has no disclosure path and may publish instead.

**Recommendation:** Add `SECURITY.md` with a contact address and a disclosure policy. Stand up
balance monitoring on both reserve ATAs (alert on any movement above a threshold, and on any
reserve-ratio deviation) and on `solana program show` output for the program ID (alert on any
upgrade-authority or binary change). Write a one-page runbook naming who is called, in what order,
and who can execute the emergency actions recommended in F-007. Once the program handles real value,
open a bug bounty scoped to the two reserve ATAs.

---

### Findings by Severity (10 → 4)

#### Severity 10 — 🔴 CRITICAL
None.

#### Severity 9 — 🔴 CRITICAL
None.

#### Severity 8 — 🟠 HIGH
None.

#### Severity 7 — 🟠 HIGH
None.

#### Severity 6 — 🟡 MEDIUM
- **F-001** — Fixed 1:1 raw-unit swap with no decimal normalisation and no `transfer_checked` `[UNDETERMINED]`
- **F-002** — Live private key material committed to the repository `[UNDETERMINED]`

#### Severity 5 — 🟡 MEDIUM
- **F-003** — `ISCToken` owner can mint without bound and pause the entire bridge
- **F-004** — Program upgrade authority, deploy process and build reproducibility undocumented `[UNDETERMINED]`

#### Severity 4 — 🔵 LOW
- **F-005** — Duplicated owner check leaves the caller's OIL token account unvalidated `[PARTIAL]`
- **F-006** — Zero lamport balance used as an account-existence oracle
- **F-007** — No pause, no recovery path, no freeze-authority inspection
- **F-008** — No tests, no CI, no static analysis, no fuzzing

*(Severity 3 — F-009, F-010, F-011, F-013. Severity 2 — F-012. Full blocks above.)*

### Notes & Nitpicks

No security impact; not scored on the 1-10 scale (OUTPUT-RULES Rule 1).

- `solana/src/processes.rs:22`, `:64-66` — `acc_info_program` is required to equal `crate::id()` and
  is then never used. The check is harmless but meaningless: the executing program's identity is
  already `program_id`.
- `solana/src/processes.rs:29`, `:92-94` — `acc_info_assoc_token_prog` is validated but never
  forwarded to any CPI; `create_associated_token_account` (`:104`) embeds the program ID itself.
- `solana/src/processes.rs:121-123` vs `:293` — `swap_isc_to_oil` has an `else { msg!("ISC ATA for
  PDA exists") }` branch that `swap_oil_to_isc` omits. Cosmetic asymmetry between two otherwise
  identical blocks.
- `solana/src/processes.rs:17-186` and `:188-356` are ~95% duplicated. Factoring the shared
  validation into one helper would have prevented F-005 outright and halves the surface for future drift.
- `solana/src/processes.rs:32-33`, `:203-204` — `Pubkey::from_str(...).unwrap()` parses two constant
  base58 strings on every invocation. `solana_program::pubkey!("C2Jgz6…")` resolves at compile time
  and saves the CU.
- `solana/src/processes.rs:69`, `:240` — `find_program_address` is re-derived per call (~1,500 CU).
  Caching the canonical bump as a constant, validated once, would remove it.
- `solana/Cargo.toml:17` — `crate-type = ["cdylib", "lib"]` without a `no-entrypoint` feature means
  any crate depending on this one as a library links a second `entrypoint!` symbol.
- `solana/src/lib.rs:11`, `:15` — the entrypoint function is named `my_function`; `process_instruction`
  is the conventional name and is what tooling looks for.
- `solana/src/lib.rs:33` — `declare_id!` sits at the bottom of the file, below the entrypoint.
  Conventionally it goes at the top, next to the imports.
- `evm/contracts/Swap.sol:40-44` — the constructor accepts both token addresses with no zero-address,
  code-size or distinctness check, and no setter exists to correct a mistake afterwards.
- `evm/contracts/Swap.sol:29-32` — the `allowance` pre-check duplicates what `safeTransferFrom`
  enforces at `:52`; it costs gas and adds nothing.
- `evm/contracts/Swap.sol:13-14` — `xOilToken` / `nativeToken` are written only in the constructor
  but are not `immutable`, unlike `xOilSwapAddress` at `:11`.
- `evm/contracts/ISC.sol:2`, `Swap.sol:2` — `pragma solidity ^0.8.9` floats across all of 0.8.x; pin
  an exact version for reproducible bytecode.
- `evm/contracts/ISC.sol:11` — the constructor's `_mint` is commented out, so `ISCToken` deploys
  with zero supply. Intentional or not, it is undocumented.
- `evm/scripts/launch.py:1`, `:6` — imports and references `OILToken`, which **does not exist in
  `evm/contracts/`**. The EVM xOil implementation was unavailable for review (see §4.6).
- `README.md:5` states the architecture gives "limited controlled exposure to ISC in the event of a
  bridge hack." No on-chain mechanism implements that limit; it holds only for as long as an
  operator keeps the reserves small by hand. Worth stating explicitly in the README.
- `web-client/config/config.json:13`, `:25`, `:40` declare `decimals: 9` for all three chains, while
  `evm/contracts/ISC.sol` inherits OpenZeppelin's default of 18. Off-chain and out of scope, but it
  is corroborating evidence for F-001.
- `web-client/scripts/solana-swap.mjs:167`, `:175` compute `amount * (10 ** decimals)` in IEEE-754
  floating point before sending a `u64`. Off-chain and out of scope; it will silently lose precision
  for large amounts.
- `web-client/scripts/solana-swap.mjs:56` uses `commitment: 'processed'`, the weakest commitment, to
  confirm value-moving transactions. Off-chain and out of scope.
- **Prompt-injection sweep (checklists 19 / 12):** the repository was scanned for text addressing an
  AI or auditor (`ignore previous instructions`, `you are an AI`, `the auditor`, `mark as safe`,
  `system prompt`, `jailbreak`) across all tracked files, and for AI-agent configuration
  (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.claude/`, `.mcp.json`, Copilot config). **Zero matches
  — no injected instructions were found.** All repository text was treated as data throughout.

---

## 5. Detailed Item Results

> **Every** in-scope checklist item is listed here with its verdict, in checklist order.
> This is the proof that each item was verified individually. Out-of-scope checklists render a
> single gate-generated line (Rule 0) rather than 734 synthesised item lines.
> File paths are relative to the repository root at commit `81ae372`.

### Checklist 01 — Account Validation (90 items, all in scope)

```
--- 1.1 Account Ownership Checks ---
[FAIL-4]    AV-001: The caller's OIL token account is deserialized at processes.rs:53/:224 but its
                    owning program is never validated — processes.rs:60 and :231 re-test
                    acc_info_initializer_isc_ata, a copy-paste of :49/:220.
              File: solana/src/processes.rs:60, :231
              Impact: The account's owner/mint fields are read from caller-controlled bytes; the
                      only remaining barrier is the SPL Token program's own validation.
              Fix: Test acc_info_initializer_oil_ata.owner. See F-005.
[N/A]       AV-002: Anchor `#[derive(Accounts)]` is not used — native program with manual
                    next_account_info parsing (processes.rs:19-30). Covered by §1.10.
[N/A]       AV-003: `UncheckedAccount` is an Anchor type; the crate contains none.
[N/A]       AV-004: The crate contains no `/// CHECK:` comments (none exist to cross-reference).
[N/A]       AV-005: No Anchor `Account<'info, T>` typed accounts exist.
[N/A]       AV-006: Anchor TokenAccount typing unavailable in a native program; the manual
                    spl_token::state::Account unpack at processes.rs:42/:53 is judged at AV-078/AV-080.
[PASS]      AV-007: Mint accounts are never deserialized; both are pinned by address equality to
                    compile-time constants at processes.rs:81-86 — stronger than a type check here.
[PASS]      AV-008: System, Token and Associated-Token program accounts are each pinned by key at
                    processes.rs:88, :92, :96.
[N/A]       AV-009: No Anchor typed accounts, so no foreign-state-struct typing is possible.
[PARTIAL]   AV-010: declare_id! (lib.rs:33) matches the client config (config.json:35), but no
                    program keypair, build metadata or verifiable-build artefact is committed, so
                    the deployed binary cannot be tied to this source.
              File: solana/src/lib.rs:33
              Improvement: Publish a `solana-verify` build hash. See F-004.

--- 1.2 Account Discriminator & Type Cosplay ---
[N/A]       AV-011: The program defines no on-chain account of its own; the only accounts read are
                    SPL Token accounts owned by the Token program.
[PARTIAL]   AV-012: No program-owned structs exist to cosplay, but unpack_from_slice
                    (processes.rs:42,:53) accepts any >=165-byte buffer as a token account and one
                    of the four reads has no owning-program check.
              File: solana/src/processes.rs:53, :60
              Improvement: Pack::unpack + the missing owner check. See F-005, F-009.
[N/A]       AV-013: No remaining_accounts — exactly 12 positional accounts (processes.rs:19-30).
[N/A]       AV-014: No remaining_accounts, so no PDA re-derivation of them is required.
[N/A]       AV-015: No program-owned account structs, so no discriminator collision is possible.
[N/A]       AV-016: No account structs; Borsh is used only for the 9-byte instruction payload
                    (instructions.rs:9-12), which is not account data.
[N/A]       AV-017: No versioned/migrated accounts exist.

--- 1.3 Account Constraint Validation (Anchor) ---
[N/A]       AV-018: Anchor `#[account(mut)]` absent; writability is enforced by the SPL Token
                    program on the accounts it mutates.
[N/A]       AV-019: Same — no Anchor mutability annotations to over-apply.
[N/A]       AV-020: No program-owned state exists to link via has_one.
[N/A]       AV-021: No has_one constraints exist to back with require_keys_eq!.
[N/A]       AV-022: No Anchor `init`; the only creation path is an ATA via CPI (processes.rs:104).
[N/A]       AV-023: `init_if_needed` is an Anchor construct; the hand-rolled equivalent is at AV-087.
[N/A]       AV-024: Same as AV-023.
[N/A]       AV-025: No account is ever closed (no close_account CPI in the crate).
[N/A]       AV-026: No close path, so no data-zeroing requirement arises.
[PASS]      AV-027: The sole PDA uses the constant seed "oolaa" (processes.rs:68-69); there is one
                    PDA per program, so no cross-entity seed collision is constructible.
[PARTIAL]   AV-028: The bump is re-derived by find_program_address on every call
                    (processes.rs:69, :240) rather than stored. Canonical and correct, but ~1,500
                    CU per call.
              File: solana/src/processes.rs:69
              Improvement: Store the canonical bump as a validated constant (Notes).
[N/A]       AV-029: Anchor `constraint = <expr>` is not used.
[N/A]       AV-030: No realloc anywhere in the crate.
[PASS]      AV-031: Duplicate-account substitution is structurally impossible: ISC and OIL accounts
                    are separated by mint checks (processes.rs:46,:57) and the reserve ATAs by
                    address equality (:74,:77).

--- 1.4 Remaining Accounts Validation ---
[N/A]       AV-032: `remaining_accounts` is never accessed — the handlers consume exactly 12
                    positional accounts (processes.rs:19-30) and ignore any surplus.
[N/A]       AV-033: No remaining accounts to owner-check.
[N/A]       AV-034: No remaining accounts used as token accounts.
[N/A]       AV-035: No remaining accounts used as PDAs.
[N/A]       AV-036: No remaining-account count to validate.
[N/A]       AV-037: No remaining accounts are forwarded to any CPI.
[N/A]       AV-038: No remaining accounts exist to collide with named accounts.
[N/A]       AV-039: No investor-position concept in this program.

--- 1.5 Account Size & Rent ---
[N/A]       AV-040: No Anchor `init`; ATA space is determined by the ATA program.
[PASS]      AV-041: The only created account is an ATA via create_associated_token_account
                    (processes.rs:104), which funds rent-exemption from the initializer.
[N/A]       AV-042: No program-owned state, so no Vec/String field length to bound.
[N/A]       AV-043: No realloc path.
[N/A]       AV-044: No account-shrinking path.

--- 1.6 Token Account Validation ---
[PASS]      AV-045: Mint is validated on both caller accounts (processes.rs:46,:57) and bound by
                    construction on both reserve ATAs via get_associated_token_address (:74,:77).
[PARTIAL]   AV-046: The `.owner` FIELD is checked on all four caller accounts (:43,:54,:214,:225),
                    but the OIL account's owning PROGRAM is not.
              File: solana/src/processes.rs:60, :231
              Improvement: See F-005.
[PASS]      AV-047: Both reserve accounts are pinned to get_associated_token_address(pda, mint)
                    at processes.rs:74-79, so PDA ownership is guaranteed by derivation.
[PASS]      AV-048: ATA addresses are derived with the vendored
                    spl_associated_token_account::get_associated_token_address (processes.rs:74,:77).
[PASS]      AV-049: No delegated_amount path exists; the transfer authority is always the checked
                    account owner (processes.rs:156) or the PDA (:173), never a delegate.
[FAIL-4]    AV-050: Neither the caller accounts nor the reserve ATAs are checked for
                    AccountState::Frozen, and unpack_from_slice actively skips the state test.
              File: solana/src/processes.rs:42, :53, :101, :126
              Impact: A frozen reserve ATA makes both swap directions fail permanently, stranding
                      the other reserve with no on-chain recovery.
              Fix: Assert state == Initialized on every token account. See F-007.
[N/A]       AV-051: No SOL/WSOL handling; both mints are hardcoded SPL mints (processes.rs:13-14).
[PARTIAL]   AV-052: The token program is pinned to spl_token::id() (:88) and the ISC account's
                    owner is checked against it (:49), but the OIL account is not, so this program
                    does not itself reject a Token-2022 account there.
              File: solana/src/processes.rs:60
              Improvement: See F-005.

--- 1.7 Reinitialization Protection ---
[N/A]       AV-053: The program has no initialize instruction and owns no account to reinitialize.
[PARTIAL]   AV-054: unpack_from_slice bypasses Pack::unpack's is_initialized check
                    (processes.rs:42,:53,:213,:224). Currently masked because a zeroed token
                    account has owner == Pubkey::default(), failing :43.
              File: solana/src/processes.rs:42
              Improvement: Use Pack::unpack. See F-009.
[N/A]       AV-055: No account is closed, so no seed can be re-derived over stale associations.
[N/A]       AV-056: No close path, so no revival/zombie scenario exists.
[N/A]       AV-057: No close path, so no stale mid-transaction data is reachable.

--- 1.8 SPL Token & Token-2022 Extension Safety ---
[PARTIAL]   AV-058: token_program is pinned per CPI (processes.rs:88,:259), but the OIL account's
                    owning program is unchecked, so per-account program identification is incomplete.
              File: solana/src/processes.rs:60, :231
              Improvement: See F-005.
[PASS]      AV-059: Both reserve ATAs are enforced as canonical ATAs by address equality
                    (processes.rs:74,:77). The caller's own accounts are intentionally not required
                    to be ATAs and are validated by owner + mint instead.
[FAIL-6]    AV-060: The legacy unchecked spl_token::instruction::transfer is used on all four legs
                    instead of transfer_checked, so neither mint nor decimals is bound at runtime.
              File: solana/src/processes.rs:152, :169, :322, :339
              Impact: Nothing in the transaction asserts that one raw ISC unit equals one raw OIL
                      unit; a decimals mismatch silently mis-prices every swap.
              Fix: Use transfer_checked with the mint account and its decimals. See F-001.
[FAIL-6]    AV-061: Decimals are never read from either mint (spl_token::state::Mint is never
                    imported) and raw cross-mint amounts are exchanged 1:1.
              File: solana/src/processes.rs:158, :175
              Impact: A 10^k mispricing if decimals differ; full drain of the smaller-decimal
                      reserve.
              Fix: Assert decimals equality or normalise. See F-001.
[N/A]       AV-062: The program credits nothing — it performs two independent SPL transfers and
                    stores no accounting, so no balance-delta crediting is required.
[N/A]       AV-063: Feature absent — both mints are classic SPL Token mints and the token program is
                    pinned to spl_token::id() (processes.rs:88); no Token-2022 extension is reachable.
[FAIL-4]    AV-064: The custodied reserves are exposed to both mints' freeze authorities with no
                    inspection and no recovery instruction.
              File: solana/src/processes.rs:81-86
              Impact: Mint-authority-level clawback/freeze can strand the reserves permanently.
              Fix: Inspect the mints and add a guardian-gated rescue path. See F-007.
[FAIL-4]    AV-065: freeze_authority and mint_authority status is never considered for either
                    accepted token.
              File: solana/src/processes.rs:13-14, :81-86
              Impact: A frozen reserve ATA deadlocks all swaps.
              Fix: See F-007.
[PASS]      AV-066: The accepted mint set is exactly two compile-time constants
                    (processes.rs:13-14) — the strongest possible allowlist.
[PASS]      AV-067: The reserve ATAs' close_authority and delegate can only be set by their owner
                    (the PDA), and the PDA signs nothing but `transfer` (processes.rs:179,:349), so
                    this program introduces no unexpected delegate or close authority.

--- 1.9 Sysvar & Precompile Account Safety ---
[N/A]       AV-068: Clock/Rent are never read — the program has no time-dependent logic.
[N/A]       AV-069: No sysvar account is passed; the 12 accounts at processes.rs:19-30 contain none.
[N/A]       AV-070: No cooldown, vesting, auction or staleness window exists.
[N/A]       AV-071: No signature introspection; no precompile is invoked.
[N/A]       AV-072: Same — no introspection-based signature check exists.
[N/A]       AV-073: Same — no signed off-chain message is consumed.
[N/A]       AV-074: No instruction-index introspection exists.
[PASS]      AV-075: Accounts are consumed positionally (processes.rs:19-30) but every one is then
                    bound by an explicit key-equality or ownership check (:38-98); no privileged
                    account's identity rests on transaction position.
[PASS]      AV-076: find_program_address (processes.rs:69,:240) yields the canonical bump, which is
                    the exact value passed to invoke_signed (:182,:352); no user-supplied bump path.
[N/A]       AV-089: Feature absent — no ComputeBudget gate and no Instructions-sysvar read exists.
[N/A]       AV-090: Feature absent — no load_instruction_at, no ALT dependence; the fixed 12-account
                    list is far below the transaction-v1 caps.

--- 1.10 Native / Pinocchio (No-Anchor) Program Safety ---
[PASS]      AV-077: Framework correctly identified as native Solana — entrypoint! at lib.rs:11, no
                    anchor-lang dependency in Cargo.toml. Every guarantee below verified by hand.
[FAIL-4]    AV-078: Owner verification is present on three of four caller-account reads and absent
                    on the fourth.
              File: solana/src/processes.rs:60, :231
              Impact: Type-cosplay surface; residual safety depends on the callee.
              Fix: See F-005.
[PARTIAL]   AV-079: is_signer is asserted (processes.rs:38,:209), but no is_writable assertion
                    exists on the four mutated token accounts.
              File: solana/src/processes.rs:38
              Improvement: The SPL Token program rejects non-writable targets, so this is
                           defense-in-depth only; add explicit assertions.
[FAIL-3]    AV-080: Account count is validated implicitly by next_account_info, but the byte-slice
                    reads are not bounds-checked: unpack_from_slice calls array_ref![src, 0, 165],
                    which panics on shorter data.
              File: solana/src/processes.rs:42, :53, :213, :224
              Impact: Program panic instead of InvalidAccountData on a short account.
              Fix: Use Pack::unpack. See F-009.
[PASS]      AV-081: The crate contains zero `unsafe` blocks (verified across all three .rs files).
[PARTIAL]   AV-082: Type is disambiguated by owner + field checks on three reads; the fourth lacks
                    the owner check, none is length-checked, and there is no explicit tag.
              File: solana/src/processes.rs:53-62
              Improvement: See F-005, F-009.
[N/A]       AV-083: Pinocchio is not used; there is no unsafe-account-resize feature.
[N/A]       AV-084: The program CPIs to the canonical SPL Token program (processes.rs:152) and
                    reimplements no token logic.

--- 1.11 Lamport Donation & Runtime-Level Account Safety ---
[FAIL-4]    AV-085: An EXACT lamport balance (== 0) is used as an account-existence oracle on an
                    address anyone can donate into.
              File: solana/src/processes.rs:101-102, :126-127, :273-274, :296-297
              Impact: A 1-lamport donation makes the program skip ATA creation; every swap then
                      fails at the transfer CPI.
              Fix: Test data_is_empty()/owner instead of lamports. See F-006.
[PASS]      AV-086: No write access is required on any builtin, sysvar or precompile — the three
                    program accounts are passed read-only (solana-swap.mjs:132-134) and the program
                    never writes them.

--- 1.12 Account Pre-Creation DoS & Unsafe Deserialization ---
[PARTIAL]   AV-087: The hand-rolled create-if-absent branch (processes.rs:101-123) does tolerate a
                    pre-existing ATA, but the "already exists" path performs NO validation of that
                    account, and a lamport-primed address defeats the test entirely.
              File: solana/src/processes.rs:101, :121-123
              Improvement: Validate the pre-existing account. See F-006.
[FAIL-3]    AV-088: Deserialization is not fully bounds-checked before its bytes are read.
              File: solana/src/processes.rs:42, :53, :213, :224
              Impact: Panic on malformed/short account data.
              Fix: Pack::unpack. See F-009.
```

**Checklist 01 totals:** PASS 17 · FAIL 10 · PARTIAL 10 · N/A 53 · **90 / 90 verdicts**

### Checklist 02 — Access Control (50 items, all in scope)

```
--- 2.1 Signer Verification ---
[PASS]      AC-001: Both value-moving instructions assert the initializer's signature before any
                    transfer — processes.rs:38-40 and :209-211.
[PASS]      AC-002: Same check covers every state-touching path; there are only two instructions
                    (lib.rs:20-30) and both run it.
[N/A]       AC-003: No program-owned state exists to link via has_one; the signer is instead bound
                    to the source token account's `owner` field (processes.rs:43, :214).
[N/A]       AC-004: Anchor's Signer<'info> is unavailable in a native program; manual is_signer is
                    the only mechanism.
[PASS]      AC-005: The check is a hard early return (ProgramError::MissingRequiredSignature), not a
                    silently-skipped branch — processes.rs:38-40.
[N/A]       AC-006: No manager role exists in the program.
[N/A]       AC-007: No investor role or position account exists.
[N/A]       AC-008: No delegation mechanism exists.
[PASS]      AC-009: A caller can only move tokens out of accounts whose `.owner` equals its own
                    signing key (processes.rs:43,:54); there is no act-on-behalf-of path.
[PARTIAL]   AC-010: Both instructions are permissionless and move pool value. That is intentional
                    for a swap pool, but the design bound is undocumented on-chain.
              File: solana/src/lib.rs:22-29
              Improvement: State the invariant and add an aggregate outflow cap. See F-007.

--- 2.2 Role-Based Access Control ---
[PASS]      AC-011: Roles enumerated: exactly one ("any signer"). Instructions: exactly two
                    (lib.rs:22, :26). The mapping is total and unambiguous.
[PASS]      AC-012: No instruction has an ambiguous role — there is only one role.
[N/A]       AC-013: No manager instruction exists to escalate into.
[N/A]       AC-014: No investor instruction or position account exists.
[N/A]       AC-015: The program defines no admin; the only privileged actor is the off-chain upgrade
                    authority, evaluated at OPS-001..012.
[N/A]       AC-016: Same — no on-chain admin powers to enumerate.
[PASS]      AC-017: No god-mode path: both instructions execute the identical validation block
                    (processes.rs:38-98) with no pubkey-gated bypass anywhere in the crate.
[N/A]       AC-018: No manager role exists to impersonate an investor.
[N/A]       AC-019: No investor role exists to impersonate a manager.

--- 2.3 Permission Boundaries ---
[N/A]       AC-020: No per-manager funds exist.
[PASS]      AC-021: A caller can only spend from token accounts it owns — enforced at
                    processes.rs:43, :54, :214, :225.
[N/A]       AC-022: No manager and no fee mechanism exist.
[N/A]       AC-023: No fee is charged anywhere (processes.rs:152-183 moves exactly `amount`).
[N/A]       AC-024: No fee exists to change.
[N/A]       AC-025: No fee transfer and no treasury address exist.
[N/A]       AC-026: No treasury configuration exists.
[N/A]       AC-027: No platform fee exists.
[N/A]       AC-028: No fund PDA ownership concept exists; the PDA's authority is fixed by derivation.
[N/A]       AC-029: No whitelist exists; CPI targets are compile-time constants.

--- 2.4 Freeze & Pause Mechanisms ---
[FAIL-4]    AC-030: No pause mechanism of any kind exists.
              File: solana/src/lib.rs:20-30 (both instructions unconditionally live)
              Impact: No way to halt swaps during an incident, a peg break, or an exploit.
              Fix: Add a guardian-gated pause. See F-007.
[N/A]       AC-031: No pause exists, so there is no trigger authority to evaluate.
[N/A]       AC-032: No pause exists to test for completeness.
[N/A]       AC-033: No pause and no manager fees exist.
[N/A]       AC-034: No pause exists, so emergency-exit-while-paused is not applicable.
[FAIL-4]    AC-035: Confirms AC-030 — the absence of an emergency stop is itself the finding for a
                    protocol holding pooled bridge liquidity.
              File: solana/src/processes.rs:17-186, :188-356
              Impact: Unbounded exposure window during any incident.
              Fix: See F-007.
[FAIL-4]    AC-036: Neither mint's freeze_authority is read, so the program cannot know whether its
                    own reserve accounts are freezable.
              File: solana/src/processes.rs:81-86
              Impact: A freeze deadlocks both swap directions permanently.
              Fix: See F-007.
[N/A]       AC-037: The program mints nothing; there is no shares mint.
[N/A]       AC-038: Same — no shares mint, so no freeze authority over one.

--- 2.5 Anti-Griefing on Access Control ---
[PARTIAL]   AC-039: The reserve ATAs are canonical addresses only the ATA program can create, so
                    they cannot be claimed by an attacker — but they CAN be lamport-primed, which
                    achieves the same denial.
              File: solana/src/processes.rs:74, :101
              Improvement: See F-006.
[N/A]       AC-040: No position accounts exist to create.
[PARTIAL]   AC-041: There is no shared program state to poison, but the shared reserve balance is
                    itself the limiter: exhausting one side blocks that direction until someone
                    swaps back. Self-healing and costly to the attacker, so not scored higher.
              File: solana/src/processes.rs:169-183
              Improvement: Documented reserve-ratio monitoring. See F-013.
[PASS]      AC-042: No close path exists anywhere in the crate, so no account can be force-closed.
[PASS]      AC-043: No off-chain signature or nonce scheme exists; replay is prevented by Solana's
                    recent_blockhash. Each call is independently paid for.
[PARTIAL]   AC-044: No on-chain rate limit exists. Economically moot at a fixed 1:1 rate with no
                    fee, but it means no velocity backstop exists if the peg assumption breaks.
              File: solana/src/processes.rs:17-186
              Improvement: Per-window outflow cap. See F-007 / ECON-089.
[PASS]      AC-045: The only creation path produces the two canonical reserve ATAs, funded by the
                    caller; after first creation the branch is skipped (processes.rs:102,:127), so
                    repeated calls cannot drain anyone's SOL beyond ordinary fees.

--- 2.6 Cross-Instruction Authority ---
[PASS]      AC-046: The program keeps no cross-instruction state, and the PDA signs only inside its
                    own invoke_signed (processes.rs:179, :349) — no authority context survives the
                    instruction.
[N/A]       AC-047: No close path exists, so no stale closed-account data is reachable.
[PASS]      AC-048: The only CPI targets are the pinned SPL Token and ATA programs
                    (processes.rs:88,:92); neither calls back into this program.
[PASS]      AC-049: No program state exists to re-enter, and both handlers return immediately after
                    the final transfer (processes.rs:184, :354).
[PASS]      AC-050: invoke_signed seeds are derived against this program's own ID
                    (processes.rs:69), so no other program can sign for the PDA regardless of the
                    seed string being publicly known.
```

**Checklist 02 totals:** PASS 15 · FAIL 3 · PARTIAL 4 · N/A 28 · **50 / 50 verdicts**

### Checklist 03 — Arithmetic Safety (63 items, all in scope)

> Headline: the crate contains **no arithmetic operator on any value**. `amount` is forwarded
> unmodified from `instructions.rs:19` to `processes.rs:158` / `:175`. This eliminates the entire
> overflow/rounding class — and is why checklist 03 has the report's highest pass rate. The one
> *implicit* arithmetic assumption (1 raw ISC unit == 1 raw OIL unit) is not an operator and is
> tracked under AV-061 / F-001.

```
--- 3.1 Overflow & Underflow Prevention ---
[PASS]      AR-001: No `+` operator appears on any value in solana/src/ — nothing to check.
[PASS]      AR-002: No `-` operator appears on any value in solana/src/.
[PASS]      AR-003: No `*` operator appears on any value in solana/src/.
[PASS]      AR-004: No `/` operator appears on any value in solana/src/.
[PASS]      AR-005: Verified by reading all three .rs files: zero bare arithmetic operators on
                    financial values; `amount` passes through untouched (instructions.rs:19 ->
                    processes.rs:158).
[PASS]      AR-006: No saturating_add/sub/mul anywhere in the crate.
[PASS]      AR-007: No wrapping_add/sub/mul anywhere in the crate.
[N/A]       AR-008: No arithmetic of any kind exists, constant-folded or otherwise.
[N/A]       AR-009: Anchor `space =` is not used (no Anchor).

--- 3.2 Intermediate Precision (u128 Widening) ---
[N/A]       AR-010: No `a * b / c` pattern exists — no multiplication or division in the crate.
[N/A]       AR-011: No share calculation exists.
[N/A]       AR-012: No fee calculation exists.
[N/A]       AR-013: No proportion calculation exists.
[N/A]       AR-014: No u128 computation exists to downcast.
[N/A]       AR-015: No `as u64` cast appears in the crate.
[N/A]       AR-016: No `as u32` cast appears in the crate.
[N/A]       AR-017: No `as i64` cast appears in the crate.

--- 3.3 Division Safety ---
[N/A]       AR-018: No division operation exists.
[N/A]       AR-019: No share pricing exists.
[N/A]       AR-020: No withdrawal proportion exists.
[N/A]       AR-021: No truncating division exists.
[N/A]       AR-022: No share minting exists, so no rounding direction to verify.
[N/A]       AR-023: No share redemption exists.
[PASS]      AR-024: Dust/rounding farming is impossible: the 1:1 raw-unit exchange has no rounding
                    step at all (processes.rs:158, :175), so no residue can accumulate.
[N/A]       AR-025: No share issuance, so no first-depositor price to manipulate.

--- 3.4 Share Math Specific ---
[N/A]       AR-026: The program issues no shares.
[N/A]       AR-027: No share minting, so no zero-supply special case.
[N/A]       AR-028: No share burning.
[N/A]       AR-029: No mint slippage bound — nothing is minted.
[N/A]       AR-030: No burn slippage bound — nothing is burned.
[N/A]       AR-031: No share value to dilute by donation (see also KV-017).
[N/A]       AR-032: No share value to deflate.
[N/A]       AR-033: No positions, so no shares-vs-positions invariant.
[N/A]       AR-034: No shares mint, so no supply invariant.

--- 3.5 Fee Calculation ---
[N/A]       AR-035: No management fee exists.
[N/A]       AR-036: No performance fee exists.
[N/A]       AR-037: No platform fee exists.
[N/A]       AR-038: No fee split exists — the full `amount` reaches the counterparty.
[N/A]       AR-039: No fee basis points exist.
[N/A]       AR-040: No minimum fee exists.
[N/A]       AR-041: No fee-vs-share ordering exists.
[N/A]       AR-042: No compounding fee exists.
[N/A]       AR-043: No fee calculation, so no zero-fee edge case.
[N/A]       AR-062: No fee/rate components exist, so no sum-of-components bound is required.

--- 3.6 NAV Safety ---
[N/A]       AR-044: No NAV concept — the rate is a compile-time 1:1.
[N/A]       AR-045: No NAV calculation to apply decimals to (the decimals gap is at AV-061).
[N/A]       AR-046: No NAV calculation.
[N/A]       AR-047: No NAV attestation and no manager.
[N/A]       AR-048: No NAV to deflate.
[N/A]       AR-049: No attestation PDA exists.
[N/A]       AR-050: No NAV, so no staleness window.

--- 3.7 Lamport & SOL Handling ---
[PASS]      AR-051: Lamports are only read, never computed:
                    `**acc_info_pda_isc_ata.try_borrow_lamports()?` (processes.rs:101) is compared
                    to 0 and never arithmetically combined. (The comparison ITSELF is the defect at
                    AV-085 / F-006 — a logic issue, not an arithmetic one.)
[N/A]       AR-052: The program performs no lamport transfer; ATA rent is funded by the ATA program.
[N/A]       AR-053: No lamport manipulation occurs.
[N/A]       AR-054: No account can be drained of lamports by this program.
[N/A]       AR-055: No WSOL wrapping/unwrapping exists.

--- 3.8 Edge Cases ---
[PASS]      AR-056: amount = u64::MAX is forwarded unchanged and rejected by the SPL Token program
                    with InsufficientFunds; no intermediate computation can overflow because none
                    exists.
[PARTIAL]   AR-057: amount = 0 is accepted and executes two no-op CPIs; there is no
                    require!(amount > 0).
              File: solana/src/processes.rs:158, :175
              Improvement: Reject zero amounts early to save compute and sharpen the error surface.
[PASS]      AR-058: amount = 1 behaves identically to any other value — there is no rounding step
                    that could zero out a minimum-size swap.
[N/A]       AR-059: No shares exist, so no last-share edge case.
[N/A]       AR-060: No per-investor accounting exists; each swap touches only the caller's accounts.
[N/A]       AR-061: Clock::get() is never called; no timestamp arithmetic exists.

--- 3.9 Floating-Point in On-Chain Financial Math ---
[PASS]      AR-063: No f32/f64, no `as f64`, no powf/powi/sqrt/ln/exp anywhere in solana/src/ or
                    evm/contracts/. (The float scaling at web-client/scripts/solana-swap.mjs:167 is
                    off-chain and out of scope — recorded in Notes & Nitpicks.)
```

**Checklist 03 totals:** PASS 12 · FAIL 0 · PARTIAL 1 · N/A 50 · **63 / 63 verdicts**

### Checklist 04 — CPI & PDA Safety (70 items, all in scope)

```
--- 4.1 CPI Target Validation ---
[N/A]       CPI-001: Anchor CpiContext is not used — raw invoke/invoke_signed (processes.rs:111,:162).
[N/A]       CPI-002: Anchor CpiContext::new_with_signer is not used.
[PASS]      CPI-003: The token_program account is pinned to spl_token::id() at processes.rs:88 and
                    :259 before any CPI.
[PASS]      CPI-004: The system_program account is pinned at processes.rs:96 and :267.
[PASS]      CPI-005: The associated-token program account is pinned at processes.rs:92 and :263.
[N/A]       CPI-006: No DEX aggregator CPI exists.
[N/A]       CPI-007: No Metaplex CPI exists.
[PASS]      CPI-008: No account-supplied program ID is ever used as a CPI target — both instructions
                    are built by vendored helpers carrying crate-constant program IDs
                    (processes.rs:104, :152).
[N/A]       CPI-009: No remaining_accounts are passed to any CPI.
[PASS]      CPI-010: The Instruction handed to invoke_signed (processes.rs:169-176) is constructed
                    by spl_token::instruction::transfer with the crate-constant program ID, and the
                    passed token-program account is independently pinned at :88.

--- 4.2 CPI Parameter Validation ---
[PASS]      CPI-011: Transfer sources are correct and validated — the caller's ISC account
                    (processes.rs:154, validated :42-51) and the address-pinned PDA ISC ATA (:341,
                    pinned :245).
[PARTIAL]   CPI-012: Destinations are the address-pinned reserve ATA (processes.rs:155) and the
                    caller's OIL account (:172). The latter is validated by owner + mint but not by
                    owning program.
              File: solana/src/processes.rs:172, :60
              Improvement: See F-005.
[PASS]      CPI-013: Authorities are correct — the signing caller for the inbound leg
                    (processes.rs:156) and the PDA with matching seeds for the outbound leg
                    (:173, seeds at :182).
[FAIL-6]    CPI-014: The `amount` argument is numerically identical on both legs but denominated in
                    two different mints' base units with no normalisation.
              File: solana/src/processes.rs:158, :175
              Impact: 10^k mispricing if the mints' decimals differ.
              Fix: transfer_checked + decimals assertion. See F-001.
[N/A]       CPI-015: No mint_to CPI exists.
[N/A]       CPI-016: No mint_to CPI exists.
[N/A]       CPI-017: No mint_to CPI exists.
[N/A]       CPI-018: No mint_to CPI exists.
[N/A]       CPI-019: No burn CPI exists.
[N/A]       CPI-020: No burn CPI exists.
[N/A]       CPI-021: No burn CPI exists.
[N/A]       CPI-022: No close_account CPI exists.
[N/A]       CPI-023: No close_account CPI exists.
[N/A]       CPI-024: No close_account CPI exists — the reserve ATAs cannot be closed by this program.
[N/A]       CPI-025: The program never invokes System transfer directly.
[N/A]       CPI-026: No approve CPI exists.
[N/A]       CPI-027: No revoke CPI exists.

--- 4.3 PDA Derivation Safety ---
[PASS]      PDA-001: The single PDA uses a single constant seed (processes.rs:68-69); there is no
                    entity dimension that could be omitted.
[N/A]       PDA-002: No fund PDA concept exists.
[PASS]      PDA-003: Full PDA inventory: one PDA, seeds ["oolaa"], derived at processes.rs:68-69 and
                    :239-240. Both derivations are textually identical.
[PASS]      PDA-004: Seed order is trivially consistent (one seed), and the same order is used in
                    the invoke_signed seed arrays at :182 and :352.
[N/A]       PDA-005: The reserve accounts are ATAs derived by the ATA program from (pda, mint);
                    there is no custom vault PDA whose seeds could omit a parent key.
[N/A]       PDA-006: The program creates no mint.
[N/A]       PDA-007: No attestation or oracle PDA exists.
[N/A]       PDA-008: No whitelist, role or permission PDA exists.
[PASS]      PDA-009: Only one PDA exists and its derivation is identical at both sites
                    (processes.rs:69, :240) — no init-vs-use mismatch is possible.
[PARTIAL]   PDA-010: The bump is re-derived per call rather than stored and reused.
              File: solana/src/processes.rs:69, :240
              Improvement: Correct but costs ~1,500 CU per invocation (Notes).
[PASS]      PDA-011: The sole seed is the compile-time literal "oolaa" (processes.rs:68); no
                    user-controlled or variable-length data enters the derivation.
[N/A]       PDA-012: No name seed exists, so no truncation collision is possible.
[PASS]      PDA-013: The seed is a constant, so the PDA can never be orphaned by a state change.
[PASS]      PDA-014: invoke_signed uses the correct signer seeds for the PDA authority —
                    processes.rs:182 and :352 match the derivations at :69 and :240.
[PASS]      PDA-015: The signer-seed array matches the derivation exactly: same single seed plus the
                    canonical bump.
[PASS]      PDA-016: The bump passed to invoke_signed (processes.rs:182) is the one returned by
                    find_program_address in the same call (:69); there is no stored bump to diverge.
[PASS]      PDA-017: invoke_signed (not bare invoke) is correctly used wherever the PDA is the
                    authority — processes.rs:179 and :349.
[PASS]      PDA-018: The two bare invoke calls (processes.rs:162, :332) have the transaction signer
                    as authority, which is correct; no CPI needing PDA signing uses bare invoke.
[PARTIAL]   PDA-019: The instruction handed to invoke_signed is fully constructed by the program,
                    but its `amount` field is the caller's raw input — the mechanism behind F-001.
              File: solana/src/processes.rs:169-176
              Improvement: Bind mint + decimals via transfer_checked. See F-001.
[N/A]       PDA-020: No Jupiter CPI exists.
[N/A]       PDA-021: No realloc appears anywhere in the crate.

--- 4.5 External CPI Safety ---
[N/A]       EXT-001: No Jupiter CPI exists.
[N/A]       EXT-002: No Jupiter CPI exists.
[N/A]       EXT-003: No Jupiter CPI exists.
[N/A]       EXT-004: No Jupiter CPI exists.
[N/A]       EXT-005: No Jupiter CPI exists.
[N/A]       EXT-006: No Jupiter CPI exists.
[N/A]       EXT-007: No Metaplex CPI exists.
[N/A]       EXT-008: No Metaplex CPI exists.
[N/A]       EXT-009: No whitelisted-protocol CPI exists; the two CPI targets are compile-time
                    constants.
[N/A]       EXT-010: No whitelist account exists.
[PASS]      EXT-011: Neither CPI target (SPL Token, SPL ATA) calls back into this program, and the
                    program passes no authority that would let one do so.
[N/A]       EXT-012: Feature absent — classic SPL Token only (pinned at processes.rs:88); no
                    transfer-hook mint is reachable.
[FAIL-4]    EXT-013: The custodied mints are never inspected. Classic SPL Token has no
                    PermanentDelegate or MintCloseAuthority, but freeze_authority applies and is
                    unchecked.
              File: solana/src/processes.rs:81-86
              Impact: A hostile or compromised freeze authority can deadlock the reserves.
              Fix: Read the Mint and reject/allowlist a live freeze authority. See F-007.
[FAIL-6]    EXT-014: Token movement uses legacy spl_token::instruction::transfer with no mint or
                    decimals binding, and credit accounting is absent entirely (no balance delta is
                    computed because the program keeps no accounting).
              File: solana/src/processes.rs:152, :169, :322, :339
              Impact: See F-001.
              Fix: transfer_checked. See F-001.
[N/A]       EXT-015: The program creates no mint, so no metadata claim is required.

--- 4.6 CPI Reentrancy & Composability ---
[N/A]       RE-001: The program holds no state to mutate; both handlers are pure CPI sequences, so
                    checks-effects-interactions has no state phase to order.
[N/A]       RE-002: No state is read after any CPI.
[N/A]       RE-003: Anchor .reload() is unavailable; no account data is read after a CPI.
[PASS]      RE-004: No approve CPI exists, so no external program is granted a re-entrant allowance.
[PASS]      RE-005: Flash-loan resistant by construction — the exchange rate is the constant 1:1
                    (processes.rs:158, :175), derived from no balance, price or supply, so borrowed
                    capital cannot change the terms of the trade.
[PARTIAL]   RE-006: The caller's signing account is handed to the ATA-creation CPI as rent funder
                    (processes.rs:113, :138) with no pre/post lamport snapshot. The callee is the
                    pinned canonical ATA program, so the drain is bounded by ATA rent (~0.00204 SOL,
                    at most twice) — the bound comes from target-pinning, not from accounting.
              File: solana/src/processes.rs:111-119
              Improvement: Snapshot initializer lamports and assert the post-CPI delta.
[N/A]       RE-007: No account's owner is relied upon after any CPI — both handlers return
                    immediately after their final transfer (processes.rs:184, :354).
```

**Checklist 04 totals:** PASS 21 · FAIL 3 · PARTIAL 4 · N/A 42 · **70 / 70 verdicts**

### Checklist 05 — State Machine & Lifecycle (72 items, all in scope)

> Headline: the program is **stateless**. It owns no account, defines no status field, and persists
> nothing between transactions — the reserve token balances, owned by the SPL Token program, are the
> only "state." That structurally eliminates the entire lifecycle class (61 of 72 items are N/A with
> that evidence) and is the reason no state-corruption finding exists in this report. The residual
> issues are observability: there is no structured record of what happened.

```
--- 5.1 State Enum Completeness ---
[PASS]      SM-001: Complete enum inventory: exactly one enum, SwapInstruction
                    (instructions.rs:4-7). It is an instruction selector, not persisted state; no
                    account-state enum exists anywhere in the crate.
[PASS]      SM-002: Variants enumerated: SwapIscToOil { amount } and SwapOilToIsc { amount }
                    (instructions.rs:5-6). There are no others.
[PASS]      SM-003: Both variants are constructible and dispatched — selector 0 and 1
                    (instructions.rs:19-20 -> lib.rs:22, :26).
[N/A]       SM-004: The variants are instruction selectors, not persisted states; there is no
                    "out of" transition to require.
[PASS]      SM-005: No dead variants — both are dispatched at lib.rs:22-29, and an unknown selector
                    is explicitly rejected (instructions.rs:21).
[N/A]       SM-006: No persisted enum exists that external writes could set.
[N/A]       SM-007: No persisted lifecycle, so no terminal state exists.
[N/A]       SM-008: The program owns no accounts, so none can become a zombie.

--- 5.2 Withdrawal Lifecycle ---
[N/A]       SM-009: No multi-step withdrawal exists; a swap is a single atomic instruction
                    (processes.rs:152-184).
[N/A]       SM-010: No withdrawal initiation instruction exists.
[N/A]       SM-011: No swap/conversion status gate exists.
[N/A]       SM-012: No multi-status path exists.
[N/A]       SM-013: No intermediate readiness instruction is needed — the flow is single-step.
[N/A]       SM-014: Not applicable: there is no multi-step flow whose middle step could be missing.
[N/A]       SM-015: No finalization instruction exists.
[N/A]       SM-016: No withdrawal account exists to close.
[N/A]       SM-017: No shares are burned; the token transfer IS the whole operation.
[N/A]       SM-018: No cancellation instruction exists.
[N/A]       SM-019: No position to restore.
[N/A]       SM-020: No withdrawal account to close.
[N/A]       SM-021: No persistent withdrawal records exist, so multiplicity is moot.
[N/A]       SM-022: No withdrawal deadline exists — swaps complete or revert within one transaction.
[N/A]       SM-023: No withdrawal can be stuck pending an operator: nothing is pending after the
                    instruction returns.
[N/A]       SM-024: Partial withdrawal is inherent — the caller chooses `amount` freely.

--- 5.3 Fund Lifecycle ---
[N/A]       SM-025: No initialize_fund instruction exists.
[N/A]       SM-026: No fund account exists to populate.
[N/A]       SM-027: No fund account exists to reinitialize.
[N/A]       SM-028: No fund closure instruction exists.
[N/A]       SM-029: No investor positions exist to settle.
[N/A]       SM-030: No pending withdrawals exist.
[N/A]       SM-031: No fund account exists whose rent could be locked.
[N/A]       SM-032: No fund-name seed exists, so no name collision is possible.
[N/A]       SM-033: No deposit/position/shares flow exists.
[N/A]       SM-034: No position.shares field exists.

--- 5.4 Investor Position Lifecycle ---
[N/A]       SM-035: No position accounts exist.
[N/A]       SM-036: No position tracking exists.
[N/A]       SM-037: No position accounts to close.
[N/A]       SM-038: No shares field exists to underflow.
[N/A]       SM-039: No total_deposited/total_withdrawn fields exist.
[N/A]       SM-040: No position accounts exist.

--- 5.5 Transition Guard Consistency ---
[N/A]       SM-041: No status field exists to pre-check.
[N/A]       SM-042: No multi-state flow exists to skip through.
[PASS]      SM-043: Each swap's two transfer legs execute in one instruction
                    (processes.rs:162-183), so the pair is atomic — a second-leg failure reverts the
                    first.
[PASS]      SM-044: A mid-execution failure leaves nothing inconsistent: the program stores no
                    state, and both token transfers revert together with the transaction.
[PASS]      SM-045: There is no "finalize" to double-run. Repeating a call is an ordinary second
                    swap, fully paid for at the same rate — not a replayed state transition.
[N/A]       SM-046: No account is closed, so no PDA seed is reused over stale associations.

--- 5.6 Event Emission ---
[FAIL-3]    SM-047: No structured event is emitted for any financial operation — only free-text
                    msg! lines.
              File: solana/src/lib.rs:24, :28
              Impact: Off-chain monitoring cannot key on a typed, program-bound record.
              Fix: Emit a Borsh-serialised event via sol_log_data. See F-011.
[FAIL-3]    SM-048: The only financial log carries the amount alone — no caller, no direction
                    accounts, no resulting balances.
              File: solana/src/lib.rs:24
              Impact: Incomplete audit trail.
              Fix: See F-011.
[PARTIAL]   SM-049: This program's logs are emitted only on a real execution path, but free-text
                    logs are indistinguishable from text any other program can print, so a consumer
                    has no program-bound proof.
              File: solana/src/lib.rs:24
              Improvement: Typed events + verify against finalized state (KV-122). See F-011.
[FAIL-3]    SM-050: An indexer cannot reconstruct protocol state from the logs — "Swapped N ISC to
                    OIL" carries no account identifiers, forcing a re-parse of each transaction's
                    account list.
              File: solana/src/lib.rs:24, :28
              Impact: Off-chain reconstruction is unreliable and expensive.
              Fix: See F-011.

--- 5.7 Invariant Checks ---
[N/A]       SM-051: No shares mint exists.
[N/A]       SM-052: No investor positions exist to sum.
[N/A]       SM-053: Nothing is tracked on-chain — the reserve balance IS the state, so it cannot
                    desynchronise from a tracked figure.
[N/A]       SM-054: No deposit accounting exists.
[N/A]       SM-055: No withdrawal accounting exists.
[N/A]       SM-056: No swap accounting exists; NAV is not a concept here.

--- 5.8 Lifecycle Hardening Patterns ---
[N/A]       SM-057: No timestamp field exists anywhere in the program.
[N/A]       SM-058: No timestamp sentinel exists.
[N/A]       SM-059: No terminal state exists, so no cleanup helper is required.
[N/A]       SM-060: No terminal state transitions exist to enumerate.
[N/A]       SM-061: No accounting fields exist to zero alongside a drain.
[N/A]       SM-062: No time gate exists.
[N/A]       SM-063: No paired inequalities exist.
[N/A]       SM-064: No state transitions exist to allowlist.
[N/A]       SM-065: No terminal state exists to make absorbing.
[N/A]       SM-066: No lifecycle rewrite is possible — there is no lifecycle and no privileged actor
                    inside the program.
[N/A]       SM-067: No secondary status or lifecycle lock exists.

--- 5.9 Fixed-Slot Collection & Cached-Aggregate Integrity ---
[N/A]       SM-068: No fixed-slot collection exists — no arrays, no iteration, no Pubkey::default()
                    sentinel anywhere in the crate.
[N/A]       SM-069: No denormalised or cached aggregate exists; every value is read live from the
                    accounts at use time.

--- 5.10 Vesting / Cliff Time Math ---
[N/A]       SM-070: No vesting, cliff or lockup exists; no elapsed-time subtraction is performed.
[N/A]       SM-071: No time units are used at all — Clock is never read.
[N/A]       SM-072: No cliff gate or linear release exists.
```

**Checklist 05 totals:** PASS 7 · FAIL 3 · PARTIAL 1 · N/A 61 · **72 / 72 verdicts**

### Checklist 06 — Economic & Logic Attacks (89 items, all in scope)

> Headline: the protocol has **no fee, no share token, no NAV, no oracle and no curve** — its price
> is a compile-time 1:1. That removes the manipulation classes that dominate DeFi exploits, and it
> is why ECON-001/007/017-class checks pass on their merits rather than by absence. What remains is
> the peg assumption itself (F-001) and the total absence of loss-limiting controls (F-007).

```
--- 6.1 Flash Loan Attacks ---
[PASS]      ECON-001: There is no NAV to inflate and no share to mint. The rate is the constant at
                      processes.rs:158/:175, so an atomic borrow-deposit-withdraw returns exactly
                      what it put in, minus fees.
[N/A]       ECON-002: There is no deposit/withdraw pair to separate in time — a swap is one atomic
                      exchange.
[N/A]       ECON-003: No shares are minted, so there is no minting to delay by a slot.
[N/A]       ECON-004: No share token is issued that could be used as collateral elsewhere.
[N/A]       ECON-005: No NAV attestation exists.

--- 6.2 Sandwich & MEV Attacks ---
[N/A]       ECON-006: No DEX swap CPI exists; the rate is fixed and known before signing, so no
                      slippage parameter is meaningful.
[PASS]      ECON-007: A validator or searcher cannot sandwich the pool: there is no price to move.
                      Front-running can only consume reserves, which is ordinary use at the same rate.
[N/A]       ECON-008: No route or swap data is supplied off-chain; the destination accounts are
                      pinned at processes.rs:74-79.
[N/A]       ECON-009: No share-price path exists to sandwich a deposit against.
[PARTIAL]   ECON-010: A swap can be front-run to exhaust the counter-token reserve so the victim's
                      transaction reverts. This is liveness, not value loss — the rate is unchanged.
              File: solana/src/processes.rs:169-183
              Improvement: No reservation/queue exists and none is warranted; document the
                           behaviour and monitor reserve levels (F-013).
[PARTIAL]   ECON-011: No minimum amount is enforced; amount = 0 executes two no-op CPIs.
              File: solana/src/processes.rs:158
              Improvement: require!(amount > 0). See AR-057.
[PARTIAL]   ECON-012: Same on the outbound side — no minimum withdrawal/swap-out amount.
              File: solana/src/processes.rs:175
              Improvement: See AR-057.

--- 6.3 First Depositor / Share Inflation ---
[N/A]       ECON-013: The pool issues no shares; the first caller receives exactly the same 1:1 rate
                      as every later caller.
[N/A]       ECON-014: No share value exists to dilute by donation.
[N/A]       ECON-015: No first-deposit minimum is needed — there is no share price to seed.
[N/A]       ECON-016: No virtual/dead shares are needed for the same reason.
[N/A]       ECON-017: No share price exists at creation.

--- 6.4 NAV Manipulation ---
[N/A]       ECON-018: No NAV is attested by anyone — the rate is hardcoded.
[N/A]       ECON-019: No manager and no NAV.
[N/A]       ECON-020: No manager and no NAV.
[N/A]       ECON-021: No NAV change to rate-limit.
[N/A]       ECON-022: No NAV to verify.
[N/A]       ECON-023: No NAV floor — the rate cannot be set at all.
[N/A]       ECON-024: No NAV ceiling; and no downstream arithmetic exists to overflow (checklist 03).
[N/A]       ECON-025: No NAV freshness requirement — nothing is attested.

--- 6.5 Fee Exploitation ---
[N/A]       ECON-026: The protocol charges no fee (processes.rs:152-183 moves exactly `amount`).
[N/A]       ECON-027: No fee exists to change retroactively.
[N/A]       ECON-028: No fee change to timelock.
[N/A]       ECON-029: No fee is charged on volume, so wash trading extracts nothing.
[N/A]       ECON-030: No management fee accrual exists.
[N/A]       ECON-031: No performance fee or high-water mark exists.
[N/A]       ECON-032: No fee extraction order exists.
[N/A]       ECON-033: No fee instruction exists to bypass.

--- 6.6 Manager Trust & Rug Pull Vectors ---
[N/A]       ECON-034: No manager role exists in the program.
[PASS]      ECON-035: The only outbound authority is the PDA, which signs exclusively the two
                      hardcoded transfers (processes.rs:179, :349). There is no path by which any
                      party can direct reserve funds to an arbitrary destination of their choosing.
[PARTIAL]   ECON-036: The PDA-authorised transfer's source is address-pinned (processes.rs:171,
                      :341) and its destination is validated by owner + mint — but the destination's
                      owning program is unchecked on the OIL leg.
              File: solana/src/processes.rs:172, :60
              Improvement: See F-005.
[N/A]       ECON-037: The program performs no lamport transfer.
[N/A]       ECON-038: No approve CPI exists.
[N/A]       ECON-039: No swap routing exists — the counterparty is always the pool itself at 1:1.
[N/A]       ECON-040: No manager and no arbitrary CPI target; both targets are compile-time
                      constants (processes.rs:88, :92).
[N/A]       ECON-041: No whitelist exists.
[N/A]       ECON-042: No whitelist exists to add a program to.
[PARTIAL]   ECON-043: There is no manager to protect users against — but equally there is no
                      timelock, multisig or withdrawal guarantee protecting them against the
                      upgrade authority.
              File: repository-wide (absent artefacts)
              Improvement: See F-004.

--- 6.7 Token-Related Exploits ---
[N/A]       ECON-044: Feature absent — classic SPL Token is pinned at processes.rs:88; no
                      Token-2022 transfer hook is reachable.
[PARTIAL]   ECON-045: Safe on the Solana leg by construction (classic SPL Token cannot charge a
                      transfer fee). UNGUARDED on the EVM leg: Swap.sol:53 pays out the full
                      `amount` regardless of what safeTransferFrom actually delivered at :52.
              File: evm/contracts/Swap.sol:52-53
              Improvement: Credit the measured balance delta, not the declared amount.
[PASS]      ECON-046: Classic SPL Token has no rebasing mechanism — balances change only via
                      explicit transfers, so no silent balance drift is possible.
[FAIL-4]    ECON-047: Either mint's freeze authority can freeze the pool's reserve ATAs, and the
                      program neither checks for this nor provides a recovery path.
              File: solana/src/processes.rs:81-86
              Impact: Permanent deadlock of both swap directions; the other reserve is stranded.
              Fix: See F-007.
[FAIL-5]    ECON-048: Neither mint's mint_authority is inspected. On the EVM leg the inflation path
                      is provable: ISCToken.mint is owner-callable and uncapped.
              File: evm/contracts/ISC.sol:22; solana/src/processes.rs:81-86
              Impact: Unbacked supply can be swapped 1:1 for the pooled counter-asset.
              Fix: Cap supply, multisig + timelock the owner. See F-003.
[FAIL-6]    ECON-049: Non-standard/mismatched decimals are unhandled — decimals are never read and
                      raw amounts are exchanged across two mints.
              File: solana/src/processes.rs:158, :175; evm/contracts/Swap.sol:52-53
              Impact: 10^k mispricing; drain of the smaller-decimal reserve.
              Fix: Assert equality or normalise. See F-001.
[N/A]       ECON-050: No native SOL or WSOL handling exists.

--- 6.8 Denial of Service (Economic) ---
[PASS]      ECON-051: Cost is constant: both handlers are straight-line with a fixed 12-account list
                      (processes.rs:19-30) and no loop, so no attacker can inflate another user's
                      transaction cost.
[N/A]       ECON-052: No batch operation exists.
[N/A]       ECON-053: No remaining_accounts-driven payout instruction exists.
[PASS]      ECON-054: No per-user state is created by any instruction; the only creatable accounts
                      are the two reserve ATAs (processes.rs:104, :129), so state bloat is bounded
                      at two accounts for the program's lifetime.
[N/A]       ECON-055: No program-owned state, so no unbounded Vec or array exists.
[PARTIAL]   ECON-056: No program state can be poisoned, but two non-state lock-ups exist: the
                      lamport-primed reserve ATA (F-006) and a frozen reserve ATA (F-007), neither
                      with an on-chain remedy.
              File: solana/src/processes.rs:101, :81-86
              Improvement: See F-006, F-007.

--- 6.9 Oracle Manipulation ---
[N/A]       ECON-057: No oracle of any kind — the rate is a compile-time constant. No pyth /
                      switchboard / get_price marker exists in the in-scope tree.
[N/A]       ECON-058: No oracle price to age-check.
[N/A]       ECON-059: No confidence interval to evaluate.
[N/A]       ECON-060: No oracle to manipulate.
[N/A]       ECON-061: No primary oracle, so no fallback is required.
[PARTIAL]   ECON-062: No oracle AND no attested NAV — the implicit "1 ISC == 1 OIL" peg is the
                      protocol's entire pricing model and is nowhere documented on-chain or in the
                      repository beyond README.md:3.
              File: solana/src/processes.rs:158, :175
              Improvement: Document the trust assumption explicitly and assert it in code (F-001).
[N/A]       ECON-071: No randomness, lottery or reward selection exists — no random/vrf/slot_hashes
                      marker in the crate.

--- 6.10 Staking / Reward Accounting ---
[N/A]       ECON-063: No staking or reward_debt concept exists.
[N/A]       ECON-064: No payout paths exist to keep consistent.
[N/A]       ECON-065: No global reward accumulator exists.
[N/A]       ECON-066: No per-position snapshot exists.
[N/A]       ECON-067: No reward precision scaling exists.
[N/A]       ECON-068: No reward source or claimable balance exists.
[N/A]       ECON-069: No first-staker or total_staked denominator exists.
[N/A]       ECON-070: No reward rate exists to change.

--- 6.11 Blast-Radius & Margin Controls ---
[FAIL-4]    ECON-072: No aggregate outflow ceiling and no circuit breaker exists — a single call can
                      move the entire counter-token reserve.
              File: solana/src/processes.rs:169-183
              Impact: Benign while the peg holds (the caller pays full value), but F-001 or a peg
                      break has no backstop whatsoever.
              Fix: Per-window outflow cap + guardian pause. See F-007.
[N/A]       ECON-073: No mark-to-market, margin or unrealized PnL concept exists.
[PARTIAL]   ECON-074: The pool is 100% concentrated in two assets by design. README.md:5's "limited
                      controlled exposure" is the intended cap but is enforced only by keeping
                      reserves small out of band, never on-chain.
              File: README.md:5; solana/src/processes.rs:13-14
              Improvement: Express the cap on-chain. See F-007.
[FAIL-4]    ECON-089: No rolling per-window outflow accounting and no guardian pause independent of
                      the upgrade authority — a drain from a logic bug, a peg break or a signed
                      action all proceed unimpeded.
              File: solana/src/processes.rs:17-186, :188-356
              Impact: No velocity breaker of any kind.
              Fix: See F-007.

--- 6.12 Slippage & Fee Ordering ---
[PASS]      ECON-075: Gross output equals net output because no fee is deducted anywhere
                      (processes.rs:169-176 transfers the full `amount`), so there is no base
                      mismatch a slippage guard could miss.
[N/A]       ECON-076: No percentage fee exists to compute a base for.
[N/A]       ECON-077: No fee is taken, so none can be mis-sourced from wallet SOL.
[PASS]      ECON-078: No gross/fee/net ambiguity is possible: a single `amount` is used because it
                      genuinely is all three. (The separate concern that it spans two mints is
                      F-001, not a naming problem.)

--- 6.13 Bonding-Curve / AMM Integrity ---
[N/A]       ECON-079: No bonding curve or completion threshold exists.
[N/A]       ECON-080: No virtual/real reserve layering exists — the reserve ATAs ARE the pricing
                      input, and the price does not depend on them at all.
[N/A]       ECON-081: No curve configuration exists to validate.

--- 6.14 Vault & Withdrawal Integrity ---
[FAIL-4]    ECON-082: The reserves' only exit is the 1:1 swap, which requires a counterparty holding
                      the opposite token. There is NO authority-gated sweep or withdrawal path.
              File: solana/src/processes.rs:17-186, :188-356; evm/contracts/Swap.sol:8-56
              Impact: If one mint is frozen, dead, or fully redeemed, the other reserve is
                      permanently unreachable.
              Fix: Add a guardian + timelock rescue path. See F-007.
[N/A]       ECON-083: No allocation or cap concept exists, so no cumulative total is tracked.
[N/A]       ECON-084: No residual/dust sweep path exists.

--- 6.15 TWAP / Internal Accumulator Hardening ---
[N/A]       ECON-085: The program maintains no price observation or accumulator.
[N/A]       ECON-086: No accumulator step exists to saturate.
[N/A]       ECON-087: No measurement window exists.
[N/A]       ECON-088: No TWAP is read anywhere.
```

**Checklist 06 totals:** PASS 8 · FAIL 6 · PARTIAL 9 · N/A 66 · **89 / 89 verdicts**

### Checklist 07 — OpSec & Governance (85 items, all in scope)

> **On `[UNDETERMINED]` in this section.** Nine items require querying live on-chain state
> (`solana program show`). This engagement is static and network-isolated, so those items carry
> `[UNDETERMINED]` rather than a guessed PASS or FAIL — per Rule 10, an item is never marked N/A
> merely because the auditor could not reach the information. Items whose artefact is simply
> *absent from the repository* (no timelock, no runbook, no multisig config) are genuine FAILs,
> because the absence is itself verifiable.

```
--- 7.1 Program Upgrade Authority ---
[UNDETERMINED] OPS-001: Requires `solana program show 7JAUAovyJHXsvqJkeXmjiTUpWTBADiFPagmkgj2Y2s47`.
                    No network access in this engagement, and the repository pins no authority
                    anywhere. See F-004.
[UNDETERMINED] OPS-002: Cannot confirm multisig vs single wallet. No multisig configuration of any
                    kind exists in the tree (no Squads, Realms or Safe descriptor).
[UNDETERMINED] OPS-003: No multisig found, so no threshold could be read on- or off-chain.
[UNDETERMINED] OPS-004: No multisig found, so no signer set could be enumerated.
[UNDETERMINED] OPS-005: Custody form is unknowable from the repository. Counter-evidence: the only
                    key material present is a plaintext array (config.json:31) — the opposite of
                    hardware custody. See F-002.
[FAIL-5]    OPS-006: No upgrade timelock exists anywhere in the repository — no governance program,
                    no buffer-deploy script, no delay mechanism.
              File: repository-wide (absent)
              Impact: An upgrade lands in one slot with no window for users to exit.
              Fix: Front the upgrade authority with a >= 24 h timelock. See F-004.
[FAIL-5]    OPS-007: Neither on-chain enforcement nor a written team policy exists.
              File: repository-wide (absent)
              Impact: Nothing constrains upgrade timing.
              Fix: See F-004.
[FAIL-5]    OPS-008: The recommended minimum (24 h DeFi / 72 h critical infrastructure) is not met —
                    the actual value is zero.
              File: repository-wide (absent)
              Impact: See OPS-006.
              Fix: See F-004.
[UNDETERMINED] OPS-009: Authority-change rights are governed by the BPF Upgradeable Loader; the
                    current holder is unknown, so "who can change it" cannot be answered.
[FAIL-4]    OPS-010: Upgradeability intent is undocumented — README.md is 8 lines and says nothing
                    about the program's mutability.
              File: README.md:1-8
              Impact: Users cannot reason about the program's mutability.
              Fix: Document the decision; consider freezing. See F-004.
[FAIL-5]    OPS-011: A malicious upgrade CAN drain all funds: the PDA's seeds (processes.rs:68-69)
                    are program-derived, so any binary deployed at this program ID can sign for both
                    reserve ATAs.
              File: solana/src/processes.rs:68-69, :182
              Impact: Total loss of both reserves in one transaction.
              Fix: Multisig + timelock, or freeze the program. See F-004.
[FAIL-3]    OPS-012: No emergency-upgrade process is documented, so there are no safeguards to
                    evaluate.
              File: repository-wide (absent)
              Impact: Ad-hoc emergency response. See F-004.

--- 7.2 Backdoor Detection ---
[PASS]      OPS-013: No hidden admin instruction exists. The complete instruction set is two
                    variants (lib.rs:20-30); all 413 lines were read and no pubkey-gated privileged
                    branch exists.
[PASS]      OPS-014: No god-mode account: every account passes through the same validation block
                    (processes.rs:38-98) with no bypass.
[PASS]      OPS-015: The only pubkey comparisons in the crate are the two mints, the PDA, the two
                    ATAs and three program IDs (processes.rs:64-98). Every one RESTRICTS; none
                    grants a privilege.
[PASS]      OPS-016: No unused-but-callable handler exists — both public handlers are dispatched
                    (lib.rs:23, :27) and there is no third.
[N/A]       OPS-017: Native program — no IDL is generated or published, so there is none to compare
                    against the binary.
[N/A]       OPS-018: No treasury pubkey exists in the program.
[N/A]       OPS-019: No DEX/aggregator program ID is stored or modifiable.
[N/A]       OPS-020: No fund manager concept exists.
[N/A]       OPS-021: The program mints nothing.
[N/A]       OPS-022: The program burns nothing.
[PASS]      OPS-023: Zero `unsafe` blocks across all three .rs files.
[PASS]      OPS-024: No raw pointer manipulation (`*const` / `*mut`) anywhere in the crate.
[PASS]      OPS-025: declare_id! (lib.rs:33) matches the only configuration that references it
                    (web-client/config/config.json:35). No Anchor.toml exists to diverge.
[FAIL-4]    OPS-026: The deployed binary cannot be verified against this source — no verifiable-build
                    metadata, no release artefact, no solana-verify configuration, no
                    rust-toolchain.toml.
              File: repository-wide (absent)
              Impact: Users cannot confirm the running code is this code.
              Fix: Publish a reproducible verified build. See F-004.

--- 7.3 Key Management ---
[UNDETERMINED] OPS-027: Deploy-keypair custody is unknowable from the repository (see OPS-005).
[FAIL-6]    OPS-028: A 64-byte Solana secret key is committed in plaintext.
              File: web-client/config/config.json:31
              Impact: Anyone with repository access can sign as that account; its on-chain
                      authorities and balance are unverified.
              Fix: Rotate immediately, move to env/secret manager. See F-002.
[N/A]       OPS-029: No manager role or manager wallet exists in this system.
[N/A]       OPS-030: There is no backend service anywhere in the repository.
[N/A]       OPS-031: Same — no backend wallet exists to assess.
[N/A]       OPS-032: The in-scope program consumes no API keys; the only external endpoint
                    (config.json:43, Wormhole REST) carries none.
[N/A]       OPS-033: Same — no API keys to scope.
[N/A]       OPS-034: RPC endpoint selection is off-chain client configuration, out of scope under
                    `--scope program`. (Noted: all three are localhost — config.json:5, :18, :30.)
[N/A]       OPS-035: Same — off-chain client configuration. (Noted: the committed endpoints carry
                    no API key.)
[FAIL-6]    OPS-036: Key material IS in git history: the repository has exactly one commit
                    (81ae372), so deleting the file cannot remove the secret from history.
              File: web-client/config/config.json:6, :19, :31
              Impact: Permanent exposure until the keys are rotated.
              Fix: Rotate first, then purge history. See F-002.

--- 7.4 Multisig Configuration ---
[FAIL-5]    OPS-037: No multisig is used for any on-chain operation — no Squads, Goki, Realms or
                    Safe configuration exists anywhere in the repository.
              File: repository-wide (absent)
              Impact: Every privileged action is single-key.
              Fix: Move the upgrade authority to a >= 2-of-3 multisig. See F-004.
[N/A]       OPS-038: No multisig exists (OPS-037), so there is no threshold to evaluate.
[N/A]       OPS-039: No multisig exists, so no signer can hold disproportionate power within one.
[N/A]       OPS-040: No multisig exists, so there are no backup signers to check.
[N/A]       OPS-041: No multisig exists, so no threshold-lowering attack applies.
[N/A]       OPS-042: No multisig exists, so there are no proposals to expire.
[N/A]       OPS-043: No multisig exists, so there is no execution log to audit.

--- 7.5 Incident Response ---
[FAIL-3]    OPS-044: No documented incident-response plan exists (no SECURITY.md, no runbook, no
                    docs/ directory).
              File: repository-wide (absent)
              Impact: Unbounded response time. See F-013.
[FAIL-4]    OPS-045: The program cannot be paused by anyone, at any speed.
              File: solana/src/lib.rs:20-30
              Impact: No way to stop an in-progress incident short of a program upgrade.
              Fix: Guardian-gated pause. See F-007.
[FAIL-2]    OPS-046: No bug bounty program is referenced anywhere in the repository. See F-013.
[FAIL-2]    OPS-047: No security contact and no SECURITY.md exists — a finder has no disclosure
                    path. See F-013.
[FAIL-3]    OPS-048: No monitoring or alerting on reserve-ATA value movements exists; and the
                    program emits no structured event to alert on (F-011). See F-013.
[FAIL-3]    OPS-049: No alerting on program-upgrade transactions exists — and the authority to watch
                    is not even published (OPS-001). See F-013.
[FAIL-3]    OPS-050: No anomaly detection on transaction patterns exists. See F-013.
[FAIL-2]    OPS-051: No war-room process, contact tree or escalation order is documented. See F-013.
[FAIL-2]    OPS-052: No post-mortem process is documented. See F-013.

--- 7.6 Timelock Analysis ---
[FAIL-4]    OPS-053: Complete inventory of time-locked actions: NONE. No action in the system —
                    on-chain or operational — is time-locked.
              File: repository-wide (absent)
              Impact: No delay window exists anywhere. See F-004.
[FAIL-5]    OPS-054: Program-upgrade timelock duration: none. See OPS-006 and F-004.
[N/A]       OPS-055: No fees exist, so no fee-change timelock is applicable.
[N/A]       OPS-056: No manager role exists.
[N/A]       OPS-057: No whitelist exists.
[N/A]       OPS-058: No treasury address exists.
[N/A]       OPS-059: No timelock exists, so there is no emergency bypass to evaluate.
[N/A]       OPS-060: No timelock exists, so there is no pending transaction to cancel.
[FAIL-2]    OPS-061: No user-notification channel for privileged changes exists. The program emits
                    no event for any privileged action, and none is published off-chain.
              File: repository-wide (absent). See F-004.

--- 7.7 Access Segregation ---
[FAIL-4]    OPS-062: Environments do NOT use separate keys — config.json:6 and :19 are byte-identical
                    private keys for the `evm0` and `evm1` environments.
              File: web-client/config/config.json:6, :19
              Impact: A compromise of one environment compromises both.
              Fix: Distinct keys per environment, from a secret manager. See F-002.
[FAIL-3]    OPS-063: There is no deployment pipeline at all, so deploys are necessarily manual from
                    a developer machine — and the only key material available is plaintext.
              File: repository-wide (absent). See F-002, F-004.
[N/A]       OPS-064: No CI/CD exists in the repository (no .github/, no pipeline config of any kind),
                    so there is no auto-deploy to safeguard.
[N/A]       OPS-065: No server component is in scope.
[N/A]       OPS-066: No database exists in the system.
[N/A]       OPS-067: No CI exists, so no CI environment variables hold keys. (The plaintext-key
                    issue itself is recorded at OPS-028.)
[FAIL-4]    OPS-068: No secret manager and no .env indirection — the keys are literals in a
                    committed JSON file.
              File: web-client/config/config.json:6, :19, :31
              Impact: See F-002.
              Fix: Environment variables backed by a secret manager. See F-002.

--- 7.8 Source Code Integrity ---
[PASS]      OPS-069: The program is open source — the complete Rust source is in the repository at
                    solana/src/ (3 files, 413 lines), as are both Solidity contracts.
[UNDETERMINED] OPS-070: Source-to-binary correspondence cannot be checked without the deployed
                    binary and network access. See OPS-026 and F-004.
[FAIL-3]    OPS-071: The build is not reproducible: no rust-toolchain.toml pins the compiler, no
                    Docker build recipe, no solana-verify configuration. Cargo.lock IS committed,
                    which is the one positive.
              File: solana/Cargo.toml:1-17 (no toolchain pin); repository-wide
              Impact: Two builders will not necessarily produce the same bytes. See F-004.
[PARTIAL]   OPS-072: The history is a single squashed commit (81ae372), so prior development history
                    is unavailable for review. Nothing indicates a force-push, but provenance cannot
                    be established either way.
              File: repository git history
              Improvement: Preserve real commit history going forward.
[UNDETERMINED] OPS-073: Branch-protection rules live on the remote; this is a local clone with no
                    remote configured and no .github/ directory, so none could be inspected.
[N/A]       OPS-074: No CI pipeline exists to secure.
[PARTIAL]   OPS-075: Cargo.lock IS committed (the real pin for a binary crate), but Cargo.toml:9-12
                    uses default caret semantics — `"1.16.1"` means `^1.16.1`, not `=1.16.1`. On the
                    EVM side, brownie-config.yaml:2 pins OpenZeppelin exactly but
                    `pragma solidity ^0.8.9` floats across all of 0.8.x.
              File: solana/Cargo.toml:9-12; evm/contracts/ISC.sol:2, Swap.sol:2
              Improvement: Use `=` requirements for on-chain dependencies and pin an exact solc.

--- 7.9 Stake & Pre-Signed Governance Safety ---
[N/A]       OPS-076: No stake accounts exist — StakeProgram is never referenced in the crate.
[N/A]       OPS-077: The program has no admin or governance instruction, so none can be carried by a
                    pre-signed durable-nonce transaction.
[N/A]       OPS-085: No multisig or signing council exists (OPS-037), so there is no approval
                    surface whose legibility could be assessed.

--- 7.10 Authority Rotation, Treasury & Config Hardening ---
[N/A]       OPS-078: The program stores no admin authority field, so there is nothing to rotate via
                    a propose/accept handshake. (The EVM-side single-step Ownable is recorded in
                    F-003.)
[N/A]       OPS-079: No fee or treasury account exists in the program.
[N/A]       OPS-080: The program has no config account and no update instruction, so no Patch<T>
                    semantics or namespace-capture risk applies.
[N/A]       OPS-081: No multisig exists whose live threshold could be fetched.

--- 7.11 Admin / Config Parameter Bounds ---
[N/A]       OPS-082: There is no settable parameter anywhere — the two mints (processes.rs:13-14),
                    the PDA seed (:68) and the 1:1 rate are all compile-time constants.
[N/A]       OPS-083: No configuration exists, so no interdependent values need cross-validation.
[N/A]       OPS-084: No configuration value and no division exist, so no zero-divisor guard applies.
```

**Checklist 07 totals:** PASS 8 · FAIL 26 · PARTIAL 2 · UNDETERMINED 9 · N/A 40 · **85 / 85 verdicts**

### Checklist 15 — General Language Safety (88 items, all in scope)

> Applied to the two **on-chain Solidity contracts** (`evm/contracts/ISC.sol`, `evm/contracts/Swap.sol`)
> per OUTPUT-RULES Rule 7: Solidity has no dedicated checklist in this corpus, so checklist 15
> covers it. Web/service-layer items are N/A because the in-scope artefacts are contracts, not
> services. Report note per Rule 7: *"Language Solidity audited using the general safety checklist —
> no language-specific checklist available."*

```
--- 15.1 Input Validation ---
[PARTIAL]   GL-001: Swap.swap validates allowance and output-balance sufficiency
                    (Swap.sol:29-36) but never bounds `amount` against decimals semantics (F-001);
                    ISCToken.mint validates nothing beyond onlyOwner.
              File: evm/contracts/Swap.sol:26-38; evm/contracts/ISC.sol:22
              Improvement: See F-001, F-003.
[N/A]       GL-002: No database layer exists in an on-chain contract.
[N/A]       GL-003: No shell execution is possible on-chain.
[PASS]      GL-004: No dynamic code execution — neither contract contains delegatecall, low-level
                    call, assembly, or dynamic dispatch.
[N/A]       GL-005: No template rendering exists.
[N/A]       GL-006: No filesystem paths exist.
[N/A]       GL-007: No redirects exist.
[N/A]       GL-008: No XML parsing exists.
[N/A]       GL-009: No regular expressions exist.
[N/A]       GL-010: No untrusted-bytes deserialization — both entry points take typed scalars
                    (Swap.sol:49, ISC.sol:22), decoded by the ABI layer.
[N/A]       GL-011: No HTTP request bodies exist.
[N/A]       GL-012: No Content-Type header exists.

--- 15.2 Authentication & Session ---
[PARTIAL]   GL-013: `swap` is intentionally permissionless (Swap.sol:49); `mint`/`pause`/`unpause`
                    are onlyOwner (ISC.sol:14, :18, :22). The gap is that "owner" is a single
                    unconstrained address with only single-step OZ Ownable transfer.
              File: evm/contracts/ISC.sol:9, :22
              Improvement: Ownable2Step + multisig + timelock. See F-003.
[PASS]      GL-014: onlyOwner is genuine authorization (a specific-address check), not merely an
                    authentication gate; `swap` requires no authorization by design.
[N/A]       GL-015: No password storage exists.
[N/A]       GL-016: No session tokens exist.
[N/A]       GL-017: No CSRF surface exists.
[N/A]       GL-018: No login/registration endpoints exist.
[N/A]       GL-019: No JWTs exist.
[FAIL-6]    GL-020: Credentials ARE committed to source rather than loaded from the environment —
                    three private keys in plaintext.
              File: web-client/config/config.json:6, :19, :31
              Impact: See F-002.
              Fix: Environment indirection + rotation. See F-002.
[FAIL-4]    GL-021: No MFA-equivalent for privileged operations — ISCToken's owner is a single key
                    with no multisig or timelock.
              File: evm/contracts/ISC.sol:7, :9
              Impact: Single-key compromise gives unlimited mint and a global pause.
              Fix: Multisig + timelock. See F-003.
[N/A]       GL-022: No account-enumeration surface exists.

--- 15.3 Cryptography ---
[N/A]       GL-023: Neither contract performs hashing.
[N/A]       GL-024: Neither contract performs symmetric encryption.
[N/A]       GL-025: Neither contract generates randomness.
[N/A]       GL-026: No secret comparison occurs on-chain.
[N/A]       GL-027: TLS is not applicable to a contract.
[N/A]       GL-028: Certificate validation is not applicable to a contract.
[FAIL-6]    GL-029: Private keys ARE exposed — in a committed configuration file rather than in a
                    log, but the effect is identical.
              File: web-client/config/config.json:6, :19, :31
              Impact: See F-002.
              Fix: See F-002.
[N/A]       GL-030: No password-based key derivation exists.

--- 15.4 Error Handling & Logging ---
[N/A]       GL-031: EVM reverts carry only a revert string; there are no stack traces to expose.
[PASS]      GL-032: swap_event (Swap.sol:19, emitted :54) logs caller, amount and direction only —
                    no secret material is ever logged by either contract.
[PASS]      GL-033: No try/catch exists in either contract; SafeERC20 (Swap.sol:9) bubbles every
                    failure rather than swallowing it.
[N/A]       GL-034: No HTTP status codes exist.
[N/A]       GL-035: The EVM reverts the entire transaction by default — a global handler is implicit.
[PASS]      GL-036: Abort behaviour is understood and correct: a failed leg reverts the whole swap
                    atomically (Swap.sol:52-53), which is the right semantics for a two-legged
                    exchange.
[PARTIAL]   GL-037: The EVM leg emits a proper indexed event (Swap.sol:19), but the Solana leg emits
                    only free-text msg! — the two legs are inconsistent.
              File: solana/src/lib.rs:24 vs evm/contracts/Swap.sol:19
              Improvement: See F-011.
[N/A]       GL-038: EVM events are typed, not free-text, so log injection is not possible.

--- 15.5 Memory & Resource Safety ---
[N/A]       GL-039: Not C/C++.
[N/A]       GL-040: Not C/C++.
[N/A]       GL-041: Not C/C++.
[N/A]       GL-042: Not Go.
[N/A]       GL-043: Not Go.
[N/A]       GL-044: Not Java.
[N/A]       GL-045: Not Ruby/PHP.
[N/A]       GL-046: No file handles, DB connections or sockets exist in a contract.
[N/A]       GL-047: EVM external calls are synchronous and bounded by gas; no timeout concept exists.
[PASS]      GL-048: Neither contract allocates from user input — `swap` uses fixed-size scalars only
                    (Swap.sol:49), so unbounded allocation is impossible.

--- 15.6 Concurrency & Race Conditions ---
[PARTIAL]   GL-049: eligibleToSwap reads allowance and balanceOf (Swap.sol:29-36) before the body
                    acts, but the re-check inside safeTransferFrom/safeTransfer makes the TOCTOU
                    harmless — the modifier is redundant rather than dangerous.
              File: evm/contracts/Swap.sol:26-38
              Improvement: Remove the redundant checks (gas) — see Notes & Nitpicks.
[N/A]       GL-050: No database transactions exist.
[PASS]      GL-051: nonReentrant (Swap.sol:49, from OZ ReentrancyGuard at :6/:8) serialises the only
                    state-touching path.
[N/A]       GL-052: No nested lock acquisition exists beyond the single reentrancy guard.
[N/A]       GL-053: No versioned records exist.
[N/A]       GL-054: No rate limiter exists.

--- 15.7 API & Network Security ---
[N/A]       GL-055: No CORS surface — the in-scope artefacts are contracts.
[N/A]       GL-056: No HTTP security headers apply.
[N/A]       GL-057: No HTTP/HTTPS redirect applies.
[N/A]       GL-058: No server version header exists.
[N/A]       GL-059: No GraphQL exists.
[N/A]       GL-060: No WebSocket exists.
[N/A]       GL-061: No outbound HTTP requests exist.
[N/A]       GL-062: No Host header exists.

--- 15.8 Infrastructure & Configuration ---
[N/A]       GL-063: No debug flag exists in either contract.
[FAIL-5]    GL-064: Default credentials are in use and unchanged: the EVM key at config.json:6/:19
                    is the well-known Ganache/Hardhat deterministic test key, reused for BOTH
                    environments.
              File: web-client/config/config.json:6, :19
              Impact: Any address derived from it is controllable by anyone. See F-002.
              Fix: Generate fresh per-environment keys. See F-002.
[N/A]       GL-065: No ports or services exist to disable.
[PARTIAL]   GL-066: brownie-config.yaml:2 pins openzeppelin-contracts@4.9.2 exactly (good), but no
                    Brownie lockfile is committed and the solc pragma floats (^0.8.9).
              File: evm/brownie-config.yaml:2; evm/contracts/ISC.sol:2, Swap.sol:2
              Improvement: Commit a lockfile and pin solc exactly.
[N/A]       GL-067: No sudo/root context exists.
[N/A]       GL-068: No Dockerfile exists in the repository.
[PARTIAL]   GL-069: There is no service startup to validate, but the analogous contract-side check
                    is missing: Swap's constructor accepts both token addresses with no
                    zero-address, code-size or distinctness validation, and no setter exists to
                    correct a mistake.
              File: evm/contracts/Swap.sol:40-44
              Improvement: Add constructor require()s — see F-001's recommendation.
[N/A]       GL-070: No health-check endpoint exists.

--- 15.9 Language-Specific Quick Checks ---
[N/A]       GL-071: Not Go.
[N/A]       GL-072: Not Go.
[N/A]       GL-073: Not Go.
[N/A]       GL-074: Not Go.
[N/A]       GL-075: Not Java/Kotlin.
[N/A]       GL-076: Not Java/Kotlin.
[N/A]       GL-077: Not Java/Kotlin.
[N/A]       GL-078: Not Java/Kotlin.
[N/A]       GL-079: Not Ruby.
[N/A]       GL-080: Not Ruby.
[N/A]       GL-081: Not Ruby.
[N/A]       GL-082: Not Ruby.
[N/A]       GL-083: Not PHP.
[N/A]       GL-084: Not PHP.
[N/A]       GL-085: Not PHP.
[N/A]       GL-086: Not PHP.
[N/A]       GL-087: JavaScript-specific; the off-chain client is out of scope under `--scope program`.
[N/A]       GL-088: No HTTP responses exist in an on-chain contract.
```

**Checklist 15 totals:** PASS 7 · FAIL 4 · PARTIAL 6 · N/A 71 · **88 / 88 verdicts**

### Checklist 16 — Formal Verification & Testing Quality (72 items, all in scope)

> Headline: **zero verification of any kind exists.** Confirmed by enumerating all 24 tracked files:
> no `#[test]`, no `#[cfg(test)]`, no `tests/` directory, no `.github/`, no linter or analyser
> configuration, no fuzz target, no coverage tooling. This is the lowest-scoring checklist in the
> report (14% pass rate) and the whole of it rolls up into F-008.

```
--- 16.1 Formal Verification & Property Testing ---
[FAIL-4]    FV-001: No invariant is documented anywhere — not in code comments, not in README.md
                    (8 lines), not in any design note.
              File: repository-wide (absent)
              Impact: The protocol's load-bearing assumptions are implicit. Fix: See F-008.
[FAIL-4]    FV-002: No property-based test or runtime assertion encodes any invariant.
              File: repository-wide (absent). Fix: See F-008.
[FAIL-4]    FV-003: The protocol's single arithmetic identity — one raw ISC unit equals one raw OIL
                    unit — has no proof, no test, and is not even asserted in code.
              File: solana/src/processes.rs:158, :175
              Impact: This is exactly the gap F-001 describes. Fix: See F-001, F-008.
[N/A]       FV-004: The program has no state machine (checklist 05), so there are no state-transition
                    properties to specify.
[FAIL-4]    FV-005: No model checking and no fuzzing exist, so no reachable-state claim has been
                    tested.
              File: repository-wide (absent). Fix: See F-008.
[FAIL-4]    FV-006: Token conservation (tokens in == tokens out) is never verified — no test asserts
                    that reserve + user balances are conserved across a swap.
              File: repository-wide (absent). Fix: See F-008's round-trip test.
[FAIL-4]    FV-007: No negative test proves that only an authorized signer reaches the transfer
                    path (processes.rs:38).
              File: repository-wide (absent). Fix: See F-008.
[FAIL-4]    FV-008: No liveness property is checked — and the pool CAN deadlock (F-006, F-007).
              File: repository-wide (absent). Fix: See F-008.
[N/A]       FV-009: No formal spec exists, so there is no spec drift to track.
[N/A]       FV-010: The project makes no "proven" claim requiring machine-checked proof.
[N/A]       FV-011: No verification properties exist to document.
[N/A]       FV-012: This is the first audit; there is no prior report whose verification results
                    could be included.

--- 16.2 Static Analysis ---
[FAIL-4]    FV-013: No static analysis runs in CI — because no CI exists at all (.github/ is absent).
              File: repository-wide (absent). Fix: See F-008.
[N/A]       FV-014: No analyser runs, so there are no findings to triage.
[FAIL-4]    FV-015: No custom lint rules — and an unwrap() on attacker-controlled data survives in
                    production code.
              File: solana/src/instructions.rs:17. Fix: See F-008, F-010.
[FAIL-3]    FV-016: No zero-warning policy and no lint configuration exist. The audited commit's own
                    message ("Cleanup unused imports") shows warnings were handled by hand.
              File: repository-wide (absent). Fix: See F-008.
[FAIL-3]    FV-017: No security-focused rulesets — no clippy.toml, no lint attributes in lib.rs, no
                    solhint config in evm/.
              File: repository-wide (absent). Fix: See F-008.
[FAIL-2]    FV-018: No dead-code detection is enforced; two validated-but-unused accounts survive
                    (acc_info_program, acc_info_assoc_token_prog).
              File: solana/src/processes.rs:22, :29. Fix: See F-008.
[FAIL-4]    FV-019: No dependency vulnerability scanning — no cargo-audit or cargo-deny
                    configuration. solana-program 1.16.1 and borsh 0.10.3 are 2023-era pins that
                    have never been re-checked.
              File: solana/Cargo.toml:9-12. Fix: See F-008.
[FAIL-4]    FV-020: No SAST covers either production language — nothing for Rust, and no Slither or
                    solhint configuration for the Solidity contracts.
              File: repository-wide (absent). Fix: See F-008.
[PASS]      FV-021: No unjustified suppressions exist — the crate contains no #[allow(...)] and
                    neither Solidity file carries a linter suppression comment.
[N/A]       FV-022: No static-analysis configuration exists to version-control.

--- 16.3 Fuzz Testing ---
[FAIL-4]    FV-023: The program's only parser is never fuzzed — SwapInstruction::unpack accepts
                    arbitrary bytes and panics on malformed input.
              File: solana/src/instructions.rs:15-23. Fix: See F-008, F-010.
[FAIL-4]    FV-024: Neither instruction handler has a fuzz target.
              File: repository-wide (absent). Fix: See F-008.
[N/A]       FV-025: No fuzzing exists, so there is no corpus to persist.
[N/A]       FV-026: No fuzzing exists, so no campaign duration applies.
[N/A]       FV-027: No fuzzing exists, so there are no crashes to triage.
[N/A]       FV-028: There is no second implementation to differentially compare against.
[N/A]       FV-029: The program performs no arithmetic (checklist 03); input-domain edges are
                    covered by FV-023.
[N/A]       FV-030: No API endpoints are in scope.
[FAIL-3]    FV-031: The Borsh payload decode is never round-trip tested — and that is precisely
                    where the unwrap() panic lives.
              File: solana/src/instructions.rs:17. Fix: See F-008, F-010.
[N/A]       FV-032: No fuzzing infrastructure exists to document.

--- 16.4 Test Coverage & Quality ---
[FAIL-3]    FV-033: No coverage tooling is configured (no tarpaulin, no lcov, no istanbul).
              File: repository-wide (absent). Fix: See F-008.
[FAIL-4]    FV-034: Branch coverage on the critical paths is 0% — neither swap handler has a single
                    test.
              File: solana/src/processes.rs:17, :188. Fix: See F-008.
[FAIL-4]    FV-035: Zero unit tests — no #[test] or #[cfg(test)] anywhere in the crate.
              File: repository-wide (absent). Fix: See F-008.
[FAIL-4]    FV-036: No integration test covers the multi-step bridge workflow; the round trip exists
                    only as commented-out client code.
              File: web-client/scripts/my-application.mjs:22-60. Fix: See F-008.
[FAIL-4]    FV-037: No edge-case tests — zero amount, u64::MAX, missing ATA, lamport-primed ATA and
                    frozen account are all untested.
              File: repository-wide (absent). Fix: See F-008.
[FAIL-4]    FV-038: No negative tests — nothing proves an unsigned caller, a wrong mint or a
                    non-token-program account is rejected.
              File: repository-wide (absent). Fix: See F-008 (this is the test that would have
                    caught F-005).
[N/A]       FV-039: No prior bugs are recorded (first audit, single-commit history), so no regression
                    tests are owed.
[FAIL-4]    FV-040: No CI runs tests on PRs, because neither CI nor tests exist.
              File: repository-wide (absent). Fix: See F-008.
[N/A]       FV-041: No test environment exists to compare against production.
[N/A]       FV-042: No tests exist, so none can be flaky or skipped.
[FAIL-2]    FV-043: Mutation testing has never been run.
              File: repository-wide (absent). Fix: See F-008.
[N/A]       FV-044: No endpoint exists to load-test; on-chain CU cost is constant (ECON-051).
[FAIL-6]    FV-045: There is no test suite, but the client harness that stands in for one embeds
                    REAL private keys.
              File: web-client/config/config.json:6, :19, :31; used at solana-swap.mjs:42
              Impact: See F-002.
              Fix: Use generated throwaway keypairs in test fixtures. See F-002.
[N/A]       FV-046: No tests exist, so determinism/seeding is not applicable.

--- 16.5 Error Handling as Security Boundary ---
[PASS]      FV-047: Every CPI result is `?`-propagated (processes.rs:119, :144, :165, :183), so a
                    failed external call aborts the instruction rather than continuing.
[PASS]      FV-048: Error output leaks nothing internal — the msg! lines (processes.rs:35-184) are
                    control-flow markers with no addresses, balances or secrets.
[FAIL-3]    FV-049: Panics in production code are not caught at the boundary: instructions.rs:17
                    panics on malformed input, and unpack_from_slice panics on a short account.
              File: solana/src/instructions.rs:17; solana/src/processes.rs:42
              Impact: Abort instead of a typed error. Fix: See F-009, F-010.
[N/A]       FV-050: No HTTP status codes exist.
[PASS]      FV-051: Resource exhaustion is unreachable — the handlers are straight-line, allocate
                    nothing, and process a fixed 12-account list (processes.rs:19-30).
[N/A]       FV-052: CPIs are synchronous and bounded by the transaction's compute budget; no timeout
                    concept applies on-chain.
[PASS]      FV-053: Partial failure is handled correctly by atomicity — the two transfer legs share
                    one instruction, so leg 2 failing reverts leg 1 (processes.rs:162-183).
[PARTIAL]   FV-054: No error is silently swallowed (every CPI is `?`-propagated), but each is bound
                    to `let _result = ...`, which reads as an intentional discard.
              File: solana/src/processes.rs:111, :136, :162, :179
              Improvement: Drop the binding — `invoke(...)?;` is clearer and identical in effect.
[FAIL-3]    FV-055: Error codes are generic and in places wrong: eight distinct checks all return
                    ProgramError::InvalidArgument, and a MINT mismatch is reported as
                    TokenError::OwnerMismatch.
              File: solana/src/processes.rs:71, :75, :78, :82, :85, :89, :93, :97; :47, :58
              Impact: On-chain failures are unattributable. Fix: See F-010.
[PASS]      FV-056: The error type surface is exhaustive — the instruction match has an explicit
                    catch-all returning InvalidInstructionData (instructions.rs:18-22).
[FAIL-4]    FV-057: No circuit breaker or fallback exists for any dependency or failure mode.
              File: solana/src/lib.rs:20-30. Fix: See F-007.
[N/A]       FV-058: No division exists (checklist 03), and balance underflow is prevented by the SPL
                    Token program's own InsufficientFunds check.

--- 16.6 On-Chain Test-Suite Verification (LiteSVM / Mollusk) ---
[FAIL-4]    FV-059: No in-process SVM suite exists — nothing ever loads the compiled .so, for a
                    program that custodies the bridge's pooled liquidity.
              File: repository-wide (absent). Fix: See F-008.
[N/A]       FV-060: No time-locked or deadline instruction exists to test on both sides.
[N/A]       FV-061: No time-dependent logic exists; Clock is never read.
[N/A]       FV-062: No account-closure path exists to assert on.
[N/A]       FV-063: No initialization instruction exists to double-invoke. (The ATA-creation branch
                    is covered by FV-037.)
[FAIL-4]    FV-064: Authorization negatives are untested — nothing proves the is_signer gate rejects
                    an unsigned caller.
              File: solana/src/processes.rs:38. Fix: See F-008.
[FAIL-4]    FV-065: Arithmetic/input edge cases are untested through the SVM — amount = 0 and
                    amount = u64::MAX behaviour is unverified.
              File: solana/src/processes.rs:158. Fix: See F-008.
[FAIL-4]    FV-066: No explicit balance assertion follows any transfer path; the only balance reader
                    in the repository is client-side console output.
              File: web-client/scripts/solana-swap.mjs:74-87. Fix: See F-008.
[FAIL-2]    FV-067: No CU-consumption baseline is recorded — notable because Pubkey::from_str
                    (processes.rs:32-33) and a repeated find_program_address (:69) are avoidable
                    per-call costs.
              File: solana/src/processes.rs:32, :69. Fix: See F-008.
[N/A]       FV-068: No test suite exists, so blockhash advancement between sends is not applicable.
[N/A]       FV-069: No test suite exists, so there are no failure-path assertions to inspect.
[N/A]       FV-070: No test suite exists. (Positively noted: the CLIENT does re-derive the same seed
                    at solana-swap.mjs:108, matching processes.rs:68.)

--- 16.7 Solana-Native Verification Tooling ---
[FAIL-4]    FV-071: The project uses NO Solana-appropriate verification or fuzzing tool — no Trident,
                    Crucible, Riverguard, Certora, Kani, Mollusk or LiteSVM artefact exists anywhere
                    in the tree, for a program holding pooled bridge liquidity.
              File: repository-wide (absent)
              Impact: The protocol's correctness rests entirely on manual reading. Fix: See F-008.
[N/A]       FV-072: No test suite exists to evaluate for transaction-format coverage; the program
                    itself reads no transaction metadata and is format-agnostic.
```

**Checklist 16 totals:** PASS 6 · FAIL 35 · PARTIAL 1 · N/A 30 · **72 / 72 verdicts**

### Out-of-Scope Checklists (gate-generated, Rule 0)

These render from the scope gate without reading the checklist files or the corresponding source —
that is the scope gate working as designed, not an omission.

```
[N/A]       TS-001..TS-064   (64 items) — out of scope: `--scope program`. The only TypeScript/
                             JavaScript is the off-chain client under web-client/.
[N/A]       BE-001..BE-131  (131 items) — out of scope: `--scope program`, and the repository
                             contains no backend service at all.
[N/A]       FE-001..FE-084   (84 items) — out of scope: `--scope program`. web-client/pages/index.js
                             is an off-chain UI.
[N/A]       SC-001..SC-052   (52 items) — out of scope: `--scope program`. See §4.6 for the coverage
                             limitation this creates around solana/Cargo.lock and
                             web-client/package.json.
[N/A]       SEC-001..SEC-053 (53 items) — out of scope: `--scope program`. The committed-key issue is
                             nonetheless reported, via the IN-SCOPE items OPS-028/OPS-036 and KV-001
                             (finding F-002); a dedicated secrets sweep was not performed.
[N/A]       DEP-001..DEP-089 (89 items) — out of scope: `--scope program`.
[N/A]       PY-001..PY-082   (82 items) — out of scope: `--scope program`. evm/scripts/launch.py is
                             an off-chain Brownie deploy script.
[N/A]       LM-001..LM-065   (65 items) — out of scope: `--scope program`. On-chain event emission is
                             still covered by SM-047..050 and OPS-048..050 (finding F-011).
[N/A]       PC-001..PC-060   (60 items) — out of scope: `--scope program`; intake records Q35 = no
                             regulatory scope and Q36 = no PII.
[N/A]       AI-001..AI-033   (33 items) — out of scope: no .mcp.json, no agent SDK, no LLM
                             dependency anywhere in the repository. (The prompt-injection sweep this
                             checklist would normally drive was still run — see Notes & Nitpicks.)
[N/A]       RS-001..RS-021   (21 items) — out of scope: the only .rs files in the repository are the
                             program crate itself (solana/src/); no off-chain Rust service exists.
```

**Out-of-scope total:** 734 items, each carrying a gate-generated `[N/A — out of scope]` verdict.

---

## 6. Known Vector Results (KV-001 … KV-136)

> 55 vectors are in scope. Each was either **opened and evaluated against its own verification
> procedure** (the `always (<phase>)` vectors, plus every vector whose feature markers are present
> in the in-scope tree), or **skip-deferred with evidence** as `[N/A — feature absent: <marker>]`
> where every marker is provably absent (zero hits across `solana/src/` and `evm/contracts/`).
> A skip-deferred verdict is evidence-backed, not a silent skip, and reopens the moment a manual
> read surfaces the feature — which happened for KV-019 (freeze authority) and KV-122 (log
> spoofing), both of which were reopened and evaluated after the manual read surfaced the feature.

```
--- Crypto / On-Chain (1-30), all in scope ---
[FAIL-6]    KV-001 Private Key Leak: steps 1, 2, 6, 7 and 10 fail — a 64-byte Solana secret key and
                   two EVM private keys are committed, there is no root .gitignore, and there is no
                   secret scanner or pre-commit hook.
              File: web-client/config/config.json:6, :19, :31
              Impact: Signing authority is public; on-chain role unverified.
              Fix: Rotate, externalise, purge history. See F-002.
[PASS]      KV-002 Flash Loan Price Manipulation: the rate is a compile-time 1:1
                   (processes.rs:158, :175) derived from no balance, price or supply — borrowed
                   capital cannot change the terms of the trade.
[PASS]      KV-003 Reentrancy (CPI): the only CPI targets are the pinned SPL Token and ATA programs
                   (processes.rs:88, :92), neither of which calls back; the program holds no state
                   to re-enter and returns immediately after its final transfer (:184, :354).
[PASS]      KV-004 Missing Access Control: every value-moving path asserts the caller's signature
                   (processes.rs:38, :209) and can only spend accounts whose `.owner` is that caller
                   (:43, :54). There is no privileged instruction left unguarded — there is no
                   privileged instruction at all.
[N/A]       KV-005 Oracle Manipulation — feature absent: no pyth/switchboard/oracle/get_price/
                   PriceUpdate marker in the in-scope tree; the rate is a constant.
[N/A]       KV-006 First Depositor / Share Inflation — feature absent: no shares/mint_to/
                   total_supply marker; the pool issues no share token.
[PASS]      KV-007 MEV Sandwich Attack: there is no price for a searcher to move. Front-running can
                   only exhaust reserves (ECON-010), which leaves the rate unchanged.
[FAIL-5]    KV-008 Rug Pull / Admin Backdoor: steps 1, 2, 5 and 6 PASS on the Solana leg (no admin
                   instruction, no admin withdrawal, no fee redirection, all hardcoded pubkeys are
                   restrictions). Step 3 and step 4 FAIL on the EVM leg — unbounded owner mint and a
                   global pause. Step 7 is undetermined (upgrade authority unknown).
              File: evm/contracts/ISC.sol:22, :14
              Impact: Unbacked mint swappable 1:1 for the pooled counter-asset; indefinite freeze.
              Fix: Cap supply, multisig + timelock. See F-003, F-004.
[PASS]      KV-009 Unchecked CPI Target: every CPI target is pinned (processes.rs:88, :92, :96) and
                   both instructions are built by vendored helpers carrying crate-constant program
                   IDs (:104, :152). No account-supplied program ID is ever invoked.
[PARTIAL]   KV-010 PDA Confusion / Type Cosplay: step 4 is the gap — raw AccountInfo is used
                   throughout (native program), three of four caller-account reads carry an
                   owning-program check and the fourth does not, and none is length-checked.
                   Steps 1, 3 and 5 are structurally satisfied (no program-owned accounts, unique
                   constant seed, no cross-type references).
              File: solana/src/processes.rs:53-62
              Improvement: See F-005, F-009.
[PASS]      KV-011 Integer Overflow / Underflow: the crate contains no +, -, * or / operator on any
                   value. `amount` is forwarded unmodified from instructions.rs:19 to
                   processes.rs:158 — the overflow class is structurally absent.
[PASS]      KV-012 Arithmetic Rounding Exploit: no division and no rounding step exists anywhere, so
                   no residue can be farmed (see AR-024).
[PASS]      KV-013 Missing Signer Check: is_signer is asserted before any transfer
                   (processes.rs:38, :209), and the signer is bound to the source account's owner
                   field (:43, :214) — which is this program's equivalent of a has_one link.
[N/A]       KV-014 Account Reinitialization — feature absent: no program-owned account is
                   initialized. The sole creation path is a canonical ATA via CPI
                   (processes.rs:104); re-running it is a no-op because the branch is skipped.
[FAIL-4]    KV-015 Unchecked Account Owner: step 3 fails — acc_info_initializer_oil_ata is
                   deserialized and trusted with no check that it is owned by the SPL Token program.
              File: solana/src/processes.rs:60, :231
              Impact: Forgeable owner/mint fields; the callee is the only remaining barrier.
              Fix: See F-005.
[PARTIAL]   KV-016 Token Account Mismatch: step 2 passes (mint validated on both caller accounts at
                   :46/:57 and bound by ATA derivation on both reserves at :74/:77) and step 3
                   passes (authority is the checked owner or the PDA). Step 4 is incomplete for the
                   reason at KV-015.
              File: solana/src/processes.rs:60
              Improvement: See F-005.
[PASS]      KV-017 Vault Donation Attack: no balance is ever read into a pricing formula — the rate
                   is constant (processes.rs:158). Donating tokens to either reserve changes only
                   the available liquidity, never the terms anyone receives.
[N/A]       KV-018 Fee-on-Transfer Token Exploit — feature absent on the audited on-chain program:
                   classic SPL Token is pinned at processes.rs:88 and cannot charge a transfer fee;
                   no token_2022/TransferFee/get_extension marker exists. (The analogous EVM-side
                   gap is recorded at ECON-045.)
[PARTIAL]   KV-019 Freeze Authority Griefing — REOPENED after the manual read surfaced custodied
                   mints: step 2 fails (neither mint's freeze_authority is validated) and step 3
                   fails (no emergency/rescue path exists). Mitigated only by both mints being
                   project-controlled.
              File: solana/src/processes.rs:81-86
              Improvement: Inspect the mints; add a guardian rescue path. See F-007.
[FAIL-5]    KV-020 Program Upgrade Hijack: step 2 n/a (no Anchor.toml), step 3 FAILS (no upgrade
                   documentation anywhere), step 4 FAILS (no timelock), step 5 FAILS (no verifiable
                   build). Step 1 is undetermined without network access.
              File: repository-wide (absent artefacts)
              Impact: An upgrade can replace the binary and drain both reserves with no delay.
              Fix: Multisig + timelock + verified build. See F-004.
[N/A]       KV-021 Governance Attack (Vote Buying) — feature absent: no realm/proposal/
                   spl-governance/vote_record/voter_weight marker; the program has no governance.
[N/A]       KV-022 Bridge Exploit (Fake Proof) — feature absent in the AUDITED program: no
                   guardian/vaa/post_vaa/verify_signatures/emitter/sequence marker appears in
                   solana/src/ or evm/contracts/. The audited program verifies no VAA; the Wormhole
                   leg is driven entirely by the off-chain client
                   (web-client/scripts/wormhole.mjs), which is out of scope under `--scope program`.
                   Recorded as a coverage limitation in §4.6 — this is the single largest unaudited
                   surface of the overall system.
[N/A]       KV-023 Token-2022 Transfer Hook Attack — feature absent: no token_2022/transfer_hook/
                   get_extension marker; the token program is pinned to classic spl_token::id().
[N/A]       KV-024 Stale/Missing Account Close — feature absent: no close/realloc call exists
                   anywhere in the crate.
[PASS]      KV-025 Compute Budget Exhaustion DoS: steps 1-5 all pass — both handlers are
                   straight-line with a fixed 12-account list (processes.rs:19-30), contain no loop
                   and no remaining_accounts iteration, so worst-case CU is constant and far below
                   the 1.4M limit.
[PASS]      KV-026 PDA Seed Collision: a single PDA with a single compile-time seed
                   (processes.rs:68-69). No user data enters the derivation, so no collision is
                   constructible.
[N/A]       KV-027 Missing Discriminator Check — feature absent: the program owns no account and
                   deserializes no discriminated state. The only deserialized accounts are SPL Token
                   accounts, covered by KV-015/KV-016.
[PARTIAL]   KV-028 Front-Running Transaction: price front-running is impossible (constant rate), but
                   reserve exhaustion can be front-run so a victim's swap reverts. No commit-reveal
                   exists, and none is warranted by this design.
              File: solana/src/processes.rs:169-183
              Improvement: Reserve monitoring (F-013).
[PASS]      KV-029 Withdraw-Before-Update Race: there is no program state to update after a CPI.
                   Both handlers terminate immediately after the final transfer
                   (processes.rs:184, :354), so no stale pre-CPI value is ever reused.
[FAIL-5]    KV-030 Infinite Mint / Uncapped Supply: on the Solana leg there is no mint path at all
                   (PASS). On the EVM leg step 2 FAILS (mint authority is an EOA-controlled
                   Ownable owner), step 3 FAILS (the amount is arbitrary owner input, not derived
                   from any deposit) and step 4 FAILS (no supply cap).
              File: evm/contracts/ISC.sol:22
              Impact: Unlimited unbacked ISC.
              Fix: MAX_SUPPLY + multisig + timelock. See F-003.

--- DevOps (076-100): only KV-091 is in scope (maps to in-scope checklist 07 §7.1) ---
[FAIL-5]    KV-091 Upgrade Authority Not Secured: step 3 partially FAILS — a Solana private key is
                   present in the repository, though it is not labelled as the deploy key. Steps 1,
                   2 and 4 require `solana program show` and are UNDETERMINED in this
                   network-isolated engagement. No multisig configuration exists to find.
              File: repository-wide (absent); web-client/config/config.json:31
              Impact: If the authority is a single hot key — and nothing here suggests otherwise —
                      the program can be rug-pulled.
              Fix: Verify, then move to multisig + timelock. See F-004, F-002.
[N/A]       KV-076..090, KV-092..100 (24 vectors) — out of scope: `--scope program`.

--- On-Chain Modern Surface (101-109), all in scope ---
[N/A]       KV-101 Sysvar Spoofing — feature absent: no sysvar/instructions_sysvar/load_instruction_at
                   marker; no sysvar account is among the 12 accounts (processes.rs:19-30).
[N/A]       KV-102 Precompile Signature Bypass — feature absent: no ed25519/secp256k1/precompile
                   marker; the program verifies no signatures itself.
[PASS]      KV-103 Address Lookup Table Manipulation: no ALT is used, and although accounts are
                   consumed positionally (processes.rs:19-30), every one is bound by an explicit
                   equality or ownership check before use (:38-98) — no privileged account's
                   identity depends on position or ALT resolution.
[PASS]      KV-104 Non-Canonical Bump / PDA Derivation Confusion: find_program_address
                   (processes.rs:69, :240) produces the canonical bump, which is the exact value
                   passed to invoke_signed (:182, :352). create_program_address is never used and no
                   user-supplied bump path exists.
[N/A]       KV-105 Token-2022 Extension Abuse — feature absent: no token_2022/get_extension/
                   PermanentDelegate/ConfidentialTransfer/TransferFee marker; classic SPL Token is
                   pinned at processes.rs:88.
[N/A]       KV-106 Account Revival / Zombie After Close — feature absent: no account-close path
                   exists, so no account can be revived.
[PARTIAL]   KV-107 Fake / Non-Canonical ATA: steps 1-3 PASS — the reserve ATAs are canonically
                   derived and pinned (processes.rs:74, :77) with the correct (classic) token
                   program. Step 4 FAILS: existence is inferred from a lamport balance (:101) and
                   frozen state is never checked.
              File: solana/src/processes.rs:101, :74
              Improvement: See F-006, F-007.
[FAIL-6]    KV-108 Token Decimals & Cross-Mint Amount Confusion: step 2 FAILS (decimals are never
                   read from either mint), step 3 FAILS (unchecked `transfer` is used, not
                   transfer_checked) and step 4 FAILS (raw amounts of two different mints are
                   exchanged 1:1 with no normalisation).
              File: solana/src/processes.rs:158, :175; evm/contracts/Swap.sol:52-53
              Impact: 10^k mispricing and full drain of the smaller-decimal reserve if the decimals
                      differ; the deployed mints' decimals could not be read in this assessment.
              Fix: Assert equality or normalise; use transfer_checked. See F-001.
[FAIL-4]    KV-109 Native / Pinocchio Missing Manual Validation: step 1 identifies a native program
                   (entrypoint! at lib.rs:11, no anchor-lang). Step 2 FAILS (missing owner check).
                   Step 3 PARTIAL (is_signer asserted; is_writable not). Step 4 FAILS (byte-slice
                   read not bounds-checked before indexing). Steps 5, 5b, 6, 7, 7b PASS or N/A — no
                   zero-copy casts, no unsafe, no resize, no token reimplementation.
              File: solana/src/processes.rs:60, :42
              Impact: The manual-validation guarantees Anchor would provide are incomplete.
              Fix: See F-005, F-009.

--- Solana x AI + Off-Chain Rust (110-117): only KV-111 is on-chain ---
[N/A]       KV-111 BPF Stack Frame Overflow DoS — feature absent: no large stack arrays, no
                   recursion. Both handlers hold twelve &AccountInfo references and two 32-byte
                   Pubkeys — far inside the 4 KB frame limit.
[N/A]       KV-110, KV-112..117 (7 vectors) — out of scope: AI-agent and off-chain-Rust vectors
                   under `--scope program`; no agent, MCP or off-chain Rust exists in the repository.

--- Governance & Randomness (118-120), all in scope ---
[N/A]       KV-118 Stake Account Authority Hijack — feature absent: no stake/StakeProgram/authorized/
                   staker/withdrawer marker anywhere in the crate.
[N/A]       KV-119 Durable-Nonce Pre-Signed Governance Abuse — feature absent: no nonce/durable_nonce/
                   advance_nonce/realm/proposal marker, and the program has no privileged instruction
                   a pre-signed transaction could carry.
[N/A]       KV-120 On-Chain Randomness Predictability — feature absent: no random/vrf/switchboard/
                   Clock/slot_hashes/blockhash marker; no lottery, reward selection or draw exists.

--- Modern On-Chain, Custody & Consumers (121-126): 4 on-chain vectors in scope ---
[N/A]       KV-121 cNFT / Account-Compression Merkle Proof Abuse — feature absent: no
                   spl-account-compression/bubblegum/merkle/cNFT/proof marker.
[PARTIAL]   KV-122 Inner-Instruction / Event-Log Spoofing — REOPENED after the manual read surfaced
                   log emission: step 4 PASSES (the program cannot be induced to emit as another
                   program; emissions accompany a real validated state change). Steps 1-3 are
                   inconclusive on the consumer side because the only emissions are FREE-TEXT msg!
                   lines, so any future indexer would have to parse spoofable text rather than a
                   structured, program-bound event.
              File: solana/src/lib.rs:24, :28
              Improvement: Emit typed events; consumers must verify against finalized state.
                           See F-011.
[FAIL-4]    KV-123 Lamport-Donation Account Bricking (King-of-the-SOL): step 1 FAILS — the program
                   assumes a ZERO prior balance on an address anyone can donate into, and uses that
                   assumption as an existence oracle. Steps 2 and 3 pass (no unnecessary mut on
                   builtins; no RentState-transition dependency).
              File: solana/src/processes.rs:101-102, :126-127, :273-274, :296-297
              Impact: 1 lamport bricks every swap until the ATA is created out of band.
              Fix: Test data_is_empty()/owner, not lamports. See F-006.
[N/A]       KV-125 Bonding-Curve Launchpad Graduation Abuse — feature absent: no bonding_curve/
                   graduate/virtual_reserves/migrate/curve marker; the rate is constant, not
                   curve-derived.
[N/A]       KV-124, KV-126 (2 vectors) — out of scope: custodial-wallet and session-token custody
                   concerns are off-chain under `--scope program`.

--- DoS, Float Math, Keeper Lifecycle & CLMM Math (127-131), all in scope ---
[PARTIAL]   KV-127 ATA / Account Pre-Creation DoS: step 1-2 PASS in form — the program does not use
                   a hard `init` and does tolerate a pre-existing ATA (processes.rs:121-123). Step 3
                   FAILS: the "already existed" branch performs NO validation of the pre-existing
                   account, so the DoS is traded for an unvalidated-account path.
              File: solana/src/processes.rs:101, :121-123
              Improvement: Validate the pre-existing account unconditionally. See F-006.
[PASS]      KV-128 On-Chain Floating-Point Financial Math: no f32/f64/`as f64`/sqrt/powi/powf/ln/exp
                   appears in solana/src/ or evm/contracts/. (The float scaling at
                   web-client/scripts/solana-swap.mjs:167 is off-chain and out of scope — Notes.)
[N/A]       KV-129 Keeper Request->Execute Front-Running — feature absent: no keeper/request/execute/
                   crank/settlement marker; swaps are single-instruction with no two-step lifecycle.
[N/A]       KV-130 CLMM/DLMM Tick-Boundary & Liquidity Math — feature absent: no tick/sqrt_price/
                   liquidity_net/bin_array/fee_growth marker; the pool is constant-rate, not
                   concentrated-liquidity.
[PARTIAL]   KV-131 Write-Lock Account Contention DoS: steps 1 and 3 identify the chokepoint — both
                   reserve ATAs are global singletons write-locked by EVERY swap
                   (processes.rs:155, :171), and they could be PDA-sharded but are not. Steps 2, 4
                   and 5 PASS: there is no liquidation, settlement, auction or crank path whose
                   value depends on winning a race, so the impact is a throughput cap rather than an
                   economic DoS.
              File: solana/src/processes.rs:155, :171, :325, :341
              Improvement: Shard the reserves if throughput becomes a constraint. See F-012.

--- Token Registries, Risk Signals & Permissioned Tokens (132-134): only KV-134 is on-chain ---
[N/A]       KV-134 Token ACL (SRFC-37) Gate-Program Bypass — feature absent: no token_acl/TACLkU6/
                   MINT_CFG/gating_program/thaw_permissionless marker; the mints are plain classic
                   SPL Token mints.
[N/A]       KV-132, KV-133 (2 vectors) — out of scope: off-chain token-list and risk-API concerns
                   under `--scope program`; markers are absent from the in-scope tree in any case.

--- Transaction Format & Runtime-Upgrade Readiness (135-136): only KV-135 has an on-chain component ---
[N/A]       KV-135 Transaction v1 Fee-Sponsor Cap Bypass & Disabled ComputeBudget Gates — feature
                   absent: the program neither sponsors fees nor reads ComputeBudgetProgram
                   instructions from the Instructions sysvar; no load_instruction_at, feePayer-as-a-
                   service, sponsor, paymaster or relayer marker appears in the in-scope tree.
                   (Cross-ref AV-089/AV-090, both N/A for the same reason.)
[N/A]       KV-136 — out of scope: reader/indexer-side vector; no in-scope component calls
                   getTransaction/getBlock/blockSubscribe.
```

### Known Vector Metrics

| Metric | Value |
|--------|-------|
| Total known vectors in corpus | 136 |
| **In scope** | **55** |
| PASS | 15 |
| FAIL | 9 |
| PARTIAL | 8 |
| N/A (in-scope, feature provably absent) | 23 |
| Out of scope (gate-generated `[N/A — out of scope]`) | 81 |
| **Completion (in-scope)** | **100%** (55 / 55) |

Vectors opened and evaluated against their full verification procedure: 32 of 55. The remaining 23
were skip-deferred with cited marker evidence per the `known-vectors/INDEX.md` load gate; two
(KV-019, KV-122) were **reopened** mid-audit when a manual file read surfaced the feature their
markers had missed, exactly as the gate requires.

### Audit Metrics

| Metric | Value |
|--------|-------|
| Total items evaluated (in-scope checklist items) | 679 |
| PASS | 101 (14.9%) |
| FAIL | 90 (13.3%) |
| PARTIAL | 38 (5.6%) |
| UNDETERMINED | 9 (1.3%) |
| N/A (evidence-backed, in-scope) | 441 (65.0%) |
| **Pass rate** (excl. N/A) | **42.4%** (101 / 238) |
| **Highest severity found** | **6** — 🟡 MEDIUM (F-001 *Fixed 1:1 swap with no decimal normalisation* and F-002 *Private keys committed to the repository*; both flagged `[UNDETERMINED]`) |
| **Repository Risk Score** | **6 — 🟡 MEDIUM** (Rule 1: highest finding ≥ 5 ⇒ score = max(finding) = 6, "fix soon") |
| Out-of-scope checklist items | 734 (gate-generated `[N/A — out of scope]`) |
| In-scope known vectors evaluated | 55 / 55 (100%) |
| Completion (in-scope items with a verdict) | **100%** |

The per-checklist PASS/FAIL/PARTIAL/N/A breakdown required by Rule 8 is tabulated in
**§3 — Checklists Applied**, and is not repeated here.

> **Note on the UNDETERMINED column.** OUTPUT-RULES Rule 4 defines four verdict tokens; Rule 5b adds
> `[UNCONFIRMED]` and `[UNDETERMINED]` as validation-gate outcomes. Nine checklist-07 items carry
> `[UNDETERMINED]` because answering them requires a live on-chain query (`solana program show`),
> which a static, network-isolated engagement cannot perform. They are reported as a separate column
> rather than folded into N/A, because Rule 10 forbids marking an item N/A merely because the
> auditor could not reach the information. No `[UNCONFIRMED]` verdicts were issued: no finding
> failed the gate on reachability or bounds outright.

---

## 7. Instruction Matrix

| Instruction | File | Signers | CPI Calls | PDA Seeds | Checked Math | State Changes | Findings |
|---|---|---|---|---|---|---|---|
| `SwapIscToOil { amount: u64 }` | `solana/src/processes.rs:17-186` | `acc_info_initializer` (permissionless — any signer), asserted at `:38` | SPL ATA `create_associated_token_account` ×2 (`:104`, `:129`, conditional); SPL Token `transfer` ×2 (`:152` via `invoke`, `:169` via `invoke_signed`) | `["oolaa"]` + canonical bump (`:68-69`), signed at `:182` | N/A — no arithmetic operator exists in the handler | No program-owned state. External: caller ISC −`amount`, PDA ISC +`amount`, PDA OIL −`amount`, caller OIL +`amount` | F-001, F-005, F-006, F-007, F-011 |
| `SwapOilToIsc { amount: u64 }` | `solana/src/processes.rs:188-356` | `acc_info_initializer` (permissionless — any signer), asserted at `:209` | SPL ATA `create_associated_token_account` ×2 (`:276`, `:299`, conditional); SPL Token `transfer` ×2 (`:322` via `invoke`, `:339` via `invoke_signed`) | `["oolaa"]` + canonical bump (`:239-240`), signed at `:352` | N/A — no arithmetic operator exists in the handler | No program-owned state. External: caller OIL −`amount`, PDA OIL +`amount`, PDA ISC −`amount`, caller ISC +`amount` | F-001, F-005, F-006, F-007, F-011 |
| *(decode)* `SwapInstruction::unpack` | `solana/src/instructions.rs:15-23` | — | none | — | none | none | F-010 |
| `Swap.swap(uint256,bool)` *(EVM)* | `evm/contracts/Swap.sol:49-55` | `msg.sender` (permissionless), `nonReentrant` | `safeTransferFrom` (`:52`), `safeTransfer` (`:53`) | — | Solidity ^0.8 checked arithmetic; no arithmetic is performed | ERC-20 balances only; emits `swap_event` (`:54`) | F-001, F-007 |
| `ISCToken.mint(address,uint256)` *(EVM)* | `evm/contracts/ISC.sol:22-24` | `onlyOwner` | — | — | `_mint` (OZ, checked) | `totalSupply` += amount, unbounded | F-003 |
| `ISCToken.pause() / unpause()` *(EVM)* | `evm/contracts/ISC.sol:14-20` | `onlyOwner` | — | — | — | `_paused` flag; gates every transfer via `:26-32` | F-003 |

**Account list (identical for both Solana instructions, positional — `processes.rs:19-30`):**

| # | Account | Signer | Writable (per client) | Validation applied |
|---|---|---|---|---|
| 0 | `initializer` | ✔ | ✔ | `is_signer` @ `:38` |
| 1 | `initializer_isc_ata` | ✖ | ✔ | `.owner` field @ `:43`, `.mint` @ `:46`, owning program @ `:49` |
| 2 | `initializer_oil_ata` | ✖ | ✔ | `.owner` field @ `:54`, `.mint` @ `:57`, **owning program NOT checked** (F-005) |
| 3 | `program` | ✖ | ✖ | key == `crate::id()` @ `:64` (then unused — Notes) |
| 4 | `pda` | ✖ | ✖ | key == `find_program_address(["oolaa"])` @ `:69-72` |
| 5 | `pda_isc_ata` | ✖ | ✔ | key == `get_associated_token_address(pda, ISC)` @ `:74` |
| 6 | `pda_oil_ata` | ✖ | ✔ | key == `get_associated_token_address(pda, OIL)` @ `:77` |
| 7 | `isc_mint` | ✖ | ✖ | key == `ISC` constant @ `:81` (never deserialized — F-001) |
| 8 | `oil_mint` | ✖ | ✖ | key == `OIL` constant @ `:84` (never deserialized — F-001) |
| 9 | `token_program` | ✖ | ✖ | key == `spl_token::id()` @ `:88` |
| 10 | `assoc_token_program` | ✖ | ✖ | key == `spl_associated_token_account::id()` @ `:92` (then unused — Notes) |
| 11 | `system_program` | ✖ | ✖ | key == `system_program::id()` @ `:96` |

Surplus accounts beyond index 11 are silently ignored (`next_account_info` stops consuming); this is
harmless here because every consumed account is individually pinned.

---

## 8. State Model Verification

### Account Types

| Account | Discriminator | Space | Owner | Close Target |
|---|---|---|---|---|
| *(none — the program defines no account type)* | N/A | N/A | N/A | N/A |
| `pda` — `["oolaa"]` authority PDA | N/A (never allocated; used only as a signing authority) | 0 bytes — the address is never given data | System (uninitialized address) | never closed |
| `pda_isc_ata` — reserve | SPL Token `Account` layout (165 B) | 165 | SPL Token program | never closed (no close path) |
| `pda_oil_ata` — reserve | SPL Token `Account` layout (165 B) | 165 | SPL Token program | never closed (no close path) |

**The program is stateless.** It allocates nothing, stores nothing, and defines no account struct.
The two reserve ATAs are ordinary SPL token accounts owned by the Token program; the "state" of the
protocol is entirely their `amount` fields. This is the root reason 61 of checklist 05's 72 items
are N/A, and the reason no state-corruption finding appears in this report.

### State Machine Transitions

```
There is no state machine. The complete transition graph is:

        ┌──────────────────────────── SwapIscToOil(amount) ────────────────────────────┐
        │   user.ISC −amount · reserve.ISC +amount · reserve.OIL −amount · user.OIL +amount
        ▼                                                                              │
  ┌───────────┐                                                                        │
  │  (no persisted state — the pool is defined solely by the two reserve balances)      │
  └───────────┘                                                                        │
        ▲                                                                              │
        └──────────────────────────── SwapOilToIsc(amount) ─────────────────────────────┘
            user.OIL −amount · reserve.OIL +amount · reserve.ISC −amount · user.ISC +amount

  Reachable degenerate states (neither is an error state the program recognises):
    reserve.OIL == 0  ⇒  SwapIscToOil always reverts (InsufficientFunds). Self-heals when
                          someone calls SwapOilToIsc. No on-chain signal is emitted.
    reserve.ISC == 0  ⇒  SwapOilToIsc always reverts. Symmetric.
    reserve ATA frozen ⇒  BOTH directions revert permanently. Does NOT self-heal; no
                          on-chain recovery instruction exists (F-007).
    reserve ATA address lamport-primed but uncreated ⇒ BOTH directions revert until someone
                          creates the ATA out of band (F-006).

  Entry:  lib.rs:20  SwapInstruction::unpack(data)  — selector 0 or 1, else InvalidInstructionData
  Exit:   every path is single-instruction and atomic; there is no pending, intermediate or
          terminal state to reach.
```

### Invariants Verified

| Property | Description | Status |
|---|---|---|
| INV-01 | Only the `["oolaa"]` PDA can authorise an outflow from either reserve ATA | ✅ PASS — `processes.rs:69-72` pins the PDA; `:179`/`:349` are the only `invoke_signed` calls, both with the canonical seeds |
| INV-02 | The accounts touched are exactly the canonical ATAs of that PDA for the two hardcoded mints | ✅ PASS — `processes.rs:74-79` |
| INV-03 | Value conservation: every raw unit leaving a reserve is matched by a raw unit entering the other reserve, in the same instruction | ⚠️ **UNVERIFIED** — structurally true in *raw units* (`:158` and `:175` share one `amount`), but raw-unit parity equals value parity only if `decimals(ISC) == decimals(OIL)`, which is never asserted (**F-001**) |
| INV-04 | A swap is atomic — either both legs settle or neither does | ✅ PASS — both transfers are in one instruction (`processes.rs:162-183`); a second-leg failure reverts the first |
| INV-05 | Round-trip neutrality: `SwapIscToOil(x)` then `SwapOilToIsc(x)` restores all balances | ✅ PASS — no fee is deducted on either leg; conditional on INV-03 |
| INV-06 | A caller can only spend from token accounts it owns | ✅ PASS — `processes.rs:43`, `:54`, `:214`, `:225` |
| INV-07 | No party can extract value from the reserves without paying the counter-token 1:1 | ✅ PASS *within the program* — there is no admin, fee or withdrawal path (`lib.rs:20-30`). ⚠️ Does **not** hold against the upgrade authority (**F-004**) |
| INV-08 | Every reserve account is reachable — funds can always leave | ❌ **FAIL** — the reserves' only exit requires the counter-token; a frozen ATA or a dead counter-token strands them permanently, with no rescue instruction (**F-007**, ECON-082) |
| INV-09 | No instruction can be permanently disabled by an unprivileged party | ❌ **FAIL** — a 1-lamport donation to an uncreated reserve ATA address disables both instructions until the ATA is created out of band (**F-006**) |
| INV-10 | Every financial operation leaves a machine-readable record | ❌ **FAIL** — only free-text `msg!` output exists (**F-011**) |

---

## 9. Code Maturity Scorecard

> Engineering-quality gate (Phase 4.5), orthogonal to the risk score. 0 absent · 1 ad-hoc ·
> 2 partial · 3 good · 4 strong (weakest-link).

| # | Category | Score (0-4) | Evidence (file:line / artifact) | Gap to next level |
|---|----------|:-----------:|---------------------------------|-------------------|
| 1 | Access Controls | **2** | `is_signer` asserted on both value-moving paths (`processes.rs:38`, `:209`); the caller is bound to the source account's `owner` (`:43`, `:54`); no admin surface exists to abuse. But one account's program ownership is unvalidated (`:60`, F-005) and `is_writable` is never asserted. | Fix F-005; assert `is_writable`; factor the duplicated validation block into one helper so the two handlers cannot drift. |
| 2 | Arithmetic | **2** | Zero arithmetic operators on any value — the entire overflow/rounding class is structurally absent (checklist 03, 92% pass). But the single arithmetic *identity* the protocol depends on (1 raw ISC == 1 raw OIL) is never asserted and decimals are never read (`:158`, `:175`, F-001). | Assert decimals equality or normalise; switch to `transfer_checked`. |
| 3 | Account & Type Safety | **2** | Both mints, the PDA, both reserve ATAs and all three program IDs are pinned before any value moves (`processes.rs:64-98`); canonical bump used throughout. But `unpack_from_slice` skips the length and `is_initialized` checks (`:42`, F-009) and one owner check is missing (F-005). | `Pack::unpack` at all four sites; fix F-005; validate the reserve ATAs' state. |
| 4 | Input Validation | **2** | Twelve accounts, each individually validated (`:38-98`); mint allowlist is two compile-time constants — the strongest form. But instruction data panics on malformed input (`instructions.rs:17`, F-010), `amount` has no lower bound, and frozen state is never checked. | Return typed errors instead of panicking; reject `amount == 0`; check `AccountState`. |
| 5 | Testing | **0** | No `#[test]`, no `#[cfg(test)]`, no `tests/` directory, no Brownie test, anywhere in 24 tracked files. Coverage is 0% on both instruction handlers. | Any test at all. Start with the five in F-008. |
| 6 | Fuzzing & Property Tests | **0** | No Trident, no `cargo-fuzz`, no proptest, no Certora, no Kani; no invariant is documented in code, comments or `README.md`. | A fuzz target over `SwapInstruction::unpack`, and the three invariants of F-008 written down and asserted. |
| 7 | Error Handling & DoS Resilience | **1** | Every CPI is `?`-propagated (`:119`, `:144`, `:165`, `:183`) and the two-leg swap is atomic (`:162-183`). But an `unwrap()` on attacker data panics (`instructions.rs:17`), eight distinct checks share one generic error code (`:71-97`), a mint mismatch reports `OwnerMismatch` (`:47`), and 1 lamport bricks the pool (F-006). | Fix F-006 and F-010; introduce a program-specific error enum. |
| 8 | Upgradeability & Governance | **0** | No upgrade authority documented or pinned, no multisig, no timelock, no verifiable build, no deploy runbook, no pause, no emergency procedure — and a private key committed in plaintext (F-002, F-004). | Verify and publish the authority; move it to multisig + timelock; add a reproducible verified build. |
| 9 | Monitoring & Incident Response | **0** | No structured event for any financial operation (`lib.rs:24`, F-011); no `SECURITY.md`, no runbook, no alerting, no bug bounty, no post-mortem process (F-013). | Emit typed events; add `SECURITY.md`; alert on reserve movements and upgrade transactions. |
| **Weighted Maturity** | | **1.0 / 4.0** | Mean of 9 categories (9/36); weakest-link view: four categories score **0**. | |

Categories scoring ≤ 1 — **Testing (0), Fuzzing & Property Tests (0), Error Handling & DoS
Resilience (1), Upgradeability & Governance (0), Monitoring & Incident Response (0)** — are
prioritised in the roadmap below regardless of individual finding severity.

The shape of this scorecard is worth stating plainly: the *code* scores consistently at 2 (partial —
the security-relevant logic is largely right, with specific fixable gaps), while everything
*surrounding* the code scores 0. This is a well-reasoned prototype that has never been through an
engineering process. The remediation effort is therefore weighted far more toward process than
toward rewriting the program.

---

## 10. Remediation Roadmap

### Immediate — Severity 9-10 (Block Deploy)

*None.* No critical finding was confirmed.

### Before Release — Severity 7-8

*None confirmed.* Note, however, that **F-001 escalates to 8** if the two mints' decimals differ and
**F-002 escalates to 10** if the committed Solana keypair holds any live authority — both premises
are unverifiable from the repository and must be checked by the team before any mainnet deploy.
Treat the first two rows below as release blockers until those two facts are established.

### Within 2 Weeks — Severity 5-6

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-002 | 6 | **Rotate all three committed keys first**, then externalise to env/secret manager, add a root `.gitignore` + secret scanner, and purge git history. Confirm what the Solana key controls on-chain. | 2-4 h (rotation is minutes; verifying on-chain role and purging history is the bulk) | Ops / key custodian |
| F-001 | 6 | Read both mints' `decimals`, assert equality (or normalise with a `u128` intermediate rounding toward the pool), and switch all four legs to `transfer_checked`. Mirror the assertion in `Swap.sol`'s constructor. **Determine the deployed mints' decimals before anything else** — that single fact decides whether this is a latent invariant or an active drain. | 3-5 h + a decimals-mismatch test | On-chain dev |
| F-003 | 5 | Add `MAX_SUPPLY` to `ISCToken.mint`, switch to `Ownable2Step`, add a pause expiry, and move ownership to a ≥ 2-of-3 multisig behind a timelock. | 3-4 h + redeploy | EVM dev + ops |
| F-004 | 5 | Query and publish the live upgrade authority; move it to a Squads multisig + ≥ 24 h timelock; add a reproducible verified build (`rust-toolchain.toml` + `solana-verify`); write the deploy/emergency runbook. | 1-2 days | Ops / eng lead |

### Next Sprint — Severity 3-4

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-005 | 4 | One-line fix at `processes.rs:60` and `:231` (`isc` → `oil`), then factor the repeated validation into a shared `load_user_token_account` helper so it cannot drift again. | 1 h + test | On-chain dev |
| F-006 | 4 | Replace the `lamports == 0` probe with `data_is_empty() \|\| owner != spl_token::id()`, and validate the reserve ATA unconditionally afterwards (mint, authority, `AccountState`). | 2 h + test | On-chain dev |
| F-007 | 4 | Add a guardian-gated pause, a timelocked rescue path for frozen/stranded reserves, a per-window outflow cap, and explicit `AccountState::Initialized` checks. Mirror in `Swap.sol`. **Maturity category 9 = 0 — prioritised.** | 1-2 days | On-chain dev + EVM dev |
| F-008 | 4 | Stand up a LiteSVM/Mollusk suite with the five tests named in the finding, a fuzz target over `unpack`, and a CI workflow running clippy + build-sbf + tests + `cargo audit` + Slither. **Maturity categories 5 and 6 = 0 — prioritised.** | 2-3 days | On-chain dev + eng lead |
| F-009 | 3 | Swap `unpack_from_slice` → `Pack::unpack` at all four sites (`:42`, `:53`, `:213`, `:224`). | 30 min | On-chain dev |
| F-010 | 3 | `map_err` instead of `unwrap()` at `instructions.rs:17`; introduce a program-specific error enum with one variant per check. **Maturity category 7 = 1 — prioritised.** | 2-3 h | On-chain dev |
| F-011 | 3 | Emit a Borsh-serialised `SwapEvent` via `sol_log_data` after the second transfer in both handlers. **Maturity category 9 = 0 — prioritised.** | 2 h | On-chain dev |
| F-013 | 3 | Add `SECURITY.md` + disclosure contact; stand up reserve-balance and upgrade-authority alerting; write a one-page incident runbook. **Maturity category 9 = 0 — prioritised.** | 1 day | Ops |

### Backlog — Severity 1-2

| Finding | Severity | Fix | Effort | Owner |
|---|---|---|---|---|
| F-012 | 2 | Shard the reserves across N PDAs (`["oolaa", index]`) *only if* throughput becomes a real constraint; otherwise document the single-queue behaviour so operators expect it. | 1 day (deferred) | On-chain dev |
| *(Notes & Nitpicks)* | — | Deduplicate the two ~95%-identical handlers; replace `Pubkey::from_str().unwrap()` with `pubkey!`; cache the canonical bump; add a `no-entrypoint` feature; rename `my_function` → `process_instruction`; add constructor validation to `Swap.sol`; pin `solc` exactly. | 3-4 h total | On-chain dev |

**Suggested sequencing.** Do F-002 first — it is the only finding whose exposure grows with time and
whose fix (rotation) takes minutes. Then establish the two unknown facts that gate everything else:
the mints' decimals (F-001) and the live upgrade authority (F-004). F-008 should start in parallel
with the code fixes rather than after them, because every other fix in this list needs a test to
prove it landed — and because the absence of tests, not any single bug, is what makes this codebase
risky to change.

---

## 11. Re-Audit Checklist

- [ ] All Critical findings fixed and verified — *none exist; item vacuous at this commit*
- [ ] All High findings fixed and verified — *none confirmed; re-check after the F-001 decimals fact and the F-002 key role are established, since either can escalate into this band*
- [ ] Medium findings (F-001, F-002, F-003, F-004) addressed or accepted with documented risk
- [ ] Low/Info findings (F-005 … F-013) addressed or tracked
- [ ] Regression tests added for each fix — specifically the five tests named in F-008, plus one per fixed finding
- [ ] `decimals(ISC)` and `decimals(OIL)` confirmed equal on every deployed cluster, and asserted on-chain
- [ ] All three committed private keys rotated; git history purged; secret scanning enabled
- [ ] Upgrade authority verified, published, and moved to multisig + timelock
- [ ] Program re-deployed and verified on-chain (`solana program show` matches the published authority)
- [ ] Binary hash matches source via a reproducible verified build
- [ ] CI green on `cargo clippy -D warnings`, `cargo build-sbf`, `cargo test`, `cargo audit`, `slither`
- [ ] Re-run: `/auditor:re-audit` against this report to classify each finding FIXED / PARTIALLY-FIXED / STILL-OPEN / REGRESSED, and to sweep for un-patched siblings of the F-005 anti-pattern

---

## 12. Appendices

### A. Tool Versions

```
No tool was executed during this audit. The engagement was strictly static and read-only:
nothing in the repository was built, installed, run, or fetched, and no RPC endpoint was queried.

Versions below are the ones DECLARED by the repository, read from its manifests — not observed
from an executed toolchain:

  solana-program:              1.16.1                  (solana/Cargo.toml:10)
  spl-token:                   3.5.0  (no-entrypoint)  (solana/Cargo.toml:12)
  spl-associated-token-account:1.1.3  (no-entrypoint)  (solana/Cargo.toml:11)
  borsh:                       0.10.3                  (solana/Cargo.toml:9)
  rust edition:                2021                    (solana/Cargo.toml:4)
  rustc / cargo:               not pinned              (no rust-toolchain.toml — see OPS-071)
  solc:                        ^0.8.9                  (evm/contracts/ISC.sol:2, Swap.sol:2)
  OpenZeppelin contracts:      4.9.2                   (evm/brownie-config.yaml:2)
  anchor-cli:                  n/a — native program, Anchor is not used
  node / npm:                  not pinned              (web-client/package.json — out of scope)

  Audit corpus: auditor-skill 7.3.0@6bb2cbf
    - 1,413 checklist items across 20 checklists; 679 in scope
    - 136 known attack vectors; 55 in scope
```

### B. Environment

```
OS:               Linux 6.6.87.2-microsoft-standard-WSL2 (auditor host)
Repository:       local clone, no remote configured
Audited commit:   81ae372a6383951796709c55c7687a3b80618601
Commit date:      2023-07-18
History depth:    1 commit (squashed)
Working tree:     clean with respect to tracked files; untracked AUDITOR/, audit_1/, audit_2/
                  were excluded (not part of the audited commit)
Cluster tested:   NONE — no cluster was contacted. The repository's own configuration targets
                  local development only (http://localhost:8899 Solana, :8545/:8546 EVM,
                  :7071 Wormhole REST — web-client/config/config.json:5,18,30,43).
RPC provider:     none contacted
Execution mode:   auditor-skill Mode 1 (FULL repository audit), linear single-agent execution;
                  no subagents, no parallel tasks. Files read one at a time per OUTPUT-RULES
                  Rule 3, with checkpoints in audit_2/checkpoint.md.
```

### C. Artefacts Produced

| File | Contents |
|---|---|
| `audit_2/REPORT.md` | This report |
| `audit_2/intake.md` | Persisted `QUESTIONS.md` intake — answers, applied defaults, trust model, severity calibration |
| `audit_2/roadmap.md` | Prioritised remediation roadmap (FULL-AUDIT Step 5.3) |
| `audit_2/checkpoint.md` | Execution checkpoint — files reviewed, verdict totals, resume point |
| `audit_2/worksheets/context/swap_isc_to_oil.md` | Phase 0.5 context worksheet |
| `audit_2/worksheets/context/swap_oil_to_isc.md` | Phase 0.5 context worksheet |
| `audit_2/worksheets/context/unpack_and_entrypoint.md` | Phase 0.5 context worksheet |
| `audit_2/worksheets/context/evm_swap_and_isc.md` | Phase 0.5 context worksheet |

### D. Assumptions, Simplifications & Coverage Limitations

> Referred to elsewhere in this report as **§4.6**. Every default applied during intake surfaces
> here as an explicit assumption, so that "no finding here" reads against a stated premise rather
> than as a blanket clearance. Full derivation: `audit_2/intake.md` §8.

**Assumptions carried from the intake (defaults applied, no human respondent):**

1. **Deployment status = devnet / local-net**, inferred from `web-client/config/config.json:5,18,30`
   (all `localhost`) and the Ganache test key at `:6`. No +1 fund-severity uplift was applied.
   *If the program is live on mainnet with real value, every fund-related severity in this report
   rises by one.*
2. **TVL = Unknown**, calibrated to the pre-launch baseline. Critical findings were not
   double-weighted.
3. **Upgradeable, authority unverified.** Assumed present under the standard BPF Upgradeable Loader.
   The `QUESTIONS.md` rule "single wallet ⇒ Severity 8+" was deliberately **not** applied
   mechanically, because its premise is unconfirmed (F-004).
4. **First audit** — no assumption was made that any prior finding had been fixed; every item was
   re-derived from source.
5. **No prior incidents, no bug bounty, no incident-response process** — all default answers,
   consistent with the absence of any such artefact in the tree.
6. **No CI, no branch protection, no secret scanner, no test suite** — these are *observed*, not
   assumed (`.github/` is absent; zero `#[test]` across 24 files).
7. **Source is public** (Q12 default), which is what makes F-002 a live exposure rather than an
   internal hygiene issue.
8. **Regulatory scope = none, PII = none** — no PII is handled by any in-scope code.

**Coverage limitations — what this audit did NOT cover:**

1. **On-chain state was never read.** No RPC query was made. Consequently the deployed mints'
   `decimals` (F-001), the program's live upgrade authority (F-004), the role of the committed
   keypair (F-002), and both mints' `freeze_authority`/`mint_authority` (F-007) are all
   **unverified**. Four of the report's thirteen findings hinge on facts only a live query can
   settle. These are the first four items the team should check.
2. **The Wormhole bridging leg is entirely unaudited.** It lives in
   `web-client/scripts/wormhole.mjs` (288 lines), which is off-chain and out of scope under
   `--scope program`. The audited program neither invokes nor verifies any VAA (KV-022). **For a
   system whose security proposition is "bridge," this is the largest unaudited surface**, and no
   conclusion in this report should be read as covering it.
3. **`OILToken` is missing from the repository.** `evm/scripts/launch.py:1,6` imports and deploys it,
   but `evm/contracts/` contains only `ISC.sol` and `Swap.sol`. The EVM-side xOil token
   implementation could not be reviewed, which is also why F-001's EVM arithmetic could not be closed.
4. **Dependency vetting was out of scope** (checklist 11). `solana-program 1.16.1`, `spl-token 3.5.0`,
   `borsh 0.10.3` (`solana/Cargo.toml:9-12`) and the `web-client` npm tree were **not** checked
   against any advisory database. These are 2023-era pins; a `cargo audit` / `npm audit` pass is
   strongly recommended and is folded into F-008.
5. **The off-chain client was read for context only.** `web-client/**` (11 files, 4,237 lines, of
   which `config/config.json`, `scripts/solana-swap.mjs` and `scripts/my-application.mjs` were read
   in full and the rest enumerated) was read to
   reconstruct the protocol's intent and to source the evidence behind F-002, but received **no
   item-level verdicts** — checklists 08, 10 and 12 are out of scope. Several off-chain observations
   are recorded in Notes & Nitpicks without severity.
6. **No code was executed.** No PoC was compiled or run, so every finding carries the `[PoC-PROSE]`
   evidence tier — a structured attacker narrative, which OUTPUT-RULES Rule 5b accepts as
   first-class for access-control and logic findings, but which is weaker than a reproduced exploit.
   No `[PoC-REPRODUCED]` or `[FIX-VERIFIED]` claim is made anywhere in this report.
7. **Untracked working-tree content was excluded.** `AUDITOR/`, `audit_1/` and `audit_2/` are not
   part of commit `81ae372`.

**Honest statement of what this report is.** A thorough, item-by-item first pass by an automated
auditor against a 1,413-item corpus, of which 679 items and 55 attack vectors were in scope and all
received explicit verdicts. It is **not** a substitute for a human firm audit — in particular for
the economic design of the peg, the Wormhole integration, and the legal/regulatory questions around
an asset named "International Stable Currency" — and it issues **no "safe to deploy" guarantee**.

### E. Disclaimer

This audit report is provided as-is. It represents a point-in-time review of the codebase at commit
`81ae372a6383951796709c55c7687a3b80618601`. No guarantee is made that all vulnerabilities have been
found. The audit does not constitute financial or legal advice.





</content>
