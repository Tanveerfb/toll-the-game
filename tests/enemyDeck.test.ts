import { describe, expect, it } from "vitest";
import {
  applyAdjacentMerges,
  initialCardsFor,
  maxHandCapacity,
  refillHand,
} from "@/lib/game/deck";
import { getAIMove } from "@/lib/game/ai";
import type { ActionCard } from "@/types/action";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import type { UltimateCard } from "@/types/ultimateCard";

const attack: SkillCard = {
  skillName: "Slash",
  characterId: "x",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [100, 130, 160],
};
const buff: SkillCard = {
  skillName: "Rally",
  characterId: "x",
  type: "buff",
  statMultiplier: "atk",
  damageRanked: [0, 0, 0],
  mechanics: [{ type: "buff", stat: "atk", valuePercent: 30, duration: 2 }],
};
const ult: UltimateCard = {
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
    skills: [attack, attack] as [SkillCard, SkillCard],
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 0,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team: "enemy",
    isSub: false,
    ...over,
  } as BattleCharacter;
}

function card(sourceInstanceId: string, skill: SkillCard | UltimateCard, rank: 1 | 2 | 3 = 1): ActionCard {
  return {
    id: `${skill.skillName}-${Math.random().toString(36).slice(2, 7)}`,
    sourceInstanceId,
    skill,
    rank,
  };
}

describe("deck module (shared by both sides)", () => {
  it("hand capacity is 4/5/7/8 for 1/2/3/4 field units", () => {
    expect([1, 2, 3, 4].map(maxHandCapacity)).toEqual([4, 5, 7, 8]);
  });

  it("seeds one card per skill of each living unit", () => {
    const cards = initialCardsFor([unit({ instanceId: "e1" })]);
    expect(cards).toHaveLength(2);
    expect(cards.every((c) => c.sourceInstanceId === "e1" && c.rank === 1)).toBe(true);
  });

  it("merges adjacent identical cards up a rank and reports the gauge source", () => {
    const merged = applyAdjacentMerges([card("e1", attack, 1), card("e1", attack, 1)]);
    expect(merged.deck).toHaveLength(1);
    expect(merged.deck[0].rank).toBe(2);
    expect(merged.mergeCount).toBe(1);
    expect(merged.mergeSourceIds).toEqual(["e1"]);
  });

  it("does not merge different skills or maxed cards", () => {
    expect(applyAdjacentMerges([card("e1", attack), card("e1", buff)]).mergeCount).toBe(0);
    expect(applyAdjacentMerges([card("e1", attack, 3), card("e1", attack, 3)]).mergeCount).toBe(0);
  });

  it("refills the hand to capacity", () => {
    const e = unit({ instanceId: "e1", skills: [attack, buff] as [SkillCard, SkillCard] });
    const result = refillHand({ hand: [], livingUnits: [e], maxCapacity: 4, reservedCards: [] });
    expect(result.deck).toHaveLength(4);
    expect(result.deck.every((c) => c.sourceInstanceId === "e1")).toBe(true);
  });

  it("guarantees an ultimate card when the gauge is pre-full", () => {
    const e = unit({ instanceId: "e1", ultGauge: 5, ultimate: ult });
    const result = refillHand({ hand: [], livingUnits: [e], maxCapacity: 4, reservedCards: [] });
    expect(result.deck.some((c) => c.skill.type === "ultimate")).toBe(true);
  });
});

describe("getAIMove — hand-aware (headless enemy deck)", () => {
  const player = () => unit({ instanceId: "p1", team: "player" });

  it("plays a card from the hand, not a skill the unit has but did not draw", () => {
    // Skills are attacks, but the only card in hand is a buff -> plays the buff.
    const e = unit({ instanceId: "e1", skills: [attack, attack] as [SkillCard, SkillCard] });
    const buffCard = card("e1", buff);
    const move = getAIMove([e], [player()], undefined, [buffCard]);
    expect(move?.skill.type).toBe("buff");
    expect(move?.cardId).toBe(buffCard.id);
  });

  it("carries the card's rank into the action", () => {
    const e = unit({ instanceId: "e1" });
    const move = getAIMove([e], [player()], undefined, [card("e1", attack, 3)]);
    expect(move?.rank).toBe(3);
  });

  it("returns null when the only enemy has an empty hand", () => {
    const e = unit({ instanceId: "e1" });
    expect(getAIMove([e], [player()], undefined, [])).toBeNull();
  });

  it("plays an ultimate card in hand first", () => {
    const e = unit({ instanceId: "e1", ultimate: ult });
    const move = getAIMove([e], [player()], undefined, [card("e1", attack), card("e1", ult)]);
    expect(move?.skill.type).toBe("ultimate");
  });

  it("still works skill-based when no hand is passed (legacy path)", () => {
    const e = unit({ instanceId: "e1" });
    const move = getAIMove([e], [player()]);
    expect(move?.skill.type).toBe("attack");
    expect(move?.cardId).toBeUndefined();
  });
});
