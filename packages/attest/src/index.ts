/**
 * Client for the `audit_attest` Anchor program (programs/audit_attest).
 *
 * Phase 1 ships the data model and the PDA/serialisation helpers so the worker and the
 * ingest script compile and can produce the exact bytes that will go on-chain.
 * Phase 2 adds the transaction path once the program is deployed to mainnet.
 */
export * from "./types.js";
export * from "./encode.js";
