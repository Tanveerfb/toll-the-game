# Status — 2026-09-28

**Who updates this:** every checkpoint, by **rewriting** it, never appending
(`project-rules.md` §2; his call, `decisions.md` 2026-09-27). It holds the
current position only. A session's log goes to
`docs/archive/STATUS-YYYY-MM.md` with a line in
[`docs/archive/README.md`](archive/README.md). Issues are in
[`issues.md`](issues.md), phases and the not-built list in
[`ROADMAP.md`](ROADMAP.md), and accounts in [`environment.md`](environment.md).

## Start here

**State:** The game logic is unchanged since `c2e3399`; only art and where
art lives changed.
- **Lyra's kit art is complete:** portrait, the C4 card pose, Flash Point,
  Shatterburn, Latent Heat, and Supercooling as `passive.png`.
- **All game art now lives in per-unit folders,** `public/characters/<color>_<id>/`
  (ruling #162).
- **Two new rulings:** #162 (the folders) and #163 (art obeys world physics,
  signature effects are not forced, and when his ask fails, stop and bring
  options).
- Last checkpoint: `git log -1`. This session's log:
  `docs/archive/STATUS-2026-09.md`, 2026-09-27d.

**Next:** his call. He closed the ComfyUI run (*"we're done for all config
sessions until uh, uh, next time"*). **Before any art work, read in
`docs/ART_PIPELINE.md`:**
- "Where art lives"
- the kit art table
- "Bow tools and what they cost"

**Standing art rules from this session** (also in memory and the ledger):
- **The old method is the default:** a full-quality batch, filter it, he
  picks, then layers. Draft-then-finish is paused: ask him first.
- **Props obey physics:** a slung bow needs a strap, a held bow needs a
  closed hand. When his request can't be done as asked, report and offer
  options; never substitute (#163, `AGENTS.md`).
- **Signature effects (red-ice shards, aura) only where the moment calls for
  them.**

**Blocked on him:**
- Which screens show Lyra's C4 card pose and her passive art. Neither slot
  exists in code yet (`docs/ART_REQUESTS.md` D5).
- His **next Lyra variant**. B1 is reserved for it at ComfyUI
  `output\red_lyra\_reserved-for-variant\`. What a variant is mechanically is
  his to define (#162).
- Carried over:
  - building "Roused" (Molvarr phase 2)
  - where the closed Orders tile sits
  - recolouring the app icon
  - the foundation audit's next section
  - scheduling the folder migration and sentence case

**Don't trust:** the new art has not been seen on a game screen. See
**Confidence and gaps**.

## Outside the repo, on his PC

- **7DSGC references:** `C:\Users\Tanve\Downloads\7dsgc assets`, 37 cards
  plus 42 kit arts in `Kit arts\`.
  - Renamed `<unit>_<kind>`; `_names.tsv` in each folder maps back to the
    original names. Units are named only where certain (Gawain is the
    blue-haired one).
  - Skeletons only, in ComfyUI `output\references\7dsgc\skeletons\`.
  - **Never** feed their art to IP-Adapter or img2img, and never put it in
    this repo.
- **ComfyUI output is sorted per unit:**
  - `output\red_lyra\<piece>\{drafts,work,final}\`, plus other units' folders.
  - `items\`, `backgrounds\`, `story\backgrounds\`, `_other-projects\`.
  - 209 renders nobody could identify stay in `_unsorted\`.
  - `output\_moved.tsv` maps every old path to its new one.
- **Models:** `loras\lyra_toll.safetensors` is step 1500 (the recipe is
  frozen). `upscale_models\RealESRGAN_x4plus_anime_6B.pth` was added this
  session.

## Confidence and gaps

### Verified on 2026-09-28, by running it

- `npm run check`: **1,480 passed / 124 files**, typecheck and lint clean.
  That was after the art-path change and `ART_VERSION` 18. No TypeScript
  changed after it; the later edits are Python art scripts and docs.
- A scratch production build (`NEXT_DIST_DIR=.next-verify npx next build`)
  passed. `.next-verify` was removed and `tsconfig.json` restored.
- **Every registered portrait and skill image exists at its new path.**
  `tests/characterArt.test.ts` checks this, and its new skill-art check was
  proved to fail with a file hidden.
- **Supercooling:** rerunning `compose_supercooling.py` with defaults
  reproduces the installed `passive.png` pixel for pixel.

### Believed but NOT verified

- **The new art has not been seen in the game.** Latent Heat, Flash Point and
  Shatterburn were checked as images and zoomed crops, not on a screen.
  Cache-busting relies on `ART_VERSION` 18.
- The LoRA recipe's reuse on a second character is still untested.

### Untested by anything

- Carried over: a reload between two trial fights loses the run;
  `worldBossPreview.ts` and `immunity.ts` have no test; no screen flow is
  tested; the SFX files do not exist.

### What I would check first coming back cold

1. `git status` and `git log -3`.
2. Open a battle with Lyra and her archive page. Confirm her four kit images
   load from `/characters/red_lyra/`.
3. `docs/ART_PIPELINE.md` "Bow tools and what they cost" before any bow art.
