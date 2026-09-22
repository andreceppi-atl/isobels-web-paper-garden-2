// Thread colors: a fixed preset list, shared so the client renders them and the
// server can validate against the same allowlist (only the key is ever sent).
// Muted personal inks: the world stays monochrome, while player-made webs keep
// just enough color to be recognizable against the light paper map.
export const THREAD_COLORS = {
  silk: { name: 'Silk', hex: 0x25231f },
  gold: { name: 'Gold', hex: 0x7a5e00 },
  amber: { name: 'Amber', hex: 0x925000 },
  coral: { name: 'Coral', hex: 0xa63c32 },
  ruby: { name: 'Ruby', hex: 0xa82b45 },
  rose: { name: 'Rose', hex: 0x9d3c72 },
  lilac: { name: 'Lilac', hex: 0x76529b },
  violet: { name: 'Violet', hex: 0x5d45a3 },
  sky: { name: 'Sky', hex: 0x356b8c },
  ice: { name: 'Ice', hex: 0x4f7484 },
  mint: { name: 'Mint', hex: 0x3d765b },
  lime: { name: 'Lime', hex: 0x61752b }
};

export const THREAD_COLOR_KEYS = Object.keys(THREAD_COLORS);
export const DEFAULT_THREAD_COLOR = 'silk';

export function isThreadColor(key) {
  return typeof key === 'string' && Object.hasOwn(THREAD_COLORS, key);
}

export function threadHex(key) {
  return THREAD_COLORS[isThreadColor(key) ? key : DEFAULT_THREAD_COLOR].hex;
}
