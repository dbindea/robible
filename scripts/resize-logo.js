// Logo resize script — run with: node scripts/resize-logo.js
// Generates all icon sizes from the source logo image
import Jimp from 'jimp';

async function process() {
  const image = await Jimp.read('robible/logo-512.png');
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const data = image.bitmap.data;

  // Make white background outside circle transparent
  const cx = w / 2, cy = h / 2, r = w * 0.47;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist >= r && data[idx] > 200 && data[idx + 1] > 200 && data[idx + 2] > 200) {
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
    { size: 150, file: 'public/mstile-150x150.png' },
    { size: 192, file: 'public/android-chrome-192x192.png' },
    { size: 512, file: 'public/android-chrome-512x512.png' },
  ];

  for (const t of targets) {
    const resized = tealCanvas.clone().resize(t.size, t.size);
    await resized.write(t.file);
  }

  for (const cs of [192, 512]) {
    const sz = Math.round(cs * 0.6);
    const pad = Math.round((cs - sz) / 2);
    const bg = new Jimp(cs, cs, tealVal);
    bg.composite(tealCanvas.clone().resize(sz, sz), pad, pad);
    await bg.write(`public/maskable-icon-${cs}x${cs}.png`);
  }

  await tealCanvas.clone().resize(512, 512).write('public/assets/img/logo.png');
  console.log('Done!');
}

process().catch(console.error);
