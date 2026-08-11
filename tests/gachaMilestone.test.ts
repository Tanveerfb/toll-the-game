import { describe, expect, it } from "vitest";
import {
  LIMITED_MILESTONE_FINAL,
  LIMITED_MILESTONE_FIRST,
  PERMANENT_MILESTONE_FINAL,
  advanceLimitedBar,
  advancePermanentBar,
  canClaimLimitedFinal,
  canClaimLimitedFirst,
  canClaimPermanentFinal,
  isLimitedLapComplete,
  settleLimitedLap,
  settlePermanentLap,
  unclaimedLimitedMilestones,
  type LimitedPityState,
} from "@/lib/gacha/milestone";

/**
 * The rules Tanveer set on 2026-08-11:
 *   - thresholds are 500 and 1,000, 1:1 with gems spent
 *   - the final milestone does NOT override the first
 *   - the lap only wraps once every reward on it has been taken
 *
 * The last one is the load-bearing change. The previous model reset the lap the
 * moment the final milestone was claimed, silently destroying an unclaimed
 * first — there was even a test asserting that forfeit as correct behaviour.
 */

const lap = (over: Partial<LimitedPityState> = {}): LimitedPityState => ({
  bannerId: "debut-2026-08",
  bar: 0,
  claimedFirst: false,
  claimedFinal: false,
  ...over,
});

describe("advanceLimitedBar", () => {
  it("accumulates on the same banner", () => {
    expect(advanceLimitedBar(lap({ bar: 100 }), "debut-2026-08", 50)).toEqual(
      lap({ bar: 150 }),
    );
  });

  it("wipes the lap — bar and both flags — when the banner changes", () => {
    const carried = advanceLimitedBar(
      lap({ bar: 900, claimedFirst: true, claimedFinal: true }),
      "new-banner",
      50,
    );
    expect(carried).toEqual({
      bannerId: "new-banner",
      bar: 50,
      claimedFirst: false,
      claimedFinal: false,
    });
  });

  it("adopts the active banner on first-ever spend", () => {
    const first = advanceLimitedBar(
      { bannerId: null, bar: 0, claimedFirst: false, claimedFinal: false },
      "debut-2026-08",
      5,
    );
    expect(first).toEqual(lap({ bar: 5 }));
  });
});

describe("claimability", () => {
  it("needs the exact threshold, not one short", () => {
    expect(canClaimLimitedFirst(LIMITED_MILESTONE_FIRST - 1, false)).toBe(false);
    expect(canClaimLimitedFirst(LIMITED_MILESTONE_FIRST, false)).toBe(true);
    expect(canClaimLimitedFinal(LIMITED_MILESTONE_FINAL - 1, false)).toBe(false);
    expect(canClaimLimitedFinal(LIMITED_MILESTONE_FINAL, false)).toBe(true);
  });

  it("refuses a second claim of the same milestone in one lap", () => {
    expect(canClaimLimitedFirst(LIMITED_MILESTONE_FINAL, true)).toBe(false);
    expect(canClaimLimitedFinal(LIMITED_MILESTONE_FINAL, true)).toBe(false);
  });

  it("keeps the first claimable past the final threshold", () => {
    // The heart of the ruling: reaching the end does not close the door on
    // what came before it.
    expect(canClaimLimitedFirst(LIMITED_MILESTONE_FINAL + 200, false)).toBe(
      true,
    );
  });
});

describe("lap completion", () => {
  it("is not complete while anything is unclaimed", () => {
    expect(
      isLimitedLapComplete(lap({ bar: 1200, claimedFirst: true })),
    ).toBe(false);
    expect(
      isLimitedLapComplete(lap({ bar: 1200, claimedFinal: true })),
    ).toBe(false);
  });

  it("is not complete on claims alone if the bar never reached the end", () => {
    expect(
      isLimitedLapComplete(
        lap({ bar: 600, claimedFirst: true, claimedFinal: true }),
      ),
    ).toBe(false);
  });

  it("is complete once the end is reached and both are taken", () => {
    expect(
      isLimitedLapComplete(
        lap({ bar: 1000, claimedFirst: true, claimedFinal: true }),
      ),
    ).toBe(true);
  });
});

describe("settleLimitedLap", () => {
  it("leaves an incomplete lap exactly as it was", () => {
    // Claiming the final milestone with the first still outstanding used to
    // zero the bar and destroy that reward. Now it changes nothing.
    const held = lap({ bar: 1100, claimedFinal: true });
    expect(settleLimitedLap(held)).toEqual(held);
    expect(canClaimLimitedFirst(held.bar, held.claimedFirst)).toBe(true);
  });

  it("wraps once everything has been taken, keeping the banner id", () => {
    const done = lap({ bar: 1100, claimedFirst: true, claimedFinal: true });
    expect(settleLimitedLap(done)).toEqual(lap({ bar: 0 }));
  });

  it("either claim order reaches the same wrapped state", () => {
    // "Claimable in any order" is only true if the order can't change where
    // you end up. Walk both, settling after each claim as the store does.
    const takeFinalThenFirst = settleLimitedLap({
      ...settleLimitedLap(lap({ bar: 1000, claimedFinal: true })),
      claimedFirst: true,
    });
    const takeFirstThenFinal = settleLimitedLap({
      ...settleLimitedLap(lap({ bar: 1000, claimedFirst: true })),
      claimedFinal: true,
    });
    expect(takeFinalThenFirst).toEqual(takeFirstThenFinal);
    expect(takeFinalThenFirst.bar).toBe(0);
  });
});

describe("unclaimedLimitedMilestones", () => {
  it("names nothing before the first threshold", () => {
    expect(unclaimedLimitedMilestones(lap({ bar: 100 }))).toEqual([]);
  });

  it("names both when the bar is at the end and neither is taken", () => {
    expect(unclaimedLimitedMilestones(lap({ bar: 1000 }))).toEqual([
      LIMITED_MILESTONE_FIRST,
      LIMITED_MILESTONE_FINAL,
    ]);
  });

  it("drops one as it is claimed", () => {
    expect(
      unclaimedLimitedMilestones(lap({ bar: 1000, claimedFirst: true })),
    ).toEqual([LIMITED_MILESTONE_FINAL]);
  });
});

describe("Permanent bar", () => {
  it("accumulates", () => {
    expect(
      advancePermanentBar({ bar: 100, claimedFinal: false }, 10),
    ).toEqual({ bar: 110, claimedFinal: false });
  });

  it("follows the same exact-threshold and once-per-lap rules", () => {
    expect(canClaimPermanentFinal(PERMANENT_MILESTONE_FINAL - 1, false)).toBe(
      false,
    );
    expect(canClaimPermanentFinal(PERMANENT_MILESTONE_FINAL, false)).toBe(true);
    expect(canClaimPermanentFinal(PERMANENT_MILESTONE_FINAL, true)).toBe(false);
  });

  it("wraps only once its single milestone has been taken", () => {
    const held = { bar: 700, claimedFinal: false };
    expect(settlePermanentLap(held)).toEqual(held);
    expect(settlePermanentLap({ bar: 700, claimedFinal: true })).toEqual({
      bar: 0,
      claimedFinal: false,
    });
  });
});

describe("milestone constants", () => {
  it("are the ruled numbers", () => {
    expect(LIMITED_MILESTONE_FIRST).toBe(500);
    expect(LIMITED_MILESTONE_FINAL).toBe(1000);
    // Permanent runs on tickets and was not re-priced with the gem change.
    expect(PERMANENT_MILESTONE_FINAL).toBe(600);
  });
});
