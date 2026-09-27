# Status — 2026-09-27 (evening)

**Who updates this:** every checkpoint, by **rewriting** it, never appending
(`project-rules.md` §2; his call, `decisions.md` 2026-09-27). It holds the
current position only. A session's log goes to
`docs/archive/STATUS-YYYY-MM.md` with a line in
[`docs/archive/README.md`](archive/README.md). Issues are in
[`issues.md`](issues.md), phases and the not-built list in
[`ROADMAP.md`](ROADMAP.md), and accounts in [`environment.md`](environment.md).

## Start here

**State:** the game is unchanged since `c2e3399` except for Lyra's art. This
session was a ComfyUI session: Lyra has a trained face LoRA, a new card
portrait, two new skill arts and a fixed C4 collar. Two rulings were filed:
#160 (weapons may appear in card art, drawn and composited) and #161 (a skill
card's background is its class colour). Last checkpoint: the commit after
`c2e3399` (`git log -1`).

**Next: finish Lyra's kit art, paused at his call** (the table in
`docs/ART_PIPELINE.md`, "Lyra kit art with the LoRA"). In order:
1. **Latent Heat**, the ultimate, generated whole (free colour, free pose):
   a red-ice arrow storm, Gowther-style.
2. **Supercooling**, passive Q07 (his pick): add the drawn bow slung on her
   back.
3. **Flash Point** still has a fist on the bow. Re-do it with the option-A
   hand method if he wants it.
4. Optional: the C4 upgrade (slung bow and aura).

ComfyUI is Claude's to drive; filter output, then bring images with a
recommendation. `get_system_stats action:"health"` first.

**Blocked on him:**
- Which screens show Lyra's full-body C4 card (the card slot is his pick,
  not yet built; `docs/ART_REQUESTS.md` D5).
- Carried over: building "Roused" (Molvarr phase 2), where the closed Orders
  tile sits, recolouring the app icon, the foundation audit's next section,
  and scheduling the folder migration and sentence case.

**Don't trust:** taste on any art is his. See **Confidence and gaps**.

## Confidence and gaps

### Verified on 2026-09-27 (evening), by running it

- `npm run check`: **1,478 passed / 124 files**, typecheck and lint clean,
  after the only code change, `ART_VERSION` 14 to 15.
- **The LoRA trainer works:** `lyra_toll_v2` trained 2,000 steps on 24
  images he approved. Checked in ComfyUI against today's IP-Adapter method on
  three situations absent from the dataset: skirt right in 24 of 24 against
  3 of 6. He picked step 1500.
- `draw_lyra_bow.py`'s default output is **pixel-identical** to the approved
  `lyra_bow.png` after the draw and arrow options were added (checked twice).

### Believed but NOT verified

- **The new art has not been seen in the game.** `lyra.png` (C10), Flash
  Point and Shatterburn were checked as images, not on a screen. Cache-busting
  relies on `ART_VERSION` 15.
- The recipe's reuse on a second character is untested; Lyra is the only run.

### Untested by anything

- Carried over: a reload between two trial fights loses the run;
  `worldBossPreview.ts` and `immunity.ts` have no test; no screen flow is
  tested; the SFX files do not exist.

### What I would check first coming back cold

1. `git status` and `git log -3`.
2. `docs/ART_PIPELINE.md`: the kit art table, "The bow hand" and "Character
   LoRA recipe" (frozen) before any ComfyUI work.
3. `docs/design/SKILL_ART_PLAN.md` (rulings #160, #161 at the top) before any
   skill art.
