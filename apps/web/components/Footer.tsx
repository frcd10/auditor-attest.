import Link from "next/link";
import { Logo } from "./Nav";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--border)]">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="space-y-3 md:col-span-2">
          <Logo />
          <p className="max-w-md text-sm text-[var(--muted)]">
            AI security audits for Solana repositories, run in an isolated sandbox on the open-source auditor-skill corpus, attested on Solana mainnet. A rigorous first pass, not a substitute for a human audit, and never a "safe to deploy" stamp.
          </p>
        </div>
        <div className="text-sm">
          <div className="mb-3 font-semibold">Product</div>
          <ul className="space-y-2 text-[var(--muted)]">
            <li><Link href="/#start" className="hover:text-white">Start an audit</Link></li>
            <li><Link href="/explore" className="hover:text-white">Audits</Link></li>
            <li><Link href="/stats" className="hover:text-white">Stats</Link></li>
            <li><Link href="/#pricing" className="hover:text-white">Pricing</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="mb-3 font-semibold">Resources</div>
          <ul className="space-y-2 text-[var(--muted)]">
            <li><a href="https://github.com/solanabr/auditor-skill" target="_blank" rel="noreferrer" className="hover:text-white">auditor-skill corpus ↗</a></li>
            <li><a href="https://explorer.solana.com/" target="_blank" rel="noreferrer" className="hover:text-white">Solana Explorer ↗</a></li>
            <li><Link href="/#onchain" className="hover:text-white">What goes on-chain</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-x flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] py-6 text-xs text-[var(--dim)]">
        <span>Mainnet only · USDC · corpus 7.3.0@6bb2cbf</span>
        <span>Built for the Solana hackathon</span>
      </div>
    </footer>
  );
}
