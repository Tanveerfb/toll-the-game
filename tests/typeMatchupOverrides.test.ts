import { describe, expect, it } from "vitest";
import { calculateDamage } from "@/lib/game/damage";
import { resolveTypeModifier, getTypeModifier } from "@/lib/game/typeAdvantage";
import type { BattleCharacter } from "@/types/character";
import type { Color } from "@/types/color";

/**
 * [Guard] and [Effective] — ruling #111, spec
 * Plans/2026-08-20-guard-and-effective.md. Two mirrored overrides of the type
 * chart that never touch element colours, and cancel when both are present.
 */
const COLORS: Color[] = ["dark", "light", "red", "green", "blue"];

function makeChar(overrides: Partial<BattleCharacter> = {}): BattleCharacter {
  return {
    id: "c",
    name: "c",
    color: "red",
    hp: 3000,
    currentHP: 3000,
    currentDefense: 50,
    currentAttack: 100,
    buffs: [],
    debuffs: [],
    passiveState: {},
    ultGauge: 0,
    ...overrides,
  } as BattleCharacter;
}

const GUARDIAN = {
  name: "Bulwark",
  description: "Guards all attacks.",
  trigger: "always",
  mechanics: [{ type: "guard" }],
} as unknown as BattleCharacter["passive"];

describe("resolveTypeModifier", () => {
  it("is the plain chart when neither side declares anything", () => {
    for (const attacker of COLORS) {
      for (const defender of COLORS) {
        expect(resolveTypeModifier(attacker, defender)).toBe(
          getTypeModifier(attacker, defender),
        );
      }
    }
  });

  it("Guard forces 0.9 whatever the colours", () => {
    for (const attacker of COLORS) {
      for (const defender of COLORS) {
        expect(
          resolveTypeModifier(attacker, defender, { defenderGuard: true }),
        ).toBe(0.9);
      }
    }
  });

  it("Effective floors at neutral without becoming a promotion", () => {
    // red > green stays a real advantage…
    expect(resolveTypeModifier("red", "green", { attackerEffective: true })).toBe(
      1.2,
    );
    // …green into red would be 0.9, and is lifted to neutral, not to 1.2.
    expect(getTypeModifier("green", "red")).toBe(0.9);
    expect(resolveTypeModifier("green", "red", { attackerEffective: true })).toBe(
      1.0,
    );
    // Same colour is 1.0 either way — the floor must not promote it.
    expect(resolveTypeModifier("red", "red", { attackerEffective: true })).toBe(
      1.0,
    );
  });

  it("cancels to 1.0 when both are present, in every combination", () => {
    for (const attacker of COLORS) {
      for (const defender of COLORS) {
        expect(
          resolveTypeModifier(attacker, defender, {
            attackerEffective: true,
            defenderGuard: true,
          }),
        ).toBe(1.0);
      }
    }
  });

  it("covers the mutual Dark/Light case, where neither is ever disadvantaged", () => {
    expect(getTypeModifier("dark", "light")).toBe(1.2);
    expect(getTypeModifier("light", "dark")).toBe(1.2);
    expect(resolveTypeModifier("dark", "light", { defenderGuard: true })).toBe(
      0.9,
    );
  });
});

describe("Guard and Effective in the damage pipeline", () => {
  it("a Guard passive on the defender shrinks an otherwise-advantaged hit", () => {
    const target = makeChar({ color: "green", passive: GUARDIAN });
    const plain = makeChar({ color: "green" });
    const args = { baseDamage: 1050, skillMechanics: [], attackerColor: "red" as Color };
    expect(calculateDamage({ ...args, target: plain })).toBeCloseTo(1200);
    expect(calculateDamage({ ...args, target })).toBeCloseTo(900);
  });

  it("an Effective skill mechanic lifts a disadvantaged hit to neutral", () => {
    const target = makeChar({ color: "red" });
    const base = { baseDamage: 1050, target, attackerColor: "green" as Color };
    expect(calculateDamage({ ...base, skillMechanics: [] })).toBeCloseTo(900);
    expect(
      calculateDamage({ ...base, skillMechanics: [{ type: "effective" }] }),
    ).toBeCloseTo(1000);
  });

  it("a crit ignores Guard entirely and still applies the crit package (#16)", () => {
    const guarded = makeChar({ color: "green", passive: GUARDIAN });
    const attacker = makeChar({ color: "red" });
    const crit = calculateDamage({
      baseDamage: 1050,
      skillMechanics: [{ type: "critical" }],
      target: guarded,
      attackerColor: "red",
      attacker,
    });
    // DEF halved by the crit's 50% ignore (1050 − 25 = 1025), matchup
    // discarded, +50% crit damage — and Guard's 0.9 never enters it.
    expect(crit).toBeCloseTo(1537.5);
  });
});

describe("targetTagBonus — a passive reading the target's tags", () => {
  const demonSlayer = makeChar({
    color: "blue",
    passive: {
      name: "Demonbane",
      description: "Hits demons harder.",
      trigger: "always",
      mechanics: [
        { type: "targetTagBonus", conditionTags: ["Demon"], valuePercent: 30 },
      ],
    } as unknown as BattleCharacter["passive"],
  });

  const hit = (tags: string[]) =>
    calculateDamage({
      baseDamage: 1050,
      skillMechanics: [],
      target: makeChar({ color: "blue", tags }),
      attacker: demonSlayer,
    });

  it("fires against a matching tag and not against another", () => {
    expect(hit(["Demon"])).toBeCloseTo(1300);
    expect(hit(["Beast"])).toBeCloseTo(1000);
  });

  it("matches 'has this tag', so a multi-tag unit still triggers it", () => {
    // Seras is Human, Fairy, Hybrid — several race tags at once.
    expect(hit(["Human", "Fairy", "Hybrid"])).toBeCloseTo(1000);
    expect(hit(["Human", "Demon", "Hybrid"])).toBeCloseTo(1300);
  });
});
