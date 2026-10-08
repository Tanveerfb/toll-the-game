"""Paint the white collar trim black on duke_v2 images (his OK, 2026-10-08). In a band under the face box, light
low-saturation pixels that form THIN components (not the background, not the border) become the shirt's own dark colour.
Originals backed up to duke_v2/_precollar. Writes a before/after sheet."""
import json
import os
import shutil

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

V2 = r"C:\Users\Tanve\.comfyui-mcp\training\datasets\duke_v2"
SCR = os.path.dirname(os.path.abspath(__file__))
F = json.load(open(os.path.join(SCR, "ds_faces.json")))
NAMES = ["duke_01", "duke_08", "duke_10", "duke_14", "duke_17", "duke_19", "duke_20"]
BK = os.path.join(V2, "_precollar")
os.makedirs(BK, exist_ok=True)
pairs = []
for n in NAMES:
    p = os.path.join(V2, n + ".png")
    if not os.path.exists(os.path.join(BK, n + ".png")):
        shutil.copyfile(p, os.path.join(BK, n + ".png"))
    im = np.array(Image.open(os.path.join(BK, n + ".png")).convert("RGB")).astype(np.int32)
    H, W = im.shape[:2]
    x0, y0, x1, y1 = F[n + ".png"]
    fw, fh = x1 - x0, y1 - y0
    band = np.zeros((H, W), bool)
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = (x0 + x1) / 2, y1 + 0.12 * fh
    band = (((xx - cx) / (0.75 * fw)) ** 2 + ((yy - cy) / (0.42 * fh)) ** 2) < 1
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mx, mn = im.max(-1), im.min(-1)
    light = (mx > 88) & ((mx - mn) < 34) & band & (yy > y1 - 0.02 * fh)
    lab, k = ndimage.label(light)
    out = np.zeros_like(light)
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        comp = lab[sl] == i
        area = comp.sum()
        touches = sl[0].start == 0 or sl[1].start == 0 or sl[0].stop == H or sl[1].stop == W
        thick = area / max(1, max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start))
        if not touches and area < 0.02 * fw * fh * 4 and thick < 0.06 * fw:
            out[sl] |= comp
    skin = (r - b > 22) & (mx > 90)
    out = ndimage.binary_dilation(out, iterations=4 if n == "duke_17" else 1) & ~skin & (yy > y1 - 0.02 * fh)
    dark = (mx < 60) & band & (yy > cy)
    col = np.median(im[dark], axis=0) if dark.any() else np.array([20, 18, 20])
    fixed = im.copy()
    fixed[out] = col
    Image.fromarray(fixed.astype(np.uint8)).save(p)
    pairs.append((n, im, fixed, (x0 - 0.6 * fw, y1 - 0.4 * fh, x1 + 0.6 * fw, y1 + 1.0 * fh), int(out.sum())))
T = 300
font = ImageFont.truetype("arialbd.ttf", 18)
sheet = Image.new("RGB", (2 * T, len(pairs) * T), "white")
d = ImageDraw.Draw(sheet)
for i, (n, a, b_, box, cnt) in enumerate(pairs):
    for c, arr in enumerate((a, b_)):
        sheet.paste(Image.fromarray(arr.astype(np.uint8)).crop(box).resize((T, T)), (c * T, i * T))
    d.text((4, i * T + 4), f"{n} before", fill="red", font=font)
    d.text((T + 4, i * T + 4), f"after ({cnt}px)", fill="red", font=font)
sheet.save(os.path.join(SCR, "collar_fix.jpg"), quality=86)
print([(p[0], p[4]) for p in pairs])
