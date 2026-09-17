# Fight phases — one model for multi-stage fights

**Spec, 2026-09-17. Approved in principle by Tanveer, not built.** Written
plan-first per `AGENTS.md`, because the ascension trial was built before its
design conversation and had to be marked PROVISIONAL for it.

## Why

Today the game has **two** unrelated ideas that both mean "the fight isn't over
yet", and only one of them is authored the way he thinks about it:

- **`CharacterPhase`** — a *character* carries a `phases` array and transforms
  in place when its HP hits zero. Molvarr is the only user.
- **A multi-fight stage** — `RunnableEncounter.fights[]`, the ascension trial,
  where each fight starts clean.

His model (rulings #137–#139, and the worked examples in
`Plans/2026-09-16-pve-structure.md` points 19–20) has **one** idea instead, and
it nests cleanly:

```
Stage  ->  fights[]     each fight starts clean; HP and death carry
Fight  ->  phases[]     everything carries, including buffs and stacks
Phase  ->  enemies[]    a roster, of any size
```

The same shape three levels deep, and `RunnableEncounter.fights[].enemies`
already has two of them.

**His instruction on the shape of a phase**, which is what makes this a
simplification rather than an addition:

> *"Assume each phase is a different enemy. Okay. Don't count it like one
> enemy."*

So base Goku, Super Saiyan Goku and Super Saiyan 2 Goku are **three enemy
entries in three phases**, not one character with three forms. A phase may hold
one enemy or four — *"Molvarr is taking only one card slot as the enemy team,
and the three or four enemies would take up three or four spots, like how the
player team does."*

## What a phase preserves

Settled in point 19, and it is the reason both layers exist:

| | HP | player buffs / stacks | ult gauge | turn count |
| --- | :-: | :-: | :-: | :-: |
| between **phases** | carries | **carries** | **carries** | **continues** |
| between **fights** | carries | resets | resets | restarts |

A multi-phase fight therefore **rewards ramping** — *"an infinite defense or
attack stacker would benefit from such fights"* — while a multi-fight stage
punishes it. Nothing in the roster stacks uncapped today, so that archetype does
not exist yet; this content is what would give one a reason to.

## The victory check

His model, in his words: *"assume each enemy has a checkbox… once all the phases
are checked then it would mean the victory."*

Implemented without storing any flags, because **an enemy at 0 HP already is its
checkbox**:

1. After damage resolves, ask: **is every enemy in the current phase dead?**
2. If no — continue the fight.
3. If yes and **a later phase exists** — advance `phaseIndex`, replace the enemy
   team with the next phase's roster, play the transition, continue.
4. If yes and there is **no later phase** — the fight is won.

One integer of fight state. A stored flag array would be equivalent for
sequential phases and can drift out of sync with the actual HP; **build the array
only if phases ever need to be cleared out of order**, which he has not asked
for.

**This is the dangerous part of the whole change.** Today `transitionBossPhases`
runs after damage and *before* the victory check, which is what stops a phased
boss at 0 HP being counted as dead. Moving that question up a level gets either
a fight that ends early or one that cannot be won, and **both only show up in
the last phase of a long encounter**. It needs a test per branch, including the
single-phase case.

## Migrating Molvarr

He approved re-authoring him rather than keeping a legacy path: *"if you think
we need to overhaul the Molvarr fight a bit so that we can accommodate it with
the new system, I'm okay with that… this would actually help us fix the
inconsistencies."*

**What he is today:** one character, `boss: true`, `tier: "elite"`, top-level
`hp 8500 / atk 285 / def 175`, plus `phases[]` of two — phase 0 at
`8500/285/175` (an exact duplicate of the top-level statline) and phase 1 at
`10000/400/230`, each with its own `skills`, `spSkill`, `ultimate` and
`passives` (three, then four).

**The duplicate phase 0 is one of the inconsistencies worth killing** — the
statline exists twice and nothing guarantees they agree.

**After:** two enemy entries, used as two phases of one fight. Phase 1 is
Molvarr as he is; phase 2 is the stronger form with its own kit.

