import { describe, expect, it } from "vitest";
import { buildPassiveDetailSections } from "@/lib/game/passiveDetailSections";
import type { KitPassiveView } from "@/components/game/KitDetails";

describe("buildPassiveDetailSections", () => {
  it("a passive with no mechanics falls back to one section from its own description", () => {
    const passive: KitPassiveView = {
      name: "Simple Passive",
      description: "Increases ATK by 5% for each debuff present on the enemy team.",
      trigger: "always",
    };
    const sections = buildPassiveDetailSections(passive);
    expect(sections).toHaveLength(1);
    expect(sections[0].header).toBe("Basic effect(s)");
    expect(sections[0].bullets).toEqual([
      "Increases ATK by 5% for each debuff present on the enemy team.",
    ]);
  });

  it("groups multi-mechanic passives by each mechanic's own triggerText (Duke's Flowing Ruin)", () => {
    const passive: KitPassiveView = {
      name: "Flowing Ruin",
      description:
        "After using a skill, gains 1 Flowing Ruin stack. At 3 stacks, the next skill consumes all stacks, deals 100% more damage, and lowers target ATK by 50% for 2 turns.",
      trigger: "afterSkill",
      mechanics: [
        {
          type: "buff",
          name: "Flowing Ruin Stack",
          triggerText: "After each skill used by this character",
          description: "Gains 1 Flowing Ruin stack (max 3).",
        },
        {
          type: "conditionalBuff",
          name: "Flowing Ruin Empowerment",
          triggerText: "When there are 3 stacks of Flowing Ruin",
          description:
            "At 3 stacks, the next skill consumes all stacks, deals 100% more damage, and lowers target ATK by 50% for 2 turns.",
        },
      ],
    };
    const sections = buildPassiveDetailSections(passive);
    expect(sections).toHaveLength(2);
    expect(sections[0].header).toBe("After each skill used by this character");
    expect(sections[0].bullets).toEqual(["Gains 1 Flowing Ruin stack (max 3)."]);
    expect(sections[1].header).toBe("When there are 3 stacks of Flowing Ruin");
    expect(sections[1].bullets).toEqual([
      "At 3 stacks, the next skill consumes all stacks, deals 100% more damage, and lowers target ATK by 50% for 2 turns.",
    ]);
  });

  it("groups mechanics sharing the same header together, in order (Molvarr-style multi-effect passive)", () => {
    const passive: KitPassiveView = {
      name: "Boss Passive",
      description: "placeholder",
      trigger: "always",
      mechanics: [
        {
          type: "bossDebuffAtk",
          triggerText: "Always",
          description: "Gains +5% ATK per debuff on this unit.",
        },
        {
          type: "bossAutoSp",
          triggerText: "Every 3rd turn",
          description: "Its final action is the SP Skill.",
        },
        {
          type: "bossStatSpike",
          triggerText: "Always",
          description: "Immune to stun and freeze.",
        },
      ],
    };
    const sections = buildPassiveDetailSections(passive);
    expect(sections.map((s) => s.header)).toEqual(["Always", "Every 3rd turn"]);
    expect(sections[0].bullets).toEqual([
      "Gains +5% ATK per debuff on this unit.",
      "Immune to stun and freeze.",
    ]);
    expect(sections[1].bullets).toEqual(["Its final action is the SP Skill."]);
  });

  it("falls back to a humanized trigger label when a mechanic has no triggerText of its own", () => {
    const passive: KitPassiveView = {
      name: "Aura",
      description: "placeholder",
      trigger: "onDamageDealt",
      mechanics: [
        { type: "healLifesteal", description: "Heals for 30% of damage dealt." },
      ],
    };
    const sections = buildPassiveDetailSections(passive);
    expect(sections).toHaveLength(1);
    expect(sections[0].header).toBe("When dealing damage");
  });

  it("skips mechanic entries without their own description rather than emitting empty bullets", () => {
    const passive: KitPassiveView = {
      name: "Synergy-only",
      description: "All KHALSA allies gain +10% ATK.",
      trigger: "always",
      mechanics: [{ type: "synergy", conditionTags: ["KHALSA"], valuePercent: 10 }],
    };
    const sections = buildPassiveDetailSections(passive);
    expect(sections).toHaveLength(1);
    expect(sections[0].bullets).toEqual(["All KHALSA allies gain +10% ATK."]);
  });
});
