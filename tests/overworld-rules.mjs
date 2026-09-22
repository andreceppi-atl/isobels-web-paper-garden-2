import { DEFAULT_MAP_ID, loadMap } from '../shared/level.js';
import { buildNest, buildStockStrands } from '../shared/worldWebs.js';

const original = loadMap('long-garden');
const world = loadMap();
const results = [];
const check = (label, value) => results.push(`${value ? 'PASS' : 'FAIL'}  ${label}`);

check('the Overworld is the default public map', DEFAULT_MAP_ID === 'overworld' && world.id === 'overworld');
check('the Overworld is at least three times wider than the original playground', world.width >= original.width * 3);
check('the Overworld is at least three times taller than the original playground', world.height >= original.height * 3);
check('the Overworld is one continuous three-region level', world.regions.length === 3 && world.rooms.length === 3);
check('the three regions are Snowfield, Blossom Crown, and Live Web', world.regions.map(({ id }) => id).join(',') === 'snowfield,blossom-crown,live-web');
check('the regions touch without loading gaps', world.regions.every((region, index) => index === 0 || world.regions[index - 1].x + world.regions[index - 1].w === region.x));
check('the Microblog Ravine is a landmark inside the Live Web', world.waypoints.some(({ id, x }) => id === 'microblog-ravine' && x >= world.regions[2].x));
check('Isobel lives at the central cherry tree', world.humanoids.some(({ id, x }) => id === 'isobel' && x > world.regions[1].x && x < world.regions[1].x + world.regions[1].w));
check('the world includes at least six natural billboard frames', world.billboards.length >= 6);
check('the world offers more home webs than the 50-player room limit', world.nestSlots.length > 50);
check('all home webs build into in-bounds traversable geometry', world.nestSlots.every((_, slot) => {
  const nest = buildNest(world, { slot, name: `Spider ${slot}`, color: 'sky' });
  return nest && nest.strands.length >= 28 && nest.strands.every((strand) => (
    strand.x1 >= 0 && strand.x1 <= world.width && strand.x2 >= 0 && strand.x2 <= world.width &&
    strand.y1 >= 0 && strand.y1 <= world.height && strand.y2 >= 0 && strand.y2 <= world.height
  ));
}));
check('old webs populate all three regions', world.regions.every((region) => world.staticWebs.some(({ x }) => x >= region.x && x < region.x + region.w)));
check('stock web geometry is substantial', buildStockStrands(world).length >= 800);
check('all traversal anchors stay in world bounds', world.anchors.every(({ x, y }) => x >= 0 && x <= world.width && y >= 0 && y <= world.height));

console.log(results.join('\n'));
console.log(`\n${results.filter((result) => result.startsWith('PASS')).length}/${results.length} passed`);
process.exit(results.some((result) => result.startsWith('FAIL')) ? 1 : 0);
