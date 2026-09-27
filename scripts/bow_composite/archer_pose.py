"""OpenPose skeleton for Lyra drawing her bow, 832x1216 cowboy shot.
Bow arm (joints 5-6-7) straight out to viewer-left; draw hand (joint 4) at
the cheek. The same coordinates drive the bow composite afterwards."""
import json
import sys
import math
from PIL import Image, ImageDraw

W, H = 832, 1216
POSES = {
    # Flash Point: facing left, bow arm level to viewer-left, draw hand at the cheek.
    "flashpoint": {
        0: (470, 330), 1: (500, 420), 14: (458, 316), 15: (488, 314), 17: (522, 324),
        5: (440, 440), 6: (305, 432), 7: (172, 424),
        2: (575, 445), 3: (690, 392), 4: (528, 352),
        8: (548, 800), 11: (468, 800), 9: (585, 1050), 12: (430, 1045),
    },
    # Shatterburn: mirrored, bow arm raised ~22 degrees to viewer-right, so the
    # shatter can fill the upper right.
    "shatterburn": {
        0: (395, 385), 1: (350, 460), 14: (382, 372), 15: (407, 370), 16: (345, 378),
        5: (400, 475), 6: (525, 420), 7: (645, 370),
        2: (295, 480), 3: (185, 430), 4: (348, 396),
        8: (320, 850), 11: (400, 850), 9: (290, 1090), 12: (440, 1080),
    },
    # Shatterburn release (2026-09-27 redo): the Shatterburn stance just AFTER the shot. Bow arm still raised
    # to viewer-right, bow hand open (the bow is drawn in afterwards, tipping forward in it); the draw hand has
    # flown back past her ear, as it does on release.
    "shatterburn_release": {
        0: (395, 385), 1: (350, 460), 14: (382, 372), 15: (407, 370), 16: (345, 378),
        5: (400, 475), 6: (525, 420), 7: (645, 370),
        2: (295, 480), 3: (205, 420), 4: (225, 320),
        8: (320, 850), 11: (400, 850), 9: (290, 1090), 12: (440, 1080),
    },
}
NAME = sys.argv[1] if len(sys.argv) > 1 else "flashpoint"
P = POSES[NAME]
LIMBS = [(1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7), (1, 8), (8, 9),
         (9, 10), (1, 11), (11, 12), (12, 13), (1, 0), (0, 14), (14, 16),
         (0, 15), (15, 17)]
COLORS = [(255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0),
          (85, 255, 0), (0, 255, 0), (0, 255, 85), (0, 255, 170), (0, 255, 255),
          (0, 170, 255), (0, 85, 255), (0, 0, 255), (85, 0, 255), (170, 0, 255),
          (255, 0, 255), (255, 0, 170), (255, 0, 85)]
OUT = r"C:\Users\Tanve\AppData\Local\Temp\claude\E--Projects-toll-the-game\0c1db477-bd2b-4e69-952b-1e94938ee752\scratchpad"

img = Image.new("RGB", (W, H), (0, 0, 0))
d = ImageDraw.Draw(img, "RGBA")
for i, (a, b) in enumerate(LIMBS):
    if a not in P or b not in P:
        continue
    (x1, y1), (x2, y2) = P[a], P[b]
    L = max(1, int(math.hypot(x2 - x1, y2 - y1)))
    ang = math.degrees(math.atan2(y2 - y1, x2 - x1))
    poly = Image.new("RGBA", (L, 16), (0, 0, 0, 0))
    ImageDraw.Draw(poly).ellipse([0, 0, L - 1, 15], fill=COLORS[i % 18] + (153,))
    rot = poly.rotate(-ang, expand=True, resample=Image.BICUBIC)
    img.paste(rot, (int((x1 + x2) / 2 - rot.width / 2), int((y1 + y2) / 2 - rot.height / 2)), rot)
for k, (x, y) in P.items():
    d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=COLORS[k % 18])
img.save(OUT + r"\lyra_%s_skeleton.png" % NAME)
for a, b in [(5, 6), (6, 7), (2, 3), (3, 4)]:
    print(a, b, round(math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1])))
json.dump({str(k): v for k, v in P.items()}, open(OUT + r"\lyra_%s_joints.json" % NAME, "w"))
