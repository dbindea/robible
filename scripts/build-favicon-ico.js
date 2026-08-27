// Genera favicon.ico multi-resolución (16, 32, 48) desde PNGs pre-generados.
// Uso: node scripts/build-favicon-ico.js
import Jimp from 'jimp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SIZES = [16, 32, 48];

// Carga cada PNG en un buffer PNG crudo
const pngBuffers = await Promise.all(
  SIZES.map(async (size) => {
    const img = await Jimp.read(path.join(ROOT, `public/favicon-${size}x${size}.png`));
    return img.getBufferAsync(Jimp.MIME_PNG);
  }),
);

const HEADER_SIZE = 6;
const DIR_ENTRY_SIZE = 16;
const dirSize = HEADER_SIZE + DIR_ENTRY_SIZE * SIZES.length;

// Calcula offsets
let offset = dirSize;
const entries = SIZES.map((size, i) => {
  const e = {
    width: size === 256 ? 0 : size,
    height: size === 256 ? 0 : size,
    colorCount: 0,
    reserved: 0,
    planes: 1,
    bitCount: 32,
    bytesInRes: pngBuffers[i].length,
    imageOffset: offset,
  };
  offset += pngBuffers[i].length;
  return e;
});

const buf = Buffer.alloc(offset);

// Header
buf.writeUInt16LE(0, 0); // reserved
buf.writeUInt16LE(1, 2); // type=icon
buf.writeUInt16LE(SIZES.length, 4); // count

// Directory entries
entries.forEach((e, i) => {
  const pos = HEADER_SIZE + i * DIR_ENTRY_SIZE;
  buf.writeUInt8(e.width, pos);
  buf.writeUInt8(e.height, pos + 1);
  buf.writeUInt8(e.colorCount, pos + 2);
  buf.writeUInt8(e.reserved, pos + 3);
  buf.writeUInt16LE(e.planes, pos + 4);
  buf.writeUInt16LE(e.bitCount, pos + 6);
  buf.writeUInt32LE(e.bytesInRes, pos + 8);
  buf.writeUInt32LE(e.imageOffset, pos + 12);
});

// Image data
entries.forEach((e, i) => {
  pngBuffers[i].copy(buf, e.imageOffset);
});

const out = path.join(ROOT, 'public/favicon.ico');
fs.writeFileSync(out, buf);
console.log(`✓ ${out} (${SIZES.join('+')} px, multi-res)`);
