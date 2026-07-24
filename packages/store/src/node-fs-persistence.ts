import * as fs from "node:fs";
import * as path from "node:path";
import { createEmptyDocument, parseDocument, serializeDocument, PwebdataDocument, StoreError } from "./schema";

// bundle_id is validated as reverse-DNS (alphanumeric/dots/hyphens only) by
// @portableweb/core, but this package doesn't depend on core — re-check the
// characters that matter for safe use as a filesystem path component.
const SAFE_BUNDLE_ID = /^[a-z0-9][a-z0-9.-]*$/;

function bundleDir(baseDir: string, bundleId: string): string {
  if (!SAFE_BUNDLE_ID.test(bundleId) || bundleId.includes("..")) {
    throw new StoreError(`Refusing to use unsafe bundle_id as a path component: ${bundleId}`);
  }
  return path.join(baseDir, bundleId);
}

function storeFilePath(baseDir: string, bundleId: string): string {
  return path.join(bundleDir(baseDir, bundleId), "store.json");
}

/** Loads the per-bundle store, or an empty document if none exists yet. */
export function loadDocument(baseDir: string, bundleId: string): PwebdataDocument {
  const filePath = storeFilePath(baseDir, bundleId);
  if (!fs.existsSync(filePath)) {
    return createEmptyDocument(bundleId);
  }
  return parseDocument(fs.readFileSync(filePath, "utf-8"));
}

/**
 * STORAGE.md write-back rule: atomic-replace (temp file + fsync + rename),
 * never a partial write visible to a concurrent reader.
 */
export function saveDocument(baseDir: string, doc: PwebdataDocument): void {
  const dir = bundleDir(baseDir, doc.bundle_id);
  fs.mkdirSync(dir, { recursive: true });
  const finalPath = path.join(dir, "store.json");
  const tempPath = path.join(dir, `.store.json.${process.pid}.${Date.now()}.tmp`);

  const fd = fs.openSync(tempPath, "w");
  try {
    fs.writeFileSync(fd, serializeDocument(doc));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tempPath, finalPath);
}
