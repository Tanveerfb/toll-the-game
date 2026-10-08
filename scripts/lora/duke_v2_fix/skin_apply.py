"""Apply his skin pick (A, the set's own pale average, 2026-10-08) to every image in datasets/duke_v2. Backups in
datasets/duke_v2_preskin. Writes a full-set contact sheet."""
import glob
import os
import shutil
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from skin_options import TARGETS, shift  # noqa: E402

V2 = r"C:\Users\Tanve\.comfyui-mcp\training\datasets\duke_v2"
BK = r"C:\Users\Tanve\.comfyui-mcp\training\datasets\duke_v2_preskin"
os.makedirs(BK, exist_ok=True)
fs = sorted(glob.glob(os.path.join(V2, "*.png")))
for f in fs:
    b = os.path.join(BK, os.path.basename(f))
    if not os.path.exists(b):
        shutil.copyfile(f, b)
    a = np.array(Image.open(b).convert("RGB")).astype(np.float32)
    Image.fromarray(shift(a, TARGETS["A"]).astype(np.uint8)).save(f)
T = 260
sheet = Image.new("RGB", (5 * T, 4 * T), "white")
for i, f in enumerate(fs):
    im = Image.open(f).convert("RGB")
    im.thumbnail((T, T))
    sheet.paste(im, ((i % 5) * T, (i // 5) * T))
sheet.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "skin_applied.jpg"), quality=85)
print(len(fs), "evened")
