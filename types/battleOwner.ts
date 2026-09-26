import type { FightRunState } from "@/lib/game/fightRun";

/**
 * Which screen a battle belongs to, and enough to rebuild that screen.
 *
 * The battle store persists to sessionStorage so a reload resumes the fight,
 * but the screen that started it (its `view`) was plain React state and did
 * not. So a reload mid-boss-fight came back on the events board with the
 * battle still live in the store and no screen showing it, and `/practice`
 * would render any live battle it found — winning a boss fight there paid
 * nothing (audit finding F5, 2026-09-26).
 *
 * Tanveer's rule for it, 2026-09-26: a reload or a navigation must not take the
 * player out of a battle — *"the battle should just continue… they should not
 * be allowed to go anywhere else and ignore the battle"*. Finishing it or
 * forfeiting it are the only ways out.
 *
 * Plain JSON on purpose: it is persisted with the battle.
 */
export type BattleOwner =
  | { route: "/practice" }
  | {
      route: "/events";
      view:
        | { kind: "boss"; eventId: string; difficulty: number }
        | { kind: "trial"; eventId: string; run: FightRunState };
    };
