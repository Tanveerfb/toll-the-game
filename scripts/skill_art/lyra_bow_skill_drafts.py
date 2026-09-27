"""Flash Point and Shatterburn redo - DRAFT round (his ask, 2026-09-27: "can be reiterated for a better quality?
drafts first").

What changes from the installed versions: she HOLDS a bow in the render (the option-A lesson from Shatterburn:
the model draws a real grip only when a bow is really there; Flash Point still has a fist), on a plain white
ground so the matte is clean and the class-colour background is drawn in code afterwards (#161). Pose from our own
archer skeletons (scripts/bow_composite/archer_pose.py), ControlNet 0.78 / end 0.85 as before.

Drafts: 832x1216, 12 steps, dpmpp_2m/karras, one image per seed (reproducible for the finish).
Usage: lyra_bow_skill_drafts.py [piece ...]  -> ComfyUI output red_lyra/<piece>/drafts/redo_<concept>_<seed>
"""
import json
import sys
import urllib.request

IDENTITY = (
    "lyratoll, masterpiece, best quality, absurdres, 1girl, solo, mature adult woman, late 20s, slender athletic build, "
    "(dark blue hair, very long high ponytail:1.3), (violet red eyes:1.2), "
    "(crimson red sleeveless top with a (crimson red frilled collar:1.2) and frilled shoulders:1.1), bare arms, "
    "gold bracers, dark red fingerless gloves, (short white pleated skirt:1.4)"
)
# His note mid-run: "both basically read as same kind of attack". So each skill gets poses from what it DOES.
# Flash Point = one piercing shot (speed, precision); Shatterburn = a hit that leaves Decay (the aftermath).
# Every concept stays side-on: the drawn bow is flat and cannot be foreshortened. skeleton None = pose from prompt.
GRIP = "left hand holding a wooden recurve bow by its grip"
CONCEPTS = {
    "flash-point": {
        "leap": (None, f"full body, side view, facing left, (leaping through the air mid-dash:1.3), (drawing a bow:1.2), "
                       f"({GRIP}:1.3), bow arm straight out ahead, right hand pulled back to her cheek, hair and skirt "
                       f"streaming behind her, speed, intense focused expression"),
        "kneel": (None, f"full body, side view, facing left, (kneeling on one knee:1.3), (drawing a bow:1.2), "
                        f"({GRIP}:1.3), bow held level, arrow aimed straight ahead, right hand at her cheek, "
                        f"calm precise expression, sniper focus"),
    },
    "shatterburn": {
        "aim": ("lyra_shatterburn_skeleton.png",
                f"cowboy shot, side view, facing right, archery stance, aiming upward, (left arm raised and extended up "
                f"and to the side, {GRIP}:1.3), (drawing a bow:1.2), right hand pulled back beside her cheek, fingers "
                f"pinched, intense focused expression"),
        "follow": (None, f"cowboy shot, side view, facing right, (arrow just released:1.2), (follow-through pose:1.2), "
                         f"({GRIP}:1.3), bow arm still extended forward, (right hand open and flung back behind her "
                         f"head:1.3), bowstring empty, fierce satisfied expression, hair whipping"),
    },
}
STYLE = ("(simple white background:1.4), plain background, cel shading, thick clean lineart, vibrant colors, "
         "anime screencap, dramatic lighting")
NEG = (
    "sword, gun, (two bows:1.2), (multiple girls:1.3), (two heads:1.2), extra limbs, extra arms, extra hands, nsfw, "
    "cleavage, child, loli, (long skirt:1.2), (red skirt:1.3), (blue skirt:1.2), white shirt, (white collar:1.2), "
    "(blue ice:1.3), (blue background:1.3), colored background, gradient background, energy ball, motion blur, "
    "afterimage, bad anatomy, bad hands, extra fingers, worst quality, low quality, blurry, realistic, 3d, text, watermark"
)


def graph(piece, concept, seed):
    skeleton, scene = CONCEPTS[piece][concept]
    g = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "animagineXL40_v4Opt.safetensors"}},
        "8": {"class_type": "LoraLoader", "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": "lyra_toll.safetensors",
                                                     "strength_model": 0.9, "strength_clip": 0.9}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": f"{IDENTITY}, {scene}, {STYLE}"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": NEG}},
        "20": {"class_type": "LoadImage", "inputs": {"image": skeleton}},
        "21": {"class_type": "ControlNetLoader", "inputs": {"control_net_name": "controlnet-openpose-sdxl.safetensors"}},
        "22": {"class_type": "ControlNetApplyAdvanced", "inputs": {"positive": ["2", 0], "negative": ["3", 0],
                                                                  "control_net": ["21", 0], "image": ["20", 0],
                                                                  "strength": 0.78, "start_percent": 0.0, "end_percent": 0.85}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 832, "height": 1216, "batch_size": 1}},
        "5": {"class_type": "KSampler", "inputs": {"model": ["8", 0], "positive": ["22", 0], "negative": ["22", 1],
                                                  "latent_image": ["4", 0], "seed": seed, "steps": 12, "cfg": 6.0,
                                                  "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0],
                                                    "filename_prefix": f"red_lyra/{piece}/drafts/redo_{concept}_{seed}"}},
    }
    if skeleton is None:  # free pose: condition the sampler on the prompt alone
        for k in ("20", "21", "22"):
            del g[k]
        g["5"]["inputs"]["positive"], g["5"]["inputs"]["negative"] = ["2", 0], ["3", 0]
    return g


def final(piece, concept, seed):
    """His pick at full quality: same seed and sampler, 30 steps, into <piece>/final/."""
    g = graph(piece, concept, seed)
    g["5"]["inputs"]["steps"] = 30
    g["7"]["inputs"]["filename_prefix"] = f"red_lyra/{piece}/final/{concept}_{seed}_full"
    return g


if len(sys.argv) > 1 and sys.argv[1] == "final":  # final <piece> <concept> <seed>
    piece, concept, seed = sys.argv[2], sys.argv[3], int(sys.argv[4])
    req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=json.dumps({"prompt": final(piece, concept, seed)}).encode(),
                                 headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req).read()
    print("queued final", piece, concept, seed)
    sys.exit(0)

for piece in sys.argv[1:] or list(CONCEPTS):
    for concept in CONCEPTS[piece]:
        for seed in range(9200, 9206):
            req = urllib.request.Request("http://127.0.0.1:8188/prompt",
                                         data=json.dumps({"prompt": graph(piece, concept, seed)}).encode(),
                                         headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req).read()
        print("queued 6", piece, concept)
