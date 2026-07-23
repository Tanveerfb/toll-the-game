import { describe, expect, it } from "vitest";
import {
  getEffectiveCritDamage,
  getEffectiveRecoveryRate,
  getEffectiveLifesteal,
  getEffectiveCritResist,
} from "@/lib/game/substats";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";

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
