export interface Step {
  label: string;
  state: "done" | "current" | "todo" | "failed";
}

export function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {steps.map((s, i) => {
        const dot =
          s.state === "done" ? "bg-[var(--green)] text-black" : s.state === "current" ? "bg-[var(--purple)] text-white animate-pulse" : s.state === "failed" ? "bg-[var(--critical)] text-white" : "bg-white/10 text-[var(--muted)]";
        const text = s.state === "todo" ? "text-[var(--dim)]" : "text-white";
        return (
          <li key={s.label} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${dot}`}>{s.state === "done" ? "✓" : i + 1}</span>
            <span className={`font-medium ${text}`}>{s.label}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-[var(--border)]" />}
          </li>
        );
      })}
    </ol>
  );
}
