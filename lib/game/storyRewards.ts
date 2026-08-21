import { materialLabel } from "@/lib/game/materials";
import type { MissionOutcome } from "@/lib/game/stageMissions";
import type {
  StoryDropRange,
  StoryFarmDrops,
  StoryFixedBundle,
  StoryStageRewards,
} from "@/types/story";

/**
 * What a stage pays.
 *
 * Two lists, two different promises (ruling #80): a **first-clear bundle** of
 * fixed amounts paid exactly once, and a **farm table** of ranges rolled on every
 * clear including the first. Missions are a third, independent one-time payout —
 * they hang off the same run but are not part of either list, so meeting a
 * mission on the tenth replay still pays.
 */

/** A flat, already-rolled reward bundle ready to hand to the player store. */
export interface StoryPayout {
  gems: number;
  coin: number;
  permanentTicket: number;
  materials: Record<string, number>;
  /** Account XP — one-time sources only, so this is 0 on a plain replay. */
  accountXp: number;
}

export interface StageClearResult {
  /** Null on a replay — the bundle is one-time. */
  firstClear: StoryPayout | null;
  /** Rolled on every clear, first one included. Null on a scene stage, which
   *  has no farm table at all. */
  farm: StoryPayout | null;
  /** Missions this run met that hadn't been banked yet. */
  missions: StoryPayout;
  /** Loot the player actually receives this run — the sum of the above. */
  total: StoryPayout;
}

export function emptyPayout(): StoryPayout {
  return { gems: 0, coin: 0, permanentTicket: 0, materials: {}, accountXp: 0 };
}

/** Inclusive on both bounds. A range whose min exceeds its max is rejected by
 *  the schema at load, so this trusts its input. */
function rollRange(range: StoryDropRange, rng: () => number): number {
  return range.min + Math.floor(rng() * (range.max - range.min + 1));
}

export function fromBundle(bundle: StoryFixedBundle): StoryPayout {
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
function rollFarm(farm: StoryFarmDrops, rng: () => number): StoryPayout {
  const payout = emptyPayout();
  if (farm.coin) payout.coin = rollRange(farm.coin, rng);
  for (const [id, range] of Object.entries(farm.materials ?? {})) {
    const rolled = rollRange(range, rng);
    // A 0 roll is a real outcome for a 0-min range; don't record an entry for
    // it, or the result screen shows "+0 Training Manual".
    if (rolled > 0) payout.materials[id] = rolled;
  }
  return payout;
}

export function addPayouts(a: StoryPayout, b: StoryPayout): StoryPayout {
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
 * Rolls a stage clear. `rng` is injectable (defaults to `Math.random`) so tests
 * can force both bounds of every range deterministically — same contract as
 * `rollWorldBossRewards`.
 *
 * A first clear grants the bundle **and** a farm roll. Paying the bundle alone
 * would make the first clear the only clear that never shows the table it is
 * advertising.
 *
 * `missionOutcomes` may be empty; only outcomes with `paysNow` contribute, so a
 * caller can pass every mission on the stage without filtering first.
 */
export function rollStageRewards(
  rewards: StoryStageRewards,
  isFirstClear: boolean,
  missionOutcomes: MissionOutcome[] = [],
  rng: () => number = Math.random,
): StageClearResult {
  const firstClear = isFirstClear ? fromBundle(rewards.firstClear) : null;
  const farm = rewards.farm ? rollFarm(rewards.farm, rng) : null;
  const missions = missionOutcomes
    .filter((outcome) => outcome.paysNow)
    .reduce(
      (sum, outcome) => addPayouts(sum, fromBundle(outcome.mission.reward)),
      emptyPayout(),
    );

  let total = missions;
  if (firstClear) total = addPayouts(total, firstClear);
  if (farm) total = addPayouts(total, farm);
  return { firstClear, farm, missions, total };
}

/** "300–800" for a range, "2" for a fixed amount. */
function rangeLabel(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

/**
 * One advertised reward, split into its parts so a screen can draw it rather
 * than only print it.
 *
 * The `describe*` functions below are `${amount} ${label}` over this list, which
 * is deliberate: the icon rows and the text rows are the same reward in two
 * renderings, and deriving one from the other is what stops them disagreeing
 * about what a stage pays.
 */
export interface RewardItem {
  /** Stable across renders — a currency name or the material id. */
  key: string;
  /** What `getMaterialArt` resolves the icon from, or null for a payout with no
   *  item behind it at all (account XP is a number, not a thing you hold). */
  iconId: string | null;
  /** "2" for a fixed amount, "300–800" for a farm range. */
  amount: string;
  label: string;
}

/** The first-clear bundle — what an uncleared stage advertises, and what a
 *  cleared one shows struck through as banked. */
export function firstClearItems(rewards: StoryStageRewards): RewardItem[] {
  const items: RewardItem[] = [];
  const { gems, coin, permanentTicket, materials, accountXp } = rewards.firstClear;
  if (gems)
    items.push({ key: "gems", iconId: "gems", amount: `${gems}`, label: "Gems" });
  if (coin)
    items.push({ key: "coin", iconId: "coin", amount: `${coin}`, label: "Coin" });
  if (permanentTicket)
    items.push({
      key: "ticket",
      iconId: "permanent_ticket",
      amount: `${permanentTicket}`,
      label: "Permanent Ticket",
    });
  for (const [id, qty] of Object.entries(materials ?? {})) {
    if (qty)
      items.push({ key: id, iconId: id, amount: `${qty}`, label: materialLabel(id) });
  }
  if (accountXp)
    items.push({
      key: "accountXp",
      iconId: null,
      amount: `${accountXp}`,
      label: "Account XP",
    });
  return items;
}

/** The farm table. Empty for a scene stage, which is why the stage row renders
 *  an em dash there rather than an empty column. */
export function farmItems(rewards: StoryStageRewards): RewardItem[] {
  if (!rewards.farm) return [];
  const items: RewardItem[] = [];
  const { coin, materials } = rewards.farm;
  if (coin)
    items.push({
      key: "coin",
      iconId: "coin",
      amount: rangeLabel(coin.min, coin.max),
      label: "Coin",
    });
  for (const [id, range] of Object.entries(materials ?? {})) {
    items.push({
      key: id,
      iconId: id,
      amount: rangeLabel(range.min, range.max),
      label: materialLabel(id),
    });
  }
  return items;
}

function asLines(items: RewardItem[]): string[] {
  return items.map((item) => `${item.amount} ${item.label}`);
}

/** The first-clear bundle as display lines. */
export function describeFirstClear(rewards: StoryStageRewards): string[] {
  return asLines(firstClearItems(rewards));
}

/** The farm table as display lines. */
export function describeFarm(rewards: StoryStageRewards): string[] {
  return asLines(farmItems(rewards));
}

/** True when a payout would grant nothing — used to skip an empty section on
 *  the result screen rather than render a heading with no rows under it. */
export function isEmptyPayout(payout: StoryPayout): boolean {
  return (
    payout.gems === 0 &&
    payout.coin === 0 &&
    payout.permanentTicket === 0 &&
    payout.accountXp === 0 &&
    Object.keys(payout.materials).length === 0
  );
}
