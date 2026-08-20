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

/**
 * The chart with [Guard] and [Effective] applied — ruling #111.
 *
 * Two mirrored overrides that overrule the matchup WITHOUT touching element
 * colours (spec: Plans/2026-08-20-guard-and-effective.md):
 *
 *  - **Guard**, on the DEFENDER. Tanveer, 2026-08-20: *"a char with 'guards
 *    all attacks' always takes less damage as if it (defender) is type
 *    advantaged to the attacker, regardless of char's element color."* Forces
 *    the disadvantaged multiplier.
 *  - **Effective**, on the ATTACKER: *"it will do type neutral damage as
 *    worst, never disadvantage. still will do type advantage damage to
 *    disadvantaged elements."* Floors the multiplier at neutral — a real
 *    advantage still pays out, so the floor never becomes a promotion.
 *
 * They cancel: *"unless said disadvantaged element char has guard. in that
 * case, it would be type neutral for it too."*
 *
 * | Effective | Guard | Result |
 * |---|---|---|
 * | no  | no  | the chart |
 * | no  | yes | 0.9 whatever the colours |
 * | yes | no  | max(chart, 1.0) |
 * | yes | yes | 1.0 |
 *
 * `critical` reaches neither: it discards the matchup entirely before this is
 * called, which is why "critical bypasses Guard" needs no code of its own.
 */
export function resolveTypeModifier(
  attacker: Color | undefined,
  defender: Color | undefined,
  {
    attackerEffective = false,
    defenderGuard = false,
  }: { attackerEffective?: boolean; defenderGuard?: boolean } = {},
): number {
  const chart = getTypeModifier(attacker, defender);
  if (attackerEffective && defenderGuard) return 1.0;
  if (defenderGuard) return 0.9;
  if (attackerEffective) return Math.max(chart, 1.0);
  return chart;
}
