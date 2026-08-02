import { materialForCharacter } from "@/lib/gacha/materials";
import type { LimitedBannerConfig } from "@/lib/gacha/banners";

export type PullOutcome =
  | { kind: "character"; characterId: string }
  | { kind: "coin"; amount: number }
  | { kind: "material"; materialId: string; amount: number };

const COIN_BUNDLES = [1000, 2000, 5000, 10000];
const LEVEL_MAT_TIERS = ["training_manual", "training_manual_advanced", "training_manual_premium"];

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
 *  local-specialty-mat), each split evenly within itself. See "The other
 *  95%" in docs/superpowers/specs/2026-08-01-gacha-design.md.
 *  Calls `rng()` 2 times on a hit (hit-check, then featured-index pick), and
 *  3 times on a miss (hit-check, category pick, then an in-category pick —
 *  bundle amount / manual tier / featured-index-for-specialty-mat). */
export function rollLimitedPull(banner: LimitedBannerConfig, rng: () => number = Math.random): PullOutcome {
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
    const materialId = LEVEL_MAT_TIERS[Math.floor(rng() * LEVEL_MAT_TIERS.length)];
    return { kind: "material", materialId, amount: 1 };
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
