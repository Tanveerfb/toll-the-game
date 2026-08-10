"use client";

import React from "react";
import Image from "next/image";
import ChapterRow from "@/components/game/story/ChapterRow";
import ChapterSelectModal from "@/components/game/story/ChapterSelectModal";
import { getCharacterArt } from "@/lib/game/characterArt";
import {
  buildStoryIndexView,
  getArcProgress,
  UPCOMING_PARTS,
  type StoryIndexPart,
} from "@/lib/game/storyCatalog";

/**
 * The arc, newest first.
 *
 * The part you're on leads with its cover and **only the chapter you're on**;
 * everything else in that part sits behind chapter select. Finished parts
 * collapse to one bar each, newest first, and open the same modal — one
 * interaction pattern rather than inline expansion for history and a modal for
 * everything else (Tanveer, 2026-08-11).
 *
 * This shape is deliberately flat against content growth: 24 chapters costs
 * four more collapsed bars than 6 does, because the lead never renders more
 * than one row whatever the part contains.
 */

function CollapsedPart({
  part,
  onOpen,
}: {
  part: StoryIndexPart;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="chamfer group mb-1.5 grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3.5 border border-edge bg-panel px-3.5 py-2.5 text-left transition-colors hover:border-edge-strong"
    >
      <span className="font-body text-[10px] font-bold uppercase tracking-[0.28em] text-readout-muted">
        Part {part.order}
      </span>
      <span className="truncate font-heading text-xl tracking-[0.05em] text-readout-dim">
        {part.title}
      </span>
      <span className="font-body text-[10px] font-bold uppercase tracking-[0.16em] tabular-nums text-role-heal">
        ✓ {part.clearedCount} / {part.chapters.length}
      </span>
      <span className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted transition-colors group-hover:text-signal">
        Chapters ▸
      </span>
    </button>
  );
}

export default function StoryIndex({
  completed,
  onSelectChapter,
}: {
  completed: Record<string, boolean>;
  onSelectChapter: (partId: string, chapterId: string) => void;
}): React.JSX.Element {
  const view = React.useMemo(() => buildStoryIndexView(completed), [completed]);
  const progress = React.useMemo(() => getArcProgress(completed), [completed]);
  const [selectFor, setSelectFor] = React.useState<string | null>(null);

  const { lead, current, finished, sealedPartCount } = view;
  const cover = lead ? getCharacterArt(lead.coverCharacterId) : null;
  const percent =
    progress.total === 0
      ? 0
      : Math.round((progress.cleared / progress.total) * 100);

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <header className="border-l-2 border-signal pl-3">
        <span className="block font-body text-[10px] font-bold uppercase tracking-[0.34em] text-signal">
          Arc one
        </span>
        <h1 className="font-heading text-4xl leading-none tracking-[0.1em] text-readout-strong">
          Main Story
        </h1>
        <span className="mt-2 block h-[3px] w-full max-w-70 bg-hairline">
          <span
            className="block h-full bg-signal"
            style={{ width: `${percent}%` }}
          />
        </span>
        <p className="mt-1 font-body text-[11px] font-bold uppercase tracking-[0.18em] tabular-nums text-readout-muted">
          {progress.cleared} of {progress.total} chapters cleared
        </p>
      </header>

      {lead ? (
        <section className="mt-4">
          <div className="chamfer-lg relative h-28 overflow-hidden border border-signal bg-inset">
            {cover ? (
              <Image
                src={cover}
                alt=""
                width={560}
                height={300}
                priority
                className="absolute right-0 top-0 h-full w-[58%] object-cover object-[50%_16%]"
              />
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,9,12,0.97)_40%,rgba(6,9,12,0.32)_100%)]" />
            <div className="relative px-4 py-3.5">
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.3em] text-signal">
                {current ? "Current · " : ""}Part {lead.order}
              </p>
              <h2 className="mt-0.5 font-heading text-3xl leading-none tracking-[0.06em] text-readout-strong">
                {lead.title}
              </h2>
              <p className="mt-1 max-w-[44ch] font-body text-xs leading-relaxed text-readout-dim">
                {lead.tagline}
              </p>
            </div>
            <span className="absolute right-3 top-3 border border-edge bg-void/80 px-2 py-0.5 font-body text-[11px] font-bold tracking-[0.16em] tabular-nums text-readout-dim">
              {lead.clearedCount} / {lead.chapters.length}
            </span>
          </div>

          <div className="mt-1.5 flex flex-col gap-1.5">
            {current ? (
              <ChapterRow
                chapter={current}
                onSelect={() => onSelectChapter(lead.id, current.id)}
              />
            ) : (
              <p className="chamfer border border-dashed border-edge bg-panel/50 px-3 py-3 text-center font-body text-[11px] font-bold uppercase tracking-[0.2em] text-role-heal">
                Arc complete — every chapter cleared
              </p>
            )}
            <button
              type="button"
              onClick={() => setSelectFor(lead.id)}
              className="chamfer w-full border border-edge bg-panel px-3 py-2.5 font-body text-[11px] font-bold uppercase tracking-[0.2em] text-readout-dim transition-colors hover:border-edge-strong hover:text-signal"
            >
              ◈ All chapters in this part ({lead.chapters.length})
            </button>
          </div>
        </section>
      ) : null}

      {/* Everything out of reach reduces to one line. Sealed parts have real
          titles the player shouldn't see yet; upcoming parts don't exist at
          all, and a row each would imply they're one clear away. */}
      {sealedPartCount > 0 || UPCOMING_PARTS.length > 0 ? (
        <p className="mt-3 border border-dashed border-edge px-3 py-2.5 text-center font-body text-[11px] font-bold uppercase tracking-[0.2em] text-readout-muted">
          ◈{" "}
          {sealedPartCount > 0
            ? `${sealedPartCount} part${sealedPartCount === 1 ? "" : "s"} sealed`
            : null}
          {sealedPartCount > 0 && UPCOMING_PARTS.length > 0 ? " · " : null}
          {UPCOMING_PARTS.length > 0
            ? `${UPCOMING_PARTS.length} more in development`
            : null}
        </p>
      ) : null}

      {finished.length > 0 ? (
        <>
          <p className="mb-2 mt-6 border-b border-hairline pb-1.5 font-body text-[10px] font-bold uppercase tracking-[0.28em] text-readout-muted">
            Completed
          </p>
          {finished.map((part) => (
            <CollapsedPart
              key={part.id}
              part={part}
              onOpen={() => setSelectFor(part.id)}
            />
          ))}
        </>
      ) : null}

      {selectFor ? (
        <ChapterSelectModal
          completed={completed}
          initialPartId={selectFor}
          currentPartId={current ? (lead?.id ?? null) : null}
          onSelectChapter={(partId, chapterId) => {
            setSelectFor(null);
            onSelectChapter(partId, chapterId);
          }}
          onClose={() => setSelectFor(null)}
        />
      ) : null}
    </section>
  );
}
