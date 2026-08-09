import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Small persisted-forever settings slice, separate from gameStore (which
 * only persists an in-progress battle to sessionStorage and resets between
 * battles). battleSpeed is a player PREFERENCE, not battle state — it should
 * survive across battles and app reloads, so it lives here in localStorage
 * instead. gameStore.battleSpeed mirrors this value for its existing
 * call sites (BattleArena, useBattleSequencer) and writes through on change.
 */
interface SettingsState {
  battleSpeed: number;
  setBattleSpeed: (speed: number) => void;
  /** Background music level, 0–1. Multiplied by each track's own gain trim
   *  (`lib/audio/tracks.ts`) before reaching the element. */
  musicVolume: number;
  setMusicVolume: (volume: number) => void;
  musicMuted: boolean;
  setMusicMuted: (muted: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      battleSpeed: 1,
      setBattleSpeed: (speed) => set({ battleSpeed: speed }),
      // No migration needed for these two: zustand-persist shallow-merges the
      // stored object over these defaults, so an older payload without them
      // simply picks them up.
      musicVolume: 0.6,
      setMusicVolume: (volume) =>
        set({ musicVolume: Math.max(0, Math.min(1, volume)) }),
      musicMuted: false,
      setMusicMuted: (muted) => set({ musicMuted: muted }),
    }),
    { name: "toll-settings" },
  ),
);
