import { getEvent, type GameEvent } from "@/lib/game/events";
import type { FightRunState } from "@/lib/game/fightRun";
import { isRouteActive } from "@/lib/nav/routes";
import type { BattleOwner } from "@/types/battleOwner";

/** An events-board battle to resume, resolved to its event. */
export type ResumedEventBattle =
  | { kind: "boss"; event: GameEvent; difficulty: number }
  | { kind: "trial"; event: GameEvent; run: FightRunState };

/**
 * The events-board battle that is still live, if there is one — what the
 * page rebuilds its view from after a reload, or after `BattleLock` sends the
 * player back (audit finding F5, 2026-09-26).
 *
 * Null when nothing is live, when another screen owns the battle, or when the
 * owner names an event that no longer exists (content removed between the
 * save and the reload — the lock then has nowhere sensible to rebuild, and
 * the board is the honest fallback).
 */
export function resumedEventBattle(
  battlePhase: string,
  owner: BattleOwner | null,
): ResumedEventBattle | null {
  if (battlePhase === "initializing" || owner?.route !== "/events") return null;
  const event = getEvent(owner.view.eventId);
  if (!event) return null;
  return owner.view.kind === "boss"
    ? { kind: "boss", event, difficulty: owner.view.difficulty }
    : { kind: "trial", event, run: owner.view.run };
}

/**
 * Where the player must be while a battle is unresolved, or null when they may
 * be anywhere.
 *
 * **A battle is unresolved from the moment it starts until its screen resets
 * it** — which includes the victory and defeat cards. Those are not a way out:
 * the boss pays out from the victory card's button, so leaving from there
 * would walk away from the rewards (Tanveer, 2026-09-26: *"they should not be
 * allowed to go anywhere else and ignore the battle"*).
 *
 * A live battle with no owner is a session saved before owners existed. It
 * belongs to practice, which is the one screen that renders any battle it
 * finds.
 */
export function battleLockRoute(
  battlePhase: string,
  owner: BattleOwner | null,
  pathname: string,
): string | null {
  if (battlePhase === "initializing") return null;
  const route = owner?.route ?? "/practice";
  return isRouteActive(route, pathname) ? null : route;
}
