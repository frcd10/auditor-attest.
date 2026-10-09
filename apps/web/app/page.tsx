import Link from "next/link";
import { effectiveVisibility } from "@auditor/report";
import { enabledModels, loadModels } from "@auditor/pricing";
import { RecentJobs } from "@/components/RecentJobs";
import { SeverityBadges } from "@/components/SeverityBadges";
import { StatTile } from "@/components/StatTile";
import { prisma } from "@/lib/db";
import { clusterLabel, siteRepo, siteRepoUrl } from "@/lib/env";
import { int, shortSha, when } from "@/lib/format";
import { createJob } from "./actions";

export const dynamic = "force-dynamic";

async function stats() {
  try {
    const [agg, repos, attested] = await Promise.all([
      prisma.report.aggregate({ _count: { _all: true }, _sum: { critical: true, high: true, medium: true, low: true } }),
      prisma.report.groupBy({ by: ["owner", "repo"] }),
      prisma.attestation.count(),
    ]);
    return { reports: agg._count._all, repos: repos.length, attested, critical: agg._sum.critical ?? 0, high: agg._sum.high ?? 0, medium: agg._sum.medium ?? 0, low: agg._sum.low ?? 0 };
  } catch {
    return null;
  }
}

async function recent() {
  try {
    const rows = await prisma.report.findMany({ where: { visibility: "public" }, orderBy: { createdAt: "desc" }, take: 8, include: { attestation: true } });
    return rows.filter((r) => effectiveVisibility({ visibility: r.visibility, submitterVerified: r.submitterVerified, redactUntil: r.redactUntil, maintainerAckAt: r.maintainerAckAt }) !== "private").slice(0, 6);
  } catch {
    return [];
  }
}

