/** XP granted per manual tier.
 *
 *  Every tier has a real source. Tier 1 drops from Molvarr's farm at every
 *  world level; **all three drop from the gacha miss table**, weighted 60/30/10
 *  (`LEVEL_MAT_TIERS` in `lib/gacha/pull.ts`), which is where Advanced and
 *  Premium overwhelmingly come from. Higher world-boss tiers add Advanced and
 *  Premium to their farms per ruling #81.
 *
 *  This comment previously read "only tier 1 has a real drop source... granted
 *  via the dev panel until a real source is built", which was false from the
 *  day gacha shipped and led `docs/design/ECONOMY_AUDIT.md` to size the
 *  levelling grind without counting summons at all. */
export const XP_PER_MANUAL_TIER = {
  training_manual: 100,
  training_manual_advanced: 400,
  training_manual_premium: 1000,
} as const;

export type ManualTier = keyof typeof XP_PER_MANUAL_TIER;

/** Player-facing names, beside the values so a new tier cannot ship unnamed. */
export const MANUAL_TIER_LABELS: Record<ManualTier, string> = {
  training_manual: "Training Manual",
  training_manual_advanced: "Advanced Manual",
  training_manual_premium: "Premium Manual",
};

/** Coin cost per XP point fed — a manual's coin cost is xpGranted * this. */
export const COIN_PER_XP = 2;

/** Total XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return 100 * level;
}

export interface LevelProgress {
  level: number;
  xp: number;
}

/** How many of each manual tier a spend uses. */
export type ManualSpend = Partial<Record<ManualTier, number>>;

export interface LevelPlan extends LevelProgress {
  /** Manuals consumed, by tier. */
  spend: ManualSpend;
  /** Coin consumed - `xpSpent * COIN_PER_XP`. */
  coinCost: number;
  /** XP actually fed. Less than the manuals hold when the cap is reached. */
  xpSpent: number;
  /** True when the plan lands exactly on the requested level. */
  reachesTarget: boolean;
}

/** Cheapest tier first. See `planLevelUp`. */
const SPEND_ORDER: ManualTier[] = [
  "training_manual",
  "training_manual_advanced",
  "training_manual_premium",
];

/**
 * Work out which manuals to spend to reach `targetLevel`.
 *
 * Replaces feeding one manual per tap. `xpToNext` is `100 * level`, so
 * Lv 20 -> 40 is 59,000 XP: 590 basic manuals, 148 advanced or 59 premium, and
 * every one of those used to be a separate press (measured 2026-09-17).
 *
 * **Cheapest tier first**, which is the conservative order: it burns the common
 * manuals and preserves the rare ones. Ruling #145 - *"a lot of people play it
 * conservatively... they are very conservative with their resources"* - so a
 * default that spends the valuable stack first would make a hoarder undo it
 * every time. `pinned` lets the caller override the mix per tier.
 *
 * Returns `null` only when nothing can be done at all (already at the cap, or
 * the target is not ahead). Otherwise it always returns the **best reachable**
 * plan and reports `reachesTarget: false` when that falls short - a caller can
 * then offer the partial spend rather than a dead button.
 */
export function planLevelUp(
  progress: LevelProgress,
  maxLevel: number,
  targetLevel: number,
  held: Record<string, number>,
  coinHeld: number,
  pinned: ManualSpend = {},
): LevelPlan | null {
  if (progress.level >= maxLevel) return null;
  const goal = Math.min(targetLevel, maxLevel);
  if (goal <= progress.level) return null;

  // XP from here to the goal, minus what is already banked.
  let xpNeeded = -progress.xp;
  for (let level = progress.level; level < goal; level += 1) {
    xpNeeded += xpToNext(level);
  }

  const spend: ManualSpend = {};
  let xpSpent = 0;

  const take = (tier: ManualTier, count: number) => {
    if (count <= 0) return;
    spend[tier] = (spend[tier] ?? 0) + count;
    xpSpent += count * XP_PER_MANUAL_TIER[tier];
  };

  // Pinned tiers are spent first and in full, even past the goal - the caller
  // asked for them explicitly. They are still bounded by what is held.
  for (const tier of SPEND_ORDER) {
    const want = pinned[tier];
    if (want === undefined) continue;
    take(tier, Math.max(0, Math.min(want, held[tier] ?? 0)));
  }

  // Then fill the remainder, cheapest first.
  for (const tier of SPEND_ORDER) {
    if (pinned[tier] !== undefined) continue;
    if (xpSpent >= xpNeeded) break;
    const each = XP_PER_MANUAL_TIER[tier];
    const wanted = Math.ceil((xpNeeded - xpSpent) / each);
    take(tier, Math.min(wanted, held[tier] ?? 0));
  }

  // Coin is the other cost, and at COIN_PER_XP it is usually the binding one.
  // Trim the plan down to what the coin purse covers rather than refusing it.
  const affordableXp = Math.floor(coinHeld / COIN_PER_XP);
  if (xpSpent > affordableXp) {
    let budget = affordableXp;
    xpSpent = 0;
    // Drop from the most expensive tier down, so the cheap manuals - the ones
    // a player minds least - are the ones that survive the trim.
    for (const tier of [...SPEND_ORDER].reverse()) {
      const count = spend[tier] ?? 0;
      if (count === 0) continue;
      const each = XP_PER_MANUAL_TIER[tier];
      const keep = Math.min(count, Math.floor(budget / each));
      budget -= keep * each;
      xpSpent += keep * each;
      if (keep === 0) delete spend[tier];
      else spend[tier] = keep;
    }
  }

  if (xpSpent === 0) return null;

  // Walk the XP in, chaining level-ups, stopping at the cap.
  let level = progress.level;
  let xp = progress.xp + xpSpent;
  while (level < maxLevel && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  if (level >= maxLevel) xp = 0; // no banking XP past the reachable cap

  return {
    level,
    xp,
    spend,
    xpSpent,
    coinCost: xpSpent * COIN_PER_XP,
    reachesTarget: level >= goal,
  };
}

/**
 * The highest level reachable right now, spending everything.
 *
 * What the "all I own" target is worth, and what dims it when it sits past the
 * ascension cap.
 */
export function highestReachableLevel(
  progress: LevelProgress,
  maxLevel: number,
  held: Record<string, number>,
  coinHeld: number,
): number {
  const plan = planLevelUp(progress, maxLevel, maxLevel, held, coinHeld);
  return plan?.level ?? progress.level;
}
