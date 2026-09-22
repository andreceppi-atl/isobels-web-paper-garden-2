import {
  FACE_NORMALS,
  borderPoint,
  circleContacts,
  clamp,
  closestPointOnRect,
  closestPointOnSegment
} from '../../../shared/geometry.js';

const RADIUS = 14;
const SPEED = 3.2; // px per 60fps frame
const EPS = 0.6;
const REATTACH_MS = 300;
const EDGE_INSET = 6;
const ATTACH_REACH = RADIUS + 3;
const NODE_REACH = 8;
const FRAME_MS = 1000 / 60;

const unit = (s) => {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len = Math.hypot(dx, dy) || 1;
  return { ux: dx / len, uy: dy / len, len };
};

// The "up-facing" side of a strand (or its right-hand side when vertical).
// side +1 = that side (standing on top), -1 = the other (hanging underneath).
const baseNormal = (ux, uy) => {
  let nx = uy;
  let ny = -ux;
  if (ny > 1e-9 || (Math.abs(ny) <= 1e-9 && nx < 0)) {
    nx = -nx;
    ny = -ny;
  }
  return { x: nx, y: ny };
};

const inputVector = (input) => {
  const x = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const y = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const m = Math.hypot(x, y);
  return m > 0 ? { x: x / m, y: y / m, m } : { x: 0, y: 0, m: 0 };
};

// Walking on solid faces (walls, undersides) and on lasting strands.
// The spider is "stuck" to a surface: gravity is off and it is placed on the
// surface every frame. Floors keep using the normal physics; walls hand back to
// it over a top edge, strands hand back at their ends.
export default class Crawl {
  constructor(scene, map, strands) {
    this.scene = scene;
    this.map = map;
    this.strands = strands;
    this.state = null; // { type: 'solid', index, face, s } | { type: 'strand', id, t, side }
    this.lastDetach = -1e9;
    this.targetRot = 0;
    this.moving = false;
    this.normal = { x: 0, y: -1 };
  }

  get active() {
    return this.state !== null;
  }

  get kind() {
    return this.state ? this.state.type : null;
  }

  // ---- body plumbing --------------------------------------------------------
  get body() {
    return this.scene.spider.body;
  }

  place(x, y) {
    this.scene.matter.body.setPosition(this.body, { x, y });
    this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
  }

  begin(state) {
    this.state = state;
    this.moving = false;
    this.body.ignoreGravity = true;
    this.scene.spider.grounded = false;
  }

  // Let go of the surface (optionally with a launch velocity) and hand back to physics.
  end(velocity = { x: 0, y: 0 }) {
    if (!this.state) return;
    this.state = null;
    this.moving = false;
    this.body.ignoreGravity = false;
    this.scene.matter.body.setVelocity(this.body, velocity);
    this.lastDetach = this.scene.time.now;
  }

  jump(input) {
    this.end({ x: ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 3.2, y: -10 });
  }

  // Push off a wall (used by Space, which also tries to launch a web).
  kickOff() {
    const st = this.state;
    if (!st || st.type !== 'solid') return;
    const n = FACE_NORMALS[st.face];
    this.end({ x: n.x * 4.5, y: st.face === 'bottom' ? 2 : -7 });
  }

  // The point on the surface the spider is attached to (where a new strand would start).
  basePoint() {
    const st = this.state;
    if (!st) return null;
    if (st.type === 'strand') {
      const s = this.strands.strands.get(st.id);
      if (!s) return null;
      const { ux, uy, len } = unit(s);
      return { x: s.x1 + ux * len * st.t, y: s.y1 + uy * len * st.t };
    }
    const R = this.map.solids[st.index];
    const p = this.solidPoint(R, st.face, st.s);
    const n = FACE_NORMALS[st.face];
    return { x: p.x - n.x * (RADIUS + EPS), y: p.y - n.y * (RADIUS + EPS) };
  }

