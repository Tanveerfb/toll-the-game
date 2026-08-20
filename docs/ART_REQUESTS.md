# Art Requests — the ComfyUI queue

**What this is:** the standing list of every image the game needs but does not have
yet. Tanveer runs ComfyUI in dedicated sessions; this file is what those sessions
read to know what to generate.

**The rule that makes it work:** *never block on missing art.* If a feature needs an
image that does not exist, write the request here, ship the feature with a graceful
fallback, and move on. A session that stalls waiting for an asset has wasted itself.
Every future session appends here rather than asking.

**How to generate** — prompt template, checkpoint, settings, the trigger-word table
and the color-bleed rule all live in [`ART_PIPELINE.md`](ART_PIPELINE.md). This file
carries *what to make and why*; that one carries *how*. Where a request needs
settings that differ from the pipeline default, it says so explicitly under **Specs**.

---

## Entry format

Append new requests under the right category using this shape. Keep entries
self-contained — a ComfyUI session has no other context.

```markdown
### <slug> — <one-line subject>

- **Purpose:** where it appears in the game and what it has to do there.
- **Specs:** size, aspect, and any deviation from the ART_PIPELINE default.
- **Prompt notes:** subject-specific guidance, or "template default".
- **Lands at:** `public/<dir>/<slug>.png` + how it gets registered in code.
- **Status:** `open` · `in progress` · `done <date>` · `dropped — <reason>`
- **Requested:** <date>, for <what work>.
```

Move finished entries to **Delivered** at the bottom rather than deleting them —
a record of what exists is as useful as a record of what doesn't.

---

## Category A — Story scene backgrounds

**Status: delivered 2026-08-20** for everything chapter 1 references — all four slugs are
shipped and wired. The remaining ten registered slugs are **not** requested; no authored
scene references them yet. See the corrected list below.

**Why:** `StoryScene` currently has four fields — `speaker`, `portraitId`, `side`,
`text` ([`types/story.ts:8`](../types/story.ts)) — and no background. Every scene in
all 12 parts renders over the same void-plus-grid. The content already works around
this: `part1.json` opens with *"A small rural village. Remote, quiet, self-contained."*
as narration, which is a background being described in prose because there is nowhere
to put an image. Tanveer approved **background-per-scene** on 2026-08-16 as the scene-
direction pass, with expressions, per-scene audio and camera effects explicitly out.

### Specs for this whole category — these override ART_PIPELINE defaults

The pipeline doc is written for character portraits. Backgrounds differ on four
points, and getting any of them wrong makes the asset unusable:

| Aspect | Character portraits (existing) | Scene backgrounds (this category) |
|---|---|---|
| Size | 1024×1024 square | **16:9 landscape**, 1344×768 or 1536×864 |
| Background removal | Required to lift cleanly (standing rule, 2026-08-02) | **Never** — this *is* the background |
| Characters in frame | The subject | **None.** Portraits composite on top |
| Frame usage | Subject centred | Composition must survive portraits at both edges |

Three more constraints specific to how the reader renders:

- **Keep the lower third quiet.** The dialogue box sits there
  ([`StorySceneReader.tsx:273`](../components/game/StorySceneReader.tsx)) and narration
  runs centred with letterbox bars. Busy detail behind either kills legibility.
- **Portraits occupy both bottom corners** — up to `19.5rem` wide each on desktop.
  Anything load-bearing in the composition needs to live centre or upper frame.
- **Darker and less saturated than a character card.** These sit *behind* cel-shaded
  figures at full saturation; a background competing at the same intensity flattens
  the whole scene. Style still reads as the same world — cel shading, clean lineart —
  just pitched down.

**Lands at:** `public/backgrounds/<slug>.webp`. Needs a `lib/game/backgroundArt.ts`
mirroring the existing `characterArt.ts` id→path map, plus a `background?: string`
field on `StoryScene`. Neither exists yet — whoever does the scene-direction pass
builds them.

### The location list — corrected 2026-08-20

The original list was inferred from part titles and taglines and told whoever ran the
pass to *"walk `data/story/part*.json` properly and correct this list before generating
anything"*. That survey is no longer possible the way it was written: story mode v2
replaced parts with chapters in `8b56767`, and `data/story/` now holds exactly one file,
`chapter-1.json`. Grepping it for `backgroundId` and `localeId` gives the real demand:

| Slug | Scenes referencing it | State |
|---|---|---|
| `open_road` | 12 | **delivered** 2026-08-20 |
| `bureau_interior` | 7 | **delivered** 2026-08-20 |
| `village_peaceful` | 3 + the chapter `localeId` | **delivered** 2026-08-20 |
| `village_ruins` | 3 | **delivered** 2026-08-20 — img2img, see below |

