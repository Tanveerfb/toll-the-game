"use client";

import React from "react";
import { Slider } from "@/components/ui/slider";
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
    <section className="border border-edge bg-panel px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg tracking-title text-readout-strong">
            Sound
          </h2>
          <p className="font-body text-[11px] text-readout-muted">
            Mute is in the top bar on every screen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMuted(!muted)}
          aria-pressed={muted}
          className={`min-h-11 shrink-0 border px-3 font-body text-[10px] font-bold uppercase tracking-label transition-colors ${
            muted
              ? "border-signal bg-signal/10 text-signal"
              : "border-edge text-readout-dim hover:text-readout-strong"
          }`}
        >
          {muted ? "Muted" : "Mute"}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="shrink-0 font-body text-[10px] font-bold uppercase tracking-label text-readout-muted">
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
        <span className="w-10 shrink-0 text-right font-body text-[11px] font-semibold tabular-nums text-readout-dim">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </section>
  );
}
