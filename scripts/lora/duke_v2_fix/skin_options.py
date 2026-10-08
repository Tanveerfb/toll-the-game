"""Skin options for his choice: per image, gain the skin so the LIT median hits a target. A = the dataset's own average
(pale peach, ~242,199,170). B = the locked D22 face (236,163,124). Shows D22 crop, then D01/D16/D21: original | A | B."""
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

V2 = r"C:\Users\Tanve\.comfyui-mcp\training\datasets\duke_v2"
SCR = os.path.dirname(os.path.abspath(__file__))
F = json.load(open(os.path.join(SCR, "ds_faces.json")))
TARGETS = {"A": np.array([242, 199, 170.]), "B": np.array([236, 163, 124.])}


def skin(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = a.max(-1)
    return (r > g) & (g > b) & (r - b > 30) & (mx > 60) & (r < 252)


def lit_median(a, m):
    s = a[m]
    L = s.mean(-1)
    return np.median(s[L > np.percentile(L, 50)], axis=0)


def shift(a, target):
    m = skin(a)
    gain = target / lit_median(a, m)
    mm = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))
    mm = np.array(mm).astype(np.float32)[..., None] / 255
    return a * (1 - mm) + np.clip(a * gain, 0, 255) * mm


if __name__ == "__main__":
    T = 300
    font = ImageFont.truetype("arialbd.ttf", 22)
    names = ["duke_01", "duke_16", "duke_21"]
    sheet = Image.new("RGB", (3 * T, (len(names) + 1) * T), "white")
    d = ImageDraw.Draw(sheet)
    ref = Image.open(r"E:\Installed\ComfyUI_windows_portable\ComfyUI\output\lora_duke_design\cand_resolute_fist_00001_.png").convert("RGB")
    ref.thumbnail((T, T))
    sheet.paste(ref, (T, 0))
    d.text((T + 4, 4), "LOCKED D22", fill="red", font=font)
    for i, n in enumerate(names, start=1):
        a = np.array(Image.open(os.path.join(V2, n + ".png")).convert("RGB")).astype(np.float32)
        x0, y0, x1, y1 = F[n + ".png"]
        p = (x1 - x0) * 0.6
        box = (x0 - p, y0 - p, x1 + p, y1 + p * 1.3)
        for c, (lab, arr) in enumerate((("now", a), ("A pale", shift(a, TARGETS["A"])), ("B D22 brown", shift(a, TARGETS["B"])))):
            sheet.paste(Image.fromarray(arr.astype(np.uint8)).crop(box).resize((T, T)), (c * T, i * T))
            d.text((c * T + 4, i * T + 4), f"{n[-2:]} {lab}", fill="red", font=font)
    sheet.save(os.path.join(SCR, "skin_options.jpg"), quality=86)
    print("ok")
