/**
 * Sandbox runner. Lives inside the ephemeral job container.
 *
 *  1. Read the job spec from stdin (JSON). The API key arrives here and only here.
 *  2. Drive the `auditor` plugin (mounted at /corpus) through the Claude Agent SDK, one
 *     session, sequential user turns: intake --auto → audit-cycle → finalize.
 *  3. Enforce the USD budget (SDK maxBudgetUsd) and a wall-clock timeout.
 *  4. Copy the report byte-for-byte to /out/report.md, write /out/run.json (usage per
 *     model call + per-turn results) and /out/status.json.
 *
 * Progress goes to stdout as JSON lines. The key is never logged.
 */
import { query, type Options, type SDKMessage, type SDKResultMessage, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { validateSpec, type JobSpec } from "./spec.js";

type Status = "ok" | "failed" | "failed_budget" | "failed_timeout" | "failed_no_report";

const startedAt = new Date();
let logPath = "/out/runner.log";

function emit(event: Record<string, unknown>) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event });
  process.stdout.write(line + "\n");
  try {
    appendFileSync(logPath, line + "\n");
  } catch {
    /* /out may not be writable yet */
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks).toString("utf8");
}

/** Async iterable of user messages that yields the next turn only after the previous one produced a result. */
function makePromptStream(turns: JobSpec["turns"], waitForTurn: (i: number) => Promise<void>): AsyncIterable<SDKUserMessage> {
  return {
    async *[Symbol.asyncIterator]() {
      for (let i = 0; i < turns.length; i++) {
        if (i > 0) await waitForTurn(i - 1);
        emit({ t: "turn_start", index: i, name: turns[i]!.name });
        yield {
          type: "user",
          message: { role: "user", content: turns[i]!.prompt },
          parent_tool_use_id: null,
        } satisfies SDKUserMessage;
      }
      await waitForTurn(turns.length - 1);
    },
  };
}

function findReport(workDir: string): string | null {
  // Prefer /work/audit_<n>/REPORT.md with the highest n.
  const candidates: { path: string; n: number }[] = [];
  for (const entry of safeReaddir(workDir)) {
    const m = /^audit_(\d+)$/.exec(entry);
    if (!m) continue;
    const p = join(workDir, entry, "REPORT.md");
    if (existsSync(p)) candidates.push({ path: p, n: Number(m[1]) });
  }
  if (candidates.length) return candidates.sort((a, b) => b.n - a.n)[0]!.path;
  // Fallback: any REPORT.md / report.md under /work (depth ≤ 4, skipping home/tmp).
  const stack: { dir: string; depth: number }[] = [{ dir: workDir, depth: 0 }];
  const hits: string[] = [];
  while (stack.length) {
    const { dir, depth } = stack.pop()!;
    for (const e of safeReaddir(dir)) {
      if (dir === workDir && (e === "home" || e === "tmp")) continue;
      const p = join(dir, e);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory() && depth < 4) stack.push({ dir: p, depth: depth + 1 });
      else if (/^report\.md$/i.test(e)) hits.push(p);
    }
  }
  return hits.sort()[0] ?? null;
}

function safeReaddir(d: string): string[] {
  try {
    return readdirSync(d);
  } catch {
    return [];
  }
}

