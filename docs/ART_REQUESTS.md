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

**Status: open, blocked on nothing. Highest-value batch in this file.**

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

**Lands at:** `public/backgrounds/<slug>.png`. Needs a `lib/game/backgroundArt.ts`
mirroring the existing `characterArt.ts` id→path map, plus a `background?: string`
field on `StoryScene`. Neither exists yet — whoever does the scene-direction pass
builds them.

### The location list is a first-pass inference, not a survey

Derived from part titles, taglines and part 1's narration on 2026-08-16 — **not**
from reading all 12 parts scene by scene. Treat it as a starting shape. Whoever runs
the scene-direction pass should walk `data/story/part*.json` properly and correct
this list before generating anything, because a wrong location list wastes GPU time
on images no scene references.

Roughly one background per distinct place, reused across every scene set there:

| Slug | Place | Appears around |
|---|---|---|
| `village_peaceful` | Small remote rural village, intact, quiet | Part 1 opening |
| `village_ruins` | Same village burned — smoke, collapsed buildings | Part 1, the raid |
| `bureau_interior` | Ledger Bureau office — institutional, cold | Part 1 "The Notice" |
| `open_road` | Long travel road, wilderness | Parts 2–3 |
| `exam_staging` | Ledger Exam registration ground, crowded | Part 3 "Number 22" |
| `exam_ground` | Phase 1 terrain — open, contested | Parts 3, 6 |
| `zipline_ridge` | Elevated crossing, rope span | Part 4 |
| `scorched_earth` | Burned battlefield after a fire fight | Parts 4–5 |
| `gamblers_table` | Interior, low light, a table | Part 7 |
| `the_lake` | Wide dark lake — Molvarr's water | Parts 8–9 |
| `the_bridge` | The lake's only crossing | Part 9 |
| `holding_room` | Bare examinee quarters, two beds | Parts 10–11 |
| `overseer_dining` | The old man's dinner room | Part 11 |
| `final_phase` | Phase 3 arena | Part 12 |

**Status:** `open` · **Requested:** 2026-08-16, for the scene-direction pass.

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

**Status: open. Nothing in this category exists yet — `public/` has no items
directory at all.**

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

**Lands at:** `public/items/<slug>.png`. Needs a `lib/game/materialArt.ts` mirroring
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

**Status:** `open` · **Requested:** 2026-08-17, for the inventory/clear-summary icon
pass. C1 is the highest value (nav-wide), C5 the highest leverage (5 assets cover 18+
ids).

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

Nothing yet — this file was created 2026-08-16.
