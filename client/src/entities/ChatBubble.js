import { WORLD_COLOR, WORLD_CSS, WORLD_TYPE } from '../world/worldTheme.js';

const MAX_WIDTH = 170;
const PAD = 6;
const TAIL = 7;

// Cartoon speech bubble anchored above a spider (its tail tip is the anchor
// point). Fades out on its own. Rendered as canvas text, so message content
// can never be interpreted as markup.
export default class ChatBubble {
  // emote: true renders a single big emoji that lingers a shorter time.
  constructor(scene, text, { emote = false } = {}) {
    this.scene = scene;
    this.dead = false;

    const label = scene.add.text(0, 0, text, {
      fontFamily: emote ? 'sans-serif' : WORLD_TYPE.ui,
      fontSize: emote ? '26px' : '12px',
      color: WORLD_CSS.ink,
      align: 'center',
      wordWrap: { width: MAX_WIDTH, useAdvancedWrap: true }
    }).setOrigin(0.5, 1);

    const w = label.width + PAD * 2;
    const h = label.height + PAD * 2;
    const top = -TAIL - h;

    const bg = scene.add.graphics();
    bg.fillStyle(WORLD_COLOR.paper, 1);
    bg.fillRect(-w / 2, top, w, h);
    bg.fillTriangle(-5, -TAIL - 1, 5, -TAIL - 1, 0, 0);
    bg.lineStyle(2, WORLD_COLOR.ink, 1);
    bg.strokeRect(-w / 2, top, w, h);
    label.setPosition(0, -TAIL - PAD);

    this.container = scene.add.container(0, 0, [bg, label]).setDepth(5);

    const life = emote ? 2600 : Math.min(8000, 3500 + text.length * 60);
    scene.tweens.add({
      targets: this.container,
      alpha: 0,
      delay: life - 400,
      duration: 400,
      onComplete: () => this.destroy()
    });
  }

  setPosition(x, y) {
    if (!this.dead) this.container.setPosition(x, y);
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }
}
