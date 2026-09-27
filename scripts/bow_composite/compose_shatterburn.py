"""Shatterburn, the first fully layered skill card (2026-09-27).

Layer order, back to front:
  1 class background (attack-debuff = purple, from the game's tokens)
  3a red-ice particles scattered across the background
  3b her red aura, hugging her silhouette (aura.py on the matte)
  2 Lyra's cut-out
  4 the drawn bow (mirrored: her draw hand is left of the bow), with her fist
    and glove pasted back over it
  3c the arrow glowing red and white: her aura channelled into the shot

v1 had a burst of ice shards at the arrow; he rejected that: *"i don't like
the ice particles around the arrow specifically. you can spread out the
particles in the background randomly. give lyra a red aura and with the arrow
glowing red and white showing that she's channeling her aura into the arrow"*.
Paths are this session's; the numbers are what render S7 needed."""
import math
import os
import random
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "skill_art"))
import draw_class_bg as bgmod  # noqa: E402

PY = sys.executable
OUTPUT = r"E:\Installed\ComfyUI_windows_portable\ComfyUI\output\lyra_kit"
SCRATCH = sys.argv[1]
RENDER = os.path.join(OUTPUT, "shatterburn_base_00007_.png")
MATTE = os.path.join(OUTPUT, "sb7_matte_00001_.png")
FIST, NOCK = (740, 335), (290, 405)
FIST_BOX, GLOVE_BOX = (672, 272, 802, 395), (205, 390, 302, 447)
SCALE, TILT = 0.88, 21.0  # perpendicular to her raised arm; v2 had -21, leaning the wrong way
FOCUS = (0.94, 0.17)  # speed lines converge where she aims
CRIMSON, HOT, PALE, INK = (225, 28, 48), (255, 95, 90), (255, 225, 225), (40, 6, 14)


def p(name):
    return os.path.join(SCRATCH, name)


fig = Image.open(RENDER).convert("RGBA")
matte = Image.open(MATTE).convert("RGBA").split()[-1]
fig.putalpha(matte)
W, H = fig.size

# 1 + 3a: background, then red-ice particles scattered at random across it.
bg = bgmod.draw(bgmod.class_colours()["attackDebuff"], *FOCUS, seed=4).convert("RGBA")
parts = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(parts)
rnd = random.Random(21)
for _ in range(46):
    sx, sy = rnd.uniform(0, W), rnd.uniform(0, H)
    s = rnd.uniform(5, 17)
    a = rnd.uniform(0, math.pi)
    pts = [(sx + math.cos(a) * s * 2.0, sy + math.sin(a) * s * 2.0),
           (sx + math.cos(a + 1.8) * s * 0.7, sy + math.sin(a + 1.8) * s * 0.7),
           (sx - math.cos(a) * s, sy - math.sin(a) * s),
           (sx + math.cos(a - 1.8) * s * 0.7, sy + math.sin(a - 1.8) * s * 0.7)]
    d.polygon(pts, fill=CRIMSON + (rnd.randint(170, 235),), outline=INK + (200,))
    d.polygon(pts[:3], fill=HOT + (190,))
bg.alpha_composite(parts.filter(ImageFilter.GaussianBlur(4)))
bg.alpha_composite(parts)
bg_p = p("sb_bg.png")
bg.convert("RGB").save(bg_p)

# 3b + 2: aura behind her (aura.py composites aura then the figure on top).
flat = bg.copy()
flat.alpha_composite(fig)
flat_p, aura_p = p("sb_flat.png"), p("sb_aura.png")
flat.convert("RGB").save(flat_p)
subprocess.run([PY, os.path.join(HERE, "aura.py"), flat_p, MATTE, aura_p, "255,200,205", "220,20,45", "1.0"],
               check=True, stdin=subprocess.DEVNULL)

# 4: the bow, then her fist and glove back over it.
comp_p = p("sb_bow.png")
subprocess.run([PY, os.path.join(HERE, "bow_composite.py"), aura_p, comp_p, *map(str, FIST), *map(str, NOCK),
                str(SCALE), str(TILT), "mirror"], check=True, stdin=subprocess.DEVNULL)
comp = Image.open(comp_p).convert("RGBA")
base = Image.open(aura_p).convert("RGBA")
m = Image.new("L", (W, H), 0)
mp, ap, fp = m.load(), matte.load(), fig.load()
HAND_BOXES = ((GLOVE_BOX, True),) if "nofist" in sys.argv else ((FIST_BOX, False), (GLOVE_BOX, True))
for (x0, y0, x1, y1), glove_only in HAND_BOXES:
    for y in range(y0, y1):
        for x in range(x0, x1):
            if ap[x, y] < 128:
                continue
            r, g, b, _ = fp[x, y]
            if glove_only and not (r > 120 and g < 90 and b < 90):
                continue  # at the chin only the red glove goes back over the string
            mp[x, y] = 255
m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
comp.paste(base, (0, 0), m)
comp.convert("RGB").save(p("sb_preglow.png"))  # the grip pass works on this, before the arrow glow
# The bow hand, redrawn around the grip by grip_pass.py ("grip=<file>" picks the pass).
GRIP_ARG = next((a[5:] for a in sys.argv if a.startswith("grip=")), None)
if GRIP_ARG:
    HALF = 110
    gx0, gy0 = FIST[0] - HALF, FIST[1] - HALF
    gm = Image.new("L", (2 * HALF, 2 * HALF), 0)
    ImageDraw.Draw(gm).ellipse([HALF - 58, HALF - 64, HALF + 58, HALF + 64], fill=255)
    gm = gm.filter(ImageFilter.GaussianBlur(5))
    gr = Image.open(GRIP_ARG).convert("RGBA").resize((2 * HALF, 2 * HALF), Image.LANCZOS)
    comp.paste(gr, (gx0, gy0), gm)

# 3c: the arrow glows red and white. Its line is the same transform the bow
# composite used: the shelf sits above the grip on the (mirrored) string side.
t = math.radians(TILT)
sdx, sdy = -30 * SCALE, (553 - 616) * SCALE
shelf = (FIST[0] + sdx * math.cos(t) + sdy * math.sin(t), FIST[1] - sdx * math.sin(t) + sdy * math.cos(t))
ux, uy = shelf[0] - NOCK[0], shelf[1] - NOCK[1]
L = math.hypot(ux, uy)
ux, uy = ux / L, uy / L
head = (shelf[0] + ux * 95 * SCALE, shelf[1] + uy * 95 * SCALE)
lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ld = ImageDraw.Draw(lay)
ld.line([NOCK, head], fill=CRIMSON + (190,), width=16)
ld.line([NOCK, head], fill=HOT + (230,), width=8)
glow = lay.filter(ImageFilter.GaussianBlur(9))
core = Image.new("RGBA", (W, H), (0, 0, 0, 0))
cd = ImageDraw.Draw(core)
cd.line([NOCK, head], fill=PALE + (255,), width=4)
for r_, a_ in ((16, 150), (7, 230)):  # small: a big flare hid the riser above her fist
    cd.ellipse([head[0] - r_, head[1] - r_, head[0] + r_, head[1] + r_], fill=(HOT if r_ > 30 else PALE) + (a_,))
comp.alpha_composite(glow)
comp.alpha_composite(glow)
comp.alpha_composite(core.filter(ImageFilter.GaussianBlur(3)))
comp.alpha_composite(core)
out = p("shatterburn_v2.png")
comp.convert("RGB").save(out)
print("wrote", out, "arrow", NOCK, "->", tuple(round(v) for v in head))
