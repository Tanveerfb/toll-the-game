import { describe, expect, it } from "vitest";

import {
  COIN_PER_XP,
  XP_PER_MANUAL_TIER,
  highestReachableLevel,
  planLevelUp,
  xpToNext,
} from "@/lib/game/leveling";

/**
 * The target-level solver that replaced feeding one manual per tap.
 *
 * Measured before it was written (2026-09-17): `xpToNext` is `100 * level`, so
 * Lv 20 → 40 is 59,000 XP — 590 basic manuals, 148 advanced or 59 premium, each
 * one a separate press. Lv 20 is the First Ascension Trial's entry requirement,
 * so that grind sat on the critical path of shipped content.
 */

const RICH = 10_000_000;
const ALL: Record<string, number> = {
  training_manual: 1000,
  training_manual_advanced: 1000,
  training_manual_premium: 1000,
};

/** Total XP between two levels, the long way, as a check on the solver. */
function xpBetween(from: number, to: number): number {
  let total = 0;
  for (let level = from; level < to; level += 1) total += xpToNext(level);
  return total;
}

describe("planLevelUp", () => {
  it("reaches the requested level", () => {
    const plan = planLevelUp({ level: 20, xp: 0 }, 60, 40, ALL, RICH);
    expect(plan?.level).toBe(40);
    expect(plan?.reachesTarget).toBe(true);
  });

  it("spends at least the XP the climb costs", () => {
    const needed = xpBetween(20, 40);
    expect(needed).toBe(59_000); // the figure the whole rework was argued from
    const plan = planLevelUp({ level: 20, xp: 0 }, 60, 40, ALL, RICH);
    expect(plan!.xpSpent).toBeGreaterThanOrEqual(needed);
  });

  it("charges COIN_PER_XP for what it feeds", () => {
    const plan = planLevelUp({ level: 20, xp: 0 }, 60, 40, ALL, RICH);
    expect(plan!.coinCost).toBe(plan!.xpSpent * COIN_PER_XP);
  });

  /**
   * Ruling #145: *"a lot of people play it conservatively… they are very
   * conservative with their resources."* So the default spends the COMMON
   * manuals and leaves the rare ones alone. A solver that reached for premiums
   * first would make a hoarder undo the default on every single use.
   */
  it("spends the cheapest tier first and leaves premiums alone", () => {
    // 2,000 XP of basics is plenty for Lv 1 → 5 (1,000 XP).
    const plan = planLevelUp({ level: 1, xp: 0 }, 60, 5, ALL, RICH);
    expect(plan!.spend.training_manual).toBeGreaterThan(0);
    expect(plan!.spend.training_manual_premium ?? 0).toBe(0);
    expect(plan!.spend.training_manual_advanced ?? 0).toBe(0);
  });

  it("falls back to richer tiers when the cheap ones run out", () => {
    const held = { training_manual: 2, training_manual_premium: 100 };
    const plan = planLevelUp({ level: 1, xp: 0 }, 60, 10, held, RICH);
    expect(plan!.spend.training_manual).toBe(2);
    expect(plan!.spend.training_manual_premium).toBeGreaterThan(0);
  });

  /**
   * Coin is the constraint the old modal never showed. At `COIN_PER_XP = 2`,
   * Lv 20 → 40 costs 118,000 coin on top of the manuals, so a player with a
   * full shelf of manuals and an empty purse is stopped by the purse.
   */
  it("trims the plan to what the coin purse covers", () => {
    const coin = 1_000; // buys 500 XP
    const plan = planLevelUp({ level: 1, xp: 0 }, 60, 60, ALL, coin);
    expect(plan!.coinCost).toBeLessThanOrEqual(coin);
    expect(plan!.xpSpent).toBeLessThanOrEqual(coin / COIN_PER_XP);
    expect(plan!.reachesTarget).toBe(false);
  });

  it("returns a partial plan rather than nothing when it falls short", () => {
    const held = { training_manual: 3 }; // 300 XP
    const plan = planLevelUp({ level: 1, xp: 0 }, 60, 60, held, RICH);
    expect(plan).not.toBeNull();
    expect(plan!.reachesTarget).toBe(false);
    expect(plan!.level).toBeGreaterThan(1);
  });

  it("never climbs past the ascension cap, and banks no XP there", () => {
    const plan = planLevelUp({ level: 18, xp: 0 }, 20, 60, ALL, RICH);
    expect(plan!.level).toBe(20);
    expect(plan!.xp).toBe(0);
  });

  it("refuses a target at or behind the current level", () => {
    expect(planLevelUp({ level: 20, xp: 0 }, 60, 20, ALL, RICH)).toBeNull();
    expect(planLevelUp({ level: 20, xp: 0 }, 60, 5, ALL, RICH)).toBeNull();
  });

  it("refuses when already at the cap", () => {
    expect(planLevelUp({ level: 30, xp: 0 }, 30, 40, ALL, RICH)).toBeNull();
  });

  it("counts XP already banked toward the target", () => {
    const bare = planLevelUp({ level: 10, xp: 0 }, 60, 11, ALL, RICH)!;
    const part = planLevelUp({ level: 10, xp: 900 }, 60, 11, ALL, RICH)!;
    expect(part.xpSpent).toBeLessThan(bare.xpSpent);
  });

  it("honours a pinned tier even when the solver would not pick it", () => {
    const plan = planLevelUp({ level: 1, xp: 0 }, 60, 5, ALL, RICH, {
      training_manual_premium: 2,
    });
    expect(plan!.spend.training_manual_premium).toBe(2);
  });

  it("never spends a manual the player does not hold", () => {
    const held: Record<string, number> = {
      training_manual: 3,
      training_manual_advanced: 1,
    };
    const plan = planLevelUp({ level: 1, xp: 0 }, 60, 60, held, RICH)!;
    for (const [tier, count] of Object.entries(plan.spend)) {
      expect(count).toBeLessThanOrEqual(held[tier] ?? 0);
    }
  });
});

describe("highestReachableLevel", () => {
  it("is the level a full spend lands on", () => {
    const held = { training_manual: 10 }; // 1,000 XP
    const reach = highestReachableLevel({ level: 1, xp: 0 }, 60, held, RICH);
    expect(reach).toBe(planLevelUp({ level: 1, xp: 0 }, 60, 60, held, RICH)!.level);
  });

  it("is the current level when nothing can be spent", () => {
    expect(highestReachableLevel({ level: 7, xp: 0 }, 60, {}, RICH)).toBe(7);
  });

  it("is capped by coin, not just by manuals", () => {
    const poor = highestReachableLevel({ level: 1, xp: 0 }, 60, ALL, 0);
    expect(poor).toBe(1);
  });
});

describe("the manual tiers themselves", () => {
  it("are ordered cheap to rich, which the solver relies on", () => {
    expect(XP_PER_MANUAL_TIER.training_manual).toBeLessThan(
      XP_PER_MANUAL_TIER.training_manual_advanced,
    );
    expect(XP_PER_MANUAL_TIER.training_manual_advanced).toBeLessThan(
      XP_PER_MANUAL_TIER.training_manual_premium,
    );
  });
});
