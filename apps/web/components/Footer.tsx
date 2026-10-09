import Link from "next/link";
import { clusterLabel, corpusVersion, siteRepoUrl } from "@/lib/env";
import { Logo } from "./Nav";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-[var(--border)]">
      <div className="container-x grid gap-10 py-8 md:grid-cols-4">
        <div className="space-y-3 md:col-span-2">
          <Logo />
          <p className="max-w-md text-sm text-[var(--muted)]">
            Open-source security audits for Solana programs, run on the auditor-skill corpus with the user&apos;s own model key and recorded on {clusterLabel()}. A thorough first pass, not a human audit.
          </p>
        </div>
        <div className="text-sm">
          <div className="mb-3 font-semibold">Site</div>
          <ul className="space-y-2 text-[var(--muted)]">
            <li><Link href="/#start" className="hover:text-white">Submit a repository</Link></li>
            <li><Link href="/explore" className="hover:text-white">Reports</Link></li>
            <li><Link href="/stats" className="hover:text-white">Stats</Link></li>
            <li><Link href="/#onchain" className="hover:text-white">What is on-chain</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="mb-3 font-semibold">Source</div>
          <ul className="space-y-2 text-[var(--muted)]">
            <li><a href={siteRepoUrl()} target="_blank" rel="noreferrer" className="hover:text-white">Site, runner and program (GitHub)</a></li>
            <li><a href={`${siteRepoUrl()}/tree/main/reports`} target="_blank" rel="noreferrer" className="hover:text-white">Every report, in git</a></li>
            <li><a href={`${siteRepoUrl()}/blob/main/docs/calibration.md`} target="_blank" rel="noreferrer" className="hover:text-white">Cost calibration data</a></li>
            <li><a href="https://github.com/solanabr/auditor-skill" target="_blank" rel="noreferrer" className="hover:text-white">auditor-skill corpus</a></li>
          </ul>
        </div>
      </div>
      <div className="container-x flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] py-4 text-xs text-[var(--dim)]">
        <span>Auditor Dog · corpus {corpusVersion()} · {clusterLabel()}</span>
        <span>MIT licensed</span>
      </div>
    </footer>
  );
}
