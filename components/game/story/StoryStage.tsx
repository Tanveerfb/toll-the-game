"use client";

import React from "react";

import StoryBackdrop from "@/components/game/story/StoryBackdrop";
import { Screen } from "@/components/ui/Screen";

/**
 * The one frame every story view renders inside.
 *
 * Replaces the three near-identical `<main>` shells `app/story/page.tsx` used
 * to inline per view: a viewport-locked one for the cinematic beats, a
 * scrolling one for the document screens, and rewards in a third shape of its
 * own. That third shape is why clearing a chapter changed viewport treatment
 * halfway through the completion beat — the complete card was locked below the
 * nav and the rewards card underneath it was free to scroll.
 *
 * `grid` draws the fine 36px lattice over the base `terminal-grid` texture. It
 * stays on exactly where it already was — the battle and the scene reader —
 * because the interstitials read cleaner without it.
 */
export default function StoryStage({
  variant,
  grid = false,
  backgroundId,
  dimBackground = false,
  children,
}: {
  /** `stage` locks to the viewport below the nav: the cinematic beats and the
   *  battle, which are moments rather than documents. `page` scrolls — the
   *  index and the brief, which are documents and can outgrow a screen. */
  variant: "stage" | "page";
  grid?: boolean;
  /**
   * Where this screen happens — `stageBackgroundId()` derives it from the
   * stage. Set it and the screen plays over the scene plate instead of the bare
   * grid; leave it off and nothing changes.
   *
   * On a `page` the backdrop is `fixed` rather than `absolute`, because a
   * document scrolls and a place does not: an absolute plate would scroll off
   * the top and leave the lower half of a long brief on plain void.
   */
  backgroundId?: string;
  /** For a screen that is mostly text over the plate rather than a picture with
   *  text on it — same reason `StorySceneReader` dims a narration beat. */
  dimBackground?: boolean;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    // This component was the PRECEDENT `Screen` was generalised from, and kept
    // its own copy of both shells afterwards — which is the drift `Screen`
    // exists to stop, in the one file that proved the idea. It delegates now.
    //
    // `stage` is `fixed` (exact height, no page scroll, the backdrop absolutely
    // positioned inside it) and `page` is `scroll`. Both take `width="none"`
    // because the children here own their own column.
    //
    // The reasoning that used to sit inline still holds and now lives in
    // `Screen`: not `min-h-screen` (`100vh` in Tailwind 4 is the *largest*
    // viewport) and not `min-h-dvh` either — this `<main>` starts below the nav
    // and `body` pads for the tab bar, so a full-viewport floor overshoots by
    // both. `.min-screen-below-nav` subtracts them.
    <Screen
      variant={variant === "stage" ? "fixed" : "scroll"}
      width="none"
      className="relative"
    >
      {backgroundId ? (
        <div
          aria-hidden
          className={
            variant === "page"
              ? "pointer-events-none fixed inset-0"
              : "pointer-events-none absolute inset-0"
          }
        >
          <StoryBackdrop slug={backgroundId} dim={dimBackground} />
        </div>
      ) : null}
      {grid ? (
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-size-[36px_36px]" />
      ) : null}
      {/* Above the plate — and only when there is one. A screen with no
          backdrop keeps the layout it had, so this prop can be adopted one
          screen at a time without re-testing the ones that don't use it. */}
      {backgroundId ? (
        <div
          className={
            variant === "page"
              ? "relative"
              : "relative flex min-h-0 flex-1 flex-col"
          }
        >
          {children}
        </div>
      ) : (
        children
      )}
    </Screen>
  );
}
