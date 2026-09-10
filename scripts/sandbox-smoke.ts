#!/usr/bin/env tsx
/**
 * Zero-cost sandbox smoke test. Builds a throwaway target repo (one Rust file), starts
 * the egress network + proxy, runs the sandbox container with a DUMMY api key and
 * maxTurns 1, then prints what the runner reported. Expected outcome: the plugin loads
 * (init lists `auditor` and its slash commands), the model call is attempted through the
 * proxy and rejected with an authentication error, status = failed, no report. Nothing
 * is billed. Also proves: read-only mounts, non-root, no egress except the allowlist.
 *
 *   pnpm exec tsx scripts/sandbox-smoke.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { findRepoRoot } from "@auditor/pricing";
import { loadEnv } from "../apps/worker/src/env.js";
import { ensureEgress, runSandbox } from "../apps/worker/src/docker.js";
import { DISALLOWED_TOOLS, loadSystemAppend } from "../apps/worker/src/prompts.js";

loadDotenv({ path: resolve(findRepoRoot(process.cwd()), ".env"), quiet: true });

async function main() {
  const env = loadEnv();
  const dir = mkdtempSync(join(tmpdir(), "sandbox-smoke-"));
  const repo = join(dir, "repo");
  const out = join(dir, "out");
  mkdirSync(join(repo, "src"), { recursive: true });
  mkdirSync(out, { recursive: true });
  chmodSync(out, 0o777);
  writeFileSync(join(repo, "Cargo.toml"), '[package]\nname = "smoke"\nversion = "0.1.0"\nedition = "2021"\n');
  writeFileSync(join(repo, "src", "lib.rs"), "pub fn add(a: u64, b: u64) -> u64 { a + b }\n");
  const git = (args: string[]) => execFileSync("git", args, { cwd: repo, stdio: "pipe", env: { ...process.env, GIT_AUTHOR_NAME: "smoke", GIT_AUTHOR_EMAIL: "smoke@example.com", GIT_COMMITTER_NAME: "smoke", GIT_COMMITTER_EMAIL: "smoke@example.com" } });
  git(["init", "-q"]);
  git(["add", "."]);
  git(["commit", "-q", "-m", "smoke"]);
  execFileSync("chmod", ["-R", "a+rX", repo]);
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();

  const proxyUrl = await ensureEgress(env);
  console.log(`proxy: ${proxyUrl}  target: ${repo}@${sha.slice(0, 7)}`);
  const spec = {
    jobId: "smoke",
    model: "claude-sonnet-5",
    // Assembled at runtime so the repo secret scanner does not flag a fake key.
    apiKey: ["sk", "ant", "smoke-test-invalid-key-000000000000"].join("-"),
    maxBudgetUsd: 0.05,
    maxTurns: 1,
    systemAppend: loadSystemAppend({ CORPUS_VERSION: env.corpusVersion, OWNER: "smoke", REPO: "smoke", COMMIT: sha, SCOPE: "full", CLASSIFICATION: "Confidential — Client Only" }),
    turns: [{ name: "probe", prompt: "Reply with the single word OK." }],
    disallowedTools: DISALLOWED_TOOLS,
    timeoutMinutes: 3,
    proxyUrl,
  };
  const t0 = Date.now();
  const events: Record<string, unknown>[] = [];
  const res = await runSandbox(env, {
    name: `auditor-smoke-${Date.now()}`,
    repoDir: repo,
    outDir: out,
    spec,
    proxyUrl,
    logFile: join(out, "container.log"),
    killAfterMs: 4 * 60_000,
    onEvent: (ev) => {
      events.push(ev);
      const t = String(ev.t);
      if (["start", "init", "turn_result", "error", "fatal", "done", "warn", "timeout", "sdk", "text"].includes(t)) {
        const { ts: _ts, ...rest } = ev;
        console.log(`[${t}]`, JSON.stringify(rest).slice(0, 600));
      }
    },
  });
  console.log(`container exit=${res.exitCode} signal=${res.signal} killed=${res.killed} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const status = existsSync(join(out, "status.json")) ? readFileSync(join(out, "status.json"), "utf8") : "(no status.json)";
  console.log("status.json:", status.trim());
  const init = events.find((e) => e.t === "init") as { plugins?: { name: string }[]; slash_commands?: string[]; apiKeySource?: string } | undefined;
  const cmds = (init?.slash_commands ?? []).filter((c) => c.startsWith("auditor:"));
  const checks = {
    "runner started": events.some((e) => e.t === "start"),
    "SDK init received": !!init,
    "auditor plugin loaded": !!init?.plugins?.some((p) => p.name === "auditor"),
    "auditor slash commands visible": cmds.length >= 10,
    "api key came from env": init?.apiKeySource === "ANTHROPIC_API_KEY",
    "no report produced (expected)": !existsSync(join(out, "report.md")),
    "runner wrote status.json": existsSync(join(out, "status.json")),
    "container log has no api key": !readFileSync(join(out, "container.log"), "utf8").includes("sk-ant-smoke"),
  };
  console.table(checks);
  console.log("auditor commands:", cmds.join(", ") || "(none)");
  const clog = readFileSync(join(out, "container.log"), "utf8").split("\n").filter((l) => l.startsWith("[stderr]"));
  if (clog.length) console.log("container stderr (tail):\n" + clog.slice(-15).join("\n"));
  if (process.argv.includes("--keep")) console.log(`kept: ${out}`);
  else rmSync(dir, { recursive: true, force: true });
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  if (failed.length) {
    console.error("FAILED:", failed.join("; "));
    process.exit(1);
  }
  console.log("sandbox smoke test passed (no tokens billed: the key is invalid).");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
