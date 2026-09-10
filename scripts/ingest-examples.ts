#!/usr/bin/env tsx
/**
 * Batch-ingest the hand-run audits under "examples i runned local/<Org>/<repo>/":
 * each is a git clone with the corpus's audit_1/REPORT.md inside. Repo url and commit come
 * from the clone itself; the corpus version from AUDITOR/.claude-plugin/plugin.json.
 *
 *   pnpm ingest:examples -- --model claude-opus-5 [--dry-run] [--visibility public|private]
 *                            [--dir "examples i runned local"] [--only Kamino/klend] [--attest]
 *
 * --dry-run parses every report and prints counts/format/warnings without touching the
 * database (no Postgres needed). Without it, reports are written to reports/ and the DB.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { findRepoRoot, getModel, loadModels } from "@auditor/pricing";
import { parseGitHubUrl, parseReport } from "@auditor/report";

loadDotenv({ path: resolve(findRepoRoot(process.cwd()), ".env") });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (n: string) => process.argv.includes(`--${n}`);

interface Example {
  dir: string;
  label: string;
  url: string;
  owner: string;
  repo: string;
  commit: string;
  corpus: string;
  reportPath: string;
}

function git(dir: string, args: string[]): string {
  return execFileSync("git", args, { cwd: dir, stdio: "pipe" }).toString().trim();
}

export function discover(root: string): { found: Example[]; skipped: { label: string; reason: string }[] } {
  const found: Example[] = [];
  const skipped: { label: string; reason: string }[] = [];
  for (const org of readdirSync(root).sort()) {
    const orgDir = join(root, org);
    if (!statSync(orgDir).isDirectory()) continue;
    for (const name of readdirSync(orgDir).sort()) {
      const dir = join(orgDir, name);
      const label = `${org}/${name}`;
      if (!statSync(dir).isDirectory()) continue;
      if (!existsSync(join(dir, ".git"))) {
        skipped.push({ label, reason: "not a git clone" });
        continue;
      }
      const reportPath = join(dir, "audit_1", "REPORT.md");
      if (!existsSync(reportPath)) {
        skipped.push({ label, reason: "no audit_1/REPORT.md" });
        continue;
      }
      let url = "";
      try {
        url = git(dir, ["remote", "get-url", "origin"]);
      } catch {
        skipped.push({ label, reason: "no origin remote" });
        continue;
      }
      const gh = parseGitHubUrl(url);
      if (!gh) {
        skipped.push({ label, reason: `origin is not GitHub: ${url}` });
        continue;
      }
      const commit = git(dir, ["rev-parse", "HEAD"]);
      let corpus = "unknown";
      const manifest = join(dir, "AUDITOR", ".claude-plugin", "plugin.json");
      const skill = join(dir, "AUDITOR", "SKILL.md");
      if (existsSync(manifest)) {
        try {
          corpus = String((JSON.parse(readFileSync(manifest, "utf8")) as { version?: string }).version ?? "unknown");
        } catch {
          /* fall through */
        }
      }
      if (corpus === "unknown" && existsSync(skill)) {
        const m = readFileSync(skill, "utf8").match(/\*\*Version:\*\*\s*([0-9][0-9.]*)/);
        if (m) corpus = m[1]!;
      }
      found.push({ dir, label, url: gh.url, owner: gh.owner, repo: gh.repo, commit, corpus: `auditor-skill@${corpus}`, reportPath });
    }
  }
  return { found, skipped };
}

async function main() {
  const root = resolve(arg("dir") ?? "examples i runned local");
  const only = arg("only");
  const dry = flag("dry-run");
  const visibility = (arg("visibility") ?? "public") as "public" | "private";
  const model = arg("model");
  if (!dry && !model) throw new Error("--model <id from config/models.json> is required (the model you ran these audits with)");
  if (model) getModel(model, loadModels());

  const { found, skipped } = discover(root);
  const list = only ? found.filter((e) => e.label.toLowerCase().includes(only.toLowerCase())) : found;
  console.log(`found ${found.length} reports, skipped ${skipped.length}${only ? `, selected ${list.length}` : ""}`);
  for (const s of skipped) console.log(`  skip ${s.label}: ${s.reason}`);

  const rows: Record<string, string | number>[] = [];
  let ingest: typeof import("../apps/worker/src/ingest.js") | null = null;
  let env: import("../apps/worker/src/env.js").WorkerEnv | null = null;
  if (!dry) {
    ingest = await import("../apps/worker/src/ingest.js");
    env = (await import("../apps/worker/src/env.js")).loadEnv();
  }
  for (const e of list) {
    const md = readFileSync(e.reportPath);
    const p = parseReport(md.toString("utf8"));
    const c = p.counts;
    const row: Record<string, string | number> = { repo: `${e.owner}/${e.repo}`, commit: e.commit.slice(0, 7), corpus: e.corpus, fmt: p.format, C: c.critical, H: c.high, M: c.medium, L: c.low, I: c.info, max: p.highestSeverity ?? "-", findings: p.findings.length, warn: p.warnings.length };
    if (!dry && ingest && env) {
      const out = await ingest.ingestReport(env, {
        reportMd: md,
        repoUrl: e.url,
        owner: e.owner,
        repo: e.repo,
        commit: e.commit,
        model: model!,
        corpusVersion: e.corpus,
        visibility,
        submitterVerified: false,
        jobId: null,
        tier: "manual",
        startedAt: null,
        finishedAt: statSync(e.reportPath).mtime,
        usage: { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0 },
        attest: flag("attest"),
      });
      row.page = `/r/${e.owner}/${e.repo}/${e.commit.slice(0, 7)}`;
      row.attested = out.attested ? "yes" : "no";
    }
    rows.push(row);
    if (p.warnings.length) console.log(`  ${e.label}: ${p.warnings.join(" | ")}`);
  }
  console.table(rows);
  if (!dry) {
    const { prisma } = await import("@auditor/db");
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
