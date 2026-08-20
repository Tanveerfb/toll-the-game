# Character Art Pipeline

All character art is **AI-generated locally** (ComfyUI, RTX 5060 Ti). Style target: **Dokkan Battle card art × 7DSGC character renders** — bold cel shading, thick clean lineart, vibrant saturated colors, dynamic pose, element-tinted gradient background.

## Setup

- ComfyUI portable @ `E:\Installed\ComfyUI_windows_portable` (`run_nvidia_gpu.bat`, API on `127.0.0.1:8188`)
- Checkpoint: **`animagineXL40_v4Opt.safetensors`** (Animagine XL 4.0)
- Settings: 1024×1024, 28 steps, CFG 7, `euler_ancestral` / `normal`
- Output → copy to `public/characters/<id>.png`; register the id in `lib/game/characterArt.ts`
- ~12s per image

## Prompt Template

**Positive** (order matters — hair/eyes BEFORE costume, both weighted, to fight color bleed):

```
masterpiece, best quality, absurdres, 1boy|1girl, solo,
(HAIR:1.3), (EYES:1.2), EXPRESSION,
wearing (COSTUME:1.3), COSTUME DETAILS,
(SIGNATURE PROP/EFFECT:1.25),
POSE, dynamic pose,
cel shading, thick clean lineart, vibrant colors, anime screencap,
dramatic lighting, cowboy shot,
dark ELEMENT-COLOR gradient background, ELEMENT particles
```

**Negative**:

```
lowres, bad anatomy, bad hands, extra fingers, worst quality, low quality,
jpeg artifacts, signature, watermark, text, blurry, realistic,
photorealistic, 3d, busy background, multiple characters
[+ per-character color-bleed guards, e.g. (pink hair:1.4) for Duke]
```

**Color-bleed rule:** when a costume color leaks into hair or effects, add the wrong combination to the negative prompt with weight ≥1.3 and raise the correct token's weight. (Duke's magenta robe turned his hair pink until `(dark blue spiky hair:1.3)` + negative `(pink hair:1.4)`.)

**Trigger-word rule:** some ordinary words summon literal objects regardless of context — and putting them in the NEGATIVE prompt can leak the concept in too. Keep these words out of both prompts entirely and paraphrase:

| Word | Summons | Paraphrase |
|---|---|---|
| crown ("at the crown") | literal gold crown | "top of head" |
| cuffs ("collar and cuffs") | handcuffs + wrist chains | "sleeve borders" |
| chain ("hair chain") | wrist/neck chains | drop it |
| game item icon | a whole icon **sheet** — a grid of 20 small gems, not one gem | "still life, a single X, centered on a plain dark background" |
| ticket / ticket stub / pass (paper) | a framed picture, a poster, or an abstract smear | make it a **metal plaque**; see the inventory-icon section |

