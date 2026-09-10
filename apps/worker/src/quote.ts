import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { prisma, type Job, type Prisma } from "@auditor/db";
import { detectMarkers, enabledModels, envNumber, estimate, loadModels, runTokei } from "@auditor/pricing";
import type { WorkerEnv } from "./env.js";
import { resolveRef, shallowClone } from "./git.js";
import { jobEvent } from "./log.js";

/** Handle a job in `quoting`: resolve the commit, shallow clone, tokei, estimate, persist the quote. */
export async function runQuote(env: WorkerEnv, job: Job): Promise<void> {
  const jobDir = join(env.jobsDir, job.id, "quote");
  mkdirSync(jobDir, { recursive: true });
  try {
    await jobEvent(job.id, "resolving commit", { ref: job.ref });
    const { sha, refName } = await resolveRef(job.repoUrl, job.ref);
    await jobEvent(job.id, "cloning for quote", { sha, refName });
    const repoDir = join(jobDir, "repo");
    await shallowClone(job.repoUrl, sha, repoDir, { maxBytes: 2 * 1024 * 1024 * 1024 });

    const tokei = await runTokei(repoDir);
    const markers = detectMarkers(repoDir);
    const cfg = loadModels();
    const models = enabledModels(cfg);
    const perModel = Object.fromEntries(
      models.map((m) => {
        const e = estimate({ loc: tokei.loc, languages: tokei.languages, markers, model: m.id, models: cfg });
        return [m.id, { estCostUsd: e.estCostUsd, rawCostUsd: e.rawCostUsd, priceUsdc: e.priceUsdc, attestFeeUsdc: e.attestFeeUsdc, tokens: e.tokens }];
      }),
    );
    const chosen = models.some((m) => m.id === job.model) ? job.model : cfg.default;
    const est = estimate({ loc: tokei.loc, languages: tokei.languages, markers, model: chosen, models: cfg });
    const ttlMin = envNumber("QUOTE_TTL_MINUTES", 60);

    await prisma.$transaction([
      prisma.quote.upsert({
        where: { jobId: job.id },
        create: {
          jobId: job.id,
          model: chosen,
          loc: tokei.loc,
          totalLoc: tokei.totalLoc,
          files: tokei.files,
          languages: tokei.languages as unknown as Prisma.InputJsonValue,
          markers: markers as object,
          scope: est.scope as object,
          estInputTokens: est.tokens.inputTotal,
          estOutputTokens: est.tokens.output,
          estCostUsd: est.estCostUsd,
          margin: est.margin,
          calibration: est.calibration,
          priceUsdc: est.priceUsdc,
          attestFeeUsdc: est.attestFeeUsdc,
          breakdown: { chosen: est.tokens, perModel, excluded: tokei.excluded, reasons: est.scope.reasons } as object,
          expiresAt: new Date(Date.now() + ttlMin * 60_000),
        },
        update: {
          model: chosen,
          loc: tokei.loc,
          totalLoc: tokei.totalLoc,
          files: tokei.files,
          languages: tokei.languages as unknown as Prisma.InputJsonValue,
          markers: markers as object,
          scope: est.scope as object,
          estInputTokens: est.tokens.inputTotal,
          estOutputTokens: est.tokens.output,
          estCostUsd: est.estCostUsd,
          margin: est.margin,
          calibration: est.calibration,
          priceUsdc: est.priceUsdc,
          attestFeeUsdc: est.attestFeeUsdc,
          breakdown: { chosen: est.tokens, perModel, excluded: tokei.excluded, reasons: est.scope.reasons } as object,
          expiresAt: new Date(Date.now() + ttlMin * 60_000),
        },
      }),
      prisma.job.update({ where: { id: job.id }, data: { status: "quoted", commitSha: sha, model: chosen, error: null } }),
    ]);
    await jobEvent(job.id, "quote ready", { loc: tokei.loc, files: tokei.files, model: chosen, estCostUsd: est.estCostUsd, priceUsdc: est.priceUsdc });
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    await prisma.job.update({ where: { id: job.id }, data: { status: "failed", error: `quote: ${message}`.slice(0, 1000) } });
    await jobEvent(job.id, `quote failed: ${message}`, undefined, "error");
  } finally {
    rmSync(jobDir, { recursive: true, force: true });
  }
}
