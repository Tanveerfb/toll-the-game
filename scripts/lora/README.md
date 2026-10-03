# Character LoRA scripts

The method is docs/CHARACTER_ART.md (steps 1-2), walked by the `charart` skill.
The approved recipe (originally docs/ART_PIPELINE.md, "Character LoRA recipe", now in
docs/archive/ART_PIPELINE-character-history.md; frozen
2026-09-27) as runnable steps. One profile per character in `characters/`;
everything else is shared, so a new character is a new profile, not new code.
Run with system `python` and `</dev/null`; ComfyUI must be up on :8188. (The
embedded Python's `._pth` leaves this folder off the path, so `import common`
fails there; `stage_dataset.py` needs Pillow, which system Python must have.)
A profile may list its own `body_shots` / `face_shots` when he specifies the
set (Sara's expression list, 2026-10-02). It may also set:
- `style` and `out_dir`.
- `seed_offset`: re-rolls a slot with fresh seeds. `gen_candidates.py <id>
  <slug>...` queues only the named slots.
- `hood_down_negative`: added only to shots that ask for the hood down.
- `batch`: images per slot (default 4).
- `hand_fix`: re-renders each hand at 512px. That queues one job per image,
  because the hand detector refuses image batches.
- `dataset_name`: names the staging folder (default `<id>_v1`).

A body shot marked `"back"` renders without the face reference, using the
drawn back skeleton (`common.draw_back_skeleton`).

| step | script | what it does |
| --- | --- | --- |
| 1 | `gen_candidates.py <id>` | Queues body shots (832×1216) and head-and-shoulders close-ups (1024², lower-body garments dropped) with the identity prompt plus IP-Adapter face ref at 0.6. Output: ComfyUI `output/lora_<id>/` |
| 2 | Claude filters for defects, he approves by number | never skipped |
| 3 | `stage_dataset.py <id> <manifest>` | Flattens approved images onto white and writes captions `<trigger>, 1girl, solo, <variable>, white background` |
| 4 | `C:\Users\Tanve\.comfyui-mcp\training\train.sh configs/<id>_sdxl_lora.yaml` | Copy `sdxl_character.yaml`, set name, trigger and dataset path only |
| 5 | `test_checkpoints.py <id> <lora,...>` | Identity prompt plus trigger in three situations absent from the dataset, same seeds, against today's IP-Adapter method |

Use: trigger plus the full identity prompt, LoRA strength 0.9, no IP-Adapter.
