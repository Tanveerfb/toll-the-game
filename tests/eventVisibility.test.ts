import { describe, expect, it } from "vitest";
import {
  eventLockReason,
  GAME_EVENTS,
  getEvent,
  isEventVisible,
  type GameEvent,
} from "@/lib/game/events";
import { RANK_WALLS } from "@/lib/game/accountRank";

/**
 * Visibility and unlock are separate questions (Tanveer, 2026-09-01).
 *
 * The board used to ask only the second one, so a rank-1 player was shown a
 * rank-40 trial gated behind a fight they had never heard of. These tests pin
 * the difference, because the failure mode is silent in both directions: a rule
 * that hides too much makes a wall invisible again, and one that hides too
 * little is the bug being fixed.
 */
const [FIRST_WALL, SECOND_WALL] = RANK_WALLS;

function visible(
  event: GameEvent,
  accountRank: number,
  clearedWalls: number[] = [],
): boolean {
  return isEventVisible(event, { accountRank, clearedWalls });
}

describe("event visibility is separate from event unlock", () => {
  const first = getEvent("trial-rank-20")!;
  const second = getEvent("trial-rank-40")!;
  const boss = getEvent("molvarr")!;

  it("the first trial is visible from rank 1 and locked until its wall", () => {
    // The entire reason this trial is authored: the rank 20 wall is invisible
    // otherwise, and a player simply stops gaining ranks with no explanation.
    expect(visible(first, 1)).toBe(true);
    expect(eventLockReason(first, 1, [])).toBe(
      `Reaches at account rank ${FIRST_WALL}`,
    );
  });

  it("the second trial is hidden until the first wall is cleared", () => {
    expect(visible(second, 1)).toBe(false);
    // At the wall itself, with the first trial still in front of you.
    expect(visible(second, FIRST_WALL)).toBe(false);
    // Cleared, but the rank has not moved past the wall yet.
    expect(visible(second, FIRST_WALL, [FIRST_WALL])).toBe(false);
    // Both conditions: past the wall's rank, and the wall behind you.
    expect(visible(second, FIRST_WALL + 1, [FIRST_WALL])).toBe(true);
  });

  it("the second trial is still locked when it first becomes visible", () => {
    // Visible at 21, enterable at 40 — the point of the split.
    expect(visible(second, FIRST_WALL + 1, [FIRST_WALL])).toBe(true);
    expect(eventLockReason(second, FIRST_WALL + 1, [FIRST_WALL])).toBe(
      `Reaches at account rank ${SECOND_WALL}`,
    );
  });

  it("rank alone does not reveal the second trial", () => {
    // A player who somehow reached 40 without the first clear still should not
    // see it — the gate is both clauses, not either.
    expect(visible(second, SECOND_WALL, [])).toBe(false);
  });

  it("Molvarr is on the board from rank 1", () => {
    // The game's only repeatable fight. Its chapter-9 gate (Tanveer,
    // 2026-09-01) was parked with story mode on 2026-09-26, so nothing may
    // hide it now.
    expect(boss.visibleWhen).toBeUndefined();
    expect(visible(boss, 1)).toBe(true);
  });

  it("every authored event is reachable by some player state", () => {
    // A gate that nothing can satisfy is an event that exists and can never be
    // seen — the one failure this whole mechanism can produce silently.
    const generous = {
      accountRank: 99,
      clearedWalls: [...RANK_WALLS],
      // Every chapter authored and cleared — `has` and `get` both true, so a
      // chapter gate is satisfied rather than merely skipped.
      clearedChapters: new Proxy({}, { get: () => true, has: () => true }) as Record<
        string,
        boolean
      >,
    };
    const unreachable = GAME_EVENTS.filter(
      (event) => !isEventVisible(event, generous),
    );
    expect(unreachable).toEqual([]);
  });
});
