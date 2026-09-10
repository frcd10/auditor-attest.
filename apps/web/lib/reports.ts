import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { effectiveVisibility, parseReport, redactReport, type EffectiveVisibility, type ParsedReport, type ReportMeta } from "@auditor/report";
import { prisma, type Attestation, type Report } from "./db";
import { reportsDir } from "./env";

export type ReportRow = Report & { attestation: Attestation | null };

export interface LoadedReport {
  row: ReportRow;
  /** Every audit of this commit, newest first (the row is one of them). */
  siblings: ReportRow[];
  meta: ReportMeta | null;
  visibility: EffectiveVisibility;
  parsed: ParsedReport;
  /** Markdown to render: redacted when visibility is public_redacted. */
  markdown: string;
  redacted: boolean;
}

/**
 * All reports for owner/repo at a commit (full or ≥7-char prefix), newest first.
 * `version` selects one by id; otherwise the newest is the primary.
 */
export async function findReports(owner: string, repo: string, sha: string): Promise<ReportRow[]> {
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) return [];
  const lower = sha.toLowerCase();
  const rows = await prisma.report.findMany({
    where: { owner, repo, commit: lower.length === 40 ? lower : { startsWith: lower } },
    include: { attestation: true },
    orderBy: { createdAt: "desc" },
  });
  // A short prefix must resolve to exactly one commit.
  const commits = new Set(rows.map((r) => r.commit));
  return commits.size === 1 ? rows : [];
}

export async function findReport(owner: string, repo: string, sha: string, version?: string): Promise<{ row: ReportRow; siblings: ReportRow[] } | null> {
  const siblings = await findReports(owner, repo, sha);
  if (siblings.length === 0) return null;
  const row = (version && siblings.find((r) => r.id === version)) || siblings[0]!;
  return { row, siblings };
}

/** Load + apply disclosure rules. Returns null if the file is missing on disk. */
export function loadReport(row: ReportRow, siblings: ReportRow[] = [row]): LoadedReport | null {
  const dir = join(reportsDir(), row.storagePath);
  const mdPath = join(dir, "report.md");
  if (!existsSync(mdPath)) return null;
  const raw = readFileSync(mdPath, "utf8");
  const metaPath = join(dir, "meta.json");
  const meta = existsSync(metaPath) ? (JSON.parse(readFileSync(metaPath, "utf8")) as ReportMeta) : null;
  const parsed = parseReport(raw);
  const visibility = effectiveVisibility({
    visibility: row.visibility,
    submitterVerified: row.submitterVerified,
    redactUntil: row.redactUntil,
    maintainerAckAt: row.maintainerAckAt,
  });
  const redacted = visibility === "public_redacted";
  const markdown = redacted ? redactReport(raw, parsed, { redactUntil: row.redactUntil }) : raw;
  return { row, siblings, meta, visibility, parsed, markdown, redacted };
}
