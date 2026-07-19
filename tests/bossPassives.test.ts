import { describe, expect, it } from "vitest";
import {
  applyBossTurnStart,
  bossForcedSpThisTurn,
  bossForcedSpAction,
  bossDamageMultiplierVsTarget,
  totalDebuffStacks,
  activeSpSkill,
} from "@/lib/game/bossPassives";
import { executeSkill } from "@/lib/game/combat";
import { getCharacterById } from "@/lib/game/characterCatalog";
import type { BattleCharacter, CharacterPhase } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";

const noop = () => {};

function char(over: Partial<BattleCharacter> = {}): BattleCharacter {
  return {
    id: "u",
    name: "Unit",
    color: "dark",
    atk: 100,
    def: 50,
    hp: 1000,
    skills: [] as unknown as BattleCharacter["skills"],
    instanceId: "u1",
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 50,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team: "player",
    ...over,
  } as BattleCharacter;
}

const corrosion = (stacks = 1) => ({
  type: "corrosion" as const,
  name: "Corrosion",
  valuePercent: 10,
  stacks,
  debuffDuration: 2,
});

/** Boss with a single active phase carrying the given passive mechanics. */
function boss(
  mechanics: Record<string, unknown>[],
  over: Partial<BattleCharacter> = {},
  spSkill?: SkillCard,
): BattleCharacter {
  const phase: CharacterPhase = {
    hp: 3000,
    atk: 150,
    def: 110,
    skills: [] as unknown as SkillCard[],
    spSkill,
    passives: [
      {
        name: "Test",
        trigger: "always",
        mechanics: mechanics as never,
      },
    ],
  };
  return char({
    id: "molvarr",
    name: "Molvarr",
    team: "enemy",
    instanceId: "boss1",
    atk: 150,
    def: 110,
    hp: 3000,
    currentHP: 3000,
    currentAttack: 150,
    currentDefense: 110,
    phaseIndex: 0,
    phases: [phase],
    ...over,
  });
}

describe("totalDebuffStacks", () => {
  it("sums stacks across field units (subs/dead excluded)", () => {
    const team = [
      char({ instanceId: "a", debuffs: [corrosion(3)] }),
      char({ instanceId: "b", debuffs: [{ type: "stun", debuffDuration: 1 }] }),
      char({ instanceId: "c", isSub: true, debuffs: [corrosion(5)] }),
      char({ instanceId: "d", currentHP: 0, debuffs: [corrosion(2)] }),
    ];
    expect(totalDebuffStacks(team)).toBe(4); // 3 + 1, sub & dead ignored
  });
});

describe("phase-turn counter + forced SP schedule", () => {
  const sp: SkillCard = {
    skillName: "Devour",
    characterId: "molvarr",
    type: "heal",
    statMultiplier: "hp",
    damageRanked: [0, 0, 0],
    mechanics: [{ type: "heal", missingHpPercent: 30, targetSelf: true }],
  };

  it("increments phaseTurn each turn start", () => {
    let b = boss([{ type: "bossAutoSp", everyNTurns: 3 }], {}, sp);
    b = applyBossTurnStart([b], [char()], noop).enemyTeam[0];
    expect(b.passiveState.phaseTurn).toBe(1);
    b = applyBossTurnStart([b], [char()], noop).enemyTeam[0];
    expect(b.passiveState.phaseTurn).toBe(2);
  });

  it("forces SP only on multiples of everyNTurns", () => {
    const mk = (t: number) =>
      boss(
        [{ type: "bossAutoSp", everyNTurns: 3 }],
        { passiveState: { phaseTurn: t } },
        sp,
      );
    expect(bossForcedSpThisTurn(mk(1))).toBe(false);
    expect(bossForcedSpThisTurn(mk(2))).toBe(false);
    expect(bossForcedSpThisTurn(mk(3))).toBe(true);
    expect(bossForcedSpThisTurn(mk(6))).toBe(true);
    expect(bossForcedSpThisTurn(mk(4))).toBe(false);
  });

  it("no forced SP without an spSkill in the phase", () => {
    const b = boss([{ type: "bossAutoSp", everyNTurns: 3 }], {
      passiveState: { phaseTurn: 3 },
    });
    expect(activeSpSkill(b)).toBeUndefined();
    expect(bossForcedSpThisTurn(b)).toBe(false);
  });

  it("bossForcedSpAction targets self for a heal SP", () => {
    const b = boss(
      [{ type: "bossAutoSp", everyNTurns: 3 }],
      { passiveState: { phaseTurn: 3 } },
      sp,
    );
    const action = bossForcedSpAction([b], [char()]);
    expect(action?.sourceInstanceId).toBe("boss1");
    expect(action?.targetInstanceId).toBe("boss1");
    expect(action?.skill.skillName).toBe("Devour");
  });
});

