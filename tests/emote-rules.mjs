import { createRequire } from 'node:module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { io } = require('socket.io-client');

const URL_ = process.argv[2];
const SCOPE = process.argv[3]; // 'everyone' | 'connected'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client(name, pid) {
  const s = io(URL_, { transports: ['websocket'] });
  const c = { s, inbox: [] };
  s.on('connect', () => s.emit('join', { name, pid }));
  s.on('emote', (m) => c.inbox.push(m));
  c.pos = (x, y) => s.emit('state', { x, y, facing: 1, pose: 'idle', anchor: null });
  c.hs = (to) => new Promise((res) => s.timeout(3000).emit('handshake', { to }, (e, r) => res(e ? { status: 'timeout' } : r)));
  c.emote = (payload) => new Promise((res) => s.timeout(3000).emit('emote', payload, (e, r) => res(e ? { ok: false, error: 'timeout' } : r)));
  return c;
}
if (!['everyone', 'connected'].includes(SCOPE)) { console.log('unknown scope:', SCOPE); process.exit(2); }
const results = [];
const check = (label, got, want) => results.push(`${got === want ? 'PASS' : 'FAIL'}  ${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const A = client('EmoA', 'emopid-A-00000001');
const B = client('EmoB', 'emopid-B-00000001');
const C = client('EmoC', 'emopid-C-00000001');
await sleep(600);
A.pos(100, 500); B.pos(130, 500); C.pos(160, 500);
await sleep(200);
await A.hs(B.s.id); await sleep(450); await B.hs(A.s.id); await sleep(300); // A and B connected, C is a stranger

check('valid emote accepted', (await A.emote({ id: 3 })).ok, true);
await sleep(200);
check('connected partner B got it', B.inbox.length === 1 && B.inbox[0].id === 3 && B.inbox[0].from === A.s.id, true);
check(`stranger C ${SCOPE === 'everyone' ? 'also' : 'does NOT'} get it`, C.inbox.length, SCOPE === 'everyone' ? 1 : 0);
check('sender gets no echo', A.inbox.length, 0);

await sleep(200);
check('too-fast second emote throttled', (await A.emote({ id: 4 })).error, 'slow-down');
for (const [label, payload] of [['id -1', { id: -1 }], ['id 10 (out of range)', { id: 10 }], ['id 1.5', { id: 1.5 }], ["id '3' (string)", { id: '3' }], ['null payload', null], ['raw emoji string', { id: '👋' }], ['no id', {}]]) {
  await sleep(750);
  check(`rejects ${label}`, (await A.emote(payload)).error, 'bad-emote');
}
await sleep(750);
check('0 and 9 (range edges) accepted', [(await A.emote({ id: 0 })).ok, (await (async () => { await sleep(750); return A.emote({ id: 9 }); })()).ok].join(), 'true,true');

console.log(results.join('\n'));
[A, B, C].forEach((c) => c.s.disconnect());
await sleep(200);
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
