import part1 from "@/data/story/part1.json";
import part2 from "@/data/story/part2.json";
import { validateStoryParts } from "@/lib/game/storySchema";
import type { StoryChapter, StoryPart } from "@/types/story";

// Fail loudly at load time on malformed story JSON or battles that
// reference characters missing from the catalog — same policy as kits.
const storyParts: StoryPart[] = validateStoryParts([part1, part2]).sort(
  (a, b) => a.order - b.order,
);

/** Source chapters not yet adapted — shown as locked banners in the UI */
export const UPCOMING_PARTS: ReadonlyArray<{ order: number; title: string }> = [
  { order: 3, title: "Welcome to the Ledger Exam" },
  { order: 4, title: "Master of Fire" },
  { order: 5, title: "Trial by Fire" },
  { order: 6, title: "Aftermath" },
];

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
