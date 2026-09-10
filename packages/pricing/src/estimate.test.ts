import { describe, expect, it } from "vitest";
import { estimate, estimateTokens, budgetFor, ceilCents } from "./estimate.js";
import { detectScope } from "./scope.js";
import { interpolate, OUTPUT_TOKENS_BY_LOC, REFERENCE_MONOREPO_CORPUS_TOKENS, TOTAL_CHECKLIST_ITEMS, TOTAL_KNOWN_VECTORS } from "./costs.js";
import { summarizeTokei } from "./tokei.js";
import { CHECKLISTS, VECTOR_GROUPS } from "./scope.js";
import type { ModelsConfig } from "./models.js";

const models: ModelsConfig = {
  default: "test-opus",
  models: [
    { id: "test-opus", label: "Opus", tier: "depth", enabled: true, input_per_mtok: 5, output_per_mtok: 25, cache_read_per_mtok: 0.5, cache_write_per_mtok: 6.25 },
    { id: "test-sonnet", label: "Sonnet", tier: "value", enabled: true, input_per_mtok: 2, output_per_mtok: 10, cache_read_per_mtok: 0.2, cache_write_per_mtok: 2.5 },
  ],
};

describe("corpus constants", () => {
  it("checklist and vector totals match the corpus", () => {
    expect(CHECKLISTS.reduce((n, c) => n + c.items, 0)).toBe(TOTAL_CHECKLIST_ITEMS);
    expect(VECTOR_GROUPS.reduce((n, g) => n + g.count, 0)).toBe(TOTAL_KNOWN_VECTORS);
  });
  it("interpolates the COSTS.md output table", () => {
    expect(interpolate(OUTPUT_TOKENS_BY_LOC, 2000)).toBe(80_000);
    expect(interpolate(OUTPUT_TOKENS_BY_LOC, 500)).toBe(80_000); // clamped
    expect(interpolate(OUTPUT_TOKENS_BY_LOC, 50_000)).toBe(240_000);
    expect(interpolate(OUTPUT_TOKENS_BY_LOC, 35_000)).toBe(195_000); // midpoint 150K..240K
    expect(interpolate(OUTPUT_TOKENS_BY_LOC, 9_999_999)).toBe(800_000);
  });
});

describe("scope detection", () => {
  it("rust-only repo loads 01-07 + always-on, never 14", () => {
    const s = detectScope({ Rust: { code: 1000, comments: 0, blanks: 0, files: 3 } }, { anchorToml: true });
    expect(s.checklists).toEqual(["01", "02", "03", "04", "05", "06", "07", "11", "12", "13", "16", "17", "18"]);
    expect(s.checklists).not.toContain("14");
    expect(s.vectorGroups).toContain("crypto");
    expect(s.vectorGroups).toContain("devops");
    expect(s.vectorGroups).not.toContain("frontend");
    expect(s.itemCount).toBe(519 + 391);
  });
  it("next.js + anchor monorepo loads 08/09/10 too", () => {
    const s = detectScope(
      { Rust: { code: 1, comments: 0, blanks: 0, files: 1 }, TypeScript: { code: 1, comments: 0, blanks: 0, files: 1 }, TSX: { code: 1, comments: 0, blanks: 0, files: 1 } },
      { anchorToml: true, packageJson: true, web: true, backend: true },
    );
    expect(s.checklists).toEqual(expect.arrayContaining(["08", "09", "10"]));
    expect(s.vectorGroups).toEqual(expect.arrayContaining(["backend", "frontend"]));
  });
  it("empty repo still has the always-on set", () => {
    const s = detectScope({});
    expect(s.checklists).toEqual(["11", "12", "13", "16", "17", "18"]);
    expect(s.itemCount).toBe(391);
  });
});

describe("token estimate (COSTS.md formula)", () => {
  it("derives the reference corpus load from the COSTS.md size table", () => {
    // rows 2K..100K: (150K−15K−32K)+(200K−15K−80K)+(430K−15K−320K)+(910K−15K−800K)+(1.7M−15K−1.6M) / 5
    expect(REFERENCE_MONOREPO_CORPUS_TOKENS).toBe(Math.round((103_000 + 105_000 + 95_000 + 95_000 + 85_000) / 5));
  });
  it("2K-LOC rust repo lands below the corpus's full-monorepo 150K input figure", () => {
    const scope = detectScope({ Rust: { code: 2000, comments: 0, blanks: 0, files: 5 } }, { anchorToml: true });
    const t = estimateTokens(2000, scope);
    expect(t.fixedFloor).toBe(15_000);
    expect(t.codeReading).toBe(20_000);
    expect(t.codeOverhead).toBe(12_000); // 0.6 × code
    expect(t.output).toBe(80_000);
    const corpus = t.corpusChecklists + t.corpusKnownVectors + t.corpusReferences + t.corpusTemplatesAndDiscovery;
    expect(corpus).toBeLessThan(REFERENCE_MONOREPO_CORPUS_TOKENS); // narrower scope than the reference monorepo
    expect(t.inputTotal).toBeGreaterThan(90_000);
    expect(t.inputTotal).toBeLessThan(150_000);
  });
  it("the reference monorepo scope reproduces the table's own corpus load", () => {
    const scope = detectScope(
      { Rust: { code: 1, comments: 0, blanks: 0, files: 1 }, TypeScript: { code: 1, comments: 0, blanks: 0, files: 1 }, TSX: { code: 1, comments: 0, blanks: 0, files: 1 } },
      { anchorToml: true, packageJson: true, web: true, backend: true },
    );
    const t = estimateTokens(2000, scope);
    const corpus = t.corpusChecklists + t.corpusKnownVectors + t.corpusReferences + t.corpusTemplatesAndDiscovery;
    expect(Math.abs(corpus - REFERENCE_MONOREPO_CORPUS_TOKENS)).toBeLessThanOrEqual(3); // rounding
  });
  it("input grows by 16 tokens per LOC", () => {
    const scope = detectScope({});
    const a = estimateTokens(1000, scope).inputTotal;
    const b = estimateTokens(2000, scope).inputTotal;
    expect(b - a).toBe(16_000);
  });
});

