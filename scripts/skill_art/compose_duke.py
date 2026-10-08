"""Duke's kit art: layered composites on his official picks (2026-10-08). Modelled on compose_sara.py.

Layers, back to front: background -> glow/aura -> motion effects -> afterimages -> his cut-out -> front effects.
- Surge and Slide are attack skills, so they get the red class background (his rule, 2026-10-03: only attack skills get it).
- The ultimate (ruling #184, 2026-10-08): a scenic plate (snowy mountains), water droplets of varying size scattered
  through it, and a thin light-blue aura on the hands only. His pose direction (2026-10-07): "similar pose to how Garou
  uses fist of flowing water crushed rock, with the aura covering his hands only".
- Surge is a power-up: a restrained white-blue glow off his silhouette and rising streaks. Water is not part of his base design
  (and no signature effect is forced into every piece), so it stays pale.
- Slide hits all enemies: three fading afterimages trail back along the kick, plus streaks.
Nothing here is generated; every layer is drawn from his matte, so a rerun is exact.

Usage: compose_duke.py <surge|slide|ult> <finished.png> <matte_rgba.png> <out_dir>
         [--bg=<plate.png>] (required for ult) [--hands=x,y,r;x,y,r] [--dir=dx,dy] [--recolour]
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from draw_class_bg import class_colours, draw as class_bg  # noqa: E402

WATER = (58, 158, 255)
WATER_LIGHT = (188, 228, 255)
WATER_DEEP = (20, 80, 200)

# Lead and rear hand of the ultimate, in the 1248x1824 finished image: (x, y, radius), read off a labelled grid.
ULT_HANDS = [(335, 665, 175), (1040, 905, 105)]

PIECES = {
    "surge": {"aura": 0.85, "after": 0, "focus": (0.5, 0.30), "sparks": True},
    "slide": {"aura": 0.0, "after": 3, "focus": (0.62, 0.40), "streak": True},
    "ult": {"aura": 0.0, "after": 0, "focus": (0.45, 0.42), "hands": True, "droplets": True},
}
# Ruling #184 (2026-10-08): an ultimate is a scenic backdrop with the unit's toll-power elements scattered through it.
# For Duke: snowy mountains, water droplets of varying size, a thin light-blue aura on the hands only. The backdrop is
# a rendered plate passed as --bg=; the violet gradient + ray burst it replaced is gone.


def clean_matte(alpha):
    """His main silhouette only, with the inside made solid (a dark garment on a pale ground matte comes out semi-transparent)."""
    a = np.array(alpha)
    lab, n = ndimage.label(a >= 40)
    if n > 1:
        keep = 1 + int(np.argmax(ndimage.sum(a >= 40, lab, range(1, n + 1))))
        grown = ndimage.binary_dilation(lab == keep, iterations=6)
        a = np.where(grown, a, 0)
    solid = ndimage.binary_fill_holes(a >= 128)
    inner = ndimage.binary_erosion(solid, iterations=3)
    a = np.where(inner, 255, a)
    return Image.fromarray(a.astype(np.uint8))


def recolour_trousers(img):
    """Pale grey or purple-grey trousers to the locked charcoal. Pixels below the belt line that are low-saturation and
    mid-light, and not skin; lineart (dark) and the boots (near black) are left alone."""
    a = np.array(img.convert("RGB")).astype(np.int32)
    h = a.shape[0]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = (0.3 * r + 0.59 * g + 0.11 * b)
    skin = (r > b + 28) & (r > g + 8)
    pale = (lum > 85) & (lum < 215) & (np.abs(r - b) < 45) & (~skin)
    pale[: int(h * 0.50)] = False
    pale &= ~((b > r + 60))  # the blue wristbands are never below the belt line, but keep the guard
    v = lum * 0.22 + 6
    out = a.copy()
    for c, off in ((0, 0), (1, 1), (2, 5)):
        out[..., c] = np.where(pale, np.clip(v + off, 0, 255), a[..., c])
    return Image.fromarray(out.astype(np.uint8))


def background(piece, w, h, focus, backdrop=None):
    if piece in ("surge", "slide"):
        bg = class_bg(class_colours()["attack"], *focus)
        return bg.convert("RGB").resize((w, h), Image.LANCZOS)
    if backdrop is None:
        raise SystemExit("the ultimate needs its scenic backdrop plate (ruling #184): pass it as the 5th argument")
    plate = Image.open(backdrop).convert("RGB")
    s = max(w / plate.width, h / plate.height)
    plate = plate.resize((math.ceil(plate.width * s), math.ceil(plate.height * s)), Image.LANCZOS)
    plate = plate.crop(((plate.width - w) // 2, (plate.height - h) // 2, (plate.width - w) // 2 + w, (plate.height - h) // 2 + h))
    # lightly blurred and pushed back (darker, cooler) so he reads in front of it, as on Sara's card
    plate = plate.filter(ImageFilter.GaussianBlur(w / 832 * 2.2))
    a = np.array(plate).astype(np.float32) * 0.66 + np.array((6, 14, 34), np.float32)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def droplets(w, h, matte, seed=13, n=70):
    """Duke's toll power scattered through the scene: water droplets of varying size. Small ones are sharp and far,
    large ones are soft and near (depth of field). None sit on his body."""
    rnd = random.Random(seed)
    body = ndimage.binary_dilation(np.array(matte) > 60, iterations=int(w * 0.01))
    far = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    near = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    k = w / 832
    placed = 0
    while placed < n:
        x, y = rnd.uniform(0, w), rnd.uniform(0, h)
        if body[int(min(y, h - 1)), int(min(x, w - 1))]:
            continue
        r = k * (rnd.uniform(2, 6) if rnd.random() < 0.7 else rnd.uniform(9, 26))
        lay = near if r > 8 * k else far
        # a teardrop (round body, point trailing up-and-back), not a sphere: spheres read as bubbles
        tilt = math.radians(rnd.uniform(-35, 35))
        pts = []
        for t in range(0, 360, 10):
            a = math.radians(t)
            rr = r * (1 + 1.5 * max(0.0, -math.sin(a)) ** 6)  # stretch the top into a point
            px, py = math.cos(a) * r * (1 - 0.55 * max(0.0, -math.sin(a)) ** 2), math.sin(a) * rr
            pts.append((x + px * math.cos(tilt) - py * math.sin(tilt), y + px * math.sin(tilt) + py * math.cos(tilt)))
        d = ImageDraw.Draw(lay)
        d.polygon(pts, fill=WATER + (165,), outline=WATER_LIGHT + (235,), width=max(1, int(r * 0.16)))
        hr = r * 0.28
        d.ellipse([x - r * 0.4 - hr, y + r * 0.05 - hr, x - r * 0.4 + hr, y + r * 0.05 + hr], fill=(255, 255, 255, 235))
        placed += 1
    far = far.filter(ImageFilter.GaussianBlur(k * 0.6))
    near = near.filter(ImageFilter.GaussianBlur(k * 2.5))
    far.alpha_composite(near)
    return far


def hand_aura(w, h, hands, matte):
    """A thin light-blue water aura on the hands only (ruling #184): his silhouette inside each hand circle, grown a
    little and softened, drawn behind him so it rims the hand. Returns (behind, front_rim)."""
    region = Image.new("L", (w, h), 0)
    rd = ImageDraw.Draw(region)
    for cx, cy, r in hands:
        rd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    region = region.filter(ImageFilter.GaussianBlur(w / 832 * 12))
    hand = Image.fromarray((np.array(matte).astype(np.float32) * np.array(region) / 255).astype(np.uint8))
    behind = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for grow, blur, col, a in ((9, 14, WATER, 0.85), (4, 5, WATER_LIGHT, 0.9)):
        m = hand.filter(ImageFilter.MaxFilter(int(w / 832 * grow) * 2 + 1)).filter(ImageFilter.GaussianBlur(w / 832 * blur))
        lay = Image.new("RGBA", (w, h), col + (0,))
        lay.putalpha(m.point(lambda v, a=a: int(min(255, v * 1.4) * a)))
        behind.alpha_composite(lay)
    # a faint front sheen so the aura sits ON the hand, not only behind it
    sheen = Image.new("RGBA", (w, h), WATER_LIGHT + (0,))
    sheen.putalpha(hand.filter(ImageFilter.GaussianBlur(w / 832 * 3)).point(lambda v: int(v * 0.22)))
    return behind, sheen


def glow(matte, strength):
    """Pale water-blue glow grown from his silhouette, drawn behind him."""
    w, h = matte.size
    s = max(w, h)
    rgba = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for rad, col, a in ((0.08, WATER_DEEP, 0.45), (0.045, WATER, 0.6), (0.022, WATER_LIGHT, 0.5)):
        m = matte.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(s * rad))
        m = m.point(lambda v, a=a: int(min(255, v * 1.6) * a * strength))
        layer = Image.new("RGBA", (w, h), col + (0,))
        layer.putalpha(m)
        rgba.alpha_composite(layer)
    return rgba


def streaks(w, h, matte, direction, seed=3, n=46, up=False):
    """Streaks starting on his silhouette and trailing along `direction`; white and water-light."""
    rnd = random.Random(seed)
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    ys, xs = np.nonzero(np.array(matte) > 128)
    dx, dy = direction
    for _ in range(n):
        i = rnd.randrange(len(xs))
        x, y = xs[i], ys[i]
        length = rnd.uniform(0.12, 0.40) * h
        width = rnd.uniform(2.5, 7) * (w / 832)
        col = rnd.choice([(255, 255, 255), (255, 255, 255), WATER_LIGHT, WATER])
        d.line([(x, y), (x + dx * length, y + dy * length)], fill=col + (rnd.randint(140, 225),), width=int(width))
    return lay.filter(ImageFilter.GaussianBlur(w / 832 * 0.8))


def sparks(w, h, matte, seed=5, n=34):
    """Soft water-light motes rising off his silhouette: the power-up, without bars or lines."""
    rnd = random.Random(seed)
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    ys, xs = np.nonzero(np.array(matte) > 128)
    for _ in range(n):
        i = rnd.randrange(len(xs))
        x, y = xs[i] + rnd.uniform(-0.04, 0.04) * w, ys[i] - rnd.uniform(0.02, 0.28) * h
        r = rnd.uniform(2.5, 8) * (w / 832)
        d.ellipse([x - r, y - r, x + r, y + r], fill=rnd.choice([WATER_LIGHT, (255, 255, 255)]) + (rnd.randint(130, 230),))
    return lay.filter(ImageFilter.GaussianBlur(w / 832 * 1.4))


def afterimages(fig, matte, direction, count):
    """Fading water-tinted copies of him trailing back along `direction`."""
    w, h = fig.size
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    tint = Image.new("RGBA", (w, h), WATER + (255,))
    for k in range(count, 0, -1):
        off = (int(direction[0] * k * w * 0.12), int(direction[1] * k * h * 0.07))
        ghost = Image.blend(fig.convert("RGBA"), tint, 0.5)
        ghost.putalpha(matte.point(lambda v, k=k: int(v * (0.72 - 0.18 * k))))
        lay.alpha_composite(ghost, off)
    return lay.filter(ImageFilter.GaussianBlur(w / 832 * 1.5))


def compose(piece, src_p, matte_p, out_dir, direction=(-1.0, 0.12), backdrop=None, hands=None, recolour=False):
    cfg = PIECES[piece]
    src = Image.open(src_p).convert("RGB")
    if recolour:
        src = recolour_trousers(src)
    w, h = src.size
    matte = clean_matte(Image.open(matte_p).convert("RGBA").split()[3].resize((w, h)))
    fig = src.convert("RGBA")
    fig.putalpha(matte)
    img = background(piece, w, h, cfg["focus"], backdrop).convert("RGBA")
    if cfg.get("droplets"):
        img.alpha_composite(droplets(w, h, matte))
    front = None
    if cfg.get("hands"):
        behind, front = hand_aura(w, h, hands or ULT_HANDS, matte)
        img.alpha_composite(behind)
    if cfg["aura"]:
        img.alpha_composite(glow(matte, cfg["aura"]))
    if cfg.get("sparks"):
        img.alpha_composite(sparks(w, h, matte))
    if cfg.get("streak"):
        img.alpha_composite(streaks(w, h, matte, direction))
    if cfg["after"]:
        img.alpha_composite(afterimages(fig, matte, direction, cfg["after"]))
    img.alpha_composite(fig)
    if front is not None:
        img.alpha_composite(front)
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"duke_{piece}.png")
    img.convert("RGB").save(out)
    img.convert("RGB").resize((832, 1216), Image.LANCZOS).save(out.replace(".png", "_832.png"))
    return out


if __name__ == "__main__":
    a = [v for v in sys.argv[1:] if not v.startswith("--")]
    opts = dict(v[2:].split("=", 1) for v in sys.argv[1:] if v.startswith("--") and "=" in v)
    direction = tuple(float(v) for v in opts["dir"].split(",")) if "dir" in opts else (-1.0, 0.12)
    hands = [tuple(int(n) for n in t.split(",")) for t in opts["hands"].split(";")] if "hands" in opts else None
    print(compose(a[0], a[1], a[2], a[3], direction, opts.get("bg"), hands, "--recolour" in sys.argv))
