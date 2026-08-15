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
      limited: { bannerId: null, bar: 0, claimedFirst: false, claimedFinal: false },
      permanent: { bar: 0, claimedFinal: false },
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
      stats: { pulls: 0, bossClears: 0 },
      claimedOrders: {},
      autoClearTickets: 0,
      clearedEvents: [],
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
      limited: { bannerId: null, bar: 0, claimedFirst: false, claimedFinal: false },
      permanent: { bar: 0, claimedFinal: false },
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
      limited: { bannerId: null, bar: 0, claimedFirst: false, claimedFinal: false },
      permanent: { bar: 0, claimedFinal: false },
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
      stats: { pulls: 22, bossClears: 3 },
      claimedOrders: { "first-chapter": true },
      autoClearTickets: 12,
      clearedEvents: ["molvarr"],
      pity: {
        limited: { bannerId: "debut-2026-08", bar: 30, claimedFirst: false, claimedFinal: false },
        permanent: { bar: 0, claimedFinal: false },
      },
    };
    const result = migratePlayerState(current, CURRENT_PLAYER_STATE_VERSION);
    expect(result).toEqual(current);
  });
});

describe("migratePlayerState — v5 to v6 (milestone laps)", () => {
  /** A v5 save: `claimed300`, no `claimed600`, permanent as a bare bar. */
  const v5 = {
    uid: null,
    roster: ["duke", "sara"],
    currencies: { gems: 500, coin: 10000, permanentTicket: 5 },
    inventory: { sea_monster_eye: 3 },
    characters: { duke: { level: 5, ascension: 1, xp: 20, ultLevel: 2 } },
    presets: [],
    lastTeam: ["duke"],
    account: { rank: 21, xp: 120, clearedWalls: [20] },
    worldLevel: 2,
    stamina: { current: 80, updatedAt: 12345 },
    pity: {
      limited: { bannerId: "debut-2026-08", bar: 450, claimed300: true },
      permanent: { bar: 240 },
    },
  };

  it("renames the claim flag and adds the missing one", () => {
    const result = migratePlayerState(v5, 5);
    expect(result.pity.limited).toEqual({
      // The banner itself is unchanged, so its id carries — only the bar's
      // denomination moved. Nulling it would make the next spend treat this
      // as a banner switch and wipe the lap a second time.
      bannerId: "debut-2026-08",
      bar: 0,
      claimedFirst: false,
      claimedFinal: false,
    });
    expect(result.pity.permanent.claimedFinal).toBe(false);
  });

  it("resets a Limited lap in flight rather than mis-converting it", () => {
    // The bar changed denomination — it counted a 3-per-single unit against
    // 300/600, and now counts gems against 500/1000. Carrying 450 forward
    // would show progress the player never made at the new rate.
    const result = migratePlayerState(v5, 5);
    expect(result.pity.limited.bar).toBe(0);
  });

  it("carries the Permanent bar across untouched", () => {
    // Permanent kept its ticket pricing and its 600 threshold, so its bar
    // means the same thing before and after.
    expect(migratePlayerState(v5, 5).pity.permanent.bar).toBe(240);
  });

  it("leaves everything outside pity alone", () => {
    const result = migratePlayerState(v5, 5);
    expect(result.roster).toEqual(["duke", "sara"]);
    expect(result.account).toEqual({ rank: 21, xp: 120, clearedWalls: [20] });
    expect(result.currencies.gems).toBe(500);
  });
});

describe("migratePlayerState — v6 to v7 (Bureau Orders)", () => {
  /** A v6 save: everything current except the two new fields. */
  const v6 = {
    uid: null,
    roster: ["duke", "sara"],
    currencies: { gems: 500, coin: 10000, permanentTicket: 5 },
    inventory: { sea_monster_eye: 3 },
    characters: { duke: { level: 30, ascension: 2, xp: 20, ultLevel: 2 } },
    presets: [],
    lastTeam: ["duke"],
    account: { rank: 21, xp: 120, clearedWalls: [20] },
    worldLevel: 2,
    stamina: { current: 80, updatedAt: 12345 },
    pity: {
      limited: { bannerId: null, bar: 0, claimedFirst: false, claimedFinal: false },
      permanent: { bar: 0, claimedFinal: false },
    },
  };

  it("starts the board clean", () => {
    const result = migratePlayerState(v6, 6);
    expect(result.claimedOrders).toEqual({});
    expect(result.stats).toEqual({ pulls: 0, bossClears: 0 });
  });

  it("touches nothing else", () => {
    const result = migratePlayerState(v6, 6);
    expect(result.roster).toEqual(["duke", "sara"]);
    expect(result.account).toEqual(v6.account);
    expect(result.pity).toEqual(v6.pity);
    // `characters` is no longer untouched: the v8 → v9 step resets every ult
    // level and refunds the coins (see its own test below). Level, ascension
    // and xp still pass through.
    for (const [id, before] of Object.entries(v6.characters)) {
      expect(result.characters[id]).toMatchObject({
        level: before.level,
        ascension: before.ascension,
        xp: before.xp,
      });
    }
  });

  it("lets a returning save claim what it already earned", () => {
    // A save at rank 21 with an ascended character has done the work those
    // orders describe. They arrive complete and claimable, which is the right
    // outcome — the reward is owed. `bossClears` is the exception: nothing
    // ever recorded it, so that order is earned again rather than invented.
    const result = migratePlayerState(v6, 6);
    expect(result.stats.bossClears).toBe(0);
    expect(result.account.rank).toBe(21);
  });
});

/**
 * v8 → v9: dupes stopped granting free ult levels.
 *
 * Every pre-v9 save holds ult levels the player never chose. Resetting them
 * without paying anything back would delete real pulls, so the migration hands
 * one coin per banked level — the copies are worth exactly what they were, the
 * player just gets to decide where they go.
 */
describe("migratePlayerState — v8 to v9 (ult coins)", () => {
  const v8 = {
    roster: ["duke", "sara"],
    characters: {
      duke: { level: 30, ascension: 2, xp: 0, ultLevel: 4 },
      sara: { level: 1, ascension: 0, xp: 0, ultLevel: 1 },
    },
    inventory: { training_manual: 3 },
  };

  it("resets every ultimate to level 1", () => {
    const result = migratePlayerState(v8, 8);
    expect(result.characters.duke.ultLevel).toBe(1);
    expect(result.characters.sara.ultLevel).toBe(1);
  });

  it("refunds one coin per level that was banked", () => {
    const result = migratePlayerState(v8, 8);
    // Duke was at 4, so three levels had been paid for.
    expect(result.inventory.blue_duke_coin).toBe(3);
    // Sara was never levelled, so she gets nothing rather than a zero entry.
    expect(result.inventory.red_sara_coin).toBeUndefined();
  });

  it("leaves the rest of the inventory alone", () => {
    expect(migratePlayerState(v8, 8).inventory.training_manual).toBe(3);
  });

  it("keeps level, ascension and xp", () => {
    const duke = migratePlayerState(v8, 8).characters.duke;
    expect(duke).toMatchObject({ level: 30, ascension: 2, xp: 0 });
  });

  it("is idempotent — re-running at v9 refunds nothing twice", () => {
    const once = migratePlayerState(v8, 8);
    const twice = migratePlayerState(once, 9);
    expect(twice.inventory.blue_duke_coin).toBe(3);
  });
});
