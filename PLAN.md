# Webspun — Plan

> Current state, operations runbook, architecture and remaining work: see **HANDOFF.md**.

A cute pixel-art side-scroller. You're a spider, you swing on webs (Webbed-inspired),
you earn Thread from your Spotify listening, and you can't chat with another
spider until your webs connect (walk/swing over, shake hands).

Working name only — rename anytime.

## Core mechanics
- Side-scrolling level, web-swing traversal (aim, fire web to an anchor point, swing, release)
- Nest: starter home per user, placeholder art for now, real functions built first
- Thread: currency earned from listening time (see Phase 8 — deferred)
- Web connection: two spiders must meet + mutually "shake hands" before they can chat
- Emotes: emoji -> cartoon speech bubble over sprite (later)
- Profiles: self-editable, Tumblr-style custom HTML/CSS pages (later)
- Thread color: cosmetic customization of your web/thread line (later)

## Stack
- Client: Phaser 3 (Matter.js physics for swing) + Vite
- Server (from Phase 2 on): Node + Socket.io for realtime presence/position sync
- DB (from Phase 8 on): Postgres for users/nests/connections/profiles

## Locked core (the "stone tablet" — do not change without asking)
Phases 0-1 are signed off. Later phases build on these, not around them (Phase 5c changed HOW ground/wall
contact is detected - geometry instead of collision events - but the feel was re-verified and is identical):
- Swing feel: soft rope (stiffness 0.32, damping 0.16) with real slack; rope only
  pulls taut at full extension. W/S climbs the web. Release preserves full momentum
  (air steering is a force, never a velocity clamp).
- Controls: A/D run, Space jumps on ground / auto-launches in air (hold to swing,
  release to let go), or hold click aimed at an anchor. W/S climb.
- Scoring: speed-driven (fire + release), chain multiplier grows slowly (+12%/link).
- Art: "Isobel's Web" rig in `client/src/entities/spiderArt.js` (poses idle/swing/
  leap/wave, 9 palettes). Reference: claude.ai artifact TuF7opBtT57beX7dtkwyhB.

## Deploy
One service: `server/` serves the built client (`client/dist`) and the socket on
the same origin. Build: `npm --prefix client install && npm --prefix client run build
&& npm --prefix server install`. Run: `npm --prefix server start` (reads `PORT`).
`render.yaml` is a Render blueprint. Free hosts sleep when idle (slow first load).

## Phases

- [x] **Phase 0 — Foundation.** Project scaffold, simple name-entry "login" (no
      real accounts yet), nest placeholder, side-scroll level skeleton.
- [x] **Phase 1 — Swing prototype (solo).** One spider, one level, web-swing feel
      nailed: aim, fire, swing, release, land. No networking.
- [x] **Phase 2 — Shared level + multiplayer sync.** Other players' spiders appear
      and swing around the same level in real time (Node + Socket.io).
      Client-authoritative: each client runs its own physics and broadcasts
      position/pose/facing/web anchor at 20Hz; server validates + relays.
      Server: `server/` (port 5182). Client falls back to solo if it's down.
- [x] **Phase 3 — Web connections (handshake).** Get within 90px of another spider,
      press E; they press E to accept (8s window) -> connected: both wave, gold name
      tag, silk thread drawn between the two spiders. Server re-checks range, rate-
      limits, and stores connections by a per-browser id (`server/data/connections.json`,
      survives restarts). No accounts yet, so that id is only as trustworthy as
      localStorage - Phase 8 replaces it with real auth. Thread currently links the
      spiders themselves; it moves to per-player nests once nests exist.
- [x] **Phase 4 — Chat.** Enter to chat; text goes only to web-connected spiders who are
      online, enforced server-side (140 chars, control chars stripped, throttled + 8 msgs/10s).
      Shows as an overhead speech bubble plus a fading log. Rendered as text, never HTML.
      Bubble component (`ChatBubble.js`) is reused for Phase 5 emotes.
- [x] **Phase 5 — Emotes.** 10 curated emoji (keys 1-0 or the bar, bottom-right) -> cartoon bubble
      over the spider; 👋 also plays the wave pose. Network carries only an index 0-9
      (server rejects anything else), 800ms client / 700ms server cooldown. Visible to
      everyone in the world by default; `EMOTE_SCOPE=connected` limits to web-connected
      spiders (both modes tested).
