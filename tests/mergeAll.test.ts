import { describe, expect, it } from "vitest";
import { applyAllMerges, hasMergeablePair } from "@/lib/game/deck";
import type { ActionCard } from "@/types/action";

/**
 * Merge All (Tanveer, 2026-09-01) — chosen over an auto-merge toggle.
 *
 * The rule he stated is the one these pin: *"only 1 card merges with 1
 * identical card. so in a case where there are 3 identical cards, 2 merge to
 * form one higher rank and 1 other remains."*
 *
 * That falls out of `canCardsAutoMerge` requiring **equal rank** rather than
 * needing a rule of its own — which is exactly why it is worth a test. A future
 * change loosening that predicate would take the pairing rule with it, silently.
 */
function card(
  id: string,
  sourceInstanceId: string,
  skillName: string,
  rank: 1 | 2 | 3,
): ActionCard {
  return {
    id,
    sourceInstanceId,
    rank,
    skill: { skillName, type: "attack", damageRanked: [100, 200, 300] },
  } as unknown as ActionCard;
}

const A = (id: string, rank: 1 | 2 | 3 = 1) => card(id, "u1", "Static Lance", rank);
const B = (id: string, rank: 1 | 2 | 3 = 1) => card(id, "u2", "Chain Tempest", rank);

describe("Merge All settles every pair, one card to one card", () => {
  it("two identical cards become one of the next rank", () => {
    const r = applyAllMerges([A("a"), A("b")]);
    expect(r.deck).toHaveLength(1);
    expect(r.deck[0].rank).toBe(2);
    expect(r.mergeCount).toBe(1);
  });

  it("three identical cards leave one behind — his rule, stated", () => {
    const r = applyAllMerges([A("a"), A("b"), A("c")]);
    expect(r.mergeCount).toBe(1);
    expect(r.deck.map((c) => c.rank).sort()).toEqual([1, 2]);
  });

  it("four cascade to a single R3", () => {
    // Two pairs make two R2s, which then meet. The adjacent pass cascades the
    // same way by stepping back over a fresh merge, so this matches the
    // automatic behaviour rather than inventing a second one.
    const r = applyAllMerges([A("a"), A("b"), A("c"), A("d")]);
    expect(r.deck).toHaveLength(1);
    expect(r.deck[0].rank).toBe(3);
    expect(r.mergeCount).toBe(3);
  });

  it("merges pairs that are not adjacent, which is the whole point", () => {
    // The automatic pass would leave these alone: B sits between them.
    const r = applyAllMerges([A("a"), B("x"), A("b")]);
    expect(r.mergeCount).toBe(1);
    expect(r.deck).toHaveLength(2);
    expect(r.deck.find((c) => c.sourceInstanceId === "u1")?.rank).toBe(2);
  });

  it("never merges across owners, skills or ranks", () => {
    expect(applyAllMerges([A("a"), B("x")]).mergeCount).toBe(0);
    expect(applyAllMerges([A("a", 1), A("b", 2)]).mergeCount).toBe(0);
    expect(
      applyAllMerges([card("a", "u1", "Static Lance", 1), card("b", "u1", "Snatch", 1)])
        .mergeCount,
    ).toBe(0);
  });

  it("stops at R3 and does not consume a card doing it", () => {
    const r = applyAllMerges([A("a", 3), A("b", 3)]);
    expect(r.mergeCount).toBe(0);
    expect(r.deck).toHaveLength(2);
  });

  it("banks one gauge point per merge, against the owner", () => {
    const r = applyAllMerges([A("a"), A("b"), A("c"), A("d"), B("x"), B("y")]);
    // Three merges for the u1 cascade, one for the u2 pair.
    expect(r.mergeSourceIds.filter((id) => id === "u1")).toHaveLength(3);
    expect(r.mergeSourceIds.filter((id) => id === "u2")).toHaveLength(1);
    expect(r.mergeCount).toBe(4);
  });

  it("emits a frame per merge, so the UI can animate them", () => {
    const r = applyAllMerges([A("a"), A("b"), A("c"), A("d")]);
    expect(r.steps).toHaveLength(r.mergeCount);
    expect(r.steps.at(-1)).toEqual(r.deck);
  });

  it("leaves an unmergeable hand untouched, by identity", () => {
    // Returning a fresh array would make every caller re-render for nothing.
    const hand = [A("a"), B("x")];
    const r = applyAllMerges(hand);
    expect(r.mergeCount).toBe(0);
    expect(r.deck).toEqual(hand);
  });

  it("hasMergeablePair agrees with what the pass would do", () => {
    // The button's disabled state and the action must not disagree — a live
    // button over a hand that cannot merge, or a dead one over a hand that can,
    // are the two ways this shows up as a bug.
    const hands: ActionCard[][] = [
      [],
      [A("a")],
      [A("a"), B("x")],
      [A("a"), A("b")],
      [A("a"), B("x"), A("b")],
      [A("a", 3), A("b", 3)],
      [A("a", 1), A("b", 2)],
    ];
    for (const hand of hands) {
      expect(hasMergeablePair(hand)).toBe(applyAllMerges(hand).mergeCount > 0);
    }
  });
});
