import Phaser from 'phaser';
import { MAP } from '../map.js';
import { borderPoint, raycastSolids } from '../../../shared/geometry.js';
import { STRAND, distance, snapPoint, spinCost, reinforceCost, strandBlocked, strandLength } from '../../../shared/webs.js';
import { WORLD_COLOR, WORLD_CSS, WORLD_TYPE } from '../world/worldTheme.js';

const SILK = WORLD_COLOR.ink;
const WARN = WORLD_COLOR.inkSoft;
const COOLDOWN_MS = 500;

const MESSAGES = {
  'no-node': 'aim at a solid edge, a strand or an anchor',
  'too-short': `too short (min ${STRAND.MIN_LEN})`,
  'too-long': `too long (max ${STRAND.MAX_LEN})`,
  'too-far': 'too far from you',
  blocked: 'a solid is in the way',
  limit: `you already have ${STRAND.MAX_PER_PLAYER} strands`,
  duplicate: 'a strand is already there',
  'no-thread': 'not enough thread',
  'world-full': 'the world is full of strands',
  'slow-down': 'slow down a little',
  gone: 'that strand is already gone',
  offline: 'you are offline',
  timeout: 'the server did not answer'
};

// Spinning and tending lasting strands.
//  - Hold Shift: preview a strand from where you hang (or stand) to what you aim at.
//  - Shift+click: spin it. F: spin toward the nearest node in your facing direction.
//  - R: reinforce the nearest strand (resets its timer for Thread).
// The server re-checks everything; this is UI plus the same rules for feedback.
export default class SpinTool {
  constructor(scene, { strands, network, getThread, getColor }) {
    this.scene = scene;
    this.strands = strands;
    this.network = network;
    this.getThread = getThread;
    this.getColor = getColor;
    this.current = null;
    this.pending = false;
    this.lastAction = 0;

    this.shift = scene.input.keyboard.addKey('SHIFT', false);
    this.preview = scene.add.graphics().setDepth(4);
    this.label = scene.add.text(0, 0, '', {
      fontFamily: WORLD_TYPE.ui,
      fontSize: '12px',
      color: WORLD_CSS.paper,
      backgroundColor: WORLD_CSS.ink,
      padding: { x: 5, y: 3 }
    }).setOrigin(0.5, 1).setDepth(4).setVisible(false);

    scene.input.keyboard.on('keydown-F', () => this.autoSpin());
    scene.input.keyboard.on('keydown-R', () => this.reinforce());
  }

  // Where a new strand starts: the anchor you're swinging from, the thread or
  // wall you're on, or the solid edge you're standing on / touching.
  base() {
    const spider = this.scene.spider;
    if (spider.currentAnchor) return { x: spider.currentAnchor.x, y: spider.currentAnchor.y };
    if (this.scene.crawl.active) return this.scene.crawl.basePoint();

    const pos = spider.body.position;
    let best = null;
    MAP.solids.forEach((r) => {
      const b = borderPoint(pos.x, pos.y, r);
      const d = distance(pos.x, pos.y, b.x, b.y);
      if (d <= 20 && (!best || d < best.d)) best = { x: b.x, y: b.y, d };
    });
    return best ? { x: best.x, y: best.y } : null;
  }

  evaluate(base, target) {
    const len = distance(base.x, base.y, target.x, target.y);
    if (len < STRAND.MIN_LEN) return { ok: false, note: 'too short' };
    if (len > STRAND.MAX_LEN) return { ok: false, note: 'too long' };
    if (strandBlocked(MAP, base, target)) return { ok: false, note: 'a solid is in the way' };
    const thread = this.getThread();
    if (!thread) return { ok: false, note: 'offline' };
    const cost = spinCost(len);
    if (cost > thread.balance) return { ok: false, note: `need ${cost} thread`, cost };
    return { ok: true, cost, len };
  }

  say(x, y, text, color = SILK) {
    this.label.setText(text).setColor(`#${color.toString(16).padStart(6, '0')}`).setPosition(x, y).setVisible(true);
  }

  notify(text, color = WARN) {
    this.scene.popupScore(text, color);
  }

