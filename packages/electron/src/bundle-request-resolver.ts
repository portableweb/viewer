import { ZipEntry, normalizeEntryPath, findEntry, readEntryBytes } from "@portableweb/core";
import { mimeTypeForPath } from "./mime";

export interface ResolvedBundleResponse {
  status: number;
  contentType: string;
  body: Uint8Array;
}

// CONTAINER.md §6 reserved paths + checklist AC6 — manifest bytes are
// parsed host-side only and must never be served to bundle content.
const RESERVED_EXACT = new Set(["mimetype", "manifest.json"]);
const RESERVED_PREFIXES = ["META-INF/", ".well-known/"];

function forbidden(): ResolvedBundleResponse {
  return { status: 403, contentType: "text/plain; charset=utf-8", body: new TextEncoder().encode("Forbidden") };
}

function notFound(): ResolvedBundleResponse {
  return { status: 404, contentType: "text/plain; charset=utf-8", body: new TextEncoder().encode("Not Found") };
}

/**
 * Pull-model resource resolution for the pweb:// protocol handler —
 * everything served comes from the already-open bundle's entries, nothing
 * is ever read from outside it (RESOLUTION.md root-locking, checklist C2).
 */
export function resolveBundleRequest(
  buffer: Uint8Array,
  entries: ZipEntry[],
  requestPath: string,
  defaultEntryPath: string
): ResolvedBundleResponse {
  const rawPath = requestPath === "" || requestPath === "/" ? defaultEntryPath : requestPath;
  const normalized = normalizeEntryPath(rawPath);
  if (normalized === null) return forbidden();
  if (RESERVED_EXACT.has(normalized) || RESERVED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return forbidden();
  }

  const entry = findEntry(entries, normalized);
  if (!entry) return notFound();

  return { status: 200, contentType: mimeTypeForPath(normalized), body: readEntryBytes(buffer, entry) };
}
