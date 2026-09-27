"""Dragon Ball-style aura behind a character (prototype, 2026-09-27).
The matte's silhouette is grown, its edge torn upward into flame tongues with
noise, filled with a hot-core gradient, glowed, and placed BEHIND the figure.
Usage: aura.py <image.png> <matte_rgba.png> <out.png> <r,g,b core> <r,g,b edge> [height]"""
import math
import random
import sys
import numpy as np
from PIL import Image, ImageFilter

img = Image.open(sys.argv[1]).convert("RGBA")
matte = Image.open(sys.argv[2]).convert("RGBA").split()[-1]
out_p = sys.argv[3]
core = tuple(int(v) for v in sys.argv[4].split(","))
edge = tuple(int(v) for v in sys.argv[5].split(","))
height = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0
W, H = img.size
rnd = random.Random(3)

m = np.array(matte, dtype=np.float32) / 255.0
m = (m > 0.4).astype(np.float32)


def grow(a, r):
    return np.array(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(r)), dtype=np.float32) / 255


# Flames rise: shift the silhouette upward in several jittered copies and keep
# the union, so the top edge stretches into tongues and the bottom barely moves.
body = grow(m, 21)
flame = body.copy()
ys, xs = np.mgrid[0:H, 0:W]
for k in range(10):
    amp = (18 + k * 9) * height
    freq = rnd.uniform(0.018, 0.04)
    phase = rnd.uniform(0, 6.28)
    # column-wise upward displacement, strongest where waves peak -> tongues
    disp = (np.maximum(0, np.sin(xs[0] * freq + phase)) ** 3 * amp).astype(int)
    shifted = np.zeros_like(body)
    for x in range(W):
        d = disp[x]
        if d:
            shifted[:-d, x] = body[d:, x]
        else:
            shifted[:, x] = body[:, x]
    flame = np.maximum(flame, shifted)

outer = np.array(Image.fromarray((flame * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)), dtype=np.float32) / 255
inner = grow(m, 9)
inner = np.array(Image.fromarray((inner * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(8)), dtype=np.float32) / 255

layer = np.zeros((H, W, 4), dtype=np.float32)
for c in range(3):
    layer[..., c] = edge[c] * (1 - inner) + core[c] * inner
layer[..., 3] = np.clip(outer * 235, 0, 255)
aura = Image.fromarray(layer.astype(np.uint8), "RGBA")
glow = aura.filter(ImageFilter.GaussianBlur(14))

cut = img.copy()
cut.putalpha(matte)
bg = img.copy()
bg.alpha_composite(glow)
bg.alpha_composite(aura)
bg.alpha_composite(cut)  # the figure goes back on top: the aura is behind her
bg.convert("RGB").save(out_p)
print("aura drawn", out_p)
