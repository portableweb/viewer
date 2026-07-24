import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContentSecurityPolicy } from "../src/csp";

test("CSP restricts default-src, connect-src, and script-src to pweb:", () => {
  const csp = buildContentSecurityPolicy();
  assert.match(csp, /default-src pweb:/);
  assert.match(csp, /connect-src pweb:/);
  assert.match(csp, /script-src pweb:/);
});

test("CSP blocks framing, plugins, and form submission entirely", () => {
  const csp = buildContentSecurityPolicy();
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-src 'none'/);
  assert.match(csp, /form-action 'none'/);
});

test("CSP never references http/https origins", () => {
  const csp = buildContentSecurityPolicy();
  assert.doesNotMatch(csp, /https?:/);
});
