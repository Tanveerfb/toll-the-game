import { describe, expect, it } from "vitest";
import {
  DEFAULT_BLEED_TURNS,
  DEFAULT_IGNITE_TURNS,
  defaultDotTurns,
  resolveDotDuration,
} from "@/lib/game/dotDurations";
import { buildRankedSkillDescriptions } from "@/lib/game/descriptionTranslator";
import { getAllCharacters, getCharacterById } from "@/lib/game/characterCatalog";

describe("house defaults (Tanveer, 2026-08-09)", () => {
  it("is 3 turns for Ignite and 2 for Bleed", () => {
    expect(DEFAULT_IGNITE_TURNS).toBe(3);
    expect(DEFAULT_BLEED_TURNS).toBe(2);
    expect(defaultDotTurns("ignite")).toBe(3);
    expect(defaultDotTurns("bleed")).toBe(2);
  });
});

describe("resolveDotDuration", () => {
  it("falls back to the house default when the kit says nothing", () => {
    expect(resolveDotDuration({ type: "ignite" })).toBe(3);
    expect(resolveDotDuration({ type: "bleed" })).toBe(2);
  });

  it("honours an explicit flat duration", () => {
    expect(resolveDotDuration({ type: "ignite", duration: 2 })).toBe(2);
    expect(resolveDotDuration({ type: "bleed", duration: 1 })).toBe(1);
  });

  it("prefers a per-rank duration over a flat one", () => {
    const m = { type: "bleed", duration: 9, durationRanked: [1, 1, 2] };
    expect(resolveDotDuration(m, 0)).toBe(1);
    expect(resolveDotDuration(m, 2)).toBe(2);
  });

  it("treats an explicit 0 as zero rather than falling through to the default", () => {
    expect(resolveDotDuration({ type: "ignite", duration: 0 })).toBe(0);
  });
});

describe("descriptions state the duration", () => {
  it("uses the house default for a proc that doesn't specify one", () => {
    // master_tao's Flaming Palm carries no duration.
    const skill = getCharacterById("master_tao")?.skills.find((s) =>
      s.mechanics?.some((m) => m.type === "ignite"),
    );
    expect(buildRankedSkillDescriptions(skill!)[0]).toContain(
      "Ignite for 3 turns",
    );
  });

  it("states an explicitly authored duration instead of the default", () => {
    const skill = getCharacterById("raider")?.skills.find((s) =>
      s.mechanics?.some((m) => m.type === "ignite"),
    );
    expect(buildRankedSkillDescriptions(skill!)[0]).toContain(
      "Ignite for 2 turns",
    );
  });

  it("tracks a per-rank duration across the rank ladder", () => {
    // No shipped kit scales Bleed by rank any more (Leorio was flattened to a
    // straight 2 turns), so this covers the mechanism directly.
    const skill = {
      skillName: "Ranked Bleed",
      characterId: "test",
      type: "attack",
      statMultiplier: "atk",
      description: "Does damage equal to ATK-scaled to one enemy; applies Bleed.",
      damageRanked: [100, 100, 100],
      mechanics: [{ type: "bleed", damagePercent: 50, durationRanked: [1, 2, 3] }],
    } as never;
    const ranks = buildRankedSkillDescriptions(skill);
    expect(ranks[0]).toContain("Bleed for 1 turn");
    expect(ranks[1]).toContain("Bleed for 2 turns");
    expect(ranks[2]).toContain("Bleed for 3 turns");
  });

  it("says 'turn' not 'turns' for a single turn", () => {
    const skill = {
      skillName: "One Turn",
      characterId: "test",
      type: "attack",
      statMultiplier: "atk",
      description: "Does damage equal to ATK-scaled to one enemy; applies Bleed.",
      damageRanked: [100, 100, 100],
      mechanics: [{ type: "bleed", damagePercent: 50, duration: 1 }],
    } as never;
    const text = buildRankedSkillDescriptions(skill)[0];
    expect(text).toMatch(/Bleed for 1 turn\b/);
    expect(text).not.toContain("1 turns");
  });

  it("Bleed defaults to 2 turns, and a kit that authors one gets what it wrote", () => {
    // Tanveer, 2026-08-09: the house default is 2. Amended 2026-08-21 — a kit
    // may author its own, which `dotDurations.ts` always supported ("unless the
    // kit says otherwise") and this test used to forbid. The Checkpoint
    // Enforcer's Bleed is a deliberate 1.
    //
    // What still holds roster-wide: a Bleed that says nothing lasts 2. The
    // assertion moved from "every Bleed is 2" to "every Bleed is what it says,
    // and silence means 2", which is the rule the module documents.
    getAllCharacters().forEach((character) => {
      character.skills.forEach((skill) => {
        const bleed = skill.mechanics?.find((m) => m.type === "bleed");
        if (!bleed) return;
        const authored = bleed as { duration?: number; durationRanked?: number[] };
        [0, 1, 2].forEach((rank) => {
          const expected =
            authored.durationRanked?.[rank] ?? authored.duration ?? 2;
          expect(
            resolveDotDuration(bleed, rank),
            `${character.id} / ${skill.skillName} R${rank + 1}`,
          ).toBe(expected);
        });
      });
    });
  });

  it("an unauthored Bleed still lasts 2 turns", () => {
    // The half of the old assertion that is still a rule, kept explicit so
    // changing the default fails here rather than silently across the roster.
    expect(resolveDotDuration({ type: "bleed" }, 0)).toBe(2);
    expect(resolveDotDuration({ type: "bleed" }, 2)).toBe(2);
  });

  it("never states a duration twice", () => {
    getAllCharacters().forEach((character) => {
      character.skills.forEach((skill) => {
        const isDot = skill.mechanics?.some(
          (m) => m.type === "ignite" || m.type === "bleed",
        );
        if (!isDot) return;
        buildRankedSkillDescriptions(skill).forEach((text) => {
          expect(text, `${character.id} / ${skill.skillName}`).not.toMatch(
            /for \d+ turns? for \d+ turns?/,
          );
        });
      });
    });
  });

  it("gives every Ignite and Bleed proc in the roster a stated duration", () => {
    getAllCharacters().forEach((character) => {
      character.skills.forEach((skill) => {
        const dot = skill.mechanics?.find(
          (m) => m.type === "ignite" || m.type === "bleed",
        );
        if (!dot) return;
        const label = dot.type === "ignite" ? "Ignite" : "Bleed";
        buildRankedSkillDescriptions(skill).forEach((text, rank) => {
          if (!new RegExp(`\\b${label}\\b`, "i").test(text)) return;
          expect(
            text,
            `${character.id} / ${skill.skillName} R${rank + 1} mentions ${label} without a duration`,
          ).toMatch(new RegExp(`${label} for \\d+ turns?`, "i"));
        });
      });
    });
  });
});
