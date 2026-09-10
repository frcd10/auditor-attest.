import { execFile } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { promisify } from "node:util";
import { isFullSha } from "@auditor/report";

const execFileP = promisify(execFile);
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "/bin/false", GIT_CONFIG_NOSYSTEM: "1", LC_ALL: "C" };
const GIT_TIMEOUT_MS = 10 * 60 * 1000;

async function git(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execFileP("git", args, { cwd, env: GIT_ENV, timeout: GIT_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

export interface ResolvedRef {
  sha: string;
  refName: string; // e.g. refs/heads/main, or "detached" when a raw sha was requested
}

/** Resolve a branch/tag/sha (or the default branch) to a full commit sha without cloning. */
export async function resolveRef(repoUrl: string, ref: string | null): Promise<ResolvedRef> {
  if (ref && isFullSha(ref)) return { sha: ref, refName: "detached" };
  if (!ref) {
    const out = await git(["ls-remote", "--symref", repoUrl, "HEAD"]);
    const sym = /^ref: (refs\/heads\/\S+)\tHEAD$/m.exec(out);
    const head = /^([0-9a-f]{40})\tHEAD$/m.exec(out);
    if (!head) throw new Error("could not resolve default branch HEAD (is the repo public?)");
    return { sha: head[1]!, refName: sym?.[1] ?? "HEAD" };
  }
  const out = await git(["ls-remote", repoUrl, `refs/heads/${ref}`, `refs/tags/${ref}`, ref]);
  const lines = out.trim().split("\n").filter(Boolean);
  const pick = lines.find((l) => l.endsWith(`refs/heads/${ref}`)) ?? lines.find((l) => l.endsWith(`refs/tags/${ref}^{}`)) ?? lines.find((l) => l.endsWith(`refs/tags/${ref}`)) ?? lines[0];
  if (!pick) {
    if (/^[0-9a-f]{7,39}$/.test(ref)) throw new Error("short commit shas are not supported; use the full 40-char sha");
    throw new Error(`ref not found: ${ref}`);
  }
  const [sha, name] = pick.split("\t");
  return { sha: sha!, refName: name ?? ref };
}

/**
 * Shallow clone of exactly one commit into `dir`. No submodules, no hooks, no
 * credential prompts. Refuses repositories above `maxBytes` after fetch.
 */
export async function shallowClone(repoUrl: string, sha: string, dir: string, opts: { maxBytes?: number } = {}): Promise<void> {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  await git(["init", "-q", "--initial-branch=main"], dir);
  await git(["config", "core.hooksPath", "/dev/null"], dir);
  await git(["config", "submodule.recurse", "false"], dir);
  await git(["remote", "add", "origin", repoUrl], dir);
  await git(["fetch", "-q", "--depth", "1", "--no-tags", "--no-recurse-submodules", "origin", sha], dir);
  await git(["checkout", "-q", "--detach", "FETCH_HEAD"], dir);
  const head = (await git(["rev-parse", "HEAD"], dir)).trim();
  if (head !== sha) throw new Error(`checked out ${head} but expected ${sha}`);
  const maxBytes = opts.maxBytes ?? 1024 * 1024 * 1024;
  const size = await dirSize(dir);
  if (size > maxBytes) throw new Error(`repository too large: ${(size / 1024 / 1024).toFixed(0)} MB > ${(maxBytes / 1024 / 1024).toFixed(0)} MB`);
}

async function dirSize(dir: string): Promise<number> {
  const { stdout } = await execFileP("du", ["-sb", dir], { timeout: 60_000 });
  return Number(stdout.split("\t")[0]);
}

/** Make the checkout world-readable and read-only so the container's unprivileged user can read it. */
export async function makeReadOnly(dir: string): Promise<void> {
  await execFileP("chmod", ["-R", "a+rX,go-w", dir], { timeout: 120_000 });
}
