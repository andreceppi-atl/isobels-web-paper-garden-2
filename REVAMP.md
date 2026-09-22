# Isobel's Web — movement and mechanics revamp

This working copy keeps Webspun's multiplayer rules and persistent strand system, while moving the game toward the Webbed × PictoChat direction.

## Implemented in this pass

- Ground movement accelerates and decelerates instead of snapping directly to a fixed speed.
- Jumps have 110 ms of coyote time and a 130 ms input buffer.
- Releasing jump early produces a shorter hop.
- Swing input adds a small tangential pump when the rope is taut.
- Reeling is delta-correct, so it behaves consistently through slow frames.
- Releasing a swing still preserves the exact current momentum.
- Competitive wording is reframed as private `Flow` and `Weave chain` feedback.
- Thread no longer grows merely for being online. It grows only during an explicitly enabled listening session.
- A small procedural radio provides the temporary listening source. It is deliberately labeled as a preview; verified Spotify or Discord listening can replace the signal later.
- The Isobel's Web token contract is now recorded in `DESIGN.md`.
- The dark arena has become **The Paper Garden**, a five-room notebook world with labeled social landmarks.
- A live minimap shows room, camera, player, nearby spiders, solids, and lasting strands.
- Four monochrome player treatments replace the colorful avatar pool; the earlier color studies remain reserved for NPCs.
- Player-made silk is now the restrained color layer, using darker inks that stay visible on paper.
- Chat, emotes, thread controls, listening, boot screen, and world rendering now share the same square PictoChat visual system.

## Safety boundary

This is an isolated development copy. The original live directory and its `server/data` files were not modified or copied. The full rule suite creates temporary data directories and does not touch real player state.

## Run the development world

```bash
PORT=5192 DATA_DIR=data-dev npm --prefix server run dev
npm --prefix client run dev
```

Then open `http://localhost:5181`.

## Verify

```bash
npm --prefix client run build
./tests/run-all.sh
```

The movement model also has a fast standalone check:

```bash
node tests/movement-model.mjs
```

## Next gameplay pass

1. Prototype the **quiet pond** collision silhouette using the recipe in `MAP-PRACTICE.md`.
2. Calculate non-exclusive personal and shared weave contribution from listening time plus maintained strand length.
3. Add touch controls and controller mappings around the same traversal model.
4. Playtest swing pumping, climb speed, coyote time, and player-built shortcuts before changing numeric tuning again.
5. Introduce the saved colorful character studies as stationary NPCs only after each room has a social purpose.
