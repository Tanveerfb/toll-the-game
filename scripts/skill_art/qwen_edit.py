"""Instruction edit of one image with Qwen-Image-Edit 2511 (installed 2026-10-09, first used 2026-10-14).

For the fixes that used to be hand-placed masks plus inpainting: a garment's colour, a stray lock
of hair, a sleeve trim. The edit keeps the rest of the picture. Q4 GGUF model, the 4-step
Lightning LoRA, about 1 megapixel; the output keeps the input's aspect.

Usage (repo root, his PC, ComfyUI running):
  python scripts/skill_art/qwen_edit.py <image> "<instruction>" <out_prefix> [--seeds 2] [--seed 1] [--steps 4]
      [--ref <image2>] [--ref <image3>]

<image> is under ComfyUI output/ or absolute. <out_prefix> is relative to ComfyUI output/.
`--ref` (up to twice) adds approved images the instruction can name as "image 2" and "image 3",
for example to put the character's identity onto a pose. Check every result against the
original: an edit can change the face.
"""
import argparse
import os
import shutil
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lora"))
from common import COMFY, queue  # noqa: E402

UNET = "qwen-image-edit-2511-Q4_K_M.gguf"
LIGHTNING = "Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors"
CLIP = "qwen_2.5_vl_7b_fp8_scaled.safetensors"
VAE = "qwen_image_vae.safetensors"


def stage(path, name):
    p = path if os.path.isabs(path) else os.path.join(COMFY, "output", path)
    if not os.path.exists(p):
        sys.exit(f"not found: {p}")
    shutil.copyfile(p, os.path.join(COMFY, "input", name))
    return name


def graph(src, instruction, prefix, seed, steps, ref=None):
    g = {
        "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": UNET}},
        "2": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": LIGHTNING, "strength_model": 1.0}},
        "3": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["2", 0], "shift": 3.0}},
        "4": {"class_type": "CFGNorm", "inputs": {"model": ["3", 0], "strength": 1.0}},
        "5": {"class_type": "CLIPLoader", "inputs": {"clip_name": CLIP, "type": "qwen_image"}},
        "6": {"class_type": "VAELoader", "inputs": {"vae_name": VAE}},
        "10": {"class_type": "LoadImage", "inputs": {"image": src}},
        "11": {"class_type": "ImageScaleToTotalPixels", "inputs": {"image": ["10", 0], "upscale_method": "lanczos",
                                                                  "megapixels": 1.0, "resolution_steps": 8}},
        "12": {"class_type": "VAEEncode", "inputs": {"pixels": ["11", 0], "vae": ["6", 0]}},
        "20": {"class_type": "TextEncodeQwenImageEditPlus", "inputs": {"clip": ["5", 0], "prompt": instruction,
                                                                      "vae": ["6", 0], "image1": ["11", 0]}},
        "21": {"class_type": "TextEncodeQwenImageEditPlus", "inputs": {"clip": ["5", 0], "prompt": "",
                                                                      "vae": ["6", 0], "image1": ["11", 0]}},
        "30": {"class_type": "KSampler", "inputs": {"model": ["4", 0], "positive": ["20", 0], "negative": ["21", 0],
                                                   "latent_image": ["12", 0], "seed": seed, "steps": steps, "cfg": 1.0,
                                                   "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "31": {"class_type": "VAEDecode", "inputs": {"samples": ["30", 0], "vae": ["6", 0]}},
        "32": {"class_type": "SaveImage", "inputs": {"images": ["31", 0], "filename_prefix": prefix}},
    }
    for i, r in enumerate(ref or []):
        load, scale = str(13 + 2 * i), str(14 + 2 * i)
        g[load] = {"class_type": "LoadImage", "inputs": {"image": r}}
        g[scale] = {"class_type": "ImageScaleToTotalPixels", "inputs": {"image": [load, 0], "upscale_method": "lanczos",
                                                                       "megapixels": 1.0, "resolution_steps": 8}}
        for n in ("20", "21"):
            g[n]["inputs"][f"image{i + 2}"] = [scale, 0]
    return g


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("image")
    ap.add_argument("instruction")
    ap.add_argument("out_prefix")
    ap.add_argument("--seeds", type=int, default=2)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--steps", type=int, default=4)
    ap.add_argument("--ref", action="append", help="up to two reference images: image 2 and image 3")
    a = ap.parse_args()
    if a.ref and len(a.ref) > 2:
        sys.exit("at most two --ref images")
    tag = os.path.basename(a.out_prefix)
    src = stage(a.image, f"qedit_{tag}_src.png")
    ref = [stage(r, f"qedit_{tag}_ref{i + 2}.png") for i, r in enumerate(a.ref or [])]
    for k in range(a.seeds):
        print(queue(graph(src, a.instruction, a.out_prefix, a.seed + k, a.steps, ref)))


if __name__ == "__main__":
    main()
