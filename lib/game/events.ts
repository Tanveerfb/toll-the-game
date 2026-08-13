import { getCharacterById, getCharacterPhases } from "@/lib/game/characterCatalog";
import { RANK_WALLS } from "@/lib/game/accountRank";

/**
 * The events board.
 *
 * `/world-boss` was a page hardcoded to one boss id and one stamina cost, with
 * nowhere for a second fight to go. It's `/events` now, and this is the list it
 * renders (Tanveer, 2026-08-11).
 *
 * The two ascension trials are here because `RANK_WALLS` has declared them at
 * ranks 20 and 40 since the rank system landed and **no screen has ever
 * mentioned them** — a player who hits the rank 20 wall simply stops gaining
 * ranks with no explanation anywhere in the game. Their encounters are
 * Tanveer's to design; what's authored here is the entry, its unlock rule and
 * its stamina cost, so the board can show a locked trial and say what lifts it.
 */

export type EventKind = "boss" | "trial";

export interface GameEvent {
  id: string;
  kind: EventKind;
  /** Short label above the name — "World Boss · Permanent", "Trial · Rank 20". */
  kicker: string;
  name: string;
  summary: string;
  /** Character id fought. Trials with no authored encounter leave this null. */
  enemyId: string | null;
  staminaCost: number;
  /** Account rank required to enter. */
  requiredRank: number;
  /** Repeatable, or a single clear that unlocks something. */
  repeatable: boolean;
  /** The rank wall this clears, for trials. */
  clearsWall?: number;
  /**
   * An Auto Clear Ticket may be spent here, once the player has beaten it
   * manually. Absent = manual only.
   *
   * Molvarr alone for now (Tanveer, 2026-08-13). A non-repeatable event should
   * never carry this: skipping a one-off clear skips the content itself, and
   * the trials exist to be fought.
   */
  autoClearEligible?: boolean;
}

const [FIRST_WALL, SECOND_WALL] = RANK_WALLS;

export const GAME_EVENTS: readonly GameEvent[] = [
  {
    id: "molvarr",
    kind: "boss",
    kicker: "World Boss · Permanent",
    name: "Molvarr",
    summary: "Elite. Scales with world level. Drops ascension materials.",
    enemyId: "molvarr",
    staminaCost: 40,
    requiredRank: 1,
    repeatable: true,
    autoClearEligible: true,
  },
  {
    id: "trial-rank-20",
    kind: "trial",
    kicker: `Trial · Rank ${FIRST_WALL} wall`,
    name: "First Ascension Trial",
    summary: `Clear once to lift the rank ${FIRST_WALL} cap and resume gaining ranks.`,
    // No encounter authored yet — the board shows it, the brief refuses entry.
    enemyId: null,
    staminaCost: 30,
    requiredRank: FIRST_WALL,
    repeatable: false,
    clearsWall: FIRST_WALL,
  },
  {
    id: "trial-rank-40",
    kind: "trial",
    kicker: `Trial · Rank ${SECOND_WALL} wall`,
    name: "Second Ascension Trial",
    summary: `Clear once to lift the rank ${SECOND_WALL} cap.`,
    enemyId: null,
    staminaCost: 30,
    requiredRank: SECOND_WALL,
    repeatable: false,
    clearsWall: SECOND_WALL,
  },
];

export function getEvent(id: string): GameEvent | undefined {
  return GAME_EVENTS.find((event) => event.id === id);
}

/** Why an event can't be entered, or null when it can. */
export function eventLockReason(
  event: GameEvent,
  accountRank: number,
  clearedWalls: number[],
): string | null {
  if (accountRank < event.requiredRank) {
    return `Reaches at account rank ${event.requiredRank}`;
  }
  if (event.clearsWall !== undefined && clearedWalls.includes(event.clearsWall)) {
    return "Already cleared";
  }
  if (event.enemyId === null) {
    // Honest about the real state rather than presenting a dead button.
    return "Encounter not authored yet";
  }
  return null;
}

/** Phase count for the board's summary line; 1 for anything not multi-phase. */
export function eventPhaseCount(event: GameEvent): number {
  if (!event.enemyId) return 0;
  const character = getCharacterById(event.enemyId);
  if (!character) return 0;
  return getCharacterPhases(character).length || 1;
}
