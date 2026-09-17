import { describe, expect, it, vi } from "vitest";
import {
  createMechanicQueue,
  type QueueItem,
} from "@/lib/game/mechanicQueue";
import type { BattleCharacter } from "@/types/character";

/**
 * The passive queue — the runner both the battle screen and the simulator use.
 *
 * It had **no tests of its own** until 2026-09-17 (audit finding T1), despite
 * being the single implementation behind every passive in the game. It was
 * exercised indirectly through battle and simulator tests, which is a weaker
 * guarantee: those fail for a hundred reasons, so none of them fails *because
 * of* the queue.
 *
 * Its whole reason for existing is that the simulated fight and the real one
 * must not drift — the logic was lifted out of `MechanicProvider` so headless
 * code could run passives at all. Every rule below is one the two callers
 * silently depend on.
 */

function unit(
  instanceId: string,
  currentHP = 100,
  name = instanceId,
): BattleCharacter {
  return { instanceId, name, currentHP } as unknown as BattleCharacter;
}

function teamsOf(player: BattleCharacter[], enemy: BattleCharacter[] = []) {
  return { playerTeam: player, enemyTeam: enemy };
}

/** A queue item that records it ran, and passes the teams through untouched. */
function spyItem(
  overrides: Partial<QueueItem> & Pick<QueueItem, "id" | "sourceInstanceId">,
): { item: QueueItem; calls: string[] } {
  const calls: string[] = [];
  const item: QueueItem = {
    phase: "OnBattleStart",
    mechanicId: "test",
    action: async (_source, teams) => {
      calls.push(overrides.id);
      return teams;
    },
    ...overrides,
  };
  return { item, calls };
}

describe("registration", () => {
  it("ignores a duplicate id, so a re-registered passive cannot fire twice", async () => {
    // The rule the source comments on directly. Re-registering happens
    // whenever a provider remounts, and a passive that fires twice is a
    // double heal or a double buff with no visible cause.
    const queue = createMechanicQueue();
    const a = spyItem({ id: "p1", sourceInstanceId: "u1" });
    const b = spyItem({ id: "p1", sourceInstanceId: "u1" });
    queue.register(a.item);
    queue.register(b.item);

    await queue.process("OnBattleStart", teamsOf([unit("u1")]), () => {});
    expect(a.calls).toEqual(["p1"]);
    expect(b.calls).toEqual([]);
  });

  it("keeps two different ids from the same unit", async () => {
    // A character with two passives is normal; deduping by source would break it.
    const queue = createMechanicQueue();
    const a = spyItem({ id: "p1", sourceInstanceId: "u1" });
    const b = spyItem({ id: "p2", sourceInstanceId: "u1" });
    queue.register(a.item);
    queue.register(b.item);

    await queue.process("OnBattleStart", teamsOf([unit("u1")]), () => {});
    expect([...a.calls, ...b.calls]).toEqual(["p1", "p2"]);
  });

  it("removes one item by id and leaves the rest", async () => {
    const queue = createMechanicQueue();
    const a = spyItem({ id: "p1", sourceInstanceId: "u1" });
    const b = spyItem({ id: "p2", sourceInstanceId: "u1" });
    queue.register(a.item);
    queue.register(b.item);
    queue.remove("p1");

    await queue.process("OnBattleStart", teamsOf([unit("u1")]), () => {});
    expect(a.calls).toEqual([]);
    expect(b.calls).toEqual(["p2"]);
  });

  it("clears everything", async () => {
    const queue = createMechanicQueue();
    const a = spyItem({ id: "p1", sourceInstanceId: "u1" });
    queue.register(a.item);
    queue.clear();

    await queue.process("OnBattleStart", teamsOf([unit("u1")]), () => {});
    expect(a.calls).toEqual([]);
  });
});

describe("what runs, and when", () => {
  it("runs only the items registered for the phase being processed", async () => {
    const queue = createMechanicQueue();
    const start = spyItem({
      id: "start",
      sourceInstanceId: "u1",
      phase: "OnBattleStart",
    });
    const turnEnd = spyItem({
      id: "turnEnd",
      sourceInstanceId: "u1",
      phase: "OnPlayerTurnEnd",
    });
    queue.register(start.item);
    queue.register(turnEnd.item);

    await queue.process("OnBattleStart", teamsOf([unit("u1")]), () => {});
    expect(start.calls).toEqual(["start"]);
    expect(turnEnd.calls).toEqual([]);
  });

  it("finds its source on either team", async () => {
    const queue = createMechanicQueue();
    const a = spyItem({ id: "p1", sourceInstanceId: "e1" });
    queue.register(a.item);

    await queue.process("OnBattleStart", teamsOf([], [unit("e1")]), () => {});
    expect(a.calls).toEqual(["p1"]);
  });

  it("skips an item whose source is not on the field at all", async () => {
    // A stale registration from a previous battle must not run against
    // whoever happens to be standing there now.
    const queue = createMechanicQueue();
    const a = spyItem({ id: "p1", sourceInstanceId: "ghost" });
    queue.register(a.item);

    await queue.process("OnBattleStart", teamsOf([unit("u1")]), () => {});
    expect(a.calls).toEqual([]);
  });
});

