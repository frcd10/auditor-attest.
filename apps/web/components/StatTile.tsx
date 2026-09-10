export function StatTile({ label, value, accent = "gradient", hint }: { label: string; value: string; accent?: "gradient" | "critical" | "high" | "medium" | "low" | "plain"; hint?: string }) {
  const color = accent === "gradient" ? undefined : accent === "plain" ? "#fff" : `var(--${accent})`;
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className={`mt-2 text-3xl font-bold tracking-tight sm:text-4xl ${accent === "gradient" ? "gradient-text" : ""}`} style={color ? { color } : undefined}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--dim)]">{hint}</div>}
    </div>
  );
}
