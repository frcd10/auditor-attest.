import Link from "next/link";
import { siteRepoUrl } from "@/lib/env";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="inline-block h-5 w-5 rounded-md" style={{ background: "var(--gradient)" }} />
      <span>Auditor Attest</span>
    </Link>
  );
}

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-black/70 backdrop-blur-xl">
      <div className="container-x flex h-16 items-center justify-between gap-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-[var(--muted)] md:flex">
          <Link href="/explore" className="hover:text-white">Audits</Link>
          <Link href="/stats" className="hover:text-white">Stats</Link>
          <Link href="/#ways" className="hover:text-white">Ways to use</Link>
          <Link href="/#how" className="hover:text-white">How it works</Link>
          <a href={siteRepoUrl()} target="_blank" rel="noreferrer" className="hover:text-white">Source ↗</a>
        </nav>
        <Link href="/#start" className="btn btn-primary btn-sm">Start an audit</Link>
      </div>
    </header>
  );
}
