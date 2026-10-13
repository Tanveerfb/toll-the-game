---
name: charart
description: The entry point for a playable character's art. Orients (ComfyUI, the profile, which step the character is on), enforces his gates, and hands off to the step skill - charlora (design lock, dataset, training), kitart (the slot plan, drafts, official render, composite) or artinstall (lock and install into the game). Use whenever Tanveer asks for character, skill, ultimate, passive or card art, a character LoRA, a pose, or says "/charart". Never skips a step and never repeats a failed method.
---

# charart

The character-art method is [`docs/CHARACTER_ART.md`](../../../docs/CHARACTER_ART.md).
It is split across three step skills so that each one carries its rules **in
the skill**, not behind a "read the doc" pointer: docs get skimmed, skills get
followed (AGENTS.md). This skill finds the step and routes.

| Step | Skill | Where it runs |
| --- | --- | --- |
| 0 design lock · 1 dataset · 2 train | `charlora` | his PC (ComfyUI, the trainer) |
| 3 drafts · 4 official render and finish · 5 composite | `kitart` | his PC (ComfyUI) |
| 6 lock and install | `artinstall` | the repo; a cloud session can do it |

## Where the truth lives

- `docs/CHARACTER_ART.md`: the method, the rules, the environment, the dead
  ends. **Rewrite a step there when it changes**, and mirror the change in
  the step skill.
- `scripts/lora/characters/<id>.json`: the character's state. `duke.json`
  and `sara_v2.json` are the complete shape (`lock`, `design_note`,
  `approved`, `lora_use`, `art_direction`, `kit_art`); `lyra.json` carries a
  reconstructed `kit_art` record.
- `scripts/lora/README.md`, `scripts/skill_art/README.md`,
  `scripts/pose/README.md`: what each script takes.
- The quality bar: `public/characters/red_lyra/` and `red_sara/` (`skills/`,
  `cards/`, `portrait.png`, `tile.webp`), and ComfyUI `output\red_lyra\`,
  `output\red_sara\locked\` on his PC.
- `docs/HANDOFF.md` #160, #161, #163, #171–#173, #181–#184: the rulings on
  props, backgrounds, substitution, the tile and the ultimate's scene.
- ComfyUI `output\references\README.md`: his reference library (his PC only;
  say so from a cloud session). New poses: the `dokkanartresearch` skill.
- `docs/archive/ART_PIPELINE-character-history.md`: history, read only for
  the reason behind a rule.

If these files are deleted, delete this skill and the three step skills in
the same commit.

## Before any step

1. **Orient.** Is ComfyUI up? If not, start it detached (`Start-Process`);
   never as a Bash background task. Keep the PC awake for long runs. From a
   cloud session, only `artinstall` is possible: say so.
2. **Read the profile** `scripts/lora/characters/<id>.json` in full: the lock,
   the approvals, `lora_use`, `art_direction`, `kit_art`.
3. **Find the step** from the profile and the output folders (`output\lora_<id>*`,
   `<id>_kit*`, `<id>_official*`, `<color>_<id>\candidates`, `\locked`).
4. **Invoke the step skill.** Never skip a step, never start one whose gate is
   not passed, never work from memory of an earlier character: the method
   changed five times on Sara alone, and twice more on Duke.

## The gates (his word in chat; without it, stop and ask)

| Step | Gate |
| --- | --- |
| 0 | He locks a design |
| 1 | Every dataset image approved **by number**; then the caption sheet; a cleaned set approved again |
| 2 | **"train"**; then he picks the step |
| 3 | He OKs the **slot plan** (`kitart` step 3a), then picks a draft per slot (may reassign slots) |
| 4 | None: Claude's on-model check, then sheets to him |
| 5 | He locks, or asks for changes |
| 6 | He has locked **and** the kit's skill names are final; he says when to install |

## Things only he decides

Look, garments, hood default, shoes, skin tone, aura colour, the pose ideas
when he has them, which slot a draft serves, the LoRA step, any change to the
frozen training recipe or the base model, and when art enters the game. Ask
with the question tool: two to four options, recommendation first. **When he
names a detail you cannot place, mark the candidates A/B on one image and ask
before any GPU time** (#163's cousin, learned on Duke's ear strand).

## When something fails

Stop. Report the failure, its cause and the options, **including trying
harder at what he asked for** (#163). Never substitute a different picture or
method unasked. A method that failed for a reason that will recur gets a row
in *Dead ends* in `docs/CHARACTER_ART.md` and a line in the step skill's
*Do not* list.

## Environment traps (every step)

- **Never pipe into `python -`** or `python - </dev/null`: it hangs on this
  PC. A command shaped like that sat all night. Write a scratchpad `.py`.
- **Run scripts with system `python`**; ComfyUI's embedded Python cannot
  `import common`. Face boxes (`ultralytics`) are the one job that needs the
  embedded Python.
- **The trainer** launches with `Start-Process` on Git `bash.exe`,
  `-ArgumentList "train.sh","configs/<name>.yaml"`, `-WorkingDirectory` set;
  a `bash -lc "cd … && …"` string never ran. Its log is
  `runs/<config file name>.log`. **The final save has no step number.**
- **A loaded LoRA cannot be overwritten with Bash `cp`**; PowerShell
  `Copy-Item -Force` works. Byte-identical backup first, hashes after.
- **16 GB cannot hold training and ComfyUI at once**: `POST /free` before a
  run.
- The hand pass (`hand_fix`) refuses image batches: one job per image.

## Finish

Tell him which step the character is on, what is locked and where, and what
waits on him. Update the profile; update `docs/CHARACTER_ART.md` and the step
skill if the method moved.
