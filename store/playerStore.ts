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

      setPlayerState: (newState) => set((state) => ({ ...state, ...newState })),

      addCharacterToRoster: (characterId) => set((state) => ({
        roster: state.roster.includes(characterId) ? state.roster : [...state.roster, characterId]
      })),

      resetPlayerState: () => set(defaultState)
    }),
    {
      name: 'toll-player-storage',
    }
  )
);
