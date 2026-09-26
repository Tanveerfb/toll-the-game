import { describe, expect, it } from "vitest";
import {
  allOrdersClaimed,
  claimableCount,
  evaluateOrder,
  evaluateOrders,
  getOrder,
  getOrdersForStep,
  getStarterOrders,
  currentStep,
  isStepUnlocked,
  measureGoal,
  ORDER_STEPS,
  orderCompletion,
  summariseRewards,
  type OrderContext,
} from "@/lib/game/orders";
import { GAME_ROUTES } from "@/lib/nav/routes";

/**
 * Bureau Orders (2026-08-12).
 *
 * The board is the FTUE's spine, so the failure modes matter more than usual:
 * an order that can never complete is a reward dangled forever, and one that
 * starts complete pays for nothing. Both are silent.
 */

const EMPTY: OrderContext = {
  pulls: 0,
  bossClears: 0,
  presetsSaved: 0,
  rosterSize: 1,
  accountRank: 1,
  characters: {},
  claimed: {},
};

describe("the authored board", () => {
  const orders = getStarterOrders();

  it("loads", () => {
    expect(orders.length).toBeGreaterThan(0);
  });

  it("has unique ids", () => {
    const ids = orders.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points every order at a route that exists", () => {
    // A destination button that 404s is worse than no button.
    const routes = new Set(GAME_ROUTES.map((r) => r.href));
    for (const order of orders) {
      expect(routes.has(order.route)).toBe(true);
    }
  });

  it("pays something for every order", () => {
    for (const order of orders) {
      const { gems, coin, permanentTicket, autoClearTickets, materials, character } =
        order.reward;
      const paid =
        (gems ?? 0) > 0 ||
        (coin ?? 0) > 0 ||
        (permanentTicket ?? 0) > 0 ||
        (autoClearTickets ?? 0) > 0 ||
        Object.keys(materials ?? {}).length > 0 ||
        character !== undefined;
      expect(paid).toBe(true);
    }
  });

  it("only requires orders that exist, and never itself", () => {
    for (const order of orders) {
      if (!order.requires) continue;
      expect(order.requires).not.toBe(order.id);
      expect(getOrder(order.requires)).toBeDefined();
    }
  });

  it("has no prerequisite cycles", () => {
    for (const order of orders) {
      const seen = new Set<string>([order.id]);
      let current = order.requires;
      while (current) {
        expect(seen.has(current)).toBe(false);
        seen.add(current);
        current = getOrder(current)?.requires;
      }
    }
  });

  it("starts a fresh account with nothing already complete", () => {
    // Except by design: a brand-new account owns one character and sits at
    // rank 1, so nothing on the board may be satisfied by that alone.
    const board = evaluateOrders(EMPTY);
    expect(claimableCount(board)).toBe(0);
    expect(board.every((entry) => !entry.met)).toBe(true);
  });
});

describe("measuring progress", () => {
  it("reads the best character, not the first", () => {
    const context: OrderContext = {
      ...EMPTY,
      characters: {
        duke: { level: 3, ascension: 0 },
        lyra: { level: 12, ascension: 2 },
      },
    };
    expect(measureGoal({ type: "characterLevel", level: 5 }, context)).toBe(12);
    expect(
      measureGoal({ type: "characterAscension", ascension: 1 }, context),
    ).toBe(2);
  });

  it("reads an empty roster as zero, not as level 1", () => {
    // Every character is implicitly level 1, so counting that would start
    // "raise someone to level 5" at 20% done on nobody.
    expect(measureGoal({ type: "characterLevel", level: 5 }, EMPTY)).toBe(0);
  });

  it("caps the displayed progress at the requirement", () => {
    const order = getOrder("first-summon")!;
    const entry = evaluateOrder(order, { ...EMPTY, pulls: 99 });
    expect(entry.current).toBe(entry.required);
    expect(entry.met).toBe(true);
  });
});

