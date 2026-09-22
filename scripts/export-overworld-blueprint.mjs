import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import overworld from '../shared/maps/overworld.js';
import { buildStockStrands } from '../shared/worldWebs.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'client/public/art');
const width = 3072;
const height = 576;
const scale = width / overworld.width;
const sx = (value) => Math.round(value * scale * 10) / 10;
const sy = sx;
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
})[char]);

const fills = {
  floor: '#e4e2da', snow: '#dce9ed', rock: '#efeee8', branch: '#ead2d9',
  trunk: '#e3beca', page: '#e3e8f4', card: '#faf9f4', editor: '#e3e8f4'
};

function rect(item, className = '') {
  return `<rect class="${className}" x="${sx(item.x)}" y="${sy(item.y)}" width="${sx(item.w)}" height="${sy(item.h)}" fill="${fills[item.kind] || '#faf9f4'}"/>`;
}

function polyline(points, className) {
  return `<polyline class="${className}" points="${points.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')}"/>`;
}

function motifLayer() {
  const region = overworld.width / 3;
  const mountain = [
    [0, 2050], [800, 1080], [1450, 1780], [2400, 560], [3320, 1660], [4180, 820], [region, 1820]
  ];
  const cx = region * 1.5 + 290;
  const tree = Array.from({ length: 18 }, (_, index) => {
    const angle = (index / 18) * Math.PI * 2;
    const ring = 680 + (index % 4) * 160;
    return `<circle cx="${sx(cx + Math.cos(angle) * ring * 1.25)}" cy="${sy(760 + Math.sin(angle) * ring * 0.44)}" r="${sx(260)}"/>`;
  }).join('');
  return `
    <g class="motif mountain">${polyline(mountain, 'mountain-line')}</g>
    <g class="motif tree-crown">${tree}<path d="M ${sx(cx - 90)} ${sy(2200)} L ${sx(cx - 90)} ${sy(1180)} L ${sx(cx + 90)} ${sy(1180)} L ${sx(cx + 90)} ${sy(2200)}"/></g>
    <g class="motif site-frame"><rect x="${sx(region * 2 + 110)}" y="${sy(300)}" width="${sx(region - 220)}" height="${sy(2050)}"/><line x1="${sx(region * 2 + 110)}" y1="${sy(520)}" x2="${sx(overworld.width - 110)}" y2="${sy(520)}"/></g>`;
}

function labelLayer() {
  const regionTitles = overworld.regions.map((region, index) => (
    `<text class="region-title" x="${sx(region.x + 100)}" y="38">0${index + 1} / ${esc(region.label.toUpperCase())}</text>`
  )).join('');
  const landmarks = overworld.landmarks.map((mark) => (
    `<g class="landmark"><circle cx="${sx(mark.x)}" cy="${sy(mark.y)}" r="5"/><path d="M ${sx(mark.x) - 4} ${sy(mark.y)} h 8 M ${sx(mark.x)} ${sy(mark.y) - 4} v 8"/><text x="${sx(mark.x) + 8}" y="${sy(mark.y) - 7}">${esc(mark.label)}</text></g>`
  )).join('');
  return regionTitles + landmarks;
}

function webLayer() {
  return buildStockStrands(overworld).map((strand) => (
    `<line x1="${sx(strand.x1)}" y1="${sy(strand.y1)}" x2="${sx(strand.x2)}" y2="${sy(strand.y2)}"/>`
  )).join('');
}

function entityLayer() {
  const nests = overworld.nestSlots.map((nest) => (
    `<circle class="nest-zone" cx="${sx(nest.x)}" cy="${sy(nest.y)}" r="${sx(nest.radius)}"/>`
  )).join('');
  const spiders = overworld.npcSpiders.map((npc) => (
    `<circle class="spider" cx="${sx(npc.x)}" cy="${sy(npc.y)}" r="3.2"/>`
  )).join('');
  const people = overworld.humanoids.map((npc) => (
    `<g class="person"><circle cx="${sx(npc.x)}" cy="${sy(npc.y) - 10}" r="3.8"/><path d="M ${sx(npc.x)} ${sy(npc.y) - 6} v 13 m -5 -8 h 10 m -8 8 l -3 8 m 6 -8 l 3 8"/></g>`
  )).join('');
  return nests + spiders + people;
}

