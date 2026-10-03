"""Step 3: stage the images he approved into a training dataset.

Manifest: one line per image, `<path>\t<variable caption>` (framing, pose,
expression only; hair, eyes and outfit are left out so the trigger absorbs
them). Images are flattened onto white.
Usage: stage_dataset.py <id> <manifest.tsv>
"""
import os
import sys
from PIL import Image
from common import TRAINING, profile

p = profile(sys.argv[1])
subject = "1boy" if "1boy" in p["identity"] else "1girl"
dst = os.path.join(TRAINING, "datasets", p.get("dataset_name", f"{p['id']}_v1"))
os.makedirs(dst, exist_ok=True)
assert not os.listdir(dst), f"{dst} is not empty"
n = 0
for line in open(sys.argv[2], encoding="utf-8"):
    if not line.strip():
        continue
    path, caption = line.rstrip("\n").split("\t")
    im = Image.open(path).convert("RGBA")
    base = Image.new("RGBA", im.size, (255, 255, 255, 255))
    base.alpha_composite(im)
    n += 1
    stem = f"{p['id']}_{n:02d}"
    base.convert("RGB").save(os.path.join(dst, stem + ".png"))
    with open(os.path.join(dst, stem + ".txt"), "w", encoding="utf-8") as c:
        c.write(f"{p['trigger']}, {subject}, solo, {caption}, white background")
print("staged", n, "into", dst)
