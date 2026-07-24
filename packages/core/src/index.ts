import { ContainerError, OpenBundleResult } from "./types";
import { parseCentralDirectory, validateMimetypeEntry, readEntryBytes, findEntry } from "./container";
import { validateManifest } from "./manifest";
import { resolveEntryFile } from "./resolve";

export * from "./types";
export {
  fastIdentify,
  parseCentralDirectory,
  validateMimetypeEntry,
  readEntryBytes,
  findEntry,
  MIMETYPE_CONTENT,
  setInflateImplementation,
} from "./container";
export { validateManifest } from "./manifest";
export { normalizeEntryPath, resolveEntryFile } from "./resolve";

/**
 * B1–B7 combined — the orchestration a platform adapter actually calls:
 * fast-ID, full container parse, manifest validation, entry resolution.
 * No platform APIs; takes and returns plain bytes/structures only.
 */
export function openBundle(buffer: Uint8Array): OpenBundleResult {
  // fastIdentify() is exported separately for adapters that want a cheap
  // pre-check (e.g. "is this even worth trying to open"); openBundle goes
  // straight to the full parse so it can report *which* container check
  // failed (F02–F04 are distinct: missing / not-first / compressed).
  let entries;
  try {
    entries = parseCentralDirectory(buffer);
  } catch (err) {
    const e = err as ContainerError;
    return { ok: false, code: e.code, errors: [e.message] };
  }

  try {
    validateMimetypeEntry(buffer, entries);
  } catch (err) {
    const e = err as ContainerError;
    return { ok: false, code: e.code, errors: [e.message] };
  }

  const manifestEntry = findEntry(entries, "manifest.json");
  if (!manifestEntry) {
    return { ok: false, code: "MANIFEST_MISSING", errors: ['No "manifest.json" entry found at archive root'] };
  }

  const manifestJson = new TextDecoder("utf-8").decode(readEntryBytes(buffer, manifestEntry));
  const manifestResult = validateManifest(manifestJson);
  if (!manifestResult.valid || !manifestResult.manifest) {
    return { ok: false, code: "MANIFEST_INVALID", errors: manifestResult.errors };
  }

  const entryFile = resolveEntryFile(entries, manifestResult.manifest.entry);
  if (!entryFile) {
    return {
      ok: false,
      code: "ENTRY_FILE_MISSING",
      errors: [`Entry file "${manifestResult.manifest.entry}" not found in archive`],
      manifest: manifestResult.manifest,
      entries,
    };
  }

  return { ok: true, errors: [], manifest: manifestResult.manifest, entries, entryFile };
}
