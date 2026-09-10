import { describe, expect, it } from "vitest";
import { anchorDiscriminator, canonicalRepoUrl, commitBytes, encodeAttestArgs, fixedString, repoHash } from "./encode.js";

describe("attest encoding", () => {
  it("canonicalises repo urls before hashing", () => {
    expect(canonicalRepoUrl("https://github.com/Owner/Repo.git/")).toBe("https://github.com/owner/repo");
    expect(repoHash("https://github.com/Owner/Repo")).toEqual(repoHash("https://github.com/owner/repo.git"));
    expect(() => canonicalRepoUrl("https://gitlab.com/a/b")).toThrow();
  });
  it("encodes fixed-size args (122 bytes)", () => {
    const bytes = encodeAttestArgs({
      repoUrl: "https://github.com/a/b",
      commitSha: "0123456789abcdef0123456789abcdef01234567",
      corpusVersion: "7.3.0@6bb2cbf",
      modelId: "claude-opus-5",
      reportSha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      counts: { critical: 1, high: 2, medium: 3, low: 4, info: 5 },
      visibility: 2,
    });
    expect(bytes.length).toBe(20 + 32 + 32 + 32 + 5 + 1);
    expect(Buffer.from(bytes.subarray(0, 4)).toString("hex")).toBe("01234567");
    expect(Buffer.from(bytes.subarray(20, 20 + 13)).toString()).toBe("7.3.0@6bb2cbf");
    expect([...bytes.subarray(116, 121)]).toEqual([1, 2, 3, 4, 5]);
    expect(bytes[121]).toBe(2);
  });
  it("rejects bad input", () => {
    expect(() => commitBytes("abc")).toThrow();
    expect(() => fixedString("x".repeat(33), 32)).toThrow();
  });
  it("computes anchor discriminators deterministically", () => {
    expect(anchorDiscriminator("attest").length).toBe(8);
    expect(anchorDiscriminator("attest")).toEqual(anchorDiscriminator("attest"));
    expect(anchorDiscriminator("attest")).not.toEqual(anchorDiscriminator("revoke"));
  });
});
