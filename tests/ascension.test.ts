import { describe, expect, it } from "vitest";
import {
  ASCENSION_COSTS,
  canAffordAscension,
  getAscensionCost,
  maxLevelForAscension,
} from "@/lib/game/ascension";

describe("maxLevelForAscension", () => {
  it("caps an unascended character at level 1 — must ascend before leveling", () => {
    expect(maxLevelForAscension(0)).toBe(1);
  });

  it("returns the locked per-band max level for ascensions 1-3", () => {
    expect(maxLevelForAscension(1)).toBe(20);
    expect(maxLevelForAscension(2)).toBe(30);
    expect(maxLevelForAscension(3)).toBe(40);
  });

  it("clamps at the current ceiling (40) for unspecced future bands", () => {
    expect(maxLevelForAscension(4)).toBe(40);
  });
});

describe("getAscensionCost", () => {
  it("returns the locked cost for bands 1-3", () => {
    expect(getAscensionCost(1)).toEqual({ sea_monster_eye: 3, corroded_seaweed: 10, coin: 10000 });
    expect(getAscensionCost(2)).toEqual({ sea_monster_eye: 6, corroded_seaweed: 15, coin: 25000 });
    expect(getAscensionCost(3)).toEqual({ sea_monster_eye: 10, corroded_seaweed: 25, coin: 50000 });
  });

  it("returns null for an uncosted band", () => {
    expect(getAscensionCost(4)).toBeNull();
    expect(getAscensionCost(0)).toBeNull();
  });
});

describe("canAffordAscension", () => {
  const cost = ASCENSION_COSTS[1]; // 3 eye, 10 seaweed, 10000 coin

  it("returns true when inventory and coin both meet the cost exactly", () => {
    const inventory = { sea_monster_eye: 3, corroded_seaweed: 10 };
    expect(canAffordAscension(cost, inventory, 10000)).toBe(true);
  });

  it("returns false when a material is short", () => {
    const inventory = { sea_monster_eye: 2, corroded_seaweed: 10 };
    expect(canAffordAscension(cost, inventory, 10000)).toBe(false);
  });

  it("returns false when coin is short", () => {
    const inventory = { sea_monster_eye: 3, corroded_seaweed: 10 };
    expect(canAffordAscension(cost, inventory, 9999)).toBe(false);
  });

  it("treats a missing material key as 0 owned", () => {
    expect(canAffordAscension(cost, {}, 10000)).toBe(false);
  });
});
