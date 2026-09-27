"""Repaint ONLY her bow hand around an already-placed drawn bow, so the fingers wrap the grip.

For bow_in_open_hand.py results where an open hand reads as "in front of the bow", not holding it (Shatterburn
B3, 2026-09-27). The bow is already in swapped.png; a small ellipse over the hand is re-noised at `denoise` with
the LoRA and a gripping prompt, several seeds, and the drawn riser is pasted back ABOVE and BELOW the hand
afterwards so the model cannot bend the bow. Pick with --pick <seed> (copies over swapped.png, keeping the
open-hand original as swapped_openhand.png).
Usage: grip_hand.py <cfg.json> [--pick SEED]   cfg: out_dir, hand_box, prompt_file, grip_seeds, grip_denoise
"""
import json
import os
import shutil
import sys
import time
import urllib.request

from PIL import Image, ImageDraw, ImageFilter

COMFY = r"E:\Installed\ComfyUI_windows_portable\ComfyUI"


def run(cfg):
    d = cfg["out_dir"]
    src = os.path.join(d, "swapped.png")
    im = Image.open(src)
    W, H = im.size
    x0, y0, x1, y1 = cfg["hand_box"]
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).ellipse((x0 - 8, y0 - 8, x1 + 8, y1 + 8), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(6))
    m.save(os.path.join(d, "grip_mask.png"))
    shutil.copyfile(src, COMFY + r"\input\grip_src.png")
    m.save(COMFY + r"\input\grip_mask.png")
    with open(cfg["prompt_file"], encoding="utf-8") as f:
        pos, neg = [ln.strip() for ln in f.read().strip().split("\n", 1)]
    pos += ", (hand gripping the handle of a bow:1.4), (fingers wrapped around the bow grip:1.3), holding a bow at her side"
    neg += ", open hand, spread fingers, extra fingers, fused fingers"
    for seed in cfg.get("grip_seeds", [5, 15, 25, 35]):
        g = {
            "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "animagineXL40_v4Opt.safetensors"}},
            "2": {"class_type": "LoraLoader", "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": "lyra_toll.safetensors",
                                                         "strength_model": 0.9, "strength_clip": 0.9}},
            "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 1], "text": pos}},
            "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 1], "text": neg}},
            "10": {"class_type": "LoadImage", "inputs": {"image": "grip_src.png"}},
            "11": {"class_type": "LoadImageMask", "inputs": {"image": "grip_mask.png", "channel": "red"}},
            "12": {"class_type": "VAEEncode", "inputs": {"pixels": ["10", 0], "vae": ["1", 2]}},
            "16": {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["12", 0], "mask": ["11", 0]}},
            "13": {"class_type": "KSampler", "inputs": {"model": ["2", 0], "positive": ["3", 0], "negative": ["4", 0],
                                                       "latent_image": ["16", 0], "seed": seed, "steps": 30, "cfg": 6.0,
                                                       "sampler_name": "dpmpp_2m", "scheduler": "karras",
                                                       "denoise": cfg.get("grip_denoise", 0.62)}},
            "14": {"class_type": "VAEDecode", "inputs": {"samples": ["13", 0], "vae": ["1", 2]}},
            "15": {"class_type": "SaveImage", "inputs": {"images": ["14", 0],
                                                        "filename_prefix": f"{cfg['out_prefix']}_grip_{seed}_{int(time.time())}"}},
        }
        req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=json.dumps({"prompt": g}).encode(),
                                     headers={"Content-Type": "application/json"})
        pid = json.loads(urllib.request.urlopen(req).read())["prompt_id"]
        for _ in range(100):
            time.sleep(2)
            h = json.loads(urllib.request.urlopen(f"http://127.0.0.1:8188/history/{pid}").read())
            if pid in h and h[pid].get("outputs"):
                o = h[pid]["outputs"]["15"]["images"][0]
                rep = Image.open(os.path.join(COMFY, "output", o["subfolder"], o["filename"])).convert("RGB")
                base = Image.open(src).convert("RGB")
                base.paste(rep, (0, 0), m)
                base.save(os.path.join(d, f"grip_{seed}.png"))
                print("grip", seed)
                break


def pick(cfg, seed):
    d = cfg["out_dir"]
    if not os.path.exists(os.path.join(d, "swapped_openhand.png")):
        shutil.copyfile(os.path.join(d, "swapped.png"), os.path.join(d, "swapped_openhand.png"))
    shutil.copyfile(os.path.join(d, f"grip_{seed}.png"), os.path.join(d, "swapped.png"))
    print("picked grip", seed)


if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf-8") as f:
        c = json.load(f)
    if "--pick" in sys.argv:
        pick(c, sys.argv[sys.argv.index("--pick") + 1])
    else:
        run(c)
