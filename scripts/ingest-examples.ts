#!/usr/bin/env tsx
/**
 * Batch-ingest the hand-run audits under "examples i runned local/<Org>/<repo>/":
 * each is a git clone with one or more corpus runs inside (audit_1/, audit_2/ …). The
 * commit, corpus and model of each run come from its audit_N/.attest.json sidecar
 * (examples-snapshot.ts / audit-local.sh write it); the repo url from the clone's origin.
 *
 *   pnpm ingest:examples -- [--model <fallback id>] [--dry-run] [--visibility public|private]
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

loadDotenv({ path: resolve(findRepoRoot(process.cwd()), ".env"), quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (n: string) => process.argv.includes(`--${n}`);

interface Example {
  dir: string;
  label: string; // Org/repo/audit_N
  url: string;
  owner: string;
  repo: string;
  commit: string;
  corpus: string;
  /** Model recorded in the sidecar; null for legacy dirs without one (falls back to --model). */
  model: string | null;
  scope: "full" | "program";
  finishedAt: Date;
  reportPath: string;
}

function git(dir: string, args: string[]): string {
  return execFileSync("git", args, { cwd: dir, stdio: "pipe" }).toString().trim();
}

/**
 * Every "<Org>/<repo>/audit_N/REPORT.md". The commit/corpus/model come from the
 * ".attest.json" sidecar written by examples-snapshot.ts or audit-local.sh; a dir without
 * one is pinned to the clone's current HEAD (only right before the clone is updated).
 */
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
      // Written by scripts/unpublish.ts: never put this repo back on the site.
      const skipMarker = join(dir, ".skip-ingest");
      if (existsSync(skipMarker)) {
        skipped.push({ label, reason: readFileSync(skipMarker, "utf8").trim().split("\n")[0] || "marked .skip-ingest" });
        continue;
      }
      const auditDirs = readdirSync(dir).filter((e) => /^audit_\d+$/.test(e) && existsSync(join(dir, e, "REPORT.md"))).sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)));
      if (auditDirs.length === 0) {
        skipped.push({ label, reason: "no audit_N/REPORT.md" });
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
      for (const a of auditDirs) {
        const reportPath = join(dir, a, "REPORT.md");
        const sidecarPath = join(dir, a, ".attest.json");
        let commit: string, corpus: string, model: string | null, scope: "full" | "program", finishedAt: Date;
        if (existsSync(sidecarPath)) {
          const s = JSON.parse(readFileSync(sidecarPath, "utf8")) as { commit: string; corpus: string; model?: string; scope?: string; finished_at?: string };
          commit = s.commit;
          corpus = s.corpus;
          // Dated ids from the CLI (claude-haiku-4-5-20251001) → config/models.json ids.
          model = s.model ? s.model.replace(/-\d{8}$/, "") : null;
          scope = s.scope === "full" ? "full" : "program";
          finishedAt = s.finished_at ? new Date(s.finished_at) : statSync(reportPath).mtime;
        } else {
          commit = git(dir, ["rev-parse", "HEAD"]);
          corpus = corpusOfClone(dir);
          model = null;
          scope = "program";
          finishedAt = statSync(reportPath).mtime;
        }
        found.push({ dir, label: `${label}/${a}`, url: gh.url, owner: gh.owner, repo: gh.repo, commit, corpus, model, scope, finishedAt, reportPath });
      }
    }
  }
  return { found, skipped };
}

function corpusOfClone(dir: string): string {
  const manifest = join(dir, "AUDITOR", ".claude-plugin", "plugin.json");
  if (existsSync(manifest)) {
    try {
      const v = (JSON.parse(readFileSync(manifest, "utf8")) as { version?: string }).version;
      if (v) return `auditor-skill@${v}`;
    } catch {
      /* fall through */
    }
  }
  const skill = join(dir, "AUDITOR", "SKILL.md");
  if (existsSync(skill)) {
    const m = readFileSync(skill, "utf8").match(/\*\*Version:\*\*\s*([0-9][0-9.]*)/);
    if (m) return `auditor-skill@${m[1]}`;
  }
  return "auditor-skill@unknown";
}

async function main() {
  const root = resolve(arg("dir") ?? "examples i runned local");
  const only = arg("only");
  const dry = flag("dry-run");
  const visibility = (arg("visibility") ?? "public") as "public" | "private";
  const model = arg("model") ?? process.env.EXAMPLES_MODEL;
  if (model) getModel(model, loadModels());

  const { found, skipped } = discover(root);
  const list = only ? found.filter((e) => e.label.toLowerCase().includes(only.toLowerCase())) : found;
  if (!dry) {
    for (const e of list) {
      if (!e.model && !model) throw new Error(`${e.label}: no model in its .attest.json and no --model / EXAMPLES_MODEL fallback`);
      if (e.model) getModel(e.model, loadModels());
    }
  }
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
    const useModel = e.model ?? model ?? "?";
    const row: Record<string, string | number> = { audit: e.label, commit: e.commit.slice(0, 7), corpus: e.corpus.replace("auditor-skill@", ""), model: useModel, fmt: p.format, C: c.critical, H: c.high, M: c.medium, L: c.low, I: c.info, max: p.highestSeverity ?? "-", warn: p.warnings.length };
    // The report's own date beats the file's mtime (the files were copied later).
    const finishedAt = p.meta.date && !Number.isNaN(Date.parse(p.meta.date)) ? new Date(p.meta.date) : e.finishedAt;
    const runPath = join(e.dir, e.label.split("/").pop()!, "run.json");
    const runJson = existsSync(runPath) ? (JSON.parse(readFileSync(runPath, "utf8")) as unknown) : undefined;
    if (!dry && ingest && env) {
      const usage = runJson ? ingest.usageFromRunJson(runJson, useModel) : { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0 };
      const out = await ingest.ingestReport(env, {
        reportMd: md,
        repoUrl: e.url,
        owner: e.owner,
        repo: e.repo,
        commit: e.commit,
        model: useModel,
        corpusVersion: e.corpus,
        visibility,
        submitterVerified: false,
        jobId: null,
        tier: "manual",
        startedAt: null,
        finishedAt,
        usage,
        runJson,
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
