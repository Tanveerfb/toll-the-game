import { describe, expect, it } from "vitest";
import {
  buildDescriptionForRank,
  buildSkillKeywordGlossary,
} from "@/lib/game/descriptionTranslator";
import meliodasData from "@/data/characters/meliodas.json";
import gonData from "@/data/characters/gon.json";
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
    // Pill spans the stat too: "Raises ATK"
    expect(rock["raises atk"]).toBe("Increases ATK by 30%");
    expect(rock.raises).toBe("Increases ATK by 30%"); // loose-wording fallback

    // Gon ult: +30% ATK ("raises") and +50% DEF ("greatly raises")
    const combo = buildSkillKeywordGlossary(
      gonData.ultimate as CharacterSkillData,
      0,
    );
    expect(combo["raises atk"]).toBe("Increases ATK by 30%");
    expect(combo["greatly raises def"]).toBe("Increases DEF by 50%");
  });

  it("wording tiers: <50 raises, 50-79 greatly, 80+ massively; debuffs use lowers", () => {
    const skill = {
      skillName: "T",
      characterId: "t",
      type: "buff",
      statMultiplier: "atk",
      mechanics: [
        { type: "buff", stat: "atk", valuePercent: 85 },
        { type: "debuff", stat: "def", valuePercent: 50, duration: 2 },
      ],
    } as unknown as CharacterSkillData;
    const glossary = buildSkillKeywordGlossary(skill, 0);
    expect(glossary["massively raises atk"]).toBe("Increases ATK by 85%");
    expect(glossary["greatly lowers def"]).toBe("Reduces DEF by 50%");
  });

  it("same-tier multi-stat phrases get a combined key ('raises atk and def')", () => {
    const skill = {
      skillName: "T",
      characterId: "t",
      type: "buff",
      statMultiplier: "atk",
      mechanics: [
        { type: "buff", stat: "atk", valuePercent: 30 },
        { type: "buff", stat: "def", valuePercent: 30 },
      ],
    } as unknown as CharacterSkillData;
    const glossary = buildSkillKeywordGlossary(skill, 0);
    expect(glossary["raises atk and def"]).toBe(
      "Increases ATK by 30%; Increases DEF by 30%",
    );
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
