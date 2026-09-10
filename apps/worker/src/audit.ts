import { existsSync, mkdirSync, readFileSync, rmSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { prisma, type Job } from "@auditor/db";
import { budgetFor, envNumber } from "@auditor/pricing";
import { decryptSecret } from "./byok.js";
import { ensureEgress, runSandbox } from "./docker.js";
import type { WorkerEnv } from "./env.js";
import { shallowClone, makeReadOnly } from "./git.js";
import { ingestReport, usageFromRunJson } from "./ingest.js";
import { jobEvent } from "./log.js";
import { DISALLOWED_TOOLS, loadSystemAppend, loadTurns } from "./prompts.js";

const PERSISTED_EVENTS = new Set(["start", "init", "turn_start", "turn_result", "report", "done", "error", "fatal", "warn", "timeout"]);

/** Handle a job the loop has already moved to `running`. */
export async function runAudit(env: WorkerEnv, job: Job, byokCiphertext: string | null): Promise<void> {
  const jobDir = join(env.jobsDir, job.id, "run");
  const repoDir = join(jobDir, "repo");
  const outDir = join(jobDir, "out");
  const startedAt = new Date();
  let keepOut = false;
  try {
    if (!job.commitSha) throw new Error("job has no commitSha (quote step did not run)");
    const quote = await prisma.quote.findUnique({ where: { jobId: job.id } });
    if (!quote) throw new Error("job has no quote");
    if (job.tier === "quick") throw new Error("quick tier jobs never run the sandbox");

    // API key: service key for standard, decrypted BYOK for byok. Never logged, never persisted.
    let apiKey: string;
    if (job.tier === "byok") {
      if (!byokCiphertext) throw new Error("byok job has no key");
      if (!env.byokKek) throw new Error("BYOK_KEK not configured");
      apiKey = decryptSecret(byokCiphertext, env.byokKek);
    } else {
      if (!env.serviceApiKey) throw new Error("ANTHROPIC_API_KEY not configured on the worker");
      apiKey = env.serviceApiKey;
    }

    const budget = job.budgetUsd ? Number(job.budgetUsd) : budgetFor({ estCostUsd: Number(quote.estCostUsd) });
    mkdirSync(outDir, { recursive: true });
    chmodSync(outDir, 0o777); // runner uid 10001 must write here

    await jobEvent(job.id, "cloning target", { commit: job.commitSha });
    await shallowClone(job.repoUrl, job.commitSha, repoDir);
    await makeReadOnly(repoDir);

    const proxyUrl = await ensureEgress(env);
    const scope = job.scope === "program" ? "program" : "full";
    const vars = {
      CORPUS_VERSION: env.corpusVersion,
      OWNER: job.owner,
      REPO: job.repo,
      COMMIT: job.commitSha,
      SCOPE: scope,
      CLASSIFICATION: job.visibility === "public" ? "Public" : "Confidential — Client Only",
    };
    const spec = {
      jobId: job.id,
      model: job.model,
      apiKey,
      maxBudgetUsd: budget,
      maxTurns: envNumber("MAX_JOB_TURNS", 2000),
      effort: process.env.SANDBOX_EFFORT || undefined,
      systemAppend: loadSystemAppend(vars),
      turns: loadTurns(vars),
      disallowedTools: DISALLOWED_TOOLS,
      timeoutMinutes: env.maxJobMinutes,
      proxyUrl,
    };
    await jobEvent(job.id, "starting sandbox", { image: env.sandboxImage, model: job.model, budgetUsd: budget, tier: job.tier });
    const containerName = `auditor-job-${job.id}`;
    await prisma.job.update({ where: { id: job.id }, data: { containerId: containerName, budgetUsd: budget } });

    const result = await runSandbox(env, {
      name: containerName,
      repoDir,
      outDir,
      spec,
      proxyUrl,
      logFile: join(outDir, "container.log"),
      killAfterMs: (env.maxJobMinutes + 5) * 60_000,
      onEvent: (ev) => {
        const t = String(ev.t ?? "");
        if (PERSISTED_EVENTS.has(t)) void jobEvent(job.id, `runner: ${t}`, ev, t === "error" || t === "fatal" ? "error" : t === "warn" ? "warn" : "info");
      },
    });
    apiKey = "";
    await jobEvent(job.id, "sandbox exited", { exitCode: result.exitCode, signal: result.signal, killed: result.killed });

    const statusPath = join(outDir, "status.json");
    const runPath = join(outDir, "run.json");
    const reportPath = join(outDir, "report.md");
    const status = existsSync(statusPath) ? (JSON.parse(readFileSync(statusPath, "utf8")) as { status: string; error?: string | null }) : { status: "failed", error: "runner produced no status.json" };
    const runJson = existsSync(runPath) ? (JSON.parse(readFileSync(runPath, "utf8")) as Record<string, unknown>) : null;
    const usage = usageFromRunJson(runJson, job.model);
    await jobEvent(job.id, "usage", { ...usage, runner_status: status.status });

    // Persist actual usage on the quote row's job for calibration even when the run failed.
    if (status.status === "failed_budget" || result.killed || status.status !== "ok" || !existsSync(reportPath)) {
      keepOut = true;
      const jobStatus = status.status === "failed_budget" ? "failed_budget" : "failed";
      await prisma.job.update({
        where: { id: job.id },
        data: { status: jobStatus, finishedAt: new Date(), error: (status.error ?? `runner status ${status.status}`).slice(0, 1000) },
      });
      await jobEvent(job.id, `job ${jobStatus}`, { runner_status: status.status, cost_usd: usage.cost_usd }, "error");
      return;
    }

    await prisma.job.update({ where: { id: job.id }, data: { status: "ingesting" } });
    const finishedAt = new Date();
    const out = await ingestReport(env, {
      reportMd: readFileSync(reportPath),
      repoUrl: job.repoUrl,
      owner: job.owner,
      repo: job.repo,
      commit: job.commitSha,
      model: job.model,
      corpusVersion: env.corpusVersion,
      visibility: job.visibility,
      submitterVerified: job.submitterVerified,
      jobId: job.id,
      tier: job.tier,
      startedAt,
      finishedAt,
      usage,
      runJson,
      artifactsDir: join(outDir, "artifacts"),
      attest: true,
    });
    await prisma.job.update({ where: { id: job.id }, data: { status: "done", finishedAt, error: null } });
    await jobEvent(job.id, "done", { storagePath: out.storagePath, counts: out.parsed.counts, highest: out.parsed.highestSeverity, attested: out.attested, cost_usd: usage.cost_usd, sdk_cost_usd: usage.sdk_cost_usd });
  } catch (err) {
    keepOut = true;
    const message = (err as Error).message ?? String(err);
    await prisma.job.update({ where: { id: job.id }, data: { status: "failed", finishedAt: new Date(), error: message.slice(0, 1000) } });
    await jobEvent(job.id, `job failed: ${message}`, undefined, "error");
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
    if (!keepOut) rmSync(jobDir, { recursive: true, force: true });
  }
}
