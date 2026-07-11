import { describe, expect, it } from "vitest";
import { trySurviveLethal } from "@/lib/game/lethal";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";

function makeChar(
  overrides: Partial<BattleCharacter> & { instanceId: string },
): BattleCharacter {
  const dummy: SkillCard = {
    skillName: "Dummy",
    characterId: "dummy",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
  };
  return {
    id: overrides.instanceId,
    name: overrides.instanceId,
    color: "red",
    atk: 100,
    def: 0,
    hp: 1000,
    skills: [dummy, dummy] as [SkillCard, SkillCard],
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

const nineLives = {
  name: "Nine Lives",
  trigger: "onLethalDamage",
  mechanics: [
    { type: "surviveLethal", hpConditionPercent: 30, healDamagePercent: 50 },
  ],
};

describe("trySurviveLethal (ruling #29 — revival cleanses everything)", () => {
  it("survives at healDamagePercent of the hit and wipes all buffs and debuffs", () => {
    const sara = makeChar({
      instanceId: "sara",
      currentHP: 500,
      passive: nineLives,
      buffs: [
        { type: "buff", stat: "hp", valuePercent: 20, uncancellable: true },
      ],
      debuffs: [{ type: "stun", debuffDuration: 2 }],
    });
    const heal = trySurviveLethal(sara, 800);
    expect(heal).toBe(400);
    expect(sara.currentHP).toBe(400);
    expect(sara.passiveState.lethalSurvived).toBe(true);
    expect(sara.buffs).toHaveLength(0);
    expect(sara.debuffs).toHaveLength(0);
  });

  it("floors the revival HP at 1", () => {
    const sara = makeChar({
      instanceId: "sara",
      currentHP: 500,
      passive: nineLives,
    });
    expect(trySurviveLethal(sara, 1)).toBe(0);
    expect(sara.currentHP).toBe(1);
  });

  it("returns null below the HP condition, when already used, or without the passive", () => {
    const low = makeChar({
      instanceId: "low",
      currentHP: 200,
      passive: nineLives,
    });
    expect(trySurviveLethal(low, 500)).toBeNull();

    const used = makeChar({
      instanceId: "used",
      currentHP: 500,
      passive: nineLives,
      passiveState: { lethalSurvived: true },
    });
    expect(trySurviveLethal(used, 500)).toBeNull();

    const plain = makeChar({ instanceId: "plain", currentHP: 500 });
    expect(trySurviveLethal(plain, 500)).toBeNull();
  });
});
