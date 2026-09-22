import { ensureSpiderTexture } from './spiderArt.js';
import { WORLD_CSS, WORLD_TYPE } from '../world/worldTheme.js';

const RESIDENT_FRAMES = [
  { x: 0, w: 535 },
  { x: 535, w: 555 },
  { x: 1090, w: 535 },
  { x: 1625, w: 547 }
];

function ensureResidentFrame(scene, frameIndex) {
  const key = `resident-${frameIndex}`;
  const texture = scene.textures.get('npc-lineup');
  if (texture.has(key)) return key;
  const frame = RESIDENT_FRAMES[frameIndex] || RESIDENT_FRAMES[0];
  const source = texture.getSourceImage();
  texture.add(key, 0, frame.x, 0, frame.w, source.height);
  return key;
}

class SpiderResident {
  constructor(scene, data) {
    this.scene = scene;
    this.data = data;
    this.pose = 'idle';
    this.sprite = scene.add.sprite(data.x, data.y, ensureSpiderTexture(scene, data.palette, 'idle'))
      .setDepth(2)
      .setScale(0.9);
    this.label = scene.add.text(data.x, data.y - 30, data.name, {
      fontFamily: WORLD_TYPE.ui,
      fontSize: '10px',
      color: WORLD_CSS.inkSoft,
      backgroundColor: WORLD_CSS.paper,
      padding: { x: 3, y: 2 }
    }).setOrigin(0.5, 1).setDepth(2);
  }

  update(time) {
    const { data } = this;
    const travel = Math.sin(time * data.speed + data.phase);
    const nextPose = Math.cos(time * data.speed * 4 + data.phase) > 0 ? 'idle' : 'leap';
    this.sprite.x = data.x + travel * data.range;
    this.sprite.y = data.y + Math.sin(time * 0.002 + data.phase) * 2;
    this.sprite.setFlipX(Math.cos(time * data.speed + data.phase) < 0);
    if (nextPose !== this.pose) {
      this.pose = nextPose;
      this.sprite.setTexture(ensureSpiderTexture(this.scene, data.palette, nextPose));
    }
    this.label.setPosition(this.sprite.x, this.sprite.y - 30);
  }

  destroy() {
    this.sprite.destroy();
    this.label.destroy();
  }
}

class PaperResident {
  constructor(scene, data, reducedMotion) {
    this.sprite = scene.add.image(data.x, data.y, 'npc-lineup', ensureResidentFrame(scene, data.frame))
      .setOrigin(0.5, 1)
      .setScale(data.scale || 0.25)
      .setDepth(0);
    this.label = scene.add.text(data.x, data.y + 8, data.name, {
      fontFamily: WORLD_TYPE.ui,
      fontSize: '11px',
      color: WORLD_CSS.inkSoft,
      backgroundColor: WORLD_CSS.paper,
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 0).setDepth(1);
    if (!reducedMotion) {
      this.tween = scene.tweens.add({
        targets: this.sprite,
        y: data.y - 5,
        duration: 1800 + data.frame * 170,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1
      });
    }
  }

  destroy() {
    this.tween?.stop();
    this.sprite.destroy();
    this.label.destroy();
  }
}

export default class WorldResidents {
  constructor(scene, map) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.spiders = (map.npcSpiders || []).map((data) => new SpiderResident(scene, data));
    this.people = (map.humanoids || []).map((data) => new PaperResident(scene, data, reducedMotion));
  }

  update(time) {
    this.spiders.forEach((spider) => spider.update(time));
  }

  destroy() {
    this.spiders.forEach((spider) => spider.destroy());
    this.people.forEach((person) => person.destroy());
  }
}
