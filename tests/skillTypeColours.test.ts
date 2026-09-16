import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getAllCharacters } from "@/lib/game/characterCatalog";
import {
  SKILL_TYPE_CHIP,
  SKILL_TYPE_ICON,
  SKILL_TYPE_TEXT,
  skillTypeCategory,
} from "@/lib/game/skillTypeStyle";

/**
 * Ruling #133 (Tanveer, 2026-09-16) — what a skill DOES reads as a colour,
 * and it is the same colour on the card, in the archive and in the kit
 * document.
 *
 *   attack        red     "just the attack skill would be red"
 *   attackDebuff  purple  "attack debuff purple"
 *   heal          green   "cleanse or heals would be green"
 *   buff          blue    "buff skills are again blue"
 *   stance        yellow  "stance cards would be yellow again"
 *
 * His line for the attack/attack-debuff split: Chiara's skill that lowers DEF
 * after damage is an attack-debuff, while one that only cancels is *"just a
 * normal attack skill … as long as they don't apply debuff on the enemy"*.
 */

function skillOf(characterId: string, skillName: string) {
  const c = getAllCharacters().find(
    (x) => (x as unknown as { id?: string }).id === characterId,
  );
  if (!c) throw new Error(`no character ${characterId}`);
  const raw = c as unknown as Record<string, unknown>;
  const acts = [
    ...(((raw.skills as unknown[]) ?? []) as Record<string, unknown>[]),
    raw.ultimate as Record<string, unknown>,
    raw.spSkill as Record<string, unknown>,
  ].filter(Boolean);
  const a = acts.find((x) => x.skillName === skillName);
  if (!a) throw new Error(`no skill ${characterId}/${skillName}`);
  return a as never;
}

describe("#133 — the split he drew, on his own examples", () => {
  it("damage that also afflicts is an attack-debuff", () => {
    // His example, named.
    expect(skillTypeCategory(skillOf("chiara", "Marked Card"))).toBe(
      "attackDebuff",
    );
  });

  it("damage that only CANCELS is a plain attack", () => {
    // Gabrist's Erase cancels stances and nothing else — cancelling is not
    // afflicting, so it stays red.
    expect(skillTypeCategory(skillOf("gabrist", "Erase"))).toBe("attack");
  });

  it("every stance in the game classifies as a stance", () => {
    const stances: [string, string][] = [
      ["iron", "Iron Wall"],
      ["meliodas", "Full Counter"],
      ["mustafa", "Earth Stance: Fortress"],
      ["toll_collector", "State Your Business"],
      ["yalina", "Attention Drawer"],
    ];
    for (const [id, name] of stances) {
      expect(skillTypeCategory(skillOf(id, name))).toBe("stance");
    }
  });

  it("a stance mechanic beats a disagreeing skill.type", () => {
    // Two of those five are typed something else in the JSON: Fortress is
    // `buff`, Attention Drawer is `debuff`. What the player reads is the
    // stance, and it is also what decides whether cancelStances reaches it.
    expect(
      (skillOf("mustafa", "Earth Stance: Fortress") as { type: string }).type,
    ).toBe("buff");
    expect(
      (skillOf("yalina", "Attention Drawer") as { type: string }).type,
    ).toBe("debuff");
  });

  it("an ultimate is classified by what it does, not by being an ultimate", () => {
    // Isolde's Starbound Ward is a pure team buff and used to carry a sword.
    expect(skillTypeCategory(skillOf("isolde", "Starbound Ward"))).toBe("buff");
    expect(skillTypeCategory(skillOf("meliodas", "Evil Spirit"))).toBe(
      "attackDebuff",
    );
    expect(skillTypeCategory(skillOf("yalina", "Devastating Blow"))).toBe(
      "attack",
    );
  });

  it("heals and cleanses are heals", () => {
    expect(skillTypeCategory(skillOf("isolde", "Threads of Renewal"))).toBe(
      "heal",
    );
    expect(skillTypeCategory(skillOf("siddiq", "Cleansing Bloom"))).toBe(
      "heal",
    );
  });

  it("every shipped skill classifies without throwing", () => {
    let seen = 0;
    for (const c of getAllCharacters()) {
      const raw = c as unknown as Record<string, unknown>;
      const acts = [
        ...(((raw.skills as unknown[]) ?? []) as Record<string, unknown>[]),
        raw.ultimate as Record<string, unknown>,
        raw.spSkill as Record<string, unknown>,
      ].filter(Boolean);
      for (const a of acts) {
        expect(SKILL_TYPE_TEXT[skillTypeCategory(a as never)]).toBeDefined();
        seen += 1;
      }
    }
    expect(seen).toBeGreaterThan(60);
  });
});

describe("#133 — the colours", () => {
  it.each([
    ["attack", "role-attack"],
    ["attackDebuff", "el-dark"],
    ["heal", "role-heal"],
    ["buff", "el-blue"],
    ["stance", "el-light"],
  ] as const)("%s is %s", (category, token) => {
    expect(SKILL_TYPE_TEXT[category]).toContain(token);
    expect(SKILL_TYPE_CHIP[category]).toContain(token);
  });

  it("five classes, five distinct hues", () => {
    expect(new Set(Object.values(SKILL_TYPE_TEXT)).size).toBe(5);
  });

  it("shape carries the class too, so it survives greyscale", () => {
    expect(new Set(Object.values(SKILL_TYPE_ICON)).size).toBe(5);
  });
});

describe("#133 — one taxonomy, not three", () => {
  const read = (rel: string) =>
    readFileSync(path.resolve(__dirname, "..", rel), "utf8");

  it.each([
    "components/game/battle/Hand.tsx",
    "components/game/KitDetails.tsx",
    "components/game/SkillDocument.tsx",
  ])("%s uses the shared map rather than its own", (file) => {
    const src = read(file);
    expect(src).toContain('from "@/lib/game/skillTypeStyle"');
    // A local map keyed off `skill.type` is what produced three different
    // answers for one skill — a buff was green in the archive and blue on the
    // card.
    expect(src).not.toMatch(/const SKILL_TYPE_(CHIP|ACCENT|ICON)\s*[:=]/);
  });
});
