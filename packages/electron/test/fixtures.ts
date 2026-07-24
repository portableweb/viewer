// Small standalone ZIP writer for this package's tests. Deliberately not
// shared with @portableweb/core/test — that's a private test helper of
// another package, not a public dependency to reach into.
import { deflateRawSync } from "node:zlib";

export interface FixtureEntry {
  name: string;
  content: string;
  method?: 0 | 8;
}

function crc32(bytes: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildZip(entries: FixtureEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const method = entry.method ?? 0;
    const uncompressed = encoder.encode(entry.content);
    const data = method === 8 ? deflateRawSync(Buffer.from(uncompressed)) : uncompressed;
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(uncompressed);
    const localOffset = offset;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, method, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, uncompressed.length, true);
    local.setUint16(26, nameBytes.length, true);

    const localBytes = new Uint8Array(local.buffer);
    chunks.push(localBytes, nameBytes, data);
    offset += localBytes.length + nameBytes.length + data.length;

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(10, method, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, data.length, true);
    central.setUint32(24, uncompressed.length, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint32(42, localOffset, true);
    centralRecords.push(new Uint8Array(central.buffer), nameBytes);
  }

  const centralDirStart = offset;
  for (const rec of centralRecords) {
    chunks.push(rec);
    offset += rec.length;
  }
  const centralDirSize = offset - centralDirStart;

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralDirSize, true);
  eocd.setUint32(16, centralDirStart, true);
  chunks.push(new Uint8Array(eocd.buffer));

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}
