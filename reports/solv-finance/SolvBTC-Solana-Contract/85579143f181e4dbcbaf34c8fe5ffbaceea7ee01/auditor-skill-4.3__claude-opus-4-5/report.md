# Security Audit Report — SolvBTC Solana Contract

| Field | Value |
|---|---|
| **Repository** | SolvBTC/SolvBTC-Solana-Contract |
| **Scope** | `programs/solvbtc` (PROGRAM scope) — BTC-backed token vault / bridge mint |
| **Primary Program** | `solvbtc` — `declare_id!("soLv1S6GsAEVEnXmVY3oz6GtrNJteQ28iTyRQrHXvkz")` |
| **Audit type** | AI-assisted first-pass |
| **Date** | 2026-06-20 |
| **Auditor** | Automated security review agent (Claude) |
| **Anchor / deps** | anchor-lang 0.31.1, anchor-spl 0.31.1 (token_2022), solana-secp256k1-ecdsa 0.1.0 |

---

## 1. Executive Summary

The `solvbtc` program implements two subsystems: (a) a NAV-based vault that accepts deposit currencies, mints a target token pro-rata to NAV, and processes withdrawals against an off-chain secp256k1 (EIP-191) signature from a configured `verifier`; and (b) a `MinterManager` that gates minting of whitelisted assets (SolvBTC / xSolvBTC) to a whitelist of minter keys. Mint authority is an external 1-of-N SPL multisig in which the program's `vault` PDA is one signer.

The code is generally well-constructed: arithmetic uses `u128` intermediates with `checked_*` ops, account relationships are bound through Anchor `seeds`/`has_one`/`associated_token` constraints, signers are validated, NAV updates are rate-limited, and the withdraw flow binds the off-chain signature to per-request PDA state with a unique `request_hash`. **No CONFIRMED critical or high-severity fund-loss vulnerability was found** that an attacker can trigger permissionlessly.

The residual risk is **centralization / governance**: minting, NAV (price), the withdrawal `verifier`, and admin are all single-key controlled (a single hardcoded `ADMIN_WHITELIST` entry bootstraps both managers), and the withdrawal authorization rests entirely on one off-chain ECDSA `verifier` key with no on-chain dual control. The two genuine code-quality findings are LOW severity.

**Verdict:** No permissionless exploit path identified. Safe to proceed only with full awareness that custody and supply integrity depend on off-chain key custody (verifier, oracle_manager, minters, multisig). Address the LOW items and the centralization caveats before mainnet reliance.

### Repository Risk Score: 4 / 10 (Low)

### Severity Distribution (Confirmed Findings Only)

| Severity | Count |
|----------|-------|
| Critical (9-10) | 0 |
| High (7-8) | 0 |
| Medium (4-6) | 0 |
| Low (1-3) | 2 |
| **Total** | **2** |

---

## 2. Confirmed Findings

### SV-01 — Non-standard withdraw-request "close" leaves a program-owned zero-length account

| Field | Value |
|---|---|
| **Severity** | 4 / 10 — Low |
| **Category** | State machine / account lifecycle (KV-024) |
| **Location** | `programs/solvbtc/src/contexts/vault_withdraw.rs:139-154` |

`close_request_account()` does not use Anchor's `#[account(close = ...)]` or reassign the account to the System Program. It calls `self.withdraw_request.resize(0)` and refunds lamports above the 0-byte rent minimum, leaving an account still owned by `crate::ID` with 0 data bytes and a residual rent-exempt-minimum balance.

**Impact.** Replay is *not* possible: a second `vault_withdraw` re-reads the data and `try_deserialize` fails on empty data (lines 66-67), and re-`vault_withdraw_request` for the same seeds fails because the PDA still exists with a non-zero lamport balance (Anchor `init` rejects). Residual impact is limited to (a) a small rent amount stranded in a husk account per completed withdrawal, and (b) reliance on deserialization failure rather than an explicit owner/discriminator clear as the anti-reuse guard — fragile if future refactors change deserialization behavior.

