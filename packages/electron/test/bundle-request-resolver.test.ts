import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCentralDirectory } from "@portableweb/core";
import { resolveBundleRequest } from "../src/bundle-request-resolver";
import { buildZip } from "./fixtures";

function bundle() {
  const buffer = buildZip([
    { name: "mimetype", content: "application/vnd.portableweb+zip" },
    { name: "manifest.json", content: '{"id":"org.example.hello"}' },
    { name: "index.html", content: "<!doctype html><title>hi</title>" },
    { name: "assets/icon.svg", content: "<svg></svg>", method: 8 },
  ]);
  return { buffer, entries: parseCentralDirectory(buffer) };
}

test("serves the default entry for an empty or root path", () => {
  const { buffer, entries } = bundle();
  const res = resolveBundleRequest(buffer, entries, "", "index.html");
  assert.equal(res.status, 200);
  assert.equal(res.contentType, "text/html; charset=utf-8");
  assert.equal(new TextDecoder().decode(res.body), "<!doctype html><title>hi</title>");
});

test("serves an in-bundle resource by path", () => {
  const { buffer, entries } = bundle();
  const res = resolveBundleRequest(buffer, entries, "assets/icon.svg", "index.html");
  assert.equal(res.status, 200);
  assert.equal(new TextDecoder().decode(res.body), "<svg></svg>");
});

test("AC6: manifest.json and mimetype are never served to content", () => {
  const { buffer, entries } = bundle();
  assert.equal(resolveBundleRequest(buffer, entries, "manifest.json", "index.html").status, 403);
  assert.equal(resolveBundleRequest(buffer, entries, "mimetype", "index.html").status, 403);
});

test("404s for a resource that doesn't exist in the bundle", () => {
  const { buffer, entries } = bundle();
  assert.equal(resolveBundleRequest(buffer, entries, "missing.png", "index.html").status, 404);
});

test("F08: traversal attempts are forbidden, never served from outside the bundle", () => {
  const { buffer, entries } = bundle();
  assert.equal(resolveBundleRequest(buffer, entries, "../../etc/hosts", "index.html").status, 403);
  assert.equal(resolveBundleRequest(buffer, entries, "%2e%2e%2fsecret", "index.html").status, 403);
});

test("reserved paths (META-INF/, .well-known/) are forbidden even if present in the archive", () => {
  const buffer = buildZip([
    { name: "mimetype", content: "application/vnd.portableweb+zip" },
    { name: "META-INF/signature.json", content: "{}" },
  ]);
  const entries = parseCentralDirectory(buffer);
  assert.equal(resolveBundleRequest(buffer, entries, "META-INF/signature.json", "index.html").status, 403);
});
