import { describe, expect, it } from "vitest";
import {
  allOrdersClaimed,
  claimableCount,
  evaluateOrder,
  evaluateOrders,
  getOrder,
  getStarterOrders,
  measureGoal,
  orderCompletion,
  summariseRewards,
  type OrderContext,
} from "@/lib/game/orders";
import { GAME_ROUTES } from "@/lib/nav/routes";
import { chapterKey, getStoryChapter } from "@/lib/game/storyCatalog";
import { getCharacterById } from "@/lib/game/characterCatalog";

/**
 * Bureau Orders (2026-08-12).
 *
 * The board is the FTUE's spine, so the failure modes matter more than usual:
 * an order that can never complete is a reward dangled forever, and one that
 * starts complete pays for nothing. Both are silent.
 */

const EMPTY: OrderContext = {
  completedChapters: {},
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
      const { gems, coin, permanentTicket, materials, character } =
        order.reward;
      const paid =
        (gems ?? 0) > 0 ||
        (coin ?? 0) > 0 ||
        (permanentTicket ?? 0) > 0 ||
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
  const order = getOrder("first-chapter")!;

  it("is claimable once met and not before", () => {
    expect(evaluateOrder(order, EMPTY).claimable).toBe(false);
    expect(
      evaluateOrder(order, {
        ...EMPTY,
        completedChapters: { "part1:p1c1": true },
      }).claimable,
    ).toBe(true);
  });

  it("stops being claimable once claimed", () => {
    const entry = evaluateOrder(order, {
      ...EMPTY,
      completedChapters: { "part1:p1c1": true },
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

describe("Lyra joins after Part 2", () => {
  const lyra = getOrder("lyra-joins")!;

  it("hands over the character herself", () => {
    expect(lyra.reward.character).toBe("lyra");
  });

  it("waits for the specific chapter, not just any two", () => {
    // Clearing two unrelated chapters must not hand her over.
    const elsewhere = {
      ...EMPTY,
      completedChapters: { "part1:p1c1": true, "part1:p1c2": true },
    };
    expect(evaluateOrder(lyra, elsewhere).met).toBe(false);

    const done = {
      ...EMPTY,
      completedChapters: { "part2:p2c2": true },
    };
    expect(evaluateOrder(lyra, done).met).toBe(true);
    expect(evaluateOrder(lyra, done).claimable).toBe(true);
  });

  it("reads as a single step, not a progress bar", () => {
    expect(evaluateOrder(lyra, EMPTY).required).toBe(1);
  });

  it("keys chapters exactly the way storyStore does", () => {
    // `lib/game/orders.ts` rebuilds the `partId:chapterId` key rather than
    // importing `chapterKey`, to keep the story catalogue out of playerStore's
    // import graph. This is the guard against those two drifting apart.
    const goal = lyra.goal;
    if (goal.type !== "chapterCleared") throw new Error("goal type changed");
    const key = chapterKey(goal.partId, goal.chapterId);
    expect(
      evaluateOrder(lyra, { ...EMPTY, completedChapters: { [key]: true } }).met,
    ).toBe(true);
  });

  it("names a chapter that actually exists", () => {
    const goal = lyra.goal;
    if (goal.type !== "chapterCleared") throw new Error("goal type changed");
    expect(getStoryChapter(goal.partId, goal.chapterId)).toBeDefined();
  });

  it("promises a character the catalogue has", () => {
    // The schema refuses an unknown id at load, so reaching this means the
    // reward is real. Asserted anyway: it's the one reward that can't be
    // substituted if it turns out to be wrong.
    expect(getCharacterById(lyra.reward.character!)).toBeDefined();
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

  it("names the characters on offer, since that's the actual draw", () => {
    expect(total.characters).toContain("lyra");
  });

  it("totals nothing for an empty list", () => {
    expect(summariseRewards([])).toEqual({
      gems: 0,
      coin: 0,
      permanentTicket: 0,
      materials: {},
      characters: [],
    });
  });
});

describe("the board's ordering", () => {
  it("puts what can be claimed first and what's done last", () => {
    const context: OrderContext = {
      ...EMPTY,
      completedChapters: { "part1:p1c1": true },
      pulls: 11,
      claimed: { "first-summon": true },
    };
    const board = evaluateOrders(context);
    expect(board[0].order.id).toBe("first-chapter");
    expect(board[board.length - 1].order.id).toBe("first-summon");
  });

  it("counts what's claimed and what's ready", () => {
    const board = evaluateOrders({
      ...EMPTY,
      completedChapters: { "part1:p1c1": true },
      pulls: 11,
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
