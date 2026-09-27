"""Latent Heat (Lyra's ultimate, Pierce to all enemies) - layered skill art (ruling #161; ultimates pick their own colour).

Base: ComfyUI red_lyra/latent-heat/drafts/latent_storm_00008 (his pick, 2026-09-27: "i like the last one"). The model's arrows were
light streaks, so the background is redrawn: a night sky and a volley of drawn red-ice arrows ("the background
arrows can be reiterated"), then her aura, kept small ("add a aura but not too big"), then her cut-out on top.

Usage: compose_latent_heat.py <base.png> <matte_rgba.png> <out.png>
The matte is BiRefNet-HR-matting (BiRefNet_toonout kept some of the model's arrows).
"""
import math
import os
import random
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
AURA = os.path.join(os.path.dirname(HERE), "bow_composite", "aura.py")

# Palette shared with scripts/draw_lyra_bow.py (her arrow head there is the same red ice).
INK = (20, 16, 14)
ICE = (196, 30, 44)
ICE_LIGHT = (255, 120, 120)
SHAFT = (236, 214, 220)
# A violet night, not red: her aura and arrows are red, and v1's crimson sky swallowed both.
SKY_TOP = (10, 6, 24)
SKY_BOTTOM = (52, 14, 58)
BLOOM = (140, 28, 72)
GLOW = (255, 60, 80)

SS = 2  # supersample for clean edges


def sky(w, h):
    """Vertical night gradient with a soft crimson bloom behind her shoulders."""
    img = Image.new("RGB", (w, h))
    px = img.load()
    cx, cy, r = w * 0.45, h * 0.38, h * 0.55
    for y in range(h):
        t = y / (h - 1)
        base = [SKY_TOP[c] + (SKY_BOTTOM[c] - SKY_TOP[c]) * t for c in range(3)]
        for x in range(w):
            k = max(0.0, 1 - math.hypot(x - cx, y - cy) / r) ** 2 * 0.5
            px[x, y] = tuple(int(base[c] + (BLOOM[c] - base[c]) * k) for c in range(3))
    return img


def arrow(d, x, y, ang, s):
    """One red-ice arrow, tip at (x, y), pointing along ang (radians), size s (1 = the bow's arrow)."""
    ux, uy = math.cos(ang), math.sin(ang)
    nx, ny = -uy, ux
    L = 230 * s
    tail = (x - ux * L, y - uy * L)
    neck = (x - ux * 46 * s, y - uy * 46 * s)
    d.line([tail, neck], fill=INK, width=max(2, int(7 * s)))
    d.line([tail, neck], fill=SHAFT, width=max(1, int(3.6 * s)))
    for side in (1, -1):  # ice vanes
        sx, sy = nx * side, ny * side
        tx, ty = tail
        d.polygon([(tx + ux * 8 * s, ty + uy * 8 * s),
                   (tx + ux * 58 * s + sx * 3 * s, ty + uy * 58 * s + sy * 3 * s),
                   (tx + ux * 50 * s + sx * 16 * s, ty + uy * 50 * s + sy * 16 * s),
                   (tx + ux * 14 * s + sx * 13 * s, ty + uy * 14 * s + sy * 13 * s)], fill=ICE, outline=INK)
    hx, hy = neck  # the head: a red-ice crystal
    d.polygon([(x, y), (hx + nx * 15 * s, hy + ny * 15 * s), (hx - ux * 12 * s, hy - uy * 12 * s),
               (hx - nx * 15 * s, hy - ny * 15 * s)], fill=ICE, outline=INK)
    d.polygon([(x - ux * 8 * s, y - uy * 8 * s), (hx + nx * 6 * s, hy + ny * 6 * s), (hx - ux * 2 * s, hy - uy * 2 * s)],
              fill=ICE_LIGHT)
    return tail


def trail(d, x, y, ang, s, length):
    """A fading light streak behind an arrow: the volley is already moving."""
    ux, uy = math.cos(ang), math.sin(ang)
    for i in range(12):
        a0, a1 = 200 * s + length * i / 12, 200 * s + length * (i + 1) / 12
        alpha = int(150 * (1 - i / 12))
        d.line([(x - ux * a0, y - uy * a0), (x - ux * a1, y - uy * a1)],
               fill=(255, 150, 160, alpha), width=max(1, int(5 * s * (1 - i / 14))))


def volley(w, h, seed=11):
    """Arrows in three depth bands, all flying the same way (down-right, at the enemy side).
    Far arrows are small, dim and soft; near ones are large and crisp."""
    rnd = random.Random(seed)
    ang = math.radians(32)
    layers = []
    for band, (count, smin, smax, blur, dim) in enumerate(((24, 0.45, 0.6, 1.4, 0.6),
                                                          (12, 0.75, 1.0, 0.5, 0.85),
                                                          (7, 1.25, 1.6, 0.0, 1.0))):
        glow = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
        body = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
        gd, bd = ImageDraw.Draw(glow), ImageDraw.Draw(body)
        for _ in range(count):
            s = rnd.uniform(smin, smax)
            x = rnd.uniform(0.05, 1.1) * w
            if band == 2:  # the big near arrows go to the sides, where she does not cover them
                x = rnd.choice((rnd.uniform(0.02, 0.3), rnd.uniform(0.75, 1.15))) * w
            y = rnd.uniform(-0.05, 0.95) * h
            a = ang + rnd.uniform(-0.05, 0.05)
            trail(gd, x * SS, y * SS, a, s * SS, rnd.uniform(160, 320) * s * SS)
            arrow(bd, x * SS, y * SS, a, s * SS)
        glow = glow.filter(ImageFilter.GaussianBlur(4 * SS))
        body = body.resize((w, h), Image.LANCZOS)
        glow = glow.resize((w, h), Image.LANCZOS)
        if blur:
            body = body.filter(ImageFilter.GaussianBlur(blur))
        if dim < 1:
            a = body.split()[3].point(lambda v: int(v * dim))
            body.putalpha(a)
        halo = Image.new("RGBA", (w, h), GLOW + (0,))
        halo.putalpha(body.split()[3].filter(ImageFilter.GaussianBlur(7)).point(lambda v: int(v * 0.7)))
        layers.append((glow, halo, body))
    return layers


def main():
    base_p, matte_p, out_p = sys.argv[1:4]
    base = Image.open(base_p).convert("RGB")
    w, h = base.size
    matte = Image.open(matte_p).convert("RGBA").split()[3]

    bg = sky(w, h).convert("RGBA")
    for glow, halo, body in volley(w, h):
        bg.alpha_composite(glow)
        bg.alpha_composite(halo)
        bg.alpha_composite(body)
    fig = base.convert("RGBA")
    fig.putalpha(matte)
    flat = bg.copy()
    flat.alpha_composite(fig)

    tmp = tempfile.mkdtemp()
    flat_p = os.path.join(tmp, "flat.png")
    mat_p = os.path.join(tmp, "matte.png")
    flat.convert("RGB").save(flat_p)
    Image.merge("RGBA", (*Image.new("RGB", (w, h)).split(), matte)).save(mat_p)
    # Her signature aura, the Flash Point colours, smaller reach and shorter flames.
    subprocess.run([sys.executable, AURA, flat_p, mat_p, out_p, "255,200,205", "220,20,45", "0.35", "9"], check=True)


if __name__ == "__main__":
    main()
