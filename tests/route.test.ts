import { describe, expect, it } from "vitest";
import {
  bossNode,
  buildRoute,
  canLand,
  isStop,
  landingsFrom,
  nodeById,
  ORB_COUNT,
  ORB_MAX,
  ORB_MIN,
  rollLoot,
  rollOrb,
  rollOrbs,
  routeFor,
  routeProblems,
  routeStepsForPart,
  spendOrb,
  terminalNode,
  walkPath,
  type StoryRoute,
} from "@/lib/game/route";
import { getStoryParts } from "@/lib/game/storyCatalog";

/**
 * The movement rules are Tanveer's (2026-08-17): three orbs, each an independent
 * 1–6, spending one re-rolls only that orb, only the tile you land on resolves —
 * and **a STOP tile can never be skipped**, which is what stops a big roll
 * carrying a player past the boss and onto the payout.
 */

/** A short single path, boss gating the finish, as the generator builds them. */
const PATH: StoryRoute = {
  nodes: [
    { id: "n0", type: "start", col: 0, row: 0 },
    { id: "n1", type: "scene", col: 1, row: 1, scenes: "intro" },
    { id: "n2", type: "empty", col: 2, row: 2 },
    { id: "n3", type: "loot", col: 1, row: 3, loot: { coin: { min: 10, max: 10 } } },
    { id: "n4", type: "empty", col: 0, row: 4 },
    { id: "n5", type: "boss", col: 1, row: 5 },
    { id: "n6", type: "finish", col: 1, row: 6 },
  ],
  edges: {
    n0: ["n1"],
    n1: ["n2"],
    n2: ["n3"],
    n3: ["n4"],
    n4: ["n5"],
    n5: ["n6"],
    n6: [],
  },
};

describe("orbs", () => {
  it("rolls inside 1–6, and reaches both bounds", () => {
    let low = false;
    let high = false;
    for (let i = 0; i < 400; i += 1) {
      const value = rollOrb();
      expect(value).toBeGreaterThanOrEqual(ORB_MIN);
      expect(value).toBeLessThanOrEqual(ORB_MAX);
      if (value === ORB_MIN) low = true;
      if (value === ORB_MAX) high = true;
    }
    expect(low && high).toBe(true);
  });

  it("hands out three", () => {
    expect(rollOrbs()).toHaveLength(ORB_COUNT);
  });

  it("is never the fixed 1-2-3 spread he overruled", () => {
    const deals = Array.from({ length: 50 }, () => rollOrbs().join(","));
    expect(deals.some((deal) => deal !== "1,2,3")).toBe(true);
  });

  it("re-rolls only the orb that was spent", () => {
    const after = spendOrb([2, 4, 6], 1, () => 0);
    expect(after[0]).toBe(2);
    expect(after[2]).toBe(6);
    expect(after[1]).toBe(ORB_MIN);
  });

  it("never mutates the hand it was given", () => {
    const orbs = [3, 3, 3];
    spendOrb(orbs, 0, () => 0.99);
    expect(orbs).toEqual([3, 3, 3]);
  });

  it("ignores an out-of-range index", () => {
    expect(spendOrb([1, 2, 3], 7)).toEqual([1, 2, 3]);
    expect(spendOrb([1, 2, 3], -1)).toEqual([1, 2, 3]);
  });
});

