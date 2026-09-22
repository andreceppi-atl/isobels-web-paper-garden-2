// "The Paper Garden": a long social notebook made of shelves, stems and quiet
// gaps. The original collision silhouette is deliberately preserved while the
// art and room labels establish the new world-building language.
// Design rules the movement code relies on:
//  - Solids never overlap or touch each other, except a tower standing on a floor.
//  - Gaps between solids are at least 60px, so a spider (radius 14) can always pass.
// Every solid's outline is a grapple/attach point.
const floors = [
  { x: 0, y: 1500, w: 900, h: 200, kind: 'floor' },
  { x: 1100, y: 1500, w: 800, h: 200, kind: 'floor' },
  { x: 2150, y: 1500, w: 700, h: 200, kind: 'floor' },
  { x: 3100, y: 1500, w: 1300, h: 200, kind: 'floor' }
];

const towers = [
  { x: 520, y: 1000, w: 90, h: 500, kind: 'tower' },
  { x: 1500, y: 800, w: 110, h: 700, kind: 'tower' },
  { x: 2600, y: 900, w: 100, h: 600, kind: 'tower' },
  { x: 3500, y: 700, w: 120, h: 800, kind: 'tower' }
];

const ledges = [
  { x: 700, y: 1150, w: 260, h: 40 },
  { x: 1000, y: 1000, w: 200, h: 40 },
  { x: 1250, y: 1250, w: 160, h: 40 },
  { x: 1750, y: 900, w: 240, h: 40 },
  { x: 2000, y: 1150, w: 180, h: 40 },
  { x: 2250, y: 1000, w: 220, h: 40 },
  { x: 2800, y: 1200, w: 180, h: 40 },
  { x: 2950, y: 850, w: 260, h: 40 },
  { x: 3220, y: 1050, w: 200, h: 40 },
  { x: 300, y: 700, w: 200, h: 40 },
  { x: 800, y: 600, w: 300, h: 40 },
  { x: 1300, y: 450, w: 260, h: 40 },
  { x: 1800, y: 350, w: 300, h: 40 },
  { x: 2400, y: 500, w: 260, h: 40 },
  { x: 3000, y: 400, w: 300, h: 40 },
  { x: 3700, y: 550, w: 260, h: 40 }
].map((s) => ({ ...s, kind: 'ledge' }));

const rocks = [
  { x: 920, y: 1300, w: 110, h: 110 },
  { x: 1950, y: 1330, w: 120, h: 120 },
  { x: 2920, y: 1380, w: 110, h: 100 }
].map((s) => ({ ...s, kind: 'rock' }));

export default {
  id: 'canopy',
  name: 'The Paper Garden',
  width: 4400,
  height: 1700,
  spawn: { x: 150, y: 1400 },
  nest: { x: 260, y: 1483 },
  anchors: [],
  rooms: [
    { x: 0, w: 900, label: 'bedroom edge' },
    { x: 900, w: 1000, label: 'note yard' },
    { x: 1900, w: 950, label: 'quiet pond' },
    { x: 2850, w: 850, label: 'signal hill' },
    { x: 3700, w: 700, label: 'old web' }
  ],
  landmarks: [
    { x: 430, y: 1340, label: 'leave a note' },
    { x: 1360, y: 1190, label: 'garden shelf' },
    { x: 2370, y: 940, label: 'pond radio' },
    { x: 3170, y: 790, label: 'signal post' },
    { x: 4020, y: 490, label: 'shared web' }
  ],
  solids: [...floors, ...towers, ...ledges, ...rocks]
};
