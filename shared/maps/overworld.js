import sakuraCollision from './sakuraCollision.js';

const WORLD_WIDTH = 15360;
const WORLD_HEIGHT = 2880;
const REGION_WIDTH = WORLD_WIDTH / 3;
const GROUND_Y = 2570;
const EDITOR_SCALE = 8;
const ART_SCALE = 5;

const regions = [
  { id: 'snowfield', type: 'snow', label: 'Snowfield', x: 0, w: REGION_WIDTH },
  { id: 'blossom-crown', type: 'blossom', label: 'Blossom Crown', x: REGION_WIDTH, w: REGION_WIDTH },
  { id: 'live-web', type: 'website', label: 'Live Web', x: REGION_WIDTH * 2, w: REGION_WIDTH }
];

// Runtime plates are 1024x576 and each region is 5120x2880. Keeping the
// collision ledges in plate pixels makes the art/physics registration explicit.
const platformPx = (x, y, w, kind, feature, h = 32) => ({
  x: x * ART_SCALE, y: y * ART_SCALE, w: w * ART_SCALE, h, kind, feature,
  artPixel: { x, y, w }
});
const collisionPx = ({ x, y, w, h, ...details }) => ({
  ...details,
  x: x * ART_SCALE, y: y * ART_SCALE, w: w * ART_SCALE, h: h * ART_SCALE,
  artPixel: { x, y, w, h }
});
const billboardPx = (id, regionId, x, y, w, h, label) => {
  const region = regions.find(({ id: candidate }) => candidate === regionId);
  return {
    id, region: regionId, x: region.x + x * ART_SCALE, y: y * ART_SCALE,
    w: w * ART_SCALE, h: h * ART_SCALE, label, artPixel: { x, y, w, h }
  };
};

const sectionSpecs = {
  snowfield: [
    platformPx(30, 449, 140, 'snow', 'arrival shelf', 40),
    platformPx(218, 420, 122, 'snow', 'waterfall lip'),
    platformPx(381, 452, 105, 'snow', 'crystal hollow'),
    platformPx(550, 405, 120, 'snow', 'pine bridge'),
    platformPx(727, 439, 122, 'snow', 'footstep shelf'),
    platformPx(900, 391, 104, 'snow', 'petal approach'),
    platformPx(104, 342, 104, 'snow', 'west overlook'),
    platformPx(258, 306, 125, 'snow', 'radio trail'),
    platformPx(434, 335, 101, 'snow', 'frozen relay'),
    platformPx(586, 286, 124, 'snow', 'high white pass'),
    platformPx(779, 318, 106, 'snow', 'pine lookout'),
    platformPx(912, 259, 92, 'snow', 'east ridge'),
    platformPx(445, 219, 114, 'rock', 'mountain step'),
    platformPx(630, 180, 142, 'rock', 'mountain signal'),
    platformPx(868, 150, 106, 'snow', 'summit shelf')
  ],
  'blossom-crown': [
    platformPx(0, 433, 157, 'branch', 'west roots', 40),
    platformPx(196, 456, 149, 'branch', 'petal basin'),
    platformPx(384, 423, 146, 'branch', 'root promenade'),
    platformPx(576, 429, 162, 'branch', 'east roots'),
    platformPx(793, 449, 154, 'branch', 'lantern roots'),
    platformPx(981, 389, 43, 'branch', 'pageward root'),
    platformPx(48, 326, 118, 'branch', 'west branch'),
    platformPx(248, 291, 101, 'branch', 'petal limb'),
    platformPx(410, 295, 122, 'branch', 'house approach'),
    platformPx(626, 292, 134, 'branch', 'song branch'),
    platformPx(762, 337, 179, 'branch', 'east bough'),
    platformPx(197, 213, 127, 'branch', 'lantern limb'),
    platformPx(827, 214, 114, 'branch', 'canopy post'),
    platformPx(493, 218, 132, 'branch', 'Isobel house limb'),
    platformPx(410, 130, 308, 'branch', 'treehouse porch / crown floor'),
    ...sakuraCollision.map(collisionPx)
  ],
  'live-web': [
    platformPx(8, 443, 119, 'page', 'site threshold', 40),
    platformPx(151, 395, 185, 'card', 'hello card'),
    platformPx(381, 450, 95, 'page', 'archive ledge'),
    platformPx(558, 426, 150, 'card', 'microblog floor'),
    platformPx(736, 448, 127, 'page', 'blue-link landing'),
    platformPx(867, 468, 148, 'page', 'paper edge'),
    platformPx(62, 332, 121, 'page', 'navigation rail'),
    platformPx(267, 299, 142, 'card', 'message card'),
    platformPx(466, 352, 104, 'card', 'ravine note'),
    platformPx(627, 311, 165, 'card', 'ravine reply'),
    platformPx(840, 344, 174, 'page', 'contact shelf'),
    platformPx(8, 188, 168, 'page', 'hello balcony'),
    platformPx(223, 168, 122, 'page', 'player shelf'),
    platformPx(416, 219, 115, 'card', 'notes landing'),
    platformPx(618, 180, 97, 'page', 'audio shelf'),
    platformPx(794, 217, 122, 'card', 'speech bubble')
  ]
};

