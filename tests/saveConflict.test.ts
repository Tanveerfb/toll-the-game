import { describe, expect, it } from "vitest";
import {
  describeSaveConflict,
  isPlayedSave,
  type SaveSummaryInput,
} from "@/lib/game/saveConflict";

/**
 * Sign-in over a guest save asks which to keep, with the differences shown
 * (his call, 2026-10-13, audit finding 4). The question exists only when
 * both sides have been played; otherwise the played side simply wins.
 */
const fresh: SaveSummaryInput = {
  roster: ["duke"],
  currencies: { gems: 500, coin: 0, permanentTicket: 0 },
  characters: {},
  account: { rank: 1, xp: 0, clearedWalls: [] },
  stats: { pulls: 0, bossClears: 0 },
  epicClears: {},
};

const played: SaveSummaryInput = {
  roster: ["duke", "lyra", "sara"],
  currencies: { gems: 1200, coin: 9000, permanentTicket: 1 },
  characters: { duke: { level: 20, ascension: 1, xp: 0, ultLevel: 2 } },
  account: { rank: 8, xp: 10, clearedWalls: [] },
  stats: { pulls: 40, bossClears: 3 },
  epicClears: {
    "exam-arc/master-tao": { clears: 2, firstClearAt: 1, lastClearAt: 2, bestTurns: 6, teams: ["duke|lyra"] },
  },
};

describe("isPlayedSave", () => {
  it("a starter save is untouched whatever its gems", () => {
    expect(isPlayedSave(fresh)).toBe(false);
    expect(isPlayedSave({ ...fresh, currencies: { gems: 99999, coin: 0, permanentTicket: 0 } })).toBe(false);
  });

  it("one pull, one clear, one rank or one level counts as played", () => {
    expect(isPlayedSave({ ...fresh, stats: { pulls: 1, bossClears: 0 } })).toBe(true);
    expect(isPlayedSave({ ...fresh, account: { rank: 2, xp: 0, clearedWalls: [] } })).toBe(true);
    expect(isPlayedSave({ ...fresh, characters: { duke: { level: 2, ascension: 0, xp: 0, ultLevel: 1 } } })).toBe(true);
    expect(isPlayedSave({ ...fresh, roster: ["duke", "lyra"] })).toBe(true);
  });
});

describe("describeSaveConflict", () => {
  it("asks nothing when either side is untouched", () => {
    expect(describeSaveConflict(fresh, played)).toBeNull();
    expect(describeSaveConflict(played, fresh)).toBeNull();
    expect(describeSaveConflict(fresh, fresh)).toBeNull();
  });

  it("shows the differences side by side and suggests the further save", () => {
    const smaller: SaveSummaryInput = {
      ...played,
      roster: ["duke", "lyra"],
      account: { rank: 3, xp: 0, clearedWalls: [] },
      stats: { pulls: 5, bossClears: 0 },
      epicClears: {},
    };
    const conflict = describeSaveConflict(smaller, played);
    expect(conflict).not.toBeNull();
    expect(conflict!.suggested).toBe("cloud");
    expect(conflict!.rows.map((r) => r.label)).toEqual([
      "Characters",
      "Account rank",
      "Highest level",
      "Gems",
      "Pulls made",
      "Fights cleared",
    ]);
    expect(conflict!.rows[0]).toEqual({ label: "Characters", local: "2", cloud: "3" });
    expect(conflict!.rows[5]).toEqual({ label: "Fights cleared", local: "0", cloud: "5" });
    expect(describeSaveConflict(played, smaller)!.suggested).toBe("local");
  });

  it("formats large numbers for reading", () => {
    const rich = { ...played, currencies: { gems: 12345, coin: 0, permanentTicket: 0 } };
    expect(describeSaveConflict(rich, played)!.rows[3].local).toBe((12345).toLocaleString());
  });
});
