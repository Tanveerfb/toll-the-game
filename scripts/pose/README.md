# scripts/pose — the Blender mannequin

**Who updates this:** whoever changes `mannequin.py`, `draw_pose.py` or the
pose JSON shape, in the same change. The method is `docs/CHARACTER_ART.md`
step 3; the `kitart` skill walks it.

A posed 3D figure rendered headless in Blender 5.0.1 (`D:\Blender`), giving the
union ControlNet a **depth map** (foreshortening, overlap, camera angle) and an
**OpenPose image** together. A hand-drawn 2D skeleton cannot say "this foot is
coming at the camera"; this can. Proven on Sara's sprint (6 of 6 drafts held)
and Duke's drop kick.

## Run

```
D:\Blender\blender.exe -b --factory-startup --python scripts/pose/mannequin.py -- <pose.json> <out_dir>
python scripts/pose/draw_pose.py <out_dir> <name> [<name> ...]
```

`mannequin.py` writes `<out_dir>/<name>_depth.png` (near = white) and
`<name>_joints.json` (COCO-18 2D pixel coordinates, visible joints only).
`draw_pose.py` draws the OpenPose image and copies both into ComfyUI `input/`
as `pose3d_<name>_depth.png` and `pose3d_<name>_pose.png`, which is what the
draft scripts load (`scripts/skill_art/duke/kit_drafts.py`, `union()` at depth
0.55 and openpose 0.6, `end_percent` 0.7). Run with system `python`; never
pipe into `python -`.

**Preview the depth map before any GPU run.** One bad joint ruins all 24
drafts. Put the preview beside Lyra's and Sara's locked pieces and check the
framing matches (tight crop, the near limb big, the face in view).

## The pose JSON

A pose is **bone directions, not positions**, so proportions never break.
World axes: x = right, y = away from the default camera, z = up. "left" is the
subject's left. Example files: `poses/*.json` (`duke_drop_e.json` is the
foreshortened drop kick he picked; the `duke_drop_*` set was written by
`scripts/skill_art/duke/drop_poses.py`).

| Key | Meaning |
| --- | --- |
| `_note` | What the pose is for, in words |
| `height`, `thickness` | Bone-length and limb/torso-radius multipliers. The default figure is a slim 5'3" woman; Duke is 1.1 / 1.35. Set them or an adult man reads as a teenager |
| `pelvis` | Pelvis position in metres (`[0, 0, 1.0]` is standing) |
| `spine`, `neck`, `face` | Direction vectors |
| `hip_axis`, `shoulder_axis` | The axes the hips and shoulders lie along |
| `upper_arm_l/r`, `forearm_l/r`, `thigh_l/r`, `shin_l/r`, `foot_l/r` | Direction vectors per bone |
| `camera.location`, `camera.look_at` | Metres |
| `camera.lens_mm` | 22–24 for the locked art's wide look |
| `camera.roll_deg` | A tilt; the locked art is rarely level |

Rules from the logs: no wrist above the head (preview and measure); a
foreshortened pose (soles toward the lens) needs the camera **on the limb's
axis and close** (about 0.65 m past the soles, looking back up the body) with
the feet together, and **the face in view**: a camera below the boots hid it
and he read those drafts as *"only him falling down"*. Vary the pose across a
batch, not only the seed.
