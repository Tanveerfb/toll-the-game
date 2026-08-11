/**
 * Account rank — the player-level ladder, distinct from character level.
 *
 * Bands of 20 to a cap of 60 (Tanveer, 2026-08-11), so two walls: 20 and 40.
 * A wall is cleared by an ascension trial in the Genshin sense; until it is,
 * XP still accrues but the rank stops climbing, which is what makes the wall a
 * wall rather than a speed bump.
 *
 * This deliberately mirrors character ascension — a band gate that must be
 * paid before the next stretch of levels opens — so players learn the shape
 * once and it applies twice.
 */

/** Ranks per band. */
export const RANK_BAND_SIZE = 20;

/** Highest rank reachable for now. Bands beyond this aren't costed. */
export const MAX_ACCOUNT_RANK = 60;

/** Ranks at which a trial must be cleared before the rank can rise further. */
export const RANK_WALLS: readonly number[] = [20, 40];

/** XP for the first rank-up. */
export const BASE_RANK_XP = 100;

/** Each rank's bar is this much longer than the one before (Tanveer,
 *  2026-08-11: "the level bar would increase by 10% for each level"). */
export const RANK_XP_GROWTH = 1.1;

/**
 * XP to go from `rank` to `rank + 1` — 100 for the first, compounding 10% a
 * rank after that.
 *
 * Geometric, so the far end is steep: rank 59→60 costs ~28,900 and the full
 * climb to 60 is ~317,000. That is a deliberate consequence of the growth
 * rate, not an accident, but it does mean the XP *economy* has to grow with
 * it — see `docs/STATUS.md` for the arithmetic against current chapter
 * payouts.
 */
export function xpToNextRank(rank: number): number {
  return Math.round(
    BASE_RANK_XP * Math.pow(RANK_XP_GROWTH, Math.max(1, rank) - 1),
  );
}

/** Total XP to climb from rank 1 to `rank`. Useful for pacing sums. */
export function totalXpToRank(rank: number): number {
  let total = 0;
  for (let r = 1; r < Math.max(1, rank); r += 1) total += xpToNextRank(r);
  return total;
}

/** The band a rank sits in, 1-based. */
export function bandOfRank(rank: number): number {
  return Math.floor((Math.max(1, rank) - 1) / RANK_BAND_SIZE) + 1;
}

/**
 * Whether this rank is against a wall that hasn't been cleared yet.
 *
 * `clearedWalls` holds the ranks whose trials are done, so a save can't be
 * confused by later reordering of `RANK_WALLS`.
 */
export function isRankWalled(rank: number, clearedWalls: number[]): boolean {
  if (rank >= MAX_ACCOUNT_RANK) return true;
  return RANK_WALLS.includes(rank) && !clearedWalls.includes(rank);
}

export interface AccountProgress {
  rank: number;
  xp: number;
}

/**
 * Applies XP, chaining rank-ups until a wall or the cap stops it.
 *
 * XP is NOT discarded at a wall — it banks, so clearing the trial immediately
 * pays out everything earned while stuck. Throwing it away would punish
 * players for continuing to engage, which is the opposite of what a retention
 * gate is for.
 */
export function grantAccountXp(
  progress: AccountProgress,
  amount: number,
  clearedWalls: number[] = [],
): AccountProgress {
  if (amount <= 0) return progress;
  let { rank, xp } = progress;
  xp += Math.floor(amount);

  while (!isRankWalled(rank, clearedWalls) && xp >= xpToNextRank(rank)) {
    xp -= xpToNextRank(rank);
    rank += 1;
  }
  return { rank, xp };
}

/** Total XP banked toward the next rank, and what that next rank costs — null
 *  when the rank can't currently rise. */
export function rankProgress(
  progress: AccountProgress,
  clearedWalls: number[] = [],
): { current: number; required: number } | null {
  if (isRankWalled(progress.rank, clearedWalls)) return null;
  return { current: progress.xp, required: xpToNextRank(progress.rank) };
}
