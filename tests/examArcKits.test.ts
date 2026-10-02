import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import { buildBattleUnit } from "@/lib/game/buildUnit";
import {
  getAllCharacters,
  getCharacterByCardNumber,
  getCharacterById,
  getPlayableCharacters,
} from "@/lib/game/characterCatalog";
import { registerCharacterPassives } from "@/lib/game/passive";
import { createMechanicQueue } from "@/lib/game/mechanicQueue";
import { applyFreeze, isFrozen } from "@/lib/game/freeze";
import { tickTeamDebuffs } from "@/lib/game/tick";
import { getAIMove } from "@/lib/game/ai";
import { ultGaugeAfterUltimate } from "@/lib/game/ultGauge";
import { coldStacksOn } from "@/lib/game/cold";
import { applyDefeatPassives } from "@/lib/game/onDefeat";
import type { Action } from "@/types/action";
import type { BattleCharacter } from "@/types/character";
import type { StatusEffect } from "@/types/mechanic";
import type { SkillCard } from "@/types/skillCard";
import type { UltimateCard } from "@/types/ultimateCard";

/**
 * The three kits imported from `toll-kits` on 2026-10-02 — blue Lyra, Caila,
 * green Duke — and the engine work they needed. Every rule pinned here is
 * Tanveer's: the drafts' settled lines (2026-09-26 to 09-29) and his answers
 * of 2026-10-02. Rulings #164–#170 in docs/HANDOFF.md carry the wording.
 */

type Teams = { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] };
const log = () => {};
const never = () => 0.99;

function unit(id: string, team: "player" | "enemy", instanceId = id, ultLevel = 1) {
  return buildBattleUnit({
    raw: getCharacterById(id)!,
    pick: { id, ultLevel },
    team,
    instanceId,
    isSub: false,
  });
}

function dummy(
  instanceId: string,
  team: "player" | "enemy",
  overrides: Partial<BattleCharacter> = {},
): BattleCharacter {
  const hit: SkillCard = {
    skillName: "Hit",
    characterId: instanceId,
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
  };
  return {
    id: instanceId,
    instanceId,
    name: instanceId,
    team,
    color: "light",
    atk: 100,
    def: 0,
    hp: 100000,
    skills: [hit, hit] as [SkillCard, SkillCard],
    currentHP: 100000,
    currentAttack: 100,
    currentDefense: 0,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    lifestealPercent: 0,
    ...overrides,
  } as BattleCharacter;
}

function act(
  teams: Teams,
  source: BattleCharacter,
  skill: SkillCard | UltimateCard,
  target: BattleCharacter,
  rank: 1 | 2 | 3 = 1,
): Teams {
  const action: Action = {
    sourceInstanceId: source.instanceId,
    skill,
    targetInstanceId: target.instanceId,
    rank,
  };
  return executeSkill(action, teams, log, 0, never);
}

const find = (teams: Teams, instanceId: string) =>
  [...teams.playerTeam, ...teams.enemyTeam].find(
    (u) => u.instanceId === instanceId,
  )!;

async function runPhase(teams: Teams, phase: Parameters<ReturnType<typeof createMechanicQueue>["process"]>[0]) {
  const queue = createMechanicQueue();
  [...teams.playerTeam, ...teams.enemyTeam].forEach((u) =>
    registerCharacterPassives(u, queue.register),
  );
  return queue.process(phase, teams, log);
}

const TOTAL_GUARD: StatusEffect = {
  type: "buff",
  stat: "damageReduction",
  valuePercent: 100,
  uncancellable: true,
  name: "Total guard",
};

describe("not live yet (Tanveer, 2026-10-02: dev only)", () => {
  const ids = ["blue_lyra", "caila", "green_duke"];

  it("exists for the engine but not for a player-facing list", () => {
    const all = getAllCharacters().map((c) => c.id);
    const playable = getPlayableCharacters().map((c) => c.id);
    for (const id of ids) {
      expect(all).toContain(id);
      expect(playable).not.toContain(id);
    }
  });

  it("does not resolve from an archive URL outside development", () => {
    for (const id of ids) {
      const { cardNumber } = getCharacterById(id)!;
      expect(getCharacterByCardNumber(cardNumber)).toBeUndefined();
    }
  });
});