The other ten slugs registered in `lib/game/storyBackgrounds.ts` (`exam_staging`,
`exam_ground`, `zipline_ridge`, `scorched_earth`, `gamblers_table`, `the_lake`,
`the_bridge`, `holding_room`, `overseer_dining`, `final_phase`) are **not requested**.
They are anticipated locations from the twelve-part outline, and no authored scene names
any of them. Generating them now is art for scenes that do not exist — request them when
the chapter that uses them is authored, one location per distinct place.

### village_ruins — delivered, after five failures and one change of method

Five txt2img rolls failed, alternating between intact buildings and bare land with no
buildings. The fix was **img2img from the shipped `village_peaceful` plate at denoise 0.84**,
which holds the layout and hut silhouettes while fully re-rendering the surfaces — so the two
plates finally read as the same place before and after. Full findings, including the denoise
ladder and the foreground mistake, are in `ART_PIPELINE.md`. Treat img2img as the default
method for any before/after location pair from here.

**Status:** `done 2026-08-20` for all referenced slugs · **Requested:** 2026-08-16, for the
scene-direction pass; worked 2026-08-20.

---

## Category B — NPC characters

**Status: open, nothing specific queued.**

Ten NPC/enemy portraits exist in `public/npc/` (plus 8 skill images in
`public/npc/skills/`), covering `frost`, `gale`, `iron`, `lyra_npc`, `molvarr`,
`prism`, `raider`, `road_bandit`, `wild_beast`. New NPCs get requested here as the
story needs them.

**Before requesting a new NPC:** its kit has to exist first, and Tanveer owns kit
mechanics — see the ownership rule in `AGENTS.md`. Art follows an approved design,
never leads it. Also note `docs/design/KIT_DESIGN.md:83` marks `storyOnly` enemy stat
bands as **unassigned**, so there is no written spec for what an enemy's statline
should be; that gap gets closed before NPC design scales up.

Specs are the ART_PIPELINE default — 1024×1024, background must lift cleanly,
signature effect contained near the body.

---

## Category C — Inventory icons

**Status: delivered 2026-08-20.** All 15 material icons and all 5 coin frames ship in
`public/items/`, registered in `lib/game/materialArt.ts`, with `/items/**` allowed in
`next.config.ts`. Three items deviate from the brief below and two are weak at 24px —
both recorded under Delivered. The how-to lessons are in `ART_PIPELINE.md`.

**Why:** every inventory surface renders materials and currencies as *text*.
`materialLabel()` ([`lib/game/materials.ts:85`](../lib/game/materials.ts)) returns a
string and that string is all any screen has: the profile inventory, the ascension
cost list, the gacha miss-table payout, the story chapter rewards, the clear summary.
An icon set is the single cheapest upgrade to how the game reads, because these
appear on nearly every screen.

### Specs for this whole category — these override ART_PIPELINE defaults

| Aspect | Character portraits (existing) | Inventory icons (this category) |
|---|---|---|
| Size | 1024×1024 | **512×512** is plenty — these never render above ~66px |
| Background removal | Required | **Required**, same rule — they sit on `bg-panel` and `bg-inset` |
| Subject | Full figure | **One object, centred, filling ~80% of frame** |
| Legibility target | Reads at card size | **Must read at 24px.** Silhouette does the work, not detail |

- **No text, no numerals, no borders.** Quantity (`×7`) and any frame are drawn by
  the UI, so baked-in chrome fights it.
- **Consistent light from upper-left across the whole set**, or they won't read as one
  family when six sit in a row.
- **Pitch to the dark UI.** These land on near-black panels; a bright white-background
  icon look will glow wrongly. Same world, same cel shading, muted.
- **Key each item to its element hue where one applies** — the tokens are in
  `styles/globals.css`: `el-blue #37a6ff`, `el-red #ff5a4e`, `el-green #35d48b`,
  `el-light #e8d174`, `el-dark #a874ff`.

**Lands at:** `public/items/<slug>.webp`. Needs a `lib/game/materialArt.ts` mirroring
`characterArt.ts` — same `id → path | null` contract, same `ART_VERSION` cache-bust,
and `next.config.ts` `images.localPatterns` needs `/items/**` adding. None of that
exists; whoever wires the first icon builds it. Until then every surface keeps the
text label, which is the existing fallback and is fine.

### C1 — Currencies (5)

The most-seen art in the game; they sit in the nav on every screen.

| Slug | Label | Notes |
|---|---|---|
| `gems` | Gems | Premium currency. Faceted crystal cluster, `el-blue`→`el-dark` range |
| `coin` | Coin | Soft currency. A struck coin, worn metal, `el-light`. Must not read as a character coin (C5) |
| `permanent_ticket` | Permanent Ticket | Guaranteed-summon ticket. A stamped pass or token, `el-light` seal |
| `auto_clear_ticket` | Auto-Clear Ticket | Skips a fight. Same ticket family as above but visibly different — a punched/torn edge reads best at 24px |
| `stamina` | Stamina | Regenerating run currency. Not a material; appears in the nav and on every brief |

