import { ContainerError, ZipEntry } from "./types";

// CONTAINER.md §4.2 — exact bytes required, no trailing newline or whitespace.
export const MIMETYPE_CONTENT = "application/vnd.portableweb+zip";

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT_LENGTH = 0xffff;

function readLocalFileHeader(buffer: Uint8Array, offset: number) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (offset + 30 > buffer.length) {
    throw new ContainerError("NOT_A_ZIP", "Local file header runs past end of buffer");
  }
  if (view.getUint32(offset, true) !== LOCAL_FILE_HEADER_SIG) {
    throw new ContainerError("NOT_A_ZIP", "Missing local file header signature");
  }
  const compressionMethod = view.getUint16(offset + 8, true);
  const compressedSize = view.getUint32(offset + 18, true);
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const nameStart = offset + 30;
  const dataStart = nameStart + nameLength + extraLength;
  const name = new TextDecoder("utf-8").decode(buffer.subarray(nameStart, nameStart + nameLength));
  return { compressionMethod, compressedSize, extraLength, nameLength, name, dataStart };
}

/**
 * B1 — Fast-ID. Reads only the first local file header (~80 bytes), per
 * CONTAINER.md §4.2 / §7.3: no central-directory parse needed to identify
 * a bundle.
 */
export function fastIdentify(buffer: Uint8Array): boolean {
  try {
    const header = readLocalFileHeader(buffer, 0);
    if (header.name !== "mimetype") return false;
    if (header.compressionMethod !== 0) return false;
    if (header.extraLength !== 0) return false;
    const content = new TextDecoder("utf-8").decode(
      buffer.subarray(header.dataStart, header.dataStart + header.compressedSize)
    );
    return content === MIMETYPE_CONTENT;
  } catch {
    return false;
  }
}

function findEndOfCentralDirectory(buffer: Uint8Array): number {
  const searchStart = Math.max(0, buffer.length - EOCD_MIN_SIZE - MAX_COMMENT_LENGTH);
  for (let i = buffer.length - EOCD_MIN_SIZE; i >= searchStart; i--) {
    if (
      buffer[i] === 0x50 &&
      buffer[i + 1] === 0x4b &&
      buffer[i + 2] === 0x05 &&
      buffer[i + 3] === 0x06
    ) {
      return i;
    }
  }
  throw new ContainerError("EOCD_NOT_FOUND", "End of central directory record not found — not a valid ZIP");
}

/**
 * B2 — Central-directory ZIP parse. Reads the directory structure only;
 * never extracts entries to disk.
 */
export function parseCentralDirectory(buffer: Uint8Array): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);

  const entries: ZipEntry[] = [];
  let offset = centralDirOffset;
  const decoder = new TextDecoder("utf-8");

  for (let i = 0; i < totalEntries; i++) {
    if (offset + 46 > buffer.length || view.getUint32(offset, true) !== CENTRAL_DIR_SIG) {
      throw new ContainerError("NOT_A_ZIP", "Malformed central directory record");
    }
    const compressionMethod = view.getUint16(offset + 10, true);
    const crc32 = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameStart = offset + 46;
    const name = decoder.decode(buffer.subarray(nameStart, nameStart + nameLength));

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      crc32,
    });

    offset = nameStart + nameLength + extraLength + commentLength;
  }

  return entries;
}

/**
 * Inflate is the one seam that isn't pure-portable TS. Defaults to Node's
 * zlib; a JavaScriptCore host (iOS has no zlib module) calls
 * setInflateImplementation() once at startup with a native bridge instead
 * — see packages/mobile/ios/README.md for the intended shape. Everything
 * else in this package is engine-agnostic byte parsing.
 */
export type InflateFn = (compressed: Uint8Array) => Uint8Array;

let inflateOverride: InflateFn | null = null;

export function setInflateImplementation(fn: InflateFn | null): void {
  inflateOverride = fn;
}

function inflateRaw(compressed: Uint8Array): Uint8Array {
  if (inflateOverride) return inflateOverride(compressed);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const zlib = require("node:zlib") as typeof import("node:zlib");
  return new Uint8Array(zlib.inflateRawSync(Buffer.from(compressed)));
}

/** Reads and (if needed) decompresses one entry's raw content. */
export function readEntryBytes(buffer: Uint8Array, entry: ZipEntry): Uint8Array {
  const header = readLocalFileHeader(buffer, entry.localHeaderOffset);
  const compressed = buffer.subarray(header.dataStart, header.dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressed;
  }
  if (entry.compressionMethod === 8) {
    return inflateRaw(compressed);
  }
  throw new ContainerError(
    "UNSUPPORTED_COMPRESSION",
    `Entry "${entry.name}" uses unsupported compression method ${entry.compressionMethod}`
  );
}

export function findEntry(entries: ZipEntry[], name: string): ZipEntry | undefined {
  return entries.find((e) => e.name === name);
}

/**
 * Full mimetype validation against CONTAINER.md §4.2/§7: first entry,
 * stored, no extra fields, exact content. Distinguishes failure reasons
 * (F02–F04) rather than collapsing to one boolean, per the checklist's
 * per-fixture rejection semantics.
 */
export function validateMimetypeEntry(buffer: Uint8Array, entries: ZipEntry[]): void {
  const mimetypeEntry = findEntry(entries, "mimetype");
  if (!mimetypeEntry) {
    throw new ContainerError("MIMETYPE_MISSING", 'No "mimetype" entry found in archive');
  }
  if (entries[0]?.name !== "mimetype") {
    throw new ContainerError("MIMETYPE_NOT_FIRST", '"mimetype" must be the first entry in the archive');
  }
  if (mimetypeEntry.compressionMethod !== 0) {
    throw new ContainerError("MIMETYPE_COMPRESSED", '"mimetype" entry must be stored (uncompressed)');
  }
  const header = readLocalFileHeader(buffer, mimetypeEntry.localHeaderOffset);
  if (header.extraLength !== 0) {
    throw new ContainerError("MIMETYPE_HAS_EXTRA_FIELD", '"mimetype" entry must have no extra fields');
  }
  const content = new TextDecoder("utf-8").decode(readEntryBytes(buffer, mimetypeEntry));
  if (content !== MIMETYPE_CONTENT) {
    throw new ContainerError("MIMETYPE_CONTENT_MISMATCH", `"mimetype" content does not match "${MIMETYPE_CONTENT}"`);
  }
}
