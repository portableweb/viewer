import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEntryPath, resolveEntryFile } from "../src";
import { buildZip, helloBundleEntries } from "./fixtures";
import { parseCentralDirectory } from "../src/container";

test("B6: normalizes a clean relative path", () => {
  assert.equal(normalizeEntryPath("index.html"), "index.html");
  assert.equal(normalizeEntryPath("./assets/icon.svg"), "assets/icon.svg");
});

test("B6/F08: rejects .. traversal", () => {
  assert.equal(normalizeEntryPath("../../etc/hosts"), null);
  assert.equal(normalizeEntryPath("assets/../../secret"), null);
});

test("B6/F08: rejects absolute paths", () => {
  assert.equal(normalizeEntryPath("/etc/hosts"), null);
  assert.equal(normalizeEntryPath("C:\\Windows\\System32"), null);
});

test("B6/F08: rejects backslash separators", () => {
  assert.equal(normalizeEntryPath("assets\\..\\..\\secret"), null);
});

test("B6/F08: rejects single- and double-percent-encoded traversal", () => {
  assert.equal(normalizeEntryPath("%2e%2e%2fsecret"), null);
  assert.equal(normalizeEntryPath("%252e%252e%252fsecret"), null);
});

test("B7: resolveEntryFile finds the manifest's declared entry", () => {
  const buffer = buildZip(helloBundleEntries());
  const entries = parseCentralDirectory(buffer);
  const entryFile = resolveEntryFile(entries, "index.html");
  assert.ok(entryFile);
  assert.equal(entryFile?.name, "index.html");
});

test("B7/F07: resolveEntryFile returns null when the entry file is absent", () => {
  const buffer = buildZip(helloBundleEntries());
  const entries = parseCentralDirectory(buffer);
  assert.equal(resolveEntryFile(entries, "missing.html"), null);
});