### C2 — Ascension materials (2)

World-boss exclusive by design — story never drops these.

| Slug | Label | Notes |
|---|---|---|
| `sea_monster_eye` | Sea Monster's Eye | Molvarr drop. A large lidless eye, wet, cold light. `el-blue` |
| `corroded_seaweed` | Corroded Sea Weed | Molvarr drop. Blackened kelp fronds, corrosion. `el-green` pitched sickly |

### C3 — Training manuals (3, a tier ladder)

**Generate these as a set in one pass** — the whole job is that tier is legible at a
glance. A bound book/scroll silhouette held constant, escalating only in binding,
trim and glow: plain → gilded → radiant.

| Slug | Label | Tier read |
|---|---|---|
| `training_manual` | Training Manual | Base. Plain cloth binding, no glow |
| `training_manual_advanced` | Advanced Training Manual | Mid. Metal trim, faint `el-light` edge |
| `training_manual_premium` | Premium Training Manual | Top. Ornate, clear `el-light` glow |

### C4 — Local specialty materials (4)

Granted by the gacha miss-table, mapped from a character's colour
([`lib/gacha/materials.ts:7`](../lib/gacha/materials.ts)). Note **`prism_dust` serves
both `light` and `dark`**, so it should not lean hard on either hue.

| Slug | Label | Colour | Notes |
|---|---|---|---|
| `riverstone_fragment` | Riverstone Fragment | blue | Water-smoothed stone shard, `el-blue` |
| `scorched_ember` | Scorched Ember | red | Cooling ember, cracked crust with heat inside, `el-red` |
| `bramble_thorn` | Bramble Thorn | green | Barbed thorn sprig, `el-green` |
| `prism_dust` | Prism Dust | light **and** dark | Loose refracting powder/shards. Iridescent rather than gold or violet, since it stands for both |

### C5 — Character coins: 5 frames, not 18 icons

**Do not generate one icon per character.** `characterCoinId()` produces
`{color}_{id}_coin` for **every playable character** — 18 today and one more with every
character added, so a per-character icon is a treadmill that guarantees a missing asset.

Generate **five empty coin frames**, one per colour, and composite the existing
character portrait into the centre in code — the same trick already used for banner
splashes (see "Banner splash art" in `ART_PIPELINE.md`). The portraits exist; the frames
are what's missing.

| Slug | Colour | Rim hue |
|---|---|---|
| `coin_frame_blue` | blue | `el-blue` |
| `coin_frame_red` | red | `el-red` |
| `coin_frame_green` | green | `el-green` |
| `coin_frame_light` | light | `el-light` |
| `coin_frame_dark` | dark | `el-dark` |

Each: a struck-metal ring with an empty circular window in the middle, no portrait, no
text. Transparent centre and transparent outside, so the portrait shows through and the
coin can sit on any panel. Keep the rim thin — at 44px a heavy rim swallows the face.

**Status:** `done 2026-08-20` · **Requested:** 2026-08-17, for the inventory/clear-summary
icon pass. C1 is the highest value (nav-wide), C5 the highest leverage (5 assets cover 18+
ids).

**Still text-only:** the icons exist and nothing renders them yet. Every inventory surface
still shows `materialLabel()`'s string, which is the designed fallback — wiring the profile
inventory, ascension cost list, gacha payout, chapter rewards and clear summary to
`getMaterialArt()` is a UI pass, not an art one.

---

## Category D — Miscellaneous

**Status: open, nothing queued.**

Anything that is neither a character, a scene background, nor an inventory icon — UI
textures, banner composites. One banner composite exists (`public/banners/`); its
compositing approach is documented under "Banner splash art" in `ART_PIPELINE.md`.

**Board terrain** for the story node board will land here once the route work starts
(16:9, no background removal, no characters) — not requested yet, because the board's
own visuals aren't built.

---

## Delivered

### 2026-08-20 — Category C, the whole inventory set (20 assets)

`public/items/*.png`, 512×512 RGBA, registered in `lib/game/materialArt.ts`.

**C1 currencies (5)** — `gems`, `coin`, `permanent_ticket`, `auto_clear_ticket`, `stamina`.
Five deliberately different silhouettes, because these five sit next to each other in the
nav: round coin, tall gold plaque, square steel plaque, crystal cluster, single amber shard.

