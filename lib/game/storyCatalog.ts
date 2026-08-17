import chapter1 from "@/data/story/chapter-1.json";
import { missionProgress } from "@/lib/game/stageMissions";
import { validateStoryChapters } from "@/lib/game/storySchema";
import type { StoryChapter, StoryStage } from "@/types/story";

/**
 * The story catalog — **Chapter → Stage** (story mode v2, 2026-08-18).
 *
 * Chapters are authored one at a time, each 1:1 with a webtoon chapter in
 * `E:\Toll - Web toon`. Only the chapters that exist here are in the game; the
 * arc's remaining chapters are not advertised as empty shells, because a locked
 * banner still leaks a title and a title is a spoiler.
 *
 * Everything in this file is pure so the visibility and unlock rules stay
 * unit-testable and the screens stay presentational.
 */

const storyChapters: StoryChapter[] = validateStoryChapters([chapter1]).sort(
  (a, b) => a.number - b.number,
);

/** Chapters written in the source but not yet adapted — how many, not which.
 *  Twelve beat sheets exist; the rest of Arc One caps at 24. */
export const SOURCE_CHAPTERS_WRITTEN = 12;

export function getStoryChapters(): StoryChapter[] {
  return storyChapters;
}

export function getStoryChapter(chapterId: string): StoryChapter | undefined {
  return storyChapters.find((chapter) => chapter.id === chapterId);
}

export function getStoryStage(
  chapterId: string,
  stageId: string,
): StoryStage | undefined {
  return getStoryChapter(chapterId)?.stages.find((stage) => stage.id === stageId);
}

/** Progress key for one stage — the shape stored in cleared maps. */
export function stageKey(chapterId: string, stageId: string): string {
  return `${chapterId}:${stageId}`;
}

/** `1-3` — what the player calls a stage, and what the UI labels it. */
export function stageLabel(chapter: StoryChapter, stage: StoryStage): string {
  return `${chapter.number}-${stage.number}`;
}

/**
 * Sequential unlock: the first stage of the first chapter is always open; every
 * other stage opens when its predecessor is cleared, and a chapter's first stage
 * opens when the previous chapter's last stage is cleared.
 */
export function isStageUnlocked(
  cleared: Record<string, boolean>,
  chapterId: string,
  stageId: string,
): boolean {
  const chapterIndex = storyChapters.findIndex(
    (chapter) => chapter.id === chapterId,
  );
  if (chapterIndex === -1) return false;
  const chapter = storyChapters[chapterIndex];
  const stageIndex = chapter.stages.findIndex((stage) => stage.id === stageId);
  if (stageIndex === -1) return false;

  if (stageIndex > 0) {
    const previous = chapter.stages[stageIndex - 1];
    return cleared[stageKey(chapterId, previous.id)] === true;
  }
  if (chapterIndex === 0) return true;

  const previousChapter = storyChapters[chapterIndex - 1];
  const last = previousChapter.stages[previousChapter.stages.length - 1];
  return cleared[stageKey(previousChapter.id, last.id)] === true;
}

/** A chapter is open once its first stage is. */
export function isChapterUnlocked(
  cleared: Record<string, boolean>,
  chapterId: string,
): boolean {
  const chapter = getStoryChapter(chapterId);
  if (!chapter) return false;
  return isStageUnlocked(cleared, chapterId, chapter.stages[0].id);
}

/**
 * What the stage list may show about a stage.
 *
 * Sequential unlock means at most one stage is ever `current`: the first
 * unlocked stage you haven't cleared. A `sealed` row keeps its number and hides
 * its name — stage names are themselves spoilers ("Nine Years", "The Notice").
 */
export type StageState = "cleared" | "current" | "sealed";

export function getStageState(
  cleared: Record<string, boolean>,
  chapterId: string,
  stageId: string,
): StageState {
  if (cleared[stageKey(chapterId, stageId)] === true) return "cleared";
  return isStageUnlocked(cleared, chapterId, stageId) ? "current" : "sealed";
}

export interface StoryIndexStage {
  id: string;
  /** 1-based position within its chapter — kept on sealed rows, which is the
   *  whole point of hiding the name rather than removing the row. */
  number: number;
  label: string;
  name: string;
  kind: StoryStage["kind"];
  state: StageState;
  stamina: number;
  /** Enemy ids per wave, front to back — what the row's wave rail renders. */
  waves: string[][];
  missionsClaimed: number;
  missionsTotal: number;
}

