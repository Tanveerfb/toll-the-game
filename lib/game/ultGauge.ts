// Ult-gauge capacity. Standard units fill to 5; a kit may override (e.g. the
// Molvarr boss uses 10) via `ultGaugeMax`. One helper so the cap is never
// hardcoded across the deck/combat/store/UI.

import type { Mechanic } from "@/types/mechanic";

export const DEFAULT_ULT_GAUGE_MAX = 5;

export function ultGaugeMax(unit: { ultGaugeMax?: number }): number {
  return unit.ultGaugeMax ?? DEFAULT_ULT_GAUGE_MAX;
}

/**
 * The caster's gauge right after casting an ultimate: spent to 0, then
 * refilled by the ult's own `gainUltGauge` mechanics that reach the caster.
 *
 * Two shapes reach her: a self one (Molvarr P2 refills 3) and an `allies` one
 * (Caila's Theriac — "all allies" includes her, Tanveer 2026-09-29; the other
 * allies' share is granted in `combat.ts`). The battle screen's two action
 * loops (player and enemy) both call this, so neither can forget the second
 * shape. (The simulator keeps no gauge at all — see lib/game/simulate.ts.)
 *
 * Reads the raw kit mechanics, resolving the ult-level ladder itself, because
 * the loop has the card, not executeSkill's normalised copy.
 */
export function ultGaugeAfterUltimate(
  caster: { ultGaugeMax?: number; ultLevel?: number },
  mechanics: readonly Mechanic[] | undefined,
): number {
  const index = Math.max(0, (caster.ultLevel ?? 1) - 1);
  let refill = 0;
  for (const mech of mechanics ?? []) {
    if (mech.type !== "gainUltGauge") continue;
    if (mech.minUltLevel != null && index + 1 < mech.minUltLevel) continue;
    const audience = mech.applyTo ?? "self";
    if (audience !== "self" && audience !== "allies") continue;
    refill += mech.valueByUltLevel?.[index] ?? mech.value ?? 0;
  }
  return Math.min(ultGaugeMax(caster), refill);
}
