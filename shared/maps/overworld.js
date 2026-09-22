const ART_WIDTH = 2172;
const ART_HEIGHT = 724;
const ART_REGION = 724;
const ART_SCALE = 8;
const REGION_WIDTH = ART_REGION * ART_SCALE;
const WORLD_WIDTH = ART_WIDTH * ART_SCALE;
const WORLD_HEIGHT = ART_HEIGHT * ART_SCALE;
const GROUND_Y = 674 * ART_SCALE;

const artX = (value) => Math.round(value * ART_SCALE);
const artY = (value) => Math.round(value * ART_SCALE);
const artRect = ([x, y, w, h, kind, feature]) => ({
  x: artX(x), y: artY(y), w: artX(w), h: artY(h), kind, feature
});
const artPoint = (x, y) => ({ x: artX(x), y: artY(y) });

const regions = [
  { id: 'snowfield', type: 'snow', label: 'Snowfield', x: 0, w: REGION_WIDTH },
  { id: 'blossom-crown', type: 'blossom', label: 'Blossom Crown', x: REGION_WIDTH, w: REGION_WIDTH },
  { id: 'live-web', type: 'website', label: 'Live Web', x: REGION_WIDTH * 2, w: REGION_WIDTH }
];

const floor = { x: 0, y: GROUND_Y, w: WORLD_WIDTH, h: WORLD_HEIGHT - GROUND_Y, kind: 'floor', feature: 'paper foreground' };

const snowPlatforms = [
  [0, 124, 180, 10, 'snow', 'arrival cliff'],
  [194, 182, 98, 10, 'snow', 'waterfall lip'],
  [0, 314, 132, 10, 'snow', 'west overlook'],
  [12, 432, 158, 10, 'snow', 'footstep shelf'],
  [214, 486, 178, 10, 'snow', 'lower bridge'],
  [10, 555, 185, 10, 'snow', 'crystal hollow'],
  [270, 365, 198, 10, 'snow', 'pine bridge'],
  [430, 497, 178, 10, 'snow', 'east waterfall'],
  [518, 608, 198, 10, 'snow', 'petal approach'],
  [285, 638, 180, 10, 'snow', 'river stones']
].map(artRect);

const blossomPlatforms = [
  [724, 334, 168, 10, 'branch', 'west branch'],
  [836, 190, 400, 10, 'branch', 'Isobel house limb'],
  [808, 258, 156, 10, 'branch', 'lantern limb'],
  [1002, 322, 184, 10, 'branch', 'middle bough'],
  [1230, 300, 210, 10, 'branch', 'east bough'],
  [724, 506, 716, 10, 'branch', 'root promenade'],
  [796, 585, 190, 10, 'branch', 'west roots'],
  [1024, 598, 230, 10, 'branch', 'shrine roots'],
  [1272, 580, 168, 10, 'branch', 'east roots']
].map(artRect);

const livePlatforms = [
  [1576, 184, 148, 10, 'page', 'hello balcony'],
  [1748, 209, 154, 10, 'page', 'player shelf'],
  [1914, 184, 250, 10, 'page', 'audio shelf'],
  [1522, 294, 160, 10, 'page', 'left page step'],
  [1698, 338, 194, 10, 'card', 'message card'],
  [1954, 307, 210, 10, 'page', 'right page step'],
  [1508, 410, 220, 10, 'card', 'notes landing'],
  [1760, 450, 184, 10, 'page', 'blue link bridge'],
  [1970, 414, 194, 10, 'card', 'speech bubble'],
  [1482, 544, 220, 10, 'page', 'archive ledge'],
  [1740, 574, 190, 10, 'card', 'microblog floor'],
  [1958, 530, 206, 10, 'page', 'paper edge'],
  [1808, 382, 120, 10, 'card', 'ravine note'],
  [1888, 474, 130, 10, 'card', 'ravine reply'],
  [1768, 632, 190, 10, 'page', 'canal landing']
].map(artRect);

const solids = [floor, ...snowPlatforms, ...blossomPlatforms, ...livePlatforms];

function routeAnchors(platforms) {
  const points = [...platforms]
    .sort((a, b) => a.x - b.x)
    .map((solid) => ({ x: solid.x + solid.w / 2, y: solid.y - 92 }));
  const anchors = [];
  points.forEach((point, index) => {
    anchors.push({ ...point, visible: true });
    const next = points[index + 1];
    if (!next) return;
    const steps = Math.ceil(Math.hypot(next.x - point.x, next.y - point.y) / 210);
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      anchors.push({
        x: point.x + (next.x - point.x) * t,
        y: point.y + (next.y - point.y) * t,
        visible: step % 5 === 0
      });
    }
  });
  return anchors;
}

const anchors = [
  ...routeAnchors(snowPlatforms),
  ...routeAnchors(blossomPlatforms),
  ...routeAnchors(livePlatforms)
];

