/**
 * v0.1 scope: localStorage only. IndexedDB shimming is deferred — see
 * packages/shims/README.md — so the schema deliberately has no indexeddb
 * field yet rather than a half-built one.
 */
export interface PwebdataDocument {
  format_version: "0.1";
  bundle_id: string;
  updated: string; // ISO 8601
  local_storage: Record<string, string>;
}

export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreError";
  }
}

export function createEmptyDocument(bundleId: string): PwebdataDocument {
  return {
    format_version: "0.1",
    bundle_id: bundleId,
    updated: new Date().toISOString(),
    local_storage: {},
  };
}

export function serializeDocument(doc: PwebdataDocument): string {
  return JSON.stringify(doc, null, 2);
}

export function parseDocument(text: string): PwebdataDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new StoreError(`Store document is not valid JSON: ${(err as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new StoreError("Store document must be a JSON object");
  }
  const doc = parsed as Partial<PwebdataDocument>;
  if (doc.format_version !== "0.1") {
    throw new StoreError(`Unsupported store format_version: ${String(doc.format_version)}`);
  }
  if (typeof doc.bundle_id !== "string" || doc.bundle_id.length === 0) {
    throw new StoreError("Store document missing bundle_id");
  }
  if (typeof doc.local_storage !== "object" || doc.local_storage === null) {
    throw new StoreError("Store document missing local_storage");
  }
  return {
    format_version: "0.1",
    bundle_id: doc.bundle_id,
    updated: typeof doc.updated === "string" ? doc.updated : new Date().toISOString(),
    local_storage: doc.local_storage as Record<string, string>,
  };
}

/** Pure state transition — null value means the key was removed. */
export function applyLocalStorageWrite(
  doc: PwebdataDocument,
  key: string,
  value: string | null
): PwebdataDocument {
  const local_storage = { ...doc.local_storage };
  if (value === null) {
    delete local_storage[key];
  } else {
    local_storage[key] = value;
  }
  return { ...doc, local_storage, updated: new Date().toISOString() };
}

export function applyLocalStorageClear(doc: PwebdataDocument): PwebdataDocument {
  return { ...doc, local_storage: {}, updated: new Date().toISOString() };
}
