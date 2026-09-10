/** Job spec delivered on stdin as a single JSON document. Never written to disk. */
export interface JobSpec {
  jobId: string;
  model: string;
  /** Per-job API key: the service key or the submitter's BYOK key. Held in memory only. */
  apiKey: string;
  maxBudgetUsd: number;
  maxTurns?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** Appended to the Claude Code preset system prompt. */
  systemAppend: string;
  /** User turns sent sequentially in one session. */
  turns: { name: string; prompt: string }[];
  disallowedTools: string[];
  /** Wall-clock limit; the query is aborted when exceeded. */
  timeoutMinutes: number;
  paths?: { target?: string; corpus?: string; work?: string; out?: string };
  proxyUrl?: string;
}

export function validateSpec(raw: unknown): JobSpec {
  if (!raw || typeof raw !== "object") throw new Error("spec must be an object");
  const s = raw as Record<string, unknown>;
  const str = (k: string) => {
    if (typeof s[k] !== "string" || !(s[k] as string).length) throw new Error(`spec.${k} must be a non-empty string`);
    return s[k] as string;
  };
  const num = (k: string, min: number) => {
    if (typeof s[k] !== "number" || !(s[k] as number >= min)) throw new Error(`spec.${k} must be a number >= ${min}`);
    return s[k] as number;
  };
  const turns = s.turns;
  if (!Array.isArray(turns) || turns.length === 0) throw new Error("spec.turns must be a non-empty array");
  for (const t of turns) {
    if (!t || typeof t.name !== "string" || typeof t.prompt !== "string" || !t.prompt) throw new Error("each turn needs name and prompt");
  }
  const disallowed = Array.isArray(s.disallowedTools) ? (s.disallowedTools as unknown[]).filter((x) => typeof x === "string") : [];
  return {
    jobId: str("jobId"),
    model: str("model"),
    apiKey: str("apiKey"),
    maxBudgetUsd: num("maxBudgetUsd", 0.01),
    maxTurns: typeof s.maxTurns === "number" ? (s.maxTurns as number) : undefined,
    effort: typeof s.effort === "string" ? (s.effort as JobSpec["effort"]) : undefined,
    systemAppend: typeof s.systemAppend === "string" ? (s.systemAppend as string) : "",
    turns: turns as JobSpec["turns"],
    disallowedTools: disallowed as string[],
    timeoutMinutes: typeof s.timeoutMinutes === "number" ? (s.timeoutMinutes as number) : 180,
    paths: (s.paths as JobSpec["paths"]) ?? {},
    proxyUrl: typeof s.proxyUrl === "string" ? (s.proxyUrl as string) : undefined,
  };
}
