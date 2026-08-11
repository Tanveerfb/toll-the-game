/**
 * Milestone laps (Tanveer, 2026-08-11).
 *
 * Two rules, both new:
 *
 * 1. **The final milestone does not override the first.** Both are claimable at
 *    any time once reached, in any order. The lap only restarts once the final
 *    milestone has been reached *and every reward on it has been taken*. The
 *    old model reset the lap the moment 600 was claimed, silently forfeiting an
 *    unclaimed 300 — the code even carried a comment admitting it, and the UI
 *    never mentioned it. Nothing can be lost by claiming in the wrong order
 *    now, because there is no wrong order.
 *
 * 2. **The thresholds are 500 and 1,000**, and progress is 1:1 with gems spent
 *    (`lib/gacha/cost.ts`). They were 300/600 against a bar that advanced by
 *    the gem cost, which happened to be 3/30 — so the names below are
 *    deliberately positional rather than numeric. A constant called
 *    `LIMITED_MILESTONE_300` holding 500 is how the next re-tune goes wrong.
 */

export const LIMITED_MILESTONE_FIRST = 500;
export const LIMITED_MILESTONE_FINAL = 1000;

/** Permanent has one milestone and runs on tickets, so the gem re-pricing
 *  above doesn't apply to it — this is unchanged at 600 ticket-units. */
export const PERMANENT_MILESTONE_FINAL = 600;

export interface LimitedPityState {
  bannerId: string | null;
  bar: number;
  claimedFirst: boolean;
  claimedFinal: boolean;
}

export interface PermanentPityState {
  bar: number;
  claimedFinal: boolean;
}

/** Advances the Limited bar. If the active banner has changed since the last
 *  spend, the lap resets first — a milestone bar never carries between
 *  banners, and neither do its claim flags. */
export function advanceLimitedBar(
  state: LimitedPityState,
  activeBannerId: string,
  barGain: number,
): LimitedPityState {
  const base: LimitedPityState =
    state.bannerId === activeBannerId
      ? state
      : {
          bannerId: activeBannerId,
          bar: 0,
          claimedFirst: false,
          claimedFinal: false,
        };
  return { ...base, bar: base.bar + barGain };
}

export function canClaimLimitedFirst(
  bar: number,
  claimedFirst: boolean,
): boolean {
  return bar >= LIMITED_MILESTONE_FIRST && !claimedFirst;
}

export function canClaimLimitedFinal(
  bar: number,
  claimedFinal: boolean,
): boolean {
  return bar >= LIMITED_MILESTONE_FINAL && !claimedFinal;
}

/** Every reward on this lap has been reached and taken. */
export function isLimitedLapComplete(state: LimitedPityState): boolean {
  return (
    state.bar >= LIMITED_MILESTONE_FINAL &&
    state.claimedFirst &&
    state.claimedFinal
  );
}

/**
 * Wrap the lap if — and only if — it's complete. Call after every claim.
 *
 * The bar restarts at 0 rather than carrying the overflow, which is the
 * literal ruling. That only costs anything if you keep pulling past the final
 * milestone *without* claiming, and since claiming is what triggers the wrap,
 * the incentive points the other way.
 */
export function settleLimitedLap(state: LimitedPityState): LimitedPityState {
  if (!isLimitedLapComplete(state)) return state;
  return { ...state, bar: 0, claimedFirst: false, claimedFinal: false };
}

export function advancePermanentBar(
  state: PermanentPityState,
  barGain: number,
): PermanentPityState {
  return { ...state, bar: state.bar + barGain };
}

export function canClaimPermanentFinal(
  bar: number,
  claimedFinal: boolean,
): boolean {
  return bar >= PERMANENT_MILESTONE_FINAL && !claimedFinal;
}

/** Permanent has a single milestone, so "reached and taken" is just that one. */
export function isPermanentLapComplete(state: PermanentPityState): boolean {
  return state.bar >= PERMANENT_MILESTONE_FINAL && state.claimedFinal;
}

export function settlePermanentLap(
  state: PermanentPityState,
): PermanentPityState {
  if (!isPermanentLapComplete(state)) return state;
  return { bar: 0, claimedFinal: false };
}

/** Thresholds reached but not yet taken — drives the banner screen's "the lap
 *  won't reset until you take these" messaging. */
export function unclaimedLimitedMilestones(state: LimitedPityState): number[] {
  const pending: number[] = [];
  if (canClaimLimitedFirst(state.bar, state.claimedFirst)) {
    pending.push(LIMITED_MILESTONE_FIRST);
  }
  if (canClaimLimitedFinal(state.bar, state.claimedFinal)) {
    pending.push(LIMITED_MILESTONE_FINAL);
  }
  return pending;
}
