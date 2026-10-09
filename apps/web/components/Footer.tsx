import Link from "next/link";
import { clusterLabel, corpusVersion, siteRepoUrl } from "@/lib/env";
import { Logo } from "./Nav";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--border)]">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="space-y-3 md:col-span-2">
          <Logo />
          <p className="max-w-md text-sm text-[var(--muted)]">
            A public good for the Solana ecosystem: AI security audits on the open-source auditor-skill corpus, run on your own model key, attested on {clusterLabel()}. 100% open source, no fees. A rigorous first pass, not a substitute for a human audit, and never a &quot;safe to deploy&quot; stamp.
          </p>
        </div>
        <div className="text-sm">
          <div className="mb-3 font-semibold">Use it</div>
          <ul className="space-y-2 text-[var(--muted)]">
            <li><Link href="/#start" className="hover:text-white">Start an audit</Link></li>
            <li><Link href="/#ways" className="hover:text-white">Inside Claude Code</Link></li>
            <li><Link href="/#ways" className="hover:text-white">Clone and self-host</Link></li>
            <li><Link href="/explore" className="hover:text-white">Audits</Link></li>
            <li><Link href="/stats" className="hover:text-white">Stats</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="mb-3 font-semibold">Open source</div>
          <ul className="space-y-2 text-[var(--muted)]">
            <li><a href={siteRepoUrl()} target="_blank" rel="noreferrer" className="hover:text-white">This site&apos;s source ↗</a></li>
            <li><a href={`${siteRepoUrl()}/tree/main/reports`} target="_blank" rel="noreferrer" className="hover:text-white">Every report, in git ↗</a></li>
            <li><a href="https://github.com/solanabr/auditor-skill" target="_blank" rel="noreferrer" className="hover:text-white">auditor-skill corpus ↗</a></li>
            <li><Link href="/#onchain" className="hover:text-white">What goes on-chain</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-x flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] py-6 text-xs text-[var(--dim)]">
        <span>{clusterLabel()} · bring your own key · corpus {corpusVersion()}</span>
        <span>Built for the Solana hackathon · public good</span>
      </div>
    </footer>
  );
}
