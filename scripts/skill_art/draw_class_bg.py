"""Skill-art background, layer 1 of 4 (docs/design/SKILL_ART_PLAN.md).

Background colour = skill class (Tanveer, 2026-09-27, from 7DSGC). The class
colour is NOT restated here: the class -> token map is read from
lib/game/skillTypeStyle.ts and the token -> hex from styles/globals.css, so a
retuned token flows into the art. Radial speed lines converge on a focal
point, which is where the character's action should sit.

Usage: draw_class_bg.py <class|all> <out.png> [fx fy] [seed]
  class: attack | attackDebuff | heal | buff | stance
  fx fy: focal point as fractions of the canvas (default 0.5 0.4)
"""
import math
import os
import random
import re
import sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
W, H = 832, 1216
SS = 2  # supersample for clean line edges


def class_colours():
    """{class: (r, g, b)} resolved from the two source files."""
    ts = open(os.path.join(ROOT, "lib", "game", "skillTypeStyle.ts"), encoding="utf-8").read()
    css = open(os.path.join(ROOT, "styles", "globals.css"), encoding="utf-8").read()
    tokens = dict(re.findall(r"--color-([\w-]+):\s*([^;]+);", css))

    def resolve(name):
        v = tokens[name].strip()
        m = re.match(r"var\(--color-([\w-]+)\)", v)
        return resolve(m.group(1)) if m else v

    out = {}
    for cls, token in re.findall(r'^\s*(\w+):\s*"bg-([\w-]+)\b', ts, re.M):
        hexv = resolve(token).lstrip("#")
        out[cls] = tuple(int(hexv[i:i + 2], 16) for i in (0, 2, 4))
    assert set(out) >= {"attack", "attackDebuff", "heal", "buff", "stance"}, out
    return out


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def draw(colour, fx=0.5, fy=0.4, seed=1):
    rnd = random.Random(seed)
    w, h = W * SS, H * SS
    cx, cy = fx * w, fy * h
    deep = mix(colour, (0, 0, 0), 0.62)
    light = mix(colour, (255, 255, 255), 0.55)
    # base: class colour, brightest at the focal point, deepening to the edges.
    # v1 used a glow so wide the edges never darkened, which read flat and
    # pastel next to 7DSGC's cards; this radius keeps the corners deep.
    base = Image.new("RGB", (w, h), deep)
    glow = Image.new("L", (w, h), 0)
    r = max(w, h) * 0.42
    ImageDraw.Draw(glow).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(r * 0.55))
    base.paste(Image.new("RGB", (w, h), colour), (0, 0), glow)
    # radial speed lines: thin wedges from near the focus to beyond the frame
    lines = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lines)
    far = math.hypot(w, h)
    for _ in range(170):
        a = rnd.uniform(0, 2 * math.pi)
        spread = rnd.uniform(0.002, 0.016)
        inner = rnd.uniform(0.1, 0.32) * far
        tone = rnd.random()
        fill = (light + (rnd.randint(110, 190),)) if tone < 0.65 else (deep + (rnd.randint(120, 200),))
        d.polygon([(cx + math.cos(a) * inner, cy + math.sin(a) * inner),
                   (cx + math.cos(a - spread) * far, cy + math.sin(a - spread) * far),
                   (cx + math.cos(a + spread) * far, cy + math.sin(a + spread) * far)], fill=fill)
    for _ in range(14):  # a few hard white streaks
        a = rnd.uniform(0, 2 * math.pi)
        spread = rnd.uniform(0.001, 0.004)
        inner = rnd.uniform(0.2, 0.45) * far
        d.polygon([(cx + math.cos(a) * inner, cy + math.sin(a) * inner),
                   (cx + math.cos(a - spread) * far, cy + math.sin(a - spread) * far),
                   (cx + math.cos(a + spread) * far, cy + math.sin(a + spread) * far)],
                  fill=(255, 255, 255, rnd.randint(150, 220)))
    img = base.convert("RGBA")
    img.alpha_composite(lines)
    # keep the focal area calm so the character reads against it
    calm = Image.new("L", (w, h), 0)
    rc = min(w, h) * 0.16
    ImageDraw.Draw(calm).ellipse([cx - rc, cy - rc, cx + rc, cy + rc], fill=200)
    calm = calm.filter(ImageFilter.GaussianBlur(rc * 0.6))
    img.paste(Image.new("RGBA", (w, h), light + (255,)), (0, 0), calm)
    return img.resize((W, H), Image.LANCZOS).convert("RGB")


if __name__ == "__main__":
    cls, out = sys.argv[1], sys.argv[2]
    fx = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
    fy = float(sys.argv[4]) if len(sys.argv) > 4 else 0.4
    seed = int(sys.argv[5]) if len(sys.argv) > 5 else 1
    colours = class_colours()
    if cls == "all":
        tiles = [(c, draw(colours[c], fx, fy, seed)) for c in ("attack", "attackDebuff", "heal", "buff", "stance")]
        sheet = Image.new("RGB", (5 * (W // 2 + 8), H // 2), (13, 13, 16))
        for i, (c, t) in enumerate(tiles):
            sheet.paste(t.resize((W // 2, H // 2)), (i * (W // 2 + 8), 0))
        sheet.save(out)
        print({c: "#%02x%02x%02x" % colours[c] for c, _ in tiles})
    else:
        draw(colours[cls], fx, fy, seed).save(out)
        print(cls, "#%02x%02x%02x" % colours[cls])
