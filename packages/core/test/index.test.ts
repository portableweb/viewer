import { test } from "node:test";
import assert from "node:assert/strict";
import { openBundle } from "../src";
import { buildZip, helloBundleEntries, VALID_MANIFEST } from "./fixtures";

test("F01: openBundle opens a valid hello bundle end-to-end", () => {
  const buffer = buildZip(helloBundleEntries());
  const result = openBundle(buffer);
  assert.equal(result.ok, true);
  assert.equal(result.manifest?.id, "org.example.hello");
  assert.equal(result.entryFile?.name, "index.html");
});

test("F05: openBundle rejects a bundle with no manifest.json", () => {
  const buffer = buildZip([{ name: "mimetype", content: "application/vnd.portableweb+zip" }]);
  const result = openBundle(buffer);
  assert.equal(result.ok, false);
  assert.equal(result.code, "MANIFEST_MISSING");
});

test("F06: openBundle rejects a bundle with an invalid manifest", () => {
  const buffer = buildZip([
    { name: "mimetype", content: "application/vnd.portableweb+zip" },
    { name: "manifest.json", content: "{ not json" },
  ]);
  const result = openBundle(buffer);
  assert.equal(result.ok, false);
  assert.equal(result.code, "MANIFEST_INVALID");
});

test("F07: openBundle rejects a bundle whose entry file is missing", () => {
  const buffer = buildZip([
    { name: "mimetype", content: "application/vnd.portableweb+zip" },
    { name: "manifest.json", content: VALID_MANIFEST },
  ]);
  const result = openBundle(buffer);
  assert.equal(result.ok, false);
  assert.equal(result.code, "ENTRY_FILE_MISSING");
});

test("F10: openBundle opens normally with unknown manifest/permission keys", () => {
  const manifest = {
    ...JSON.parse(VALID_MANIFEST),
    some_future_field: "ignored",
    permissions: { made_up_permission: true },
  };
  const buffer = buildZip([
    { name: "mimetype", content: "application/vnd.portableweb+zip" },
    { name: "manifest.json", content: JSON.stringify(manifest) },
    { name: "index.html", content: "<!doctype html>" },
  ]);
  const result = openBundle(buffer);
  assert.equal(result.ok, true);
});
