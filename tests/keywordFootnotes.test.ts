import { describe, expect, it } from "vitest";
import { extractKeywordFootnotes } from "@/lib/game/keywordFootnotes";

const GLOSSARY = {
  pierce: "Ignores 50% of the enemy's DEF",
  stun: "Prevents the target from acting for the listed duration.",
  taunt: "Direct all single target enemy attacks to self",
};

describe("extractKeywordFootnotes", () => {
  it("returns an empty list when no glossary term appears in the text", () => {
    const result = extractKeywordFootnotes(
      "Does damage equal to ATK-scaled to one enemy.",
      GLOSSARY,
    );
    expect(result).toEqual([]);
  });

  it("finds a single matching term and returns its glossary meaning", () => {
    const result = extractKeywordFootnotes(
      "Does Pierce damage to one enemy.",
      GLOSSARY,
    );
    expect(result).toEqual([
      { keyword: "pierce", meaning: "Ignores 50% of the enemy's DEF" },
    ]);
  });

  it("orders multiple matches by first appearance in the text, not glossary/dictionary order", () => {
    const result = extractKeywordFootnotes(
      "Applies Stun for 1 turn, then Pierce damage, then Taunt the enemy.",
      GLOSSARY,
    );
    expect(result.map((r) => r.keyword)).toEqual(["stun", "pierce", "taunt"]);
  });

  it("dedupes repeated occurrences of the same term (case-insensitive)", () => {
    const result = extractKeywordFootnotes(
      "Applies Stun. If already Stunned, refreshes stun duration.",
      GLOSSARY,
    );
    expect(result).toHaveLength(1);
    expect(result[0].keyword).toBe("stun");
  });

  it("only matches whole words, not substrings of unrelated words", () => {
    // "stunning" should not match "stun" as a substring.
    const result = extractKeywordFootnotes(
      "This move is a stunning display of force.",
      GLOSSARY,
    );
    expect(result).toEqual([]);
  });

  it("defaults to the full mechanicGlossary when none is passed", () => {
    const result = extractKeywordFootnotes("Applies Pierce damage.");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].keyword).toBe("pierce");
  });
});
