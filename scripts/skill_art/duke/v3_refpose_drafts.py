"""Duke v3 action shots from reference poses (his steer 2026-10-14: use the 7DS and Dokkan refs; the mannequin
poses read as dance). Union ControlNet: the reference's DWPose skeleton (when DWPose found one) + its depth map.
Two seeds prompt-only (Animagine, no LoRA: the base poses best) and two with Duke's LoRA at 0.6."""
import json
import os
import sys

from PIL import Image

sys.path.insert(0, r"E:\Projects\toll-the-game\scripts\lora")
from common import COMFY, NEG_BASE, base_graph, queue, union  # noqa: E402

REFS = {
    "d_buu_lowstance": "full body, wide low fighting stance, one arm drawn back, fierce glare",
    "d_buu_guard": "full body, wide fighting stance, fists raised in guard, fierce glare",
    "d_gogeta_crouchlunge": "full body, crouching lunge, fist thrust forward toward viewer, foreshortening",
    "d_gogeta_lunge": "full body, lunging punch, fist forward toward viewer, foreshortening",
    "d_gogeta_stride": "full body, advancing mid-stride, fists in guard",
    "d_gotenks_flykick": "full body, flying kick, mid-air, one leg bent, other leg thrust out",
    "d_gotenks_dropkick": "full body, drop kick, airborne, leg thrust forward toward viewer, foreshortening",
    "d_gotenks_lean": "full body, leaning forward, arms out to the sides, low guard, ready to strike",
    "d_hit_crouchfist": "full body, crouching, fist thrust toward viewer, foreshortening",
    "d_hit_lowlunge": "full body, low lunge, guard up",
    "d_hit_lungefist": "full body, lunging, fist thrust toward viewer, foreshortening",
    "d_goku_crouch": "full body, low wide crouch, open hands forward, focused",
    "d_goku_guard": "full body, wide stance, fists in guard",
    "d_goku_leap": "full body, low leap, arms spread, mid-air",
    "s_highkick": "full body, high kick, from behind, looking back",
    "s_slidekick": "full body, low sliding kick, skidding",
    "s_divepunch": "full body, diving punch downward, from behind",
    "s_punch_shoulder": "upper body, punching, from behind, over the shoulder",
    "s_punch_behind": "full body, punching, from behind, body twisted",
}
Q = "masterpiece, best quality, very aesthetic, absurdres"
BODY = ("1boy, solo, adult man, athletic build, broad shoulders, short black hair swept back, ash grey highlights, "
        "dark brown eyes, black short sleeve t-shirt, dark charcoal loose trousers, black ankle boots, blue wristbands")
TAIL = "dynamic pose, action shot, motion lines, cel shading, anime screencap, simple background, white background"
# No weighted colour words: (pink skin:1.4) and friends turned every draft neon (2026-10-14), the same failure
# docs/CHARACTER_ART.md lists for inpainting. Light, unweighted negatives only.
NEG = (f"{NEG_BASE}, standing, posing, model sheet, multiple views, text, logo, watermark, long hair, spiky hair, "
       "aura, cape, shorts, sleeveless, jacket")
DUKE = "duketoll, " + BODY


def has_skeleton(name):
    im = Image.open(os.path.join(COMFY, "input", f"refpose_{name}_pose.png")).convert("L")
    return sum(1 for v in im.getdata() if v > 40) > 2000


ONLY = [a for a in sys.argv[1:] if not a.startswith("--")]
VARIANTS = [("base", None)] if "--base-only" in sys.argv else [("base", None), ("lora", "duke_toll.safetensors")]
SEEDS = 4 if "--four" in sys.argv else 2
runs = []
for ri, (name, clause) in enumerate(REFS.items()):
    if ONLY and name not in ONLY:
        continue
    skel = has_skeleton(name)
    for variant, lora in VARIANTS:
        for k in range(SEEDS):
            seed = 940000 + ri * 10 + k
            body = DUKE if lora else BODY
            g = base_graph(f"{Q}, {body}, {clause}, {TAIL}", NEG, 832, 1216, seed,
                           f"duke_refpose/{name}_{variant}_{seed}", batch=1, lora=lora, lora_strength=0.6)
            pos, neg = ["2", 0], ["3", 0]
            if skel:
                pos, neg = union(g, pos, neg, f"refpose_{name}_pose.png", "openpose", 0.65, ("44", "45", "46", "47"), 0.75)
                pos, neg = union(g, pos, neg, f"refpose_{name}_depth.png", "depth", 0.4, ("40", "41", "42", "43"), 0.45)
            else:
                pos, neg = union(g, pos, neg, f"refpose_{name}_depth.png", "depth", 0.5, ("40", "41", "42", "43"), 0.5)
            g["5"]["inputs"]["positive"], g["5"]["inputs"]["negative"] = pos, neg
            runs.append({"ref": name, "variant": variant, "seed": seed, "skeleton": skel, "id": queue(g)})
os.makedirs(os.path.join(COMFY, "output", "duke_refpose"), exist_ok=True)
json.dump(runs, open(os.path.join(COMFY, "output", "duke_refpose", "runs.json"), "w"), indent=1)
print(len(runs), "queued;", sum(1 for r in runs if r["skeleton"]) // 4, "refs with a skeleton")
