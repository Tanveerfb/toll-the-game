import { create } from "zustand";
import { persist } from "zustand/middleware";
import { spendStamina, STAMINA_CAP } from "@/lib/game/stamina";
import { feedManual, type ManualTier } from "@/lib/game/leveling";
import { canAffordAscension, getAscensionCost, maxLevelForAscension } from "@/lib/game/ascension";
import type { WorldBossRewards } from "@/lib/game/worldBossRewards";
import { getActiveLimitedBanner, getPermanentBanner } from "@/lib/gacha/banners";
import { rollLimitedPull, rollPermanentPull, rollUniformFromPool, type PullOutcome } from "@/lib/gacha/pull";
import {
  advanceLimitedBar,
  advancePermanentBar,
  canClaimLimited300,
  canClaimLimited600,
  canClaimPermanent600,
  resetLimitedLap,
  resetPermanentLap,
} from "@/lib/gacha/milestone";
import { resolvePullResult } from "@/lib/gacha/dupes";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";

const LIMITED_COST_SINGLE = 3;
const LIMITED_COST_MULTI = 30;
const PERMANENT_COST_SINGLE = 1;
const PERMANENT_COST_MULTI = 10;

export interface CharacterProgress {
  level: number;
  ascension: number;
  xp: number;
  ultLevel: number;
}

