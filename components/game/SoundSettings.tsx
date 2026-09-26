"use client";

import React from "react";
import { Slider } from "@/components/ui/slider";
import { panelVariants } from "@/components/ui/Panel";
import { Toggle } from "@/components/ui/toggle";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * Music volume, on `/profile`.
 *
 * Split out of the nav's `AudioControl` on 2026-09-01 (Tanveer): once
 * navigation moved to a bottom tab bar (ruling #123) the top row had no width
 * left for a popover, and volume is a preference you set once rather than
 * something you reach for mid-fight.
 *
 * Mute stayed in the nav on purpose — see `AudioControl` for why. That makes
 * the mute state readable from two places, so this panel shows it rather than
 * pretending the slider is the whole story: a player who muted from the nav
 * and then came here to raise the volume would otherwise drag a control that
 * changes nothing audible.
 */
export default function SoundSettings(): React.JSX.Element {
  const volume = useSettingsStore((s) => s.musicVolume);
  const setVolume = useSettingsStore((s) => s.setMusicVolume);
  const muted = useSettingsStore((s) => s.musicMuted);
  const setMuted = useSettingsStore((s) => s.setMusicMuted);

  return (
    <section className={panelVariants({ surface: "paper", density: "roomy" })}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg tracking-title">Sound</h2>
          <p className="font-body text-caption text-muted-foreground">
            Mute is in the top bar on every screen.
          </p>
        </div>
        <Toggle
          variant="outline"
          size="sm"
          pressed={muted}
          onPressedChange={setMuted}
          className="shrink-0"
        >
          {muted ? "Muted" : "Mute"}
        </Toggle>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="shrink-0 font-body text-label font-bold uppercase tracking-label text-muted-foreground">
          Music
        </span>
        {/* The `Slider` primitive rather than a bare range input: that was an
            `h-1` band — a 4px target — until 2026-08-21, and the primitive
            carries the 44px grab area (ruling #119). */}
        <Slider
          className="flex-1"
          min={0}
          max={100}
          value={[Math.round(volume * 100)]}
          onValueChange={([next]) => setVolume(next / 100)}
          aria-label="Music volume"
          disabled={muted}
        />
        <span className="w-10 shrink-0 text-right font-body text-caption font-bold tabular-nums">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </section>
  );
}
