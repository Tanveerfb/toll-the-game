import { describe, expect, it } from "vitest";
import {
  isEmptyPayout,
  rollStoryRewards,
  storyAttemptCost,
} from "@/lib/game/storyRewards";
import type { StoryChapterRewards } from "@/types/story";

const REWARDS: StoryChapterRewards = {
  firstClear: { gems: 50, coin: 1500, materials: { training_manual: 2 }, accountXp: 0 },
  repeat: {
    coin: { min: 300, max: 800 },
    materials: { training_manual: { min: 0, max: 2 } },
  },
  replayStamina: 5,
};

/** Ranges are inclusive on both ends, so the max branch needs an rng that
 *  approaches 1 without reaching it — same trick as worldBossRewards.test. */
const MIN_RNG = () => 0;
const MAX_RNG = () => 0.999999;

describe("rollStoryRewards", () => {
  it("rolls every range to its exact minimum", () => {
    const { drops } = rollStoryRewards(REWARDS, false, MIN_RNG);
    expect(drops.coin).toBe(300);
    // A 0-roll on a 0-min material records no entry rather than a +0 row.
    expect(drops.materials).toEqual({});
  });

  it("rolls every range to its exact maximum", () => {
    const { drops } = rollStoryRewards(REWARDS, false, MAX_RNG);
    expect(drops.coin).toBe(800);
    expect(drops.materials).toEqual({ training_manual: 2 });
  });

  it("grants the one-time bundle on a first clear", () => {
    const result = rollStoryRewards(REWARDS, true, MIN_RNG);
    expect(result.firstClear).toEqual({
      gems: 50,
      coin: 1500,
      permanentTicket: 0,
      accountXp: 0,
      materials: { training_manual: 2 },
    });
  });

  it("grants no bundle on a replay", () => {
    expect(rollStoryRewards(REWARDS, false, MAX_RNG).firstClear).toBeNull();
  });

  it("totals the bundle and the drops together on a first clear", () => {
    const result = rollStoryRewards(REWARDS, true, MAX_RNG);
    expect(result.total).toEqual({
      gems: 50,
      coin: 1500 + 800,
      permanentTicket: 0,
      accountXp: 0,
      materials: { training_manual: 2 + 2 },
    });
  });

  it("totals to the drops alone on a replay", () => {
    const result = rollStoryRewards(REWARDS, false, MAX_RNG);
    expect(result.total).toEqual(result.drops);
  });

  it("treats absent optional entries as zero, never NaN or undefined keys", () => {
    const sparse: StoryChapterRewards = {
      firstClear: {},
      repeat: {},
      replayStamina: 0,
    };
    const result = rollStoryRewards(sparse, true, MIN_RNG);
    expect(result.total).toEqual({
      gems: 0,
      coin: 0,
      permanentTicket: 0,
      accountXp: 0,
      materials: {},
    });
    expect(Number.isNaN(result.total.coin)).toBe(false);
  });

  it("does not share material objects between the bundle and the total", () => {
    const result = rollStoryRewards(REWARDS, true, MAX_RNG);
    result.total.materials.training_manual = 999;
    expect(result.firstClear?.materials.training_manual).toBe(2);
  });

  it("rolls a fixed-point range to that exact value", () => {
    const fixed: StoryChapterRewards = {
      firstClear: {},
      repeat: { coin: { min: 500, max: 500 } },
      replayStamina: 1,
    };
    expect(rollStoryRewards(fixed, false, MIN_RNG).drops.coin).toBe(500);
    expect(rollStoryRewards(fixed, false, MAX_RNG).drops.coin).toBe(500);
  });
});

describe("storyAttemptCost", () => {
  it("is free for an uncleared chapter, however many retries it takes", () => {
    expect(storyAttemptCost(REWARDS, false)).toBe(0);
  });

  it("charges the replay cost once the chapter is cleared", () => {
    expect(storyAttemptCost(REWARDS, true)).toBe(5);
  });
});

describe("isEmptyPayout", () => {
  it("is true for a payout that grants nothing", () => {
    expect(
      isEmptyPayout({ gems: 0, coin: 0, permanentTicket: 0, materials: {}, accountXp: 0 }),
    ).toBe(true);
  });

  it("is false when any material was rolled", () => {
    expect(
      isEmptyPayout({
        gems: 0,
        coin: 0,
        permanentTicket: 0,
        accountXp: 0,
        materials: { training_manual: 1 },
      }),
    ).toBe(false);
  });
});
