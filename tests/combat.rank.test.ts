import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import type { BattleCharacter } from "@/types/character";
import type { Action } from "@/types/action";
import type { SkillCard } from "@/types/skillCard";

const noopLog = () => {};

function makeChar(
  overrides: Partial<BattleCharacter> & { instanceId: string; team: "player" | "enemy" },
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

function dummySkill(): SkillCard {
  return {
    skillName: "Dummy",
    characterId: "dummy",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
  };
}

describe("card rank in executeSkill", () => {
  const rankedAttack: SkillCard = {
    skillName: "Ranked Strike",
    characterId: "attacker",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 150, 200],
    mechanics: [
      // ranked mechanic value: should scale with card rank
      { type: "pierce", valueRanked: [0, 0, 0] },
      // ignite stacks scale with rank (Lyra/Tao pattern)
      { type: "ignite", stacksRanked: [1, 1, 3] },
    ],
  };

  function run(rank: 1 | 2 | 3 | undefined) {
    const attacker = makeChar({ instanceId: "attacker", team: "player" });
    const target = makeChar({ instanceId: "target", team: "enemy" });
    const action: Action = {
      sourceInstanceId: "attacker",
      skill: rankedAttack,
      targetInstanceId: "target",
      ...(rank ? { rank } : {}),
    };
    const result = executeSkill(
      action,
      { playerTeam: [attacker], enemyTeam: [target] },
      noopLog,
    );
    return result.enemyTeam[0];
  }

  it("uses rank 1 damage multiplier by default (AI / legacy actions)", () => {
    expect(run(undefined).currentHP).toBe(1000 - 100);
  });

  it("uses damageRanked[rank-1] for the damage multiplier", () => {
    expect(run(2).currentHP).toBe(1000 - 150);
    expect(run(3).currentHP).toBe(1000 - 200);
  });

  it("scales ranked mechanic values (ignite stacksRanked) with card rank", () => {
    const r1 = run(1).debuffs.find((d) => d.type === "ignite");
    const r3 = run(3).debuffs.find((d) => d.type === "ignite");
    expect(r1?.stacks).toBe(1);
    expect(r3?.stacks).toBe(3);
  });

  it("leaves flat mechanic values unchanged across ranks", () => {
    const flatSkill: SkillCard = {
      skillName: "Flat Amplify",
      characterId: "attacker",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [100, 100, 100],
      mechanics: [{ type: "amplify", valuePercent: 10 }],
    };
    const attacker = makeChar({
      instanceId: "attacker",
      team: "player",
      buffs: [{ type: "buff", stat: "atk", valuePercent: 5 }],
    });
    const target = makeChar({ instanceId: "target", team: "enemy" });
    const action: Action = {
      sourceInstanceId: "attacker",
      skill: flatSkill,
      targetInstanceId: "target",
      rank: 3,
    };
    const result = executeSkill(
      action,
      { playerTeam: [attacker], enemyTeam: [target] },
      noopLog,
    );
    // 1 buff × flat 10% amplify → 110 damage regardless of rank
    expect(result.enemyTeam[0].currentHP).toBe(1000 - 110);
  });

  it("activates aoeRanked only at ranks flagged true", () => {
    const aoeHeal: SkillCard = {
      skillName: "Cleansing Bloom",
      characterId: "healer",
      type: "heal",
      statMultiplier: "atk",
      damageRanked: [50, 50, 50],
      mechanics: [{ type: "aoeRanked", ranks: [false, true, true] }],
    };
    const healer = makeChar({
      instanceId: "healer",
      team: "player",
      currentHP: 500,
    });
    const ally = makeChar({
      instanceId: "ally",
      team: "player",
      currentHP: 500,
    });
    const enemy = makeChar({ instanceId: "enemy", team: "enemy" });

    const heal = (rank: 1 | 2 | 3) =>
      executeSkill(
        // single-target default: heals the primary target only
        {
          sourceInstanceId: "healer",
          skill: aoeHeal,
          targetInstanceId: "ally",
          rank,
        },
        {
          playerTeam: [
            { ...healer, buffs: [], debuffs: [], passiveState: {} },
            { ...ally, buffs: [], debuffs: [], passiveState: {} },
          ],
          enemyTeam: [{ ...enemy, buffs: [], debuffs: [], passiveState: {} }],
        },
        noopLog,
      );

    const r1 = heal(1);
    expect(r1.playerTeam[1].currentHP).toBe(550); // targeted ally healed
    expect(r1.playerTeam[0].currentHP).toBe(500); // healer not healed at rank 1

    const r2 = heal(2);
    expect(r2.playerTeam[0].currentHP).toBe(550); // AoE at rank 2: whole team
    expect(r2.playerTeam[1].currentHP).toBe(550);
  });

  it("ultimates ignore rank entirely", () => {
    const attacker = makeChar({
      instanceId: "attacker",
      team: "player",
      ultimate: undefined,
    });
    const target = makeChar({ instanceId: "target", team: "enemy" });
    const action: Action = {
      sourceInstanceId: "attacker",
      skill: {
        skillName: "Ult",
        characterId: "attacker",
        type: "ultimate",
        statMultiplier: "atk",
        damage: 350,
      },
      targetInstanceId: "target",
      rank: 3,
    };
    const result = executeSkill(
      action,
      { playerTeam: [attacker], enemyTeam: [target] },
      noopLog,
    );
    expect(result.enemyTeam[0].currentHP).toBe(1000 - 350);
  });
});
