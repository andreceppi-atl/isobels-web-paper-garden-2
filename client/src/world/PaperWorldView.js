import { WORLD_COLOR, WORLD_CSS, WORLD_TYPE } from './worldTheme.js';

const KIND_FILL = Object.freeze({
  floor: WORLD_COLOR.paperDeep,
  tower: WORLD_COLOR.paperShade,
  ledge: WORLD_COLOR.paper,
  rock: WORLD_COLOR.paperShade,
  snow: WORLD_COLOR.ice,
  branch: WORLD_COLOR.blossom,
  trunk: WORLD_COLOR.blossom,
  page: WORLD_COLOR.linkWash,
  card: WORLD_COLOR.paper
});

export default class PaperWorldView {
  constructor(scene, map, anchors) {
    this.scene = scene;
    this.map = map;
    this.anchors = anchors;
    this.solidItems = new Map();
  }

  build() {
    this.addPaperGrain();
    this.addBackgroundDoodles();
    this.addRoomGuides();
    this.addSolids();
    this.addLandmarks();
    this.addAnchors();
  }

  addPaperGrain() {
    if (this.map.artPlate) return;
    if (!this.scene.textures.exists('paper-garden')) return;
    const imageWidth = 1774;
    for (let x = 0; x < this.map.width + imageWidth; x += imageWidth - 80) {
      this.scene.add.image(x, 110, 'paper-garden')
        .setOrigin(0, 0)
        .setAlpha(0.14)
        .setDepth(-4);
    }
  }

  addRoomGuides() {
    const g = this.scene.add.graphics().setDepth(-2);
    if (!this.map.artPlate) {
      for (let y = 260; y < this.map.height; y += 220) {
        g.lineStyle(1, WORLD_COLOR.inkFaint, 0.14);
        g.lineBetween(0, y, this.map.width, y);
      }
    }
    (this.map.rooms || []).forEach((room, index) => {
      if (index > 0 && !this.map.artPlate) {
        g.lineStyle(1, WORLD_COLOR.inkSoft, 0.26);
        g.lineBetween(room.x, 150, room.x, this.map.height - 170);
      }
      this.scene.add.text(room.x + 26, 188, `${String(index + 1).padStart(2, '0')} / ${room.label}`, {
        fontFamily: WORLD_TYPE.ui,
        fontSize: '16px',
        color: WORLD_CSS.inkSoft,
        backgroundColor: WORLD_CSS.paper,
        padding: { x: 5, y: 3 }
      }).setDepth(-1);
    });
  }

  addBackgroundDoodles() {
    (this.map.backgrounds || []).forEach((item) => {
      const g = this.scene.add.graphics().setDepth(-3);
      g.lineStyle(2, WORLD_COLOR.inkSoft, 0.34);
      g.fillStyle(WORLD_COLOR.paperShade, 0.52);
      const x = item.x;
      const y = item.y;
      const s = 42 * (item.scale || 1);

      if (item.type === 'antenna') {
        g.lineBetween(x, y - s, x, y + s);
        g.lineBetween(x - s * 0.55, y + s, x, y + s * 0.25);
        g.lineBetween(x + s * 0.55, y + s, x, y + s * 0.25);
        [-0.6, -0.25, 0.12].forEach((offset) => g.lineBetween(x - s * 0.45, y + s * offset, x + s * 0.45, y + s * offset));
      } else if (item.type === 'pond') {
        g.fillEllipse(x, y, s * 2.4, s * 0.9);
        g.strokeEllipse(x, y, s * 2.4, s * 0.9);
        g.strokeCircle(x - s * 0.42, y, s * 0.18);
        g.lineBetween(x + s * 0.15, y - 4, x + s * 0.48, y - 4);
      } else if (item.type === 'flowers' || item.type === 'garden') {
        for (let i = -2; i <= 2; i += 1) {
          const fx = x + i * s * 0.42;
          const fy = y + Math.abs(i % 2) * 10;
          g.lineBetween(fx, fy, fx, fy + s * 0.72);
          g.strokeCircle(fx, fy - 6, 8);
          g.strokeCircle(fx - 7, fy, 6);
          g.strokeCircle(fx + 7, fy, 6);
        }
      } else if (item.type === 'cassette') {
        g.fillRect(x - s, y - s * 0.55, s * 2, s * 1.1);
        g.strokeRect(x - s, y - s * 0.55, s * 2, s * 1.1);
        g.strokeCircle(x - s * 0.42, y, s * 0.25);
        g.strokeCircle(x + s * 0.42, y, s * 0.25);
        g.strokeRect(x - s * 0.38, y + s * 0.28, s * 0.76, s * 0.18);
      } else if (item.type === 'moon') {
        g.strokeCircle(x, y, s * 0.75);
        g.strokeCircle(x + s * 0.35, y - s * 0.12, s * 0.68);
        for (let i = 0; i < 6; i += 1) g.fillCircle(x - s + i * s * 0.4, y + s, 2.5);
      } else if (item.type === 'notes') {
        for (let i = -1; i <= 1; i += 1) {
          g.strokeRect(x + i * s * 0.8 - s * 0.32, y - s * 0.45 + Math.abs(i) * 8, s * 0.64, s * 0.9);
          g.lineBetween(x + i * s * 0.8 - 9, y - 5, x + i * s * 0.8 + 9, y - 5);
          g.lineBetween(x + i * s * 0.8 - 9, y + 6, x + i * s * 0.8 + 5, y + 6);
        }
      } else if (item.type === 'thicket') {
        for (let i = -3; i <= 3; i += 1) {
          g.lineBetween(x + i * 12, y + s, x + i * 8, y - s * 0.35 - Math.abs(i % 2) * 14);
          g.strokeCircle(x + i * 8, y - s * 0.45 - Math.abs(i % 2) * 14, 12);
        }
      } else if (item.type === 'lantern') {
        g.lineBetween(x, y - s, x, y - s * 0.35);
        g.strokeRect(x - s * 0.35, y - s * 0.35, s * 0.7, s * 0.9);
        g.strokeCircle(x, y + s * 0.1, s * 0.16);
      } else if (item.type === 'gate') {
        g.lineBetween(x - s, y + s, x - s, y - s * 0.5);
        g.lineBetween(x + s, y + s, x + s, y - s * 0.5);
        g.lineBetween(x - s, y - s * 0.5, x, y - s);
        g.lineBetween(x, y - s, x + s, y - s * 0.5);
        for (let i = -3; i <= 3; i += 1) g.lineBetween(x + i * s * 0.24, y + s, x + i * s * 0.24, y - s * 0.35);
      }
    });
  }

