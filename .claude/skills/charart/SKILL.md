---
name: charart
description: Make art for a playable character, step by step and in order - design lock, LoRA dataset and training, kit and card drafts, finish pass, composites, lock and install. Use whenever Tanveer asks for character, skill, ultimate, passive or card art, a character LoRA, a pose, or says "/charart". Enforces his approval gates and the method in docs/CHARACTER_ART.md, so no step is skipped and no failed method is repeated.
---

# charart

Runs the character-art method in [`docs/CHARACTER_ART.md`](../../../docs/CHARACTER_ART.md)
one step at a time. **That file is the method; this skill is the order and the
gates.** Read the relevant step there before doing it. Do not work from memory:
the method changed five times on Sara alone.

## Where the truth lives

- `docs/CHARACTER_ART.md`: the current method, the rules, and the dead ends.
  Rewrite a step there when it changes.
- `scripts/lora/` (`common.py`, `gen_candidates.py`, `stage_dataset.py`,
  `test_checkpoints.py`, `sdxl_character.yaml`, and `characters/<id>.json`
  profiles).
- `scripts/pose/` (`mannequin.py`, `draw_pose.py`, `poses/*.json`): the Blender
  mannequin.
- `scripts/skill_art/` (`finish_pass.py`, `draw_class_bg.py`,
  `compose_<id>.py`).
- ComfyUI `output\references\README.md`: his reference library.
- History, read only for the reason behind a rule:
  `docs/archive/ART_PIPELINE-character-history.md`.

If these files are deleted, delete this skill in the same commit.

## Before any step

1. **Orient.**
   - Is ComfyUI up? If not, start it detached; never as a Bash background task.
   - Keep the PC awake for long runs.
   - Read the character's profile `scripts/lora/characters/<id>.json`: its
     lock, approvals, `lora_use` and `art_direction`.
2. **Find which step the character is on,** from the profile and the output
   folders. **Never skip a step, and never start one whose gate is not
   passed.**
3. **Read the reference library index** before any draft round.

## The steps and their gates

A **gate** is his word in chat. Without it, stop and ask; do not assume.

| # | Step | Claude does | Gate (his) |
| --- | --- | --- | --- |
| 0 | Design lock | Design candidates from his sheet; record the lock in the profile | He locks a design |
| 1 | LoRA dataset | Profile; `gen_candidates.py` with `hand_fix` and a face-only reference; full sheets | **Every image approved by number**, then the **caption sheet** approved |
| 2 | Train | Config from the template (frozen recipe); start detached; checkpoint test sheet | **"train"**, then **he picks the step** |
| 3 | Kit drafts | 24 per slot as an overnight batch; LoRA 0.65, action wording, pose control | He picks per slot (may reassign slots) |
| 4 | Finish pass | `finish_pass.py` on each pick; side-by-side check | none (Claude's check) |
| 5 | Composite | `compose_<id>.py`; **Claude's check pass first**; then show him | He locks, or asks for changes |
| 6 | Lock and install | `locked\` plus library; install after the skill names are final | **He locks**; he says when to install |

## Checks that are never skipped

- **Before rendering a skeleton or mannequin pose:**
  - preview it and measure the limbs;
  - no wrist above the head;
  - the pose varied across the batch.
- **Before sending any sheet:**
  - remove only text on clothing and arm-up poses;
  - everything else goes in notes;
  - number and seed on every image.
- **After the finish pass:** draft and finished side by side. Each must be
  the same picture; a different picture means the wrong source.
- **Before showing composites:**
  - background matches the slot (attack skills red; ultimate its own colour;
    passive never red);
  - aura is not an outline;
  - afterimages are in frame;
  - no exposed crop edges;
  - matte is clean.
- **Before overwriting a LoRA or a locked file:** a byte-identical backup
  exists.

## Things only he decides

Look, garments, hood default, shoes, aura colour, which slot a draft serves,
the LoRA step, any change to the frozen recipe or to the base model, and
when art enters the game. Ask with the question tool: two to four options,
recommendation first.

## When something fails

- **Stop.** Report the failure, its cause, and the options, including trying
  harder at what he asked for (#163). Never substitute a different picture
  or method unasked.
- If a method failed for a reason that will recur, add a one-line row to
  *Dead ends* in `docs/CHARACTER_ART.md`.
- If a step's working method changed, **rewrite that step in place**.

## Finish

Tell him where things stand:
- which step the character is on;
- what is locked and where;
- what is waiting on him.

Update the profile, and update `docs/CHARACTER_ART.md` if the method moved.
