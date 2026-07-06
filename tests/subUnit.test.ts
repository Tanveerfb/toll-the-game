import { describe, expect, it } from "vitest";
import { ensureFieldUnit, promoteSubs, isOnField } from "@/lib/game/sub";
import { executeSkill } from "@/lib/game/combat";
import { getAIMove } from "@/lib/game/ai";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";

const noopLog = () => {};

const attack: SkillCard = {
  skillName: "Attack",
  characterId: "x",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [100, 100, 100],
};

const aoeAttack: SkillCard = {
  skillName: "Sweep",
  characterId: "x",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [100, 100, 100],
  mechanics: [{ type: "aoe" }],
};

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
    skills: [attack, aoeAttack] as [SkillCard, SkillCard],
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

describe("sub units", () => {
  it("promoteSubs does nothing while all field units live", () => {
    const team = [
      makeChar({ instanceId: "f1", team: "player" }),
      makeChar({ instanceId: "sub", team: "player", isSub: true }),
    ];
    expect(promoteSubs(team, noopLog)).toBe(team);
  });

  it("promotes an alive sub when an on-field unit dies", () => {
    const team = [
      makeChar({ instanceId: "dead", team: "player", currentHP: 0 }),
      makeChar({ instanceId: "f2", team: "player" }),
      makeChar({ instanceId: "sub", team: "player", isSub: true }),
    ];
    const next = promoteSubs(team, noopLog);
    const sub = next.find((c) => c.instanceId === "sub")!;
    expect(sub.isSub).toBe(false);
    expect(isOnField(sub)).toBe(true);
  });

  it("does not double-promote for the same death on repeated calls", () => {
    const team = [
      makeChar({ instanceId: "dead", team: "player", currentHP: 0 }),
      makeChar({ instanceId: "sub", team: "player", isSub: true }),
    ];
    const once = promoteSubs(team, noopLog);
    // second call with another sub added must not promote it for the SAME death
    const withSecondSub = [
      ...once,
      makeChar({ instanceId: "sub2", team: "player", isSub: true }),
    ];
    const twice = promoteSubs(withSecondSub, noopLog);
    expect(twice.find((c) => c.instanceId === "sub2")!.isSub).toBe(true);
  });

  it("dead subs are never promoted", () => {
    const team = [
      makeChar({ instanceId: "dead", team: "player", currentHP: 0 }),
      makeChar({
        instanceId: "deadSub",
        team: "player",
        isSub: true,
        currentHP: 0,
      }),
    ];
    const next = promoteSubs(team, noopLog);
    expect(next.find((c) => c.instanceId === "deadSub")!.isSub).toBe(true);
  });

  it("AoE attacks do not hit enemy subs", () => {
    const attacker = makeChar({ instanceId: "attacker", team: "player" });
    const field = makeChar({ instanceId: "field", team: "enemy" });
    const bench = makeChar({ instanceId: "bench", team: "enemy", isSub: true });
    const result = executeSkill(
      {
        sourceInstanceId: "attacker",
        skill: aoeAttack,
        targetInstanceId: "field",
      },
      { playerTeam: [attacker], enemyTeam: [field, bench] },
      noopLog,
    );
    expect(result.enemyTeam[0].currentHP).toBe(900);
    expect(result.enemyTeam[1].currentHP).toBe(1000);
  });

  it("AI never picks a sub to act and never targets a sub", () => {
    const enemyField = makeChar({ instanceId: "eField", team: "enemy" });
    const enemySub = makeChar({
      instanceId: "eSub",
      team: "enemy",
      isSub: true,
    });
    const playerField = makeChar({
      instanceId: "pField",
      team: "player",
      currentHP: 500,
    });
    const playerSub = makeChar({
      instanceId: "pSub",
      team: "player",
      isSub: true,
      currentHP: 1, // lowest HP, but benched — must not be targeted
    });

    for (let i = 0; i < 10; i++) {
      const action = getAIMove(
        [enemyField, enemySub],
        [playerField, playerSub],
      );
      expect(action?.sourceInstanceId).toBe("eField");
      expect(action?.targetInstanceId).toBe("pField");
    }
  });

  it("ensureFieldUnit converts a lone sub (or all-sub team) to a field unit", () => {
    expect(ensureFieldUnit([{ id: "a", isSub: true }])).toEqual([
      { id: "a", isSub: false },
    ]);
    expect(
      ensureFieldUnit([
        { id: "a", isSub: true },
        { id: "b", isSub: true },
      ]),
    ).toEqual([
      { id: "a", isSub: false },
      { id: "b", isSub: true },
    ]);
  });

  it("ensureFieldUnit leaves teams with a field unit untouched", () => {
    const picks = [{ id: "a" }, { id: "b", isSub: true }];
    expect(ensureFieldUnit(picks)).toBe(picks);
    expect(ensureFieldUnit([])).toEqual([]);
  });

  it("battle is lost only when subs are dead too (whole team)", () => {
    const team = [
      makeChar({ instanceId: "f1", team: "player", currentHP: 0 }),
      makeChar({ instanceId: "sub", team: "player", isSub: true }),
    ];
    // mirrors BattleProvider's defeat check
    const allDead = team.every((c) => c.currentHP <= 0);
    expect(allDead).toBe(false);
  });
});
