import { describe, expect, it } from "vitest";
import {
  classifyExit,
  mergePartnerIds,
  removedCardIds,
} from "@/lib/game/handTransition";
import { moveCardById } from "@/lib/game/deck";
import type { ActionCard } from "@/types/action";

/**
 * The rules the hand's animation reads (2026-08-12).
 *
 * A card that stops being rendered looks identical whether it merged or was
 * played — the DOM has no opinion. Getting this wrong doesn't crash anything,
 * it just plays the wrong animation, which is exactly the class of bug that
 * survives to production. Hence tests.
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

describe("classifyExit", () => {
  it("calls it a merge when a twin gained exactly one rank", () => {
    const before = [card("a", "u1", "Cleave"), card("b", "u1", "Cleave")];
    const after = [card("a", "u1", "Cleave", 2)];
    expect(classifyExit(before[1], before, after)).toEqual({
      kind: "merged",
      intoCardId: "a",
    });
  });

  it("calls it a departure when the card was played", () => {
    const before = [card("a", "u1", "Cleave"), card("b", "u1", "Guard")];
    const after = [card("a", "u1", "Cleave")];
    expect(classifyExit(before[1], before, after)).toEqual({ kind: "left" });
  });

  it("does not mistake a same-name card from another unit for the eater", () => {
    // Two units can share a skill name. Merging is per-unit, so Lyra's Cleave
    // ranking up has nothing to do with Duke's Cleave leaving.
    const before = [
      card("a", "lyra", "Cleave"),
      card("b", "lyra", "Cleave"),
      card("c", "duke", "Cleave"),
    ];
    const after = [card("a", "lyra", "Cleave", 2), card("c", "duke", "Cleave")];
    expect(classifyExit(before[1], before, after)).toEqual({
      kind: "merged",
      intoCardId: "a",
    });
    // Duke's card leaving while Lyra's ranks up is still just a departure.
    const afterPlayed = [card("a", "lyra", "Cleave", 2)];
    expect(classifyExit(before[2], before, afterPlayed)).toEqual({
      kind: "left",
    });
  });

  it("ignores a card that was already at that rank", () => {
    // A hand can hold an R2 that had nothing to do with this merge. Matching
    // on rank alone would fly the ghost into the wrong card.
    const before = [
      card("bystander", "u1", "Cleave", 2),
      card("a", "u1", "Guard"),
      card("b", "u1", "Guard"),
    ];
    const after = [card("bystander", "u1", "Cleave", 2), card("a", "u1", "Guard", 2)];
    expect(classifyExit(before[2], before, after)).toEqual({
      kind: "merged",
      intoCardId: "a",
    });
  });
});

describe("removedCardIds", () => {
  it("lists departures in the order they sat in the hand", () => {
    const before = [
      card("a", "u1", "Cleave"),
      card("b", "u1", "Guard"),
      card("c", "u1", "Ward"),
    ];
    const after = [card("b", "u1", "Guard")];
    expect(removedCardIds(before, after)).toEqual(["a", "c"]);
  });

  it("is empty when only a rank changed", () => {
    const before = [card("a", "u1", "Cleave")];
    const after = [card("a", "u1", "Cleave", 2)];
    expect(removedCardIds(before, after)).toEqual([]);
  });
});

describe("mergePartnerIds", () => {
  it("only lights cards that would actually merge", () => {
    const hand = [
      card("a", "u1", "Cleave"),
      card("b", "u1", "Cleave"),
      card("c", "u1", "Cleave", 2), // same skill, wrong rank
      card("d", "u2", "Cleave"), // same skill, wrong unit
      card("e", "u1", "Guard"),
    ];
    expect(mergePartnerIds(hand[0], hand)).toEqual(["b"]);
  });

  it("never lists the held card itself", () => {
    const hand = [card("a", "u1", "Cleave"), card("b", "u1", "Cleave")];
    expect(mergePartnerIds(hand[0], hand)).not.toContain("a");
  });

  it("lights nothing at max rank", () => {
    const hand = [card("a", "u1", "Cleave", 3), card("b", "u1", "Cleave", 3)];
    expect(mergePartnerIds(hand[0], hand)).toEqual([]);
  });
});

describe("drag preview matches the commit", () => {
  it("lands the card where the preview showed it, in both directions", () => {
    // The hand previews a drag with the same function the store commits with,
    // so this is really a guard against that ever diverging.
    const hand = [
      card("a", "u1", "One"),
      card("b", "u1", "Two"),
      card("c", "u1", "Three"),
    ];
    expect(moveCardById(hand, "a", "c").map((c) => c.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(moveCardById(hand, "c", "a").map((c) => c.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("seats a dropped card next to its target, which is what makes the merge happen", () => {
    const hand = [
      card("a", "u1", "Cleave"),
      card("x", "u1", "Guard"),
      card("b", "u1", "Cleave"),
    ];
    const dropped = moveCardById(hand, "a", "b").map((c) => c.id);
    const left = dropped.indexOf("a");
    const right = dropped.indexOf("b");
    expect(Math.abs(left - right)).toBe(1);
  });

  it("is a no-op on itself", () => {
    const hand = [card("a", "u1", "One"), card("b", "u1", "Two")];
    expect(moveCardById(hand, "a", "a")).toBe(hand);
  });
});
