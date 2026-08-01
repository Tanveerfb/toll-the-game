/** Max stamina a player can bank. */
export const STAMINA_CAP = 120;

/** +1 stamina per this many ms (5 minutes) — full bar in 10h from empty. */
export const STAMINA_REGEN_MS = 5 * 60 * 1000;

export interface StaminaState {
  current: number;
  updatedAt: number; // epoch ms
}

/** Computed on every read, never a timer — works offline, no cron. */
export function getCurrentStamina(stored: StaminaState, now: number = Date.now()): number {
  const regenerated = Math.floor((now - stored.updatedAt) / STAMINA_REGEN_MS);
  return Math.max(0, Math.min(STAMINA_CAP, stored.current + regenerated));
}

export type SpendStaminaResult =
  | { ok: true; next: StaminaState }
  | { ok: false };

/** Applies regen first, then checks affordability. Writing back `updatedAt`
 *  on spend means the next read's regen math starts fresh from the spend
 *  moment, not from whenever it was last topped up. */
export function spendStamina(
  stored: StaminaState,
  amount: number,
  now: number = Date.now(),
): SpendStaminaResult {
  if (amount <= 0) return { ok: false };
  const current = getCurrentStamina(stored, now);
  if (current < amount) return { ok: false };
  return { ok: true, next: { current: current - amount, updatedAt: now } };
}
