import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { createEconomy } from './economy.js';
import { createStrandStore } from './strands.js';
import { createPrefs } from './prefs.js';
import { DEFAULT_THREAD_COLOR, isThreadColor } from '../../shared/colors.js';
import { loadMap } from '../../shared/level.js';
import { STRAND, closestPointOnSegment, distance, reinforceCost } from '../../shared/webs.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5182;
const ORIGINS = (process.env.CLIENT_ORIGINS || 'http://localhost:5181').split(',');
const CLIENT_DIST = process.env.CLIENT_DIST || path.resolve(HERE, '../../client/dist');
const DATA_DIR = process.env.DATA_DIR || path.resolve(HERE, '../data');
const LINKS_FILE = path.join(DATA_DIR, 'connections.json');

const MAX_PLAYERS = 50;
const MIN_STATE_INTERVAL_MS = 30;
const MIN_HANDSHAKE_INTERVAL_MS = 400;
const POSES = new Set(['idle', 'swing', 'leap', 'wave']);
// Clients gate the prompt at a tighter range; this is the server's lenient
// re-check (latency slack) so a modified client can't handshake across the map.
const HANDSHAKE_SERVER_RANGE = 170;
const OFFER_TTL_MS = 8000;
const MAX_LINKS_PER_PLAYER = 200;
// Emotes are a fixed set; clients send only an index. Keep the count in sync
// with client/src/ui/emotes.js. Scope: 'everyone' lets strangers wave emoji at
// each other (no free text); set EMOTE_SCOPE=connected to limit them to webs.
const EMOTE_COUNT = 10;
const EMOTE_MIN_INTERVAL_MS = 700;
const EMOTE_SCOPE = process.env.EMOTE_SCOPE === 'connected' ? 'connected' : 'everyone';
const CHAT_MAX_LENGTH = 140;
const CHAT_MIN_INTERVAL_MS = 400;
const CHAT_WINDOW_MS = 10000;
const CHAT_MAX_PER_WINDOW = 8;
const PID_RE = /^[A-Za-z0-9-]{8,64}$/;
const STRAND_MIN_INTERVAL_MS = 500;
// Env overrides exist so tests can run on short timers.
const THREAD_TICK_MS = Number(process.env.THREAD_TICK_MS) || 3000;
const STRAND_SWEEP_MS = Number(process.env.STRAND_SWEEP_MS) || 5000;

const map = loadMap(process.env.MAP_ID);
const WORLD_W = map.width;
const WORLD_H = map.height + 200;

const app = express();
app.disable('x-powered-by');
app.get('/healthz', (req, res) => res.type('text').send('ok'));

// In production the built client is served from the same origin as the socket,
// so one URL (and one deploy) covers the whole game.
const serveClient = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));
if (serveClient) app.use(express.static(CLIENT_DIST));

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: ORIGINS } });

const players = new Map(); // socket id -> player
const socketsByPid = new Map(); // durable player id -> Set of socket ids
const offers = new Map(); // "fromSid>toSid" -> expiry timestamp

const economy = createEconomy({ dataDir: DATA_DIR, isDurable: (pid) => PID_RE.test(pid) });
const prefs = createPrefs({ dataDir: DATA_DIR, isDurable: (pid) => PID_RE.test(pid) });
const strands = createStrandStore({ dataDir: DATA_DIR, map, lifetimeMs: Number(process.env.STRAND_LIFETIME_MS) || undefined });

function pushThread(pid) {
  const payload = { balance: economy.get(pid), max: economy.max };
  for (const sid of socketsByPid.get(pid) || []) io.to(sid).emit('thread', payload);
}

// ---- Web connections (durable, keyed by client-generated player id) --------
// No accounts yet: the id lives in the player's localStorage. It is never sent
// to other clients, only used server-side to remember who is connected to whom.
const links = new Map(); // pid -> Set of pids

function isLinked(a, b) {
  const set = links.get(a);
  return !!set && set.has(b);
}

function addLink(a, b) {
  if (!links.has(a)) links.set(a, new Set());
  if (!links.has(b)) links.set(b, new Set());
  links.get(a).add(b);
  links.get(b).add(a);
}

function loadLinks() {
  try {
    const raw = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
    for (const pair of Array.isArray(raw.pairs) ? raw.pairs : []) {
      if (Array.isArray(pair) && PID_RE.test(pair[0]) && PID_RE.test(pair[1]) && pair[0] !== pair[1]) {
        addLink(pair[0], pair[1]);
      }
    }
  } catch {
    // first run or unreadable file: start with no connections
  }
}

