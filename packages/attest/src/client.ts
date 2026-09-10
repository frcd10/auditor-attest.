/**
 * Transaction path for programs/audit_attest on mainnet-beta.
 * Uses @solana/web3.js directly (no Anchor client dependency, no IDL at runtime): the
 * instruction layout is fixed and mirrored in encode.ts.
 */
import { readFileSync } from "node:fs";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  type Commitment,
} from "@solana/web3.js";
import { anchorAccountDiscriminator, anchorDiscriminator, commitBytes, encodeAttestArgs, repoHash } from "./encode.js";
import type { AttestationAccount, AttestationInput, AttestationResult, OnChainVisibility } from "./types.js";

export const CONFIG_SEED = Buffer.from("config");
export const ATTEST_SEED = Buffer.from("attest");
export const ATTESTATION_ACCOUNT_SIZE = 8 + 32 + 20 + 32 + 32 + 32 + 5 + 1 + 8 + 32 + 1; // 203

export function deriveConfigPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], programId);
}

export function deriveAttestationPda(programId: PublicKey, repoUrl: string, commitSha: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ATTEST_SEED, Buffer.from(repoHash(repoUrl)), Buffer.from(commitBytes(commitSha))], programId);
}

export function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function ixData(name: string, args: Uint8Array): Buffer {
  return Buffer.concat([Buffer.from(anchorDiscriminator(name)), Buffer.from(args)]);
}

export function buildInitializeIx(programId: PublicKey, authority: PublicKey, attester: PublicKey): TransactionInstruction {
  const [config] = deriveConfigPda(programId);
  const [programData] = PublicKey.findProgramAddressSync([programId.toBuffer()], new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"));
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: programData, isSigner: false, isWritable: false },
      { pubkey: programId, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData("initialize", attester.toBytes()),
  });
}

export function buildSetAttesterIx(programId: PublicKey, authority: PublicKey, attester: PublicKey): TransactionInstruction {
  const [config] = deriveConfigPda(programId);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: ixData("set_attester", attester.toBytes()),
  });
}

export function buildAttestIx(programId: PublicKey, attester: PublicKey, input: AttestationInput, mode: "attest" | "reattest"): TransactionInstruction {
  const [config] = deriveConfigPda(programId);
  const [attestation] = deriveAttestationPda(programId, input.repoUrl, input.commitSha);
  const keys =
    mode === "attest"
      ? [
          { pubkey: config, isSigner: false, isWritable: false },
          { pubkey: attestation, isSigner: false, isWritable: true },
          { pubkey: attester, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ]
      : [
          { pubkey: config, isSigner: false, isWritable: false },
          { pubkey: attestation, isSigner: false, isWritable: true },
          { pubkey: attester, isSigner: true, isWritable: false },
        ];
  return new TransactionInstruction({ programId, keys, data: ixData(mode, encodeAttestArgs(input)) });
}

export function buildSetVisibilityIx(programId: PublicKey, attester: PublicKey, repoUrl: string, commitSha: string, visibility: OnChainVisibility): TransactionInstruction {
  const [config] = deriveConfigPda(programId);
  const [attestation] = deriveAttestationPda(programId, repoUrl, commitSha);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: attestation, isSigner: false, isWritable: true },
      { pubkey: attester, isSigner: true, isWritable: false },
    ],
    data: ixData("set_visibility", new Uint8Array([visibility])),
  });
}

function trimZeros(b: Uint8Array): string {
  let end = b.length;
  while (end > 0 && b[end - 1] === 0) end--;
  return Buffer.from(b.subarray(0, end)).toString("utf8");
}

export function decodeAttestation(data: Uint8Array): AttestationAccount {
  if (data.length < ATTESTATION_ACCOUNT_SIZE) throw new Error(`account too small: ${data.length}`);
  const disc = anchorAccountDiscriminator("Attestation");
  if (!Buffer.from(data.subarray(0, 8)).equals(Buffer.from(disc))) throw new Error("not an Attestation account");
  let o = 8;
  const take = (n: number) => {
    const s = data.subarray(o, o + n);
    o += n;
    return s;
  };
  const repo = take(32);
  const commit = take(20);
  const corpus = take(32);
  const model = take(32);
  const report = take(32);
  const counts = take(5);
  const visibility = take(1)[0] as OnChainVisibility;
  const ts = Buffer.from(take(8)).readBigInt64LE(0);
  const attester = new PublicKey(take(32));
  const bump = take(1)[0]!;
  return {
    repoHash: new Uint8Array(repo),
    commitSha: new Uint8Array(commit),
    corpusVersion: trimZeros(corpus),
    modelId: trimZeros(model),
    reportSha256: new Uint8Array(report),
    counts: [counts[0]!, counts[1]!, counts[2]!, counts[3]!, counts[4]!],
    visibility,
    timestamp: ts,
    attester: attester.toBase58(),
    bump,
  };
}

export async function fetchAttestation(connection: Connection, pda: PublicKey, commitment: Commitment = "confirmed"): Promise<AttestationAccount | null> {
  const info = await connection.getAccountInfo(pda, commitment);
  return info ? decodeAttestation(info.data) : null;
}

export interface AttestOptions {
  connection: Connection;
  programId: PublicKey;
  attester: Keypair;
  input: AttestationInput;
  /** Wait for this commitment before returning. Default finalized. */
  commitment?: Commitment;
  priorityMicroLamports?: number;
}

/** Create or update the (repo, commit) attestation and wait for it to be finalized. */
export async function attest(opts: AttestOptions): Promise<AttestationResult & { attester: string; mode: "attest" | "reattest" }> {
  const { connection, programId, attester, input } = opts;
  const [pda] = deriveAttestationPda(programId, input.repoUrl, input.commitSha);
  const existing = await connection.getAccountInfo(pda, "confirmed");
  const mode: "attest" | "reattest" = existing ? "reattest" : "attest";
  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: opts.priorityMicroLamports ?? 10_000 }),
    buildAttestIx(programId, attester.publicKey, input, mode),
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [attester], { commitment: opts.commitment ?? "finalized", preflightCommitment: "confirmed" });
  const status = await connection.getSignatureStatus(sig, { searchTransactionHistory: true });
  return { pda: pda.toBase58(), txSig: sig, slot: status.value?.slot ?? null, programId: programId.toBase58(), attester: attester.publicKey.toBase58(), mode };
}
