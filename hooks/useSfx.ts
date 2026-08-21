"use client";

import React from "react";

import { getSfxBus } from "@/lib/audio/sfx";
import type { SfxCue } from "@/lib/audio/cues";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * Fire a sound effect.
 *
 * ```tsx
 * const sfx = useSfx();
 * sfx("critical");
 * ```
 *
 * Volume and mute come from the same settings the music deck reads, so the one
 * slider in the nav governs both. Effects deliberately have no separate
 * control: a second slider is a setting to design, and there is nothing to
 * balance against until the files exist.
 *
 * The returned function is stable across renders as long as the settings are,
 * so it is safe in an effect's dependency list.
 */
export function useSfx(): (cue: SfxCue) => void {
  const volume = useSettingsStore((s) => s.musicVolume);
  const muted = useSettingsStore((s) => s.musicMuted);

  return React.useCallback(
    (cue: SfxCue) => {
      getSfxBus().play(cue, { volume, muted });
    },
    [volume, muted],
  );
}
