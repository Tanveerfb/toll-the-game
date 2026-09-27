"""Replace a model-drawn bow with Lyra's locked drawn bow (ruling #160), keeping the model's natural grip.

The Shatterburn option-A lesson (2026-09-27): render her HOLDING a bow so the grip is real, then swap the bow.
New here (Flash Point / Shatterburn redo): where the model's bow or arrow crosses IN FRONT of her (skirt, boots,
top), cutting it out leaves holes the slimmer drawn bow does not cover, so those pixels are REPAINTED with her
LoRA first (masked inpaint), then the drawn bow goes on and her gripping hand is pasted back over its riser.

Steps (config: scripts/skill_art/bows/<name>.json):
  bow_swap.py mask <cfg>     -> <out>/mask.png + mask_overlay.png  (review this before repainting)
  bow_swap.py prefill <cfg>  -> <out>/prefilled.png (no AI: ground cleared, body pixels filled)
  bow_swap.py inpaint <cfg>  -> low-denoise harmonise per cfg["seeds"]: <out>/repainted_<seed>.png
  bow_swap.py pick <cfg>     -> copies repainted_<cfg["seed_pick"]>.png to repainted.png
  bow_swap.py place <cfg>    -> <out>/swapped.png, <out>/swapped_matte.png

Config keys (all coordinates in the finished image's pixels):
  source, matte, prompt_file, out_dir
  region [x0,y0,x1,y1]        where bow-coloured pixels may be taken
  keep_boxes [[x0,y0,x1,y1]]  never taken by COLOUR (gold bracers read as wood); a line may still cross them
  hard_keep [[x0,y0,x1,y1]]   never masked at all: the hands
  lines [[x0,y0,x1,y1,width]] corridors always masked: arrow shaft, string
  grip [x,y], nock [x,y], scale, tilt, mirror   -> bow placement (as bow_composite.py)
  hand_box [x0,y0,x1,y1]      her bow hand, pasted back over the drawn riser
  arrow bool                  draw the nocked arrow (false for a follow-through)
"""
import colorsys
import json
import math
import os
import shutil
import sys
import time
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import draw_lyra_bow as bow  # noqa: E402

COMFY = r"E:\Installed\ComfyUI_windows_portable\ComfyUI"
LEATHER = (58, 42, 34)


def inside(x, y, b):
    return b[0] <= x < b[2] and b[1] <= y < b[3]


def is_bow(c, wood=True):
    """Wood (tan/brown), or a magenta arrow. Wood by colour is off by default in configs: on F4 it also took
    skin shadow and skirt pleats, so the bow itself is masked by hand-placed `strokes` instead."""
    h, s, v = colorsys.rgb_to_hsv(*(t / 255 for t in c))
    is_wood = wood and 18 / 360 <= h <= 48 / 360 and s > 0.38 and 0.12 < v < 0.82
    magenta = 280 / 360 <= h <= 335 / 360 and s > 0.35 and v > 0.35
    return is_wood or magenta


def is_hair(c):
    h, s, v = colorsys.rgb_to_hsv(*(t / 255 for t in c))
    return 190 / 360 <= h <= 265 / 360 and s > 0.25


def build_mask(cfg):
    src = Image.open(cfg["source"]).convert("RGB")
    W, H = src.size
    px = src.load()
    m = Image.new("L", (W, H), 0)
    mp = m.load()
    x0, y0, x1, y1 = cfg["region"]
    keep = cfg.get("keep_boxes", [])
    wood = cfg.get("wood_by_colour", False)
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            if is_bow(px[x, y], wood) and not any(inside(x, y, b) for b in keep):
                mp[x, y] = 255
    # grow over the black outline of what colour found, but never into hair
    grown = m.filter(ImageFilter.MaxFilter(cfg.get("grow", 11))).load()
    for y in range(H):
        for x in range(W):
            if grown[x, y] and not mp[x, y] and max(px[x, y]) < 90 and not is_hair(px[x, y]) \
                    and not any(inside(x, y, b) for b in keep):
                mp[x, y] = 255
    d = ImageDraw.Draw(m)
    for lx0, ly0, lx1, ly1, w in cfg.get("lines", []):
        d.line([(lx0, ly0), (lx1, ly1)], fill=255, width=w)
    for pts, w in cfg.get("strokes", []):  # the bow's path, placed by hand: [[x,y],...], width
        d.line([tuple(p) for p in pts], fill=255, width=w, joint="curve")
        for p in pts:
            d.ellipse((p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2), fill=255)
    m = m.filter(ImageFilter.MaxFilter(5))
    # The hands: inside each hard_keep box only skin and glove pixels (plus their outline) are protected. A
    # whole-box keep (F4 v1) also kept the model's arrow shaft lying on top of the fist, leaving a dark bar and a
    # hard rectangular edge.
    kp = m.load()
    for b in cfg.get("hard_keep", []):
        hand = hand_mask(src.crop(b)).load()
        for y in range(b[1], b[3]):
            for x in range(b[0], b[2]):
                if hand[x - b[0], y - b[1]]:
                    kp[x, y] = 0
    return src, m


