// Convierte el SVG fuente en PNG y regenera todos los iconos.
// Uso: node scripts/build-logo.js
//
// Requisitos: sharp + jimp instalados
import sharp from 'sharp';
import Jimp from 'jimp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SVG_PATH = path.join(ROOT, 'public/assets/img/logo-source.svg');
const OUTPUT_PNG = path.join(ROOT, 'logo-512.png');

const SIZE = 512;

async function svgToPng() {
  const svgText = fs.readFileSync(SVG_PATH, 'utf8');

  await sharp(Buffer.from(svgText))
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(OUTPUT_PNG);
  console.log(`SVG → PNG: ${OUTPUT_PNG}`);
}

async function processIcons() {
  const image = await Jimp.read(OUTPUT_PNG);
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const data = image.bitmap.data;

  // Hacer transparente todo lo que esté fuera del círculo
  const cx = w / 2, cy = h / 2, r = w * 0.47;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist >= r) {
        data[idx + 3] = 0;
      }
    }
  }

  const tealVal = Jimp.rgbaToInt(46, 125, 155, 255);
  const tealCanvas = new Jimp(w, h, tealVal);
  tealCanvas.composite(image, 0, 0);

  const targets = [
    { size: 16, file: 'public/favicon-16x16.png' },
    { size: 32, file: 'public/favicon-32x32.png' },
    { size: 48, file: 'public/favicon-48x48.png' },
    { size: 64, file: 'public/favicon.png' },
    { size: 128, file: 'public/apple-touch-icon.png' },
    { size: 192, file: 'public/android-chrome-192x192.png' },
    { size: 512, file: 'public/android-chrome-512x512.png' },
  ];

  for (const t of targets) {
    const resized = tealCanvas.clone().resize(t.size, t.size);
    await resized.write(path.join(ROOT, t.file));
    console.log(`✓ ${t.file} (${t.size}x${t.size})`);
  }

  for (const cs of [192, 512]) {
    const sz = Math.round(cs * 0.6);
    const pad = Math.round((cs - sz) / 2);
    const bg = new Jimp(cs, cs, tealVal);
    bg.composite(tealCanvas.clone().resize(sz, sz), pad, pad);
    const out = `public/maskable-icon-${cs}x${cs}.png`;
    await bg.write(path.join(ROOT, out));
    console.log(`✓ ${out}`);
  }

  await tealCanvas.clone().resize(512, 512).write(path.join(ROOT, 'public/assets/img/logo.png'));
  console.log('✓ public/assets/img/logo.png');
}

(async () => {
  try {
    await svgToPng();
    await processIcons();
    console.log('\n✅ Todos los iconos regenerados desde el SVG fuente.');
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
})();
