import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard, } from "@/types/skillCard";
import type { UltimateCard } from "@/types/ultimateCard";

const noopLog = () => {};

const flowingRuinPassive = {
  name: "Flowing Ruin",
  description:
    "After using a skill, gains 1 Flowing Ruin stack. At 3 stacks, the next skill consumes all stacks, deals 50% more damage, and lowers target ATK by 20% for 2 turns.",
  trigger: "afterSkill",
  mechanics: [
    {
      type: "buff",
      name: "Flowing Ruin Stack",
      maxStacks: 3,
    },
    {
      type: "conditionalBuff",
      name: "Flowing Ruin Empowerment",
      conditionStacks: 3,
      damageBonusPercent: 50,
      atkDownPercent: 20,
      atkDownDuration: 2,
    },
  ],
};

const singleAttack: SkillCard = {
  skillName: "Strike",
  characterId: "duke",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [100, 100, 100],
};

const aoeAttack: SkillCard = {
  skillName: "Slide",
  characterId: "duke",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [100, 100, 100],
  mechanics: [{ type: "aoe" }],
};

const ult: UltimateCard = {
  skillName: "Water",
  characterId: "duke",
  type: "ultimate",
  statMultiplier: "atk",
  damage: 100,
};

function makeDuke(stacks: number): BattleCharacter {
  return {
    id: "duke",
    name: "Duke",
    color: "blue",
    atk: 100,
    def: 0,
    hp: 1000,
    skills: [singleAttack, aoeAttack] as [SkillCard, SkillCard],
    passive: flowingRuinPassive,
    instanceId: "duke",
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 0,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: { flowingRuinStacks: stacks },
    team: "player",
  } as BattleCharacter;
}

function makeEnemy(instanceId: string): BattleCharacter {
  return {
    id: instanceId,
    name: instanceId,
    color: "red",
    atk: 50,
    def: 0,
    hp: 1000,
    skills: [singleAttack, singleAttack] as [SkillCard, SkillCard],
    instanceId,
    currentHP: 1000,
    currentAttack: 50,
    currentDefense: 0,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team: "enemy",
  } as BattleCharacter;
}

function run(skill: SkillCard | UltimateCard, stacks: number, enemies = 1) {
  const duke = makeDuke(stacks);
  const enemyTeam = Array.from({ length: enemies }, (_, i) =>
    makeEnemy(`e${i}`),
  );
  return executeSkill(
    {
      sourceInstanceId: "duke",
      skill,
      targetInstanceId: "e0",
    },
    { playerTeam: [duke], enemyTeam },
    noopLog,
  );
}

describe("Flowing Ruin passive", () => {
  it("gains 1 stack after a skill, capped at 3", () => {
    expect(run(singleAttack, 0).playerTeam[0].passiveState.flowingRuinStacks).toBe(1);
    expect(run(singleAttack, 1).playerTeam[0].passiveState.flowingRuinStacks).toBe(2);
  });

  it("gains a stack from the ultimate too", () => {
    expect(run(ult, 0).playerTeam[0].passiveState.flowingRuinStacks).toBe(1);
  });

  it("below 3 stacks, deals normal damage and applies no ATK debuff", () => {
    const result = run(singleAttack, 2);
    expect(result.enemyTeam[0].currentHP).toBe(900);
    expect(result.enemyTeam[0].debuffs).toHaveLength(0);
  });

  it("at 3 stacks, consumes all stacks: +50% damage and 20% ATK down for 2 turns", () => {
    const result = run(singleAttack, 3);
    expect(result.enemyTeam[0].currentHP).toBe(1000 - 150);
    const atkDown = result.enemyTeam[0].debuffs.find(
      (d) => d.type === "debuff" && d.stat === "atk",
    );
    expect(atkDown?.valuePercent).toBe(20);
    expect(atkDown?.debuffDuration).toBe(2);
    // consumed to 0, then the skill itself grants 1
    expect(result.playerTeam[0].passiveState.flowingRuinStacks).toBe(1);
  });

  it("empowered AoE applies bonus damage and ATK down to every target", () => {
    const result = run(aoeAttack, 3, 3);
    result.enemyTeam.forEach((enemy) => {
      expect(enemy.currentHP).toBe(1000 - 150);
      expect(
        enemy.debuffs.some((d) => d.type === "debuff" && d.stat === "atk"),
      ).toBe(true);
    });
  });

  it("the ultimate can be the empowered consumer", () => {
    const result = run(ult, 3);
    expect(result.enemyTeam[0].currentHP).toBe(1000 - 150);
    expect(
      result.enemyTeam[0].debuffs.some(
        (d) => d.type === "debuff" && d.stat === "atk",
      ),
    ).toBe(true);
  });
});
