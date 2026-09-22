import { createRequire } from 'node:module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { io } = require('socket.io-client');
const s = io(process.argv[2], { transports: ['websocket'], timeout: 10000 });
let init = null, thread = null;
s.on('connect', () => s.emit('join', { name: 'PublicCheck', palette: 'frost' }));
s.on('init', (d) => { init = d; });
s.on('thread', (t) => { thread = t; });
setTimeout(() => {
  console.log(init && Array.isArray(init.strands) && thread && init.color ? `OK: color=${init.color}, strands=${init.strands.length} (colors: ${[...new Set(init.strands.map(s=>s.color))]}), thread event ${JSON.stringify(thread)}` : `FAIL init=${!!init} thread=${JSON.stringify(thread)}`);
  s.disconnect(); process.exit(init && thread ? 0 : 1);
}, 2500);
