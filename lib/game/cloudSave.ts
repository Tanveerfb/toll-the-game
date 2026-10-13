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
 * `clearedEvents` and `autoClearTickets` joined on 2026-09-16 with the exact
 * same symptom, reported by Tanveer from a real account: a second device
 * demanded a fresh manual clear before Auto Clear would unlock, **and paid the
 * first-clear bundle again**. Both were added to the store on 2026-08-13 —
 * the same day the six above were synced — and missed in that pass.
 *
 * Fields that deliberately stay device-local are named in
 * `DEVICE_LOCAL_FIELDS`, and a test fails if a persisted field is in neither
 * list. That guard is the actual fix; the two entries below are the symptom.
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
  "clearedEvents",
  "autoClearTickets",
  // Epic Battles clear record (2026-10-03). Synced so a second device or a
  // sign-out/in does not drop the history missions will be judged from.
  "epicClears",
] as const;

/**
 * Persisted fields that deliberately do NOT travel, and why each one doesn't.
 *
 * This list exists so that "not synced" has to be written down. Every field
 * the store persists must appear here or in `CLOUD_FIELDS`, and
 * `tests/cloudSave.test.ts` fails the build when one appears in neither —
 * which is how `clearedEvents` and `autoClearTickets` went a month without
 * syncing and paid first-clear bundles twice.
 *
 * - `uid` is the document's own key.
 * - `hasHydrated` is a runtime flag; persisting `true` would be read back as
 *   gospel before rehydration had actually happened.
 */
export const DEVICE_LOCAL_FIELDS = ["uid", "hasHydrated"] as const;

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
 * What Firestore refuses in a document, found by walking a value.
 *
 * Added 2026-10-13 (issue #28): `epicClears[*].teams` went out as an array of
 * arrays, which Firestore rejects outright ("Nested arrays are not
 * supported"), so from the first Epic Battles clear every `setDoc` threw and
 * the player was never told. Nothing checked that the document was
 * serialisable, only that the patch logic was right. `tests/cloudSave.test.ts`
 * now walks `cloudDocument()` with this and fails on the first problem.
 *
 * Reported: an array directly inside an array, `undefined` anywhere (the SDK
 * throws unless `ignoreUndefinedProperties` is set, and it is not), and a
 * function or symbol. Returned as paths so a failing test names the field.
 */
export function firestoreShapeProblems(value: unknown, path = "document"): string[] {
  const problems: string[] = [];
  const walk = (node: unknown, at: string, insideArray: boolean) => {
    if (node === undefined) {
      problems.push(`${at}: undefined`);
      return;
    }
    if (typeof node === "function" || typeof node === "symbol") {
      problems.push(`${at}: ${typeof node}`);
      return;
    }
    if (Array.isArray(node)) {
      if (insideArray) {
        problems.push(`${at}: nested array`);
        return;
      }
      node.forEach((item, index) => walk(item, `${at}[${index}]`, true));
      return;
    }
    if (node !== null && typeof node === "object") {
      for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
        walk(item, `${at}.${key}`, false);
      }
    }
  };
  walk(value, path, false);
  return problems;
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
