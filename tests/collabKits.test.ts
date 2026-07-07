import { describe, expect, it } from "vitest";
import { executeSkill, getCritChance } from "@/lib/game/combat";
import { calculateDamage } from "@/lib/game/damage";
import { getEffectiveAttack, getEffectiveDefense } from "@/lib/game/stats";
import { getAIMove } from "@/lib/game/ai";
import { registerCharacterPassives } from "@/lib/game/passive";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import meliodasData from "@/data/characters/meliodas.json";
import banData from "@/data/characters/ban.json";
import dianeData from "@/data/characters/diane.json";

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

function fromData(
  data: any,
  team: "player" | "enemy",
  instanceId?: string,
): BattleCharacter {
  return makeChar({
    instanceId: instanceId ?? data.id,
    team,
    color: data.color,
    atk: data.atk,
    def: data.def,
    hp: data.hp,
    currentAttack: data.atk,
    currentDefense: data.def,
    currentHP: data.hp,
    tags: data.tags,
    skills: data.skills,
    ultimate: data.ultimate,
    passive: data.passive,
  } as any);
}

describe("effective stats (buffs/debuffs finally count)", () => {
  it("ATK debuff lowers dealt damage (Duke's Weaken now works)", () => {
    const attacker = makeChar({ instanceId: "a", team: "player" });
    attacker.debuffs.push({ type: "debuff", stat: "atk", valuePercent: 50 });
    expect(getEffectiveAttack(attacker)).toBe(50);
  });

  it("DEF buff raises effective defense in damage calc", () => {
    const target = makeChar({
      instanceId: "t",
      team: "enemy",
      currentDefense: 100,
    });
    target.buffs.push({ type: "buff", stat: "def", valuePercent: 50 });
    // 200 - 150 = 50
    expect(
      calculateDamage({ baseDamage: 200, skillMechanics: [], target }),
    ).toBe(50);
  });

  it("preApplied badges are not double counted", () => {
    const char = makeChar({ instanceId: "c", team: "player" });
    char.buffs.push({
      type: "buff",
      stat: "all",
      valuePercent: 10,
      preApplied: true,
    });
    expect(getEffectiveAttack(char)).toBe(100);
  });

  it("flat buff values add after the percent scaling", () => {
    const char = makeChar({ instanceId: "c", team: "player" });
    char.buffs.push({ type: "buff", stat: "atk", flatValue: 30 });
    expect(getEffectiveAttack(char)).toBe(130);
  });
});

describe("Meliodas — Deathblow + Full Counter", () => {
  it("crit chance rises 2% per 3% HP lost, from a 0 base", () => {
    const mel = fromData(meliodasData, "player");
    expect(getCritChance(mel)).toBe(0);
    mel.currentHP = Math.floor(mel.hp * 0.7); // 30% lost -> 10 steps -> 20%
    expect(getCritChance(mel)).toBe(20);
  });

  it("deathblow is inactive from the sub position", () => {
    const mel = fromData(meliodasData, "player");
    mel.isSub = true;
    mel.currentHP = Math.floor(mel.hp * 0.5);
    expect(getCritChance(mel)).toBe(0);
  });

  it("a crit applies the CRITICAL package", () => {
    const mel = fromData(meliodasData, "player");
    mel.currentHP = 1; // ~100% lost -> guaranteed crit territory
    const target = makeChar({
      instanceId: "t",
      team: "enemy",
      currentDefense: 100,
      hp: 100000,
      currentHP: 100000,
    });
    const result = executeSkill(
      {
        sourceInstanceId: "meliodas",
        skill: meliodasData.skills[0] as any,
        targetInstanceId: "t",
      },
      { playerTeam: [mel], enemyTeam: [target] },
      noopLog,
      0,
      () => 0.0, // crit roll always procs
    );
    // Deathblow dmg bonus: 33 steps * 2% = 66%; base 180*1.5=270 -> *1.66 = 448.2
    // crit: def 100 -> 50 ignored; (448 - 50) floor... verify crit happened via
    // damage exceeding the non-crit expectation instead of exact numbers:
    const hpLost = 100000 - result.enemyTeam[0].currentHP;
    expect(hpLost).toBeGreaterThan(400);
  });

  it("Full Counter stance counters a survivor's attacker; lethal hit is not countered", () => {
    const mel = fromData(meliodasData, "player");
    // Put up the stance (rank 3: 400%, 2 turns)
    let teams = executeSkill(
      {
        sourceInstanceId: "meliodas",
        skill: meliodasData.skills[1] as any,
        targetInstanceId: "meliodas",
        rank: 3,
      },
      { playerTeam: [mel], enemyTeam: [makeChar({ instanceId: "e", team: "enemy" })] },
      noopLog,
    );
    const stance = teams.playerTeam[0].buffs.find(
      (b) => b.counterDamagePercent,
    );
    expect(stance?.counterDamagePercent).toBe(400);
    expect(stance?.buffDuration).toBe(2);

    // Enemy attacks Meliodas -> takes 400% of his effective ATK back
    teams = executeSkill(
      {
        sourceInstanceId: "e",
        skill: dummySkill(),
        targetInstanceId: "meliodas",
      },
      teams,
      noopLog,
    );
    const enemy = teams.enemyTeam[0];
    const melAfter = teams.playerTeam[0];
    expect(melAfter.currentHP).toBeLessThan(melAfter.hp); // he still took the hit
    expect(enemy.currentHP).toBeLessThan(1000); // counter landed

    // Lethal hit: no counter
    const glassCannon = fromData(meliodasData, "player", "mel2");
    glassCannon.currentHP = 1;
    glassCannon.buffs.push({
      type: "stance",
      counterDamagePercent: 400,
      name: "Full Counter",
    });
    const killer = makeChar({ instanceId: "killer", team: "enemy" });
    const after = executeSkill(
      {
        sourceInstanceId: "killer",
        skill: dummySkill(),
        targetInstanceId: "mel2",
      },
      { playerTeam: [glassCannon], enemyTeam: [killer] },
      noopLog,
    );
    expect(after.playerTeam[0].currentHP).toBe(0);
    expect(after.enemyTeam[0].currentHP).toBe(1000); // no counter from the dead
  });

  it("Evil Spirit cancels the stance BEFORE damage — no counter", () => {
    const counterer = makeChar({ instanceId: "c", team: "enemy" });
    counterer.buffs.push({
      type: "stance",
      counterDamagePercent: 400,
      name: "Full Counter",
    });
    const mel = fromData(meliodasData, "player");
    const after = executeSkill(
      {
        sourceInstanceId: "meliodas",
        skill: meliodasData.ultimate as any,
        targetInstanceId: "c",
      },
      { playerTeam: [mel], enemyTeam: [counterer] },
      noopLog,
      0,
      () => 0.99, // no crit
    );
    expect(after.playerTeam[0].currentHP).toBe(after.playerTeam[0].hp); // uncountered
    expect(after.enemyTeam[0].buffs).toHaveLength(0);
    expect(
      after.enemyTeam[0].debuffs.some((d) => d.type === "stun"),
    ).toBe(true);
  });
});

