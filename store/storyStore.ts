import { create } from "zustand";
import { persist } from "zustand/middleware";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { chapterKey } from "@/lib/game/storyCatalog";

interface StoryProgressState {
  /** Chapter keys (`partId:chapterId`) → true once cleared */
  completed: Record<string, boolean>;
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

async function pushToCloud(uid: string, completed: Record<string, boolean>) {
  if (!db) return;
  try {
    await setDoc(doc(db, "storyProgress", uid), { completed }, { merge: true });
  } catch (error) {
    // Offline / rules failures must never block local play
    console.warn("Story progress cloud sync failed:", error);
  }
}

export const useStoryStore = create<StoryProgressState>()(
  persist(
    (set, get) => ({
      completed: {},

      markChapterComplete: (partId, chapterId, uid) => {
        const completed = {
          ...get().completed,
          [chapterKey(partId, chapterId)]: true,
        };
        set({ completed });
        if (uid) void pushToCloud(uid, completed);
      },

      hydrateFromCloud: async (uid) => {
        if (!db) return;
        try {
          const snapshot = await getDoc(doc(db, "storyProgress", uid));
          const cloud =
            (snapshot.data()?.completed as
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
    { name: "toll-story-progress" },
  ),
);
