# Webspun — Handoff

Written 2026-09-20. Read this first, then `PLAN.md` (phase-by-phase design notes and the
locked-core spec). Nothing here needs an account or secret to run locally.

## 1. What this is

A cute pixel-art spider side-scroller with a shared online world, inspired by *Isobel's Web* and
*Webbed*. You swing on webs, climb walls, spin lasting silk strands that other players can walk and
grab, shake hands with other spiders to "connect webs" (which unlocks chat), send emote bubbles, and
recolor your thread. The owner (Andre Ceppi, Atlantic Records) shares it with a friend for playtesting.

**Status: Phases 0-5, lasting threads, thread color, and solid maps / wall climbing / walkable
threads are built, tested and live. Remaining: Phase 6 (custom profiles), Phase 8 (real Thread from
listening time), plus hosting and polish (section 9).**

| Done | What |
|---|---|
| 0-1 | Foundation + web-swing physics (soft rope with slack, momentum-preserving release, speed-driven score) |
| 2 | Shared world: Socket.io, client-authoritative movement broadcast at 20 Hz |
| 3 | Web connections: get near a spider, both press E; stored server-side, survive restarts |
| 4 | Text chat, only between connected spiders who are online; enforced on the server |
| 5 | 10 curated emoji emotes as speech bubbles (server accepts only an index 0-9) |
| 5b | Lasting threads: spin strands between solid edges/strands (costs Thread, lasts 5 min, reinforceable) |
| 7 | Thread color: 12 presets, applied to your swing web and strands |
| 5c | Solid maps (new map "Canopy Ruins"), grapple to any solid edge, wall/underside climbing, walkable threads |

## 2. Run it locally

```bash
npm --prefix client install && npm --prefix server install     # once
npm --prefix server run dev                                     # game server, http://localhost:5182 (watches files)
npm --prefix client run dev                                     # Vite dev client, http://localhost:5181
```

Dev tabs connect to `:5192` by default (see section 4 for why) — either start the server with
`PORT=5192 DATA_DIR=data-dev npm --prefix server run dev`, or open the client with
`?server=http://localhost:5182`. `?map=gaps` (dev only) loads the original practice map.

Run the whole rule-test suite (each test gets its own throwaway server and temp data, never the live data):

```bash
./tests/run-all.sh          # a few minutes; last line says ALL TEST GROUPS PASSED or lists failures
                            # last full run: ALL TEST GROUPS PASSED (171 checks), live data untouched
node shared/check.mjs       # just the geometry/map checks (seconds)
```

## 3. Controls (all confirmed with the owner)

| Input | Effect |
|---|---|
| A/D or arrows | run / steer in the air / steer while swinging |
| Space | jump on the ground; in the air, auto-launch a web (hold to swing, release to let go) |
| Click (hold) | fire a web where you aim; a ring shows where it would land |
| W/S while swinging | reel the web in/out |
| Run into a wall, hold toward it | cling; W/S climb; over the top edge = stand on top; S at a top edge = climb down |
| While clinging | Space kicks off and launches a web; pressing away lets go |
| Land on / press along a thread | walk it (slanted, vertical, underside); junctions and strand ends hand you to the next thing |
| On a thread | Space jumps, S drops through shallow threads |
| Shift (hold) + click | preview + spin a lasting strand from where you hang/stand/cling; cost shown |
| F | auto-spin toward the nearest node/solid edge in your facing direction |
| R | reinforce the nearest strand (resets its 5 min timer for half price) |
| E | offer/accept a handshake (within 90 px) |
| Enter | focus chat (Enter sends, Esc cancels) |
| 1-0 or the buttons | emotes |
| C or the swatch button | thread color |

## 4. Operations runbook (IMPORTANT)

There are two server setups so development can never disturb the live world:

| | Live | Dev |
|---|---|---|
| Preview config (`.claude/launch.json`) | `webspun-live` | `webspun` (Vite :5181) + `webspun-dev-server` (:5192) |
| Command | `npm start` — **no file watching** | `node --watch` |
| Port / data | `:5182`, `server/data/` | `:5192`, `server/data-dev/` |
| Serves | `client/dist` (read from disk on every request) | — |

