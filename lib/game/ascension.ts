export interface AscensionCost {
  sea_monster_eye: number;
  corroded_seaweed: number;
  coin: number;
}

/** Locked bands 1-3 (docs/design/WORLD_BOSS_AND_ASCENSION_PLAN.md). Bands 4-6
 *  (Lv50/60) are a later update — deliberately absent, not defaulted, so a
 *  lookup miss is a real "not costed yet" signal rather than an invented
 *  number. */
export const ASCENSION_COSTS: Record<number, AscensionCost> = {
  1: { sea_monster_eye: 3, corroded_seaweed: 10, coin: 10_000 },
  2: { sea_monster_eye: 6, corroded_seaweed: 15, coin: 25_000 },
  3: { sea_monster_eye: 10, corroded_seaweed: 25, coin: 50_000 },
};

/** maxLevel reachable AT a given ascension tier. Ascension 0 (unascended)
 *  caps at level 1 — a character must cross Band 1 before any leveling. */
const ASCENSION_MAX_LEVEL: Record<number, number> = { 0: 1, 1: 20, 2: 30, 3: 40 };

export function maxLevelForAscension(ascension: number): number {
  return ASCENSION_MAX_LEVEL[ascension] ?? 40; // bands 4-6 TODO, clamp at the current ceiling
}

export function getAscensionCost(targetAscension: number): AscensionCost | null {
  return ASCENSION_COSTS[targetAscension] ?? null;
}

export function canAffordAscension(
  cost: AscensionCost,
  inventory: Record<string, number>,
  coin: number,
): boolean {
  return (
    (inventory.sea_monster_eye ?? 0) >= cost.sea_monster_eye &&
    (inventory.corroded_seaweed ?? 0) >= cost.corroded_seaweed &&
    coin >= cost.coin
  );
}

/**
 * The level a character must reach before the next ascension opens.
 *
 * Ascension was materials-only until 2026-08-13, so a level-1 character with a
 * full bag could be taken straight from ascension 1 to 4 without ever being
 * levelled (Tanveer). That skipped the entire levelling loop the bands exist to
 * pace — the bands *are* the level ladder, so ascending past one you never
 * climbed is meaningless.
 *
 * The requirement is the cap of the tier you are leaving: ascension 2 wants
 * level 20, ascension 3 wants 30, ascension 4 wants 40. Ascension 1 wants
 * level 1, which every character already has — a fresh unit is not blocked
 * from its first ascension.
 */
export function ascensionLevelRequirement(targetAscension: number): number {
  return maxLevelForAscension(targetAscension - 1);
}

/** Why an ascension can't happen, or `null` when it can. Ordered so the
 *  message names the thing the player should go and do: reaching the level
 *  gate is progress they control, and reporting "not enough materials" to
 *  someone who is also under-levelled sends them farming for nothing. */
export type AscensionBlocker = "maxed" | "level" | "materials";

export function ascensionBlocker(
  progress: { level: number; ascension: number },
  inventory: Record<string, number>,
  coin: number,
): AscensionBlocker | null {
  const cost = getAscensionCost(progress.ascension + 1);
  if (!cost) return "maxed";
  if (progress.level < ascensionLevelRequirement(progress.ascension + 1)) {
    return "level";
  }
  if (!canAffordAscension(cost, inventory, coin)) return "materials";
  return null;
}
