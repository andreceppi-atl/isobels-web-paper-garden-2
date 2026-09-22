import Phaser from 'phaser';
import { WORLD_COLOR, WORLD_CSS, WORLD_TYPE } from '../world/worldTheme.js';
import BootModeButton from '../ui/BootModeButton.js';
import { MAP } from '../map.js';

const ADJECTIVES = ['Silky', 'Dewy', 'Spry', 'Velvet', 'Nimble', 'Glimmer', 'Misty', 'Cobweb'];
const NOUNS = ['Spinner', 'Weaver', 'Dangler', 'Skitter', 'Threadling', 'Anchor', 'Silkling'];

function ensureGuestName() {
  let name = localStorage.getItem('webspun_name');
  if (!name) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 900 + 100);
    name = `${adj}${noun}${num}`;
    localStorage.setItem('webspun_name', name);
  }
  return name;
}

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image('paper-garden', '/art/paper-garden.png');
    this.load.image('npc-lineup', '/art/npc-character-lineup.png');
    if (MAP.artPlate) this.load.image(MAP.artPlate.texture, MAP.artPlate.source);
  }

  create() {
    const name = ensureGuestName();
    const { width, height } = this.scale;
    const compact = width < 520;
    const titleSize = width < 375 ? '36px' : compact ? '40px' : '48px';
    const controls = compact
      ? 'MOVE  arrows / touch pad\nJUMP  SPACE / JUMP\nWEB  click / WEB\nTRICK  Q-X-Z / stunt button\nCONNECT  E near a spider\nLISTEN  radio grows your Thread'
      : 'WANDER  arrows / A-D + SPACE\nSWING  click + aim, then release\nSTUNT  hold Q curl / X star / Z twist in air\nWEAVE  Shift+click / F, reinforce with R\nCONNECT  E nearby, then Enter to talk\nLISTEN  the little radio grows your Thread';

    this.cameras.main.setBackgroundColor(WORLD_CSS.paper);
    const frameWidth = Math.min(680, width - 32);
    const frameHeight = Math.min(410, height - 32);
    this.add.rectangle(width / 2, height / 2, frameWidth, frameHeight, WORLD_COLOR.paper)
      .setStrokeStyle(2, WORLD_COLOR.ink);

    this.add.text(width / 2, height / 2 - 164, `A WANDERING SOCIAL GAME / ${MAP.name.toUpperCase()}`, {
      fontFamily: WORLD_TYPE.ui,
      fontSize: '12px',
      color: WORLD_CSS.inkSoft
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 130, "ISOBEL'S WEB 2", {
      fontFamily: WORLD_TYPE.display,
      fontSize: titleSize,
      color: WORLD_CSS.ink
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 82, `welcome, ${name}`, {
      fontFamily: WORLD_TYPE.ui,
      fontSize: '16px',
      color: WORLD_CSS.inkSoft
    }).setOrigin(0.5);

    this.add.text(
      width / 2,
      height / 2 - 58,
      controls,
      {
        fontFamily: WORLD_TYPE.ui,
        fontSize: '12px',
        color: WORLD_CSS.inkSoft,
        align: 'left',
        lineSpacing: 8
      }
    ).setOrigin(0.5, 0);

    const prompt = this.add.text(width / 2, height / 2 + 125, 'click or press SPACE to start', {
      fontFamily: WORLD_TYPE.ui,
      fontSize: '16px',
      color: WORLD_CSS.ink
    }).setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 700,
      yoyo: true,
      repeat: -1
    });

    let started = false;
    const start = (touchMode = false) => {
      if (started) return;
      started = true;
      this.mobileStart.destroy();
      this.scene.start('World', { name, touchMode });
    };
    this.mobileStart = new BootModeButton({ label: 'MOBILE / TOUCH', onStart: () => start(true) });
    this.events.once('shutdown', () => this.mobileStart?.destroy());
    this.input.once('pointerdown', () => start(false));
    this.input.keyboard.once('keydown-SPACE', () => start(false));
  }
}
