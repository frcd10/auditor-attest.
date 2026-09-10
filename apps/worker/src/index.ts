/**
 * Worker loop: pulls jobs from Postgres and runs them one at a time.
 *   quoting → runQuote (clone + tokei + estimate)
 *   queued  → runAudit (sandbox container + ingest)
 */
import { Prisma, prisma, type Job } from "@auditor/db";
import { existsSync } from "node:fs";
import { runAudit } from "./audit.js";
import { dockerAvailable, imageExists } from "./docker.js";
import { loadEnv } from "./env.js";
import { log } from "./log.js";
import { runQuote } from "./quote.js";

let stopping = false;
process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));

/** Atomically claim the oldest job in `from`, moving it to `to`. Safe with several workers. */
async function claim(from: "quoting" | "queued", to: "quote_running" | "running"): Promise<{ job: Job; byokCiphertext: string | null } | null> {
  const rows = await prisma.$queryRaw<{ id: string; byokCiphertext: string | null }[]>(Prisma.sql`
    UPDATE "Job" SET status = ${to}::"JobStatus", "updatedAt" = now(),
      "startedAt" = CASE WHEN ${to} = 'running' THEN now() ELSE "startedAt" END
    WHERE id = (
      SELECT id FROM "Job" WHERE status = ${from}::"JobStatus" ORDER BY "createdAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING id, "byokCiphertext"`);
  const row = rows[0];
  if (!row) return null;
  // Wipe the BYOK ciphertext the moment the job is claimed; it lives only in this process now.
  if (row.byokCiphertext) await prisma.job.update({ where: { id: row.id }, data: { byokCiphertext: null } });
  const job = await prisma.job.findUniqueOrThrow({ where: { id: row.id } });
  return { job, byokCiphertext: row.byokCiphertext };
}

async function main() {
  const env = loadEnv();
  log("info", "worker starting", { reportsDir: env.reportsDir, corpusDir: env.corpusDir, corpusVersion: env.corpusVersion, sandboxImage: env.sandboxImage, cluster: env.cluster });
  if (!existsSync(env.corpusDir + "/.claude-plugin/plugin.json")) throw new Error(`corpus not found at ${env.corpusDir}; run: git submodule update --init`);
  const hasDocker = await dockerAvailable();
  if (!hasDocker) log("warn", "docker is not available: quotes will run, audits will fail until Docker is installed");
  else if (!(await imageExists(env.sandboxImage))) log("warn", `sandbox image ${env.sandboxImage} not built yet: run pnpm sandbox:build`);
  if (!env.serviceApiKey) log("warn", "ANTHROPIC_API_KEY not set: only byok jobs can run");

  while (!stopping) {
    try {
      const q = await claim("quoting", "quote_running");
      if (q) {
        await runQuote(env, q.job);
        continue;
      }
      const r = await claim("queued", "running");
      if (r) {
        if (!hasDocker) {
          await prisma.job.update({ where: { id: r.job.id }, data: { status: "failed", error: "docker not available on worker" } });
          continue;
        }
        await runAudit(env, r.job, r.byokCiphertext);
        continue;
      }
    } catch (err) {
      log("error", `loop error: ${(err as Error).message}`);
    }
    await new Promise((res) => setTimeout(res, env.pollMs));
  }
  log("info", "worker stopped");
  await prisma.$disconnect();
}

main().catch((err) => {
  log("error", `fatal: ${(err as Error).stack ?? err}`);
  process.exit(1);
});
