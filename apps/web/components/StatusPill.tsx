const LABELS: Record<string, [string, string]> = {
  quoting: ["Quoting", "var(--purple)"],
  quote_running: ["Quoting", "var(--purple)"],
  quoted: ["Quote ready", "var(--green)"],
  awaiting_payment: ["Awaiting payment", "var(--medium)"],
  queued: ["Queued", "var(--purple)"],
  running: ["Auditing", "var(--purple)"],
  ingesting: ["Finalizing", "var(--purple)"],
  done: ["Done", "var(--green)"],
  failed: ["Failed", "var(--critical)"],
  failed_budget: ["Stopped at budget", "var(--critical)"],
  cancelled: ["Cancelled", "var(--muted)"],
  refunded: ["Refunded", "var(--muted)"],
};

export function StatusPill({ status }: { status: string }) {
  const [label, color] = LABELS[status] ?? [status, "var(--muted)"];
  const live = ["quoting", "quote_running", "queued", "running", "ingesting"].includes(status);
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium" style={{ borderColor: color, color, background: "rgba(0,0,0,0.5)" }}>
      <span className={`inline-block h-2 w-2 rounded-full ${live ? "animate-pulse" : ""}`} style={{ background: color }} />
      {label}
    </span>
  );
}
