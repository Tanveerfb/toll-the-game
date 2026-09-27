"""Put the bow BEHIND the fist: paste the original render's fist pixels back
over the composite, so the riser enters the fist at the top and leaves at the
bottom. Fist = non-background pixels inside a box around it.
Usage: fist_over.py <base.png> <composite.png> <x0> <y0> <x1> <y1> <out.png>"""
import colorsys
import sys
from PIL import Image, ImageFilter

base = Image.open(sys.argv[1]).convert("RGB")
comp = Image.open(sys.argv[2]).convert("RGB")
x0, y0, x1, y1 = (int(v) for v in sys.argv[3:7])
m = Image.new("L", base.size, 0)
bp, mp = base.load(), m.load()
for y in range(y0, y1):
    for x in range(x0, x1):
        r, g, b = bp[x, y]
        v = max(r, g, b) / 255
        if v > 0.33:  # the ground here is a dark maroon; glove, skin and lineart edges are brighter
            mp[x, y] = 255
m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
comp.paste(base, (0, 0), m)
comp.save(sys.argv[7])
m.save(sys.argv[7].replace(".png", "_fistmask.png"))
print("fist pixels", sum(1 for v in m.getdata() if v > 128))
