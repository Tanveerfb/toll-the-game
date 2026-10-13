# Substat System (Crit Damage, Recovery Rate, Lifesteal, Crit Resistance) — Design Spec

> 2026-07-24. Approved by Tanveer. Backend/engine-only pass — no UI or kit-lab
> changes this round. Foundational work ahead of upcoming character kits
> (Knuckle Bine, Isaac Netero, Chiara, Isolde — see `author_notes.md`) that
> assume these substats exist.

## Scope (this pass)

**In:**
- 4 new optional character fields: `critDamagePercent` (default 50), `recoveryRatePercent` (default 100), `lifestealPercent` (default 5), `critResistPercent` (default 10).
- Engine wiring so each substat actually affects combat/heal math.
- Buff/debuff support for all 4 (multiplicative stacking, same rule as every other stat).
- Centralized heal helper so Recovery Rate applies consistently everywhere healing happens.
- Test coverage.

**Out (later, if ever):**
- Archive detail page / kit-lab UI surfacing of the 4 substats.
- The "basic stats vs all stats" categorization/grouping system described in `author_notes.md` — explicitly not refactoring `atk`/`def`/`hp` into a unified stats map for this. Not worth the churn; Tanveer can adjust to living with two separate concepts (discrete fields today, category grouping conceptual/display-only whenever it's needed).
- Crit chance / evade chance are unaffected — those already exist and stay exactly as they are; only the 4 substats above are new.

## Schema

`BattleCharacter` (and the character JSON shape) gains 4 optional numeric fields, same pattern as `atk`/`def`/`hp`:

```ts
critDamagePercent?: number;   // default 50 if absent
recoveryRatePercent?: number; // default 100 if absent
lifestealPercent?: number;    // default 5 if absent
critResistPercent?: number;   // default 10 if absent
```

No existing character JSON needs to be edited unless a character should deviate from default.

## Engine wiring

**Crit Damage** — `damage.ts`'s crit-bonus line:
```ts
damageTaken *= 1 + (criticalMechanic.damageBonusPercent ?? getEffectiveCritDamage(attacker)) / 100;
```
Replaces the old hardcoded `?? 50`. Skills that hardcode their own `damageBonusPercent` (e.g. Seras's ult) are untouched — only the generic proc'd-crit path (which pushes a bare `{type:"critical"}` with no explicit values) now reads the attacker's substat. `ignoreDefensePercent` (defense-ignore-on-crit) stays a fixed 50, not tied to any substat — out of scope.

**Crit Resistance** — `combat.ts`'s crit-chance roll:
```ts
const critChance = Math.max(0, getCritChance(updatedSource) - getEffectiveCritResist(updatedTarget));
```
Only affects the probability-based proc (Deathblow-style). Skills with a guaranteed `{type:"critical"}` mechanic bypass the roll entirely already and stay unconditional — crit resistance cannot prevent a guaranteed crit, only lower the odds of a rolled one.

**Lifesteal** — every successful damage instance (skills and counter-hits alike) heals the attacker for their base `lifestealPercent` of that hit, via the new `applyHeal()` helper (below). This is a new unconditional hook in the damage-resolution block, stacking *additively* with any skill-specific `lifesteal`/`healLifesteal` mechanic already firing on that same hit — the two existing mechanics are untouched, the substat is a new layer underneath them.

**Recovery Rate + `applyHeal()`** — new `lib/game/heal.ts` exports:
```ts
function applyHeal(character: BattleCharacter, rawAmount: number, log?: (e: string) => void): { character: BattleCharacter; healed: number }
```
Multiplies `rawAmount` by the character's *current* effective Recovery Rate (recalculated live at the moment of the call, not snapshotted — so a HoT's healing power responds immediately if the recipient's recovery rate changes mid-duration), floors at 0, clamps `currentHP` at `hp` (max HP). Every heal source migrates to call this instead of adding HP directly: skill-level heal mechanics, the existing `lifesteal`/`healLifesteal` mechanics, the HoT tick loop (`tick.ts`), and the lethal-survival heal-back (`lethal.ts`). Molvarr's `bossStatSpike` current-HP rescale is explicitly excluded — that's a proportional stat multiply, not a heal.

## Buff/debuff support

New `lib/game/substats.ts` exports `getEffectiveCritDamage`, `getEffectiveRecoveryRate`, `getEffectiveLifesteal`, `getEffectiveCritResist` — same shape as the existing `getEffectiveAttack`/`getEffectiveDefense` in `stats.ts`. Each reads the character's base field plus any `buffs`/`debuffs` tagged with the matching `stat` key (`"critDamage"`, `"recoveryRate"`, `"lifesteal"`, `"critResist"`), stacking multiplicatively per the existing house rule (never additive, never reaches 0 or runs away). A generic `stat: "all"` buff/debuff does **not** touch these 4 — `"all"` remains basic-stats-only (ATK/DEF/HP), per the 2026-07-24 Molvarr/Leorio wording ruling.

## Testing

New `tests/substats.test.ts`:
- Default fallback values apply when a character JSON omits the fields.
- Each substat stacks multiplicatively under buffs/debuffs.
- Crit Damage substat feeds a proc'd crit but does not override an explicit skill-level `damageBonusPercent`.
- Crit Resistance lowers a target's effective incoming crit chance, floors at 0 (never negative).
- Lifesteal fires on a plain attack with no skill mechanic (base 5%) and stacks additively with Ban's existing 30% skill-level lifesteal on the same hit.
- Recovery Rate scales a flat heal and a HoT tick, and a mid-duration recovery-rate change is reflected on the HoT's *next* tick (proving live recalculation, not snapshot-at-cast).
- `applyHeal` clamps at max HP.

Existing 251 tests must stay green (`npm run check`).