describe("claiming", () => {
  const order = getOrder("first-summon")!;

  it("is claimable once met and not before", () => {
    expect(evaluateOrder(order, EMPTY).claimable).toBe(false);
    expect(evaluateOrder(order, { ...EMPTY, pulls: 11 }).claimable).toBe(true);
  });

  it("stops being claimable once claimed", () => {
    const entry = evaluateOrder(order, {
      ...EMPTY,
      pulls: 11,
      claimed: { [order.id]: true },
    });
    expect(entry.claimed).toBe(true);
    expect(entry.claimable).toBe(false);
  });

  it("stays locked until its prerequisite is claimed, even when met", () => {
    // Ascension needs materials the boss drops, so it follows the boss order.
    const ascension = getOrder("first-ascension")!;
    const met: OrderContext = {
      ...EMPTY,
      bossClears: 1,
      characters: { duke: { level: 1, ascension: 1 } },
    };
    const locked = evaluateOrder(ascension, met);
    expect(locked.met).toBe(true);
    expect(locked.lockedBy?.id).toBe("first-boss");
    expect(locked.claimable).toBe(false);

    const unlocked = evaluateOrder(ascension, {
      ...met,
      claimed: { "first-boss": true },
    });
    expect(unlocked.lockedBy).toBeNull();
    expect(unlocked.claimable).toBe(true);
  });
});

describe("what a signed-out player is shown", () => {
  // Claiming is account-gated (Tanveer, 2026-08-13), so a guest sees the
  // total instead of the checklist. If this ever totals to nothing, the
  // sign-in pitch is an empty promise.
  const total = summariseRewards(getStarterOrders());

  it("adds up every currency across the board", () => {
    const orders = getStarterOrders();
    const gems = orders.reduce((sum, o) => sum + (o.reward.gems ?? 0), 0);
    const coin = orders.reduce((sum, o) => sum + (o.reward.coin ?? 0), 0);
    expect(total.gems).toBe(gems);
    expect(total.coin).toBe(coin);
    expect(total.gems).toBeGreaterThan(0);
  });

  it("merges materials of the same kind rather than listing them twice", () => {
    // Two orders pay training manuals of different tiers; a naive merge would
    // either overwrite or duplicate them.
    const manualOrders = getStarterOrders().filter((o) =>
      Object.keys(o.reward.materials ?? {}).length > 0,
    );
    const expected: Record<string, number> = {};
    for (const order of manualOrders) {
      for (const [id, count] of Object.entries(order.reward.materials ?? {})) {
        expected[id] = (expected[id] ?? 0) + count;
      }
    }
    expect(total.materials).toEqual(expected);
  });

  it("lists no characters since story mode went", () => {
    // Lyra was the one character on the board, granted for finishing story
    // chapter 1. That order went with story mode on 2026-09-26; the login
    // pitch falls back to gems alone when this list is empty.
    expect(total.characters).toEqual([]);
  });

  it("totals nothing for an empty list", () => {
    expect(summariseRewards([])).toEqual({
      gems: 0,
      coin: 0,
      permanentTicket: 0,
      autoClearTickets: 0,
      materials: {},
      characters: [],
    });
  });
});

describe("the board's ordering", () => {
  it("puts what can be claimed first and what's done last", () => {
    const context: OrderContext = {
      ...EMPTY,
      pulls: 11,
      characters: { duke: { level: 5, ascension: 0 } },
      claimed: { "first-summon": true },
    };
    const board = evaluateOrders(context);
    expect(board[0].order.id).toBe("first-level");
    expect(board[board.length - 1].order.id).toBe("first-summon");
  });

  it("counts what's claimed and what's ready", () => {
    const board = evaluateOrders({
      ...EMPTY,
      pulls: 11,
      characters: { duke: { level: 5, ascension: 0 } },
      claimed: { "first-summon": true },
    });
    expect(claimableCount(board)).toBe(1);
    expect(orderCompletion(board)).toEqual({
      claimed: 1,
      total: getStarterOrders().length,
    });
  });

  it("reports done only when every order is claimed", () => {
    const all = Object.fromEntries(
      getStarterOrders().map((order) => [order.id, true]),
    );
    expect(allOrdersClaimed(evaluateOrders(EMPTY))).toBe(false);
    expect(allOrdersClaimed(evaluateOrders({ ...EMPTY, claimed: all }))).toBe(
      true,
    );
  });
});

