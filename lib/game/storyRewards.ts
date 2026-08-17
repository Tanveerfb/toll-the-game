import { materialLabel } from "@/lib/game/materials";
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
 * Stamina this attempt costs — the same whether the chapter is cleared or not.
 *
 * **Supersedes the 2026-08-09 ruling** that uncleared chapters were always free
 * however many times they were retried. Tanveer, 2026-08-17: *"we are charging
 * sta for story now. all of them. first try and reattempts all cost sta."* The
 * consequence is deliberate and was flagged before he confirmed it: story
 * progress can now be stamina-gated, so a player who wipes twice waits.
 *
 * A chapter authored at `replayStamina: 0` is still free — several scene-only
 * chapters are, and a chapter with nothing to fight has nothing to charge for.
 */
export function storyAttemptCost(rewards: StoryChapterRewards): number {
  return rewards.replayStamina;
}

/** "300–800" for a range, "2" for a fixed amount. */
function rangeLabel(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

/**
 * What a chapter pays, as display lines.
 *
 * Lifted out of `ChapterBrief`, which had it as a private hook, because the
 * chapter card now advertises the same thing — and `OrdersBoard` already keeps a
 * third copy of this idea. One list, one place, so the brief and the card can
 * never disagree about what a chapter is worth.
 *
 * Branching on `cleared` is the point: an uncleared chapter advertises its
 * one-time bundle, because that's what you're about to earn, while a cleared one
 * advertises the repeat ranges, because that's what farming it actually pays.
 */
export function describeRewards(
  rewards: StoryChapterRewards,
  cleared: boolean,
): string[] {
  const lines: string[] = [];
  if (!cleared) {
    const { gems, coin, permanentTicket, materials } = rewards.firstClear;
    if (gems) lines.push(`${gems} Gems`);
    if (coin) lines.push(`${coin} Coin`);
    if (permanentTicket) lines.push(`${permanentTicket} Permanent Ticket`);
    for (const [id, qty] of Object.entries(materials ?? {})) {
      if (qty) lines.push(`${qty} ${materialLabel(id)}`);
    }
    return lines;
  }
  const { coin, materials } = rewards.repeat;
  if (coin) lines.push(`${rangeLabel(coin.min, coin.max)} Coin`);
  for (const [id, range] of Object.entries(materials ?? {})) {
    lines.push(`${rangeLabel(range.min, range.max)} ${materialLabel(id)}`);
  }
  return lines;
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
