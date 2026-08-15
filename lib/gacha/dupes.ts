import { characterCoinId } from "@/lib/game/materials";
import { getCharacterById } from "@/lib/game/characterCatalog";

export interface DupeResolution {
  isNew: boolean;
  /**
   * The coin a duplicate pays, or null when the pull was a new character.
   *
   * Dupes used to silently bump `ultLevel` — six copies and the ultimate was
   * maxed whether or not you wanted it there, and a seventh copy vanished with
   * nothing to show. They now pay a character-exclusive coin the player spends
   * deliberately (Tanveer, 2026-08-14), so copies past the cap keep their value
   * and land in the inventory for the planned shop.
   */
  coinId: string | null;
}

/** The ceiling an ultimate can be levelled to, and the length of every
 *  `damageByUltLevel` ladder (`lib/game/progression.ts`). One definition — two
 *  copies of this number would drift. */
export const MAX_ULT_LEVEL = 6;

/** Coins spent per ult level. One per level, so reaching level 6 costs 5 coins
 *  — a total of six copies of the character including the one that unlocked
 *  them (Tanveer, 2026-08-14). */
export const COINS_PER_ULT_LEVEL = 1;

/** Coins to go from `from` to `to`. Negative or equal targets cost nothing. */
export function ultLevelCoinCost(from: number, to: number): number {
  return Math.max(0, to - from) * COINS_PER_ULT_LEVEL;
}

/**
 * A pull result lands on a character already owned (dupe) or not owned (new).
 * Reused by every reward source — normal pulls, the 300 milestone, and the 600
 * milestone — since dupe handling is identical everywhere.
 */
export function resolvePullResult(
  characterId: string,
  roster: string[],
): DupeResolution {
  if (!roster.includes(characterId)) {
    return { isNew: true, coinId: null };
  }
  const character = getCharacterById(characterId);
  return {
    isNew: false,
    coinId: character ? characterCoinId(character) : null,
  };
}
