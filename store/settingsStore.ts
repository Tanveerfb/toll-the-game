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
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      battleSpeed: 1,
      setBattleSpeed: (speed) => set({ battleSpeed: speed }),
    }),
    { name: "toll-settings" },
  ),
);
