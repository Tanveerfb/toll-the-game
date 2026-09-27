"""Shatterburn, two more poses (his ask, 2026-09-27), original method: full-quality batches, filter, he picks.
Poses taken from 7DSGC as ideas only (prompt-driven; their art is never fed to a sampler):
  back - like Gawain skill 2: seen from behind and a little above, walking into the blaze, arms loose and out
  side - like Gowther skill 1: side-on, leaning back, one arm thrust up at the sky
No bow is rendered: the drawn bow goes slung across her back afterwards (nothing to erase).
Usage: lyra_shatterburn_poses.py [back|side ...]  -> ComfyUI output red_lyra/shatterburn/drafts/<pose>_<seed>
"""
import json
import sys
import urllib.request

IDENTITY = (
    "lyratoll, masterpiece, best quality, absurdres, 1girl, solo, mature adult woman, late 20s, slender athletic build, "
    "(dark blue hair, very long high ponytail:1.3), "
    "(crimson red sleeveless top with a (crimson red frilled collar:1.2) and frilled shoulders:1.1), bare arms, "
    "gold bracers, dark red fingerless gloves, (short white pleated skirt:1.4), (crimson ankle boots:1.1)"
)
POSES = {
    "back": "(full body:1.2), (from behind:1.4), (back view:1.3), from above, facing away, walking forward, "
            "(arms held loosely out from her sides, open hands:1.2), ponytail swaying, bare shoulders, bare back of arms",
    # His pick (2026-09-27): B3's pose with the bow REALLY in her hand, so the grip is the model's own; our
    # drawn bow replaces its bow afterwards (bow_swap.py). Render this one WITHOUT bow in the negative.
    "back_bow": "(full body:1.2), (from behind:1.4), (back view:1.3), from above, facing away, walking forward, "
                "(right hand holding a wooden recurve bow by its grip, bow hanging down at her side:1.35), "
                "left arm held loosely out, open hand, ponytail swaying, bare shoulders",
    "side": "(full body:1.1), (from side:1.3), facing right, (leaning back:1.3), (right arm thrust straight up, "
            "pointing at the sky:1.3), left arm down at her side, looking up, (violet red eyes:1.1), determined expression",
}
STYLE = ("(simple white background:1.4), plain background, cel shading, thick clean lineart, vibrant colors, "
         "anime screencap, dramatic lighting")
NEG = (
    "(bow:1.4), (bow \\(weapon\\):1.4), (arrow:1.3), bowstring, holding weapon, sword, gun, "
    "(multiple girls:1.3), (two heads:1.2), extra limbs, extra arms, extra hands, nsfw, ass focus, cleavage, child, "
    "loli, (long skirt:1.2), (red skirt:1.3), (blue skirt:1.2), (striped skirt:1.2), white shirt, (white collar:1.2), "
    "(blue ice:1.3), colored background, gradient background, bad anatomy, bad hands, extra fingers, worst quality, "
    "low quality, blurry, realistic, 3d, text, watermark"
)

NEG_BOW = NEG.replace("(bow:1.4), (bow \\(weapon\\):1.4), (arrow:1.3), bowstring, holding weapon, ",
                      "(two bows:1.3), (arrow:1.2), ")


def graph(pose, seed):
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "animagineXL40_v4Opt.safetensors"}},
        "8": {"class_type": "LoraLoader", "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": "lyra_toll.safetensors",
                                                     "strength_model": 0.9, "strength_clip": 0.9}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": f"{IDENTITY}, {POSES[pose]}, {STYLE}"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1],
                                                         "text": NEG_BOW if pose.endswith("_bow") else NEG}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 832, "height": 1216, "batch_size": 4}},
        "5": {"class_type": "KSampler", "inputs": {"model": ["8", 0], "positive": ["2", 0], "negative": ["3", 0],
                                                  "latent_image": ["4", 0], "seed": seed, "steps": 30, "cfg": 6.0,
                                                  "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1.0}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0],
                                                    "filename_prefix": f"red_lyra/shatterburn/drafts/{pose}_{seed}"}},
    }


for pose in sys.argv[1:] or list(POSES):
    for seed in (9500, 9501, 9502):
        req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=json.dumps({"prompt": graph(pose, seed)}).encode(),
                                     headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req).read()
    print("queued 12", pose)