- [x] **Phase 5b — Lasting threads (thread-consuming webs).** Shift (hold) previews, Shift+click
      spins a lasting strand from the anchor you hang from (or the ground you stand on) to an
      anchor / another strand / the ground; F auto-spins toward your facing direction; R
      reinforces the nearest strand. Cost = ceil(length/20) thread up front; strands last 5 min
      (thin + blink when nearly gone); reinforcing resets the timer for half price and anyone can
      reinforce anyone's strand. Any point on a strand is grabbable with the normal web shot, and
      new strands can start mid-strand, so webs connect into networks. Server-authoritative:
      re-snaps endpoints, checks length 60-400, reach, 10/player + 150 total caps, no duplicates,
      thread balance; persists strands + balances (`server/data/strands.json`, `thread.json`).
      Shared rules/level live in `shared/` (client preview + server validation use the same code).
      Thread income is a STAND-IN (+1 per 3s online, cap 100, start 50) until Phase 8's real
      listening time. Not built: walking/running ON strands (they are swing-grab only for now).
- [x] **Phase 5c — Solid maps, wall climbing, walkable threads.** The world is now data (`shared/maps/`,
      registry in `shared/level.js`): axis-aligned solids, optional floating anchors. New map `canopy`
      (4400x1700: floors over 3 pits, 4 towers, ledges, hanging rocks); the original level is kept as
      `gaps` for regression (`?map=gaps` in dev, `MAP_ID=gaps` on the server).
      - Every solid's OUTLINE is a grapple/attach point: mouse aim casts a ray and sticks where it first hits
        an edge (small angle forgiveness); Space auto-launch fans upward rays; anchors/strands under the
        cursor win. A ring shows where a click would land.
      - Wall/underside crawling (`client/src/systems/Crawl.js`): hold toward a wall to cling, W/S climb, over
        the top edge -> stand on top (S at a top edge climbs down), wrap around corners and along undersides.
        Space kicks off a wall and launches a web; pressing away lets go. Gravity is off while attached.
      - Threads are walkable: land on one from above, or press along one you touch; slanted, vertical and
        underside walking; hop through junctions; step onto walls/floors at a strand's ends; Space jumps,
        S drops through shallow threads.
      - Ground/wall detection now comes from map geometry (not physics collision events, which cannot tell a
        floor from a wall). Swing feel verified unchanged on `gaps` (peak speed 3.9, exact momentum on
        release, run 4.4, jump -11).
      - Strands may not pass through solids ('blocked'), are stamped with their map id (a strand file from
        another map is discarded on load), and spider rotation is synced so others see wall/thread walking.
      - Map design rules (checked by `node shared/check.mjs`): solids never overlap, gaps >= 60px, a tower may
        stand on a floor.
- [ ] **Phase 6 — Custom pixel-art profiles.** Tumblr-style self-editable HTML/CSS,
      sanitized (DOMPurify) + sandboxed rendering.
- [x] **Phase 7 — Thread color customization.** 12 preset colors (`shared/colors.js`), picked from the
      swatch button (bottom-right) or cycled with C. Colors your swing web (others see it too) and
      every strand you spin; a strand keeps the color it was spun with. Server keeps an allowlist
      (only a key is ever sent), saves your choice per player (`server/data/prefs.json`) and syncs
      all your tabs. Free-form colors are deliberately not offered (unreadable/invisible colors).

### Pocketed for later
- [ ] **Phase 8 — Thread economy (real tracking).** Replace the stubbed Thread value
      with real listening-time measurement: Spotify OAuth polling ("recently played")
      and/or a Discord bot reading "Listening to Spotify" presence for members of a
      shared server. One source per account (no double-counting) for v1.

## Notes / open items
- Real pixel art (nests, spider variants, level tiles) drops in to replace
  placeholders whenever it's ready — doesn't block any phase.
- Discord tracking needs a bot with the Presence Intent enabled in a shared server,
  and the user must have "Display Spotify as status" on in Discord.
- Custom profile HTML must be sanitized + sandboxed before render (security).