- **The live server keeps running old code until restarted.** To deploy: `npm --prefix client run build`, then restart `webspun-live`. Note that building alone already changes what players download, so build and restart together.
- **Never wipe or test against `server/data/`.** It holds real players' web connections (`connections.json`), thread balances (`thread.json`), strands (`strands.json`, stamped with the map id; a file from another map is discarded on load) and colors (`prefs.json`). It has been edited surgically before (remove only test pids).
- **Public link:** the owner's friend plays through a free `localhost.run` SSH tunnel to `:5182`. It is flaky: it dies with "tunnel inactivity timeout" (SSH exit 255), and the service also **reassigns the public address by itself while the SSH process keeps running** (the old address then returns 503). Whenever the owner's friend reports a dead link, read the newest address from the tunnel's output and tell the owner. Commands:
  ```bash
  # open the tunnel (run in the background; its output contains the https://<id>.lhr.life address)
  ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -R 80:localhost:5182 nokey@localhost.run > tunnel.log &
  # keep it warm every 45 s, always pinging the NEWEST address in the log
  while pgrep -f "R 80:localhost:5182" >/dev/null; do U=$(grep -aoE "https://[a-z0-9]+\.lhr\.life" tunnel.log | tail -1); curl -s -m 10 -o /dev/null "$U/healthz"; sleep 45; done
  # verify an address end to end (page + socket join)
  node tests/smoke.mjs https://<id>.lhr.life
  ```
  Last known address: `https://14e13915a84fa9.lhr.life` (almost certainly stale by the time you read this). This is a stopgap; the durable answer is real hosting (section 9). In Claude Code the auto-mode classifier blocked opening the tunnel until the owner explicitly asked in chat.
- **PENDING CLEANUP of the live data (do at the next live restart).** An earlier version of two test scripts (`handshake-rules`, `chat-rules`) had `http://localhost:5182` hardcoded and ran against the *live* server, leaving fake entries in `server/data`: the connection pairs `rulespid-A-000001`/`rulespid-B-000001` and `chatpid-A-0000001`/`chatpid-B-0000001` in `connections.json`, and balances for `rulespid-*` and `chatpid-*` in `thread.json`. They are harmless (no real player has those ids) but should go. The scripts are fixed (every test now takes the server URL as its first argument and `run-all.sh` only uses throwaway servers; a checksum of `server/data` before/after a full run is identical). To clean: stop `webspun-live`, delete those pids from the two files, start it again — editing the files while the server runs is pointless because it rewrites them from memory. Two real players were online when this was found, so it was not restarted.
- **Rollback:** `webspun-backup-before-walls.tar.gz` (next to this folder) is the project before the map/wall work (no node_modules/dist). There is no git repo.

## 5. Architecture map

```
shared/                  used by BOTH sides so they always agree
  level.js               map registry: MAPS = { canopy, gaps }, loadMap(id)
  maps/canopy.js gaps.js solids [{x,y,w,h,kind}], spawn, nest, optional floating anchors
  geometry.js            rect outlines, ray casts, contacts, segment-vs-solid
  webs.js                strand rules (length, cost, caps), snapPoint(), strandBlocked()
  colors.js              12 thread colors + allowlist
  check.mjs              geometry + map validity checks
server/src/
  index.js               sockets, validation, rate limits, connections/handshake/chat/emote/color/strand handlers
  strands.js             strand store + spin validation + persistence
  economy.js             Thread balances (trickle() is the Phase-8 stub)
  prefs.js               per-player thread color
client/src/
  main.js map.js         Phaser config; active map (dev ?map= override)
  scenes/BootScene.js    title + controls text
  scenes/WorldScene.js   the game: level build, per-frame update, input, network wiring
  entities/              Spider (local physics), RemoteSpider, StrandField (draw/query strands), ChatBubble, spiderArt (poses/palettes)
  systems/Crawl.js       wall/underside/thread walking (kinematic, gravity off while attached)
  systems/Targeting.js   where a web shot lands (rays vs solid outlines, strands, anchors)
  systems/SpinTool.js    Shift-preview / spin / F / R
  net/Network.js         socket wrapper (+ stable per-browser player id in localStorage)
  ui/                    ChatUi, EmoteBar, ColorPicker (DOM overlays), emotes.js
tests/                   rule tests + run-all.sh, smoke.mjs (public-link check)
render.yaml              Render blueprint (not used yet)
```

