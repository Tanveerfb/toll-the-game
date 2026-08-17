import { describe, expect, it } from "vitest";
import {
  describeRewards,
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

/**
 * Every attempt is charged since 2026-08-17 (Tanveer), which retired the rule
 * that uncleared chapters were free however many times you retried them. These
 * assertions used to say the opposite; the story can be stamina-gated now, and
 * that was flagged and confirmed rather than overlooked.
 */
describe("storyAttemptCost", () => {
  it("charges the same whether the chapter is cleared or not", () => {
    expect(storyAttemptCost(REWARDS)).toBe(5);
  });

  it("still costs nothing where the chapter is authored free", () => {
    expect(storyAttemptCost({ ...REWARDS, replayStamina: 0 })).toBe(0);
  });
});

/**
 * One list of reward lines, shared by the chapter card and the brief. They used
 * to be built privately inside `ChapterBrief`, which is how a card and a brief
 * end up disagreeing about what a chapter pays.
 */
describe("describeRewards", () => {
  it("advertises the one-time bundle while the chapter is uncleared", () => {
    expect(describeRewards(REWARDS, false)).toEqual([
      "50 Gems",
      "1500 Coin",
      "2 Training Manual",
    ]);
  });

  it("advertises the repeat ranges once it is cleared", () => {
    expect(describeRewards(REWARDS, true)).toEqual([
      "300–800 Coin",
      "0–2 Training Manual",
    ]);
  });

  it("collapses a range whose bounds are equal", () => {
    const fixed: StoryChapterRewards = {
      ...REWARDS,
      repeat: { coin: { min: 500, max: 500 } },
    };
    expect(describeRewards(fixed, true)).toEqual(["500 Coin"]);
  });

  it("names materials rather than printing raw ids", () => {
    const lines = describeRewards(REWARDS, false);
    expect(lines.some((line) => line.includes("training_manual"))).toBe(false);
  });

  it("returns an empty list rather than a placeholder when nothing is paid", () => {
    expect(
      describeRewards({ firstClear: {}, repeat: {}, replayStamina: 0 }, false),
    ).toEqual([]);
    expect(
      describeRewards({ firstClear: {}, repeat: {}, replayStamina: 0 }, true),
    ).toEqual([]);
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
