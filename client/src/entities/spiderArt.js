import { WORLD_CSS } from '../world/worldTheme.js';

// Spider character rig, ported from the "Isobel's Web" character sheet
// (claude.ai/artifact/TuF7opBtT57beX7dtkwyhB): one blob body, 6 stubby legs,
// oversized eyes, flat-color recolor zones. Poses map directly onto our
// movement states; palettes are the cosmetic/customization layer (Phase 7).

const INK_DOT = { name: 'Ink Dot', body: WORLD_CSS.ink, shade: WORLD_CSS.inkSoft, belly: WORLD_CSS.paper, patchLeaf: WORLD_CSS.paperDeep, patchRust: WORLD_CSS.white, patchCream: WORLD_CSS.paper, leg: WORLD_CSS.ink, outline: WORLD_CSS.ink };
const GRAPHITE = { name: 'Graphite', body: WORLD_CSS.inkSoft, shade: WORLD_CSS.ink, belly: WORLD_CSS.paper, patchLeaf: WORLD_CSS.ink, patchRust: WORLD_CSS.paperDeep, patchCream: WORLD_CSS.paper, leg: WORLD_CSS.inkSoft, outline: WORLD_CSS.ink };
const NEWSPRINT = { name: 'Newsprint', body: WORLD_CSS.paperDeep, shade: WORLD_CSS.inkSoft, belly: WORLD_CSS.paper, patchLeaf: WORLD_CSS.ink, patchRust: WORLD_CSS.inkSoft, patchCream: WORLD_CSS.paper, leg: WORLD_CSS.inkSoft, outline: WORLD_CSS.ink };
const CARBON = { name: 'Carbon', body: WORLD_CSS.ink, shade: WORLD_CSS.ink, belly: WORLD_CSS.paperDeep, patchLeaf: WORLD_CSS.white, patchRust: WORLD_CSS.inkFaint, patchCream: WORLD_CSS.paper, leg: WORLD_CSS.ink, outline: WORLD_CSS.ink };

// The four current player silhouettes. Legacy palette keys stay mapped so an
// older saved session still renders; the colorful reference set is reserved
// for later NPC art rather than active players.
export const PALETTES = {
  autumn: INK_DOT,
  frost: GRAPHITE,
  berry: NEWSPRINT,
  amber: CARBON,
  midnight: INK_DOT,
  russet: GRAPHITE,
  slate: NEWSPRINT,
  clay: CARBON,
  meadow: INK_DOT
};

const PLAYER_PALETTE_KEYS = ['autumn', 'frost', 'berry', 'amber'];

export const POSES = {
  idle: {
    legsL: [{ hip: [-9, -2], foot: [-16, -8] }, { hip: [-10, 2], foot: [-17, 4] }, { hip: [-9, 6], foot: [-16, 12] }],
    tilt: 0,
    eyeStyle: 'normal',
    mouth: 'smile'
  },
  swing: {
    legsL: [{ hip: [-8, -3], foot: [-13, -11] }, { hip: [-9, 1], foot: [-14, -4] }, { hip: [-8, 5], foot: [-12, 2] }],
    tilt: -0.3,
    eyeStyle: 'wide',
    mouth: 'open'
  },
  leap: {
    legsL: [{ hip: [-9, -2], foot: [-19, -14] }, { hip: [-10, 2], foot: [-20, 3] }, { hip: [-9, 6], foot: [-18, 18] }],
    tilt: 0.08,
    eyeStyle: 'wide',
    mouth: 'open'
  },
  tuck: {
    legsL: [{ hip: [-8, -3], foot: [-11, -1] }, { hip: [-9, 1], foot: [-12, 5] }, { hip: [-8, 5], foot: [-10, 10] }],
    tilt: -0.15,
    eyeStyle: 'happy',
    mouth: 'smile'
  },
  star: {
    legsL: [{ hip: [-9, -3], foot: [-22, -17] }, { hip: [-10, 1], foot: [-24, 1] }, { hip: [-9, 5], foot: [-21, 20] }],
    tilt: 0,
    eyeStyle: 'wide',
    mouth: 'open'
  },
  twist: {
    legsL: [{ hip: [-8, -3], foot: [-20, -4] }, { hip: [-9, 1], foot: [-13, 13] }, { hip: [-8, 5], foot: [-1, 19] }],
    legsR: [{ hip: [8, -3], foot: [1, -17] }, { hip: [9, 1], foot: [19, -10] }, { hip: [8, 5], foot: [20, 8] }],
    tilt: 0.2,
    eyeStyle: 'happy',
    mouth: 'open'
  },
  wave: {
    legsL: [{ hip: [-9, -2], foot: [-16, -8] }, { hip: [-10, 2], foot: [-17, 4] }, { hip: [-9, 6], foot: [-16, 12] }],
    legsR: [{ hip: [9, -2], foot: [16, -20] }, { hip: [10, 2], foot: [17, 4] }, { hip: [9, 6], foot: [16, 12] }],
    tilt: 0,
    eyeStyle: 'happy',
    mouth: 'smile'
  }
};

