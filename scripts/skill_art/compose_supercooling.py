"""Supercooling (Lyra's passive) - layered art on his pick Q07, after the finish pass (scripts/skill_art/finish_pass.py).

Layers, back to front: background -> her cut-out -> frost (floating red-ice shards, sparkle, cold mist at her
feet). No aura: one aura per character, "not always and not everywhere at once". No bow: a slung bow needs a
strap and he chose to drop it (2026-09-27); --bow restores the strapless layer for experiments only.
He picked background `keep`. The three options:
  keep   - Q07's own rendered background (red with ice shards)
  night  - the drawn violet night of Latent Heat, for a matched kit
  crimson- a drawn deep crimson to black, colder and plainer

Usage: compose_supercooling.py <finished.png> <matte_rgba.png> <out_dir> [bg ...] [--bow]
Writes <out_dir>/supercooling_<bg>.png at the finished size and <bg>_832.png at the kit-art size (832x1216).
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
BOW = os.path.join(ROOT, "public", "props", "lyra_bow.png")
INK = (20, 16, 14)
ICE = (196, 30, 44)
ICE_LIGHT = (255, 120, 120)
FROST = (255, 214, 222)


def gradient(w, h, top, bottom, bloom=None, centre=(0.5, 0.4)):
    img = Image.new("RGB", (w, h))
    px = img.load()
    cx, cy, r = w * centre[0], h * centre[1], h * 0.55
    for y in range(h):
        t = y / (h - 1)
        base = [top[c] + (bottom[c] - top[c]) * t for c in range(3)]
        for x in range(0, w):
            k = max(0.0, 1 - math.hypot(x - cx, y - cy) / r) ** 2 * 0.5 if bloom else 0
            px[x, y] = tuple(int(base[c] + ((bloom[c] if bloom else 0) - base[c]) * k) for c in range(3))
    return img.convert("RGBA")


def background(kind, src):
    w, h = src.size
    if kind == "keep":
        return src.convert("RGBA")
    if kind == "night":  # the Latent Heat sky, same tokens as compose_latent_heat.py
        return gradient(w, h, (10, 6, 24), (52, 14, 58), (140, 28, 72))
    if kind == "crimson":
        return gradient(w, h, (40, 4, 10), (8, 2, 6), (120, 14, 30))
    raise SystemExit(f"unknown background {kind}")


def slung_bow(w, h):
    """The locked drawn bow (public/props/lyra_bow.png), strung, across her back: top limb over her left
    shoulder (viewer's right), bottom limb out past her right hip. Only the parts outside her silhouette show."""
    bow = Image.open(BOW).convert("RGBA").crop((341, 156, 479, 1064))
    scale = h * 0.62 / bow.height
    bow = bow.resize((int(bow.width * scale), int(bow.height * scale)), Image.LANCZOS)
    bow = bow.rotate(-38, expand=True, resample=Image.BICUBIC)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    layer.alpha_composite(bow, (int(w * 0.5 - bow.width / 2), int(h * 0.36 - bow.height / 2)))
    return layer


def shard(d, x, y, ang, s):
    ux, uy = math.cos(ang), math.sin(ang)
    nx, ny = -uy, ux
    pts = [(x + ux * 40 * s, y + uy * 40 * s), (x + nx * 11 * s, y + ny * 11 * s),
           (x - ux * 22 * s, y - uy * 22 * s), (x - nx * 11 * s, y - ny * 11 * s)]
    d.polygon(pts, fill=ICE, outline=INK)
    d.polygon([pts[0], (x + nx * 4 * s, y + ny * 4 * s), (x - ux * 6 * s, y - uy * 6 * s)], fill=ICE_LIGHT)


def frost(w, h, matte, seed=5):
    """Red-ice shards drifting around (not over) her, glints, and a low cold mist."""
    rnd = random.Random(seed)
    fig = matte.filter(ImageFilter.MaxFilter(41)).load()
    shards = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(shards)
    placed = 0
    while placed < 26:
        x, y = rnd.uniform(0.03, 0.97) * w, rnd.uniform(0.05, 0.92) * h
        if fig[int(x), int(y)] > 20:
            continue
        shard(d, x, y, rnd.uniform(0, 2 * math.pi), rnd.uniform(0.5, 1.5) * w / 832)
        placed += 1
    glow = Image.new("RGBA", (w, h), (255, 70, 90, 0))
    glow.putalpha(shards.split()[3].filter(ImageFilter.GaussianBlur(9)).point(lambda v: int(v * 0.6)))
    glints = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    g = ImageDraw.Draw(glints)
    for _ in range(90):
        x, y, r = rnd.uniform(0, w), rnd.uniform(0, h), rnd.uniform(1, 3.2) * w / 832
        g.ellipse((x - r, y - r, x + r, y + r), fill=FROST + (rnd.randint(120, 230),))
    mist = Image.new("RGBA", (w, h), FROST + (0,))
    m = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(m)
    for _ in range(14):
        cx, cy = rnd.uniform(-0.1, 1.1) * w, rnd.uniform(0.86, 1.02) * h
        rx, ry = rnd.uniform(0.15, 0.3) * w, rnd.uniform(0.03, 0.06) * h
        md.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=rnd.randint(40, 90))
    mist.putalpha(m.filter(ImageFilter.GaussianBlur(24)))
    return glow, shards, glints, mist


