import fs from 'node:fs';
import path from 'node:path';

export const THREAD = { START: 50, MAX: 100 };

// Server-authoritative Thread balances, keyed by the durable player id.
// Anonymous (no durable id) players keep an in-memory balance for the session.
export function createEconomy({ dataDir, isDurable }) {
  const file = path.join(dataDir, 'thread.json');
  const balances = new Map();

  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [pid, value] of Object.entries(raw.balances || {})) {
      if (isDurable(pid) && Number.isFinite(value)) balances.set(pid, Math.max(0, Math.min(THREAD.MAX, Math.floor(value))));
    }
  } catch {
    // first run or unreadable file: everyone starts fresh
  }

  let timer = null;
  function saveSoon() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      try {
        const out = {};
        for (const [pid, value] of balances) if (isDurable(pid)) out[pid] = value;
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(`${file}.tmp`, JSON.stringify({ balances: out }));
        fs.renameSync(`${file}.tmp`, file);
      } catch (err) {
        console.error('could not save thread balances:', err.message);
      }
    }, 5000);
  }

  function get(pid) {
    if (!balances.has(pid)) balances.set(pid, THREAD.START);
    return balances.get(pid);
  }

  function spend(pid, amount) {
    const balance = get(pid);
    if (balance < amount) return false;
    balances.set(pid, balance - amount);
    saveSoon();
    return true;
  }

  // STUB SOURCE: the server supplies only pids with an active listening
  // session. Phase 8 replaces that client signal with a verified provider;
  // everything that spends Thread stays exactly the same.
  function trickle(listeningPids) {
    const changed = [];
    for (const pid of listeningPids) {
      const balance = get(pid);
      if (balance < THREAD.MAX) {
        balances.set(pid, balance + 1);
        changed.push(pid);
      }
    }
    if (changed.length) saveSoon();
    return changed;
  }

  return { get, spend, trickle, max: THREAD.MAX };
}
