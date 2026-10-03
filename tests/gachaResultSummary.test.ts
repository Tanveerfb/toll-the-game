import { describe, expect, it } from "vitest";
import { COIN_ITEM_ID, summarisePull, type PullResult } from "@/lib/gacha/resultSummary";

describe("summarisePull", () => {
  it("sums coin and materials into one row per id, in first-seen order", () => {
    const results: PullResult[] = [
      { kind: "material", materialId: "prism_dust", amount: 1 },
      { kind: "coin", amount: 2000 },
      { kind: "material", materialId: "prism_dust", amount: 1 },
      { kind: "coin", amount: 5000 },
      { kind: "material", materialId: "training_manual", amount: 2 },
    ];
    expect(summarisePull(results).items).toEqual([
      { id: "prism_dust", amount: 2 },
      { id: COIN_ITEM_ID, amount: 7000 },
      { id: "training_manual", amount: 2 },
    ]);
  });

  it("keeps every character hit and counts new against duplicate", () => {
    const results: PullResult[] = [
      { kind: "character", characterId: "lyra", isNew: true },
      { kind: "coin", amount: 1000 },
      { kind: "character", characterId: "lyra", isNew: false },
      { kind: "character", characterId: "duke", isNew: false },
    ];
    const summary = summarisePull(results);
    expect(summary.characters).toHaveLength(3);
    expect(summary.newUnits).toBe(1);
    expect(summary.duplicates).toBe(2);
    expect(summary.items).toEqual([{ id: COIN_ITEM_ID, amount: 1000 }]);
  });

  it("is empty for an empty batch", () => {
    expect(summarisePull([])).toEqual({
      characters: [],
      items: [],
      newUnits: 0,
      duplicates: 0,
    });
  });
});
