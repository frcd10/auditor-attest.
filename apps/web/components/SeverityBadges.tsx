const TIERS = [
  ["critical", "Critical", "var(--critical)"],
  ["high", "High", "var(--high)"],
  ["medium", "Medium", "var(--medium)"],
  ["low", "Low", "var(--low)"],
  ["info", "Info", "var(--info)"],
] as const;

export function SeverityBadges({ counts, size = "md" }: { counts: Record<(typeof TIERS)[number][0], number>; size?: "sm" | "md" }) {
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <div className="flex flex-wrap gap-2">
      {TIERS.map(([key, label, color]) => (
        <span key={key} className={`inline-flex items-center gap-1.5 rounded-full border ${pad} font-medium`} style={{ borderColor: color, color }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
          {label} <span className="mono">{counts[key]}</span>
        </span>
      ))}
    </div>
  );
}
