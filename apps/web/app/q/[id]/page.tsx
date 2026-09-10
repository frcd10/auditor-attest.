import Link from "next/link";
import { notFound } from "next/navigation";
import { CHECKLISTS, VECTOR_GROUPS, enabledModels, loadModels, type LanguageMix, type Scope, type TokenBreakdown } from "@auditor/pricing";
import { prisma } from "@/lib/db";
import { adminToken, browserRpcUrl, treasuryPubkey, usdcMint } from "@/lib/env";
import { int, shortSha, usd, usdc, when } from "@/lib/format";
import { PayWithWallet } from "@/components/PayWithWallet";
import { StatusPill } from "@/components/StatusPill";
import { githubConfigured } from "@/lib/github";
import { adminEnqueue, configureJob } from "../../actions";
import { Poll } from "./Poll";

export const dynamic = "force-dynamic";

const LIVE = new Set(["quoting", "quote_running", "queued", "running", "ingesting"]);

type PerModel = Record<string, { estCostUsd: number; rawCostUsd: number; priceUsdc: number; attestFeeUsdc: number; tokens: TokenBreakdown }>;

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ verified?: string; verify_error?: string }> }) {
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

  return (
    <div className="space-y-8">
      <Poll active={LIVE.has(job.status)} />
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            <a href={job.repoUrl} target="_blank" rel="noreferrer" className="no-underline text-[var(--text)]">
              {job.owner}/{job.repo}
            </a>
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)] mono">
            {job.ref ? `ref ${job.ref} · ` : "default branch · "}
            commit {job.commitSha ? <a href={`${job.repoUrl}/commit/${job.commitSha}`} target="_blank" rel="noreferrer">{shortSha(job.commitSha)}</a> : "resolving…"} · job {job.id}
          </p>
        </div>
        <StatusPill status={job.status} />
      </section>

      {job.error && <div className="rounded-md border border-[var(--critical)] bg-[#2a1216] p-3 text-sm">{job.error}</div>}
      {verified && <div className="rounded-md border border-[#3ddc97] bg-[#0f2a1f] p-3 text-sm">{verified}</div>}
      {verify_error && <div className="rounded-md border border-[var(--high)] bg-[#2a1f12] p-3 text-sm">Verification failed: {verify_error}</div>}

      {githubConfigured() && !job.submitterVerified && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span>
            Maintainer of <b>{job.owner}/{job.repo}</b>? Verify with GitHub (admin or maintain permission) to publish Critical/High findings immediately when you choose public disclosure.
          </span>
          <a href={`/api/auth/github?job=${job.id}`} className="rounded-md border border-[var(--accent)] px-3 py-1 text-[var(--accent)] no-underline">
            Verify as maintainer
          </a>
        </div>
      )}
      {job.submitterVerified && <p className="text-xs text-[#3ddc97]">Submitter verified as a maintainer of {job.owner}/{job.repo}.</p>}

      {job.status === "done" && job.report && (
        <div className="panel p-4">
          <p className="text-sm">
            Report ready:{" "}
            <Link href={`/r/${job.owner}/${job.repo}/${job.report.commit}${job.report.visibility === "private" ? `?t=${job.report.accessToken}` : ""}`} className="font-semibold">
              /r/{job.owner}/{job.repo}/{shortSha(job.report.commit)}
            </Link>
            {job.report.visibility === "private" && <span className="ml-2 text-xs text-[var(--muted)]">(private link, keep the token)</span>}
          </p>
        </div>
      )}

      {q && (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="panel p-4">
              <h2 className="font-semibold">Repository size (tokei)</h2>
              <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-[var(--muted)]">Code lines (priced)</dt>
                <dd className="mono">{int(q.loc)}</dd>
                <dt className="text-[var(--muted)]">All lines</dt>
                <dd className="mono">{int(q.totalLoc)}</dd>
                <dt className="text-[var(--muted)]">Files</dt>
                <dd className="mono">{int(q.files)}</dd>
                <dt className="text-[var(--muted)]">Quoted at</dt>
                <dd className="mono">{when(q.createdAt)}</dd>
                <dt className="text-[var(--muted)]">Expires</dt>
                <dd className="mono">{when(q.expiresAt)}</dd>
              </dl>
              <div className="mt-3 space-y-1">
                {langRows.map(([lang, v]) => (
                  <div key={lang} className="text-xs">
                    <div className="flex justify-between">
                      <span>{lang}</span>
                      <span className="mono text-[var(--muted)]">{int(v.code)} · {v.files} files</span>
                    </div>
                    <div className="h-1.5 w-full rounded bg-[var(--border)]">
                      <div className="h-1.5 rounded bg-[var(--accent)]" style={{ width: `${Math.max(1, (v.code / totalCode) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {!!breakdown.excluded?.length && (
                <p className="mt-2 text-xs text-[var(--muted)]">Excluded: {breakdown.excluded.map((e) => `${e.language} (${int(e.code)} lines, ${e.reason})`).join("; ")}</p>
              )}
            </div>

            <div className="panel p-4">
              <h2 className="font-semibold">What the audit would load</h2>
              {scope && (
                <>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {scope.itemCount} checklist items across {scope.checklists.length} checklists · {scope.vectorCount} known attack vectors
                  </p>
                  <ul className="mt-2 grid grid-cols-1 gap-x-4 text-xs sm:grid-cols-2">
                    {CHECKLISTS.filter((c) => scope.checklists.includes(c.id)).map((c) => (
                      <li key={c.id} className="flex justify-between border-b border-[var(--border)] py-0.5">
                        <span>
                          <span className="mono text-[var(--muted)]">{c.id}</span> {c.name}
                        </span>
                        <span className="mono text-[var(--muted)]">{c.items}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs font-medium">Known-vector groups</p>
                  <ul className="text-xs text-[var(--muted)]">
                    {VECTOR_GROUPS.filter((g) => scope.vectorGroups.includes(g.id)).map((g) => (
                      <li key={g.id}>
                        {g.name} <span className="mono">({g.range})</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-[var(--muted)]">{scope.reasons.join(" · ")}</p>
                </>
              )}
            </div>
          </section>

          <section className="panel p-4">
            <h2 className="font-semibold">Estimate</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              COSTS.md formula: 15K fixed + in-scope corpus + 10 tokens/LOC × 1.6 for input; output interpolated from the corpus size table. Price = cost × {Number(q.margin)} margin{Number(q.calibration) !== 1 ? ` × ${Number(q.calibration)} calibration` : ""}, rounded up to cents.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[var(--muted)]">
                  <tr>
                    <th className="py-1 pr-4">Model</th>
                    <th className="py-1 pr-4">Input tokens</th>
                    <th className="py-1 pr-4">Output tokens</th>
                    <th className="py-1 pr-4">Est. cost</th>
                    <th className="py-1 pr-4">Standard price</th>
                    <th className="py-1">BYOK fee</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => {
                    const pm = breakdown.perModel?.[m.id];
                    if (!pm) return null;
                    return (
                      <tr key={m.id} className={`border-t border-[var(--border)] ${m.id === q.model ? "font-semibold" : ""}`}>
                        <td className="py-1 pr-4 mono">{m.id}</td>
                        <td className="py-1 pr-4 mono">{int(pm.tokens.inputTotal)}</td>
                        <td className="py-1 pr-4 mono">{int(pm.tokens.output)}</td>
                        <td className="py-1 pr-4 mono">{usd(pm.estCostUsd)}</td>
                        <td className="py-1 pr-4 mono">{usdc(pm.priceUsdc)}</td>
                        <td className="py-1 mono">{usdc(pm.attestFeeUsdc)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {breakdown.chosen && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-[var(--muted)]">Token breakdown for {q.model}</summary>
                <dl className="mt-2 grid max-w-md grid-cols-2 gap-y-0.5 mono">
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

          {["quoted", "awaiting_payment"].includes(job.status) && (
            <section className="panel p-4">
              <h2 className="font-semibold">Run it</h2>
              <form action={configureJob} className="mt-3 grid gap-4 md:grid-cols-2">
                <input type="hidden" name="jobId" value={job.id} />
                <fieldset className="space-y-2 text-sm">
                  <legend className="font-medium">Tier</legend>
                  <label className="flex items-start gap-2">
                    <input type="radio" name="tier" value="quick" defaultChecked={job.tier === "quick"} />
                    <span>
                      <b>Quick</b> — free. Just the stats above: language mix and which checklists/vectors would trigger. No LLM run, no attestation.
                    </span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input type="radio" name="tier" value="standard" defaultChecked={job.tier === "standard"} />
                    <span>
                      <b>Standard</b> — full audit on our API key. Pay the standard price in USDC.
                    </span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input type="radio" name="tier" value="byok" defaultChecked={job.tier === "byok"} />
                    <span>
                      <b>BYOK</b> — full audit on your Anthropic API key; you pay only the attestation fee. The key is encrypted in transit, held in memory for the job, and never logged.
                    </span>
                  </label>
                  <input name="byokKey" type="password" placeholder="sk-ant-... (BYOK only)" autoComplete="off" className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 mono text-xs" />
                </fieldset>
                <div className="space-y-3 text-sm">
                  <label className="block">
                    <span className="font-medium">Model</span>
                    <select name="model" defaultValue={q.model} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 mono text-xs">
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id} — {m.label} ({m.tier})
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset className="space-y-1">
                    <legend className="font-medium">Disclosure</legend>
                    <label className="flex items-start gap-2">
                      <input type="radio" name="visibility" value="private" defaultChecked={job.visibility === "private"} />
                      <span><b>Private</b> — only you get the link. Attestation still goes on-chain (hashes + counts).</span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input type="radio" name="visibility" value="public" defaultChecked={job.visibility === "public"} />
                      <span><b>Public</b> — indexable page. Unless you verify as a maintainer, Critical/High findings stay redacted until the maintainer acknowledges or 90 days pass. Counts are always visible.</span>
                    </label>
                  </fieldset>
                  <button type="submit" className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black">
                    Continue
                  </button>
                </div>
              </form>
            </section>
          )}

          {job.status === "awaiting_payment" && job.payment && (
            <section className="panel p-4">
              <h2 className="font-semibold">Payment</h2>
              <p className="mt-1 text-sm">
                Send <b className="mono">{usdc(Number(job.payment.expectedUsdc))}</b> on Solana mainnet to the treasury with the memo <code className="mono">{job.id}</code>. The job starts once the transfer is finalized.
              </p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs mono">
                <dt className="text-[var(--muted)]">Treasury</dt>
                <dd className="break-all">{treasuryPubkey() ?? "not configured yet"}</dd>
                <dt className="text-[var(--muted)]">USDC mint</dt>
                <dd className="break-all">{usdcMint()}</dd>
                <dt className="text-[var(--muted)]">Memo</dt>
                <dd>{job.id}</dd>
                <dt className="text-[var(--muted)]">Expires</dt>
                <dd>{when(job.payment.expiresAt)}</dd>
              </dl>
              {treasuryPubkey() && browserRpcUrl() ? (
                <div className="mt-3">
                  <PayWithWallet rpcUrl={browserRpcUrl()!} treasury={treasuryPubkey()!} usdcMint={usdcMint()} memo={job.id} amountUsdc={Number(job.payment.expectedUsdc).toFixed(6)} />
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--muted)]">Wallet payment is not configured on this deployment (NEXT_PUBLIC_RPC_URL / TREASURY_PUBKEY). Pay from any wallet that supports memos.</p>
              )}
              {job.payment.status === "mismatched" && (
                <p className="mt-2 text-xs text-[var(--high)]">A transfer with this memo was received but the amount ({Number(job.payment.receivedUsdc).toFixed(2)} USDC) is below the price. The operator will refund it.</p>
              )}
            </section>
          )}

          {adminToken() && job.tier !== "quick" && ["awaiting_payment", "quoted", "failed", "failed_budget"].includes(job.status) && (
            <section className="panel border-dashed p-4">
              <h2 className="font-semibold">Operator: run without payment</h2>
              <form action={adminEnqueue} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="jobId" value={job.id} />
                <input name="token" type="password" placeholder="ADMIN_TOKEN" className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 mono text-xs" />
                <button type="submit" className="rounded-md border border-[var(--accent)] px-3 py-1 text-xs text-[var(--accent)]">
                  Enqueue now
                </button>
              </form>
              <p className="mt-1 text-xs text-[var(--muted)]">Budget cap for this job: {usd(job.budgetUsd ? Number(job.budgetUsd) : null)}</p>
            </section>
          )}
        </>
      )}

      <section>
        <h2 className="text-sm font-semibold text-[var(--muted)]">Activity</h2>
        <ul className="mt-2 space-y-1 text-xs">
          {job.events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="mono text-[var(--muted)]">{when(e.at)}</span>
              <span className={e.level === "error" ? "text-[var(--critical)]" : e.level === "warn" ? "text-[var(--high)]" : ""}>{e.message}</span>
            </li>
          ))}
          {job.events.length === 0 && <li className="text-[var(--muted)]">Waiting for a worker…</li>}
        </ul>
      </section>
    </div>
  );
}
