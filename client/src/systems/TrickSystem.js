import {
  SCORE_TICK_MS,
  STYLE_DECAY_PER_SECOND,
  STYLE_GRACE_MS,
  TRICKS,
  stuntTick,
  stuntTierForDuration,
  tierForStyle
} from './trickModel.js';

const REPEAT_VARIETY = 0.62;
const STATUS_MS = 1200;
const TAU = Math.PI * 2;

function wrapAngle(value) {
  return ((value + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

export default class TrickSystem {
  constructor({ onEvent } = {}) {
    this.onEvent = onEvent || (() => {});
    this.totalScore = 0;
    this.comboScore = 0;
    this.style = 0;
    this.chain = 0;
    this.active = null;
    this.lastTrickId = null;
    this.lastActionAt = -Infinity;
    this.status = '';
    this.statusUntil = 0;
  }

  get tier() {
    return tierForStyle(this.style);
  }

  update(time, delta, { airborne, speed, input }) {
    const next = airborne ? this.readTrick(input) : null;
    if (next?.id !== this.active?.def.id) {
      this.finishActive(time);
      if (next) this.start(next, time);
    }

    if (this.active) this.scoreActive(time, speed);
    if (!this.active && time - this.lastActionAt > STYLE_GRACE_MS && this.style > 0) {
      this.style = Math.max(0, this.style - STYLE_DECAY_PER_SECOND * delta / 1000);
      if (this.style === 0) {
        this.chain = 0;
        this.comboScore = 0;
        this.lastTrickId = null;
      }
    }
  }

  readTrick(input = {}) {
    if (input.twist) return TRICKS.twist;
    if (input.star) return TRICKS.star;
    if (input.curl) return TRICKS.curl;
    return null;
  }

  start(def, time) {
    const variety = this.lastTrickId === def.id ? REPEAT_VARIETY : 1;
    this.active = { def, startedAt: time, lastTickAt: time, points: 0, variety };
    this.status = variety < 1 ? `${def.label} / REPEAT` : def.label;
    this.statusUntil = Infinity;
  }

  scoreActive(time, speed) {
    let safety = 0;
    while (time - this.active.lastTickAt >= SCORE_TICK_MS && safety < 8) {
      this.active.lastTickAt += SCORE_TICK_MS;
      const elapsedMs = this.active.lastTickAt - this.active.startedAt;
      const gain = stuntTick({
        elapsedMs,
        speed,
        multiplier: this.tier.multiplier,
        variety: this.active.variety
      });
      this.add(gain.points, gain.style, this.active.lastTickAt);
      this.active.points += gain.points;
      safety += 1;
    }
  }

  finishActive(time) {
    const stunt = this.active;
    if (!stunt) return;
    this.active = null;
    this.statusUntil = time + STATUS_MS;
    if (stunt.points <= 0) return;

    this.chain += 1;
    this.lastTrickId = stunt.def.id;
    const durationMs = time - stunt.startedAt;
    this.status = `${stunt.def.label} ${this.formatDuration(durationMs)}`;
    this.onEvent({ label: stunt.def.label, points: stunt.points, durationMs });
  }

  reward(id, label, basePoints, styleGain, time) {
    const repeated = this.lastTrickId === id;
    const variety = repeated ? REPEAT_VARIETY : 1;
    const points = Math.max(1, Math.round(basePoints * this.tier.multiplier * variety));
    this.add(points, styleGain * variety, time);
    this.chain += 1;
    this.lastTrickId = id;
    this.status = repeated ? `${label} / REPEAT` : label;
    this.statusUntil = time + STATUS_MS;
    this.onEvent({ label, points, repeated });
    return points;
  }

  land(time, speed) {
    this.finishActive(time);
    if (this.comboScore <= 0) return;
    this.reward('landing', 'SILK LANDING', 12 + Math.min(24, speed * 1.5), 5, time);
  }

  bail(time) {
    this.active = null;
    this.style = 0;
    this.comboScore = 0;
    this.chain = 0;
    this.lastTrickId = null;
    this.lastActionAt = time;
    this.status = 'THREAD LOST';
    this.statusUntil = time + STATUS_MS;
    this.onEvent({ label: 'THREAD LOST', points: 0, bailed: true });
  }

  add(points, style, time) {
    this.totalScore += points;
    this.comboScore += points;
    this.style = Math.min(100, this.style + style);
    this.lastActionAt = time;
  }

  animation(time, facing = 1) {
    if (!this.active) return { rotation: 0, scale: 1 };
    const elapsed = time - this.active.startedAt;
    if (this.active.def.id === 'twist') {
      return { rotation: wrapAngle(elapsed * 0.009 * facing), scale: 0.98 };
    }
    if (this.active.def.id === 'star') {
      return { rotation: Math.sin(elapsed / 150) * 0.16, scale: 1.08 };
    }
    return { rotation: Math.sin(elapsed / 120) * 0.2, scale: 0.94 + Math.sin(elapsed / 90) * 0.03 };
  }

  snapshot(time) {
    const tier = this.tier;
    const activeDurationMs = this.active ? time - this.active.startedAt : 0;
    const stuntTier = this.active ? stuntTierForDuration(activeDurationMs) : null;
    return {
      totalScore: this.totalScore,
      comboScore: this.comboScore,
      style: this.style,
      chain: this.chain,
      tier,
      multiplier: tier.multiplier * (stuntTier?.multiplier || 1),
      stuntTier,
      active: this.active ? this.active.def.label : null,
      activeDuration: this.formatDuration(activeDurationMs),
      status: time < this.statusUntil ? this.status : ''
    };
  }

  formatDuration(durationMs) {
    return `${(Math.max(0, durationMs) / 1000).toFixed(1)}s`;
  }
}
