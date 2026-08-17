"use client";

import React from "react";
import PartBannerCard from "@/components/game/story/PartBannerCard";
import SnapCarousel from "@/components/game/story/SnapCarousel";
import { getArcProgress, visibleParts } from "@/lib/game/storyCatalog";
import { useStoryStore } from "@/store/storyStore";

/**
 * Story mode's front door: one part per card, snapped through vertically.
 *
 * Replaces the old index, which showed the lead part as a banner, the one
 * current chapter as a row, finished parts as collapsed bars, and everything
 * unreachable as a single line of text. That shape was built to stay flat
 * against content growth, and this one keeps that property differently — a
 * carousel of N cards costs the same layout whatever N is.
 *
 * Two things it no longer does, both deliberate:
 *  - **Sealed parts don't render at all** (Tanveer, 2026-08-17: a part appears
 *    only once the previous one is complete). The old index printed
 *    "◈ 4 parts sealed"; a carousel of full banners has nowhere safe to put a
 *    part whose title, tagline and cover art are all spoilers.
 *  - **No chapter row.** Picking a part opens the chapter-select screen, which
 *    owns everything about a chapter — its rewards, its opposition, its cost.
 */
export default function PartSelect({
  completed,
  onSelectPart,
}: {
  completed: Record<string, boolean>;
  onSelectPart: (partId: string) => void;
}): React.JSX.Element {
  // Progress arrives from localStorage a tick after mount. Without this gate a
  // fresh load paints one card (Part 1, the only thing unlocked by an empty
  // record) and then pops the rest in underneath — which moves the top card out
  // from under the player's thumb.
  const hasHydrated = useStoryStore((s) => s.hasHydrated);

  const parts = React.useMemo(() => visibleParts(completed), [completed]);
  const progress = React.useMemo(() => getArcProgress(completed), [completed]);

  const percent =
    progress.total === 0
      ? 0
      : Math.round((progress.cleared / progress.total) * 100);

  return (
    <>
      <header className="flex flex-none items-center justify-between gap-3 border-b border-hairline bg-inset px-3 py-2">
        <div className="min-w-0">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.3em] text-signal">
            Arc one · Main story
          </p>
          <span className="mt-1.5 block h-[3px] w-40 max-w-full bg-hairline">
            <span
              className="block h-full bg-signal"
              style={{ width: `${percent}%` }}
            />
          </span>
        </div>
        <span className="shrink-0 border border-edge bg-void/80 px-2 py-0.5 font-body text-[11px] font-bold tracking-[0.16em] tabular-nums text-readout-dim">
          {progress.cleared} / {progress.total}
        </span>
      </header>

      {!hasHydrated ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="font-body text-[11px] font-bold uppercase tracking-[0.2em] text-readout-muted">
            Loading progress…
          </p>
        </div>
      ) : parts.length === 0 ? (
        // Unreachable in practice — part 1 chapter 1 is always unlocked — but a
        // carousel of zero items would otherwise render as blank space.
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-center font-body text-[11px] font-bold uppercase tracking-[0.2em] text-readout-muted">
            No parts available
          </p>
        </div>
      ) : (
        <SnapCarousel count={parts.length} ariaLabel="Story parts, newest first">
          {(index, focused) => (
            <PartBannerCard
              part={parts[index]}
              focused={focused}
              priority={index === 0}
              onSelect={() => onSelectPart(parts[index].id)}
            />
          )}
        </SnapCarousel>
      )}
    </>
  );
}
