# Self-audit

Before Phase 2 is closed, the corpus is run against this repository through the same
sandbox every customer job uses:

```bash
# from the quote page: paste this repo's GitHub URL (after it exists) or run manually:
pnpm exec tsx scripts/quote-local.ts .            # scope preview
# then a standard-tier job via the operator enqueue; ingest with visibility private
```

Expected in-scope checklists for this tree: 01–07 (programs/audit_attest), 08 (TypeScript),
09 (worker/backend), 10 (Next.js web), 11–13, 16–18 (always), 19 (Agent SDK usage).

The report will be stored here as `REPORT.md` with `meta.json`, and every High or
Critical finding fixed before the phase is closed, with the fix noted below.

## Status

Pending: requires Docker and an API key on this machine (see the summary in the
conversation / README → Requirements).

## Findings and fixes

_(filled after the run)_
