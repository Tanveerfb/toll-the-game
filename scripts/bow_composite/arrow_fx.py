"""Red-ice effect along a composited arrow (Flash Point samples, 2026-09-27).
The bow is locked; this draws a separate EFFECT layer over the composite.
Usage: arrow_fx.py <composite.png> <out_prefix> <gx> <gy> <nx> <ny> [scale] [tilt]
Writes <out_prefix>_a/_b/_c.png: a = glow along the shaft, b = ice shards
crystallising along it, c = glow plus speed streaks ahead of the head."""
import math
import random
import sys
sys.path.insert(0, r"E:\Projects\toll-the-game\scripts")
from PIL import Image, ImageDraw, ImageFilter
import draw_lyra_bow as bow

src, prefix = sys.argv[1], sys.argv[2]
gx, gy, nx, ny = (float(v) for v in sys.argv[3:7])
scale = float(sys.argv[7]) if len(sys.argv) > 7 else 0.88
tilt = math.radians(float(sys.argv[8]) if len(sys.argv) > 8 else 0.0)


def to_img(p):
    """bow-local -> image, the same transform bow_composite.py applies."""
    dx, dy = (p[0] - bow.GRIP[0]) * scale, (p[1] - bow.GRIP[1]) * scale
    return (gx + dx * math.cos(tilt) + dy * math.sin(tilt),
            gy - dx * math.sin(tilt) + dy * math.cos(tilt))


shelf = to_img(bow.SHELF)
nock = (nx, ny)
ux, uy = shelf[0] - nock[0], shelf[1] - nock[1]
L = math.hypot(ux, uy)
ux, uy = ux / L, uy / L
head = (shelf[0] + ux * 95 * scale, shelf[1] + uy * 95 * scale)
base = Image.open(src).convert("RGBA")
W, H = base.size
CRIMSON, HOT, PALE = (230, 30, 50), (255, 90, 90), (255, 200, 205)


def glow_layer(draw_fn, blur):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(lay))
    glow = lay.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(glow)
    out.alpha_composite(lay)
    return out


def shaft_glow(d):
    d.line([nock, head], fill=CRIMSON + (150,), width=12)
    d.line([nock, head], fill=HOT + (200,), width=5)
    r = 26
    d.ellipse([head[0] - r, head[1] - r, head[0] + r, head[1] + r], fill=HOT + (170,))
    d.ellipse([head[0] - 9, head[1] - 9, head[0] + 9, head[1] + 9], fill=PALE + (255,))


def shards(d):
    rnd = random.Random(7)
    px, py = -uy, ux
    for i in range(16):
        t = rnd.uniform(0.15, 1.05)
        cx = nock[0] + (head[0] - nock[0]) * t
        cy = nock[1] + (head[1] - nock[1]) * t
        off = rnd.uniform(-22, 22)
        cx, cy = cx + px * off, cy + py * off
        s = rnd.uniform(7, 16) * (0.6 + t)
        a = rnd.uniform(0, math.pi)
        pts = [(cx + math.cos(a) * s * 1.8, cy + math.sin(a) * s * 1.8),
               (cx + math.cos(a + 1.9) * s * 0.6, cy + math.sin(a + 1.9) * s * 0.6),
               (cx - math.cos(a) * s * 1.2, cy - math.sin(a) * s * 1.2),
               (cx + math.cos(a - 1.9) * s * 0.6, cy + math.sin(a - 1.9) * s * 0.6)]
        d.polygon(pts, fill=CRIMSON + (235,), outline=(40, 8, 12, 255))
        d.polygon(pts[:3], fill=HOT + (200,))


def streaks(d):
    shaft_glow(d)
    rnd = random.Random(11)
    px, py = -uy, ux
    for _ in range(9):
        off = rnd.uniform(-60, 60)
        start = rnd.uniform(10, 60)
        length = rnd.uniform(90, 260)
        sx = head[0] + ux * start + px * off
        sy = head[1] + uy * start + py * off
        d.line([(sx, sy), (sx + ux * length, sy + uy * length)],
               fill=(PALE if abs(off) < 25 else HOT) + (210,), width=rnd.choice([2, 3, 4]))


for tag, fn, blur in (("a", shaft_glow, 10), ("b", shards, 4), ("c", streaks, 8)):
    out = base.copy()
    out.alpha_composite(glow_layer(fn, blur))
    out.convert("RGB").save(f"{prefix}_{tag}.png")
print("nock", nock, "shelf", tuple(round(v) for v in shelf), "head", tuple(round(v) for v in head))
