"""Sara's kit and card art: layered composites on his finished picks (2026-10-03).

Layers, back to front: background -> aura -> motion effects -> afterimages -> her cut-out -> front effects.
- Background: ONLY attack-class skill art gets the red class background (draw_class_bg.py, radial speed
  lines converging on her action). His rule, 2026-10-03: "only skill arts only needed with red bg (attack
  skills) Passive and ultimate not." The ultimate picks its own (#161): a violet night, so the pink aura
  reads. The passive must NOT get red (v1 here gave it a red gradient; that was wrong). The card uses her
  element red as a plain gradient - he locked Card B with it.
- Aura: hot pink with hints of red (his pick, 2026-10-03) - a soft glow grown out of her own silhouette.
  One aura per character, and not on every piece at full strength.
- Skill 2 (AoE): afterimages - fading copies of her cut-out trailing back along her path - plus streaks.
Nothing here is generated; every layer is drawn from her matte, so a rerun is exact.

Usage: compose_sara.py <piece> <finished.png> <matte_rgba.png> <out_dir>
  piece: card | passive | skill1 | skill2 | ult
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from draw_class_bg import class_colours, draw as class_bg  # noqa: E402

PINK = (255, 46, 136)       # hot pink core
PINK_LIGHT = (255, 150, 200)
AURA_RED = (230, 30, 60)    # the "hints of red" at the aura's outer edge
ELEMENT_RED = (255, 90, 78)  # --color-el-red

# Per piece: aura strength (0 = none), afterimage count, where the motion comes FROM (unit vector,
# image coords) for trails, and the background focal point.
PIECES = {
    "card":    {"aura": 0.0, "after": 0, "focus": (0.5, 0.35)},
    "passive": {"aura": 0.45, "after": 0, "focus": (0.5, 0.35)},
    "skill1":  {"aura": 0.30, "after": 0, "focus": (0.55, 0.45), "streak": True},
    # "scale" < 1 shrinks her so a trail fits in frame - but only for a figure the draft did not crop:
    # on Sara's frame-cropped sprints it exposed the cut limb edges mid-frame (check pass, 2026-10-03).
    "skill2":  {"aura": 0.55, "after": 3, "focus": (0.5, 0.45), "streak": True},
    "ult":     {"aura": 1.0, "after": 0, "focus": (0.5, 0.42), "burst": True},
}


def clean_matte(alpha):
    """Her main silhouette only: drops islands the matte keeps from a rendered background."""
    a = np.array(alpha)
    lab, n = ndimage.label(a >= 40)
    if n > 1:
        keep = 1 + int(np.argmax(ndimage.sum(a >= 40, lab, range(1, n + 1))))
        grown = ndimage.binary_dilation(lab == keep, iterations=6)
        a = np.where(grown, a, 0)
    return Image.fromarray(a.astype(np.uint8))


def gradient(w, h, top, bottom, bloom=None, centre=(0.5, 0.4), r=0.6):
    y = np.linspace(0, 1, h)[:, None, None]
    img = np.array(top) * (1 - y) + np.array(bottom) * y
    img = np.broadcast_to(img, (h, w, 3)).copy()
    if bloom:
        yy, xx = np.mgrid[0:h, 0:w]
        k = np.clip(1 - np.hypot(xx - centre[0] * w, yy - centre[1] * h) / (r * h), 0, 1) ** 2
        img = img * (1 - k[..., None] * 0.6) + np.array(bloom) * k[..., None] * 0.6
    return Image.fromarray(img.clip(0, 255).astype(np.uint8))


def background(piece, w, h, focus):
    if piece in ("skill1", "skill2"):
        bg = class_bg(class_colours()["attack"], *focus)
        return bg.convert("RGB").resize((w, h), Image.LANCZOS)
    if piece == "ult":  # violet night, pink bloom behind her (ruling #161: the ultimate picks its colour)
        return gradient(w, h, (18, 10, 44), (52, 18, 70), bloom=(120, 30, 110), centre=focus)
    if piece == "passive":  # never red (his rule); a neutral dusk until he names one
        return gradient(w, h, (28, 22, 40), (70, 52, 78), bloom=(150, 90, 130), centre=focus, r=0.5)
    return gradient(w, h, (60, 8, 16), (140, 22, 34), bloom=ELEMENT_RED, centre=focus, r=0.5)


def aura(matte, strength):
    """Pink core hugging her outline, fading to red further out. Drawn behind her, so only the
    part outside her silhouette shows."""
    w, h = matte.size
    s = max(w, h)
    rgba = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    # No tight light rim: v1 had one at 0.008 and it read as a sticker outline, not a glow (check pass,
    # 2026-10-03). Broad red falloff, pink body, soft pink near the edge.
    for rad, col, a in ((0.09, AURA_RED, 0.5), (0.05, PINK, 0.7), (0.025, PINK, 0.55)):
        m = matte.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(s * rad))
        m = m.point(lambda v, a=a: int(min(255, v * 1.6) * a * strength))
        layer = Image.new("RGBA", (w, h), col + (0,))
        layer.putalpha(m)
        rgba.alpha_composite(layer)
    return rgba


def streaks(w, h, matte, direction, seed=3, n=46):
    """Speed streaks trailing behind her, coloured light pink, starting at her silhouette."""
    rnd = random.Random(seed)
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    ys, xs = np.nonzero(np.array(matte) > 128)
    dx, dy = direction
    for _ in range(n):
        i = rnd.randrange(len(xs))
        x, y = xs[i], ys[i]
        length = rnd.uniform(0.15, 0.45) * h
        width = rnd.uniform(2.5, 7) * (w / 832)
        col = rnd.choice([(255, 255, 255), (255, 255, 255), PINK_LIGHT, PINK])
        d.line([(x, y), (x + dx * length, y + dy * length)], fill=col + (rnd.randint(150, 235),), width=int(width))
    return lay.filter(ImageFilter.GaussianBlur(w / 832 * 0.8))


def afterimages(fig, matte, direction, count):
    """Fading pink-tinted copies of her trailing back along `direction` (where she came from)."""
    w, h = fig.size
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    tint = Image.new("RGBA", (w, h), PINK + (255,))
    for k in range(count, 0, -1):
        off = (int(direction[0] * k * w * 0.16), int(direction[1] * k * h * 0.11))
        ghost = Image.blend(fig.convert("RGBA"), tint, 0.45)
        a = matte.point(lambda v, k=k: int(v * (0.78 - 0.18 * k)))
        ghost.putalpha(a)
        lay.alpha_composite(ghost, off)
    return lay.filter(ImageFilter.GaussianBlur(w / 832 * 1.5))


def burst(w, h, focus, seed=7):
    """Pink-white impact rays radiating from behind her (the ultimate's flare)."""
    rnd = random.Random(seed)
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    cx, cy = focus[0] * w, focus[1] * h
    far = math.hypot(w, h)
    for _ in range(60):
        a = rnd.uniform(0, 2 * math.pi)
        sp = rnd.uniform(0.004, 0.02)
        inner = rnd.uniform(0.05, 0.2) * far
        col = rnd.choice([PINK_LIGHT, PINK, (255, 255, 255)])
        d.polygon([(cx + math.cos(a) * inner, cy + math.sin(a) * inner),
                   (cx + math.cos(a - sp) * far, cy + math.sin(a - sp) * far),
                   (cx + math.cos(a + sp) * far, cy + math.sin(a + sp) * far)], fill=col + (rnd.randint(60, 150),))
    return lay.filter(ImageFilter.GaussianBlur(w / 832 * 1.2))


def compose(piece, src_p, matte_p, out_dir, direction=(-1.0, 0.15)):
    cfg = PIECES[piece]
    src = Image.open(src_p).convert("RGB")
    w, h = src.size
    matte = clean_matte(Image.open(matte_p).convert("RGBA").split()[3].resize((w, h)))
    fig = src.convert("RGBA")
    fig.putalpha(matte)
    if cfg.get("scale"):  # shrink her and push her away from the trail, so the trail has room
        s = cfg["scale"]
        sw, sh = int(w * s), int(h * s)
        ox = int((w - sw) * (0.5 - direction[0] * 0.5))
        oy = int((h - sh) * (0.5 - direction[1] * 0.5))
        small_fig = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        small_fig.paste(fig.resize((sw, sh), Image.LANCZOS), (ox, oy))
        fig = small_fig
        matte = fig.split()[3]
    img = background(piece, w, h, cfg["focus"]).convert("RGBA")
    if cfg.get("burst"):
        img.alpha_composite(burst(w, h, cfg["focus"]))
    if cfg["aura"]:
        img.alpha_composite(aura(matte, cfg["aura"]))
    if cfg.get("streak"):
        img.alpha_composite(streaks(w, h, matte, direction))
    if cfg["after"]:
        img.alpha_composite(afterimages(fig, matte, direction, cfg["after"]))
    img.alpha_composite(fig)
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"sara_{piece}.png")
    img.convert("RGB").save(out)
    small = (1024, 1024) if w == h else (832, 1216)
    img.convert("RGB").resize(small, Image.LANCZOS).save(out.replace(".png", f"_{small[0]}.png"))
    return out


if __name__ == "__main__":
    a = sys.argv[1:]
    direction = tuple(float(v) for v in a[4:6]) if len(a) >= 6 else (-1.0, 0.15)
    print(compose(a[0], a[1], a[2], a[3], direction))
