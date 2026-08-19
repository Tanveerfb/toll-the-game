# Plans

Specced-but-unbuilt work. Tanveer builds these in **dedicated sessions** — don't
start one mid-conversation.

Every file here is written to be executed cold: what prompted it, what the code
does today with file:line, what is already done so nobody redoes it, what is
still his to decide, and how to verify. A plan whose code has since changed is
**stale and says so, or goes** — same rule as the project skills.

All five came out of one session, 2026-08-20, mapping Dokkan kits onto our engine
to learn its wording. **They are independent** — none blocks another, and they
can ship in any order.

## Ready to build — no decisions pending

| Spec | What | Size |
|---|---|---|
| [substat-stats-arrays](2026-08-20-substat-stats-arrays.md) | Readers matching on `entry.stat` silently drop entries authored as `stats: [...]` — the shape ruling #55 actively encourages. Three instances were fixed on 2026-08-20; two remain, currently latent. Also closes evade and damage reduction ignoring debuffs | Two functions in `stats.ts`, one in `evade.ts` |
| [placeholder-disambiguation](2026-08-20-placeholder-disambiguation.md) | `[buff.duration]` resolves to the **first** mechanic of a type, so a skill with two buffs of different durations can't be authored without literal numbers. `[x-ranked]` would disambiguate but takes no field | One regex + one forwarded argument. `resolveMechanicField` already accepts the field |
| [mechanic-application](2026-08-20-mechanic-application.md) **Part B** | A self-buff can't land *after* the hit. Must be gated on connecting and applied **once** however many enemies were struck | Split one loop; hoist a "did anything connect" flag |
| [mechanic-application](2026-08-20-mechanic-application.md) **Part A** | A mechanic declares who it hits (`self` / `oneAlly` / `allies` / `alliesExceptSelf` / `enemies`), ranked where needed. Default is **self**, which inverts today's fallback | Largest of the five — rewrites how every mechanic branch finds its subject |
| [passive-structure](2026-08-20-passive-structure.md) | One passive per character, restructured as **blocks** each with its own trigger. Molvarr's 3 and 4 phase passives collapse to one per phase; the playable/boss split disappears. Plus target-tag conditions | 105 `.passive` call sites — build a flattener first |

## Needs a decision first

| Spec | What | Open |
|---|---|---|
| [guard-and-effective](2026-08-20-guard-and-effective.md) | Paired type-matchup overrides — Guard forces the disadvantaged multiplier, Effective floors it at neutral, both present cancel to 1.0. `critical` bypasses both (ruling #111) | One detail: do two sources of Guard stack, or is it a fixed floor? |

Everything else is settled. [mechanic-application](2026-08-20-mechanic-application.md)
**Part A** and [passive-structure](2026-08-20-passive-structure.md) had their last
questions answered 2026-08-20 and are ready to build — Part A is simply the
largest of the five, and passive-structure carries a 105-call-site migration.

**Parts A and B share a file** because both restructure the same region of
`executeSkill` — the self-buff loop at `combat.ts:556` and the `targets.forEach`
after it. Building them separately means restructuring it twice. B is smaller and
unblocked; if only one ships, ship B.

## Highest-value thing not yet specced

**Counting the character's own attacks.** Three separate Dokkan passive blocks
collapse into this one missing mechanic, and Tanveer rewrote a fourth around it
(*"every time after launching 4 attacks in battle"*), which removes the need for
an on-enter trigger entirely.

The shape is well established — repeating, capped, stat-shifting — but every
existing counter has the wrong subject: `statShiftAfterAttacks` and
`chargedStacks` count attacks **received**, `momentumStacks` counts cards the
**team** plays. Nothing counts what this character did.

Details in [passive-structure §5](2026-08-20-passive-structure.md), recorded as
roadmap rather than as a gap.

## Verification, for all of them

- `npm run check` — baseline **1,235 passing / 98 files** as of 2026-08-20.
- Build with `NEXT_DIST_DIR` set. **:3000 is his dev server — never start or kill
  one.**
- **The visual pass is his.** Several of these touch `lib/game/combat.ts`, the
  most ruling-dense file in the repo; a green suite is necessary and not
  sufficient there.