export interface PlayerState {
  uid: string | null;
  roster: string[]; // Character IDs
  currencies: { gems: number; coin: number; permanentTicket: number };
  inventory: Record<string, number>; // materials only: sea_monster_eye, corroded_seaweed, training_manual(_advanced|_premium)
  characters: Record<string, CharacterProgress>;
  stamina: { current: number; updatedAt: number };
  pity: {
    limited: { bannerId: string | null; bar: number; claimed300: boolean };
    permanent: { bar: number };
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
  grantCurrency: (currency: Partial<{ gems: number; coin: number; permanentTicket: number }>) => void;
  spendStaminaAction: (amount: number) => boolean;
  feedManualToCharacter: (characterId: string, manualTier: ManualTier) => boolean;
  ascendCharacter: (characterId: string) => boolean;
  grantWorldBossRewards: (rewards: WorldBossRewards) => void;
  pullLimited: (count: 1 | 11) => PullOutcome[] | false;
  pullPermanent: (count: 1 | 11) => PullOutcome[] | false;
  claimLimited300: () => PullOutcome | false;
  claimLimited600: (characterId: string) => PullOutcome | false;
  claimPermanent600: (characterId: string) => PullOutcome | false;
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
  | "pullLimited"
  | "pullPermanent"
  | "claimLimited300"
  | "claimLimited600"
  | "claimPermanent600"
>;

export const DEFAULT_PITY = {
  limited: { bannerId: null, bar: 0, claimed300: false },
  permanent: { bar: 0 },
} as const;

/** The level-1/ascension-0/ultLevel-1 floor for a character not yet present
 *  in a `characters` map. Takes the map directly (not full `PlayerState`) so
 *  it works equally against `state.characters` and the local accumulator
 *  gacha actions build up mid-loop. `getCharacterProgress` below delegates
 *  here for the common case of reading straight off live store state. */
function defaultCharacterProgress(
  characters: Record<string, CharacterProgress>,
  characterId: string,
): CharacterProgress {
  return characters[characterId] ?? { level: 1, ascension: 0, xp: 0, ultLevel: 1 };
}

const defaultState = {
  uid: null,
  roster: ["duke"], // Starter characters
  currencies: { gems: 1000, coin: 0, permanentTicket: 0 }, // Starter currency
  inventory: {} as Record<string, number>,
  characters: {} as Record<string, CharacterProgress>,
  stamina: { current: STAMINA_CAP, updatedAt: Date.now() },
  pity: DEFAULT_PITY,
};

/** Extracted from the persist `migrate` option so it's unit-testable without
 *  touching localStorage. Migrations chain: a v1 input falls through both
 *  the v1→v2 and v2→v3 steps in the same call, coming out fully v3-shaped.
 *  v1 → v2: `inventory.gems` (old shape, currency mixed into materials)
 *  splits into `currencies.gems`; `currencies.coin`, `characters`, and
 *  `stamina` are new fields with sane defaults.
 *  v2 → v3: adds `currencies.permanentTicket`, restructures `pity` from
 *  `{ standard, limited }` counters into `{ limited: {...}, permanent: {...} }`,
 *  and defaults `ultLevel: 1` on existing characters. */
export function migratePlayerState(persistedState: unknown, version: number): PersistedPlayerData {
  let state = persistedState as Record<string, unknown>;

  // Defensive baseline: the version-gated blocks below only guarantee the
  // specific fields each migration step actually restructures. A real
  // document can be missing an unrelated field for reasons that have
  // nothing to do with schema version (a partial/stale write, manual edit,
  // etc.) — this ensures every core field has a safe floor before the
  // version-specific logic runs, without ever overwriting real data (the
  // defaults are spread first, so `...state`'s actual values always win).
  // `currencies` and `pity` are included here too: they're fully handled
  // inside the `version < 3` block, but a doc that's already AT version 3
  // (neither `if` block runs) and missing either field would otherwise pass
  // `undefined` straight through.
  state = {
    roster: [] as string[],
    inventory: {} as Record<string, number>,
    characters: {} as Record<string, CharacterProgress>,
    stamina: { current: STAMINA_CAP, updatedAt: Date.now() },
    currencies: { gems: 1000, coin: 0, permanentTicket: 0 },
    pity: DEFAULT_PITY,
    ...state,
  };

  if (version < 2) {
    const oldInventory = (state.inventory as Record<string, number> | undefined) ?? {};
    const { gems, ...materials } = oldInventory;
    state = {
      ...state,
      currencies: { gems: gems ?? 1000, coin: 0 },
      inventory: materials,
      characters: {},
      stamina: { current: STAMINA_CAP, updatedAt: Date.now() },
    };
  }

  if (version < 3) {
    const oldCurrencies = (state.currencies as { gems: number; coin: number } | undefined) ?? { gems: 1000, coin: 0 };
    const oldCharacters =
      (state.characters as Record<string, { level: number; ascension: number; xp: number }> | undefined) ?? {};
    const migratedCharacters: Record<string, CharacterProgress> = {};
    for (const [id, progress] of Object.entries(oldCharacters)) {
      migratedCharacters[id] = { ...progress, ultLevel: 1 };
    }
    state = {
      ...state,
      currencies: { ...oldCurrencies, permanentTicket: 0 },
      characters: migratedCharacters,
      pity: DEFAULT_PITY,
    };
  }

  return state as unknown as PersistedPlayerData;
}

export const CURRENT_PLAYER_STATE_VERSION = 3;

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
          ...state.currencies,
          gems: state.currencies.gems + (currency.gems ?? 0),
          coin: state.currencies.coin + (currency.coin ?? 0),
          permanentTicket: state.currencies.permanentTicket + (currency.permanentTicket ?? 0),
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
        const { coin, gems, permanentTicket, ...materials } = rewards;
        get().grantMaterials(materials);
        if (coin || gems || permanentTicket) get().grantCurrency({ coin, gems, permanentTicket });
      },

      pullLimited: (count) => {
        const state = get();
        const banner = getActiveLimitedBanner();
        const cost = count === 1 ? LIMITED_COST_SINGLE : LIMITED_COST_MULTI;
        if (state.currencies.gems < cost) return false;

        let coin = state.currencies.coin;
        const inventory = { ...state.inventory };
        const roster = [...state.roster];
        const characters = { ...state.characters };
        const results: PullOutcome[] = [];

        for (let i = 0; i < count; i++) {
          const outcome = rollLimitedPull(banner);
          results.push(outcome);
          if (outcome.kind === "character") {
            const resolution = resolvePullResult(outcome.characterId, roster, characters);
            if (resolution.isNew) roster.push(outcome.characterId);
            const existing = defaultCharacterProgress(characters, outcome.characterId);
            characters[outcome.characterId] = { ...existing, ultLevel: resolution.ultLevel };
          } else if (outcome.kind === "coin") {
            coin += outcome.amount;
          } else {
            inventory[outcome.materialId] = (inventory[outcome.materialId] ?? 0) + outcome.amount;
          }
        }

        const limitedPity = advanceLimitedBar(state.pity.limited, banner.id, cost);
        set({
          currencies: { ...state.currencies, gems: state.currencies.gems - cost, coin },
          inventory,
          roster,
          characters,
          pity: { ...state.pity, limited: limitedPity },
        });
        return results;
      },

