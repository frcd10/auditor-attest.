# Phase 3 — Public surface

## What was built

- **`/explore`**: public reports (public and public_redacted; private never listed) with
  filters: owner/repo substring, minimum highest severity, model, sort by newest or
  severity, pagination. Each row shows the severity badges, model, date, disclosure
  state and whether it is attested.
- **`/stats`**: repositories audited, reports, attestations, findings by tier (totals
  include private reports since counts are never sensitive), by-model table with average
  cost, LLM spend and token totals, jobs by status.
- **Maintainer verification via GitHub OAuth** (`/api/auth/github`, `/api/auth/github/callback`):
  HMAC-signed state (no session store), `public_repo read:user` scope, permission read
  from `GET /repos/{owner}/{repo}.permissions` — `admin` or `maintain` counts. The token
  is used for two calls and discarded. Two flows:
  - from the quote page: marks the job's submitter as verified (full public disclosure
    immediately) and, if the report already exists, also acknowledges it;
  - from a redacted report page: "Maintainer? Acknowledge with GitHub" sets
    `maintainerAckAt`, which flips the effective visibility to public. The worker's
    visibility sync then updates the on-chain byte.
  Verifications are stored in `MaintainerVerification` per (user, owner, repo).

## How to run

Create a GitHub OAuth App (callback `${NEXT_PUBLIC_SITE_URL}/api/auth/github/callback`)
and set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `AUTH_SECRET` (32+ chars). Without
them the verify/acknowledge links are hidden and everything else works.

## Left out (and why)

- Org-level verification (a user who is an org owner but not a repo admin): GitHub's
  `permissions` object already reflects org roles, so this works transitively; no extra
  code.
- Search over finding text: reports are files, not indexed; roadmap if needed.
