import { materialForCharacter } from "@/lib/gacha/materials";
import type { GemBannerConfig } from "@/lib/gacha/banners";

export type PullOutcome =
  | { kind: "character"; characterId: string }
  | { kind: "coin"; amount: number }
  | { kind: "material"; materialId: string; amount: number };

const COIN_BUNDLES = [1000, 2000, 5000, 10000];

/**
 * Manual tiers on the miss table, weighted 60/30/10 (Tanveer, 2026-08-14).
 *
 * They used to be a uniform third each, which made the miss table the largest
 * XP faucet in the game and the only source of Premium Manuals — a pull was
 * worth a mean 500 XP, so the 220 pulls a starter's 1,000 gems buy paid ~34,800
 * XP, more than every one-time source in the game combined. The weights drop
 * that to a mean 280 XP per manual roll (~19,500 XP from the same 220 pulls)
 * and make the high tiers feel like the rarity they are priced at.
 *
 * Ordered best-last so the cumulative walk below reads as "common first".
 */
const LEVEL_MAT_TIERS = [
  { id: "training_manual", weight: 0.6 },
  { id: "training_manual_advanced", weight: 0.3 },
  { id: "training_manual_premium", weight: 0.1 },
] as const;

/** The tier a [0,1) roll lands on. Falls through to the last tier so a
 *  floating-point sum a hair under 1 can't return undefined. */
function pickManualTier(roll: number): string {
  let cumulative = 0;
  for (const tier of LEVEL_MAT_TIERS) {
    cumulative += tier.weight;
    if (roll < cumulative) return tier.id;
  }
  return LEVEL_MAT_TIERS[LEVEL_MAT_TIERS.length - 1].id;
}

/** Uniform pick from a pool of character ids. Shared by the Permanent
 *  banner's every-pull-is-a-character roll and the 300-milestone's
 *  random-pull-from-the-whole-roster reward (both are the same operation:
 *  equal odds across a flat list of ids). Returns null for an empty pool
 *  instead of throwing, since callers (an unpopulated Permanent pool) are a
 *  real, expected state, not a bug. */
export function rollUniformFromPool(pool: string[], rng: () => number = Math.random): string | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)];
}

/** Limited banner roll: flat hit/miss, hit picks a featured unit, miss picks
 *  one of 3 equally-weighted item categories (currency / level-mat /
 *  local-specialty-mat). Currency and specialty-mat split evenly within
 *  themselves; level-mat is weighted by tier (see `LEVEL_MAT_TIERS`). See
 *  "The other 95%" in docs/superpowers/specs/2026-08-01-gacha-design.md.
 *  Calls `rng()` 2 times on a hit (hit-check, then featured-index pick), and
 *  3 times on a miss (hit-check, category pick, then an in-category pick —
 *  bundle amount / manual tier / featured-index-for-specialty-mat). */
export function rollLimitedPull(banner: GemBannerConfig, rng: () => number = Math.random): PullOutcome {
  const hitRoll = rng();
  if (hitRoll < banner.rate) {
    const characterId = rollUniformFromPool(banner.featured, rng);
    return { kind: "character", characterId: characterId! };
  }

  const missRoll = rng();
  const third = 1 / 3;
  if (missRoll < third) {
    const amount = COIN_BUNDLES[Math.floor(rng() * COIN_BUNDLES.length)];
    return { kind: "coin", amount };
  }
  if (missRoll < third * 2) {
    return { kind: "material", materialId: pickManualTier(rng()), amount: 1 };
  }
  const characterId = rollUniformFromPool(banner.featured, rng)!;
  return { kind: "material", materialId: materialForCharacter(characterId), amount: 1 };
}

/** Permanent banner roll: no miss category at all — every pull is a
 *  character, equal odds across the whole pool. Returns null if the pool is
 *  empty (no character currently flagged `permanentPool: true`); the caller
 *  (store action) must refuse the pull in that case rather than call this. */
export function rollPermanentPull(pool: string[], rng: () => number = Math.random): PullOutcome | null {
  const characterId = rollUniformFromPool(pool, rng);
  return characterId ? { kind: "character", characterId } : null;
}
