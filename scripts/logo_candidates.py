"""Draw app-icon candidates, and a contact sheet to choose from.

Run:  python scripts/logo_candidates.py <out_dir>

WHY DRAWN, NOT GENERATED
------------------------
Two ComfyUI sessions' worth of evidence, recorded in `docs/ART_PIPELINE.md`:

  * Animagine is an anime **character** model. Asked for an emblem, a badge, a
    medallion or a crest it returns an **item sheet** — a scatter of twenty
    small objects, usually with a stray hand. That is the same failure the
    inventory-icon pass hit with "game item icon", and it is a property of the
    model, not of the adjectives.
  * The five coin frames are drawn by PIL for exactly this reason: a roll
    "gives a slightly off-centre, slightly elliptical ring every time and the
    compositor cannot rely on it."

An app icon has to be crisp at 48px, geometrically centred, and safe inside an
80% maskable crop. All three are arithmetic. So these are drawn.

WHAT THIS IS NOT
----------------
**Not a decision.** `docs/ART_REQUESTS.md` D1 says what the mark depicts is
Tanveer's call and must not be invented. These are candidates to react to — each
one is a different reading of the same two facts about the game (it is named for
a *toll*, and its subject is an *element clash*), so rejecting all five is a
useful answer too.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

# styles/globals.css
VOID = (6, 9, 12, 255)
SIGNAL = (79, 211, 232, 255)
EDGE_STRONG = (49, 89, 107, 255)
READOUT = (203, 216, 226, 255)
EL_RED = (255, 90, 78, 255)
EL_BLUE = (55, 166, 255, 255)
EL_GREEN = (53, 212, 139, 255)
EL_LIGHT = (232, 209, 116, 255)
EL_DARK = (168, 116, 255, 255)

SIZE = 512
SS = 4  # supersample; every edge here is a diagonal at 48px
W = SIZE * SS
SAFE = 0.80  # maskable safe zone — the outer 10% per edge may be cropped away


def canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (W, W), VOID)
    return img, ImageDraw.Draw(img)


def finish(img: Image.Image, out: Path, name: str) -> Path:
    path = out / f"{name}.png"
    img.resize((SIZE, SIZE), Image.LANCZOS).convert("RGB").save(path, "PNG")
    return path


def gate(out: Path) -> Path:
    """A. The toll gate. The most literal reading of the name — a barrier you
    must pay to pass. Strongest silhouette of the five at small size."""
    img, d = canvas()
    c = W / 2
    span = W * SAFE * 0.82
    left, right = c - span / 2, c + span / 2
    top, bottom = c - span * 0.46, c + span * 0.46
    post = span * 0.17

    # Two posts.
    d.rectangle([left, top, left + post, bottom], fill=SIGNAL)
    d.rectangle([right - post, top, right, bottom], fill=SIGNAL)
    # The barrier, lowered across the opening — the whole point of a toll.
    bar_h = span * 0.15
    d.rectangle([left, c - bar_h / 2, right, c + bar_h / 2], fill=EL_LIGHT)
    # A lintel, so the mark reads as a gateway rather than as two bars.
    d.rectangle([left, top, right, top + post * 0.72], fill=SIGNAL)
    return finish(img, out, "A_gate")


def fracture(out: Path) -> Path:
    """B. The clash. One shield split by a fault line, the two halves in
    opposing element hues — the collision the game is named for."""
    img, d = canvas()
    c = W / 2
    r = W * SAFE * 0.44

    shield = [
        (c, c - r),
        (c + r * 0.86, c - r * 0.45),
        (c + r * 0.72, c + r * 0.52),
        (c, c + r),
        (c - r * 0.72, c + r * 0.52),
        (c - r * 0.86, c - r * 0.45),
    ]
    d.polygon(shield, fill=EDGE_STRONG)

    # The fracture runs corner to corner, offset so it never reads as a fold.
    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).polygon(
        [(c - r * 1.2, c - r * 1.2), (c + r * 0.28, c - r * 1.2),
         (c - r * 0.28, c + r * 1.2), (c - r * 1.2, c + r * 1.2)],
        fill=255,
    )
    half = Image.new("RGBA", (W, W), SIGNAL)
    shield_mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(shield_mask).polygon(shield, fill=255)
    mask = Image.composite(mask, Image.new("L", (W, W), 0), shield_mask)
    img.paste(half, (0, 0), mask)

    # A hairline down the fault so the two halves separate at 48px.
    d.line([(c + r * 0.28, c - r * 1.2), (c - r * 0.28, c + r * 1.2)],
           fill=VOID, width=int(W * 0.018))
    return finish(img, out, "B_fracture")


def coin(out: Path, name: str = "C_coin") -> Path:
    """C. The toll itself — a gate standing inside a coin. **The chosen mark.**

    Round, so every launcher mask (circle, squircle, rounded square) takes
    nothing from it. And it says the game's name in one shape: a coin is a
    payment, a gate with a bar down is a road you cannot pass, and the toll is
    the thing that connects them.

    Two revisions got it there, both figure-ground problems that only show up
    small:

    * Two concentric rings moiréd at 48px. One ring now.
    * **The gate was cut OUT of a cyan face, which made the dark shape the
      figure — so it read as a padlock.** Inverted: dark face, cyan gate. The
      arch is now the thing you see, and at 32px it still reads as an arch
      rather than collapsing into a blob.
    """
    img, d = canvas()
    c = W / 2
    r = W * SAFE * 0.46

    d.ellipse([c - r, c - r, c + r, c + r], fill=SIGNAL)
    d.ellipse([c - r * 0.86, c - r * 0.86, c + r * 0.86, c + r * 0.86], fill=VOID)

    # A true arch — semicircular head on straight legs. The first draft used a
    # stadium shape, which read as a keyhole.
    aw, ah = r * 0.66, r * 0.92
    lx, rx = c - aw / 2, c + aw / 2
    head_top = c - ah / 2
    d.pieslice([lx, head_top, rx, head_top + aw], 180, 360, fill=SIGNAL)
    d.rectangle([lx, head_top + aw / 2, rx, c + ah / 2], fill=SIGNAL)

    # The barrier across the opening — the toll, and the only element accent.
    # It overhangs the legs both sides so it reads as a pole laid across the
    # gate rather than a shelf sitting inside it.
    bar_h = ah * 0.15
    d.rectangle([lx - aw * 0.22, c + ah * 0.02, rx + aw * 0.22, c + ah * 0.02 + bar_h],
                fill=EL_LIGHT)
    return finish(img, out, name)


def prism(out: Path) -> Path:
    """D. Five elements, one stone. The clash as a single faceted shape rather
    than five separate ones — the version that survives being 48px."""
    img, d = canvas()
    c = W / 2
    r = W * SAFE * 0.46

    top = (c, c - r)
    bottom = (c, c + r)
    lu, ru = (c - r * 0.80, c - r * 0.30), (c + r * 0.80, c - r * 0.30)
    ld, rd = (c - r * 0.80, c + r * 0.30), (c + r * 0.80, c + r * 0.30)

    d.polygon([top, ru, (c, c)], fill=EL_RED)
    d.polygon([ru, rd, (c, c)], fill=EL_LIGHT)
    d.polygon([rd, bottom, (c, c)], fill=EL_GREEN)
    d.polygon([bottom, ld, (c, c)], fill=EL_BLUE)
    d.polygon([ld, lu, (c, c)], fill=EL_DARK)
    d.polygon([lu, top, (c, c)], fill=SIGNAL)

    # Facet lines in the ground colour keep the wedges legible when the icon is
    # shrunk and the hues start to blend into one another.
    for p in (top, ru, rd, bottom, ld, lu):
        d.line([(c, c), p], fill=VOID, width=int(W * 0.012))
    return finish(img, out, "D_prism")


def monogram(out: Path) -> Path:
    """E. The letter, done properly — a T whose crossbar is the barrier.
    The safe answer, and the one that needs no explanation at 48px."""
    img, d = canvas()
    c = W / 2
    span = W * SAFE * 0.74
    stroke = span * 0.22

    d.rectangle([c - span / 2, c - span / 2, c + span / 2, c - span / 2 + stroke],
                fill=SIGNAL)
    d.rectangle([c - stroke / 2, c - span / 2, c + stroke / 2, c + span / 2],
                fill=SIGNAL)
    # The crossbar carries the toll stripe, so the letter is also a barrier.
    d.rectangle([c - span / 2, c - span / 2 + stroke * 0.34,
                 c + span / 2, c - span / 2 + stroke * 0.66], fill=VOID)
    return finish(img, out, "E_monogram")


def contact_sheet(paths: list[Path], out: Path) -> Path:
    """Every candidate at 512, 96 and 48, because the only size that matters is
    the one nobody checks until the icon is on a phone."""
    sizes = [256, 96, 48]
    pad, label = 28, 34
    row_h = max(sizes) + pad * 2 + label
    sheet = Image.new("RGB", (pad + (256 + pad) * len(paths), row_h * 2), (6, 9, 12))
    draw = ImageDraw.Draw(sheet)

    for i, p in enumerate(paths):
        src = Image.open(p).convert("RGB")
        x = pad + (256 + pad) * i
        draw.text((x, 8), p.stem, fill=(203, 216, 226))
        sheet.paste(src.resize((256, 256), Image.LANCZOS), (x, 8 + label))
        # The small sizes, side by side under each candidate.
        y = 8 + label + 256 + pad
        for s in sizes[1:]:
            sheet.paste(src.resize((s, s), Image.LANCZOS), (x, y))
            x += s + 12

    path = out / "_contact_sheet.png"
    sheet.save(path, "PNG")
    return path


def ship() -> None:
    """Write the chosen mark to the two places the app reads it from.

    Both files are the same image. Next serves `app/icon.png` as the favicon
    automatically by filename convention, while the manifest needs a stable
    public path — a generated route's URL carries a build hash, and an
    installed home-screen icon should not change URL on every deploy.
    """
    repo = Path(__file__).resolve().parent.parent
    public = repo / "public" / "icons"
    public.mkdir(parents=True, exist_ok=True)

    coin(public, "app-icon")
    (repo / "app" / "icon.png").write_bytes((public / "app-icon.png").read_bytes())
    print(f"  {public / 'app-icon.png'}")
    print(f"  {repo / 'app' / 'icon.png'}")


def main() -> None:
    if "--ship" in sys.argv:
        ship()
        return

    out = Path(sys.argv[1] if len(sys.argv) > 1 else "icon-candidates")
    out.mkdir(parents=True, exist_ok=True)
    paths = [gate(out), fracture(out), coin(out), prism(out), monogram(out)]
    sheet = contact_sheet(paths, out)
    for p in paths:
        print(f"  {p}")
    print(f"\ncontact sheet: {sheet}")


if __name__ == "__main__":
    main()
