import { describe, expect, it } from "vitest";

import { getCharacterById } from "@/lib/game/characterCatalog";
import { executeSkill } from "@/lib/game/combat";
import { strikeBack } from "@/lib/game/counter";
import { calculateDamage } from "@/lib/game/damage";
import {
  countDistinctDebuffs,
  removeRandomDebuffs,
} from "@/lib/game/debuffCount";
import { applyLiveBonuses } from "@/lib/game/liveBonus";
import { createMechanicQueue } from "@/lib/game/mechanicQueue";
import { registerCharacterPassives } from "@/lib/game/passive";
import { getPassiveReadout } from "@/lib/game/passiveStacks";
import {
  getDamageDealtMultiplier,
  getEffectiveAttack,
  getEffectiveDefense,
} from "@/lib/game/stats";
import type { BattleCharacter } from "@/types/character";
import type { StatusEffect } from "@/types/mechanic";

/** Boss Tao's catalog ATK, read rather than restated so a retune moves one file. */
const TAO_ATK = getCharacterById("master_tao_npc")!.atk;

/**
 * The boss Master Tao kit, rule by rule. Every mechanic here is generic and
 * data-driven (`liveBonus`, `sealImmunity`, `counterDamageReduction`,
 * `turnStartCleanse`, `coDestruction`, a repeating `statShiftAfterAttacks`);
 * these pin each rule against the engine rather than against the kit text.
 */

function unit(
  id: string,
  team: "player" | "enemy",
  over: Partial<BattleCharacter> = {},
): BattleCharacter {
  const data = getCharacterById(id) as unknown as Record<string, unknown>;
  return {
    ...(data as object),
    instanceId: `${id}-${team}`,
    currentHP: data.hp as number,
    currentAttack: data.atk as number,
    currentDefense: data.def as number,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team,
    ...over,
  } as BattleCharacter;
}

const weaken = (stat = "atk"): StatusEffect => ({
  type: "debuff",
  stat,
  valuePercent: 10,
  debuffDuration: 3,
  name: `Weaken ${stat}`,
});
const ignite = (stacks = 1): StatusEffect => ({
  type: "ignite",
  stacks,
  debuffDuration: 3,
});

const tao = () => unit("master_tao_npc", "enemy");

describe("counting distinct debuffs", () => {
  it("counts Ignite once at any stack count", () => {
    expect(countDistinctDebuffs({ debuffs: [ignite(1)] })).toBe(1);
    expect(countDistinctDebuffs({ debuffs: [ignite(3)] })).toBe(1);
  });

  it("counts each stat-down entry, and each other kind once", () => {
    expect(
      countDistinctDebuffs({
        debuffs: [
          weaken("atk"),
          weaken("def"),
          ignite(3),
          { type: "stun", debuffDuration: 1 },
          { type: "stun", debuffDuration: 2 },
          { type: "seal", sealType: "attack", debuffDuration: 2 },
          { type: "seal", sealType: "ultimate", debuffDuration: 2 },
        ],
      }),
    ).toBe(6);
  });

  it("does not count uncancellable effects (ruling #30)", () => {
    expect(
      countDistinctDebuffs({
        debuffs: [{ ...weaken(), uncancellable: true }, ignite()],
      }),
    ).toBe(1);
  });
});

describe("Co-Destruction", () => {
  const mech = [{ type: "coDestruction", valuePercentPerDebuff: 40 }] as never;
  const dmg = (debuffs: StatusEffect[], mechanics: never[] = mech) =>
    calculateDamage({
      baseDamage: 1000,
      skillMechanics: mechanics,
      target: unit("duke", "player", { debuffs }),
    });

  it("adds 40% of the effective hit per distinct debuff", () => {
    const clean = dmg([]);
    expect(dmg([weaken("atk")]) / clean).toBeCloseTo(1.4, 5);
    expect(dmg([weaken("atk"), weaken("def")]) / clean).toBeCloseTo(
      1 + 0.8 * 1,
      1,
    );
  });

  it("counts Ignite as one however many stacks (apart from Ignite's own bonus)", () => {
    const one = dmg([ignite(1)]);
    const three = dmg([ignite(3)]);
    // Same Co-Destruction contribution; the difference is Ignite's own
    // +10%-per-stack rule, which applies to every attack and is not ours.
    const plain = (stacks: number) =>
      calculateDamage({
        baseDamage: 1000,
        skillMechanics: [],
        target: unit("duke", "player", { debuffs: [ignite(stacks)] }),
      });
    expect(one - plain(1)).toBeCloseTo(three - plain(3), 3);
  });

  it("does nothing without the mechanic", () => {
    expect(dmg([weaken()], [])).toBe(dmg([], []));
  });
});

