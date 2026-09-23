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
const artScale = world.artRegistration?.worldScale;
check('every visible ledge is registered from a literal pixel-art top edge', artScale === 5 && world.solids.filter(({ kind }) => kind !== 'floor').every((solid) => {
  const region = world.regions.find(({ id }) => id === solid.region);
  return solid.artPixel && solid.x - region.x === solid.artPixel.x * artScale &&
    solid.y === solid.artPixel.y * artScale && solid.w === solid.artPixel.w * artScale;
}));
check('each painted regional ground uses its measured pixel-art surface', world.solids.filter(({ kind, hidden }) => kind === 'floor' && !hidden).every((solid) => (
  solid.artPixel && solid.y === solid.artPixel.y * artScale && solid.w === solid.artPixel.w * artScale
)));
check('every billboard content box is registered to its painted sign frame', world.billboards.every((board) => {
  const region = world.regions.find(({ id }) => id === board.region);
  return board.artPixel && board.x - region.x === board.artPixel.x * artScale &&
    board.y === board.artPixel.y * artScale && board.w === board.artPixel.w * artScale &&
    board.h === board.artPixel.h * artScale;
}));
const trunk = world.solids.filter(({ kind }) => kind === 'trunk').sort((a, b) => a.y - b.y);
const trunkCore = trunk.filter(({ collisionRole }) => collisionRole === 'trunk');
check('the central tree trunk is a sealed fine-grain contour down to the painted floor', trunkCore.length >= 20 &&
  trunkCore.every((segment, index) => index === 0 || segment.y <= trunkCore[index - 1].y + trunkCore[index - 1].h) &&
  trunkCore.at(-1).y + trunkCore.at(-1).h === world.groundY);
check('the painted diagonal limbs and roots have tangible overlapping contours', trunk.some(({ collisionRole }) => collisionRole === 'limb') &&
  trunk.filter(({ collisionRole }) => collisionRole === 'limb').length >= 30);
check('branch blossom buds are tangible instead of decorative-only', world.solids.filter(({ kind }) => kind === 'bud').length >= 20);
check('the treehouse has a roof, walls, open doorway posts, and threshold', world.solids.filter(({ kind }) => kind === 'house').length >= 8 &&
  world.solids.some(({ feature }) => feature === 'treehouse threshold'));
check('the treehouse crown floor is one sealed platform', world.solids.some(({ feature, w }) => feature === 'treehouse porch / crown floor' && w >= 300 * artScale));
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
