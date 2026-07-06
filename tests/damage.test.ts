import { describe, expect, it } from "vitest";
import { calculateDamage } from "@/lib/game/damage";
import type { BattleCharacter } from "@/types/character";
import type { Mechanic } from "@/types/mechanic";

function makeTarget(overrides: Partial<BattleCharacter> = {}): BattleCharacter {
  return {
    currentDefense: 50,
    debuffs: [],
    ultGauge: 0,
    ...overrides,
  } as BattleCharacter;
}

function run(
  baseDamage: number,
  skillMechanics: Mechanic[] = [],
  target = makeTarget(),
) {
  return calculateDamage({ baseDamage, skillMechanics, target });
}

describe("calculateDamage", () => {
  it("subtracts target defense from base damage", () => {
    expect(run(200)).toBe(150);
  });

  it("never deals less than 1", () => {
    expect(run(10)).toBe(1);
  });

  it("pierce ignores a percentage of defense", () => {
    // 50 def × (1 − 0.5) = 25 effective → 200 − 25
    expect(run(200, [{ type: "pierce", value: 50 }])).toBe(175);
  });

  it("ignite adds 10% per stack on any attack", () => {
    const target = makeTarget({
      debuffs: [{ type: "ignite", stacks: 3 }],
    });
    // (200−50) × (1 + 0.3)
    expect(run(200, [], target)).toBe(195);
  });

  it("detonate adds 20% per point of target ult gauge", () => {
    const target = makeTarget({ ultGauge: 5 });
    // 150 × (1 + 1.0)
    expect(run(200, [{ type: "detonate" }], target)).toBe(300);
  });

  it("weakpoint triples damage only when target has a debuff", () => {
    const clean = makeTarget();
    const debuffed = makeTarget({
      debuffs: [{ type: "debuff", stat: "atk", valuePercent: 10 }],
    });
    expect(run(200, [{ type: "weakpoint" }], clean)).toBe(150);
    expect(run(200, [{ type: "weakpoint" }], debuffed)).toBe(450);
  });

  it("stacks ignite, detonate, and weakpoint additively off the same base", () => {
    const target = makeTarget({
      ultGauge: 2,
      debuffs: [{ type: "ignite", stacks: 1 }],
    });
    // base 150; +15 ignite; +60 detonate; +300 weakpoint (has ignite debuff)
    expect(
      run(200, [{ type: "detonate" }, { type: "weakpoint" }], target),
    ).toBe(525);
  });
});
