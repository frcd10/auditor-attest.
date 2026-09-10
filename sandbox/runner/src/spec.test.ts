import { describe, expect, it } from "vitest";
import { validateSpec } from "./spec.js";

const good = {
  jobId: "j1",
  model: "claude-opus-5",
  apiKey: "k",
  maxBudgetUsd: 10,
  systemAppend: "rules",
  turns: [{ name: "intake", prompt: "/auditor:intake /target --auto" }],
  disallowedTools: ["WebFetch"],
  timeoutMinutes: 60,
};

describe("validateSpec", () => {
  it("accepts a valid spec", () => {
    const s = validateSpec(good);
    expect(s.jobId).toBe("j1");
    expect(s.turns.length).toBe(1);
    expect(s.timeoutMinutes).toBe(60);
  });
  it("rejects missing key, budget and turns", () => {
    expect(() => validateSpec({ ...good, apiKey: "" })).toThrow(/apiKey/);
    expect(() => validateSpec({ ...good, maxBudgetUsd: 0 })).toThrow(/maxBudgetUsd/);
    expect(() => validateSpec({ ...good, turns: [] })).toThrow(/turns/);
    expect(() => validateSpec("nope")).toThrow();
  });
});
