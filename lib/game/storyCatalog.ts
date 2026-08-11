import part1 from "@/data/story/part1.json";
import part2 from "@/data/story/part2.json";
import part3 from "@/data/story/part3.json";
import part4 from "@/data/story/part4.json";
import part5 from "@/data/story/part5.json";
import part6 from "@/data/story/part6.json";
import part7 from "@/data/story/part7.json";
import part8 from "@/data/story/part8.json";
import part9 from "@/data/story/part9.json";
import part10 from "@/data/story/part10.json";
import part11 from "@/data/story/part11.json";
import part12 from "@/data/story/part12.json";
import { validateStoryParts } from "@/lib/game/storySchema";
import type { StoryChapter, StoryPart } from "@/types/story";

// Fail loudly at load time on malformed story JSON or battles that
// reference characters missing from the catalog — same policy as kits.
const storyParts: StoryPart[] = validateStoryParts([
  part1,
  part2,
  part3,
  part4,
  part5,
  part6,
  part7,
  part8,
  part9,
  part10,
  part11,
  part12,
]).sort((a, b) => a.order - b.order);

/**
 * Source chapters not yet adapted — shown as locked banners in the UI.
 *
 * Empty as of 2026-08-12: all twelve written webtoon chapters are adapted.
 * Battles exist only where the source has a fight — Tanveer ruled against
 * inventing any — so chapters 3, 4, 6, 11 and 12 are scene-only, which the
 * engine supports and which pays first-clear rewards like any other chapter.
 *
 * Phase 3 (the bracket part 12 ends on) isn't written in the source yet, so
 * this stays empty rather than advertising a part that has nothing behind it.
 */
export const UPCOMING_PARTS: ReadonlyArray<{ order: number; title: string }> =
  [];

export function getStoryParts(): StoryPart[] {
  return storyParts;
}

export function getStoryPart(partId: string): StoryPart | undefined {
  return storyParts.find((part) => part.id === partId);
}

export function getStoryChapter(
  partId: string,
  chapterId: string,
): StoryChapter | undefined {
  return getStoryPart(partId)?.chapters.find(
    (chapter) => chapter.id === chapterId,
  );
}

/** Progress key for one chapter — the shape stored in completed maps */
export function chapterKey(partId: string, chapterId: string): string {
  return `${partId}:${chapterId}`;
}

/**
 * Sequential unlock: the very first chapter is always open; every other
 * chapter opens when its predecessor is complete (the last chapter of the
 * previous part for a part's first chapter).
 */
export function isChapterUnlocked(
  completed: Record<string, boolean>,
  partId: string,
  chapterId: string,
): boolean {
  const partIndex = storyParts.findIndex((part) => part.id === partId);
  if (partIndex === -1) return false;
  const part = storyParts[partIndex];
  const chapterIndex = part.chapters.findIndex(
    (chapter) => chapter.id === chapterId,
  );
  if (chapterIndex === -1) return false;

  if (chapterIndex > 0) {
    const previous = part.chapters[chapterIndex - 1];
    return completed[chapterKey(partId, previous.id)] === true;
  }
  if (partIndex === 0) return true;

  const previousPart = storyParts[partIndex - 1];
  const lastChapter = previousPart.chapters[previousPart.chapters.length - 1];
  return completed[chapterKey(previousPart.id, lastChapter.id)] === true;
}

/** A part is open once its first chapter is */
export function isPartUnlocked(
  completed: Record<string, boolean>,
  partId: string,
): boolean {
  const part = getStoryPart(partId);
  if (!part) return false;
  return isChapterUnlocked(completed, partId, part.chapters[0].id);
}

/**
 * What the index is allowed to show about a chapter.
 *
 * `sealed` rows render redacted — the row and its position survive, the title
 * and enemies don't. Chapter titles are themselves spoilers ("Nine Years",
 * "The Notice"), which is why a locked chapter used to sit in the list fully
 * legible and merely dimmed (Tanveer, 2026-08-11).
 *
 * Sequential unlock means at most one chapter is ever `current`: the first
 * unlocked chapter you haven't cleared.
 */
export type ChapterState = "cleared" | "current" | "sealed";

export function getChapterState(
  completed: Record<string, boolean>,
  partId: string,
  chapterId: string,
): ChapterState {
  if (completed[chapterKey(partId, chapterId)] === true) return "cleared";
  return isChapterUnlocked(completed, partId, chapterId) ? "current" : "sealed";
}

export interface StoryIndexChapter {
  id: string;
  /** 1-based position within its part — kept on sealed rows, which is the
   *  whole point of redacting rather than removing them. */
  number: number;
  title: string;
  state: ChapterState;
  enemyIds: string[];
  replayStamina: number;
}