      pullPermanent: (count) => {
        const state = get();
        const banner = getPermanentBanner();
        if (banner.featured.length === 0) return false;
        const cost = count === 1 ? PERMANENT_COST_SINGLE : PERMANENT_COST_MULTI;
        if (state.currencies.permanentTicket < cost) return false;

        const roster = [...state.roster];
        const characters = { ...state.characters };
        const results: PullOutcome[] = [];

        for (let i = 0; i < count; i++) {
          const outcome = rollPermanentPull(banner.featured);
          if (!outcome) break;
          results.push(outcome);
          if (outcome.kind !== "character") continue; // rollPermanentPull only ever constructs "character" outcomes
          const resolution = resolvePullResult(outcome.characterId, roster, characters);
          if (resolution.isNew) roster.push(outcome.characterId);
          const existing = defaultCharacterProgress(characters, outcome.characterId);
          characters[outcome.characterId] = { ...existing, ultLevel: resolution.ultLevel };
        }

        const permanentBar = advancePermanentBar(state.pity.permanent.bar, cost);
        set({
          currencies: { ...state.currencies, permanentTicket: state.currencies.permanentTicket - cost },
          roster,
          characters,
          pity: { ...state.pity, permanent: { bar: permanentBar } },
        });
        return results;
      },

      claimLimited300: () => {
        const state = get();
        if (!canClaimLimited300(state.pity.limited.bar, state.pity.limited.claimed300)) return false;
        const pool = getPlayableCharacters().map((c) => c.id);
        const characterId = rollUniformFromPool(pool);
        if (!characterId) return false;

        const resolution = resolvePullResult(characterId, state.roster, state.characters);
        const roster = resolution.isNew ? [...state.roster, characterId] : state.roster;
        const existing = defaultCharacterProgress(state.characters, characterId);

        set({
          roster,
          characters: { ...state.characters, [characterId]: { ...existing, ultLevel: resolution.ultLevel } },
          pity: { ...state.pity, limited: { ...state.pity.limited, claimed300: true } },
        });
        return { kind: "character", characterId };
      },

      claimLimited600: (characterId) => {
        const state = get();
        const banner = getActiveLimitedBanner();
        if (!canClaimLimited600(state.pity.limited.bar)) return false;
        if (!banner.featured.includes(characterId)) return false;

        const resolution = resolvePullResult(characterId, state.roster, state.characters);
        const roster = resolution.isNew ? [...state.roster, characterId] : state.roster;
        const existing = defaultCharacterProgress(state.characters, characterId);

        set({
          roster,
          characters: { ...state.characters, [characterId]: { ...existing, ultLevel: resolution.ultLevel } },
          pity: { ...state.pity, limited: resetLimitedLap(state.pity.limited) },
        });
        return { kind: "character", characterId };
      },

      claimPermanent600: (characterId) => {
        const state = get();
        const banner = getPermanentBanner();
        if (!canClaimPermanent600(state.pity.permanent.bar)) return false;
        if (!banner.featured.includes(characterId)) return false;

        const resolution = resolvePullResult(characterId, state.roster, state.characters);
        const roster = resolution.isNew ? [...state.roster, characterId] : state.roster;
        const existing = defaultCharacterProgress(state.characters, characterId);

        set({
          roster,
          characters: { ...state.characters, [characterId]: { ...existing, ultLevel: resolution.ultLevel } },
          pity: { ...state.pity, permanent: { bar: resetPermanentLap() } },
        });
        return { kind: "character", characterId };
      },
    }),
    {
      name: 'toll-player-storage',
      version: CURRENT_PLAYER_STATE_VERSION,
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
  return defaultCharacterProgress(state.characters, characterId);
}
