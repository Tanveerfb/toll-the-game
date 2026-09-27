"""Paint out off-model colour (e.g. the red hem stripe the model keeps adding to her plain white skirt).

Each matching pixel takes the colour of the nearest non-matching pixel above it, so the skirt's own shading
carries down through the band. Only strongly saturated red matches by default: skin in shadow is reddish too
(s ~0.2-0.4) and a looser test repainted her thigh white (Shatterburn release, 2026-09-27).
Usage: paint_out.py <src.png> <out.png> <x0> <y0> <x1> <y1> [min_saturation=0.55]
"""
import colorsys
import sys

from PIL import Image, ImageFilter


def is_red(c, smin):
    h, s, v = colorsys.rgb_to_hsv(*(t / 255 for t in c))
    return (h < 0.05 or h > 0.93) and s > smin and v > 0.12


def main():
    src, out = sys.argv[1], sys.argv[2]
    x0, y0, x1, y1 = (int(v) for v in sys.argv[3:7])
    smin = float(sys.argv[7]) if len(sys.argv) > 7 else 0.55
    im = Image.open(src).convert("RGB")
    px = im.load()
    mask = Image.new("L", im.size, 0)
    mp = mask.load()
    n = 0
    for x in range(x0, x1):
        for y in range(y0, y1):
            if is_red(px[x, y], smin):
                # nearest LIGHT pixel above: taking just the nearest non-red one picked up pleat lines and
                # outlines column by column and left barcode streaks (B3 v1)
                yy = y - 1
                while yy > 0 and (is_red(px[x, yy], smin) or max(px[x, yy]) < 170):
                    yy -= 1
                px[x, y] = px[x, yy]
                mp[x, y] = 255
                n += 1
    smooth = im.filter(ImageFilter.MedianFilter(7))
    im.paste(smooth, (0, 0), mask.filter(ImageFilter.MaxFilter(3)))
    im.save(out)
    print("painted out", n)


if __name__ == "__main__":
    main()
