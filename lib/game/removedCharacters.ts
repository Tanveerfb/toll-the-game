/**
 * Character ids that left the game, so a save that still holds one is
 * cleaned rather than crashed.
 *
 * The six collab units were deleted on 2026-10-13 (ruling #187, his call:
 * the kits were drafted while he was learning the engine, from other
 * people's fiction, and the roster is the IP's own from here). Deleting a
 * kit does not delete it from a player's `roster`, `characters`, presets,
 * last team, coin inventory or epic clear record, and every one of those
 * reads the catalog by id. The v12 migration (`store/playerStore.ts`) drops
 * them with this list; nothing is refunded (they were never in a banner,
 * issue #32).
 *
 * Append, never remove: a save from before the removal can arrive at any
 * time, from a device or from Firestore.
 */
export const REMOVED_CHARACTER_IDS: readonly string[] = [
  "ban",
  "diane",
  "meliodas",
  "gon",
  "killua",
  "leorio",
];

const REMOVED = new Set(REMOVED_CHARACTER_IDS);

export function isRemovedCharacterId(id: string): boolean {
  return REMOVED.has(id);
}

/** Coin inventory keys of the removed units (`<color>_<id>_coin`). */
export const REMOVED_COIN_IDS: readonly string[] = [
  "green_ban_coin",
  "blue_diane_coin",
  "red_meliodas_coin",
  "green_gon_coin",
  "blue_killua_coin",
  "red_leorio_coin",
];
