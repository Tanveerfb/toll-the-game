// Ult-gauge capacity. Standard units fill to 5; a kit may override (e.g. the
// Molvarr boss uses 10) via `ultGaugeMax`. One helper so the cap is never
// hardcoded across the deck/combat/store/UI.

export const DEFAULT_ULT_GAUGE_MAX = 5;

export function ultGaugeMax(unit: { ultGaugeMax?: number }): number {
  return unit.ultGaugeMax ?? DEFAULT_ULT_GAUGE_MAX;
}