async function main() {
  const spec = validateSpec(JSON.parse(await readStdin()));
  const targetDir = spec.paths?.target ?? "/target";
  const corpusDir = spec.paths?.corpus ?? "/corpus";
  const workDir = spec.paths?.work ?? "/work";
  const outDir = spec.paths?.out ?? "/out";
  logPath = join(outDir, "runner.log");
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(workDir, "home"), { recursive: true });
  mkdirSync(join(workDir, "tmp"), { recursive: true });

  emit({ t: "start", jobId: spec.jobId, model: spec.model, maxBudgetUsd: spec.maxBudgetUsd, turns: spec.turns.map((t) => t.name), target: targetDir, corpus: corpusDir });
  if (!existsSync(join(corpusDir, ".claude-plugin", "plugin.json"))) throw new Error(`corpus plugin manifest missing at ${corpusDir}`);
  if (!existsSync(targetDir)) throw new Error(`target missing at ${targetDir}`);

  // Environment for the Claude Code subprocess. Explicit allowlist; nothing inherited.
  const env: Record<string, string | undefined> = {
    PATH: process.env.PATH,
    HOME: join(workDir, "home"),
    TMPDIR: join(workDir, "tmp"),
    CLAUDE_CODE_TMPDIR: join(workDir, "tmp"),
    ANTHROPIC_API_KEY: spec.apiKey,
    // Pin every alias the corpus's agents use (opus/sonnet/haiku) to the job's model so no
    // subagent can escalate to a pricier model than the one that was quoted.
    ANTHROPIC_DEFAULT_OPUS_MODEL: spec.model,
    ANTHROPIC_DEFAULT_SONNET_MODEL: spec.model,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: spec.model,
    CLAUDE_CODE_SUBAGENT_MODEL: spec.model,
    DISABLE_TELEMETRY: "1",
    DISABLE_ERROR_REPORTING: "1",
    DISABLE_AUTOUPDATER: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    CLAUDE_CODE_DISABLE_ARTIFACT: "1",
    ENABLE_CLAUDEAI_MCP_SERVERS: "false",
    CLAUDE_AGENT_SDK_CLIENT_APP: "auditor-attest/0.1.0",
    CI: "1",
    NO_COLOR: "1",
    GIT_TERMINAL_PROMPT: "0",
  };
  if (spec.proxyUrl) {
    env.HTTPS_PROXY = spec.proxyUrl;
    env.https_proxy = spec.proxyUrl;
    env.NO_PROXY = "localhost,127.0.0.1";
  }

  const abort = new AbortController();
  const timeoutMs = spec.timeoutMinutes * 60_000;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    emit({ t: "timeout", minutes: spec.timeoutMinutes });
    abort.abort();
  }, timeoutMs);

  // Turn gating.
  const turnResults: (SDKResultMessage | null)[] = spec.turns.map(() => null);
  const waiters: (() => void)[][] = spec.turns.map(() => []);
  const waitForTurn = (i: number) =>
    new Promise<void>((resolve) => {
      if (turnResults[i]) resolve();
      else waiters[i]!.push(resolve);
    });
  let turnIndex = 0;

  const options: Options = {
    cwd: workDir,
    model: spec.model,
    env,
    plugins: [{ type: "local", path: corpusDir, skipMcpDiscovery: true }],
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    permissionPrompts: "none",
    disallowedTools: spec.disallowedTools,
    maxBudgetUsd: spec.maxBudgetUsd,
    maxTurns: spec.maxTurns ?? 2000,
    settingSources: [],
    persistSession: false,
    includePartialMessages: false,
    abortController: abort,
    systemPrompt: { type: "preset", preset: "claude_code", append: spec.systemAppend, snapshot: true },
    ...(spec.effort ? { effort: spec.effort } : {}),
  };

  const calls: Record<string, unknown>[] = [];
  let init: Record<string, unknown> | null = null;
  let lastResult: SDKResultMessage | null = null;
  let fatal: string | null = null;

  try {
    for await (const msg of query({ prompt: makePromptStream(spec.turns, waitForTurn), options }) as AsyncIterable<SDKMessage>) {
      switch (msg.type) {
        case "system": {
          if (msg.subtype === "init") {
            init = {
              claude_code_version: msg.claude_code_version,
              model: msg.model,
              plugins: msg.plugins,
              slash_commands: msg.slash_commands,
              tools: msg.tools,
              permissionMode: msg.permissionMode,
              apiKeySource: msg.apiKeySource,
            };
            emit({ t: "init", ...init });
            const hasAuditor = (msg.plugins ?? []).some((p) => p.name === "auditor");
            if (!hasAuditor) emit({ t: "warn", message: "auditor plugin not reported in init.plugins" });
          }
          break;
        }
        case "assistant": {
          const m = msg.message as unknown as { model?: string; usage?: Record<string, number>; content?: { type: string; name?: string; text?: string }[] };
          if (m.usage) {
            calls.push({
              ts: new Date().toISOString(),
              turn: turnIndex,
              model: m.model ?? null,
              parent_tool_use_id: msg.parent_tool_use_id ?? null,
              input_tokens: m.usage.input_tokens ?? 0,
              output_tokens: m.usage.output_tokens ?? 0,
              cache_read_input_tokens: m.usage.cache_read_input_tokens ?? 0,
              cache_creation_input_tokens: m.usage.cache_creation_input_tokens ?? 0,
            });
          }
          for (const block of m.content ?? []) {
            if (block.type === "tool_use") emit({ t: "tool", name: block.name, turn: turnIndex });
            else if (block.type === "text" && block.text) emit({ t: "text", turn: turnIndex, preview: block.text.slice(0, 300) });
          }
          break;
        }
        case "result": {
          lastResult = msg;
          emit({
            t: "turn_result",
            index: turnIndex,
            name: spec.turns[turnIndex]?.name,
            subtype: msg.subtype,
            is_error: msg.is_error,
            num_turns: msg.num_turns,
            duration_ms: msg.duration_ms,
            total_cost_usd: msg.total_cost_usd,
            errors: "errors" in msg ? msg.errors : undefined,
          });
          turnResults[turnIndex] = msg;
          for (const w of waiters[turnIndex]!) w();
          waiters[turnIndex] = [];
          turnIndex++;
          if (msg.subtype === "error_max_budget_usd") {
            // Budget hit: stop feeding turns; the stream will end after this result.
            for (let i = turnIndex; i < spec.turns.length; i++) {
              turnResults[i] = msg;
              for (const w of waiters[i]!) w();
            }
            abort.abort();
          }
          break;
        }
        default:
          break;
      }
    }
  } catch (err) {
    fatal = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    if (!timedOut && !(lastResult && lastResult.subtype === "error_max_budget_usd")) emit({ t: "error", message: fatal });
  } finally {
    clearTimeout(timer);
  }

  // Locate and copy the report.
  const reportPath = findReport(workDir);
  let reportCopied = false;
  if (reportPath) {
    const bytes = readFileSync(reportPath);
    writeFileSync(join(outDir, "report.md"), bytes);
    reportCopied = true;
    emit({ t: "report", from: reportPath, bytes: bytes.length });
  }
  // Keep the auditor's intermediate artifacts for the operator (intake, threat model, worksheets).
  for (const entry of safeReaddir(workDir)) {
    if (/^audit_\d+$/.test(entry)) {
      try {
        cpSync(join(workDir, entry), join(outDir, "artifacts", entry), { recursive: true });
      } catch (e) {
        emit({ t: "warn", message: `could not copy ${entry}: ${(e as Error).message}` });
      }
    }
  }

  const budgetHit = turnResults.some((r) => r?.subtype === "error_max_budget_usd") || lastResult?.subtype === "error_max_budget_usd";
  let status: Status;
  if (budgetHit) status = "failed_budget";
  else if (timedOut) status = "failed_timeout";
  else if (!reportCopied) status = "failed_no_report";
  else if (fatal || (lastResult && (lastResult.is_error || lastResult.subtype !== "success"))) status = "failed";
  else status = "ok";

  const finishedAt = new Date();
  const run = {
    job_id: spec.jobId,
    model: spec.model,
    status,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    max_budget_usd: spec.maxBudgetUsd,
    init,
    turns: spec.turns.map((t, i) => {
      const r = turnResults[i];
      return r
        ? { name: t.name, subtype: r.subtype, is_error: r.is_error, num_turns: r.num_turns, duration_ms: r.duration_ms, total_cost_usd_cumulative: r.total_cost_usd }
        : { name: t.name, subtype: null };
    }),
    // Cumulative across the session: read the last result, do not sum.
    usage_main_loop: lastResult?.usage ?? null,
    model_usage: lastResult?.modelUsage ?? null,
    total_cost_usd: lastResult?.total_cost_usd ?? null,
    calls,
    report_source: reportPath,
    error: fatal,
  };
  writeFileSync(join(outDir, "run.json"), JSON.stringify(run, null, 2));
  writeFileSync(join(outDir, "status.json"), JSON.stringify({ status, error: fatal, report: reportCopied }, null, 2));
  emit({ t: "done", status, total_cost_usd: run.total_cost_usd, duration_ms: run.duration_ms });
  process.exit(status === "ok" ? 0 : 2);
}

main().catch((err) => {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  emit({ t: "fatal", message });
  try {
    mkdirSync("/out", { recursive: true });
    writeFileSync("/out/status.json", JSON.stringify({ status: "failed", error: message, report: false }));
  } catch {
    /* ignore */
  }
  process.exit(3);
});
