/**
 * The Epic Battles clear record - pure logic, no store.
 *
 * A stage pays nothing on a clear (Tanveer, 2026-10-03); rewards will come
 * later from a separate missions section ("clear stage 1", "clear stage 1 with
 * a human-only team"). Missions are not built, so this record is shaped to
 * answer them **retroactively**: whatever a mission will ask must be
 * computable from what is stored here, for clears made before the mission
 * existed.
 *
 * Per stage key (`"<arcId>/<stageId>"`, `epicBattles.ts`):
 *
 * - `clears`, `firstClearAt`, `lastClearAt` - "clear stage 1", "clear it N
 *   times".
 * - `bestTurns` - "clear it in under N turns".
 * - `teams` - the **distinct sorted character-id sets** that cleared it, which
 *   is what a team-shape mission ("human-only", "no healer", "four units")
 *   evaluates by looking each id up in the catalog.
 *
 * **Why `teams` is a set and capped.** The stage is repeatable without limit,
 * so a per-clear log would grow forever in a document that also syncs to
 * Firestore. Distinct teams are bounded by what a player owns, and
 * `EPIC_TEAMS_CAP` bounds it outright. The cap drops the team that has gone
 * longest without clearing the stage; a team that clears again is moved to the
 * newest slot, so a player's habitual team is never the one dropped.
 */

export interface EpicClearRecord {
  /** Total clears, unbounded. */
  clears: number;
  /** Epoch ms of the first clear. */
  firstClearAt: number;
  /** Epoch ms of the most recent clear. */
  lastClearAt: number;
  /** Fewest player turns any clear took. */
  bestTurns: number;
  /** Distinct teams that cleared it, each a sorted list of character ids,
   *  oldest first. */
  teams: string[][];
}

/** Stage key -> record. A stage never cleared has no entry. */
export type EpicClears = Record<string, EpicClearRecord>;

/** Most distinct teams kept per stage. */
export const EPIC_TEAMS_CAP = 30;

/** A team as it is compared and stored: distinct ids, sorted. */
export function normaliseTeam(teamIds: readonly string[]): string[] {
  return [...new Set(teamIds)].sort();
}

function sameTeam(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Returns `clears` with one more clear of `key` folded in. Never mutates.
 *
 * `turns` is the player's turn count for the winning fight; a non-finite or
 * sub-1 value is clamped to 1 rather than rejected, because dropping a clear
 * over a bad counter would lose the clear itself.
 */
export function applyEpicClear(
  clears: EpicClears,
  key: string,
  teamIds: readonly string[],
  turns: number,
  now: number,
): EpicClears {
  const team = normaliseTeam(teamIds);
  const safeTurns = Number.isFinite(turns) ? Math.max(1, Math.round(turns)) : 1;
  const previous = clears[key];

  if (!previous) {
    return {
      ...clears,
      [key]: {
        clears: 1,
        firstClearAt: now,
        lastClearAt: now,
        bestTurns: safeTurns,
        teams: team.length > 0 ? [team] : [],
      },
    };
  }

  // Moving a repeat to the newest slot is what makes "oldest dropped" mean
  // "longest unused" rather than "first ever seen".
  const others = previous.teams.filter((known) => !sameTeam(known, team));
  const teams = (team.length > 0 ? [...others, team] : others).slice(
    -EPIC_TEAMS_CAP,
  );

  return {
    ...clears,
    [key]: {
      clears: previous.clears + 1,
      firstClearAt: previous.firstClearAt,
      lastClearAt: now,
      bestTurns: Math.min(previous.bestTurns, safeTurns),
      teams,
    },
  };
}
