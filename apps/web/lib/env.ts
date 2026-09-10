import { resolve } from "node:path";
import { findRepoRoot } from "@auditor/pricing";

export function repoRoot(): string {
  return findRepoRoot(process.cwd());
}

export function reportsDir(): string {
  const v = process.env.REPORTS_DIR;
  return resolve(repoRoot(), v && v.length ? v : "reports");
}

export function corpusVersion(): string {
  return process.env.CORPUS_VERSION ?? "7.3.0@6bb2cbf";
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function adminToken(): string | null {
  const t = process.env.ADMIN_TOKEN;
  return t && t.length >= 16 ? t : null;
}

export function byokKek(): Buffer | null {
  const k = process.env.BYOK_KEK;
  return k && /^[0-9a-f]{64}$/i.test(k) ? Buffer.from(k, "hex") : null;
}

export function treasuryPubkey(): string | null {
  const t = process.env.NEXT_PUBLIC_TREASURY_PUBKEY ?? process.env.TREASURY_PUBKEY;
  return t && t.length ? t : null;
}

export function browserRpcUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_RPC_URL;
  return u && u.length ? u : null;
}

export function usdcMint(): string {
  return process.env.NEXT_PUBLIC_USDC_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
}
