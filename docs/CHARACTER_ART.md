# Character Art: the working method

**Who updates this:** any session that changes the method, by **rewriting the
step in place**. A method that stops working moves to *Dead ends* (one line
each). Its long story goes to `docs/archive/ART_PIPELINE-character-history.md`,
not here. This file is the current method only. The `charart` skill
(`.claude/skills/charart/SKILL.md`) walks it step by step.

**Proven end to end on Sara, 2026-10-02/03:** a design lock, a LoRA (v2), kit
drafts, his picks, the finish pass, composites, and his lock. Lyra's run
(2026-09-27/28) set the LoRA recipe. **Duke, 2026-10-07/08,** added the
adult-build mannequin, the official render (step 4), and cleaning a trait out of
a dataset and retraining (step 1); his kit art is at step 4, not locked.
Where each character stands is its profile, `scripts/lora/characters/<id>.json`.

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
3. **Design decisions are his:** look, hood, shoes, aura colour, skin tone,
   poses, and which slot a picture serves. Ask with the question tool. Never
   fill a gap yourself. **When you are not sure which detail he means, mark
   the candidates on one image (A, B) and ask** before spending GPU time: "the
   spiky strand near the ear" was the grey lock in front of the ear, not the
   nape curls, and a batch that removed both was wasted (2026-10-08).
