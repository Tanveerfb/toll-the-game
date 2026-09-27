# Character Art Pipeline

All character art is **AI-generated locally** (ComfyUI, RTX 5060 Ti). Style target: **Dokkan Battle card art × 7DSGC character renders** — bold cel shading, thick clean lineart, vibrant saturated colors, dynamic pose, element-tinted gradient background.

## Setup

- ComfyUI portable @ `E:\Installed\ComfyUI_windows_portable` (`run_nvidia_gpu.bat`, API on `127.0.0.1:8188`)
- Checkpoint: **`animagineXL40_v4Opt.safetensors`** (Animagine XL 4.0)
- Settings: 1024×1024, 28 steps, CFG 7, `euler_ancestral` / `normal`
- Output → copy to `public/characters/<color>_<id>/portrait.png` (one folder per unit, colour from the kit); register the id in `lib/game/characterArt.ts`
- ~12s per image

## Where art lives: one folder per unit (his call, 2026-09-27)

*"when we select new assets, can we organize them in proper structure and
naming? for e.g. blue_lyra folder would have all of her assets in there."*
He then said *"do both folder structures and red_lyra yes"*. The folder is
`<element color>_<id>`, and the colour comes from the kit
(`data/characters/<id>.json`). A future colour variant of a character, 7DSGC
style, therefore gets its own folder.

**In the game** (`lib/game/characterArt.ts` derives every path through
`artFolder()`; `tests/characterArt.test.ts` checks every registered file
exists):
```
public/characters/red_lyra/portrait.png        card portrait, 1024x1024
public/characters/red_lyra/skills/<slug>.png   skill and ultimate art, 832x1216
public/characters/red_lyra/cards/pose-c4.png   full-body card poses (no screen yet)
public/npc/<color>_<id>/...                    NPCs and bosses, same layout
```
`sea_monster` has art but no kit, so its folder is a bare `sea_monster/`.
Nothing renders it.

