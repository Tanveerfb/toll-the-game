import { describe, expect, it } from "vitest";
import {
  isStructuredPassiveMarkup,
  parsePassiveMarkup,
} from "@/lib/game/passiveMarkup";

describe("isStructuredPassiveMarkup", () => {
  it("false for old-style flat prose", () => {
    expect(
      isStructuredPassiveMarkup(
        "Before using a skill, consumes 5% max HP (cannot reduce self below 1 HP).",
      ),
    ).toBe(false);
  });

  it("true when a '# ' heading line is present", () => {
    expect(
      isStructuredPassiveMarkup(
        "# When using a skill\n- Current HP 5% 👇",
      ),
    ).toBe(true);
  });
});

describe("parsePassiveMarkup", () => {
  it("Ban: one heading, one bullet, one comment", () => {
    const sections = parsePassiveMarkup(
      [
        "# When finishing a turn without receiving damage",
        "- All enemies max HP 8% 👇 (Max 5 times) (Uncancellable)",
        "-- Effects reset after receiving damage",
      ].join("\n"),
    );
    expect(sections).toEqual([
      {
        heading: "When finishing a turn without receiving damage",
        bullets: [
          {
            text: "All enemies max HP 8% 👇 (Max 5 times) (Uncancellable)",
            comments: ["Effects reset after receiving damage"],
          },
        ],
      },
    ]);
  });

  it("Batra: one heading, one bullet, two comments on the same bullet", () => {
    const sections = parsePassiveMarkup(
      [
        "# When using a skill",
        "- Current hp 5% 👇",
        "-- this effect cannot cause the character to be defeated.",
        "-- hp cannot go below 1",
      ].join("\n"),
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].bullets).toHaveLength(1);
    expect(sections[0].bullets[0].comments).toEqual([
      "this effect cannot cause the character to be defeated.",
      "hp cannot go below 1",
    ]);
  });

  it("Chiara: two headings — a multi-bullet one and a single-bullet one with its own comment-free bullet", () => {
    const sections = parsePassiveMarkup(
      [
        "# At the start of every turn, gain one of the following effects",
        "- All enemies atk 20% 👇 for 1 turn",
        "- All allies ATK 15% 👆 and DEF 15% 👆 for 1 turn",
        "- Damage reduction 30% 👆 for 1 turn",
        "# At the start of turn 3",
        "- Ranks up own cards in the deck by 1 level (Once only)",
      ].join("\n"),
    );
    expect(sections).toHaveLength(2);
    expect(sections[0].heading).toBe(
      "At the start of every turn, gain one of the following effects",
    );
    expect(sections[0].bullets).toHaveLength(3);
    expect(sections[1].heading).toBe("At the start of turn 3");
    expect(sections[1].bullets).toEqual([
      { text: "Ranks up own cards in the deck by 1 level (Once only)", comments: [] },
    ]);
  });

  it("a comment line with no preceding bullet is dropped, not crashed on", () => {
    const sections = parsePassiveMarkup("# Heading only\n-- orphan comment");
    expect(sections).toEqual([{ heading: "Heading only", bullets: [] }]);
  });

  it("a bullet with no preceding heading still parses (empty heading bucket)", () => {
    const sections = parsePassiveMarkup("- a bullet with no heading");
    expect(sections).toEqual([
      { heading: "", bullets: [{ text: "a bullet with no heading", comments: [] }] },
    ]);
  });

  it("blank lines are ignored", () => {
    const sections = parsePassiveMarkup(
      "# Heading\n\n- Bullet one\n\n-- comment\n\n",
    );
    expect(sections).toEqual([
      {
        heading: "Heading",
        bullets: [{ text: "Bullet one", comments: ["comment"] }],
      },
    ]);
  });
});