export interface StoryIndexPart {
  id: string;
  order: number;
  title: string;
  tagline: string;
  coverCharacterId: string;
  /** Sealed parts show their number and nothing else. */
  sealed: boolean;
  clearedCount: number;
  chapters: StoryIndexChapter[];
}

/**
 * The whole index in one pass: every part, every chapter, each tagged with
 * what may be shown. Pure, so the visibility rules are unit-testable and the
 * component stays presentational.
 */
export function buildStoryIndex(
  completed: Record<string, boolean>,
): StoryIndexPart[] {
  return storyParts.map((part) => {
    const chapters: StoryIndexChapter[] = part.chapters.map(
      (chapter, index) => ({
        id: chapter.id,
        number: index + 1,
        title: chapter.title,
        state: getChapterState(completed, part.id, chapter.id),
        enemyIds: chapter.battle?.enemyTeam.map((unit) => unit.id) ?? [],
        replayStamina: chapter.rewards.replayStamina,
      }),
    );
    return {
      id: part.id,
      order: part.order,
      title: part.title,
      tagline: part.tagline,
      coverCharacterId: part.coverCharacterId,
      sealed: !isPartUnlocked(completed, part.id),
      clearedCount: chapters.filter((c) => c.state === "cleared").length,
      chapters,
    };
  });
}

/**
 * The index reads newest-first: the part you're on leads, finished parts
 * collapse beneath it, and everything unreachable becomes a single line
 * (Tanveer, 2026-08-11). Splitting the parts here rather than in the component
 * keeps "which part leads" a testable question.
 *
 * `lead` is the part holding the one `current` chapter. When the whole arc is
 * cleared there is no current chapter, so the last part leads and `current` is
 * null — the index then shows every part as finished rather than rendering an
 * empty lead.
 */
export interface StoryIndexView {
  lead: StoryIndexPart | null;
  /** The current chapter inside `lead`, or null on a fully cleared arc. */
  current: StoryIndexChapter | null;
  /** Parts before the lead, newest first. */
  finished: StoryIndexPart[];
  /** Parts after the lead — a count only; their titles are spoilers. */
  sealedPartCount: number;
}

export function buildStoryIndexView(
  completed: Record<string, boolean>,
): StoryIndexView {
  const parts = buildStoryIndex(completed);
  const leadIndex = parts.findIndex((part) =>
    part.chapters.some((chapter) => chapter.state === "current"),
  );
  if (leadIndex === -1) {
    // Either everything is cleared, or the catalog is empty.
    const last = parts.length > 0 ? parts[parts.length - 1] : null;
    return {
      lead: last,
      current: null,
      finished: parts.slice(0, Math.max(0, parts.length - 1)).reverse(),
      sealedPartCount: 0,
    };
  }
  const lead = parts[leadIndex];
  return {
    lead,
    current: lead.chapters.find((c) => c.state === "current") ?? null,
    finished: parts.slice(0, leadIndex).reverse(),
    sealedPartCount: parts.length - leadIndex - 1,
  };
}

export interface ChapterSearchHit extends StoryIndexChapter {
  partId: string;
  partOrder: number;
  partTitle: string;
}

/**
 * Chapter search for the select modal.
 *
 * **Sealed chapters are never returned.** Typing an unreleased chapter's exact
 * title finds nothing, so search can't be turned into an enumeration tool —
 * that would leak straight past the redaction the index is built around. This
 * is a correctness property, not a nicety; `tests/storyIndex.test.ts` asserts
 * it directly.
 *
 * An empty query returns every visible chapter, which is what the modal shows
 * before you type.
 */
export function searchChapters(
  completed: Record<string, boolean>,
  query: string,
): ChapterSearchHit[] {
  const needle = query.trim().toLowerCase();
  return buildStoryIndex(completed).flatMap((part) =>
    part.chapters
      .filter((chapter) => chapter.state !== "sealed")
      .filter(
        (chapter) =>
          needle.length === 0 ||
          chapter.title.toLowerCase().includes(needle) ||
          // Part titles are fair game here: every chapter that survived the
          // filter above belongs to a part the player has already opened.
          part.title.toLowerCase().includes(needle),
      )
      .map((chapter) => ({
        ...chapter,
        partId: part.id,
        partOrder: part.order,
        partTitle: part.title,
      })),
  );
}

/** Cleared chapters over total, across every part — the arc-level progress
 *  line at the top of the index. */
export function getArcProgress(completed: Record<string, boolean>): {
  cleared: number;
  total: number;
} {
  let cleared = 0;
  let total = 0;
  for (const part of storyParts) {
    for (const chapter of part.chapters) {
      total += 1;
      if (completed[chapterKey(part.id, chapter.id)] === true) cleared += 1;
    }
  }
  return { cleared, total };
}
