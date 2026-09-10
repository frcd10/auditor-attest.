import { prisma } from "@/lib/db";
import { effectiveVisibility } from "@auditor/report";

export const dynamic = "force-dynamic";

const COLORS = { critical: "#e5484d", high: "#f76b15", medium: "#f5d90a", low: "#3e9bff", info: "#8b8d98", none: "#30a46c", unknown: "#8b8d98" } as const;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** shields.io-style flat badge. Widths approximate 6.5px per character at 11px Verdana. */
export function badgeSvg(label: string, value: string, color: string): string {
  const lw = Math.round(label.length * 6.5 + 12);
  const vw = Math.round(value.length * 6.5 + 12);
  const w = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(label)}: ${esc(value)}">
<title>${esc(label)}: ${esc(value)}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${vw}" height="20" fill="${color}"/><rect width="${w}" height="20" fill="url(#s)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2}" y="15" fill="#010101" fill-opacity=".3">${esc(label)}</text><text x="${lw / 2}" y="14">${esc(label)}</text>
<text x="${lw + vw / 2}" y="15" fill="#010101" fill-opacity=".3">${esc(value)}</text><text x="${lw + vw / 2}" y="14">${esc(value)}</text>
</g></svg>`;
}

export async function GET(_req: Request, ctx: { params: Promise<{ owner: string; file: string }> }) {
  const { owner, file } = await ctx.params;
  if (!file.endsWith(".svg")) return new Response("not found", { status: 404 });
  const repo = file.slice(0, -4);
  const rows = await prisma.report.findMany({ where: { owner, repo, visibility: "public" }, orderBy: { createdAt: "desc" }, take: 5, include: { attestation: true } });
  const latest = rows.find((r) => effectiveVisibility({ visibility: r.visibility, submitterVerified: r.submitterVerified, redactUntil: r.redactUntil, maintainerAckAt: r.maintainerAckAt }) !== "private");
  let svg: string;
  if (!latest) {
    svg = badgeSvg("audit", "not audited", COLORS.unknown);
  } else {
    const value = `${latest.critical}C ${latest.high}H ${latest.medium}M ${latest.low}L${latest.attestation ? " ✓" : ""}`;
    const tier = latest.critical ? "critical" : latest.high ? "high" : latest.medium ? "medium" : latest.low ? "low" : latest.info ? "info" : "none";
    svg = badgeSvg(`audit @${latest.commit.slice(0, 7)}`, value, COLORS[tier]);
  }
  return new Response(svg, {
    headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=300", "x-content-type-options": "nosniff" },
  });
}
