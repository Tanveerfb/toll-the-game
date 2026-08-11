import { describe, expect, it } from "vitest";
import { getCardFrameStyle } from "@/lib/game/cardFrameStyle";

describe("getCardFrameStyle", () => {
  it("R1 gets the dimmest thin border and no accent bar", () => {
    const style = getCardFrameStyle(1, false);
    expect(style.tier).toBe("r1");
    expect(style.borderClass).toContain("border-edge");
    expect(style.borderClass).not.toContain("border-2");
    expect(style.accentBarClass).toBeUndefined();
  });

  it("R2 gets a brighter thin border and no accent bar", () => {
    const style = getCardFrameStyle(2, false);
    expect(style.tier).toBe("r2");
    expect(style.borderClass).toContain("border-edge-strong");
    expect(style.borderClass).not.toContain("border-2");
    expect(style.accentBarClass).toBeUndefined();
  });

  it("R3 gets the brightest border plus a top accent bar", () => {
    const style = getCardFrameStyle(3, false);
    expect(style.tier).toBe("r3");
    expect(style.borderClass).toContain("border-readout");
    expect(style.accentBarClass).toBeDefined();
  });

  it("climbs one achromatic ramp, so no merge tier competes with a unit hue", () => {
    // The ladder used to be bronze -> silver -> gold. Gold is the ultimate's
    // colour everywhere else on the battle screen, so R3 wearing it made the
    // two tiers read as one (2026-08-11).
    const ladder = [1, 2, 3].map(
      (r) => getCardFrameStyle(r as 1 | 2 | 3, false).borderClass,
    );
    for (const cls of ladder) {
      expect(cls).not.toMatch(/el-(red|blue|green|dark|light)/);
      expect(cls).not.toContain("signal");
    }
    expect(new Set(ladder).size).toBe(3);
  });

  it("ultimate gets the gold frame, distinct from R3, regardless of rank", () => {
    const ultAtRank1 = getCardFrameStyle(1, true);
    const ultAtRank3 = getCardFrameStyle(3, true);
    expect(ultAtRank1.tier).toBe("ultimate");
    expect(ultAtRank3.tier).toBe("ultimate");
    expect(ultAtRank1.borderClass).toContain("el-light");
    expect(ultAtRank1.accentBarClass).toBeDefined();
    expect(ultAtRank1.accentBarClass).toContain("el-light");

    // Never signal cyan: that is system chrome (the rail, End Turn, active
    // state), and the ultimate frame used to wear it.
    expect(ultAtRank1.borderClass).not.toContain("signal");

    // A separate tier, not "beyond R3" — must not reuse the R3 classes.
    const r3 = getCardFrameStyle(3, false);
    expect(ultAtRank1.borderClass).not.toBe(r3.borderClass);
    expect(ultAtRank1.accentBarClass).not.toBe(r3.accentBarClass);
  });

  it("star count equals the numeric rank (1-3), independent of ultimate flag", () => {
    expect(getCardFrameStyle(1, false).starCount).toBe(1);
    expect(getCardFrameStyle(2, false).starCount).toBe(2);
    expect(getCardFrameStyle(3, false).starCount).toBe(3);
  });
});
