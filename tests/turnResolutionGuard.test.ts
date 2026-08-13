import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "@/store/gameStore";

/**
 * Open Issue #24 — the engine's string log double-printed actions.
 *
 * Turn 14 of the 2026-08-13 run logged seven Lyra actions against a 3-action
 * cap, and the same report claimed **16 player turns in a 15-turn battle**.
 * The action queue was being resolved more than once.
 *
 * The old guard was `resolvingRef`, a React ref — per component INSTANCE.
 * BattleProvider is explicitly built to survive a remount (page reload, dev
 * HMR), and a remount handed the new instance a fresh `false` while the old
 * instance's `runPlayerActions` loop was still awaiting playback and still saw
 * `battlePhase === "PlayerAction"` in the shared store. Both loops resolved
 * the same queue.
 *
 * The claim now lives in the store, where a remount cannot reset it, and is
 * keyed by turn so a repeat is refused even after the first run finished.
 */

beforeEach(() => {
  useGameStore.getState().resetBattle();
});

describe("turn resolution claims", () => {
  it("lets exactly one caller in", () => {
    const { claimResolution } = useGameStore.getState();
    expect(claimResolution("player:3")).toBe(true);
    expect(claimResolution("player:3")).toBe(false);
  });

  it("refuses a SECOND resolver even under a different key — one at a time", () => {
    const { claimResolution } = useGameStore.getState();
    expect(claimResolution("player:3")).toBe(true);
    // A remounted provider computing its own key must not slip past the lock.
    expect(claimResolution("enemy:3")).toBe(false);
  });

  it("refuses a repeat of a finished turn — a duplicate is not a retry", () => {
    const store = useGameStore.getState();
    expect(store.claimResolution("player:3")).toBe(true);
    store.releaseResolution("player:3");
    expect(useGameStore.getState().activeResolution).toBeNull();
    expect(useGameStore.getState().claimResolution("player:3")).toBe(false);
  });

  it("still allows the next turn", () => {
    const store = useGameStore.getState();
    store.claimResolution("player:3");
    store.releaseResolution("player:3");
    expect(useGameStore.getState().claimResolution("player:4")).toBe(true);
  });

  it("ignores a release from a caller that does not hold the claim", () => {
    const store = useGameStore.getState();
    store.claimResolution("player:3");
    // A zombie loop unwinding must not free the live resolver's lock.
    store.releaseResolution("player:2");
    expect(useGameStore.getState().activeResolution).toBe("player:3");
    expect(useGameStore.getState().finishedResolutions).not.toContain(
      "player:2",
    );
  });

  it("clears with the battle so the next fight starts unlocked", () => {
    const store = useGameStore.getState();
    store.claimResolution("player:3");
    store.releaseResolution("player:3");
    useGameStore.getState().resetBattle();

    expect(useGameStore.getState().activeResolution).toBeNull();
    expect(useGameStore.getState().finishedResolutions).toEqual([]);
    expect(useGameStore.getState().claimResolution("player:3")).toBe(true);
  });

  it("is not persisted — a reload has no live loop, so it must not stay locked", async () => {
    // If the lock survived into sessionStorage, a tab reloaded mid-resolution
    // would come back with a claim no one holds and never resolve again.
    const mod = await import("@/store/gameStore");
    const store = mod.useGameStore as unknown as {
      persist: {
        getOptions: () => {
          partialize: (s: unknown) => Record<string, unknown>;
        };
      };
    };
    const persisted = Object.keys(
      store.persist.getOptions().partialize(useGameStore.getState()),
    );
    expect(persisted).not.toContain("activeResolution");
    expect(persisted).not.toContain("finishedResolutions");
  });
});
