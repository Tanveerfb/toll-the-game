"""Official render of a picked draft, for any character (docs/CHARACTER_ART.md step 4, `kitart` step 4).

img2img from his pick, the same mannequin depth + openpose union ControlNets at 0.6 / 0.65
(end 0.85), LoRA 0.9, and the profile's `kit_prompt.official` body (hair and garments
stated) and negative. Two denoise levels, four seeds each: 0.72 keeps more of the draft
(and its off-model hair), 0.82 lets the LoRA redraw the hair and still holds the pose.
Text-to-image with the ControlNets alone kept the face and lost the pose (Duke, 2026-10-08).

Usage (repo root, his PC, ComfyUI running):
  python scripts/skill_art/official_render.py <id> <slot> <draft.png> --key S2
      [--pose NAME | --no-pose] [--lora FILE] [--denoise 0.72,0.82] [--seeds 4] [--seed 893000] [--dry-run]

<draft.png> is a path under ComfyUI output/ (as the sheets name it) or an absolute path.
The pose defaults to the slot variant whose name the draft file starts with, which is how
kit_drafts.py names them; the variant's `official_clause` (else its `clause`) is the
action. `--key` is his pick's label on the sheet. Output: ComfyUI
output/<id>_official/<slot>/<key>_d<denoise>_<seed>. Next: check the head against two
approved dataset images, then finish_pass.py at 0.3.
"""
import argparse
import os
import shutil
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lora"))
from common import CHECKPOINT, COMFY, NEG_BASE, missing_inputs, pose_files, profile, queue, union  # noqa: E402
from kit_drafts import kit_prompt, variant_name, variants  # noqa: E402

STYLE = "cel shading, thick clean lineart, vibrant colors, anime screencap, simple background"
RECIPE_NEG = ("(text:1.5), (letters:1.4), (logo:1.4), (motion blur:1.3), (black smear:1.4), aura, fire, lightning, "
              "arms raised, (bad anatomy:1.2), mannequin, grey figure, scenery")
CN = {"depth": 0.6, "openpose": 0.65, "end": 0.85}
LORA_STRENGTH = 0.9


def resolve_draft(path):
    p = path if os.path.isabs(path) else os.path.join(COMFY, "output", path)
    if not os.path.exists(p):
        sys.exit(f"draft not found: {p}")
    return p


def pick_variant(rows, draft, pose):
    if pose:
        for v in rows:
            if variant_name(v) == pose:
                return v
        return {"pose": pose}
    base = os.path.basename(draft)
    hits = [v for v in rows if base.startswith(variant_name(v) + "_")]
    if len(hits) != 1:
        sys.exit(f"cannot tell the pose from {base!r}; pass --pose NAME or --no-pose")
    return hits[0]


def graph(char_id, slot, key, src, text, neg, pose, lora, den, seed):
    g = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "8": {"class_type": "LoraLoader", "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": lora,
                                                     "strength_model": LORA_STRENGTH, "strength_clip": LORA_STRENGTH}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": text}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": neg}},
        "10": {"class_type": "LoadImage", "inputs": {"image": src}},
        "11": {"class_type": "VAEEncode", "inputs": {"pixels": ["10", 0], "vae": ["1", 2]}},
        "5": {"class_type": "KSampler", "inputs": {"model": ["8", 0], "positive": ["2", 0], "negative": ["3", 0],
                                                  "latent_image": ["11", 0], "seed": seed, "steps": 30, "cfg": 6.0,
                                                  "sampler_name": "euler_ancestral", "scheduler": "normal",
                                                  "denoise": den}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0],
                                                   "filename_prefix": f"{char_id}_official/{slot}/{key}_d{round(den * 100)}_{seed}"}},
    }
    if pose:
        d_img, p_img = pose_files(pose)
        pos, ng = union(g, ["2", 0], ["3", 0], d_img, "depth", CN["depth"], ("20", "21", "22", "23"), CN["end"])
        pos, ng = union(g, pos, ng, p_img, "openpose", CN["openpose"], ("24", "25", "26", "27"), CN["end"])
        g["5"]["inputs"]["positive"], g["5"]["inputs"]["negative"] = pos, ng
    return g


def build(char_id, slot, draft, key, pose=None, no_pose=False, lora=None, denoise=(0.72, 0.82), seeds=4, seed=893000):
    """(src_name, jobs, needs): the input file name the draft is copied to, the graphs, the inputs they need."""
    prof = profile(char_id)
    kp = kit_prompt(prof)
    off = kp["official"]
    v = pick_variant(variants(kp, slot), draft, pose) if not no_pose else {}
    clause = v.get("official_clause") or v.get("clause")
    if not clause:
        sys.exit("no clause: the variant has none; add the pose to kit_prompt.slots first")
    pose_name = None if no_pose else v.get("pose")
    src = f"{char_id}_official_{slot}_{key}_src.png"
    text = f"{off['body']}, {clause}, {STYLE}"
    neg = f"{NEG_BASE}, {off['negative']}, {RECIPE_NEG}"
    jobs = [graph(char_id, slot, key, src, text, neg, pose_name, lora or kp["lora"], den, seed + k)
            for den in denoise for k in range(seeds)]
    needs = list(pose_files(pose_name)) if pose_name else []
    return src, jobs, needs


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("id")
    ap.add_argument("slot")
    ap.add_argument("draft")
    ap.add_argument("--key", required=True)
    ap.add_argument("--pose")
    ap.add_argument("--no-pose", action="store_true")
    ap.add_argument("--lora")
    ap.add_argument("--denoise", default="0.72,0.82")
    ap.add_argument("--seeds", type=int, default=4)
    ap.add_argument("--seed", type=int, default=893000)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    draft = resolve_draft(a.draft)
    dens = tuple(float(x) for x in a.denoise.split(","))
    src, jobs, needs = build(a.id, a.slot, draft, a.key, a.pose, a.no_pose, a.lora, dens, a.seeds, a.seed)
    missing = missing_inputs(needs)
    print(f"{len(jobs)} renders of {a.key} ({a.slot}) at denoise {', '.join(map(str, dens))}")
    if missing:
        print("missing in ComfyUI input/:", ", ".join(missing))
        if not a.dry_run:
            sys.exit(1)
    if a.dry_run:
        print("positive:", jobs[0]["2"]["inputs"]["text"])
        print("negative:", jobs[0]["3"]["inputs"]["text"])
        return
    shutil.copyfile(draft, os.path.join(COMFY, "input", src))
    for g in jobs:
        queue(g)
    print(len(jobs), "queued with", jobs[0]["8"]["inputs"]["lora_name"])


if __name__ == "__main__":
    main()
