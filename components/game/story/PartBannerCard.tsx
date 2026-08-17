"use client";

import React from "react";
import Image from "next/image";
import { getCharacterArt } from "@/lib/game/characterArt";
import type { StoryIndexPart } from "@/lib/game/storyCatalog";

/**
 * One part, as a full banner card in the part carousel.
 *
 * The recipe is the one the old index lead banner and the home hero already
 * used — art absolutely positioned, a scrim over it, text in a `relative` block
 * that stacks above without needing a z-index. What's different is the scrim
 * direction: those two mask from the left because their text sits beside the
 * art, while a card this tall puts its text underneath, so the fade runs
 * bottom-up instead.
 *
 * Only parts the player has reached are ever rendered (see `visibleParts`), so
 * there is no sealed state here — a sealed part carries a spoiler title, a
 * spoiler tagline and a spoiler cover, and the answer is not to draw it.
 */
export default function PartBannerCard({
  part,
  focused,
  priority = false,
  onSelect,
}: {
  part: StoryIndexPart;
  focused: boolean;
  /** Set on the card the screen opens on — it's the LCP element here. */
  priority?: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  const cover = getCharacterArt(part.coverCharacterId);
  const total = part.chapters.length;
  const complete = total > 0 && part.clearedCount === total;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Part ${part.order}, ${part.title}. ${part.clearedCount} of ${total} chapters cleared.`}
      className={`chamfer-lg relative flex h-full w-full flex-col justify-end overflow-hidden border bg-inset text-left transition-[transform,opacity,border-color] duration-200 ${
        focused
          ? "scale-100 border-signal opacity-100"
          : "scale-[0.93] border-edge opacity-40 grayscale"
      }`}
    >
      {/* A missing cover leaves the scrim over bare `bg-inset` — `getCharacterArt`
          returns null rather than a placeholder path, and a broken image would
          read worse than a dark card. */}
      {cover ? (
        <Image
          src={cover}
          alt=""
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, 420px"
          className="object-cover object-[50%_12%] opacity-60"
        />
      ) : null}
      <div className="absolute inset-0 bg-linear-to-t from-void via-void/60 to-void/10" />

      <div className="relative px-3.5 pb-3.5">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.3em] text-signal">
          Part {part.order}
        </p>
        <h3 className="mt-0.5 font-heading text-3xl leading-none tracking-[0.06em] text-readout-strong">
          {part.title}
        </h3>
        <p className="mt-1.5 max-w-[34ch] font-body text-xs leading-relaxed text-readout-dim">
          {part.tagline}
        </p>
      </div>

      {/* A finished part is farmable, so it says CLEAR rather than 3/3 — the
          ratio matters while it's still climbing, the state matters after. */}
      {complete ? (
        <span className="absolute right-3 top-3 border-2 border-role-heal px-2 py-0.5 font-heading text-base tracking-[0.12em] text-role-heal">
          CLEAR
        </span>
      ) : (
        <span className="absolute right-3 top-3 border border-edge bg-void/80 px-2 py-0.5 font-body text-[11px] font-bold tracking-[0.16em] tabular-nums text-readout-dim">
          {part.clearedCount} / {total}
        </span>
      )}

      {focused ? (
        <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 font-heading text-sm tracking-[0.18em] text-signal">
          TAP
        </span>
      ) : null}
    </button>
  );
}
