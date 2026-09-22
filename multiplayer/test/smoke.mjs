import assert from 'node:assert/strict';
import { loadMap } from '../../shared/level.js';
import { buildNest } from '../../shared/worldWebs.js';

const endpoint = process.argv[2] || 'ws://localhost:8787/ws?room=smoke-test';
const map = loadMap(new URL(endpoint).searchParams.get('map'));
const run = Date.now().toString(36);
const pidA = `smoke-player-a-${run}`;
const pidB = `smoke-player-b-${run}`;

class TestClient {
  constructor(name) {
    this.name = name;
    this.messages = [];
    this.waiters = [];
    this.socket = new WebSocket(endpoint);
    this.socket.addEventListener('message', (event) => {
      const frame = JSON.parse(event.data);
      const match = this.waiters.findIndex((waiter) => waiter.test(frame));
      if (match >= 0) {
        const [waiter] = this.waiters.splice(match, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(frame);
      } else {
        this.messages.push(frame);
      }
    });
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
  }

  send(event, data, requestId) {
    this.socket.send(JSON.stringify(requestId ? { event, data, requestId } : { event, data }));
  }

  waitFor(test, timeout = 5000) {
    const found = this.messages.findIndex(test);
    if (found >= 0) return Promise.resolve(this.messages.splice(found, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { test, resolve, timer: null };
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter((entry) => entry !== waiter);
        reject(new Error(`${this.name} timed out waiting for a frame`));
      }, timeout);
      this.waiters.push(waiter);
    });
  }

  event(name, predicate = () => true, timeout) {
    return this.waitFor((frame) => frame.event === name && predicate(frame.data), timeout);
  }

  async ask(event, data) {
    const requestId = crypto.randomUUID();
    this.send(event, data, requestId);
    return (await this.waitFor((frame) => frame.event === 'ack' && frame.requestId === requestId)).data;
  }
}

const a = new TestClient('A');
await a.open();
a.send('join', { pid: pidA, name: 'A', palette: 'autumn' });
const initA = (await a.event('init')).data;
console.log('stage: first nest assigned');
assert.equal(initA.players.length, 0);
assert.ok(Number.isInteger(initA.home.slot));
assert.ok(initA.nests.some((nest) => nest.slot === initA.home.slot));

const b = new TestClient('B');
await b.open();
b.send('join', { pid: pidB, name: 'B', palette: 'autumn' });
const initB = (await b.event('init')).data;
console.log('stage: second nest assigned');
assert.equal(initB.players.length, 1);
assert.notEqual(initB.home.slot, initA.home.slot);
assert.ok(initB.nests.some((nest) => nest.slot === initA.home.slot));
await a.event('player:joined', (player) => player.id === initB.id);

a.send('state', { x: 100, y: 100, facing: 1, pose: 'idle', rot: 0, anchor: null });
b.send('state', { x: 120, y: 100, facing: -1, pose: 'idle', rot: 0, anchor: null });
await a.event('state', (state) => state.id === initB.id);

assert.equal((await a.ask('handshake', { to: initB.id })).status, 'offered');
assert.equal((await b.ask('handshake', { to: initA.id })).status, 'connected');
await a.event('connected', ({ id }) => id === initB.id);
console.log('stage: social handshake');

const coloredNest = b.event('nest:upsert', (nest) => nest.slot === initA.home.slot && nest.color === 'sky');
assert.equal((await a.ask('color:set', { color: 'sky' })).ok, true);
await coloredNest;
console.log('stage: nest recolored');

const nest = buildNest(map, { ...initA.home, color: 'sky' });
const outer = nest.strands.filter((strand) => strand.id.includes('spoke-')).map((strand) => ({ x: strand.x2, y: strand.y2 }));
await new Promise((resolve) => setTimeout(resolve, 60));
const stateAtNest = b.event('state', (state) => state.id === initA.id && Math.abs(state.x - outer[0].x) < 1);
a.send('state', { x: outer[0].x, y: outer[0].y, facing: 1, pose: 'idle', rot: 0, anchor: null });
await stateAtNest;
const nestSpin = await a.ask('strand:spin', { x1: outer[0].x, y1: outer[0].y, x2: outer[2].x, y2: outer[2].y });
assert.equal(nestSpin.ok, true, JSON.stringify(nestSpin));
const balanceAfterSpin = (await a.event('thread', ({ balance }) => balance < 50)).data.balance;
console.log('stage: expanded from home web');

const chatPromise = b.event('chat', ({ text }) => text === 'hello web');
assert.equal((await a.ask('chat', { text: 'hello web' })).ok, true);
await chatPromise;
console.log('stage: connected chat');

assert.equal((await a.ask('listen:set', { active: true })).ok, true);
const earned = await a.event('thread', ({ balance }) => balance > balanceAfterSpin, 7000);
assert.ok(earned.data.balance > balanceAfterSpin);
console.log('stage: listening credit');

const stuntPose = b.event('state', (state) => state.id === initA.id && state.pose === 'twist');
await new Promise((resolve) => setTimeout(resolve, 60));
a.send('state', { x: outer[0].x, y: outer[0].y, facing: 1, pose: 'twist', rot: 1.2, anchor: null });
assert.equal((await stuntPose).data.pose, 'twist');
console.log('stage: stunt sync');

const aSecondTab = new TestClient('A-second-tab');
await aSecondTab.open();
aSecondTab.send('join', { pid: pidA, name: 'A', palette: 'autumn' });
const initSecondTab = (await aSecondTab.event('init')).data;
assert.equal(initSecondTab.home.slot, initA.home.slot);

a.socket.close();
b.socket.close();
aSecondTab.socket.close();
console.log('multiplayer + durable nest smoke passed');
