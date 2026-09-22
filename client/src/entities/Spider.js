import Phaser from 'phaser';
import { ensureSpiderTexture, randomPalette } from './spiderArt.js';
import { WORLD_COLOR } from '../world/worldTheme.js';

const ROPE_STIFFNESS = 0.32;
const ROPE_DAMPING = 0.16;

export default class Spider {
  constructor(scene, x, y, palette = randomPalette()) {
    this.scene = scene;
    this.palette = palette;
    this.pose = 'idle';

    this.body = scene.matter.add.circle(x, y, 14, {
      friction: 0.02,
      frictionAir: 0.008,
      restitution: 0,
      label: 'spider'
    });

    const key = ensureSpiderTexture(scene, palette, this.pose);
    this.sprite = scene.add.sprite(x, y, key);

    this.grounded = false;
    this.facing = 1;
    this.webConstraint = null;
    this.currentAnchor = null;
    this.ropeLength = 0;
    this.slack = false;
    this.webGraphic = scene.add.graphics();
    this.webColor = WORLD_COLOR.ink;

    this.maxWebLength = 280;
    this.minWebLength = 40;
    this.aimAngleTolerance = Phaser.Math.DegToRad(75);
  }

  get position() {
    return this.body.position;
  }

  setGrounded(v) {
    this.grounded = v;
  }

  findAnchor(anchors, targetWorldPoint) {
    const pos = this.body.position;
    const dirToTarget = Phaser.Math.Angle.Between(pos.x, pos.y, targetWorldPoint.x, targetWorldPoint.y);

    let best = null;
    let bestDist = Infinity;
    for (const a of anchors) {
      const dist = Phaser.Math.Distance.Between(pos.x, pos.y, a.x, a.y);
      if (dist > this.maxWebLength) continue;
      const angleToAnchor = Phaser.Math.Angle.Between(pos.x, pos.y, a.x, a.y);
      const diff = Phaser.Math.Angle.Wrap(angleToAnchor - dirToTarget);
      if (Math.abs(diff) > this.aimAngleTolerance) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = a;
      }
    }
    return best ? { anchor: best, dist: bestDist } : null;
  }

  // Manual aim: fire toward wherever the player is pointing (mouse aim).
  tryFireWeb(anchors, targetWorldPoint) {
    if (this.webConstraint) return false;
    const found = this.findAnchor(anchors, targetWorldPoint);
    if (!found) return false;
    this.attachWeb(found.anchor, found.dist);
    return true;
  }

  // Button-press launch: auto-aims using the spider's current facing direction,
  // no precise mouse aim required (Webbed-style).
  tryFireWebFacing(anchors) {
    if (this.webConstraint) return false;
    const pos = this.body.position;
    const target = { x: pos.x + this.facing * 400, y: pos.y - 80 };
    return this.tryFireWeb(anchors, target);
  }

  attachWeb(anchor, dist) {
    this.ropeLength = dist;
    this.webConstraint = this.scene.matter.add.worldConstraint(this.body, dist, ROPE_STIFFNESS, {
      pointA: { x: anchor.x, y: anchor.y },
      damping: ROPE_DAMPING
    });
    this.currentAnchor = anchor;
  }

  releaseWeb() {
    if (this.webConstraint) {
      this.scene.matter.world.removeConstraint(this.webConstraint);
      this.webConstraint = null;
      this.currentAnchor = null;
      this.ropeLength = 0;
      this.slack = false;
    }
  }

  reel(delta) {
    if (this.webConstraint) {
      this.ropeLength = Phaser.Math.Clamp(this.ropeLength + delta, this.minWebLength, this.maxWebLength);
    }
  }

  steer(force) {
    this.scene.matter.body.applyForce(this.body, this.body.position, { x: force, y: 0 });
  }

  setPose(poseKey) {
    if (poseKey === this.pose) return;
    const key = ensureSpiderTexture(this.scene, this.palette, poseKey);
    this.sprite.setTexture(key);
    this.pose = poseKey;
  }

  update() {
    this.sprite.x = this.body.position.x;
    this.sprite.y = this.body.position.y;
    this.sprite.setFlipX(this.facing < 0);

    this.webGraphic.clear();
    if (this.webConstraint && this.currentAnchor) {
      // Rope can go slack: only pull taut once the spider reaches the
      // deployed rope length. Inside that radius, the constraint's rest
      // length just tracks the current distance, applying ~zero force.
      const dist = Phaser.Math.Distance.Between(
        this.body.position.x,
        this.body.position.y,
        this.currentAnchor.x,
        this.currentAnchor.y
      );
      this.slack = dist < this.ropeLength - 2;
      this.webConstraint.length = Math.min(this.ropeLength, dist);

      this.webGraphic.lineStyle(2, this.webColor, this.slack ? 0.45 : 0.95);
      this.webGraphic.lineBetween(
        this.body.position.x,
        this.body.position.y,
        this.currentAnchor.x,
        this.currentAnchor.y
      );
    }
  }
}
