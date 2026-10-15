# The next PC session, in order

**Who updates this:** the session that does an item strikes it out here in
the same change, and a cloud session that queues PC-only work appends to it.
The PC session rewrites the file at its checkpoint; **when the list is
empty, delete the file** (project-rules §DOCS: no document without content).
`docs/STATUS.md` stays the record of where the work is; this is only the
order of the work that needs his PC (ComfyUI, the trainer).

**The web game is discontinued (2026-10-14, his call; a Godot adaptation is
planned in other sessions).** What is left here is art-pipeline work: ComfyUI,
the LoRAs and the scripts in `scripts/lora/`, `scripts/skill_art/`,
`scripts/pose/` still make the characters' art until that pipeline moves.
The game-side items this file used to carry (the Firestore save check, the
theme pick, the audit decisions, the rules conflicts, the `toll-kits`
template line) went with the web game; their history is in `docs/STATUS.md`.

Start with `relay`, then this list.

## 1. Sara on FLUX.2 klein (**DONE 2026-10-14**, LoRA installed; his ask: *"right next would be Sara"*)

The Lyra route in item 1b, unchanged, with Sara's profile
(`scripts/lora/characters/sara.json`). Each gate is his. **Every klein image
he selects is copied to `D:\Toll-Images\Sara\`** the same turn (his rule,
2026-10-14: one subfolder per character name).

1. **Design check: DONE 2026-10-14, he locked 20 + 23.** Hood up
   `output/red_sara/sara_design_v2_locked_hood_up.png`, hood down
   `..._hood_down.png`; every rule is in `sara_v2.json` `design_v2` (cat ears
   back on the hood, hidden when it is down; white running high-tops; cute,
   never childlike; blank or content faces). Route that worked: klein with
   card B as reference (`sara_design_klein_r3.py`), then single words-only
   `qwen_edit.py` changes (hood down, shoes, ears). A hood-down view needs a
   hood-down reference: card B wins over the words. Naming a garment to
   exclude it (`no pocket`) draws it.
2. **Dataset: DONE 2026-10-14, 39 images, every one his by number**
   (`sara_dataset_klein.py`, 42 candidates; Qwen word fixes; an emotion round
   after his *"we need more emotion"*). Record: `sara_v2.json`
   `dataset_klein`. Lessons: number every image ON the image (he reviews on his
   phone); klein draws the shoe's grey panel as a swoosh now and then, so check
   shoes for brand-like marks; hood up = no hair from behind or the side (his
   rule, in `design_v2`); his audit drops near-copies, so one seed per pose is
   enough next time.
3. **Captions: DONE**, framing, pose, expression and hood state; staged as
   `datasets\sara_klein_v1` (`stage_dataset.py sara_v2 <manifest> --sentences
   --name sara_klein_v1`; manifest in `lyra_klein_work`).
4. **Train: DONE, 18:42-20:47, 2026-10-14** (`configs\sara_klein_v1.yaml`,
   Lyra's v2 recipe, only name/trigger/dataset/samples changed; log
   `runs\sara_klein_v1.log`).
5. **Checkpoint test and install: DONE.** `sara_klein_ckpt_test.py`, sheets
   in `output/sara_klein_v1_test/`. **He picked step 2000** (*"Yeah 2k model
   is clear victor"*); installed as `models\loras\sara_klein.safetensors`
   (sha256 checked), `sara_toll.safetensors` untouched. How to render with it:
   `sara_v2.json` `lora_klein_use` (a hood-down close-up needs the locked
   hood-down image as a reference).

**Sara on klein is complete.** Next: Duke (item 1a, his call), then rewrite
`docs/CHARACTER_ART.md` for klein now that a second character has proven the
route.

The `lyra_klein_work` scripts hard-code Lyra (paths, prompts, `DESC`); copy and
adapt them, or make them generic as `kit_drafts.py` was, before a third
character needs them.

## 0. Arc 1 cast on klein: the plan (his roll call, 2026-10-15)

The 12 playable kits (`data/characters`, not story-only, not unreleased).
NPCs are not being done. Each brief lives in the profile's `design_klein`.

| Character | State | Scope, his words where given |
| --- | --- | --- |
| Lyra | LoRA installed (step 1500) | major |
| Sara | LoRA installed (step 2000) | major |
| Duke | LoRA installed (step 1750), done | major, the lead |
| Batra | brief in `batra.json`; next after Duke; he will send patka pictures | major; overhaul, drafts from scratch |
| Master Tao | brief in `master_tao.json` (three forms + formal) | major |
| Seris (`seras`) | brief in `seras.json` (two outfits, one look) | major: arc 1 villain, appears past arc 1 |
| Yalina | brief in `yalina.json` | small: dies around ch 5-6 of arc 1; 20-25 images |
| Chiara | brief started in `chiara.json`: polish the game portrait; Bureau | after Batra in his order |
| Mustafa | no brief yet | |
| Siddiq | no brief yet | medium: dies at the end of the exam arc (ch 11 of 20), flashbacks only after arc 1 |
| Gabrist | partial sheet (hair/face) | |
| Isolde | brief started in `isolde.json`: polish the game portrait; Bureau | arc 1 (his answer in the question tool, 2026-10-15); also in his arc 2 cast notes |

### Bureau uniform (his ask, 2026-10-15): lock it once, put it on every Bureau character

His words: *"we will need to make basically nail down the outfit so that it's
easier to just have them on the characters moving forward. So whenever I'm
introducing a bureau character, then they'll have this outfit."*

- **Female version:** from the Chiara and Isolde game portraits (*"we are
  going with something like that"*). What they share: dark navy and black,
  a tailored long coat or blazer, silver trim, buttoned cuffs, dark gloves,
  a high or ornamented collar. Chiara: double-breasted navy coat, silver
  argyle trim, gold choker, gold-buckle belt. Isolde: black blazer, silver
  brooch, navy dress, ruffled high-neck jabot. The two differ, so one
  uniform still has to be drawn and locked.
- **Male version:** to be designed. Master Tao wears it later (his formal
  Bureau mode); not Batra.
- **Plan:** a uniform design round on klein, female and male, on neutral
  figures; he locks; the locked text and image then go into each Bureau
  character's identity and reference. **When: after Batra's drafts, before
  Chiara** (question tool, 2026-10-15, option label mine).

## 1a. Duke on klein: DONE 2026-10-15 (`duke_klein.safetensors`, step 1750; his "Keep 1750, done")

**Lessons for the next character:** zoom chins and chests at dataset QC
(4 faint-stubble close-ups slipped through); test 3-4 seeds per step, never
one (one seed made 1500 vs 1750 look like a training difference when it was
luck); test with the real prompt wording (style line, "plain black
T-shirt"), not the bare trigger.

**State, 2026-10-15:** design locked (`output/blue_duke/duke_design_klein_locked.png`,
his "D2 only"; hair canon = the dataset images; body B1). 31 images approved
and captioned, staged as `datasets\duke_klein_v1`, config
`configs\duke_klein_v1.yaml`. **Training waits for his "train"** (he was on
the PC for dailies). Launch exactly as Sara's (`Start-Process` Git bash
`train.sh configs/duke_klein_v1.yaml`), watch with `watch_train.py`, then a
checkpoint test from `sara_klein_ckpt_test.py`'s pattern. Record:
`duke.json` `design_klein`, `dataset_klein`. **Started 08:49, 2026-10-15.**

**How many steps (2026-10-15, two data points, a working rule not a law):**
his picks landed at about 50 passes over the set: Lyra step 1500 of 29
images (52), Sara step 2000 of 39 (51). Steps = images x ~50, rounded up to
a 250 save, plus one or two saves past it to compare; past the sweet spot
the LoRA locks in poses and old details (Lyra 1750/2000 brought back the
upper-arm band and a stiff bow pose). Duke (31 images) predicts ~1500-1750.

**RAM, measured on Duke's run:** the trainer peaks at ~28 GB system RAM while
loading and quantising (24 GB steady), 12 GB of VRAM; with idle ComfyUI
(~5 GB) and his apps the PC touched 43 of 48 GB (his observation). Close
ComfyUI before a klein training run on this PC; 32 GB would not fit it.

**Same route as Sara (item 1):** design check on klein from his lock (the
cleaned `datasets\duke_v2` images as references, not the game portrait,
which is the old gi design), he locks, then dataset, captions, train, step
pick, install as `duke_klein.safetensors` beside `duke_toll.safetensors`.
Picks are copied to `D:\Toll-Images\Duke\`. Script:
`lyra_klein_work\duke_design_klein.py`. **Lesson (2026-10-14):** a plain
Qwen hair instruction restyles the whole hairstyle; prefix it with
*"Recolour only, do not change any shapes"* when only the colour should
move. He rejected a quiff/Wriothesley restyle (*"the old one is better"*).

**After Duke, every other character is redesigned almost from scratch**
(his words, 2026-10-14: *"duke is the last character that has a locked
designed. after these, we will also need to redesign the other characters
from almost start, without any locked elements"*). Step 0 for each: a
design round from its sheet, he locks, then the klein route.

The Animagine v3 plan below is superseded by the klein route and kept only as
a record.

Ruling #186 (a dataset must carry action shots). Round 1, mannequin poses
through `gen_candidates.py`, was **rejected by him** (*"more like dance poses
rather than anything else"*). Round 2 is done and waiting on him: 13 action
shots made from his 7DS and Dokkan references, sheet
`output\duke_v3_action\sheet_v3_action_round2.png`, the images in
`output\duke_v3_action\final\` (`A01`–`A13`). Method:
`docs/CHARACTER_ART.md` step 1, "How to make action shots"; record:
`duke.json` `dataset_v3_note`.

1. **Gate: he picks by number.**
2. Captions for the picks (the v2 captions are in the `duke_v2` dataset
   folder), **gate: he corrects them**.
3. Stage a new `dataset_name` (`duke_v3`): the 20 approved, cleaned v2
   images plus his picks.
4. Train `duke_toll_v3` with the frozen recipe (`charlora` step 2); he picks
   the step; back up `duke_toll.safetensors` under its own name before
   `Copy-Item -Force`. Record `training_v3` and `lora_pick_v3` in `duke.json`.
5. Then `kitart` from step 3a. His 2026-10-08 concepts are kept as drafts in
   `output\duke_kit\` (S2 surge, K4/K10 drop kick with the soles to the lens,
   U19 ultimate). Redraft them with `scripts/skill_art/kit_drafts.py` (its
   first real run; set `kit_prompt.lora` and `draft_lora_strength` 0.9 after
   the retrain), then `official_render.py`.

## 1b. Model bake-off for the Godot pipeline (**done for Lyra**: klein won, her LoRA is installed)

**Where it stands, 2026-10-14 evening:**

- **Picked: FLUX.2 klein 4B** for the art pipeline, his call (Animagine skews to
  cute girls). Downloaded to ComfyUI on E: klein 4B, `qwen_3_4b`, `flux2-vae`,
  and the D-ART, Outlined, AniEdit, mikkoani and Qwen Multiple-Angles LoRAs.
  The training base (`FLUX.2-klein-base-4B`) and `Qwen3-4B` sit in the Hugging
  Face cache on C (14.7 GB).
- **Lyra's design is re-locked** as `output/red_lyra/design_v2_locked.png`
  (his word, question tool); her profile's `design_v2` block carries every
  garment rule, his ratings, and `personality` (serious, never cutesy,
  closed-mouth smile). The 24-image `lyra_v1` set shows the old look and is
  not reused.
- **Dataset v2: 29 images**, every one approved by him, captions approved
  (2 dropped on his call as a near-copy of 1). **Staged** as
  `datasets\lyra_klein_v2` with `stage_dataset.py --sentences`. Candidates in
  ComfyUI `output/lyra_dataset_v2/`, fixes in `fix2/`; the manifest is
  `C:\Users\Tanve\.comfyui-mcp\training\lyra_klein_work\lyra_ds_v2_manifest.tsv`
  beside this session's scripts (`lyra_dataset_v2.py` renders with klein and
  the locked image as reference; `lyra_bakeoff.py` holds the klein graph).
- **Trained and installed (2026-10-14).** `lyra_klein_v2`, 2000 steps at
  ~3.4 s/step on his 16 GB card (about 2 hours, not the 30-40 minutes first
  guessed). He picked **step 1500**; it is ComfyUI `models\loras\lyra_klein.safetensors`
  (the Animagine `lyra_toll.safetensors` is untouched). How to render with it
  (fast model, strength 1.0, name the crowd's clothes in scenes) is
  `lora_klein_use` in her profile; the test is ComfyUI
  `output/lyra_klein_v2_test/` (`lyra_klein_ckpt_test.py`, `_sheet.py` and
  `_bleed_test.py` in `lyra_klein_work`).
- **Candid round (his ask, for fun):** 12 story moments × 2 seeds in ComfyUI
  `output/lyra_candid/` (`lyra_candid.py`). He liked six; copies are
  `output/red_lyra/promo/` with a README (*"could be used later for
  promotional reasons"*), copied to `D:\Toll-Images\Lyra\` (his folder for
  every klein pick, by character). The bridge shot was fixed both ways in
  `lyra_candid/fix/`. What the LoRA does wrong in scenes is in her profile's
  `lora_klein_use`.
- **Next:** Sara (item 1). The method write-up in `docs/CHARACTER_ART.md`
  (still the Animagine recipe; a banner at its top points here) waits until a
  second character has proven the route.
- **Watch:** stopping a run needs the Python processes killed, not only the
  `bash` tree (`env.exe` → `python.exe` sit outside it). His C drive was at
  18 GB free: a 13 Oct `ffmpeg.exe` grew the page file to 55 GB; he restarts
  to shrink it.

His direction, 2026-10-14 (memory `art-style-target`): anime, never comic
book; Jujutsu Kaisen is the closest target for its range of bodies and
creatures; scenes and world-building (2D: the city, locations, angles) are in
scope, and their look and references are his to supply. Every candidate is
checked beside the locked design (memory `check-against-the-lock`); every
approval is his.

- **Candidates:** Animagine XL 4.0 (current) vs FLUX.2 klein 4B (Apache 2.0)
  for characters; Z-Image Turbo (Apache 2.0) added for scenes only.
  Illustrious stays out (he read it as front-facing and soft, and it renders
  green here); NoobAI, Anima and FLUX.2 dev/9B are ruled out by licence.
- **Downloads when he says yes**, checked on Hugging Face 2026-10-14, the
  `Comfy-Org/flux2-klein-4B` repackage: `flux-2-klein-4b.safetensors`
  7.75 GB, `qwen_3_4b.safetensors` 8.04 GB (3.85 GB fp4 option),
  `flux2-vae.safetensors` 0.34 GB, and the `mikkoph/mikkoani-klein4b` LoRA (his
  Caila direction, saved in `references/hf/caila-direction_2026-10-14/`).
  Z-Image's files to be confirmed the same way. `flux-2-klein-base-4b`
  (7.75 GB) only if klein wins and a LoRA is retrained on it.
- **Wider check, same day (licences read from Hugging Face's own records, not
  blogs):** Qwen-Image-2.1 (Sept 2026) is `qwen-research`, so out despite
  native transparent output. Usable under Apache 2.0: Qwen-Image-2512 (scenes,
  a 20B model, so Q4 GGUF like our edit model), Qwen-Image-Layered (splits art
  into transparent layers, for Godot), the Qwen-Image-Edit-2511
  Multiple-Angles LoRA (`fal/...`, 0.3 GB, re-shoots a scene or character from
  another angle), and Neta Lumina / NetaYume (anime-specialised on Lumina 2,
  but a soft moe look, a thin Hugging Face ecosystem, and LoRA training
  documented at 20 GB+, so optional). Civitai is region-blocked from his PC.
  klein 4B LoRA training: BFL says 12 GB+, practice says 16 GB is tight but
  possible with offloading.
- **His read after the Civitai sheets (2026-10-14):** Animagine is tuned toward
  cute girls, not a variety of characters, *"especially men"*: his reading of
  why Lyra and Sara came out well and Duke struggled. He wants to move to a more
  versatile base, and FLUX.2 klein is the front-runner. The klein style LoRAs
  closest to his taste are **D-ART** and **Outlined**; klein alone is strong on
  scenes. Details in memory `art-style-target`.
- **Character round:** same prompts on both: a muscular and a skinny fighter,
  an athletic and a heavier-set girl, an old man, a monster, an animal; Duke
  in a drop kick and a guard against his lock; a JJK-leaning variant of each;
  the Caila-like LoRA on klein.
- **Scene round:** an anime city street, an interior, a landscape; one place
  from two angles (Qwen-Image-Edit camera change, klein reference images),
  judged on whether it is still the same place.
- **After he picks:** a new base means retraining every LoRA from the saved
  datasets (`C:\Users\Tanve\.comfyui-mcp\training\datasets\`), with captions
  rewritten as sentences for Flux-type models.

## 2. Model cleanup (his: "models can be deleted later")

List what is unused and let him pick. On the box: Animagine XL 4.0 (in use)
and 3.1, Pony, SDXL base, Illustrious-XL v2.0 (**every render green here;
cause unresolved**), Flux.dev fp8 + its encoders (works; vector LoRAs for
icons), Qwen-Image-Edit 2511 (in use), Wan 2.1 i2v, Hunyuan3D, the five
vector LoRAs. Check the licence before keeping anything for a sold game.

## 3. Sara's LoRA (only if he wants pieces redone)

Same rule as Duke, lower priority: her kit is locked. A retrain on an
action-bearing set only matters when he asks for a Sara piece to be redone.

## Done 2026-10-14 (kept as the record)

- **The `fleet` plugin**: enabled at user level on his PC; he said the
  project block is not needed (`decisions.md`). The local `checkpoint` and
  `relay` copies stay for cloud sessions.
- **Node 24**: the PC runs v24.21.0, matching `.nvmrc`.
- **Generic `kit_drafts.py` and `official_render.py`**: read the profile's
  `kit_prompt` block; checked without ComfyUI against the 2026-10-08 graphs
  (72 drafts, 24 renders identical). Not yet run against ComfyUI.
- **ComfyUI folders cleaned** (his ask: *"cleanup the comfy folder. And
  delete all rejected images or assets"*): everything went to the Recycle
  Bin, not deleted. What went and what stayed is `duke.json`
  `output_cleanup_note`. The bin still holds about 2.2 GB from this and the
  13.7 GB ACE-Step model; emptying it is his.
