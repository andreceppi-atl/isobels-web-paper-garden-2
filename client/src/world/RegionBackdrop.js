import { WORLD_COLOR, WORLD_CSS, WORLD_TYPE } from './worldTheme.js';

const REGION = 25600;
const TAU = Math.PI * 2;

function mixColor(a, b, t) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return ((Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t));
}

export default class RegionBackdrop {
  constructor(scene, map) {
    this.scene = scene;
    this.map = map;
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
    this.drawRegionWashes();
    this.drawSnowfield();
    this.drawBlossomCrown();
    this.drawLiveWeb();
    this.drawBillboards();
    this.createParticles();
  }

  drawRegionWashes() {
    const g = this.keep(this.scene.add.graphics().setDepth(-6));
    const tones = [WORLD_COLOR.ice, WORLD_COLOR.blossom, WORLD_COLOR.linkWash];
    tones.forEach((tone, index) => {
      g.fillStyle(tone, 0.25);
      g.fillRect(index * REGION, 0, REGION, this.map.height);
    });
    [REGION, REGION * 2].forEach((edge, boundary) => {
      const left = tones[boundary];
      const right = tones[boundary + 1];
      for (let strip = 0; strip < 24; strip += 1) {
        g.fillStyle(mixColor(left, right, strip / 23), 0.42);
        g.fillRect(edge - 2400 + strip * 200, 0, 202, this.map.height);
      }
    });
  }

  drawSnowfield() {
    const far = this.keep(this.scene.add.graphics().setDepth(-5));
    far.fillStyle(WORLD_COLOR.paperDeep, 0.84);
    for (let x = -400; x < REGION + 900; x += 1800) {
      const peak = 650 + ((x / 1800) % 3) * 240;
      far.fillTriangle(x, 3350, x + 900, peak, x + 1900, 3350);
    }
    far.lineStyle(2, WORLD_COLOR.inkSoft, 0.3);
    for (let x = -400; x < REGION + 900; x += 1800) {
      const peak = 650 + ((x / 1800) % 3) * 240;
      far.lineBetween(x, 3350, x + 900, peak);
      far.lineBetween(x + 900, peak, x + 1900, 3350);
    }

    const trees = this.keep(this.scene.add.graphics().setDepth(-3));
    for (let x = 240; x < REGION - 200; x += 520) {
      const size = 110 + ((x / 520) % 4) * 26;
      const y = 7020 - ((x / 520) % 3) * 45;
      trees.lineStyle(2, WORLD_COLOR.ink, 0.52);
      trees.lineBetween(x, y, x, y - size * 1.9);
      trees.fillStyle(WORLD_COLOR.inkSoft, 0.2);
      trees.fillTriangle(x - size * 0.62, y - size * 0.45, x, y - size * 1.9, x + size * 0.62, y - size * 0.45);
      trees.fillTriangle(x - size * 0.78, y - size * 0.05, x, y - size * 1.45, x + size * 0.78, y - size * 0.05);
    }
  }

