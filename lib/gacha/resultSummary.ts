/**
 * What a batch of pulls added up to, for the results screen.
 *
 * The reveal used to print one tile per pull, so an 11-pull showed Coin x6,000
 * three separate times and a player counted cards to learn their totals. The
 * results screen shows characters as tiles and everything else as ONE list with
 * the quantities summed (Tanveer's pick, 2026-10-03, docs/design/mockups/
 * gacha-overhaul.html). That grouping is this file, so it can be tested without
 * rendering anything.
 *
 * Structural input types, not the store's `ResolvedPullOutcome`: pure logic
 * imports nothing from a store (project-rules §5), and the store's type
 * satisfies this one.
 */

/** The id a bundle of coin is listed under. `ItemIcon` and `materialLabel`
 *  both understand it. */
export const COIN_ITEM_ID = "coin";

export type PullResult =
  | { kind: "character"; characterId: string; isNew: boolean }
  | { kind: "coin"; amount: number }
  | { kind: "material"; materialId: string; amount: number };

export interface CharacterResult {
  characterId: string;
  isNew: boolean;
}

export interface ItemResult {
  /** A material id, or `COIN_ITEM_ID`. */
  id: string;
  /** Summed over every pull that paid it. */
  amount: number;
}

export interface PullSummary {
  /** Every character hit, in pull order. Duplicates are not merged: each is a
   *  separate pull the player will want to see land. */
  characters: CharacterResult[];
  /** Coin and materials, one row per id, in the order each first appeared. */
  items: ItemResult[];
  newUnits: number;
  duplicates: number;
}

/** Groups a batch of pulls into character tiles and one summed item list. */
export function summarisePull(results: readonly PullResult[]): PullSummary {
  const characters: CharacterResult[] = [];
  const totals = new Map<string, number>();
  let newUnits = 0;
  let duplicates = 0;

  for (const outcome of results) {
    if (outcome.kind === "character") {
      characters.push({ characterId: outcome.characterId, isNew: outcome.isNew });
      if (outcome.isNew) newUnits += 1;
      else duplicates += 1;
      continue;
    }
    const id = outcome.kind === "coin" ? COIN_ITEM_ID : outcome.materialId;
    totals.set(id, (totals.get(id) ?? 0) + outcome.amount);
  }

  const items = Array.from(totals, ([id, amount]) => ({ id, amount }));
  return { characters, items, newUnits, duplicates };
}
