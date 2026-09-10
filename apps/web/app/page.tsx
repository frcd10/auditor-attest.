import Link from "next/link";
import { effectiveVisibility } from "@auditor/report";
import { enabledModels, loadModels } from "@auditor/pricing";
import { RecentJobs } from "@/components/RecentJobs";
import { SeverityBadges } from "@/components/SeverityBadges";
import { StatTile } from "@/components/StatTile";
import { prisma } from "@/lib/db";
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
  const cheapest = models.reduce((a, b) => (a.input_per_mtok <= b.input_per_mtok ? a : b));

  return (
    <div className="space-y-24 pb-8">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="glow" />
        <div className="container-x relative pt-20 pb-10 sm:pt-28">
          <div className="eyebrow">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
            Powered by the open-source auditor-skill corpus · attested on Solana mainnet
          </div>
          <h1 className="h-display mt-6 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">
            <span className="gradient-text">Verifiable</span> security audits for every Solana repo.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[var(--muted)]">
            Paste a GitHub link. An AI auditor walks 20 checklists, 1,413 items and 136 known attack vectors inside an isolated sandbox. You get a report, and the chain gets a hash you can verify forever.
          </p>
          <form id="start" action={createJob} className="mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <input name="url" type="url" required placeholder="https://github.com/owner/repo" className="input mono flex-1 text-sm" />
            <button type="submit" className="btn btn-accent">Get a quote →</button>
          </form>
          <p className="mt-3 text-xs text-[var(--dim)]">
            Public repositories. Quote is free and instant. Pay in USDC or bring your own API key. Add <span className="mono">/tree/&lt;branch-or-sha&gt;</span> to pin a ref.
          </p>
        </div>
      </section>

      <RecentJobs />

      {/* Live numbers */}
      <section className="container-x">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Repositories audited" value={int(s?.repos ?? 0)} />
          <StatTile label="Attested on mainnet" value={int(s?.attested ?? 0)} />
          <StatTile label="Critical found" value={int(s?.critical ?? 0)} accent="critical" />
          <StatTile label="High found" value={int(s?.high ?? 0)} accent="high" />
        </div>
        <div className="mt-3 text-right text-sm">
          <Link href="/stats" className="text-[var(--muted)] hover:text-white">All stats →</Link>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container-x scroll-mt-24">
        <h2 className="h-section text-3xl sm:text-4xl">How it works</h2>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">Four steps from a link to an on-chain attestation. Every step is visible on your job page.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["1", "Quote", "We shallow-clone the repo, count lines with tokei and price the audit with the corpus's own cost formula. The free tier stops here and tells you which checklists and vectors apply."],
            ["2", "Choose & pay", "Pick a model, public or private disclosure, and pay in USDC on mainnet with the job id as memo. Or bring your own API key and pay only the attestation fee."],
            ["3", "Sandboxed audit", "An ephemeral container with no network except the model API runs intake and the full audit cycle. Your code is mounted read-only and never executed."],
            ["4", "Report + attestation", "The report is stored byte-for-byte. Its hash, the commit, corpus version, model and severity counts are written to a Solana account signed by our attester key."],
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

      {/* Pricing */}
      <section id="pricing" className="container-x scroll-mt-24">
        <h2 className="h-section text-3xl sm:text-4xl">Pricing</h2>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          Price = estimated model cost × margin, computed per repository from its size and language mix. You see the full token breakdown before paying.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Quick</div>
            <div className="mt-2 text-4xl font-bold">Free</div>
            <p className="mt-3 text-sm text-[var(--muted)]">Repository size, language mix, and exactly which checklists and known-vector groups a full audit would load. No model run, no attestation.</p>
          </div>
          <div className="card card-gradient p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Standard</div>
            <div className="mt-2 text-4xl font-bold">Per repo</div>
            <p className="mt-3 text-sm text-[var(--muted)]">Full audit on our API key. Choose the model ({models.map((m) => m.label).join(", ")}). Report page, badge and mainnet attestation included.</p>
          </div>
          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">BYOK</div>
            <div className="mt-2 text-4xl font-bold">Fee only</div>
            <p className="mt-3 text-sm text-[var(--muted)]">Bring your own Anthropic key and pay just the attestation fee. The key is encrypted in transit, held in memory for the job, never logged.</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-[var(--dim)]">Cheapest model today: {cheapest.label} at ${cheapest.input_per_mtok}/M input tokens. Model list and prices are maintained in config/models.json.</p>
      </section>

      {/* On-chain */}
      <section id="onchain" className="container-x scroll-mt-24">
        <div className="card card-gradient grid gap-8 p-8 md:grid-cols-2">
          <div>
            <h2 className="h-section text-3xl">What goes on-chain</h2>
            <p className="mt-3 text-[var(--muted)]">One account per (repository, commit), written only by the attester key. Anyone can recompute its address from the GitHub URL and the commit and read it without us.</p>
            <p className="mt-3 text-[var(--muted)]">Finding text never leaves the report. Only hashes and counts are public forever.</p>
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
