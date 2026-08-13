import { beforeEach, describe, expect, it } from "vitest";
import {
  AUTO_CLEAR_TICKETS_PER_RANK,
  autoClearAvailability,
  maxBatchSize,
  runsAffordable,
} from "@/lib/game/autoClear";
import { usePlayerStore, CURRENT_PLAYER_STATE_VERSION } from "@/store/playerStore";
import { STAMINA_CAP } from "@/lib/game/stamina";
import { GAME_EVENTS, getEvent } from "@/lib/game/events";
import { tierKey } from "@/lib/game/worldBossRewards";

/**
 * Auto Clear (Tanveer, 2026-08-13).
 *
 * The property everything else rests on: a ticket buys **time, not
 * resources**. Stamina is charged in full per skipped run, so auto-clearing
 * can never produce a material the player couldn't have farmed manually.
 * Several tests below exist purely to keep that true.
 */

const MOLVARR = 40;

describe("affordability", () => {
  it("is limited by whichever of tickets or stamina runs out first", () => {
    expect(runsAffordable(10, 120, MOLVARR)).toBe(3); // stamina-bound
    expect(runsAffordable(2, 120, MOLVARR)).toBe(2); // ticket-bound
    expect(runsAffordable(0, 120, MOLVARR)).toBe(0);
    expect(runsAffordable(5, 39, MOLVARR)).toBe(0);
  });

  it("never returns a partial run", () => {
    expect(runsAffordable(5, 99, MOLVARR)).toBe(2);
  });

  it("caps a batch at one full bar even with tickets to spare", () => {
    // A rank-up mid-batch refills stamina, so an uncapped batch could run far
    // longer than the player agreed to.
    expect(maxBatchSize(MOLVARR)).toBe(Math.floor(STAMINA_CAP / MOLVARR));
  });
});

describe("availability reports one actionable blocker", () => {
  const base = {
    eligible: true,
    clearedEvents: [tierKey("molvarr", 1)],
    eventId: "molvarr",
    difficulty: 1,
    tickets: 3,
    stamina: 120,
    staminaCost: MOLVARR,
  };

  it("allows a cleared, eligible, funded event", () => {
    const result = autoClearAvailability(base);
    expect(result.blocker).toBeNull();
    expect(result.affordable).toBe(3);
  });

  it("refuses an event that doesn't allow Auto Clear at all", () => {
    expect(autoClearAvailability({ ...base, eligible: false }).blocker).toBe(
      "ineligible",
    );
  });

  it("refuses a fight the player has never beaten", () => {
    // The gate that stops a new account skipping content it hasn't seen.
    const result = autoClearAvailability({ ...base, clearedEvents: [] });
    expect(result.blocker).toBe("locked");
    expect(result.unlocked).toBe(false);
    expect(result.affordable).toBe(0);
  });

  it("unlocks PER DIFFICULTY — clearing tier 1 doesn't open tier 4", () => {
    // The hole the old reward-multiplier model would have left: farm the
    // hardest table off the easiest clear. Difficulty is content now, so each
    // tier has to be earned (Tanveer, 2026-08-13).
    expect(autoClearAvailability({ ...base, difficulty: 4 }).blocker).toBe(
      "locked",
    );
    expect(
      autoClearAvailability({
        ...base,
        difficulty: 4,
        clearedEvents: [tierKey("molvarr", 1), tierKey("molvarr", 4)],
      }).blocker,
    ).toBeNull();
  });

  it("reports missing tickets before missing stamina", () => {
    expect(
      autoClearAvailability({ ...base, tickets: 0, stamina: 0 }).blocker,
    ).toBe("no-tickets");
  });

  it("reports stamina once tickets are in hand", () => {
    expect(autoClearAvailability({ ...base, stamina: 10 }).blocker).toBe(
      "no-stamina",
    );
  });
});

describe("the event registry", () => {
  it("marks Molvarr eligible and nothing else", () => {
    expect(getEvent("molvarr")?.autoClearEligible).toBe(true);
    const others = GAME_EVENTS.filter((e) => e.id !== "molvarr");
    expect(others.every((e) => e.autoClearEligible !== true)).toBe(true);
  });

  it("never marks a one-clear event eligible", () => {
    // Skipping a non-repeatable clear skips the content itself.
    for (const event of GAME_EVENTS) {
      if (event.autoClearEligible) expect(event.repeatable).toBe(true);
    }
  });
});

describe("the store", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      autoClearTickets: 0,
      clearedEvents: [],
      stamina: { current: STAMINA_CAP, updatedAt: Date.now() },
      account: { rank: 1, xp: 0, clearedWalls: [] },
    });
  });

  it("spends a ticket and the stamina together, or neither", () => {
    usePlayerStore.setState({ autoClearTickets: 1 });
    expect(usePlayerStore.getState().spendAutoClearRun(MOLVARR)).toBe(true);
    expect(usePlayerStore.getState().autoClearTickets).toBe(0);

    // Out of tickets: stamina must be untouched.
    const before = usePlayerStore.getState().stamina.current;
    expect(usePlayerStore.getState().spendAutoClearRun(MOLVARR)).toBe(false);
    expect(usePlayerStore.getState().stamina.current).toBe(before);
  });

  it("does not consume a ticket when stamina is short", () => {
    usePlayerStore.setState({
      autoClearTickets: 5,
      stamina: { current: 10, updatedAt: Date.now() },
    });
    expect(usePlayerStore.getState().spendAutoClearRun(MOLVARR)).toBe(false);
    expect(usePlayerStore.getState().autoClearTickets).toBe(5);
  });

  it("records a manual clear once, idempotently", () => {
    usePlayerStore.getState().recordManualClear(tierKey("molvarr", 1));
    usePlayerStore.getState().recordManualClear(tierKey("molvarr", 1));
    expect(usePlayerStore.getState().clearedEvents).toEqual(["molvarr@1"]);
  });

  it("keeps each difficulty's clear separate", () => {
    usePlayerStore.getState().recordManualClear(tierKey("molvarr", 1));
    usePlayerStore.getState().recordManualClear(tierKey("molvarr", 3));
    expect(usePlayerStore.getState().clearedEvents).toEqual([
      "molvarr@1",
      "molvarr@3",
    ]);
  });

  it("pays tickets PER RANK when one grant crosses several", () => {
    // The trap: `grantAccountXp` applies banked XP in a loop, and
    // `clearRankWall` re-applies everything banked at a wall. A flat grant
    // would underpay exactly the players who were blocked longest.
    usePlayerStore.getState().grantAccountXpAction(100_000);
    const { account, autoClearTickets } = usePlayerStore.getState();
    const ranksGained = account.rank - 1;
    expect(ranksGained).toBeGreaterThan(1);
    expect(autoClearTickets).toBe(ranksGained * AUTO_CLEAR_TICKETS_PER_RANK);
  });

  it("pays nothing when a grant doesn't rank up", () => {
    usePlayerStore.getState().grantAccountXpAction(1);
    expect(usePlayerStore.getState().autoClearTickets).toBe(0);
  });

  it("is on the current persisted version", () => {
    expect(CURRENT_PLAYER_STATE_VERSION).toBe(8);
  });
});
