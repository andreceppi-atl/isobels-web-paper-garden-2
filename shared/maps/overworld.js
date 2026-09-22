const REGION_WIDTH = 25600;
const WORLD_WIDTH = REGION_WIDTH * 3;
const WORLD_HEIGHT = 7680;
const GROUND_Y = 7420;

const regions = [
  { id: 'snowfield', type: 'snow', label: 'Snowfield', x: 0, w: REGION_WIDTH },
  { id: 'blossom-crown', type: 'blossom', label: 'Blossom Crown', x: REGION_WIDTH, w: REGION_WIDTH },
  { id: 'live-web', type: 'website', label: 'Live Web', x: REGION_WIDTH * 2, w: REGION_WIDTH }
];

const floor = { x: 0, y: GROUND_Y, w: WORLD_WIDTH, h: WORLD_HEIGHT - GROUND_Y, kind: 'floor' };

function ribbon(startX, count, kind, yForIndex) {
  return Array.from({ length: count }, (_, index) => ({
    x: startX + 420 + index * 820,
    y: yForIndex(index),
    w: 500,
    h: 58,
    kind
  }));
}

const snowPlatforms = ribbon(0, 30, 'snow', (index) => {
  const step = index % 16;
  const rise = step <= 8 ? step : 16 - step;
  return 6840 - rise * 510;
});

const snowTowers = [3, 9, 15, 21, 27].map((index) => ({
  x: 420 + index * 820 + 600,
  y: 6380 - (index % 3) * 260,
  w: 120,
  h: GROUND_Y - (6380 - (index % 3) * 260),
  kind: 'tower'
}));

const treeTrunk = { x: 38040, y: 2460, w: 720, h: GROUND_Y - 2460, kind: 'trunk' };
const blossomApproach = ribbon(REGION_WIDTH, 30, 'branch', (index) => (
  6540 - (Math.sin(index * 0.72) + 1) * 980 - (index % 4) * 110
)).filter((solid) => solid.x + solid.w < treeTrunk.x - 80 || solid.x > treeTrunk.x + treeTrunk.w + 80);

const treeBranches = [
  { x: 36500, y: 5600, w: 1200, h: 70, kind: 'branch' },
  { x: 39100, y: 5200, w: 1600, h: 70, kind: 'branch' },
  { x: 35000, y: 4400, w: 2700, h: 70, kind: 'branch' },
  { x: 39100, y: 4000, w: 3000, h: 70, kind: 'branch' },
  { x: 35800, y: 3200, w: 1900, h: 70, kind: 'branch' },
  { x: 39100, y: 3000, w: 2200, h: 70, kind: 'branch' },
  { x: 37000, y: 1900, w: 700, h: 70, kind: 'branch' },
  { x: 39100, y: 1850, w: 920, h: 70, kind: 'branch' }
];

const liveApproachLeft = ribbon(REGION_WIDTH * 2, 11, 'page', (index) => 6280 - (index % 6) * 430);
const liveApproachRight = ribbon(73000, 4, 'page', (index) => 6240 - ((index + 2) % 6) * 460);

const ravineCards = [
  { x: 60800, y: 3860, w: 1600, h: 74, kind: 'card' },
  { x: 62000, y: 4320, w: 1600, h: 74, kind: 'card' },
  { x: 63200, y: 4800, w: 1600, h: 74, kind: 'card' },
  { x: 64400, y: 5300, w: 1600, h: 74, kind: 'card' },
  { x: 65600, y: 5800, w: 1600, h: 74, kind: 'card' },
  { x: 66800, y: 6320, w: 1600, h: 74, kind: 'card' },
  { x: 68000, y: 6860, w: 1600, h: 74, kind: 'card' },
  { x: 69200, y: 6320, w: 1600, h: 74, kind: 'card' },
  { x: 70400, y: 5760, w: 1600, h: 74, kind: 'card' },
  { x: 71600, y: 5200, w: 1600, h: 74, kind: 'card' }
];

