import assert from 'node:assert/strict';
import { TOUCH_TRICKS, nextTouchTrick, stickState } from '../client/src/ui/touchModel.js';

const checks = [];
function check(label, fn) {
  try { fn(); checks.push(`PASS  ${label}`); }
  catch (error) { checks.push(`FAIL  ${label}: ${error.message}`); }
}

check('joystick deadzone stays neutral near center', () => {
  const state = stickState(4, -3, 34);
  assert.deepEqual([state.left, state.right, state.up, state.down], [false, false, false, false]);
});

check('joystick exposes cardinal and diagonal movement', () => {
  assert.equal(stickState(-30, 0, 34).left, true);
  assert.equal(stickState(30, 0, 34).right, true);
  const diagonal = stickState(30, -30, 34);
  assert.equal(diagonal.right && diagonal.up, true);
});

check('joystick thumb position is clamped to its pad', () => {
  const state = stickState(100, 100, 34);
  assert.ok(Math.abs(Math.hypot(state.x, state.y) - 34) < 0.001);
});

check('touch trick button cycles curl, star, twist', () => {
  let index = 0;
  const order = [];
  for (let count = 0; count < 4; count += 1) {
    order.push(TOUCH_TRICKS[index]);
    index = nextTouchTrick(index);
  }
  assert.deepEqual(order, ['curl', 'star', 'twist', 'curl']);
});

console.log(checks.join('\n'));
if (checks.some((line) => line.startsWith('FAIL'))) process.exit(1);
