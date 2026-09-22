import { createRequire } from 'node:module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { io } = require('socket.io-client');

const URL_ = process.argv[2];
if (!URL_) { console.log('usage: node tests/chat-rules.mjs <server url>'); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client(name, pid) {
  const s = io(URL_, { transports: ['websocket'] });
  const c = { s, name, inbox: [] };
  s.on('connect', () => s.emit('join', { name, pid }));
  s.on('chat', (m) => c.inbox.push(m));
  c.pos = (x, y) => s.emit('state', { x, y, facing: 1, pose: 'idle', anchor: null });
  c.hs = (to) => new Promise((res) => s.timeout(3000).emit('handshake', { to }, (e, r) => res(e ? { status: 'timeout' } : r)));
  c.chat = (text) => new Promise((res) => s.timeout(3000).emit('chat', { text }, (e, r) => res(e ? { ok: false, error: 'timeout' } : r)));
  c.chatRaw = (payload) => new Promise((res) => s.timeout(3000).emit('chat', payload, (e, r) => res(e ? { ok: false, error: 'timeout' } : r)));
  return c;
}
const results = [];
const check = (label, got, want) => results.push(`${got === want ? 'PASS' : 'FAIL'}  ${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const A = client('ChatA', 'chatpid-A-0000001');
const B = client('ChatB', 'chatpid-B-0000001');
const C = client('ChatC', 'chatpid-C-0000001'); // never connected to anyone
await sleep(600);
A.pos(100, 500); B.pos(130, 500); C.pos(160, 500);
await sleep(200);

check('unconnected player cannot chat', (await C.chat('hi')).error, 'no-web');
check('A cannot chat before connecting', (await A.chat('hi')).error, 'no-web');
await sleep(450);

await A.hs(B.s.id); await sleep(450); await B.hs(A.s.id); await sleep(300);

const r1 = await A.chat('  hello   there friend  ');
check('connected A can chat', r1.ok, true);
check('delivered to exactly 1 partner', r1.delivered, 1);
await sleep(200);
check('B received cleaned text', B.inbox[0] && B.inbox[0].text, 'hello there friend');
check('B sees sender name', B.inbox[0] && B.inbox[0].name, 'ChatA');
check('B sees sender socket id', B.inbox[0] && B.inbox[0].from, A.s.id);
check('C (unconnected, nearby) received nothing', C.inbox.length, 0);
check('sender does not get own echo from server', A.inbox.length, 0);

await sleep(450);
await A.chat('x'.repeat(500));
await sleep(200);
check('long message truncated to 140', B.inbox[1] && B.inbox[1].text.length, 140);

await sleep(450);
check('non-string rejected', (await A.chatRaw({ text: { a: 1 } })).error, 'empty');
await sleep(450);
check('missing payload rejected', (await A.chatRaw(null)).error, 'empty');
await sleep(450);
check('whitespace-only rejected', (await A.chat('   \n\t ')).error, 'empty');

await sleep(450);
check('B can reply to A', (await B.chat('hey back')).ok, true);
await sleep(200);
check('A received the reply', A.inbox[0] && A.inbox[0].text, 'hey back');

await sleep(450);
const t0 = await A.chat('m1'); const t1 = await A.chat('m2');
check('rapid second message throttled', t1.error, 'slow-down');

// flood: window limit (8 per 10s) — spaced just past the min interval
await sleep(10500);
const flood = [];
for (let i = 0; i < 12; i++) { flood.push((await A.chat(`f${i}`)).ok); await sleep(420); }
check('flood limited to 8 per window', flood.filter(Boolean).length, 8);

console.log(results.join('\n'));
[A, B, C].forEach((c) => c.s.disconnect());
await sleep(200);
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
