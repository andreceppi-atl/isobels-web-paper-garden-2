export const SCORE_TICK_MS = 250;
export const STYLE_GRACE_MS = 1800;
export const STYLE_DECAY_PER_SECOND = 18;

export const TRICKS = {
  curl: { id: 'curl', label: 'CURL', pose: 'tuck', key: 'Q' },
  star: { id: 'star', label: 'STAR', pose: 'star', key: 'X' },
  twist: { id: 'twist', label: 'TWIST', pose: 'twist', key: 'Z' }
};

export const COMBO_TIERS = [
  { rank: 'D', label: 'DANGLING', threshold: 0, multiplier: 1 },
  { rank: 'C', label: 'CURIOUS', threshold: 20, multiplier: 1.25 },
  { rank: 'B', label: 'BRAIDED', threshold: 42, multiplier: 1.5 },
  { rank: 'A', label: 'ARACHNID', threshold: 68, multiplier: 2 },
  { rank: 'S', label: 'SILKEN!', threshold: 90, multiplier: 3 }
];

export const STUNT_TIERS = [
  { label: 'QUICK', threshold: 0, multiplier: 1 },
  { label: 'HELD', threshold: 1000, multiplier: 1.2 },
  { label: 'LONG', threshold: 2500, multiplier: 1.5 },
  { label: 'ENDLESS', threshold: 4500, multiplier: 2 }
];

export function tierForStyle(style) {
  let tier = COMBO_TIERS[0];
  for (const candidate of COMBO_TIERS) {
    if (style < candidate.threshold) break;
    tier = candidate;
  }
  return tier;
}

export function stuntTierForDuration(durationMs) {
  let tier = STUNT_TIERS[0];
  for (const candidate of STUNT_TIERS) {
    if (durationMs < candidate.threshold) break;
    tier = candidate;
  }
  return tier;
}

export function stuntTick({ elapsedMs, speed, multiplier, variety = 1 }) {
  const heldSeconds = Math.max(0, elapsedMs) / 1000;
  const stuntTier = stuntTierForDuration(elapsedMs);
  const durationLift = 1 + Math.min(2, heldSeconds / 3) * 0.65;
  const motionLift = 10 + Math.min(14, Math.max(0, speed) * 1.4);
  const points = Math.max(1, Math.round(motionLift * durationLift * multiplier * stuntTier.multiplier * variety));
  const style = (2.2 + Math.min(2.8, heldSeconds * 0.5)) * variety;
  return { points, style };
}

export function projectedStuntScore(durationMs, speed, multiplier = 1, variety = 1) {
  let points = 0;
  for (let elapsed = SCORE_TICK_MS; elapsed <= durationMs; elapsed += SCORE_TICK_MS) {
    points += stuntTick({ elapsedMs: elapsed, speed, multiplier, variety }).points;
  }
  return points;
}
