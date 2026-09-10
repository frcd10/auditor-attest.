import { enabledModels, loadModels } from "@auditor/pricing";
import { createJob } from "./actions";

export const dynamic = "force-dynamic";

export default function Home() {
  const models = enabledModels(loadModels());
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Paste a GitHub link. Get a verifiable security audit.
        </h1>
        <p className="max-w-2xl text-[var(--muted)]">
          An AI auditor runs the open-source <code className="mono">auditor-skill</code> corpus (20 checklists, 1,413 items, 136 known attack vectors) against your repository in an isolated sandbox. The report is attested on Solana mainnet: repo, commit, corpus version, model, report hash and severity counts, signed by the service key.
        </p>
        <form action={createJob} className="panel flex flex-col gap-3 p-4 sm:flex-row">
          <input
            name="url"
            type="url"
            required
            placeholder="https://github.com/owner/repo"
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 mono text-sm outline-none focus:border-[var(--accent)]"
          />
          <button type="submit" className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black">
            Get a quote
          </button>
        </form>
        <p className="text-xs text-[var(--muted)]">Public repositories only. Add <code className="mono">/tree/&lt;branch-or-sha&gt;</code> to pin a ref; otherwise the default branch HEAD is audited.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-4">
          <h2 className="font-semibold">1. Quote</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">A worker shallow-clones the repo, counts lines with tokei and prices the audit with the corpus's own cost formula. The free tier shows which checklists and vectors would trigger.</p>
        </div>
        <div className="panel p-4">
          <h2 className="font-semibold">2. Pay in USDC</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Transfer USDC on mainnet with the job id as memo. Choose public or private disclosure. Bring your own API key and pay only the attestation fee.</p>
        </div>
        <div className="panel p-4">
          <h2 className="font-semibold">3. Report + attestation</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">The audit runs in an ephemeral container with no network except the model API. The report hash and severity counts go on-chain; a badge links README → report → attestation.</p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Models</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="py-1 pr-4">Model</th>
                <th className="py-1 pr-4">Tier</th>
                <th className="py-1 pr-4">Input $/M</th>
                <th className="py-1 pr-4">Output $/M</th>
                <th className="py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className="border-t border-[var(--border)]">
                  <td className="py-1 pr-4 mono">{m.id}</td>
                  <td className="py-1 pr-4">{m.tier}</td>
                  <td className="py-1 pr-4">{m.input_per_mtok}</td>
                  <td className="py-1 pr-4">{m.output_per_mtok}</td>
                  <td className="py-1 text-[var(--muted)]">{m.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