  // ---- attaching ------------------------------------------------------------
  tryAttach(contacts, input, vel) {
    if (this.scene.spider.webConstraint) return;
    if (this.scene.time.now - this.lastDetach < REATTACH_MS) return;
    if (this.tryAttachSolid(contacts, input, vel)) return;
    this.tryAttachStrand(input, vel);
  }

  tryAttachSolid(contacts, input, vel) {
    const pos = this.body.position;
    for (const c of contacts) {
      const R = c.solid;
      if (Math.abs(c.nx) > 0.85 && Math.abs(c.ny) < 0.5) {
        const face = c.nx < 0 ? 'left' : 'right';
        const toward = face === 'left' ? input.right : input.left;
        if (toward) {
          this.attachSolid(c.index, face, clamp(pos.y, R.y + 2, R.y + R.h - 2));
          return true;
        }
      } else if (c.ny > 0.85 && input.up && vel.y <= 1.5) {
        this.attachSolid(c.index, 'bottom', clamp(pos.x, R.x + 2, R.x + R.w - 2));
        return true;
      }
    }

    // Standing near a top edge and pressing down: climb over the lip onto the wall.
    if (input.down) {
      for (const c of contacts) {
        if (c.ny >= -0.8) continue;
        const R = c.solid;
        if (pos.x - R.x < 12) {
          this.attachSolid(c.index, 'left', R.y + 4);
          return true;
        }
        if (R.x + R.w - pos.x < 12) {
          this.attachSolid(c.index, 'right', R.y + 4);
          return true;
        }
      }
    }
    return false;
  }

  // Land on a strand from above, or press along one you are touching.
  tryAttachStrand(input, vel) {
    const pos = this.body.position;
    const iv = inputVector(input);
    let best = null;

    for (const s of this.strands.list()) {
      if (this.state && this.state.type === 'strand' && this.state.id === s.id) continue;
      const c = closestPointOnSegment(pos.x, pos.y, s.x1, s.y1, s.x2, s.y2);
      if (Math.hypot(pos.x - c.x, pos.y - c.y) > ATTACH_REACH) continue;

      const { ux, uy } = unit(s);
      const nb = baseNormal(ux, uy);
      const side = (pos.x - c.x) * nb.x + (pos.y - c.y) * nb.y >= 0 ? 1 : -1;
      const align = iv.m > 0 ? iv.x * ux + iv.y * uy : 0;
      const landing = vel.y > 0.5 && side > 0 && Math.abs(uy) <= 0.94;
      const score = landing ? 2 : Math.abs(align) >= 0.6 ? Math.abs(align) : 0;
      if (score > 0 && (!best || score > best.score)) best = { s, t: c.t, side, score };
    }
    if (best) this.attachStrand(best.s, best.t, best.side);
  }

  attachSolid(index, face, s) {
    this.begin({ type: 'solid', index, face, s });
    this.placeOnSolid();
  }

  attachStrand(strand, t, side) {
    this.begin({ type: 'strand', id: strand.id, t, side });
    this.placeOnStrand();
  }

  // ---- per frame ------------------------------------------------------------
  update(delta, input) {
    const dt = delta / FRAME_MS;
    if (this.state.type === 'solid') this.updateSolid(dt, input);
    else this.updateStrand(dt, input);
  }

  solidPoint(R, face, s) {
    if (face === 'left') return { x: R.x - RADIUS - EPS, y: s };
    if (face === 'right') return { x: R.x + R.w + RADIUS + EPS, y: s };
    return { x: s, y: R.y + R.h + RADIUS + EPS };
  }

  placeOnSolid() {
    const st = this.state;
    const R = this.map.solids[st.index];
    const p = this.solidPoint(R, st.face, st.s);
    this.normal = FACE_NORMALS[st.face];
    this.targetRot = Math.atan2(this.normal.x, -this.normal.y);
    this.place(p.x, p.y);
  }

