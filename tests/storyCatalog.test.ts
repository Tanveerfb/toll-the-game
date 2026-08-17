import { describe, expect, it } from "vitest";
import { GAME_EVENTS } from "@/lib/game/events";
import {
  buildStoryIndex,
  currentStage,
  getArcProgress,
  getStageState,
  getStoryChapters,
  isChapterUnlocked,
  isStageUnlocked,
  stageAfter,
  stageKey,
  stageLabel,
  visibleChapters,
} from "@/lib/game/storyCatalog";

/**
 * The story catalog's visibility and unlock rules (story mode v2, 2026-08-18).
 *
 * These are the rules a player would experience as bugs: a stage that opens too
 * early skips the story, one that never opens is a dead end, and a chapter shown
 * too early spoils its own title (ruling #99).
 */

const chapters = getStoryChapters();
const first = chapters[0];
const stages = first.stages;

/** Every stage up to and including `count`, cleared. */
function progress(count: number): Record<string, boolean> {
  const cleared: Record<string, boolean> = {};
  for (const stage of stages.slice(0, count)) {
    cleared[stageKey(first.id, stage.id)] = true;
  }
  return cleared;
}

describe("sequential unlock", () => {
  it("opens the very first stage on a fresh account and nothing else", () => {
    expect(isStageUnlocked({}, first.id, stages[0].id)).toBe(true);
    expect(isStageUnlocked({}, first.id, stages[1].id)).toBe(false);
  });

  it("opens each stage as its predecessor clears", () => {
    for (let i = 1; i < stages.length; i += 1) {
      expect(isStageUnlocked(progress(i), first.id, stages[i].id)).toBe(true);
      // …and no further: the one after it is still sealed.
      if (stages[i + 1]) {
        expect(isStageUnlocked(progress(i), first.id, stages[i + 1].id)).toBe(false);
      }
    }
  });

  it("never unlocks anything for an unknown chapter or stage", () => {
    expect(isStageUnlocked(progress(5), "c99", "s1")).toBe(false);
    expect(isStageUnlocked(progress(5), first.id, "nope")).toBe(false);
    expect(isChapterUnlocked({}, "c99")).toBe(false);
  });
});

describe("state per stage", () => {
  it("marks exactly one stage current", () => {
    const cleared = progress(2);
    const states = stages.map((stage) => getStageState(cleared, first.id, stage.id));
    expect(states.filter((state) => state === "current")).toHaveLength(1);
    expect(states.slice(0, 2).every((state) => state === "cleared")).toBe(true);
  });

  it("has no current stage once everything is cleared", () => {
    expect(currentStage(progress(stages.length))).toBeNull();
  });

  it("points currentStage at the player's furthest point", () => {
    const at = currentStage(progress(3));
    expect(at?.stage.id).toBe(stages[3].id);
  });
});

describe("what the player may see", () => {
  it("withholds a sealed chapter entirely rather than redacting it", () => {
    // A chapter card carries a real title, tagline and cover, and all three are
    // spoilers — so the list itself is the boundary (ruling #99).
    const visible = visibleChapters({});
    expect(visible.map((c) => c.id)).toEqual([first.id]);
  });

  it("lists chapters newest first, so the one you're on is on top", () => {
    const visible = visibleChapters(progress(stages.length));
    if (visible.length > 1) {
      expect(visible[0].number).toBeGreaterThan(visible[1].number);
    }
    expect(visible[0].id).toBe(chapters[chapters.length - 1].id);
  });

  it("counts cleared stages and claimed missions per chapter", () => {
    const [index] = buildStoryIndex(progress(2), {});
    expect(index.clearedStages).toBe(2);
    expect(index.totalStages).toBe(stages.length);
    expect(index.missionsClaimed).toBe(0);
    expect(index.missionsTotal).toBeGreaterThan(0);
  });
});

describe("what comes next", () => {
  it("names the following stage inside a chapter", () => {
    const after = stageAfter(progress(1), first.id, stages[0].id);
    expect(after?.stage.id).toBe(stages[1].id);
  });

  it("returns null at the end of the adapted catalog", () => {
    const last = chapters[chapters.length - 1];
    const lastStage = last.stages[last.stages.length - 1];
    expect(stageAfter(progress(stages.length), last.id, lastStage.id)).toBeNull();
  });

  it("labels a stage the way the player refers to it", () => {
    expect(stageLabel(first, stages[0])).toBe(`${first.number}-1`);
  });
});

describe("arc progress", () => {
  it("counts across every adapted chapter", () => {
    const total = chapters.reduce((sum, chapter) => sum + chapter.stages.length, 0);
    expect(getArcProgress({})).toEqual({ cleared: 0, total });
    expect(getArcProgress(progress(2)).cleared).toBe(2);
  });
});

describe("auto clear never touches story", () => {
  it("has no eligible event naming a story chapter or stage", () => {
    // Tanveer, 2026-08-18: story mode gets no Auto Clear support. A ticket buys
    // time, never story progress. Auto Clear is gated on an event carrying
    // `autoClearEligible`, so the guard is that no such event is a story one —
    // asserted here rather than trusted to a comment, because the ticket getting
    // generalised is exactly the change that would break it quietly.
    const eligible = GAME_EVENTS.filter((event) => event.autoClearEligible === true);
    expect(eligible.map((event) => event.id)).toEqual(["molvarr"]);

    const storyIds = new Set<string>();
    for (const chapter of chapters) {
      storyIds.add(chapter.id);
      for (const stage of chapter.stages) {
        storyIds.add(stage.id);
        storyIds.add(stageKey(chapter.id, stage.id));
      }
    }
    for (const event of eligible) {
      expect(storyIds.has(event.id)).toBe(false);
    }
  });
});
