import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import { registerCharacterPassives } from "@/lib/game/passive";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import gonData from "@/data/characters/gon.json";
import killuaData from "@/data/characters/killua.json";
import leorioData from "@/data/characters/leorio.json";

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

describe("Gon", () => {
  it("Jajanken: Rock buffs ATK BEFORE the hit — the same strike is boosted", () => {
    const gon = fromData(gonData, "player");
    const target = makeChar({ instanceId: "t", team: "enemy", color: "green" });
    const after = executeSkill(
      {
        sourceInstanceId: "gon",
        skill: gonData.skills[0] as any,
        targetInstanceId: "t",
        rank: 1,
      },
      { playerTeam: [gon], enemyTeam: [target] },
      noopLog,
    );
    // effective ATK = floor(95 * 1.3) = 123; 123 * 120% = 147.6 -> 147
    const boosted = Math.floor(gonData.atk * 1.3);
    const expected = Math.floor((boosted * 120) / 100);
    expect(after.enemyTeam[0].currentHP).toBe(1000 - expected);
    // the buff itself: 1 turn, uncancellable, stackable
    const buff = after.playerTeam[0].buffs.find((b) => b.stat === "atk");
    expect(buff?.buffDuration).toBe(1);
    expect(buff?.uncancellable).toBe(true);
  });

  it("Jajanken: Round 2 fills own ultimate gauge by rank (1/1/2)", () => {
    const gon = fromData(gonData, "player");
    const target = makeChar({ instanceId: "t", team: "enemy", color: "green" });
    let teams = executeSkill(
      {
        sourceInstanceId: "gon",
        skill: gonData.skills[1] as any,
        targetInstanceId: "t",
        rank: 1,
      },
      { playerTeam: [gon], enemyTeam: [target] },
      noopLog,
    );
    expect(teams.playerTeam[0].ultGauge).toBe(1);
    teams = executeSkill(
      {
        sourceInstanceId: "gon",
        skill: gonData.skills[1] as any,
        targetInstanceId: "t",
        rank: 3,
      },
      teams,
      noopLog,
    );
    expect(teams.playerTeam[0].ultGauge).toBe(3);
  });

  it("ultimate ATK raise is permanent (no duration) and stacks; DEF raise lasts 1 turn", () => {
    const gon = fromData(gonData, "player");
    const target = makeChar({ instanceId: "t", team: "enemy", color: "green" });
    let teams = { playerTeam: [gon], enemyTeam: [target] };
    for (let i = 0; i < 2; i++) {
      teams = executeSkill(
        {
          sourceInstanceId: "gon",
          skill: gonData.ultimate as any,
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

  it("Rookie Hunter: 10th attack received flips -50% ATK / +50% DEF exactly once", () => {
    let gon = fromData(gonData, "player");
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
          targetInstanceId: "gon",
        },
        { playerTeam: [gon], enemyTeam: [attacker] },
        noopLog,
      );
      gon = teams.playerTeam[0];
    }
    expect(gon.currentAttack).toBe(
      gonData.atk - Math.floor(gonData.atk * 0.5),
    );
    expect(gon.currentDefense).toBe(
      gonData.def + Math.floor(gonData.def * 0.5),
    );
    expect(gon.passiveState.statShiftTriggered).toBe(true);
    expect(
      gon.buffs.filter((b) => b.name === "Rookie Hunter"),
    ).toHaveLength(1); // once per battle
  });
});

describe("Killua", () => {
  it("Lightning Palm cancels stances and stuns only at rank 2+ (0/1/2 turns)", () => {
    const killua = fromData(killuaData, "player");
    const makeTarget = () => {
      const t = makeChar({ instanceId: "t", team: "enemy", color: "blue" });
      t.buffs.push({ type: "stance", counterDamagePercent: 100 });
      return t;
    };
    const cast = (rank: 1 | 2 | 3) =>
      executeSkill(
        {
          sourceInstanceId: "killua",
          skill: killuaData.skills[0] as any,
          targetInstanceId: "t",
          rank,
        },
        { playerTeam: [killua], enemyTeam: [makeTarget()] },
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

  it("Speed of Lightning grants permanent stackable ATK and DEF raises", () => {
    const killua = fromData(killuaData, "player");
    const target = makeChar({ instanceId: "t", team: "enemy", color: "blue" });
    const teams = executeSkill(
      {
        sourceInstanceId: "killua",
        skill: killuaData.ultimate as any,
        targetInstanceId: "t",
        rank: 1,
      },
      { playerTeam: [killua], enemyTeam: [target] },
      noopLog,
    );
    const buffs = teams.playerTeam[0].buffs;
    expect(buffs.filter((b) => b.buffDuration === undefined)).toHaveLength(2);
    expect(buffs.every((b) => b.uncancellable)).toBe(true);
  });
});

describe("Leorio", () => {
  it("Member of the Zodiac buffs one ally at rank 1, all allies at rank 3", () => {
    const leorio = fromData(leorioData, "player");
    const ally1 = makeChar({ instanceId: "a1", team: "player" });
    const ally2 = makeChar({ instanceId: "a2", team: "player" });
    const enemy = makeChar({ instanceId: "e", team: "enemy" });

    const r1 = executeSkill(
      {
        sourceInstanceId: "leorio",
        skill: leorioData.skills[0] as any,
        targetInstanceId: "a1",
        rank: 1,
      },
      { playerTeam: [leorio, ally1, ally2], enemyTeam: [enemy] },
      noopLog,
    );
    const buffed = r1.playerTeam.find((c) => c.instanceId === "a1")!;
    const notBuffed = r1.playerTeam.find((c) => c.instanceId === "a2")!;
    expect(buffed.buffs.filter((b) => b.type === "buff")).toHaveLength(2);
    expect(buffed.buffs[0].valuePercent).toBe(15);
    expect(buffed.buffs[0].buffDuration).toBe(1);
    expect(notBuffed.buffs).toHaveLength(0);

    const r3 = executeSkill(
      {
        sourceInstanceId: "leorio",
        skill: leorioData.skills[0] as any,
        targetInstanceId: "a1",
        rank: 3,
      },
      { playerTeam: [leorio, ally1, ally2], enemyTeam: [enemy] },
      noopLog,
    );
    for (const c of r3.playerTeam) {
      const atkBuff = c.buffs.find((b) => b.stat === "atk");
      expect(atkBuff?.valuePercent).toBe(40);
      expect(atkBuff?.buffDuration).toBe(2);
    }
  });

  it("Switchblade Attack applies Bleed worth 90% of the hit as an independent DoT", () => {
    const leorio = fromData(leorioData, "player");
    const target = makeChar({ instanceId: "t", team: "enemy", color: "red" });
    const teams = executeSkill(
      {
        sourceInstanceId: "leorio",
        skill: leorioData.skills[1] as any,
        targetInstanceId: "t",
        rank: 3,
      },
      { playerTeam: [leorio], enemyTeam: [target] },
      noopLog,
    );
    const dealt = 1000 - teams.enemyTeam[0].currentHP;
    const bleed = teams.enemyTeam[0].debuffs.find((d) => d.name === "Bleed");
    expect(bleed?.value).toBe(Math.floor(dealt * 0.9));
    expect(bleed?.debuffDuration).toBe(2); // rank 3
  });

  it("Remote Punch cancels buffs and stances, then stuns for 2 turns", () => {
    const leorio = fromData(leorioData, "player");
    const target = makeChar({ instanceId: "t", team: "enemy", color: "red" });
    target.buffs.push(
      { type: "buff", stat: "atk", valuePercent: 30 },
      { type: "stance", counterDamagePercent: 100 },
    );
    const teams = executeSkill(
      {
        sourceInstanceId: "leorio",
        skill: leorioData.ultimate as any,
        targetInstanceId: "t",
        rank: 1,
      },
      { playerTeam: [leorio], enemyTeam: [target] },
      noopLog,
    );
    expect(teams.enemyTeam[0].buffs).toHaveLength(0);
    expect(
      teams.enemyTeam[0].debuffs.find((d) => d.type === "stun")
        ?.debuffDuration,
    ).toBe(2);
  });

  it("Kind Hearted Friend: base +10% is static, extra +10% drops when one dies", async () => {
    const leorio = fromData(leorioData, "player");
    const gon = fromData(gonData, "player");
    const killua = fromData(killuaData, "player");
    const items: any[] = [];
    registerCharacterPassives(leorio, (item) => items.push(item));

    const base = items.find((i) => i.mechanicId?.includes("(base)"));
    const extras = items.filter((i) => i.mechanicId?.includes("(extra)"));
    expect(base).toBeDefined();
    expect(extras.length).toBeGreaterThan(0);

    let teams = {
      playerTeam: [leorio, gon, killua],
      enemyTeam: [] as BattleCharacter[],
    };
    teams = await base.action(teams.playerTeam[0], teams, noopLog);
    const afterBase = teams.playerTeam[0];
    expect(afterBase.currentAttack).toBe(
      leorioData.atk + Math.floor(leorioData.atk * 0.1),
    );

    // both alive on field -> extra kicks in
    teams = await extras[0].action(teams.playerTeam[0], teams, noopLog);
    const afterExtra = teams.playerTeam[0];
    const withExtra =
      afterBase.currentAttack + Math.floor(leorioData.atk * 0.1);
    expect(afterExtra.currentAttack).toBe(withExtra);

    // Gon dies -> next recheck removes ONLY the extra bonus
    teams.playerTeam = teams.playerTeam.map((c) =>
      c.instanceId === "gon" ? { ...c, currentHP: 0 } : c,
    );
    teams = await extras[0].action(teams.playerTeam[0], teams, noopLog);
    expect(teams.playerTeam[0].currentAttack).toBe(afterBase.currentAttack);
    expect(
      teams.playerTeam[0].buffs.some(
        (b) => b.name === "Kind Hearted Friend (bond)",
      ),
    ).toBe(true); // base survives the death
  });

  it("base bonus survives the Collab synergy badge sharing the passive's name (regression)", async () => {
    // In-game the passive's own [Collab] synergy runs first and pushes buffs
    // named "Kind Hearted Friend" — the bond bonus must not mistake that
    // badge for itself and skip.
    const leorio = fromData(leorioData, "player");
    const gon = fromData(gonData, "player");
    const items: any[] = [];
    registerCharacterPassives(leorio, (item) => items.push(item));
    const main = items.find(
      (i) => i.id === "leorio_passive_Kind Hearted Friend",
    );
    const base = items.find((i) => i.mechanicId?.includes("(base)"));

    let teams = {
      playerTeam: [leorio, gon],
      enemyTeam: [] as BattleCharacter[],
    };
    teams = await main.action(teams.playerTeam[0], teams, noopLog);
    const afterSynergy = teams.playerTeam[0].currentAttack;
    teams = await base.action(teams.playerTeam[0], teams, noopLog);
    expect(teams.playerTeam[0].currentAttack).toBe(
      afterSynergy + Math.floor(leorioData.atk * 0.1),
    );
  });

  it("Kind Hearted Friend base does NOT apply without Gon or Killua on the team", async () => {
    const leorio = fromData(leorioData, "player");
    const stranger = makeChar({ instanceId: "x", team: "player" });
    const items: any[] = [];
    registerCharacterPassives(leorio, (item) => items.push(item));
    const base = items.find((i) => i.mechanicId?.includes("(base)"));

    let teams = {
      playerTeam: [leorio, stranger],
      enemyTeam: [] as BattleCharacter[],
    };
    teams = await base.action(teams.playerTeam[0], teams, noopLog);
    expect(teams.playerTeam[0].currentAttack).toBe(leorioData.atk);
  });
});