### Four traps in this migration

1. **`isBoss()` is defined as "has phases"** — `lib/game/bossPassives.ts:17`
   returns `(char.phases?.length ?? 0) > 0`. Strip `phases` and Molvarr silently
   stops being a boss, taking the multi-passive boss engine with him. He already
   carries a top-level `boss: true`, so **`isBoss` must read that instead**, and
   that change lands *before* any data moves.
2. **`bossPassives` reads the live phase** — `char.phases?.[char.phaseIndex ?? 0]`
   is how a boss's passives switch per phase. With phases on the fight, a unit's
   passives are simply its own, which is *simpler*, but every read has to move.
3. **`damagePreview` previews each phase's kit** (`:1393`) so the archive can
   show what a boss does in each form. With phases on the encounter, the
   character no longer knows it has any — see below.
4. **`serializeState` sends `phaseIndex`** for duel sync (`:86`). Fight-level
   phase state has to travel instead.

## What this costs the archive — and what is his to decide

`components/game/KitPhases.tsx` and the kit document show Molvarr's two phases
**as part of his kit**, because that is where the data lives. Once phases belong
to the encounter, a character no longer knows it is part of a multi-phase fight.

**ANSWERED 2026-09-17, and the answer is already built.** His rule:

> *"We'll keep only one entry to check what Molvarr does. By default it will
> show the phase one details, but there will be another section somewhere that
> can let the users click on it, and then it will show them phase two details.
> Technically it will be two separate kits, but it will show on the same page —
> or at least it would be linked on the same page.*
>
> *This would work even if… for example, right now we have a Red Lyra, then we
> can have a Green Lyra. **Those will not be on the same pages, those will have
> their own dedicated archive entries.** But if a boss, or even a single playable
> unit, has multi phases or multi transformations, then it will be on a same
> single entry."*

**The rule, stated once:** a **transformation** of one unit shares an archive
entry; an **alternate version** of a character gets its own. Recorded as ruling
**#140** because it governs every future kit, not just this spec.

**`components/game/KitPhases.tsx` already is this component.** Built 2026-07-20,
used by `app/archive/[id]/page.tsx`: tabs per phase, each swapping the shown
skills, ultimate, passives and a stat line, and a single-phase character renders
the plain kit with no tabs. Its own comment says it was written *"reusable for
playable-character transformations later"*. **Only its data source changes** —
`getCharacterPhases(character)` becomes whatever the new model exposes. The UI
work here is close to nil.

**Still his:** how the second form is identified — its own kit file, and what it
is called. Kit names and kit JSON are his (`AGENTS.md`), so this plan does not
name it.

## Order of work

1. **`isBoss` reads `boss: true`**, with a test. Nothing else changes yet.
2. **Add fight-level phases to the encounter type** — `fights[].phases[].enemies[]`,
   with a single-phase fight as the default shape so every existing encounter is
   unchanged.
3. **Move the victory check**, with a test per branch: mid-phase, phase cleared
   with a next, phase cleared with none, and a one-phase fight.
4. **The transition beat** — a mini transition, *"we don't need the blackout
   scene"*. UX direction is his; the trigger and the state are mine.
5. **Re-author Molvarr** as two phases, once he has answered the naming question.
6. **Retire `CharacterPhase`** and the code that reads it, once nothing uses it.

Steps 1–3 are structural and independent of his answers. **5 and 6 wait on him.**

## Verification

- `npm run check` at every step; `npm run test:browser` when the transition beat
  lands, since it is timing-dependent.
- **A test that a single-phase fight still ends** — the regression that would
  otherwise reach production, because every existing encounter is single-phase
  and would be the last thing anyone thinks to check.
- **A test that a phased fight is not won early** — the inverse, and the one
  `transitionBossPhases` exists to prevent today.
- `npm run sim` against a multi-phase encounter, to confirm the AI and the
  action economy behave when the field size changes mid-fight.

**Not verifiable here:** whether the transition *feels* like a phase change.
That is his pass.
