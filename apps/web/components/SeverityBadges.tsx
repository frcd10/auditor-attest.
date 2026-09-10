const TIERS = [
  ["critical", "Critical", "var(--critical)"],
  ["high", "High", "var(--high)"],
  ["medium", "Medium", "var(--medium)"],
  ["low", "Low", "var(--low)"],
  ["info", "Info", "var(--info)"],
] as const;

export type Counts = Record<(typeof TIERS)[number][0], number>;

export function SeverityBadges({ counts, size = "md" }: { counts: Counts; size?: "sm" | "md" }) {
  const pad = size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <div className="flex flex-wrap gap-2">
      {TIERS.map(([key, label, color]) => (
        <span key={key} className={`inline-flex items-center gap-1.5 rounded-full border ${pad} font-medium`} style={{ borderColor: color, color, background: "rgba(0,0,0,0.4)" }}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {label} <span className="mono">{counts[key]}</span>
        </span>
      ))}
    </div>
  );
}

/** Big-number variant for report headers. */
export function SeverityTiles({ counts }: { counts: Counts }) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      {TIERS.map(([key, label, color]) => (
        <div key={key} className="card p-3 text-center sm:p-4">
          <div className="text-2xl font-bold sm:text-3xl" style={{ color }}>
            {counts[key]}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-[var(--muted)] sm:text-xs">{label}</div>
        </div>
      ))}
    </div>
  );
}
