"use client";

import React from "react";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * Dev-only "Use Claude" switch, sat in TopNav beside the audio control.
 *
 * One placement covers practice, story and the world boss, because every
 * battle runs through the same enemy-turn resolution — there's nothing to add
 * to the three start screens. Renders nothing outside development, so it can
 * never reach a player.
 */
export default function DuelToggle(): React.JSX.Element | null {
  const setDuelMode = useSettingsStore((s) => s.setDuelMode);

  // localStorage is an external store, so it's read via useSyncExternalStore
  // rather than effect+setState: the server snapshot is always `false` (there
  // is no persisted value there), which avoids a hydration mismatch without a
  // mount flag. Same pattern HomeMenu uses for its unread badge.
  const duelMode = React.useSyncExternalStore(
    useSettingsStore.subscribe,
    () => useSettingsStore.getState().duelMode,
    () => false,
  );

  if (process.env.NODE_ENV === "production") return null;

  return (
    <button
      type="button"
      onClick={() => setDuelMode(!duelMode)}
      title={
        duelMode
          ? "Claude is playing the enemy side — click to go back to the scripted AI"
          : "Dev: let Claude play the enemy side of the next battle"
      }
      aria-pressed={duelMode}
      className={`flex min-h-11 shrink-0 items-center border px-2 font-body text-[10px] uppercase tracking-[0.14em] transition-colors ${
        duelMode
          ? "border-violet-400 text-violet-200"
          : "border-hairline text-readout-muted hover:text-readout-dim"
      }`}
    >
      {duelMode ? "Claude ON" : "Claude"}
    </button>
  );
}
