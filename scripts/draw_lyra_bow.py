"""Lyra's recurve bow, drawn.

Animagine cannot render a bow as an isolated object: two batches, eight images,
zero usable results (2026-09-21). Cropped risers, doubled geometry, a stick with
hooks, and in every single one a bowstring that is either fragmented or not
attached to anything. That is the same defect the shipped portrait has.

So it is drawn, following the precedent already set three times in
docs/ART_REQUESTS.md — the coin frames, the app icon and the skill glyphs all
ended up in Python because the acceptance criteria were geometric. A recurve bow
profile is two mirrored curves, a riser and a straight string; the house style is
flat fills with thick lineart, which is what vector drawing produces natively.

Brief (Tanveer, 2026-09-21): mid-tier, market-bought. Not a beginner's stick, not
custom. Wood-and-horn laminate, leather grip, functional, slightly worn. The
signature bow is ARC TWO, not Arc One (Tanveer, 2026-09-21: "maybe not in arc
one, but in arc two"), so this bow covers every Arc One chapter. When it exists
it is a separate card, not a replacement (#141, #151).
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

W, H = 832, 1216
SS = 3  # supersample for clean edges

# --- palette: wood/horn laminate, reads against both light and dark grounds ---
WOOD      = (109, 70, 47)
WOOD_DARK = (62, 39, 27)
HORN      = (214, 200, 178)
LEATHER   = (58, 42, 34)
STRING    = (232, 226, 214)
INK       = (20, 16, 14)

CX = 400          # riser centreline
TIP_X = 470       # limb tips sit forward of the grip; string hangs between them
TOP_Y, BOT_Y = 168, 1052
RISER_TOP, RISER_BOT = 520, 700


def bez(p0, p1, p2, p3, n=160):
    """Cubic bezier, sampled."""
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = (u * u * u * p0[0] + 3 * u * u * t * p1[0]
             + 3 * u * t * t * p2[0] + t * t * t * p3[0])
        y = (u * u * u * p0[1] + 3 * u * u * t * p1[1]
             + 3 * u * t * t * p2[1] + t * t * t * p3[1])
        out.append((x, y))
    return out


def ribbon(pts, w_start, w_end):
    """Turn a centreline into a tapered polygon."""
    left, right = [], []
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        t = i / (n - 1)
        w = (w_start * (1 - t) + w_end * t) / 2
        if i == 0:
            dx, dy = pts[1][0] - x, pts[1][1] - y
        elif i == n - 1:
            dx, dy = x - pts[-2][0], y - pts[-2][1]
        else:
            dx, dy = pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L * w, dx / L * w
        left.append((x + nx, y + ny))
        right.append((x - nx, y - ny))
    return left + right[::-1]


def draw_limb(d, upper):
    """One limb: riser end -> recurved tip."""
    # Two segments, because a RECURVE is defined by the second one: the limb
    # sweeps away from the string, then the last stretch hooks back toward it.
    # A single bezier gives a longbow, which is what the first version drew.
    if upper:
        main = bez((CX, RISER_TOP), (CX - 20, 418), (CX - 62, 288), (CX - 34, 222), 110)
        hook = bez((CX - 34, 222), (CX - 14, 184), (TIP_X - 28, 158), (TIP_X, TOP_Y), 50)
    else:
        main = bez((CX, RISER_BOT), (CX - 20, 802), (CX - 62, 932), (CX - 34, 998), 110)
        hook = bez((CX - 34, 998), (CX - 14, 1036), (TIP_X - 28, 1062), (TIP_X, BOT_Y), 50)
    pts = main + hook[1:]
    # back of the limb, dark; belly inlay, wood; a thin horn stripe along it
    d.polygon(ribbon(pts, 40, 13), fill=WOOD_DARK, outline=INK)
    inner = [(x + 3, y) for x, y in pts]
    d.polygon(ribbon(inner, 24, 7), fill=WOOD)
    d.polygon(ribbon(inner, 8, 2), fill=HORN)
    return pts


def render():
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    class S:  # scale-aware wrapper so the geometry above stays in real pixels
        def polygon(self, pts, fill=None, outline=None):
            d.polygon([(x * SS, y * SS) for x, y in pts], fill=fill,
                      outline=outline, width=2 * SS if outline else 0)

        def line(self, pts, fill, width):
            d.line([(x * SS, y * SS) for x, y in pts], fill=fill,
                   width=int(width * SS), joint="curve")

        def rounded(self, box, r, fill, outline):
            d.rounded_rectangle([box[0] * SS, box[1] * SS, box[2] * SS,
                                 box[3] * SS], radius=r * SS, fill=fill,
                                outline=outline, width=2 * SS)

    s = S()
    top_pts = draw_limb(s, True)
    bot_pts = draw_limb(s, False)

    # riser: the thick middle the limbs bolt into
    s.polygon(ribbon([(CX, RISER_TOP - 6), (CX, RISER_BOT + 6)], 40, 40),
              fill=WOOD_DARK, outline=INK)
    s.polygon(ribbon([(CX + 4, RISER_TOP + 4), (CX + 4, RISER_BOT - 4)], 22, 22),
              fill=WOOD)
    # leather grip wrap, and the arrow shelf above it
    s.rounded((CX - 17, 572, CX + 17, 660), 8, LEATHER, INK)
    for y in range(580, 656, 12):
        s.line([(CX - 15, y), (CX + 15, y - 5)], INK, 1.4)
    s.polygon([(CX + 16, 556), (CX + 34, 549), (CX + 34, 561), (CX + 16, 566)],
              fill=HORN, outline=INK)

    # NOCKS. A real bow has a grooved tip the string seats into, and drawing one
    # also closes a gap: the tapered limb polygon caps perpendicular to the curve,
    # so its corner can fall a few pixels short of the string. Reviewing the tip
    # at 2.6x showed exactly that - the same "string attached to nothing" defect
    # this whole approach exists to avoid. The nock bridges limb to string.
    for tip in (top_pts[-1], bot_pts[-1]):
        x, y = tip
        s.polygon([(x - 13, y - 9), (x + 6, y - 9), (x + 6, y + 9), (x - 13, y + 9)],
                  fill=WOOD_DARK, outline=INK)
        s.polygon([(x - 9, y - 4), (x + 4, y - 4), (x + 4, y + 4), (x - 9, y + 4)],
                  fill=HORN)

    # THE STRING: a straight line between the two tips. Drawn, never generated -
    # every one of the eight rolls broke it. Serving whipping at the nock point.
    s.line([top_pts[-1], bot_pts[-1]], INK, 5.0)
    s.line([top_pts[-1], bot_pts[-1]], STRING, 2.6)
    mid = ((top_pts[-1][0] + bot_pts[-1][0]) / 2,
           (top_pts[-1][1] + bot_pts[-1][1]) / 2)
    s.line([(mid[0], mid[1] - 46), (mid[0], mid[1] + 46)], LEATHER, 6.0)

    img = img.resize((W, H), Image.LANCZOS)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    outdir = os.path.join(root, 'public', 'props')
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, 'lyra_bow.png')
    img.save(out)
    bb = img.getbbox()
    print("bow drawn", img.size, "content bbox", bb)
    print("string spans", top_pts[-1], "->", bot_pts[-1])


render()
