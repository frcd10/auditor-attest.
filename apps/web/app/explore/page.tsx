import Link from "next/link";
import { effectiveVisibility } from "@auditor/report";
import { enabledModels, loadModels } from "@auditor/pricing";
import { SeverityBadges } from "@/components/SeverityBadges";
import { prisma } from "@/lib/db";
import { shortSha, when } from "@/lib/format";

export const dynamic = "force-dynamic";

type Search = { q?: string; min?: string; model?: string; sort?: string; page?: string };
const PAGE = 25;

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const min = Number(sp.min ?? 0) || 0;
  const model = sp.model ?? "";
  const sort = sp.sort === "severity" ? "severity" : "newest";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = {
    visibility: "public" as const,
    ...(q ? { OR: [{ owner: { contains: q, mode: "insensitive" as const } }, { repo: { contains: q, mode: "insensitive" as const } }] } : {}),
    ...(min ? { highestSeverity: { gte: min } } : {}),
    ...(model ? { model } : {}),
  };
  const rows = await prisma.report.findMany({
    where,
    orderBy: sort === "severity" ? [{ highestSeverity: "desc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
    include: { attestation: true },
    take: PAGE + 1,
    skip: (page - 1) * PAGE,
  });
  // Private is excluded by the where clause; public and public_redacted are both listable.
  const visible = rows.filter((r) => effectiveVisibility({ visibility: r.visibility, submitterVerified: r.submitterVerified, redactUntil: r.redactUntil, maintainerAckAt: r.maintainerAckAt }) !== "private");
  const hasNext = visible.length > PAGE;
  const list = visible.slice(0, PAGE);
  const models = enabledModels(loadModels());

  const qs = (over: Partial<Search>) => {
    const p = new URLSearchParams({ q, min: String(min), model, sort, page: String(page), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) });
    for (const [k, v] of [...p.entries()]) if (!v || v === "0" || (k === "page" && v === "1")) p.delete(k);
    return `/explore?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Explore public audits</h1>
      <form className="panel flex flex-wrap items-end gap-3 p-4 text-sm" method="get">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted)]">Repository</span>
          <input name="q" defaultValue={q} placeholder="owner or repo" className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted)]">Min. highest severity</span>
          <select name="min" defaultValue={String(min)} className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1">
            <option value="0">any</option>
            <option value="9">Critical (9+)</option>
            <option value="7">High (7+)</option>
            <option value="5">Medium (5+)</option>
            <option value="3">Low (3+)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted)]">Model</span>
          <select name="model" defaultValue={model} className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 mono text-xs">
            <option value="">any</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted)]">Sort</span>
          <select name="sort" defaultValue={sort} className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1">
            <option value="newest">newest</option>
            <option value="severity">highest severity</option>
          </select>
        </label>
        <button type="submit" className="rounded-md bg-[var(--accent)] px-3 py-1 font-semibold text-black">
          Filter
        </button>
      </form>

      {list.length === 0 && <p className="text-sm text-[var(--muted)]">No public reports match.</p>}
      <ul className="space-y-3">
        {list.map((r) => {
          const vis = effectiveVisibility({ visibility: r.visibility, submitterVerified: r.submitterVerified, redactUntil: r.redactUntil, maintainerAckAt: r.maintainerAckAt });
          return (
            <li key={r.id} className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/r/${r.owner}/${r.repo}/${r.commit}`} className="font-semibold">
                  {r.owner}/{r.repo} <span className="mono text-xs text-[var(--muted)]">@ {shortSha(r.commit)}</span>
                </Link>
                <span className="text-xs text-[var(--muted)] mono">
                  {r.model} · {when(r.finishedAt ?? r.createdAt)} · {vis === "public_redacted" ? "Critical/High redacted" : "full disclosure"}
                  {r.attestation ? " · attested ✓" : ""}
                </span>
              </div>
              <div className="mt-2">
                <SeverityBadges size="sm" counts={{ critical: r.critical, high: r.high, medium: r.medium, low: r.low, info: r.info }} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-3 text-sm">
        {page > 1 && <Link href={qs({ page: String(page - 1) })}>← Previous</Link>}
        {hasNext && <Link href={qs({ page: String(page + 1) })}>Next →</Link>}
      </div>
    </div>
  );
}
