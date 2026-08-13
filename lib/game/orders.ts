import { z } from "zod";
import starterOrders from "@/data/orders/starter.json";
import { getCharacterById } from "@/lib/game/characterCatalog";

/**
 * Bureau Orders — the starter objective list.
 *
 * The FTUE gap was two separate problems (`docs/STATUS.md`): *how do I take a
 * turn*, which coach marks answer, and *what do I do next*, which nothing
 * answered at all. A new account cleared chapter 1 and the game went quiet,
 * with 1,000 unmentioned gems in the wallet and a stamina bar whose purpose
 * was never stated.
 *
 * An order names a destination, a reason to go there, and pays for arriving.
 * It teaches a system by making you use it once, which beats a paragraph
 * describing it.
 *
 * Deliberately built as a general evaluator rather than a hardcoded starter
 * checklist: daily missions are the same question asked on a timer, and that
 * is a roadmap item. Everything here is pure — no React, no store — so the
 * rules are testable and the panel stays presentational.
 */

const goalSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chaptersCleared"), count: z.number().int().positive() }),
  z.object({
    type: z.literal("chapterCleared"),
    partId: z.string().min(1),
    chapterId: z.string().min(1),
  }),
  z.object({ type: z.literal("pulls"), count: z.number().int().positive() }),
  z.object({ type: z.literal("characterLevel"), level: z.number().int().positive() }),
  z.object({
    type: z.literal("characterAscension"),
    ascension: z.number().int().positive(),
  }),
  z.object({ type: z.literal("presetsSaved"), count: z.number().int().positive() }),
  z.object({ type: z.literal("bossClears"), count: z.number().int().positive() }),
  z.object({ type: z.literal("accountRank"), rank: z.number().int().positive() }),
  z.object({ type: z.literal("rosterSize"), count: z.number().int().positive() }),
]);

const rewardSchema = z.object({
  gems: z.number().int().nonnegative().optional(),
  coin: z.number().int().nonnegative().optional(),
  permanentTicket: z.number().int().nonnegative().optional(),
  materials: z.record(z.string(), z.number().int().positive()).optional(),
  /**
   * A character, handed over outright.
   *
   * Validated against the catalogue at load time — an order promising a
   * character id that doesn't exist would be a permanently unclaimable reward
   * that only fails at the moment someone earns it.
   */
  character: z
    .string()
    .min(1)
    .refine((id) => getCharacterById(id) !== undefined, {
      message: "reward character is not in the catalogue",
    })
    .optional(),
});

const orderSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** One line under the title saying where to go or what to do. */
  hint: z.string().min(1),
  route: z.string().startsWith("/"),
  routeLabel: z.string().min(1),
  /** Another order that must be claimed first. Used only where the sequence is
   *  real — ascension needs materials the boss drops. */
  requires: z.string().optional(),
  goal: goalSchema,
  reward: rewardSchema,
});

export type OrderGoal = z.infer<typeof goalSchema>;
export type OrderReward = z.infer<typeof rewardSchema>;
export type Order = z.infer<typeof orderSchema>;

/** Fail loudly at load time on malformed order JSON — same policy as kits and
 *  story parts. A silently dropped order is a reward nobody can ever claim. */
const ORDERS: Order[] = z.array(orderSchema).parse(starterOrders);

export function getStarterOrders(): Order[] {
  return ORDERS;
}

export function getOrder(id: string): Order | undefined {
  return ORDERS.find((order) => order.id === id);
}

/**
 * Everything an order can be measured against.
 *
 * Deliberately a plain snapshot rather than the store itself: `playerStore`
 * imports from `lib/game`, so depending on it here would close the loop, and a
 * flat shape is what makes these rules testable.
 */
export interface OrderContext {
  /**
   * Cleared story chapters, keyed `partId:chapterId` — the same shape
   * `storyStore.completed` holds.
   *
   * The map rather than a count, because an order can name a *specific*
   * chapter: Lyra is given for clearing Part 2 Chapter 2, the point at which
   * she stops being a story NPC.
   */
  completedChapters: Record<string, boolean>;
  pulls: number;
  bossClears: number;
  presetsSaved: number;
  rosterSize: number;
  accountRank: number;
  characters: Record<string, { level: number; ascension: number }>;
  claimed: Record<string, boolean>;
}

export interface OrderProgress {
  order: Order;
  /** How far along, capped at `required` so a bar can't overfill. */
  current: number;
  required: number;
  met: boolean;
  claimed: boolean;
  /** Set when a prerequisite order hasn't been claimed yet. */
  lockedBy: Order | null;
  /** Met, unclaimed, and not locked — the only state with a button. */
  claimable: boolean;
}

/** The best single character on an axis — orders read "any character", so one
 *  qualifying unit is enough. */
function bestCharacterStat(
  characters: OrderContext["characters"],
  pick: (progress: { level: number; ascension: number }) => number,
): number {
  const values = Object.values(characters).map(pick);
  return values.length > 0 ? Math.max(...values) : 0;
}

