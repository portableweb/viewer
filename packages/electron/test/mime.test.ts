import { test } from "node:test";
import assert from "node:assert/strict";
import { mimeTypeForPath } from "../src/mime";

test("maps known extensions", () => {
  assert.equal(mimeTypeForPath("index.html"), "text/html; charset=utf-8");
  assert.equal(mimeTypeForPath("styles/app.css"), "text/css; charset=utf-8");
  assert.equal(mimeTypeForPath("scripts/app.js"), "text/javascript; charset=utf-8");
  assert.equal(mimeTypeForPath("assets/icon.svg"), "image/svg+xml");
  assert.equal(mimeTypeForPath("data/blob.wasm"), "application/wasm");
});

test("falls back to application/octet-stream for unknown or missing extensions", () => {
  assert.equal(mimeTypeForPath("README"), "application/octet-stream");
  assert.equal(mimeTypeForPath("weird.xyz"), "application/octet-stream");
});
