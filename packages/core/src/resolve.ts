import { ZipEntry } from "./types";
import { findEntry } from "./container";

/**
 * B6 — Root-locked path resolution. Normalizes a bundle-relative path and
 * rejects (returns null, never silently collapses) anything that could
 * escape the package boundary: absolute paths, `..` segments, backslash
 * separators, and percent-encoded traversal (single- and double-encoded).
 *
 * RESOLUTION.md framing: reject, don't sanitize-and-allow.
 */
export function normalizeEntryPath(rawPath: string): string | null {
  if (typeof rawPath !== "string" || rawPath.length === 0) return null;
  if (rawPath.includes("\0")) return null;

  // Decode percent-encoding until stable (bounded) to catch double-encoded
  // traversal like `%252e%252e%252f`, without looping on malformed input.
  let decoded = rawPath;
  for (let i = 0; i < 3; i++) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    if (next === decoded) break;
    decoded = next;
  }

  // Backslashes are never a valid separator in a PortableWeb path
  // (CONTAINER.md §4.1 requires forward slashes) — reject outright rather
  // than translate, since translating is how traversal tricks slip through.
  if (decoded.includes("\\")) return null;

  // Absolute paths (leading slash) and Windows drive letters are rejected.
  if (decoded.startsWith("/")) return null;
  if (/^[a-zA-Z]:/.test(decoded)) return null;

  const segments = decoded.split("/");
  const normalized: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") return null; // reject, do not collapse
    normalized.push(segment);
  }

  if (normalized.length === 0) return null;
  return normalized.join("/");
}

/**
 * B7 — Resolves the manifest's declared entry path against the parsed
 * archive's entries. Resource paths are case-sensitive
 * (CONTAINER.md §Interoperability Considerations).
 */
export function resolveEntryFile(entries: ZipEntry[], entryPath: string): ZipEntry | null {
  const normalized = normalizeEntryPath(entryPath);
  if (normalized === null) return null;
  return findEntry(entries, normalized) ?? null;
}