**Working files on his PC** (ComfyUI `output\`, outside the repo):
```
output\red_lyra\<piece>\drafts\   candidate renders he picks from
output\red_lyra\<piece>\work\     mattes, grips, intermediates
output\red_lyra\<piece>\final\    finished pieces (a copy of what the game ships)
output\red_lyra\lora\             the LoRA dataset candidates and checkpoint tests
output\references\7dsgc\skeletons\  DWPose skeletons from his 7DSGC references
```
Each piece is a slug: `card-art`, `flash-point`, `shatterburn`, `latent-heat`,
`supercooling`. A new render's `filename_prefix` goes straight into this
layout. `output\_moved.tsv` records every file moved on 2026-09-27.

**The whole output folder was sorted the same day** (*"sort as much as
possible"*):
- Other units: `blue_duke\` (character design and WAN animation tests),
  `red_leorio\`, `green_ban\`, `green_gon\` and a few more. Files named only
  by ComfyUI were matched by the character name in the prompt that ComfyUI
  embeds in each PNG, and go in `<unit>\misc\drafts\`.
- Everything else by kind: `items\` (inventory icons), `backgrounds\`,
  `story\backgrounds\` (kept for when story mode returns), `sea_monster\`,
  and `_other-projects\stashly\`.
- **`_unsorted\` still holds 209 renders** whose prompts describe a look but
  name nobody. They are left rather than guessed; sort them as each
  character's art gets made.

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

NPC/enemy art lives in **`public/npc/<color>_<id>/portrait.png`** (per-unit folders since 2026-09-27; flat `public/npc/<id>.png` before that) (separated from playable `public/characters/` as of 2026-07-18). `getCharacterArt` routes NPC ids via the `NPC_ART` set to `/npc/`. Generic enemy kits — no character sheets, AI-invented per element. Shown only in the hidden `/archive/npc` page and in story battles.

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
4. Two most "hero" characters get a bigger scale + lower placement than the rest; add a bottom
   shade gradient for legibility.

   **No title wordmark on the plate** (Tanveer, 2026-09-01). It used to be painted here — arialbd,
   amber-400 fill, dark outline, bottom-center — and `BannerScreen` renders the banner's name as
   its own heading directly above the art, so every plate carried its title twice. Worse on a
   phone: a centred `object-cover` crop at 393px cuts the band in half rather than dropping it,
   which is how it was found. Keep the shade gradient — it is doing legibility work for the DOM
   heading laid over it. The **text** is what goes.
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

## Logos and marks — drawn, not generated (2026-08-22)

The app icon was the second asset in this project that a diffusion model could
not produce, and it failed for the same reason as the first (the coin frames):
**a mark is geometry, and a roll cannot promise geometry.**

**Animagine returns an item sheet when asked for an emblem.** Four directions —
metal crest, five elemental shards, engraved coin, stone gateway — eight images,
and every one came back as a scatter of about twenty small objects, several with
a stray hand and baked-in gibberish text. This is the same failure the inventory
pass hit with the phrase "game item icon", except here it fired on *"emblem"*,
*"badge"*, *"medallion"* and *"crest"* too. Treat all of them as set-words: they
summon a collection, not a single object, and no amount of "a single" in front
fixes it.

**Two things did fix it**, and they are worth reusing for any object render:

1. **`no humans` as a POSITIVE booru tag.** Animagine is a character model; with
   no character in the prompt it invents one, and `hands` in the negative does
   not stop it. `no humans` does, immediately. Pair it with `simple background,
   black background` — also booru tags, also positive.
2. **A short subject line.** The failing prompts stacked six adjectives and a
   colour list. **A colour list makes it draw one object per colour** — "crimson,
   azure, emerald, gold, violet" produced five separate gems every time. One
   subject, one accent colour, and stop.

With both applied, `a single stone gateway arch, centered, closed barrier pole,
glowing cyan lantern` produced a clean single centred object on black, first
roll. It was still not used — see below.

**Flux is not usable on this install.** `flux1-dev-fp8-e4m3fn.safetensors` sits
in `checkpoints/` but is **UNet-only**: it fails at `CLIPTextEncode` with
`clip input is invalid: None`. There are no Flux text encoders (`umt5_xxl` is
WAN's) and no Flux VAE. All five vector/icon LoRAs — `Simple_Vector_Flux_v2`,
`flux_vector_style`, `Icon-Kit`, `DD-vector-v2`, `Vector_lora_weights` — are
behind that same ~10GB download and are equally unavailable until it happens.

**Why the good roll still lost.** It is an *illustration*, and an illustration
dies at 48px: thin columns, fine lineart and lantern detail all collapse into
mush. An app icon has three requirements that are arithmetic rather than art —
exact centring, an 80% maskable safe zone (Android crops to a circle, a squircle
or a rounded square depending on the launcher), and legibility at thumbnail. So
the shipped mark is drawn: `scripts/logo_candidates.py`, five candidates plus a
contact sheet that renders each at 256/96/48px, because **the only size that
matters is the one nobody checks until the icon is on a phone.**

**Two revisions, both figure-ground problems invisible at full size.** Two
concentric rings moiréd at 48px — one ring now. And the gate was originally cut
*out* of a cyan coin face, which made the dark shape the figure and the whole
mark read as a **padlock**; inverting it to a dark face with a cyan gate fixed
it, and is also the version that still reads as an arch at 32px rather than
going to a blob.

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
3. Copy to `public/characters/<color>_<id>/portrait.png`, add id to `lib/game/characterArt.ts`, add a row to the table above.

## Consistency Rules

- Never change the checkpoint or the style block without regenerating the whole set.
- Keep 1024×1024 — UI crops with `object-cover object-top`.
- Backgrounds stay dark + element-tinted so cards read on the dark UI.
---

## Character-layer pipeline (2026-09-20) — the Dokkan-style layered method

**This supersedes the one-image-per-character approach above for any NEW
character art.** The 31 shipped portraits stay as they are; they are finished
art and they become *reference*, not source.

### Why

Tanveer adopted Dokkan's production model after reading a card's asset list
(`dokkandb.com/cards/1034001`, 33 files). Every card is composited from **three
source layers** — `_bg`, `_character` (transparent), `_effect` — and the same
`_character` layer also produces the thumb and the circle. **That is how their
characters look identical everywhere: one render, reused by construction.**

Ours needs a fourth: **the weapon is its own layer.** Lyra's shipped portrait
has no actual hand on the bow and a bowstring attached to nothing, because a
long thin continuous line is what diffusion is worst at. Drawn once, composited,
correct forever — same reasoning as the coin frames and the app icon.

**You cannot retrofit this onto the existing portraits.** Measured: BiRefNet on
`lyra.png` left **23% transparent**, keeping the painted glow and petals as
foreground. The standing rule further up this file already predicted that — her
portrait simply predates it.

### The recipe that worked (Lyra, run v7, approved 2026-09-20)

| | |
| --- | --- |
| Checkpoint | `animagineXL40_v4Opt.safetensors` |
| Size | **832×1216** (portrait bucket) |
| Sampler | `euler_ancestral` / `normal`, **30 steps, CFG 6** |
| Identity | **IP-Adapter `PLUS FACE (portraits)`**, weight **0.6**, `end_at` 0.75 |
| Identity reference | **A HEAD-AND-HAIR-ONLY CROP** of the approved portrait |
| Pose | **ControlNet `controlnet-openpose-sdxl`**, strength **0.6**, `end_percent` 0.75 |
| Background | `white background, simple background` — nothing else |
| Matte | `BiRefNetRMBG`, model `BiRefNet_toonout`, `refine_foreground: true` — **see the 2026-09-21 note below: `BiRefNet_toonout` is no longer selectable** |

Result: **80.1% transparent, all frame edges clean, 1.2% soft edge.**

### Five failures and their causes — read this before changing anything

1. **Costume colour bleeds everywhere.** The white pleated skirt kept coming out
   as a long red one. **Cause: the IP-Adapter reference contained her red top.**
   IP-Adapter reads a global colour signal, not "this is her shirt". **Crop the
   reference to head and hair only.** This is the single highest-value rule here.
2. **The reference's background gets copied in.** At PLUS/0.75 on a full-image
   reference, her portrait's petals and swirls came back verbatim and overrode
   `white background`. Face crop + PLUS FACE + lower weight fixes it.
3. **She renders as a child.** Animagine skews young. Lyra is 25; prompting "25"
   produced a teenager. **Aim at `late 20s` / `28 years old` to land on 25**, and
   negative `child, loli, teenager, chibi, baby face`.
4. **Pose cannot be prompted.** `standing at ease` was ignored every time — the
   model wants a hero shot, and drifted into hip-thrust/low-angle cheesecake that
   contradicts her characterisation. **ControlNet is not optional for a neutral
   layer.**
5. **Over-conditioning destroys the image.** ~30 negative terms at 1.4–1.5 plus
   ControlNet 0.85 plus IP-Adapter 0.65 at CFG 7 produced rainbow edge halos and
   blown-out colour. **Subtract, don't add:** keep the negative short, cap weights
   at ~1.2, ControlNet ~0.6.

### The pose skeleton is DRAWN, not sourced

A character layer needs an exact, boring A-pose — that is arithmetic. Script kept
at `Plans/` scale in the session transcript; regenerate with PIL, COCO-18 layout,
832×1216 canvas, black ground, standard OpenPose limb colours, joints at:

```
nose(416,300) neck(416,375) Rsho(338,390) Lsho(494,390)
Relb(304,530) Lelb(528,530) Rwri(278,668) Lwri(554,668)
Rhip(364,690) Lhip(468,690) Rkne(360,870) Lkne(472,870)
Rank(358,980) Lank(474,980) Reye(392,285) Leye(440,285)
Rear(370,296) Lear(462,296)
```

Knees sit at y=832. **These are the corrected numbers** — the first version put
ankles at 1048 and knees at 870, which ran the boots off the bottom edge and
clipped the cutout there. At 980/832 the finished layer has ~20px clearance
under the boots and the silhouette survives matting intact.


### The hand pass (2026-09-21) — wired and working

At full-body resolution each hand is ~40px, which is why they render as mittens.
The fix is to detect them and re-render each one at 512px.

```
UltralyticsDetectorProvider(model_name="bbox/hand_yolov8s.pt")
  -> BboxDetectorSEGS(image, threshold 0.35, dilation 16, crop_factor 3.0, drop_size 8)
  -> DetailerForEach(image, segs, model/clip/vae from the CHECKPOINT,
       guide_size 512, max_size 1024, steps 24, cfg 6,
       euler_ancestral/normal, denoise 0.55, feather 8,
       force_inpaint true, noise_mask_feather 20)
```

Hand prompt is its own pair, not the character prompt: *"a detailed human hand,
five fingers, relaxed open fingers, dark red fingerless glove, gold bracer at the
wrist, clean thick lineart, cel shading, anime"* against *"bad hand, extra
fingers, fused fingers, mitten, blob, clenched fist, deformed"*.

**Use the plain checkpoint model, not the IP-Adapter-patched one** — the face
reference has no business conditioning a hand.

Three constraints learned by hitting them:

1. **`BboxDetectorSEGS` rejects image batches outright** (`does not allow image
   batches`). So the pipeline shape is fixed: **generate a batch → pick one →
   detail the pick.** That is the right shape anyway, since only one image per
   character gets approved.
2. **Detail before matting, never after.** The detailer works in RGB; running it
   on a transparent layer fights the alpha.
3. **denoise 0.55 corrects anatomy but will not re-pose.** It turns a mitten into
   readable fingers; it does not open a closed fist, whatever the negative says.
   If a shot needs open hands, pose them in the skeleton rather than hoping the
   detailer opens them.

Verified on Lyra 2026-09-21: both hands went from unreadable pink shapes to
articulated fingers with clean glove edges, and the matte was unaffected —
**80.0% transparent, zero contaminated edges, full silhouette intact.**


### Pose rules for a card render (2026-09-21) — from six references he chose

Read end to end: five Dokkan character layers (Videl 1029620, Android 18
1017840 and 1030920, Caulifla 1013410 and 1020390) and one Genshin splash
(Collei, entry/2268). The Dokkan layers were pulled straight from
`api.dokkandb.com/assets/character/card/<id>_folder/card_<id>_character.png` —
the transparent pose layer, which is the useful one. (The site's ASSETS button
also works but takes 5–10s to populate.)

**Six rules every one of them obeys:**

1. **Never symmetrical.** Body on a diagonal, shoulders and hips counter-rotated.
2. **One OPEN HAND toward the viewer**, fingers visible and usually foreshortened.
   All six have it, always on the non-weapon side. It is the most consistent
   single element in the set.
3. **Asymmetric arms** — one extended or raised high, the other cocked back or
   tucked. Never matching.
4. **Feet off the ground.** All five Dokkan cards are mid-air; Collei has one leg
   raised.
5. **Face turned to camera and readable**, however far the body is twisted away.
6. **Mass at the top of the frame** — flared hair (Caulifla, 18) or a weapon held
   upright (Collei).

**Format, and the two families differ:**

- **Dokkan character layer: 426×568, figure CONTAINED**, filling the frame but not
  breaking the edges. That is the right shape for a compositable source and
  vindicates the contained framing used for Lyra's layer.
- **Genshin splash: figure BREAKS the frame** at the bottom, over a flat
  element-tinted gradient, with the effect layer as element-coloured swooshes,
  sparkles and a large motif shape behind the figure.

**Correction to #151's premise.** Claude told him Genshin bow users mostly do not
show the bow. **Both bow users he sent hold one** — Collei and Gorou. The premise
was weaker than stated; the *decision* stands, because it was made on effort
grounds, not on what Genshin does.

**But Collei shows a middle path #151 did not consider: the bow is HELD, not
USED.** Carried vertically beside the body in a relaxed grip, undrawn, unaimed.
That reads as "archer" instantly while avoiding the drawn-string-and-gripping-
fingers pose that has broken every previous attempt.

**The finding that matters most: Lyra's approved character layer breaks all six
rules.** Symmetrical, both arms down, both feet planted, square to camera, no open
hand, nothing at the top of the frame. That is **correct for a source** — neutral
for matting, ideal as LoRA training data, composites into anything — and it can
never be the card. His own reaction on seeing it: *"it doesn't look action packed
to me."*

So a character needs **two poses**: the neutral A-pose source, and a card pose
built to the six rules above. Both come from the same skeleton generator; only the
joint coordinates change.


### Building the card pose (2026-09-21) — what the first two batches cost

Twelve images, two kept. The generator is the same script as the A-pose
skeleton with different joint coordinates, exactly as claimed — but the first
batch was a total loss and both causes were authoring mistakes, not bad rolls.

**v1: every image came back with a hand bigger than her head, and one grew a
second head.** Two things caused it and they reinforced each other:

1. **The skeleton had stub arms.** To "signal" an arm coming at the viewer, the
   upper arm was drawn at 87px and the forearm at 75px against a 166px thigh.
2. **The prompt asked for it too** — `(open palm, spread fingers:1.2)` plus
   `foreshortening`.

A short arm plus an emphasised spread hand plus the word *foreshortening* reads
to the model as **a hand pressed against the lens**, and it obliges. This is
failure #5 of the five above (*"subtract, don't add"*) arriving from a new
direction: the over-conditioning was not in the negative, it was an emphasis
weight on a positive clause.

**The rule that falls out: foreshortening is the PROMPT's job, and a gentle
one. The skeleton supplies a real limb.** `make_pose_card.py` now prints a
limb-length table and flags anything under **100px** as a stub, with the one
deliberately foreshortened limb named in the script so it is declared rather
than discovered in the render. That check is cheap and it would have caught the
whole batch before the GPU ran.

**ControlNet 0.6 is a NEUTRAL-pose number. A dynamic pose needs ~0.78.** At
0.6 the raised arm was ignored in five of six — both arms went reaching,
because the prompt's own language beat the conditioning. The A-pose tolerates
0.6 because a neutral standing pose is what the model wants to draw anyway; an
asymmetric one has to **overcome** the model's instincts. At **strength 0.78 /
`end_percent` 0.85** the raised arm took in six of six. Nothing else moved:
CFG 6, 30 steps, PLUS FACE 0.6, same head-and-hair reference.

**Costume drift is the new failure mode at this pose strength.** Three of six in
the good batch broke the outfit — a white top instead of crimson, a blue skirt
instead of white, thigh-high boots instead of crimson ankle boots. A neutral
A-pose never did this. The working theory is that the dynamic-pose clauses eat
prompt weight the costume clauses used to hold; **QC every card render against
the approved A-pose layer side by side**, which is what the survivor sheet does.

**Rule 2 is still unsolved.** *One open hand toward the viewer* is the most
consistent element in all six references and neither survivor has it: the
skeleton puts the reaching wrist in front of the hip, which renders as an arm
held out to the SIDE. The version that genuinely points at the camera is the
one that blew up in v1. Untried middle ground: a full-length arm angled ACROSS
the body with the palm rotated to camera — near-normal limb lengths, no
emphasis weight, the turn carried by the wrist rather than by scale.

**No weapon in the card after all.** Tanveer, mid-batch: *"you don't have to
generate her artwork with the bow in the frame or in her hands, it can be just
her doing a pose."* This puts the card back inside **#151** — character art
carries no weapon — and retires the scaffolding idea that batch 1 was built
around (grip a plain rod, composite `lyra_bow.png` over it). Worth keeping in
mind only if a future shot needs a held weapon: **the render supplies the grip,
never the weapon**, because #151 locks the design and a diffused bow cannot
promise consistency.


### A raised hand needs a JOB (2026-09-21) — the arm-variant comparison

He accepted the pose structure and rejected the same arm in both survivors:

> *"the right hand is fine in both instances but the left one is just awkward
> … that's not like a fight pose slash picture pose kind of standard."*

**Cause: the raised hand was open and empty, so it was doing nothing.** Every
reference has a reason for what is up there — Collei's bow, a Dokkan fist, a
charge, flared hair. An open splayed hand held in the air is not a pose, it is
a hand. A second, smaller cause was geometric: the old arm put the **elbow
further out than the wrist**, so the forearm reversed direction at the top.

**Method — change ONE joint pair and freeze everything else.** Three skeletons
were built from one frozen body (legs, torso, counter-rotation, head turn and
the reaching arm byte-identical), differing only in joints 6 and 7, and run at
the **same seed**. Then a row per variant. When the only variable is the arm,
the comparison answers the question instead of inviting taste to wander, and it
costs one script rather than three.

| | arm | result |
| --- | --- | --- |
| A | straight up and out, open hand | better, but the hand still floats |
| **B** | **raised above the head, clenched fist** | **reads as a fight pose in 3 of 4** |
| C | swept back and down, trailing | **HIS PICK** — C1, C2 and C4, C4 his favourite |

**Rule: give a raised hand a purpose, or do not raise the arm.** A fist is the
cheapest purpose available and needs no prop, which matters under #151 where
the character art carries no weapon.

**CORRECTION, same day — Claude recommended B and Tanveer picked C.** The line
above originally read *"C fails — the arm hides behind the body and reads as
missing"*. That was wrong, and wrong in a specific way worth naming: it was
**taste stated as measurement**. His verdict:

> *"ooo i like some poses from the batch. and those are like usable in official
> capacity too … Good ones — C1, C2, C4 (my fav)"*

What the swept arm actually does is remove the raised arm as a problem entirely
rather than solving it, and let the ponytail carry the top of the frame, which
it was already doing in every render. **Ruling #139 holds: Claude measures, he
decides UI/UX.** "Reads as missing" was not a measurement — transparency
percentages and stub-length checks are. A row rejected on Claude's eye alone
should be shown, not filtered; the two-stage filter exists to remove images with
*defects*, not images Claude does not personally like.

`scripts/draw_lyra_card_arm_variants.py` carries the generator and the two
checks worth keeping: a **stub warning** under 100px, and a **reversed-forearm
warning** when the elbow sits outside the wrist. Both fired on a first draft
here and both were real.

**The costume corrections held.** Naming the frilled collar, weighting the
boots to 1.2, and negating the three specific wrong garments (`blue skirt`,
`white shirt`, `thigh-high boots`) fixed the drift noted above without adding
bulk to the negative. One artefact survives at a low rate — a black trim under
the skirt — and one image came back on a cyan ground despite
`colored background` being negated.


### The matte model in the recipe is gone (2026-09-21)

`BiRefNet_toonout` really was used for the approved A-pose layer — that layer's
PNG metadata still names it — but **`BiRefNetRMBG` no longer offers it**. The
current options are `BiRefNet-general`, `BiRefNet_512x512`, `BiRefNet-HR`,
`BiRefNet-portrait`, `BiRefNet-matting`, `BiRefNet-HR-matting`. The node pack
must have changed underneath. **The v7 recipe above cannot be run as written.**

Replacement chosen by bake-off on one image rather than by name, measuring three
things that matter for a compositable layer — transparency, soft-edge fraction,
and opaque pixels touching the canvas edge (which must be zero, since the figure
is contained):

| model | transparent | soft edge | frame contact |
| --- | --- | --- | --- |
| BiRefNet-HR | 69.8% | 5.63% | 0 |
| BiRefNet-matting | 69.5% | 7.18% | 0 |
| **BiRefNet-HR-matting** | **70.0%** | **6.05%** | **0** |

**`BiRefNet-HR-matting` is the replacement.** Note it lands at ~70% where
toonout hit 80.1% on the A-pose — not a regression, the card pose simply has
limbs and hair spread across more of the frame.

**A clean bake-off does not mean a clean batch.** The same model on the other
two approved poses came back **C1 at 20.4% soft edge** and **C2 with 68 opaque
pixels touching the frame edge**; only C4 was clean at 6.05% and 0. So
**measure every matte, never just the one you tuned on** — those two need a
second pass before they are usable.


### C4 is the design (2026-09-21) — his close inspection of the three

The earlier note records him picking **C1, C2 and C4**. That was his reaction to
the contact sheet; after looking at them properly he narrowed it:

> *"I think C4 is my favorite design. Not C1 or C2. C4."*

**C4 is the approved Lyra card pose.** C1 and C2 are not rejected outright, but
they are not the design.

**Per-image, his words:**

| | verdict |
| --- | --- |
| C1 | *"the left arm's wrist is bent in an awkward way"* — a real defect |
| C2 | *"overall actually she looks good, at least in the grid you showed me"* — approved only at thumbnail size; he has not judged it full-size |
| **C4** | everything good **except the collar, which renders WHITE** |

**The open defect on C4 is the collar colour.** The identity prompt says
*"crimson red sleeveless top with a frilled collar"*, and the collar came out
white anyway. This is the costume-drift failure mode noted above surviving the
corrections that fixed the top, the skirt and the boots — the collar was named
but never weighted, so it is the one garment clause with no emphasis on it.
Untried fix: weight the collar explicitly, the way `(short white pleated
skirt:1.4)` is weighted, and negate `white collar`.

**It does not need a re-roll.** The pose is approved and re-generating risks
losing it. A collar is a small, flat, enclosed region — a recolour or a tiny
masked inpaint keeps the approved image and changes only the defect. Regenerate
only if that fails.

**Still true from the matte pass:** C1 is at a 20.4% soft edge and C2 has 68
opaque pixels on the frame edge, so both would need a second matte anyway. C4
matted clean at 70.0% transparent, zero frame contact.

**C4's collar was recoloured, not re-rolled** (2026-09-27, `ART_REQUESTS.md`
D5): `output\lyra_card_c4_collar_00001_.png`. The white frill trim became
the top's own measured red (median HSV 0.976 / 0.688 / 0.804 over 5,182
pixels of the top), with each pixel keeping its brightness so the shading
survives. 2,199 pixels changed; alpha is untouched, so the matte still
measures 70.0% transparent and 6.05% soft edge. **How the mask was made, and
what failed first:**
- **Colour alone cannot find the frill**: her skin is the same near-white,
  and the shoulder touches the frill. The mask is a **hand-traced polygon**
  following the frill's own dark outline, with a colour test inside it.
- **`SAM2Segment` (text-prompted) is broken here**: GroundingDINO fails with
  `'BertModel' object has no attribute 'get_head_mask'`, a transformers
  version mismatch.
- **`BodySegment` and `FaceSegment` are useless on anime art.** They found a
  few scattered blobs and missed the face entirely.

### Still open

- **Face identity is the remaining gap** — see below.
- **Face identity is "plausibly her", not locked.** IP-Adapter gets the
  neighbourhood; a **per-character LoRA** is what holds a face across the ~4
  artworks each character needs (1 character layer + 2 skills + 1 ultimate =
  **86 skill/ult artworks across the roster**, 50 of which exist and drifted).
  **`accelerate` 1.15.0 is installed** in ComfyUI's `python_embeded` (his
  go-ahead, 2026-09-27; a dry run showed it added nothing else and torch
  2.12.0+cu130 was untouched). **That alone does not make training possible**,
  measured the same day: no training node pack is in `custom_nodes/`, and the
  comfyui-mcp trainer (`train_doctor`) reports no Docker, no native ai-toolkit
  install and no `HF_TOKEN`.
- **The trainer is installed, but must be run directly — not through
  `train_start`** (2026-09-27). ai-toolkit is at
  `C:\Users\Tanve\.comfyui-mcp\training\ai-toolkit` (pinned `a022479`), venv
  on **Python 3.12.11**, torch **2.9.1+cu128**, which sees the 5060 Ti
  (`sm_120`). Three things learned getting there:
  - **`train_doctor action:"bootstrap"` fails on this box.** It built the venv
    on the default Python, 3.14, and `scipy==1.12.0` has no 3.14 wheel, so pip
    tried to compile it and died looking for Fortran. The venv was rebuilt with
    `uv venv --python 3.12 --seed venv`, then torch from the cu128 index and
    `requirements.txt` with `uv pip`. `py -3.12` points at a missing
    `C:\Python312`; uv's managed 3.12 is the one that exists. A harmless
    `sitecustomize` warning about `pip_system_certs` prints on every launch.
  - **`train_start` can only train FLUX.1-dev** (its `model` enum has one
    value), and FLUX is wrong twice over here: our art is Animagine (SDXL),
    and its preset wants 24 GB against this card's 16. **ai-toolkit itself
    trains SDXL** (`model.is_xl: true`, `name_or_path` at the checkpoint file),
    so the plan is a hand-written config run as
    `venv\Scripts\python.exe run.py <config>.yaml`.
  - **Proven by a run on 2026-09-27**, after three more fixes, all needed
    because of Avast's HTTPS scanning or a version slip:
    - **torchaudio.** `requirements.txt` pulled 2.11 against torch 2.9.1, so
      its DLL would not load. Pinned to `2.9.1+cu128`.
    - **`no OPENSSL_Applink` crash.** Avast sets `SSLKEYLOGFILE` machine-wide,
      and this Python aborts on its first TLS connection while it is set.
      albumentations' import-time update check was the first to trip it
      (`NO_ALBUMENTATIONS_UPDATE=1` turns that check off).
    - **Certificate failures.** Hugging Face downloads rejected Avast's root
      certificate until `pip-system-certs` went into the venv. **Launch
      through `C:\Users\Tanve\.comfyui-mcp\training\train.sh <config>`**,
      which applies all three. He then added URL exceptions in Avast for
      Hugging Face, PyTorch and PyPI (2026-09-27), so downloads are no longer
      intercepted. The wrapper stays anyway.
- **Lyra v1 learned almost nothing, and why** (2026-09-27). Settings were
  rank 16, alpha 8, lr 1e-4, EMA 0.99, 1,500 steps, 24 approved images. At
  step 750 the LoRA had learned only "red": the outfit drifted red and her
  hair went *red*, not blue. **Checked in ComfyUI, not only in ai-toolkit's
  samples**, with the same seed with and without the LoRA: the effect was
  close to nil. Cause: two settings each damp the update. Alpha/rank = 0.5
  halves it, and EMA 0.99 makes the saved weights lag. Stopped at 750. Also,
  ai-toolkit's `ddpm` sample sampler is marked possibly unsupported in its
  own code (`toolkit/sampler.py`), so v2 samples with `euler_a`.
- **Lyra v2 works** (2026-09-27): rank 32, alpha 32, lr 2e-4, no EMA,
  2,000 steps, same dataset and captions (`configs/lyra_sdxl_lora_v2.yaml`),
  ~55 min at 1.4–1.6 s/step, 10.3 GB VRAM. Checkpoints every 250 steps in
  `runs\lyra_toll_v2\`; 750–2000 are copied to ComfyUI
  `models\loras\training\`. What was measured:
  - **Trigger word alone** (`lyratoll, 1girl, portrait`, no description)
    draws her dark-blue high ponytail, red frilled top, boots and violet-red
    eyes from step 1000 on. The untrained baseline draws unrelated
    characters. **One consistent miss: her skirt comes out red.** Captions
    leave the outfit out on purpose, and the dataset is flattened on white, so
    a white skirt on a white ground is what it learned weakest. The production
    prompt names the skirt, so this does not bite in use.
  - **Production-style test**: C4's full identity prompt in three situations
    absent from the dataset (running in a field, sitting on a wall at night,
    a wind-blown close-up), same seeds. **Today's method (IP-Adapter face
    ref) got the skirt wrong in 3 of 6** (black). **The LoRA at 1250, 1500,
    1750 and 2000 got it right in 24 of 24**, with top, collar, bracers,
    gloves, boots and ponytail right in every image. LoRA strength 0.9, no
    IP-Adapter.
  - **1500 to 2000 look nearly identical.** **He picked 1500** (2026-09-27:
    *"go with 1500, 1750 is a very close second too"*). It is installed as
    ComfyUI `models\loras\lyra_toll.safetensors`. 1750 stays in
    `models\loras\training\` as the fallback.
  - **One flaw seen on the LoRA side:** in 2 of the 6 step-1500 images the
    frilled collar has a pink or magenta cast, not crimson.

### Weapons are allowed in card art again (2026-09-27) — amends #151

After seeing 7DSGC's UR card art (Lancelot's slung bow, Skuld's giant
crescent blade), his words: *"you could use some weapons in card arts
yes?"* **Ruling #151 took weapons out of character art. This puts them
back**, and the reason #151 existed (diffusion cannot draw a held bow) no
longer applies: the bow is drawn in code and composited. It can be held (the
Flash Point method) or slung on her back (a composite behind the matte).
Filed as **ruling #160**, with a back-link on #151.

### Lyra kit art with the LoRA (complete 2026-09-28)

His bar for kit art: *"we don't need perfection for the kit arts as they will
be small resolution when viewed."*

| piece | status | file |
| --- | --- | --- |
| Card art (portrait) | **C10, his pick**, installed | `public/characters/red_lyra/portrait.png`, `ART_VERSION` 15 |
| Card pose C4, collar fixed | approved, in the card folder (not wired to any screen) | `public/characters/red_lyra/cards/pose-c4.png` |
| Flash Point | **Redone 2026-09-27, approved** (*"flashpoint one looks good tho"*), `ART_VERSION` 17. He asked for a redo because Flash Point and Shatterburn *"basically read as same kind of attack"*. His pick F4: she leaps mid-air at full draw. No aura, his call. The fist is gone: she was rendered holding a bow and the drawn bow was swapped in (`scripts/skill_art/bow_swap.py`, config `bows/flash-point.json`). Layers: attack-class background, motion streaks, a burning shaft and a flash at the head (`compose_bow_skill.py flash`). The earlier aura version it replaces is in git at `3c543f8` | `public/characters/red_lyra/skills/flash-point.png` |
| Supercooling (passive) | **Q07 confirmed** (2026-09-27) over a 24-draft round (`red_lyra\supercooling\drafts\supercool_draft_*`, the first run of his draft-then-finish workflow). Finished with `scripts/skill_art/finish_pass.py` (anime 4x upscale to 1.5x, then a 0.35 img2img pass): cleaner lines and eyes, same picture. **Done:** he picked background 01, Q07's own red, over a drawn crimson and the Latent Heat night (*"01"*). Layers: red-ice shards and glints, and cold mist; no aura (one per character, "not always"). **The slung bow was removed** (2026-09-28): it had no strap (*"Physics where mate?"*, ruling #163). A strap was drawn (`add_bow_strap.py`) and he chose *"Just lose the bow"* instead. `scripts/skill_art/compose_supercooling.py` (no bow by default; a rerun reproduces the installed file pixel for pixel, verified). Her red top on the red ground came out see-through in the matte, so the chest hole is filled by name (`FILL_HOLES`) and background islands are dropped. **No screen shows passive art yet**, so the file ships unwired, like the C4 card pose | `public/characters/red_lyra/passive.png` |
| Shatterburn | **Replaced 2026-09-28 by H2** (*"That one looks good"*), `ART_VERSION` 18. A back view (his idea, after Gawain's skill 2 in 7DSGC), with her left hand really gripping the bow at her side. Made the original way: 12 renders of her holding a model bow, he picked H2, the model's bow and string were masked by hand and repainted out (`bows/shatterburn_h2.json`, seed 11), then the drawn bow was placed in her grip (`bow_swap.py`). Layers: purple attack-debuff background, a burst of light ahead, drifting embers; **no aura and no red-ice shards** (*"You don't have to force them in every art"*). Leftover: a faint pale edge on her fingers, visible only zoomed in. **Rejected on the way:** B3 with the bow in her open hand (*"She isn't holding the bow"*); 4 hand repaints of it, all mangled; B3 with the bow slung and no strap (*"Physics where mate?"*); a release pose (`bows/shatterburn_release.json`, on hold, then superseded). **B1**, a back view with one open hand, is kept for his next Lyra variant: `output\red_lyra\_reserved-for-variant\`. The previous art (aura, full draw) is in git at `3c543f8`. **Earlier the same day a redo was started and dropped:** his pick S6 was a follow-through, bow lowered. Marking and repainting out the model's bow and string took round after round, and he stopped it. His words: *"wasn't expecting you to take this much time"*, and *"guess we will stick to old method for now"*. The old art stays. The S6 work is in `red_lyra\shatterburn\work\bow_swap\` and `bows/shatterburn.json` (its string coordinates are unverified) | `public/characters/red_lyra/skills/shatterburn.png` |
| Latent Heat (ultimate) | **approved** (*"ooo I love that. best art so far? maybe."*), installed, `ART_VERSION` 16. Base is his pick of 16 renders, `latent_storm_00008` (pointing up, no bow in hand), matted with BiRefNet-HR-matting. The model's light streaks are replaced by a drawn violet night and about 40 drawn red-ice arrows in three depth bands (*"the background arrows can be reiterated"*), plus a small aura (*"not too big"*: `aura.py` height 0.35, spread 9). A red sky was tried first and swallowed the red arrows and aura. Built by `scripts/skill_art/compose_latent_heat.py` | `public/characters/red_lyra/skills/latent-heat.png` |

**The bow hand, learned on Shatterburn (2026-09-27): an archer's bow hand is
NOT a fist.** The grip sits in the web between thumb and index finger, with
the fingers wrapped round the handle. His correction: *"her left hand should
be holding the center of the bow and not be a fist"*. Four attempts:
1. **A rendered fist with the drawn bow behind it** (Flash Point and the first
   Shatterburn). This reads as a punch next to a stick. Flash Point had this
   flaw until its 2026-09-27 redo.
2. **Inpainting the hand around a composited bow** (`grip_pass.py`, 0.72 and
   0.85). The fingers came out mangled (*"her hand is mangled up"*).
3. **Prompting "back of the hand to the viewer"** (option C). Useless: the
   words turned into red hand-shaped blobs across the background, and no
   render showed the back of a hand.
4. **WHAT WORKS: render her HOLDING a bow** (option A,
   `shatterburn_gen_a.py`). The model draws a natural grip because a bow is
   really there. Then `compose_shatterburn_a.py` does the swap:
   - cut the model's bow out of the matte (colour near the bow, plus
     everything right of her body except her hair);
   - place the locked drawn bow on the model's grip point, lean and arrow
     line;
   - paste her hand back over the new riser, with the model's grip recoloured
     to the drawn bow's leather.

   This is the method for every future bow shot. Known leftovers are specks
   along the aura edge and a small grip fragment, acceptable at card size.

**The bow method (worked on Flash Point):**
1. Draw an OpenPose skeleton so both hands land where the composite needs
   them.
2. Render with the LoRA plus ControlNet 0.78/0.85, and `bow`, `arrow` and
   `bowstring` in the negative. The model then poses her hands with no bow.
3. `scripts/draw_lyra_bow.py` `render(draw_point, arrow=True, canvas)` draws
   the locked bow with the string pulled to the draw hand and a red-ice
   arrow. The default output stays pixel-identical to `lyra_bow.png`
   (verified). Scale it, rotate it perpendicular to the bow arm, and put the
   grip on the fist.
4. **Paste the original fist and glove pixels back over the bow**, so the
   riser passes behind her fingers.

**Aura** (2026-09-27, his reaction: *"ooo i like it"*):
`scripts/bow_composite/aura.py <image> <matte> <out> <core rgb> <edge rgb>
[height]`. It is drawn behind the figure from the BiRefNet-HR-matting cut-out,
and it is an effect layer (layer 3 of the skill-art stack). Flash Point uses
core `255,200,205` and edge `220,20,45`. **Known limits:** the flame tops are
jagged spikes, not Dragon Ball's tapered tongues, and a red aura on a red
attack card is low-contrast, although he picked red anyway.
`arrow_fx.py` draws three arrow effects (glow, ice shards, streaks). Samples
were shown and none was picked, because the aura won.

**Tried and dropped:** a masked img2img finger pass at 0.55 denoise. It kept
the bow in front of the hand in all four variants. The prototype scripts are saved as-is in `scripts/bow_composite/`:
`archer_pose.py`, `flashpoint_gen.py`, `bow_composite.py`, `fist_over.py`,
and `lyra_kit_gen.py` for the card and passive batches. **Their paths are
retired.** They read and write ComfyUI `output\lyra_kit\` and the old session
scratchpad; `lyra_kit\` was sorted into `output\red_lyra\<piece>\` on
2026-09-27, and `output\_moved.tsv` maps every old name to its new home. The
maintained tools are in `scripts/skill_art/` (next section);
`archer_pose.py` is still current (it gained `shatterburn_release`). The
old Flash Point hand coordinates
were: fist (120, 392), draw hand (530, 372), scale 0.88, tilt 6.5°, fist
box (72, 342)–(168, 438).

### Pose references from 7DSGC art (2026-09-27)

He supplied 7DSGC art as **pose references**, and they are used for that
only. Each image gives a DWPose skeleton; their art never reaches a sampler
(no IP-Adapter, no img2img) and never enters this repo. The folder is
`C:\Users\Tanve\Downloads\7dsgc assets`: 37 card cut-outs at the top level
and 42 kit images in `Kit arts\`. Everything is named `<unit>_<kind>`.
`_names.tsv` in each folder maps back to the original names. Units are named
only where certain; the rest are named by pose and weapon. Skeletons are in
ComfyUI `output\references\7dsgc\skeletons\` (`cards\`,
`cards-whole-image-pass\`, `kit\`).

**What DWPose (`DWPreprocessor`, torchscript models) does on this art:**
- **Run two passes and keep the better one.** The first pass uses the
  `yolox_l` person detector, the second uses `bbox_detector: None` (the whole
  image counts as one person). On the card cut-outs, yolox returned blank for
  16 of 37 and the whole-image pass recovered them all. On the kit images,
  sometimes the other pass won.
- **About half the results are usable.** Limbs are lost under armour, wings,
  capes, heavy effects and rear views.
- **Kit art is only 128×256 to 200×312.** A figure about 60 px tall gives
  fragments. The archer drawing his bow (`blond-archer-boy_skill-drawing-bow`)
  is one example: he was not hand-traced either, because the grip is a blur
  and a trace would be a guess. Our drawn archer skeletons (`archer_pose.py`)
  already cover that pose.
- **The best skeletons are:**
  - Cards: shadow, beta, aqua, card-magician, blue-hair-staff-girl,
    priscilla, blond-archer-boy and emilia.
  - Kit art: blond-archer-boy holding his bow, alpha skill 3, both of the
    blade dancer's arms-spread skills, elizabeth skill 2, shadow skill 2,
    gowther skill 3 and the lancer's skill 2.

### Bow tools and what they cost (Flash Point and Shatterburn redo, 2026-09-27/28)

All in `scripts/skill_art/`, one JSON config per piece in `bows/`:
- **`bow_swap.py`** replaces a model-drawn bow while keeping the model's grip.
  Steps: `mask` (hand-placed strokes and lines on a labelled grid; the hands
  are protected by colour), `prefill` (clears empty ground, blends across her
  body; no AI), `inpaint` (low-noise repaint of body pixels only, several
  seeds), `pick`, then `place` (the drawn bow, hand pasted back).
  **Cost:** Flash Point took over a dozen mask and repaint rounds, and he
  called the time out. H2 took 4 mask rounds and 2 repaints. The slow part is always finding the model's
  string by eye. **Read coordinates off a full-resolution grid, never a
  downscaled crop:** three wrong string lines on the dropped S6 came from
  that.
- **Inpainting the whole bow's path fails.** Every seed invented a limb (a
  glove, a raised hand, an extra bracer) in the empty strip. That is why the
  repaint is limited to `inpaint_zones` over her body.
- **`bow_in_open_hand.py`** draws the bow into an open hand, with nothing to
  erase. It is fast, but **an open hand does not read as holding** (his
  verdict on B3). Use it only where letting go is the point.
- **`grip_hand.py`** (repaint only the hand to close it round a placed bow)
  **failed on all 4 seeds**, the same mangling as `grip_pass.py`. Do not
  retry it.
- **`compose_bow_skill.py`** does the layers: class background, cut-out
  (BiRefNet plus a flood fill, so her white skirt on a white ground stays
  solid) and effects (`flash`; `shatter` with shards only when
  `fx.shards` is set).
- **`paint_out.py`** removes the red hem stripe the model keeps adding to her
  white skirt. Keep the saturation test strict: a loose one repainted her
  thigh.
- **Draft-then-finish is paused, his call** (*"guess we will stick to old
  method for now"*). `finish_pass.py` and the draft scripts remain; ask him
  before using them.

### Character LoRA recipe — APPROVED, frozen (2026-09-27)

Drafted from the Lyra run and **approved by him the same day** (*"approve
the recipe"*). Per his rule, one method for every character: run it as
written, and treat any change to it as his decision.

1. **Dataset, about 24 images, every one approved by him.** His two approved
   images (the card pose and the A-pose), about 11 body shots and about 11
   head-and-shoulders close-ups.
   - Generate with the character's identity prompt plus the IP-Adapter face
     reference at 0.6, no ControlNet, white background.
   - **Body shots at 832×1216. Close-ups at 1024×1024 with the lower-body
     garments REMOVED from the prompt**, and `multiple girls, multiple views,
     lower body` in the negative. Leaving them in crammed two figures into a
     square.
   - Claude filters for defects first (wrong garment colour, extra figure,
     props, halos, crop errors), then he approves.
2. **Captions:** `<trigger>, 1girl, solo, <framing, pose, expression>, white
   background`. Hair, eyes and outfit are left out so the trigger absorbs
   them. Trigger is `<id>toll` (`lyratoll`). Images are flattened onto white.
3. **Trainer:** `configs/lyra_sdxl_lora_v2.yaml` with only the name, trigger
   and dataset path changed. Animagine XL 4.0, rank 32, alpha 32, lr 2e-4,
   no EMA, 2,000 steps, save every 250. Launch with `train.sh`.
4. **Pick the checkpoint in ComfyUI, not from ai-toolkit's samples.** Run the
   identity prompt plus trigger in three situations absent from the dataset,
   same seeds, against today's IP-Adapter method (`lora_test2.py` in the
   session scratchpad; to be moved into `scripts/` if the recipe is
   approved). Take the earliest checkpoint whose results match the later
   ones.
5. **Use:** trigger plus the full identity prompt, LoRA strength 0.9, no
   IP-Adapter.
- **One training method for every character, fixed after Lyra** (Tanveer,
  2026-09-27): *"we will have to find and select a training method once lyra
  batch is done. we will use the same method for all others ... we have to be
  consistent and efficient moving forward."* Lyra is the tuning run. Whatever
  settles there (dataset recipe, caption scheme, trainer config, checkpoint
  choice) is written down as the recipe, and every later character runs it
  unchanged. A change to the recipe is a decision for him, not a per-character
  tweak.
- **Every training image needs his approval before it enters the dataset.** An
  earlier Duke LoRA was trained on unapproved images and came out inconsistent.
