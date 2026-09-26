import {
  BASE_PROGRESSION,
  progressedStats,
  type CoreStats,
  type Progression,
} from "@/lib/game/progression";
import { stageAdjustedStats } from "@/lib/game/stageEffects";
import type { StageEffect } from "@/types/stageEffects";

/**
 * The one path from a statline to the numbers a unit fights at:
 * **catalog (or phase) stats → progression → stage effects**, in that order.
 * Progression is intrinsic to the unit; a stage effect is the encounter
 * modifying whatever the unit turned up as.
 *
 * **Why this exists (2026-09-26).** There were three copies of this sequence
 * and two screens that skipped it:
 *
 * - `BattleProvider` did both steps.
 * - The simulator did both steps again, by hand.
 * - `enterBossPhase` did **neither**, so every later boss phase fought at its
 *   raw JSON stats. Molvarr's second phase was 10,000 / 400 / 230 at every
 *   difficulty; at difficulty 2 and up he got weaker when he broke. Tanveer
 *   found it on the world boss: *"difficulty two does not change the stats
 *   even though the boss levels up."*
 * - The boss brief and the team picker printed catalog stats.
 *
 * Anything that shows or builds a unit's combat stats goes through here.
 * `tests/battleStats.test.ts` pins the phases to it.
 */
export function battleStats(
  base: CoreStats,
  {
    progression = BASE_PROGRESSION,
    stageEffects = [],
    side,
  }: {
    progression?: Progression;
    stageEffects?: StageEffect[];
    side: "player" | "enemy";
  },
): CoreStats {
  return stageAdjustedStats(progressedStats(base, progression), stageEffects, side);
}

/**
 * The progression a built unit carries, for rebuilding its stats mid-fight
 * (a boss entering its next phase). Absent fields mean the unit was built at
 * base, which is what every hand-made test fixture is.
 */
export function unitProgression(unit: {
  level?: number;
  ascension?: number;
}): Progression {
  return {
    level: unit.level ?? BASE_PROGRESSION.level,
    ascension: unit.ascension ?? BASE_PROGRESSION.ascension,
  };
}
