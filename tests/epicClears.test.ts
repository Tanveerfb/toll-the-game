import { describe, expect, it } from "vitest";

import { cloudDocument, cloudPatch } from "@/lib/game/cloudSave";
import {
  applyEpicClear,
  EPIC_TEAMS_CAP,
  normaliseTeam,
  type EpicClears,
} from "@/lib/game/epicClears";
import {
  CURRENT_PLAYER_STATE_VERSION,
  migratePlayerState,
  usePlayerStore,
  type PlayerState,
} from "@/store/playerStore";

const KEY = "exam-arc/master-tao";

describe("applyEpicClear", () => {
  it("records a first clear with every field set", () => {
    const next = applyEpicClear({}, KEY, ["lyra", "duke"], 7, 1000);
    expect(next[KEY]).toEqual({
      clears: 1,
      firstClearAt: 1000,
      lastClearAt: 1000,
      bestTurns: 7,
      teams: [["duke", "lyra"]],
    });
  });

  it("counts repeats, keeps the first time, moves the last", () => {
    let clears: EpicClears = applyEpicClear({}, KEY, ["duke"], 9, 1);
    clears = applyEpicClear(clears, KEY, ["duke"], 12, 5);
    expect(clears[KEY].clears).toBe(2);
    expect(clears[KEY].firstClearAt).toBe(1);
    expect(clears[KEY].lastClearAt).toBe(5);
  });

  it("keeps the best turns as a minimum, never a latest", () => {
    let clears: EpicClears = applyEpicClear({}, KEY, ["duke"], 9, 1);
    clears = applyEpicClear(clears, KEY, ["duke"], 4, 2);
    clears = applyEpicClear(clears, KEY, ["duke"], 15, 3);
    expect(clears[KEY].bestTurns).toBe(4);
  });

  it("clamps a nonsense turn count instead of dropping the clear", () => {
    expect(applyEpicClear({}, KEY, ["a"], Number.NaN, 1)[KEY].bestTurns).toBe(1);
    expect(applyEpicClear({}, KEY, ["a"], 0, 1)[KEY].bestTurns).toBe(1);
  });

  it("dedupes a team however its ids were ordered or repeated", () => {
    expect(normaliseTeam(["b", "a", "b"])).toEqual(["a", "b"]);
    let clears: EpicClears = applyEpicClear({}, KEY, ["gon", "killua"], 5, 1);
    clears = applyEpicClear(clears, KEY, ["killua", "gon"], 5, 2);
    clears = applyEpicClear(clears, KEY, ["killua", "gon", "gon"], 5, 3);
    expect(clears[KEY].teams).toEqual([["gon", "killua"]]);
    expect(clears[KEY].clears).toBe(3);
  });

  it("keeps different teams as different entries", () => {
    let clears: EpicClears = applyEpicClear({}, KEY, ["gon"], 5, 1);
    clears = applyEpicClear(clears, KEY, ["gon", "killua"], 5, 2);
    expect(clears[KEY].teams).toEqual([["gon"], ["gon", "killua"]]);
  });

  it("caps the teams, dropping the longest unused", () => {
    let clears: EpicClears = {};
    for (let i = 0; i < EPIC_TEAMS_CAP + 5; i++) {
      clears = applyEpicClear(clears, KEY, [`unit${String(i).padStart(3, "0")}`], 5, i);
    }
    const teams = clears[KEY].teams;
    expect(teams).toHaveLength(EPIC_TEAMS_CAP);
    expect(teams[0]).toEqual(["unit005"]);
    expect(teams[teams.length - 1]).toEqual([`unit${String(EPIC_TEAMS_CAP + 4).padStart(3, "0")}`]);
    // The count is not capped - only the team list is.
    expect(clears[KEY].clears).toBe(EPIC_TEAMS_CAP + 5);
  });

  it("refreshes a repeated team so the habitual one is never the one dropped", () => {
    let clears: EpicClears = applyEpicClear({}, KEY, ["main"], 5, 0);
    for (let i = 1; i < EPIC_TEAMS_CAP + 5; i++) {
      clears = applyEpicClear(clears, KEY, [`other${String(i).padStart(3, "0")}`], 5, i);
      clears = applyEpicClear(clears, KEY, ["main"], 5, i);
    }
    expect(clears[KEY].teams).toContainEqual(["main"]);
    expect(clears[KEY].teams).toHaveLength(EPIC_TEAMS_CAP);
  });

  it("records each stage under its own key and never mutates its input", () => {
    const before: EpicClears = applyEpicClear({}, KEY, ["a"], 5, 1);
    const snapshot = JSON.stringify(before);
    const after = applyEpicClear(before, "exam-arc/lyra", ["a"], 3, 2);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(Object.keys(after).sort()).toEqual(["exam-arc/lyra", KEY]);
  });
});

describe("the player store's record", () => {
  it("records through the action and starts empty", () => {
    usePlayerStore.getState().resetPlayerState();
    expect(usePlayerStore.getState().epicClears).toEqual({});
    usePlayerStore.getState().recordEpicClear(KEY, ["lyra", "duke"], 8);
    usePlayerStore.getState().recordEpicClear(KEY, ["duke", "lyra"], 6);
    const record = usePlayerStore.getState().epicClears[KEY];
    expect(record.clears).toBe(2);
    expect(record.bestTurns).toBe(6);
    expect(record.teams).toEqual([["duke", "lyra"]]);
    usePlayerStore.getState().resetPlayerState();
  });

  it("pays nothing: currencies, inventory and stamina are untouched", () => {
    usePlayerStore.getState().resetPlayerState();
    const before = usePlayerStore.getState();
    const { currencies, inventory, stamina, autoClearTickets } = before;
    usePlayerStore.getState().recordEpicClear(KEY, ["duke"], 5);
    const after = usePlayerStore.getState();
    expect(after.currencies).toEqual(currencies);
    expect(after.inventory).toEqual(inventory);
    expect(after.stamina).toEqual(stamina);
    expect(after.autoClearTickets).toBe(autoClearTickets);
    usePlayerStore.getState().resetPlayerState();
  });

  it("migrates an old save to an empty record, and keeps a real one", () => {
    expect(CURRENT_PLAYER_STATE_VERSION).toBeGreaterThanOrEqual(10);
    const old = migratePlayerState({ roster: ["duke"] }, 9);
    expect(old.epicClears).toEqual({});
    const kept = applyEpicClear({}, KEY, ["duke"], 5, 1);
    expect(migratePlayerState({ epicClears: kept }, 9).epicClears).toEqual(kept);
  });
});

describe("cloud sync of the record", () => {
  const state = {
    epicClears: applyEpicClear({}, KEY, ["duke", "lyra"], 5, 1),
  } as unknown as PlayerState;

  it("writes the record and reads it back on a fresh device", () => {
    const document = cloudDocument(state);
    const migrated = migratePlayerState(document, CURRENT_PLAYER_STATE_VERSION);
    expect(cloudPatch(document, migrated).epicClears).toEqual(state.epicClears);
  });

  it("leaves local clears alone when the document predates the field", () => {
    const legacy = { roster: ["duke"], version: 9 };
    const migrated = migratePlayerState(legacy, legacy.version);
    expect(cloudPatch(legacy, migrated)).not.toHaveProperty("epicClears");
  });
});
