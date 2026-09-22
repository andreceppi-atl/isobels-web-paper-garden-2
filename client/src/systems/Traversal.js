import { MOVEMENT, canConsumeJump, cutJumpVelocity, frameScale, moveToward, tangentForce } from './movementModel.js';

const GROUND_NORMAL = -0.55;

export default class Traversal {
  constructor(scene) {
    this.scene = scene;
    this.graceUntil = -Infinity;
    this.queuedUntil = -Infinity;
    this.wasJumpDown = false;
    this.skipNextJumpCut = false;
  }

  clearJumpQueue() {
    this.queuedUntil = -Infinity;
  }

  consumeJumpInput() {
    this.clearJumpQueue();
    this.wasJumpDown = true;
  }

  preserveReleaseMomentum() {
    this.skipNextJumpCut = true;
  }

  update(time, delta, input, contacts) {
    const spider = this.scene.spider;
    const body = spider.body;
    const crawl = this.scene.crawl;
    const scale = frameScale(delta);

    if (!crawl.active) spider.grounded = contacts.some((contact) => contact.ny < GROUND_NORMAL);
    if (spider.grounded) this.graceUntil = time + MOVEMENT.coyoteMs;
    this.captureJump(time, input.jump, spider.webConstraint || crawl.active);

    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (direction) spider.facing = direction;

    if (crawl.active) crawl.update(delta, input);
    else if (spider.webConstraint) this.updateSwing(direction, input, scale);
    else if (this.tryJump(time)) this.updateAir(direction, scale);
    else if (spider.grounded) this.updateGround(direction, scale);
    else this.updateAir(direction, scale);

    if (!crawl.active && !spider.webConstraint) crawl.tryAttach(contacts, input, body.velocity);
    return this.snapshot();
  }

  captureJump(time, jumpDown, movementOwnsSpace) {
    if (jumpDown && !this.wasJumpDown && !movementOwnsSpace) {
      this.queuedUntil = time + MOVEMENT.jumpBufferMs;
    }
    if (!jumpDown && this.wasJumpDown) this.releaseJump();
    this.wasJumpDown = jumpDown;
  }

  tryJump(time) {
    const spider = this.scene.spider;
    if (!canConsumeJump(time, spider.grounded, this.graceUntil, this.queuedUntil)) return false;
    this.scene.matter.body.setVelocity(spider.body, {
      x: spider.body.velocity.x,
      y: MOVEMENT.jumpVelocity
    });
    spider.grounded = false;
    this.graceUntil = -Infinity;
    this.queuedUntil = -Infinity;
    return true;
  }

  releaseJump() {
    const spider = this.scene.spider;
    if (this.skipNextJumpCut) {
      this.skipNextJumpCut = false;
      return;
    }
    if (spider.webConstraint || this.scene.crawl.active) return;
    const velocity = spider.body.velocity;
    const nextY = cutJumpVelocity(velocity.y);
    if (nextY !== velocity.y) this.scene.matter.body.setVelocity(spider.body, { x: velocity.x, y: nextY });
  }

  updateGround(direction, scale) {
    const body = this.scene.spider.body;
    const target = direction * MOVEMENT.runSpeed;
    const rate = direction ? MOVEMENT.runAcceleration : MOVEMENT.runDeceleration;
    const x = moveToward(body.velocity.x, target, rate * scale);
    this.scene.matter.body.setVelocity(body, { x, y: body.velocity.y });
  }

  updateAir(direction, scale) {
    if (direction) this.scene.spider.steer(direction * MOVEMENT.airForce * scale);
  }

  updateSwing(direction, input, scale) {
    const spider = this.scene.spider;
    if (direction) {
      spider.steer(direction * MOVEMENT.swingSteerForce * scale);
      if (!spider.slack && spider.currentAnchor) {
        const force = tangentForce(spider.currentAnchor, spider.body.position, direction, MOVEMENT.swingPumpForce * scale);
        this.scene.matter.body.applyForce(spider.body, spider.body.position, force);
      }
    }
    if (input.up) spider.reel(-MOVEMENT.reelPerFrame * scale);
    if (input.down) spider.reel(MOVEMENT.reelPerFrame * scale);
  }

  snapshot() {
    const spider = this.scene.spider;
    return {
      onGround: spider.grounded,
      swinging: !!spider.webConstraint,
      state: this.scene.crawl.active
        ? this.scene.crawl.kind === 'strand' ? 'on a thread' : 'clinging'
        : spider.webConstraint ? spider.slack ? 'swinging · slack' : 'swinging · taut'
        : spider.grounded ? 'grounded' : 'airborne'
    };
  }
}
