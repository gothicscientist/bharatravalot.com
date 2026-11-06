# Design notes

Read this before a design pass so each pass starts from the same decisions.

## Brief

A personal site that feels like a made thing, not a template: an explorable world for people with five minutes, and a calm, fast quick view for recruiters who have thirty seconds. Both say only what is true; facts come from Bharat's resume and his public repositories.

## The labyrinth

- **Down, through, and out.** You start on open dunes, climb down a stair into a labyrinth cut into the rock, and finish in a palace courtyard at dusk. The sun sinks as you get further along the route, so torches matter more the deeper you go.
- **Chambers are metaphors, lightly held.** The first hall is the introduction. The builders' hall, with small worlds turning on plinths, is Radiant Tech. The cloth market with its great pile is pileGo. The hall of keys, a giant keyboard you walk across, is Thock. The strata quarry, terraces of coloured rock around a glowing helix, is Strata. The rally court is Rally Assist. The speed trials, with sponge boards and speed pads, are the Roblox game. The council chamber holds Agora and FBLA. The archive of voices is the Marwari work. The star well is Berkeley. The palace courtyard and its fire are contact.
- **A generalized desert fantasy**, not one real place: sandstone, turquoise tile, onion domes, pointed arches, palms, banners, torches. The labyrinth is open to the sky so sunlight and shadow carve the corridors.
- **Voxel, pixely, handmade.** Chunky forms with baked ambient occlusion, 16px greyscale textures under per-material colour, and a little colour jitter per block. Glowing blocks (helix, speed pads, lamps) feed the bloom.
- **Readable from above.** A fixed three-quarter camera like an action RPG, turned in 90 degree steps with Q and E. Walls between the camera and the wanderer dissolve with a dither so you never lose him.
- **Relics mark the work.** Each chamber has a floating crystal on a pedestal with a column of light you can see from far away. Walk up to it for the card, open it for the full entry. Visited crystals dim their light.
- **The wanderer** wears a saffron turban with a long scarf, an indigo tunic and a maroon shawl, and carries a curved sword.
- **Sound is optional and generated**: wind, a drone, footsteps on sand and stone, chisels near the builders' hall, and fire.

## The quick view

- Sentence case everywhere, no all-caps eyebrow labels, no middle-dot meta strings, no slogans as headings.
- Cormorant Garamond for display and Instrument Sans for text, both self-hosted.
- Warm paper, ink, one kesari accent and gold hairlines. Dark mode follows the system.
- The hero image is a still rendered from the labyrinth itself.

## Things to keep

- Content lives in `src/content.ts` only. Both halves read from it.
- No invented numbers. When a fact changes, change it there.
- Respect reduced motion and keep the quick view one click away from every screen.
