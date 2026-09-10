# Roadmap (not built in the MVP)

Everything below is deliberately out of scope for the hackathon build. Each item lists why
it was deferred and the shape it should take so it can be picked up without re-deciding.

## 1. GitHub App for private repositories and PR-diff audits

- **Why deferred:** the MVP audits public repositories only; the sandbox clones over
  anonymous HTTPS and has no credentials at all. Private repos need a token, and a token
  in the sandbox widens the blast radius of a prompt-injection finding.
- **Shape:** a GitHub App with read-only `Contents` (and `Metadata`) permissions. The
  worker mints a short-lived installation token, clones on the host (never inside the
  sandbox), and mounts the checkout read-only as today. PR audits map to the corpus's
  `/auditor:diff-audit` command with `--base <sha>`; the attestation PDA would be keyed on
  (repo, head sha) and record the base sha in a new field. Maintainer verification via the
  App installation replaces the OAuth permission check for those repos.

## 2. Reviews (wallet + X OAuth)

- **Why deferred:** reputation without Sybil resistance is noise; the MVP ships
  attestations, which are already verifiable.
- **Shape:** a reviewer signs a message with their wallet and links an X account (OAuth 2
  PKCE). Reviews are off-chain rows (`Review { reportId, wallet, xHandle, verdict,
  text }`) shown on the report page; a later version can anchor a merkle root of reviews
  in the attestation account's successor.

## 3. Passive website scan tier

- **Why deferred:** requires outbound network from a sandbox to arbitrary hosts, which
  conflicts with the egress allowlist that protects the API key today.
- **Shape:** a separate, keyless container (no LLM credentials) that fetches the target
  origin once, collects headers/CSP/TLS/mixed-content/known-library versions, and hands a
  static artifact to the auditor sandbox (checklists 10 and 13). Priced as a flat tier.

## 4. Escrow program

- **Why deferred:** the MVP takes payment by plain USDC transfer with a memo and refunds
  via an admin script. That is enough for a hackathon and needs no additional on-chain
  code, but it is trust-me pricing.
- **Shape:** an Anchor `audit_escrow` program: `open(job_id, amount)` moves USDC into a
  PDA vault; the attester key `release(job_id)` on successful attestation (the attestation
  PDA is the proof), and anyone can `refund(job_id)` after a deadline if no attestation
  exists. Ties payment to delivery on-chain.

## 5. Smaller items

- Multi-worker scale-out (the claim SQL already uses `FOR UPDATE SKIP LOCKED`).
- Object storage for `reports/` (S3-compatible) with the same path contract.
- Calibrated pricing: after enough runs, fit `PRICING_CALIBRATION` per model from the
  stored quote-vs-actual pairs (`Quote.estCostUsd` vs `Report.costUsd`).
- Corpus upgrades: bump the submodule, update `CORPUS_VERSION`, re-run the self-audit.
- Re-audit flow (`/auditor:re-audit`) producing FIXED / STILL-OPEN / REGRESSED deltas
  between two attested commits.
