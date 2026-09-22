const WORLD_WIDTH = 15360;
const WORLD_HEIGHT = 2880;
const REGION_WIDTH = WORLD_WIDTH / 3;
const GROUND_Y = 2464;
const EDITOR_SCALE = 8;

const regions = [
  { id: 'snowfield', type: 'snow', label: 'Snowfield', x: 0, w: REGION_WIDTH },
  { id: 'blossom-crown', type: 'blossom', label: 'Blossom Crown', x: REGION_WIDTH, w: REGION_WIDTH },
  { id: 'live-web', type: 'website', label: 'Live Web', x: REGION_WIDTH * 2, w: REGION_WIDTH }
];

const platform = (x, y, w, kind, feature, h = 32) => ({ x, y, w, h, kind, feature });

const sectionSpecs = {
  snowfield: [
    platform(120, 2220, 760, 'snow', 'arrival shelf', 40),
    platform(1100, 2100, 620, 'snow', 'waterfall lip'),
    platform(1940, 2260, 520, 'snow', 'crystal hollow'),
    platform(2700, 2040, 680, 'snow', 'pine bridge'),
    platform(3620, 2180, 600, 'snow', 'footstep shelf'),
    platform(4480, 1990, 520, 'snow', 'petal approach'),
    platform(520, 1740, 520, 'snow', 'west overlook'),
    platform(1320, 1530, 560, 'snow', 'radio trail'),
    platform(2170, 1690, 480, 'snow', 'frozen relay'),
    platform(2960, 1440, 620, 'snow', 'high white pass'),
    platform(3900, 1590, 520, 'snow', 'pine lookout'),
    platform(4580, 1330, 420, 'snow', 'east ridge'),
    platform(2260, 1120, 500, 'rock', 'mountain step'),
    platform(3180, 920, 720, 'rock', 'mountain signal'),
    platform(4320, 760, 520, 'snow', 'summit shelf')
  ],
  'blossom-crown': [
    platform(80, 2230, 800, 'branch', 'west roots', 40),
    platform(1180, 2310, 680, 'branch', 'petal basin'),
    platform(1960, 2190, 740, 'branch', 'root promenade'),
    platform(3000, 2190, 720, 'branch', 'east roots'),
    platform(3980, 2280, 820, 'branch', 'lantern roots'),
    platform(4880, 2110, 240, 'branch', 'pageward root'),
    platform(360, 1770, 700, 'branch', 'west branch'),
    platform(1300, 1580, 620, 'branch', 'petal limb'),
    platform(2000, 1580, 700, 'branch', 'house approach'),
    platform(3000, 1580, 780, 'branch', 'song branch'),
    platform(4040, 1780, 660, 'branch', 'east bough'),
    platform(1040, 1260, 620, 'branch', 'lantern limb'),
    platform(4060, 1280, 620, 'branch', 'canopy post'),
    platform(2580, 1168, 540, 'branch', 'Isobel house limb'),
    platform(2760, 1200, 180, 'trunk', 'central cherry trunk', 960),
    platform(2100, 760, 620, 'branch', 'west crown'),
    platform(3000, 780, 620, 'branch', 'east crown')
  ],
  'live-web': [
    platform(80, 2240, 620, 'page', 'site threshold', 40),
    platform(1000, 2110, 700, 'card', 'hello card'),
    platform(1980, 2290, 560, 'page', 'archive ledge'),
    platform(2880, 2180, 720, 'card', 'microblog floor'),
    platform(3920, 2280, 520, 'page', 'blue-link landing'),
    platform(4680, 2110, 360, 'page', 'paper edge'),
    platform(320, 1740, 720, 'page', 'navigation rail'),
    platform(1340, 1570, 680, 'card', 'message card'),
    platform(2340, 1820, 620, 'card', 'ravine note'),
    platform(3280, 1640, 760, 'card', 'ravine reply'),
    platform(4340, 1820, 620, 'page', 'contact shelf'),
    platform(120, 1120, 620, 'page', 'hello balcony'),
    platform(1060, 930, 680, 'page', 'player shelf'),
    platform(2080, 1180, 620, 'card', 'notes landing'),
    platform(3060, 980, 720, 'page', 'audio shelf'),
    platform(4120, 1200, 720, 'card', 'speech bubble')
  ]
};

