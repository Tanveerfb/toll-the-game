"use client";

import React from "react";
import Image from "next/image";
import EntryCard, { REDACTED_TITLE } from "@/components/game/story/EntryCard";
import SnapCarousel from "@/components/game/story/SnapCarousel";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { describeOrderReward, ordersForChapter } from "@/lib/game/orders";
import { chapterKey, type StoryIndexPart } from "@/lib/game/storyCatalog";
import { getStoryChapter } from "@/lib/game/storyCatalog";
import { describeRewards, storyAttemptCost } from "@/lib/game/storyRewards";
import { usePlayerStore } from "@/store/playerStore";

/**
 * The chapters of one part: a hero panel that follows the carousel's focus, over
 * a snapped list of reward cards.
 *
 * The split is what makes it fit a phone. A list dense enough to compare
 * chapters has no room for art, and art big enough to matter leaves no room for
 * a list — so the focused chapter borrows the top half and the rows stay
 * compact. Scrolling the list re-dresses the hero, which is Tanveer's reference
 * behaviour exactly.
 *
 * Replaces `ChapterSelectModal`. **One thing is deliberately lost:** that modal
 * could search chapters across every part. `searchChapters` is still exported and
 * still tested, so the affordance can come back — but a per-part screen has
 * nowhere honest to put a cross-part search box, and inventing one here would
 * have meant guessing at a screen Tanveer hasn't specified.
 *
 * Chapters read in story order, ascending, because that is the order they
 * happened in. The screen *opens* on the one you're up to rather than on chapter
 * one, so ordering the list for narrative sense costs no reachability.
 */
export default function ChapterSelect({
  part,
  completed,
  onSelectChapter,
  onBack,
}: {
  part: StoryIndexPart;
  completed: Record<string, boolean>;
  onSelectChapter: (partId: string, chapterId: string) => void;
  onBack: () => void;
}): React.JSX.Element {
  const claimedOrders = usePlayerStore((s) => s.claimedOrders);

  // Open on the first chapter that isn't cleared; on a fully cleared part, the
  // last one, which is where a returning player left the story.
  const openAt = React.useMemo(() => {
    const next = part.chapters.findIndex((c) => c.state !== "cleared");
    return next === -1 ? part.chapters.length - 1 : next;
  }, [part.chapters]);
  const [focused, setFocused] = React.useState(openAt);

  const shown = part.chapters[Math.min(focused, part.chapters.length - 1)];
  const shownSealed = shown?.state === "sealed";

  /** The hero's art. A chapter has no art field of its own, so it borrows: the
   *  first enemy where there's a fight, else the part cover. A sealed chapter
   *  borrows nothing — its opposition is exactly what mustn't be shown. */
  const heroArt = shownSealed
    ? null
    : ((shown?.enemyIds.length ?? 0) > 0
        ? getCharacterArt(shown.enemyIds[0])
        : null) ?? getCharacterArt(part.coverCharacterId);

  const opposition = shownSealed
    ? null
    : shown.enemyIds
        .map((id) => getCharacterById(id)?.name ?? id)
        .filter((name, index, all) => all.indexOf(name) === index)
        .join(", ");

  return (
    <>
      <div className="relative flex-none overflow-hidden border-b border-edge">
        <div className="relative h-[38dvh] min-h-40">
          {heroArt ? (
            <Image
              src={heroArt}
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 100vw, 420px"
              className="object-cover object-[50%_10%] opacity-65"
            />
          ) : null}
          <div className="absolute inset-0 bg-linear-to-t from-void via-void/55 to-void/5" />
          <div className="absolute inset-x-0 bottom-0 px-3.5 pb-3">
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.28em] text-signal">
              Part {part.order} · Chapter {shown?.number ?? 1}
            </p>
            <h2 className="mt-0.5 font-heading text-2xl leading-none tracking-[0.06em] text-readout-strong">
              {shownSealed ? (
                <span aria-hidden className="text-readout-muted">
                  {REDACTED_TITLE}
                </span>
              ) : (
                (shown?.title ?? part.title)
              )}
            </h2>
            <p className="mt-1.5 font-body text-xs leading-relaxed text-readout-dim">
              {shownSealed
                ? "Sealed — clear the chapter before it to open this one."
                : opposition
                  ? `Against ${opposition}`
                  : "Scenes only — no battle in this chapter."}
            </p>
          </div>
        </div>
      </div>

      <SnapCarousel
        count={part.chapters.length}
        ariaLabel={`Chapters in part ${part.order}`}
        initialIndex={openAt}
        onFocusChange={setFocused}
        itemClassName="h-[46%]"
        spacerClassName="h-[27%]"
      >
        {(index, isFocused) => {
          const chapter = part.chapters[index];
          const cleared = completed[chapterKey(part.id, chapter.id)] === true;
          const rewards = getStoryChapter(part.id, chapter.id)?.rewards;
          const order = ordersForChapter(part.id, chapter.id)[0];
          return (
            <EntryCard
              chapter={chapter}
              cleared={cleared}
              staminaCost={rewards ? storyAttemptCost(rewards) : 0}
              clearReward={rewards ? describeRewards(rewards, false) : []}
              farmable={rewards ? describeRewards(rewards, true) : []}
              ribbon={
                order
                  ? {
                      label: describeOrderReward(order.reward),
                      claimed: claimedOrders[order.id] === true,
                    }
                  : null
              }
              focused={isFocused}
              onSelect={() => onSelectChapter(part.id, chapter.id)}
            />
          );
        }}
      </SnapCarousel>

      <div
        className="flex flex-none items-center justify-between gap-3 border-t border-hairline bg-inset px-3 py-2"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={onBack}
          className="chamfer min-h-11 border border-edge px-4 font-heading text-base tracking-[0.12em] text-readout-dim transition-colors hover:border-signal hover:text-signal"
        >
          ‹‹‹ PARTS
        </button>
        <span className="font-body text-[11px] font-bold uppercase tracking-[0.16em] tabular-nums text-readout-muted">
          {part.clearedCount} / {part.chapters.length} cleared
        </span>
      </div>
    </>
  );
}
