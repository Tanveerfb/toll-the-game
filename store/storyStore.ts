import { create } from "zustand";
import { persist } from "zustand/middleware";
import { loadFirebase } from "@/lib/firebase";
import { chapterKey } from "@/lib/game/storyCatalog";

interface StoryProgressState {
  /** Chapter keys (`partId:chapterId`) → true once cleared */
  completed: Record<string, boolean>;
  /** True once zustand-persist has rehydrated from localStorage. */
  hasHydrated: boolean;
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
      hasHydrated: false,

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
      version: 1,
      // No shape changes yet — placeholder so a future field addition has
      // somewhere to land instead of silently spreading stale old data.
      migrate: (persistedState) => persistedState as StoryProgressState,
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true;
      },
    },
  ),
);
