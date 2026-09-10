import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface ModelPricing {
  id: string;
  label: string;
  tier: string;
  enabled: boolean;
  input_per_mtok: number;
  output_per_mtok: number;
  cache_read_per_mtok: number;
  cache_write_per_mtok: number;
  context_tokens?: number;
  notes?: string;
}

export interface ModelsConfig {
  default: string;
  updated?: string;
  models: ModelPricing[];
}

/** Walk up from `from` until a directory containing pnpm-workspace.yaml is found. */
export function findRepoRoot(from: string = process.cwd()): string {
  let dir = resolve(from);
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(from);
}

let cached: { path: string; config: ModelsConfig } | null = null;

export function loadModels(path?: string): ModelsConfig {
  const p = path ?? process.env.MODELS_CONFIG_ABS ?? resolve(findRepoRoot(), process.env.MODELS_CONFIG ?? "config/models.json");
  if (cached && cached.path === p) return cached.config;
  const raw = JSON.parse(readFileSync(/* turbopackIgnore: true */ p, "utf8")) as ModelsConfig;
  if (!raw.models?.length) throw new Error(`models config at ${p} has no models`);
  cached = { path: p, config: raw };
  return raw;
}

export function getModel(id: string, cfg: ModelsConfig = loadModels()): ModelPricing {
  const m = cfg.models.find((x) => x.id === id);
  if (!m) throw new Error(`unknown model id: ${id}`);
  return m;
}

export function enabledModels(cfg: ModelsConfig = loadModels()): ModelPricing[] {
  return cfg.models.filter((m) => m.enabled);
}

export function defaultModelId(cfg: ModelsConfig = loadModels()): string {
  return cfg.default;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

/** Cost in USD for a usage record at a model's rates. */
export function costOf(usage: Usage, m: ModelPricing): number {
  const per = 1_000_000;
  return (
    (usage.input_tokens * m.input_per_mtok +
      usage.output_tokens * m.output_per_mtok +
      (usage.cache_read_input_tokens ?? 0) * m.cache_read_per_mtok +
      (usage.cache_creation_input_tokens ?? 0) * m.cache_write_per_mtok) /
    per
  );
}
