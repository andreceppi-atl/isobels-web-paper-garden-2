// Map registry. The client builds the world from the active map and the server
// validates against the same data, so they always agree on where things are.
import canopy from './maps/canopy.js';
import gaps from './maps/gaps.js';
import longGarden from './maps/longGarden.js';

export const MAPS = { 'long-garden': longGarden, canopy, gaps };
export const DEFAULT_MAP_ID = 'long-garden';

export function loadMap(id) {
  const map = MAPS[id] || MAPS[DEFAULT_MAP_ID];
  return { anchors: [], ...map };
}
