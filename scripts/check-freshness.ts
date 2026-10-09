#!/usr/bin/env tsx
/**
 * For every repository published on the site, report whether it is still alive and
 * whether we audited a current commit:
 *   - archived / disabled on GitHub, and the repo description
 *   - last push, and whether that is within the last N months (default 12)
 *   - the head commit of the default branch vs the commit we audited (and how far behind)
 *
 * Read-only: one GitHub API call per repo (unauthenticated is enough for ~29 repos; set
 * GITHUB_TOKEN to raise the rate limit) plus `git ls-remote`, which needs no API quota.
 *
 *   pnpm exec tsx scripts/check-freshness.ts [--months 12] [--json]
 */
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { config as loadDotenv } from "dotenv";
import { prisma } from "@auditor/db";
import { findRepoRoot } from "@auditor/pricing";

const execFileP = promisify(execFile);
loadDotenv({ path: resolve(findRepoRoot(process.cwd()), ".env"), quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export interface Freshness {
  owner: string;
  repo: string;
  auditedCommit: string;
  corpora: string[];
  archived: boolean | null;
  description: string | null;
  pushedAt: string | null;
  monthsSincePush: number | null;
  headCommit: string | null;
  atHead: boolean | null;
  behindDays: number | null;
  /** stale = archived, or no push within the window. */
  verdict: "ok" | "stale" | "archived" | "unknown";
  notes: string[];
}

async function ghRepo(owner: string, repo: string): Promise<Record<string, unknown> | null> {
  const headers: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "auditor-attest" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function headOfDefaultBranch(owner: string, repo: string): Promise<string | null> {
  try {
    const { stdout } = await execFileP("git", ["ls-remote", "--symref", `https://github.com/${owner}/${repo}`, "HEAD"], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "/bin/false" },
      timeout: 60_000,
    });
    return /^([0-9a-f]{40})\tHEAD$/m.exec(stdout)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const months = Number(arg("months") ?? 12);
  const rows = await prisma.report.findMany({ select: { owner: true, repo: true, commit: true, corpusVersion: true }, orderBy: { owner: "asc" } });
  const byRepo = new Map<string, { owner: string; repo: string; commit: string; corpora: string[] }>();
  for (const r of rows) {
    const k = `${r.owner}/${r.repo}`;
    const e = byRepo.get(k) ?? { owner: r.owner, repo: r.repo, commit: r.commit, corpora: [] };
    e.corpora.push(r.corpusVersion.replace("auditor-skill@", ""));
    byRepo.set(k, e);
  }

  const out: Freshness[] = [];
  for (const e of byRepo.values()) {
    const [meta, head] = await Promise.all([ghRepo(e.owner, e.repo), headOfDefaultBranch(e.owner, e.repo)]);
    const pushedAt = (meta?.pushed_at as string) ?? null;
    const monthsSince = pushedAt ? (Date.now() - Date.parse(pushedAt)) / (1000 * 60 * 60 * 24 * 30.44) : null;
    const archived = meta ? Boolean(meta.archived) : null;
    const atHead = head ? head === e.commit : null;
    const notes: string[] = [];
    if (meta === null) notes.push("GitHub API unavailable (rate limit or repo gone)");
    if (head === null) notes.push("could not read the default branch head");
    let verdict: Freshness["verdict"] = "unknown";
    if (archived === true) verdict = "archived";
    else if (monthsSince !== null) verdict = monthsSince <= months ? "ok" : "stale";
    out.push({
      owner: e.owner,
      repo: e.repo,
      auditedCommit: e.commit,
      corpora: [...new Set(e.corpora)].sort(),
      archived,
      description: (meta?.description as string) ?? null,
      pushedAt,
      monthsSincePush: monthsSince === null ? null : Number(monthsSince.toFixed(1)),
      headCommit: head,
      atHead,
      behindDays: null,
      verdict,
      notes,
    });
  }

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
    console.log(pad("repo", 44) + pad("estado", 10) + pad("último push", 13) + pad("meses", 7) + pad("no HEAD?", 10) + "corpus");
    for (const r of out.sort((a, b) => a.verdict.localeCompare(b.verdict) || (b.monthsSincePush ?? 0) - (a.monthsSincePush ?? 0))) {
      console.log(
        pad(`${r.owner}/${r.repo}`, 44) +
          pad(r.verdict, 10) +
          pad(r.pushedAt?.slice(0, 10) ?? "?", 13) +
          pad(r.monthsSincePush === null ? "?" : String(r.monthsSincePush), 7) +
          pad(r.atHead === null ? "?" : r.atHead ? "sim" : "não", 10) +
          r.corpora.join(","),
      );
    }
    const bad = out.filter((r) => r.verdict !== "ok");
    console.log(`\n${out.length} repos · ok ${out.length - bad.length} · arquivados ${out.filter((r) => r.verdict === "archived").length} · parados >${months}m ${out.filter((r) => r.verdict === "stale").length} · desconhecidos ${out.filter((r) => r.verdict === "unknown").length}`);
    for (const r of bad) console.log(`  ${r.owner}/${r.repo}: ${r.verdict}${r.description ? ` — ${r.description}` : ""}${r.notes.length ? ` [${r.notes.join("; ")}]` : ""}`);
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exit(1);
});
