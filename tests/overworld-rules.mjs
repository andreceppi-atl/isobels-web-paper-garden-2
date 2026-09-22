import { DEFAULT_MAP_ID, loadMap } from '../shared/level.js';
import { buildNest, buildStockStrands } from '../shared/worldWebs.js';

const original = loadMap('canopy');
const world = loadMap();
const results = [];
const check = (label, value) => results.push(`${value ? 'PASS' : 'FAIL'}  ${label}`);

check('the Overworld is the default public map', DEFAULT_MAP_ID === 'overworld' && world.id === 'overworld');
check('the Overworld is at least three times wider than the original physics playground', world.width >= original.width * 3);
check('the rebuilt world uses a shallow, legible side-scroller frame', world.height >= 2400 && world.height <= 3200 && world.width / world.height >= 5);
check('the Overworld is one continuous three-region level', world.regions.length === 3 && world.rooms.length === 3);
check('the three regions are Snowfield, Blossom Crown, and Live Web', world.regions.map(({ id }) => id).join(',') === 'snowfield,blossom-crown,live-web');
check('the regions touch without loading gaps', world.regions.every((region, index) => index === 0 || world.regions[index - 1].x + world.regions[index - 1].w === region.x));
check('the raster plate is gone and the world is a versioned procedural scaffold', !world.artPlate && world.scaffoldVersion === 2 && !!world.seed);
check('the builder grid maps exactly onto the procedural world', world.editorGrid?.scale === 8 && world.width === world.editorGrid.nativeWidth * world.editorGrid.scale && world.height === world.editorGrid.nativeHeight * world.editorGrid.scale);
check('the three pixel-art plates align one-to-one with the three world regions', world.environmentPlates.length === 3 && world.environmentPlates.every((plate, index) => plate.x === world.regions[index].x && plate.w === world.regions[index].w));
check('every generated collision ledge names its visible feature', world.solids.length >= 45 && world.solids.every(({ id, feature }) => id && feature));
check('the scaffold has distinct tangible palettes for snow, tree, page, and cards', ['snow', 'branch', 'trunk', 'page', 'card'].every((kind) => world.solids.some((solid) => solid.kind === kind)));
check('the floor is inside the camera world instead of below it', world.groundY > world.height * 0.72 && world.groundY < world.height - 300);
check('procedural traversal paths cover all three sections', world.navigationPaths.length === 3 && world.navigationPaths.every((path, index) => path.every(([x, y]) => x >= world.regions[index].x && x <= world.regions[index].x + world.regions[index].w && y > 0 && y < world.groundY)));
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
check('stock web geometry is substantial without burying the scaffold', buildStockStrands(world).length >= 600);
check('all traversal anchors stay in world bounds', world.anchors.every(({ x, y }) => x >= 0 && x <= world.width && y >= 0 && y <= world.height));

console.log(results.join('\n'));
console.log(`\n${results.filter((result) => result.startsWith('PASS')).length}/${results.length} passed`);
process.exit(results.some((result) => result.startsWith('FAIL')) ? 1 : 0);
