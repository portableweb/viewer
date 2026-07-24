import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadDocument, saveDocument } from "../src/node-fs-persistence";
import { applyLocalStorageWrite } from "../src/schema";
import { StoreError } from "../src/schema";

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pweb-store-test-"));
}

test("loadDocument returns an empty document when nothing has been saved", () => {
  const dir = tempDir();
  const doc = loadDocument(dir, "org.example.hello");
  assert.deepEqual(doc.local_storage, {});
});

test("saveDocument then loadDocument round-trips", () => {
  const dir = tempDir();
  const doc = applyLocalStorageWrite(loadDocument(dir, "org.example.hello"), "theme", "dark");
  saveDocument(dir, doc);

  const reloaded = loadDocument(dir, "org.example.hello");
  assert.equal(reloaded.local_storage.theme, "dark");
});

test("saveDocument leaves no leftover temp files after a successful write", () => {
  const dir = tempDir();
  const doc = applyLocalStorageWrite(loadDocument(dir, "org.example.hello"), "a", "1");
  saveDocument(dir, doc);

  const files = fs.readdirSync(path.join(dir, "org.example.hello"));
  assert.deepEqual(files, ["store.json"]);
});

test("rejects a bundle_id that isn't safe as a path component", () => {
  const dir = tempDir();
  assert.throws(() => loadDocument(dir, "../escape"), StoreError);
});

test("two bundle ids get isolated stores", () => {
  const dir = tempDir();
  saveDocument(dir, applyLocalStorageWrite(loadDocument(dir, "org.example.a"), "k", "a-value"));
  saveDocument(dir, applyLocalStorageWrite(loadDocument(dir, "org.example.b"), "k", "b-value"));

  assert.equal(loadDocument(dir, "org.example.a").local_storage.k, "a-value");
  assert.equal(loadDocument(dir, "org.example.b").local_storage.k, "b-value");
});
