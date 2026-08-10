"use client";

import React from "react";
import Image from "next/image";
import { getCharacterArt } from "@/lib/game/characterArt";
import type { StoryIndexChapter } from "@/lib/game/storyCatalog";

/**
 * One chapter, shared by the index and the chapter-select modal so a chapter
 * looks identical wherever it appears.
 *
 * Sealed chapters keep their row and their number but lose everything else.
 * The redaction is fixed-width on purpose: blocking out the real title
 * character-for-character leaks its length, and "Nine Years" against "The
 * World That Toll Built" is most of the guess (Tanveer, 2026-08-11).
 */
export const REDACTED_TITLE = "████████ █████";

function EnemyThumbs({
  ids,
  dimmed,
}: {
  ids: string[];
  dimmed: boolean;
}): React.JSX.Element {
  return (
    <span className="flex gap-1">
      {ids.map((id, index) => {
        const art = getCharacterArt(id);
        return (
          <span
            key={`${id}-${index}`}
            className="block h-7 w-7 overflow-hidden border border-hairline bg-inset"
          >
            {art ? (
              <Image
                src={art}
                alt=""
                width={96}
                height={96}
                className={`h-full w-full object-cover ${dimmed ? "grayscale brightness-60" : ""}`}
              />
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

const GRID =
  "grid grid-cols-[30px_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2.5";

export default function ChapterRow({
  chapter,
  partLabel,
  onSelect,
}: {
  chapter: StoryIndexChapter;
  /** "Part 2" — rendered only in search results, where rows leave their part. */
  partLabel?: string;
  onSelect: () => void;
}): React.JSX.Element {
  if (chapter.state === "sealed") {
    return (
      <div
        aria-label={`Chapter ${chapter.number}, sealed`}
        className={`${GRID} border border-dashed border-edge bg-panel/50`}
      >
        <span className="font-heading text-2xl leading-none text-readout-muted">
          {chapter.number}
        </span>
        <span className="min-w-0">
          <span
            aria-hidden="true"
            className="block truncate font-heading text-lg tracking-[0.02em] text-hairline"
          >
            {REDACTED_TITLE}
          </span>
          <span className="mt-px block font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
            Sealed
          </span>
        </span>
        <span className="flex gap-1" aria-hidden="true">
          {chapter.enemyIds.map((_, index) => (
            <span
              key={index}
              className="grid h-7 w-7 place-items-center border border-hairline bg-inset font-body text-xs font-bold text-readout-muted"
            >
              ?
            </span>
          ))}
        </span>
        <span className="min-w-16 text-right font-body text-xs text-readout-muted">
          ◈
        </span>
      </div>
    );
  }

  const cleared = chapter.state === "cleared";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`chamfer ${GRID} border text-left transition-colors ${
        cleared
          ? "border-edge bg-panel hover:border-edge-strong"
          : "border-signal bg-signal/5 hover:bg-signal/10"
      }`}
    >
      <span
        className={`font-heading text-2xl leading-none ${cleared ? "text-readout-muted" : "text-signal"}`}
      >
        {chapter.number}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-heading text-lg tracking-[0.04em] text-readout-strong">
          {chapter.title}
        </span>
        <span className="mt-px block font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
          {partLabel ? (
            <span className="mr-2 text-signal">{partLabel}</span>
          ) : null}
          {cleared
            ? `Replay · ${chapter.replayStamina} stamina`
            : `${chapter.enemyIds.length} enem${chapter.enemyIds.length === 1 ? "y" : "ies"} · first clear`}
        </span>
      </span>
      <EnemyThumbs ids={chapter.enemyIds} dimmed={cleared} />
      <span
        className={`min-w-16 text-right font-body text-[10px] font-bold uppercase tracking-[0.16em] ${
          cleared ? "text-readout-muted" : "text-signal"
        }`}
      >
        {cleared ? "Cleared" : "Continue →"}
      </span>
    </button>
  );
}
