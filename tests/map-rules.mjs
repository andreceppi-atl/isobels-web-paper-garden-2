import { createRequire } from 'node:module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { io } = require('socket.io-client');

const URL_ = process.argv[2];
process.on('uncaughtException', (e) => { console.log('CRASH:', e.message); process.exit(2); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (label, got, want) => results.push(`${JSON.stringify(got) === JSON.stringify(want) ? 'PASS' : 'FAIL'}  ${label}${JSON.stringify(got) === JSON.stringify(want) ? '' : ` (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);

function client(name, pid) {
  const s = io(URL_, { transports: ['websocket'] });
  const c = { s, init: null, added: [], states: [] };
  s.on('connect', () => s.emit('join', { name, pid }));
  s.on('init', (d) => { c.init = d; });
  s.on('strand:added', (x) => c.added.push(x));
  s.on('state', (x) => c.states.push(x));
  c.pos = (x, y, rot) => s.emit('state', { x, y, facing: 1, pose: 'idle', rot, anchor: null });
  const ask = (ev, p) => new Promise((res) => s.timeout(3000).emit(ev, p, (e, r) => res(e ? { ok: false, error: 'timeout' } : r)));
  c.spin = async (x1, y1, x2, y2) => { const r = await ask('strand:spin', { x1, y1, x2, y2 }); await sleep(520); return r; };
  return c;
}

const A = client('Mapper', 'mappid-A-0000001');
const B = client('Watcher', 'mappid-B-0000001');
await sleep(800);
// tower 1: x 520..610, y 1000..1500;  floor 1 top y=1500;  ledge (700,1150,260x40)
A.pos(300, 1486, 0); await sleep(200);

check('map-aware server sends the shared spawn-sized world (init ok)', !!A.init && Array.isArray(A.init.strands), true);

const r1 = await A.spin(300, 1500, 520, 1300);
check('strand from the floor edge to a tower wall is accepted', r1.ok, true);
await sleep(150);
const st = B.added[0];
check('endpoint snapped exactly onto the tower face (x=520)', st && [st.x2, st.y2], [520, 1300]);
check('start snapped onto the floor top (y=1500)', st && st.y1, 1500);

check('strand through the tower is blocked', (await A.spin(300, 1500, 630, 1300)).error, 'blocked');
check('strand into the floor is blocked', (await A.spin(300, 1500, 360, 1560)).error, 'no-node');   // (360,1560) is inside the floor, 60px below the outline: nothing within snap range
const inside = await A.spin(300, 1500, 350, 1520);   // end 20px inside the floor snaps back to the outline
check('a point just inside a solid snaps to its outline (too short here)', inside.error, 'too-short');

// a strand along the wall face itself is fine (lies on the outline)
A.pos(505, 1150, 0); await sleep(200);
const along = await A.spin(520, 1200, 520, 1000);
check('strand lying along a wall face (on the outline) is allowed', along.ok, true);

// ledge underside (700..960, y=1190) to tower right face (x=610): spinner near the start
A.pos(640, 1250, 0); await sleep(200);
const under = await A.spin(610, 1250, 700, 1190);
check('strand from a tower face to a ledge underside/edge is accepted', under.ok, true);

// reach: spinner far from the start point
A.pos(2500, 1486, 0); await sleep(200);
check('spinner far from the start is refused', (await A.spin(300, 1500, 520, 1300)).error, 'too-far');

// rotation is relayed and sanitized
A.pos(505, 1300, -1.57); await sleep(150);
check('rotation is relayed to other players', B.states.some((s) => s.rot === -1.57), true);
A.pos(505, 1300, 99); await sleep(150);
check('absurd rotation is clamped', B.states[B.states.length - 1].rot <= 7, true);
A.s.emit('state', { x: 505, y: 1300, facing: 1, pose: 'idle', rot: 'spin', anchor: null }); await sleep(150);
check('non-numeric rotation becomes 0', B.states[B.states.length - 1].rot, 0);

// world bounds come from the map (4400 wide): x=4300 accepted, x=9000 clamped
A.pos(4300, 1486, 0); await sleep(150);
check('positions inside the 4400px world are kept', B.states[B.states.length - 1].x, 4300);
A.pos(9000, 1486, 0); await sleep(150);
check('positions beyond the world are clamped', B.states[B.states.length - 1].x <= 4600, true);

console.log(results.join('\n'));
[A, B].forEach((c) => c.s.disconnect());
await sleep(200);
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