describe("live bonuses", () => {
  const field = (enemies: BattleCharacter[], boss = tao()) =>
    applyLiveBonuses({ playerTeam: enemies, enemyTeam: [boss] });
  const bossOf = (teams: { enemyTeam: BattleCharacter[] }) =>
    teams.enemyTeam[0];

  it("raises DEF 10% per debuff across the whole enemy team", () => {
    const boss = bossOf(
      field([
        unit("duke", "player", { debuffs: [weaken("atk"), weaken("def")] }),
        unit("lyra", "player", { debuffs: [ignite(3)] }),
      ]),
    );
    expect(getEffectiveDefense(boss)).toBe(Math.floor(195 * 1.3));
  });

  it("recounts live: removing debuffs takes the bonus straight back off", () => {
    const debuffed = field([
      unit("duke", "player", { debuffs: [weaken("atk"), weaken("def")] }),
    ]);
    expect(getEffectiveDefense(bossOf(debuffed))).toBe(Math.floor(195 * 1.2));
    const cleansed = applyLiveBonuses({
      playerTeam: debuffed.playerTeam.map((u) => ({ ...u, debuffs: [] })),
      enemyTeam: debuffed.enemyTeam,
    });
    const boss = bossOf(cleansed);
    expect(getEffectiveDefense(boss)).toBe(195);
    // The DEF entry is gone; only the Duke-on-the-field one remains.
    expect(boss.buffs.map((b) => b.liveBonusKey)).toEqual(["live:2"]);
  });

  it("caps the DEF bonus at +50%", () => {
    const many = Array.from({ length: 9 }, () => weaken());
    const boss = bossOf(field([unit("duke", "player", { debuffs: many })]));
    expect(getEffectiveDefense(boss)).toBe(Math.floor(195 * 1.5));
  });

  it("ignores dead and benched enemies", () => {
    const boss = bossOf(
      field([
        unit("duke", "player", { debuffs: [weaken()], currentHP: 0 }),
        unit("lyra", "player", { debuffs: [weaken()], isSub: true }),
      ]),
    );
    expect(getEffectiveDefense(boss)).toBe(195);
  });

  it("raises ATK and damage dealt 5% per Ignite stack, summed over enemies", () => {
    const boss = bossOf(
      field([
        unit("gon", "player", { debuffs: [ignite(3)] }),
        unit("lyra", "player", { debuffs: [ignite(2)] }),
      ]),
    );
    expect(getEffectiveAttack(boss)).toBe(Math.floor(TAO_ATK * 1.25));
    expect(getDamageDealtMultiplier(boss)).toBeCloseTo(1.25, 5);
  });

  it("has no cap on Ignite stacks", () => {
    const boss = bossOf(
      field(
        [1, 2, 3, 4].map((n) =>
          unit("gon", "player", {
            instanceId: `g${n}`,
            debuffs: [ignite(6)],
          }),
        ),
      ),
    );
    // 24 stacks -> +120%.
    expect(getDamageDealtMultiplier(boss)).toBeCloseTo(2.2, 5);
  });

  it("adds 20% damage dealt while an enemy named Duke is on the field", () => {
    const withDuke = bossOf(field([unit("duke", "player")]));
    expect(getDamageDealtMultiplier(withDuke)).toBeCloseTo(1.2, 5);
    const withGreenDuke = bossOf(field([unit("green_duke", "player")]));
    expect(getDamageDealtMultiplier(withGreenDuke)).toBeCloseTo(1.2, 5);
    const without = bossOf(field([unit("lyra", "player")]));
    expect(getDamageDealtMultiplier(without)).toBe(1);
  });

  it("matches the name case-insensitively, as a substring, living and on the field", () => {
    const named = (name: string, over: Partial<BattleCharacter> = {}) =>
      unit("lyra", "player", { name, ...over });
    expect(
      getDamageDealtMultiplier(bossOf(field([named("Young DUKE")]))),
    ).toBeCloseTo(1.2, 5);
    expect(
      getDamageDealtMultiplier(bossOf(field([named("Duke", { currentHP: 0 })]))),
    ).toBe(1);
    expect(
      getDamageDealtMultiplier(bossOf(field([named("Duke", { isSub: true })]))),
    ).toBe(1);
  });

  it("does not stack with itself when recounted again and again", () => {
    let teams = field([unit("duke", "player", { debuffs: [weaken()] })]);
    for (let i = 0; i < 5; i += 1) teams = applyLiveBonuses(teams);
    expect(bossOf(teams).buffs.filter((b) => b.liveBonusKey)).toHaveLength(2);
    expect(getEffectiveDefense(bossOf(teams))).toBe(Math.floor(195 * 1.1));
  });

  it("is rewritten by executeSkill, so a debuff just landed counts at once", () => {
    // Tao casts at Duke: the debuff lands on the OTHER side, which is the
    // side his DEF bonus counts.
    const skill = {
      skillName: "Weaken",
      characterId: "master_tao_npc",
      type: "debuff",
      statMultiplier: "atk",
      mechanics: [
        { type: "debuff", stat: "atk", valuePercent: 30, duration: 2 },
      ],
    };
    const result = executeSkill(
      {
        sourceInstanceId: "master_tao_npc-enemy",
        skill: skill as never,
        targetInstanceId: "lyra-player",
        rank: 1,
      },
      { playerTeam: [unit("lyra", "player")], enemyTeam: [tao()] },
      () => {},
      0,
      () => 0.99,
    );
    expect(result.playerTeam[0].debuffs.length).toBe(1);
    expect(getEffectiveDefense(result.enemyTeam[0])).toBe(
      Math.floor(195 * 1.1),
    );
  });
});

