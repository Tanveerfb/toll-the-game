"""Shatterburn option A: she HOLDS a bow, so the model draws a natural grip; the drawn bow replaces its bow afterwards (his pick, 2026-09-27). Earlier: Shatterburn base renders (white ground, for matting); derived from the Flash Point script: archer pose from the drawn skeleton, NO bow (the
drawn bow is composited afterwards). LoRA recipe + ControlNet 0.78/0.85."""
import json
import urllib.request

IDENTITY = (
    "lyratoll, masterpiece, best quality, absurdres, 1girl, solo, mature adult woman, late 20s, slender athletic build, "
    "(dark blue hair, very long high ponytail:1.3), (violet red eyes:1.2), "
    "(crimson red sleeveless top with a (crimson red frilled collar:1.2) and frilled shoulders:1.1), bare arms, "
    "gold bracers, dark red fingerless gloves, (short white pleated skirt:1.4)"
)
SCENE = (
    "cowboy shot, side view, facing right, archery stance, aiming upward, (left arm raised and extended up and to the side, left hand holding a wooden bow by its grip:1.3), (drawing a bow:1.2), wooden recurve bow, "
    "right hand pulled back beside her cheek, fingers pinched, intense focused expression, aiming, "
    "(simple white background:1.4), plain background, "
    "cel shading, thick clean lineart, vibrant colors, anime screencap, dramatic lighting"
)
NEG = (
    "sword, gun, (two bows:1.2), "
    "(multiple girls:1.3), (two heads:1.2), extra limbs, extra arms, extra hands, nsfw, cleavage, child, loli, "
    "(long skirt:1.2), (red skirt:1.3), (blue skirt:1.2), white shirt, (white collar:1.2), (blue ice:1.3), (blue background:1.3), colored background, gradient background, "
    "energy ball, energy orb, motion blur, afterimage, bad anatomy, bad hands, extra fingers, worst quality, low quality, "
    "blurry, realistic, 3d, text, watermark"
)


def graph(seed):
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "animagineXL40_v4Opt.safetensors"}},
        "8": {"class_type": "LoraLoader", "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": "lyra_toll.safetensors",
                                                     "strength_model": 0.9, "strength_clip": 0.9}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": f"{IDENTITY}, {SCENE}"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text": NEG}},
        "20": {"class_type": "LoadImage", "inputs": {"image": "lyra_shatterburn_skeleton.png"}},
        "21": {"class_type": "ControlNetLoader", "inputs": {"control_net_name": "controlnet-openpose-sdxl.safetensors"}},
        "22": {"class_type": "ControlNetApplyAdvanced", "inputs": {"positive": ["2", 0], "negative": ["3", 0],
                                                                  "control_net": ["21", 0], "image": ["20", 0],
                                                                  "strength": 0.78, "start_percent": 0.0, "end_percent": 0.85}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 832, "height": 1216, "batch_size": 4}},
        "5": {"class_type": "KSampler", "inputs": {"model": ["8", 0], "positive": ["22", 0], "negative": ["22", 1],
                                                  "latent_image": ["4", 0], "seed": seed, "steps": 30, "cfg": 6.0,
                                                  "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1.0}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": "lyra_kit/shatterburn_a"}},
    }


for seed in (6400, 6401, 6402):
    body = json.dumps({"prompt": graph(seed)}).encode()
    req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=body, headers={"Content-Type": "application/json"})
    print(seed, json.loads(urllib.request.urlopen(req).read())["prompt_id"])
