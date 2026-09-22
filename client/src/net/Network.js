import { MAP_ID } from '../map.js';

// Production points at the permanent Paper Garden WebSocket room. In local
// development, ?server=ws://localhost:8787/ws?room=paper-garden-2 can override it.
const SERVER_OVERRIDE = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('server') : null;
const PRODUCTION_SERVER_URL = 'wss://isobels-web-paper-garden-2-multiplayer.andre-ceppi.workers.dev/ws?room=paper-garden-2';
const RAW_SERVER_URL =
  SERVER_OVERRIDE ||
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? PRODUCTION_SERVER_URL : `ws://${window.location.hostname}:8787/ws?room=paper-garden-2`);

function websocketUrl(value) {
  const url = new URL(value, window.location.href);
  if (url.protocol === 'https:') url.protocol = 'wss:';
  if (url.protocol === 'http:') url.protocol = 'ws:';
  if (url.pathname === '/') url.pathname = '/ws';
  if (!url.searchParams.has('room')) url.searchParams.set('room', 'paper-garden-2');
  url.searchParams.set('map', MAP_ID);
  return url.toString();
}

const SERVER_URL = websocketUrl(RAW_SERVER_URL);

// Stable per-browser id so web connections survive refreshes. There are no
// accounts yet (Phase 8), so this is remembered locally and never shown to
// other players - the server only uses it to remember who is connected to whom.
function getPlayerId() {
  try {
    const saved = localStorage.getItem('webspun_pid');
    if (saved) return saved;
  } catch {
    // storage blocked: fall through to a session-only id
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  try {
    localStorage.setItem('webspun_pid', id);
  } catch {
    // session-only
  }
  return id;
}

// Thin wrapper over a small JSON WebSocket protocol. The game remains playable
// solo while disconnected and reconnects to the shared room in the background.
export default class Network {
  constructor({ name, palette, onInit, onJoined, onState, onLeft, onStatus, onConnections, onOffered, onConnected, onChat, onEmote, onThread, onStrandAdded, onStrandReinforced, onStrandRemoved, onPlayerColor, onNestUpsert }) {
    this.connected = false;
    this.selfId = null;
    this.destroyed = false;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.pending = new Map();
    this.identity = { name, palette, pid: getPlayerId() };
    this.callbacks = {
      init: (data) => {
        this.selfId = data.id;
        onInit(data);
      },
      'player:joined': onJoined,
      state: onState,
      'player:left': onLeft,
      connections: onConnections,
      'handshake:offered': onOffered,
      connected: onConnected,
      chat: onChat,
      emote: onEmote,
      thread: onThread,
      'strand:added': onStrandAdded,
      'strand:reinforced': onStrandReinforced,
      'strand:removed': onStrandRemoved,
      'player:color': onPlayerColor,
      'nest:upsert': onNestUpsert
    };
    this.onStatus = onStatus;
    this.connect();
  }

  connect() {
    if (this.destroyed) return;
    const socket = new WebSocket(SERVER_URL);
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (socket !== this.socket || this.destroyed) return;
      this.connected = true;
      this.reconnectAttempt = 0;
      this.send('join', this.identity);
      this.onStatus(true);
    });
    socket.addEventListener('message', (event) => this.receive(event.data));
    socket.addEventListener('close', () => {
      if (socket !== this.socket) return;
      const wasConnected = this.connected;
      this.connected = false;
      this.selfId = null;
      this.rejectPending('offline');
      if (wasConnected) this.onStatus(false);
      this.scheduleReconnect();
    });
    socket.addEventListener('error', () => socket.close());
  }

  scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return;
    const delay = Math.min(10000, 500 * (2 ** this.reconnectAttempt));
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  receive(raw) {
    let frame;
    try {
      frame = JSON.parse(raw);
    } catch {
      return;
    }
    if (!frame || typeof frame.event !== 'string') return;
    if (frame.event === 'ack' && typeof frame.requestId === 'string') {
      const pending = this.pending.get(frame.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(frame.requestId);
      pending.resolve(frame.data);
      return;
    }
    this.callbacks[frame.event]?.(frame.data);
  }

  send(event, data, requestId) {
    if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(requestId ? { event, data, requestId } : { event, data }));
    return true;
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.resolve({ ok: false, error });
    }
    this.pending.clear();
  }

  // Request/response over WebSocket. Resolves the matching ack or a timeout.
  ask(event, payload) {
    return new Promise((resolve) => {
      if (!this.connected) return resolve({ ok: false, error: 'offline' });
      const requestId = crypto.randomUUID();
      const timer = window.setTimeout(() => {
        this.pending.delete(requestId);
        resolve({ ok: false, error: 'timeout' });
      }, 3000);
      this.pending.set(requestId, { resolve, timer });
      if (!this.send(event, payload, requestId)) {
        clearTimeout(timer);
        this.pending.delete(requestId);
        resolve({ ok: false, error: 'offline' });
      }
    });
  }

  setThreadColor(color) {
    return this.ask('color:set', { color });
  }

  setListening(active) {
    return this.ask('listen:set', { active: !!active });
  }

  spinStrand(points) {
    return this.ask('strand:spin', points);
  }

  reinforceStrand(id) {
    return this.ask('strand:reinforce', { id });
  }

  sendEmote(id) {
    this.send('emote', { id });
  }

  // Resolves { ok, delivered } or { ok: false, error }.
  sendChat(text) {
    return this.ask('chat', { text });
  }

  sendState(state) {
    this.send('state', state);
  }

  // Resolves { status: 'offered' | 'connected' | 'rejected' }.
  async sendHandshake(toId) {
    const response = await this.ask('handshake', { to: toId });
    return response?.status ? response : { status: 'rejected' };
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.reconnectTimer);
    this.rejectPending('offline');
    this.socket?.close(1000, 'Scene closed');
  }
}
