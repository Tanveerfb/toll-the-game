import { describe, expect, it } from "vitest";
import { buildDescriptionForRank } from "@/lib/game/descriptionTranslator";
import meliodasData from "@/data/characters/meliodas.json";
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
