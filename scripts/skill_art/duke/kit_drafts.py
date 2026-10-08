"""Duke kit drafts (Step 3): Surge power-up and Slide leg sweep / drop kick. 24 each.
LoRA duke_toll (step 1250) at 0.65, action wording, the SHORT plain prompt (the weighted identity prompt blurs with this LoRA),
hand pass OFF (it paints pale glowing hands on his skin), pose control from the Blender mannequin (union ControlNet,
depth 0.55 + openpose 0.6, end 0.7) on 2 of 3 drafts per slot and prompt only on the rest.
Outputs ComfyUI output/duke_kit/<slot>/drafts/."""
import json
import os
import sys

sys.path.insert(0, r"E:\Projects\toll-the-game\scripts\lora")
from common import NEG_BASE, base_graph, queue  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
BODY = ("duketoll, 1boy, solo, human, (adult man:1.1), (broad shoulders:1.1), black hair, ash grey highlights, dark brown eyes, "
        "plain black short sleeve t-shirt, dark charcoal loose trousers, black boots, blue wristbands")
ACTION = ("(action shot:1.2), (dynamic pose:1.2), mid-motion, (motion lines:1.1), speed lines, wind, "
          "hair flowing, clothes fluttering, foreshortening")
STYLE = "cel shading, thick clean lineart, anime screencap, simple background"
NEG = (f"{NEG_BASE}, child, teenager, (robe:1.3), (magenta:1.3), (blue hair:1.4), (white shirt:1.6), (grey shirt:1.5), "
       "beard, glasses, text, (weapon:1.3), props, holding object, (standing:1.2), posing, photoshoot, symmetrical pose, "
       "arms raised, arm up, fist raised, (bad anatomy:1.2), duplicate, multiple boys, scenery, mannequin, grey figure, "
       "aura, fire, lightning, (text:1.5), (letters:1.4), (words:1.4), (logo:1.4), (emblem:1.3), (symbol on shirt:1.3), "
       "(glowing:1.2), (slim:1.2), (skinny:1.3), (thin:1.2), (boyish:1.3), (slacks:1.2), (tall boots:1.2)")

SURGE = ("full body, floating in mid-air, (gathering strength:1.2), (both fists clenched at chest height:1.2), elbows out, "
         "knees bent, head thrown back, screaming, open mouth, intense eyes")
SLIDE_SWEEP = ("full body, (low leg sweep:1.3), crouching very low, one leg extended straight along the ground, "
               "sweeping kick, hips close to the ground, intense focused eyes")
SLIDE_DROP = ("full body, (drop kick:1.3), leaning back, both legs driven forward at knee height, "
              "kicking toward the viewer's side, hands down for balance, intense focused eyes")
ULT = ("full body, (wide low stance:1.3), knees bent deep, one leg stretched out to the side, leaning forward, "
       "(open palms:1.2), hands low and open, fierce focused glare, looking at viewer, martial arts stance")
SLIDE_SIDE = ("full body, (sliding kick:1.3), low to the ground, side view, one leg stretched out in front, "
              "other leg folded under, determined expression")


def union(g, prev_pos, prev_neg, image, kind, strength, ids):
    a, b, c, d = ids
    g[a] = {"class_type": "ControlNetLoader", "inputs": {"control_net_name": "controlnet-union-sdxl-promax.safetensors"}}
    g[b] = {"class_type": "SetUnionControlNetType", "inputs": {"control_net": [a, 0], "type": kind}}
    g[c] = {"class_type": "LoadImage", "inputs": {"image": image}}
    g[d] = {"class_type": "ControlNetApplyAdvanced", "inputs": {
        "positive": prev_pos, "negative": prev_neg, "control_net": [b, 0], "image": [c, 0],
        "strength": strength, "start_percent": 0.0, "end_percent": 0.7}}
    return [d, 0], [d, 1]


SLIDE_DK = ("full body, (drop kick:1.3), airborne, torso leaning back, one leg driven out toward the viewer, "
            "boot in the foreground, foreshortening, from below, intense focused eyes, gritted teeth")
SLIDE_SK = ("full body, (sliding kick:1.3), skidding low to the ground, torso leaning back, one hand planted on the ground, "
            "one leg stretched out low and long, dust, intense focused eyes")
SURGE_T = ("upper body, (gathering strength:1.2), (both fists clenched at chest height:1.3), elbows out, head thrown back, "
           "screaming, open mouth, intense eyes, from below")
ULT_T = ("full body, (wide low stance:1.3), hunched forward, head low, looking up at the viewer, (open palm toward the viewer:1.3), "
         "other hand drawn back, fierce glare, martial arts stance, from the front")
# (slot, clause, pose name, count)
PLAN = [
    ("surge", SURGE_T, "duke_surge3_a", 8), ("surge", SURGE_T, "duke_surge3_b", 8), ("surge", SURGE_T, "duke_surge3_c", 8),
    ("slide", SLIDE_DK, "duke_slide3_a", 5), ("slide", SLIDE_DK, "duke_slide3_c", 5), ("slide", SLIDE_DK, "duke_slide3_f", 5),
    ("slide", SLIDE_SK, "duke_slide3_d", 5), ("slide", SLIDE_SK, "duke_slide3_e", 5),
    ("ult", ULT_T, "duke_ult3_a", 8), ("ult", ULT_T, "duke_ult3_b", 8), ("ult", ULT_T, "duke_ult3_c", 8),
]
runs = []
base = 880000
for pi, (slot, clause, pose, n) in enumerate(PLAN):
    tag = pose or f"prompt_{pi}"
    for k in range(n):
        seed = base + pi * 100 + k
        g = base_graph(f"{BODY}, {clause}, {ACTION}, {STYLE}", NEG, 832, 1216, seed,
                       f"duke_kit/{slot}/drafts/{tag}_{seed}", batch=1, lora="duke_toll.safetensors",
                       lora_strength=0.65, hand_fix=False)
        if pose:
            pos, ng = union(g, ["2", 0], ["3", 0], f"pose3d_{pose}_depth.png", "depth", 0.55, ("40", "41", "42", "43"))
            pos, ng = union(g, pos, ng, f"pose3d_{pose}_pose.png", "openpose", 0.6, ("44", "45", "46", "47"))
            g["5"]["inputs"]["positive"], g["5"]["inputs"]["negative"] = pos, ng
        runs.append({"slot": slot, "pose": tag, "n": k + 1, "seed": seed, "prompt_id": queue(g)})
json.dump(runs, open(os.path.join(HERE, "duke_kit_runs.json"), "w"), indent=1)
print(len(runs), "queued")
