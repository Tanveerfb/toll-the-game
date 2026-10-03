# Art Pipeline (non-character art)

All character art is **AI-generated locally** (ComfyUI, RTX 5060 Ti). Style target: **Dokkan Battle card art × 7DSGC character renders** — bold cel shading, thick clean lineart, vibrant saturated colors, dynamic pose, element-tinted gradient background.

## Setup

- ComfyUI portable @ `E:\Installed\ComfyUI_windows_portable` (`run_nvidia_gpu.bat`, API on `127.0.0.1:8188`)
  - **A session starts it detached:** PowerShell `Start-Process` on
    `python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build`.
    **Never use a Bash background task:** those are killed at their time limit
    (30 minutes by default), and the queue dies with the server. That happened
    mid-batch on 2026-10-02.
  - The `scripts/lora/` scripts run on system `python`. The embedded Python's
    `._pth` file leaves the script's folder off the path, so `import common`
    fails there.
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

## Character art lives in its own file now (2026-10-03)

**The current method for character, kit and card art is
[`docs/CHARACTER_ART.md`](CHARACTER_ART.md),** walked step by step by the `charart`
skill. The old prompt template, the shipped-portrait register (v4 set, NPC copies)
and the whole character-layer and LoRA history moved verbatim to
[`docs/archive/ART_PIPELINE-character-history.md`](archive/ART_PIPELINE-character-history.md).
This file keeps setup, folders and the non-character art below.

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
