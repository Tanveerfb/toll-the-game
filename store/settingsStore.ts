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
  /** Dev-only: Claude plays the enemy side instead of the scripted AI.
   *  Persisted so it survives the reloads a dev session is full of. */
  duelMode: boolean;
  setDuelMode: (on: boolean) => void;
  /**
   * Show the grey "effect" entries — the uncancellable ones (ruling #30).
   * Off by default: nothing about them is actionable, and they crowded out
   * the buffs and debuffs that actually inform a decision (Tanveer,
   * 2026-08-11). Toggled from the unit detail panel; a preference rather
   * than battle state, so it lives here and survives reloads.
   */
  showUncancellableEffects: boolean;
  setShowUncancellableEffects: (show: boolean) => void;
  /**
   * Show characters the player doesn't own in the archive. Off by default:
   * the archive now doubles as the roster screen (it took that job from
   * `/profile` on 2026-08-11), and a roster that leads with 20 locked units
   * isn't a roster. The toggle is right there for browsing the full catalogue.
   */
  showUnownedCharacters: boolean;
  setShowUnownedCharacters: (show: boolean) => void;
  /**
   * Character whose portrait stands in as the account's display picture, or
   * `null` for the initial-letter default.
   *
   * Deliberately here and not in `playerStore`: that store's cloud sync writes
   * a fixed field list (roster/currencies/inventory/characters/stamina/pity)
   * and is versioned, so adding to it means a schema bump on every existing
   * Firestore document. This is cosmetic and device-local until that's worth
   * doing — see docs/STATUS.md.
   */
  avatarCharacterId: string | null;
  setAvatarCharacterId: (id: string | null) => void;
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
      duelMode: false,
      setDuelMode: (on) => set({ duelMode: on }),
      showUncancellableEffects: false,
      setShowUncancellableEffects: (show) =>
        set({ showUncancellableEffects: show }),
      showUnownedCharacters: false,
      setShowUnownedCharacters: (show) => set({ showUnownedCharacters: show }),
      avatarCharacterId: null,
      setAvatarCharacterId: (id) => set({ avatarCharacterId: id }),
    }),
    { name: "toll-settings" },
  ),
);
