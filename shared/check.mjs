// Run with: node shared/check.mjs
// Sanity checks for the shared geometry and every registered map.
import { MAPS, loadMap } from './level.js';
import { borderPoint, raycastRect, raycastSolids, segmentHitsRect, circleContacts, closestPointOnSegment } from './geometry.js';
import { snapPoint, strandBlocked } from './webs.js';

const results = [];
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
};
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// ---- maps ----
const rectGap = (a, b) => {
  const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0);
  const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
  return Math.hypot(dx, dy);
};
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
// A tower standing on a floor: one's bottom equals the other's top, sharing horizontal span.
const resting = (a, b) => {
  const hs = a.x < b.x + b.w && b.x < a.x + a.w;
  return hs && (a.y + a.h === b.y || b.y + b.h === a.y);
};
const floorSeam = (a, b) => a.kind === 'floor' && b.kind === 'floor' &&
  (a.x + a.w === b.x || b.x + b.w === a.x);
const treeJoint = (a, b) => a.region === b.region && (a.kind === 'trunk' || b.kind === 'trunk');

for (const [id, map] of Object.entries(MAPS)) {
  const m = loadMap(id);
  let bad = [];
  m.solids.forEach((a, i) => {
    if (a.x < 0 || a.y < 0 || a.x + a.w > m.width || a.y + a.h > m.height + 1) bad.push(`solid ${i} outside the world`);
    m.solids.forEach((b, j) => {
      if (j <= i) return;
      if (overlaps(a, b) && !treeJoint(a, b)) bad.push(`solids ${i} and ${j} overlap`);
      else if (!overlaps(a, b) && !resting(a, b) && !floorSeam(a, b) && !treeJoint(a, b) && rectGap(a, b) < 60) bad.push(`solids ${i} and ${j} only ${Math.round(rectGap(a, b))}px apart`);
    });
  });
  check(`map "${id}": solids in bounds, none overlapping, gaps >= 60px`, bad, []);
  const s = m.spawn;
  check(`map "${id}": spawn is clear of solids`, m.solids.some((r) => s.x > r.x - 14 && s.x < r.x + r.w + 14 && s.y > r.y - 14 && s.y < r.y + r.h + 14), false);
}

// ---- geometry ----
const R = { x: 100, y: 100, w: 200, h: 50 };
check('borderPoint: above the rect -> top face', borderPoint(200, 60, R), { x: 200, y: 100, face: 'top' });
check('borderPoint: left of the rect -> left face', borderPoint(60, 120, R), { x: 100, y: 120, face: 'left' });
check('borderPoint: below the rect -> bottom face', borderPoint(200, 190, R), { x: 200, y: 150, face: 'bottom' });
check('borderPoint: inside near the right edge -> right face', borderPoint(290, 125, R), { x: 300, y: 125, face: 'right' });
check('borderPoint: on the top edge stays put', borderPoint(150, 100, R), { x: 150, y: 100, face: 'top' });

let h = raycastRect(0, 120, 1, 0, 500, R);
check('ray from the left hits the left face at x=100', h && [h.face, h.x, h.y], ['left', 100, 120]);
h = raycastRect(200, 0, 0, 1, 500, R);
check('ray from above hits the top face at y=100', h && [h.face, h.x, h.y], ['top', 200, 100]);
h = raycastRect(200, 300, 0, -1, 500, R);
check('ray from below hits the bottom face at y=150', h && [h.face, h.y], ['bottom', 150]);
check('ray that misses returns null', raycastRect(0, 0, 1, 0, 500, R), null);
check('ray that is too short returns null', raycastRect(0, 120, 1, 0, 50, R), null);
check('ray starting inside returns null', raycastRect(150, 120, 1, 0, 500, R), null);
const near2 = [{ x: 400, y: 100, w: 50, h: 50 }, R];
h = raycastSolids(near2, 0, 120, 0, 900);
check('raycastSolids returns the nearest solid', h && h.index, 1);

check('segment through the middle of a rect is blocked', segmentHitsRect(50, 125, 350, 125, R), true);
check('segment along the top edge is not blocked', segmentHitsRect(100, 100, 300, 100, R), false);
check('segment from the top edge down into the rect is blocked', segmentHitsRect(200, 100, 200, 140, R), true);
check('segment above the rect is not blocked', segmentHitsRect(50, 60, 350, 60, R), false);
check('segment that stops short of the rect is not blocked', segmentHitsRect(0, 125, 90, 125, R), false);

let c = circleContacts(200, 100 - 14, 14, [R]);
check('circle resting on top: normal points up', c.length === 1 && near(c[0].nx, 0) && near(c[0].ny, -1), true);
c = circleContacts(100 - 14, 125, 14, [R]);
check('circle against the left side: normal points left', c.length === 1 && near(c[0].nx, -1) && near(c[0].ny, 0), true);
c = circleContacts(200, 150 + 14, 14, [R]);
check('circle under the rect: normal points down', c.length === 1 && near(c[0].ny, 1), true);
c = circleContacts(100 - 10, 100 - 10, 14, [R]);
check('circle on a corner: diagonal normal (up and left)', c.length === 1 && c[0].nx < -0.5 && c[0].ny < -0.5, true);
check('far circle has no contacts', circleContacts(600, 600, 14, [R]).length, 0);

const cs = closestPointOnSegment(50, 50, 0, 0, 100, 0);
check('closestPointOnSegment projects onto the segment', [cs.x, cs.y, cs.t], [50, 0, 0.5]);

// ---- snapping and blocking on the real map ----
const map = loadMap('canopy');
const tower = map.solids[4];
let sp = snapPoint(map, tower.x - 10, tower.y + 100, []);
check('snap near a tower wall lands on its left face', sp && [sp.kind, sp.face, sp.x], ['border', 'left', tower.x]);
sp = snapPoint(map, tower.x + 40, tower.y - 12, []);
check('snap just above a tower top lands on its top face', sp && [sp.kind, sp.face, sp.y], ['border', 'top', tower.y]);
check('snap in open air finds nothing', snapPoint(map, 400, 300, []), null);
const strand = { id: 's1', x1: 700, y1: 1150, x2: 900, y2: 1150 };
sp = snapPoint(map, 800, 1140, [strand]);
check('a point on the ledge outline AND a strand: strand end/body or border wins consistently', !!sp, true);
check('strand across a tower is blocked', strandBlocked(map, { x: tower.x - 40, y: tower.y + 200 }, { x: tower.x + tower.w + 40, y: tower.y + 200 }), true);
check('strand between a tower face and a ledge in open air is not blocked', strandBlocked(map, { x: tower.x + tower.w, y: tower.y + 60 }, { x: 700, y: 1150 }), false);

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
