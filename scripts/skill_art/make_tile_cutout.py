"""Archive tile cut-out for the frame-break tile (his pick, 2026-10-03: "Ink burst").

A unit breaks out of its archive frame only when it has new-pipeline art with a clean cut-out (Sara, Lyra);
older portraits sit flat in the frame (his call: "don't try too hard with them"). The file is a transparent
crop: a square WINDOW (what shows inside the frame) plus HEADROOM above it (what breaks out). Its height /
width ratio is registered in lib/game/characterArt.ts (TILE_ART), which the tile uses to place it.

Usage: make_tile_cutout.py <rgba_cutout.png> <out.webp> <x0> <y0> <side> <top>
  window = (x0, y0) to (x0+side, y0+side) in the cut-out's pixels; headroom starts at y=top (<= y0).
Writes a 480px-wide WebP and prints the ratio to register.
"""
import sys
from PIL import Image

src, out, x0, y0, side, top = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:7])
im = Image.open(src).convert("RGBA")
crop = im.crop((x0, top, x0 + side, y0 + side))
crop = crop.resize((480, round(480 * crop.height / crop.width)), Image.LANCZOS)
crop.save(out, "WEBP", quality=88, method=6)
print(f"{out}  ratio {crop.height / crop.width:.3f}")
