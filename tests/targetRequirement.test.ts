import { describe, expect, it } from "vitest";
import {
  dealsDamage,
  partitionOnEnemyless,
  requiresEnemyTarget,
  returnsToDeckOnFizzle,
} from "@/lib/game/targetRequirement";
import {
  getCharacterById,
  getCharacterKit,
  getPlayableCharacters,
} from "@/lib/game/characterCatalog";
import type { ActionCard } from "@/types/action";

/**
 * Ruling #43, refined by Tanveer 2026-08-11: when the fight ends mid-turn,
 * only the queued cards that NEED a living enemy are cancelled. Heals,
 * cleanses and buffs still land. An attacking ultimate is cancelled but
 * returns to the hand — its gauge was never spent.
 */

const card = (skill: unknown, id = "c1"): ActionCard =>
  ({ id, rank: 1, skill }) as ActionCard;

/** Minimal skill shape; cast at the boundary because these fixtures only carry
 *  the fields the predicate actually reads. */
const skill = (over: Record<string, unknown>) =>
  ({
    skillName: "Test",
    characterId: "test",
    statMultiplier: "atk",
    type: "attack",
    damageRanked: [0, 0, 0],
    ...over,
  }) as unknown as ActionCard["skill"];

describe("dealsDamage", () => {
  it("sees flat ultimate damage", () => {
    expect(dealsDamage(skill({ type: "ultimate", damage: 500 }))).toBe(true);
    expect(dealsDamage(skill({ type: "ultimate", damage: 0 }))).toBe(false);
  });

  it("sees damage at any rank", () => {
    expect(dealsDamage(skill({ damageRanked: [0, 0, 120] }))).toBe(true);
  });
});

describe("requiresEnemyTarget", () => {
  it("cancels anything that deals damage", () => {
    expect(requiresEnemyTarget(skill({ damageRanked: [100, 120, 150] }))).toBe(
      true,
    );
  });

  it("cancels debuffs and disables even at zero damage", () => {
    expect(requiresEnemyTarget(skill({ type: "debuff" }))).toBe(true);
    expect(requiresEnemyTarget(skill({ type: "disable" }))).toBe(true);
  });

  it("lets heals, cleanses, buffs and stances through", () => {
    for (const type of ["heal", "cleanse", "buff", "stance"]) {
      expect(requiresEnemyTarget(skill({ type }))).toBe(false);
    }
  });

  it("judges an ultimate on its damage, not its type", () => {
    expect(requiresEnemyTarget(skill({ type: "ultimate", damage: 620 }))).toBe(
      true,
    );
    expect(requiresEnemyTarget(skill({ type: "ultimate", damage: 0 }))).toBe(
      false,
    );
  });

  it("does NOT read damageRanked on a heal — that number is the heal", () => {
    // The bug this caught: `damageRanked` on a heal is the heal magnitude, not
    // damage (AGENTS.md excludes heals from the damage rule). Checking damage
    // before type cancelled the very heals the ruling exists to protect.
    expect(
      requiresEnemyTarget(skill({ type: "heal", damageRanked: [20, 25, 30] })),
    ).toBe(false);
    expect(dealsDamage(skill({ type: "heal", damageRanked: [20, 25, 30] }))).toBe(
      false,
    );
  });
});

describe("every real kit, exhaustively", () => {
  /**
   * The fixture tests above passed while the implementation was wrong, because
   * no fixture matched the shape that actually ships. This walks the real
   * catalogue instead: no ally-facing skill anywhere may be cancelled.
   */
  const allSkills = getPlayableCharacters().flatMap((character) => {
    const kit = getCharacterKit(character, 0);
    return [...kit.skills, ...(kit.ultimate ? [kit.ultimate] : [])];
  });

  it("finds a real heal that carries damageRanked", () => {
    // If this stops being true the test above lost its teeth.
    const healsWithNumbers = allSkills.filter(
      (s) =>
        s.type === "heal" &&
        ((s as { damageRanked?: number[] }).damageRanked ?? []).some(
          (v) => v > 0,
        ),
    );
    expect(healsWithNumbers.length).toBeGreaterThan(0);
  });

  it("never cancels a heal, cleanse, buff or stance", () => {
    const wronglyCancelled = allSkills
      .filter((s) => ["heal", "cleanse", "buff", "stance"].includes(s.type))
      .filter((s) => requiresEnemyTarget(s))
      .map((s) => `${s.type}:${s.skillName}`);
    expect(wronglyCancelled).toEqual([]);
  });

  it("always cancels an attack", () => {
    const wronglyKept = allSkills
      .filter((s) => s.type === "attack")
      .filter((s) => !requiresEnemyTarget(s))
      .map((s) => s.skillName);
    expect(wronglyKept).toEqual([]);
  });
});

describe("against real kits", () => {
  it("lets Isolde's Starbound Ward fire — the case that prompted the rule", () => {
    const isolde = getCharacterById("isolde");
    expect(isolde).toBeDefined();
    const ultimate = getCharacterKit(isolde!, 0).ultimate;
    expect(ultimate).toBeDefined();
    expect(requiresEnemyTarget(ultimate!)).toBe(false);
    expect(returnsToDeckOnFizzle(card(ultimate))).toBe(false);
  });

  it("cancels and returns an attacking ultimate", () => {
    const lyra = getCharacterById("lyra");
    const ultimate = getCharacterKit(lyra!, 0).ultimate;
    expect(requiresEnemyTarget(ultimate!)).toBe(true);
    expect(returnsToDeckOnFizzle(card(ultimate))).toBe(true);
  });
});

describe("returnsToDeckOnFizzle", () => {
  it("returns only ultimates, not ordinary attacks", () => {
    // A normal attack still fizzles away — ruling #43's "no momentum, no
    // gauge" is unchanged for everything that isn't a spent ultimate.
    expect(
      returnsToDeckOnFizzle(card(skill({ damageRanked: [100, 0, 0] }))),
    ).toBe(false);
  });
});

describe("partitionOnEnemyless", () => {
  it("splits a queue and preserves order on both sides", () => {
    const queue = [
      card(skill({ type: "heal" }), "heal1"),
      card(skill({ damageRanked: [100, 0, 0] }), "atk1"),
      card(skill({ type: "buff" }), "buff1"),
      card(skill({ type: "ultimate", damage: 600 }), "ult1"),
    ];
    const { playable, cancelled } = partitionOnEnemyless(queue);
    expect(playable.map((c) => c.id)).toEqual(["heal1", "buff1"]);
    expect(cancelled.map((c) => c.id)).toEqual(["atk1", "ult1"]);
  });

  it("handles a queue with nothing to cancel", () => {
    const queue = [card(skill({ type: "heal" }), "h")];
    expect(partitionOnEnemyless(queue).cancelled).toEqual([]);
    expect(partitionOnEnemyless(queue).playable).toHaveLength(1);
  });
});
