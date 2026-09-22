import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import overworld from '../shared/maps/overworld.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'client/public/art/alignment');
const requireFromMultiplayer = createRequire(path.join(root, 'multiplayer/package.json'));
const sharp = requireFromMultiplayer('sharp');
const { nativeWidth: width, nativeHeight: height, worldScale: scale } = overworld.artRegistration;

function overlay(region) {
  const solids = overworld.solids.filter(({ hidden, region: regionId }) => !hidden && regionId === region.id);
  const lines = solids.map((solid, index) => {
    const x = (solid.x - region.x) / scale;
    const y = solid.y / scale;
    const w = solid.w / scale;
    return `<g><path d="M ${x} ${y} H ${x + w}"/><path class="tick" d="M ${x} ${y - 4} V ${y + 4} M ${x + w} ${y - 4} V ${y + 4}"/><text x="${x + 3}" y="${Math.max(12, y - 6)}">${String(index + 1).padStart(2, '0')} ${solid.feature}</text></g>`;
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <style>path{fill:none;stroke:#00a86b;stroke-width:2;shape-rendering:crispEdges}.tick{stroke-width:1}text{font:7px monospace;fill:#004d32;paint-order:stroke;stroke:#fff;stroke-width:2px;stroke-linejoin:round}</style>
    <rect x="8" y="8" width="252" height="20" fill="#fff" fill-opacity=".9" stroke="#00a86b"/>
    <text x="15" y="21" style="font-size:9px">PHYSICS TOP EDGE / 1 ART PX = ${scale} WORLD PX</text>${lines}
  </svg>`);
}

await mkdir(output, { recursive: true });
const audits = [];
for (let index = 0; index < overworld.regions.length; index += 1) {
  const region = overworld.regions[index];
  const plate = overworld.environmentPlates[index];
  const source = path.join(root, 'client/public', plate.source);
  const destination = path.join(output, `${region.id}-alignment-audit.png`);
  await sharp(source).composite([{ input: overlay(region), blend: 'over' }]).png().toFile(destination);
  audits.push(destination);
  console.log(`${region.label}: ${overworld.solids.filter((solid) => solid.region === region.id && !solid.hidden).length} painted surfaces audited`);
}

await sharp({ create: { width: width * 3, height, channels: 4, background: '#faf9f4' } })
  .composite(audits.map((input, index) => ({ input, left: index * width, top: 0 })))
  .png()
  .toFile(path.join(output, 'overworld-alignment-audit.png'));
console.log(`Exported ${path.join(output, 'overworld-alignment-audit.png')}`);
