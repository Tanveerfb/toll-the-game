"use client";

import React from "react";
import { usePrefersReducedMotion } from "@/hooks/useDealSequence";

/**
 * A vertical snap carousel: one item centred and focused, its neighbours
 * peeking above and below (Tanveer's Dokkan "Series Selection" reference,
 * 2026-08-17). Part select uses it alone; chapter select pairs it with a hero
 * panel that reads the focused index.
 *
 * **CSS scroll-snap, not a drag.** `MotionProvider` loads `domAnimation`, which
 * excludes framer-motion's `drag` feature, and pulling in `domMax` would grow
 * the bundle on every screen for one component (the same ruling that made the
 * card hand hand-roll its pointer drag — see `battle/Hand.tsx`). Native snap
 * also gives correct touch momentum and OS-level fling for free, which a
 * hand-rolled drag would have to imitate.
 *
 * Focus comes from an `IntersectionObserver` with the root inset to a thin band
 * across the middle: whichever item overlaps the band is the focused one. That
 * tracks a fling or a wheel or a keypress identically, because it watches
 * position rather than input.
 *
 * Sizing is proportional so the same component works at any viewport height:
 * an item is a fraction of the scroller and the spacers make up half of what's
 * left, which is what lets the first and last items reach the centre.
 */
export default function SnapCarousel({
  count,
  ariaLabel,
  initialIndex = 0,
  itemClassName = "h-[42%]",
  spacerClassName = "h-[29%]",
  onFocusChange,
  children,
}: {
  count: number;
  ariaLabel: string;
  /** Which item the screen opens on. Part select wants the top; chapter select
   *  wants whichever chapter you're actually up to, which is rarely the first. */
  initialIndex?: number;
  /** Item height as a fraction of the scroller. Both neighbours peek at 42%. */
  itemClassName?: string;
  /** Half of `100% - itemHeight`, so item one can sit dead centre. */
  spacerClassName?: string;
  onFocusChange?: (index: number) => void;
  children: (index: number, focused: boolean) => React.ReactNode;
}): React.JSX.Element {
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const itemsRef = React.useRef<Array<HTMLDivElement | null>>([]);
  const [focused, setFocused] = React.useState(initialIndex);
  const reduced = usePrefersReducedMotion();

  // The callback lives in a ref so the observer can call the current one
  // without being torn down and rebuilt every time the parent re-renders.
  const notify = React.useRef(onFocusChange);
  React.useEffect(() => {
    notify.current = onFocusChange;
  }, [onFocusChange]);

  React.useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (!Number.isInteger(index)) continue;
          setFocused(index);
          notify.current?.(index);
        }
      },
      // A 10%-tall band across the middle. Mandatory snapping means exactly one
      // item can be centred, so the band can't hold two at rest.
      { root, rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    for (const node of itemsRef.current) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [count]);

  /** Jump to the opening item once, without animation — this is where the
   *  screen starts, not a movement the player made. The observer corrects
   *  `focused` from the resulting scroll position, so nothing has to stay in
   *  sync by hand. */
  const opened = React.useRef(false);
  React.useEffect(() => {
    if (opened.current || count === 0) return;
    opened.current = true;
    if (initialIndex <= 0) return;
    itemsRef.current[Math.min(initialIndex, count - 1)]?.scrollIntoView({
      block: "center",
      behavior: "auto",
    });
  }, [count, initialIndex]);

  /** Arrow keys walk the list, mirroring the teammate pager on the battle
   *  detail panel. Handled on the container rather than on a window listener:
   *  the items are buttons, so their keydown bubbles here and focus stays
   *  wherever the player put it. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (dir === 0) return;
    event.preventDefault();
    const next = Math.min(count - 1, Math.max(0, focused + dir));
    itemsRef.current[next]?.scrollIntoView({
      block: "center",
      behavior: reduced ? "auto" : "smooth",
    });
  };

  return (
    <div
      ref={scrollerRef}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="hud-scroll min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain px-3"
    >
      {/* Spacers, not padding: percentage padding resolves against width. */}
      <div aria-hidden className={`${spacerClassName} shrink-0`} />
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          data-index={index}
          ref={(node) => {
            itemsRef.current[index] = node;
          }}
          className={`${itemClassName} shrink-0 snap-center py-1.5`}
        >
          {children(index, index === focused)}
        </div>
      ))}
      <div aria-hidden className={`${spacerClassName} shrink-0`} />
    </div>
  );
}