**Recommendation.** Use Anchor's canonical `#[account(mut, close = user, seeds...)]`; if manual handling is required, also zero the discriminator and assign the account to the System Program after draining all lamports.

### SV-02 — `VaultOracleUpdate` account unconstrained by PDA seeds / `has_one`; binding relies on a runtime `require_keys_eq!`

| Field | Value |
|---|---|
| **Severity** | 3 / 10 — Low |
| **Category** | Account validation / access control (KV-004, KV-015) |
| **Location** | `programs/solvbtc/src/contexts/vault_oracle_update.rs:4-21` |

Unlike every other vault context (which constrains `vault` with `seeds = [b"vault", mint.key()], bump = vault.bump`), `VaultOracleUpdate` declares the vault with no seeds, no `bump`, and no `has_one`. Authorization is enforced only inside the handlers via `require_keys_eq!(self.vault.oracle_manager, self.oracle_manager.key())` (`set_nav`) and `require_keys_eq!(self.vault.admin, ...)` (`set_manager`).

**Impact.** No confirmed exploit — `Account<Vault>` still enforces program ownership and discriminator, and the runtime check binds the signer to that vault. The issue is defense-in-depth: a future edit weakening the `require_keys_eq!` would silently become exploitable (set NAV on an arbitrary attacker-controlled-oracle vault).

**Recommendation.** Add the canonical constraint: `#[account(mut, seeds = [b"vault", vault.mint.as_ref()], bump = vault.bump)]`.

---

## 3. Investigated but Not Confirmed (refuted / by-design / low-confidence)

- **Mint authority & supply control** — by-design. Minting CPIs through `mint_to_checked_1_of_n_multisig`, signing as the `vault` PDA (one signer of an external SPL multisig). SPL Token enforces the supplied multisig is the mint's real authority and the PDA is a member, so a forged multisig is rejected on-chain. `mint` is bound via `vault = PDA(["vault", mint])` and `minter_manager = PDA(["minter_manager", vault])`, gated by `minter_manager.minters.contains(authority)`. No uncapped mint for non-whitelisted callers (KV-030 refuted). Residual risk: whitelisted minters are trusted to mint arbitrary amounts.
- **Withdrawal signature verification & replay** — by-design, low residual. `verify_eip191` checks ECDSA against a fixed configured `verifier` key; the signed payload binds `user`, `withdraw_token`, `request_hash`, `shares`, `nav`; amount/destination are bound via the per-request PDA; `s` is normalized (malleability mitigated). **Caveat:** the signed message omits program ID / chain-id / vault key — cross-vault/program signature reuse is theoretically possible if the same verifier signs for multiple vaults and an identical tuple recurs; off-chain signer must enforce `request_hash` uniqueness. Recommend binding vault/program identity into the payload.
- **NAV oracle manipulation** — by-design. `set_nav` rate-limited to ±0.05%/update, gated to `oracle_manager`; withdraw rejects requests whose nav exceeds current by >1%. Single-oracle control is a centralization assumption; no flash-loan/pool-ratio surface (NAV is admin-set, not reserve-derived).
- **Arithmetic / first-depositor share inflation** — refuted. `u128` intermediates with `checked_*`; shares from admin-set NAV (`amount * 1e8 / nav`), not vault-balance ratio, so donation/inflation vector N/A. `withdrawal_from_shares` re-asserts `nav >= ONE_BITCOIN`; zero-amount requests rejected.
- **Access control on admin/minter mutations** — pass (`has_one = admin`, seed-bound vaults, `ADMIN_WHITELIST` on init). `transfer_admin` lacks a two-step accept; `add_minter`/`add_currency` reject `Pubkey::default()`. Centralization caveat: a single hardcoded key `BsF2mR9brTd7u7wGWrejksQzsdrGFNcddRSYeNpHZixM` bootstraps both managers.
- **Account/owner/type confusion** — pass. Typed wrappers enforce owner + discriminator; ATAs use `associated_token::authority`/`mint`; the only raw `AccountInfo` deserialization is owner- and seed-checked.
- **Upgrade authority** — out of program-source scope. Verify on-chain that the BPF upgrade authority is a multisig/timelock or burned.