Socket protocol (client → server): `join {name,palette,pid}`, `state {x,y,facing,pose,rot,anchor}`, `handshake {to}`, `chat {text}`, `emote {id}`, `strand:spin {x1,y1,x2,y2}`, `strand:reinforce {id}`, `color:set {color}`.
Server → client: `init {id,color,players,strands}`, `player:joined/left`, `state`, `connections {online,total}`, `handshake:offered`, `connected`, `chat`, `emote`, `thread {balance,max}`, `strand:added/reinforced/removed`, `player:color`. Request/response events use socket.io acks (`{ok,...}` / `{ok:false,error}`).

## 6. Rules and constants worth knowing

- **Thread:** start 50, max 100, stand-in income +1 per 3 s online (`economy.trickle`). Spin cost `ceil(len/20)`; reinforce `ceil(len/40)`.
- **Strands:** length 60-400, snap radius 28, 5 min lifetime, 10 per player / 150 total, spinner must be within 340 px of the start point, may not pass through a solid, no duplicates.
- **Handshake:** client prompt at 90 px, server re-checks at 170 px, offer lasts 8 s. **Chat:** 140 chars, control chars stripped, 400 ms between messages, 8 per 10 s. **Emotes:** 700 ms cooldown, everyone in the world sees them (`EMOTE_SCOPE=connected` limits to web-connected spiders).
- **Swing feel (locked by the owner):** rope stiffness 0.32, damping 0.16, slack when inside rope length, release preserves exact momentum, air steering is a *force* (never a velocity clamp), run speed 4.5, jump −11. Verified identical on the `gaps` map after the geometry change.
- **Map rules (checked by `check.mjs`):** solids never overlap and stay ≥ 60 px apart, except a tower may stand on a floor. Every solid outline is a grapple/attach point.

## 7. Design decisions and gotchas

- **Client-authoritative movement.** Each client simulates its own physics and broadcasts state; the server clamps bounds/rates and validates the *rules* (strands, chat, thread) but a modified client can teleport. Fine for a friends-scale game; revisit if strangers/competition matter.
- **Identity is a random per-browser id (`pid`) in localStorage.** It is never sent to other players, only used to remember connections/thread/colors. Anyone who copies another browser's id can pose as them, and clearing site data resets everything. Real accounts (Phase 8) replace this.
- **Ground/wall contact comes from map geometry, not Matter collision events** (events cannot tell a floor from a wall). `circleContacts()` classifies by contact normal each frame. This is why solids must be axis-aligned rectangles.
- **Crawling is kinematic:** while attached the spider is placed on the surface every frame with `body.ignoreGravity = true`; a 300 ms re-attach cooldown stops instant re-sticking. Concave corners between two different solids are not handled (movement just stops), which is why the map keeps solids apart.
- **Hidden browser pane throttles to ~1 fps.** To test movement, pause the loop (`game.loop.sleep()`) and drive frames with `game.step(t, 16.67)` from JS. The harness used during development was a small `window.H` helper (key down/up, `step(n)`, `until(fn)`, `tp(x,y)`); rebuild it if needed. In dev, `window.__game` is exposed (dev only).
- **Vite HMR reloads the page on most edits**, resetting any injected test harness.
- The one-off `?server=` and `?map=` overrides work in dev builds only.

## 8. Known limitations / untested

- Movement was verified by stepping the real game loop, not with a human on a keyboard. **A hands-on playtest is the next real signal** on climb speed, how easily you stick, and whether Canopy Ruins' gaps need webs (its layout is hand-designed and not proven playable).
- Thread income is a placeholder; balances live in JSON files (fine for now; see hosting note in section 9).
- No block/mute/report yet, no name filtering. Chat is limited to connected pairs, which keeps exposure small.
- No walk animation beyond a two-pose alternate; art is the procedural "Isobel's Web" rig. Nest is a placeholder box.
- Two tabs of one browser share a `pid` (handshakes between them are rejected by design).

## 9. Remaining work

