import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { effectiveVisibility, parseReport, redactReport, type EffectiveVisibility, type ParsedReport, type ReportMeta } from "@auditor/report";
import { prisma, type Attestation, type Report } from "./db";
import { reportsDir } from "./env";

export interface LoadedReport {
  row: Report & { attestation: Attestation | null };
  meta: ReportMeta | null;
  visibility: EffectiveVisibility;
  parsed: ParsedReport;
  /** Markdown to render: redacted when visibility is public_redacted. */
  markdown: string;
  redacted: boolean;
}

export async function findReport(owner: string, repo: string, sha: string): Promise<(Report & { attestation: Attestation | null }) | null> {
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) return null;
  const lower = sha.toLowerCase();
  if (lower.length === 40) {
    return prisma.report.findUnique({ where: { owner_repo_commit: { owner, repo, commit: lower } }, include: { attestation: true } });
  }
  const rows = await prisma.report.findMany({ where: { owner, repo, commit: { startsWith: lower } }, include: { attestation: true }, take: 2 });
  return rows.length === 1 ? rows[0]! : null;
}

/** Load + apply disclosure rules. Returns null if the file is missing on disk. */
export function loadReport(row: Report & { attestation: Attestation | null }): LoadedReport | null {
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
  return { row, meta, visibility, parsed, markdown, redacted };
}
