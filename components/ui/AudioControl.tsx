"use client";

import React from "react";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * Mute, in the nav. One tap, no popover.
 *
 * It used to be a popover carrying the volume slider too. That moved to
 * `/profile` on 2026-09-01 (Tanveer) — the nav had no width to spare at 390px
 * once navigation went to a bottom tab bar (ruling #123), and volume is a
 * set-once preference rather than something you reach for mid-fight.
 *
 * **Mute deliberately did not go with it.** `/profile` redirects a signed-out
 * visitor to `/login`, and guest mode is a supported way to play, so a control
 * living only there is a control a guest does not have. Silencing the game is
 * the one audio action that is urgent — someone in a quiet room, or a track
 * starting on the autoplay gate's first interaction — so it stays reachable
 * from every screen and volume does not have to be.
 *
 * The trigger must stay inside the nav's fixed-height top row: screens size
 * themselves to `100dvh - var(--nav-h)` (`.screen-below-nav`), and that
 * variable is declared from the nav's own rendered row count.
 */
export default function AudioControl(): React.JSX.Element {
  const volume = useSettingsStore((s) => s.musicVolume);
  const muted = useSettingsStore((s) => s.musicMuted);
  const setMuted = useSettingsStore((s) => s.setMusicMuted);

  // Volume at zero is silence by another route, so the icon reports the
  // audible state rather than the flag. Toggling still only touches `muted` —
  // unmuting must not silently rewrite a volume the player chose.
  const silent = muted || volume === 0;

  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-pressed={muted}
      aria-label={muted ? "Unmute music" : "Mute music"}
      // Migrated to the Combat Terminal tokens 2026-08-13. `signal` is the
      // correct accent here and amber was not: this is nav chrome, and the
      // palette reserves cyan for exactly that (element hues belong to units).
      className={`flex h-11 w-11 shrink-0 items-center justify-center border text-base transition-colors ${
        silent
          ? "border-hairline text-readout-muted hover:text-readout-dim"
          : "border-edge text-signal hover:border-signal"
      }`}
    >
      {silent ? "♪̸" : "♪"}
    </button>
  );
}
