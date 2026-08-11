import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETREAT_PERCENT,
  allDown,
  enemyAtRetreatThreshold,
  evaluateBattleOutcome,
} from "@/lib/game/victoryCondition";

/**
 * Battles the story says you don't win (Tanveer, 2026-08-11): the fight still
 * happens, and it ends as a victory once the enemy drops to a threshold — 20%
 * by default. The chapter's panels carry what actually happened.
 *
 * Everything shipped before this leaves the threshold unset, so the old
 * kill-everything rule has to survive untouched. That's the first case here.
 */

const unit = (currentHP: number, hp = 100) => ({ currentHP, hp });

describe("no threshold — the rule every existing battle uses", () => {
  it("is undecided while anything on either side lives", () => {
    expect(
      evaluateBattleOutcome({
        playerTeam: [unit(50)],
        enemyTeam: [unit(1)],
      }),
    ).toBeNull();
  });

  it("needs every enemy at zero, not just most of them", () => {
    expect(
      evaluateBattleOutcome({
        playerTeam: [unit(50)],
        enemyTeam: [unit(0), unit(0), unit(1)],
      }),
    ).toBeNull();
    expect(
      evaluateBattleOutcome({
        playerTeam: [unit(50)],
        enemyTeam: [unit(0), unit(0), unit(0)],
      }),
    ).toBe("victory");
  });

  it("counts a living bench as still in the fight", () => {
    // Subs have always counted toward defeat; a side isn't beaten while one
    // is waiting to come on.
    expect(allDown([unit(0), { ...unit(40), isSub: true }])).toBe(false);
  });
});

describe("retreat threshold", () => {
  it("does not fire above the line", () => {
    expect(enemyAtRetreatThreshold([unit(21)], 20)).toBe(false);
  });

  it("fires exactly on the line", () => {
    expect(enemyAtRetreatThreshold([unit(20)], 20)).toBe(true);
  });

  it("pools the whole side rather than watching one unit", () => {
    // Otherwise focusing one enemy would end a three-unit fight while the
    // other two stand untouched.
    const team = [unit(10), unit(100), unit(100)];
    expect(enemyAtRetreatThreshold(team, 20)).toBe(false);
    expect(enemyAtRetreatThreshold([unit(10), unit(30), unit(20)], 20)).toBe(
      true,
    );
  });

  it("counts a dead unit as zero, so kills push toward it", () => {
    expect(enemyAtRetreatThreshold([unit(0), unit(40)], 20)).toBe(true);
  });

  it("never fires when the chapter set no threshold", () => {
    expect(enemyAtRetreatThreshold([unit(1)], undefined)).toBe(false);
  });
});

describe("evaluateBattleOutcome with a threshold", () => {
  it("wins early with the enemy still standing", () => {
    const outcome = evaluateBattleOutcome({
      playerTeam: [unit(80)],
      enemyTeam: [unit(15)],
      retreatPercent: DEFAULT_RETREAT_PERCENT,
    });
    expect(outcome).toBe("victory");
  });

  it("still lets you lose a battle you were never meant to win", () => {
    // Molvarr can absolutely kill you on the way to 20%.
    expect(
      evaluateBattleOutcome({
        playerTeam: [unit(0), unit(0)],
        enemyTeam: [unit(15)],
        retreatPercent: 20,
      }),
    ).toBe("defeat");
  });

  it("resolves a mutual knockout as a defeat, not a threshold win", () => {
    // Both conditions are true in the same commit. If the threshold won that
    // race, wiping your own team on the killing blow would read as a victory.
    expect(
      evaluateBattleOutcome({
        playerTeam: [unit(0)],
        enemyTeam: [unit(0)],
        retreatPercent: 20,
      }),
    ).toBe("defeat");
  });

  it("defaults to 20 percent", () => {
    expect(DEFAULT_RETREAT_PERCENT).toBe(20);
  });
});
