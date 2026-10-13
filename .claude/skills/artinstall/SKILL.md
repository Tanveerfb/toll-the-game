---
name: artinstall
description: Step 6 of a playable character's art - lock what he named, build the library, and install the locked pieces into the game (skill and ultimate art, the card and its transparent cut-out, the archive tile and the portrait from that one cut-out, the registry, the tests). Use when charart routes here, or when he says "install <id>'s art", "lock these", "put the art in the game", "release <id>", "the tile and portrait don't match". The one art step a cloud session can do.
---

# artinstall

Step 6 of [`docs/CHARACTER_ART.md`](../../../docs/CHARACTER_ART.md), with
the rules in the skill. `charart` routes here.

## Read first

- `docs/CHARACTER_ART.md` step 6 and rule 8 (nothing enters the repo until
  he locks it, and not before the kit's skill names are final).
- `docs/HANDOFF.md` **#172** (the Ink burst tile; only new-pipeline art
  breaks out; stars show ult level) and **#173** (the tile and the portrait
  are one image, transparent).
- `lib/game/characterArt.ts`: `CHARACTERS_WITH_ART`, `TILE_ART` (id → the
  cut-out's height/width ratio), `SKILL_ART_ALIAS`, `ART_VERSION`.
- `tests/characterArt.test.ts` (every registered file exists; a unit with tile
  art has a transparent portrait), `tests/characterVfx.test.ts`.
- The profile `scripts/lora/characters/<id>.json`: `kit_art`, `portrait`,
  `tile` (the crop numbers live there so a sharper source reuses the framing).
- `scripts/skill_art/make_tile_cutout.py`, `make_portrait_crop.py`.

## Gates

He has **locked** the pieces by name, and `data/characters/<id>.json` carries
the **final skill names** (an installed file is named by the skill's slug).
He says when to install. A kit without its art stays `"unreleased": true`
(#171); releasing is this step plus deleting the flag.

## Do this, in order

1. **Lock.** Copy what he named to ComfyUI `output\<color>_<id>\locked\` (full
   size, game size, cut-out) with a README; the rest to `<id>_library\` with
   a README row. Record the lock in the profile.
2. **Skill and ultimate art:** `public/characters/<color>_<id>/skills/<slug>.png`
   at 832×1216. A slot whose art is borrowed from another unit is a
   `SKILL_ART_ALIAS` entry, not a copied file.
3. **The card:** its own card file in `cards/`, **plus its transparent
   cut-out** in `cards/` (Lyra: `pose-c4.png`; Sara: `card-b-cutout.webp`).
   The cut-out is the single source for the next two files, so it stays in
   the repo.
4. **The tile** from that cut-out: `python scripts/skill_art/make_tile_cutout.py …`
   → `tile.webp` (480 wide). **Its headroom stops at a natural edge** so
   nothing long runs into the tile above: Lyra's ponytail did, and he had it
   cut 12 px above her red ribbon. Write the crop into the profile's `tile`.
5. **The portrait** from the same cut-out: `python scripts/skill_art/make_portrait_crop.py …`
   → `portrait.png`, a chest-up 1024² crop that **keeps the transparency**,
   framed like Lyra's (head about half the frame). Never crop it from a
   composite or from the card with its background: the detail page lays it
   on the element burst, the battle on its own ground. Write the numbers into
   the profile's `portrait`. If the source is soft at that zoom, queue the 4x
   recrop in `docs/ART_REQUESTS.md` (D6).
6. **Register:** `CHARACTERS_WITH_ART`, `TILE_ART[<id>] = height / width` of
   the cut-out, any alias removed; `characterVfx.ts` entry present. Bump
   `ART_VERSION` **only when replacing a file in place** (it is the cache
   buster).
7. **Side by side:** the tile and the portrait next to each other, the same
   picture; the skill art next to its draft, the same picture. Lyra shipped
   with two different pictures once, and he caught it, not the check.
8. `npm run check`. Then, if releasing, delete `"unreleased": true`.
9. Record in the profile (`kit_art.installed`), `docs/STATUS.md`, and the
   `ART_REQUESTS.md` entry (close it).

## Do not

- Install before the lock, or before the skill names are final.
- Cut the tile or the portrait from different sources, or from a composite.
- Let a tile's break-out run past a natural edge.
- Bump `ART_VERSION` for a new file; only for a replaced one.
- Mass-recrop old units: only new-pipeline art breaks out (#172); older
  units keep their flat portraits until they go through `charart`.
