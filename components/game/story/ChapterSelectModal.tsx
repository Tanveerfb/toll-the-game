"use client";

import React from "react";
import DetailOverlay from "@/components/game/DetailOverlay";
import ChapterRow from "@/components/game/story/ChapterRow";
import { Input } from "@/components/ui/input";
import { pageWindow, paginate } from "@/lib/pagination";
import {
  buildStoryIndex,
  searchChapters,
  type StoryIndexPart,
} from "@/lib/game/storyCatalog";

/**
 * Chapter select — the one door to every chapter that isn't the current one.
 *
 * Browsing is scoped by part chips rather than paged through a flat list. At
 * 24 chapters a flat list means paging past whole parts to reach a chapter you
 * can already name; scoping keeps the body at about four rows and pagination
 * almost never fires (Tanveer, 2026-08-11). Search is the case that genuinely
 * needs the pager, since a broad query crosses every part.
 *
 * Sealed chapters render redacted here exactly as they do on the index, and
 * `searchChapters` refuses to match them — see the note there.
 */

const PAGE_SIZE = 8;

const CHIP =
  "chamfer min-h-11 border px-3 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-colors";
const CHIP_OFF =
  "border-edge bg-void/60 text-readout-dim hover:border-edge-strong hover:text-readout";
const CHIP_ON = "border-signal bg-signal text-void";

function PartChip({
  part,
  active,
  onSelect,
}: {
  part: StoryIndexPart;
  active: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  if (part.sealed) {
    return (
      <span
        aria-label={`Part ${part.order}, sealed`}
        className={`${CHIP} cursor-default border-dashed border-edge text-readout-muted`}
      >
        Part {part.order}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`${CHIP} ${active ? CHIP_ON : CHIP_OFF}`}
    >
      Part {part.order}
    </button>
  );
}

export default function ChapterSelectModal({
  completed,
  /** Part the opener came from — the chip that starts selected. */
  initialPartId,
  currentPartId,
  onSelectChapter,
  onClose,
}: {
  completed: Record<string, boolean>;
  initialPartId: string;
  /** Part holding the current chapter, for "Jump to current". Null on a
   *  fully cleared arc, which hides the button. */
  currentPartId: string | null;
  onSelectChapter: (partId: string, chapterId: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const parts = React.useMemo(() => buildStoryIndex(completed), [completed]);
  const [partId, setPartId] = React.useState(initialPartId);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const searching = query.trim().length > 0;
  const hits = React.useMemo(
    () => (searching ? searchChapters(completed, query) : []),
    [completed, query, searching],
  );
  const part = parts.find((p) => p.id === partId) ?? parts[0];

  const { items, page: safePage, pageCount } = paginate(hits, page, PAGE_SIZE);

  const choosePart = (id: string) => {
    setPartId(id);
    setQuery("");
    setPage(1);
  };

  return (
    <DetailOverlay
      title="Chapter select"
      subtitle="Main story"
      size="wide"
      onClose={onClose}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Search chapters"
          aria-label="Search chapters"
          className="chamfer h-11 min-w-0 flex-1 rounded-none border border-edge bg-inset font-body text-readout placeholder:text-readout-muted focus-visible:border-signal focus-visible:ring-0 dark:bg-inset"
        />
        {currentPartId ? (
          <button
            type="button"
            onClick={() => choosePart(currentPartId)}
            className={`${CHIP} ${CHIP_OFF}`}
          >
            Jump to current
          </button>
        ) : null}
      </div>

      {/* Chips disappear while searching — results already span every part, so
          a part filter on top of a cross-part query reads as a contradiction. */}
      {!searching ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {parts.map((p) => (
            <PartChip
              key={p.id}
              part={p}
              active={p.id === part?.id}
              onSelect={() => choosePart(p.id)}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-3">
        <p className="mb-2 flex items-baseline gap-3 border-b border-hairline pb-1.5 font-body text-[10px] font-bold uppercase tracking-[0.22em] text-readout-dim">
          {searching ? (
            <>
              Results across all parts
              <span className="ml-auto tabular-nums text-readout-muted">
                {hits.length} found
              </span>
            </>
          ) : (
            <>
              Part {part?.order} — {part?.title}
              <span className="ml-auto tabular-nums text-readout-muted">
                {part?.clearedCount} / {part?.chapters.length}
              </span>
            </>
          )}
        </p>

        {searching && hits.length === 0 ? (
          <p className="py-8 text-center font-body text-sm text-readout-muted">
            No chapters match.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {(searching ? items : (part?.chapters ?? [])).map((chapter) => {
              const owner = searching
                ? (chapter as (typeof items)[number]).partId
                : part.id;
              return (
                <ChapterRow
                  key={`${owner}-${chapter.id}`}
                  chapter={chapter}
                  partLabel={
                    searching
                      ? `Part ${(chapter as (typeof items)[number]).partOrder}`
                      : undefined
                  }
                  onSelect={() => onSelectChapter(owner, chapter.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      {searching && pageCount > 1 ? (
        <nav
          aria-label="Result pages"
          className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-hairline pt-3"
        >
          <button
            type="button"
            onClick={() => setPage(safePage - 1)}
            disabled={safePage === 1}
            className={`${CHIP} ${CHIP_OFF} disabled:pointer-events-none disabled:opacity-40`}
          >
            ← Prev
          </button>
          {pageWindow(safePage, pageCount).map((n, index) =>
            n === null ? (
              <span
                key={`gap-${index}`}
                aria-hidden="true"
                className="px-1 font-body text-[11px] font-bold text-readout-muted"
              >
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === safePage ? "page" : undefined}
                className={`${CHIP} tabular-nums ${n === safePage ? CHIP_ON : CHIP_OFF}`}
              >
                {n}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => setPage(safePage + 1)}
            disabled={safePage === pageCount}
            className={`${CHIP} ${CHIP_OFF} disabled:pointer-events-none disabled:opacity-40`}
          >
            Next →
          </button>
        </nav>
      ) : null}
    </DetailOverlay>
  );
}