  update() {
    this.preview.clear();
    this.label.setVisible(false);
    this.current = null;
    if (!this.shift.isDown) return;

    const spider = this.scene.spider;
    const base = this.base();
    if (!base) {
      this.say(spider.sprite.x, spider.sprite.y - 70, 'grab a web or touch a surface to spin', WARN);
      return;
    }

    const pointer = this.scene.input.activePointer;
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const target = snapPoint(MAP, world.x, world.y, this.strands.list());
    this.preview.lineStyle(2, this.getColor(), 0.8).strokeCircle(base.x, base.y, 6);
    if (!target) {
      this.say(world.x, world.y - 18, 'aim at a solid edge, strand or anchor', WARN);
      return;
    }

    const result = this.evaluate(base, target);
    this.current = { base, target, result };
    const color = result.ok ? this.getColor() : WARN;
    this.preview.lineStyle(2, color, 0.85);
    const len = distance(base.x, base.y, target.x, target.y);
    const dx = (target.x - base.x) / len;
    const dy = (target.y - base.y) / len;
    for (let d = 0; d < len; d += 14) {
      const e = Math.min(d + 8, len);
      this.preview.lineBetween(base.x + dx * d, base.y + dy * d, base.x + dx * e, base.y + dy * e);
    }
    this.preview.strokeCircle(target.x, target.y, 8);
    this.say(target.x, target.y - 20, result.ok ? `${result.cost} thread` : result.note, color);
  }

  // Called for a pointer press. Returns true if Shift was held (the press is
  // ours, so it must not also fire a swing web).
  handleClick() {
    if (!this.shift.isDown) return false;
    if (!this.current) this.notify('nothing to spin to');
    else if (!this.current.result.ok) this.notify(this.current.result.note);
    else this.spin(this.current.base, this.current.target);
    return true;
  }

  spin(base, target) {
    const now = this.scene.time.now;
    if (this.pending || now - this.lastAction < COOLDOWN_MS) return;
    this.pending = true;
    this.lastAction = now;
    this.network.spinStrand({ x1: base.x, y1: base.y, x2: target.x, y2: target.y }).then((res) => {
      this.pending = false;
      if (res.ok) this.scene.popupScore(`Strand spun  -${res.cost} thread`, WORLD_COLOR.ink);
      else this.notify(MESSAGES[res.error] || 'could not spin that');
    });
  }

  autoSpin() {
    const base = this.base();
    if (!base) return this.notify('grab a web or touch a surface first');

    const spider = this.scene.spider;
    const facing = spider.facing;
    const pos = spider.body.position;
    const ahead = (p) => (p.x - base.x) * facing > 0;

    // Deliberate nodes first: floating anchors and the ends of existing strands.
    const nodes = [...MAP.anchors];
    this.strands.list().forEach((s) => nodes.push({ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }));
    let best = null;
    for (const n of nodes) {
      const len = distance(base.x, base.y, n.x, n.y);
      if (len < STRAND.MIN_LEN || len > STRAND.MAX_LEN || !ahead(n) || !this.evaluate(base, n).ok) continue;
      if (!best || len < best.len) best = { node: n, len };
    }
    if (best) return this.spin(base, best.node);

    // Otherwise the first solid edge along a fan of angles in the facing direction.
    for (const deg of [0, 15, -15, 30, -30, 45, -45, 60]) {
      const a = Phaser.Math.DegToRad(deg);
      const hit = raycastSolids(MAP.solids, pos.x, pos.y, facing > 0 ? -a : -Math.PI + a, STRAND.MAX_LEN);
      if (hit && ahead(hit) && this.evaluate(base, hit).ok) return this.spin(base, { x: hit.x, y: hit.y });
    }
    this.notify('nothing to spin to that way (hold Shift to aim)');
  }

  reinforce() {
    const now = this.scene.time.now;
    if (this.pending || now - this.lastAction < COOLDOWN_MS) return;

    const near = this.strands.nearest(this.scene.spider.body.position);
    if (!near) return this.notify('no strand within reach to reinforce');

    const thread = this.getThread();
    const cost = reinforceCost(strandLength(near.strand));
    if (!thread) return this.notify('you are offline');
    if (cost > thread.balance) return this.notify(`need ${cost} thread`);

    this.pending = true;
    this.lastAction = now;
    this.network.reinforceStrand(near.strand.id).then((res) => {
      this.pending = false;
      if (res.ok) this.scene.popupScore(`Reinforced  -${res.cost} thread`, WORLD_COLOR.ink);
      else this.notify(MESSAGES[res.error] || 'could not reinforce');
    });
  }
}
