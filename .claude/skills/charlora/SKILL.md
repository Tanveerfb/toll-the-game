---
name: charlora
description: Steps 0 to 2 of a playable character's art - lock the design from his sheet, build the LoRA dataset he approves image by image, train with the frozen recipe, test the checkpoints and install the step he picks. Use when charart routes here, or when he says "lock <id>'s design", "dataset for <id>", "train <id>", "retrain", "the LoRA keeps drawing <trait>". Runs on his PC only.
---

# charlora

Steps 0 to 2 of [`docs/CHARACTER_ART.md`](../../../docs/CHARACTER_ART.md),
with the rules in the skill. `charart` routes here; read its gates and
environment traps first.

> **Since 2026-10-14 a new LoRA is trained on FLUX.2 klein 4B, not Animagine**
> (his call). The recipe below is still the Animagine one. Follow the klein
> route in `docs/PC_SESSION.md` items 1, 1a and 1b (proven on Lyra, Sara and
> Duke) and each profile's `lora_klein_use`; the gates in this skill (he
> locks, he approves every image and caption, he picks the step) are
> unchanged. Rewrite this skill when `docs/CHARACTER_ART.md` is rewritten.
>
> **Klein lessons that cost a round each (2026-10-15):**
> - **He reviews on his phone:** burn the number onto every image
>   (`label_images.py`) and send caption sheets as images, never a table.
> - **Action shots from text read as dance** (*"that's still generous"*).
>   Pose them by klein img2img from a reference-posed render with the lock as
>   reference, 8 steps with 3 skipped (`duke_pose_img2img.py`).
> - **Zoom chins, chests and hands at dataset QC.** Four faint-stubble
>   close-ups slipped through on Duke and the LoRA learned the stubble.
> - **Test 3-4 seeds per step with the real prompt wording** (style line,
>   "plain black T-shirt"); one seed per step made luck look like training.
> - **Naming a thing to exclude it draws it** ("no pocket", "no stubble").
> - **Steps ≈ images × 50**, rounded to a save (three data points).
> - Every pick he keeps goes to `D:\Toll-Images\<Character>\` the same turn.

## Read first, in this order

1. The design sheet: `toll-kits/designs/characters/<id>.md` (the look is his).
2. The profile `scripts/lora/characters/<id>.json`. If it does not exist,
   **create it from the schema, never from another character's file**:
   `python scripts/lora/new_profile.py <id> --trigger <id>toll [--subject
   1boy]`, then fill the TODO fields from the lock. Every key is described in
   `characters/profile.schema.json`; `python scripts/lora/check_profile.py
   <id>` validates it and warns when the body shots carry too few actions.
3. `docs/CHARACTER_ART.md` steps 0–2 and the Environment table.
4. `scripts/lora/README.md` for the script arguments.
5. Two finished profiles (`duke.json`, `sara_v2.json`) for what a complete
   record looks like.

## Step 0 — Lock the design

- Generate design candidates in the game's style from his sheet; no face
  reference yet. Weight the defining identity words (hair, eyes, garment
  colours); never weight a black accessory on light hair.
- Full numbered sheets, seed on every image. Remove **only** text on clothing
  and an arm raised straight up. Everything else goes in notes.
- **Gate: he locks.** A lock from his story session overrides earlier locks.
  Record every garment, colour, hood state, age, build and what is banned in
  `design_note` and `lock`. A small fix to a locked image (a collar colour)
  is done in code, not by a re-roll.

## Step 1 — The dataset

1. Profile: `identity` (full body) and `identity_upper` (lower-body garments
   removed, or the model crams in two figures); the expression lives **in the
   shot, never in the identity**; back views flagged `"back"` (no face
   reference, the drawn back skeleton); the hood state named in every shot
   (`(hood down:1.5), bare head, hair fully visible` plus `hood_down_negative`).
2. **Face reference:** a face-only crop at IP-Adapter PLUS FACE 0.6. A full
   image bleeds costume and background colours in.
3. **Hand pass per profile, not by default:** `hand_fix: true` for Sara;
   **off for brown skin** (it painted pale glowing hands on Duke);
   close-ups skip it unless `face_hand_fix`. Body size: an adult male frame
   needs `(adult man:1.1), (broad shoulders:1.1)` and `slim, skinny, boyish`
   in the negative, or the figure reads as a teenager.
4. `python scripts/lora/gen_candidates.py <id> [slug ...]`. Aim for ~11 body
   shots and ~11 close-ups, 24–28 approved in all. **The body shots must
   include action shots** (ruling #186): Lyra's set had her C4 action pose
   and her LoRA drafted at 0.9; Sara's and Duke's were calm, front-facing
   standing figures and their LoRAs pull every draft to standing. His words:
   *"the front facing normal standing poses were a very major issue for
   me"*. Plan about a third of the body shots as actions, each different;
   keep the calm front-facing figure to a few. Put the shot list and count
   to him first.
   **Make the action shots from his references, not with
   `gen_candidates.py`** (Duke v3, 2026-10-14). The mannequin version came
   back stiff and he rejected it: *"more like dance poses rather than
   anything else"*. What he accepted: poses from his 7DS and Dokkan
   references (`ref_pose_maps.py`), drafted on Animagine **without the LoRA
   or the face reference**, then the LoRA put onto each pick by img2img at
   0.82, then single `qwen_edit.py` fixes and a white ground. The full method
   is `docs/CHARACTER_ART.md` step 1, "How to make action shots"; Duke's run is
   `scripts/skill_art/duke/v3_*.py`. **The new set is the old approved set
   plus the new shots**: never re-render calm shots he already approved.
   Run `tag_candidates.py` (embedded Python) before any sheet.
5. **Scan the approved set for a detail that repeats** and is not in the lock
   (a strand, a collar trim, a waistband, a skin tone drifting between
   close-ups and full bodies). A LoRA folds whatever recurs into the trigger
   word. Show him and ask before staging.
6. **Gate: every image approved by number.** Re-roll weak slots with
   `seed_offset` plus slot names. Then captions
   (`<trigger>, 1girl|1boy, solo, <framing, pose, expression, hood state>,
   white background`, written from what the image shows; no hair, eyes or
   outfit). **Gate: he corrects the caption sheet.**
7. `python scripts/lora/stage_dataset.py <id> <manifest.tsv>` with a new
   `dataset_name` per version. Backups beside the dataset folder, never inside
   it.

**Cleaning a trait out of a trained LoRA** (Duke v1 → v2; the worked example
is `scripts/lora/duke_v2_fix/`, read its README): mark A/B on one image and
ask; hand-place a mask per image on a gridded head crop; inpaint with the base
model (not the LoRA), masked img2img composited back, two seeds at 0.92, then
four at 0.85 for the failures, drop an image that fails every seed; colour
fixes in code; he re-approves the set; retrain. If the dataset changes while a
run is training, stop the run and delete its run folder and `_latent_cache`.

## Step 2 — Train and pick

1. Copy `scripts/lora/sdxl_character.yaml`; change **only** the name, the
   trigger and the dataset path. **The recipe is frozen** (rank 32, alpha 32,
   lr 2e-4, no EMA, 2,000 steps, save every 250; his approval 2026-09-27).
   Fix the yaml's sample prompts to the character (`1boy` for a man).
2. **Gate: "train".** `POST /free`, launch detached (charart's traps), watch
   `runs/<config>.log`. About 50–60 minutes.
3. Copy checkpoints 750–2000 to ComfyUI `models\loras\training\`. The final
   save is `<run>.safetensors` with no step number.
4. `python scripts/lora/test_checkpoints.py <id> <lora,...>`: three scenes
   not in the dataset, the same seeds in every row, the hood state named, one
   comparison row. **Zoom the hands at every step before recommending one**:
   he picked against the recommendation twice on Duke (1250 for anatomy,
   1750 for a hand artifact).
5. **Gate: he picks the step.** Install as `models\loras\<id>_toll.safetensors`
   with `Copy-Item -Force`, after a byte-identical backup of the previous file
   under its own name (`duke_toll_v1_1250.safetensors`); compare sha256 of
   source, installed and backup.
6. Write `lora_use` in the profile: the prompt that works with this LoRA
   (Duke: **the short plain prompt only**; the weighted identity blurs every
   close-up), what to always state (Sara: the hood), what to add to the
   negative, what to watch for. Then turn it into the `kit_prompt` block
   (`lora`, `draft_lora_strength`: 0.9 for a set with action shots, #186;
   `draft` and `official` body and negative), which `kitart`'s scripts read.
   `slots` is filled at the slot plan.

## Do not (the dead ends for these steps)

- IP-Adapter on a full image (costume and background bleed).
- A hood-up face reference for hood-down shots (0 of 8 came out hood down).
- `train_start` from comfyui-mcp: it trains FLUX only. Use ai-toolkit's
  `train.sh`.
- The hand pass on a brown-skinned character.
- `gathered at the ankle` plus `laced` in a boots prompt: it draws a cord
  between the ankles. Write `boot tops under the trouser hems`.
- **Weighted colour words in any negative** (`(pink skin:1.4)`): neon
  images, in an inpaint and in a txt2img draft alike. Light, unweighted negatives.
- Mannequin poses for dataset action shots: read as dance (his words).
- A Depth Anything map used unmasked: grey halos round the figure.
- Qwen-Image-Edit identity transfer from reference images: copies their pose.
- Several fixes in one `qwen_edit.py` instruction: it overreaches.
- A colour-detected mask for a hair lock, or a broad side-of-head mask.
- Masked inpaint at 0.92 on a small mask: blobs. 0.85, four seeds.
- Patching a trait picture by picture: it returns in every render. Clean the
  dataset and retrain.
- Changing the recipe, the base model, or a locked look on your own.
