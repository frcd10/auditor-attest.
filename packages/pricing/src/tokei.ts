import { execFile } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import type { LanguageMix, RepoMarkers } from "./scope.js";

const execFileP = promisify(execFile);

/** Languages tokei reports that are not code the auditor reads for verdicts. */
const NON_CODE_LANGUAGES = new Set(["Markdown", "Plain Text", "Text", "SVG", "ReStructuredText", "Org", "AsciiDoc", "Autoconf", "Gettext"]);
const LOCKFILE_RE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|poetry\.lock|Pipfile\.lock|composer\.lock|Gemfile\.lock|go\.sum|bun\.lockb?)$/;
const EXCLUDED_DIR_RE = /(^|\/)(node_modules|target|dist|build|out|\.next|vendor|generated|__pycache__|\.git)(\/|$)/;

export interface TokeiStats {
  /** Code lines counted for pricing (after exclusions). */
  loc: number;
  /** All lines (code + comments + blanks) after exclusions. */
  totalLoc: number;
  files: number;
  languages: LanguageMix;
  /** Languages/files that were excluded and why. */
  excluded: { language: string; code: number; files: number; reason: string }[];
}

interface TokeiReport {
  name: string;
  stats: { blanks: number; code: number; comments: number };
}
interface TokeiLanguage {
  blanks: number;
  code: number;
  comments: number;
  reports: TokeiReport[];
  children?: Record<string, TokeiReport[]>;
}

export async function runTokei(dir: string, tokeiBin = process.env.TOKEI_BIN ?? "tokei"): Promise<TokeiStats> {
  const { stdout } = await execFileP(tokeiBin, ["--output", "json", "--hidden", "."], {
    cwd: dir,
    maxBuffer: 64 * 1024 * 1024,
  });
  return summarizeTokei(JSON.parse(stdout) as Record<string, TokeiLanguage>);
}

export function summarizeTokei(raw: Record<string, TokeiLanguage>): TokeiStats {
  const languages: LanguageMix = {};
  const excluded: TokeiStats["excluded"] = [];
  let loc = 0;
  let totalLoc = 0;
  let files = 0;
  for (const [lang, entry] of Object.entries(raw)) {
    if (lang === "Total") continue;
    if (NON_CODE_LANGUAGES.has(lang)) {
      excluded.push({ language: lang, code: entry.code, files: entry.reports.length, reason: "documentation, not code" });
      continue;
    }
    let code = 0, comments = 0, blanks = 0, n = 0, exCode = 0, exFiles = 0;
    for (const r of entry.reports) {
      const name = r.name.replace(/^\.\//, "");
      if (LOCKFILE_RE.test(name) || EXCLUDED_DIR_RE.test(name)) {
        exCode += r.stats.code;
        exFiles += 1;
        continue;
      }
      code += r.stats.code;
      comments += r.stats.comments;
      blanks += r.stats.blanks;
      n += 1;
    }
    if (exFiles) excluded.push({ language: lang, code: exCode, files: exFiles, reason: "lockfile / vendored / build output" });
    if (n === 0) continue;
    languages[lang] = { code, comments, blanks, files: n };
    loc += code;
    totalLoc += code + comments + blanks;
    files += n;
  }
  return { loc, totalLoc, files, languages, excluded };
}

/** Cheap filesystem markers the corpus greps for. Never executes anything from the repo. */
export function detectMarkers(dir: string): RepoMarkers {
  const exists = (p: string) => existsSync(join(dir, p));
  const readJson = (p: string): Record<string, unknown> | null => {
    try {
      return JSON.parse(readFileSync(join(dir, p), "utf8")) as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  const pkg = readJson("package.json");
  const deps = { ...((pkg?.dependencies as Record<string, string>) ?? {}), ...((pkg?.devDependencies as Record<string, string>) ?? {}) };
  const depHas = (re: RegExp) => Object.keys(deps).some((d) => re.test(d));

  // Walk a bounded depth looking for .rs files outside programs/, .tsx, .py, .mcp.json
  let rustOffchain = false, tsx = false, py = false, mcp = false, backendDir = false;
  const others = new Set<string>();
  const walk = (rel: string, depth: number) => {
    if (depth > 4) return;
    let entries: string[];
    try {
      entries = readdirSync(join(dir, rel));
    } catch {
      return;
    }
    for (const e of entries) {
      const relPath = rel ? `${rel}/${e}` : e;
      if (EXCLUDED_DIR_RE.test(relPath + "/")) continue;
      let st;
      try {
        st = statSync(join(dir, relPath));
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (/^(apps\/)?(backend|server|api|services?)$/.test(relPath)) backendDir = true;
        walk(relPath, depth + 1);
      } else {
        if (e.endsWith(".rs") && !/^programs\//.test(relPath)) rustOffchain = true;
        if (e.endsWith(".tsx") || e.endsWith(".jsx")) tsx = true;
        if (e.endsWith(".py")) py = true;
        if (e === ".mcp.json") mcp = true;
        if (e.endsWith(".go")) others.add("Go");
        if (e.endsWith(".java") || e.endsWith(".kt")) others.add("Java");
        if (e.endsWith(".rb")) others.add("Ruby");
        if (e.endsWith(".php")) others.add("PHP");
      }
    }
  };
  walk("", 0);

  return {
    anchorToml: exists("Anchor.toml"),
    cargoToml: exists("Cargo.toml"),
    rustOffchain,
    packageJson: pkg !== null,
    web: tsx || depHas(/^(next|react|vue|svelte|@sveltejs\/kit|nuxt|vite|@remix-run\/)/),
    backend: backendDir || depHas(/^(express|fastify|@nestjs\/core|hono|koa|@prisma\/client|pg|mongoose|@trpc\/server)$/),
    python: py,
    otherLanguages: [...others],
    aiAgent: mcp || depHas(/^(@anthropic-ai\/|openai$|langchain|@langchain\/|ai$|@modelcontextprotocol\/)/),
  };
}

export function relPath(root: string, p: string): string {
  return relative(root, p);
}