function billboardLayer() {
  return overworld.billboards.map((board) => (
    `<g class="billboard"><rect x="${sx(board.x)}" y="${sy(board.y)}" width="${sx(board.w)}" height="${sy(board.h)}"/><line x1="${sx(board.x + 52)}" y1="${sy(board.y + board.h)}" x2="${sx(board.x + 52)}" y2="${sy(board.y + board.h + 90)}"/><line x1="${sx(board.x + board.w - 52)}" y1="${sy(board.y + board.h)}" x2="${sx(board.x + board.w - 52)}" y2="${sy(board.y + board.h + 90)}"/><text x="${sx(board.x + 16)}" y="${sy(board.y + 42)}">OPEN BILLBOARD</text></g>`
  )).join('');
}

const regionWidth = width / 3;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="paper" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="4" cy="7" r="0.7" fill="#706d67" opacity="0.14"/><path d="M 18 25 h 6" stroke="#706d67" opacity="0.07"/></pattern>
    <style>
      text { font-family: "Courier New", monospace; fill: #151412; }
      .region-title { font-size: 18px; font-weight: bold; letter-spacing: 2px; }
      .region-boundary { stroke: #706d67; stroke-width: 1; stroke-dasharray: 8 8; opacity: .45; }
      .solid { stroke: #151412; stroke-width: 2; shape-rendering: crispEdges; }
      .floor { stroke-width: 3; }
      .route { fill: none; stroke: #3159a6; stroke-width: 2; stroke-dasharray: 8 6; opacity: .7; }
      .webs line { stroke: #151412; stroke-width: .75; opacity: .42; }
      .nest-zone { fill: none; stroke: #706d67; stroke-width: .8; stroke-dasharray: 3 3; opacity: .2; }
      .spider { fill: #151412; } .person { fill: none; stroke: #151412; stroke-width: 1.4; }
      .billboard { fill: #faf9f4; stroke: #151412; stroke-width: 1.5; } .billboard text { font-size: 9px; stroke: none; }
      .landmark circle { fill: #faf9f4; stroke: #151412; stroke-width: 1.3; } .landmark path { stroke: #151412; stroke-width: 1; } .landmark text { font-size: 9px; }
      .motif { fill: none; stroke: #706d67; stroke-width: 1.5; opacity: .22; } .tree-crown circle { fill: #ead2d9; } .tree-crown path { fill: #ead2d9; }
    </style>
  </defs>
  <rect width="100%" height="100%" fill="#faf9f4"/>
  <rect width="${regionWidth}" height="100%" fill="#dde9ed" opacity=".42"/>
  <rect x="${regionWidth}" width="${regionWidth}" height="100%" fill="#ead2d9" opacity=".42"/>
  <rect x="${regionWidth * 2}" width="${regionWidth}" height="100%" fill="#e3e8f4" opacity=".42"/>
  <rect width="100%" height="100%" fill="url(#paper)"/>
  ${motifLayer()}
  <line class="region-boundary" x1="${regionWidth}" y1="0" x2="${regionWidth}" y2="${height}"/>
  <line class="region-boundary" x1="${regionWidth * 2}" y1="0" x2="${regionWidth * 2}" y2="${height}"/>
  <g class="routes">${overworld.navigationPaths.map((route) => polyline(route, 'route')).join('')}</g>
  <g class="webs">${webLayer()}</g>
  <g class="nests">${entityLayer()}</g>
  <g class="solids">${overworld.solids.filter(({ hidden }) => !hidden).map((solid) => rect(solid, `solid ${solid.kind === 'floor' ? 'floor' : ''}`)).join('')}</g>
  <g class="billboards">${billboardLayer()}</g>
  <g class="labels">${labelLayer()}</g>
</svg>`;

await mkdir(output, { recursive: true });
const svgPath = path.join(output, 'overworld-scaffold-map.svg');
const pngPath = path.join(output, 'overworld-scaffold-map.png');
await writeFile(svgPath, svg);

const requireFromMultiplayer = createRequire(path.join(root, 'multiplayer/package.json'));
const sharp = requireFromMultiplayer('sharp');
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(pngPath);
for (let index = 0; index < 3; index += 1) {
  await sharp(pngPath)
    .extract({ left: index * regionWidth, top: 0, width: regionWidth, height })
    .png({ compressionLevel: 9 })
    .toFile(path.join(output, `overworld-scaffold-region-${index + 1}.png`));
}

console.log(`Exported ${svgPath}`);
console.log(`Exported ${pngPath}`);