describe("price", () => {
  it("applies margin and rounds up to cents", () => {
    const e = estimate({ loc: 2000, languages: { Rust: { code: 2000, comments: 0, blanks: 0, files: 5 } }, markers: { anchorToml: true }, model: "test-opus", margin: 2.5, calibration: 1, attestFeeUsdc: 5, models });
    const expectedRaw = (e.tokens.inputTotal * 5 + e.tokens.output * 25) / 1e6;
    expect(e.rawCostUsd).toBeCloseTo(expectedRaw, 8);
    expect(e.priceUsdc).toBe(ceilCents(expectedRaw * 2.5));
    expect(e.attestFeeUsdc).toBe(5);
    expect(e.quickUsdc).toBe(0);
  });
  it("calibration scales the estimate and the budget", () => {
    const base = { loc: 5000, languages: { Rust: { code: 5000, comments: 0, blanks: 0, files: 5 } }, model: "test-sonnet", margin: 2, attestFeeUsdc: 5, models };
    const a = estimate({ ...base, calibration: 1 });
    const b = estimate({ ...base, calibration: 2 });
    expect(b.estCostUsd).toBeCloseTo(a.estCostUsd * 2, 8);
    expect(budgetFor(b, 1.5)).toBeCloseTo(ceilCents(b.estCostUsd * 1.5), 8);
  });
  it("ceilCents rounds up", () => {
    expect(ceilCents(1.001)).toBe(1.01);
    expect(ceilCents(1.0)).toBe(1.0);
    expect(ceilCents(0.1 + 0.2)).toBe(0.3);
  });
});

describe("scope narrowing", () => {
  it("program scope keeps only Rust and drops off-chain checklists", () => {
    const languages = { Rust: { code: 1000, comments: 0, blanks: 0, files: 3 }, TypeScript: { code: 5000, comments: 0, blanks: 0, files: 20 }, JSON: { code: 9000, comments: 0, blanks: 0, files: 4 } };
    const markers = { anchorToml: true, packageJson: true, web: true, backend: true, rustOffchain: true };
    const full = estimate({ loc: 15000, languages, markers, model: "test-opus", margin: 2, attestFeeUsdc: 5, models, scope: "full" });
    const prog = estimate({ loc: 15000, languages, markers, model: "test-opus", margin: 2, attestFeeUsdc: 5, models, scope: "program" });
    expect(prog.tokens.codeReading).toBe(10_000);
    expect(full.tokens.codeReading).toBe(150_000);
    expect(prog.scope.checklists).not.toContain("08");
    expect(prog.scope.checklists).not.toContain("20");
    expect(full.scope.checklists).toContain("10");
    expect(prog.estCostUsd).toBeLessThan(full.estCostUsd);
  });
});

describe("tokei summarizer", () => {
  it("drops docs, lockfiles and vendored dirs", () => {
    const raw = {
      Rust: { blanks: 10, code: 100, comments: 5, reports: [{ name: "./programs/x/src/lib.rs", stats: { blanks: 10, code: 100, comments: 5 } }] },
      JSON: {
        blanks: 0,
        code: 5000,
        comments: 0,
        reports: [
          { name: "./package-lock.json", stats: { blanks: 0, code: 4990, comments: 0 } },
          { name: "./idl.json", stats: { blanks: 0, code: 10, comments: 0 } },
        ],
      },
      TypeScript: { blanks: 0, code: 999, comments: 0, reports: [{ name: "./node_modules/x/index.ts", stats: { blanks: 0, code: 999, comments: 0 } }] },
      Markdown: { blanks: 0, code: 300, comments: 0, reports: [{ name: "./README.md", stats: { blanks: 0, code: 300, comments: 0 } }] },
      Total: { blanks: 0, code: 0, comments: 0, reports: [] },
    };
    const s = summarizeTokei(raw as never);
    expect(s.loc).toBe(110);
    expect(s.files).toBe(2);
    expect(Object.keys(s.languages).sort()).toEqual(["JSON", "Rust"]);
    expect(s.excluded.map((e) => e.language).sort()).toEqual(["JSON", "Markdown", "TypeScript"]);
  });
});
