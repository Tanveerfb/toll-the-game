import { getPlayableCharacters } from "@/lib/game/characterCatalog";

/**
 * Canonical registry of every material id the game can put in a player's
 * inventory, with its display label.
 *
 * Material ids used to exist only as string literals scattered across the
 * ascension cost table, the gacha miss-table and one display map inside
 * `app/profile/page.tsx`. Nothing validated them, so a typo in authored data
 * became a silent inventory key that no screen showed and no system spent.
 * Story chapter rewards are authored per chapter in JSON, which makes that
 * failure mode much easier to hit — hence a single list, validated at load by
 * `storySchema.ts`.
 */
export const MATERIAL_LABELS: Record<string, string> = {
  // Ascension — world-boss exclusive by design (story never drops these)
  sea_monster_eye: "Sea Monster's Eye",
  corroded_seaweed: "Corroded Sea Weed",
  // Levelling fuel
  training_manual: "Training Manual",
  training_manual_advanced: "Advanced Training Manual",
  training_manual_premium: "Premium Training Manual",
  // Local specialty materials, granted by the gacha miss-table
  // (`lib/gacha/materials.ts` maps them from a character's color)
  riverstone_fragment: "Riverstone Fragment",
  scorched_ember: "Scorched Ember",
  bramble_thorn: "Bramble Thorn",
  prism_dust: "Prism Dust",
};

/**
 * Character coins — the dupe currency that levels an ultimate.
 *
 * A second copy of a character no longer silently bumps their ult level; it
 * pays a coin the player spends when they choose to (Tanveer, 2026-08-14). The
 * coin is **exclusive to that character** — Duke's coins level Duke's ultimate
 * and nothing else — so there is exactly one id per playable character.
 *
 * `{color}_{id}_coin`, his shape: the colour is redundant against a unique id
 * today, but he plans colour variants of existing characters, and baking the
 * colour in now avoids renaming ids that will already be sitting in save files.
 *
 * Generated from the catalog rather than hand-listed. `MATERIAL_LABELS` used to
 * be a literal map, and a coin missing from it would be an inventory key no
 * screen could name — exactly the failure this module was created to stop.
 */
export function characterCoinId(character: {
  id: string;
  color: string;
}): string {
  return `${character.color}_${character.id}_coin`;
}

/** The character a coin belongs to, or null if the id isn't a coin. Coins are
 *  spendable only on their owner, so every spend path needs this direction. */
export function characterIdFromCoin(coinId: string): string | null {
  const match = /^[a-z]+_(.+)_coin$/.exec(coinId);
  return match ? match[1] : null;
}

export function isCharacterCoin(id: string): boolean {
  return id in COIN_LABELS;
}

const COIN_LABELS: Record<string, string> = Object.fromEntries(
  getPlayableCharacters().map((character) => [
    characterCoinId(character),
    // Colour-qualified so a future colour variant sharing a name still reads
    // unambiguously in the inventory.
    `${character.color[0].toUpperCase()}${character.color.slice(1)} ${character.name} Coin`,
  ]),
);

export const MATERIAL_IDS: readonly string[] = [
  ...Object.keys(MATERIAL_LABELS),
  ...Object.keys(COIN_LABELS),
];

export function isKnownMaterial(id: string): boolean {
  return id in MATERIAL_LABELS || id in COIN_LABELS;
}

/** Falls back to the raw id rather than throwing — an unknown id reaching a
 *  display surface is a data bug to see, not a crash to suffer. */
export function materialLabel(id: string): string {
  return MATERIAL_LABELS[id] ?? COIN_LABELS[id] ?? id;
}