  blocked(x, y, exceptIndex) {
    if (x < RADIUS || x > this.map.width - RADIUS) return true;
    return this.map.solids.some((R, i) => {
      if (i === exceptIndex) return false;
      const cp = closestPointOnRect(x, y, R);
      return Math.hypot(x - cp.x, y - cp.y) < RADIUS - 0.8;
    });
  }

  updateSolid(dt, input) {
    const spider = this.scene.spider;
    const st = this.state;
    const R = this.map.solids[st.index];
    const face = st.face;
    const n = FACE_NORMALS[face];

    const toward = face === 'left' ? input.right : face === 'right' ? input.left : input.up;
    const away = face === 'left' ? input.left : face === 'right' ? input.right : input.down;
    if (away && !toward) {
      this.end({ x: n.x * 3.5, y: face === 'bottom' ? 1.5 : -1.5 });
      return;
    }

    const move = face === 'bottom' ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : (input.down ? 1 : 0) - (input.up ? 1 : 0);
    this.moving = move !== 0;
    if (face === 'bottom' && move !== 0) spider.facing = move;

    const s = st.s + move * SPEED * dt;
    const lo = face === 'bottom' ? R.x : R.y;
    const hi = face === 'bottom' ? R.x + R.w : R.y + R.h;

    if (s < lo) {
      if (face === 'bottom') this.wrapTo(st, 'left', R.y + R.h);
      else this.overTheTop(R, face);
      return;
    }
    if (s > hi) {
      if (face === 'bottom') this.wrapTo(st, 'right', R.y + R.h);
      else this.wrapTo(st, 'bottom', face === 'left' ? R.x : R.x + R.w);
      return;
    }

    const p = this.solidPoint(R, face, s);
    if (!this.blocked(p.x, p.y, st.index)) st.s = s;
    this.placeOnSolid();

    // Climbed down onto the ground/another top surface: stand on it normally.
    if (face !== 'bottom' && move > 0) {
      const here = this.body.position;
      const floor = circleContacts(here.x, here.y, RADIUS, this.map.solids, 2).find((c) => c.index !== st.index && c.ny < -0.6);
      if (floor) {
        this.end();
        return;
      }
    }

    this.tryAttachStrand(input, { x: 0, y: 0 });
  }

  wrapTo(st, face, s) {
    st.face = face;
    st.s = s;
    this.placeOnSolid();
  }

  // Climbed past the top edge: stand on top, back under normal physics.
  overTheTop(R, fromFace) {
    const x = fromFace === 'left' ? R.x + EDGE_INSET : R.x + R.w - EDGE_INSET;
    this.place(x, R.y - RADIUS - EPS);
    this.end();
  }

  placeOnStrand() {
    const st = this.state;
    const s = this.strands.strands.get(st.id);
    if (!s) {
      this.end();
      return;
    }
    const { ux, uy, len } = unit(s);
    const nb = baseNormal(ux, uy);
    this.normal = { x: nb.x * st.side, y: nb.y * st.side };
    this.targetRot = Math.atan2(this.normal.x, -this.normal.y);
    this.place(s.x1 + ux * len * st.t + this.normal.x * (RADIUS + EPS), s.y1 + uy * len * st.t + this.normal.y * (RADIUS + EPS));
  }

  updateStrand(dt, input) {
    const spider = this.scene.spider;
    const st = this.state;
    const s = this.strands.strands.get(st.id);
    if (!s) {
      this.end();
      return;
    }

    const { ux, uy, len } = unit(s);
    const iv = inputVector(input);
    const a = iv.m > 0 ? clamp(iv.x * ux + iv.y * uy, -1, 1) : 0;

    // Pressing down on a shallow thread (with no walking along it) lets go.
    if (input.down && Math.abs(a) < 0.3 && Math.abs(uy) < 0.6) {
      this.end({ x: 0, y: 1.5 });
      return;
    }

    this.moving = Math.abs(a) > 0.05;
    if (this.moving && Math.abs(ux) > 0.2) spider.facing = a * ux > 0 ? 1 : -1;

    st.t += (a * SPEED * dt) / len;
    if (st.t < 0 || st.t > 1) {
      this.transferAtEnd(s, st.t < 0 ? 0 : 1, iv, a);
      return;
    }
    this.placeOnStrand();
    this.tryAttachStrandSwitch(iv);
  }

