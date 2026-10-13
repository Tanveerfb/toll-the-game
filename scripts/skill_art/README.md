# scripts/skill_art — drafts, finish, composites, install

**Who updates this:** whoever adds, promotes or retires a script here, in the
same change. The method is `docs/CHARACTER_ART.md` steps 3 to 6; the `kitart`
and `artinstall` skills walk it. Run everything with system `python` from the
repo root; the scripts import `scripts/lora/common.py` (`base_graph`, `queue`,
`NEG_BASE`, `COMFY`).

## Current scripts

| Script | Step | Usage | Notes |
| --- | --- | --- | --- |
| `duke/kit_drafts.py` | 3 drafts | no arguments; edit `PLAN` (slot, clause, pose name, count) | **The worked example of the doc recipe**: LoRA 0.65, action wording, `simple background`, hand pass off, union ControlNet depth 0.55 + openpose 0.6 end 0.7. Duke's prompts, LoRA and repo path are hardcoded: copy it per character until a generic `kit_drafts.py <id> <slot> --pose <name> --n 24` reading the profile exists (queued, see below) |
| `duke/drop_poses.py` | 3 poses | no arguments | Writes `scripts/pose/poses/duke_drop_*.json`, renders them, builds a preview sheet. The model for a foreshortened pose |
| `duke/official_render.py` | 4 | `official_render.py <lora file>` | img2img from his pick + both ControlNets 0.6/0.65 end 0.85 + LoRA 0.9, denoise 0.72 and 0.82, four seeds. Duke's `JOBS` hardcoded |
| `duke/backdrops.py` | 5 | no arguments | Scenic plates rendered without the character (snow, river) for the ultimate and the card |
| `finish_pass.py` | 4 | `finish_pass.py <src.png> <out_prefix> <lora> <prompt_file> [denoise=0.35] [scale]` | Anime 4x upscale to 1.5x, img2img at LoRA 0.9, BiRefNet cut-out. **0.3 on an official render.** One input file per run |
| `draw_class_bg.py` | 5 | see docstring | The attack-class background (radial speed lines), #161 |
| `compose_duke.py` | 5 | `--bg=<plate> --hands=x,y,r;… --dir … --recolour …` | **The model composite**: plate, teardrop droplets, hand-only aura, matte cleaning. Copy per character |
| `compose_sara.py` | 5 | `compose_sara.py <piece> <finished.png> <matte_rgba.png> <out_dir>` | Sara's composites. Its card note is historical: the card uses an environment plate, not a red gradient (rule 5) |
| `paint_out.py`, `grip_hand.py`, `add_bow_strap.py`, `bow_in_open_hand.py`, `bow_swap.py`, `compose_bow_skill.py`, `compose_latent_heat.py`, `compose_supercooling.py`, `lyra_*.py` | Lyra, Sept 2026 | see each docstring | **Lyra's run, kept as the record of the bar.** `lyra_bow_skill_drafts.py` and `lyra_shatterburn_poses.py` carry her recipe (LoRA 0.9, weighted identity, archer skeleton openpose 0.78/0.85 or prompt only, 12-step drafts) and the concept-per-piece headers. Not the doc's current recipe; see `kitart` step 3b |
| `make_tile_cutout.py` | 6 | see docstring | The archive tile from the transparent cut-out; headroom stops at a natural edge |
| `make_portrait_crop.py` | 6 | `make_portrait_crop.py <cutout> <x0> <y0> <side>` | A transparent chest-up 1024² crop, framed like Lyra's; write the numbers into the profile |
| `prompts/`, `bows/` | | | Prompt files for the finish pass; the drawn bow assets (#160) |

## Queued

- **A generic `kit_drafts.py` and `official_render.py`** that take `<id>`,
  `<slot>`, `--pose` and read `lora_use` and `art_direction` from the profile,
  with `union()` moved into `scripts/lora/common.py`. Until then, Duke's
  files are copied per character, which is how the recipe drifts.
- `backdrops.py <id> <kind>` the same way.
