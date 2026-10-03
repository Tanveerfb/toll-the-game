# Character Art: the working method

**Who updates this:** any session that changes the method, by **rewriting the
step in place**. A method that stops working moves to *Dead ends* (one line
each). Its long story goes to `docs/archive/ART_PIPELINE-character-history.md`,
not here. This file is the current method only. The `charart` skill
(`.claude/skills/charart/SKILL.md`) walks it step by step.

**Proven end to end on Sara, 2026-10-02/03:** a design lock, a LoRA (v2), kit
drafts, his picks, the finish pass, composites, and his lock. Lyra's run
(2026-09-27/28) set the LoRA recipe.

**Style target:** Dokkan card art × 7DSGC renders. Bold cel shading, thick
clean lineart, vibrant colour.

---

## Rules (every step obeys these)

1. **He picks; Claude filters for defects only.**
   - He gets full, numbered sheets with the seed on every image.
   - Exactly two things are removed before he sees a sheet:
     - text or letters on clothing;
     - an arm raised straight up (the fist-in-the-air pose).
   - Everything else goes in notes, not filters. Never pre-select, never
     drop images on taste.
2. **Every image that goes into LoRA training is approved by him, by number.**
3. **Design decisions are his:** look, hood, shoes, aura colour, poses, and
   which slot a picture serves. Ask with the question tool. Never fill a gap
   yourself.
