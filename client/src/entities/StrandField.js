import Phaser from 'phaser';
import { STRAND, closestPointOnSegment, distance } from '../../../shared/webs.js';
import { threadHex } from '../../../shared/colors.js';

const FADE_WINDOW_MS = 45000;

// All lasting strands in the shared world, as the server last told us. The
// server is the only source of truth; this just draws them and answers
// "what's near this point".
export default class StrandField {
  constructor(scene) {
    this.scene = scene;
    this.strands = new Map();
    this.dynamicIds = new Set();
    this.permanentLayers = new Map();
    this.graphic = scene.add.graphics().setDepth(1);
  }

  now() {
    return this.scene.time.now;
  }

  setAll(list) {
    this.dynamicIds.forEach((id) => this.strands.delete(id));
    this.dynamicIds.clear();
    list.forEach((s) => this.add(s));
  }

  setPermanent(list, layer = 'world') {
    (this.permanentLayers.get(layer) || new Set()).forEach((id) => this.strands.delete(id));
    const ids = new Set();
    list.forEach((strand) => {
      ids.add(strand.id);
      this.add({ ...strand, permanent: true });
    });
    this.permanentLayers.set(layer, ids);
  }

  add(s) {
    const permanent = !!s.permanent;
    this.strands.set(s.id, {
      id: s.id,
      x1: s.x1,
      y1: s.y1,
      x2: s.x2,
      y2: s.y2,
      color: threadHex(s.color),
      permanent,
      ownerKind: s.ownerKind,
      ownerId: s.ownerId,
      expiresAt: permanent ? Infinity : this.now() + s.ttl
    });
    if (!permanent) this.dynamicIds.add(s.id);
  }

  reinforce(id, ttl) {
    const s = this.strands.get(id);
    if (s) s.expiresAt = this.now() + ttl;
  }

  remove(id) {
    if (!this.dynamicIds.has(id)) return;
    this.dynamicIds.delete(id);
    this.strands.delete(id);
  }

  clear() {
    this.dynamicIds.forEach((id) => this.strands.delete(id));
    this.dynamicIds.clear();
  }

  has(id) {
    return this.strands.has(id);
  }

  list() {
    return [...this.strands.values()];
  }

  // Grab targets for the normal web shot: the point on each strand nearest the
  // aim point (or nearest the spider when there is no aim, e.g. Space auto-launch).
  candidates(from, aim) {
    const ref = aim || from;
    return this.list().map((s) => {
      const c = closestPointOnSegment(ref.x, ref.y, s.x1, s.y1, s.x2, s.y2);
      return { x: c.x, y: c.y, strandId: s.id };
    });
  }

  nearest(pos, maxDist = STRAND.REINFORCE_RANGE) {
    let best = null;
    for (const s of this.strands.values()) {
      if (s.permanent) continue;
      const c = closestPointOnSegment(pos.x, pos.y, s.x1, s.y1, s.x2, s.y2);
      const d = distance(pos.x, pos.y, c.x, c.y);
      if (d <= maxDist && (!best || d < best.dist)) best = { strand: s, dist: d };
    }
    return best;
  }

  // Strands thin out and blink as they near expiry, so you know what to reinforce.
  draw() {
    const g = this.graphic;
    g.clear();
    const now = this.now();
    this.strands.forEach((s) => {
      const left = s.expiresAt - now;
      let alpha = 0.92;
      let width = 2.5;
      if (s.permanent) {
        alpha = s.ownerKind === 'nest' ? 0.88 : 0.56;
        width = s.ownerKind === 'nest' ? 2.4 : 1.8;
      } else if (left < FADE_WINDOW_MS) {
        const f = Math.max(0, left / FADE_WINDOW_MS);
        alpha = 0.35 + 0.5 * f;
        width = 1.5 + f;
        if (left < 12000) alpha *= 0.65 + 0.35 * Math.sin(now / 130);
      }
      g.lineStyle(width, s.color, alpha);
      g.lineBetween(s.x1, s.y1, s.x2, s.y2);
      g.fillStyle(s.color, Math.min(1, alpha + 0.1));
      g.fillCircle(s.x1, s.y1, 3);
      g.fillCircle(s.x2, s.y2, 3);
    });
  }
}
