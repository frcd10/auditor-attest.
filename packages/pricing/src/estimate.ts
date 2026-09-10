import {
  CORPUS_FULL_TOKENS,
  FIXED_FLOOR_INPUT_TOKENS,
  INPUT_TOKENS_BY_LOC,
  INPUT_TOKENS_PER_LOC,
  OUTPUT_TOKENS_BY_LOC,
  REFERENCE_MONOREPO_CORPUS_TOKENS,
  VARIABLE_MULTIPLIER,
  interpolate,
} from "./costs.js";
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

export interface EstimateInput {
  /** Code lines (tokei `code`, after exclusions). */
  loc: number;
  languages: LanguageMix;
  markers?: Partial<RepoMarkers>;
  /** Corpus scope. Default full. `program` narrows loc/languages to the on-chain code. */
  scope?: AuditScope;
  model: string;
  /** Price = cost × margin. Default from MARGIN env (2.5). */
  margin?: number;
  /** Post-calibration multiplier on the raw estimate. Default PRICING_CALIBRATION env (1.0). */
  calibration?: number;
  /** BYOK flat fee in USDC. Default ATTEST_FEE_USDC env. */
  attestFeeUsdc?: number;
  models?: ModelsConfig;
}

export interface TokenBreakdown {
  fixedFloor: number;
  corpusChecklists: number;
  corpusKnownVectors: number;
  corpusReferences: number;
  corpusTemplatesAndDiscovery: number;
  codeReading: number;
  codeOverhead: number; // cross-ref + grep + checkpoints (0.6× code)
  inputTotal: number;
  output: number;
  /** COSTS.md table interpolation, for display only. */
  corpusTableInput: number;
}

export interface Estimate {
  model: ModelPricing;
  scope: Scope;
  tokens: TokenBreakdown;
  /** Raw formula cost, USD. */
  rawCostUsd: number;
  calibration: number;
  /** rawCostUsd × calibration. This is what the budget cap derives from. */
  estCostUsd: number;
  margin: number;
  /** Standard tier price in USDC, rounded up to cents. */
  priceUsdc: number;
  /** BYOK tier price in USDC. */
  attestFeeUsdc: number;
  /** Estimate for the free tier: always 0. */
  quickUsdc: 0;
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

/**
 * Weight of each corpus component for a scope, in upper-bound tokens (COSTS.md § Variable
 * Cost). References load per grep marker, unknown before the audit reads the code, so they
 * scale with the checklist fraction; audit-cycle touches nearly every template/discovery
 * file, so that component is always full.
 */
function corpusWeights(scope: Scope) {
  return {
    checklists: CORPUS_FULL_TOKENS.checklists * scope.checklistFraction,
    knownVectors: CORPUS_FULL_TOKENS.knownVectors * scope.vectorFraction,
    references: CORPUS_FULL_TOKENS.references * scope.checklistFraction,
    templatesAndDiscovery: CORPUS_FULL_TOKENS.templatesAndDiscovery,
  };
}

/** Scope of the COSTS.md reference monorepo: Anchor program + TS backend + Next.js web. */
const REFERENCE_SCOPE = detectScope(
  { Rust: { code: 1, comments: 0, blanks: 0, files: 1 }, TypeScript: { code: 1, comments: 0, blanks: 0, files: 1 }, TSX: { code: 1, comments: 0, blanks: 0, files: 1 } },
  { anchorToml: true, packageJson: true, web: true, backend: true },
);
const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);
const REFERENCE_WEIGHT = sum(corpusWeights(REFERENCE_SCOPE));

export function estimateTokens(loc: number, scope: Scope): TokenBreakdown {
  const codeReading = Math.round(loc * INPUT_TOKENS_PER_LOC);
  const codeOverhead = Math.round(codeReading * (VARIABLE_MULTIPLIER - 1));
  // Scale the corpus's measured load for its reference monorepo by this repo's in-scope share.
  const w = corpusWeights(scope);
  const wTotal = sum(w);
  const corpusTotal = REFERENCE_MONOREPO_CORPUS_TOKENS * (wTotal / REFERENCE_WEIGHT);
  const part = (x: number) => Math.round(corpusTotal * (x / wTotal));
  const corpusChecklists = part(w.checklists);
  const corpusKnownVectors = part(w.knownVectors);
  const corpusReferences = part(w.references);
  const corpusTemplatesAndDiscovery = part(w.templatesAndDiscovery);
  const inputTotal =
    FIXED_FLOOR_INPUT_TOKENS +
    corpusChecklists +
    corpusKnownVectors +
    corpusReferences +
    corpusTemplatesAndDiscovery +
    codeReading +
    codeOverhead;
  const output = interpolate(OUTPUT_TOKENS_BY_LOC, loc);
  return {
    fixedFloor: FIXED_FLOOR_INPUT_TOKENS,
    corpusChecklists,
    corpusKnownVectors,
    corpusReferences,
    corpusTemplatesAndDiscovery,
    codeReading,
    codeOverhead,
    inputTotal,
    output,
    corpusTableInput: interpolate(INPUT_TOKENS_BY_LOC, loc),
  };
}

export function estimate(input: EstimateInput): Estimate {
  const cfg = input.models ?? loadModels();
  const model = getModel(input.model, cfg);
  const narrowed = applyScope(input.languages, input.markers ?? {}, input.scope ?? "full");
  const loc = input.scope === "program" ? narrowed.loc : input.loc;
  const scope = detectScope(narrowed.languages, narrowed.markers);
  const tokens = estimateTokens(loc, scope);
  const rawCostUsd =
    (tokens.inputTotal * model.input_per_mtok + tokens.output * model.output_per_mtok) / 1_000_000;
  const calibration = input.calibration ?? envNumber("PRICING_CALIBRATION", 1.0);
  const margin = input.margin ?? envNumber("MARGIN", 2.5);
  const attestFeeUsdc = input.attestFeeUsdc ?? envNumber("ATTEST_FEE_USDC", 5);
  const estCostUsd = rawCostUsd * calibration;
  return {
    model,
    scope,
    tokens,
    rawCostUsd,
    calibration,
    estCostUsd,
    margin,
    priceUsdc: ceilCents(estCostUsd * margin),
    attestFeeUsdc: ceilCents(attestFeeUsdc),
    quickUsdc: 0,
  };
}

/** Hard spend cap handed to the sandbox. */
export function budgetFor(est: Pick<Estimate, "estCostUsd">, factor = envNumber("BUDGET_FACTOR", 1.5)): number {
  return Math.max(0.5, ceilCents(est.estCostUsd * factor));
}
