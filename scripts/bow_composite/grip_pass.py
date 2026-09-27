"""Bow-hand pass: redraw the bow hand AROUND the composited grip.

An archer's bow hand is not a fist: the grip sits in the web between thumb
and index finger and the fingers wrap loosely round the handle (Tanveer,
2026-09-27: "her left hand should be holding the center of the bow and not be
a fist"). The render cannot know where the bow is, so the bow is composited
first, over the hand, and this pass inpaints the hand region with the bow
already in it, at a denoise high enough to rebuild fingers round the grip.
The earlier finger pass (0.55, hand pasted over the bow first) kept the bow
in front of the hand in all four tries.

Usage: grip_pass.py prep <composite.png> <cx> <cy> <tag> [denoise]
       grip_pass.py paste <composite.png> <cx> <cy> <tag> <rendered.png> <out.png>"""
import json
import sys
import urllib.request
from PIL import Image, ImageDraw, ImageFilter

HALF, UP = 110, 4
mode, src, cx, cy, tag = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
IN = r"E:\Installed\ComfyUI_windows_portable\ComfyUI\input"
box = (cx - HALF, cy - HALF, cx + HALF, cy + HALF)


def ellipse_mask(size, rx, ry, blur):
    m = Image.new("L", size, 0)
    w, h = size
    ImageDraw.Draw(m).ellipse([w / 2 - rx, h / 2 - ry, w / 2 + rx, h / 2 + ry], fill=255)
    return m.filter(ImageFilter.GaussianBlur(blur))


if mode == "prep":
    denoise = float(sys.argv[6]) if len(sys.argv) > 6 else 0.72
    im = Image.open(src).convert("RGB")
    crop = Image.new("RGB", (2 * HALF, 2 * HALF), (0, 0, 0))
    crop.paste(im.crop((max(box[0], 0), max(box[1], 0), min(box[2], im.width), min(box[3], im.height))),
               (max(-box[0], 0), max(-box[1], 0)))
    crop.resize((2 * HALF * UP, 2 * HALF * UP), Image.LANCZOS).save(f"{IN}\\{tag}_crop.png")
    ellipse_mask((2 * HALF * UP, 2 * HALF * UP), 60 * UP, 66 * UP, 10).save(f"{IN}\\{tag}_mask.png")
    g = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "animagineXL40_v4Opt.safetensors"}},
        "8": {"class_type": "LoraLoader", "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": "lyra_toll.safetensors",
                                                     "strength_model": 0.5, "strength_clip": 0.5}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text":
              "masterpiece, best quality, close-up of an archer's hand holding a wooden bow by its leather grip, "
              "(bow handle resting in the web between thumb and index finger:1.2), (fingers loosely wrapped around "
              "the bow grip:1.3), thumb on the far side of the grip, relaxed open hand, dark red fingerless glove, "
              "gold bracer on the wrist, the bow passes through the hand, cel shading, thick clean lineart, anime"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["8", 1], "text":
              "(clenched fist:1.3), punching, fist, bad hands, extra fingers, fused fingers, missing fingers, mitten, "
              "deformed, broken bow, two bows, blurry, worst quality, realistic, 3d"}},
        "10": {"class_type": "LoadImage", "inputs": {"image": f"{tag}_crop.png"}},
        "11": {"class_type": "LoadImageMask", "inputs": {"image": f"{tag}_mask.png", "channel": "red"}},
        "12": {"class_type": "VAEEncode", "inputs": {"pixels": ["10", 0], "vae": ["1", 2]}},
        "13": {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["12", 0], "mask": ["11", 0]}},
        "14": {"class_type": "RepeatLatentBatch", "inputs": {"samples": ["13", 0], "amount": 4}},
        "5": {"class_type": "KSampler", "inputs": {"model": ["8", 0], "positive": ["2", 0], "negative": ["3", 0],
                                                  "latent_image": ["14", 0], "seed": 7400, "steps": 30, "cfg": 6.5,
                                                  "sampler_name": "euler_ancestral", "scheduler": "normal",
                                                  "denoise": denoise}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": f"lyra_kit/{tag}_grip"}},
    }
    body = json.dumps({"prompt": g}).encode()
    req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=body, headers={"Content-Type": "application/json"})
    print(json.loads(urllib.request.urlopen(req).read())["prompt_id"])
else:
    rendered, out = sys.argv[6], sys.argv[7]
    im = Image.open(src).convert("RGB")
    r = Image.open(rendered).convert("RGB").resize((2 * HALF, 2 * HALF), Image.LANCZOS)
    im.paste(r, (box[0], box[1]), ellipse_mask((2 * HALF, 2 * HALF), 58, 64, 5))
    im.save(out)
    print("pasted", out)
