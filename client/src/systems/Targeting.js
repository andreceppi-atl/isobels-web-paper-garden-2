import Phaser from 'phaser';
import { raycastSolids } from '../../../shared/geometry.js';
import { distance } from '../../../shared/webs.js';

const MIN_LEN = 40;
const CURSOR_SNAP = 32;
const AIM_TOLERANCE = [0, 3, -3, 6, -6, 10, -10, 15, -15].map(Phaser.Math.DegToRad);
const AUTO_ELEVATIONS = [50, 40, 60, 30, 70, 20, 80, 10].map(Phaser.Math.DegToRad);
const CONE = Phaser.Math.DegToRad(75);

// Decides where a web shot lands. Solid outlines are grapple points: the shot
// travels along the aim and sticks where it first hits an edge. Floating
// anchors and lasting strands take priority when the cursor is right on them.
export default class Targeting {
  constructor({ map, strands, maxLen }) {
    this.map = map;
    this.strands = strands;
    this.maxLen = maxLen;
  }

  inRange(from, p) {
    const d = distance(from.x, from.y, p.x, p.y);
    return d >= MIN_LEN && d <= this.maxLen;
  }

  // Mouse aim: where would a shot toward `aim` attach? Returns an anchor or null.
  aim(from, aim) {
    let best = null;
    let bestD = CURSOR_SNAP;
    const consider = (c) => {
      const d = distance(c.x, c.y, aim.x, aim.y);
      if (d <= bestD && this.inRange(from, c)) {
        bestD = d;
        best = c;
      }
    };
    this.map.anchors.forEach((a) => consider({ x: a.x, y: a.y, kind: 'anchor' }));
    this.strands.candidates(from, aim).forEach((c) => consider({ ...c, kind: 'strand' }));
    if (best) return best;

    const angle = Phaser.Math.Angle.Between(from.x, from.y, aim.x, aim.y);
    for (const off of AIM_TOLERANCE) {
      const hit = raycastSolids(this.map.solids, from.x, from.y, angle + off, this.maxLen);
      if (hit && hit.t >= MIN_LEN) return { x: hit.x, y: hit.y, kind: 'border', face: hit.face };
    }
    return null;
  }

  // Button launch (Space): no cursor, so look ahead and up. Deliberate things
  // (strands, anchors) in front win; otherwise the first solid edge found
  // along a fan of upward angles in the facing direction.
  auto(from, facing) {
    const aimPoint = { x: from.x + facing * 400, y: from.y - 80 };
    const aimAngle = Phaser.Math.Angle.Between(from.x, from.y, aimPoint.x, aimPoint.y);

    let best = null;
    let bestDist = Infinity;
    const consider = (c) => {
      const d = distance(from.x, from.y, c.x, c.y);
      if (d < MIN_LEN || d > this.maxLen) return;
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(from.x, from.y, c.x, c.y) - aimAngle));
      if (diff <= CONE && d < bestDist) {
        bestDist = d;
        best = c;
      }
    };
    this.map.anchors.forEach((a) => consider({ x: a.x, y: a.y, kind: 'anchor' }));
    this.strands.candidates(from, undefined).forEach((c) => consider({ ...c, kind: 'strand' }));
    if (best) return best;

    for (const el of AUTO_ELEVATIONS) {
      const angle = facing > 0 ? -el : -Math.PI + el;
      const hit = raycastSolids(this.map.solids, from.x, from.y, angle, this.maxLen);
      if (hit && hit.t >= MIN_LEN) return { x: hit.x, y: hit.y, kind: 'border', face: hit.face };
    }
    return null;
  }
}