4. **References:** every reference he gives is saved in ComfyUI
   `output\references\`, indexed by its README. They are used for pose and
   composition only, never as a sampler input, and never in this repo. Read
   the index before any kit-art round. He said the poses need not copy the
   references; be creative.
5. **Background by slot** (his rule, 2026-10-03):

   | Slot | Background |
   | --- | --- |
   | Attack skills | Class colour, `draw_class_bg.py` |
   | Ultimate | Its own colour (ruling #161), chosen so the aura reads |
   | Passive | **Never red.** Ask him if no colour is set |
   | Card | **An environment, not a colour.** Render the backdrop alone, blur it lightly, and composite her cut-out with a contact shadow. He rejected the red gradient on Sara's card (*"I don't like the red bg on her art"*) and picked a park at sunset |

6. **Props obey physics:** a carried prop needs a closed hand or a strap
   (#163). Character art carries no weapon unless it is drawn in afterwards.
   Never diffuse a held weapon and then try to erase it.
7. **Free and local only.** Nothing is paid; everything runs on his PC.
8. **Nothing enters the game repo until he locks it,** and not before the
   kit's skill names are final.

## Environment

| What | Where and how |
| --- | --- |
| ComfyUI | `E:\Installed\ComfyUI_windows_portable`, API `127.0.0.1:8188`. **Start it detached:** PowerShell `Start-Process` on `python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build`. A Bash background task is killed at its time limit, and the queue dies with it |
| Checkpoint | `animagineXL40_v4Opt.safetensors` (Animagine XL 4.0) |
| ControlNets | `controlnet-openpose-sdxl`; `controlnet-union-sdxl-promax` (depth + openpose, with `SetUnionControlNetType`) |
| Matte | `BiRefNetRMBG`. `BiRefNet_toonout` for cut-outs (selectable again as of 2026-10-03); `BiRefNet-HR-matting` inside `finish_pass.py`. **Pass every optional input explicitly** (`sensitivity`, `mask_blur`, `mask_offset`, `invert_output`, `background_color`), or the node fails with `'mask_blur'` |
| Hand repair | Impact Pack: `hand_yolov8s.pt` detector into a 512px `DetailerForEach`. Built into `common.base_graph(hand_fix=True)`. **It refuses image batches**, so one job per image |
| Scripts | `scripts/lora/` (dataset, training, tests), `scripts/skill_art/` (finish pass, backgrounds, composites), `scripts/pose/` (Blender mannequin). Run them with **system `python`**: the embedded Python cannot `import common`. Never pipe into `python -`; on this PC it hangs |
| Trainer | ai-toolkit, `C:\Users\Tanve\.comfyui-mcp\training\`. Start it detached: `Start-Process` on Git `bash.exe` with `train.sh configs/<name>.yaml` |
| GPU | 16 GB cannot hold training and ComfyUI at once. Clear ComfyUI's VRAM before training (comfyui `clear_vram`) |
| Blender | `D:\Blender\blender.exe` 5.0.1, used headless for the pose mannequin |
| Sleep | Ask the app to keep the PC awake (`request_keep_awake`, `session_idle`) before long runs |

**Working folders** (ComfyUI `output\`): `<color>_<id>\` for a unit's pieces,
`lora_<id>*\` for dataset candidates, `<id>_kit*\` for kit drafts,
`<id>_finish\`, `<id>_composite\`, and `<color>_<id>\locked\` for what he
locked. Plus `<id>_library\` for renders he keeps as extras.

---

## The pipeline, per character

### Step 0: Lock the design

1. Generate design candidates in this style from his design sheet,
   `toll-kits/designs/characters/<id>.md`. No face reference yet.
2. He picks or specifies the look. The lock can arrive from his story
   session, and then it overrides earlier locks.
3. Record it in `scripts/lora/characters/<id>.json` (`design_note`): every
   garment, colour, hood state, age, and what is banned.

Where old art contradicts the sheet, the sheet wins. A small fix to a locked
image (a recoloured ribbon or collar) is done in code, not by a re-roll.

### Step 1: The LoRA dataset

1. Write the profile `characters/<id>.json` with these fields:
   - `identity` (full body) and `identity_upper` (lower-body garments
     removed, or the model crams in two figures);
   - `negative_extra`, `style`, `face_ref`;
   - `body_shots` / `face_shots`, each a `[slug, clause, flags]` entry, with
     the expression **in the shot, never in the identity**;
   - `hand_fix: true` and `batch`.
2. **Face reference:** a **face-only crop** of the locked image, at
   IP-Adapter `PLUS FACE` 0.6. Leave out hood and outfit, or their colours
   bleed in.
3. **Mark back views `"back"`.** They get the drawn back skeleton and no face
   reference.
4. **Name the hood state in every shot.** Hood down needs
   `(hood down:1.5), bare head, hair fully visible`, plus
   `hood_down_negative`.
5. Run `python scripts/lora/gen_candidates.py <id>`. Aim for about 11 body
   shots and 11 close-ups, roughly 24 to 28 approved in all.
6. **Send full sheets; he approves by number.**
   - Re-roll weak slots with `seed_offset` plus slot names.
   - Fix small defects in code: inpaint a hood corner, matte a background
     onto white.
7. Captions: `<trigger>, 1girl, solo, <framing, pose, expression, hood
   up/down>, white background`. Write them from what the image shows. Leave
   out hair, eyes and outfit. **Send him the caption sheet; he corrects it.**
8. Stage with `python scripts/lora/stage_dataset.py <id> <manifest.tsv>`.
   Use a new `dataset_name` per version, so earlier sets are never overwritten.

### Step 2: Train and pick a checkpoint

1. Config: copy `scripts/lora/sdxl_character.yaml` and change only the name,
   the trigger and the dataset path. **The recipe is frozen:** rank 32,
   alpha 32, lr 2e-4, no EMA, 2,000 steps, save every 250. **Only he
   changes it.**
2. **Start only when he says "train".** Clear VRAM, launch detached, and
   watch the log for errors. It takes about 50 minutes at about 1.45
   seconds per step.
3. Copy checkpoints 750 to 2000 into ComfyUI `models\loras\training\`.
4. Test with `test_checkpoints.py` or a per-character variant:
   - three scenes not in the dataset;
   - the same seeds in every row;
   - the hood state named;
   - one comparison row with the face-reference method, or the previous
     LoRA.
5. **He picks the step.** Recommend the earliest step where the results
   stop changing; 1500 for both Lyra and Sara.
6. Install it as `models\loras\<id>_toll.safetensors`. **Check the previous
   file is kept byte-identical elsewhere before overwriting it.**
7. Record his rules for prompting this LoRA in the profile's `lora_use`.
   For Sara: always name the hood, `large breasts` in the negative, watch for
   a plum eye tint.

### Step 3: Kit drafts (an overnight batch: every slot at once, 24 each)

**Action needs all three of these.** The calm LoRA alone produces
photoshoots ("Is she doing Kung fu?").

1. **LoRA at about 0.65** while drafting. It was trained on calm images and
   pulls every pose back to standing at 0.9. Identity comes back in Step 4.
2. **Action wording:**
   - Use: `(action shot:1.2), (dynamic pose:1.2), mid-motion, motion lines,
     speed lines, wind, hair flowing, clothes fluttering, foreshortening`,
     plus a verb for the slot (`sprinting`, `lunging forward`).
   - Negative: `standing, posing, photoshoot, symmetrical pose, front view`.
   - **Never `plain white background`** in action drafts: it makes a model
     sheet. Use `simple background`.
3. **Pose control, one of these:**
   - **The Blender mannequin** (`scripts/pose/`): write a pose JSON of bone
     directions plus a camera. `mannequin.py` renders a depth map and joints;
     `draw_pose.py` makes the OpenPose image. Feed both to the union
     ControlNet: depth 0.55, openpose 0.6, `end_percent` 0.7. Proven on the
     sprint, which held in 6 of 6. **Preview the depth map before any GPU
     run;** a bad joint ruins all 24 drafts.
   - **A DWPose skeleton from one of his references** at ControlNet 0.45
     (`skeletons/` in the reference library).
   - Hand-drawn 2D skeletons only for neutral or standing poses: card
     A-pose, back view, passive.

Never draw a wrist above the head. Vary the pose itself across the batch,
not just the seed: a skeleton forces one pose onto all 24.

Show him one sheet per slot, number and seed on every image. He may assign
a draft to a different slot than the one it was made for; that is normal.

### Step 4: The finish pass

Run `python scripts/skill_art/finish_pass.py <draft.png> <id>_finish/<key>
<id>_toll.safetensors <prompt_file>` on each pick.
- The pass is an anime 4x upscale to 1.5x, then a 0.35 img2img at LoRA 0.9
  with the identity, hood and action words, then a BiRefNet cut-out.
- Each run gets its own input file, so queuing several at once is safe.
- **Check draft against finished side by side** before compositing: same
  picture, cleaner lines, eyes and hands.

### Step 5: Composite

`compose_<id>.py` (the model is `scripts/skill_art/compose_sara.py`) draws
every layer, so a rerun is exact. Back to front:
1. Background, by slot (rule 5).
2. A ray burst, for the ultimate.
3. The aura: broad and soft, grown from her silhouette. **No tight bright
   rim; it reads as a sticker.**
4. Speed streaks, for skills.
5. Afterimages, which need a full-body figure.
6. Her cut-out.

**Cut-out rules learned on Sara's card:**
- **Cut from the finished render, never from a composite.** The composite's
  background bleeds through her soft edges; red came through her joggers.
- **Make the inside of her silhouette solid.** Fill the matte's holes on the
  original cut-out, then force everything 3px inside the outline to fully
  opaque. A dark garment drawn on a dark draft ground comes out
  semi-transparent otherwise.
- **Bridge garment-to-shoe gaps with a short vertical closing (40px), inside
  the ankle band only.** Her cuffs matched the black ground and were dropped.
  A taller bridge, or filling holes after bridging, painted black blocks
  under the cuffs and between her legs.

**Check pass before he sees anything.** Look at every composite for:
- the wrong source;
- an aura reading as an outline;
- afterimages lost off the frame;
- exposed crop edges;
- an off-slot background;
- matte holes or islands. **Zoom into the hands, the ankles and the gaps
  between limbs.** He caught a transparent ankle that the full-size view
  hid.

Fix, re-run, and show him only after a clean check. Say what the check
caught.

### Step 6: Lock and install

1. **He names what to lock.** Copy those to `output\<color>_<id>\locked\`
   (full size, game size, cut-out) with a README. Everything else goes to
   `<id>_library\` with a README row.
2. Record the lock in the profile.
3. **Install after the kit's skill names are final:**
   - skill and ultimate art: `public/characters/<color>_<id>/skills/<slug>.png`
     at 832×1216;
   - the card: **its own card file**, plus **its transparent cut-out** in
     `cards/` (Lyra: `pose-c4.png`; Sara: `card-b-cutout.webp`). The cut-out
     is the source for the two files below, so keep it in the repo;
   - **the archive tile and `portrait.png` come from that one cut-out**
     (his call, 2026-10-03, after Lyra's tile and portrait were two different
     pictures). The tile is `make_tile_cutout.py`. **Its headroom stops at a
     natural edge, so nothing long runs into the tile above:** Lyra's
     ponytail did, and he had it cut at her red ribbon. The portrait is
     `make_portrait_crop.py`: a chest-up 1024² crop that **keeps the
     transparency**, framed like Lyra's (head about half the frame). Never
     crop the portrait from a composite or the card with its background: the
     detail page lays it on the element burst, the battle on its own dark
     ground. Write the crop numbers into the profile, so a sharper source
     reuses the framing. `tests/characterArt.test.ts` fails if a unit with
     tile art has an opaque portrait;
   - register in `lib/game/characterArt.ts`, including `TILE_ART` (bump
     `ART_VERSION` only when replacing a file in place);
   - then `npm run check`.

---

## Prompting facts that hold

- **Weight the defining identity words** (twin tails, eye colour, hoodie
  colour, trousers). Run unweighted, a locked prompt failed 48 of 48.
- **Never weight a black accessory on light hair.** `(black ribbons:1.3)`
  bled black into her hair. Weight the hair colour instead, and negate
  `multicolored / streaked / black hair`.
- **Age:** to land at 23–25, prompt `adult woman, late 20s`, and negate
  `child, loli, teenager, chibi, baby face`.
- **A garment colour must be forced** (`(oversized black hoodie:1.4),
  (black sleeves:1.2)`), with its layering negated (`white hoodie, jacket,
  layered clothes`). "Plain hoodie" alone turned it white.
- **Naming a print invites prints everywhere.** Prompt plain and stamp the
  one print afterwards. The same goes for "paw": it produced giant paws.
- **Keep weights at or below about 1.35.** Higher, and stacked background or
  costume emphasis tips Animagine painterly. Subtract before adding.
- **Words that summon objects:**

  | Word | Summons | Write instead |
  | --- | --- | --- |
  | crown | a gold crown | "top of head" |
  | cuffs | handcuffs | "sleeve borders" |
  | chain | chains | leave it out |
  | game item icon | an icon sheet | "a single X" |

- **Keep backgrounds removable:** keep effects near the body, and test the
  cut-out (`remove_background`) before calling art final.

## Dead ends (do not repeat)

| Tried | What happened | Use instead |
| --- | --- | --- |
| Pose by prompt alone | Photoshoots and kung-fu stances (Sara rounds 1 and 4) | Step 3's three-part action method |
| Hand-drawn 2D skeletons for action | Stiff; one bad joint forced the arm-up pose on all 24 | The Blender mannequin, or reference skeletons |
| LoRA at 0.9 while drafting action | Pulled every draft to standing | 0.65, then identity restored in the finish pass |
| IP-Adapter on a full image | Costume and background colour bled in | A face-only crop |
| A hood-up face reference for hood-down shots | 0 of 8 came out hood down | A face-only crop and hood-down negatives |
| Tight crops for afterimages, then shrinking the figure | Exposed the crop edges | A full-body figure in the draft |
| `train_start` (comfyui-mcp) | Trains FLUX only | ai-toolkit through `train.sh` |
| Diffusing a held bow, then erasing it | Hours of repaints, abandoned | A bare grip, with the prop drawn in |
| Fisher Pose / Qwen-Image pose transfer | Researched, not tried: photoreal-only and about 20 GB | Revisit only if the mannequin fails |
