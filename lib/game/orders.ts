import { z } from "zod";
import step1Orders from "@/data/orders/step-1.json";
import step2Orders from "@/data/orders/step-2.json";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { materialLabel } from "@/lib/game/materials";

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
  /** Auto Clear Tickets. Not a material — see `lib/game/autoClear.ts`. */
  autoClearTickets: z.number().int().nonnegative().optional(),
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
   *  real — ascension needs materials the boss drops. Cross-step `requires` is
   *  legal but redundant: a later step is already gated on the earlier one. */
  requires: z.string().optional(),
  /**
   * Which step this order belongs to (1-based).
   *
   * Steps are the long-term shape of the board (Tanveer, 2026-08-13): ten
   * orders each, and finishing one step unlocks the next. The alternative —
   * one ever-growing list — turns into a wall of objectives a new account
   * cannot read, which is the exact problem Bureau Orders was built to solve.
   */
  step: z.number().int().positive(),
  goal: goalSchema,
  reward: rewardSchema,
});

export type OrderGoal = z.infer<typeof goalSchema>;
export type OrderReward = z.infer<typeof rewardSchema>;
export type Order = z.infer<typeof orderSchema>;

/** Fail loudly at load time on malformed order JSON — same policy as kits and
 *  story parts. A silently dropped order is a reward nobody can ever claim. */
const ORDERS: Order[] = z
  .array(orderSchema)
  .parse([...step1Orders, ...step2Orders]);

/** Every authored step, ascending. */
export const ORDER_STEPS: readonly number[] = [
  ...new Set(ORDERS.map((order) => order.step)),
].sort((a, b) => a - b);

export function getStarterOrders(): Order[] {
  return ORDERS;
}

/**
 * The orders a specific chapter satisfies.
 *
 * Story mode advertises these on the chapter card and confirms them on the clear
 * summary, so a reward tied to a chapter is visible *at* that chapter. Before
 * this, `lyra-joins` — a free character for finishing part 2 — existed only
 * inside the Orders modal in the nav, and nothing on the chapter that grants her
 * said so.
 *
 * Only `chapterCleared` goals qualify. `chaptersCleared` counts progress across
 * the whole arc, so it belongs to no single chapter and pinning it to one would
 * promise the same reward on every chapter the player opens.
 */
export function ordersForChapter(partId: string, chapterId: string): Order[] {
  return ORDERS.filter(
    (order) =>
      order.goal.type === "chapterCleared" &&
      order.goal.partId === partId &&
      order.goal.chapterId === chapterId,
  );
}

/**
 * An order's reward in as few words as a ribbon allows — "Lyra", "125 Gems".
 *
 * A character is named alone even when the order also pays currency: the
 * character is the reason anyone cares, and a ribbon has room for one idea.
 */
export function describeOrderReward(reward: OrderReward): string {
  if (reward.character) {
    return getCharacterById(reward.character)?.name ?? reward.character;
  }
  if (reward.gems) return `${reward.gems} Gems`;
  if (reward.coin) return `${reward.coin} Coin`;
  if (reward.permanentTicket) return `${reward.permanentTicket} Ticket`;
  if (reward.autoClearTickets) return `${reward.autoClearTickets} Auto-Clear`;
  const first = Object.entries(reward.materials ?? {})[0];
  return first ? `${first[1]} ${materialLabel(first[0])}` : "Reward";
}

export function getOrdersForStep(step: number): Order[] {
  return ORDERS.filter((order) => order.step === step);
}

export function getOrder(id: string): Order | undefined {
  return ORDERS.find((order) => order.id === id);
}

/**
 * A step is open once every order in the step before it has been **claimed**.
 *
 * Claimed, not merely met: the same rule `requires` uses. A player who has
 * satisfied the last order but not collected it hasn't finished the step, and
 * unlocking early would hide the reward behind a tab they just left.
 */
export function isStepUnlocked(
  step: number,
  claimed: Record<string, boolean>,
): boolean {
  const previous = ORDER_STEPS.filter((s) => s < step);
  return previous.every((s) =>
    getOrdersForStep(s).every((order) => claimed[order.id] === true),
  );
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
  /** The whole step is still locked behind an earlier one. Distinct from
   *  `lockedBy`, which is a single named prerequisite — the UI says different
   *  things about them and only one is the player's next action. */
  stepLocked: boolean;
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
  const stepLocked = !isStepUnlocked(order.step, context.claimed);

  return {
    order,
    current,
    required,
    met,
    claimed,
    lockedBy,
    stepLocked,
    // Progress toward a locked step's orders still counts — a player who
    // happened to reach rank 15 early keeps it — but they cannot collect
    // until the step opens.
    claimable: met && !claimed && lockedBy === null && !stepLocked,
  };
}

/**
 * One step's board, in the order the player should work through it: claimable
 * first (they came here to collect), then in progress, then locked, then done.
 * Within a group the authored order stands.
 *
 * Sorted per step, never across steps — the tabs are the grouping, and a
 * global sort would interleave a step-2 order into the step-1 list.
 */
export function evaluateOrders(
  context: OrderContext,
  step?: number,
): OrderProgress[] {
  const rank = (progress: OrderProgress): number => {
    if (progress.claimable) return 0;
    if (progress.claimed) return 3;
    if (progress.lockedBy) return 2;
    return 1;
  };
  const pool = step === undefined ? ORDERS : getOrdersForStep(step);
  return pool
    .map((order) => evaluateOrder(order, context))
    .sort((a, b) => rank(a) - rank(b));
}

/** The step the player should be looking at: the first that isn't fully
 *  claimed, falling back to the last once everything is done. */
export function currentStep(context: OrderContext): number {
  const open = ORDER_STEPS.find((step) =>
    getOrdersForStep(step).some((order) => context.claimed[order.id] !== true),
  );
  return open ?? ORDER_STEPS[ORDER_STEPS.length - 1];
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
  autoClearTickets: number;
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
    autoClearTickets: 0,
    materials: {},
    characters: [],
  };
  for (const order of orders) {
    summary.gems += order.reward.gems ?? 0;
    summary.coin += order.reward.coin ?? 0;
    summary.permanentTicket += order.reward.permanentTicket ?? 0;
    summary.autoClearTickets += order.reward.autoClearTickets ?? 0;
    for (const [id, count] of Object.entries(order.reward.materials ?? {})) {
      summary.materials[id] = (summary.materials[id] ?? 0) + count;
    }
    if (order.reward.character) summary.characters.push(order.reward.character);
  }
  return summary;
}
