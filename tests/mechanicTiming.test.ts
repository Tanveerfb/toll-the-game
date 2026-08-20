import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import type { BattleCharacter } from "@/types/character";
import type { CharacterSkillData } from "@/lib/game/characterCatalog";

/**
 * Part B of Plans/2026-08-20-mechanic-application.md — a self buff that lands
 * AFTER the hit, and only if the hit connected.
 *
 * Tanveer, 2026-08-20: *"damage needs to be done to enemy first before the
 * self buff activates. it is different than buff first and then do damage."*
 * The default stays ruling #22 ("buff first, hit boosted"), so every shipped
 * kit is unaffected.
 */
const mk = (
  id: string,
  team: "player" | "enemy",
  overrides: Partial<BattleCharacter> = {},
) =>
  ({
    id,
    instanceId: id,
    name: id,
    team,
    color: "blue",
    atk: 200,
    def: 100,
    hp: 3000,
    currentHP: 3000,
    currentAttack: 200,
    currentDefense: 100,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    lifestealPercent: 0,
    ...overrides,
  }) as unknown as BattleCharacter;

const defScaler = (requiresDamage: boolean, aoe = false): CharacterSkillData =>
  ({
    skillName: "Guard Break",
    characterId: "a",
    type: "attack",
    statMultiplier: "def",
    damageRanked: [500, 500, 500],
    mechanics: [
      ...(aoe ? [{ type: "aoe" }] : []),
      {
        type: "buff",
        stat: "def",
        valuePercent: 30,
        duration: 3,
        targetSelf: true,
        ...(requiresDamage ? { requiresDamage: true } : {}),
      },
    ],
  }) as unknown as CharacterSkillData;

function run(skill: CharacterSkillData, enemies: BattleCharacter[]) {
  return executeSkill(
    {
      sourceInstanceId: "caster",
      skill: skill as never,
      targetInstanceId: enemies[0].instanceId,
      rank: 1,
    },
    { playerTeam: [mk("caster", "player")], enemyTeam: enemies },
    () => {},
  );
}

describe("requiresDamage — the self buff lands after the hit", () => {
  it("does not feed its own strike, which is the whole feature", () => {
    const eager = run(defScaler(false), [mk("foe", "enemy")]);
    const delayed = run(defScaler(true), [mk("foe", "enemy")]);
    const eagerHit = 3000 - eager.enemyTeam[0].currentHP;
    const delayedHit = 3000 - delayed.enemyTeam[0].currentHP;
    expect(delayedHit).toBeLessThan(eagerHit);
    // Both still grant the buff — only the ordering differs.
    expect(delayed.playerTeam[0].buffs).toHaveLength(1);
    expect(eager.playerTeam[0].buffs).toHaveLength(1);
  });

  it("applies exactly once on an AoE that hits three enemies", () => {
    const result = run(defScaler(true, true), [
      mk("a", "enemy"),
      mk("b", "enemy"),
      mk("c", "enemy"),
    ]);
    expect(result.playerTeam[0].buffs).toHaveLength(1);
    expect(result.enemyTeam.every((e) => e.currentHP < 3000)).toBe(true);
  });

  it("still applies when only one of several targets connects", () => {
    // Two dodge, one does not.
    const dodger = () =>
      mk("x", "enemy", {
        buffs: [{ type: "buff", stat: "evade", valuePercent: 100 }],
      } as Partial<BattleCharacter>);
    const result = run(defScaler(true, true), [
      { ...dodger(), instanceId: "a", name: "a" } as BattleCharacter,
      { ...dodger(), instanceId: "b", name: "b" } as BattleCharacter,
      mk("c", "enemy"),
    ]);
    expect(result.playerTeam[0].buffs).toHaveLength(1);
  });

  it("grants nothing when the hit is evaded", () => {
    const evasive = mk("foe", "enemy", {
      buffs: [{ type: "buff", stat: "evade", valuePercent: 100 }],
    } as Partial<BattleCharacter>);
    const result = run(defScaler(true), [evasive]);
    expect(result.playerTeam[0].buffs).toEqual([]);
    // The unflagged form still lands, because it never asked about the hit.
    const unflagged = run(defScaler(false), [
      mk("foe", "enemy", {
        buffs: [{ type: "buff", stat: "evade", valuePercent: 100 }],
      } as Partial<BattleCharacter>),
    ]);
    expect(unflagged.playerTeam[0].buffs).toHaveLength(1);
  });

  it("counts a hit that kills the target", () => {
    const frail = mk("foe", "enemy", { currentHP: 1, hp: 3000 });
    const result = run(defScaler(true), [frail]);
    expect(result.enemyTeam[0].currentHP).toBe(0);
    expect(result.playerTeam[0].buffs).toHaveLength(1);
  });
});
