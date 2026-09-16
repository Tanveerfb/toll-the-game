import { describe, expect, it } from "vitest";
import {
  CLOUD_FIELDS,
  DEVICE_LOCAL_FIELDS,
  cloudDocument,
  cloudPatch,
} from "@/lib/game/cloudSave";
import {
  CURRENT_PLAYER_STATE_VERSION,
  DEFAULT_PLAYER_STATE,
  migratePlayerState,
  type PlayerState,
} from "@/store/playerStore";

/**
 * What a cloud save carries, and what it must never overwrite (2026-08-13).
 *
 * Six fields joined the sync in one go — account rank, world level, presets,
 * the sticky last team, lifetime stats and claimed orders. Every document
 * already in Firestore predates all six, and `migratePlayerState` fills a
 * missing field with its default, so a naive merge would greet a returning
 * player by resetting their rank to 1 and deleting their team presets.
 *
 * That failure is silent, immediate and unrecoverable, which is why the rule
 * is a pure function with tests rather than six lines inside an auth callback.
 */

/** A local save that has clearly been played. */
const LOCAL = {
  roster: ["duke", "lyra", "sara"],
  currencies: { gems: 4000, coin: 90000, permanentTicket: 3 },
  inventory: { sea_monster_eye: 12 },
  characters: { duke: { level: 40, ascension: 3, xp: 0, ultLevel: 4 } },
  stamina: { current: 90, updatedAt: 999 },
  pity: {
    limited: { bannerId: "b", bar: 350, claimedFirst: true, claimedFinal: false },
    permanent: { bar: 120, claimedFinal: false },
  },
  account: { rank: 23, xp: 400, clearedWalls: [20] },
  worldLevel: 3,
  presets: [
    { id: "p1", name: "Main", memberIds: ["duke", "lyra"], createdAt: 1, useCount: 9 },
  ],
  lastTeam: ["duke", "lyra"],
  stats: { pulls: 260, bossClears: 41 },
  claimedOrders: { "first-chapter": true, "first-boss": true },
  autoClearTickets: 7,
  clearedEvents: ["molvarr::hell"],
} as unknown as PlayerState;

describe("what gets written", () => {
  it("writes every synced field plus the version", () => {
    const document = cloudDocument(LOCAL);
    for (const field of CLOUD_FIELDS) {
      expect(document[field]).toBeDefined();
    }
    expect(document.version).toBe(CURRENT_PLAYER_STATE_VERSION);
  });

  it("never writes uid or hasHydrated", () => {
    // One is the document's own key, the other is a runtime flag. Persisting
    // `hasHydrated: true` would be read back as gospel on the next load.
    const document = cloudDocument({
      ...LOCAL,
      uid: "abc",
      hasHydrated: true,
    } as PlayerState);
    expect(document.uid).toBeUndefined();
    expect(document.hasHydrated).toBeUndefined();
  });

  it("round-trips: what it writes is what a patch reads back", () => {
    const document = cloudDocument(LOCAL);
    const migrated = migratePlayerState(document, CURRENT_PLAYER_STATE_VERSION);
    const patch = cloudPatch(document, migrated);
    expect(patch.account).toEqual(LOCAL.account);
    expect(patch.presets).toEqual(LOCAL.presets);
    expect(patch.claimedOrders).toEqual(LOCAL.claimedOrders);
    expect(patch.stats).toEqual(LOCAL.stats);
    expect(patch.worldLevel).toBe(3);
  });
});

describe("merging an older document", () => {
  /** A document as written before 2026-08-13: the original six fields only. */
  const legacy = {
    roster: ["duke"],
    currencies: { gems: 100, coin: 0, permanentTicket: 0 },
    inventory: {},
    characters: {},
    stamina: { current: 20, updatedAt: 1 },
    pity: {
      limited: { bannerId: null, bar: 0, claimedFirst: false, claimedFinal: false },
      permanent: { bar: 0, claimedFinal: false },
    },
    version: 6,
  };

  it("takes the fields the document actually has", () => {
    const migrated = migratePlayerState(legacy, legacy.version);
    const patch = cloudPatch(legacy, migrated);
    expect(patch.roster).toEqual(["duke"]);
    expect(patch.currencies?.gems).toBe(100);
  });

  it("leaves account rank alone rather than resetting it to 1", () => {
    // The exact bug this guards: the migration supplies rank 1 for a field the
    // document never had, and copying that across would wipe a rank-23 save.
    const migrated = migratePlayerState(legacy, legacy.version);
    expect(migrated.account.rank).toBe(1);
    const patch = cloudPatch(legacy, migrated);
    expect(patch.account).toBeUndefined();
    expect({ ...LOCAL, ...patch }.account.rank).toBe(23);
  });

  it("leaves presets, last team and world level alone too", () => {
    const migrated = migratePlayerState(legacy, legacy.version);
    const merged = { ...LOCAL, ...cloudPatch(legacy, migrated) };
    expect(merged.presets).toHaveLength(1);
    expect(merged.lastTeam).toEqual(["duke", "lyra"]);
    expect(merged.worldLevel).toBe(3);
  });

  it("leaves claimed orders alone, so nothing pays out twice", () => {
    const migrated = migratePlayerState(legacy, legacy.version);
    const merged = { ...LOCAL, ...cloudPatch(legacy, migrated) };
    expect(merged.claimedOrders["first-boss"]).toBe(true);
    expect(merged.stats.bossClears).toBe(41);
  });

  it("still applies a field the document has, even when it's a default", () => {
    // Absent and "present but zero" are different answers. A cloud save of a
    // freshly wiped account must be able to overwrite a stale local one.
    const zeroed = { ...legacy, account: { rank: 1, xp: 0, clearedWalls: [] } };
    const migrated = migratePlayerState(zeroed, zeroed.version);
    const merged = { ...LOCAL, ...cloudPatch(zeroed, migrated) };
    expect(merged.account.rank).toBe(1);
  });
});

