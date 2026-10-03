"use client";

import { useSyncExternalStore } from "react";

/** Re-reading every 30s keeps a regenerating bar honest without a per-second
 *  timer nobody is watching. */
export const NOW_TICK_MS = 30_000;

function subscribe(onStoreChange: () => void): () => void {
  const id = setInterval(onStoreChange, NOW_TICK_MS);
  return () => clearInterval(id);
}

/** Floored to the tick window so repeated snapshot reads return an identical
 *  value (a requirement of `useSyncExternalStore`). */
function getSnapshot(): number {
  return Math.floor(Date.now() / NOW_TICK_MS) * NOW_TICK_MS;
}

/** `0` on the server, so a client-only branch stays hydration-safe. */
function getServerSnapshot(): number {
  return 0;
}

/**
 * The current time, ticking every 30 seconds. `0` until the client has
 * mounted, so callers gate on `now !== 0` before showing anything derived
 * from it.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
