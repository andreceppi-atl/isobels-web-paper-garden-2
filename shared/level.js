// Map registry. The client builds the world from the active map and the server
// validates against the same data, so they always agree on where things are.
import canopy from './maps/canopy.js';
import gaps from './maps/gaps.js';
import longGarden from './maps/longGarden.js';
import overworld from './maps/overworld.js';

export const MAPS = { overworld, 'long-garden': longGarden, canopy, gaps };
export const DEFAULT_MAP_ID = 'overworld';

export function resolveMapId(id) {
  return typeof id === 'string' && Object.hasOwn(MAPS, id) ? id : DEFAULT_MAP_ID;
}

export function loadMap(id) {
  const map = MAPS[resolveMapId(id)];
  return { anchors: [], ...map };
}
