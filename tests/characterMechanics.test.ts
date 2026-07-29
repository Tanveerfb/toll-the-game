import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import { registerCharacterPassives } from "@/lib/game/passive";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import masterTaoData from "@/data/characters/master_tao.json";
import siddiqData from "@/data/characters/siddiq.json";
import batraData from "@/data/characters/batra.json";

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
    // Isolate the mechanic under test from the universal 5% lifesteal
    // substat (every character has it by default) unless a test overrides it.
    lifestealPercent: 0,
    ...overrides,
  } as BattleCharacter;
}

function fromData(
  data: typeof masterTaoData | typeof siddiqData | typeof batraData,
  team: "player" | "enemy",
): BattleCharacter {
  return makeChar({
    instanceId: data.id,
    team,
    color: data.color as BattleCharacter["color"],
    atk: data.atk,
    def: data.def,
    hp: data.hp,
    currentAttack: data.atk,
    currentDefense: data.def,
    currentHP: data.hp,
    tags: data.tags,
    skills: data.skills as unknown as [SkillCard, SkillCard],
    ultimate: data.ultimate as unknown as BattleCharacter["ultimate"],
    passive: data.passive as unknown as BattleCharacter["passive"],
  });
}

describe("Master Tao: consumeIgnite chains into a same-hit ATK buff", () => {
  it("Inferno Consumption consumes all Ignite stacks on the target and boosts the strike's own ATK", () => {
    const tao = fromData(masterTaoData, "player");
    // Same color as Tao (green) so the type-advantage modifier stays neutral
    // and the expected damage math below isn't skewed by a matchup bonus.
    const enemy = makeChar({
      instanceId: "enemy",
      team: "enemy",
      color: "green",
      debuffs: [{ type: "ignite", stacks: 3, debuffDuration: 3 }],
    });
    const infernoConsumption = masterTaoData.skills[1] as unknown as SkillCard;
    const result = executeSkill(
      {
        sourceInstanceId: "master_tao",
        skill: infernoConsumption,
        targetInstanceId: "enemy",
        rank: 1,
      },
      { playerTeam: [tao], enemyTeam: [enemy] },
      noopLog,
    );
    // Ignite fully consumed off the target
    expect(
      result.enemyTeam[0].debuffs.find((d) => d.type === "ignite"),
    ).toBeUndefined();
    // 3 stacks * 20%/stack = +60% ATK, applied to Tao's currentAttack BEFORE
    // this same strike's damage is calculated (same pattern as Gon's Rock)
    const expectedAtk = masterTaoData.atk + Math.floor(masterTaoData.atk * 0.6);
    expect(result.playerTeam[0].currentAttack).toBe(expectedAtk);
    const expectedDamage = Math.floor((expectedAtk * 145) / 100);
    expect(result.enemyTeam[0].currentHP).toBe(1000 - expectedDamage);
  });

  it("consuming zero Ignite stacks grants no ATK buff", () => {
    const tao = fromData(masterTaoData, "player");
    const enemy = makeChar({ instanceId: "enemy", team: "enemy" });
    const infernoConsumption = masterTaoData.skills[1] as unknown as SkillCard;
    const result = executeSkill(
      {
        sourceInstanceId: "master_tao",
        skill: infernoConsumption,
        targetInstanceId: "enemy",
        rank: 1,
      },
      { playerTeam: [tao], enemyTeam: [enemy] },
      noopLog,
    );
    expect(result.playerTeam[0].currentAttack).toBe(masterTaoData.atk);
  });
});

