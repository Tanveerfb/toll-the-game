"use client";

import React from "react";
import { useGameStore } from "@/store/gameStore";
import { useSettingsStore } from "@/store/settingsStore";
import { buildDealTimeline } from "@/lib/game/dealTimeline";
import type { ActionCard } from "@/types/action";

/**
 * The hand the player should be looking at right now.
 *
 * `deck` is the settled truth the engine committed. When a draw just happened
 * the store also carries `dealSteps` — the hand after each individual draw and
 * merge — and this walks them so the deal plays out instead of arriving
 * finished. Same shape as the battle sequencer: the store commits, the
 * presentation catches up, and the store is never the thing being animated.
 *
 * The current frame is *derived during render* rather than pushed into state
 * by an effect. An effect that synchronously set the frame would paint the
 * settled hand first and the deal second — the same "glimpse of the future"
 * that turn playback had before it was fixed.
 *
 * Every other way the hand changes (playing a card, a manual merge, Reset
 * Hand) has no steps, renders immediately, and is animated by the hand's own
 * FLIP layer instead.
 */
export function useDealSequence(deck: ActionCard[]): ActionCard[] {
  const dealSteps = useGameStore((s) => s.dealSteps);
  const clearDealSteps = useGameStore((s) => s.clearDealSteps);
  const speed = useSettingsStore((s) => s.battleSpeed);
  const reduced = usePrefersReducedMotion();

  const timeline = React.useMemo(
    () => buildDealTimeline(dealSteps, { speed, reduced }),
    [dealSteps, speed, reduced],
  );

  const [frame, setFrame] = React.useState(0);

  // Rewind when a new deal arrives. Setting state during render of the same
  // component is React's sanctioned way to react to a changed input — it
  // re-runs this render before anything is painted, so no stale frame is ever
  // shown, and unlike an effect it doesn't cost a committed render.
  const [playing, setPlaying] = React.useState(timeline);
  if (timeline !== playing) {
    setPlaying(timeline);
    setFrame(0);
  }

  React.useEffect(() => {
    if (timeline.length === 0) return;
    if (frame >= timeline.length - 1) {
      // Dropping the steps re-renders with an empty timeline, which falls
      // through to `deck` below. The two are already equal by then, so that
      // render is a no-op rather than a visible jump.
      clearDealSteps();
      return;
    }
    const timer = setTimeout(
      () => setFrame((current) => current + 1),
      timeline[frame].holdMs,
    );
    return () => clearTimeout(timer);
  }, [timeline, frame, clearDealSteps]);

  if (timeline.length === 0) return deck;
  return timeline[Math.min(frame, timeline.length - 1)].hand;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * `prefers-reduced-motion`, read as an external store rather than through an
 * effect — the server has no `matchMedia`, and a `false` server snapshot keeps
 * hydration honest.
 */
export function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia(REDUCED_MOTION_QUERY).matches
        : false,
    () => false,
  );
}
