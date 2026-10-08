"""lock_masks.json (ellipses in head-crop fractions, see lock_grid.py) -> full-size feathered mask PNGs in lock_masks_png/."""
import json
import os

from PIL import Image, ImageDraw, ImageFilter

SCR = os.path.dirname(os.path.abspath(__file__))
DS = r"C:\Users\Tanve\.comfyui-mcp\training\datasets\duke_v1"
F = json.load(open(os.path.join(SCR, "ds_faces.json")))
M = json.load(open(os.path.join(SCR, "lock_masks.json")))
OUT = os.path.join(SCR, "lock_masks_png")
os.makedirs(OUT, exist_ok=True)
for n, es in M.items():
    size = Image.open(os.path.join(DS, n)).size
    x0, y0, x1, y1 = F[n]
    w = x1 - x0
    bx0, by0, bx1, by1 = x0 - 0.75 * w, y0 - 0.6 * w, x1 + 0.75 * w, y1 + 0.9 * w
    cw, ch = bx1 - bx0, by1 - by0
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    for cx, cy, rx, ry in es:
        rx, ry = rx * 1.25, ry * 1.15  # pad: a lock left half-erased is worse than a slightly larger repaint
        d.ellipse([bx0 + (cx - rx) * cw, by0 + (cy - ry) * ch, bx0 + (cx + rx) * cw, by0 + (cy + ry) * ch], fill=255)
    m.filter(ImageFilter.GaussianBlur(max(3, w // 50))).save(os.path.join(OUT, n))
print(len(M), "masks")
