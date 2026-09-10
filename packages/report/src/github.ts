/** Parse a public GitHub URL into owner/repo (+ optional ref). Rejects anything else. */
export interface GitHubRef {
  owner: string;
  repo: string;
  ref: string | null;
  url: string; // canonical https clone url without .git
}

const NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

export function parseGitHubUrl(input: string): GitHubRef | null {
  let s = input.trim();
  if (!s) return null;
  if (/^git@github\.com:/.test(s)) s = "https://github.com/" + s.slice("git@github.com:".length);
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (!/^(www\.)?github\.com$/i.test(u.hostname)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0]!;
  let repo = parts[1]!;
  if (repo.endsWith(".git")) repo = repo.slice(0, -4);
  if (!NAME_RE.test(owner) || !NAME_RE.test(repo) || repo === "." || repo === "..") return null;
  let ref: string | null = null;
  if (parts.length >= 4 && (parts[2] === "tree" || parts[2] === "commit" || parts[2] === "blob")) {
    ref = decodeURIComponent(parts.slice(3).join("/"));
    if (!/^[A-Za-z0-9._\/-]{1,200}$/.test(ref) || ref.startsWith("-")) return null;
  }
  return { owner, repo, ref, url: `https://github.com/${owner}/${repo}` };
}

export function isFullSha(s: string | null | undefined): s is string {
  return !!s && /^[0-9a-f]{40}$/.test(s);
}