const liveTowers = [
  { x: 54840, y: 5980, w: 140, h: GROUND_Y - 5980, kind: 'page' },
  { x: 57960, y: 5660, w: 140, h: GROUND_Y - 5660, kind: 'page' },
  { x: 73780, y: 5860, w: 140, h: GROUND_Y - 5860, kind: 'page' }
];

const solids = [
  floor,
  ...snowPlatforms,
  ...snowTowers,
  ...blossomApproach,
  treeTrunk,
  ...treeBranches,
  ...liveApproachLeft,
  ...ravineCards,
  ...liveApproachRight,
  ...liveTowers
];

function routeAnchors(platforms, lift = 160) {
  const ordered = [...platforms].sort((a, b) => a.x - b.x);
  const points = ordered.map((solid) => ({ x: solid.x + solid.w / 2, y: Math.max(180, solid.y - lift) }));
  const anchors = [];
  points.forEach((point, index) => {
    anchors.push(point);
    const next = points[index + 1];
    if (!next) return;
    const distance = Math.hypot(next.x - point.x, next.y - point.y);
    const steps = Math.ceil(distance / 220);
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      anchors.push({
        x: point.x + (next.x - point.x) * t,
        y: point.y + (next.y - point.y) * t
      });
    }
  });
  return anchors;
}

const treeAnchors = Array.from({ length: 20 }, (_, index) => ({
  x: index % 2 ? treeTrunk.x - 90 : treeTrunk.x + treeTrunk.w + 90,
  y: 6900 - index * 245
}));

const anchors = [
  ...routeAnchors(snowPlatforms),
  ...routeAnchors(blossomApproach),
  ...routeAnchors(treeBranches, 130),
  ...treeAnchors,
  ...routeAnchors(liveApproachLeft),
  ...routeAnchors(ravineCards, 130),
  ...routeAnchors(liveApproachRight)
];

function clearNestSlot(slot) {
  let y = slot.y;
  while (y > 420 && solids.some((solid) => (
    slot.x > solid.x - slot.radius - 36 && slot.x < solid.x + solid.w + slot.radius + 36 &&
    y > solid.y - slot.radius - 36 && y < solid.y + solid.h + slot.radius + 36
  ))) y -= 260;
  return { ...slot, y };
}

const localNestSlots = Array.from({ length: 24 }, (_, index) => {
  const column = index % 8;
  const row = Math.floor(index / 8);
  return {
    x: 1500 + column * 3000 + (row % 2) * 860,
    y: [6440, 4260, 2040][row],
    radius: 180 + (index % 3) * 8,
    spokes: 8 - (index % 2),
    rings: 3,
    phase: index * 0.11
  };
});

const nestSlots = localNestSlots.flatMap((slot, local) => regions.map((region, regionIndex) => (
  clearNestSlot({ ...slot, id: local * regions.length + regionIndex, x: region.x + slot.x })
)));

const staticWebs = regions.flatMap((region, regionIndex) => Array.from({ length: 10 }, (_, index) => ({
  id: `old-web-${region.id}-${index + 1}`,
  x: region.x + 920 + index * 2440,
  y: 860 + (index % 4) * 1380,
  radius: 150 + (index % 3) * 22,
  spokes: 7 + (index % 2),
  rings: 3,
  phase: regionIndex * 0.18 + index * 0.07
})));

const npcSpiders = regions.flatMap((region, regionIndex) => Array.from({ length: 6 }, (_, index) => ({
  id: `${region.id}-resident-${index + 1}`,
  name: ['old spinner', 'snow thread', 'petal keeper', 'page crawler'][((regionIndex * 2) + index) % 4],
  x: region.x + 1700 + index * 3900,
  y: 7100 - (index % 2) * 260,
  range: 80 + (index % 3) * 22,
  speed: 0.00028 + index * 0.000018,
  palette: ['frost', 'amber', 'berry', 'autumn'][(regionIndex + index) % 4],
  phase: regionIndex + index * 0.71
})));