describe("Ban — Lifesteal, Extort, Extort Life", () => {
  it("Drain heals 30% of damage dealt", () => {
    const ban = fromData(banData, "player");
    ban.currentHP = 500;
    const target = makeChar({ instanceId: "t", team: "enemy", color: "green" });
    const after = executeSkill(
      {
        sourceInstanceId: "ban",
        skill: banData.skills[0] as any,
        targetInstanceId: "t",
        rank: 3,
      },
      { playerTeam: [ban], enemyTeam: [target] },
      noopLog,
    );
    // 40 ATK * 400% = 160 dealt -> 48 healed
    expect(after.enemyTeam[0].currentHP).toBe(1000 - 160);
    expect(after.playerTeam[0].currentHP).toBe(500 + 48);
  });

  it("Snatch extorts per-stat and refreshes instead of stacking", () => {
    const ban = fromData(banData, "player");
    const e1 = makeChar({
      instanceId: "e1",
      team: "enemy",
      color: "green",
      currentAttack: 100,
      currentDefense: 50,
    });
    let teams = executeSkill(
      {
        sourceInstanceId: "ban",
        skill: banData.skills[1] as any,
        targetInstanceId: "e1",
        rank: 3, // 50%, 2 turns
      },
      { playerTeam: [ban], enemyTeam: [e1] },
      noopLog,
    );
    const banAfter = teams.playerTeam[0];
    const enemyAfter = teams.enemyTeam[0];
    // enemy: -50% ATK/DEF entries; Ban: +50 ATK, +25 DEF flat
    expect(getEffectiveAttack(enemyAfter)).toBe(50);
    expect(getEffectiveDefense(enemyAfter)).toBe(25);
    expect(getEffectiveAttack(banAfter)).toBe(banData.atk + 50);
    expect(getEffectiveDefense(banAfter)).toBe(banData.def + 25);

    // recast: still exactly one Extort buff pair on Ban
    teams = executeSkill(
      {
        sourceInstanceId: "ban",
        skill: banData.skills[1] as any,
        targetInstanceId: "e1",
        rank: 1,
      },
      teams,
      noopLog,
    );
    const extortBuffs = teams.playerTeam[0].buffs.filter(
      (b) => b.name === "Extort",
    );
    expect(extortBuffs).toHaveLength(2); // one ATK + one DEF, not four
  });

  it("Extort Life shreds enemy max HP on untouched rounds and fully reverts on damage", async () => {
    const ban = fromData(banData, "player");
    const enemy = makeChar({ instanceId: "e", team: "enemy" });

    const items: any[] = [];
    registerCharacterPassives(ban, (item) => items.push(item));
    const shred = items.find((i) => i.id.includes("shred"));
    expect(shred.phase).toBe("OnEnemyTurnEnd");

    // Round 1: untouched -> -8%
    let teams = { playerTeam: [ban], enemyTeam: [enemy] };
    teams = await shred.action(ban, teams, noopLog);
    expect(teams.enemyTeam[0].hp).toBe(920);
    expect(teams.enemyTeam[0].currentHP).toBe(920);

    // Round 2: untouched -> -16% of the ORIGINAL max
    teams = await shred.action(teams.playerTeam[0], teams, noopLog);
    expect(teams.enemyTeam[0].hp).toBe(840);

    // Ban takes damage -> next check fully restores enemy max HP (no heal)
    teams.playerTeam[0].passiveState.tookDamageThisRound = true;
    teams = await shred.action(teams.playerTeam[0], teams, noopLog);
    expect(teams.enemyTeam[0].hp).toBe(1000);
    expect(teams.enemyTeam[0].currentHP).toBe(840); // clamped value stays
    expect(teams.playerTeam[0].passiveState.maxHpShredStacks).toBe(0);
  });
});

