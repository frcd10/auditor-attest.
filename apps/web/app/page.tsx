import Link from "next/link";
import { effectiveVisibility } from "@auditor/report";
import { enabledModels, loadModels } from "@auditor/pricing";
import { CORPUS_URL, CorpusCard } from "@/components/CorpusCard";
import { RecentJobs } from "@/components/RecentJobs";
import { SeverityBadges } from "@/components/SeverityBadges";
import { StatTile } from "@/components/StatTile";
import { prisma } from "@/lib/db";
import { attestProgramId, clusterLabel, corpusVersion, siteRepo, siteRepoUrl } from "@/lib/env";
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
  const programId = attestProgramId() ?? "sXtvdoheTtFBukx8vCppJHhiiJHW2xa3xc5KaPAhzkC";

  return (
    <div className="space-y-16 pb-8">
      {/* Hero */}
      <section className="container-x pt-14 pb-6 sm:pt-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <div>
            <h1 className="h-display mt-2 text-4xl sm:text-5xl">
              Security audits for Solana programs, with a record on-chain.
            </h1>
            <p className="mt-6 text-lg text-[var(--muted)]">
              Auditor Dog runs the open-source <a href={CORPUS_URL} target="_blank" rel="noreferrer" className="text-white underline">auditor-skill</a> corpus by solanabr against a public GitHub repository: 20 checklists, 1,413 items and 136 known attack vectors, applied by a single model session with read-only tools. The report is published in full; its hash, the commit, the corpus version, the model and the severity counts are written to a Solana account anyone can read.
            </p>
            <form id="start" action={createJob} className="mt-10 flex flex-col gap-3 sm:flex-row">
              <input name="url" type="url" required placeholder="https://github.com/owner/repo" className="input mono flex-1 text-sm" />
              <button type="submit" className="btn btn-accent">Estimate the cost</button>
            </form>
            <p className="mt-3 text-xs text-[var(--dim)]">
              Public repositories only. The estimate is free. Append <span className="mono">/tree/&lt;branch-or-sha&gt;</span> to pin a ref. Runs on your own Anthropic API key; we charge nothing.
            </p>
          </div>
          <CorpusCard />
        </div>
      </section>

      <RecentJobs />

      {/* Live numbers */}
      <section className="container-x">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Repositories audited" value={int(s?.repos ?? 0)} />
          <StatTile label={`Attested on ${clusterLabel()}`} value={int(s?.attested ?? 0)} />
          <StatTile label="Critical findings" value={int(s?.critical ?? 0)} accent="critical" />
          <StatTile label="High findings" value={int(s?.high ?? 0)} accent="high" />
        </div>
        <div className="mt-3 text-right text-sm">
          <Link href="/stats" className="text-[var(--muted)] hover:text-white">All stats</Link>
        </div>
      </section>

      {/* What you get */}
      <section id="how" className="container-x scroll-mt-24">
        <h2 className="h-section text-3xl sm:text-4xl">What happens when you submit a repository</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            ["Estimate", "The repository is sized through the GitHub API, without cloning. You see the expected model cost for each supported model before anything runs. The figure is an upper bound fitted on our own audits, with a 1.4× safety factor; the calibration data is in the repository."],
            ["Your key, your bill", "You create a dedicated key in an Anthropic workspace with a spend limit (the page tells you the number) and paste it. We verify it with one free API call, encrypt it, and wipe it the moment the run starts. The model usage is billed by Anthropic to you. We have no fees."],
            ["A disposable machine", "The audit runs on a fresh GitHub Actions runner in our public repository. It clones the exact commit, loads the corpus as a Claude Code plugin and walks it in one linear session: Read, Grep and read-only shell commands only, no subagents, nothing from the audited repository is ever built or executed. The run log is public."],
            ["Report and attestation", `The report is committed to our repository byte-for-byte and rendered here. The attester key writes one account per (repository, commit) on ${clusterLabel()}: repository hash, commit, corpus version, model, report sha256, severity counts and timestamp. The address derives from the URL and the commit, so no database is needed to find it.`],
          ].map(([title, body]) => (
            <div key={title} className="card p-6">
              <div className="text-lg font-semibold">{title}</div>
              <p className="mt-2 text-sm text-[var(--muted)]">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-sm text-[var(--muted)]">
          This is a thorough first pass by a model, produced in 15 to 25 minutes. It is not a substitute for a human audit, and an attestation is a record that a given report was produced for a given commit, not a statement that the code is safe.
        </p>
      </section>

      {/* Recent audits */}
      <section className="container-x">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="h-section text-3xl sm:text-4xl">Published reports</h2>
            <p className="mt-3 text-[var(--muted)]">Full text, Critical findings included. Private reports are never listed.</p>
          </div>
          <Link href="/explore" className="btn btn-outline btn-sm">All reports</Link>
        </div>
        {latest.length === 0 ? (
          <div className="card mt-8 p-8 text-center text-[var(--muted)]">No public reports yet.</div>
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
                    {r.model} · {when(r.finishedAt ?? r.createdAt)}{r.attestation ? " · attested" : ""}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Three ways */}
      <section id="ways" className="container-x scroll-mt-24">
        <h2 className="h-section text-3xl sm:text-4xl">Run it where you prefer</h2>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          Two repositories, both open source. The <b className="text-white">corpus</b> (<a href={CORPUS_URL} target="_blank" rel="noreferrer" className="underline">solanabr/auditor-skill</a>) is the audit itself: checklists, known vectors, prompts. This <b className="text-white">site</b> (<a href={repoUrl} target="_blank" rel="noreferrer" className="underline">{repo}</a>) is the runner, the attestation program and the report pages around it. To audit on your own machine you need only the corpus.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Through this site</div>
            <p className="mt-3 text-sm text-[var(--muted)]">Estimate, key, run, report, attestation. Nothing to install. The report becomes public (or private, by link) and is attested on {clusterLabel()}.</p>
            <Link href="/#start" className="btn btn-outline btn-sm mt-4">Submit a repository</Link>
          </div>
          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Inside Claude Code (the corpus alone)</div>
            <p className="mt-3 text-sm text-[var(--muted)]">Clone solanabr/auditor-skill, load it as a Claude Code plugin in your own repository and run the audit locally, on your subscription or key. No upload, no third party, nothing of ours involved.</p>
            <pre className="mono mt-4 overflow-x-auto rounded-md border border-[var(--border)] bg-black/40 p-3 text-xs">{`git clone https://github.com/solanabr/auditor-skill
claude --plugin-dir ./auditor-skill
> /auditor:audit --scope program`}</pre>
          </div>
          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Self-host this site</div>
            <p className="mt-3 text-sm text-[var(--muted)]">Site, runner, attestation program and report pipeline in one repository, with the corpus as a pinned submodule. One command brings it up locally; the local runner audits any clone with your own Claude Code login.</p>
            <pre className="mono mt-4 overflow-x-auto rounded-md border border-[var(--border)] bg-black/40 p-3 text-xs">{`git clone --recurse-submodules ${repoUrl}
cd ${repo.split("/")[1]?.replace(/\.$/, "")} && pnpm dev
pnpm audit:local -- Org/repo`}</pre>
          </div>
        </div>
      </section>

      {/* Cost */}
      <section id="pricing" className="container-x scroll-mt-24">
        <h2 className="h-section text-3xl sm:text-4xl">Cost</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Estimate</div>
            <div className="mt-2 text-3xl font-bold">Free</div>
            <p className="mt-3 text-sm text-[var(--muted)]">Repository size, language mix, which checklists and known-vector groups apply, expected cost per model. No key needed.</p>
          </div>
          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Audit</div>
            <div className="mt-2 text-3xl font-bold">Your model usage</div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Billed by Anthropic to your key at list prices. Measured on eight on-chain programs with Claude Opus 5: $16 to $32 each. Models offered: {models.map((m) => m.label).join(", ")}.
            </p>
          </div>
          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Attestation</div>
            <div className="mt-2 text-3xl font-bold">Free today</div>
            <p className="mt-3 text-sm text-[var(--muted)]">Written by our attester key. No wallet or SOL on your side.</p>
            <p className="mt-3 text-sm text-[var(--muted)]">Attestations are what we intend to charge for later: a repository audited once would get a new attestation on every subsequent commit, backed by an audit of the diff since the last attested commit.</p>
          </div>
        </div>
      </section>

      {/* On-chain */}
      <section id="onchain" className="container-x scroll-mt-24">
        <div className="card grid gap-8 p-8 md:grid-cols-2">
          <div>
            <h2 className="h-section text-3xl">What is on-chain</h2>
            <p className="mt-3 text-[var(--muted)]">
              Program <span className="mono text-sm">{programId}</span> on {clusterLabel()}. One account per (repository, commit), written only by the attester key; a re-audit of the same commit updates the account rather than creating a second one.
            </p>
            <p className="mt-3 text-[var(--muted)]">Finding text never goes on-chain. Corpus version in use: <span className="mono text-sm">{corpusVersion()}</span>.</p>
          </div>
          <ul className="mono grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {["repo_hash = sha256(url)", "commit_sha", "corpus_version", "model_id", "report_sha256", "counts[critical…info]", "visibility", "timestamp", "attester"].map((f) => (
              <li key={f} className="rounded-md border border-[var(--border)] bg-black/40 px-3 py-2">{f}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
