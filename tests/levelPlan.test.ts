import { describe, expect, it } from "vitest";

import {
  COIN_PER_XP,
  XP_PER_MANUAL_TIER,
  highestReachableLevel,
  levelTargets,
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

/**
 * The "raise to" chips.
 *
 * Found in a real save, not by reading the code (Tanveer, 2026-09-20): Seras
 * at **Lv 18 against a Lv 20 cap** rendered `+5 -> LV 20` beside `20 -> CAP`,
 * two chips landing on one level. The dedupe rule existed already and applied
 * to "All I own" alone, so the three presets never checked each other.
 *
 * **Falsified before being trusted** (`AGENTS.md`): dropping the `bestRank`
 * filter from `levelTargets` - the state this suite was written against -
 * turns **five** of these red, including the reported `Lv 18 / cap 20` case
 * and, notably, `drops All I own when a preset already goes there`, which is
 * the behaviour that shipped working. That one going red is the proof the
 * generalisation subsumes the old special case rather than sitting beside it.
 */
describe("levelTargets gives one chip per destination", () => {
  const levels = (level: number, maxLevel: number, reachable: number) =>
    levelTargets(level, maxLevel, reachable).map((t) => t.level);

  const subs = (level: number, maxLevel: number, reachable: number) =>
    levelTargets(level, maxLevel, reachable).map((t) => t.sub);

  it("never offers the same level twice", () => {
    for (let level = 1; level < 60; level += 1) {
      for (const maxLevel of [10, 20, 30, 40, 50, 60]) {
        if (level >= maxLevel) continue;
        for (const reachable of [level, level + 1, level + 3, maxLevel]) {
          const seen = levels(level, maxLevel, reachable);
          expect(
            new Set(seen).size,
            `Lv ${level} / cap ${maxLevel} / reachable ${reachable} -> ${seen.join(", ")}`,
          ).toBe(seen.length);
        }
      }
    }
  });

  it("collapses +5 into Cap at Lv 18 with a 20 cap - the reported case", () => {
    // Seras's actual save. "+5" would clamp to 20, which is where Cap goes.
    expect(levels(18, 20, 18)).toEqual([19, 20]);
    expect(subs(18, 20, 18)).toEqual(["Lv 19", "Cap"]);
  });

  it("collapses all three into Cap at Lv 19", () => {
    expect(levels(19, 20, 19)).toEqual([20]);
    expect(subs(19, 20, 19)).toEqual(["Cap"]);
  });

  it("keeps the more informative label when two collide", () => {
    // "Cap" says why the climb stops; "+1" only says how far.
    expect(subs(19, 20, 19)).not.toContain("Lv 20");
  });

  it("keeps all four chips when they land apart - Isolde's save", () => {
    // Lv 11, cap 20, 14 reachable: +1 -> 12, +5 -> 16, Cap -> 20, all -> 14.
    expect(levels(11, 20, 14)).toEqual([12, 16, 20, 14]);
    expect(subs(11, 20, 14)).toEqual(["Lv 12", "Lv 16", "Cap", "All I own"]);
  });

  it("drops All I own when a preset already goes there", () => {
    // The rule that already existed, kept intact by the generalisation.
    expect(subs(11, 20, 16)).toEqual(["Lv 12", "Lv 16", "Cap"]);
    expect(subs(11, 20, 20)).toEqual(["Lv 12", "Lv 16", "Cap"]);
  });

  it("drops All I own when nothing is affordable", () => {
    expect(subs(11, 20, 11)).toEqual(["Lv 12", "Lv 16", "Cap"]);
  });

  it("holds the display order: +1, +5, Cap, then All I own", () => {
    expect(levelTargets(11, 20, 14).map((t) => t.label)).toEqual([
      "+1",
      "+5",
      "20",
      "14",
    ]);
  });

  it("is empty at the cap, where the tab renders its own panel instead", () => {
    expect(levelTargets(20, 20, 20)).toEqual([]);
    expect(levelTargets(21, 20, 21)).toEqual([]);
  });

  it("never offers a level past the cap", () => {
    for (const reachable of [25, 60]) {
      for (const level of levels(18, 20, reachable)) {
        expect(level).toBeLessThanOrEqual(20);
      }
    }
  });
});