describe("landingsFrom", () => {
  it("lands exactly where the roll ends", () => {
    expect(landingsFrom(PATH, "n0", 1)).toEqual(["n1"]);
    expect(landingsFrom(PATH, "n0", 3)).toEqual(["n3"]);
  });

  it("passes over tiles without resolving them", () => {
    // A 3 from the start skips the scene and the empty tile entirely.
    expect(landingsFrom(PATH, "n0", 3)).not.toContain("n1");
    expect(landingsFrom(PATH, "n0", 3)).not.toContain("n2");
  });

  it("cannot skip the boss, whatever the roll", () => {
    // From n4 the boss is one step away; every roll from 1 to 6 must land it.
    for (let roll = ORB_MIN; roll <= ORB_MAX; roll += 1) {
      expect(landingsFrom(PATH, "n4", roll)).toEqual(["n5"]);
    }
    // And from further back, a roll that would overshoot still stops on it.
    expect(landingsFrom(PATH, "n3", 6)).toEqual(["n5"]);
    expect(landingsFrom(PATH, "n0", 6)).toEqual(["n5"]);
  });

  it("never reaches the finish without the boss in between", () => {
    for (let roll = ORB_MIN; roll <= ORB_MAX; roll += 1) {
      expect(landingsFrom(PATH, "n0", roll)).not.toContain("n6");
    }
  });

  it("moves onto the finish once the boss is behind you", () => {
    for (let roll = ORB_MIN; roll <= ORB_MAX; roll += 1) {
      expect(landingsFrom(PATH, "n5", roll)).toEqual(["n6"]);
    }
  });

  it("has nowhere to go from the finish", () => {
    expect(landingsFrom(PATH, "n6", 3)).toEqual([]);
  });

  it("treats a zero or negative roll as no move", () => {
    expect(landingsFrom(PATH, "n0", 0)).toEqual([]);
    expect(landingsFrom(PATH, "n0", -2)).toEqual([]);
  });

  it("agrees with canLand", () => {
    expect(canLand(PATH, "n0", 3, "n3")).toBe(true);
    expect(canLand(PATH, "n0", 3, "n4")).toBe(false);
    expect(canLand(PATH, "n0", 6, "n5")).toBe(true);
  });

  it("reports a rejoining fork's tile once, not once per path", () => {
    // Forks aren't authored yet, but the walk supports them and a diamond is the
    // shape that would double-count under a naive implementation.
    const diamond: StoryRoute = {
      nodes: [
        { id: "s", type: "start", col: 0, row: 0 },
        { id: "l", type: "empty", col: 0, row: 1 },
        { id: "r", type: "empty", col: 2, row: 1 },
        { id: "j", type: "empty", col: 1, row: 2 },
        { id: "b", type: "boss", col: 1, row: 3 },
        { id: "f", type: "finish", col: 1, row: 4 },
      ],
      edges: { s: ["l", "r"], l: ["j"], r: ["j"], j: ["b"], b: ["f"], f: [] },
    };
    expect(landingsFrom(diamond, "s", 2)).toEqual(["j"]);
    expect(landingsFrom(diamond, "s", 1).sort()).toEqual(["l", "r"]);
  });
});

describe("walkPath", () => {
  it("returns every tile stepped onto, in order", () => {
    expect(walkPath(PATH, "n0", 3)).toEqual(["n1", "n2", "n3"]);
  });

  it("excludes the tile you started on", () => {
    expect(walkPath(PATH, "n0", 1)).toEqual(["n1"]);
  });

  it("stops walking at the boss, so the animation can't run past it", () => {
    expect(walkPath(PATH, "n3", 6)).toEqual(["n4", "n5"]);
  });

  it("ends on the same tile landingsFrom reports", () => {
    for (let roll = ORB_MIN; roll <= ORB_MAX; roll += 1) {
      for (const from of ["n0", "n1", "n2", "n3", "n4"]) {
        const path = walkPath(PATH, from, roll);
        const landing = landingsFrom(PATH, from, roll);
        expect(path[path.length - 1]).toBe(landing[0]);
      }
    }
  });

  it("has nowhere to walk from the finish", () => {
    expect(walkPath(PATH, "n6", 4)).toEqual([]);
  });
});

describe("isStop", () => {
  it("covers the boss and the finish, and nothing else", () => {
    expect(isStop(nodeById(PATH, "n5")!)).toBe(true);
    expect(isStop(nodeById(PATH, "n6")!)).toBe(true);
    for (const id of ["n0", "n1", "n2", "n3", "n4"]) {
      expect(isStop(nodeById(PATH, id)!)).toBe(false);
    }
  });
});

describe("route lengths", () => {
  it("uses his per-part numbers", () => {
    expect(routeStepsForPart(1)).toBe(10);
    expect(routeStepsForPart(2)).toBe(5);
    expect(routeStepsForPart(3)).toBe(20);
    expect(routeStepsForPart(4)).toBe(15);
  });

  it("falls back for parts he hasn't ruled on", () => {
    expect(routeStepsForPart(9)).toBe(10);
    expect(routeStepsForPart(12)).toBe(10);
  });
});

