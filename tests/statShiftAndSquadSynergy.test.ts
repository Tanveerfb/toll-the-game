/**
 * Fixture-based mechanic tests: buff-before-hit, gainUltGauge, the
 * stat shift after N attacks, permanent ult raises, rank-gated stun,
 * the ranked ally buff, Bleed, and the characterSynergy bond.
 *
 * These were the HxH kit tests. The HxH kits left the game on
 * 2026-10-13 (ruling #187, his call); the engine mechanics they carried
 * stayed, so the same numbers now ride on the neutral fixtures in
 * `tests/fixtures/characters/` (Rookie, Prodigy, Medic). Nothing here
 * pins a kit's identity, only what the mechanics do.
 */
import { describe, expect, it } from "vitest";
import { getEffectiveAttack, getEffectiveDefense } from "@/lib/game/stats";
import { executeSkill } from "@/lib/game/combat";
import { registerCharacterPassives } from "@/lib/game/passive";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import rookieData from "@/tests/fixtures/characters/fx_rookie.json";
import prodigyData from "@/tests/fixtures/characters/fx_prodigy.json";
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

describe("Rookie (fx_rookie)", () => {
  it("Wind-Up Punch buffs ATK BEFORE the hit — the same strike is boosted", () => {
    const rookie = fromData(rookieData, "player");
    const target = makeChar({ instanceId: "t", team: "enemy", color: "green" });
    const after = executeSkill(
      {
        sourceInstanceId: "fx_rookie",
        skill: rookieData.skills[0] as any,
        targetInstanceId: "t",
        rank: 1,
      },
      { playerTeam: [rookie], enemyTeam: [target] },
      noopLog,
    );
    // Wind-Up Punch greatly raises ATK (+50%) before an R1 195% hit
    const boosted = Math.floor(rookieData.atk * 1.5);
    const expected = Math.floor((boosted * 195) / 100);
    expect(after.enemyTeam[0].currentHP).toBe(1000 - expected);
    // the buff itself: 1 turn, uncancellable, stackable
    const buff = after.playerTeam[0].buffs.find((b) => b.stat === "atk");
    expect(buff?.buffDuration).toBe(1);
    expect(buff?.uncancellable).toBe(true);
  });

  it("Second Wind fills own ultimate gauge by rank (1/1/2)", () => {
    const rookie = fromData(rookieData, "player");
    const target = makeChar({ instanceId: "t", team: "enemy", color: "green" });
    let teams = executeSkill(
      {
        sourceInstanceId: "fx_rookie",
        skill: rookieData.skills[1] as any,
        targetInstanceId: "t",
        rank: 1,
      },
      { playerTeam: [rookie], enemyTeam: [target] },
      noopLog,
    );
    expect(teams.playerTeam[0].ultGauge).toBe(1);
    teams = executeSkill(
      {
        sourceInstanceId: "fx_rookie",
        skill: rookieData.skills[1] as any,
        targetInstanceId: "t",
        rank: 3,
      },
      teams,
      noopLog,
    );
    expect(teams.playerTeam[0].ultGauge).toBe(3);
  });

  it("ultimate ATK raise is permanent (no duration) and stacks; DEF raise lasts 1 turn", () => {
    const rookie = fromData(rookieData, "player");
    const target = makeChar({ instanceId: "t", team: "enemy", color: "green" });
    let teams = { playerTeam: [rookie], enemyTeam: [target] };
    for (let i = 0; i < 2; i++) {
      teams = executeSkill(
        {
          sourceInstanceId: "fx_rookie",
          skill: rookieData.ultimate as any,
          targetInstanceId: "t",
          rank: 1,
        },
        teams,
        noopLog,
      );
    }
    const atkBuffs = teams.playerTeam[0].buffs.filter((b) => b.stat === "atk");
    expect(atkBuffs).toHaveLength(2); // stackable
    expect(atkBuffs.every((b) => b.buffDuration === undefined)).toBe(true);
    const defBuff = teams.playerTeam[0].buffs.find((b) => b.stat === "def");
    expect(defBuff?.buffDuration).toBe(1);
  });

  it("Late Bloomer: 10th attack received flips -50% ATK / +100% DEF exactly once", () => {
    let rookie = fromData(rookieData, "player");
    const attacker = makeChar({
      instanceId: "att",
      team: "enemy",
      color: "green",
      atk: 10,
      currentAttack: 10,
    });
    for (let i = 0; i < 11; i++) {
      const teams = executeSkill(
        {
          sourceInstanceId: "att",
          skill: dummySkill(),
          targetInstanceId: "fx_rookie",
        },
        { playerTeam: [rookie], enemyTeam: [attacker] },
        noopLog,
      );
      rookie = teams.playerTeam[0];
    }
    expect(rookie.currentAttack).toBe(
      rookieData.atk - Math.floor(rookieData.atk * 0.5),
    );
    expect(rookie.currentDefense).toBe(
      rookieData.def + Math.floor(rookieData.def * 1.0),
    );
    expect(rookie.passiveState.statShiftTriggered).toBe(true);
    expect(
      rookie.buffs.filter((b) => b.name === "Late Bloomer"),
    ).toHaveLength(1); // once per battle
  });
});

