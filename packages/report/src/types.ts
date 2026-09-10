export type SeverityTier = "critical" | "high" | "medium" | "low" | "info";

export const TIERS: readonly SeverityTier[] = ["critical", "high", "medium", "low", "info"];

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface Finding {
  /** "AUD-01" (client report) or "F-001" (internal report). */
  id: string;
  title: string;
  tier: SeverityTier;
  /** Internal 1-10 score when the report states it. */
  score: number | null;
  status: string | null;
  location: string | null;
  category: string | null;
  /** 0-based line range [start, end) of the finding block in the source markdown. */
  startLine: number;
  endLine: number;
}

export type ReportFormat = "client" | "internal" | "unknown";

export interface ParsedReport {
  format: ReportFormat;
  /** Counts derived from the parsed finding blocks (ground truth for redaction and on-chain). */
  counts: SeverityCounts;
  /** Counts the report declares in its summary table, if present. Compared against `counts`. */
  declaredCounts: SeverityCounts | null;
  findings: Finding[];
  /** Highest internal severity (1-10). Null when there are no findings. */
  highestSeverity: number | null;
  /** Internal "Repository Risk Score" when present (client reports omit it by design). */
  riskScore: number | null;
  /** Free-form metadata pulled from the executive summary / cover table. */
  meta: {
    repository: string | null;
    commit: string | null;
    date: string | null;
    scope: string | null;
    auditor: string | null;
  };
  metrics: {
    totalItems: number | null;
    pass: number | null;
    fail: number | null;
    partial: number | null;
    na: number | null;
    completionPct: number | null;
  };
  warnings: string[];
}

/** Severity tier for an internal 1-10 score (OUTPUT-RULES.md Rule 1). */
export function tierForScore(n: number): SeverityTier {
  if (n >= 9) return "critical";
  if (n >= 7) return "high";
  if (n >= 5) return "medium";
  if (n >= 3) return "low";
  return "info";
}

/** Representative score for a tier when the report only gives the label. */
export function scoreForTier(t: SeverityTier): number {
  switch (t) {
    case "critical":
      return 9;
    case "high":
      return 7;
    case "medium":
      return 5;
    case "low":
      return 3;
    default:
      return 1;
  }
}

export function tierLabel(t: SeverityTier): string {
  switch (t) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return "Informational";
  }
}

export function emptyCounts(): SeverityCounts {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
}
