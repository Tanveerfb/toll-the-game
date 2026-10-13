"""Kit drafts for any character (docs/CHARACTER_ART.md step 3, the `kitart` skill step 3b).

Reads the profile's `kit_prompt` block (scripts/lora/characters/<id>.json): the LoRA, the
draft body and negative, and per slot the pose variants from the approved slot plan. The
recipe itself lives here, not in the profile, so every character drafts the same way:
LoRA at `kit_prompt.draft_lora_strength` (0.65 for a calm-set LoRA, 0.9 once the set
carries action shots, ruling #186), the action wording, `simple background`, the hand
pass per the profile, and pose control per variant:

- `"pose": "<name>"`: the Blender mannequin, union ControlNet depth 0.55 + openpose 0.6,
  end 0.7 (scripts/pose/README.md renders `pose3d_<name>_depth.png` / `_pose.png`);
- `"skeleton": "<file>"`: a DWPose reference skeleton in ComfyUI input/, openpose 0.45;
- neither: prompt only (a neutral pose: card A-pose, back view, passive).

Usage (repo root, his PC, ComfyUI running):
  python scripts/skill_art/kit_drafts.py <id> <slot> [--pose NAME ...] [--n 24] [--seed 880000] [--dry-run]

`--n` is the slot's total, split across the variants (24 over 3 is 8 each). `--pose`
keeps only the named variants. `--dry-run` builds every graph and checks the inputs
without queueing. Output: ComfyUI output/<id>_kit/<slot>/drafts/<variant>_<seed>, and the
run list in output/<id>_kit/<slot>/runs.json.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lora"))
from common import (COMFY, NEG_BASE, apply_pose, base_graph, missing_inputs, pose_files,  # noqa: E402
                    profile, queue, union)

ACTION = ("(action shot:1.2), (dynamic pose:1.2), mid-motion, (motion lines:1.1), speed lines, wind, "
          "hair flowing, clothes fluttering, foreshortening")
STYLE = "cel shading, thick clean lineart, anime screencap, simple background"
# Never `plain white background` (it makes a model sheet). No effects in a draft: the
# composite draws aura and elements from the matte (step 5).
RECIPE_NEG = ("(standing:1.2), posing, photoshoot, symmetrical pose, arms raised, arm up, fist raised, "
              "(bad anatomy:1.2), duplicate, scenery, mannequin, grey figure, props, holding object, "
              "aura, fire, lightning, (glowing:1.2), text, (text:1.5), (letters:1.4), (words:1.4), (logo:1.4), "
              "(emblem:1.3), (symbol on shirt:1.3)")
MANNEQUIN = {"depth": 0.55, "openpose": 0.6, "end": 0.7}
SKELETON = {"openpose": 0.45, "end": 0.7}
W, H = 832, 1216


def kit_prompt(prof):
    kp = prof.get("kit_prompt")
    if not kp:
        sys.exit(f"{prof['id']}: no kit_prompt block in the profile (schema: scripts/lora/characters/profile.schema.json)")
    return kp


def variants(kp, slot, only=None):
    slots = kp.get("slots") or {}
    if slot not in slots:
        sys.exit(f"slot {slot!r} not in kit_prompt.slots ({', '.join(slots) or 'none'})")
    rows = slots[slot]
    if only:
        rows = [v for v in rows if variant_name(v) in only]
        missing = set(only) - {variant_name(v) for v in rows}
        if missing:
            sys.exit(f"--pose {', '.join(sorted(missing))}: not a variant of {slot}")
    return rows


def variant_name(v):
    return v.get("pose") or v.get("skeleton", "").rsplit(".", 1)[0] or v.get("name") or "prompt"


def split(total, parts):
    """`total` drafts over `parts` variants, the remainder to the first ones."""
    return [total // parts + (1 if i < total % parts else 0) for i in range(parts)]


def build(char_id, slot, n=24, seed=880000, only=None):
    """Every draft graph for one slot: a list of (graph, meta)."""
    prof = profile(char_id)
    kp = kit_prompt(prof)
    draft = kp["draft"]
    rows = variants(kp, slot, only)
    pos_text = lambda clause: f"{draft['body']}, {clause}, {ACTION}, {STYLE}"  # noqa: E731
    neg_text = f"{NEG_BASE}, {draft['negative']}, {RECIPE_NEG}"
    jobs = []
    for vi, (v, count) in enumerate(zip(rows, split(n, len(rows)))):
        tag = variant_name(v)
        for k in range(count):
            s = seed + vi * 100 + k
            g = base_graph(pos_text(v["clause"]), neg_text, W, H, s, f"{char_id}_kit/{slot}/drafts/{tag}_{s}",
                           batch=1, lora=kp["lora"], lora_strength=kp.get("draft_lora_strength", 0.65),
                           hand_fix=prof.get("hand_fix", False), hand_extra=prof.get("hand_extra", ""))
            needs = []
            if v.get("pose"):
                apply_pose(g, v["pose"], MANNEQUIN["depth"], MANNEQUIN["openpose"], MANNEQUIN["end"])
                needs = list(pose_files(v["pose"]))
            elif v.get("skeleton"):
                pos, neg = union(g, ["2", 0], ["3", 0], v["skeleton"], "openpose", SKELETON["openpose"],
                                 ("44", "45", "46", "47"), SKELETON["end"])
                g["5"]["inputs"]["positive"], g["5"]["inputs"]["negative"] = pos, neg
                needs = [v["skeleton"]]
            jobs.append((g, {"slot": slot, "variant": tag, "n": k + 1, "seed": s, "needs": needs}))
    return jobs


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("id")
    ap.add_argument("slot")
    ap.add_argument("--pose", nargs="+", help="only these variants")
    ap.add_argument("--n", type=int, default=24)
    ap.add_argument("--seed", type=int, default=880000)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    jobs = build(a.id, a.slot, a.n, a.seed, a.pose)
    missing = missing_inputs(sorted({f for _, m in jobs for f in m["needs"]}))
    print(f"{len(jobs)} drafts for {a.id} {a.slot}: " +
          ", ".join(f"{t} x{sum(1 for _, m in jobs if m['variant'] == t)}"
                    for t in dict.fromkeys(m["variant"] for _, m in jobs)))
    if missing:
        print("missing in ComfyUI input/:", ", ".join(missing), "(render the pose: scripts/pose/README.md)")
        if not a.dry_run:
            sys.exit(1)
    if a.dry_run:
        g = jobs[0][0]
        print("positive:", g["2"]["inputs"]["text"])
        print("negative:", g["3"]["inputs"]["text"])
        return
    runs = []
    for g, meta in jobs:
        meta = {k: v for k, v in meta.items() if k != "needs"}
        meta["prompt_id"] = queue(g)
        runs.append(meta)
    out = os.path.join(COMFY, "output", f"{a.id}_kit", a.slot)
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "runs.json"), "w", encoding="utf-8") as f:
        json.dump(runs, f, indent=1)
    print(len(runs), "queued; run list in", os.path.join(out, "runs.json"))


if __name__ == "__main__":
    main()
