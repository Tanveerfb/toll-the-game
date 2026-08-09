"use client";

import React from "react";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * Music volume + mute, as a TopNav popover.
 *
 * Lives in the nav rather than on `/profile` because that page redirects
 * guests to `/login`, and guest mode is a supported way to play — a global
 * setting can't sit behind an account. The trigger must stay inside the nav's
 * fixed `h-11`: the battle shell sizes itself to `100dvh - 2.875rem` against
 * that height.
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
        className={`flex h-7 w-7 items-center justify-center border text-xs transition-colors ${
          silent
            ? "border-zinc-800 text-zinc-600 hover:text-zinc-400"
            : "border-zinc-700 text-amber-200 hover:border-amber-300"
        }`}
      >
        {silent ? "♪̸" : "♪"}
      </button>

      {open ? (
        <div className="absolute right-0 top-9 z-50 w-56 border-2 border-zinc-700 bg-zinc-950/95 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <p className="font-heading text-xs tracking-[0.16em] text-zinc-300">
              MUSIC
            </p>
            <button
              type="button"
              onClick={() => setMuted(!muted)}
              className={`border px-2 py-0.5 font-body text-[10px] uppercase tracking-[0.14em] transition-colors ${
                muted
                  ? "border-amber-300 text-amber-200"
                  : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {muted ? "Muted" : "Mute"}
            </button>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(event) => setVolume(Number(event.target.value) / 100)}
            aria-label="Music volume"
            className="mt-3 h-1 w-full appearance-none bg-zinc-800 accent-amber-300 disabled:opacity-40"
            disabled={muted}
          />
          <p className="mt-2 font-body text-[10px] uppercase tracking-[0.14em] text-zinc-600">
            {Math.round(volume * 100)}%
          </p>
        </div>
      ) : null}
    </div>
  );
}
