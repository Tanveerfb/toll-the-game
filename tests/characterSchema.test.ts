import { describe, expect, it } from "vitest";
import { validateCharacters } from "@/lib/game/characterSchema";
import {
  getAllCharacters,
  getBossCharacters,
  getPlayableCharacters,
} from "@/lib/game/characterCatalog";

describe("kit validation (STATUS #7 — typos fail loudly at load)", () => {
  it("accepts every shipped kit", () => {
    expect(() => validateCharacters(getAllCharacters())).not.toThrow();
  });

  it("rejects an unknown mechanic type with the character id and path", () => {
    const broken = {
      id: "broken",
      name: "Broken",
      color: "red",
      atk: 100,
      def: 50,
      hp: 1000,
      skills: [
        {
          skillName: "Typo Strike",
          characterId: "broken",
          type: "attack",
          statMultiplier: "atk",
          damageRanked: [100, 150, 200],
          mechanics: [{ type: "weakpiont" }], // typo'd on purpose
        },
        {
          skillName: "Fine Strike",
          characterId: "broken",
          type: "attack",
          statMultiplier: "atk",
          damageRanked: [100, 150, 200],
        },
      ],
    };
    expect(() => validateCharacters([broken])).toThrow(/broken —.*mechanics/);
  });

  it("rejects an unknown passive trigger", () => {
    const broken = {
      id: "badtrigger",
      name: "Bad Trigger",
      color: "blue",
      atk: 100,
      def: 50,
      hp: 1000,
      skills: [
        {
          skillName: "A",
          characterId: "badtrigger",
          type: "attack",
          statMultiplier: "atk",
          damageRanked: [100, 150, 200],
        },
        {
          skillName: "B",
          characterId: "badtrigger",
          type: "attack",
          statMultiplier: "atk",
          damageRanked: [100, 150, 200],
        },
      ],
      passive: {
        name: "Oops",
        description: "Broken trigger",
        trigger: "onAllySkil", // typo'd on purpose
        mechanics: [{ type: "momentumStacks", valuePercent: 20, maxStacks: 5 }],
      },
    };
    expect(() => validateCharacters([broken])).toThrow(
      /badtrigger —.*trigger/,
    );
  });
});

describe("boss roster (practice Boss Battle picker)", () => {
  it("returns the curated bosses, all flagged boss:true", () => {
    const bosses = getBossCharacters();
    const ids = bosses.map((b) => b.id).sort();
    expect(ids).toEqual(["lyra_npc", "molvarr"]);
    expect(bosses.every((b) => b.boss === true)).toBe(true);
  });

  it("keeps bosses out of the playable roster (storyOnly)", () => {
    const playable = getPlayableCharacters().map((c) => c.id);
    expect(playable).not.toContain("molvarr");
    expect(playable).not.toContain("lyra_npc");
  });
});
