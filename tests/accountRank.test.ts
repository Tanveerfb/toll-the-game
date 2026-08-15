import { describe, expect, it } from "vitest";
import {
  BASE_RANK_XP,
  bandOfRank,
  grantAccountXp,
  isRankWalled,
  MAX_ACCOUNT_RANK,
  RANK_WALLS,
  rankProgress,
  totalXpToRank,
  xpToNextRank,
} from "@/lib/game/accountRank";
import {
  availableDifficulties,
  baseDifficultyForPart,
  effectiveDifficulty,
  enemyLevelForDifficulty,
  MAX_WORLD_LEVEL,
  worldLevelCapForRank,
} from "@/lib/game/worldLevel";
import {
  ascensionMultiplier,
  LEVEL_CAP,
  levelMultiplier,
} from "@/lib/game/progression";

describe("account rank bands", () => {
  it("puts the walls at the band boundaries Tanveer specified", () => {
    expect(RANK_WALLS).toEqual([20, 40]);
    expect(MAX_ACCOUNT_RANK).toBe(60);
  });

  it("groups ranks into bands of twenty", () => {
    expect(bandOfRank(1)).toBe(1);
    expect(bandOfRank(20)).toBe(1);
    expect(bandOfRank(21)).toBe(2);
    expect(bandOfRank(60)).toBe(3);
  });

  it("walls a rank until its trial is cleared", () => {
    expect(isRankWalled(20, [])).toBe(true);
    expect(isRankWalled(20, [20])).toBe(false);
    expect(isRankWalled(19, [])).toBe(false);
  });

  it("treats the cap as a permanent wall", () => {
    expect(isRankWalled(MAX_ACCOUNT_RANK, [20, 40])).toBe(true);
  });
});

describe("the rank XP bar", () => {
  it("costs 100 for the first rank-up", () => {
    expect(xpToNextRank(1)).toBe(BASE_RANK_XP);
  });

  it("grows 10% per rank", () => {
    expect(xpToNextRank(2)).toBe(110);
    expect(xpToNextRank(3)).toBe(121);
  });

  it("compounds all the way to a steep endgame", () => {
    // Documented so the pacing consequence is visible, not a surprise: the
    // last rank alone costs ~250x the first.
    expect(xpToNextRank(59)).toBeGreaterThan(25_000);
    expect(totalXpToRank(20)).toBeGreaterThan(5_000);
    expect(totalXpToRank(60)).toBeGreaterThan(270_000);
  });
});

describe("grantAccountXp", () => {
  it("chains rank-ups through a big payout", () => {
    const result = grantAccountXp({ rank: 1, xp: 0 }, xpToNextRank(1) * 3);
    expect(result.rank).toBeGreaterThan(2);
  });

  it("stops dead at an uncleared wall", () => {
    const result = grantAccountXp({ rank: 19, xp: 0 }, 1_000_000, []);
    expect(result.rank).toBe(20);
  });

  it("banks the overflow rather than discarding it", () => {
    // Throwing XP away at a wall punishes players for continuing to play,
    // which is the opposite of what a retention gate is for.
    const stuck = grantAccountXp({ rank: 20, xp: 0 }, 5_000, []);
    expect(stuck.rank).toBe(20);
    expect(stuck.xp).toBe(5_000);
  });

  it("pays the banked XP out the moment the trial is cleared", () => {
    const stuck = grantAccountXp({ rank: 20, xp: 0 }, 100_000, []);
    const freed = grantAccountXp(stuck, 0, [20]);
    // Zero more XP, but the wall is gone — the next grant should climb.
    expect(freed.rank).toBe(20);
    expect(grantAccountXp(stuck, 1, [20]).rank).toBeGreaterThan(20);
  });

  it("ignores zero and negative grants", () => {
    const before = { rank: 3, xp: 40 };
    expect(grantAccountXp(before, 0)).toEqual(before);
    expect(grantAccountXp(before, -500)).toEqual(before);
  });

  it("reports no progress bar while walled", () => {
    expect(rankProgress({ rank: 20, xp: 300 }, [])).toBeNull();
    expect(rankProgress({ rank: 20, xp: 300 }, [20])).toEqual({
      current: 300,
      required: xpToNextRank(20),
    });
  });
});

describe("world level unlocks", () => {
  it("starts everyone at world level 1", () => {
    expect(worldLevelCapForRank(1)).toBe(1);
    expect(worldLevelCapForRank(19)).toBe(1);
  });

  it("opens one world level per band boundary", () => {
    expect(worldLevelCapForRank(20)).toBe(2);
    expect(worldLevelCapForRank(40)).toBe(3);
    expect(worldLevelCapForRank(60)).toBe(MAX_WORLD_LEVEL);
  });

  it("never exceeds the current ceiling", () => {
    expect(worldLevelCapForRank(999)).toBe(MAX_WORLD_LEVEL);
  });
});

