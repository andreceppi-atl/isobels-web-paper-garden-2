import { loadMap } from '../shared/level.js';
import {
  applyLevelPatch,
  baseSolidId,
  blankPatch,
  findSolidAt,
  normalizePatch
} from '../client/src/editor/levelPatch.js';

const map = structuredClone(loadMap('overworld'));
const results = [];
const check = (label, value) => results.push(`${value ? 'PASS' : 'FAIL'}  ${label}`);

const empty = blankPatch(map.id);
check('a new draft starts empty and map-scoped', empty.mapId === map.id && empty.graphicStrokes.length === 0);

const hiddenId = baseSolidId(map.solids[1], 1);
const candidate = {
  version: 1,
  mapId: map.id,
  graphicStrokes: [
    { id: 'good-stroke', mode: 'paint', color: 'petal', size: 4, points: [[10, 20], [11, 21]] },
    { id: 'bad-stroke', mode: 'spray', color: 'ink', size: 2, points: [[10, 20]] }
  ],
  addedSolids: [
    { id: 'solid:one', editorId: 'solid:one', x: 800, y: 900, w: 240, h: 32, feature: 'test bridge' }
  ],
  hiddenSolidIds: [hiddenId, hiddenId]
};
const patch = normalizePatch(candidate, map);
check('graphic strokes are validated in native art pixels', patch.graphicStrokes.length === 1 && patch.graphicStrokes[0].points[1][0] === 11);
check('hidden collision ids are deduplicated', patch.hiddenSolidIds.length === 1);
check('custom collision is normalized as editor geometry', patch.addedSolids[0].kind === 'editor' && patch.addedSolids[0].w === 240);

const originalCount = map.solids.length;
applyLevelPatch(map, patch);
check('a stock tangible feature can be deleted by patch', !map.solids.some(({ editorId }) => editorId === hiddenId));
check('a custom tangible feature is added to runtime collision', map.solids.some(({ editorId }) => editorId === 'solid:one'));
check('patching removes one base and adds one custom solid', map.solids.length === originalCount);

const hit = findSolidAt(map.solids, { x: 900, y: 900 });
check('delete hit-testing prefers the smallest overlapping feature', hit?.editorId === 'solid:one');
check('a patch for another map is rejected', normalizePatch({ ...candidate, mapId: 'canopy' }, map).addedSolids.length === 0);

console.log(results.join('\n'));
console.log(`\n${results.filter((result) => result.startsWith('PASS')).length}/${results.length} passed`);
process.exit(results.some((result) => result.startsWith('FAIL')) ? 1 : 0);
