import { describe, expect, it } from "vitest";
import {
  getEffectiveCritDamage,
  getEffectiveRecoveryRate,
  getEffectiveLifesteal,
  getEffectiveCritResist,
} from "@/lib/game/substats";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import { getEffectiveHealAmount, applyHeal } from "@/lib/game/heal";
import { calculateDamage } from "@/lib/game/damage";
import { executeSkill } from "@/lib/game/combat";

function dummySkill(): SkillCard {
  return {
    skillName: "Dummy",
    characterId: "dummy",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
  };
}

function makeChar(overrides: Partial<BattleCharacter> = {}): BattleCharacter {
  return {
    id: "c",
    name: "c",
    color: "blue",
    atk: 100,
    def: 50,
    hp: 1000,
    skills: [dummySkill(), dummySkill()] as [SkillCard, SkillCard],
    instanceId: "c",
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 50,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team: "player",
    ...overrides,
  } as BattleCharacter;
}

describe("substat defaults", () => {
  it("defaults to 50/100/5/10 when the character has no explicit fields", () => {
    const c = makeChar();
    expect(getEffectiveCritDamage(c)).toBe(50);
    expect(getEffectiveRecoveryRate(c)).toBe(100);
    expect(getEffectiveLifesteal(c)).toBe(5);
    expect(getEffectiveCritResist(c)).toBe(10);
  });

  it("reads an explicit per-character base value", () => {
    const c = makeChar({ critDamagePercent: 70, lifestealPercent: 20 });
    expect(getEffectiveCritDamage(c)).toBe(70);
    expect(getEffectiveLifesteal(c)).toBe(20);
  });
});

describe("substat buff/debuff stacking (multiplicative)", () => {
  it("a +20% recoveryRate buff raises the base 100 to 120", () => {
    const c = makeChar();
    c.buffs.push({ type: "buff", stat: "recoveryRate", valuePercent: 20 });
    expect(getEffectiveRecoveryRate(c)).toBe(120);
  });

  it("two +10% critDamage buffs compound multiplicatively (not additively)", () => {
    const c = makeChar();
    c.buffs.push({ type: "buff", stat: "critDamage", valuePercent: 10 });
    c.buffs.push({ type: "buff", stat: "critDamage", valuePercent: 10 });
    // 50 * 1.1 * 1.1 = 60.5 -> floor 60
    expect(getEffectiveCritDamage(c)).toBe(60);
  });

  it("a -50% lifesteal debuff halves the base 5", () => {
    const c = makeChar();
    c.debuffs.push({ type: "debuff", stat: "lifesteal", valuePercent: 50 });
    expect(getEffectiveLifesteal(c)).toBe(2);
  });

  it("a generic 'all' buff does NOT affect substats (basic-stats-only per 2026-07-24 ruling)", () => {
    const c = makeChar();
    c.buffs.push({ type: "buff", stat: "all", valuePercent: 50 });
    expect(getEffectiveCritResist(c)).toBe(10);
  });
});

describe("getEffectiveHealAmount (Recovery Rate scaling)", () => {
  it("100 raw heal at 100% recovery rate stays 100", () => {
    const c = makeChar();
    expect(getEffectiveHealAmount(c, 100)).toBe(100);
  });

  it("100 raw heal at 150% recovery rate becomes 150", () => {
    const c = makeChar({ recoveryRatePercent: 150 });
    expect(getEffectiveHealAmount(c, 100)).toBe(150);
  });

  it("never returns negative for a 0 or negative raw amount", () => {
    const c = makeChar();
    expect(getEffectiveHealAmount(c, 0)).toBe(0);
    expect(getEffectiveHealAmount(c, -50)).toBe(0);
  });
});

describe("applyHeal", () => {
  it("adds the recovery-rate-scaled amount to currentHP", () => {
    const c = makeChar({ currentHP: 500, recoveryRatePercent: 150 });
    const { character, healed } = applyHeal(c, 100);
    expect(healed).toBe(150);
    expect(character.currentHP).toBe(650);
  });

  it("clamps at max HP", () => {
    const c = makeChar({ currentHP: 950, hp: 1000 });
    const { character, healed } = applyHeal(c, 200);
    expect(character.currentHP).toBe(1000);
    expect(healed).toBe(50);
  });

  it("logs the heal when a log function is passed", () => {
    const c = makeChar({ currentHP: 500 });
    const logs: string[] = [];
    applyHeal(c, 100, (e) => logs.push(e));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("100");
  });
});

