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
  canClaimLimitedFirst,
  canClaimLimitedFinal,
  canClaimPermanentFinal,
  settleLimitedLap,
  settlePermanentLap,
  type LimitedPityState,
  type PermanentPityState,
} from "@/lib/gacha/milestone";
import {
  limitedBarGain,
  limitedGemCost,
  permanentTicketCost,
} from "@/lib/gacha/cost";
import { resolvePullResult } from "@/lib/gacha/dupes";
import type { StoryPayout } from "@/lib/game/storyRewards";
import { grantAccountXp } from "@/lib/game/accountRank";
import {
  MIN_WORLD_LEVEL,
  worldLevelCapForRank,
} from "@/lib/game/worldLevel";
import {
  addPreset,
  deletePreset,
  notePresetUsed,
  presetFromTeam,
  renamePreset,
  type TeamPreset,
} from "@/lib/game/teamPresets";

// Pull pricing and milestone progress live in `lib/gacha/cost.ts`. They used
// to be one number each — the bar advanced by the gem cost — which is exactly
// what stopped them being tunable apart (Tanveer, 2026-08-11).

export interface CharacterProgress {
  level: number;
  ascension: number;
  xp: number;
  ultLevel: number;
}

/**
 * A pull outcome plus what it actually did to the roster.
 *
 * The raw `PullOutcome` says "you got Duke" and stops there, so the reveal
 * screen had no way to distinguish a first copy from a fourth — it rendered
 * them identically even though `resolvePullResult` had already worked out the
 * difference and the store had already banked the ult rank (Tanveer,
 * 2026-08-11). The resolution rides along instead of being recomputed by
 * diffing the roster, which would be guesswork after the fact.
 */
export type ResolvedPullOutcome =
  | (Extract<PullOutcome, { kind: "character" }> & {
      isNew: boolean;
      /** Ult level AFTER this pull. `1` on a new unit. */
      ultLevel: number;
    })
  | Extract<PullOutcome, { kind: "coin" }>
  | Extract<PullOutcome, { kind: "material" }>;