const sectionSolids = regions.flatMap((region) => sectionSpecs[region.id].map((spec, index) => ({
  ...spec,
  id: `${region.id}-${String(index + 1).padStart(2, '0')}`,
  x: region.x + spec.x,
  region: region.id
})));
const floor = {
  id: 'world-floor', x: 0, y: GROUND_Y, w: WORLD_WIDTH, h: WORLD_HEIGHT - GROUND_Y,
  kind: 'floor', feature: 'continuous paper ground', region: 'all'
};
const solids = [floor, ...sectionSolids];

const navigationPaths = [
  [[300, 2090], [780, 1690], [1550, 1480], [2380, 1630], [3290, 1360], [3540, 850], [4680, 1260], [5060, 1840]],
  [[5180, 2070], [5760, 1700], [6500, 1370], [7420, 1080], [7970, 650], [8700, 1080], [9500, 1420], [10120, 1960]],
  [[10300, 2100], [10920, 1680], [11720, 1380], [12520, 1740], [13040, 1460], [13920, 1440], [14700, 1760], [15220, 2020]]
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

const ledgeAnchors = sectionSolids.flatMap((solid) => {
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

const npcSpiders = regions.flatMap((region, regionIndex) => [0, 1, 2, 3].map((index) => ({
  id: `${region.id}-resident-${index + 1}`,
  name: ['old spinner', 'snow thread', 'petal keeper', 'page crawler'][(regionIndex + index) % 4],
  x: region.x + 820 + index * 1080,
  y: GROUND_Y - 22,
  range: 70 + index * 14,
  speed: 0.0003 + index * 0.000022,
  palette: ['frost', 'amber', 'berry', 'autumn'][(regionIndex + index) % 4],
  phase: regionIndex + index * 0.71
})));

const humanoids = [
  { id: 'snow-listener', name: 'The Listener / weather', frame: 1, x: 3490, y: 920, scale: 0.2 },
  { id: 'isobel', name: 'Isobel / songs', frame: 0, x: 7850, y: 1168, scale: 0.23 },
  { id: 'signal-kid', name: 'Signal Kid / maps', frame: 2, x: 11920, y: 1570, scale: 0.2 },
  { id: 'cat-courier', name: 'Cat Courier / notes', frame: 3, x: 14000, y: 1640, scale: 0.2 }
];

const billboards = [
  { id: 'snow-trail', x: 260, y: 1890, w: 420, h: 220, label: 'TRAIL NOTICE / OPEN SPACE' },
  { id: 'mountain-overlook', x: 3230, y: 610, w: 520, h: 220, label: 'MOUNTAIN SIGNAL / OPEN SPACE' },
  { id: 'tree-left', x: 5900, y: 1900, w: 400, h: 210, label: 'HANGING SCROLL / OPEN SPACE' },
  { id: 'tree-right', x: 9100, y: 1480, w: 420, h: 210, label: 'CANOPY POSTER / OPEN SPACE' },
  { id: 'site-index', x: 10450, y: 700, w: 620, h: 260, label: 'SITE WINDOW / OPEN SPACE' },
  { id: 'ravine-wall', x: 12920, y: 1220, w: 520, h: 250, label: 'BLOG FEATURE / OPEN SPACE' },
  { id: 'page-edge', x: 14620, y: 1460, w: 500, h: 240, label: 'LINK PANEL / OPEN SPACE' }
];

const waypoints = [
  { id: 'snowfield', label: '01 / SNOWFIELD', x: 320, y: 2110 },
  { id: 'blossom-crown', label: '02 / BLOSSOM CROWN', x: 5340, y: 2110 },
  { id: 'isobels-tree', label: "03 / ISOBEL'S TREE", x: 8090, y: 1070 },
  { id: 'live-web', label: '04 / LIVE WEB', x: 10420, y: 2110 },
  { id: 'microblog-ravine', label: '05 / MICROBLOG RAVINE', x: 13120, y: 1550 },
  { id: 'paper-edge', label: '06 / PAPER EDGE', x: 15020, y: 2020 }
];

export default {
  id: 'overworld',
  name: "Isobel's Overworld / Scaffold 02",
  scaffoldVersion: 2,
  seed: 'pictochat-paper-02',
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  groundY: GROUND_Y,
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
