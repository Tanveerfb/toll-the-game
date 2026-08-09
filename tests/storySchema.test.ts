import { describe, expect, it } from "vitest";
import { validateStoryParts } from "@/lib/game/storySchema";
import {
  chapterKey,
  getStoryParts,
  isChapterUnlocked,
  isPartUnlocked,
} from "@/lib/game/storyCatalog";

const validPart = {
  id: "test_part",
  order: 1,
  title: "Test Part",
  tagline: "A tagline",
  coverCharacterId: "duke",
  chapters: [
    {
      id: "tc1",
      title: "Test Chapter",
      intro: [{ text: "Opening narration." }],
      battle: {
        playerTeam: [{ id: "duke" }],
        enemyTeam: [{ id: "wild_beast" }],
      },
      outro: [{ speaker: "Narrator", text: "Closing narration." }],
      teamMode: "canon",
      rewards: {
        firstClear: { gems: 50, coin: 1500, materials: { training_manual: 2 } },
        repeat: {
          coin: { min: 300, max: 800 },
          materials: { training_manual: { min: 0, max: 2 } },
        },
        replayStamina: 5,
      },
    },
  ],
};

describe("story part validation (fail loudly at load, same as kits)", () => {
  it("accepts every shipped part", () => {
    expect(getStoryParts().length).toBeGreaterThanOrEqual(2);
  });

  it("accepts a well-formed part", () => {
    expect(() => validateStoryParts([validPart])).not.toThrow();
  });

  it("rejects a battle referencing an unknown character id", () => {
    const broken = structuredClone(validPart);
    broken.chapters[0].battle.enemyTeam = [{ id: "not_a_character" }];
    expect(() => validateStoryParts([broken])).toThrow(
      /test_part.*tc1.*not_a_character/,
    );
  });

  it("rejects a scene referencing an unknown portrait id", () => {
    const broken = structuredClone(validPart);
    broken.chapters[0].intro = [
      { text: "Bad portrait", portraitId: "ghost_unit" } as never,
    ];
    expect(() => validateStoryParts([broken])).toThrow(
      /test_part.*tc1.*ghost_unit/,
    );
  });

  it("rejects a malformed part with the part id and path", () => {
    const broken = structuredClone(validPart) as Record<string, unknown>;
    delete broken.tagline;
    expect(() => validateStoryParts([broken])).toThrow(/test_part.*tagline/);
  });

  it("rejects a chapter without a battle team", () => {
    const broken = structuredClone(validPart);
    broken.chapters[0].battle.playerTeam = [];
    expect(() => validateStoryParts([broken])).toThrow(/test_part/);
  });

  it("rejects a chapter with no teamMode — a silent default hides an unfinished chapter", () => {
    const broken = structuredClone(validPart) as Record<string, unknown>;
    delete (broken.chapters as Record<string, unknown>[])[0].teamMode;
    expect(() => validateStoryParts([broken])).toThrow(/test_part.*teamMode/);
  });

  it("rejects an unknown teamMode", () => {
    const broken = structuredClone(validPart);
    (broken.chapters[0] as Record<string, unknown>).teamMode = "coop";
    expect(() => validateStoryParts([broken])).toThrow(/test_part.*teamMode/);
  });

  it("rejects a chapter with no rewards block", () => {
    const broken = structuredClone(validPart) as Record<string, unknown>;
    delete (broken.chapters as Record<string, unknown>[])[0].rewards;
    expect(() => validateStoryParts([broken])).toThrow(/test_part.*rewards/);
  });

  it("rejects a drop range whose min exceeds its max", () => {
    const broken = structuredClone(validPart);
    broken.chapters[0].rewards.repeat.coin = { min: 900, max: 100 };
    expect(() => validateStoryParts([broken])).toThrow(/test_part.*coin/);
  });

  it("rejects a negative replay stamina cost", () => {
    const broken = structuredClone(validPart);
    broken.chapters[0].rewards.replayStamina = -1;
    expect(() => validateStoryParts([broken])).toThrow(
      /test_part.*replayStamina/,
    );
  });

  it("rejects a replay cost the stamina bar can never reach", () => {
    const broken = structuredClone(validPart);
    broken.chapters[0].rewards.replayStamina = 999;
    expect(() => validateStoryParts([broken])).toThrow(
      /test_part.*replayStamina/,
    );
  });

  it("rejects an unknown material id in the first-clear bundle", () => {
    const broken = structuredClone(validPart);
    // The fixture's literal type pins the known material keys; the point of
    // the test is data that never went through TypeScript in the first place.
    broken.chapters[0].rewards.firstClear.materials = {
      dragon_scale: 1,
    } as unknown as typeof broken.chapters[0]["rewards"]["firstClear"]["materials"];
    expect(() => validateStoryParts([broken])).toThrow(/test_part.*materials/);
  });

  it("rejects an unknown material id in the repeat drops", () => {
    const broken = structuredClone(validPart);
    broken.chapters[0].rewards.repeat.materials = {
      dragon_scale: { min: 1, max: 2 },
    } as unknown as typeof broken.chapters[0]["rewards"]["repeat"]["materials"];
    expect(() => validateStoryParts([broken])).toThrow(/test_part.*materials/);
  });
});

describe("sequential chapter unlock", () => {
  const parts = getStoryParts();
  const [first, second] = parts;

  it("opens only the very first chapter with no progress", () => {
    expect(isChapterUnlocked({}, first.id, first.chapters[0].id)).toBe(true);
    expect(isChapterUnlocked({}, first.id, first.chapters[1].id)).toBe(false);
    expect(isPartUnlocked({}, second.id)).toBe(false);
  });

  it("opens the next chapter once the previous one is cleared", () => {
    const completed = { [chapterKey(first.id, first.chapters[0].id)]: true };
    expect(isChapterUnlocked(completed, first.id, first.chapters[1].id)).toBe(
      true,
    );
    expect(isChapterUnlocked(completed, first.id, first.chapters[2].id)).toBe(
      false,
    );
  });

  it("opens the next part once the previous part's last chapter clears", () => {
    const completed: Record<string, boolean> = {};
    first.chapters.forEach((chapter) => {
      completed[chapterKey(first.id, chapter.id)] = true;
    });
    expect(isPartUnlocked(completed, second.id)).toBe(true);
    expect(
      isChapterUnlocked(completed, second.id, second.chapters[0].id),
    ).toBe(true);
  });

  it("returns false for unknown parts and chapters", () => {
    expect(isChapterUnlocked({}, "nope", "nah")).toBe(false);
    expect(isPartUnlocked({}, "nope")).toBe(false);
  });
});
