import { describe, expect, it } from "vitest";
import { previewCardsFor } from "@/lib/game/deck";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import type { UltimateCard } from "@/types/ultimateCard";

const slash: SkillCard = {
  skillName: "Slash",
  characterId: "x",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [100, 130, 160],
};
const rally: SkillCard = {
  skillName: "Rally",
  characterId: "x",
  type: "buff",
  statMultiplier: "atk",
  damageRanked: [0, 0, 0],
};
const doom: UltimateCard = {
  skillName: "Doom",
  characterId: "x",
  type: "ultimate",
  statMultiplier: "atk",
  damage: 400,
};

function unit(over: Partial<BattleCharacter> & { instanceId: string }): BattleCharacter {
  return {
    id: over.instanceId,
    name: over.instanceId,
    color: "red",
    atk: 100,
    def: 0,
    hp: 1000,
    skills: [slash, rally] as [SkillCard, SkillCard],
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 0,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team: "player",
    isSub: false,
    ...over,
  } as BattleCharacter;
}

describe("previewCardsFor", () => {
  it("exposes every skill at ranks R1/R2/R3 plus the ultimate", () => {
    const cards = previewCardsFor([unit({ instanceId: "p1", ultimate: doom })]);

    // 2 skills x 3 ranks + 1 ultimate = 7 cards
    expect(cards).toHaveLength(7);

    const slashRanks = cards
      .filter((c) => c.skill.skillName === "Slash")
      .map((c) => c.rank)
      .sort();
    expect(slashRanks).toEqual([1, 2, 3]);

    const rallyRanks = cards
      .filter((c) => c.skill.skillName === "Rally")
      .map((c) => c.rank)
      .sort();
    expect(rallyRanks).toEqual([1, 2, 3]);

    const ultCards = cards.filter((c) => c.skill.type === "ultimate");
    expect(ultCards).toHaveLength(1);
    expect(ultCards[0].skill.skillName).toBe("Doom");
  });

  it("omits the ultimate card when the unit has no ultimate", () => {
    const cards = previewCardsFor([unit({ instanceId: "p1" })]);
    expect(cards).toHaveLength(6);
    expect(cards.some((c) => c.skill.type === "ultimate")).toBe(false);
  });

  it("tags every card with the owning unit's instanceId", () => {
    const cards = previewCardsFor([unit({ instanceId: "p1", ultimate: doom })]);
    expect(cards.every((c) => c.sourceInstanceId === "p1")).toBe(true);
  });
});
