#!/usr/bin/env tsx
/**
 * Take a repository off the site: delete its report rows (and attestations), remove its
 * files from reports/, and drop a ".skip-ingest" marker in its example clone so
 * `pnpm dev` never republishes it.
 *
 *   pnpm unpublish streamflow-finance/streamflow-program --reason "archived and deprecated upstream"
 *   pnpm unpublish <owner/repo> --dry-run
 *
 * Nothing on-chain is touched: an attestation already written to mainnet is permanent by
 * design. This only removes the report from this site.
 */
import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { prisma } from "@auditor/db";
import { findRepoRoot } from "@auditor/pricing";

loadDotenv({ path: resolve(findRepoRoot(process.cwd()), ".env"), quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** The example clone whose origin is owner/repo, if we have one. */
function findClone(root: string, owner: string, repo: string): string | null {
  const examples = join(root, "examples i runned local");
  if (!existsSync(examples)) return null;
  for (const org of readdirSync(examples)) {
    const orgDir = join(examples, org);
    if (!statSync(orgDir).isDirectory()) continue;
    for (const name of readdirSync(orgDir)) {
      const dir = join(orgDir, name);
      if (!existsSync(join(dir, ".git"))) continue;
      try {
        const url = execFileSync("git", ["remote", "get-url", "origin"], { cwd: dir, stdio: "pipe" }).toString().trim();
        if (new RegExp(`[:/]${owner}/${repo}(\\.git)?/?$`, "i").test(url)) return dir;
      } catch {
        /* no origin */
      }
    }
  }
  return null;
}

async function main() {
  const target = process.argv[2];
  const m = target ? /^([^/\s]+)\/([^/\s]+)$/.exec(target) : null;
  if (!m) throw new Error("usage: unpublish.ts <owner/repo> [--reason '...'] [--dry-run]");
  const [, owner, repo] = m as unknown as [string, string, string];
  const dry = process.argv.includes("--dry-run");
  const reason = arg("reason") ?? "unpublished by the operator";
  const root = findRepoRoot(process.cwd());
  const reportsDir = resolve(root, process.env.REPORTS_DIR?.length ? process.env.REPORTS_DIR : "reports");

  const rows = await prisma.report.findMany({ where: { owner, repo }, include: { attestation: true } });
  if (rows.length === 0) console.log(`no reports on the site for ${owner}/${repo}`);
  for (const r of rows) {
    console.log(`${dry ? "[dry] " : ""}remove report ${r.corpusVersion} ${r.model} @ ${r.commit.slice(0, 7)}  (${r.storagePath})${r.attestation ? `  [attested on-chain: ${r.attestation.txSig.slice(0, 12)}… stays on-chain]` : ""}`);
  }
  if (!dry && rows.length) {
    await prisma.report.deleteMany({ where: { owner, repo } });
    const dir = join(reportsDir, owner, repo);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      console.log(`removed files ${dir}`);
    }
  }

  const clone = findClone(root, owner, repo);
  if (clone) {
    const marker = join(clone, ".skip-ingest");
    console.log(`${dry ? "[dry] " : ""}mark ${clone.replace(root + "/", "")} → .skip-ingest (${reason})`);
    if (!dry) writeFileSync(marker, `${reason}\nunpublished ${new Date().toISOString()}\n`);
  } else {
    console.log("no example clone found for this repo; nothing to mark");
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exit(1);
});
