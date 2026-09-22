import { createRequire } from 'node:module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { io } = require('socket.io-client');

const URL_ = process.argv[2];
const MODE = process.argv[3];
process.on('uncaughtException', (e) => { console.log('CRASH:', e.message); process.exit(2); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!['rules', 'restart'].includes(MODE)) { console.log('unknown mode:', MODE); process.exit(2); }
const results = [];
const check = (label, got, want) => results.push(`${JSON.stringify(got) === JSON.stringify(want) ? 'PASS' : 'FAIL'}  ${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

function client(name, pid) {
  const s = io(URL_, { transports: ['websocket'] });
  const c = { s, name, init: null, colorEvents: [], added: [] };
  s.on('connect', () => s.emit('join', { name, pid }));
  s.on('init', (d) => { c.init = d; });
  s.on('player:color', (e) => c.colorEvents.push(e));
  s.on('strand:added', (x) => c.added.push(x));
  c.pos = (x, y) => s.emit('state', { x, y, facing: 1, pose: 'idle', anchor: null });
  const ask = (ev, payload) => new Promise((res) => s.timeout(3000).emit(ev, payload, (e, r) => res(e ? { ok: false, error: 'timeout' } : r)));
  c.setColor = async (color) => { const r = await ask('color:set', { color }); await sleep(350); return r; };
  c.setRaw = async (payload) => { const r = await ask('color:set', payload); await sleep(350); return r; };
  c.spin = async (x1, y1, x2, y2) => { const r = await ask('strand:spin', { x1, y1, x2, y2 }); await sleep(520); return r; };
  return c;
}

if (MODE === 'rules') {
  const A = client('PainterA', 'colorpid-A-000001');
  const B = client('WatcherB', 'colorpid-B-000001');
  await sleep(700);
  check('new player starts with the default color', A.init.color, 'silk');

  const r = await A.setColor('coral');
  check('valid color accepted', [r.ok, r.color], [true, 'coral']);
  await sleep(150);
  check('other players are told (with the spider id)', B.colorEvents.some((e) => e.id === A.s.id && e.color === 'coral'), true);
  check('the painter is told too', A.colorEvents.some((e) => e.id === A.s.id && e.color === 'coral'), true);

  for (const [label, val] of [['unknown name', 'neon'], ['empty string', ''], ['null', null], ['number', 123], ['object', { a: 1 }], ['array', ['coral']], ['__proto__', '__proto__'], ['constructor', 'constructor'], ['toString', 'toString'], ['hasOwnProperty', 'hasOwnProperty'], ['hex string', '#ff0000'], ['css injection', 'red;}body{display:none']]) {
    check(`rejects ${label}`, (await A.setRaw({ color: val })).error, 'bad-color');
  }
  check('rejects missing payload', (await A.setRaw(null)).error, 'bad-color');
  check('color unchanged by all the bad attempts', B.colorEvents.filter((e) => e.color !== 'coral').length, 0);

  const q1 = await A.s.timeout(3000).emitWithAck ? null : null; // (placeholder to keep structure simple)
  const t1 = await new Promise((res) => A.s.timeout(3000).emit('color:set', { color: 'sky' }, (e, x) => res(x)));
  const t2 = await new Promise((res) => A.s.timeout(3000).emit('color:set', { color: 'mint' }, (e, x) => res(x)));
  await sleep(350);
  check('rapid second change throttled', [t1.ok, t2.error], [true, 'slow-down']);

  // a late joiner sees existing players' colors
  const late = client('LateC', 'colorpid-C-000001'); await sleep(600);
  const seenA = late.init.players.find((p) => p.name === 'PainterA');
  check('late joiner sees the painter\'s current color', seenA && seenA.color, 'sky');

  // same player, second tab: both spiders repainted together
  const A2 = client('PainterA-tab2', 'colorpid-A-000001'); await sleep(600);
  check('second tab of the same player starts with their saved color', A2.init.color, 'sky');
  await A.setColor('lilac'); await sleep(150);
  check('both tabs are repainted', A2.colorEvents.filter((e) => e.color === 'lilac').map((e) => e.id).sort(), [A.s.id, A2.s.id].sort());

  // strands are painted with the spinner's color at the moment they are spun
  A.pos(300, 1486); B.pos(400, 1486); await sleep(200);
  await A.setColor('coral');
  const s1 = await A.spin(300, 1500, 520, 1300);
  check('spin ok', s1.ok, true);
  await sleep(150);
  check('new strand carries the spinner\'s color', B.added[0] && B.added[0].color, 'coral');
  await A.setColor('mint');
  const s2 = await A.spin(300, 1500, 520, 1240); check('second spin ok', s2.ok, true);
  await sleep(150);
  check('second strand carries the new color', B.added[1] && B.added[1].color, 'mint');
  const late2 = client('LateD', 'colorpid-D-000001'); await sleep(600);
  check('the first strand kept its old color (not recolored)', late2.init.strands.map((s) => s.color).sort(), ['coral', 'mint']);

  console.log(results.join('\n'));
  [A, B, late, A2, late2].forEach((c) => c.s.disconnect());
}

if (MODE === 'restart') {
  const A = client('PainterA', 'colorpid-A-000001');
  await sleep(800);
  check('saved color survives a server restart', A.init.color, 'mint');
  const colors = Object.fromEntries(A.init.strands.map((s) => [s.id, s.color]));
  check('strand colors survive a restart', Object.values(colors).sort(), ['coral', 'mint', 'silk', 'silk']);
  console.log(results.join('\n'));
  A.s.disconnect();
}

await sleep(250);
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
