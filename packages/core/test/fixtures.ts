import { deflateRawSync } from "node:zlib";
import { MIMETYPE_CONTENT } from "../src/container";

export interface FixtureEntry {
  name: string;
  content: string;
  method?: 0 | 8; // 0 = STORE, 8 = DEFLATE
  noExtra?: boolean;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Minimal ZIP writer for building test bundles — not a general-purpose tool. */
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

    const localHeader = new DataView(new ArrayBuffer(30));
    localHeader.setUint32(0, 0x04034b50, true);
    localHeader.setUint16(4, 20, true); // version needed
    localHeader.setUint16(6, 0, true); // flags
    localHeader.setUint16(8, method, true);
    localHeader.setUint16(10, 0, true); // mod time
    localHeader.setUint16(12, 0, true); // mod date
    localHeader.setUint32(14, crc, true);
    localHeader.setUint32(18, data.length, true);
    localHeader.setUint32(22, uncompressed.length, true);
    localHeader.setUint16(26, nameBytes.length, true);
    localHeader.setUint16(28, 0, true); // extra length

    const localHeaderBytes = new Uint8Array(localHeader.buffer);
    chunks.push(localHeaderBytes, nameBytes, data);
    offset += localHeaderBytes.length + nameBytes.length + data.length;

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true); // version made by
    central.setUint16(6, 20, true); // version needed
    central.setUint16(8, 0, true); // flags
    central.setUint16(10, method, true);
    central.setUint16(12, 0, true);
    central.setUint16(14, 0, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, data.length, true);
    central.setUint32(24, uncompressed.length, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint16(30, 0, true); // extra length
    central.setUint16(32, 0, true); // comment length
    central.setUint16(34, 0, true); // disk number start
    central.setUint16(36, 0, true); // internal attrs
    central.setUint32(38, 0, true); // external attrs
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
  eocd.setUint16(4, 0, true);
  eocd.setUint16(6, 0, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralDirSize, true);
  eocd.setUint32(16, centralDirStart, true);
  eocd.setUint16(20, 0, true);
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

export const VALID_MANIFEST = JSON.stringify({
  spec_version: "0.1",
  id: "org.example.hello",
  version: "1.0.0",
  title: "Hello PortableWeb",
  entry: "index.html",
});

export function helloBundleEntries(): FixtureEntry[] {
  return [
    { name: "mimetype", content: MIMETYPE_CONTENT, method: 0 },
    { name: "manifest.json", content: VALID_MANIFEST, method: 8 },
    { name: "index.html", content: "<!doctype html><title>Hello</title>", method: 8 },
  ];
}
