import { beforeEach, describe, expect, it } from "vitest";
import { useStoryStore } from "@/store/storyStore";

/**
 * The walk-in-progress state.
 *
 * It is persisted because a route spans several taps and a phone browser closes
 * tabs between them — without it, a reload would drop the player back at the
 * brief having already paid the stamina. It is deliberately **not** cloud-synced:
 * a half-walked board is local, and merging two devices' positions has no correct
 * answer.
 */
describe("activeRoute", () => {
  beforeEach(() => {
    useStoryStore.setState({ activeRoute: null, completed: {} });
  });

  it("starts a walk standing on the start tile with three orbs", () => {
    useStoryStore.getState().beginRoute("part1", "p1c1", "n0", [4, 1, 6]);
    const route = useStoryStore.getState().activeRoute;
    expect(route?.at).toBe("n0");
    expect(route?.orbs).toEqual([4, 1, 6]);
    expect(route?.resolved).toEqual(["n0"]);
    expect(route?.bankedCoin).toBe(0);
    expect(route?.bankedMaterials).toEqual({});
  });

  it("discards a route already in progress rather than keeping two", () => {
    const store = useStoryStore.getState();
    store.beginRoute("part1", "p1c1", "n0", [1, 1, 1]);
    store.advanceRoute("n3", [2, 2, 2], { coin: 500, materials: {} });
    store.beginRoute("part2", "p2c1", "n0", [3, 3, 3]);
    const route = useStoryStore.getState().activeRoute;
    expect(route?.chapterId).toBe("p2c1");
    expect(route?.at).toBe("n0");
    // The previous walk's loot does not follow the player into the new one.
    expect(route?.bankedCoin).toBe(0);
  });

  it("banks loot as it walks, accumulating across tiles", () => {
    const store = useStoryStore.getState();
    store.beginRoute("part1", "p1c1", "n0", [1, 1, 1]);
    store.advanceRoute("n2", [2, 1, 1], {
      coin: 1200,
      materials: { training_manual: 2 },
    });
    store.advanceRoute("n5", [3, 1, 1], {
      coin: 800,
      materials: { training_manual: 1 },
    });
    const route = useStoryStore.getState().activeRoute;
    expect(route?.bankedCoin).toBe(2000);
    expect(route?.bankedMaterials).toEqual({ training_manual: 3 });
    expect(route?.at).toBe("n5");
  });

  it("records every tile it lands on, once", () => {
    const store = useStoryStore.getState();
    store.beginRoute("part1", "p1c1", "n0", [1, 1, 1]);
    store.advanceRoute("n1", [1, 1, 1]);
    store.advanceRoute("n1", [1, 1, 1]);
    expect(useStoryStore.getState().activeRoute?.resolved).toEqual(["n0", "n1"]);
  });

  it("moves without loot when a tile pays nothing", () => {
    const store = useStoryStore.getState();
    store.beginRoute("part1", "p1c1", "n0", [1, 1, 1]);
    store.advanceRoute("n1", [5, 5, 5]);
    const route = useStoryStore.getState().activeRoute;
    expect(route?.bankedCoin).toBe(0);
    expect(route?.orbs).toEqual([5, 5, 5]);
  });

  it("ignores an advance when no route is being walked", () => {
    useStoryStore.getState().advanceRoute("n4", [1, 2, 3]);
    expect(useStoryStore.getState().activeRoute).toBeNull();
  });

  it("clears the walk — a wipe, a quit, or a payout", () => {
    const store = useStoryStore.getState();
    store.beginRoute("part1", "p1c1", "n0", [1, 1, 1]);
    store.clearRoute();
    expect(useStoryStore.getState().activeRoute).toBeNull();
  });

  it("leaves cleared-chapter progress alone", () => {
    const store = useStoryStore.getState();
    store.markChapterComplete("part1", "p1c1");
    store.beginRoute("part1", "p1c2", "n0", [1, 1, 1]);
    store.clearRoute();
    expect(useStoryStore.getState().completed["part1:p1c1"]).toBe(true);
  });
});
