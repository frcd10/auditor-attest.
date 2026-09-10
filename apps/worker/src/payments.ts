/**
 * Payment watcher (mainnet-beta only).
 *
 * The submitter transfers USDC to the treasury's associated token account with the job id
 * as an SPL Memo. We poll finalized signatures on that ATA, parse each transaction for
 * (memo, amount, payer), match against pending Payment rows, and enqueue the job once the
 * finalized amount covers the expected price. Everything here is read-only on-chain.
 */
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, PublicKey, type ParsedInstruction, type ParsedTransactionWithMeta, type PartiallyDecodedInstruction } from "@solana/web3.js";
import { prisma } from "@auditor/db";
import { USDC_DECIMALS, USDC_MINT } from "@auditor/attest";
import { jobEvent, log } from "./log.js";

export const MEMO_PROGRAM_IDS = new Set(["MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo"]);
const TOKEN_PROGRAMS = new Set(["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]);

export interface ParsedPayment {
  memo: string | null;
  /** Base units (6 decimals) received by the treasury ATA in this transaction. */
  amount: bigint;
  payer: string | null;
  slot: number;
  err: boolean;
}

/** Pure: extract memo + USDC received by `treasuryAta` from a parsed transaction. */
export function parsePayment(tx: ParsedTransactionWithMeta, treasuryAta: string, usdcMint: string = USDC_MINT): ParsedPayment {
  const all: (ParsedInstruction | PartiallyDecodedInstruction)[] = [...tx.transaction.message.instructions];
  for (const inner of tx.meta?.innerInstructions ?? []) all.push(...inner.instructions);
  let memo: string | null = null;
  let amount = 0n;
  let payer: string | null = null;
  for (const ix of all) {
    const pid = ix.programId.toBase58();
    if (MEMO_PROGRAM_IDS.has(pid)) {
      const p = (ix as ParsedInstruction).parsed;
      if (typeof p === "string") memo = p;
      else if (p && typeof p === "object" && "memo" in (p as object)) memo = String((p as { memo: unknown }).memo);
      continue;
    }
    if (!TOKEN_PROGRAMS.has(pid) || !("parsed" in ix)) continue;
    const parsed = ix.parsed as { type?: string; info?: Record<string, unknown> } | undefined;
    if (!parsed?.info || (parsed.type !== "transfer" && parsed.type !== "transferChecked")) continue;
    if (parsed.info.destination !== treasuryAta) continue;
    if (parsed.type === "transferChecked" && parsed.info.mint !== usdcMint) continue;
    const raw = parsed.type === "transferChecked" ? (parsed.info.tokenAmount as { amount?: string } | undefined)?.amount : (parsed.info.amount as string | undefined);
    if (raw && /^\d+$/.test(raw)) amount += BigInt(raw);
    const auth = (parsed.info.authority ?? parsed.info.multisigAuthority) as string | undefined;
    if (auth && !payer) payer = auth;
  }
  if (memo === null) {
    // Fallback: memo program logs "Program log: Memo (len N): \"...\"".
    for (const l of tx.meta?.logMessages ?? []) {
      const m = /^Program log: Memo \(len \d+\): "(.*)"$/.exec(l);
      if (m) {
        memo = m[1]!;
        break;
      }
    }
  }
  if (!payer) payer = tx.transaction.message.accountKeys[0]?.pubkey.toBase58() ?? null;
  // For plain `transfer` (no mint in the ix), verify the destination's mint via post balances.
  if (amount > 0n && tx.meta?.postTokenBalances?.length) {
    const dest = tx.meta.postTokenBalances.find((b) => tx.transaction.message.accountKeys[b.accountIndex]?.pubkey.toBase58() === treasuryAta);
    if (dest && dest.mint !== usdcMint) amount = 0n;
  }
  return { memo, amount, payer, slot: tx.slot, err: !!tx.meta?.err };
}

export function toBaseUnits(usdc: number | string): bigint {
  const [i, f = ""] = String(usdc).split(".");
  return BigInt(i || "0") * 10n ** BigInt(USDC_DECIMALS) + BigInt((f + "000000").slice(0, USDC_DECIMALS));
}

export function fromBaseUnits(base: bigint): string {
  const s = base.toString().padStart(USDC_DECIMALS + 1, "0");
  return `${s.slice(0, -USDC_DECIMALS)}.${s.slice(-USDC_DECIMALS)}`;
}

export interface PaymentWatcherEnv {
  rpcUrl: string;
  treasuryPubkey: string;
  usdcMint: string;
}

export class PaymentWatcher {
  private readonly connection: Connection;
  readonly treasuryAta: PublicKey;
  private readonly seen = new Set<string>();

  constructor(private readonly env: PaymentWatcherEnv) {
    this.connection = new Connection(env.rpcUrl, { commitment: "finalized" });
    this.treasuryAta = getAssociatedTokenAddressSync(new PublicKey(env.usdcMint), new PublicKey(env.treasuryPubkey), true);
  }

  /** One poll: expire old payments, scan new finalized signatures, match and enqueue. */
  async tick(): Promise<void> {
    const now = new Date();
    const expired = await prisma.payment.findMany({ where: { status: "pending", expiresAt: { lt: now } }, include: { job: true } });
    for (const p of expired) {
      await prisma.$transaction([
        prisma.payment.update({ where: { id: p.id }, data: { status: "expired" } }),
        prisma.job.update({ where: { id: p.jobId }, data: { status: "cancelled", error: "payment window expired; submit the repository again for a fresh quote" } }),
      ]);
      await jobEvent(p.jobId, "payment window expired", undefined, "warn");
    }

    const open = await prisma.payment.findMany({ where: { status: { in: ["pending", "detected"] } } });
    if (open.length === 0) return;
    const byMemo = new Map(open.map((p) => [p.memo, p]));

    const sigs = await this.connection.getSignaturesForAddress(this.treasuryAta, { limit: 100 }, "finalized");
    for (const s of sigs) {
      if (this.seen.has(s.signature)) continue;
      if (s.err) {
        this.seen.add(s.signature);
        continue;
      }
      const tx = await this.connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: "finalized" });
      if (!tx) continue; // not finalized yet from this RPC's point of view; retry next tick
      this.seen.add(s.signature);
      const parsed = parsePayment(tx, this.treasuryAta.toBase58(), this.env.usdcMint);
      if (parsed.err || !parsed.memo) continue;
      const payment = byMemo.get(parsed.memo.trim());
      if (!payment) continue;
      const already = await prisma.payment.findUnique({ where: { txSig: s.signature } });
      if (already) continue;
      const expected = toBaseUnits(payment.expectedUsdc.toString());
      const received = parsed.amount;
      if (received >= expected) {
        await prisma.$transaction([
          prisma.payment.update({
            where: { id: payment.id },
            data: { status: "finalized", txSig: s.signature, slot: BigInt(parsed.slot), payer: parsed.payer, receivedUsdc: fromBaseUnits(received), detectedAt: now, finalizedAt: now },
          }),
          prisma.job.updateMany({ where: { id: payment.jobId, status: "awaiting_payment" }, data: { status: "queued" } }),
        ]);
        await jobEvent(payment.jobId, "payment finalized; job queued", { txSig: s.signature, received: fromBaseUnits(received), payer: parsed.payer });
        byMemo.delete(parsed.memo);
      } else if (received > 0n) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "mismatched", txSig: s.signature, slot: BigInt(parsed.slot), payer: parsed.payer, receivedUsdc: fromBaseUnits(received), detectedAt: now },
        });
        await jobEvent(payment.jobId, `payment amount too low: received ${fromBaseUnits(received)} USDC, expected ${payment.expectedUsdc.toString()}; refund with scripts/refund.ts`, { txSig: s.signature }, "warn");
      }
    }
    if (this.seen.size > 5000) {
      // keep memory bounded; matched signatures are persisted in Payment.txSig anyway
      const keep = [...this.seen].slice(-2000);
      this.seen.clear();
      for (const k of keep) this.seen.add(k);
    }
  }
}

export function startPaymentWatcher(env: PaymentWatcherEnv, intervalMs: number): { stop: () => void } {
  const w = new PaymentWatcher(env);
  log("info", `payment watcher on treasury ATA ${w.treasuryAta.toBase58()} every ${intervalMs}ms`);
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await w.tick();
    } catch (e) {
      log("warn", `payment watcher: ${(e as Error).message}`);
    } finally {
      running = false;
    }
  }, intervalMs);
  return { stop: () => clearInterval(timer) };
}
