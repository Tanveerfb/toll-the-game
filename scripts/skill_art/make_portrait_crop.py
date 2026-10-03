"""Portrait from a character's transparent cut-out (his call, 2026-10-03).

A unit with archive tile art (TILE_ART in lib/game/characterArt.ts) must have a portrait cut from the SAME
cut-out as its tile, so the archive, the detail page, the battle and the team picker all show one image. The
portrait keeps the cut-out's transparency: the detail page lays it on the element burst, the battle on its own
dark ground. Record the numbers in the character's scripts/lora/characters/<id>.json so a recrop from a sharper
source reuses the framing.

Usage: make_portrait_crop.py <rgba_cutout> <out.png> <x0> <y0> <side>
  window = (x0, y0) to (x0+side, y0+side) in the cut-out's pixels, resized to 1024x1024.
"""
import sys
from PIL import Image

src, out, x0, y0, side = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:6])
im = Image.open(src).convert("RGBA")
crop = im.crop((x0, y0, x0 + side, y0 + side)).resize((1024, 1024), Image.LANCZOS)
crop.save(out, "PNG", optimize=True)
print(f"{out}  from {side}px, upscale {1024 / side:.2f}x")