const sectionSolids = regions.flatMap((region) => sectionSpecs[region.id].map((spec, index) => ({
  ...spec,
  id: `${region.id}-${String(index + 1).padStart(2, '0')}`,
  x: region.x + spec.x,
  region: region.id,
  structure: spec.structure || (region.id === 'blossom-crown' ? 'sakura-tree' : undefined)
})));
const floors = [
  { id: 'snowfield-floor', x: 0, y: 2490, w: REGION_WIDTH, h: 390, kind: 'floor', feature: 'snowfield ground', region: 'snowfield', artPixel: { x: 0, y: 498, w: 1024 } },
  { id: 'blossom-floor', x: REGION_WIDTH, y: 2570, w: REGION_WIDTH, h: 310, kind: 'floor', feature: 'blossom ground', region: 'blossom-crown', structure: 'sakura-tree', artPixel: { x: 0, y: 514, w: 1024 } },
  { id: 'live-web-catch', x: REGION_WIDTH * 2, y: 2760, w: REGION_WIDTH, h: 120, kind: 'floor', feature: 'hidden page catch', region: 'live-web', hidden: true }
];
const solids = [...floors, ...sectionSolids];

const navigationPaths = [
  [[300, 2180], [780, 1660], [1550, 1450], [2380, 1620], [3290, 1380], [3540, 850], [4680, 1210], [5060, 1850]],
  [[5180, 2110], [5760, 1580], [6500, 1400], [7420, 1040], [7970, 600], [8700, 1410], [9500, 1630], [10120, 1890]],
  [[10300, 2160], [10920, 1610], [11720, 1440], [12520, 1710], [13040, 1500], [13920, 1670], [14700, 1030], [15220, 2290]]
];

function pathAnchors(points) {
  const anchors = [];
  points.forEach((point, index) => {
    const next = points[index + 1];
    anchors.push({ x: point[0], y: point[1], visible: true });
    if (!next) return;
    const steps = Math.ceil(Math.hypot(next[0] - point[0], next[1] - point[1]) / 190);
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      anchors.push({
        x: Math.round(point[0] + (next[0] - point[0]) * t),
        y: Math.round(point[1] + (next[1] - point[1]) * t),
        visible: step % 4 === 0
      });
    }
  });
  return anchors;
}

const ledgeAnchors = sectionSolids.filter(({ anchorable }) => anchorable !== false).flatMap((solid) => {
  const count = Math.max(1, Math.floor(solid.w / 260));
  return Array.from({ length: count }, (_, index) => ({
    x: Math.round(solid.x + ((index + 1) / (count + 1)) * solid.w),
    y: solid.y - 78,
    visible: false
  }));
});
const anchors = [...navigationPaths.flatMap(pathAnchors), ...ledgeAnchors];

function clearNestSlot(slot) {
  let y = slot.y;
  while (y > 260 && solids.some((solid) => (
    slot.x > solid.x - slot.radius - 28 && slot.x < solid.x + solid.w + slot.radius + 28 &&
    y > solid.y - slot.radius - 28 && y < solid.y + solid.h + slot.radius + 28
  ))) y -= 190;
  return { ...slot, y: Math.max(190, y) };
}

const localNestSlots = Array.from({ length: 24 }, (_, index) => {
  const column = index % 8;
  const row = Math.floor(index / 8);
  return {
    x: 360 + column * 620 + (row % 2) * 110,
    y: [2110, 1430, 650][row],
    radius: 104 + (index % 3) * 7,
    spokes: 8 - (index % 2),
    rings: 3,
    phase: index * 0.11
  };
});
const nestSlots = localNestSlots.flatMap((slot, local) => regions.map((region, regionIndex) => (
  clearNestSlot({ ...slot, id: local * regions.length + regionIndex, x: region.x + slot.x })
)));

const staticWebs = regions.flatMap((region, regionIndex) => Array.from({ length: 8 }, (_, index) => ({
  id: `old-web-${region.id}-${index + 1}`,
  x: region.x + 280 + index * 590 - (region.id === 'blossom-crown' && index === 4 ? 240 : 0),
  y: 390 + (index % 3) * 610,
  radius: 96 + (index % 3) * 10,
  spokes: 7 + (index % 2),
  rings: 3,
  phase: regionIndex * 0.18 + index * 0.07
})));

const residentSpots = {
  snowfield: [[820, 2468], [1900, 2468], [2980, 2468], [4060, 2468]],
  'blossom-crown': [[820, 2548], [1900, 2548], [2980, 2548], [4060, 2548]],
  'live-web': [[1000, 1953], [2100, 2228], [3050, 2108], [4000, 2218]]
};
const npcSpiders = regions.flatMap((region, regionIndex) => residentSpots[region.id].map(([x, y], index) => ({
  id: `${region.id}-resident-${index + 1}`,
  name: ['old spinner', 'snow thread', 'petal keeper', 'page crawler'][(regionIndex + index) % 4],
  x: region.x + x,
  y,
  range: 70 + index * 14,
  speed: 0.0003 + index * 0.000022,
  palette: ['frost', 'amber', 'berry', 'autumn'][(regionIndex + index) % 4],
  phase: regionIndex + index * 0.71
})));

