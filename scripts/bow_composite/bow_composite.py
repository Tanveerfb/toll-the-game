"""Composite Lyra's drawn bow onto a posed render.
Usage: bow_composite.py <base.png> <out.png> <gx> <gy> <nx> <ny> [scale] [tilt_deg]
  (gx, gy): centre of the bow fist in the render (where the grip goes)
  (nx, ny): the draw hand (where the string is pulled to)
  tilt_deg: counter-clockwise tilt of the bow's axis, perpendicular to the arm
Writes the composite plus a mask of the bow fist for the finger pass."""
import math
import sys
sys.path.insert(0, r"E:\Projects\toll-the-game\scripts")
from PIL import Image, ImageDraw
import draw_lyra_bow as bow

base_p, out_p = sys.argv[1], sys.argv[2]
gx, gy, nx, ny = (float(v) for v in sys.argv[3:7])
scale = float(sys.argv[7]) if len(sys.argv) > 7 else 0.88
tilt = float(sys.argv[8]) if len(sys.argv) > 8 else 0.0
# mirror: the draw hand is LEFT of the bow (the drawn bow's string faces right)
mirror = len(sys.argv) > 9 and sys.argv[9] == "mirror"

base = Image.open(base_p).convert("RGBA")
th = math.radians(tilt)
# image -> bow-local: undo translate, rotate by -tilt (image y points down), unscale
dx, dy = nx - gx, ny - gy
lx = (dx * math.cos(th) - dy * math.sin(th)) / scale
ly = (dx * math.sin(th) + dy * math.cos(th)) / scale
GX, GY = bow.GRIP
if mirror:
    lx = -lx  # draw on the bow's own string side, then flip the whole layer
draw_pt = (GX + lx, GY + ly)
CW = int(max(bow.W, draw_pt[0] + 60))
layer, pts = bow.render(draw_point=draw_pt, arrow=True, canvas=(CW, bow.H))
grip_x = GX
if mirror:
    layer = layer.transpose(Image.FLIP_LEFT_RIGHT)
    grip_x = CW - GX
# scale about the canvas, then rotate about the grip, then place the grip at (gx, gy)
layer = layer.resize((int(CW * scale), int(bow.H * scale)), Image.LANCZOS)
g = (grip_x * scale, GY * scale)
pad = int(max(layer.size))
big = Image.new("RGBA", (layer.width + 2 * pad, layer.height + 2 * pad), (0, 0, 0, 0))
big.paste(layer, (pad, pad))
c = (g[0] + pad, g[1] + pad)
big = big.rotate(tilt, resample=Image.BICUBIC, center=c)
out = base.copy()
out.alpha_composite(big, (int(round(gx - c[0])), int(round(gy - c[1]))) if False else (0, 0),
                    source=(int(round(c[0] - gx)), int(round(c[1] - gy)), int(round(c[0] - gx)) + base.width,
                            int(round(c[1] - gy)) + base.height))
out.convert("RGB").save(out_p)
m = Image.new("L", base.size, 0)
ImageDraw.Draw(m).ellipse([gx - 48, gy - 52, gx + 48, gy + 52], fill=255)
m.save(out_p.replace(".png", "_fistmask.png"))
print("draw point (bow-local)", tuple(round(v) for v in draw_pt), "canvas", CW)
