// Fixed emote set. The network only ever carries the index, never the emoji.
// Keep the count in sync with EMOTE_COUNT in server/src/index.js.
export const EMOTES = [
  { emoji: 'HI', label: 'wave', pose: 'wave' },
  { emoji: '♡', label: 'love' },
  { emoji: 'HA', label: 'laugh' },
  { emoji: '!', label: 'wow' },
  { emoji: '…', label: 'sad' },
  { emoji: '#', label: 'grr' },
  { emoji: '+', label: 'nice' },
  { emoji: '✦', label: 'sparkle' },
  { emoji: '♫', label: 'music' },
  { emoji: '↑', label: 'fire' }
];

// Keys 1-9 then 0, like the number row.
export function emoteKeyLabel(index) {
  return index === 9 ? '0' : String(index + 1);
}

export function emoteIndexForKeyCode(code) {
  const m = /^Digit(\d)$/.exec(code || '');
  if (!m) return -1;
  const n = Number(m[1]);
  const index = n === 0 ? 9 : n - 1;
  return index < EMOTES.length ? index : -1;
}