describe("[Freeze] (Tanveer, 2026-09-27)", () => {
  it("strips cancellable buffs, debuffs and stances; keeps uncancellable ones and effects", () => {
    const target = dummy("t", "enemy", {
      buffs: [
        { type: "buff", stat: "atk", valuePercent: 30, buffDuration: 2 },
        { type: "stance", stat: "damageReduction", valuePercent: 25, groupId: "g" },
        { type: "buff", stat: "def", valuePercent: 50, uncancellable: true },
      ],
      debuffs: [
        { type: "debuff", stat: "def", valuePercent: 30, debuffDuration: 2 },
        { type: "cold", stacks: 2, uncancellable: true, sourceId: "x" },
      ],
    });
    expect(applyFreeze(target, 1)).toBe("frozen");
    expect(target.buffs.map((b) => b.stat)).toEqual(["def"]);
    expect(target.debuffs.map((d) => d.type).sort()).toEqual(["cold", "freeze"]);
  });

  it("is blocked by Debuff Immunity and by a CC-immune boss, stripping nothing", () => {
    const immune = dummy("i", "enemy", {
      buffs: [
        { type: "buff", debuffImmune: true, buffDuration: 2 },
        { type: "buff", stat: "atk", valuePercent: 30 },
      ],
    });
    expect(applyFreeze(immune, 1)).toBe("debuffImmune");
    expect(immune.buffs).toHaveLength(2);
    expect(applyFreeze(dummy("b", "enemy", { ccImmune: true }), 1)).toBe("ccImmune");
  });

  it("keeps a frozen unit from acting", () => {
    const frozen = dummy("f", "player", {
      debuffs: [{ type: "freeze", name: "Frozen", debuffDuration: 1 }],
    });
    const target = dummy("t", "enemy");
    const after = act({ playerTeam: [frozen], enemyTeam: [target] }, frozen, frozen.skills[0], target);
    expect(find(after, "t").currentHP).toBe(100000);
  });

  it("refuses a frozen unit new cancellable buffs, and lets uncancellable ones land", () => {
    const caster = dummy("c", "player");
    const frozen = dummy("f", "player", {
      debuffs: [{ type: "freeze", name: "Frozen", debuffDuration: 1 }],
    });
    const free = dummy("a", "player");
    const rally = {
      skillName: "Rally",
      characterId: "c",
      type: "buff",
      statMultiplier: "atk",
      damageRanked: [0, 0, 0],
      mechanics: [
        { type: "aoe" },
        { type: "buff", applyTo: "allies", stat: "atk", valuePercent: 30, duration: 2 },
        { type: "buff", applyTo: "allies", stat: "def", valuePercent: 30, duration: 2, uncancellable: true },
      ],
    } as unknown as SkillCard;
    const after = act({ playerTeam: [caster, frozen, free], enemyTeam: [dummy("e", "enemy")] }, caster, rally, caster);
    expect(find(after, "a").buffs.map((b) => b.stat).sort()).toEqual(["atk", "def"]);
    expect(find(after, "f").buffs.map((b) => b.stat)).toEqual(["def"]);
  });

  it("breaks on damage, and a freezing skill refreezes at the end of its own attack", () => {
    const attacker = dummy("a", "player");
    const target = dummy("t", "enemy", {
      debuffs: [{ type: "freeze", name: "Frozen", debuffDuration: 1 }],
    });
    const after = act({ playerTeam: [attacker], enemyTeam: [target] }, attacker, attacker.skills[0], target);
    expect(isFrozen(find(after, "t"))).toBe(false);

    const icebolt = {
      ...attacker.skills[0],
      skillName: "Icebolt",
      mechanics: [{ type: "freeze", duration: 2 }],
    } as SkillCard;
    const again = act({ playerTeam: [attacker], enemyTeam: [target] }, attacker, icebolt, target);
    const freeze = find(again, "t").debuffs.find((d) => d.type === "freeze");
    expect(freeze?.debuffDuration).toBe(2);
  });

  it("is not broken by a tanked hit, which deals nothing", () => {
    const attacker = dummy("a", "player");
    const target = dummy("t", "enemy", {
      buffs: [TOTAL_GUARD],
      debuffs: [{ type: "freeze", name: "Frozen", debuffDuration: 1 }],
    });
    const after = act({ playerTeam: [attacker], enemyTeam: [target] }, attacker, attacker.skills[0], target);
    expect(isFrozen(find(after, "t"))).toBe(true);
  });

  it("is broken by a damage-over-time tick", () => {
    const frozen = dummy("f", "enemy", {
      debuffs: [
        { type: "freeze", name: "Frozen", debuffDuration: 2 },
        { type: "damageOverTime", value: 50, debuffDuration: 2, uncancellable: true },
      ],
    });
    const [after] = tickTeamDebuffs([frozen], log);
    expect(isFrozen(after)).toBe(false);
  });

  it("is removed by a cleanse", () => {
    const healer = dummy("h", "player");
    const frozen = dummy("f", "player", {
      debuffs: [{ type: "freeze", name: "Frozen", debuffDuration: 1 }],
    });
    const purge = {
      skillName: "Purge",
      characterId: "h",
      type: "heal",
      statMultiplier: "atk",
      damageRanked: [0, 0, 0],
      mechanics: [{ type: "cleanse", applyTo: "oneAlly" }],
    } as unknown as SkillCard;
    const after = act({ playerTeam: [healer, frozen], enemyTeam: [dummy("e", "enemy")] }, healer, purge, frozen);
    expect(isFrozen(find(after, "f"))).toBe(false);
  });
});

