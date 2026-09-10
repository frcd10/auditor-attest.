import { prisma } from "@/lib/db";
import { int, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const [agg, repos, attested, byModel, jobs] = await Promise.all([
    prisma.report.aggregate({ _count: { _all: true }, _sum: { critical: true, high: true, medium: true, low: true, info: true, costUsd: true, inputTokens: true, outputTokens: true } }),
    prisma.report.groupBy({ by: ["owner", "repo"] }),
    prisma.attestation.count(),
    prisma.report.groupBy({ by: ["model"], _count: { _all: true }, _avg: { costUsd: true } }),
    prisma.job.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const s = agg._sum;
  const tiles: [string, string][] = [
    ["Repositories audited", int(repos.length)],
    ["Reports", int(agg._count._all)],
    ["Attested on mainnet", int(attested)],
    ["Critical found", int(s.critical ?? 0)],
    ["High found", int(s.high ?? 0)],
    ["Medium found", int(s.medium ?? 0)],
    ["Low found", int(s.low ?? 0)],
    ["Informational", int(s.info ?? 0)],
  ];
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Stats</h1>
      <p className="text-sm text-[var(--muted)]">Severity totals include private reports (counts are never sensitive; finding text is). Public reports are listed under Explore.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="panel p-4">
            <div className="text-xs text-[var(--muted)]">{label}</div>
            <div className="mt-1 text-2xl font-semibold mono">{value}</div>
          </div>
        ))}
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="panel p-4">
          <h2 className="font-semibold">By model</h2>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="py-1">Model</th>
                <th className="py-1">Reports</th>
                <th className="py-1">Avg cost</th>
              </tr>
            </thead>
            <tbody>
              {byModel.map((m) => (
                <tr key={m.model} className="border-t border-[var(--border)]">
                  <td className="py-1 mono">{m.model}</td>
                  <td className="py-1 mono">{m._count._all}</td>
                  <td className="py-1 mono">{usd(m._avg.costUsd ? Number(m._avg.costUsd) : null)}</td>
                </tr>
              ))}
              {byModel.length === 0 && (
                <tr>
                  <td className="py-1 text-[var(--muted)]" colSpan={3}>
                    No reports yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="panel p-4">
          <h2 className="font-semibold">Spend and tokens</h2>
          <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-[var(--muted)]">LLM cost (all reports)</dt>
            <dd className="mono">{usd(s.costUsd ? Number(s.costUsd) : 0)}</dd>
            <dt className="text-[var(--muted)]">Input tokens</dt>
            <dd className="mono">{int(s.inputTokens ?? 0)}</dd>
            <dt className="text-[var(--muted)]">Output tokens</dt>
            <dd className="mono">{int(s.outputTokens ?? 0)}</dd>
          </dl>
          <h3 className="mt-4 text-xs font-semibold text-[var(--muted)]">Jobs by status</h3>
          <ul className="mt-1 grid grid-cols-2 gap-x-4 text-xs mono">
            {jobs.map((j) => (
              <li key={j.status} className="flex justify-between">
                <span>{j.status}</span>
                <span>{j._count._all}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
