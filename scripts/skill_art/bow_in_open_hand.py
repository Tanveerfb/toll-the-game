"""Draw Lyra's bow INTO an open hand: nothing is erased (the faster path after the S6 bow swap ran long).

After release an archer's bow hand opens and the braced bow tips forward in it, so the bow sits behind the
palm, leaning. Writes <out_dir>/swapped.png and <out_dir>/bow_layer.png, the same files bow_swap.py produces,
so compose_bow_skill.py layers it unchanged.

Usage: bow_in_open_hand.py <cfg.json>
  cfg keys: source, out_dir, grip [x,y] (palm centre), scale, tilt (deg, negative leans the top forward/right),
            hand_box [x0,y0,x1,y1] (her hand, pasted back over the bow), mirror (bool)
"""
import json
import os
import sys

from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
import draw_lyra_bow as bow  # noqa: E402
from bow_swap import hand_mask  # noqa: E402


def main():
    with open(sys.argv[1], encoding="utf-8") as f:
        cfg = json.load(f)
    src = Image.open(cfg["source"]).convert("RGBA")
    W, H = src.size
    layer, _ = bow.render()
    GX, GY = bow.GRIP
    if cfg.get("mirror"):
        layer = layer.transpose(Image.FLIP_LEFT_RIGHT)
        GX = bow.W - GX
    s = cfg["scale"]
    layer = layer.resize((int(bow.W * s), int(bow.H * s)), Image.LANCZOS)
    g = (GX * s, GY * s)
    pad = max(layer.size)
    big = Image.new("RGBA", (layer.width + 2 * pad, layer.height + 2 * pad), (0, 0, 0, 0))
    big.alpha_composite(layer, (pad, pad))
    big = big.rotate(cfg["tilt"], center=(g[0] + pad, g[1] + pad), resample=Image.BICUBIC)
    placed = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gx, gy = cfg["grip"]
    placed.alpha_composite(big, (int(round(gx - g[0] - pad)), int(round(gy - g[1] - pad))))
    os.makedirs(cfg["out_dir"], exist_ok=True)
    placed.save(os.path.join(cfg["out_dir"], "bow_layer.png"))
    comp = src.copy()
    comp.alpha_composite(placed)
    if cfg.get("hand_box"):
        hb = cfg["hand_box"]
        hand = src.crop(hb)
        comp.paste(hand, (hb[0], hb[1]), hand_mask(hand.convert("RGB")))
    if cfg.get("hair_over"):
        # slung on her back: her ponytail lies over the bow (navy hair pixels go back on top)
        from bow_swap import is_hair
        rgb = src.convert("RGB")
        px = rgb.load()
        hm = Image.new("L", (W, H), 0)
        hp = hm.load()
        x0, y0, x1, y1 = placed.getbbox()
        for y in range(y0, y1):
            for x in range(x0, x1):
                c = px[x, y]
                if is_hair(c) or (max(c) < 45 and y < cfg.get("hair_dark_below_y", H)):
                    hp[x, y] = 255
        hm = hm.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
        comp.paste(src, (0, 0), hm)
    comp.convert("RGB").save(os.path.join(cfg["out_dir"], "swapped.png"))
    print("bow placed", placed.getbbox())


if __name__ == "__main__":
    main()
