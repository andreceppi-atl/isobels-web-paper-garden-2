import { DurableObject } from 'cloudflare:workers';
import { DEFAULT_THREAD_COLOR, isThreadColor } from '../../shared/colors.js';
import { loadMap } from '../../shared/level.js';
import { buildPermanentStrands } from '../../shared/worldWebs.js';
import {
  STRAND,
  closestPointOnSegment,
  distance,
  reinforceCost,
  snapPoint,
  spinCost,
  strandBlocked
} from '../../shared/webs.js';

const WORLD = loadMap();
const WORLD_W = WORLD.width;
const WORLD_H = WORLD.height + 200;

const MAX_PLAYERS = 50;
const MIN_STATE_INTERVAL_MS = 30;
const MIN_HANDSHAKE_INTERVAL_MS = 400;
const HANDSHAKE_SERVER_RANGE = 170;
const OFFER_TTL_MS = 8000;
const MAX_LINKS_PER_PLAYER = 200;
const EMOTE_COUNT = 10;
const EMOTE_MIN_INTERVAL_MS = 700;
const CHAT_MAX_LENGTH = 140;
const CHAT_MIN_INTERVAL_MS = 400;
const CHAT_WINDOW_MS = 10000;
const CHAT_MAX_PER_WINDOW = 8;
const STRAND_MIN_INTERVAL_MS = 500;
const THREAD_TICK_MS = 3000;
const THREAD_START = 50;
const THREAD_MAX = 100;
const PID_RE = /^[A-Za-z0-9-]{8,64}$/;
const ROOM_RE = /^[a-z0-9-]{1,40}$/;
const POSES = new Set(['idle', 'swing', 'leap', 'wave', 'tuck', 'star', 'twist']);
const MAX_FRAME_BYTES = 16 * 1024;

function json(event, data, requestId) {
  return JSON.stringify(requestId ? { event, data, requestId } : { event, data });
}

function send(ws, event, data, requestId) {
  try {
    ws.send(json(event, data, requestId));
  } catch {
    // The close event performs cleanup; a failed send needs no second action.
  }
}

function ack(ws, requestId, data) {
  if (typeof requestId === 'string' && requestId.length <= 80) send(ws, 'ack', data, requestId);
}

function clampNum(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : null;
}

function cleanName(value) {
  if (typeof value !== 'string') return 'Spider';
  const cleaned = value.replace(/\p{Cc}/gu, '').trim().slice(0, 20);
  return cleaned || 'Spider';
}

function cleanChat(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_LENGTH);
  return cleaned || null;
}

function cleanPalette(value) {
  return typeof value === 'string' && /^[a-z]{1,16}$/.test(value) ? value : 'autumn';
}

function cleanState(value) {
  if (!value || typeof value !== 'object') return null;
  const x = clampNum(value.x, -200, WORLD_W + 200);
  const y = clampNum(value.y, -400, WORLD_H);
  if (x === null || y === null) return null;

  let anchor = null;
  if (value.anchor && typeof value.anchor === 'object') {
    const ax = clampNum(value.anchor.x, -200, WORLD_W + 200);
    const ay = clampNum(value.anchor.y, -400, WORLD_H);
    if (ax !== null && ay !== null) anchor = { x: ax, y: ay };
  }

  return {
    x,
    y,
    facing: value.facing === -1 ? -1 : 1,
    pose: POSES.has(value.pose) ? value.pose : 'idle',
    rot: clampNum(value.rot, -7, 7) ?? 0,
    anchor
  };
}

function connectionState(ws) {
  const value = ws.deserializeAttachment();
  return value && typeof value === 'object' ? value : null;
}

function saveConnection(ws, connection) {
  ws.serializeAttachment(connection);
}

function publicPlayer(connection) {
  return {
    id: connection.id,
    name: connection.name,
    palette: connection.palette,
    color: connection.color,
    state: connection.state
  };
}

function inHandshakeRange(a, b) {
  return !!a.state && !!b.state && Math.hypot(a.state.x - b.state.x, a.state.y - b.state.y) <= HANDSHAKE_SERVER_RANGE;
}

function canonicalPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

function corsHeaders(origin, configuredOrigins) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };
  if (originAllowed(origin, configuredOrigins)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function originAllowed(origin, configuredOrigins = '') {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (url.protocol === 'https:' && url.hostname.endsWith('.wallert.chatgpt.site')) return true;
    if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && (url.protocol === 'http:' || url.protocol === 'https:')) return true;
    return configuredOrigins
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .includes(url.origin);
  } catch {
    return false;
  }
}

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS profiles (
          pid TEXT PRIMARY KEY,
          color TEXT NOT NULL DEFAULT 'silk',
          balance INTEGER NOT NULL DEFAULT 50,
          last_credit_at INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS links (
          a TEXT NOT NULL,
          b TEXT NOT NULL,
          PRIMARY KEY (a, b)
        );
        CREATE TABLE IF NOT EXISTS offers (
          from_id TEXT NOT NULL,
          to_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          PRIMARY KEY (from_id, to_id)
        );
        CREATE TABLE IF NOT EXISTS strands (
          id TEXT PRIMARY KEY,
          owner TEXT NOT NULL,
          color TEXT NOT NULL,
          x1 REAL NOT NULL,
          y1 REAL NOT NULL,
          x2 REAL NOT NULL,
          y2 REAL NOT NULL,
          expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS nests (
          pid TEXT PRIMARY KEY,
          slot INTEGER NOT NULL UNIQUE,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_links_a ON links(a);
        CREATE INDEX IF NOT EXISTS idx_links_b ON links(b);
        CREATE INDEX IF NOT EXISTS idx_strands_expires ON strands(expires_at);
        CREATE INDEX IF NOT EXISTS idx_nests_slot ON nests(slot);
      `);
    });
  }

  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    saveConnection(server, {
      id: crypto.randomUUID(),
      joined: false,
      pid: null,
      name: 'Spider',
      palette: 'autumn',
      color: DEFAULT_THREAD_COLOR,
      listening: false,
      state: null,
      rates: {
        state: 0,
        handshake: 0,
        emote: 0,
        spin: 0,
        reinforce: 0,
        color: 0,
        chat: []
      }
    });
    return new Response(null, { status: 101, webSocket: client });
  }

  sockets() {
    return this.ctx.getWebSockets();
  }

  players() {
    const players = [];
    for (const ws of this.sockets()) {
      const connection = connectionState(ws);
      if (connection?.joined) players.push({ ws, connection });
    }
    return players;
  }

  findById(id) {
    return this.players().find(({ connection }) => connection.id === id) || null;
  }

  forPid(pid) {
    return this.players().filter(({ connection }) => connection.pid === pid);
  }

  broadcast(event, data, exceptId = null) {
    for (const { ws, connection } of this.players()) {
      if (connection.id !== exceptId) send(ws, event, data);
    }
  }

  ensureProfile(pid, now = Date.now()) {
    this.ctx.storage.sql.exec(
      'INSERT OR IGNORE INTO profiles (pid, color, balance, last_credit_at) VALUES (?, ?, ?, ?)',
      pid,
      DEFAULT_THREAD_COLOR,
      THREAD_START,
      now
    );
    return this.ctx.storage.sql.exec(
      'SELECT color, balance, last_credit_at FROM profiles WHERE pid = ?',
      pid
    ).one();
  }

  pushThread(pid) {
    const profile = this.ensureProfile(pid);
    const payload = { balance: profile.balance, max: THREAD_MAX };
    for (const { ws } of this.forPid(pid)) send(ws, 'thread', payload);
  }

  nestRows() {
    return this.ctx.storage.sql.exec(`
      SELECT n.pid, n.slot, n.name, p.color
      FROM nests n
      JOIN profiles p ON p.pid = n.pid
      ORDER BY n.slot
    `).toArray();
  }

  publicNest(row) {
    if (!row || !Number.isInteger(row.slot) || !WORLD.nestSlots?.[row.slot]) return null;
    return {
      slot: row.slot,
      name: cleanName(row.name),
      color: isThreadColor(row.color) ? row.color : DEFAULT_THREAD_COLOR
    };
  }

  publicNests() {
    return this.nestRows().map((row) => this.publicNest(row)).filter(Boolean);
  }

  publicNestFor(pid) {
    const row = this.ctx.storage.sql.exec(`
      SELECT n.pid, n.slot, n.name, p.color
      FROM nests n
      JOIN profiles p ON p.pid = n.pid
      WHERE n.pid = ?
    `, pid).toArray()[0];
    return this.publicNest(row);
  }

  ensureNest(pid, name, now = Date.now()) {
    const existing = this.publicNestFor(pid);
    if (existing) {
      this.ctx.storage.sql.exec('UPDATE nests SET name = ? WHERE pid = ?', name, pid);
      return { ...existing, name };
    }
    const used = new Set(this.ctx.storage.sql.exec('SELECT slot FROM nests').toArray().map((row) => row.slot));
    const slot = WORLD.nestSlots?.findIndex((_, index) => !used.has(index)) ?? -1;
    if (slot < 0) return null;
    this.ctx.storage.sql.exec(
      'INSERT INTO nests (pid, slot, name, created_at) VALUES (?, ?, ?, ?)',
      pid,
      slot,
      name,
      now
    );
    return this.publicNestFor(pid);
  }

  partnerPids(pid) {
    return this.ctx.storage.sql.exec(
      'SELECT CASE WHEN a = ? THEN b ELSE a END AS partner FROM links WHERE a = ? OR b = ?',
      pid,
      pid,
      pid
    ).toArray().map((row) => row.partner);
  }

  isLinked(a, b) {
    const [left, right] = canonicalPair(a, b);
    return this.ctx.storage.sql.exec(
      'SELECT COUNT(*) AS total FROM links WHERE a = ? AND b = ?',
      left,
      right
    ).one().total > 0;
  }

  connectionsFor(pid) {
    const partners = new Set(this.partnerPids(pid));
    const online = this.players()
      .filter(({ connection }) => partners.has(connection.pid))
      .map(({ connection }) => connection.id);
    return { online, total: partners.size };
  }

  pushConnections(pid) {
    const payload = this.connectionsFor(pid);
    for (const { ws } of this.forPid(pid)) send(ws, 'connections', payload);
  }

  pushConnectionsAround(pid) {
    this.pushConnections(pid);
    for (const partner of this.partnerPids(pid)) this.pushConnections(partner);
  }

  strandRows() {
    return this.ctx.storage.sql.exec(
      'SELECT id, owner, color, x1, y1, x2, y2, expires_at AS expiresAt FROM strands ORDER BY expires_at'
    ).toArray();
  }

  publicStrand(strand, now = Date.now()) {
    return {
      id: strand.id,
      x1: strand.x1,
      y1: strand.y1,
      x2: strand.x2,
      y2: strand.y2,
      color: isThreadColor(strand.color) ? strand.color : DEFAULT_THREAD_COLOR,
      ttl: Math.max(0, strand.expiresAt - now)
    };
  }

  cleanExpired(now) {
    const expired = this.ctx.storage.sql.exec('SELECT id FROM strands WHERE expires_at <= ?', now).toArray();
    if (expired.length) {
      this.ctx.storage.sql.exec('DELETE FROM strands WHERE expires_at <= ?', now);
      for (const { id } of expired) this.broadcast('strand:removed', { id });
    }
    this.ctx.storage.sql.exec('DELETE FROM offers WHERE expires_at <= ?', now);
  }

  creditListeners(now) {
    const pids = new Set(this.players().filter(({ connection }) => connection.listening).map(({ connection }) => connection.pid));
    for (const pid of pids) {
      const profile = this.ensureProfile(pid, now);
      const elapsed = Math.max(0, now - profile.last_credit_at);
      const steps = Math.min(10, Math.floor(elapsed / THREAD_TICK_MS));
      if (steps < 1) continue;
      const balance = Math.min(THREAD_MAX, profile.balance + steps);
      const creditedThrough = profile.last_credit_at + steps * THREAD_TICK_MS;
      this.ctx.storage.sql.exec(
        'UPDATE profiles SET balance = ?, last_credit_at = ? WHERE pid = ?',
        balance,
        creditedThrough,
        pid
      );
      this.pushThread(pid);
    }
  }

  maintain(now = Date.now()) {
    this.cleanExpired(now);
    this.creditListeners(now);
  }

  async scheduleAlarm(now = Date.now()) {
    const listenerDue = this.players().some(({ connection }) => connection.listening) ? now + THREAD_TICK_MS : null;
    const nextStrand = this.ctx.storage.sql.exec('SELECT MIN(expires_at) AS next FROM strands').one().next;
    const due = [listenerDue, nextStrand].filter((value) => typeof value === 'number' && value > now);
    if (due.length) await this.ctx.storage.setAlarm(Math.min(...due));
    else await this.ctx.storage.deleteAlarm();
  }

  async alarm() {
    this.maintain();
    await this.scheduleAlarm();
  }

  validateSpin(payload, connection) {
    const raw = payload && typeof payload === 'object' ? payload : {};
    const values = [
      clampNum(raw.x1, -500, WORLD_W + 500),
      clampNum(raw.y1, -500, WORLD_H + 500),
      clampNum(raw.x2, -500, WORLD_W + 500),
      clampNum(raw.y2, -500, WORLD_H + 500)
    ];
    if (values.includes(null)) return { ok: false, error: 'bad-points' };

    const [x1, y1, x2, y2] = values;
    const strands = this.strandRows();
    const permanent = buildPermanentStrands(WORLD, this.publicNests());
    const snapStrands = [...permanent, ...strands];
    const p1 = snapPoint(WORLD, x1, y1, snapStrands);
    const p2 = snapPoint(WORLD, x2, y2, snapStrands);
    if (!p1 || !p2) return { ok: false, error: 'no-node' };

    const len = distance(p1.x, p1.y, p2.x, p2.y);
    if (len < STRAND.MIN_LEN) return { ok: false, error: 'too-short' };
    if (len > STRAND.MAX_LEN) return { ok: false, error: 'too-long' };
    if (strandBlocked(WORLD, p1, p2)) return { ok: false, error: 'blocked' };
    if (!connection.state || distance(connection.state.x, connection.state.y, p1.x, p1.y) > STRAND.START_REACH) {
      return { ok: false, error: 'too-far' };
    }
    if (strands.length >= STRAND.MAX_TOTAL) return { ok: false, error: 'world-full' };
    if (strands.filter((strand) => strand.owner === connection.pid).length >= STRAND.MAX_PER_PLAYER) {
      return { ok: false, error: 'limit' };
    }

    const same = (ax, ay, bx, by) => distance(ax, ay, bx, by) < 6;
    const duplicate = snapStrands.some((strand) =>
      (same(strand.x1, strand.y1, p1.x, p1.y) && same(strand.x2, strand.y2, p2.x, p2.y)) ||
      (same(strand.x1, strand.y1, p2.x, p2.y) && same(strand.x2, strand.y2, p1.x, p1.y))
    );
    if (duplicate) return { ok: false, error: 'duplicate' };
    return { ok: true, p1, p2, cost: spinCost(len) };
  }

  spend(pid, amount) {
    const profile = this.ensureProfile(pid);
    if (profile.balance < amount) return false;
    this.ctx.storage.sql.exec('UPDATE profiles SET balance = ? WHERE pid = ?', profile.balance - amount, pid);
    return true;
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_FRAME_BYTES) {
      ws.close(1009, 'Message too large');
      return;
    }

    let frame;
    try {
      frame = JSON.parse(message);
    } catch {
      return;
    }
    if (!frame || typeof frame.event !== 'string' || frame.event.length > 40) return;

    const connection = connectionState(ws);
    if (!connection) return;
    const now = Date.now();
    this.maintain(now);

    if (frame.event === 'join') {
      if (connection.joined) return;
      if (this.players().length >= MAX_PLAYERS) {
        ws.close(1013, 'World full');
        return;
      }

      const rawPid = frame.data?.pid;
      connection.pid = typeof rawPid === 'string' && PID_RE.test(rawPid) ? rawPid : `anon-${connection.id}`;
      connection.name = cleanName(frame.data?.name);
      connection.palette = cleanPalette(frame.data?.palette);
      const profile = this.ensureProfile(connection.pid, now);
      connection.color = isThreadColor(profile.color) ? profile.color : DEFAULT_THREAD_COLOR;
      const home = this.ensureNest(connection.pid, connection.name, now);
      connection.joined = true;
      saveConnection(ws, connection);

      const others = this.players()
        .filter(({ connection: other }) => other.id !== connection.id)
        .map(({ connection: other }) => publicPlayer(other));
      const strands = this.strandRows().filter((strand) => strand.expiresAt > now).map((strand) => this.publicStrand(strand, now));
      const nests = this.publicNests();
      send(ws, 'init', { id: connection.id, color: connection.color, players: others, strands, nests, home });
      this.broadcast('player:joined', publicPlayer(connection), connection.id);
      if (home) this.broadcast('nest:upsert', home);
      this.pushConnectionsAround(connection.pid);
      this.pushThread(connection.pid);
      await this.scheduleAlarm(now);
      return;
    }

    if (!connection.joined) {
      ack(ws, frame.requestId, { ok: false, error: 'not-joined' });
      return;
    }

    switch (frame.event) {
      case 'state': {
        if (now - connection.rates.state < MIN_STATE_INTERVAL_MS) return;
        connection.rates.state = now;
        const state = cleanState(frame.data);
        if (!state) return;
        connection.state = state;
        saveConnection(ws, connection);
        this.broadcast('state', { id: connection.id, ...state }, connection.id);
        return;
      }

      case 'listen:set': {
        if (typeof frame.data?.active !== 'boolean') {
          ack(ws, frame.requestId, { ok: false, error: 'bad-listening-state' });
          return;
        }
        connection.listening = frame.data.active;
        saveConnection(ws, connection);
        if (connection.listening) {
          this.ctx.storage.sql.exec('UPDATE profiles SET last_credit_at = ? WHERE pid = ?', now, connection.pid);
        }
        ack(ws, frame.requestId, { ok: true, active: connection.listening });
        await this.scheduleAlarm(now);
        return;
      }

      case 'handshake': {
        if (now - connection.rates.handshake < MIN_HANDSHAKE_INTERVAL_MS) {
          ack(ws, frame.requestId, { status: 'rejected' });
          return;
        }
        connection.rates.handshake = now;
        saveConnection(ws, connection);
        const targetId = typeof frame.data?.to === 'string' ? frame.data.to : null;
        const target = targetId && targetId !== connection.id ? this.findById(targetId) : null;
        if (!target || target.connection.pid === connection.pid || !inHandshakeRange(connection, target.connection)) {
          ack(ws, frame.requestId, { status: 'rejected' });
          return;
        }
        if (this.isLinked(connection.pid, target.connection.pid)) {
          ack(ws, frame.requestId, { status: 'connected' });
          return;
        }

        const reverse = this.ctx.storage.sql.exec(
          'SELECT COUNT(*) AS total FROM offers WHERE from_id = ? AND to_id = ? AND expires_at > ?',
          targetId,
          connection.id,
          now
        ).one().total > 0;
        if (reverse) {
          if (this.partnerPids(connection.pid).length >= MAX_LINKS_PER_PLAYER || this.partnerPids(target.connection.pid).length >= MAX_LINKS_PER_PLAYER) {
            ack(ws, frame.requestId, { status: 'rejected' });
            return;
          }
          const [a, b] = canonicalPair(connection.pid, target.connection.pid);
          this.ctx.storage.sql.exec('DELETE FROM offers WHERE from_id = ? AND to_id = ?', targetId, connection.id);
          this.ctx.storage.sql.exec('INSERT OR IGNORE INTO links (a, b) VALUES (?, ?)', a, b);
          send(ws, 'connected', { id: targetId });
          send(target.ws, 'connected', { id: connection.id });
          this.pushConnectionsAround(connection.pid);
          this.pushConnectionsAround(target.connection.pid);
          ack(ws, frame.requestId, { status: 'connected' });
          return;
        }

        this.ctx.storage.sql.exec(
          'INSERT OR REPLACE INTO offers (from_id, to_id, expires_at) VALUES (?, ?, ?)',
          connection.id,
          targetId,
          now + OFFER_TTL_MS
        );
        send(target.ws, 'handshake:offered', { from: connection.id, ttl: OFFER_TTL_MS });
        ack(ws, frame.requestId, { status: 'offered', ttl: OFFER_TTL_MS });
        return;
      }

      case 'chat': {
        const recent = connection.rates.chat.filter((time) => now - time < CHAT_WINDOW_MS);
        if (recent.length >= CHAT_MAX_PER_WINDOW || now - (recent[recent.length - 1] || 0) < CHAT_MIN_INTERVAL_MS) {
          ack(ws, frame.requestId, { ok: false, error: 'slow-down' });
          return;
        }
        const text = cleanChat(frame.data?.text);
        if (!text) {
          ack(ws, frame.requestId, { ok: false, error: 'empty' });
          return;
        }
        recent.push(now);
        connection.rates.chat = recent;
        saveConnection(ws, connection);
        const recipients = this.connectionsFor(connection.pid).online;
        if (!recipients.length) {
          ack(ws, frame.requestId, { ok: false, error: 'no-web' });
          return;
        }
        for (const id of recipients) {
          const recipient = this.findById(id);
          if (recipient) send(recipient.ws, 'chat', { from: connection.id, name: connection.name, text });
        }
        ack(ws, frame.requestId, { ok: true, delivered: recipients.length });
        return;
      }

      case 'emote': {
        if (now - connection.rates.emote < EMOTE_MIN_INTERVAL_MS) return;
        connection.rates.emote = now;
        saveConnection(ws, connection);
        const id = frame.data?.id;
        if (!Number.isInteger(id) || id < 0 || id >= EMOTE_COUNT) return;
        this.broadcast('emote', { from: connection.id, id }, connection.id);
        return;
      }

      case 'strand:spin': {
        if (now - connection.rates.spin < STRAND_MIN_INTERVAL_MS) {
          ack(ws, frame.requestId, { ok: false, error: 'slow-down' });
          return;
        }
        connection.rates.spin = now;
        saveConnection(ws, connection);
        const check = this.validateSpin(frame.data, connection);
        if (!check.ok) {
          ack(ws, frame.requestId, check);
          return;
        }
        if (!this.spend(connection.pid, check.cost)) {
          ack(ws, frame.requestId, { ok: false, error: 'no-thread', cost: check.cost });
          return;
        }
        const id = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
        const strand = {
          id,
          owner: connection.pid,
          color: connection.color,
          x1: Math.round(check.p1.x * 10) / 10,
          y1: Math.round(check.p1.y * 10) / 10,
          x2: Math.round(check.p2.x * 10) / 10,
          y2: Math.round(check.p2.y * 10) / 10,
          expiresAt: now + STRAND.LIFETIME_MS
        };
        this.ctx.storage.sql.exec(
          'INSERT INTO strands (id, owner, color, x1, y1, x2, y2, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          strand.id,
          strand.owner,
          strand.color,
          strand.x1,
          strand.y1,
          strand.x2,
          strand.y2,
          strand.expiresAt
        );
        this.broadcast('strand:added', this.publicStrand(strand, now));
        this.pushThread(connection.pid);
        ack(ws, frame.requestId, { ok: true, id, cost: check.cost });
        await this.scheduleAlarm(now);
        return;
      }

      case 'strand:reinforce': {
        if (now - connection.rates.reinforce < STRAND_MIN_INTERVAL_MS) {
          ack(ws, frame.requestId, { ok: false, error: 'slow-down' });
          return;
        }
        connection.rates.reinforce = now;
        saveConnection(ws, connection);
        const id = typeof frame.data?.id === 'string' ? frame.data.id : null;
        const strand = id ? this.ctx.storage.sql.exec(
          'SELECT id, owner, color, x1, y1, x2, y2, expires_at AS expiresAt FROM strands WHERE id = ?',
          id
        ).toArray()[0] : null;
        if (!strand) {
          ack(ws, frame.requestId, { ok: false, error: 'gone' });
          return;
        }
        if (!connection.state) {
          ack(ws, frame.requestId, { ok: false, error: 'too-far' });
          return;
        }
        const point = closestPointOnSegment(connection.state.x, connection.state.y, strand.x1, strand.y1, strand.x2, strand.y2);
        if (distance(connection.state.x, connection.state.y, point.x, point.y) > STRAND.REINFORCE_RANGE) {
          ack(ws, frame.requestId, { ok: false, error: 'too-far' });
          return;
        }
        const cost = reinforceCost(distance(strand.x1, strand.y1, strand.x2, strand.y2));
        if (!this.spend(connection.pid, cost)) {
          ack(ws, frame.requestId, { ok: false, error: 'no-thread', cost });
          return;
        }
        const expiresAt = now + STRAND.LIFETIME_MS;
        this.ctx.storage.sql.exec('UPDATE strands SET expires_at = ? WHERE id = ?', expiresAt, id);
        this.broadcast('strand:reinforced', { id, ttl: STRAND.LIFETIME_MS });
        this.pushThread(connection.pid);
        ack(ws, frame.requestId, { ok: true, cost });
        await this.scheduleAlarm(now);
        return;
      }

      case 'color:set': {
        if (now - connection.rates.color < 300) {
          ack(ws, frame.requestId, { ok: false, error: 'slow-down' });
          return;
        }
        connection.rates.color = now;
        const color = frame.data?.color;
        if (!isThreadColor(color)) {
          ack(ws, frame.requestId, { ok: false, error: 'bad-color' });
          return;
        }
        this.ctx.storage.sql.exec('UPDATE profiles SET color = ? WHERE pid = ?', color, connection.pid);
        for (const samePlayer of this.forPid(connection.pid)) {
          samePlayer.connection.color = color;
          saveConnection(samePlayer.ws, samePlayer.connection);
          this.broadcast('player:color', { id: samePlayer.connection.id, color });
        }
        const nest = this.publicNestFor(connection.pid);
        if (nest) this.broadcast('nest:upsert', nest);
        ack(ws, frame.requestId, { ok: true, color });
        return;
      }

      default:
        ack(ws, frame.requestId, { ok: false, error: 'unknown-event' });
    }
  }

  async webSocketClose(ws) {
    const connection = connectionState(ws);
    if (!connection?.joined) return;
    this.ctx.storage.sql.exec('DELETE FROM offers WHERE from_id = ? OR to_id = ?', connection.id, connection.id);
    this.broadcast('player:left', connection.id, connection.id);
    this.pushConnectionsAround(connection.pid);
    await this.scheduleAlarm();
  }

  webSocketError(ws) {
    try {
      ws.close(1011, 'WebSocket error');
    } catch {
      // The runtime may already have closed the connection.
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowedOrigins = env.ALLOWED_ORIGINS || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, allowedOrigins) });
    }
    if (url.pathname === '/healthz') {
      return Response.json(
        { ok: true, service: 'isobels-web-paper-garden-2-multiplayer' },
        { headers: corsHeaders(origin, allowedOrigins) }
      );
    }
    if (url.pathname !== '/ws') return new Response('Not found', { status: 404 });
    if (!originAllowed(origin, allowedOrigins)) return new Response('Origin not allowed', { status: 403 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const requestedRoom = url.searchParams.get('room') || 'paper-garden-2';
    const room = ROOM_RE.test(requestedRoom) ? requestedRoom : 'paper-garden-2';
    const stub = env.GAME_ROOMS.getByName(room);
    return stub.fetch(request);
  }
};
