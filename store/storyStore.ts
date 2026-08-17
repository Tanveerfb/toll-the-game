import { create } from "zustand";
import { persist } from "zustand/middleware";
import { loadFirebase } from "@/lib/firebase";
import { missionKey } from "@/lib/game/stageMissions";
import { stageKey } from "@/lib/game/storyCatalog";

/**
 * Story progress for story mode v2 — stage clears and mission claims.
 *
 * Two maps, both unions of booleans, which is what makes the cloud merge
 * trivially correct in either direction: progress is never lost, and two devices
 * that cleared different stages end up with both.
 *
 * **No route state.** v1 persisted a half-walked board (`activeRoute`) because a
 * board spanned several taps; a stage is entered and played in one go, so there
 * is nothing to resume and nothing to get stuck inside.
 */
interface StoryProgressState {
  /** Stage keys (`chapterId:stageId`) → true once cleared */
  cleared: Record<string, boolean>;
  /** Mission keys (`chapterId:stageId:missionId`) → true once claimed */
  missions: Record<string, boolean>;
  /** True once zustand-persist has rehydrated from localStorage. */
  hasHydrated: boolean;
  /**
   * Mark a stage cleared, and bank the missions this run met. Local persistence
   * is immediate; when a signed-in uid is passed the progress is mirrored to
   * Firestore best-effort.
   *
   * One call rather than two because they are one event: a run that met a
   * mission also cleared the stage, and writing them separately would let a
   * crash between the two bank a mission for a stage that reads uncleared.
   */
  completeStage: (
    chapterId: string,
    stageId: string,
    claimedMissionIds: string[],
    uid?: string,
  ) => void;
  /**
   * Merge cloud progress into local (union — progress is never lost in either
   * direction) and push the merged set back up.
   */
  hydrateFromCloud: (uid: string) => Promise<void>;
}

interface CloudStoryProgress {
  cleared?: Record<string, boolean>;
  missions?: Record<string, boolean>;
}

// Story progress lives ON the player's profile doc (`users/{uid}.storyProgress`)
// rather than a separate collection — Firestore rules only grant a signed-in
// user their own users/{uid} document, so a standalone storyProgress/{uid}
// collection was always denied and progress never reached the cloud.
async function pushToCloud(uid: string, progress: CloudStoryProgress) {
  const fb = await loadFirebase();
  if (!fb) return;
  const { db, dbApi } = fb;
  try {
    await dbApi.setDoc(
      dbApi.doc(db, "users", uid),
      { storyProgress: progress },
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
      cleared: {},
      missions: {},
      hasHydrated: false,

      completeStage: (chapterId, stageId, claimedMissionIds, uid) => {
        const cleared = {
          ...get().cleared,
          [stageKey(chapterId, stageId)]: true,
        };
        const missions = { ...get().missions };
        for (const id of claimedMissionIds) {
          missions[missionKey(chapterId, stageId, id)] = true;
        }
        set({ cleared, missions });
        if (uid) void pushToCloud(uid, { cleared, missions });
      },

      hydrateFromCloud: async (uid) => {
        const fb = await loadFirebase();
        if (!fb) return;
        const { db, dbApi } = fb;
        try {
          const snapshot = await dbApi.getDoc(dbApi.doc(db, "users", uid));
          const cloud = (snapshot.data()?.storyProgress ?? {}) as CloudStoryProgress;
          const merged = {
            cleared: { ...(cloud.cleared ?? {}), ...get().cleared },
            missions: { ...(cloud.missions ?? {}), ...get().missions },
          };
          set(merged);
          await pushToCloud(uid, merged);
        } catch (error) {
          console.warn("Story progress cloud load failed:", error);
        }
      },
    }),
    {
      name: "toll-story-progress",
      version: 3,
      /**
       * v2 → v3 is the story-mode-v2 rebuild, and it **drops all old progress**
       * (Tanveer, 2026-08-18: *"yeah drop the old story progress. no issues."*).
       *
       * The old keys were `partId:chapterId` naming beats of a structure that no
       * longer exists — mapping twelve parts of chapters onto chapters of stages
       * would be inventing a correspondence rather than migrating one. The cost
       * is that first-clear bundles become claimable again, which is a re-pay on
       * an existing save and was flagged as such before he agreed.
       *
       * A v3 document that is partial or corrupt lands on the same answer: empty
       * maps mean "start the story", which is always playable, where a malformed
       * map could mark a stage cleared that the player can't re-enter.
       */
      migrate: (persistedState, version) => {
        if (version < 3) {
          return { cleared: {}, missions: {} } as StoryProgressState;
        }
        const state = persistedState as Partial<StoryProgressState>;
        return {
          ...state,
          cleared: state.cleared ?? {},
          missions: state.missions ?? {},
        } as StoryProgressState;
      },
      partialize: (state) => ({
        cleared: state.cleared,
        missions: state.missions,
      }) as unknown as StoryProgressState,
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true;
      },
    },
  ),
);
