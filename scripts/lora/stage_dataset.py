"""Step 3: stage the images he approved into a training dataset.

Manifest: one line per image, `<path>\t<variable caption>` (framing, pose,
expression only; hair, eyes and outfit are left out so the trigger absorbs
them). Images are flattened onto white.
Usage: stage_dataset.py <id> <manifest.tsv> [--sentences] [--name <dataset>]

Captions are SDXL tags by default: `<trigger>, 1girl, solo, <variable>, white background`.
`--sentences` writes them for FLUX.2 klein, whose text encoder reads prose:
`<trigger>, a woman, <variable>, on a plain white background.` (2026-10-14).
`--name` overrides the profile's `dataset_name`.
"""
import os
import sys
from PIL import Image
from common import TRAINING, profile

args = [a for a in sys.argv[1:] if a != "--sentences"]
sentences = "--sentences" in sys.argv
name = None
if "--name" in args:
    i = args.index("--name")
    name = args[i + 1]
    args = args[:i] + args[i + 2:]
p = profile(args[0])
male = "1boy" in p["identity"]
dst = os.path.join(TRAINING, "datasets", name or p.get("dataset_name", f"{p['id']}_v1"))
os.makedirs(dst, exist_ok=True)
assert not os.listdir(dst), f"{dst} is not empty"
n = 0
for line in open(args[1], encoding="utf-8"):
    if not line.strip():
        continue
    path, caption = line.rstrip("\n").split("\t")
    im = Image.open(path).convert("RGBA")
    base = Image.new("RGBA", im.size, (255, 255, 255, 255))
    base.alpha_composite(im)
    n += 1
    stem = f"{p['id']}_{n:02d}"
    base.convert("RGB").save(os.path.join(dst, stem + ".png"))
    if sentences:
        text = f"{p['trigger']}, {'a man' if male else 'a woman'}, {caption}, on a plain white background."
    else:
        text = f"{p['trigger']}, {'1boy' if male else '1girl'}, solo, {caption}, white background"
    with open(os.path.join(dst, stem + ".txt"), "w", encoding="utf-8") as c:
        c.write(text)
print("staged", n, "into", dst)
