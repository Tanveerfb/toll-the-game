import { describe, expect, it } from "vitest";
import { getCardFrameStyle } from "@/lib/game/cardFrameStyle";

describe("getCardFrameStyle", () => {
  it("R1 gets a thin bronze border with no accent bar", () => {
    const style = getCardFrameStyle(1, false);
    expect(style.tier).toBe("r1");
    expect(style.borderClass).toMatch(/amber-70[0-9]/);
    expect(style.borderClass).toContain("border");
    expect(style.borderClass).not.toContain("border-2");
    expect(style.accentBarClass).toBeUndefined();
  });

  it("R2 gets a thin silver border with no accent bar", () => {
    const style = getCardFrameStyle(2, false);
    expect(style.tier).toBe("r2");
    expect(style.borderClass).toMatch(/zinc-(300|400)/);
    expect(style.borderClass).not.toContain("border-2");
    expect(style.accentBarClass).toBeUndefined();
  });

  it("R3 gets a gold border plus a top accent bar", () => {
    const style = getCardFrameStyle(3, false);
    expect(style.tier).toBe("r3");
    expect(style.borderClass).toMatch(/yellow|amber-400/);
    expect(style.accentBarClass).toBeDefined();
  });

  it("ultimate gets its own cyan/frost frame, distinct from R3 gold, regardless of rank", () => {
    const ultAtRank1 = getCardFrameStyle(1, true);
    const ultAtRank3 = getCardFrameStyle(3, true);
    expect(ultAtRank1.tier).toBe("ultimate");
    expect(ultAtRank3.tier).toBe("ultimate");
    expect(ultAtRank1.borderClass).toContain("cyan");
    expect(ultAtRank1.accentBarClass).toBeDefined();
    expect(ultAtRank1.accentBarClass).toContain("cyan");

    // Not "beyond gold" — must not reuse the R3 gold classes.
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
