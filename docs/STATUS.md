# Status — 2026-10-03

**Who updates this:** every checkpoint, by **rewriting** it, never appending
(`project-rules.md` §2; his call, `decisions.md` 2026-09-27). It holds the
current position only. A session's log goes to
`docs/archive/STATUS-YYYY-MM.md` with a line in
[`docs/archive/README.md`](archive/README.md). Issues are in
[`issues.md`](issues.md), phases and the not-built list in
[`ROADMAP.md`](ROADMAP.md), and accounts in [`environment.md`](environment.md).

## Start here

**State:** Sara is the first unit through the new character-art pipeline, end
to end.
- **Her kit is renamed, names only:** *Beloved of Cats*, *Adaptation*,
  *Swarm*, *Apex*, *Protection of the Felines*.
- **Her new art is installed:** three skill arts, the park-sunset card, and a
  portrait cropped from it.
- **The archive uses the "Ink burst" frame-break tile** (ruling #172). Lyra
  and Sara break out of their frames.
- **The three exam-arc units are still unreleased** (#171).
- **Last checkpoint:** `git log -1`. This session's log is in
  `docs/archive/STATUS-2026-10.md`.

**Next:** his pick. Either run `charart` for the next character (step 0,
design lock: blue Lyra, Caila or green Duke, the release gate), or look at
Sara's new art in a battle.

**Blocked on him:**
- Which character goes through the pipeline next.
- Caila's design sheet.
- Whether to install Playwright's Chromium so `npm run test:browser` can run.
- Sara's design sheet in `toll-kits` still describes a cat-ear hood. Her v2
  lock dropped the ears and set grey-white high-tops. The sheet is his to
  update.
- Carried over: the new card texts (kitwords EXAMPLES, Open); Lyra's C4 and
  passive placement (D5); Roused; the Orders tile; the app-icon recolour; the
  foundation audit; scheduling the folder migration.

**Don't trust:**
- Sara's skill art has not been seen in a battle. Her portrait has not been
  seen on any screen; the archive now shows her break-out cut-out instead.
- `test:browser` was not run.
- Nothing from 2026-10-02 (the exam-arc units, Freeze, [Cold]) has been
  looked at in a browser either.

## Where things are

| What | Where |
| --- | --- |
| Character-art method (current) | `docs/CHARACTER_ART.md`, walked by the `charart` skill |
| Its history and failures | `docs/archive/ART_PIPELINE-character-history.md` |
| Non-character art (banners, icons, logos, coins) | `docs/ART_PIPELINE.md` |
| Sara's lock, approvals, picks, prompting rules | `scripts/lora/characters/sara_v2.json` (v1: `sara.json`) |
| Sara's locked art, staged, and her library | ComfyUI `output\red_sara\locked\`, `output\sara_library\` |
| LoRAs | ComfyUI `models\loras\lyra_toll`, `sara_toll` (v2, step 1500); fallbacks in `models\loras\training\` |
| References (7DSGC, Dokkan) | ComfyUI `output\references\`, indexed by `README.md` |
| Pose tool | `scripts/pose/` (Blender 5.0.1 at `D:\Blender`) |
| Archive tile | `components/game/RosterTile.tsx`, `tile-*` in `styles/globals.css`, `getTileArt` |

## Confidence and gaps

### Verified on 2026-10-03, by running it

- `npm run check`: **1,523 passed / 125 files**, typecheck and lint clean.
  The new test checks that every break-out cut-out exists.
- A scratch production build passed (`.next-verify` removed, `tsconfig.json`
  restored).
- **The archive tile at 390×844, on the scratch dev server:**
  - Lyra and Sara break out of their frames.
  - Older units sit flat in theirs.
  - Level plates and ult-level stars are correct (1 to 6).
  - No sideways scroll.
- Sara's rename: no old name remains outside history (battle logs, ledger,
  archive).
- Every composite, the card and the portrait were checked by eye. The ankle
  transparency he found is fixed.

### Not verified

- `npm run test:browser`: Playwright's Chromium is not installed.
- Sara's new art in battle, and on the detail page.
- The archive tile on desktop widths (4 to 6 columns), and the NPC index's
  tile.

### Recorded as Claude's reading, not his words

- The tile drops the name and the HP/ATK/DEF bars, Dokkan style (#172).
- The passive composite has a neutral dusk background. It went to the
  library, so nothing ships with it.

### What I would check first coming back cold

1. `git status` and `git log -3`.
2. `npm run dev` on his PC: open `/archive` and Sara's detail page, then field
   her in practice to see Adaptation, Swarm and Apex.
3. Read `docs/CHARACTER_ART.md` before any art work, and ledger #172 before
   touching the tile.

## Outside the repo

- **`toll-kits`:** clean on main. It picks up Sara's rename on its next sync.
- **The story repo `element-clash-toll`** (`E:\Toll - Web toon`): its master
  is 1 commit behind origin, because his story session pushed. Its unmerged
  branch `claude/pensive-brahmagupta-8yv4rd` is untouched.
- **ComfyUI:** this session started it detached. It stops when the PC
  restarts. Start it with PowerShell `Start-Process` (see
  `docs/CHARACTER_ART.md`).
