"use client";

import React from "react";
import Image from "next/image";
import { getCharacterArt } from "@/lib/game/characterArt";
import { chapterKey, getStoryParts, isPartUnlocked, UPCOMING_PARTS } from "@/lib/game/storyCatalog";

export default function StoryPartSelect({
  completed,
  onSelectPart,
}: {
  completed: Record<string, boolean>;
  onSelectPart: (partId: string) => void;
}): React.JSX.Element {
  const parts = getStoryParts();

  return (
    <section className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <h1 className="font-heading text-4xl tracking-[0.14em] text-zinc-100 md:text-6xl">
        MAIN STORY
      </h1>
      <p className="mt-1 font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
        Arc One — clear chapters in order to unlock the next
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {parts.map((part) => {
          const unlocked = isPartUnlocked(completed, part.id);
          const clearedCount = part.chapters.filter(
            (chapter) => completed[chapterKey(part.id, chapter.id)] === true,
          ).length;
          const art = getCharacterArt(part.coverCharacterId);
          return (
            <button
              key={part.id}
              type="button"
              disabled={!unlocked}
              onClick={() => onSelectPart(part.id)}
              className={`group relative flex h-36 items-center overflow-hidden border-2 text-left transition-colors md:h-44 ${
                unlocked
                  ? "border-zinc-600 bg-zinc-900/60 hover:border-amber-300"
                  : "cursor-not-allowed border-zinc-800 bg-zinc-950/60"
              }`}
            >
              {art ? (
                <Image
                  src={art}
                  alt={part.title}
                  width={512}
                  height={512}
                  className={`absolute right-0 h-full w-40 object-cover object-top md:w-64 ${
                    unlocked
                      ? "opacity-80 transition-opacity group-hover:opacity-100"
                      : "opacity-25 grayscale"
                  }`}
                />
              ) : null}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(9,9,11,0.95)_45%,transparent_85%)]" />
              <div className={`relative z-10 px-6 ${unlocked ? "" : "opacity-50"}`}>
                <p className="font-body text-xs uppercase tracking-[0.16em] text-amber-300">
                  Part {part.order}
                </p>
                <p className="mt-1 font-heading text-3xl tracking-[0.1em] text-zinc-100 md:text-4xl">
                  {part.title.toUpperCase()}
                </p>
                <p className="mt-1 max-w-md font-body text-xs uppercase tracking-[0.12em] text-zinc-400">
                  {part.tagline}
                </p>
                <p className="mt-2 font-body text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  {unlocked
                    ? `${clearedCount} / ${part.chapters.length} chapters cleared`
                    : "Locked — clear the previous part"}
                </p>
              </div>
            </button>
          );
        })}

        {UPCOMING_PARTS.map((upcoming) => (
          <div
            key={upcoming.order}
            className="flex h-24 items-center border-2 border-zinc-800 bg-zinc-950/60 px-6 opacity-50"
          >
            <div>
              <p className="font-body text-xs uppercase tracking-[0.16em] text-zinc-500">
                Part {upcoming.order}
              </p>
              <p className="mt-1 font-heading text-2xl tracking-[0.1em] text-zinc-400">
                {upcoming.title.toUpperCase()}
              </p>
              <p className="font-body text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                Coming soon
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
