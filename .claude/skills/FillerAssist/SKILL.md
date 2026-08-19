---
name: FillerAssist
description: Author one story chapter of game content — read the canon, map its beats onto stages, draft the filler needed to fill the gaps, get Tanveer's approval item by item, then write data/story/chapter-N.json. Use when adding or reworking story mode content, adapting a webtoon chapter into stages, drafting a story NPC, or when he says "/FillerAssist", "let's do chapter N", "work on the story mode content". Carries canon knowledge from E:\Toll - Web toon and keeps invented material on a leash.
---

# FillerAssist

Story mode adapts a webtoon that exists. This skill exists so game content can be
written **without the canon being damaged by it**.

Ruling **#108** (2026-08-18) is what permits filler at all:

> Claude may draft filler stages, scenes and NPCs so story mode has enough to
> play — but **nothing enters the game unapproved**, filler must never contradict
> or resolve canon, and **NPC kit numbers stay his**.

**One chapter per invocation.** His preference, and the practical one — *"Working
on one chapter at a time is preferred. Better for both you and me in terms of
context and focused work."* Refuse to open a second chapter while a drafted one
is still awaiting approval.

## Where the truth lives

**Canon** (read-only, never edited by this skill or any other):

- `E:\Toll - Web toon\Master_Context.md` — the world, the power system, the
  races, the Ledger Bureau, the Arc One chapter list, and the locked rulings.
  **Read every invocation**, not from memory.
- `E:\Toll - Web toon\Chapter N.md` — the beat sheet for the chapter being
  adapted. Twelve exist; Arc One caps at 24.

**Game side:**

- `data/story/chapter-N.json` — output. `types/story.ts` — the contract.
  `lib/game/storySchema.ts` — what will reject a malformed chapter at load.
- `docs/HANDOFF.md` — rulings #45 (team modes), #47/#80 (reward split), #100
  (stamina), #103 (waves), #108 (this).
- `docs/design/ECONOMY_AUDIT.md` — the **gem budget**, 3,000 across 24 chapters
  in six tiers. Author against the table; the first twelve were improvised and
  reached 6,430 before anyone summed them.
- `Filler/Drafts.md` — every proposal, including rejects and why.
  `Filler/Approved_chapter_N.md` — what he signed off.

## The workflow

### 1. Canon read

Read `Master_Context.md` and the chapter's beat sheet. Write down, before
proposing anything: the beats, the cast actually present, the locations, and
**what the chapter must land** for the arc to still work.

### 2. Beat map

Map beats onto stage slots. Name the gaps out loud — which stages have no fight,
which have no scene. **The gaps are what filler is for**; anything proposed
outside a named gap needs a reason.

Target **4–6 stages**, which falls out of the canon's own 2-2-1 segment shape.
Structure is Chapter → Stage, `story | battle | boss`, boss last, waves 1–3
sharing one HP pool with the fallen staying down (#103).

### 3. Filler proposal

Every item carries two things:

- **Why the game needs it** — a stage with no fight, a cast member who never gets
  played, a wave that teaches a mechanic.
- **What canon claim it touches** — and the answer should be *none*.

### 4. His approval, item by item

Not a batch yes. He reads items and answers them. **Nothing enters the game
unapproved** — including a scene you are confident about.

For **NPCs**, the rule is stricter (his words): *"You can discuss me and explain
why you need such character in the story, why their kit and ask for my input or
suggestions before you finalize it."* So: draft the **role, personality and
combat concept**; state why the story needs them. **Numbers, skill names and
multipliers are his.** `storyOnly` stat bands are still unassigned at
`docs/design/KIT_DESIGN.md:83`, which blocks any new enemy kit until he fills
them in — say so rather than inventing a band.

### 5. Record

- Approved → `Filler/Approved_chapter_N.md`.
- Everything proposed, **including what he rejected and why** → `Filler/Drafts.md`.
  The rejects are the valuable half; they stop the next chapter re-proposing them.

### 6. Author

Write `data/story/chapter-N.json`. **Every filler stage and scene carries
`origin: "filler"`.** That field is the whole protection model — it makes invented
material auditable, strippable if canon later contradicts it, and labellable in
the archive. A filler item without it is worse than not shipping it.

Reuse what exists: `TeamPicker` and `lib/game/teamPresets.ts` (his note — reused
as they are), `stageEffects`, `victoryAtEnemyHpPercent`.

### 7. Art

Anything missing goes to `docs/ART_REQUESTS.md` via `comfypending` — **no
permission needed** (ruling #106). Then keep building with the fallback;
`lib/game/storyBackgrounds.ts` renders a locale-tinted gradient until plates land.
**Never block on missing art.**

### 8. Verify

`npm run check`, then a build with `NEXT_DIST_DIR` set — **:3000 is his dev
server, never start or kill one.** He does the visual pass.

## Hard rules

- **Never contradict `Master_Context.md`.** It outranks anything drafted here.
- **Never write dialogue for a canon beat the sheet already scripts.**
- **Filler never resolves an open thread and never reveals a held reveal** —
  Seris's Chapter 10 role, Mustafa's turn, Duke's raid answer. Filler happens in
  the gaps *between* canon events, and leaves every locked outcome exactly as
  uncertain as it was.
- **Never put words in a canon character's mouth beyond small talk.** Travel and
  downtime are the safe register.
- **Never invent a canon fact to make a stage work.** If a fight needs a reason
  the source doesn't give, the fight is wrong — change the fight.
- **A canon anchor is playable regardless of ownership** (#45) — a fresh account
  is never locked out of its own story.
- **No auto clear on story stages, ever** (his ruling, 2026-08-18). A test asserts
  it; don't weaken the guard.
- **Rewards:** gems and account XP are first-clear only and **fixed, never
  rolled** (#80); farm is coin and basic training manuals in narrow ranges.
  No ascension materials — world-boss exclusive (#47). `StoryFarmDrops` has no
  gem field at all, which is the enforcement.

## Finish

Tell him: the stage list with kind and origin per stage, what filler is awaiting
approval, the chapter's gem total against its budget tier, what went to
`ART_REQUESTS.md`, and the verification result. Then stop — approval is a
separate turn, not an assumption.
