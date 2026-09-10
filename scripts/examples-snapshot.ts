#!/usr/bin/env tsx
/**
 * Pin every hand-run report to the commit it was produced from BEFORE the clones are
 * updated. Writes "examples i runned local/<Org>/<repo>/audit_N/.attest.json" next to each
 * REPORT.md that has none:
 *   { commit, corpus, model, scope, finished_at }
 * The ingest reads that sidecar instead of the clone's HEAD from then on. Safe: it only
 * runs `git rev-parse HEAD` and writes small JSON files inside the gitignored folder.
 *
 *   pnpm examples:snapshot [--model claude-opus-4-5] [--scope program]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { findRepoRoot } from "@auditor/pricing";

loadDotenv({ path: resolve(findRepoRoot(process.cwd()), ".env"), quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export interface Sidecar {
  commit: string;
  corpus: string;
  model: string;
  scope: "full" | "program";
  finished_at: string;
}

export function corpusOfClone(dir: string): string {
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

function main() {
  const root = resolve(arg("dir") ?? "examples i runned local");
  const model = arg("model") ?? process.env.EXAMPLES_MODEL ?? "";
  const scope = (arg("scope") ?? "program") as Sidecar["scope"];
  if (!model) throw new Error("--model or EXAMPLES_MODEL required");
  let written = 0, kept = 0;
  for (const org of readdirSync(root)) {
    const orgDir = join(root, org);
    if (!statSync(orgDir).isDirectory()) continue;
    for (const name of readdirSync(orgDir)) {
      const dir = join(orgDir, name);
      if (!statSync(dir).isDirectory() || !existsSync(join(dir, ".git"))) continue;
      for (const entry of readdirSync(dir)) {
        if (!/^audit_\d+$/.test(entry)) continue;
        const report = join(dir, entry, "REPORT.md");
        const sidecar = join(dir, entry, ".attest.json");
        if (!existsSync(report)) continue;
        if (existsSync(sidecar)) {
          kept++;
          continue;
        }
        const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, stdio: "pipe" }).toString().trim();
        const data: Sidecar = { commit, corpus: corpusOfClone(dir), model, scope, finished_at: statSync(report).mtime.toISOString() };
        writeFileSync(sidecar, JSON.stringify(data, null, 2) + "\n");
        console.log(`${org}/${name}/${entry}: ${commit.slice(0, 7)} ${data.corpus} ${model}`);
        written++;
      }
    }
  }
  console.log(`sidecars written: ${written}, already present: ${kept}`);
}

main();
