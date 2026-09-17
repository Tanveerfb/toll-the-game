import { describe, expect, it } from "vitest";
import { xpToNext } from "@/lib/game/leveling";

describe("xpToNext", () => {
  it("is 100 * level", () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(19)).toBe(1900);
  });
});

/**
 * `feedManual`'s tests lived here. It spent exactly one manual per call and was
 * retired on 2026-09-17 along with the store action that wrapped it: nothing
 * called either once the growth modal moved to target-first, and both walked XP
 * into levels, so keeping them meant two implementations of one rule.
 *
 * Everything they asserted - chaining level-ups on overflow, stopping at the
 * ascension cap, banking no XP past it, and `coinCost = xp * COIN_PER_XP` - is
 * asserted against `planLevelUp` in `tests/levelPlan.test.ts`.
 */