describe("the dead", () => {
  it("skips a dead source by default", async () => {
    const queue = createMechanicQueue();
    const a = spyItem({ id: "p1", sourceInstanceId: "u1" });
    queue.register(a.item);

    await queue.process("OnBattleStart", teamsOf([unit("u1", 0)]), () => {});
    expect(a.calls).toEqual([]);
  });

  it("runs a dead source when the item asks to", async () => {
    // `runWhenDead` exists for cleanup rechecks that have to fire on the very
    // turn a unit is removed — ruling #131's taunt sweep was one of these.
    const queue = createMechanicQueue();
    const a = spyItem({
      id: "p1",
      sourceInstanceId: "u1",
      runWhenDead: true,
    });
    queue.register(a.item);

    await queue.process("OnBattleStart", teamsOf([unit("u1", 0)]), () => {});
    expect(a.calls).toEqual(["p1"]);
  });
});

describe("threading teams through", () => {
  it("feeds each action the previous one's output, not the original", async () => {
    // The rule that makes a chain of passives compose. If each action saw the
    // teams `process` was called with, the last writer would win and every
    // earlier passive in the phase would be silently discarded.
    const queue = createMechanicQueue();
    const seen: number[] = [];

    queue.register({
      id: "first",
      phase: "OnBattleStart",
      sourceInstanceId: "u1",
      mechanicId: "m",
      action: async (_s, teams) => {
        seen.push(teams.playerTeam[0].currentHP);
        return teamsOf([unit("u1", 50)]);
      },
    });
    queue.register({
      id: "second",
      phase: "OnBattleStart",
      sourceInstanceId: "u1",
      mechanicId: "m",
      action: async (_s, teams) => {
        seen.push(teams.playerTeam[0].currentHP);
        return teamsOf([unit("u1", 25)]);
      },
    });

    const out = await queue.process(
      "OnBattleStart",
      teamsOf([unit("u1", 100)]),
      () => {},
    );

    expect(seen).toEqual([100, 50]);
    expect(out.playerTeam[0].currentHP).toBe(25);
  });

  it("returns the teams unchanged when nothing is due", async () => {
    const queue = createMechanicQueue();
    const teams = teamsOf([unit("u1", 77)]);
    const out = await queue.process("OnBattleStart", teams, () => {});
    expect(out.playerTeam[0].currentHP).toBe(77);
  });

  it("re-reads the source from the CURRENT teams, not the originals", async () => {
    // A passive that kills its own source must not then run the next item
    // against a stale living copy of it.
    const queue = createMechanicQueue();
    const ran: string[] = [];

    queue.register({
      id: "killer",
      phase: "OnBattleStart",
      sourceInstanceId: "u1",
      mechanicId: "m",
      action: async () => {
        ran.push("killer");
        return teamsOf([unit("u1", 0)]);
      },
    });
    queue.register({
      id: "after",
      phase: "OnBattleStart",
      sourceInstanceId: "u1",
      mechanicId: "m",
      action: async (_s, teams) => {
        ran.push("after");
        return teams;
      },
    });

    await queue.process("OnBattleStart", teamsOf([unit("u1", 100)]), () => {});
    expect(ran).toEqual(["killer"]);
  });
});

describe("logging and pacing", () => {
  it("names the unit and the mechanic before running it", async () => {
    const queue = createMechanicQueue();
    const lines: string[] = [];
    const a = spyItem({
      id: "p1",
      sourceInstanceId: "u1",
      mechanicId: "fullCounter",
    });
    queue.register(a.item);

    await queue.process(
      "OnBattleStart",
      teamsOf([unit("u1", 100, "Meliodas")]),
      (entry) => lines.push(entry),
    );
    expect(lines).toEqual([
      "Evaluating mechanics for Meliodas [fullCounter]",
    ]);
  });

  it("does not pause by default", async () => {
    // The reason the delay is a parameter: a simulator running ten thousand
    // fights must not sleep 800ms an item. A non-zero default would make
    // `npm run sim` unusable without anyone noticing why.
    vi.useFakeTimers();
    try {
      const queue = createMechanicQueue();
      const a = spyItem({ id: "p1", sourceInstanceId: "u1" });
      queue.register(a.item);

      // With no timers advanced, a queue that slept would never settle.
      await queue.process("OnBattleStart", teamsOf([unit("u1")]), () => {});
      expect(a.calls).toEqual(["p1"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
