# Plans

Specced-but-unbuilt work. Tanveer builds these in **dedicated sessions** — don't
start one mid-conversation.

Every file here is written to be executed cold: what prompted it, what the code
does today with file:line, what is already done so nobody redoes it, what is
still his to decide, and how to verify. A plan whose code has since changed is
**stale and says so, or goes** — same rule as the project skills.

## Open

Nothing. All five specs written 2026-08-20 were built the same day and moved to
[`completed/`](completed/).

## Completed

Built 2026-08-20, in this order. Each file is kept as written — the record of
what was decided and why — and none describes unbuilt work any more.

| Spec | What shipped |
|---|---|
| [substat-stats-arrays](completed/2026-08-20-substat-stats-arrays.md) | `entryTouchesStat` with an explicit "does `all` count?" flag; `getDamageDealtMultiplier` and `getDamageReductionMultiplier` now read `stats` arrays; evade and damage reduction read debuffs, clamped |
| [placeholder-disambiguation](completed/2026-08-20-placeholder-disambiguation.md) | `[x-ranked.duration]` — positional refs take a field, so two mechanics of the same type are both addressable. Zero-clause dropping (#44) follows |
| [guard-and-effective](completed/2026-08-20-guard-and-effective.md) | `resolveTypeModifier` (ruling #111). Guard on the defender, Effective on the skill, both cancelling to 1.0; `critical` bypasses both by construction. **No kit authors either word — that is his call** |
| [passive-structure](completed/2026-08-20-passive-structure.md) | One passive made of blocks, one registration per block, `lib/game/passiveBlocks.ts` as the only reader. Plus `targetTagBonus`, an attacker's passive reading the target's tags (ruling #114) |
| [mechanic-application](completed/2026-08-20-mechanic-application.md) | **Part A** `applyTo` / `applyToRanked` with self as the default audience (ruling #112); **Part B** `requiresDamage`, a self buff that lands after the hit and only once (ruling #113) |

### Deliberately left out of those builds

- **`aoe` narrowing to enemies-only** (mechanic-application A4d). A heal skill's
  targets still come from `aoe` plus the skill type, because a heal amount has
  no audience of its own — narrowing `aoe` first would aim every ally heal at
  the enemy team. `aoeRanked` stays on Leorio and Siddiq for the same reason.
  Recorded in ruling #112.
- **Rewriting Molvarr's phase passives as blocks.** The array form still loads
  and flattens identically; converting it is authoring cosmetics with real
  transcription risk, and buys nothing the block reader doesn't already give.
- **Guard stacking.** Built as a fixed floor — a second source of Guard changes
  nothing. Still unconfirmed by him (`completed/2026-08-20-guard-and-effective.md` §5).

## Highest-value thing not yet specced

**Counting the character's own attacks.** Three separate Dokkan passive blocks
collapse into this one missing mechanic, and Tanveer rewrote a fourth around it
(*"every time after launching 4 attacks in battle"*), which removes the need for
an on-enter trigger entirely.

The shape is well established — repeating, capped, stat-shifting — but every
existing counter has the wrong subject: `statShiftAfterAttacks` and
`chargedStacks` count attacks **received**, `momentumStacks` counts cards the
**team** plays. Nothing counts what this character did.

Details in [passive-structure §5](completed/2026-08-20-passive-structure.md),
recorded as roadmap rather than as a gap.

## Verification, for anything new

- `npm run check` — baseline **1,270 passing / 101 files** as of 2026-08-20,
  after the five builds.
- Build with `NEXT_DIST_DIR` set. **:3000 is his dev server — never start or kill
  one.**
- **The visual pass is his.** Several of these touch `lib/game/combat.ts`, the
  most ruling-dense file in the repo; a green suite is necessary and not
  sufficient there.
