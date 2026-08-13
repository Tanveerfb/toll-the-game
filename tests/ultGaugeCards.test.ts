import { describe, expect, it } from "vitest";
import { dropUnchargedUltimates, refillHand } from "@/lib/game/deck";
import { ultGaugeMax } from "@/lib/game/ultGauge";
import type { ActionCard } from "@/types/action";
import type { BattleCharacter } from "@/types/character";

/**
 * An ultimate can't be held below a full gauge (Tanveer, 2026-08-13).
 *
 * Reported from play: Lyra sat at 5/5 with her ultimate in hand, Mustafa
 * drained her to 4/5, and the card stayed — playable at four fifths. The
 * dealing rule (`refillHand`) had always required a full gauge; nothing
 * reconsidered it once the card existed.
 *
 * The card is taken back, not destroyed: the next refill deals it again the
 * moment the gauge fills.
 */

const skill = {
  skillName: "Cleave",
  type: "attack",
  damageRanked: [100, 150, 200],
  description: "",
} as unknown as ActionCard["skill"];

const ultimate = {
  skillName: "Unbreakable Ice",
  type: "ultimate",
  damage: 400,
  description: "",
} as unknown as ActionCard["skill"];

function card(id: string, owner: string, isUlt = false): ActionCard {
  return {
    id,
    sourceInstanceId: owner,
    rank: 1,
    skill: isUlt ? ultimate : skill,
  };
}

function unit(instanceId: string, gauge: number): BattleCharacter {
  return {
    instanceId,
    id: instanceId,
    name: instanceId,
    color: "blue",
    hp: 3600,
    currentHP: 3600,
    atk: 175,
    def: 210,
    ultGauge: gauge,
    isSub: false,
    buffs: [],
    debuffs: [],
    skills: [skill],
    ultimate,
  } as unknown as BattleCharacter;
}

const FULL = ultGaugeMax(unit("probe", 0));

describe("dropUnchargedUltimates", () => {
  it("keeps an ultimate while its owner is fully charged", () => {
    const hand = [card("a", "lyra"), card("ult", "lyra", true)];
    expect(dropUnchargedUltimates(hand, [unit("lyra", FULL)])).toBe(hand);
  });

  it("takes the ultimate back the moment the gauge drops", () => {
    // The reported case, exactly: 5/5 → 4/5.
    const hand = [card("a", "lyra"), card("ult", "lyra", true)];
    const after = dropUnchargedUltimates(hand, [unit("lyra", FULL - 1)]);
    expect(after.map((c) => c.id)).toEqual(["a"]);
  });

  it("leaves ordinary cards alone", () => {
    const hand = [card("a", "lyra"), card("b", "lyra")];
    expect(dropUnchargedUltimates(hand, [unit("lyra", 0)])).toBe(hand);
  });

  it("only drops the drained unit's ultimate, not everyone's", () => {
    const hand = [
      card("lyraUlt", "lyra", true),
      card("dukeUlt", "duke", true),
    ];
    const after = dropUnchargedUltimates(hand, [
      unit("lyra", FULL - 1),
      unit("duke", FULL),
    ]);
    expect(after.map((c) => c.id)).toEqual(["dukeUlt"]);
  });

  it("leaves a card whose owner isn't in the list", () => {
    // A dead unit's cards are `removeDeadCharacterCards`' job; inferring a
    // removal from an absent unit would be the right result for the wrong
    // reason, and would fire on any caller that passes a partial team.
    const hand = [card("ghostUlt", "gone", true)];
    expect(dropUnchargedUltimates(hand, [unit("lyra", FULL)])).toBe(hand);
  });

  it("returns the same array when nothing changed, so callers can skip a commit", () => {
    const hand = [card("a", "lyra"), card("ult", "lyra", true)];
    expect(dropUnchargedUltimates(hand, [unit("lyra", FULL)])).toBe(hand);
  });
});

describe("the card comes back", () => {
  it("is dealt again once the gauge refills", () => {
    // Taking it back is not losing it — this is the other half of the rule.
    const charged = unit("lyra", FULL);
    const result = refillHand({
      hand: [],
      livingUnits: [charged],
      maxCapacity: 4,
      reservedCards: [],
    });
    expect(
      result.deck.some((c) => c.skill.type === "ultimate"),
    ).toBe(true);
  });

  it("is not dealt while the gauge is short", () => {
    const drained = unit("lyra", FULL - 1);
    const result = refillHand({
      hand: [],
      livingUnits: [drained],
      maxCapacity: 4,
      reservedCards: [],
    });
    expect(
      result.deck.some((c) => c.skill.type === "ultimate"),
    ).toBe(false);
  });
});
