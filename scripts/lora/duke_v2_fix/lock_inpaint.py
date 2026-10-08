"""Paint the ear/nape strands out of the duke_v1 dataset: base Animagine (NOT the LoRA, which re-draws the strand),
masked img2img (SetLatentNoiseMask) at 0.8 inside lock_masks_png/<name>, composited back so nothing outside the mask moves.
Two seeds per image. Output: ComfyUI output/lora_duke_v2_lock/<name>_s<seed>."""
import glob
import json
import os
import shutil
import sys

sys.path.insert(0, r"E:\Projects\toll-the-game\scripts\lora")
from common import CHECKPOINT, COMFY, queue  # noqa: E402

DS = r"C:\Users\Tanve\.comfyui-mcp\training\datasets\duke_v1"
SCR = os.path.dirname(os.path.abspath(__file__))
POS = ("1boy, solo, adult man, short black hair swept back, black hair at the temples, "
       "(ear visible:1.1), bare temple, bare neck, light brown skin, black t-shirt, white background, cel shading, clean lineart, anime screencap")
NEG = ("(grey hair:1.3), (white hair:1.3), (hair strand:1.3), (sideburns:1.2), loose hair, hair over ears, curly hair, messy hair, flowing hair, "
       "worst quality, low quality, blurry, bad anatomy, text")

for f in [os.path.join(DS, k) for k in sorted(json.load(open(os.path.join(SCR, "lock_masks.json"))))]:
    n = os.path.basename(f)[:-4]
    src, msk = f"dsclean_{n}.png", f"dsclean_{n}_mask.png"
    shutil.copyfile(f, os.path.join(COMFY, "input", src))
    shutil.copyfile(os.path.join(SCR, "lock_masks_png", n + ".png"), os.path.join(COMFY, "input", msk))
    for seed in (11, 12):
        g = {
            "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
            "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": POS}},
            "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": NEG}},
            "10": {"class_type": "LoadImage", "inputs": {"image": src}},
            "12": {"class_type": "LoadImageMask", "inputs": {"image": msk, "channel": "red"}},
            "11": {"class_type": "VAEEncode", "inputs": {"pixels": ["10", 0], "vae": ["1", 2]}},
            "13": {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["11", 0], "mask": ["12", 0]}},
            "5": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
                                                      "latent_image": ["13", 0], "seed": seed, "steps": 28, "cfg": 5.5,
                                                      "sampler_name": "euler_ancestral", "scheduler": "normal",
                                                      "denoise": 0.92}},
            "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
            "14": {"class_type": "ImageCompositeMasked", "inputs": {"destination": ["10", 0], "source": ["6", 0], "x": 0,
                                                                   "y": 0, "resize_source": False, "mask": ["12", 0]}},
            "7": {"class_type": "SaveImage", "inputs": {"images": ["14", 0],
                                                       "filename_prefix": f"lora_duke_v2_lock/{n}_s{seed}"}},
        }
        queue(g)
print("queued")
