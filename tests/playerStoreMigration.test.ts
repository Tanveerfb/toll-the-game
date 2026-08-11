import { describe, expect, it } from "vitest";
import {
  CURRENT_PLAYER_STATE_VERSION,
  migratePlayerState,
} from "@/store/playerStore";

describe("migratePlayerState — v1 (inventory.gems) to v2 (currencies split)", () => {
  it("moves inventory.gems into currencies.gems and clears inventory to materials only", () => {
    const v1 = {
      uid: "abc",
      roster: ["duke", "seras"],
      inventory: { gems: 2500 },
      pity: { standard: 3, limited: 0 },
    };
    const result = migratePlayerState(v1, 1);
    expect(result.currencies).toEqual({ gems: 2500, coin: 0, permanentTicket: 0 });
    expect(result.inventory).toEqual({});
    expect(result.roster).toEqual(["duke", "seras"]);
    expect(result.characters).toEqual({});
    expect(result.stamina.current).toBe(120);
    expect(result.pity).toEqual({
      limited: { bannerId: null, bar: 0, claimed300: false },
      permanent: { bar: 0 },
    });
  });

  it("defaults gems to 1000 if the v1 inventory had none", () => {
    const v1 = { uid: null, roster: ["duke"], inventory: {}, pity: { standard: 0, limited: 0 } };
    const result = migratePlayerState(v1, 1);
    expect(result.currencies.gems).toBe(1000);
    expect(result.currencies.permanentTicket).toBe(0);
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
    const v4 = {
      uid: null,
      roster: ["duke"],
      currencies: { gems: 500, coin: 10000, permanentTicket: 5 },
      inventory: { sea_monster_eye: 3 },
      characters: { duke: { level: 5, ascension: 1, xp: 20, ultLevel: 2 } },
      presets: [],
      lastTeam: ["duke"],
      account: { rank: 1, xp: 0, clearedWalls: [] },
      worldLevel: 1,
      stamina: { current: 80, updatedAt: 12345 },
      pity: { limited: { bannerId: "debut-2026-08", bar: 30, claimed300: false }, permanent: { bar: 0 } },
    };
    const result = migratePlayerState(v4, CURRENT_PLAYER_STATE_VERSION);
    expect(result).toEqual(v4);
  });

  it("starts a pre-v5 save at rank 1 / world level 1 — today's behaviour", () => {
    const older = {
      uid: null,
      roster: ["duke"],
      currencies: { gems: 0, coin: 0, permanentTicket: 0 },
      inventory: {},
      characters: {},
      stamina: { current: 80, updatedAt: 1 },
      pity: { limited: { bannerId: null, bar: 0, claimed300: false }, permanent: { bar: 0 } },
    };
    const result = migratePlayerState(older, 4) as unknown as {
      account: { rank: number; xp: number; clearedWalls: number[] };
      worldLevel: number;
    };
    expect(result.account).toEqual({ rank: 1, xp: 0, clearedWalls: [] });
    expect(result.worldLevel).toBe(1);
  });

  it("adds empty presets and lastTeam to a v3 save", () => {
    const v3 = {
      uid: null,
      roster: ["duke"],
      currencies: { gems: 500, coin: 10000, permanentTicket: 5 },
      inventory: {},
      characters: {},
      stamina: { current: 80, updatedAt: 12345 },
      pity: { limited: { bannerId: null, bar: 0, claimed300: false }, permanent: { bar: 0 } },
    };
    const result = migratePlayerState(v3, 3) as unknown as {
      presets: unknown[];
      lastTeam: string[];
      roster: string[];
    };
    expect(result.presets).toEqual([]);
    expect(result.lastTeam).toEqual([]);
    // Purely additive — nothing else is disturbed.
    expect(result.roster).toEqual(["duke"]);
  });
});

