#!/usr/bin/env bash
# Run scripts/audit-local.sh over every clone in "examples i runned local", one at a time,
# smallest program first, skipping clones that already have a report for the current corpus.
# Each result is published to the site (--ingest). Log: audit-all.log in the repo root.
#
#   pnpm audit:all                     # everything not yet audited with 7.3.0
#   pnpm audit:all -- --only kamino    # substring filter
#   pnpm audit:all -- --scope full
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
ONLY=""; EXTRA=()
while [ $# -gt 0 ]; do
  case "$1" in
    --only) ONLY="$2"; shift 2 ;;
    *) EXTRA+=("$1"); shift ;;
  esac
done
CORPUS_VERSION="${CORPUS_VERSION:-7.3.0@6bb2cbf}"
LOG="audit-all.log"

# Order by Rust LOC ascending so the cheap ones land first.
list=()
while IFS= read -r d; do
  rel="${d#examples i runned local/}"
  [ -n "$ONLY" ] && ! echo "$rel" | grep -qi -- "$ONLY" && continue
  if grep -rqs "\"corpus\": \"$CORPUS_VERSION\"" "$d"/audit_*/.attest.json 2>/dev/null; then
    echo "skip $rel: already audited with $CORPUS_VERSION" | tee -a "$LOG"
    continue
  fi
  loc=$(tokei --output json "$d" 2>/dev/null | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log((j.Rust||{code:0}).code)" 2>/dev/null || echo 0)
  list+=("$loc	$rel")
done < <(find "examples i runned local" -mindepth 2 -maxdepth 2 -type d -name '*' | while read -r d; do [ -d "$d/.git" ] && echo "$d"; done | sort)

[ ${#list[@]} -gt 0 ] || { echo "nothing to do"; exit 0; }
printf '%s\n' "${list[@]}" | sort -n | cut -f2 > /tmp/audit-all.queue
echo "queue ($(wc -l < /tmp/audit-all.queue)):" | tee -a "$LOG"; cat /tmp/audit-all.queue | tee -a "$LOG"

ok=0; fail=0
while IFS= read -r rel; do
  echo "=== $(date -u +%FT%TZ) start $rel" | tee -a "$LOG"
  if bash scripts/audit-local.sh "$rel" --ingest "${EXTRA[@]}" >> "$LOG" 2>&1; then
    ok=$((ok+1)); echo "=== $(date -u +%FT%TZ) done  $rel" | tee -a "$LOG"
  else
    fail=$((fail+1)); echo "=== $(date -u +%FT%TZ) FAIL  $rel (see $LOG)" | tee -a "$LOG"
  fi
done < /tmp/audit-all.queue
echo "finished: $ok ok, $fail failed" | tee -a "$LOG"
