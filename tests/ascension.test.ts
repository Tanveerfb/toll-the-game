import { describe, expect, it } from "vitest";
import {
  ASCENSION_COSTS,
  ascensionBlocker,
  ascensionLevelRequirement,
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

/**
 * The level gate (Tanveer, 2026-08-13).
 *
 * Ascension was materials-only, so a level-1 character with a full bag could
 * be taken from ascension 1 to 4 without ever being levelled. The bands are
 * the levelling ladder — ascending past one you never climbed skips the loop
 * they exist to pace.
 */
describe("ascensionLevelRequirement", () => {
  it("asks for the cap of the tier you are leaving", () => {
    expect(ascensionLevelRequirement(2)).toBe(20);
    expect(ascensionLevelRequirement(3)).toBe(30);
    expect(ascensionLevelRequirement(4)).toBe(40);
  });

  it("never blocks a fresh character's FIRST ascension", () => {
    // Ascension 0 caps at level 1, which every character already has.
    expect(ascensionLevelRequirement(1)).toBe(1);
  });
});

describe("ascensionBlocker", () => {
  const rich = { sea_monster_eye: 99, corroded_seaweed: 99 };
  const coin = 1_000_000;

  it("lets a level-1 unascended character take its first ascension", () => {
    expect(ascensionBlocker({ level: 1, ascension: 0 }, rich, coin)).toBeNull();
  });

  it("blocks the bug directly: rich but under-levelled cannot skip a band", () => {
    // The exact reported case — materials for everything, level 1, trying to
    // climb past ascension 1.
    expect(ascensionBlocker({ level: 1, ascension: 1 }, rich, coin)).toBe(
      "level",
    );
    expect(ascensionBlocker({ level: 19, ascension: 1 }, rich, coin)).toBe(
      "level",
    );
  });

  it("opens the moment the band's cap is reached", () => {
    expect(ascensionBlocker({ level: 20, ascension: 1 }, rich, coin)).toBeNull();
    expect(ascensionBlocker({ level: 30, ascension: 2 }, rich, coin)).toBeNull();
    // Ascension 3 → 4 is deliberately absent from the cost table (bands 4-6
    // are a later update), so it reports `maxed`, not a level or a cost. See
    // the `maxed` case below.
  });

  it("reports the level gate BEFORE materials", () => {
    // Sending an under-levelled player farming for materials they also need
    // would waste the run they go on.
    expect(ascensionBlocker({ level: 1, ascension: 1 }, {}, 0)).toBe("level");
  });

  it("reports materials once the level gate is passed", () => {
    expect(ascensionBlocker({ level: 20, ascension: 1 }, {}, 0)).toBe(
      "materials",
    );
  });

  it("reports `maxed` for an uncosted band rather than a level or cost", () => {
    expect(ascensionBlocker({ level: 40, ascension: 4 }, rich, coin)).toBe(
      "maxed",
    );
  });
});