let saveTimer = null;
function saveLinksSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const pairs = [];
      for (const [a, set] of links) {
        for (const b of set) if (a < b && PID_RE.test(a) && PID_RE.test(b)) pairs.push([a, b]);
      }
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = `${LINKS_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ pairs }));
      fs.renameSync(tmp, LINKS_FILE);
    } catch (err) {
      console.error('could not save connections:', err.message);
    }
  }, 500);
}

function connectionsFor(pid) {
  const partners = links.get(pid) || new Set();
  const online = [];
  for (const partner of partners) {
    for (const sid of socketsByPid.get(partner) || []) online.push(sid);
  }
  return { online, total: partners.size };
}

function pushConnections(pid) {
  const payload = connectionsFor(pid);
  for (const sid of socketsByPid.get(pid) || []) io.to(sid).emit('connections', payload);
}

function pushConnectionsAround(pid) {
  pushConnections(pid);
  for (const partner of links.get(pid) || []) pushConnections(partner);
}

// ---- Input cleaning --------------------------------------------------------
function clampNum(v, min, max) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;
}

function cleanName(v) {
  if (typeof v !== 'string') return 'Spider';
  const s = v.replace(/\p{Cc}/gu, '').trim().slice(0, 20);
  return s || 'Spider';
}

function cleanChat(v) {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_LENGTH);
  return s || null;
}

function cleanPalette(v) {
  return typeof v === 'string' && /^[a-z]{1,16}$/.test(v) ? v : 'autumn';
}

function cleanState(s) {
  if (!s || typeof s !== 'object') return null;
  const x = clampNum(s.x, -200, WORLD_W + 200);
  const y = clampNum(s.y, -400, WORLD_H);
  if (x === null || y === null) return null;

  let anchor = null;
  if (s.anchor && typeof s.anchor === 'object') {
    const ax = clampNum(s.anchor.x, -200, WORLD_W + 200);
    const ay = clampNum(s.anchor.y, -400, WORLD_H);
    if (ax !== null && ay !== null) anchor = { x: ax, y: ay };
  }

  return {
    x,
    y,
    facing: s.facing === -1 ? -1 : 1,
    pose: POSES.has(s.pose) ? s.pose : 'idle',
    rot: clampNum(s.rot, -7, 7) ?? 0,
    anchor
  };
}

function publicPlayer(p) {
  return { id: p.id, name: p.name, palette: p.palette, color: p.color, state: p.state };
}

function inHandshakeRange(a, b) {
  if (!a.state || !b.state) return false;
  return Math.hypot(a.state.x - b.state.x, a.state.y - b.state.y) <= HANDSHAKE_SERVER_RANGE;
}

// ---- Sockets ---------------------------------------------------------------
io.on('connection', (socket) => {
  socket.on('join', (payload) => {
    if (socket.data.joined) return;
    if (players.size >= MAX_PLAYERS) {
      socket.disconnect(true);
      return;
    }

    // A missing/invalid id still plays, it just can't keep connections across visits.
    const rawPid = payload && payload.pid;
    const pid = typeof rawPid === 'string' && PID_RE.test(rawPid) ? rawPid : `anon:${socket.id}`;

    const player = {
      id: socket.id,
      pid,
      name: cleanName(payload && payload.name),
      palette: cleanPalette(payload && payload.palette),
      color: prefs.threadColor(pid) || DEFAULT_THREAD_COLOR,
      listening: false,
      state: null
    };
    players.set(socket.id, player);
    if (!socketsByPid.has(pid)) socketsByPid.set(pid, new Set());
    socketsByPid.get(pid).add(socket.id);
    socket.data.joined = true;
    socket.data.lastState = 0;
    socket.data.lastHandshake = 0;

    const others = [...players.values()].filter((p) => p.id !== socket.id).map(publicPlayer);
    socket.emit('init', { id: socket.id, color: player.color, players: others, strands: strands.publicList() });
    socket.broadcast.emit('player:joined', publicPlayer(player));
    pushConnectionsAround(pid);
    pushThread(pid);
  });

  socket.on('state', (payload) => {
    if (!socket.data.joined) return;
    const now = Date.now();
    if (now - socket.data.lastState < MIN_STATE_INTERVAL_MS) return;
    socket.data.lastState = now;

    const state = cleanState(payload);
    if (!state) return;
    players.get(socket.id).state = state;
    socket.broadcast.volatile.emit('state', { id: socket.id, ...state });
  });

  // Development bridge for Phase 8: Thread accrues only while the player has
  // explicitly enabled listening. A verified provider can replace this signal
  // later without changing balances, strand costs, or the spending rules.
  socket.on('listen:set', (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!socket.data.joined) return reply({ ok: false, error: 'not-joined' });
    if (!payload || typeof payload.active !== 'boolean') return reply({ ok: false, error: 'bad-listening-state' });
    const player = players.get(socket.id);
    player.listening = payload.active;
    return reply({ ok: true, active: player.listening });
  });

  // One message does both jobs: it makes an offer, or accepts the other
  // player's pending offer. Two nearby players each pressing the button = a
  // handshake. The ack tells the sender what happened.
  socket.on('handshake', (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!socket.data.joined) return reply({ status: 'rejected' });

    const now = Date.now();
    if (now - socket.data.lastHandshake < MIN_HANDSHAKE_INTERVAL_MS) return reply({ status: 'rejected' });
    socket.data.lastHandshake = now;
    for (const [key, expires] of offers) if (expires <= now) offers.delete(key);

    const toId = payload && typeof payload.to === 'string' ? payload.to : null;
    const me = players.get(socket.id);
    const other = toId && toId !== socket.id ? players.get(toId) : null;
    if (!other || other.pid === me.pid) return reply({ status: 'rejected' });
    if (!inHandshakeRange(me, other)) return reply({ status: 'rejected' });
    if (isLinked(me.pid, other.pid)) return reply({ status: 'connected' });

    if (offers.has(`${toId}>${socket.id}`)) {
      const tooMany = (links.get(me.pid) || new Set()).size >= MAX_LINKS_PER_PLAYER ||
        (links.get(other.pid) || new Set()).size >= MAX_LINKS_PER_PLAYER;
      if (tooMany) return reply({ status: 'rejected' });

      offers.delete(`${toId}>${socket.id}`);
      addLink(me.pid, other.pid);
      saveLinksSoon();
      io.to(socket.id).emit('connected', { id: toId });
      io.to(toId).emit('connected', { id: socket.id });
      pushConnectionsAround(me.pid);
      pushConnectionsAround(other.pid);
      return reply({ status: 'connected' });
    }

    offers.set(`${socket.id}>${toId}`, now + OFFER_TTL_MS);
    io.to(toId).emit('handshake:offered', { from: socket.id, ttl: OFFER_TTL_MS });
    return reply({ status: 'offered', ttl: OFFER_TTL_MS });
  });

  // Chat goes only to spiders you are web-connected with who are online right
  // now. The rule is enforced here, not just hidden in the client UI.
  socket.on('chat', (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!socket.data.joined) return reply({ ok: false, error: 'not-joined' });

    const now = Date.now();
    const recent = (socket.data.chatTimes || []).filter((t) => now - t < CHAT_WINDOW_MS);
    if (recent.length >= CHAT_MAX_PER_WINDOW || now - (recent[recent.length - 1] || 0) < CHAT_MIN_INTERVAL_MS) {
      return reply({ ok: false, error: 'slow-down' });
    }
    recent.push(now);
    socket.data.chatTimes = recent;

    const text = cleanChat(payload && payload.text);
    if (!text) return reply({ ok: false, error: 'empty' });

    const me = players.get(socket.id);
    const recipients = connectionsFor(me.pid).online;
    if (recipients.length === 0) return reply({ ok: false, error: 'no-web' });

    for (const sid of recipients) io.to(sid).emit('chat', { from: socket.id, name: me.name, text });
    return reply({ ok: true, delivered: recipients.length });
  });

  socket.on('emote', (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!socket.data.joined) return reply({ ok: false, error: 'not-joined' });

    const now = Date.now();
    if (now - (socket.data.lastEmote || 0) < EMOTE_MIN_INTERVAL_MS) return reply({ ok: false, error: 'slow-down' });
    socket.data.lastEmote = now;

    const id = payload && payload.id;
    if (!Number.isInteger(id) || id < 0 || id >= EMOTE_COUNT) return reply({ ok: false, error: 'bad-emote' });

    const me = players.get(socket.id);
    const recipients = EMOTE_SCOPE === 'connected'
      ? connectionsFor(me.pid).online
      : [...players.keys()].filter((sid) => sid !== socket.id);
    for (const sid of recipients) io.to(sid).emit('emote', { from: socket.id, id });
    return reply({ ok: true });
  });

  // Spin a lasting strand. The server re-snaps the endpoints, checks the rules
  // (length, reach, caps, no duplicates) and charges Thread before anything
  // appears in the shared world.
  socket.on('strand:spin', (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!socket.data.joined) return reply({ ok: false, error: 'not-joined' });

    const now = Date.now();
    if (now - (socket.data.lastSpin || 0) < STRAND_MIN_INTERVAL_MS) return reply({ ok: false, error: 'slow-down' });
    socket.data.lastSpin = now;

    const me = players.get(socket.id);
    const check = strands.validateSpin(payload, { playerPos: me.state, ownerId: me.pid });
    if (!check.ok) return reply({ ok: false, error: check.error });
    if (!economy.spend(me.pid, check.cost)) return reply({ ok: false, error: 'no-thread', cost: check.cost });

    const strand = strands.add({ owner: me.pid, p1: check.p1, p2: check.p2, color: me.color });
    io.emit('strand:added', strand);
    pushThread(me.pid);
    return reply({ ok: true, id: strand.id, cost: check.cost });
  });

  // Anyone can reinforce any strand they are standing near, paying with their
  // own Thread - so friends can keep each other's webs alive.
  socket.on('strand:reinforce', (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!socket.data.joined) return reply({ ok: false, error: 'not-joined' });

    const now = Date.now();
    if (now - (socket.data.lastReinforce || 0) < STRAND_MIN_INTERVAL_MS) return reply({ ok: false, error: 'slow-down' });
    socket.data.lastReinforce = now;

    const id = payload && typeof payload.id === 'string' ? payload.id : null;
    const strand = id && strands.get(id);
    if (!strand) return reply({ ok: false, error: 'gone' });

    const me = players.get(socket.id);
    if (!me.state) return reply({ ok: false, error: 'too-far' });
    const c = closestPointOnSegment(me.state.x, me.state.y, strand.x1, strand.y1, strand.x2, strand.y2);
    if (distance(me.state.x, me.state.y, c.x, c.y) > STRAND.REINFORCE_RANGE) return reply({ ok: false, error: 'too-far' });

    const cost = reinforceCost(distance(strand.x1, strand.y1, strand.x2, strand.y2));
    if (!economy.spend(me.pid, cost)) return reply({ ok: false, error: 'no-thread', cost });

    const updated = strands.reinforce(id);
    io.emit('strand:reinforced', { id, ttl: updated.ttl });
    pushThread(me.pid);
    return reply({ ok: true, cost });
  });

  // Thread color: only a key from the shared preset list is accepted. It is
  // saved for the player and applied to every tab they have open.
  socket.on('color:set', (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!socket.data.joined) return reply({ ok: false, error: 'not-joined' });

    const now = Date.now();
    if (now - (socket.data.lastColor || 0) < 300) return reply({ ok: false, error: 'slow-down' });
    socket.data.lastColor = now;

    const color = payload && payload.color;
    if (!isThreadColor(color)) return reply({ ok: false, error: 'bad-color' });

    const me = players.get(socket.id);
    prefs.setThreadColor(me.pid, color);
    for (const sid of socketsByPid.get(me.pid) || []) {
      const p = players.get(sid);
      if (p) p.color = color;
      io.emit('player:color', { id: sid, color });
    }
    return reply({ ok: true, color });
  });

  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (!player) return;
    players.delete(socket.id);
    for (const key of offers.keys()) if (key.startsWith(`${socket.id}>`) || key.endsWith(`>${socket.id}`)) offers.delete(key);

    const sids = socketsByPid.get(player.pid);
    if (sids) {
      sids.delete(socket.id);
      if (sids.size === 0) {
        socketsByPid.delete(player.pid);
        prefs.forget(player.pid);
      }
    }
    io.emit('player:left', socket.id);
    pushConnectionsAround(player.pid);
  });
});

loadLinks();

setInterval(() => {
  for (const id of strands.sweep()) io.emit('strand:removed', { id });
}, STRAND_SWEEP_MS);
setInterval(() => {
  const listeningPids = new Set([...players.values()].filter((player) => player.listening).map((player) => player.pid));
  for (const pid of economy.trickle(listeningPids)) pushThread(pid);
}, THREAD_TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`map: ${map.id} (${map.width}x${map.height}, ${map.solids.length} solids)`);
  console.log(`webspun server listening on :${PORT} (origins: ${ORIGINS.join(', ')})`);
  console.log(serveClient ? `serving client from ${CLIENT_DIST}` : 'no client build found - socket only (dev mode)');
  console.log(`loaded ${[...links.values()].reduce((n, s) => n + s.size, 0) / 2} connection(s) from ${LINKS_FILE}`);
});
