import { threadHex } from '../../../shared/colors.js';
import { buildNests } from '../../../shared/worldWebs.js';
import { WORLD_COLOR, WORLD_CSS, WORLD_TYPE } from '../world/worldTheme.js';

export default class NestField {
  constructor(scene, map, strands) {
    this.scene = scene;
    this.map = map;
    this.strands = strands;
    this.records = new Map();
    this.decorations = [];
  }

  setAll(records = []) {
    this.records = new Map(records.map((record) => [record.slot, record]));
    this.rebuild();
  }

  upsert(record) {
    if (!record || !Number.isInteger(record.slot)) return;
    this.records.set(record.slot, record);
    this.rebuild();
  }

  rebuild() {
    this.decorations.forEach((item) => item.destroy());
    this.decorations = [];
    const nests = buildNests(this.map, [...this.records.values()]);
    this.strands.setPermanent(nests.flatMap((nest) => nest.strands), 'nests');

    nests.forEach((nest) => {
      const color = threadHex(nest.color);
      const hub = this.scene.add.circle(nest.x, nest.y, 10, WORLD_COLOR.paper, 0.96)
        .setStrokeStyle(3, color, 0.95)
        .setDepth(1);
      const label = this.scene.add.text(nest.x, nest.y + nest.radius + 14, `${nest.name} / HOME WEB`, {
        fontFamily: WORLD_TYPE.ui,
        fontSize: '11px',
        color: WORLD_CSS.inkSoft,
        backgroundColor: WORLD_CSS.paper,
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5, 0).setDepth(1);
      this.decorations.push(hub, label);
    });
  }

  destroy() {
    this.decorations.forEach((item) => item.destroy());
    this.decorations = [];
  }
}
