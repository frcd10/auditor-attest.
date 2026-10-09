import Link from "next/link";
import { siteRepoUrl } from "@/lib/env";

export function Logo() {
  return (
    <Link href="/" className="flex items-center" aria-label="Auditor Dog, home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/auditor-dog-horizontal-white.svg" alt="Auditor Dog" className="h-8 w-auto" />
    </Link>
  );
}

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-black/70 backdrop-blur-xl">
      <div className="container-x flex h-16 items-center justify-between gap-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-[var(--muted)] md:flex">
          <Link href="/explore" className="hover:text-white">Reports</Link>
          <Link href="/stats" className="hover:text-white">Stats</Link>
          <Link href="/#ways" className="hover:text-white">Run it yourself</Link>
          <Link href="/#how" className="hover:text-white">How it works</Link>
          <a href={siteRepoUrl()} target="_blank" rel="noreferrer" className="hover:text-white">Source</a>
        </nav>
        <Link href="/#start" className="btn btn-primary btn-sm">Submit a repository</Link>
      </div>
    </header>
  );
}
