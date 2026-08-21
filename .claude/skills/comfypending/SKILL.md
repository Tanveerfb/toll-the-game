---
name: comfypending
description: Append one or more image requests to docs/ART_REQUESTS.md, the standing ComfyUI queue. Use whenever a feature needs art the game doesn't have, or when Tanveer says "queue this for comfy", "add to the art requests", "/comfypending". Gathers purpose, specs, prompt notes, landing path and registration, then writes entries in the file's own format without disturbing what's already there.
---

# comfypending

Adds entries to [`docs/ART_REQUESTS.md`](../../../docs/ART_REQUESTS.md) — the file
ComfyUI sessions read to know what to generate.

**The rule this skill exists to serve:** *never block on missing art.* Queue the
request, ship the feature with a graceful fallback, move on. Writing a good entry is
what makes that safe, because a ComfyUI session has no other context — it sees only
what the entry says.

## Do this first

1. **Read the file.** Its entry format, its category list and its per-category spec
   tables are the source of truth, not this skill. Categories get added over time; do
   not assume the set.
1b. **If you are about to GENERATE rather than just queue**, confirm the server is
   reachable *and* has what the plan needs — `get_system_stats action:"health"` lists
   checkpoints, LoRAs, VAEs and text encoders in one call. A model file sitting in
   `checkpoints/` is not proof it can run: `flux1-dev-fp8-e4m3fn.safetensors` is
   UNet-only and dies at `CLIPTextEncode`, and all five vector LoRAs on this box are
   unusable behind the same missing encoders. Thirty seconds here, versus discovering
   it mid-batch.
2. **Check for a duplicate.** Grep the slug and the subject. If an entry exists,
   *update it* rather than adding a second — a queue with two versions of one request
   wastes GPU time on whichever the session reads first.
3. **Before generating anything, verify the entry against the repo.** An entry is
   written at one moment and read at another, and the code moves in between. Category A
   listed fourteen scene backgrounds derived from `data/story/part*.json` — a file
   structure story mode v2 deleted, leaving one chapter file that references **four**
   slugs. Generating the list as written would have been ten plates for scenes that do
   not exist. Grep for what actually references the asset, correct the entry, then
   generate. A stale entry is worse than a missing one, because it reads as approved
   work.
4. **Work out which category it belongs to**, and read that category's spec table.
   Several categories deliberately **override** the `ART_PIPELINE.md` defaults (scene
   backgrounds are 16:9 and must never have their background removed; inventory icons
   are 512px and must read at 24px). Getting that wrong produces unusable assets.

## What every entry must answer

The file's own format block is authoritative. It asks for:

- **Purpose** — where it appears in the game and what it has to do there. Name the
  component or screen with a path. "Used on the brief" is not enough; "the reward
  column of `ChapterSelect`'s card, at ~44px" is.
- **Specs** — size, aspect, and *any deviation* from the pipeline default. State the
  deviation explicitly even when the category table already covers it.
- **Prompt notes** — subject-specific guidance, or "template default". Include the
  palette token if a hue matters (`el-red #ff5a4e` etc. from `styles/globals.css`).
- **Lands at** — the exact path, **plus how it gets registered in code**. This is the
  part that gets forgotten: art in `public/` that no `*Art.ts` map returns is invisible.
  If the registry doesn't exist yet, say so and say who builds it.
- **Status** and **Requested** — `open`, today's date, and what work prompted it.

## Rules

- **Append, never rewrite.** Add under the right category heading. Leave every existing
  entry, the header rules and the format block untouched.
- **Finished entries move to Delivered**, they are not deleted. A record of what exists
  is as useful as a record of what doesn't.
- **Group a set into one entry** when the assets only work as a family — a tier ladder,
  a colour series. One pass, one consistent light source, one entry.
- **Prefer a frame over a per-instance icon.** If a request scales with content
  (per character, per chapter), ask whether a small set of frames composited in code
  covers it. Five coin frames beat eighteen coin icons and never go stale.
- **Prefer DRAWING over generating when the requirement is geometry.** Exact
  centring, a fixed safe zone, a shape that must read at 32px, anything a
  compositor has to rely on — a txt2img roll cannot promise any of it. Two
  assets have now been drawn in Python for this reason: the five coin frames
  (2026-08-20) and the app icon (2026-08-22). If the acceptance criteria are
  arithmetic, say so in the entry and write a script; a request that ComfyUI
  structurally cannot satisfy wastes a whole session before anyone notices.
- **Check the model can draw the subject at all before queueing a batch.**
  `ART_PIPELINE.md` keeps the running list of what this checkpoint can and
  cannot compose. Animagine returns an **item sheet** for "emblem", "badge",
  "medallion" and "crest" the same way it does for "game item icon" — eight
  images established that, after the pipeline doc had already warned about the
  category. Read that section first; it is cheaper than the batch.
- **Never invent game content to justify art.** Art follows an approved design and never
  leads it — Tanveer owns kits, mechanics and characters (see `AGENTS.md`). If the thing
  the art depicts doesn't exist yet, say that in the entry rather than designing it.
- **Say what the fallback is.** Every entry should imply what ships today without the
  asset, so a reader knows nothing is blocked.

## Multiple entries

Normal case, and cheaper than one at a time. Sort them into their categories first, then
write each one in full — no "same as above", since a session may read only one. If they
share specs, put the shared part in the category's spec table and keep the per-entry
notes to what actually differs.

Finish by telling Tanveer what was added, in which categories, and which entry is the
highest value to generate first.
