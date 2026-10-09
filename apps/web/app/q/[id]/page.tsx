import Link from "next/link";
import { notFound } from "next/navigation";
import { CHECKLISTS, LIMIT_HEADROOM, VECTOR_GROUPS, enabledModels, loadModels, type LanguageMix, type Scope, type TokenBreakdown } from "@auditor/pricing";
import { RememberJob } from "@/components/RecentJobs";
import { StatusPill } from "@/components/StatusPill";
import { Stepper, type Step } from "@/components/Stepper";
import { prisma } from "@/lib/db";
import { actionsUrl } from "@/lib/dispatch";
import { clusterLabel, siteRepoUrl } from "@/lib/env";
import { int, shortSha, usd, when } from "@/lib/format";
import { startAudit } from "../../actions";
import { Poll } from "./Poll";

export const dynamic = "force-dynamic";

const LIVE = new Set(["quoting", "quote_running", "queued", "running", "ingesting"]);
type PerModel = Record<string, { estCostUsd: number; rawCostUsd: number; suggestedLimitUsd: number; tokens: TokenBreakdown; typicalMinutes: [number, number] }>;

function steps(status: string, hasReport: boolean): Step[] {
  const failed = ["failed", "failed_budget", "cancelled"].includes(status);
  const order = ["Quote", "Your key", "Audit", "Report"];
  const idx: Record<string, number> = { quoting: 0, quote_running: 0, quoted: 1, awaiting_payment: 1, queued: 2, running: 2, ingesting: 2, done: 4 };
  const cur = failed ? 2 : (idx[status] ?? 0);
  return order.map((label, i) => {
    let state: Step["state"] = i < cur ? "done" : i === cur ? "current" : "todo";
    if (status === "done" && hasReport) state = "done";
    if (failed && i === cur) state = "failed";
    return { label, state };
  });
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { quote: true, report: { include: { attestation: true } }, events: { orderBy: { at: "desc" }, take: 30 } },
  });
  if (!job) notFound();
  const q = job.quote;
  const models = enabledModels(loadModels());
  const breakdown = (q?.breakdown ?? {}) as { chosen?: TokenBreakdown; perModel?: PerModel; reasons?: string[]; auditScope?: string; excluded?: { language: string; code: number; files: number; reason: string }[]; description?: string | null; archived?: boolean };
  const rawScope = (q?.scope ?? null) as Partial<Scope> | null;
  const scope: Scope | null = rawScope && Array.isArray(rawScope.checklists) ? { checklists: rawScope.checklists, vectorGroups: rawScope.vectorGroups ?? [], itemCount: rawScope.itemCount ?? 0, vectorCount: rawScope.vectorCount ?? 0, checklistFraction: rawScope.checklistFraction ?? 0, vectorFraction: rawScope.vectorFraction ?? 0, reasons: rawScope.reasons ?? [] } : null;
  const languages = (q?.languages ?? {}) as unknown as LanguageMix;
  const langRows = Object.entries(languages).sort((a, b) => b[1].code - a[1].code);
  const totalCode = langRows.reduce((n, [, v]) => n + v.code, 0) || 1;
  const rustLoc = languages["Rust"]?.code ?? 0;
  const canConfigure = job.status === "quoted" && !!q && q.expiresAt.getTime() > Date.now();
  const expired = job.status === "quoted" && !!q && q.expiresAt.getTime() <= Date.now();
  const reportHref = job.report ? `/r/${job.owner}/${job.repo}/${job.report.commit}${job.report.visibility === "private" ? `?t=${job.report.accessToken}` : ""}` : null;
  const chosen = breakdown.perModel?.[q?.model ?? ""] ?? null;
  const headroomPct = Math.round((LIMIT_HEADROOM - 1) * 100);

  return (
    <div className="container-x space-y-8 pt-12 pb-8">
      <Poll active={LIVE.has(job.status)} />
      <RememberJob id={job.id} owner={job.owner} repo={job.repo} at={job.createdAt.getTime()} />

      {/* Header */}
      <section className="card card-gradient p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Audit job</div>
            <h1 className="h-section mt-1 text-3xl sm:text-4xl">
              <a href={job.repoUrl} target="_blank" rel="noreferrer">{job.owner}/{job.repo}</a>
            </h1>
            <p className="mono mt-2 text-sm text-[var(--muted)]">
              {job.ref ? `ref ${job.ref}` : "default branch"} · commit{" "}
              {job.commitSha ? <a href={`${job.repoUrl}/commit/${job.commitSha}`} target="_blank" rel="noreferrer" className="text-white">{shortSha(job.commitSha)}</a> : "resolving…"} · {job.scope} scope · {job.visibility}
            </p>
            {breakdown.description && <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">{breakdown.description}</p>}
          </div>
          <StatusPill status={job.status} />
        </div>
        <div className="mt-6">
          <Stepper steps={steps(job.status, !!job.report)} />
        </div>
        {LIVE.has(job.status) && (
          <p className="mt-4 text-sm text-[var(--muted)]">
            This page refreshes itself while the job is running. The audit takes {chosen ? `${chosen.typicalMinutes[0]}–${chosen.typicalMinutes[1]}` : "15–25"} minutes.
            {" "}You can also watch the runner on <a href={actionsUrl()} target="_blank" rel="noreferrer" className="underline">GitHub Actions ↗</a>.
          </p>
        )}
      </section>

      {job.error && <div className="rounded-2xl border border-[var(--critical)] bg-[#2a1216] p-4 text-sm">{job.error}</div>}
      {breakdown.archived && <div className="rounded-2xl border border-[var(--high)] bg-[#2a1f12] p-4 text-sm">This repository is archived on GitHub. You can still audit it, but nobody is maintaining it.</div>}

      {/* Report ready */}
      {job.status === "done" && job.report && reportHref && (
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Report ready</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {job.report.critical} critical · {job.report.high} high · {job.report.medium} medium · {job.report.low} low · {job.report.info} info
                {job.report.attestation ? ` · attested on ${clusterLabel()}` : ""}
                {job.report.visibility === "private" ? " · private link, keep the token" : ""}
              </p>
              <p className="mt-2 text-xs text-[var(--high)]">Now delete the API key you used for this audit in the Anthropic Console. It has done its job.</p>
            </div>
            <Link href={reportHref} className="btn btn-accent">Open report →</Link>
          </div>
        </section>
      )}
      {["failed", "failed_budget"].includes(job.status) && (
        <section className="card p-6 text-sm text-[var(--muted)]">
          The run did not produce a report. Nothing was charged by us; whatever the model consumed shows in your Anthropic Console. Delete the key you used, then submit the repository again (a new key, same limit) or <a href={`${siteRepoUrl()}/issues`} target="_blank" rel="noreferrer" className="underline">open an issue ↗</a> with this job id: <span className="mono">{job.id}</span>.
        </section>
      )}

      {/* Step 1: quote */}
      {q ? (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="card p-6">
              <h2 className="text-lg font-semibold">1 · Repository size</h2>
              <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-[var(--muted)]">Rust (program) lines</dt>
                <dd className="mono">{int(rustLoc)}</dd>
                <dt className="text-[var(--muted)]">All code lines</dt>
                <dd className="mono">{int(q.loc)}</dd>
                <dt className="text-[var(--muted)]">Files</dt>
                <dd className="mono">{int(q.files)}</dd>
                <dt className="text-[var(--muted)]">Quote expires</dt>
                <dd className="mono">{when(q.expiresAt)}</dd>
              </dl>
              <div className="mt-4 space-y-2">
                {langRows.slice(0, 8).map(([lang, v]) => (
                  <div key={lang} className="text-xs">
                    <div className="flex justify-between">
                      <span>{lang}</span>
                      <span className="mono text-[var(--muted)]">~{int(v.code)} · {v.files} files</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded bg-white/10">
                      <div className="h-1.5 rounded" style={{ width: `${Math.max(1, (v.code / totalCode) * 100)}%`, background: "var(--gradient)" }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--dim)]">Lines are estimated from file sizes via the GitHub API (no clone). The cost barely depends on them.</p>
              {!!breakdown.excluded?.length && (
                <p className="mt-2 text-xs text-[var(--dim)]">Not counted: {breakdown.excluded.map((e) => `${e.language} (${int(e.code)} lines, ${e.reason})`).join("; ")}</p>
              )}
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-semibold">What the audit loads</h2>
              {scope && (
                <>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {scope.itemCount} checklist items across {scope.checklists.length} checklists · {scope.vectorCount} known attack vectors
                  </p>
                  <ul className="mt-3 grid grid-cols-1 gap-x-4 text-xs sm:grid-cols-2">
                    {CHECKLISTS.filter((c) => scope.checklists.includes(c.id)).map((c) => (
                      <li key={c.id} className="flex justify-between border-b border-[var(--border)] py-1">
                        <span>
                          <span className="mono text-[var(--muted)]">{c.id}</span> {c.name}
                        </span>
                        <span className="mono text-[var(--muted)]">{c.items}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs font-semibold">Known-vector groups</p>
                  <ul className="mt-1 text-xs text-[var(--muted)]">
                    {VECTOR_GROUPS.filter((g) => scope.vectorGroups.includes(g.id)).map((g) => (
                      <li key={g.id}>
                        {g.name} <span className="mono">({g.range})</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-[var(--dim)]">{scope.reasons.join(" · ")}</p>
                </>
              )}
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-semibold">Estimated cost on your key</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              We charge nothing. The model is billed to your Anthropic account at list prices. The figures below are upper bounds for a normal run
              (fitted on our own audits with a {Number(q.calibration)}× safety factor, see <a href={`${siteRepoUrl()}/blob/main/docs/calibration.md`} target="_blank" rel="noreferrer" className="underline">docs/calibration.md ↗</a>).
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Estimated cost</th>
                    <th>Set the spend limit to</th>
                    <th>Typical time</th>
                    <th>Tokens read (mostly cached)</th>
                    <th>Tokens written</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => {
                    const pm = breakdown.perModel?.[m.id];
                    if (!pm) return null;
                    return (
                      <tr key={m.id} className={m.id === q.model ? "font-semibold" : ""}>
                        <td className="mono">{m.id}</td>
                        <td className="mono">{usd(pm.estCostUsd)}</td>
                        <td className="mono">{usd(pm.suggestedLimitUsd, 0)}</td>
                        <td className="mono">{pm.typicalMinutes[0]}–{pm.typicalMinutes[1]} min</td>
                        <td className="mono">{int(pm.tokens.inputTotal)}</td>
                        <td className="mono">{int(pm.tokens.output)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Step 2: key */}
          {canConfigure && (
            <section className="card p-6">
              <h2 className="text-lg font-semibold">2 · Create a key for this audit only</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Spend limits in the Anthropic Console are per <b>workspace</b>, not per key. So the safe way is a throwaway workspace with a hard limit, one key inside it, and both gone when the audit is over. Five minutes.
              </p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
                <li>
                  Open <a href="https://platform.claude.com/settings/workspaces" target="_blank" rel="noreferrer" className="underline">Console → Settings → Workspaces ↗</a> and click <b>Create workspace</b>. Name it something like <span className="mono">audit-{job.repo}</span>.
                </li>
                <li>
                  In that workspace, open <b>Limits</b> and set the <b>monthly spend limit</b> to{" "}
                  <b className="mono">{chosen ? usd(chosen.suggestedLimitUsd, 0) : "the figure in the table"}</b>
                  {" "}(the estimate plus {headroomPct}% headroom). If the limit is hit, the run stops and you get no report, so do not go lower.
                </li>
                <li>
                  Open <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer" className="underline">API keys ↗</a>, click <b>Create key</b>, pick the new workspace, copy the key.
                </li>
                <li>Paste it below. We encrypt it at rest, the runner decrypts it in memory, wipes the stored copy before the model starts, and never logs it.</li>
                <li>
                  <b>When the report is ready, delete the key</b> (and archive the workspace). A key that was used anywhere should never stay alive.
                </li>
              </ol>
              <form action={startAudit} className="mt-6 grid gap-6 md:grid-cols-2">
                <input type="hidden" name="jobId" value={job.id} />
                <div className="space-y-4 text-sm">
                  <label className="block">
                    <span className="font-semibold">Anthropic API key</span>
                    <input name="byokKey" type="password" required placeholder="sk-ant-…" autoComplete="off" className="input input-sq mono mt-2 py-2 text-xs" />
                    <span className="mt-1 block text-xs text-[var(--dim)]">Checked with one free API call before anything starts.</span>
                  </label>
                  <label className="block">
                    <span className="font-semibold">Model</span>
                    <select name="model" defaultValue={q.model} className="input input-sq mono mt-2 py-2 text-xs">
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id} — {m.label} · ~{usd(breakdown.perModel?.[m.id]?.estCostUsd ?? 0, 0)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="font-semibold">Scope</span>
                    <select name="scope" defaultValue={job.scope} className="input input-sq mt-2 py-2 text-sm">
                      <option value="program">On-chain program only (Rust; checklists 01-07 + always-on)</option>
                      <option value="full">Full repository (program + off-chain code)</option>
                    </select>
                    <span className="mt-1 block text-xs text-[var(--dim)]">The estimate above is for the program scope, the one we calibrated. Full scope reads more code and costs more.</span>
                  </label>
                </div>
                <div className="space-y-4 text-sm">
                  <fieldset className="space-y-2">
                    <legend className="font-semibold">Disclosure</legend>
                    <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3">
                      <input type="radio" name="visibility" value="public" defaultChecked={job.visibility === "public"} className="mt-1" />
                      <span><b>Public</b> · listed under Audits. Critical/High details stay redacted for 90 days unless the maintainers ask us to publish them sooner. Counts are always visible.</span>
                    </label>
                    <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3">
                      <input type="radio" name="visibility" value="private" defaultChecked={job.visibility === "private"} className="mt-1" />
                      <span><b>Private</b> · only you get the link. The attestation (hashes + counts) still goes on {clusterLabel()}, and the report file is committed to our public repository under its token path.</span>
                    </label>
                  </fieldset>
                  <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3">
                    <input type="checkbox" name="confirm" required className="mt-1" />
                    <span>I created a dedicated key in a workspace with a spend limit, and I will delete it when the audit is done.</span>
                  </label>
                  <button type="submit" className="btn btn-accent">Start the audit →</button>
                </div>
              </form>
            </section>
          )}
          {expired && (
            <section className="card p-6 text-sm text-[var(--muted)]">
              This quote expired. <Link href="/#start" className="underline">Submit the repository again</Link> to get a fresh one.
            </section>
          )}
        </>
      ) : (
        <section className="card p-8 text-center text-[var(--muted)]">Resolving the commit and sizing the repository…</section>
      )}

      {/* Activity */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Activity</h2>
        <ul className="mt-3 space-y-1 text-xs">
          {job.events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="mono shrink-0 text-[var(--dim)]">{when(e.at)}</span>
              <span className={e.level === "error" ? "text-[var(--critical)]" : e.level === "warn" ? "text-[var(--high)]" : ""}>{e.message}</span>
            </li>
          ))}
          {job.events.length === 0 && <li className="text-[var(--muted)]">Nothing yet.</li>}
        </ul>
      </section>
    </div>
  );
}
