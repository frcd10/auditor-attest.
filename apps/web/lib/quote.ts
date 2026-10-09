/**
 * Instant quote from the GitHub API: no clone, no tokei, no worker. Resolves the commit,
 * lists the tree and sizes the code per language from blob sizes. Runs inside the submit
 * action, so the estimate is on the page before the user chooses anything.
 *
 * Accuracy: lines are estimated from bytes (Rust ≈ 42 bytes per tokei code line across the
 * 11 example clones, range 32–56). The cost profile is almost flat in LOC (see
 * packages/pricing estimate.ts), so a ±25% LOC error moves the estimate by ~3%.
 */
import { detectScope, type LanguageMix, type RepoMarkers } from "@auditor/pricing";
import { githubToken } from "./env";

const API = "https://api.github.com";

/** Extension → tokei language name, and bytes per code line observed for that language. */
const LANGS: Record<string, [lang: string, bytesPerLine: number]> = {
  rs: ["Rust", 42],
  ts: ["TypeScript", 40],
  tsx: ["TSX", 40],
  js: ["JavaScript", 40],
  jsx: ["JSX", 40],
  mjs: ["JavaScript", 40],
  cjs: ["JavaScript", 40],
  py: ["Python", 38],
  go: ["Go", 36],
  sol: ["Solidity", 40],
  move: ["Move", 40],
  c: ["C", 36],
  h: ["C Header", 36],
  cpp: ["C++", 36],
  cc: ["C++", 36],
  hpp: ["C++ Header", 36],
  java: ["Java", 40],
  kt: ["Kotlin", 40],
  rb: ["Ruby", 34],
  php: ["PHP", 40],
  cs: ["C#", 40],
  swift: ["Swift", 38],
  ex: ["Elixir", 36],
  exs: ["Elixir", 36],
  sh: ["Shell", 36],
  bash: ["Shell", 36],
  toml: ["TOML", 32],
  yaml: ["YAML", 32],
  yml: ["YAML", 32],
  json: ["JSON", 40],
  sql: ["SQL", 40],
  proto: ["Protocol Buffers", 36],
  dockerfile: ["Dockerfile", 36],
  css: ["CSS", 34],
  scss: ["Sass", 34],
  html: ["HTML", 44],
};
const LOCKFILE_RE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|poetry\.lock|Pipfile\.lock|composer\.lock|Gemfile\.lock|go\.sum|bun\.lockb?)$/;
const EXCLUDED_DIR_RE = /(^|\/)(node_modules|target|dist|build|out|\.next|vendor|generated|__pycache__|\.git)(\/|$)/;
/** Blobs above this are generated data (IDLs, fixtures), not code the auditor reads. */
const MAX_CODE_BLOB_BYTES = 2 * 1024 * 1024;

export interface GitHubQuote {
  sha: string;
  refName: string;
  defaultBranch: string;
  loc: number;
  totalLoc: number;
  files: number;
  languages: LanguageMix;
  markers: RepoMarkers;
  excluded: { language: string; code: number; files: number; reason: string }[];
  truncated: boolean;
  description: string | null;
  archived: boolean;
}

async function gh<T>(path: string): Promise<T> {
  const headers: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "auditor-attest", "x-github-api-version": "2022-11-28" };
  const token = githubToken();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { headers, cache: "no-store" });
  if (res.status === 404) throw new Error("repository not found on GitHub (is it public?)");
  if (res.status === 403 || res.status === 429) throw new Error("GitHub API rate limit reached; try again in a few minutes");
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  return (await res.json()) as T;
}

interface RepoInfo {
  default_branch: string;
  description: string | null;
  archived: boolean;
  private: boolean;
  size: number;
}
interface CommitInfo {
  sha: string;
}
interface TreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  size?: number;
}
interface TreeInfo {
  sha: string;
  tree: TreeEntry[];
  truncated: boolean;
}

export async function quoteFromGitHub(owner: string, repo: string, ref: string | null): Promise<GitHubQuote> {
  const info = await gh<RepoInfo>(`/repos/${owner}/${repo}`);
  if (info.private) throw new Error("private repositories are not supported");
  const wanted = ref ?? info.default_branch;
  const commit = await gh<CommitInfo>(`/repos/${owner}/${repo}/commits/${encodeURIComponent(wanted)}`);
  const sha = commit.sha;
  const tree = await gh<TreeInfo>(`/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`);

  const languages: LanguageMix = {};
  const ex: Record<string, { code: number; files: number; reason: string }> = {};
  let loc = 0, files = 0;
  const paths = new Set<string>();
  let rustOffchain = false, tsx = false, py = false, mcp = false, backendDir = false;
  const others = new Set<string>();

  for (const e of tree.tree) {
    if (e.type === "tree") {
      if (/^(apps\/)?(backend|server|api|services?)$/.test(e.path)) backendDir = true;
      continue;
    }
    if (e.type !== "blob") continue;
    paths.add(e.path);
    const name = e.path.split("/").pop() ?? e.path;
    const extRaw = name.includes(".") ? name.split(".").pop()!.toLowerCase() : name.toLowerCase();
    const ext = name.toLowerCase() === "dockerfile" ? "dockerfile" : extRaw;
    const m = LANGS[ext];
    if (!m) continue;
    const [lang, bpl] = m;
    const size = e.size ?? 0;
    const lines = Math.max(1, Math.round(size / bpl));
    if (LOCKFILE_RE.test(e.path) || EXCLUDED_DIR_RE.test(e.path) || size > MAX_CODE_BLOB_BYTES) {
      const r = (ex[lang] ??= { code: 0, files: 0, reason: size > MAX_CODE_BLOB_BYTES ? "generated / data file" : "lockfile / vendored / build output" });
      r.code += lines;
      r.files += 1;
      continue;
    }
    const l = (languages[lang] ??= { code: 0, comments: 0, blanks: 0, files: 0 });
    l.code += lines;
    l.files += 1;
    loc += lines;
    files += 1;
    if (ext === "rs" && !/^programs\//.test(e.path)) rustOffchain = true;
    if (ext === "tsx" || ext === "jsx") tsx = true;
    if (ext === "py") py = true;
    if (name === ".mcp.json") mcp = true;
    if (ext === "go") others.add("Go");
    if (ext === "java" || ext === "kt") others.add("Java");
    if (ext === "rb") others.add("Ruby");
    if (ext === "php") others.add("PHP");
  }

  // Markers from paths only (we never read file contents here; package.json deps are
  // approximated by the presence of web/backend directories and .tsx files).
  const has = (p: string) => paths.has(p);
  const markers: RepoMarkers = {
    anchorToml: has("Anchor.toml"),
    cargoToml: has("Cargo.toml"),
    rustOffchain,
    packageJson: has("package.json"),
    web: tsx || [...paths].some((p) => /^(apps\/)?(web|app|frontend|site)\/package\.json$/.test(p) || /(^|\/)next\.config\.(js|ts|mjs)$/.test(p)),
    backend: backendDir,
    python: py,
    otherLanguages: [...others],
    aiAgent: mcp,
  };
  // Keep the scope detector's view consistent with what tokei would report.
  void detectScope(languages, markers);

  return {
    sha,
    refName: ref ?? `refs/heads/${info.default_branch}`,
    defaultBranch: info.default_branch,
    loc,
    totalLoc: Math.round(loc * 1.35),
    files,
    languages,
    markers,
    excluded: Object.entries(ex).map(([language, v]) => ({ language, ...v })),
    truncated: tree.truncated,
    description: info.description,
    archived: info.archived,
  };
}
