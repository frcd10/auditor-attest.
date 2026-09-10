# Upstream wishlist for solanabr/auditor-skill

Things this platform works around in its own prompt layer because the pinned corpus
(7.3.0 @ 6bb2cbf) does not provide them. Nothing in `vendor/auditor-skill` is modified.

1. **Machine-readable report summary.** The client report template carries counts in a
   markdown table and per-finding severity in a `| **Severity** | 🔴 Critical (internal: 10) |`
   row. A small front-matter or JSON sidecar (`audit_<n>/summary.json` with counts, highest
   severity, commit, corpus version) would remove the need for a markdown parser and make
   the on-chain counts trivially reproducible. `packages/report` parses the markdown today.
2. **Non-interactive output location.** `audit-cycle` writes to `audit_<n>/` relative to
   cwd. An explicit `--out <dir>` (or `AUDITOR_OUT` env) would let hosts keep the target
   read-only without relying on the prompt layer to say "use /work/audit_1".
3. **`discovery/file-map.md` adaptation.** README says the file map should be edited per
   repo. That cannot happen for a hosted service that never modifies the corpus; the
   commands cope by discovering the tree, but a note that the defaults are advisory (or a
   glob-discovery fallback) would help.
4. **Version tag.** 7.3.0 has no git tag; the version string used everywhere here is
   `7.3.0@6bb2cbf`. A `v7.3.0` tag would make the attestation's corpus_version resolvable by
   humans without a SHA lookup.
5. **Cost table for current models.** COSTS.md prices Opus 4 / Sonnet 4 / Haiku. The
   formula components are still what this platform uses, but the per-model dollar tables
   are stale; a per-1M-token formula (which COSTS.md already implies) plus a
   `models.json` would let hosts plug in current rates.
6. **`Tools & Versions` appendix says `auditor-skill: v6.0`** in `templates/audit-report.md`
   while the cover table says v7.3. Cosmetic.
7. **Known Vector Metrics says "Total known vectors | 131"** in `references/report-format.md`
   while the index has 136. Cosmetic.
