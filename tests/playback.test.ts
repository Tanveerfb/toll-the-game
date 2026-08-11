import { afterEach, describe, expect, it } from "vitest";
import { useGameStore } from "@/store/gameStore";
import {
  isPlaybackCaughtUp,
  isPlaybackSkipped,
  resetPlayback,
  skipPlayback,
  waitForPlayback,
} from "@/lib/game/playback";
import type { SequencedBattleEvent } from "@/store/gameStore";

/**
 * The gate that stops the engine running ahead of the animation.
 *
 * A turn used to resolve end-to-end and commit once, so the player saw the
 * outcome before the actions played (Tanveer, 2026-08-11). These cases pin the
 * two properties that matter: a resolver waits when there is something left to
 * animate, and it can NEVER wait forever — a hung gate is a frozen battle.
 */

/** The gate only reads `.length`, so a placeholder is enough. */
const ev = (n: number): SequencedBattleEvent[] =>
  Array.from({ length: n }) as SequencedBattleEvent[];

function setPlayback(playedEvents: number, events: number, mounted: boolean) {
  useGameStore.setState({
    playedEvents,
    battleEvents: ev(events),
    playbackMounted: mounted,
  });
}

/** Has it resolved yet? Flushes the microtask queue rather than racing a
 *  second promise — a `.then()` hop costs a tick, so the racer always won. */
async function settled(promise: Promise<void>): Promise<boolean> {
  let done = false;
  void promise.then(() => {
    done = true;
  });
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
  return done;
}

afterEach(() => {
  resetPlayback();
  setPlayback(0, 0, false);
});

describe("isPlaybackCaughtUp", () => {
  it("is caught up when every emitted event has played", () => {
    expect(isPlaybackCaughtUp({ playedEvents: 3, battleEvents: ev(3) })).toBe(true);
  });

  it("is not caught up while events are outstanding", () => {
    expect(isPlaybackCaughtUp({ playedEvents: 1, battleEvents: ev(3) })).toBe(false);
  });

  it("treats a turn that emitted nothing as already played", () => {
    // A pass plays no card and emits no event — the resolver must not stall
    // waiting for an animation that will never happen.
    expect(isPlaybackCaughtUp({ playedEvents: 0, battleEvents: ev(0) })).toBe(true);
  });
});

describe("waitForPlayback", () => {
  it("resolves immediately when no sequencer is mounted", async () => {
    // Tests, the duel watcher and any other headless caller drive battles with
    // no arena on screen. If this ever blocked, those would hang outright.
    setPlayback(0, 5, false);
    expect(await settled(waitForPlayback())).toBe(true);
  });

  it("resolves immediately when there is nothing left to animate", async () => {
    setPlayback(4, 4, true);
    expect(await settled(waitForPlayback())).toBe(true);
  });

  it("waits while events are outstanding, then resolves as they play", async () => {
    setPlayback(0, 2, true);
    const pending = waitForPlayback();
    expect(await settled(pending)).toBe(false);

    // One of two played — still animating.
    useGameStore.setState({ playedEvents: 1 });
    expect(await settled(pending)).toBe(false);

    useGameStore.setState({ playedEvents: 2 });
    await expect(pending).resolves.toBeUndefined();
  });

  it("releases the wait when the arena unmounts mid-animation", async () => {
    // Route change or battle exit during playback: nothing will ever advance
    // the counter, so the flag going false has to be an exit condition too.
    setPlayback(0, 2, true);
    const pending = waitForPlayback();
    expect(await settled(pending)).toBe(false);

    useGameStore.setState({ playbackMounted: false });
    await expect(pending).resolves.toBeUndefined();
  });

  it("collapses an in-flight wait when playback is skipped", async () => {
    setPlayback(0, 3, true);
    const pending = waitForPlayback();
    expect(await settled(pending)).toBe(false);

    skipPlayback();
    // The store still has to change for the subscription to re-evaluate, which
    // is what the sequencer's skip() does when it snaps the counters forward.
    useGameStore.setState({ playedEvents: 3 });
    await expect(pending).resolves.toBeUndefined();
  });

  it("skips every later wait in the same turn, not just the current one", async () => {
    // Skip means "stop animating this turn". The resolver has actions still to
    // execute and each would otherwise wait for playback that isn't coming.
    setPlayback(0, 3, true);
    skipPlayback();
    expect(await settled(waitForPlayback())).toBe(true);
    expect(await settled(waitForPlayback())).toBe(true);
  });

  it("stops skipping once the next turn resets the gate", async () => {
    skipPlayback();
    expect(isPlaybackSkipped()).toBe(true);
    resetPlayback();
    expect(isPlaybackSkipped()).toBe(false);

    setPlayback(0, 1, true);
    expect(await settled(waitForPlayback())).toBe(false);
  });
});
