---
name: kitart
description: Steps 3 to 5 of a playable character's art - the slot plan he approves before any GPU time, the dynamic-pose draft batches, the on-model official render and finish pass, and the composites, to the quality of Lyra's kit. Use when charart routes here, or when he says "kit art for <id>", "skill art", "ultimate art", "passive art", "card art", "the poses are stiff", "they look like a photoshoot", "redo <slot>". Runs on his PC only. Never asks him to re-explain the poses: the plan is Claude's to bring.
---

# kitart

Steps 3 to 5 of [`docs/CHARACTER_ART.md`](../../../docs/CHARACTER_ART.md),
with the rules in the skill. `charart` routes here; read its gates and traps.

**Why this skill exists.** Lyra's kit art was the bar. Sara's rounds 1 to 4
missed it: *"awkward poses, bad anatomy, or uncharacteristic"*, *"Is she doing
Kung fu? ... candid shots or photoshoot"*, and he had to supply the pose ideas
himself after round 3. Duke's first round came back *"upright and small"*:
*"Did you even look at how sara and lyra assets are?"*. What separated Lyra's
pieces from those rounds was not a number: **each piece had a concept from
what the skill does and a pose with a job, taken from a reference**, before
anything was rendered. That is step 3a, and it is the step he kept having to
re-explain. It is yours to bring, every time.

## The quality bar: look before you draw

Open, and keep open while planning:

