#!/usr/bin/env tsx
/**
 * Operator batch: queue full audits for many repositories without the pay step.
 * Jobs are created in `quoting` with autoEnqueue = true; the worker quotes each one,
 * sets the budget cap and moves it to `queued` automatically. Runs on ANTHROPIC_API_KEY.
 *
 *   pnpm audit:batch -- --model claude-opus-5 [--scope full|program] [--visibility public|private]
 *        [--from-examples]        queue every clone under "examples i runned local" at the
 *                                 same commit as the hand-run report (apples to apples)
 *        [--head]                 …but audit the default branch HEAD instead of that commit
 *        [--urls urls.txt]        one GitHub url per line (optionally /tree/<ref>)
 *        [--only kamino]          substring filter
 *        [--dry-run]              print what would be queued
 *
 * Needs Postgres up (pnpm dev). Every queued job spends real money on your key once the
 * worker picks it up; the per-job cap is estimate × BUDGET_FACTOR.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { prisma } from "@auditor/db";
import { AUDIT_SCOPES, findRepoRoot, getModel, loadModels, type AuditScope } from "@auditor/pricing";
import { parseGitHubUrl } from "@auditor/report";
import { discover } from "./ingest-examples.js";

loadDotenv({ path: resolve(findRepoRoot(process.cwd()), ".env"), quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (n: string) => process.argv.includes(`--${n}`);

async function main() {
  const model = arg("model");
  if (!model) throw new Error("--model <id> is required");
  getModel(model, loadModels());
  const visibility = (arg("visibility") ?? "public") as "public" | "private";
  const scope = (arg("scope") ?? "full") as AuditScope;
  if (!AUDIT_SCOPES.includes(scope)) throw new Error("--scope must be full or program");
  const only = arg("only")?.toLowerCase();
  const targets: { url: string; owner: string; repo: string; ref: string | null; label: string }[] = [];

  if (flag("from-examples")) {
    const { found } = discover(resolve(arg("dir") ?? "examples i runned local"));
    for (const e of found) targets.push({ url: e.url, owner: e.owner, repo: e.repo, ref: flag("head") ? null : e.commit, label: e.label });
  }
  const urls = arg("urls");
  if (urls) {
    for (const line of readFileSync(urls, "utf8").split("\n")) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const gh = parseGitHubUrl(s);
      if (!gh) throw new Error(`not a GitHub url: ${s}`);
      targets.push({ url: gh.url, owner: gh.owner, repo: gh.repo, ref: gh.ref, label: `${gh.owner}/${gh.repo}` });
    }
  }
  const list = only ? targets.filter((t) => t.label.toLowerCase().includes(only)) : targets;
  if (list.length === 0) throw new Error("nothing to queue (use --from-examples or --urls)");

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const rows: Record<string, string>[] = [];
  for (const t of list) {
    if (flag("dry-run")) {
      rows.push({ repo: `${t.owner}/${t.repo}`, ref: t.ref ?? "(default branch)", model, scope, visibility });
      continue;
    }
    const job = await prisma.job.create({
      data: { repoUrl: t.url, owner: t.owner, repo: t.repo, ref: t.ref, tier: "standard", model, visibility, scope, status: "quoting", autoEnqueue: true },
    });
    await prisma.jobEvent.create({ data: { jobId: job.id, message: "created by operator batch (audit-batch.ts)", data: { ref: t.ref, model, scope } } });
    rows.push({ repo: `${t.owner}/${t.repo}`, ref: t.ref ?? "(default branch)", job: `${site}/q/${job.id}` });
  }
  console.table(rows);
  console.log(flag("dry-run") ? `dry run: ${list.length} jobs would be queued` : `${list.length} jobs created; the worker quotes and runs them one at a time`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exit(1);
});