describe("bossDebuffAtk (dynamic ATK per debuff stack)", () => {
  it("raises ATK by percentPerDebuff x total enemy debuff stacks", () => {
    const b = boss([{ type: "bossDebuffAtk", percentPerDebuff: 10 }]);
    const players = [char({ debuffs: [corrosion(3)] })]; // 3 stacks -> +30%
    const out = applyBossTurnStart([b], players, noop).enemyTeam[0];
    expect(out.currentAttack).toBe(150 + Math.floor(150 * 0.3)); // 195
    expect(out.buffs.some((x) => x.valuePercent === 30)).toBe(true);
  });

  it("recomputes as the debuff count changes (badge updated in place)", () => {
    let b = boss([{ type: "bossDebuffAtk", percentPerDebuff: 10 }]);
    b = applyBossTurnStart([b], [char({ debuffs: [corrosion(2)] })], noop)
      .enemyTeam[0];
    expect(out(b)).toBe(180); // +20%
    // debuffs cleansed -> ATK falls back toward base next turn
    b = applyBossTurnStart([b], [char({ debuffs: [] })], noop).enemyTeam[0];
    expect(out(b)).toBe(150);
    expect(b.buffs.filter((x) => x.name === "Malice").length).toBe(1);
  });

  const out = (c: BattleCharacter) => c.currentAttack;
});

describe("bossApplyCorrosion", () => {
  it("adds one 2-turn Corrosion to each field player per turn", () => {
    const b = boss([{ type: "bossApplyCorrosion", perTurn: 1, duration: 2 }]);
    const players = [
      char({ instanceId: "a" }),
      char({ instanceId: "s", isSub: true }),
    ];
    const res = applyBossTurnStart([b], players, noop).playerTeam;
    expect(res[0].debuffs.filter((d) => d.type === "corrosion")).toHaveLength(1);
    expect(res[0].debuffs[0].debuffDuration).toBe(2);
    expect(res[1].debuffs).toHaveLength(0); // sub untouched
  });
});

describe("bossMaxHpDrain (from turn 10)", () => {
  it("does nothing before the threshold turn", () => {
    const b = boss([{ type: "bossMaxHpDrain", fromTurn: 10, percent: 10 }], {
      passiveState: { phaseTurn: 8 },
    });
    const res = applyBossTurnStart([b], [char({ currentHP: 1000 })], noop)
      .playerTeam;
    expect(res[0].currentHP).toBe(1000); // turn 9, no drain
  });

  it("drains 10% max HP once turn 10 is reached", () => {
    const b = boss([{ type: "bossMaxHpDrain", fromTurn: 10, percent: 10 }], {
      passiveState: { phaseTurn: 9 },
    });
    const res = applyBossTurnStart([b], [char({ currentHP: 1000 })], noop)
      .playerTeam;
    expect(res[0].currentHP).toBe(900); // turn 10 -> -100
  });
});

describe("bossStatSpike (turn-10 x2, once)", () => {
  it("doubles ATK/DEF/maxHP and scales current HP, only once", () => {
    let b = boss([{ type: "bossStatSpike", fromTurn: 10, multiplier: 2 }], {
      passiveState: { phaseTurn: 9 },
      currentHP: 1500,
    });
    b = applyBossTurnStart([b], [char()], noop).enemyTeam[0]; // -> turn 10
    expect(b.atk).toBe(300);
    expect(b.def).toBe(220);
    expect(b.hp).toBe(6000);
    expect(b.currentHP).toBe(3000); // 1500 * 2
    expect(b.passiveState.statSpikeDone).toBe(true);

    b = applyBossTurnStart([b], [char()], noop).enemyTeam[0]; // -> turn 11
    expect(b.atk).toBe(300); // no second doubling
    expect(b.hp).toBe(6000);
  });
});

