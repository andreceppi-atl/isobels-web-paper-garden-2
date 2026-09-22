import Phaser from 'phaser';
import { ensureSpiderTexture } from './spiderArt.js';
import ChatBubble from './ChatBubble.js';
import { threadHex } from '../../../shared/colors.js';
import { WORLD_CSS } from '../world/worldTheme.js';

const BUBBLE_OFFSET_Y = 50;
const SMOOTHING = 0.015;
const SNAP_DISTANCE = 300;

// Another player's spider: no physics, just a sprite eased toward the latest
// state broadcast by that player's client.
export default class RemoteSpider {
  constructor(scene, data) {
    this.scene = scene;
    this.id = data.id;
    this.palette = data.palette;
    this.pose = 'idle';
    this.name = data.name;
    this.threadColor = threadHex(data.color);
    this.linked = false;
    this.target = null;
    this.targetRot = 0;
    this.anchor = null;

    const key = ensureSpiderTexture(scene, this.palette, this.pose);
    this.sprite = scene.add.sprite(0, 0, key).setDepth(1).setVisible(false);
    this.nameTag = scene.add.text(0, 0, data.name, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: WORLD_CSS.inkSoft
    }).setOrigin(0.5, 1).setDepth(1).setVisible(false);
    this.webGraphic = scene.add.graphics().setDepth(1);

    if (data.state) this.applyState(data.state);
  }

  setThreadColor(key) {
    this.threadColor = threadHex(key);
  }

  showBubble(text, options) {
    if (this.bubble) this.bubble.destroy();
    this.bubble = new ChatBubble(this.scene, text, options);
    this.bubble.setPosition(this.sprite.x, this.sprite.y - BUBBLE_OFFSET_Y);
  }

  // Web-connected spiders get a small ink mark in their name tag.
  setLinked(linked) {
    this.linked = linked;
    this.nameTag.setText(linked ? `${this.name} *` : this.name);
    this.nameTag.setColor(linked ? WORLD_CSS.ink : WORLD_CSS.inkSoft);
  }

  applyState(s) {
    if (!this.target) {
      this.sprite.setPosition(s.x, s.y).setVisible(true);
      this.nameTag.setVisible(true);
    }
    this.target = { x: s.x, y: s.y };
    this.targetRot = s.rot || 0;
    this.anchor = s.anchor;
    this.sprite.setFlipX(s.facing < 0);

    if (s.pose !== this.pose) {
      this.sprite.setTexture(ensureSpiderTexture(this.scene, this.palette, s.pose));
      this.pose = s.pose;
    }
  }

  update(delta) {
    if (!this.target) return;

    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.target.x, this.target.y);
    if (dist > SNAP_DISTANCE) {
      this.sprite.setPosition(this.target.x, this.target.y);
    } else {
      const t = 1 - Math.exp(-delta * SMOOTHING);
      this.sprite.x += (this.target.x - this.sprite.x) * t;
      this.sprite.y += (this.target.y - this.sprite.y) * t;
    }
    this.sprite.rotation += Phaser.Math.Angle.Wrap(this.targetRot - this.sprite.rotation) * Math.min(1, delta / 60);
    this.nameTag.setPosition(this.sprite.x, this.sprite.y - 34);
    if (this.bubble) this.bubble.setPosition(this.sprite.x, this.sprite.y - BUBBLE_OFFSET_Y);

    this.webGraphic.clear();
    if (this.anchor) {
      this.webGraphic.lineStyle(2, this.threadColor, 0.7);
      this.webGraphic.lineBetween(this.sprite.x, this.sprite.y, this.anchor.x, this.anchor.y);
    }
  }

  destroy() {
    if (this.bubble) this.bubble.destroy();
    this.sprite.destroy();
    this.nameTag.destroy();
    this.webGraphic.destroy();
  }
}
