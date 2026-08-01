/** XP granted per manual tier — only `training_manual` (tier 1) has a real
 *  drop source (Molvarr) as of this update; tiers 2-3 exist in the model,
 *  granted via the dev panel until a real source is built. */
export const XP_PER_MANUAL_TIER = {
  training_manual: 100,
  training_manual_advanced: 400,
  training_manual_premium: 1000,
} as const;

export type ManualTier = keyof typeof XP_PER_MANUAL_TIER;

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

export interface FeedManualResult extends LevelProgress {
  coinCost: number;
}

/** Feeds one manual's XP into a character, chaining level-ups on overflow,
 *  capped at `maxLevel` (from `lib/game/ascension.ts`'s per-ascension table).
 *  Returns null (feed refused, no cost charged) if already at maxLevel. */
export function feedManual(
  progress: LevelProgress,
  maxLevel: number,
  manualTier: ManualTier,
): FeedManualResult | null {
  if (progress.level >= maxLevel) return null;

  const xpGained = XP_PER_MANUAL_TIER[manualTier];
  let level = progress.level;
  let xp = progress.xp + xpGained;

  while (level < maxLevel && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  if (level >= maxLevel) xp = 0; // no banking XP past the reachable cap

  return { level, xp, coinCost: xpGained * COIN_PER_XP };
}
