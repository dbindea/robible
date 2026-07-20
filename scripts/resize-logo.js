import Jimp from 'jimp';
import fs from 'fs';

const image = await Jimp.read('robible/logo-v3r1-gold4.png');
console.log('Source:', image.width, 'x', image.height);

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
  const resized = image.clone().resize(t.size, t.size);
  await resized.write(t.file);
  const s = fs.statSync(t.file).size;
  console.log('OK', t.file, '(' + s + ' bytes)');
}

// Maskable icons: 60% icon in transparent canvas
for (const canvasSize of [192, 512]) {
  const iconSize = Math.round(canvasSize * 0.6);
  const pad = Math.round((canvasSize - iconSize) / 2);
  const resized = image.clone().resize(iconSize, iconSize);
  const canvas = new Jimp(canvasSize, canvasSize, 0x00000000);
  canvas.composite(resized, pad, pad);
  const file = 'public/maskable-icon-' + canvasSize + 'x' + canvasSize + '.png';
  await canvas.write(file);
  const s = fs.statSync(file).size;
  console.log('OK maskable', file, '(' + s + ' bytes)');
}

// Main logo
await image.clone().resize(512, 512).write('public/assets/img/logo.png');
console.log('Done logo.png');
console.log('All icons generated!');
