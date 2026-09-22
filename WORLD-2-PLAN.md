# Isobel's Web 2 — Final-world plan

## Product north star

Isobel's Web 2 is a quiet, persistent social side-scroller: a very long PictoChat paper world where every player receives a visible home web, wanders through old community webs, meets spiders and residents, listens to music, and extends the shared silk network. There is no PvP and no territory loss.

## The world

- A 24,000 px horizontal map split into ten named paper districts.
- Sparse solids and ledges preserve the signed-off swing, crawl, stunt, and strand physics.
- Old orb webs, corner webs, doodled landmarks, route labels, and NPCs make empty space legible without turning it into a dense platformer.
- The minimap remains the primary long-distance navigation aid.

## Player home webs

- The multiplayer Durable Object assigns one unused nest slot the first time a player joins.
- The slot is stored in SQLite and survives browser, server, and host shutdowns.
- Returning players receive the same nest and spawn inside it.
- A nest is real strand geometry: it can be walked, grappled, and used as an endpoint for new player-made silk.
- Nest silk always follows the owner's saved Thread color.
- V2 starts with 60 authored slots. Expansion beyond that becomes a deliberate map-capacity milestone rather than silently overlapping homes.

## Population

- Spider NPCs patrol small routes near old webs and social landmarks.
- The previously saved four-character lineup appears as stationary paper residents with restrained idle animation.
- NPC logic stays deterministic and client-side in the first slice; conversation/state machines arrive after room purposes are playtested.

## Delivery phases

1. **Foundation slice — now:** isolated v2 repository, Long Garden map, permanent old webs, persistent player nests, spider NPCs, animated residents, updated minimap/boot copy.
2. **World activity:** NPC speech/emotes, discoverable notes, radio/listening zones, nest labels and visitor traces.
3. **Web ownership:** contribution meter based on maintained silk and verified listening, with additive/shared ownership only.
4. **Identity:** profiles, nest decoration, safer account-backed identity, block/mute/report.
5. **Scale pass:** map streaming/culling, more districts and nest capacity, performance budgets for busy rooms.

## Locked boundaries

- Preserve the current swing momentum, crawl behavior, stunt model, chat handshake, and mobile controls.
- Player movement may remain client-authoritative while the experience is cooperative and friends-scale.
- Nests, links, balances, colors, and lasting strands are server-authoritative and durable.
- Watermarked web references are visual research only; shipped webs are original procedural line art.
