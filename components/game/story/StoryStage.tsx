"use client";

import React from "react";

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
  children,
}: {
  /** `stage` locks to the viewport below the nav: the cinematic beats and the
   *  battle, which are moments rather than documents. `page` scrolls — the
   *  index and the brief, which are documents and can outgrow a screen. */
  variant: "stage" | "page";
  grid?: boolean;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <main
      className={
        variant === "stage"
          ? "terminal-grid relative flex screen-below-nav flex-col overflow-hidden bg-void text-readout"
          : "terminal-grid relative min-h-screen bg-void"
      }
    >
      {grid ? (
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-size-[36px_36px]" />
      ) : null}
      {children}
    </main>
  );
}
