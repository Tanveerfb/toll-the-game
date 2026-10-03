# Status — 2026-10-03 (cloud)

**Who updates this:** every checkpoint, by **rewriting** it, never appending
(`project-rules.md` §2; his call, `decisions.md` 2026-09-27). It holds the
current position only. A session's log goes to
`docs/archive/STATUS-YYYY-MM.md` with a line in
[`docs/archive/README.md`](archive/README.md). Issues are in
[`issues.md`](issues.md), phases and the not-built list in
[`ROADMAP.md`](ROADMAP.md), and accounts in [`environment.md`](environment.md).

## Start here

**State:** each unit with tile art now shows one image everywhere (ruling
#173):
- Lyra's and Sara's portraits are transparent crops of their tiles'
  cut-outs.
- The detail page puts every portrait on its element burst.
- The team picker's slots and roster dialog use the archive tile.

He is working **from cloud sessions** for a while, so no ComfyUI: UI and
implementation work only. This session's log is the 2026-10-03 (cloud) entry
in `docs/archive/STATUS-2026-10.md`.

**Next:** his next batch, which he has not named yet.

**Blocked on him:**
- Whether this checkpoint is committed. He said not to push yet.
- Which character goes through `charart` next, at his PC.
- Caila's design sheet.
- Sara's design sheet in `toll-kits` still describes a cat-ear hood. Her v2
  lock dropped the ears and set grey-white high-tops. The sheet is his to
  update.
- Carried over: the new card texts (kitwords EXAMPLES, Open); Lyra's C4 and
  passive placement (D5); Roused; the Orders tile; the app-icon recolour; the
  foundation audit; scheduling the folder migration.

**Don't trust:**
- **`npm run test:browser` fails as-is in the cloud container.** Playwright
  wants Chromium headless_shell 1234; `/opt/pw-browsers` has 1194. It passed
  (17/17) only through a scratchpad symlink.
- Desktop widths of the picker and the detail page were not looked at.

## Where things are

| What | Where |
| --- | --- |
| Character-art method (current) | `docs/CHARACTER_ART.md`, walked by the `charart` skill |
| The tile ↔ portrait rule | Ruling #173; `CHARACTER_ART.md` step 6; `scripts/skill_art/make_portrait_crop.py` |
| Shared tile face | `components/game/UnitTileFace.tsx` (archive `RosterTile`, `TeamPicker`) |
| Element hue and code | `lib/game/elementStyle.ts` |
| Crop numbers per unit | `scripts/lora/characters/lyra.json` `portrait`, `sara_v2.json` `portrait_recut` |
| Portrait sources | `public/characters/red_lyra/cards/pose-c4.png`, `red_sara/cards/card-b-cutout.webp` |
| This session's mockup | `docs/design/mockups/lyra-portrait.html` |
| Fleet skills for cloud sessions | `.claude/skills/checkpoint`, `.claude/skills/relay` (masters are his user-level copies) |
| LoRAs, locked art, references | ComfyUI on his PC (see `docs/CHARACTER_ART.md`) |

## Confidence and gaps

### Verified on 2026-10-03 (cloud), by running it

- `npm run check`: **1,524 passed / 125 files**, typecheck and lint clean.
  This includes the new opaque-portrait guard, which was proved red first.
- At 390×844 on a scratch dev server:
  - Lyra's and Sara's detail pages show the burst.
  - The team picker's slots and roster dialog show the tiles; red Lyra
    breaks out of hers.
  - A 3v3 battle with both of them.
  - No sideways scroll on any of these.
- The scratch server is stopped, `.next-verify` removed, and `tsconfig.json`
  restored.

### Not verified

- Desktop widths of the picker and the detail page. The archive after the
  face refactor was not pixel-diffed, though its geometry is unchanged.
- Sara or Lyra on the **enemy** side of a battle, where the ground is dark.
  Sara's hood edge may be faint there (`ART_REQUESTS.md` D6).
- Both new portraits are a plain Lanczos upscale (2.23x and 1.97x), so they
  are slightly soft. The 4x redo is D6.

### Recorded as Claude's reading, not his words

- A tile unit's portrait must be **RGBA** (the test's proxy for "cut from the
  tile's cut-out"). The rule is his; the byte-25 check is Claude's.
- The picked ring is a yellow bevel, not the mockup's outline (the frame's
  clip-path cuts an outline off).

## Outside the repo

- **Uncommitted at this checkpoint, unless he says otherwise.** The cloud
  container is ephemeral, so uncommitted work is lost if it is reclaimed.
- **`toll-kits`:** untouched this session.
- **ComfyUI:** not reachable from cloud sessions.
