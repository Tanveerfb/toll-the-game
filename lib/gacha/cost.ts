/**
 * What a pull costs, and what it buys on the milestone track.
 *
 * Gems and milestone progress are **1:1** (Tanveer, 2026-08-11): 5 gems for a
 * single, 50 for a multi, and the bar moves by exactly that. They're still
 * separate functions so a future divergence is a one-line change rather than a
 * hunt through the store — but today the answer is the same number, and
 * pretending otherwise in the UI would be a lie.
 *
 * At 50 gems a multi, the two milestones are 10 multis (500) and 20 (1,000).
 * Singles reach them at the same gem cost; the multi's advantage is the free
 * 11th pull, not a cheaper lap.
 */

/** Pulls in a multi. The 11th is free — the price is 10 singles. */
export const MULTI_PULL_COUNT = 11;

export const LIMITED_GEM_COST = { single: 5, multi: 50 } as const;

/** Permanent runs on tickets and is untouched by the gem pricing — its bar
 *  still advances by its ticket cost. Called out so the asymmetry is visible
 *  rather than discovered. */
export const PERMANENT_TICKET_COST = { single: 1, multi: 10 } as const;

/** A pull of `count` is a "multi" for pricing unless it is exactly one. */
function tier<T>(count: number, rates: { single: T; multi: T }): T {
  return count === 1 ? rates.single : rates.multi;
}

export function limitedGemCost(count: number): number {
  return tier(count, LIMITED_GEM_COST);
}

/** 1:1 with the gem cost, by ruling. */
export function limitedBarGain(count: number): number {
  return limitedGemCost(count);
}

export function permanentTicketCost(count: number): number {
  return tier(count, PERMANENT_TICKET_COST);
}
