/**
 * GitHub OAuth for maintainer verification. No session store: the state is an HMAC-signed
 * payload, the access token is used for two API calls and discarded. Only public repos are
 * audited, so the `public_repo` scope is enough to read the caller's permission level.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface OAuthState {
  kind: "job" | "report";
  id: string; // job id or report id
  owner: string;
  repo: string;
  nonce: string;
  iat: number;
}

function secret(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return Buffer.from(s);
}

export function githubConfigured(): boolean {
  return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32);
}

export function signState(payload: Omit<OAuthState, "nonce" | "iat">): string {
  const state: OAuthState = { ...payload, nonce: randomBytes(12).toString("hex"), iat: Date.now() };
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyState(token: string | null, maxAgeMs = 15 * 60 * 1000): OAuthState | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const state = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
  if (Date.now() - state.iat > maxAgeMs) return null;
  return state;
}

export function authorizeUrl(state: string, redirectUri: string): string {
  const u = new URL("https://github.com/login/oauth/authorize");
  u.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", "public_repo read:user");
  u.searchParams.set("state", state);
  u.searchParams.set("allow_signup", "false");
  return u.toString();
}

export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!json.access_token) throw new Error(json.error_description ?? json.error ?? "token exchange failed");
  return json.access_token;
}

const GH = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "auditor-attest" };

export async function fetchUser(token: string): Promise<{ id: number; login: string }> {
  const res = await fetch("https://api.github.com/user", { headers: { ...GH, authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GitHub /user ${res.status}`);
  const u = (await res.json()) as { id: number; login: string };
  return { id: u.id, login: u.login };
}

export interface RepoPermission {
  admin: boolean;
  maintain: boolean;
  push: boolean;
  level: "admin" | "maintain" | "write" | "none";
}

/** The caller's permission on owner/repo, from the `permissions` object GitHub adds for the token's user. */
export async function fetchRepoPermission(token: string, owner: string, repo: string): Promise<RepoPermission> {
  const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers: { ...GH, authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GitHub /repos ${res.status}`);
  const r = (await res.json()) as { permissions?: { admin?: boolean; maintain?: boolean; push?: boolean } };
  const p = r.permissions ?? {};
  const admin = !!p.admin;
  const maintain = !!p.maintain;
  const push = !!p.push;
  return { admin, maintain, push, level: admin ? "admin" : maintain ? "maintain" : push ? "write" : "none" };
}

/** Maintainer = admin or maintain permission on the repository. */
export function isMaintainer(p: RepoPermission): boolean {
  return p.admin || p.maintain;
}
