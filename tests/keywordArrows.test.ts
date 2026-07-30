import { describe, expect, it } from "vitest";
import { arrowDirectionForKeyword } from "@/components/ui/KeyworkHighlighter";
import { mechanicGlossary } from "@/lib/game/mechanicGlossary";

describe("arrowDirectionForKeyword — Dokkan-style stat-change arrows (passives only)", () => {
  it("renders an up-arrow for a buff-category keyword when showStatArrows is true", () => {
    expect(arrowDirectionForKeyword("raises", true)).toBe("up");
    expect(arrowDirectionForKeyword("greatly raises", true)).toBe("up");
    expect(arrowDirectionForKeyword("permanently massively raises", true)).toBe(
      "up",
    );
  });

  it("renders a down-arrow for a debuff-category keyword when showStatArrows is true", () => {
    expect(arrowDirectionForKeyword("lowers", true)).toBe("down");
    expect(arrowDirectionForKeyword("greatly lowers", true)).toBe("down");
  });

  it("renders no arrow for non buff/debuff categories (heal/stance/cancel/chance)", () => {
    expect(arrowDirectionForKeyword("cleanse", true)).toBeNull(); // heal
    expect(arrowDirectionForKeyword("counters", true)).toBeNull(); // stance
    expect(arrowDirectionForKeyword("cancel buffs", true)).toBeNull(); // cancel
    expect(arrowDirectionForKeyword("medium chance", true)).toBeNull(); // chance
  });

  it("renders no arrow for an unrecognized keyword", () => {
    expect(arrowDirectionForKeyword("not-a-real-keyword", true)).toBeNull();
  });

  it("renders no arrow when showStatArrows is false or omitted — the skill-description regression guard", () => {
    expect(arrowDirectionForKeyword("raises", false)).toBeNull();
    expect(arrowDirectionForKeyword("lowers", false)).toBeNull();
    expect(arrowDirectionForKeyword("raises", undefined)).toBeNull();
  });

  it("is case-insensitive on the keyword", () => {
    expect(arrowDirectionForKeyword("RAISES", true)).toBe("up");
    expect(arrowDirectionForKeyword("Lowers", true)).toBe("down");
  });

  it("also recognizes the passive-only stat-change verbs (gains/loses/increases/reduces/rises/falls)", () => {
    expect(arrowDirectionForKeyword("gains", true)).toBe("up");
    expect(arrowDirectionForKeyword("increases", true)).toBe("up");
    expect(arrowDirectionForKeyword("rises", true)).toBe("up");
    expect(arrowDirectionForKeyword("loses", true)).toBe("down");
    expect(arrowDirectionForKeyword("reduces", true)).toBe("down");
    expect(arrowDirectionForKeyword("falls", true)).toBe("down");
  });

  it("regression guard: the passive-only verbs must NOT be in the base mechanicGlossary — several (increases/reduces/gains) appear in ordinary skill-description prose (Duke, Leorio, Yalina) where they must stay plain, unhighlighted text", () => {
    const passiveOnlyVerbs = [
      "gains",
      "loses",
      "increases",
      "reduces",
      "rises",
      "falls",
    ];
    passiveOnlyVerbs.forEach((verb) => {
      expect(verb in mechanicGlossary).toBe(false);
    });
  });
});