def _is_skin_or_glove(c):
    h, s, v = colorsys.rgb_to_hsv(*(t / 255 for t in c))
    # White ground is out (F4: a white box came back with the fingers), but by saturation, not brightness:
    # the knuckle highlights are near-white too and a brightness cap split her fingers around the grip.
    skin = s < 0.45 and v > 0.55 and not (s < 0.05 and v > 0.94)
    glove = (h < 0.03 or h > 0.95) and s > 0.4 and v > 0.25
    return skin or glove


def hand_mask(crop):
    """Her hand inside a box: skin and glove pixels, opened to drop thin shapes (the model's red arrow shaft on
    the fist read as glove), then grown to take the finger outlines."""
    m = Image.new("L", crop.size, 0)
    mp, px = m.load(), crop.load()
    for y in range(crop.height):
        for x in range(crop.width):
            if _is_skin_or_glove(px[x, y]):
                mp[x, y] = 255
    m = np.array(m.filter(ImageFilter.MinFilter(9)))
    from scipy import ndimage
    lab, n = ndimage.label(m > 127)
    if n > 1:  # only the fist: pale scraps of the old arrow near the box edge also pass the colour test
        sizes = ndimage.sum(m > 127, lab, range(1, n + 1))
        m = np.where(lab == 1 + int(np.argmax(sizes)), 255, 0).astype(np.uint8)
    return Image.fromarray(m).filter(ImageFilter.MaxFilter(15))


def cmd_mask(cfg):
    src, m = build_mask(cfg)
    os.makedirs(cfg["out_dir"], exist_ok=True)
    m.save(os.path.join(cfg["out_dir"], "mask.png"))
    over = src.convert("RGBA")
    red = Image.new("RGBA", src.size, (255, 0, 0, 150))
    over.paste(red, (0, 0), m)
    d = ImageDraw.Draw(over)
    for b in cfg.get("keep_boxes", []):
        d.rectangle(b, outline=(0, 200, 0), width=3)
    over.convert("RGB").save(os.path.join(cfg["out_dir"], "mask_overlay.png"))
    print("mask px", sum(m.histogram()[128:]))


def _zone_masks(cfg, W, H):
    """(repaint, clear): mask pixels where her body is behind the bow, and mask pixels that were empty ground."""
    mask = np.array(Image.open(os.path.join(cfg["out_dir"], "mask.png")).convert("L"))
    zones = Image.new("L", (W, H), 0)
    zd = ImageDraw.Draw(zones)
    for b in cfg.get("inpaint_zones", [[0, 0, W, H]]):
        zd.rectangle(b, fill=255)
    z = np.array(zones)
    return np.minimum(mask, z), np.minimum(mask, 255 - z)


def cmd_prefill(cfg):
    """Step 1 of the repaint, NO AI: empty ground under the old bow is cleared to white, and the pixels over her
    body are filled from their surroundings (a row-wise blend between the colours either side).
    Why not a plain masked inpaint: on F4 every seed invented a limb in the long strip the bow left (a glove, a
    raised hand, an extra bracer), and the skirt strip it did draw did not line up with the pleats either side."""
    src = Image.open(cfg["source"]).convert("RGB")
    W, H = src.size
    rep, clear = _zone_masks(cfg, W, H)
    img = np.array(src).astype(np.float32)
    img[clear > 127] = 255
    # Row by row, blend from the colour just left of the hole to the colour just right of it, skipping dark
    # outline pixels. OpenCV's Telea fill (tried first) smeared the outlines into a dark band down the middle
    # of the skirt, which the low-denoise pass then kept as a strap.
    hole = rep > 127
    lum = img.mean(axis=2)

    def side(y, x, step):
        vals = []
        while 0 <= x < W and len(vals) < 6:
            if not hole[y, x] and lum[y, x] > 70:
                vals.append(img[y, x])
            x += step
        return np.median(vals, axis=0) if vals else None

    for y in range(H):
        xs = np.nonzero(hole[y])[0]
        if not len(xs):
            continue
        runs = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)
        for r in runs:
            a, b = r[0], r[-1]
            left, right = side(y, a - 3, -1), side(y, b + 3, 1)
            left = right if left is None else left
            right = left if right is None else right
            if left is None:
                continue
            t = np.linspace(0, 1, b - a + 1)[:, None]
            img[y, a:b + 1] = left * (1 - t) + right * t
    filled = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    smooth = filled.filter(ImageFilter.GaussianBlur(3))
    filled.paste(smooth, (0, 0), Image.fromarray(rep))
    filled.save(os.path.join(cfg["out_dir"], "prefilled.png"))
    Image.fromarray(rep).save(os.path.join(cfg["out_dir"], "repaint_mask.png"))
    print("prefilled")


