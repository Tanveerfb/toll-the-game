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

## 1. Duke v3: his picks, then train

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