/**
 * How `storyStore` keys a cleared chapter.
 *
 * Mirrors `chapterKey` in `lib/game/storyCatalog.ts` rather than importing it:
 * that module validates every story JSON at load, and this one is pulled in by
 * `playerStore`, which half the app imports. `tests/orders.test.ts` asserts the
 * two formats agree, so the copy can't drift.
 */
function chapterProgressKey(partId: string, chapterId: string): string {
  return `${partId}:${chapterId}`;
}

/** Raw progress toward a goal, before any capping. */
export function measureGoal(goal: OrderGoal, context: OrderContext): number {
  switch (goal.type) {
    case "chaptersCleared":
      return Object.values(context.completedChapters).filter(Boolean).length;
    case "chapterCleared":
      return context.completedChapters[
        chapterProgressKey(goal.partId, goal.chapterId)
      ]
        ? 1
        : 0;
    case "pulls":
      return context.pulls;
    case "characterLevel":
      // An unlevelled character is level 1, so an empty roster reads 0 rather
      // than 1 — "raise a character to 5" shouldn't start 20% done on nothing.
      return bestCharacterStat(context.characters, (p) => p.level);
    case "characterAscension":
      return bestCharacterStat(context.characters, (p) => p.ascension);
    case "presetsSaved":
      return context.presetsSaved;
    case "bossClears":
      return context.bossClears;
    case "accountRank":
      return context.accountRank;
    case "rosterSize":
      return context.rosterSize;
  }
}

function requirementOf(goal: OrderGoal): number {
  switch (goal.type) {
    case "characterLevel":
      return goal.level;
    case "characterAscension":
      return goal.ascension;
    case "accountRank":
      return goal.rank;
    case "chapterCleared":
      // A named chapter is done or it isn't; there is no progress to show.
      return 1;
    default:
      return goal.count;
  }
}

export function evaluateOrder(
  order: Order,
  context: OrderContext,
): OrderProgress {
  const required = requirementOf(order.goal);
  const raw = measureGoal(order.goal, context);
  const current = Math.min(raw, required);
  const met = raw >= required;
  const claimed = context.claimed[order.id] === true;

  const prerequisite = order.requires ? getOrder(order.requires) : undefined;
  const lockedBy =
    prerequisite && context.claimed[prerequisite.id] !== true
      ? prerequisite
      : null;

  return {
    order,
    current,
    required,
    met,
    claimed,
    lockedBy,
    claimable: met && !claimed && lockedBy === null,
  };
}

/**
 * The whole board, in the order the player should work through it: claimable
 * first (they came here to collect), then in progress, then locked, then done.
 * Within a group the authored order stands.
 */
export function evaluateOrders(context: OrderContext): OrderProgress[] {
  const rank = (progress: OrderProgress): number => {
    if (progress.claimable) return 0;
    if (progress.claimed) return 3;
    if (progress.lockedBy) return 2;
    return 1;
  };
  return ORDERS.map((order) => evaluateOrder(order, context)).sort(
    (a, b) => rank(a) - rank(b),
  );
}

export function claimableCount(board: OrderProgress[]): number {
  return board.filter((entry) => entry.claimable).length;
}

/** Claimed over total — the header line, and what tells a player the list ends. */
export function orderCompletion(board: OrderProgress[]): {
  claimed: number;
  total: number;
} {
  return {
    claimed: board.filter((entry) => entry.claimed).length,
    total: board.length,
  };
}

/** True once every order has been claimed, which is when the panel retires
 *  itself — a permanently empty checklist on the home screen is clutter. */
export function allOrdersClaimed(board: OrderProgress[]): boolean {
  return board.length > 0 && board.every((entry) => entry.claimed);
}

export interface RewardSummary {
  gems: number;
  coin: number;
  permanentTicket: number;
  materials: Record<string, number>;
  /** Character ids handed over outright, in board order. */
  characters: string[];
}

/**
 * Everything the board pays, added up.
 *
 * Claiming is gated behind a signed-in account (Tanveer, 2026-08-13), so a
 * guest sees this total instead of the checklist — the reason to make an
 * account, stated in the currency the player actually cares about rather than
 * as "sync your progress".
 *
 * Takes a list so it can total the whole board or just what's unclaimed.
 */
export function summariseRewards(orders: Order[]): RewardSummary {
  const summary: RewardSummary = {
    gems: 0,
    coin: 0,
    permanentTicket: 0,
    materials: {},
    characters: [],
  };
  for (const order of orders) {
    summary.gems += order.reward.gems ?? 0;
    summary.coin += order.reward.coin ?? 0;
    summary.permanentTicket += order.reward.permanentTicket ?? 0;
    for (const [id, count] of Object.entries(order.reward.materials ?? {})) {
      summary.materials[id] = (summary.materials[id] ?? 0) + count;
    }
    if (order.reward.character) summary.characters.push(order.reward.character);
  }
  return summary;
}
