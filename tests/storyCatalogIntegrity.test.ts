import { describe, expect, it } from "vitest";
import { getStoryParts, UPCOMING_PARTS } from "@/lib/game/storyCatalog";
import { getCharacterById } from "@/lib/game/characterCatalog";

/**
 * All twelve written webtoon chapters were adapted on 2026-08-12. Two rulings
 * shape the result and both are easy to erode by accident:
 *
 *   - **No invented battles.** A chapter only fights where the source fights.
 *   - **Battles you can't win end early**, via `victoryAtEnemyHpPercent`.
 *
 * The schema already rejects malformed data at load. This checks the things a
 * schema can't: that the set is complete, ordered, internally consistent, and
 * that the early-out rule is applied where it was meant to be.
 */

const parts = getStoryParts();

describe("story catalogue shape", () => {
  it("adapts all twelve parts, in order, with no gaps", () => {
    expect(parts.map((p) => p.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("advertises nothing as upcoming that isn't written", () => {
    // Phase 3 isn't in the source yet; an entry here would be a locked banner
    // with nothing behind it.
    expect(UPCOMING_PARTS).toEqual([]);
  });

  it("has unique part and chapter ids", () => {
    const partIds = parts.map((p) => p.id);
    expect(new Set(partIds).size).toBe(partIds.length);
    const chapterIds = parts.flatMap((p) => p.chapters.map((c) => c.id));
    expect(new Set(chapterIds).size).toBe(chapterIds.length);
  });

  it("gives every part a cover character that exists", () => {
    for (const part of parts) {
      expect(getCharacterById(part.coverCharacterId)).toBeDefined();
    }
  });

  it("gives every chapter something to show", () => {
    // A chapter with no scenes AND no battle is an empty screen.
    for (const part of parts) {
      for (const chapter of part.chapters) {
        const hasScenes = chapter.intro.length + chapter.outro.length > 0;
        expect(hasScenes || chapter.battle).toBeTruthy();
      }
    }
  });
});

describe("rewards", () => {
  it("pays first-clear account XP on every chapter, scene-only included", () => {
    // Scene-only chapters still pay — that was the point of supporting them.
    for (const part of parts) {
      for (const chapter of part.chapters) {
        expect(chapter.rewards.firstClear.accountXp ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("never lowers account XP as the story goes on", () => {
    const xp = parts.flatMap((p) =>
      p.chapters.map((c) => c.rewards.firstClear.accountXp ?? 0),
    );
    for (let i = 1; i < xp.length; i += 1) {
      expect(xp[i]).toBeGreaterThanOrEqual(xp[i - 1]);
    }
  });

  it("charges no replay stamina for a chapter with no battle", () => {
    for (const part of parts) {
      for (const chapter of part.chapters) {
        if (!chapter.battle) {
          expect(chapter.rewards.replayStamina).toBe(0);
        }
      }
    }
  });
});

describe("no invented battles", () => {
  it("leaves the fightless source chapters fightless", () => {
    // Webtoon chapters 3, 4, 6, 11 and 12 contain no combat. Tanveer ruled
    // against inventing any (2026-08-12), so these parts carry none.
    const sceneOnlyParts = [3, 4, 6, 11, 12];
    for (const order of sceneOnlyParts) {
      const part = parts.find((p) => p.order === order);
      expect(part).toBeDefined();
      const battles = part!.chapters.filter((c) => c.battle);
      expect(battles).toEqual([]);
    }
  });

  it("keeps the battles the source does have", () => {
    const battleCounts = new Map(
      parts.map((p) => [p.order, p.chapters.filter((c) => c.battle).length]),
    );
    expect(battleCounts.get(5)).toBe(4); // the Tao fight
    expect(battleCounts.get(7)).toBe(3); // Chiara's three recollections
    expect(battleCounts.get(8)).toBe(1); // Duke vs Batra
    expect(battleCounts.get(9)).toBe(3); // Molvarr
    expect(battleCounts.get(10)).toBe(1); // Lyra and Sara's crossing
  });
});

describe("battles you aren't meant to win", () => {
  const withThreshold = parts.flatMap((p) =>
    p.chapters
      .filter((c) => c.victoryAtEnemyHpPercent !== undefined)
      .map((c) => `${p.id}/${c.id}`),
  );

  it("applies the early-out only where the source says victory isn't the goal", () => {
    expect(withThreshold.sort()).toEqual(
      [
        "part7/p7c3", // Chiara concedes; the fight has no finish
        "part8/p8c2", // Duke and Batra break off, neither goes down
        "part9/p9c1", // Molvarr — survival and crossing, not victory
        "part9/p9c2",
        "part9/p9c3",
      ].sort(),
    );
  });

  it("always pairs the threshold with a real battle", () => {
    for (const part of parts) {
      for (const chapter of part.chapters) {
        if (chapter.victoryAtEnemyHpPercent !== undefined) {
          expect(chapter.battle).toBeDefined();
        }
      }
    }
  });

  it("uses the ruled 20% everywhere it's used at all", () => {
    for (const part of parts) {
      for (const chapter of part.chapters) {
        if (chapter.victoryAtEnemyHpPercent !== undefined) {
          expect(chapter.victoryAtEnemyHpPercent).toBe(20);
        }
      }
    }
  });
});
