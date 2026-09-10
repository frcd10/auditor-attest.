import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { SeverityBadges } from "@/components/SeverityBadges";
import { corpusVersion, siteUrl } from "@/lib/env";
import { int, shortSha, usd, when } from "@/lib/format";
import { githubConfigured } from "@/lib/github";
import { findReport, loadReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

type Params = { owner: string; repo: string; sha: string };

async function load(params: Params, token: string | undefined) {
  const row = await findReport(params.owner, params.repo, params.sha);
  if (!row) return null;
  const loaded = loadReport(row);
  if (!loaded) return null;
  if (loaded.visibility === "private" && token !== row.accessToken) return "private" as const;
  return loaded;
}

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ t?: string }> }): Promise<Metadata> {
  const p = await params;
  const { t } = await searchParams;
  const r = await load(p, t);
  if (!r || r === "private") return { title: "Report", robots: { index: false } };
  const c = r.parsed.counts;
  return {
    title: `${p.owner}/${p.repo}@${shortSha(r.row.commit)}`,
    description: `Security audit: ${c.critical} critical, ${c.high} high, ${c.medium} medium, ${c.low} low, ${c.info} info. Corpus ${r.row.corpusVersion}, model ${r.row.model}.`,
    robots: { index: r.visibility !== "private" },
  };
}

export default async function ReportPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ t?: string; verified?: string; verify_error?: string }> }) {
  const p = await params;
  const { t, verified, verify_error } = await searchParams;
  const r = await load(p, t);
  if (!r || r === "private") notFound();
  const { row, parsed, markdown, redacted, visibility } = r;
  const att = row.attestation;
  const readmeBadge = `[![audit](${siteUrl()}/badge/${row.owner}/${row.repo}.svg)](${siteUrl()}/r/${row.owner}/${row.repo})`;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">
          <a href={`https://github.com/${row.owner}/${row.repo}`} target="_blank" rel="noreferrer" className="no-underline text-[var(--text)]">
            {row.owner}/{row.repo}
          </a>{" "}
          <span className="mono text-base text-[var(--muted)]">
            @ <a href={`https://github.com/${row.owner}/${row.repo}/commit/${row.commit}`} target="_blank" rel="noreferrer">{shortSha(row.commit)}</a>
          </span>
        </h1>
        <SeverityBadges counts={parsed.counts} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs mono">
          <dt className="text-[var(--muted)]">Visibility</dt>
          <dd>{visibility}{row.submitterVerified ? " · submitter verified as maintainer" : ""}</dd>
          <dt className="text-[var(--muted)]">Corpus</dt>
          <dd>auditor-skill {row.corpusVersion || corpusVersion()}</dd>
          <dt className="text-[var(--muted)]">Model</dt>
          <dd>{row.model}</dd>
          <dt className="text-[var(--muted)]">Highest severity</dt>
          <dd>{parsed.highestSeverity ?? "none"} / 10</dd>
          <dt className="text-[var(--muted)]">Report sha256</dt>
          <dd className="break-all">{row.reportSha256}</dd>
          <dt className="text-[var(--muted)]">Finished</dt>
          <dd>{when(row.finishedAt)}</dd>
          <dt className="text-[var(--muted)]">Usage</dt>
          <dd>{int(row.inputTokens)} in · {int(row.outputTokens)} out · {int(row.cacheReadTokens)} cache read · {usd(Number(row.costUsd), 2)}</dd>
          <dt className="text-[var(--muted)]">Attestation</dt>
          <dd>
            {att ? (
              <>
                <a href={`https://explorer.solana.com/tx/${att.txSig}`} target="_blank" rel="noreferrer">tx {att.txSig.slice(0, 12)}…</a> · <a href={`https://explorer.solana.com/address/${att.pda}`} target="_blank" rel="noreferrer">account {att.pda.slice(0, 12)}…</a>
              </>
            ) : (
              <span className="text-[var(--muted)]">not attested yet</span>
            )}
          </dd>
        </dl>
        {verified && <div className="rounded-md border border-[#3ddc97] bg-[#0f2a1f] p-3 text-sm">{verified}</div>}
        {verify_error && <div className="rounded-md border border-[var(--high)] bg-[#2a1f12] p-3 text-sm">Acknowledgement failed: {verify_error}</div>}
        {redacted && (
          <div className="rounded-md border border-[var(--high)] bg-[#2a1f12] p-3 text-sm">
            Critical and High findings are withheld: the submitter is not a verified maintainer. They become visible when a maintainer acknowledges the report or on {row.redactUntil ? row.redactUntil.toISOString().slice(0, 10) : "the disclosure date"}. Severity counts above are exact and match the on-chain attestation.
            {githubConfigured() && (
              <>
                {" "}
                <a href={`/api/auth/github?report=${row.id}`} className="font-semibold">
                  Maintainer? Acknowledge with GitHub →
                </a>
              </>
            )}
          </div>
        )}
        {visibility !== "private" && (
          <details className="text-xs text-[var(--muted)]">
            <summary className="cursor-pointer">README badge</summary>
            <pre className="mt-1 overflow-x-auto rounded-md border border-[var(--border)] p-2 mono">{readmeBadge}</pre>
          </details>
        )}
        {parsed.warnings.length > 0 && (
          <details className="text-xs text-[var(--muted)]">
            <summary className="cursor-pointer">Parser notes ({parsed.warnings.length})</summary>
            <ul className="mt-1 list-disc pl-5">
              {parsed.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <section className="panel p-5">
        <Markdown source={markdown} />
      </section>
    </div>
  );
}