export interface PlayerState {
  uid: string | null;
  roster: string[]; // Character IDs
  currencies: { gems: number; coin: number; permanentTicket: number };
  inventory: Record<string, number>; // materials only: sea_monster_eye, corroded_seaweed, training_manual(_advanced|_premium)
  characters: Record<string, CharacterProgress>;
  /** Saved loadouts, shared by every mode. See lib/game/teamPresets.ts. */
  presets: TeamPreset[];
  /** Ordered ids of the last team taken into battle, so a picker can open
   *  on it instead of empty. */
  lastTeam: string[];
  /** Account-level ladder — see lib/game/accountRank.ts. Distinct from
   *  character level; gates world level and walls at ranks 20 and 40. */
  account: { rank: number; xp: number; clearedWalls: number[] };
  /** Difficulty the player has dialled in, never above what their rank
   *  unlocked. Adjustable down — see lib/game/worldLevel.ts. */
  worldLevel: number;
  stamina: { current: number; updatedAt: number };
  pity: {
    limited: LimitedPityState;
    permanent: PermanentPityState;
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
  grantStoryRewards: (payout: StoryPayout) => void;
  saveTeamPreset: (name: string, memberIds: string[]) => boolean;
  renameTeamPreset: (id: string, name: string) => void;
  deleteTeamPreset: (id: string) => void;
  noteTeamPresetUsed: (id: string) => void;
  rememberLastTeam: (memberIds: string[]) => void;
  grantAccountXpAction: (amount: number) => void;
  clearRankWall: (rank: number) => void;
  setWorldLevel: (level: number) => void;
  pullLimited: (count: 1 | 11) => ResolvedPullOutcome[] | false;
  pullPermanent: (count: 1 | 11) => ResolvedPullOutcome[] | false;
  claimLimitedFirst: () => ResolvedPullOutcome | false;
  claimLimitedFinal: (characterId: string) => ResolvedPullOutcome | false;
  claimPermanentFinal: (characterId: string) => ResolvedPullOutcome | false;
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
  | "grantStoryRewards"
  | "saveTeamPreset"
  | "renameTeamPreset"
  | "deleteTeamPreset"
  | "noteTeamPresetUsed"
  | "rememberLastTeam"
  | "grantAccountXpAction"
  | "clearRankWall"
  | "setWorldLevel"
  | "pullLimited"
  | "pullPermanent"
  | "claimLimitedFirst"
  | "claimLimitedFinal"
  | "claimPermanentFinal"
>;

export const DEFAULT_PITY = {
  limited: { bannerId: null, bar: 0, claimedFirst: false, claimedFinal: false },
  permanent: { bar: 0, claimedFinal: false },
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
  presets: [] as TeamPreset[],
  lastTeam: [] as string[],
  account: { rank: 1, xp: 0, clearedWalls: [] as number[] },
  worldLevel: 1,
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
    presets: [] as TeamPreset[],
    lastTeam: [] as string[],
    account: { rank: 1, xp: 0, clearedWalls: [] as number[] },
    worldLevel: 1,
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

  if (version < 4) {
    // v3 → v4: team presets and the sticky last team. Both are purely
    // additive, so an existing save just gains two empty lists — the
    // defensive baseline above has already supplied them.
    state = {
      ...state,
      presets: (state.presets as TeamPreset[] | undefined) ?? [],
      lastTeam: (state.lastTeam as string[] | undefined) ?? [],
    };
  }

  if (version < 5) {
    // v4 → v5: account rank and world level. Additive; the defensive baseline
    // above already supplied both, so an existing save simply starts at rank 1
    // / world level 1 — which is exactly today's behaviour.
    state = {
      ...state,
      account:
        (state.account as PlayerState["account"] | undefined) ?? {
          rank: 1,
          xp: 0,
          clearedWalls: [],
        },
      worldLevel: (state.worldLevel as number | undefined) ?? 1,
    };
  }

  if (version < 6) {
    // v5 → v6: milestone laps gained a `claimedFinal` flag on both banners, so
    // 600 can be claimed without immediately wrapping the lap and forfeiting
    // an unclaimed 300 (Tanveer, 2026-08-11).
    //
    // `pity` is a nested object, so persist's shallow merge replaces it
    // wholesale rather than filling the new field — an untouched v5 payload
    // would arrive with `claimedFinal: undefined`. That reads as falsy, which is
    // the right answer, but "right by accident" is how the next shape change
    // goes wrong. Normalised explicitly instead.
    // The stored field was `claimed300`; it is now `claimedFirst`, because the
    // threshold it guards moved from 300 to 500 and a field named for a number
    // it no longer holds is a trap.
    const oldPity = state.pity as
      | {
          limited?: {
            bannerId?: string | null;
            bar?: number;
            claimed300?: boolean;
          };
          permanent?: { bar?: number };
        }
      | undefined;
    state = {
      ...state,
      pity: {
        limited: {
          bannerId: oldPity?.limited?.bannerId ?? null,
          // The bar was denominated in the old 3-per-single unit against
          // 300/600 thresholds; it is now gems-spent against 500/1000. There
          // is no honest conversion — carrying the old number forward would
          // read as progress the player never made at the new rate — so a
          // lap in flight is reset. Nothing claimable is lost: both claim
          // flags start clean too.
          bar: 0,
          claimedFirst: false,
          claimedFinal: false,
        },
        permanent: {
          // Permanent kept its ticket pricing and its 600 threshold, so its
          // bar carries over untouched.
          bar: oldPity?.permanent?.bar ?? 0,
          claimedFinal: false,
        },
      },
    };
  }

  return state as unknown as PersistedPlayerData;
}

export const CURRENT_PLAYER_STATE_VERSION = 6;

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
        // `accountXp` MUST be destructured out: the rest-spread below becomes
        // the materials map, and anything left in it turns into an inventory
        // key that nothing displays and nothing spends.
        const { coin, gems, permanentTicket, accountXp, ...materials } = rewards;
        get().grantMaterials(materials);
        if (coin || gems || permanentTicket) get().grantCurrency({ coin, gems, permanentTicket });
        if (accountXp) get().grantAccountXpAction(accountXp);
      },

