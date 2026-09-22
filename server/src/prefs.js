import fs from 'node:fs';
import path from 'node:path';
import { isThreadColor } from '../../shared/colors.js';

// Per-player cosmetic preferences (thread color for now), keyed by the durable
// player id. Anonymous players keep theirs in memory for the session only.
export function createPrefs({ dataDir, isDurable }) {
  const file = path.join(dataDir, 'prefs.json');
  const prefs = new Map();

  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [pid, p] of Object.entries(raw.prefs || {})) {
      if (isDurable(pid) && p && isThreadColor(p.threadColor)) prefs.set(pid, { threadColor: p.threadColor });
    }
  } catch {
    // first run or unreadable file: everyone gets the default
  }

  let timer = null;
  function saveSoon() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const out = {};
        for (const [pid, p] of prefs) if (isDurable(pid)) out[pid] = p;
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(`${file}.tmp`, JSON.stringify({ prefs: out }));
        fs.renameSync(`${file}.tmp`, file);
      } catch (err) {
        console.error('could not save prefs:', err.message);
      }
    }, 1000);
  }

  return {
    threadColor: (pid) => (prefs.get(pid) || {}).threadColor || null,
    setThreadColor(pid, color) {
      prefs.set(pid, { ...(prefs.get(pid) || {}), threadColor: color });
      saveSoon();
    },
    forget(pid) {
      if (!isDurable(pid)) prefs.delete(pid);
    }
  };
}
