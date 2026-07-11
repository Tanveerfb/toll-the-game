import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import { calculateDamage } from "@/lib/game/damage";
import {
  getDamageDealtMultiplier,
  getDamageReductionMultiplier,
} from "@/lib/game/stats";
import { enemyActionsForTurn } from "@/lib/game/ai";
import { registerCharacterPassives } from "@/lib/game/passive";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import serasData from "@/data/characters/seras.json";
import saraData from "@/data/characters/sara.json";
import yalinaData from "@/data/characters/yalina.json";
import leorioData from "@/data/characters/leorio.json";

const noopLog = () => {};

function makeChar(
  overrides: Partial<BattleCharacter> & { instanceId: string },
): BattleCharacter {
  return {
    id: overrides.instanceId,
    name: overrides.instanceId,
    color: "blue",
    atk: 100,
    def: 0,
    hp: 1000,
    skills: [],
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 0,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team: "player",
    ...overrides,
  } as BattleCharacter;
}

function fromData(
  raw: unknown,
  team: "player" | "enemy",
  instanceId: string,
  isSub = false,
): BattleCharacter {
  const data = raw as BattleCharacter;
  return {
    ...data,
    instanceId,
    currentAttack: data.atk,
    currentDefense: data.def,
    currentHP: data.hp,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team,
    isSub,
  } as BattleCharacter;
}

const plainAttack: SkillCard = {
  skillName: "Plain Hit",
  characterId: "unit",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [100, 150, 200],
};

const extortSkill: SkillCard = {
  skillName: "Snatch",
  characterId: "thief",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [50, 75, 100],
  mechanics: [{ type: "extort", value: 30, duration: 3 }],
} as SkillCard;

// Mimic MechanicProvider.processQueue for one phase (incl. the
// dead-source skip and the runWhenDead escape hatch)
async function runPhase(
  items: {
    phase: string;
    sourceInstanceId: string;
    runWhenDead?: boolean;
    action: (
      source: BattleCharacter,
      teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
      log: (entry: string) => void,
    ) => Promise<{
      playerTeam: BattleCharacter[];
      enemyTeam: BattleCharacter[];
    }>;
  }[],
  phase: string,
  teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
) {
  let currentTeams = { ...teams };
  for (const item of items.filter((q) => q.phase === phase)) {
    const source =
      currentTeams.playerTeam.find(
        (c) => c.instanceId === item.sourceInstanceId,
      ) ||
      currentTeams.enemyTeam.find(
        (c) => c.instanceId === item.sourceInstanceId,
      );
    if (source && (source.currentHP > 0 || item.runWhenDead)) {
      currentTeams = await item.action(source, currentTeams, noopLog);
    }
  }
  return currentTeams;
}

describe("synergies apply battle-wide (playtest 2026-07-11, match 2)", () => {
  it("tag synergies reach subs, enemies, and every carrier — named [tag] Synergy", async () => {
    const players = [
      makeChar({ instanceId: "p1" }),
      fromData(leorioData, "player", "p4_leorio", true),
    ];
    const enemies = [
      fromData(serasData, "enemy", "e1_seras"),
      fromData(saraData, "enemy", "e2_sara"),
      fromData(yalinaData, "enemy", "e3_yalina"),
    ];
    const items: Parameters<typeof runPhase>[0] = [];
    [...players, ...enemies].forEach((c) =>
      registerCharacterPassives(c, (item) => items.push(item)),
    );

    const teams = await runPhase(items, "OnBattleStart", {
      playerTeam: players,
      enemyTeam: enemies,
    });

    // Leorio's [Collab] synergy self-applies even from the bench
    const leorio = teams.playerTeam[1];
    expect(
      leorio.buffs.some((b) => b.name === "[Collab] Synergy"),
    ).toBe(true);

    // Seras: her own [Powerful Opponent] + Sara's [Female]
    const seras = teams.enemyTeam[0];
    expect(
      seras.buffs.some((b) => b.name === "[Powerful Opponent] Synergy"),
    ).toBe(true);
    expect(seras.buffs.some((b) => b.name === "[Female] Synergy")).toBe(true);

    // Sara + Yalina each carry the [Female] synergy; per-carrier scaling
    // (ruling #35): 5% x 3 Females = 15%, typed "buff" (not "amplify")
    for (const unit of [teams.enemyTeam[1], teams.enemyTeam[2]]) {
      const female = unit.buffs.find((b) => b.name === "[Female] Synergy");
      expect(female).toBeDefined();
      expect(female!.type).toBe("buff");
      expect(female!.valuePercent).toBe(15);
    }
  });
});

