import { describe, expect, it } from "vitest";
import {
  analyzeKitBalance,
  computeRosterBaselines,
} from "@/lib/game/balance";
import {
  getPlayableCharacters,
  type CharacterData,
  type CharacterSkillData,
} from "@/lib/game/characterCatalog";

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

  // Ruling #22: a self-buff on an attacking skill lands BEFORE the damage
  // calc, so the same strike benefits. The check compared raw percentages and
  // so flagged Chiara (333% ult + 30% self-ATK vs a 400% card) and Mustafa
  // (225% + 30% self-DEF vs 250%), both of which measure HIGHER than their
  // cards through `executeSkill`.
  it("credits an ultimate's own pre-hit self-buff on its scaling stat", () => {
    const selfBuffUlt = char({
      skills: [skill("A", { damageRanked: [100, 130, 400] }), skill("B")],
      ultimate: skill("Finisher", {
        type: "ultimate",
        damage: 333,
        damageRanked: undefined,
        mechanics: [
          { type: "buff", stat: "atk", valuePercent: 30, targetSelf: true },
        ],
      }),
    });
    // 333 * 1.30 = 432.9 > 400
    expect(analyzeKitBalance(selfBuffUlt, roster).some((f) => f.field === "ultimate")).toBe(false);
  });

  it("ignores a self-buff that misses the skill's scaling stat", () => {
    // Chiara's ultimate also buffs evade; a substat cannot raise ATK-scaled
    // damage, so it must not count toward the allowance (ruling #55).
    const evadeOnly = char({
      skills: [skill("A", { damageRanked: [100, 130, 400] }), skill("B")],
      ultimate: skill("Finisher", {
        type: "ultimate",
        damage: 333,
        damageRanked: undefined,
        mechanics: [
          { type: "buff", stat: "evade", valuePercent: 33, targetSelf: true },
        ],
      }),
    });
    expect(analyzeKitBalance(evadeOnly, roster).some((f) => f.field === "ultimate")).toBe(true);
  });

  it("ignores a buff aimed at allies rather than the caster", () => {
    const allyBuffUlt = char({
      skills: [skill("A", { damageRanked: [100, 130, 400] }), skill("B")],
      ultimate: skill("Finisher", {
        type: "ultimate",
        damage: 333,
        damageRanked: undefined,
        mechanics: [{ type: "buff", stat: "atk", valuePercent: 30 }],
      }),
    });
    expect(analyzeKitBalance(allyBuffUlt, roster).some((f) => f.field === "ultimate")).toBe(true);
  });

  it("does not treat a heal's percentage as a damage skill to beat", () => {
    // Siddiq's 680% heal is heal SIZE, not damage — it was making his 400%
    // ultimate look weak against a skill that deals no damage at all.
    const withHeal = char({
      skills: [
        skill("Strike", { damageRanked: [100, 130, 200] }),
        skill("Mend", { type: "heal", damageRanked: [440, 540, 680] }),
      ],
      ultimate: skill("Finisher", { type: "ultimate", damage: 400, damageRanked: undefined }),
    });
    expect(analyzeKitBalance(withHeal, roster).some((f) => f.field === "ultimate")).toBe(false);
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

/**
 * The Kit Lab's advisory flags run against DRAFTS, so nothing ever pointed them
 * at the shipped roster — which is how it came to disagree with five of the
 * eighteen live kits without anyone noticing (audit, 2026-08-14).
 *
 * This pins the disagreement that is left. Since the ult ladders landed
 * (2026-08-14) the check reads ruling #2 at the TOP of the ladder — level 1 is
 * deliberately below a rank-3 card now, and climbing it is what the coins buy.
 * Master Tao and Siddiq cleared on that basis (500 vs 300, 600 vs 500).
 *
 * Gabrist is the one left: his ultimate maxes at 450 and his rank-3
 * Masterpiece Unveiled is also 450, so even fully levelled it never overtakes
 * his own card. It is AoE where the card is single-target, so it still earns
 * its slot — a standing question for Tanveer under ruling #2, not a code
 * defect.
 *
 * If a kit leaves this list, delete it from the array. If one JOINS it, that is
 * a new kit breaking ruling #2 and wants a decision before it ships.
 */
describe("analyzeKitBalance against the live roster", () => {
  const playable = getPlayableCharacters();

  const KNOWN_ULT_BELOW_CARD = ["gabrist"];

  it("flags exactly the kits whose ultimate is known to trail their rank-3 card", () => {
    const flagged = playable
      .filter((character) => {
        const others = playable.filter((c) => c.id !== character.id);
        return analyzeKitBalance(character, others).some(
          (f) => f.field === "ultimate",
        );
      })
      .map((character) => character.id)
      .sort();

    expect(flagged).toEqual([...KNOWN_ULT_BELOW_CARD].sort());
  });
});
