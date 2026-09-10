# Local report store

```
reports/<owner>/<repo>/<commit-sha>/<corpus>__<model>/
  report.md      # auditor output, byte-for-byte (sha256 of this file goes on-chain)
  meta.json      # { repo, owner, name, commit, corpus_version, model, started_at, finished_at,
                 #   report_sha256, counts:{critical,high,medium,low,info}, highest_severity,
                 #   visibility:"public"|"private"|"public_redacted", submitter_verified,
                 #   attestation:{tx,pda,program_id}|null, usage:{input_tokens,output_tokens,cost_usd,...},
                 #   parser:{format,declared_counts,risk_score,warnings}, job_id, tier }
  run.json       # sandbox runner output: per-call usage, per-model totals, turn results
  artifacts/     # the auditor's intermediate files (intake.md, threat-model.md, worksheets)
```

One directory per audit of a commit: the same commit re-audited with a newer corpus or a
different model gets its own directory and its own database row, and the report page
lists them as "other audits of this commit". The on-chain attestation account is per
(repo, commit) and holds the most recently attested report's hash (`reattest`).

`<corpus>` and `<model>` are filesystem slugs (`7.3.0@6bb2cbf` → `7.3.0-6bb2cbf`).
Everything under here except this README is gitignored. Reports are data, not code.
