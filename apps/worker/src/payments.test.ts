import { PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { fromBaseUnits, parsePayment, toBaseUnits } from "./payments.js";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const ATA = "7Yd6c8y8gTG6Dgdg9dZzk4AXaU9v6nUpJGp3aP9LZ9bQ";
const PAYER = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

function tx(ixs: unknown[], logs: string[] = [], inner: unknown[] = []): ParsedTransactionWithMeta {
  return {
    slot: 123,
    blockTime: 1,
    transaction: { message: { accountKeys: [{ pubkey: new PublicKey(PAYER), signer: true, writable: true, source: "transaction" }], instructions: ixs, recentBlockhash: "x" }, signatures: ["sig"] },
    meta: { err: null, fee: 0, preBalances: [], postBalances: [], logMessages: logs, innerInstructions: inner.length ? [{ index: 0, instructions: inner }] : [], postTokenBalances: [], preTokenBalances: [] },
  } as unknown as ParsedTransactionWithMeta;
}

describe("parsePayment", () => {
  it("reads memo + transferChecked amount to the treasury ATA", () => {
    const t = tx([
      { programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), program: "spl-memo", parsed: "job_abc" },
      { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), program: "spl-token", parsed: { type: "transferChecked", info: { destination: ATA, mint: USDC, authority: PAYER, tokenAmount: { amount: "6230000", decimals: 6 } } } },
    ]);
    const p = parsePayment(t, ATA, USDC);
    expect(p.memo).toBe("job_abc");
    expect(p.amount).toBe(6_230_000n);
    expect(p.payer).toBe(PAYER);
    expect(p.err).toBe(false);
  });
  it("ignores transfers to other accounts and other mints; falls back to log memo", () => {
    const t = tx(
      [
        { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), program: "spl-token", parsed: { type: "transferChecked", info: { destination: PAYER, mint: USDC, authority: PAYER, tokenAmount: { amount: "1" } } } },
        { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), program: "spl-token", parsed: { type: "transferChecked", info: { destination: ATA, mint: "So11111111111111111111111111111111111111112", authority: PAYER, tokenAmount: { amount: "999" } } } },
      ],
      ['Program log: Memo (len 7): "job_xyz"'],
    );
    const p = parsePayment(t, ATA, USDC);
    expect(p.memo).toBe("job_xyz");
    expect(p.amount).toBe(0n);
  });
  it("sums inner instruction transfers", () => {
    const t = tx([{ programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), program: "spl-memo", parsed: "j" }], [], [
      { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), program: "spl-token", parsed: { type: "transfer", info: { destination: ATA, authority: PAYER, amount: "1000000" } } },
      { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), program: "spl-token", parsed: { type: "transfer", info: { destination: ATA, authority: PAYER, amount: "500000" } } },
    ]);
    expect(parsePayment(t, ATA, USDC).amount).toBe(1_500_000n);
  });
});

describe("base units", () => {
  it("converts decimal USDC strings exactly", () => {
    expect(toBaseUnits("6.23")).toBe(6_230_000n);
    expect(toBaseUnits("5")).toBe(5_000_000n);
    expect(toBaseUnits("0.000001")).toBe(1n);
    expect(fromBaseUnits(6_230_000n)).toBe("6.230000");
    expect(fromBaseUnits(1n)).toBe("0.000001");
  });
});