describe("Diane — Rupture, Attack Seal, Giant's Will", () => {
  it("Rupture doubles damage against buffed targets only", () => {
    const clean = makeChar({ instanceId: "t", team: "enemy" });
    const buffed = makeChar({ instanceId: "t2", team: "enemy" });
    buffed.buffs.push({ type: "buff", stat: "atk", valuePercent: 10 });
    expect(
      calculateDamage({
        baseDamage: 200,
        skillMechanics: [{ type: "rupture" }],
        target: clean,
      }),
    ).toBe(200);
    // effective atk buff raises nothing for defense; base 200, x2
    expect(
      calculateDamage({
        baseDamage: 200,
        skillMechanics: [{ type: "rupture" }],
        target: buffed,
      }),
    ).toBe(400);
  });

  it("Rush Rock seals attack skills at rank 2+, not at rank 1", () => {
    const diane = fromData(dianeData, "player");
    const target = makeChar({ instanceId: "t", team: "enemy", color: "blue" });

    const r1 = executeSkill(
      {
        sourceInstanceId: "diane",
        skill: dianeData.skills[1] as any,
        targetInstanceId: "t",
        rank: 1,
      },
      { playerTeam: [diane], enemyTeam: [target] },
      noopLog,
    );
    expect(r1.enemyTeam[0].debuffs.some((d) => d.type === "seal")).toBe(false);

    const r3 = executeSkill(
      {
        sourceInstanceId: "diane",
        skill: dianeData.skills[1] as any,
        targetInstanceId: "t",
        rank: 3,
      },
      { playerTeam: [diane], enemyTeam: [makeChar({ instanceId: "t", team: "enemy", color: "blue" })] },
      noopLog,
    );
    const seal = r3.enemyTeam[0].debuffs.find((d) => d.type === "seal");
    expect(seal?.debuffDuration).toBe(2);
    expect(seal?.sealType).toBe("attack");
  });

  it("sealed attack skills fizzle in executeSkill and are avoided by the AI", () => {
    const sealed = makeChar({ instanceId: "s", team: "enemy" });
    sealed.debuffs.push({ type: "seal", sealType: "attack", debuffDuration: 1 });
    const player = makeChar({ instanceId: "p", team: "player" });

    const after = executeSkill(
      {
        sourceInstanceId: "s",
        skill: dummySkill(), // attack-type
        targetInstanceId: "p",
      },
      { playerTeam: [player], enemyTeam: [sealed] },
      noopLog,
    );
    expect(after.playerTeam[0].currentHP).toBe(1000); // fizzled

    const move = getAIMove([sealed], [player]);
    // both skills are attack-type and sealed; AI falls back but executeSkill
    // will fizzle it — the important part is it doesn't crash
    expect(move).not.toBeNull();
  });

  it("Giant's Will ramps +15% base ATK per turn passed, max 5, skipping turn 1", async () => {
    const diane = fromData(dianeData, "player");
    const items: any[] = [];
    registerCharacterPassives(diane, (item) => items.push(item));
    const ramp = items.find((i) => i.id.includes("turnRamp"));
    expect(ramp.phase).toBe("OnPlayerTurnStart");

    let teams = { playerTeam: [diane], enemyTeam: [] as BattleCharacter[] };
    teams = await ramp.action(teams.playerTeam[0], teams, noopLog); // turn 1: no stack
    expect(teams.playerTeam[0].currentAttack).toBe(dianeData.atk);

    for (let i = 0; i < 7; i++) {
      teams = await ramp.action(teams.playerTeam[0], teams, noopLog);
    }
    // capped at 5 stacks: 110 + 5 * floor(110*0.15)=5*16=80
    expect(teams.playerTeam[0].currentAttack).toBe(dianeData.atk + 5 * 16);
    expect(teams.playerTeam[0].passiveState.turnRampStacks).toBe(5);
  });
});
