const DISTRICT_WIDTH = 2400;
const DISTRICTS = 10;
const WORLD_HEIGHT = 2400;

const roomNames = [
  'landing margin',
  'bramble post',
  'pocket orchard',
  'note pond',
  'hush arcade',
  'lantern line',
  'silver attic',
  'moth crossing',
  'signal garden',
  'old paper edge'
];

const floors = Array.from({ length: DISTRICTS }, (_, index) => ({
  x: index * DISTRICT_WIDTH,
  y: 2180,
  w: 2100,
  h: 220,
  kind: 'floor'
}));

const districtSolids = Array.from({ length: DISTRICTS }, (_, index) => {
  const x = index * DISTRICT_WIDTH;
  const shift = index % 2 === 0 ? 0 : 80;
  return [
    { x: x + 1260 + shift, y: 1600, w: 120, h: 580, kind: 'tower' },
    { x: x + 200, y: 1540, w: 260, h: 36, kind: 'ledge' },
    { x: x + 700, y: 1320, w: 320, h: 36, kind: 'ledge' },
    { x: x + 1650, y: 1450, w: 280, h: 36, kind: 'ledge' },
    { x: x + 1000, y: 680, w: 260, h: 36, kind: 'ledge' },
    { x: x + 1900, y: 780, w: 240, h: 36, kind: 'ledge' }
  ];
}).flat();

const nestPattern = [
  { x: 310, y: 1930, radius: 150, phase: 0.08 },
  { x: 860, y: 1880, radius: 155, phase: 0.22 },
  { x: 1710, y: 1900, radius: 150, phase: 0.14 },
  { x: 520, y: 990, radius: 165, phase: 0.3 },
  { x: 1540, y: 850, radius: 170, phase: 0.04 },
  { x: 2150, y: 1160, radius: 145, phase: 0.18 }
];

const nestSlots = Array.from({ length: DISTRICTS }, (_, district) => (
  nestPattern.map((slot, local) => ({
    ...slot,
    id: district * nestPattern.length + local,
    x: district * DISTRICT_WIDTH + slot.x,
    spokes: 8 - ((district + local) % 2),
    rings: 3
  }))
)).flat();

const staticWebs = Array.from({ length: DISTRICTS }, (_, district) => {
  const x = district * DISTRICT_WIDTH;
  return district % 2 === 0
    ? { id: `old-orb-${district + 1}`, x: x + 340, y: 430, radius: 155, spokes: 8, phase: district * 0.07 }
    : { id: `old-orb-${district + 1}`, x: x + 1480, y: 1160, radius: 135, spokes: 7, phase: district * 0.09 };
});

const npcSpiders = Array.from({ length: DISTRICTS }, (_, district) => ({
  id: `keeper-${district + 1}`,
  name: district % 2 ? 'paper moth' : 'old spinner',
  x: district * DISTRICT_WIDTH + 330,
  y: 1518,
  range: 90 + (district % 3) * 20,
  speed: 0.00034 + district * 0.00001,
  palette: ['autumn', 'frost', 'berry', 'amber'][district % 4],
  phase: district * 0.65
}));

const humanoids = [
  { id: 'isobel', name: 'Isobel / songs', frame: 0, x: 2660, y: 2160, scale: 0.25 },
  { id: 'moth-keeper', name: 'Moth Keeper / lights', frame: 1, x: 8150, y: 2160, scale: 0.25 },
  { id: 'signal-kid', name: 'Signal Kid / maps', frame: 2, x: 15080, y: 2160, scale: 0.25 },
  { id: 'cat-courier', name: 'Cat Courier / notes', frame: 3, x: 21900, y: 2160, scale: 0.25 }
];

const doodleTypes = ['antenna', 'pond', 'flowers', 'cassette', 'moon', 'notes', 'thicket', 'lantern', 'garden', 'gate'];

export default {
  id: 'long-garden',
  name: 'The Long Garden',
  width: DISTRICT_WIDTH * DISTRICTS,
  height: WORLD_HEIGHT,
  spawn: { x: 170, y: 2100 },
  nest: { x: nestSlots[0].x, y: nestSlots[0].y },
  anchors: [],
  nestSlots,
  staticWebs,
  npcSpiders,
  humanoids,
  rooms: roomNames.map((label, index) => ({ x: index * DISTRICT_WIDTH, w: DISTRICT_WIDTH, label })),
  landmarks: roomNames.map((label, index) => ({
    x: index * DISTRICT_WIDTH + 1120,
    y: index % 2 === 0 ? 1240 : 1510,
    label
  })),
  backgrounds: doodleTypes.map((type, index) => ({
    type,
    x: index * DISTRICT_WIDTH + 1120,
    y: 330 + (index % 3) * 80,
    scale: 1 + (index % 2) * 0.2
  })),
  solids: [...floors, ...districtSolids]
};