describe("ultimate seal — 'disables ultimate moves' (Tanveer, 2026-09-26)", () => {
  it("Soporific disables the target's ultimate, and the ultimate then fizzles", () => {
    const caila = unit("caila", "player");
    const lyra = unit("lyra", "enemy");
    const after = act({ playerTeam: [caila], enemyTeam: [lyra] }, caila, caila.skills[1], lyra);
    const sealed = find(after, "lyra");
    expect(sealed.debuffs.some((d) => d.type === "seal" && d.sealType === "ultimate")).toBe(true);

    const hpBefore = find(after, "caila").currentHP;
    const tried = act(after, sealed, sealed.ultimate!, find(after, "caila"));
    expect(find(tried, "caila").currentHP).toBe(hpBefore);
  });

  it("keeps the AI off a sealed ultimate, gauge full or not", () => {
    const lyra = { ...unit("lyra", "enemy"), ultGauge: 5 };
    const sealed = {
      ...lyra,
      debuffs: [{ type: "seal" as const, sealType: "ultimate", debuffDuration: 1 }],
    };
    expect(getAIMove([lyra], [dummy("p", "player")])?.skill.type).toBe("ultimate");
    expect(getAIMove([sealed], [dummy("p", "player")])?.skill.type).not.toBe("ultimate");
  });
});

