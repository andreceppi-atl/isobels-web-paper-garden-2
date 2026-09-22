export const TOUCH_TRICKS = ['curl', 'star', 'twist'];

export function stickState(dx, dy, limit, deadzone = 0.28) {
  const distance = Math.hypot(dx, dy);
  const scale = distance > limit ? limit / distance : 1;
  const x = dx * scale;
  const y = dy * scale;
  const threshold = limit * deadzone;
  return {
    x,
    y,
    left: x < -threshold,
    right: x > threshold,
    up: y < -threshold,
    down: y > threshold
  };
}

export function nextTouchTrick(index) {
  return (index + 1) % TOUCH_TRICKS.length;
}
