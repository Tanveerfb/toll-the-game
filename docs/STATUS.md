# Status — 2026-10-03 (cloud, part 2)

**Who updates this:** every checkpoint, by **rewriting** it, never appending
(`project-rules.md` §2; his call, `decisions.md` 2026-09-27). It holds the
current position only. A session's log goes to
`docs/archive/STATUS-YYYY-MM.md` with a line in
[`docs/archive/README.md`](archive/README.md). Issues are in
[`issues.md`](issues.md), phases and the not-built list in
[`ROADMAP.md`](ROADMAP.md), and accounts in [`environment.md`](environment.md).

## Start here

**State:**
- **The summon screen is a manga page** (ruling #174). The draw panel sits
  above the tab bar, Featured and Milestone open sheets, and results show
  units as tiles with materials grouped.
- **Each tile unit shows one image everywhere** (#173).
- He is in **cloud sessions** for a while, so no ComfyUI: UI and
  implementation work only.

This session's log is the two 2026-10-03 (cloud) entries in
`docs/archive/STATUS-2026-10.md`.

**Next:** his next batch, not named yet.

**Blocked on him:**
- Which character goes through `charart` next, at his PC.
- Caila's design sheet.
- Sara's design sheet in `toll-kits` still describes a cat-ear hood. Her v2
  lock dropped the ears and set grey-white high-tops. The sheet is his to
  update.
- Carried over: the new card texts (kitwords EXAMPLES, Open); Lyra's C4 and
  passive placement (D5); Roused; the Orders tile; the app-icon recolour; the
  foundation audit; scheduling the folder migration.
- Deferred by him: summon animations and summon art, until every kit has its
  art (#174).

**Don't trust:**
- **`npm run test:browser` fails as-is in the cloud container.** Playwright
  wants Chromium headless_shell 1234; `/opt/pw-browsers` has 1194. It passes
  only with a scratch `PLAYWRIGHT_BROWSERS_PATH` holding symlinks named
  `chromium_headless_shell-1234` and `chromium-1234` that point at the 1194
  builds.
- Claiming a milestone reward and a duplicate's "+1 coin" plate were not seen
  on screen.

## Where things are

| What | Where |
| --- | --- |
| Summon screen | `components/gacha/BannerScreen.tsx`, `PanelSheet`, `FeaturedSheet`, `MilestoneSheet`, `PullReveal`; `lib/gacha/resultSummary.ts` |
| Its mockup | `docs/design/mockups/gacha-overhaul.html` (he picked C) |
| Manga-page utilities | `panel-cut-*`, `ink-burst`, `speed-rays` in `styles/globals.css`; the exception in `docs/design-system.md` |
| Shared tile face | `components/game/UnitTileFace.tsx` (archive, team picker, summon) |
| Element hue, code and name | `lib/game/elementStyle.ts` |
| The tile ↔ portrait rule | Ruling #173; `docs/CHARACTER_ART.md` step 6; `scripts/skill_art/make_portrait_crop.py` |
| Crop numbers per unit | `scripts/lora/characters/lyra.json` (`portrait`, `tile`), `sara_v2.json` `portrait_recut` |
| Fleet skills for cloud sessions | `.claude/skills/checkpoint`, `.claude/skills/relay` (masters are his user-level copies) |
| LoRAs, locked art, references | ComfyUI on his PC (see `docs/CHARACTER_ART.md`) |

## Confidence and gaps

### Verified on 2026-10-03 (cloud), by running it

- `npm run check`: **1,527 passed / 126 files**, typecheck and lint clean.
- **The summon screen at 390×844, 390×667 and 1440×900:**
  - No page scroll at any size.
  - Draw ×11 sits in the bottom sixth on both phones.
  - Driven: the featured sheet, the milestone sheet, and a real 11-pull with
    two new units.
- The detail page's element tag, at 390. Lyra's cropped tile in the archive,
  at 390 and 1440.
- Every scratch server was stopped, `.next-verify` removed, and
  `tsconfig.json` restored.

### Not verified

- Claiming a milestone reward (the code is unchanged); a duplicate's results
  tile.
- Sara or Lyra on the dark **enemy** side of a battle (`ART_REQUESTS.md` D6).
- Both transparent portraits are a plain Lanczos upscale, so slightly soft
  (D6).

### Recorded as Claude's reading, not his words

- That the summon screen is the design system's *one* loud exception (#174).
- A tile unit's portrait must be RGBA (the test's proxy for #173).

## Outside the repo

- **`toll-kits`:** untouched this session.
- **ComfyUI:** not reachable from cloud sessions.
