import { describe, expect, it } from "vitest";
import { getAllCharacters } from "@/lib/game/characterCatalog";

/**
 * Skill descriptions run through descriptionTranslator.ts and stay
 * numerically live off the mechanic data; passive descriptions are static
 * strings with no equivalent check — exactly how the Diane 15%/10% drift bug
 * happened (description said one number, the mechanic used another). This
 * doesn't parse prose deeply — it just collects every number appearing
 * anywhere in the passive's mechanic data and confirms every "N%" the
 * description states is backed by a real value somewhere in that data, so a
 * future balance edit that forgets to update the text trips a test.
 */
function collectNumbers(value: unknown, acc: Set<number> = new Set()): Set<number> {
  if (typeof value === "number") {
    acc.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectNumbers(v, acc));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((v) =>
      collectNumbers(v, acc),
    );
  }
  return acc;
}

describe("passive description percentages stay in sync with mechanic data", () => {
  const characters = getAllCharacters();

  characters.forEach((char) => {
    const passive = char.passive;
    if (!passive?.description) return;
    const percents = [...passive.description.matchAll(/(\d+)%/g)].map((m) =>
      Number(m[1]),
    );
    if (percents.length === 0) return;

    it(`${char.id}'s passive ("${passive.name}") description percentages are backed by real mechanic values`, () => {
      const pool = collectNumbers(passive.mechanics ?? []);
      percents.forEach((p) => {
        expect(
          pool.has(p),
          `${char.id}'s passive description claims ${p}% but no mechanic field carries that value (mechanic numbers found: ${[...pool].join(", ")})`,
        ).toBe(true);
      });
    });
  });
});