def cmd_inpaint(cfg):
    """Step 2: a LOW-denoise pass over the prefilled pixels only (SetLatentNoiseMask), so lines and pleats are
    redrawn to meet their neighbours instead of being invented. One per cfg['seeds'] -> repainted_<seed>.png;
    pick the cleanest with `pick` (cfg['seed_pick'])."""
    seeds = cfg.get("seeds", [3])
    for i, s in enumerate(seeds):
        _inpaint_one(cfg, s, first=(i == 0))


def pick(cfg):
    """Copy the chosen repaint to repainted.png."""
    shutil.copyfile(os.path.join(cfg["out_dir"], f"repainted_{cfg['seed_pick']}.png"),
                    os.path.join(cfg["out_dir"], "repainted.png"))
    print("picked", cfg["seed_pick"])


def _inpaint_one(cfg, seed, first):
    with open(cfg["prompt_file"], encoding="utf-8") as f:
        pos, neg = [ln.strip() for ln in f.read().strip().split("\n", 1)]
    pos = pos.replace("holding a wooden recurve bow", "hands clenched").replace("drawing a bow", "")
    neg += ", (bow:1.4), (arrow:1.3), bowstring, weapon, (extra hand:1.3), (floating glove:1.3), stray hair strand"
    shutil.copyfile(os.path.join(cfg["out_dir"], "prefilled.png"), COMFY + r"\input\bowswap_src.png")
    m = Image.open(os.path.join(cfg["out_dir"], "repaint_mask.png")).filter(ImageFilter.MaxFilter(9))
    m.save(COMFY + r"\input\bowswap_mask.png")
    prefix = cfg["out_prefix"] + f"_harmonise_{seed}"
    g = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "animagineXL40_v4Opt.safetensors"}},
        "2": {"class_type": "LoraLoader", "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": "lyra_toll.safetensors",
                                                     "strength_model": 0.9, "strength_clip": 0.9}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 1], "text": pos}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 1], "text": neg}},
        "10": {"class_type": "LoadImage", "inputs": {"image": "bowswap_src.png"}},
        "11": {"class_type": "LoadImageMask", "inputs": {"image": "bowswap_mask.png", "channel": "red"}},
        "12": {"class_type": "VAEEncode", "inputs": {"pixels": ["10", 0], "vae": ["1", 2]}},
        "16": {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["12", 0], "mask": ["11", 0]}},
        "13": {"class_type": "KSampler", "inputs": {"model": ["2", 0], "positive": ["3", 0], "negative": ["4", 0],
                                                   "latent_image": ["16", 0], "seed": seed, "steps": 30,
                                                   "cfg": 6.0, "sampler_name": "dpmpp_2m", "scheduler": "karras",
                                                   "denoise": cfg.get("denoise", 0.55)}},
        "14": {"class_type": "VAEDecode", "inputs": {"samples": ["13", 0], "vae": ["1", 2]}},
        "15": {"class_type": "SaveImage", "inputs": {"images": ["14", 0], "filename_prefix": prefix}},
    }
    req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=json.dumps({"prompt": g}).encode(),
                                 headers={"Content-Type": "application/json"})
    pid = json.loads(urllib.request.urlopen(req).read())["prompt_id"]
    for _ in range(200):
        time.sleep(3)
        hist = json.loads(urllib.request.urlopen(f"http://127.0.0.1:8188/history/{pid}").read())
        if pid in hist and hist[pid].get("outputs"):
            img = hist[pid]["outputs"]["15"]["images"][0]
            _composite(cfg, seed, os.path.join(COMFY, "output", img["subfolder"], img["filename"]), first)
            return
    raise SystemExit("inpaint timed out")


def _composite(cfg, seed, harmonised_path, first=False):
    """Only the repaint pixels take the harmonised image; everything else is the prefill (the finish with the
    empty ground cleared), so nothing outside the bow's path changes."""
    base = Image.open(os.path.join(cfg["out_dir"], "prefilled.png")).convert("RGB")
    rep = Image.open(harmonised_path).convert("RGB")
    m = Image.open(os.path.join(cfg["out_dir"], "repaint_mask.png")).filter(ImageFilter.MaxFilter(5)) \
        .filter(ImageFilter.GaussianBlur(2))
    base.paste(rep, (0, 0), m)
    d = ImageDraw.Draw(base)
    for b in cfg.get("clear_boxes", []):  # leftovers over empty ground the repaint redrew (F4: a string as a strand)
        d.rectangle(b, fill=(255, 255, 255))
    base.save(os.path.join(cfg["out_dir"], f"repainted_{seed}.png"))
    if first:
        base.save(os.path.join(cfg["out_dir"], "repainted.png"))
    print("repainted", seed)