describe("migratePlayerState — v2 to v3 (gacha fields)", () => {
  it("adds permanentTicket:0, restructures pity, and defaults ultLevel:1 on existing characters", () => {
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
    expect(result.currencies).toEqual({ gems: 500, coin: 10000, permanentTicket: 0 });
    expect(result.pity).toEqual({
      limited: { bannerId: null, bar: 0, claimed300: false },
      permanent: { bar: 0 },
    });
    expect(result.characters.duke).toEqual({ level: 5, ascension: 1, xp: 20, ultLevel: 1 });
  });

  it("regression: a real-world unversioned Firestore doc (already v2-shaped) survives migration without data loss when defaulted to version 2 — NOT version 1", () => {
    // Mirrors a real production Firestore doc: never had a `version` field
    // written, but was always saved in v2 shape (currencies/characters/
    // stamina already split out at the top level, well-populated with real
    // progress) because saveToCloud has only ever written that shape.
    // AuthProvider.tsx must call migratePlayerState(data, data.version ?? 2)
    // — defaulting to 1 here would incorrectly run the destructive v1->v2
    // branch (which looks for `gems` nested inside `inventory`) against data
    // that's already past that stage, silently wiping real currencies,
    // characters, and stamina.
    const realWorldV2Doc = {
      uid: "real-user-uid",
      roster: ["duke", "seras", "gabrist"],
      currencies: { gems: 4820, coin: 156300 },
      inventory: { sea_monster_eye: 12, corroded_seaweed: 7, training_manual: 3 },
      characters: {
        duke: { level: 40, ascension: 3, xp: 1250 },
        seras: { level: 25, ascension: 1, xp: 400 },
        gabrist: { level: 60, ascension: 4, xp: 8000 },
      },
      stamina: { current: 45, updatedAt: 1735689600000 },
      pity: { standard: 5, limited: 12 },
    };

    const result = migratePlayerState(realWorldV2Doc, 2);

    // Real balances/progress must survive UNCHANGED except for the new
    // v3-only additions (permanentTicket, ultLevel per character).
    expect(result.currencies).toEqual({ gems: 4820, coin: 156300, permanentTicket: 0 });
    expect(result.inventory).toEqual({ sea_monster_eye: 12, corroded_seaweed: 7, training_manual: 3 });
    expect(result.roster).toEqual(["duke", "seras", "gabrist"]);
    expect(result.characters).toEqual({
      duke: { level: 40, ascension: 3, xp: 1250, ultLevel: 1 },
      seras: { level: 25, ascension: 1, xp: 400, ultLevel: 1 },
      gabrist: { level: 60, ascension: 4, xp: 8000, ultLevel: 1 },
    });
    expect(result.stamina).toEqual({ current: 45, updatedAt: 1735689600000 });

    // Pity reset to the v3 default shape is spec-sanctioned (old counters
    // were dead scaffolding), not data loss.
    expect(result.pity).toEqual({
      limited: { bannerId: null, bar: 0, claimed300: false },
      permanent: { bar: 0 },
    });
  });
});

describe("migratePlayerState — defensive defaults for missing fields regardless of version", () => {
  it("backfills a missing stamina field even on an already-current-version doc", () => {
    const docMissingStamina = {
      uid: "abc",
      roster: ["duke"],
      currencies: { gems: 500, coin: 10000, permanentTicket: 5 },
      inventory: { sea_monster_eye: 3 },
      characters: { duke: { level: 5, ascension: 1, xp: 20, ultLevel: 2 } },
      pity: { limited: { bannerId: "debut-2026-08", bar: 30, claimed300: false }, permanent: { bar: 0 } },
      // no `stamina` key at all
    };
    const result = migratePlayerState(docMissingStamina, 3);
    expect(result.stamina).toBeDefined();
    expect(result.stamina.current).toBe(120);
    expect(typeof result.stamina.updatedAt).toBe("number");
  });

  it("backfills missing roster/inventory/characters as empty defaults on an already-current-version doc", () => {
    const sparseDoc = {
      uid: "abc",
      currencies: { gems: 500, coin: 10000, permanentTicket: 5 },
      pity: { limited: { bannerId: null, bar: 0, claimed300: false }, permanent: { bar: 0 } },
      // no roster, inventory, characters, or stamina at all
    };
    const result = migratePlayerState(sparseDoc, 3);
    expect(result.roster).toEqual([]);
    expect(result.inventory).toEqual({});
    expect(result.characters).toEqual({});
    expect(result.stamina.current).toBe(120);
  });

  it("still passes through a fully-populated current-version doc unchanged (no regression)", () => {
    const current = {
      uid: null,
      roster: ["duke"],
      currencies: { gems: 500, coin: 10000, permanentTicket: 5 },
      inventory: { sea_monster_eye: 3 },
      characters: { duke: { level: 5, ascension: 1, xp: 20, ultLevel: 2 } },
      presets: [
        {
          id: "p1",
          name: "Main",
          memberIds: ["duke"],
          createdAt: 1,
          useCount: 4,
        },
      ],
      lastTeam: ["duke"],
      account: { rank: 21, xp: 120, clearedWalls: [20] },
      worldLevel: 2,
      stamina: { current: 80, updatedAt: 12345 },
      pity: { limited: { bannerId: "debut-2026-08", bar: 30, claimed300: false }, permanent: { bar: 0 } },
    };
    const result = migratePlayerState(current, CURRENT_PLAYER_STATE_VERSION);
    expect(result).toEqual(current);
  });
});
