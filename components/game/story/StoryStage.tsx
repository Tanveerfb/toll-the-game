"use client";

import React from "react";

import StoryBackdrop from "@/components/game/story/StoryBackdrop";

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
    <main
      className={
        variant === "stage"
          ? "terminal-grid relative flex screen-below-nav flex-col overflow-hidden bg-void text-readout"
          : // `min-h-screen` is `100vh` in Tailwind 4 — the *largest* viewport.
            // With mobile browser chrome showing that is taller than what you
            // can see, so a document screen reported as scrollable with nothing
            // at the bottom. `dvh` tracks the visible area instead.
            "terminal-grid relative min-h-dvh bg-void"
      }
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
    </main>
  );
}
