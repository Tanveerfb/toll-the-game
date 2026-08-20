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

    // Gon ult: a permanent +30% ATK and a 1-turn +50% DEF, side by side in
    // one sentence. Since 2026-08-19 the permanent one carries no "permanently"
    // prefix — in the text or in the key — so the two pills are "raises" and
    // "greatly raises". They share a substring and that is fine: they sit at
    // different positions, and the extractor matches longest-first without
    // overlapping.
    const combo = buildSkillKeywordGlossary(
      gonData.ultimate as CharacterSkillData,
      0,
    );
    expect(combo["raises atk"]).toBe("Increases ATK by 30%");
    expect(combo["greatly raises def"]).toBe("Increases DEF by 50%");
    expect(Object.keys(combo).some((k) => k.includes("permanently"))).toBe(
      false,
    );
  });

  it("tier words name exact values, and an off-scale value gets none", () => {
    // Tanveer, 2026-08-19, overturning the earlier threshold reading:
    // *"'raises' MUST be 30%. It can't fluctuate, even by 1%. If I allow it,
    // next time you would propose 'greatly raises' to accept even 55%."*
    // The scale is 30/50/100 raising and 30/50/80 lowering — asymmetric at the
    // top because a stat can never be reduced to zero in battle.
    //
    // An off-scale value is written "Increases/Decreases X by N%" with the
    // number in the text, so there is nothing for a pill to reveal and none is
    // built. This test previously asserted 85% up rendered "greatly raises",
    // which is exactly the drift the ruling exists to stop.
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

    // 30 / 50 / 100 up.
    expect(
      glossaryFor([{ type: "buff", stat: "atk", valuePercent: 30 }])[
        "raises atk"
      ],
    ).toBe("Increases ATK by 30%");
    expect(
      glossaryFor([{ type: "buff", stat: "atk", valuePercent: 50 }])[
        "greatly raises atk"
      ],
    ).toBe("Increases ATK by 50%");
    expect(
      glossaryFor([{ type: "buff", stat: "atk", valuePercent: 100 }])[
        "massively raises atk"
      ],
    ).toBe("Increases ATK by 100%");

    // Down, 80 is already "massively" and 50 is still only "greatly".
    expect(
      glossaryFor([
        { type: "debuff", stat: "def", valuePercent: 80, duration: 2 },
      ])["massively lowers def"],
    ).toBe("Reduces DEF by 80%");
    expect(
      glossaryFor([
        { type: "debuff", stat: "def", valuePercent: 50, duration: 2 },
      ])["greatly lowers def"],
    ).toBe("Reduces DEF by 50%");

    // Off the scale in either direction: no key at all, at any spelling.
    for (const value of [20, 33, 45, 85, 99]) {
      const off = glossaryFor([{ type: "buff", stat: "atk", valuePercent: value }]);
      expect(Object.keys(off), `${value}% should produce no tier pill`).toEqual(
        [],
      );
    }
    const offDown = glossaryFor([
      { type: "debuff", stat: "def", valuePercent: 70, duration: 2 },
    ]);
    expect(Object.keys(offDown)).toEqual([]);
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

  it("a permanent multi-stat raise keys off the bare tier word (Killua ult)", () => {
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
    // No duration anywhere = permanent, and the reader is told that by the
    // absence of a duration rather than by the word (Tanveer, 2026-08-19:
    // *"we don't need 'permanently' in the description… players will notice
    // this on their own"*). A prefixed key would no longer match the text.
    const glossary = buildSkillKeywordGlossary(skill, 0);
    expect(glossary["raises atk and def"]).toBe(
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

  describe("positional placeholders can name a field", () => {
    // Two mechanics of the SAME type with different durations: `[buff.duration]`
    // resolves the FIRST one, so the second is unreachable by type name.
    // `[x-ranked.duration]` addresses it by position instead.
    // Spec: Plans/2026-08-20-placeholder-disambiguation.md
    const twoBuffs = {
      skillName: "Two Buffs",
      description:
        "Greatly raises DEF for [x-ranked.duration] turns, greatly raises ATK for [y-ranked.duration] turns and does damage equal to ATK-scaled to all enemies.",
      characterId: "test",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [100, 100, 100],
      mechanics: [
        { type: "buff", stat: "def", valuePercent: 50, duration: 4, targetSelf: true },
        { type: "buff", stat: "atk", valuePercent: 50, duration: 1, targetSelf: true },
      ],
    } as unknown as CharacterSkillData;

    it("reaches the second mechanic of the same type", () => {
      const out = buildDescriptionForRank(twoBuffs, 0);
      expect(out).toContain("DEF for 4 turns");
      expect(out).toContain("ATK for 1 turn");
    });

    it("disagrees with the fieldless form, which is the whole bug", () => {
      const fieldless = {
        ...twoBuffs,
        description: "Raises DEF for [x-ranked] turns.",
      } as unknown as CharacterSkillData;
      // Fieldless picks valuePercent first — 50, not the duration.
      expect(buildDescriptionForRank(fieldless, 0)).toContain("for 50 turns");
      expect(buildDescriptionForRank(twoBuffs, 0)).toContain("DEF for 4 turns");
    });

    it("still hides a clause whose positional duration resolves to 0 (#44)", () => {
      const laddered = {
        skillName: "Laddered",
        description:
          "Does damage equal to ATK-scaled to one enemy; stuns for [y-ranked.duration] turns.",
        characterId: "test",
        type: "attack",
        statMultiplier: "atk",
        damageRanked: [100, 100, 100],
        mechanics: [
          { type: "buff", stat: "atk", valuePercent: 30, duration: 2, targetSelf: true },
          { type: "stun", durationRanked: [0, 1, 2] },
        ],
      } as unknown as CharacterSkillData;
      expect(buildDescriptionForRank(laddered, 0)).not.toContain("stuns");
      expect(buildDescriptionForRank(laddered, 2)).toContain("stuns for 2 turns");
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