describe("Master Tao: Healing Flames (onIgniteConsume passive, previously unimplemented)", () => {
  const infernoConsumption = masterTaoData.skills[1] as unknown as SkillCard;

  it("consuming exactly 3 Ignite stacks in one cast heals 30% of max HP once", () => {
    const tao = fromData(masterTaoData, "player");
    tao.currentHP = Math.floor(masterTaoData.hp * 0.5);
    const enemy = makeChar({
      instanceId: "enemy",
      team: "enemy",
      debuffs: [{ type: "ignite", stacks: 3, debuffDuration: 3 }],
    });
    const result = executeSkill(
      {
        sourceInstanceId: "master_tao",
        skill: infernoConsumption,
        targetInstanceId: "enemy",
        rank: 1,
      },
      { playerTeam: [tao], enemyTeam: [enemy] },
      noopLog,
    );
    const expectedHeal = Math.floor(masterTaoData.hp * 0.3);
    expect(result.playerTeam[0].currentHP).toBe(
      Math.floor(masterTaoData.hp * 0.5) + expectedHeal,
    );
    expect(result.playerTeam[0].passiveState.igniteConsumeTriggers).toBe(1);
  });

  it("consuming 6 stacks in one cast earns 2 triggers (still under the 3-trigger cap)", () => {
    const tao = fromData(masterTaoData, "player");
    tao.currentHP = Math.floor(masterTaoData.hp * 0.3);
    const enemy = makeChar({
      instanceId: "enemy",
      team: "enemy",
      debuffs: [{ type: "ignite", stacks: 6, debuffDuration: 3 }],
    });
    const result = executeSkill(
      {
        sourceInstanceId: "master_tao",
        skill: infernoConsumption,
        targetInstanceId: "enemy",
        rank: 1,
      },
      { playerTeam: [tao], enemyTeam: [enemy] },
      noopLog,
    );
    const expectedHeal = Math.floor(masterTaoData.hp * 0.3) * 2;
    expect(result.playerTeam[0].currentHP).toBe(
      Math.floor(masterTaoData.hp * 0.3) + expectedHeal,
    );
    expect(result.playerTeam[0].passiveState.igniteConsumeTriggers).toBe(2);
  });

  it("caps cumulative triggers at maxTriggers (3) across multiple casts — a 4th trigger heals nothing", () => {
    const tao = fromData(masterTaoData, "player");
    tao.currentHP = 1;
    tao.passiveState = { igniteConsumeTriggers: 3 }; // already at the lifetime cap
    const enemy = makeChar({
      instanceId: "enemy",
      team: "enemy",
      debuffs: [{ type: "ignite", stacks: 3, debuffDuration: 3 }],
    });
    const result = executeSkill(
      {
        sourceInstanceId: "master_tao",
        skill: infernoConsumption,
        targetInstanceId: "enemy",
        rank: 1,
      },
      { playerTeam: [tao], enemyTeam: [enemy] },
      noopLog,
    );
    expect(result.playerTeam[0].currentHP).toBe(1); // no further heal
    expect(result.playerTeam[0].passiveState.igniteConsumeTriggers).toBe(3);
  });

  it("consuming zero Ignite stacks triggers no heal", () => {
    const tao = fromData(masterTaoData, "player");
    tao.currentHP = Math.floor(masterTaoData.hp * 0.5);
    const enemy = makeChar({ instanceId: "enemy", team: "enemy" });
    const result = executeSkill(
      {
        sourceInstanceId: "master_tao",
        skill: infernoConsumption,
        targetInstanceId: "enemy",
        rank: 1,
      },
      { playerTeam: [tao], enemyTeam: [enemy] },
      noopLog,
    );
    expect(result.playerTeam[0].currentHP).toBe(
      Math.floor(masterTaoData.hp * 0.5),
    );
    expect(result.playerTeam[0].passiveState.igniteConsumeTriggers).toBeUndefined();
  });
});

