import { describe, expect, it } from "vitest";
import {
  LIMITED_GEM_COST,
  MULTI_PULL_COUNT,
  limitedBarGain,
  limitedGemCost,
  permanentTicketCost,
} from "@/lib/gacha/cost";
import {
  LIMITED_MILESTONE_FINAL,
  LIMITED_MILESTONE_FIRST,
} from "@/lib/gacha/milestone";

/** Pricing ruled 2026-08-11: 5 gems a single, 50 a multi, progress 1:1. */
describe("pull pricing", () => {
  it("charges 5 for a single and 50 for anything larger", () => {
    expect(limitedGemCost(1)).toBe(5);
    expect(limitedGemCost(MULTI_PULL_COUNT)).toBe(50);
  });

  it("moves the bar by exactly what it charged", () => {
    expect(limitedBarGain(1)).toBe(limitedGemCost(1));
    expect(limitedBarGain(MULTI_PULL_COUNT)).toBe(
      limitedGemCost(MULTI_PULL_COUNT),
    );
  });

  it("gives the multi eleven pulls for the price of ten", () => {
    expect(LIMITED_GEM_COST.multi).toBe(LIMITED_GEM_COST.single * 10);
    expect(MULTI_PULL_COUNT).toBe(11);
  });

  it("keeps permanent on tickets, untouched by the gem pricing", () => {
    expect(permanentTicketCost(1)).toBe(1);
    expect(permanentTicketCost(MULTI_PULL_COUNT)).toBe(10);
  });
});

describe("milestones against the price", () => {
  it("costs the same to reach a milestone by singles or by multis", () => {
    // If these diverged, one pull size would be strictly better for reaching
    // rewards and the other would only ever be a mistake.
    const bySingles =
      (LIMITED_MILESTONE_FINAL / limitedBarGain(1)) * limitedGemCost(1);
    const byMultis =
      (LIMITED_MILESTONE_FINAL / limitedBarGain(MULTI_PULL_COUNT)) *
      limitedGemCost(MULTI_PULL_COUNT);
    expect(bySingles).toBe(byMultis);
    expect(bySingles).toBe(1000);
  });

  it("puts the first milestone exactly halfway along the track", () => {
    expect(LIMITED_MILESTONE_FIRST * 2).toBe(LIMITED_MILESTONE_FINAL);
  });

  it("lands on both milestones exactly, never overshooting into them", () => {
    // A multi that stepped past a threshold without landing on it would make
    // the "N to go" readout lie by up to a full pull.
    expect(LIMITED_MILESTONE_FIRST % limitedBarGain(MULTI_PULL_COUNT)).toBe(0);
    expect(LIMITED_MILESTONE_FINAL % limitedBarGain(MULTI_PULL_COUNT)).toBe(0);
  });
});
