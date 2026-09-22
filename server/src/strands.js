import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { STRAND, distance, snapPoint, spinCost, strandBlocked } from '../../shared/webs.js';
import { DEFAULT_THREAD_COLOR, isThreadColor } from '../../shared/colors.js';

function num(v, max) {
  return typeof v === 'number' && Number.isFinite(v) && v >= -500 && v <= max ? v : null;
}

// Lasting strands: player-spun web lines that live in the shared world until
// they expire (or get reinforced). Persisted so the world survives restarts.
export function createStrandStore({ dataDir, map, lifetimeMs = STRAND.LIFETIME_MS }) {
  const file = path.join(dataDir, 'strands.json');
  const strands = new Map();

  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const now = Date.now();
    // Strands are positions in one specific map: never carry them into another.
    const sameMap = raw.mapId === map.id;
    if (!sameMap) console.log(`discarding saved strands (they belong to map "${raw.mapId}", now on "${map.id}")`);
    for (const s of sameMap && Array.isArray(raw.strands) ? raw.strands : []) {
      const ok = [s.x1, s.y1, s.x2, s.y2, s.expiresAt].every((v) => typeof v === 'number' && Number.isFinite(v));
      if (ok && typeof s.id === 'string' && typeof s.owner === 'string' && s.expiresAt > now) {
        strands.set(s.id, { ...s, color: isThreadColor(s.color) ? s.color : DEFAULT_THREAD_COLOR });
      }
    }
  } catch {
    // first run or unreadable file: empty world
  }

  let timer = null;
  function saveSoon() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(`${file}.tmp`, JSON.stringify({ mapId: map.id, strands: [...strands.values()] }));
        fs.renameSync(`${file}.tmp`, file);
      } catch (err) {
        console.error('could not save strands:', err.message);
      }
    }, 500);
  }

  const toPublic = (s, now) => ({
    id: s.id,
    x1: s.x1,
    y1: s.y1,
    x2: s.x2,
    y2: s.y2,
    color: s.color,
    ttl: Math.max(0, s.expiresAt - now)
  });
  const list = () => [...strands.values()];

  // Decide whether a spin request is allowed. Endpoints are re-snapped here, so
  // the exact coordinates always come from the server, never trusted from the client.
  function validateSpin(payload, { playerPos, ownerId }) {
    const raw = payload && typeof payload === 'object' ? payload : {};
    const [x1, y1, x2, y2] = [
      num(raw.x1, map.width + 500),
      num(raw.y1, map.height + 500),
      num(raw.x2, map.width + 500),
      num(raw.y2, map.height + 500)
    ];
    if ([x1, y1, x2, y2].includes(null)) return { ok: false, error: 'bad-points' };

    const all = list();
    const p1 = snapPoint(map, x1, y1, all);
    const p2 = snapPoint(map, x2, y2, all);
    if (!p1 || !p2) return { ok: false, error: 'no-node' };

    const len = distance(p1.x, p1.y, p2.x, p2.y);
    if (len < STRAND.MIN_LEN) return { ok: false, error: 'too-short' };
    if (len > STRAND.MAX_LEN) return { ok: false, error: 'too-long' };
    if (strandBlocked(map, p1, p2)) return { ok: false, error: 'blocked' };

    if (!playerPos || distance(playerPos.x, playerPos.y, p1.x, p1.y) > STRAND.START_REACH) {
      return { ok: false, error: 'too-far' };
    }

    if (all.length >= STRAND.MAX_TOTAL) return { ok: false, error: 'world-full' };
    if (all.filter((s) => s.owner === ownerId).length >= STRAND.MAX_PER_PLAYER) return { ok: false, error: 'limit' };

    const same = (ax, ay, bx, by) => distance(ax, ay, bx, by) < 6;
    const duplicate = all.some(
      (s) =>
        (same(s.x1, s.y1, p1.x, p1.y) && same(s.x2, s.y2, p2.x, p2.y)) ||
        (same(s.x1, s.y1, p2.x, p2.y) && same(s.x2, s.y2, p1.x, p1.y))
    );
    if (duplicate) return { ok: false, error: 'duplicate' };

    return { ok: true, p1, p2, len, cost: spinCost(len) };
  }

  function add({ owner, p1, p2, color }) {
    const now = Date.now();
    const strand = {
      id: crypto.randomBytes(6).toString('hex'),
      owner,
      color: isThreadColor(color) ? color : DEFAULT_THREAD_COLOR,
      x1: Math.round(p1.x * 10) / 10,
      y1: Math.round(p1.y * 10) / 10,
      x2: Math.round(p2.x * 10) / 10,
      y2: Math.round(p2.y * 10) / 10,
      expiresAt: now + lifetimeMs
    };
    strands.set(strand.id, strand);
    saveSoon();
    return toPublic(strand, now);
  }

  // Resets the timer. Returns the strand, or null if it no longer exists.
  function reinforce(id) {
    const strand = strands.get(id);
    if (!strand) return null;
    strand.expiresAt = Date.now() + lifetimeMs;
    saveSoon();
    return toPublic(strand, Date.now());
  }

  function sweep() {
    const now = Date.now();
    const removed = [];
    for (const [id, s] of strands) {
      if (s.expiresAt <= now) {
        strands.delete(id);
        removed.push(id);
      }
    }
    if (removed.length) saveSoon();
    return removed;
  }

  return {
    list,
    publicList: () => list().map((s) => toPublic(s, Date.now())),
    get: (id) => strands.get(id),
    validateSpin,
    add,
    reinforce,
    sweep
  };
}
