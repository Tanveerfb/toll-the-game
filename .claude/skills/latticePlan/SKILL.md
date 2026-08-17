---
name: latticePlan
description: Design, review or tune a story route board (a "lattice") — the path of tiles a chapter is walked on. Use when adding or changing route lengths per part, placing tiles, judging whether a board reads well, or when Tanveer asks "/latticePlan", "plan the lattice for part N", "is this board too long", "what should this route look like". Acts as a consultant: it argues the trade-offs and asks the questions a board's shape depends on, rather than silently picking numbers.
---

# latticePlan

Boards are **geography, not difficulty**. Tanveer's framing, 2026-08-17: *"i would decide the length of the lattice based on what the story needs."* Part 1 is a village and its outskirts, so ten tiles. Part 2 is one fight in a small area, so five. Part 3 walks all the way to the exam ground, so twenty. A board's length is a statement about how far the characters travelled, and it should be defensible in those terms before it is defended in gameplay terms.

## Where the truth lives

- `lib/game/route.ts` — the generator, `ROUTE_STEPS_BY_PART`, the movement rules, and `routeProblems` (the validator). **Read it first**; the rules below are summarised from it and it wins on any disagreement.
- `tests/route.test.ts` — the rules as assertions. If a change here doesn't break a test, the change probably isn't doing what you think.
- `types/story.ts` — `route?` on `StoryChapter`. An authored board overrides the generated one per chapter.

## The rules a board must satisfy

These are his, not negotiable without asking him:

1. **One path. No branching.** *"just one long zig zaggy path."* The walk supports forks and the validator allows them, but nothing authored uses them yet.
2. **Exactly one fight per board**, and it is the boss.
3. **The boss is a STOP, immediately before the finish.** No roll may skip it — *"if the stop node is on the way, it will have to encounter that"* — which is why the validator rejects any board where the finish is reachable without passing the boss.
4. **One or two loot tiles per 8–9 tiles.** Coin 1,000–3,000, or 1–5 training manuals.
5. **No heal tiles.** With a single fight there is nothing to heal between. If a board ever gains a second fight, heals become a live question again — raise it then.
6. **Movement is three orbs, each an independent 1–6**, and spending one re-rolls only that orb. A board's length interacts with this directly: see below.

## The arithmetic to do before proposing a length

Average roll is 3.5, so a board of N tiles takes roughly **N / 3.5 moves** to cross. That gives the useful numbers:

| Length | Moves to cross | Reads as |
| --- | --- | --- |
| 5 | ~1–2 | A single location. One decision at most. |
| 10 | ~3 | A place and its surroundings. |
| 15 | ~4–5 | A journey with stages. |
| 20 | ~6 | A long trek. Watch for tedium. |

**Below about 5 tiles the orbs stop mattering** — one tap crosses the board and the choice is fake. Above about 20, a player is tapping through empty ground. Say so plainly when a requested length falls outside that, then build what he asked for.

## Consulting well

The point of this skill is to be useful *before* the numbers are fixed. Ask about geography, not gameplay:

- How far do the characters actually travel in this part? One room, one town, or a road?
- Does the part have distinct stages (a departure, a crossing, an arrival), or is it one continuous place? Stages argue for length; a single place argues against it.
- Is the fight the climax of the part, or an incident along the way? A climax wants ground in front of it.

Then state a recommendation with the moves-to-cross figure attached, and name what you'd cut if he wanted it shorter.

## Changing lengths

Edit `ROUTE_STEPS_BY_PART` in `lib/game/route.ts`. Parts absent from the table fall back to `DEFAULT_ROUTE_STEPS` (10), which is deliberately a modest guess rather than a sprawling one. Update `tests/route.test.ts`'s per-part assertions in the same change, or the table and its tests drift.

Prefer the table over authoring `route` data by hand. A generated board is stable — placement is seeded off the chapter id, so the same chapter always yields the same board — and 37 hand-written graphs is churn nobody can keep consistent. Author a `route` only when a specific chapter needs a shape the generator can't express, and say in the chapter's JSON why.

## Verifying

`npx vitest run tests/route.test.ts` covers the movement rules, the STOP guarantee, and that **every one of the 37 authored chapters produces a board that can be walked start to finish**. Any length change re-runs that whole sweep, which is the point: a new number can't quietly produce an unwalkable board.
