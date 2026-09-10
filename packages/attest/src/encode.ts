import { createHash } from "node:crypto";
import type { AttestationInput } from "./types.js";

export const PDA_SEED = "attest";

/** sha256 of the canonical, lowercased repo url without trailing slash or .git. */
export function repoHash(repoUrl: string): Uint8Array {
  const canon = canonicalRepoUrl(repoUrl);
  return new Uint8Array(createHash("sha256").update(canon).digest());
}

export function canonicalRepoUrl(repoUrl: string): string {
  let s = repoUrl.trim().toLowerCase();
  s = s.replace(/\/+$/, "");
  if (s.endsWith(".git")) s = s.slice(0, -4);
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(s)) {
    throw new Error(`repo url must be https://github.com/<owner>/<repo>: ${repoUrl}`);
  }
  return s;
}

export function commitBytes(sha: string): Uint8Array {
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error(`commit must be a 40-hex sha: ${sha}`);
  return new Uint8Array(Buffer.from(sha.toLowerCase(), "hex"));
}

export function hexBytes32(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error(`expected 64 hex chars: ${hex}`);
  return new Uint8Array(Buffer.from(hex.toLowerCase(), "hex"));
}

export function fixedString(s: string, len: number): Uint8Array {
  const b = Buffer.from(s, "utf8");
  if (b.length > len) throw new Error(`"${s}" exceeds ${len} bytes`);
  const out = new Uint8Array(len);
  out.set(b);
  return out;
}

export function u8(n: number, label: string): number {
  if (!Number.isInteger(n) || n < 0 || n > 255) throw new Error(`${label} must fit in u8: ${n}`);
  return n;
}

/**
 * Instruction data for `attest` (after the Anchor discriminator):
 *   commit_sha[20] corpus_version[32] model_id[32] report_sha256[32] counts[5] visibility u8
 * The repo_hash is a PDA seed and the attester is a signer, so neither is in the args.
 */
export function encodeAttestArgs(input: AttestationInput): Uint8Array {
  const parts = [
    commitBytes(input.commitSha),
    fixedString(input.corpusVersion, 32),
    fixedString(input.modelId, 32),
    hexBytes32(input.reportSha256),
    new Uint8Array([
      u8(input.counts.critical, "critical"),
      u8(input.counts.high, "high"),
      u8(input.counts.medium, "medium"),
      u8(input.counts.low, "low"),
      u8(input.counts.info, "info"),
    ]),
    new Uint8Array([u8(input.visibility, "visibility")]),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Anchor global instruction discriminator: sha256("global:<name>")[0..8]. */
export function anchorDiscriminator(name: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(`global:${name}`).digest().subarray(0, 8));
}

/** Anchor account discriminator: sha256("account:<Name>")[0..8]. */
export function anchorAccountDiscriminator(name: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(`account:${name}`).digest().subarray(0, 8));
}
