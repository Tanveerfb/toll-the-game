"""Turn a generated emblem into an app icon.

Run:  python scripts/make_app_icon.py <cutout.png> public/icons/app-icon.png

WHY THIS IS A SCRIPT AND NOT A PROMPT
-------------------------------------
`docs/ART_PIPELINE.md` settled this twice already, and both lessons apply here:

  * "Frame the icon in post, not in the prompt." Weighting "filling the frame"
    higher does not make the object bigger — it makes Animagine produce macro
    abstraction (a gold coin became a gold ribbon). Prompt calmly, then crop to
    the alpha bounding box and pad to a fixed margin.
  * The five coin frames are drawn by PIL rather than rolled, because a txt2img
    roll "gives a slightly off-centre, slightly elliptical ring every time and
    the compositor cannot rely on it."

An app icon needs both of those guarantees and one more that no roll can give:
**maskable safety**. Android crops the icon to a circle, a squircle or a rounded
square depending on the launcher, so anything meaningful has to sit inside the
middle 80%. That is arithmetic, not art direction.

WHAT IT DOES
------------
1. Crop the cutout to its alpha bounding box, so framing is identical no matter
   how the model composed the shot.
2. Scale the emblem to occupy a fixed share of the SAFE ZONE (the middle 80%),
   never of the full canvas — this is the difference between an icon that
   survives a circular crop and one that loses its edges.
3. Composite onto an opaque Combat Terminal ground. Opaque on purpose: a
   transparent app icon renders on whatever the launcher picks, usually white,
   and this game's identity is its near-black ground.
4. Write 512x512 PNG.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

# styles/globals.css — --color-void, --color-edge-strong, --color-signal.
VOID = (6, 9, 12, 255)
EDGE_STRONG = (49, 89, 107, 255)

CANVAS = 512
# Supersample, then downscale once at the end. Compositing at final size makes
# every edge in the mark a jagged one at 48px, which is the size that matters.
SUPERSAMPLE = 4

# Fraction of the canvas that survives every launcher's mask. Android's
# maskable spec is a 80% safe zone; treat the outer 10% per edge as croppable.
SAFE_ZONE = 0.80
# How much of that safe zone the emblem fills. Not 1.0: an icon whose art
# touches the safe-zone edge reads as cramped next to every other icon on the
# home screen, which all carry their own optical padding.
FILL = 0.86


def build(source: Path, out: Path) -> None:
    work = CANVAS * SUPERSAMPLE
    emblem = Image.open(source).convert("RGBA")

    # 1. Crop to what is actually drawn. A cutout's canvas position is wherever
    #    the model happened to compose; its alpha box is the real subject.
    box = emblem.getbbox()
    if box is None:
        raise SystemExit(f"{source} is fully transparent — nothing to place.")
    emblem = emblem.crop(box)

    # 2. Fit inside the safe zone, preserving aspect. The longest side governs,
    #    so a tall emblem and a wide one end up with the same visual weight.
    limit = int(work * SAFE_ZONE * FILL)
    scale = min(limit / emblem.width, limit / emblem.height)
    emblem = emblem.resize(
        (max(1, round(emblem.width * scale)), max(1, round(emblem.height * scale))),
        Image.LANCZOS,
    )

    # 3. Opaque ground, with a hairline that stays inside the safe zone so a
    #    circular crop cannot slice it off mid-stroke.
    canvas = Image.new("RGBA", (work, work), VOID)
    inset = int(work * (1 - SAFE_ZONE) / 2)
    ring = Image.new("RGBA", (work, work), (0, 0, 0, 0))
    from PIL import ImageDraw

    ImageDraw.Draw(ring).rounded_rectangle(
        [inset, inset, work - inset, work - inset],
        radius=int(work * 0.10),
        outline=EDGE_STRONG,
        width=max(1, int(work * 0.006)),
    )
    canvas.alpha_composite(ring)

    # Centred by arithmetic rather than by eye — see the coin-frame note above.
    canvas.alpha_composite(
        emblem,
        ((work - emblem.width) // 2, (work - emblem.height) // 2),
    )

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.resize((CANVAS, CANVAS), Image.LANCZOS).convert("RGB").save(out, "PNG")
    print(f"wrote {out} ({CANVAS}x{CANVAS}, opaque)")


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    build(Path(sys.argv[1]), Path(sys.argv[2]))


if __name__ == "__main__":
    main()
