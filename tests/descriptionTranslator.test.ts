import { describe, expect, it } from "vitest";
import {
  buildDescriptionForRank,
  buildSkillKeywordGlossary,
} from "@/lib/game/descriptionTranslator";
import meliodasData from "@/data/characters/meliodas.json";
import gonData from "@/data/characters/gon.json";
import chiaraData from "@/data/characters/chiara.json";
import isoldeData from "@/data/characters/isolde.json";
import type { CharacterSkillData } from "@/lib/game/characterCatalog";

describe("description placeholders", () => {
  it("resolves arbitrary ranked mechanic fields like counterDamagePercent", () => {
    const fullCounter = meliodasData.skills[1] as CharacterSkillData;
    expect(buildDescriptionForRank(fullCounter, 0)).toContain("250% of his ATK");
    expect(buildDescriptionForRank(fullCounter, 2)).toContain("400% of his ATK");
  });

  it("resolves [type.duration] per rank", () => {
    const fullCounter = meliodasData.skills[1] as CharacterSkillData;
    expect(buildDescriptionForRank(fullCounter, 0)).toContain("lasts 1 turn");
    expect(buildDescriptionForRank(fullCounter, 2)).toContain("lasts 2 turn");
  });

  it("builds tiered-wording glossary entries with the skill's real numbers", () => {
    // Value only — duration/cancel flags live in the description text
    const rock = buildSkillKeywordGlossary(
      gonData.skills[0] as CharacterSkillData,
      0,
    );
    // Pill spans the stat too: "Greatly raises ATK" (50% = greatly tier)
    expect(rock["greatly raises atk"]).toBe("Increases ATK by 50%");
    expect(rock["greatly raises"]).toBe("Increases ATK by 50%"); // loose-wording fallback

    // Gon ult: permanent +30% ATK ("permanently raises") and 1-turn +50% DEF
    // ("greatly raises") — permanence is explicit in the wording now.
    const combo = buildSkillKeywordGlossary(
      gonData.ultimate as CharacterSkillData,
      0,
    );
    expect(combo["permanently raises atk"]).toBe("Increases ATK by 30%");
    expect(combo["greatly raises def"]).toBe("Increases DEF by 50%");
  });

  it("wording tiers are asymmetric: massively is 100%+ up, but 80%+ down", () => {
    // Tanveer, 2026-08-09: canonical tiers are 30/50/100 raising and 30/50/80
    // lowering — a stat can never be reduced to zero in battle, so 80% is the
    // ceiling a "lowers" effect is written against.
    const glossaryFor = (mechanics: unknown[]) =>
      buildSkillKeywordGlossary(
        {
          skillName: "T",
          characterId: "t",
          type: "buff",
          statMultiplier: "atk",
          mechanics,
        } as unknown as CharacterSkillData,
        0,
      );

    // 85% up is "greatly", not "massively" — it hasn't reached 100.
    const under = glossaryFor([{ type: "buff", stat: "atk", valuePercent: 85 }]);
    expect(under["permanently greatly raises atk"]).toBe("Increases ATK by 85%");

    // 100% up is where "massively" starts.
    const at = glossaryFor([{ type: "buff", stat: "atk", valuePercent: 100 }]);
    expect(at["permanently massively raises atk"]).toBe("Increases ATK by 100%");

    // Down, 80% is already "massively".
    const down = glossaryFor([
      { type: "debuff", stat: "def", valuePercent: 80, duration: 2 },
    ]);
    expect(down["massively lowers def"]).toBe("Reduces DEF by 80%");

    // ...and 50% down is still only "greatly".
    const mid = glossaryFor([
      { type: "debuff", stat: "def", valuePercent: 50, duration: 2 },
    ]);
    expect(mid["greatly lowers def"]).toBe("Reduces DEF by 50%");
  });

  it("same-tier multi-stat phrases get a combined key ('raises atk and def')", () => {
    const skill = {
      skillName: "T",
      characterId: "t",
      type: "buff",
      statMultiplier: "atk",
      mechanics: [
        { type: "buff", stat: "atk", valuePercent: 30, duration: 1 },
        { type: "buff", stat: "def", valuePercent: 30, duration: 1 },
      ],
    } as unknown as CharacterSkillData;
    const glossary = buildSkillKeywordGlossary(skill, 0);
    expect(glossary["raises atk and def"]).toBe(
      "Increases ATK by 30%; Increases DEF by 30%",
    );
  });

  it("permanent multi-stat raises combine under the permanently key (Killua ult)", () => {
    const skill = {
      skillName: "T",
      characterId: "t",
      type: "ultimate",
      statMultiplier: "atk",
      mechanics: [
        { type: "buff", stat: "atk", valuePercent: 30 },
        { type: "buff", stat: "def", valuePercent: 30 },
      ],
    } as unknown as CharacterSkillData;
    const glossary = buildSkillKeywordGlossary(skill, 0);
    expect(glossary["permanently raises atk and def"]).toBe(
      "Increases ATK by 30%; Increases DEF by 30%",
    );
  });

  describe("clause prose (rulings #62/#63, Tanveer 2026-08-10)", () => {
    const houseRules = chiaraData.skills[1] as unknown as CharacterSkillData;

    it("joins two clauses with 'and' and hides a zero-value one", () => {
      // Asserted on the clause structure, not the multiplier: Severed Ledger's
      // damage number and scaling stat are balance, and pinning the whole
      // rendered string here meant a rebalance broke a test about *prose*
      // (it did, when Isolde moved to HP scaling on 2026-08-13).
      const ledger = isoldeData.skills[1] as unknown as CharacterSkillData;

      const r1 = buildDescriptionForRank(ledger, 0);
      // `lowerUltGauge` is 0 at R1, so its clause — and the "and" that would
      // have joined it — must not appear at all.
      expect(r1).toMatch(/^Does damage equal to \d+% \w+ to all enemies\.$/);
      expect(r1).not.toMatch(/ultimate gauge/i);
      expect(r1).not.toMatch(/ and /);

      const r3 = buildDescriptionForRank(ledger, 2);
      expect(r3).toMatch(
        /^Does damage equal to \d+% \w+ to all enemies and depletes 3 ultimate gauges\.$/,
      );
    });

    it("joins three clauses as 'A, B and C'", () => {
      const evilSpirit = meliodasData.ultimate as unknown as CharacterSkillData;
      expect(buildDescriptionForRank(evilSpirit, 2)).toBe(
        // Index 2 is ult level 3, where Meliodas reads 540 — an ultimate
        // renders at the index it is given, and for an ultimate that index is
        // the ult level rather than a card rank.
        "Cancels buffs and stances, does damage equal to 540% ATK to one enemy and stuns for 2 turns.",
      );
    });

    it("merges seals that share a duration, and only then", () => {
      // R2 seals only Attack Debuff (durations [0,0,2] and [0,1,2]) — nothing
      // to merge. R3 seals both for 2 turns, so they become one clause.
      expect(buildDescriptionForRank(houseRules, 1)).toBe(
        "Does damage equal to 320% ATK to one enemy and seals Attack Debuff skills for 1 turn.",
      );
      expect(buildDescriptionForRank(houseRules, 2)).toBe(
        "Does damage equal to 375% ATK to one enemy, seals Debuff and Attack Debuff skills for 2 turns.",
      );
    });
  });

  it("leaves unresolvable placeholders (keyword highlights) untouched", () => {
    const skill: CharacterSkillData = {
      skillName: "Test",
      description: "[Red] and [Green] allies gain +50% DEF.",
      characterId: "test",
      type: "buff",
      statMultiplier: "atk",
      mechanics: [],
    } as unknown as CharacterSkillData;
    const out = buildDescriptionForRank(skill, 0);
    expect(out).toContain("[Red]");
    expect(out).toContain("[Green]");
  });
});
