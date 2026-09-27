"""Draw a leather bow sling on a finished image: a slung bow needs something holding it (his note, 2026-09-27:
"Physics where mate?"). The strap runs tip -> over one shoulder -> across the chest -> under the other arm ->
other tip, and her arms (skin, gloves, gold bracers) inside `arms_box` are pasted back so it passes behind them.

Usage: add_bow_strap.py <src.png> <out.png> <cfg.json>
  cfg: points [[x,y],...] along the strap, width, arms_box [x0,y0,x1,y1], out_small [w,h] (optional resize copy)
"""
import colorsys
import json
import sys

from PIL import Image, ImageDraw, ImageFilter

LEATHER, LEATHER_HI, INK = (74, 50, 36), (122, 86, 60), (20, 16, 14)


def is_arm(c):
    h, s, v = colorsys.rgb_to_hsv(*(t / 255 for t in c))
    skin = s < 0.45 and v > 0.6 and (h < 0.12 or h > 0.9)
    glove = (h < 0.03 or h > 0.95) and s > 0.45 and v < 0.55  # dark red glove, not her brighter red top
    gold = 0.08 <= h <= 0.17 and s > 0.45 and v > 0.45
    return skin or glove or gold


def main():
    src_p, out_p, cfg_p = sys.argv[1:4]
    with open(cfg_p, encoding="utf-8") as f:
        cfg = json.load(f)
    src = Image.open(src_p).convert("RGB")
    W, H = src.size
    SS = 3
    lay = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    pts = [(x * SS, y * SS) for x, y in cfg["points"]]
    w = cfg["width"] * SS
    d.line(pts, fill=INK + (255,), width=int(w + 5 * SS), joint="curve")
    d.line(pts, fill=LEATHER + (255,), width=int(w), joint="curve")
    d.line([(x, y - w * 0.22) for x, y in pts], fill=LEATHER_HI + (255,), width=int(w * 0.28), joint="curve")
    # stitching down the middle, so it reads as a leather strap and not a second stick (v1)
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        L = ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5
        n = int(L / (w * 0.9))
        for i in range(n):
            t0, t1 = i / n, (i + 0.5) / n
            d.line([(ax + (bx - ax) * t0, ay + (by - ay) * t0), (ax + (bx - ax) * t1, ay + (by - ay) * t1)],
                   fill=(214, 186, 150, 255), width=max(2, int(w * 0.1)))
    for x, y in (pts[0], pts[-1]):  # ties at the bow tips
        r = w * 0.7
        d.ellipse((x - r, y - r, x + r, y + r), fill=LEATHER + (255,), outline=INK + (255,), width=2 * SS)
    lay = lay.resize((W, H), Image.LANCZOS)
    out = src.convert("RGBA")
    out.alpha_composite(lay)
    # arms back on top: the strap passes behind her crossed arms
    x0, y0, x1, y1 = cfg["arms_box"]
    m = Image.new("L", (W, H), 0)
    mp, px = m.load(), src.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            if is_arm(px[x, y]):
                mp[x, y] = 255
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(0.8))
    out.paste(src.convert("RGBA"), (0, 0), m)
    out = out.convert("RGB")
    out.save(out_p)
    if cfg.get("out_small"):
        out.resize(tuple(cfg["out_small"]), Image.LANCZOS).save(out_p.replace(".png", "_small.png"))
    print("strap drawn")


if __name__ == "__main__":
    main()
