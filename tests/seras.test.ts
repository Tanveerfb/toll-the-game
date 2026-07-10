import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import { calculateDamage } from "@/lib/game/damage";
import { getTypeModifier } from "@/lib/game/typeAdvantage";
import { getEvadeChance } from "@/lib/game/evade";
import { tickTeamDebuffs } from "@/lib/game/tick";
import { registerCharacterPassives } from "@/lib/game/passive";
import type { BattleCharacter } from "@/types/character";
import type { Action } from "@/types/action";
import type { SkillCard } from "@/types/skillCard";
import type { UltimateCard } from "@/types/ultimateCard";
import serasData from "@/data/characters/seras.json";

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

function makeSeras(team: "player" | "enemy" = "player"): BattleCharacter {
  return makeChar({
    instanceId: "seras",
    team,
    color: "light",
    atk: serasData.atk,
    def: serasData.def,
    hp: serasData.hp,
    currentAttack: serasData.atk,
    currentDefense: serasData.def,
    currentHP: serasData.hp,
    tags: serasData.tags,
    passive: serasData.passive,
  } as Partial<BattleCharacter> & { instanceId: string; team: "player" | "enemy" });
}

describe("type advantage chart", () => {
  it("dark and light mutually advantage each other", () => {
    expect(getTypeModifier("dark", "light")).toBe(1.2);
    expect(getTypeModifier("light", "dark")).toBe(1.2);
  });

  it("red > green > blue > red at +20%", () => {
    expect(getTypeModifier("red", "green")).toBe(1.2);
    expect(getTypeModifier("green", "blue")).toBe(1.2);
    expect(getTypeModifier("blue", "red")).toBe(1.2);
  });

  it("reverse of the color chain is -10%", () => {
    expect(getTypeModifier("green", "red")).toBe(0.9);
    expect(getTypeModifier("blue", "green")).toBe(0.9);
    expect(getTypeModifier("red", "blue")).toBe(0.9);
  });

  it("same color and cross-group matchups are neutral", () => {
    expect(getTypeModifier("red", "red")).toBe(1.0);
    expect(getTypeModifier("red", "light")).toBe(1.0);
    expect(getTypeModifier("dark", "green")).toBe(1.0);
  });

  it("applies inside executeSkill", () => {
    const attacker = makeChar({
      instanceId: "attacker",
      team: "player",
      color: "red",
    });
    const target = makeChar({
      instanceId: "target",
      team: "enemy",
      color: "green",
    });
    const action: Action = {
      sourceInstanceId: "attacker",
      skill: dummySkill(),
      targetInstanceId: "target",
    };
    const result = executeSkill(
      action,
      { playerTeam: [attacker], enemyTeam: [target] },
      noopLog,
    );
    // 100 base, 0 def, x1.2 advantage
    expect(result.enemyTeam[0].currentHP).toBe(1000 - 120);
  });
});

describe("CRITICAL (Seras ultimate)", () => {
  it("ignores 50% defense and adds 50% damage", () => {
    const target = makeChar({
      instanceId: "t",
      team: "enemy",
      currentDefense: 100,
    });
    // (200 - 50) * 1.5
    const dmg = calculateDamage({
      baseDamage: 200,
      skillMechanics: [
        { type: "critical", ignoreDefensePercent: 50, damageBonusPercent: 50 },
      ],
      target,
      attackerColor: "light",
    });
    expect(dmg).toBe(225);
  });

  it("ignores type advantage and disadvantage", () => {
    const advantaged = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "critical", ignoreDefensePercent: 0, damageBonusPercent: 0 }],
      target: makeChar({ instanceId: "t", team: "enemy", color: "dark" }),
      attackerColor: "light",
    });
    const neutral = calculateDamage({
      baseDamage: 200,
      skillMechanics: [{ type: "critical", ignoreDefensePercent: 0, damageBonusPercent: 0 }],
      target: makeChar({ instanceId: "t", team: "enemy", color: "red" }),
      attackerColor: "light",
    });
    expect(advantaged).toBe(neutral);
  });
});