describe("an empty document", () => {
  it("patches nothing at all", () => {
    const migrated = migratePlayerState({}, CURRENT_PLAYER_STATE_VERSION);
    expect(cloudPatch({}, migrated)).toEqual({});
  });
});

/**
 * The clear record and the tickets travel too (2026-09-16).
 *
 * Reported by Tanveer from a real account: signing in on a second device left
 * every event needing a fresh manual clear before Auto Clear would unlock,
 * **and paid the first-clear bundle a second time**. Both symptoms are one
 * cause — `clearedEvents` was persisted locally and never added to
 * `CLOUD_FIELDS`, so it could not leave the device that earned it.
 *
 * This is the same defect the 2026-08-13 pass fixed for `claimedOrders`,
 * arriving through the field that was added on the same day and missed.
 * `autoClearTickets` was missed in the identical way and is the quieter half:
 * tickets are bought with account rank-ups and Bureau Orders, and they simply
 * did not exist on a second device.
 *
 * Note this is NOT device-specific in the way it was reported. `AuthProvider`
 * calls `resetPlayerState()` on sign-out, so signing out and back in on the
 * *same* device reproduced it exactly.
 */
describe("the clear record and the tickets", () => {
  it("round-trips a manual clear, so Auto Clear stays unlocked", () => {
    const document = cloudDocument(LOCAL);
    const migrated = migratePlayerState(document, CURRENT_PLAYER_STATE_VERSION);
    const patch = cloudPatch(document, migrated);
    expect(patch.clearedEvents).toEqual(["molvarr::hell"]);
    expect(patch.autoClearTickets).toBe(7);
  });

  it("carries the clear record onto a fresh device", () => {
    // The exact report: a starter-state device pulls the cloud doc and must
    // come away knowing the boss was already beaten. `isFirstClear` in
    // app/events/page.tsx is `!clearedEvents.includes(key)`, so an empty list
    // here is a second first-clear bundle.
    const fresh = {
      ...LOCAL,
      clearedEvents: [] as string[],
      autoClearTickets: 0,
    } as unknown as PlayerState;
    const document = cloudDocument(LOCAL);
    const migrated = migratePlayerState(document, CURRENT_PLAYER_STATE_VERSION);
    const merged = { ...fresh, ...cloudPatch(document, migrated) };
    expect(merged.clearedEvents).toContain("molvarr::hell");
    expect(merged.autoClearTickets).toBe(7);
  });

  it("leaves a legacy document's missing clears alone", () => {
    // Same presence rule as every other late arrival: a document written
    // before today has no `clearedEvents`, and taking the migrated `[]` would
    // re-lock Auto Clear for everyone who already plays.
    const legacy = {
      roster: ["duke"],
      currencies: { gems: 100, coin: 0, permanentTicket: 0 },
      version: 6,
    };
    const migrated = migratePlayerState(legacy, legacy.version);
    expect(migrated.clearedEvents).toEqual([]);
    const merged = { ...LOCAL, ...cloudPatch(legacy, migrated) };
    expect(merged.clearedEvents).toEqual(["molvarr::hell"]);
    expect(merged.autoClearTickets).toBe(7);
  });
});

/**
 * The structural guard, so this cannot happen a third time.
 *
 * Both of the above were introduced the same way: a field was added to the
 * store, persisted to localStorage by default, and nobody made a decision
 * about whether it should sync. There was no place where that decision was
 * required, so the answer defaulted to "no" in silence.
 *
 * Every persisted field must now be named in exactly one of the two lists.
 * Adding one to the store and neither list fails here.
 */
describe("every persisted field has a sync decision", () => {
  /**
   * `hasHydrated` is the one persisted field not in `DEFAULT_PLAYER_STATE` —
   * the store sets it at init and `resetPlayerState` deliberately carries the
   * live value across a reset, so it cannot live in the defaults. It is still
   * written to localStorage, so it still needs a decision.
   */
  const PERSISTED = [...Object.keys(DEFAULT_PLAYER_STATE), "hasHydrated"];

  it("is either synced or explicitly device-local — never neither", () => {
    const undecided = PERSISTED.filter(
      (field) =>
        !(CLOUD_FIELDS as readonly string[]).includes(field) &&
        !(DEVICE_LOCAL_FIELDS as readonly string[]).includes(field),
    );
    expect(undecided).toEqual([]);
  });

  it("is never named in both", () => {
    const both = (CLOUD_FIELDS as readonly string[]).filter((field) =>
      (DEVICE_LOCAL_FIELDS as readonly string[]).includes(field),
    );
    expect(both).toEqual([]);
  });

  it("names nothing that isn't actually persisted", () => {
    // A field removed from the store must leave both lists with it, or the
    // document keeps writing a key nothing reads.
    for (const field of [...CLOUD_FIELDS, ...DEVICE_LOCAL_FIELDS]) {
      expect(PERSISTED).toContain(field);
    }
  });
});