describe("Prodigy (fx_prodigy)", () => {
  it("Static Palm cancels stances and stuns only at rank 2+ (0/1/2 turns)", () => {
    const prodigy = fromData(prodigyData, "player");
    const makeTarget = () => {
      const t = makeChar({ instanceId: "t", team: "enemy", color: "blue" });
      t.buffs.push({ type: "stance", counterDamagePercent: 100 });
      return t;
    };
    const cast = (rank: 1 | 2 | 3) =>
      executeSkill(
        {
          sourceInstanceId: "fx_prodigy",
          skill: prodigyData.skills[0] as any,
          targetInstanceId: "t",
          rank,
        },
        { playerTeam: [prodigy], enemyTeam: [makeTarget()] },
        noopLog,
      ).enemyTeam[0];

    const r1 = cast(1);
    expect(r1.buffs.some((b) => b.type === "stance")).toBe(false);
    expect(r1.debuffs.some((d) => d.type === "stun")).toBe(false);

    const r2 = cast(2);
    expect(r2.debuffs.find((d) => d.type === "stun")?.debuffDuration).toBe(1);

    const r3 = cast(3);
    expect(r3.debuffs.find((d) => d.type === "stun")?.debuffDuration).toBe(2);
  });

  it("Overclock grants permanent stackable ATK and DEF raises", () => {
    const prodigy = fromData(prodigyData, "player");
    const target = makeChar({ instanceId: "t", team: "enemy", color: "blue" });
    const teams = executeSkill(
      {
        sourceInstanceId: "fx_prodigy",
        skill: prodigyData.ultimate as any,
        targetInstanceId: "t",
        rank: 1,
      },
      { playerTeam: [prodigy], enemyTeam: [target] },
      noopLog,
    );
    const buffs = teams.playerTeam[0].buffs;
    // "Permanently raises ATK and DEF" is ONE effect covering two stats, not
    // two effects (Tanveer, 2026-08-09). It used to be authored as a pair.
    const permanent = buffs.filter((b) => b.buffDuration === undefined);
    expect(permanent).toHaveLength(1);
    expect(permanent[0].stats).toEqual(["atk", "def"]);
    expect(buffs.every((b) => b.uncancellable)).toBe(true);

    // ...and the single entry still has to move both stats.
    const prodigyAfter = teams.playerTeam[0];
    expect(getEffectiveAttack(prodigyAfter)).toBeGreaterThan(
      prodigyAfter.currentAttack,
    );
    expect(getEffectiveDefense(prodigyAfter)).toBeGreaterThan(
      prodigyAfter.currentDefense,
    );
  });
});

