"""Layered skill art for a bow-swapped render (ruling #161): class-colour background -> motion streaks -> her
cut-out -> the skill's effect. No aura (his call for the Flash Point / Shatterburn redo: "no need for aura on
either one").

Usage: compose_bow_skill.py <cfg.json> <effect> <out.png>
  cfg    : the bow_swap config (out_dir holds swapped.png, bow_layer.png)
  effect : flash  - Flash Point: one piercing shot. A flash at the arrowhead and the shaft burning red-white.
           shatter- Shatterburn: the aftermath. Red-ice shards bursting and smouldering where the shot went.
The cut-out is BiRefNet-HR-matting of swapped.png (white ground), run here through ComfyUI.
Writes <out.png> at the game's kit-art size (832x1216) and <out>_full.png at the working size.
"""
import json
import math
import os
import random
import shutil
import sys
import time
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import draw_class_bg as bgmod  # noqa: E402

COMFY = r"E:\Installed\ComfyUI_windows_portable\ComfyUI"
CRIMSON, HOT, PALE, INK = (225, 28, 48), (255, 95, 90), (255, 232, 232), (40, 6, 14)
ICE, ICE_LIGHT = (196, 30, 44), (255, 120, 120)


def matte(cfg):
    """BiRefNet-HR-matting of swapped.png, cached as swapped_cutout_matte.png."""
    out = os.path.join(cfg["out_dir"], "swapped_cutout_matte.png")
    if os.path.exists(out) and os.path.getmtime(out) > os.path.getmtime(os.path.join(cfg["out_dir"], "swapped.png")):
        return Image.open(out).convert("L")
    shutil.copyfile(os.path.join(cfg["out_dir"], "swapped.png"), COMFY + r"\input\bowskill_swapped.png")
    g = {
        "1": {"class_type": "LoadImage", "inputs": {"image": "bowskill_swapped.png"}},
        "2": {"class_type": "BiRefNetRMBG", "inputs": {"image": ["1", 0], "model": "BiRefNet-HR-matting", "sensitivity": 1.0,
                                                      "mask_blur": 0, "mask_offset": 0, "invert_output": False,
                                                      "refine_foreground": False, "background": "Alpha",
                                                      "background_color": "#222222"}},
        # a fresh prefix each run: an identical graph is served from ComfyUI's cache with no output recorded
        "3": {"class_type": "SaveImage", "inputs": {"images": ["2", 0],
                                                    "filename_prefix": f"{cfg['out_prefix']}_cutout_{int(time.time())}"}},
    }
    req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=json.dumps({"prompt": g}).encode(),
                                 headers={"Content-Type": "application/json"})
    pid = json.loads(urllib.request.urlopen(req).read())["prompt_id"]
    for _ in range(100):
        time.sleep(2)
        hist = json.loads(urllib.request.urlopen(f"http://127.0.0.1:8188/history/{pid}").read())
        if pid in hist and hist[pid].get("outputs"):
            img = hist[pid]["outputs"]["3"]["images"][0]
            a = Image.open(os.path.join(COMFY, "output", img["subfolder"], img["filename"])).convert("RGBA").split()[3]
            # keep her main silhouette plus the drawn bow (it is in the cut-out, and in bow_layer as a backstop)
            from scipy import ndimage
            arr = np.array(a)
            lab, n = ndimage.label(arr > 40)
            if n > 1:
                sizes = ndimage.sum(arr > 40, lab, range(1, n + 1))
                arr = np.where(lab == 1 + int(np.argmax(sizes)), arr, 0)
            bow_a = np.array(Image.open(os.path.join(cfg["out_dir"], "bow_layer.png")).split()[3])
            # White skirt on white ground: BiRefNet left the skirt see-through (Flash Point v1). The render's
            # ground is flat white, so flood it in from the frame edge through near-white pixels; the line art
            # stops it at her outline, and everything it cannot reach is her, solid.
            rgb = np.array(Image.open(os.path.join(cfg["out_dir"], "swapped.png")).convert("RGB")).astype(int)
            # Thicken the line art by 3 px before flooding so a gap in an outline cannot leak the ground into the
            # skirt (v3 did, on its left side). A tighter white threshold instead (v4: >251) speckled the skirt.
            lines = ndimage.binary_dilation(rgb.min(axis=2) <= 232, iterations=3)
            white = (rgb.min(axis=2) > 232) & ~lines
            wl, _ = ndimage.label(white)
            edge = np.unique(np.r_[wl[0], wl[-1], wl[:, 0], wl[:, -1]])
            ground = np.isin(wl, edge[edge > 0])
            # Ground ENCLOSED by her (inside a ponytail loop, between arm and body) cannot be reached from the
            # edge; BiRefNet rates those clear and the skirt partly solid, so an enclosed white patch it rates
            # under 40/255 on average is ground too.
            # Not by BiRefNet alpha after all: on F4 it rated the empty hair loop 77/255 and a skirt panel 60.
            # By colour, per patch: empty ground averages ~253, the skirt ~249 (per pixel, v4 speckled).
            means = ndimage.mean(rgb.min(axis=2), wl, range(1, wl.max() + 1))
            ground |= np.isin(wl, 1 + np.nonzero(np.asarray(means) >= 251.5)[0])
            solid = ndimage.binary_erosion(~ground, iterations=2)
            arr = np.maximum(arr, np.where(solid, 255, 0))
            Image.fromarray(np.maximum(arr, bow_a).astype(np.uint8)).save(out)
            return Image.open(out).convert("L")
    raise SystemExit("matte timed out")


