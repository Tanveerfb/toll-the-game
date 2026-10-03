"""The FINISH stage of his draft-then-finish art workflow (2026-09-27): a picked image gets detail, not a new picture.

1. Anime 4x upscale (RealESRGAN_x4plus_anime_6B), scaled back to `scale` x the source size.
2. A low-denoise img2img pass with the character's LoRA and identity prompt, so eyes, hands, hair edges and
   fabric are redrawn at the higher resolution while the composition stays his pick.
3. A BiRefNet-HR-matting cut-out of the result, for the code-drawn layers (background, aura, effects).

Usage: finish_pass.py <source.png> <out_prefix> <lora> <prompt_file> [denoise=0.35] [scale=1.5]
  source    : any image path; it is copied into ComfyUI input under a name unique to out_prefix.
              (It used to be one shared finish_src.png: queuing several finishes at once made every
              job read whichever source was copied last - 8 of Sara's 9 finishes, 2026-10-03.)
  out_prefix: ComfyUI output prefix, e.g. red_lyra/supercooling/final/finish
  prompt_file: text file, line 1 = positive prompt, line 2 = negative prompt
"""
import json
import shutil
import sys
import urllib.request

from PIL import Image

COMFY = r"E:\Installed\ComfyUI_windows_portable\ComfyUI"


def main():
    src, prefix, lora, prompt_file = sys.argv[1:5]
    denoise = float(sys.argv[5]) if len(sys.argv) > 5 else 0.35
    scale = float(sys.argv[6]) if len(sys.argv) > 6 else 1.5
    with open(prompt_file, encoding="utf-8") as f:
        pos, neg = [ln.strip() for ln in f.read().strip().split("\n", 1)]
    w, h = Image.open(src).size
    tw, th = int(w * scale) // 8 * 8, int(h * scale) // 8 * 8
    src_name = "finish_src_" + prefix.replace("/", "_").replace("\\", "_") + ".png"
    shutil.copyfile(src, COMFY + "\\input\\" + src_name)
    g = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "animagineXL40_v4Opt.safetensors"}},
        "2": {"class_type": "LoraLoader", "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": lora,
                                                     "strength_model": 0.9, "strength_clip": 0.9}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 1], "text": pos}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 1], "text": neg}},
        "10": {"class_type": "LoadImage", "inputs": {"image": src_name}},
        "11": {"class_type": "UpscaleModelLoader", "inputs": {"model_name": "RealESRGAN_x4plus_anime_6B.pth"}},
        "12": {"class_type": "ImageUpscaleWithModel", "inputs": {"upscale_model": ["11", 0], "image": ["10", 0]}},
        "13": {"class_type": "ImageScale", "inputs": {"image": ["12", 0], "upscale_method": "lanczos", "width": tw,
                                                     "height": th, "crop": "disabled"}},
        "14": {"class_type": "VAEEncode", "inputs": {"pixels": ["13", 0], "vae": ["1", 2]}},
        "15": {"class_type": "KSampler", "inputs": {"model": ["2", 0], "positive": ["3", 0], "negative": ["4", 0],
                                                   "latent_image": ["14", 0], "seed": 1, "steps": 24, "cfg": 5.5,
                                                   "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": denoise}},
        "16": {"class_type": "VAEDecode", "inputs": {"samples": ["15", 0], "vae": ["1", 2]}},
        "17": {"class_type": "SaveImage", "inputs": {"images": ["16", 0], "filename_prefix": prefix}},
        "20": {"class_type": "BiRefNetRMBG", "inputs": {"image": ["16", 0], "model": "BiRefNet-HR-matting", "sensitivity": 1.0,
                                                       "mask_blur": 0, "mask_offset": 0, "invert_output": False,
                                                       "refine_foreground": False, "background": "Alpha",
                                                       "background_color": "#222222"}},
        "21": {"class_type": "SaveImage", "inputs": {"images": ["20", 0], "filename_prefix": prefix + "_matte"}},
    }
    req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=json.dumps({"prompt": g}).encode(),
                                 headers={"Content-Type": "application/json"})
    print(tw, th, json.loads(urllib.request.urlopen(req).read())["prompt_id"])


if __name__ == "__main__":
    main()
