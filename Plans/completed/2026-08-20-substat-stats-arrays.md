# Spec — substat readers that miss `stats` arrays

> **BUILT 2026-08-20.** Shipped as `entryTouchesStat` in `lib/game/stats.ts` (explicit `allCounts` flag), with both damage-modifier readers and `getEvadeChance` migrated onto it and debuff handling added. Tests: `tests/substats.test.ts`. The text below is the record of why, kept as written.

**Status:** built 2026-08-20 (see the banner above). **Latent** — no shipped kit reaches the
two remaining cases. Small, mechanical, no open decisions.

**One sentence:** an effect covering several stats is authored as
`stats: ["atk","evade"]` with no `stat` field, and every reader that matches on
`entry.stat` alone silently drops the whole entry.

---

## 1. The failure family

Ruling **#55** says "raises ATK and DEF" is **one** buff — one entry, one pill,
one thing to cleanse — authored `stats: ["atk","def"]`. So the `stats` array is
the *encouraged* shape, and any reader keyed on the singular `stat` field misses
it entirely. The entry sits in the data, renders on the card, and does nothing.

This bit **three times on 2026-08-20 alone**, all found while mapping Dokkan kits:

| Reader | Symptom | Status |
|---|---|---|
| `lib/game/evade.ts` | Merging Chiara's ultimate into one entry took her dodge to **0** while the card still advertised 33% | **Fixed** |
| `getCritChance` (`combat.ts:79`) | Never called `effectiveSubstat` at all, so every crit-chance buff was inert | **Fixed** (ruling #16) |
| `damagePreview.ts` | Array-authored self-buffs left out of the estimate, understating **Duke's Surge** and **Killua's ultimate** since they were written | **Fixed** |

`effectiveSubstat` (`lib/game/substats.ts`) is the one path that always handled
it, because it goes through `entryAffectsStat` (`lib/game/stats.ts:33`), which
checks `entry.stats?.includes(stat)`.

## 2. What is still broken

Two readers in `lib/game/stats.ts`, both matching on `buff.stat` only:

```ts
// :129  getDamageDealtMultiplier
if (buff.stat === "damageDealt") { … }        // buffs
if (debuff.stat === "damageDealt") { … }      // debuffs

// :144  getDamageReductionMultiplier
if (buff.stat === "damageReduction") { … }    // buffs only
```

**Latent today.** Exactly one kit entry in the game puts a substat in a `stats`
array — Chiara's `["atk","evade"]` — and that reader is fixed. Nothing authors
`damageDealt` or `damageReduction` in an array yet.

It stops being latent the moment a kit does, and the Dokkan corpus points
straight at it: *"Chance of performing a critical hit, chance of evading enemy's
attack & damage reduction rate 33%"* is one value covering three substats,
including damage reduction.

### Settled — evade and damage reduction must read debuffs too

Both currently consume **buffs only**:

- `getDamageReductionMultiplier` (`stats.ts:144`) — its twin
  `getDamageDealtMultiplier` reads debuffs as well, so the pair is asymmetric.
- `getEvadeChance` (`evade.ts`) — the 2026-08-20 fix deliberately kept the change
  minimal and added `stats`-array support **without** debuff handling, leaving
  evade the only substat that ignores them.

Tanveer, 2026-08-20: *"we do have to fix evade and DR parts too."* So both gain
debuff subtraction, clamped at 0, matching what `effectiveSubstat` already does
for crit damage, lifesteal and recovery rate.

No kit authors an evade or DR debuff today, so this changes nothing on the
current roster — it removes two exceptions before a kit relies on the wrong one.

## 3. Fix

Match `stat` **and** `stats` in both functions. Do **not** reach for
`entryAffectsStat` blindly: it honours `stat: "all"`, and ruling #55 places
**damage reduction and evade chance outside "all stats"**. `damageDealt` is
likewise a damage modifier rather than a stat (#36), so `"all"` must not reach
any of the three.

That is why `evade.ts` got a local `touchesEvade` helper instead of the shared
matcher — the same pattern applies here. A shared helper is fine if it takes an
explicit "does `all` count?" argument rather than deciding for the caller.

## 4. The rule worth carrying forward

**When adding any reader for a stat, match `stat` and `stats`, and decide
explicitly whether `"all"` should reach it.** Recorded in ruling **#55**.

The trap is structural, not careless: the one-effect-one-entry rule actively
pushes authors toward `stats` arrays, so every new reader is exposed to it by
default, and the failure is always silent.

## 5. Verification

- A buff authored `stats: ["atk","damageReduction"]` reduces incoming damage.
- A buff authored `stats: ["atk","damageDealt"]` raises outgoing damage.
- `stat: "all"` reaches **neither** — that assertion is the one protecting #55.
- Existing behaviour unchanged for `stat: "damageReduction"` (Mustafa's Fortress,
  Iron Wall) and every `damageDealt` modifier (Sara's `[Female]` synergy, #35).
- A debuff lowers evade and damage reduction, and neither goes below 0 — the
  two exceptions closed per §2.
- `npm run check` — baseline **1,235 passing / 98 files** as of 2026-08-20.