  drawBlossomCrown() {
    const g = this.keep(this.scene.add.graphics().setDepth(-4));
    const cx = REGION * 1.5;
    g.fillStyle(WORLD_COLOR.ink, 0.9);
    g.beginPath();
    g.moveTo(cx - 350, 7420);
    g.lineTo(cx - 300, 6400);
    g.lineTo(cx - 170, 5200);
    g.lineTo(cx - 230, 4100);
    g.lineTo(cx - 90, 2900);
    g.lineTo(cx, 2100);
    g.lineTo(cx + 100, 2900);
    g.lineTo(cx + 250, 4100);
    g.lineTo(cx + 170, 5200);
    g.lineTo(cx + 310, 6400);
    g.lineTo(cx + 350, 7420);
    g.closePath();
    g.fillPath();
    for (let index = 0; index < 34; index += 1) {
      const angle = (index / 34) * TAU;
      const ring = 920 + (index % 5) * 250;
      const x = cx + Math.cos(angle) * ring * 1.35;
      const y = 1900 + Math.sin(angle) * ring * 0.62;
      g.fillCircle(x, y, 520 + (index % 4) * 90);
    }
    g.lineStyle(56, WORLD_COLOR.ink, 0.88);
    [[-3600, 4300], [-2500, 3200], [2800, 3800], [3800, 2900]].forEach(([dx, y], index) => {
      g.lineBetween(cx + (index < 2 ? -220 : 220), y + 850, cx + dx, y);
    });

    const petals = this.keep(this.scene.add.graphics().setDepth(-3));
    for (let index = 0; index < 180; index += 1) {
      const angle = index * 2.399;
      const radius = 260 + (index % 23) * 92;
      const x = cx + Math.cos(angle) * radius * 1.35;
      const y = 1850 + Math.sin(angle) * radius * 0.58;
      petals.fillStyle(index % 4 ? WORLD_COLOR.blossomLight : WORLD_COLOR.paper, 0.92);
      petals.fillCircle(x, y, 12 + (index % 4) * 3);
    }
    this.keep(this.scene.add.text(cx, 1110, "ISOBEL'S TREE", {
      fontFamily: WORLD_TYPE.display,
      fontSize: '44px',
      color: WORLD_CSS.paper,
      stroke: WORLD_CSS.ink,
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(-2));
  }

  drawLiveWeb() {
    const g = this.keep(this.scene.add.graphics().setDepth(-4));
    const start = REGION * 2;
    g.lineStyle(3, WORLD_COLOR.linkBlue, 0.54);
    g.fillStyle(WORLD_COLOR.paper, 0.82);
    for (let index = 0; index < 10; index += 1) {
      const x = start + 900 + index * 2380;
      const y = 760 + (index % 3) * 360;
      const w = 1600 + (index % 2) * 320;
      const h = 920 + (index % 4) * 180;
      g.fillRect(x, y, w, h);
      g.strokeRect(x, y, w, h);
      g.lineBetween(x + 100, y + 150, x + w - 120, y + 150);
      for (let row = 0; row < 4; row += 1) {
        g.lineBetween(x + 100, y + 250 + row * 120, x + w * (0.5 + (row % 3) * 0.12), y + 250 + row * 120);
      }
    }

    const nav = ['home', 'songs', 'about', 'contact', 'photobook', 'blog'];
    nav.forEach((label, index) => {
      this.keep(this.scene.add.text(start + 920 + index * 420, 420, label, {
        fontFamily: WORLD_TYPE.ui,
        fontSize: '22px',
        color: WORLD_CSS.linkBlue
      }).setDepth(-2));
    });

    (this.map.microblogPosts || []).forEach((post, index) => {
      const card = this.keep(this.scene.add.container(post.x, post.y).setDepth(-2));
      const box = this.scene.add.rectangle(0, 0, 1600, 450, WORLD_COLOR.paper, 0.94)
        .setStrokeStyle(2, WORLD_COLOR.inkSoft, 0.7);
      const date = this.scene.add.text(-720, -164, post.date, {
        fontFamily: WORLD_TYPE.ui, fontSize: '18px', color: WORLD_CSS.linkBlue
      });
      const title = this.scene.add.text(-720, -105, post.title, {
        fontFamily: WORLD_TYPE.display, fontSize: '32px', color: WORLD_CSS.ink
      });
      const body = this.scene.add.text(-720, -28, post.body, {
        fontFamily: WORLD_TYPE.ui, fontSize: '18px', color: WORLD_CSS.inkSoft
      });
      const lines = this.scene.add.text(-720, 62, '────────────────────\nreply · archive · next', {
        fontFamily: WORLD_TYPE.ui, fontSize: '16px', color: WORLD_CSS.inkSoft, lineSpacing: 18
      });
      card.add([box, date, title, body, lines]);
      card.rotation = (index % 2 ? -1 : 1) * 0.012;
    });
  }

  drawBillboards() {
    (this.map.billboards || []).forEach((board) => {
      const g = this.keep(this.scene.add.graphics().setDepth(-1));
      g.lineStyle(5, WORLD_COLOR.ink, 0.82);
      g.fillStyle(WORLD_COLOR.paper, 0.88);
      g.fillRect(board.x, board.y, board.w, board.h);
      g.strokeRect(board.x, board.y, board.w, board.h);
      g.lineBetween(board.x + 90, board.y + board.h, board.x + 90, board.y + board.h + 260);
      g.lineBetween(board.x + board.w - 90, board.y + board.h, board.x + board.w - 90, board.y + board.h + 260);
      this.keep(this.scene.add.text(board.x + board.w / 2, board.y + board.h / 2, board.label, {
        fontFamily: WORLD_TYPE.ui,
        fontSize: '16px',
        color: WORLD_CSS.inkSoft,
        align: 'center',
        wordWrap: { width: board.w - 80 }
      }).setOrigin(0.5).setDepth(0));
    });
  }

  createParticles() {
    const add = (type, x, y, size, speed, drift) => {
      const color = type === 'petal' ? WORLD_COLOR.blossomLight : type === 'paper' ? WORLD_COLOR.linkBlue : WORLD_COLOR.white;
      const object = type === 'paper'
        ? this.scene.add.rectangle(x, y, size * 1.7, size, color, 0.54)
        : this.scene.add.circle(x, y, size, color, type === 'snow' ? 0.78 : 0.68);
      object.setDepth(-1);
      this.particles.push({ object, type, baseX: x, baseY: y, speed, drift, phase: x * 0.0017 });
    };
    for (let i = 0; i < 90; i += 1) add('snow', (i * 887) % REGION, (i * 317) % 7200, 3 + (i % 4), 0.016 + (i % 3) * 0.004, 18 + (i % 5) * 6);
    for (let i = 0; i < 86; i += 1) add('petal', REGION + (i * 733) % REGION, (i * 281) % 7100, 4 + (i % 3), 0.011 + (i % 4) * 0.003, 30 + (i % 6) * 7);
    for (let i = 0; i < 58; i += 1) add('paper', REGION * 2 + (i * 991) % REGION, (i * 367) % 7000, 5 + (i % 4), 0.008 + (i % 3) * 0.002, 42 + (i % 4) * 8);
  }

  stampFootprint(now, player) {
    if (now - this.lastFootprint < 150) return;
    this.lastFootprint = now;
    const g = this.scene.add.graphics().setDepth(-0.5);
    g.fillStyle(WORLD_COLOR.inkSoft, 0.24);
    const direction = player.vx >= 0 ? -1 : 1;
    for (let leg = 0; leg < 4; leg += 1) {
      g.fillEllipse(player.x + direction * (12 + leg * 5), player.y + (leg - 1.5) * 5, 7, 3);
    }
    this.footprints.push({ object: g, born: now });
    if (this.footprints.length > 64) this.footprints.shift().object.destroy();
  }

  update(time, player) {
    if (!this.reducedMotion) {
      this.particles.forEach((particle) => {
        const range = particle.type === 'snow' ? 7200 : 7000;
        particle.object.y = (particle.baseY + time * particle.speed) % range;
        particle.object.x = particle.baseX + Math.sin(time * 0.0005 + particle.phase) * particle.drift;
        if (particle.type === 'paper') particle.object.rotation = Math.sin(time * 0.0007 + particle.phase) * 0.5;
      });
    }
    if (player?.grounded && player.x < REGION && Math.abs(player.vx) > 1.4) this.stampFootprint(time, player);
    this.footprints.forEach((print) => print.object.setAlpha(Math.max(0, 1 - (time - print.born) / 18000)));
    while (this.footprints[0] && time - this.footprints[0].born > 18000) this.footprints.shift().object.destroy();
  }

  destroy() {
    this.objects.forEach((object) => object.destroy());
    this.particles.forEach(({ object }) => object.destroy());
    this.footprints.forEach(({ object }) => object.destroy());
  }
}