describe("Momentum gating (ruling #34)", () => {
  const yalinaPassive = (yalinaData as { passive: unknown })
    .passive as BattleCharacter["passive"];

  it("benched Yalina gains no Momentum from ally cards", () => {
    const attacker = makeChar({ instanceId: "ally", skills: [plainAttack, plainAttack] as never });
    const yalina = makeChar({
      instanceId: "yalina",
      isSub: true,
      passive: yalinaPassive,
    });
    const enemy = makeChar({ instanceId: "foe", team: "enemy" });

    const teams = executeSkill(
      {
        sourceInstanceId: "ally",
        skill: plainAttack,
        targetInstanceId: "foe",
      },
      { playerTeam: [attacker, yalina], enemyTeam: [enemy] },
      noopLog,
    );
    expect(teams.playerTeam[1].passiveState.momentumStacks ?? 0).toBe(0);
  });

  it("field Yalina gains Momentum from ally cards AND her own", () => {
    const attacker = makeChar({ instanceId: "ally" });
    const yalina = makeChar({
      instanceId: "yalina",
      passive: yalinaPassive,
    });
    const enemy = makeChar({ instanceId: "foe", team: "enemy", hp: 100000, currentHP: 100000 });

    // Ally card: +1
    let teams = executeSkill(
      {
        sourceInstanceId: "ally",
        skill: plainAttack,
        targetInstanceId: "foe",
      },
      { playerTeam: [attacker, yalina], enemyTeam: [enemy] },
      noopLog,
    );
    expect(teams.playerTeam[1].passiveState.momentumStacks).toBe(1);

    // Her own non-attack card also grants a stack (any card played)
    const buffSkill: SkillCard = {
      skillName: "Own Buff",
      characterId: "yalina",
      type: "buff",
      statMultiplier: "def",
      damageRanked: [0, 0, 0],
      mechanics: [
        { type: "buff", stat: "def", valuePercent: 10, duration: 1, targetSelf: true },
      ],
    } as SkillCard;
    teams = executeSkill(
      {
        sourceInstanceId: "yalina",
        skill: buffSkill,
        targetInstanceId: "yalina",
      },
      teams,
      noopLog,
    );
    expect(teams.playerTeam[1].passiveState.momentumStacks).toBe(2);
  });

  it("dead Yalina gains nothing", () => {
    const attacker = makeChar({ instanceId: "ally" });
    const yalina = makeChar({
      instanceId: "yalina",
      currentHP: 0,
      passive: yalinaPassive,
    });
    const enemy = makeChar({ instanceId: "foe", team: "enemy" });

    const teams = executeSkill(
      {
        sourceInstanceId: "ally",
        skill: plainAttack,
        targetInstanceId: "foe",
      },
      { playerTeam: [attacker, yalina], enemyTeam: [enemy] },
      noopLog,
    );
    expect(teams.playerTeam[1].passiveState.momentumStacks ?? 0).toBe(0);
  });
});

describe("Extort overwrites, never stacks (ruling #38)", () => {
  it("recasting replaces the victim's Extort debuffs instead of stacking", () => {
    const thief = makeChar({ instanceId: "thief" });
    const victim = makeChar({
      instanceId: "victim",
      team: "enemy",
      hp: 100000,
      currentHP: 100000,
      def: 50,
      currentDefense: 50,
    });

    let teams = { playerTeam: [thief], enemyTeam: [victim] };
    for (let i = 0; i < 3; i++) {
      teams = executeSkill(
        {
          sourceInstanceId: "thief",
          skill: extortSkill,
          targetInstanceId: "victim",
        },
        teams,
        noopLog,
      );
    }

    // Exactly one ATK + one DEF Extort debuff — not three pairs
    const extortDebuffs = teams.enemyTeam[0].debuffs.filter(
      (d) => d.name === "Extort",
    );
    expect(extortDebuffs).toHaveLength(2);
    // Self-buff also a single fresh pair
    const extortBuffs = teams.playerTeam[0].buffs.filter(
      (b) => b.name === "Extort",
    );
    expect(extortBuffs).toHaveLength(2);
  });
});

describe("damage-modifier stats consumed multiplicatively (ruling #36)", () => {
  it("damageReduction sources multiply: 40% + 40% => x0.36 incoming", () => {
    const target = makeChar({
      instanceId: "t",
      team: "enemy",
      buffs: [
        { type: "stance", stat: "damageReduction", valuePercent: 40 },
        { type: "buff", stat: "damageReduction", valuePercent: 40 },
      ] as never,
    });
    expect(getDamageReductionMultiplier(target)).toBeCloseTo(0.36);
    const damage = calculateDamage({
      baseDamage: 100,
      skillMechanics: [],
      target,
    });
    expect(damage).toBeCloseTo(36);
  });

  it("attacker damageDealt raises outgoing damage: +15% => x1.15", () => {
    const attacker = makeChar({
      instanceId: "a",
      buffs: [
        {
          type: "buff",
          stat: "damageDealt",
          valuePercent: 15,
          uncancellable: true,
          name: "[Female] Synergy",
        },
      ] as never,
    });
    const target = makeChar({ instanceId: "t", team: "enemy" });
    expect(getDamageDealtMultiplier(attacker)).toBeCloseTo(1.15);
    const damage = calculateDamage({
      baseDamage: 100,
      skillMechanics: [],
      target,
      attacker,
    });
    expect(damage).toBeCloseTo(115);
  });

  it("Yalina's stance now actually reduces incoming damage", () => {
    const yalina = fromData(yalinaData, "enemy", "e_yalina");
    yalina.buffs.push({
      type: "stance",
      stat: "damageReduction",
      valuePercent: 25,
      buffDuration: 1,
    } as never);
    const damage = calculateDamage({
      baseDamage: 200,
      skillMechanics: [],
      target: yalina,
    });
    const noStance = calculateDamage({
      baseDamage: 200,
      skillMechanics: [],
      target: fromData(yalinaData, "enemy", "e_yalina2"),
    });
    expect(damage).toBeCloseTo(noStance * 0.75);
  });
});

