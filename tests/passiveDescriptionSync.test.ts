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
    acc.add(Math.abs(value));
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectNumbers(v, acc));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((v) =>
      collectNumbers(v, acc),
    );
  }
  return acc;
}

/**
 * Percentages a mechanic *means* without literally storing them. `bossStatSpike`
 * carries a multiplier (x3) while the description — and the badge the engine
 * pushes onto the unit — states the increase (200%). Same number, different
 * expression, so the raw-value sweep above would flag a correct description.
 */
function collectDerivedPercents(
  mechanics: readonly unknown[] = [],
  acc: Set<number> = new Set(),
): Set<number> {
  mechanics.forEach((mechanic) => {
    if (!mechanic || typeof mechanic !== "object") return;
    const m = mechanic as { type?: string; multiplier?: number };
    if (m.type === "bossStatSpike") {
      // Mirrors applyStatSpike's badge: valuePercent = (mult - 1) * 100.
      acc.add(Math.round(((m.multiplier ?? 2) - 1) * 100));
    }
  });
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
      collectDerivedPercents(passive.mechanics ?? [], pool);
      percents.forEach((p) => {
        expect(
          pool.has(p),
          `${char.id}'s passive description claims ${p}% but no mechanic field carries that value (mechanic numbers found: ${[...pool].join(", ")})`,
        ).toBe(true);
      });
    });
  });
});
