#!/usr/bin/env tsx
/**
 * Offline quote: clone (or point at a local dir), run tokei, detect scope, print the
 * estimate for every enabled model. No database, no LLM. Useful for sanity-checking the
 * pricing formula and for calibration after real runs.
 *
 *   pnpm exec tsx scripts/quote-local.ts https://github.com/owner/repo [--ref main] [--json]
 *   pnpm exec tsx scripts/quote-local.ts ./some/local/dir
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { detectMarkers, enabledModels, estimate, findRepoRoot, loadModels, runTokei, budgetFor } from "@auditor/pricing";
import { parseGitHubUrl } from "@auditor/report";
import { resolveRef, shallowClone } from "../apps/worker/src/git.js";

loadDotenv({ path: resolve(findRepoRoot(process.cwd()), ".env") });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const target = process.argv[2];
  if (!target || target.startsWith("--")) throw new Error("usage: quote-local.ts <github url | local dir> [--ref r] [--json]");
  let dir = target;
  let tmp: string | null = null;
  let sha: string | null = null;
  const gh = parseGitHubUrl(target);
  if (gh) {
    const r = await resolveRef(gh.url, arg("ref") ?? gh.ref);
    sha = r.sha;
    tmp = mkdtempSync(join(tmpdir(), "quote-"));
    dir = join(tmp, "repo");
    await shallowClone(gh.url, sha, dir);
  } else if (!existsSync(target)) {
    throw new Error(`not a GitHub url or local dir: ${target}`);
  }
  try {
    const tokei = await runTokei(dir);
    const markers = detectMarkers(dir);
    const cfg = loadModels();
    const rows = enabledModels(cfg).map((m) => {
      const e = estimate({ loc: tokei.loc, languages: tokei.languages, markers, model: m.id, models: cfg });
      return { model: m.id, inputTokens: e.tokens.inputTotal, outputTokens: e.tokens.output, rawCostUsd: +e.rawCostUsd.toFixed(4), estCostUsd: +e.estCostUsd.toFixed(4), budgetUsd: budgetFor(e), priceUsdc: e.priceUsdc, byokFeeUsdc: e.attestFeeUsdc, scope: e.scope };
    });
    const out = { repo: gh?.url ?? resolve(dir), commit: sha, loc: tokei.loc, totalLoc: tokei.totalLoc, files: tokei.files, languages: tokei.languages, excluded: tokei.excluded, markers, scope: rows[0]?.scope, tokens: rows.length ? { ...estimate({ loc: tokei.loc, languages: tokei.languages, markers, model: rows[0]!.model, models: cfg }).tokens } : null, models: rows.map(({ scope: _s, ...r }) => r) };
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(out, null, 2));
      return;
    }
    console.log(`${out.repo}${sha ? ` @ ${sha}` : ""}`);
    console.log(`code LOC ${tokei.loc} (all lines ${tokei.totalLoc}, ${tokei.files} files)`);
    console.log("languages:", Object.entries(tokei.languages).map(([k, v]) => `${k}=${v.code}`).join(" "));
    if (tokei.excluded.length) console.log("excluded:", tokei.excluded.map((e) => `${e.language}(${e.code}, ${e.reason})`).join("; "));
    console.log("markers:", JSON.stringify(markers));
    console.log(`scope: checklists ${out.scope?.checklists.join(",")} (${out.scope?.itemCount} items) · vectors ${out.scope?.vectorGroups.join(",")} (${out.scope?.vectorCount})`);
    console.log("tokens:", JSON.stringify(out.tokens));
    console.table(out.models);
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
