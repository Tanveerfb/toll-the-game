"use client";

import React from "react";
import { getMusicController } from "@/lib/audio/music";
import type { MusicRole } from "@/lib/audio/tracks";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * Requests a music role for as long as the calling component is mounted.
 *
 * Requesting the role that is already playing is a no-op inside the
 * controller, so navigating part select → chapter list → brief keeps one
 * continuous story theme instead of restarting it three times. Passing `null`
 * fades out.
 *
 * Deliberately not a provider: music has no reason to re-render a tree, and
 * the root layout already carries AuthProvider.
 */
export function useScreenMusic(role: MusicRole | null): void {
  const volume = useSettingsStore((s) => s.musicVolume);
  const muted = useSettingsStore((s) => s.musicMuted);

  React.useEffect(() => {
    const controller = getMusicController();
    if (!controller) return;
    controller.setSettings({ volume, muted });
  }, [volume, muted]);

  React.useEffect(() => {
    const controller = getMusicController();
    if (!controller) return;
    controller.play(role);
  }, [role]);
}
