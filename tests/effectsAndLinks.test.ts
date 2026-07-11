import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import { calculateDamage } from "@/lib/game/damage";
import { syncExtortLinks } from "@/lib/game/effects";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";

const noopLog = () => {};

function dummySkill(): SkillCard {
  return {
    skillName: "Dummy",
    characterId: "dummy",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
  };
}

function makeChar(
  overrides: Partial<BattleCharacter> & {
    instanceId: string;
    team: "player" | "enemy";
  },
): BattleCharacter {
  return {
    id: overrides.instanceId,
    name: overrides.instanceId,
    color: "blue",
    atk: 100,
    def: 0,
    hp: 1000,
    skills: [dummySkill(), dummySkill()] as [SkillCard, SkillCard],
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 0,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    ...overrides,
  } as BattleCharacter;
}

describe("ruling #30 — uncancellable entries are effects, not buffs/debuffs", () => {
  it("Rupture does not double damage against a target with only uncancellable buffs", () => {
    const target = makeChar({ instanceId: "t", team: "enemy" });
    target.buffs.push({
      type: "buff",
      stat: "all",
      valuePercent: 5,
      uncancellable: true,
      preApplied: true,
      name: "Collab synergy",
    });
    const noBuffDamage = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "rupture" }],
      target: makeChar({ instanceId: "clean", team: "enemy" }),
    });
    const synergyOnlyDamage = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "rupture" }],
      target,
    });
    expect(synergyOnlyDamage).toBe(noBuffDamage);

    target.buffs.push({ type: "buff", stat: "atk", valuePercent: 30 });
    const realBuffDamage = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "rupture" }],
      target,
    });
    expect(realBuffDamage).toBe(noBuffDamage * 2);
  });

  it("Weakpoint ignores uncancellable debuff entries", () => {
    const target = makeChar({ instanceId: "t", team: "enemy" });
    target.debuffs.push({
      type: "debuff",
      stat: "hp",
      valuePercent: 8,
      uncancellable: true,
      name: "Extort Life",
    });
    const damage = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "weakpoint" }],
      target,
    });
    expect(damage).toBe(200); // no 3x — the shred is an "effect"
  });

  it("Amplify counts only cancellable buffs", () => {
    const attacker = makeChar({ instanceId: "a", team: "player" });
    attacker.buffs.push(
      {
        type: "buff",
        stat: "all",
        valuePercent: 5,
        uncancellable: true,
        preApplied: true,
        name: "synergy",
      },
      { type: "buff", stat: "hp", valuePercent: 10, name: "real" },
    );
    const target = makeChar({ instanceId: "t", team: "enemy" });
    const skill: SkillCard = {
      skillName: "Amp",
      characterId: "a",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [100, 100, 100],
      mechanics: [{ type: "amplify", valuePercent: 10 }],
    } as SkillCard;
    const result = executeSkill(
      {
        sourceInstanceId: "a",
        skill,
        targetInstanceId: "t",
        rank: 1,
      },
      { playerTeam: [attacker], enemyTeam: [target] },
      noopLog,
      0,
      () => 0.99, // no evade/crit
    );
    const hit = 1000 - result.enemyTeam[0].currentHP;
    // 100 base × 1.10 (ONE countable buff) = 110, not 120
    expect(hit).toBe(110);
  });

  it("Cleanse leaves uncancellable debuff entries in place", () => {
    const healer = makeChar({ instanceId: "h", team: "player" });
    const ally = makeChar({ instanceId: "ally", team: "player" });
    ally.debuffs.push(
      { type: "debuff", stat: "atk", valuePercent: 20, name: "real" },
      {
        type: "debuff",
        stat: "hp",
        valuePercent: 8,
        uncancellable: true,
        name: "Extort Life",
      },
    );
    const skill: SkillCard = {
      skillName: "Cleanse",
      characterId: "h",
      type: "heal",
      statMultiplier: "atk",
      damageRanked: [0, 0, 0],
      mechanics: [{ type: "cleanse" }],
    } as SkillCard;
    const result = executeSkill(
      { sourceInstanceId: "h", skill, targetInstanceId: "ally", rank: 1 },
      { playerTeam: [healer, ally], enemyTeam: [] },
      noopLog,
      0,
    );
    const cleansed = result.playerTeam.find((c) => c.instanceId === "ally")!;
    expect(cleansed.debuffs).toHaveLength(1);
    expect(cleansed.debuffs[0].name).toBe("Extort Life");
  });
});

describe("ruling #31 — cancelling stances breaks the target's taunts", () => {
  it("cancelStances removes taunt redirect markers authored by the target", () => {
    const attacker = makeChar({ instanceId: "killua", team: "player" });
    const ally = makeChar({ instanceId: "gon", team: "player" });
    const taunter = makeChar({ instanceId: "yalina", team: "enemy" });
    taunter.buffs.push({
      type: "stance",
      stat: "damageReduction",
      valuePercent: 25,
      buffDuration: 1,
    });
    // Her taunt markers live on the player team
    attacker.debuffs.push({
      type: "taunt",
      debuffDuration: 1,
      sourceId: "yalina",
    });
    ally.debuffs.push({ type: "taunt", debuffDuration: 1, sourceId: "yalina" });

    const skill: SkillCard = {
      skillName: "Lightning Palm",
      characterId: "killua",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [150, 180, 250],
      mechanics: [{ type: "cancelStances" }],
    } as SkillCard;
    const result = executeSkill(
      { sourceInstanceId: "killua", skill, targetInstanceId: "yalina", rank: 1 },
      { playerTeam: [attacker, ally], enemyTeam: [taunter] },
      noopLog,
      0,
      () => 0.99,
    );
    const after = result.enemyTeam[0];
    expect(after.buffs.some((b) => b.type === "stance")).toBe(false);
    result.playerTeam.forEach((unit) => {
      expect(unit.debuffs.some((d) => d.type === "taunt")).toBe(false);
    });
  });
});

describe("ruling #32 — Extort link lifecycle", () => {
  it("the thief's Extort buff drops when the extorted unit dies", () => {
    const ban = makeChar({ instanceId: "ban", team: "enemy" });
    ban.buffs.push(
      { type: "buff", stat: "atk", flatValue: 40, name: "Extort" },
      { type: "buff", stat: "def", flatValue: 40, name: "Extort" },
    );
    const victim = makeChar({ instanceId: "v", team: "player" });
    victim.debuffs.push(
      {
        type: "debuff",
        stat: "atk",
        valuePercent: 20,
        name: "Extort",
        sourceId: "ban",
      },
      {
        type: "debuff",
        stat: "def",
        valuePercent: 20,
        name: "Extort",
        sourceId: "ban",
      },
    );

    // Alive and linked: buff persists
    syncExtortLinks([victim], [ban], noopLog);
    expect(ban.buffs.filter((b) => b.name === "Extort")).toHaveLength(2);

    // Victim dies: buff fades
    victim.currentHP = 0;
    syncExtortLinks([victim], [ban], noopLog);
    expect(ban.buffs.filter((b) => b.name === "Extort")).toHaveLength(0);
  });

  it("the buff also drops when the last Extort debuff is cleansed away", () => {
    const ban = makeChar({ instanceId: "ban", team: "enemy" });
    ban.buffs.push({
      type: "buff",
      stat: "atk",
      flatValue: 40,
      name: "Extort",
    });
    const victim = makeChar({ instanceId: "v", team: "player" });
    // no Extort debuffs (cleansed)
    syncExtortLinks([victim], [ban], noopLog);
    expect(ban.buffs.some((b) => b.name === "Extort")).toBe(false);
  });
});
