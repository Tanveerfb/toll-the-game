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

## Category C — Miscellaneous

**Status: open, nothing queued.**

Anything that is neither a character nor a scene background — UI textures, banner
composites, item icons, material art. One banner composite exists
(`public/banners/`); its compositing approach is documented under
"Banner splash art" in `ART_PIPELINE.md`.

---

## Delivered

Nothing yet — this file was created 2026-08-16.
