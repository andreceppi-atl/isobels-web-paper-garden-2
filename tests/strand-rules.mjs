import { createRequire } from 'node:module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { io } = require('socket.io-client');

const URL_ = process.argv[2];
const MODE = process.argv[3]; // 'rules' | 'expiry' | 'restart'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!['rules', 'expiry', 'restart'].includes(MODE)) { console.log('unknown mode:', MODE); process.exit(2); }
const results = [];
process.on('uncaughtException', (e) => { console.log(results.join('\n')); console.log('CRASH:', e.message); process.exit(2); });
const check = (label, got, want) => results.push(`${JSON.stringify(got) === JSON.stringify(want) ? 'PASS' : 'FAIL'}  ${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

function client(name, pid) {
  const s = io(URL_, { transports: ['websocket'] });
  const c = { s, name, added: [], reinforced: [], removed: [], thread: null, init: null };
  s.on('connect', () => s.emit('join', { name, pid }));
  s.on('init', (d) => { c.init = d; });
  s.on('strand:added', (x) => c.added.push(x));
  s.on('strand:reinforced', (x) => c.reinforced.push(x));
  s.on('strand:removed', (x) => c.removed.push(x));
  s.on('thread', (t) => { c.thread = t; });
  c.pos = (x, y) => s.emit('state', { x, y, facing: 1, pose: 'idle', anchor: null });
  const ask = (ev, payload) => new Promise((res) => s.timeout(3000).emit(ev, payload, (e, r) => res(e ? { ok: false, error: 'timeout' } : r)));
  c.spin = async (x1, y1, x2, y2) => { const r = await ask('strand:spin', { x1, y1, x2, y2 }); await sleep(520); return r; };
  c.spinRaw = async (p) => { const r = await ask('strand:spin', p); await sleep(520); return r; };
  c.reinforce = async (id) => { const r = await ask('strand:reinforce', { id }); await sleep(520); return r; };
  c.listen = (active) => ask('listen:set', { active });
  return c;
}

if (MODE === 'rules') {
  const A = client('SpinA', 'strandpid-A-000001');
  const B = client('Bystander', 'strandpid-B-000001');
  await sleep(700);
  check('joining player gets start thread', A.thread && A.thread.balance, 50);
  check('thread max reported', A.thread && A.thread.max, 100);

  check('no position known yet -> too-far', (await A.spin(300, 1500, 520, 1300)).error, 'too-far');
  A.pos(300, 1486); B.pos(400, 1486); await sleep(200);

  for (const [label, p] of [['null payload', null], ['strings', { x1: 'a', y1: 1, x2: 2, y2: 3 }], ['NaN', { x1: NaN, y1: 1, x2: 2, y2: 3 }], ['missing', { x1: 1 }], ['huge', { x1: 1e9, y1: 1, x2: 2, y2: 3 }]]) {
    check(`rejects ${label}`, (await A.spinRaw(p)).error, 'bad-points');
  }
  check('mid-air points -> no-node', (await A.spin(300, 300, 320, 320)).error, 'no-node');
  check('floor to floor 500px -> too-long', (await A.spin(300, 1500, 800, 1500)).error, 'too-long');
  check('30px strand -> too-short', (await A.spin(100, 1500, 130, 1500)).error, 'too-short');

  const far = client('FarAway', 'strandpid-F-000001'); await sleep(500); far.pos(2500, 1486); await sleep(150);
  check('spinner far from the start point -> too-far', (await far.spin(300, 1500, 520, 1300)).error, 'too-far');

  // approximate aim (a few px off) must snap to the exact anchor + ground
  const r1 = await A.spin(303, 1497, 523, 1303);
  check('valid spin ok', r1.ok, true);
  check('cost = ceil(len/20) = 15', r1.cost, 15);
  await sleep(200);
  check('spinner balance 50 -> 35', A.thread.balance, 35);
  const s1 = B.added[0];
  check('bystander got strand:added', !!s1, true);
  check('start snapped onto the floor outline (y=1500, x kept)', [s1.x1, s1.y1], [303, 1500]);
  check('end snapped onto the tower face (x=520)', s1.x2, 520);
  check('new strand has ~5min ttl', s1.ttl > 290000 && s1.ttl <= 300000, true);

  check('same strand again -> duplicate', (await A.spin(300, 1500, 520, 1300)).error, 'duplicate');

  // connectable: start from the middle of the first strand
  const mx = (s1.x1 + s1.x2) / 2, my = (s1.y1 + s1.y2) / 2;
  const r2 = await A.spin(mx + 2, my - 2, 480, 1500);
  check('strand can start mid-way along another strand', r2.ok, true);
  await sleep(200);
  const s2 = B.added[1];
  const onSeg = Math.abs((s2.x1 - s1.x1) * (s1.y2 - s1.y1) - (s2.y1 - s1.y1) * (s1.x2 - s1.x1)) / Math.hypot(s1.x2 - s1.x1, s1.y2 - s1.y1);
  check('...and its start lies on the first strand (<=0.6px)', onSeg <= 0.6, true);
  check('balance now 35 - cost', A.thread.balance, 35 - r2.cost);

  // reinforce
  check('reinforce unknown id -> gone', (await A.reinforce('nope')).error, 'gone');
  check('reinforce from far away -> too-far', (await far.reinforce(s1.id)).error, 'too-far');
  const before = A.thread.balance;
  const rr = await A.reinforce(s1.id);
  await sleep(150);
  check('reinforce ok, cost ceil(len/40)', [rr.ok, rr.cost], [true, Math.ceil(Math.hypot(s1.x2 - s1.x1, s1.y2 - s1.y1) / 40)]);
  check('reinforce charged the balance', A.thread.balance, before - rr.cost);
  check('bystander told about reinforce', B.reinforced.length === 1 && B.reinforced[0].id === s1.id, true);

  // a newcomer gets the existing strands in init
  const late = client('Late', 'strandpid-L-000001'); await sleep(500);
  check('late joiner receives existing strands', late.init && late.init.strands.length, 2);

  // out of thread: fresh player, 16-cost strands (50 -> 34 -> 18 -> 2 -> denied)
  const E = client('Broke', 'strandpid-E-000001'); await sleep(500); E.pos(320, 1486); await sleep(150);
  const spent = [];
  for (const gy of [1320, 1300, 1280, 1260]) spent.push((await E.spin(320, 1500, 520, gy)).error || 'ok');
  check('spends thread until empty, then no-thread', spent, ['ok', 'ok', 'ok', 'no-thread']);

  // per-player cap: 10 cheap strands ok, 11th refused
  const D = client('Builder', 'strandpid-D-000001'); await sleep(500); D.pos(200, 1486); await sleep(150);
  const cap = [];
  for (let i = 0; i < 11; i++) cap.push((await D.spin(20 + i * 30, 1500, 20 + i * 30 + 70, 1500)).error || 'ok');
  check('10 strands allowed per player, 11th -> limit', cap.filter((x) => x === 'ok').length + '/' + cap[10], '10/limit');

  console.log(results.join('\n'));
  [A, B, far, late, E, D].forEach((c) => c.s.disconnect());
}

if (MODE === 'expiry') {
  const A = client('SpinX', 'strandpid-X-000001');
  const W = client('Watcher', 'strandpid-W-000001');
  await sleep(700);
  A.pos(300, 1486); await sleep(150);
  const r = await A.spin(300, 1500, 520, 1300);
  await sleep(150);
  check('spin ok', r.ok, true);
  const id = W.added[0].id;
  const t0 = Date.now();
  for (let i = 0; i < 40 && W.removed.length === 0; i++) await sleep(100);
  check('watcher told the strand expired', W.removed[0] && W.removed[0].id, id);
  check('expiry took roughly the configured lifetime (1.5s..3.5s)', Date.now() - t0 > 1000 && Date.now() - t0 < 3500, true);
  const late = client('Late2', 'strandpid-M-000001'); await sleep(500);
  check('expired strand is not sent to new joiners', late.init.strands.length, 0);

  // Thread stays still until listening is explicitly active.
  const low = A.thread.balance;
  await sleep(600);
  check('thread stays still while not listening', A.thread.balance, low);
  check('listening can be enabled', (await A.listen(true)).ok, true);
  await sleep(1200);
  check('thread grows while listening', A.thread.balance > low, true);
  for (let i = 0; i < 60 && A.thread.balance < 100; i++) await sleep(200);
  await sleep(600);
  check('trickle stops at the cap of 100', A.thread.balance, 100);
  check('invalid listening state is rejected', (await A.listen('yes')).error, 'bad-listening-state');

  console.log(results.join('\n'));
  [A, W, late].forEach((c) => c.s.disconnect());
}

if (MODE === 'restart') {
  const A = client('Back', 'strandpid-A-000001');
  await sleep(800);
  check('strands survive a server restart', A.init.strands.length >= 2, true);
  check('thread balance survives a server restart (not reset to 50)', A.thread.balance !== 50 && A.thread.balance > 0, true);
  console.log(results.join('\n'), `\n(balance after restart: ${A.thread.balance})`);
  A.s.disconnect();
}

await sleep(250);
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
