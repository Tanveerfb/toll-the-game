import { describe, expect, it } from "vitest";
import type { MissionOutcome } from "@/lib/game/stageMissions";
import {
  describeFarm,
  describeFirstClear,
  isEmptyPayout,
  rollStageRewards,
} from "@/lib/game/storyRewards";
import type { StoryMission, StoryStageRewards } from "@/types/story";

/**
 * Stage payouts (story mode v2, 2026-08-18).
 *
 * Two lists, two promises (ruling #80): a **first-clear bundle** of fixed amounts
 * paid exactly once, and a **farm table** of ranges rolled on every clear. Missions
 * are a third, independent one-time payout, so meeting one on the fortieth replay
 * still pays.
 *
 * `rng` is injected everywhere, and the roll order is documented in the module —
 * coin, then materials in key order — so a stubbed generator maps to an entry.
 */

const REWARDS: StoryStageRewards = {
  firstClear: {
    gems: 14,
    coin: 2000,
    materials: { training_manual: 3 },
    accountXp: 20,
  },
  farm: {
    coin: { min: 500, max: 1000 },
    materials: { training_manual: { min: 1, max: 2 } },
  },
};

const SCENE_REWARDS: StoryStageRewards = {
  firstClear: { gems: 8, coin: 1000, accountXp: 10 },
};

/** Always the low end of every range. */
const low = () => 0;
/** Always the high end — 0.999 lands on the last integer of any span. */
const high = () => 0.999;

function metMission(gems: number, claimed = false): MissionOutcome {
  const mission: StoryMission = {
    id: `m${gems}`,
    label: "x",
    goal: { type: "noLosses" },
    reward: { gems },
  };
  return { mission, met: true, alreadyClaimed: claimed, paysNow: !claimed };
}

describe("a first clear", () => {
  it("pays the bundle and a farm roll", () => {
    // Paying the bundle alone would make the first clear the only clear that never
    // shows the table it advertises.
    const result = rollStageRewards(REWARDS, true, [], low);
    expect(result.firstClear).toMatchObject({ gems: 14, coin: 2000, accountXp: 20 });
    expect(result.farm).toMatchObject({ coin: 500 });
    expect(result.total.coin).toBe(2500);
    expect(result.total.materials.training_manual).toBe(4);
  });

  it("never rolls the bundle — the amounts are exactly as authored", () => {
    const lowRoll = rollStageRewards(REWARDS, true, [], low);
    const highRoll = rollStageRewards(REWARDS, true, [], high);
    expect(lowRoll.firstClear).toEqual(highRoll.firstClear);
  });
});

describe("a replay", () => {
  it("pays the farm table only", () => {
    const result = rollStageRewards(REWARDS, false, [], high);
    expect(result.firstClear).toBeNull();
    expect(result.farm).toMatchObject({ coin: 1000 });
    expect(result.total.gems).toBe(0);
    expect(result.total.accountXp).toBe(0);
  });

  it("still pays a mission met for the first time", () => {
    // The point of missions being independent: a farm run is where a
    // `withinTurns` mission usually falls, long after the first clear.
    const result = rollStageRewards(REWARDS, false, [metMission(3)], low);
    expect(result.missions.gems).toBe(3);
    expect(result.total.gems).toBe(3);
  });

  it("pays nothing for a mission already banked", () => {
    const result = rollStageRewards(REWARDS, false, [metMission(3, true)], low);
    expect(result.missions.gems).toBe(0);
  });

  it("sums several missions met on one run", () => {
    const result = rollStageRewards(
      REWARDS,
      false,
      [metMission(3), metMission(5)],
      low,
    );
    expect(result.missions.gems).toBe(8);
  });
});

describe("a scene stage", () => {
  it("has no farm table, so a replay pays nothing at all", () => {
    const first = rollStageRewards(SCENE_REWARDS, true, [], low);
    expect(first.farm).toBeNull();
    expect(first.total.gems).toBe(8);

    const replay = rollStageRewards(SCENE_REWARDS, false, [], low);
    expect(replay.farm).toBeNull();
    expect(isEmptyPayout(replay.total)).toBe(true);
  });
});

describe("ranges", () => {
  it("is inclusive at both bounds", () => {
    expect(rollStageRewards(REWARDS, false, [], low).farm?.coin).toBe(500);
    expect(rollStageRewards(REWARDS, false, [], high).farm?.coin).toBe(1000);
  });

  it("drops a zero roll instead of recording a +0 entry", () => {
    const zeroable: StoryStageRewards = {
      firstClear: {},
      farm: { materials: { training_manual: { min: 0, max: 1 } } },
    };
    const result = rollStageRewards(zeroable, false, [], low);
    expect(result.farm?.materials).toEqual({});
  });
});

describe("display lines", () => {
  it("names the bundle in full", () => {
    expect(describeFirstClear(REWARDS)).toEqual([
      "14 Gems",
      "2000 Coin",
      "3 Training Manual",
      "20 Account XP",
    ]);
  });

  it("renders farm ranges, and collapses a fixed one", () => {
    expect(describeFarm(REWARDS)).toEqual(["500–1000 Coin", "1–2 Training Manual"]);
    expect(
      describeFarm({ firstClear: {}, farm: { coin: { min: 100, max: 100 } } }),
    ).toEqual(["100 Coin"]);
  });

  it("returns nothing for a stage with no farm table", () => {
    expect(describeFarm(SCENE_REWARDS)).toEqual([]);
  });
});
