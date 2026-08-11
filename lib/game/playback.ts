import { useGameStore } from "@/store/gameStore";

/**
 * The gate between the engine resolving an action and the player seeing it.
 *
 * A turn used to resolve end-to-end in one synchronous loop and commit once,
 * so the store held end-of-turn truth while the sequencer replayed the whole
 * turn from the start — a glimpse of the future leaked every turn (Tanveer,
 * 2026-08-11). `useBattleSequencer` papered over the HP half of it by seeding
 * pre-action values in a layout effect, but buffs, ult gauges, the hand, the
 * team dots and the boss phase-break banner all still jumped ahead.
 *
 * Now each action commits on its own and the resolver awaits playback here
 * before executing the next one, so store truth never runs ahead of what's
 * on screen by more than the action currently animating.
 *
 * The gate is keyed on **counts, not on a live "is it playing" flag**: the
 * sequencer only starts on a layout effect *after* the commit, so a resolver
 * asking "are you busy?" immediately after committing would always be told
 * "no" and race straight past. `playedEvents >= battleEvents.length` has no
 * such window — an action that emits no events at all is trivially already
 * played, which is exactly right for a pass.
 */

/** Ceiling on any single wait. A sequencer bug, a mid-animation unmount or a
 *  dropped event must never freeze a battle permanently — past this the
 *  resolver simply carries on and the fight stays playable. */
export const PLAYBACK_TIMEOUT_MS = 12_000;

/** Set by `skipPlayback` until the next `resetPlayback`. While true every
 *  wait resolves immediately, which is what makes Skip collapse the *rest*
 *  of the turn rather than just the event currently on screen. */
let skipped = false;

/** Skip pressed — drop the remaining waits for this turn. */
export function skipPlayback(): void {
  skipped = true;
}

/** New battle, or a fresh turn after a skip. */
export function resetPlayback(): void {
  skipped = false;
}

export function isPlaybackSkipped(): boolean {
  return skipped;
}

/** True when nothing is left to animate — every emitted event has played. */
export function isPlaybackCaughtUp(state: {
  playedEvents: number;
  battleEvents: unknown[];
}): boolean {
  return state.playedEvents >= state.battleEvents.length;
}

/**
 * Resolve once the sequencer has finished animating everything emitted so far.
 *
 * Resolves immediately when playback was skipped, when no sequencer is mounted
 * (tests, the duel watcher, any headless caller — those must never hang), or
 * when there is nothing left to play.
 */
export function waitForPlayback(): Promise<void> {
  const state = useGameStore.getState();
  if (skipped || !state.playbackMounted || isPlaybackCaughtUp(state)) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve();
    };

    // Bare `setTimeout`, not `window.setTimeout`: this module is reached from
    // tests and headless callers where there is no `window`.
    const timer = setTimeout(finish, PLAYBACK_TIMEOUT_MS);
    const unsubscribe = useGameStore.subscribe((next) => {
      // Unmounting the arena mid-turn (route change, battle exit) has to
      // release the wait too, or the resolver sits here until the timeout.
      if (skipped || !next.playbackMounted || isPlaybackCaughtUp(next)) {
        finish();
      }
    });
  });
}
