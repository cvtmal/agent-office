// Minimal PNG encoder for the sprite preview (plan P-1): RGBA 8-bit, filter 0,
// one IDAT. Node-only (zlib), used by test/sprite-preview.test.ts.
import { crc32, deflateSync } from 'node:zlib';
import type { Raster } from '../src/client/render/raster.js';

/** The 8-byte PNG file signature. */
export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** One PNG chunk: length, type, data, CRC over type + data. */
function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

/** Encodes a raster as an RGBA PNG file. */
export function encodePng(r: Raster): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(r.w, 0);
  ihdr.writeUInt32BE(r.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  // compression, filter and interlace methods stay 0
  const rows = Buffer.alloc((r.w * 4 + 1) * r.h);
  for (let y = 0; y < r.h; y++) {
    const at = y * (r.w * 4 + 1);
    rows[at] = 0; // filter: none
    rows.set(r.data.subarray(y * r.w * 4, (y + 1) * r.w * 4), at + 1);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
