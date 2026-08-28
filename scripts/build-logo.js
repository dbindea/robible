// Regenera todos los iconos de la app a partir de los SVG fuente.
// Uso: node scripts/build-logo.js
//
// - Logo con fondo (logo.svg) -> iconos PWA (mstile, maskable, android-chrome, apple-touch, og)
// - Logo sin fondo (favicon.svg) -> favicon.ico + PNGs fallback
// - Requiere: sharp (npm i -D sharp)
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const SVG_FULL = path.join(PUBLIC, 'assets', 'img', 'logo.svg');
const SVG_FAVICON = path.join(PUBLIC, 'favicon.svg');

const svgFull = fs.readFileSync(SVG_FULL);
const svgFavicon = fs.readFileSync(SVG_FAVICON);

// [rutaDestino, size, fuente]
// fuente: 'full' = con cuadrado teal; 'favicon' = solo emblema transparente
const targets = [
  // PNGs legacy / favicon (favicon sin fondo)
  ['favicon-16x16.png',     16,  'favicon'],
  ['favicon-32x32.png',     32,  'favicon'],
  ['favicon-48x48.png',     48,  'favicon'],
  ['favicon.png',           64,  'favicon'],
  // iOS / Android / Windows / OG image (con fondo)
  ['apple-touch-icon.png',  180, 'full'],
  ['android-chrome-192x192.png', 192, 'full'],
  ['android-chrome-512x512.png', 512, 'full'],
  ['maskable-icon-192x192.png',  192, 'full'],
  ['maskable-icon-512x512.png',  512, 'full'],
  ['mstile-150x150.png',    150, 'full'],
  ['assets/img/logo.png',   512, 'full'],
];

async function run() {
  for (const [rel, size, source] of targets) {
    const buf = source === 'full' ? svgFull : svgFavicon;
    const out = path.join(PUBLIC, rel);
    await sharp(buf, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`  ✓ ${rel} (${size}px)`);
  }

  // favicon.ico (32x32 PNG renombrado: browsers modernos lo aceptan)
  await sharp(svgFavicon, { density: 384 })
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(PUBLIC, 'favicon.ico'));
  console.log('  ✓ favicon.ico (32px)');

  console.log('\n✅ Todos los iconos regenerados desde los SVG fuente.');
}

run().catch((e) => { console.error('❌ Error:', e); process.exit(1); });
