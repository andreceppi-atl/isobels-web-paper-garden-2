const TAU = Math.PI * 2;

const rounded = (value) => Math.round(value * 10) / 10;

function pointAt(cx, cy, radius, angle, wobble = 0) {
  const r = radius * (1 + Math.sin(angle * 3 + wobble) * 0.035);
  return { x: rounded(cx + Math.cos(angle) * r), y: rounded(cy + Math.sin(angle) * r) };
}

function segment(id, a, b, meta) {
  return {
    id,
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
    color: meta.color,
    permanent: true,
    ownerKind: meta.ownerKind,
    ownerId: meta.ownerId
  };
}

export function buildOrbWeb({ id, x, y, radius, color = 'silk', spokes = 8, rings = 3, phase = 0, ownerKind = 'world' }) {
  const strands = [];
  const meta = { color, ownerKind, ownerId: id };
  const outer = [];
  for (let spoke = 0; spoke < spokes; spoke += 1) {
    const angle = phase + (spoke / spokes) * TAU;
    const end = pointAt(x, y, radius, angle, phase * 7 + spoke);
    outer.push(end);
    strands.push(segment(`${id}-spoke-${spoke}`, { x, y }, end, meta));
  }

  for (let ring = 1; ring <= rings; ring += 1) {
    const ringRadius = radius * (0.2 + (ring / rings) * 0.8);
    const points = outer.map((_, spoke) => {
      const angle = phase + (spoke / spokes) * TAU;
      return pointAt(x, y, ringRadius, angle, phase * 11 + ring * 0.7 + spoke);
    });
    points.forEach((point, spoke) => {
      strands.push(segment(`${id}-ring-${ring}-${spoke}`, point, points[(spoke + 1) % spokes], meta));
    });
  }
  return strands;
}

export function buildStockStrands(map) {
  return (map.staticWebs || []).flatMap((web, index) => buildOrbWeb({
    id: web.id || `old-web-${index + 1}`,
    x: web.x,
    y: web.y,
    radius: web.radius,
    spokes: web.spokes || 7,
    rings: web.rings || 3,
    phase: web.phase || 0,
    color: web.color || 'silk',
    ownerKind: 'world'
  }));
}

export function buildNest(map, record) {
  const slot = map.nestSlots?.[record.slot];
  if (!slot) return null;
  const id = `nest-${String(record.slot).padStart(2, '0')}`;
  return {
    id,
    slot: record.slot,
    name: record.name || `nest ${String(record.slot + 1).padStart(2, '0')}`,
    color: record.color || 'silk',
    x: slot.x,
    y: slot.y,
    radius: slot.radius,
    spawn: { x: slot.x, y: slot.y - 12 },
    strands: buildOrbWeb({
      id,
      x: slot.x,
      y: slot.y,
      radius: slot.radius,
      spokes: slot.spokes || 8,
      rings: slot.rings || 3,
      phase: slot.phase || 0,
      color: record.color || 'silk',
      ownerKind: 'nest'
    })
  };
}

export function buildNests(map, records = []) {
  return records.map((record) => buildNest(map, record)).filter(Boolean);
}

export function buildPermanentStrands(map, nestRecords = []) {
  return [
    ...buildStockStrands(map),
    ...buildNests(map, nestRecords).flatMap((nest) => nest.strands)
  ];
}