describe("Crit Damage substat wiring (damage.ts)", () => {
  it("a proc'd crit (no explicit damageBonusPercent) uses the attacker's crit damage substat", () => {
    const attacker = makeChar({ critDamagePercent: 80 });
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const dmg = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "critical" }],
      target,
      attacker,
    });
    // 200 base * (1 + 80/100) = 360
    expect(dmg).toBe(360);
  });

  it("a skill with an explicit damageBonusPercent overrides the substat", () => {
    const attacker = makeChar({ critDamagePercent: 80 });
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const dmg = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "critical", damageBonusPercent: 30 }],
      target,
      attacker,
    });
    // 200 * (1 + 30/100) = 260, substat ignored
    expect(dmg).toBe(260);
  });

  it("falls back to 50% when no attacker is passed (backward compatible)", () => {
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const dmg = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "critical" }],
      target,
    });
    expect(dmg).toBe(300);
  });
});

describe("Crit Resistance substat wiring (combat.ts crit roll)", () => {
  it("subtracts the target's crit resistance from the attacker's crit chance", () => {
    // Deathblow-style attacker forced to a known crit chance via currentHP loss
    const attacker = makeChar({
      passive: {
        name: "Test Deathblow",
        trigger: "always",
        mechanics: [
          {
            type: "deathblow",
            hpStepPercent: 25,
            critPerStepPercent: 100,
            // Deathblow also drives an unrelated flat damage-boost mechanic
            // (combat.ts ~line 436, keyed off the same mechanic entry) —
            // zero it out so this test isolates the crit-chance roll only.
            damagePerStepPercent: 0,
          },
        ],
      },
      // 750/1000 (not 900/1000) deliberately avoids a binary floating-point
      // trap: 1 - 900/1000 evaluates to 9.999999999999998, which floors one
      // step short of the intended value and silently zeroes the crit chance.
      currentHP: 750, // 25% lost -> 1 step -> 100% crit chance base
      hp: 1000,
    });
    const target = makeChar({
      instanceId: "t",
      team: "enemy",
      currentDefense: 0, // isolate the crit-chance roll from defense math
      critResistPercent: 100, // fully negates the 100% base crit chance
    });
    const result = executeSkill(
      {
        sourceInstanceId: "c",
        skill: dummySkill(),
        targetInstanceId: "t",
      },
      { playerTeam: [attacker], enemyTeam: [target] },
      () => {},
      0,
      () => 0.01, // would crit if chance > 1%
    );
    // 100% - 100% crit resist = 0% chance -> no crit -> no CRITICAL package
    // (target has 0 def, so a non-crit hit deals plain base damage; a crit
    // would add +50% and ignore defense — neither special case fires here)
    expect(result.enemyTeam[0].currentHP).toBe(target.hp - attacker.currentAttack);
  });
});

describe("Lifesteal substat wiring (combat.ts)", () => {
  it("a plain attack with no skill lifesteal mechanic still heals the attacker for their base lifestealPercent", () => {
    const attacker = makeChar({ lifestealPercent: 10, currentHP: 500 });
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const result = executeSkill(
      { sourceInstanceId: "c", skill: dummySkill(), targetInstanceId: "t" },
      { playerTeam: [attacker], enemyTeam: [target] },
      () => {},
    );
    // dealt = attacker.currentAttack (100) - 0 def = 100; 10% lifesteal = 10
    expect(result.playerTeam[0].currentHP).toBe(510);
  });

  it("stacks additively with an existing skill-level lifesteal mechanic", () => {
    const attacker = makeChar({ lifestealPercent: 10, currentHP: 500 });
    const target = makeChar({ instanceId: "t", team: "enemy", currentDefense: 0 });
    const skill: SkillCard = {
      skillName: "Drain",
      characterId: "c",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [100, 100, 100],
      mechanics: [{ type: "lifesteal", valuePercent: 30 }],
    };
    const result = executeSkill(
      { sourceInstanceId: "c", skill, targetInstanceId: "t" },
      { playerTeam: [attacker], enemyTeam: [target] },
      () => {},
    );
    // dealt = 100; skill lifesteal 30 -> +30; substat lifesteal 10% -> +10
    expect(result.playerTeam[0].currentHP).toBe(540);
  });
});
