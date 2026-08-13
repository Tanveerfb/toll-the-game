import { describe, expect, it } from "vitest";
import { rollLimitedPull, rollPermanentPull, rollUniformFromPool } from "@/lib/gacha/pull";
import type { GemBannerConfig } from "@/lib/gacha/banners";

const banner: GemBannerConfig = {
  id: "test-banner",
  name: "Test Banner",
  featured: ["duke", "lyra", "batra"],
  rate: 0.05,
};

describe("rollLimitedPull", () => {
  it("hits the featured pool when rng is just under the rate", () => {
    const result = rollLimitedPull(banner, () => 0.049);
    expect(result.kind).toBe("character");
  });

  it("does not hit at exactly the rate boundary (uses < not <=)", () => {
    const result = rollLimitedPull(banner, () => 0.05);
    expect(result.kind).not.toBe("character");
  });

  it("picks the first featured unit when rng is 0 on a hit", () => {
    const result = rollLimitedPull(banner, () => 0);
    expect(result).toEqual({ kind: "character", characterId: "duke" });
  });

  it("picks the last featured unit when the index-pick roll is just under 1", () => {
    // rollLimitedPull makes 2 rng() calls on a hit: the hit-check, then the
    // featured-index pick. A constant-value stub can't satisfy "hit" (needs
    // a low value) and "last index" (needs a high value) at once, so this
    // uses a small sequence stub instead — first call low (hit), second
    // call high (last of 3 featured slots).
    const sequence = [0.01, 0.99];
    let call = 0;
    const rng = () => sequence[call++ % sequence.length];
    const result = rollLimitedPull(banner, rng);
    expect(result).toEqual({ kind: "character", characterId: "batra" });
  });

  it("lands in the currency category on a miss with a low miss-roll", () => {
    // hitRoll=0.1 misses (0.1 >= the 0.05 rate); missRoll reuses the same
    // 0.1, landing in the first third [0, 0.333) → coin category.
    const result = rollLimitedPull(banner, () => 0.1);
    expect(result.kind).toBe("coin");
  });

  it("lands in the level-mat category on a miss with a mid miss-roll", () => {
    const result = rollLimitedPull(banner, () => 0.4);
    expect(result).toEqual({ kind: "material", materialId: expect.stringMatching(/^training_manual/), amount: 1 });
  });

  it("lands in the specialty-mat category on a miss with a high miss-roll", () => {
    // rng=0.9 misses (0.9 >= 0.05 rate), then 0.9 as missRoll lands in the
    // final third [0.667, 1) → specialty-mat category, then 0.9 again picks
    // index floor(0.9*3)=2 → "batra", whose color (blue, per
    // data/characters/batra.json) maps to riverstone_fragment.
    const result = rollLimitedPull(banner, () => 0.9);
    expect(result).toEqual({ kind: "material", materialId: "riverstone_fragment", amount: 1 });
  });

  it("pins the empty-featured-array behavior of a direct rollLimitedPull call", () => {
    // A real banner can never reach this state — getGemBanner()
    // throws if featured is empty — but this pins what rollLimitedPull
    // itself does if ever called with one directly: rollUniformFromPool
    // returns null, and the `!` assertion lets that null through as
    // `characterId: null` at runtime despite the string type.
    const emptyBanner: GemBannerConfig = { ...banner, featured: [] };
    const result = rollLimitedPull(emptyBanner, () => 0);
    expect(result).toEqual({ kind: "character", characterId: null });
  });

  it("coin bundle is one of the 4 defined amounts", () => {
    const result = rollLimitedPull(banner, () => 0.1);
    expect(result.kind).toBe("coin");
    if (result.kind === "coin") {
      expect([1000, 2000, 5000, 10000]).toContain(result.amount);
    }
  });
});

describe("rollUniformFromPool", () => {
  it("returns null for an empty pool", () => {
    expect(rollUniformFromPool([], () => 0)).toBeNull();
  });

  it("picks the first entry when rng is 0", () => {
    expect(rollUniformFromPool(["a", "b", "c"], () => 0)).toBe("a");
  });

  it("picks the last entry when rng is just under 1", () => {
    expect(rollUniformFromPool(["a", "b", "c"], () => 0.99)).toBe("c");
  });
});

describe("rollPermanentPull", () => {
  it("returns null when the pool is empty", () => {
    expect(rollPermanentPull([], () => 0)).toBeNull();
  });

  it("always returns a character outcome for a non-empty pool (no miss category)", () => {
    const result = rollPermanentPull(["duke", "lyra"], () => 0);
    expect(result).toEqual({ kind: "character", characterId: "duke" });
  });
});
