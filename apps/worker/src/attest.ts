/**
 * On-chain attestation via programs/audit_attest. Only hashes and counts are sent.
 * Requires AUDIT_ATTEST_PROGRAM_ID, ATTESTER_KEYPAIR_PATH and RPC_URL (mainnet-beta).
 */
import { attest, loadKeypair, type AttestationInput } from "@auditor/attest";
import { Connection, PublicKey } from "@solana/web3.js";
import type { WorkerEnv } from "./env.js";
import { log } from "./log.js";

export interface AttestResult {
  pda: string;
  txSig: string;
  attester: string;
  slot: number | null;
  programId: string;
}

export async function attestOnChain(env: WorkerEnv, input: AttestationInput): Promise<AttestResult> {
  if (!env.attestProgramId || !env.attesterKeypairPath || !env.rpcUrl) throw new Error("attestation not configured");
  const connection = new Connection(env.rpcUrl, { commitment: "confirmed" });
  const programId = new PublicKey(env.attestProgramId);
  const attester = loadKeypair(env.attesterKeypairPath);
  const res = await attest({ connection, programId, attester, input, commitment: "finalized" });
  log("info", `attested ${input.commitSha.slice(0, 7)} (${res.mode}) tx=${res.txSig} pda=${res.pda}`);
  return { pda: res.pda, txSig: res.txSig, attester: res.attester, slot: res.slot, programId: res.programId };
}
