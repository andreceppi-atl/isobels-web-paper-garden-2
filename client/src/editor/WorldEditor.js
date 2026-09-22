import { WORLD_COLOR } from '../world/worldTheme.js';
import WorldEditorPanel from '../ui/WorldEditorPanel.js';
import EditorArtSurface from './EditorArtSurface.js';
import {
  applyLevelPatch,
  blankPatch,
  findSolidAt,
  loadLevelPatch,
  makeEditorId,
  normalizePatch,
  saveLevelPatch
} from './levelPatch.js';

const HISTORY_LIMIT = 50;
const PAN_SPEED = 1.45;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.25;
const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default class WorldEditor {
  constructor(scene, map, { onModeChange } = {}) {
    this.scene = scene;
    this.map = map;
    this.onModeChange = onModeChange;
    this.patch = loadLevelPatch(map);
    this.history = [];
    this.future = [];
    this.active = false;
    this.layer = 'graphic';
    this.tool = 'paint';
    this.color = 'ink';
    this.size = 2;
    this.art = new EditorArtSurface(scene, map);
  }

  get canvas() {
    return this.art.canvas;
  }

  prepare() {
    applyLevelPatch(this.map, this.patch);
    this.art.prepare(this.patch.graphicStrokes);
  }

  attach(worldView) {
    this.worldView = worldView;
    this.preview = this.scene.add.graphics().setDepth(8).setVisible(false);
    this.panel = new WorldEditorPanel({
      onToggle: () => this.setActive(!this.active),
      onBrush: (layer, tool, size) => Object.assign(this, { layer, tool, size }),
      onColor: (color) => { this.color = color; },
      undo: () => this.undo(),
      redo: () => this.redo(),
      export: () => this.exportPatch(),
      import: () => {},
      reset: () => this.reset(),
      onImport: (text) => this.importPatch(text)
    });
    this.panel.setHistory(false, false);
    this.bindInput();
  }

  bindInput() {
    this.onDown = (pointer) => this.pointerDown(pointer);
    this.onMove = (pointer) => this.pointerMove(pointer);
    this.onUp = (pointer) => this.pointerUp(pointer);
    this.onWheel = (pointer, _objects, _dx, dy) => this.zoom(pointer, dy);
    this.scene.input.on('pointerdown', this.onDown);
    this.scene.input.on('pointermove', this.onMove);
    this.scene.input.on('pointerup', this.onUp);
    this.scene.input.on('wheel', this.onWheel);
  }

  setActive(active) {
    this.active = active;
    this.cancelDrawing();
    this.preview.setVisible(active);
    this.panel.setOpen(active);
    this.onModeChange?.(active);
    this.panel.setStatus(active ? 'EDITING / LOCAL' : 'LOCAL DRAFT');
  }

  worldPoint(pointer) {
    const point = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return {
      x: clamp(Math.round(point.x), 0, this.map.width),
      y: clamp(Math.round(point.y), 0, this.map.height)
    };
  }

  artPoint(world) {
    const scale = this.map.artPlate.scale;
    return {
      x: clamp(Math.round(world.x / scale), 0, this.map.artPlate.nativeWidth - 1),
      y: clamp(Math.round(world.y / scale), 0, this.map.artPlate.nativeHeight - 1)
    };
  }

  pointerDown(pointer) {
    if (!this.active || pointer.rightButtonDown()) return;
    const world = this.worldPoint(pointer);
    if (this.layer === 'tangible' && this.tool === 'erase') return this.eraseSolid(world);
    this.pushHistory();
    if (this.layer === 'graphic') {
      const point = this.artPoint(world);
      this.stroke = { id: makeEditorId('stroke'), mode: this.tool, color: this.color, size: this.size, points: [[point.x, point.y]] };
      this.patch.graphicStrokes.push(this.stroke);
      this.art.drawStroke(this.stroke);
    } else {
      this.dragStart = this.snapWorld(world);
      this.dragEnd = this.dragStart;
      this.drawPreview();
    }
  }

  pointerMove(pointer) {
    if (!this.active) return;
    const world = this.worldPoint(pointer);
    const art = this.artPoint(world);
    this.panel.setPosition(art, world);
    if (this.stroke) {
      const last = this.stroke.points.at(-1);
      if (last[0] === art.x && last[1] === art.y) return;
      this.stroke.points.push([art.x, art.y]);
      this.art.drawStroke(this.stroke, this.stroke.points.length - 2);
    } else if (this.dragStart) {
      this.dragEnd = this.snapWorld(world);
      this.drawPreview();
    }
  }

  pointerUp(pointer) {
    if (!this.active) return;
    if (this.stroke) {
      this.stroke = null;
      return this.commit('GRAPHIC SAVED');
    }
    if (!this.dragStart) return;
    this.dragEnd = this.snapWorld(this.worldPoint(pointer));
    const solid = this.makeSolid(this.dragStart, this.dragEnd);
    this.dragStart = null;
    this.dragEnd = null;
    this.preview.clear();
    this.patch.addedSolids.push(solid);
    this.syncSolids();
    this.commit('TANGIBLE SAVED');
  }

  snapWorld(point) {
    const grid = this.map.artPlate.scale;
    return { x: Math.round(point.x / grid) * grid, y: Math.round(point.y / grid) * grid };
  }

  makeSolid(start, end) {
    const thickness = this.size * this.map.artPlate.scale;
    const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
    const x = horizontal ? Math.min(start.x, end.x) : start.x - thickness / 2;
    const y = horizontal ? start.y - thickness / 2 : Math.min(start.y, end.y);
    const w = horizontal ? Math.max(thickness, Math.abs(end.x - start.x)) : thickness;
    const h = horizontal ? thickness : Math.max(thickness, Math.abs(end.y - start.y));
    const id = makeEditorId('solid');
    return { id, editorId: id, x, y, w, h, kind: 'editor', feature: 'builder platform' };
  }

  drawPreview() {
    const solid = this.makeSolid(this.dragStart, this.dragEnd);
    this.preview.clear();
    this.preview.fillStyle(WORLD_COLOR.linkBlue, 0.18).fillRect(solid.x, solid.y, solid.w, solid.h);
    this.preview.lineStyle(2, WORLD_COLOR.ink, 0.9).strokeRect(solid.x, solid.y, solid.w, solid.h);
  }

  eraseSolid(point) {
    const solid = findSolidAt(this.map.solids, point, this.map.artPlate.scale * 3);
    if (!solid) return this.panel.setStatus('NOTHING TANGIBLE HERE');
    this.pushHistory();
    if (solid.editorBase) this.patch.hiddenSolidIds.push(solid.editorId);
    else this.patch.addedSolids = this.patch.addedSolids.filter((item) => item.editorId !== solid.editorId);
    this.syncSolids();
    this.commit('TANGIBLE DELETED');
  }

  pushHistory() {
    this.history.push(clone(this.patch));
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
    this.future = [];
    this.updateHistory();
  }

  undo() {
    if (!this.history.length) return;
    this.future.push(clone(this.patch));
    this.patch = this.history.pop();
    this.restore('UNDONE');
  }

  redo() {
    if (!this.future.length) return;
    this.history.push(clone(this.patch));
    this.patch = this.future.pop();
    this.restore('REDONE');
  }

  restore(status) {
    this.art.redraw(this.patch.graphicStrokes);
    this.syncSolids();
    this.commit(status);
  }

  syncSolids() {
    applyLevelPatch(this.map, this.patch);
    this.worldView?.syncSolids(this.map.solids);
    this.scene.crawl?.end();
  }

  commit(status) {
    const saved = saveLevelPatch(this.patch);
    this.panel.setStatus(saved ? status : 'LOCAL STORAGE FULL');
    this.updateHistory();
  }

  updateHistory() {
    this.panel?.setHistory(this.history.length > 0, this.future.length > 0);
  }

  exportPatch() {
    const blob = new Blob([JSON.stringify(this.patch, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${this.map.id}-draft.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.panel.setStatus('JSON SAVED');
  }

  async importPatch(text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.mapId !== this.map.id) throw new Error('wrong map');
      this.pushHistory();
      this.patch = normalizePatch(parsed, this.map);
      this.restore('JSON LOADED');
    } catch {
      this.panel.setStatus('INVALID MAP JSON');
    }
  }

  reset() {
    if (!window.confirm('Clear every local graphic and tangible edit?')) return;
    this.pushHistory();
    this.patch = blankPatch(this.map.id);
    this.restore('DRAFT RESET');
  }

  zoom(pointer, deltaY) {
    if (!this.active) return;
    const camera = this.scene.cameras.main;
    const before = camera.getWorldPoint(pointer.x, pointer.y);
    camera.setZoom(clamp(camera.zoom * (deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM));
    const after = camera.getWorldPoint(pointer.x, pointer.y);
    camera.scrollX += before.x - after.x;
    camera.scrollY += before.y - after.y;
  }

  update(delta) {
    if (!this.active || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    const keys = this.scene.keys;
    const cursors = this.scene.cursors;
    const dx = (keys.D.isDown || cursors.right.isDown ? 1 : 0) - (keys.A.isDown || cursors.left.isDown ? 1 : 0);
    const dy = (keys.S.isDown || cursors.down.isDown ? 1 : 0) - (keys.W.isDown || cursors.up.isDown ? 1 : 0);
    const camera = this.scene.cameras.main;
    camera.scrollX += dx * PAN_SPEED * delta / camera.zoom;
    camera.scrollY += dy * PAN_SPEED * delta / camera.zoom;
  }

  cancelDrawing() {
    const unfinished = !!(this.stroke || this.dragStart);
    if (this.stroke) this.patch.graphicStrokes = this.patch.graphicStrokes.filter((item) => item !== this.stroke);
    this.stroke = null;
    this.dragStart = null;
    this.dragEnd = null;
    this.preview?.clear();
    this.art.redraw(this.patch.graphicStrokes);
    if (unfinished) this.history.pop();
    this.updateHistory();
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown);
    this.scene.input.off('pointermove', this.onMove);
    this.scene.input.off('pointerup', this.onUp);
    this.scene.input.off('wheel', this.onWheel);
    this.panel?.destroy();
    this.preview?.destroy();
  }
}
