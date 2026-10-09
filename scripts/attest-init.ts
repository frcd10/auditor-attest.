#!/usr/bin/env tsx
/**
 * One-time: initialise the audit_attest Config PDA after `anchor deploy`, or rotate the
 * attester. Signs with the program's upgrade authority (the deploy wallet).
 *
 *   pnpm exec tsx scripts/attest-init.ts init   --authority ~/.config/solana/id_mainnet.json   # the deploy wallet
 *   pnpm exec tsx scripts/attest-init.ts rotate --authority ~/.config/solana/id_mainnet.json   # the deploy wallet --attester <pubkey>
 *   pnpm exec tsx scripts/attest-init.ts show
 *
 * Uses AUDIT_ATTEST_PROGRAM_ID, ATTESTER_KEYPAIR_PATH, RPC_URL from .env.
 * Sends a transaction on the cluster RPC_URL points at (devnet in the current setup).
 */
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { buildInitializeIx, buildSetAttesterIx, deriveConfigPda, loadKeypair } from "@auditor/attest";
import { findRepoRoot } from "@auditor/pricing";

loadDotenv({ path: resolve(findRepoRoot(process.cwd()), ".env"), quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const cmd = process.argv[2];
  const rpc = process.env.RPC_URL;
  const pid = process.env.AUDIT_ATTEST_PROGRAM_ID;
  if (!rpc || !pid) throw new Error("RPC_URL and AUDIT_ATTEST_PROGRAM_ID must be set in .env");
  const connection = new Connection(rpc, "confirmed");
  const programId = new PublicKey(pid);
  const [config] = deriveConfigPda(programId);

  if (cmd === "show") {
    const info = await connection.getAccountInfo(config);
    if (!info) {
      console.log(`config ${config.toBase58()}: not initialised`);
      return;
    }
    const authority = new PublicKey(info.data.subarray(8, 40)).toBase58();
    const attester = new PublicKey(info.data.subarray(40, 72)).toBase58();
    console.log(JSON.stringify({ config: config.toBase58(), authority, attester }, null, 2));
    return;
  }

  const authorityPath = arg("authority");
  if (!authorityPath) throw new Error("--authority <keypair path> required");
  const authority = loadKeypair(authorityPath.replace(/^~/, process.env.HOME ?? ""));
  const attesterPub = arg("attester")
    ? new PublicKey(arg("attester")!)
    : loadKeypair((process.env.ATTESTER_KEYPAIR_PATH ?? "").replace(/^~/, process.env.HOME ?? "")).publicKey;

  let ix;
  if (cmd === "init") ix = buildInitializeIx(programId, authority.publicKey, attesterPub);
  else if (cmd === "rotate") ix = buildSetAttesterIx(programId, authority.publicKey, attesterPub);
  else throw new Error("usage: attest-init.ts init|rotate|show");

  console.log(`${cmd}: program ${programId.toBase58()} config ${config.toBase58()} authority ${authority.publicKey.toBase58()} attester ${attesterPub.toBase58()}`);
  const sig = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [authority], { commitment: "finalized" });
  console.log(`tx ${sig}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
