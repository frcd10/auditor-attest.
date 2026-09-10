import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseReport, parseSeverityCell } from "./parse.js";
import { redactReport } from "./redact.js";
import { effectiveVisibility, redactUntilFor } from "./visibility.js";
import { parseGitHubUrl } from "./github.js";
import { sha256Hex } from "./hash.js";

const fixtures = resolve(import.meta.dirname, "../fixtures");
const client = readFileSync(resolve(fixtures, "client-sample.md"), "utf8");
const internal = readFileSync(resolve(fixtures, "internal-sample.md"), "utf8");

describe("parse: client report (audit-cycle template)", () => {
  const p = parseReport(client);
  it("detects format and counts findings by tier", () => {
    expect(p.format).toBe("client");
    expect(p.counts).toEqual({ critical: 1, high: 1, medium: 1, low: 1, info: 1 });
    expect(p.declaredCounts).toEqual({ critical: 1, high: 1, medium: 1, low: 1, info: 1 });
    expect(p.warnings.filter((w) => w.includes("≠"))).toEqual([]);
  });
  it("extracts finding fields", () => {
    const f = p.findings.find((x) => x.id === "AUD-01")!;
    expect(f.title).toBe("Missing owner check allows draining any vault");
    expect(f.tier).toBe("critical");
    expect(f.score).toBe(10);
    expect(f.status).toBe("Open");
    expect(f.category).toContain("Access Control");
    expect(f.location).toContain("withdraw.rs");
    expect(p.findings.map((x) => x.id)).toEqual(["AUD-01", "AUD-02", "AUD-03", "AUD-04", "AUD-05"]);
  });
  it("computes highest severity and metadata", () => {
    expect(p.highestSeverity).toBe(10);
    expect(p.riskScore).toBeNull();
    expect(p.meta.commit).toBe("0123456789abcdef0123456789abcdef01234567");
    expect(p.meta.date).toBe("2026-09-02");
  });
});

describe("parse: internal report (report-template)", () => {
  const p = parseReport(internal);
  it("detects format, counts and metrics", () => {
    expect(p.format).toBe("internal");
    expect(p.counts).toEqual({ critical: 0, high: 1, medium: 1, low: 0, info: 0 });
    expect(p.declaredCounts).toEqual({ critical: 0, high: 1, medium: 1, low: 0, info: 0 });
    expect(p.highestSeverity).toBe(8);
    expect(p.riskScore).toBe(8);
    expect(p.metrics.totalItems).toBe(910);
    expect(p.metrics.pass).toBe(880);
    expect(p.meta.repository).toBe("example-org/example-vault");
    expect(p.meta.scope).toBe("PROGRAM");
  });
  it("parses [F-NNN] headings and numeric severity cells", () => {
    expect(p.findings.map((f) => [f.id, f.score])).toEqual([
      ["F-001", 8],
      ["F-002", 5],
    ]);
    expect(p.findings[0]!.location).toBe("programs/vault/src/state.rs:88");
  });
});

describe("severity cell parsing", () => {
  it("handles both layouts", () => {
    expect(parseSeverityCell("🔴 Critical (internal: 10)")).toEqual({ tier: "critical", score: 10 });
    expect(parseSeverityCell("8 — 🟠 HIGH")).toEqual({ tier: "high", score: 8 });
    expect(parseSeverityCell("🟡 Medium")).toEqual({ tier: "medium", score: null });
    expect(parseSeverityCell("⚪ Informational (internal: 1)")).toEqual({ tier: "info", score: 1 });
    expect(parseSeverityCell("n/a")).toBeNull();
  });
});

describe("redaction", () => {
  const p = parseReport(client);
  const r = redactReport(client, p, { redactUntil: new Date("2026-12-01T00:00:00Z") });
  it("removes Critical/High titles, descriptions and locations everywhere", () => {
    expect(r).not.toContain("Missing owner check allows draining any vault");
    expect(r).not.toContain("Unchecked arithmetic in fee accrual");
    expect(r).not.toContain("withdraw.rs#L42");
    expect(r).not.toContain("state.rs:88");
    expect(r).not.toContain("permissionless vault drain"); // key takeaway bullet
    expect(r).not.toContain("never constrains the destination");
  });
  it("keeps ids, severities, counts and lower-severity findings", () => {
    expect(r).toContain("AUD-01");
    expect(r).toContain("AUD-02");
    expect(r).toContain("| 🔴 Critical         | 1 ");
    expect(r).toContain("Pause flag not enforced on withdraw");
    expect(r).toContain("Redundant rent check");
    expect(r).toContain("2026-12-01");
    expect(r).toContain("Details withheld");
  });
  it("redacted output still parses with the same counts", () => {
    const p2 = parseReport(r);
    expect(p2.counts).toEqual(p.counts);
    expect(p2.findings.find((f) => f.id === "AUD-01")!.title).toBe("[redacted]");
  });
  it("is a no-op when nothing is Critical/High", () => {
    const only = internal.replace("8 — 🟠 HIGH", "5 — 🟡 MEDIUM");
    const pp = parseReport(only);
    expect(redactReport(only, pp)).toBe(only);
  });
});

describe("effective visibility", () => {
  const now = new Date("2026-09-10T00:00:00Z");
  it("private is always private", () => {
    expect(effectiveVisibility({ visibility: "private", submitterVerified: true }, now)).toBe("private");
  });
  it("verified maintainer publishes everything", () => {
    expect(effectiveVisibility({ visibility: "public", submitterVerified: true }, now)).toBe("public");
  });
  it("unverified public is redacted until ack or 90 days", () => {
    const created = new Date("2026-09-01T00:00:00Z");
    const until = redactUntilFor(created);
    expect(until.toISOString()).toBe("2026-11-30T00:00:00.000Z");
    expect(effectiveVisibility({ visibility: "public", submitterVerified: false, redactUntil: until }, now)).toBe("public_redacted");
    expect(effectiveVisibility({ visibility: "public", submitterVerified: false, redactUntil: until }, new Date("2026-11-30T00:00:01Z"))).toBe("public");
    expect(effectiveVisibility({ visibility: "public", submitterVerified: false, redactUntil: until, maintainerAckAt: new Date("2026-09-05") }, now)).toBe("public");
  });
});

describe("github url parsing", () => {
  it("accepts the common forms", () => {
    expect(parseGitHubUrl("https://github.com/solanabr/auditor-skill")).toEqual({ owner: "solanabr", repo: "auditor-skill", ref: null, url: "https://github.com/solanabr/auditor-skill" });
    expect(parseGitHubUrl("github.com/a/b.git")?.repo).toBe("b");
    expect(parseGitHubUrl("https://github.com/a/b/tree/feat/x")?.ref).toBe("feat/x");
    expect(parseGitHubUrl("git@github.com:a/b.git")?.owner).toBe("a");
  });
  it("rejects non-github and malformed input", () => {
    expect(parseGitHubUrl("https://gitlab.com/a/b")).toBeNull();
    expect(parseGitHubUrl("https://github.com/a")).toBeNull();
    expect(parseGitHubUrl("https://github.com/a/b/tree/-rf")).toBeNull();
    expect(parseGitHubUrl("")).toBeNull();
  });
});

describe("hash", () => {
  it("is byte-exact sha256", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
