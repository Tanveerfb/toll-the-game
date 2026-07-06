import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";

const noopLog = () => {};

function makeChar(
  overrides: Partial<BattleCharacter> & {
    instanceId: string;
    team: "player" | "enemy";
  },
): BattleCharacter {
  const dummy: SkillCard = {
    skillName: "Dummy",
    characterId: "dummy",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
  };
  return {
    id: overrides.instanceId,
    name: overrides.instanceId,
    color: "blue",
    atk: 100,
    def: 0,
    hp: 1000,
    skills: [dummy, dummy] as [SkillCard, SkillCard],
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

// Duke's Weaken per ruling: damage + ATK-down [15/25/40]% for 2 turns
const weaken: SkillCard = {
  skillName: "Fist of Flowing Ruin : Weaken",
  characterId: "duke",
  type: "debuff",
  statMultiplier: "atk",
  damageRanked: [110, 145, 205],
  mechanics: [
    {
      type: "debuff",
      stat: "atk",
      valueRanked: [15, 25, 40],
      duration: 2,
    },
  ],
};

// Yalina's Draw Fire: debuff type, zero damage, taunts all enemies + self buff
const drawFire: SkillCard = {
  skillName: "Draw Fire",
  characterId: "yalina",
  type: "debuff",
  statMultiplier: "def",
  damageRanked: [0, 0, 0],
  mechanics: [
    { type: "aoe" },
    { type: "taunt", durationRanked: [1, 1, 2] },
    {
      type: "buff",
      stat: "damageReduction",
      valueRanked: [25, 40, 60],
      durationRanked: [1, 1, 2],
      targetSelf: true,
    },
  ],
};

describe("debuff-type skills", () => {
  it("deal their damageRanked damage when > 0 (Weaken)", () => {
    const duke = makeChar({ instanceId: "duke", team: "player" });
    const enemy = makeChar({ instanceId: "enemy", team: "enemy" });
    const result = executeSkill(
      {
        sourceInstanceId: "duke",
        skill: weaken,
        targetInstanceId: "enemy",
        rank: 1,
      },
      { playerTeam: [duke], enemyTeam: [enemy] },
      noopLog,
    );
    expect(result.enemyTeam[0].currentHP).toBe(1000 - 110);
    const atkDown = result.enemyTeam[0].debuffs.find(
      (d) => d.type === "debuff" && d.stat === "atk",
    );
    expect(atkDown?.valuePercent).toBe(15);
    expect(atkDown?.debuffDuration).toBe(2);
  });

  it("scale Weaken's ATK-down with card rank ([15/25/40]%)", () => {
    const duke = makeChar({ instanceId: "duke", team: "player" });
    const enemy = makeChar({ instanceId: "enemy", team: "enemy" });
    const result = executeSkill(
      {
        sourceInstanceId: "duke",
        skill: weaken,
        targetInstanceId: "enemy",
        rank: 3,
      },
      { playerTeam: [duke], enemyTeam: [enemy] },
      noopLog,
    );
    expect(result.enemyTeam[0].currentHP).toBe(1000 - 205);
    const atkDown = result.enemyTeam[0].debuffs.find(
      (d) => d.type === "debuff" && d.stat === "atk",
    );
    expect(atkDown?.valuePercent).toBe(40);
  });

  it("zero-damage debuff skills apply their mechanics without dealing damage (Draw Fire)", () => {
    const yalina = makeChar({ instanceId: "yalina", team: "player" });
    const e1 = makeChar({ instanceId: "e1", team: "enemy" });
    const e2 = makeChar({ instanceId: "e2", team: "enemy" });
    const result = executeSkill(
      {
        sourceInstanceId: "yalina",
        skill: drawFire,
        targetInstanceId: "e1",
        rank: 1,
      },
      { playerTeam: [yalina], enemyTeam: [e1, e2] },
      noopLog,
    );
    // No damage to anyone
    expect(result.enemyTeam[0].currentHP).toBe(1000);
    expect(result.enemyTeam[1].currentHP).toBe(1000);
    // Every enemy taunted toward Yalina
    result.enemyTeam.forEach((enemy) => {
      const taunt = enemy.debuffs.find((d) => d.type === "taunt");
      expect(taunt?.sourceId).toBe("yalina");
    });
    // Self damage-reduction buff on Yalina
    const selfBuff = result.playerTeam[0].buffs.find(
      (b) => b.stat === "damageReduction",
    );
    expect(selfBuff?.valuePercent).toBe(25);
  });

  it("heal-type skills still heal instead of dealing damage", () => {
    const healer = makeChar({
      instanceId: "healer",
      team: "player",
      currentHP: 400,
    });
    const enemy = makeChar({ instanceId: "enemy", team: "enemy" });
    const healSkill: SkillCard = {
      skillName: "Heal",
      characterId: "healer",
      type: "heal",
      statMultiplier: "atk",
      damageRanked: [75, 105, 160],
    };
    const result = executeSkill(
      {
        sourceInstanceId: "healer",
        skill: healSkill,
        targetInstanceId: "healer",
        rank: 1,
      },
      { playerTeam: [healer], enemyTeam: [enemy] },
      noopLog,
    );
    expect(result.playerTeam[0].currentHP).toBe(475);
    expect(result.enemyTeam[0].currentHP).toBe(1000);
  });
});
