import { createRequire } from 'node:module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { io } = require('socket.io-client');

const URL_ = process.argv[2];
if (!URL_) { console.log('usage: node tests/handshake-rules.mjs <server url>'); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client(name, pid, x, y) {
  const s = io(URL_, { transports: ['websocket'] });
  const c = { s, name, connected: [], conns: null };
  s.on('connect', () => s.emit('join', { name, pid }));
  s.on('connected', (d) => c.connected.push(d.id));
  s.on('connections', (d) => { c.conns = d; });
  c.pos = (nx, ny) => s.emit('state', { x: nx, y: ny, facing: 1, pose: 'idle', anchor: null });
  c.hs = (to) => new Promise((res) => s.timeout(3000).emit('handshake', { to }, (e, r) => res(e ? { status: 'timeout' } : r)));
  return c;
}
const results = [];
const check = (label, got, want) => results.push(`${got === want ? 'PASS' : 'FAIL'}  ${label} (got ${got}, want ${want})`);

const A = client('RulesA', 'rulespid-A-000001');
const B = client('RulesB', 'rulespid-B-000001');
const A2 = client('RulesA-twin', 'rulespid-A-000001'); // same player id as A
await sleep(600);

A.pos(100, 500); B.pos(2000, 500); A2.pos(105, 500);
await sleep(200);

check('far away handshake rejected', (await A.hs(B.s.id)).status, 'rejected');
check('unknown target rejected', (await A.hs('nope')).status, 'rejected');
await sleep(450);
check('self handshake rejected', (await A.hs(A.s.id)).status, 'rejected');
await sleep(450);
check('same player id (other tab) rejected', (await A.hs(A2.s.id)).status, 'rejected');
await sleep(450);

B.pos(140, 500);
await sleep(200);
check('nearby offer accepted as offered', (await A.hs(B.s.id)).status, 'offered');
check('spamming offers is rate limited', (await A.hs(B.s.id)).status, 'rejected');
await sleep(450);
check('other side accepting connects', (await B.hs(A.s.id)).status, 'connected');
await sleep(300);
check('A got connected event', A.connected.includes(B.s.id), true);
check('B got connected event', B.connected.includes(A.s.id), true);
check('A sees B online in connections', !!A.conns && A.conns.online.includes(B.s.id), true);
check('A twin (same pid) also sees B', !!A2.conns && A2.conns.online.includes(B.s.id), true);
await sleep(450);
check('already-connected re-handshake reports connected', (await A.hs(B.s.id)).status, 'connected');

console.log(results.join('\n'));
[A, B, A2].forEach((c) => c.s.disconnect());
await sleep(200);
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
