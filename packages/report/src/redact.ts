/**
 * Redaction for `public_redacted` reports: Critical and High findings are withheld
 * (block, summary-table rows, and any paragraph or bullet that names the finding id)
 * while counts and everything else stay visible. Enforced in code, not policy text.
 *
 * Conservative rule: when the report declares more Critical/High findings than the
 * parser could classify, every unclassified finding block is withheld too.
 */
import { tierLabel, type Finding, type ParsedReport, type SeverityTier } from "./types.js";

export const REDACTED_TIERS: readonly SeverityTier[] = ["critical", "high"];

export interface RedactOptions {
  /** ISO date shown in the placeholder. */
  redactUntil?: Date | string | null;
  tiers?: readonly SeverityTier[];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Which findings must be withheld for the given tiers. */
export function redactionTargets(parsed: ParsedReport, tiers: readonly SeverityTier[] = REDACTED_TIERS): Finding[] {
  const set = new Set(tiers);
  const classified = parsed.findings.filter((f) => f.tier !== null && set.has(f.tier));
  const declared = tiers.reduce((n, t) => n + parsed.counts[t], 0);
  const unclassified = parsed.findings.filter((f) => f.tier === null);
  return declared > classified.length ? [...classified, ...unclassified] : classified;
}

/**
 * The placeholder keeps the id and a Severity row in the template's own format so a
 * redacted report re-parses to the same finding tiers as the original.
 */
function placeholder(f: Finding, until: string | null): string {
  const when = until ? ` or until ${until}` : "";
  const sev = f.tier ? `${tierLabel(f.tier)}${f.score ? ` (internal: ${f.score})` : ""}` : "withheld";
  return [
    `#### ${f.id} — [redacted]`,
    "",
    `| Field | Value |`,
    `| --- | --- |`,
    `| **Severity** | ${sev} |`,
    `| **Status** | Withheld |`,
    "",
    `> 🔒 **${f.id} — ${sev}.** Details withheld.`,
    `> This finding is disclosed only after the repository maintainer acknowledges it${when}.`,
    `> Severity counts remain visible.`,
    "",
  ].join("\n");
}

export function redactReport(markdown: string, parsed: ParsedReport, opts: RedactOptions = {}): string {
  const targets = redactionTargets(parsed, opts.tiers ?? REDACTED_TIERS);
  if (targets.length === 0) return markdown;

  const until =
    opts.redactUntil instanceof Date
      ? opts.redactUntil.toISOString().slice(0, 10)
      : typeof opts.redactUntil === "string"
        ? opts.redactUntil
        : null;

  const lines = markdown.split(/\r?\n/);
  const out: (string | null)[] = [...lines];
  const idRe = new RegExp(`\\b(${targets.map((f) => escapeRe(f.id)).join("|")})\\b`);
  const byId = new Map(targets.map((f) => [f.id, f]));

  // 1. Replace whole finding blocks.
  for (const f of targets) {
    out[f.startLine] = placeholder(f, until);
    for (let i = f.startLine + 1; i < f.endLine; i++) out[i] = null;
  }

  // 2. Table rows + paragraphs that mention a redacted id outside its block.
  const inBlock = (i: number) => targets.some((f) => i >= f.startLine && i < f.endLine);
  for (let i = 0; i < lines.length; i++) {
    if (out[i] === null || inBlock(i)) continue;
    const line = lines[i]!;
    const m = line.match(idRe);
    if (!m) continue;
    const f = byId.get(m[1]!)!;
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      const cells = trimmed.slice(1, trimmed.endsWith("|") ? -1 : undefined).split("|");
      const rebuilt = cells.map((c) => {
        const t = c.trim();
        if (t === f.id || t === `[${f.id}]`) return ` ${t} `;
        if (/critical|high/i.test(t) && t.length < 40) return ` ${t} `;
        return " [redacted] ";
      });
      out[i] = `|${rebuilt.join("|")}|`;
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed)) {
      out[i] = trimmed.replace(/^(#{1,6}\s+).*$/, `$1${f.id} — [redacted]`);
      continue;
    }
    let s = i;
    while (s > 0 && lines[s - 1]!.trim() !== "" && !/^#{1,6}\s/.test(lines[s - 1]!) && !lines[s - 1]!.trim().startsWith("|")) s--;
    let e = i;
    while (e + 1 < lines.length && lines[e + 1]!.trim() !== "" && !/^#{1,6}\s/.test(lines[e + 1]!) && !lines[e + 1]!.trim().startsWith("|")) e++;
    const bullet = /^(\s*(?:[-*+]|\d+\.)\s+)/.exec(lines[s]!)?.[1] ?? "";
    out[s] = `${bullet}🔒 [redacted — refers to ${f.id} (${tierLabel(f.tier)})]`;
    for (let k = s + 1; k <= e; k++) out[k] = null;
    i = e;
  }

  return out.filter((l): l is string => l !== null).join("\n");
}

/** Public-safe subset for badges/explore: counts + highest, no titles. */
export function publicSummary(parsed: ParsedReport) {
  return { counts: parsed.counts, highestSeverity: parsed.highestSeverity, findings: parsed.findings.length };
}
