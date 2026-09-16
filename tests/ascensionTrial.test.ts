import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "@/store/playerStore";
import {
  MAX_ACCOUNT_RANK,
  RANK_WALLS,
  isRankWalled,
  rankProgress,
  xpToNextRank,
} from "@/lib/game/accountRank";
import { GAME_EVENTS, getEvent } from "@/lib/game/events";

/**
 * The ascension trial loop — clearing a wall, and what a trial must not do.
 *
 * `clearsWall` was authored on both trials the day the events board was built
 * and `clearRankWall` was written to serve it, but **nothing outside a test
 * ever called that action** (found 2026-09-16). A player could beat a trial
 * and watch their rank stay exactly where it was, which is the one thing the
 * trial exists to change.
 *
 * `app/events/page.tsx` now branches on `event.kind` in the victory handler.
 * These tests pin the store half of that branch and the data invariants the
 * branch relies on; the JSX half is unexercised until Tanveer authors an
 * encounter, since both trials still carry `enemyId: null`.
 */
const [FIRST_WALL, SECOND_WALL] = RANK_WALLS;

describe("clearing a wall", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      account: { rank: FIRST_WALL, xp: 0, clearedWalls: [] },
    });
  });

  it("lifts the cap the trial names", () => {
    expect(isRankWalled(FIRST_WALL, [])).toBe(true);
    usePlayerStore.getState().clearRankWall(FIRST_WALL);
    const { account } = usePlayerStore.getState();
    expect(account.clearedWalls).toContain(FIRST_WALL);
    expect(isRankWalled(account.rank, account.clearedWalls)).toBe(false);
  });

  it("pays out every rank banked against the wall, at once", () => {
    // The wall banks XP rather than discarding it, so a player who kept
    // playing while stuck is owed several ranks the moment it falls. This is
    // why the results screen reports rankBefore → rankAfter instead of "+1".
    const banked = xpToNextRank(FIRST_WALL) + xpToNextRank(FIRST_WALL + 1);
    usePlayerStore.setState({
      account: { rank: FIRST_WALL, xp: banked, clearedWalls: [] },
    });
    usePlayerStore.getState().clearRankWall(FIRST_WALL);
    expect(usePlayerStore.getState().account.rank).toBe(FIRST_WALL + 2);
  });

  it("refills stamina when the cash-out actually moves the rank", () => {
    usePlayerStore.setState({
      account: { rank: FIRST_WALL, xp: xpToNextRank(FIRST_WALL), clearedWalls: [] },
      stamina: { current: 3, updatedAt: Date.now() },
    });
    usePlayerStore.getState().clearRankWall(FIRST_WALL);
    expect(usePlayerStore.getState().stamina.current).toBeGreaterThan(3);
  });

  it("is idempotent — a re-clear pays nothing", () => {
    // `repeatable: false` is a UI promise; this is the store keeping it even
    // if the screen ever lets the fight be entered twice.
    usePlayerStore.setState({
      account: { rank: FIRST_WALL, xp: xpToNextRank(FIRST_WALL), clearedWalls: [] },
    });
    usePlayerStore.getState().clearRankWall(FIRST_WALL);
    const after = usePlayerStore.getState().account;
    usePlayerStore.getState().clearRankWall(FIRST_WALL);
    expect(usePlayerStore.getState().account).toEqual(after);
  });

  it("leaves the next wall standing", () => {
    usePlayerStore.setState({
      account: { rank: SECOND_WALL, xp: 0, clearedWalls: [FIRST_WALL] },
    });
    expect(isRankWalled(SECOND_WALL, [FIRST_WALL])).toBe(true);
    expect(rankProgress({ rank: SECOND_WALL, xp: 0 }, [FIRST_WALL])).toBeNull();
  });

  it("does not lift the level cap itself", () => {
    // MAX_ACCOUNT_RANK is walled unconditionally and no trial clears it —
    // clearing the last wall must not accidentally open the ceiling.
    usePlayerStore.setState({
      account: {
        rank: MAX_ACCOUNT_RANK,
        xp: 999_999,
        clearedWalls: [FIRST_WALL, SECOND_WALL],
      },
    });
    usePlayerStore.getState().clearRankWall(SECOND_WALL);
    expect(usePlayerStore.getState().account.rank).toBe(MAX_ACCOUNT_RANK);
  });
});

describe("what a trial is allowed to be", () => {
  const trials = GAME_EVENTS.filter((event) => event.kind === "trial");

  it("there is a trial for every declared wall", () => {
    // A wall with no trial is a dead end: XP accrues, rank stops, and the
    // board never mentions why. That was the state RANK_WALLS shipped in.
    for (const wall of RANK_WALLS) {
      expect(trials.some((trial) => trial.clearsWall === wall)).toBe(true);
    }
  });

  it("every trial names the wall it clears", () => {
    for (const trial of trials) {
      expect(trial.clearsWall).toBeDefined();
    }
  });

  it("no trial is repeatable, and no one-off is Auto Clear eligible", () => {
    // Skipping a one-off clear skips the content itself, and a manual clear
    // is what unlocks Auto Clear — so an eligible one-off could unlock a skip
    // for a fight that only ever happens once.
    for (const trial of trials) expect(trial.repeatable).toBe(false);
    for (const event of GAME_EVENTS) {
      if (!event.repeatable) expect(event.autoClearEligible).toBeUndefined();
    }
  });

  it("the boss clears no wall", () => {
    // The victory handler branches on `kind`, so a boss carrying `clearsWall`
    // would be a wall nothing can ever lift.
    expect(getEvent("molvarr")!.clearsWall).toBeUndefined();
  });
});
