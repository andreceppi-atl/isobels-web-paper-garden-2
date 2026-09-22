import { loadMap, resolveMapId } from '../../shared/level.js';

// The public build defaults to the continuous Overworld. The query override is
// kept for the old physics practice maps and visual regression checks.
export const MAP_ID = resolveMapId(new URLSearchParams(window.location.search).get('map'));
export const MAP = loadMap(MAP_ID);