describe("Kind Hearted Friend extra fades even after Leorio dies (ruling #24)", () => {
  it("removes the extra bonus from survivors when the recheck source is dead", async () => {
    // Playtest log 2026-07-11 evening: Gon/Killua/Leorio all died, promoted
    // Lyra kept the +10% extra — the recheck was skipped for a dead source.
    const gonStub = makeChar({ instanceId: "gon" });
    const killuaStub = makeChar({ instanceId: "killua" });
    const leorio = fromData(leorioData, "player", "leorio");
    const bystander = makeChar({ instanceId: "lyra" });

    const items: Parameters<typeof runPhase>[0] = [];
    registerCharacterPassives(leorio, (item) => items.push(item));
    const extraItems = items.filter((i) =>
      i.sourceInstanceId === "leorio" &&
      (i as { mechanicId?: string }).mechanicId?.includes("(extra)"),
    );
    expect(extraItems.length).toBeGreaterThan(0);
    expect(extraItems.every((i) => i.runWhenDead === true)).toBe(true);

    let teams = await runPhase(items, "OnBattleStart", {
      playerTeam: [gonStub, killuaStub, leorio, bystander],
      enemyTeam: [],
    });
    expect(
      teams.playerTeam[3].buffs.some((b) => b.name?.includes("(bond+)")),
    ).toBe(true);

    // Whole trio dies; recheck at the next turn start must still fade it
    for (const id of ["gon", "killua", "leorio"]) {
      const unit = teams.playerTeam.find((c) => c.instanceId === id)!;
      unit.currentHP = 0;
    }
    teams = await runPhase(items, "OnPlayerTurnStart", teams);
    expect(
      teams.playerTeam[3].buffs.some((b) => b.name?.includes("(bond+)")),
    ).toBe(false);
  });
});

describe("zero-value clauses hidden per rank (STATUS #16)", () => {
  it("Killua's stun clause is hidden at rank 1, shown at rank 2+", async () => {
    const { buildDescriptionForRank } = await import(
      "@/lib/game/descriptionTranslator"
    );
    const killua = (await import("@/data/characters/killua.json")).default;
    const lightningPalm = killua.skills[0] as never;

    const r1 = buildDescriptionForRank(lightningPalm, 0);
    expect(r1).not.toMatch(/stun/i);
    expect(r1).not.toMatch(/0 turn/);
    expect(r1).toMatch(/Cancels stances/);

    const r2 = buildDescriptionForRank(lightningPalm, 1);
    expect(r2).toMatch(/stuns for 1 turn/);
    const r3 = buildDescriptionForRank(lightningPalm, 2);
    expect(r3).toMatch(/stuns for 2 turn/);
  });

  it("Diane's Attack Seal clause is hidden at rank 1", async () => {
    const { buildDescriptionForRank } = await import(
      "@/lib/game/descriptionTranslator"
    );
    const diane = (await import("@/data/characters/diane.json")).default;
    const rushRock = diane.skills.find(
      (s: { skillName: string }) => s.skillName === "Rush Rock",
    ) as never;

    const r1 = buildDescriptionForRank(rushRock, 0);
    expect(r1).not.toMatch(/Attack Seal/);
    expect(r1).not.toMatch(/0 turn/);

    const r2 = buildDescriptionForRank(rushRock, 1);
    expect(r2).toMatch(/1 turn Attack Seal/);
  });
});

describe("enemy action count (ruling #39)", () => {
  it("1 action per living field member, capped at 3", () => {
    const full = [
      makeChar({ instanceId: "e1", team: "enemy" }),
      makeChar({ instanceId: "e2", team: "enemy" }),
      makeChar({ instanceId: "e3", team: "enemy" }),
      makeChar({ instanceId: "e4", team: "enemy" }),
    ];
    expect(enemyActionsForTurn(full)).toBe(3);

    const twoLeft = [
      makeChar({ instanceId: "e1", team: "enemy" }),
      makeChar({ instanceId: "e2", team: "enemy" }),
      makeChar({ instanceId: "e3", team: "enemy", currentHP: 0 }),
    ];
    expect(enemyActionsForTurn(twoLeft)).toBe(2);

    const subDoesNotCount = [
      makeChar({ instanceId: "e1", team: "enemy" }),
      makeChar({ instanceId: "e2", team: "enemy", isSub: true }),
    ];
    expect(enemyActionsForTurn(subDoesNotCount)).toBe(1);
  });
});
