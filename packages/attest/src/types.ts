/** Mainnet-only constants. There is deliberately no cluster switch anywhere in product code. */
export const CLUSTER = "mainnet-beta" as const;
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_DECIMALS = 6;

export type OnChainVisibility = 0 | 1 | 2; // 0 = private, 1 = public, 2 = public_redacted

export interface AttestationInput {
  /** Canonical repo url, e.g. https://github.com/owner/repo (lowercased before hashing). */
  repoUrl: string;
  /** 40-char hex commit sha. */
  commitSha: string;
  /** e.g. "7.3.0@6bb2cbf" (max 32 bytes). */
  corpusVersion: string;
  /** e.g. "claude-opus-5" (max 32 bytes). */
  modelId: string;
  /** 32-byte sha256 of report.md, hex. */
  reportSha256: string;
  counts: { critical: number; high: number; medium: number; low: number; info: number };
  visibility: OnChainVisibility;
}

/**
 * On-chain account layout (Borsh, after the 8-byte Anchor discriminator).
 * Total = 8 + 32 + 20 + 32 + 32 + 32 + 5 + 1 + 8 + 32 + 1 = 203 bytes.
 */
export interface AttestationAccount {
  repoHash: Uint8Array; // 32: sha256(lowercase canonical repo url)
  commitSha: Uint8Array; // 20: raw bytes of the 40-hex sha
  corpusVersion: string; // fixed 32 bytes, zero-padded
  modelId: string; // fixed 32 bytes, zero-padded
  reportSha256: Uint8Array; // 32
  counts: [number, number, number, number, number]; // u8 each: critical, high, medium, low, info
  visibility: OnChainVisibility; // u8
  timestamp: bigint; // i64 unix seconds (clock sysvar at attest time)
  attester: string; // pubkey base58
  bump: number;
}

export interface AttestationResult {
  pda: string;
  txSig: string;
  slot: number | null;
  programId: string;
}
