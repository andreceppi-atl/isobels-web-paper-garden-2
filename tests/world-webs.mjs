import { loadMap } from '../shared/level.js';
import { buildNest, buildNests, buildPermanentStrands, buildStockStrands } from '../shared/worldWebs.js';

const map = loadMap('long-garden');
const results = [];
const check = (label, value) => results.push(`${value ? 'PASS' : 'FAIL'}  ${label}`);

check('Long Garden is 24,000px wide', map.width === 24000);
check('Long Garden exposes 60 home slots', map.nestSlots.length === 60);

const records = map.nestSlots.slice(0, 3).map((_, slot) => ({ slot, name: `Spider ${slot}`, color: slot === 1 ? 'sky' : 'silk' }));
const nests = buildNests(map, records);
check('every assigned record produces a nest', nests.length === records.length);
check('a nest uses its thread color', nests[1].strands.every((strand) => strand.color === 'sky'));
check('nest spawn is inside its web', Math.hypot(nests[0].spawn.x - nests[0].x, nests[0].spawn.y - nests[0].y) < nests[0].radius);
check('nest strands are permanent and traversable geometry', nests.every((nest) => nest.strands.length >= 28 && nest.strands.every((strand) => strand.permanent)));

const stock = buildStockStrands(map);
check('the world includes an old web in every district', stock.length >= map.rooms.length * 28);

const all = buildPermanentStrands(map, records);
const ids = new Set(all.map((strand) => strand.id));
check('permanent strand ids are unique', ids.size === all.length);
check('all permanent web coordinates stay in world bounds', all.every((strand) => (
  strand.x1 >= 0 && strand.x1 <= map.width && strand.x2 >= 0 && strand.x2 <= map.width &&
  strand.y1 >= 0 && strand.y1 <= map.height && strand.y2 >= 0 && strand.y2 <= map.height
)));
check('invalid nest slots do not generate geometry', buildNest(map, { slot: 999, color: 'silk' }) === null);

console.log(results.join('\n'));
console.log(`\n${results.filter((result) => result.startsWith('PASS')).length}/${results.length} passed`);
process.exit(results.some((result) => result.startsWith('FAIL')) ? 1 : 0);
