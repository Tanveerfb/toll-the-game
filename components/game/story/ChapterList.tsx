"use client";

import React from "react";
import Image from "next/image";
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

  return (
    <div className="mx-auto w-full max-w-md px-3 pt-3 pb-8">
      <p className="px-1 pb-2 text-[10px] tracking-[0.2em] text-readout-muted uppercase">
        Arc One — The Grading · {adapted} of {SOURCE_CHAPTERS_WRITTEN} chapters live
      </p>

      <ul className="flex flex-col gap-3">
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            <ChapterCard chapter={chapter} onSelect={onSelect} />
          </li>
        ))}
      </ul>
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

      <span
        className={`absolute top-2 right-2 border px-2 py-0.5 text-[10px] tracking-[0.18em] uppercase ${
          complete
            ? "border-edge text-readout-muted"
            : "border-edge-strong text-signal"
        }`}
      >
        {complete ? "Complete" : "In progress"}
      </span>

      <span className="relative font-heading text-xs tracking-[0.22em] text-signal">
        Chapter {chapter.number}
      </span>
      <span className="relative font-heading text-2xl leading-none tracking-wide text-readout-strong">
        {chapter.title}
      </span>
      <span className="relative pt-0.5 text-[13px] text-readout-dim">
        {chapter.tagline}
      </span>

      <span className="relative flex gap-4 pt-2 text-xs tracking-[0.1em] text-readout">
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