**Standing rule (2026-08-02): keep backgrounds cleanly removable.** Every future gen (new character
or a redesign) needs its background to lift out cleanly with `remove_background` (BiRefNet
`BiRefNet_toonout`), with **zero leftover artifacts** — no visible box/rectangle of the old
background surviving. Learned the hard way building the gacha banner composite:
BiRefNet treats anything touching/overlapping the character as foreground, including the
(SIGNATURE PROP/EFFECT:1.25) token — a full-frame swirl or burst that reaches the corners gets kept
almost entirely, defeating background removal. Two concrete asks to bake into every prompt:
- Keep the signature effect/prop **contained near the character's body**, not filling the whole
  frame or touching all four edges (e.g. "water swirling around fists" not "water vortex filling
  the background").
- Keep the background itself a **plain, contained gradient** with nothing extending past roughly
  the character's own silhouette-plus-effect bounds — no particles/streaks drifting into the
  corners.
Test with `remove_background` before calling a character's art final; if a visible rectangle of
old background survives, tighten the effect/background containment and reroll rather than trying
to fix it in compositing later (that's what the whole gacha-banner session had to do after the
fact, per `docs/design/GACHA_DESIGN.md`'s banner-splash-art notes).

## Current Set (v4 — 2026-07-11)

Locked design sheets live in `docs/design/characters/*.md` — they are the source of truth for appearance and override old lore descriptions. Reference photos in `docs/design/characters/refs/`.

| Character | Seed | Design source | Notes |
|---|---|---|---|
| duke | 777012 | design sheet (duke.md) | v3: bulkier MC redesign — DBZ-spiky quiff + taper fade, navy gi with magenta trim/sash over combat bodysuit, water vortex fists |
| lyra | 888051 | design sheet + Tanveer's concept art (refs/lyra-concept-*) | v2: dark blue high ponytail + red tie, crimson frilled top, bronze sash/bracers, white pleated skirt, red fingerless gloves, ribboned bow |
| master_tao | 888002 | design sheet | serious mode: max-power bulk, tank shirt, tidy beard, fire fists |
| sara | 888003 | design sheet | platinum pigtails + black ribbons, cat-ear hoodie, spectral paws |
| yalina | 888043 | design sheet + ref photo | v2 redesign: dark-brown curly hair, deep pink shalwar kameez + gold embroidery, green energy fist. Literal side braid won't render at this style weight — loose side curls accepted. "cuffs"/"chain" are trigger words (see rule above) |
| seras | 888095 | design sheet (redesign 2026-08-02, Cressida Bright ref blend) | v2: true/battle form — pointed ears, light-red eyes, long platinum-silver hair (shifts from human-form copper as power manifests), horn-like tufts, dark kimono-armor, lightning polearm, dark violet bg. Fixed the v1 issue: horn tufts didn't render because the prompt said "near the crown" — "crown" is a trigger word (see rule above) that was forcing a literal gold crown instead. Dropping it let the horn shape render correctly. Civilian/human form (white blazer + mini skirt, Cressida Bright blend) is WIP — outfit/face/bg landed but hair color wouldn't hold copper/strawberry-red across 4 targeted rerolls (kept reverting to yellow-gold or blowing out orange); best attempt parked at `public/unreleased/seras_civilian_wip.png` (seed 888412), hair-color tuning deferred to a dedicated session |
| mustafa | 777004 | AI-invented | design approved by Tanveer 2026-07-11 |
| siddiq | 777131 | AI-invented v2 (2026-07-11 redesign per Tanveer) | emerald kurta + gold trim, curly dark hair, nature orb + vines, red bg. Still awaiting his locked sheet |
| batra | 777132 | Tanveer's direction (2026-07-11): keep turban/facial hair/kesari, drop heavy armour | kesari kurta, navy sash, steel kara, golden lion energy fists |
| gabrist | 777019 | hair/face locked (ref photo) + AI ink-artist theme | jet-black shoulder-length waves, full beard, calligraphy brush + ink strokes |
| meliodas | 777020 | canon (7DS collab) | danbooru character tag `meliodas \(nanatsu no taizai\)` — model knows the design natively |
| ban | 777021 | canon (7DS collab) | pale spiky hair, cheek scar, nunchaku, green soul wisps |
| diane | 777022 | canon (7DS collab) | twin pigtails, orange leotard, giant gauntlet, rock shards |
| gon | 777023 | canon (HxH collab) | danbooru tag `gon freecss` — first roll accepted |
| killua | 777024 | canon (HxH collab) | danbooru tag `killua zoldyck` — first roll accepted |
| leorio | 777125 | canon (HxH collab) | suit + teashades + energy fist. Bg came out blue instead of red; forcing red bg regressed the character (gaunt villain face), so blue bg accepted — the card frame supplies the red |

### Story-only examiners/officials (2026-07-18)

Bureau officials introduced in the story (Ch7+). Art locked; game kits deferred until the story confirms they recur. Appearance briefs live in the story-dev folder's `pending-char-generations.md` (read-only — separate session owns it). Bureau official uniform language: deep navy/indigo base, silver-white trim, gold Bureau seal accent.

| Character | Seed | Design source | Notes |
|---|---|---|---|
| chiara | 888060 (batch idx 1) | brief: Aventurine x Menchi "The Dealer", Veil/Fortune Toll | platinum-blonde + gold eyes (hair/eyes were open in brief), navy dealer-coat + silver trim + gold seal, fanned poker hand in fingerless glove, floating dice/coins/cards. Hair/eye color AI-chosen — Tanveer approved the roll |
| isolde | 888066 (batch idx 1) | brief: Isolde (FKotA) x Yelan, Starred Ledger, Fairy/Weave-Bind Toll | mature elegant graceful, sharp confident half-lidded gaze, silver-lavender wavy hair, violet eyes, prominent iridescent fairy wings, navy Bureau dress-coat + white jabot/gloves + jeweled brooch, violet binding-thread magic, dark starfield bg. Iterated 5 rounds (young->mature, soft->sharp, killed a painterly-grain regression from over-weighted negatives) |

**Prompt-quality gotcha (2026-07-18):** over-weighting a costume-color token (navy coat at 1.45) plus stacking extra background emphasis ("glowing purple thread strands, magical particles") and negatives ("posterized, high contrast neon, oversaturated") tipped Animagine into a painterly/posterized filter and bled silver-lavender hair to pink. Fix: keep costume weight <=1.35, don't pile on background-emphasis tokens, add `noise, grainy, painterly filter, wavy distortion, oil painting` to negative, guard `(pink hair:1.3)`.

### Unreleased / alternate art

`public/unreleased/<id>_<variant>.png` holds approved-but-not-primary rolls of a character — kept for story panels or later swap-in. Not wired into `characterArt.ts` (which serves the single primary `public/characters/<id>.png`). Reference them by direct path where needed.

| File | Character | Notes |
|---|---|---|
| chiara_alt-dealing.png | chiara | open dealing-palm pose, cards floating (alt to the primary fanned-hand roll, same batch as 54) |
| isolde_alt-serene.png | isolde | warmer confident closed-eye smile, wings spread (alt to the primary sharp-gaze roll) |
| sea_monster_alt.png | sea_monster | living behemoth, taller draping-armed lurker variant (alt to official 82) |
| sea_monster_golem-core.png | sea_monster | early stone-golem take, centered w/ glowing star-core (pre-"make it alive" direction) |
| sea_monster_golem-mossy.png | sea_monster | early stone-golem take, hunched mossy brute (pre-"make it alive" direction) |
| seras_civilian_wip.png | seras | WIP human/civilian-form redesign (Cressida Bright blend, seed 888412) — outfit/face/bg accepted, hair color still wrong (caramel/golden-blonde instead of copper/strawberry-red); not wired anywhere, revisit in a dedicated hair-color tuning pass |

### Story-only NPC/enemy art (v6 — 2026-07-12)

NPC/enemy art lives in **`public/npc/<id>.png`** (separated from playable `public/characters/` as of 2026-07-18). `getCharacterArt` routes NPC ids via the `NPC_ART` set to `/npc/`. Generic enemy kits — no character sheets, AI-invented per element. Shown only in the hidden `/archive/npc` page and in story battles.

| Character | Seed | Design source | Notes |
|---|---|---|---|
| raider | 777201 | AI-invented (red) | shaved head, red scarf, scavenged leather/pauldron, flaming torch, charging pose, dark-red bg + fire embers |
| road_bandit | 777202 | AI-invented (dark) | hooded desert ambusher, face in shadow, reverse-grip curved dagger, crouched ambush, dark violet/indigo swirl bg |
| wild_beast | 777203 | AI-invented (green) | feral quadruped monster, green-black fur, glowing yellow eyes, bared fangs + curved claws, emerald bg |

#### Unrevealed Phase-1 candidate enemies (2026-07-18)

The 12 unnamed Phase-1 qualifiers (story silhouettes). Generated 4 as usable story enemies, generic tier, varied elements — AI-picked, Tanveer vetoes in review. Enemy-only kits (2 attack skills, existing mechanics only, no new mechanics per Tanveer). If any becomes playable, Tanveer crafts the playable kit himself.

| Character | Seed | Element/role | Notes |
|---|---|---|---|
| gale | 777401 | wind / green striker | teal-green spiky hair, scout leathers + wind scarf, green gust swirls |
| frost | 777402 | ice / blue control | pale-blue hair, white frost mage robe + fur trim, ice shards |
| iron | 777403 | steel / dark tank | dark hair, heavy steel plate, glowing iron greatsword, sparks |
| prism | 777404 | light / light support | white hair + gold eyes, white-gold radiant robe, crystal shards + light halo |

#### Sea monster (Ch8 lake beast, 2026-07-18)

| Character | Seed | Notes |
|---|---|---|
| sea_monster | 777307 (batch idx 1) | LIVING rock-armored behemoth (Tanveer: alive, not a mechanical golem - Duke/Batra provoke it and ride its lunges across the lake). Muscular grey rock-scaled hide, snarling frilled head, clawed limbs, moss, green acid veins, huge rock-shell back as a platform. Dedicated model replacing the Ch8 "reuse Wild Beast" note. Alt (81, taller draping-armed lurker) in `public/unreleased/sea_monster_alt.png`. **Kit deferred - will get a premium boss kit (2nd main boss after Tao), not a generic 2-skill enemy.** Design path: rejected serpent (65/66) then fleshy brute (71/72), landed on living-golem hybrid. |

Full prompts recoverable from ComfyUI history / git log.

### NPC boss copies of playable characters (2026-07-12)

When an official character appears as a story-battle enemy, it gets a dedicated `storyOnly` NPC kit with tweakable stats (raised HP for a multi-turn boss fight, `tier: "elite"` for 3 actions/turn). The NPC copy **reuses the playable character's art** — no regeneration: copy `public/characters/<base>.png` → `public/npc/<base>_npc.png` and register `<base>_npc` in the `NPC_ART` set in `characterArt.ts`.

| Character | Art source | Notes |
|---|---|---|
| lyra_npc | copy of `lyra.png` | Part 2 boss. 3300 HP / 250 ATK (Tanveer's tune), elite tier |

## Banner splash art (compositing, not a fresh render)

Gacha banner splash art (`public/banners/*.png`, 1536×768, 2:1) is **not** generated as a single
txt2img scene — every other prompt in this pipeline negatives "multiple characters", and a real
12-up group render isn't something this checkpoint/workflow has ever attempted. Instead it's a
composite built from existing character portraits:

1. Pick up to ~6 of the most appealing/recognizable characters from the banner's featured roster —
   don't try to fit everyone even if the banner features more.
2. Background-remove each with ComfyUI's `remove_background` (BiRefNet `BiRefNet_toonout` model,
   via the `comfyui-rmbg` custom node — `install_custom_node id 'comfyui-rmbg'` + restart if not
   already installed). **Caveat:** BiRefNet treats a character's signature effect/aura (water
   swirl, lightning, card-toss particles) as foreground, so it does **not** produce a clean
   silhouette — only the flat corners of the card's gradient background get removed. Tanveer's
   call (2026-08-02): that's fine, the leftover aura reads as intentional as long as it doesn't
   look like a hard rectangle.
3. Composite in Python (PIL) onto a generated radial burst background (amber-900 → zinc-950,
   matching the locked UI palette): resize each cutout, apply a radial alpha falloff (`inner_r`/
   `falloff_span`/`feather` params) so the character's own leftover flat-gradient patch fades into
   the shared background instead of showing a visible box edge. Characters whose source art has a
   frame-filling effect (water, lightning) need very little falloff; characters with a plain flat
   card background need a much tighter `inner_r` (~0.4) and heavier feather (~26) or the rectangle
   stays visible — this was the main iteration loop building the first banner.
4. Two most "hero" characters get a bigger scale + lower placement than the rest; add a title
   wordmark (arialbd, amber-400 fill, dark outline) bottom-center over a bottom shade gradient for
   legibility.
5. Script lives session-local (scratchpad), not committed — rebuild from scratch per banner rather
   than trying to generalize a reusable tool prematurely.

**Debut/V1 banner** (`public/banners/debut-2026-08.png`, 2026-08-02): Duke, Seras (heroes, larger/
lower), Lyra, Sara, Chiara, Gabrist. Title reads "V1. BETA ROSTER BANNER" (Tanveer's rename from the
generic "Debut Banner" — see `docs/design/GACHA_DESIGN.md`).

## Inventory icons (2026-08-20)

512×512 RGBA cutouts in `public/items/`, registered in `lib/game/materialArt.ts`.
Brief and per-item notes: Category C of `docs/ART_REQUESTS.md`. Fifteen shipped in one
session (14 rendered + a coin salvaged from a two-coin roll); the five coin frames are
**not** rendered at all — see below.

**Generate at 1024, ship at 512.** SDXL is undertrained at 512 and a direct 512 render
comes out mushy. Render 1024 → `remove_background` → downscale.

**Frame the icon in post, not in the prompt.** This is the single biggest win of the
batch. Weighting "filling the frame" up to 1.4–1.45 does not make the object bigger —
it makes Animagine produce **macro abstraction** (a gold coin became a gold ribbon; a
scroll became a rose). Prompt calmly for "a single X, centered, the whole object
visible with a little space around it", then after cutting the background out, crop to
the **alpha bounding box** and pad back to square with a fixed 6% margin. Every icon
then fills the same share of its own frame regardless of how the model framed it, which
is what Category C's "must read at 24px" actually depends on.

**Say "still life", never "game item icon".** See the trigger-word table — that phrase
returns a grid of twenty small items.

**This checkpoint draws what anime draws.** Crystals, eyes, thorns, books, embers,
metal plaques: first or second roll. A blank paper ticket stub: **five failed rolls**
across four differently-worded attempts (framed picture → red blob → abstract shapes →
featureless card). Both tickets shipped only once they were re-conceived as *stamped
metal plaques* — gold with a star for the permanent ticket, steel with an arrow for the
auto-clear one. If an item is not a thing anime illustration draws, change the object
rather than the adjectives.

**BiRefNet punches holes in an object whose colour matches its plate.** The leather
training manual came back as a hollow frame because its brown cover matched the brown
background. Fix: flood the background inward from the image border, and anything
background-coloured the flood cannot reach is an interior hole — make it opaque. Apply
this **per icon, never across the set**: `bramble_thorn`'s stem curls into a closed loop
that is supposed to be see-through, and a blanket fill turns it into a blob.

**Silhouettes have to differ inside a family.** Five currencies sit next to each other in
the nav, so they were deliberately given five shapes: round coin, tall gold plaque, square
steel plaque, crystal cluster, single amber shard. Two of the shipped icons stay weak at
24px — `bramble_thorn` and `corroded_seaweed` are thin-line subjects with no mass — which
is recorded in ART_REQUESTS rather than fixed, since both read fine at 44px and up.

## Character coin frames — drawn, not generated (2026-08-20)

`public/items/coin_frame_{blue,red,green,light,dark}.png` are rendered by a **PIL script**,
not by ComfyUI. A character portrait is composited through the middle in code, so the
transparent window has to be exactly concentric, exactly circular and identical across all
five — a txt2img roll gives a slightly off-centre, slightly elliptical ring every time and
the compositor cannot rely on it. The script supersamples 4× for antialiasing and shades a
bevel lit from the upper left, with a darkened outer contour and an occlusion ring just
inside the window so the portrait reads as sitting *in* the coin. Five frames cover all 18+
coin ids and never go stale as characters are added.

## Story scene backgrounds (2026-08-20)

1344×768, in `public/backgrounds/`, registered by filling in `image:` on the matching slug
in `lib/game/storyBackgrounds.ts` — one edit lights up every scene using that slug. Specs
and constraints: Category A of `docs/ART_REQUESTS.md` (no characters, quiet lower third,
never background-removed, pitched darker than a character card).

**Generate only slugs the story actually references.** The registry carries 14 slugs;
`data/story/chapter-1.json` names 4. Rendering the other ten would be art for scenes that
do not exist.

**A location's before/after pair must be img2img, never two txt2img prompts.** This was
learned the expensive way on `village_ruins`: **five** txt2img attempts across four
rewordings all failed, alternating between **intact** buildings (a creepy-but-whole village,
a two-storey town street) and **empty land** with no buildings at all (aerial green fields,
burned stakes in mud). Adding "collapsed / charred / ruins / destroyed" moves it between
those two failure modes rather than to the middle, and even the individually-good rolls were
architecturally unrelated to `village_peaceful` — the model will not hold building design
across two separate prompts.

**img2img from the accepted plate solved it on the first batch.** There is no img2img action
on the MCP's `generate_image`; build the graph (`create_workflow` template `img2img`, or POST
the graph straight to `127.0.0.1:8188/prompt`) with the sibling plate staged into ComfyUI's
input dir. Findings worth keeping:

