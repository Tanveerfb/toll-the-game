import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import type { UltimateCard } from "@/types/ultimateCard";

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

  it("the SAME source re-casting an ATK-lower debuff OVERRIDES its own instance, not stack", () => {
    const gabrist = makeChar({ instanceId: "gabrist", team: "player" });
    const enemy = makeChar({ instanceId: "enemy", team: "enemy" });
    const inkSlash: SkillCard = {
      skillName: "Ink Slash",
      characterId: "gabrist",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [100, 100, 100],
      mechanics: [{ type: "debuff", stat: "atk", valuePercent: 50, duration: 2 }],
    };
    let teams = { playerTeam: [gabrist], enemyTeam: [enemy] };
    teams = executeSkill(
      { sourceInstanceId: "gabrist", skill: inkSlash, targetInstanceId: "enemy", rank: 1 },
      teams,
      noopLog,
    );
    teams = executeSkill(
      { sourceInstanceId: "gabrist", skill: inkSlash, targetInstanceId: "enemy", rank: 1 },
      teams,
      noopLog,
    );
    const atkDebuffs = teams.enemyTeam[0].debuffs.filter(
      (d) => d.type === "debuff" && d.stat === "atk",
    );
    expect(atkDebuffs).toHaveLength(1); // still one instance, not two
    expect(atkDebuffs[0].valuePercent).toBe(50);
  });

  it("a DIFFERENT source's ATK-lower debuff stacks alongside the first (multiplicatively)", () => {
    const gabrist = makeChar({ instanceId: "gabrist", team: "player" });
    const duke = makeChar({ instanceId: "duke", team: "player" });
    const enemy = makeChar({ instanceId: "enemy", team: "enemy" });
    const inkSlash: SkillCard = {
      skillName: "Ink Slash",
      characterId: "gabrist",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [100, 100, 100],
      mechanics: [{ type: "debuff", stat: "atk", valuePercent: 50, duration: 2 }],
    };
    let teams = { playerTeam: [gabrist, duke], enemyTeam: [enemy] };
    teams = executeSkill(
      { sourceInstanceId: "gabrist", skill: inkSlash, targetInstanceId: "enemy", rank: 1 },
      teams,
      noopLog,
    );
    teams = executeSkill(
      { sourceInstanceId: "duke", skill: weaken, targetInstanceId: "enemy", rank: 1 },
      teams,
      noopLog,
    );
    const atkDebuffs = teams.enemyTeam[0].debuffs.filter(
      (d) => d.type === "debuff" && d.stat === "atk",
    );
    expect(atkDebuffs).toHaveLength(2); // Gabrist's 50% and Duke's 15% both present
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

describe("Corrosion basis (R3/ultimate = max HP, else remaining HP)", () => {
  const corrosiveSkill: SkillCard = {
    skillName: "Corrosive Surge",
    characterId: "molvarr",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
    mechanics: [{ type: "corrosion", valuePercent: 10, duration: 2 }],
  };
  const corrosiveUlt: UltimateCard = {
    skillName: "Corrosive Ultimate",
    characterId: "molvarr",
    type: "ultimate",
    statMultiplier: "atk",
    damage: 100,
    mechanics: [{ type: "corrosion", valuePercent: 10, duration: 2 }],
  };

  it("R1/R2 applications do NOT set maxHp (remaining-HP basis)", () => {
    const molvarr = makeChar({ instanceId: "molvarr", team: "enemy" });
    const enemy = makeChar({ instanceId: "enemy", team: "player" });
    for (const rank of [1, 2] as const) {
      const result = executeSkill(
        { sourceInstanceId: "molvarr", skill: corrosiveSkill, targetInstanceId: "enemy", rank },
        { playerTeam: [enemy], enemyTeam: [molvarr] },
        noopLog,
      );
      const dot = result.playerTeam[0].debuffs.find((d) => d.type === "corrosion");
      expect(dot?.maxHp).toBeFalsy();
    }
  });

  it("R3 sets maxHp:true (max-HP basis)", () => {
    const molvarr = makeChar({ instanceId: "molvarr", team: "enemy" });
    const enemy = makeChar({ instanceId: "enemy", team: "player" });
    const result = executeSkill(
      { sourceInstanceId: "molvarr", skill: corrosiveSkill, targetInstanceId: "enemy", rank: 3 },
      { playerTeam: [enemy], enemyTeam: [molvarr] },
      noopLog,
    );
    const dot = result.playerTeam[0].debuffs.find((d) => d.type === "corrosion");
    expect(dot?.maxHp).toBe(true);
  });

  it("an ultimate application sets maxHp:true regardless of rank", () => {
    const molvarr = makeChar({ instanceId: "molvarr", team: "enemy" });
    const enemy = makeChar({ instanceId: "enemy", team: "player" });
    const result = executeSkill(
      { sourceInstanceId: "molvarr", skill: corrosiveUlt, targetInstanceId: "enemy", rank: 1 },
      { playerTeam: [enemy], enemyTeam: [molvarr] },
      noopLog,
    );
    const dot = result.playerTeam[0].debuffs.find((d) => d.type === "corrosion");
    expect(dot?.maxHp).toBe(true);
  });
});