describe("Medic (fx_medic)", () => {
  it("Field Orders buffs one ally at rank 1, all allies at rank 3", () => {
    const medic = fromData(medicData, "player");
    const ally1 = makeChar({ instanceId: "a1", team: "player" });
    const ally2 = makeChar({ instanceId: "a2", team: "player" });
    const enemy = makeChar({ instanceId: "e", team: "enemy" });

    const r1 = executeSkill(
      {
        sourceInstanceId: "fx_medic",
        skill: medicData.skills[0] as any,
        targetInstanceId: "a1",
        rank: 1,
      },
      { playerTeam: [medic, ally1, ally2], enemyTeam: [enemy] },
      noopLog,
    );
    const buffed = r1.playerTeam.find((c) => c.instanceId === "a1")!;
    const notBuffed = r1.playerTeam.find((c) => c.instanceId === "a2")!;
    // "increases ATK and DEF" is ONE entry covering both stats, not a pair
    // (Tanveer, 2026-08-09).
    const orderBuffs = buffed.buffs.filter((b) => b.type === "buff");
    expect(orderBuffs).toHaveLength(1);
    expect(orderBuffs[0].stats).toEqual(["atk", "def"]);
    expect(orderBuffs[0].valuePercent).toBe(20);
    expect(orderBuffs[0].buffDuration).toBe(1);
    expect(notBuffed.buffs).toHaveLength(0);

    const r3 = executeSkill(
      {
        sourceInstanceId: "fx_medic",
        skill: medicData.skills[0] as any,
        targetInstanceId: "a1",
        rank: 3,
      },
      { playerTeam: [medic, ally1, ally2], enemyTeam: [enemy] },
      noopLog,
    );
    for (const c of r3.playerTeam) {
      // Found by the combined `stats`, not by `stat === "atk"` — one entry
      // covers both stats now.
      const buff = c.buffs.find((b) => b.stats?.includes("atk"));
      expect(buff?.stats).toEqual(["atk", "def"]);
      expect(buff?.valuePercent).toBe(50);
      expect(buff?.buffDuration).toBe(2);
      // ...and the single entry has to actually move a stat. The dummy allies
      // are built with def 0, where a percentage buff is unprovable, so assert
      // on ATK for everyone and DEF on the Medic, who has a real one.
      expect(getEffectiveAttack(c)).toBeGreaterThan(c.currentAttack);
      if (c.currentDefense > 0) {
        expect(getEffectiveDefense(c)).toBeGreaterThan(c.currentDefense);
      }
    }
  });

  it("Scalpel Rush applies Bleed worth 90% of the hit as an independent DoT", () => {
    const medic = fromData(medicData, "player");
    const target = makeChar({ instanceId: "t", team: "enemy", color: "red" });
    const teams = executeSkill(
      {
        sourceInstanceId: "fx_medic",
        skill: medicData.skills[1] as any,
        targetInstanceId: "t",
        rank: 3,
      },
      { playerTeam: [medic], enemyTeam: [target] },
      noopLog,
    );
    const dealt = 1000 - teams.enemyTeam[0].currentHP;
    const bleed = teams.enemyTeam[0].debuffs.find((d) => d.name === "Bleed");
    expect(bleed?.value).toBe(Math.floor(dealt * 0.9));
    expect(bleed?.debuffDuration).toBe(2); // rank 3
  });

  it("Long Reach cancels buffs and stances, then stuns for 2 turns", () => {
    const medic = fromData(medicData, "player");
    const target = makeChar({ instanceId: "t", team: "enemy", color: "red" });
    target.buffs.push(
      { type: "buff", stat: "atk", valuePercent: 30 },
      { type: "stance", counterDamagePercent: 100 },
    );
    const teams = executeSkill(
      {
        sourceInstanceId: "fx_medic",
        skill: medicData.ultimate as any,
        targetInstanceId: "t",
        rank: 1,
      },
      { playerTeam: [medic], enemyTeam: [target] },
      noopLog,
    );
    expect(teams.enemyTeam[0].buffs).toHaveLength(0);
    expect(
      teams.enemyTeam[0].debuffs.find((d) => d.type === "stun")
        ?.debuffDuration,
    ).toBe(2);
  });

  it("Sworn Companions: base +10% is static, extra +10% drops when one dies", async () => {
    const medic = fromData(medicData, "player");
    const rookie = fromData(rookieData, "player");
    const prodigy = fromData(prodigyData, "player");
    const items: any[] = [];
    registerCharacterPassives(medic, (item) => items.push(item));

    const base = items.find((i) => i.mechanicId?.includes("(base)"));
    const extras = items.filter((i) => i.mechanicId?.includes("(extra)"));
    expect(base).toBeDefined();
    expect(extras.length).toBeGreaterThan(0);

    let teams = {
      playerTeam: [medic, rookie, prodigy],
      enemyTeam: [] as BattleCharacter[],
    };
    teams = await base.action(teams.playerTeam[0], teams, noopLog);
    const afterBase = teams.playerTeam[0];
    expect(afterBase.currentAttack).toBe(
      medicData.atk + Math.floor(medicData.atk * 0.1),
    );

    // both alive on field -> extra kicks in
    teams = await extras[0].action(teams.playerTeam[0], teams, noopLog);
    const afterExtra = teams.playerTeam[0];
    const withExtra =
      afterBase.currentAttack + Math.floor(medicData.atk * 0.1);
    expect(afterExtra.currentAttack).toBe(withExtra);

    // Rookie dies -> next recheck removes ONLY the extra bonus
    teams.playerTeam = teams.playerTeam.map((c) =>
      c.instanceId === "fx_rookie" ? { ...c, currentHP: 0 } : c,
    );
    teams = await extras[0].action(teams.playerTeam[0], teams, noopLog);
    expect(teams.playerTeam[0].currentAttack).toBe(afterBase.currentAttack);
    expect(
      teams.playerTeam[0].buffs.some(
        (b) => b.name === "Sworn Companions (bond)",
      ),
    ).toBe(true); // base survives the death
  });

  it("base bonus survives the Squad synergy badge sharing the passive's name (regression)", async () => {
    // In-game the passive's own [Squad] synergy runs first and pushes buffs
    // named "Sworn Companions" — the bond bonus must not mistake that
    // badge for itself and skip.
    const medic = fromData(medicData, "player");
    const rookie = fromData(rookieData, "player");
    const items: any[] = [];
    registerCharacterPassives(medic, (item) => items.push(item));
    const main = items.find(
      (i) => i.id === "fx_medic_passive_Sworn Companions",
    );
    const base = items.find((i) => i.mechanicId?.includes("(base)"));

    let teams = {
      playerTeam: [medic, rookie],
      enemyTeam: [] as BattleCharacter[],
    };
    teams = await main.action(teams.playerTeam[0], teams, noopLog);
    const afterSynergy = teams.playerTeam[0].currentAttack;
    teams = await base.action(teams.playerTeam[0], teams, noopLog);
    expect(teams.playerTeam[0].currentAttack).toBe(
      afterSynergy + Math.floor(medicData.atk * 0.1),
    );
  });

  it("Sworn Companions base does NOT apply without Rookie or Prodigy on the team", async () => {
    const medic = fromData(medicData, "player");
    const stranger = makeChar({ instanceId: "x", team: "player" });
    const items: any[] = [];
    registerCharacterPassives(medic, (item) => items.push(item));
    const base = items.find((i) => i.mechanicId?.includes("(base)"));

    let teams = {
      playerTeam: [medic, stranger],
      enemyTeam: [] as BattleCharacter[],
    };
    teams = await base.action(teams.playerTeam[0], teams, noopLog);
    expect(teams.playerTeam[0].currentAttack).toBe(medicData.atk);
  });
});
