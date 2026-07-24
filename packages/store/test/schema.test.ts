import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyDocument,
  serializeDocument,
  parseDocument,
  applyLocalStorageWrite,
  applyLocalStorageClear,
  StoreError,
} from "../src/schema";

test("createEmptyDocument produces a valid empty document", () => {
  const doc = createEmptyDocument("org.example.hello");
  assert.equal(doc.bundle_id, "org.example.hello");
  assert.deepEqual(doc.local_storage, {});
});

test("serialize/parse round-trips", () => {
  const doc = createEmptyDocument("org.example.hello");
  const roundTripped = parseDocument(serializeDocument(doc));
  assert.deepEqual(roundTripped, doc);
});

test("parseDocument rejects invalid JSON", () => {
  assert.throws(() => parseDocument("{ not json"), StoreError);
});

test("parseDocument rejects a document missing bundle_id", () => {
  assert.throws(() => parseDocument(JSON.stringify({ format_version: "0.1", local_storage: {} })), StoreError);
});

test("parseDocument rejects an unsupported format_version", () => {
  assert.throws(
    () => parseDocument(JSON.stringify({ format_version: "9.9", bundle_id: "x.y", local_storage: {} })),
    StoreError
  );
});

test("applyLocalStorageWrite sets and removes keys immutably", () => {
  const doc = createEmptyDocument("org.example.hello");
  const withKey = applyLocalStorageWrite(doc, "theme", "dark");
  assert.equal(withKey.local_storage.theme, "dark");
  assert.deepEqual(doc.local_storage, {}); // original untouched

  const removed = applyLocalStorageWrite(withKey, "theme", null);
  assert.equal(removed.local_storage.theme, undefined);
});

test("applyLocalStorageClear empties all keys", () => {
  let doc = createEmptyDocument("org.example.hello");
  doc = applyLocalStorageWrite(doc, "a", "1");
  doc = applyLocalStorageWrite(doc, "b", "2");
  const cleared = applyLocalStorageClear(doc);
  assert.deepEqual(cleared.local_storage, {});
});
