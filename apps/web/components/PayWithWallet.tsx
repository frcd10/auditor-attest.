"use client";

import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { useMemo, useState } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const USDC_DECIMALS = 6;

export interface PayProps {
  rpcUrl: string;
  treasury: string;
  usdcMint: string;
  memo: string; // job id
  amountUsdc: string; // decimal string
}

function toBaseUnits(usdc: string): bigint {
  const [i, f = ""] = usdc.split(".");
  return BigInt(i || "0") * 10n ** BigInt(USDC_DECIMALS) + BigInt((f + "000000").slice(0, USDC_DECIMALS));
}

function PayInner({ treasury, usdcMint, memo, amountUsdc }: Omit<PayProps, "rpcUrl">) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [state, setState] = useState<{ status: "idle" | "sending" | "sent" | "error"; sig?: string; error?: string }>({ status: "idle" });

  async function pay() {
    if (!publicKey) return;
    setState({ status: "sending" });
    try {
      const mint = new PublicKey(usdcMint);
      const treasuryPk = new PublicKey(treasury);
      const from = getAssociatedTokenAddressSync(mint, publicKey, true);
      const to = getAssociatedTokenAddressSync(mint, treasuryPk, true);
      const amount = toBaseUnits(amountUsdc);
      const tx = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(publicKey, to, treasuryPk, mint),
        createTransferCheckedInstruction(from, mint, to, publicKey, amount, USDC_DECIMALS),
        new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }], data: new TextEncoder().encode(memo) as unknown as Buffer }),
      );
      const sig = await sendTransaction(tx, connection);
      setState({ status: "sent", sig });
    } catch (e) {
      setState({ status: "error", error: (e as Error).message });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <WalletMultiButton />
      <button
        type="button"
        disabled={!connected || state.status === "sending" || state.status === "sent"}
        onClick={pay}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
      >
        {state.status === "sending" ? "Confirm in wallet…" : state.status === "sent" ? "Sent" : `Pay ${amountUsdc} USDC`}
      </button>
      {state.status === "sent" && state.sig && (
        <span className="text-xs">
          Sent:{" "}
          <a href={`https://explorer.solana.com/tx/${state.sig}`} target="_blank" rel="noreferrer" className="mono">
            {state.sig.slice(0, 16)}…
          </a>{" "}
          — waiting for finalization (about 30 seconds), this page refreshes itself.
        </span>
      )}
      {state.status === "error" && <span className="text-xs text-[var(--critical)]">{state.error}</span>}
    </div>
  );
}

export function PayWithWallet(props: PayProps) {
  const endpoint = useMemo(() => props.rpcUrl, [props.rpcUrl]);
  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <PayInner {...props} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