describe("counterattack damage", () => {
  it("is halved against Tao and untouched against anyone else", () => {
    const strike = (target: BattleCharacter) => {
      const counterer = unit("duke", "player");
      return strikeBack(counterer, target, 300, () => {}).damage;
    };
    const lyra = strike(unit("lyra_npc", "enemy"));
    const taoHit = strike(tao());
    expect(lyra).toBeGreaterThan(0);
    // Different DEF, so compare against Tao's own unreduced figure.
    const unreduced = Math.floor(
      calculateDamage({
        baseDamage: (getEffectiveAttack(unit("duke", "player")) * 300) / 100,
        skillMechanics: [],
        target: tao(),
        attackerColor: "blue",
        attacker: unit("duke", "player"),
      }),
    );
    expect(taoHit).toBe(Math.floor(unreduced * 0.5));
  });
});

describe("seal and crowd-control immunity", () => {
  const sealSkill = (sealType: string) => ({
    skillName: "Seal",
    characterId: "duke",
    type: "debuff",
    statMultiplier: "atk",
    mechanics: [{ type: "seal", sealType, duration: 2 }],
  });
  const cast = (skill: unknown) =>
    executeSkill(
      {
        sourceInstanceId: "duke-player",
        skill: skill as never,
        targetInstanceId: "master_tao_npc-enemy",
        rank: 1,
      },
      { playerTeam: [unit("duke", "player")], enemyTeam: [tao()] },
      () => {},
      0,
      () => 0.99,
    ).enemyTeam[0];

  it("resists an Attack Seal", () => {
    expect(cast(sealSkill("attack")).debuffs.some((d) => d.type === "seal")).toBe(
      false,
    );
  });

  it("is still sealed by every other seal type", () => {
    for (const sealType of ["ultimate", "debuff", "attackDebuff"]) {
      expect(
        cast(sealSkill(sealType)).debuffs.some(
          (d) => d.type === "seal" && d.sealType === sealType,
        ),
        sealType,
      ).toBe(true);
    }
  });

  it("resists stun through the kit's ccImmune flag", () => {
    const stun = {
      skillName: "Stun",
      characterId: "duke",
      type: "debuff",
      statMultiplier: "atk",
      mechanics: [{ type: "stun", duration: 1 }],
    };
    expect(cast(stun).debuffs.some((d) => d.type === "stun")).toBe(false);
  });
});

