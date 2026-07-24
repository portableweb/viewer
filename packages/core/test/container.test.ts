import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fastIdentify,
  parseCentralDirectory,
  validateMimetypeEntry,
  readEntryBytes,
  findEntry,
  setInflateImplementation,
  ContainerError,
} from "../src";
import { buildZip, helloBundleEntries, VALID_MANIFEST } from "./fixtures";

test("B1: fastIdentify accepts a valid mimetype-first bundle", () => {
  const buffer = buildZip(helloBundleEntries());
  assert.equal(fastIdentify(buffer), true);
});

test("B1/F02: fastIdentify rejects a bundle with no mimetype entry", () => {
  const buffer = buildZip([{ name: "manifest.json", content: VALID_MANIFEST }]);
  assert.equal(fastIdentify(buffer), false);
});

test("B1/F03: fastIdentify rejects mimetype that isn't the first entry", () => {
  const buffer = buildZip([
    { name: "manifest.json", content: VALID_MANIFEST },
    { name: "mimetype", content: "application/vnd.portableweb+zip" },
  ]);
  assert.equal(fastIdentify(buffer), false);
});

test("B1/F04: fastIdentify rejects a compressed mimetype entry", () => {
  const buffer = buildZip([{ name: "mimetype", content: "application/vnd.portableweb+zip", method: 8 }]);
  assert.equal(fastIdentify(buffer), false);
});

test("B2: parseCentralDirectory enumerates all entries with correct metadata", () => {
  const buffer = buildZip(helloBundleEntries());
  const entries = parseCentralDirectory(buffer);
  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((e) => e.name),
    ["mimetype", "manifest.json", "index.html"]
  );
  assert.equal(entries[0].compressionMethod, 0);
  assert.equal(entries[1].compressionMethod, 8);
});

test("B2: parseCentralDirectory throws on a non-ZIP buffer", () => {
  assert.throws(() => parseCentralDirectory(new Uint8Array([1, 2, 3, 4])), ContainerError);
});

test("validateMimetypeEntry: F03 mimetype not first is a distinct rejection reason", () => {
  const buffer = buildZip([
    { name: "manifest.json", content: VALID_MANIFEST },
    { name: "mimetype", content: "application/vnd.portableweb+zip" },
  ]);
  const entries = parseCentralDirectory(buffer);
  assert.throws(() => validateMimetypeEntry(buffer, entries), (err: ContainerError) => {
    return err.code === "MIMETYPE_NOT_FIRST";
  });
});

test("validateMimetypeEntry: F04 compressed mimetype is a distinct rejection reason", () => {
  const buffer = buildZip([{ name: "mimetype", content: "application/vnd.portableweb+zip", method: 8 }]);
  const entries = parseCentralDirectory(buffer);
  assert.throws(() => validateMimetypeEntry(buffer, entries), (err: ContainerError) => {
    return err.code === "MIMETYPE_COMPRESSED";
  });
});

test("validateMimetypeEntry: content mismatch is a distinct rejection reason", () => {
  const buffer = buildZip([{ name: "mimetype", content: "not/the-right-type" }]);
  const entries = parseCentralDirectory(buffer);
  assert.throws(() => validateMimetypeEntry(buffer, entries), (err: ContainerError) => {
    return err.code === "MIMETYPE_CONTENT_MISMATCH";
  });
});

test("readEntryBytes: round-trips STORE and DEFLATE content", () => {
  const buffer = buildZip(helloBundleEntries());
  const entries = parseCentralDirectory(buffer);
  const manifestEntry = findEntry(entries, "manifest.json")!;
  const decoded = new TextDecoder().decode(readEntryBytes(buffer, manifestEntry));
  assert.equal(decoded, VALID_MANIFEST);
});

test("setInflateImplementation: a JSC/mobile host can override DEFLATE decompression", () => {
  const buffer = buildZip(helloBundleEntries());
  const entries = parseCentralDirectory(buffer);
  const manifestEntry = findEntry(entries, "manifest.json")!;

  let calls = 0;
  setInflateImplementation((compressed) => {
    calls++;
    // A real override (e.g. iOS's Compression.framework bridge) would
    // actually decompress; this just proves the seam is really used.
    const zlib = require("node:zlib") as typeof import("node:zlib");
    return new Uint8Array(zlib.inflateRawSync(Buffer.from(compressed)));
  });

  try {
    const decoded = new TextDecoder().decode(readEntryBytes(buffer, manifestEntry));
    assert.equal(decoded, VALID_MANIFEST);
    assert.equal(calls, 1);
  } finally {
    setInflateImplementation(null); // restore default for other tests
  }
});
