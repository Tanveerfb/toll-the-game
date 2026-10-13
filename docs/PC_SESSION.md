# The next PC session, in order

**Who updates this:** the session that does an item strikes it out here in
the same change, and a cloud session that queues PC-only work appends to it.
The PC session rewrites the file at its checkpoint; **when the list is
empty, delete the file** (project-rules §DOCS: no document without content).
`docs/STATUS.md` stays the record of where the work is; this is only the
order of the work that needs his PC (ComfyUI, the trainer, `.claude/settings.json`).

Written 2026-10-13 from his phone message after the art-skills session:
*"Write a file specifically targeting PC session and telling it what to do
next time I start the PC session ... so that it is a priority. First things
first."*

Start with `relay`, then this list.

## 1. Enable the `fleet` plugin

The 2026-10-13 cloud session was refused the write to `.claude/settings.json`.
Add the `extraKnownMarketplaces` / `enabledPlugins` block the fleet
`sync-standards` skill gives (`fleet@tanveerfb`, from
`Tanveerfb/fleet-standards`). Then, in a fresh session, confirm
`fleet:checkpoint` and `fleet:relay` appear and **delete
`.claude/skills/checkpoint` and `.claude/skills/relay` in the same commit**
(AGENTS.md says the local copies live only until then). Update the
"Not yet enabled here" paragraph in `CLAUDE.md` and the `decisions.md`
2026-10-13 entry.

## 2. Duke: rebuild the dataset with action shots, retrain, then redraft

His decision, 2026-10-13: *"we will have to rebuild Duke's data set and then
retrain the LoRa because obviously that is no-no considering what we need
for the game."* Ruling #186: a dataset must carry action shots; Duke's v1 and
v2 sets were calm, front-facing standing figures.

Run `charart`, which routes to `charlora`:

- Step 1 again with action shots: about a third of the body shots as
  actions, each different, posed with the mannequin or a reference skeleton.
  Put the shot list and the count to him before generating. Keep what the
  v2 set fixed (the ear strand is gone; `scripts/lora/duke_v2_fix/`), the
  boots lock and the skin tone. He approves by number, then the captions.
- Step 2: a new `dataset_name`, the frozen recipe, `duke_toll_v3`; back up
  `duke_toll.safetensors` under its own name before `Copy-Item -Force`.
- Then `kitart` from step 3a. The slot plan is not from scratch: his picks
  from 2026-10-08 (S2 surge, a drop kick with soles to the lens for the
  slide, U19 for the ultimate) are the concepts; redraft them at **0.9**
  with the `duke_drop_e` mannequin and the surge and ult poses. The
  2026-10-08 official candidates in ComfyUI `output\blue_duke\candidates`
  are superseded by this decision; do not lock them.

Record the v3 training and the pick in `scripts/lora/characters/duke.json`
(`training_v3`, `lora_pick_v3`), as v2 is recorded.

## 3. Generic `kit_drafts.py` and `official_render.py`

His answer on 2026-10-13 read as yes (*"Kit drafts and official render.
Yep. Generic."*; speech-to-text, confirm in one line before building).
`scripts/skill_art/README.md` "Queued" has the shape: `kit_drafts.py <id>
<slot> --pose <name> --n 24` reading `lora_use` and `art_direction` from
the profile, `union()` moved into `scripts/lora/common.py`,
`official_render.py <id> <slot> <draft.png>` the same way. Duke's redraft
in item 2 is the first run of the generic scripts, so build them before it
rather than copying `duke/kit_drafts.py` a third time. Keep Duke's files
until the generic ones have produced one locked piece, then delete them and
update the README.

## 4. Sara's LoRA (only if he wants pieces redone)

Same rule as Duke, lower priority: her kit is shipped. A retrain on an
action-bearing set only matters when he asks for a Sara piece to be redone.

## Not PC-only, listed so the order is complete

- **The save fix** (issues #28, #30, #31; `docs/GAME_AUDIT_2026-10-13.md`
  Part 1). No design content, one session, cloud-capable. He confirmed it
  needs doing (2026-10-13); it has not been started. `savefield` carries
  the Firestore shape rules it will need.
- **Area `CLAUDE.md` files** for `lib/game/` and `scripts/skill_art/`
  (§SCALE): he said yes on 2026-10-13. Claude's job, cloud-capable; each
  fact moves out of the root file rather than being copied.
- **Still his:** the theme pick (round two did not click; he will look on
  the PC), the eight audit decisions (Part 5), the two rules conflicts in
  `conventions.md`, and one open question from 2026-10-13 that the cloud
  session could not place: *"when we're designing a new character kit ...
  the schema needed"*: a module or schema for authoring a new kit. Whether
  that means a zod schema for `data/characters/*.json` in this repo, a
  template in `toll-kits`, or something else is his to say.
