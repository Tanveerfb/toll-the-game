"use client";

import React from "react";
import { Slider } from "@/components/ui/slider";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * Music volume + mute, as a TopNav popover.
 *
 * Lives in the nav rather than on `/profile` because that page redirects
 * guests to `/login`, and guest mode is a supported way to play — a global
 * setting can't sit behind an account. The trigger must stay inside the nav's
 * fixed-height top row: screens size themselves to `100dvh - var(--nav-h)`
 * (`.screen-below-nav`), and that variable is declared from the nav's own
 * rendered row count.
 *
 * The slider is a native range input styled with Tailwind — a whole Radix
 * dependency for one control isn't worth it.
 */
export default function AudioControl(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const volume = useSettingsStore((s) => s.musicVolume);
  const setVolume = useSettingsStore((s) => s.setMusicVolume);
  const muted = useSettingsStore((s) => s.musicMuted);
  const setMuted = useSettingsStore((s) => s.setMusicMuted);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const silent = muted || volume === 0;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={silent ? "Music muted" : "Music settings"}
        aria-expanded={open}
        // Migrated to the Combat Terminal tokens 2026-08-13. `signal` is the
        // correct accent here and amber was not: this is nav chrome, and the
        // palette reserves cyan for exactly that (element hues belong to
        // units). It sits in the nav on every screen, so it was the most
        // visible thing still on the old utilities.
        className={`flex h-11 w-11 items-center justify-center border text-base transition-colors ${
          silent
            ? "border-hairline text-readout-muted hover:text-readout-dim"
            : "border-edge text-signal hover:border-signal"
        }`}
      >
        {silent ? "♪̸" : "♪"}
      </button>

      {/* `top-12` clears the trigger, which grew from 28px to 44px on
          2026-08-21. */}
      {open ? (
        <div className="absolute right-0 top-12 z-50 w-56 border border-edge-strong bg-panel/95 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <p className="font-heading text-xs tracking-[0.16em] text-readout-dim">
              MUSIC
            </p>
            <button
              type="button"
              onClick={() => setMuted(!muted)}
              className={`min-h-11 border px-3 font-body text-[10px] uppercase tracking-[0.14em] transition-colors ${
                muted
                  ? "border-signal bg-signal/10 text-signal"
                  : "border-edge text-readout-dim hover:text-readout-strong"
              }`}
            >
              {muted ? "Muted" : "Mute"}
            </button>
          </div>

          {/* Was a bare `<input type="range">` at `h-1` — a 4px band, on the
              one control that ships in the nav of every screen. The `Slider`
              primitive keeps the hairline track and gives it a 44px grab area
              (ruling #107). */}
          <Slider
            className="mt-3"
            min={0}
            max={100}
            value={[Math.round(volume * 100)]}
            onValueChange={([next]) => setVolume(next / 100)}
            aria-label="Music volume"
            disabled={muted}
          />
          <p className="mt-2 font-body text-[10px] uppercase tracking-[0.14em] text-readout-muted">
            {Math.round(volume * 100)}%
          </p>
        </div>
      ) : null}
    </div>
  );
}
