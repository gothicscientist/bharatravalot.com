# Design notes

Read this before a design pass so each pass starts from the same decisions.

## Brief

A personal site that feels like a made thing, not a template: an explorable world for people with five minutes, and a calm, fast quick view for recruiters who have thirty seconds. Both say only what is true; facts come from Bharat's resume and his public repositories.

## The journey

- **One day, one walk.** The traveller walks west from the dunes before dawn to a campfire at night. Time of day is distance: walking back east rewinds the sun. The sun path at the bottom doubles as navigation.
- **Places are metaphors, lightly held.** The stone carvers' yard is the studio (Radiant Tech). The dyers' bazaar is pileGo. The merchants' havelis are Thock (the carvers' chisels go *thock*). The stepwell's layers are Strata. The archery ground is Rally Assist (timing and placement). The great dunes are the speed game. The caravanserai is where traders pitch (Agora, FBLA). The royal cenotaphs at sunset, with bards, are the Marwari work. The observatory under the stars is Berkeley. The last fire is contact.
- **Jaisalmer, specifically.** Golden sandstone with visible ashlar courses, round battered bastions with leaf-shaped kanguras, jharokhas, chhatris with lotus-based domes, Jain shikharas inside the fort, khejri trees, demoiselle cranes at dawn. Bharat's family is Ravalot, from Jaisalmer.
- **2.5D lighting is the signature.** Every shape is flat but carries a 3D normal, so round towers, domes and the two faces of each dune turn with the sun. Distant layers sink into the hour's haze.
- **The traveller** wears a white angarkha, a saffron safa with a long streaming tail, a maroon shawl, a talwar and a dhal. Saffron is the one strong accent against the gold; the dyers' bazaar is the only place where colour is allowed to riot.
- **Sound is optional and generated**: wind, a tanpura drone, footsteps on sand and stone, chisels, birds at dawn, crickets and fire at night.

## The quick view

- Sentence case everywhere, no all-caps eyebrow labels, no middle-dot meta strings, no slogans as headings.
- Cormorant Garamond for display, Instrument Sans for text, Tiro Devanagari Hindi for the few Devanagari words. All self-hosted.
- Warm paper, ink, one kesari accent and gold hairlines. Dark mode follows the system.
- The hero image is a still rendered from the journey itself.

## Things to keep

- Content lives in `src/content.ts` only. Both halves read from it.
- No invented numbers. When a fact changes, change it there.
- Respect reduced motion and keep the quick view one click away from every screen.