      /** Story clear payout. Same split as the world boss above, but the
       *  materials arrive as an open map rather than fixed keys — story
       *  chapters author their own drop table in `data/story/*.json`. */
      grantStoryRewards: (payout) => {
        const { coin, gems, permanentTicket, materials, accountXp } = payout;
        if (Object.keys(materials).length > 0) get().grantMaterials(materials);
        if (coin || gems || permanentTicket) get().grantCurrency({ coin, gems, permanentTicket });
        if (accountXp) get().grantAccountXpAction(accountXp);
      },

      /** Returns false when the preset cap is reached — the caller surfaces
       *  that rather than silently evicting a team the player still wants. */
      saveTeamPreset: (name, memberIds) => {
        const next = addPreset(
          get().presets,
          presetFromTeam(name, memberIds),
        );
        if (!next) return false;
        set({ presets: next });
        return true;
      },

      renameTeamPreset: (id, name) =>
        set((state) => ({ presets: renamePreset(state.presets, id, name) })),

      deleteTeamPreset: (id) =>
        set((state) => ({ presets: deletePreset(state.presets, id) })),

      noteTeamPresetUsed: (id) =>
        set((state) => ({ presets: notePresetUsed(state.presets, id) })),

      /** Called when a battle actually starts, not when the picker changes —
       *  a team you assembled and then abandoned isn't the one you want back. */
      rememberLastTeam: (memberIds) => set({ lastTeam: [...memberIds] }),

      /** A rank-up refills stamina (Tanveer, 2026-08-11) — the reward for
       *  progressing is being able to keep playing. */
      grantAccountXpAction: (amount) =>
        set((state) => {
          const next = grantAccountXp(
            state.account,
            amount,
            state.account.clearedWalls,
          );
          const rankedUp = next.rank > state.account.rank;
          return {
            account: { ...state.account, ...next },
            ...(rankedUp
              ? { stamina: { current: STAMINA_CAP, updatedAt: Date.now() } }
              : {}),
          };
        }),

      /** Marks a rank wall's trial as cleared, then immediately re-applies the
       *  banked XP so the ranks earned while stuck land at once. */
      clearRankWall: (rank) =>
        set((state) => {
          if (state.account.clearedWalls.includes(rank)) return {};
          const clearedWalls = [...state.account.clearedWalls, rank];
          // Re-applying zero XP lets the banked overflow cash in at once, so
          // the ranks earned while stuck all land the moment the wall falls.
          const next = grantAccountXp(
            { rank: state.account.rank, xp: state.account.xp },
            0,
            clearedWalls,
          );
          return {
            account: { clearedWalls, ...next },
            ...(next.rank > state.account.rank
              ? { stamina: { current: STAMINA_CAP, updatedAt: Date.now() } }
              : {}),
          };
        }),

      setWorldLevel: (level) =>
        set((state) => ({
          worldLevel: Math.min(
            worldLevelCapForRank(state.account.rank),
            Math.max(MIN_WORLD_LEVEL, Math.floor(level) || MIN_WORLD_LEVEL),
          ),
        })),

      pullLimited: (count) => {
        const state = get();
        const banner = getActiveLimitedBanner();
        const cost = limitedGemCost(count);
        if (state.currencies.gems < cost) return false;

        let coin = state.currencies.coin;
        const inventory = { ...state.inventory };
        const roster = [...state.roster];
        const characters = { ...state.characters };
        const results: ResolvedPullOutcome[] = [];

        for (let i = 0; i < count; i++) {
          const outcome = rollLimitedPull(banner);
          if (outcome.kind === "character") {
            const resolution = resolvePullResult(outcome.characterId, roster, characters);
            if (resolution.isNew) roster.push(outcome.characterId);
            const existing = defaultCharacterProgress(characters, outcome.characterId);
            characters[outcome.characterId] = { ...existing, ultLevel: resolution.ultLevel };
            results.push({ ...outcome, ...resolution });
            continue;
          }
          results.push(outcome);
          if (outcome.kind === "coin") {
            coin += outcome.amount;
          } else {
            inventory[outcome.materialId] = (inventory[outcome.materialId] ?? 0) + outcome.amount;
          }
        }

        // The bar advances by its own value, not by the gems spent — those
        // came apart on 2026-08-11 so pricing and lap length tune separately.
        const limitedPity = advanceLimitedBar(
          state.pity.limited,
          banner.id,
          limitedBarGain(count),
        );
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
        const cost = permanentTicketCost(count);
        if (state.currencies.permanentTicket < cost) return false;

        const roster = [...state.roster];
        const characters = { ...state.characters };
        const results: ResolvedPullOutcome[] = [];

        for (let i = 0; i < count; i++) {
          const outcome = rollPermanentPull(banner.featured);
          if (!outcome) break;
          if (outcome.kind !== "character") continue; // rollPermanentPull only ever constructs "character" outcomes
          const resolution = resolvePullResult(outcome.characterId, roster, characters);
          if (resolution.isNew) roster.push(outcome.characterId);
          const existing = defaultCharacterProgress(characters, outcome.characterId);
          characters[outcome.characterId] = { ...existing, ultLevel: resolution.ultLevel };
          results.push({ ...outcome, ...resolution });
        }

        // Permanent still runs on tickets and still advances its bar by the
        // ticket cost — the gem re-pricing was Limited-only.
        const permanentPity = advancePermanentBar(state.pity.permanent, cost);
        set({
          currencies: { ...state.currencies, permanentTicket: state.currencies.permanentTicket - cost },
          roster,
          characters,
          pity: { ...state.pity, permanent: permanentPity },
        });
        return results;
      },