function clearNestSlot(slot) {
  let y = slot.y;
  while (y > 360 && solids.some((solid) => (
    slot.x > solid.x - slot.radius - 36 && slot.x < solid.x + solid.w + slot.radius + 36 &&
    y > solid.y - slot.radius - 36 && y < solid.y + solid.h + slot.radius + 36
  ))) y -= 220;
  return { ...slot, y };
}

const localNestSlots = Array.from({ length: 24 }, (_, index) => {
  const column = index % 8;
  const row = Math.floor(index / 8);
  return {
    x: 520 + column * 660 + (row % 2) * 210,
    y: [4680, 3320, 1820][row],
    radius: 145 + (index % 3) * 8,
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
  x: region.x + 420 + index * 540,
  y: 720 + (index % 4) * 1120,
  radius: 142 + (index % 3) * 18,
  spokes: 7 + (index % 2),
  rings: 3,
  phase: regionIndex * 0.18 + index * 0.07
})));

const npcSpiders = regions.flatMap((region, regionIndex) => Array.from({ length: 6 }, (_, index) => ({
  id: `${region.id}-resident-${index + 1}`,
  name: ['old spinner', 'snow thread', 'petal keeper', 'page crawler'][((regionIndex * 2) + index) % 4],
  x: region.x + 620 + index * 900,
  y: GROUND_Y - 22 - (index % 2) * 180,
  range: 80 + (index % 3) * 22,
  speed: 0.00028 + index * 0.000018,
  palette: ['frost', 'amber', 'berry', 'autumn'][(regionIndex + index) % 4],
  phase: regionIndex + index * 0.71
})));

const humanoids = [
  { id: 'snow-listener', name: 'The Listener / weather', frame: 1, ...artPoint(330, 475), scale: 0.25 },
  { id: 'isobel', name: 'Isobel / songs', frame: 0, ...artPoint(1086, 492), scale: 0.3 },
  { id: 'signal-kid', name: 'Signal Kid / maps', frame: 2, ...artPoint(1810, 324), scale: 0.25 },
  { id: 'cat-courier', name: 'Cat Courier / notes', frame: 3, ...artPoint(2074, 402), scale: 0.25 }
];

const board = (id, x, y, w, h, label) => ({ id, ...artPoint(x, y), w: artX(w), h: artY(h), label });
const billboards = [
  board('snow-trail', 94, 72, 72, 48, 'TRAIL NOTICE / OPEN SPACE'),
  board('mountain-overlook', 334, 370, 62, 72, 'MOUNTAIN SIGNAL / OPEN SPACE'),
  board('tree-left', 837, 82, 50, 72, 'HANGING SCROLL / OPEN SPACE'),
  board('tree-right', 1320, 205, 54, 78, 'CANOPY POSTER / OPEN SPACE'),
  board('site-index', 1582, 48, 174, 78, 'SITE WINDOW / OPEN SPACE'),
  board('ravine-wall', 1778, 344, 112, 88, 'BLOG FEATURE / OPEN SPACE'),
  board('page-edge', 2048, 348, 104, 112, 'LINK PANEL / OPEN SPACE')
];

const waypoint = (id, label, x, y) => ({ id, label, artX: x, artY: y, ...artPoint(x, y) });
const waypoints = [
  waypoint('snowfield', '01 / SNOWFIELD', 104, 114),
  waypoint('blossom-crown', '02 / BLOSSOM CROWN', 790, 476),
  waypoint('isobels-tree', "03 / ISOBEL'S TREE", 1086, 172),
  waypoint('live-web', '04 / LIVE WEB', 1510, 512),
  waypoint('microblog-ravine', '05 / MICROBLOG RAVINE', 1826, 370),
  waypoint('paper-edge', '06 / PAPER EDGE', 2088, 510)
];

const microblogPosts = [
  { ...artPoint(1698, 316), date: '05.20', title: 'a note from the road', body: 'the page keeps going if you let it' },
  { ...artPoint(1810, 360), date: '05.31', title: 'violet / birdsong', body: 'music for a very small window' },
  { ...artPoint(1888, 452), date: '06.09', title: 'web update', body: 'made a place for wandering' },
  { ...artPoint(1980, 390), date: '06.22', title: 'found image', body: 'a soft thing caught in the archive' }
];

export default {
  id: 'overworld',
  name: "Isobel's Overworld",
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  artPlate: {
    texture: 'three-region-overworld',
    source: '/art/three-region-overworld.png',
    nativeWidth: ART_WIDTH,
    nativeHeight: ART_HEIGHT,
    scale: ART_SCALE
  },
  spawn: { ...artPoint(104, 114) },
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
    { ...artPoint(180, 184), label: 'snow radio trail' },
    { ...artPoint(520, 338), label: 'high white pass' },
    { ...artPoint(1086, 170), label: "Isobel's crown" },
    { ...artPoint(1390, 488), label: 'petal transition' },
    { ...artPoint(1578, 395), label: 'blue-link landing' },
    { ...artPoint(1826, 370), label: 'microblog ravine' },
    { ...artPoint(2090, 510), label: 'old paper edge' }
  ],
  backgrounds: [],
  solids
};
