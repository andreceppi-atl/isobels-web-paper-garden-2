import { loadMap } from '../shared/level.js';

const world = loadMap('overworld');
const scale = world.artRegistration.worldScale;
const results = [];
const check = (label, value) => results.push(`${value ? 'PASS' : 'FAIL'}  ${label}`);
const intersects = (a, b) => (
  a.x <= b.x + b.w && b.x <= a.x + a.w &&
  a.y <= b.y + b.h && b.y <= a.y + a.h
);

const tree = world.solids.filter(({ structure }) => structure === 'sakura-tree');
const trunk = tree.filter(({ collisionRole }) => collisionRole === 'trunk').sort((a, b) => a.y - b.y);
const firstY = trunk[0].y;
const sealed = Array.from({ length: world.groundY - firstY }, (_, offset) => firstY + offset)
  .every((y) => trunk.some((solid) => y >= solid.y && y <= solid.y + solid.h));
check('the central trunk has no vertical pixel-sized fall-through seam', sealed);

const fineSides = trunk.slice(1).every((solid, index) => {
  const previous = trunk[index];
  const leftStep = Math.abs(solid.x - previous.x);
  const rightStep = Math.abs((solid.x + solid.w) - (previous.x + previous.w));
  return leftStep <= 5 * scale && rightStep <= 5 * scale;
});
check('adjacent trunk slices change by no more than five art pixels per side', fineSides);

const limb = tree.filter(({ collisionRole }) => collisionRole === 'limb');
check('every diagonal limb piece overlaps another tangible tree piece', limb.every((solid) => (
  tree.some((other) => other !== solid && intersects(solid, other))
)));

const budBases = tree.filter(({ kind, feature }) => kind === 'bud' && feature.endsWith('/ base'));
const branchSurfaces = tree.filter(({ kind }) => kind === 'branch');
check('every blossom base overlaps its painted branch surface', budBases.every((bud) => (
  branchSurfaces.some((branch) => intersects(bud, branch))
)));

const house = Object.fromEntries(tree.filter(({ kind }) => kind === 'house').map((solid) => [solid.feature, solid]));
const westPost = house['treehouse west doorpost'];
const eastPost = house['treehouse east doorpost'];
const doorwayWidth = eastPost.x - (westPost.x + westPost.w);
check('the treehouse doorway stays wider than the spider', doorwayWidth > 28);
check('the house threshold overlaps the sealed crown floor', tree.some(({ feature, ...solid }) => (
  feature === 'treehouse porch / crown floor' && intersects(house['treehouse threshold'], solid)
)));

console.log(results.join('\n'));
console.log(`\n${results.filter((result) => result.startsWith('PASS')).length}/${results.length} passed`);
process.exit(results.some((result) => result.startsWith('FAIL')) ? 1 : 0);
