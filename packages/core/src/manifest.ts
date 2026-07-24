import { ManifestValidationResult, PwebManifest } from "./types";

// MANIFEST.md §3 — id is reverse-domain form: lowercase, alphanumeric,
// dots, and hyphens only, with at least two dot-separated segments.
const ID_PATTERN = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;
const SPEC_VERSION_PATTERN = /^\d+\.\d+$/;
// Loose SemVer 2.0 core + optional pre-release/build metadata.
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * B3, B5 — presence + JSON validity + required-field checks.
 * B4 — unknown top-level keys and unknown permission names are tolerated
 * (never produce an error); only required-field violations do.
 */
export function validateManifest(jsonText: string): ManifestValidationResult {
  const errors: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    return { valid: false, errors: [`Manifest is not valid JSON: ${(err as Error).message}`] };
  }

  if (!isPlainObject(parsed)) {
    return { valid: false, errors: ["Manifest top-level value must be a JSON object"] };
  }

  const manifest = parsed as PwebManifest;

  if (typeof manifest.spec_version !== "string" || !SPEC_VERSION_PATTERN.test(manifest.spec_version)) {
    errors.push('"spec_version" is required and must match "MAJOR.MINOR" (e.g. "0.1")');
  }

  if (typeof manifest.id !== "string" || !ID_PATTERN.test(manifest.id)) {
    errors.push('"id" is required and must be reverse-domain form (lowercase, alphanumeric, dots, hyphens)');
  }

  if (typeof manifest.version !== "string" || !SEMVER_PATTERN.test(manifest.version)) {
    errors.push('"version" is required and must be a valid Semantic Version (e.g. "1.0.0")');
  }

  if (typeof manifest.title !== "string" || manifest.title.length === 0 || manifest.title.length > 200) {
    errors.push('"title" is required and must be 1–200 characters');
  }

  if (
    typeof manifest.entry !== "string" ||
    manifest.entry.length === 0 ||
    manifest.entry.startsWith("/") ||
    !/\.(html?|HTML?)$/.test(manifest.entry)
  ) {
    errors.push('"entry" is required, must not start with "/", and must end in ".html" or ".htm"');
  }

  // B4: permissions object, if present, only needs to be an object —
  // unknown/unrecognized keys inside it are intentionally not validated.
  if (manifest.permissions !== undefined && !isPlainObject(manifest.permissions)) {
    errors.push('"permissions", if present, must be an object');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, manifest, errors: [] };
}
