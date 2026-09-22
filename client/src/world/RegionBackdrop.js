import Phaser from 'phaser';
import { WORLD_COLOR, WORLD_CSS, WORLD_TYPE } from './worldTheme.js';

const TAU = Math.PI * 2;

export default class RegionBackdrop {
  constructor(scene, map) {
    this.scene = scene;
    this.map = map;
    this.regionWidth = map.regions?.[0]?.w || map.width / 3;
    this.objects = [];
    this.particles = [];
    this.footprints = [];
    this.lastFootprint = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  keep(object) {
    this.objects.push(object);
    return object;
  }

  build() {
    if (this.map.id !== 'overworld') return;
    this.drawPaperAndRegions();
    this.drawSnowfield();
    this.drawBlossomCrown();
    this.drawLiveWeb();
    this.drawBillboards();
    this.drawEditorLayer();
    this.createParticles();
  }

  drawPaperAndRegions() {
    const g = this.keep(this.scene.add.graphics().setDepth(-8));
    const tones = [WORLD_COLOR.ice, WORLD_COLOR.blossom, WORLD_COLOR.linkWash];
    tones.forEach((tone, index) => {
      g.fillStyle(tone, 0.12);
      g.fillRect(index * this.regionWidth, 0, this.regionWidth, this.map.height);
    });
    for (let x = 0; x < this.map.width; x += 96) {
      for (let y = 80; y < this.map.height; y += 96) {
        if ((x / 96 + y / 96) % 3 !== 0) continue;
        g.fillStyle(WORLD_COLOR.inkSoft, 0.08);
        g.fillCircle(x + 28, y + 16, 1.3);
      }
    }
    [this.regionWidth, this.regionWidth * 2].forEach((edge) => {
      for (let strip = 0; strip < 12; strip += 1) {
        g.fillStyle(WORLD_COLOR.paper, 0.055 + strip * 0.012);
        g.fillRect(edge - 540 + strip * 90, 0, 92, this.map.height);
      }
    });
  }

  drawSnowfield() {
    const g = this.keep(this.scene.add.graphics().setDepth(-6));
    g.lineStyle(3, WORLD_COLOR.inkSoft, 0.28);
    g.fillStyle(WORLD_COLOR.paper, 0.38);
    const peaks = [[-240, 1840, 720, 620, 1680, 1840], [1100, 1840, 2080, 420, 3060, 1840], [2600, 1840, 3580, 300, 4700, 1840], [4100, 1840, 4860, 740, 5350, 1840]];
    peaks.forEach(([x1, y1, px, py, x2, y2]) => {
      g.fillTriangle(x1, y1, px, py, x2, y2);
      g.lineBetween(x1, y1, px, py);
      g.lineBetween(px, py, x2, y2);
      g.lineBetween(px - 150, py + 220, px, py);
      g.lineBetween(px, py, px + 210, py + 280);
    });
    for (let index = 0; index < 14; index += 1) {
      const x = 180 + index * 360;
      const base = 2370 - (index % 4) * 34;
      const size = 100 + (index % 3) * 24;
      g.lineStyle(2, WORLD_COLOR.ink, 0.32);
      g.lineBetween(x, base, x, base - size * 1.65);
      [0, 1, 2].forEach((tier) => {
        const y = base - size * (0.5 + tier * 0.38);
        const half = size * (0.8 - tier * 0.14);
        g.strokeTriangle(x - half, y, x, y - size * 0.72, x + half, y);
      });
    }
    this.label(2450, 300, 'SNOWFIELD / RADIO TRAIL', 28);
  }

  drawBlossomCrown() {
    const g = this.keep(this.scene.add.graphics().setDepth(-6));
    const cx = this.regionWidth * 1.5 + 290;
    g.lineStyle(8, WORLD_COLOR.ink, 0.34);
    g.fillStyle(WORLD_COLOR.blossom, 0.24);
    g.fillRect(cx - 90, 1180, 180, 1020);
    g.strokeRect(cx - 90, 1180, 180, 1020);
    [[-80, 1450, -850, 1210], [80, 1430, 900, 1180], [-60, 1780, -1180, 1600], [60, 1760, 1180, 1580]].forEach(([sx, sy, dx, dy]) => {
      g.lineBetween(cx + sx, sy, cx + dx, dy);
    });
    for (let index = 0; index < 28; index += 1) {
      const angle = index * (TAU / 28);
      const ring = 560 + (index % 5) * 100;
      const x = cx + Math.cos(angle) * ring * 1.28;
      const y = 760 + Math.sin(angle) * ring * 0.47;
      g.fillStyle(index % 3 ? WORLD_COLOR.blossomLight : WORLD_COLOR.paper, 0.16);
      g.fillCircle(x, y, 170 + (index % 4) * 24);
      g.lineStyle(2, WORLD_COLOR.inkSoft, 0.14);
      g.strokeCircle(x, y, 170 + (index % 4) * 24);
    }
    const house = this.keep(this.scene.add.graphics().setDepth(-4));
    house.fillStyle(WORLD_COLOR.paper, 0.88);
    house.lineStyle(3, WORLD_COLOR.ink, 0.68);
    house.fillRect(cx - 190, 860, 380, 300);
    house.strokeRect(cx - 190, 860, 380, 300);
    house.strokeTriangle(cx - 240, 860, cx, 680, cx + 240, 860);
    house.strokeRect(cx - 46, 980, 92, 180);
    house.strokeRect(cx - 142, 925, 78, 72);
    house.strokeRect(cx + 64, 925, 78, 72);
    this.label(cx, 540, "ISOBEL'S TREE / SONG HOUSE", 28);
  }

  drawLiveWeb() {
    const start = this.regionWidth * 2;
    const g = this.keep(this.scene.add.graphics().setDepth(-6));
    g.lineStyle(3, WORLD_COLOR.inkSoft, 0.28);
    g.strokeRect(start + 110, 300, this.regionWidth - 220, 2050);
    g.lineBetween(start + 110, 520, start + this.regionWidth - 110, 520);
    ['home', 'songs', 'about', 'photobook', 'blog'].forEach((label, index) => {
      this.label(start + 360 + index * 770, 420, label, 18, WORLD_CSS.linkBlue);
    });
    const cards = [
      [start + 320, 700, 1180, 360], [start + 1700, 620, 880, 440],
      [start + 2760, 660, 1080, 300], [start + 4020, 620, 780, 440],
      [start + 500, 1320, 980, 300], [start + 3900, 1340, 820, 330]
    ];
    cards.forEach(([x, y, w, h], index) => {
      g.fillStyle(WORLD_COLOR.paper, 0.54);
      g.fillRect(x, y, w, h);
      g.strokeRect(x, y, w, h);
      for (let row = 0; row < 3; row += 1) {
        g.lineBetween(x + 50, y + 90 + row * 62, x + w * (0.52 + ((row + index) % 3) * 0.1), y + 90 + row * 62);
      }
    });
    (this.map.microblogPosts || []).forEach((post, index) => {
      const card = this.keep(this.scene.add.container(post.x, post.y).setDepth(-3));
      const box = this.scene.add.rectangle(0, 0, 680, 250, WORLD_COLOR.paper, 0.9).setStrokeStyle(2, WORLD_COLOR.inkSoft, 0.55);
      const date = this.scene.add.text(-300, -94, post.date, { fontFamily: WORLD_TYPE.ui, fontSize: '14px', color: WORLD_CSS.linkBlue });
      const title = this.scene.add.text(-300, -48, post.title, { fontFamily: WORLD_TYPE.display, fontSize: '23px', color: WORLD_CSS.ink });
      const body = this.scene.add.text(-300, 10, post.body, { fontFamily: WORLD_TYPE.ui, fontSize: '14px', color: WORLD_CSS.inkSoft });
      const footer = this.scene.add.text(-300, 64, 'reply · archive · next', { fontFamily: WORLD_TYPE.ui, fontSize: '12px', color: WORLD_CSS.inkSoft });
      card.add([box, date, title, body, footer]);
      card.rotation = (index % 2 ? -1 : 1) * 0.012;
    });
    this.label(start + 2580, 255, 'LIVE WEB / MICROBLOG RAVINE', 28);
  }

  drawBillboards() {
    (this.map.billboards || []).forEach((board) => {
      const g = this.keep(this.scene.add.graphics().setDepth(-1));
      g.lineStyle(3, WORLD_COLOR.ink, 0.68);
      g.fillStyle(WORLD_COLOR.paper, 0.8);
      g.fillRect(board.x, board.y, board.w, board.h);
      g.strokeRect(board.x, board.y, board.w, board.h);
      g.lineBetween(board.x + 52, board.y + board.h, board.x + 52, board.y + board.h + 90);
      g.lineBetween(board.x + board.w - 52, board.y + board.h, board.x + board.w - 52, board.y + board.h + 90);
      this.keep(this.scene.add.text(board.x + board.w / 2, board.y + board.h / 2, board.label, {
        fontFamily: WORLD_TYPE.ui,
        fontSize: '14px',
        color: WORLD_CSS.inkSoft,
        align: 'center',
        wordWrap: { width: board.w - 56 }
      }).setOrigin(0.5).setDepth(0));
    });
  }

  drawEditorLayer() {
    const grid = this.map.editorGrid;
    if (!grid?.runtimeTexture) return;
    this.scene.textures.get(grid.runtimeTexture).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.keep(this.scene.add.image(0, 0, grid.runtimeTexture)
      .setOrigin(0, 0)
      .setDisplaySize(this.map.width, this.map.height)
      .setDepth(0.5));
  }

  label(x, y, text, size, color = WORLD_CSS.inkSoft) {
    return this.keep(this.scene.add.text(x, y, text, {
      fontFamily: WORLD_TYPE.ui,
      fontSize: `${size}px`,
      color,
      backgroundColor: WORLD_CSS.paper,
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setDepth(-2));
  }

  createParticles() {
    const add = (type, x, y, size, speed, drift) => {
      const color = type === 'petal' ? WORLD_COLOR.blossomLight : type === 'paper' ? WORLD_COLOR.linkBlue : WORLD_COLOR.white;
      const object = type === 'paper'
        ? this.scene.add.rectangle(x, y, size * 1.6, size, color, 0.34)
        : this.scene.add.circle(x, y, size, color, type === 'snow' ? 0.68 : 0.52);
      object.setDepth(-1);
      this.particles.push({ object, type, baseX: x, baseY: y, speed, drift, phase: x * 0.0017 });
    };
    for (let i = 0; i < 36; i += 1) add('snow', (i * 887) % this.regionWidth, (i * 317) % 2300, 2 + (i % 3), 0.01 + (i % 3) * 0.003, 12 + (i % 4) * 5);
    for (let i = 0; i < 30; i += 1) add('petal', this.regionWidth + (i * 733) % this.regionWidth, (i * 281) % 2200, 3 + (i % 2), 0.008 + (i % 4) * 0.002, 20 + (i % 5) * 5);
    for (let i = 0; i < 18; i += 1) add('paper', this.regionWidth * 2 + (i * 991) % this.regionWidth, (i * 367) % 2200, 4 + (i % 3), 0.006 + (i % 3) * 0.002, 28 + (i % 4) * 6);
  }

  stampFootprint(now, player) {
    if (now - this.lastFootprint < 150) return;
    this.lastFootprint = now;
    const g = this.scene.add.graphics().setDepth(0.2);
    g.fillStyle(WORLD_COLOR.inkSoft, 0.24);
    const direction = player.vx >= 0 ? -1 : 1;
    for (let leg = 0; leg < 4; leg += 1) g.fillEllipse(player.x + direction * (12 + leg * 5), player.y + (leg - 1.5) * 5, 7, 3);
    this.footprints.push({ object: g, born: now });
    if (this.footprints.length > 64) this.footprints.shift().object.destroy();
  }

  update(time, player) {
    if (!this.reducedMotion) {
      this.particles.forEach((particle) => {
        particle.object.y = (particle.baseY + time * particle.speed) % 2380;
        particle.object.x = particle.baseX + Math.sin(time * 0.0005 + particle.phase) * particle.drift;
        if (particle.type === 'paper') particle.object.rotation = Math.sin(time * 0.0007 + particle.phase) * 0.5;
      });
    }
    if (player?.grounded && player.x < this.regionWidth && Math.abs(player.vx) > 1.4) this.stampFootprint(time, player);
    this.footprints.forEach((print) => print.object.setAlpha(Math.max(0, 1 - (time - print.born) / 18000)));
    while (this.footprints[0] && time - this.footprints[0].born > 18000) this.footprints.shift().object.destroy();
  }

  destroy() {
    this.objects.forEach((object) => object.destroy());
    this.particles.forEach(({ object }) => object.destroy());
    this.footprints.forEach(({ object }) => object.destroy());
  }
}
