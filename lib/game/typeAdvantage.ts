import type { Color } from "@/types/color";

/**
 * Type chart (Tanveer, 2026-07-07):
 *   Dark > Light > Dark   — mutual advantage, never disadvantage
 *   Red > Green > Blue > Red
 * Advantage deals +20% damage, disadvantage −10%, neutral ±0.
 */
const ADVANTAGE: Record<Color, Color | Color[]> = {
  dark: "light",
  light: "dark",
  red: "green",
  green: "blue",
  blue: "red",
};

function beats(attacker: Color, defender: Color): boolean {
  const strongAgainst = ADVANTAGE[attacker];
  return Array.isArray(strongAgainst)
    ? strongAgainst.includes(defender)
    : strongAgainst === defender;
}

export function getTypeModifier(
  attacker: Color | undefined,
  defender: Color | undefined,
): number {
  if (!attacker || !defender || attacker === defender) return 1.0;
  if (beats(attacker, defender)) return 1.2;
  if (beats(defender, attacker)) return 0.9;
  return 1.0;
}