const humanoids = [
  { id: 'snow-listener', name: 'The Listener / weather', frame: 1, x: 3490, y: 900, scale: 0.2 },
  { id: 'isobel', name: 'Isobel / songs', frame: 0, x: 7850, y: 1090, scale: 0.23 },
  { id: 'signal-kid', name: 'Signal Kid / maps', frame: 2, x: 11920, y: 1495, scale: 0.2 },
  { id: 'cat-courier', name: 'Cat Courier / notes', frame: 3, x: 14000, y: 1555, scale: 0.2 }
];

const billboards = [
  billboardPx('snow-trail', 'snowfield', 44, 381, 101, 44, 'TRAIL NOTICE / OPEN SPACE'),
  billboardPx('mountain-overlook', 'snowfield', 640, 127, 99, 39, 'MOUNTAIN SIGNAL / OPEN SPACE'),
  billboardPx('tree-left', 'blossom-crown', 110, 375, 100, 41, 'HANGING SCROLL / OPEN SPACE'),
  billboardPx('tree-right', 'blossom-crown', 792, 277, 90, 37, 'CANOPY POSTER / OPEN SPACE'),
  billboardPx('site-index', 'live-web', 28, 108, 132, 58, 'SITE WINDOW / OPEN SPACE'),
  billboardPx('ravine-wall', 'live-web', 530, 220, 128, 66, 'BLOG FEATURE / OPEN SPACE'),
  billboardPx('page-edge', 'live-web', 876, 271, 119, 54, 'LINK PANEL / OPEN SPACE')
];

const waypoints = [
  { id: 'snowfield', label: '01 / SNOWFIELD', x: 320, y: 2180 },
  { id: 'blossom-crown', label: '02 / BLOSSOM CROWN', x: 5340, y: 2110 },
  { id: 'isobels-tree', label: "03 / ISOBEL'S TREE", x: 8090, y: 1040 },
  { id: 'live-web', label: '04 / LIVE WEB', x: 10420, y: 2160 },
  { id: 'microblog-ravine', label: '05 / MICROBLOG RAVINE', x: 13120, y: 1500 },
  { id: 'paper-edge', label: '06 / PAPER EDGE', x: 15020, y: 2290 }
];

export default {
  id: 'overworld',
  name: "Isobel's Overworld / Scaffold 02",
  scaffoldVersion: 2,
  seed: 'pictochat-paper-02',
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  groundY: GROUND_Y,
  artRegistration: { nativeWidth: 1024, nativeHeight: 576, worldScale: ART_SCALE },
  editorGrid: {
    texture: 'overworld-builder-layer',
    nativeWidth: WORLD_WIDTH / EDITOR_SCALE,
    nativeHeight: WORLD_HEIGHT / EDITOR_SCALE,
    scale: EDITOR_SCALE
  },
  environmentPlates: [
    {
      id: 'snowfield-pixel', texture: 'snowfield-pixel-environment',
      source: '/art/generated/snowfield-pixel-environment-v1-runtime.png',
      x: regions[0].x, w: regions[0].w, alpha: 0.74
    },
    {
      id: 'blossom-crown-pixel', texture: 'blossom-crown-pixel-environment',
      source: '/art/generated/blossom-crown-pixel-environment-v1-runtime.png',
      x: regions[1].x, w: regions[1].w, alpha: 0.72
    },
    {
      id: 'live-web-pixel', texture: 'live-web-pixel-environment',
      source: '/art/generated/live-web-pixel-environment-v1-runtime.png',
      x: regions[2].x, w: regions[2].w, alpha: 0.7
    }
  ],
  spawn: { x: 320, y: 2110 },
  nest: { x: nestSlots[0].x, y: nestSlots[0].y },
  anchors,
  navigationPaths,
  nestSlots,
  staticWebs,
  npcSpiders,
  humanoids,
  regions,
  rooms: regions.map(({ x, w, label }) => ({ x, w, label })),
  waypoints,
  billboards,
  microblogPosts: [
    { x: 12600, y: 1430, date: '05.20', title: 'a note from the road', body: 'the page keeps going if you let it' },
    { x: 13480, y: 1260, date: '05.31', title: 'violet / birdsong', body: 'music for a very small window' },
    { x: 14220, y: 1510, date: '06.09', title: 'web update', body: 'made a place for wandering' }
  ],
  landmarks: [
    { x: 1480, y: 1470, label: 'snow radio trail' },
    { x: 3540, y: 850, label: 'high white pass' },
    { x: 7970, y: 650, label: "Isobel's crown" },
    { x: 10020, y: 1920, label: 'petal transition' },
    { x: 10920, y: 1660, label: 'blue-link landing' },
    { x: 13120, y: 1510, label: 'microblog ravine' },
    { x: 15020, y: 1980, label: 'old paper edge' }
  ],
  backgrounds: [],
  solids
};
