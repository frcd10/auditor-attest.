/**
 * Parser for auditor-skill reports (corpus 7.3.0@6bb2cbf).
 *
 * Two layouts exist in the corpus:
 *  - client report  (templates/audit-report.md, produced by /auditor:audit-cycle):
 *      "#### AUD-01 — Title", "| **Severity** | 🔴 Critical (internal: 10) |",
 *      "### 1.1 Findings Summary by Severity" table with per-tier counts.
 *  - internal report (templates/report-template.md, produced by /auditor:audit):
 *      "#### [F-001] Title", "| **Severity** | 8 — 🟠 HIGH |",
 *      "### Severity Distribution" table with per-score counts,
 *      "### Audit Metrics" with "Highest severity found" and "Repository Risk Score".
 *
 * Findings blocks are the ground truth for counts; declared tables are cross-checked.
 */
import {
  emptyCounts,
  scoreForTier,
  tierForScore,
  type Finding,
  type ParsedReport,
  type ReportFormat,
  type SeverityCounts,
  type SeverityTier,
} from "./types.js";

const FINDING_HEADING_RE = /^(#{2,5})\s+\[?((?:AUD|F)-\d{1,4})\]?\s*(?:[—–:\-]+\s*)?(.*?)\s*$/;
const ANY_HEADING_RE = /^#{1,5}\s/;
const FIELD_ROW_RE = /^\|\s*\*{0,2}([A-Za-z /]+?)\*{0,2}\s*\|\s*(.*?)\s*\|\s*$/;
const TIER_WORD_RE = /\b(critical|high|medium|low|informational|info)\b/i;

function tierFromWord(w: string): SeverityTier {
  const s = w.toLowerCase();
  if (s.startsWith("crit")) return "critical";
  if (s.startsWith("high")) return "high";
  if (s.startsWith("med")) return "medium";
  if (s.startsWith("low")) return "low";
  return "info";
}

function firstScore(cell: string): number | null {
  const m = cell.match(/(?<![\d.])(10|[1-9])(?![\d.%])/);
  return m ? Number(m[1]) : null;
}

function stripMd(s: string): string {
  return s.replace(/[*`_]/g, "").trim();
}

export function parseSeverityCell(cell: string): { tier: SeverityTier; score: number | null } | null {
  const score = firstScore(cell);
  const word = cell.match(TIER_WORD_RE)?.[1];
  if (score !== null) return { tier: tierForScore(score), score };
  if (word) return { tier: tierFromWord(word), score: null };
  return null;
}

function detectFormat(lines: string[]): ReportFormat {
  const text = lines.join("\n");
  if (/^#{2,5}\s+\[?F-\d+/m.test(text) || /###\s+Severity Distribution/.test(text)) return "internal";
  if (/^#{2,5}\s+AUD-\d+/m.test(text) || /Findings Summary by Severity/.test(text)) return "client";
  return "unknown";
}

function parseFindingBlocks(lines: string[], warnings: string[]): Finding[] {
  const findings: Finding[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(FINDING_HEADING_RE);
    if (!m) continue;
    const level = m[1]!.length;
    const id = m[2]!;
    const title = stripMd(m[3] ?? "");
    let end = i + 1;
    while (end < lines.length) {
      const l = lines[end]!;
      if (ANY_HEADING_RE.test(l)) {
        const lvl = l.match(/^(#+)/)![1]!.length;
        if (lvl <= level) break;
      }
      end++;
    }
    // Block content
    let tier: SeverityTier | null = null;
    let score: number | null = null;
    let status: string | null = null;
    let location: string | null = null;
    let category: string | null = null;
    for (let j = i + 1; j < end; j++) {
      const row = lines[j]!.match(FIELD_ROW_RE);
      if (!row) continue;
      const key = row[1]!.trim().toLowerCase();
      const val = row[2]!.trim();
      if (key === "severity" && tier === null) {
        const sev = parseSeverityCell(val);
        if (sev) {
          tier = sev.tier;
          score = sev.score;
        }
      } else if (key === "status") status = stripMd(val);
      else if (key === "location" || key === "file") location = val;
      else if (key === "category") category = stripMd(val);
    }
    if (tier === null) {
      // Template placeholder / example block (e.g. "[F-XXX]") or malformed: skip but warn.
      if (/X{2,}|\{|\}/.test(id + title)) continue;
      warnings.push(`finding ${id} has no parseable Severity row; skipped`);
      continue;
    }
    if (findings.some((f) => f.id === id)) {
      warnings.push(`duplicate finding id ${id}; later block ignored`);
      continue;
    }
    findings.push({ id, title, tier, score, status, location, category, startLine: i, endLine: end });
    i = end - 1;
  }
  return findings;
}

function parseDeclaredCounts(lines: string[], format: ReportFormat): SeverityCounts | null {
  const counts = emptyCounts();
  let found = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    const cells = line
      .slice(1, line.endsWith("|") ? -1 : undefined)
      .split("|")
      .map((c) => stripMd(c));
    if (cells.length < 2) continue;
    // Internal: | 10 | 🔴 CRITICAL | 0 |
    if (format !== "client" && /^(10|[1-9])$/.test(cells[0]!) && cells.length >= 3 && TIER_WORD_RE.test(cells[1]!)) {
      const n = Number(cells[2]!.replace(/[^\d]/g, ""));
      if (Number.isFinite(n)) {
        counts[tierForScore(Number(cells[0]))] += n;
        found = true;
      }
      continue;
    }
    // Client: | 🔴 Critical | 2 | 0 | 0 | 2 |   (first numeric cell is Count)
    if (format !== "internal") {
      const w = cells[0]!.match(TIER_WORD_RE)?.[1];
      if (w && /^\d+$/.test(cells[1]!) && !/^(10|[1-9])$/.test(cells[0]!)) {
        // Skip the Finding Lifecycle table (same labels, first numeric is "Discovered"):
        // the summary table comes first in the document; only take the first hit per tier.
        const t = tierFromWord(w);
        if (!found || counts[t] === 0) {
          counts[t] = Number(cells[1]);
          found = true;
        }
      }
    }
  }
  return found ? counts : null;
}

function firstMatch(lines: string[], re: RegExp): string | null {
  for (const l of lines) {
    const m = l.match(re);
    if (m) return (m[1] ?? "").trim();
  }
  return null;
}

function numberOrNull(s: string | null): number | null {
  if (s === null) return null;
  const m = s.replace(/[*`]/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function parseReport(markdown: string): ParsedReport {
  const lines = markdown.split(/\r?\n/);
  const warnings: string[] = [];
  const format = detectFormat(lines);
  const findings = parseFindingBlocks(lines, warnings);

  const counts = emptyCounts();
  for (const f of findings) counts[f.tier] += 1;

  const declaredCounts = parseDeclaredCounts(lines, format);
  if (declaredCounts) {
    for (const t of Object.keys(counts) as SeverityTier[]) {
      if (declaredCounts[t] !== counts[t]) {
        warnings.push(`declared ${t} count ${declaredCounts[t]} ≠ parsed finding blocks ${counts[t]}`);
      }
    }
  }

  const metricsHighest = numberOrNull(firstMatch(lines, /^\|\s*Highest severity found\s*\|\s*([^|]*)\|/i));
  const findingsHighest = findings.length
    ? Math.max(...findings.map((f) => f.score ?? scoreForTier(f.tier)))
    : null;
  let highestSeverity = findingsHighest;
  if (highestSeverity === null && metricsHighest !== null) highestSeverity = metricsHighest;
  if (findingsHighest !== null && metricsHighest !== null && metricsHighest !== findingsHighest) {
    warnings.push(`metrics 'Highest severity found' ${metricsHighest} ≠ findings max ${findingsHighest}`);
  }
  // When there are no finding blocks but declared counts exist, fall back to declared counts.
  let effectiveCounts = counts;
  if (findings.length === 0 && declaredCounts) {
    effectiveCounts = declaredCounts;
    const tiers: SeverityTier[] = ["critical", "high", "medium", "low", "info"];
    const top = tiers.find((t) => declaredCounts[t] > 0);
    if (top && highestSeverity === null) highestSeverity = scoreForTier(top);
    warnings.push("no finding blocks parsed; counts taken from the declared summary table");
  }

  const riskScore =
    numberOrNull(firstMatch(lines, /\*\*Repository Risk Score:\*\*\s*([^—\n]*)/)) ??
    numberOrNull(firstMatch(lines, /^\|\s*Repository Risk Score\s*\|\s*([^|]*)\|/i));

  const meta = {
    repository:
      firstMatch(lines, /^\*\*Repository:\*\*\s*(.+)$/) ??
      firstMatch(lines, /^\|\s*\*\*Repository\*\*\s*\|\s*([^|]+)\|/),
    commit:
      firstMatch(lines, /^\*\*Commit:\*\*\s*`?([0-9a-fA-F]{7,40})`?/) ??
      firstMatch(lines, /^\|\s*\*\*(?:Audited Commit|Review Start Commit)\*\*\s*\|\s*`?([0-9a-fA-F]{7,40})`?/),
    date:
      firstMatch(lines, /^\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/) ??
      firstMatch(lines, /^\|\s*\*\*Report Published\*\*\s*\|\s*(\d{4}-\d{2}-\d{2})/),
    scope: firstMatch(lines, /^\*\*Scope:\*\*\s*(.+)$/),
    auditor:
      firstMatch(lines, /^\*\*Auditor:\*\*\s*(.+)$/) ?? firstMatch(lines, /^\|\s*\*\*Auditor\*\*\s*\|\s*([^|]+)\|/),
  };
  for (const k of Object.keys(meta) as (keyof typeof meta)[]) {
    if (meta[k]) meta[k] = stripMd(meta[k]!) || null;
  }

  const metricRow = (label: string) => numberOrNull(firstMatch(lines, new RegExp(`^\\|\\s*${label}\\s*\\|\\s*([^|]*)\\|`, "i")));
  const metrics = {
    totalItems: metricRow("Total (?:checklist )?items(?: evaluated)?"),
    pass: metricRow("PASS"),
    fail: metricRow("FAIL"),
    partial: metricRow("PARTIAL"),
    na: metricRow("N/A"),
    completionPct: metricRow("Completion(?: \\(in-scope\\))?"),
  };

  if (format === "unknown") warnings.push("report format not recognised (neither client nor internal template)");

  return {
    format,
    counts: effectiveCounts,
    declaredCounts,
    findings,
    highestSeverity,
    riskScore,
    meta,
    metrics,
    warnings,
  };
}
