import { describe, expect, it } from "vitest";
import {
  buildDealTimeline,
  dealDurationMs,
  DEAL_STAGGER_MS,
  MERGE_BEAT_MS,
  MERGE_SETTLE_MS,
} from "@/lib/game/dealTimeline";
import type { ActionCard } from "@/types/action";

/** Only lengths matter here — the timeline classifies frames by whether the
 *  hand grew or shrank, never by what the cards are. */
function hand(size: number): ActionCard[] {
  return Array.from({ length: size }, (_, i) => ({
    id: `c${i}`,
    sourceInstanceId: "u1",
    rank: 1,
    skill: { skillName: "S", type: "attack", damageRanked: [1, 1, 1] },
  })) as ActionCard[];
}

describe("buildDealTimeline", () => {
  it("plays nothing when there is nothing to play", () => {
    expect(buildDealTimeline([])).toEqual([]);
  });

  it("reads a shrinking hand as a merge and a growing one as a draw", () => {
    // 1 card, 2 cards, then they merge back to 1.
    const timeline = buildDealTimeline([hand(1), hand(2), hand(1)]);
    expect(timeline.map((f) => f.kind)).toEqual(["draw", "draw", "merge"]);
  });

  it("gives a card that is about to merge a beat on its own first", () => {
    // Without this the collision starts before the card causing it registers.
    const timeline = buildDealTimeline([hand(1), hand(2), hand(1)]);
    expect(timeline[1].holdMs).toBe(MERGE_BEAT_MS);
    expect(timeline[0].holdMs).toBe(DEAL_STAGGER_MS);
  });

  it("lets a collision finish before the next frame starts", () => {
    const timeline = buildDealTimeline([hand(2), hand(1), hand(2)]);
    expect(timeline[1].kind).toBe("merge");
    expect(timeline[1].holdMs).toBe(MERGE_SETTLE_MS);
  });

  it("ends on the settled hand and holds it for nothing", () => {
    const steps = [hand(1), hand(2), hand(3)];
    const timeline = buildDealTimeline(steps);
    expect(timeline[timeline.length - 1].hand).toBe(steps[steps.length - 1]);
    expect(timeline[timeline.length - 1].holdMs).toBe(0);
  });

  it("scales with battle speed", () => {
    const slow = buildDealTimeline([hand(1), hand(2), hand(3)], { speed: 1 });
    const fast = buildDealTimeline([hand(1), hand(2), hand(3)], { speed: 2 });
    // Per frame, not on the total: each hold rounds to a whole millisecond, so
    // the totals differ from half by the accumulated rounding.
    fast.forEach((frame, i) => {
      expect(frame.holdMs).toBe(Math.round(slow[i].holdMs / 2));
    });
    expect(dealDurationMs(fast)).toBeLessThan(dealDurationMs(slow));
  });

  it("collapses to the settled hand under reduced motion", () => {
    const steps = [hand(1), hand(2), hand(3)];
    const timeline = buildDealTimeline(steps, { reduced: true });
    expect(timeline).toHaveLength(1);
    expect(timeline[0].hand).toBe(steps[steps.length - 1]);
    expect(dealDurationMs(timeline)).toBe(0);
  });

  it("classifies the first frame against the hand the deal started from", () => {
    // A deal opens on a draw by default. Passing the real starting length
    // matters for the case where it didn't.
    expect(buildDealTimeline([hand(3)])[0].kind).toBe("draw");
    expect(buildDealTimeline([hand(3)], { startLength: 4 })[0].kind).toBe(
      "merge",
    );
  });

  it("never schedules a negative or fractional hold", () => {
    const timeline = buildDealTimeline([hand(1), hand(2), hand(1), hand(2)], {
      speed: 3,
    });
    for (const frame of timeline) {
      expect(frame.holdMs).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(frame.holdMs)).toBe(true);
    }
  });
});
