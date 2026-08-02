export const LIMITED_MILESTONE_300 = 300;
export const LIMITED_MILESTONE_600 = 600;
export const PERMANENT_MILESTONE_600 = 600;

export interface LimitedPityState {
  bannerId: string | null;
  bar: number;
  claimed300: boolean;
}

/** Advances the Limited bar by `amountSpent` gems. If the active banner has
 *  changed since the last spend, the bar (and the 300-claimed flag) resets
 *  to 0 first — the milestone bar never carries over between banners. */
export function advanceLimitedBar(
  state: LimitedPityState,
  activeBannerId: string,
  amountSpent: number,
): LimitedPityState {
  const base: LimitedPityState =
    state.bannerId === activeBannerId ? state : { bannerId: activeBannerId, bar: 0, claimed300: false };
  return { ...base, bar: base.bar + amountSpent };
}

/** 300 and 600 are independent — reaching 600 doesn't forfeit an unclaimed
 *  300, and either can be claimed in any order (or both, before either has
 *  been claimed). 300 can only be claimed once per lap. */
export function canClaimLimited300(bar: number, claimed300: boolean): boolean {
  return bar >= LIMITED_MILESTONE_300 && !claimed300;
}

export function canClaimLimited600(bar: number): boolean {
  return bar >= LIMITED_MILESTONE_600;
}

/** Only fires on an actual 600 claim (not the moment the bar crosses 600),
 *  so further spend between "reached" and "claimed" isn't lost. This is the
 *  only thing that starts a new lap — claiming 300 does not reset anything.
 *  Note: if 300 was never claimed before 600 is claimed, that lap's 300
 *  reward is forfeited once the reset happens — "independent" means claim
 *  order doesn't matter, not that an unclaimed reward survives a reset. */
export function resetLimitedLap(state: LimitedPityState): LimitedPityState {
  return { ...state, bar: 0, claimed300: false };
}

export function advancePermanentBar(bar: number, amountSpent: number): number {
  return bar + amountSpent;
}

export function canClaimPermanent600(bar: number): boolean {
  return bar >= PERMANENT_MILESTONE_600;
}

export function resetPermanentLap(): number {
  return 0;
}