describe("Shock", () => {
  const shockSkill: SkillCard = {
    skillName: "Static Lance",
    characterId: "seras",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
    mechanics: [{ type: "shock", damagePercent: 30, duration: 4 }],
  };

  function hit(target: BattleCharacter) {
    const attacker = makeChar({ instanceId: "attacker", team: "player" });
    const action: Action = {
      sourceInstanceId: "attacker",
      skill: shockSkill,
      targetInstanceId: target.instanceId,
    };
    return executeSkill(
      action,
      { playerTeam: [attacker], enemyTeam: [target] },
      noopLog,
    ).enemyTeam[0];
  }

  it("applies a DoT worth 30% of the damage dealt", () => {
    const target = hit(makeChar({ instanceId: "target", team: "enemy" }));
    // 100 dealt -> 30 per turn
    expect(target.currentHP).toBe(900);
    const shock = target.debuffs.find((d) => d.name === "Shock");
    expect(shock?.value).toBe(30);
    expect(shock?.debuffDuration).toBe(4);
  });

  it("each application is independent (stacks)", () => {
    let target = hit(makeChar({ instanceId: "target", team: "enemy" }));
    target = hit(target);
    const shocks = target.debuffs.filter((d) => d.name === "Shock");
    expect(shocks).toHaveLength(2);
  });

  it("ticks as damage over time at the victim's turn end", () => {
    const target = hit(makeChar({ instanceId: "target", team: "enemy" }));
    const [ticked] = tickTeamDebuffs([target], noopLog);
    expect(ticked.currentHP).toBe(900 - 30);
  });
});

describe("Charged passive + evade", () => {
  function attackSeras(seras: BattleCharacter, rng: () => number) {
    const attacker = makeChar({ instanceId: "attacker", team: "enemy" });
    const action: Action = {
      sourceInstanceId: "attacker",
      skill: dummySkill(),
      targetInstanceId: "seras",
    };
    return executeSkill(
      action,
      { playerTeam: [seras], enemyTeam: [attacker] },
      noopLog,
      0,
      rng,
    ).playerTeam[0];
  }

  it("gains a stack and stat boosts when hit", () => {
    const seras = attackSeras(makeSeras(), () => 0.99);
    expect(seras.passiveState.chargedStacks).toBe(1);
    expect(seras.currentAttack).toBe(
      serasData.atk + Math.floor(serasData.atk * 0.05),
    );
    expect(seras.currentDefense).toBe(
      serasData.def + Math.floor(serasData.def * 0.05),
    );
  });

  it("caps at the data-defined max stacks", () => {
    const cap = (serasData.passive.mechanics[0] as { maxStacks: number })
      .maxStacks;
    let seras = makeSeras();
    for (let i = 0; i < cap + 3; i++) seras = attackSeras(seras, () => 0.99);
    expect(seras.passiveState.chargedStacks).toBe(cap);
  });

  it("evade chance grows 5% per stack from a 0 base", () => {
    const seras = makeSeras();
    expect(getEvadeChance(seras)).toBe(0);
    seras.passiveState.chargedStacks = 3;
    expect(getEvadeChance(seras)).toBe(15);
  });

  it("an evaded attack deals no damage and still grants a stack", () => {
    const seras = makeSeras();
    seras.passiveState.chargedStacks = 4; // 20% evade
    const before = seras.currentHP;
    const after = attackSeras(seras, () => 0.1); // roll 10 < 20 -> evade
    expect(after.currentHP).toBe(before);
    expect(after.passiveState.chargedStacks).toBe(5);
  });

  it("units without evade sources never evade", () => {
    const plain = makeChar({ instanceId: "plain", team: "player" });
    expect(getEvadeChance(plain)).toBe(0);
  });
});

describe("Powerful Opponent synergy", () => {
  it("registers at battle start despite the onAttackReceived trigger and applies a flat +10% to tag carriers", async () => {
    const seras = makeSeras();
    const ally = makeChar({
      instanceId: "ally",
      team: "player",
      tags: ["Powerful Opponent"],
    });
    const outsider = makeChar({ instanceId: "outsider", team: "player" });

    let captured: any = null;
    registerCharacterPassives(seras, (item) => (captured = item));
    expect(captured).not.toBeNull();
    expect(captured.phase).toBe("OnBattleStart");

    const teams = {
      playerTeam: [seras, ally, outsider],
      enemyTeam: [] as BattleCharacter[],
    };
    const result = await captured.action(seras, teams, noopLog);

    const boostedAlly = result.playerTeam.find(
      (c: BattleCharacter) => c.instanceId === "ally",
    );
    const boostedSeras = result.playerTeam.find(
      (c: BattleCharacter) => c.instanceId === "seras",
    );
    const untouched = result.playerTeam.find(
      (c: BattleCharacter) => c.instanceId === "outsider",
    );

    // flat 10% even though TWO carriers are on the team
    expect(boostedAlly.currentAttack).toBe(110);
    expect(boostedSeras.currentAttack).toBe(
      serasData.atk + Math.floor(serasData.atk * 0.1),
    );
    expect(untouched.currentAttack).toBe(100);
  });

  it("Seras ultimate outdamages her rank-3 skills", () => {
    const ult = serasData.ultimate as unknown as UltimateCard;
    const maxSkill = Math.max(
      ...serasData.skills.map((s) => s.damageRanked[2]),
    );
    expect(ult.damage).toBeGreaterThan(maxSkill);
  });
});