- **Denoise 0.84 is the number.** 0.60 leaves the village essentially undamaged, 0.72 damages
  it but keeps the grass green, 0.84 fully re-renders the surfaces while holding the layout,
  the hut silhouettes and the horizon. 0.88 starts losing the composition.
- **Do not ask for an empty foreground here.** Adding "(wide establishing shot with an empty
  clear dirt lane in the foreground:1.3)" pushed every building to the frame edges and
  returned burned *farmland*. The quiet lower third came for free from the source plate's own
  composition — the source is already doing that work, so let it.
- Negative-prompt `empty field, bare land, no buildings, plowed farmland` to hold the
  buildings in frame at high denoise.

## What this checkpoint can and cannot compose (2026-08-20)

Fifteen scene plates in one session produced a reliable map. Animagine is an anime
**character** model; its background competence is uneven in ways that are consistent
enough to plan around. **When a plate fails, change the framing to a mode on the left,
rather than rewording the same framing.** Rewording burns rolls; re-framing works
first or second try.

| Renders well, first or second roll | Fails repeatedly, however worded |
|---|---|
| Streets and avenues in one-point perspective | Aerial / bird's-eye cityscapes |
| Interiors with furniture in them | Empty plazas, courtyards, forecourts |
| Landscape with one clear subject (a boulder, a hut row) | "A clearing" — open ground ringed by trees |
| Forest and foliage depth | Rows of benches (returns a counter every time) |
| Building rendered *in isolation* | That same building with sky and ground around it |

