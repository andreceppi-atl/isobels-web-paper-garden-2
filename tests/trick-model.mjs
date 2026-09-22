import assert from 'node:assert/strict';
import { projectedStuntScore, stuntTick, stuntTierForDuration, tierForStyle } from '../client/src/systems/trickModel.js';
import TrickSystem from '../client/src/systems/TrickSystem.js';

const checks = [];
function check(label, fn) {
  try { fn(); checks.push(`PASS  ${label}`); }
  catch (error) { checks.push(`FAIL  ${label}: ${error.message}`); }
}

check('style thresholds climb from D through S', () => {
  assert.equal(tierForStyle(0).rank, 'D');
  assert.equal(tierForStyle(20).rank, 'C');
  assert.equal(tierForStyle(42).rank, 'B');
  assert.equal(tierForStyle(68).rank, 'A');
  assert.equal(tierForStyle(90).rank, 'S');
});

check('holding a stunt longer earns more points', () => {
  assert.ok(projectedStuntScore(3000, 8) > projectedStuntScore(1000, 8));
});

check('longer stunt tiers raise the live multiplier', () => {
  assert.equal(stuntTierForDuration(999).label, 'QUICK');
  assert.equal(stuntTierForDuration(1000).multiplier, 1.2);
  assert.equal(stuntTierForDuration(2500).multiplier, 1.5);
  assert.equal(stuntTierForDuration(4500).multiplier, 2);
});

check('speed and style multiplier both raise a stunt score', () => {
  const base = projectedStuntScore(2000, 2, 1);
  assert.ok(projectedStuntScore(2000, 10, 1) > base);
  assert.ok(projectedStuntScore(2000, 2, 2) > base);
});

check('repeating one stunt earns less style than mixing moves', () => {
  const fresh = stuntTick({ elapsedMs: 1000, speed: 6, multiplier: 1, variety: 1 });
  const repeat = stuntTick({ elapsedMs: 1000, speed: 6, multiplier: 1, variety: 0.62 });
  assert.ok(repeat.points < fresh.points);
  assert.ok(repeat.style < fresh.style);
});

check('a held stunt climbs tiers, scores live, and completes into the chain', () => {
  const events = [];
  const tricks = new TrickSystem({ onEvent: (event) => events.push(event) });
  tricks.update(0, 16, { airborne: true, speed: 8, input: { curl: true } });
  for (let time = 250; time <= 3000; time += 250) {
    tricks.update(time, 250, { airborne: true, speed: 8, input: { curl: true } });
  }
  const live = tricks.snapshot(3000);
  assert.equal(live.stuntTier.label, 'LONG');
  assert.ok(live.totalScore > 0);
  assert.ok(live.multiplier > live.tier.multiplier);
  tricks.update(3100, 100, { airborne: true, speed: 8, input: {} });
  assert.equal(tricks.snapshot(3100).chain, 1);
  assert.equal(events[0].label, 'CURL');
});

console.log(checks.join('\n'));
if (checks.some((line) => line.startsWith('FAIL'))) process.exit(1);
