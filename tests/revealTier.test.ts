import { describe, expect, it } from "vitest";
import { getRevealTier } from "@/lib/game/revealTier";
import type { Color } from "@/types/color";

const COLORS: Color[] = ["light", "red", "blue", "green", "dark"];

describe("getRevealTier", () => {
  it("basic (isBasic) is the silent, cheap tier — no shake/flash/cutscene", () => {
    const d = getRevealTier({ rank: 1, isUltimate: false, isBasic: true, color: "red" });
    expect(d.tier).toBe("basic");
    expect(d.shake).toBe("none");
    expect(d.flash).toBe("none");
    expect(d.windUp).toBe(false);
    expect(d.beamSweep).toBe(false);
    expect(d.cutscene).toBe(false);
  });

  it("rank 1 reads as 'a move' — projectile + burst, still no shake", () => {
    const d = getRevealTier({ rank: 1, isUltimate: false, color: "blue" });
    expect(d.tier).toBe("r1");
    expect(d.shake).toBe("none");
    expect(d.flash).toBe("none");
    expect(d.windUp).toBe(false);
    expect(d.beamSweep).toBe(false);
  });

  it("rank 2 is a step up — bigger burst, target shake, brightness pulse", () => {
    const d = getRevealTier({ rank: 2, isUltimate: false, color: "green" });
    expect(d.tier).toBe("r2");
    expect(d.shake).not.toBe("none");
    expect(d.burstStrong).toBe(true);
    expect(d.flash).toBe("pulse");
    expect(d.windUp).toBe(false);
  });

  it("rank 3 gets a wind-up, beam sweep, heavy shake + brief flash", () => {
    const d = getRevealTier({ rank: 3, isUltimate: false, color: "dark" });
    expect(d.tier).toBe("r3");
    expect(d.windUp).toBe(true);
    expect(d.beamSweep).toBe(true);
    expect(d.shake).toBe("heavy");
    expect(d.flash).toBe("brief");
    expect(d.cutscene).toBe(false);
  });

  it("ultimate is the only full-cutscene tier, regardless of rank carried alongside it", () => {
    const dRank1 = getRevealTier({ rank: 1, isUltimate: true, color: "light" });
    const dRank3 = getRevealTier({ rank: 3, isUltimate: true, color: "light" });
    for (const d of [dRank1, dRank3]) {
      expect(d.tier).toBe("ultimate");
      expect(d.cutscene).toBe(true);
      expect(d.windUp).toBe(true);
      expect(d.beamSweep).toBe(true);
      expect(d.shake).toBe("heavy");
      expect(d.flash).toBe("white");
    }
  });

  it("isUltimate takes precedence over isBasic", () => {
    const d = getRevealTier({ rank: 1, isUltimate: true, isBasic: true, color: "red" });
    expect(d.tier).toBe("ultimate");
  });

  it("passes the element color straight through untouched for every tier", () => {
    for (const color of COLORS) {
      expect(getRevealTier({ rank: 1, isUltimate: false, color }).color).toBe(color);
      expect(getRevealTier({ rank: 2, isUltimate: false, color }).color).toBe(color);
      expect(getRevealTier({ rank: 3, isUltimate: false, color }).color).toBe(color);
      expect(getRevealTier({ rank: 1, isUltimate: true, color }).color).toBe(color);
      expect(
        getRevealTier({ rank: 1, isUltimate: false, isBasic: true, color }).color,
      ).toBe(color);
    }
  });

  it("only the ultimate tier is a full cutscene — R3 gets shake+flash but not dim/slam/banner", () => {
    const r3 = getRevealTier({ rank: 3, isUltimate: false, color: "red" });
    const ult = getRevealTier({ rank: 3, isUltimate: true, color: "red" });
    expect(r3.cutscene).toBe(false);
    expect(ult.cutscene).toBe(true);
  });
});
