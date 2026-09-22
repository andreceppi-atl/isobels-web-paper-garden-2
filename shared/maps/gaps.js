// "Gaps": the original single-screen practice level (flat ground with pits and
// floating anchor points). Kept as the regression map for the swing feel.
export default {
  id: 'gaps',
  name: 'Gaps',
  width: 3400,
  height: 900,
  spawn: { x: 100, y: 400 },
  nest: { x: 150, y: 526 },
  anchors: [610, 1120, 1580, 2280, 2790].map((x) => ({ x, y: 260 })),
  solids: [
    { x: 0, w: 500 },
    { x: 700, w: 400 },
    { x: 1250, w: 350 },
    { x: 1750, w: 500 },
    { x: 2450, w: 300 },
    { x: 2950, w: 450 }
  ].map((s) => ({ ...s, y: 540, h: 40, kind: 'floor' }))
};
