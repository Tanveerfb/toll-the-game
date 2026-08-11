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
 * 2. Rewards scale **faster** than difficulty. If tougher enemies pay
 *    proportionally, raising the dial is work for no gain and nobody opts in.
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
 * TUNING — Tanveer, 2026-08-11: "we will fine tune the difficulty and reward
 * scaling later." Difficulty 1 is pinned to level 1 so every currently
 * authored encounter keeps exactly the stats it was tuned with; the step is
 * the placeholder. Eight per level puts difficulty 4 at enemy level 25,
 * roughly a fully-ascended Lv40 roster's match.
 */
export const ENEMY_LEVEL_PER_DIFFICULTY = 8;

export function enemyLevelForDifficulty(difficulty: number): number {
  const clamped = clampDifficulty(difficulty);
  return 1 + (clamped - 1) * ENEMY_LEVEL_PER_DIFFICULTY;
}

/**
 * Reward multiplier at a given difficulty.
 *
 * TUNING, same caveat. Deliberately steeper than the stat curve: difficulty 4
 * is ~1.4x enemy stats but pays 2.05x, so the dial is worth turning. If these
 * two ever cross the wrong way the feature is actively hostile.
 */
export const REWARD_BONUS_PER_DIFFICULTY = 0.35;

export function rewardMultiplierForDifficulty(difficulty: number): number {
  return 1 + REWARD_BONUS_PER_DIFFICULTY * (clampDifficulty(difficulty) - 1);
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
