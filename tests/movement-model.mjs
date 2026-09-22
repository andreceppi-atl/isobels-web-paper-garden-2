import assert from 'node:assert/strict';
import { MOVEMENT, canConsumeJump, cutJumpVelocity, frameScale, moveToward, tangentForce } from '../client/src/systems/movementModel.js';

const checks = [];
function check(label, fn) {
  try { fn(); checks.push(`PASS  ${label}`); }
  catch (error) { checks.push(`FAIL  ${label}: ${error.message}`); }
}

check('run acceleration approaches its target without overshooting', () => {
  assert.equal(moveToward(4.5, MOVEMENT.runSpeed, 1), MOVEMENT.runSpeed);
  assert.equal(moveToward(-2, 2, 0.5), -1.5);
});

check('frame scaling is stable and clamps long frames', () => {
  assert.ok(Math.abs(frameScale(1000 / 60) - 1) < 0.001);
  assert.equal(frameScale(100), 2);
});

check('coyote time accepts a queued jump just after leaving ground', () => {
  assert.equal(canConsumeJump(1080, false, 1100, 1200), true);
  assert.equal(canConsumeJump(1120, false, 1100, 1200), false);
});

check('jump buffering accepts a press just before landing', () => {
  assert.equal(canConsumeJump(1080, true, 0, 1100), true);
  assert.equal(canConsumeJump(1120, true, 0, 1100), false);
});

check('early release shortens ascent without reversing it', () => {
  const cut = cutJumpVelocity(-10);
  assert.ok(cut < 0 && Math.abs(cut) < 10);
  assert.equal(cutJumpVelocity(-2), -2);
});

check('swing pump follows the rope tangent toward input', () => {
  const force = tangentForce({ x: 0, y: 0 }, { x: 0, y: 10 }, 1, 0.5);
  assert.ok(force.x > 0);
  assert.ok(Math.abs(Math.hypot(force.x, force.y) - 0.5) < 0.001);
});

console.log(checks.join('\n'));
if (checks.some((line) => line.startsWith('FAIL'))) process.exit(1);