def arrow_line(cfg):
    """(nock, tip) of the drawn arrow: the tip is the far end of the red-ice head in bow_layer.png."""
    lay = np.array(Image.open(os.path.join(cfg["out_dir"], "bow_layer.png")).convert("RGBA"))
    r, g, b, a = [lay[..., i].astype(int) for i in range(4)]
    head = (a > 200) & (r > 150) & (g < 90) & (b < 90)
    ys, xs = np.nonzero(head)
    nx, ny = cfg["nock"]
    d = (xs - nx) ** 2 + (ys - ny) ** 2
    i = int(np.argmax(d))
    return (nx, ny), (int(xs[i]), int(ys[i]))


def streaks(W, H, direction, seed=7):
    """Motion streaks trailing behind her (direction = unit vector of her travel)."""
    rnd = random.Random(seed)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    ux, uy = direction
    for _ in range(38):
        x, y = rnd.uniform(-0.1, 1.1) * W, rnd.uniform(0, 1) * H
        L = rnd.uniform(0.15, 0.45) * W
        w = rnd.uniform(2, 7)
        d.line([(x, y), (x - ux * L, y - uy * L)], fill=PALE + (rnd.randint(50, 120),), width=int(w))
    return lay.filter(ImageFilter.GaussianBlur(1.2))


def flash(W, H, nock, tip):
    """Flash Point: the shaft burning red-white from nock to head, and the ignition flash at the head."""
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.line([nock, tip], fill=CRIMSON + (200,), width=26)
    gd.line([nock, tip], fill=HOT + (230,), width=12)
    tx, ty = tip
    for r_, col in ((170, CRIMSON + (120,)), (95, HOT + (170,)), (46, PALE + (230,))):
        gd.ellipse((tx - r_, ty - r_, tx + r_, ty + r_), fill=col)
    glow = glow.filter(ImageFilter.GaussianBlur(16))
    core = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(core)
    cd.line([nock, tip], fill=PALE + (255,), width=5)
    ang0 = math.atan2(ty - nock[1], tx - nock[0])
    rnd = random.Random(3)
    for k in range(14):  # the flash: thin rays, the longest along the line of flight
        a = ang0 + k * 2 * math.pi / 14 + rnd.uniform(-0.08, 0.08)
        L = (230 if k == 0 else rnd.uniform(60, 140))
        w = 9 if k == 0 else 4
        cd.polygon([(tx + math.cos(a) * L, ty + math.sin(a) * L),
                    (tx + math.cos(a + math.pi / 2) * w, ty + math.sin(a + math.pi / 2) * w),
                    (tx - math.cos(a + math.pi / 2) * w, ty - math.sin(a + math.pi / 2) * w)], fill=PALE + (235,))
    cd.ellipse((tx - 22, ty - 22, tx + 22, ty + 22), fill=(255, 255, 255, 255))
    return glow, core.filter(ImageFilter.GaussianBlur(1.0))


