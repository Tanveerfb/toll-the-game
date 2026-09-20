# Arc One asset manifest — rework in progress

**Status 2026-09-20: chapters 13–19 extracted (this file). Chapters 1–12 still to
re-verify against the current beat sheets.** The published manifest
(`https://claude.ai/artifact/UADoNt4qeanEBin4bi5PJ5`, written 2026-08-20) covers
**12 chapters and claims 94 assets**. There are **19**.

Written because Tanveer asked for the rework directly (2026-09-20): *"you might
have forgotten the story chapters and you might have to go through all the story
chapters, get the locations accurately."* He was right — see the gap below.

---

## What the old manifest got wrong

1. **Seven chapters missing.** `E:\Toll - Web toon\` holds `Chapter 1.md` through
   `Chapter 19.md`, every one headed **`Arc 01`**. Chapters 1–17 are **LOCKED
   (approved)**; **18 and 19 are DRAFT (pending approval)**. The manifest stopped
   at 12.
2. **`arena_phase3` is no longer speculative.** The old manifest held it back as
   *"not described anywhere yet — I'd hold this until a chapter defines it."*
   Chapter 13 defines it in its first line: *"A cleared ring at the center of the
   gathering space — nothing elaborate, just packed ground and enough room to
   move."* One of the four open decisions answers itself.
3. **The delivered count is stale.** It says 2 delivered / 1 in progress.
   `lib/game/storyBackgrounds.ts` now carries `image:` entries for
   `village_peaceful`, `village_ruins`, `bureau_interior`, `open_road`,
   `city_toll_metropolis`, `bureau_exterior` and `waypoint_town` — at least
   **seven**. Needs a proper recount when 1–12 are re-verified.
4. **No map category at all.** The node-path stage map (ruling #142, Dokkan
   reference) needs art for what sits *on* it, and the manifest predates it.
   `docs/ART_REQUESTS.md` D4 has a battle-road terrain plate; that is the seed,
   not the set.

---

## Phase 3 is cheap — one venue, four chapters

Chapters 13–16 all play in the **same ring**, which is the best news in this pass.
The whole tournament needs two plates, not eight.

### New backgrounds

| slug | chapter | what it is |
| --- | --- | --- |
| `phase3_ring` | 13–16 | Cleared ring at the centre of the gathering space. Packed ground, candidates forming a loose perimeter, examiner platform above the crowd line. **Answers the old `arena_phase3` flag.** |
| `phase3_bleachers` | 16 | The view *from* the bleachers, where Duke's group actually watches the Final. Staging revision 2026-09-04 put them at real distance from the ring — "nothing to do from up here but watch" — so this is a distinct camera, not a reuse. |
| `medical_tent` | 14 | Cots, field medics, quiet. Duke and Lyra compare notes after their match. |
| `debrief_room` | 17 | **High value.** "A smaller room off the administrative wing — a long table, plain chairs, a single window letting in the kind of flat late-afternoon light that doesn't flatter anything it touches." The chapter's whole second half plays here. |
| `crossroads_signpost` | 17 | Dirt crossroads, weathered signpost, wanted notices. Dusk/night. The Mustafa–Seris reveal. |

### New effect plates

| slug | chapter | what it is |
| --- | --- | --- |
| `fx_ice_eruption` | 14, 15 | Lyra's ground-ice wall — red-tinged spikes erupting from the earth. Debuts Ch14, becomes her finisher in Ch15. Used at least six times across two chapters. |
| `fx_collision_shockwave` | 14 | The Duke/Lyra mutual hit — red ice and displaced water blasting outward, felt to the perimeter. The arc's biggest single image so far. |
| `fx_ice_prison` | 15 | Mustafa fully encased, cracks spidering across it and holding. Needs a cracked state and an intact state. |
| `fx_smoke_burst` | 16 | Mustafa's escape. Explicitly **not Toll** — "no light to it, no heat, nothing that reads as Toll at all." Must look mundane, which is the plot point. |

### New props

| slug | chapter | note |
| --- | --- | --- |
| `prop_ledger_card` | 17 | The certification card. Four of them, sealed folders with names printed across the front. Recurs in Ch18 and Ch19 as an access token. |
| `prop_wanted_poster` | 17 | Mustafa's likeness, "plain and administrative." Torn down on-page. |

---

## Chapters 18–19 — a whole new environment set

**These two are DRAFT, pending his approval.** Everything below is therefore
**provisional** — do not generate against it until the chapters are locked.

The exam scaffolding is gone, so almost nothing here reuses an existing plate.

| slug | chapter | what it is |
| --- | --- | --- |
| `town_street_ordinary` | 18 | An unremarkable town, food stall, a low wall to sit on. Deliberately anonymous — "wherever this town is, it isn't anywhere either of them's been before, which seems to be the entire point." |
| `bureau_building_a_lobby` | 18 | Front desk, new Ledgers still filing paperwork. |
| `building_j_exterior` | 18 | The exam site gone dormant — halls that held eight hundred people, now skeleton staff. |
| `building_j_staff_room` | 18 | A desk covered in more folders than it was built for. |
| `archive_room` | 18 | **The chapter's main set.** A bank of screens, most dark, a centre console. Where the deleted footage and the audit log land. |
| `building_j_corridor_night` | 18 | Dark, empty hallway, after hours. Callum's phone call. |
| `hotel_room` | 19 | Two beds, a window. Duke and Lyra, nowhere in particular. |
| `road_to_house` | 19 | Sara's approach on foot, longer than the directions said. |
| `safehouse_interior` | 19 | Modest, furnished, lived-in, ordinary in every visible detail — and the trap. "Quiet in a way that doesn't feel empty." |

**Props:** `prop_phone_ringing` (LYRA across the screen — the chapter's closing
image), `prop_audit_terminal` (timestamps and system credentials, the name
**SERIS** readable on it).

**Two new NPC portraits**, both flagged minor in the beat sheets: **Priya
Okonkwo** (archive clerk, three years in that room) and **Callum Reyes** (the
mole). Kit numbers and any design detail are Tanveer's (#65, #108).

---

## Finding: the villain's name is spelled two ways

`data/characters/seras.json` calls her **Seras** — *"Hybrid of fairy and human,
wielding lightning"*, tagged `Human`, `Fairy`, `Hybrid`, `Female`, `Powerful
Opponent`, card number 100027, heading *Radiant Malice*.

`Master_Context.md` calls her **Seris** — *"Fairy-Human Hybrid (CONCEALED)…
Fights like lightning… Arc One primary antagonist"*, and Chapters 17 and 19 both
tag her dialogue `SERIS`.

**Same character, two spellings.** One of them is wrong and it is not Claude's
call which (#65). It affects the kit JSON, the archive entry, the card number's
display name and every asset slug that names her.

**She also has two appearances**, which is an art consequence either way: the
official Ledger form (silver-white hair, black coat — what `public/characters/
seras.png` shows) and a **separate civilian form** known to almost nobody, glimpsed
in Ch10 and which "must stay unidentifiable." That is a second portrait, and its
whole job is that it does not read as the same person.

---

## Still to do

1. **Re-verify chapters 1–12** against the current beat sheets. The old manifest
   read them in August; several have been revised since (Ch12's bracket language
   was corrected 2026-08-27, Ch16's staging 2026-09-04, Ch19 supersedes a locked
   `Master_Context.md` note as recently as 2026-09-15).
2. **Recount delivered.** Read `storyBackgrounds.ts` and `public/` rather than
   trusting the manifest's "2".
3. **Add the map category** once he says what the map shows.
4. **Republish the artifact** at its existing URL, and reconcile with
   `docs/ART_REQUESTS.md` so there is one queue rather than two.

## Answered by Tanveer, 2026-09-20

- **Seris is canon.** *"One and same. I sometimes spell her either way. Seris is
  canon name tho."* Display name changed; the `seras` id deliberately kept. See
  **ruling #149**.
- **Chapters 18–19 are out of scope.** *"Ignore the drafts for now. Not fully
  established yet. And of course prone to more additions before locked."* The
  manifest covers **chapters 1–17**; the 18–19 section above stays as a record of
  what is coming, marked not-to-generate.
- **All three slug decisions approved** — retire `gamblers_table`, retire
  `the_bridge`, rename `overseer_dining` → `common_space_night`.

---

## Category: the stage map (new)

His scope, 2026-09-20: *"Node icons would be item drops, fights, route direction
icon, etc. But what I meant was map background. For example, a grassy area as bg
and then we have nodes map on top of it."*

So this is **two asset classes**, and the background is the one he was actually
asking for.

### Map backgrounds — the ask

A terrain plate that the node graph draws on top of. Not a painted map with a
route baked into it: the route is UI, drawn in code over the plate, because the
node layout is data (ruling #142 — the map is a gameplay mechanic, and the board
is authored, not illustrated).

That makes the constraint set closer to the story backgrounds' than to a
portrait's:

- **Nothing important in the middle.** Nodes and their connectors sit on top, so
  the plate reads as ground, not as a composition with a subject.
- **Even value across the frame.** A node icon has to stay legible wherever it
  lands, which a plate with a bright sky in one corner and deep shadow in another
  will not allow.
- **Tileable or over-sized**, since the board scrolls and its length depends on
  how many nodes a chapter has — a fixed 16:9 plate will not stretch.
- One plate **per biome**, not per chapter: grass, forest, volcanic, lakeside,
  interior/Bureau. Reuse is the point.

`docs/ART_REQUESTS.md` **D4** already carries a battle-road terrain plate for the
ascension trial. That is the seed for this category rather than a separate thing;
reconcile the two rather than writing a second entry.

### Node icons — the set

Small, readable at badge size, transparent background, same rules as the
inventory icons in Category C. Drawn rather than generated is likely the right
call for several of these: Category C's coin frames and the app icon both ended up
drawn in Python because ComfyUI cannot promise exact centring or a fixed safe zone,
and a node icon is the same geometry problem.

Types he named: **item drop**, **fight**, **route direction**. Plus the ones the
board will obviously need and he can confirm or cut: **boss/elite fight**,
**event/story beat**, **cleared**, **locked**, **branch point**.

**Not started, and not to be started until the board's data shape exists** — the
node-path stage map is still unbuilt (`docs/ROADMAP.md`, and STATUS lists it under
deliberately-not-done). Generating icons for states the board does not have yet is
how the old manifest ended up with `gamblers_table`.

## Still open

- **What biomes does the board actually need?** Depends on which chapters get a
  map, which depends on the board being built.