function outlinedEllipse(ctx, cx, cy, rx, ry, fill, outline, rot) {
  rot = rot || 0;
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 1.2, ry + 1.2, rot, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

function drawStubbyLeg(ctx, hipX, hipY, footX, footY, pal) {
  ctx.strokeStyle = pal.outline;
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(footX, footY);
  ctx.stroke();
  ctx.strokeStyle = pal.shade;
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(footX, footY);
  ctx.stroke();
}

function drawOneEye(ctx, ex, ey, r, pal, wide) {
  ctx.fillStyle = pal.outline;
  ctx.beginPath();
  ctx.arc(ex, ey, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = WORLD_CSS.paper;
  ctx.beginPath();
  ctx.arc(ex, ey, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.outline;
  const pupilY = wide ? ey : ey + 0.8;
  ctx.beginPath();
  ctx.arc(ex, pupilY, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = WORLD_CSS.white;
  ctx.beginPath();
  ctx.arc(ex - r * 0.25, ey - r * 0.3, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawHappyEye(ctx, ex, ey, pal) {
  ctx.strokeStyle = pal.outline;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(ex, ey, 3.6, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
}

function drawEyes(ctx, style, pal) {
  const pos = [[-5, 2.5], [5, 2.5]];
  if (style === 'happy') {
    pos.forEach(([x, y]) => drawHappyEye(ctx, x, y, pal));
    return;
  }
  const r = style === 'wide' ? 5.2 : 4.4;
  pos.forEach(([x, y]) => drawOneEye(ctx, x, y, r, pal, style === 'wide'));
}

function drawMouth(ctx, style, pal) {
  ctx.strokeStyle = pal.outline;
  ctx.lineWidth = 1.2;
  if (style === 'open') {
    ctx.fillStyle = pal.outline;
    ctx.beginPath();
    ctx.ellipse(0, 11, 1.8, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.arc(0, 10, 3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

export function drawSpiderPose(ctx, cx, cy, pose, pal) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(pose.tilt || 0);

  const legsL = pose.legsL;
  const legsR = pose.legsR || legsL.map((l) => ({ hip: [-l.hip[0], l.hip[1]], foot: [-l.foot[0], l.foot[1]] }));
  legsL.concat(legsR).forEach((l) => drawStubbyLeg(ctx, l.hip[0], l.hip[1], l.foot[0], l.foot[1], pal));

  outlinedEllipse(ctx, 0, 0, 10, 9, pal.body, pal.outline);
  ctx.fillStyle = pal.belly;
  ctx.beginPath();
  ctx.ellipse(0, 5, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pal.patchLeaf;
  ctx.beginPath();
  ctx.ellipse(-6, -4, 3.2, 2.4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6, -4, 3.2, 2.4, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.patchRust;
  ctx.beginPath();
  ctx.ellipse(0, -7, 2.6, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  drawEyes(ctx, pose.eyeStyle || 'normal', pal);
  drawMouth(ctx, pose.mouth || 'smile', pal);
  ctx.restore();
}

const CANVAS_SIZE = 64;
const CENTER = { x: 32, y: 36 };

export function textureKeyFor(paletteKey, poseKey) {
  return `spider-${paletteKey}-${poseKey}`;
}

export function ensureSpiderTexture(scene, paletteKey, poseKey) {
  const key = textureKeyFor(paletteKey, poseKey);
  if (scene.textures.exists(key)) return key;

  const pal = PALETTES[paletteKey] || PALETTES.autumn;
  const pose = POSES[poseKey] || POSES.idle;

  const canvasTexture = scene.textures.createCanvas(key, CANVAS_SIZE, CANVAS_SIZE);
  const ctx = canvasTexture.getContext();
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  drawSpiderPose(ctx, CENTER.x, CENTER.y, pose, pal);
  canvasTexture.refresh();

  return key;
}

export function randomPalette() {
  return PLAYER_PALETTE_KEYS[Math.floor(Math.random() * PLAYER_PALETTE_KEYS.length)];
}