Worked examples of the re-framing move:

- **`city_toll_metropolis`** — "vast city panorama from a rooftop" gave a flat field of
  rubble twice. Re-framed as *a wide avenue seen down its length, tall blocks either side,
  viaduct overhead, cranes above the rooflines* → first try. The scale cues survive fine at
  street level.
- **`exam_compound_exterior`** — "a walled courtyard compound" gave abstract pillars.
  Re-framed as *an avenue running between two long administrative halls* → first try.
- **`exam_waiting_room`** — three attempts at "rows of wooden benches" all returned a
  reception counter. Solved by **reuse**: a colonnaded hall generated as a rejected
  compound attempt was a better waiting hall than anything the bench prompts produced.
  Check the reject pile before re-rolling.

**`bureau_exterior` needed a composite.** Eight attempts established that this model will
render a fine civic building on a blank void and will not put a sky and a street around it
— any denoise low enough to keep the architecture also keeps the emptiness, and any denoise
high enough to fill the frame destroys the building. The pipeline that worked:

1. Generate the building alone (it comes out on a flat field, which is the usual failure).
2. `remove_background` it — a flat field cuts perfectly.
3. **Block the composition in with PIL**: sky gradient, horizon haze band, ground plane,
   subject seated on the horizon at a chosen scale with a contact shadow.
