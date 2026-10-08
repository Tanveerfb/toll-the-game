# Duke's dataset fix (2026-10-08)

The worked example for **removing a trait the LoRA learned from its own dataset**
(`docs/CHARACTER_ART.md`, step 1, "Fixing a trait the LoRA carries"). Duke's v1
LoRA drew a grey lock of hair hanging in front of the ear in every render
because most training images had it. He asked twice to lose it; patching each
finished picture could not hold. This folder turned `datasets/duke_v1` (21
images) into `datasets/duke_v2` (20 images), which trained `duke_toll_v2`; he
picked step 1750.

Paths are Duke's, hard-coded; copy the folder for another character and change
`DS`/`V1`/`V2` and the JSON data. Run each with system `python` except
`ds_faces.py`, which needs ComfyUI's embedded Python (it has `ultralytics`).

| Order | File | Does |
| --- | --- | --- |
| 1 | `ds_faces.py` → `ds_faces.json` | Face box per dataset image (`face_yolov8m`) |
| 2 | `lock_grid.py` (`check` to overlay) | Gridded head crops (10% lines) for placing masks by eye |
| 3 | `lock_masks.json` | The hand-placed ellipses, in head-crop fractions. **Hand-placed on purpose:** colour detection missed the lock on most images, and a broad side-of-head ellipse also erased the nape curls he wanted kept |
| 4 | `lock_mask_png.py` | Ellipses → feathered full-size masks |
| 5 | `lock_inpaint.py`, `lock_inpaint2.py` | Base Animagine (**not** the LoRA, which redraws the lock), masked img2img, composited back; 2 seeds at 0.92, then 4 re-roll seeds at 0.85 for the failures. Green or white blobs at 0.92 on a small mask |
| 6 | `build_duke_v2.py` | Picks per image (`PICK`), drops D07 (every seed left a blob), stages `datasets/duke_v2` with captions unchanged, draws his approval sheet |
| 7 | `collar_fix.py` | Paints the white collar trim to the shirt's black: thin light low-saturation blobs in an ellipse under the chin, skin and face excluded. Three tries to get right (see its history in the doc) |
| 8 | `skin_options.py`, `skin_apply.py` | Evens skin: per-image gain so the lit-skin median hits a target. He picked **A, the set's own pale average**, over the locked D22 brown |

Backups outside the training folder: `datasets/duke_v2_precollar`,
`datasets/duke_v2_preskin`. A backup **inside** the dataset folder may be read
by the trainer; keep them beside it.