describe("difficulty scaling", () => {
  it("leaves difficulty 1 as today's authored stats", () => {
    // Every existing encounter must keep exactly the numbers it was tuned
    // with, or turning this on silently re-balances the whole game.
    expect(enemyLevelForDifficulty(1)).toBe(1);
  });

  it("raises the enemy monotonically", () => {
    // This module answers "how hard", and nothing else. What a difficulty
    // PAYS is authored per tier with the content now (ruling #81) — the
    // reward multiplier that used to live here was removed 2026-08-13, having
    // been displayed on the boss brief and never applied to anything.
    // `tests/worldBossRewards.test.ts` owns the "harder pays better" rule.
    for (let d = 2; d <= MAX_WORLD_LEVEL; d += 1) {
      expect(enemyLevelForDifficulty(d)).toBeGreaterThan(
        enemyLevelForDifficulty(d - 1),
      );
    }
  });

  it("clamps nonsense difficulties instead of trusting them", () => {
    expect(enemyLevelForDifficulty(0)).toBe(1);
    expect(enemyLevelForDifficulty(99)).toBe(
      enemyLevelForDifficulty(MAX_WORLD_LEVEL),
    );
  });

  // The step was 8 until 2026-08-14, which put WL4 at 1.407x base stats while a
  // fully-ascended Lv40 roster reaches 2.159x — the hardest setting in the game
  // was relatively easier for a maxed account than WL1 is for a fresh one, and
  // the constant's own comment claimed the opposite. 25 lands one world level
  // per ascension band.
  it("puts each world level roughly on an ascension band", () => {
    const enemyMultiplier = (difficulty: number) =>
      levelMultiplier(enemyLevelForDifficulty(difficulty));

    const bands = [
      { level: 1, ascension: 0 },
      { level: 20, ascension: 1 },
      { level: 30, ascension: 2 },
      { level: 40, ascension: 3 },
    ];

    bands.forEach((band, i) => {
      const player = levelMultiplier(band.level) + ascensionMultiplier(band.ascension);
      // Within 10% of the player band it is meant to answer, in either
      // direction — the dial tracks progression rather than outrunning it.
      expect(Math.abs(enemyMultiplier(i + 1) - player) / player).toBeLessThan(0.1);
    });
  });

  it("tops out below a fully-ascended roster, because the level cap clamps it", () => {
    // WL4 asks for enemy level 76; `levelMultiplier` stops paying at LEVEL_CAP
    // 60, so WL4 is 2.000x against a maxed 2.159x. Deliberate and documented —
    // closing the last 8% needs enemies to carry an ascension term, not a
    // bigger step here. This pins that the gap is known, not accidental.
    expect(enemyLevelForDifficulty(MAX_WORLD_LEVEL)).toBeGreaterThan(LEVEL_CAP);
    expect(levelMultiplier(enemyLevelForDifficulty(MAX_WORLD_LEVEL))).toBe(2);
    expect(levelMultiplier(40) + ascensionMultiplier(3)).toBeGreaterThan(2);
  });
});

describe("baseDifficultyForPart", () => {
  it("keeps parts 1-5 at difficulty 1", () => {
    for (const order of [1, 2, 3, 4, 5]) {
      expect(baseDifficultyForPart(order)).toBe(1);
    }
  });

  it("raises parts 6-10 to difficulty 2", () => {
    for (const order of [6, 7, 8, 9, 10]) {
      expect(baseDifficultyForPart(order)).toBe(2);
    }
  });

  it("holds at the last known band past part 10 rather than guessing", () => {
    expect(baseDifficultyForPart(11)).toBe(2);
  });
});

describe("effectiveDifficulty", () => {
  it("lets a player pick within their unlocked range", () => {
    expect(effectiveDifficulty({ chosen: 2, cap: 3 })).toBe(2);
  });

  it("never runs content below its authored floor", () => {
    // A chapter authored at difficulty 3 is faced on its own terms even by a
    // world-level-1 player — the floor rises with the story.
    expect(effectiveDifficulty({ baseDifficulty: 3, chosen: 1, cap: 4 })).toBe(3);
  });

  it("never runs above what the account has unlocked", () => {
    expect(effectiveDifficulty({ chosen: 4, cap: 2 })).toBe(2);
  });

  it("honours the floor even when it exceeds the player's cap", () => {
    // Otherwise a low-rank player would face a hard chapter on easy terms.
    expect(effectiveDifficulty({ baseDifficulty: 3, chosen: 1, cap: 1 })).toBe(3);
  });

  it("offers exactly the choices the player may make", () => {
    expect(availableDifficulties({ cap: 3 })).toEqual([1, 2, 3]);
    expect(availableDifficulties({ baseDifficulty: 2, cap: 3 })).toEqual([2, 3]);
    // Nothing to choose is still a valid, single-option answer.
    expect(availableDifficulties({ baseDifficulty: 3, cap: 1 })).toEqual([3]);
  });
});
