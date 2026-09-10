import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Auditor Attest", template: "%s · Auditor Attest" },
  description: "Paste a GitHub link, get an AI security audit attested on Solana mainnet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-[var(--border)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--text)] no-underline">
              Auditor <span className="text-[var(--accent)]">Attest</span>
            </Link>
            <nav className="flex gap-4 text-sm text-[var(--muted)]">
              <Link href="/explore">Explore</Link>
              <Link href="/stats">Stats</Link>
              <a href="https://github.com/solanabr/auditor-skill" target="_blank" rel="noreferrer">
                Corpus
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-10 text-xs text-[var(--muted)]">
          Audits are AI-generated first passes built on the open-source auditor-skill corpus. They are not a substitute for a human audit and never certify code as safe to deploy. Attestations live on Solana mainnet and bind only hashes and counts.
        </footer>
      </body>
    </html>
  );
}