4. img2img that composite at **denoise 0.42–0.60** so the model only blends and details a
   composition it did not have to invent.
5. Grade (below).

**Grade every plate before shipping.** Category A wants backgrounds "darker and less
saturated than a character card", and a roll that looks right on its own is reliably a stop
or two too bright for a layer that sits behind cel-shaded figures. Three operations:
slight desaturation, a blend toward a cool dark, and a **bottom-weighted vignette** — which
does double duty, since the dialogue box sits in the lower third and needs the contrast.

**img2img denoise ladder for scene plates** (source is a sibling plate):

| Denoise | What it does |
|---|---|
| 0.42–0.60 | Blends a composite; will **not** change time of day — a dusk prompt at 0.45 still returned daylight |
| 0.55–0.66 | Weather swap on the same terrain (the training ridge's snow and storm variants) |
| ~0.68 | Changes the light convincingly while holding architecture (the venue's day → night) |
| 0.72–0.84 | Full surface re-render keeping layout (`village_ruins`, the pine → jungle conversion) |
| 0.88+ | Composition starts going |

**Low denoise on high-frequency foliage speckles.** A 0.50 pass over a dense jungle plate
came back covered in noise dots. Either go above ~0.7 there or grade instead.

**Grade, don't re-roll, for a time-of-day sibling.** `jungle_path_dusk` is a graded copy of
the day plate after img2img dusk attempts failed twice. Same place, obviously, and free.

**`jungle_clearing` took eight attempts and its own method.** Straight prompting for
"open ground ringed by jungle" returns, in order: mush, a pond, a botanical specimen
illustration on a blank field, and — from an img2img over open ground — hands growing out
of the soil. What worked: **block the ground in with PIL, then img2img at denoise 0.80.**
Sample the source plate's own trail colour rather than inventing a brown, lay it into a
feathered ellipse across the lower half with a little noise and a front-to-back luminance
ramp, then let the model turn that flat field into real ground.

The denoise number is the whole trick and it is narrow:

- **Below ~0.7 over dense foliage the image shreds into vertical stripe noise.** Not
  softening — total destruction. The high-frequency trunks amplify into bars. This is the
  same failure as the speckled dusk attempt, and the flat blocked-in region makes it worse
  because the sampler has nothing to lock onto.
- **~0.80** re-renders everything while still following the blocked composition.
- **0.88+** turns the clearing into a ravine.

So the composite-and-blend recipe splits in two: a **hard-edged subject on smooth ground**
(`bureau_exterior`) blends at 0.42–0.60, and an **organic high-frequency scene**
(`jungle_clearing`) needs 0.80. Low denoise is not the safe default it looks like.

## Adding a New Character

**Workflow (agreed 2026-07-07):** Tanveer supplies the locked design — or at least a blueprint/idea — for any character without one. Generate from that. The three AI-invented designs below (Mustafa, Siddiq, Yalina) are placeholders to be regenerated once he provides theirs.

1. Write the positive prompt from the template using the character's locked design (or Tanveer's blueprint; only invent as a stopgap and note it here).
2. Generate, inspect at full size, fix color bleed per the rule, re-roll seed if pose is weak.
3. Copy to `public/characters/<id>.png`, add id to `lib/game/characterArt.ts`, add a row to the table above.

## Consistency Rules

- Never change the checkpoint or the style block without regenerating the whole set.
- Keep 1024×1024 — UI crops with `object-cover object-top`.
- Backgrounds stay dark + element-tinted so cards read on the dark UI.
