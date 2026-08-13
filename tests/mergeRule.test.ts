import { describe, expect, it } from "vitest";
import { canCardsAutoMerge } from "@/lib/game/deck";
import { mergePartnerIds } from "@/lib/game/handTransition";
import type { ActionCard } from "@/types/action";

/**
 * One merge rule, everywhere (Tanveer, 2026-08-12).
 *
 * There used to be two. Merging by adjacency — the draw's auto-merge, and now
 * dropping one card on another — has always required **equal ranks**. The
 * Merge button did not: it took any card with the same owner and skill name,
 * so an R1 could be consumed by an R2 for the same +1. Two rules for one
 * mechanic, and the hold-to-highlight ring could only ever show one of them.
 *
 * Unified on the strict rule. This file exists so the loose one can't creep
 * back in through whichever path is edited next: every merge path is asserted
 * against the same predicate.
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

describe("the one merge rule", () => {
  it("needs the same owner", () => {
    expect(
      canCardsAutoMerge(card("a", "duke", "Cleave"), card("b", "lyra", "Cleave")),
    ).toBe(false);
  });

  it("needs the same skill", () => {
    expect(
      canCardsAutoMerge(card("a", "duke", "Cleave"), card("b", "duke", "Guard")),
    ).toBe(false);
  });

  it("needs the same rank", () => {
    // The case the button used to allow.
    expect(
      canCardsAutoMerge(
        card("a", "duke", "Cleave", 1),
        card("b", "duke", "Cleave", 2),
      ),
    ).toBe(false);
  });

  it("refuses at max rank", () => {
    expect(
      canCardsAutoMerge(
        card("a", "duke", "Cleave", 3),
        card("b", "duke", "Cleave", 3),
      ),
    ).toBe(false);
  });

  it("accepts a genuine pair", () => {
    expect(
      canCardsAutoMerge(
        card("a", "duke", "Cleave", 2),
        card("b", "duke", "Cleave", 2),
      ),
    ).toBe(true);
  });
});

describe("what the player is shown matches what they can do", () => {
  // The Merge button's visibility, the hold-to-highlight ring and the
  // drop-target glow are all `mergePartnerIds`, which delegates to the
  // predicate above. If a hand offers a merge, the merge must succeed.
  const hand = [
    card("a", "duke", "Cleave", 1),
    card("b", "duke", "Cleave", 1),
    card("c", "duke", "Cleave", 2),
    card("d", "duke", "Guard", 1),
    card("e", "lyra", "Cleave", 1),
  ];

  it("offers exactly the cards that would merge", () => {
    expect(mergePartnerIds(hand[0], hand)).toEqual(["b"]);
  });

  it("offers nothing to a card with no equal-rank twin", () => {
    // `c` is the lone R2 — under the old button rule it could have eaten an R1.
    expect(mergePartnerIds(hand[2], hand)).toEqual([]);
    expect(mergePartnerIds(hand[3], hand)).toEqual([]);
    expect(mergePartnerIds(hand[4], hand)).toEqual([]);
  });

  it("agrees with the predicate for every pair in a hand", () => {
    for (const subject of hand) {
      const offered = new Set(mergePartnerIds(subject, hand));
      for (const other of hand) {
        if (other.id === subject.id) continue;
        expect(offered.has(other.id)).toBe(canCardsAutoMerge(subject, other));
      }
    }
  });
});
