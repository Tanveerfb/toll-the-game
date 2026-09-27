"""Step 5: pick a checkpoint. Identity prompt plus trigger in three situations
absent from the dataset, same seeds, one row per checkpoint and one row for
today's IP-Adapter method. Checkpoints go in ComfyUI models/loras/training/.
Usage: test_checkpoints.py <id> <lora file>[,<lora file>...]
"""
import sys
from common import NEG_BASE, base_graph, profile, queue

SCENES = [
    ("run", "full body, running, dynamic pose, outdoors, grassy field, blue sky", 832, 1216),
    ("sit", "sitting on a stone wall, relaxed, cowboy shot, city street at night, lanterns", 832, 1216),
    ("wind", "portrait, close-up, determined expression, wind blowing hair, sunset sky", 1024, 1024),
]
STYLE = "cel shading, thick clean lineart, anime screencap"

p = profile(sys.argv[1])
neg = f"{NEG_BASE}, {p['negative_extra']}"
for row in ["ipa"] + sys.argv[2].split(","):
    short = "ipa" if row == "ipa" else row.split("_")[-1].split(".")[0].lstrip("0")
    for i, (slug, scene, w, h) in enumerate(SCENES):
        if row == "ipa":
            g = base_graph(f"{p['identity']}, {scene}, {STYLE}", neg, w, h, 4242 + i,
                           f"lora_test/{p['id']}_{short}_{slug}", batch=2, face_ref=p["face_ref"])
        else:
            g = base_graph(f"{p['trigger']}, {p['identity']}, {scene}, {STYLE}", neg, w, h, 4242 + i,
                           f"lora_test/{p['id']}_{short}_{slug}", batch=2, lora="training\\" + row)
        print(short, slug, queue(g))
