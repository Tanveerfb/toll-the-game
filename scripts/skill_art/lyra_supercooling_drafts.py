"""Supercooling (Lyra's passive, +DEF identity) - DRAFT round (his draft-then-finish workflow, 2026-09-27).

Drafts are full size (832x1216) at 12 steps with dpmpp_2m/karras: a non-ancestral sampler, so the finish
(same seed, full steps, then upscale + low-denoise pass) keeps the composition he picked. One image per job,
one seed per image, so every draft is reproducible on its own. No bow or shield is rendered: the drawn bow is
composited at the finish (#160). His earlier pick Q07 (now red_lyra/supercooling/drafts/passive2_a_00007) stays in the running - and won.

Usage: lyra_supercooling_drafts.py [seed_start]  -> ComfyUI output red_lyra/supercooling/drafts/supercool_draft_<scene>_<seed>
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
STYLE = "cel shading, thick clean lineart, vibrant colors, anime screencap, dramatic rim lighting"
SCENES = {
    # Q07's idea, pushed toward the passive's name: cold, still, unbothered.
    "crossed": "cowboy shot, standing, (arms crossed:1.2), calm confident expression, looking at viewer, "
               "(frost and small red ice crystals forming on her arms and shoulders:1.2), cold breath mist, "
               "hair drifting, simple dark background",
    "guard": "cowboy shot, defensive stance, (one forearm raised in front of her chest, bracer glowing red:1.2), "
             "focused expression, looking at viewer, (red ice crystals frosting over her forearm:1.2), cold mist, "
             "simple dark background",
    "still": "cowboy shot, standing still, (eyes closed:1.1), serene expression, breathing out cold mist, "
             "(small red ice crystals floating around her:1.2), hair floating, arms relaxed at her sides, "
             "simple dark background",
}
NEG = (
    "(bow:1.3), (bow \\(weapon\\):1.3), (shield:1.4), holding weapon, sword, gun, "
    "(multiple girls:1.3), (two heads:1.2), extra limbs, extra arms, extra hands, nsfw, cleavage, child, loli, "
    "(long skirt:1.2), (red skirt:1.3), (blue skirt:1.2), white shirt, (white collar:1.2), (blue ice:1.3), "
    "bad anatomy, bad hands, extra fingers, worst quality, low quality, blurry, realistic, 3d, text, watermark"
)


def graph(scene, seed):
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "animagineXL40_v4Opt.safetensors"}},
        "8": {"class_type": "LoraLoader", "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": "lyra_toll.safetensors",
                                                     "strength_model": 0.9, "strength_clip": 0.9}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": f"{IDENTITY}, {SCENES[scene]}, {STYLE}"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": NEG}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 832, "height": 1216, "batch_size": 1}},
        "5": {"class_type": "KSampler", "inputs": {"model": ["8", 0], "positive": ["2", 0], "negative": ["3", 0],
                                                  "latent_image": ["4", 0], "seed": seed, "steps": 12, "cfg": 6.0,
                                                  "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": f"red_lyra/supercooling/drafts/supercool_draft_{scene}_{seed}"}},
    }


start = int(sys.argv[1]) if len(sys.argv) > 1 else 8100
for scene in SCENES:
    for seed in range(start, start + 8):
        req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=json.dumps({"prompt": graph(scene, seed)}).encode(),
                                     headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req).read()
print("queued", len(SCENES) * 8)