  addSolids() {
    this.hatch = this.scene.add.graphics().setDepth(0);
    this.map.solids.forEach((solid) => this.addSolid(solid));
  }

  addSolid(solid) {
    const followsArt = !!this.map.artPlate;
    const cx = solid.x + solid.w / 2;
    const cy = solid.y + solid.h / 2;
    const body = this.scene.matter.add.rectangle(cx, cy, solid.w, solid.h, {
      isStatic: true,
      label: 'solid',
      friction: 0.6
    });
    const display = this.scene.add.rectangle(
      cx,
      cy,
      solid.w,
      solid.h,
      KIND_FILL[solid.kind] || WORLD_COLOR.linkWash,
      solid.editorBase && followsArt ? 0.04 : 0.2
    )
      .setStrokeStyle(followsArt ? 1 : 2, WORLD_COLOR.ink, solid.editorBase && followsArt ? 0.24 : 0.72)
      .setDepth(solid.editorBase ? -1 : 0);
    this.solidItems.set(solid.editorId || solid, { body, display });
    if (!followsArt) this.hatchEdge(this.hatch, solid);
  }

  clearSolids() {
    this.solidItems.forEach(({ body, display }) => {
      this.scene.matter.world.remove(body);
      display.destroy();
    });
    this.solidItems.clear();
    this.hatch?.clear();
  }

  syncSolids(solids) {
    this.clearSolids();
    solids.forEach((solid) => this.addSolid(solid));
  }

  hatchEdge(graphics, solid) {
    const step = solid.kind === 'floor' ? 34 : 22;
    graphics.lineStyle(1, WORLD_COLOR.inkSoft, 0.34);
    for (let x = solid.x + 8; x < solid.x + solid.w - 4; x += step) {
      graphics.lineBetween(x, solid.y + 3, Math.min(x + 8, solid.x + solid.w - 2), solid.y + 11);
    }
    if (solid.kind === 'tower' || solid.kind === 'trunk' || (solid.kind === 'page' && solid.h > 200)) {
      for (let y = solid.y + 34; y < solid.y + solid.h - 12; y += 58) {
        graphics.lineBetween(solid.x + 8, y, solid.x + solid.w - 8, y);
      }
    }
  }

  addLandmarks() {
    (this.map.landmarks || []).forEach((mark) => {
      const g = this.scene.add.graphics().setDepth(-1);
      g.lineStyle(2, WORLD_COLOR.ink, 0.68);
      g.strokeCircle(mark.x, mark.y, 18);
      g.lineBetween(mark.x - 12, mark.y, mark.x + 12, mark.y);
      g.lineBetween(mark.x, mark.y - 12, mark.x, mark.y + 12);
      this.scene.add.text(mark.x, mark.y + 27, mark.label, {
        fontFamily: WORLD_TYPE.ui,
        fontSize: '12px',
        color: WORLD_CSS.inkSoft,
        backgroundColor: WORLD_CSS.paper,
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5, 0).setDepth(-1);
    });
  }

  addAnchors() {
    this.map.anchors.forEach((anchor) => {
      this.anchors.push({ x: anchor.x, y: anchor.y });
      if (anchor.visible === false) return;
      this.scene.add.circle(anchor.x, anchor.y, 9, WORLD_COLOR.paper, 0.9)
        .setStrokeStyle(2, WORLD_COLOR.ink)
        .setDepth(0);
      this.scene.add.circle(anchor.x, anchor.y, 2, WORLD_COLOR.ink).setDepth(0);
    });
  }

  addNest() {
    const { x, y } = this.map.nest;
    this.scene.add.rectangle(x, y, 94, 48, WORLD_COLOR.paper)
      .setStrokeStyle(2, WORLD_COLOR.ink)
      .setDepth(0);
    this.scene.add.text(x, y - 6, 'YOUR PAGE', {
      fontFamily: WORLD_TYPE.ui,
      fontSize: '11px',
      color: WORLD_CSS.ink
    }).setOrigin(0.5).setDepth(0);
    this.scene.add.text(x, y + 9, 'nest 01', {
      fontFamily: WORLD_TYPE.ui,
      fontSize: '9px',
      color: WORLD_CSS.inkSoft
    }).setOrigin(0.5).setDepth(0);
  }

  destroy() {
    this.clearSolids();
    this.hatch?.destroy();
  }
}
