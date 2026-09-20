"""COCO-18 OpenPose skeleton for Lyra's CARD pose.

Sibling of make_pose.py, which draws the neutral A-pose SOURCE layer. Same
generator, same canvas, only the joint coordinates change — that is the whole
claim made in docs/ART_PIPELINE.md, "Pose rules for a card render".

Each rule from that section, and the coordinates that satisfy it:

  1. Never symmetrical      -> shoulder line tilts up-right, hip line tilts
                               DOWN-right. Counter-rotated, not parallel.
  2. One open hand to camera-> her RIGHT arm folds forward and short. A
                               foreshortened arm IS a short arm in 2D; the
                               hand lands in front of the ribs, not out at
                               arm's length.
  3. Asymmetric arms        -> left arm raised high (weapon), right arm
                               compressed forward. Nothing matches.
  4. Feet off the ground    -> right knee lifted with the foot tucked under,
                               left leg trailing extended. No planted foot.
  5. Face to camera         -> 3/4 turn to HER right: nose left of the neck,
                               far (right) eye squeezed to the face edge, far
                               ear OMITTED entirely so the skeleton itself
                               carries the turn.
  6. Mass at top of frame   -> raised wrist at y=238, above the head, so the
                               bow rises out of it into the empty top third.

Contained framing, per the Dokkan character-layer format (426x568, figure
inside the frame). Body biased left of centre to leave the upper right for
the bow.
"""
import math
from PIL import Image, ImageDraw

W, H = 832, 1216
SHIFT = -25          # bias the body left; the bow occupies the upper right

# COCO-18: 0 nose, 1 neck, 2 Rsho, 3 Relb, 4 Rwri, 5 Lsho, 6 Lelb, 7 Lwri,
# 8 Rhip, 9 Rkne, 10 Rank, 11 Lhip, 12 Lkne, 13 Lank, 14 Reye, 15 Leye,
# 16 Rear, 17 Lear.   R/L are the SUBJECT'S, so her right is image-left.
RAW = {
    0:  (424, 318),   # nose      — shifted image-left = head turned her right
    1:  (440, 400),   # neck
    2:  (368, 418),   # R shoulder — dropped and back
    5:  (508, 400),   # L shoulder — raised, carries the bow arm
    # v2: BOTH arms lengthened to ~124px upper / ~110-122px forearm. v1 built
    # them at 87/75 to "signal" foreshortening and that was the batch's single
    # worst decision: the model read a stub arm plus the prompt's
    # `foreshortening` as a hand pressed against the lens and drew hands bigger
    # than her head in five of six. Foreshortening is the PROMPT's job, and a
    # gentle one. The skeleton just supplies a real arm.
    3:  (311, 528),   # R elbow
    4:  (381, 612),   # R wrist    — open hand, in front of the hip
    6:  (581, 300),   # L elbow
    7:  (561, 180),   # L wrist    — well above the head: mass at the top
    8:  (390, 690),   # R hip      — HIGH side of the hip line
    11: (468, 712),   # L hip      — low side; counter-rotates the shoulders
    # Lifted leg. The thigh is only 32px long in 2D — that IS the pose: a knee
    # driven at the camera foreshortens to almost nothing, and the shin then
    # hangs its full length. Drawn out to the side instead (the first attempt)
    # it read as a wide lunge with both feet down.
    9:  (360, 742),   # R knee     — high, forward, strongly foreshortened
    10: (322, 872),   # R ankle    — shin hanging, foot clear of any ground
    # Trailing leg, kicked back and out so the two legs form a diagonal rather
    # than one plumb line. Near-vertical here is what made the first pass look
    # like she was standing on it.
    12: (540, 862),   # L knee
    13: (598, 1002),  # L ankle    — toe down, clear of the frame edge
    14: (410, 306),   # R eye      — FAR eye, squeezed toward the face edge
    15: (448, 302),   # L eye      — near eye
    17: (470, 314),   # L ear      — near ear
    # 16 (R ear) deliberately absent: it is behind the head at this angle.
}
P = {k: (x + SHIFT, y) for k, (x, y) in RAW.items()}

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

img = Image.new("RGB", (W, H), (0, 0, 0))
draw = ImageDraw.Draw(img, "RGBA")

for i, (a, b) in enumerate(LIMBS):
    if a not in P or b not in P:
        continue                      # an omitted keypoint drops its limbs
    x1, y1 = P[a]
    x2, y2 = P[b]
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    length = math.hypot(x2 - x1, y2 - y1)
    angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
    box = draw._image  # noqa: SLF001  (PIL has no ellipse-with-rotation)
    poly = Image.new("RGBA", (max(1, int(length)), 16), (0, 0, 0, 0))
    ImageDraw.Draw(poly).ellipse([0, 0, max(1, int(length)) - 1, 15],
                                 fill=COLORS[i % len(COLORS)] + (153,))
    rot = poly.rotate(-angle, expand=True, resample=Image.BICUBIC)
    box.paste(rot, (int(cx - rot.width / 2), int(cy - rot.height / 2)), rot)

for idx, (x, y) in P.items():
    draw.ellipse([x - 7, y - 7, x + 7, y + 7], fill=COLORS[idx % len(COLORS)])

xs = [x for x, _ in P.values()]
ys = [y for _, y in P.values()]
out = (r"C:\Users\Tanve\AppData\Local\Temp\claude"
       r"\E--Projects-toll-the-game\0c1db477-bd2b-4e69-952b-1e94938ee752"
       r"\scratchpad\lyra_card_skeleton.png")
img.save(out)
print("card skeleton", img.size, "->", out)
print("joint extent  x %d..%d  (margins %d / %d)" % (min(xs), max(xs),
                                                     min(xs), W - max(xs)))
print("              y %d..%d  (margins %d / %d)" % (min(ys), max(ys),
                                                     min(ys), H - max(ys)))
print("keypoints: %d of 18 (R ear omitted for the 3/4 turn)" % len(P))

# Limb-length report. v1 shipped an 87px upper arm against a 166px thigh and
# the batch came back with hands the size of her head; the numbers said so
# before the GPU did. Anything under MIN_LIMB is a stub, not foreshortening.
MIN_LIMB = 100
NAMED = [("R upper arm", 2, 3), ("R forearm", 3, 4),
         ("L upper arm", 5, 6), ("L forearm", 6, 7),
         ("R thigh", 8, 9), ("R shin", 9, 10),
         ("L thigh", 11, 12), ("L shin", 12, 13)]
print("\nlimb lengths:")
warned = False
for name, a, b in NAMED:
    L = math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1])
    flag = ""
    if L < MIN_LIMB:
        # A deliberately foreshortened limb is the one exception, and it has to
        # be named here rather than discovered in the render.
        flag = ("  <- INTENDED foreshortening" if name == "R thigh"
                else "  <- STUB, under %d" % MIN_LIMB)
        warned = warned or name != "R thigh"
    print("  %-12s %6.1f%s" % (name, L, flag))
print("stub warnings: %s" % ("YES - fix before generating" if warned else "none"))
