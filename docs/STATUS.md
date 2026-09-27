# Status — 2026-09-27

**Who updates this:** every checkpoint, by **rewriting** it, never appending
(`project-rules.md` §2; his call, `decisions.md` 2026-09-27). It holds the
current position only. A session's log goes to
`docs/archive/STATUS-YYYY-MM.md` with a line in
[`docs/archive/README.md`](archive/README.md). Issues are in
[`issues.md`](issues.md), phases and the not-built list in
[`ROADMAP.md`](ROADMAP.md), and accounts in [`environment.md`](environment.md).

## Start here

**State:** Shōnen Ink is on every screen, and Combat Terminal is deleted
(phase 5; `tests/uiTokens.test.ts` keeps it out). The battle is a split page
(#156). Bureau Orders are closed for an overhaul (#159). The trial's Molvarr
is the difficulty-1 boss (#158). The repo was audited against the fleet
standard: see [`conventions.md`](../conventions.md) and
[`decisions.md`](../decisions.md). Last checkpoint: the commit after
`957d18e`, "Retire Combat Terminal, close Bureau Orders, adopt the fleet
standard" (`git log -1`).

**Next: the ComfyUI session, once he has compacted this conversation and
comes back** (2026-09-27: *"we'll actually do the comfy session now uh, but
uh, that would be after I come back to you"*, then *"after i compact you"*).
In order:
1. **Set up a trainer.** `accelerate` is installed, but nothing trains yet:
   no training node pack, and `train_doctor` reports no Docker and no native
   ai-toolkit. `train_doctor action:"bootstrap"` is the no-Docker route
   (~10 min). It must train against Animagine (SDXL), not the FLUX default.
   Details in `docs/ART_PIPELINE.md`, "Still open".
2. **Lyra's C4 collar**, `docs/ART_REQUESTS.md` entry **D5**: recolour or
   mask-inpaint the collar crimson on the approved render; never re-roll.
3. **Per-character LoRA** for face identity. **Every training image needs
   his approval before it enters a dataset** (an unapproved Duke set failed).

`get_system_stats action:"health"` before anything. ComfyUI is Claude's to
drive; bring him images and decisions, filtered first.

**After that:** a mobile pass on the battle screen's components, which he
asked for the same day (*"especially in the battle ... UI screen that need
the touch and optimization for mobile"*), one screen per `mobilecheck` run.
His battle **flow** changes are separate and wait for him (`ROADMAP.md`).

**Blocked on him:**
- Building the name **Roused** for Molvarr's second phase (a heading on phase
  2 in `molvarr.json`, which is his file).
- Where the closed Orders tile sits: it leads the home screen today.
- Recolouring the app icon, which is still in the old void and cyan.
- The foundation audit's next section (`Plans/2026-09-26-foundation-audit.md`).
- Scheduling the folder migration and the sentence-case change
  (`conventions.md`, both his picks and both queued).

**Don't trust:** taste on any screen, which is his. See **Confidence and gaps**.

## Confidence and gaps

Rewritten every checkpoint. **This section is what stops the rest of the
docs being read as uniformly solid.**

### Verified on 2026-09-27, by running it

- `npm run check`: **1,478 passed, 0 skipped / 124 files**, typecheck and
  lint clean. The count fell from 1,521 because `uiTokens` swapped 54
  per-file cases for 10 tree-wide guards.
- `npm run test:browser`: **17 / 3 files**. A production build to
  `.next-verify` is clean.
- **Guards falsified:** the legacy-token, font-size and raw-hex guards went
  red on a planted component plus the old `globals.css`. The closed-orders
  store test went red with its check removed.
- **Trial tuning at difficulty-1 Molvarr:** 98.3% / 93.3% / 98.3% on seeds
  11 / 23 / 37 (Lv20 balanced team, 60 runs each); a level-1 team still fails.
- **Home at 375px:** the Orders tile reads "Being overhauled…", no Orders
  control remains, and nothing scrolls sideways.
- **Earlier the same day:** a live 4v4 at 390×844 and the character page at
  390 and 1280 (archive log for 2026-09-27).
- **toll-kits:** the heredoc hook blocks a `<<` command (exit 2) and passes
  `ls` (exit 0); pushed as `9d1f51d`.

### Believed but NOT verified

- **Taste** on every screen. He reported the design and font *"looks good on
  the phone now"*; that is his pass, not a measurement.
- **Not seen on screen:** the ultimate cut-in, the phase-break banner and a
  Victory card.
- **Not opened:** the signed-in profile page and its dialogs; the sign-in page
  without its Orders perk.
- **Training:** `accelerate` imports with CUDA, but no trainer is set up
  (`docs/ART_PIPELINE.md`).

### Untested by anything

- A reload **between** two trial fights still loses the run (a gap in #153).
- `worldBossPreview.ts` and `immunity.ts` have no test.
- No screen flow is tested (audit S2).
- The SFX files don't exist: `/audio/sfx/hit.ogg` 404s in battle.

### What I would check first coming back cold

1. `git status` and `git log -3`: anything uncommitted is either his or a
   session that ended before a checkpoint.
2. `conventions.md` before any structural change: two big migrations are
   queued, not started.
3. `docs/design-system.md` before touching any screen.
