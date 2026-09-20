"""Three card-pose skeletons that differ ONLY in her left (raised) arm.

Tanveer approved the pose structure and rejected the raised arm in both
survivors: "the right hand is fine in both instances but the left one is just
awkward". So everything else is frozen \u2014 legs, torso, hip/shoulder counter-
rotation, head turn, and the reaching right arm are byte-identical across the
three. That makes the comparison controlled: whatever differs in the renders is
the arm, not the roll.

Why the old arm was awkward, concretely: elbow (556,300), wrist (536,180) put
the ELBOW OUTSIDE THE WRIST, so the forearm kinked back inward at the top. A
raised arm reads well when shoulder -> elbow -> wrist progresses in one
direction. All three variants below obey that; none of them reverse.

  a "reach"  straight diagonal up and out, open hand. Clean line, confident.
  b "fist"   near-vertical above the head, clenched. The fight-pose read.
  c "swept"  trailing back and out, open. Momentum; the ponytail keeps the top
             of the frame, which it does overwhelmingly in every render so far.
"""
import math, sys
from PIL import Image, ImageDraw

W, H = 832, 1216
SHIFT = -25
MIN_LIMB = 100

# Frozen: everything except joints 6 and 7.
BASE = {
    0:  (424, 318), 1: (440, 400), 2: (368, 418), 5: (508, 400),
    3:  (311, 528), 4: (381, 612),
    8:  (390, 690), 11: (468, 712),
    9:  (360, 742), 10: (322, 872),
    12: (540, 862), 13: (598, 1002),
    14: (410, 306), 15: (448, 302), 17: (470, 314),
}

VARIANTS = {
    # name: (L elbow, L wrist)
    "a_reach": ((582, 322), (636, 212)),
    "b_fist":  ((536, 296), (556, 178)),
    # First try swung the arm back and UP: 94px upper arm, which the stub check
    # caught, and only 181px of right margin left for the ponytail. Swinging it
    # back and DOWN buys the length out of vertical space instead of horizontal.
    "c_swept": ((586, 466), (640, 570)),
}

LIMBS = [
    (1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7), (1, 8), (8, 9),
    (9, 10), (1, 11), (11, 12), (12, 13), (1, 0), (0, 14), (14, 16),
    (0, 15), (15, 17),
]
COLORS = [
    (255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0),
    (85, 255, 0), (0, 255, 0), (0, 255, 85), (0, 255, 170), (0, 255, 255),
    (0, 170, 255), (0, 85, 255), (0, 0, 255), (85, 0, 255), (170, 0, 255),
    (255, 0, 255), (255, 0, 170), (255, 0, 85),
]
OUT = (r"C:\Users\Tanve\AppData\Local\Temp\claude"
       r"\E--Projects-toll-the-game\0c1db477-bd2b-4e69-952b-1e94938ee752"
       r"\scratchpad")


def build(name, elbow, wrist):
    raw = dict(BASE)
    raw[6], raw[7] = elbow, wrist
    P = {k: (x + SHIFT, y) for k, (x, y) in raw.items()}

    img = Image.new("RGB", (W, H), (0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    for i, (a, b) in enumerate(LIMBS):
        if a not in P or b not in P:
            continue
        x1, y1 = P[a]
        x2, y2 = P[b]
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        length = max(1, int(math.hypot(x2 - x1, y2 - y1)))
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        poly = Image.new("RGBA", (length, 16), (0, 0, 0, 0))
        ImageDraw.Draw(poly).ellipse([0, 0, length - 1, 15],
                                     fill=COLORS[i % len(COLORS)] + (153,))
        rot = poly.rotate(-angle, expand=True, resample=Image.BICUBIC)
        draw._image.paste(rot, (int(cx - rot.width / 2),   # noqa: SLF001
                                int(cy - rot.height / 2)), rot)
    for idx, (x, y) in P.items():
        draw.ellipse([x - 7, y - 7, x + 7, y + 7],
                     fill=COLORS[idx % len(COLORS)])

    path = "%s\\lyra_card_arm_%s.png" % (OUT, name)
    img.save(path)

    up = math.hypot(P[5][0] - P[6][0], P[5][1] - P[6][1])
    fo = math.hypot(P[6][0] - P[7][0], P[6][1] - P[7][1])
    xs = [x for x, _ in P.values()]
    # The defect being fixed: elbow further out than the wrist means the
    # forearm reverses direction at the top, which is what read as awkward.
    reversed_x = (P[6][0] - P[5][0]) * (P[7][0] - P[6][0]) < 0
    print("%-8s upper %5.1f  fore %5.1f  x %d..%d (margin %d/%d)  %s%s"
          % (name, up, fo, min(xs), max(xs), min(xs), W - max(xs),
             "REVERSED FOREARM" if reversed_x else "monotonic",
             "  STUB" if min(up, fo) < MIN_LIMB else ""))
    return path


for n, (e, w) in VARIANTS.items():
    build(n, e, w)
