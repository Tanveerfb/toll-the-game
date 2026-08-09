/**
 * Max-HP changes scale current HP with them, preserving the HP ratio
 * (Tanveer, 2026-08-09).
 *
 * 1500/2000 (75%) raised 50% becomes 2250/3000 — still 75%. Lowered 30% it
 * becomes 1050/1400 — still 75%.
 *
 * The engine used to add the max-HP *delta* to current HP instead
 * (`hp += boost; currentHP += boost`), which pushed 1500/2000 to 2500/3000 —
 * 83%, a free 250 HP. Every max-HP change now goes through here.
 */
export interface HpPair {
  hp: number;
  currentHP: number;
}

export function scaleMaxHp<T extends HpPair>(unit: T, percent: number): T {
  const factor = 1 + percent / 100;
  if (factor === 1) return unit;
  // Floor with an epsilon: unwinding a raise multiplies by the inverse
  // factor, and 2600 * (1/1.3) evaluates to 1999.9999999999998, which would
  // floor to 1999 and leak a point of max HP every expiry.
  const floor = (value: number) => Math.floor(value + 1e-9);
  // Never let a living unit be rounded into a corpse.
  const hp = Math.max(1, floor(unit.hp * factor));
  const currentHP =
    unit.currentHP <= 0
      ? unit.currentHP
      : Math.max(1, Math.min(hp, floor(unit.currentHP * factor)));
  return { ...unit, hp, currentHP };
}

/**
 * The percent that undoes `percent`, for unwinding a max-HP change when its
 * buff or debuff expires. +50% is undone by -33.33%, not by -50%.
 */
export function inverseHpPercent(percent: number): number {
  const factor = 1 + percent / 100;
  if (factor <= 0) return 0;
  return (1 / factor - 1) * 100;
}