- `public/characters/red_lyra/skills/*.png`, `red_lyra/cards/`,
  `red_lyra/portrait.png`, `red_lyra/tile.webp`, and the same for `red_sara`
  (on his PC also ComfyUI `output\red_lyra\` and `output\red_sara\locked\`).
  Note the framing: tight crops, the near limb large, the figure cut by the
  frame, the face in view, motion in the hair and clothes.
- His bar in words: *"we don't need perfection for the kit arts as they will
  be small resolution when viewed."* and *"both basically read as same kind
  of attack"* (two pieces must not share a concept).

## Read first, in this order

1. The profile `scripts/lora/characters/<id>.json`: `lock`, `lora_use`
   (**the prompt shape this LoRA needs**: Duke's is the short plain prompt,
   Lyra's the weighted identity), `art_direction` (his aura colour, his pose
   ideas, his picks so far), `kit_art`.
2. The kit: `data/characters/<id>.json`. What each slot **does** and its
   class, which fixes the background (`lib/game/skillTypeStyle.ts`).
3. Rulings in `docs/HANDOFF.md`: **#160** (render her holding a real prop,
   then swap the drawn one), **#161** (class background; one aura per
   character, his colour), **#163** (props need a closed hand or a strap;
   never substitute), **#184** (an ultimate is a place with the unit's
   elements scattered, aura where the power is).
4. `docs/design/research/7dsgc-skill-art.md` and ComfyUI
   `output\references\README.md` (his library; new poses via
   `dokkanartresearch`). References are for pose and composition only.
5. `docs/CHARACTER_ART.md` step 3 to 5, rules 5 and 6, *Prompting facts*,
   *Dead ends*; `scripts/skill_art/README.md` and `scripts/pose/README.md`.

## Step 3a — The slot plan (gate: he OKs it)

Before any GPU time, write one line per slot and show him:

| Slot | What it does (kit) | The moment to draw | The pose's job | Source | Pose control |
| --- | --- | --- | --- | --- | --- |
| e.g. Flash Point | one piercing shot | the arrow just released | speed and precision: follow-through, bow arm still out | 7DSGC Gowther skill 1 | prompt + archer skeleton |

- **The moment** is a verb from the kit's description, not a stance.
- **The pose's job** is why it reads as that skill and not the other one.
- **Source**: a reference from his library or a Dokkan card, or his idea
  from `art_direction`. Be creative; the pose need not copy the reference.
- **Pose control**: Blender mannequin for anything foreshortened or airborne;
  a DWPose skeleton from the reference at 0.45; prompt only for a neutral
  pose (card A-pose, back view, passive).
- Three pose variants per slot; the batch varies the pose, not only the seed.
- The background by slot (attack: class colour; ultimate: a scenic plate with
  the unit's elements; passive: never red; card: an environment).
- For the mannequin poses, render the depth previews and put them beside
  Lyra's and Sara's locked pieces: same framing (tight crop, wide lens
  22–24 mm, a tilted `roll_deg`, the near limb big toward the lens, the
  figure cut by the frame, **the face in view**). Measure the limbs; no
  wrist above the head.

**Gate: he OKs the plan or adds his ideas.** This is where Sara's rounds 1 to
4 were lost, and it costs nothing.

## Step 3b — Drafts (24 per slot, every slot, overnight)

Two recipes are on record. **The default is the doc's (step 3)**; Lyra's is
recorded so a session knows it exists and can ask.

| | Doc recipe (Sara round 5, Duke) | Lyra's (2026-09-27) |
| --- | --- | --- |
| LoRA | **0.65** (the calm dataset pulls poses to standing at 0.9; identity returns in step 4) | 0.9 with the full weighted identity |
| Wording | `(action shot:1.2), (dynamic pose:1.2), mid-motion, (motion lines:1.1), speed lines, wind, hair flowing, clothes fluttering, foreshortening` + a verb for the slot; negative `standing, posing, photoshoot, symmetrical pose, front view, arms raised, arm up, fist raised` | a concept clause per piece with a strong verb |
| Background word | `simple background` (**never** `plain white background`: it makes a model sheet) | `(simple white background:1.4)` |
| Pose control | union ControlNet from the mannequin: depth **0.55**, openpose **0.6**, `end_percent` 0.7; or a DWPose reference skeleton at 0.45 | a drawn archer skeleton, openpose 0.78 / end 0.85, or prompt only |
| Sampler | 832×1216, `common.base_graph`, hand pass per profile | 12 steps dpmpp_2m karras, one image per seed |

Lyra's held at 0.9 because every pose had a job and a skeleton. Which recipe
a new character takes is his call if the doc's fails him; do not mix them in
one batch. The worked script is `scripts/skill_art/duke/kit_drafts.py`
(Duke-specific; copy it per character until a generic one exists, see the
README). Body size for the mannequin: `height` and `thickness` in the pose
JSON (Duke 1.1 / 1.35; the default figure is a slim 5'3" woman).

Sheets: one per slot, numbered, seed on every image. Remove **only** text on
clothing and an arm raised straight up; everything else in notes. Never
pre-select on taste. **Gate: he picks per slot**; he may assign a draft to
another slot, which is normal.

## Step 4 — Official render, then finish

A draft at 0.65 is a pose, not the character (*"character must be
consistent"*).

1. img2img **from his picked draft**, the same mannequin depth and openpose
   ControlNets at **0.6 / 0.65, `end_percent` 0.85**, LoRA **0.9**, the
   profile's `lora_use` prompt with hair and garments stated. Two denoise
   levels, four seeds each: **0.72** keeps the draft (and its off-model hair),
   **0.82** lets the LoRA redraw the hair and still holds the pose. The worked
   script is `scripts/skill_art/duke/official_render.py`. Text-to-image with
   the ControlNets alone kept the face and lost the pose.
2. **Check the head against two approved dataset images before anything
   else**: hair, skin, ear. Sonnet shipped Duke with the drafts' spiky hair
   because nobody did. A long-haired draft that leaks at both levels needs a
   head repaint or a new draft.
3. `python scripts/skill_art/finish_pass.py <render.png> <id>_finish/<key>
   <id>_toll.safetensors <prompt_file> 0.3` (0.35 on a plain draft): anime 4x
   upscale to 1.5x, img2img at LoRA 0.9, BiRefNet cut-out. Each run gets its
   own input file.
4. **Draft and finished side by side**: the same picture, cleaner lines, eyes
   and hands. A different picture means the wrong source.

## Step 5 — Composite

`scripts/skill_art/compose_<id>.py` draws every layer so a rerun is exact
(`compose_duke.py` is the model: `--bg`, `--hands`, `--recolour`). Back to
front: the background by slot (an ultimate's scenic plate rendered without
the character, lightly blurred, darker and cooler); the unit's elements
scattered for the ultimate (teardrops, not round droplets; small and sharp
far, large and soft near, none on the body); one soft aura in his colour,
grown from the silhouette, never a tight rim; streaks for a skill, soft
rising motes for a power-up; afterimages from a full-body figure; the cut-out,
cut **from the finished render**, inside made solid, a 40 px vertical closing
inside the ankle band only. **No forced signature effect on every piece**
(#163: *"You don't have to force them in every art"*).

**Claude's check pass before he sees anything**: the right source; on-model
hair, skin, garments and build against two dataset images; the aura not an
outline; afterimages in frame; no exposed crop edges; the background matches
the slot; no matte holes or islands, zoomed at the hands, the ankles and the
gaps between limbs. Fix, re-run, then show him and say what the check caught.

**Gate: he locks, or asks for changes.** Everything he does not lock goes to
`<id>_library\` with a README row. Then `artinstall`.

## Do not (the dead ends for these steps)

- Draft before the slot plan is approved, or ask him for the poses.
- Pose by prompt alone for action: photoshoots and kung-fu stances.
- Hand-drawn 2D skeletons for action: one bad joint forced the arm-up pose
  on all 24. Neutral poses only.
- LoRA 0.9 on a calm-dataset LoRA while drafting action.
- A wrist above the head; a camera below the boots that hides the face
  (*"only him falling down"*); an upright, small, model-sheet framing.
- Tight crops that will later need afterimages; the official render at 0.72
  only; text-to-image for the official render.
- An ultimate as a colour field with the attack speed-line burst.
- Diffusing a held weapon and erasing it later; a strapless slung prop.
- Cutting the figure from a composite; a red background on a passive or a
  card.
- Substituting a different picture or method unasked (#163).