describe("buildRoute", () => {
  const parts = getStoryParts();

  it("builds a walkable board for every authored chapter", () => {
    for (const part of parts) {
      for (const chapter of part.chapters) {
        const route = routeFor(chapter, part.order);
        expect(routeProblems(route)).toEqual([]);
      }
    }
  });

  it("can always be walked start to finish with legal rolls", () => {
    for (const part of parts) {
      for (const chapter of part.chapters) {
        const route = routeFor(chapter, part.order);
        let at = "n0";
        const finish = terminalNode(route)!.id;
        // Worst case is a roll of 1 every step, so the board's own length bounds
        // the walk; anything longer means a tile with no way onward.
        let guard = route.nodes.length + 4;
        while (at !== finish && guard > 0) {
          const next = landingsFrom(route, at, 1);
          expect(next.length).toBeGreaterThan(0);
          at = next[0];
          guard -= 1;
        }
        expect(at).toBe(finish);
      }
    }
  });

  it("puts the boss immediately before the finish", () => {
    for (const part of parts) {
      for (const chapter of part.chapters) {
        const route = routeFor(chapter, part.order);
        const boss = bossNode(route);
        expect(boss).toBeDefined();
        expect(route.edges[boss!.id]).toEqual([terminalNode(route)!.id]);
      }
    }
  });

  it("carries the chapter's enemies onto the boss tile", () => {
    const part = parts[0];
    const chapter = part.chapters.find((c) => c.battle)!;
    const boss = bossNode(buildRoute(chapter, part.order));
    expect(boss?.enemies).toEqual(chapter.battle?.enemyTeam);
  });

  it("keeps exactly one fight per board", () => {
    for (const part of parts) {
      for (const chapter of part.chapters) {
        const route = routeFor(chapter, part.order);
        const fights = route.nodes.filter(
          (node) => node.type === "fight" || node.type === "boss",
        );
        expect(fights).toHaveLength(1);
      }
    }
  });

  it("only uses tile types the board knows how to render", () => {
    const known = new Set(["start", "scene", "loot", "empty", "boss", "finish"]);
    for (const part of parts) {
      for (const chapter of part.chapters) {
        for (const node of routeFor(chapter, part.order).nodes) {
          expect(known.has(node.type)).toBe(true);
        }
      }
    }
  });

  it("keeps the outro off the board — it resolves with the boss, as before", () => {
    for (const part of parts) {
      for (const chapter of part.chapters) {
        const route = routeFor(chapter, part.order);
        expect(
          route.nodes.some((node) => node.scenes === "outro"),
        ).toBe(false);
      }
    }
  });

  it("scales loot with length — one on a short board, two on a long one", () => {
    const short = buildRoute(parts[1].chapters[0], 2); // part 2, five tiles
    const long = buildRoute(parts[2].chapters[0], 3); // part 3, twenty tiles
    const lootCount = (route: StoryRoute) =>
      route.nodes.filter((node) => node.type === "loot").length;
    expect(lootCount(short)).toBeGreaterThanOrEqual(1);
    expect(lootCount(long)).toBeGreaterThan(lootCount(short));
  });

  it("never puts loot on the boss, the finish or the start", () => {
    for (const part of parts) {
      for (const chapter of part.chapters) {
        for (const node of routeFor(chapter, part.order).nodes) {
          if (node.loot) expect(node.type).toBe("loot");
        }
      }
    }
  });

  it("is stable — the same chapter always produces the same board", () => {
    const part = parts[0];
    const once = buildRoute(part.chapters[0], part.order);
    const twice = buildRoute(part.chapters[0], part.order);
    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
  });

  it("differs between chapters of the same length", () => {
    const part = parts[0];
    const shapes = part.chapters.map((chapter) =>
      buildRoute(chapter, part.order)
        .nodes.map((node) => node.type)
        .join(""),
    );
    expect(new Set(shapes).size).toBeGreaterThan(1);
  });

  it("honours an authored route over the generated one", () => {
    const part = parts[0];
    const authored = { ...part.chapters[0], route: PATH };
    expect(routeFor(authored, part.order)).toBe(PATH);
  });
});

describe("rollLoot", () => {
  it("rolls inside the authored band", () => {
    const loot = { coin: { min: 1000, max: 3000 } };
    for (let i = 0; i < 100; i += 1) {
      const rolled = rollLoot(loot);
      expect(rolled.coin).toBeGreaterThanOrEqual(1000);
      expect(rolled.coin).toBeLessThanOrEqual(3000);
    }
  });

  it("drops a zero-rolled material rather than banking +0", () => {
    const rolled = rollLoot(
      { materials: { training_manual: { min: 0, max: 0 } } },
      () => 0,
    );
    expect(rolled.materials).toEqual({});
  });

  it("pays nothing for empty loot", () => {
    expect(rollLoot({})).toEqual({ coin: 0, materials: {} });
  });
});

describe("routeProblems", () => {
  it("passes a well-formed board", () => {
    expect(routeProblems(PATH)).toEqual([]);
  });

  it("catches a board with no finish", () => {
    expect(
      routeProblems({
        nodes: [{ id: "n0", type: "start", col: 0, row: 0 }],
        edges: { n0: [] },
      }).join(" "),
    ).toContain("finish");
  });

  it("catches a finish reachable without the boss", () => {
    const skippable: StoryRoute = {
      ...PATH,
      edges: { ...PATH.edges, n4: ["n5", "n6"] },
    };
    expect(routeProblems(skippable).join(" ")).toContain(
      "reaches the finish without passing the boss",
    );
  });

  it("catches an unreachable tile", () => {
    expect(
      routeProblems({
        ...PATH,
        nodes: [...PATH.nodes, { id: "lost", type: "loot", col: 3, row: 2 }],
      }).join(" "),
    ).toContain('"lost" is unreachable');
  });

  it("catches an edge to a tile that doesn't exist", () => {
    expect(
      routeProblems({ ...PATH, edges: { ...PATH.edges, n2: ["ghost"] } }).join(" "),
    ).toContain('unknown node "ghost"');
  });
});
