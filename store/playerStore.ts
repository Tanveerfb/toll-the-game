import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PlayerState {
  uid: string | null;
  roster: string[]; // Character IDs
  inventory: Record<string, number>; // Currency, pulls, etc.
  pity: {
    standard: number;
    limited: number;
  };
  /** True once zustand-persist has rehydrated from localStorage — gate any
   *  first-paint read of roster/inventory on this to avoid a flash of the
   *  default starter state ahead of the real persisted data (SSR/CSR
   *  mismatch risk). */
  hasHydrated: boolean;
  setPlayerState: (state: Partial<PlayerState>) => void;
  addCharacterToRoster: (characterId: string) => void;
  resetPlayerState: () => void;
}

const defaultState = {
  uid: null,
  roster: ["duke"], // Starter characters
  inventory: { gems: 1000 }, // Starter currency
  pity: { standard: 0, limited: 0 }
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      ...defaultState,
      hasHydrated: false,

      setPlayerState: (newState) => set((state) => ({ ...state, ...newState })),

      addCharacterToRoster: (characterId) => set((state) => ({
        roster: state.roster.includes(characterId) ? state.roster : [...state.roster, characterId]
      })),

      resetPlayerState: () => set((state) => ({ ...defaultState, hasHydrated: state.hasHydrated }))
    }),
    {
      name: 'toll-player-storage',
      version: 1,
      // No shape changes yet — placeholder so a future field addition has
      // somewhere to land instead of silently spreading stale old data.
      migrate: (persistedState) => persistedState as PlayerState,
      onRehydrateStorage: () => (state) => {
        state?.setPlayerState({ hasHydrated: true });
      },
    }
  )
);
