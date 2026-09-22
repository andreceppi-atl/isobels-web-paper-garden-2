const PATCH_VERSION = 1;
const GRAPHIC_MODES = new Set(['paint', 'erase']);
const GRAPHIC_COLORS = new Set(['ink', 'paper', 'petal', 'link']);
const BRUSH_SIZES = new Set([1, 2, 4, 8]);

export const LEVEL_PATCH_KEY = 'isobels_web_level_patch_v1';

export function blankPatch(mapId) {
  return {
    version: PATCH_VERSION,
    mapId,
    updatedAt: new Date().toISOString(),
    graphicStrokes: [],
    addedSolids: [],
    hiddenSolidIds: []
  };
}

export function makeEditorId(prefix) {
  const tail = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${tail}`;
}

export function baseSolidId(solid, index = 0) {
  const label = String(solid.feature || solid.kind || 'solid')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `base:${index}:${label || 'solid'}`;
}

function number(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizePoint(point, artPlate) {
  if (!Array.isArray(point) || point.length < 2) return null;
  const x = Math.round(number(point[0]));
  const y = Math.round(number(point[1]));
  if (x < 0 || y < 0 || x >= artPlate.nativeWidth || y >= artPlate.nativeHeight) return null;
  return [x, y];
}

function normalizeStroke(stroke, map) {
  if (!stroke || !GRAPHIC_MODES.has(stroke.mode)) return null;
  const points = (stroke.points || []).map((point) => normalizePoint(point, map.artPlate)).filter(Boolean);
  if (!points.length) return null;
  return {
    id: typeof stroke.id === 'string' ? stroke.id : makeEditorId('stroke'),
    mode: stroke.mode,
    color: GRAPHIC_COLORS.has(stroke.color) ? stroke.color : 'ink',
    size: BRUSH_SIZES.has(number(stroke.size)) ? number(stroke.size) : 2,
    points
  };
}

function normalizeSolid(solid, map) {
  if (!solid) return null;
  const x = Math.max(0, Math.round(number(solid.x)));
  const y = Math.max(0, Math.round(number(solid.y)));
  const w = Math.max(map.artPlate.scale, Math.round(number(solid.w, map.artPlate.scale)));
  const h = Math.max(map.artPlate.scale, Math.round(number(solid.h, map.artPlate.scale)));
  if (x >= map.width || y >= map.height) return null;
  return {
    id: typeof solid.id === 'string' ? solid.id : makeEditorId('solid'),
    editorId: typeof solid.editorId === 'string' ? solid.editorId : makeEditorId('custom'),
    x,
    y,
    w: Math.min(w, map.width - x),
    h: Math.min(h, map.height - y),
    kind: 'editor',
    feature: typeof solid.feature === 'string' ? solid.feature.slice(0, 80) : 'builder platform'
  };
}

export function normalizePatch(value, map) {
  const empty = blankPatch(map.id);
  if (!value || value.mapId !== map.id || value.version !== PATCH_VERSION) return empty;
  return {
    ...empty,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : empty.updatedAt,
    graphicStrokes: (value.graphicStrokes || []).map((item) => normalizeStroke(item, map)).filter(Boolean),
    addedSolids: (value.addedSolids || []).map((item) => normalizeSolid(item, map)).filter(Boolean),
    hiddenSolidIds: [...new Set((value.hiddenSolidIds || []).filter((id) => typeof id === 'string'))]
  };
}

export function loadLevelPatch(map, storage = globalThis.localStorage) {
  try {
    return normalizePatch(JSON.parse(storage?.getItem(LEVEL_PATCH_KEY) || 'null'), map);
  } catch {
    return blankPatch(map.id);
  }
}

export function saveLevelPatch(patch, storage = globalThis.localStorage) {
  try {
    patch.updatedAt = new Date().toISOString();
    storage?.setItem(LEVEL_PATCH_KEY, JSON.stringify(patch));
    return true;
  } catch {
    return false;
  }
}

export function prepareBaseSolids(map) {
  if (!map.editorBaseSolids) {
    map.editorBaseSolids = map.solids.map((solid, index) => ({
      ...solid,
      editorId: solid.editorId || baseSolidId(solid, index),
      editorBase: true
    }));
  }
  return map.editorBaseSolids;
}

export function applyLevelPatch(map, patch) {
  const hidden = new Set(patch.hiddenSolidIds);
  const base = prepareBaseSolids(map).filter((solid) => !hidden.has(solid.editorId));
  map.solids = [...base, ...patch.addedSolids.map((solid) => ({ ...solid, editorBase: false }))];
  return map.solids;
}

export function findSolidAt(solids, point, padding = 24) {
  return solids
    .filter((solid) => point.x >= solid.x - padding && point.x <= solid.x + solid.w + padding &&
      point.y >= solid.y - padding && point.y <= solid.y + solid.h + padding)
    .sort((a, b) => (a.w * a.h) - (b.w * b.h))[0] || null;
}