  // Walked off the end of a strand: continue onto a connected strand, onto the
  // surface it is anchored to, or stop at a free end.
  transferAtEnd(s, endIndex, iv, a) {
    const st = this.state;
    const q = endIndex === 0 ? { x: s.x1, y: s.y1 } : { x: s.x2, y: s.y2 };
    const cur = unit(s);
    const mv = { x: cur.ux * Math.sign(a || 1), y: cur.uy * Math.sign(a || 1) };
    const want = iv.m > 0 ? iv : mv;

    let best = null;
    for (const o of this.strands.list()) {
      if (o.id === s.id) continue;
      const c = closestPointOnSegment(q.x, q.y, o.x1, o.y1, o.x2, o.y2);
      if (Math.hypot(q.x - c.x, q.y - c.y) > NODE_REACH) continue;
      const { ux, uy } = unit(o);
      for (const dir of [1, -1]) {
        if ((dir === 1 && c.t > 0.999) || (dir === -1 && c.t < 0.001)) continue;
        const score = want.x * ux * dir + want.y * uy * dir;
        if (score >= 0.4 && (!best || score > best.score)) best = { o, t: c.t, dir, score };
      }
    }
    if (best) {
      const bu = unit(best.o);
      const nb = baseNormal(bu.ux, bu.uy);
      const side = this.normal.x * nb.x + this.normal.y * nb.y >= 0 ? 1 : -1;
      this.state = { type: 'strand', id: best.o.id, t: clamp(best.t + best.dir * 0.003, 0, 1), side };
      this.placeOnStrand();
      return;
    }

    let edge = null;
    this.map.solids.forEach((R, i) => {
      const b = borderPoint(q.x, q.y, R);
      const d = Math.hypot(q.x - b.x, q.y - b.y);
      if (d <= NODE_REACH && (!edge || d < edge.d)) edge = { i, R, b, d };
    });
    if (edge) {
      const { R, b, i } = edge;
      if (b.face === 'top') {
        this.place(clamp(b.x, R.x + EDGE_INSET, R.x + R.w - EDGE_INSET), R.y - RADIUS - EPS);
        this.end();
      } else {
        const s2 = b.face === 'bottom' ? clamp(b.x, R.x, R.x + R.w) : clamp(b.y, R.y, R.y + R.h);
        this.state = { type: 'solid', index: i, face: b.face, s: s2 };
        this.placeOnSolid();
      }
      return;
    }

    st.t = clamp(st.t, 0, 1);
    this.moving = false;
    this.placeOnStrand();
  }

  // While on a strand, pressing along a different touching strand switches to it.
  tryAttachStrandSwitch(iv) {
    if (iv.m === 0) return;
    const st = this.state;
    const pos = this.body.position;
    let best = null;
    for (const o of this.strands.list()) {
      if (o.id === st.id) continue;
      const c = closestPointOnSegment(pos.x, pos.y, o.x1, o.y1, o.x2, o.y2);
      if (Math.hypot(pos.x - c.x, pos.y - c.y) > ATTACH_REACH) continue;
      const { ux, uy } = unit(o);
      const align = Math.abs(iv.x * ux + iv.y * uy);
      const cur = this.strands.strands.get(st.id);
      const curU = unit(cur);
      const curAlign = Math.abs(iv.x * curU.ux + iv.y * curU.uy);
      if (align >= 0.85 && align > curAlign + 0.25 && (!best || align > best.align)) best = { o, c, align, ux, uy };
    }
    if (best) {
      const nb = baseNormal(best.ux, best.uy);
      const side = this.normal.x * nb.x + this.normal.y * nb.y >= 0 ? 1 : -1;
      this.state = { type: 'strand', id: best.o.id, t: best.c.t, side };
      this.placeOnStrand();
    }
  }
}
