// Rectangle geometry shared by client and server: outlines (grapple/attach
// points), ray casts, contact classification, and "does a strand pass through
// a solid". Solids are axis-aligned rectangles { x, y, w, h }.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const FACE_NORMALS = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
  return { x: x1 + t * dx, y: y1 + t * dy, t };
}

export function closestPointOnRect(px, py, r) {
  return { x: clamp(px, r.x, r.x + r.w), y: clamp(py, r.y, r.y + r.h) };
}

// Nearest point on a rectangle's OUTLINE, and which face it lies on.
// Works for points inside the rectangle too (projects to the nearest edge).
export function borderPoint(px, py, r) {
  const right = r.x + r.w;
  const bottom = r.y + r.h;

  if (px > r.x && px < right && py > r.y && py < bottom) {
    const m = Math.min(px - r.x, right - px, py - r.y, bottom - py);
    if (m === py - r.y) return { x: px, y: r.y, face: 'top' };
    if (m === bottom - py) return { x: px, y: bottom, face: 'bottom' };
    if (m === px - r.x) return { x: r.x, y: py, face: 'left' };
    return { x: right, y: py, face: 'right' };
  }

  const cx = clamp(px, r.x, right);
  const cy = clamp(py, r.y, bottom);
  const offX = px - cx;
  const offY = py - cy;
  let face;
  if (offX === 0 && offY === 0) {
    face = py === r.y ? 'top' : py === bottom ? 'bottom' : px === r.x ? 'left' : 'right';
  } else if (Math.abs(offX) > Math.abs(offY)) {
    face = offX < 0 ? 'left' : 'right';
  } else {
    face = offY < 0 ? 'top' : 'bottom';
  }
  return { x: cx, y: cy, face };
}

// Ray vs rectangle (slab method). Returns { t, x, y, face } for the entry point,
// or null (miss, beyond maxLen, or the origin is already inside).
export function raycastRect(ox, oy, dx, dy, maxLen, r) {
  let tmin = 0;
  let tmax = maxLen;
  let face = null;

  const slab = (o, d, lo, hi, loFace, hiFace) => {
    if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    let f1 = loFace;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
      f1 = hiFace;
    }
    if (t1 > tmin) {
      tmin = t1;
      face = f1;
    }
    tmax = Math.min(tmax, t2);
    return true;
  };

  if (!slab(ox, dx, r.x, r.x + r.w, 'left', 'right')) return null;
  if (!slab(oy, dy, r.y, r.y + r.h, 'top', 'bottom')) return null;
  if (tmin > tmax || face === null) return null;
  return { t: tmin, x: ox + dx * tmin, y: oy + dy * tmin, face };
}

// Nearest solid hit along a ray at `angle` (radians, screen coords: +y is down).
export function raycastSolids(solids, ox, oy, angle, maxLen) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = null;
  solids.forEach((r, index) => {
    const hit = raycastRect(ox, oy, dx, dy, maxLen, r);
    if (hit && (!best || hit.t < best.t)) best = { ...hit, index };
  });
  return best;
}

// Does the segment pass through the INTERIOR of the rectangle? The rectangle is
// shrunk a little so a strand that starts/ends on the outline is not counted.
export function segmentHitsRect(x1, y1, x2, y2, r, shrink = 3) {
  const minX = r.x + shrink;
  const maxX = r.x + r.w - shrink;
  const minY = r.y + shrink;
  const maxY = r.y + r.h - shrink;
  if (minX >= maxX || minY >= maxY) return false;

  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return clip(-dx, x1 - minX) && clip(dx, maxX - x1) && clip(-dy, y1 - minY) && clip(dy, maxY - y1);
}

// Circle vs rectangles. Each contact has the outward normal (pointing from the
// solid toward the circle): ny < 0 means the circle rests ON TOP of it, |nx|
// near 1 means it touches a side, ny > 0 means it touches an underside.
export function circleContacts(cx, cy, radius, solids, margin = 3) {
  const contacts = [];
  solids.forEach((r, index) => {
    const cp = closestPointOnRect(cx, cy, r);
    const vx = cx - cp.x;
    const vy = cy - cp.y;
    const d = Math.hypot(vx, vy);
    if (d > radius + margin) return;

    let nx;
    let ny;
    if (d > 1e-6) {
      nx = vx / d;
      ny = vy / d;
    } else {
      const b = borderPoint(cx, cy, r);
      nx = FACE_NORMALS[b.face].x;
      ny = FACE_NORMALS[b.face].y;
    }
    contacts.push({ index, solid: r, px: cp.x, py: cp.y, nx, ny, d });
  });
  return contacts;
}
