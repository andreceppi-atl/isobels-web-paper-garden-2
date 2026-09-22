import { loadMap } from '../../shared/level.js';

// The world's map. Dev builds can load another one with ?map=gaps (the original
// practice level, used to regression-test the swing feel).
const override = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('map') : null;
export const MAP = loadMap(override);
