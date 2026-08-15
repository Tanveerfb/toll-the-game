import { MAX_ACCOUNT_RANK, RANK_BAND_SIZE } from "@/lib/game/accountRank";

/**
 * World level — the difficulty dial.
 *
 * Unlocked by account rank, chosen by the player. Four levels for now, one per
 * band boundary: WL1 from the start, WL2 at rank 20, WL3 at 40, WL4 at 60
 * (Tanveer, 2026-08-11).
 *
 * Two rules make this a choice rather than a treadmill:
 *
 * 1. It is **adjustable downward**. A one-way ratchet strands a player who
 *    out-ranked their roster, which is the single most complained-about part
 *    of the system this borrows from.
 * 2. A harder setting must **pay better**. This used to be a reward multiplier
 *    here; it is now the world boss's authored per-difficulty reward tables
 *    (ruling #81), enforced by a tier-progression test in
 *    `tests/worldBossRewards.test.ts`. The intent survived, the coefficient
 *    did not — it was displayed on the boss brief and never applied, and the
 *    only path that ever implemented it (story) never passed a value.
 *
 * This module now answers one question only: **how hard is the fight**. What
 * it pays lives with the content.
 *
 * Story chapters additionally carry their own `baseDifficulty` floor, so a
 * later chapter is never as easy as chapter one however the dial is set — see
 * `effectiveDifficulty`.
 */

export const MIN_WORLD_LEVEL = 1;
export const MAX_WORLD_LEVEL = 4;

/** Highest world level this account rank has unlocked. */
export function worldLevelCapForRank(rank: number): number {
  const unlocked =
    1 + Math.floor(Math.min(rank, MAX_ACCOUNT_RANK) / RANK_BAND_SIZE);
  return Math.min(MAX_WORLD_LEVEL, Math.max(MIN_WORLD_LEVEL, unlocked));
}

/**
 * Enemy level at a given difficulty.
 *
 * Difficulty 1 is pinned to level 1 so every currently authored encounter keeps
 * exactly the stats it was tuned with.
 *
 * **25 per level (Tanveer, 2026-08-14), raised from 8.** The old step made the
 * dial far weaker than the thing it was meant to measure itself against: WL4
 * reached 1.407x base stats while a fully-ascended Lv40 roster reaches 2.159x,
 * so the hardest content in the game was *relatively* easier for a maxed
 * account than WL1 is for a fresh one. The comment here claimed WL4 was
 * "roughly a fully-ascended Lv40 roster's match" and was wrong by 53%.
 *
 * What 25 actually produces, measured against `progressedStat`:
 *
 * | | enemy level | enemy multiplier | player band it answers |
 * | --- | ---: | ---: | --- |
 * | WL1 | 1 | 1.000x | Lv1 / asc0 (1.000x) |
 * | WL2 | 26 | 1.424x | Lv20 / asc1 (1.490x) |
 * | WL3 | 51 | 1.847x | Lv30 / asc2 (1.824x) |
 * | WL4 | 76 → **clamped to LEVEL_CAP 60** | 2.000x | Lv40 / asc3 (2.159x) |
 *
 * The ladder lands one world level per ascension band, which is the shape the
 * rank gates already imply. Note WL4 **clamps**: `levelMultiplier` stops paying
 * out past level 60, so 76 and 60 are the same fight, and a maxed roster still
 * sits 8% above the hardest setting. Closing that last gap needs enemies to
 * carry an ascension term too, not a bigger step here — deliberately not built,
 * since nothing yet asks for it.
 */
export const ENEMY_LEVEL_PER_DIFFICULTY = 25;

export function enemyLevelForDifficulty(difficulty: number): number {
  const clamped = clampDifficulty(difficulty);
  return 1 + (clamped - 1) * ENEMY_LEVEL_PER_DIFFICULTY;
}

export function clampDifficulty(difficulty: number): number {
  return Math.min(
    MAX_WORLD_LEVEL,
    Math.max(MIN_WORLD_LEVEL, Math.floor(difficulty) || MIN_WORLD_LEVEL),
  );
}

/**
 * A part's authored difficulty floor, from its order in the arc.
 *
 * Tanveer, 2026-08-11: difficulty 1 through the end of part 5, difficulty 2
 * from part 6 to part 10. Derived rather than stored so adding a part doesn't
 * mean remembering to set a field — a chapter may still override it, and
 * anything past part 10 holds at the last known band until he says otherwise.
 */
export function baseDifficultyForPart(order: number): number {
  if (order <= 5) return 1;
  return 2;
}

/**
 * What a piece of content actually runs at.
 *
 * The chapter's own `baseDifficulty` is a floor, not a suggestion: a player at
 * world level 1 still faces a chapter authored at difficulty 3 on its own
 * terms. Above that floor the player chooses, up to whatever their rank has
 * unlocked. So the floor rises with the story and the ceiling rises with the
 * account, and the dial only ever adds an option — it can never take the easy
 * path away from someone who just wants to read.
 */
export function effectiveDifficulty({
  baseDifficulty = MIN_WORLD_LEVEL,
  chosen,
  cap,
}: {
  baseDifficulty?: number;
  chosen: number;
  cap: number;
}): number {
  const floor = clampDifficulty(baseDifficulty);
  const ceiling = Math.max(floor, clampDifficulty(cap));
  return Math.min(ceiling, Math.max(floor, clampDifficulty(chosen)));
}

/** The difficulties a player may actually pick for this content. */
export function availableDifficulties({
  baseDifficulty = MIN_WORLD_LEVEL,
  cap,
}: {
  baseDifficulty?: number;
  cap: number;
}): number[] {
  const floor = clampDifficulty(baseDifficulty);
  const ceiling = Math.max(floor, clampDifficulty(cap));
  const out: number[] = [];
  for (let d = floor; d <= ceiling; d += 1) out.push(d);
  return out;
}
