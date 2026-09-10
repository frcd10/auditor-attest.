#!/usr/bin/env tsx
/**
 * Admin refund: send the USDC a job's payer transferred back to them, on mainnet.
 *
 *   pnpm refund <job id> [--amount 6.23] [--yes]
 *
 * Reads TREASURY_KEYPAIR_PATH, RPC_URL, USDC_MINT from .env. Refunds go to the payer's
 * associated token account (created if missing, paid by the treasury). Memo: refund:<job id>.
 * This sends a real mainnet transaction; it asks for confirmation unless --yes is passed.
 */
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { config as loadDotenv } from "dotenv";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { prisma } from "@auditor/db";
import { loadKeypair, USDC_DECIMALS, USDC_MINT } from "@auditor/attest";
import { findRepoRoot } from "@auditor/pricing";
import { fromBaseUnits, toBaseUnits } from "../apps/worker/src/payments.js";

loadDotenv({ path: resolve(findRepoRoot(process.cwd()), ".env") });
const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const jobId = process.argv[2];
  if (!jobId || jobId.startsWith("--")) throw new Error("usage: refund.ts <job id> [--amount X] [--yes]");
  if ((process.env.CLUSTER ?? "mainnet-beta") !== "mainnet-beta") throw new Error("mainnet only");
  const rpc = process.env.RPC_URL;
  const kp = process.env.TREASURY_KEYPAIR_PATH;
  if (!rpc || !kp) throw new Error("RPC_URL and TREASURY_KEYPAIR_PATH must be set");
  const mint = new PublicKey(process.env.USDC_MINT ?? USDC_MINT);

  const payment = await prisma.payment.findUnique({ where: { jobId }, include: { job: true } });
  if (!payment) throw new Error("no payment row for this job");
  if (payment.status === "refunded") throw new Error(`already refunded: ${payment.refundTxSig}`);
  if (!payment.payer) throw new Error("payment has no payer on record (nothing was received)");
  const amountStr = arg("amount") ?? payment.receivedUsdc?.toString();
  if (!amountStr) throw new Error("no received amount on record; pass --amount");
  const amount = toBaseUnits(amountStr);
  if (amount <= 0n) throw new Error("amount must be positive");

  const treasury = loadKeypair(kp.replace(/^~/, process.env.HOME ?? ""));
  const payer = new PublicKey(payment.payer);
  const fromAta = getAssociatedTokenAddressSync(mint, treasury.publicKey, true);
  const toAta = getAssociatedTokenAddressSync(mint, payer, true);
  console.log(`refund ${fromBaseUnits(amount)} USDC → ${payer.toBase58()} (job ${jobId}, status ${payment.job.status}, payment ${payment.status})`);
  if (!process.argv.includes("--yes")) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const a = await rl.question("Send on mainnet? [y/N] ");
    rl.close();
    if (a.trim().toLowerCase() !== "y") return;
  }
  const connection = new Connection(rpc, "confirmed");
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(treasury.publicKey, toAta, payer, mint),
    createTransferCheckedInstruction(fromAta, mint, toAta, treasury.publicKey, amount, USDC_DECIMALS),
    new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [{ pubkey: treasury.publicKey, isSigner: true, isWritable: false }], data: Buffer.from(`refund:${jobId}`, "utf8") }),
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [treasury], { commitment: "finalized" });
  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { status: "refunded", refundTxSig: sig, refundedAt: new Date() } }),
    prisma.job.update({ where: { id: jobId }, data: { status: "refunded" } }),
    prisma.jobEvent.create({ data: { jobId, message: `refunded ${fromBaseUnits(amount)} USDC`, data: { txSig: sig } } }),
  ]);
  console.log(`refunded: ${sig}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await prisma.$disconnect();
    process.exit(1);
  });
