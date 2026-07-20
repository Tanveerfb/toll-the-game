import { describe, expect, it } from "vitest";
import {
  getCharacterById,
  getCharacterKit,
  getCharacterPhases,
} from "@/lib/game/characterCatalog";

// getCharacterKit resolves the kit shown for a given phase. Bosses expose a
// different kit per phase (Molvarr); normal characters ignore the index.

describe("getCharacterKit", () => {
  it("returns the top-level kit for a single-phase character", () => {
    const duke = getCharacterById("duke")!;
    const kit = getCharacterKit(duke, 0);
    expect(kit.skills).toEqual(duke.skills);
    expect(kit.ultimate).toEqual(duke.ultimate);
    expect(kit.passives).toEqual(duke.passive ? [duke.passive] : []);
    expect(kit.atk).toBe(duke.atk);
  });

  it("ignores an out-of-range phase index (falls back to top level)", () => {
    const duke = getCharacterById("duke")!;
    expect(getCharacterKit(duke, 5).skills).toEqual(duke.skills);
  });

  it("returns each phase's own kit for a multi-phase boss", () => {
    const molvarr = getCharacterById("molvarr")!;
    expect(getCharacterPhases(molvarr).length).toBe(2);

    const p1 = getCharacterKit(molvarr, 0);
    const p2 = getCharacterKit(molvarr, 1);

    // Distinct skill sets per phase
    expect(p1.skills.map((s) => s.skillName)).toContain("Corrosive Surge");
    expect(p2.skills.map((s) => s.skillName)).toContain("Abyssal Pierce");
    expect(p2.skills.map((s) => s.skillName)).not.toContain("Corrosive Surge");

    // Distinct ultimate + stats
    expect(p1.ultimate?.skillName).toBe("Sunken Verdict");
    expect(p2.ultimate?.skillName).toBe("Tidal Cataclysm");
    expect(p2.hp).toBeGreaterThan(p1.hp);

    // Phase 2 has more passives than phase 1
    expect(p2.passives.length).toBeGreaterThan(p1.passives.length);
    expect(p2.passives.map((p) => p.name)).toContain("Drowning Depths");
  });
});