describe("steps (Tanveer, 2026-08-13)", () => {
  const allClaimed = (step: number): Record<string, boolean> =>
    Object.fromEntries(getOrdersForStep(step).map((o) => [o.id, true]));

  it("authors eight orders per step, until he refills them", () => {
    // His rule: "for each step, keep it with 10 missions". Removing story mode
    // on 2026-09-26 took two orders out of each step, leaving eight. Whether
    // to author replacements is his call; this pins the current count so a
    // change to it is deliberate, and the gap is recorded in docs/STATUS.md.
    for (const step of ORDER_STEPS) {
      expect(getOrdersForStep(step), `step ${step}`).toHaveLength(8);
    }
  });

  it("gives every order a step, with no gaps in the sequence", () => {
    expect(ORDER_STEPS).toEqual(
      Array.from({ length: ORDER_STEPS.length }, (_, i) => i + 1),
    );
  });

  it("has no duplicate order ids across steps", () => {
    const ids = getStarterOrders().map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("opens step 1 immediately", () => {
    expect(isStepUnlocked(1, {})).toBe(true);
  });

  it("keeps step 2 shut until every step-1 order is CLAIMED", () => {
    expect(isStepUnlocked(2, {})).toBe(false);

    // Met-but-unclaimed is not finished: the reward is still sitting there.
    const allButOne = allClaimed(1);
    const lastId = getOrdersForStep(1).at(-1)!.id;
    delete allButOne[lastId];
    expect(isStepUnlocked(2, allButOne)).toBe(false);

    expect(isStepUnlocked(2, allClaimed(1))).toBe(true);
  });

  it("marks a locked step's orders stepLocked and unclaimable, but still tracks progress", () => {
    const context = {
      ...EMPTY,
      // Rank 15 satisfies a step-2 order outright.
      accountRank: 20,
      claimed: {},
    };
    const board = evaluateOrders(context, 2);
    const rankOrder = board.find((e) => e.order.id === "s2-rank-fifteen");
    expect(rankOrder).toBeDefined();
    expect(rankOrder!.met).toBe(true);
    expect(rankOrder!.stepLocked).toBe(true);
    // Progress is real and kept; only collection waits.
    expect(rankOrder!.claimable).toBe(false);
    expect(rankOrder!.current).toBe(15);
  });

  it("makes that same order claimable once step 1 is done", () => {
    const board = evaluateOrders(
      { ...EMPTY, accountRank: 20, claimed: allClaimed(1) },
      2,
    );
    const rankOrder = board.find((e) => e.order.id === "s2-rank-fifteen")!;
    expect(rankOrder.stepLocked).toBe(false);
    expect(rankOrder.claimable).toBe(true);
  });

  it("filters to one step and never interleaves another", () => {
    const board = evaluateOrders(EMPTY, 1);
    expect(board).toHaveLength(getOrdersForStep(1).length);
    expect(board.every((e) => e.order.step === 1)).toBe(true);
  });

  it("points at the first unfinished step", () => {
    expect(currentStep({ ...EMPTY, claimed: {} })).toBe(1);
    expect(currentStep({ ...EMPTY, claimed: allClaimed(1) })).toBe(2);
  });

  it("pays ten Auto Clear Tickets across the authored board", () => {
    // Tanveer, 2026-08-13: "let's give our 10 tickets for now". Placeholder
    // like every other order reward — his to tune.
    expect(summariseRewards(getStarterOrders()).autoClearTickets).toBe(10);
  });
});