const humanoids = [
  { id: 'snow-listener', name: 'The Listener / weather', frame: 1, x: 9200, y: 7400, scale: 0.25 },
  { id: 'isobel', name: 'Isobel / songs', frame: 0, x: 37600, y: 7400, scale: 0.3 },
  { id: 'signal-kid', name: 'Signal Kid / maps', frame: 2, x: 55800, y: 7400, scale: 0.25 },
  { id: 'cat-courier', name: 'Cat Courier / notes', frame: 3, x: 74400, y: 7400, scale: 0.25 }
];

const billboards = [
  { id: 'snow-trail', x: 5400, y: 6640, w: 640, h: 360, label: 'TRAIL NOTICE / OPEN SPACE' },
  { id: 'mountain-overlook', x: 17200, y: 3160, w: 760, h: 430, label: 'MOUNTAIN SIGNAL / OPEN SPACE' },
  { id: 'tree-left', x: 33600, y: 5740, w: 620, h: 420, label: 'HANGING SCROLL / OPEN SPACE' },
  { id: 'tree-right', x: 42100, y: 4760, w: 700, h: 390, label: 'CANOPY POSTER / OPEN SPACE' },
  { id: 'site-index', x: 54800, y: 3120, w: 760, h: 440, label: 'SITE WINDOW / OPEN SPACE' },
  { id: 'ravine-wall', x: 65200, y: 3420, w: 760, h: 430, label: 'BLOG FEATURE / OPEN SPACE' },
  { id: 'page-edge', x: 74200, y: 4160, w: 700, h: 400, label: 'LINK PANEL / OPEN SPACE' }
];

const waypoints = [
  { id: 'snowfield', label: '01 / SNOWFIELD', x: 1100, y: 7040 },
  { id: 'blossom-crown', label: '02 / BLOSSOM CROWN', x: 27200, y: 7040 },
  { id: 'isobels-tree', label: "03 / ISOBEL'S TREE", x: 36700, y: 3040 },
  { id: 'live-web', label: '04 / LIVE WEB', x: 52800, y: 7040 },
  { id: 'microblog-ravine', label: '05 / MICROBLOG RAVINE', x: 64600, y: 4740 },
  { id: 'paper-edge', label: '06 / PAPER EDGE', x: 75200, y: 7040 }
];

const microblogPosts = [
  { x: 61600, y: 3590, date: '05.20', title: 'a note from the road', body: 'the page keeps going if you let it' },
  { x: 62800, y: 4050, date: '05.31', title: 'violet / birdsong', body: 'music for a very small window' },
  { x: 64000, y: 4530, date: '06.09', title: 'web update', body: 'made a place for wandering' },
  { x: 65200, y: 5030, date: '06.22', title: 'found image', body: 'a soft thing caught in the archive' },
  { x: 66400, y: 5530, date: '07.01', title: 'guestbook weather', body: 'today the internet is lightly snowing' }
];

export default {
  id: 'overworld',
  name: "Isobel's Overworld",
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  spawn: { x: 760, y: 7040 },
  nest: { x: nestSlots[0].x, y: nestSlots[0].y },
  anchors,
  nestSlots,
  staticWebs,
  npcSpiders,
  humanoids,
  regions,
  rooms: regions.map(({ x, w, label }) => ({ x, w, label })),
  waypoints,
  billboards,
  microblogPosts,
  landmarks: [
    { x: 8600, y: 6120, label: 'snow radio trail' },
    { x: 17800, y: 2580, label: 'high white pass' },
    { x: 38400, y: 2260, label: "Isobel's crown" },
    { x: 46200, y: 5080, label: 'petal transition' },
    { x: 55200, y: 5560, label: 'blue-link landing' },
    { x: 66000, y: 5480, label: 'microblog ravine' },
    { x: 74800, y: 5280, label: 'old paper edge' }
  ],
  backgrounds: [],
  solids
};