export default async function Home() {
  const [s, latest] = await Promise.all([stats(), recent()]);
  const models = enabledModels(loadModels());
  const repo = siteRepo();
  const repoUrl = siteRepoUrl();

  return (
    <div className="space-y-24 pb-8">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="glow" />
        <div className="container-x relative pt-20 pb-10 sm:pt-28">
          <div className="eyebrow">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
            A public good · 100% open source · free to use, you pay only your own model usage
          </div>
          <h1 className="h-display mt-6 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">
            <span className="gradient-text">Verifiable</span> security audits for every Solana repo.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[var(--muted)]">
            Paste a GitHub link. An AI auditor walks the open-source auditor-skill corpus (20 checklists, 1,413 items, 136 known attack vectors) against the code, on your own Anthropic key. You get a report, the repository gets a hash on {clusterLabel()} that anyone can verify.
          </p>
          <form id="start" action={createJob} className="mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <input name="url" type="url" required placeholder="https://github.com/owner/repo" className="input mono flex-1 text-sm" />
            <button type="submit" className="btn btn-accent">Estimate the cost →</button>
          </form>
          <p className="mt-3 text-xs text-[var(--dim)]">
            Public repositories. The estimate is instant and free. Add <span className="mono">/tree/&lt;branch-or-sha&gt;</span> to pin a ref.
          </p>
        </div>
      </section>

      <RecentJobs />

      {/* Live numbers */}
      <section className="container-x">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Repositories audited" value={int(s?.repos ?? 0)} />
          <StatTile label={`Attested on ${clusterLabel()}`} value={int(s?.attested ?? 0)} />
          <StatTile label="Critical found" value={int(s?.critical ?? 0)} accent="critical" />
          <StatTile label="High found" value={int(s?.high ?? 0)} accent="high" />
        </div>
        <div className="mt-3 text-right text-sm">
          <Link href="/stats" className="text-[var(--muted)] hover:text-white">All stats →</Link>
        </div>
      </section>

      {/* Three ways to use it */}
      <section id="ways" className="container-x scroll-mt-24">
        <h2 className="h-section text-3xl sm:text-4xl">Three ways to use it</h2>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">Same corpus, same report format. Pick the one that fits how you work. Nothing here costs anything beyond the tokens your own account spends.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="card card-gradient p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">1 · This site</div>
            <div className="mt-2 text-2xl font-bold">Paste a link</div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Get an estimate, create a throwaway API key with a spend limit, paste it, and the audit runs on a disposable GitHub Actions machine. The report is committed to our public repository and attested on {clusterLabel()}.
            </p>
            <Link href="/#start" className="btn btn-outline btn-sm mt-4">Start →</Link>
          </div>
          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">2 · Inside Claude Code</div>
            <div className="mt-2 text-2xl font-bold">Install the corpus as a plugin</div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              The auditor-skill corpus is a Claude Code plugin. Open your Solana repository in Claude Code, load the plugin and run the audit in your own environment, with your own subscription or key. No upload, no middleman.
            </p>
            <pre className="mono mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-black/40 p-3 text-xs">{`git clone https://github.com/solanabr/auditor-skill
claude --plugin-dir ./auditor-skill
> /auditor:audit --scope program`}</pre>
            <a href="https://github.com/solanabr/auditor-skill" target="_blank" rel="noreferrer" className="btn btn-outline btn-sm mt-4">auditor-skill ↗</a>
          </div>
          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">3 · Clone this site</div>
            <div className="mt-2 text-2xl font-bold">Run the whole thing yourself</div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Everything on this page, the runner, the attestation program and the report pipeline are in one repository under an open license. One command brings it up locally; the same audit then runs on your machine.
            </p>
            <pre className="mono mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-black/40 p-3 text-xs">{`git clone --recurse-submodules ${repoUrl}
cd ${repo.split("/")[1]} && pnpm dev
pnpm audit:local -- Org/repo`}</pre>
            <a href={repoUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm mt-4">Source ↗</a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container-x scroll-mt-24">
        <h2 className="h-section text-3xl sm:text-4xl">How the site runs an audit</h2>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">Four steps from a link to an on-chain attestation. Every step is visible on your job page and in the public Actions log.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["1", "Estimate", "We size the repository through the GitHub API (no clone) and show the expected cost per model, fitted on our own runs with a safety factor on top."],
            ["2", "Your key", "You create a workspace with a spend limit and one key in it, paste the key, and pick the model and disclosure. We check the key with one free call and encrypt it."],
            ["3", "Disposable runner", "A fresh GitHub Actions machine clones the commit, runs the corpus with Claude Code in single-agent mode, read-only tools, nothing from the repository executed. The key never touches a log."],
            ["4", "Report + attestation", `The report is committed to our public repository byte-for-byte. Its hash, the commit, corpus version, model and severity counts are written to an account on ${clusterLabel()} signed by our attester key.`],
          ].map(([n, title, body]) => (
            <div key={n} className="card p-6">
              <div className="gradient-text text-3xl font-bold">{n}</div>
              <div className="mt-3 text-lg font-semibold">{title}</div>
              <p className="mt-2 text-sm text-[var(--muted)]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent audits */}
      <section className="container-x">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="h-section text-3xl sm:text-4xl">Latest public audits</h2>
            <p className="mt-3 text-[var(--muted)]">Public reports are indexable pages. Private reports never appear here.</p>
          </div>
          <Link href="/explore" className="btn btn-outline btn-sm">All audits →</Link>
        </div>
        {latest.length === 0 ? (
          <div className="card mt-8 p-8 text-center text-[var(--muted)]">No public audits yet. Yours could be the first.</div>
        ) : (
          <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {latest.map((r) => (
              <li key={r.id}>
                <Link href={`/r/${r.owner}/${r.repo}/${r.commit}`} className="card block p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{r.owner}/{r.repo}</span>
                    <span className="mono text-xs text-[var(--dim)]">{shortSha(r.commit)}</span>
                  </div>
                  <div className="mt-3">
                    <SeverityBadges size="sm" counts={{ critical: r.critical, high: r.high, medium: r.medium, low: r.low, info: r.info }} />
                  </div>
                  <div className="mt-3 text-xs text-[var(--dim)]">
                    {r.model} · {when(r.finishedAt ?? r.createdAt)}{r.attestation ? " · attested ✓" : ""}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Cost */}
      <section id="pricing" className="container-x scroll-mt-24">
        <h2 className="h-section text-3xl sm:text-4xl">What it costs</h2>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          Nothing, from us. This is a public good: no fees, no accounts, no tokens of ours. The only cost is the model usage on your own Anthropic key, billed to you at list prices, and we tell you the ceiling before you start.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Estimate</div>
            <div className="mt-2 text-4xl font-bold">Free</div>
            <p className="mt-3 text-sm text-[var(--muted)]">Repository size, language mix, which checklists and known-vector groups apply, and the expected cost per model. Instant, no key needed.</p>
          </div>
          <div className="card card-gradient p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Audit</div>
            <div className="mt-2 text-4xl font-bold">Your key</div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Typically $16–35 on Claude Opus 5 for an on-chain program, a few dollars on Sonnet. Models offered: {models.map((m) => m.label).join(", ")}. Report page, badge and attestation included.
            </p>
          </div>
          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Attestation</div>
            <div className="mt-2 text-4xl font-bold">Free</div>
            <p className="mt-3 text-sm text-[var(--muted)]">Written on {clusterLabel()} by our attester key. You do not need a wallet, SOL or anything on-chain. The account address is derived from the repository URL and the commit, so anyone can find it without us.</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-[var(--dim)]">Model list and prices are maintained in config/models.json in the repository. A rigorous first pass, not a substitute for a human audit and never a &quot;safe to deploy&quot; stamp.</p>
      </section>

      {/* On-chain */}
      <section id="onchain" className="container-x scroll-mt-24">
        <div className="card card-gradient grid gap-8 p-8 md:grid-cols-2">
          <div>
            <h2 className="h-section text-3xl">What goes on-chain</h2>
            <p className="mt-3 text-[var(--muted)]">One account per (repository, commit), written only by the attester key. Anyone can recompute its address from the GitHub URL and the commit and read it without us.</p>
            <p className="mt-3 text-[var(--muted)]">Finding text never leaves the report. Only hashes and counts are public forever. Today this runs on {clusterLabel()}; the program is the same one a mainnet deployment would use.</p>
          </div>
          <ul className="mono grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {["repo_hash = sha256(url)", "commit_sha", "corpus_version", "model_id", "report_sha256", "counts[critical…info]", "visibility", "timestamp", "attester"].map((f) => (
              <li key={f} className="rounded-lg border border-[var(--border)] bg-black/40 px-3 py-2">{f}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