### Phase 6 — Custom pixel-art profiles (Tumblr-style)
Goal: each player has a profile page they build themselves with HTML/CSS, viewable by others.
Suggested approach (security is the whole difficulty):
1. **Store** `{html, css, updatedAt}` per durable player id server-side (`profiles.json` now, DB later); cap size (~20 KB).
2. **Sanitize on the server** with an allowlist (e.g. `sanitize-html`): no `<script>`, no event handlers, no `javascript:` URLs, no `<iframe>/<object>/<embed>/<form>/<meta>/<base>/<link>`, no `@import`, no `expression()`, `url()` only for `data:` images (or an allowlisted host), no external requests (tracking pixels leak viewers' IPs).
3. **Render in a sandboxed iframe** (`sandbox=""` + `srcdoc` + a strict CSP meta: `default-src 'none'; style-src 'unsafe-inline'; img-src data:`), never inject profile HTML into the game page.
4. **Never expose the private `pid`:** viewers request a profile by the target's *socket id* (`profile:get {to}`), the server resolves it privately.
5. UI: open by clicking a spider (or a "my profile" button); editor with a starter template and live preview; decide whether profiles are public or connected-only (owner decision).
6. Tests: an XSS payload suite (script tags, `onerror`, `javascript:` hrefs, SVG scripts, CSS `@import`/`url()`, meta refresh, `<base>`, iframe nesting) that must all be neutralized; size-limit and rate-limit tests.
Image uploads are out of scope for the first version (pixel art via CSS/data URIs first).

### Phase 8 — Real Thread from listening time (and real accounts)
The Thread economy already isolates its source: replace **`economy.trickle()`** in `server/src/economy.js`; everything that spends Thread (`spend/get`) stays the same. Plan (from the owner's original spec):
1. **Accounts first.** Recommended: "Log in with Discord" (needed for the Discord path anyway) as the durable identity; let a logged-in user *claim* their existing `pid` once so connections/thread/colors migrate. Then retire pid-only trust.
2. **One listening source per account for v1** (no double counting): either
   - **Spotify OAuth** (Authorization Code + PKCE, scope `user-read-recently-played`): poll recently-played per user, advance a cursor (`after`), credit listened time. Note recently-played gives `played_at` + track, not exact listened duration (skips are invisible), so credit is approximate. **Spotify apps in development mode are limited to ~25 allowlisted users** until extended quota is granted — a real constraint for a public launch; or
   - **Discord presence bot** in the community server: needs the privileged **Presence Intent** enabled, members must have Spotify linked and "Display Spotify as your status" on; count time while a Listening/Spotify activity is present (pauses are only approximately detectable).
3. Decide the conversion rate (e.g. 1 Thread per N minutes), whether the 100 cap stays, and anti-abuse (looping idle music). Store only minutes, not track history, and add an explicit consent screen.
4. Move JSON persistence to a database at this point (Postgres).
5. Tests with a mocked provider; keep the trickle behind a flag for local dev.

### Hosting (needs an owner decision)
The free SSH tunnel drops constantly. `render.yaml` is a ready blueprint (one Node service serves the client and the socket on one origin). Blockers/decisions:
- **Which GitHub account?** `gh` on the owner's machine is logged in as `andreceppi-atl` (looks like an Atlantic account). Ask before creating a repo; use a private repo. The owner signs in to Render and clicks New → Blueprint themself.
- **Render's free tier has an ephemeral disk and sleeps when idle** — the JSON files in `server/data` would be wiped on redeploy/sleep. Use a persistent disk or move to a database *before* real players rely on saved connections/thread.
- Set `CLIENT_ORIGINS` if the client is ever served from a different origin.

### Other open items (unscheduled)
- Per-player nests (the connection thread is meant to eventually run between nests, not spiders).
- Real pixel art to replace the procedural rig and nest placeholder (the owner supplies files into `client/public/`; chat-pasted images cannot be read from disk).
- Touch/mobile controls, sound, parallax/background polish, more maps or map selection.
- Moderation tools (block/mute/report), IP-based rate limits, `git init` + a proper repo.
- Tuning pass on climb/cling feel after the owner's playtest.

## 10. Questions for the owner
1. Which GitHub account for the permanent host (and OK to pay for a persistent disk / DB)?
2. Profiles: visible to everyone, or only to connected spiders?
3. Emotes: keep them visible to strangers, or restrict to connected spiders?
4. Discord or Spotify as the first Thread source, and roughly what listening rate should equal one Thread?
