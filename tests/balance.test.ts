import { describe, expect, it } from "vitest";
import {
  analyzeKitBalance,
  computeRosterBaselines,
} from "@/lib/game/balance";
import type { CharacterData, CharacterSkillData } from "@/lib/game/characterCatalog";

function skill(
  name: string,
  overrides: Partial<CharacterSkillData> = {},
): CharacterSkillData {
  return {
    skillName: name,
    characterId: "test",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 130, 160],
    ...overrides,
  };
}

function char(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    id: "test",
    name: "Test",
    color: "red",
    atk: 150,
    def: 60,
    hp: 900,
    skills: [skill("A"), skill("B")],
    ...overrides,
  };
}

const roster: CharacterData[] = [
  char({ id: "a", atk: 140, def: 55, hp: 850 }),
  char({ id: "b", atk: 150, def: 60, hp: 900 }),
  char({ id: "c", atk: 160, def: 65, hp: 950 }),
];

describe("computeRosterBaselines", () => {
  it("returns medians of the roster stats", () => {
    expect(computeRosterBaselines(roster)).toEqual({
      atkMedian: 150,
      defMedian: 60,
      hpMedian: 900,
    });
  });

  it("returns zeros for an empty roster", () => {
    expect(computeRosterBaselines([])).toEqual({
      atkMedian: 0,
      defMedian: 0,
      hpMedian: 0,
    });
  });
});

describe("analyzeKitBalance", () => {
  it("flags nothing for an on-curve kit", () => {
    const flags = analyzeKitBalance(char(), roster);
    expect(flags).toEqual([]);
  });

  it("flags a stat far above the median", () => {
    const flags = analyzeKitBalance(char({ atk: 300 }), roster);
    expect(flags.some((f) => f.field === "atk" && f.message.includes("above"))).toBe(
      true,
    );
  });

  it("flags a stat far below the median", () => {
    const flags = analyzeKitBalance(char({ hp: 400 }), roster);
    expect(flags.some((f) => f.field === "hp" && f.message.includes("below"))).toBe(
      true,
    );
  });

  it("errors when the ultimate is not stronger than a rank-3 skill", () => {
    const weakUlt = char({
      skills: [skill("A", { damageRanked: [100, 130, 400] }), skill("B")],
      ultimate: skill("Finisher", { type: "ultimate", damage: 300, damageRanked: undefined }),
    });
    const flags = analyzeKitBalance(weakUlt, roster);
    expect(flags[0]).toMatchObject({ severity: "error", field: "ultimate" });
  });

  it("does not error when the ultimate beats every rank-3 skill", () => {
    const goodUlt = char({
      skills: [skill("A", { damageRanked: [100, 130, 200] }), skill("B")],
      ultimate: skill("Finisher", { type: "ultimate", damage: 450, damageRanked: undefined }),
    });
    const flags = analyzeKitBalance(goodUlt, roster);
    expect(flags.some((f) => f.field === "ultimate")).toBe(false);
  });

  it("flags a zero-damage attack skill", () => {
    const flags = analyzeKitBalance(
      char({ skills: [skill("A", { damageRanked: [0, 0, 0] }), skill("B")] }),
      roster,
    );
    expect(flags.some((f) => f.message.includes("0 damage at every rank"))).toBe(
      true,
    );
  });

  it("flags non-increasing damage ranks", () => {
    const flags = analyzeKitBalance(
      char({ skills: [skill("A", { damageRanked: [160, 130, 100] }), skill("B")] }),
      roster,
    );
    expect(flags.some((f) => f.message.includes("does not increase"))).toBe(true);
  });
});
