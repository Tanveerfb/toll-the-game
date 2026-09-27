# Character LoRA scripts

The approved recipe (docs/ART_PIPELINE.md, "Character LoRA recipe", frozen
2026-09-27) as runnable steps. One profile per character in `characters/`;
everything else is shared, so a new character is a new profile, not new code.
Run with ComfyUI's Python and `</dev/null`; ComfyUI must be up on :8188.

| step | script | what it does |
| --- | --- | --- |
| 1 | `gen_candidates.py <id>` | Queues body shots (832×1216) and head-and-shoulders close-ups (1024², lower-body garments dropped) with the identity prompt plus IP-Adapter face ref at 0.6. Output: ComfyUI `output/lora_<id>/` |
| 2 | Claude filters for defects, he approves by number | never skipped |
| 3 | `stage_dataset.py <id> <manifest>` | Flattens approved images onto white and writes captions `<trigger>, 1girl, solo, <variable>, white background` |
| 4 | `C:\Users\Tanve\.comfyui-mcp\training\train.sh configs/<id>_sdxl_lora.yaml` | Copy `sdxl_character.yaml`, set name, trigger and dataset path only |
| 5 | `test_checkpoints.py <id> <lora,...>` | Identity prompt plus trigger in three situations absent from the dataset, same seeds, against today's IP-Adapter method |

Use: trigger plus the full identity prompt, LoRA strength 0.9, no IP-Adapter.
