"""Pose maps from a reference image: a DWPose skeleton and a Depth Anything V2 Small depth map, padded to the
draft canvas (832x1216). The reference's art never reaches a sampler (output/references/README.md): only its
pose and its depth silhouette do, through the union ControlNet.

Usage (repo root, his PC, ComfyUI running):
  python scripts/skill_art/ref_pose_maps.py <name> <reference image> [<name> <image> ...]

Writes ComfyUI input/refpose_<name>_pose.png and refpose_<name>_depth.png (what kit_drafts-style graphs load)
and a side-by-side preview in output/refpose/<name>_preview.png. Look at the preview before drafting:
DWPose misreads card art (it drew the Goku power-up's forearms sideways, 2026-10-07).
"""
import os
import sys
import time
import urllib.request
import json

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lora"))
from common import COMFY, queue  # noqa: E402

W, H = 832, 1216


def graph(src, name):
    return {
        "1": {"class_type": "LoadImage", "inputs": {"image": src}},
        "2": {"class_type": "DWPreprocessor", "inputs": {"image": ["1", 0], "detect_hand": "enable", "detect_body": "enable",
                                                         "detect_face": "enable", "resolution": 1024,
                                                         "bbox_detector": "yolox_l.torchscript.pt",
                                                         "pose_estimator": "dw-ll_ucoco_384_bs5.torchscript.pt",
                                                         "scale_stick_for_xinsr_cn": "disable"}},
        "3": {"class_type": "DepthAnythingV2Preprocessor", "inputs": {"image": ["1", 0], "ckpt_name": "depth_anything_v2_vits.pth",
                                                                      "resolution": 1024}},
        "4": {"class_type": "SaveImage", "inputs": {"images": ["2", 0], "filename_prefix": f"refpose/raw/{name}_pose"}},
        "5": {"class_type": "SaveImage", "inputs": {"images": ["3", 0], "filename_prefix": f"refpose/raw/{name}_depth"}},
    }


def wait(pid):
    while True:
        h = json.loads(urllib.request.urlopen(f"http://127.0.0.1:8188/history/{pid}").read())
        if pid in h:
            return h[pid]
        time.sleep(1)


def figure_only(depth_path, alpha):
    """Black out everything but the figure. Depth Anything shades the empty background as a grey glow, and the
    ControlNet drew that glow as neon halos round every figure (2026-10-14). A cut-out reference's alpha is the
    mask; without one, anything within 20 levels of the border's median is background."""
    d = Image.open(depth_path).convert("L")
    if alpha is not None:
        m = alpha.resize(d.size).point(lambda v: 255 if v > 128 else 0)
    else:
        w, h = d.size
        border = sorted(d.getpixel((x, y)) for x in range(0, w, 4) for y in (0, h - 1)) + \
            sorted(d.getpixel((x, y)) for y in range(0, h, 4) for x in (0, w - 1))
        bg = sorted(border)[len(border) // 2]
        m = d.point(lambda v: 255 if v > bg + 20 else 0)
    out = Image.new("L", d.size, 0)
    out.paste(d, (0, 0), m)
    out.convert("RGB").save(depth_path)


def pad(path):
    """Fit inside the draft canvas, centred, black padding (black = no pose / far)."""
    im = Image.open(path).convert("RGB")
    s = min(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    out = Image.new("RGB", (W, H))
    out.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    return out


def main():
    args = sys.argv[1:]
    if not args or len(args) % 2:
        sys.exit(__doc__)
    os.makedirs(os.path.join(COMFY, "output", "refpose"), exist_ok=True)
    for name, ref in zip(args[::2], args[1::2]):
        src = f"refsrc_{name}.png"
        rgba = Image.open(ref).convert("RGBA")
        alpha = rgba.getchannel("A") if rgba.getextrema()[3][0] < 255 else None
        flat = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        Image.alpha_composite(flat, rgba).convert("RGB").save(os.path.join(COMFY, "input", src))
        h = wait(queue(graph(src, name)))
        files = {}
        for node, kind in (("4", "pose"), ("5", "depth")):
            img = h["outputs"][node]["images"][0]
            p = os.path.join(COMFY, "output", img["subfolder"], img["filename"])
            if kind == "depth":
                figure_only(p, alpha)
            pad(p).save(os.path.join(COMFY, "input", f"refpose_{name}_{kind}.png"))
            files[kind] = os.path.join(COMFY, "input", f"refpose_{name}_{kind}.png")
        prev = Image.new("RGB", (W * 3, H))
        prev.paste(pad(ref), (0, 0))
        prev.paste(Image.open(files["pose"]), (W, 0))
        prev.paste(Image.open(files["depth"]), (W * 2, 0))
        prev.resize((W * 3 // 3, H // 3)).save(os.path.join(COMFY, "output", "refpose", f"{name}_preview.png"))
        print("ok", name)


if __name__ == "__main__":
    main()
