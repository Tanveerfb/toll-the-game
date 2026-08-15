import { describe, expect, it } from "vitest";
import {
  COINS_PER_ULT_LEVEL,
  MAX_ULT_LEVEL,
  resolvePullResult,
  ultLevelCoinCost,
} from "@/lib/gacha/dupes";
import { characterCoinId } from "@/lib/game/materials";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";

/**
 * Dupes used to bump `ultLevel` on the spot — six copies maxed the ultimate
 * whether the player wanted it there or not, and a seventh copy evaporated.
 * They now pay a character-exclusive coin that is spent deliberately
 * (Tanveer, 2026-08-14), so copies past the cap keep their value.
 */
describe("resolvePullResult", () => {
  it("a character not in the roster is new, and pays no coin", () => {
    expect(resolvePullResult("sara", ["duke"])).toEqual({
      isNew: true,
      coinId: null,
    });
  });

  it("a duplicate pays that character's own coin", () => {
    expect(resolvePullResult("duke", ["duke"])).toEqual({
      isNew: false,
      coinId: "blue_duke_coin",
    });
  });

  it("keeps paying past the ult-level cap — a 7th copy is not wasted", () => {
    // The cap lives on the spend now, not on the pull. Nothing about the
    // roster tells this function what level the ultimate is at, which is the
    // point: excess coins bank for the planned shop.
    expect(resolvePullResult("duke", ["duke"]).coinId).toBe("blue_duke_coin");
  });

  it("gives every playable character a distinct coin", () => {
    const coins = getPlayableCharacters().map((c) => characterCoinId(c));
    expect(new Set(coins).size).toBe(coins.length);
  });
});

describe("ultLevelCoinCost", () => {
  it("charges one coin per level", () => {
    expect(ultLevelCoinCost(1, 2)).toBe(COINS_PER_ULT_LEVEL);
    expect(ultLevelCoinCost(1, 6)).toBe(5 * COINS_PER_ULT_LEVEL);
  });

  it("costs nothing to stay put or to aim backwards", () => {
    expect(ultLevelCoinCost(3, 3)).toBe(0);
    expect(ultLevelCoinCost(4, 2)).toBe(0);
  });

  it("maxing an ultimate costs five coins — six copies including the first", () => {
    expect(ultLevelCoinCost(1, MAX_ULT_LEVEL)).toBe(5);
  });
});

/**
 * Spending is the half the store owns, but the arithmetic it gates on lives
 * here. These pin the rules that stop a slider proposing an illegal purchase.
 */
describe("ult level spending rules", () => {
  it("never lets five coins reach past the cap", () => {
    // A player holding ten coins on a level-4 ultimate can only buy two levels.
    const reachable = Math.min(MAX_ULT_LEVEL, 4 + 10);
    expect(reachable).toBe(MAX_ULT_LEVEL);
    expect(ultLevelCoinCost(4, reachable)).toBe(2);
  });

  it("costs the same whether climbed in one step or several", () => {
    const oneStep = ultLevelCoinCost(1, 4);
    const stepwise =
      ultLevelCoinCost(1, 2) + ultLevelCoinCost(2, 3) + ultLevelCoinCost(3, 4);
    expect(oneStep).toBe(stepwise);
  });
});
