import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowed } from "./proxy.js";

test("allows only the allowlisted host on 443", () => {
  assert.equal(isAllowed("api.anthropic.com:443").ok, true);
  assert.equal(isAllowed("API.ANTHROPIC.COM:443").ok, true);
  assert.equal(isAllowed("api.anthropic.com").ok, true); // default port 443
  assert.equal(isAllowed("api.anthropic.com:80").ok, false);
  assert.equal(isAllowed("github.com:443").ok, false);
  assert.equal(isAllowed("evil.api.anthropic.com:443").ok, false);
  assert.equal(isAllowed("api.anthropic.com.evil.com:443").ok, false);
  assert.equal(isAllowed("").ok, false);
  assert.equal(isAllowed(undefined).ok, false);
});
