"""Gridded head crops of the duke_v1 dataset for hand-placing the grey-lock masks. Crop box = face box padded 0.75w
(0.6 above, 0.9 below). Grid lines every 10% of the crop, labelled 0-9 on both axes. Optional: draw MASKS (lock_masks.json)
in red so a sheet doubles as the mask check."""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

SCR = os.path.dirname(os.path.abspath(__file__))
DS = r"C:\Users\Tanve\.comfyui-mcp\training\datasets\duke_v1"
F = json.load(open(os.path.join(SCR, "ds_faces.json")))
MP = os.path.join(SCR, "lock_masks.json")
M = json.load(open(MP)) if os.path.exists(MP) and "check" in sys.argv else {}
font = ImageFont.truetype("arialbd.ttf", 16)
T = 400


def crop_box(n):
    x0, y0, x1, y1 = F[n]
    w = x1 - x0
    return (x0 - 0.75 * w, y0 - 0.6 * w, x1 + 0.75 * w, y1 + 0.9 * w)


names = sorted(F)
for b in range(0, len(names), 6):
    sh = Image.new("RGB", (3 * T, 2 * T), "white")
    d = ImageDraw.Draw(sh)
    for j, n in enumerate(names[b:b + 6]):
        ox, oy = (j % 3) * T, (j // 3) * T
        im = Image.open(os.path.join(DS, n)).convert("RGB").crop(crop_box(n)).resize((T, T))
        sh.paste(im, (ox, oy))
        for k in range(1, 10):
            c = (0, 160, 255)
            d.line([(ox + k * T // 10, oy), (ox + k * T // 10, oy + T)], fill=c)
            d.line([(ox, oy + k * T // 10), (ox + T, oy + k * T // 10)], fill=c)
            d.text((ox + k * T // 10 + 2, oy + 2), str(k), fill=(0, 100, 220), font=font)
            d.text((ox + 2, oy + k * T // 10 + 2), str(k), fill=(0, 100, 220), font=font)
        for e in M.get(n, []):  # [cx, cy, rx, ry, angle_deg] in crop fractions
            cx, cy, rx, ry = e[:4]
            d.ellipse([ox + (cx - rx) * T, oy + (cy - ry) * T, ox + (cx + rx) * T, oy + (cy + ry) * T], outline="red", width=3)
        d.text((ox + 30, oy + T - 22), n, fill="red", font=font)
        d.rectangle([ox, oy, ox + T - 1, oy + T - 1], outline="black")
    sh.save(os.path.join(SCR, f"lock_grid_{b // 6}.jpg"), quality=88)
