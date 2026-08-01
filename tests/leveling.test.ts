import { describe, expect, it } from "vitest";
import { COIN_PER_XP, feedManual, xpToNext, XP_PER_MANUAL_TIER } from "@/lib/game/leveling";

describe("xpToNext", () => {
  it("is 100 * level", () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(19)).toBe(1900);
  });
});

describe("feedManual", () => {
  it("refuses to feed when already at maxLevel", () => {
    const result = feedManual({ level: 20, xp: 0 }, 20, "training_manual");
    expect(result).toBeNull();
  });

  it("grants XP and levels up once when XP crosses the threshold, banking overflow", () => {
    // level 1 needs 100 xp to hit level 2; feeding a 100-xp manual with 50 already banked
    const result = feedManual({ level: 1, xp: 50 }, 20, "training_manual");
    expect(result).toEqual({ level: 2, xp: 50, coinCost: 100 * COIN_PER_XP });
  });

  it("chains multiple level-ups from one large feed", () => {
    // level 1: needs 100 to hit 2, level 2: needs 200 to hit 3 -> 1000xp premium manual
    // chains 1->2 (100 spent, 900 left), 2->3 (200 spent, 700 left), 3->4 (300 spent, 400 left),
    // 4->5 (400 spent, 0 left) -> lands exactly on level 5 with 0 xp
    const result = feedManual({ level: 1, xp: 0 }, 20, "training_manual_premium");
    expect(result).toEqual({ level: 5, xp: 0, coinCost: 1000 * COIN_PER_XP });
  });

  it("stops chaining at maxLevel and discards excess XP rather than banking past the cap", () => {
    // level 19 needs 1900 to hit 20 (maxLevel); a 1000-xp premium manual isn't enough on its own,
    // but starting with 950 banked plus 1000 fed = 1950, crosses the 1900 threshold to hit 20 (cap)
    const result = feedManual({ level: 19, xp: 950 }, 20, "training_manual_premium");
    expect(result).toEqual({ level: 20, xp: 0, coinCost: 1000 * COIN_PER_XP });
  });

  it("computes coin cost per tier from XP_PER_MANUAL_TIER * COIN_PER_XP", () => {
    expect(feedManual({ level: 1, xp: 0 }, 20, "training_manual")?.coinCost).toBe(XP_PER_MANUAL_TIER.training_manual * COIN_PER_XP);
    expect(feedManual({ level: 1, xp: 0 }, 20, "training_manual_advanced")?.coinCost).toBe(XP_PER_MANUAL_TIER.training_manual_advanced * COIN_PER_XP);
    expect(feedManual({ level: 1, xp: 0 }, 20, "training_manual_premium")?.coinCost).toBe(XP_PER_MANUAL_TIER.training_manual_premium * COIN_PER_XP);
  });
});
