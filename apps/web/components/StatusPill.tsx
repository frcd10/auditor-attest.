const LABELS: Record<string, [string, string]> = {
  quoting: ["Quoting", "var(--purple)"],
  quote_running: ["Quoting", "var(--purple)"],
  quoted: ["Estimate ready", "var(--green)"],
  awaiting_payment: ["Waiting for your key", "var(--medium)"],
  queued: ["Queued", "var(--purple)"],
  running: ["Auditing", "var(--purple)"],
  ingesting: ["Finalizing", "var(--purple)"],
  done: ["Done", "var(--green)"],
  failed: ["Failed", "var(--critical)"],
  failed_budget: ["Stopped at spend limit", "var(--critical)"],
  cancelled: ["Cancelled", "var(--muted)"],
  refunded: ["Refunded", "var(--muted)"],
};

export function StatusPill({ status }: { status: string }) {
  const [label, color] = LABELS[status] ?? [status, "var(--muted)"];
  const live = ["quoting", "quote_running", "queued", "running", "ingesting"].includes(status);
  return (
    <span className="inline-flex items-center gap-2 rounded-sm border px-2.5 py-1 text-sm font-medium" style={{ borderColor: color, color, background: "transparent" }}>
      <span className={`inline-block h-2 w-2 rounded-sm ${live ? "animate-pulse" : ""}`} style={{ background: color }} />
      {label}
    </span>
  );
}
