const rect = (x, y, w, h, kind, feature, collisionRole) => ({
  x, y, w, h, kind, feature, collisionRole,
  structure: 'sakura-tree',
  anchorable: false
});

// Control points follow the left/right bark silhouette. Five-pixel steps keep
// each world-space edge within the spider's diameter, while the two-pixel overlap
// seals every physics seam.
const trunkProfile = [
  [136, 490, 635], [154, 500, 630], [172, 510, 625], [190, 518, 622],
  [218, 514, 622], [246, 508, 624], [276, 502, 628], [310, 496, 630],
  [350, 502, 626], [390, 502, 628], [420, 492, 636], [450, 478, 650],
  [480, 455, 675], [514, 430, 700]
];

function profileAt(y) {
  const upperIndex = trunkProfile.findIndex(([pointY]) => pointY >= y);
  if (upperIndex <= 0) return trunkProfile[Math.max(0, upperIndex)].slice(1);
  const [y2, left2, right2] = trunkProfile[upperIndex];
  const [y1, left1, right1] = trunkProfile[upperIndex - 1];
  const t = (y - y1) / (y2 - y1);
  return [
    Math.round(left1 + (left2 - left1) * t),
    Math.round(right1 + (right2 - right1) * t)
  ];
}

const trunkBands = Array.from({ length: Math.ceil((514 - 136) / 5) }, (_, index) => {
  const y = 136 + index * 5;
  const h = Math.min(7, 514 - y);
  const [left, right] = profileAt(Math.min(514, y + h / 2));
  return rect(
    left, y, right - left, h, 'trunk',
    `central trunk contour ${String(index + 1).padStart(2, '0')}`, 'trunk'
  );
});

const limbRuns = [
  // Upper-left bough: lantern limb back into the crown.
  [304, 202, 64, 18], [356, 187, 62, 18], [406, 171, 62, 19], [456, 154, 62, 20],
  // Upper-right bough: crown out to the canopy post.
  [608, 153, 58, 20], [654, 168, 61, 18], [703, 183, 64, 19], [755, 199, 86, 21],
  // West climbing limb: lower branch to the lantern limb.
  [150, 314, 54, 20], [180, 296, 52, 21], [207, 277, 50, 22],
  [232, 257, 48, 23], [252, 236, 47, 24], [270, 216, 48, 23],
  // West edge root rising into the first branch.
  [0, 383, 62, 22], [48, 365, 60, 21], [96, 347, 61, 21], [145, 329, 58, 21],
  // East middle bough flowing down into the poster shelf.
  [744, 291, 46, 20], [776, 306, 50, 22], [811, 323, 45, 21],
  // East outer limb descending from the canopy post.
  [926, 214, 44, 22], [950, 231, 44, 23], [970, 251, 43, 24],
  [988, 271, 36, 25], [1000, 292, 24, 28], [1007, 317, 17, 30], [1013, 344, 11, 47],
  // Visible roots spreading into the painted ground.
  [434, 460, 70, 22], [400, 478, 65, 22], [360, 494, 58, 20], [310, 505, 65, 9],
  [620, 452, 75, 22], [675, 470, 70, 22], [730, 488, 70, 18], [785, 503, 68, 11]
].map(([x, y, w, h], index) => rect(
  x, y, w, h, 'trunk', `painted limb contour ${String(index + 1).padStart(2, '0')}`, 'limb'
));

const budCluster = (x, top, w, base, name) => {
  const fullHeight = base - top + 2;
  const upperX = Math.round(x + w * 0.22);
  const upperW = Math.round(w * 0.56);
  const lowerY = Math.round(top + fullHeight * 0.36);
  return [
    rect(upperX, top, upperW, lowerY - top + 3, 'bud', `${name} / crown`, 'bud'),
    rect(x, lowerY, w, base - lowerY + 2, 'bud', `${name} / base`, 'bud')
  ];
};

const buds = [
  [229, 184, 55, 213, 'lantern-limb blossom'],
  [852, 188, 55, 214, 'canopy-post blossom'],
  [264, 268, 39, 291, 'petal-limb blossom'],
  [385, 258, 44, 295, 'house-approach blossom'],
  [626, 266, 48, 292, 'song-branch blossom'],
  [681, 259, 50, 292, 'east-song blossom'],
  [76, 304, 38, 326, 'west-branch blossom'],
  [452, 395, 53, 423, 'root-promenade blossom'],
  [613, 401, 42, 429, 'east-root blossom'],
  [678, 392, 52, 429, 'lower-canopy blossom'],
  [878, 420, 52, 449, 'lantern-root blossom'],
  [206, 437, 34, 456, 'petal-basin blossom'],
  [426, 104, 25, 130, 'treehouse west bud'],
  [681, 102, 28, 130, 'treehouse east bud']
].flatMap((args) => budCluster(...args));

// A small enterable shell around the painted house. The center bay remains an
// open doorway; the overlapping floor meets the continuous crown platform.
const house = [
  rect(536, 68, 53, 8, 'house', 'treehouse roof ridge', 'house'),
  rect(528, 74, 69, 8, 'house', 'treehouse roof cap', 'house'),
  rect(521, 80, 83, 8, 'house', 'treehouse roof eave', 'house'),
  rect(528, 86, 8, 45, 'house', 'treehouse west wall', 'house'),
  rect(596, 86, 8, 45, 'house', 'treehouse east wall', 'house'),
  rect(548, 89, 6, 32, 'house', 'treehouse west doorpost', 'house'),
  rect(575, 89, 6, 32, 'house', 'treehouse east doorpost', 'house'),
  rect(528, 123, 76, 8, 'house', 'treehouse threshold', 'house')
];

export default [...trunkBands, ...limbRuns, ...buds, ...house];