describe("basic stats after every 5 attacks received", () => {
  const hit = (boss: BattleCharacter): BattleCharacter => {
    const skill = {
      skillName: "Poke",
      characterId: "duke",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [1, 1, 1],
    };
    return executeSkill(
      {
        sourceInstanceId: "duke-player",
        skill: skill as never,
        targetInstanceId: boss.instanceId,
        rank: 1,
      },
      { playerTeam: [unit("duke", "player")], enemyTeam: [boss] },
      () => {},
      0,
      () => 0.99,
    ).enemyTeam[0];
  };
  const hitTimes = (n: number): BattleCharacter => {
    let boss = unit("master_tao_npc", "enemy", {
      hp: 10500,
      currentHP: 10500,
    });
    for (let i = 0; i < n; i += 1) boss = hit(boss);
    return boss;
  };

  it("does nothing before the fifth attack", () => {
    const boss = hitTimes(4);
    expect(boss.passiveState.statShiftTriggers ?? 0).toBe(0);
    expect(boss.currentAttack).toBe(TAO_ATK);
  });

  it("shifts ATK and DEF 5% on the fifth and again on the tenth, never max HP", () => {
    const once = hitTimes(5);
    expect(once.passiveState.statShiftTriggers).toBe(1);
    expect(once.currentAttack).toBe(TAO_ATK + Math.trunc(TAO_ATK * 0.05));
    expect(once.currentDefense).toBe(195 + Math.trunc(195 * 0.05));
    // ATK and DEF only, his call (2026-10-03); max HP stays put.
    expect(once.hp).toBe(getCharacterById("master_tao_npc")!.hp);
    const twice = hitTimes(10);
    expect(twice.passiveState.statShiftTriggers).toBe(2);
    expect(twice.currentAttack).toBe(TAO_ATK + 2 * Math.trunc(TAO_ATK * 0.05));
  });

  it("stops after 10 triggers (+50%)", () => {
    const boss = hitTimes(55);
    expect(boss.passiveState.statShiftTriggers).toBe(10);
    expect(boss.currentAttack).toBe(TAO_ATK + 10 * Math.trunc(TAO_ATK * 0.05));
    expect(boss.passiveState.statShiftTriggered).toBe(true);
  });

  it("keeps a single readout badge however often it fires", () => {
    const boss = hitTimes(20);
    expect(
      boss.buffs.filter((b) => b.preApplied && b.uncancellable),
    ).toHaveLength(1);
  });

  it("leaves Gon's one-shot alone: one trigger, ever", () => {
    // Gon authors no maxTriggers, so the repeat path must stay closed to him.
    const gon = getCharacterById("gon");
    expect(gon).toBeDefined();
    const mech = (gon?.passive?.mechanics ?? []).find(
      (m) => m.type === "statShiftAfterAttacks",
    );
    expect(mech?.maxTriggers).toBeUndefined();
  });
});

describe("removing one random debuff at turn start", () => {
  it("removes exactly one distinct debuff, chosen by the RNG", () => {
    const debuffs = [weaken("atk"), weaken("def"), ignite(3)];
    const first = removeRandomDebuffs({ debuffs }, 1, () => 0);
    expect(first.debuffs).toEqual([debuffs[1], debuffs[2]]);
    const last = removeRandomDebuffs({ debuffs }, 1, () => 0.999);
    // The last distinct debuff is Ignite: every stack goes with it.
    expect(last.debuffs).toEqual([debuffs[0], debuffs[1]]);
  });

  it("is deterministic for a seeded RNG and a no-op with nothing to remove", () => {
    const debuffs = [weaken("atk"), weaken("def")];
    const run = () => removeRandomDebuffs({ debuffs }, 1, () => 0.4).debuffs;
    expect(run()).toEqual(run());
    expect(removeRandomDebuffs({ debuffs: [] }, 1, () => 0).removed).toEqual([]);
  });

  it("leaves uncancellable effects alone", () => {
    const effect = { ...weaken(), uncancellable: true };
    expect(removeRandomDebuffs({ debuffs: [effect] }, 1, () => 0).debuffs).toEqual([
      effect,
    ]);
  });

  it("fires from the passive queue at the start of the boss's own turn only", async () => {
    const boss = unit("master_tao_npc", "enemy", {
      debuffs: [weaken("atk"), weaken("def")],
    });
    const player = unit("duke", "player", { debuffs: [weaken("atk")] });
    const queue = createMechanicQueue();
    registerCharacterPassives(boss, queue.register);
    const teams = { playerTeam: [player], enemyTeam: [boss] };

    const wrongTurn = await queue.process("OnPlayerTurnStart", teams, () => {}, () => 0);
    expect(wrongTurn.enemyTeam[0].debuffs).toHaveLength(2);

    const rightTurn = await queue.process("OnEnemyTurnStart", teams, () => {}, () => 0);
    expect(rightTurn.enemyTeam[0].debuffs).toHaveLength(1);
    // Nobody else's debuffs are touched.
    expect(rightTurn.playerTeam[0].debuffs).toHaveLength(1);
  });
});

describe("the player-facing readout", () => {
  it("shows the live bonuses and the attacks-received stack", () => {
    const teams = applyLiveBonuses({
      playerTeam: [unit("duke", "player", { debuffs: [weaken(), ignite(2)] })],
      enemyTeam: [
        unit("master_tao_npc", "enemy", {
          passiveState: { attacksReceived: 7, statShiftTriggers: 1 },
        }),
      ],
    });
    const readout = getPassiveReadout(teams.enemyTeam[0], {
      playerTeam: teams.playerTeam,
      enemyTeam: teams.enemyTeam,
      currentTurn: 1,
    });
    expect(readout?.stacks).toEqual({ current: 1, max: 10 });
    expect(readout?.lines).toContain("+20% DEF");
    expect(readout?.lines).toContain("+10% ATK and damage dealt");
    expect(readout?.lines).toContain("+20% damage dealt");
  });
});
