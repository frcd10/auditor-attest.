import { getModel, loadModels, type ModelPricing, type ModelsConfig } from "./models.js";
import { detectScope, type LanguageMix, type RepoMarkers, type Scope } from "./scope.js";

export type AuditScope = "full" | "program";
export const AUDIT_SCOPES: readonly AuditScope[] = ["full", "program"];

/** Languages that make up the on-chain program surface (corpus `--scope program`). */
const PROGRAM_LANGUAGES = new Set(["Rust"]);

/**
 * Narrow the language mix to what the requested corpus scope reads. `program` keeps the
 * on-chain code only (checklists 01-07 + the always-on set); `full` returns the input.
 */
export function applyScope(languages: LanguageMix, markers: Partial<RepoMarkers>, scope: AuditScope): { loc: number; languages: LanguageMix; markers: Partial<RepoMarkers> } {
  if (scope === "full") return { loc: Object.values(languages).reduce((n, v) => n + v.code, 0), languages, markers };
  const kept: LanguageMix = {};
  for (const [lang, v] of Object.entries(languages)) if (PROGRAM_LANGUAGES.has(lang)) kept[lang] = v;
  const loc = Object.values(kept).reduce((n, v) => n + v.code, 0);
  return { loc, languages: kept, markers: { anchorToml: markers.anchorToml, cargoToml: markers.cargoToml, rustOffchain: false } };
}

/**
 * Token profile of one single-agent run (`/auditor` corpus 7.3.0, Mode 1, linear, Bash
 * read-only), fitted on the eight Claude Opus 5 program-scope runs recorded in
 * docs/calibration.md (356 to 13,344 Rust LOC, $16.0 to $32.2 at list prices). The run
 * is dominated by prompt-cache reads: every turn re-reads the corpus and the code already
 * in context, so cost is mostly a large fixed part plus a gentle slope per line.
 *
 *   output       ≈ 230K + 5 /LOC      (observed 216K–312K)
 *   cache reads  ≈ 14.0M + 1,600 /LOC (observed 11.9M–37.7M; the intercept is set high
 *                                      because small repos vary the most: 12M–20M)
 *   cache writes ≈ 380K + 20 /LOC     (observed 380K–656K)
 *   uncached in  ≈ 1K                 (observed 106–216)
 *
 * SAFETY_FACTOR lifts the fit so every calibration run lands under the estimate (the
 * tightest is Meteora/dynamic-fee-sharing, 1,072 LOC for $22.54), while staying within
 * 1.5× of the cheapest. The figure we show is an upper bound for a normal run, not a mean.
 */
export const SINGLE_AGENT_PROFILE = {
  outputBase: 230_000,
  outputPerLoc: 5,
  cacheReadBase: 14_000_000,
  cacheReadPerLoc: 1_600,
  cacheWriteBase: 380_000,
  cacheWritePerLoc: 20,
  uncachedInput: 1_000,
} as const;

/** Multiplier on the mean fit so that every calibration run lands under the estimate. */
export const SAFETY_FACTOR = 1.4;

/** Extra headroom the user is told to put on the workspace spend limit, on top of the estimate. */
export const LIMIT_HEADROOM = 1.2;

export interface EstimateInput {
  /** Code lines (tokei `code`, after exclusions). */
  loc: number;
  languages: LanguageMix;
  markers?: Partial<RepoMarkers>;
  /** Corpus scope. Default full. `program` narrows loc/languages to the on-chain code. */
  scope?: AuditScope;
  model: string;
  /** Multiplier on the fitted mean. Default PRICING_CALIBRATION env, else SAFETY_FACTOR. */
  calibration?: number;
  models?: ModelsConfig;
}

export interface TokenBreakdown {
  /** Uncached input tokens (tiny: the CLI caches the whole prefix). */
  input: number;
  /** Prompt-cache reads: the corpus + the code re-read on every turn. */
  cacheRead: number;
  /** Prompt-cache writes: new context added across turns. */
  cacheWrite: number;
  output: number;
  /** input + cacheRead + cacheWrite: everything the model read. */
  inputTotal: number;
  /** Lines of code the run reads (after scope narrowing). */
  loc: number;
}

export interface Estimate {
  model: ModelPricing;
  scope: Scope;
  tokens: TokenBreakdown;
  /** Mean-fit cost at the model's list prices, USD. */
  rawCostUsd: number;
  calibration: number;
  /** rawCostUsd × calibration: the figure shown to the user and the basis of the budget cap. */
  estCostUsd: number;
  /** estCostUsd × LIMIT_HEADROOM, rounded up to the dollar: what to set as the workspace spend limit. */
  suggestedLimitUsd: number;
  /** Typical wall-clock, minutes (observed 15–22 for Opus 5, up to 36 for Fable). */
  typicalMinutes: [number, number];
}

export function envNumber(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`env ${name} must be a number, got ${v}`);
  return n;
}

export function ceilCents(x: number): number {
  return Math.ceil(x * 100 - 1e-9) / 100;
}

export function estimateTokens(loc: number): TokenBreakdown {
  const p = SINGLE_AGENT_PROFILE;
  const l = Math.max(0, loc);
  const input = p.uncachedInput;
  const cacheRead = Math.round(p.cacheReadBase + p.cacheReadPerLoc * l);
  const cacheWrite = Math.round(p.cacheWriteBase + p.cacheWritePerLoc * l);
  const output = Math.round(p.outputBase + p.outputPerLoc * l);
  return { input, cacheRead, cacheWrite, output, inputTotal: input + cacheRead + cacheWrite, loc: l };
}

export function estimate(input: EstimateInput): Estimate {
  const cfg = input.models ?? loadModels();
  const model = getModel(input.model, cfg);
  const narrowed = applyScope(input.languages, input.markers ?? {}, input.scope ?? "full");
  const loc = input.scope === "program" ? narrowed.loc : input.loc;
  const scope = detectScope(narrowed.languages, narrowed.markers);
  const tokens = estimateTokens(loc);
  const rawCostUsd =
    (tokens.input * model.input_per_mtok +
      tokens.cacheRead * model.cache_read_per_mtok +
      tokens.cacheWrite * model.cache_write_per_mtok +
      tokens.output * model.output_per_mtok) /
    1_000_000;
  const calibration = input.calibration ?? envNumber("PRICING_CALIBRATION", SAFETY_FACTOR);
  const estCostUsd = ceilCents(rawCostUsd * calibration);
  return {
    model,
    scope,
    tokens,
    rawCostUsd,
    calibration,
    estCostUsd,
    suggestedLimitUsd: Math.ceil(estCostUsd * LIMIT_HEADROOM),
    typicalMinutes: model.tier === "max" ? [30, 40] : [15, 25],
  };
}

/** Hard spend cap handed to the runner (USD). */
export function budgetFor(est: Pick<Estimate, "estCostUsd">, factor = envNumber("BUDGET_FACTOR", LIMIT_HEADROOM)): number {
  return Math.max(0.5, ceilCents(est.estCostUsd * factor));
}
