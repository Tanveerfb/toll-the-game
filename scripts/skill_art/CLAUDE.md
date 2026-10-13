# scripts/skill_art — kit-art scripts

Loaded when work touches this folder (project-rules §SCALE). The method is
`docs/CHARACTER_ART.md` steps 3 to 6 and the step skills `kitart` and
`artinstall` carry the rules and the numbers; nothing here restates them.
Added 2026-10-13, his yes.

- **These run on his PC against ComfyUI**, from the repo root with system
  `python` (`python scripts/skill_art/<script>.py ...`). A cloud session
  cannot run them and says so; it can read, write and review them.
- **Never pipe into `python -`** or `python - </dev/null`: it hangs on his
  PC. A scripted change is a scratchpad `.py` that gets run.
- `README.md` here is the registry of every script and its usage. **Adding,
  promoting or retiring a script updates it in the same change.**
- The shared graph builders are `scripts/lora/common.py` (`base_graph`,
  `queue`, `NEG_BASE`, `COMFY`); the character's state is
  `scripts/lora/characters/<id>.json` (schema beside it). A script reads
  the profile rather than carrying a character's prompts inline.
- **Drafts and official renders are `kit_drafts.py` and `official_render.py`
  for every character** (2026-10-14). A new character needs a `kit_prompt`
  block in its profile, not a new script. `duke/` is kept only until the
  generic scripts produce a locked piece; never copy it.
- The `lyra_*`, `bow_*`, `grip_hand.py`, `paint_out.py` and
  `compose_latent_heat.py` / `compose_supercooling.py` scripts are the record
  of the quality bar (Lyra, 2026-09). Read them; do not modify them.
- `compose_<id>.py` draws every layer from the matte so a rerun is exact;
  nothing in a composite is generated.
- Prompt files for the finish pass live in `prompts/`; the drawn bow assets
  in `bows/` (ruling #160).
