"""Shatterburn, option A (his pick, 2026-09-27): the model drew Lyra HOLDING a
bow, so her bow hand is a real archer's grip. Its bow is wrong, so it is cut
out of the matte and the locked drawn bow is put in its place, aligned to the
model's grip and arrow line, with her fingers pasted back over the new riser.

Layers, back to front: class background, scattered red-ice particles, her red
aura, Lyra (model bow removed), the drawn bow (mirrored), her bow-hand
fingers and draw-hand glove back on top, the arrow glowing red and white.
Numbers are what render A9 needed."""
import colorsys
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
RENDER = os.path.join(OUTPUT, "shatterburn_a_00009_.png")
MATTE = os.path.join(OUTPUT, "sba9_matte_00001_.png")
GRIP, NOCK = (707, 356), (360, 387)      # model's bow hand / arrow nock at her chin
SCALE, TILT = 1.1, -4.0                   # match the model bow's size and lean
HAND_BOX = (655, 285, 765, 405)           # her bow hand: fingers go back over the riser
GLOVE_BOX = (230, 380, 345, 470)          # draw hand: glove back over the string
BRACER_BOXES = ((540, 312, 672, 440),)    # gold, same hue as the bow: never removed (v1 cut it at y 415)
BOW_REGION = (560, 0, 832, 1216)          # the model's bow lives right of her body
HEAD_BOX = (768, 222, 832, 280)           # model arrowhead, over white
FOCUS = (0.94, 0.17)
CRIMSON, HOT, PALE, INK = (225, 28, 48), (255, 95, 90), (255, 225, 225), (40, 6, 14)


def p(name):
    return os.path.join(SCRATCH, name)


def inside(x, y, box):
    return box[0] <= x < box[2] and box[1] <= y < box[3]


rgb = Image.open(RENDER).convert("RGB")
W, H = rgb.size
px = rgb.load()


def is_tan(c):
    h, s, v = colorsys.rgb_to_hsv(*(t / 255 for t in c))
    return 20 / 360 <= h <= 55 / 360 and s > 0.35 and v > 0.3


# Remove the model's bow from the matte: tan pixels in the bow region, plus the
# dark outline pixels that touch them, never the bracers or the bow hand.
tan = Image.new("L", (W, H), 0)
tp = tan.load()
for y in range(H):
    for x in range(BOW_REGION[0], BOW_REGION[2]):
        if is_tan(px[x, y]) and not any(inside(x, y, b) for b in BRACER_BOXES) and not inside(x, y, HAND_BOX):
            tp[x, y] = 255
near = tan.filter(ImageFilter.MaxFilter(13)).load()  # wide enough to take the bow outline
matte = Image.open(MATTE).convert("RGBA").split()[-1]
orig_mp = matte.copy().load()
mp = matte.load()
removed = 0
for y in range(H):
    for x in range(BOW_REGION[0], BOW_REGION[2]):
        if any(inside(x, y, b) for b in BRACER_BOXES) or inside(x, y, HAND_BOX):
            continue
        v = max(px[x, y]) / 255
        c = px[x, y]
        hh, ss, vv = colorsys.rgb_to_hsv(*(t / 255 for t in c))
        hair = 190 / 360 <= hh <= 260 / 360 and ss > 0.3  # her navy ponytail
        right_of_body = x >= 600 or (x >= 580 and y > 1000)
        # Colour alone left the model bow's dark red tip and outline fragments,
        # so right of her body everything goes except hair and the exempt zones.
        if near[x, y] or inside(x, y, HEAD_BOX) or (right_of_body and not hair):
            mp[x, y] = 0
            removed += 1
fig = rgb.convert("RGBA")
fig.putalpha(matte)

# 1 + 3a: background and scattered particles
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

# 3b + 2: aura then Lyra
matte_p = p("sba_matte_clean.png")
Image.merge("RGBA", (*Image.new("RGB", (W, H)).split(), matte)).save(matte_p)
flat = bg.copy()
flat.alpha_composite(fig)
flat_p, aura_p = p("sba_flat.png"), p("sba_aura.png")
flat.convert("RGB").save(flat_p)
subprocess.run([PY, os.path.join(HERE, "aura.py"), flat_p, matte_p, aura_p, "255,200,205", "220,20,45", "1.0"],
               check=True, stdin=subprocess.DEVNULL)

# 4: drawn bow, then her fingers and glove back over it
comp_p = p("sba_bow.png")
subprocess.run([PY, os.path.join(HERE, "bow_composite.py"), aura_p, comp_p, *map(str, GRIP), *map(str, NOCK),
                str(SCALE), str(TILT), "mirror"], check=True, stdin=subprocess.DEVNULL)
comp = Image.open(comp_p).convert("RGBA")
base = Image.open(aura_p).convert("RGBA")
hm = Image.new("L", (W, H), 0)
hp = hm.load()
# The whole hand goes back, grip included, with the model's tan grip recoloured
# to the drawn bow's leather wrap so it reads as the same bow. v1 pasted only
# the non-tan pixels, which left the model grip's dark lines striping her fingers.
LEATHER = (58, 42, 34)
hand = rgb.copy()
hpx = hand.load()
for y in range(HAND_BOX[1], HAND_BOX[3]):
    for x in range(HAND_BOX[0], HAND_BOX[2]):
        if is_tan(px[x, y]) or max(px[x, y]) < 40:  # tan wood, or the model's black grip
            v = max(max(px[x, y]) / 255, 0.35)
            hpx[x, y] = tuple(int(c * (0.7 + 0.5 * v)) for c in LEATHER)
        if orig_mp[x, y] > 128:
            hp[x, y] = 255
for y in range(GLOVE_BOX[1], GLOVE_BOX[3]):
    for x in range(GLOVE_BOX[0], GLOVE_BOX[2]):
        r, g, b = px[x, y]
        if mp[x, y] > 128 and r > 120 and g < 90 and b < 90:
            hp[x, y] = 255
hm = hm.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
comp.paste(base, (0, 0), hm)
comp.paste(hand.convert("RGBA"), (0, 0), hm.point(lambda a: a if a else 0))

# 3c: arrow glow along the same line the bow composite drew
t = math.radians(TILT)
sdx, sdy = -30 * SCALE, (553 - 616) * SCALE
shelf = (GRIP[0] + sdx * math.cos(t) + sdy * math.sin(t), GRIP[1] - sdx * math.sin(t) + sdy * math.cos(t))
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
for r_, a_ in ((16, 150), (7, 230)):
    cd.ellipse([head[0] - r_, head[1] - r_, head[0] + r_, head[1] + r_], fill=(HOT if r_ > 30 else PALE) + (a_,))
comp.alpha_composite(glow)
comp.alpha_composite(glow)
comp.alpha_composite(core.filter(ImageFilter.GaussianBlur(3)))
comp.alpha_composite(core)
out = p("shatterburn_a9.png")
comp.convert("RGB").save(out)
print("removed", removed, "px of model bow; shelf", tuple(round(v) for v in shelf), "head", tuple(round(v) for v in head))
