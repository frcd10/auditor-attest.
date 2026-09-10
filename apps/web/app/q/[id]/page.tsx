import Link from "next/link";
import { notFound } from "next/navigation";
import { CHECKLISTS, VECTOR_GROUPS, enabledModels, loadModels, type LanguageMix, type Scope, type TokenBreakdown } from "@auditor/pricing";
import { PayWithWallet } from "@/components/PayWithWallet";
import { RememberJob } from "@/components/RecentJobs";
import { StatusPill } from "@/components/StatusPill";
import { Stepper, type Step } from "@/components/Stepper";
import { prisma } from "@/lib/db";
import { adminToken, browserRpcUrl, treasuryPubkey, usdcMint } from "@/lib/env";
import { int, shortSha, usd, usdc, when } from "@/lib/format";
import { githubConfigured } from "@/lib/github";
import { adminEnqueue, configureJob } from "../../actions";
import { Poll } from "./Poll";

export const dynamic = "force-dynamic";

const LIVE = new Set(["quoting", "quote_running", "queued", "running", "ingesting"]);
type PerModel = Record<string, { estCostUsd: number; rawCostUsd: number; priceUsdc: number; attestFeeUsdc: number; tokens: TokenBreakdown }>;

function steps(status: string, tier: string, hasReport: boolean): Step[] {
  const failed = ["failed", "failed_budget", "cancelled"].includes(status);
  const order = ["quote", "choose", "pay", "audit", "report"] as const;
  const idx: Record<string, number> = { quoting: 0, quote_running: 0, quoted: 1, awaiting_payment: 2, queued: 3, running: 3, ingesting: 3, done: 5, refunded: 2 };
  const cur = failed ? (tier === "quick" ? 0 : 3) : (idx[status] ?? 0);
  const labels: Record<(typeof order)[number], string> = { quote: "Quote", choose: "Choose", pay: "Pay", audit: "Audit", report: "Report" };
  return order.map((k, i) => {
    let state: Step["state"] = i < cur ? "done" : i === cur ? "current" : "todo";
    if (status === "done" && tier === "quick") state = i === 0 || i === 1 ? "done" : "todo";
    if (status === "done" && hasReport) state = "done";
    if (failed && i === cur) state = "failed";
    return { label: labels[k], state };
  });
}

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ verified?: string; verify_error?: string }> }) {
  const { id } = await params;
  const { verified, verify_error } = await searchParams;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { quote: true, payment: true, report: { include: { attestation: true } }, events: { orderBy: { at: "desc" }, take: 25 } },
  });
  if (!job) notFound();
  const q = job.quote;
  const models = enabledModels(loadModels());
  const breakdown = (q?.breakdown ?? {}) as { chosen?: TokenBreakdown; perModel?: PerModel; reasons?: string[]; excluded?: { language: string; code: number; files: number; reason: string }[] };
  const scope = (q?.scope ?? null) as Scope | null;
  const languages = (q?.languages ?? {}) as unknown as LanguageMix;
  const langRows = Object.entries(languages).sort((a, b) => b[1].code - a[1].code);
  const totalCode = langRows.reduce((n, [, v]) => n + v.code, 0) || 1;
  const canConfigure = ["quoted", "awaiting_payment"].includes(job.status);
  const reportHref = job.report ? `/r/${job.owner}/${job.repo}/${job.report.commit}${job.report.visibility === "private" ? `?t=${job.report.accessToken}` : ""}` : null;

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
              {job.commitSha ? <a href={`${job.repoUrl}/commit/${job.commitSha}`} target="_blank" rel="noreferrer" className="text-white">{shortSha(job.commitSha)}</a> : "resolving…"} · {job.tier} · {job.visibility}
            </p>
          </div>
          <StatusPill status={job.status} />
        </div>
        <div className="mt-6">
          <Stepper steps={steps(job.status, job.tier, !!job.report)} />
        </div>
        {LIVE.has(job.status) && <p className="mt-4 text-sm text-[var(--muted)]">This page refreshes itself while the job is running.</p>}
      </section>

      {job.error && <div className="rounded-2xl border border-[var(--critical)] bg-[#2a1216] p-4 text-sm">{job.error}</div>}
      {verified && <div className="rounded-2xl border border-[var(--green)] bg-[#0f2a1f] p-4 text-sm">{verified}</div>}
      {verify_error && <div className="rounded-2xl border border-[var(--high)] bg-[#2a1f12] p-4 text-sm">Verification failed: {verify_error}</div>}

      {/* Report ready */}
      {job.status === "done" && job.report && reportHref && (
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Report ready</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {job.report.critical} critical · {job.report.high} high · {job.report.medium} medium · {job.report.low} low · {job.report.info} info
                {job.report.attestation ? " · attested on mainnet" : ""}
                {job.report.visibility === "private" ? " · private link, keep the token" : ""}
              </p>
            </div>
            <Link href={reportHref} className="btn btn-accent">Open report →</Link>
          </div>
        </section>
      )}
      {job.status === "done" && job.tier === "quick" && !job.report && (
        <section className="card p-6 text-sm text-[var(--muted)]">
          Quick tier complete: the size, language mix and scope below are the result. Submit the repository again to run a full audit.
        </section>
      )}

      {/* Step 1: quote */}
      {q ? (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="card p-6">
              <h2 className="text-lg font-semibold">1 · Repository size</h2>
              <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-[var(--muted)]">Code lines (priced)</dt>
                <dd className="mono">{int(q.loc)}</dd>
                <dt className="text-[var(--muted)]">All lines</dt>
                <dd className="mono">{int(q.totalLoc)}</dd>
                <dt className="text-[var(--muted)]">Files</dt>
                <dd className="mono">{int(q.files)}</dd>
                <dt className="text-[var(--muted)]">Quote expires</dt>
                <dd className="mono">{when(q.expiresAt)}</dd>
              </dl>
              <div className="mt-4 space-y-2">
                {langRows.map(([lang, v]) => (
                  <div key={lang} className="text-xs">
                    <div className="flex justify-between">
                      <span>{lang}</span>
                      <span className="mono text-[var(--muted)]">{int(v.code)} · {v.files} files</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded bg-white/10">
                      <div className="h-1.5 rounded" style={{ width: `${Math.max(1, (v.code / totalCode) * 100)}%`, background: "var(--gradient)" }} />
                    </div>
                  </div>
                ))}
              </div>
              {!!breakdown.excluded?.length && (
                <p className="mt-3 text-xs text-[var(--dim)]">Not priced: {breakdown.excluded.map((e) => `${e.language} (${int(e.code)} lines, ${e.reason})`).join("; ")}</p>
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
            <h2 className="text-lg font-semibold">Estimate</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              COSTS.md formula: 15K fixed + in-scope corpus + 10 tokens/LOC × 1.6 for input; output from the corpus size table. Price = cost × {Number(q.margin)}{Number(q.calibration) !== 1 ? ` × ${Number(q.calibration)} calibration` : ""}, rounded up to cents.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Input tokens</th>
                    <th>Output tokens</th>
                    <th>Est. cost</th>
                    <th>Standard</th>
                    <th>BYOK fee</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => {
                    const pm = breakdown.perModel?.[m.id];
                    if (!pm) return null;
                    return (
                      <tr key={m.id} className={m.id === q.model ? "font-semibold" : ""}>
                        <td className="mono">{m.id}</td>
                        <td className="mono">{int(pm.tokens.inputTotal)}</td>
                        <td className="mono">{int(pm.tokens.output)}</td>
                        <td className="mono">{usd(pm.estCostUsd)}</td>
                        <td className="mono">{usdc(pm.priceUsdc)}</td>
                        <td className="mono">{usdc(pm.attestFeeUsdc)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {breakdown.chosen && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-[var(--muted)]">Token breakdown for {q.model}</summary>
                <dl className="mono mt-2 grid max-w-md grid-cols-2 gap-y-0.5">
                  {Object.entries(breakdown.chosen).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-[var(--muted)]">{k}</dt>
                      <dd>{int(v as number)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </section>

          {/* Step 2: choose */}
          {canConfigure && (
            <section className="card p-6">
              <h2 className="text-lg font-semibold">2 · Choose tier, model and disclosure</h2>
              {githubConfigured() && !job.submitterVerified && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-black/40 p-3 text-sm">
                  <span>Maintainer of this repo? Verify with GitHub to publish Critical/High findings immediately when you choose public.</span>
                  <a href={`/api/auth/github?job=${job.id}`} className="btn btn-outline btn-sm">Verify as maintainer</a>
                </div>
              )}
              {job.submitterVerified && <p className="mt-3 text-xs text-[var(--green)]">Verified as a maintainer of {job.owner}/{job.repo}.</p>}
              <form action={configureJob} className="mt-4 grid gap-6 md:grid-cols-2">
                <input type="hidden" name="jobId" value={job.id} />
                <fieldset className="space-y-3 text-sm">
                  <legend className="font-semibold">Tier</legend>
                  <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3">
                    <input type="radio" name="tier" value="quick" defaultChecked={job.tier === "quick"} className="mt-1" />
                    <span><b>Quick</b> · free. Keeps the stats above as the result. No model run, no attestation.</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3">
                    <input type="radio" name="tier" value="standard" defaultChecked={job.tier === "standard"} className="mt-1" />
                    <span><b>Standard</b> · full audit on our API key. Pay the standard price in USDC.</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3">
                    <input type="radio" name="tier" value="byok" defaultChecked={job.tier === "byok"} className="mt-1" />
                    <span><b>BYOK</b> · full audit on your Anthropic key; pay only the attestation fee. Encrypted in transit, held in memory for the job, never logged.</span>
                  </label>
                  <input name="byokKey" type="password" placeholder="sk-ant-… (BYOK only)" autoComplete="off" className="input input-sq mono py-2 text-xs" />
                </fieldset>
                <div className="space-y-4 text-sm">
                  <label className="block">
                    <span className="font-semibold">Model</span>
                    <select name="model" defaultValue={q.model} className="input input-sq mono mt-2 py-2 text-xs">
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id} — {m.label} ({m.tier})
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset className="space-y-2">
                    <legend className="font-semibold">Disclosure</legend>
                    <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3">
                      <input type="radio" name="visibility" value="private" defaultChecked={job.visibility === "private"} className="mt-1" />
                      <span><b>Private</b> · only you get the link. The attestation (hashes + counts) still goes on-chain.</span>
                    </label>
                    <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3">
                      <input type="radio" name="visibility" value="public" defaultChecked={job.visibility === "public"} className="mt-1" />
                      <span><b>Public</b> · indexable page under Audits. Unless you verified as maintainer, Critical/High stay redacted until acknowledged or 90 days. Counts always visible.</span>
                    </label>
                  </fieldset>
                  <button type="submit" className="btn btn-accent">Continue →</button>
                </div>
              </form>
            </section>
          )}

          {/* Step 3: pay */}
          {job.status === "awaiting_payment" && job.payment && (
            <section className="card p-6">
              <h2 className="text-lg font-semibold">3 · Pay {usdc(Number(job.payment.expectedUsdc))}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">USDC on Solana mainnet to the treasury, memo = this job id. The audit starts when the transfer is finalized.</p>
              <dl className="mono mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                <dt className="text-[var(--muted)]">Treasury</dt>
                <dd className="break-all">{treasuryPubkey() ?? "not configured yet"}</dd>
                <dt className="text-[var(--muted)]">USDC mint</dt>
                <dd className="break-all">{usdcMint()}</dd>
                <dt className="text-[var(--muted)]">Memo</dt>
                <dd>{job.id}</dd>
                <dt className="text-[var(--muted)]">Window closes</dt>
                <dd>{when(job.payment.expiresAt)}</dd>
              </dl>
              {treasuryPubkey() && browserRpcUrl() ? (
                <div className="mt-4">
                  <PayWithWallet rpcUrl={browserRpcUrl()!} treasury={treasuryPubkey()!} usdcMint={usdcMint()} memo={job.id} amountUsdc={Number(job.payment.expectedUsdc).toFixed(6)} />
                </div>
              ) : (
                <p className="mt-3 text-xs text-[var(--dim)]">Wallet payment is not configured on this deployment (NEXT_PUBLIC_RPC_URL / TREASURY_PUBKEY). Pay from any wallet that supports memos.</p>
              )}
              {job.payment.status === "mismatched" && (
                <p className="mt-3 text-xs text-[var(--high)]">A transfer with this memo arrived but {Number(job.payment.receivedUsdc).toFixed(2)} USDC is below the price. The operator will refund it.</p>
              )}
            </section>
          )}

          {adminToken() && job.tier !== "quick" && ["awaiting_payment", "quoted", "failed", "failed_budget"].includes(job.status) && (
            <section className="card border-dashed p-6">
              <h2 className="text-lg font-semibold">Operator · run without payment</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">Local runs and calibration. Budget cap for this job: {usd(job.budgetUsd ? Number(job.budgetUsd) : null)}.</p>
              <form action={adminEnqueue} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="jobId" value={job.id} />
                <input name="token" type="password" placeholder="ADMIN_TOKEN" className="input input-sq mono max-w-xs py-2 text-xs" />
                <button type="submit" className="btn btn-outline btn-sm">Enqueue now</button>
              </form>
            </section>
          )}
        </>
      ) : (
        <section className="card p-8 text-center text-[var(--muted)]">Resolving the commit and counting lines…</section>
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
          {job.events.length === 0 && <li className="text-[var(--muted)]">Waiting for a worker…</li>}
        </ul>
      </section>
    </div>
  );
}