4. **References:** every reference he gives is saved in ComfyUI
   `output\references\`, indexed by its README. They are used for pose and
   composition only, never as a sampler input, and never in this repo. Read
   the index before any kit-art round. He said the poses need not copy the
   references; be creative.
5. **Background by slot** (his rule, 2026-10-03):

   | Slot | Background |
   | --- | --- |
   | Attack skills | Class colour, `draw_class_bg.py` |
   | Ultimate | **A scenic background with the unit's toll-power elements scattered through it** (ruling #184, amends #161). Duke: snowy mountains, water droplets of varying size, a thin water aura on the hands only. Never the attack speed-line burst |
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
| Hand repair | Impact Pack: `hand_yolov8s.pt` detector into a 512px `DetailerForEach`. Built into `common.base_graph(hand_fix=True)`. **It refuses image batches**, so one job per image. Off for brown-skinned Duke (it paints pale glowing hands); close-ups skip it unless the profile sets `face_hand_fix` |
| Face boxes | `face_yolov8m.pt` through `ultralytics`, which only ComfyUI's **embedded** Python has (`python_embeded\python.exe`); see `scripts/lora/duke_v2_fix/ds_faces.py` |
| Queue | `common.queue()` puts a job at the **front** when the env var `COMFY_FRONT` is set. Clear the queue with `POST /queue {"clear": true}` plus `POST /interrupt`; free VRAM with `POST /free {"unload_models": true, "free_memory": true}` |
| Scripts | `scripts/lora/` (dataset, training, tests), `scripts/skill_art/` (finish pass, backgrounds, composites), `scripts/pose/` (Blender mannequin). Run them with **system `python`**: the embedded Python cannot `import common`. Never pipe into `python -`; on this PC it hangs |
| Trainer | ai-toolkit, `C:\Users\Tanve\.comfyui-mcp\training\`. Start it detached: `Start-Process` on Git `bash.exe` with `-ArgumentList "train.sh","configs/<name>.yaml"` and `-WorkingDirectory` set to the training folder (a `bash -lc "cd ... && ..."` string silently never ran, 2026-10-08). The log is `runs/<config file name>.log`, not the run name |
| GPU | 16 GB cannot hold training and ComfyUI at once. Clear ComfyUI's VRAM before training (comfyui `clear_vram`, or `POST /free`) |
| Installing a LoRA | ComfyUI keeps a loaded LoRA open, so Git Bash `cp` over it fails with *Permission denied* even after `/free`. PowerShell `Copy-Item -Force` works. Back up first, then compare `sha256sum` of source, installed file and backup |
| Blender | `D:\Blender\blender.exe` 5.0.1, used headless for the pose mannequin |
| Sleep | Ask the app to keep the PC awake (`request_keep_awake`, `session_idle`) before long runs |

**Working folders** (ComfyUI `output\`): `<color>_<id>\` for a unit's pieces,
`lora_<id>*\` for dataset candidates, `<id>_kit*\` for kit drafts,
`<id>_official*\` for official renders, `<id>_backdrop\` for scenic plates,
`<id>_finish\`, `<id>_composite\`, `<color>_<id>\candidates\` for composites
waiting on him, and `<color>_<id>\locked\` for what he locked. Plus
`<id>_library\` for renders he keeps as extras. Test renders of LoRA steps go
to `lora_test\`.

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

**Look for what repeats before training.** A LoRA learns whatever recurs and the
captions don't name, and folds it into the trigger word. Before staging, scan
the approved set for a detail on many images that is not in the lock: a hair
strand, a collar trim, a waistband, a skin tone that drifts between close-ups
and full-body shots. Show him and ask.

**Fixing a trait the LoRA carries** (Duke v1 → v2, 2026-10-08; the worked
example is `scripts/lora/duke_v2_fix/`, with its own README). If a trait shows
in every render, it is in the dataset, and patching each finished picture will
not hold. Clean the dataset, he re-approves, retrain:
1. **Mark what he means on one image and ask** (rule 3).
2. **Hand-place a mask per image** on a gridded head crop. Colour detection
   missed most of the locks, and a broad side-of-head ellipse also took the
   nape curls he wanted kept.
3. **Inpaint with the base model, not the LoRA,** which draws the trait back.
   Use masked img2img (`SetLatentNoiseMask`) composited back over the original,
   two seeds at 0.92. Re-roll the failures with four seeds at 0.85: a small mask
   at 0.92 leaves green or white blobs. Drop an image that fails every seed.
4. **Small colour fixes go in code:** a collar trim painted to the shirt's black
   (a thin light blob under the chin, with skin and face excluded), or skin
   evened with a per-image gain so the lit-skin median hits one target. Skin
   tone is his call; offer the options.
5. **Keep backups beside the dataset folder, never inside it** (the trainer may
   read a subfolder).
6. If the dataset changes while a run is training, **stop the run** and delete
   its run folder and the dataset's `_latent_cache` before restarting.

### Step 2: Train and pick a checkpoint

1. Config: copy `scripts/lora/sdxl_character.yaml` and change only the name,
   the trigger and the dataset path. **The recipe is frozen:** rank 32,
   alpha 32, lr 2e-4, no EMA, 2,000 steps, save every 250. **Only he
   changes it.**
2. **Start only when he says "train".** Clear VRAM, launch detached (see
   Environment, Trainer), and watch `runs/<config name>.log` for errors.
   It takes about 50 to 60 minutes at 1.45 to 1.75 seconds per step.
3. Copy checkpoints 750 to 2000 into ComfyUI `models\loras\training\`. **The
   final save has no step number:** `<run>.safetensors` is step 2000. A wait
   for a `...000002000` file never ends (that cost 25 minutes on Duke v1).
4. Test with `test_checkpoints.py` or a per-character variant:
   - three scenes not in the dataset;
   - the same seeds in every row;
   - the hood state named;
   - one comparison row with the face-reference method, or the previous
     LoRA.
5. **He picks the step.** Recommend the earliest step where the results
   stop changing; 1500 for both Lyra and Sara. He picked against the
   recommendation twice on Duke (v1 1250, *"1500 had some anatomy issues"*;
   v2 1750, *"1500 has that extra hand artifact"*): **zoom the hands at every
   step before recommending one.**
6. Install it as `models\loras\<id>_toll.safetensors`. **Check the previous
   file is kept byte-identical elsewhere before overwriting it** (Duke's v1 is
   `duke_toll_v1_1250.safetensors`). Compare hashes after (Environment,
   Installing a LoRA).
7. Record his rules for prompting this LoRA in the profile's `lora_use`.
   For Sara: always name the hood, `large breasts` in the negative, watch for
   a plum eye tint. For Duke: **the short plain prompt only.** The long
   weighted identity prompt plus the trigger blurs every 1024 close-up, and so
   does `(mature face:1.1)`.

### Step 3: Kit drafts (an overnight batch: every slot at once, 24 each)

**Action needs all three of these.** The calm LoRA alone produces
photoshoots ("Is she doing Kung fu?").

**Before any of them: the slot plan** (`kitart` step 3a, 2026-10-13). One line
per slot, shown to him before any GPU time: what the skill does, the moment to
draw, the pose's job, the reference, the pose control. Sara's rounds 1 to 4
were lost for want of it, and he had to re-explain the dynamic poses each
time. Lyra's pieces had it from the start, and that is the difference between
her kit and those rounds, more than any setting below.

**Two recipes are on record, and this one is the default.** Lyra's kit
(2026-09-27) was drafted at LoRA **0.9** with the full weighted identity, a
drawn archer skeleton at openpose 0.78 / end 0.85 or prompt only, and
`(simple white background:1.4)`, and it held its poses. Her dataset included
her C4 action pose and an A-pose; Sara's and Duke's calm sets did not.
**Whether an action pose in the dataset is what lets a LoRA hold poses at
0.9 is an open question for him**, not a rule. Do not mix the two recipes in
one batch; if this one fails a character, put both to him.

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
     - **Body size:** the default figure is a slim 5'3" woman, and it made
       every Duke draft read as a teenager. Set `"height"` (bone length) and
       `"thickness"` (limb and torso radius) in the pose JSON; Duke is 1.1 and
       1.35.
     - **Frame like the locked art, not like a model sheet:** a tight crop, a
       wide lens, a tilted camera (`roll_deg`), the near limb big toward the
       lens, the figure cut by the frame. His first Duke round came back
       upright and small (*"Did you even look at how sara and lyra assets
       are?"*). Compare the depth preview with Sara's locked art.
     - **A foreshortened pose** (soles toward the lens) needs the camera **on
       the limb's axis and close**: about 0.65 m past the soles, looking back
       up the body. At 1.3 m it reads as a small side view; beside the legs
       they splay. Bring the feet together in the pose. **Keep the face in
       view:** a camera below the boots hid it, and he read those drafts as
       *"only him falling down"*.
   - **A DWPose skeleton from one of his references** at ControlNet 0.45
     (`skeletons/` in the reference library).
   - Hand-drawn 2D skeletons only for neutral or standing poses: card
     A-pose, back view, passive.

Never draw a wrist above the head. Vary the pose itself across the batch,
not just the seed: a skeleton forces one pose onto all 24.

Show him one sheet per slot, number and seed on every image. He may assign
a draft to a different slot than the one it was made for; that is normal.

### Step 4: The official render, then the finish pass

A draft at LoRA 0.65 is a pose, not the character: hair, garment colours and
build drift. **He expects every pick redrawn on-model** (*"for the ones i
picked, ofc you would properly generate the official versions yes? character
must be consistent"*).

1. **Official render** (Duke's is `scripts/skill_art/duke/official_render.py`):
   img2img **from his picked draft**, plus the same mannequin depth and
   openpose ControlNets (0.6 / 0.65, `end_percent` 0.85), plus the LoRA at
   0.9. Use the short plain prompt with the hair and garments stated. Run two
   denoise levels, four seeds each:
   - **0.72** keeps more of the draft, including its off-model hair;
   - **0.82** lets the LoRA redraw the hair on-model and still holds the pose
     (Duke's Slide, 2026-10-08).

   Text-to-image at LoRA 0.9 with the ControlNets alone kept the face and
   **lost the pose**. A long-haired draft (Duke's Surge) leaked at both
   levels; that needs a head repaint or a new draft.
2. **Check the head against the dataset** before anything else. Compare hair,
   skin and the ear with two approved dataset images. Sonnet's 2026-10-08
   composites went out with off-model hair because nobody did this.
3. **Finish pass:** `python scripts/skill_art/finish_pass.py <render.png>
   <id>_finish/<key> <id>_toll.safetensors <prompt_file> [denoise]`.
   - An anime 4x upscale to 1.5x, then img2img at LoRA 0.9 (0.35 by default;
     0.3 on an official render), then a BiRefNet cut-out.
   - On a clean render it changes little; its job is resolution and the matte.
   - Each run gets its own input file, so queuing several at once is safe.
4. **Check the source against the finished image side by side** before
   compositing: same picture, cleaner lines, eyes and hands.

### Step 5: Composite

`compose_<id>.py` (the models are `scripts/skill_art/compose_sara.py` and
`compose_duke.py`) draws every layer, so a rerun is exact. Back to front:
1. Background, by slot (rule 5). An ultimate takes a **rendered scenic plate**
   (no character, `scripts/skill_art/duke/backdrops.py`), lightly blurred and
   pushed darker and cooler so the figure reads (`compose_duke.py --bg=`).
2. The unit's toll-power elements scattered through the scene, for the
   ultimate (#184). For Duke these are water droplets drawn as **teardrops**:
   round ones read as bubbles. Small ones are sharp and far, large ones soft
   and near, and none sit on the body.
3. The aura: broad and soft, grown from the silhouette. **No tight bright
   rim; it reads as a sticker.** An aura limited to the hands is grown only
   from the matte inside a circle per hand (`--hands=x,y,r;...`).
4. Speed streaks, for skills. **Soft rising motes, not vertical lines,** for
   a power-up: Duke's first Surge streaks read as bars.
5. Afterimages, which need a full-body figure.
6. The cut-out. A garment colour that drifted can be recoloured in code
   (`--recolour`, Duke's charcoal trousers).

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
| LoRA at 0.9 while drafting action | Pulled every draft to standing | 0.65, then identity restored by the official render (step 4) |
| IP-Adapter on a full image | Costume and background colour bled in | A face-only crop |
| A hood-up face reference for hood-down shots | 0 of 8 came out hood down | A face-only crop and hood-down negatives |
| Tight crops for afterimages, then shrinking the figure | Exposed the crop edges | A full-body figure in the draft |
| `train_start` (comfyui-mcp) | Trains FLUX only | ai-toolkit through `train.sh` |
| Diffusing a held bow, then erasing it | Hours of repaints, abandoned | A bare grip, with the prop drawn in |
| Official render as img2img from the draft at 0.72 only (Duke, 2026-10-08) | The draft's hair silhouette survives: Surge and Ultimate came out spiky and long, off the locked look; a 1024 head repaint at up to 0.85 kept it too | 0.82 as well, and check the head against the dataset before compositing (step 4) |
| Official render as text-to-image, LoRA 0.9 + the ControlNets (Duke) | Kept the face, lost the pose | img2img from his draft (step 4) |
| Hand pass (`hand_fix`) on a brown-skinned character | Pale, glowing hands, even with a skin-tone hand prompt at 0.4 | Hand pass off; zoom the hands instead |
| `gathered at the ankle` + `laced` in a boots prompt | A cord drawn between the ankles ("why do his shoes are tied?") | `boot tops under the trouser hems` |
| Inpaint fixes with negatives weighted 1.4 to 1.6 | Neon colours in the patched area | Light negatives in an inpaint |
| A colour-detected mask for a hair lock | Missed it on most images, caught the eye whites | Hand-placed ellipses on a gridded crop |
| A broad side-of-head mask | Took the nape curls he wanted kept | Mark A/B and ask; mask only what he named |
| Masked inpaint at 0.92 on a small mask | Green or white blobs on 4 of 7 | 0.85, four seeds; drop an image that fails all |
| Ultimate as a colour field plus the attack speed-line burst | He wants a place, not a colour (#184) | A scenic plate plus scattered elements |
| Round droplets | Read as bubbles | Teardrops |
| A drop-kick camera below the boots | Face hidden; *"only him falling down"* | Camera on the leg axis with the face in view (step 3) |
| A trait in the dataset, patched per picture | Comes back in every render | Clean the dataset images, he re-approves, retrain |
| Fisher Pose / Qwen-Image pose transfer | Researched, not tried: photoreal-only and about 20 GB | Revisit only if the mannequin fails |
