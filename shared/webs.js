// Lasting-strand rules and geometry, used by both the client (preview, cost
// display) and the server (authoritative validation) so they can never disagree.
import { borderPoint, closestPointOnSegment, segmentHitsRect } from './geometry.js';

export { closestPointOnSegment };

export const STRAND = {
  MIN_LEN: 60,
  MAX_LEN: 400,
  SNAP_RADIUS: 28,
  LIFETIME_MS: 5 * 60 * 1000,
  MAX_PER_PLAYER: 10,
  MAX_TOTAL: 150,
  // The spinner must be near where the strand starts (swinging from it, or
  // standing/clinging there), so nobody can build across the map.
  START_REACH: 340,
  REINFORCE_RANGE: 140
};

export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export const strandLength = (s) => distance(s.x1, s.y1, s.x2, s.y2);

// Thread is paid up front by length; reinforcing (resetting the timer) is half price.
export const spinCost = (len) => Math.max(1, Math.ceil(len / 20));
export const reinforceCost = (len) => Math.max(1, Math.ceil(len / 40));

// Where a strand may attach: a map's floating anchors, existing strand ends
// (nodes), any point along an existing strand, or ANY point on a solid's
// outline. Nearer + "more solid" things win ties, so aiming near an anchor
// lands exactly on it.
const KIND_BIAS = { anchor: -8, node: -6, strand: 0, border: 2 };

export function snapPoint(map, x, y, strands, radius = STRAND.SNAP_RADIUS) {
  let best = null;
  let bestScore = Infinity;
  const consider = (cx, cy, kind, extra) => {
    const d = distance(x, y, cx, cy);
    if (d > radius) return;
    const score = d + KIND_BIAS[kind];
    if (score < bestScore) {
      bestScore = score;
      best = { x: cx, y: cy, kind, ...extra };
    }
  };

  for (const a of map.anchors) consider(a.x, a.y, 'anchor');
  for (const s of strands) {
    consider(s.x1, s.y1, 'node', { strandId: s.id });
    consider(s.x2, s.y2, 'node', { strandId: s.id });
    const c = closestPointOnSegment(x, y, s.x1, s.y1, s.x2, s.y2);
    consider(c.x, c.y, 'strand', { strandId: s.id });
  }
  map.solids.forEach((r, solidIndex) => {
    const b = borderPoint(x, y, r);
    consider(b.x, b.y, 'border', { solidIndex, face: b.face });
  });
  return best;
}

// A strand may not run through a solid object (it may lie along its outline).
export function strandBlocked(map, p1, p2) {
  return map.solids.some((r) => segmentHitsRect(p1.x, p1.y, p2.x, p2.y, r, 3));
}
