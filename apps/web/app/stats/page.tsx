import { StatTile } from "@/components/StatTile";
import { prisma } from "@/lib/db";
import { clusterLabel } from "@/lib/env";
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
  return (
    <div className="container-x space-y-6 pt-8 pb-6">
      <div>
        <h1 className="h-section text-3xl">Stats</h1>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">Totals across every audit, public and private. Counts are never sensitive; finding text is, and stays in the report.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Repositories audited" value={int(repos.length)} />
        <StatTile label="Reports" value={int(agg._count._all)} />
        <StatTile label={`Attested on ${clusterLabel()}`} value={int(attested)} />
        <StatTile label="Model spend (users' keys)" value={usd(s.costUsd ? Number(s.costUsd) : 0)} accent="plain" hint="at config/models.json rates" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Critical" value={int(s.critical ?? 0)} accent="critical" />
        <StatTile label="High" value={int(s.high ?? 0)} accent="high" />
        <StatTile label="Medium" value={int(s.medium ?? 0)} accent="medium" />
        <StatTile label="Low" value={int(s.low ?? 0)} accent="low" />
        <StatTile label="Informational" value={int(s.info ?? 0)} accent="plain" />
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-lg font-semibold">By model</h2>
          <table className="table mt-3">
            <thead>
              <tr>
                <th>Model</th>
                <th>Reports</th>
                <th>Avg cost</th>
              </tr>
            </thead>
            <tbody>
              {byModel.map((m) => (
                <tr key={m.model}>
                  <td className="mono">{m.model}</td>
                  <td className="mono">{m._count._all}</td>
                  <td className="mono">{usd(m._avg.costUsd ? Number(m._avg.costUsd) : null)}</td>
                </tr>
              ))}
              {byModel.length === 0 && (
                <tr>
                  <td className="text-[var(--muted)]" colSpan={3}>No reports yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-semibold">Tokens and jobs</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-[var(--muted)]">Input tokens</dt>
            <dd className="mono text-right">{int(s.inputTokens ?? 0)}</dd>
            <dt className="text-[var(--muted)]">Output tokens</dt>
            <dd className="mono text-right">{int(s.outputTokens ?? 0)}</dd>
          </dl>
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Jobs by status</h3>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {jobs.map((j) => (
              <li key={j.status} className="flex justify-between border-b border-[var(--border)] py-1">
                <span className="text-[var(--muted)]">{j.status}</span>
                <span className="mono">{j._count._all}</span>
              </li>
            ))}
            {jobs.length === 0 && <li className="text-[var(--muted)]">No jobs yet.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
