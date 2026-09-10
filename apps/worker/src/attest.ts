/**
 * On-chain attestation. Phase 2 wires this to programs/audit_attest via @auditor/attest.
 * Until the program is deployed to mainnet this throws, and ingest logs a skip instead.
 */
import type { AttestationInput } from "@auditor/attest";
import type { WorkerEnv } from "./env.js";

export interface AttestResult {
  pda: string;
  txSig: string;
  attester: string;
  slot: number | null;
  programId: string;
}

export async function attestOnChain(_env: WorkerEnv, _input: AttestationInput): Promise<AttestResult> {
  throw new Error("attestation client not wired yet (Phase 2: deploy programs/audit_attest, then implement @auditor/attest send path)");
}