describe("blue Lyra — Frostline", () => {
  it("ATK +50% at battle start, -20 at every turn end, holding at +10%", async () => {
    let teams: Teams = { playerTeam: [unit("blue_lyra", "player")], enemyTeam: [dummy("e", "enemy")] };
    const atkBuff = () =>
      find(teams, "blue_lyra").buffs.find((b) => b.name === "Frostline")?.valuePercent;
    teams = await runPhase(teams, "OnBattleStart");
    expect(atkBuff()).toBe(50);
    teams = await runPhase(teams, "OnPlayerTurnEnd");
    expect(atkBuff()).toBe(30);
    teams = await runPhase(teams, "OnEnemyTurnEnd");
    expect(atkBuff()).toBe(10);
    teams = await runPhase(teams, "OnPlayerTurnEnd");
    expect(atkBuff()).toBe(10);
  });

  it("does nothing from the bench (Tanveer, 2026-10-02: 'She has to be on field')", async () => {
    const benched = { ...unit("blue_lyra", "player"), isSub: true };
    let teams: Teams = { playerTeam: [benched], enemyTeam: [dummy("e", "enemy")] };
    teams = await runPhase(teams, "OnBattleStart");
    teams = await runPhase(teams, "OnPlayerTurnEnd");
    expect(find(teams, "blue_lyra").buffs).toHaveLength(0);
  });

  it("gives one [Cold] per real hit, capped at 3", () => {
    const lyra = unit("blue_lyra", "player");
    let teams: Teams = { playerTeam: [lyra], enemyTeam: [dummy("e", "enemy")] };
    for (let i = 0; i < 4; i++) {
      teams = act(teams, find(teams, "blue_lyra"), lyra.skills[1], find(teams, "e"));
    }
    expect(coldStacksOn(find(teams, "e"), "blue_lyra")).toBe(3);
  });

  it("gives no [Cold] on a tanked hit (his answer, 2026-10-02)", () => {
    const lyra = unit("blue_lyra", "player");
    const teams: Teams = { playerTeam: [lyra], enemyTeam: [dummy("e", "enemy", { buffs: [TOTAL_GUARD] })] };
    const after = act(teams, lyra, lyra.skills[1], find(teams, "e"));
    expect(coldStacksOn(find(after, "e"), "blue_lyra")).toBe(0);
  });

  const withCold = (stacks: number, extra: Partial<BattleCharacter> = {}) =>
    dummy("e", "enemy", {
      ...extra,
      debuffs: [{ type: "cold", stacks, uncancellable: true, sourceId: "blue_lyra" }],
    });

  it("at 2 stacks: ATK and DEF -10% and ultimate disabled, both uncancellable, 1 turn", async () => {
    const teams = await runPhase(
      { playerTeam: [unit("blue_lyra", "player")], enemyTeam: [withCold(2)] },
      "OnPlayerTurnEnd",
    );
    const e = find(teams, "e");
    const statDown = e.debuffs.find((d) => d.type === "debuff");
    expect(statDown).toMatchObject({ stats: ["atk", "def"], valuePercent: 10, debuffDuration: 1, uncancellable: true });
    expect(e.debuffs.some((d) => d.type === "seal" && d.sealType === "ultimate" && d.uncancellable)).toBe(true);
    expect(coldStacksOn(e, "blue_lyra")).toBe(2);
  });

  it("at 3 stacks: every stack is spent, then the enemy is Frozen", async () => {
    const teams = await runPhase(
      { playerTeam: [unit("blue_lyra", "player")], enemyTeam: [withCold(3)] },
      "OnPlayerTurnEnd",
    );
    const e = find(teams, "e");
    expect(coldStacksOn(e, "blue_lyra")).toBe(0);
    expect(isFrozen(e)).toBe(true);
    expect(e.debuffs.some((d) => d.type === "debuff")).toBe(false);
  });

  it("Debuff Immunity blocks the tiers and the freeze, but the stacks are still spent at 3", async () => {
    const immunity: StatusEffect = { type: "buff", debuffImmune: true, buffDuration: 3 };
    const one = await runPhase(
      { playerTeam: [unit("blue_lyra", "player")], enemyTeam: [withCold(1, { buffs: [immunity] })] },
      "OnPlayerTurnEnd",
    );
    expect(find(one, "e").debuffs.some((d) => d.type === "debuff")).toBe(false);
    expect(coldStacksOn(find(one, "e"), "blue_lyra")).toBe(1);

    const three = await runPhase(
      { playerTeam: [unit("blue_lyra", "player")], enemyTeam: [withCold(3, { buffs: [immunity] })] },
      "OnPlayerTurnEnd",
    );
    expect(coldStacksOn(find(three, "e"), "blue_lyra")).toBe(0);
    expect(isFrozen(find(three, "e"))).toBe(false);
  });

  it("[Cold] ends when Lyra dies", () => {
    const lyra = { ...unit("blue_lyra", "player"), currentHP: 0 };
    const teams = { playerTeam: [lyra], enemyTeam: [withCold(2)] };
    applyDefeatPassives(teams, log);
    expect(coldStacksOn(teams.enemyTeam[0], "blue_lyra")).toBe(0);
  });
});

