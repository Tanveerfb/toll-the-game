import { describe, expect, it } from "vitest";
import { getAllCharacters, getCharacterById } from "@/lib/game/characterCatalog";
import { REMOVED_CHARACTER_IDS, REMOVED_COIN_IDS } from "@/lib/game/removedCharacters";
import { CURRENT_PLAYER_STATE_VERSION, migratePlayerState } from "@/store/playerStore";
import { registeredSkillArt } from "@/lib/game/characterArt";
import { getVfxTint } from "@/lib/game/characterVfx";

/**
 * The six collab units left the game on 2026-10-13 (ruling #187). Three things
 * have to hold for that to be a removal and not a crash waiting in someone's
 * save: the catalog no longer has them, nothing else registers them, and a
 * save that still names one is cleaned on load.
 */
describe("the removed units are gone from the game", () => {
  it("are not in the catalog", () => {
    for (const id of REMOVED_CHARACTER_IDS) {
      expect(getCharacterById(id), id).toBeUndefined();
    }
    const tags = new Set(getAllCharacters().flatMap((c) => c.tags ?? []));
    expect(tags.has("Collab")).toBe(false);
    expect(tags.has("Seven Deadly Sins")).toBe(false);
    expect(tags.has("Hunter x Hunter")).toBe(false);
  });

  it("have no skill art or VFX registered", () => {
    for (const id of REMOVED_CHARACTER_IDS) {
      expect(registeredSkillArt.filter((key) => key.startsWith(`${id}__`))).toEqual([]);
      // The tint accessor falls back to what it is given; a registered unit
      // would return its own colour instead of the sentinel.
      expect(getVfxTint(id, "sentinel")).toBe("sentinel");
    }
  });
});

describe("a save that still holds a removed unit is cleaned (v12)", () => {
  const v11 = {
    roster: ["duke", "gon", "lyra", "meliodas"],
    characters: {
      duke: { level: 10, ascension: 0, xp: 0, ultLevel: 1 },
      killua: { level: 30, ascension: 1, xp: 5, ultLevel: 2 },
    },
    presets: [
      { id: "p1", name: "Main", memberIds: ["duke", "gon", "lyra"], createdAt: 1, useCount: 2 },
      { id: "p2", name: "Collab", memberIds: ["gon", "killua", "leorio"], createdAt: 2, useCount: 0 },
    ],
    lastTeam: ["ban", "duke"],
    inventory: { sea_monster_eye: 3, green_gon_coin: 4, blue_duke_coin: 1 },
    epicClears: {
      "exam-arc/master-tao": {
        clears: 3,
        firstClearAt: 1,
        lastClearAt: 3,
        bestTurns: 5,
        teams: ["duke|gon|lyra", "gon|killua", "duke|lyra"],
      },
    },
  };

  it("drops them from every field and refunds nothing", () => {
    expect(CURRENT_PLAYER_STATE_VERSION).toBeGreaterThanOrEqual(12);
    const migrated = migratePlayerState(v11, 11);
    expect(migrated.roster).toEqual(["duke", "lyra"]);
    expect(Object.keys(migrated.characters)).toEqual(["duke"]);
    expect(migrated.presets.map((p) => [p.name, p.memberIds])).toEqual([
      ["Main", ["duke", "lyra"]],
    ]);
    expect(migrated.lastTeam).toEqual(["duke"]);
    expect(migrated.inventory).toEqual({ sea_monster_eye: 3, blue_duke_coin: 1 });
    // "duke|gon|lyra" and "duke|lyra" collapse to one team; "gon|killua" is gone.
    expect(migrated.epicClears["exam-arc/master-tao"].teams).toEqual(["duke|lyra"]);
    expect(migrated.epicClears["exam-arc/master-tao"].clears).toBe(3);
    expect(migrated.currencies.gems).toBe(1000);
  });

  it("leaves a clean save alone", () => {
    const clean = migratePlayerState(v11, 11);
    expect(migratePlayerState(clean, 12)).toEqual(clean);
  });

  it("names a coin for every removed unit", () => {
    expect(REMOVED_COIN_IDS).toHaveLength(REMOVED_CHARACTER_IDS.length);
  });
});
