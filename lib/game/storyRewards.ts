import type {
  StoryChapterRewards,
  StoryDropRange,
  StoryFirstClearBundle,
  StoryRepeatDrops,
} from "@/types/story";

/** A flat, already-rolled reward bundle ready to hand to the player store. */
export interface StoryPayout {
  gems: number;
  coin: number;
  permanentTicket: number;
  materials: Record<string, number>;
  /** Account XP — first clears only, so this is 0 on every replay. */
  accountXp: number;
}

export interface StoryClearResult {
  /** Null on a replay — the bundle is one-time. */
  firstClear: StoryPayout | null;
  /** Rolled on every clear, first one included. */
  drops: StoryPayout;
  /** `firstClear` + `drops`, what the player actually receives this run. */
  total: StoryPayout;
}

function emptyPayout(): StoryPayout {
  return { gems: 0, coin: 0, permanentTicket: 0, materials: {}, accountXp: 0 };
}

/** Inclusive on both bounds. A range whose min exceeds its max is rejected by
 *  the schema at load, so this trusts its input. */
function rollRange(range: StoryDropRange, rng: () => number): number {
  return range.min + Math.floor(rng() * (range.max - range.min + 1));
}

function fromBundle(bundle: StoryFirstClearBundle): StoryPayout {
  return {
    gems: bundle.gems ?? 0,
    coin: bundle.coin ?? 0,
    permanentTicket: bundle.permanentTicket ?? 0,
    materials: { ...(bundle.materials ?? {}) },
    accountXp: bundle.accountXp ?? 0,
  };
}

/** Roll order is fixed and documented so tests can map an `rng()` call to an
 *  entry: coin first, then each material in the object's own key order. */
function rollDrops(repeat: StoryRepeatDrops, rng: () => number): StoryPayout {
  const payout = emptyPayout();
  if (repeat.coin) payout.coin = rollRange(repeat.coin, rng);
  for (const [id, range] of Object.entries(repeat.materials ?? {})) {
    const rolled = rollRange(range, rng);
    // A 0 roll is a real outcome for a 0-min range; don't record an entry for
    // it, or the rewards screen shows "+0 Training Manual".
    if (rolled > 0) payout.materials[id] = rolled;
  }
  return payout;
}

function addPayouts(a: StoryPayout, b: StoryPayout): StoryPayout {
  const materials = { ...a.materials };
  for (const [id, qty] of Object.entries(b.materials)) {
    materials[id] = (materials[id] ?? 0) + qty;
  }
  return {
    gems: a.gems + b.gems,
    coin: a.coin + b.coin,
    permanentTicket: a.permanentTicket + b.permanentTicket,
    accountXp: a.accountXp + b.accountXp,
    materials,
  };
}

/**
 * Rolls a chapter clear. `rng` is injectable (defaults to `Math.random`) so
 * tests can force both bounds of every range deterministically — same
 * contract as `rollWorldBossRewards`.
 *
 * A first clear grants the one-time bundle AND a drop roll. Paying the bundle
 * alone would mean the first clear of a chapter is the only clear that never
 * shows the drop table it is advertising.
 */
export function rollStoryRewards(
  rewards: StoryChapterRewards,
  isFirstClear: boolean,
  rng: () => number = Math.random,
): StoryClearResult {
  const firstClear = isFirstClear ? fromBundle(rewards.firstClear) : null;
  const drops = rollDrops(rewards.repeat, rng);
  return {
    firstClear,
    drops,
    total: firstClear ? addPayouts(firstClear, drops) : drops,
  };
}

/**
 * Stamina this attempt costs. An uncleared chapter is free however many times
 * it is retried — the story is never stamina-locked, only the farm is
 * (Tanveer, 2026-08-09).
 */
export function storyAttemptCost(
  rewards: StoryChapterRewards,
  cleared: boolean,
): number {
  return cleared ? rewards.replayStamina : 0;
}

/** True when a payout would grant nothing — used to skip an empty section on
 *  the rewards screen rather than render a heading with no rows under it. */
export function isEmptyPayout(payout: StoryPayout): boolean {
  return (
    payout.gems === 0 &&
    payout.coin === 0 &&
    payout.permanentTicket === 0 &&
    Object.keys(payout.materials).length === 0
  );
}
