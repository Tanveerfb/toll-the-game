import { create } from "zustand";
import { persist } from "zustand/middleware";
import { spendStamina, STAMINA_CAP } from "@/lib/game/stamina";
import { feedManual, type ManualTier } from "@/lib/game/leveling";
import { canAffordAscension, getAscensionCost, maxLevelForAscension } from "@/lib/game/ascension";
import type { WorldBossRewards } from "@/lib/game/worldBossRewards";

export interface CharacterProgress {
  level: number;
  ascension: number;
  xp: number;
}

export interface PlayerState {
  uid: string | null;
  roster: string[]; // Character IDs
  currencies: { gems: number; coin: number };
  inventory: Record<string, number>; // materials only: sea_monster_eye, corroded_seaweed, training_manual(_advanced|_premium)
  characters: Record<string, CharacterProgress>;
  stamina: { current: number; updatedAt: number };
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
  grantMaterials: (materials: Record<string, number>) => void;
  grantCurrency: (currency: Partial<{ gems: number; coin: number }>) => void;
  spendStaminaAction: (amount: number) => boolean;
  feedManualToCharacter: (characterId: string, manualTier: ManualTier) => boolean;
  ascendCharacter: (characterId: string) => boolean;
  grantWorldBossRewards: (rewards: WorldBossRewards) => void;
}

/** What `migratePlayerState` actually produces — plain persisted data, none
 *  of the store's action methods. Kept separate from `PlayerState` so the
 *  function's return type is honest instead of relying on `as unknown as
 *  PlayerState` to paper over the gap; zustand-persist's default shallow
 *  merge reunites this with the live store's actions at rehydration time. */
export type PersistedPlayerData = Omit<
  PlayerState,
  | "hasHydrated"
  | "setPlayerState"
  | "addCharacterToRoster"
  | "resetPlayerState"
  | "grantMaterials"
  | "grantCurrency"
  | "spendStaminaAction"
  | "feedManualToCharacter"
  | "ascendCharacter"
  | "grantWorldBossRewards"
>;

const defaultState = {
  uid: null,
  roster: ["duke"], // Starter characters
  currencies: { gems: 1000, coin: 0 }, // Starter currency
  inventory: {} as Record<string, number>,
  characters: {} as Record<string, CharacterProgress>,
  stamina: { current: STAMINA_CAP, updatedAt: Date.now() },
  pity: { standard: 0, limited: 0 },
};

/** Extracted from the persist `migrate` option so it's unit-testable without
 *  touching localStorage. v1 → v2: `inventory.gems` (old shape, currency
 *  mixed into materials) splits into `currencies.gems`; `currencies.coin`,
 *  `characters`, and `stamina` are new fields with sane defaults. */
export function migratePlayerState(persistedState: unknown, version: number): PersistedPlayerData {
  const state = persistedState as Record<string, unknown>;
  if (version < 2) {
    const oldInventory = (state.inventory as Record<string, number> | undefined) ?? {};
    const { gems, ...materials } = oldInventory;
    return {
      ...state,
      currencies: { gems: gems ?? 1000, coin: 0 },
      inventory: materials,
      characters: {},
      stamina: { current: STAMINA_CAP, updatedAt: Date.now() },
    } as unknown as PersistedPlayerData;
  }
  return state as unknown as PersistedPlayerData;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      ...defaultState,
      hasHydrated: false,

      setPlayerState: (newState) => set((state) => ({ ...state, ...newState })),

      addCharacterToRoster: (characterId) => set((state) => ({
        roster: state.roster.includes(characterId) ? state.roster : [...state.roster, characterId]
      })),

      resetPlayerState: () => set((state) => ({
        ...defaultState,
        stamina: { current: STAMINA_CAP, updatedAt: Date.now() },
        hasHydrated: state.hasHydrated,
      })),

      grantMaterials: (materials) => set((state) => {
        const inventory = { ...state.inventory };
        for (const [id, qty] of Object.entries(materials)) {
          inventory[id] = (inventory[id] ?? 0) + qty;
        }
        return { inventory };
      }),

      grantCurrency: (currency) => set((state) => ({
        currencies: {
          gems: state.currencies.gems + (currency.gems ?? 0),
          coin: state.currencies.coin + (currency.coin ?? 0),
        },
      })),

      spendStaminaAction: (amount) => {
        const result = spendStamina(get().stamina, amount);
        if (!result.ok) return false;
        set({ stamina: result.next });
        return true;
      },

      feedManualToCharacter: (characterId, manualTier) => {
        const state = get();
        const owned = state.inventory[manualTier] ?? 0;
        if (owned < 1) return false;

        const progress = getCharacterProgress(state, characterId);
        const maxLevel = maxLevelForAscension(progress.ascension);
        const result = feedManual(progress, maxLevel, manualTier);
        if (!result) return false;
        if (state.currencies.coin < result.coinCost) return false;

        set({
          inventory: { ...state.inventory, [manualTier]: owned - 1 },
          currencies: { ...state.currencies, coin: state.currencies.coin - result.coinCost },
          characters: {
            ...state.characters,
            [characterId]: { ...progress, level: result.level, xp: result.xp },
          },
        });
        return true;
      },

      ascendCharacter: (characterId) => {
        const state = get();
        const progress = getCharacterProgress(state, characterId);
        const cost = getAscensionCost(progress.ascension + 1);
        if (!cost) return false;
        if (!canAffordAscension(cost, state.inventory, state.currencies.coin)) return false;

        set({
          inventory: {
            ...state.inventory,
            sea_monster_eye: (state.inventory.sea_monster_eye ?? 0) - cost.sea_monster_eye,
            corroded_seaweed: (state.inventory.corroded_seaweed ?? 0) - cost.corroded_seaweed,
          },
          currencies: { ...state.currencies, coin: state.currencies.coin - cost.coin },
          characters: {
            ...state.characters,
            [characterId]: { ...progress, ascension: progress.ascension + 1 },
          },
        });
        return true;
      },

      grantWorldBossRewards: (rewards) => {
        const { coin, ...materials } = rewards;
        get().grantMaterials(materials);
        if (coin) get().grantCurrency({ coin });
      },
    }),
    {
      name: 'toll-player-storage',
      version: 2,
      migrate: migratePlayerState,
      onRehydrateStorage: () => (state) => {
        state?.setPlayerState({ hasHydrated: true });
      },
    }
  )
);

/** Reading an untouched character returns the level-1/ascension-0 floor
 *  without needing every roster id pre-seeded in `characters`. */
export function getCharacterProgress(state: PlayerState, characterId: string): CharacterProgress {
  return state.characters[characterId] ?? { level: 1, ascension: 0, xp: 0 };
}