export interface StoryIndexChapter {
  id: string;
  number: number;
  title: string;
  tagline: string;
  coverCharacterId: string;
  /** Withheld from the list entirely when true — see `visibleChapters`. */
  sealed: boolean;
  clearedStages: number;
  totalStages: number;
  missionsClaimed: number;
  missionsTotal: number;
  stages: StoryIndexStage[];
}

/**
 * The whole index in one pass: every chapter, every stage, each tagged with what
 * may be shown and how much of it is banked.
 *
 * Mission counts ride along because a **cleared** chapter still needs a reason to
 * exist on the screen, and an unclaimed mission is that reason.
 */
export function buildStoryIndex(
  cleared: Record<string, boolean>,
  claimedMissions: Record<string, boolean> = {},
): StoryIndexChapter[] {
  return storyChapters.map((chapter) => {
    const stages: StoryIndexStage[] = chapter.stages.map((stage) => {
      const missions = missionProgress([stage], chapter.id, claimedMissions);
      return {
        id: stage.id,
        number: stage.number,
        label: stageLabel(chapter, stage),
        name: stage.name,
        kind: stage.kind,
        state: getStageState(cleared, chapter.id, stage.id),
        stamina: stage.stamina,
        waves: stage.waves.map((wave) => wave.enemies.map((unit) => unit.id)),
        missionsClaimed: missions.claimed,
        missionsTotal: missions.total,
      };
    });
    const missions = missionProgress(chapter.stages, chapter.id, claimedMissions);
    return {
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      tagline: chapter.tagline,
      coverCharacterId: chapter.coverCharacterId,
      sealed: !isChapterUnlocked(cleared, chapter.id),
      clearedStages: stages.filter((stage) => stage.state === "cleared").length,
      totalStages: stages.length,
      missionsClaimed: missions.claimed,
      missionsTotal: missions.total,
      stages,
    };
  });
}

/**
 * The chapters the player may see, newest first.
 *
 * A chapter appears only once the previous one is **complete** (ruling #99),
 * which is already what `isChapterUnlocked` computes. Sealed chapters are
 * **withheld, not redacted**: a chapter card renders a real title, tagline and
 * cover, and all three are spoilers, so the list itself has to be the boundary.
 *
 * Newest-first because the list scrolls down into the past — the chapter you're
 * on lands on top, under the thumb, with no scroll restoration to get wrong.
 */
export function visibleChapters(
  cleared: Record<string, boolean>,
  claimedMissions: Record<string, boolean> = {},
): StoryIndexChapter[] {
  return buildStoryIndex(cleared, claimedMissions)
    .filter((chapter) => !chapter.sealed)
    .reverse();
}

/**
 * The single stage the player is up to, or null on a fully cleared catalog.
 *
 * Used two ways: the chapter list opens on its chapter, and the result screen's
 * `NEXT` names it. Both need the *player's furthest point*, which is why this
 * reads state rather than taking a position — offering "next" after a replay
 * would otherwise advertise a jump to wherever they actually are (ruling #97).
 */
export function currentStage(
  cleared: Record<string, boolean>,
): { chapter: StoryChapter; stage: StoryStage } | null {
  for (const chapter of storyChapters) {
    for (const stage of chapter.stages) {
      if (getStageState(cleared, chapter.id, stage.id) === "current") {
        return { chapter, stage };
      }
    }
  }
  return null;
}

/** The stage after this one, if it exists and is now open — what `NEXT` links
 *  to. Crosses a chapter boundary, since clearing a boss opens the next one. */
export function stageAfter(
  cleared: Record<string, boolean>,
  chapterId: string,
  stageId: string,
): { chapter: StoryChapter; stage: StoryStage } | null {
  const chapterIndex = storyChapters.findIndex((c) => c.id === chapterId);
  if (chapterIndex === -1) return null;
  const chapter = storyChapters[chapterIndex];
  const stageIndex = chapter.stages.findIndex((s) => s.id === stageId);
  if (stageIndex === -1) return null;

  if (stageIndex + 1 < chapter.stages.length) {
    return { chapter, stage: chapter.stages[stageIndex + 1] };
  }
  const nextChapter = storyChapters[chapterIndex + 1];
  if (!nextChapter) return null;
  return { chapter: nextChapter, stage: nextChapter.stages[0] };
}

/** Cleared stages over total, across every adapted chapter. */
export function getArcProgress(cleared: Record<string, boolean>): {
  cleared: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (const chapter of storyChapters) {
    for (const stage of chapter.stages) {
      total += 1;
      if (cleared[stageKey(chapter.id, stage.id)] === true) done += 1;
    }
  }
  return { cleared: done, total };
}
