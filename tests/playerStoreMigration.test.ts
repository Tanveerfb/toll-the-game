import { describe, expect, it } from "vitest";
import { migratePlayerState } from "@/store/playerStore";

describe("migratePlayerState — v1 (inventory.gems) to v2 (currencies split)", () => {
  it("moves inventory.gems into currencies.gems and clears inventory to materials only", () => {
    const v1 = {
      uid: "abc",
      roster: ["duke", "seras"],
      inventory: { gems: 2500 },
      pity: { standard: 3, limited: 0 },
    };
    const result = migratePlayerState(v1, 1);
    expect(result.currencies).toEqual({ gems: 2500, coin: 0 });
    expect(result.inventory).toEqual({});
    expect(result.roster).toEqual(["duke", "seras"]);
    expect(result.characters).toEqual({});
    expect(result.stamina.current).toBe(120);
  });

  it("defaults gems to 1000 if the v1 inventory had none", () => {
    const v1 = { uid: null, roster: ["duke"], inventory: {}, pity: { standard: 0, limited: 0 } };
    const result = migratePlayerState(v1, 1);
    expect(result.currencies.gems).toBe(1000);
  });

  it("preserves other pre-existing material keys alongside the gems split", () => {
    const v1 = {
      uid: null,
      roster: ["duke"],
      inventory: { gems: 2500, sea_monster_eye: 1 },
      pity: { standard: 0, limited: 0 },
    };
    const result = migratePlayerState(v1, 1);
    expect(result.currencies.gems).toBe(2500);
    expect(result.inventory).toEqual({ sea_monster_eye: 1 });
  });

  it("passes through unchanged when already at the current version", () => {
    const v2 = {
      uid: null,
      roster: ["duke"],
      currencies: { gems: 500, coin: 10000 },
      inventory: { sea_monster_eye: 3 },
      characters: { duke: { level: 5, ascension: 1, xp: 20 } },
      stamina: { current: 80, updatedAt: 12345 },
      pity: { standard: 0, limited: 0 },
    };
    const result = migratePlayerState(v2, 2);
    expect(result).toEqual(v2);
  });
});
