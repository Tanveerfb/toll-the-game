import type { PlayerState } from "@/store/playerStore";
import { CURRENT_PLAYER_STATE_VERSION } from "@/store/playerStore";

/**
 * What travels with a cloud save, and how a document merges into local state.
 *
 * Extracted from `AuthProvider` on 2026-08-13 so the merge rule can be tested
 * without Firebase, React or a signed-in user. It is the rule most likely to
 * destroy real progress if it's wrong, and the least likely to be noticed.
 */

/**
 * Every persisted field written to Firestore.
 *
 * `account`, `worldLevel`, `presets`, `lastTeam`, `stats` and `claimedOrders`
 * joined this list on 2026-08-13. Before that they were device-local, so
 * signing in on a second device silently lost your account rank and re-offered
 * every completed Bureau Order for a second payout.
 *
 * `uid` and `hasHydrated` are deliberately absent: one is the document's own
 * key and the other is a runtime flag.
 */
export const CLOUD_FIELDS = [
  "roster",
  "currencies",
  "inventory",
  "characters",
  "stamina",
  "pity",
  "account",
  "worldLevel",
  "presets",
  "lastTeam",
  "stats",
  "claimedOrders",
] as const;

export type CloudField = (typeof CLOUD_FIELDS)[number];

/**
 * What to take from a cloud document, and what to leave alone.
 *
 * **A field absent from the document must not overwrite local state.** Every
 * document written before 2026-08-13 has no `account`, and
 * `migratePlayerState` dutifully supplies the rank-1 default for it — so
 * copying migrated values across unconditionally would reset an existing
 * player's account rank to 1 the moment they signed in, and wipe their team
 * presets on the way past.
 *
 * The same hazard applies to every field added to `CLOUD_FIELDS` from here on,
 * which is why presence is checked rather than assumed. Fields that have
 * always been synced are missing only from a genuinely empty document, where
 * the migrated defaults are the right answer anyway.
 *
 * `migrated` is the document after `migratePlayerState`, so shapes are already
 * normalised; this decides only which of them apply.
 */
export function cloudPatch(
  document: Record<string, unknown>,
  migrated: Record<string, unknown>,
): Partial<PlayerState> {
  const patch: Record<string, unknown> = {};
  for (const field of CLOUD_FIELDS) {
    if (document[field] === undefined) continue;
    patch[field] = migrated[field];
  }
  return patch as Partial<PlayerState>;
}

/**
 * The save as it goes out — every field, always, so a document converges on
 * the full shape after a single write rather than staying half-populated.
 */
export function cloudDocument(state: PlayerState): Record<string, unknown> {
  const document: Record<string, unknown> = {
    version: CURRENT_PLAYER_STATE_VERSION,
  };
  for (const field of CLOUD_FIELDS) document[field] = state[field];
  return document;
}
