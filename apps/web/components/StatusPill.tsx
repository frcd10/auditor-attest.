const LABELS: Record<string, [string, string]> = {
  quoting: ["Quoting", "var(--accent)"],
  quote_running: ["Quoting", "var(--accent)"],
  quoted: ["Quote ready", "var(--accent)"],
  awaiting_payment: ["Awaiting payment", "var(--medium)"],
  queued: ["Queued", "var(--accent)"],
  running: ["Auditing", "var(--accent)"],
  ingesting: ["Ingesting", "var(--accent)"],
  done: ["Done", "#3ddc97"],
  failed: ["Failed", "var(--critical)"],
  failed_budget: ["Failed (budget)", "var(--critical)"],
  cancelled: ["Cancelled", "var(--muted)"],
  refunded: ["Refunded", "var(--muted)"],
};

export function StatusPill({ status }: { status: string }) {
  const [label, color] = LABELS[status] ?? [status, "var(--muted)"];
  const live = ["quoting", "quote_running", "queued", "running", "ingesting"].includes(status);
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm" style={{ borderColor: color, color }}>
      <span className={`inline-block h-2 w-2 rounded-full ${live ? "animate-pulse" : ""}`} style={{ background: color }} />
      {label}
    </span>
  );
}