describe("Caila — Materia Medica", () => {
  it("gains one [Vial] at each of her turn starts, up to 3", async () => {
    let teams: Teams = { playerTeam: [unit("caila", "player")], enemyTeam: [dummy("e", "enemy")] };
    for (let i = 0; i < 4; i++) teams = await runPhase(teams, "OnPlayerTurnStart");
    expect(find(teams, "caila").passiveState.healBoostStacks).toBe(3);
  });

  function healedBy(stacks: number): number {
    const caila = { ...unit("caila", "player"), passiveState: { healBoostStacks: stacks } };
    const hurt = dummy("h", "player", { currentHP: 1 });
    const after = act(
      { playerTeam: [caila, hurt], enemyTeam: [dummy("e", "enemy")] },
      caila,
      caila.skills[0],
      hurt,
    );
    expect(find(after, "caila").passiveState.healBoostStacks).toBe(0);
    return find(after, "h").currentHP - 1;
  }

  it("spends every [Vial] on a heal skill: +30% each, +180% for all three", () => {
    const base = healedBy(0);
    expect(healedBy(1) / base).toBeCloseTo(1.3, 1);
    expect(healedBy(2) / base).toBeCloseTo(1.6, 1);
    expect(healedBy(3) / base).toBeCloseTo(2.8, 1);
  });

  it("Panacea cleanses and applies Rejuvenate from Rank 2 only", () => {
    const caila = unit("caila", "player");
    const hurt = dummy("h", "player", {
      currentHP: 1,
      debuffs: [{ type: "debuff", stat: "atk", valuePercent: 30, debuffDuration: 2 }],
    });
    const teams = { playerTeam: [caila, hurt], enemyTeam: [dummy("e", "enemy")] };
    const r1 = find(act(teams, caila, caila.skills[0], hurt, 1), "h");
    expect(r1.debuffs).toHaveLength(1);
    expect(r1.buffs.some((b) => b.type === "healOverTime")).toBe(false);
    const r2 = find(act(teams, caila, caila.skills[0], hurt, 2), "h");
    expect(r2.debuffs).toHaveLength(0);
    expect(r2.buffs.find((b) => b.type === "healOverTime")?.buffDuration).toBe(1);
  });

  it("Theriac fills every ally's gauge, hers included, and restocks [Vial]", () => {
    const caila = unit("caila", "player", "caila", 2);
    const ally = dummy("a", "player");
    const after = act({ playerTeam: [caila, ally], enemyTeam: [dummy("e", "enemy")] }, caila, caila.ultimate!, caila);
    expect(find(after, "a").ultGauge).toBe(1);
    expect(find(after, "caila").passiveState.healBoostStacks).toBe(1);
    // Her own share is the battle loop's: spent to 0, then refilled.
    expect(ultGaugeAfterUltimate(caila, caila.ultimate!.mechanics)).toBe(1);
    expect(ultGaugeAfterUltimate({ ...caila, ultLevel: 1 }, caila.ultimate!.mechanics)).toBe(0);
    const ul6 = unit("caila", "player", "caila", 6);
    const filled = act({ playerTeam: [ul6], enemyTeam: [dummy("e", "enemy")] }, ul6, ul6.ultimate!, ul6);
    expect(find(filled, "caila").passiveState.healBoostStacks).toBe(3);
  });
});