def cmd_recomp(cfg):
    """Rebuild repainted_<seed>.png from the harmonised renders already on disk (after a clear_boxes change)."""
    d = os.path.join(COMFY, "output", *cfg["out_prefix"].split("/")[:-1])
    stem = cfg["out_prefix"].split("/")[-1]
    for i, s in enumerate(cfg.get("seeds", [3])):
        f = sorted(x for x in os.listdir(d) if x.startswith(f"{stem}_harmonise_{s}_"))[-1]
        _composite(cfg, s, os.path.join(d, f), first=(i == 0))


def cmd_place(cfg):
    base = Image.open(os.path.join(cfg["out_dir"], "repainted.png")).convert("RGBA")
    orig = Image.open(cfg["source"]).convert("RGB")
    W, H = base.size
    gx, gy = cfg["grip"]
    nx, ny = cfg["nock"]
    scale, tilt, mirror = cfg["scale"], cfg["tilt"], cfg.get("mirror", False)
    th = math.radians(tilt)
    dx, dy = nx - gx, ny - gy
    lx = (dx * math.cos(th) - dy * math.sin(th)) / scale
    ly = (dx * math.sin(th) + dy * math.cos(th)) / scale
    GX, GY = bow.GRIP
    if mirror:
        lx = -lx
    draw_pt = (GX + lx, GY + ly) if cfg.get("drawn", True) else None
    CW = int(max(bow.W, (draw_pt[0] + 60) if draw_pt else bow.W))
    layer, _ = bow.render(draw_point=draw_pt, arrow=cfg.get("arrow", True) and draw_pt is not None, canvas=(CW, bow.H))
    grip_x = GX
    if mirror:
        layer = layer.transpose(Image.FLIP_LEFT_RIGHT)
        grip_x = CW - GX
    layer = layer.resize((int(CW * scale), int(bow.H * scale)), Image.LANCZOS)
    g = (grip_x * scale, GY * scale)
    pad = int(max(layer.size))
    big = Image.new("RGBA", (layer.width + 2 * pad, layer.height + 2 * pad), (0, 0, 0, 0))
    big.alpha_composite(layer, (pad, pad))
    big = big.rotate(tilt, center=(g[0] + pad, g[1] + pad), resample=Image.BICUBIC)
    placed = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    placed.alpha_composite(big, (int(round(gx - g[0] - pad)), int(round(gy - g[1] - pad))))
    placed.save(os.path.join(cfg["out_dir"], "bow_layer.png"))  # effects find the arrow in it
    comp = base.copy()
    comp.alpha_composite(placed)
    # her bow hand back over the riser, the model's grip wood recoloured to the drawn leather wrap
    hb = cfg["hand_box"]
    hand = orig.crop(hb)
    hpx = hand.load()
    hm = hand_mask(hand)
    hmp = hm.load()
    for y in range(hand.height):
        for x in range(hand.width):
            c = hpx[x, y]
            if hmp[x, y] and not _is_skin_or_glove(c) and (is_bow(c) or max(c) < 60):
                v = max(c) / 255  # the model's grip inside her fingers, recoloured to the drawn leather wrap
                hpx[x, y] = tuple(int(t * (0.7 + 0.5 * max(v, 0.35))) for t in LEATHER)
    comp.paste(hand.convert("RGBA"), (hb[0], hb[1]), hm.filter(ImageFilter.GaussianBlur(0.8)))
    comp.convert("RGB").save(os.path.join(cfg["out_dir"], "swapped.png"))
    # matte for the layers: her matte, minus the old bow (mask), plus the drawn bow
    if not cfg.get("matte"):  # no pre-made matte: compose_bow_skill.py cuts one from swapped.png
        print("placed; bow bbox", placed.getbbox())
        return
    matte = Image.open(cfg["matte"]).convert("RGBA").split()[3]
    mask = Image.open(os.path.join(cfg["out_dir"], "mask.png")).convert("L")
    rep_matte = Image.composite(Image.new("L", (W, H), 0), matte, mask) if cfg.get("mask_cuts_matte", False) else matte
    out_m = Image.fromarray(np.maximum(np.array(rep_matte), np.array(placed.split()[3])))
    out_m.save(os.path.join(cfg["out_dir"], "swapped_matte.png"))
    print("placed; bow bbox", placed.getbbox())


if __name__ == "__main__":
    cmd, cfg_p = sys.argv[1], sys.argv[2]
    with open(cfg_p, encoding="utf-8") as f:
        cfg = json.load(f)
    {"mask": cmd_mask, "prefill": cmd_prefill, "inpaint": cmd_inpaint, "recomp": cmd_recomp, "pick": pick,
     "place": cmd_place}[cmd](cfg)
