import { describe, expect, it } from "vitest";
import {
  LIMITED_MILESTONE_300,
  LIMITED_MILESTONE_600,
  PERMANENT_MILESTONE_600,
  advanceLimitedBar,
  advancePermanentBar,
  canClaimLimited300,
  canClaimLimited600,
  canClaimPermanent600,
  resetLimitedLap,
  resetPermanentLap,
  type LimitedPityState,
} from "@/lib/gacha/milestone";

describe("advanceLimitedBar", () => {
  it("accumulates spend on the same banner", () => {
    const state: LimitedPityState = { bannerId: "debut-2026-08", bar: 100, claimed300: false };
    const result = advanceLimitedBar(state, "debut-2026-08", 30);
    expect(result).toEqual({ bannerId: "debut-2026-08", bar: 130, claimed300: false });
  });

  it("resets to 0 (and clears claimed300) before adding spend when the banner changes", () => {
    const state: LimitedPityState = { bannerId: "old-banner", bar: 250, claimed300: true };
    const result = advanceLimitedBar(state, "new-banner", 30);
    expect(result).toEqual({ bannerId: "new-banner", bar: 30, claimed300: false });
  });

  it("adopts the active banner id on first-ever spend (bannerId starts null)", () => {
    const state: LimitedPityState = { bannerId: null, bar: 0, claimed300: false };
    const result = advanceLimitedBar(state, "debut-2026-08", 3);
    expect(result).toEqual({ bannerId: "debut-2026-08", bar: 3, claimed300: false });
  });
});

describe("canClaimLimited300 / canClaimLimited600", () => {
  it("is not claimable just under the threshold", () => {
    expect(canClaimLimited300(299, false)).toBe(false);
    expect(canClaimLimited600(599)).toBe(false);
  });

  it("is claimable at exactly the threshold", () => {
    expect(canClaimLimited300(300, false)).toBe(true);
    expect(canClaimLimited600(600)).toBe(true);
  });

  it("300 is not claimable again once already claimed this lap", () => {
    expect(canClaimLimited300(450, true)).toBe(false);
  });

  it("600 stays claimable regardless of the 300 claimed flag (independent)", () => {
    expect(canClaimLimited600(600)).toBe(true);
  });
});

describe("resetLimitedLap", () => {
  it("zeroes the bar and clears claimed300, keeping the banner id", () => {
    const state: LimitedPityState = { bannerId: "debut-2026-08", bar: 650, claimed300: true };
    expect(resetLimitedLap(state)).toEqual({ bannerId: "debut-2026-08", bar: 0, claimed300: false });
  });

  it("forfeits an unclaimed 300 when 600 is claimed (claimed300 was false going in)", () => {
    const state: LimitedPityState = { bannerId: "debut-2026-08", bar: 650, claimed300: false };
    const result = resetLimitedLap(state);
    expect(result).toEqual({ bannerId: "debut-2026-08", bar: 0, claimed300: false });
    expect(canClaimLimited300(result.bar, result.claimed300)).toBe(false);
  });
});

describe("Permanent bar", () => {
  it("advancePermanentBar accumulates", () => {
    expect(advancePermanentBar(100, 10)).toBe(110);
  });

  it("canClaimPermanent600 follows the same exact-threshold rule", () => {
    expect(canClaimPermanent600(599)).toBe(false);
    expect(canClaimPermanent600(600)).toBe(true);
  });

  it("resetPermanentLap zeroes the bar", () => {
    expect(resetPermanentLap()).toBe(0);
  });
});

describe("milestone constants", () => {
  it("are the locked spec numbers", () => {
    expect(LIMITED_MILESTONE_300).toBe(300);
    expect(LIMITED_MILESTONE_600).toBe(600);
    expect(PERMANENT_MILESTONE_600).toBe(600);
  });
});
