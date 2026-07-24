import { test } from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../src";
import { VALID_MANIFEST } from "./fixtures";

test("B3: accepts a minimal valid manifest", () => {
  const result = validateManifest(VALID_MANIFEST);
  assert.equal(result.valid, true);
  assert.equal(result.manifest?.id, "org.example.hello");
});

test("B3/F06: rejects invalid JSON", () => {
  const result = validateManifest("{ not json");
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test("B5/F06: rejects a malformed id", () => {
  const manifest = JSON.parse(VALID_MANIFEST);
  manifest.id = "Not An ID!!";
  const result = validateManifest(JSON.stringify(manifest));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('"id"')));
});

test("B3: rejects a manifest missing required fields", () => {
  const result = validateManifest(JSON.stringify({ title: "No id or entry" }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 3); // spec_version, id, version, entry all missing
});

test("entry field: rejects absolute paths and non-html extensions", () => {
  const manifest = JSON.parse(VALID_MANIFEST);
  manifest.entry = "/index.html";
  assert.equal(validateManifest(JSON.stringify(manifest)).valid, false);

  manifest.entry = "index.js";
  assert.equal(validateManifest(JSON.stringify(manifest)).valid, false);
});

test("B4/F10: unknown top-level keys and unknown permission names are tolerated", () => {
  const manifest = {
    ...JSON.parse(VALID_MANIFEST),
    some_future_field: "ignored",
    permissions: { totally_made_up_permission: true },
  };
  const result = validateManifest(JSON.stringify(manifest));
  assert.equal(result.valid, true);
});
