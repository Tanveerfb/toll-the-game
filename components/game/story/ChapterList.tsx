"use client";

import React from "react";
import Image from "next/image";
import { Lock } from "lucide-react";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getStoryBackground } from "@/lib/game/storyBackgrounds";
import { SOURCE_CHAPTERS_WRITTEN, type StoryIndexChapter } from "@/lib/game/storyCatalog";

/**
 * Chapter select — the first screen of story mode.
 *
 * A plain vertical list of large cards rather than a snap carousel. The list
 * grows toward Arc One's 24 chapters, and a list that long is *scanned*: a
 * carousel that centres one item hides the neighbours behind a fling and gives
 * every jump a scroll animation to sit through. Cards are 44px-plus tall targets
 * with everything a player needs to choose on the face of them.
 *
 * **Newest first.** The chapter you're on is the last one unlocked, so it lands at
 * the top under the thumb and the screen opens there with nothing to restore.
 * Sealed chapters are withheld entirely — a card carries a real title, tagline and
 * cover, and all three are spoilers (ruling #99).
 */
export default function ChapterList({
  chapters,
  onSelect,
}: {
  /** Already filtered to what the player may see, newest first. */
  chapters: StoryIndexChapter[];
  onSelect: (chapterId: string) => void;
}): React.JSX.Element {
  const adapted = chapters.length;

  // Numbered from the highest live chapter, so a slot never collides with a
  // chapter that is already on the screen. Capped at three.
  const highestLive = chapters.reduce(
    (max, chapter) => Math.max(max, chapter.number),
    0,
  );
  const sealedSlots = Array.from(
    { length: Math.max(0, Math.min(3, SOURCE_CHAPTERS_WRITTEN - highestLive)) },
    (_, i) => highestLive + i + 1,
  );

  return (
    <div className="mx-auto w-full max-w-md px-3 pt-3 pb-8">
      <p className="px-1 pb-2 text-[10px] tracking-eyebrow text-readout-muted uppercase">
        Arc One — The Grading · {adapted} of {SOURCE_CHAPTERS_WRITTEN} chapters live
      </p>

      <ul className="flex flex-col gap-3">
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            <ChapterCard chapter={chapter} onSelect={onSelect} />
          </li>
        ))}
      </ul>

      {/* Closes the list rather than leaving it to stop.
          At 390x844 one live chapter fills a third of the screen and the rest
          is empty grid, which reads as a screen that failed to load — the
          eyebrow above does say "1 of 12", but it is a 10px label at the top,
          not an answer to the space below it.

          Sealed slots rather than a note alone (Tanveer, 2026-09-01): a number
          in a box does not show the *shape* of what is coming, and the list
          needs to look like a list. Ruling #99 holds — a chapter's title,
          tagline and cover are all spoilers, so a slot carries its number and
          nothing else, and it is a `div`, not a `button`: there is nothing
          behind it to open.

          Three at most. The point is to show the list continues, and twelve
          identical dashes would be a wall.
          COPY IS A DRAFT — Tanveer's to word. */}
      {sealedSlots.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2" aria-hidden>
          {sealedSlots.map((number) => (
            <li key={number}>
              <div className="chamfer flex h-16 items-center gap-3 border border-dashed border-edge bg-inset/40 px-4">
                <Lock
                  className="h-4 w-4 shrink-0 text-readout-muted"
                  strokeWidth={2}
                />
                <span className="font-heading text-sm tracking-eyebrow text-readout-muted uppercase">
                  Chapter {number}
                </span>
                <span className="ml-auto font-body text-[9px] font-bold tracking-eyebrow text-readout-muted uppercase">
                  Sealed
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {adapted < SOURCE_CHAPTERS_WRITTEN ? (
        <p className="mt-3 px-4 text-center font-body text-xs leading-relaxed text-readout-muted">
          {SOURCE_CHAPTERS_WRITTEN - adapted} more chapter
          {SOURCE_CHAPTERS_WRITTEN - adapted === 1 ? " is" : "s are"} written and
          being adapted. They unlock here as they land.
        </p>
      ) : null}
    </div>
  );
}

function ChapterCard({
  chapter,
  onSelect,
}: {
  chapter: StoryIndexChapter;
  onSelect: (chapterId: string) => void;
}): React.JSX.Element {
  const art = getCharacterArt(chapter.coverCharacterId);
  const complete = chapter.clearedStages === chapter.totalStages;
  const progress = chapter.totalStages
    ? Math.round((chapter.clearedStages / chapter.totalStages) * 100)
    : 0;
  // The chapter's own locale tints the card, so two chapters never look alike
  // even before any cover art is drawn. This read `undefined` until 2026-08-21,
  // which meant every card fell back to the same neutral tint — the comment was
  // right and the call was not.
  const [tintFrom] = getStoryBackground(chapter.localeId).tint;

  return (
    <button
      type="button"
      onClick={() => onSelect(chapter.id)}
      className="chamfer relative flex h-44 w-full flex-col justify-end overflow-hidden border border-edge bg-panel p-3 text-left"
    >
      {art ? (
        <Image
          src={art}
          alt=""
          fill
          sizes="(max-width: 480px) 100vw, 448px"
          className="object-cover object-top opacity-60"
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: `linear-gradient(180deg, ${tintFrom}, #0a1116)` }}
        />
      )}
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,transparent_28%,rgba(6,9,12,0.9)_86%)]"
      />

      {/* The card's scrim runs `transparent 28% → dark 86%`, so at `top-2` this
          chip sits on raw artwork — cyan text over the brightest part of a
          cover. Measured unreadable in a browser at 393px, 2026-09-01. Its own
          scrim rather than extending the gradient: the gradient exists to make
          the *title block* legible, and darkening the top of every cover to
          carry one 10px label would cost the art more than the label is
          worth. */}
      <span
        className={`absolute top-2 right-2 border bg-void/75 px-2 py-0.5 text-[10px] tracking-label uppercase backdrop-blur-[2px] ${
          complete
            ? "border-edge text-readout-muted"
            : "border-edge-strong text-signal"
        }`}
      >
        {complete ? "Complete" : "In progress"}
      </span>

      <span className="relative font-heading text-xs tracking-eyebrow text-signal">
        Chapter {chapter.number}
      </span>
      <span className="relative font-heading text-2xl leading-none tracking-eyebrow text-readout-strong">
        {chapter.title}
      </span>
      <span className="relative pt-0.5 text-[13px] text-readout-dim">
        {chapter.tagline}
      </span>

      <span className="relative flex gap-4 pt-2 text-xs tracking-label text-readout">
        <span>
          Stages{" "}
          <b className="font-semibold text-readout-strong">{chapter.clearedStages}</b>/
          {chapter.totalStages}
        </span>
        {/* Mission counts are what keep a finished chapter on the screen for a
            reason — an unclaimed mission is the only thing left to come back for. */}
        {chapter.missionsTotal > 0 ? (
          <span>
            Missions{" "}
            <b className="font-semibold text-readout-strong">
              {chapter.missionsClaimed}
            </b>
            /{chapter.missionsTotal}
          </span>
        ) : null}
      </span>
      <span className="relative mt-1.5 block h-[3px] border border-hairline bg-inset">
        <span className="block h-full bg-signal" style={{ width: `${progress}%` }} />
      </span>
    </button>
  );
}