def shatter(W, H, centre, seed=21):
    """Shatterburn: red-ice shards bursting outward from `centre`, glowing at the edges, some smouldering (Decay)."""
    rnd = random.Random(seed)
    shards = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(shards)
    cx, cy = centre
    for _ in range(46):
        a = rnd.uniform(0, 2 * math.pi)
        dist = rnd.uniform(40, 0.55 * W)
        x, y = cx + math.cos(a) * dist, cy + math.sin(a) * dist
        s = rnd.uniform(8, 30) * (1.2 - dist / (0.55 * W))
        ux, uy = math.cos(a), math.sin(a)
        nx, ny = -uy, ux
        pts = [(x + ux * s * 2.2, y + uy * s * 2.2), (x + nx * s * 0.7, y + ny * s * 0.7),
               (x - ux * s, y - uy * s), (x - nx * s * 0.7, y - ny * s * 0.7)]
        d.polygon(pts, fill=ICE + (rnd.randint(190, 245),), outline=INK + (210,))
        d.polygon(pts[:3], fill=ICE_LIGHT + (200,))
    glow = Image.new("RGBA", (W, H), HOT + (0,))
    glow.putalpha(shards.split()[3].filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * 0.8)))
    burst = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(burst)
    for r_, col in ((260, CRIMSON + (90,)), (140, HOT + (130,)), (60, PALE + (200,))):
        bd.ellipse((cx - r_, cy - r_, cx + r_, cy + r_), fill=col)
    burst = burst.filter(ImageFilter.GaussianBlur(40))
    embers = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ed = ImageDraw.Draw(embers)
    for _ in range(120):  # Decay: embers drifting up off the shards
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        r_ = rnd.uniform(1.5, 4)
        ed.ellipse((x - r_, y - r_, x + r_, y + r_), fill=(255, rnd.randint(90, 170), 90, rnd.randint(110, 220)))
    return burst, glow, shards, embers.filter(ImageFilter.GaussianBlur(0.8))


def main():
    cfg_p, effect, out = sys.argv[1:4]
    with open(cfg_p, encoding="utf-8") as f:
        cfg = json.load(f)
    fx = cfg["fx"]
    swapped = Image.open(os.path.join(cfg["out_dir"], "swapped.png")).convert("RGBA")
    W, H = swapped.size
    # trim a pixel off the cut-out edge: the white ground left a light fringe round her hair (Shatterburn B3 v3)
    m = matte(cfg).filter(ImageFilter.MinFilter(3))
    fig = swapped.copy()
    fig.putalpha(m)
    colour = bgmod.class_colours()[fx["class"]]
    img = bgmod.draw(colour, fx["focus"][0], fx["focus"][1], seed=fx.get("bg_seed", 4)).resize((W, H), Image.LANCZOS)
    img = img.convert("RGBA")
    if "travel" in fx:
        img.alpha_composite(streaks(W, H, fx["travel"]))
    if effect == "shatter":
        burst, glow, shards, embers = shatter(W, H, fx["burst"])
        # shards are opt-in: "You don't have to force them in every art" (him, on Shatterburn B3)
        for lay in ((burst, glow, shards) if fx.get("shards") else (burst,)):
            img.alpha_composite(lay)
        img.alpha_composite(fig)
        img.alpha_composite(embers)
    elif effect == "flash":
        img.alpha_composite(fig)
        glow, core = flash(W, H, *arrow_line(cfg))
        img.alpha_composite(glow)
        img.alpha_composite(core)
    else:
        raise SystemExit(f"unknown effect {effect}")
    img = img.convert("RGB")
    img.save(out.replace(".png", "_full.png"))
    img.resize((832, 1216), Image.LANCZOS).save(out)
    print("wrote", out)


if __name__ == "__main__":
    main()