describe("heal missingHpPercent (SP Skill)", () => {
  it("heals 30% of diminished HP", () => {
    const healer = char({
      instanceId: "b",
      team: "enemy",
      hp: 3000,
      currentHP: 500,
    });
    const sp: SkillCard = {
      skillName: "Devour",
      characterId: "molvarr",
      type: "heal",
      statMultiplier: "hp",
      damageRanked: [0, 0, 0],
      mechanics: [{ type: "heal", missingHpPercent: 30, targetSelf: true }],
    };
    const res = executeSkill(
      { sourceInstanceId: "b", skill: sp, targetInstanceId: "b" },
      { playerTeam: [], enemyTeam: [healer] },
      noop,
    );
    // 30% of (3000-500) = 750 -> 1250
    expect(res.enemyTeam[0].currentHP).toBe(1250);
  });
});

describe("bossCorrosionBonus (+30% vs Corroded, combat hook)", () => {
  const attackSkill: SkillCard = {
    skillName: "Bite",
    characterId: "molvarr",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [200, 200, 200],
  };

  const run = (targetCorroded: boolean) => {
    const attacker = boss([{ type: "bossCorrosionBonus", percent: 30 }], {
      instanceId: "boss1",
      team: "enemy",
    });
    const target = char({
      instanceId: "t",
      team: "player",
      color: "dark",
      def: 0,
      currentHP: 5000,
      hp: 5000,
      debuffs: targetCorroded ? [corrosion(1)] : [],
    });
    const res = executeSkill(
      { sourceInstanceId: "boss1", skill: attackSkill, targetInstanceId: "t" },
      { playerTeam: [target], enemyTeam: [attacker] },
      noop,
      0,
      () => 0.99, // no evade/crit
    );
    return 5000 - res.playerTeam[0].currentHP;
  };

  it("deals more damage to a Corroded target", () => {
    const plain = run(false);
    const corroded = run(true);
    expect(corroded).toBeGreaterThan(plain);
  });

  it("multiplier is +30% vs Corroded, 1.0 vs clean", () => {
    const attacker = boss([{ type: "bossCorrosionBonus", percent: 30 }]);
    const corroded = char({ team: "player", debuffs: [corrosion(1)] });
    const clean = char({ team: "player", debuffs: [] });
    expect(bossDamageMultiplierVsTarget(attacker, corroded)).toBeCloseTo(1.3);
    expect(bossDamageMultiplierVsTarget(attacker, clean)).toBe(1);
  });
});

describe("phase transition + engine cohesion", () => {
  it("after P1 breaks, the P2 passives drive the turn-start engine", async () => {
    const { transitionBossPhases } = await import("@/lib/game/phases");
    const twoPhase = char({
      id: "molvarr",
      name: "Molvarr",
      team: "enemy",
      instanceId: "boss1",
      currentHP: 0, // P1 bar emptied
      phaseIndex: 0,
      phases: [
        {
          hp: 3000,
          atk: 150,
          def: 110,
          skills: [] as unknown as SkillCard[],
          passives: [
            {
              name: "P1",
              trigger: "always",
              mechanics: [{ type: "bossDebuffAtk", percentPerDebuff: 10 }] as never,
            },
          ],
        },
        {
          hp: 4000,
          atk: 210,
          def: 145,
          skills: [] as unknown as SkillCard[],
          passives: [
            {
              name: "Corrosive Tide",
              trigger: "always",
              mechanics: [
                { type: "bossApplyCorrosion", perTurn: 1, duration: 2 },
              ] as never,
            },
          ],
        },
      ],
    });

    const stepped = transitionBossPhases([twoPhase]);
    expect(stepped.transitions).toHaveLength(1);
    const p2 = stepped.team[0];
    expect(p2.phaseIndex).toBe(1);
    expect(p2.currentHP).toBe(4000); // fresh P2 bar

    // The engine now reads P2's passives — Corrosion, not the P1 ATK passive.
    const players = [char({ instanceId: "p" })];
    const res = applyBossTurnStart([p2], players, noop);
    expect(
      res.playerTeam[0].debuffs.filter((d) => d.type === "corrosion"),
    ).toHaveLength(1);
  });
});

describe("Molvarr kit loads from data", () => {
  it("validates and exposes both phases, ult cap 10, CC immunity", () => {
    const m = getCharacterById("molvarr");
    expect(m).toBeDefined();
    expect(m!.ultGaugeMax).toBe(10);
    expect(m!.ccImmune).toBe(true);
    expect(m!.tier).toBe("elite");
    const phases = (m as { phases?: CharacterPhase[] }).phases;
    expect(phases).toHaveLength(2);
    expect(phases![0].spSkill?.skillName).toBe("Devour the Tide");
    expect(phases![1].spSkill?.skillName).toBe("Iron Carapace");
  });
});
