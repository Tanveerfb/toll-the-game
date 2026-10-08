# Status — 2026-10-08 (his PC, ComfyUI)

**Who updates this:** every checkpoint, by **rewriting** it, never appending
(`project-rules.md` §2; his call, `decisions.md` 2026-09-27). It holds the
current position only. A session's log goes to
`docs/archive/STATUS-YYYY-MM.md` with a line in
[`docs/archive/README.md`](archive/README.md). Issues are in
[`issues.md`](issues.md), phases and the not-built list in
[`ROADMAP.md`](ROADMAP.md), and accounts in [`environment.md`](environment.md).

## Start here

**State:** blue Duke is at `charart` **step 4**. LoRA v2 (step 1750, his pick)
is installed. Official renders of his picks are in ComfyUI
`output\duke_official3` and **four sheets went to him** (S2, K4, K10, U19). He
has not picked yet. Nothing is locked or in the game. The game code is
unchanged since `aaae4e2`. Last session's log: `docs/archive/STATUS-2026-10.md`,
2026-10-07/08.

**Next:** get his picks from the `off3_*` sheets, then finish and composite them
(`docs/CHARACTER_ART.md` steps 4–5; the ultimate uses `compose_duke.py --bg=`
with a snow plate). Surge's hair still leaks from its draft, so offer options.

**Blocked on him:**
- **Duke:** picks from the official sheets, a snow plate (M2/M3/M6) and a river
  plate (R2/R5/R6); the Slide skill name (he may rename it).
- **Batra:** held at step 1. The `lora_batra_set_a` round is unreviewed: the
  B36 face reference draws a bandana-like turban, and the straps draw crosses.
  Bring him options.
- From 2026-10-03, still open:
  - try the Merge badge on a phone (its 44px hit area overlaps the name strip);
  - approve or reverse Claude's calls in #180;
  - missions for Epic Battles, the Gon/Killua/Leorio answer to Tao (#138), an
    optional Tao rerun;
  - the Caila and Sara design sheets, the new card texts, Lyra's C4 and passive
    placement, Roused, the Orders tile, the app-icon recolour, the foundation
    audit, the folder migration, summon animations (#174).

**Don't trust:**
- `output\blue_duke\candidates`: Sonnet's composites, off-model and on the old
  ultimate background. **Superseded, never lock them.**
- Sim numbers from before 2026-10-03.
- In the cloud container, `npm run test:browser` needs the Playwright symlink
  workaround (`PLAYWRIGHT_BROWSERS_PATH` with the 1194 builds linked as 1234).

## Where things are

| What | Where |
| --- | --- |
| The art method and its dead ends | `docs/CHARACTER_ART.md`, walked by the `charart` skill |
| Duke's state, decisions and his quotes | `scripts/lora/characters/duke.json` (`lock`, `revision_2026_10_08`, `kit_art`, `lora_pick_v2`) |
| Batra's state | `scripts/lora/characters/batra.json` (`status`) |
| Duke's run scripts | `scripts/skill_art/duke/` (README), `scripts/skill_art/compose_duke.py` |
| Cleaning a trait out of a dataset | `scripts/lora/duke_v2_fix/` (README) |
| LoRA files | ComfyUI `models\loras\duke_toll.safetensors` (v2 step 1750); `duke_toll_v1_1250.safetensors` (backup); steps in `models\loras\training\` |
| Training sets | `C:\Users\Tanve\.comfyui-mcp\training\datasets\duke_v2` (backups `duke_v2_precollar`, `duke_v2_preskin`); config `configs\duke_v2_sdxl_lora.yaml` |
| References | ComfyUI `output\references\README.md`; the Dokkan sets via the `dokkanartresearch` skill |
| Rulings | `docs/HANDOFF.md`; newest is #184 (an ultimate's background) |

## Confidence and gaps

### Verified on 2026-10-08, by running it

- `npm run check`: **1,675 passed / 137 files**, exit 0 (typecheck and lint
  included). No game code changed in this session.
- The LoRA install: the sha256 of `duke_toll.safetensors` matches
  `training\duke_toll_v2_000001750` (`c2557683f42c…`), and the v1 backup is a
  separate hash (`9e07579e9ba7…`).
- Every sheet sent was looked at by Claude first. No text on clothes, no arm-up
  pose.

### Not verified

- The new ultimate layers on an **on-model** render. They were tested only on
  Sonnet's off-model render.
- Whether the v2 LoRA's short grey wisp on front-facing close-ups bothers him.
- The promoted scripts in `scripts/skill_art/duke/` and `scripts/lora/duke_v2_fix/`
  parse, but were not re-run from their new folders.

### Recorded as Claude's reading, not his words

- The A/B rule, the "check the head against the dataset" step, and the dead
  ends added to `docs/CHARACTER_ART.md` are Claude's method notes from this
  session's failures.

## Outside the repo

- **`toll-kits`:** #181–#184 are **not yet** in its `KIT_RULINGS`, and its
  `decisions/PENDING.md` entries for #182/#183 are not yet deleted. Next session
  with git access there.
- **ComfyUI output folders** hold all the images; nothing is in git.