describe("Siddiq: healLifesteal only triggers below the HP threshold", () => {
  const natureStrike = siddiqData.skills[0] as unknown as SkillCard;

  it("below 50% HP, Vampiric Roots heals 20% of the damage just dealt", () => {
    const siddiq = fromData(siddiqData, "player");
    siddiq.currentHP = Math.floor(siddiqData.hp * 0.4); // below the 50% gate
    const enemy = makeChar({
      instanceId: "enemy",
      team: "enemy",
      color: "red", // neutral vs Siddiq
      hp: 2000,
      currentHP: 2000,
    });
    const result = executeSkill(
      {
        sourceInstanceId: "siddiq",
        skill: natureStrike,
        targetInstanceId: "enemy",
        rank: 1,
      },
      { playerTeam: [siddiq], enemyTeam: [enemy] },
      noopLog,
    );
    const damageDealt = 2000 - result.enemyTeam[0].currentHP;
    const expectedHeal = Math.floor(damageDealt * 0.2);
    expect(result.playerTeam[0].currentHP).toBe(
      Math.floor(siddiqData.hp * 0.4) + expectedHeal,
    );
  });

  it("at full HP (above the 50% gate), no lifesteal heal triggers", () => {
    const siddiq = fromData(siddiqData, "player");
    const enemy = makeChar({
      instanceId: "enemy",
      team: "enemy",
      color: "red",
      hp: 2000,
      currentHP: 2000,
    });
    const result = executeSkill(
      {
        sourceInstanceId: "siddiq",
        skill: natureStrike,
        targetInstanceId: "enemy",
        rank: 1,
      },
      { playerTeam: [siddiq], enemyTeam: [enemy] },
      noopLog,
    );
    expect(result.playerTeam[0].currentHP).toBe(siddiqData.hp);
  });
});

describe("Batra: consumeHpPercent (Fierce Dedication) + KHALSA tag synergy stacking", () => {
  const lionsCharge = batraData.skills[0] as unknown as SkillCard;

  it("consumes 5% max HP before the skill resolves, floored at 1 HP", () => {
    const batra = fromData(batraData, "player");
    const enemy = makeChar({ instanceId: "enemy", team: "enemy", color: "blue" });
    const result = executeSkill(
      {
        sourceInstanceId: "batra",
        skill: lionsCharge,
        targetInstanceId: "enemy",
        rank: 1,
      },
      { playerTeam: [batra], enemyTeam: [enemy] },
      noopLog,
    );
    const expectedConsumed = Math.floor(batraData.hp * 0.05);
    expect(result.playerTeam[0].currentHP).toBe(batraData.hp - expectedConsumed);
  });

  it("cannot reduce Batra below 1 HP", () => {
    const batra = fromData(batraData, "player");
    batra.currentHP = 1;
    const enemy = makeChar({ instanceId: "enemy", team: "enemy", color: "blue" });
    const result = executeSkill(
      {
        sourceInstanceId: "batra",
        skill: lionsCharge,
        targetInstanceId: "enemy",
        rank: 1,
      },
      { playerTeam: [batra], enemyTeam: [enemy] },
      noopLog,
    );
    expect(result.playerTeam[0].currentHP).toBe(1);
  });

  it("KHALSA synergy scales with the number of KHALSA-tagged allies on the team", async () => {
    const batra = fromData(batraData, "player");
    const ally1 = makeChar({ instanceId: "a1", team: "player", tags: ["KHALSA"] });
    const ally2 = makeChar({ instanceId: "a2", team: "player", tags: ["KHALSA"] });
    const items: any[] = [];
    registerCharacterPassives(batra, (item) => items.push(item));
    const synergy = items.find((i) => i.mechanicId === "Fierce Dedication");
    expect(synergy).toBeDefined();

    let teams = {
      playerTeam: [batra, ally1, ally2],
      enemyTeam: [] as BattleCharacter[],
    };
    teams = await synergy.action(teams.playerTeam[0], teams, noopLog);
    // 3 KHALSA-tagged carriers on the team (Batra himself + the two allies) * 10% each
    const carriers = [batra, ally1, ally2].filter((c) =>
      c.tags?.includes("KHALSA"),
    ).length;
    const buff = teams.playerTeam[0].buffs.find(
      (b) => b.name === "[KHALSA] Synergy",
    );
    expect(buff?.valuePercent).toBe(10 * carriers);
  });
});
