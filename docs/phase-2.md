# Phase 2 — Payment + attestation

## What was built

- **Anchor program `audit_attest`** (`programs/audit_attest`, 165 lines incl. comments).
  - `Config` PDA (`["config"]`): `authority` (the program's upgrade authority, proven via
    ProgramData at `initialize`) and `attester`. `set_attester` rotates without redeploy.
  - `Attestation` PDA (`["attest", repo_hash, commit_sha]`), 203 bytes: repo_hash,
    commit_sha, corpus_version, model_id, report_sha256, counts[5], visibility,
    timestamp, attester, bump. `attest` (init), `reattest` (same commit re-run),
    `set_visibility` (0 private / 1 public / 2 public_redacted). All attester-only.
  - Only hashes and counts are stored. Never finding text.
  - **LiteSVM tests** (`cargo test -p audit_attest`, 4 tests): upgrade-authority gate on
    initialize, attester-only writes, duplicate rejection, account size, invalid
    visibility, reattest/visibility, attester rotation. The test patches the ProgramData
    account so the upgrade authority is a test key (litesvm's `add_program` sets it to
    `None`).
  - Program id `sXtvdoheTtFBukx8vCppJHhiiJHW2xa3xc5KaPAhzkC` (keypair outside the repo).
    IDL committed at `packages/attest/idl/audit_attest.json`.
- **`packages/attest`**: PDA derivation, Borsh arg encoding, Anchor discriminators,
  instruction builders (initialize / set_attester / attest / reattest / set_visibility),
  account decoder, `attest()` send path (finalized commitment). No Anchor client at runtime.
- **Worker**: after ingest, `attestOnChain` writes the attestation and records tx + PDA
  in `Attestation` and `meta.json`. A periodic **visibility sync** pushes disclosure
  changes (maintainer ack / 90-day window) on-chain.
- **Payments**: `PaymentWatcher` polls the treasury USDC ATA for finalized signatures,
  parses memo + SPL transfer amount (+ inner instructions), matches `memo == job id`,
  and queues the job when the amount covers the price; too-low amounts become
  `mismatched` for refund. Expired windows cancel the job. Unit-tested parser.
- **Wallet payment** on `/q/<id>`: wallet-standard adapters (Phantom/Solflare/Backpack
  via `@solana/wallet-adapter-react`), one transaction = idempotent ATA create +
  `transferChecked` + memo. The page polls until the watcher finalizes it.
- **`scripts/refund.ts <job id>`**: sends the received USDC back to the payer from the
  treasury keypair with memo `refund:<job id>`, marks payment/job refunded.
- **`scripts/attest-init.ts`**: initialise / rotate / show the Config PDA.
- **Badge** `/badge/<owner>/<repo>.svg` (shields-style, latest public report, ✓ when
  attested) and stable `/r/<owner>/<repo>` → latest public report redirect. The report
  page shows the README snippet.

## How to run (after the operator approves the mainnet steps)

```bash
# 1. fund ~/.config/solana/id_mainnet.json with ~2 SOL (program rent ≈ 1.7 SOL for 247 KB)
cp ~/.config/solana/audit_attest-program.json target/deploy/audit_attest-keypair.json
anchor build && anchor deploy            # Anchor.toml: cluster = mainnet
# 2. .env: AUDIT_ATTEST_PROGRAM_ID=sXtvdoheTtFBukx8vCppJHhiiJHW2xa3xc5KaPAhzkC, ATTESTER_KEYPAIR_PATH, RPC_URL, TREASURY_PUBKEY
pnpm exec tsx scripts/attest-init.ts init --authority ~/.config/solana/id_mainnet.json
# 3. fund the attester with a little SOL for rent + fees (≈0.003 SOL per attestation)
```

## Self-audit

`docs/self-audit/` — pending: the sandbox must run (Docker + API key) to audit this
repository with the corpus. Until then see `docs/self-audit/README.md` for the plan and
the checklist of what it will cover.

## Left out (and why)

- Mainnet deploy, config initialisation and the first attestation: money gates.
- Escrow: roadmap. Payment is a plain transfer + memo; refunds are an admin script.
- Priority fees are fixed (10,000 µlamports); no dynamic fee estimation.
