# Blue Duke's kit-art scripts (2026-10-07/08)

Duke's run of `docs/CHARACTER_ART.md` steps 3 to 5. The compositor is
`scripts/skill_art/compose_duke.py`; the pose JSONs are `scripts/pose/poses/duke_*.json`.
Run with system `python`.

| File | Step | Does |
| --- | --- | --- |
| `kit_drafts.py` | 3 | Surge, Slide and Ultimate drafts: LoRA 0.65, short plain prompt, mannequin depth + openpose on the union ControlNet. Its `PLAN` is the 2026-10-07 round (S, L, U sheets) |
| `drop_poses.py` | 3 | The drop-kick mannequin, **soles toward the lens** (his pick). Writes `duke_drop_e/f/g.json` and renders their depth previews. Camera on the leg axis, about 0.65 m past the soles |
| `drop_drafts.py` | 3 | 24 drop-kick drafts from `duke_drop_e`/`_f` (his picks K4, K10 are `duke_drop_e` seeds 882003, 882009). `_f` hides the face: dead |
| `official_render.py <lora>` | 4 | Official renders of his picks with the installed LoRA: img2img from the draft + both ControlNets + LoRA 0.9, at 0.72 and 0.82, four seeds each. 0.82 is the one that redraws the draft's hair on-model |
| `backdrops.py` | 5 | Scenic plates, no character: the ultimate's snowy mountains (#184), the card's riverside |
