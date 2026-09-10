import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface PromptVars {
  CORPUS_VERSION: string;
  OWNER: string;
  REPO: string;
  COMMIT: string;
  SCOPE: string;
  CLASSIFICATION: string;
}

const promptsDir = resolve(import.meta.dirname, "..", "prompts");

export function fill(template: string, vars: PromptVars): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, k: string) => {
    const v = (vars as unknown as Record<string, string>)[k];
    if (v === undefined) throw new Error(`prompt var ${k} not provided`);
    return v;
  });
}

export function loadSystemAppend(vars: PromptVars): string {
  return fill(readFileSync(resolve(promptsDir, "system-append.md"), "utf8"), vars);
}

export function loadTurns(vars: PromptVars): { name: string; prompt: string }[] {
  const raw = JSON.parse(readFileSync(resolve(promptsDir, "turns.json"), "utf8")) as { turns: { name: string; prompt: string }[] };
  return raw.turns.map((t) => ({ name: t.name, prompt: fill(t.prompt, vars) }));
}

/** Tools the auditor must never have inside the sandbox (belt and braces on top of the image contents). */
export const DISALLOWED_TOOLS = [
  "WebFetch",
  "WebSearch",
  "NotebookEdit",
  "Bash(cargo *)",
  "Bash(cargo-*)",
  "Bash(rustc *)",
  "Bash(anchor *)",
  "Bash(solana *)",
  "Bash(npm *)",
  "Bash(npx *)",
  "Bash(pnpm *)",
  "Bash(yarn *)",
  "Bash(bun *)",
  "Bash(node *)",
  "Bash(deno *)",
  "Bash(python *)",
  "Bash(python3 *)",
  "Bash(pip *)",
  "Bash(pip3 *)",
  "Bash(make *)",
  "Bash(cmake *)",
  "Bash(gcc *)",
  "Bash(go *)",
  "Bash(curl *)",
  "Bash(wget *)",
  "Bash(ssh *)",
  "Bash(scp *)",
  "Bash(nc *)",
  "Bash(docker *)",
  "Bash(sudo *)",
  "Bash(chmod *)",
  "Bash(git push*)",
  "Bash(git clone*)",
  "Bash(git fetch*)",
  "Bash(git pull*)",
  "Bash(git submodule*)",
  "Edit(//target/**)",
  "Write(//target/**)",
  "Edit(//corpus/**)",
  "Write(//corpus/**)",
];
