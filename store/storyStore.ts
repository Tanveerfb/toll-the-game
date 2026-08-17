import { create } from "zustand";
import { persist } from "zustand/middleware";
import { loadFirebase } from "@/lib/firebase";
import { chapterKey } from "@/lib/game/storyCatalog";

/**
 * A route in progress: where the player is standing, the three orbs in hand, and
 * the loot banked so far.
 *
 * Persisted because a route is walked over several taps and a browser tab is
 * closed between them; without this, a reload would drop the player back at the
 * brief having already paid the stamina. **HP is deliberately absent** — a board
 * carries exactly one fight, so nothing survives between tiles to carry, and the
 * fight itself starts from full exactly as it always has.
 */
export interface ActiveRoute {
  partId: string;
  chapterId: string;
  /** Node id the party is standing on. */
  at: string;
  /** Three values, each 1–6. Spending one re-rolls that slot only. */
  orbs: number[];
  /** Tiles already resolved, so a re-landing can't pay loot twice. */
  resolved: string[];
  /** Loot picked up on the way, paid out with the clear. */
  bankedCoin: number;
  bankedMaterials: Record<string, number>;
}

interface StoryProgressState {
  /** Chapter keys (`partId:chapterId`) → true once cleared */
  completed: Record<string, boolean>;
  /** The route being walked, or null. One at a time — entering a chapter
   *  replaces it, which is what makes abandoning a route cost its stamina. */
  activeRoute: ActiveRoute | null;
  /** True once zustand-persist has rehydrated from localStorage. */
  hasHydrated: boolean;
  /** Starts a fresh walk, discarding any route already in progress. */
  beginRoute: (partId: string, chapterId: string, startId: string, orbs: number[]) => void;
  /** Moves to a tile and records it resolved. Loot is banked by the caller,
   *  which knows the roll. */
  advanceRoute: (
    to: string,
    orbs: number[],
    loot?: { coin: number; materials: Record<string, number> },
  ) => void;
  /** Drops the walk — a wipe, a quit, or the clear being paid out. */
  clearRoute: () => void;
  /**
   * Mark a chapter cleared. Local persistence is immediate; when a signed-in
   * uid is passed the progress is mirrored to Firestore best-effort.
   */
  markChapterComplete: (
    partId: string,
    chapterId: string,
    uid?: string,
  ) => void;
  /**
   * Merge cloud progress into local (union — progress is never lost in
   * either direction) and push the merged set back up.
   */
  hydrateFromCloud: (uid: string) => Promise<void>;
}

// Story progress lives ON the player's profile doc (`users/{uid}.storyProgress`)
// rather than a separate collection — Firestore rules only grant a signed-in
// user their own users/{uid} document, so a standalone storyProgress/{uid}
// collection was always denied and progress never reached the cloud.
async function pushToCloud(uid: string, completed: Record<string, boolean>) {
  const fb = await loadFirebase();
  if (!fb) return;
  const { db, dbApi } = fb;
  try {
    await dbApi.setDoc(
      dbApi.doc(db, "users", uid),
      { storyProgress: { completed } },
      { merge: true },
    );
  } catch (error) {
    // Offline / rules failures must never block local play
    console.warn("Story progress cloud sync failed:", error);
  }
}

export const useStoryStore = create<StoryProgressState>()(
  persist(
    (set, get) => ({
      completed: {},
      activeRoute: null,
      hasHydrated: false,

      beginRoute: (partId, chapterId, startId, orbs) =>
        set({
          activeRoute: {
            partId,
            chapterId,
            at: startId,
            orbs,
            resolved: [startId],
            bankedCoin: 0,
            bankedMaterials: {},
          },
        }),

      advanceRoute: (to, orbs, loot) => {
        const current = get().activeRoute;
        if (!current) return;
        const materials = { ...current.bankedMaterials };
        for (const [id, qty] of Object.entries(loot?.materials ?? {})) {
          materials[id] = (materials[id] ?? 0) + qty;
        }
        set({
          activeRoute: {
            ...current,
            at: to,
            orbs,
            resolved: current.resolved.includes(to)
              ? current.resolved
              : [...current.resolved, to],
            bankedCoin: current.bankedCoin + (loot?.coin ?? 0),
            bankedMaterials: materials,
          },
        });
      },

      clearRoute: () => set({ activeRoute: null }),

      markChapterComplete: (partId, chapterId, uid) => {
        const completed = {
          ...get().completed,
          [chapterKey(partId, chapterId)]: true,
        };
        set({ completed });
        if (uid) void pushToCloud(uid, completed);
      },

      hydrateFromCloud: async (uid) => {
        const fb = await loadFirebase();
        if (!fb) return;
        const { db, dbApi } = fb;
        try {
          const snapshot = await dbApi.getDoc(dbApi.doc(db, "users", uid));
          const cloud =
            (snapshot.data()?.storyProgress?.completed as
              | Record<string, boolean>
              | undefined) ?? {};
          const merged = { ...cloud, ...get().completed };
          set({ completed: merged });
          await pushToCloud(uid, merged);
        } catch (error) {
          console.warn("Story progress cloud load failed:", error);
        }
      },
    }),
    {
      name: "toll-story-progress",
      version: 2,
      /**
       * v1 → v2 added `activeRoute`. A v1 document has no route in progress by
       * definition, so it migrates to `null` — and `null` is also the right
       * answer for a corrupt or partial value, since the cost of dropping a
       * half-walked route is one chapter's stamina while the cost of restoring a
       * malformed one is a board the player can't leave.
       */
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<StoryProgressState>;
        if (version < 2) return { ...state, activeRoute: null } as StoryProgressState;
        return state as StoryProgressState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true;
      },
    },
  ),
);
