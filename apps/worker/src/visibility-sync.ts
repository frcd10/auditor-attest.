/**
 * Keeps the on-chain `visibility` byte in step with the effective disclosure state
 * (maintainer acknowledgement or the 90-day window flips public_redacted → public).
 * Runs periodically in the worker; each update is one small mainnet transaction signed by
 * the attester.
 */
import { buildSetVisibilityIx, loadKeypair, type OnChainVisibility } from "@auditor/attest";
import { prisma } from "@auditor/db";
import { effectiveVisibility } from "@auditor/report";
import { ComputeBudgetProgram, Connection, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import type { WorkerEnv } from "./env.js";
import { log } from "./log.js";

export function visibilityByte(v: "public" | "private" | "public_redacted"): OnChainVisibility {
  return v === "private" ? 0 : v === "public" ? 1 : 2;
}

export async function syncVisibilityOnce(env: WorkerEnv): Promise<number> {
  if (!env.attestProgramId || !env.attesterKeypairPath || !env.rpcUrl) return 0;
  const rows = await prisma.attestation.findMany({ include: { report: true } });
  const due = rows.filter((a) => visibilityByte(effectiveVisibility({ visibility: a.report.visibility, submitterVerified: a.report.submitterVerified, redactUntil: a.report.redactUntil, maintainerAckAt: a.report.maintainerAckAt })) !== a.onChainVisibility);
  if (due.length === 0) return 0;
  const connection = new Connection(env.rpcUrl, "confirmed");
  const programId = new PublicKey(env.attestProgramId);
  const attester = loadKeypair(env.attesterKeypairPath);
  let n = 0;
  for (const a of due) {
    const target = visibilityByte(effectiveVisibility({ visibility: a.report.visibility, submitterVerified: a.report.submitterVerified, redactUntil: a.report.redactUntil, maintainerAckAt: a.report.maintainerAckAt }));
    try {
      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 30_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
        buildSetVisibilityIx(programId, attester.publicKey, `https://github.com/${a.report.owner}/${a.report.repo}`, a.report.commit, target),
      );
      const sig = await sendAndConfirmTransaction(connection, tx, [attester], { commitment: "finalized" });
      await prisma.attestation.update({ where: { id: a.id }, data: { onChainVisibility: target } });
      log("info", `visibility synced for ${a.report.owner}/${a.report.repo}@${a.report.commit.slice(0, 7)} → ${target} (${sig})`);
      n++;
    } catch (e) {
      log("warn", `visibility sync failed for ${a.pda}: ${(e as Error).message}`);
    }
  }
  return n;
}

export function startVisibilitySync(env: WorkerEnv, intervalMs: number): { stop: () => void } {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await syncVisibilityOnce(env);
    } catch (e) {
      log("warn", `visibility sync: ${(e as Error).message}`);
    } finally {
      running = false;
    }
  }, intervalMs);
  return { stop: () => clearInterval(timer) };
}