**C2 ascension (2)** — `sea_monster_eye`, `corroded_seaweed`.
**C3 manuals (3)** — generated as one set from a shared seed; the ladder reads plain cloth →
leather with steel fittings and a clasp → gilded filigree with a warm edge glow.
**C4 specialties (4)** — `riverstone_fragment`, `scorched_ember`, `bramble_thorn`,
`prism_dust`. `prism_dust` stays iridescent rather than gold or violet, since it serves both
`light` and `dark`.
**C5 coin frames (5)** — drawn with a PIL script rather than generated, so the transparent
window is exactly concentric and identical across all five; a portrait is composited through
it in code via `getCoinFrameArt()`. Verified compositing cleanly with five real portraits at
44px and 28px.

**Three deviations from the brief above, all for legibility:**

- `permanent_ticket` and `auto_clear_ticket` are **stamped metal plaques**, not paper — a
  gold plaque with a star emblem and a steel plaque with an arrow. The brief asked for a
  stamped pass and a punched/torn paper stub; paper failed five rolls (framed picture, red
  blob, abstract shapes, featureless card) because this checkpoint does not draw blank paper.
  They still read as a matched pair, and as tickets rather than currency.
- `prism_dust` is **a single iridescent crystal cone**, not the loose powder heap the brief
  describes. A heap of dust has no silhouette at 24px; the cone does, and keeps the opal
  rainbow sheen the brief asked for.
- `stamina` is a **faceted amber shard**. The brief left the object open (it only said "not a
  material; appears in the nav and on every brief"); amber energy was chosen to read as
  life-force at a glance and to differ in shape from the blue-violet `gems` cluster.

**Two known-weak icons, not blocking:** `bramble_thorn` and `corroded_seaweed` are thin-line
subjects with no mass, so they mush at 24px. Both read fine at 44px and up, which is where
they actually appear. Worth a reroll with a chunkier subject if either ever renders that
small.

### 2026-08-20 — Category A, chapters 1–3 (14 plates)

Generated after reading all twelve beat sheets and `Master_Context.md`, so these are the
places the chapters actually describe rather than inferences from part titles. All graded
before shipping and registered in `lib/game/storyBackgrounds.ts`.

**Three non-canon slugs retired** (Tanveer, 2026-08-20) and replaced with what the
chapters need. Each keeps a comment in the registry naming what it replaced:

| Retired | Replaced by | Why |
|---|---|---|
| `gamblers_table` | `admin_room` | Ch7 is Chiara reporting in the monitor room; no gambling table exists in Arc One. Ch6, 7, 8 and 10 all play in that room |
| `the_bridge` | `lake_shore` | Ch9 turns on there being no crossing — Molvarr *is* the bridge. The chapters need the near shore: flag 1, the speaker pole |
| `overseer_dining` | `common_space_night` | Ch11 puts Duke and Tao in the candidates' shared common space at night, not a private dining room |

**Chapter 1 (8 plates)** — `city_toll_metropolis`, `bureau_exterior`, `waypoint_town`,
`wilderness_ridge_summer` / `_snow` / `_storm`, plus `village_peaceful` and `village_ruins`
from earlier. The training-montage triplet is one place in three weathers: the snow and
storm plates are img2img derivatives of the summer one, so the montage reads as time
passing rather than three locations.

**Chapter 2 (4 plates)** — `jungle_path_day`, `jungle_path_dusk` (a graded copy of the day
plate, so it is unmistakably the same trail), `jungle_deep`, and `jungle_clearing`, which
took eight attempts and a method of its own (ground blocked in with PIL, img2img at 0.80).

**Chapter 3 (4 plates)** — `exam_compound_exterior`, `exam_registration_hall`,
`exam_waiting_room`, `exam_venue_courtyard`. Four views of one building; the courtyard is
the compound at night via img2img at denoise 0.68.

**All art is WebP as of 2026-08-20** — backgrounds at lossy q90, icons at q90 with
`alpha_quality=100` so the cutout edges stay lossless (they render down to 24px, where a
soft edge reads as a halo). 18.4MB of PNG became 2.2MB with no visible loss.

**Method notes that changed how this category gets made:** re-frame a failing plate into a
composition the checkpoint can do rather than rewording it; composite-and-blend when it
renders a subject but won't place it in an environment; grade every plate down before
shipping. All written up in `ART_PIPELINE.md`.

### 2026-08-20 — Category A, all four referenced backgrounds

`public/backgrounds/{village_peaceful,village_ruins,bureau_interior,open_road}.png`, 1344×768, wired by
filling in `image:` on the matching slug in `lib/game/storyBackgrounds.ts`. All three keep
the lower third quiet for the dialogue box, carry no characters, and sit darker and less
saturated than a character card. `village_ruins` came last and by a different route — five
failed txt2img rolls, then img2img from the `village_peaceful` plate, which is now the
documented method for any before/after pair.
