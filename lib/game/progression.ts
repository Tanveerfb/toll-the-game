/**
 * Character progression applied to battle stats.
 *
 * The curve was specced in `docs/design/WORLD_BOSS_AND_ASCENSION_PLAN.md` long
 * before this file existed; `level`, `ascension` and `ultLevel` have been
 * stored on `playerStore` and consumed by nothing. Battle read stats straight
 * off the catalog JSON, so a maxed character fought exactly as hard as a
 * freshly pulled one.
 *
 * Two deliberate departures from that document, both approved 2026-08-11:
 *
 * 1. The doc computes a rounded per-level constant, `round(base / 59)`.
 *    Integer rounding systematically shortchanges small stats — Ban's 80 DEF
 *    reaches 1.74x at the cap while Yalina's 4000 HP reaches exactly 2.00x, so
 *    the stat a character has least of grows slowest, which punishes the very
 *    characters built around a low stat. Rounding the *result* of a multiplier
 *    instead lands every stat on 2.00x regardless of magnitude.
 * 2. The per-band ascension bump was left as "tuning TODO". It is a flat 1/6
 *    of base per band, six bands, summing to the +1x the doc asks for.
 *
 * Nothing currently in the game changes: default progress is level 1 /
 * ascension 0, and ascension 0 caps max level at 1, so every existing
 * character sits at exactly 1.000x.
 */

/** Level reachable at full ascension. Bands 4-6 (Lv50/60) aren't costed yet —
 *  see `lib/game/ascension.ts` — but the CURVE is defined against the eventual
 *  cap, so today's Lv40 ceiling is a partial climb rather than its own scale. */
export const LEVEL_CAP = 60;

/** Ascension bands to the cap, 10 levels each. */
export const ASCENSION_BANDS = 6;

/** Leveling alone doubles a stat across the full climb. */
const LEVEL_GAIN_AT_CAP = 1;

/** Ascension bumps add another full base across all six bands. */
const ASCENSION_GAIN_AT_CAP = 1;

/**
 * The leveling portion, 1.000 at level 1 rising linearly to 2.000 at the cap.
 * Levels beyond the cap don't keep paying out.
 */
export function levelMultiplier(level: number): number {
  const clamped = Math.min(Math.max(1, level), LEVEL_CAP);
  return 1 + (LEVEL_GAIN_AT_CAP * (clamped - 1)) / (LEVEL_CAP - 1);
}

/** The ascension portion — a flat 1/6 of base per band unlocked. */
export function ascensionMultiplier(ascension: number): number {
  const clamped = Math.min(Math.max(0, ascension), ASCENSION_BANDS);
  return (ASCENSION_GAIN_AT_CAP * clamped) / ASCENSION_BANDS;
}

export interface Progression {
  level: number;
  ascension: number;
}

/** Level 1, unascended — what an unowned or unspecified unit fights at, and
 *  by construction a 1.000x no-op. */
export const BASE_PROGRESSION: Progression = { level: 1, ascension: 0 };

/**
 * A single stat after progression, before any buff or debuff.
 *
 * Buffs stay multiplicative on top of this (see `lib/game/stats.ts`) — this is
 * the base they multiply, not a competing layer.
 */
export function progressedStat(
  base: number,
  { level, ascension }: Progression,
): number {
  return Math.round(
    base * (levelMultiplier(level) + ascensionMultiplier(ascension)),
  );
}

export interface CoreStats {
  hp: number;
  atk: number;
  def: number;
}

/** All three stats on the same curve — no per-stat weighting, since the
 *  multiplier form already scales each stat in proportion to itself. */
export function progressedStats(
  base: CoreStats,
  progression: Progression,
): CoreStats {
  return {
    hp: progressedStat(base.hp, progression),
    atk: progressedStat(base.atk, progression),
    def: progressedStat(base.def, progression),
  };
}

/**
 * Ultimate levels, from gacha dupes.
 *
 * The multiplier grows 60% of its own value across the six levels, so a 500%
 * ultimate reads 500 / 560 / 620 / 680 / 740 / 800 (Tanveer, 2026-08-11). One
 * rule for every playable ultimate — there is no per-character ult curve.
 *
 * `MAX_ULT_LEVEL` deliberately isn't redefined here; it already governs what
 * dupes can award in `lib/gacha/dupes.ts`, and two copies of that ceiling
 * would drift.
 */
const ULT_GAIN_AT_MAX = 0.6;

export function ultMultiplier(ultLevel: number, maxUltLevel: number): number {
  if (maxUltLevel <= 1) return 1;
  const clamped = Math.min(Math.max(1, ultLevel), maxUltLevel);
  return 1 + (ULT_GAIN_AT_MAX * (clamped - 1)) / (maxUltLevel - 1);
}

/** An ultimate's damage multiplier at a given ult level. */
export function scaledUltDamage(
  baseDamage: number,
  ultLevel: number,
  maxUltLevel: number,
): number {
  return Math.round(baseDamage * ultMultiplier(ultLevel, maxUltLevel));
}

/**
 * The damage an ultimate deals at a given ult level.
 *
 * Two shapes, and the authored ladder always wins:
 *
 * 1. **`damageByUltLevel`** — six explicit values, one per level. This is how
 *    every playable ultimate is authored as of 2026-08-14. The curve is not a
 *    fixed percentage: Mustafa climbs 200 → 500 (+150%) while Meliodas climbs
 *    450 → 700 (+56%), because a big flat multiplier and a small one shouldn't
 *    grow at the same rate.
 * 2. **`damage` + the uniform `ULT_GAIN_AT_MAX` curve** — the pre-ladder
 *    behaviour, kept for kits that never opt in. Bosses and story NPCs have no
 *    ult level at all, so they always read level 1 and land on `damage`.
 *
 * Out-of-range levels clamp rather than throw: a save carrying a level above
 * the current cap (or below 1) should field the nearest legal ultimate, not
 * crash the battle.
 */
export function ultDamageForLevel(
  ultimate: { damage: number; damageByUltLevel?: number[] },
  ultLevel: number,
  maxUltLevel: number,
): number {
  const ladder = ultimate.damageByUltLevel;
  if (ladder && ladder.length > 0) {
    const index = Math.min(Math.max(1, ultLevel), ladder.length) - 1;
    return ladder[index];
  }
  return scaledUltDamage(ultimate.damage, ultLevel, maxUltLevel);
}
