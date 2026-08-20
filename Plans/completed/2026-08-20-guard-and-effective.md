# Spec — [Guard] and [Effective], a paired type-matchup override

> **BUILT 2026-08-20.** `resolveTypeModifier` in `lib/game/typeAdvantage.ts`, read by `damage.ts`; mechanics `guard` (passive) and `effective` (skill). Guard stacking was built as a fixed floor — §5's open detail, still unconfirmed. **No kit authors either word.** Tests: `tests/typeMatchupOverrides.test.ts`. The text below is the record of why, kept as written.

**Status:** built 2026-08-20 (see the banner above). Tanveer, 2026-08-20: *"we don't have to add that
in our db yet."* Ledger entry: **ruling #111**.

**Neither word exists anywhere in the engine or the kits today** — verified by
grep across `types/mechanic.ts`, `lib/game/`, and all 27 `data/characters/*.json`.
This file is the whole design; there is nothing in the repo to read alongside it.

---

## 1. What they are

Two mirrored mechanics that overrule the type chart (#11) **without touching
element colours**. They came out of mapping a Dokkan AoE super:

> Greatly raises ATK & DEF, causes ultimate damage to all enemies and **attacks
> effective against all Types**

- **Guard**, on the **defender**. His words: *"a char with 'guards all attacks'
  always takes less damage as if it (defender) is type advantaged to the
  attacker, regardless of char's element color."* The attacker's multiplier is
  forced to the disadvantaged value.
- **Effective**, on the **attacker**. His words: *"'attacks effective against all
  types' meaning it (attacker) will do type neutral damage as worst, never
  disadvantage. still will do type advantage damage to disadvantaged elements."*
  The multiplier is floored at neutral; a real advantage still pays out.

They are opposites, and they cancel: *"unless said disadvantaged element char has
guard. in that case, it would be type neutral for it too."*

## 2. The table

Current chart (`lib/game/typeAdvantage.ts`): advantage **1.2**, neutral **1.0**,
disadvantage **0.9**, from the attacker's point of view.

| Attacker has Effective | Defender has Guard | Type multiplier |
|---|---|---|
| no | no | the chart — 1.2 / 1.0 / 0.9 |
| no | yes | **0.9**, whatever the colours |
| yes | no | **max(chart, 1.0)** — never 0.9, still 1.2 where earned |
| yes | yes | **1.0** |

**Cancellation holds in every combination**, including where the attacker was
already at 0.9. Confirmed 2026-08-20 — but *lightly*: his exact answer was "uh
yes. i guess." Settled enough to build; re-ask if it ever plays badly. This is
not a conviction on the level of #109 and should not be defended as one.

## 3. Not `critical` — this is the distinction to keep

They look alike from outside and are unrelated underneath. His correction:

> *"critical is seperate mechanic. it ignores all types and does bonus damage
> based on critdamage. bypasses guard too."*

| | Matchup | Extra |
|---|---|---|
| `critical` | **discarded** entirely, both directions | 50% DEF ignore + crit damage (#16) |
| Effective | **kept**, only its downside removed | none |

So `critical` also **bypasses Guard**, which means **Guard offers no protection
against a crit**. Deliberate, not an oversight — record it in whatever UI copy
explains Guard, or players will read it as a bug.

## 4. Where it goes

One place: `lib/game/damage.ts`, the line that applies the modifier.

```ts
// damage.ts, currently ~line 84
if (!criticalMechanic) {
  damageTaken *= getTypeModifier(attackerColor, target.color);
} else {
  // crit package — untouched by this spec
}
```

The change is inside the `!criticalMechanic` branch only, which is what makes
"critical bypasses both" fall out for free rather than needing its own guard.

Suggested shape — a pure function next to `getTypeModifier` so it is testable on
its own:

```ts
export function resolveTypeModifier(
  attacker: Color | undefined,
  defender: Color | undefined,
  opts: { attackerEffective: boolean; defenderGuard: boolean },
): number
```

`getTypeModifier` stays as the raw chart lookup; the override wraps it. Do not
fold the flags into the chart itself — the chart is quoted in #11 and read by
tests and docs as the plain matchup.

**No targeting is involved**, so this is fully independent of
`Plans/2026-08-20-mechanic-application.md` and can land in any session, before or
after it.

## 5. Settled, and one detail left

- **Where the flags live — SETTLED 2026-08-20: both.** **Effective** is a
  **skill mechanic**, read from `skillMechanics` — "this attack is effective
  against all types" is a property of the card. **Guard** is a **character
  passive**, read from the defender — a unit either guards or it doesn't. Each
  reads the way it naturally does, at the cost of two lookups in the resolver
  rather than one.
- **Stacking.** Two sources of Guard on one unit — same as one, presumably,
  since the effect is a fixed floor rather than a magnitude. Worth stating so a
  future kit does not try to author "double Guard".
- **Wording.** Undecided, and deliberately so: per #65 a description must never
  name a mechanic the engine lacks, so nothing goes in `kitwords` until this
  ships. When it does, both need a glossary entry — the effect is invisible in
  the damage number and a player cannot infer it from the card.

## 6. Verification, when built

- Unit tests on the resolver: all four rows of §2, across every colour pair in
  the chart including the mutual Dark/Light case.
- A crit against a Guard defender still ignores both, and still applies the crit
  package (#16).
- Effective against a same-colour defender is 1.0, not 1.2 — the floor must not
  become a promotion.
- `npm run check` — baseline **1,235 passing / 98 files** as of 2026-08-20.
- Build with `NEXT_DIST_DIR`. **:3000 is his dev server — never start or kill one.**
