import {
  MAX_ACCOUNT_RANK,
  RANK_WALLS,
  rankProgress,
} from "@/lib/game/accountRank";
import { MAX_WORLD_LEVEL, worldLevelCapForRank } from "@/lib/game/worldLevel";

/** The account fields every summary reads (a slice of `playerStore.account`). */
export interface AccountSnapshot {
  rank: number;
  xp: number;
  clearedWalls: number[];
}

export interface RankSummary {
  /** `null` means walled: XP banks but the rank cannot rise until the band's
   *  ascension trial is cleared. */
  progress: { current: number; required: number } | null;
  walled: boolean;
  /** 0–100. A walled bar reads full, so it never looks like a stuck bar. */
  percent: number;
  /** The rank the bar is filling towards, clamped to the cap. */
  nextRank: number;
}

/**
 * Rank bar numbers, derived once. The top bar and the profile page each used
 * to recompute these from `rankProgress`, so the walled case and the percent
 * clamp existed twice.
 */
export function summariseRank(account: AccountSnapshot): RankSummary {
  const progress = rankProgress(account, account.clearedWalls);
  return {
    progress,
    walled: progress === null,
    percent: progress
      ? Math.min(100, (progress.current / progress.required) * 100)
      : 100,
    nextRank: Math.min(account.rank + 1, MAX_ACCOUNT_RANK),
  };
}

export interface WorldLevelSummary {
  /** Highest world level this rank has unlocked. */
  cap: number;
  atMaximum: boolean;
  /** The next rank wall above this rank, if any. */
  nextWall: number | undefined;
}

/** What limits the world level at this rank, and what lifts the limit. */
export function summariseWorldLevel(rank: number): WorldLevelSummary {
  const cap = worldLevelCapForRank(rank);
  return {
    cap,
    atMaximum: cap >= MAX_WORLD_LEVEL,
    nextWall: RANK_WALLS.find((wall) => wall > rank),
  };
}
