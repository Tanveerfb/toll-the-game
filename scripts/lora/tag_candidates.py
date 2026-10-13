"""Tag candidate images with the WD14 tagger and flag the ones that drift (Claude's QC pass before a sheet).

The tagger is SmilingWolf/wd-eva02-large-tagger-v3 (Apache-2.0, downloaded 2026-10-14) in ComfyUI
models/wd14_tagger/. It reads Danbooru tags off an image, so drift a sheet would otherwise
need eyes for shows up as a tag: `text`, `logo`, `arm_up`, `multiple_boys`, `long_hair`,
`capri_pants`. It is a filter for Claude, never a verdict: he still picks by eye
(the auto-rejects are only text on clothes and an arm raised, rules in docs/CHARACTER_ART.md).

Run with ComfyUI's embedded python (it has onnxruntime; system python 3.14 does not):
  E:\\Installed\\ComfyUI_windows_portable\\python_embeded\\python.exe scripts/lora/tag_candidates.py <id> <image or folder> [...]
      [--ban tag,tag] [--threshold 0.35] [--show]

Flags = the defaults below + the profile's `qc_tags.ban` + --ban. A tag in the profile's
`qc_tags.expect` that is missing is flagged too (e.g. `black_shirt`). --show prints every tag.
"""
import argparse
import csv
import json
import os
import sys

import numpy as np
import onnxruntime as ort
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = r"E:\Installed\ComfyUI_windows_portable\ComfyUI\models\wd14_tagger\wd-eva02-large-tagger-v3"
DEFAULT_BAN = ["text", "english_text", "logo", "watermark", "signature", "arm_up", "arms_up", "multiple_boys",
               "multiple_girls", "2boys", "multiple_views", "reference_sheet", "extra_arms", "extra_legs"]


def load():
    sess = ort.InferenceSession(os.path.join(MODEL_DIR, "model.onnx"), providers=["CPUExecutionProvider"])
    with open(os.path.join(MODEL_DIR, "selected_tags.csv"), encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return sess, [r["name"] for r in rows], [r["category"] for r in rows]


def prep(path, size):
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    im = Image.alpha_composite(bg, im).convert("RGB")
    side = max(im.size)
    sq = Image.new("RGB", (side, side), (255, 255, 255))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    sq = sq.resize((size, size), Image.BICUBIC)
    arr = np.asarray(sq, dtype=np.float32)[:, :, ::-1]  # RGB -> BGR, 0-255, as the model was trained
    return np.ascontiguousarray(arr[None])


def tags_for(sess, names, cats, path, threshold):
    inp = sess.get_inputs()[0]
    probs = sess.run(None, {inp.name: prep(path, inp.shape[1])})[0][0]
    return {n: float(p) for n, c, p in zip(names, cats, probs) if c == "0" and p >= threshold}


def files(args):
    out = []
    for a in args:
        if os.path.isdir(a):
            out += sorted(os.path.join(a, f) for f in os.listdir(a) if f.lower().endswith((".png", ".webp", ".jpg")))
        else:
            out.append(a)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("id")
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--ban", default="")
    ap.add_argument("--threshold", type=float, default=0.35)
    ap.add_argument("--show", action="store_true")
    a = ap.parse_args()
    with open(os.path.join(HERE, "characters", f"{a.id}.json"), encoding="utf-8") as f:
        qc = json.load(f).get("qc_tags") or {}
    ban = set(DEFAULT_BAN) | set(qc.get("ban", [])) | {t for t in a.ban.split(",") if t}
    expect = set(qc.get("expect", []))
    sess, names, cats = load()
    flagged = 0
    for p in files(a.paths):
        t = tags_for(sess, names, cats, p, a.threshold)
        hits = sorted(b for b in ban if b in t)
        missing = sorted(e for e in expect if e not in t)
        line = os.path.basename(p)
        if hits or missing:
            flagged += 1
            line += "  FLAG " + " ".join(f"{h}({t[h]:.2f})" for h in hits) + (" missing:" + ",".join(missing) if missing else "")
        print(line)
        if a.show:
            print("   ", ", ".join(f"{k}" for k, v in sorted(t.items(), key=lambda kv: -kv[1])))
    print(f"{flagged} flagged")


if __name__ == "__main__":
    main()
