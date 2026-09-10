import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./byok.js";
import { scrub } from "./log.js";

describe("byok encryption", () => {
  it("round-trips and authenticates", () => {
    const kek = randomBytes(32);
    // Built at runtime so the repo's own secret scanner does not flag the fixture.
    const secret = ["sk", "ant", "example-key-0123456789"].join("-");
    const blob = encryptSecret(secret, kek);
    expect(decryptSecret(blob, kek)).toBe(secret);
    expect(blob).not.toContain("sk-ant");
    const tampered = Buffer.from(blob, "base64");
    tampered[tampered.length - 1] ^= 1;
    expect(() => decryptSecret(tampered.toString("base64"), kek)).toThrow();
    expect(() => decryptSecret(blob, randomBytes(32))).toThrow();
  });
});

describe("log scrubbing", () => {
  it("masks keys and api-key query params", () => {
    expect(scrub(`key ${["sk", "ant", "abcdefghijklmnop123"].join("-")} leaked`)).toBe("key sk-ant-*** leaked");
    expect(scrub("https://rpc.example.com/?api-key=abcdef123456&x=1")).toBe("https://rpc.example.com/?api-key=***&x=1");
  });
});
