import { describe, expect, it } from "vitest";
import {
  applyAdjacentMerges,
  maxHandCapacity,
  refillHand,
} from "@/lib/game/deck";
import type { ActionCard } from "@/types/action";
import type { BattleCharacter } from "@/types/character";

/**
 * The deal, frame by frame (2026-08-12).
 *
 * `refillHand` draws and merges in one pass, so a card that merged the moment
 * it landed was never in a hand any component could render — there was
 * literally nothing to animate. `steps` hands back the intermediate hands.
 *
 * These tests pin the properties the UI depends on. Get any of them wrong and
 * the animation desyncs from the truth it is supposed to be showing, which is
 * worse than no animation at all.
 */

function card(
  id: string,
  source: string,
  skillName: string,
  rank: 1 | 2 | 3 = 1,
): ActionCard {
  return {
    id,
    sourceInstanceId: source,
    rank,
    skill: {
      skillName,
      type: "attack",
      damageRanked: [100, 150, 200],
      description: "",
    } as ActionCard["skill"],
  };
}

/** A unit with a single skill, so the refill pool is deterministic: every
 *  draw is the same card, which means every draw after the first merges. */
function oneSkillUnit(instanceId: string, skillName: string): BattleCharacter {
  return {
    instanceId,
    id: instanceId,
    name: instanceId,
    color: "red",
    hp: 3000,
    currentHP: 3000,
    atk: 200,
    def: 100,
    ultGauge: 0,
    isSub: false,
    buffs: [],
    debuffs: [],
    skills: [
      {
        skillName,
        type: "attack",
        damageRanked: [100, 150, 200],
        description: "",
      },
    ],
  } as unknown as BattleCharacter;
}

describe("applyAdjacentMerges steps", () => {
  it("records nothing when nothing merges", () => {
    const hand = [card("a", "u1", "Cleave"), card("b", "u1", "Guard")];
    const result = applyAdjacentMerges(hand);
    expect(result.mergeCount).toBe(0);
    expect(result.steps).toEqual([]);
  });

  it("records one frame per merge, and the last frame is the settled hand", () => {
    // Three identical R1s: the first two merge to R2, then that R2 has no
    // partner, so exactly one merge happens.
    const hand = [
      card("a", "u1", "Cleave"),
      card("b", "u1", "Cleave"),
      card("c", "u1", "Guard"),
    ];
    const result = applyAdjacentMerges(hand);
    expect(result.mergeCount).toBe(1);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[result.steps.length - 1]).toEqual(result.deck);
  });

  it("records the cascade one frame at a time", () => {
    // R1 R1 R1 R1 → merge to R2 R1 R1 → R2 R2 → R3. Four cards, three merges,
    // three frames — the UI can play each collision separately.
    const hand = [
      card("a", "u1", "Cleave"),
      card("b", "u1", "Cleave"),
      card("c", "u1", "Cleave"),
      card("d", "u1", "Cleave"),
    ];
    const result = applyAdjacentMerges(hand);
    expect(result.mergeCount).toBe(3);
    expect(result.steps).toHaveLength(3);
    expect(result.steps.map((s) => s.length)).toEqual([3, 2, 1]);
    expect(result.deck[0].rank).toBe(3);
  });

  it("hands back copies, not the live array", () => {
    // The frames are held across animation ticks. If they aliased the working
    // array every frame would show the final hand.
    const hand = [
      card("a", "u1", "Cleave"),
      card("b", "u1", "Cleave"),
      card("c", "u1", "Cleave"),
      card("d", "u1", "Cleave"),
    ];
    const result = applyAdjacentMerges(hand);
    expect(result.steps[0]).not.toBe(result.steps[1]);
    expect(result.steps[0]).toHaveLength(3);
  });
});

describe("refillHand steps", () => {
  const unit = oneSkillUnit("u1", "Cleave");

  it("ends on the same hand it returns", () => {
    const result = refillHand({
      hand: [],
      livingUnits: [unit],
      maxCapacity: 4,
      reservedCards: [],
    });
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps[result.steps.length - 1]).toEqual(result.deck);
  });

  it("shows every drawn card before it merges", () => {
    // One skill in the pool means draw 2 always merges into draw 1. The frame
    // where both exist is the whole point: it is the collision.
    const result = refillHand({
      hand: [],
      livingUnits: [unit],
      maxCapacity: 4,
      reservedCards: [],
    });
    const grew = result.steps.some(
      (step, i) => i > 0 && step.length > result.steps[i - 1].length,
    );
    const shrank = result.steps.some(
      (step, i) => i > 0 && step.length < result.steps[i - 1].length,
    );
    expect(grew).toBe(true);
    expect(shrank).toBe(true);
  });

  it("never skips a frame — each step moves the hand by exactly one card", () => {
    const result = refillHand({
      hand: [card("seed", "u1", "Guard")],
      livingUnits: [unit],
      maxCapacity: 5,
      reservedCards: [],
    });
    let previous = 1; // the seeded hand
    for (const step of result.steps) {
      expect(Math.abs(step.length - previous)).toBe(1);
      previous = step.length;
    }
  });

  it("records nothing when the hand is already full", () => {
    const full = [
      card("a", "u1", "Cleave"),
      card("b", "u1", "Guard"),
      card("c", "u1", "Ward"),
      card("d", "u1", "Mend"),
    ];
    const result = refillHand({
      hand: full,
      livingUnits: [unit],
      maxCapacity: maxHandCapacity(1),
      reservedCards: [],
    });
    expect(result.steps).toEqual([]);
    expect(result.deck).toEqual(full);
  });

  it("reports the same merge count the frames show", () => {
    const result = refillHand({
      hand: [],
      livingUnits: [unit],
      maxCapacity: 6,
      reservedCards: [],
    });
    const shrinks = result.steps.filter(
      (step, i) => i > 0 && step.length < result.steps[i - 1].length,
    ).length;
    expect(shrinks).toBe(result.mergeCount);
  });
});
