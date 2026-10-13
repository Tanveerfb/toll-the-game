/**
 * Fixture-based mechanic tests: Deathblow, counter stance, Lifesteal,
 * Extort, max-HP shred, Rupture, Attack Seal, turn ramp and sub-passive
 * gating.
 *
 * These were written against the 7DS collab kits, which left the game on
 * 2026-10-13 (ruling #187). The mechanics stayed, so the tests now run on
 * the neutral fixtures in tests/fixtures/characters/ — the same numbers
 * and mechanics under new names (see that folder's README).
 */
import { describe, expect, it } from "vitest";
import { executeSkill, getCritChance } from "@/lib/game/combat";
import { calculateDamage } from "@/lib/game/damage";
import { getEffectiveAttack, getEffectiveDefense } from "@/lib/game/stats";
import { getAIMove } from "@/lib/game/ai";
import { registerCharacterPassives } from "@/lib/game/passive";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import type { BattleActionEvent } from "@/types/battleEvent";
import reaverData from "@/tests/fixtures/characters/fx_reaver.json";
import thiefData from "@/tests/fixtures/characters/fx_thief.json";
import colossusData from "@/tests/fixtures/characters/fx_colossus.json";
import medicData from "@/tests/fixtures/characters/fx_medic.json";

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

  it("stacked ATK-up buffs compound multiplicatively (ruling 2026-07-12)", () => {
    const char = makeChar({ instanceId: "b", team: "player" });
    // +10%, +10% -> ×1.1·1.1 = ×1.21 -> floor(100·1.21)=121
    char.buffs.push({ type: "buff", stat: "atk", valuePercent: 10 });
    char.buffs.push({ type: "buff", stat: "atk", valuePercent: 10 });
    expect(getEffectiveAttack(char)).toBe(121);
  });

  it("stacked ATK-down debuffs multiply, never reaching 0 (ruling 2026-07-12)", () => {
    const attacker = makeChar({ instanceId: "a", team: "player" });
    // -25%, -50%, -25% -> ×0.75·0.50·0.75 = ×0.28125 -> floor(100·0.28125)=28
    attacker.debuffs.push({ type: "debuff", stat: "atk", valuePercent: 25 });
    attacker.debuffs.push({ type: "debuff", stat: "atk", valuePercent: 50 });
    attacker.debuffs.push({ type: "debuff", stat: "atk", valuePercent: 25 });
    expect(getEffectiveAttack(attacker)).toBe(28);
  });

  it("an 'all' debuff multiplies alongside a stat-specific one", () => {
    const char = makeChar({
      instanceId: "c",
      team: "player",
      currentDefense: 100,
    });
    // -50% def and -20% all -> ×0.5·0.8 = ×0.4 -> floor(100·0.4)=40
    char.debuffs.push({ type: "debuff", stat: "def", valuePercent: 50 });
    char.debuffs.push({ type: "debuff", stat: "all", valuePercent: 20 });
    expect(getEffectiveDefense(char)).toBe(40);
  });

  it("a single ≥100% debuff still floors the stat to 0", () => {
    const char = makeChar({ instanceId: "c", team: "player" });
    char.debuffs.push({ type: "debuff", stat: "atk", valuePercent: 100 });
    expect(getEffectiveAttack(char)).toBe(0);
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

describe("Reaver fixture — Deathblow + Mirror Stance", () => {
  it("crit chance rises 2% per 3% HP lost, from a 0 base", () => {
    const reaver = fromData(reaverData, "player");
    expect(getCritChance(reaver)).toBe(0);
    reaver.currentHP = Math.floor(reaver.hp * 0.7); // 30% lost -> 10 steps -> 20%
    expect(getCritChance(reaver)).toBe(20);
  });

  it("deathblow is inactive from the sub position", () => {
    const reaver = fromData(reaverData, "player");
    reaver.isSub = true;
    reaver.currentHP = Math.floor(reaver.hp * 0.5);
    expect(getCritChance(reaver)).toBe(0);
  });

  it("a crit applies the CRITICAL package", () => {
    const reaver = fromData(reaverData, "player");
    reaver.currentHP = 1; // ~100% lost -> guaranteed crit territory
    const target = makeChar({
      instanceId: "t",
      team: "enemy",
      currentDefense: 100,
      hp: 100000,
      currentHP: 100000,
    });
    const result = executeSkill(
      {
        sourceInstanceId: "fx_reaver",
        skill: reaverData.skills[0] as any,
        targetInstanceId: "t",
      },
      { playerTeam: [reaver], enemyTeam: [target] },
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

  it("Mirror Stance counters a survivor's attacker; lethal hit is not countered", () => {
    const reaver = fromData(reaverData, "player");
    // Put up the stance (rank 3: 400%, 2 turns)
    let teams = executeSkill(
      {
        sourceInstanceId: "fx_reaver",
        skill: reaverData.skills[1] as any,
        targetInstanceId: "fx_reaver",
        rank: 3,
      },
      { playerTeam: [reaver], enemyTeam: [makeChar({ instanceId: "e", team: "enemy" })] },
      noopLog,
    );
    const stance = teams.playerTeam[0].buffs.find(
      (b) => b.counterDamagePercent,
    );
    expect(stance?.counterDamagePercent).toBe(400);
    expect(stance?.buffDuration).toBe(2);

    // Enemy attacks the Reaver -> takes 400% of his effective ATK back
    const events: BattleActionEvent[] = [];
    teams = executeSkill(
      {
        sourceInstanceId: "e",
        skill: dummySkill(),
        targetInstanceId: "fx_reaver",
      },
      teams,
      noopLog,
      0,
      undefined,
      (e) => events.push(e),
    );
    const enemy = teams.enemyTeam[0];
    const reaverAfter = teams.playerTeam[0];
    // The event stream snapshots the target's hp immediately after the
    // incoming hit resolves — BEFORE the counter (and its lifesteal
    // overheal) fires — so this is the one place that still proves the
    // enemy's attack actually dealt damage, independent of where the Reaver
    // ends up after he counters and heals back off it.
    const reaverHitEvent = events[0].targets.find(
      (t) => t.instanceId === "fx_reaver",
    );
    expect(reaverHitEvent?.damage).toBeGreaterThan(0); // he really took the hit
    expect(reaverHitEvent?.hpAfter).toBeLessThan(reaver.hp);
    // Lifesteal substat (Task 6): the Reaver's counter deals a massive 400%-ATK
    // hit back, and his own base lifestealPercent (default 5%) heals him for
    // 5% of THAT counter damage — comfortably more than the modest hit he
    // took from the enemy's plain attack, so he lands back at full (clamped)
    // HP instead of staying strictly below max.
    expect(reaverAfter.currentHP).toBe(reaverAfter.hp); // took the hit, then fully lifestole back via the counter
    expect(enemy.currentHP).toBeLessThan(1000); // counter landed

    // Lethal hit: no counter
    const glassCannon = fromData(reaverData, "player", "reaver2");
    glassCannon.currentHP = 1;
    glassCannon.buffs.push({
      type: "stance",
      counterDamagePercent: 400,
      name: "Mirror Stance",
    });
    const killer = makeChar({ instanceId: "killer", team: "enemy" });
    const after = executeSkill(
      {
        sourceInstanceId: "killer",
        skill: dummySkill(),
        targetInstanceId: "reaver2",
      },
      { playerTeam: [glassCannon], enemyTeam: [killer] },
      noopLog,
    );
    expect(after.playerTeam[0].currentHP).toBe(0);
    expect(after.enemyTeam[0].currentHP).toBe(1000); // no counter from the dead
  });

  it("Black Flare cancels the stance BEFORE damage — no counter", () => {
    const counterer = makeChar({ instanceId: "c", team: "enemy" });
    counterer.buffs.push({
      type: "stance",
      counterDamagePercent: 400,
      name: "Mirror Stance",
    });
    const reaver = fromData(reaverData, "player");
    const after = executeSkill(
      {
        sourceInstanceId: "fx_reaver",
        skill: reaverData.ultimate as any,
        targetInstanceId: "c",
      },
      { playerTeam: [reaver], enemyTeam: [counterer] },
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

describe("Thief fixture — Lifesteal, Extort, Bleed Them Dry", () => {
  it("Leech Sweep heals 30% of damage dealt", () => {
    const thief = fromData(thiefData, "player");
    thief.currentHP = 500;
    const target = makeChar({ instanceId: "t", team: "enemy", color: "green" });
    const after = executeSkill(
      {
        sourceInstanceId: "fx_thief",
        skill: thiefData.skills[0] as any,
        targetInstanceId: "t",
        rank: 3,
      },
      { playerTeam: [thief], enemyTeam: [target] },
      noopLog,
    );
    // ATK * 400% dealt vs 0 DEF -> 30% healed (data-driven so rebalances don't break this)
    const dealt =
      thiefData.atk * ((thiefData.skills[0].damageRanked[2] as number) / 100);
    expect(after.enemyTeam[0].currentHP).toBe(1000 - dealt);
    // Lifesteal substat (Task 6): on top of Leech Sweep's own skill-level 30%
    // lifesteal mechanic, the Thief also gets its base lifestealPercent substat
    // (undefined on fx_thief.json -> defaults to 5%) applied additively.
    expect(after.playerTeam[0].currentHP).toBe(
      500 + Math.floor(dealt * 0.3) + Math.floor(dealt * 0.05),
    );
  });

  it("Grand Larceny extorts per-stat and refreshes instead of stacking", () => {
    const thief = fromData(thiefData, "player");
    const e1 = makeChar({
      instanceId: "e1",
      team: "enemy",
      color: "green",
      currentAttack: 100,
      currentDefense: 50,
    });
    let teams = executeSkill(
      {
        sourceInstanceId: "fx_thief",
        skill: thiefData.skills[1] as any,
        targetInstanceId: "e1",
        rank: 3, // 50%, 2 turns
      },
      { playerTeam: [thief], enemyTeam: [e1] },
      noopLog,
    );
    const thiefAfter = teams.playerTeam[0];
    const enemyAfter = teams.enemyTeam[0];
    // enemy: -50% ATK/DEF entries; Thief: +50 ATK, +25 DEF flat
    expect(getEffectiveAttack(enemyAfter)).toBe(50);
    expect(getEffectiveDefense(enemyAfter)).toBe(25);
    expect(getEffectiveAttack(thiefAfter)).toBe(thiefData.atk + 50);
    expect(getEffectiveDefense(thiefAfter)).toBe(thiefData.def + 25);

    // recast: still exactly one Extort buff pair on the Thief
    teams = executeSkill(
      {
        sourceInstanceId: "fx_thief",
        skill: thiefData.skills[1] as any,
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

  it("Bleed Them Dry shreds enemy max HP on untouched rounds and fully reverts on damage", async () => {
    const thief = fromData(thiefData, "player");
    const enemy = makeChar({ instanceId: "e", team: "enemy" });

    const items: any[] = [];
    registerCharacterPassives(thief, (item) => items.push(item));
    const shred = items.find((i) => i.id.includes("shred"));
    expect(shred.phase).toBe("OnEnemyTurnEnd");

    // Round 1: untouched -> -8%
    let teams = { playerTeam: [thief], enemyTeam: [enemy] };
    teams = await shred.action(thief, teams, noopLog);
    expect(teams.enemyTeam[0].hp).toBe(920);
    expect(teams.enemyTeam[0].currentHP).toBe(920);

    // Round 2: untouched -> -16% of the ORIGINAL max
    teams = await shred.action(teams.playerTeam[0], teams, noopLog);
    expect(teams.enemyTeam[0].hp).toBe(840);

    // the Thief takes damage -> next check fully restores enemy max HP (no heal)
    teams.playerTeam[0].passiveState.tookDamageThisRound = true;
    teams = await shred.action(teams.playerTeam[0], teams, noopLog);
    expect(teams.enemyTeam[0].hp).toBe(1000);
    expect(teams.enemyTeam[0].currentHP).toBe(840); // clamped value stays
    expect(teams.playerTeam[0].passiveState.maxHpShredStacks).toBe(0);
  });
});

describe("Colossus fixture — Rupture, Attack Seal, Mounting Fury", () => {
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

  it("Boulder Charge seals attack skills at rank 2+, not at rank 1", () => {
    const colossus = fromData(colossusData, "player");
    const target = makeChar({ instanceId: "t", team: "enemy", color: "blue" });

    const r1 = executeSkill(
      {
        sourceInstanceId: "fx_colossus",
        skill: colossusData.skills[1] as any,
        targetInstanceId: "t",
        rank: 1,
      },
      { playerTeam: [colossus], enemyTeam: [target] },
      noopLog,
    );
    expect(r1.enemyTeam[0].debuffs.some((d) => d.type === "seal")).toBe(false);

    const r3 = executeSkill(
      {
        sourceInstanceId: "fx_colossus",
        skill: colossusData.skills[1] as any,
        targetInstanceId: "t",
        rank: 3,
      },
      { playerTeam: [colossus], enemyTeam: [makeChar({ instanceId: "t", team: "enemy", color: "blue" })] },
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

  it("Mounting Fury ramps +10% base ATK per turn passed, max 5, skipping turn 1", async () => {
    const colossus = fromData(colossusData, "player");
    const items: any[] = [];
    registerCharacterPassives(colossus, (item) => items.push(item));
    const ramp = items.find((i) => i.id.includes("turnRamp"));
    expect(ramp.phase).toBe("OnPlayerTurnStart");

    let teams = { playerTeam: [colossus], enemyTeam: [] as BattleCharacter[] };
    teams = await ramp.action(teams.playerTeam[0], teams, noopLog); // turn 1: no stack
    expect(teams.playerTeam[0].currentAttack).toBe(colossusData.atk);

    for (let i = 0; i < 7; i++) {
      teams = await ramp.action(teams.playerTeam[0], teams, noopLog);
    }
    // capped at 5 stacks of floor(base ATK * 10%)
    expect(teams.playerTeam[0].currentAttack).toBe(
      colossusData.atk + 5 * Math.floor(colossusData.atk * 0.1),
    );
    expect(teams.playerTeam[0].passiveState.turnRampStacks).toBe(5);
  });

  it("Mounting Fury does not ramp while the Colossus is benched", async () => {
    const colossus = fromData(colossusData, "player");
    colossus.isSub = true;
    const items: any[] = [];
    registerCharacterPassives(colossus, (item) => items.push(item));
    const ramp = items.find((i) => i.id.includes("turnRamp"));

    let teams = { playerTeam: [colossus], enemyTeam: [] as BattleCharacter[] };
    teams = await ramp.action(teams.playerTeam[0], teams, noopLog);
    teams = await ramp.action(teams.playerTeam[0], teams, noopLog);
    expect(teams.playerTeam[0].currentAttack).toBe(colossusData.atk);
    expect(teams.playerTeam[0].passiveState.turnRampStacks).toBeUndefined();
  });

  it("Mounting Fury synergy (Giant tag buff) does not apply while benched", async () => {
    const colossus = fromData(colossusData, "player");
    colossus.isSub = true;
    const ally = makeChar({
      instanceId: "ally",
      team: "player",
      tags: ["Giant"],
    });
    const items: any[] = [];
    registerCharacterPassives(colossus, (item) => items.push(item));
    const synergy = items.find((i) => i.id.includes("passive_Mounting Fury"));

    const teams = await synergy.action(
      colossus,
      { playerTeam: [colossus, ally], enemyTeam: [] },
      noopLog,
    );
    expect(teams.playerTeam[1].buffs).toHaveLength(0);
  });
});

describe("Sub-passive gating (worksFromSub)", () => {
  it("Bleed Them Dry does not shred while the Thief is benched", async () => {
    const thief = fromData(thiefData, "player");
    thief.isSub = true;
    const enemy = makeChar({ instanceId: "e", team: "enemy" });
    const items: any[] = [];
    registerCharacterPassives(thief, (item) => items.push(item));
    const shred = items.find((i) => i.id.includes("shred"));

    const teams = await shred.action(
      thief,
      { playerTeam: [thief], enemyTeam: [enemy] },
      noopLog,
    );
    expect(teams.enemyTeam[0].hp).toBe(1000);
  });

  it("Sworn Companions' Squad synergy still applies while the Medic is benched (worksFromSub: true)", async () => {
    const medic = fromData(medicData, "player");
    medic.isSub = true;
    const ally = makeChar({
      instanceId: "ally",
      team: "player",
      tags: ["Squad"],
    });
    const items: any[] = [];
    registerCharacterPassives(medic, (item) => items.push(item));
    const synergy = items.find((i) =>
      i.id.includes("passive_Sworn Companions"),
    );

    const teams = await synergy.action(
      medic,
      { playerTeam: [medic, ally], enemyTeam: [] },
      noopLog,
    );
    expect(teams.playerTeam[1].buffs).toHaveLength(1);
  });
});