      claimLimitedFirst: () => {
        const state = get();
        if (!canClaimLimitedFirst(state.pity.limited.bar, state.pity.limited.claimedFirst)) return false;
        // Banner units, not the whole playable roster (Tanveer, 2026-08-11).
        // The two milestones differ only in who chooses: the first rolls a
        // featured unit for you, the final lets you pick one.
        const characterId = rollUniformFromPool(
          getActiveLimitedBanner().featured,
        );
        if (!characterId) return false;

        const resolution = resolvePullResult(characterId, state.roster, state.characters);
        const roster = resolution.isNew ? [...state.roster, characterId] : state.roster;
        const existing = defaultCharacterProgress(state.characters, characterId);

        // Claiming 300 can itself complete the lap — if 600 was reached and
        // already taken, this was the last outstanding reward.
        const limited = settleLimitedLap({
          ...state.pity.limited,
          claimedFirst: true,
        });
        set({
          roster,
          characters: { ...state.characters, [characterId]: { ...existing, ultLevel: resolution.ultLevel } },
          pity: { ...state.pity, limited },
        });
        return { kind: "character", characterId, ...resolution };
      },

      claimLimitedFinal: (characterId) => {
        const state = get();
        const banner = getActiveLimitedBanner();
        if (
          !canClaimLimitedFinal(
            state.pity.limited.bar,
            state.pity.limited.claimedFinal,
          )
        ) {
          return false;
        }
        if (!banner.featured.includes(characterId)) return false;

        const resolution = resolvePullResult(characterId, state.roster, state.characters);
        const roster = resolution.isNew ? [...state.roster, characterId] : state.roster;
        const existing = defaultCharacterProgress(state.characters, characterId);

        set({
          roster,
          characters: { ...state.characters, [characterId]: { ...existing, ultLevel: resolution.ultLevel } },
          // Claiming 600 no longer resets the lap on its own. If 300 is still
          // outstanding the bar keeps running, so that reward can't be lost —
          // which is exactly what the old `resetLimitedLap` did to it.
          pity: {
            ...state.pity,
            limited: settleLimitedLap({
              ...state.pity.limited,
              claimedFinal: true,
            }),
          },
        });
        return { kind: "character", characterId, ...resolution };
      },

      claimPermanentFinal: (characterId) => {
        const state = get();
        const banner = getPermanentBanner();
        if (
          !canClaimPermanentFinal(
            state.pity.permanent.bar,
            state.pity.permanent.claimedFinal,
          )
        ) {
          return false;
        }
        if (!banner.featured.includes(characterId)) return false;

        const resolution = resolvePullResult(characterId, state.roster, state.characters);
        const roster = resolution.isNew ? [...state.roster, characterId] : state.roster;
        const existing = defaultCharacterProgress(state.characters, characterId);

        set({
          roster,
          characters: { ...state.characters, [characterId]: { ...existing, ultLevel: resolution.ultLevel } },
          pity: {
            ...state.pity,
            permanent: settlePermanentLap({
              ...state.pity.permanent,
              claimedFinal: true,
            }),
          },
        });
        return { kind: "character", characterId, ...resolution };
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
