#!/usr/bin/env tsx
/**
 * Local smoke test: create a job exactly like the `/` form does, wait for the worker to
 * quote it, print the quote, then (by default) select the free quick tier.
 *
 *   pnpm exec tsx scripts/smoke-local.ts https://github.com/owner/repo [--keep]
 *
 * --keep leaves the job in `quoted` so you can pick a tier in the browser at /q/<id>.
 */
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { prisma } from "@auditor/db";
import { defaultModelId, findRepoRoot, loadModels } from "@auditor/pricing";
import { parseGitHubUrl } from "@auditor/report";

loadDotenv({ path: resolve(findRepoRoot(process.cwd()), ".env"), quiet: true });

async function main() {
  const url = process.argv[2];
  const gh = url ? parseGitHubUrl(url) : null;
  if (!gh) throw new Error("usage: smoke-local.ts <github url> [--keep]");
  const job = await prisma.job.create({
    data: { repoUrl: gh.url, owner: gh.owner, repo: gh.repo, ref: gh.ref, model: defaultModelId(loadModels()), tier: "quick", visibility: "private", status: "quoting" },
  });
  await prisma.jobEvent.create({ data: { jobId: job.id, message: "job created (smoke-local)", data: { url: gh.url } } });
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  console.log(`job ${job.id} → ${site}/q/${job.id}`);
  const started = Date.now();
  for (;;) {
    const j = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, include: { quote: true, events: { orderBy: { at: "desc" }, take: 1 } } });
    if (j.status === "quoted" && j.quote) {
      const b = j.quote.breakdown as { perModel?: Record<string, { estCostUsd: number; suggestedLimitUsd: number }> };
      console.log(`quoted in ${((Date.now() - started) / 1000).toFixed(1)}s: commit ${j.commitSha} · ${j.quote.loc} code LOC · ${j.quote.files} files`);
      console.log("languages:", JSON.stringify(j.quote.languages));
      console.log("scope:", JSON.stringify(j.quote.scope));
      console.table(Object.fromEntries(Object.entries(b.perModel ?? {}).map(([k, v]) => [k, { estCostUsd: v.estCostUsd.toFixed(4), suggestedLimitUsd: v.suggestedLimitUsd }])));
      if (!process.argv.includes("--keep")) {
        await prisma.job.update({ where: { id: job.id }, data: { tier: "quick", status: "done", finishedAt: new Date() } });
        console.log("quick tier selected → done");
      }
      return;
    }
    if (j.status === "failed") throw new Error(`job failed: ${j.error}`);
    if (Date.now() - started > 180_000) throw new Error(`timeout; last event: ${j.events[0]?.message ?? "none"} (is the worker running?)`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await prisma.$disconnect();
    process.exit(1);
  });