describe("green Duke — Undertow and Confluence", () => {
  const enemyAoe = {
    skillName: "Sweep",
    characterId: "e",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
    mechanics: [{ type: "aoe" }],
  } as unknown as SkillCard;

  function stanced(rank: 1 | 2 | 3, allies: BattleCharacter[] = [dummy("a", "player")]) {
    const duke = unit("green_duke", "player");
    return act(
      { playerTeam: [duke, ...allies], enemyTeam: [dummy("e", "enemy")] },
      duke,
      duke.skills[1],
      duke,
      rank,
    );
  }

  it("R1 is the counter alone; R2 adds allies' damage reduction; R3 adds his Debuff Immunity, in the stance", () => {
    const r1 = stanced(1);
    expect(find(r1, "a").buffs).toHaveLength(0);
    expect(find(r1, "green_duke").buffs.some((b) => b.debuffImmune)).toBe(false);

    const r2 = stanced(2);
    expect(find(r2, "a").buffs.find((b) => b.stat === "damageReduction")?.valuePercent).toBe(10);

    const r3 = stanced(3);
    expect(find(r3, "a").buffs.find((b) => b.stat === "damageReduction")?.valuePercent).toBe(20);
    const immunity = find(r3, "green_duke").buffs.find((b) => b.debuffImmune);
    expect(immunity?.groupId).toBeDefined();
    expect(immunity?.buffDuration).toBe(2);
  });

  it("counters once per enemy skill, even an AoE across several allies", () => {
    const teams = stanced(1, [dummy("a", "player"), dummy("b", "player")]);
    const e = find(teams, "e");
    const after = act(teams, e, enemyAoe, find(teams, "a"));
    const dealt = 100000 - find(after, "e").currentHP;
    const single = act(teams, e, e.skills[0], find(teams, "a"));
    expect(dealt).toBeGreaterThan(0);
    expect(100000 - find(single, "e").currentHP).toBe(dealt);
  });

  it("does not counter when the only ally attacked falls (his answer, 2026-10-02)", () => {
    const teams = stanced(1, [dummy("a", "player", { currentHP: 1 })]);
    const e = find(teams, "e");
    const after = act(teams, e, e.skills[0], find(teams, "a"));
    expect(find(after, "a").currentHP).toBe(0);
    expect(find(after, "e").currentHP).toBe(100000);
  });

  it("counters an attack the ally evaded (his answer, 2026-10-02)", () => {
    const dodger = dummy("a", "player", {
      buffs: [{ type: "buff", stat: "evade", valuePercent: 100, uncancellable: true }],
    });
    const teams = stanced(1, [dodger]);
    const e = find(teams, "e");
    const after = executeSkill(
      { sourceInstanceId: "e", skill: e.skills[0], targetInstanceId: "a", rank: 1 },
      teams,
      log,
      0,
      () => 0,
    );
    expect(find(after, "a").currentHP).toBe(100000);
    expect(find(after, "e").currentHP).toBeLessThan(100000);
  });

  it("Debuff Immunity is a stance part: cancelStances takes it, cancelBuffs does not", () => {
    const teams = stanced(3);
    const e = find(teams, "e");
    const cancel = (type: string) =>
      ({ ...e.skills[0], skillName: type, mechanics: [{ type }] }) as SkillCard;
    const afterBuffs = act(teams, e, cancel("cancelBuffs"), find(teams, "green_duke"));
    expect(find(afterBuffs, "green_duke").buffs.some((b) => b.debuffImmune)).toBe(true);
    const afterStances = act(teams, e, cancel("cancelStances"), find(teams, "green_duke"));
    expect(find(afterStances, "green_duke").buffs.some((b) => b.debuffImmune)).toBe(false);
  });

  it("bonds by NAME: any Lyra gives DEF +50%, Batra ATK +50%", async () => {
    const teams = await runPhase(
      {
        playerTeam: [unit("green_duke", "player"), unit("blue_lyra", "player"), unit("batra", "player")],
        enemyTeam: [dummy("e", "enemy")],
      },
      "OnBattleStart",
    );
    const bonds = find(teams, "green_duke").buffs.filter((b) => b.name?.startsWith("Confluence ("));
    expect(bonds.map((b) => [b.stat, b.valuePercent, b.uncancellable])).toEqual([
      ["def", 50, true],
      ["atk", 50, true],
    ]);
    const alone = await runPhase(
      { playerTeam: [unit("green_duke", "player")], enemyTeam: [dummy("e", "enemy")] },
      "OnBattleStart",
    );
    expect(find(alone, "green_duke").buffs).toHaveLength(0);
  });

  it("each stance skill used raises basic stats 5%, capped at 25%", () => {
    let teams: Teams = { playerTeam: [unit("green_duke", "player")], enemyTeam: [dummy("e", "enemy")] };
    const baseHp = find(teams, "green_duke").hp;
    for (let i = 0; i < 6; i++) {
      const duke = find(teams, "green_duke");
      teams = act(teams, duke, duke.skills[1], duke);
    }
    const duke = find(teams, "green_duke");
    expect(duke.buffs.find((b) => b.name === "Confluence")?.valuePercent).toBe(25);
    // Baked one step at a time, and each step floors: within a point a step.
    expect(Math.abs(duke.hp - baseHp * 1.25)).toBeLessThanOrEqual(5);
  });
});
