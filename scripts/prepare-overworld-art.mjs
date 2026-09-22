import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artDir = path.join(root, 'client/public/art/generated');
const requireFromMultiplayer = createRequire(path.join(root, 'multiplayer/package.json'));
const sharp = requireFromMultiplayer('sharp');

const plates = [
  'snowfield-pixel-environment-v1',
  'blossom-crown-pixel-environment-v1',
  'live-web-pixel-environment-v1'
];

const paperWash = Buffer.from(`
  <svg width="1024" height="576" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="576" fill="#faf9f4" fill-opacity="0.18"/>
  </svg>
`);

for (const plate of plates) {
  const source = path.join(artDir, `${plate}.png`);
  const runtime = path.join(artDir, `${plate}-runtime.png`);
  const pixelated = await sharp(source)
    .resize(512, 288, { fit: 'cover', position: 'centre', kernel: 'nearest' })
    .resize(1024, 576, { kernel: 'nearest' })
    .modulate({ brightness: 1.04, saturation: 0.72 })
    .png()
    .toBuffer();

  await sharp(pixelated)
    .composite([{ input: paperWash, blend: 'over' }])
    .png({ compressionLevel: 9, palette: true, colours: 64, dither: 0 })
    .toFile(runtime);
  console.log(`Prepared ${runtime}`);
}
