import { describe, expect, it } from "vitest";
import {
  buildStoryIndex,
  buildStoryIndexView,
  chapterKey,
  getArcProgress,
  getChapterState,
  getStoryParts,
  searchChapters,
} from "@/lib/game/storyCatalog";

/**
 * Sealed chapters render redacted rather than listed-but-dimmed, so these
 * assertions are the spoiler policy: a chapter the player hasn't reached must
 * come back tagged `sealed`, and the component keys the redaction off that tag
 * alone (Tanveer, 2026-08-11).
 */
const parts = getStoryParts();
const [first, second] = parts;

/** Everything up to and including the given chapter index of part 1. */
const clearThrough = (index: number): Record<string, boolean> =>
  Object.fromEntries(
    first.chapters
      .slice(0, index + 1)
      .map((chapter) => [chapterKey(first.id, chapter.id), true]),
  );

describe("getChapterState", () => {
  it("opens the very first chapter on a fresh save", () => {
    expect(getChapterState({}, first.id, first.chapters[0].id)).toBe("current");
  });

  it("seals everything after it", () => {
    for (const chapter of first.chapters.slice(1)) {
      expect(getChapterState({}, first.id, chapter.id)).toBe("sealed");
    }
  });

  it("marks a finished chapter cleared and opens exactly the next one", () => {
    const completed = clearThrough(0);
    expect(getChapterState(completed, first.id, first.chapters[0].id)).toBe(
      "cleared",
    );
    expect(getChapterState(completed, first.id, first.chapters[1].id)).toBe(
      "current",
    );
    expect(getChapterState(completed, first.id, first.chapters[2].id)).toBe(
      "sealed",
    );
  });

  it("never reports two current chapters at once", () => {
    for (let i = -1; i < first.chapters.length; i += 1) {
      const completed = i < 0 ? {} : clearThrough(i);
      const current = first.chapters.filter(
        (c) => getChapterState(completed, first.id, c.id) === "current",
      );
      expect(current.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("buildStoryIndex", () => {
  it("seals a later part until the previous one is finished", () => {
    const index = buildStoryIndex({});
    expect(index[0].sealed).toBe(false);
    expect(index[1].sealed).toBe(true);
  });

  it("opens the next part once the previous part's last chapter clears", () => {
    const index = buildStoryIndex(clearThrough(first.chapters.length - 1));
    expect(index[1].sealed).toBe(false);
    expect(index[1].chapters[0].state).toBe("current");
  });

  it("keeps sealed chapters in the list so a part can't look finished", () => {
    // The row survives redaction — that's the difference between this and
    // dropping locked chapters entirely.
    const index = buildStoryIndex({});
    expect(index[0].chapters).toHaveLength(first.chapters.length);
    expect(index[0].chapters.map((c) => c.number)).toEqual(
      first.chapters.map((_, i) => i + 1),
    );
  });

  it("counts cleared chapters per part", () => {
    expect(buildStoryIndex(clearThrough(1))[0].clearedCount).toBe(2);
  });

  it("carries the enemy ids each visible row needs", () => {
    const chapter = buildStoryIndex({})[0].chapters[0];
    expect(chapter.enemyIds).toEqual(
      first.chapters[0].battle!.enemyTeam.map((unit) => unit.id),
    );
  });
});

describe("buildStoryIndexView", () => {
  it("leads with the part holding the current chapter", () => {
    const view = buildStoryIndexView({});
    expect(view.lead?.id).toBe(first.id);
    expect(view.current?.id).toBe(first.chapters[0].id);
    expect(view.finished).toEqual([]);
    expect(view.sealedPartCount).toBe(parts.length - 1);
  });

  it("moves the lead forward and collapses the finished part behind it", () => {
    const view = buildStoryIndexView(clearThrough(first.chapters.length - 1));
    expect(view.lead?.id).toBe(second.id);
    expect(view.finished.map((p) => p.id)).toEqual([first.id]);
    expect(view.sealedPartCount).toBe(parts.length - 2);
  });

  it("orders finished parts newest first", () => {
    // Reverse chronology is the whole point of the layout — scrolling down
    // goes back in time.
    const everything = Object.fromEntries(
      parts.flatMap((part) =>
        part.chapters.map((c) => [chapterKey(part.id, c.id), true]),
      ),
    );
    const view = buildStoryIndexView(everything);
    const orders = view.finished.map((p) => p.order);
    expect(orders).toEqual([...orders].sort((a, b) => b - a));
  });

  it("has no current chapter once the arc is finished", () => {
    const everything = Object.fromEntries(
      parts.flatMap((part) =>
        part.chapters.map((c) => [chapterKey(part.id, c.id), true]),
      ),
    );
    const view = buildStoryIndexView(everything);
    expect(view.current).toBeNull();
    // The last part still leads rather than the index rendering an empty slot.
    expect(view.lead?.id).toBe(parts[parts.length - 1].id);
    expect(view.sealedPartCount).toBe(0);
  });
});

describe("searchChapters", () => {
  it("returns every visible chapter for an empty query", () => {
    const hits = searchChapters(clearThrough(1), "");
    expect(hits).toHaveLength(3); // 2 cleared + 1 current
    expect(hits.every((h) => h.state !== "sealed")).toBe(true);
  });

  it("NEVER matches a sealed chapter, even by its exact title", () => {
    // This is the spoiler boundary, not a nicety: if search matched sealed
    // chapters it would become an enumeration tool and walk straight past the
    // redaction the whole index is built around.
    const sealed = first.chapters[first.chapters.length - 1];
    expect(getChapterState({}, first.id, sealed.id)).toBe("sealed");
    expect(searchChapters({}, sealed.title)).toEqual([]);
  });

  it("leaks nothing for any sealed title, at any progress point", () => {
    for (let i = -1; i < first.chapters.length - 1; i += 1) {
      const completed = i < 0 ? {} : clearThrough(i);
      for (const chapter of first.chapters) {
        if (getChapterState(completed, first.id, chapter.id) !== "sealed") continue;
        const hits = searchChapters(completed, chapter.title);
        expect(hits.some((h) => h.id === chapter.id)).toBe(false);
      }
    }
  });

  it("matches a visible chapter by title, case-insensitively", () => {
    const target = first.chapters[0];
    const hits = searchChapters({}, target.title.toUpperCase());
    expect(hits.map((h) => h.id)).toContain(target.id);
  });

  it("matches by part title too, since that part is already open", () => {
    const hits = searchChapters({}, first.title);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.partId === first.id)).toBe(true);
  });

  it("tags each hit with the part it came from", () => {
    const hit = searchChapters({}, "")[0];
    expect(hit.partId).toBe(first.id);
    expect(hit.partOrder).toBe(first.order);
    expect(hit.partTitle).toBe(first.title);
  });

  it("finds nothing for a query that matches no visible chapter", () => {
    expect(searchChapters({}, "zzzznotachapter")).toEqual([]);
  });
});

describe("getArcProgress", () => {
  it("counts across every part, not just the current one", () => {
    const total = parts.reduce((sum, part) => sum + part.chapters.length, 0);
    expect(getArcProgress({})).toEqual({ cleared: 0, total });
    expect(getArcProgress(clearThrough(1)).cleared).toBe(2);
  });

  it("reaches full only when the last part is finished too", () => {
    const everything = Object.fromEntries(
      parts.flatMap((part) =>
        part.chapters.map((c) => [chapterKey(part.id, c.id), true]),
      ),
    );
    const progress = getArcProgress(everything);
    expect(progress.cleared).toBe(progress.total);
    expect(second).toBeDefined();
  });
});
