export const MOVEMENT = Object.freeze({
  frameMs: 1000 / 60,
  runSpeed: 4.8,
  runAcceleration: 0.78,
  runDeceleration: 0.68,
  jumpVelocity: -11.2,
  coyoteMs: 110,
  jumpBufferMs: 130,
  jumpCutMultiplier: 0.52,
  jumpCutThreshold: -3.4,
  airForce: 0.00042,
  swingSteerForce: 0.00048,
  swingPumpForce: 0.00072,
  reelPerFrame: 5.5
});

export function frameScale(delta) {
  return Math.min(2, Math.max(0.25, delta / MOVEMENT.frameMs));
}

export function moveToward(value, target, amount) {
  if (value < target) return Math.min(target, value + amount);
  if (value > target) return Math.max(target, value - amount);
  return target;
}

export function canConsumeJump(now, grounded, graceUntil, queuedUntil) {
  return now <= queuedUntil && (grounded || now <= graceUntil);
}

export function cutJumpVelocity(verticalVelocity) {
  if (verticalVelocity >= MOVEMENT.jumpCutThreshold) return verticalVelocity;
  return verticalVelocity * MOVEMENT.jumpCutMultiplier;
}

export function tangentForce(anchor, position, direction, strength) {
  const dx = position.x - anchor.x;
  const dy = position.y - anchor.y;
  const length = Math.hypot(dx, dy) || 1;
  const tangent = { x: -dy / length, y: dx / length };
  const orientation = tangent.x * direction < 0 ? -1 : 1;
  return { x: tangent.x * orientation * strength, y: tangent.y * orientation * strength };
}