# Holes in the matte that are HER, as (x, y) fractions of the frame. On a red-on-red render (her crimson top
# against Q07's red ground) BiRefNet leaves her top see-through, and the bow showed through her chest
# (composite v1). Filling every enclosed hole (v2) also filled the gaps inside her ponytail loops, which are
# background, so the fill is named per image: Q07's chest hole is centred at (0.60, 0.38).
FILL_HOLES = [(0.60, 0.38)]


def solid_matte(alpha, fill=FILL_HOLES):
    """Keep only her main silhouette (drops islands such as ghost shards from the rendered background) and
    fill the named holes solid; the soft outer edge is kept."""
    from scipy import ndimage
    a = np.array(alpha)
    h, w = a.shape
    body, n = ndimage.label(a >= 40)
    keep = 1 + int(np.argmax(ndimage.sum(a >= 40, body, range(1, n + 1))))
    a = np.where(body == keep, a, 0)
    holes, _ = ndimage.label(a < 128)
    for fx, fy in fill:
        idx = holes[int(fy * h), int(fx * w)]
        edge = np.r_[holes[0], holes[-1], holes[:, 0], holes[:, -1]]
        assert idx and idx not in edge, f"({fx}, {fy}) is not an enclosed hole"
        a = np.where(holes == idx, 255, a)
    return Image.fromarray(a.astype(np.uint8))


def main():
    src_p, matte_p, out_dir = sys.argv[1:4]
    # No bow by default: his call 2026-09-27, "Just lose the bow". The slung bow floated with nothing holding
    # it ("Physics where mate?"). --bow brings it back only for a version that also draws a strap.
    no_bow = "--bow" not in sys.argv
    kinds = [a for a in sys.argv[4:] if not a.startswith("--")] or ["keep", "night", "crimson"]
    src = Image.open(src_p).convert("RGB")
    w, h = src.size
    matte = solid_matte(Image.open(matte_p).convert("RGBA").split()[3])
    fig = src.convert("RGBA")
    fig.putalpha(matte)
    bow = slung_bow(w, h)
    glow, shards, glints, mist = frost(w, h, matte)
    os.makedirs(out_dir, exist_ok=True)
    for kind in kinds:
        img = background(kind, src)
        for layer in (glow, shards, fig, glints, mist) if no_bow else (glow, shards, bow, fig, glints, mist):
            img.alpha_composite(layer)
        out = os.path.join(out_dir, f"supercooling_{kind}.png")
        img.convert("RGB").save(out)
        img.convert("RGB").resize((832, 1216), Image.LANCZOS).save(out.replace(".png", "_832.png"))
        print("wrote", out)


if __name__ == "__main__":
    main()
