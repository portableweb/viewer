export interface ZipEntry {
  name: string;
  compressionMethod: number; // 0 = STORE, 8 = DEFLATE
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  crc32: number;
}

export type ContainerErrorCode =
  | "NOT_A_ZIP"
  | "EOCD_NOT_FOUND"
  | "MIMETYPE_MISSING"
  | "MIMETYPE_NOT_FIRST"
  | "MIMETYPE_COMPRESSED"
  | "MIMETYPE_HAS_EXTRA_FIELD"
  | "MIMETYPE_CONTENT_MISMATCH"
  | "MANIFEST_MISSING"
  | "MANIFEST_INVALID_JSON"
  | "MANIFEST_INVALID"
  | "ENTRY_FILE_MISSING"
  | "UNSUPPORTED_COMPRESSION";

export class ContainerError extends Error {
  code: ContainerErrorCode;

  constructor(code: ContainerErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ContainerError";
  }
}

// MANIFEST.md §5 — declared upfront, default-deny; unknown keys tolerated
// (B4), so this is a shape for the fields the spec defines, not a closed set.
export interface PwebPermissions {
  network?: boolean;
  camera?: boolean | string;
  microphone?: boolean | string;
  geolocation?: boolean | string;
  clipboard_write?: boolean;
  notifications?: boolean;
  fullscreen?: boolean;
  storage?: "none" | "isolated";
  peers?: boolean;
  [key: string]: unknown;
}

// MANIFEST.md §7 — hints, not requirements.
export interface PwebViewport {
  preferred_width?: number;
  preferred_height?: number;
  resizable?: boolean;
  min_width?: number;
  min_height?: number;
}

export interface PwebManifest {
  spec_version: string;
  id: string;
  version: string;
  title: string;
  entry: string;
  description?: string;
  author?: { name: string; email?: string; url?: string };
  created?: string;
  icon?: string;
  content_type?: string;
  permissions?: PwebPermissions;
  rights?: Record<string, unknown>;
  viewport?: PwebViewport;
  [key: string]: unknown;
}

export interface ManifestValidationResult {
  valid: boolean;
  manifest?: PwebManifest;
  errors: string[];
}

export interface OpenBundleResult {
  ok: boolean;
  code?: ContainerErrorCode;
  errors: string[];
  manifest?: PwebManifest;
  entries?: ZipEntry[];
  entryFile?: ZipEntry;
}
